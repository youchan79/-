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

const payapp = {
  userid: str('PAYAPP_USERID'),
  linkkey: str('PAYAPP_LINKKEY'),
  linkval: str('PAYAPP_LINKVAL'),
  // 판매자 사이트 > 설정 > 연동 정보의 '결제 KEY'. API 요청 해시와 결제통보 해시에 쓴다.
  requestkey: str('PAYAPP_REQUESTKEY'),
  shopname: str('PAYAPP_SHOPNAME', str('SERVICE_NAME', '스터디AI')),
};

export const config = {
  isProd,
  port: num('PORT', 3000),
  appUrl: str('APP_URL').replace(/\/$/, ''),
  dataDir: path.resolve(str('DATA_DIR', './data')),
  sessionSecret: str('SESSION_SECRET', isProd ? '' : 'dev-session-secret-change-me'),
  adminKey: str('ADMIN_KEY', isProd ? '' : 'dev-admin'),
  serviceName: str('SERVICE_NAME', '스터디AI'),

  plans: {
    monthly: { name: str('PLAN_MONTHLY_NAME', '스터디AI Pro 월간'), price: num('PLAN_MONTHLY_PRICE', 9900) },
    yearly: { name: str('PLAN_YEARLY_NAME', '스터디AI Pro 연간'), price: num('PLAN_YEARLY_PRICE', 82800) },
  },

  free: {
    weeklyFiles: num('FREE_WEEKLY_FILES', 2), // PDF, PPT, Word, 이미지
    weeklyYoutube: num('FREE_WEEKLY_YOUTUBE', 2),
    dailyTutor: num('FREE_DAILY_TUTOR', 10),
    weeklyExams: num('FREE_WEEKLY_EXAMS', 1),
    maxFileMb: num('FREE_MAX_FILE_MB', 50),
  },
  pro: {
    maxFileMb: num('PRO_MAX_FILE_MB', 1024),
  },

  payapp,
  // 페이앱 키가 없으면 개발 환경에서만 가짜 결제창으로 흐름을 테스트한다.
  paymentProvider: (payapp.userid && payapp.linkkey && payapp.linkval && payapp.requestkey
    ? 'payapp'
    : isProd
      ? 'none'
      : 'mock') as 'payapp' | 'mock' | 'none',

  gemini: {
    apiKey: str('GEMINI_API_KEY'),
    model: str('GEMINI_MODEL', 'gemini-2.5-flash'),
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
    serviceName: str('SERVICE_NAME', '스터디AI'),
    name: str('BIZ_NAME', '(상호 입력 필요)'),
    owner: str('BIZ_OWNER', '(대표자 입력 필요)'),
    regNo: str('BIZ_REG_NO', ''),
    mailOrderNo: str('BIZ_MAIL_ORDER_NO', ''),
    address: str('BIZ_ADDRESS', '(주소 입력 필요)'),
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
  if (config.paymentProvider !== 'payapp') missing.push('PAYAPP_USERID/LINKKEY/LINKVAL/REQUESTKEY');
  if (missing.length) throw new Error(`운영 환경 필수 설정이 비어 있습니다: ${missing.join(', ')}`);
}
