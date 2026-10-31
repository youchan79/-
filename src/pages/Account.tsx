import React, { useEffect, useState } from 'react';
import { api, formatKstDate, won } from '../lib/api.ts';
import { useApp } from '../lib/app.tsx';
import { Link, navigate } from '../lib/router.tsx';
import { Button, Card, CardTitle, Footer, Page, Spinner, TopBar } from '../components/ui.tsx';

interface ReadingRow {
  id: string;
  name: string;
  birth_date: string;
  calendar: string;
  report_status: string;
}

function SubscriptionCard() {
  const { me, config, refreshMe, startCheckout, checkoutBusy, showToast } = useApp();
  const [busy, setBusy] = useState(false);
  const s = me?.subscription;

  const act = async (path: string, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    try {
      await api(path, {});
      await refreshMe();
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!s || !s.active) {
    return (
      <Card>
        <CardTitle sub={s ? `${formatKstDate(s.periodEnd)}에 이용이 끝났어요` : '아직 구독하지 않았어요'}>구독</CardTitle>
        {config && (
          <Button onClick={() => void startCheckout()} disabled={checkoutBusy}>
            {checkoutBusy ? <Spinner /> : `구독 시작하기 ${won(config.plan.price)}`}
          </Button>
        )}
      </Card>
    );
  }

  const end = formatKstDate(s.periodEnd);
  const statusText =
    s.status === 'past_due'
      ? '결제가 실패해 다시 시도하는 중이에요. 카드 상태를 확인해 주세요.'
      : s.mode === 'pass'
        ? `${end}까지 이용할 수 있어요. 자동으로 결제되지 않아요.`
        : s.cancelAtPeriodEnd
          ? `해지 예약됨. ${end}까지 이용할 수 있어요.`
          : `다음 결제일은 ${end}이에요.`;

  return (
    <Card>
      <CardTitle sub={statusText}>{s.mode === 'pass' ? '이용권 사용 중' : '구독 중'}</CardTitle>
      <div className="mb-4 flex items-baseline justify-between rounded-2xl bg-field px-4 py-3.5">
        <span className="text-[15px] text-sub">{s.cardLabel ?? (s.mode === 'pass' ? `${config?.plan.days ?? 30}일 이용권` : '결제 금액')}</span>
        <span className="text-[20px] font-bold tabular-nums">{won(s.amount)}</span>
      </div>
      {s.mode === 'auto' && !s.cancelAtPeriodEnd && (
        <Button variant="ghost" disabled={busy} onClick={() => void act('/api/subscription/cancel', `해지하면 ${end} 이후로 결제되지 않아요. 해지할까요?`)}>
          구독 해지
        </Button>
      )}
      {s.mode === 'auto' && s.cancelAtPeriodEnd && (
        <Button variant="secondary" disabled={busy} onClick={() => void act('/api/subscription/resume')}>
          해지 취소하고 계속 구독
        </Button>
      )}
      {s.mode === 'pass' && config && (
        <Button variant="secondary" disabled={checkoutBusy} onClick={() => void startCheckout()}>
          {`${config.plan.days}일 연장하기 ${won(config.plan.price)}`}
        </Button>
      )}
    </Card>
  );
}

export default function Account({ search }: { search: string }) {
  const { me, openAuth, refreshMe } = useApp();
  const [readings, setReadings] = useState<ReadingRow[] | null>(null);

  useEffect(() => {
    if (me && !me.user) openAuth({ mode: new URLSearchParams(search).get('login') ? 'login' : 'signup' });
    if (me?.user) {
      api<{ readings: ReadingRow[] }>('/api/my/readings')
        .then((r) => setReadings(r.readings))
        .catch(() => setReadings([]));
    }
  }, [me, openAuth, search]);

  if (!me) return null;

  if (!me.user) {
    return (
      <Page>
        <TopBar right={<span />} />
        <div className="px-4">
          <Card>
            <p className="mb-4 text-[16px] text-sub">로그인하면 구독과 풀이 기록을 볼 수 있어요.</p>
            <Button onClick={() => openAuth({ mode: 'login' })}>로그인</Button>
          </Card>
        </div>
        <Footer />
      </Page>
    );
  }

  return (
    <Page>
      <TopBar right={<span />} />
      <div className="space-y-3 px-4">
        <div className="px-1 pb-2 pt-2">
          <h1 className="text-[26px] font-bold tracking-[-0.03em]">내 정보</h1>
          <p className="mt-1 text-[15px] text-muted">{me.user.email}</p>
        </div>
        <SubscriptionCard />
        <Card>
          <CardTitle>사주 기록</CardTitle>
          {readings === null ? (
            <Spinner className="text-primary" />
          ) : readings.length === 0 ? (
            <p className="text-[15px] text-muted">아직 본 사주가 없어요.</p>
          ) : (
            <ul className="-mx-2">
              {readings.map((r) => (
                <li key={r.id}>
                  <Link to={`/r/${r.id}`} className="flex items-center justify-between rounded-2xl px-2 py-3 active:bg-field">
                    <span className="text-[16px] font-medium">{r.name}</span>
                    <span className="text-[14px] text-muted">
                      {r.calendar === 'lunar' ? '음력 ' : ''}
                      {r.birth_date.replace(/-/g, '.')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Button variant="secondary" className="mt-3" onClick={() => navigate('/')}>
            새 사주 보기
          </Button>
        </Card>
        <button
          className="w-full py-4 text-[15px] text-muted"
          onClick={async () => {
            await api('/api/auth/logout', {});
            await refreshMe();
            navigate('/');
          }}
        >
          로그아웃
        </button>
      </div>
      <Footer />
    </Page>
  );
}
