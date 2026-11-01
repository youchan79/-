import React, { useRef, useState } from 'react';
import { ArrowRight, ArrowUp, ClipboardList, FileUp, ImageUp, Mic, Plus, SquarePen, Youtube } from 'lucide-react';
import { api } from '../lib/api.ts';
import { useApp, useRequireLogin } from '../lib/app.tsx';
import { navigate } from '../lib/router.tsx';
import { DOC_ACCEPT, IMAGE_ACCEPT, uploadFiles } from '../lib/upload.ts';
import { AppShell } from '../components/AppShell.tsx';
import { useApiErrorHandler } from '../components/Modals.tsx';
import { Button, Modal, NewBadge, Spinner } from '../components/ui.tsx';

export function UploadProgress({ progress, label }: { progress: number | null; label?: string }) {
  if (progress === null) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-[360px] rounded-[22px] bg-canvas p-6 text-center shadow-xl">
        <Spinner className="h-6 w-6" />
        <div className="mt-3 text-[16px] font-medium">{label ?? (progress < 1 ? '자료를 올리는 중' : 'AI가 자료를 읽기 시작했어요')}</div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-soft-2">
          <div className="h-full rounded-full bg-solid transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}

export function useUploader() {
  const onError = useApiErrorHandler();
  const [progress, setProgress] = useState<number | null>(null);
  const run = async (files: File[], extra?: Record<string, string>) => {
    if (!files.length) return;
    setProgress(0);
    try {
      const id = await uploadFiles(files, extra, setProgress);
      navigate(`/doc/${id}`);
    } catch (e) {
      onError(e);
    } finally {
      setProgress(null);
    }
  };
  return { progress, run };
}

export function YoutubeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { config } = useApp();
  const [url, setUrl] = useState('');
  const [script, setScript] = useState('');
  const [busy, setBusy] = useState(false);
  const onError = useApiErrorHandler();
  const needScript = !config?.media.youtubeAuto;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ id: string }>('/api/docs/youtube', { url, transcript: script });
      onClose();
      setUrl('');
      setScript('');
      navigate(`/doc/${r.id}`);
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-soft">
        <Youtube size={20} />
      </div>
      <h2 className="mt-4 text-[20px] font-semibold">YouTube 영상</h2>
      <p className="mt-1 text-[14px] text-muted">
        {needScript ? '영상 링크와 자막(스크립트)을 붙여 넣으면 AI가 정리해요.' : '강의 영상 링크를 붙여 넣으면 AI가 내용을 받아 적고 정리해요.'}
      </p>
      <form onSubmit={submit} className="mt-5 space-y-3">
        <input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className="h-12 w-full rounded-xl border border-line bg-canvas px-4 text-[15px] outline-none focus:border-ink"
        />
        <div>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            rows={5}
            placeholder={needScript ? '자막(스크립트)을 붙여 넣어 주세요' : '자막(스크립트)이 있으면 붙여 넣어 주세요 (선택)'}
            className="w-full resize-none rounded-xl border border-line bg-canvas p-4 text-[14px] leading-[1.6] outline-none focus:border-ink"
          />
          <p className="mt-1.5 text-[12px] leading-[1.6] text-muted">
            유튜브 영상 아래 설명란의 <b className="font-medium text-sub">스크립트 표시</b>를 누른 뒤 스크립트 전체를 드래그해 복사하면 돼요. 시간 표시도 그대로 붙여 넣으세요.
          </p>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={busy || !url.trim() || (needScript && script.trim().length < 20)}>
          {busy ? <Spinner className="h-4 w-4" /> : '추가하기'}
        </Button>
      </form>
    </Modal>
  );
}

export function ChatInputBar({ placeholder = '궁금한 걸 편하게 물어보세요', onSubmit, busy, autoFocus }: { placeholder?: string; onSubmit: (text: string) => void; busy?: boolean; autoFocus?: boolean }) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const send = () => {
    const t = text.trim();
    if (!t || busy) return;
    onSubmit(t);
    setText('');
  };
  return (
    <div className="flex items-end gap-2 rounded-[28px] border border-line bg-canvas py-2 pl-3 pr-2 shadow-card">
      <button type="button" className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sub hover:bg-soft" onClick={() => navigate('/add-content')} aria-label="자료 추가">
        <Plus size={20} />
      </button>
      <textarea
        ref={ref}
        rows={1}
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          e.target.style.height = 'auto';
          e.target.style.height = Math.min(160, e.target.scrollHeight) + 'px';
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
        placeholder={placeholder}
        className="max-h-40 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-[1.5] outline-none placeholder:text-muted"
      />
      <button
        type="button"
        onClick={send}
        disabled={!text.trim() || busy}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-solid text-on-solid disabled:bg-muted/50"
        aria-label="보내기"
      >
        {busy ? <Spinner className="h-4 w-4" /> : <ArrowUp size={18} />}
      </button>
    </div>
  );
}

function Tile({ icon, title, sub, badge, onClick }: { icon: React.ReactNode; title: string; sub: string; badge?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="relative flex flex-col rounded-2xl bg-soft p-4 text-left transition hover:bg-soft-2">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-canvas/70 dark:bg-soft-2">{icon}</span>
      {badge && (
        <span className="absolute right-3 top-3">
          <NewBadge />
        </span>
      )}
      <span className="mt-6 text-[15px] font-semibold">{title}</span>
      <span className="mt-1.5 text-[13px] leading-[1.55] text-muted">{sub}</span>
    </button>
  );
}

export default function AddContent() {
  const requireLogin = useRequireLogin();
  const { showToast, me } = useApp();
  const name = me?.user?.name;
  const docInput = useRef<HTMLInputElement>(null);
  const imgInput = useRef<HTMLInputElement>(null);
  const [youtube, setYoutube] = useState(false);
  const [drag, setDrag] = useState(false);
  const { progress, run } = useUploader();

  const pick = (input: React.RefObject<HTMLInputElement | null>) => requireLogin(() => input.current?.click());

  return (
    <AppShell title="">
      <div
        className="relative flex min-h-full flex-col"
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const files = [...e.dataTransfer.files];
          requireLogin(() => void run(files.slice(0, files[0]?.type.startsWith('image/') ? 10 : 1)));
        }}
      >
        <div className="mx-auto w-full max-w-[680px] flex-1 px-4 pb-8 pt-10 md:pt-[110px]">
          <h1 className="text-center text-[26px] font-medium leading-[1.35] tracking-[-0.03em] md:text-[32px]">{name ? `${name}님, 오늘은 무엇을 정리할까요?` : '오늘은 무엇을 정리할까요?'}</h1>
          <p className="mt-2 text-center text-[15px] text-muted">필기 정리는 AI에게 넘기고, 이해하는 데 시간을 쓰세요.</p>

          <button type="button" onClick={() => pick(docInput)} className="mt-8 flex w-full items-center gap-4 rounded-2xl bg-soft p-5 text-left transition hover:bg-soft-2">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-canvas/70 dark:bg-soft-2">
              <FileUp size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold">수업 자료 올리기</span>
              <span className="mt-1 block text-[14px] text-muted">PDF·PPT·Word를 올리면 요약과 퀴즈가 바로 나와요</span>
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-solid text-on-solid">
              <ArrowRight size={18} />
            </span>
          </button>

          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile icon={<Mic size={19} />} title="강의 녹음" sub="녹음만 켜 두면 받아 적고 정리까지 해요" badge onClick={() => requireLogin(() => navigate('/record'))} />
            <Tile icon={<Youtube size={19} />} title="YouTube 영상" sub="강의 영상 주소만 붙여 넣어요" onClick={() => requireLogin(() => setYoutube(true))} />
            <Tile icon={<ImageUp size={19} />} title="사진 올리기" sub="칠판·필기·교재 사진을 그대로 올려요" onClick={() => pick(imgInput)} />
            <Tile icon={<SquarePen size={19} />} title="새 메모" sub="메모를 남기면 요약·퀴즈로 바꿔 드려요" onClick={() => requireLogin(() => navigate('/memo/new'))} />
          </div>

          <button type="button" onClick={() => navigate('/exam')} className="mt-3 flex w-full items-center gap-4 rounded-2xl bg-soft p-4 text-left transition hover:bg-soft-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-canvas/70 dark:bg-soft-2">
              <ClipboardList size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">시험 문제 만들기</span>
              <span className="mt-1 block text-[13px] text-muted">자료 여러 개를 묶어 실제 시험처럼 풀어 봐요</span>
            </span>
            <ArrowRight size={18} className="text-muted" />
          </button>
        </div>

        <div className="sticky bottom-0 mx-auto w-full max-w-[680px] px-4 pb-5">
          <ChatInputBar onSubmit={(t) => requireLogin(() => navigate(`/aichat?q=${encodeURIComponent(t)}`))} />
        </div>

        {drag && (
          <div className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-3xl border-2 border-dashed border-ink/40 bg-canvas/80 text-[17px] font-medium">
            여기에 놓으면 바로 올라가요
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
            if (/\.(ppt|doc)$/i.test(f.name)) return showToast('예전 형식(ppt, doc)은 지원하지 않아요. pptx, docx 또는 PDF로 저장해서 올려 주세요.');
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
        <UploadProgress progress={progress} />
      </div>
    </AppShell>
  );
}
