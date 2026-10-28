import { Check, CloudOff, Loader2 } from 'lucide-react';
import { Header } from '../components/Header.tsx';
import { Link } from '../components/Link.tsx';
import { useApp } from '../lib/app.tsx';
import { useWorkspace, WorkspaceProvider } from '../lib/workspace.tsx';
import { AnalysisTab } from './studio/AnalysisTab.tsx';
import { ExperiencesTab } from './studio/ExperiencesTab.tsx';
import { WriteTab } from './studio/WriteTab.tsx';

const TABS = [
  { path: '/app/experiences', label: '경험 정리', short: '경험', count: 'experiences' },
  { path: '/app/analysis', label: '기업·문항 분석', short: '분석', count: 'analyses' },
  { path: '/app/write', label: '쓰고 다듬기', short: '쓰기', count: 'drafts' },
] as const;

export function Studio({ path }: { path: string }) {
  const { session } = useApp();
  return (
    <div className="min-h-dvh">
      <Header />
      {/* 계정이 바뀌면 작업 공간을 새로 불러옴 */}
      <WorkspaceProvider key={session?.user.id ?? 'local'}>
        <StudioBody path={path} />
      </WorkspaceProvider>
    </div>
  );
}

function StudioBody({ path }: { path: string }) {
  const { ws, saveState } = useWorkspace();
  const active = TABS.find((t) => path.startsWith(t.path)) ?? TABS[0];

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[210px_1fr] md:py-8">
      <aside className="md:sticky md:top-20 md:self-start">
        <nav className="grid grid-cols-3 gap-2 md:flex md:flex-col">
          {TABS.map((t, i) => {
            const on = t === active;
            return (
              <Link
                key={t.path}
                to={t.path}
                className={`flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-2.5 text-sm font-semibold transition md:gap-2.5 md:px-3 ${
                  on ? 'bg-pine text-white' : 'text-ink/80 hover:bg-pine-soft'
                }`}
              >
                <span className={`grid size-6 place-items-center rounded-md text-xs ${on ? 'bg-sun text-ink' : 'bg-pine-soft text-pine'}`}>{i + 1}</span>
                <span className="truncate md:hidden">{t.short}</span>
                <span className="hidden md:inline">{t.label}</span>
                <span className={`ml-auto text-xs ${on ? 'text-white/70' : 'text-muted'}`}>{ws[t.count].length || ''}</span>
              </Link>
            );
          })}
        </nav>
        <p className="mt-4 hidden items-center gap-1.5 px-3 text-xs text-muted md:flex">
          {saveState === 'saving' ? (
            <>
              <Loader2 size={13} className="animate-spin" /> 저장 중…
            </>
          ) : saveState === 'error' ? (
            <span className="flex items-center gap-1.5 text-danger">
              <CloudOff size={13} /> 저장 실패 · 연결을 확인하세요
            </span>
          ) : (
            <>
              <Check size={13} /> 자동 저장됨
            </>
          )}
        </p>
      </aside>
      <main className="min-w-0">
        {active.path === '/app/experiences' && <ExperiencesTab />}
        {active.path === '/app/analysis' && <AnalysisTab />}
        {active.path === '/app/write' && <WriteTab />}
      </main>
    </div>
  );
}
