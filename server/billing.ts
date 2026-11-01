import crypto from 'node:crypto';
import { config } from './config.ts';
import { all, one, run, tx, nowIso, addMonths, newId, type Row } from './db.ts';
import { getSub, isPro } from './plan.ts';
import { sendServerEvent } from './meta.ts';
import type { User } from './auth.ts';

/*
 * 페이앱 연동 (개인판매자). 공식 문서: https://docs.payapp.kr/dev_center01.html
 * - 월간: 정기결제(rebillRegist). 구매자가 결제창에서 승인하면 첫 달이 바로 결제되고, 다음 달부터 같은 날(29~31일 가입은 말일)
 *   페이앱이 자동 결제한 뒤 결제통보(feedbackurl)로 알려 준다. 해지는 rebillCancel (다음 결제부터 멈춤, 환불 아님).
 * - 연간: 단건 결제(payrequest)로 1년치. 페이앱 정기결제 주기는 월·주·일뿐이라 연 단위 자동 결제는 하지 않는다.
 * - 결제 완료는 결제통보에서만 처리한다. 결제창에서 돌아온 것(returnurl)은 완료 근거가 아니다.
 * - 2회차 이후 자동 결제가 실패하면 pay_state=99 통보가 온다(failurl). 같은 주소로 받아 Pro를 끝내고 정기결제를 멈춘다.
 */

const API = 'https://api.payapp.kr/oapi/v2';
export type Plan = 'monthly' | 'yearly';
export const isPlan = (v: unknown): v is Plan => v === 'monthly' || v === 'yearly';

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

/** 정기결제 해지. 가짜 결제에서는 부르지 않는다. */
async function rebillCancel(rebillNo: string) {
  if (config.paymentProvider !== 'payapp') return;
  await payappPost({ cmd: 'rebillCancel', rebill_no: rebillNo });
}

/** 자동으로 일어난 일(갱신 실패·환불 등) 뒤에 정기결제를 멈춘다. 실패하면 판매자 사이트에서 직접 해지해야 한다. */
function stopRebill(rebillNo: string | null | undefined, why: string) {
  if (!rebillNo) return;
  rebillCancel(rebillNo).catch((e) => console.error(`[payapp] 정기결제 해지 실패(${why}) — 판매자 사이트에서 직접 해지 필요`, rebillNo, e));
}

export function normalizePhone(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const d = v.replace(/\D/g, '');
  return /^01[016789]\d{7,8}$/.test(d) ? d : null;
}

export function planInfo(plan: string) {
  return isPlan(plan) ? config.plans[plan] : { name: 'Pro', price: 0 };
}

/* ---------- 날짜 (한국 시간 기준) ---------- */

function kstParts(d: Date) {
  const k = new Date(d.getTime() + 9 * 3600_000);
  return { y: k.getUTCFullYear(), m: k.getUTCMonth(), d: k.getUTCDate() };
}

/** 페이앱 rebillCycleMonth 값: 등록한 날(한국 날짜). 29~31일이면 90(말일) */
export function billingDayFor(d: Date) {
  const day = kstParts(d).d;
  return day > 28 ? 90 : day;
}

/** 기준 시각이 속한 달(한국 날짜)의 다음 달 결제일 0시(한국 시간) */
export function nextBillingDate(fromIso: string, day: number) {
  const { y, m } = kstParts(new Date(fromIso));
  const last = new Date(Date.UTC(y, m + 2, 0)).getUTCDate();
  const dd = day === 90 ? last : Math.min(day, last);
  return new Date(Date.UTC(y, m + 1, dd) - 9 * 3600_000).toISOString();
}

function kstDate(iso: string) {
  const { y, m, d } = kstParts(new Date(iso));
  return `${y}년 ${m + 1}월 ${d}일`;
}

/* ---------- 결제 시작 ---------- */

export async function startCheckout(p: { user: User; plan: Plan; phone: string; origin: string }) {
  if (config.paymentProvider === 'none') throw new PaymentError('결제 설정이 아직 완료되지 않았어요.');
  const s = getSub(p.user.id);
  if (s && isPro(p.user.id)) {
    if (s.plan === 'lifetime') throw new PaymentError('이미 기간 제한 없는 Pro를 쓰고 있어요.');
    if (s.plan === 'yearly') throw new PaymentError(`연간 Pro를 ${kstDate(s.current_period_end)}까지 쓸 수 있어요. 그 뒤에 다시 결제해 주세요.`);
    if (p.plan === 'monthly') {
      throw new PaymentError(s.status === 'canceled' ? `해지 예약 중이에요. ${kstDate(s.current_period_end)}부터 다시 구독할 수 있어요.` : '이미 월간 구독 중이에요.');
    }
    // 월간 → 연간: 결제되면 남은 기간 뒤에 1년을 붙이고 월간 자동 결제는 멈춘다.
  }
  const { name, price } = planInfo(p.plan);
  const orderId = newId('ord');
  const createdAt = nowIso();
  run(
    `INSERT INTO payments (order_id, user_id, plan, kind, amount, status, provider, created_at)
     VALUES (?, ?, ?, 'first', ?, 'requested', ?, ?)`,
    orderId,
    p.user.id,
    p.plan,
    price,
    config.paymentProvider,
    createdAt,
  );
  run('UPDATE users SET phone = ? WHERE id = ?', p.phone, p.user.id);

  const returnurl = `${p.origin}/subscription?order=${orderId}`;
  if (config.paymentProvider === 'mock') {
    if (p.plan === 'monthly') run('UPDATE payments SET rebill_no = ? WHERE order_id = ?', `mock_rebill_${orderId}`, orderId);
    return { orderId, payurl: `${p.origin}/mock-payapp?order=${orderId}` };
  }

  const feedbackurl = `${config.appUrl || p.origin}/api/payapp/feedback`;
  const common = { recvphone: p.phone, recvemail: p.user.email, feedbackurl, returnurl, var1: orderId, var2: p.user.id, smsuse: 'n' };
  if (p.plan === 'monthly') {
    const expire = addMonths(createdAt, 12 * 10).slice(0, 10); // 필수 값. 해지 전까지 계속 결제되도록 넉넉히
    const out = await payappPost({
      cmd: 'rebillRegist',
      goodname: name,
      goodprice: String(price),
      rebillCycleType: 'Month',
      rebillCycleMonth: String(billingDayFor(new Date(createdAt))),
      rebillExpire: expire,
      openpaytype: 'card',
      failurl: feedbackurl,
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

function verified(body: Record<string, string>) {
  const k = keys();
  const validKeys = body.userid === k.userid && body.linkkey === k.linkkey && body.linkval === k.linkval;
  const validHash = (body.hash || '').toLowerCase() === sha256(k.userid + (body.responsedate || '') + k.requestkey);
  return validKeys && validHash;
}

/** 페이앱 결제통보 처리. 여러 번 와도 한 번만 반영된다. */
export function handleFeedback(body: Record<string, string>): FeedbackResult {
  if (!verified(body)) {
    console.error('[payapp] 결제통보 검증 실패', { userid: body.userid, mul_no: body.mul_no });
    return { ok: false };
  }
  const state = Number(body.pay_state);
  const rebillNo = body.rebill_no || null;
  // 우리 주문: 주문번호(var1)로 찾고, 없으면 정기결제 등록번호로 첫 주문을 찾는다
  const base =
    (body.var1 ? one('SELECT * FROM payments WHERE order_id = ?', body.var1) : undefined) ??
    (rebillNo ? one("SELECT * FROM payments WHERE rebill_no = ? AND kind = 'first' ORDER BY created_at LIMIT 1", rebillNo) : undefined);
  if (!base) {
    console.error('[payapp] 주문 없음', body.var1, rebillNo);
    return { ok: true }; // 우리 주문이 아니면 재시도할 필요가 없다
  }
  if (rebillNo && base.rebill_no && rebillNo !== base.rebill_no) {
    console.error('[payapp] 정기결제 번호 불일치', base.order_id, rebillNo, base.rebill_no);
    return { ok: false };
  }

  if (state === 4) return paid(base, body);
  if (state === 8 || state === 16 || state === 31 || state === 32) {
    run("UPDATE payments SET status = 'canceled' WHERE order_id = ? AND status = 'requested'", base.order_id);
    return { ok: true };
  }
  if (state === 9 || state === 64 || state === 70 || state === 71) return refunded(base, body);
  if (state === 99) return renewalFailed(base, body);
  return { ok: true };
}

/** 결제 완료: 첫 결제면 Pro 시작, 월간 자동 결제면 다음 결제일까지 연장 */
function paid(base: Row, body: Record<string, string>): FeedbackResult {
  const price = Number(body.price);
  const mulNo = body.mul_no || null;
  if (price !== base.amount) {
    console.error('[payapp] 금액 불일치', base.order_id, price, base.amount);
    return { ok: false };
  }
  // 같은 결제 통보가 다시 와도(이미 반영했거나 이미 환불한 결제) 다시 반영하지 않는다
  if (mulNo && one("SELECT 1 FROM payments WHERE mul_no = ? AND status IN ('paid','canceled')", mulNo)) return { ok: true };
  const first = base.status !== 'paid';
  if (!first && base.plan !== 'monthly') {
    console.error('[payapp] 단건 주문에 결제가 또 옴 (반영 안 함)', base.order_id, mulNo);
    return { ok: true };
  }
  const now = nowIso();
  const userId: string = base.user_id;
  const plan = base.plan as Plan;
  const rebillNo: string | null = body.rebill_no || base.rebill_no || null;
  const payOrderId = first ? base.order_id : `${base.order_id}_${mulNo ?? Date.now()}`;
  const prev = getSub(userId);
  const prevActive = !!prev && isPro(userId);

  let end: string;
  let billingDay: number | null = null;
  if (plan === 'monthly') {
    billingDay = billingDayFor(new Date(base.created_at));
    // 첫 결제는 등록한 달 기준, 갱신은 지금 기간이 끝나는 달 기준으로 다음 결제일을 잡는다 (통보가 늦게 와도 한 달씩만 늘어남)
    const ref = first ? base.created_at : prev && prev.plan === 'monthly' && prev.status !== 'expired' ? prev.current_period_end : now;
    end = nextBillingDate(ref, billingDay);
    if (end <= now) end = nextBillingDate(now, billingDay);
  } else {
    // 연간: 남은 Pro 기간(월간 포함) 뒤에 12개월을 붙인다
    end = addMonths(prevActive && prev!.current_period_end > now ? prev!.current_period_end : now, 12);
  }

  tx(() => {
    if (first) {
      run(
        "UPDATE payments SET status = 'paid', mul_no = ?, rebill_no = ?, raw_json = ?, paid_at = ? WHERE order_id = ?",
        mulNo,
        rebillNo,
        JSON.stringify(body),
        now,
        base.order_id,
      );
    } else {
      run(
        `INSERT INTO payments (order_id, user_id, plan, kind, amount, status, provider, mul_no, rebill_no, raw_json, created_at, paid_at)
         VALUES (?, ?, ?, 'renewal', ?, 'paid', ?, ?, ?, ?, ?, ?)`,
        payOrderId,
        userId,
        plan,
        price,
        base.provider,
        mulNo,
        rebillNo,
        JSON.stringify(body),
        now,
        now,
      );
    }
    const values = [plan, plan === 'monthly' ? rebillNo : null, price, end, billingDay, now];
    if (prev) {
      run(
        `UPDATE subscriptions SET plan = ?, status = 'active', rebill_no = ?, amount = ?, current_period_end = ?,
           cancel_at_period_end = 0, billing_day = ?, updated_at = ? WHERE user_id = ?`,
        ...values,
        userId,
      );
    } else {
      run(
        `INSERT INTO subscriptions (plan, status, rebill_no, amount, current_period_end, cancel_at_period_end, billing_day, updated_at, user_id, created_at)
         VALUES (?, 'active', ?, ?, ?, 0, ?, ?, ?, ?)`,
        ...values,
        userId,
        now,
      );
    }
  });

  // 월간에서 연간으로 바꾼 경우: 예전 월간 자동 결제를 멈춘다
  if (plan === 'yearly' && prev?.plan === 'monthly' && prev.status === 'active' && prev.rebill_no) stopRebill(prev.rebill_no, '연간으로 변경');
  if (!first) void trackRenewal(payOrderId, userId, price);
  return { ok: true, purchase: { orderId: payOrderId, userId, amount: price, first } };
}

/** 승인 취소(환불, 부분 취소 포함). 지금 기간을 만든 결제가 취소되면 Pro를 바로 끝내고 자동 결제도 멈춘다. */
function refunded(base: Row, body: Record<string, string>): FeedbackResult {
  // 부분 취소는 원래 결제번호가 orig_mul_no로 온다
  const byMul = (v?: string) => (v ? one('SELECT * FROM payments WHERE mul_no = ?', v) : undefined);
  const target = body.mul_no || body.orig_mul_no ? (byMul(body.mul_no) ?? byMul(body.orig_mul_no)) : base;
  if (!target || target.status !== 'paid') return { ok: true };
  run("UPDATE payments SET status = 'canceled' WHERE order_id = ?", target.order_id);
  const latest = one("SELECT order_id FROM payments WHERE user_id = ? AND status IN ('paid','canceled') ORDER BY paid_at DESC LIMIT 1", target.user_id);
  if (latest?.order_id === target.order_id) {
    const s = getSub(target.user_id);
    run("UPDATE subscriptions SET status = 'expired', current_period_end = ?, updated_at = ? WHERE user_id = ?", nowIso(), nowIso(), target.user_id);
    if (s?.plan === 'monthly' && s.status === 'active') stopRebill(s.rebill_no, '환불');
  }
  return { ok: true };
}

/** 2회차 이후 자동 결제 실패: 기본 플랜으로 돌리고 정기결제를 멈춘다 (다시 구독하면 새로 결제) */
function renewalFailed(base: Row, body: Record<string, string>): FeedbackResult {
  const s = getSub(base.user_id);
  const rebillNo = body.rebill_no || base.rebill_no;
  if (!s || s.plan !== 'monthly' || s.rebill_no !== rebillNo || s.status === 'expired') return { ok: true };
  const now = nowIso();
  tx(() => {
    run(
      `INSERT INTO payments (order_id, user_id, plan, kind, amount, status, provider, mul_no, rebill_no, raw_json, created_at)
       VALUES (?, ?, 'monthly', 'renewal', ?, 'failed', ?, ?, ?, ?, ?)`,
      newId('fail'),
      base.user_id,
      base.amount,
      base.provider,
      body.mul_no || null,
      rebillNo,
      JSON.stringify(body),
      now,
    );
    run("UPDATE subscriptions SET status = 'expired', current_period_end = ?, updated_at = ? WHERE user_id = ?", now, now, base.user_id);
  });
  console.error('[payapp] 월간 자동 결제 실패 → 기본 플랜', base.user_id, body.ResultMsg || body.resultMsg || '');
  stopRebill(rebillNo, '갱신 실패');
  return { ok: true };
}

/** 월간 자동 결제는 브라우저가 없으므로 서버 이벤트만 보낸다 (주문번호를 event_id로, 한 번만) */
async function trackRenewal(orderId: string, userId: string, amount: number) {
  if (!run('UPDATE payments SET meta_sent = 1 WHERE order_id = ? AND meta_sent = 0', orderId).changes) return;
  const u = one('SELECT email FROM users WHERE id = ?', userId);
  if (u?.email) await sendServerEvent(null, { eventName: 'Purchase', eventId: orderId, email: u.email, value: amount, userId });
}

/* ---------- 해지 ---------- */

/** 월간 구독 해지: 다음 결제부터 멈추고, 이미 결제한 기간 끝까지는 Pro를 그대로 쓴다. */
export async function cancelSubscription(userId: string) {
  const s = getSub(userId);
  if (!s || !isPro(userId)) throw new PaymentError('이용 중인 구독이 없어요.');
  if (s.plan !== 'monthly') throw new PaymentError('연간 이용권은 자동 결제가 없어서 해지할 게 없어요. 기간이 끝나면 기본 플랜으로 바뀌어요.');
  if (s.status === 'canceled') return;
  // 페이앱 해지가 실패하면 우리도 해지로 표시하지 않는다 (표시만 해지되고 다음 달에 또 결제되는 일을 막는다)
  if (s.rebill_no) await rebillCancel(s.rebill_no);
  run("UPDATE subscriptions SET status = 'canceled', cancel_at_period_end = 1, updated_at = ? WHERE user_id = ?", nowIso(), userId);
}

export function subscriptionView(userId: string) {
  const s = getSub(userId);
  const pro = isPro(userId);
  const paid = one("SELECT paid_at FROM payments WHERE user_id = ? AND status = 'paid' ORDER BY paid_at DESC LIMIT 1", userId);
  return {
    pro,
    plan: s?.plan ?? null,
    status: s?.status ?? null,
    amount: s?.amount ?? null,
    periodEnd: s?.current_period_end ?? null,
    canceled: s?.status === 'canceled',
    autoRenew: pro && s?.plan === 'monthly' && s.status === 'active',
    purchasedAt: paid?.paid_at ?? null,
  };
}

export function orderStatus(userId: string, orderId: string) {
  const p = one('SELECT order_id, plan, amount, status, kind FROM payments WHERE order_id = ? AND user_id = ?', orderId, userId);
  return p ?? null;
}

/* ---------- 개발용 가짜 결제 ---------- */

function mockNotice(fields: Record<string, string>): FeedbackResult {
  if (config.paymentProvider !== 'mock') throw new PaymentError('가짜 결제는 개발 환경에서만 쓸 수 있어요.');
  const responsedate = kstStamp();
  return handleFeedback({
    userid: MOCK.userid,
    linkkey: MOCK.linkkey,
    linkval: MOCK.linkval,
    responsedate,
    hash: sha256(MOCK.userid + responsedate + MOCK.requestkey),
    mul_no: String(Date.now()) + String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
    pay_type: '1',
    ...fields,
  });
}

/** 가짜 결제창에서 '결제하기'를 누르면 실제 결제통보와 같은 형식으로 서명해 처리한다. */
export function mockPay(orderId: string): FeedbackResult {
  const p = one('SELECT * FROM payments WHERE order_id = ?', orderId);
  if (!p) throw new PaymentError('주문을 찾을 수 없어요.');
  return mockNotice({ pay_state: '4', price: String(p.amount), var1: orderId, var2: p.user_id, rebill_no: p.rebill_no ?? '', goodname: planInfo(p.plan).name });
}

/** 월간 자동 결제가 한 번 더 일어난 것처럼 통보한다 (ok=false면 실패 통보) */
export function mockRenewal(userId: string, ok: boolean): FeedbackResult {
  const s = getSub(userId);
  if (!s || s.plan !== 'monthly' || s.status !== 'active' || !s.rebill_no) throw new PaymentError('자동 결제 중인 월간 구독이 없어요.');
  const base = one("SELECT * FROM payments WHERE rebill_no = ? AND kind = 'first'", s.rebill_no);
  if (!base) throw new PaymentError('첫 주문을 찾을 수 없어요.');
  return mockNotice({ pay_state: ok ? '4' : '99', price: String(base.amount), var1: base.order_id, var2: userId, rebill_no: s.rebill_no, goodname: planInfo('monthly').name });
}

export function lastOrderForUser(userId: string) {
  return all("SELECT order_id FROM payments WHERE user_id = ? AND kind = 'first' AND status = 'paid' ORDER BY paid_at DESC LIMIT 1", userId)[0];
}
