export type Element = '목' | '화' | '토' | '금' | '수';

export interface Pillar {
  key: 'time' | 'day' | 'month' | 'year';
  label: string;
  gan: string;
  zhi: string;
  ganKo: string;
  zhiKo: string;
  ganElement: Element;
  zhiElement: Element;
  ganYang: boolean;
  zhiYang: boolean;
  ganTenGod: string;
  zhiTenGod: string;
}

export interface Chart {
  solarDate: string;
  lunarDate: string;
  timeKnown: boolean;
  zodiac: string;
  age: number;
  pillars: Pillar[];
  elementCounts: Record<Element, number>;
  dayMaster: { gan: string; ko: string; element: Element; yang: boolean };
  daYun: Array<{ ganzhi: string; ganzhiKo: string; startAge: number; startYear: number }>;
  currentDaYun: { ganzhi: string; ganzhiKo: string; startAge: number; startYear: number } | null;
}

export interface AppConfig {
  serviceName: string;
  pixelId: string | null;
  plan: { name: string; price: number; days: number; chatDailyLimit: number; reportMonthlyLimit: number };
  billingMode: 'auto' | 'pass';
  paymentProvider: 'toss' | 'mock' | 'none';
  aiMode: 'gemini' | 'mock';
  business: Record<string, string>;
}

export interface Subscription {
  mode: 'auto' | 'pass';
  status: string;
  active: boolean;
  amount: number;
  cardLabel: string | null;
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface Me {
  user: { email: string } | null;
  subscription: Subscription | null;
}

export interface ReadingResponse {
  id: string;
  name: string;
  gender: 'M' | 'F';
  calendar: 'solar' | 'lunar';
  birthDate: string;
  birthTime: string | null;
  chart: Chart;
  preview: { dayMasterTitle: string; dayMasterSummary: string; keywords: string[]; elementNotes: string[] };
  sections: Array<{ title: string; hint: string }>;
  access: boolean;
  report: { status: 'none' | 'generating' | 'done' | 'error'; md: string } | null;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T = any>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
    ...init,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json?.error || '일시적인 오류가 발생했습니다.', res.status);
  return json as T;
}

export const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

export function formatKstDate(iso: string) {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
}
