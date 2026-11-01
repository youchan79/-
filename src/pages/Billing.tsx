import React, { useEffect, useState } from 'react';
import { ChevronLeft, CircleAlert, ExternalLink, Mail } from 'lucide-react';
import { api, formatDate, won } from '../lib/api.ts';
import { useApp } from '../lib/app.tsx';
import { Link, navigate } from '../lib/router.tsx';
import { useApiErrorHandler } from '../components/Modals.tsx';
import { Button, Spinner } from '../components/ui.tsx';
import { planLabel } from './Subscription.tsx';

type Payment = { orderId: string; plan: string; kind: string; amount: number; refunded: boolean; paidAt: string; receiptUrl: string | null };

function Page({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto max-w-[720px] px-4 pb-16 pt-6 md:px-6">
        <div className="relative flex items-center justify-center">
          <button
            type="button"
            onClick={() => (history.length > 1 ? history.back() : navigate('/settings?tab=subscription'))}
            className="absolute left-0 inline-flex h-9 items-center gap-1 rounded-full border border-line px-3.5 text-[14px] hover:bg-soft"
          >
            <ChevronLeft size={16} /> 돌아가기
          </button>
          <h1 className="text-[16px] font-semibold">{title}</h1>
        </div>
        <p className="mt-6 text-[15px] text-sub">{desc}</p>
        {children}
      </div>
    </div>
  );
}

/** 설정 > 구독 > 청구·영수증 */
export function Billing() {
  const { me, openLogin } = useApp();
  const onError = useApiErrorHandler();
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const loggedIn = !!me?.user;

  useEffect(() => {
    if (!loggedIn) return;
    api<{ payments: Payment[] }>('/api/payments')
      .then((r) => setPayments(r.payments))
      .catch((e) => {
        setPayments([]);
        onError(e);
      });
  }, [loggedIn]);

  return (
    <Page title="구독·결제 정보" desc="지금까지 결제한 내역과 영수증을 볼 수 있어요">
      <div className="mt-6 px-1 text-[13px] text-muted">결제 내역</div>
      <div className="mt-2 overflow-hidden rounded-[20px] bg-soft">
        {!loggedIn ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <p className="text-[15px] text-sub">로그인하면 결제 내역을 볼 수 있어요</p>
            <Button variant="outline" onClick={() => openLogin()}>
              로그인
            </Button>
          </div>
        ) : payments === null ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-5 w-5" />
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-[15px] text-muted">
            <CircleAlert size={20} />
            아직 결제한 내역이 없어요.
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {payments.map((p) => (
              <li key={p.orderId} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <div className="text-[15px] font-medium">
                    {planLabel(p.plan)} {p.kind === 'renewal' ? '자동 결제' : '결제'}
                  </div>
                  <div className="mt-0.5 text-[13px] text-muted">{formatDate(p.paidAt)}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={`text-[15px] font-medium ${p.refunded ? 'text-muted line-through' : ''}`}>{won(p.amount)}</div>
                  {p.refunded ? (
                    <div className="mt-0.5 text-[13px] text-muted">환불됨</div>
                  ) : (
                    p.receiptUrl && (
                      <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-[13px] text-sub underline">
                        영수증 <ExternalLink size={12} />
                      </a>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-6 flex justify-end">
        <Button variant="outline" onClick={() => navigate('/refund')}>
          환불 요청하기
        </Button>
      </div>
    </Page>
  );
}

/** 청구·영수증 > 환불 요청하기 */
export function Refund() {
  const { config, me } = useApp();
  if (!config) return null;
  const email = config.business.email;
  const subject = encodeURIComponent(`[${config.serviceName}] 환불 요청`);
  const body = encodeURIComponent(`계정 이메일: ${me?.user?.email ?? ''}\n결제일 또는 결제번호: \n환불을 원하는 이유: \n`);
  return (
    <Page title="환불" desc="환불이 필요하면 아래 방법으로 요청해 주세요">
      <h2 className="mt-6 text-[15px] font-semibold">환불은 이렇게 진행돼요</h2>
      <p className="mt-2 text-[15px] leading-[1.7] text-sub">
        아래 메일 주소로 로그인한 계정 이메일과 결제일(또는 결제번호)을 보내 주시면, 확인한 뒤 영업일 기준 3일 안에 처리해 드려요. 결제 후 7일 이내이고 유료 기능을 쓰지 않았다면 전액
        환불돼요. 그 밖의 경우는{' '}
        <Link to="/refund-policy" className="underline">
          환불 정책
        </Link>
        을 따라요.
      </p>
      <a
        href={`mailto:${email}?subject=${subject}&body=${body}`}
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-soft px-5 text-[15px] font-medium hover:opacity-90"
      >
        <Mail size={16} /> 메일로 환불 요청하기
      </a>
      <p className="mt-3 text-[15px] text-sub">{email}</p>
      <div className="mt-8 flex justify-end border-t border-line pt-6">
        <Button onClick={() => navigate('/home')}>홈으로</Button>
      </div>
    </Page>
  );
}
