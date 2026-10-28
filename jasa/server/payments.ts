import { randomBytes } from 'node:crypto';
import type { ConfirmRequest, OrderResponse } from '../src/types.ts';
import { admin, extendPro } from './account.ts';
import { config, HttpError } from './config.ts';

const ORDER_NAME = `자사 프로 ${config.proDays}일`;

function requirePayments() {
  if (!admin || !config.toss) throw new HttpError(503, '결제가 아직 설정되지 않았어요.');
  return { db: admin, toss: config.toss };
}

/** 결제 전에 주문을 만들어 두고, 승인 때 금액·주인을 대조함 */
export async function createOrder(userId: string): Promise<OrderResponse> {
  const { db } = requirePayments();
  const orderId = `jasa-${Date.now()}-${randomBytes(6).toString('hex')}`;
  const { error } = await db
    .from('payments')
    .insert({ order_id: orderId, user_id: userId, amount: config.proPrice, status: 'ready' });
  if (error) throw error;
  return { orderId, orderName: ORDER_NAME, amount: config.proPrice };
}

export async function confirmPayment(userId: string, req: ConfirmRequest) {
  const { db, toss } = requirePayments();
  const { data: order, error } = await db.from('payments').select('*').eq('order_id', req.orderId).maybeSingle();
  if (error) throw error;
  if (!order || order.user_id !== userId) throw new HttpError(404, '주문을 찾을 수 없어요.');
  if (order.status === 'done') return; // 새로고침 등으로 같은 승인이 다시 와도 한 번만 처리
  if (order.amount !== Number(req.amount)) throw new HttpError(400, '결제 금액이 주문과 달라요.');

  const res = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${toss.secretKey}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentKey: req.paymentKey, orderId: order.order_id, amount: order.amount }),
  });
  const body = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) {
    await db.from('payments').update({ status: 'failed' }).eq('order_id', order.order_id);
    throw new HttpError(400, body.message ?? '결제 승인에 실패했어요.');
  }
  const { error: updateError } = await db
    .from('payments')
    .update({ status: 'done', payment_key: req.paymentKey, approved_at: new Date().toISOString() })
    .eq('order_id', order.order_id);
  if (updateError) throw updateError;
  await extendPro(userId, config.proDays);
}
