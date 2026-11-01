import React, { useEffect, useRef, useState } from 'react';
import { Copy } from 'lucide-react';
import { api } from '../lib/api.ts';
import { useApp } from '../lib/app.tsx';
import { Markdown } from '../lib/markdown.tsx';
import { ChatInputBar } from '../pages/AddContent.tsx';
import { useApiErrorHandler } from './Modals.tsx';
import { Spinner } from './ui.tsx';

interface Msg {
  id: number | string;
  role: 'user' | 'model';
  content: string;
}

export function ChatView({
  chatId,
  ensureChat,
  suggestions,
  emptyTitle = '궁금한 걸 물어보세요',
  initialQuestion,
  onRef,
  compact = false,
}: {
  chatId: string | null;
  ensureChat: () => Promise<string | null>;
  suggestions: string[];
  emptyTitle?: string;
  initialQuestion?: string | null;
  onRef?: (r: string) => void;
  compact?: boolean;
}) {
  const { me, showToast, setMe, config } = useApp();
  const onError = useApiErrorHandler();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!chatId);
  const endRef = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    api<{ messages: Msg[] }>(`/api/chats/${chatId}`)
      .then((r) => setMessages(r.messages))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [chatId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, busy]);

  const send = async (text: string) => {
    const id = chatId ?? (await ensureChat());
    if (!id) return;
    const tmp = `t${Date.now()}`;
    setMessages((m) => [...m, { id: tmp, role: 'user', content: text }]);
    setBusy(true);
    try {
      const r = await api<{ reply: string; usage: any }>(`/api/chats/${id}/messages`, { message: text });
      setMessages((m) => [...m, { id: tmp + 'r', role: 'model', content: r.reply }]);
      if (me && r.usage) setMe({ ...me, usage: r.usage });
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== tmp));
      onError(e, () => void send(text));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (initialQuestion && !asked.current && !loading) {
      asked.current = true;
      void send(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion, loading]);

  const empty = messages.length === 0 && !busy;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {empty && !loading ? (
        <div className={`flex flex-1 flex-col items-center justify-center px-4 ${compact ? 'pb-10' : 'pb-24'}`}>
          <h2 className="text-[26px] font-medium tracking-tight">{emptyTitle}</h2>
          <div className="mt-6 w-full max-w-[720px]">
            <ChatInputBar onSubmit={(t) => void send(t)} busy={busy} autoFocus={!compact} />
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => void send(s)} className="rounded-full border border-line px-4 py-2.5 text-[14px] text-sub hover:bg-soft hover:text-ink">
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[760px] space-y-6 px-4 pb-6 pt-4">
              {loading && (
                <div className="flex justify-center py-10">
                  <Spinner />
                </div>
              )}
              {messages.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[80%] whitespace-pre-wrap rounded-[22px] bg-soft px-4 py-2.5 text-[15px] leading-[1.6]">{m.content}</div>
                  </div>
                ) : (
                  <div key={m.id} className="group">
                    <Markdown text={m.content} onRef={onRef} size="sm" />
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText(m.content).then(() => showToast('복사했어요.'))}
                      className="mt-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted opacity-0 hover:bg-soft group-hover:opacity-100"
                      aria-label="복사"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                ),
              )}
              {busy && (
                <div className="flex items-center gap-2 text-[14px] text-muted">
                  <Spinner className="h-4 w-4" /> 생각하는 중
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>
          <div className="mx-auto w-full max-w-[760px] px-4 pb-4">
            <ChatInputBar onSubmit={(t) => void send(t)} busy={busy} />
            {me?.usage && !me.sub?.pro && (
              <div className="mt-2 text-center text-[12px] text-muted">오늘 무료 질문 {Math.max(0, (config?.free.dailyTutor ?? 10) - me.usage.tutorToday)}개 남음</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
