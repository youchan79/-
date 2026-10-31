import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight, Flag, Plus, RotateCcw, X } from 'lucide-react';
import { api, type Card, type DocDetail, type QuizQ, type StudySet } from '../../lib/api.ts';
import { useApp } from '../../lib/app.tsx';
import { usePoll, useProgress } from '../../lib/hooks.ts';
import { RefChip, inline } from '../../lib/markdown.tsx';
import { useApiErrorHandler } from '../../components/Modals.tsx';
import { Button, Modal, Segmented } from '../../components/ui.tsx';
import { Generating, MaterialError } from './tabs.tsx';

type Kind = 'quiz' | 'flashcards';

function useSets<T>(doc: DocDetail, kind: Kind) {
  const [sets, setSets] = useState<StudySet<T>[] | null>(null);
  const load = useCallback(async () => {
    const r = await api<{ sets: StudySet<T>[] }>(`/api/docs/${doc.id}/sets/${kind}`);
    setSets(r.sets);
    return r.sets;
  }, [doc.id, kind]);
  useEffect(() => {
    void load();
  }, [load]);
  usePoll(() => void load(), !!sets?.some((s) => s.status === 'generating'));
  return { sets, load };
}

export function useCreateSet(doc: DocDetail) {
  const onError = useApiErrorHandler();
  const { showToast, me, openLogin } = useApp();
  return async (kind: Kind, opts: { count?: number; focus?: string; difficulty?: string } = {}) => {
    if (!me?.user) {
      openLogin({ mode: 'signup' });
      return null;
    }
    if (doc.readOnly) {
      showToast('샘플 문서에는 새로 만들 수 없어요. 내 자료를 올려 보세요.');
      return null;
    }
    try {
      return (await api<{ id: string }>(`/api/docs/${doc.id}/sets/${kind}`, opts)).id;
    } catch (e) {
      onError(e);
      return null;
    }
  };
}

function NewSetModal({ kind, open, onClose, onCreate }: { kind: Kind; open: boolean; onClose: () => void; onCreate: (count: number, difficulty: string) => void }) {
  const counts = kind === 'quiz' ? ['5', '10', '15'] : ['10', '20', '30'];
  const [count, setCount] = useState(counts[0]);
  const [difficulty, setDifficulty] = useState('보통');
  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-[20px] font-semibold">{kind === 'quiz' ? '새 퀴즈 만들기' : '새 플래시카드 만들기'}</h2>
      <p className="mt-1 text-[14px] text-muted">이미 만든 문제와 겹치지 않게 새로 만들어요.</p>
      <div className="mt-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[15px]">{kind === 'quiz' ? '문제 수' : '카드 수'}</span>
          <Segmented value={count} onChange={setCount} options={counts.map((c) => [c, `${c}개`] as [string, string])} />
        </div>
        {kind === 'quiz' && (
          <div className="flex items-center justify-between">
            <span className="text-[15px]">난이도</span>
            <Segmented value={difficulty} onChange={setDifficulty} options={['쉬움', '보통', '어려움'].map((d) => [d, d] as [string, string])} />
          </div>
        )}
      </div>
      <Button
        size="lg"
        className="mt-6 w-full"
        onClick={() => {
          onCreate(Number(count), difficulty);
          onClose();
        }}
      >
        만들기
      </Button>
    </Modal>
  );
}

function SetHome<T>({
  kind,
  sets,
  onOpen,
  onNew,
  scoreOf,
}: {
  kind: Kind;
  sets: StudySet<T>[];
  onOpen: (id: string) => void;
  onNew: () => void;
  scoreOf: (s: StudySet<T>) => string;
}) {
  return (
    <div className="pb-16">
      <div className="flex items-center justify-between pb-4">
        <h2 className="text-[22px] font-semibold tracking-tight">{kind === 'quiz' ? '퀴즈' : '플래시카드'}</h2>
        <Button size="sm" onClick={onNew}>
          <Plus size={15} /> {kind === 'quiz' ? '새 퀴즈 만들기' : '새 카드 만들기'}
        </Button>
      </div>
      <div className="space-y-2">
        {sets.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={s.status !== 'ready'}
            onClick={() => onOpen(s.id)}
            className="flex w-full items-center gap-4 rounded-2xl border border-line px-5 py-4 text-left transition hover:bg-soft disabled:hover:bg-transparent"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[16px] font-medium">{s.title}</div>
              <div className="mt-0.5 text-[13px] text-muted">
                {s.status === 'generating' ? 'AI가 만들고 있어요' : s.status === 'error' ? s.error || '만들지 못했어요' : scoreOf(s)}
              </div>
            </div>
            {s.status === 'ready' && <ChevronRight size={18} className="text-muted" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function SegmentBar({ total, current, done }: { total: number; current: number; done: (i: number) => boolean }) {
  return (
    <div className="flex flex-1 gap-1">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-[5px] flex-1 rounded-full ${i === current || done(i) ? 'bg-solid' : 'bg-soft-2'}`} />
      ))}
    </div>
  );
}

/* ---------- 퀴즈 ---------- */

interface QuizProgress {
  answers: Record<number, number>;
  index: number;
  retry?: number[] | null;
}

function QuizPlayer({ set, onHome, onRef }: { set: StudySet<{ questions: QuizQ[] }>; onHome: () => void; onRef: (r: string) => void }) {
  const { showToast } = useApp();
  const qs = set.data!.questions;
  const [p, setP, loaded] = useProgress<QuizProgress>(`quiz:${set.id}`, { answers: {}, index: 0, retry: null });
  const [hint, setHint] = useState(false);
  const [finished, setFinished] = useState(false);
  const order = p.retry ?? qs.map((_, i) => i);
  const pos = Math.min(p.index, order.length - 1);
  const qi = order[pos];
  const q = qs[qi];
  const chosen = p.answers[qi];
  useEffect(() => setHint(false), [qi]);

  if (!loaded) return null;

  const correct = qs.filter((qq, i) => p.answers[i] === qq.answer).length;
  if (finished || (Object.keys(p.answers).length === qs.length && p.index >= order.length)) {
    const wrong = qs.map((_, i) => i).filter((i) => p.answers[i] !== qs[i].answer);
    return (
      <div className="flex flex-col items-center py-14 text-center">
        <div className="text-[14px] text-muted">{set.title} 결과</div>
        <div className="mt-2 text-[44px] font-semibold tracking-tight">
          {correct} <span className="text-[24px] text-muted">/ {qs.length}</span>
        </div>
        <p className="mt-2 text-[15px] text-sub">{wrong.length ? `틀린 문제 ${wrong.length}개를 다시 풀어 보세요.` : '모두 맞혔어요.'}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {wrong.length > 0 && (
            <Button
              onClick={() => {
                setP((prev) => {
                  const answers = { ...prev.answers };
                  for (const i of wrong) delete answers[i];
                  return { answers, index: 0, retry: wrong };
                });
                setFinished(false);
              }}
            >
              <RotateCcw size={15} /> 틀린 문제 다시 풀기
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setP({ answers: {}, index: 0, retry: null });
              setFinished(false);
            }}
          >
            처음부터 다시
          </Button>
          <Button variant="ghost" onClick={onHome}>
            퀴즈 홈으로
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-16">
      <div className="flex items-center gap-4 pb-6">
        <button type="button" onClick={onHome} className="inline-flex shrink-0 items-center gap-1.5 text-[14px] text-sub hover:text-ink">
          <ArrowLeft size={15} /> 퀴즈 홈으로
        </button>
        <SegmentBar total={order.length} current={pos} done={(i) => p.answers[order[i]] !== undefined} />
        <span className="shrink-0 text-[13px] tabular-nums text-muted">
          {pos + 1} / {order.length}
        </span>
        <button type="button" className="shrink-0 text-muted hover:text-ink" onClick={() => showToast('문제 신고를 받았어요. 확인해 볼게요.')} aria-label="문제 신고">
          <Flag size={17} />
        </button>
      </div>

      <h3 className="text-[19px] font-medium leading-[1.6]">{q.question}</h3>
      <button type="button" onClick={() => setHint((h) => !h)} className="mt-4 inline-flex items-center gap-1 text-[14px] text-muted hover:text-ink">
        힌트 보기 {hint ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
      </button>
      {hint && <p className="mt-2 border-l-2 border-line pl-3 text-[15px] text-sub">{q.hint}</p>}

      <div className="mt-5 space-y-3">
        {q.options.map((opt, i) => {
          const answered = chosen !== undefined;
          const isAnswer = i === q.answer;
          const isChosen = i === chosen;
          const tone = answered && isAnswer ? 'border-green bg-green-soft/40' : answered && isChosen ? 'border-red' : 'border-line hover:bg-soft';
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => setP((prev) => ({ ...prev, answers: { ...prev.answers, [qi]: i } }))}
              className={`w-full rounded-2xl border px-4 py-3.5 text-left transition ${tone}`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[13px] ${
                    answered && isAnswer ? 'border-green bg-green text-white' : answered && isChosen ? 'border-red bg-red text-white' : 'border-line text-muted'
                  }`}
                >
                  {'ABCD'[i]}
                </span>
                <span className="text-[16px]">{opt}</span>
              </div>
              {answered && (isAnswer || isChosen) && (
                <div className="mt-2 pl-10">
                  <div className={`flex items-center gap-1 text-[13px] font-medium ${isAnswer ? 'text-green' : 'text-red'}`}>
                    {isAnswer ? <Check size={14} /> : <X size={14} />} {isAnswer ? '정답' : '오답'}
                  </div>
                  {isAnswer && (
                    <p className="mt-1 text-[14px] leading-[1.65] text-sub">
                      {inline(q.explanation, `ex${qi}`, onRef)}
                      <RefChip value={q.ref} onClick={() => onRef(q.ref)} />
                    </p>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-10 flex items-center justify-between border-t border-line pt-5">
        <button
          type="button"
          disabled={pos === 0}
          onClick={() => setP((prev) => ({ ...prev, index: Math.max(0, pos - 1) }))}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-[15px] text-sub disabled:opacity-30"
        >
          <ArrowLeft size={16} /> 이전
        </button>
        <button
          type="button"
          onClick={() => {
            if (pos + 1 >= order.length) {
              if (Object.keys(p.answers).length < qs.length && !p.retry) {
                const firstUnanswered = order.findIndex((i) => p.answers[i] === undefined);
                if (firstUnanswered >= 0) return setP((prev) => ({ ...prev, index: firstUnanswered }));
              }
              setFinished(true);
              setP((prev) => ({ ...prev, index: order.length }));
            } else setP((prev) => ({ ...prev, index: pos + 1 }));
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-[15px] font-medium"
        >
          {pos + 1 >= order.length ? '결과 보기' : '다음'} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function QuizTab({ doc, onRef, focusRequest }: { doc: DocDetail; onRef: (r: string) => void; focusRequest?: string | null }) {
  const { sets, load } = useSets<{ questions: QuizQ[] }>(doc, 'quiz');
  const create = useCreateSet(doc);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const autoCreated = useRef(false);
  const { me } = useApp();

  // 처음 열면 첫 퀴즈를 바로 만든다. 샘플은 이미 들어 있다.
  useEffect(() => {
    if (!sets || autoCreated.current || doc.readOnly || !me?.user) return;
    if (sets.length === 0) {
      autoCreated.current = true;
      void create('quiz', { count: 5 }).then((id) => id && load().then(() => setOpenId(id)));
    } else if (!openId && sets.length === 1 && sets[0].status !== 'error') setOpenId(sets[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets]);

  useEffect(() => {
    if (sets?.length === 1 && doc.readOnly && !openId) setOpenId(sets[0].id);
  }, [sets, doc.readOnly, openId]);

  useEffect(() => {
    if (!focusRequest) return;
    void create('quiz', { count: 5, focus: focusRequest }).then((id) => id && load().then(() => setOpenId(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  if (!sets) return <Generating label="퀴즈를 불러오고 있어요" />;
  const open = sets.find((s) => s.id === openId);
  if (open?.status === 'generating') return <Generating label="AI가 퀴즈를 만들고 있어요" />;
  if (open?.status === 'error') return <MaterialError message={open.error} onRetry={() => setOpenId(null)} />;
  if (open?.data) return <QuizPlayer key={open.id} set={open as any} onHome={() => setOpenId(null)} onRef={onRef} />;
  if (sets.length === 0) {
    return me?.user ? <Generating label="AI가 퀴즈를 만들고 있어요" /> : <MaterialError message="로그인하면 퀴즈를 만들 수 있어요." />;
  }
  return (
    <>
      <SetHome
        kind="quiz"
        sets={sets}
        onOpen={setOpenId}
        onNew={() => setNewOpen(true)}
        scoreOf={(s) => `${(s.data as any)?.questions?.length ?? 0}문제`}
      />
      <NewSetModal
        kind="quiz"
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreate={(count, difficulty) => void create('quiz', { count, difficulty }).then((id) => id && load().then(() => setOpenId(id)))}
      />
    </>
  );
}

/* ---------- 플래시카드 ---------- */

interface CardProgress {
  known: number[];
  unknown: number[];
  index: number;
  only?: number[] | null;
}

function CardPlayer({ set, onHome, onRef }: { set: StudySet<{ cards: Card[] }>; onHome: () => void; onRef: (r: string) => void }) {
  const cards = set.data!.cards;
  const [p, setP, loaded] = useProgress<CardProgress>(`cards:${set.id}`, { known: [], unknown: [], index: 0, only: null });
  const [flipped, setFlipped] = useState(false);
  const order = p.only ?? cards.map((_, i) => i);
  const pos = Math.min(p.index, order.length);
  const done = pos >= order.length;
  const ci = order[pos];

  const go = (d: number) => {
    setFlipped(false);
    setP((prev) => ({ ...prev, index: Math.max(0, Math.min(order.length, pos + d)) }));
  };
  const mark = (knownIt: boolean) => {
    setFlipped(false);
    setP((prev) => ({
      ...prev,
      known: knownIt ? [...new Set([...prev.known, ci])] : prev.known.filter((x) => x !== ci),
      unknown: knownIt ? prev.unknown.filter((x) => x !== ci) : [...new Set([...prev.unknown, ci])],
      index: pos + 1,
    }));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea')) return;
      if (e.key === ' ') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!loaded) return null;
  const knownCount = order.filter((i) => p.known.includes(i)).length;
  const unknownCount = order.filter((i) => p.unknown.includes(i)).length;

  return (
    <div className="pb-16">
      <div className="flex items-center gap-4 pb-6">
        <button type="button" onClick={onHome} className="inline-flex shrink-0 items-center gap-1.5 text-[14px] text-sub hover:text-ink">
          <ArrowLeft size={15} /> 플래시카드 홈으로
        </button>
        <SegmentBar total={order.length} current={done ? -1 : pos} done={(i) => i < pos} />
      </div>

      {done ? (
        <div className="flex flex-col items-center py-14 text-center">
          <div className="text-[14px] text-muted">한 바퀴 끝</div>
          <div className="mt-3 flex gap-8 text-[15px]">
            <span>
              알고있어요 <b className="text-[22px]">{knownCount}</b>
            </span>
            <span>
              모르겠어요 <b className="text-[22px]">{unknownCount}</b>
            </span>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {unknownCount > 0 && (
              <Button onClick={() => setP((prev) => ({ ...prev, only: order.filter((i) => prev.unknown.includes(i)), index: 0 }))}>
                <RotateCcw size={15} /> 모르는 카드만 다시
              </Button>
            )}
            <Button variant="outline" onClick={() => setP({ known: [], unknown: [], index: 0, only: null })}>
              처음부터
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-center gap-3 md:gap-6">
            <button type="button" onClick={() => go(-1)} disabled={pos === 0} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-soft text-sub disabled:opacity-40" aria-label="이전 카드">
              <ArrowLeft size={18} />
            </button>
            <button type="button" className="flip-card aspect-[400/460] w-full max-w-[400px]" onClick={() => setFlipped((f) => !f)}>
              <div className={`flip-inner relative h-full w-full ${flipped ? 'flipped' : ''}`}>
                <div className="flip-face absolute inset-0 flex flex-col rounded-[28px] bg-soft p-8 text-left">
                  <div className="flex flex-1 items-center text-[22px] font-medium leading-[1.55]">{cards[ci].front}</div>
                  <div className="text-center text-[14px] text-muted">탭하여 정답보기</div>
                </div>
                <div className="flip-face flip-back absolute inset-0 flex flex-col rounded-[28px] border border-line bg-canvas p-8 text-left">
                  <div className="text-[13px] text-muted">정답</div>
                  <div className="flex flex-1 items-center text-[19px] leading-[1.65]">{inline(cards[ci].back, `b${ci}`, onRef)}</div>
                  <div className="text-right">
                    <RefChip value={cards[ci].ref} onClick={() => onRef(cards[ci].ref)} />
                  </div>
                </div>
              </div>
            </button>
            <button type="button" onClick={() => go(1)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-soft text-sub" aria-label="다음 카드">
              <ArrowRight size={18} />
            </button>
          </div>
          <div className="mx-auto mt-8 flex max-w-[400px] items-center justify-between px-2 text-[15px]">
            <button type="button" onClick={() => mark(false)} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sub hover:bg-soft">
              <X size={17} /> 모르겠어요 <span className="tabular-nums text-muted">{unknownCount}</span>
            </button>
            <button type="button" onClick={() => mark(true)} className="inline-flex items-center gap-2 rounded-full px-3 py-2 hover:bg-soft">
              <span className="tabular-nums text-muted">{knownCount}</span> 알고있어요 <Check size={17} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function FlashcardsTab({ doc, onRef, focusRequest }: { doc: DocDetail; onRef: (r: string) => void; focusRequest?: string | null }) {
  const { sets, load } = useSets<{ cards: Card[] }>(doc, 'flashcards');
  const create = useCreateSet(doc);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const autoCreated = useRef(false);
  const { me } = useApp();

  useEffect(() => {
    if (!sets) return;
    if (sets.length === 0 && !autoCreated.current && !doc.readOnly && me?.user) {
      autoCreated.current = true;
      void create('flashcards', { count: 10 }).then((id) => id && load().then(() => setOpenId(id)));
    } else if (!openId && sets.length === 1 && sets[0].status !== 'error' && !autoCreated.current) {
      autoCreated.current = true;
      setOpenId(sets[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets]);

  useEffect(() => {
    if (!focusRequest) return;
    void create('flashcards', { count: 10, focus: focusRequest }).then((id) => id && load().then(() => setOpenId(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  if (!sets) return <Generating label="플래시카드를 불러오고 있어요" />;
  const open = sets.find((s) => s.id === openId);
  if (open?.status === 'generating') return <Generating label="AI가 플래시카드를 만들고 있어요" />;
  if (open?.status === 'error') return <MaterialError message={open.error} onRetry={() => setOpenId(null)} />;
  if (open?.data) return <CardPlayer key={open.id} set={open as any} onHome={() => setOpenId(null)} onRef={onRef} />;
  if (sets.length === 0) {
    return me?.user ? <Generating label="AI가 플래시카드를 만들고 있어요" /> : <MaterialError message="로그인하면 플래시카드를 만들 수 있어요." />;
  }
  return (
    <>
      <SetHome kind="flashcards" sets={sets} onOpen={setOpenId} onNew={() => setNewOpen(true)} scoreOf={(s) => `${(s.data as any)?.cards?.length ?? 0}장`} />
      <NewSetModal
        kind="flashcards"
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreate={(count) => void create('flashcards', { count }).then((id) => id && load().then(() => setOpenId(id)))}
      />
    </>
  );
}
