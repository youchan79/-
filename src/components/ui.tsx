import React, { useEffect } from 'react';
import { Link } from '../lib/router.tsx';
import { useApp } from '../lib/app.tsx';

export function Page({ children, bottomPad = false }: { children: React.ReactNode; bottomPad?: boolean }) {
  return <div className={`mx-auto min-h-dvh w-full max-w-[480px] ${bottomPad ? 'pb-32' : 'pb-10'}`}>{children}</div>;
}

export function TopBar({ right }: { right?: React.ReactNode }) {
  const { config, me } = useApp();
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between bg-bg/95 px-4 backdrop-blur">
      <Link to="/" className="text-[17px] font-bold tracking-tight text-ink">
        {config?.serviceName ?? ''}
      </Link>
      {right ?? (
        <Link to={me?.user ? '/me' : '/me?login=1'} className="rounded-full px-3 py-1.5 text-[14px] text-sub active:bg-black/5">
          {me?.user ? '내 정보' : '로그인'}
        </Link>
      )}
    </header>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[22px] bg-card p-5 ${className}`}>{children}</section>;
}

export function CardTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="text-[19px] font-bold tracking-tight text-ink">{children}</h2>
      {sub && <p className="mt-1 text-[14px] text-muted">{sub}</p>}
    </div>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = 'primary',
  type = 'button',
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  type?: 'button' | 'submit';
  className?: string;
}) {
  const styles = {
    primary: 'bg-primary text-white active:bg-primary-press disabled:bg-primary/40',
    secondary: 'bg-primary-soft text-primary active:bg-[#d6e9ff] disabled:opacity-50',
    ghost: 'bg-field text-sub active:bg-line disabled:opacity-50',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-14 w-full items-center justify-center whitespace-nowrap rounded-2xl text-[17px] font-semibold transition-colors ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <span className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} />;
}

export function BottomCta({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-bg via-bg to-bg/0 pt-6">
      <div className="mx-auto w-full max-w-[480px] px-4 pb-[max(16px,env(safe-area-inset-bottom))]">{children}</div>
    </div>
  );
}

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-[480px] rounded-t-[26px] bg-card px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-6"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function Footer() {
  const { config } = useApp();
  if (!config) return null;
  const b = config.business;
  return (
    <footer className="mt-10 px-5 text-[12px] leading-[1.7] text-muted">
      <div className="mb-3 flex gap-4 text-[13px] text-sub">
        <Link to="/terms">이용약관</Link>
        <Link to="/privacy" className="font-semibold">
          개인정보처리방침
        </Link>
        <Link to="/refund">환불정책</Link>
      </div>
      <p>
        {b.name} | 대표 {b.owner} | 사업자등록번호 {b.regNo}
      </p>
      <p>통신판매업 신고번호 {b.mailOrderNo}</p>
      <p>{b.address}</p>
      <p>
        고객센터 {b.phone} | {b.email}
      </p>
      <p className="mt-2">사주 풀이는 재미와 참고를 위한 콘텐츠이며, 중요한 결정은 전문가와 상의하세요.</p>
    </footer>
  );
}

export function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
      <div className="max-w-[440px] rounded-2xl bg-ink/90 px-4 py-3 text-[15px] text-white">{toast}</div>
    </div>
  );
}
