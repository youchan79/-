import React, { useCallback, useEffect, useState } from 'react';
import { MoreVertical, RotateCcw, Trash2 } from 'lucide-react';
import { api, KIND_LABEL, type DocSummary } from '../lib/api.ts';
import { useApp } from '../lib/app.tsx';
import { AppShell } from '../components/AppShell.tsx';
import { Button, EmptyState, IconButton, Spinner } from '../components/ui.tsx';
import { Thumb } from './Documents.tsx';

type Trashed = DocSummary & { deletedAt: string; purgeAt: string };

/** 완전히 지워지기까지 남은 날 (오늘 지워지면 0) */
function daysLeft(purgeAt: string) {
  return Math.max(0, Math.ceil((new Date(purgeAt).getTime() - Date.now()) / 86400_000));
}

function TrashCard({ doc, onRestore, onPurge }: { doc: Trashed; onRestore: () => void; onPurge: () => void }) {
  const [menu, setMenu] = useState(false);
  const left = daysLeft(doc.purgeAt);
  return (
    <div className="relative">
      <div className="aspect-[16/9.4] overflow-hidden rounded-xl border border-line bg-soft opacity-80">
        <Thumb doc={doc} />
      </div>
      <div className="mt-2 truncate pr-8 text-[15px] font-medium">{doc.title}</div>
      <div className="mt-0.5 flex items-center gap-1.5 truncate pr-8 text-[13px]">
        <span className="text-muted">{KIND_LABEL[doc.kind]}</span>
        <span className={left <= 1 ? 'text-red' : 'text-muted'}>{left === 0 ? '오늘 완전 삭제' : `${left}일 뒤 완전 삭제`}</span>
      </div>
      <div className="absolute bottom-1.5 right-0">
        <IconButton onClick={() => setMenu((m) => !m)} className="h-8 w-8" aria-label="더보기">
          <MoreVertical size={17} />
        </IconButton>
        {menu && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setMenu(false)} />
            <div className="absolute right-0 top-9 z-30 w-44 rounded-xl border border-line bg-canvas p-1 shadow-card">
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[15px] hover:bg-soft"
                onClick={() => {
                  setMenu(false);
                  onRestore();
                }}
              >
                <RotateCcw size={16} /> 되살리기
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[15px] text-red hover:bg-soft"
                onClick={() => {
                  setMenu(false);
                  onPurge();
                }}
              >
                <Trash2 size={16} /> 완전히 지우기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Trash() {
  const { me, showToast, openLogin } = useApp();
  const [docs, setDocs] = useState<Trashed[] | null>(null);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!me?.user) return setDocs([]);
    try {
      const r = await api<{ days: number; docs: Trashed[] }>('/api/trash');
      setDays(r.days);
      setDocs(r.docs);
    } catch (e: any) {
      showToast(e.message);
      setDocs([]);
    }
  }, [me?.user, showToast]);

  useEffect(() => {
    if (me) void load();
  }, [me, load]);

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      showToast(done);
      await load();
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      title="휴지통"
      right={
        docs && docs.length > 0 ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            className="!text-red"
            onClick={() => {
              if (!window.confirm(`휴지통의 문서 ${docs.length}개를 완전히 지울까요? 되살릴 수 없어요.`)) return;
              void act(() => api('/api/trash', undefined, { method: 'DELETE' }), '휴지통을 비웠어요.');
            }}
          >
            휴지통 비우기
          </Button>
        ) : null
      }
    >
      <div className="px-3 pb-10 pt-1 md:px-6">
        <p className="mb-4 rounded-xl bg-soft px-4 py-3 text-[14px] leading-[1.6] text-sub">지운 문서는 여기에 {days}일 동안 있다가 완전히 지워져요. 그 전에는 되살릴 수 있어요.</p>
        {!me?.user && me ? (
          <EmptyState icon={<Trash2 size={20} />} title="로그인하면 휴지통을 볼 수 있어요">
            <Button onClick={() => openLogin()}>로그인</Button>
          </EmptyState>
        ) : docs === null ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-6 w-6" />
          </div>
        ) : docs.length === 0 ? (
          <EmptyState icon={<Trash2 size={20} />} title="휴지통이 비어 있어요" sub="문서를 지우면 여기로 와요." />
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {docs.map((d) => (
              <TrashCard
                key={d.id}
                doc={d}
                onRestore={() => void act(() => api(`/api/trash/${d.id}/restore`, {}), '문서를 되살렸어요.')}
                onPurge={() => {
                  if (!window.confirm(`"${d.title}" 문서를 완전히 지울까요? 만든 학습 자료와 튜터 대화도 함께 지워지고 되살릴 수 없어요.`)) return;
                  void act(() => api(`/api/trash/${d.id}`, undefined, { method: 'DELETE' }), '완전히 지웠어요.');
                }}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
