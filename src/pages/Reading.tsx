import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api, won, type ReadingResponse } from '../lib/api.ts';
import { useApp } from '../lib/app.tsx';
import { track } from '../lib/pixel.ts';
import { Link, navigate } from '../lib/router.tsx';
import { Markdown } from '../lib/markdown.tsx';
import { BottomCta, Button, Card, CardTitle, Footer, Page, Spinner, TopBar } from '../components/ui.tsx';
import { ELEMENT_STYLE, ElementBars, PillarTable } from '../components/Saju.tsx';

function LockedSections({ sections }: { sections: ReadingResponse['sections'] }) {
  return (
    <div className="space-y-2">
      {sections.map((s) => (
        <div key={s.title} className="relative overflow-hidden rounded-2xl bg-field px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[16px] font-semibold text-ink">{s.title}</div>
              <div className="mt-0.5 text-[14px] text-muted">{s.hint}</div>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0 text-muted" aria-hidden>
              <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M8 11V8a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </div>
          <div className="mt-3 space-y-1.5 blur-[5px]" aria-hidden>
            <div className="h-3 w-full rounded bg-line" />
            <div className="h-3 w-11/12 rounded bg-line" />
            <div className="h-3 w-2/3 rounded bg-line" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportBlock({ reading, reload }: { reading: ReadingResponse; reload: () => Promise<void> }) {
  const { showToast } = useApp();
  const report = reading.report!;
  const started = useRef(false);

  const start = useCallback(async () => {
    try {
      await api(`/api/readings/${reading.id}/report`, {});
      await reload();
    } catch (e: any) {
      showToast(e.message);
    }
  }, [reading.id, reload, showToast]);

  useEffect(() => {
    if (report.status === 'none' && !started.current) {
      started.current = true;
      void start();
    }
  }, [report.status, start]);

  useEffect(() => {
    if (report.status !== 'generating') return;
    const t = window.setInterval(() => void reload(), 1500);
    return () => window.clearInterval(t);
  }, [report.status, reload]);

  if (report.status === 'error') {
    return (
      <Card>
        <CardTitle>전체 풀이</CardTitle>
        <p className="mb-4 text-[15px] text-sub">풀이를 만드는 중에 문제가 생겼어요.</p>
        <Button variant="secondary" onClick={() => void start()}>
          다시 만들기
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      {report.md ? (
        <Markdown text={report.md} />
      ) : (
        <div className="flex items-center gap-3 py-6 text-[16px] text-sub">
          <Spinner className="text-primary" />
          사주를 자세히 읽고 있어요
        </div>
      )}
      {report.status === 'generating' && report.md && (
        <div className="mt-4 flex items-center gap-2 text-[14px] text-muted">
          <Spinner className="h-4 w-4 text-primary" />
          계속 쓰는 중
        </div>
      )}
    </Card>
  );
}

export default function Reading({ id }: { id: string }) {
  const { config, startCheckout, checkoutBusy } = useApp();
  const [reading, setReading] = useState<ReadingResponse | null>(null);
  const [error, setError] = useState('');
  const viewed = useRef(false);

  const load = useCallback(async () => {
    try {
      const r = await api<ReadingResponse>(`/api/readings/${id}`);
      setReading(r);
      if (!viewed.current) {
        viewed.current = true;
        track('ViewContent', { content_name: 'saju_preview', value: config?.plan.price, currency: 'KRW' });
      }
    } catch (e: any) {
      setError(e.message);
    }
  }, [id, config?.plan.price]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <Page>
        <TopBar />
        <div className="px-4">
          <Card>
            <p className="mb-4 text-[16px] text-sub">{error}</p>
            <Button onClick={() => navigate('/')}>새로 보기</Button>
          </Card>
        </div>
      </Page>
    );
  }
  if (!reading) {
    return (
      <Page>
        <TopBar />
        <div className="flex justify-center py-20 text-primary">
          <Spinner />
        </div>
      </Page>
    );
  }

  const { chart, preview } = reading;
  const dm = chart.dayMaster;
  const dmStyle = ELEMENT_STYLE[dm.element];
  const locked = !reading.access;

  return (
    <Page bottomPad={locked}>
      <TopBar />
      <div className="space-y-3 px-4">
        <div className="px-1 pb-2 pt-2">
          <h1 className="text-[26px] font-bold tracking-[-0.03em]">{reading.name}님의 사주</h1>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[14px] text-muted">
            <span>양력 {chart.solarDate}</span>
            <span>음력 {chart.lunarDate}</span>
            {reading.birthTime && <span>{reading.birthTime}</span>}
            <span>{chart.zodiac}띠</span>
          </div>
        </div>

        <Card>
          <CardTitle sub="위는 천간, 아래는 지지예요">사주팔자</CardTitle>
          <PillarTable chart={chart} />
        </Card>

        <Card>
          <div className="text-[14px] text-muted">나를 나타내는 글자</div>
          <div className="mt-3 flex items-center gap-4">
            <div className={`flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl ${dmStyle.soft}`}>
              <span className={`hanja text-[40px] font-semibold ${dmStyle.text}`}>{dm.gan}</span>
            </div>
            <div>
              <div className="text-[14px] text-muted">
                {dm.ko}
                {dm.element} 일간
              </div>
              <div className="text-[20px] font-bold leading-[1.35] tracking-tight">{preview.dayMasterTitle}</div>
            </div>
          </div>
          <p className="mt-4 text-[16px] leading-[1.7] text-sub">{preview.dayMasterSummary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {preview.keywords.map((k) => (
              <span key={k} className="rounded-full bg-field px-3 py-1.5 text-[14px] text-sub">
                {k}
              </span>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>오행 분포</CardTitle>
          <ElementBars counts={chart.elementCounts} />
          <div className="mt-5 space-y-2">
            {preview.elementNotes.map((n) => (
              <p key={n} className="text-[15px] leading-[1.65] text-sub">
                {n}
              </p>
            ))}
          </div>
        </Card>

        {locked ? (
          <Card>
            <CardTitle sub="구독하면 바로 이어서 볼 수 있어요">전체 풀이</CardTitle>
            <LockedSections sections={reading.sections} />
            <p className="mt-4 text-[13px] leading-[1.6] text-muted">
              {config?.billingMode === 'auto'
                ? `${config.plan.days}일마다 자동 결제되고 언제든 해지할 수 있어요. `
                : `${config?.plan.days ?? 30}일 이용권이며 자동 결제되지 않아요. `}
              전체 풀이를 열람하거나 상담을 이용하면 청약철회가 제한돼요.{' '}
              <Link to="/refund" className="underline">
                환불정책
              </Link>
            </p>
          </Card>
        ) : (
          <>
            <ReportBlock reading={reading} reload={load} />
            <Card>
              <CardTitle sub={`하루 ${config?.plan.chatDailyLimit ?? 20}번까지 물어볼 수 있어요`}>더 궁금한 게 있나요?</CardTitle>
              <Button onClick={() => navigate(`/r/${reading.id}/chat`)}>AI 상담사에게 물어보기</Button>
            </Card>
          </>
        )}

        {!locked && (
          <Link to="/" className="block py-3 text-center text-[15px] text-muted">
            다른 사람 사주 보기
          </Link>
        )}
      </div>
      <Footer />

      {locked && config && (
        <BottomCta>
          <Button onClick={() => void startCheckout(reading.id)} disabled={checkoutBusy}>
            {checkoutBusy ? <Spinner /> : `전체 풀이 보기 ${config.billingMode === 'auto' ? '월 ' : ''}${won(config.plan.price)}`}
          </Button>
        </BottomCta>
      )}
    </Page>
  );
}
