import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  Check,
  CheckCheck,
  FileText,
  FileUp,
  Image as ImageIcon,
  ImageUp,
  Mic,
  MoreVertical,
  NotebookPen,
  Pencil,
  Play,
  Plus,
  Search,
  Settings,
  SquarePen,
  Trash2,
  X,
  Youtube,
} from 'lucide-react';
import { api, formatDate, formatDuration, KIND_LABEL, type DocSummary } from '../lib/api.ts';
import { useApp, useRequireLogin } from '../lib/app.tsx';
import { Link, navigate } from '../lib/router.tsx';
import { DOC_ACCEPT, IMAGE_ACCEPT } from '../lib/upload.ts';
import { AppShell } from '../components/AppShell.tsx';
import { Button, IconButton, Modal, NewBadge, Spinner } from '../components/ui.tsx';
import { UploadProgress, useUploader, YoutubeModal } from './AddContent.tsx';

const KIND_COLOR: Record<string, string> = {
  pdf: 'text-blue',
  docx: 'text-blue',
  pptx: 'text-[#d9541e]',
  youtube: 'text-red',
  audio: 'text-teal',
  image: 'text-[#7a5af8]',
  memo: 'text-green',
};

type Sort = 'new' | 'old' | 'name' | 'kind';
const SORTS: Array<[Sort, string]> = [
  ['new', '최신순'],
  ['old', '오래된순'],
  ['name', '이름순'],
  ['kind', '형식순'],
];

function sortDocs(docs: DocSummary[], sort: Sort) {
  const list = [...docs];
  if (sort === 'new') list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (sort === 'old') list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (sort === 'name') list.sort((a, b) => a.title.localeCompare(b.title, 'ko'));
  if (sort === 'kind') list.sort((a, b) => KIND_LABEL[a.kind].localeCompare(KIND_LABEL[b.kind], 'ko') || b.createdAt.localeCompare(a.createdAt));
  return list;
}

export function Waveform({ bars = 22, className = '' }: { bars?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-[3px] ${className}`}>
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className="w-[3px] rounded-full bg-muted/70" style={{ height: `${10 + ((i * 37) % 26)}px` }} />
      ))}
    </div>
  );
}

function Thumb({ doc }: { doc: DocSummary }) {
  if (doc.status === 'processing') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-[13px] text-muted">
        <Spinner className="h-5 w-5 text-ink" />
        AI가 자료를 읽고 있어요
      </div>
    );
  }
  if (doc.status === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-[13px] text-red">
        <AlertCircle size={20} />
        <span className="line-clamp-2">{doc.error || '처리하지 못했어요'}</span>
      </div>
    );
  }
  if (doc.thumb) {
    return (
      <div className="relative h-full w-full">
        <img src={doc.thumb} alt="" className="h-full w-full object-cover object-top" loading="lazy" />
        {doc.kind === 'youtube' && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white">
              <Play size={20} fill="currentColor" />
            </span>
          </span>
        )}
      </div>
    );
  }
  if (doc.kind === 'audio') {
    return (
      <div className="relative flex h-full items-center justify-center">
        <Waveform />
        {doc.durationSec ? (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] text-white">{formatDuration(doc.durationSec)}</span>
        ) : null}
      </div>
    );
  }
  // 글 자료는 본문 첫머리를 흐리게 보여 준다
  if (doc.preview) {
    return (
      <div className="relative h-full overflow-hidden px-3 pt-2.5 text-left">
        <p className="whitespace-pre-line text-[11px] leading-[1.55] text-sub">{doc.preview}</p>
        <span className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-soft to-transparent" />
      </div>
    );
  }
  const Icon = doc.kind === 'image' ? ImageIcon : doc.kind === 'memo' ? NotebookPen : FileText;
  return (
    <div className="flex h-full items-center justify-center text-muted">
      <Icon size={26} strokeWidth={1.5} />
    </div>
  );
}

function SelectDot({ on }: { on: boolean }) {
  return (
    <span
      className={`absolute left-2 top-2 z-[1] flex h-6 w-6 items-center justify-center rounded-full border-2 ${on ? 'border-solid bg-solid text-on-solid' : 'border-white/80 bg-black/30'}`}
    >
      {on && <Check size={14} strokeWidth={3} />}
    </span>
  );
}

function DocCard({
  doc,
  selecting,
  selected,
  onToggle,
  onRename,
  onDelete,
}: {
  doc: DocSummary;
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const canSelect = selecting && !doc.isSample;
  const body = (
    <>
      <div className={`relative aspect-[16/9.4] overflow-hidden rounded-xl border bg-soft ${selected ? 'border-ink' : 'border-line'}`}>
        <Thumb doc={doc} />
        {canSelect && <SelectDot on={selected} />}
      </div>
      <div className="mt-2 truncate pr-8 text-[15px] font-medium">{doc.title}</div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[13px]">
        <span className={KIND_COLOR[doc.kind]}>{KIND_LABEL[doc.kind]}</span>
        <span className="text-muted">{doc.isSample ? '샘플' : formatDate(doc.createdAt)}</span>
      </div>
    </>
  );
  return (
    <div className={`relative ${selecting && doc.isSample ? 'opacity-40' : ''}`}>
      {selecting ? (
        <button type="button" disabled={!canSelect} onClick={onToggle} className="block w-full text-left">
          {body}
        </button>
      ) : (
        <Link to={`/doc/${doc.id}`} className="block">
          {body}
        </Link>
      )}
      {!doc.isSample && !selecting && (
        <div className="absolute bottom-1.5 right-0">
          <IconButton onClick={() => setMenu((m) => !m)} className="h-8 w-8" aria-label="더보기">
            <MoreVertical size={17} />
          </IconButton>
          {menu && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-9 z-30 w-40 rounded-xl border border-line bg-canvas p-1 shadow-card">
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[15px] hover:bg-soft"
                  onClick={() => {
                    setMenu(false);
                    onRename();
                  }}
                >
                  <Pencil size={16} /> 이름 바꾸기
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[15px] text-red hover:bg-soft"
                  onClick={() => {
                    setMenu(false);
                    onDelete();
                  }}
                >
                  <Trash2 size={16} /> 삭제
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RenameModal({ doc, onClose, onSaved }: { doc: DocSummary | null; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useApp();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setTitle(doc?.title ?? ''), [doc]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doc || !title.trim()) return;
    setBusy(true);
    try {
      await api(`/api/docs/${doc.id}`, { title: title.trim() }, { method: 'PATCH' });
      onSaved();
      onClose();
    } catch (err: any) {
      showToast(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={!!doc} onClose={onClose}>
      <h2 className="text-[20px] font-semibold">이름 바꾸기</h2>
      <form onSubmit={save} className="mt-4">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          className="h-12 w-full rounded-xl border border-line bg-canvas px-4 text-[15px] outline-none focus:border-ink"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={busy || !title.trim()}>
            저장
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function NewMenu({ onClose, onPickDoc, onPickImage, onYoutube }: { onClose: () => void; onPickDoc: () => void; onPickImage: () => void; onYoutube: () => void }) {
  const requireLogin = useRequireLogin();
  const item = 'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] hover:bg-soft';
  const run = (fn: () => void) => {
    onClose();
    requireLogin(fn);
  };
  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-[228px] rounded-2xl border border-line bg-canvas p-1.5 shadow-card">
        <button type="button" className={item} onClick={() => run(onPickDoc)}>
          <FileUp size={18} strokeWidth={1.8} /> PDF·문서 올리기
        </button>
        <button type="button" className={item} onClick={() => run(() => navigate('/record'))}>
          <Mic size={18} strokeWidth={1.8} /> <span className="flex-1">강의 녹음</span> <NewBadge />
        </button>
        <button type="button" className={item} onClick={() => run(onYoutube)}>
          <Youtube size={18} strokeWidth={1.8} /> YouTube 영상
        </button>
        <button type="button" className={item} onClick={() => run(onPickImage)}>
          <ImageUp size={18} strokeWidth={1.8} /> 사진 올리기
        </button>
        <button type="button" className={item} onClick={() => run(() => navigate('/memo/new'))}>
          <SquarePen size={18} strokeWidth={1.8} /> 새 메모
        </button>
      </div>
    </>
  );
}

export default function Documents() {
  const { me, showToast, openLogin } = useApp();
  const [docs, setDocs] = useState<DocSummary[] | null>(null);
  const [sort, setSort] = useState<Sort>('new');
  const [sortOpen, setSortOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newOpen, setNewOpen] = useState(false);
  const [youtube, setYoutube] = useState(false);
  const [renaming, setRenaming] = useState<DocSummary | null>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const imgInput = useRef<HTMLInputElement>(null);
  const { progress, run } = useUploader();

  const load = useCallback(async () => {
    try {
      const r = await api<{ docs: DocSummary[] }>('/api/docs');
      setDocs(r.docs);
    } catch (e: any) {
      showToast(e.message);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load, me?.user?.email]);

  useEffect(() => {
    if (!docs?.some((d) => d.status === 'processing')) return;
    const t = window.setInterval(() => void load(), 2500);
    return () => window.clearInterval(t);
  }, [docs, load]);

  const q = query?.trim().toLowerCase() ?? '';
  const mine = sortDocs(docs?.filter((d) => !d.isSample) ?? [], sort);
  const samples = docs?.filter((d) => d.isSample) ?? [];
  const shown = [...mine, ...samples].filter((d) => !q || d.title.toLowerCase().includes(q));

  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const remove = async (ids: string[]) => {
    const msg = ids.length === 1 ? `"${docs?.find((d) => d.id === ids[0])?.title}" 문서를 지울까요? 만든 학습 자료도 같이 지워져요.` : `문서 ${ids.length}개를 지울까요? 만든 학습 자료도 같이 지워져요.`;
    if (!window.confirm(msg)) return;
    for (const id of ids) await api(`/api/docs/${id}`, undefined, { method: 'DELETE' }).catch(() => {});
    stopSelecting();
    void load();
  };

  const title =
    query !== null ? (
      <label className="flex h-9 items-center gap-2 rounded-full bg-soft px-3">
        <Search size={16} className="shrink-0 text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="문서 이름으로 찾기"
          className="w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-muted"
        />
      </label>
    ) : (
      '문서'
    );

  const right = selecting ? (
    <div className="flex items-center gap-3">
      <span className="text-[14px] text-sub">{selected.size}개 선택</span>
      <button type="button" onClick={stopSelecting} className="h-9 px-1 text-[15px] font-medium">
        취소
      </button>
    </div>
  ) : (
    <div className="relative flex items-center gap-0.5">
      {query !== null ? (
        <IconButton onClick={() => setQuery(null)} aria-label="검색 닫기">
          <X size={19} />
        </IconButton>
      ) : (
        <IconButton onClick={() => setQuery('')} aria-label="검색">
          <Search size={19} />
        </IconButton>
      )}
      {mine.length > 0 && (
        <button type="button" onClick={() => setSelecting(true)} className="h-9 rounded-full px-2.5 text-[15px] font-medium hover:bg-soft">
          선택
        </button>
      )}
      <IconButton onClick={() => setSortOpen((o) => !o)} aria-label="정렬">
        <ArrowUpDown size={18} />
      </IconButton>
      {me?.user ? (
        <IconButton onClick={() => navigate('/settings')} aria-label="설정">
          <Settings size={18} />
        </IconButton>
      ) : (
        me && (
          <Button size="sm" onClick={() => openLogin()} className="ml-1">
            로그인
          </Button>
        )
      )}
      {sortOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setSortOpen(false)} />
          <div className="absolute right-0 top-11 z-30 w-44 rounded-xl border border-line bg-canvas p-1 shadow-card">
            {SORTS.map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setSort(v);
                  setSortOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-[15px] hover:bg-soft"
              >
                {label}
                {sort === v && <Check size={16} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <AppShell title={title} right={right}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 px-3 pb-10 pt-1 sm:grid-cols-3 md:px-6 lg:grid-cols-4 xl:grid-cols-5">
        {!q && (
          <div className="relative">
            <button
              type="button"
              disabled={selecting}
              onClick={() => setNewOpen((o) => !o)}
              className="flex aspect-[16/9.4] w-full flex-col items-center justify-center gap-2 rounded-xl border border-line bg-soft text-[15px] text-sub transition hover:bg-soft-2 disabled:opacity-40"
            >
              <Plus size={22} strokeWidth={1.6} className="text-ink" />
              새로 만들기
            </button>
            {newOpen && (
              <NewMenu
                onClose={() => setNewOpen(false)}
                onPickDoc={() => docInput.current?.click()}
                onPickImage={() => imgInput.current?.click()}
                onYoutube={() => setYoutube(true)}
              />
            )}
          </div>
        )}
        {docs === null
          ? Array.from({ length: 3 }, (_, i) => <div key={i} className="aspect-[16/9.4] animate-pulse rounded-xl bg-soft" />)
          : shown.map((d) => (
              <DocCard
                key={d.id}
                doc={d}
                selecting={selecting}
                selected={selected.has(d.id)}
                onToggle={() =>
                  setSelected((s) => {
                    const n = new Set(s);
                    if (n.has(d.id)) n.delete(d.id);
                    else n.add(d.id);
                    return n;
                  })
                }
                onRename={() => setRenaming(d)}
                onDelete={() => void remove([d.id])}
              />
            ))}
      </div>

      {docs !== null && q && shown.length === 0 && <p className="px-6 py-16 text-center text-[15px] text-muted">"{query?.trim()}" 이름의 문서가 없어요.</p>}
      {docs !== null && !q && mine.length === 0 && (
        <div className="px-6 pb-16 pt-6 text-center md:pt-14">
          <div className="text-[22px] font-medium tracking-[-0.02em] md:text-[26px]">첫 공부 자료를 넣어 볼까요?</div>
          <p className="mx-auto mt-2 max-w-[340px] text-[15px] leading-[1.6] text-muted">PDF, 유튜브 링크, 메모 무엇이든 좋아요. 요약과 퀴즈는 AI가 만들어 둘게요.</p>
        </div>
      )}

      {selecting && (
        <div className="fixed inset-x-0 bottom-5 z-30 flex justify-center px-4">
          <div className="flex items-center rounded-full border border-line bg-canvas p-1 text-[15px] shadow-card">
            <button
              type="button"
              onClick={() => setSelected(selected.size === mine.length ? new Set() : new Set(mine.map((d) => d.id)))}
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 hover:bg-soft"
            >
              <CheckCheck size={17} /> 전체 선택
            </button>
            <span className="h-5 w-px bg-line" />
            <button
              type="button"
              disabled={!selected.size}
              onClick={() => void remove([...selected])}
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-red hover:bg-soft disabled:opacity-40"
            >
              <Trash2 size={17} /> 삭제
            </button>
            <span className="h-5 w-px bg-line" />
            <button type="button" onClick={stopSelecting} className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 hover:bg-soft">
              <X size={17} /> 취소
            </button>
          </div>
        </div>
      )}

      <input
        ref={docInput}
        type="file"
        accept={DOC_ACCEPT}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          if (/\.(ppt|doc)$/i.test(f.name)) return showToast('예전 형식(ppt, doc)은 읽지 못해요. pptx, docx나 PDF로 저장해서 올려 주세요.');
          void run([f]);
        }}
      />
      <input
        ref={imgInput}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])].slice(0, 10);
          e.target.value = '';
          void run(files);
        }}
      />
      <YoutubeModal open={youtube} onClose={() => setYoutube(false)} />
      <RenameModal doc={renaming} onClose={() => setRenaming(null)} onSaved={() => void load()} />
      <UploadProgress progress={progress} />
    </AppShell>
  );
}
