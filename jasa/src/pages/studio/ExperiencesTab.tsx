import { BookOpenText, FileUp, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { ErrorNote, InfoNote, Spinner } from '../../components/Notice.tsx';
import { post } from '../../lib/api.ts';
import { readBase64, uid } from '../../lib/text.ts';
import { useWorkspace } from '../../lib/workspace.tsx';
import type { Experience, ExtractRequest } from '../../types.ts';
import { EmptyState, errorText, TabTitle } from './common.tsx';

const ACCEPT = '.pdf,.txt,.md,.png,.jpg,.jpeg,.webp';
const MAX_FILE_MB = 10;

const STAR: { key: 'situation' | 'task' | 'action' | 'result'; label: string; hint: string }[] = [
  { key: 'situation', label: '상황', hint: '어떤 상황이었나요?' },
  { key: 'task', label: '과제', hint: '무엇을 해결해야 했나요?' },
  { key: 'action', label: '행동', hint: '내가 직접 한 일은?' },
  { key: 'result', label: '결과', hint: '무엇이 달라졌나요? (숫자가 있으면 좋아요)' },
];

export function ExperiencesTab() {
  const { ws, update } = useWorkspace();
  const [editing, setEditing] = useState<string | null>(null);

  function add() {
    const blank: Experience = { id: uid(), title: '', period: '', situation: '', task: '', action: '', result: '', skills: [] };
    update((w) => ({ ...w, experiences: [blank, ...w.experiences] }));
    setEditing(blank.id);
  }

  return (
    <>
      <TabTitle
        title="경험 정리"
        desc="자기소개서의 재료가 될 경험을 모아요. 정리해 둔 경험은 모든 문항에서 다시 쓸 수 있어요."
        action={
          <button className="btn-ghost" onClick={add}>
            <Plus size={16} /> 직접 추가
          </button>
        }
      />
      <Importer />
      <div className="mt-8 space-y-4">
        {ws.experiences.length === 0 ? (
          <EmptyState icon={<BookOpenText />} title="아직 정리된 경험이 없어요">
            위에 이력서나 활동 기록을 넣고 ‘AI로 정리하기’를 누르거나, ‘직접 추가’로 하나씩 적어 보세요.
          </EmptyState>
        ) : (
          ws.experiences.map((x) =>
            editing === x.id ? (
              <ExperienceForm key={x.id} experience={x} onDone={() => setEditing(null)} />
            ) : (
              <ExperienceCard key={x.id} experience={x} onEdit={() => setEditing(x.id)} />
            ),
          )
        )}
      </div>
    </>
  );
}

function Importer() {
  const { update } = useWorkspace();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const input = useRef<HTMLInputElement>(null);

  function pick(f: File | undefined) {
    setError('');
    if (!f) return;
    if (f.size > MAX_FILE_MB * 1024 * 1024) return setError(`파일은 ${MAX_FILE_MB}MB 이하만 올릴 수 있어요.`);
    setFile(f);
  }

  async function run() {
    setBusy(true);
    setError('');
    setDone('');
    try {
      const body: ExtractRequest = { text };
      if (file) {
        const mimeType = file.type || (file.name.endsWith('.md') ? 'text/markdown' : 'text/plain');
        body.file = { name: file.name, mimeType, data: await readBase64(file) };
      }
      const { experiences } = await post<{ experiences: Omit<Experience, 'id'>[] }>('/experiences/extract', body);
      if (!experiences.length) {
        setError('경험으로 정리할 만한 내용을 찾지 못했어요. 겪은 일을 조금 더 구체적으로 적어 주세요.');
        return;
      }
      update((w) => ({ ...w, experiences: [...experiences.map((x) => ({ ...x, id: uid() })), ...w.experiences] }));
      setDone(`경험 ${experiences.length}개를 정리했어요. 아래에서 확인하고 고쳐 보세요.`);
      setText('');
      setFile(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5">
      <label className="label" htmlFor="raw">이력서·활동 기록·메모</label>
      <textarea
        id="raw"
        className="field min-h-36 resize-y leading-relaxed"
        placeholder={'예) 2024년 봄, 교내 동아리 운영진으로 신입 부원 행사를 맡았다. 참여율이 30%대라서 설문을 돌려 원인을 찾았고…\n\n생각나는 대로 적어도 괜찮아요. 여러 경험을 한꺼번에 적으면 나눠서 정리해요.'}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        {file ? (
          <span className="chip gap-1.5 py-1.5">
            <FileUp size={13} /> {file.name}
            <button aria-label="파일 빼기" onClick={() => setFile(null)}>
              <X size={13} />
            </button>
          </span>
        ) : (
          <button className="btn-ghost" onClick={() => input.current?.click()}>
            <FileUp size={16} /> 파일 올리기 <span className="font-normal text-muted">PDF·텍스트·이미지</span>
          </button>
        )}
        <button className="btn-primary ml-auto" disabled={busy || (!text.trim() && !file)} onClick={run}>
          {busy ? <Spinner /> : <Sparkles size={16} />} {busy ? '정리하는 중…' : 'AI로 정리하기'}
        </button>
      </div>
      <div className="mt-3 space-y-2">
        <ErrorNote>{error}</ErrorNote>
        {done && <InfoNote>{done}</InfoNote>}
      </div>
    </section>
  );
}

function ExperienceCard({ experience: x, onEdit }: { experience: Experience; onEdit: () => void }) {
  const { update } = useWorkspace();
  return (
    <article className="card p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold">{x.title || '(제목 없음)'}</h3>
          {x.period && <p className="mt-0.5 text-sm text-muted">{x.period}</p>}
        </div>
        <button className="rounded-lg p-2 text-muted hover:bg-pine-soft hover:text-ink" aria-label="고치기" onClick={onEdit}>
          <Pencil size={16} />
        </button>
        <button
          className="rounded-lg p-2 text-muted hover:bg-danger-soft hover:text-danger"
          aria-label="지우기"
          onClick={() => {
            if (confirm(`‘${x.title || '이 경험'}’을(를) 지울까요?`)) update((w) => ({ ...w, experiences: w.experiences.filter((e) => e.id !== x.id) }));
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
      <dl className="mt-3 grid gap-2 text-[15px] sm:grid-cols-2">
        {STAR.filter((s) => x[s.key]).map((s) => (
          <div key={s.key} className="rounded-xl bg-paper px-3.5 py-2.5">
            <dt className="text-xs font-bold text-pine">{s.label}</dt>
            <dd className="mt-0.5 leading-relaxed">{x[s.key]}</dd>
          </div>
        ))}
      </dl>
      {x.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {x.skills.map((s) => (
            <span key={s} className="chip">#{s}</span>
          ))}
        </div>
      )}
    </article>
  );
}

function ExperienceForm({ experience, onDone }: { experience: Experience; onDone: () => void }) {
  const { update } = useWorkspace();
  const [x, setX] = useState(experience);
  const [skills, setSkills] = useState(experience.skills.join(', '));

  function save() {
    const next = { ...x, skills: skills.split(',').map((s) => s.trim()).filter(Boolean) };
    update((w) => ({ ...w, experiences: w.experiences.map((e) => (e.id === x.id ? next : e)) }));
    onDone();
  }

  return (
    <article className="card border-pine p-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <div>
          <label className="label">제목</label>
          <input className="field" value={x.title} placeholder="예) 동아리 행사 참여율 개선" onChange={(e) => setX({ ...x, title: e.target.value })} />
        </div>
        <div>
          <label className="label">기간</label>
          <input className="field" value={x.period} placeholder="예) 2024.03 – 2024.08" onChange={(e) => setX({ ...x, period: e.target.value })} />
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {STAR.map((s) => (
          <div key={s.key}>
            <label className="label">{s.label}</label>
            <textarea className="field min-h-24 resize-y" placeholder={s.hint} value={x[s.key]} onChange={(e) => setX({ ...x, [s.key]: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="mt-3">
        <label className="label">역량 키워드 <span className="font-normal text-muted">쉼표로 구분</span></label>
        <input className="field" value={skills} placeholder="예) 데이터 분석, 문제 정의, 협업" onChange={(e) => setSkills(e.target.value)} />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          className="btn-ghost"
          onClick={() => {
            // '직접 추가'로 만든 빈 카드는 취소하면 없앰
            const blank = !experience.title && STAR.every((s) => !experience[s.key]);
            if (blank) update((w) => ({ ...w, experiences: w.experiences.filter((e) => e.id !== experience.id) }));
            onDone();
          }}
        >
          취소
        </button>
        <button className="btn-primary" onClick={save}>저장</button>
      </div>
    </article>
  );
}
