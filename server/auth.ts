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
  customer_key: string;
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

function readSession(req: Request): string | null {
  const raw = parseCookies(req)[SESSION_COOKIE];
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  const expected = sign(`${userId}.${exp}`);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Number(exp) < Date.now()) return null;
  return userId;
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
  const userId = readSession(req);
  if (userId) {
    const user = one<User>('SELECT id, email, customer_key, created_at FROM users WHERE id = ?', userId);
    if (user) req.user = user;
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
  const user: User = {
    id: 'usr_' + crypto.randomUUID(),
    email,
    customer_key: 'cus_' + crypto.randomUUID(),
    created_at: nowIso(),
  };
  run(
    'INSERT INTO users (id, email, password_hash, customer_key, created_at) VALUES (?, ?, ?, ?, ?)',
    user.id,
    user.email,
    hashPassword(password),
    user.customer_key,
    user.created_at,
  );
  return user;
}

/** 로그인 전에 만든 사주 결과를 계정에 연결한다. */
export function claimAnonReadings(anonId: string, userId: string) {
  run('UPDATE readings SET user_id = ? WHERE anon_id = ? AND user_id IS NULL', userId, anonId);
}

export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const e = email.trim().toLowerCase();
  if (e.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return e;
}
