import { all, one, run, nowIso, newId } from './db.ts';
import { AiError, generateJson } from './ai.ts';
import { EXAM_TYPES, SYSTEM, clipSource, examPrompt, examRules, mockExam, schemas, type ExamDifficulty, type ExamType } from './prompts.ts';
import { DocError } from './docs.ts';

export type ExamMode = 'mock' | 'variant';

const VARIANT_PROMPT = (text: string, count: number, opts: { difficulty: ExamDifficulty; types: ExamType[] }) => `아래 자료는 기출 시험지(족보)다. 각 문제의 출제 의도와 개념은 유지하고, 숫자, 사례, 보기, 묻는 방향을 바꾼 변형 문제 ${count}문제를 만든다. 원래 문제를 그대로 베끼지 않는다. source는 모두 1.
${examRules(opts)}

[자료 1]
${clipSource(text)}`;

export function createExam(p: {
  userId: string;
  docIds: string[];
  count: number;
  durationMin: number;
  mode: ExamMode;
  name?: string;
  difficulty?: ExamDifficulty;
  types?: ExamType[];
}) {
  const settings = {
    difficulty: (['쉬움', '보통', '어려움'] as const).includes(p.difficulty as ExamDifficulty) ? (p.difficulty as ExamDifficulty) : '보통',
    types: EXAM_TYPES.filter((t) => p.types?.includes(t)),
  };
  if (!settings.types.length) settings.types = ['choice'];
  const ids = [...new Set(p.docIds)].slice(0, 10);
  if (!ids.length) throw new DocError('시험 범위 자료를 하나 이상 골라 주세요.');
  if (p.mode === 'variant' && ids.length !== 1) throw new DocError('족보 변형은 시험지 자료 하나만 골라 주세요.');
  const docs = ids.map((id) => one('SELECT id, title, status, source_text, user_id FROM documents WHERE id = ?', id));
  for (const d of docs) {
    if (!d || (d.user_id && d.user_id !== p.userId)) throw new DocError('자료를 찾을 수 없어요.');
    if (d.status !== 'ready') throw new DocError(`"${d.title}" 자료를 아직 정리하고 있어요.`);
  }
  const id = newId('ex');
  const auto = p.mode === 'variant' ? `족보 변형 · ${docs[0]!.title}` : docs.length === 1 ? `모의고사 · ${docs[0]!.title}` : `모의고사 · ${docs[0]!.title} 외 ${docs.length - 1}개`;
  const title = p.name?.trim() || auto;
  run(
    `INSERT INTO exams (id, user_id, title, doc_ids_json, question_count, duration_min, status, created_at, settings_json)
     VALUES (?, ?, ?, ?, ?, ?, 'generating', ?, ?)`,
    id,
    p.userId,
    title.slice(0, 120),
    JSON.stringify(ids),
    p.count,
    p.durationMin,
    nowIso(),
    JSON.stringify(settings),
  );
  const sources = docs.map((d) => ({ title: d!.title as string, text: d!.source_text as string }));
  const avoid = all<{ json: string }>(
    `SELECT json FROM sets WHERE kind = 'quiz' AND status = 'ready' AND doc_id IN (${ids.map(() => '?').join(',')})`,
    ...ids,
  ).flatMap((s) => JSON.parse(s.json).questions.map((q: any) => q.question as string));
  void (async () => {
    try {
      const json = await generateJson<any>({
        userId: p.userId,
        kind: 'exam',
        system: SYSTEM,
        source: null,
        task: p.mode === 'variant' ? VARIANT_PROMPT(sources[0].text, p.count, settings) : examPrompt(sources, p.count, avoid, settings),
        schema: schemas.exam,
        maxTokens: 20_000,
        mock: () => mockExam(sources, p.count, settings),
      });
      json.sources = sources.map((s) => s.title);
      run("UPDATE exams SET status = 'ready', json = ? WHERE id = ?", JSON.stringify(json), id);
    } catch (e) {
      console.error('[exam] 실패', id, e);
      run("UPDATE exams SET status = 'error', error = ? WHERE id = ?", e instanceof AiError ? e.message : '시험지를 만들지 못했어요.', id);
    }
  })();
  return id;
}

export function getExam(userId: string, id: string) {
  const e = one('SELECT * FROM exams WHERE id = ? AND user_id = ?', id, userId);
  if (!e) return null;
  return {
    id: e.id,
    title: e.title,
    status: e.status,
    error: e.error,
    durationMin: e.duration_min,
    questionCount: e.question_count,
    startedAt: e.started_at,
    submittedAt: e.submitted_at,
    exam: e.json ? JSON.parse(e.json) : null,
    settings: e.settings_json ? JSON.parse(e.settings_json) : null,
    answers: e.answers_json ? JSON.parse(e.answers_json) : null,
    result: e.result_json ? JSON.parse(e.result_json) : null,
    createdAt: e.created_at,
  };
}

export function startExam(userId: string, id: string) {
  run("UPDATE exams SET started_at = COALESCE(started_at, ?) WHERE id = ? AND user_id = ? AND status = 'ready'", nowIso(), id, userId);
}

/** 주관식 채점: 띄어쓰기·문장부호·대소문자를 빼고 정답(여러 표기는 / 로 구분) 중 하나와 같으면 정답 */
const norm = (s: string) => s.toLowerCase().replace(/[\s.,!?'"()\[\]{}·~-]/g, '');
export function isCorrect(q: any, a: unknown) {
  if (q.type === 'short') {
    if (typeof a !== 'string' || !norm(a)) return false;
    return String(q.answerText ?? '')
      .split('/')
      .map(norm)
      .filter(Boolean)
      .includes(norm(a));
  }
  return a === q.answer;
}

export function submitExam(userId: string, id: string, answers: Array<number | string | null>) {
  const e = one('SELECT * FROM exams WHERE id = ? AND user_id = ?', id, userId);
  if (!e || !e.json) throw new DocError('시험지를 찾을 수 없어요.');
  if (e.status === 'submitted') return getExam(userId, id);
  const exam = JSON.parse(e.json);
  const qs: any[] = exam.questions;
  const bySource: Record<number, { title: string; correct: number; total: number }> = {};
  const wrong: number[] = [];
  let correct = 0;
  qs.forEach((q, i) => {
    const s = (bySource[q.source] ??= { title: exam.sources?.[q.source - 1] ?? `자료 ${q.source}`, correct: 0, total: 0 });
    s.total++;
    if (isCorrect(q, answers[i])) {
      correct++;
      s.correct++;
    } else wrong.push(i);
  });
  const result = { correct, total: qs.length, score: Math.round((correct / Math.max(1, qs.length)) * 100), bySource: Object.values(bySource), wrong };
  run(
    "UPDATE exams SET status = 'submitted', answers_json = ?, result_json = ?, submitted_at = ? WHERE id = ?",
    JSON.stringify(answers.slice(0, qs.length)),
    JSON.stringify(result),
    nowIso(),
    id,
  );
  return getExam(userId, id);
}

export function listExams(userId: string) {
  return all(
    'SELECT id, title, status, question_count, duration_min, result_json, created_at FROM exams WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    userId,
  ).map((e) => ({ ...e, result: e.result_json ? JSON.parse(e.result_json) : null, result_json: undefined }));
}
