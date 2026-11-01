import React, { useEffect } from 'react';
import { AppProvider } from './lib/app.tsx';
import { useLocation } from './lib/router.tsx';
import { trackPageView } from './lib/pixel.ts';
import { LoginModal, UpgradeModal } from './components/Modals.tsx';
import { Toast } from './components/ui.tsx';
import Landing from './pages/Landing.tsx';
import Documents from './pages/Documents.tsx';
import AddContent from './pages/AddContent.tsx';
import Record from './pages/Record.tsx';
import MemoNew from './pages/MemoNew.tsx';
import DocDetail from './pages/DocDetail.tsx';
import Tutor from './pages/Tutor.tsx';
import { ExamHome, ExamRun } from './pages/Exam.tsx';
import Settings from './pages/Settings.tsx';
import Subscription, { MockPayApp } from './pages/Subscription.tsx';
import Legal from './pages/Legal.tsx';
import Admin from './pages/Admin.tsx';

function Routes() {
  const { path, search } = useLocation();

  useEffect(() => {
    if (!['/admin', '/mock-payapp'].includes(path)) trackPageView(path);
  }, [path]);

  let m: RegExpMatchArray | null;
  if ((m = path.match(/^\/doc\/([\w-]+)\/?$/))) return <DocDetail key={m[1]} id={m[1]} search={search} />;
  if ((m = path.match(/^\/aichat(?:\/([\w-]+))?\/?$/))) return <Tutor id={m[1] ?? null} search={search} />;
  if ((m = path.match(/^\/exam\/([\w-]+)\/?$/))) return <ExamRun key={m[1]} id={m[1]} />;
  switch (path) {
    case '/home':
      return <Documents />;
    case '/add-content':
      return <AddContent />;
    case '/record':
      return <Record />;
    case '/memo/new':
      return <MemoNew />;
    case '/exam':
      return <ExamHome />;
    case '/settings':
      return <Settings search={search} />;
    case '/subscription':
      return <Subscription search={search} />;
    case '/mock-payapp':
      return <MockPayApp search={search} />;
    case '/terms':
      return <Legal kind="terms" />;
    case '/privacy':
      return <Legal kind="privacy" />;
    case '/refund-policy':
      return <Legal kind="refund" />;
    case '/admin':
      return <Admin />;
    default:
      return <Landing />;
  }
}

export default function App() {
  return (
    <AppProvider>
      <Routes />
      <LoginModal />
      <UpgradeModal />
      <Toast />
    </AppProvider>
  );
}
