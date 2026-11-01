import { config } from './config.ts';
import { one, nowIso, addDays, kstDayStartIso } from './db.ts';

export interface Sub {
  plan: 'lifetime';
  status: 'active' | 'canceled' | 'expired';
  rebill_no: string | null;
  amount: number;
  current_period_end: string;
  cancel_at_period_end: number;
}

export function getSub(userId: string): Sub | undefined {
  return one<Sub>('SELECT * FROM subscriptions WHERE user_id = ?', userId);
}

export function isPro(userId: string | undefined | null): boolean {
  if (!userId) return false;
  const s = getSub(userId);
  return !!s && s.status === 'active' && s.current_period_end > nowIso();
}

/** 무료 플랜의 주간 기준: 가입 시각부터 7일 단위로 돈다. */
export function weekWindow(createdAt: string, now = new Date()) {
  const anchor = new Date(createdAt).getTime();
  const weeks = Math.max(0, Math.floor((now.getTime() - anchor) / (7 * 86400_000)));
  const start = new Date(anchor + weeks * 7 * 86400_000);
  return { start: start.toISOString(), end: new Date(start.getTime() + 7 * 86400_000).toISOString() };
}

const FILE_KINDS = "('pdf','docx','pptx','image')";

export function usage(userId: string, createdAt: string) {
  const w = weekWindow(createdAt);
  const c = (sql: string, ...p: any[]) => one<{ c: number }>(sql, ...p)!.c;
  return {
    weekStart: w.start,
    renewAt: w.end,
    files: c(`SELECT COUNT(*) AS c FROM documents WHERE user_id = ? AND kind IN ${FILE_KINDS} AND status != 'error' AND created_at >= ?`, userId, w.start),
    youtube: c(`SELECT COUNT(*) AS c FROM documents WHERE user_id = ? AND kind = 'youtube' AND status != 'error' AND created_at >= ?`, userId, w.start),
    exams: c(`SELECT COUNT(*) AS c FROM exams WHERE user_id = ? AND status != 'error' AND created_at >= ?`, userId, w.start),
    tutorToday: c(
      `SELECT COUNT(*) AS c FROM chat_messages m JOIN chats ch ON ch.id = m.chat_id WHERE ch.user_id = ? AND m.role = 'user' AND m.created_at >= ?`,
      userId,
      kstDayStartIso(),
    ),
  };
}

export class LimitError extends Error {
  constructor(message: string, public reason: string) {
    super(message);
  }
}

export function assertCanUpload(userId: string, createdAt: string, kind: string) {
  if (isPro(userId)) {
    // 평생 이용권 공정 사용 상한 (PRO_MONTHLY_UPLOADS, 0이면 제한 없음)
    const cap = config.pro.monthlyUploads;
    if (cap > 0) {
      const used = one<{ c: number }>(
        "SELECT COUNT(*) AS c FROM documents WHERE user_id = ? AND status != 'error' AND created_at >= ?",
        userId,
        addDays(nowIso(), -30),
      )!.c;
      if (used >= cap) throw new LimitError(`한 달에 자료 ${cap}개까지 올릴 수 있어요. 공정 사용 기준이에요.`, 'fair_use');
    }
    return;
  }
  const u = usage(userId, createdAt);
  if (['pdf', 'docx', 'pptx', 'image'].includes(kind) && u.files >= config.free.weeklyFiles) {
    throw new LimitError(`이번 주 무료 업로드(${config.free.weeklyFiles}회)를 모두 사용했어요.`, 'files');
  }
  if (kind === 'youtube' && u.youtube >= config.free.weeklyYoutube) {
    throw new LimitError(`이번 주 유튜브 무료 분석(${config.free.weeklyYoutube}회)을 모두 사용했어요.`, 'youtube');
  }
}

export function assertCanTutor(userId: string, createdAt: string) {
  if (isPro(userId)) return;
  if (usage(userId, createdAt).tutorToday >= config.free.dailyTutor) {
    throw new LimitError(`오늘 무료 질문(${config.free.dailyTutor}회)을 모두 사용했어요.`, 'tutor');
  }
}

export function assertCanExam(userId: string, createdAt: string) {
  if (isPro(userId)) return;
  if (usage(userId, createdAt).exams >= config.free.weeklyExams) {
    throw new LimitError(`무료 플랜은 시험지를 매주 ${config.free.weeklyExams}개 만들 수 있어요.`, 'exam');
  }
}

export function maxUploadBytes(userId: string) {
  return (isPro(userId) ? config.pro.maxFileMb : config.free.maxFileMb) * 1024 * 1024;
}
