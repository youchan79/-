import React, { useEffect } from 'react';
import { AppProvider } from './lib/app.tsx';
import { useLocation } from './lib/router.tsx';
import { trackPageView } from './lib/pixel.ts';
import { AuthSheet } from './components/AuthSheet.tsx';
import { Toast } from './components/ui.tsx';
import Landing from './pages/Landing.tsx';
import Reading from './pages/Reading.tsx';
import Chat from './pages/Chat.tsx';
import Account from './pages/Account.tsx';
import Legal from './pages/Legal.tsx';
import Admin from './pages/Admin.tsx';
import { CheckoutFail, CheckoutSuccess } from './pages/Checkout.tsx';

function Routes() {
  const { path, search } = useLocation();

  useEffect(() => {
    // 결제 성공/실패 페이지는 곧바로 다른 화면으로 넘어가므로 PageView에서 뺀다.
    if (!path.startsWith('/checkout/') && path !== '/admin') trackPageView(path);
  }, [path]);

  let m: RegExpMatchArray | null;
  if ((m = path.match(/^\/r\/([\w-]+)\/chat\/?$/))) return <Chat id={m[1]} />;
  if ((m = path.match(/^\/r\/([\w-]+)\/?$/))) return <Reading key={m[1]} id={m[1]} />;
  switch (path) {
    case '/checkout/success':
      return <CheckoutSuccess search={search} />;
    case '/checkout/fail':
      return <CheckoutFail search={search} />;
    case '/me':
      return <Account search={search} />;
    case '/terms':
      return <Legal kind="terms" />;
    case '/privacy':
      return <Legal kind="privacy" />;
    case '/refund':
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
      <AuthSheet />
      <Toast />
    </AppProvider>
  );
}
