import React, { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.ts';
import { useApp } from '../lib/app.tsx';
import { track } from '../lib/pixel.ts';
import { navigate } from '../lib/router.tsx';
import { Button, Card, Page, Spinner, TopBar } from '../components/ui.tsx';

export function CheckoutSuccess({ search }: { search: string }) {
  const { refreshMe } = useApp();
  const [error, setError] = useState('');
  const once = useRef(false);
  const q = new URLSearchParams(search);
  const readingId = q.get('r');
  const next = readingId ? `/r/${readingId}` : '/me';

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    const body =
      q.get('mode') === 'pass'
        ? { mode: 'pass', paymentKey: q.get('paymentKey'), orderId: q.get('orderId'), amount: Number(q.get('amount')) }
        : { mode: 'auto', authKey: q.get('authKey'), customerKey: q.get('customerKey') };
    api<{ orderId: string; amount: number; firstTime: boolean }>('/api/checkout/confirm', body)
      .then(async (r) => {
        if (r.firstTime) track('Purchase', { value: r.amount, currency: 'KRW' }, r.orderId);
        await refreshMe();
        navigate(next, { replace: true });
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Page>
      <TopBar right={<span />} />
      <div className="px-4 pt-10">
        {error ? (
          <Card>
            <h1 className="text-[20px] font-bold tracking-tight">결제를 완료하지 못했어요</h1>
            <p className="mb-5 mt-2 text-[15px] leading-[1.6] text-sub">{error}</p>
            <Button onClick={() => navigate(next, { replace: true })}>돌아가기</Button>
          </Card>
        ) : (
          <div className="flex flex-col items-center gap-4 py-16 text-[17px] text-sub">
            <Spinner className="h-8 w-8 text-primary" />
            결제를 확인하고 있어요
          </div>
        )}
      </div>
    </Page>
  );
}

export function CheckoutFail({ search }: { search: string }) {
  const q = new URLSearchParams(search);
  const readingId = q.get('r');
  const code = q.get('code');
  const canceled = code === 'PAY_PROCESS_CANCELED' || code === 'USER_CANCEL';
  return (
    <Page>
      <TopBar />
      <div className="px-4 pt-10">
        <Card>
          <h1 className="text-[20px] font-bold tracking-tight">{canceled ? '결제를 취소했어요' : '결제가 되지 않았어요'}</h1>
          {!canceled && <p className="mt-2 text-[15px] leading-[1.6] text-sub">{q.get('message') || '잠시 후 다시 시도해 주세요.'}</p>}
          <Button className="mt-5" onClick={() => navigate(readingId ? `/r/${readingId}` : '/', { replace: true })}>
            돌아가기
          </Button>
        </Card>
      </div>
    </Page>
  );
}
