import React, { useEffect, useState } from 'react';
import { Link2Off } from 'lucide-react';
import { api, KIND_LABEL, type DocDetail } from '../lib/api.ts';
import { DocApiBase } from '../lib/hooks.ts';
import { Link, navigate } from '../lib/router.tsx';
import { Button, EmptyState, Loading, Logo } from '../components/ui.tsx';
import { MindmapTab } from './DocDetail.tsx';
import { ConceptsTab, MemorizeTab, SummaryTab } from './doc/tabs.tsx';
import { FlashcardsTab, QuizTab } from './doc/sets.tsx';

const LABEL: Record<string, string> = { summary: '요약', quiz: '퀴즈', flashcards: '플래시카드', mindmap: '마인드맵', memorize: '암기', concepts: '개념' };

interface Shared {
  id: string;
  kind: DocDetail['kind'];
  title: string;
  createdAt: string;
  durationSec: number | null;
  pageCount: number | null;
  items: string[];
}

/** 공유 링크로 받은 자료 보기(/share/토큰): 로그인 없이, 고른 학습 자료만 읽기 전용으로 */
export default function SharedDoc({ token }: { token: string }) {
  const [data, setData] = useState<Shared | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('');

  useEffect(() => {
    api<Shared>(`/api/share/${token}`)
      .then((r) => {
        setData(r);
        setTab(r.items[0]);
      })
      .catch((e) => setError(e.message));
  }, [token]);

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col bg-canvas">
        <header className="flex h-[56px] items-center px-4">
          <Link to="/">
            <Logo />
          </Link>
        </header>
        <EmptyState icon={<Link2Off size={20} />} title="볼 수 없는 링크예요" sub="공유한 사람이 링크를 끊었거나 자료를 지웠어요.">
          <Button onClick={() => navigate('/')}>스터디AI 둘러보기</Button>
        </EmptyState>
      </div>
    );
  }
  if (!data) return <Loading label="공유받은 자료를 여는 중" />;

  // 탭 화면들이 기대하는 문서 모양에 맞춘다. 읽기 전용이라 만들기·다시 만들기는 막힌다.
  const doc = {
    ...data,
    thumb: null,
    status: 'ready',
    error: null,
    isSample: false,
    preview: null,
    folderId: null,
    favorite: false,
    sourceUrl: null,
    fileName: null,
    mime: null,
    fileCount: 0,
    sourceText: null,
    memo: '',
    materials: {},
    readOnly: true,
  } as unknown as DocDetail;
  const noRef = () => {};

  return (
    <DocApiBase.Provider value={`/api/share/${token}`}>
      <div className="flex h-dvh flex-col bg-canvas">
        <header className="flex h-[56px] shrink-0 items-center gap-3 border-b border-line px-4">
          <Link to="/" className="shrink-0">
            <Logo />
          </Link>
          <div className="min-w-0 flex-1 truncate text-center text-[15px] font-medium max-sm:hidden">{data.title}</div>
          <Button size="sm" className="ml-auto shrink-0" onClick={() => navigate('/')}>
            내 자료로도 만들기
          </Button>
        </header>
        <div className="px-4 pt-3 sm:hidden">
          <div className="truncate text-[17px] font-semibold">{data.title}</div>
          <div className="mt-0.5 text-[13px] text-muted">{KIND_LABEL[data.kind]} · 공유받은 자료</div>
        </div>
        <div className="no-scrollbar flex shrink-0 overflow-x-auto px-3 py-2.5 md:justify-center">
          <div className="flex gap-0.5">
            {data.items.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[14px] transition ${tab === t ? 'bg-solid font-medium text-on-solid' : 'text-sub hover:text-ink'}`}
              >
                {LABEL[t]}
              </button>
            ))}
          </div>
        </div>
        <div className={`min-h-0 flex-1 ${tab === 'mindmap' ? 'flex flex-col' : 'overflow-y-auto'}`}>
          {tab === 'mindmap' ? (
            <MindmapTab doc={doc} />
          ) : (
            <div className="mx-auto w-full max-w-[860px] px-5 pt-4 md:px-10">
              {tab === 'summary' && <SummaryTab doc={doc} onRef={noRef} />}
              {tab === 'quiz' && <QuizTab doc={doc} onRef={noRef} />}
              {tab === 'flashcards' && <FlashcardsTab doc={doc} onRef={noRef} />}
              {tab === 'memorize' && <MemorizeTab doc={doc} onRef={noRef} />}
              {tab === 'concepts' && <ConceptsTab doc={doc} onRef={noRef} onMakeSet={() => navigate('/')} />}
            </div>
          )}
        </div>
      </div>
    </DocApiBase.Provider>
  );
}
