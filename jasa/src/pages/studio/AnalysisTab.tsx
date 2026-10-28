import { Building2, ChevronDown, ExternalLink, PenLine, Search, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import Markdown from 'react-markdown';
import { ErrorNote, Spinner } from '../../components/Notice.tsx';
import { post } from '../../lib/api.ts';
import { navigate } from '../../lib/router.ts';
import { formatDate, uid } from '../../lib/text.ts';
import { useWorkspace } from '../../lib/workspace.tsx';
import type { Analysis, Draft, Source } from '../../types.ts';
import { EmptyState, errorText, TabTitle } from './common.tsx';

export const LIMITS = [300, 500, 700, 800, 1000, 1200, 1500, 2000];

export function AnalysisTab() {
  const { ws, update } = useWorkspace();
  const [selected, setSelected] = useState<string | null>(ws.analyses[0]?.id ?? null);
  const current = ws.analyses.find((a) => a.id === selected) ?? null;

  function startDraft(a: Analysis) {
    const draft: Draft = {
      id: uid(),
      analysisId: a.id,
      title: `${a.company} · ${a.question.slice(0, 24)}`,
      question: a.question,
      charLimit: a.charLimit,
      content: '',
      experienceIds: [],
      request: '',
      chat: [],
      feedback: null,
      updatedAt: Date.now(),
    };
    update((w) => ({ ...w, drafts: [draft, ...w.drafts] }));
    navigate(`/app/write?draft=${draft.id}`);
  }

  return (
    <>
      <TabTitle title="기업·문항 분석" desc="지원할 회사와 문항을 넣으면 최근 소식과 인재상을 검색해, 문항의 의도와 쓰는 방향을 알려줘요." />
      <AnalyzeForm onDone={(a) => setSelected(a.id)} />

      {ws.analyses.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={<Building2 />} title="아직 분석한 문항이 없어요">
            자기소개서 문항 하나마다 분석을 하나씩 만들어 두면, 원고를 쓸 때 그 내용을 AI가 함께 참고해요.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 lg:grid-cols-[260px_1fr]">
          <ul className="space-y-2">
            {ws.analyses.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => setSelected(a.id)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    a.id === selected ? 'border-pine bg-pine-soft' : 'border-line bg-card hover:border-pine/40'
                  }`}
                >
                  <p className="font-bold">{a.company}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted">{a.question}</p>
                </button>
              </li>
            ))}
          </ul>
          {current && (
            <article className="card min-w-0 p-6">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted">
                    {current.role && `${current.role} · `}
                    {current.charLimit}자 · {formatDate(current.createdAt)}
                  </p>
                  <h2 className="mt-1 font-serif text-xl font-bold">{current.company}</h2>
                  <p className="mt-2 rounded-xl bg-paper px-4 py-3 leading-relaxed">{current.question}</p>
                </div>
              </div>
              <div className="prose-jasa mt-6">
                <Markdown>{current.report}</Markdown>
              </div>
              <Sources sources={current.sources} />
              <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
                <button className="btn-primary" onClick={() => startDraft(current)}>
                  <PenLine size={16} /> 이 문항으로 쓰기
                </button>
                <button
                  className="btn-ghost ml-auto text-danger"
                  onClick={() => {
                    if (!confirm('이 분석을 지울까요? 이 분석으로 쓴 원고는 남아 있어요.')) return;
                    update((w) => ({ ...w, analyses: w.analyses.filter((x) => x.id !== current.id) }));
                    setSelected(null);
                  }}
                >
                  <Trash2 size={16} /> 지우기
                </button>
              </div>
            </article>
          )}
        </div>
      )}
    </>
  );
}

function AnalyzeForm({ onDone }: { onDone: (a: Analysis) => void }) {
  const { update } = useWorkspace();
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [question, setQuestion] = useState('');
  const [charLimit, setCharLimit] = useState(1000);
  const [posting, setPosting] = useState('');
  const [showPosting, setShowPosting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { company, role, question, charLimit, posting };
      const res = await post<{ report: string; sources: Source[] }>('/company/analyze', body);
      const analysis: Analysis = { id: uid(), ...body, ...res, createdAt: Date.now() };
      update((w) => ({ ...w, analyses: [analysis, ...w.analyses] }));
      onDone(analysis);
      setQuestion('');
      setPosting('');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="company">회사</label>
          <input id="company" required className="field" placeholder="예) ○○전자" value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="role">직무 <span className="font-normal text-muted">선택</span></label>
          <input id="role" className="field" placeholder="예) 마케팅, 백엔드 개발" value={role} onChange={(e) => setRole(e.target.value)} />
        </div>
      </div>
      <div className="mt-3">
        <label className="label" htmlFor="question">문항</label>
        <textarea
          id="question"
          required
          className="field min-h-20 resize-y"
          placeholder="예) 지원 동기와 입사 후 이루고 싶은 목표를 작성해 주세요."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="limit">글자 수 제한</label>
          <select id="limit" className="field w-36" value={charLimit} onChange={(e) => setCharLimit(Number(e.target.value))}>
            {LIMITS.map((n) => (
              <option key={n} value={n}>
                {n}자
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn-ghost" onClick={() => setShowPosting(!showPosting)}>
          채용공고 붙여넣기 <ChevronDown size={16} className={showPosting ? 'rotate-180' : ''} />
        </button>
        <button className="btn-primary ml-auto" disabled={busy}>
          {busy ? <Spinner /> : <Search size={16} />} {busy ? '검색하고 분석하는 중…' : '분석하기'}
        </button>
      </div>
      {showPosting && (
        <textarea
          className="field mt-3 min-h-32 resize-y"
          placeholder="채용공고의 자격 요건·우대 사항·직무 소개를 붙여 넣으면 더 정확해져요."
          value={posting}
          onChange={(e) => setPosting(e.target.value)}
        />
      )}
      {error && (
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </form>
  );
}

function Sources({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <details className="mt-6 rounded-xl bg-paper px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold">참고한 자료 {sources.length}개</summary>
      <ul className="mt-2 space-y-1.5 text-sm">
        {sources.map((s) => (
          <li key={s.uri}>
            <a href={s.uri} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-pine hover:underline">
              {s.title} <ExternalLink size={12} />
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
