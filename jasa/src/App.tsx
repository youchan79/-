import { useEffect } from 'react';
import { AppProvider, useApp } from './lib/app.tsx';
import { navigate, usePath } from './lib/router.ts';
import { Landing } from './pages/Landing.tsx';
import { Login } from './pages/Login.tsx';
import { PayFail, PaySuccess } from './pages/PayResult.tsx';
import { Pricing } from './pages/Pricing.tsx';
import { Studio } from './pages/Studio.tsx';

export default function App() {
  return (
    <AppProvider>
      <Routes />
    </AppProvider>
  );
}

function Routes() {
  const path = usePath();
  const { config, session } = useApp();
  const needsLogin = Boolean(config.auth) && !session;
  const isStudio = path === '/app' || path.startsWith('/app/');

  useEffect(() => {
    if (isStudio && needsLogin) navigate(`/login?next=${encodeURIComponent(path)}`, true);
  }, [isStudio, needsLogin, path]);

  if (isStudio) return needsLogin ? null : <Studio path={path} />;
  if (path === '/login') return <Login />;
  if (path === '/pricing') return <Pricing />;
  if (path === '/pay/success') return <PaySuccess />;
  if (path === '/pay/fail') return <PayFail />;
  return <Landing />;
}
