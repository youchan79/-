declare global {
  interface Window {
    TossPayments?: any;
  }
}

export interface CheckoutParams {
  provider: 'toss' | 'mock';
  mode: 'auto' | 'pass';
  clientKey: string;
  customerKey: string;
  customerEmail: string;
  amount: number;
  orderName: string;
  orderId: string | null;
  successUrl: string;
  failUrl: string;
}

let sdkPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (window.TossPayments) return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://js.tosspayments.com/v2/standard';
      s.onload = () => resolve();
      s.onerror = () => {
        sdkPromise = null;
        reject(new Error('결제창을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'));
      };
      document.head.appendChild(s);
    });
  }
  return sdkPromise;
}

function withParams(url: string, params: Record<string, string>) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

/** 결제창을 연다. 성공하면 successUrl로 이동하므로 이 함수는 돌아오지 않는다. */
export async function openCheckout(p: CheckoutParams) {
  if (p.provider === 'mock') {
    // 개발용: 토스 결제창 대신 바로 성공 페이지로 보낸다.
    const fake = 'mock_' + Math.random().toString(36).slice(2);
    const url =
      p.mode === 'auto'
        ? withParams(p.successUrl, { customerKey: p.customerKey, authKey: fake })
        : withParams(p.successUrl, { paymentKey: fake, orderId: p.orderId!, amount: String(p.amount) });
    location.href = url;
    return;
  }

  await loadSdk();
  const toss = window.TossPayments(p.clientKey);
  const payment = toss.payment({ customerKey: p.customerKey });
  if (p.mode === 'auto') {
    await payment.requestBillingAuth({
      method: 'CARD',
      successUrl: p.successUrl,
      failUrl: p.failUrl,
      customerEmail: p.customerEmail,
    });
  } else {
    await payment.requestPayment({
      method: 'CARD',
      amount: { currency: 'KRW', value: p.amount },
      orderId: p.orderId,
      orderName: p.orderName,
      successUrl: p.successUrl,
      failUrl: p.failUrl,
      customerEmail: p.customerEmail,
      card: { useEscrow: false, flowMode: 'DEFAULT', useCardPoint: false, useAppCardOnly: false },
    });
  }
}
