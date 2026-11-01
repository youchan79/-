import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, CreditCard, LogOut, ReceiptText, Search, Send, Settings as Cog, SlidersHorizontal, User } from 'lucide-react';
import { api, formatDate, formatRenew, won } from '../lib/api.ts';
import { FeedbackModal } from '../components/AppShell.tsx';
import { useApp } from '../lib/app.tsx';
import { Link, navigate } from '../lib/router.tsx';
import { useApiErrorHandler } from '../components/Modals.tsx';
import { CancelSubscription, planLabel, planStatusText } from './Subscription.tsx';
import { Button, IconButton, Segmented } from '../components/ui.tsx';

type Tab = 'general' | 'account' | 'subscription' | 'ai' | 'feedback';

const TABS: Array<[Tab, string, React.ComponentType<{ size?: number; strokeWidth?: number }>]> = [
  ['general', '일반', Cog],
  ['account', '계정', User],
  ['subscription', '구독', CreditCard],
  ['ai', 'AI 설정', SlidersHorizontal],
  ['feedback', '개선 요청', Send],
];

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-4">
      <div>
        <div className="text-[15px]">{label}</div>
        {sub && <div className="mt-0.5 text-[13px] text-muted">{sub}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ProCard() {
  const { me, config } = useApp();
  if (me?.sub?.pro) return null;
  return (
    <div className="mb-3 flex items-center justify-between gap-4 rounded-2xl border border-line p-4">
      <div>
        <div className="text-[16px]">{config?.serviceName} Pro</div>
        <div className="mt-1 text-[13px] text-sub">올리는 개수 걱정 없이 계속 공부하세요.</div>
      </div>
      <Button size="sm" onClick={() => navigate('/subscription')}>
        업그레이드
      </Button>
    </div>
  );
}

function General() {
  const { theme, setTheme, showToast } = useApp();
  return (
    <>
      <ProCard />
      <Row label="테마">
        <Segmented value={theme} onChange={setTheme} options={[['system', '시스템'], ['light', '라이트'], ['dark', '다크']]} />
      </Row>
      <Row label="Language">
        <button type="button" onClick={() => showToast('다른 언어는 준비 중이에요.')} className="text-[15px]">
          🇰🇷 한국어
        </button>
      </Row>
      <Row label="휴지통" sub="지운 문서는 7일 동안 보관돼요">
        <Button size="sm" variant="ghost" onClick={() => navigate('/trash')}>
          보기
        </Button>
      </Row>
    </>
  );
}

function Account() {
  const { me, openLogin, refreshMe, showToast } = useApp();
  const onError = useApiErrorHandler();
  if (!me?.user) {
    return (
      <div className="py-10 text-center">
        <p className="text-[15px] text-sub">로그인하면 계정을 관리할 수 있어요.</p>
        <Button className="mt-4" onClick={() => openLogin()}>
          로그인
        </Button>
      </div>
    );
  }
  const via: Record<string, string> = { google: 'Google', kakao: '카카오', naver: '네이버' };
  return (
    <>
      <div className="flex items-center gap-3 py-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-solid text-[18px] font-semibold text-on-solid">
          {(me.user.name || me.user.email)[0].toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium">{me.user.name || me.user.email}</div>
          <div className="mt-0.5 truncate text-[14px] text-sub">
            {me.user.provider && <span className="mr-1.5 rounded bg-soft-2 px-1.5 py-px text-[13px] text-muted">{via[me.user.provider]}</span>}
            {me.user.email}
          </div>
        </div>
        <Button
          size="sm"
          className="shrink-0"
          onClick={async () => {
            await api('/api/auth/logout', {});
            await refreshMe();
            navigate('/home');
          }}
        >
          <LogOut size={15} /> 로그아웃
        </Button>
      </div>
      <button
        type="button"
        className="mt-2 text-[14px] text-muted underline underline-offset-4 hover:text-red"
        onClick={async () => {
          if (!window.confirm('정말 탈퇴할까요? 올린 자료와 학습 기록은 모두 지워지고 되돌릴 수 없어요.')) return;
          try {
            await api('/api/account/delete', {});
            await refreshMe();
            showToast('탈퇴했어요. 그동안 고마웠어요.');
            navigate('/');
          } catch (e) {
            onError(e);
          }
        }}
      >
        회원 탈퇴
      </button>
    </>
  );
}

function Subscription() {
  const { me, config } = useApp();
  if (!config) return null;
  const sub = me?.sub;
  const u = me?.usage;
  const pro = sub?.pro;
  return (
    <>
      <ProCard />
      <Row label="현재 플랜" sub={pro && (sub.canceled || sub.plan === 'lifetime') ? planStatusText(sub) : undefined}>
        <span className="text-[14px] font-medium">{pro ? planLabel(sub.plan) : '기본 플랜'}</span>
      </Row>
      {pro && sub.plan !== 'lifetime' && (
        <Row label={sub.autoRenew ? '다음 결제' : '이용 기간'}>
          <span className="text-[14px] text-sub">
            {sub.autoRenew ? `${formatDate(sub.periodEnd!)} · ${won(sub.amount ?? 0)}` : `${formatDate(sub.periodEnd!)}까지`}
          </span>
        </Row>
      )}
      {pro && sub.purchasedAt && (
        <Row label="최근 결제">
          <span className="text-[14px] text-sub">{formatDate(sub.purchasedAt)}</span>
        </Row>
      )}
      {u && !pro && (
        <Row label="이번 주 남은 횟수" sub={`${formatRenew(u.renewAt)}에 갱신`}>
          <span className="text-[14px] text-sub">
            PDF {Math.max(0, config.free.weeklyFiles - u.files)} · 유튜브 {Math.max(0, config.free.weeklyYoutube - u.youtube)}
          </span>
        </Row>
      )}
      <button type="button" onClick={() => navigate('/billing')} className="flex w-full items-center gap-2.5 border-b border-line py-4 text-left text-[15px] hover:opacity-80">
        <ReceiptText size={18} strokeWidth={1.8} /> 청구·영수증
        <ChevronRight size={16} className="ml-auto text-muted" />
      </button>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-5">
        <Button variant="outline" onClick={() => navigate('/subscription')}>
          구독 관리
        </Button>
        <CancelSubscription />
      </div>
    </>
  );
}

function AiSettings() {
  const { me, setMe, openLogin } = useApp();
  const s = me?.settings ?? {};
  const save = async (patch: Record<string, string>) => {
    if (!me?.user) return openLogin();
    const r = await api<{ settings: Record<string, string> }>('/api/settings', patch, { method: 'PUT' });
    setMe({ ...me, settings: r.settings });
  };
  const quizTypes = (s.quizTypes ?? 'choice').split(',').filter(Boolean);
  const toggleType = (t: string) => {
    const next = quizTypes.includes(t) ? quizTypes.filter((x) => x !== t) : [...quizTypes, t];
    if (next.length) void save({ quizTypes: next.join(',') });
  };
  return (
    <>
      <p className="pt-4 text-[14px] leading-[1.6] text-muted">바꾼 설정은 다음에 새로 만드는 학습 자료부터 적용돼요. 이미 만든 자료는 그대로예요.</p>
      <Row label="학습 자료 언어" sub="요약, 퀴즈, 플래시카드를 쓸 언어">
        <Segmented value={s.answerLanguage ?? 'ko'} onChange={(v) => void save({ answerLanguage: v })} options={[['ko', '한국어'], ['source', '자료 언어']]} />
      </Row>
      <h2 className="pb-1 pt-6 text-[15px] font-semibold">요약</h2>
      <Row label="요약 길이">
        <Segmented value={s.summaryLength ?? 'normal'} onChange={(v) => void save({ summaryLength: v })} options={[['short', '짧게'], ['normal', '보통'], ['long', '자세히']]} />
      </Row>
      <Row label="쓰는 방식" sub="항목은 핵심을 줄마다, 문단은 이어지는 글로">
        <Segmented value={s.summaryFormat ?? 'auto'} onChange={(v) => void save({ summaryFormat: v })} options={[['auto', '알아서'], ['bullet', '항목'], ['prose', '문단']]} />
      </Row>
      <Row label="쉬운 설명 붙이기" sub="어려운 대목마다 비유를 섞은 풀이를 달아요">
        <Segmented value={s.summaryEasy ?? 'on'} onChange={(v) => void save({ summaryEasy: v })} options={[['on', '켜기'], ['off', '끄기']]} />
      </Row>
      <h2 className="pb-1 pt-6 text-[15px] font-semibold">퀴즈</h2>
      <Row label="기본 난이도">
        <Segmented value={s.quizDifficulty ?? '보통'} onChange={(v) => void save({ quizDifficulty: v })} options={[['쉬움', '쉬움'], ['보통', '보통'], ['어려움', '어려움']]} />
      </Row>
      <div className="border-b border-line py-4">
        <div className="text-[15px]">문제 형식</div>
        <div className="mt-0.5 text-[13px] text-muted">하나 이상 고르면 골고루 섞어 내요</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ['choice', '객관식'],
            ['ox', 'OX'],
            ['blank', '빈칸 채우기'],
          ].map(([t, label]) => {
            const on = quizTypes.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => toggleType(t)}
                className={`h-10 rounded-full px-4 text-[15px] transition ${on ? 'bg-solid font-medium text-on-solid' : 'bg-soft text-sub hover:text-ink'}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Feedback() {
  const [open, setOpen] = useState(false);
  return (
    <div className="pt-4">
      <p className="text-[15px] leading-[1.7] text-sub">쓰다가 막힌 곳, 있었으면 하는 기능, 이상하게 동작한 부분 무엇이든 적어 주세요. 하나하나 읽고 다음 업데이트에 반영할게요.</p>
      <Button className="mt-4" onClick={() => setOpen(true)}>
        <Send size={16} /> 의견 보내기
      </Button>
      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

export default function Settings({ search }: { search: string }) {
  const initial = (new URLSearchParams(search).get('tab') as Tab) || 'general';
  const [tab, setTab] = useState<Tab>(TABS.some(([t]) => t === initial) ? initial : 'general');
  const [q, setQ] = useState('');
  const title = TABS.find(([t]) => t === tab)![1];
  const visible = TABS.filter(([, label]) => !q || label.includes(q));

  return (
    <div className="flex min-h-dvh items-start justify-center bg-canvas p-0 md:items-center md:p-5">
      <div className="flex min-h-dvh w-full max-w-[680px] flex-col overflow-hidden border-line md:min-h-[600px] md:flex-row md:rounded-[20px] md:border">
        <aside className="flex shrink-0 flex-col border-line md:w-[208px] md:border-r">
          <div className="p-2">
            <IconButton onClick={() => (history.length > 1 ? history.back() : navigate('/home'))} aria-label="뒤로">
              <ChevronLeft size={20} />
            </IconButton>
          </div>
          <div className="px-2">
            <label className="flex h-9 items-center gap-2 rounded-full border border-line px-3 text-[14px]">
              <Search size={15} className="text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="설정 검색" className="w-full bg-transparent outline-none placeholder:text-muted" />
            </label>
          </div>
          <nav className="no-scrollbar mt-2 flex gap-0.5 overflow-x-auto px-2 md:flex-col">
            {visible.map(([t, label, Icon]) => (
              <button
                key={t}
                type="button"
                // 폰에서 가로로 넘기는 탭 줄: 고른 탭이 화면 밖에 있으면 보이게
                ref={(el) => {
                  if (el && tab === t) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                }}
                onClick={() => setTab(t)}
                className={`flex h-10 shrink-0 items-center gap-2.5 rounded-lg px-3 text-[15px] ${tab === t ? 'bg-soft' : 'text-sub hover:bg-soft/70'}`}
              >
                <Icon size={18} strokeWidth={1.7} />
                {label}
              </button>
            ))}
          </nav>
          <div className="mt-auto hidden space-y-1 px-5 pb-4 text-[14px] text-muted md:block">
            <Link to="/terms" className="block hover:text-ink">
              이용약관
            </Link>
            <Link to="/privacy" className="block hover:text-ink">
              개인정보 처리방침
            </Link>
          </div>
        </aside>
        <section className="min-w-0 flex-1 px-4 pb-8 md:px-4">
          <h1 className="border-b border-line py-4 text-[18px]">{title}</h1>
          {tab === 'general' && <General />}
          {tab === 'account' && <Account />}
          {tab === 'subscription' && <Subscription />}
          {tab === 'ai' && <AiSettings />}
          {tab === 'feedback' && <Feedback />}
        </section>
      </div>
    </div>
  );
}
