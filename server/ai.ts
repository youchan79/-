import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.ts';
import { run, nowIso } from './db.ts';

/*
 * Claude 호출은 모두 여기를 거친다.
 * - PDF·사진 읽기: 문서/이미지 블록, 생각 끔, 낮은 effort
 * - 학습 자료: JSON 스키마 출력 + 원문을 system 블록에 캐시해 같은 문서의 여러 생성이 캐시를 함께 쓴다
 * - 튜터: 대화 + 선택적 웹 검색
 * 키가 없으면 개발용 가짜 출력으로 흐름만 돈다.
 */

const client = config.claude.apiKey ? new Anthropic({ apiKey: config.claude.apiKey, maxRetries: 3 }) : null;
export const aiMode: 'claude' | 'mock' = client ? 'claude' : 'mock';
const MODEL = config.claude.model;

export class AiError extends Error {}

/* ---------- 원가 기록 ---------- */

export function recordUsage(userId: string | null, kind: string, model: string, promptTokens: number, outputTokens: number, costKrw: number) {
  run(
    'INSERT INTO ai_usage (user_id, kind, model, input_tokens, output_tokens, cost_krw, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    userId,
    kind,
    model,
    promptTokens,
    outputTokens,
    costKrw,
    nowIso(),
  );
}

function logClaude(userId: string | null, kind: string, usage: Anthropic.Usage) {
  const c = config.claude;
  const input = usage.input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const prompt = input + cacheWrite + cacheRead;
  const long = prompt > c.longPromptTokens;
  const pin = long ? c.priceInputLong : c.priceInput;
  const pout = long ? c.priceOutputLong : c.priceOutput;
  // 캐시 쓰기는 입력 단가의 1.25배, 캐시 읽기는 0.1배
  const usd = (input * pin + cacheWrite * pin * 1.25 + cacheRead * pin * 0.1 + output * pout) / 1_000_000;
  recordUsage(userId, kind, MODEL, prompt, output, usd * c.usdKrw);
  if (process.env.AI_DEBUG) console.log(`[claude] ${kind} in=${input} cacheW=${cacheWrite} cacheR=${cacheRead} out=${output} ₩${(usd * c.usdKrw).toFixed(2)}`);
}

function mockUsage(userId: string | null, kind: string) {
  recordUsage(userId, kind, 'mock', 4000, 1500, 0);
}

/* ---------- 공통 ---------- */

function textOf(msg: Anthropic.Message) {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

function ensureAnswered(msg: Anthropic.Message) {
  if (msg.stop_reason === 'refusal') throw new AiError('AI가 이 자료는 처리하지 않았어요. 다른 자료로 시도해 주세요.');
}

function apiError(e: unknown): never {
  if (e instanceof AiError) throw e;
  if (e instanceof Anthropic.RateLimitError) throw new AiError('요청이 몰려 잠시 쉬고 있어요. 1분 뒤에 다시 시도해 주세요.');
  if (e instanceof Anthropic.BadRequestError) {
    console.error('[claude] 잘못된 요청', e.message);
    throw new AiError('AI가 이 자료를 읽지 못했어요. 파일이 너무 크거나 손상됐을 수 있어요.');
  }
  if (e instanceof Anthropic.AuthenticationError) {
    console.error('[claude] 인증 실패 - ANTHROPIC_API_KEY 확인');
    throw new AiError('AI 연결 설정에 문제가 있어요. 잠시 후 다시 시도해 주세요.');
  }
  if (e instanceof Anthropic.APIError) {
    console.error('[claude] API 오류', e.status, e.message);
    throw new AiError('AI 응답이 늦어지고 있어요. 잠시 후 다시 시도해 주세요.');
  }
  throw e;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------- PDF·사진 읽기 ---------- */

const MAX_REQUEST_BYTES = 30 * 1024 * 1024; // 요청 한도 32MB에서 여유를 둔다
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

export function isReadableImage(mime: string): mime is ImageType {
  return (IMAGE_TYPES as readonly string[]).includes(mime);
}

export async function readDocuments(p: {
  userId: string | null;
  kind: string;
  files: Array<{ path: string; mime: string }>;
  prompt: string;
  mock: () => string;
}): Promise<string> {
  if (!client) {
    mockUsage(p.userId, p.kind);
    await sleep(400);
    return p.mock();
  }
  const total = p.files.reduce((a, f) => a + fs.statSync(f.path).size, 0);
  if (total * 1.34 > MAX_REQUEST_BYTES) throw new AiError('파일이 너무 커요. PDF는 20MB, 사진은 모두 합쳐 20MB까지 읽을 수 있어요.');

  const content: Anthropic.ContentBlockParam[] = p.files.map((f) => {
    const data = fs.readFileSync(f.path).toString('base64');
    if (f.mime === 'application/pdf') {
      return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } };
    }
    if (!isReadableImage(f.mime)) throw new AiError('JPG, PNG, WEBP 사진만 읽을 수 있어요.');
    return { type: 'image', source: { type: 'base64', media_type: f.mime, data } };
  });
  content.push({ type: 'text', text: p.prompt });

  try {
    const msg = await client.messages
      .stream({
        model: MODEL,
        max_tokens: 64000,
        thinking: { type: 'disabled' },
        output_config: { effort: 'low' },
        messages: [{ role: 'user', content }],
      })
      .finalMessage();
    ensureAnswered(msg);
    logClaude(p.userId, p.kind, msg.usage);
    const text = textOf(msg);
    if (!text) throw new AiError('자료에서 내용을 읽지 못했어요.');
    return msg.stop_reason === 'max_tokens' ? `${text}\n\n…(분량이 많아 이후 내용은 생략됐어요)` : text;
  } catch (e) {
    apiError(e);
  }
}

/* ---------- JSON 스키마 출력 (학습 자료, 퀴즈, 시험지) ---------- */

/**
 * system = [고정 규칙, 원문] 순서로 보낸다. 출력 스키마가 프롬프트 앞부분에 들어가므로
 * 캐시는 같은 스키마로 여러 번 만드는 경우(퀴즈·카드 세트 추가 생성)에만 이득이다.
 * 그래서 cache가 true일 때만 원문 블록에 캐시 표시를 단다 (첫 생성은 쓰기 1.25배, 이후 읽기 0.1배).
 * 사용자 설정(언어, 길이)은 원문 뒤의 user 메시지에 넣어 앞부분을 고정한다.
 */
export async function generateJson<T>(p: {
  userId: string | null;
  kind: string;
  system: string;
  source: string | null;
  task: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  cache?: boolean;
  mock: () => T;
}): Promise<T> {
  if (!client) {
    mockUsage(p.userId, p.kind);
    await sleep(600);
    return p.mock();
  }
  const system: Anthropic.TextBlockParam[] = [{ type: 'text', text: p.system }];
  if (p.source) system.push({ type: 'text', text: `[자료]\n${p.source}`, ...(p.cache ? { cache_control: { type: 'ephemeral' as const } } : {}) });
  try {
    const msg = await client.messages
      .stream({
        model: MODEL,
        max_tokens: p.maxTokens ?? 16000,
        system,
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: p.schema } },
        messages: [{ role: 'user', content: p.task }],
      })
      .finalMessage();
    ensureAnswered(msg);
    logClaude(p.userId, p.kind, msg.usage);
    if (msg.stop_reason === 'max_tokens') throw new AiError('내용이 길어 끝까지 만들지 못했어요. 다시 시도해 주세요.');
    try {
      return JSON.parse(textOf(msg)) as T;
    } catch {
      throw new AiError('AI 응답 형식이 올바르지 않아요. 다시 시도해 주세요.');
    }
  } catch (e) {
    apiError(e);
  }
}

/* ---------- 튜터 대화 ---------- */

export async function chatReply(p: {
  userId: string;
  system: string;
  source: { title: string; text: string } | null;
  history: Array<{ role: 'user' | 'model'; content: string }>;
  message: string;
  search: boolean;
  mock: () => string;
}): Promise<string> {
  if (!client) {
    mockUsage(p.userId, 'tutor');
    await sleep(500);
    return p.mock();
  }
  const system: Anthropic.TextBlockParam[] = [{ type: 'text', text: p.system }];
  if (p.source) system.push({ type: 'text', text: `[자료: ${p.source.title}]\n${p.source.text}`, cache_control: { type: 'ephemeral' } });
  const messages: Anthropic.MessageParam[] = [
    ...p.history.map((h): Anthropic.MessageParam => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.content })),
    { role: 'user', content: p.message },
  ];

  const call = async (withSearch: boolean) => {
    const base = {
      model: MODEL,
      max_tokens: 4000,
      system,
      output_config: { effort: 'low' as const },
      // 대화가 길어져도 지난 턴까지는 캐시로 읽는다
      cache_control: { type: 'ephemeral' as const },
      ...(withSearch ? { tools: [{ type: 'web_search_20250305' as const, name: 'web_search' as const, max_uses: 3 }] } : {}),
    };
    let msg = await client.messages.create({ ...base, messages });
    let usageKind = withSearch ? 'tutor_search' : 'tutor';
    logClaude(p.userId, usageKind, msg.usage);
    // 서버 도구가 반복 한도에 걸리면 이어서 받는다
    for (let i = 0; i < 2 && msg.stop_reason === 'pause_turn'; i++) {
      msg = await client.messages.create({ ...base, messages: [...messages, { role: 'assistant', content: msg.content }] });
      logClaude(p.userId, usageKind, msg.usage);
    }
    return msg;
  };

  try {
    let msg: Anthropic.Message;
    try {
      msg = await call(p.search);
    } catch (e) {
      // 검색 도구를 못 쓰는 경우에는 검색 없이 답한다
      if (p.search && e instanceof Anthropic.BadRequestError) msg = await call(false);
      else throw e;
    }
    ensureAnswered(msg);
    const text = textOf(msg);
    if (!text) throw new AiError('답변을 만들지 못했어요. 다시 물어봐 주세요.');
    return text;
  } catch (e) {
    apiError(e);
  }
}
