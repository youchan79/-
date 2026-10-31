import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { api, won, type Me } from '../lib/api.ts';
import { useApp } from '../lib/app.tsx';
import { track } from '../lib/pixel.ts';
import { navigate } from '../lib/router.tsx';
import { Button, Logo, Modal, Spinner } from './ui.tsx';

export function LoginModal() {
  const { login, closeLogin, openLogin, setMe } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setError(''), [login?.mode]);
  if (!login) return null;
  const signup = login.mode === 'signup';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api<Me & { eventId?: string }>(signup ? '/api/auth/signup' : '/api/auth/login', { email, password, agree });
      if (signup && res.eventId) track('CompleteRegistration', {}, res.eventId);
      setMe(res);
      const done = login.onDone;
      closeLogin();
      setPassword('');
      done?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const input = 'h-12 w-full rounded-xl border border-line bg-canvas px-4 text-[15px] outline-none placeholder:text-muted focus:border-ink';

  return (
    <Modal open onClose={closeLogin} width={420}>
      <div className="flex flex-col items-center pb-2 pt-3 text-center">
        <Logo className="text-[28px]" />
        <h2 className="mt-4 text-[20px] font-semibold">{signup ? '나만의 학습 공간을 만드세요' : '다시 오신 걸 환영해요'}</h2>
        <p className="mt-1.5 text-[14px] text-muted">로그인하면 만든 자료가 저장되고, 어디서나 이어서 공부할 수 있어요</p>
      </div>
      <form onSubmit={submit} className="mt-5 space-y-3">
        <input className={input} type="email" autoComplete="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          className={input}
          type="password"
          autoComplete={signup ? 'new-password' : 'current-password'}
          placeholder={signup ? '비밀번호 (8자 이상)' : '비밀번호'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {signup && (
          <label className="flex items-start gap-2.5 py-1 text-[13px] leading-[1.5] text-sub">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-current" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>
              <a href="/terms" target="_blank" className="underline">
                이용약관
              </a>
              과{' '}
              <a href="/privacy" target="_blank" className="underline">
                개인정보 수집 및 이용
              </a>
              에 동의합니다 (필수)
            </span>
          </label>
        )}
        {error && <p className="text-[13px] text-red">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={busy || (signup && !agree)}>
          {busy ? <Spinner className="h-4 w-4" /> : signup ? '가입하고 시작하기' : '로그인'}
        </Button>
      </form>
      <button type="button" className="mt-3 w-full py-2 text-[14px] text-muted hover:text-ink" onClick={() => openLogin({ mode: signup ? 'login' : 'signup', onDone: login.onDone })}>
        {signup ? '이미 계정이 있어요' : '처음이에요, 가입할게요'}
      </button>
    </Modal>
  );
}

export const PRO_FEATURES = [
  'PDF·유튜브 무제한 업로드 분석',
  '요약·퀴즈·플래시카드 등 학습 자료 6종 무제한 생성',
  'AI 튜터 무제한 질문',
  '긴 강의 녹음 파일도 1GB까지 업로드',
  '모든 학습 자료 클라우드 자동 백업',
];

export function UpgradeModal() {
  const { upgrade, closeUpgrade, config } = useApp();
  if (!upgrade) return null;
  return (
    <Modal open onClose={closeUpgrade} width={440} className="!p-0">
      <div className="gradient-pro rounded-t-[24px] px-6 pb-6 pt-8 text-[#111]">
        <div className="text-[15px]">Pro 플랜</div>
        <div className="mt-1 text-[30px] font-semibold tracking-tight">
          {config ? won(config.plans.monthly.price) : ''}
          <span className="ml-1 text-[14px] font-normal">/월</span>
        </div>
      </div>
      <div className="p-6">
        <p className="text-[15px] font-medium">{upgrade}</p>
        <ul className="mt-4 space-y-2.5">
          {PRO_FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2.5 text-[14px] text-sub">
              <Check size={16} className="shrink-0 text-ink" />
              {f}
            </li>
          ))}
        </ul>
        <Button
          size="lg"
          className="mt-6 w-full"
          onClick={() => {
            closeUpgrade();
            navigate('/subscription');
          }}
        >
          무제한으로 시작하기
        </Button>
        <p className="mt-2 text-center text-[12px] text-muted">언제든 해지할 수 있어요</p>
      </div>
    </Modal>
  );
}

/** API 오류를 받아 한도 초과면 업그레이드 창, 로그인 필요면 로그인 창, 그 밖엔 토스트를 띄운다. */
export function useApiErrorHandler() {
  const { openUpgrade, openLogin, showToast } = useApp();
  return (e: any, retry?: () => void) => {
    if (e?.status === 402) openUpgrade(e.message);
    else if (e?.status === 401) openLogin({ mode: 'signup', onDone: retry });
    else showToast(e?.message || '일시적인 오류가 발생했어요.');
  };
}
