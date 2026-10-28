import type { ReactNode } from 'react';
import type { Analysis, Draft, DraftContext } from '../../types.ts';

export function TabTitle({ title, desc, action }: { title: string; desc: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="font-serif text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="mt-1.5 text-muted">{desc}</p>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-pine-soft text-pine">{icon}</div>
      <p className="mt-4 font-bold">{title}</p>
      {children && <div className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{children}</div>}
    </div>
  );
}

export function errorText(e: unknown) {
  return e instanceof Error ? e.message : '문제가 생겼어요. 다시 시도해 주세요.';
}

/** 원고에 연결된 분석이 있으면 그 회사·직무·분석 내용을 함께 AI에 넘김 */
export function draftContext(draft: Draft, analyses: Analysis[]): DraftContext {
  const a = analyses.find((x) => x.id === draft.analysisId);
  return {
    company: a?.company ?? '',
    role: a?.role ?? '',
    question: draft.question,
    charLimit: draft.charLimit,
    report: a?.report ?? '',
  };
}
