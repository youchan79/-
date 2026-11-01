import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * 첫 화면 제품 화면 모션. 레퍼런스(유니브AI) 첫 화면처럼
 * 1) 기울어져 있던 화면이 스크롤하면 펴지고 (넓은 PC: 원근 기울기 + 축소, 태블릿 폭: 축소만, 폰: 그대로)
 * 2) 화면 안에서 커서가 탭을 눌러 가며 퀴즈·플래시카드·마인드맵·AI 튜터·요약을 차례로 보여 준다 (약 20초 반복).
 * 동영상 없이 실제 미니 화면(MiniApp)에 CSS transform/opacity만 쓴다. 움직임 줄이기 설정이면 지금 화면 그대로 멈춰 있다.
 */

const STAGE_WIDTH = 980; // MiniApp을 그리는 PC 폭. 폰에서는 통째로 줄인다.
const MOVE_EASE = 'cubic-bezier(0.45, 0, 0.2, 1)';
const ENTER_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

type Pt = { x: number; y: number };

/** 글자가 text로 시작하는 첫 요소 */
function byText(root: Element | null | undefined, text: string): HTMLElement | null {
  if (!root) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.textContent?.trim().startsWith(text)) return n.parentElement;
  }
  return null;
}

/** stage 안 좌표 (transform 영향 없는 offset 값으로 잰다) */
function posIn(stage: HTMLElement, el: HTMLElement, fx = 0.5, fy = 0.5): Pt {
  let x = 0;
  let y = 0;
  let n: HTMLElement | null = el;
  while (n && n !== stage) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  return { x: x + el.offsetWidth * fx, y: y + el.offsetHeight * fy };
}

/** 미니 화면의 오른쪽 내용 칸 (탭 줄 바로 아래) */
function contentOf(app: HTMLElement | null) {
  return (byText(app, '플래시카드')?.parentElement?.nextElementSibling as HTMLElement | null) ?? null;
}

type Step = {
  tab: string;
  enter?: (c: HTMLElement) => void;
  target?: (stage: HTMLElement, c: HTMLElement) => Pt | null;
  click?: (c: HTMLElement) => void;
};

const HOLD = { duration: 60000, fill: 'forwards' as const };

const STEPS: Step[] = [
  {
    tab: '퀴즈',
    enter: (c) => {
      byText(c, '✓ 정답')?.animate({ opacity: [0, 0] }, HOLD);
      byText(c, '역행 간섭')?.animate({ borderColor: ['#e5e5e5', '#e5e5e5'] }, HOLD);
    },
    target: (stage, c) => {
      const el = byText(c, '역행 간섭');
      return el ? posIn(stage, el, 0.3, 0.3) : null;
    },
    click: (c) => {
      const ok = byText(c, '✓ 정답');
      const box = byText(c, '역행 간섭');
      ok?.getAnimations().forEach((a) => a.cancel());
      box?.getAnimations().forEach((a) => a.cancel());
      box?.animate({ borderColor: ['#e5e5e5', '#12a150'], transform: ['scale(0.985)', 'none'] }, { duration: 320, easing: ENTER_EASE });
      ok?.animate({ opacity: [0, 1], transform: ['translateY(-3px)', 'none'] }, { duration: 360, easing: ENTER_EASE });
    },
  },
  {
    tab: '플래시카드',
    target: (stage, c) => {
      const el = byText(c, '5 알고있어요');
      return el ? posIn(stage, el, 0.5, 0.5) : null;
    },
    click: (c) => {
      byText(c, '5 알고있어요')?.animate({ color: ['#666', '#12a150', '#12a150', '#666'] }, { duration: 900 });
      byText(c, '순행 간섭이란?')?.parentElement?.animate(
        [
          { transform: 'none', opacity: 1 },
          { transform: 'translateX(70%) rotate(8deg)', opacity: 0, offset: 0.45 },
          { transform: 'translateY(12px) scale(0.94)', opacity: 0, offset: 0.46 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 900, easing: 'ease-in-out' },
      );
    },
  },
  {
    tab: '마인드맵',
    enter: (c) => {
      c.querySelectorAll('path').forEach((p, i) =>
        p.animate({ strokeDasharray: ['200 200', '200 200'], strokeDashoffset: [200, 0] }, { duration: 560, delay: 250 + i * 90, easing: ENTER_EASE, fill: 'backwards' }),
      );
      c.querySelectorAll('g').forEach((g, i) =>
        g.animate({ opacity: [0, 1], transform: ['translateX(-10px)', 'none'] }, { duration: 420, delay: 520 + i * 90, easing: ENTER_EASE, fill: 'backwards' }),
      );
    },
    target: (stage, c) => {
      const svg = c.querySelector('svg');
      if (!svg) return null;
      // 가운데 노드(viewBox 75,120)를 실제 칸 크기에 맞춰 옮긴다 (preserveAspectRatio 기본값 meet)
      const vb = svg.viewBox.baseVal;
      const s = Math.min(c.offsetWidth / vb.width, c.offsetHeight / vb.height);
      const o = posIn(stage, c, 0, 0);
      return { x: o.x + (c.offsetWidth - vb.width * s) / 2 + 80 * s, y: o.y + (c.offsetHeight - vb.height * s) / 2 + 124 * s };
    },
  },
  {
    tab: 'AI 튜터',
    enter: (c) => {
      byText(c, '시험에 나올')?.animate(
        { opacity: [0, 1], transform: ['translateY(8px) scale(0.97)', 'none'] },
        { duration: 380, delay: 150, easing: ENTER_EASE, fill: 'backwards' },
      );
      // 답이 한 줄씩 써지는 느낌
      byText(c, '세 군데만')?.parentElement?.animate(
        { clipPath: ['inset(0 0 100% 0)', 'inset(0 0 0 0)'] },
        { duration: 1600, delay: 650, easing: 'steps(4, end)', fill: 'backwards' },
      );
    },
    target: (stage, c) => {
      const el = byText(c, '시험에 나올');
      return el ? posIn(stage, el, 0.5, 1.6) : null;
    },
  },
  {
    tab: '요약',
    enter: (c) => {
      c.querySelector('p')?.animate({ opacity: [0, 1] }, { duration: 420, delay: 150, easing: 'ease-out', fill: 'backwards' });
      c.querySelectorAll('tr').forEach((r, i) =>
        r.animate({ opacity: [0, 1], transform: ['translateY(6px)', 'none'] }, { duration: 380, delay: 380 + i * 120, easing: ENTER_EASE, fill: 'backwards' }),
      );
    },
    target: (stage, c) => {
      const el = byText(c, '단기 기억');
      return el ? posIn(stage, el, 0.6, 0.5) : null;
    },
  },
];

function prefersReduced() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 바뀌기 전 탭 화면을 위에 잠깐 겹쳐 두고 흐리게 지운다 (탭 전환 크로스페이드) */
function FadeOut({ children, onDone }: { children: React.ReactNode; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  useLayoutEffect(() => {
    const a = ref.current!.animate({ opacity: [1, 0] }, { duration: 260, easing: 'ease-out', fill: 'forwards' });
    a.onfinish = () => done.current();
    return () => a.cancel();
  }, []);
  return (
    <div ref={ref} className="absolute inset-0">
      {children}
    </div>
  );
}

export function HeroMotion({ renderApp }: { renderApp: (tab: string) => React.ReactNode }) {
  const [reduced] = useState(prefersReduced);
  const [tab, setTab] = useState(STEPS[0].tab);
  const [prev, setPrev] = useState<string | null>(null);
  const [box, setBox] = useState({ scale: 1, height: 0 });
  const outer = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const app = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const ripple = useRef<HTMLDivElement>(null);
  const visible = useRef(true);
  const resume = useRef<(() => void) | null>(null);
  const onEnter = useRef<Step['enter'] | null>(null);

  // 새 탭이 그려지기 직전에 그 탭의 등장 동작을 건다 (정답이 한 프레임 먼저 보이는 일 없게)
  useLayoutEffect(() => {
    const content = contentOf(app.current);
    if (content && onEnter.current) onEnter.current(content);
    onEnter.current = null;
  }, [tab]);

  // 폭에 맞춰 PC 화면을 통째로 줄인다 (그리기 전에 재서 첫 화면이 튀지 않게)
  useLayoutEffect(() => {
    const measure = () => {
      if (!outer.current || !stage.current) return;
      const scale = Math.min(1, outer.current.clientWidth / STAGE_WIDTH);
      setBox({ scale, height: stage.current.offsetHeight * scale });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (outer.current) ro.observe(outer.current);
    return () => ro.disconnect();
  }, []);

  // 스크롤하면 기울어진 화면이 펴진다. 화면 윗변이 뷰포트 75% 지점에서 19% 지점으로 올라오는 동안.
  useLayoutEffect(() => {
    if (reduced) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      if (!outer.current || !frame.current) return;
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh * 0.75 - outer.current.getBoundingClientRect().top) / (vh * 0.56)));
      // 레퍼런스와 같은 폭 기준: 1025px 이상은 기울기+축소, 768~1024px은 축소만, 폰(767px 이하)은 움직이지 않는다
      const w = window.innerWidth;
      frame.current.style.transform =
        p >= 1 || w < 768 ? '' : w > 1024 ? `perspective(1200px) scale(${0.75 + 0.25 * p}) rotateX(${12 * (1 - p)}deg)` : `scale(${0.88 + 0.12 * p})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [reduced]);

  // 화면 밖에 있으면 다음 장면에서 멈춘다
  useEffect(() => {
    if (reduced || !outer.current) return;
    const io = new IntersectionObserver(([e]) => {
      visible.current = e.isIntersecting;
      if (e.isIntersecting && resume.current) {
        resume.current();
        resume.current = null;
      }
    });
    io.observe(outer.current);
    return () => io.disconnect();
  }, [reduced]);

  // 커서 데모 (탭 이동 → 클릭 → 화면 안 동작). 약 20초 한 바퀴.
  useEffect(() => {
    if (reduced) return;
    let dead = false;
    const timers = new Set<number>();
    const wait = (ms: number) =>
      new Promise<void>((res) => {
        const id = window.setTimeout(() => {
          timers.delete(id);
          res();
        }, ms);
        timers.add(id);
      });
    const whenVisible = () => new Promise<void>((res) => (visible.current ? res() : (resume.current = res)));
    const moveTo = async (p: Pt, ms: number) => {
      const c = cursor.current!;
      c.style.transition = `transform ${ms}ms ${MOVE_EASE}, opacity 300ms ease`;
      c.style.transform = `translate(${p.x}px, ${p.y}px)`;
      await wait(ms);
    };
    const click = (p: Pt) => {
      cursor.current?.firstElementChild?.animate({ transform: ['scale(1)', 'scale(0.8)', 'scale(1)'] }, { duration: 240 });
      ripple.current?.animate(
        [
          { transform: `translate(${p.x - 22}px, ${p.y - 22}px) scale(0.3)`, opacity: 0.45 },
          { transform: `translate(${p.x - 22}px, ${p.y - 22}px) scale(1.3)`, opacity: 0 },
        ],
        { duration: 480, easing: 'ease-out' },
      );
    };

    (async () => {
      const s = stage.current!;
      const c = cursor.current!;
      // 첫 장면: 지금 화면(퀴즈 정답) 그대로 보여 주다가 커서가 나타난다
      c.style.transform = `translate(${STAGE_WIDTH * 0.8}px, 330px)`;
      await wait(700);
      c.style.transition = 'opacity 300ms ease';
      c.style.opacity = '1';
      await wait(500);
      let cur = STEPS[0].tab;
      for (let i = 1; !dead; i++) {
        await whenVisible();
        if (dead) return;
        const step = STEPS[i % STEPS.length];
        const tabEl = byText(byText(app.current, '플래시카드')?.parentElement, step.tab);
        if (!tabEl) return;
        const tp = posIn(s, tabEl, 0.5, 0.6);
        await moveTo(tp, 700);
        await wait(120);
        click(tp);
        onEnter.current = step.enter ?? null;
        setPrev(cur);
        setTab(step.tab);
        cur = step.tab;
        await wait(650);
        const content = contentOf(app.current);
        if (!content) return;
        const tgt = step.target?.(s, content);
        if (tgt) {
          await moveTo(tgt, 750);
          await wait(160);
          if (step.click) {
            click(tgt);
            step.click(content);
          }
        }
        await wait(1900);
      }
    })();
    return () => {
      dead = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [reduced]);

  return (
    <div ref={outer} style={{ height: box.height || undefined }}>
      <div ref={frame} style={{ transformOrigin: 'center top' }}>
        <div ref={stage} className="relative" style={{ width: STAGE_WIDTH, transform: `scale(${box.scale})`, transformOrigin: 'top left' }}>
          <div ref={app} key={tab}>
            {renderApp(tab)}
          </div>
          {prev && prev !== tab && (
            <FadeOut key={prev} onDone={() => setPrev(null)}>
              {renderApp(prev)}
            </FadeOut>
          )}
          {!reduced && (
            <>
              <div ref={ripple} aria-hidden className="pointer-events-none absolute left-0 top-0 z-10 h-11 w-11 rounded-full bg-[#111]/20" style={{ opacity: 0 }} />
              <div ref={cursor} aria-hidden className="pointer-events-none absolute left-0 top-0 z-10" style={{ opacity: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" style={{ transformOrigin: '3px 2px', translate: '-3px -2px', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))' }}>
                  <path d="M3 2v17.2l4.6-4.4 3 6.9 3-1.3-3-6.8H17z" fill="#111" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
