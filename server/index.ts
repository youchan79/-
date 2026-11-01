import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { config, assertProdConfig } from './config.ts';
import { all, one, run, nowIso, addDays, kstDayStartIso, logFunnel, newId } from './db.ts';
import { attachIdentity, requireUser, createUser, normalizeEmail, setSession, clearSession, verifyPassword } from './auth.ts';
import { aiMode, chatReply, AiError } from './ai.ts';
import {
  DocError,
  createFileDoc,
  createMemoDoc,
  createSet,
  createYoutubeDoc,
  deleteDoc,
  detectKind,
  docFiles,
  ensureMaterial,
  getMaterial,
  listSets,
  recoverInterrupted,
} from './docs.ts';
import { LimitError, assertCanExam, assertCanTutor, assertCanUpload, isPro, maxUploadBytes, usage } from './plan.ts';
import { createExam, getExam, listExams, startExam, submitExam } from './exam.ts';
import {
  PaymentError,
  cancelSubscription,
  handleFeedback,
  mockPay,
  normalizePhone,
  orderStatus,
  planInfo,
  startCheckout,
  subscriptionView,
  type Plan,
} from './billing.ts';
import { sendServerEvent } from './meta.ts';
import { seedSamples } from './samples.ts';
import type { MaterialKind, SetKind } from './prompts.ts';

assertProdConfig();
seedSamples();
recoverInterrupted();

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '2mb' }));
app.use(attachIdentity);

type Handler = (req: Request, res: Response) => Promise<unknown> | unknown;
const h = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res)).catch(next);
};
const origin = (req: Request) => config.appUrl || `${req.protocol}://${req.get('host')}`;

const tmpDir = path.join(config.dataDir, 'tmp');
fs.mkdirSync(tmpDir, { recursive: true });
const upload = multer({ dest: tmpDir, limits: { fileSize: config.pro.maxFileMb * 1024 * 1024, files: 10, fieldSize: 2 * 1024 * 1024 } });

/* ---------- 설정과 계정 ---------- */

app.get('/api/config', (_req, res) => {
  res.json({
    serviceName: config.serviceName,
    pixelId: config.meta.pixelId || null,
    plans: config.plans,
    free: config.free,
    paymentProvider: config.paymentProvider,
    aiMode,
    business: config.business,
  });
});

function meView(req: Request) {
  if (!req.user) return { user: null, sub: null, usage: null, settings: {} };
  const row = one('SELECT settings_json FROM users WHERE id = ?', req.user.id);
  return {
    user: { email: req.user.email, phone: req.user.phone, createdAt: req.user.created_at },
    sub: subscriptionView(req.user.id),
    usage: usage(req.user.id, req.user.created_at),
    settings: JSON.parse(row?.settings_json || '{}'),
  };
}

app.get('/api/me', (req, res) => res.json(meView(req)));

/** 랜딩에 보여 줄 실제 수치: 가입자 수(탈퇴 제외)와 AI 생성 건수. 1분 캐시. */
let statsCache: { at: number; body: { users: number; generated: number; asOf: string } } | null = null;
app.get('/api/stats/public', (_req, res) => {
  if (!statsCache || Date.now() - statsCache.at > 60_000) {
    const users = one<{ c: number }>("SELECT COUNT(*) AS c FROM users WHERE email NOT LIKE 'deleted\\_%' ESCAPE '\\'")!.c;
    const generated = one<{ c: number }>("SELECT COUNT(*) AS c FROM ai_usage WHERE kind NOT LIKE 'extract\\_%' ESCAPE '\\'")!.c;
    statsCache = { at: Date.now(), body: { users, generated, asOf: nowIso() } };
  }
  res.json(statsCache.body);
});

app.post(
  '/api/auth/signup',
  h(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email) return res.status(400).json({ error: '이메일을 확인해 주세요.' });
    if (password.length < 8) return res.status(400).json({ error: '비밀번호는 8자 이상이어야 해요.' });
    if (req.body?.agree !== true) return res.status(400).json({ error: '약관과 개인정보 수집에 동의해 주세요.' });
    if (one('SELECT 1 FROM users WHERE email = ?', email)) return res.status(409).json({ error: '이미 가입된 이메일이에요. 로그인해 주세요.' });
    const user = createUser(email, password);
    req.user = user;
    setSession(res, user.id);
    logFunnel('signup', req.anonId, user.id);
    const eventId = `reg_${user.id}`;
    void sendServerEvent(req, { eventName: 'CompleteRegistration', eventId, email });
    res.json({ ...meView(req), eventId });
  }),
);

app.post(
  '/api/auth/login',
  h(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const row = email ? one('SELECT * FROM users WHERE email = ?', email) : undefined;
    if (!row || !verifyPassword(password, row.password_hash)) return res.status(401).json({ error: '이메일 또는 비밀번호가 맞지 않아요.' });
    setSession(res, row.id);
    req.user = { id: row.id, email: row.email, phone: row.phone, created_at: row.created_at };
    res.json(meView(req));
  }),
);

app.post('/api/auth/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

app.put('/api/settings', requireUser, (req, res) => {
  const row = one('SELECT settings_json FROM users WHERE id = ?', req.user!.id);
  const cur = JSON.parse(row?.settings_json || '{}');
  const next = { ...cur };
  for (const k of ['theme', 'answerLanguage', 'summaryLength', 'quizDifficulty']) {
    if (typeof req.body?.[k] === 'string') next[k] = req.body[k].slice(0, 20);
  }
  run('UPDATE users SET settings_json = ? WHERE id = ?', JSON.stringify(next), req.user!.id);
  res.json({ settings: next });
});

app.post(
  '/api/account/delete',
  requireUser,
  h(async (req, res) => {
    const userId = req.user!.id;
    const sub = subscriptionView(userId);
    if (sub.pro && sub.plan === 'monthly' && !sub.canceled) {
      return res.status(400).json({ error: '정기결제를 먼저 해지한 뒤 탈퇴할 수 있어요.' });
    }
    for (const d of all('SELECT id FROM documents WHERE user_id = ?', userId)) deleteDoc(d.id);
    run('DELETE FROM chats WHERE user_id = ?', userId);
    run('DELETE FROM exams WHERE user_id = ?', userId);
    run('DELETE FROM progress WHERE user_id = ?', userId);
    // 결제 기록은 전자상거래법상 5년 보관한다. 계정 식별 정보만 지운다.
    run("UPDATE users SET email = ?, password_hash = '', phone = NULL, settings_json = '{}' WHERE id = ?", `deleted_${userId}@deleted`, userId);
    clearSession(res);
    res.json({ ok: true });
  }),
);

app.post('/api/feedback', (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 3000) : '';
  if (!text) return res.status(400).json({ error: '내용을 적어 주세요.' });
  run('INSERT INTO feedback (user_id, text, created_at) VALUES (?, ?, ?)', req.user?.id ?? null, text, nowIso());
  res.json({ ok: true });
});

const TRACKABLE = new Set(['visit']);
app.post('/api/track', (req, res) => {
  const name = req.body?.name;
  if (typeof name === 'string' && TRACKABLE.has(name)) logFunnel(name, req.anonId, req.user?.id ?? null);
  res.json({ ok: true });
});

/* ---------- 문서 ---------- */

function loadDoc(req: Request, res: Response, opts: { owner?: boolean } = {}) {
  const d = one('SELECT * FROM documents WHERE id = ?', req.params.id);
  const isSample = d && !d.user_id;
  if (!d || (!isSample && d.user_id !== req.user?.id)) {
    res.status(404).json({ error: '문서를 찾을 수 없어요.' });
    return null;
  }
  if (opts.owner && isSample) {
    res.status(403).json({ error: '샘플 문서는 바꿀 수 없어요. 내 자료를 올려 보세요.' });
    return null;
  }
  return d;
}

const docSummary = (d: any) => ({
  id: d.id,
  kind: d.kind,
  title: d.title,
  thumb: d.thumb,
  status: d.status,
  error: d.error,
  durationSec: d.duration_sec,
  pageCount: d.page_count,
  createdAt: d.created_at,
  isSample: !d.user_id,
});

app.get('/api/docs', (req, res) => {
  const mine = req.user
    ? all('SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC', req.user.id)
    : [];
  const samples = all('SELECT * FROM documents WHERE user_id IS NULL ORDER BY created_at ASC');
  res.json({ docs: [...mine, ...samples].map(docSummary) });
});

function cleanupUploads(files: Express.Multer.File[] | undefined) {
  for (const f of files ?? []) fs.rm(f.path, { force: true }, () => {});
}

app.post(
  '/api/docs/upload',
  requireUser,
  upload.array('files', 10),
  h(async (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    try {
      if (!files.length) return res.status(400).json({ error: '파일을 골라 주세요.' });
      const kinds = files.map((f) => detectKind(f.originalname, f.mimetype));
      const kind = kinds[0];
      if (!kind || kinds.some((k) => k !== kind)) {
        return res.status(400).json({ error: '지원하지 않는 파일이에요. PDF, PPT(pptx), Word(docx), 이미지, 녹음 파일을 올려 주세요.' });
      }
      if (kind !== 'image' && files.length > 1) return res.status(400).json({ error: '파일은 하나씩 올려 주세요. 사진만 여러 장 올릴 수 있어요.' });
      const limit = maxUploadBytes(req.user!.id);
      if (files.some((f) => f.size > limit)) {
        return res.status(413).json({ error: `파일이 너무 커요. ${isPro(req.user!.id) ? '' : '무료 플랜은 '}${Math.round(limit / 1024 / 1024)}MB까지 올릴 수 있어요.`, reason: 'size' });
      }
      if (kind !== 'audio') assertCanUpload(req.user!.id, req.user!.created_at, kind);
      const b = req.body ?? {};
      const thumb = typeof b.thumb === 'string' && b.thumb.startsWith('data:image/') && b.thumb.length < 400_000 ? b.thumb : null;
      const id = createFileDoc({
        userId: req.user!.id,
        kind,
        files,
        title: typeof b.title === 'string' ? b.title : undefined,
        thumb,
        durationSec: Number(b.duration) || null,
        liveTranscript: typeof b.transcript === 'string' && b.transcript.trim() ? b.transcript.slice(0, 200_000) : null,
      });
      logFunnel('upload', req.anonId, req.user!.id);
      res.json({ id });
    } catch (e) {
      cleanupUploads(files);
      throw e;
    }
  }),
);

app.post(
  '/api/docs/youtube',
  requireUser,
  h(async (req, res) => {
    assertCanUpload(req.user!.id, req.user!.created_at, 'youtube');
    const id = await createYoutubeDoc(req.user!.id, String(req.body?.url ?? ''));
    logFunnel('upload', req.anonId, req.user!.id);
    res.json({ id });
  }),
);

app.post('/api/docs/memo', requireUser, (req, res) => {
  const id = createMemoDoc(req.user!.id, String(req.body?.title ?? ''), String(req.body?.text ?? ''));
  logFunnel('upload', req.anonId, req.user!.id);
  res.json({ id });
});

const MATERIAL_KINDS = ['summary', 'mindmap', 'memorize', 'concepts'] as const;

app.get('/api/docs/:id', (req, res) => {
  const d = loadDoc(req, res);
  if (!d) return;
  const materials = Object.fromEntries(
    MATERIAL_KINDS.map((k) => {
      const m = getMaterial(d.id, k);
      return [k, m ? m.status : 'none'];
    }),
  );
  res.json({
    ...docSummary(d),
    sourceUrl: d.source_url,
    fileName: d.file_name,
    mime: d.mime,
    fileCount: docFiles(d).length,
    sourceText: d.status === 'ready' ? d.source_text : null,
    memo: d.memo,
    materials,
    readOnly: !d.user_id,
  });
});

app.patch('/api/docs/:id', requireUser, (req, res) => {
  const d = loadDoc(req, res, { owner: true });
  if (!d) return;
  if (typeof req.body?.title === 'string' && req.body.title.trim()) run('UPDATE documents SET title = ? WHERE id = ?', req.body.title.trim().slice(0, 120), d.id);
  if (typeof req.body?.memo === 'string') run('UPDATE documents SET memo = ? WHERE id = ?', req.body.memo.slice(0, 50_000), d.id);
  res.json({ ok: true });
});

app.delete('/api/docs/:id', requireUser, (req, res) => {
  const d = loadDoc(req, res, { owner: true });
  if (!d) return;
  deleteDoc(d.id);
  res.json({ ok: true });
});

app.get('/api/docs/:id/file', (req, res) => {
  const d = loadDoc(req, res);
  if (!d) return;
  const files = docFiles(d);
  const f = files[Number(req.query.i) || 0];
  if (!f || !fs.existsSync(f)) return res.status(404).end();
  res.setHeader('Cache-Control', 'private, max-age=3600');
  if (d.kind !== 'image') res.type(d.mime);
  res.sendFile(f);
});

app.get('/api/docs/:id/materials/:kind', (req, res) => {
  const d = loadDoc(req, res);
  if (!d) return;
  const kind = req.params.kind as MaterialKind;
  if (!MATERIAL_KINDS.includes(kind as any)) return res.status(404).json({ error: 'not found' });
  let m = getMaterial(d.id, kind);
  if (!m && d.status === 'ready' && d.user_id) {
    ensureMaterial(d.id, kind, req.user?.id ?? null);
    m = getMaterial(d.id, kind);
  }
  res.json({ status: m?.status ?? (d.status === 'ready' ? 'none' : d.status), json: m?.json ? JSON.parse(m.json) : null, error: m?.error ?? null });
});

app.post('/api/docs/:id/materials/:kind/regenerate', requireUser, (req, res) => {
  const d = loadDoc(req, res, { owner: true });
  if (!d) return;
  if (!isPro(req.user!.id)) return res.status(402).json({ error: 'Pro에서 학습 자료를 다시 만들 수 있어요.', reason: 'pro' });
  ensureMaterial(d.id, req.params.kind as MaterialKind, req.user!.id, true);
  res.json({ status: 'generating' });
});

const parseSet = (s: any) => ({ id: s.id, kind: s.kind, title: s.title, status: s.status, error: s.error, createdAt: s.created_at, data: s.json ? JSON.parse(s.json) : null });

app.get('/api/docs/:id/sets/:kind', (req, res) => {
  const d = loadDoc(req, res);
  if (!d) return;
  res.json({ sets: listSets(d.id, req.params.kind as SetKind).map(parseSet) });
});

app.post('/api/docs/:id/sets/:kind', requireUser, (req, res) => {
  const d = loadDoc(req, res, { owner: true });
  if (!d) return;
  const kind = req.params.kind as SetKind;
  if (kind !== 'quiz' && kind !== 'flashcards') return res.status(404).json({ error: 'not found' });
  const existing = listSets(d.id, kind).filter((s) => s.status !== 'error');
  if (existing.length >= 1 && !isPro(req.user!.id)) {
    return res.status(402).json({ error: `무료 플랜은 자료마다 ${kind === 'quiz' ? '퀴즈' : '플래시카드'}를 한 세트씩 만들 수 있어요.`, reason: 'pro' });
  }
  const count = Math.min(30, Math.max(3, Number(req.body?.count) || (kind === 'quiz' ? 5 : 10)));
  const focus = typeof req.body?.focus === 'string' ? req.body.focus.slice(0, 60) : undefined;
  const difficulty = ['쉬움', '보통', '어려움'].includes(req.body?.difficulty) ? req.body.difficulty : undefined;
  const id = createSet({ docId: d.id, kind, userId: req.user!.id, count, focus, difficulty });
  res.json({ id });
});

app.get('/api/sets/:id', (req, res) => {
  const s = one('SELECT s.*, d.user_id AS owner FROM sets s JOIN documents d ON d.id = s.doc_id WHERE s.id = ?', req.params.id);
  if (!s || (s.owner && s.owner !== req.user?.id)) return res.status(404).json({ error: 'not found' });
  res.json(parseSet(s));
});

/* ---------- 학습 진행 상태 (암기 체크, 퀴즈 답 등) ---------- */

app.get('/api/progress/:key', requireUser, (req, res) => {
  const r = one('SELECT json FROM progress WHERE user_id = ? AND key = ?', req.user!.id, req.params.key);
  res.json({ data: r ? JSON.parse(r.json) : null });
});

app.put('/api/progress/:key', requireUser, (req, res) => {
  const data = JSON.stringify(req.body?.data ?? null);
  if (data.length > 200_000) return res.status(413).json({ error: 'too large' });
  run(
    `INSERT INTO progress (user_id, key, json, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, key) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`,
    req.user!.id,
    req.params.key.slice(0, 120),
    data,
    nowIso(),
  );
  res.json({ ok: true });
});

/* ---------- AI 튜터 ---------- */

const TUTOR_SYSTEM = `너는 대학생의 24시간 전공 튜터다.
- 한국어로 친절하지만 군더더기 없이 답한다. 핵심을 먼저 말하고 필요하면 예시를 든다.
- 수식은 일반 텍스트로 쓰고, 단계가 있는 풀이는 번호 목록으로 쓴다.
- 과제를 대신 써 달라는 요청에는 초안과 함께 스스로 다듬을 포인트를 알려 준다.`;

function chatSystem(docId: string | null) {
  if (!docId) return TUTOR_SYSTEM;
  const d = one('SELECT title, source_text FROM documents WHERE id = ?', docId);
  if (!d?.source_text) return TUTOR_SYSTEM;
  return `${TUTOR_SYSTEM}
- 아래 [자료]를 우선 근거로 답하고, 근거 위치를 (p.3) 또는 (12:30) 처럼 붙인다. 자료에 없는 내용은 일반 지식이라고 밝히고 답한다.

[자료: ${d.title}]
${String(d.source_text).slice(0, 100_000)}`;
}

app.get('/api/chats', requireUser, (req, res) => {
  res.json({ chats: all('SELECT id, title, doc_id AS docId, updated_at AS updatedAt FROM chats WHERE user_id = ? AND doc_id IS NULL ORDER BY updated_at DESC LIMIT 50', req.user!.id) });
});

app.post('/api/chats', requireUser, (req, res) => {
  const id = newId('ch');
  run('INSERT INTO chats (id, user_id, doc_id, title, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?)', id, req.user!.id, '새 대화', nowIso(), nowIso());
  res.json({ id });
});

app.get('/api/docs/:id/chat', requireUser, (req, res) => {
  const d = loadDoc(req, res);
  if (!d) return;
  let c = one('SELECT id FROM chats WHERE user_id = ? AND doc_id = ?', req.user!.id, d.id);
  if (!c) {
    const id = newId('ch');
    run('INSERT INTO chats (id, user_id, doc_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', id, req.user!.id, d.id, d.title, nowIso(), nowIso());
    c = { id };
  }
  res.json({ id: c.id });
});

function loadChat(req: Request, res: Response) {
  const c = one('SELECT * FROM chats WHERE id = ? AND user_id = ?', req.params.id, req.user!.id);
  if (!c) res.status(404).json({ error: '대화를 찾을 수 없어요.' });
  return c;
}

app.get('/api/chats/:id', requireUser, (req, res) => {
  const c = loadChat(req, res);
  if (!c) return;
  const messages = all('SELECT id, role, content, created_at AS createdAt FROM chat_messages WHERE chat_id = ? ORDER BY id ASC LIMIT 300', c.id);
  res.json({ id: c.id, title: c.title, docId: c.doc_id, messages });
});

app.delete('/api/chats/:id', requireUser, (req, res) => {
  const c = loadChat(req, res);
  if (!c) return;
  run('DELETE FROM chats WHERE id = ?', c.id);
  res.json({ ok: true });
});

app.post(
  '/api/chats/:id/messages',
  requireUser,
  h(async (req, res) => {
    const c = loadChat(req, res);
    if (!c) return;
    assertCanTutor(req.user!.id, req.user!.created_at);
    const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 4000) : '';
    if (!message) return res.status(400).json({ error: '질문을 입력해 주세요.' });
    const history = all<{ role: 'user' | 'model'; content: string }>(
      'SELECT role, content FROM (SELECT id, role, content FROM chat_messages WHERE chat_id = ? ORDER BY id DESC LIMIT 20) ORDER BY id ASC',
      c.id,
    );
    const reply = await chatReply({
      userId: req.user!.id,
      system: chatSystem(c.doc_id),
      history,
      message,
      search: req.body?.search === true || /최신|검색|뉴스|요즘|올해/.test(message),
      mock: () => `(개발용 가짜 답변) "${message.slice(0, 40)}"에 대해 답해 드릴게요.\n\n1. 핵심을 먼저 정리하면 이렇습니다.\n2. 예시를 들면 이해가 쉽습니다.\n\nGEMINI_API_KEY를 넣으면 실제 답변이 나와요.`,
    });
    const t = nowIso();
    run('INSERT INTO chat_messages (chat_id, role, content, created_at) VALUES (?, ?, ?, ?)', c.id, 'user', message, t);
    run('INSERT INTO chat_messages (chat_id, role, content, created_at) VALUES (?, ?, ?, ?)', c.id, 'model', reply, nowIso());
    if (!c.doc_id && c.title === '새 대화') run('UPDATE chats SET title = ? WHERE id = ?', message.slice(0, 40), c.id);
    run('UPDATE chats SET updated_at = ? WHERE id = ?', nowIso(), c.id);
    res.json({ reply, usage: usage(req.user!.id, req.user!.created_at) });
  }),
);

/* ---------- 시험 문제 만들기 ---------- */

app.get('/api/exams', requireUser, (req, res) => res.json({ exams: listExams(req.user!.id) }));

app.post('/api/exams', requireUser, (req, res) => {
  assertCanExam(req.user!.id, req.user!.created_at);
  const docIds = Array.isArray(req.body?.docIds) ? req.body.docIds.map(String) : [];
  const count = [10, 20, 30].includes(Number(req.body?.count)) ? Number(req.body.count) : 20;
  const durationMin = Math.min(180, Math.max(10, Number(req.body?.durationMin) || 40));
  const mode = req.body?.mode === 'variant' ? 'variant' : 'mock';
  res.json({ id: createExam({ userId: req.user!.id, docIds, count, durationMin, mode }) });
});

app.get('/api/exams/:id', requireUser, (req, res) => {
  const e = getExam(req.user!.id, req.params.id);
  if (!e) return res.status(404).json({ error: '시험지를 찾을 수 없어요.' });
  res.json(e);
});

app.post('/api/exams/:id/start', requireUser, (req, res) => {
  startExam(req.user!.id, req.params.id);
  res.json(getExam(req.user!.id, req.params.id));
});

app.post('/api/exams/:id/submit', requireUser, (req, res) => {
  const answers = Array.isArray(req.body?.answers) ? req.body.answers.map((a: unknown) => (typeof a === 'number' ? a : null)) : [];
  res.json(submitExam(req.user!.id, req.params.id, answers));
});

/* ---------- 결제 (페이앱) ---------- */

app.post(
  '/api/checkout',
  requireUser,
  h(async (req, res) => {
    const plan: Plan = req.body?.plan === 'yearly' ? 'yearly' : 'monthly';
    const phone = normalizePhone(req.body?.phone);
    if (!phone) return res.status(400).json({ error: '휴대폰 번호를 확인해 주세요.' });
    const out = await startCheckout({ user: req.user!, plan, phone, origin: origin(req) });
    logFunnel('checkout_start', req.anonId, req.user!.id);
    res.json({ ...out, amount: planInfo(plan).price });
  }),
);

/** 결제창에서 돌아온 뒤 결제 상태를 확인한다. 처음 확인될 때 서버 전환 이벤트를 보낸다. */
app.get('/api/checkout/:orderId', requireUser, (req, res) => {
  const p = orderStatus(req.user!.id, req.params.orderId);
  if (!p) return res.status(404).json({ error: '주문을 찾을 수 없어요.' });
  let firstConfirm = false;
  if (p.status === 'paid') {
    const r = run('UPDATE payments SET meta_sent = 1 WHERE order_id = ? AND meta_sent = 0', p.order_id);
    if (r.changes) {
      firstConfirm = true;
      logFunnel('purchase', req.anonId, req.user!.id);
      void sendServerEvent(req, { eventName: 'Purchase', eventId: p.order_id, email: req.user!.email, value: p.amount });
    }
  }
  res.json({ ...p, firstConfirm, sub: subscriptionView(req.user!.id) });
});

app.post(
  '/api/payapp/feedback',
  express.urlencoded({ extended: false, limit: '100kb' }),
  (req, res) => {
    const result = handleFeedback(req.body ?? {});
    res.type('text/plain').send(result.ok ? 'SUCCESS' : 'FAIL');
  },
);

app.post(
  '/api/subscription/cancel',
  requireUser,
  h(async (req, res) => {
    await cancelSubscription(req.user!.id);
    res.json(meView(req));
  }),
);

// 개발용 가짜 결제창
app.get('/api/payapp/mock-order/:orderId', requireUser, (req, res) => {
  if (config.paymentProvider !== 'mock') return res.status(404).end();
  const p = orderStatus(req.user!.id, req.params.orderId);
  if (!p) return res.status(404).json({ error: '주문을 찾을 수 없어요.' });
  res.json({ ...p, name: planInfo(p.plan).name, shopname: config.payapp.shopname, phone: req.user!.phone });
});

app.post('/api/payapp/mock-pay', requireUser, (req, res) => {
  const orderId = String(req.body?.orderId ?? '');
  if (!orderStatus(req.user!.id, orderId)) return res.status(404).json({ error: '주문을 찾을 수 없어요.' });
  const r = mockPay(orderId);
  res.json({ ok: r.ok });
});

/* ---------- 관리자 ---------- */

app.get('/api/admin/stats', (req, res) => {
  if (!config.adminKey || req.headers['x-admin-key'] !== config.adminKey) return res.status(401).json({ error: '관리자 키가 맞지 않아요.' });
  const days = Math.min(90, Math.max(1, Number(req.query.days) || 14));
  const since = addDays(kstDayStartIso(), -(days - 1));
  const kstDay = (col: string) => `date(datetime(${col}, '+9 hours'))`;
  const payments = all(
    `SELECT ${kstDay('paid_at')} AS d, SUM(amount) AS revenue, COUNT(*) AS purchases,
       SUM(CASE WHEN kind = 'renewal' THEN 1 ELSE 0 END) AS renewals
     FROM payments WHERE status = 'paid' AND paid_at >= ? GROUP BY d`,
    since,
  );
  const funnel = all(
    `SELECT ${kstDay('created_at')} AS d, name, COUNT(DISTINCT COALESCE(user_id, anon_id)) AS c FROM funnel_events WHERE created_at >= ? GROUP BY d, name`,
    since,
  );
  const ai = all(`SELECT ${kstDay('created_at')} AS d, COUNT(*) AS n, SUM(cost_krw) AS cost FROM ai_usage WHERE created_at >= ? GROUP BY d`, since);
  const rows: Record<string, any> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(new Date(since).getTime() + 9 * 3600_000 + i * 86400_000).toISOString().slice(0, 10);
    rows[d] = { date: d, visit: 0, signup: 0, upload: 0, checkout_start: 0, purchase: 0, revenue: 0, purchases: 0, renewals: 0, ai_calls: 0, ai_cost: 0 };
  }
  for (const p of payments) if (rows[p.d]) Object.assign(rows[p.d], { revenue: p.revenue, purchases: p.purchases, renewals: p.renewals });
  for (const f of funnel) if (rows[f.d]) rows[f.d][f.name] = f.c;
  for (const a of ai) if (rows[a.d]) Object.assign(rows[a.d], { ai_calls: a.n, ai_cost: a.cost });
  const unit = all('SELECT kind, COUNT(*) AS n, AVG(cost_krw) AS avg_cost FROM ai_usage GROUP BY kind ORDER BY n DESC');
  const pro = one<{ c: number }>("SELECT COUNT(*) AS c FROM subscriptions WHERE status != 'expired' AND current_period_end > ?", nowIso())!.c;
  res.json({ days: Object.values(rows).reverse(), pro, unitCost: unit, plans: config.plans });
});

/* ---------- 오류 처리 ---------- */

app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof LimitError) return res.status(402).json({ error: err.message, reason: err.reason });
  if (err instanceof DocError || err instanceof PaymentError) return res.status(400).json({ error: err.message });
  if (err instanceof AiError) return res.status(502).json({ error: err.message });
  if (err instanceof multer.MulterError) {
    return res.status(413).json({ error: err.code === 'LIMIT_FILE_SIZE' ? '파일이 너무 커요.' : '업로드에 실패했어요.' });
  }
  console.error(err);
  res.status(500).json({ error: '일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.' });
});

/* ---------- 프런트 ---------- */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (config.isProd) {
  const dist = path.join(root, 'dist');
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  const indexHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  app.get('*', (_req, res) => res.type('html').send(indexHtml));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

app.listen(config.port, () => {
  console.log(`[server] http://localhost:${config.port} (결제: ${config.paymentProvider}, AI: ${aiMode})`);
});
