import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Brain, Check, ChevronDown, ChevronLeft, FileStack, Layers, ListChecks, MessageCircle, ShieldCheck } from 'lucide-react';
import { api, formatDate, formatRenew, won } from '../lib/api.ts';
import { useApp } from '../lib/app.tsx';
import { track } from '../lib/pixel.ts';
import { Link, navigate } from '../lib/router.tsx';
import { PRO_FEATURES, useApiErrorHandler } from '../components/Modals.tsx';
import { Button, Modal, Spinner } from '../components/ui.tsx';

const FEATURES = [
  { icon: FileStack, title: 'PDF·유튜브 무제한 업로드 분석', sub: '시험 기간에 자료가 몰려도 횟수를 기다리지 않고 바로 정리해요.' },
  { icon: BookOpen, title: 'AI 요약', sub: '자료의 흐름대로 핵심을 정리하고, 어려운 부분은 쉬운 설명을 붙여 드려요.' },
  { icon: ListChecks, title: 'AI 퀴즈', sub: '자료로 연습 문제를 만들고, 해설로 헷갈리는 개념을 바로잡아요.' },
  { icon: Layers, title: 'AI 플래시카드', sub: '핵심 개념을 카드로 만들어 내 속도에 맞춰 반복해요.' },
  { icon: Brain, title: 'AI 마인드맵', sub: '개념 사이의 연결을 한 장의 지도로 그려 드려요.' },
  { icon: MessageCircle, title: 'AI 튜터', sub: '새벽 세 시에도 내 자료를 아는 튜터에게 물어볼 수 있어요.' },
];

const FAQ: Array<[string, string]> = [
  ['기본 플랜과 Pro 플랜의 차이점은 무엇인가요?', '기본 플랜은 매주 파일 2회, 유튜브 2회까지 분석할 수 있고 강의 녹음은 제한이 없어요. Pro는 업로드와 학습 자료 생성, AI 튜터 질문이 모두 무제한이고 1GB까지의 긴 녹음 파일도 올릴 수 있어요.'],
  ['구독 취소는 어떻게 하나요?', '설정 > 구독 또는 이 페이지에서 언제든 해지할 수 있어요. 해지해도 이미 결제한 기간이 끝날 때까지 Pro를 쓸 수 있고, 다음 달부터 결제되지 않아요.'],
  ['결제 후 환불도 가능한가요?', '결제 후 7일 이내이고 Pro 기능을 쓰지 않았다면 전액 환불해 드려요. 자세한 기준은 환불 정책을 확인해 주세요.'],
  ['결제 카드를 바꾸고 싶어요', '지금 구독을 해지한 뒤, 이용 기간이 끝나면 새 카드로 다시 구독해 주세요. 바로 바꿔야 하면 고객센터로 알려 주세요.'],
  ['Pro를 결제했는데 적용이 안 돼요', '결제 확인까지 1분 정도 걸릴 수 있어요. 새로고침해도 그대로라면 결제한 이메일과 함께 고객센터로 알려 주세요.'],
  ['결제는 어떻게 처리되나요?', '결제는 결제대행사 페이앱을 통해 안전하게 처리돼요. 스터디AI는 카드 번호를 저장하지 않아요.'],
  ['모바일 앱도 있나요?', '스토어 앱은 준비 중이에요. 휴대폰 브라우저에서 홈 화면에 추가하면 앱처럼 쓸 수 있어요.'],
  ['고객 센터가 있나요?', '사이드바의 피드백 남기기나 아래 이메일로 문의해 주세요. 영업일 기준 하루 안에 답해 드려요.'],
];

function PhoneModal({ open, onClose, onSubmit, busy }: { open: boolean; onClose: () => void; onSubmit: (phone: string) => void; busy: boolean }) {
  const { me } = useApp();
  const [phone, setPhone] = useState(me?.user?.phone ?? '');
  useEffect(() => setPhone(me?.user?.phone ?? ''), [me?.user?.phone]);
  const digits = phone.replace(/\D/g, '');
  const valid = /^01[016789]\d{7,8}$/.test(digits);
  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-[20px] font-semibold">휴대폰 번호</h2>
      <p className="mt-1 text-[14px] leading-[1.6] text-muted">결제대행사(페이앱) 결제창에 필요해요. 광고 문자는 보내지 않아요.</p>
      <input
        autoFocus
        inputMode="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="010-0000-0000"
        className="mt-5 h-12 w-full rounded-xl border border-line bg-canvas px-4 text-[16px] outline-none focus:border-ink"
      />
      <Button size="lg" className="mt-4 w-full" disabled={!valid || busy} onClick={() => onSubmit(digits)}>
        {busy ? <Spinner className="h-4 w-4" /> : '결제창 열기'}
      </Button>
    </Modal>
  );
}

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
  const { config, me, openLogin, refreshMe, showToast } = useApp();
  const onError = useApiErrorHandler();
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [faq, setFaq] = useState<number | null>(null);
  const orderState = useOrderReturn(new URLSearchParams(search).get('order'));

  if (!config) return null;
  const monthly = config.plans.monthly.price;
  const yearly = config.plans.yearly.price;
  const saving = monthly * 12 - yearly;
  const sub = me?.sub;
  const usage = me?.usage;

  const checkout = async (phone: string) => {
    setBusy(true);
    try {
      const r = await api<{ payurl: string; orderId: string; amount: number }>('/api/checkout', { plan: period, phone });
      track('InitiateCheckout', { value: r.amount, currency: 'KRW', content_name: config.plans[period].name });
      location.href = r.payurl;
    } catch (e) {
      onError(e);
      setBusy(false);
    }
  };

  const start = () => {
    if (!me?.user) return openLogin({ mode: 'signup', onDone: () => setPhoneOpen(true) });
    setPhoneOpen(true);
  };

  const cancel = async () => {
    if (!window.confirm(`해지하면 ${sub?.periodEnd ? formatDate(sub.periodEnd) : '이용 기간 끝'} 이후로 결제되지 않아요. 해지할까요?`)) return;
    try {
      await api('/api/subscription/cancel', {});
      await refreshMe();
      showToast('해지했어요. 남은 기간 동안은 Pro를 계속 쓸 수 있어요.');
    } catch (e) {
      onError(e);
    }
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto max-w-[1120px] px-4 pb-16 pt-6 md:px-6">
        <button type="button" onClick={() => (history.length > 1 ? history.back() : navigate('/home'))} className="inline-flex h-9 items-center gap-1 rounded-full border border-line px-3.5 text-[14px] hover:bg-soft">
          <ChevronLeft size={16} /> 돌아가기
        </button>

        <h1 className="mt-10 text-center text-[26px] font-medium tracking-[-0.03em] md:text-[32px]">정리는 AI에게 맡기고, 공부는 A+에 집중하세요</h1>
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
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[20px]">Pro 플랜</div>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-[44px] font-medium tracking-[-0.03em]">{won(period === 'monthly' ? monthly : Math.round(yearly / 12 / 10) * 10)}</span>
                    <span className="text-[14px]">/월</span>
                  </div>
                  {period === 'yearly' && <div className="text-[13px] text-[#333]">연 {won(yearly)} 한 번 결제</div>}
                </div>
                {!sub?.pro && (
                  <div className="flex items-center rounded-full bg-white p-1 shadow-sm">
                    <button type="button" onClick={() => setPeriod('monthly')} className={`h-9 rounded-full px-4 text-[14px] ${period === 'monthly' ? 'bg-[#111] text-white' : 'text-[#333]'}`}>
                      월간
                    </button>
                    <button type="button" onClick={() => setPeriod('yearly')} className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-[14px] ${period === 'yearly' ? 'bg-[#111] text-white' : 'text-[#333]'}`}>
                      연간 <span className="rounded-full bg-[#e3f7ea] px-2 py-0.5 text-[12px] font-medium text-[#13803f]">{won(saving)} 절약</span>
                    </button>
                  </div>
                )}
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
                  <div className="text-[15px] font-semibold">
                    {sub.plan === 'yearly' ? '연간' : '월간'} Pro 이용 중 {sub.canceled && <span className="font-normal text-muted">(해지 예약됨)</span>}
                  </div>
                  <div className="mt-1 text-[14px] text-sub">
                    {sub.canceled || sub.plan === 'yearly' ? `${formatDate(sub.periodEnd!)}까지 이용할 수 있어요.` : `다음 결제일은 ${formatDate(sub.periodEnd!)}이에요. (${won(sub.amount ?? monthly)})`}
                  </div>
                  {sub.plan === 'monthly' && !sub.canceled && (
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => void cancel()}>
                      구독 해지
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <Button size="lg" className="mt-8 w-full" disabled={busy || config.paymentProvider === 'none'} onClick={start}>
                    {busy ? <Spinner className="h-4 w-4" /> : '무제한으로 시작하기'}
                  </Button>
                  <p className="mt-2.5 text-center text-[13px] text-muted">{period === 'monthly' ? '언제든 해지할 수 있어요' : '1년 동안 추가 결제 없이 이용해요'}</p>
                  {config.paymentProvider === 'mock' && <p className="mt-1 text-center text-[12px] text-blue">개발 모드: 가짜 결제창으로 연결돼요</p>}
                </>
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-line p-6">
            <div className="text-[18px]">기본 플랜</div>
            {usage && (
              <>
                <div className="mt-4 inline-flex rounded-full border border-line px-3 py-1 text-[12px]">
                  이번 주 남은 횟수: PDF {Math.max(0, config.free.weeklyFiles - usage.files)} · 유튜브 {Math.max(0, config.free.weeklyYoutube - usage.youtube)}
                </div>
                <div className="mt-2 text-[13px] text-muted">{formatRenew(usage.renewAt)}에 갱신</div>
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
              <p className="mt-2 text-[14px] leading-[1.6] text-sub">{f.sub}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-24 text-center text-[26px] font-medium tracking-[-0.03em]">자주 묻는 질문</h2>
        <div className="mx-auto mt-8 max-w-[760px] border-t border-line">
          {FAQ.map(([q, a], i) => (
            <div key={q} className="border-b border-line">
              <button type="button" onClick={() => setFaq(faq === i ? null : i)} className="flex w-full items-center justify-between gap-4 py-5 text-left text-[16px]">
                {q}
                <ChevronDown size={18} className={`shrink-0 text-muted transition ${faq === i ? 'rotate-180' : ''}`} />
              </button>
              {faq === i && <p className="pb-5 text-[15px] leading-[1.7] text-sub">{a}</p>}
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
      <PhoneModal open={phoneOpen} onClose={() => setPhoneOpen(false)} onSubmit={(p) => void checkout(p)} busy={busy} />
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
      {b.regNo && <p>사업자등록번호: {b.regNo}</p>}
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
              {order.plan === 'monthly' ? '정기결제 (매월)' : '일반결제'}
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
