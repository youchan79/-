import { loadTossPayments, type TossPaymentsWidgets } from '@tosspayments/tosspayments-sdk';
import { Check, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Header } from '../components/Header.tsx';
import { Link } from '../components/Link.tsx';
import { ErrorNote, InfoNote, Spinner } from '../components/Notice.tsx';
import { api } from '../lib/api.ts';
import { useApp } from '../lib/app.tsx';
import { won } from '../lib/text.ts';

export function Pricing() {
  const { config, session, account } = useApp();
  const [paying, setPaying] = useState(false);

  const free = [`하루 AI ${config.freeDailyLimit}회`, '경험 정리 · 기업 분석 · 초안 · 첨삭 · 피드백 모두 사용', '작성 내용 계정에 저장'];
  const pro = ['AI 사용 횟수 제한 없음', '무료의 모든 기능', `결제일부터 30일 (자동 결제 없음)`];

  return (
    <div className="min-h-dvh">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="font-serif text-3xl font-bold sm:text-4xl">요금제</h1>
        <p className="mt-2 text-muted">마감이 몰리는 시즌에만 프로로 올려 쓰세요. 자동으로 다시 결제되지 않아요.</p>

        {!config.auth && (
          <div className="mt-6">
            <InfoNote>지금은 로컬 모드라 요금제 없이 모든 기능을 쓸 수 있어요.</InfoNote>
          </div>
        )}

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <Plan title="무료" price="0원" items={free} current={account?.plan === 'free'} />
          <Plan
            title="프로"
            price={`${won(config.proPrice)} / 30일`}
            items={pro}
            current={account?.plan === 'pro'}
            highlight
            note={account?.plan === 'pro' && account.proUntil ? `${new Date(account.proUntil).toLocaleDateString('ko-KR')}까지 이용 중` : undefined}
          >
            {!config.auth ? null : !session ? (
              <Link to="/login?next=/pricing" className="btn-sun w-full py-3">로그인하고 업그레이드</Link>
            ) : !config.toss ? (
              <p className="text-sm text-white/80">결제가 아직 설정되지 않았어요. (서버 .env의 TOSS_CLIENT_KEY, TOSS_SECRET_KEY)</p>
            ) : (
              <button className="btn-sun w-full py-3" onClick={() => setPaying(true)}>
                <Sparkles size={16} /> {account?.plan === 'pro' ? '30일 연장하기' : '프로로 업그레이드'}
              </button>
            )}
          </Plan>
        </div>

        {paying && config.toss && session && <Checkout clientKey={config.toss.clientKey} customerKey={session.user.id} onClose={() => setPaying(false)} />}
      </main>
    </div>
  );
}

function Plan(props: { title: string; price: string; items: string[]; current?: boolean; highlight?: boolean; note?: string; children?: ReactNode }) {
  return (
    <section className={`card flex flex-col p-6 ${props.highlight ? 'border-pine bg-pine text-white' : ''}`}>
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold">{props.title}</h2>
        {props.current && <span className={`chip ${props.highlight ? 'bg-sun text-ink' : ''}`}>지금 요금제</span>}
      </div>
      <p className="mt-2 font-serif text-3xl font-black">{props.price}</p>
      {props.note && <p className="mt-1 text-sm opacity-80">{props.note}</p>}
      <ul className="mt-5 flex-1 space-y-2.5">
        {props.items.map((item) => (
          <li key={item} className="flex gap-2">
            <Check size={18} className={props.highlight ? 'text-sun' : 'text-pine'} />
            {item}
          </li>
        ))}
      </ul>
      {props.children && <div className="mt-6">{props.children}</div>}
    </section>
  );
}

/** 토스페이먼츠 결제위젯 */
function Checkout({ clientKey, customerKey, onClose }: { clientKey: string; customerKey: string; onClose: () => void }) {
  const widgets = useRef<TossPaymentsWidgets | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const order = await api.order();
        const toss = await loadTossPayments(clientKey);
        const w = toss.widgets({ customerKey });
        await w.setAmount({ currency: 'KRW', value: order.amount });
        await Promise.all([
          w.renderPaymentMethods({ selector: '#toss-methods', variantKey: 'DEFAULT' }),
          w.renderAgreement({ selector: '#toss-agreement', variantKey: 'AGREEMENT' }),
        ]);
        if (cancelled) return;
        widgets.current = w;
        sessionStorage.setItem('jasa:order', JSON.stringify(order));
        setReady(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '결제창을 불러오지 못했어요.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientKey, customerKey]);

  async function pay() {
    const order = JSON.parse(sessionStorage.getItem('jasa:order') ?? 'null');
    if (!widgets.current || !order) return;
    setBusy(true);
    setError('');
    try {
      await widgets.current.requestPayment({
        orderId: order.orderId,
        orderName: order.orderName,
        successUrl: `${location.origin}/pay/success`,
        failUrl: `${location.origin}/pay/fail`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '결제를 시작하지 못했어요.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-ink/40 sm:place-items-center" onClick={onClose}>
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 sm:max-w-lg sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">프로 30일 결제</h2>
          <button className="text-sm text-muted hover:text-ink" onClick={onClose}>닫기</button>
        </div>
        {!ready && !error && (
          <p className="flex items-center gap-2 py-10 text-muted">
            <Spinner /> 결제창을 불러오는 중…
          </p>
        )}
        <div id="toss-methods" />
        <div id="toss-agreement" />
        <div className="mt-3 space-y-3">
          <ErrorNote>{error}</ErrorNote>
          {ready && (
            <button className="btn-primary w-full py-3" onClick={pay} disabled={busy}>
              {busy && <Spinner />} 결제하기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
