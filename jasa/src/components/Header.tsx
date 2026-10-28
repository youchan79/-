import { LogOut, Sparkles } from 'lucide-react';
import { useApp } from '../lib/app.tsx';
import { navigate } from '../lib/router.ts';
import { Link } from './Link.tsx';
import { Logo } from './Logo.tsx';

export function Header() {
  const { config, session, account, signOut } = useApp();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Logo />
        <nav className="ml-2 hidden items-center gap-1 text-sm font-medium sm:flex">
          <Link to="/app" className="rounded-lg px-3 py-1.5 hover:bg-pine-soft">작업실</Link>
          {config.auth && <Link to="/pricing" className="rounded-lg px-3 py-1.5 hover:bg-pine-soft">요금제</Link>}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {usagePill()}
          {config.auth &&
            (session ? (
              <button
                className="btn-ghost px-3 py-1.5"
                onClick={async () => {
                  await signOut();
                  navigate('/');
                }}
                title={session.user.email ?? ''}
              >
                <LogOut size={15} /> <span className="hidden sm:inline">로그아웃</span>
              </button>
            ) : (
              <Link to="/login" className="btn-primary px-3 py-1.5">로그인</Link>
            ))}
        </div>
      </div>
      {!config.aiReady && (
        <p className="bg-danger-soft px-4 py-2 text-center text-sm text-danger">
          AI가 아직 꺼져 있어요. 서버의 .env 파일에 GEMINI_API_KEY를 넣고 다시 시작해 주세요.
        </p>
      )}
    </header>
  );

  function usagePill() {
    if (!account) return null;
    if (!config.auth) {
      return <span className="chip hidden bg-sun-soft text-ink/70 sm:inline-flex">로컬 모드 · 이 브라우저에 저장</span>;
    }
    if (account.plan === 'pro') {
      return (
        <span className="chip gap-1 bg-sun text-ink">
          <Sparkles size={12} /> 프로
        </span>
      );
    }
    return (
      <Link to="/pricing" className="chip hover:bg-pine hover:text-white" title="오늘 쓴 AI 횟수">
        오늘 AI {account.usedToday}/{account.limit}회
      </Link>
    );
  }
}
