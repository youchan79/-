import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { all, one, run, nowIso, newId, uploadsDir, type Row } from './db.ts';
import { AiError, aiMode, filePart, generateJson, generateText, youtubePart } from './ai.ts';
import {
  EXTRACT_PROMPTS,
  SYSTEM,
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

export async function createYoutubeDoc(userId: string, url: string) {
  const vid = parseYoutubeId(url);
  if (!vid) throw new DocError('유튜브 링크를 확인해 주세요.');
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
    `INSERT INTO documents (id, user_id, kind, title, source_url, thumb, status, created_at, updated_at)
     VALUES (?, ?, 'youtube', ?, ?, ?, 'processing', ?, ?)`,
    id,
    userId,
    title.slice(0, 120),
    canonical,
    `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
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

  if (aiMode === 'mock') {
    // 녹음은 브라우저 실시간 자막이 있으면 그걸 원문으로 쓴다.
    if (kind === 'audio' && doc.source_text?.trim()) return { text: doc.source_text, pages: null };
    return { text: mockExtract(kind, doc.title), pages: kind === 'pdf' ? 3 : null };
  }

  const prompt = EXTRACT_PROMPTS[kind as keyof typeof EXTRACT_PROMPTS];
  const parts =
    kind === 'youtube'
      ? [youtubePart(doc.source_url), { text: prompt }]
      : [...(await Promise.all(files.map((f) => filePart(f, kind === 'image' ? mimeOf(f) : doc.mime)))), { text: prompt }];
  const text = await generateText({
    userId,
    kind: `extract_${kind}`,
    parts,
    maxTokens: 60_000,
    temperature: 0.1,
    lowMediaResolution: kind === 'youtube',
    mock: () => '',
  });
  const pages = kind === 'pdf' || kind === 'image' ? new Set([...text.matchAll(/\[p\.(\d+)\]/g)].map((m) => m[1])).size || null : null;
  return { text, pages };
}

function mimeOf(file: string) {
  const ext = path.extname(file).toLowerCase();
  return ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.heic' ? 'image/heic' : 'image/jpeg';
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

/** 설정 > AI 설정을 프롬프트에 반영한다. */
function userStyle(userId: string | null, kind: string) {
  if (!userId) return { system: SYSTEM, difficulty: undefined as string | undefined };
  const row = one('SELECT settings_json FROM users WHERE id = ?', userId);
  const s = JSON.parse(row?.settings_json || '{}');
  const extra: string[] = [];
  if (s.answerLanguage === 'source') extra.push('- 위의 한국어 규칙 대신, 자료 원문과 같은 언어로 쓴다.');
  if (kind === 'summary' && s.summaryLength === 'short') extra.push('- 요약은 3~4개 섹션, 섹션마다 한 문단으로 짧게 쓴다.');
  if (kind === 'summary' && s.summaryLength === 'long') extra.push('- 요약은 6~10개 섹션으로 자세히 쓴다.');
  return { system: extra.length ? `${SYSTEM}\n${extra.join('\n')}` : SYSTEM, difficulty: s.quizDifficulty as string | undefined };
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
      system: userStyle(doc.user_id ?? userId, kind).system,
      prompt: materialPrompt(kind, doc.source_text),
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
        system: style.system,
        prompt: setPrompt(p.kind, doc.source_text, { count: p.count, focus: p.focus, avoid, difficulty: p.difficulty ?? (p.kind === 'quiz' ? style.difficulty : undefined) }),
        schema: schemas[p.kind],
        maxTokens: 10_000,
        temperature: 0.7,
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

export function deleteDoc(docId: string) {
  fs.rmSync(path.join(uploadsDir, docId), { recursive: true, force: true });
  run('DELETE FROM chats WHERE doc_id = ?', docId);
  run('DELETE FROM documents WHERE id = ?', docId);
}
