import React, { useState } from 'react';
import { api } from '../lib/api.ts';
import { navigate } from '../lib/router.tsx';
import { AppShell } from '../components/AppShell.tsx';
import { useApiErrorHandler } from '../components/Modals.tsx';
import { Button, Spinner } from '../components/ui.tsx';

export default function MemoNew() {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const onError = useApiErrorHandler();

  const save = async () => {
    setBusy(true);
    try {
      // 폴더 안에서 '새 메모'를 누르면 그 폴더에 넣는다
      const folderId = new URLSearchParams(location.search).get('folder');
      const r = await api<{ id: string }>('/api/docs/memo', { title, text, folderId });
      navigate(`/doc/${r.id}`);
    } catch (e) {
      onError(e);
      setBusy(false);
    }
  };

  return (
    <AppShell
      title="새 메모"
      right={
        <Button size="sm" disabled={busy || text.trim().length < 20} onClick={() => void save()}>
          {busy ? <Spinner className="h-4 w-4" /> : '저장하고 정리하기'}
        </Button>
      }
    >
      <div className="mx-auto w-full max-w-[760px] px-4 pb-10 pt-6 md:px-8">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목"
          className="w-full bg-transparent text-[26px] font-semibold tracking-tight outline-none placeholder:text-muted/60"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="수업 중에 적은 내용, 교수님이 강조한 부분, 외울 것들을 자유롭게 적어 주세요. 저장하면 요약과 퀴즈를 만들어 드려요."
          className="mt-4 min-h-[60dvh] w-full resize-none bg-transparent text-[16px] leading-[1.8] outline-none placeholder:text-muted/70"
        />
        <div className="text-right text-[13px] text-muted">{text.length.toLocaleString()}자</div>
      </div>
    </AppShell>
  );
}
