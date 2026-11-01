import React, { useEffect, useRef } from 'react';
import { api } from '../lib/api.ts';
import { useApp } from '../lib/app.tsx';
import { navigate } from '../lib/router.tsx';
import { AppShell } from '../components/AppShell.tsx';
import { useApiErrorHandler } from '../components/Modals.tsx';
import { Loading } from '../components/ui.tsx';

/**
 * /record: 원조처럼 누르자마자 '새 강의 녹음' 문서를 만들고 그 문서 화면으로 바로 넘어간다.
 * 녹음은 문서 화면 안(Recorder)에서 한다.
 */
export default function Record() {
  const { me, openLogin } = useApp();
  const onError = useApiErrorHandler();
  const started = useRef(false);

  useEffect(() => {
    if (!me || started.current) return;
    const create = async () => {
      started.current = true;
      try {
        const r = await api<{ id: string }>('/api/docs/recording', {});
        navigate(`/doc/${r.id}`, { replace: true });
      } catch (e) {
        onError(e);
        navigate('/home', { replace: true });
      }
    };
    if (me.user) void create();
    else {
      started.current = true;
      openLogin({ mode: 'signup', onDone: () => void create() });
    }
  }, [me, openLogin, onError]);

  return (
    <AppShell title="강의 녹음">
      <Loading label="녹음할 문서를 준비하고 있어요" />
    </AppShell>
  );
}
