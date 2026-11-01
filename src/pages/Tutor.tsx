import React from 'react';
import { Plus } from 'lucide-react';
import { api } from '../lib/api.ts';
import { useApp } from '../lib/app.tsx';
import { navigate } from '../lib/router.tsx';
import { AppShell } from '../components/AppShell.tsx';
import { ChatView } from '../components/ChatView.tsx';
import { IconButton } from '../components/ui.tsx';

export default function Tutor({ id, search }: { id: string | null; search: string }) {
  const { me, openLogin } = useApp();
  const q = new URLSearchParams(search).get('q');
  const name = me?.user?.name;

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
        <IconButton onClick={() => navigate('/aichat')} aria-label="새 대화">
          <Plus size={20} />
        </IconButton>
      }
    >
      <ChatView
        key={id ?? `new${q ?? ''}`}
        chatId={id}
        ensureChat={ensureChat}
        initialQuestion={id ? null : q}
        emptyTitle={name ? `${name}님, 오늘은 뭘 같이 볼까요?` : '오늘은 뭘 같이 볼까요?'}
        suggestions={['이 개념 쉽게 풀어서 설명해줘', '발표 대본 뼈대 잡아줘', '오늘 배운 내용으로 문제 내줘']}
      />
    </AppShell>
  );
}
