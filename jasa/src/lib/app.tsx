import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Account, AppConfig } from '../types.ts';
import { api, setTokenGetter } from './api.ts';

interface AppState {
  config: AppConfig;
  /** 로컬 모드면 null */
  supabase: SupabaseClient | null;
  session: Session | null;
  account: Account | null;
  refreshAccount: () => void;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppProvider 안에서만 쓸 수 있어요');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .config()
      .then((cfg) => {
        setConfig(cfg);
        if (!cfg.auth) {
          setSessionReady(true);
          return;
        }
        const client = createClient(cfg.auth.url, cfg.auth.anonKey);
        setTokenGetter(async () => (await client.auth.getSession()).data.session?.access_token ?? null);
        client.auth.getSession().then(({ data }) => {
          setSession(data.session);
          setSessionReady(true);
        });
        client.auth.onAuthStateChange((_event, next) => setSession(next));
        setSupabase(client);
      })
      .catch(() => setError('서버에 연결할 수 없어요. 서버가 켜져 있는지 확인해 주세요.'));
  }, []);

  const loggedIn = !config?.auth || Boolean(session);
  const refreshAccount = useCallback(() => {
    if (!loggedIn) return setAccount(null);
    api.me().then(setAccount, () => setAccount(null));
  }, [loggedIn]);

  useEffect(() => {
    if (!sessionReady) return;
    refreshAccount();
    window.addEventListener('jasa:usage', refreshAccount);
    return () => window.removeEventListener('jasa:usage', refreshAccount);
  }, [sessionReady, refreshAccount, session?.user.id]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, [supabase]);

  if (error) return <FullScreen>{error}</FullScreen>;
  if (!config || !sessionReady) return <FullScreen>불러오는 중…</FullScreen>;

  return (
    <AppContext.Provider value={{ config, supabase, session, account, refreshAccount, signOut }}>
      {children}
    </AppContext.Provider>
  );
}

function FullScreen({ children }: { children: ReactNode }) {
  return <div className="grid min-h-dvh place-items-center p-6 text-center text-muted">{children}</div>;
}
