import fs from 'node:fs';
import { GoogleGenAI, MediaResolution, createPartFromBase64, createPartFromUri, type Part } from '@google/genai';
import { config } from './config.ts';
import { run, nowIso } from './db.ts';

const ai = config.gemini.apiKey ? new GoogleGenAI({ apiKey: config.gemini.apiKey }) : null;
export const aiMode: 'gemini' | 'mock' = ai ? 'gemini' : 'mock';

export class AiError extends Error {}

function baseConfig(system: string | undefined, maxOutputTokens: number, temperature: number) {
  const cfg: Record<string, unknown> = { maxOutputTokens, temperature };
  if (system) cfg.systemInstruction = system;
  if (config.gemini.thinkingBudget !== '') cfg.thinkingConfig = { thinkingBudget: Number(config.gemini.thinkingBudget) };
  return cfg;
}

export function logUsage(userId: string | null, kind: string, usage: any) {
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

const INLINE_LIMIT = 15 * 1024 * 1024;

/** 파일을 Gemini에 넘길 Part로 만든다. 큰 파일은 Files API로 올린다. */
export async function filePart(filePath: string, mimeType: string): Promise<Part> {
  if (!ai) throw new AiError('AI 키가 없습니다.');
  const size = fs.statSync(filePath).size;
  if (size <= INLINE_LIMIT) {
    return createPartFromBase64(fs.readFileSync(filePath).toString('base64'), mimeType);
  }
  let file = await ai.files.upload({ file: filePath, config: { mimeType } });
  const started = Date.now();
  while (file.state === 'PROCESSING' && Date.now() - started < 10 * 60_000) {
    await new Promise((r) => setTimeout(r, 3000));
    file = await ai.files.get({ name: file.name! });
  }
  if (file.state !== 'ACTIVE') throw new AiError('파일을 처리하지 못했습니다.');
  return createPartFromUri(file.uri!, file.mimeType || mimeType);
}

export function youtubePart(url: string): Part {
  return { fileData: { fileUri: url, mimeType: 'video/*' } };
}

/** 자유 형식 텍스트 생성 */
export async function generateText(p: {
  userId: string | null;
  kind: string;
  parts: Part[];
  system?: string;
  maxTokens?: number;
  temperature?: number;
  lowMediaResolution?: boolean;
  mock: () => string;
}): Promise<string> {
  if (!ai) {
    logUsage(p.userId, p.kind, { promptTokenCount: 4000, candidatesTokenCount: 1500 });
    await new Promise((r) => setTimeout(r, 400));
    return p.mock();
  }
  const cfg = baseConfig(p.system, p.maxTokens ?? 8192, p.temperature ?? 0.4);
  if (p.lowMediaResolution) cfg.mediaResolution = MediaResolution.MEDIA_RESOLUTION_LOW;
  const res = await ai.models.generateContent({
    model: config.gemini.model,
    contents: [{ role: 'user', parts: p.parts }],
    config: cfg,
  });
  logUsage(p.userId, p.kind, res.usageMetadata);
  const text = res.text?.trim();
  if (!text) throw new AiError('AI 응답이 비어 있습니다.');
  return text;
}

/** JSON 스키마에 맞춘 구조화 출력 */
export async function generateJson<T>(p: {
  userId: string | null;
  kind: string;
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  temperature?: number;
  mock: () => T;
}): Promise<T> {
  if (!ai) {
    logUsage(p.userId, p.kind, { promptTokenCount: 6000, candidatesTokenCount: 2000 });
    await new Promise((r) => setTimeout(r, 600));
    return p.mock();
  }
  const cfg = baseConfig(p.system, p.maxTokens ?? 8192, p.temperature ?? 0.5);
  cfg.responseMimeType = 'application/json';
  cfg.responseJsonSchema = p.schema;
  const res = await ai.models.generateContent({
    model: config.gemini.model,
    contents: [{ role: 'user', parts: [{ text: p.prompt }] }],
    config: cfg,
  });
  logUsage(p.userId, p.kind, res.usageMetadata);
  const text = res.text?.trim();
  if (!text) throw new AiError('AI 응답이 비어 있습니다.');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AiError('AI 응답 형식이 올바르지 않습니다.');
  }
}

/** 튜터 대화. search가 true면 구글 검색으로 최신 정보를 붙인다. */
export async function chatReply(p: {
  userId: string;
  system: string;
  history: Array<{ role: 'user' | 'model'; content: string }>;
  message: string;
  search?: boolean;
  mock: () => string;
}): Promise<string> {
  if (!ai) {
    logUsage(p.userId, 'tutor', { promptTokenCount: 3000, candidatesTokenCount: 500 });
    await new Promise((r) => setTimeout(r, 500));
    return p.mock();
  }
  const cfg = baseConfig(p.system, 2048, 0.7);
  if (p.search) cfg.tools = [{ googleSearch: {} }];
  const res = await ai.models.generateContent({
    model: config.gemini.model,
    contents: [
      ...p.history.map((h) => ({ role: h.role, parts: [{ text: h.content }] })),
      { role: 'user', parts: [{ text: p.message }] },
    ],
    config: cfg,
  });
  logUsage(p.userId, 'tutor', res.usageMetadata);
  const text = res.text?.trim();
  if (!text) throw new AiError('AI 응답이 비어 있습니다.');
  return text;
}
