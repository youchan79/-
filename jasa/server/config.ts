import type { AppConfig } from '../src/types.ts';

const env = (key: string) => process.env[key]?.trim() ?? '';
const int = (key: string, fallback: number) => {
  const n = Number.parseInt(env(key), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const config = {
  port: int('PORT', 3000),
  geminiApiKey: env('GEMINI_API_KEY'),
  geminiModel: env('GEMINI_MODEL') || 'gemini-flash-latest',
  supabase:
    env('SUPABASE_URL') && env('SUPABASE_ANON_KEY') && env('SUPABASE_SERVICE_ROLE_KEY')
      ? { url: env('SUPABASE_URL'), anonKey: env('SUPABASE_ANON_KEY'), serviceRoleKey: env('SUPABASE_SERVICE_ROLE_KEY') }
      : null,
  toss:
    env('TOSS_CLIENT_KEY') && env('TOSS_SECRET_KEY')
      ? { clientKey: env('TOSS_CLIENT_KEY'), secretKey: env('TOSS_SECRET_KEY') }
      : null,
  freeDailyLimit: int('FREE_DAILY_LIMIT', 10),
  proPrice: int('PRO_PRICE', 9900),
  proDays: 30,
};

/** 브라우저에 내려줘도 되는 설정만 모음 */
export function publicConfig(): AppConfig {
  return {
    aiReady: Boolean(config.geminiApiKey),
    auth: config.supabase && { url: config.supabase.url, anonKey: config.supabase.anonKey },
    // 결제는 사용자 계정에 요금제를 기록해야 하므로 로그인 설정이 있을 때만 켬
    toss: config.toss && config.supabase ? { clientKey: config.toss.clientKey } : null,
    freeDailyLimit: config.freeDailyLimit,
    proPrice: config.proPrice,
  };
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
