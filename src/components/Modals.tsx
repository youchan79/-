import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { api, won, type Me } from '../lib/api.ts';
import { useApp } from '../lib/app.tsx';
import { track } from '../lib/pixel.ts';
import { navigate } from '../lib/router.tsx';
import { forgetLoginHint, readLoginHint, type HintProvider, type LoginHint } from '../lib/loginHint.ts';
import { Button, Logo, Modal, Spinner } from './ui.tsx';

declare global {
  interface Window {
    google?: any;
    Kakao?: any;
  }
}

const GOOGLE_SDK = 'https://accounts.google.com/gsi/client';
// 카카오 JavaScript SDK 공식 CDN. integrity는 카카오 공식 파일(2.8.4)의 sha384 값이다. 버전을 바꾸면 같이 바꾼다.
const KAKAO_SDK = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.4/kakao.min.js';
const KAKAO_SDK_SRI = 'sha384-BGX7Wb16GmRFagri4bLJV2DgipVZaU2AI812GZtHtHzzDQJnfHasDXN5houxv45w';

const scriptLoads: Record<string, Promise<void>> = {};
function loadScript(src: string, integrity?: string): Promise<void> {
  scriptLoads[src] ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    if (integrity) {
      s.integrity = integrity;
      s.crossOrigin = 'anonymous';
    }
    s.onload = () => resolve();
    s.onerror = () => {
      delete scriptLoads[src];
      reject(new Error('로그인 도구를 불러오지 못했어요.'));
    };
    document.head.appendChild(s);
  });
  return scriptLoads[src];
}

// 구글 버튼과 One Tap은 한 설정을 같이 쓴다. initialize는 페이지에서 한 번만 하고, 결과는 지금 콜백으로 보낸다.
let googleCallback: (credential: string) => void = () => {};
let googleInitFor: string | null = null;
function initGoogle(clientId: string, autoSelect: boolean) {
  if (googleInitFor === clientId) return;
  googleInitFor = clientId;
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (r: { credential: string }) => googleCallback(r.credential),
    ux_mode: 'popup',
    context: 'signin',
    // 전에 동의한 구글 계정이 이 브라우저에 하나면 누르지 않아도 다시 로그인된다 (구글 공식 자동 로그인)
    auto_select: autoSelect,
    button_auto_select: autoSelect,
    use_fedcm_for_prompt: true,
    use_fedcm_for_button: true,
  });
}

/** 구글 공식 'G' 마크 (구글 브랜드 가이드의 4색) */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** 카카오 말풍선 심볼 (카카오 디자인 가이드: 검정 심볼, 노랑 #FEE500 바탕) */
function KakaoMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#000"
        d="M9 1.5C4.58 1.5 1 4.32 1 7.8c0 2.25 1.5 4.22 3.75 5.33l-.96 3.5c-.08.3.26.55.53.37l4.15-2.75c.17.01.35.02.53.02 4.42 0 8-2.82 8-6.3S13.42 1.5 9 1.5z"
      />
    </svg>
  );
}

/** 네이버 N 로고 (네이버 가이드: 흰 N, 초록 #03C75A 바탕) */
function NaverMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden>
      <path fill="#fff" d="M13.56 10.7 6.17 0H0v20h6.44V9.3L13.83 20H20V0h-6.44z" />
    </svg>
  );
}

type SocialKind = 'kakao' | 'naver' | 'google';
const SOCIAL: Record<SocialKind, { label: string; mark: React.ReactNode; className: string }> = {
  kakao: { label: '카카오로 계속하기', mark: <KakaoMark />, className: 'border-[#FEE500] bg-[#FEE500] text-black/85 hover:brightness-95' },
  naver: { label: '네이버로 계속하기', mark: <NaverMark />, className: 'border-[#03C75A] bg-[#03C75A] text-white hover:brightness-95' },
  google: { label: 'Google로 계속하기', mark: <GoogleMark />, className: 'border-[#dadce0] bg-white text-[#1f1f1f] hover:bg-[#f7f8f8]' },
};

function SocialButton({ kind, onClick, disabled }: { kind: SocialKind; onClick: () => void; disabled?: boolean }) {
  const s = SOCIAL[kind];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-10 w-full items-center justify-center gap-2.5 rounded-full border text-[15px] font-medium transition disabled:opacity-50 ${s.className}`}
    >
      {s.mark}
      {s.label}
    </button>
  );
}

/** 구글 ID 토큰 방식은 구글이 직접 그려 주는 공식 버튼으로만 열 수 있다. 흰색 둥근 모양으로 맞춘다. */
function GoogleOfficialButton({ clientId, autoSelect }: { clientId: string; autoSelect: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    loadScript(GOOGLE_SDK)
      .then(() => {
        const el = ref.current;
        if (!alive || !el || !window.google) return;
        initGoogle(clientId, autoSelect);
        window.google.accounts.id.renderButton(el, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          logo_alignment: 'center',
          locale: 'ko',
          width: Math.min(400, el.offsetWidth),
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [clientId]);
  return <div ref={ref} className="flex h-10 w-full justify-center" />;
}

const PROVIDER_NAME: Record<HintProvider, string> = { kakao: '카카오', naver: '네이버', google: 'Google', email: '이메일' };

// 끝나면 지금 보던 화면으로 돌아온다 (첫 화면이면 /home)
const hereForReturn = () => (location.pathname === '/' ? '/home' : location.pathname + location.search);

export function LoginModal() {
  const { login, closeLogin, openLogin, setMe, config, me, showToast } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [socialError, setSocialError] = useState('');
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<LoginHint | null>(readLoginHint);
  const kakaoPrep = useRef<{ state: string; redirectUri: string; at: number } | null>(null);
  const auth = config?.auth;
  const loggedOut = !!me && !me.user;
  const googleOn = !!auth?.google && !auth.mock;
  const open = !!login;

  const finish = (res: Me & { eventId?: string }) => {
    // eventId는 처음 가입했을 때만 온다 (재로그인에는 없음)
    if (res.eventId) track('CompleteRegistration', {}, res.eventId);
    setMe(res);
    const done = login?.onDone;
    closeLogin();
    setPassword('');
    setHint(readLoginHint());
    done?.();
  };

  const social = async (run: () => Promise<Me & { eventId?: string }>) => {
    setBusy(true);
    setSocialError('');
    try {
      finish(await run());
    } catch (err: any) {
      const msg = err?.message || '로그인하지 못했어요. 다시 시도해 주세요.';
      if (login) setSocialError(msg);
      else showToast(msg); // 창 없이 구글 One Tap으로 들어온 경우
    } finally {
      setBusy(false);
    }
  };

  // 구글 버튼과 One Tap 결과는 모두 여기로 온다
  googleCallback = (credential) => void social(() => api('/api/auth/google', { credential }));

  useEffect(() => {
    setError('');
    setSocialError('');
  }, [login?.mode]);

  // 창이 열릴 때 힌트를 다시 읽는다 (방금 로그아웃했을 수 있다)
  useEffect(() => {
    if (open) setHint(readLoginHint());
  }, [open]);

  // 구글 One Tap: 로그아웃 상태에서 로그인 창을 열었거나, 이 기기에서 지난번에 구글로 들어왔으면 띄운다.
  // 직접 로그아웃한 뒤에는 자동 로그인을 끈다 (안 그러면 로그아웃하자마자 다시 로그인된다).
  useEffect(() => {
    if (!googleOn || !loggedOut) return;
    const h = readLoginHint();
    if (!open && h?.p !== 'google') return;
    loadScript(GOOGLE_SDK)
      .then(() => {
        initGoogle(auth!.google!, h?.p === 'google' && !h.out);
        if (h?.out) window.google.accounts.id.disableAutoSelect();
        window.google.accounts.id.prompt();
      })
      .catch(() => {});
  }, [googleOn, loggedOut, open, auth]);

  // 카카오 JavaScript SDK: 창이 열리면 SDK와 state를 미리 준비한다. 누르는 순간 바로 카카오톡 앱으로 넘어가게.
  useEffect(() => {
    if (!open || !auth?.kakaoJsKey) return;
    kakaoPrep.current = null;
    loadScript(KAKAO_SDK, KAKAO_SDK_SRI)
      .then(() => {
        if (!window.Kakao.isInitialized()) window.Kakao.init(auth.kakaoJsKey);
      })
      .catch(() => {});
    api<{ state: string; redirectUri: string }>('/api/auth/kakao/prepare', { next: hereForReturn() })
      .then((r) => (kakaoPrep.current = { ...r, at: Date.now() }))
      .catch(() => {});
  }, [open, auth]);

  if (!login) return null;
  const signup = login.mode === 'signup';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      finish(await api<Me & { eventId?: string }>(signup ? '/api/auth/signup' : '/api/auth/login', { email, password, agree }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // 개발용 가짜 구글 (서버가 SOCIAL_LOGIN_MOCK=1일 때만): 아래 이메일 칸의 주소로 들어간다
  const mockGoogle = () =>
    social(async () => {
      const { token } = await api<{ token: string }>('/api/auth/mock-token', { email: email.trim() || 'test@gmail.com' });
      return api('/api/auth/google', { credential: token });
    });

  // 카카오·네이버 웹 로그인 화면을 다녀온다 (네이버는 폰에서 '네이버 앱으로 자동로그인' 버튼이 같이 나온다)
  const startOauth = (p: 'kakao' | 'naver') => {
    location.href = `/api/auth/${p}/start?next=${encodeURIComponent(hereForReturn())}`;
  };

  // 카카오: SDK가 준비됐으면 폰에서 카카오톡 앱으로 간편 로그인(throughTalk 기본값), 없으면 카카오 웹 로그인
  const startKakao = () => {
    const prep = kakaoPrep.current;
    if (prep && window.Kakao?.isInitialized?.() && Date.now() - prep.at < 8 * 60_000) {
      window.Kakao.Auth.authorize({ redirectUri: prep.redirectUri, state: prep.state });
    } else startOauth('kakao');
  };

  // '다른 계정으로 로그인': 이 기기의 힌트를 지우고 구글 자동 선택도 끈다
  const switchAccount = () => {
    forgetLoginHint();
    setHint(null);
    window.google?.accounts.id.disableAutoSelect();
  };

  const enabled = (['kakao', 'naver', 'google'] as const).filter((p) => !!auth?.[p]);
  const recent = hint && hint.p !== 'email' && enabled.includes(hint.p) ? hint.p : null;
  const ordered = recent ? [recent, ...enabled.filter((p) => p !== recent)] : enabled;
  const hasSocial = enabled.length > 0;
  const input = 'h-12 w-full rounded-xl border border-line bg-canvas px-4 text-[15px] outline-none placeholder:text-muted focus:border-ink';

  return (
    <Modal open onClose={closeLogin} width={420}>
      <div className="flex flex-col items-center pb-2 pt-3 text-center">
        <Logo className="text-[28px]" />
        <h2 className="mt-4 text-[20px] font-semibold">{signup ? '나만의 학습 공간을 만드세요' : '다시 오신 걸 환영해요'}</h2>
        <p className="mt-1.5 text-[14px] text-muted">로그인하면 만든 자료가 저장되고, 어디서나 이어서 공부할 수 있어요</p>
      </div>
      {hasSocial && (
        <>
          <div className="mt-5 space-y-2.5">
            {ordered.map((p) => (
              <div key={p} className="relative">
                {p === 'google' && !auth!.mock ? (
                  <GoogleOfficialButton clientId={auth!.google!} autoSelect={hint?.p === 'google' && !hint.out} />
                ) : (
                  <SocialButton kind={p} disabled={busy} onClick={p === 'kakao' ? startKakao : p === 'naver' ? () => startOauth('naver') : mockGoogle} />
                )}
                {p === recent && (
                  <span className="pointer-events-none absolute -top-2.5 right-4 z-10 rounded-full bg-solid px-2 py-0.5 text-[13px] font-semibold leading-[1.4] text-on-solid">
                    최근에 사용
                  </span>
                )}
              </div>
            ))}
            {hint && (
              <p className="text-center text-[14px] text-muted">
                최근 로그인: {PROVIDER_NAME[hint.p]} {hint.m} ·{' '}
                <button type="button" className="underline hover:text-ink" onClick={switchAccount}>
                  다른 계정으로 로그인
                </button>
              </p>
            )}
            {socialError && <p className="text-center text-[14px] text-red">{socialError}</p>}
            <p className="pt-0.5 text-center text-[14px] leading-[1.5] text-muted">
              계속하면{' '}
              <a href="/terms" target="_blank" className="underline">
                이용약관
              </a>
              과{' '}
              <a href="/privacy" target="_blank" className="underline">
                개인정보 수집 및 이용
              </a>
              에 동의하게 돼요
            </p>
            {auth!.mock && <p className="text-center text-[14px] text-blue">개발 모드: 가짜 로그인이에요 (구글은 아래 이메일 칸 주소로)</p>}
          </div>
          <div className="my-5 flex items-center gap-3 text-[14px] text-muted">
            <span className="h-px flex-1 bg-line" />
            또는
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}
      <form onSubmit={submit} className={hasSocial ? 'space-y-3' : 'mt-5 space-y-3'}>
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
        <div className="text-[15px]">Pro 평생 이용권</div>
        <div className="mt-1 text-[30px] font-semibold tracking-tight">
          {config ? won(config.plans.lifetime.price) : ''}
          <span className="ml-1 text-[14px] font-normal">/ 평생</span>
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
          한 번 결제로 평생 무제한
        </Button>
        <p className="mt-2 text-center text-[12px] text-muted">자동 결제 없이 딱 한 번만 결제해요</p>
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
