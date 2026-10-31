import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  ClipboardList,
  FolderClosed,
  Menu,
  Moon,
  PanelLeft,
  Plus,
  Send,
  Settings,
  Smartphone,
  Sparkles,
  Sun,
  User,
} from 'lucide-react';
import { useApp } from '../lib/app.tsx';
import { Link, navigate, useLocation } from '../lib/router.tsx';
import { api } from '../lib/api.ts';
import { Button, IconButton, Logo, Modal, NewBadge } from './ui.tsx';

const NAV = [
  { to: '/add-content', label: '콘텐츠 추가', icon: Plus, match: (p: string) => p.startsWith('/add-content') || p === '/record' || p.startsWith('/memo') },
  { to: '/home', label: '문서', icon: FolderClosed, match: (p: string) => p === '/home' || p.startsWith('/doc/') },
  { to: '/aichat', label: 'AI 튜터', icon: Sparkles, match: (p: string) => p.startsWith('/aichat') },
  { to: '/exam', label: '시험 문제 만들기', icon: ClipboardList, match: (p: string) => p.startsWith('/exam'), badge: true },
];

function useCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar') === 'collapsed';
    } catch {
      return false;
    }
  });
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('sidebar', c ? 'open' : 'collapsed');
      } catch {
        /* 무시 */
      }
      return !c;
    });
  };
  return [collapsed, toggle] as const;
}

export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { showToast } = useApp();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-[20px] font-semibold">피드백 남기기</h2>
      <p className="mt-1 text-[14px] text-muted">불편한 점이나 바라는 기능을 알려 주세요. 모두 읽고 있어요.</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        className="mt-4 w-full resize-none rounded-2xl border border-line bg-canvas p-4 text-[15px] outline-none focus:border-ink"
        placeholder="예: 퀴즈 난이도를 고를 수 있으면 좋겠어요"
      />
      <Button
        className="mt-4 w-full"
        disabled={!text.trim() || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api('/api/feedback', { text });
            setText('');
            onClose();
            showToast('보내 주셔서 고마워요.');
          } catch (e: any) {
            showToast(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        보내기
      </Button>
    </Modal>
  );
}

export function AppDownloadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-[20px] font-semibold">앱처럼 쓰기</h2>
      <p className="mt-1 text-[14px] leading-[1.6] text-muted">스토어 앱은 준비 중이에요. 홈 화면에 추가하면 앱처럼 바로 열 수 있어요.</p>
      <div className="mt-5 space-y-3 text-[15px]">
        <div className="rounded-2xl bg-soft p-4">
          <div className="font-medium">iPhone (Safari)</div>
          <div className="mt-1 text-sub">공유 버튼 → 홈 화면에 추가</div>
        </div>
        <div className="rounded-2xl bg-soft p-4">
          <div className="font-medium">Android (Chrome)</div>
          <div className="mt-1 text-sub">오른쪽 위 메뉴 → 홈 화면에 추가</div>
        </div>
      </div>
    </Modal>
  );
}

function ThemeIcon() {
  const { theme } = useApp();
  const dark = theme === 'dark' || (theme === 'system' && typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark');
  return dark ? <Sun size={18} /> : <Moon size={18} />;
}

export function useToggleTheme() {
  const { setTheme } = useApp();
  return () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}

function SideItem({
  to,
  label,
  Icon,
  active,
  badge,
  onClick,
  collapsed,
}: {
  to?: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  active?: boolean;
  badge?: boolean;
  onClick?: () => void;
  collapsed?: boolean;
}) {
  const cls = `flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[15px] transition ${active ? 'bg-soft-2 text-ink' : 'text-sub hover:bg-soft-2/70 hover:text-ink'} ${collapsed ? 'w-9 justify-center px-0' : 'w-full'}`;
  const content = (
    <>
      <Icon size={18} strokeWidth={1.8} />
      {!collapsed && <span className="flex-1 truncate text-left">{label}</span>}
      {!collapsed && badge && <NewBadge />}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={cls} title={collapsed ? label : undefined}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} title={collapsed ? label : undefined}>
      {content}
    </button>
  );
}

function Sidebar({ collapsed, onToggle, onNavigate }: { collapsed: boolean; onToggle: () => void; onNavigate?: () => void }) {
  const { me, openLogin } = useApp();
  const { path } = useLocation();
  const toggleTheme = useToggleTheme();
  const [feedback, setFeedback] = useState(false);
  const [download, setDownload] = useState(false);
  const guest = me && !me.user;

  return (
    <div className={`flex h-full flex-col bg-side ${collapsed ? 'w-[60px] items-center' : 'w-[260px]'}`} onClick={(e) => (e.target as HTMLElement).closest('a') && onNavigate?.()}>
      <div className={`flex h-[52px] shrink-0 items-center ${collapsed ? 'justify-center' : 'justify-between pl-[18px] pr-3'}`}>
        {!collapsed && (
          <Link to="/home">
            <Logo />
          </Link>
        )}
        <IconButton onClick={onToggle} aria-label="사이드바 접기">
          <PanelLeft size={19} strokeWidth={1.7} />
        </IconButton>
      </div>
      <nav className={`mt-1 space-y-0.5 ${collapsed ? 'px-0' : 'px-1.5'}`}>
        {NAV.map((n) => (
          <SideItem key={n.to} to={n.to} label={n.label} Icon={n.icon} active={n.match(path)} badge={n.badge} collapsed={collapsed} />
        ))}
      </nav>
      <div className="flex-1" />
      <div className={`space-y-0.5 border-t border-line py-2 ${collapsed ? 'px-0' : 'px-1.5'} w-full ${collapsed ? 'flex flex-col items-center' : ''}`}>
        <SideItem to="/settings" label="설정" Icon={Settings} active={path.startsWith('/settings')} collapsed={collapsed} />
        <SideItem label="피드백 남기기" Icon={Send} onClick={() => setFeedback(true)} collapsed={collapsed} />
        <SideItem label="테마 변경" Icon={ThemeIcon as any} onClick={toggleTheme} collapsed={collapsed} />
        <SideItem label="앱 다운로드" Icon={Smartphone} onClick={() => setDownload(true)} collapsed={collapsed} />
        {collapsed && <SideItem to={me?.user ? '/settings?tab=account' : undefined} onClick={me?.user ? undefined : () => openLogin()} label="계정" Icon={User} collapsed />}
      </div>
      {!collapsed && guest && (
        <div className="border-t border-line px-5 pb-4 pt-5">
          <div className="text-[15px] font-medium">나만의 학습 공간을 만드세요</div>
          <p className="mt-1.5 text-[14px] leading-[1.45] text-muted">로그인하면 만든 자료가 저장되고, 어디서나 이어서 공부할 수 있어요</p>
          <Button variant="outline" className="mt-4 w-full" onClick={() => openLogin()}>
            로그인
          </Button>
        </div>
      )}
      {!collapsed && me?.user && (
        <div className="border-t border-line px-3 py-3">
          <Link to="/settings?tab=account" className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-soft-2/70">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-solid text-[13px] font-semibold text-on-solid">
              {me.user.email[0].toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px]">{me.user.email}</span>
              <span className="block text-[12px] text-muted">{me.sub?.pro ? 'Pro 플랜' : '기본 플랜'}</span>
            </span>
          </Link>
          {!me.sub?.pro && (
            <Button size="sm" className="mt-2 w-full" onClick={() => navigate('/subscription')}>
              Pro로 업그레이드
            </Button>
          )}
        </div>
      )}
      <FeedbackModal open={feedback} onClose={() => setFeedback(false)} />
      <AppDownloadModal open={download} onClose={() => setDownload(false)} />
    </div>
  );
}

export function LanguageSelect() {
  const { showToast } = useApp();
  return (
    <button
      type="button"
      onClick={() => showToast('다른 언어는 준비 중이에요.')}
      className="hidden h-9 items-center gap-1.5 rounded-full px-3 text-[14px] text-sub hover:bg-soft sm:inline-flex"
    >
      <span className="text-[15px]">🇰🇷</span> 한국어 <ChevronDown size={14} />
    </button>
  );
}

export function HeaderActions() {
  const { me, openLogin } = useApp();
  const toggleTheme = useToggleTheme();
  return (
    <div className="flex items-center gap-1.5">
      <LanguageSelect />
      <IconButton onClick={toggleTheme} aria-label="테마 변경">
        <ThemeIcon />
      </IconButton>
      {me && !me.user && (
        <Button size="sm" onClick={() => openLogin()} className="ml-1">
          로그인
        </Button>
      )}
    </div>
  );
}

/** 사이드바가 있는 앱 레이아웃 */
export function AppShell({
  title,
  right,
  children,
  bare = false,
  forceCollapsed = false,
}: {
  title?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  bare?: boolean;
  forceCollapsed?: boolean;
}) {
  const [collapsedPref, toggle] = useCollapsed();
  const collapsed = forceCollapsed || collapsedPref;
  const [drawer, setDrawer] = useState(false);
  const { path } = useLocation();
  useEffect(() => setDrawer(false), [path]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-canvas">
      <aside className="hidden shrink-0 border-r border-line md:block">
        <Sidebar collapsed={collapsed} onToggle={toggle} />
      </aside>
      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute inset-y-0 left-0 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <Sidebar collapsed={false} onToggle={() => setDrawer(false)} onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {!bare && (
          <header className="flex h-[52px] shrink-0 items-center gap-2 px-3 md:px-6">
            <IconButton className="md:hidden" onClick={() => setDrawer(true)} aria-label="메뉴">
              <Menu size={20} />
            </IconButton>
            <div className="min-w-0 flex-1 truncate text-[16px] font-medium">{title}</div>
            {right ?? <HeaderActions />}
          </header>
        )}
        {bare && (
          <button
            type="button"
            className="fixed left-3 top-2.5 z-30 inline-flex h-9 w-9 items-center justify-center rounded-full bg-canvas/80 text-sub md:hidden"
            onClick={() => setDrawer(true)}
            aria-label="메뉴"
          >
            <Menu size={20} />
          </button>
        )}
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
