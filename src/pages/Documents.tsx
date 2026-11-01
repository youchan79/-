import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpDown,
  Check,
  CheckCheck,
  FileText,
  FileUp,
  FolderClosed,
  FolderInput,
  FolderPlus,
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
  Star,
  Trash2,
  X,
  Youtube,
} from 'lucide-react';
import { api, formatDate, formatDuration, KIND_LABEL, type DocSummary } from '../lib/api.ts';
import { useApp, useRequireLogin } from '../lib/app.tsx';
import { Link, navigate, useLocation } from '../lib/router.tsx';
import { DOC_ACCEPT, IMAGE_ACCEPT } from '../lib/upload.ts';
import { AppShell } from '../components/AppShell.tsx';
import { Button, EmptyState, IconButton, Modal, NewBadge, Spinner } from '../components/ui.tsx';
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

interface Folder {
  id: string;
  name: string;
  count: number;
  createdAt: string;
}

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

export function Thumb({ doc }: { doc: DocSummary }) {
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

type MenuItem = { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean };

/** 카드 오른쪽 아래 세로 점 메뉴 */
function CardMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute bottom-1.5 right-0">
      <IconButton onClick={() => setOpen((m) => !m)} className="h-8 w-8" aria-label="더보기">
        <MoreVertical size={17} />
      </IconButton>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-30 w-44 rounded-xl border border-line bg-canvas p-1 shadow-card">
            {items.map((it) => (
              <button
                key={it.label}
                type="button"
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[15px] hover:bg-soft ${it.danger ? 'text-red' : ''}`}
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
              >
                {it.icon} {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DocCard({
  doc,
  selecting,
  selected,
  onToggle,
  menu,
}: {
  doc: DocSummary;
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
  menu: MenuItem[];
}) {
  const canSelect = selecting && !doc.isSample;
  const body = (
    <>
      <div className={`relative aspect-[16/9.4] overflow-hidden rounded-xl border bg-soft ${selected ? 'border-ink' : 'border-line'}`}>
        <Thumb doc={doc} />
        {canSelect && <SelectDot on={selected} />}
      </div>
      <div className="mt-2 flex items-center gap-1 pr-8">
        {doc.favorite && <Star size={14} className="shrink-0 fill-current text-[#f5b301]" aria-label="즐겨찾기" />}
        <span className="truncate text-[15px] font-medium">{doc.title}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[13px]">
        <span className={KIND_COLOR[doc.kind]}>{KIND_LABEL[doc.kind]}</span>
        <span className="text-muted">{doc.isSample ? '샘플' : doc.status === 'recording' ? '녹음 전' : formatDate(doc.createdAt)}</span>
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
      {!doc.isSample && !selecting && <CardMenu items={menu} />}
    </div>
  );
}

function FolderCard({ folder, dim, menu }: { folder: Folder; dim: boolean; menu: MenuItem[] }) {
  return (
    <div className={`relative ${dim ? 'pointer-events-none opacity-40' : ''}`}>
      <Link to={`/home?folder=${folder.id}`} className="block">
        <div className="flex aspect-[16/9.4] items-center justify-center rounded-xl border border-line bg-soft text-sub">
          <FolderClosed size={34} strokeWidth={1.4} />
        </div>
        <div className="mt-2 truncate pr-8 text-[15px] font-medium">{folder.name}</div>
        <div className="mt-0.5 text-[13px] text-muted">폴더 · 문서 {folder.count}개</div>
      </Link>
      {!dim && <CardMenu items={menu} />}
    </div>
  );
}

/** 이름 적는 작은 창: 문서 이름 바꾸기·새 폴더·폴더 이름 바꾸기에 같이 쓴다 */
function NameModal({ open, title, initial, placeholder, onClose, onSave }: { open: boolean; title: string; initial: string; placeholder?: string; onClose: () => void; onSave: (name: string) => Promise<void> }) {
  const { showToast } = useApp();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setName(initial);
  }, [open, initial]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onSave(name.trim());
      onClose();
    } catch (err: any) {
      showToast(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-[20px] font-semibold">{title}</h2>
      <form onSubmit={save} className="mt-4">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          placeholder={placeholder}
          className="h-12 w-full rounded-xl border border-line bg-canvas px-4 text-[15px] outline-none placeholder:text-muted focus:border-ink"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={busy || !name.trim()}>
            저장
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** 이동: 맨 위(문서) 또는 폴더 하나를 고른다 */
function MoveModal({ open, count, folders, current, onClose, onMove }: { open: boolean; count: number; folders: Folder[]; current: string | null | undefined; onClose: () => void; onMove: (folderId: string | null) => void }) {
  const row = 'flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[15px] hover:bg-soft disabled:opacity-40 disabled:hover:bg-transparent';
  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-[20px] font-semibold">어디로 옮길까요?</h2>
      <p className="mt-1 text-[14px] text-muted">{count > 1 ? `문서 ${count}개를 옮겨요.` : '문서를 옮길 곳을 골라 주세요.'}</p>
      <div className="mt-4 max-h-[340px] space-y-1 overflow-y-auto">
        <button type="button" disabled={current === null} className={row} onClick={() => onMove(null)}>
          <FileText size={18} className="text-sub" /> <span className="flex-1">문서 (맨 위)</span>
          {current === null && <span className="text-[13px] text-muted">지금 위치</span>}
        </button>
        {folders.map((f) => (
          <button key={f.id} type="button" disabled={current === f.id} className={row} onClick={() => onMove(f.id)}>
            <FolderClosed size={18} className="text-sub" /> <span className="min-w-0 flex-1 truncate">{f.name}</span>
            {current === f.id && <span className="text-[13px] text-muted">지금 위치</span>}
          </button>
        ))}
        {folders.length === 0 && <p className="px-4 py-3 text-[14px] text-muted">아직 폴더가 없어요. 새로 만들기 → 새 폴더로 만들 수 있어요.</p>}
      </div>
    </Modal>
  );
}

function NewMenu({
  onClose,
  inFolder,
  folderQuery,
  onPickDoc,
  onPickImage,
  onYoutube,
  onFolder,
}: {
  onClose: () => void;
  inFolder: boolean;
  folderQuery: string;
  onPickDoc: () => void;
  onPickImage: () => void;
  onYoutube: () => void;
  onFolder: () => void;
}) {
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
        <button type="button" className={item} onClick={() => run(() => navigate(`/record${folderQuery}`))}>
          <Mic size={18} strokeWidth={1.8} /> <span className="flex-1">강의 녹음</span> <NewBadge />
        </button>
        <button type="button" className={item} onClick={() => run(onYoutube)}>
          <Youtube size={18} strokeWidth={1.8} /> YouTube 영상
        </button>
        <button type="button" className={item} onClick={() => run(onPickImage)}>
          <ImageUp size={18} strokeWidth={1.8} /> 사진 올리기
        </button>
        <button type="button" className={item} onClick={() => run(() => navigate(`/memo/new${folderQuery}`))}>
          <SquarePen size={18} strokeWidth={1.8} /> 새 메모
        </button>
        {!inFolder && (
          <>
            <div className="my-1 h-px bg-line" />
            <button type="button" className={item} onClick={() => run(onFolder)}>
              <FolderPlus size={18} strokeWidth={1.8} /> 새 폴더
            </button>
          </>
        )}
      </div>
    </>
  );
}

type Naming = { kind: 'doc'; doc: DocSummary } | { kind: 'newFolder' } | { kind: 'folder'; folder: Folder } | null;

export default function Documents() {
  const { me, showToast, openLogin } = useApp();
  const { search } = useLocation();
  const folderId = new URLSearchParams(search).get('folder');
  const [docs, setDocs] = useState<DocSummary[] | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [sort, setSort] = useState<Sort>('new');
  const [sortOpen, setSortOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newOpen, setNewOpen] = useState(false);
  const [youtube, setYoutube] = useState(false);
  const [naming, setNaming] = useState<Naming>(null);
  const [moving, setMoving] = useState<string[] | null>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const imgInput = useRef<HTMLInputElement>(null);
  const { progress, run } = useUploader();

  const load = useCallback(async () => {
    try {
      const [r, f] = await Promise.all([
        api<{ docs: DocSummary[] }>('/api/docs'),
        me?.user ? api<{ folders: Folder[] }>('/api/folders') : Promise.resolve({ folders: [] as Folder[] }),
      ]);
      setDocs(r.docs);
      setFolders(f.folders);
    } catch (e: any) {
      showToast(e.message);
    }
  }, [showToast, me?.user]);

  useEffect(() => {
    void load();
  }, [load, me?.user?.email]);

  useEffect(() => {
    if (!docs?.some((d) => d.status === 'processing')) return;
    const t = window.setInterval(() => void load(), 2500);
    return () => window.clearInterval(t);
  }, [docs, load]);

  // 폴더를 옮겨 다니면 선택·검색을 푼다
  useEffect(() => {
    setSelecting(false);
    setSelected(new Set());
    setQuery(null);
  }, [folderId]);

  const folder = folderId ? folders.find((f) => f.id === folderId) ?? null : null;
  const q = query?.trim().toLowerCase() ?? '';
  const mineAll = docs?.filter((d) => !d.isSample) ?? [];
  // 검색은 모든 폴더에서, 아니면 지금 보는 곳(맨 위 또는 폴더)만
  const mine = sortDocs(q ? mineAll : mineAll.filter((d) => (d.folderId ?? null) === folderId), sort);
  const samples = folderId ? [] : (docs?.filter((d) => d.isSample) ?? []);
  const shown = [...mine, ...samples].filter((d) => !q || d.title.toLowerCase().includes(q));
  const shownFolders = !folderId && !q ? folders : [];
  const folderQuery = folderId ? `?folder=${folderId}` : '';

  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  // 지우면 휴지통으로 간다(7일 안에 되살릴 수 있어서 따로 묻지 않음)
  const remove = async (ids: string[]) => {
    for (const id of ids) await api(`/api/docs/${id}`, undefined, { method: 'DELETE' }).catch(() => {});
    stopSelecting();
    showToast(ids.length === 1 ? '휴지통으로 옮겼어요. 7일 안에 되살릴 수 있어요.' : `${ids.length}개를 휴지통으로 옮겼어요.`);
    void load();
  };

  const move = async (ids: string[], to: string | null) => {
    for (const id of ids) await api(`/api/docs/${id}`, { folderId: to }, { method: 'PATCH' }).catch(() => {});
    setMoving(null);
    stopSelecting();
    showToast(`${to ? folders.find((f) => f.id === to)?.name : '문서(맨 위)'}로 옮겼어요.`);
    void load();
  };

  const toggleFavorite = async (d: DocSummary) => {
    await api(`/api/docs/${d.id}`, { favorite: !d.favorite }, { method: 'PATCH' }).catch(() => {});
    showToast(d.favorite ? '즐겨찾기에서 뺐어요.' : '즐겨찾기에 넣었어요.');
    void load();
  };

  const docMenu = (d: DocSummary): MenuItem[] => [
    { label: d.favorite ? '즐겨찾기 빼기' : '즐겨찾기 추가', icon: <Star size={16} />, onClick: () => void toggleFavorite(d) },
    { label: '이름 바꾸기', icon: <Pencil size={16} />, onClick: () => setNaming({ kind: 'doc', doc: d }) },
    { label: '이동', icon: <FolderInput size={16} />, onClick: () => setMoving([d.id]) },
    { label: '삭제', icon: <Trash2 size={16} />, onClick: () => void remove([d.id]), danger: true },
  ];

  const folderMenu = (f: Folder): MenuItem[] => [
    { label: '이름 바꾸기', icon: <Pencil size={16} />, onClick: () => setNaming({ kind: 'folder', folder: f }) },
    {
      label: '폴더 삭제',
      icon: <Trash2 size={16} />,
      danger: true,
      onClick: async () => {
        if (!window.confirm(f.count ? `"${f.name}" 폴더를 지울까요? 안에 있는 문서 ${f.count}개는 휴지통으로 가요.` : `"${f.name}" 폴더를 지울까요?`)) return;
        await api(`/api/folders/${f.id}`, undefined, { method: 'DELETE' }).catch((e) => showToast(e.message));
        void load();
      },
    },
  ];

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
    ) : folderId ? (
      <span className="flex min-w-0 items-center gap-1">
        <IconButton onClick={() => navigate('/home')} aria-label="문서로 돌아가기" className="-ml-2 shrink-0">
          <ArrowLeft size={18} />
        </IconButton>
        <span className="truncate">{folder?.name ?? '폴더'}</span>
      </span>
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

  const missingFolder = folderId && docs !== null && !folder;

  return (
    <AppShell title={title} right={right}>
      {missingFolder ? (
        <EmptyState icon={<FolderClosed size={20} />} title="폴더를 찾을 수 없어요" sub="지워졌거나 주소가 바뀌었어요.">
          <Button onClick={() => navigate('/home')}>문서로 돌아가기</Button>
        </EmptyState>
      ) : (
        <>
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
                    inFolder={!!folderId}
                    folderQuery={folderQuery}
                    onPickDoc={() => docInput.current?.click()}
                    onPickImage={() => imgInput.current?.click()}
                    onYoutube={() => setYoutube(true)}
                    onFolder={() => setNaming({ kind: 'newFolder' })}
                  />
                )}
              </div>
            )}
            {docs === null
              ? Array.from({ length: 3 }, (_, i) => <div key={i} className="aspect-[16/9.4] animate-pulse rounded-xl bg-soft" />)
              : (
                <>
                  {shownFolders.map((f) => (
                    <FolderCard key={f.id} folder={f} dim={selecting} menu={folderMenu(f)} />
                  ))}
                  {shown.map((d) => (
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
                      menu={docMenu(d)}
                    />
                  ))}
                </>
              )}
          </div>

          {docs !== null && q && shown.length === 0 && <p className="px-6 py-16 text-center text-[15px] text-muted">"{query?.trim()}" 이름의 문서가 없어요.</p>}
          {docs !== null && !q && !folderId && mineAll.length === 0 && folders.length === 0 && (
            <div className="px-6 pb-16 pt-6 text-center md:pt-14">
              <div className="text-[22px] font-medium tracking-[-0.02em] md:text-[26px]">첫 공부 자료를 넣어 볼까요?</div>
              <p className="mx-auto mt-2 max-w-[340px] text-[15px] leading-[1.6] text-muted">PDF, 유튜브 링크, 메모 무엇이든 좋아요. 요약과 퀴즈는 AI가 만들어 둘게요.</p>
            </div>
          )}
          {docs !== null && !q && folderId && mine.length === 0 && (
            <p className="px-6 pb-16 pt-6 text-center text-[15px] leading-[1.6] text-muted">
              폴더가 비어 있어요.
              <br />
              새로 만들기로 바로 넣거나, 문서의 ⋮ 메뉴에서 이동을 골라 옮겨 보세요.
            </p>
          )}
        </>
      )}

      {selecting && (
        <div className="fixed inset-x-0 bottom-5 z-30 flex justify-center px-3">
          <div className="flex items-center rounded-full border border-line bg-canvas p-1 text-[15px] shadow-card">
            <button
              type="button"
              onClick={() => setSelected(selected.size === mine.length ? new Set() : new Set(mine.map((d) => d.id)))}
              className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3 hover:bg-soft"
            >
              <CheckCheck size={17} /> 전체 선택
            </button>
            <span className="h-5 w-px bg-line" />
            <button
              type="button"
              disabled={!selected.size}
              onClick={() => setMoving([...selected])}
              className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3 hover:bg-soft disabled:opacity-40"
            >
              <FolderInput size={17} /> 이동
            </button>
            <span className="h-5 w-px bg-line" />
            <button
              type="button"
              disabled={!selected.size}
              onClick={() => void remove([...selected])}
              className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-red hover:bg-soft disabled:opacity-40"
            >
              <Trash2 size={17} /> 삭제
            </button>
            <span className="h-5 w-px bg-line" />
            <button type="button" onClick={stopSelecting} className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3 hover:bg-soft">
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
          void run([f], folderId ? { folderId } : undefined);
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
          void run(files, folderId ? { folderId } : undefined);
        }}
      />
      <YoutubeModal open={youtube} onClose={() => setYoutube(false)} folderId={folderId} />
      <NameModal
        open={naming !== null}
        title={naming?.kind === 'doc' ? '이름 바꾸기' : naming?.kind === 'folder' ? '폴더 이름 바꾸기' : '새 폴더'}
        initial={naming?.kind === 'doc' ? naming.doc.title : naming?.kind === 'folder' ? naming.folder.name : ''}
        placeholder={naming?.kind === 'newFolder' ? '예: 중간고사 범위' : undefined}
        onClose={() => setNaming(null)}
        onSave={async (name) => {
          if (naming?.kind === 'doc') await api(`/api/docs/${naming.doc.id}`, { title: name }, { method: 'PATCH' });
          else if (naming?.kind === 'folder') await api(`/api/folders/${naming.folder.id}`, { name }, { method: 'PATCH' });
          else await api('/api/folders', { name });
          void load();
        }}
      />
      <MoveModal
        open={moving !== null}
        count={moving?.length ?? 0}
        folders={folders}
        current={moving?.length === 1 ? (docs?.find((d) => d.id === moving[0])?.folderId ?? null) : undefined}
        onClose={() => setMoving(null)}
        onMove={(to) => moving && void move(moving, to)}
      />
      <UploadProgress progress={progress} />
    </AppShell>
  );
}
