import React, { useEffect, useState } from 'react';
import { Brain, Check, FileUp, Image as ImageIcon, Layers, ListChecks, MessageCircle, Mic, NotebookPen, Sparkles, Youtube, BookOpen } from 'lucide-react';
import { useApp } from '../lib/app.tsx';
import { Link, navigate } from '../lib/router.tsx';
import { Button, Logo } from '../components/ui.tsx';
import { LanguageSelect, useToggleTheme } from '../components/AppShell.tsx';
import { BizInfo } from './Subscription.tsx';
import { api } from '../lib/api.ts';
import { REVIEWS, SCHOOL_LOGOS } from '../content/landing.ts';
import { Moon } from 'lucide-react';

/* ---------- 제품 화면 미니어처 (실제 앱과 같은 구성) ---------- */

const MINI_TABS = ['요약', '퀴즈', '플래시카드', '마인드맵', '암기', '개념', '메모', 'AI 튜터'];

function MiniSlide() {
  return (
    <div className="space-y-3 p-4 text-[#111]">
      {[
        { n: '01', t: '다중 저장 모형', s: 'Atkinson & Shiffrin, 1968' },
        { n: '02', t: '망각 곡선', s: 'Ebbinghaus, 1885' },
      ].map((p) => (
        <div key={p.n} className="rounded-md border border-[#e7e7e7] bg-white p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[9px] text-[#999]">인지심리학 6주차</div>
              <div className="mt-1 text-[14px] font-semibold">{p.t}</div>
              <div className="text-[9px] text-[#999]">{p.s}</div>
            </div>
            <div className="text-[34px] font-bold leading-none text-[#e9e9e9]">{p.n}</div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#222] pt-2 text-[9px]">
            <span className="font-semibold">감각 기억</span>
            <span className="font-semibold">단기 기억</span>
            <span className="font-semibold">장기 기억</span>
            <span className="text-[#888]">0.5~4초</span>
            <span className="text-[#888]">7±2 항목</span>
            <span className="text-[#888]">무제한</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniContent({ tab }: { tab: string }) {
  if (tab === '퀴즈') {
    return (
      <div className="p-5 text-[#111]">
        <div className="mb-4 flex items-center gap-3 text-[10px] text-[#666]">
          ← 퀴즈 홈으로
          <div className="flex flex-1 gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={`h-[4px] flex-1 rounded-full ${i === 1 ? 'bg-[#111]' : 'bg-[#e5e5e5]'}`} />
            ))}
          </div>
          1 / 5
        </div>
        <div className="text-[13px] font-medium leading-[1.6]">새 비밀번호를 외운 뒤 예전 비밀번호가 떠오르지 않는다. 이 현상은?</div>
        <div className="mt-3 space-y-2 text-[11px]">
          {['순행 간섭', '역행 간섭', '쇠퇴', '설단 현상'].map((o, i) => (
            <div key={o} className={`rounded-lg border px-3 py-2 ${i === 1 ? 'border-[#12a150]' : 'border-[#e5e5e5]'}`}>
              <span className="mr-2 text-[#999]">{'ABCD'[i]}</span>
              {o}
              {i === 1 && <div className="mt-1 text-[10px] text-[#12a150]">✓ 정답 · 새 정보가 예전 정보를 방해했어요.</div>}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (tab === '플래시카드') {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-[#111]">
        <div className="flex aspect-[4/4.4] w-[62%] flex-col justify-between rounded-2xl bg-[#f5f5f5] p-5">
          <div />
          <div className="text-[14px] font-medium leading-[1.5]">순행 간섭이란?</div>
          <div className="text-center text-[10px] text-[#999]">탭하여 정답보기</div>
        </div>
        <div className="mt-4 flex w-[62%] justify-between text-[11px] text-[#666]">
          <span>✕ 모르겠어요 2</span>
          <span>5 알고있어요 ✓</span>
        </div>
      </div>
    );
  }
  if (tab === '마인드맵') {
    return (
      <svg viewBox="0 0 360 240" className="h-full w-full">
        {[40, 90, 150, 200].map((y, i) => (
          <path key={i} d={`M120,120 C170,120 170,${y} 210,${y}`} fill="none" stroke="#e2e2e2" strokeWidth="1.5" />
        ))}
        <rect x="30" y="104" width="90" height="32" rx="8" fill="#111" />
        <text x="75" y="125" textAnchor="middle" fontSize="12" fill="#fff" fontWeight="600">
          기억과 망각
        </text>
        {['다중 저장 모형', '망각 곡선', '망각의 원인', '공부법'].map((t, i) => (
          <g key={t}>
            <rect x="210" y={[40, 90, 150, 200][i] - 15} width="100" height="30" rx="8" fill="#f5f5f5" stroke="#e7e7e7" />
            <text x="260" y={[40, 90, 150, 200][i] + 5} textAnchor="middle" fontSize="11" fill="#111">
              {t}
            </text>
          </g>
        ))}
      </svg>
    );
  }
  if (tab === 'AI 튜터') {
    return (
      <div className="space-y-3 p-5 text-[11px] text-[#111]">
        <div className="ml-auto w-fit rounded-2xl bg-[#f3f3f3] px-3 py-2">시험에 나올 만한 부분 알려줘</div>
        <div className="leading-[1.7]">
          <b>세 군데만 확실히 잡으세요.</b>
          <br />
          1. 단기 기억 용량 7±2 (p.2)
          <br />
          2. 순행·역행 간섭의 방향 (p.4)
          <br />
          3. 인출 연습과 간격 반복 (p.5)
        </div>
      </div>
    );
  }
  return (
    <div className="p-5 text-[#111]">
      <div className="text-[18px] font-semibold">
        요약 <span className="rounded bg-[#eee] px-1 text-[9px] text-[#888]">p.1</span>
      </div>
      <p className="mt-2 text-[11px] leading-[1.7] text-[#444]">기억이 부호화, 저장, 인출을 거친다는 전제에서 출발해 망각의 원인과 오래 기억하는 공부법을 정리합니다.</p>
      <div className="mt-3 text-[13px] font-semibold">
        다중 저장 모형 <span className="rounded bg-[#eee] px-1 text-[9px] font-normal text-[#888]">p.2</span>
      </div>
      <table className="mt-2 w-full text-left text-[10px]">
        <tbody>
          {[
            ['감각 기억', '매우 큼', '0.5~4초'],
            ['단기 기억', '7±2 항목', '18~30초'],
            ['장기 기억', '무제한', '평생'],
          ].map((r) => (
            <tr key={r[0]} className="border-b border-[#eee]">
              <td className="py-1.5 font-semibold">{r[0]}</td>
              <td className="text-[#555]">{r[1]}</td>
              <td className="text-[#555]">{r[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MiniApp({ tab = '퀴즈' }: { tab?: string }) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-[#e7e7e7] bg-white text-left text-[#111] shadow-[0_20px_60px_rgba(40,50,120,0.18)]">
      <div className="flex h-9 items-center gap-2 border-b border-[#eee] px-3 text-[10px]">
        <span className="text-[#999]">←</span>
        <span className="rounded-full border border-[#e5e5e5] px-1.5 text-[9px] text-[#888]">샘플</span>
        <span className="font-medium">인지심리학 · 기억과 망각</span>
        <span className="ml-auto rounded-full bg-[#111] px-2.5 py-0.5 text-[9px] text-white">로그인</span>
      </div>
      <div className="grid h-[300px] grid-cols-[42%_1fr] md:h-[380px]">
        <div className="overflow-hidden border-r border-[#eee] bg-[#fafafa]">
          <MiniSlide />
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="flex justify-center gap-0.5 overflow-hidden px-2 py-2 text-[10px]">
            {MINI_TABS.map((t) => (
              <span key={t} className={`shrink-0 rounded-full px-2 py-1 ${t === tab ? 'bg-[#111] text-white' : 'text-[#666]'}`}>
                {t}
              </span>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <MiniContent tab={tab} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- 섹션 ---------- */

function Header() {
  const toggleTheme = useToggleTheme();
  return (
    <header className="sticky top-0 z-30 bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-[1180px] items-center px-5">
        <Link to="/">
          <Logo />
        </Link>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={toggleTheme} className="hidden h-9 w-9 items-center justify-center rounded-full text-sub hover:bg-soft sm:inline-flex" aria-label="테마 변경">
            <Moon size={18} />
          </button>
          <LanguageSelect />
          <Button size="sm" className="ml-2" onClick={() => navigate('/home')}>
            시작하기
          </Button>
        </div>
      </div>
    </header>
  );
}

function RecordingCard() {
  const [t, setT] = useState(48 * 60 + 12);
  useEffect(() => {
    const id = window.setInterval(() => setT((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="gradient-panel relative overflow-hidden rounded-[24px] p-6 md:p-10">
      <div className="rounded-[18px] bg-white p-6 text-[#111] shadow-[0_10px_40px_rgba(40,50,120,0.18)]">
        <div className="flex items-center justify-between text-[14px]">
          <span className="flex items-center gap-2 font-medium">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#e5383b]" /> 일반생물학 4주차
          </span>
          <span className="tabular-nums text-[#888]">
            {Math.floor(t / 60)}:{String(t % 60).padStart(2, '0')}
          </span>
        </div>
        <div className="mt-5 flex h-10 items-end gap-[4px]">
          {Array.from({ length: 30 }, (_, i) => (
            <span
              key={i}
              className="flex-1 origin-bottom rounded-sm bg-[#8b8ff0]"
              style={{ height: `${30 + ((i * 47) % 70)}%`, animation: `wave ${0.9 + ((i * 13) % 7) / 10}s ease-in-out ${(i % 5) * 0.1}s infinite` }}
            />
          ))}
        </div>
        <p className="mt-5 text-[13px] text-[#888]">…세포 호흡의 마지막 단계는 전자전달계에서 일어나고,</p>
        <p className="text-[15px]">이 과정에서 ATP가 가장 많이 만들어집니다|</p>
        <div className="mt-5 flex flex-wrap gap-2 text-[12px]">
          {['실시간 자막', '끝나면 요약', '퀴즈 생성'].map((c) => (
            <span key={c} className="rounded-full border border-[#e5e5e5] px-3 py-1.5 shadow-sm">
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const INPUTS = [
  { icon: FileUp, label: 'PDF · PPT · Word' },
  { icon: Youtube, label: '유튜브 링크' },
  { icon: Mic, label: '강의 녹음' },
  { icon: NotebookPen, label: '메모' },
  { icon: ImageIcon, label: '필기 사진' },
];
const OUTPUTS = ['AI 요약', 'AI 퀴즈', 'AI 플래시카드', 'AI 마인드맵', 'AI 튜터'];

function FlowDiagram() {
  const rows = [12, 31, 50, 69, 88];
  return (
    <div className="gradient-panel relative overflow-hidden rounded-[28px] px-5 py-10 md:px-16 md:py-14">
      <svg className="pointer-events-none absolute inset-0 hidden h-full w-full md:block" viewBox="0 0 100 100" preserveAspectRatio="none">
        {rows.map((y) => (
          <path key={`l${y}`} d={`M24,${y} C40,${y} 40,50 50,50`} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="0.25" />
        ))}
        {rows.map((y) => (
          <path key={`r${y}`} d={`M50,50 C60,50 60,${y} 76,${y}`} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="0.25" />
        ))}
      </svg>
      <div className="relative grid grid-cols-2 items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
        <div className="space-y-4 md:space-y-8">
          {INPUTS.map((it) => (
            <div key={it.label} className="flex w-fit items-center gap-3 rounded-full bg-white px-4 py-3 text-[14px] text-[#111] shadow-sm">
              <it.icon size={17} /> {it.label}
            </div>
          ))}
        </div>
        <div className="order-first col-span-2 text-center text-[36px] font-bold tracking-[-0.06em] text-white/90 drop-shadow md:order-none md:col-span-1">StudyAI</div>
        <div className="space-y-4 justify-self-end md:space-y-8">
          {OUTPUTS.map((o) => (
            <div key={o} className="flex w-fit items-center gap-2 rounded-full bg-[#111] px-4 py-3 text-[14px] text-white shadow-sm">
              <Sparkles size={15} /> {o}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const SHOWCASE = [
  { tab: '요약', label: 'AI 요약', icon: BookOpen, sub: '자료의 흐름대로 핵심을 정리하고, 페이지 표시를 눌러 원문으로 바로 이동해요. 어려운 부분은 쉬운 설명을 붙여 드려요.' },
  { tab: '퀴즈', label: 'AI 퀴즈', icon: ListChecks, sub: '자료로 연습 문제를 만들고, 해설을 읽으며 헷갈리는 개념을 바로잡아요.' },
  { tab: '플래시카드', label: 'AI 플래시카드', icon: Layers, sub: '핵심 개념을 카드로 만들고, 아는 것과 모르는 것을 나눠 내 속도로 반복해요.' },
  { tab: '마인드맵', label: 'AI 마인드맵', icon: Brain, sub: '흩어진 개념 사이의 연결을 한 장의 지도로 그려 드려요.' },
  { tab: 'AI 튜터', label: 'AI 튜터', icon: MessageCircle, sub: '내 자료를 읽은 튜터가 페이지 근거와 함께 답해요. 새벽에도요.' },
];

function Showcase() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = window.setTimeout(() => setI((x) => (x + 1) % SHOWCASE.length), 5000);
    return () => window.clearTimeout(t);
  }, [i, paused]);
  const cur = SHOWCASE[i];
  return (
    <div className="gradient-panel overflow-hidden rounded-[28px] p-4 md:p-10" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="no-scrollbar mx-auto flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl bg-white/90 p-1.5 text-[#111] shadow-sm">
        {SHOWCASE.map((s, j) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setI(j)}
            className={`relative shrink-0 overflow-hidden rounded-xl px-4 py-2 text-[14px] ${j === i ? 'bg-[#111] text-white' : 'text-[#888] hover:text-[#111]'}`}
          >
            <span className="mr-1.5 text-[11px] opacity-60">0{j + 1}</span>
            {s.label}
            {j === i && !paused && <span key={i} className="absolute bottom-0 left-0 h-[2px] bg-white/70" style={{ animation: 'progress 5s linear forwards', width: '100%' }} />}
          </button>
        ))}
      </div>
      <p className="mx-auto mt-5 max-w-[620px] text-center text-[15px] leading-[1.6] text-[#1d2340]">{cur.sub}</p>
      <div className="mx-auto mt-6 max-w-[980px]">
        <MiniApp tab={cur.tab} />
      </div>
      <style>{`@keyframes progress { from { transform: scaleX(0); transform-origin: left } to { transform: scaleX(1); transform-origin: left } }`}</style>
    </div>
  );
}

/* ---------- 실제 이용 수치, 대학 로고, 리뷰 ---------- */

interface PublicStats {
  users: number;
  generated: number;
  asOf: string;
}

/** 62만, 1억 2,000만 처럼 한국식 단위로 */
function koCount(n: number) {
  if (n >= 100_000_000) {
    const eok = Math.floor(n / 100_000_000);
    const man = Math.floor((n % 100_000_000) / 10_000);
    return man ? `${eok}억 ${man.toLocaleString('ko-KR')}만` : `${eok}억`;
  }
  if (n >= 10_000) return `${Math.floor(n / 10_000).toLocaleString('ko-KR')}만`;
  return n.toLocaleString('ko-KR');
}

function usePublicStats() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  useEffect(() => {
    api<PublicStats>('/api/stats/public').then(setStats).catch(() => {});
  }, []);
  return stats;
}

const asOfLabel = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 기준`;
};

/** 히어로 아래: 실제 가입자 수와 생성 건수 (DB에서 센 값) */
function StatsLine({ stats }: { stats: PublicStats | null }) {
  if (!stats) return <div className="mt-6 h-8" />;
  return (
    <div className="mt-6 flex items-center justify-center gap-3 text-[14px] text-muted">
      <span className="flex -space-x-2">
        {['#cfd6ff', '#ffd9c7', '#cdeedd'].map((c) => (
          <span key={c} className="h-8 w-8 rounded-full border-2 border-canvas" style={{ background: c }} />
        ))}
      </span>
      <span>
        {asOfLabel(stats.asOf)}, 누적 가입 <b className="font-semibold text-ink">{koCount(stats.users)}명</b> · <b className="font-semibold text-ink">{koCount(stats.generated)}건</b> 생성
      </span>
    </div>
  );
}

/** 이용 대학 로고 줄. SCHOOL_LOGOS가 비어 있으면 같은 모양의 빈 원을 보여 준다. */
function SchoolStrip({ stats }: { stats: PublicStats | null }) {
  const items = SCHOOL_LOGOS.length ? SCHOOL_LOGOS : Array.from({ length: 11 }, (_, i) => ({ name: '', src: '', key: i }));
  const row = [...items, ...items];
  return (
    <section className="pt-24 md:pt-28">
      <p className="text-center text-[15px] text-muted">{stats ? `${asOfLabel(stats.asOf)} 누적 가입 ${koCount(stats.users)}명 돌파` : '\u00a0'}</p>
      <div className="relative mt-8 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
        <div className="animate-marquee flex w-max gap-16">
          {row.map((s, i) =>
            s.src ? (
              <img key={i} src={s.src} alt={s.name} className="h-16 w-16 shrink-0 object-contain" />
            ) : (
              <span key={i} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-dashed border-line text-[10px] text-muted">
                대학 로고
              </span>
            ),
          )}
        </div>
      </div>
      {!SCHOOL_LOGOS.length && import.meta.env.DEV && (
        <p className="mt-4 text-center text-[12px] text-muted">개발 메모: 실제 이용 대학과 사용 가능한 로고 이미지를 src/content/landing.ts에 넣으면 이 자리에 표시돼요</p>
      )}
    </section>
  );
}

function ReviewCard({ r }: { r?: { title: string; body: string; source: string } }) {
  return (
    <div className="w-[300px] shrink-0 rounded-[22px] bg-soft p-6 text-left">
      <div className={`text-[14px] tracking-[2px] ${r ? 'text-[#f5a524]' : 'text-line'}`}>★★★★★</div>
      {r ? (
        <>
          <div className="mt-3 text-[16px] font-semibold">{r.title}</div>
          <p className="mt-2 line-clamp-4 text-[14px] leading-[1.65] text-sub">{r.body}</p>
          <div className="mt-4 text-[12px] text-muted">{r.source}</div>
        </>
      ) : (
        <div className="mt-4 space-y-2.5" aria-hidden>
          <div className="h-3.5 w-2/5 rounded bg-soft-2" />
          <div className="h-3 w-full rounded bg-soft-2" />
          <div className="h-3 w-11/12 rounded bg-soft-2" />
          <div className="h-3 w-3/5 rounded bg-soft-2" />
          <div className="!mt-5 h-2.5 w-1/4 rounded bg-soft-2" />
        </div>
      )}
    </div>
  );
}

/** 사용자 리뷰 두 줄 흐름. REVIEWS가 비어 있으면 빈 카드 틀만 보여 준다. */
function Reviews() {
  const list = REVIEWS.length ? REVIEWS : Array.from({ length: 6 }, () => undefined);
  const half = Math.ceil(list.length / 2);
  const rows = [list.slice(0, half), list.slice(half).length ? list.slice(half) : list.slice(0, half)];
  return (
    <section className="pt-32 md:pt-40">
      <div className="px-5 text-center">
        <h2 className="text-[30px] font-medium tracking-[-0.03em] md:text-[36px]">사용자 리뷰</h2>
        <p className="mt-3 text-[16px] text-muted">스터디AI 사용자가 남긴 리뷰를 소개합니다.</p>
        {!REVIEWS.length && import.meta.env.DEV && (
          <p className="mt-2 text-[12px] text-muted">개발 메모: 실제 사용자 리뷰가 모이면 src/content/landing.ts에 넣으면 이 카드에 채워져요</p>
        )}
      </div>
      <div className="mt-12 space-y-4 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
        {rows.map((row, ri) => {
          const loop = [...row, ...row, ...row, ...row];
          return (
            <div key={ri} className="animate-marquee flex w-max gap-4" style={{ animationDirection: ri ? 'reverse' : 'normal', animationDuration: ri ? '75s' : '60s' }}>
              {loop.map((r, i) => (
                <ReviewCard key={i} r={r} />
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function Landing() {
  const { me } = useApp();
  const stats = usePublicStats();
  useEffect(() => {
    if (me?.user) navigate('/home', { replace: true });
  }, [me?.user]);

  return (
    <div className="min-h-dvh bg-canvas">
      <Header />

      <section className="mx-auto max-w-[1180px] px-5 pt-16 text-center md:pt-24">
        <h1 className="text-[34px] font-medium leading-[1.25] tracking-[-0.035em] md:text-[52px]">
          필기는 녹음 버튼 하나로.
          <br />
          수업 시간엔 수업만 들으세요.
        </h1>
        <p className="mx-auto mt-6 max-w-[560px] text-[16px] text-sub md:text-[18px]">받아쓰기와 요약은 AI가 하고, 쌓인 강의는 퀴즈로 복습해요.</p>
        <div className="mt-8 flex justify-center gap-2.5">
          <Button size="lg" variant="soft" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
            기능 보기
          </Button>
          <Button size="lg" onClick={() => navigate('/home')}>
            지금 시작하기
          </Button>
        </div>
        <StatsLine stats={stats} />
        <div className="mx-auto mt-12 max-w-[980px]">
          <MiniApp tab="퀴즈" />
        </div>
      </section>

      <SchoolStrip stats={stats} />

      <section id="features" className="mx-auto grid max-w-[1180px] items-center gap-10 px-5 pt-32 md:grid-cols-2 md:gap-16 md:pt-40">
        <div>
          <div className="text-[14px] text-muted">강의 녹음</div>
          <h2 className="mt-3 text-[30px] font-medium leading-[1.3] tracking-[-0.03em] md:text-[36px]">
            녹음은 버튼 하나,
            <br />
            정리는 AI가 끝까지.
          </h2>
          <p className="mt-5 max-w-[440px] text-[16px] leading-[1.75] text-sub">
            녹음하는 동안 자막이 실시간으로 쌓이고, 녹음을 멈추면 요약·핵심 개념·퀴즈가 준비돼요. 못 들은 부분은 자막을 눌러 그 시점부터 다시 들으면 돼요.
          </p>
          <ul className="mt-6 space-y-2 text-[15px] text-sub">
            {['무료 플랜에서도 녹음은 무제한', '시험에 나온다고 한 부분은 따로 표시', '녹음 파일만 올려도 똑같이 정리'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check size={16} className="text-ink" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <RecordingCard />
      </section>

      <section className="mx-auto max-w-[1180px] px-5 pt-32 text-center md:pt-40">
        <h2 className="text-[30px] font-medium tracking-[-0.03em] md:text-[36px]">어떤 자료든 넣기만 하세요.</h2>
        <p className="mt-3 text-[16px] text-muted">강의 슬라이드, 유튜브 강의, 녹음, 메모, 칠판 사진. AI가 읽고 공부할 수 있게 바꿔요.</p>
        <div className="mt-12 text-left">
          <FlowDiagram />
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-5 pt-32 text-center md:pt-40">
        <h2 className="text-[30px] font-medium tracking-[-0.03em] md:text-[36px]">자료 하나로 시험 준비까지</h2>
        <div className="mt-12 text-left">
          <Showcase />
        </div>
      </section>

      <Reviews />

      <section className="mx-auto max-w-[1180px] px-5 pt-32 md:pt-40">
        <div className="gradient-panel rounded-[28px] px-6 py-16 text-center text-[#111] md:py-20">
          <h2 className="text-[30px] font-medium tracking-[-0.03em] md:text-[36px]">오늘 수업부터 바로 써 보세요</h2>
          <p className="mx-auto mt-3 max-w-[520px] text-[15px] text-[#2a2f4a]">PDF와 영상을 요약하고 퀴즈·플래시카드로 복습하세요. 웹에서 바로, 휴대폰에서도 이어서 공부할 수 있어요.</p>
          <Button size="lg" className="mt-8 !bg-[#111] !text-white" onClick={() => navigate('/home')}>
            지금 시작하기
          </Button>
        </div>
      </section>

      <footer className="mx-auto max-w-[1180px] px-5 pb-16 pt-24">
        <div className="flex flex-wrap items-start justify-between gap-6 border-t border-line pt-10">
          <div>
            <Logo />
            <p className="mt-2 text-[14px] text-muted">수업자료 PDF와 강의 녹음을 요약·핵심 개념·퀴즈로 바꿔 보세요.</p>
          </div>
          <div className="flex gap-5 text-[14px] text-sub">
            <Link to="/terms">이용약관</Link>
            <Link to="/privacy">개인정보 처리방침</Link>
            <Link to="/refund-policy">환불 정책</Link>
          </div>
        </div>
        <div className="mt-8 text-[13px] leading-[1.8] text-muted">
          <BizInfo />
        </div>
      </footer>
    </div>
  );
}
