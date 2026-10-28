import type { Account, AppConfig, OrderResponse } from '../types.ts';

let tokenGetter: () => Promise<string | null> = async () => null;

/** 로그인을 쓰는 경우 요청마다 붙일 토큰을 알려줌 */
export function setTokenGetter(fn: () => Promise<string | null>) {
  tokenGetter = fn;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function headers() {
  const token = await tokenGetter();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function fail(res: Response): Promise<never> {
  const body = await res.json().catch(() => null);
  throw new ApiError(body?.error ?? `요청이 실패했어요. (${res.status})`, res.status);
}

/** AI 사용량이 바뀌었음을 화면 상단에 알림 */
function usageChanged() {
  window.dispatchEvent(new Event('jasa:usage'));
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, { headers: await headers() });
  if (!res.ok) return fail(res);
  return res.json();
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, { method: 'POST', headers: await headers(), body: JSON.stringify(body) });
  usageChanged();
  if (!res.ok) return fail(res);
  return res.json();
}

/** 만들어지는 대로 글자를 받아 onText(지금까지의 전체 글)로 넘김 */
export async function stream(path: string, body: unknown, onText: (full: string) => void, signal?: AbortSignal) {
  const res = await fetch(`/api${path}`, { method: 'POST', headers: await headers(), body: JSON.stringify(body), signal });
  usageChanged();
  if (!res.ok || !res.body) return fail(res);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
    onText(full);
  }
  full += decoder.decode();
  onText(full);
  return full;
}

export const api = {
  config: () => get<AppConfig>('/config'),
  me: () => get<Account>('/me'),
  order: () => post<OrderResponse>('/payments/order', {}),
  confirm: (body: { paymentKey: string; orderId: string; amount: number }) => post<Account>('/payments/confirm', body),
};
