/* 학습 자료 생성 프롬프트, JSON 스키마, 개발용 가짜 출력 */

export type MaterialKind = 'summary' | 'mindmap' | 'memorize' | 'concepts';
export type SetKind = 'quiz' | 'flashcards';

const SOURCE_LIMIT = 120_000;

export function clipSource(text: string) {
  return text.length > SOURCE_LIMIT ? text.slice(0, SOURCE_LIMIT) + '\n…(이하 생략)' : text;
}

const COMMON = `
- 반드시 아래 [자료]에 있는 내용만 근거로 쓴다. 자료에 없는 사실을 지어내지 않는다.
- ref에는 근거 위치를 자료에 표시된 그대로 적는다. 페이지는 "p.3", 영상과 녹음은 "12:30" 처럼 쓴다. 위치 표시가 없는 자료면 빈 문자열.
- 한국어로 쓴다. 단 전문 용어는 원어를 괄호로 함께 쓴다.
- 대학생이 시험 직전에 보는 자료라고 생각하고 핵심만 정확하게 쓴다.
`.trim();

export const SYSTEM = `너는 대학 강의 자료로 시험 대비 학습 자료를 만드는 조교다.\n${COMMON}`;

const str = { type: 'string' };

/**
 * Claude 구조화 출력 규칙에 맞춘다: 모든 object에 additionalProperties: false,
 * 배열 길이 제약(minItems/maxItems)은 지원하지 않으므로 빼고 프롬프트로 지시한다.
 */
function strict<T>(schema: T): T {
  const walk = (node: any): any => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object') return node;
    const out: any = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === 'minItems' || k === 'maxItems') continue;
      out[k] = walk(v);
    }
    if (out.type === 'object') out.additionalProperties = false;
    return out;
  };
  return walk(schema);
}

const rawSchemas = {
  summary: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '자료 제목. 30자 이내' },
      overview: { type: 'string', description: '자료 전체를 2~3문장으로 요약' },
      sections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            heading: str,
            ref: str,
            body: { type: 'string', description: '마크다운. 핵심어는 **굵게**, 비교는 마크다운 표 사용 가능' },
            easy: { type: 'string', description: '비전공자도 이해하는 쉬운 설명, 비유 포함' },
          },
          required: ['heading', 'ref', 'body', 'easy'],
        },
      },
    },
    required: ['title', 'overview', 'sections'],
  },
  quiz: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: str,
            hint: str,
            options: { type: 'array', items: str, description: '보기 정확히 4개' },
            answer: { type: 'integer', description: '정답 보기 번호 0~3' },
            explanation: str,
            ref: str,
          },
          required: ['question', 'hint', 'options', 'answer', 'explanation', 'ref'],
        },
      },
    },
    required: ['questions'],
  },
  flashcards: {
    type: 'object',
    properties: {
      cards: {
        type: 'array',
        items: {
          type: 'object',
          properties: { front: str, back: str, ref: str },
          required: ['front', 'back', 'ref'],
        },
      },
    },
    required: ['cards'],
  },
  mindmap: {
    type: 'object',
    properties: {
      root: {
        type: 'object',
        properties: {
          label: str,
          children: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: str,
                children: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      label: str,
                      children: { type: 'array', items: { type: 'object', properties: { label: str }, required: ['label'] } },
                    },
                    required: ['label'],
                  },
                },
              },
              required: ['label', 'children'],
            },
          },
        },
        required: ['label', 'children'],
      },
    },
    required: ['root'],
  },
  memorize: {
    type: 'object',
    properties: {
      groups: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: str,
            items: {
              type: 'array',
              items: { type: 'object', properties: { text: { type: 'string', description: '"주제: 외울 내용" 형식, 핵심어는 **굵게**' }, ref: str }, required: ['text', 'ref'] },
            },
          },
          required: ['title', 'items'],
        },
      },
    },
    required: ['groups'],
  },
  concepts: {
    type: 'object',
    properties: {
      concepts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: str,
            refs: { type: 'array', items: str },
            short: { type: 'string', description: '한 문장 정의' },
            definition: { type: 'string', description: '2~3문단 설명. 문단은 빈 줄로 구분' },
            points: { type: 'array', items: str },
            example: str,
            confusion: { type: 'string', description: '자주 혼동되는 점' },
          },
          required: ['name', 'refs', 'short', 'definition', 'points', 'example', 'confusion'],
        },
      },
    },
    required: ['concepts'],
  },
  exam: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            source: { type: 'integer', description: '출제한 자료 번호 (1부터)' },
            type: { type: 'string', enum: ['choice', 'ox', 'blank', 'short'], description: '문제 유형' },
            question: str,
            options: { type: 'array', items: str, description: 'choice·blank는 보기 4개, ox는 ["O", "X"], short는 빈 배열' },
            answer: { type: 'integer', description: '정답 보기 번호(0부터). short는 -1' },
            answerText: { type: 'string', description: 'short의 정답. 여러 표현을 인정하면 / 로 구분. 다른 유형은 빈 문자열' },
            explanation: str,
            ref: str,
          },
          required: ['source', 'type', 'question', 'options', 'answer', 'answerText', 'explanation', 'ref'],
        },
      },
    },
    required: ['questions'],
  },
};

export const schemas = strict(rawSchemas);

/** 원문은 system에 캐시해서 따로 보내므로, 여기서는 할 일만 쓴다. */
export function materialPrompt(kind: MaterialKind, style = '') {
  const task = {
    summary: `자료 전체를 요약한다. 자료의 흐름대로 4~8개 섹션으로 나누고, 섹션마다 핵심 설명(body)과 쉬운 설명(easy)을 쓴다. 비교가 필요한 내용은 마크다운 표로 정리한다.`,
    mindmap: `자료의 개념 구조를 마인드맵으로 만든다. 중심 주제 1개, 1단계 가지 3~6개, 각 가지 아래 2~5개, 필요하면 3단계까지. 라벨은 15자 이내 명사구.`,
    memorize: `시험 직전에 외워야 할 항목을 15~25개 뽑아 주제별 그룹으로 묶는다. 정의, 공식, 수치, 연도, 학자 이름, 비교 포인트처럼 외워야 하는 것 위주로.`,
    concepts: `자료의 핵심 개념을 6~12개 뽑아 개념 사전을 만든다. 개념마다 정의, 핵심 포인트 2~4개, 예시, 자주 혼동되는 점을 쓴다.`,
  }[kind];
  return `위 [자료]로 다음을 만든다.\n${task}${style}`;
}

export function setPrompt(kind: SetKind, opts: { count: number; focus?: string; avoid?: string[]; difficulty?: string; style?: string }) {
  const focus = opts.focus ? `\n- 이번에는 "${opts.focus}" 개념에 집중해서 만든다.` : '';
  const avoid = opts.avoid?.length ? `\n- 아래 이미 낸 문제와 겹치지 않게 만든다:\n${opts.avoid.map((q) => `  · ${q}`).join('\n')}` : '';
  const diff = opts.difficulty ? `\n- 난이도: ${opts.difficulty}` : '';
  const task =
    kind === 'quiz'
      ? `객관식 4지선다 퀴즈 ${opts.count}문제를 만든다. 단순 암기보다 개념을 적용하는 문제를 섞는다. 오답 보기도 그럴듯하게 만든다. 정답 위치는 고르게 섞는다. hint는 정답을 직접 말하지 않는 한 문장, explanation은 왜 정답이고 다른 보기는 왜 틀렸는지.`
      : `플래시카드 ${opts.count}장을 만든다. 앞면은 질문 또는 용어, 뒷면은 2문장 이내의 답.`;
  return `위 [자료]로 다음을 만든다.\n${task}${focus}${diff}${avoid}${opts.style ?? ''}`;
}

export type ExamType = 'choice' | 'ox' | 'blank' | 'short';
export type ExamDifficulty = '쉬움' | '보통' | '어려움';
export const EXAM_TYPES: ExamType[] = ['choice', 'ox', 'blank', 'short'];

const TYPE_RULE: Record<ExamType, string> = {
  choice: 'choice(객관식): 보기 4개, answer는 정답 번호 0~3, 정답 위치를 고르게 섞는다.',
  ox: 'ox(OX): 맞는지 틀린지 판단할 진술 한 문장, options는 ["O", "X"], answer는 O면 0, X면 1. O와 X가 반반 정도 나오게.',
  blank: 'blank(빈칸 채우기): 자료의 핵심 문장에서 핵심어 자리를 ____ 로 비운다. options는 들어갈 말 후보 4개, answer는 0~3.',
  short: 'short(주관식 단답형): 한두 단어로 답하는 질문. options는 [], answer는 -1, answerText에 정답(같은 뜻의 다른 표기는 / 로 구분).',
};

const DIFFICULTY_RULE: Record<ExamDifficulty, string> = {
  쉬움: '난이도는 쉬움: 정의와 기본 사실을 확인하는 문제 위주로, 오답 보기는 분명히 구별되게.',
  보통: '난이도는 보통: 쉬운 문제 30%, 보통 50%, 어려운 문제 20%.',
  어려움: '난이도는 어려움: 개념을 적용·비교·추론하는 문제 위주로, 오답 보기도 헷갈릴 만큼 그럴듯하게.',
};

/** 시험지 설정(난이도·문제 유형)을 프롬프트 지시로 바꾼다 */
export function examRules(opts: { difficulty: ExamDifficulty; types: ExamType[] }) {
  return `- ${DIFFICULTY_RULE[opts.difficulty]}
- 아래 유형만 쓰고, 여러 유형이면 고르게 섞는다. type에 유형을 적는다. 다른 유형의 칸은 규칙대로 비운다(answerText는 short가 아니면 빈 문자열).
${opts.types.map((t) => `  · ${TYPE_RULE[t]}`).join('\n')}`;
}

export function examPrompt(sources: Array<{ title: string; text: string }>, count: number, avoid: string[], opts: { difficulty: ExamDifficulty; types: ExamType[] }) {
  const per = Math.max(20_000, Math.floor(110_000 / sources.length));
  const body = sources.map((s, i) => `[자료 ${i + 1}: ${s.title}]\n${s.text.slice(0, per)}`).join('\n\n');
  return `아래 자료들로 실제 대학 시험 같은 모의고사 ${count}문제를 만든다.
- 자료별 분량에 비례해 고르게 출제하고, source에 자료 번호를 적는다.
${examRules(opts)}
- 이미 풀어 본 아래 문제와 겹치지 않는, 처음 보는 문제로 낸다:
${avoid.slice(0, 60).map((q) => `  · ${q}`).join('\n') || '  (없음)'}

${body}`;
}

/** pdf, image는 Claude가, audio, youtube는 (설정된 경우) Gemini가 쓴다. */
export const EXTRACT_PROMPTS = {
  pdf: `이 문서의 내용을 페이지 순서대로 빠짐없이 옮겨 적어라.
- 각 페이지 시작에 [p.페이지번호] 를 한 줄로 쓴다.
- 제목과 소제목은 마크다운 제목으로, 표는 마크다운 표로, 수식은 텍스트로 쓴다.
- 그림, 도표, 그래프는 [그림: 무엇을 보여주는지 한두 문장] 으로 설명한다.
- 원문 언어를 그대로 유지하고 요약하지 않는다.`,
  image: `사진 속 필기, 칠판, 교재 내용을 그대로 옮겨 적어라.
- 사진마다 시작에 [p.사진번호] 를 한 줄로 쓴다.
- 손글씨도 최대한 정확히 읽고, 읽기 어려운 글자는 [?] 로 표시한다.
- 그림과 도식은 [그림: 설명] 으로 쓴다.`,
  audio: `이 강의 녹음을 받아 적어라.
- 1~2분마다 [mm:ss] 시간 표시를 줄 맨 앞에 쓴다.
- 말한 내용을 최대한 그대로 적되, 말 더듬음이나 의미 없는 추임새는 뺀다.
- 강조하거나 "시험에 나온다"고 한 부분은 끝에 (강조) 를 붙인다.`,
  youtube: `이 영상의 내용을 받아 적어라.
- 1~2분마다 [mm:ss] 시간 표시를 줄 맨 앞에 쓴다.
- 말한 내용을 중심으로 최대한 자세히 쓰고, 화면에 나온 판서나 슬라이드 내용도 [화면: ...] 으로 함께 적는다.`,
};

/* ---------- 개발용 가짜 출력 (GEMINI_API_KEY가 없을 때) ---------- */

function sentences(source: string): string[] {
  const out = source
    .replace(/\[(p\.\d+|\d{1,2}:\d{2})\]/g, ' ')
    .split(/(?<=[.!?。])\s+|\n+/)
    .map((s) => s.replace(/^[#>*\-\s|]+/, '').trim())
    .filter((s) => s.length >= 8 && !/^[-|:\s]+$/.test(s));
  return out.length ? out : ['자료에서 문장을 찾지 못했습니다'];
}

function refs(source: string): string[] {
  const r = [...source.matchAll(/\[(p\.\d+|\d{1,2}:\d{2})\]/g)].map((m) => m[1]);
  return r.length ? r : [''];
}

const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];
const short = (s: string, n = 24) => (s.length > n ? s.slice(0, n) + '…' : s);

export function mockMaterial(kind: MaterialKind, source: string, title: string): unknown {
  const ss = sentences(source);
  const rs = refs(source);
  if (kind === 'summary') {
    return {
      title,
      overview: `(개발용 가짜 요약) ${ss.slice(0, 2).join(' ')}`,
      sections: [0, 1, 2, 3].map((i) => ({
        heading: short(pick(ss, i * 3), 20),
        ref: pick(rs, i),
        body: `${pick(ss, i * 3)} **${short(pick(ss, i * 3 + 1), 12)}** ${pick(ss, i * 3 + 2)}\n\n| 구분 | 내용 |\n|---|---|\n| 핵심 | ${short(pick(ss, i), 30)} |\n| 예시 | ${short(pick(ss, i + 1), 30)} |`,
        easy: `쉽게 말하면, ${pick(ss, i * 3 + 1)} GEMINI_API_KEY를 넣으면 실제 요약이 나옵니다.`,
      })),
    };
  }
  if (kind === 'mindmap') {
    return {
      root: {
        label: short(title, 14),
        children: [0, 1, 2, 3].map((i) => ({
          label: short(pick(ss, i * 2), 12),
          children: [0, 1, 2].map((j) => ({ label: short(pick(ss, i * 3 + j + 1), 12), children: [{ label: short(pick(ss, i + j + 5), 10) }] })),
        })),
      },
    };
  }
  if (kind === 'memorize') {
    return {
      groups: [0, 1, 2, 3].map((g) => ({
        title: short(pick(ss, g * 4), 14),
        items: [0, 1, 2, 3].map((i) => ({ text: `${short(pick(ss, g * 4 + i), 10)}: **${short(pick(ss, g + i + 2), 30)}**`, ref: pick(rs, g + i) })),
      })),
    };
  }
  return {
    concepts: [0, 1, 2, 3, 4, 5].map((i) => ({
      name: short(pick(ss, i * 2), 14),
      refs: [pick(rs, i)],
      short: pick(ss, i * 2 + 1),
      definition: `${pick(ss, i * 2 + 1)} ${pick(ss, i * 2 + 2)}\n\n(개발용 가짜 개념 설명입니다.)`,
      points: [short(pick(ss, i + 3), 30), short(pick(ss, i + 4), 30), short(pick(ss, i + 5), 30)],
      example: pick(ss, i + 6),
      confusion: pick(ss, i + 7),
    })),
  };
}

export function mockSet(kind: SetKind, source: string, count: number): unknown {
  const ss = sentences(source);
  const rs = refs(source);
  if (kind === 'quiz') {
    return {
      questions: Array.from({ length: count }, (_, i) => ({
        question: `(가짜 문제 ${i + 1}) 다음 중 자료 내용과 일치하는 것은?`,
        hint: '자료의 앞부분을 다시 떠올려 보세요.',
        options: [0, 1, 2, 3].map((k) => short(pick(ss, i * 4 + k), 40)),
        answer: i % 4,
        explanation: `정답은 ${'ABCD'[i % 4]}입니다. ${pick(ss, i * 4 + (i % 4))}`,
        ref: pick(rs, i),
      })),
    };
  }
  return {
    cards: Array.from({ length: count }, (_, i) => ({
      front: `${short(pick(ss, i * 2), 30)} 은(는) 무엇인가요?`,
      back: pick(ss, i * 2 + 1),
      ref: pick(rs, i),
    })),
  };
}

export function mockExam(sources: Array<{ title: string; text: string }>, count: number, opts: { difficulty: ExamDifficulty; types: ExamType[] }): unknown {
  return {
    questions: Array.from({ length: count }, (_, i) => {
      const s = i % sources.length;
      const ss = sentences(sources[s].text);
      const type = opts.types[i % opts.types.length];
      const head = `(가짜 ${opts.difficulty} ${i + 1})`;
      const base = { source: s + 1, type, answerText: '', explanation: `개발용 가짜 해설입니다. (난이도 ${opts.difficulty})`, ref: '' };
      if (type === 'ox') return { ...base, question: `${head} ${short(pick(ss, i), 50)}`, options: ['O', 'X'], answer: i % 2 };
      if (type === 'short') return { ...base, question: `${head} ${sources[s].title}의 핵심 용어 하나를 쓰시오.`, options: [], answer: -1, answerText: '핵심/핵심 개념' };
      if (type === 'blank') {
        return { ...base, question: `${head} ${short(pick(ss, i), 30)} 의 빈칸 ____ 에 들어갈 말은?`, options: [0, 1, 2, 3].map((k) => short(pick(ss, i * 4 + k), 12)), answer: (i * 3) % 4 };
      }
      return { ...base, question: `${head} ${sources[s].title}에 대한 설명으로 옳은 것은?`, options: [0, 1, 2, 3].map((k) => short(pick(ss, i * 4 + k), 40)), answer: (i * 3) % 4 };
    }),
  };
}

export function mockExtract(kind: string, title: string): string {
  if (kind === 'audio' || kind === 'youtube') {
    return [
      `[00:00] (개발용 가짜 받아쓰기) ${title} 강의를 시작하겠습니다. 오늘은 핵심 개념 세 가지를 다룹니다.`,
      `[01:30] 첫 번째 개념은 정의와 범위입니다. 시험에 자주 나오니 꼭 기억하세요. (강조)`,
      `[04:10] 두 번째는 사례 비교입니다. 두 사례의 차이를 표로 정리해 두면 좋습니다.`,
      `[07:45] 마지막으로 오늘 내용을 정리하고 다음 주 과제를 안내합니다.`,
    ].join('\n');
  }
  return `[p.1]\n# ${title}\n(개발용 가짜 추출) GEMINI_API_KEY를 넣으면 실제 내용이 추출됩니다. 이 자료는 핵심 개념의 정의를 다룹니다.\n\n[p.2]\n## 두 번째 페이지\n개념 A는 공통 기준을 유지하는 전략입니다. 개념 B는 지역에 맞춰 바꾸는 전략입니다.\n\n[p.3]\n## 사례\n사례 1은 빠른 조정을 강조합니다. 사례 2는 일관된 메시지를 강조합니다.`;
}
