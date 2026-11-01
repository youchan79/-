import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.ts';

fs.mkdirSync(config.dataDir, { recursive: true });
export const uploadsDir = path.join(config.dataDir, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

export const db = new DatabaseSync(path.join(config.dataDir, 'studyai.db'));

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone TEXT,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

-- 소셜 로그인(구글·카카오·네이버) 연결. 같은 계정은 이메일이 바뀌거나 없어도 subject(제공자의 회원 번호)로 찾는다.
-- 소셜로만 가입한 사용자는 users.password_hash가 ''라서 비밀번호 로그인이 안 된다.
CREATE TABLE IF NOT EXISTS user_identities (
  provider TEXT NOT NULL,       -- google | kakao | naver
  subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  email TEXT,
  name TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (provider, subject)
);
CREATE INDEX IF NOT EXISTS idx_identities_user ON user_identities(user_id);

-- 문서: 업로드한 자료 하나. user_id가 NULL이면 모두가 보는 샘플이다.
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  kind TEXT NOT NULL,           -- pdf | docx | pptx | youtube | audio | image | memo
  title TEXT NOT NULL,
  source_url TEXT,              -- 유튜브 주소
  file_name TEXT,
  file_path TEXT,
  mime TEXT,
  size INTEGER,
  thumb TEXT,                   -- 작은 썸네일 (data URL 또는 이미지 주소)
  duration_sec INTEGER,
  page_count INTEGER,
  status TEXT NOT NULL,         -- processing | ready | error
  error TEXT,
  source_text TEXT,             -- 추출한 원문 ([p.N], [mm:ss] 표시 포함)
  memo TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_docs_user ON documents(user_id, created_at);

-- 문서별 학습 자료 (요약, 마인드맵, 암기, 개념). 퀴즈와 플래시카드는 세트가 여러 개라 따로 둔다.
CREATE TABLE IF NOT EXISTS materials (
  doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,         -- generating | ready | error
  json TEXT,
  error TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (doc_id, kind)
);

CREATE TABLE IF NOT EXISTS sets (
  id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id TEXT,
  kind TEXT NOT NULL,           -- quiz | flashcards
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  json TEXT,
  error TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sets_doc ON sets(doc_id, kind, created_at);

-- 사용자별 진행 상태 (암기 체크, 퀴즈 답, 플래시카드 결과 등)
CREATE TABLE IF NOT EXISTS progress (
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  doc_id TEXT,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_msgs ON chat_messages(chat_id, id);

CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  doc_ids_json TEXT NOT NULL,
  question_count INTEGER NOT NULL,
  duration_min INTEGER NOT NULL,
  status TEXT NOT NULL,         -- generating | ready | submitted | error
  json TEXT,
  answers_json TEXT,
  result_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  submitted_at TEXT
);

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  plan TEXT NOT NULL,           -- monthly | yearly
  status TEXT NOT NULL,         -- active | canceled | expired
  rebill_no TEXT,
  amount INTEGER NOT NULL,
  current_period_end TEXT NOT NULL,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  order_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  plan TEXT NOT NULL,
  kind TEXT NOT NULL,           -- first | renewal
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,         -- requested | paid | canceled | failed
  provider TEXT NOT NULL,
  mul_no TEXT,
  rebill_no TEXT,
  raw_json TEXT,
  meta_sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_mul ON payments(mul_no);
CREATE INDEX IF NOT EXISTS idx_payments_paid ON payments(paid_at);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  kind TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_krw REAL NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS funnel_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  anon_id TEXT,
  user_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_funnel_time ON funnel_events(created_at);
`);

export type Row = Record<string, any>;

export function one<T = Row>(sql: string, ...params: any[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function all<T = Row>(sql: string, ...params: any[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function run(sql: string, ...params: any[]) {
  return db.prepare(sql).run(...params);
}

export function tx<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export const nowIso = () => new Date().toISOString();

export function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86400_000).toISOString();
}

export function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() < day) d.setUTCDate(0); // 1월 31일 + 1개월 = 2월 말일
  return d.toISOString();
}

/** KST 기준 오늘 0시를 UTC ISO 문자열로 */
export function kstDayStartIso(date = new Date()): string {
  const kst = new Date(date.getTime() + 9 * 3600_000);
  const startUtc = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 3600_000;
  return new Date(startUtc).toISOString();
}

export function logFunnel(name: string, anonId: string | null, userId: string | null) {
  run('INSERT INTO funnel_events (name, anon_id, user_id, created_at) VALUES (?, ?, ?, ?)', name, anonId, userId, nowIso());
}

export const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
