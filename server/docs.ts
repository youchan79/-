import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { all, one, run, nowIso, newId, uploadsDir, type Row } from './db.ts';
import { AiError, aiMode, generateJson, isReadableImage, readDocuments } from './ai.ts';
import { mediaSupport, normalizeTranscript, transcribeAudio, transcribeYoutube } from './media.ts';
import {
  EXTRACT_PROMPTS,
  SYSTEM,
  clipSource,
  materialPrompt,
  mockExtract,
  mockMaterial,
  mockSet,
  schemas,
  setPrompt,
  type MaterialKind,
  type SetKind,
} from './prompts.ts';

export type DocKind = 'pdf' | 'docx' | 'pptx' | 'youtube' | 'audio' | 'image' | 'memo';

const STALE_MS = 5 * 60_000;

export class DocError extends Error {}

/* ---------- 파일 종류 판별과 저장 ---------- */

export function detectKind(name: string, mime: string): DocKind | null {
  const ext = path.extname(name).toLowerCase();
  if (mime === 'application/pdf' || ext === '.pdf') return 'pdf';
  if (ext === '.docx') return 'docx';
  if (ext === '.pptx') return 'pptx';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/') || ['.mp3', '.m4a', '.wav', '.webm', '.ogg', '.aac'].includes(ext)) return 'audio';
  return null;
}

const AUDIO_MIME: Record<string, string> = {
  '.mp3': 'audio/mp3',
  '.m4a': 'audio/aac',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
  '.ogg': 'audio/ogg',
};

function normalizeMime(kind: DocKind, name: string, mime: string) {
  if (kind === 'pdf') return 'application/pdf';
  if (kind === 'audio') {
    const base = mime.split(';')[0];
    return base.startsWith('audio/') ? base : AUDIO_MIME[path.extname(name).toLowerCase()] ?? 'audio/webm';
  }
  return mime.split(';')[0];
}

export interface IncomingFile {
  path: string; // multer 임시 파일
  originalname: string;
  mimetype: string;
  size: number;
}

function storeFiles(docId: string, files: IncomingFile[]): string[] {
  const dir = path.join(uploadsDir, docId);
  fs.mkdirSync(dir, { recursive: true });
  return files.map((f, i) => {
    const dest = path.join(dir, `${i}${path.extname(f.originalname).toLowerCase() || ''}`);
    fs.renameSync(f.path, dest);
    return dest;
  });
}

export function docFiles(doc: Row): string[] {
  if (!doc.file_path) return [];
  try {
    return JSON.parse(doc.file_path);
  } catch {
    return [doc.file_path];
  }
}

const stripExt = (name: string) => name.replace(/\.[^.]+$/, '');

/* ---------- 문서 만들기 ---------- */

export function createFileDoc(p: {
  userId: string;
  kind: DocKind;
  files: IncomingFile[];
  title?: string;
  thumb?: string | null;
  durationSec?: number | null;
  liveTranscript?: string | null;
}) {
  const id = newId('doc');
  const first = p.files[0];
  const stored = storeFiles(id, p.files);
  const now = nowIso();
  const title =
    p.title?.trim() ||
    (p.kind === 'audio'
      ? `강의 녹음 ${new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 16).replace('T', ' ')}`
      : p.kind === 'image'
        ? `필기 사진 ${p.files.length}장`
        : stripExt(first.originalname));
  run(
    `INSERT INTO documents (id, user_id, kind, title, file_name, file_path, mime, size, thumb, duration_sec, status, source_text, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?, ?)`,
    id,
    p.userId,
    p.kind,
    title.slice(0, 120),
    first.originalname,
    JSON.stringify(stored),
    normalizeMime(p.kind, first.originalname, first.mimetype),
    p.files.reduce((a, f) => a + f.size, 0),
    p.thumb ?? null,
    p.durationSec ?? null,
    p.liveTranscript ?? null,
    now,
    now,
  );
  void processDoc(id, p.userId);
  return id;
}

/** 강의 녹음: 누르자마자 빈 문서를 만들고(status = recording), 그 문서 화면에서 녹음한다. */
export function createRecordingDoc(userId: string) {
  const id = newId('doc');
  const now = nowIso();
  run(
    `INSERT INTO documents (id, user_id, kind, title, status, created_at, updated_at)
     VALUES (?, ?, 'audio', '새 강의 녹음', 'recording', ?, ?)`,
    id,
    userId,
    now,
    now,
  );
  return id;
}

/** 녹음을 끝내면 녹음 파일과 실시간 자막을 문서에 붙이고 정리를 시작한다. */
export function attachRecording(p: { docId: string; userId: string; file: IncomingFile; durationSec: number | null; liveTranscript: string | null }) {
  const stored = storeFiles(p.docId, [p.file]);
  run(
    `UPDATE documents SET file_name = ?, file_path = ?, mime = ?, size = ?, duration_sec = ?, source_text = ?, status = 'processing', error = NULL, updated_at = ?
     WHERE id = ?`,
    p.file.originalname,
    JSON.stringify(stored),
    normalizeMime('audio', p.file.originalname, p.file.mimetype),
    p.file.size,
    p.durationSec,
    p.liveTranscript,
    nowIso(),
    p.docId,
  );
  void processDoc(p.docId, p.userId);
}

export function parseYoutubeId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.hostname === 'youtu.be') return u.pathname.slice(1, 12) || null;
    if (u.hostname.endsWith('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]{11})/);
      if (m) return m[2];
    }
  } catch {
    /* 잘못된 주소 */
  }
  return null;
}

export async function createYoutubeDoc(userId: string, url: string, transcript?: string) {
  const vid = parseYoutubeId(url);
  if (!vid) throw new DocError('유튜브 링크를 확인해 주세요.');
  const script = transcript?.trim() ? normalizeTranscript(transcript).slice(0, 200_000) : null;
  if (!script && !mediaSupport.youtubeAuto) throw new DocError('영상 자막(스크립트)을 붙여 넣어 주세요.');
  const canonical = `https://www.youtube.com/watch?v=${vid}`;
  let title = '유튜브 영상';
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(canonical)}&format=json`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) title = ((await res.json()) as any).title || title;
  } catch {
    /* 제목을 못 가져와도 계속 */
  }
  const id = newId('doc');
  const now = nowIso();
  run(
    `INSERT INTO documents (id, user_id, kind, title, source_url, thumb, status, source_text, created_at, updated_at)
     VALUES (?, ?, 'youtube', ?, ?, ?, 'processing', ?, ?, ?)`,
    id,
    userId,
    title.slice(0, 120),
    canonical,
    `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
    script,
    now,
    now,
  );
  void processDoc(id, userId);
  return id;
}

export function createMemoDoc(userId: string, title: string, text: string) {
  const body = text.trim();
  if (body.length < 20) throw new DocError('메모를 20자 이상 적어 주세요.');
  const id = newId('doc');
  const now = nowIso();
  run(
    `INSERT INTO documents (id, user_id, kind, title, status, source_text, created_at, updated_at)
     VALUES (?, ?, 'memo', ?, 'processing', ?, ?, ?)`,
    id,
    userId,
    (title.trim() || body.split('\n')[0]).slice(0, 80),
    body.slice(0, 200_000),
    now,
    now,
  );
  void processDoc(id, userId);
  return id;
}

/* ---------- 원문 추출 ---------- */

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

async function extractOffice(kind: 'docx' | 'pptx', file: string): Promise<{ text: string; pages: number }> {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  if (kind === 'docx') {
    const xml = (await zip.file('word/document.xml')?.async('string')) ?? '';
    const text = decodeXml(
      xml
        .replace(/<w:tab\/>/g, '\t')
        .replace(/<\/w:p>/g, '\n')
        .replace(/<[^>]+>/g, ''),
    );
    return { text: text.replace(/\n{3,}/g, '\n\n').trim(), pages: 0 };
  }
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/g)!.pop()) - Number(b.match(/\d+/g)!.pop()));
  const parts: string[] = [];
  for (const [i, name] of slides.entries()) {
    const xml = await zip.file(name)!.async('string');
    const text = decodeXml(xml.replace(/<\/a:p>/g, '\n').replace(/<[^>]+>/g, '')).trim();
    parts.push(`[p.${i + 1}]\n${text}`);
  }
  return { text: parts.join('\n\n'), pages: slides.length };
}

async function extract(doc: Row, userId: string): Promise<{ text: string; pages: number | null }> {
  const kind = doc.kind as DocKind;
  const files = docFiles(doc);
  if (kind === 'memo') return { text: doc.source_text, pages: null };
  if (kind === 'docx' || kind === 'pptx') return extractOffice(kind, files[0]);

  // 녹음은 브라우저 실시간 자막, 유튜브는 붙여 넣은 자막이 있으면 그대로 원문으로 쓴다.
  if ((kind === 'audio' || kind === 'youtube') && doc.source_text?.trim()) return { text: doc.source_text, pages: null };

  if (kind === 'audio') {
    if (!mediaSupport.audioFile) {
      if (aiMode === 'mock') return { text: mockExtract(kind, doc.title), pages: null };
      throw new DocError('녹음 파일 받아쓰기는 아직 지원하지 않아요. 녹음 화면에서 녹음하면 실시간 자막으로 정리돼요.');
    }
    return { text: await transcribeAudio(userId, files[0], doc.mime, EXTRACT_PROMPTS.audio), pages: null };
  }
  if (kind === 'youtube') {
    if (!mediaSupport.youtubeAuto) throw new DocError('영상 자막(스크립트)을 붙여 넣어 주세요.');
    return { text: await transcribeYoutube(userId, doc.source_url, EXTRACT_PROMPTS.youtube), pages: null };
  }

  // PDF와 사진은 Claude가 직접 읽는다.
  const inputs = files.map((f) => ({ path: f, mime: kind === 'image' ? mimeOf(f) : 'application/pdf' }));
  const text = await readDocuments({
    userId,
    kind: `extract_${kind}`,
    files: inputs,
    prompt: EXTRACT_PROMPTS[kind as 'pdf' | 'image'],
    mock: () => mockExtract(kind, doc.title),
  });
  const pages = new Set([...text.matchAll(/\[p\.(\d+)\]/g)].map((m) => m[1])).size || null;
  return { text, pages };
}

function mimeOf(file: string) {
  const ext = path.extname(file).toLowerCase();
  return ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : ext === '.heic' || ext === '.heif' ? 'image/heic' : 'image/jpeg';
}

export function assertReadableImages(files: Array<{ originalname: string; mimetype: string }>) {
  for (const f of files) {
    const mime = f.mimetype.split(';')[0];
    if (!isReadableImage(mime)) throw new DocError('JPG, PNG, WEBP 사진만 올릴 수 있어요. 아이폰 HEIC 사진은 JPG로 바꿔서 올려 주세요.');
  }
}

export async function processDoc(docId: string, userId: string) {
  const doc = one('SELECT * FROM documents WHERE id = ?', docId);
  if (!doc) return;
  try {
    const { text, pages } = await extract(doc, userId);
    if (!text.trim()) throw new DocError('자료에서 내용을 읽지 못했어요.');
    run(
      "UPDATE documents SET status = 'ready', source_text = ?, page_count = COALESCE(?, page_count), updated_at = ? WHERE id = ?",
      text,
      pages,
      nowIso(),
      docId,
    );
    await generateMaterial(docId, 'summary', userId);
  } catch (e) {
    console.error('[doc] 처리 실패', docId, e);
    const msg = e instanceof DocError || e instanceof AiError ? e.message : '자료를 처리하지 못했어요. 다시 시도해 주세요.';
    run("UPDATE documents SET status = 'error', error = ?, updated_at = ? WHERE id = ?", msg, nowIso(), docId);
  }
}

/* ---------- 학습 자료 ---------- */

/**
 * 설정 > AI 설정을 프롬프트에 반영한다. system은 모든 생성에서 같아야 원문 캐시를 함께 쓰므로,
 * 사용자별 지시는 user 메시지(할 일) 끝에 붙인다.
 */
function userStyle(userId: string | null, kind: string) {
  if (!userId) return { style: '', difficulty: undefined as string | undefined };
  const row = one('SELECT settings_json FROM users WHERE id = ?', userId);
  const s = JSON.parse(row?.settings_json || '{}');
  const extra: string[] = [];
  if (s.answerLanguage === 'source') extra.push('- 한국어 규칙 대신, 자료 원문과 같은 언어로 쓴다.');
  if (kind === 'summary' && s.summaryLength === 'short') extra.push('- 요약은 3~4개 섹션, 섹션마다 한 문단으로 짧게 쓴다.');
  if (kind === 'summary' && s.summaryLength === 'long') extra.push('- 요약은 6~10개 섹션으로 자세히 쓴다.');
  return { style: extra.length ? `\n${extra.join('\n')}` : '', difficulty: s.quizDifficulty as string | undefined };
}

export function getMaterial(docId: string, kind: MaterialKind) {
  return one('SELECT * FROM materials WHERE doc_id = ? AND kind = ?', docId, kind);
}

/** 없으면 만들기 시작한다. 이미 있거나 만드는 중이면 그대로 둔다. */
export function ensureMaterial(docId: string, kind: MaterialKind, userId: string | null, force = false) {
  const m = getMaterial(docId, kind);
  if (m && !force) {
    if (m.status === 'ready') return;
    if (m.status === 'generating' && Date.now() - new Date(m.updated_at).getTime() < STALE_MS) return;
  }
  void generateMaterial(docId, kind, userId);
}

async function generateMaterial(docId: string, kind: MaterialKind, userId: string | null) {
  const doc = one('SELECT * FROM documents WHERE id = ?', docId);
  if (!doc || doc.status !== 'ready') return;
  run(
    `INSERT INTO materials (doc_id, kind, status, updated_at) VALUES (?, ?, 'generating', ?)
     ON CONFLICT(doc_id, kind) DO UPDATE SET status = 'generating', error = NULL, updated_at = excluded.updated_at`,
    docId,
    kind,
    nowIso(),
  );
  try {
    const json = await generateJson<any>({
      userId,
      kind,
      system: SYSTEM,
      source: clipSource(doc.source_text),
      task: materialPrompt(kind, userStyle(doc.user_id ?? userId, kind).style),
      schema: schemas[kind],
      maxTokens: kind === 'summary' || kind === 'concepts' ? 12_000 : 6000,
      mock: () => mockMaterial(kind, doc.source_text, doc.title),
    });
    run("UPDATE materials SET status = 'ready', json = ?, updated_at = ? WHERE doc_id = ? AND kind = ?", JSON.stringify(json), nowIso(), docId, kind);
    // 녹음, 사진, 메모는 파일 이름이 없으니 요약이 붙인 제목을 쓴다.
    if (kind === 'summary' && ['audio', 'image', 'memo'].includes(doc.kind) && json.title) {
      run('UPDATE documents SET title = ? WHERE id = ?', String(json.title).slice(0, 80), docId);
    }
  } catch (e) {
    console.error('[material] 실패', docId, kind, e);
    run(
      "UPDATE materials SET status = 'error', error = ?, updated_at = ? WHERE doc_id = ? AND kind = ?",
      e instanceof AiError ? e.message : '만들지 못했어요.',
      nowIso(),
      docId,
      kind,
    );
  }
}

export function listSets(docId: string, kind: SetKind) {
  return all('SELECT id, kind, title, status, json, error, created_at FROM sets WHERE doc_id = ? AND kind = ? ORDER BY created_at ASC', docId, kind);
}

export function createSet(p: { docId: string; kind: SetKind; userId: string | null; count: number; focus?: string; difficulty?: string }) {
  const doc = one('SELECT * FROM documents WHERE id = ?', p.docId);
  if (!doc || doc.status !== 'ready') throw new DocError('자료를 아직 정리하고 있어요.');
  const id = newId(p.kind === 'quiz' ? 'qz' : 'fc');
  const existing = listSets(p.docId, p.kind);
  const label = p.kind === 'quiz' ? '퀴즈' : '플래시카드';
  const title = p.focus ? `${p.focus} ${label}` : `${label} ${existing.length + 1}`;
  run(
    `INSERT INTO sets (id, doc_id, user_id, kind, title, status, created_at) VALUES (?, ?, ?, ?, ?, 'generating', ?)`,
    id,
    p.docId,
    p.userId,
    p.kind,
    title,
    nowIso(),
  );
  const avoid =
    p.kind === 'quiz'
      ? existing.flatMap((s) => (s.json ? JSON.parse(s.json).questions.map((q: any) => q.question as string) : []))
      : [];
  const style = userStyle(p.userId, p.kind);
  void (async () => {
    try {
      const json = await generateJson<any>({
        userId: p.userId,
        kind: p.kind,
        system: SYSTEM,
        source: clipSource(doc.source_text),
        cache: true,
        task: setPrompt(p.kind, { count: p.count, focus: p.focus, avoid, difficulty: p.difficulty ?? (p.kind === 'quiz' ? style.difficulty : undefined), style: style.style }),
        schema: schemas[p.kind],
        maxTokens: 10_000,
        mock: () => mockSet(p.kind, doc.source_text, p.count),
      });
      run("UPDATE sets SET status = 'ready', json = ? WHERE id = ?", JSON.stringify(json), id);
    } catch (e) {
      console.error('[set] 실패', id, e);
      run("UPDATE sets SET status = 'error', error = ? WHERE id = ?", e instanceof AiError ? e.message : '만들지 못했어요.', id);
    }
  })();
  return id;
}

/** 서버가 재시작되면 만들던 작업은 실패로 바꾼다. */
export function recoverInterrupted() {
  run("UPDATE documents SET status = 'error', error = '처리가 중단됐어요. 다시 올려 주세요.' WHERE status = 'processing'");
  run("UPDATE materials SET status = 'error', error = '중단됨' WHERE status = 'generating'");
  run("UPDATE sets SET status = 'error', error = '중단됨' WHERE status = 'generating'");
  run("UPDATE exams SET status = 'error', error = '중단됨' WHERE status = 'generating'");
}

/** 휴지통 보관 기간. 지난 문서는 파일·학습 자료·튜터 대화까지 완전히 지운다. */
export const TRASH_DAYS = 7;

export function purgeTrash() {
  const cutoff = new Date(Date.now() - TRASH_DAYS * 86400_000).toISOString();
  for (const d of all('SELECT id FROM documents WHERE deleted_at IS NOT NULL AND deleted_at < ?', cutoff)) deleteDoc(d.id);
}

export function deleteDoc(docId: string) {
  fs.rmSync(path.join(uploadsDir, docId), { recursive: true, force: true });
  run('DELETE FROM chats WHERE doc_id = ?', docId);
  run('DELETE FROM shares WHERE doc_id = ?', docId);
  run('DELETE FROM documents WHERE id = ?', docId);
}

/** 내 폴더면 그 id, 아니면 null(맨 위) */
export function ownFolder(userId: string, folderId: unknown): string | null {
  if (typeof folderId !== 'string' || !folderId) return null;
  return one('SELECT id FROM folders WHERE id = ? AND user_id = ?', folderId, userId)?.id ?? null;
}
