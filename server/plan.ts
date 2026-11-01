import { config } from './config.ts';
import { one, nowIso, addDays, kstDayStartIso } from './db.ts';

export interface Sub {
  plan: 'monthly' | 'yearly' | 'lifetime'; // lifetime: 예전에 판매한 상품 (기간 제한 없음)
  status: 'active' | 'canceled' | 'expired'; // canceled = 해지 예약 (기간 끝까지 Pro)
  rebill_no: string | null;
  amount: number;
  current_period_end: string; // 월간 자동 결제 중이면 다음 결제일
  cancel_at_period_end: number;
  billing_day: number | null;
}

/** 월간 자동 결제 통보가 하루 이틀 늦게 와도 Pro가 끊기지 않게 둔 여유 */
export const GRACE_DAYS = 2;

export function getSub(userId: string): Sub | undefined {
  return one<Sub>('SELECT * FROM subscriptions WHERE user_id = ?', userId);
}

/** Pro가 실제로 끝나는 시각 (자동 결제 중인 월간은 여유 기간 포함) */
export function proUntil(s: Sub): string | null {
  if (s.status === 'expired') return null;
  const autoRenew = s.status === 'active' && s.plan === 'monthly';
  return autoRenew ? addDays(s.current_period_end, GRACE_DAYS) : s.current_period_end;
}

export function isPro(userId: string | undefined | null): boolean {
  if (!userId) return false;
  const s = getSub(userId);
  const until = s && proUntil(s);
  return !!until && until > nowIso();
}

/** 무료 플랜의 주간 기준: 매주 월요일 0시(한국 시간)에 새로 채워지고, 남은 횟수는 넘어가지 않는다. */
export function weekWindow(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  const sinceMonday = (kst.getUTCDay() + 6) % 7;
  const startUtc = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - sinceMonday) - 9 * 3600_000;
  return { start: new Date(startUtc).toISOString(), end: new Date(startUtc + 7 * 86400_000).toISOString() };
}

const FILE_KINDS = "('pdf','docx','pptx','image')";

// createdAt은 예전 '가입일 기준 주간' 때 쓰던 인자. 부르는 곳을 그대로 두려고 남겨 둔다.
export function usage(userId: string, _createdAt?: string) {
  const w = weekWindow();
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
    // Pro 공정 사용 상한 (PRO_MONTHLY_UPLOADS, 0이면 제한 없음)
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
    throw new LimitError(`이번 주 PDF 무료 업로드 ${config.free.weeklyFiles}회를 모두 썼어요. 월요일 0시에 다시 채워지길 기다리거나 Pro로 업그레이드하세요.`, 'files');
  }
  if (kind === 'youtube' && u.youtube >= config.free.weeklyYoutube) {
    throw new LimitError(`이번 주 유튜브 무료 분석 ${config.free.weeklyYoutube}회를 모두 썼어요. 월요일 0시에 다시 채워지길 기다리거나 Pro로 업그레이드하세요.`, 'youtube');
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
