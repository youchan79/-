import crypto from 'node:crypto';
import { config } from './config.ts';
import { all, one, run, tx, nowIso, addDays, type Row } from './db.ts';
import type { User } from './auth.ts';

const TOSS_API = 'https://api.tosspayments.com';

export class PaymentError extends Error {
  constructor(message: string, public code = 'PAYMENT_FAILED') {
    super(message);
  }
}

function tossAuthHeader() {
  return 'Basic ' + Buffer.from(config.toss.secretKey + ':').toString('base64');
}

async function tossPost(path: string, body: unknown, idempotencyKey?: string): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: tossAuthHeader(),
    'Content-Type': 'application/json',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(TOSS_API + path, { method: 'POST', headers, body: JSON.stringify(body) });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new PaymentError(json?.message || `결제 요청이 실패했습니다. (${res.status})`, json?.code || 'TOSS_ERROR');
  }
  return json;
}

function ensureProvider() {
  if (config.paymentProvider === 'none') throw new PaymentError('결제 설정이 아직 완료되지 않았습니다.', 'NOT_CONFIGURED');
}

/* ---------- 토스 API (mock 모드에서는 가짜 응답) ---------- */

async function issueBillingKey(authKey: string, customerKey: string): Promise<{ billingKey: string; cardLabel: string }> {
  if (config.paymentProvider === 'mock') {
    if (!authKey.startsWith('mock_')) throw new PaymentError('가짜 결제 모드입니다.');
    return { billingKey: 'mock_bk_' + crypto.randomUUID(), cardLabel: '테스트카드 1234' };
  }
  const json = await tossPost('/v1/billing/authorizations/issue', { authKey, customerKey });
  const num: string = json?.card?.number ?? '';
  return { billingKey: json.billingKey, cardLabel: num ? `카드 ${num}` : '등록된 카드' };
}

async function chargeBillingKey(p: {
  billingKey: string;
  customerKey: string;
  amount: number;
  orderId: string;
  email: string;
}): Promise<any> {
  if (config.paymentProvider === 'mock') {
    return { status: 'DONE', paymentKey: 'mock_pk_' + crypto.randomUUID(), totalAmount: p.amount, approvedAt: nowIso() };
  }
  return tossPost(
    `/v1/billing/${encodeURIComponent(p.billingKey)}`,
    {
      customerKey: p.customerKey,
      amount: p.amount,
      orderId: p.orderId,
      orderName: config.plan.name,
      customerEmail: p.email,
    },
    p.orderId,
  );
}

async function confirmOneTime(paymentKey: string, orderId: string, amount: number): Promise<any> {
  if (config.paymentProvider === 'mock') {
    if (!paymentKey.startsWith('mock_')) throw new PaymentError('가짜 결제 모드입니다.');
    return { status: 'DONE', paymentKey, totalAmount: amount, approvedAt: nowIso() };
  }
  return tossPost('/v1/payments/confirm', { paymentKey, orderId, amount }, orderId);
}

/* ---------- 구독 상태 ---------- */

export function newOrderId() {
  const d = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10).replace(/-/g, '');
  return `ord_${d}_${crypto.randomBytes(9).toString('base64url')}`;
}

export function getSubscription(userId: string): Row | undefined {
  return one('SELECT * FROM subscriptions WHERE user_id = ?', userId);
}

export function hasAccess(userId: string | undefined): boolean {
  if (!userId) return false;
  const s = getSubscription(userId);
  if (!s) return false;
  if (s.status === 'past_due') return true; // 재시도 기간에는 이용 가능
  return s.status === 'active' && s.current_period_end > nowIso();
}

export function subscriptionView(userId: string) {
  const s = getSubscription(userId);
  if (!s) return null;
  return {
    mode: s.mode as 'auto' | 'pass',
    status: s.status as string,
    active: hasAccess(userId),
    amount: s.amount as number,
    cardLabel: s.card_label as string | null,
    periodEnd: s.current_period_end as string,
    cancelAtPeriodEnd: !!s.cancel_at_period_end,
  };
}

function upsertActiveSubscription(p: {
  userId: string;
  mode: 'auto' | 'pass';
  billingKey: string | null;
  cardLabel: string | null;
  amount: number;
}) {
  const now = nowIso();
  const existing = getSubscription(p.userId);
  if (existing) {
    // 이용권 기간이 남아 있으면 그 끝에서 이어서 연장한다.
    const base = p.mode === 'pass' && existing.status === 'active' && existing.current_period_end > now ? existing.current_period_end : now;
    run(
      `UPDATE subscriptions SET mode = ?, status = 'active', billing_key = ?, card_label = ?, amount = ?,
        current_period_start = ?, current_period_end = ?, cancel_at_period_end = ?, retry_count = 0, next_retry_at = NULL, updated_at = ?
       WHERE user_id = ?`,
      p.mode,
      p.billingKey,
      p.cardLabel,
      p.amount,
      base,
      addDays(base, config.plan.days),
      p.mode === 'pass' ? 1 : 0,
      now,
      p.userId,
    );
  } else {
    run(
      `INSERT INTO subscriptions (id, user_id, mode, status, billing_key, card_label, amount, current_period_start, current_period_end,
        cancel_at_period_end, retry_count, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      'sub_' + crypto.randomUUID(),
      p.userId,
      p.mode,
      p.billingKey,
      p.cardLabel,
      p.amount,
      now,
      addDays(now, config.plan.days),
      p.mode === 'pass' ? 1 : 0,
      now,
      now,
    );
  }
}

function insertPayment(orderId: string, userId: string, kind: 'first' | 'renewal' | 'pass', amount: number) {
  run(
    `INSERT INTO payments (order_id, user_id, kind, amount, status, provider, created_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
    orderId,
    userId,
    kind,
    amount,
    config.paymentProvider,
    nowIso(),
  );
}

function markPaymentDone(orderId: string, payment: any) {
  run(
    `UPDATE payments SET status = 'done', payment_key = ?, approved_at = ?, raw_json = ? WHERE order_id = ?`,
    payment.paymentKey ?? null,
    payment.approvedAt ? new Date(payment.approvedAt).toISOString() : nowIso(),
    JSON.stringify({ status: payment.status, method: payment.method, totalAmount: payment.totalAmount, card: payment.card ?? null }),
    orderId,
  );
}

function markPaymentFailed(orderId: string, error: string) {
  run(`UPDATE payments SET status = 'failed', error = ? WHERE order_id = ?`, error.slice(0, 500), orderId);
}

/* ---------- 결제 흐름 ---------- */

export interface ConfirmResult {
  orderId: string;
  amount: number;
  firstTime: boolean;
}

export function checkoutParams(user: User, origin: string, readingId: string | null) {
  ensureProvider();
  const back = readingId ? `&r=${encodeURIComponent(readingId)}` : '';
  const base = {
    provider: config.paymentProvider,
    mode: config.billingMode,
    clientKey: config.toss.clientKey,
    customerKey: user.customer_key,
    customerEmail: user.email,
    amount: config.plan.price,
    orderName: config.plan.name,
    successUrl: `${origin}/checkout/success?mode=${config.billingMode}${back}`,
    failUrl: `${origin}/checkout/fail?mode=${config.billingMode}${back}`,
  };
  if (config.billingMode === 'pass') {
    const orderId = newOrderId();
    insertPayment(orderId, user.id, 'pass', config.plan.price);
    return { ...base, orderId };
  }
  return { ...base, orderId: null };
}

export async function confirmAuto(user: User, authKey: string, customerKey: string): Promise<ConfirmResult> {
  ensureProvider();
  if (customerKey !== user.customer_key) throw new PaymentError('결제 정보가 계정과 맞지 않습니다.');

  const existing = getSubscription(user.id);
  if (existing && existing.mode === 'auto' && hasAccess(user.id) && !existing.cancel_at_period_end) {
    const last = one("SELECT order_id, amount FROM payments WHERE user_id = ? AND status = 'done' ORDER BY approved_at DESC LIMIT 1", user.id);
    return { orderId: last?.order_id ?? '', amount: last?.amount ?? 0, firstTime: false };
  }

  const { billingKey, cardLabel } = await issueBillingKey(authKey, customerKey);
  const orderId = newOrderId();
  const amount = config.plan.price;
  insertPayment(orderId, user.id, 'first', amount);
  try {
    const payment = await chargeBillingKey({ billingKey, customerKey, amount, orderId, email: user.email });
    if (payment.status !== 'DONE') throw new PaymentError(`결제가 완료되지 않았습니다. (${payment.status})`);
    tx(() => {
      markPaymentDone(orderId, payment);
      upsertActiveSubscription({ userId: user.id, mode: 'auto', billingKey, cardLabel, amount });
    });
    return { orderId, amount, firstTime: true };
  } catch (e) {
    markPaymentFailed(orderId, (e as Error).message);
    throw e;
  }
}

export async function confirmPass(user: User, paymentKey: string, orderId: string, amount: number): Promise<ConfirmResult> {
  ensureProvider();
  const p = one('SELECT * FROM payments WHERE order_id = ? AND user_id = ?', orderId, user.id);
  if (!p) throw new PaymentError('주문을 찾을 수 없습니다.');
  if (p.status === 'done') return { orderId, amount: p.amount, firstTime: false };
  if (Number(amount) !== p.amount) throw new PaymentError('결제 금액이 주문과 다릅니다.');
  try {
    const payment = await confirmOneTime(paymentKey, orderId, p.amount);
    if (payment.status !== 'DONE') throw new PaymentError(`결제가 완료되지 않았습니다. (${payment.status})`);
    tx(() => {
      markPaymentDone(orderId, payment);
      upsertActiveSubscription({ userId: user.id, mode: 'pass', billingKey: null, cardLabel: null, amount: p.amount });
    });
    return { orderId, amount: p.amount, firstTime: true };
  } catch (e) {
    markPaymentFailed(orderId, (e as Error).message);
    throw e;
  }
}

export function cancelSubscription(userId: string) {
  run('UPDATE subscriptions SET cancel_at_period_end = 1, updated_at = ? WHERE user_id = ?', nowIso(), userId);
}

export function resumeSubscription(userId: string) {
  const s = getSubscription(userId);
  if (!s || s.mode !== 'auto' || !s.billing_key || !hasAccess(userId)) {
    throw new PaymentError('다시 구독하려면 결제를 새로 진행해 주세요.');
  }
  run('UPDATE subscriptions SET cancel_at_period_end = 0, updated_at = ? WHERE user_id = ?', nowIso(), userId);
}

/* ---------- 정기결제 갱신 (토스는 스케줄을 대신 돌려주지 않는다) ---------- */

let renewing = false;

export async function runRenewals(): Promise<{ charged: number; failed: number; expired: number }> {
  const result = { charged: 0, failed: 0, expired: 0 };
  if (renewing || config.paymentProvider === 'none') return result;
  renewing = true;
  try {
    const now = nowIso();
    const due = all(
      `SELECT s.*, u.email, u.customer_key FROM subscriptions s JOIN users u ON u.id = s.user_id
       WHERE s.status IN ('active', 'past_due') AND s.current_period_end <= ?`,
      now,
    );
    for (const s of due) {
      if (s.mode !== 'auto' || s.cancel_at_period_end || !s.billing_key) {
        run("UPDATE subscriptions SET status = 'expired', updated_at = ? WHERE id = ?", now, s.id);
        result.expired++;
        continue;
      }
      if (s.status === 'past_due' && s.next_retry_at && s.next_retry_at > now) continue;

      const orderId = newOrderId();
      insertPayment(orderId, s.user_id, 'renewal', s.amount);
      try {
        const payment = await chargeBillingKey({
          billingKey: s.billing_key,
          customerKey: s.customer_key,
          amount: s.amount,
          orderId,
          email: s.email,
        });
        if (payment.status !== 'DONE') throw new PaymentError(`결제 상태 ${payment.status}`);
        const start = s.status === 'active' ? s.current_period_end : nowIso();
        tx(() => {
          markPaymentDone(orderId, payment);
          run(
            `UPDATE subscriptions SET status = 'active', current_period_start = ?, current_period_end = ?, retry_count = 0,
              next_retry_at = NULL, updated_at = ? WHERE id = ?`,
            start,
            addDays(start, config.plan.days),
            nowIso(),
            s.id,
          );
        });
        result.charged++;
      } catch (e) {
        markPaymentFailed(orderId, (e as Error).message);
        const retries = s.retry_count + 1;
        if (retries >= config.renewalMaxRetries) {
          run("UPDATE subscriptions SET status = 'expired', retry_count = ?, updated_at = ? WHERE id = ?", retries, nowIso(), s.id);
          result.expired++;
        } else {
          run(
            "UPDATE subscriptions SET status = 'past_due', retry_count = ?, next_retry_at = ?, updated_at = ? WHERE id = ?",
            retries,
            addDays(nowIso(), 1),
            nowIso(),
            s.id,
          );
        }
        result.failed++;
        console.error('[renewal] 결제 실패', s.user_id, (e as Error).message);
      }
    }
  } finally {
    renewing = false;
  }
  return result;
}
