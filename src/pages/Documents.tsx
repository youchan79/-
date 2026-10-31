import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, FileText, Image as ImageIcon, MoreHorizontal, NotebookPen, Play, Plus, Trash2 } from 'lucide-react';
import { api, formatDuration, KIND_LABEL, type DocSummary } from '../lib/api.ts';
import { useApp } from '../lib/app.tsx';
import { Link, navigate } from '../lib/router.tsx';
import { AppShell } from '../components/AppShell.tsx';
import { Spinner } from '../components/ui.tsx';

const KIND_COLOR: Record<string, string> = {
  pdf: 'text-blue',
  docx: 'text-blue',
  pptx: 'text-[#d9541e]',
  youtube: 'text-red',
  audio: 'text-teal',
  image: 'text-[#7a5af8]',
  memo: 'text-green',
};

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
        {doc.error || '처리하지 못했어요'}
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
  const Icon = doc.kind === 'image' ? ImageIcon : doc.kind === 'memo' ? NotebookPen : FileText;
  return (
    <div className="flex h-full flex-col gap-2 p-4 text-left">
      <Icon size={18} className="text-muted" />
      <div className="line-clamp-3 text-[12px] font-medium leading-[1.5] text-sub">{doc.title}</div>
      <div className="space-y-1.5 pt-1">
        <div className="h-1.5 w-full rounded bg-soft-2" />
        <div className="h-1.5 w-4/5 rounded bg-soft-2" />
        <div className="h-1.5 w-3/5 rounded bg-soft-2" />
      </div>
    </div>
  );
}

function DocCard({ doc, onDelete }: { doc: DocSummary; onDelete: () => void }) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="group relative">
      <Link to={`/doc/${doc.id}`} className="block">
        <div className="aspect-[16/9.4] overflow-hidden rounded-xl border border-line bg-soft">
          <Thumb doc={doc} />
        </div>
        <div className="mt-2 truncate pr-6 text-[15px] font-medium">{doc.title}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[13px]">
          <span className={KIND_COLOR[doc.kind]}>{KIND_LABEL[doc.kind]}</span>
          {doc.isSample && (
            <>
              <span className="text-muted">·</span>
              <span className="text-muted">샘플</span>
            </>
          )}
          {!doc.isSample && doc.kind === 'youtube' && doc.durationSec ? <span className="text-muted">· {formatDuration(doc.durationSec)}</span> : null}
        </div>
      </Link>
      {!doc.isSample && (
        <div className="absolute bottom-6 right-0">
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted opacity-0 transition hover:bg-soft group-hover:opacity-100 max-md:opacity-100"
            aria-label="더보기"
          >
            <MoreHorizontal size={16} />
          </button>
          {menu && (
            <div className="absolute right-0 top-8 z-10 w-36 rounded-xl border border-line bg-canvas p-1 shadow-card" onMouseLeave={() => setMenu(false)}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[14px] text-red hover:bg-soft"
                onClick={() => {
                  setMenu(false);
                  onDelete();
                }}
              >
                <Trash2 size={15} /> 삭제
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Documents() {
  const { me, showToast } = useApp();
  const [docs, setDocs] = useState<DocSummary[] | null>(null);

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

  return (
    <AppShell title="문서">
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 px-3 pb-10 pt-1 sm:grid-cols-3 md:px-6 lg:grid-cols-4 xl:grid-cols-5">
        <button
          type="button"
          onClick={() => navigate('/add-content')}
          className="flex aspect-[16/9.4] flex-col items-center justify-center gap-2 rounded-xl border border-line bg-soft text-[14px] text-sub transition hover:bg-soft-2 sm:row-span-1"
        >
          <Plus size={22} strokeWidth={1.6} className="text-ink" />
          새로 만들기
        </button>
        {docs === null
          ? Array.from({ length: 3 }, (_, i) => <div key={i} className="aspect-[16/9.4] animate-pulse rounded-xl bg-soft" />)
          : docs.map((d) => (
              <DocCard
                key={d.id}
                doc={d}
                onDelete={async () => {
                  if (!window.confirm(`"${d.title}" 문서를 삭제할까요? 만든 학습 자료도 함께 지워져요.`)) return;
                  await api(`/api/docs/${d.id}`, undefined, { method: 'DELETE' });
                  void load();
                }}
              />
            ))}
      </div>
    </AppShell>
  );
}
