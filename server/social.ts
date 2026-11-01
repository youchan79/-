import crypto from 'node:crypto';
import { config } from './config.ts';
import { one, run, tx, nowIso } from './db.ts';
import type { User } from './auth.ts';

/**
 * 소셜 로그인 (외부 라이브러리 없음)
 * - 구글: 브라우저가 받은 ID 토큰(JWT)을 구글 공개 키로 직접 검증한다.
 * - 카카오·네이버: 인가 코드 방식. 서버가 코드를 토큰으로 바꾸고 회원 정보를 받아 온다.
 * 가짜 모드(config.social.mock, 개발 전용)에서는 구글은 서버가 만든 테스트 키, 카카오·네이버는 이 서버의 가짜 주소를 쓴다.
 */

export type Provider = 'google' | 'kakao' | 'naver';
export type OauthProvider = 'kakao' | 'naver';

/** code는 카카오·네이버 콜백이 화면에 오류 종류를 알려 줄 때 쓴다 (주소에 문구 대신 코드만 싣는다). */
export class SocialError extends Error {
  constructor(message: string, public code: 'failed' | 'email_taken' = 'failed') {
    super(message);
  }
}

export interface SocialProfile {
  provider: Provider;
  subject: string; // 제공자의 회원 번호
  email: string | null;
  emailVerified: boolean; // true일 때만 같은 이메일의 기존 계정에 연결한다
  name: string | null;
}

const cleanEmail = (v: unknown) => (typeof v === 'string' && v.includes('@') ? v.trim().toLowerCase().slice(0, 100) : null);
const cleanName = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 60) : null);

/* ================= 구글 (ID 토큰) ================= */

const GOOGLE = {
  jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
  issuers: ['https://accounts.google.com', 'accounts.google.com'],
};

type Jwk = crypto.JsonWebKey & { kid?: string };
let jwksCache: { keys: Jwk[]; expiresAt: number; fetchedAt: number } | null = null;

async function fetchGoogleKeys(): Promise<Jwk[]> {
  const res = await fetch(GOOGLE.jwksUrl);
  if (!res.ok) throw new SocialError('로그인 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
  const keys = ((await res.json()) as { keys?: Jwk[] }).keys ?? [];
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  jwksCache = { keys, expiresAt: Date.now() + maxAge * 1000, fetchedAt: Date.now() };
  return keys;
}

async function findGoogleKey(kid: string): Promise<Jwk | undefined> {
  if (config.social.mock) return kid === mockKeys().jwk.kid ? mockKeys().jwk : undefined;
  let keys = jwksCache && jwksCache.expiresAt > Date.now() ? jwksCache.keys : await fetchGoogleKeys();
  // 구글이 키를 바꿨을 수 있다. 1분에 한 번까지만 다시 받는다.
  if (!keys.some((k) => k.kid === kid) && Date.now() - (jwksCache?.fetchedAt ?? 0) > 60_000) keys = await fetchGoogleKeys();
  return keys.find((k) => k.kid === kid);
}

function decodePart(part: string): any {
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    throw new SocialError('로그인 정보가 올바르지 않아요.');
  }
}

/** 서명·발급처(iss)·대상(aud)·만료(exp)·이메일 인증을 모두 확인한다. */
export async function googleProfile(token: unknown): Promise<SocialProfile> {
  const audience = config.social.googleClientId;
  if (!audience) throw new SocialError('이 로그인 방법은 아직 준비 중이에요.');
  const parts = typeof token === 'string' && token.length < 8000 ? token.split('.') : [];
  if (parts.length !== 3) throw new SocialError('로그인 정보가 올바르지 않아요.');
  const [h, b, s] = parts;
  const header = decodePart(h);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new SocialError('로그인 정보가 올바르지 않아요.');
  const jwk = await findGoogleKey(header.kid);
  const key = jwk && crypto.createPublicKey({ key: jwk, format: 'jwk' });
  if (!key || !crypto.verify('sha256', Buffer.from(`${h}.${b}`), key, Buffer.from(s, 'base64url'))) {
    throw new SocialError('로그인 정보를 확인하지 못했어요. 다시 시도해 주세요.');
  }

  const c = decodePart(b);
  const now = Math.floor(Date.now() / 1000);
  if (!GOOGLE.issuers.includes(c.iss)) throw new SocialError('로그인 정보의 발급처가 맞지 않아요.');
  if (!(Array.isArray(c.aud) ? c.aud : [c.aud]).includes(audience)) throw new SocialError('다른 서비스용 로그인 정보예요.');
  if (typeof c.exp !== 'number' || c.exp < now - 60) throw new SocialError('로그인 시간이 지났어요. 다시 시도해 주세요.');
  if (typeof c.iat === 'number' && c.iat > now + 300) throw new SocialError('로그인 정보가 올바르지 않아요.');
  if (typeof c.sub !== 'string' || !c.sub) throw new SocialError('로그인 정보가 올바르지 않아요.');
  const email = cleanEmail(c.email);
  if (!email || !(c.email_verified === true || c.email_verified === 'true')) {
    throw new SocialError('구글 계정의 이메일 인증이 안 되어 있어요. 다른 방법으로 가입해 주세요.');
  }
  return { provider: 'google', subject: c.sub, email, emailVerified: true, name: cleanName(c.name) };
}

/* ================= 카카오·네이버 (인가 코드) ================= */

// 가짜 모드에서는 같은 서버의 가짜 주소로 보낸다 (아래 mock 경로들)
const self = () => `http://127.0.0.1:${config.port}/api/auth/mock`;

const OAUTH = {
  kakao: {
    authorize: () => (config.social.mock ? '/api/auth/mock/authorize?provider=kakao&' : 'https://kauth.kakao.com/oauth/authorize?'),
    token: () => (config.social.mock ? `${self()}/token` : 'https://kauth.kakao.com/oauth/token'),
    me: () => (config.social.mock ? `${self()}/me?provider=kakao` : 'https://kapi.kakao.com/v2/user/me'),
    clientId: () => config.social.kakaoRestApiKey,
    clientSecret: () => config.social.kakaoClientSecret,
  },
  naver: {
    authorize: () => (config.social.mock ? '/api/auth/mock/authorize?provider=naver&' : 'https://nid.naver.com/oauth2.0/authorize?'),
    token: () => (config.social.mock ? `${self()}/token` : 'https://nid.naver.com/oauth2.0/token'),
    me: () => (config.social.mock ? `${self()}/me?provider=naver` : 'https://openapi.naver.com/v1/nid/me'),
    clientId: () => config.social.naverClientId,
    clientSecret: () => config.social.naverClientSecret,
  },
};

export function oauthEnabled(p: OauthProvider): boolean {
  return p === 'kakao' ? !!config.social.kakaoRestApiKey : !!(config.social.naverClientId && config.social.naverClientSecret);
}

/** mobile이면 네이버는 appscheme=true를 붙인다: 네이버 로그인 화면에 '네이버 앱으로 자동로그인' 버튼이 생긴다 (네이버 공식 가이드 5.3). */
export function oauthAuthorizeUrl(p: OauthProvider, redirectUri: string, state: string, mobile = false): string {
  const q = new URLSearchParams({ response_type: 'code', client_id: OAUTH[p].clientId(), redirect_uri: redirectUri, state });
  if (p === 'naver' && mobile) q.set('appscheme', 'true');
  return OAUTH[p].authorize() + q.toString();
}

/** 인가 코드를 토큰으로 바꾸고 회원 정보를 받아 온다. */
export async function oauthProfile(p: OauthProvider, code: string, redirectUri: string, state: string): Promise<SocialProfile> {
  const o = OAUTH[p];
  const params = new URLSearchParams({ grant_type: 'authorization_code', client_id: o.clientId(), redirect_uri: redirectUri, code });
  if (p === 'naver') params.set('state', state);
  if (o.clientSecret()) params.set('client_secret', o.clientSecret());
  const tokenRes = await fetch(o.token(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: params,
  });
  const t = (await tokenRes.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string };
  if (!tokenRes.ok || !t.access_token) {
    console.error(`[social] ${p} 토큰 교환 실패`, tokenRes.status, t.error, t.error_description);
    throw new SocialError('로그인하지 못했어요. 다시 시도해 주세요.');
  }

  const meRes = await fetch(o.me(), { headers: { Authorization: `Bearer ${t.access_token}` } });
  const me = (await meRes.json().catch(() => ({}))) as any;
  if (!meRes.ok) {
    console.error(`[social] ${p} 회원 정보 실패`, meRes.status, me?.msg ?? me?.message);
    throw new SocialError('로그인하지 못했어요. 다시 시도해 주세요.');
  }

  if (p === 'kakao') {
    // 이메일은 비즈 앱 + 이메일 동의를 받았을 때만 온다. 유효·인증 둘 다 true일 때만 확인된 이메일로 본다.
    const a = me.kakao_account ?? {};
    if (me.id === undefined || me.id === null) throw new SocialError('로그인하지 못했어요. 다시 시도해 주세요.');
    return {
      provider: 'kakao',
      subject: String(me.id),
      email: cleanEmail(a.email),
      emailVerified: a.is_email_valid === true && a.is_email_verified === true,
      name: cleanName(a.profile?.nickname ?? me.properties?.nickname),
    };
  }
  // 네이버는 이메일 인증 여부를 알려 주지 않는다 → 확인 안 된 이메일로 다룬다 (기존 계정에 자동 연결하지 않음)
  const r = me.response ?? {};
  if (me.resultcode !== '00' || typeof r.id !== 'string' || !r.id) throw new SocialError('로그인하지 못했어요. 다시 시도해 주세요.');
  return { provider: 'naver', subject: r.id, email: cleanEmail(r.email), emailVerified: false, name: cleanName(r.name ?? r.nickname) };
}

/* ================= 계정 찾기·연결·만들기 ================= */

/**
 * 1) 같은 제공자·회원 번호로 연결된 계정이 있으면 그 계정
 * 2) 확인된 이메일이고 그 이메일로 가입한 계정이 있으면 그 계정에 연결
 * 3) 없으면 새로 가입 (isNew: true → 가입 기록과 CompleteRegistration을 보낸다)
 *    확인 안 된 이메일이 이미 다른 계정 것이면 연결도 가입도 하지 않는다.
 */
export function findOrCreateSocialUser(p: SocialProfile): { user: User; isNew: boolean } {
  return tx(() => {
    const linked = one<User>(
      `SELECT u.id, u.email, u.phone, u.created_at FROM user_identities i JOIN users u ON u.id = i.user_id
       WHERE i.provider = ? AND i.subject = ?`,
      p.provider,
      p.subject,
    );
    if (linked) return { user: linked, isNew: false };

    const link = (userId: string) =>
      run(
        'INSERT INTO user_identities (provider, subject, user_id, email, name, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        p.provider,
        p.subject,
        userId,
        p.email,
        p.name,
        nowIso(),
      );

    const existing = p.email ? one<User>('SELECT id, email, phone, created_at FROM users WHERE email = ?', p.email) : undefined;
    if (existing && p.emailVerified) {
      link(existing.id);
      return { user: existing, isNew: false };
    }
    if (existing) throw new SocialError('이미 이 이메일로 가입된 계정이 있어요. 처음 가입한 방법으로 로그인해 주세요.', 'email_taken');

    // 이메일을 못 받으면(카카오 비즈 앱 전 등) 겹치지 않는 자리표시 주소를 쓴다. 실제로 메일을 보내지 않는다.
    const hash = crypto.createHash('sha256').update(`${p.provider}:${p.subject}`).digest('hex').slice(0, 16);
    const user: User = { id: 'usr_' + crypto.randomUUID(), email: p.email ?? `${p.provider}_${hash}@no-email.invalid`, phone: null, created_at: nowIso() };
    run("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, '', ?)", user.id, user.email, user.created_at);
    link(user.id);
    return { user, isNew: true };
  });
}

/* ================= 개발용 가짜 모드 (SOCIAL_LOGIN_MOCK=1, 운영에서는 꺼짐) ================= */

let mockKeyPair: { privateKey: crypto.KeyObject; jwk: Jwk } | null = null;
function mockKeys() {
  if (!config.social.mock) throw new SocialError('가짜 로그인은 개발 환경에서만 써요.');
  if (!mockKeyPair) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    mockKeyPair = { privateKey, jwk: { ...publicKey.export({ format: 'jwk' }), kid: 'mock-key', alg: 'RS256' } as Jwk };
  }
  return mockKeyPair;
}

/** 진짜 구글과 같은 모양의 ID 토큰을 테스트 키로 만든다. 거절 경우를 시험하려고 aud·iss·exp도 바꿀 수 있다. */
export function mockGoogleToken(o: { email?: string; sub?: string; emailVerified?: boolean; aud?: string; iss?: string; expiresIn?: number }) {
  const { privateKey, jwk } = mockKeys();
  const email = o.email?.trim().toLowerCase() || 'test@gmail.com';
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: o.iss ?? GOOGLE.issuers[0],
    aud: o.aud ?? config.social.googleClientId,
    sub: o.sub || 'mock-' + crypto.createHash('sha256').update(email).digest('hex').slice(0, 16),
    email,
    email_verified: o.emailVerified ?? true,
    iat: now,
    exp: now + (o.expiresIn ?? 600),
  };
  const enc = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const data = `${enc({ alg: 'RS256', kid: jwk.kid, typ: 'JWT' })}.${enc(claims)}`;
  return `${data}.${crypto.sign('sha256', Buffer.from(data), privateKey).toString('base64url')}`;
}

/** 가짜 카카오·네이버 회원. 인가 코드와 액세스 토큰에 그대로 싣는다 (개발 전용). */
export interface MockOauthUser {
  provider: OauthProvider;
  id: string;
  email: string | null;
  verified: boolean;
}
/** 가짜 인가 코드. 회원 번호를 안 주면 이메일로 늘 같은 숫자 번호를 만든다 (같은 사람 → 같은 번호). */
export function mockOauthCode(provider: OauthProvider, email: string | null, verified: boolean, id?: string): string {
  mockKeys(); // 가짜 모드가 아니면 여기서 막힌다
  const uid = id || String(parseInt(crypto.createHash('sha256').update(`${provider}:${email ?? ''}`).digest('hex').slice(0, 10), 16));
  const u: MockOauthUser = { provider, id: uid, email: email?.toLowerCase() ?? null, verified };
  return Buffer.from(JSON.stringify(u)).toString('base64url');
}
export function decodeMockUser(v: unknown): MockOauthUser | null {
  if (!config.social.mock || typeof v !== 'string') return null;
  try {
    return JSON.parse(Buffer.from(v, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/** 진짜 카카오·네이버 회원 정보 응답과 같은 모양 */
export function mockMeResponse(u: MockOauthUser) {
  if (u.provider === 'kakao') {
    return {
      id: Number(u.id),
      properties: { nickname: '테스트' },
      kakao_account: u.email
        ? { has_email: true, email: u.email, is_email_valid: u.verified, is_email_verified: u.verified, profile: { nickname: '테스트' } }
        : { has_email: false, profile: { nickname: '테스트' } },
    };
  }
  return { resultcode: '00', message: 'success', response: { id: u.id, name: '테스트', ...(u.email ? { email: u.email } : {}) } };
}

export const mockClientOk = (p: OauthProvider, clientId: unknown, secret: unknown) =>
  clientId === OAUTH[p].clientId() && (p === 'kakao' ? !config.social.kakaoClientSecret || secret === config.social.kakaoClientSecret : secret === OAUTH[p].clientSecret());
