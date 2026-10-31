import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.ts';
import { useApp } from '../lib/app.tsx';
import { track } from '../lib/pixel.ts';
import { Button, Sheet, Spinner } from './ui.tsx';

export function AuthSheet() {
  const { auth, closeAuth, openAuth, refreshMe } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setError('');
  }, [auth?.mode]);

  if (!auth) return null;
  const signup = auth.mode === 'signup';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (signup) {
        const res = await api<{ eventId: string }>('/api/auth/signup', { email, password, agree });
        track('CompleteRegistration', {}, res.eventId);
      } else {
        await api('/api/auth/login', { email, password });
      }
      await refreshMe();
      const done = auth.onDone;
      closeAuth();
      setPassword('');
      done?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const input = 'h-14 w-full rounded-2xl bg-field px-4 text-[17px] text-ink outline-none ring-primary placeholder:text-muted focus:ring-2';

  return (
    <Sheet open onClose={closeAuth}>
      <form onSubmit={submit} className="space-y-3">
        <h2 className="mb-1 text-[22px] font-bold tracking-tight">{signup ? '이메일로 시작하기' : '로그인'}</h2>
        <p className="pb-2 text-[15px] text-muted">{signup ? '풀이와 상담 기록을 계정에 저장해 둡니다.' : '가입한 이메일로 로그인하세요.'}</p>
        <input
          className={input}
          type="email"
          autoComplete="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className={input}
          type="password"
          autoComplete={signup ? 'new-password' : 'current-password'}
          placeholder={signup ? '비밀번호 (8자 이상)' : '비밀번호'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={signup ? 8 : undefined}
          required
        />
        {signup && (
          <label className="flex items-start gap-3 py-2 text-[14px] leading-[1.5] text-sub">
            <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[#3182f6]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>
              <a href="/terms" target="_blank" className="underline">
                이용약관
              </a>
              과{' '}
              <a href="/privacy" target="_blank" className="underline">
                개인정보 수집 및 이용
              </a>
              에 동의합니다. (필수)
            </span>
          </label>
        )}
        {error && <p className="text-[14px] text-danger">{error}</p>}
        <Button type="submit" disabled={busy || (signup && !agree)}>
          {busy ? <Spinner /> : signup ? '가입하고 계속하기' : '로그인'}
        </Button>
        <button
          type="button"
          className="w-full py-3 text-[15px] text-muted"
          onClick={() => openAuth({ ...auth, mode: signup ? 'login' : 'signup' })}
        >
          {signup ? '이미 계정이 있어요' : '처음이에요, 가입할게요'}
        </button>
      </form>
    </Sheet>
  );
}
