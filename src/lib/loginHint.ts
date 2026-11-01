// 이 기기에서 마지막으로 쓴 로그인 방법. 서버가 로그인할 때 last_login 쿠키(방법 + 가린 계정, 토큰 없음)로 남기고,
// 여기서 localStorage에 한 벌 더 둔다. 쿠키가 있으면 쿠키가 우선이고('none'은 지운 상태), 쿠키가 없을 때만 localStorage를 본다.

export type HintProvider = 'kakao' | 'naver' | 'google' | 'email';
export interface LoginHint {
  p: HintProvider;
  m: string; // 가린 계정 (예: ch***@gmail.com, 홍*동)
  out?: 1; // 직접 로그아웃함 → 구글 자동 로그인을 하지 않는다
}

const NAME = 'last_login';

function valid(v: any): LoginHint | null {
  return v && ['kakao', 'naver', 'google', 'email'].includes(v.p) && typeof v.m === 'string' ? { p: v.p, m: v.m.slice(0, 60), out: v.out ? 1 : undefined } : null;
}

export function readLoginHint(): LoginHint | null {
  const raw = document.cookie
    .split('; ')
    .find((c) => c.startsWith(NAME + '='))
    ?.slice(NAME.length + 1);
  let hint: LoginHint | null = null;
  try {
    if (raw === undefined) return valid(JSON.parse(localStorage.getItem(NAME) || 'null'));
    if (raw !== 'none') hint = valid(JSON.parse(decodeURIComponent(raw)));
    if (hint) localStorage.setItem(NAME, JSON.stringify(hint));
    else localStorage.removeItem(NAME);
  } catch {
    /* 저장소를 못 쓰는 환경이거나 값이 깨짐 */
  }
  return hint;
}

/** '다른 계정으로 로그인': 힌트를 지운다 */
export function forgetLoginHint() {
  document.cookie = `${NAME}=none; path=/; max-age=${365 * 86400}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  try {
    localStorage.removeItem(NAME);
  } catch {
    /* 무시 */
  }
}
