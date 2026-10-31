import 'dotenv/config';
import path from 'node:path';

function str(name: string, fallback = ''): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const isProd = process.env.NODE_ENV === 'production';

const tossClientKey = str('TOSS_CLIENT_KEY');
const tossSecretKey = str('TOSS_SECRET_KEY');

export const config = {
  isProd,
  port: num('PORT', 3000),
  appUrl: str('APP_URL').replace(/\/$/, ''),
  dataDir: path.resolve(str('DATA_DIR', './data')),
  sessionSecret: str('SESSION_SECRET', isProd ? '' : 'dev-session-secret-change-me'),
  adminKey: str('ADMIN_KEY', isProd ? '' : 'dev-admin'),
  cronSecret: str('CRON_SECRET'),

  plan: {
    name: str('PLAN_NAME', 'AI 사주 월 구독'),
    price: num('PLAN_PRICE', 9900),
    days: num('PLAN_DAYS', 30),
    chatDailyLimit: num('CHAT_DAILY_LIMIT', 20),
    reportMonthlyLimit: num('REPORT_MONTHLY_LIMIT', 10),
  },

  // auto: 카드 등록 후 매월 자동결제 (토스 자동결제 추가 계약 필요)
  // pass: 30일 이용권 단건결제 (일반 카드결제 계약만으로 가능, 자동 갱신 없음)
  billingMode: (str('BILLING_MODE', 'auto') === 'pass' ? 'pass' : 'auto') as 'auto' | 'pass',
  renewalIntervalMin: num('RENEWAL_INTERVAL_MIN', 60),
  renewalMaxRetries: num('RENEWAL_MAX_RETRIES', 3),

  toss: {
    clientKey: tossClientKey,
    secretKey: tossSecretKey,
  },
  // 토스 키가 없으면 개발 환경에서만 가짜 결제로 흐름을 테스트한다.
  paymentProvider: (tossClientKey && tossSecretKey ? 'toss' : isProd ? 'none' : 'mock') as
    | 'toss'
    | 'mock'
    | 'none',

  gemini: {
    apiKey: str('GEMINI_API_KEY'),
    model: str('GEMINI_MODEL', 'gemini-2.5-flash'),
    // 비우면 thinkingConfig를 보내지 않는다. 2.5 Flash는 0이면 생각 토큰을 쓰지 않아 원가가 낮다.
    thinkingBudget: str('GEMINI_THINKING_BUDGET', '0'),
    priceInputPerMUsd: num('AI_PRICE_INPUT_PER_M_USD', 0.3),
    priceOutputPerMUsd: num('AI_PRICE_OUTPUT_PER_M_USD', 2.5),
    usdKrw: num('USD_KRW', 1400),
  },

  meta: {
    pixelId: str('META_PIXEL_ID'),
    capiToken: str('META_CAPI_TOKEN'),
    testEventCode: str('META_TEST_EVENT_CODE'),
    graphVersion: str('META_GRAPH_VERSION', 'v21.0'),
  },

  business: {
    serviceName: str('SERVICE_NAME', '오늘사주'),
    name: str('BIZ_NAME', '(상호 입력 필요)'),
    owner: str('BIZ_OWNER', '(대표자 입력 필요)'),
    regNo: str('BIZ_REG_NO', '(사업자등록번호 입력 필요)'),
    mailOrderNo: str('BIZ_MAIL_ORDER_NO', '(통신판매업 신고번호 입력 필요)'),
    address: str('BIZ_ADDRESS', '(사업장 주소 입력 필요)'),
    phone: str('BIZ_PHONE', '(연락처 입력 필요)'),
    email: str('BIZ_EMAIL', '(이메일 입력 필요)'),
    privacyOfficer: str('BIZ_PRIVACY_OFFICER', str('BIZ_OWNER', '(개인정보 보호책임자 입력 필요)')),
  },
};

export function assertProdConfig() {
  if (!config.isProd) return;
  const missing: string[] = [];
  if (!config.sessionSecret) missing.push('SESSION_SECRET');
  if (!config.adminKey) missing.push('ADMIN_KEY');
  if (!config.appUrl) missing.push('APP_URL');
  if (!config.gemini.apiKey) missing.push('GEMINI_API_KEY');
  if (config.paymentProvider !== 'toss') missing.push('TOSS_CLIENT_KEY/TOSS_SECRET_KEY');
  if (missing.length) {
    throw new Error(`운영 환경 필수 설정이 비어 있습니다: ${missing.join(', ')}`);
  }
}
