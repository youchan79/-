import { createClient } from '@supabase/supabase-js';
import type { Request } from 'express';
import type { Account } from '../src/types.ts';
import { config, HttpError } from './config.ts';

/** 서버 전용(service role) 클라이언트. 로컬 모드에서는 null */
export const admin = config.supabase
  ? createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

/** 사용량은 한국 날짜 기준으로 하루씩 셈 */
function today() {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** 요청한 사용자 id. 로컬 모드에서는 null */
export async function authenticate(req: Request): Promise<string | null> {
  if (!admin) return null;
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, '로그인이 필요해요.');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, '로그인이 만료됐어요. 다시 로그인해 주세요.');
  return data.user.id;
}

export async function getAccount(userId: string | null): Promise<Account> {
  if (!admin || !userId) return { plan: 'free', proUntil: null, usedToday: 0, limit: null };
  const [profile, usage] = await Promise.all([
    admin.from('profiles').select('pro_until').eq('id', userId).maybeSingle(),
    admin.from('usage').select('count').eq('user_id', userId).eq('day', today()).maybeSingle(),
  ]);
  if (profile.error) throw profile.error;
  if (usage.error) throw usage.error;
  const proUntil: string | null = profile.data?.pro_until ?? null;
  const pro = proUntil !== null && new Date(proUntil) > new Date();
  return {
    plan: pro ? 'pro' : 'free',
    proUntil,
    usedToday: usage.data?.count ?? 0,
    limit: pro ? null : config.freeDailyLimit,
  };
}

/** AI 사용 1회를 차감. 무료 한도를 넘으면 429. 차감했으면 true */
export async function consumeCredit(userId: string | null): Promise<boolean> {
  if (!admin || !userId) return false;
  const account = await getAccount(userId);
  if (account.limit === null) return false;
  const { data, error } = await admin.rpc('consume_ai_credit', { p_user: userId, p_day: today(), p_limit: account.limit });
  if (error) throw error;
  if (!data) {
    throw new HttpError(429, `오늘 무료 사용 횟수(${account.limit}회)를 다 썼어요. 내일 다시 이용하거나 프로로 업그레이드하세요.`);
  }
  return true;
}

/** AI 호출이 실패했을 때 차감한 1회를 되돌림 */
export async function refundCredit(userId: string | null) {
  if (!admin || !userId) return;
  const { error } = await admin.rpc('refund_ai_credit', { p_user: userId, p_day: today() });
  if (error) console.error('사용량 환불 실패', error);
}

/** 프로 기간을 연장(남은 기간이 있으면 그 뒤로 이어 붙임) */
export async function extendPro(userId: string, days: number) {
  if (!admin) return;
  const { data, error } = await admin.from('profiles').select('pro_until').eq('id', userId).maybeSingle();
  if (error) throw error;
  const current = data?.pro_until ? new Date(data.pro_until).getTime() : 0;
  const from = Math.max(current, Date.now());
  const { error: upsertError } = await admin
    .from('profiles')
    .upsert({ id: userId, pro_until: new Date(from + days * 86400_000).toISOString() });
  if (upsertError) throw upsertError;
}
