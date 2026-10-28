import express, { type Request, type Response } from 'express';
import type { GenerateContentResponse } from '@google/genai';
import type {
  AnalyzeRequest,
  ChatMessage,
  ChatRequest,
  ConfirmRequest,
  DraftContext,
  Experience,
  ExtractRequest,
  FeedbackRequest,
  GenerateRequest,
} from '../src/types.ts';
import { authenticate, consumeCredit, getAccount, refundCredit } from './account.ts';
import { analyzeCompany, extractExperiences, reviewDraft, streamChat, streamDraft, toHttpError } from './ai.ts';
import { HttpError, publicConfig } from './config.ts';
import { confirmPayment, createOrder } from './payments.ts';

// ── 입력 검사 ─────────────────────────────────────────────

function str(v: unknown, max: number, name: string): string {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string') throw new HttpError(400, `${name} 형식이 올바르지 않아요.`);
  if (v.length > max) throw new HttpError(400, `${name}이(가) 너무 길어요. (${max.toLocaleString()}자 이하)`);
  return v;
}

function limit(v: unknown) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 100 && n <= 5000 ? n : 1000;
}

function context(v: any): DraftContext {
  const question = str(v?.question, 1000, '문항');
  if (!question.trim()) throw new HttpError(400, '문항을 입력해 주세요.');
  return {
    company: str(v?.company, 100, '회사 이름'),
    role: str(v?.role, 100, '직무'),
    question,
    charLimit: limit(v?.charLimit),
    report: str(v?.report, 20000, '분석 내용'),
  };
}

function experiences(v: unknown): Experience[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 10).map((x: any) => ({
    id: str(x?.id, 100, '경험 id'),
    title: str(x?.title, 200, '경험 제목'),
    period: str(x?.period, 100, '기간'),
    situation: str(x?.situation, 2000, '상황'),
    task: str(x?.task, 2000, '과제'),
    action: str(x?.action, 3000, '행동'),
    result: str(x?.result, 2000, '결과'),
    skills: Array.isArray(x?.skills) ? x.skills.slice(0, 10).map((s: unknown) => str(s, 50, '역량')) : [],
  }));
}

function messages(v: unknown): ChatMessage[] {
  if (!Array.isArray(v)) return [];
  return v.slice(-30).map((m: any) => ({
    role: m?.role === 'model' ? 'model' : 'user',
    text: str(m?.text, 12000, '메시지'),
  }));
}

const ALLOWED_FILES = ['application/pdf', 'text/plain', 'text/markdown', 'image/png', 'image/jpeg', 'image/webp'];

function extractBody(b: any): ExtractRequest {
  const text = str(b?.text, 30000, '경험 내용');
  if (!b?.file) return { text };
  const mimeType = str(b.file.mimeType, 100, '파일 형식');
  if (!ALLOWED_FILES.includes(mimeType)) throw new HttpError(400, 'PDF, 텍스트, 이미지 파일만 올릴 수 있어요.');
  return { text, file: { name: str(b.file.name, 300, '파일 이름'), mimeType, data: str(b.file.data, 14_000_000, '파일') } };
}

// ── 응답 도우미 ───────────────────────────────────────────

function sendError(res: Response, e: unknown) {
  const err = toHttpError(e);
  res.status(err.status).json({ error: err.message });
}

/** 일반 JSON 응답 */
function json(fn: (req: Request) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try {
      res.json(await fn(req));
    } catch (e) {
      sendError(res, e);
    }
  };
}

/** AI 사용 1회를 차감하고 실행. 실패하면 되돌림 */
function ai(fn: (req: Request) => Promise<unknown>) {
  return json(async (req) => {
    const userId = await authenticate(req);
    const charged = await consumeCredit(userId);
    try {
      return await fn(req);
    } catch (e) {
      if (charged) await refundCredit(userId);
      throw e;
    }
  });
}

/** 글자가 만들어지는 대로 바로 내려보내는 응답 */
function aiStream(fn: (req: Request, signal: AbortSignal) => Promise<AsyncGenerator<GenerateContentResponse>>) {
  return async (req: Request, res: Response) => {
    const abort = new AbortController();
    res.on('close', () => abort.abort());
    let userId: string | null = null;
    let charged = false;
    let wrote = false;
    try {
      userId = await authenticate(req);
      charged = await consumeCredit(userId);
      const stream = await fn(req, abort.signal);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) {
          res.write(text);
          wrote = true;
        }
      }
      res.end();
    } catch (e) {
      if (charged && !wrote) await refundCredit(userId);
      if (res.headersSent) res.end();
      else if (!abort.signal.aborted) sendError(res, e);
    }
  };
}

// ── 라우트 ────────────────────────────────────────────────

export const api = express.Router();

api.get('/config', (_req, res) => {
  res.json(publicConfig());
});

api.get('/me', json(async (req) => getAccount(await authenticate(req))));

api.post('/experiences/extract', ai(async (req) => ({ experiences: await extractExperiences(extractBody(req.body)) })));

api.post(
  '/company/analyze',
  ai(async (req) => {
    const b = req.body ?? {};
    const company = str(b.company, 100, '회사 이름');
    const question = str(b.question, 1000, '문항');
    if (!company.trim() || !question.trim()) throw new HttpError(400, '회사 이름과 문항을 입력해 주세요.');
    const body: AnalyzeRequest = {
      company,
      question,
      role: str(b.role, 100, '직무'),
      charLimit: limit(b.charLimit),
      posting: str(b.posting, 20000, '채용공고'),
    };
    return analyzeCompany(body);
  }),
);

api.post(
  '/draft/generate',
  aiStream((req, signal) => {
    const body: GenerateRequest = {
      context: context(req.body?.context),
      experiences: experiences(req.body?.experiences),
      request: str(req.body?.request, 2000, '추가 요청'),
    };
    return streamDraft(body, signal);
  }),
);

api.post(
  '/draft/chat',
  aiStream((req, signal) => {
    const body: ChatRequest = {
      context: context(req.body?.context),
      draft: str(req.body?.draft, 12000, '원고'),
      messages: messages(req.body?.messages),
    };
    return streamChat(body, signal);
  }),
);

api.post(
  '/draft/feedback',
  ai(async (req) => {
    const body: FeedbackRequest = { context: context(req.body?.context), draft: str(req.body?.draft, 12000, '원고') };
    return reviewDraft(body);
  }),
);

api.post(
  '/payments/order',
  json(async (req) => {
    const userId = await authenticate(req);
    if (!userId) throw new HttpError(503, '결제를 쓰려면 로그인 설정이 필요해요.');
    return createOrder(userId);
  }),
);

api.post(
  '/payments/confirm',
  json(async (req) => {
    const userId = await authenticate(req);
    if (!userId) throw new HttpError(503, '결제를 쓰려면 로그인 설정이 필요해요.');
    const body: ConfirmRequest = {
      paymentKey: str(req.body?.paymentKey, 200, '결제 키'),
      orderId: str(req.body?.orderId, 64, '주문 번호'),
      amount: Number(req.body?.amount),
    };
    await confirmPayment(userId, body);
    return getAccount(userId);
  }),
);

api.use((_req, res) => {
  res.status(404).json({ error: '없는 API예요.' });
});
