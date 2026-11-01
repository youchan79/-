export type DocKind = 'pdf' | 'docx' | 'pptx' | 'youtube' | 'audio' | 'image' | 'memo';
export type MaterialKind = 'summary' | 'mindmap' | 'memorize' | 'concepts';

export interface AppConfig {
  serviceName: string;
  pixelId: string | null;
  plans: { monthly: { name: string; price: number }; yearly: { name: string; price: number } };
  media: { audioFile: boolean; youtubeAuto: boolean };
  free: { weeklyFiles: number; weeklyYoutube: number; dailyTutor: number; weeklyExams: number; maxFileMb: number };
  paymentProvider: 'payapp' | 'mock' | 'none';
  aiMode: 'claude' | 'mock';
  business: Record<string, string>;
  // 소셜 로그인: 구글은 클라이언트 ID(null이면 숨김), 카카오·네이버는 켜졌는지, 카카오 JavaScript 키(폰에서 카카오톡 앱 로그인)
  auth: { google: string | null; kakao: boolean; kakaoJsKey: string | null; naver: boolean; mock: boolean };
}

export interface SubView {
  pro: boolean;
  plan: 'monthly' | 'yearly' | 'lifetime' | null; // lifetime: 예전에 판매한 상품
  status: 'active' | 'canceled' | 'expired' | null;
  amount: number | null;
  /** 월간 자동 결제 중이면 다음 결제일, 아니면 Pro가 끝나는 날 */
  periodEnd: string | null;
  canceled: boolean;
  autoRenew: boolean;
  purchasedAt: string | null;
}

export interface Usage {
  weekStart: string;
  renewAt: string;
  files: number;
  youtube: number;
  exams: number;
  tutorToday: number;
}

export interface Me {
  user: { email: string; name: string | null; provider: 'google' | 'kakao' | 'naver' | null; phone: string | null; createdAt: string } | null;
  sub: SubView | null;
  usage: Usage | null;
  settings: Record<string, string>;
}

export interface DocSummary {
  id: string;
  kind: DocKind;
  title: string;
  thumb: string | null;
  status: 'recording' | 'processing' | 'ready' | 'error';
  error: string | null;
  durationSec: number | null;
  pageCount: number | null;
  createdAt: string;
  isSample: boolean;
  preview: string | null;
  folderId: string | null;
  favorite: boolean;
}

export interface DocDetail extends DocSummary {
  sourceUrl: string | null;
  fileName: string | null;
  mime: string | null;
  fileCount: number;
  sourceText: string | null;
  memo: string;
  materials: Record<MaterialKind, string>;
  readOnly: boolean;
}

export interface Summary {
  title: string;
  overview: string;
  sections: Array<{ heading: string; ref: string; body: string; easy: string }>;
}
export interface QuizQ {
  question: string;
  hint: string;
  options: string[];
  answer: number;
  explanation: string;
  ref: string;
}
export interface Card {
  front: string;
  back: string;
  ref: string;
}
export interface MindNode {
  label: string;
  children?: MindNode[];
}
export interface MemorizeData {
  groups: Array<{ title: string; items: Array<{ text: string; ref: string }> }>;
}
export interface Concept {
  name: string;
  refs: string[];
  short: string;
  definition: string;
  points: string[];
  example: string;
  confusion: string;
}

export interface StudySet<T> {
  id: string;
  kind: 'quiz' | 'flashcards';
  title: string;
  status: 'generating' | 'ready' | 'error';
  error: string | null;
  createdAt: string;
  data: T | null;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public reason?: string) {
    super(message);
  }
}

export async function api<T = any>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(path, {
    method: init?.method ?? (body === undefined ? 'GET' : 'POST'),
    headers: body === undefined || isForm ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    credentials: 'same-origin',
    ...init,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json?.error || '일시적인 오류가 발생했어요.', res.status, json?.reason);
  return json as T;
}

export const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

export function kst(iso: string) {
  return new Date(new Date(iso).getTime() + 9 * 3600_000);
}

/** 무료 횟수 갱신 시각: "11월 2일 (월) 0시" */
export function formatRenew(iso: string) {
  const d = kst(iso);
  const day = '일월화수목금토'[d.getUTCDay()];
  const h = d.getUTCHours();
  if (h === 0 && d.getUTCMinutes() === 0) return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${day}) 0시`;
  const ampm = h < 12 ? '오전' : '오후';
  const hh = String(h % 12 === 0 ? 12 : h % 12).padStart(2, '0');
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${day}) ${ampm} ${hh}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** 다음 월요일 0시(한국 시간). 로그인 전에도 무료 횟수 갱신일을 보여 줄 때 쓴다. */
export function nextWeeklyReset(now = new Date()) {
  const k = kst(now.toISOString());
  const toMonday = 7 - ((k.getUTCDay() + 6) % 7);
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() + toMonday) - 9 * 3600_000).toISOString();
}

/** "2026년 12월 1일" */
export function formatDay(iso: string) {
  const d = kst(iso);
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}

export function formatDate(iso: string) {
  const d = kst(iso);
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export const KIND_LABEL: Record<DocKind, string> = {
  pdf: 'PDF',
  docx: 'Word',
  pptx: 'PPT',
  youtube: 'YouTube',
  audio: '강의 녹음',
  image: '이미지',
  memo: '메모',
};
