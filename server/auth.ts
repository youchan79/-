import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { config } from './config.ts';
import { one, run, nowIso } from './db.ts';

const SESSION_COOKIE = 'sid';
const ANON_COOKIE = 'aid';
const SESSION_DAYS = 60;

export interface User {
  id: string;
  email: string;
  phone: string | null;
  created_at: string;
}

export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

function sign(value: string): string {
  return crypto.createHmac('sha256', config.sessionSecret).update(value).digest('base64url');
}

function cookieOpts(maxAgeDays: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.isProd,
    maxAge: maxAgeDays * 86400_000,
    path: '/',
  };
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

export function setSession(res: Response, userId: string) {
  const exp = Date.now() + SESSION_DAYS * 86400_000;
  const payload = `${userId}.${exp}`;
  res.cookie(SESSION_COOKIE, `${payload}.${sign(payload)}`, cookieOpts(SESSION_DAYS));
}

export function clearSession(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

const OAUTH_COOKIE = 'oauth_state';
const OAUTH_MINUTES = 10;

/** 카카오·네이버 로그인 왕복용 state를 만들어 10분짜리 서명 쿠키에 넣는다 (CSRF 방지). 돌아갈 주소도 같이 둔다. */
export function startOauthState(res: Response, provider: string, next: string): string {
  const state = crypto.randomBytes(18).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ p: provider, s: state, n: next, e: Date.now() + OAUTH_MINUTES * 60_000 })).toString('base64url');
  res.cookie(OAUTH_COOKIE, `${payload}.${sign(payload)}`, { ...cookieOpts(1), maxAge: OAUTH_MINUTES * 60_000 });
  return state;
}

/** 콜백에서 쿠키의 state와 돌아온 state가 같은지 본다. 한 번 쓰면 지운다. 맞지 않으면 null. */
export function takeOauthState(req: Request, res: Response, provider: string, state: unknown): { next: string } | null {
  res.clearCookie(OAUTH_COOKIE, { path: '/' });
  const [payload, sig] = (parseCookies(req)[OAUTH_COOKIE] ?? '').split('.');
  if (!payload || !sig || typeof state !== 'string') return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const v = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (v.p !== provider || v.e < Date.now() || Buffer.byteLength(state) !== Buffer.byteLength(v.s)) return null;
  if (!crypto.timingSafeEqual(Buffer.from(state), Buffer.from(v.s))) return null;
  return { next: v.n };
}

function readSession(req: Request): { userId: string; exp: number } | null {
  const raw = parseCookies(req)[SESSION_COOKIE];
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  const expected = sign(`${userId}.${exp}`);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Number(exp) < Date.now()) return null;
  return { userId, exp: Number(exp) };
}

/* ---------- 이 기기에서 마지막으로 쓴 로그인 방법 (다시 로그인할 때 그 버튼을 맨 위에) ----------
   화면이 읽는 쿠키라 httpOnly가 아니다. 토큰 없이 방법과 가린 계정만 담는다. 'none'은 지운 상태. */
const HINT_COOKIE = 'last_login';
export type HintProvider = 'kakao' | 'naver' | 'google' | 'email';

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, local.length > 2 ? 2 : 1)}***@${domain}`;
}

export function maskName(name: string): string {
  const c = [...name.trim()];
  return c.length <= 1 ? '*' : c.length === 2 ? `${c[0]}*` : `${c[0]}${'*'.repeat(c.length - 2)}${c[c.length - 1]}`;
}

const hintOpts = () => ({ ...cookieOpts(365), httpOnly: false });

export function setLoginHint(res: Response, p: HintProvider, label: string) {
  res.cookie(HINT_COOKIE, JSON.stringify({ p, m: label }), hintOpts());
}

/** 로그아웃: 세션은 지우지만 힌트는 남기고 '로그아웃함' 표시만 붙인다 (구글 자동 로그인이 바로 다시 되지 않게). */
export function markHintSignedOut(req: Request, res: Response) {
  try {
    const v = JSON.parse(parseCookies(req)[HINT_COOKIE] ?? '');
    if (v?.p) res.cookie(HINT_COOKIE, JSON.stringify({ p: v.p, m: v.m, out: 1 }), hintOpts());
  } catch {
    /* 힌트가 없거나 지운 상태 */
  }
}

export function clearLoginHint(res: Response) {
  res.cookie(HINT_COOKIE, 'none', hintOpts());
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
      anonId: string;
    }
  }
}

/** 모든 요청에 익명 ID와 로그인 사용자를 붙인다. */
export function attachIdentity(req: Request, res: Response, next: NextFunction) {
  const cookies = parseCookies(req);
  let anonId = cookies[ANON_COOKIE];
  if (!anonId || !/^[a-zA-Z0-9_-]{10,40}$/.test(anonId)) {
    anonId = crypto.randomBytes(12).toString('base64url');
    res.cookie(ANON_COOKIE, anonId, cookieOpts(365));
  }
  req.anonId = anonId;
  const session = readSession(req);
  if (session) {
    const user = one<User>('SELECT id, email, phone, created_at FROM users WHERE id = ?', session.userId);
    if (user) {
      req.user = user;
      // 쓰는 동안은 로그인이 풀리지 않게, 하루에 한 번까지 만료일을 60일 뒤로 다시 민다
      if (session.exp - Date.now() < (SESSION_DAYS - 1) * 86400_000) setSession(res, user.id);
    }
  }
  next();
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return;
  }
  next();
}

export function createUser(email: string, password: string): User {
  const user: User = { id: 'usr_' + crypto.randomUUID(), email, phone: null, created_at: nowIso() };
  run(
    'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
    user.id,
    user.email,
    hashPassword(password),
    user.created_at,
  );
  return user;
}

export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const e = email.trim().toLowerCase();
  if (e.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return e;
}
