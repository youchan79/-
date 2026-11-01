import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, ClipboardList, Clock, Copy, FileStack, ScrollText, Sparkles, X } from 'lucide-react';
import { api, formatDate, KIND_LABEL, type DocSummary } from '../lib/api.ts';
import { useApp, useRequireLogin } from '../lib/app.tsx';
import { usePoll, useProgress } from '../lib/hooks.ts';
import { navigate } from '../lib/router.tsx';
import { AppShell } from '../components/AppShell.tsx';
import { useApiErrorHandler } from '../components/Modals.tsx';
import { Button, Loading, Modal, NewBadge, Segmented, Spinner } from '../components/ui.tsx';

const ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ'];

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

function Builder({ open, onClose, mode }: { open: boolean; onClose: () => void; mode: 'mock' | 'variant' }) {
  const onError = useApiErrorHandler();
  const [docs, setDocs] = useState<DocSummary[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [count, setCount] = useState('20');
  const [minutes, setMinutes] = useState('40');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPicked([]);
    api<{ docs: DocSummary[] }>('/api/docs').then((r) => setDocs(r.docs.filter((d) => !d.isSample && d.status === 'ready')));
  }, [open]);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : mode === 'variant' ? [id] : p.length >= 10 ? p : [...p, id]));

  return (
    <Modal open={open} onClose={onClose} width={520}>
      <h2 className="text-[20px] font-semibold">{mode === 'variant' ? '족보 변형 문제' : '시험 범위 고르기'}</h2>
      <p className="mt-1 text-[14px] text-muted">
        {mode === 'variant' ? '올려 둔 기출 시험지(족보)를 고르면 같은 개념의 새 문제로 바꿔 드려요.' : '강의자료·녹음·메모·영상을 최대 10개까지 고를 수 있어요.'}
      </p>
      <div className="mt-4 max-h-[300px] space-y-1.5 overflow-y-auto">
        {docs === null ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : docs.length === 0 ? (
          <div className="rounded-2xl bg-soft p-5 text-center text-[14px] text-sub">
            먼저 자료를 올려 주세요.
            <div>
              <Button size="sm" className="mt-3" onClick={() => navigate('/add-content')}>
                자료 올리기
              </Button>
            </div>
          </div>
        ) : (
          docs.map((d) => {
            const on = picked.includes(d.id);
            return (
              <button key={d.id} type="button" onClick={() => toggle(d.id)} className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left ${on ? 'border-ink' : 'border-line hover:bg-soft'}`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${on ? 'border-solid bg-solid text-on-solid' : 'border-line'}`}>{on && <Check size={13} strokeWidth={3} />}</span>
                <span className="min-w-0 flex-1 truncate text-[15px]">{d.title}</span>
                <span className="shrink-0 text-[12px] text-muted">{KIND_LABEL[d.kind]}</span>
              </button>
            );
          })
        )}
      </div>
      <div className="mt-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[15px]">문항 수</span>
          <Segmented value={count} onChange={setCount} options={[['10', '10문제'], ['20', '20문제'], ['30', '30문제']]} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[15px]">제한 시간</span>
          <Segmented value={minutes} onChange={setMinutes} options={[['20', '20분'], ['40', '40분'], ['60', '60분']]} />
        </div>
      </div>
      <Button
        size="lg"
        className="mt-6 w-full"
        disabled={!picked.length || busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await api<{ id: string }>('/api/exams', { docIds: picked, count: Number(count), durationMin: Number(minutes), mode });
            onClose();
            navigate(`/exam/${r.id}`);
          } catch (e) {
            onError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Spinner className="h-4 w-4" /> : `시험지 만들기${picked.length ? ` (${picked.length}개 자료)` : ''}`}
      </Button>
    </Modal>
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
      <Builder open={builder !== null} mode={builder ?? 'mock'} onClose={() => setBuilder(null)} />
    </AppShell>
  );
}

/* ---------- 시험 보기 ---------- */

interface ExamData {
  id: string;
  title: string;
  status: string;
  error: string | null;
  durationMin: number;
  questionCount: number;
  startedAt: string | null;
  exam: { questions: Array<{ source: number; question: string; options: string[]; answer: number; explanation: string; ref: string }>; sources: string[] } | null;
  answers: Array<number | null> | null;
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

function ExamPaper({ data, onSubmit }: { data: ExamData; onSubmit: (answers: Array<number | null>) => void }) {
  const qs = data.exam!.questions;
  const [answers, setAnswers] = useProgress<Array<number | null>>(`exam:${data.id}`, Array(qs.length).fill(null));
  const [sheet, setSheet] = useState(false);
  const left = useCountdown(data.startedAt, data.durationMin);
  const answered = answers.filter((a) => a !== null).length;

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
          답안지 {answered}/{qs.length}
        </Button>
        <Button size="sm" onClick={() => window.confirm(answered < qs.length ? `${qs.length - answered}문제를 안 풀었어요. 제출할까요?` : '제출할까요?') && onSubmit(answers)}>
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
                  <div className="mt-3 space-y-2 pl-6">
                    {qs[i].options.map((o, j) => (
                      <button
                        key={j}
                        type="button"
                        onClick={() =>
                          setAnswers((a) => {
                            const n = [...a];
                            n[i] = n[i] === j ? null : j;
                            return n;
                          })
                        }
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
              className={`h-11 rounded-xl text-[14px] tabular-nums ${answers[i] !== null ? 'bg-solid text-on-solid' : 'bg-soft text-sub'}`}
            >
              {i + 1}
              {answers[i] !== null && <span className="ml-1 text-[11px] opacity-70">{'ABCD'[answers[i]!]}</span>}
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
  const [picks, setPicks] = useState<Record<number, number>>({});
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
                        {show && isAns ? <Check size={13} /> : show && mine ? <X size={13} /> : 'ABCD'[j]}
                      </span>
                      <span className="text-[15px] leading-[1.6]">{o}</span>
                    </button>
                  );
                })}
              </div>
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
            {data.questionCount}문제 · 제한 시간 {data.durationMin}분
          </p>
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
