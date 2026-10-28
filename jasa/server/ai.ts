import { ApiError, GoogleGenAI, type Content, type Part } from '@google/genai';
import type {
  AnalyzeRequest,
  ChatRequest,
  DraftContext,
  Experience,
  ExtractRequest,
  Feedback,
  FeedbackRequest,
  GenerateRequest,
  Source,
} from '../src/types.ts';
import { config, HttpError } from './config.ts';

let client: GoogleGenAI | null = null;

function gemini() {
  if (!config.geminiApiKey) {
    throw new HttpError(503, 'AI가 아직 설정되지 않았어요. 서버의 .env 파일에 GEMINI_API_KEY를 넣어 주세요.');
  }
  client ??= new GoogleGenAI({ apiKey: config.geminiApiKey });
  return client;
}

/** Gemini 오류를 사용자에게 보여줄 문장으로 바꿈 */
export function toHttpError(e: unknown): HttpError {
  if (e instanceof HttpError) return e;
  if (e instanceof ApiError) {
    if (e.status === 429) return new HttpError(503, 'AI 사용량이 몰려 잠시 쉬는 중이에요. 1분 뒤 다시 시도해 주세요.');
    if (e.status === 400 || e.status === 403) return new HttpError(502, `AI 요청이 거절됐어요: ${e.message}`);
  }
  console.error(e);
  return new HttpError(500, '잠시 문제가 생겼어요. 다시 시도해 주세요.');
}

// ── 프롬프트 재료 ─────────────────────────────────────────

function describeContext(c: DraftContext) {
  return [
    `회사: ${c.company || '(미입력)'}`,
    `직무: ${c.role || '(미입력)'}`,
    `문항: ${c.question}`,
    `글자 수 제한: 공백 포함 ${c.charLimit}자`,
    c.report ? `\n[기업·문항 분석]\n${c.report.slice(0, 8000)}` : '',
  ].join('\n');
}

function describeExperiences(list: Experience[]) {
  return list
    .map((x, i) =>
      [
        `${i + 1}. ${x.title}${x.period ? ` (${x.period})` : ''}`,
        x.situation && `- 상황: ${x.situation}`,
        x.task && `- 과제: ${x.task}`,
        x.action && `- 행동: ${x.action}`,
        x.result && `- 결과: ${x.result}`,
        x.skills.length ? `- 역량: ${x.skills.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');
}

const HONESTY = '지원자가 준 경험에 없는 사실(수치, 기관명, 수상, 성과)은 절대 지어내지 않는다. 꼭 필요한데 비어 있는 정보는 ○○ 로 남겨 지원자가 채우게 한다.';

// ── 1. 경험 정리 ──────────────────────────────────────────

const EXPERIENCE_SCHEMA = {
  type: 'object',
  properties: {
    experiences: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '경험을 한눈에 알 수 있는 짧은 제목' },
          period: { type: 'string', description: '기간. 자료에 없으면 빈 문자열' },
          situation: { type: 'string' },
          task: { type: 'string' },
          action: { type: 'string' },
          result: { type: 'string' },
          skills: { type: 'array', items: { type: 'string' }, description: '이 경험이 보여주는 역량 키워드 2~4개' },
        },
        required: ['title', 'period', 'situation', 'task', 'action', 'result', 'skills'],
      },
    },
  },
  required: ['experiences'],
};

export async function extractExperiences(req: ExtractRequest): Promise<Omit<Experience, 'id'>[]> {
  const parts: Part[] = [];
  if (req.file) parts.push({ inlineData: { mimeType: req.file.mimeType, data: req.file.data } });
  if (req.text?.trim()) parts.push({ text: req.text });
  if (!parts.length) throw new HttpError(400, '정리할 내용이나 파일을 넣어 주세요.');

  const res = await gemini().models.generateContent({
    model: config.geminiModel,
    contents: [{ role: 'user', parts }],
    config: {
      systemInstruction: [
        '너는 취업 컨설턴트다. 지원자가 준 이력서·활동 기록·메모에서 자기소개서 소재가 될 경험을 찾아 STAR(상황·과제·행동·결과)로 정리한다.',
        '- 서로 다른 경험은 따로 나눈다. 단순 나열(자격증 목록 등)은 경험으로 만들지 않는다.',
        '- 행동은 지원자가 "직접 한 일"이 드러나게, 결과는 숫자나 변화가 있으면 그대로 살린다.',
        `- ${HONESTY} 자료에 없는 항목은 빈 문자열로 둔다.`,
        '- 모든 내용은 한국어로, 각 항목은 1~3문장으로 쓴다.',
      ].join('\n'),
      responseMimeType: 'application/json',
      responseJsonSchema: EXPERIENCE_SCHEMA,
    },
  });
  const parsed = JSON.parse(res.text ?? '{}') as { experiences?: Omit<Experience, 'id'>[] };
  return parsed.experiences ?? [];
}

// ── 2. 기업·문항 분석 (Google 검색으로 최신 정보 반영) ─────────

export async function analyzeCompany(req: AnalyzeRequest): Promise<{ report: string; sources: Source[] }> {
  const prompt = [
    `회사: ${req.company}`,
    `직무: ${req.role || '(미입력)'}`,
    `문항: ${req.question}`,
    `글자 수 제한: 공백 포함 ${req.charLimit}자`,
    req.posting ? `\n[채용공고 원문]\n${req.posting.slice(0, 12000)}` : '',
  ].join('\n');

  const res = await gemini().models.generateContent({
    model: config.geminiModel,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      systemInstruction: [
        '너는 지원자를 돕는 기업 분석가다. Google 검색으로 회사의 최근 1년 소식(사업, 실적, 신사업, 공시, 보도)과 인재상을 찾아 자기소개서 작성에 쓸 분석을 만든다.',
        '아래 마크다운 형식만 출력한다. 각 섹션은 핵심만 3~5개의 짧은 글머리표로 쓴다.',
        '## 한 줄 요약',
        '## 최근 동향',
        '## 인재상과 직무 역량',
        '## 문항 의도',
        '## 이렇게 쓰면 좋아요',
        '## 핵심 키워드',
        '- "핵심 키워드"는 쉼표로 구분한 한 줄로 쓴다.',
        '- 검색으로 확인하지 못한 내용은 추측이라고 밝힌다.',
      ].join('\n'),
    },
  });

  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const chunk of res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []) {
    const web = chunk.web;
    if (!web?.uri || seen.has(web.uri)) continue;
    seen.add(web.uri);
    sources.push({ title: web.title || web.uri, uri: web.uri });
  }
  return { report: res.text ?? '', sources };
}

// ── 3. 초안 생성 (스트리밍) ──────────────────────────────────

export function streamDraft(req: GenerateRequest, signal: AbortSignal) {
  const prompt = [
    describeContext(req.context),
    `\n[활용할 경험]\n${describeExperiences(req.experiences) || '(선택한 경험 없음: 문항에 맞는 일반적인 구성만 잡고 내용은 ○○ 로 비워 둘 것)'}`,
    req.request ? `\n[지원자의 추가 요청]\n${req.request}` : '',
  ].join('\n');

  return gemini().models.generateContentStream({
    model: config.geminiModel,
    contents: prompt,
    config: {
      abortSignal: signal,
      systemInstruction: [
        '너는 대기업·공기업 서류 합격 자기소개서를 수없이 첨삭해 온 취업 컨설턴트다. 지원자의 경험으로 문항에 대한 답변을 한국어로 쓴다.',
        '- 맨 앞 줄에 답의 핵심을 담은 [소제목]을 쓰고, 첫 문장부터 문항에 대한 답을 먼저 말한다(두괄식).',
        '- 기업 분석에서 찾은 인재상·직무 역량과 경험을 구체적으로 연결한다. 회사 이름과 사업을 막연히 칭찬하지 않는다.',
        `- ${HONESTY}`,
        `- 분량은 글자 수 제한(공백 포함 ${req.context.charLimit}자)의 90~100%로 맞추고, 절대 넘기지 않는다.`,
        '- 상투적인 표현과 과장된 수식어를 피하고, 문장은 짧고 분명하게 쓴다.',
        '- 자기소개서 본문만 출력한다. 설명이나 머리말, 마크다운 기호는 붙이지 않는다.',
      ].join('\n'),
    },
  });
}

// ── 4. 첨삭 채팅 (스트리밍) ──────────────────────────────────

export function streamChat(req: ChatRequest, signal: AbortSignal) {
  const contents: Content[] = req.messages.slice(-20).map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
  if (contents[contents.length - 1]?.role !== 'user') throw new HttpError(400, '보낼 메시지가 없어요.');

  return gemini().models.generateContentStream({
    model: config.geminiModel,
    contents,
    config: {
      abortSignal: signal,
      systemInstruction: [
        '너는 지원자 옆에서 자기소개서를 함께 다듬는 첨삭 컨설턴트다. 아래 지원 정보와 현재 원고를 바탕으로 사용자의 요청에 답한다.',
        '- 답은 간결하게 하고, 왜 그렇게 고치는지 이유를 한두 문장으로 덧붙인다.',
        '- 원고 전체를 고쳐 쓸 때만 고친 전체 원고를 <draft>와 </draft> 사이에 넣는다. 일부 문장만 고칠 때는 태그 없이 "기존 → 수정" 형식으로 보여 준다.',
        `- 고친 원고는 글자 수 제한(공백 포함 ${req.context.charLimit}자)을 넘기지 않는다.`,
        `- ${HONESTY}`,
        '',
        '[지원 정보]',
        describeContext(req.context),
        '',
        `[현재 원고 (공백 포함 ${[...req.draft].length}자)]`,
        req.draft || '(아직 비어 있음)',
      ].join('\n'),
    },
  });
}

// ── 5. 심층 피드백 ────────────────────────────────────────

const FEEDBACK_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'integer', minimum: 0, maximum: 100, description: '두 평가자 점수를 종합한 점수' },
    summary: { type: 'string', description: '종합 평가 2~3문장' },
    reviews: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          reviewer: { type: 'string', enum: ['인사담당자', '현업 실무자'] },
          score: { type: 'integer', minimum: 0, maximum: 100 },
          strengths: { type: 'array', items: { type: 'string' } },
          improvements: { type: 'array', items: { type: 'string' } },
        },
        required: ['reviewer', 'score', 'strengths', 'improvements'],
      },
    },
    fixes: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        properties: {
          original: { type: 'string', description: '원고에 있는 문장·구절을 한 글자도 바꾸지 않고 그대로 복사' },
          suggestion: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['original', 'suggestion', 'reason'],
      },
    },
  },
  required: ['score', 'summary', 'reviews', 'fixes'],
};

export async function reviewDraft(req: FeedbackRequest): Promise<Feedback> {
  if (!req.draft.trim()) throw new HttpError(400, '평가할 원고가 비어 있어요.');
  const res = await gemini().models.generateContent({
    model: config.geminiModel,
    contents: `[지원 정보]\n${describeContext(req.context)}\n\n[원고 (공백 포함 ${[...req.draft].length}자)]\n${req.draft}`,
    config: {
      systemInstruction: [
        '너는 두 명의 평가자로서 자기소개서 원고를 냉정하게 평가한다.',
        '1) 인사담당자: 수백 장 중 서류를 거르는 사람. 문항에 바로 답하는지, 회사·직무 이해와 진정성, 읽기 쉬운지를 본다.',
        '2) 현업 실무자: 함께 일할 동료를 찾는 사람. 직무 역량이 구체적 행동과 결과로 증명되는지, 과장이 없는지를 본다.',
        '- 장점과 개선점은 원고의 구체적 문장을 근거로 각각 2~4개 쓴다. 뻔한 칭찬은 쓰지 않는다.',
        '- fixes에는 맞춤법·띄어쓰기 오류와, 어색하거나 힘이 약한 문장을 고른다. original은 원고의 문자열을 그대로 복사하고, 고친 문장과 이유를 준다.',
        '- 글자 수 제한을 넘었거나 70%에 못 미치면 개선점에 반드시 적는다.',
      ].join('\n'),
      responseMimeType: 'application/json',
      responseJsonSchema: FEEDBACK_SCHEMA,
    },
  });
  const parsed = JSON.parse(res.text ?? '{}') as Partial<Feedback>;
  return {
    score: parsed.score ?? 0,
    summary: parsed.summary ?? '',
    reviews: parsed.reviews ?? [],
    // 원고에 실제로 있는 문장만 남겨야 '적용' 버튼이 동작함
    fixes: (parsed.fixes ?? []).filter((f) => f.original && req.draft.includes(f.original)),
  };
}
