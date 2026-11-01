import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Brain, Check, ChevronDown, ChevronLeft, CreditCard, FileStack, Layers, ListChecks, Lock, MessageCircle, ShieldCheck } from 'lucide-react';
import { api, formatDay, formatRenew, kst, nextWeeklyReset, won, type AppConfig, type SubView } from '../lib/api.ts';
import { useApp } from '../lib/app.tsx';
import { track } from '../lib/pixel.ts';
import { Link, navigate } from '../lib/router.tsx';
import { PRO_FEATURES, useApiErrorHandler } from '../components/Modals.tsx';
import { Button, Modal, Spinner } from '../components/ui.tsx';

type Period = 'monthly' | 'yearly';

const FEATURES = [
  { icon: FileStack, title: 'PDF·유튜브 무제한 업로드 분석', sub: '시험 기간에 자료가 몰려도 횟수를 기다리지 않고 바로 정리해요.' },
  { icon: BookOpen, title: 'AI 요약', sub: '자료의 흐름대로 핵심을 정리하고, 어려운 부분은 쉬운 설명을 붙여 드려요.' },
  { icon: ListChecks, title: 'AI 퀴즈', sub: '자료로 연습 문제를 만들고, 해설로 헷갈리는 개념을 바로잡아요.' },
  { icon: Layers, title: 'AI 플래시카드', sub: '핵심 개념을 카드로 만들어 내 속도에 맞춰 반복해요.' },
  { icon: Brain, title: 'AI 마인드맵', sub: '개념 사이의 연결을 한 장의 지도로 그려 드려요.' },
  { icon: MessageCircle, title: 'AI 튜터', sub: '새벽 세 시에도 내 자료를 아는 튜터에게 물어볼 수 있어요.' },
];

function faq(c: AppConfig): Array<[string, string]> {
  const m = c.plans.monthly.price;
  const y = c.plans.yearly.price;
  return [
    [
      '기본 플랜과 Pro 플랜은 무엇이 다른가요?',
      `가장 큰 차이는 올릴 수 있는 횟수예요. 기본 플랜은 PDF와 유튜브를 매주 ${c.free.weeklyFiles}회씩 올릴 수 있고(월요일 0시에 다시 채워져요), 강의 녹음과 실시간 자막은 계속 무료예요. Pro는 업로드, 요약·퀴즈·플래시카드 같은 학습 자료 만들기, AI 튜터 질문이 모두 무제한이고 1GB까지의 긴 녹음 파일도 올릴 수 있어요.`,
    ],
    [
      '구독은 어떻게 해지하나요?',
      '구독 관리 화면(이 페이지)이나 설정 > 구독에서 언제든 해지할 수 있어요. 해지하면 다음 결제일부터 결제되지 않고, 이미 결제한 기간이 끝날 때까지는 Pro를 그대로 쓸 수 있어요.',
    ],
    [
      '월간과 연간은 어떻게 다른가요?',
      `월간은 ${won(m)}이 매달 같은 날 자동 결제돼요. 연간은 ${won(y)}(한 달 ${won(Math.round(y / 12))} 꼴)을 한 번 결제하고 1년 동안 쓰며, 자동으로 다시 결제되지 않아요. 월간을 쓰다가 연간으로 바꾸면 남은 기간 뒤에 1년이 붙고 월간 결제는 멈춰요.`,
    ],
    [
      '결제 후 환불도 가능한가요?',
      '가장 최근 결제가 7일 이내이고 결제한 뒤 유료 기능을 쓰지 않았다면 전액 환불해 드려요. 연간 이용권을 중간에 그만두면 남은 기간만큼 돌려드려요. 가입 이메일과 주문번호를 적어 고객센터 메일로 보내 주세요. 자세한 기준은 환불 정책에 있어요.',
    ],
    [
      '결제 카드를 바꾸고 싶어요',
      '지금은 등록한 카드를 바로 바꾸는 기능이 없어요. 구독을 해지한 뒤 이용 기간이 끝나면 새 카드로 다시 구독해 주세요. 해지해도 남은 기간까지는 Pro를 그대로 써요.',
    ],
    [
      'Pro를 결제했는데 적용이 안 돼요',
      '결제 확인까지 1분 정도 걸릴 수 있어요. 결제할 때 쓴 계정으로 로그인했는지 확인하고 새로고침해 보세요. 그래도 그대로라면 가입 이메일과 주문번호를 고객센터로 보내 주세요.',
    ],
    ['결제는 어떻게 처리되나요?', '결제는 결제대행사 페이앱을 통해 처리돼요. 월간 자동 결제는 신용·체크카드로 할 수 있어요. 스터디AI는 카드 번호를 저장하지 않아요.'],
    ['모바일 앱도 있나요?', '스토어 앱은 준비 중이에요. 휴대폰 브라우저에서 홈 화면에 추가하면 앱처럼 쓸 수 있어요.'],
    ['고객 센터가 있나요?', '사이드바의 피드백 남기기나 아래 이메일로 문의해 주세요. 결제 문의라면 가입 이메일과 주문번호를 함께 적어 주시면 순서대로 확인해 답해 드려요.'],
  ];
}

/** 한국 날짜 기준 월간 자동 결제일 (29~31일 가입은 말일) */
function billingDayLabel(now = new Date()) {
  const d = kst(now.toISOString()).getUTCDate();
  return d > 28 ? '말일' : `${d}일`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-3.5 text-[15px]">
      <span className="shrink-0 text-sub">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

/** 결제 확인 창: 금액, 이용 기간, 결제 수단, 혜택, 자동 결제·환불 안내 */
function CheckoutSheet({ period, onClose, onSubmit, busy }: { period: Period | null; onClose: () => void; onSubmit: (phone: string) => void; busy: boolean }) {
  const { me, config } = useApp();
  const [phone, setPhone] = useState(me?.user?.phone ?? '');
  useEffect(() => setPhone(me?.user?.phone ?? ''), [me?.user?.phone]);
  if (!config || !period) return null;
  const digits = phone.replace(/\D/g, '');
  const valid = /^01[016789]\d{7,8}$/.test(digits);
  const monthly = period === 'monthly';
  const price = config.plans[period].price;
  const upgrade = !monthly && me?.sub?.pro && me.sub.plan === 'monthly' && me.sub.periodEnd;
  return (
    <Modal open onClose={onClose} width={460}>
      <h2 className="pr-8 text-[20px] font-semibold">{monthly ? 'Pro 플랜 월간 구독 결제' : 'Pro 플랜 연간 이용권 결제'}</h2>
      <div className="mt-4 border-t border-line">
        <Row label="결제 금액">
          <span className="text-[18px] font-semibold">{won(price)}</span>
        </Row>
        <Row label="이용 기간">
          {monthly ? '결제하는 즉시 시작 · 1개월마다 자동 연장' : upgrade ? `지금 기간이 끝나는 ${formatDay(me!.sub!.periodEnd!)}부터 1년` : '결제하는 즉시 시작 · 1년 동안'}
        </Row>
      </div>
      <div className="mt-4 text-[14px] text-sub">결제 수단</div>
      <div className="mt-2 flex items-center gap-2 rounded-full bg-solid px-4 py-2.5 text-[14px] font-medium text-on-solid">
        <CreditCard size={16} /> {monthly ? '신용·체크카드' : '신용·체크카드 · 간편결제'}
        <span className="ml-auto text-[13px] font-normal opacity-70">페이앱 결제창에서 입력</span>
      </div>
      <label className="mt-4 block text-[14px] text-sub" htmlFor="pay-phone">
        휴대폰 번호 <span className="text-muted">(결제창에 필요해요, 광고 문자는 보내지 않아요)</span>
      </label>
      <input
        id="pay-phone"
        inputMode="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="010-0000-0000"
        className="mt-2 h-12 w-full rounded-xl border border-line bg-canvas px-4 text-[16px] outline-none focus:border-ink"
      />
      <div className="mt-5 text-[14px] text-sub">{monthly ? '구독 혜택' : '이용권 혜택'}</div>
      <ul className="mt-2 space-y-2">
        {PRO_FEATURES.map((f) => (
          <li key={f} className="flex items-center gap-2.5 text-[15px]">
            <Check size={16} className="shrink-0" /> {f}
          </li>
        ))}
      </ul>
      <ul className="mt-5 space-y-1.5 rounded-2xl bg-soft p-4 text-[13px] leading-[1.6] text-sub">
        {monthly ? (
          <>
            <li>· 오늘 {won(price)}이 결제되고, 해지하기 전까지 매달 {billingDayLabel()}에 {won(price)}이 자동 결제돼요.</li>
            <li>· 설정 &gt; 구독에서 언제든 해지할 수 있어요. 해지해도 결제한 기간 끝까지 Pro를 써요.</li>
          </>
        ) : (
          <>
            <li>· {won(price)}을 한 번 결제하고, 1년이 지나도 자동으로 다시 결제되지 않아요.</li>
            <li>· 중간에 그만두면 남은 기간만큼 돌려드려요.{upgrade ? ' 결제가 끝나면 월간 자동 결제는 멈춰요.' : ''}</li>
          </>
        )}
        <li>· 결제 후 7일 이내이고 유료 기능을 쓰지 않았다면 전액 환불돼요.</li>
      </ul>
      {/* 폰에서 내용이 길어도 결제 버튼은 늘 보이게 아래에 붙인다 */}
      <div className="sticky -bottom-6 -mx-6 -mb-6 mt-4 border-t border-line bg-canvas px-6 pb-6 pt-3">
        <p className="text-center text-[13px] text-muted">
          결제하면{' '}
          <a href="/refund-policy" target="_blank" className="font-medium text-sub underline">
            환불 정책
          </a>
          과{' '}
          <a href="/terms" target="_blank" className="font-medium text-sub underline">
            이용약관
          </a>
          에 동의한 것으로 봐요.
        </p>
        <Button size="lg" className="mt-3 w-full" disabled={!valid || busy} onClick={() => onSubmit(digits)}>
          {busy ? <Spinner className="h-4 w-4" /> : `${won(price)} 결제하기`}
        </Button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[13px] text-muted">
          <Lock size={13} /> 페이앱 결제창에서 암호화해 안전하게 결제돼요
        </p>
      </div>
    </Modal>
  );
}

/** 월간 구독 해지 버튼과 확인 창. 구독 관리 화면과 설정에서 같이 쓴다. */
export function CancelSubscription({ className = '' }: { className?: string }) {
  const { me, refreshMe, showToast } = useApp();
  const onError = useApiErrorHandler();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const sub = me?.sub;
  if (!sub?.autoRenew || !sub.periodEnd) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`text-[14px] text-muted underline underline-offset-2 hover:text-ink ${className}`}>
        구독 해지
      </button>
      <Modal open={open} onClose={() => setOpen(false)} width={400}>
        <h2 className="pr-8 text-[20px] font-semibold">구독을 해지할까요?</h2>
        <p className="mt-2 text-[15px] leading-[1.65] text-sub">
          {formatDay(sub.periodEnd)}까지는 Pro를 그대로 쓸 수 있고, 그 뒤로는 결제되지 않아요. 남은 기간을 돌려받는 해지는 아니에요.
        </p>
        <div className="mt-6 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            계속 쓰기
          </Button>
          <Button
            className="flex-1"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api('/api/subscription/cancel', {});
                await refreshMe();
                setOpen(false);
                showToast(`해지했어요. ${formatDay(sub.periodEnd!)}까지 Pro를 쓸 수 있어요.`);
              } catch (e) {
                onError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Spinner className="h-4 w-4" /> : '해지하기'}
          </Button>
        </div>
      </Modal>
    </>
  );
}

/** 지금 쓰는 플랜 한 줄 설명 (구독 관리 화면, 설정에서 같이 쓴다) */
export function planStatusText(sub: SubView | null | undefined) {
  if (!sub?.pro) return '';
  if (sub.plan === 'lifetime') return '기간 제한 없이 이용 중이에요 (예전에 결제한 이용권).';
  if (!sub.periodEnd) return '';
  if (sub.autoRenew) return `다음 결제일은 ${formatDay(sub.periodEnd)}이에요 (${won(sub.amount ?? 0)}).`;
  if (sub.canceled) return `해지 예약됨 · ${formatDay(sub.periodEnd)}까지 Pro를 쓸 수 있어요.`;
  return `${formatDay(sub.periodEnd)}까지 이용할 수 있어요 · 자동 결제 없음`;
}

export const planLabel = (plan: string | null | undefined) => (plan === 'monthly' ? 'Pro 월간' : plan === 'yearly' ? 'Pro 연간' : 'Pro');

function useOrderReturn(orderId: string | null) {
  const { refreshMe, showToast } = useApp();
  const [state, setState] = useState<'idle' | 'checking' | 'paid' | 'pending'>(orderId ? 'checking' : 'idle');
  const tries = useRef(0);
  useEffect(() => {
    if (!orderId) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await api<{ status: string; amount: number; firstConfirm: boolean; order_id: string }>(`/api/checkout/${orderId}`);
        if (r.status === 'paid') {
          if (r.firstConfirm) track('Purchase', { value: r.amount, currency: 'KRW' }, r.order_id);
          await refreshMe();
          setState('paid');
          showToast('Pro가 시작됐어요. 마음껏 정리해 보세요.');
          history.replaceState(null, '', '/subscription');
          return;
        }
      } catch {
        /* 무시하고 다시 시도 */
      }
      tries.current++;
      if (tries.current > 30) return setState('pending');
      if (!stop) window.setTimeout(tick, 2000);
    };
    void tick();
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);
  return state;
}

export default function Subscription({ search }: { search: string }) {
  const { config, me, openLogin } = useApp();
  const onError = useApiErrorHandler();
  const [period, setPeriod] = useState<Period>('monthly');
  const [sheet, setSheet] = useState<Period | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const orderState = useOrderReturn(new URLSearchParams(search).get('order'));

  if (!config) return null;
  const monthly = config.plans.monthly.price;
  const yearly = config.plans.yearly.price;
  const saving = monthly * 12 - yearly;
  const sub = me?.sub;
  const usage = me?.usage;
  const renewAt = usage?.renewAt ?? nextWeeklyReset();
  const left = (max: number, used?: number) => Math.max(0, max - (used ?? 0));

  const checkout = async (phone: string) => {
    if (!sheet) return;
    setBusy(true);
    try {
      const r = await api<{ payurl: string; orderId: string; amount: number }>('/api/checkout', { plan: sheet, phone });
      track('InitiateCheckout', { value: r.amount, currency: 'KRW', content_name: config.plans[sheet].name });
      location.href = r.payurl;
    } catch (e) {
      onError(e);
      setBusy(false);
    }
  };

  const start = (p: Period) => {
    if (!me?.user) return openLogin({ mode: 'signup', onDone: () => setSheet(p) });
    setSheet(p);
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto max-w-[1120px] px-4 pb-16 pt-6 md:px-6">
        <button type="button" onClick={() => (history.length > 1 ? history.back() : navigate('/home'))} className="inline-flex h-9 items-center gap-1 rounded-full border border-line px-3.5 text-[14px] hover:bg-soft">
          <ChevronLeft size={16} /> 돌아가기
        </button>

        <h1 className="mt-10 break-keep text-center text-[24px] font-normal leading-[1.3] tracking-[-0.03em] md:text-[32px] md:font-medium">
          정리는 AI에게 맡기고, <br className="md:hidden" />
          공부는 A+에 집중하세요
        </h1>
        <p className="mt-2 text-center text-[16px] text-muted">필요한 만큼 쓰고, 언제든 해지할 수 있어요</p>

        {orderState === 'checking' && (
          <div className="mx-auto mt-6 flex max-w-[560px] items-center justify-center gap-2 rounded-2xl bg-soft p-4 text-[15px]">
            <Spinner className="h-4 w-4" /> 결제를 확인하고 있어요
          </div>
        )}
        {orderState === 'pending' && (
          <div className="mx-auto mt-6 max-w-[560px] rounded-2xl bg-soft p-4 text-center text-[15px] text-sub">결제 확인이 늦어지고 있어요. 결제를 마쳤다면 잠시 후 새로고침해 주세요.</div>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-[1fr_272px]">
          <div className="overflow-hidden rounded-[24px] border border-line">
            <div className="gradient-pro px-6 py-7 text-[#111] md:px-8">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[18px] md:text-[20px]">Pro 플랜</div>
                <div className="flex items-center rounded-full bg-white p-1 shadow-sm" role="group" aria-label="결제 주기">
                  <button
                    type="button"
                    aria-pressed={period === 'monthly'}
                    onClick={() => setPeriod('monthly')}
                    className={`h-9 rounded-full px-4 text-[14px] ${period === 'monthly' ? 'bg-[#111] font-medium text-white' : 'text-[#333]'}`}
                  >
                    월간
                  </button>
                  <button
                    type="button"
                    aria-pressed={period === 'yearly'}
                    onClick={() => setPeriod('yearly')}
                    className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-[14px] ${period === 'yearly' ? 'bg-[#111] font-medium text-white' : 'text-[#333]'}`}
                  >
                    연간 <span className="whitespace-nowrap rounded-full bg-[#1f8a4c] px-2 py-0.5 text-[12px] font-medium text-white">{won(saving)} 절약</span>
                  </button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-[40px] font-medium tracking-[-0.03em] md:text-[44px]">{won(period === 'monthly' ? monthly : Math.round(yearly / 12))}</span>
                <span className="text-[14px]">/월</span>
                {period === 'yearly' && <span className="ml-1.5 text-[13px] text-[#333]">연 {won(yearly)}</span>}
              </div>
            </div>
            <div className="px-6 py-6 md:px-8">
              <ul className="space-y-3.5">
                {PRO_FEATURES.map((f, i) => (
                  <li key={f} className={`flex items-center gap-3 text-[15px] ${i === 0 ? 'font-semibold' : ''}`}>
                    <Check size={17} className="shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              {sub?.pro ? (
                <div className="mt-8 rounded-2xl bg-soft p-5">
                  <div className="text-[15px] font-semibold">{planLabel(sub.plan)} 이용 중</div>
                  <div className="mt-1 text-[14px] text-sub">{planStatusText(sub)}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <CancelSubscription />
                    {sub.plan === 'monthly' && config.paymentProvider !== 'none' && (
                      <button type="button" onClick={() => start('yearly')} className="text-[14px] font-medium underline underline-offset-2">
                        연간으로 바꾸고 {won(saving)} 아끼기
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <Button size="lg" className="mt-8 w-full" disabled={busy || config.paymentProvider === 'none'} onClick={() => start(period)}>
                    무제한으로 시작하기
                  </Button>
                  <p className="mt-2.5 text-center text-[13px] text-muted">{period === 'monthly' ? '언제든 해지할 수 있어요' : '1년치를 한 번에 결제해요 · 자동 결제 없음'}</p>
                  {config.paymentProvider === 'mock' && <p className="mt-1 text-center text-[12px] text-blue">개발 모드: 가짜 결제창으로 연결돼요</p>}
                </>
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-line p-6">
            <div className="text-[18px]">기본 플랜</div>
            {!sub?.pro && (
              <>
                <div className="mt-4 inline-flex rounded-full border border-line px-3 py-1 text-[13px]">
                  이번 주 남은 횟수: PDF {left(config.free.weeklyFiles, usage?.files)} · 유튜브 {left(config.free.weeklyYoutube, usage?.youtube)}
                </div>
                <div className="mt-2 text-[13px] leading-[1.6] text-muted">{formatRenew(renewAt)}에 갱신 · 남은 횟수는 다음 주로 넘어가지 않아요</div>
              </>
            )}
            <ul className="mt-4 space-y-2.5 text-[14px] text-sub">
              <li className="flex gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-muted" /> 매주 PDF {config.free.weeklyFiles}회 · 유튜브 {config.free.weeklyYoutube}회 업로드
              </li>
              <li className="flex gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-muted" /> 강의 녹음·실시간 자막
              </li>
              <li className="flex gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-muted" /> AI 튜터 하루 {config.free.dailyTutor}회
              </li>
            </ul>
          </div>
        </div>

        <h2 className="mt-24 text-center text-[26px] font-medium tracking-[-0.03em] md:text-[32px]">자료 정리는 AI가, 복습은 내가</h2>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-[20px] bg-soft p-6">
              <f.icon size={20} />
              <div className="mt-5 text-[16px] font-semibold">{f.title}</div>
              <p className="mt-2 text-[15px] leading-[1.6] text-sub">{f.sub}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-24 text-center text-[26px] font-medium tracking-[-0.03em]">자주 묻는 질문</h2>
        <div className="mx-auto mt-8 max-w-[760px] border-t border-line">
          {faq(config).map(([q, a], i) => (
            <div key={q} className="border-b border-line">
              <button type="button" onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 py-5 text-left text-[16px]">
                {q}
                <ChevronDown size={18} className={`shrink-0 text-muted transition ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && <p className="pb-5 text-[15px] leading-[1.7] text-sub">{a}</p>}
            </div>
          ))}
        </div>

        <footer className="mt-24 border-t border-line pt-8 text-[13px] leading-[1.8] text-muted">
          <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sub">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck size={14} /> 안전한 결제
            </span>
            <Link to="/terms">이용약관</Link>
            <Link to="/privacy" className="font-semibold">
              개인정보 처리방침
            </Link>
            <Link to="/refund-policy">환불 안내</Link>
          </div>
          <BizInfo />
        </footer>
      </div>
      <CheckoutSheet period={sheet} onClose={() => !busy && setSheet(null)} onSubmit={(p) => void checkout(p)} busy={busy} />
    </div>
  );
}

export function BizInfo() {
  const { config } = useApp();
  if (!config) return null;
  const b = config.business;
  return (
    <>
      <p>
        {b.name} | 대표: {b.owner}
      </p>
      {b.regNo ? <p>사업자등록번호: {b.regNo}</p> : null}
      {b.mailOrderNo && <p>통신판매: {b.mailOrderNo}</p>}
      <p>주소: {b.address}</p>
      <p>전화번호: {b.phone}</p>
      <p>이메일: {b.email}</p>
      <p className="mt-2">Copyright © {new Date().getFullYear()} {config.serviceName}. All rights reserved.</p>
    </>
  );
}

/** 개발 환경에서 페이앱 결제창 대신 쓰는 가짜 결제창 */
export function MockPayApp({ search }: { search: string }) {
  const orderId = new URLSearchParams(search).get('order') ?? '';
  const [order, setOrder] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    api(`/api/payapp/mock-order/${orderId}`).then(setOrder, (e) => setError(e.message));
  }, [orderId]);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f2f3f5] p-4 text-[#111]">
      <div className="w-full max-w-[380px] overflow-hidden rounded-2xl bg-white shadow-lg">
        <div className="bg-[#1f6feb] px-5 py-4 text-[15px] font-semibold text-white">PayApp 결제 (개발용 가짜)</div>
        {error ? (
          <p className="p-6 text-[14px] text-red">{error}</p>
        ) : !order ? (
          <div className="flex justify-center p-10">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-3 p-5 text-[14px]">
            <div className="flex justify-between">
              <span className="text-[#666]">상점</span>
              {order.shopname}
            </div>
            <div className="flex justify-between">
              <span className="text-[#666]">상품</span>
              {order.name}
            </div>
            <div className="flex justify-between">
              <span className="text-[#666]">결제 방식</span>
              {order.plan === 'monthly' ? '정기결제 (매월)' : '일반결제 (한 번)'}
            </div>
            <div className="flex justify-between">
              <span className="text-[#666]">휴대폰</span>
              {order.phone}
            </div>
            <div className="flex justify-between border-t pt-3 text-[18px] font-semibold">
              <span>결제금액</span>
              {won(order.amount)}
            </div>
            <button
              type="button"
              disabled={busy || order.status === 'paid'}
              onClick={async () => {
                setBusy(true);
                await api('/api/payapp/mock-pay', { orderId });
                location.href = `/subscription?order=${orderId}`;
              }}
              className="mt-2 h-12 w-full rounded-xl bg-[#1f6feb] text-[16px] font-semibold text-white disabled:opacity-50"
            >
              {order.status === 'paid' ? '이미 결제됨' : '결제하기'}
            </button>
            <button type="button" onClick={() => (location.href = '/subscription')} className="h-10 w-full text-[14px] text-[#666]">
              취소
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
