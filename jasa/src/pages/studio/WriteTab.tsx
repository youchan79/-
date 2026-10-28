import { ArrowUp, Check, ClipboardCopy, FilePlus2, MessagesSquare, PenLine, Plus, Sparkles, Square, Trash2, UsersRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from '../../components/Link.tsx';
import { ErrorNote, Spinner } from '../../components/Notice.tsx';
import { post, stream } from '../../lib/api.ts';
import { countChars, formatDate, uid } from '../../lib/text.ts';
import { useWorkspace } from '../../lib/workspace.tsx';
import type { ChatMessage, Draft, DraftContext, Feedback, Fix } from '../../types.ts';
import { LIMITS } from './AnalysisTab.tsx';
import { draftContext, EmptyState, errorText, TabTitle } from './common.tsx';

export function WriteTab() {
  const { ws, update } = useWorkspace();
  const [selected, setSelected] = useState<string | null>(() => new URLSearchParams(location.search).get('draft'));
  const drafts = [...ws.drafts].sort((a, b) => b.updatedAt - a.updatedAt);
  const draft = drafts.find((d) => d.id === selected) ?? drafts[0] ?? null;

  function select(id: string) {
    setSelected(id);
    history.replaceState(null, '', `/app/write?draft=${id}`);
  }

  function create(analysisId: string | null) {
    const a = ws.analyses.find((x) => x.id === analysisId);
    const d: Draft = {
      id: uid(),
      analysisId: a?.id ?? null,
      title: a ? `${a.company} · ${a.question.slice(0, 24)}` : '새 원고',
      question: a?.question ?? '',
      charLimit: a?.charLimit ?? 1000,
      content: '',
      experienceIds: [],
      request: '',
      chat: [],
      feedback: null,
      updatedAt: Date.now(),
    };
    update((w) => ({ ...w, drafts: [d, ...w.drafts] }));
    select(d.id);
  }

  return (
    <>
      <TabTitle
        title="쓰고 다듬기"
        desc="고른 경험으로 초안을 쓰고, AI와 대화하며 고치거나 두 관점의 평가를 받아 보세요."
        action={drafts.length > 0 && <NewDraftButton onCreate={create} />}
      />
      {!draft ? (
        <EmptyState icon={<PenLine />} title="아직 원고가 없어요">
          <p>분석해 둔 문항으로 시작하면 회사·문항 분석을 AI가 함께 참고해요.</p>
          <div className="mt-5 flex flex-col items-stretch gap-2">
            {ws.analyses.map((a) => (
              <button key={a.id} className="btn-ghost justify-start text-left" onClick={() => create(a.id)}>
                <FilePlus2 size={16} className="shrink-0" />
                <span className="truncate">
                  {a.company} · {a.question}
                </span>
              </button>
            ))}
            {ws.analyses.length === 0 && (
              <Link to="/app/analysis" className="btn-primary">
                기업·문항 분석하러 가기
              </Link>
            )}
            <button className="btn-ghost" onClick={() => create(null)}>
              <Plus size={16} /> 문항만 적고 바로 쓰기
            </button>
          </div>
        </EmptyState>
      ) : (
        <>
          {drafts.length > 1 && (
            <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
              {drafts.map((d) => (
                <button
                  key={d.id}
                  onClick={() => select(d.id)}
                  className={`max-w-60 shrink-0 truncate rounded-full border px-3.5 py-1.5 text-sm font-medium ${
                    d.id === draft.id ? 'border-pine bg-pine text-white' : 'border-line bg-card hover:border-pine/40'
                  }`}
                >
                  {d.title}
                </button>
              ))}
            </div>
          )}
          <DraftWorkspace key={draft.id} draft={draft} />
        </>
      )}
    </>
  );
}

function NewDraftButton({ onCreate }: { onCreate: (analysisId: string | null) => void }) {
  const { ws } = useWorkspace();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button className="btn-ghost" onClick={() => setOpen(!open)}>
        <Plus size={16} /> 새 원고
      </button>
      {open && (
        <div className="card absolute right-0 z-20 mt-2 w-72 p-2 shadow-lg">
          {ws.analyses.map((a) => (
            <button
              key={a.id}
              className="block w-full truncate rounded-lg px-3 py-2 text-left text-sm hover:bg-pine-soft"
              onClick={() => {
                onCreate(a.id);
                setOpen(false);
              }}
            >
              {a.company} · {a.question}
            </button>
          ))}
          <button
            className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-pine hover:bg-pine-soft"
            onClick={() => {
              onCreate(null);
              setOpen(false);
            }}
          >
            + 문항만 적고 바로 쓰기
          </button>
        </div>
      )}
    </div>
  );
}

// ── 원고 하나의 작업 화면 ──────────────────────────────────

function DraftWorkspace({ draft }: { draft: Draft }) {
  const { ws, update } = useWorkspace();
  const [panel, setPanel] = useState<'chat' | 'feedback'>('chat');
  const context = draftContext(draft, ws.analyses);
  const analysis = ws.analyses.find((a) => a.id === draft.analysisId);

  function patch(fields: Partial<Draft>) {
    update((w) => ({ ...w, drafts: w.drafts.map((d) => (d.id === draft.id ? { ...d, ...fields, updatedAt: Date.now() } : d)) }));
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-4">
        <section className="card p-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {analysis ? (
              <Link to="/app/analysis" className="chip hover:bg-pine hover:text-white">
                {analysis.company}
                {analysis.role && ` · ${analysis.role}`} 분석 참고 중
              </Link>
            ) : (
              <span className="chip bg-sun-soft text-ink/70">분석 없이 쓰는 원고</span>
            )}
            <span className="text-muted">마지막 수정 {formatDate(draft.updatedAt)}</span>
            <button
              className="ml-auto rounded-lg p-1.5 text-muted hover:bg-danger-soft hover:text-danger"
              aria-label="원고 지우기"
              onClick={() => {
                if (confirm('이 원고를 지울까요? 되돌릴 수 없어요.')) update((w) => ({ ...w, drafts: w.drafts.filter((d) => d.id !== draft.id) }));
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
          <label className="label mt-4" htmlFor="question">문항</label>
          <textarea
            id="question"
            className="field min-h-16 resize-y"
            placeholder="자기소개서 문항을 적어 주세요."
            value={draft.question}
            onChange={(e) => patch({ question: e.target.value, title: draft.analysisId ? draft.title : e.target.value.slice(0, 30) || '새 원고' })}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold" htmlFor="limit">글자 수 제한</label>
            <select id="limit" className="field w-32 py-2" value={draft.charLimit} onChange={(e) => patch({ charLimit: Number(e.target.value) })}>
              {[...new Set([...LIMITS, draft.charLimit])].sort((a, b) => a - b).map((n) => (
                <option key={n} value={n}>
                  {n}자
                </option>
              ))}
            </select>
          </div>
        </section>

        <Generator draft={draft} context={context} patch={patch} />
        <Editor draft={draft} patch={patch} />
      </div>

      <aside className="card flex min-h-[560px] min-w-0 flex-col overflow-hidden xl:sticky xl:top-20 xl:h-[calc(100dvh-7rem)]">
        <div className="flex border-b border-line">
          {(
            [
              ['chat', 'AI 첨삭 대화', MessagesSquare],
              ['feedback', '심층 피드백', UsersRound],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setPanel(key)}
              className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-semibold ${
                panel === key ? 'border-b-2 border-pine text-pine' : 'text-muted hover:text-ink'
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
        {panel === 'chat' ? <ChatPanel draft={draft} context={context} patch={patch} /> : <FeedbackPanel draft={draft} context={context} patch={patch} />}
      </aside>
    </div>
  );
}

type Patch = (fields: Partial<Draft>) => void;

// ── 초안 생성 ─────────────────────────────────────────────

function Generator({ draft, context, patch }: { draft: Draft; context: DraftContext; patch: Patch }) {
  const { ws } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  function toggle(id: string) {
    const ids = draft.experienceIds.includes(id) ? draft.experienceIds.filter((x) => x !== id) : [...draft.experienceIds, id];
    patch({ experienceIds: ids });
  }

  async function generate() {
    if (!draft.question.trim()) return setError('문항을 먼저 적어 주세요.');
    if (draft.content.trim() && !confirm('지금 원고를 새 AI 초안으로 바꿀까요? 지금 내용은 사라져요.')) return;
    const ctl = new AbortController();
    abort.current = ctl;
    setBusy(true);
    setError('');
    try {
      const experiences = ws.experiences.filter((x) => draft.experienceIds.includes(x.id));
      await stream('/draft/generate', { context, experiences, request: draft.request }, (full) => patch({ content: full.trimStart() }), ctl.signal);
    } catch (e) {
      if (!ctl.signal.aborted) setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5">
      <p className="label">쓸 경험 고르기 <span className="font-normal text-muted">1~3개를 고르면 가장 좋아요</span></p>
      {ws.experiences.length === 0 ? (
        <p className="text-sm text-muted">
          정리된 경험이 없어요.{' '}
          <Link to="/app/experiences" className="font-semibold text-pine underline underline-offset-2">
            경험 정리
          </Link>
          에서 먼저 만들어 두면 초안이 훨씬 구체적이에요.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {ws.experiences.map((x) => {
            const on = draft.experienceIds.includes(x.id);
            return (
              <button
                key={x.id}
                onClick={() => toggle(x.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
                  on ? 'border-pine bg-pine text-white' : 'border-line bg-white hover:border-pine/40'
                }`}
              >
                {on && <Check size={14} />}
                {x.title || '(제목 없음)'}
              </button>
            );
          })}
        </div>
      )}
      <label className="label mt-4" htmlFor="request">추가 요청 <span className="font-normal text-muted">선택</span></label>
      <input
        id="request"
        className="field"
        placeholder="예) 협업 과정에서 갈등을 푼 부분을 강조해 줘"
        value={draft.request}
        onChange={(e) => patch({ request: e.target.value })}
      />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {busy ? (
          <button className="btn-ghost" onClick={() => abort.current?.abort()}>
            <Square size={14} /> 그만 쓰기
          </button>
        ) : (
          <button className="btn-primary" onClick={generate}>
            <Sparkles size={16} /> AI 초안 쓰기
          </button>
        )}
        {busy && (
          <span className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> 쓰는 중…
          </span>
        )}
      </div>
      {error && (
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </section>
  );
}

// ── 원고 편집기 ───────────────────────────────────────────

function Editor({ draft, patch }: { draft: Draft; patch: Patch }) {
  const { withSpaces, withoutSpaces } = countChars(draft.content);
  const over = withSpaces > draft.charLimit;
  const ratio = Math.min(withSpaces / draft.charLimit, 1);
  const [copied, setCopied] = useState(false);

  return (
    <section className="card overflow-hidden">
      <div className="h-1 bg-line">
        <div className={`h-full transition-all ${over ? 'bg-danger' : ratio >= 0.9 ? 'bg-pine' : 'bg-sun'}`} style={{ width: `${ratio * 100}%` }} />
      </div>
      <textarea
        aria-label="원고"
        className="block min-h-[420px] w-full resize-y bg-transparent px-5 py-4 text-[16px] leading-[1.9] outline-none placeholder:text-muted/60"
        placeholder="여기에 직접 쓰거나 ‘AI 초안 쓰기’를 눌러 보세요."
        value={draft.content}
        onChange={(e) => patch({ content: e.target.value })}
      />
      <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3 text-sm">
        <span className={over ? 'font-bold text-danger' : 'font-semibold'}>
          공백 포함 {withSpaces.toLocaleString()} / {draft.charLimit.toLocaleString()}자
        </span>
        <span className="text-muted">공백 제외 {withoutSpaces.toLocaleString()}자</span>
        {over && <span className="text-danger">{(withSpaces - draft.charLimit).toLocaleString()}자 넘었어요</span>}
        <button
          className="btn-ghost ml-auto px-3 py-1.5"
          disabled={!draft.content}
          onClick={async () => {
            await navigator.clipboard.writeText(draft.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check size={15} /> : <ClipboardCopy size={15} />} {copied ? '복사됨' : '복사'}
        </button>
      </div>
    </section>
  );
}

// ── AI 첨삭 대화 ──────────────────────────────────────────

const QUICK = ['두괄식으로 다듬어 줘', '글자 수에 맞게 줄여 줘', '경험을 더 구체적으로 써 줘', '어색한 문장을 찾아 줘', '회사와의 연결을 더 분명하게'];

/** 답변 안의 <draft>…</draft> 부분을 '원고에 반영'할 수 있는 덩어리로 나눔 */
function splitReply(text: string) {
  const parts: { kind: 'text' | 'draft'; text: string; complete: boolean }[] = [];
  let rest = text;
  for (;;) {
    const start = rest.indexOf('<draft>');
    if (start < 0) break;
    if (start > 0) parts.push({ kind: 'text', text: rest.slice(0, start), complete: true });
    const end = rest.indexOf('</draft>', start);
    if (end < 0) {
      parts.push({ kind: 'draft', text: rest.slice(start + 7), complete: false });
      return parts;
    }
    parts.push({ kind: 'draft', text: rest.slice(start + 7, end), complete: true });
    rest = rest.slice(end + 8);
  }
  if (rest.trim()) parts.push({ kind: 'text', text: rest, complete: true });
  return parts;
}

function ChatPanel({ draft, context, patch }: { draft: Draft; context: DraftContext; patch: Patch }) {
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [draft.chat.length, pending]);

  async function send(text: string) {
    text = text.trim();
    if (!text || pending !== null) return;
    if (!draft.question.trim()) return setError('문항을 먼저 적어 주세요.');
    const before = draft.chat;
    const messages: ChatMessage[] = [...before, { role: 'user', text }];
    patch({ chat: messages });
    setInput('');
    setError('');
    setPending('');
    try {
      const full = await stream('/draft/chat', { context, draft: draft.content, messages }, setPending);
      patch({ chat: [...messages, { role: 'model', text: full }] });
    } catch (e) {
      setError(errorText(e));
      patch({ chat: before });
      setInput(text);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {draft.chat.length === 0 && pending === null && (
          <p className="rounded-xl bg-paper p-4 text-sm leading-relaxed text-muted">
            원고를 어떻게 고치고 싶은지 편하게 말해 보세요. 전체를 고쳐 쓴 답에는 <b className="text-ink">원고에 반영</b> 버튼이 붙어요.
          </p>
        )}
        {draft.chat.map((m, i) => (
          <Message key={i} message={m} onApply={(text) => patch({ content: text })} />
        ))}
        {pending !== null &&
          (pending ? (
            <Message message={{ role: 'model', text: pending }} streaming />
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Spinner /> 생각하는 중…
            </p>
          ))}
        <div ref={bottom} />
      </div>
      <div className="border-t border-line p-3">
        <div className="-mx-3 mb-2 flex gap-1.5 overflow-x-auto px-3 pb-1">
          {QUICK.map((q) => (
            <button key={q} className="chip shrink-0 py-1 hover:bg-pine hover:text-white" disabled={pending !== null} onClick={() => send(q)}>
              {q}
            </button>
          ))}
        </div>
        {error && (
          <div className="mb-2">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <textarea
            className="field max-h-32 min-h-11 flex-1 resize-none py-2.5"
            rows={1}
            placeholder="예) 마지막 문단을 입사 후 포부로 바꿔 줘"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          <button className="btn-primary size-11 shrink-0 p-0" aria-label="보내기" disabled={!input.trim() || pending !== null}>
            <ArrowUp size={18} />
          </button>
        </form>
        {draft.chat.length > 0 && pending === null && (
          <button className="mt-2 text-xs text-muted hover:text-ink" onClick={() => confirm('대화를 모두 지울까요?') && patch({ chat: [] })}>
            대화 지우기
          </button>
        )}
      </div>
    </div>
  );
}

function Message({ message, onApply, streaming }: { message: ChatMessage; onApply?: (text: string) => void; streaming?: boolean }) {
  const [applied, setApplied] = useState(false);
  if (message.role === 'user') {
    return <p className="ml-8 rounded-2xl rounded-br-md bg-pine px-4 py-2.5 text-[15px] whitespace-pre-wrap text-white">{message.text}</p>;
  }
  return (
    <div className="mr-4 space-y-2 text-[15px] leading-relaxed">
      {splitReply(message.text).map((part, i) =>
        part.kind === 'text' ? (
          <p key={i} className="whitespace-pre-wrap">
            {part.text.trim()}
          </p>
        ) : (
          <div key={i} className="rounded-xl border border-pine/30 bg-pine-soft/60 p-3.5">
            <p className="text-sm whitespace-pre-wrap">{part.text.trim()}</p>
            <div className="mt-2.5 flex items-center gap-2 text-xs text-muted">
              <span>공백 포함 {countChars(part.text.trim()).withSpaces}자</span>
              {part.complete && !streaming && onApply && (
                <button
                  className="btn-primary ml-auto px-3 py-1.5 text-xs"
                  onClick={() => {
                    onApply(part.text.trim());
                    setApplied(true);
                  }}
                >
                  {applied ? (
                    <>
                      <Check size={13} /> 반영됨
                    </>
                  ) : (
                    '원고에 반영'
                  )}
                </button>
              )}
            </div>
          </div>
        ),
      )}
    </div>
  );
}

// ── 심층 피드백 ───────────────────────────────────────────

function FeedbackPanel({ draft, context, patch }: { draft: Draft; context: DraftContext; patch: Patch }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fb = draft.feedback;

  async function run() {
    setBusy(true);
    setError('');
    try {
      patch({ feedback: await post<Feedback>('/draft/feedback', { context, draft: draft.content }) });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  function apply(fix: Fix) {
    patch({ content: draft.content.replace(fix.original, () => fix.suggestion) });
  }

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
      <div className="flex items-center gap-3">
        <p className="flex-1 text-sm text-muted">서류를 거르는 인사담당자와 함께 일할 실무자, 두 사람의 눈으로 평가해요.</p>
        <button className="btn-primary shrink-0" onClick={run} disabled={busy || !draft.content.trim()}>
          {busy ? <Spinner /> : <UsersRound size={16} />} {fb ? '다시 평가' : '평가 받기'}
        </button>
      </div>
      <ErrorNote>{error}</ErrorNote>
      {busy && !fb && <p className="py-10 text-center text-sm text-muted">원고를 꼼꼼히 읽는 중이에요…</p>}
      {fb && (
        <>
          <div className="flex items-center gap-4 rounded-xl bg-paper p-4">
            <Score value={fb.score} size="lg" />
            <p className="text-sm leading-relaxed">{fb.summary}</p>
          </div>
          {fb.reviews.map((r) => (
            <section key={r.reviewer} className="rounded-xl border border-line p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">{r.reviewer}</h3>
                <Score value={r.score} />
              </div>
              <List title="좋은 점" items={r.strengths} tone="good" />
              <List title="고칠 점" items={r.improvements} tone="bad" />
            </section>
          ))}
          {fb.fixes.length > 0 && (
            <section>
              <h3 className="mb-2 font-bold">문장 고치기</h3>
              <ul className="space-y-2.5">
                {fb.fixes.map((f, i) => {
                  const pendingFix = draft.content.includes(f.original);
                  return (
                    <li key={i} className="rounded-xl border border-line p-3.5 text-sm">
                      <p className="text-muted line-through decoration-danger/60">{f.original}</p>
                      <p className="mt-1 font-medium">→ {f.suggestion}</p>
                      <p className="mt-1.5 text-xs text-muted">{f.reason}</p>
                      <button className="btn-ghost mt-2.5 px-3 py-1.5 text-xs" disabled={!pendingFix} onClick={() => apply(f)}>
                        {pendingFix ? (
                          '원고에 반영'
                        ) : (
                          <>
                            <Check size={13} /> 반영됨
                          </>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Score({ value, size = 'md' }: { value: number; size?: 'md' | 'lg' }) {
  const tone = value >= 80 ? 'text-pine' : value >= 60 ? 'text-ink' : 'text-danger';
  return (
    <span className={`font-serif font-black ${tone} ${size === 'lg' ? 'text-4xl' : 'text-xl'}`}>
      {value}
      <span className="text-sm font-semibold text-muted">점</span>
    </span>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone: 'good' | 'bad' }) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <p className={`text-xs font-bold ${tone === 'good' ? 'text-pine' : 'text-danger'}`}>{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
