import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, ChevronDown, ChevronRight, EyeOff, Layers, ListChecks, MoreVertical, RotateCcw } from 'lucide-react';
import { api, type Concept, type DocDetail, type MemorizeData, type Summary } from '../../lib/api.ts';
import { useApp } from '../../lib/app.tsx';
import { useMaterial, useProgress } from '../../lib/hooks.ts';
import { Markdown, RefChip, inline } from '../../lib/markdown.tsx';
import { useApiErrorHandler } from '../../components/Modals.tsx';
import { Button, IconButton, Spinner } from '../../components/ui.tsx';

export function Generating({ label }: { label: string }) {
  return (
    <div className="py-6">
      <div className="mb-6 flex items-center gap-2.5 text-[15px] text-sub">
        <Spinner className="h-4 w-4 text-ink" />
        {label}
      </div>
      <div className="space-y-3">
        {[92, 100, 84, 96, 70].map((w, i) => (
          <div key={i} className="h-3.5 animate-pulse rounded bg-soft" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

export function MaterialError({ message, onRetry }: { message: string | null; onRetry?: () => void }) {
  return (
    <div className="py-16 text-center">
      <p className="text-[15px] text-sub">{message || '만들지 못했어요.'}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCcw size={14} /> 다시 시도
        </Button>
      )}
    </div>
  );
}

function KebabMenu({ items }: { items: Array<{ label: string; onClick: () => void }> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <IconButton className="border border-line" onClick={() => setOpen((o) => !o)} aria-label="더보기">
        <MoreVertical size={16} />
      </IconButton>
      {open && (
        <div className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-line bg-canvas p-1 shadow-card" onMouseLeave={() => setOpen(false)}>
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              className="w-full rounded-lg px-3 py-2 text-left text-[14px] hover:bg-soft"
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function useRegenerate(doc: DocDetail, kind: string, reload: () => void) {
  const onError = useApiErrorHandler();
  const { showToast } = useApp();
  return async () => {
    if (doc.readOnly) return showToast('샘플 문서는 다시 만들 수 없어요.');
    try {
      await api(`/api/docs/${doc.id}/materials/${kind}/regenerate`, {});
      reload();
    } catch (e) {
      onError(e);
    }
  };
}

/* ---------- 요약 ---------- */

function EasyBox({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 inline-flex items-center gap-1 text-[14px] text-muted hover:text-ink">
        쉬운 설명 {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
      </button>
      {open && <div className="mt-3 border-l-2 border-line pl-4 text-[16px] leading-[1.8] text-sub">{text}</div>}
    </div>
  );
}

export function SummaryTab({ doc, onRef }: { doc: DocDetail; onRef: (r: string) => void }) {
  const m = useMaterial<Summary>(doc.id, 'summary');
  const regenerate = useRegenerate(doc, 'summary', m.reload);
  const { showToast } = useApp();
  if (m.status === 'error') return <MaterialError message={m.error} onRetry={doc.readOnly ? undefined : regenerate} />;
  if (!m.data) return <Generating label="AI가 요약을 만들고 있어요" />;
  const s = m.data;
  const firstRef = s.sections.find((x) => x.ref)?.ref ?? '';
  const headRef = firstRef.startsWith('p.') ? 'p.1' : firstRef ? '00:00' : '';
  return (
    <div className="relative pb-16">
      <div className="absolute right-0 top-0">
        <KebabMenu
          items={[
            {
              label: '요약 복사하기',
              onClick: () => {
                const text = [s.overview, ...s.sections.map((x) => `## ${x.heading}\n${x.body}`)].join('\n\n');
                void navigator.clipboard.writeText(text).then(() => showToast('복사했어요.'));
              },
            },
            { label: '다시 만들기', onClick: () => void regenerate() },
          ]}
        />
      </div>
      <h2 className="flex items-center pr-12 text-[30px] font-semibold tracking-tight">
        요약
        <span className="ml-2 inline-flex">
          <RefChip value={headRef} onClick={() => onRef(headRef)} />
        </span>
      </h2>
      <p className="mt-4 text-[16px] leading-[1.8]">{inline(s.overview, 'ov', onRef)}</p>
      <div className="mt-8 space-y-10">
        {s.sections.map((sec, i) => (
          <section key={i}>
            <h3 className="flex items-center text-[21px] font-semibold tracking-tight">
              {sec.heading}
              <RefChip value={sec.ref} onClick={() => onRef(sec.ref)} />
            </h3>
            <div className="mt-3">
              <Markdown text={sec.body} onRef={onRef} />
            </div>
            {sec.easy && <EasyBox text={sec.easy} />}
          </section>
        ))}
      </div>
    </div>
  );
}

/* ---------- 암기 ---------- */

export function MemorizeTab({ doc, onRef }: { doc: DocDetail; onRef: (r: string) => void }) {
  const m = useMaterial<MemorizeData>(doc.id, 'memorize');
  const regenerate = useRegenerate(doc, 'memorize', m.reload);
  const [done, setDone] = useProgress<Record<string, boolean>>(`memorize:${doc.id}`, {});
  const [onlyLeft, setOnlyLeft] = useState(false);
  const [group, setGroup] = useState('전체');
  if (m.status === 'error') return <MaterialError message={m.error} onRetry={doc.readOnly ? undefined : regenerate} />;
  if (!m.data) return <Generating label="AI가 외울 것들을 뽑고 있어요" />;
  const items = m.data.groups.flatMap((g, gi) => g.items.map((it, ii) => ({ ...it, key: `${gi}-${ii}`, group: g.title })));
  const total = items.length;
  const count = items.filter((it) => done[it.key]).length;
  return (
    <div className="pb-16">
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-3 bg-canvas px-1 pb-3 pt-1">
        <span className="text-[14px] text-muted">
          외움 {count}/{total}
        </span>
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-soft-2">
          <div className="h-full rounded-full bg-solid transition-all" style={{ width: `${(count / Math.max(1, total)) * 100}%` }} />
        </div>
        <button
          type="button"
          onClick={() => setOnlyLeft((v) => !v)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] ${onlyLeft ? 'bg-solid text-on-solid' : 'border border-line text-sub'}`}
        >
          <EyeOff size={14} /> 못 외운 것만
        </button>
        <div className="ml-auto flex items-center gap-2">
          <select value={group} onChange={(e) => setGroup(e.target.value)} className="h-9 rounded-full border border-line bg-canvas px-3 text-[14px] outline-none">
            <option>전체</option>
            {m.data.groups.map((g) => (
              <option key={g.title}>{g.title}</option>
            ))}
          </select>
          <KebabMenu items={[{ label: '체크 모두 지우기', onClick: () => setDone({}) }, { label: '다시 만들기', onClick: () => void regenerate() }]} />
        </div>
      </div>
      <div className="mt-2 space-y-6">
        {m.data.groups
          .map((g, gi) => ({ g, gi }))
          .filter(({ g }) => group === '전체' || g.title === group)
          .map(({ g, gi }) => {
            const rows = g.items.map((it, ii) => ({ ...it, key: `${gi}-${ii}` })).filter((it) => !onlyLeft || !done[it.key]);
            if (!rows.length) return null;
            return (
              <div key={gi}>
                <div className="mb-1 px-1 text-[13px] text-muted">{g.title}</div>
                <div className="border-t border-line">
                  {rows.map((it) => (
                    <div key={it.key} className="flex items-start gap-3 border-b border-line px-1 py-3.5">
                      <button
                        type="button"
                        onClick={() => setDone((d) => ({ ...d, [it.key]: !d[it.key] }))}
                        className={`mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${done[it.key] ? 'border-solid bg-solid text-on-solid' : 'border-line'}`}
                        aria-label="외움 표시"
                      >
                        {done[it.key] && <Check size={13} strokeWidth={3} />}
                      </button>
                      <div className={`flex-1 text-[16px] leading-[1.65] ${done[it.key] ? 'text-muted' : ''}`}>
                        {inline(it.text, it.key, onRef)}
                        <RefChip value={it.ref} onClick={() => onRef(it.ref)} />
                      </div>
                      <BookOpen size={16} className="mt-1 shrink-0 text-muted" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        {onlyLeft && count === total && <p className="py-10 text-center text-[15px] text-muted">모두 외웠어요. 퀴즈로 확인해 보세요.</p>}
      </div>
    </div>
  );
}

/* ---------- 개념 ---------- */

export function ConceptsTab({
  doc,
  onRef,
  onMakeSet,
}: {
  doc: DocDetail;
  onRef: (r: string) => void;
  onMakeSet: (kind: 'quiz' | 'flashcards', focus: string) => void;
}) {
  const m = useMaterial<{ concepts: Concept[] }>(doc.id, 'concepts');
  const regenerate = useRegenerate(doc, 'concepts', m.reload);
  const [open, setOpen] = useState(0);
  if (m.status === 'error') return <MaterialError message={m.error} onRetry={doc.readOnly ? undefined : regenerate} />;
  if (!m.data) return <Generating label="AI가 핵심 개념을 정리하고 있어요" />;
  return (
    <div className="relative pb-16">
      <div className="flex justify-end pb-2">
        <KebabMenu items={[{ label: '다시 만들기', onClick: () => void regenerate() }]} />
      </div>
      <div className="border-t border-line">
        {m.data.concepts.map((c, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className="border-b border-line">
              <button type="button" className="flex w-full items-start gap-3 px-2 py-4 text-left" onClick={() => setOpen(isOpen ? -1 : i)}>
                <div className="min-w-0 flex-1">
                  <div className="text-[17px] font-semibold">{c.name}</div>
                  {!isOpen && <div className="mt-1 truncate text-[14px] text-sub">{c.short}</div>}
                </div>
                <div className="flex shrink-0 items-center gap-1 pt-0.5">
                  {c.refs.map((r) => (
                    <span key={r} className="rounded-md bg-soft-2 px-1.5 py-0.5 text-[12px] text-muted">
                      {r}
                    </span>
                  ))}
                  {isOpen ? <ChevronDown size={17} className="ml-1 text-muted" /> : <ChevronRight size={17} className="ml-1 text-muted" />}
                </div>
              </button>
              {isOpen && (
                <div className="space-y-5 px-2 pb-6">
                  <div className="space-y-3 pl-2">
                    {c.definition.split(/\n\s*\n/).map((p, j) => (
                      <p key={j} className="text-[16px] leading-[1.75]">
                        {inline(p, `d${i}${j}`, onRef)}
                      </p>
                    ))}
                  </div>
                  <div>
                    <div className="mb-1.5 text-[13px] text-muted">핵심 포인트</div>
                    <ul className="list-disc space-y-1 pl-6 text-[16px] leading-[1.7]">
                      {c.points.map((p, j) => (
                        <li key={j}>{inline(p, `pt${i}${j}`, onRef)}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="mb-1.5 text-[13px] text-muted">예시</div>
                    <p className="pl-2 text-[16px] leading-[1.7]">{c.example}</p>
                  </div>
                  <div>
                    <div className="mb-1.5 text-[13px] text-muted">자주 혼동되는 점</div>
                    <p className="pl-2 text-[16px] leading-[1.7]">{c.confusion}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => onMakeSet('quiz', c.name)}>
                      <ListChecks size={15} /> 이 개념 퀴즈 만들기
                    </Button>
                    <Button size="sm" onClick={() => onMakeSet('flashcards', c.name)}>
                      <Layers size={15} /> 이 개념 카드 만들기
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- 메모 ---------- */

export function MemoTab({ doc }: { doc: DocDetail }) {
  const [local, setLocal] = useProgress<string>(`memo:${doc.id}`, '');
  const [text, setText] = useState(doc.readOnly ? '' : doc.memo);
  const [saved, setSaved] = useState(true);
  const timer = useRef<number>(undefined);

  useEffect(() => {
    if (doc.readOnly) setText(local);
  }, [doc.readOnly, local]);

  const value = useMemo(() => text, [text]);

  const onChange = (v: string) => {
    setText(v);
    if (doc.readOnly) {
      setLocal(v);
      return;
    }
    setSaved(false);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      await api(`/api/docs/${doc.id}`, { memo: v }, { method: 'PATCH' }).catch(() => {});
      setSaved(true);
    }, 600);
  };

  return (
    <div className="relative h-full min-h-[60dvh]">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="교수님이 강조한 한마디, 놓치기 전에 여기 적어두세요"
        className="h-full min-h-[60dvh] w-full resize-none bg-transparent px-2 pt-4 text-[16px] leading-[1.8] outline-none placeholder:italic placeholder:text-muted/70"
      />
      {!doc.readOnly && text && <div className="absolute bottom-2 right-2 text-[12px] text-muted">{saved ? '저장됨' : '저장 중'}</div>}
    </div>
  );
}
