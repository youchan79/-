import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, type AppConfig, type Me } from './api.ts';
import { initPixel, track } from './pixel.ts';

// 카카오·네이버 로그인은 페이지를 다녀오므로 결과를 주소로 받는다: 처음 가입이면 ?reg=eventId, 실패면 ?login_error=코드.
// 화면이 그려지기 전에 주소에서 지우고, 한 번만 쓴다.
const LOGIN_ERRORS: Record<string, string> = {
  state: '로그인 시간이 지났어요. 다시 시도해 주세요.',
  cancelled: '로그인을 취소했어요.',
  email_taken: '이미 이 이메일로 가입된 계정이 있어요. 처음 가입한 방법으로 로그인해 주세요.',
  failed: '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.',
};
let loginResult: { reg: string | null; error: string | null } | null = (() => {
  const q = new URLSearchParams(location.search);
  const reg = q.get('reg');
  const error = q.get('login_error');
  if (!reg && !error) return null;
  q.delete('reg');
  q.delete('login_error');
  const rest = q.toString();
  history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : '') + location.hash);
  return { reg, error };
})();

type Theme = 'system' | 'light' | 'dark';

interface LoginRequest {
  mode: 'login' | 'signup';
  onDone?: () => void;
}

interface AppState {
  config: AppConfig | null;
  me: Me | null;
  refreshMe: () => Promise<Me>;
  setMe: (m: Me) => void;
  login: LoginRequest | null;
  openLogin: (req?: Partial<LoginRequest>) => void;
  closeLogin: () => void;
  upgrade: string | null;
  openUpgrade: (message: string) => void;
  closeUpgrade: () => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  toast: string | null;
  showToast: (msg: string) => void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppProvider 없음');
  return v;
}

function readTheme(): Theme {
  try {
    const t = localStorage.getItem('theme');
    if (t === 'light' || t === 'dark' || t === 'system') return t;
  } catch {
    /* 저장소를 못 쓰는 환경 */
  }
  return 'system';
}

function applyTheme(t: Theme) {
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [login, setLogin] = useState<LoginRequest | null>(null);
  const [upgrade, setUpgrade] = useState<string | null>(null);
  const [theme, setThemeState] = useState<Theme>(readTheme);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>(undefined);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  const refreshMe = useCallback(async () => {
    const m = await api<Me>('/api/me');
    setMe(m);
    return m;
  }, []);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = () => applyTheme('system');
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [theme]);

  useEffect(() => {
    api<AppConfig>('/api/config').then((c) => {
      setConfig(c);
      initPixel(c.pixelId);
    });
    refreshMe().catch(() => setMe({ user: null, sub: null, usage: null, settings: {} }));
    if (loginResult) {
      // 픽셀은 설정을 받기 전이면 이벤트를 모아 두었다가 보낸다
      if (loginResult.reg && /^reg_usr_[\w-]+$/.test(loginResult.reg)) track('CompleteRegistration', {}, loginResult.reg);
      if (loginResult.error) showToast(LOGIN_ERRORS[loginResult.error] ?? LOGIN_ERRORS.failed);
      loginResult = null;
    }
    try {
      if (!sessionStorage.getItem('visit')) {
        sessionStorage.setItem('visit', '1');
        void api('/api/track', { name: 'visit' }).catch(() => {});
      }
    } catch {
      /* 무시 */
    }
  }, [refreshMe]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem('theme', t);
    } catch {
      /* 무시 */
    }
  }, []);

  return (
    <Ctx.Provider
      value={{
        config,
        me,
        refreshMe,
        setMe,
        login,
        openLogin: (req) => setLogin({ mode: req?.mode ?? 'login', onDone: req?.onDone }),
        closeLogin: () => setLogin(null),
        upgrade,
        openUpgrade: setUpgrade,
        closeUpgrade: () => setUpgrade(null),
        theme,
        setTheme,
        toast,
        showToast,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

/** 로그인이 필요한 동작을 감싼다. 로그인돼 있으면 바로, 아니면 로그인 후 실행한다. */
export function useRequireLogin() {
  const { me, openLogin } = useApp();
  return useCallback(
    (fn: () => void) => {
      if (me?.user) fn();
      else openLogin({ mode: 'signup', onDone: fn });
    },
    [me, openLogin],
  );
}
