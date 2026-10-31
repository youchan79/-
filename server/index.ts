import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response, type NextFunction } from 'express';
import { config, assertProdConfig } from './config.ts';
import { all, one, run, nowIso, addDays, kstDayStartIso, logFunnel } from './db.ts';
import {
  attachIdentity,
  requireUser,
  createUser,
  claimAnonReadings,
  normalizeEmail,
  setSession,
  clearSession,
  verifyPassword,
} from './auth.ts';
import { BirthInputError, computeChart, previewText, reportSections, validateBirthInput } from './saju.ts';
import { aiMode, chatReply, generateReport } from './ai.ts';
import {
  PaymentError,
  cancelSubscription,
  checkoutParams,
  confirmAuto,
  confirmPass,
  hasAccess,
  resumeSubscription,
  runRenewals,
  subscriptionView,
} from './billing.ts';
import { sendServerEvent } from './meta.ts';

assertProdConfig();

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '100kb' }));
app.use(attachIdentity);

type Handler = (req: Request, res: Response) => Promise<unknown> | unknown;
const h = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res)).catch(next);
};

const randomId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
const origin = (req: Request) => config.appUrl || `${req.protocol}://${req.get('host')}`;

/* ---------- 설정과 계정 ---------- */

app.get('/api/config', (_req, res) => {
  res.json({
    serviceName: config.business.serviceName,
    pixelId: config.meta.pixelId || null,
    plan: config.plan,
    billingMode: config.billingMode,
    paymentProvider: config.paymentProvider,
    aiMode,
    business: config.business,
  });
});

app.get('/api/me', (req, res) => {
  if (!req.user) return res.json({ user: null, subscription: null });
  res.json({ user: { email: req.user.email }, subscription: subscriptionView(req.user.id) });
});

app.post(
  '/api/auth/signup',
  h(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email) return res.status(400).json({ error: '이메일을 확인해 주세요.' });
    if (password.length < 8) return res.status(400).json({ error: '비밀번호는 8자 이상이어야 합니다.' });
    if (req.body?.agree !== true) return res.status(400).json({ error: '약관과 개인정보 수집에 동의해 주세요.' });
    if (one('SELECT 1 FROM users WHERE email = ?', email)) {
      return res.status(409).json({ error: '이미 가입된 이메일입니다. 로그인해 주세요.' });
    }
    const user = createUser(email, password);
    req.user = user;
    setSession(res, user.id);
    claimAnonReadings(req.anonId, user.id);
    logFunnel('signup', req.anonId, user.id);
    const eventId = `reg_${user.id}`;
    void sendServerEvent(req, { eventName: 'CompleteRegistration', eventId, email });
    res.json({ user: { email }, eventId });
  }),
);

app.post(
  '/api/auth/login',
  h(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const row = email ? one('SELECT * FROM users WHERE email = ?', email) : undefined;
    if (!row || !verifyPassword(password, row.password_hash)) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 맞지 않습니다.' });
    }
    setSession(res, row.id);
    claimAnonReadings(req.anonId, row.id);
    res.json({ user: { email: row.email } });
  }),
);

app.post('/api/auth/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

const TRACKABLE = new Set(['visit']);
app.post('/api/track', (req, res) => {
  const name = req.body?.name;
  if (typeof name === 'string' && TRACKABLE.has(name)) logFunnel(name, req.anonId, req.user?.id ?? null);
  res.json({ ok: true });
});

/* ---------- 사주 ---------- */

function ownsReading(req: Request, r: any): boolean {
  if (r.user_id) return req.user?.id === r.user_id;
  return r.anon_id === req.anonId;
}

function loadOwnedReading(req: Request, res: Response) {
  const r = one('SELECT * FROM readings WHERE id = ?', req.params.id);
  if (!r) {
    res.status(404).json({ error: '사주 결과를 찾을 수 없습니다.' });
    return null;
  }
  if (!ownsReading(req, r)) {
    res.status(403).json({ error: '내 사주 결과만 볼 수 있습니다.' });
    return null;
  }
  if (!r.user_id && req.user) {
    run('UPDATE readings SET user_id = ? WHERE id = ?', req.user.id, r.id);
    r.user_id = req.user.id;
  }
  return r;
}

app.post(
  '/api/readings',
  h(async (req, res) => {
    const input = validateBirthInput(req.body);
    const chart = computeChart(input);
    const id = randomId('r');
    run(
      `INSERT INTO readings (id, user_id, anon_id, name, gender, calendar, leap, birth_date, birth_time, chart_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      req.user?.id ?? null,
      req.anonId,
      input.name,
      input.gender,
      input.calendar,
      input.leap ? 1 : 0,
      input.date,
      input.time,
      JSON.stringify(chart),
      nowIso(),
    );
    logFunnel('preview', req.anonId, req.user?.id ?? null);
    res.json({ id });
  }),
);

app.get(
  '/api/readings/:id',
  h(async (req, res) => {
    const r = loadOwnedReading(req, res);
    if (!r) return;
    const chart = JSON.parse(r.chart_json);
    const access = hasAccess(req.user?.id);
    res.json({
      id: r.id,
      name: r.name,
      gender: r.gender,
      calendar: r.calendar,
      birthDate: r.birth_date,
      birthTime: r.birth_time,
      chart,
      preview: previewText(chart),
      sections: reportSections(),
      access,
      report: access ? { status: r.report_status, md: r.report_md ?? '' } : null,
    });
  }),
);

const STALE_MS = 3 * 60_000;

app.post(
  '/api/readings/:id/report',
  requireUser,
  h(async (req, res) => {
    const r = loadOwnedReading(req, res);
    if (!r) return;
    if (!hasAccess(req.user!.id)) return res.status(402).json({ error: '구독 후 이용할 수 있습니다.' });
    if (r.report_status === 'done') return res.json({ status: 'done' });
    if (r.report_status === 'generating' && Date.now() - new Date(r.report_started_at).getTime() < STALE_MS) {
      return res.json({ status: 'generating' });
    }
    const used = one<{ c: number }>(
      'SELECT COUNT(*) AS c FROM readings WHERE user_id = ? AND report_started_at >= ?',
      req.user!.id,
      addDays(nowIso(), -30),
    )!.c;
    if (used >= config.plan.reportMonthlyLimit) {
      return res.status(429).json({ error: `전체 풀이는 30일에 ${config.plan.reportMonthlyLimit}건까지 만들 수 있습니다.` });
    }
    void generateReport(r.id, req.user!.id);
    res.json({ status: 'generating' });
  }),
);

function chatRemaining(userId: string): number {
  const used = one<{ c: number }>(
    "SELECT COUNT(*) AS c FROM chat_messages WHERE user_id = ? AND role = 'user' AND created_at >= ?",
    userId,
    kstDayStartIso(),
  )!.c;
  return Math.max(0, config.plan.chatDailyLimit - used);
}

app.get(
  '/api/readings/:id/chat',
  requireUser,
  h(async (req, res) => {
    const r = loadOwnedReading(req, res);
    if (!r) return;
    const messages = all(
      'SELECT id, role, content, created_at FROM chat_messages WHERE reading_id = ? ORDER BY id ASC LIMIT 200',
      r.id,
    );
    res.json({ name: r.name, access: hasAccess(req.user!.id), messages, remaining: chatRemaining(req.user!.id), limit: config.plan.chatDailyLimit });
  }),
);

app.post(
  '/api/readings/:id/chat',
  requireUser,
  h(async (req, res) => {
    const r = loadOwnedReading(req, res);
    if (!r) return;
    const userId = req.user!.id;
    if (!hasAccess(userId)) return res.status(402).json({ error: '구독 후 이용할 수 있습니다.' });
    const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 500) : '';
    if (!message) return res.status(400).json({ error: '질문을 입력해 주세요.' });
    if (chatRemaining(userId) <= 0) {
      return res.status(429).json({ error: `오늘 질문 ${config.plan.chatDailyLimit}개를 모두 썼습니다. 내일 다시 물어봐 주세요.` });
    }
    const history = all<{ role: 'user' | 'model'; content: string }>(
      'SELECT role, content FROM (SELECT id, role, content FROM chat_messages WHERE reading_id = ? ORDER BY id DESC LIMIT 16) ORDER BY id ASC',
      r.id,
    );
    let reply: string;
    try {
      reply = await chatReply({
        userId,
        name: r.name,
        gender: r.gender,
        birthTime: r.birth_time,
        chart: JSON.parse(r.chart_json),
        report: r.report_status === 'done' ? r.report_md : null,
        history,
        message,
      });
    } catch (e) {
      console.error('[chat] 실패', e);
      return res.status(502).json({ error: '답변을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    }
    const t = nowIso();
    run('INSERT INTO chat_messages (user_id, reading_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)', userId, r.id, 'user', message, t);
    run('INSERT INTO chat_messages (user_id, reading_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)', userId, r.id, 'model', reply, nowIso());
    res.json({ reply, remaining: chatRemaining(userId) });
  }),
);

app.get('/api/my/readings', requireUser, (req, res) => {
  const rows = all(
    'SELECT id, name, birth_date, calendar, report_status, created_at FROM readings WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    req.user!.id,
  );
  res.json({ readings: rows });
});

/* ---------- 결제 ---------- */

app.post(
  '/api/checkout/start',
  requireUser,
  h(async (req, res) => {
    const readingId = typeof req.body?.readingId === 'string' ? req.body.readingId : null;
    const params = checkoutParams(req.user!, origin(req), readingId);
    logFunnel('checkout_start', req.anonId, req.user!.id);
    res.json(params);
  }),
);

app.post(
  '/api/checkout/confirm',
  requireUser,
  h(async (req, res) => {
    const b = req.body ?? {};
    const user = req.user!;
    const result =
      b.mode === 'pass'
        ? await confirmPass(user, String(b.paymentKey ?? ''), String(b.orderId ?? ''), Number(b.amount))
        : await confirmAuto(user, String(b.authKey ?? ''), String(b.customerKey ?? ''));
    if (result.firstTime) {
      logFunnel('purchase', req.anonId, user.id);
      void sendServerEvent(req, {
        eventName: 'Purchase',
        eventId: result.orderId,
        email: user.email,
        value: result.amount,
        sourceUrl: origin(req) + '/checkout/success',
      });
    }
    res.json({ ok: true, ...result });
  }),
);

app.post('/api/subscription/cancel', requireUser, (req, res) => {
  cancelSubscription(req.user!.id);
  res.json({ subscription: subscriptionView(req.user!.id) });
});

app.post(
  '/api/subscription/resume',
  requireUser,
  h(async (req, res) => {
    resumeSubscription(req.user!.id);
    res.json({ subscription: subscriptionView(req.user!.id) });
  }),
);

app.post(
  '/api/cron/renew',
  h(async (req, res) => {
    if (!config.cronSecret || req.headers['x-cron-secret'] !== config.cronSecret) return res.status(401).json({ error: 'unauthorized' });
    res.json(await runRenewals());
  }),
);

/* ---------- 관리자: 일별 실제 결제 매출과 퍼널 ---------- */

app.get('/api/admin/stats', (req, res) => {
  if (!config.adminKey || req.headers['x-admin-key'] !== config.adminKey) return res.status(401).json({ error: '관리자 키가 맞지 않습니다.' });
  const days = Math.min(90, Math.max(1, Number(req.query.days) || 14));
  const since = addDays(kstDayStartIso(), -(days - 1));
  const kstDay = (col: string) => `date(datetime(${col}, '+9 hours'))`;

  const payments = all(
    `SELECT ${kstDay('approved_at')} AS d,
       SUM(amount) AS revenue, COUNT(*) AS purchases,
       SUM(CASE WHEN kind = 'renewal' THEN amount ELSE 0 END) AS renewal_revenue,
       SUM(CASE WHEN kind = 'renewal' THEN 1 ELSE 0 END) AS renewals
     FROM payments WHERE status = 'done' AND approved_at >= ? GROUP BY d`,
    since,
  );
  const funnel = all(
    `SELECT ${kstDay('created_at')} AS d, name, COUNT(DISTINCT COALESCE(user_id, anon_id)) AS c
     FROM funnel_events WHERE created_at >= ? GROUP BY d, name`,
    since,
  );
  const ai = all(
    `SELECT ${kstDay('created_at')} AS d, kind, COUNT(*) AS n, SUM(cost_krw) AS cost FROM ai_usage WHERE created_at >= ? GROUP BY d, kind`,
    since,
  );
  const failed = all(
    `SELECT ${kstDay('created_at')} AS d, COUNT(*) AS c FROM payments WHERE status = 'failed' AND created_at >= ? GROUP BY d`,
    since,
  );

  const rows: Record<string, any> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(new Date(since).getTime() + 9 * 3600_000 + i * 86400_000).toISOString().slice(0, 10);
    rows[d] = { date: d, visit: 0, preview: 0, signup: 0, checkout_start: 0, purchase: 0, revenue: 0, purchases: 0, renewals: 0, renewal_revenue: 0, failed: 0, ai_cost: 0, reports: 0, chats: 0 };
  }
  for (const p of payments) if (rows[p.d]) Object.assign(rows[p.d], { revenue: p.revenue, purchases: p.purchases, renewals: p.renewals, renewal_revenue: p.renewal_revenue });
  for (const f of funnel) if (rows[f.d]) rows[f.d][f.name] = f.c;
  for (const f of failed) if (rows[f.d]) rows[f.d].failed = f.c;
  for (const a of ai) {
    if (!rows[a.d]) continue;
    rows[a.d].ai_cost += a.cost;
    rows[a.d][a.kind === 'report' ? 'reports' : 'chats'] = a.n;
  }

  const unit = all('SELECT kind, COUNT(*) AS n, AVG(cost_krw) AS avg_cost FROM ai_usage GROUP BY kind');
  const activeSubs = one<{ c: number }>(
    "SELECT COUNT(*) AS c FROM subscriptions WHERE status = 'past_due' OR (status = 'active' AND current_period_end > ?)",
    nowIso(),
  )!.c;
  const autoRenewing = one<{ c: number }>(
    "SELECT COUNT(*) AS c FROM subscriptions WHERE mode = 'auto' AND cancel_at_period_end = 0 AND status IN ('active', 'past_due')",
  )!.c;

  res.json({
    days: Object.values(rows).reverse(),
    activeSubs,
    autoRenewing,
    unitCost: Object.fromEntries(unit.map((u) => [u.kind, { n: u.n, avg: u.avg_cost }])),
    plan: config.plan,
  });
});

/* ---------- 오류 처리 ---------- */

app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof BirthInputError) return res.status(400).json({ error: err.message });
  if (err instanceof PaymentError) return res.status(400).json({ error: err.message, code: err.code });
  console.error(err);
  res.status(500).json({ error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
});

/* ---------- 프런트 ---------- */

// 서버가 재시작되면 만들던 풀이는 중단된 것으로 본다.
run("UPDATE readings SET report_status = 'error' WHERE report_status = 'generating'");

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
  console.log(`[server] http://localhost:${config.port} (결제: ${config.paymentProvider}/${config.billingMode}, AI: ${aiMode})`);
});

// 정기결제 갱신과 만료 처리
const tick = () => runRenewals().catch((e) => console.error('[renewal]', e));
setTimeout(tick, 10_000);
setInterval(tick, config.renewalIntervalMin * 60_000);
