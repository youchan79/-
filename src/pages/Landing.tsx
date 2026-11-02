import React, { useEffect, useRef, useState } from 'react';
import {
  AlignLeft,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  CircleCheck,
  Clapperboard,
  ClipboardList,
  Cog,
  Cpu,
  Dna,
  FileUp,
  FlaskConical,
  GraduationCap,
  HeartPulse,
  Image as ImageIcon,
  Languages,
  Layers,
  ListChecks,
  MessageCircle,
  Mic,
  Network,
  NotebookPen,
  Scale,
  ScrollText,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Youtube,
} from 'lucide-react';
import { useApp } from '../lib/app.tsx';
import { Link, navigate } from '../lib/router.tsx';
import { Button, Logo } from '../components/ui.tsx';
import { LanguageSelect, useToggleTheme } from '../components/AppShell.tsx';
import { HeroMotion } from '../components/HeroMotion.tsx';
import { BizInfo } from './Subscription.tsx';
import { REVIEWS, SCHOOL_LOGOS } from '../content/landing.ts';
import { ArrowDown, Globe, Moon } from 'lucide-react';

/* ---------- 제품 화면 미니어처 (실제 앱과 같은 구성) ---------- */

const MINI_TABS = ['요약', '퀴즈', '플래시카드', '마인드맵', '암기', '개념', '메모', 'AI 튜터'];

function MiniSlide() {
  return (
    <div className="space-y-3 p-2 break-keep text-[#111] @min-[700px]:p-4">
      {[
        { n: '01', t: '다중 저장 모형', s: 'Atkinson & Shiffrin, 1968', cols: ['감각 기억', '단기 기억', '장기 기억'], vals: ['0.5~4초', '7±2 항목', '무제한'] },
        { n: '02', t: '망각 곡선', s: 'Ebbinghaus, 1885', cols: ['20분 뒤', '1일 뒤', '6일 뒤'], vals: ['58% 기억', '34% 기억', '25% 기억'] },
        { n: '03', t: '간섭 이론', s: 'McGeoch, 1932', cols: ['순행 간섭', '역행 간섭', '줄이는 법'], vals: ['옛 정보가 방해', '새 정보가 방해', '간격 두고 복습'] },
      ].map((p) => (
        <div key={p.n} className="rounded-md border border-[#e7e7e7] bg-white p-2.5 @min-[700px]:p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[9px] text-[#999]">인지심리학 6주차</div>
              <div className="mt-1 text-[12px] font-semibold leading-snug @min-[700px]:text-[14px]">{p.t}</div>
              <div className="text-[9px] text-[#999]">{p.s}</div>
            </div>
            <div className="text-[22px] font-bold leading-none text-[#e9e9e9] @min-[700px]:text-[34px]">{p.n}</div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-x-1 gap-y-1 border-t border-[#222] pt-2 text-[9px] leading-tight @min-[700px]:gap-2">
            {p.cols.map((c) => (
              <span key={c} className="font-semibold">
                {c}
              </span>
            ))}
            {p.vals.map((v) => (
              <span key={v} className="text-[#888]">
                {v}
              </span>
            ))}
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
      <div className="mt-4 text-[13px] font-semibold">
        망각 곡선 <span className="rounded bg-[#eee] px-1 text-[9px] font-normal text-[#888]">p.3</span>
      </div>
      <p className="mt-2 text-[11px] leading-[1.7] text-[#444]">
        외운 내용은 하루 만에 절반 넘게 잊혀요. <b>잊기 직전에 다시 떠올리는 간격 반복</b>이 가장 오래 남는 방법이에요.
      </p>
      <div className="mt-2 text-[10px] text-[#999]">쉬운 설명 ›</div>
    </div>
  );
}

export function MiniApp({ tab = '퀴즈' }: { tab?: string }) {
  return (
    // 레퍼런스 화면과 같은 비율(1738:1080)
    <div className="@container flex aspect-[1738/1080] flex-col overflow-hidden rounded-[18px] border border-[#e7e7e7] bg-white text-left text-[#111] shadow-[0_20px_60px_rgba(40,50,120,0.18)]">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-[#eee] px-3 text-[10px]">
        <span className="text-[#999]">←</span>
        <span className="rounded-full border border-[#e5e5e5] px-1.5 text-[9px] text-[#888]">샘플</span>
        <span className="font-medium">인지심리학 · 기억과 망각</span>
        <span className="ml-auto rounded-full bg-[#111] px-2.5 py-0.5 text-[9px] text-white">로그인</span>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[42%_1fr]">
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

/** 레퍼런스처럼 폰에서는 PC 화면을 통째로 줄여 보여 준다. PC 폭(980px)이 들어가면 줄이지 않는다. */
const MINI_APP_WIDTH = 980;

function ScaledMiniApp({ tab }: { tab: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 1, height: 0 });
  useEffect(() => {
    const measure = () => {
      if (!outer.current || !inner.current) return;
      const scale = Math.min(1, outer.current.clientWidth / MINI_APP_WIDTH);
      setBox({ scale, height: inner.current.offsetHeight * scale });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (outer.current) ro.observe(outer.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={outer} style={{ height: box.height || undefined }}>
      <div ref={inner} style={{ width: MINI_APP_WIDTH, transform: `scale(${box.scale})`, transformOrigin: 'top left' }}>
        <MiniApp tab={tab} />
      </div>
    </div>
  );
}

/* ---------- 섹션 ---------- */

function Header() {
  const toggleTheme = useToggleTheme();
  const { showToast } = useApp();
  return (
    <header className="sticky top-0 z-30 bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-[1180px] items-center px-5">
        <Link to="/">
          <Logo />
        </Link>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={toggleTheme} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sub hover:bg-soft" aria-label="테마 변경">
            <Moon size={18} />
          </button>
          <button type="button" onClick={() => showToast('다른 언어는 준비 중이에요.')} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sub hover:bg-soft sm:hidden" aria-label="언어">
            <Globe size={18} />
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

/** 녹음 데모에서 실시간으로 받아 적히는 강의 문장 (한 글자씩 적히고, 다 적히면 위로 밀려 올라간다) */
const LECTURE = [
  '세포 호흡은 해당 과정, 시트르산 회로, 전자전달계 순서로 진행돼요.',
  '해당 과정은 세포질에서, 나머지 두 단계는 미토콘드리아에서 일어나요.',
  '마지막 전자전달계에서 ATP가 가장 많이 만들어집니다.',
  '이 순서는 시험에 꼭 나오니까 표시해 두세요.',
];

function LiveTranscript() {
  const [reduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [line, setLine] = useState(reduced ? 2 : 0);
  const [len, setLen] = useState(reduced ? LECTURE[2].length : 0);
  useEffect(() => {
    if (reduced) return;
    const full = LECTURE[line % LECTURE.length];
    const done = len >= full.length;
    const id = window.setTimeout(
      () => {
        if (done) {
          setLine(line + 1);
          setLen(0);
        } else setLen(len + 1);
      },
      done ? 1500 : 55 + ((len * 37) % 50),
    );
    return () => window.clearTimeout(id);
  }, [line, len, reduced]);
  const n = LECTURE.length;
  const prev = [LECTURE[(line + n - 2) % n], LECTURE[(line + n - 1) % n]];
  return (
    <div className="relative mt-5 h-[4.8em] overflow-hidden text-[15px] leading-[1.6]" aria-label={LECTURE[line % n]}>
      <div className="absolute inset-x-0 bottom-0" aria-hidden>
        {prev.map((p, i) => (
          <div key={`${line}-${i}`} className="text-[#999]">
            {p}
          </div>
        ))}
        <div>
          {LECTURE[line % n].slice(0, len)}
          <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-[#111]" />
        </div>
      </div>
    </div>
  );
}

function RecordingCard() {
  const [t, setT] = useState(48 * 60 + 12);
  useEffect(() => {
    const id = window.setInterval(() => setT((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="gradient-panel relative overflow-hidden rounded-[24px] p-4 md:p-10">
      <div className="rounded-[18px] bg-white p-5 text-[#111] shadow-[0_10px_40px_rgba(40,50,120,0.18)] md:p-6">
        <div className="flex items-center justify-between text-[14px]">
          <span className="flex items-center gap-2 font-medium">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#e5383b]" /> 세포생물학 5주차
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
        <LiveTranscript />
        <div className="mt-5 flex flex-wrap gap-2 text-[13px]">
          {['실시간 자막', '끝나면 요약', '퀴즈 생성'].map((c) => (
            <span key={c} className="rounded-full border border-[#e5e5e5] px-2.5 py-1.5 shadow-sm md:px-3">
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
const OUTPUTS = [
  { icon: AlignLeft, label: 'AI 요약' },
  { icon: CircleCheck, label: 'AI 퀴즈' },
  { icon: Layers, label: 'AI 플래시카드' },
  { icon: Network, label: 'AI 마인드맵' },
  { icon: Sparkles, label: 'AI 튜터' },
];
// 폰에서는 가운데 로고를 기준으로 위아래가 대칭이 되게 줄을 고정한다: 넣는 것 2·2·1 / 만들어지는 것 1·2·2
const INPUT_ROWS = [[0, 1], [2, 3], [4]];
const OUTPUT_ROWS = [[4], [0, 1], [2, 3]];

function FlowDiagram() {
  const rows = [12, 31, 50, 69, 88];
  return (
    <>
      {/* 폰: 위(넣는 것) → 가운데(스터디AI) → 아래(만들어지는 것) */}
      <div className="gradient-panel overflow-hidden rounded-[24px] px-4 py-8 md:hidden">
        <div className="space-y-2">
          {INPUT_ROWS.map((row) => (
            <div key={row.join()} className="flex justify-center gap-2">
              {row.map((k) => {
                const it = INPUTS[k];
                return (
                  <span key={it.label} className="flex items-center gap-2 whitespace-nowrap rounded-full bg-[#111] py-1.5 pl-1.5 pr-3.5 text-[13px] font-medium text-white">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2a2a2a]">
                      <it.icon size={14} />
                    </span>
                    {it.label}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        <ArrowDown size={16} className="mx-auto my-3 text-[#3a46c8]" />
        <div className="mx-auto w-fit rounded-full bg-white/35 px-7 py-5 backdrop-blur">
          <span className="block rounded-full bg-[#111] px-6 py-3 text-[24px] font-bold tracking-[-0.04em] text-white">StudyAI</span>
        </div>
        <ArrowDown size={16} className="mx-auto my-3 text-[#3a46c8]" />
        <div className="space-y-2">
          {OUTPUT_ROWS.map((row) => (
            <div key={row.join()} className="flex justify-center gap-2">
              {row.map((k) => {
                const o = OUTPUTS[k];
                return (
                  <span key={o.label} className="flex items-center gap-2 whitespace-nowrap rounded-full bg-[#111] py-1.5 pl-1.5 pr-3.5 text-[13px] font-medium text-white">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#111]">
                      <o.icon size={13} />
                    </span>
                    {o.label}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="gradient-panel relative hidden overflow-hidden rounded-[28px] px-5 py-10 md:block md:px-16 md:py-14">
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
              <div key={o.label} className="flex w-fit items-center gap-2 rounded-full bg-[#111] px-4 py-3 text-[14px] text-white shadow-sm">
                <o.icon size={15} /> {o.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
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
        <ScaledMiniApp tab={cur.tab} />
      </div>
      <style>{`@keyframes progress { from { transform: scaleX(0); transform-origin: left } to { transform: scaleX(1); transform-origin: left } }`}</style>
    </div>
  );
}

/** 폰: 레퍼런스처럼 기능 5개를 번호·제목·설명·화면 순서로 차례로 보여 준다 */
function ShowcaseList() {
  return (
    <div className="space-y-24">
      {SHOWCASE.map((s, j) => (
        <div key={s.label} className="text-center">
          <div className="text-[13px] text-muted">0{j + 1}</div>
          <h3 className="mt-2 text-[30px] font-normal tracking-[-0.03em]">{s.label}</h3>
          <p className="mx-auto mt-3 max-w-[420px] break-keep text-[15px] leading-[1.65] text-sub [text-wrap:balance]">{s.sub}</p>
          {/* 레퍼런스처럼 검은 기기 테두리 안의 화면이 판 아래쪽에 붙어 잘린다 */}
          <div className="gradient-panel mt-8 overflow-hidden rounded-[20px] px-[6%] pt-[5%] text-left">
            <div className="-mb-3 rounded-t-[16px] bg-[#1b1b1b] px-[5px] pt-[5px] pb-3">
              <ScaledMiniApp tab={s.tab} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- 히어로 아래 문구, 전공 배지 줄, 활용 예시 ---------- */

/** 레퍼런스의 가입자 수 자리: 근거 있는 상품 사실만 쓴다 */
function HeroNote() {
  const { config } = useApp();
  const price = config ? config.plans.monthly.price.toLocaleString('ko-KR') : '9,900';
  return (
    <div className="mt-6 flex items-center justify-center gap-2.5 text-[14px] text-muted">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue">
        <Sparkles size={13} />
      </span>
      {/* 폰에서는 두 줄로 끊는다 */}
      <span className="text-left leading-[1.5]">
        <b className="block font-semibold text-ink md:inline">무료로 시작, Pro는 월 {price}원</b>
        <span className="hidden md:inline"> · </span>
        <span className="block md:inline">강의 녹음은 무료로 계속</span>
      </span>
    </div>
  );
}

const MAJORS: Array<{ name: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }> = [
  { name: '경영학', icon: Briefcase },
  { name: '간호학', icon: HeartPulse },
  { name: '컴퓨터공학', icon: Cpu },
  { name: '법학', icon: Scale },
  { name: '의예과', icon: Stethoscope },
  { name: '심리학', icon: Brain },
  { name: '경제학', icon: TrendingUp },
  { name: '기계공학', icon: Cog },
  { name: '생명과학', icon: Dna },
  { name: '교육학', icon: GraduationCap },
  { name: '미디어', icon: Clapperboard },
  { name: '건축학', icon: Building2 },
  { name: '화학', icon: FlaskConical },
  { name: '영어영문', icon: Languages },
];

/** 레퍼런스의 대학 로고 줄 자리. 실제 이용 학교 로고가 생기면 SCHOOL_LOGOS로 바뀐다. */
function SchoolStrip() {
  if (SCHOOL_LOGOS.length) {
    const row = [...SCHOOL_LOGOS, ...SCHOOL_LOGOS];
    return (
      <section className="pt-24 md:pt-28">
        <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
          <div className="animate-marquee flex w-max gap-16">
            {row.map((s, i) => (
              <img key={i} src={s.src} alt={s.name} className="h-16 w-16 shrink-0 object-contain" />
            ))}
          </div>
        </div>
      </section>
    );
  }
  const row = [...MAJORS, ...MAJORS];
  return (
    <section className="pt-24 md:pt-28">
      <p className="text-center text-[15px] text-muted">전공 상관없이, 강의 자료만 있으면 돼요</p>
      <div className="relative mt-8 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
        <div className="animate-marquee flex w-max gap-10">
          {row.map((m, i) => (
            <div key={i} className="flex w-[72px] shrink-0 flex-col items-center gap-2">
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-soft text-sub">
                <m.icon size={24} strokeWidth={1.6} />
              </span>
              <span className="text-[12px] text-muted">{m.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const USES: Array<{ icon: React.ComponentType<{ size?: number }>; title: string; body: string }> = [
  { icon: ImageIcon, title: '악필 필기도 문제로', body: '손으로 쓴 필기 사진을 올리면 핵심을 읽어서 바로 퀴즈로 만들어요.' },
  { icon: Mic, title: '녹음 끝나면 바로 퀴즈', body: '녹음을 멈추면 요약과 퀴즈가 준비돼요. 잊어버리기 전에 5분만 풀어 보세요.' },
  { icon: ClipboardList, title: '시험 2주 전 모의고사', body: '범위 자료를 모아 실제 시험처럼 시간을 재고 풀고, 약한 자료부터 다시 봐요.' },
  { icon: ScrollText, title: '족보로 변형 문제', body: '기출 시험지를 올리면 같은 개념을 묻는 새 문제로 바꿔 드려요.' },
  { icon: MessageCircle, title: '새벽 3시에도 질문', body: '자료를 읽은 AI 튜터가 몇 페이지에 나오는지까지 짚어서 답해요.' },
  { icon: Languages, title: '영어 원서 PDF도', body: '영어 자료도 한국어로 정리하고, 전공 용어는 원어를 함께 보여 줘요.' },
  { icon: BookOpen, title: '헷갈리는 개념만 모아서', body: '정의와 예시, 자주 혼동되는 점까지 정리된 개념 사전으로 복습해요.' },
  { icon: ListChecks, title: '외울 것만 체크리스트로', body: '수치, 연도, 학자 이름처럼 외워야 할 것만 뽑아 하나씩 지워 나가요.' },
];

function UseCard({ u }: { u: (typeof USES)[number] }) {
  return (
    <div className="w-[300px] shrink-0 rounded-[22px] bg-soft p-6 text-left">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-canvas text-ink">
        <u.icon size={17} />
      </span>
      <div className="mt-4 text-[16px] font-semibold">{u.title}</div>
      <p className="mt-2 text-[14px] leading-[1.65] text-sub">{u.body}</p>
    </div>
  );
}

function ReviewCard({ r }: { r: { title: string; body: string; source: string } }) {
  return (
    <div className="w-[300px] shrink-0 rounded-[22px] bg-soft p-6 text-left">
      <div className="text-[14px] tracking-[2px] text-[#f5a524]">★★★★★</div>
      <div className="mt-3 text-[16px] font-semibold">{r.title}</div>
      <p className="mt-2 line-clamp-4 text-[14px] leading-[1.65] text-sub">{r.body}</p>
      <div className="mt-4 text-[12px] text-muted">{r.source}</div>
    </div>
  );
}

/** 레퍼런스의 리뷰 섹션 자리. 실제 리뷰(REVIEWS)가 생기기 전에는 활용 예시를 같은 모양으로 보여 준다. */
function Reviews() {
  const real = REVIEWS.length > 0;
  const items: React.ReactNode[] = real ? REVIEWS.map((r, i) => <ReviewCard key={i} r={r} />) : USES.map((u, i) => <UseCard key={i} u={u} />);
  const half = Math.ceil(items.length / 2);
  const rows = [items.slice(0, half), items.slice(half).length ? items.slice(half) : items.slice(0, half)];
  return (
    <section className="pt-32 md:pt-40">
      <div className="px-5 text-center">
        <h2 className="text-[30px] font-normal tracking-[-0.03em] md:text-[36px] md:font-medium">{real ? '사용자 리뷰' : '이렇게 공부해요'}</h2>
        <p className="mt-3 text-[16px] text-muted">{real ? '스터디AI 사용자가 남긴 리뷰를 소개합니다.' : '스터디AI로 할 수 있는 일을 모았어요.'}</p>
      </div>
      <div className="mt-12 space-y-4 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
        {rows.map((row, ri) => (
          <div key={ri} className="animate-marquee flex w-max gap-4" style={{ animationDirection: ri ? 'reverse' : 'normal', animationDuration: ri ? '75s' : '60s' }}>
            {[...row, ...row, ...row].map((node, i) => (
              <React.Fragment key={i}>{node}</React.Fragment>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Landing() {
  const { me, config } = useApp();
  useEffect(() => {
    if (me?.user) navigate('/home', { replace: true });
  }, [me?.user]);

  return (
    <div className="min-h-dvh bg-canvas">
      <Header />

      <section className="mx-auto max-w-[1180px] px-5 pt-16 text-center md:pt-24">
        <h1 className="break-keep text-[28px] font-normal leading-[1.25] tracking-[-0.035em] md:text-[52px] md:font-medium">
          필기는 녹음 버튼 하나로.
          <br />
          수업 시간엔 수업만 들으세요.
        </h1>
        <p className="mx-auto mt-5 max-w-[560px] break-keep text-[15px] leading-[1.7] text-sub [text-wrap:balance] md:mt-6 md:text-[18px]">받아쓰기와 요약은 AI가 하고, 쌓인 강의는 퀴즈로 복습해요.</p>
        <div className="mt-8 flex justify-center gap-2.5">
          <Button size="lg" variant="soft" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
            기능 보기
          </Button>
          <Button size="lg" onClick={() => navigate('/home')}>
            지금 시작하기
          </Button>
        </div>
        <HeroNote />
        <div className="mx-auto mt-12 max-w-[980px]">
          <HeroMotion renderApp={(tab) => <MiniApp tab={tab} />} />
        </div>
      </section>

      <SchoolStrip />

      <section id="features" className="mx-auto grid max-w-[1180px] items-center gap-10 px-5 pt-32 md:grid-cols-2 md:gap-16 md:pt-40">
        <div>
          <div className="text-[14px] text-muted">강의 녹음</div>
          <h2 className="mt-3 text-[30px] font-normal leading-[1.2] tracking-[-0.03em] md:text-[36px] md:font-medium md:leading-[1.3]">
            녹음은 버튼 하나,
            <br />
            정리는 AI가 끝까지.
          </h2>
          <p className="mt-5 max-w-[440px] break-keep text-[16px] leading-[1.75] text-sub">
            녹음하는 동안 자막이 실시간으로 쌓이고, 녹음을 멈추면 요약·핵심 개념·퀴즈가 준비돼요. 못 들은 부분은 자막을 눌러 그 시점부터 다시 들으면 돼요.
          </p>
        </div>
        <RecordingCard />
      </section>

      <section className="mx-auto max-w-[1180px] px-5 pt-32 text-center md:pt-40">
        <h2 className="text-[30px] font-normal tracking-[-0.03em] md:text-[36px] md:font-medium">어떤 자료든 넣기만 하세요.</h2>
        <p className="mx-auto mt-3 max-w-[560px] break-keep text-[15px] text-muted [text-wrap:balance] md:text-[16px]">강의 슬라이드, 유튜브 강의, 녹음, 메모, 칠판 사진. AI가 읽고 공부할 수 있게 바꿔요.</p>
        <div className="mt-12 text-left">
          <FlowDiagram />
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-5 pt-32 text-center md:pt-40">
        <h2 className="text-[30px] font-normal tracking-[-0.03em] md:text-[36px] md:font-medium">자료 하나로 시험 준비까지</h2>
        <div className="mt-16 md:hidden">
          <ShowcaseList />
        </div>
        <div className="mt-12 hidden text-left md:block">
          <Showcase />
        </div>
      </section>

      <Reviews />

      <section className="mx-auto max-w-[1180px] px-5 pt-32 md:pt-40">
        <div className="gradient-panel rounded-[28px] px-6 py-16 text-center text-[#111] md:py-20">
          <h2 className="break-keep text-[30px] font-normal leading-[1.3] tracking-[-0.03em] [text-wrap:balance] md:text-[36px] md:font-medium">오늘 수업부터 바로 써 보세요</h2>
          {/* 폰에서는 문장마다 줄을 나눠 어색하게 끊기지 않게 한다 */}
          <p className="mx-auto mt-4 max-w-[520px] break-keep text-[15px] leading-[1.7] text-[#2a2f4a] [text-wrap:balance]">
            <span className="block md:inline">PDF와 영상을 요약하고 퀴즈·플래시카드로 복습하세요. </span>
            <span className="block md:inline">기본 플랜은 무료, 무제한 Pro는 월 {config ? config.plans.monthly.price.toLocaleString('ko-KR') : '9,900'}원이에요. </span>
            <span className="block md:inline">언제든 해지할 수 있어요.</span>
          </p>
          <Button size="lg" className="mt-8 !bg-[#111] !text-white" onClick={() => navigate('/home')}>
            지금 시작하기
          </Button>
        </div>
      </section>

      <footer className="mx-auto max-w-[1180px] px-5 pb-16 pt-24">
        <div className="flex flex-wrap items-start justify-between gap-6 border-t border-line pt-10">
          <div>
            <Logo />
            <p className="mt-2 text-[14px] text-muted">강의 자료와 녹음을 넣으면 요약·핵심 개념·퀴즈로 정리해 드려요.</p>
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
