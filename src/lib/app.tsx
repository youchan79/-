import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, ApiError, type AppConfig, type Me } from './api.ts';
import { initPixel, track } from './pixel.ts';
import { openCheckout, type CheckoutParams } from './toss.ts';

interface AuthRequest {
  mode: 'signup' | 'login';
  onDone?: () => void;
}

interface AppState {
  config: AppConfig | null;
  me: Me | null;
  refreshMe: () => Promise<Me>;
  auth: AuthRequest | null;
  openAuth: (req: AuthRequest) => void;
  closeAuth: () => void;
  startCheckout: (readingId?: string) => Promise<void>;
  checkoutBusy: boolean;
  toast: string | null;
  showToast: (msg: string) => void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppProvider 없음');
  return v;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [auth, setAuth] = useState<AuthRequest | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const toastTimer = useRef<number>(undefined);
  const meRef = useRef<Me | null>(null);
  meRef.current = me;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  const refreshMe = useCallback(async () => {
    const m = await api<Me>('/api/me');
    meRef.current = m;
    setMe(m);
    return m;
  }, []);

  useEffect(() => {
    api<AppConfig>('/api/config').then((c) => {
      setConfig(c);
      initPixel(c.pixelId);
    });
    refreshMe().catch(() => setMe({ user: null, subscription: null }));
    try {
      if (!sessionStorage.getItem('visit')) {
        sessionStorage.setItem('visit', '1');
        void api('/api/track', { name: 'visit' }).catch(() => {});
      }
    } catch {
      /* 저장소를 못 쓰는 브라우저 */
    }
  }, [refreshMe]);

  const startCheckout = useCallback(
    async (readingId?: string) => {
      if (!meRef.current?.user) {
        setAuth({ mode: 'signup', onDone: () => void startCheckout(readingId) });
        return;
      }
      setCheckoutBusy(true);
      try {
        const params = await api<CheckoutParams>('/api/checkout/start', { readingId });
        track('InitiateCheckout', { value: params.amount, currency: 'KRW', content_name: params.orderName });
        await openCheckout(params);
      } catch (e: any) {
        if (e instanceof ApiError && e.status === 401) {
          setAuth({ mode: 'signup', onDone: () => void startCheckout(readingId) });
        } else if (e?.code !== 'USER_CANCEL') {
          showToast(e?.message || '결제를 시작하지 못했습니다.');
        }
      } finally {
        setCheckoutBusy(false);
      }
    },
    [showToast],
  );

  return (
    <Ctx.Provider
      value={{
        config,
        me,
        refreshMe,
        auth,
        openAuth: setAuth,
        closeAuth: () => setAuth(null),
        startCheckout,
        checkoutBusy,
        toast,
        showToast,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
