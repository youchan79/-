import React, { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.ts';
import { useApp } from '../lib/app.tsx';
import { Link, navigate } from '../lib/router.tsx';
import { Button, Card, Page, Spinner } from '../components/ui.tsx';

interface Msg {
  id: number | string;
  role: 'user' | 'model';
  content: string;
}

const SUGGESTIONS = ['올해 이직해도 괜찮을까요?', '저랑 잘 맞는 사람은 어떤 사람인가요?', '돈은 언제쯤 모이나요?', '요즘 왜 이렇게 지칠까요?'];

export default function Chat({ id }: { id: string }) {
  const { me, openAuth, showToast } = useApp();
  const [name, setName] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [access, setAccess] = useState(true);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (me && !me.user) {
      openAuth({ mode: 'login' });
      return;
    }
    if (!me?.user) return;
    api(`/api/readings/${id}/chat`)
      .then((r) => {
        setName(r.name);
        setMessages(r.messages);
        setRemaining(r.remaining);
        setAccess(r.access);
        setLoaded(true);
      })
      .catch((e) => showToast(e.message));
  }, [id, me, openAuth, showToast]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, busy]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setInput('');
    setBusy(true);
    const tempId = 'tmp' + Date.now();
    setMessages((m) => [...m, { id: tempId, role: 'user', content: message }]);
    try {
      const r = await api<{ reply: string; remaining: number }>(`/api/readings/${id}/chat`, { message });
      setMessages((m) => [...m, { id: tempId + 'r', role: 'model', content: r.reply }]);
      setRemaining(r.remaining);
    } catch (e: any) {
      setMessages((m) => m.filter((x) => x.id !== tempId));
      setInput(message);
      showToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 bg-bg/95 px-2 backdrop-blur">
        <Link to={`/r/${id}`} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-black/5" >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-label="뒤로">
            <path d="M15 5l-7 7 7 7" stroke="#191f28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div className="text-[17px] font-bold tracking-tight">{name ? `${name}님 사주 상담` : '사주 상담'}</div>
      </header>

      {!loaded ? (
        <div className="flex justify-center py-20 text-primary">{me?.user && <Spinner />}</div>
      ) : !access ? (
        <div className="px-4">
          <Card>
            <p className="mb-4 text-[16px] text-sub">구독 중일 때 상담을 이용할 수 있어요.</p>
            <Button onClick={() => navigate(`/r/${id}`)}>구독하러 가기</Button>
          </Card>
        </div>
      ) : (
        <>
          <div className="space-y-3 px-4 pb-40 pt-2">
            {messages.length === 0 && (
              <Card>
                <p className="text-[16px] leading-[1.6] text-sub">{name}님의 사주를 바탕으로 답해 드려요. 이렇게 물어볼 수 있어요.</p>
                <div className="mt-4 flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => void send(s)} className="rounded-2xl bg-field px-4 py-3 text-left text-[15px] text-ink active:bg-line">
                      {s}
                    </button>
                  ))}
                </div>
              </Card>
            )}
            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[80%] whitespace-pre-wrap rounded-[20px] rounded-br-md bg-primary px-4 py-3 text-[16px] leading-[1.55] text-white">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="max-w-[92%] whitespace-pre-wrap rounded-[20px] rounded-bl-md bg-card px-4 py-3.5 text-[16px] leading-[1.7] text-ink">
                  {m.content.replace(/\*\*/g, '')}
                </div>
              ),
            )}
            {busy && (
              <div className="inline-flex items-center gap-2 rounded-[20px] bg-card px-4 py-3 text-[15px] text-muted">
                <Spinner className="h-4 w-4 text-primary" />
                사주를 보고 있어요
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="fixed inset-x-0 bottom-0 z-30 bg-bg">
            <div className="mx-auto w-full max-w-[480px] px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
              {remaining !== null && <div className="pb-2 text-center text-[13px] text-muted">오늘 남은 질문 {remaining}개</div>}
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(input);
                }}
              >
                <textarea
                  rows={1}
                  value={input}
                  maxLength={500}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="궁금한 것을 물어보세요"
                  className="max-h-32 min-h-12 flex-1 resize-none rounded-2xl bg-card px-4 py-3 text-[16px] leading-[1.5] outline-none ring-primary placeholder:text-muted focus:ring-2"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim() || remaining === 0}
                  className="h-12 shrink-0 rounded-2xl bg-primary px-5 text-[16px] font-semibold text-white disabled:bg-primary/40"
                >
                  보내기
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </Page>
  );
}
