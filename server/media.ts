import fs from 'node:fs';
import { GoogleGenAI, MediaResolution, createPartFromBase64, createPartFromUri, type Part } from '@google/genai';
import { config } from './config.ts';
import { AiError, recordUsage } from './ai.ts';

/*
 * Claude는 소리와 영상을 직접 읽지 못한다. 녹음 파일과 유튜브 영상을 자동으로 받아 적는 일만
 * 선택적으로 Gemini에 맡긴다. GEMINI_API_KEY가 없으면 이 기능은 꺼지고,
 * 녹음은 브라우저 실시간 자막, 유튜브는 사용자가 붙여 넣은 자막을 쓴다.
 */

const gemini = config.gemini.apiKey ? new GoogleGenAI({ apiKey: config.gemini.apiKey }) : null;

export const mediaSupport = { audioFile: !!gemini, youtubeAuto: !!gemini };

function log(userId: string | null, kind: string, usage: any) {
  const input = usage?.promptTokenCount ?? 0;
  const output = (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0);
  const g = config.gemini;
  recordUsage(userId, kind, g.model, input, output, ((input * g.priceInput + output * g.priceOutput) / 1_000_000) * config.claude.usdKrw);
}

async function filePart(filePath: string, mimeType: string): Promise<Part> {
  if (fs.statSync(filePath).size <= 15 * 1024 * 1024) return createPartFromBase64(fs.readFileSync(filePath).toString('base64'), mimeType);
  let file = await gemini!.files.upload({ file: filePath, config: { mimeType } });
  const started = Date.now();
  while (file.state === 'PROCESSING' && Date.now() - started < 10 * 60_000) {
    await new Promise((r) => setTimeout(r, 3000));
    file = await gemini!.files.get({ name: file.name! });
  }
  if (file.state !== 'ACTIVE') throw new AiError('녹음 파일을 처리하지 못했어요.');
  return createPartFromUri(file.uri!, file.mimeType || mimeType);
}

async function transcribe(userId: string | null, kind: string, parts: Part[], lowRes: boolean) {
  if (!gemini) throw new AiError('자동 받아쓰기가 설정되지 않았어요.');
  const res = await gemini.models.generateContent({
    model: config.gemini.model,
    contents: [{ role: 'user', parts }],
    config: { maxOutputTokens: 60_000, thinkingConfig: { thinkingBudget: 0 }, ...(lowRes ? { mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW } : {}) },
  });
  log(userId, kind, res.usageMetadata);
  const text = res.text?.trim();
  if (!text) throw new AiError('내용을 받아 적지 못했어요.');
  return text;
}

export function transcribeAudio(userId: string | null, filePath: string, mime: string, prompt: string) {
  return filePart(filePath, mime).then((part) => transcribe(userId, 'transcribe_audio', [part, { text: prompt }], false));
}

export function transcribeYoutube(userId: string | null, url: string, prompt: string) {
  return transcribe(userId, 'transcribe_youtube', [{ fileData: { fileUri: url, mimeType: 'video/*' } }, { text: prompt }], true);
}

/**
 * 유튜브 '스크립트 표시'에서 복사한 자막을 [mm:ss] 줄로 정리한다.
 * "0:05\n문장" 형태와 "0:05 문장" 형태를 모두 받고, 1분 단위로 묶는다.
 */
export function normalizeTranscript(raw: string): string {
  const lines = raw.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  const stamp = /^(\d{1,2}:\d{2}(?::\d{2})?)(?:\s+(.*))?$/;
  const toSec = (s: string) => s.split(':').map(Number).reduce((a, n) => a * 60 + n, 0);
  const fmt = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  const chunks: Array<{ at: number; text: string[] }> = [];
  let cur: { at: number; text: string[] } | null = null;
  let sawStamp = false;
  for (const line of lines) {
    const m = stamp.exec(line);
    if (m) {
      sawStamp = true;
      const at = toSec(m[1]);
      if (!cur || at - cur.at >= 60) {
        cur = { at, text: [] };
        chunks.push(cur);
      }
      if (m[2]) cur.text.push(m[2]);
    } else {
      if (!cur) {
        cur = { at: 0, text: [] };
        chunks.push(cur);
      }
      cur.text.push(line);
    }
  }
  if (!sawStamp) return raw.trim();
  return chunks
    .filter((c) => c.text.length)
    .map((c) => `[${fmt(c.at)}] ${c.text.join(' ')}`)
    .join('\n');
}
