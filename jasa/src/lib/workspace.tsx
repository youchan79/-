import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Workspace } from '../types.ts';
import { useApp } from './app.tsx';

const LOCAL_KEY = 'jasa:workspace';
const EMPTY: Workspace = { experiences: [], analyses: [], drafts: [] };

type SaveState = 'saved' | 'saving' | 'error';

interface WorkspaceState {
  ws: Workspace;
  update: (fn: (ws: Workspace) => Workspace) => void;
  saveState: SaveState;
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('WorkspaceProvider 안에서만 쓸 수 있어요');
  return ctx;
}

function normalize(data: unknown): Workspace {
  const d = (data ?? {}) as Partial<Workspace>;
  return { experiences: d.experiences ?? [], analyses: d.analyses ?? [], drafts: d.drafts ?? [] };
}

/** 로컬 모드: 이 브라우저(localStorage)에 저장. 로그인 모드: Supabase에 계정별로 저장 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { supabase, session } = useApp();
  const userId = session?.user.id ?? null;
  const [ws, setWs] = useState<Workspace | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const loadedFor = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setWs(null);
    (async () => {
      let data: Workspace = EMPTY;
      if (supabase && userId) {
        const { data: row } = await supabase.from('workspaces').select('data').eq('user_id', userId).maybeSingle();
        data = normalize(row?.data);
      } else {
        try {
          data = normalize(JSON.parse(localStorage.getItem(LOCAL_KEY) ?? 'null'));
        } catch {
          data = EMPTY;
        }
      }
      if (cancelled) return;
      loadedFor.current = userId;
      setWs(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  // 바뀐 뒤 잠깐 기다렸다가 한 번에 저장
  useEffect(() => {
    if (!ws || loadedFor.current !== userId) return;
    setSaveState('saving');
    const timer = setTimeout(async () => {
      try {
        if (supabase && userId) {
          const { error } = await supabase
            .from('workspaces')
            .upsert({ user_id: userId, data: ws, updated_at: new Date().toISOString() });
          if (error) throw error;
        } else {
          localStorage.setItem(LOCAL_KEY, JSON.stringify(ws));
        }
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [ws, supabase, userId]);

  const update = useCallback((fn: (ws: Workspace) => Workspace) => {
    setWs((prev) => (prev ? fn(prev) : prev));
  }, []);

  if (!ws) return <div className="grid min-h-[50dvh] place-items-center text-muted">작업 공간을 불러오는 중…</div>;
  return <WorkspaceContext.Provider value={{ ws, update, saveState }}>{children}</WorkspaceContext.Provider>;
}
