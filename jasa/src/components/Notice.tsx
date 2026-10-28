import { AlertCircle, Info } from 'lucide-react';
import type { ReactNode } from 'react';

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-sun-soft px-3.5 py-2.5 text-sm text-ink/80">
      <Info size={16} className="mt-0.5 shrink-0 text-ink/60" />
      <span>{children}</span>
    </p>
  );
}

export function Spinner() {
  return <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />;
}
