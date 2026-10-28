// 브라우저와 서버가 함께 쓰는 데이터 모양

export interface Experience {
  id: string;
  title: string;
  period: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  skills: string[];
}

export interface Source {
  title: string;
  uri: string;
}

/** 지원 기업·문항 하나에 대한 분석 */
export interface Analysis {
  id: string;
  company: string;
  role: string;
  question: string;
  charLimit: number;
  posting: string;
  report: string;
  sources: Source[];
  createdAt: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface Review {
  reviewer: string;
  score: number;
  strengths: string[];
  improvements: string[];
}

export interface Fix {
  original: string;
  suggestion: string;
  reason: string;
}

export interface Feedback {
  score: number;
  summary: string;
  reviews: Review[];
  fixes: Fix[];
}

export interface Draft {
  id: string;
  analysisId: string | null;
  title: string;
  question: string;
  charLimit: number;
  content: string;
  experienceIds: string[];
  request: string;
  chat: ChatMessage[];
  feedback: Feedback | null;
  updatedAt: number;
}

export interface Workspace {
  experiences: Experience[];
  analyses: Analysis[];
  drafts: Draft[];
}

export interface AppConfig {
  aiReady: boolean;
  /** null 이면 로컬 모드(로그인 없음) */
  auth: { url: string; anonKey: string } | null;
  /** null 이면 결제 비활성 */
  toss: { clientKey: string } | null;
  freeDailyLimit: number;
  proPrice: number;
}

export interface Account {
  plan: 'free' | 'pro';
  proUntil: string | null;
  usedToday: number;
  /** null 이면 무제한 */
  limit: number | null;
}

// ── API 요청 본문 ──

export interface ExtractRequest {
  text?: string;
  file?: { name: string; mimeType: string; data: string };
}

export interface AnalyzeRequest {
  company: string;
  role: string;
  question: string;
  charLimit: number;
  posting: string;
}

export interface DraftContext {
  company: string;
  role: string;
  question: string;
  charLimit: number;
  report: string;
}

export interface GenerateRequest {
  context: DraftContext;
  experiences: Experience[];
  request: string;
}

export interface ChatRequest {
  context: DraftContext;
  draft: string;
  messages: ChatMessage[];
}

export interface FeedbackRequest {
  context: DraftContext;
  draft: string;
}

export interface OrderResponse {
  orderId: string;
  orderName: string;
  amount: number;
}

export interface ConfirmRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
}
