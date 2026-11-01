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

  // 단건 결제 하나: 한 번 결제하면 평생 Pro
  plans: {
    lifetime: { name: str('PLAN_LIFETIME_NAME', '스터디AI Pro 평생 이용권'), price: num('PLAN_LIFETIME_PRICE', 9900) },
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
    // 평생 이용권의 공정 사용 상한 (한 달 업로드 수). 0이면 제한 없음.
    monthlyUploads: num('PRO_MONTHLY_UPLOADS', 0),
  },

  payapp,
  // 페이앱 키가 없으면 개발 환경에서만 가짜 결제창으로 흐름을 테스트한다.
  paymentProvider: (payapp.userid && payapp.linkkey && payapp.linkval && payapp.requestkey
    ? 'payapp'
    : isProd
      ? 'none'
      : 'mock') as 'payapp' | 'mock' | 'none',

  // 학습 자료 생성, PDF·사진 읽기, 튜터는 모두 Claude
  claude: {
    apiKey: str('ANTHROPIC_API_KEY'),
    model: str('CLAUDE_MODEL', 'claude-haiku-5-5'),
    // 단가 (USD / 100만 토큰). Claude Haiku 5.5: 프롬프트 10만 토큰 이하 0.10/0.50, 초과 0.50/2.50
    priceInput: num('AI_PRICE_INPUT_PER_M_USD', 0.1),
    priceOutput: num('AI_PRICE_OUTPUT_PER_M_USD', 0.5),
    priceInputLong: num('AI_PRICE_INPUT_LONG_PER_M_USD', 0.5),
    priceOutputLong: num('AI_PRICE_OUTPUT_LONG_PER_M_USD', 2.5),
    longPromptTokens: num('AI_LONG_PROMPT_TOKENS', 100_000),
    usdKrw: num('USD_KRW', 1400),
  },

  // 선택: 녹음 파일과 유튜브 영상을 직접 받아 적을 때만 쓴다 (Claude는 소리와 영상을 읽지 못함)
  gemini: {
    apiKey: str('GEMINI_API_KEY'),
    model: str('GEMINI_MODEL', 'gemini-2.5-flash'),
    priceInput: num('GEMINI_PRICE_INPUT_PER_M_USD', 0.3),
    priceOutput: num('GEMINI_PRICE_OUTPUT_PER_M_USD', 2.5),
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
  if (!config.claude.apiKey) missing.push('ANTHROPIC_API_KEY');
  if (missing.length) throw new Error(`운영 환경 필수 설정이 비어 있습니다: ${missing.join(', ')}`);
  // 페이앱 키는 나중에 넣어도 된다. 그 전까지 결제 버튼만 막힌다.
  if (config.paymentProvider !== 'payapp') console.warn('[config] 페이앱 키가 없어 결제가 꺼져 있어요 (PAYAPP_USERID/LINKKEY/LINKVAL/REQUESTKEY)');
}
