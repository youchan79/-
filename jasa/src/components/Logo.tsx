import { BRAND } from '../brand.ts';
import { Link } from './Link.tsx';

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--color-pine)" />
      <path d="M9 22h14M11 10h10l-5 8z" stroke="var(--color-sun)" strokeWidth="3" fill="none" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label={`${BRAND.name} 홈`}>
      <LogoMark />
      <span className="font-serif text-xl font-black tracking-tight">{BRAND.name}</span>
    </Link>
  );
}
