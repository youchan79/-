import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import express, { type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { config, assertProdConfig } from './config.ts';
import { all, one, run, nowIso, addDays, kstDayStartIso, logFunnel, newId } from './db.ts';
import {
  attachIdentity,
  requireUser,
  createUser,
  normalizeEmail,
  setSession,
  clearSession,
  verifyPassword,
  startOauthState,
  takeOauthState,
  setLoginHint,
  markHintSignedOut,
  clearLoginHint,
  maskEmail,
  maskName,
} from './auth.ts';
import { aiMode, chatReply, AiError } from './ai.ts';
import { mediaSupport } from './media.ts';
import {
  DocError,
  assertReadableImages,
  attachRecording,
  createFileDoc,
  createRecordingDoc,
  createMemoDoc,
  createSet,
  createYoutubeDoc,
  deleteDoc,
  detectKind,
  docFiles,
  ensureMaterial,
  getMaterial,
  listSets,
  ownFolder,
  purgeTrash,
  recoverInterrupted,
  TRASH_DAYS,
} from './docs.ts';
import { LimitError, assertCanExam, assertCanTutor, assertCanUpload, isPro, maxUploadBytes, usage } from './plan.ts';
import { createExam, getExam, listExams, startExam, submitExam } from './exam.ts';
import {
  PaymentError,
  cancelSubscription,
  handleFeedback,
  isPlan,
  mockPay,
  mockRenewal,
  normalizePhone,
  orderStatus,
  planInfo,
  startCheckout,
  subscriptionView,
} from './billing.ts';
import { sendServerEvent } from './meta.ts';
import {
  SocialError,
  decodeMockUser,
  findOrCreateSocialUser,
  googleProfile,
  mockClientOk,
  mockGoogleToken,
  mockMeResponse,
  mockOauthCode,
  oauthAuthorizeUrl,
  oauthEnabled,
  oauthProfile,
  type OauthProvider,
  type SocialProfile,
} from './social.ts';
import { seedSamples } from './samples.ts';
import type { MaterialKind, SetKind } from './prompts.ts';

assertProdConfig();
seedSamples();
recoverInterrupted();
// 휴지통 7일 지난 문서 완전 삭제: 켤 때 한 번, 그 뒤 한 시간마다
purgeTrash();
setInterval(purgeTrash, 3600_000).unref();

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '2mb' }));
app.use(attachIdentity);
// 공유 링크 화면은 검색에 나오지 않게
app.use((req, res, next) => {
  if (req.path.startsWith('/share/') || req.path.startsWith('/api/share/')) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

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
    media: mediaSupport,
    business: config.business,
    // 소셜 로그인. 공개 값(구글 클라이언트 ID, 카카오 JavaScript 키)과 켜졌는지만. 꺼진 쪽은 버튼을 숨긴다.
    auth: {
      google: config.social.googleClientId || null,
      kakao: oauthEnabled('kakao'),
      kakaoJsKey: oauthEnabled('kakao') ? config.social.kakaoJsKey || null : null,
      naver: oauthEnabled('naver'),
      mock: config.social.mock,
    },
  });
});

function meView(req: Request) {
  if (!req.user) return { user: null, sub: null, usage: null, settings: {} };
  const row = one('SELECT settings_json FROM users WHERE id = ?', req.user.id);
  // 이메일을 못 받은 소셜 계정(자리표시 주소)은 '카카오 계정'처럼 보여 준다
  const placeholder = /^(\w+)_[0-9a-f]+@no-email\.invalid$/.exec(req.user.email);
  const via: Record<string, string> = { kakao: '카카오', naver: '네이버', google: 'Google' };
  const email = placeholder ? `${via[placeholder[1]] ?? placeholder[1]} 계정` : req.user.email;
  // 화면에 부를 이름과 로그인 방법(소셜 계정이면 제공자)
  const identity = one('SELECT provider, name FROM user_identities WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', req.user.id);
  return {
    user: { email, name: identity?.name || null, provider: identity?.provider ?? null, phone: req.user.phone, createdAt: req.user.created_at },
    sub: subscriptionView(req.user.id),
    usage: usage(req.user.id, req.user.created_at),
    settings: JSON.parse(row?.settings_json || '{}'),
  };
}

app.get('/api/me', (req, res) => res.json(meView(req)));

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
    setLoginHint(res, 'email', maskEmail(email));
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
    if (!row || !verifyPassword(password, row.password_hash)) {
      // 소셜로만 가입한 계정은 비밀번호가 없다. 어느 버튼으로 들어오면 되는지 알려 준다.
      const social = row && !row.password_hash ? one('SELECT provider FROM user_identities WHERE user_id = ? LIMIT 1', row.id) : undefined;
      const via = social ? ({ google: 'Google', kakao: '카카오', naver: '네이버' } as Record<string, string>)[social.provider] : undefined;
      if (via) return res.status(401).json({ error: `${via}로 가입한 계정이에요. '${via}로 계속하기'를 눌러 주세요.` });
      return res.status(401).json({ error: '이메일 또는 비밀번호가 맞지 않아요.' });
    }
    setSession(res, row.id);
    setLoginHint(res, 'email', maskEmail(row.email));
    req.user = { id: row.id, email: row.email, phone: row.phone, created_at: row.created_at };
    res.json(meView(req));
  }),
);

/** 소셜 로그인 마무리. 처음 가입이면 이메일 가입과 똑같이 가입 기록과 CompleteRegistration을 남기고 eventId를 돌려준다. */
function completeSocialLogin(req: Request, res: Response, profile: SocialProfile): string | undefined {
  const { user, isNew } = findOrCreateSocialUser(profile);
  req.user = user;
  setSession(res, user.id);
  // 다음에 이 기기에서 같은 버튼을 맨 위에 보여 주려고 가린 계정만 남긴다 (예: ch***@gmail.com, 홍*동)
  const label = profile.provider === 'kakao' && profile.name ? maskName(profile.name) : profile.email ? maskEmail(profile.email) : profile.name ? maskName(profile.name) : '';
  setLoginHint(res, profile.provider, label);
  if (!isNew) return undefined;
  logFunnel('signup', req.anonId, user.id);
  const eventId = `reg_${user.id}`;
  void sendServerEvent(req, { eventName: 'CompleteRegistration', eventId, email: user.email });
  return eventId;
}

app.post(
  '/api/auth/google',
  h(async (req, res) => {
    const eventId = completeSocialLogin(req, res, await googleProfile(req.body?.credential));
    res.json(eventId ? { ...meView(req), eventId } : meView(req));
  }),
);

/* 카카오·네이버: 시작 → 제공자 로그인 화면 → 콜백 → 원래 보던 화면으로.
   처음 가입이면 ?reg=eventId (브라우저 픽셀용), 실패면 ?login_error=코드 를 붙여 돌려보낸다. */
const safeNext = (v: unknown) => (typeof v === 'string' && /^\/(?![/\\])/.test(v) ? v.slice(0, 300) : '/home');
const withQuery = (to: string, q: string) => (q ? `${to}${to.includes('?') ? '&' : '?'}${q}` : to);
const callbackUrl = (req: Request, p: OauthProvider) => `${origin(req)}/api/auth/${p}/callback`;

for (const p of ['kakao', 'naver'] as const) {
  app.get(`/api/auth/${p}/start`, (req, res) => {
    const next = safeNext(req.query.next);
    if (!oauthEnabled(p)) return res.redirect(withQuery(next, 'login_error=failed'));
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(req.get('user-agent') ?? '');
    res.redirect(oauthAuthorizeUrl(p, callbackUrl(req, p), startOauthState(res, p, next), mobile));
  });

  app.get(
    `/api/auth/${p}/callback`,
    h(async (req, res) => {
      const saved = takeOauthState(req, res, p, req.query.state);
      const back = (q: string) => res.redirect(withQuery(saved?.next ?? '/home', q));
      if (!saved) return back('login_error=state'); // state가 없거나 다르면 코드를 쓰지 않는다 (CSRF)
      const code = req.query.code;
      if (typeof code !== 'string' || !code) return back('login_error=cancelled');
      try {
        const eventId = completeSocialLogin(req, res, await oauthProfile(p, code, callbackUrl(req, p), String(req.query.state)));
        back(eventId ? `reg=${eventId}` : '');
      } catch (e) {
        if (!(e instanceof SocialError)) console.error(e);
        back(`login_error=${e instanceof SocialError ? e.code : 'failed'}`);
      }
    }),
  );
}

// 카카오 JavaScript SDK용: 창이 열릴 때 state를 미리 받아 둔다. 그래야 버튼을 누르는 순간 바로
// Kakao.Auth.authorize를 불러 폰에서 카카오톡 앱으로 넘어갈 수 있다 (기다렸다 부르면 앱 전환이 막힐 수 있음).
app.post('/api/auth/kakao/prepare', (req, res) => {
  if (!oauthEnabled('kakao')) return res.status(404).json({ error: '카카오 로그인이 꺼져 있어요.' });
  res.json({ state: startOauthState(res, 'kakao', safeNext(req.body?.next)), redirectUri: callbackUrl(req, 'kakao') });
});

// 개발용 가짜 로그인. SOCIAL_LOGIN_MOCK=1인 개발 환경에서만 이 경로들이 생긴다 (운영에서는 등록되지 않음).
if (config.social.mock) {
  const s = (v: unknown) => (typeof v === 'string' ? v : undefined);
  const esc = (v: string) => v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  // 구글: 진짜와 같은 모양의 ID 토큰 (테스트 키로 서명). 거절 경우를 시험하려고 aud·iss·exp도 바꿀 수 있다.
  app.post('/api/auth/mock-token', (req, res) => {
    const b = req.body ?? {};
    const expiresIn = typeof b.expiresIn === 'number' ? b.expiresIn : undefined;
    const emailVerified = b.emailVerified === false ? false : undefined;
    res.json({ token: mockGoogleToken({ email: s(b.email), sub: s(b.sub), emailVerified, aud: s(b.aud), iss: s(b.iss), expiresIn }) });
  });

  // 카카오·네이버 로그인 화면 흉내
  app.get('/api/auth/mock/authorize', (req, res) => {
    const p = req.query.provider === 'naver' ? 'naver' : 'kakao';
    const label = p === 'kakao' ? '카카오' : '네이버';
    const keep = ['redirect_uri', 'state'].map((k) => `<input type="hidden" name="${k}" value="${esc(s(req.query[k]) ?? '')}">`).join('');
    res.type('html').send(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>[개발용] 가짜 ${label} 로그인</title>
<body style="font:16px/1.6 system-ui,sans-serif;max-width:360px;margin:40px auto;padding:0 16px">
<h1 style="font-size:20px">[개발용] 가짜 ${label} 로그인</h1>
<form action="/api/auth/mock/approve" method="get">
<input type="hidden" name="provider" value="${p}">${keep}
<p><label>이메일 (비우면 이메일 없이)<br><input name="email" value="test@${p}.com" style="font:inherit;width:100%;box-sizing:border-box"></label></p>
${p === 'kakao' ? '<p><label><input type="checkbox" name="verified" value="1" checked> 카카오가 확인한 이메일</label></p>' : '<p>네이버는 이메일 인증 여부를 주지 않아요.</p>'}
<p><button name="ok" value="1" style="font:inherit">동의하고 계속하기</button> <button name="cancel" value="1" style="font:inherit">취소</button></p>
</form></body></html>`);
  });

  app.get('/api/auth/mock/approve', (req, res) => {
    const p = req.query.provider === 'naver' ? 'naver' : 'kakao';
    const redirect = s(req.query.redirect_uri) ?? '';
    const state = encodeURIComponent(s(req.query.state) ?? '');
    if (!redirect.endsWith(`/api/auth/${p}/callback`)) return res.status(400).send('redirect_uri가 맞지 않아요.');
    if (req.query.cancel) return res.redirect(`${redirect}?error=access_denied&state=${state}`);
    const code = mockOauthCode(p, s(req.query.email)?.trim() || null, req.query.verified === '1', s(req.query.id));
    res.redirect(`${redirect}?code=${code}&state=${state}`);
  });

  // 진짜 토큰 교환과 같은 요청 모양(폼 본문, client_id·secret·redirect_uri)을 확인한다
  app.post('/api/auth/mock/token', express.urlencoded({ extended: false }), (req, res) => {
    const b = req.body ?? {};
    const u = decodeMockUser(b.code);
    const ok =
      u &&
      b.grant_type === 'authorization_code' &&
      mockClientOk(u.provider, b.client_id, b.client_secret) &&
      s(b.redirect_uri)?.endsWith(`/api/auth/${u.provider}/callback`) &&
      (u.provider === 'kakao' || !!b.state);
    if (!ok) return res.status(400).json({ error: 'invalid_grant' });
    res.json({ access_token: b.code, token_type: 'bearer', expires_in: 3600 });
  });

  app.get('/api/auth/mock/me', (req, res) => {
    const u = decodeMockUser(req.headers.authorization?.replace(/^Bearer /, ''));
    if (!u || u.provider !== req.query.provider) return res.status(401).json({ msg: 'invalid token' });
    res.json(mockMeResponse(u));
  });
}

app.post('/api/auth/logout', (req, res) => {
  clearSession(res);
  markHintSignedOut(req, res); // 마지막 로그인 방법 힌트는 남긴다
  res.json({ ok: true });
});

app.put('/api/settings', requireUser, (req, res) => {
  const row = one('SELECT settings_json FROM users WHERE id = ?', req.user!.id);
  const cur = JSON.parse(row?.settings_json || '{}');
  const next = { ...cur };
  for (const k of ['theme', 'answerLanguage', 'summaryLength', 'quizDifficulty', 'summaryFormat', 'summaryEasy', 'quizTypes']) {
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
    // 탈퇴한 뒤에도 월간 자동 결제가 계속되지 않게 먼저 해지한다 (해지 실패면 탈퇴도 멈춘다)
    if (subscriptionView(userId).autoRenew) await cancelSubscription(userId);
    for (const d of all('SELECT id FROM documents WHERE user_id = ?', userId)) deleteDoc(d.id);
    run('DELETE FROM chats WHERE user_id = ?', userId);
    run('DELETE FROM exams WHERE user_id = ?', userId);
    run('DELETE FROM progress WHERE user_id = ?', userId);
    run('DELETE FROM folders WHERE user_id = ?', userId);
    run('DELETE FROM user_identities WHERE user_id = ?', userId); // 탈퇴한 계정으로 다시 소셜 로그인되지 않게
    // 결제 기록은 전자상거래법상 5년 보관한다. 계정 식별 정보만 지운다.
    run("UPDATE users SET email = ?, password_hash = '', phone = NULL, settings_json = '{}' WHERE id = ?", `deleted_${userId}@deleted`, userId);
    clearSession(res);
    clearLoginHint(res);
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
  const d = one('SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL', req.params.id);
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

/** 폴더 안에서 만든 새 문서는 그 폴더에 넣는다(내 폴더일 때만) */
function placeInFolder(docId: string, req: Request) {
  const f = ownFolder(req.user!.id, req.body?.folderId);
  if (f) run('UPDATE documents SET folder_id = ? WHERE id = ?', f, docId);
}

/** 카드 미리보기용: 쪽 표시·마크다운 기호를 빼고 앞부분만 */
const cardPreview = (text: unknown) =>
  String(text ?? '')
    .slice(0, 600)
    .replace(/\[p\.\d+\]/g, '')
    .replace(/^\s*#+\s*/gm, '')
    .replace(/[*_`>|]/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim()
    .slice(0, 240);

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
  folderId: d.folder_id ?? null,
  favorite: !!d.favorite_at,
  // 썸네일이 없는 글 자료는 카드에 본문 첫머리를 보여 준다
  preview: !d.thumb && d.status === 'ready' && ['memo', 'docx', 'pptx', 'pdf'].includes(d.kind) ? cardPreview(d.source_text) : null,
});

app.get('/api/docs', (req, res) => {
  const mine = req.user
    ? all('SELECT * FROM documents WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC', req.user.id)
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
      if (kind === 'image') assertReadableImages(files);
      if (kind === 'audio' && !mediaSupport.audioFile && aiMode !== 'mock' && !(typeof req.body?.transcript === 'string' && req.body.transcript.trim())) {
        return res.status(400).json({ error: '녹음 파일 받아쓰기는 아직 지원하지 않아요. 녹음 화면에서 녹음하면 실시간 자막으로 정리돼요.' });
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
      placeInFolder(id, req);
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
    const id = await createYoutubeDoc(req.user!.id, String(req.body?.url ?? ''), typeof req.body?.transcript === 'string' ? req.body.transcript : undefined);
    placeInFolder(id, req);
    logFunnel('upload', req.anonId, req.user!.id);
    res.json({ id });
  }),
);

app.post('/api/docs/recording', requireUser, (req, res) => {
  const id = createRecordingDoc(req.user!.id);
  placeInFolder(id, req);
  res.json({ id });
});

app.post(
  '/api/docs/:id/recording',
  requireUser,
  upload.array('files', 1),
  h(async (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    try {
      const d = loadDoc(req, res, { owner: true });
      if (!d) return cleanupUploads(files);
      // 녹음 대기 중이거나, 정리하다 실패한 녹음 문서에만 붙일 수 있다
      if (d.kind !== 'audio' || !['recording', 'error'].includes(d.status) || (d.status === 'error' && d.file_path)) {
        cleanupUploads(files);
        return res.status(409).json({ error: '이미 녹음이 끝난 문서예요.' });
      }
      const f = files[0];
      if (!f) return res.status(400).json({ error: '녹음 파일이 없어요.' });
      if (detectKind(f.originalname, f.mimetype) !== 'audio') {
        cleanupUploads(files);
        return res.status(400).json({ error: '녹음 파일(mp3, m4a, wav, webm)만 올릴 수 있어요.' });
      }
      const limit = maxUploadBytes(req.user!.id);
      if (f.size > limit) {
        cleanupUploads(files);
        return res.status(413).json({ error: `파일이 너무 커요. ${isPro(req.user!.id) ? '' : '무료 플랜은 '}${Math.round(limit / 1024 / 1024)}MB까지 올릴 수 있어요.`, reason: 'size' });
      }
      const transcript = typeof req.body?.transcript === 'string' && req.body.transcript.trim() ? req.body.transcript.slice(0, 200_000) : null;
      if (!transcript && !mediaSupport.audioFile && aiMode !== 'mock') {
        cleanupUploads(files);
        return res.status(400).json({ error: '받아 적은 자막이 없어요. Chrome이나 삼성 인터넷에서 녹음하면 실시간 자막으로 정리돼요.' });
      }
      attachRecording({ docId: d.id, userId: req.user!.id, file: f, durationSec: Number(req.body?.duration) || null, liveTranscript: transcript });
      logFunnel('upload', req.anonId, req.user!.id);
      res.json({ ok: true });
    } catch (e) {
      cleanupUploads(files);
      throw e;
    }
  }),
);

app.post('/api/docs/memo', requireUser, (req, res) => {
  const id = createMemoDoc(req.user!.id, String(req.body?.title ?? ''), String(req.body?.text ?? ''));
  placeInFolder(id, req);
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
  // 이동: 내 폴더 id 또는 null(맨 위)
  if (req.body && 'folderId' in req.body) run('UPDATE documents SET folder_id = ? WHERE id = ?', ownFolder(req.user!.id, req.body.folderId), d.id);
  if (typeof req.body?.favorite === 'boolean') run('UPDATE documents SET favorite_at = ? WHERE id = ?', req.body.favorite ? nowIso() : null, d.id);
  res.json({ ok: true });
});

/* ---------- 폴더 ---------- */

app.get('/api/folders', requireUser, (req, res) => {
  const rows = all(
    `SELECT f.id, f.name, f.created_at,
       (SELECT COUNT(*) FROM documents d WHERE d.folder_id = f.id AND d.deleted_at IS NULL) AS count
     FROM folders f WHERE f.user_id = ? ORDER BY f.name COLLATE NOCASE`,
    req.user!.id,
  );
  res.json({ folders: rows.map((f) => ({ id: f.id, name: f.name, count: f.count, createdAt: f.created_at })) });
});

const folderName = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 60) : '');

app.post('/api/folders', requireUser, (req, res) => {
  const name = folderName(req.body?.name) || '새 폴더';
  if ((one('SELECT COUNT(*) AS c FROM folders WHERE user_id = ?', req.user!.id)?.c ?? 0) >= 200) return res.status(400).json({ error: '폴더는 200개까지 만들 수 있어요.' });
  const id = newId('fd');
  run('INSERT INTO folders (id, user_id, name, created_at) VALUES (?, ?, ?, ?)', id, req.user!.id, name, nowIso());
  res.json({ id, name });
});

app.patch('/api/folders/:id', requireUser, (req, res) => {
  const id = ownFolder(req.user!.id, req.params.id);
  const name = folderName(req.body?.name);
  if (!id) return res.status(404).json({ error: '폴더를 찾을 수 없어요.' });
  if (!name) return res.status(400).json({ error: '폴더 이름을 적어 주세요.' });
  run('UPDATE folders SET name = ? WHERE id = ?', name, id);
  res.json({ ok: true });
});

// 폴더를 지우면 안의 문서는 휴지통으로 간다(7일 안에 되살리면 맨 위로 돌아옴)
app.delete('/api/folders/:id', requireUser, (req, res) => {
  const id = ownFolder(req.user!.id, req.params.id);
  if (!id) return res.status(404).json({ error: '폴더를 찾을 수 없어요.' });
  run('UPDATE documents SET deleted_at = ?, folder_id = NULL WHERE folder_id = ? AND user_id = ? AND deleted_at IS NULL', nowIso(), id, req.user!.id);
  run('UPDATE documents SET folder_id = NULL WHERE folder_id = ?', id);
  run('DELETE FROM folders WHERE id = ?', id);
  res.json({ ok: true });
});

app.delete('/api/docs/:id', requireUser, (req, res) => {
  const d = loadDoc(req, res, { owner: true });
  if (!d) return;
  // 바로 지우지 않고 휴지통으로. TRASH_DAYS 뒤 purgeTrash가 완전히 지운다.
  run('UPDATE documents SET deleted_at = ? WHERE id = ?', nowIso(), d.id);
  res.json({ ok: true });
});

/* ---------- 휴지통 ---------- */

app.get('/api/trash', requireUser, (req, res) => {
  const rows = all('SELECT * FROM documents WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC', req.user!.id);
  res.json({
    days: TRASH_DAYS,
    docs: rows.map((d) => ({ ...docSummary(d), deletedAt: d.deleted_at, purgeAt: addDays(d.deleted_at, TRASH_DAYS) })),
  });
});

function loadTrashed(req: Request, res: Response) {
  const d = one('SELECT id FROM documents WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL', req.params.id, req.user!.id);
  if (!d) res.status(404).json({ error: '휴지통에 없는 문서예요.' });
  return d;
}

app.post('/api/trash/:id/restore', requireUser, (req, res) => {
  const d = loadTrashed(req, res);
  if (!d) return;
  run('UPDATE documents SET deleted_at = NULL WHERE id = ?', d.id);
  res.json({ ok: true });
});

app.delete('/api/trash/:id', requireUser, (req, res) => {
  const d = loadTrashed(req, res);
  if (!d) return;
  deleteDoc(d.id);
  res.json({ ok: true });
});

app.delete('/api/trash', requireUser, (req, res) => {
  for (const d of all('SELECT id FROM documents WHERE user_id = ? AND deleted_at IS NOT NULL', req.user!.id)) deleteDoc(d.id);
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

/* ---------- 공유 링크 ----------
 * 받은 사람은 로그인 없이 고른 학습 자료(요약·퀴즈·플래시카드·마인드맵·암기·개념)만 본다.
 * 원본 파일·원문·메모·AI 튜터는 이 길로 나가지 않는다(설계서 D4). 다른 문서는 토큰으로 열 수 없다.
 */
const SHARE_ITEMS = ['summary', 'quiz', 'flashcards', 'mindmap', 'memorize', 'concepts'] as const;
type ShareItem = (typeof SHARE_ITEMS)[number];

const activeShare = (docId: string) => one('SELECT token, items_json FROM shares WHERE doc_id = ? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1', docId);
const shareView = (s: any) => (s ? { token: s.token, items: JSON.parse(s.items_json) as ShareItem[] } : null);

app.get('/api/docs/:id/share', requireUser, (req, res) => {
  const d = loadDoc(req, res, { owner: true });
  if (!d) return;
  res.json({ share: shareView(activeShare(d.id)) });
});

app.post('/api/docs/:id/share', requireUser, (req, res) => {
  const d = loadDoc(req, res, { owner: true });
  if (!d) return;
  if (d.status !== 'ready') return res.status(400).json({ error: '자료 정리가 끝난 뒤에 공유할 수 있어요.' });
  const items = SHARE_ITEMS.filter((k) => Array.isArray(req.body?.items) && req.body.items.includes(k));
  if (!items.length) return res.status(400).json({ error: '공유할 항목을 하나 이상 골라 주세요.' });
  const cur = activeShare(d.id);
  if (cur) run('UPDATE shares SET items_json = ? WHERE token = ?', JSON.stringify(items), cur.token);
  else run('INSERT INTO shares (token, doc_id, user_id, items_json, created_at) VALUES (?, ?, ?, ?, ?)', crypto.randomBytes(18).toString('base64url'), d.id, req.user!.id, JSON.stringify(items), nowIso());
  // 받은 사람이 빈 화면을 보지 않게, 아직 안 만든 학습 자료는 주인 계정으로 지금 만든다
  for (const k of items) if ((MATERIAL_KINDS as readonly string[]).includes(k)) ensureMaterial(d.id, k as MaterialKind, req.user!.id);
  res.json({ share: shareView(activeShare(d.id)) });
});

app.delete('/api/docs/:id/share', requireUser, (req, res) => {
  const d = loadDoc(req, res, { owner: true });
  if (!d) return;
  run('UPDATE shares SET revoked_at = ? WHERE doc_id = ? AND revoked_at IS NULL', nowIso(), d.id);
  res.json({ ok: true });
});

/** 토큰으로 공유 문서를 찾는다. 끊긴 링크, 휴지통 문서, 정리 안 된 문서는 없는 것으로 본다. */
function loadShared(req: Request, res: Response, item?: string) {
  const token = String(req.params.token ?? '');
  const s = /^[A-Za-z0-9_-]{20,40}$/.test(token) ? one('SELECT * FROM shares WHERE token = ? AND revoked_at IS NULL', token) : undefined;
  const d = s && one("SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL AND status = 'ready'", s.doc_id);
  const items: string[] = s ? JSON.parse(s.items_json) : [];
  if (!s || !d || (item && !items.includes(item))) {
    res.status(404).json({ error: '링크가 끊겼거나 볼 수 없는 자료예요.' });
    return null;
  }
  return { d, items };
}

app.get('/api/share/:token', (req, res) => {
  const r = loadShared(req, res);
  if (!r) return;
  res.json({ id: r.d.id, kind: r.d.kind, title: r.d.title, createdAt: r.d.created_at, durationSec: r.d.duration_sec, pageCount: r.d.page_count, items: r.items });
});

app.get('/api/share/:token/materials/:kind', (req, res) => {
  const r = loadShared(req, res, req.params.kind);
  if (!r) return;
  const m = getMaterial(r.d.id, req.params.kind as MaterialKind);
  if (!m) return res.json({ status: 'error', json: null, error: '아직 만들어지지 않은 자료예요.' });
  res.json({ status: m.status, json: m.json ? JSON.parse(m.json) : null, error: m.error ?? null });
});

app.get('/api/share/:token/sets/:kind', (req, res) => {
  const r = loadShared(req, res, req.params.kind);
  if (!r) return;
  res.json({ sets: listSets(r.d.id, req.params.kind as SetKind).filter((s) => s.status === 'ready').map(parseSet) });
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

const DOC_TUTOR_SYSTEM = `${TUTOR_SYSTEM}
- 아래 [자료]를 우선 근거로 답하고, 근거 위치를 (p.3) 또는 (12:30) 처럼 붙인다. 자료에 없는 내용은 일반 지식이라고 밝히고 답한다.`;

function chatContext(docId: string | null) {
  if (!docId) return { system: TUTOR_SYSTEM, source: null };
  const d = one('SELECT title, source_text FROM documents WHERE id = ?', docId);
  if (!d?.source_text) return { system: TUTOR_SYSTEM, source: null };
  return { system: DOC_TUTOR_SYSTEM, source: { title: d.title as string, text: String(d.source_text).slice(0, 300_000) } };
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
    const ctx = chatContext(c.doc_id);
    const reply = await chatReply({
      userId: req.user!.id,
      system: ctx.system,
      source: ctx.source,
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
  const name = typeof req.body?.name === 'string' ? req.body.name.slice(0, 80) : undefined;
  const difficulty = typeof req.body?.difficulty === 'string' ? req.body.difficulty : undefined;
  const types = Array.isArray(req.body?.types) ? req.body.types.map(String) : undefined;
  res.json({ id: createExam({ userId: req.user!.id, docIds, count, durationMin, mode, name, difficulty, types }) });
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
  // 객관식·OX·빈칸은 보기 번호, 주관식은 적은 글자
  const answers = Array.isArray(req.body?.answers)
    ? req.body.answers.map((a: unknown) => (typeof a === 'number' ? a : typeof a === 'string' ? a.slice(0, 200) : null))
    : [];
  res.json(submitExam(req.user!.id, req.params.id, answers));
});

/* ---------- 결제 (페이앱) ---------- */

app.post(
  '/api/checkout',
  requireUser,
  h(async (req, res) => {
    const plan = isPlan(req.body?.plan) ? req.body.plan : 'monthly';
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

/** 설정 > 구독 > 청구·영수증: 실제로 결제된(환불 포함) 내역만. 영수증은 페이앱이 결제통보로 준 매출전표 주소(csturl)가 있을 때만. */
app.get('/api/payments', requireUser, (req, res) => {
  const rows = all(
    'SELECT order_id, plan, kind, amount, status, paid_at, raw_json FROM payments WHERE user_id = ? AND paid_at IS NOT NULL ORDER BY paid_at DESC LIMIT 100',
    req.user!.id,
  );
  res.json({
    payments: rows.map((p) => {
      let receiptUrl: string | null = null;
      try {
        const u = JSON.parse(p.raw_json || '{}').csturl;
        if (typeof u === 'string' && /^https:\/\//.test(u)) receiptUrl = u;
      } catch {}
      return { orderId: p.order_id, plan: p.plan, kind: p.kind, amount: p.amount, refunded: p.status === 'canceled', paidAt: p.paid_at, receiptUrl };
    }),
  });
});

app.post(
  '/api/payapp/feedback',
  express.urlencoded({ extended: false, limit: '100kb' }),
  (req, res) => {
    const result = handleFeedback(req.body ?? {});
    res.type('text/plain').send(result.ok ? 'SUCCESS' : 'FAIL');
  },
);

/** 월간 구독 해지: 다음 결제부터 멈추고, 결제한 기간 끝까지 Pro 유지 */
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

// 개발용: 월간 자동 결제가 한 번 더 일어난(또는 실패한) 것처럼 결제통보를 보낸다
app.post('/api/payapp/mock-renewal', requireUser, (req, res) => {
  if (config.paymentProvider !== 'mock') return res.status(404).end();
  const r = mockRenewal(req.user!.id, req.body?.fail !== true);
  res.json({ ok: r.ok, me: meView(req) });
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
  const subs = one<{ pro: number; monthly: number; yearly: number; canceled: number }>(
    `SELECT COUNT(*) AS pro, SUM(plan = 'monthly') AS monthly, SUM(plan = 'yearly') AS yearly, SUM(status = 'canceled') AS canceled
     FROM subscriptions WHERE status != 'expired' AND current_period_end > ?`,
    nowIso(),
  )!;
  res.json({
    days: Object.values(rows).reverse(),
    pro: subs.pro,
    proMonthly: subs.monthly ?? 0,
    proYearly: subs.yearly ?? 0,
    proCanceled: subs.canceled ?? 0,
    unitCost: unit,
    plans: config.plans,
  });
});

/* ---------- 오류 처리 ---------- */

app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof LimitError) return res.status(402).json({ error: err.message, reason: err.reason });
  if (err instanceof DocError || err instanceof PaymentError) return res.status(400).json({ error: err.message });
  if (err instanceof AiError) return res.status(502).json({ error: err.message });
  if (err instanceof SocialError) return res.status(401).json({ error: err.message });
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
