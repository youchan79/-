import React, { useState } from 'react';
import { ChevronLeft, CreditCard, Search, Send, Settings as Cog, SlidersHorizontal, User } from 'lucide-react';
import { api, formatDate, formatRenew, won } from '../lib/api.ts';
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
        <div className="mt-1 text-[13px] text-sub">더 많은 자료를 올리고, 학습을 이어가세요.</div>
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
  return (
    <>
      <Row label="이메일">
        <span className="text-[14px] text-sub">{me.user.email}</span>
      </Row>
      <Row label="휴대폰" sub="결제할 때 페이앱에 전달돼요">
        <span className="text-[14px] text-sub">{me.user.phone ? me.user.phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3') : '없음'}</span>
      </Row>
      <Row label="가입일">
        <span className="text-[14px] text-sub">{formatDate(me.user.createdAt)}</span>
      </Row>
      <Row label="로그아웃">
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await api('/api/auth/logout', {});
            await refreshMe();
            navigate('/home');
          }}
        >
          로그아웃
        </Button>
      </Row>
      <Row label="회원 탈퇴" sub="올린 자료와 학습 기록이 모두 지워져요">
        <Button
          size="sm"
          variant="ghost"
          className="!text-red"
          onClick={async () => {
            if (!window.confirm('정말 탈퇴할까요? 올린 자료와 학습 기록은 되돌릴 수 없어요.')) return;
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
          탈퇴하기
        </Button>
      </Row>
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
  return (
    <>
      <Row label="학습 자료 언어" sub="요약, 퀴즈, 플래시카드를 쓸 언어">
        <Segmented value={s.answerLanguage ?? 'ko'} onChange={(v) => void save({ answerLanguage: v })} options={[['ko', '한국어'], ['source', '자료 언어']]} />
      </Row>
      <Row label="요약 길이">
        <Segmented value={s.summaryLength ?? 'normal'} onChange={(v) => void save({ summaryLength: v })} options={[['short', '짧게'], ['normal', '보통'], ['long', '자세히']]} />
      </Row>
      <Row label="퀴즈 기본 난이도">
        <Segmented value={s.quizDifficulty ?? '보통'} onChange={(v) => void save({ quizDifficulty: v })} options={[['쉬움', '쉬움'], ['보통', '보통'], ['어려움', '어려움']]} />
      </Row>
      <p className="pt-4 text-[13px] text-muted">바꾼 설정은 다음에 만드는 학습 자료부터 적용돼요.</p>
    </>
  );
}

function Feedback() {
  const { showToast } = useApp();
  const [text, setText] = useState('');
  return (
    <div className="pt-2">
      <p className="text-[14px] text-sub">바라는 기능이나 불편한 점을 알려 주세요. 모두 읽고 있어요.</p>
      <textarea
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="mt-4 w-full resize-none rounded-2xl border border-line bg-canvas p-4 text-[15px] outline-none focus:border-ink"
        placeholder="예: 플래시카드를 PDF로 뽑고 싶어요"
      />
      <Button
        className="mt-3"
        disabled={!text.trim()}
        onClick={async () => {
          await api('/api/feedback', { text });
          setText('');
          showToast('보내 주셔서 고마워요.');
        }}
      >
        보내기
      </Button>
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
