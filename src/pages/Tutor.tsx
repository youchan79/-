import React, { useEffect, useState } from 'react';
import { History, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api.ts';
import { useApp } from '../lib/app.tsx';
import { navigate } from '../lib/router.tsx';
import { AppShell } from '../components/AppShell.tsx';
import { ChatView } from '../components/ChatView.tsx';
import { IconButton } from '../components/ui.tsx';

interface ChatItem {
  id: string;
  title: string;
  updatedAt: string;
}

export default function Tutor({ id, search }: { id: string | null; search: string }) {
  const { me, openLogin } = useApp();
  const [list, setList] = useState<ChatItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const q = new URLSearchParams(search).get('q');

  const loadList = () => {
    if (me?.user) api<{ chats: ChatItem[] }>('/api/chats').then((r) => setList(r.chats)).catch(() => {});
  };
  useEffect(loadList, [me?.user, id]);

  const ensureChat = async () => {
    if (!me?.user) {
      openLogin({ mode: 'signup' });
      return null;
    }
    const r = await api<{ id: string }>('/api/chats', {});
    history.replaceState(null, '', `/aichat/${r.id}`);
    return r.id;
  };

  return (
    <AppShell
      title="AI 튜터"
      right={
        <div className="relative flex items-center gap-1">
          {me?.user && list.length > 0 && (
            <IconButton onClick={() => setHistoryOpen((o) => !o)} aria-label="대화 기록">
              <History size={19} />
            </IconButton>
          )}
          <IconButton onClick={() => navigate('/aichat')} aria-label="새 대화">
            <Plus size={20} />
          </IconButton>
          {historyOpen && (
            <div className="absolute right-0 top-11 z-30 max-h-[420px] w-72 overflow-y-auto rounded-2xl border border-line bg-canvas p-1.5 shadow-card" onMouseLeave={() => setHistoryOpen(false)}>
              {list.map((c) => (
                <div key={c.id} className="group flex items-center rounded-lg hover:bg-soft">
                  <button
                    type="button"
                    className={`min-w-0 flex-1 truncate px-3 py-2 text-left text-[14px] ${c.id === id ? 'font-semibold' : ''}`}
                    onClick={() => {
                      setHistoryOpen(false);
                      navigate(`/aichat/${c.id}`);
                    }}
                  >
                    {c.title}
                  </button>
                  <button
                    type="button"
                    className="mr-1 hidden h-7 w-7 items-center justify-center rounded-md text-muted hover:text-red group-hover:flex"
                    onClick={async () => {
                      await api(`/api/chats/${c.id}`, undefined, { method: 'DELETE' });
                      if (c.id === id) navigate('/aichat');
                      loadList();
                    }}
                    aria-label="삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      }
    >
      <ChatView
        key={id ?? `new${q ?? ''}`}
        chatId={id}
        ensureChat={ensureChat}
        initialQuestion={id ? null : q}
        suggestions={['이 글 자연스럽게 다듬어줘', '보고서 초안 써줘', '최신 정보 검색해서 알려줘']}
      />
    </AppShell>
  );
}
