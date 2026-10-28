import { CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Header } from '../components/Header.tsx';
import { Link } from '../components/Link.tsx';
import { Spinner } from '../components/Notice.tsx';
import { api } from '../lib/api.ts';
import { useApp } from '../lib/app.tsx';

export function PaySuccess() {
  const { session, refreshAccount } = useApp();
  const [state, setState] = useState<{ status: 'working' | 'done' | 'error'; message?: string; until?: string }>({ status: 'working' });
  const started = useRef(false);

  useEffect(() => {
    if (!session || started.current) return;
    started.current = true;
    const q = new URLSearchParams(location.search);
    api
      .confirm({ paymentKey: q.get('paymentKey') ?? '', orderId: q.get('orderId') ?? '', amount: Number(q.get('amount')) })
      .then((account) => {
        setState({ status: 'done', until: account.proUntil ?? undefined });
        refreshAccount();
      })
      .catch((e: Error) => setState({ status: 'error', message: e.message }));
  }, [session, refreshAccount]);

  return (
    <Result>
      {!session ? (
        <p className="text-muted">결제를 마무리하려면 로그인이 필요해요.</p>
      ) : state.status === 'working' ? (
        <p className="flex items-center gap-2 text-muted">
          <Spinner /> 결제를 확인하고 있어요…
        </p>
      ) : state.status === 'done' ? (
        <>
          <CheckCircle2 size={44} className="text-pine" />
          <h1 className="mt-3 font-serif text-2xl font-bold">프로가 되었어요</h1>
          {state.until && <p className="mt-1 text-muted">{new Date(state.until).toLocaleDateString('ko-KR')}까지 제한 없이 쓰세요.</p>}
          <Link to="/app" className="btn-primary mt-6">작업실로 가기</Link>
        </>
      ) : (
        <Failed message={state.message} />
      )}
    </Result>
  );
}

export function PayFail() {
  const message = new URLSearchParams(location.search).get('message') ?? undefined;
  return (
    <Result>
      <Failed message={message} />
    </Result>
  );
}

function Failed({ message }: { message?: string }) {
  return (
    <>
      <XCircle size={44} className="text-danger" />
      <h1 className="mt-3 font-serif text-2xl font-bold">결제가 완료되지 않았어요</h1>
      <p className="mt-1 text-muted">{message ?? '다시 시도해 주세요.'} 승인되지 않은 결제는 청구되지 않아요.</p>
      <Link to="/pricing" className="btn-ghost mt-6">요금제로 돌아가기</Link>
    </>
  );
}

function Result({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <Header />
      <main className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">{children}</main>
    </div>
  );
}
