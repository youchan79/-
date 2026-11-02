import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../lib/app.tsx';

/** 스터디AI 마크: 둥근 사각형 안의 S와 반짝임 */
export function LogoMark({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="1" y="1" width="22" height="22" rx="6.5" fill="var(--c-solid)" />
      <path
        d="M15.2 8.6c-.8-.8-1.9-1.2-3.1-1.2-1.8 0-3 .9-3 2.2 0 1.4 1.2 1.9 3 2.4 1.9.5 3.2 1.1 3.2 2.6 0 1.4-1.3 2.4-3.2 2.4-1.4 0-2.7-.5-3.6-1.4"
        fill="none"
        stroke="var(--c-on-solid)"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path d="M18 3.9l.55 1.35 1.35.55-1.35.55L18 7.7l-.55-1.35-1.35-.55 1.35-.55z" fill="var(--c-on-solid)" />
    </svg>
  );
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex select-none items-center gap-1.5 text-[22px] font-bold tracking-[-0.05em] ${className}`}>
      <LogoMark size={26} />
      StudyAI
    </span>
  );
}

type Variant = 'solid' | 'outline' | 'soft' | 'ghost';

const VARIANT: Record<Variant, string> = {
  solid: 'bg-solid text-on-solid hover:opacity-90 disabled:opacity-40',
  outline: 'border border-line bg-canvas text-ink hover:bg-soft disabled:opacity-40',
  soft: 'bg-soft text-ink hover:bg-soft-2 disabled:opacity-40',
  ghost: 'text-sub hover:bg-soft disabled:opacity-40',
};

export function Button({
  children,
  variant = 'solid',
  size = 'md',
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'h-9 px-4 text-[14px]', md: 'h-11 px-5 text-[15px]', lg: 'h-[52px] px-7 text-[16px]' }[size];
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition ${s} ${VARIANT[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function IconButton({ children, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sub transition hover:bg-soft hover:text-ink disabled:opacity-30 ${className}`}
    >
      {children}
    </button>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <span className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} />;
}

export function NewBadge() {
  return <span className="rounded-full border border-blue/30 bg-blue-soft px-2 py-[1px] text-[11px] font-semibold text-blue">NEW</span>;
}

export function Modal({
  open,
  onClose,
  children,
  width = 440,
  className = '',
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        className={`relative max-h-[92dvh] w-full overflow-y-auto rounded-[24px] border border-line bg-canvas p-6 shadow-xl ${className}`}
        style={{ maxWidth: width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <IconButton onClick={onClose} className="absolute right-3 top-3" aria-label="닫기">
          <X size={20} />
        </IconButton>
        {children}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T;
  options: Array<[T, React.ReactNode]>;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`inline-flex rounded-full bg-soft p-1 ${className}`}>
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`h-8 rounded-full px-4 text-[14px] transition ${value === v ? 'bg-canvas font-medium text-ink shadow-card' : 'text-muted hover:text-ink'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-5 z-[70] flex justify-center px-4">
      <div className="max-w-[460px] rounded-full bg-solid px-5 py-3 text-[14px] text-on-solid shadow-lg">{toast}</div>
    </div>
  );
}

export function EmptyState({ icon, title, sub, children }: { icon?: React.ReactNode; title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-soft text-sub">{icon}</div>}
      <div className="text-[17px] font-semibold">{title}</div>
      {sub && <p className="mt-1.5 max-w-[420px] text-[14px] leading-[1.6] text-muted">{sub}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-[15px] text-muted">
      <Spinner className="h-6 w-6 text-ink" />
      {label}
    </div>
  );
}
