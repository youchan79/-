import { useEffect, useState, type FormEvent } from 'react';
import { BRAND } from '../brand.ts';
import { Logo } from '../components/Logo.tsx';
import { ErrorNote, InfoNote, Spinner } from '../components/Notice.tsx';
import { useApp } from '../lib/app.tsx';
import { navigate } from '../lib/router.ts';

function nextPath() {
  const next = new URLSearchParams(location.search).get('next') ?? '/app';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/app';
}

export function Login() {
  const { supabase, session } = useApp();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    // 로컬 모드이거나 이미 로그인했으면 작업실로
    if (!supabase || session) navigate(nextPath(), true);
  }, [supabase, session]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError('');
    const { data, error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/app` } });
    setBusy(false);
    if (error) return setError(translate(error.message));
    if (mode === 'signup' && !data.session) setSent(true);
  }

  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10">
      <Logo />
      <div className="card mt-8 w-full max-w-sm p-6">
        <h1 className="font-serif text-2xl font-bold">{mode === 'signin' ? '다시 오셨네요' : `${BRAND.name} 시작하기`}</h1>
        <p className="mt-1 text-sm text-muted">작성한 경험과 원고는 계정에 안전하게 저장돼요.</p>
        {sent ? (
          <div className="mt-6">
            <InfoNote>
              {email} 로 확인 메일을 보냈어요. 메일의 링크를 누르면 바로 시작할 수 있어요.
            </InfoNote>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">이메일</label>
              <input id="email" type="email" required autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="password">비밀번호</label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <ErrorNote>{error}</ErrorNote>
            <button className="btn-primary w-full py-3" disabled={busy}>
              {busy && <Spinner />} {mode === 'signin' ? '로그인' : '가입하기'}
            </button>
          </form>
        )}
        <p className="mt-5 text-center text-sm text-muted">
          {mode === 'signin' ? '처음이신가요?' : '이미 계정이 있나요?'}{' '}
          <button
            className="font-semibold text-pine underline-offset-2 hover:underline"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError('');
              setSent(false);
            }}
          >
            {mode === 'signin' ? '가입하기' : '로그인'}
          </button>
        </p>
      </div>
    </div>
  );
}

function translate(message: string) {
  if (/invalid login credentials/i.test(message)) return '이메일 또는 비밀번호가 맞지 않아요.';
  if (/already registered/i.test(message)) return '이미 가입된 이메일이에요. 로그인해 주세요.';
  if (/email not confirmed/i.test(message)) return '메일함에서 가입 확인 링크를 먼저 눌러 주세요.';
  if (/password should be at least/i.test(message)) return '비밀번호는 6자 이상이어야 해요.';
  return message;
}
