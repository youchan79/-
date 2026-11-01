import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, type MaterialKind } from './api.ts';
import { useApp } from './app.tsx';

/**
 * 학습 자료를 읽어 올 주소의 앞부분. 보통은 /api/docs/{id}, 공유 링크 화면에서는 /api/share/{토큰}.
 * 같은 탭 화면(요약·퀴즈 등)을 공유 화면에서 그대로 쓰려고 둔다.
 */
export const DocApiBase = createContext<string | null>(null);
export function useDocApi(docId: string) {
  return useContext(DocApiBase) ?? `/api/docs/${docId}`;
}

/** 학습 자료 하나를 불러오고, 만드는 중이면 다 될 때까지 다시 확인한다. */
export function useMaterial<T>(docId: string, kind: MaterialKind, enabled = true) {
  const base = useDocApi(docId);
  const [state, setState] = useState<{ status: string; data: T | null; error: string | null }>({ status: 'loading', data: null, error: null });
  const load = useCallback(async () => {
    try {
      const r = await api<{ status: string; json: T | null; error: string | null }>(`${base}/materials/${kind}`);
      setState({ status: r.status, data: r.json, error: r.error });
    } catch (e: any) {
      setState({ status: 'error', data: null, error: e.message });
    }
  }, [base, kind]);
  useEffect(() => {
    if (enabled) void load();
  }, [load, enabled]);
  useEffect(() => {
    if (!enabled || !['generating', 'none', 'processing', 'loading'].includes(state.status) || state.status === 'loading') return;
    const t = window.setInterval(() => void load(), 1800);
    return () => window.clearInterval(t);
  }, [state.status, load, enabled]);
  return { ...state, reload: load };
}

/** 사용자별 진행 상태. 로그인하면 서버에, 아니면 이 브라우저에 저장한다. */
export function useProgress<T>(key: string, initial: T) {
  const { me } = useApp();
  const loggedIn = !!me?.user;
  const [data, setData] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<number>(undefined);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    (async () => {
      let v: T | null = null;
      if (loggedIn) {
        try {
          v = (await api<{ data: T | null }>(`/api/progress/${encodeURIComponent(key)}`)).data;
        } catch {
          /* 무시 */
        }
      } else {
        try {
          const raw = localStorage.getItem(`progress:${key}`);
          v = raw ? JSON.parse(raw) : null;
        } catch {
          /* 무시 */
        }
      }
      if (!cancelled) {
        setData(v ?? initial);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, loggedIn]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setData((prev) => {
        const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          if (loggedIn) void api(`/api/progress/${encodeURIComponent(key)}`, { data: v }, { method: 'PUT' }).catch(() => {});
          else {
            try {
              localStorage.setItem(`progress:${key}`, JSON.stringify(v));
            } catch {
              /* 무시 */
            }
          }
        }, 400);
        return v;
      });
    },
    [key, loggedIn],
  );

  return [data, update, loaded] as const;
}

export function usePoll(fn: () => void, active: boolean, ms = 2000) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => ref.current(), ms);
    return () => window.clearInterval(t);
  }, [active, ms]);
}
