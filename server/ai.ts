import { GoogleGenAI } from '@google/genai';
import { config } from './config.ts';
import { one, run, nowIso } from './db.ts';
import { chartToPromptText, reportSections, targetYear, type Chart } from './saju.ts';

const ai = config.gemini.apiKey ? new GoogleGenAI({ apiKey: config.gemini.apiKey }) : null;
export const aiMode: 'gemini' | 'mock' = ai ? 'gemini' : 'mock';

function genConfig(systemInstruction: string, maxOutputTokens: number, temperature: number) {
  const cfg: Record<string, unknown> = { systemInstruction, maxOutputTokens, temperature };
  if (config.gemini.thinkingBudget !== '') {
    cfg.thinkingConfig = { thinkingBudget: Number(config.gemini.thinkingBudget) };
  }
  return cfg;
}

function logUsage(userId: string | null, kind: 'report' | 'chat', usage: any) {
  const input = usage?.promptTokenCount ?? 0;
  const output = (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0);
  const g = config.gemini;
  const costKrw = ((input * g.priceInputPerMUsd + output * g.priceOutputPerMUsd) / 1_000_000) * g.usdKrw;
  run(
    'INSERT INTO ai_usage (user_id, kind, model, input_tokens, output_tokens, cost_krw, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    userId,
    kind,
    ai ? g.model : 'mock',
    input,
    output,
    costKrw,
    nowIso(),
  );
}

const BASE_RULES = `
- 한국어 해요체로 쓴다. 따뜻하지만 돌려 말하지 않는다.
- 사주 원국의 글자(일간, 오행 개수, 십신, 대운)를 근거로 들어 구체적으로 쓴다. 누구에게나 맞는 말은 피한다.
- 겁주거나 불행을 단정하지 않는다. 조심할 점은 대처법과 함께 쓴다.
- 질병 진단, 투자 종목, 법률 판단은 하지 않는다. 필요하면 전문가 상담을 권한다.
- 이모지를 쓰지 않는다.
`.trim();

export function reportPrompt(name: string, gender: 'M' | 'F', birthTime: string | null, chart: Chart) {
  const ty = targetYear();
  const sections = reportSections();
  const system = `너는 20년 경력의 명리학 상담가다. 의뢰인의 사주 원국을 보고 전체 풀이를 쓴다.
${BASE_RULES}
- 아래 제목을 순서대로 마크다운 "## 제목"으로 쓰고, 다른 제목은 추가하지 않는다.
${sections.map((s) => `  ## ${s.title}`).join('\n')}
- 각 섹션은 2~4개 문단, 문단은 2~4문장. 핵심 문장 한두 개만 **굵게** 표시한다.
- "${ty.label} 운세"에는 상반기와 하반기 흐름, 기회가 오는 달, 조심할 달을 구체적으로 쓴다. 올해 세운은 ${ty.ganzhi}(${ty.ganzhiKo})이다.
- "10년 대운의 흐름"에는 현재 대운과 다음 대운이 원국과 만나 무엇이 달라지는지 쓴다.
- "지금 해 볼 것"은 "- " 목록으로 3~5개, 바로 실천할 수 있는 행동으로 쓴다.
- 시간이 모름이면 시주 없이 풀이하고, 그 사실을 첫 섹션에서 한 문장으로만 언급한다.`;
  const user = `의뢰인 사주 정보:\n${chartToPromptText(name, gender, birthTime, chart)}\n\n전체 풀이를 써 줘.`;
  return { system, user };
}

/** 전체 풀이를 스트리밍으로 만들며 DB에 중간 결과를 저장한다. 클라이언트는 폴링으로 읽는다. */
export async function generateReport(readingId: string, userId: string) {
  const r = one('SELECT * FROM readings WHERE id = ?', readingId);
  if (!r) return;
  const chart: Chart = JSON.parse(r.chart_json);
  const { system, user } = reportPrompt(r.name, r.gender, r.birth_time, chart);
  run("UPDATE readings SET report_status = 'generating', report_md = '', report_started_at = ? WHERE id = ?", nowIso(), readingId);

  let text = '';
  let lastSave = 0;
  const save = (force = false) => {
    if (force || Date.now() - lastSave > 700) {
      run('UPDATE readings SET report_md = ? WHERE id = ?', text, readingId);
      lastSave = Date.now();
    }
  };

  try {
    let usage: any = null;
    if (ai) {
      const stream = await ai.models.generateContentStream({
        model: config.gemini.model,
        contents: [{ role: 'user', parts: [{ text: user }] }],
        config: genConfig(system, 6000, 0.8),
      });
      for await (const chunk of stream) {
        if (chunk.text) text += chunk.text;
        if (chunk.usageMetadata) usage = chunk.usageMetadata;
        save();
      }
    } else {
      for (const piece of mockReport(r.name, chart)) {
        text += piece;
        save();
        await new Promise((res) => setTimeout(res, 120));
      }
      usage = { promptTokenCount: 1200, candidatesTokenCount: 3500 };
    }
    if (!text.trim()) throw new Error('빈 응답');
    save(true);
    run("UPDATE readings SET report_status = 'done' WHERE id = ?", readingId);
    logUsage(userId, 'report', usage);
  } catch (e) {
    console.error('[report] 생성 실패', readingId, e);
    run("UPDATE readings SET report_status = 'error' WHERE id = ?", readingId);
  }
}

export async function chatReply(params: {
  userId: string;
  name: string;
  gender: 'M' | 'F';
  birthTime: string | null;
  chart: Chart;
  report: string | null;
  history: Array<{ role: 'user' | 'model'; content: string }>;
  message: string;
}): Promise<string> {
  const { userId, name, gender, birthTime, chart, report, history, message } = params;
  const system = `너는 20년 경력의 명리학 상담가다. 아래 의뢰인의 사주를 바탕으로 질문에 답한다.
${BASE_RULES}
- 답은 300~600자, 2~4개 문단. 결론을 첫 문장에 쓴다.
- 시기를 물으면 대운과 세운을 근거로 연도나 달을 짚어 준다. 올해 기준 세운은 ${targetYear().ganzhiKo}년이다.
- 사주와 상관없는 질문이면 짧게 답하고 사주 관점으로 이어 준다.

의뢰인 사주 정보:
${chartToPromptText(name, gender, birthTime, chart)}
${report ? `\n이미 전달한 전체 풀이 (참고):\n${report.slice(0, 6000)}` : ''}`;

  if (!ai) {
    logUsage(userId, 'chat', { promptTokenCount: 3000, candidatesTokenCount: 400 });
    return `(개발용 가짜 답변) "${message.slice(0, 40)}"에 대한 답입니다. ${chart.dayMaster.ko}${chart.dayMaster.element} 일간인 ${name}님은 흐름을 읽고 움직일 때 결과가 좋습니다. GEMINI_API_KEY를 넣으면 실제 답변이 나옵니다.`;
  }

  const contents = [
    ...history.map((h) => ({ role: h.role, parts: [{ text: h.content }] })),
    { role: 'user', parts: [{ text: message }] },
  ];
  const res = await ai.models.generateContent({
    model: config.gemini.model,
    contents,
    config: genConfig(system, 1200, 0.8),
  });
  logUsage(userId, 'chat', res.usageMetadata);
  const text = res.text?.trim();
  if (!text) throw new Error('빈 응답');
  return text;
}

function* mockReport(name: string, chart: Chart): Generator<string> {
  for (const s of reportSections()) {
    yield `## ${s.title}\n\n`;
    if (s.title === '지금 해 볼 것') {
      yield '- 개발용 가짜 풀이입니다.\n- GEMINI_API_KEY를 넣으면 실제 풀이가 생성됩니다.\n\n';
      continue;
    }
    yield `${name}님은 ${chart.dayMaster.ko}${chart.dayMaster.element} 일간입니다. `;
    yield `**이 문단은 개발 환경에서 만든 가짜 풀이입니다.** `;
    yield `오행은 ${Object.entries(chart.elementCounts).map(([e, c]) => `${e} ${c}`).join(', ')}입니다.\n\n`;
  }
}
