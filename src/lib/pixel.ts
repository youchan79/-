declare global {
  interface Window {
    fbq?: any;
    _fbq?: any;
  }
}

// 설정(/api/config)을 받기 전에 생긴 이벤트는 모아 두었다가 픽셀을 켤 때 보낸다.
// 결제 성공 페이지처럼 설정보다 결제 확인이 먼저 끝나는 경우에도 Purchase가 빠지지 않게 하기 위해서다.
let state: 'pending' | 'on' | 'off' = 'pending';
const pending: unknown[][] = [];
let lastPageViewPath: string | null = null;

function call(...args: unknown[]) {
  if (state === 'on') window.fbq(...args);
  else if (state === 'pending') pending.push(args);
}

/** 메타 픽셀 기본 코드. pixelId가 없으면 쌓인 이벤트를 버리고 이후로도 보내지 않는다. */
export function initPixel(pixelId: string | null) {
  captureFbclid();
  if (state !== 'pending') return;
  if (!pixelId) {
    state = 'off';
    pending.length = 0;
    return;
  }
  /* eslint-disable */
  (function (f: any, b: Document, e: string, v: string) {
    if (f.fbq) return;
    const n: any = (f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    });
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    const t = b.createElement(e) as HTMLScriptElement;
    t.async = true;
    t.src = v;
    const s = b.getElementsByTagName(e)[0];
    s.parentNode!.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq('init', pixelId);
  state = 'on';
  for (const args of pending.splice(0)) window.fbq(...args);
}

export function trackPageView(path: string) {
  if (path === lastPageViewPath) return;
  lastPageViewPath = path;
  call('track', 'PageView');
}

type StandardEvent = 'ViewContent' | 'CompleteRegistration' | 'InitiateCheckout' | 'Purchase';

export function track(event: StandardEvent, params?: Record<string, unknown>, eventId?: string) {
  if (eventId) call('track', event, params ?? {}, { eventID: eventId });
  else call('track', event, params ?? {});
}

/** 광고 클릭 ID(fbclid)를 서버 전환 API에서 쓸 수 있게 _fbc 쿠키로 남긴다. */
function captureFbclid() {
  const fbclid = new URLSearchParams(location.search).get('fbclid');
  if (!fbclid || document.cookie.includes('_fbc=')) return;
  const value = `fb.1.${Date.now()}.${fbclid}`;
  document.cookie = `_fbc=${encodeURIComponent(value)}; path=/; max-age=${90 * 86400}; SameSite=Lax`;
}
