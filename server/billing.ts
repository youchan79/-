import crypto from 'node:crypto';
import { config } from './config.ts';
import { all, one, run, tx, nowIso, addMonths, newId } from './db.ts';
import { getSub, isPro } from './plan.ts';
import type { User } from './auth.ts';

/*
 * 페이앱 연동
 * - 월간: 정기결제(rebillRegist). 페이앱이 매달 결제하고 결제통보(feedbackurl)로 알려 준다.
 * - 연간: 단건 결제요청(payrequest).
 * - 결제 완료는 결제통보에서만 처리한다. 결제창에서 돌아온 것(returnurl)은 완료 근거가 아니다.
 */

const API = 'https://api.payapp.kr/oapi/v2';
export type Plan = 'monthly' | 'yearly';

export class PaymentError extends Error {}

// 개발용 가짜 결제에서 쓰는 키. 실제 결제통보와 같은 검증 경로를 그대로 탄다.
const MOCK = { userid: 'mock_seller', linkkey: 'mock_linkkey', linkval: 'mock_linkval', requestkey: 'mock_requestkey' };
const keys = () => (config.paymentProvider === 'mock' ? MOCK : config.payapp);

function kstStamp(d = new Date()) {
  return new Date(d.getTime() + 9 * 3600_000).toISOString().replace(/[-T:]/g, '').slice(0, 14);
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

async function payappPost(params: Record<string, string>): Promise<Record<string, string>> {
  const k = keys();
  const requestdate = kstStamp();
  const body = new URLSearchParams({
    userid: k.userid,
    linkkey: k.linkkey,
    requestdate,
    hash: sha256(k.userid + requestdate + k.requestkey),
    ...params,
  });
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body,
  });
  const text = await res.text();
  const out = Object.fromEntries(new URLSearchParams(text));
  if (out.state !== '1') {
    console.error('[payapp] 요청 실패', params.cmd, text);
    throw new PaymentError(out.errorMessage || '결제 요청에 실패했어요. 잠시 후 다시 시도해 주세요.');
  }
  return out;
}

export function normalizePhone(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const d = v.replace(/\D/g, '');
  return /^01[016789]\d{7,8}$/.test(d) ? d : null;
}

export const planInfo = (plan: Plan) => config.plans[plan];

/* ---------- 결제 시작 ---------- */

export async function startCheckout(p: { user: User; plan: Plan; phone: string; origin: string }) {
  if (config.paymentProvider === 'none') throw new PaymentError('결제 설정이 아직 완료되지 않았어요.');
  const { name, price } = planInfo(p.plan);
  const orderId = newId('ord');
  run(
    `INSERT INTO payments (order_id, user_id, plan, kind, amount, status, provider, created_at)
     VALUES (?, ?, ?, 'first', ?, 'requested', ?, ?)`,
    orderId,
    p.user.id,
    p.plan,
    price,
    config.paymentProvider,
    nowIso(),
  );
  run('UPDATE users SET phone = ? WHERE id = ?', p.phone, p.user.id);

  const returnurl = `${p.origin}/subscription?order=${orderId}`;
  if (config.paymentProvider === 'mock') {
    return { orderId, payurl: `${p.origin}/mock-payapp?order=${orderId}` };
  }

  const feedbackurl = `${config.appUrl || p.origin}/api/payapp/feedback`;
  const common = { recvphone: p.phone, feedbackurl, var1: orderId, var2: p.user.id, smsuse: 'n', returnurl, recvemail: p.user.email };
  if (p.plan === 'monthly') {
    const kstDay = new Date(Date.now() + 9 * 3600_000).getUTCDate();
    const expire = new Date(Date.now() + 5 * 365 * 86400_000).toISOString().slice(0, 10);
    const out = await payappPost({
      cmd: 'rebillRegist',
      goodname: name,
      goodprice: String(price),
      rebillCycleType: 'Month',
      rebillCycleMonth: String(kstDay > 28 ? 90 : kstDay), // 29~31일 가입은 매월 말일 결제
      rebillExpire: expire,
      openpaytype: 'card',
      ...common,
    });
    run('UPDATE payments SET rebill_no = ? WHERE order_id = ?', out.rebill_no, orderId);
    return { orderId, payurl: out.payurl };
  }
  const out = await payappPost({ cmd: 'payrequest', goodname: name, price: String(price), checkretry: 'y', ...common });
  run('UPDATE payments SET mul_no = ? WHERE order_id = ?', out.mul_no, orderId);
  return { orderId, payurl: out.payurl };
}

/* ---------- 결제통보 ---------- */

export interface FeedbackResult {
  ok: boolean;
  purchase?: { orderId: string; userId: string; amount: number; first: boolean };
}

/** 페이앱 결제통보 처리. 여러 번 와도 한 번만 반영된다. */
export function handleFeedback(body: Record<string, string>): FeedbackResult {
  const k = keys();
  const validKeys = body.userid === k.userid && body.linkkey === k.linkkey && body.linkval === k.linkval;
  const validHash = (body.hash || '').toLowerCase() === sha256(k.userid + (body.responsedate || '') + k.requestkey);
  if (!validKeys || !validHash) {
    console.error('[payapp] 결제통보 검증 실패', { userid: body.userid, mul_no: body.mul_no });
    return { ok: false };
  }
  const state = Number(body.pay_state);
  const orderId = body.var1;
  const base = orderId ? one('SELECT * FROM payments WHERE order_id = ?', orderId) : undefined;
  if (!base) {
    console.error('[payapp] 주문 없음', orderId);
    return { ok: true }; // 우리 주문이 아니면 재시도할 필요가 없다
  }
  const price = Number(body.price);
  const mulNo = body.mul_no || null;

  if (state === 4) {
    if (price !== base.amount) {
      console.error('[payapp] 금액 불일치', orderId, price, base.amount);
      return { ok: false };
    }
    if (mulNo && one("SELECT 1 FROM payments WHERE mul_no = ? AND status = 'paid'", mulNo)) return { ok: true };
    const first = base.status !== 'paid';
    const payOrderId = first ? orderId : `${orderId}_${mulNo ?? Date.now()}`;
    tx(() => {
      if (first) {
        run(
          "UPDATE payments SET status = 'paid', mul_no = ?, rebill_no = COALESCE(?, rebill_no), raw_json = ?, paid_at = ? WHERE order_id = ?",
          mulNo,
          body.rebill_no || null,
          JSON.stringify(body),
          nowIso(),
          orderId,
        );
      } else {
        run(
          `INSERT INTO payments (order_id, user_id, plan, kind, amount, status, provider, mul_no, rebill_no, raw_json, created_at, paid_at)
           VALUES (?, ?, ?, 'renewal', ?, 'paid', ?, ?, ?, ?, ?, ?)`,
          payOrderId,
          base.user_id,
          base.plan,
          price,
          base.provider,
          mulNo,
          body.rebill_no || base.rebill_no,
          JSON.stringify(body),
          nowIso(),
          nowIso(),
        );
      }
      extendSubscription(base.user_id, base.plan, price, body.rebill_no || base.rebill_no || null);
    });
    return { ok: true, purchase: { orderId: payOrderId, userId: base.user_id, amount: price, first } };
  }

  if (state === 8 || state === 16 || state === 31 || state === 32) {
    run("UPDATE payments SET status = 'canceled' WHERE order_id = ? AND status = 'requested'", orderId);
    return { ok: true };
  }

  if (state === 9 || state === 64 || state === 70 || state === 71) {
    // 승인 취소(환불). 취소된 결제가 지금 기간을 만든 결제면 Pro를 바로 끝낸다.
    const target = mulNo ? one('SELECT * FROM payments WHERE mul_no = ?', mulNo) : base;
    if (target && target.status === 'paid') {
      run("UPDATE payments SET status = 'canceled' WHERE order_id = ?", target.order_id);
      const latest = one("SELECT order_id FROM payments WHERE user_id = ? AND status IN ('paid','canceled') ORDER BY paid_at DESC LIMIT 1", target.user_id);
      if (latest?.order_id === target.order_id) {
        run("UPDATE subscriptions SET status = 'expired', current_period_end = ?, updated_at = ? WHERE user_id = ?", nowIso(), nowIso(), target.user_id);
      }
    }
    return { ok: true };
  }
  return { ok: true };
}

function extendSubscription(userId: string, plan: Plan, amount: number, rebillNo: string | null) {
  const now = nowIso();
  const s = getSub(userId);
  const months = plan === 'yearly' ? 12 : 1;
  const base = s && s.status !== 'expired' && s.current_period_end > now ? s.current_period_end : now;
  const end = addMonths(base, months);
  if (s) {
    run(
      `UPDATE subscriptions SET plan = ?, status = 'active', rebill_no = ?, amount = ?, current_period_end = ?,
         cancel_at_period_end = 0, updated_at = ? WHERE user_id = ?`,
      plan,
      plan === 'monthly' ? rebillNo : null,
      amount,
      end,
      now,
      userId,
    );
  } else {
    run(
      `INSERT INTO subscriptions (user_id, plan, status, rebill_no, amount, current_period_end, created_at, updated_at)
       VALUES (?, ?, 'active', ?, ?, ?, ?, ?)`,
      userId,
      plan,
      plan === 'monthly' ? rebillNo : null,
      amount,
      end,
      now,
      now,
    );
  }
}

/* ---------- 해지 ---------- */

export async function cancelSubscription(userId: string) {
  const s = getSub(userId);
  if (!s || !isPro(userId)) throw new PaymentError('이용 중인 구독이 없어요.');
  if (s.plan === 'monthly' && s.rebill_no && config.paymentProvider === 'payapp') {
    await payappPost({ cmd: 'rebillCancel', rebill_no: s.rebill_no });
  }
  run("UPDATE subscriptions SET status = 'canceled', cancel_at_period_end = 1, updated_at = ? WHERE user_id = ?", nowIso(), userId);
}

export function subscriptionView(userId: string) {
  const s = getSub(userId);
  return {
    pro: isPro(userId),
    plan: s?.plan ?? null,
    status: s?.status ?? null,
    amount: s?.amount ?? null,
    periodEnd: s?.current_period_end ?? null,
    canceled: !!s?.cancel_at_period_end,
  };
}

export function orderStatus(userId: string, orderId: string) {
  const p = one('SELECT order_id, plan, amount, status, kind FROM payments WHERE order_id = ? AND user_id = ?', orderId, userId);
  return p ?? null;
}

/* ---------- 개발용 가짜 결제 ---------- */

/** 가짜 결제창에서 '결제하기'를 누르면 실제 결제통보와 같은 형식으로 서명해 처리한다. */
export function mockPay(orderId: string, opts: { renewal?: boolean } = {}): FeedbackResult {
  if (config.paymentProvider !== 'mock') throw new PaymentError('가짜 결제는 개발 환경에서만 쓸 수 있어요.');
  const p = one('SELECT * FROM payments WHERE order_id = ?', orderId);
  if (!p) throw new PaymentError('주문을 찾을 수 없어요.');
  const responsedate = kstStamp();
  const mulNo = String(Date.now());
  return handleFeedback({
    userid: MOCK.userid,
    linkkey: MOCK.linkkey,
    linkval: MOCK.linkval,
    responsedate,
    hash: sha256(MOCK.userid + responsedate + MOCK.requestkey),
    pay_state: '4',
    price: String(p.amount),
    var1: orderId,
    var2: p.user_id,
    mul_no: mulNo,
    rebill_no: p.plan === 'monthly' ? p.rebill_no || `mock_rebill_${orderId}` : '',
    pay_type: '1',
    goodname: planInfo(p.plan).name,
    ...(opts.renewal ? {} : {}),
  });
}

export function lastOrderForUser(userId: string) {
  return all("SELECT order_id FROM payments WHERE user_id = ? AND kind = 'first' AND status = 'paid' ORDER BY paid_at DESC LIMIT 1", userId)[0];
}
