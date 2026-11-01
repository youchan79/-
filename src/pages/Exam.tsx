import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, ClipboardList, Clock, Copy, FileStack, FileUp, FolderOpen, Plus, ScrollText, Sparkles, X } from 'lucide-react';
import { api, formatDate, KIND_LABEL, type DocSummary } from '../lib/api.ts';
import { useApp, useRequireLogin } from '../lib/app.tsx';
import { usePoll, useProgress } from '../lib/hooks.ts';
import { navigate } from '../lib/router.tsx';
import { DOC_ACCEPT, IMAGE_ACCEPT, uploadFiles } from '../lib/upload.ts';
import { UploadProgress } from './AddContent.tsx';
import { AppShell } from '../components/AppShell.tsx';
import { useApiErrorHandler } from '../components/Modals.tsx';
import { Button, Loading, Modal, NewBadge, Segmented, Spinner } from '../components/ui.tsx';

const ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ'];

type QType = 'choice' | 'ox' | 'blank' | 'short';
const TYPE_LABEL: Record<QType, string> = { choice: '객관식', ox: 'OX', blank: '빈칸 채우기', short: '주관식' };
type Answer = number | string | null;

/** 서버(exam.ts isCorrect)와 같은 주관식 채점: 띄어쓰기·문장부호·대소문자 무시, / 로 나눈 정답 중 하나면 정답 */
const norm = (s: string) => s.toLowerCase().replace(/[\s.,!?'"()[\]{}·~-]/g, '');
function isRight(q: ExamQ, a: Answer) {
  if (q.type === 'short') return typeof a === 'string' && !!norm(a) && q.answerText.split('/').map(norm).filter(Boolean).includes(norm(a));
  return a === q.answer;
}
const optionMark = (q: ExamQ, j: number) => (q.type === 'ox' ? q.options[j] : 'ABCD'[j]);
const answered = (a: Answer) => a !== null && a !== '';

function PaperIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-2xl border border-line bg-canvas" />
      <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-2xl border border-line bg-canvas" />
      <div className="relative rounded-2xl border border-line bg-canvas p-6">
        <div className="flex items-center justify-between border-b border-line pb-3 text-[12px] text-sub">
          모의고사 <span className="rounded-full bg-soft px-2 py-0.5 tabular-nums">40:00</span>
        </div>
        <div className="mt-4 text-[12px] text-muted">Ⅰ. 3주차_강의자료.pdf</div>
        {[1, 2].map((n) => (
          <div key={n} className="mt-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              {n}.
              <span className="h-2 flex-1 rounded bg-soft-2" />
            </div>
            <div className="ml-4 mt-1.5 h-2 w-3/4 rounded bg-soft-2" />
            {'ABCD'.split('').map((l, i) => (
              <div key={l} className="ml-1 mt-2.5 flex items-center gap-2">
                <span className={`flex h-4 w-4 items-center justify-center rounded-full border text-[8px] ${n === 1 && i === 2 ? 'border-solid bg-solid text-on-solid' : 'border-line text-muted'}`}>{l}</span>
                <span className="h-1.5 rounded bg-soft-2" style={{ width: `${40 + ((i * 17 + n * 9) % 40)}%` }} />
              </div>
            ))}
          </div>
        ))}
        <div className="mt-6 grid grid-cols-10 gap-1">
          {Array.from({ length: 20 }, (_, i) => (
            <span key={i} className={`h-2.5 rounded-sm ${i < 7 ? 'bg-solid' : 'bg-soft-2'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** 새 시험지 만들기 화면(원조처럼 모달이 아니라 한 화면): 시험 범위 담기 → 출제 설정 → 아래 막대의 만들기 버튼 */
function Builder({ onClose, mode }: { onClose: () => void; mode: 'mock' | 'variant' }) {
  const onError = useApiErrorHandler();
  const [docs, setDocs] = useState<DocSummary[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [count, setCount] = useState('20');
  const [minutes, setMinutes] = useState('40');
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState('보통');
  const [types, setTypes] = useState<QType[]>(['choice', 'ox', 'blank']);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const max = mode === 'variant' ? 1 : 10;

  const loadDocs = () => api<{ docs: DocSummary[] }>('/api/docs').then((r) => setDocs(r.docs.filter((d) => !d.isSample)));
  useEffect(() => {
    void loadDocs();
  }, []);
  const pickedDocs = picked.map((id) => docs?.find((d) => d.id === id)).filter((d): d is DocSummary => !!d);
  const waiting = pickedDocs.some((d) => d.status === 'processing');
  // 방금 올린 파일은 AI가 다 읽을 때까지 기다린다
  usePoll(() => void loadDocs(), waiting, 2500);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : max === 1 ? [id] : p.length >= max ? p : [...p, id]));
  const ready = picked.length > 0 && !waiting && pickedDocs.every((d) => d.status === 'ready');

  const create = async () => {
    setBusy(true);
    try {
      const r = await api<{ id: string }>('/api/exams', { docIds: picked, count: Number(count), durationMin: Number(minutes), mode, name: name.trim(), difficulty, types });
      navigate(`/exam/${r.id}`);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto w-full max-w-[720px] flex-1 px-4 pb-8 md:px-6">
        <div className="relative flex h-14 items-center justify-center">
          <button
            type="button"
            onClick={onClose}
            className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full border border-line text-sub hover:bg-soft hover:text-ink"
            aria-label="뒤로"
          >
            <ChevronLeft size={19} />
          </button>
          <span className="text-[16px] font-medium">{mode === 'variant' ? '족보 변형' : '새 시험지'}</span>
        </div>
        <h1 className="mt-4 text-[24px] font-medium tracking-[-0.02em] md:text-[28px]">
          {mode === 'variant' ? '어떤 기출 시험지를 바꿔 볼까요?' : '어느 범위에서 문제를 낼까요?'}
        </h1>
        <p className="mt-1.5 text-[15px] leading-[1.6] text-sub">
          {mode === 'variant' ? '예전 시험지(족보) 하나를 담으면 같은 개념을 묻는 새 문제로 바꿔 드려요.' : '시험에 나올 자료를 담고, 문항 수와 제한 시간을 정해 주세요.'}
        </p>

        <div className="mb-2 mt-7 px-1 text-[14px] text-muted">시험 범위</div>
        <div className="rounded-2xl bg-soft p-4 md:p-5">
          {pickedDocs.length > 0 && (
            <div className="mb-4 space-y-2">
              {pickedDocs.map((d, i) => (
                <div key={d.id} className="flex items-center gap-3 rounded-xl bg-canvas px-4 py-3">
                  <span className="w-5 shrink-0 text-[14px] text-muted">{ROMAN[i]}</span>
                  <span className="min-w-0 flex-1 truncate text-[15px]">{d.title}</span>
                  {d.status === 'processing' ? (
                    <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-muted">
                      <Spinner className="h-3.5 w-3.5" /> 읽는 중
                    </span>
                  ) : (
                    <span className="shrink-0 text-[13px] text-muted">{KIND_LABEL[d.kind]}</span>
                  )}
                  <button type="button" onClick={() => toggle(d.id)} className="shrink-0 text-muted hover:text-ink" aria-label="빼기">
                    <X size={17} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className={`flex flex-col items-center text-center ${pickedDocs.length ? '' : 'py-6'}`}>
            {pickedDocs.length === 0 && (
              <>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-solid text-on-solid">
                  <Plus size={20} />
                </span>
                <div className="mt-3 text-[16px] font-medium">자료 담기</div>
                <p className="mt-1 text-[14px] text-sub">{mode === 'variant' ? '기출 시험지 파일 하나를 담아 주세요' : `내 문서에서 고르거나 새로 올려 ${max}개까지 담아요`}</p>
              </>
            )}
            {picked.length < max && (
              <div className={`flex flex-wrap justify-center gap-2 ${pickedDocs.length ? '' : 'mt-4'}`}>
                <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
                  <FolderOpen size={16} /> 문서에서 고르기
                </Button>
                <Button size="sm" onClick={() => fileInput.current?.click()}>
                  <FileUp size={16} /> 파일 올리기
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="mb-2 mt-7 px-1 text-[14px] text-muted">출제 설정</div>
        <div className="rounded-2xl bg-soft px-4 md:px-5">
          <div className="border-b border-line py-4">
            <label htmlFor="exam-name" className="text-[15px] font-medium">
              시험지 이름
            </label>
            <input
              id="exam-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="비워 두면 자료 이름으로 지어요"
              className="mt-2.5 h-11 w-full rounded-full bg-canvas px-4 text-[15px] outline-none placeholder:text-muted focus:ring-1 focus:ring-line"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-4">
            <span className="text-[15px] font-medium">난이도</span>
            <Segmented className="bg-canvas" value={difficulty} onChange={setDifficulty} options={[['쉬움', '쉬움'], ['보통', '보통'], ['어려움', '어려움']]} />
          </div>
          <div className="border-b border-line py-4">
            <div className="text-[15px] font-medium">문제 유형</div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {(Object.keys(TYPE_LABEL) as QType[]).map((t) => {
                const on = types.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setTypes((v) => (on ? (v.length > 1 ? v.filter((x) => x !== t) : v) : [...v, t]))}
                    className={`h-10 rounded-full px-4 text-[15px] transition ${on ? 'bg-solid font-medium text-on-solid' : 'bg-canvas text-sub hover:text-ink'}`}
                  >
                    {TYPE_LABEL[t]}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[13px] text-muted">하나 이상 골라 주세요. 여러 개면 골고루 섞어 내요.</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-4">
            <span className="text-[15px] font-medium">문항 수</span>
            <Segmented className="bg-canvas" value={count} onChange={setCount} options={[['10', '10문제'], ['20', '20문제'], ['30', '30문제']]} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 py-4">
            <span className="text-[15px] font-medium">제한 시간</span>
            <Segmented className="bg-canvas" value={minutes} onChange={setMinutes} options={[['20', '20분'], ['40', '40분'], ['60', '60분']]} />
          </div>
        </div>
        <p className="mt-3 px-1 text-[14px] leading-[1.6] text-muted">퀴즈 탭에서 푼 문제와 겹치지 않게 새로 내요. 만드는 데 보통 1~3분, 자료가 많으면 조금 더 걸려요.</p>
      </div>

      <div className="sticky bottom-0 border-t border-line bg-canvas">
        <div className="mx-auto flex w-full max-w-[720px] items-center gap-3 px-4 py-3 md:px-6">
          <span className="min-w-0 flex-1 text-[14px] text-sub">
            {waiting ? 'AI가 올린 자료를 읽고 있어요' : picked.length ? `자료 ${picked.length}개 담음` : '시험 범위 자료를 먼저 담아 주세요'}
          </span>
          <Button disabled={!ready || busy} onClick={() => void create()}>
            {busy ? <Spinner className="h-4 w-4" /> : '시험지 만들기'}
          </Button>
        </div>
      </div>

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} width={520}>
        <h2 className="text-[20px] font-semibold">문서에서 고르기</h2>
        <p className="mt-1 text-[14px] text-muted">{mode === 'variant' ? '기출 시험지 하나를 골라 주세요.' : `${max}개까지 고를 수 있어요.`}</p>
        <div className="mt-4 max-h-[360px] space-y-1.5 overflow-y-auto">
          {docs === null ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : docs.filter((d) => d.status === 'ready').length === 0 ? (
            <p className="rounded-2xl bg-soft p-5 text-center text-[14px] text-sub">아직 다 정리된 문서가 없어요. 파일 올리기로 바로 넣어 보세요.</p>
          ) : (
            docs
              .filter((d) => d.status === 'ready')
              .map((d) => {
                const on = picked.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggle(d.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left ${on ? 'border-ink' : 'border-line hover:bg-soft'}`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${on ? 'border-solid bg-solid text-on-solid' : 'border-line'}`}>
                      {on && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[15px]">{d.title}</span>
                    <span className="shrink-0 text-[13px] text-muted">{KIND_LABEL[d.kind]}</span>
                  </button>
                );
              })
          )}
        </div>
        <Button size="lg" className="mt-5 w-full" onClick={() => setPickerOpen(false)}>
          {picked.length ? `${picked.length}개 담기` : '닫기'}
        </Button>
      </Modal>

      <input
        ref={fileInput}
        type="file"
        accept={`${DOC_ACCEPT},${IMAGE_ACCEPT}`}
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setUploading(0);
          try {
            const id = await uploadFiles([f], undefined, setUploading);
            await loadDocs();
            setPicked((p) => (max === 1 ? [id] : p.length >= max ? p : [...p, id]));
          } catch (err) {
            onError(err);
          } finally {
            setUploading(null);
          }
        }}
      />
      <UploadProgress progress={uploading} />
    </div>
  );
}

export function ExamHome() {
  const { me } = useApp();
  const requireLogin = useRequireLogin();
  const [builder, setBuilder] = useState<'mock' | 'variant' | null>(null);
  const [exams, setExams] = useState<any[]>([]);
  useEffect(() => {
    if (me?.user) api<{ exams: any[] }>('/api/exams').then((r) => setExams(r.exams));
  }, [me?.user]);

  const features = [
    { icon: Copy, title: '자료 여러 개를 한 번에', sub: '강의자료·녹음·메모·영상을 10개까지 묶어 시험 범위 전체를 훑어요.' },
    { icon: Sparkles, title: '풀어 본 문제는 빼고', sub: '퀴즈 탭에서 이미 푼 문제와 다른, 새 문제로만 내요.' },
    { icon: Clock, title: '시간 맞춰 풀고 곧바로 채점', sub: '답안지에서 안 푼 문제를 확인하고, 틀린 것만 골라 다시 풀어요.' },
  ];

  if (builder) {
    return (
      <AppShell bare mobileMenu={false}>
        <Builder mode={builder} onClose={() => setBuilder(null)} />
      </AppShell>
    );
  }

  return (
    <AppShell title="">
      <div className="mx-auto grid w-full max-w-[1000px] items-center gap-12 px-5 py-10 md:grid-cols-[1fr_340px] md:py-[120px]">
        <div>
          <NewBadge />
          <h1 className="mt-4 text-[30px] font-medium leading-[1.3] tracking-[-0.03em]">
            시험 범위 자료로
            <br />
            진짜 같은 모의고사를
          </h1>
          <p className="mt-3 text-[15px] leading-[1.65] text-sub">
            시험에 나올 자료를 고르면 제한 시간 안에 푸는 시험지가 만들어져요.
            <br />
            채점이 끝나면 어느 자료에서 많이 틀렸는지 짚어 드려요.
          </p>
          <div className="mt-8 space-y-5">
            {features.map((f) => (
              <div key={f.title} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-soft">
                  <f.icon size={16} />
                </span>
                <div>
                  <div className="text-[15px] font-medium">{f.title}</div>
                  <div className="mt-0.5 text-[14px] text-sub">{f.sub}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-9 flex flex-wrap gap-2">
            <Button onClick={() => requireLogin(() => setBuilder('mock'))}>{me?.user ? '시험지 만들기' : '로그인하고 만들기'}</Button>
            <Button variant="outline" onClick={() => requireLogin(() => setBuilder('variant'))}>
              <ScrollText size={16} /> 족보 변형 문제
            </Button>
          </div>
        </div>
        <div className="hidden md:block">
          <PaperIllustration />
        </div>
      </div>

      {exams.length > 0 && (
        <div className="mx-auto w-full max-w-[1000px] px-5 pb-16">
          <h2 className="mb-3 text-[18px] font-semibold">내 시험지</h2>
          <div className="space-y-2">
            {exams.map((e) => (
              <button key={e.id} type="button" onClick={() => navigate(`/exam/${e.id}`)} className="flex w-full items-center gap-4 rounded-2xl border border-line px-5 py-4 text-left hover:bg-soft">
                <FileStack size={18} className="shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium">{e.title}</div>
                  <div className="mt-0.5 text-[13px] text-muted">
                    {formatDate(e.created_at)} · {e.question_count}문제 · {e.duration_min}분
                    {e.status === 'generating' ? ' · 만드는 중' : e.result ? ` · ${e.result.score}점` : ''}
                  </div>
                </div>
                <ChevronRight size={18} className="text-muted" />
              </button>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}

/* ---------- 시험 보기 ---------- */

interface ExamQ {
  source: number;
  type?: QType;
  question: string;
  options: string[];
  answer: number;
  answerText: string;
  explanation: string;
  ref: string;
}

interface ExamData {
  id: string;
  title: string;
  status: string;
  error: string | null;
  durationMin: number;
  questionCount: number;
  startedAt: string | null;
  exam: { questions: ExamQ[]; sources: string[] } | null;
  settings: { difficulty: string; types: QType[] } | null;
  answers: Answer[] | null;
  result: { correct: number; total: number; score: number; bySource: Array<{ title: string; correct: number; total: number }>; wrong: number[] } | null;
}

function useCountdown(startedAt: string | null, minutes: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  if (!startedAt) return minutes * 60;
  return Math.max(0, Math.round((new Date(startedAt).getTime() + minutes * 60_000 - now) / 1000));
}

function ExamPaper({ data, onSubmit }: { data: ExamData; onSubmit: (answers: Answer[]) => void }) {
  const qs = data.exam!.questions;
  const [answers, setAnswers] = useProgress<Answer[]>(`exam:${data.id}`, Array(qs.length).fill(null));
  const [sheet, setSheet] = useState(false);
  const left = useCountdown(data.startedAt, data.durationMin);
  const done = answers.filter(answered).length;
  const setAnswer = (i: number, v: Answer) =>
    setAnswers((a) => {
      const n = [...a];
      n[i] = v;
      return n;
    });

  useEffect(() => {
    if (left === 0 && data.startedAt) onSubmit(answers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left === 0]);

  const groups = useMemo(() => {
    const out: Array<{ source: number; items: number[] }> = [];
    qs.forEach((q, i) => {
      const last = out[out.length - 1];
      if (last && last.source === q.source) last.items.push(i);
      else out.push({ source: q.source, items: [i] });
    });
    return out;
  }, [qs]);

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[56px] shrink-0 items-center gap-3 border-b border-line px-4 pl-14 md:pl-6">
        <div className="min-w-0 flex-1 truncate text-[15px] font-medium">{data.title}</div>
        <span className={`rounded-full px-3 py-1 text-[14px] tabular-nums ${left < 300 ? 'bg-red/10 text-red' : 'bg-soft'}`}>
          {mm}:{ss}
        </span>
        <Button size="sm" variant="outline" onClick={() => setSheet(true)}>
          답안지 {done}/{qs.length}
        </Button>
        <Button size="sm" onClick={() => window.confirm(done < qs.length ? `${qs.length - done}문제를 안 풀었어요. 제출할까요?` : '제출할까요?') && onSubmit(answers)}>
          제출
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[760px] px-5 pb-24 pt-6">
          {groups.map((g) => (
            <div key={`${g.source}-${g.items[0]}`} className="mb-6">
              <div className="mb-4 text-[14px] text-muted">
                {ROMAN[(g.source - 1) % 10]}. {data.exam!.sources[g.source - 1]}
              </div>
              {g.items.map((i) => (
                <div key={i} id={`q${i}`} className="mb-9 scroll-mt-4">
                  <div className="flex gap-2 text-[17px] font-medium leading-[1.6]">
                    <span>{i + 1}.</span>
                    <span>{qs[i].question}</span>
                  </div>
                  {qs[i].type === 'short' ? (
                    <div className="mt-3 pl-6">
                      <input
                        value={typeof answers[i] === 'string' ? (answers[i] as string) : ''}
                        onChange={(e) => setAnswer(i, e.target.value || null)}
                        maxLength={200}
                        placeholder="답을 적어 주세요"
                        className="h-12 w-full rounded-xl border border-line bg-canvas px-4 text-[15px] outline-none focus:border-ink"
                      />
                    </div>
                  ) : qs[i].type === 'ox' ? (
                    <div className="mt-3 flex gap-3 pl-6">
                      {qs[i].options.map((o, j) => (
                        <button
                          key={j}
                          type="button"
                          aria-pressed={answers[i] === j}
                          onClick={() => setAnswer(i, answers[i] === j ? null : j)}
                          className={`h-12 w-20 rounded-xl border text-[18px] font-semibold ${answers[i] === j ? 'border-solid bg-solid text-on-solid' : 'border-line text-sub hover:bg-soft'}`}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2 pl-6">
                      {qs[i].options.map((o, j) => (
                        <button
                          key={j}
                          type="button"
                          onClick={() => setAnswer(i, answers[i] === j ? null : j)}
                          className="flex w-full items-start gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-soft"
                        >
                          <span
                            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[12px] ${answers[i] === j ? 'border-solid bg-solid text-on-solid' : 'border-line text-muted'}`}
                          >
                            {'ABCD'[j]}
                          </span>
                          <span className="text-[15px] leading-[1.6]">{o}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <Modal open={sheet} onClose={() => setSheet(false)}>
        <h2 className="text-[20px] font-semibold">답안지</h2>
        <p className="mt-1 text-[14px] text-muted">번호를 누르면 그 문제로 가요.</p>
        <div className="mt-5 grid grid-cols-5 gap-2">
          {qs.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setSheet(false);
                document.getElementById(`q${i}`)?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`h-11 rounded-xl text-[14px] tabular-nums ${answered(answers[i]) ? 'bg-solid text-on-solid' : 'bg-soft text-sub'}`}
            >
              {i + 1}
              {answered(answers[i]) && <span className="ml-1 text-[13px] opacity-70">{typeof answers[i] === 'number' ? optionMark(qs[i], answers[i] as number) : '✓'}</span>}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function Result({ data }: { data: ExamData }) {
  const r = data.result!;
  const qs = data.exam!.questions;
  const [retry, setRetry] = useState(false);
  const [picks, setPicks] = useState<Record<number, Answer>>({});
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  return (
    <AppShell title={data.title}>
      <div className="mx-auto max-w-[760px] px-5 pb-20 pt-6">
        <div className="rounded-[24px] border border-line p-7 text-center">
          <div className="text-[14px] text-muted">점수</div>
          <div className="mt-1 text-[52px] font-semibold tracking-tight">{r.score}</div>
          <div className="text-[15px] text-sub">
            {r.total}문제 중 {r.correct}문제 정답
          </div>
          <div className="mt-6 space-y-3 text-left">
            {r.bySource.map((s) => {
              const pct = Math.round((s.correct / Math.max(1, s.total)) * 100);
              return (
                <div key={s.title}>
                  <div className="flex justify-between text-[14px]">
                    <span className="truncate pr-4">{s.title}</span>
                    <span className={`shrink-0 tabular-nums ${pct < 60 ? 'text-red' : 'text-sub'}`}>
                      {s.correct}/{s.total}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-soft-2">
                    <div className={`h-full rounded-full ${pct < 60 ? 'bg-red' : 'bg-solid'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          {r.bySource.some((s) => s.correct / s.total < 0.6) && (
            <p className="mt-5 text-left text-[14px] text-sub">빨간 자료가 약한 부분이에요. 그 자료의 개념 탭과 퀴즈로 다시 보세요.</p>
          )}
          {r.wrong.length > 0 && (
            <Button className="mt-6" onClick={() => setRetry((v) => !v)}>
              {retry ? '해설 보기' : `틀린 문제만 다시 풀기 (${r.wrong.length})`}
            </Button>
          )}
        </div>

        <h2 className="mb-4 mt-10 text-[18px] font-semibold">{retry ? '틀린 문제 다시 풀기' : '틀린 문제 해설'}</h2>
        {r.wrong.length === 0 && <p className="text-[15px] text-muted">모두 맞혔어요.</p>}
        {r.wrong.map((i) => {
          const q = qs[i];
          const pick = picks[i];
          return (
            <div key={i} className="mb-6 rounded-2xl border border-line p-5">
              <div className="flex gap-2 text-[16px] font-medium leading-[1.6]">
                <span>{i + 1}.</span>
                <span>{q.question}</span>
              </div>
              {q.type === 'short' ? (
                <div className="mt-3 space-y-2 pl-6 text-[15px]">
                  {retry && pick === undefined ? (
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (drafts[i]?.trim()) setPicks((p) => ({ ...p, [i]: drafts[i] }));
                      }}
                    >
                      <input
                        value={drafts[i] ?? ''}
                        onChange={(e) => setDrafts((d) => ({ ...d, [i]: e.target.value }))}
                        placeholder="답을 적어 주세요"
                        className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-canvas px-4 outline-none focus:border-ink"
                      />
                      <Button type="submit" size="sm" className="h-11">
                        확인
                      </Button>
                    </form>
                  ) : (
                    <>
                      <div className={retry && isRight(q, pick ?? null) ? 'text-green' : 'text-red'}>
                        내 답: {String((retry ? pick : data.answers?.[i]) ?? '') || '(안 씀)'}
                      </div>
                      <div className="text-green">정답: {q.answerText.split('/').join(' 또는 ')}</div>
                    </>
                  )}
                </div>
              ) : (
              <div className="mt-3 space-y-1.5 pl-6">
                {q.options.map((o, j) => {
                  const show = retry ? pick !== undefined : true;
                  const isAns = j === q.answer;
                  const mine = retry ? j === pick : j === data.answers?.[i];
                  return (
                    <button
                      key={j}
                      type="button"
                      disabled={!retry || pick !== undefined}
                      onClick={() => setPicks((p) => ({ ...p, [i]: j }))}
                      className="flex w-full items-start gap-3 rounded-lg px-1 py-1 text-left"
                    >
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[12px] ${
                          show && isAns ? 'border-green bg-green text-white' : show && mine ? 'border-red bg-red text-white' : 'border-line text-muted'
                        }`}
                      >
                        {show && isAns ? <Check size={13} /> : show && mine ? <X size={13} /> : optionMark(q, j)}
                      </span>
                      <span className="text-[15px] leading-[1.6]">{o}</span>
                    </button>
                  );
                })}
              </div>
              )}
              {(!retry || pick !== undefined) && <p className="mt-3 rounded-xl bg-soft p-4 text-[14px] leading-[1.65] text-sub">{q.explanation}</p>}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}

export function ExamRun({ id }: { id: string }) {
  const onError = useApiErrorHandler();
  const [data, setData] = useState<ExamData | null>(null);
  const [error, setError] = useState('');
  const load = async () => {
    try {
      setData(await api<ExamData>(`/api/exams/${id}`));
    } catch (e: any) {
      setError(e.message);
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  usePoll(() => void load(), data?.status === 'generating', 2000);

  if (error) return <AppShell title="시험">{<p className="py-20 text-center text-sub">{error}</p>}</AppShell>;
  if (!data || data.status === 'generating') {
    return (
      <AppShell title="시험 문제 만들기">
        <Loading label="AI가 시험지를 만들고 있어요. 1분 정도 걸려요." />
      </AppShell>
    );
  }
  if (data.status === 'error') {
    return (
      <AppShell title="시험 문제 만들기">
        <div className="py-20 text-center">
          <p className="text-sub">{data.error || '시험지를 만들지 못했어요.'}</p>
          <Button className="mt-5" onClick={() => navigate('/exam')}>
            돌아가기
          </Button>
        </div>
      </AppShell>
    );
  }
  if (data.status === 'submitted') return <Result data={data} />;
  if (!data.startedAt) {
    return (
      <AppShell title="시험 문제 만들기">
        <div className="mx-auto max-w-[520px] px-5 py-20 text-center">
          <ClipboardList size={28} className="mx-auto" />
          <h1 className="mt-4 text-[24px] font-semibold tracking-tight">{data.title}</h1>
          <p className="mt-2 text-[15px] text-sub">
            {data.questionCount}문제 · 제한 시간 {data.durationMin}분{data.settings ? ` · ${data.settings.difficulty}` : ''}
          </p>
          {data.settings && <p className="mt-1 text-[14px] text-muted">{data.settings.types.map((t) => TYPE_LABEL[t]).join(' · ')}</p>}
          <p className="mt-1 text-[14px] text-muted">시작하면 시간이 흐르고, 시간이 끝나면 자동으로 제출돼요.</p>
          <Button
            size="lg"
            className="mt-8"
            onClick={async () => {
              try {
                setData(await api<ExamData>(`/api/exams/${id}/start`, {}));
              } catch (e) {
                onError(e);
              }
            }}
          >
            시험 시작하기
          </Button>
        </div>
      </AppShell>
    );
  }
  return (
    <AppShell bare>
      <ExamPaper
        data={data}
        onSubmit={async (answers) => {
          try {
            setData(await api<ExamData>(`/api/exams/${id}/submit`, { answers }));
          } catch (e) {
            onError(e);
          }
        }}
      />
    </AppShell>
  );
}
