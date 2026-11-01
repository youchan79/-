import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Brain, Columns2, Layers, ListChecks, Loader2, MessageCircle, NotebookPen, PanelLeftOpen, Sparkles, TextQuote, Workflow } from 'lucide-react';
import { api, type DocDetail as Doc, type MindNode } from '../lib/api.ts';
import { useApp } from '../lib/app.tsx';
import { useMaterial, usePoll } from '../lib/hooks.ts';
import { navigate } from '../lib/router.tsx';
import { AppShell } from '../components/AppShell.tsx';
import { ChatView } from '../components/ChatView.tsx';
import { MindMap } from '../components/MindMap.tsx';
import { Button, IconButton, Loading } from '../components/ui.tsx';
import { SourcePane, type SourceHandle } from './doc/SourcePane.tsx';
import { Recorder } from './doc/Recorder.tsx';
import { ConceptsTab, Generating, MaterialError, MemoTab, MemorizeTab, SummaryTab } from './doc/tabs.tsx';
import { FlashcardsTab, QuizTab } from './doc/sets.tsx';

const TABS = [
  ['summary', '요약'],
  ['quiz', '퀴즈'],
  ['flashcards', '플래시카드'],
  ['mindmap', '마인드맵'],
  ['memorize', '암기'],
  ['concepts', '개념'],
  ['memo', '메모'],
  ['tutor', 'AI 튜터'],
] as const;
type Tab = (typeof TABS)[number][0] | 'source';

/** 폰에서는 레퍼런스처럼 원문이 첫 탭이다 */
const SOURCE_LABEL: Record<Doc['kind'], string> = { pdf: 'PDF', docx: 'Word', pptx: 'PPT', youtube: '영상', audio: '녹음', image: '사진', memo: '원문' };

function MindmapTab({ doc }: { doc: Doc }) {
  const m = useMaterial<{ root: MindNode }>(doc.id, 'mindmap');
  if (m.status === 'error') return <MaterialError message={m.error} />;
  if (!m.data) return <Generating label="AI가 마인드맵을 그리고 있어요" />;
  return <MindMap root={m.data.root} />;
}

function TutorTab({ doc, onRef }: { doc: Doc; onRef: (r: string) => void }) {
  const { me, openLogin } = useApp();
  const [chatId, setChatId] = useState<string | null>(null);
  useEffect(() => {
    if (!me?.user) return;
    api<{ id: string }>(`/api/docs/${doc.id}/chat`).then((r) => setChatId(r.id));
  }, [doc.id, me?.user]);
  return (
    <ChatView
      key={chatId ?? 'none'}
      chatId={chatId}
      compact
      onRef={onRef}
      emptyTitle="이 자료에 대해 물어보세요"
      suggestions={['세 줄로 핵심만 뽑아줘', '시험에 나올 것 같은 곳 짚어줘', '헷갈리는 개념 쉽게 풀어줘']}
      ensureChat={async () => {
        if (!me?.user) {
          openLogin({ mode: 'signup' });
          return null;
        }
        const r = await api<{ id: string }>(`/api/docs/${doc.id}/chat`);
        setChatId(r.id);
        return r.id;
      }}
    />
  );
}

function Processing({ doc }: { doc: Doc }) {
  const steps =
    doc.kind === 'youtube'
      ? ['영상 내용을 받아 적는 중', '핵심 내용을 정리하는 중', '요약을 만드는 중']
      : doc.kind === 'audio'
        ? ['녹음을 받아 적는 중', '강의 흐름을 정리하는 중', '요약을 만드는 중']
        : ['자료를 읽는 중', '핵심 개념을 찾는 중', '요약을 만드는 중'];
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setStep((s) => Math.min(steps.length - 1, s + 1)), 6000);
    return () => window.clearInterval(t);
  }, [steps.length]);
  return (
    <div className="mx-auto max-w-[420px] py-20">
      <div className="text-[22px] font-semibold tracking-tight">AI가 자료를 정리하고 있어요</div>
      <p className="mt-2 text-[14px] text-muted">페이지가 많거나 영상이 길면 1~2분 걸릴 수 있어요. 다른 화면으로 가도 계속 진행돼요.</p>
      <div className="mt-8 space-y-4">
        {steps.map((s, i) => (
          <div key={s} className={`flex items-center gap-3 text-[15px] ${i <= step ? 'text-ink' : 'text-muted'}`}>
            {i < step ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-solid text-[11px] text-on-solid">✓</span>
            ) : i === step ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <span className="h-5 w-5 rounded-full border border-line" />
            )}
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

const TAB_ICON: Record<string, React.ComponentType<{ size?: number }>> = {
  summary: TextQuote,
  quiz: ListChecks,
  flashcards: Layers,
  mindmap: Workflow,
  memorize: Brain,
  concepts: Sparkles,
  memo: NotebookPen,
  tutor: MessageCircle,
};

/** 녹음 전인 강의 녹음 문서의 탭: 무엇이 만들어질지 보여 주고, 버튼은 녹음이 끝나야 켜진다 */
function WaitRecording({ tab, label }: { tab: string; label: string }) {
  const Icon = TAB_ICON[tab] ?? TextQuote;
  return (
    <div className="flex flex-col items-center px-6 py-24 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-line text-sub">
        <Icon size={20} />
      </span>
      <div className="mt-4 text-[18px] font-semibold">{label}</div>
      <p className="mt-1 text-[15px] text-muted">녹음을 끝내면 여기에 정리돼요.</p>
      <Button className="mt-5" disabled>
        {label} 만들기
      </Button>
    </div>
  );
}

function useIsDesktop() {
  const q = '(min-width: 1024px)';
  const [v, setV] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const fn = () => setV(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return v;
}

export default function DocDetail({ id, search }: { id: string; search: string }) {
  const { me, openLogin, showToast } = useApp();
  const desktop = useIsDesktop();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState('');
  const initialTab = new URLSearchParams(search).get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(
    initialTab && TABS.some(([t]) => t === initialTab) ? initialTab : desktop ? 'summary' : 'source',
  );
  const [showSource, setShowSource] = useState(true);
  const [focus, setFocus] = useState<{ kind: 'quiz' | 'flashcards'; name: string; n: number } | null>(null);
  const source = useRef<SourceHandle>(null);

  const load = useCallback(async () => {
    try {
      setDoc(await api<Doc>(`/api/docs/${id}`));
    } catch (e: any) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load, me?.user?.email]);
  usePoll(() => void load(), doc?.status === 'processing', 2500);

  const selectTab = (t: Tab) => {
    setTab(t);
    history.replaceState(null, '', `/doc/${id}${t === 'summary' || t === 'source' ? '' : `?tab=${t}`}`);
  };

  // 폰↔PC로 폭이 바뀌면 원문 탭은 PC의 왼쪽 패널로 돌아간다
  useEffect(() => {
    if (desktop && tab === 'source') setTab('summary');
  }, [desktop, tab]);

  const onRef = (r: string) => {
    if (!r) return;
    if (!desktop) selectTab('source');
    else setShowSource(true);
    window.setTimeout(() => source.current?.goTo(r), 120);
  };

  if (error) {
    return (
      <AppShell title="">
        <div className="py-24 text-center">
          <p className="text-[16px] text-sub">{error}</p>
          <Button className="mt-5" onClick={() => navigate('/home')}>
            문서로 돌아가기
          </Button>
        </div>
      </AppShell>
    );
  }
  if (!doc) {
    return (
      <AppShell bare forceCollapsed>
        <Loading label="문서를 여는 중" />
      </AppShell>
    );
  }

  const ready = doc.status === 'ready';
  const recording = doc.status === 'recording';
  const sourceReady = ready || doc.kind === 'pdf' || recording;
  const left = recording ? <Recorder doc={doc} onDone={() => void load()} /> : <SourcePane ref={source} doc={doc} />;
  // 메모 문서는 본문이 곧 메모라서 메모 탭을 따로 두지 않는다(원조와 같음)
  const docTabs = doc.kind === 'memo' ? TABS.filter(([t]) => t !== 'memo') : TABS;
  const tabs: ReadonlyArray<readonly [Tab, string]> = desktop ? docTabs : [['source', SOURCE_LABEL[doc.kind]], ...docTabs];

  return (
    <AppShell bare forceCollapsed mobileMenu={false}>
      <div className="flex h-full flex-col">
        <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-line px-3">
          <IconButton onClick={() => navigate('/home')} aria-label="뒤로">
            <ArrowLeft size={19} />
          </IconButton>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
            {doc.isSample && <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[12px] text-muted">샘플</span>}
            <span className="truncate text-[15px] font-medium">{doc.title}</span>
          </div>
          {me && !me.user && (
            <Button size="sm" onClick={() => openLogin()}>
              로그인
            </Button>
          )}
          {desktop && (
            <IconButton onClick={() => setShowSource((s) => !s)} aria-label="원문 패널">
              <Columns2 size={18} />
            </IconButton>
          )}
        </header>

        <div className="flex min-h-0 flex-1">
          {desktop && showSource && (
            <section className="hidden w-[42%] min-w-[360px] max-w-[640px] shrink-0 border-r border-line lg:block">
              {doc.status === 'error' ? null : recording ? left : <SourcePane ref={source} doc={doc} onCollapse={() => setShowSource(false)} />}
            </section>
          )}
          {desktop && !showSource && (
            <button
              type="button"
              onClick={() => setShowSource(true)}
              className="hidden w-11 shrink-0 items-start justify-center border-r border-line pt-3 text-sub hover:text-ink lg:flex"
              aria-label="원문 펼치기"
            >
              <PanelLeftOpen size={18} />
            </button>
          )}

          <section className="flex min-w-0 flex-1 flex-col">
            <div className="no-scrollbar flex shrink-0 justify-start overflow-x-auto px-3 py-2.5 md:justify-center">
              <div className="flex gap-0.5">
                {tabs.map(([t, label]) => (
                  <button
                    key={t}
                    type="button"
                    disabled={t === 'source' ? !sourceReady : !ready && !recording}
                    onClick={() => selectTab(t)}
                    className={`h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[14px] transition disabled:opacity-40 ${tab === t ? 'bg-solid font-medium text-on-solid' : 'text-sub hover:text-ink'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className={`min-h-0 flex-1 ${tab === 'tutor' || tab === 'mindmap' || tab === 'source' ? 'flex flex-col' : 'overflow-y-auto'}`}>
              {tab === 'source' && sourceReady ? (
                <div className="min-h-0 flex-1">{left}</div>
              ) : recording ? (
                <WaitRecording tab={tab} label={tabs.find(([t]) => t === tab)?.[1] ?? ''} />
              ) : doc.status === 'processing' ? (
                <Processing doc={doc} />
              ) : doc.status === 'error' ? (
                <div className="py-24 text-center">
                  <p className="text-[16px] text-sub">{doc.error || '자료를 처리하지 못했어요.'}</p>
                  <Button className="mt-5" onClick={() => navigate('/add-content')}>
                    다시 올리기
                  </Button>
                </div>
              ) : tab === 'tutor' ? (
                <TutorTab doc={doc} onRef={onRef} />
              ) : tab === 'mindmap' ? (
                <MindmapTab doc={doc} />
              ) : (
                <div className={`mx-auto w-full px-5 pt-4 md:px-10 ${tab === 'memo' ? 'h-full max-w-[900px]' : 'max-w-[860px]'}`}>
                  {tab === 'summary' && <SummaryTab doc={doc} onRef={onRef} />}
                  {tab === 'quiz' && <QuizTab doc={doc} onRef={onRef} focusRequest={focus?.kind === 'quiz' ? `${focus.name}` : null} key={`q${focus?.kind === 'quiz' ? focus.n : 0}`} />}
                  {tab === 'flashcards' && (
                    <FlashcardsTab doc={doc} onRef={onRef} focusRequest={focus?.kind === 'flashcards' ? focus.name : null} key={`f${focus?.kind === 'flashcards' ? focus.n : 0}`} />
                  )}
                  {tab === 'memorize' && <MemorizeTab doc={doc} onRef={onRef} />}
                  {tab === 'concepts' && (
                    <ConceptsTab
                      doc={doc}
                      onRef={onRef}
                      onMakeSet={(kind, name) => {
                        if (doc.readOnly) return showToast('샘플 문서에는 새로 만들 수 없어요. 내 자료를 올려 보세요.');
                        setFocus((f) => ({ kind, name, n: (f?.n ?? 0) + 1 }));
                        selectTab(kind);
                      }}
                    />
                  )}
                  {tab === 'memo' && <MemoTab doc={doc} />}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
