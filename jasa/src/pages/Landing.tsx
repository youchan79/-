import { ArrowRight, BookOpenText, Building2, MessagesSquare, PenLine, Ruler, ShieldCheck, UsersRound } from 'lucide-react';
import { BRAND } from '../brand.ts';
import { Link } from '../components/Link.tsx';
import { Logo } from '../components/Logo.tsx';
import { useApp } from '../lib/app.tsx';
import { won } from '../lib/text.ts';

const STEPS = [
  {
    no: '01',
    icon: BookOpenText,
    title: '경험 정리',
    body: '이력서 PDF를 올리거나 겪은 일을 편하게 적으면, 자기소개서에 쓸 수 있는 경험을 상황·과제·행동·결과로 나눠 정리해요.',
  },
  {
    no: '02',
    icon: Building2,
    title: '기업·문항 분석',
    body: '회사 이름과 문항만 넣으면 최근 소식과 인재상을 검색해, 이 문항이 무엇을 묻는지와 어떻게 답하면 좋을지 알려줘요.',
  },
  {
    no: '03',
    icon: PenLine,
    title: '쓰고 다듬기',
    body: '고른 경험으로 초안을 쓰고, 옆에서 대화하듯 고쳐 나가요. 다 쓰면 인사담당자와 실무자의 눈으로 평가받아요.',
  },
];

const FEATURES = [
  { icon: ShieldCheck, title: '내 경험만 씁니다', body: '없는 수치나 성과를 지어내지 않아요. 비어 있는 정보는 ○○ 로 남겨 직접 채우게 해요.' },
  { icon: MessagesSquare, title: '대화로 첨삭', body: '“두괄식으로”, “더 구체적으로”처럼 말하면 고친 원고를 보여주고, 버튼 하나로 반영돼요.' },
  { icon: UsersRound, title: '두 관점 피드백', body: '서류를 거르는 인사담당자, 함께 일할 실무자. 서로 다른 기준으로 점수와 고칠 문장을 짚어줘요.' },
  { icon: Ruler, title: '글자 수 맞춤', body: '공백 포함·제외 글자 수를 실시간으로 세고, 제한의 90~100% 분량으로 맞춰 써요.' },
];

export function Landing() {
  const { config } = useApp();

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-6xl items-center px-4">
        <Logo />
        <Link to="/app" className="btn-primary ml-auto">
          시작하기
        </Link>
      </header>

      {/* 첫 화면 */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-20 md:grid-cols-[1.05fr_1fr] md:pt-16">
        <div>
          <span className="chip">{BRAND.tagline}</span>
          <h1 className="mt-5 font-serif text-[2.6rem] leading-[1.2] font-black tracking-tight sm:text-6xl">
            내 경험에서
            <br />
            시작하는
            <br />
            <span className="relative inline-block">
              <span className="absolute inset-x-0 bottom-1 -z-10 h-4 bg-sun/70 sm:h-5" />
              자기소개서
            </span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
            그럴듯한 문장보다 내가 실제로 한 일이 먼저예요. 경험을 정리하고, 회사를 이해하고, 나다운 답을 함께 다듬어요.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/app" className="btn-primary px-5 py-3 text-base">
              작업실 열기 <ArrowRight size={18} />
            </Link>
            <a href="#how" className="btn-ghost px-5 py-3 text-base">
              어떻게 쓰나요
            </a>
          </div>
        </div>
        <HeroVisual />
      </section>

      {/* 세 단계 */}
      <section id="how" className="border-y border-line bg-card/60 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-serif text-3xl font-bold sm:text-4xl">세 단계면 충분해요</h2>
          <p className="mt-3 text-muted">작업실 왼쪽의 순서대로 따라가면 돼요. 중간에 멈춰도 자동으로 저장돼요.</p>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.no} className="card p-6">
                <div className="flex items-center justify-between">
                  <span className="font-serif text-4xl font-black text-sun">{s.no}</span>
                  <s.icon className="text-pine" size={26} />
                </div>
                <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 특징 */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid gap-x-10 gap-y-9 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-pine text-sun">
                <f.icon size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold">{f.title}</h3>
                <p className="mt-1.5 leading-relaxed text-muted">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 요금 */}
      {config.auth && (
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <div className="card flex flex-col gap-6 bg-pine p-8 text-white md:flex-row md:items-center">
            <div>
              <h2 className="font-serif text-2xl font-bold">무료로 시작하세요</h2>
              <p className="mt-2 text-white/80">
                하루 {config.freeDailyLimit}회까지 무료. 마감이 몰릴 땐 프로({won(config.proPrice)} / 30일)로 제한 없이 쓰세요.
              </p>
            </div>
            <Link to="/app" className="btn-sun ml-auto shrink-0 px-5 py-3 text-base">
              무료로 시작하기 <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      )}

      <footer className="border-t border-line py-8 text-center text-sm text-muted">
        © {new Date().getFullYear()} {BRAND.name}
      </footer>
    </div>
  );
}

/** 경험 카드가 자기소개서 문단이 되는 모습을 그린 그림 */
function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden>
      <div className="card rotate-[-3deg] p-5 shadow-[0_18px_40px_-24px_rgba(29,35,32,0.45)]">
        <div className="flex items-center justify-between">
          <span className="chip">경험</span>
          <span className="text-xs text-muted">2024.03 – 2024.08</span>
        </div>
        <p className="mt-3 font-bold">동아리 행사 참여율 개선</p>
        <dl className="mt-3 space-y-1.5 text-sm">
          {[
            ['상황', '신입 부원 행사 참여율 30%대'],
            ['행동', '설문 120건 분석, 일정·형식 재설계'],
            ['결과', '참여율 30% → 71%'],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-3">
              <dt className="w-8 shrink-0 font-semibold text-pine">{k}</dt>
              <dd className="text-muted">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="card relative z-10 mt-4 ml-8 rotate-[2deg] p-5 shadow-[0_24px_50px_-24px_rgba(29,35,32,0.5)]">
        <div className="flex items-center justify-between">
          <span className="chip bg-sun-soft text-ink">자기소개서</span>
          <span className="text-xs font-semibold text-pine">487 / 500자</span>
        </div>
        <p className="mt-3 text-sm leading-relaxed">
          <strong>[숫자로 문제를 정의하는 사람]</strong> 저는 막연한 불편을 데이터로 바꿔 해결합니다. 동아리 행사 참여율이{' '}
          <mark className="bg-sun/60 px-0.5">30%대에 머물던</mark> 원인을 찾기 위해 설문 120건을 분석했고…
        </p>
      </div>
    </div>
  );
}
