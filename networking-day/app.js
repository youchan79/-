// 오늘의 5명 — 화면과 흐름 (틴더식 카드 UI)
(function () {
  'use strict';

  const ND = window.ND || {};
  const C = window.ND_CONFIG || {};
  const MAX = C.maxLikes || 5;
  const CAP = C.capacity || 35;
  const EVENT_ID = C.eventId || 'physical-ai-networking-day-2026';

  const FIELDS = ['연구개발', 'AI·소프트웨어', '하드웨어·기구', '데이터', '제품·기획', '사업개발·영업', '투자', '정책·공공', '경영·창업'];
  const YEARS = ['1년 미만', '1~3년', '3~7년', '7~15년', '15년 이상'];
  const KEYWORDS = ['휴머노이드', '매니퓰레이션', '로봇 핸드·그리퍼', '촉각 센서', '원격조작(텔레오퍼레이션)', '모션캡처',
    '시뮬레이션·Sim2Real', 'VLA·로봇 파운데이션 모델', '강화학습', '데이터 수집·라벨링', '자율주행·모바일 로봇',
    '제조 자동화', '물류', '의료·재활', '서비스 로봇', '반도체·부품', '투자 유치', '해외 진출', '정부 과제', '규제·표준'];
  const LOOKING = ['공동 연구·개발', '고객사·도입처', '데이터 협력', '투자', '채용·구직', '정보 교류'];
  const MAX_KEYWORDS = 5;
  const MAX_LOOKING = 3;
  const MAX_CAREERS = 3;
  const MONO_COLORS = ['#1f4e79', '#9a3b2e', '#2e6b4f', '#5b4790', '#8a5a12', '#0f6b66', '#8c2d5a', '#3b4656'];
  const NETWORKING_NOTICE = '지금부터 네트워킹을 시작해요. LIKE에서 나를 고른 사람을 확인하세요';
  // 입력 예시: 고른 직무 분야에 맞춰 바꿔 보여 줍니다. 사람·회사는 모두 가상입니다.
  const EXAMPLES = {
    '연구개발': { exps: ['재활 보조 로봇 임상 시험 2건 수행', '보행 보조 제어 알고리즘 논문 3편'], topic: '연구 성과를 현장 제품으로 옮긴 경험을 나누고 싶어요' },
    'AI·소프트웨어': { exps: ['로봇 파지 모델 학습 파이프라인 구축', '시뮬레이션 데이터로 성공률 20%p 개선'], topic: '로봇 학습 데이터를 어떻게 모으는지 이야기 나눠요' },
    '하드웨어·기구': { exps: ['다지 로봇 핸드 시제품 설계', '감속기 원가 30% 절감'], topic: '로봇 손 내구성 시험을 어떻게 하시는지 궁금해요' },
    '데이터': { exps: ['협동로봇 촉각 데이터 120시간 수집 파이프라인 구축', '촉각·영상 동기화 라벨링 기준 수립'], topic: '촉각 데이터 품질 기준을 다른 팀은 어떻게 잡는지 궁금해요' },
    '제품·기획': { exps: ['서비스 로봇 앱 기획·출시', '현장 사용성 테스트 40회 운영'], topic: '현장 작업자가 로봇을 받아들이게 만든 방법이 궁금해요' },
    '사업개발·영업': { exps: ['물류센터 AMR 도입 프로젝트 수주', '해외 파트너사와 PoC 진행'], topic: '로봇 도입을 고민 중인 현장 담당자와 이야기하고 싶어요' },
    '투자': { exps: ['피지컬 AI 스타트업 투자 검토 10건', '제조 AI 시장 보고서 작성'], topic: '시드~시리즈A 피지컬 AI 팀을 만나고 싶어요' },
    '정책·공공': { exps: ['로봇 실증 사업 기획·운영', '서비스 로봇 안전 기준 마련 참여'], topic: '실증 사업에서 기업이 가장 어려워하는 점을 듣고 싶어요' },
    '경영·창업': { exps: ['시드 투자 유치, 팀 10명 구성', '첫 고객사와 PoC 계약'], topic: '초기 고객을 어떻게 찾았는지 서로 이야기해요' },
  };
  const yearsLabel = (y) => (y ? '경력 ' + y : '');

  const $ = (id) => document.getElementById(id);
  const VIEWS = ['loading', 'error', 'onboard', 'app', 'admin'];

  const S = {
    store: null,
    pid: null,
    me: null,
    profiles: new Map(),
    profilesLoaded: false,
    profilesServer: false, // 마지막 목록이 서버에서 온 것인지 (기기 보관본이 아니라)
    swipesLoaded: false,
    inboxLoaded: false,
    phase: 'registration',
    notice: null,
    noticeText: '',
    noticeAt: 0,
    swipes: { likes: [], passes: [] },
    inbox: [],
    myLinkedin: '',
    met: [],
    deckOrder: [],
    deckInitAt: 0,
    history: [], // 되돌리기 기록 (최근 것이 맨 뒤)
    viewed: new Set(), // LIKE에서 이미 본 '나를 고른 사람'
    newIds: new Set(), // 이번에 LIKE를 열었을 때 새로 보인 사람
    creating: false,
    editing: false,
    continuing: false, // 다 고르기 전, 남은·새 카드 이어서 보기
    browsing: false, // 5명을 다 고른 뒤 남은 카드 둘러보기
    admin: false,
    progress: new Map(), // 운영자 화면: 참가자별 고른 수·본 카드 수
    adminFilter: 'real',
    view: null,
    tab: 'swipe',
    likesTab: 'in',
    hideMet: false,
    showPasses: false,
    unsub: [],
  };

  // ---------- 아이콘 ----------
  const ICONS = {
    x: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" fill="none"/>',
    heart: '<path d="M12 21s-7.6-4.7-9.7-9.5C.8 8 2.9 4.3 6.7 4.3c2.2 0 3.6 1.2 4.4 2.5.8-1.3 2.2-2.5 4.4-2.5 3.8 0 5.9 3.7 4.4 7.2C19.6 16.3 12 21 12 21z" fill="currentColor"/>',
    heartLine: '<path d="M12 20s-7-4.4-8.9-8.8C1.7 8 3.6 4.8 7 4.8c2 0 3.3 1.1 5 3 1.7-1.9 3-3 5-3 3.4 0 5.3 3.2 3.9 6.4C19 15.6 12 20 12 20z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>',
    undo: '<path d="M4 5v5h5" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.6 14.5A7.7 7.7 0 1 0 6.4 7L4 10" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    up: '<path d="M12 19V6M6 11.5L12 5.5l6 6" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    down: '<path d="M12 5v13M6 12.5l6 6 6-6" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    back: '<path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7M3 12.5h18" stroke="currentColor" stroke-width="2" fill="none"/>',
    building: '<path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h7A1.5 1.5 0 0 1 15 4.5V21M15 9h3.5A1.5 1.5 0 0 1 20 10.5V21M3 21h18M8.5 7.5h3M8.5 11.5h3M8.5 15.5h3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
    info: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8L3 12z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/><circle cx="7.5" cy="8.5" r="1.5" fill="currentColor"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>',
    history: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M4 4v4.7h4.7M12 8v4.5l3 2" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    search: '<circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    sparkle: '<path d="M12 3l1.8 5.6L19.5 10l-5.7 1.6L12 17l-1.8-5.4L4.5 10l5.7-1.4z" fill="currentColor"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    cards: '<rect x="8" y="3.5" width="12" height="16" rx="2.5" stroke="currentColor" stroke-width="2" fill="none" transform="rotate(10 14 11.5)"/><rect x="4" y="4.5" width="12" height="16" rx="2.5" fill="currentColor"/>',
    person: '<circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2" fill="none"/><path d="M4 21c.6-4 3.9-6.5 8-6.5s7.4 2.5 8 6.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
    quote: '<path d="M10 7H6.5A2.5 2.5 0 0 0 4 9.5V13h5v5H4M20 7h-3.5A2.5 2.5 0 0 0 14 9.5V13h5v5h-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" stroke-width="2.2" fill="none"/>',
    plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  function icon(name) {
    const span = document.createElement('span');
    span.style.display = 'contents';
    span.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICONS[name] + '</svg>';
    return span;
  }

  // ---------- 유틸 ----------
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : String(v));
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 무시 */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } },
    json(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  };
  const MODE = C.firebase && !C.demo ? 'live' : 'demo';
  const LS_PID = 'nd-pid:' + EVENT_ID + ':' + MODE;
  const LS_DRAFT = 'nd-draft:' + EVENT_ID + ':' + MODE;
  const LS_COACH = 'nd-coach:' + EVENT_ID;
  const LS_NOTICE = 'nd-notice:' + EVENT_ID + ':' + MODE;
  const LS_EDIT = 'nd-edit:' + EVENT_ID + ':' + MODE;
  const lsSeen = () => 'nd-seen:' + EVENT_ID + ':' + MODE + ':' + S.pid;
  const lsViewed = () => 'nd-viewed:' + EVENT_ID + ':' + MODE + ':' + S.pid;
  const ssSession = () => 'nd-session:' + EVENT_ID + ':' + MODE + ':' + S.pid;
  // 새로고침해도 되돌리기와 '이어서 보기' 상태가 남도록 이 탭에만 보관합니다.
  const session = {
    load() { try { return JSON.parse(sessionStorage.getItem(ssSession())) || {}; } catch (e) { return {}; } },
    save() {
      if (!S.pid) return;
      try { sessionStorage.setItem(ssSession(), JSON.stringify({ history: S.history.slice(-20), continuing: S.continuing, browsing: S.browsing })); } catch (e) { /* 무시 */ }
    },
  };

  function hash32(s) {
    let x = 2166136261;
    for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
    return x >>> 0;
  }
  async function keyHash(name, pin) {
    const norm = name.replace(/\s+/g, '').toLowerCase();
    const bytes = new TextEncoder().encode(EVENT_ID + '|' + norm + '|' + pin);
    const buf = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  const cleanText = (v, max) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);

  let toastTimer = null;
  function toast(msg, ms) {
    if (!$('qr-full').hidden) return; // 프로젝터에 띄운 QR 위에는 띄우지 않음
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms || 2400);
  }
  // 화면을 옮기면 앞 화면의 안내는 지웁니다 (다음 화면 제목을 가리지 않게).
  function hideToast() { clearTimeout(toastTimer); $('toast').hidden = true; }
  ND.onStoreError = (err) => {
    const code = err && err.code ? String(err.code) : '';
    if (code.includes('permission')) toast('권한이 없어 불러오지 못했어요. 운영진에게 알려 주세요.', 3200);
    else toast('연결이 불안정해요. 잠시 뒤 다시 시도해요.');
  };

  // ---------- 연타 막기 ----------
  // 화면이 닫히거나 바뀐 직후 잠깐은 탭을 무시합니다. 두 번째 탭이 아래에 있던 버튼·카드를 누르지 않게.
  let shieldUntil = 0;
  function shield(ms) { shieldUntil = Math.max(shieldUntil, performance.now() + (ms || 350)); }
  ['pointerdown', 'pointerup', 'click'].forEach((type) => document.addEventListener(type, (e) => {
    if (performance.now() < shieldUntil) { e.stopPropagation(); e.preventDefault(); }
  }, true));

  // ---------- 연결 상태·저장 대기 (13) ----------
  // 고른 기록은 Firestore가 이 기기에 먼저 보관하고(새로고침해도 남음) 연결되면 서버로 보냅니다.
  let pendingWrites = 0;
  let slowTimer = null;
  function renderNet() {
    const offline = navigator.onLine === false;
    const b = $('net-banner');
    if (offline) {
      b.textContent = '인터넷 연결이 끊겼어요. 고른 기록은 이 기기에 보관했다가 연결되면 자동으로 저장돼요.';
      b.hidden = false;
    } else if (pendingWrites > 0 && slowTimer === 'shown') {
      b.textContent = '저장하는 중이에요. 연결이 느려요.';
      b.hidden = false;
    } else {
      b.hidden = true;
    }
    // 연결 안내가 떠 있는 동안에는 화면 내용을 그만큼 아래로 내려 상단 표시를 가리지 않습니다.
    document.documentElement.style.setProperty('--net-h', b.hidden ? '0px' : (b.offsetHeight + 8) + 'px');
    $('finish-pending').hidden = !(pendingWrites > 0 && (offline || slowTimer === 'shown'));
  }
  function enqueue(fn) {
    pendingWrites++;
    if (!slowTimer) slowTimer = setTimeout(() => { slowTimer = 'shown'; renderNet(); }, 5000);
    // 순서는 Firestore가 지키므로 바로 넘깁니다. 끊긴 동안에도 기기에 바로 보관됩니다.
    const p = Promise.resolve().then(fn).catch((err) => {
      console.error(err);
      toast('저장하지 못했어요. 인터넷 연결을 확인해 주세요.', 3200);
    }).finally(() => {
      pendingWrites--;
      if (pendingWrites === 0) { if (slowTimer !== 'shown') clearTimeout(slowTimer); slowTimer = null; }
      renderNet();
    });
    if (navigator.onLine === false) renderNet();
    return p;
  }

  // ---------- 뒤로가기 (3, 14) ----------
  // 앱 안에서 되돌아갈 곳이 있으면 기록을 하나 쌓아 두고, 휴대폰 뒤로가기를 앱 안의 '뒤로'로 씁니다.
  // 새로고침해도 같은 기록이 남아 있으면 다시 쌓지 않습니다.
  let guardOn = !!(history.state && history.state.nd);
  let lastBackAt = 0;
  function armBack() {
    if (guardOn) return;
    try { history.pushState({ nd: 1 }, ''); guardOn = true; } catch (e) { /* 무시 */ }
  }
  function canGoBackInApp() {
    return !$('sheet').hidden || !$('match').hidden || !$('finish').hidden || !$('demo-menu').hidden || !$('qr-full').hidden
      || (S.view === 'onboard' && (OB.i > 0 || OB.mode === 'edit')) || S.view === 'app';
  }
  function onBack() {
    if (!$('qr-full').hidden) { $('qr-full').hidden = true; return true; }
    if (!$('demo-menu').hidden) { $('demo-menu').hidden = true; return true; }
    if (!$('sheet').hidden) { closeSheet(); return true; }
    if (!$('match').hidden) { closeMatch(); return true; }
    if (!$('finish').hidden) { closeFinish(); return true; }
    if (S.view === 'onboard') { obBack(); return true; }
    if (S.view === 'app') {
      if (S.tab !== 'swipe') { goTab('swipe'); return true; }
      if (Date.now() - lastBackAt < 2500) { lastBackAt = 0; return false; }
      lastBackAt = Date.now();
      toast('한 번 더 누르면 나가요');
      return true;
    }
    return false;
  }
  window.addEventListener('popstate', () => {
    guardOn = false;
    if (onBack()) { if (canGoBackInApp()) armBack(); }
    else if (S.view === 'app') history.back(); // 두 번 누르면 정말 나감
  });

  // ---------- 휴대폰 키보드 (4) ----------
  function fitViewport() {
    const vv = window.visualViewport;
    if (!vv) return;
    const open = window.innerHeight - vv.height > 120;
    document.documentElement.classList.toggle('kb-open', open);
    document.documentElement.style.setProperty('--vvh', Math.round(vv.height) + 'px');
    if (open && S.view === 'onboard') window.scrollTo(0, 0);
  }

  // ---------- 로고 ----------
  const monoColor = (company) => MONO_COLORS[hash32(company || '') % MONO_COLORS.length];

  // 회사 이름 → 로고 대응표(logos/logos.js). 띄어쓰기, 영문 대소문자, (주)·㈜·주식회사는 무시하고 맞춥니다.
  const normCompany = (v) => String(v || '').normalize('NFC').replace(/\(주\)|㈜|주식회사|\s+/g, '').toLowerCase();
  const LOGO_MAP = new Map(Object.entries(window.ND_LOGOS || {}).map(([k, v]) => [normCompany(k), v]));
  const mappedLogo = (company) => LOGO_MAP.get(normCompany(company)) || null;
  // 대응표에 있으면 그 로고, 없으면 참가자가 올린 로고
  const logoFor = (p) => mappedLogo(p.company) || p.logo || null;

  // 로고에서 대표 색 두 개를 뽑아 카드 배경으로 씁니다 (19). 투명 배경에 밝은 로고면 어두운 바탕에 올립니다 (22).
  // 가로로 긴 로고(워드마크)는 타일도 가로로 넓혀 글자가 작아지지 않게 합니다.
  const PALETTE = new Map();
  const NO_PALETTE = { colors: [], lightOnClear: false, ratio: 1 };
  function readPixels(img, n) {
    const c = document.createElement('canvas');
    c.width = n; c.height = n;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, n, n);
    return ctx.getImageData(0, 0, n, n).data;
  }
  function analyzePixels(px) {
    let clear = 0, opaque = 0, lum = 0;
    const buckets = new Map();
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i], g = px[i + 1], b = px[i + 2], a = px[i + 3];
      if (a < 40) { clear++; continue; }
      opaque++;
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lum += l;
      if (Math.max(r, g, b) - Math.min(r, g, b) < 28 || l > 235 || l < 18) continue;
      const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
      const e = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
      e.n++; e.r += r; e.g += g; e.b += b;
      buckets.set(key, e);
    }
    const colors = [...buckets.values()].sort((a, b) => b.n - a.n).slice(0, 2)
      .map((e) => 'rgb(' + Math.round(e.r / e.n) + ',' + Math.round(e.g / e.n) + ',' + Math.round(e.b / e.n) + ')');
    const total = px.length / 4;
    return { colors, clearRatio: clear / total, lightOnClear: clear > total * 0.15 && opaque > 0 && lum / opaque > 200 };
  }
  function analyzeLogo(src) {
    if (PALETTE.has(src)) return Promise.resolve(PALETTE.get(src));
    return new Promise((resolve) => {
      const img = new Image();
      const done = (res) => { PALETTE.set(src, res); resolve(res); };
      img.onload = () => {
        try {
          const ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1);
          done(Object.assign(analyzePixels(readPixels(img, 24)), { ratio }));
        } catch (e) { done(NO_PALETTE); }
      };
      img.onerror = () => done(NO_PALETTE);
      img.src = src;
    });
  }
  // 로고 분석이 끝나면(캐시에 있으면 바로) fn(분석 결과)을 부릅니다.
  function withPalette(src, fn) {
    if (!src) { fn(NO_PALETTE); return; }
    if (PALETTE.has(src)) { fn(PALETTE.get(src)); return; }
    fn(NO_PALETTE);
    analyzeLogo(src).then(fn);
  }
  function bgCss(colors, fallback) {
    const c1 = colors[0] || fallback;
    const c2 = colors[1] || colors[0] || fallback;
    return 'radial-gradient(90% 60% at 22% 18%, ' + c1 + ' 0%, transparent 70%), radial-gradient(90% 70% at 85% 70%, ' + c2 + ' 0%, transparent 72%), #1d1d22';
  }

  function logoEl(p) {
    const box = h('div', { class: 'logo' });
    const label = (p.company || '회사') + ' 로고';
    const src = logoFor(p);
    if (src) {
      box.append(h('img', { src, alt: label, draggable: 'false' }));
      // 투명 배경의 흰 로고는 어디에 놓이든(대기 화면, 완료 화면, 미리보기) 어두운 바탕에 올립니다.
      withPalette(src, (pal) => {
        box.classList.toggle('on-dark', !!pal.lightOnClear);
        box.classList.toggle('wide', pal.ratio >= 1.6);
      });
    } else {
      box.classList.add('mono-logo');
      box.style.setProperty('--mono', monoColor(p.company));
      box.setAttribute('role', 'img');
      box.setAttribute('aria-label', label);
      box.append(h('span', { 'aria-hidden': 'true', text: (p.company || '?').trim().charAt(0).toUpperCase() || '?' }));
    }
    return box;
  }

  // 사진 자리: 로고 색으로 만든 배경 + 가운데 로고
  function visualEls(p) {
    const src = logoFor(p);
    const fallback = monoColor(p.company);
    const bg = h('div', { class: 'v-bg', 'aria-hidden': 'true' });
    const tile = h('div', { class: 'v-logo' }, logoEl(p));
    withPalette(src, (pal) => {
      bg.style.background = bgCss(pal.colors, fallback);
      tile.classList.toggle('dark', !!pal.lightOnClear);
      tile.classList.toggle('wide', pal.ratio >= 1.6);
    });
    return [bg, h('div', { class: 'v-shade' }), tile];
  }

  // ---------- 링크드인 ----------
  // 링크드인 주소를 https://www.linkedin.com/in/아이디 형태로 맞춥니다. 빈 값은 '', 형식이 틀리면 null.
  // kr.·m.·www. 같은 앞부분, 아이디 뒤의 /details/... 같은 경로, %로 바뀐 한글 아이디도 정리합니다.
  function normLinkedin(v) {
    const s = String(v || '').trim();
    if (!s) return '';
    const m = s.match(/^(?:https?:\/\/)?(?:[a-z0-9-]+\.)*linkedin\.com\/(in|pub)\/([^\s?#/]+)/i);
    if (!m) return null;
    let id = m[2];
    try { id = decodeURIComponent(id); } catch (e) { /* 그대로 */ }
    id = id.replace(/[\s?#/]/g, '');
    return id ? 'https://www.linkedin.com/' + m[1].toLowerCase() + '/' + id : null;
  }
  // 서로 고른 사람의 링크드인 (상대가 나에게 LIKE를 보낼 때 함께 보낸 주소)
  const lnFrom = (pid) => (S.inbox.find((x) => x.id === pid) || {}).ln || '';
  function linkedinBtn(url) {
    if (!url) return null;
    if (url === '#demo') {
      return h('button', { type: 'button', class: 'ln-btn', onclick: (e) => { e.stopPropagation(); toast('시연 모드라 열리지 않아요. 실제로는 상대의 링크드인이 열려요.'); } },
        icon('external'), '링크드인');
    }
    return h('a', { class: 'ln-btn', href: url, target: '_blank', rel: 'noopener noreferrer', onclick: (e) => e.stopPropagation() },
      icon('external'), '링크드인');
  }

  // ---------- 카드 (1, 2, 10, 15, 20) ----------
  // 틴더처럼 페이지마다 주제 하나: 소개(대화 주제) → 소속 → 대표 경험 → 이전 경력 → 관심사
  function line(name, text) {
    return h('p', { class: 'ci-line' }, icon(name), h('span', { text }));
  }
  function head(name, text) {
    return h('p', { class: 'ci-head' }, icon(name), text);
  }
  function sharedKeywords(p) {
    const mine = (S.me && S.me.keywords) || [];
    return p.id === S.pid ? [] : (p.keywords || []).filter((k) => mine.includes(k));
  }
  function careersOf(p) {
    return (p.careers || []).filter((c) => c && (c.org || c.role));
  }
  function pagesOf(p) {
    const pages = ['intro', 'org'];
    if ((p.experiences || []).length) pages.push('exp');
    if (careersOf(p).length) pages.push('career');
    if ((p.keywords || []).length) pages.push('tags');
    return pages;
  }
  function cardPage(p, kind) {
    const shared = sharedKeywords(p);
    if (kind === 'intro') {
      return [
        shared.length
          ? h('span', { class: 'ci-badge shared' }, icon('sparkle'), '나와 같은 관심 ' + shared.length + '개')
          : h('span', { class: 'ci-badge' }, p.field),
        null, // 이름 자리
        line('briefcase', p.title),
        line('building', p.company),
        h('p', { class: 'ci-bio' }, h('span', { class: 'ci-bio-text', text: '“' + p.topic + '”' })),
        h('button', { type: 'button', class: 'ci-more', 'data-more': '' }, '프로필 전체 보기'),
      ];
    }
    if (kind === 'org') {
      return [
        null,
        line('building', p.company),
        (p.lookingFor || []).length ? line('search', '찾고 있어요: ' + p.lookingFor.join(', ')) : null,
        p.companyIntro ? line('info', p.companyIntro) : null,
        line('tag', p.field + ' · ' + yearsLabel(p.years)),
      ];
    }
    if (kind === 'exp') {
      return [null, head('star', '대표 경험'),
        h('ul', { class: 'ci-list' }, (p.experiences || []).map((x) => h('li', null, h('span', { class: 'clamp', text: x }))))];
    }
    if (kind === 'career') {
      // 기간은 윗줄에 작게, 소속·역할은 아랫줄에 (기간 때문에 역할이 잘리지 않게)
      return [null, head('history', '이전 경력'),
        h('ul', { class: 'ci-list' }, careersOf(p).map((c) => h('li', null,
          c.period ? h('span', { class: 'ci-period', text: c.period }) : null,
          h('span', { class: 'clamp', text: [c.org, c.role].filter(Boolean).join(' · ') }))))];
    }
    return [null, head('tag', '관심 키워드'),
      h('div', { class: 'ci-chips' }, p.keywords.map((k) => h('span', { class: 'ci-chip' + (shared.includes(k) ? ' shared' : ''), text: k })))];
  }
  // 이름 옆에는 숫자를 두지 않습니다 (연차가 나이처럼 읽히지 않게). 연차는 '경력 N년'으로 소속 페이지에.
  function nameEl(p) {
    return h('h3', { class: 'ci-name' }, h('span', { text: p.name }));
  }
  function setPage(card, i) {
    const p = card._p;
    card._page = i;
    card.querySelectorAll('.bars i').forEach((b, k) => b.classList.toggle('on', k === i));
    const parts = cardPage(p, card._pages[i]);
    // 소개 페이지는 배지 다음, 나머지는 맨 위에 이름
    const at = parts.indexOf(null);
    parts[at] = nameEl(p);
    card.querySelector('.ci').replaceChildren(...parts.filter(Boolean));
  }
  function tapCard(card, clientX, target) {
    if (target && target.closest('[data-more]')) { openSheet(card._p, { from: card._swipe ? 'deck' : 'view' }); return; }
    const r = card.getBoundingClientRect();
    const dir = clientX - r.left > r.width / 2 ? 1 : -1;
    const next = card._page + dir;
    if (next < 0 || next >= card._pages.length) {
      card.classList.remove('nudge-l', 'nudge-r');
      void card.offsetWidth;
      card.classList.add(dir > 0 ? 'nudge-r' : 'nudge-l');
      return;
    }
    setPage(card, next);
  }

  function cardEl(p, { swipe = false } = {}) {
    const pages = pagesOf(p);
    const card = h('article', { class: 'card', 'data-id': p.id },
      ...visualEls(p),
      h('div', { class: 'bars', 'aria-hidden': 'true' }, pages.map(() => h('i'))),
      swipe ? [h('span', { class: 'stamp like', 'aria-hidden': 'true' }, 'LIKE'), h('span', { class: 'stamp nope', 'aria-hidden': 'true' }, 'PASS')] : null,
      h('div', { class: 'ci' }),
      h('button', {
        type: 'button', class: 'card-more', 'aria-label': p.name + ' 프로필 전체 보기',
        onclick: (e) => { e.stopPropagation(); openSheet(p, { from: swipe ? 'deck' : 'view' }); },
      }, icon('up')));
    card._p = p;
    card._swipe = swipe;
    card._pages = pages;
    card.dataset.u = String(p.updatedAt || '');
    setPage(card, 0);
    if (!swipe) {
      card.addEventListener('click', (e) => { if (!e.target.closest('.card-more')) tapCard(card, e.clientX, e.target); });
      card.addEventListener('animationend', () => card.classList.remove('nudge-l', 'nudge-r'));
    }
    return card;
  }

  // ---------- 화면 결정 ----------
  function visibleProfiles() {
    return [...S.profiles.values()].filter((p) => !p.hidden);
  }
  const picksFull = () => S.swipes.likes.length >= MAX;
  // 한 번이라도 다 고르면(또는 카드를 다 넘기면) LIKE 목록이 열리고, 그 뒤로는 계속 열려 있습니다.
  const unlocked = () => picksFull() || !!(S.me && S.me.done) || S.phase === 'ended';

  function decide() {
    if (location.hash === '#admin') return 'admin';
    if (!S.pid) return 'onboard';
    if (!S.me) return 'loading';
    if (S.editing) return 'onboard';
    return 'app';
  }

  function route() {
    if (!S.store || S.view === 'error') return;
    const next = decide();
    if (next !== S.view) {
      if (S.view) shield();
      S.view = next;
      VIEWS.forEach((v) => { $('view-' + v).hidden = v !== next; });
      $('app').classList.toggle('wide', next === 'admin');
      $('demo-chip').hidden = !(S.store.mode === 'demo' && next !== 'admin');
      if (next === 'onboard') {
        if (S.editing) startOnboarding('edit');
        else if (!OB.mode || OB.mode === 'edit') startOnboarding('login');
      }
      if (next === 'admin') enterAdmin();
    }
    render();
  }

  function render() {
    if (S.view === 'app') { renderApp(); checkNews(); }
    else if (S.view === 'admin') renderAdmin();
    if (S.store && S.store.mode === 'demo') {
      $('demo-phase').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.phase === S.phase)));
    }
  }

  function showFatal(title, text, detail) {
    $('error-title').textContent = title;
    $('error-text').textContent = text;
    $('error-detail').textContent = detail || '';
    VIEWS.forEach((v) => { $('view-' + v).hidden = v !== 'error'; });
    S.view = 'error';
  }

  async function enterAs(pid) {
    S.unsub.forEach((u) => u());
    S.unsub = [];
    S.pid = pid;
    S.me = S.profiles.get(pid) || null;
    S.swipes = { likes: [], passes: [] };
    S.inbox = [];
    S.deckOrder = [];
    S.myLinkedin = '';
    S.met = [];
    S.tab = 'swipe';
    S.deckInitAt = 0;
    seen = null;
    matchQueue = [];
    store.set(LS_PID, pid);
    const ss = session.load();
    S.history = Array.isArray(ss.history) ? ss.history : [];
    S.continuing = !!ss.continuing;
    S.browsing = !!ss.browsing;
    S.viewed = new Set(store.json(lsViewed()) || []);
    S.newIds = new Set();
    S.swipesLoaded = false;
    S.inboxLoaded = false;
    wasHidden = null;
    S.unsub.push(S.store.watchSwipes(pid, (sw) => {
      S.swipes = { likes: (sw.likes || []).slice(), passes: (sw.passes || []).slice() };
      S.swipesLoaded = true;
      onData();
    }));
    S.unsub.push(S.store.watchInbox(pid, (list) => { S.inbox = list; S.inboxLoaded = true; onData(); }));
    S.unsub.push(S.store.watchPrivate(pid, (v) => { S.myLinkedin = v.linkedin || ''; S.met = (v.met || []).slice(); onData(); }));
  }
  function signOut() {
    S.unsub.forEach((u) => u());
    S.unsub = [];
    S.pid = null;
    S.me = null;
    S.editing = false;
    S.continuing = false;
    S.browsing = false;
    S.history = [];
    OB.mode = null;
    store.del(LS_PID);
    store.del(LS_EDIT);
  }

  // ---------- 가입·프로필 입력 (3, 6, 11, 12) ----------
  const LOGIN_STEPS = ['welcome', 'name', 'pin', 'rules'];
  const PROFILE_STEPS = ['company', 'logo', 'job', 'exp', 'topic', 'tags', 'contact'];
  const OB = { mode: null, base: [], i: 0, d: null, hash: null, pid: null, busy: false, flagged: false, leaveAt: 0 };
  // 명단에서 로고를 찾은 회사는 로고 화면을 건너뜁니다.
  const obSteps = () => OB.base.filter((s) => !(s === 'logo' && mappedLogo(OB.d && OB.d.company)));
  const stepId = () => obSteps()[OB.i];
  const isEdit = () => OB.mode === 'edit';

  function blankDraft() {
    return { name: '', pin: '', company: '', companyIntro: '', logo: null, title: '', field: '', years: '',
      experiences: ['', '', ''], careers: [], topic: '', keywords: [], lookingFor: [], extraKeywords: [], linkedin: '' };
  }
  function draftFrom(p) {
    const d = blankDraft();
    Object.assign(d, {
      name: p.name, company: p.company, companyIntro: p.companyIntro || '', logo: p.logo || null,
      title: p.title, field: p.field, years: p.years, topic: p.topic,
      keywords: (p.keywords || []).slice(), lookingFor: (p.lookingFor || []).slice(),
      careers: careersOf(p).map((c) => Object.assign({}, c)),
      linkedin: S.myLinkedin,
    });
    const ex = (p.experiences || []).slice(0, 3);
    d.experiences = [ex[0] || '', ex[1] || '', ex[2] || ''];
    d.extraKeywords = d.keywords.filter((k) => !KEYWORDS.includes(k));
    return d;
  }

  // 입력 중인 내용은 이 기기에 임시로 저장해 두었다가, 새로고침해도 이어서 입력합니다. (번호는 저장하지 않음)
  // 새로 가입할 때와 프로필을 고칠 때 따로 보관합니다.
  function saveDraft() {
    if (!OB.d) return;
    const d = Object.assign({}, OB.d, { pin: '' });
    delete d._field; delete d._years;
    if (OB.mode === 'login') {
      store.set(LS_DRAFT, JSON.stringify({ step: stepId(), d, hash: OB.hash, pid: OB.pid, at: Date.now() }));
    } else if (isEdit() && S.pid && stepId() !== 'editmenu') {
      store.set(LS_EDIT, JSON.stringify({ pid: S.pid, step: stepId(), d, at: Date.now() }));
    }
  }
  const clearDraft = () => store.del(LS_DRAFT);
  const fresh12h = (saved) => saved && saved.d && Date.now() - (saved.at || 0) < 12 * 3600 * 1000;

  function startOnboarding(mode) {
    OB.mode = mode;
    OB.i = 0;
    OB.hash = null;
    OB.pid = null;
    let restored = '';
    if (mode === 'edit') {
      OB.base = ['editmenu'].concat(PROFILE_STEPS);
      OB.d = draftFrom(S.me);
      const saved = store.json(LS_EDIT);
      if (fresh12h(saved) && saved.pid === S.pid) {
        OB.d = Object.assign(blankDraft(), saved.d);
        const idx = obSteps().indexOf(saved.step);
        if (idx > 0) { OB.i = idx; restored = '수정하던 내용을 불러왔어요. 저장하기를 눌러야 반영돼요.'; }
      }
    } else {
      OB.base = LOGIN_STEPS.concat(PROFILE_STEPS);
      OB.d = blankDraft();
      const saved = store.json(LS_DRAFT);
      if (fresh12h(saved)) {
        OB.d = Object.assign(blankDraft(), saved.d, { pin: '' });
        if (saved.hash) {
          OB.hash = saved.hash;
          OB.pid = saved.pid || null;
          const idx = obSteps().indexOf(saved.step);
          OB.i = idx > 3 ? idx : 3;
          restored = '입력하던 내용을 불러왔어요.';
        }
      }
    }
    fillInputs();
    showStep();
    if (restored) toast(restored, 3000);
  }

  // 글자 수 제한이 있는 칸: 제한에 가까워지면 글자 수를, 꽉 차면 빨갛게 알려 줍니다 (잘리는 줄 모르고 쓰지 않게).
  function limitCount(input) {
    const max = Number(input.getAttribute('maxlength'));
    const c = h('span', { class: 'mini-count', 'aria-live': 'polite', hidden: true });
    input._count = () => {
      const n = input.value.length;
      c.hidden = n < Math.max(8, Math.floor(max * 0.7));
      c.textContent = n >= max ? max + '자까지 들어가요' : n + '/' + max;
      c.classList.toggle('full', n >= max);
      input.classList.toggle('at-max', n >= max);
    };
    input.addEventListener('input', input._count);
    return c;
  }
  function withCount(input, cls) {
    return h('div', { class: 'field' + (cls ? ' ' + cls : '') }, input, limitCount(input));
  }
  const exampleFor = (field) => EXAMPLES[field] || EXAMPLES['데이터'];
  // 직무 분야를 고르면 경험·이야기 칸의 예시도 그 분야에 맞게 바꿉니다.
  function applyExamples() {
    const ex = exampleFor(OB.d.field);
    $('in-exps').querySelectorAll('input').forEach((el, i) => { el.placeholder = i < 2 ? '예) ' + ex.exps[i] : '경험 하나 더 (선택)'; });
    $('in-topic').placeholder = '예) ' + ex.topic;
  }

  function fillInputs() {
    const d = OB.d;
    const ex = ND.EXAMPLE_PROFILE || {};
    $('in-name').value = d.name;
    $('in-pin').value = '';
    $('in-company').value = d.company;
    $('in-company').placeholder = '예) ' + (ex.company || '');
    $('in-intro').value = d.companyIntro;
    $('in-intro').placeholder = '예) ' + (ex.companyIntro || '');
    $('in-title').value = d.title;
    $('in-title').placeholder = '예) 엔지니어, 심사역, 대표';
    $('in-topic').value = d.topic;
    $('in-linkedin').value = d.linkedin;
    $('in-exps').replaceChildren(...[0, 1, 2].map((i) => withCount(h('input', {
      class: 'box-input', type: 'text', maxlength: 60, enterkeyhint: i < 2 ? 'next' : 'done', 'aria-label': '대표 경험 ' + (i + 1),
      value: d.experiences[i],
      oninput: (e) => { d.experiences[i] = e.target.value; syncNext(); },
    }))));
    ['in-company', 'in-intro', 'in-title'].forEach((id) => { if ($(id)._count) $(id)._count(); });
    $('in-exps').querySelectorAll('input').forEach((el) => el._count());
    updateTopicCount();
    applyExamples();
    renderCareers();
    renderPills();
    renderCompanyLogo();
    renderLogoSlot();
  }
  function updateTopicCount() {
    const n = $('in-topic').value.length;
    $('topic-count').textContent = n >= 60 ? '60자까지 들어가요' : n + '/60';
    $('topic-count').classList.toggle('full', n >= 60);
    $('in-topic').classList.toggle('at-max', n >= 60);
  }

  function renderCareers() {
    const d = OB.d;
    $('in-careers').replaceChildren(...d.careers.map((c, idx) => {
      const field = (key, ph, cls) => withCount(h('input', {
        class: 'box-input', type: 'text', maxlength: key === 'period' ? 20 : 30, enterkeyhint: 'next',
        'aria-label': { period: '기간', org: '소속', role: '역할' }[key], placeholder: ph, value: c[key] || '',
        oninput: (e) => { c[key] = e.target.value; syncNext(); },
      }), cls);
      return h('div', { class: 'career' },
        field('period', '기간 예) 2018–2021'),
        h('button', { type: 'button', class: 'text-btn del', onclick: () => { d.careers.splice(idx, 1); renderCareers(); syncNext(); } }, '삭제'),
        field('org', '소속 예) 이전 회사·연구실', 'full'),
        field('role', '역할 예) 선임연구원', 'full'));
    }));
    $('in-careers').querySelectorAll('input').forEach((el) => el._count());
    $('career-add').hidden = d.careers.length >= MAX_CAREERS;
  }

  function pills(container, options, selected, { single = false, max = 99, full = '' } = {}) {
    container.replaceChildren(...options.map((opt) => {
      const on = selected.includes(opt);
      return h('button', {
        type: 'button', class: 'pill',
        role: single ? 'radio' : null,
        'aria-checked': single ? String(on) : null,
        'aria-pressed': single ? null : String(on),
        onclick: () => {
          if (single) { selected.length = 0; selected.push(opt); }
          else if (selected.includes(opt)) selected.splice(selected.indexOf(opt), 1);
          else if (selected.length >= max) { toast(full, 3000); return; }
          else selected.push(opt);
          renderPills();
          syncNext();
        },
      }, opt);
    }));
  }
  const KW_FULL = '관심 키워드는 ' + MAX_KEYWORDS + '개까지 고를 수 있어요. 하나를 빼고 골라 주세요.';
  function renderPills() {
    const d = OB.d;
    const prevField = d.field;
    d._field = d._field || (d.field ? [d.field] : []);
    d._years = d._years || (d.years ? [d.years] : []);
    pills($('in-field'), FIELDS, d._field, { single: true });
    pills($('in-years'), YEARS, d._years, { single: true });
    d.field = d._field[0] || '';
    d.years = d._years[0] || '';
    if (d.field !== prevField) applyExamples();
    pills($('in-keywords'), KEYWORDS.concat(d.extraKeywords), d.keywords, { max: MAX_KEYWORDS, full: KW_FULL });
    pills($('in-looking'), LOOKING, d.lookingFor, { max: MAX_LOOKING, full: '찾고 있는 것은 ' + MAX_LOOKING + '개까지 고를 수 있어요.' });
    $('kw-count').textContent = d.keywords.length + '/' + MAX_KEYWORDS;
    $('look-count').textContent = d.lookingFor.length + '/' + MAX_LOOKING;
  }
  function addCustomKeyword() {
    const d = OB.d;
    const v = cleanText($('kw-custom').value, 15);
    if (!v) return;
    // 꽉 찼으면 목록에 추가하지도 않습니다 (고르지 못한 칩이 남지 않게).
    if (!d.keywords.includes(v) && d.keywords.length >= MAX_KEYWORDS) { toast(KW_FULL, 3000); return; }
    if (!KEYWORDS.includes(v) && !d.extraKeywords.includes(v)) d.extraKeywords.push(v);
    if (!d.keywords.includes(v)) d.keywords.push(v);
    $('kw-custom').value = '';
    renderPills();
    syncNext();
  }

  // 회사 이름을 입력하는 화면에서 명단의 로고를 바로 보여 줍니다.
  function renderCompanyLogo() {
    const mapped = mappedLogo(OB.d.company);
    $('company-logo').hidden = !mapped;
    if (mapped) $('company-logo-tile').replaceChildren(logoEl({ company: OB.d.company }));
  }
  function renderLogoSlot() {
    const d = OB.d;
    const slot = $('logo-slot');
    const badge = $('logo-badge');
    if (d.logo || cleanText(d.company, 30)) {
      slot.replaceChildren(logoEl({ logo: d.logo, company: d.company }));
      slot.classList.add('filled');
    } else {
      slot.replaceChildren();
      slot.classList.remove('filled');
    }
    badge.replaceChildren(icon(d.logo ? 'x' : 'plus'));
    badge.classList.toggle('remove', !!d.logo);
    badge.setAttribute('aria-label', d.logo ? '로고 지우기' : '로고 추가');
  }

  // 프로필 수정: 고칠 항목만 골라 들어갑니다 (처음부터 모든 단계를 거치지 않게).
  function renderEditMenu() {
    const d = OB.d;
    const ln = normLinkedin(d.linkedin);
    const exps = d.experiences.map((x) => cleanText(x, 60)).filter(Boolean);
    const careers = d.careers.filter((c) => c.org || c.role).length;
    const mapped = !!mappedLogo(d.company);
    const items = [
      ['company', '회사', [d.company, d.companyIntro].filter(Boolean).join(' · ')],
      ['logo', '로고', mapped ? '참가 명단 로고 (자동)' : d.logo ? '직접 올린 로고' : '회사 이름 첫 글자'],
      ['job', '직무', [d.title, d.field, yearsLabel(d.years)].filter(Boolean).join(' · ')],
      ['exp', '경험·이전 경력', (exps[0] || '') + (exps.length > 1 ? ' 외 ' + (exps.length - 1) + '개' : '') + (careers ? ' · 이전 경력 ' + careers + '개' : '')],
      ['topic', '나누고 싶은 이야기', d.topic],
      ['tags', '관심 키워드·찾고 있어요', d.keywords.concat(d.lookingFor).join(', ') || '없음'],
      ['contact', '링크드인', ln ? ln.replace('https://www.', '') : '없음'],
    ];
    $('edit-list').replaceChildren(...items.map(([step, label, val]) => {
      const locked = step === 'logo' && mapped;
      return h('li', null, h('button', {
        type: 'button', class: 'edit-item', disabled: locked,
        onclick: () => gotoStep(step),
      }, h('span', { class: 'ei-k', text: label }), h('span', { class: 'ei-v', text: val || '—' }),
      locked ? null : h('span', { class: 'ei-go', 'aria-hidden': 'true' }, '›')));
    }));
  }
  function gotoStep(step) {
    const idx = obSteps().indexOf(step);
    if (idx < 0) return;
    hideToast();
    OB.i = idx;
    shield();
    showStep();
  }
  function leaveEdit() {
    S.editing = false;
    OB.mode = null;
    store.del(LS_EDIT);
    S.tab = 'me';
    route();
  }

  // 올린 로고를 정리해 저장합니다.
  // 1) 이미지 자체(여백을 붙이기 전)로 투명 배경인지, 밝은 로고인지 판단합니다.
  // 2) 바깥 여백(투명 또는 바탕색)을 잘라 내 로고가 타일을 꽉 채우게 합니다.
  // 3) 비율을 지킨 채 긴 변 320px로 줄입니다. 투명 배경은 투명 그대로, 나머지는 원래 바탕색 그대로.
  function trimBox(px, w, h, transparent) {
    const at = (x, y) => (y * w + x) * 4;
    const corner = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)];
    const bg = [0, 1, 2].map((k) => corner.reduce((s, i) => s + px[i + k], 0) / 4);
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = at(x, y);
        const ink = transparent
          ? px[i + 3] >= 40
          : px[i + 3] >= 40 && Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]) > 60;
        if (!ink) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    if (x1 < 0) return { x: 0, y: 0, w, h, bg };
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, bg };
  }
  function processLogo(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('type')); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const iw = img.naturalWidth || 1;
          const ih = img.naturalHeight || 1;
          // 판단·여백 찾기는 작은 사본으로
          const s = Math.min(1, 128 / Math.max(iw, ih));
          const aw = Math.max(1, Math.round(iw * s)), ah = Math.max(1, Math.round(ih * s));
          const a = document.createElement('canvas');
          a.width = aw; a.height = ah;
          const actx = a.getContext('2d', { willReadFrequently: true });
          actx.drawImage(img, 0, 0, aw, ah);
          const px = actx.getImageData(0, 0, aw, ah).data;
          const look = analyzePixels(px);
          const transparent = look.clearRatio > 0.05;
          const box = trimBox(px, aw, ah, transparent);
          // 잘라 낼 영역(원본 좌표) + 사방 6% 여백
          const sx = box.x / s, sy = box.y / s, sw = box.w / s, sh = box.h / s;
          const pad = Math.round(Math.max(sw, sh) * 0.06);
          const fill = transparent ? null : 'rgb(' + box.bg.map(Math.round).join(',') + ')';
          const encode = (max) => {
            const r = Math.min(2, max / (Math.max(sw, sh) + pad * 2));
            const cw = Math.max(1, Math.round((sw + pad * 2) * r)), chh = Math.max(1, Math.round((sh + pad * 2) * r));
            const c = document.createElement('canvas');
            c.width = cw; c.height = chh;
            const ctx = c.getContext('2d');
            ctx.imageSmoothingQuality = 'high';
            if (fill) { ctx.fillStyle = fill; ctx.fillRect(0, 0, cw, chh); }
            ctx.drawImage(img, sx, sy, sw, sh, pad * r, pad * r, sw * r, sh * r);
            let out = c.toDataURL('image/webp', 0.9);
            if (!out.startsWith('data:image/webp')) out = transparent ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9);
            return out;
          };
          // 서버 규칙의 크기 제한(15만 자) 안으로
          let out = encode(320);
          if (out.length > 140000) out = encode(240);
          if (out.length > 140000) out = encode(160);
          if (out.length > 140000) { reject(new Error('size')); return; }
          resolve(out);
        } catch (ex) {
          reject(ex);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }

  // 빠진 항목: 안내 문구와, 빨갛게 표시할 칸들. 직무 화면처럼 여러 개가 빠지면 한꺼번에 알려 줍니다 (6).
  function missing(id) {
    const d = OB.d;
    const one = (text, ...els) => ({ text, els });
    if (id === 'name' && cleanText(d.name, 20).length < 2) return one('이름을 두 글자 이상 입력해 주세요.', 'in-name');
    if (id === 'pin' && !/^\d{4}$/.test(d.pin)) return one('휴대폰 번호 뒤 4자리를 숫자로 입력해 주세요.', 'in-pin');
    if (id === 'company' && !cleanText(d.company, 30)) return one('회사·기관명을 입력해 주세요.', 'in-company');
    if (id === 'job') {
      const miss = [];
      if (!cleanText(d.title, 30)) miss.push(['직함', '직함·직무를 입력해 주세요.', ['in-title']]);
      if (!d.field) miss.push(['직무 분야', '직무 분야를 골라 주세요.', ['lbl-field', 'in-field']]);
      if (!d.years) miss.push(['경력', '경력 연차를 골라 주세요.', ['lbl-years', 'in-years']]);
      if (miss.length === 1) return one(miss[0][1], ...miss[0][2]);
      if (miss.length) return { text: '빠진 항목이 있어요: ' + miss.map((m) => m[0]).join(', '), els: miss.flatMap((m) => m[2]) };
    }
    if (id === 'exp' && !d.experiences.some((x) => cleanText(x, 60))) return one('대표 경험을 하나 이상 입력해 주세요.', 'lbl-exps', 'in-exps');
    if (id === 'topic' && !cleanText(d.topic, 60)) return one('나누고 싶은 이야기를 한 줄 적어 주세요.', 'in-topic');
    if (id === 'contact' && normLinkedin(d.linkedin) === null) return one('linkedin.com/in/ 이 들어간 주소를 입력하거나 칸을 비워 두세요.', 'in-linkedin');
    return null;
  }
  function flagMissing(miss) {
    document.querySelectorAll('#view-onboard .need').forEach((el) => el.classList.remove('need'));
    if (!miss) { OB.flagged = false; $('ob-msg').hidden = true; return; }
    miss.els.forEach((id) => { const el = $(id); if (el) el.classList.add('need'); });
    $('ob-msg').textContent = miss.text;
    $('ob-msg').hidden = false;
  }
  function nextLabel(id) {
    const d = OB.d;
    if (id === 'welcome') return '시작하기';
    if (id === 'rules') return '동의합니다';
    if (isEdit()) return id === 'editmenu' ? '완료' : '저장하기';
    if (id === 'logo') return d.logo ? '계속' : '로고 없이 계속';
    if (id === 'contact') return String(d.linkedin || '').trim() ? '완료' : '건너뛰고 완료';
    return '계속';
  }
  function syncNext() {
    const id = stepId();
    const btn = $('ob-next');
    const miss = missing(id);
    btn.disabled = OB.busy;
    btn.classList.toggle('dim', !!miss); // 흐리게만 표시하고 누르면 빠진 항목을 알려 줌
    btn.textContent = OB.busy ? '잠시만요' : nextLabel(id);
    // 한 번 알려 준 뒤에는 입력할 때마다 남은 항목만 다시 표시합니다.
    if (OB.flagged) flagMissing(miss); else $('ob-msg').hidden = true;
    saveDraft();
  }

  function showStep() {
    const steps = obSteps();
    if (OB.i >= steps.length) OB.i = steps.length - 1;
    const id = stepId();
    const edit = isEdit();
    document.querySelectorAll('.ob-step').forEach((s) => { s.hidden = s.dataset.step !== id; });
    $('view-onboard').classList.toggle('is-welcome', id === 'welcome');
    $('ob-progress').style.visibility = edit ? 'hidden' : '';
    $('ob-mode').hidden = !edit;
    if (!edit) {
      const counted = steps.filter((s) => s !== 'welcome');
      const pos = steps.slice(0, OB.i + 1).filter((s) => s !== 'welcome').length;
      $('ob-bar').style.width = (pos / counted.length) * 100 + '%';
    }
    $('ob-back').hidden = id === 'welcome';
    $('ob-foot-note').hidden = id !== 'welcome';
    $('ob-body').scrollTop = 0;
    OB.flagged = false;
    flagMissing(null);
    if (id === 'logo') renderLogoSlot();
    if (id === 'editmenu') renderEditMenu();
    syncNext();
    if (canGoBackInApp()) armBack();
    const focusTarget = { name: 'in-name', pin: 'in-pin', company: 'in-company', job: 'in-title', topic: 'in-topic', contact: 'in-linkedin' }[id];
    const target = focusTarget ? $(focusTarget) : id === 'exp' ? $('in-exps').querySelector('input') : null;
    if (target) setTimeout(() => { if (S.view === 'onboard' && stepId() === id) target.focus({ preventScroll: true }); }, 60);
  }

  // 고치던 내용이 저장한 프로필과 다른지
  const editDirty = () => JSON.stringify(collectProfile()) !== JSON.stringify(collectProfileOf(draftFrom(S.me)))
    || (normLinkedin(OB.d.linkedin) || '') !== S.myLinkedin;
  function obBack() {
    if (OB.busy) return;
    hideToast();
    if (isEdit()) {
      if (stepId() === 'editmenu') { leaveEdit(); return; }
      if (editDirty() && Date.now() - OB.leaveAt > 3000) {
        OB.leaveAt = Date.now();
        toast('저장하지 않은 내용이 있어요. 한 번 더 누르면 저장하지 않고 나가요.', 3000);
        return;
      }
      // 저장하지 않고 항목에서 나가면 고치던 내용은 버립니다.
      OB.leaveAt = 0;
      OB.d = draftFrom(S.me);
      store.del(LS_EDIT);
      fillInputs();
      OB.i = 0;
      shield();
      showStep();
      return;
    }
    if (OB.i > 0) { OB.i--; shield(); showStep(); }
  }

  async function obNext() {
    const id = stepId();
    if (OB.busy) return;
    if (id === 'editmenu') { leaveEdit(); return; }
    const miss = missing(id);
    if (miss) {
      OB.flagged = true;
      flagMissing(miss);
      const first = $(miss.els[0]);
      if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const btn = $('ob-next');
      btn.classList.remove('shake');
      void btn.offsetWidth;
      btn.classList.add('shake');
      return;
    }
    hideToast();
    if (id === 'pin') { await lookup(); return; }
    if (isEdit() || OB.i === obSteps().length - 1) { await saveProfile(); return; }
    OB.i++;
    shield();
    showStep();
  }

  async function lookup() {
    const d = OB.d;
    OB.busy = true; syncNext();
    try {
      d.name = cleanText(d.name, 20);
      const hash = await keyHash(d.name, d.pin);
      const pid = await S.store.findKey(hash);
      if (pid) await S.store.claim(hash, pid);
      if (pid && (!S.profilesLoaded || S.profiles.has(pid))) {
        OB.mode = null;
        clearDraft();
        await enterAs(pid);
        toast(d.name + '님, 다시 오셨네요.');
        route();
      } else {
        // 처음 왔거나, 운영진이 프로필을 지운 경우(키는 남아 있음) 새로 입력
        OB.hash = hash;
        OB.pid = pid || null;
        OB.i++;
        shield();
        showStep();
      }
    } catch (ex) {
      console.error(ex);
      $('ob-msg').textContent = '확인하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';
      $('ob-msg').hidden = false;
    } finally {
      OB.busy = false;
      if (S.view === 'onboard') { const msg = $('ob-msg').hidden; syncNext(); $('ob-msg').hidden = msg; }
    }
  }

  function collectProfileOf(d) {
    return {
      company: cleanText(d.company, 30),
      companyIntro: cleanText(d.companyIntro, 40),
      logo: d.logo || null,
      title: cleanText(d.title, 30),
      field: d.field,
      years: d.years,
      experiences: d.experiences.map((x) => cleanText(x, 60)).filter(Boolean),
      careers: d.careers.map((c) => ({
        period: cleanText(c.period, 20), org: cleanText(c.org, 30), role: cleanText(c.role, 30),
      })).filter((c) => c.org || c.role),
      keywords: d.keywords.slice(0, MAX_KEYWORDS),
      lookingFor: d.lookingFor.slice(0, MAX_LOOKING),
      topic: cleanText(d.topic, 60),
    };
  }
  const collectProfile = () => collectProfileOf(OB.d);

  async function saveProfile() {
    const data = collectProfile();
    const ln = normLinkedin(OB.d.linkedin) || '';
    if (isEdit()) {
      // 고친 내용은 바로 화면에 반영하고 저장은 뒤에서 합니다 (연결이 느려도 기다리지 않게).
      const lnChanged = ln !== S.myLinkedin;
      const likes = S.swipes.likes.slice();
      enqueue(async () => {
        await S.store.updateProfile(S.pid, data);
        if (lnChanged) await S.store.savePrivate(S.pid, { linkedin: ln }, likes);
      });
      S.myLinkedin = ln;
      S.me = Object.assign({}, S.me, data);
      meKey = '';
      store.del(LS_EDIT);
      OB.d = draftFrom(S.me);
      fillInputs();
      OB.i = 0;
      shield();
      showStep();
      toast('저장했어요.');
      return;
    }
    if (navigator.onLine === false) {
      $('ob-msg').textContent = '인터넷 연결이 끊겼어요. 연결된 뒤 다시 눌러 주세요.';
      $('ob-msg').hidden = false;
      return;
    }
    OB.busy = true; syncNext();
    try {
      const name = OB.d.name;
      S.creating = true;
      const pid = await S.store.createProfile(OB.hash, Object.assign({ name }, data), OB.pid);
      if (ln || OB.pid) await S.store.savePrivate(pid, { linkedin: ln, met: [] }, []);
      await enterAs(pid);
      S.myLinkedin = ln;
      S.me = S.profiles.get(pid) || Object.assign({ id: pid, name, hidden: false, done: false }, data);
      S.creating = false;
      OB.mode = null;
      clearDraft();
      route();
    } catch (ex) {
      console.error(ex);
      S.creating = false;
      toast('저장하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.', 3200);
    } finally {
      OB.busy = false;
      if (S.view === 'onboard') syncNext();
    }
  }

  // ---------- 메인 ----------
  function inboxPeople() {
    const mine = new Set(S.swipes.likes);
    return S.inbox
      .map((x) => ({ p: S.profiles.get(x.id), at: x.at }))
      .filter((x) => x.p && !x.p.hidden && x.p.id !== S.pid)
      .sort((a, b) => (mine.has(b.p.id) - mine.has(a.p.id)) || (b.at - a.at));
  }
  function minePeople() {
    return S.swipes.likes.map((id) => S.profiles.get(id)).filter((p) => p && !p.hidden);
  }
  // 넘긴 사람 (최근에 넘긴 사람부터)
  function passedPeople() {
    return S.swipes.passes.slice().reverse().map((id) => S.profiles.get(id)).filter((p) => p && !p.hidden && p.id !== S.pid);
  }
  const canPick = (p) => !!p && S.phase === 'swipe' && !picksFull() && p.id !== S.pid && !S.swipes.likes.includes(p.id);
  const unviewedCount = () => inboxPeople().filter((x) => !S.viewed.has(x.p.id)).length;

  function renderApp() {
    ['swipe', 'likes', 'me'].forEach((t) => {
      $('tab-' + t).hidden = S.tab !== t;
      const b = $('tb-' + t);
      if (S.tab === t) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (S.tab === 'swipe') renderSwipeTab();
    else if (S.tab === 'likes') renderLikesTab();
    else renderMeTab();
    // 배지: 아직 확인하지 않은 '나를 고른 사람' 수
    const n = unviewedCount();
    $('tb-badge').hidden = n === 0;
    $('tb-badge').textContent = String(n);
  }
  function goTab(t) {
    if (t !== S.tab) { hideToast(); shield(); }
    if (t === 'likes') { S.newIds = new Set(); likesKey = ''; }
    S.tab = t;
    renderApp();
  }

  // --- 새 LIKE·서로 선택 알림 (8) ---
  let seen = null; // { inbox: [...], mutual: [...] }  이미 알려 준 사람
  let matchQueue = []; // 아직 못 보여 준 '서로 선택'
  let likerBuf = [];
  let likerTimer = null;
  function markSeen(inIds, mutualIds) {
    seen = { inbox: Array.from(new Set((seen ? seen.inbox : []).concat(inIds))), mutual: Array.from(new Set((seen ? seen.mutual : []).concat(mutualIds))) };
    store.set(lsSeen(), JSON.stringify(seen));
  }
  function currentNews() {
    const inIds = inboxPeople().map((x) => x.p.id);
    return { inIds, mutualIds: inIds.filter((id) => S.swipes.likes.includes(id)) };
  }
  function checkNews() {
    // 고른 기록과 나를 고른 사람이 둘 다 도착한 뒤에만 판단합니다 (새 기기에서 예전 '서로 선택'이 새것처럼 뜨지 않게).
    if (!S.pid || !unlocked() || !S.profilesLoaded || !S.swipesLoaded || !S.inboxLoaded) return;
    const { inIds, mutualIds } = currentNews();
    // 상대가 선택을 되돌렸으면 '서로 선택!' 화면을 닫습니다.
    if (matchWho && !mutualIds.includes(matchWho.id)) closeMatch();
    matchQueue = matchQueue.filter((id) => mutualIds.includes(id));
    if (!seen) seen = store.json(lsSeen());
    if (!seen) {
      // 처음 열리는 순간(완료 화면)에는 지금 상태를 기준으로 삼고 따로 알리지 않습니다.
      markSeen(inIds, mutualIds);
      return;
    }
    // 완료 화면을 보는 동안에는 그 화면의 문구를 바로 바꿉니다. 닫을 때 확인한 것으로 칩니다.
    if (!$('finish').hidden) { renderFinish(); return; }
    const newIn = inIds.filter((id) => !seen.inbox.includes(id) && !mutualIds.includes(id));
    const newMutual = mutualIds.filter((id) => !seen.mutual.includes(id));
    if (newIn.length || newMutual.length) {
      markSeen(inIds, mutualIds);
      newMutual.forEach((id) => { if (!matchQueue.includes(id)) matchQueue.push(id); });
      if (newIn.length) likerToast(newIn);
    }
    // 프로필을 보는 중이면 닫은 뒤에, 여러 명이면 한 명씩 차례로 보여 줍니다.
    if ($('match').hidden && $('sheet').hidden && matchQueue.length) showMatch(S.profiles.get(matchQueue.shift()));
  }
  // 몇 초 안에 여러 명이 고르면 앞사람 안내를 덮어쓰지 않고 'OOO 외 N명'으로 합칩니다.
  function likerToast(ids) {
    ids.forEach((id) => { if (!likerBuf.includes(id)) likerBuf.push(id); });
    const p = S.profiles.get(likerBuf[0]);
    if (!p) return;
    toast('새로 나를 고른 사람: ' + p.name + (likerBuf.length > 1 ? ' 외 ' + (likerBuf.length - 1) + '명' : ' (' + p.company + ')'), 3500);
    clearTimeout(likerTimer);
    likerTimer = setTimeout(() => { likerBuf = []; }, 3500);
  }
  let matchWho = null;
  function showMatch(p) {
    if (!p || !S.me) return;
    matchWho = p;
    $('match-logos').replaceChildren(h('span', { class: 'fl' }, logoEl(S.me)), h('span', { class: 'fl' }, logoEl(p)));
    $('match-text').textContent = p.name + '님(' + p.company + ')과 서로 대화하고 싶어해요.';
    $('match').hidden = false;
    armBack();
  }
  function closeMatch() {
    if ($('match').hidden) return;
    $('match').hidden = true;
    matchWho = null;
    shield();
    setTimeout(() => { if (S.view === 'app') checkNews(); }, 400); // 다음 사람
  }

  // --- 스와이프 탭 ---
  function candidates() {
    const seenIds = new Set(S.swipes.likes.concat(S.swipes.passes));
    return visibleProfiles().filter((p) => p.id !== S.pid && !seenIds.has(p.id));
  }
  // 카드 순서는 사람마다 다르게 섞습니다. 고르기가 시작된 뒤에 등록한 사람은 맨 끝이 아니라
  // 앞쪽(2~4번째)에 끼워 넣어, 이미 많이 넘긴 사람도 늦게 온 사람을 볼 수 있게 합니다.
  function syncDeck() {
    const ids = new Set(candidates().map((p) => p.id));
    S.deckOrder = S.deckOrder.filter((id) => ids.has(id));
    const known = new Set(S.deckOrder);
    const fresh = [...ids].filter((id) => !known.has(id)).sort((a, b) => hash32(S.pid + a) - hash32(S.pid + b));
    if (S.phase !== 'swipe' || !S.deckInitAt) {
      S.deckOrder.push(...fresh);
      // 시작 시점에 있던 사람 중 가장 늦은 등록 시각 (기기 시계와 상관없이 서버 시각끼리 비교)
      if (S.phase === 'swipe') S.deckInitAt = Math.max(1, ...visibleProfiles().map((p) => p.createdAt || 0));
      return;
    }
    fresh.forEach((id) => {
      const p = S.profiles.get(id);
      if (p && p.createdAt > S.deckInitAt) S.deckOrder.splice(Math.min(S.deckOrder.length, 1 + (hash32(S.pid + id) % 3)), 0, id);
      else S.deckOrder.push(id);
    });
  }

  function swipeMode() {
    if (S.phase === 'registration') return 'wait';
    if (S.phase === 'ended') return 'ended';
    if (!S.deckOrder.length) { S.browsing = false; return S.me && S.me.done ? 'done' : 'empty'; }
    if (picksFull()) return S.browsing ? 'deck' : 'done';
    if (S.me && S.me.done && !S.continuing && !S.browsing) return 'done';
    return 'deck';
  }

  function renderSwipeTab() {
    syncDeck();
    $('pick-count').replaceChildren(icon('heart'), S.swipes.likes.length + ' / ' + MAX);
    const mode = swipeMode();
    $('deck-area').hidden = mode !== 'deck';
    $('radar').hidden = mode === 'deck';
    $('top-stop').hidden = !(mode === 'deck' && S.me && S.me.done);
    if (mode !== 'deck') { renderRadar(mode); clearDeck(); return; }
    $('btn-undo').disabled = !lastAction();
    $('btn-like').classList.toggle('dim', picksFull());
    renderDeck();
  }

  function makeCard(id, cls) {
    const el = cardEl(S.profiles.get(id), { swipe: true });
    el.classList.add(cls);
    if (cls === 'back') el.setAttribute('aria-hidden', 'true');
    else bindDrag(el);
    return el;
  }
  // 바뀐 카드만 다시 그립니다. 맨 위 카드가 그대로면 손대지 않아 읽던 페이지가 유지됩니다.
  function renderDeck() {
    const deck = $('deck');
    const top = S.deckOrder[0];
    const second = S.deckOrder[1] || null;
    const stale = (el, id) => !el || el.dataset.id !== id || el.dataset.u !== String((S.profiles.get(id) || {}).updatedAt || '');
    let front = deck.querySelector('.card.top');
    let back = deck.querySelector('.card.back');
    if (stale(front, top)) {
      if (front) front.remove();
      if (back && !stale(back, top)) {
        // 뒤에 있던 카드를 앞으로 (날아가는 카드와 동시에 바로 끌 수 있음)
        back.classList.replace('back', 'top');
        back.removeAttribute('aria-hidden');
        back.style.transform = '';
        bindDrag(back);
        front = back;
        back = null;
      } else {
        front = makeCard(top, 'top');
        deck.append(front);
      }
    }
    if (back && (!second || stale(back, second))) { back.remove(); back = null; }
    if (!back && second && S.profiles.get(second)) deck.insertBefore(makeCard(second, 'back'), front);
    if (!store.get(LS_COACH) && !deck.querySelector('.coach')) deck.append(coachEl());
  }
  function clearDeck() {
    [...$('deck').children].forEach((c) => { if (!c.classList.contains('flying')) c.remove(); });
  }

  // 처음 한 번만 보여 주는 사용 안내 (2)
  function dismissCoach() {
    const coach = $('deck').querySelector('.coach');
    if (coach) { store.set(LS_COACH, '1'); coach.remove(); }
  }
  function coachEl() {
    const el = h('div', { class: 'coach', role: 'dialog', 'aria-label': '사용 방법' },
      h('div', { class: 'coach-zone' }, h('b', null, '‹'), '왼쪽을 탭하면', h('br'), '이전 정보'),
      h('div', { class: 'coach-zone' }, h('b', null, '›'), '오른쪽을 탭하면', h('br'), '다음 정보'),
      h('div', { class: 'coach-foot' },
        h('ul', { class: 'coach-list' },
          h('li', null, h('b', { class: 'c-like' }, '♥'), ' 또는 오른쪽으로 밀기 = 대화하고 싶어요'),
          h('li', null, h('b', null, '✕'), ' 또는 왼쪽으로 밀기 = 넘기기'),
          h('li', null, h('b', null, '↑'), ' = 프로필 전체 보기')),
        h('button', { type: 'button', class: 'cta' }, '알겠어요')));
    el.addEventListener('click', (e) => {
      const zone = e.target.closest('.coach-zone');
      dismissCoach();
      const front = $('deck').querySelector('.card.top');
      if (zone && front) tapCard(front, e.clientX, null); // 안내를 닫으면서 누른 쪽으로 넘김
    });
    return el;
  }

  function renderRadar(mode) {
    const n = visibleProfiles().length;
    const likes = S.swipes.likes.length;
    const left = S.deckOrder.length;
    const passed = passedPeople().length;
    $('radar-ring').classList.toggle('live', mode === 'wait' || mode === 'empty');
    if (S.me) $('radar-logo').replaceChildren(logoEl(S.me));
    const goLikes = (tab, label, cls) => h('button', { type: 'button', class: cls || 'cta', onclick: () => { S.likesTab = tab; goTab('likes'); } }, label);
    const swiping = S.phase === 'swipe';
    const more = () => (likes < MAX && left
      ? h('button', { type: 'button', class: 'ghost-btn', onclick: () => { S.continuing = true; session.save(); render(); } },
        (MAX - likes) + '명 더 고르기 · 남은 카드 ' + left + '장')
      : null);
    const revisit = () => (likes < MAX && !left && passed
      ? h('button', { type: 'button', class: 'ghost-btn', onclick: revisitPasses }, '넘긴 ' + passed + '명 다시 보기')
      : null);
    const browse = () => (likes >= MAX && left && swiping
      ? h('button', { type: 'button', class: 'ghost-btn', onclick: () => { S.browsing = true; session.save(); render(); } }, '남은 카드 ' + left + '장 둘러보기')
      : null);
    const content = {
      wait: ['곧 카드가 열려요', '지금 ' + n + '명 참여 중이에요. 운영진이 시작하면 이 화면이 바로 바뀌어요.', []],
      empty: ['새 참가자를 기다리는 중', '다른 참가자가 등록하면 바로 카드가 나타나요.', [revisit()]],
      done: [likes >= MAX ? MAX + '명을 모두 골랐어요' : likes + '명을 골랐어요',
        likes >= MAX ? 'LIKE에서 누가 나를 골랐는지 확인하고 찾아가 인사해 보세요.' : '남은 자리는 더 고르거나, 이대로 LIKE를 확인해도 돼요.',
        likes >= MAX
          ? [goLikes('in', 'LIKE 확인하기'), swiping ? goLikes('out', '고른 사람 바꾸기', 'ghost-btn') : null, browse()]
          : [goLikes('in', 'LIKE 확인하기'), more(), revisit()]],
      ended: ['네트워킹 시간이에요', '명찰의 이름과 회사를 보고 찾아가 인사해 보세요.', [goLikes('in', 'LIKE 확인하기')]],
    }[mode];
    $('radar-title').textContent = content[0];
    $('radar-text').textContent = content[1];
    $('radar-actions').replaceChildren(...content[2].filter(Boolean));
  }

  // --- 고르기·넘기기·되돌리기 ---
  function saveSwipes(change, done) {
    const sw = { likes: S.swipes.likes.slice(), passes: S.swipes.passes.slice() };
    const progress = { left: S.deckOrder.length };
    enqueue(() => S.store.saveSwipe(S.pid, sw, change, done, progress));
    session.save();
  }
  function pushHistory(e) {
    S.history.push(e);
    if (S.history.length > 20) S.history.shift();
  }
  // 아직 되돌릴 수 있는 마지막 동작 (LIKE 목록에서 취소한 것 등은 건너뜀)
  function lastAction() {
    while (S.history.length) {
      const e = S.history[S.history.length - 1];
      if ((e.kind === 'like' && S.swipes.likes.includes(e.id)) || (e.kind === 'pass' && S.swipes.passes.includes(e.id))) return e;
      S.history.pop();
    }
    return null;
  }
  // 고르기를 마쳤을 때 (5명을 채웠거나 카드를 다 넘김). 완료 화면은 처음 마칠 때와 5명을 채웠을 때만.
  function finishPicking(show) {
    S.continuing = false;
    S.browsing = false;
    if (S.me) S.me = Object.assign({}, S.me, { done: true });
    session.save();
    if (show) showFinish();
  }

  // 넘긴 사람을 다시 카드로 (7)
  function revisitPasses() {
    S.swipes = { likes: S.swipes.likes.slice(), passes: [] };
    S.continuing = true;
    S.history = [];
    saveSwipes(null, null);
    render();
  }
  // 고른 사람 취소 (7). 취소한 사람은 '넘긴 사람'으로 옮겨, 카드 맨 앞에 다시 나오지 않게 합니다.
  function unpick(id) {
    if (S.phase !== 'swipe') return;
    S.swipes = { likes: S.swipes.likes.filter((x) => x !== id), passes: S.swipes.passes.filter((x) => x !== id).concat(id) };
    S.history = S.history.filter((e) => e.id !== id);
    S.browsing = false;
    likesKey = '';
    saveSwipes({ remove: id }, null);
    toast('선택을 취소했어요.');
    render();
  }
  // LIKE 목록·프로필에서 바로 고르기
  function pickDirect(id) {
    const p = S.profiles.get(id);
    if (!canPick(p)) return;
    S.swipes = { likes: S.swipes.likes.concat(id), passes: S.swipes.passes.filter((x) => x !== id) };
    S.deckOrder = S.deckOrder.filter((x) => x !== id);
    const full = picksFull();
    const setDone = full && !(S.me && S.me.done);
    pushHistory({ id, kind: 'like', setDone });
    saveSwipes({ add: id, ln: S.myLinkedin }, setDone ? true : null);
    likesKey = '';
    if (full) finishPicking(true);
    else toast(p.name + '님을 골랐어요 · ' + S.swipes.likes.length + '/' + MAX);
    render();
  }

  function bindDrag(card) {
    if (card._drag) return;
    card._drag = true;
    let sx = 0, sy = 0, dx = 0, pointer = null, decided = false, dragging = false, moved = false;
    let samples = [];
    const like = card.querySelector('.stamp.like');
    const nope = card.querySelector('.stamp.nope');
    const back = () => $('deck').querySelector('.card.back');
    const reset = () => {
      card.classList.remove('dragging');
      card.style.transform = '';
      like.style.opacity = 0;
      nope.style.opacity = 0;
      const b = back();
      if (b) b.style.transform = '';
    };
    card.addEventListener('animationend', () => card.classList.remove('nudge-l', 'nudge-r'));
    card.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !card.classList.contains('top') || e.target.closest('.card-more')) return;
      sx = e.clientX; sy = e.clientY; dx = 0; pointer = e.pointerId; decided = false; dragging = false; moved = false;
      samples = [{ x: 0, t: e.timeStamp }];
    });
    card.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pointer) return;
      const mx = e.clientX - sx;
      const my = e.clientY - sy;
      if (!decided) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        decided = true;
        moved = true;
        dragging = Math.abs(mx) > Math.abs(my);
        if (dragging) { card.setPointerCapture(pointer); card.classList.add('dragging'); }
      }
      if (!dragging) return;
      dx = mx;
      samples.push({ x: mx, t: e.timeStamp });
      if (samples.length > 6) samples.shift();
      card.style.transform = 'translate(' + dx + 'px,' + (my * 0.2) + 'px) rotate(' + (dx / 18) + 'deg)';
      like.style.opacity = Math.max(0, Math.min(1, dx / 80));
      nope.style.opacity = Math.max(0, Math.min(1, -dx / 80));
      const b = back();
      if (b) b.style.transform = 'scale(' + (0.95 + 0.05 * Math.min(1, Math.abs(dx) / 120)) + ')';
    });
    card.addEventListener('pointerup', (e) => {
      if (e.pointerId !== pointer) return;
      pointer = null;
      if (!moved) { tapCard(card, e.clientX, e.target); return; }
      if (!dragging) return;
      dragging = false;
      // 멀리 밀었거나, 짧아도 빠르게 튕겼으면 넘김
      const s0 = samples[0];
      const v = s0 && e.timeStamp > s0.t ? (dx - s0.x) / (e.timeStamp - s0.t) : 0; // px/ms
      const flick = Math.abs(dx) > 40 && Math.abs(v) > 0.45 && Math.sign(v) === Math.sign(dx);
      const kind = dx > 90 || (flick && dx > 0) ? 'like' : dx < -90 || (flick && dx < 0) ? 'pass' : null;
      if (!kind || !act(kind)) reset();
    });
    card.addEventListener('pointercancel', (e) => { if (e.pointerId === pointer) { pointer = null; dragging = false; reset(); } });
  }

  // 날아가는 카드는 덱에서 떼어 내 애니메이션만 하고, 다음 카드는 곧바로 조작할 수 있습니다.
  function flyOut(kind) {
    const card = $('deck').querySelector('.card.top');
    if (!card) return;
    card.classList.remove('top', 'dragging');
    card.classList.add('flying');
    card.setAttribute('aria-hidden', 'true');
    const stamp = card.querySelector(kind === 'like' ? '.stamp.like' : '.stamp.nope');
    if (stamp) stamp.style.opacity = 1;
    const dir = kind === 'like' ? 1 : -1;
    card.style.transform = 'translate(' + dir * 140 + '%, 40px) rotate(' + dir * 22 + 'deg)';
    card.style.opacity = '0';
    setTimeout(() => card.remove(), 330);
  }

  let btnLockUntil = 0;
  // 반환값: 실제로 넘겼는지
  function act(kind, viaButton) {
    if (S.view !== 'app' || S.tab !== 'swipe' || swipeMode() !== 'deck') return false;
    const now = performance.now();
    if (viaButton && now < btnLockUntil) return false; // 하트·X가 두 번 눌린 것
    const id = S.deckOrder[0];
    if (!id) return false;
    if (kind === 'like' && picksFull()) {
      toast('이미 ' + MAX + '명을 골랐어요. 바꾸려면 LIKE › 내가 고른 사람에서 한 명을 취소하세요.', 3500);
      return false;
    }
    btnLockUntil = now + 250;
    dismissCoach();
    S.swipes = {
      likes: kind === 'like' ? S.swipes.likes.concat(id) : S.swipes.likes.slice(),
      passes: S.swipes.passes.filter((x) => x !== id).concat(kind === 'pass' ? [id] : []),
    };
    S.deckOrder.shift();
    const wasDone = !!(S.me && S.me.done);
    const full = picksFull();
    const finished = (kind === 'like' && full) || (!S.browsing && !full && S.deckOrder.length === 0);
    const setDone = finished && !wasDone;
    pushHistory({ id, kind, setDone });
    saveSwipes(kind === 'like' ? { add: id, ln: S.myLinkedin } : null, setDone ? true : null);
    flyOut(kind);
    if (finished) finishPicking(setDone || (kind === 'like' && full));
    render();
    return true;
  }

  // 여러 번 되돌릴 수 있습니다. 마지막 고르기로 완료됐던 경우에는 완료도 되돌립니다.
  function undo() {
    if (S.phase !== 'swipe') return;
    const last = lastAction();
    if (!last) return;
    S.history.pop();
    const { id, kind, setDone } = last;
    S.swipes = { likes: S.swipes.likes.filter((x) => x !== id), passes: S.swipes.passes.filter((x) => x !== id) };
    S.deckOrder = [id].concat(S.deckOrder.filter((x) => x !== id));
    if (setDone && S.me) S.me = Object.assign({}, S.me, { done: false });
    else if (S.me && S.me.done) { if (picksFull()) S.browsing = true; else S.continuing = true; }
    saveSwipes(kind === 'like' ? { remove: id } : null, setDone ? false : null);
    render();
  }

  function showFinish() {
    $('finish').hidden = false;
    renderFinish();
    renderNet();
    armBack();
  }
  function renderFinish() {
    const picks = minePeople();
    const mineIds = new Set(picks.map((p) => p.id));
    const mutual = inboxPeople().filter((x) => mineIds.has(x.p.id));
    $('finish-title').textContent = picks.length >= MAX ? MAX + '명 선택 완료!' : '카드를 다 넘겼어요';
    $('finish-logos').replaceChildren(...picks.map((p) => h('span', { class: 'fl' }, logoEl(p))));
    const text = mutual.length === 1 ? mutual[0].p.name + '님도 나를 골랐어요. 서로 선택!'
      : mutual.length ? '나를 고른 사람 중 ' + mutual.length + '명을 나도 골랐어요. 서로 선택!'
        : '이제 누가 나를 골랐는지 확인해 보세요.';
    const el = $('finish-text');
    if (el.textContent !== text) {
      el.textContent = text;
      el.classList.toggle('hot', mutual.length > 0);
      if (mutual.length) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
    }
    const last = lastAction();
    $('finish-undo').hidden = !(S.phase === 'swipe' && last && last.kind === 'like');
  }
  function closeFinish() {
    if ($('finish').hidden) return;
    $('finish').hidden = true;
    shield();
    // 완료 화면에서 이미 알려 준 서로 선택·새 LIKE는 확인한 것으로 칩니다 (LIKE 목록에는 NEW로 표시).
    if (S.pid && unlocked()) { const n = currentNews(); markSeen(n.inIds, n.mutualIds); }
  }

  // --- LIKE 탭 (7, 9) ---
  let likesKey = '';
  let armed = { id: null, at: 0 };
  let armTimer = null;
  function renderLikesTab() {
    const open = unlocked();
    const inList = inboxPeople();
    const mine = minePeople();
    const mineIds = new Set(mine.map((p) => p.id));
    const passed = passedPeople();
    const inIds = new Set(inList.map((x) => x.p.id));
    $('likes-count').textContent = String(inList.length);
    $('seg-in').textContent = '나를 고른 사람 ' + inList.length;
    $('seg-out').textContent = '내가 고른 사람 ' + mine.length;
    $('seg-in').setAttribute('aria-pressed', String(S.likesTab === 'in'));
    $('seg-out').setAttribute('aria-pressed', String(S.likesTab === 'out'));

    // 지금 보이는 사람은 확인한 것으로 기록하고, 이번에 처음 보는 사람에게 NEW를 붙입니다.
    if (S.likesTab === 'in' && open) {
      let changed = false;
      inList.forEach((x) => { if (!S.viewed.has(x.p.id)) { S.viewed.add(x.p.id); S.newIds.add(x.p.id); changed = true; } });
      if (changed) store.set(lsViewed(), JSON.stringify([...S.viewed]));
    }
    const armedId = armed.id && Date.now() - armed.at < 3000 ? armed.id : '';
    const key = [S.likesTab, open, S.phase, picksFull(), S.met.join(','), S.hideMet, S.showPasses, armedId, [...S.newIds].join(','),
      inList.map((x) => x.p.id + ':' + (x.p.updatedAt || '') + ':' + lnFrom(x.p.id)).join(','),
      mine.map((p) => p.id + ':' + (p.updatedAt || '')).join(','), passed.map((p) => p.id + ':' + (p.updatedAt || '')).join(',')].join('|');
    if (key === likesKey) return;
    likesKey = key;

    const body = $('likes-body');
    if (S.likesTab === 'in') {
      if (!inList.length) {
        body.replaceChildren(h('div', { class: 'empty-box' }, h('b', null, '아직 나를 고른 사람이 없어요'),
          h('span', null, '다른 참가자들이 카드를 넘기는 중이에요. 누군가 나를 고르면 바로 여기에 나타나요.')));
      } else if (!open) {
        // 설명을 먼저 (작은 화면에서도 스크롤 없이 보이게)
        body.replaceChildren(
          h('div', { class: 'lock-box' }, icon('lock'),
            h('b', null, inList.length + '명이 나와 대화하고 싶어해요'),
            h('p', null, MAX + '명을 모두 고르면 누군지 볼 수 있어요.'),
            S.phase === 'swipe' ? h('button', { type: 'button', class: 'cta', onclick: () => goTab('swipe') }, '계속 고르기') : null),
          h('div', { class: 'locked-grid' }, inList.map((x) => h('div', { class: 'locked-tile', 'aria-hidden': 'true' }, ...visualEls(x.p)))));
      } else {
        // 아직 대화하지 않은 사람 먼저(그중 서로 선택 먼저), 대화한 사람은 아래로
        const met = (x) => S.met.includes(x.p.id);
        const sorted = inList.slice().sort((a, b) => (met(a) - met(b)) || (mineIds.has(b.p.id) - mineIds.has(a.p.id)) || (b.at - a.at));
        const metN = inList.filter(met).length;
        const shown = S.hideMet ? sorted.filter((x) => !met(x)) : sorted;
        body.replaceChildren(...[
          metN ? listTools(metN, inList.length) : null,
          h('ul', { class: 'lis' }, shown.map((x) => likeItem(x.p, { mutual: mineIds.has(x.p.id), kind: 'in' }))),
          S.hideMet && !shown.length ? h('p', { class: 'me-note', text: '나를 고른 사람과 모두 대화했어요.' }) : null,
        ].filter(Boolean));
      }
      return;
    }
    const slots = MAX - mine.length;
    const metOut = mine.filter((p) => S.met.includes(p.id)).length;
    const parts = [];
    if (S.phase === 'swipe' && slots > 0 && (mine.length || passed.length)) {
      parts.push(h('div', { class: 'slot-box' },
        h('b', null, slots === MAX ? '아직 고른 사람이 없어요' : slots + '자리가 비어 있어요'),
        h('div', { class: 'slot-actions' },
          h('button', { type: 'button', class: 'cta small', onclick: () => { S.browsing = false; if (S.me && S.me.done) S.continuing = true; session.save(); goTab('swipe'); } }, '카드 고르러 가기'),
          passed.length && !S.showPasses ? h('button', { type: 'button', class: 'ghost-btn', onclick: () => { S.showPasses = true; renderLikesTab(); } }, '넘긴 사람에서 고르기') : null)));
    }
    if (!mine.length) {
      if (!parts.length) {
        parts.push(h('div', { class: 'empty-box' }, h('b', null, '아직 고른 사람이 없어요'),
          S.phase === 'swipe' ? h('button', { type: 'button', class: 'ghost-btn', onclick: () => goTab('swipe') }, '카드 넘기러 가기') : null));
      }
    } else {
      if (metOut) parts.push(h('p', { class: 'met-count', text: '대화 완료 ' + metOut + ' / ' + mine.length + '명' }));
      parts.push(h('ul', { class: 'lis' }, mine.map((p) => likeItem(p, { mutual: open && inIds.has(p.id), kind: 'out' }))));
    }
    if (passed.length) {
      parts.push(h('button', { type: 'button', class: 'passes-toggle', 'aria-expanded': String(S.showPasses), onclick: () => { S.showPasses = !S.showPasses; renderLikesTab(); } },
        '넘긴 사람 ' + passed.length + '명', h('span', { 'aria-hidden': 'true' }, S.showPasses ? '접기' : '펼치기')));
      if (S.showPasses) parts.push(h('ul', { class: 'lis' }, passed.map((p) => likeItem(p, { kind: 'passed', pickedMe: open && inIds.has(p.id) }))));
    }
    body.replaceChildren(...parts);
  }
  function listTools(metN, total) {
    return h('div', { class: 'list-tools' },
      h('p', { class: 'met-count', text: '대화 완료 ' + metN + ' / ' + total + '명' }),
      h('button', { type: 'button', class: 'chip-btn' + (S.hideMet ? ' on' : ''), 'aria-pressed': String(S.hideMet), onclick: () => { S.hideMet = !S.hideMet; renderLikesTab(); } },
        S.hideMet ? '대화한 사람도 보기' : '대화한 사람 숨기기'));
  }

  function toggleMet(id) {
    const met = S.met.includes(id) ? S.met.filter((x) => x !== id) : S.met.concat(id);
    S.met = met;
    likesKey = '';
    enqueue(() => S.store.savePrivate(S.pid, { met }, null));
    render();
  }

  function unpickBtn(p) {
    const isArmed = armed.id === p.id && Date.now() - armed.at < 3000;
    return h('button', {
      type: 'button', class: 'chip-btn warn' + (isArmed ? ' armed' : ''),
      onclick: () => {
        const now = Date.now();
        if (armed.id === p.id && now - armed.at < 3000) {
          if (now - armed.at < 400) return; // 두 번 연달아 눌린 것은 무시
          armed = { id: null, at: 0 };
          unpick(p.id);
          return;
        }
        armed = { id: p.id, at: now };
        likesKey = '';
        renderLikesTab();
        clearTimeout(armTimer);
        armTimer = setTimeout(() => { likesKey = ''; if (S.view === 'app' && S.tab === 'likes') renderLikesTab(); }, 3050);
      },
    }, isArmed ? '한 번 더 누르면 취소돼요' : '선택 취소');
  }

  // LIKE 목록 한 줄: 로고, 이름, 직함·회사, 나누고 싶은 이야기를 한눈에. 사람을 찾아다니기 쉽게 촘촘하게.
  function likeItem(p, { mutual = false, kind, pickedMe = false }) {
    const met = S.met.includes(p.id);
    const isNew = kind === 'in' && S.newIds.has(p.id);
    const actions = [];
    if (kind !== 'passed' && unlocked()) {
      actions.push(h('button', { type: 'button', class: 'chip-btn' + (met ? ' on' : ''), 'aria-pressed': String(met), onclick: () => toggleMet(p.id) },
        icon('check'), met ? '대화했어요' : '대화 완료로 표시'));
    }
    if (mutual) actions.push(linkedinBtn(lnFrom(p.id)));
    if (kind !== 'out' && canPick(p)) {
      actions.push(h('button', { type: 'button', class: 'chip-btn pick', onclick: () => pickDirect(p.id) }, icon('heart'), kind === 'in' ? '나도 고르기' : '고르기'));
    }
    if (kind === 'out' && S.phase === 'swipe') actions.push(unpickBtn(p));
    return h('li', { class: 'li' + (met ? ' met' : '') + (kind === 'passed' ? ' slim' : '') + (isNew ? ' is-new' : '') },
      h('button', { type: 'button', class: 'li-main', onclick: () => openSheet(p, { mutual, from: 'list' }), 'aria-label': p.name + ' 프로필 보기' },
        h('span', { class: 'li-logo' }, logoEl(p)),
        h('span', { class: 'li-text' },
          h('span', { class: 'li-top' },
            h('b', { class: 'li-nm', text: p.name }),
            isNew ? h('span', { class: 'li-new' }, 'NEW') : null,
            mutual ? h('span', { class: 'li-mutual' }, '서로 선택') : null,
            pickedMe ? h('span', { class: 'li-tag' }, '나를 골랐어요') : null),
          h('span', { class: 'li-sub', text: p.title + ' · ' + p.company }),
          kind !== 'passed' ? h('span', { class: 'li-q', text: '“' + p.topic + '”' }) : null)),
      actions.length ? h('div', { class: 'li-actions' }, actions) : null);
  }

  // --- 프로필 탭 (5) ---
  let meKey = '';
  function renderMeTab() {
    $('me-linkedin').textContent = S.myLinkedin
      ? '링크드인: ' + S.myLinkedin.replace('https://www.', '') + ' (서로 고른 사람에게만 보여요)'
      : '링크드인을 넣으면 서로 고른 사람에게만 보여요. 프로필 수정에서 추가할 수 있어요.';
    $('me-hidden').hidden = !(S.me && S.me.hidden);
    const key = JSON.stringify(S.me);
    if (key === meKey) return;
    meKey = key;
    $('me-card').replaceChildren(cardEl(S.me));
  }
  async function leaveDevice() {
    $('me-out-note').hidden = true;
    try { if (S.store.resetDevice) await S.store.resetDevice(); } catch (e) { console.error(e); }
    try { sessionStorage.removeItem(ssSession()); } catch (e) { /* 무시 */ }
    signOut();
    clearDraft();
    store.del(LS_COACH); // 다음 사람도 사용 안내를 보도록
    meKey = '';
    likesKey = '';
    hideBanner();
    toast('이 기기에서 나갔어요. 다음 사람이 등록할 수 있어요.');
    route();
  }

  // ---------- 프로필 전체 보기 (14) ----------
  // from: 'deck'(맨 위 카드) | 'list'(LIKE 목록) | 'view'(내 카드)
  function openSheet(p, opts) {
    const o = opts || {};
    const from = o.from || 'view';
    const shared = sharedKeywords(p);
    const careers = careersOf(p);
    const mutual = o.mutual !== undefined ? o.mutual : unlocked() && S.swipes.likes.includes(p.id) && S.inbox.some((x) => x.id === p.id);
    const sec = (title, ...body) => h('section', { class: 'sh-sec' }, h('h3', { text: title }), ...body);
    // 아래쪽 고정 버튼: 스크롤해도 늘 보이는 닫기, 고를 수 있으면 고르기
    let bar;
    if (from === 'deck' && S.deckOrder[0] === p.id && swipeMode() === 'deck') {
      bar = [
        h('button', { type: 'button', class: 'round md nope', 'aria-label': '넘기기', onclick: () => { closeSheet(); act('pass'); } }, icon('x')),
        h('button', { type: 'button', class: 'ghost-btn', 'data-close': '' }, '닫기'),
        h('button', { type: 'button', class: 'round md like', 'aria-label': '대화하고 싶어요', onclick: () => { closeSheet(); act('like'); } }, icon('heart')),
      ];
    } else if (from === 'list' && canPick(p)) {
      bar = [
        h('button', { type: 'button', class: 'ghost-btn', 'data-close': '' }, '닫기'),
        h('button', { type: 'button', class: 'cta small', onclick: () => { closeSheet(); pickDirect(p.id); } }, icon('heart'), S.inbox.some((x) => x.id === p.id) && unlocked() ? '나도 고르기' : '고르기'),
      ];
    } else {
      bar = [h('button', { type: 'button', class: 'ghost-btn wide', 'data-close': '' }, '닫기')];
    }
    $('sheet-body').replaceChildren(
      h('div', { class: 'sh-visual' }, ...visualEls(p),
        h('button', { type: 'button', class: 'sh-close', 'aria-label': '닫기', 'data-close': '' }, icon('down'))),
      h('div', { class: 'sh-content' },
        h('h2', { class: 'sh-name', text: p.name }),
        mutual ? h('span', { class: 'li-mutual' }, '서로 선택') : null,
        mutual ? linkedinBtn(lnFrom(p.id)) : null,
        h('div', { class: 'sh-lines' }, line('briefcase', p.title + ' · ' + p.field), line('building', p.company), line('history', yearsLabel(p.years))),
        sec('이런 이야기를 나누고 싶어요', h('p', { class: 'sh-quote', text: p.topic })),
        (p.lookingFor || []).length ? sec('찾고 있어요', h('div', { class: 'ci-chips' },
          p.lookingFor.map((k) => h('span', { class: 'ci-chip', text: k })))) : null,
        p.companyIntro ? sec('회사가 하는 일', h('p', { text: p.companyIntro })) : null,
        sec('대표 경험', h('ul', { class: 'ci-list' }, (p.experiences || []).map((x) => h('li', { text: x })))),
        careers.length ? sec('이전 경력', h('ul', { class: 'ci-list' }, careers.map((c) => h('li', null,
          c.period ? h('span', { class: 'ci-period', text: c.period }) : null, [c.org, c.role].filter(Boolean).join(' · '))))) : null,
        (p.keywords || []).length ? sec('관심 키워드', h('div', { class: 'ci-chips' },
          p.keywords.map((k) => h('span', { class: 'ci-chip' + (shared.includes(k) ? ' shared' : ''), text: k })))) : null),
      h('div', { class: 'sheet-bar' + (bar.length === 3 ? ' trio' : '') }, bar));
    $('sheet').hidden = false;
    $('sheet-body').scrollTop = 0;
    $('sheet-body').querySelector('.sh-close').focus({ preventScroll: true });
    armBack();
  }
  function closeSheet() {
    if ($('sheet').hidden) return;
    $('sheet').hidden = true;
    shield();
    setTimeout(() => { if (S.view === 'app') checkNews(); }, 400); // 보는 동안 미뤄 둔 '서로 선택'
  }

  // ---------- 전체 알림 (21) ----------
  // 모든 화면(완료·프로필 보기 포함) 맨 위에 띄웁니다. 눌러서 닫을 수 있습니다.
  let noticeTimer = null;
  function showBanner(text, ms) {
    $('notice-msg').textContent = text;
    $('notice-banner').hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(hideBanner, ms || 20000);
  }
  function hideBanner() { clearTimeout(noticeTimer); $('notice-banner').hidden = true; }
  function showNotice(s) {
    if (!s || !s.noticeAt) return;
    const last = Number(store.get(LS_NOTICE) || 0);
    if (s.noticeAt <= last) return;
    store.set(LS_NOTICE, String(s.noticeAt));
    if (!s.notice) { hideBanner(); return; } // 운영자가 알림을 내림
    if (Date.now() - s.noticeAt > 10 * 60 * 1000 || location.hash === '#admin') return;
    showBanner(s.notice);
  }

  // ---------- 운영자 ----------
  let pendingPhase = null;
  let testConfirm = null; // 'add' | 'remove' | 'reset'
  let adminBusy = false;
  let hideArmed = { id: null, at: 0 };
  let progressUnsub = null;
  const ADMIN_BTNS = ['test-add', 'test-remove', 'test-reset', 'test-yes', 'notice-send', 'notice-clear', 'phase-yes'];
  async function adminTask(fn, done) {
    if (adminBusy) return false;
    adminBusy = true;
    ADMIN_BTNS.forEach((id) => { $(id).disabled = true; });
    let ok = false;
    try { await fn(); ok = true; if (done) toast(done, 3000); }
    catch (ex) {
      console.error(ex);
      const code = String((ex && ex.code) || '');
      toast(code.includes('permission') ? '권한이 없어요. 운영자 PIN으로 다시 들어와 주세요.' : '처리하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.', 3500);
    } finally {
      adminBusy = false;
      ADMIN_BTNS.forEach((id) => { $(id).disabled = false; });
      render();
    }
    return ok;
  }
  function watchAdmin() {
    if (progressUnsub || !S.store.watchProgress) return;
    progressUnsub = S.store.watchProgress((list) => { S.progress = new Map(list.map((x) => [x.id, x])); render(); });
  }
  async function enterAdmin() {
    S.admin = await S.store.isAdmin();
    if (S.admin) watchAdmin();
    render();
  }
  const entryUrl = () => location.href.split('#')[0];
  // QR 라이브러리는 운영자 화면에서만 쓰므로 그때 불러옵니다 (참가자 휴대폰은 내려받지 않음).
  const QR_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
  let qrLoading = null;
  function loadQr() {
    if (window.QRCode) return Promise.resolve();
    if (!qrLoading) {
      qrLoading = new Promise((resolve, reject) => {
        const tag = document.createElement('script');
        tag.src = QR_SRC;
        tag.onload = resolve;
        tag.onerror = () => { qrLoading = null; reject(new Error('qr')); };
        document.head.append(tag);
      });
    }
    return qrLoading;
  }
  function drawQr(el, size) {
    if (el.dataset.url === entryUrl()) return;
    el.dataset.url = entryUrl();
    loadQr().then(() => {
      el.replaceChildren();
      // eslint-disable-next-line no-new
      new window.QRCode(el, { text: entryUrl(), width: size, height: size, colorDark: '#111111', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
    }).catch(() => {
      delete el.dataset.url;
      el.replaceChildren(h('p', { class: 'url', text: 'QR을 불러오지 못했어요. 링크 복사를 쓰세요.' }));
    });
  }
  // 단계 이름은 참가자 화면에 실제로 일어나는 일 기준입니다. '결과 공개'가 곧 네트워킹 시작입니다.
  const PHASES = {
    registration: { yes: '등록 단계로 돌리기', text: () => '프로필 등록 단계로 돌릴까요? 참가자 화면이 대기 화면으로 바뀌고 카드를 더 넘길 수 없어요.' },
    swipe: { yes: '카드 고르기 시작', text: (n) => '카드 고르기를 시작할까요? 등록한 ' + n + '명의 화면이 바로 카드로 바뀌어요.' },
    ended: { yes: '결과 공개', text: (n) => '결과를 공개할까요? 더는 고를 수 없고, ' + n + '명 모두 LIKE에서 나를 고른 사람을 볼 수 있어요. 네트워킹을 시작할 때 누르세요.' },
  };
  function ago(t) {
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    return s < 60 ? '방금' : Math.round(s / 60) + '분 전';
  }
  // 운영자 화면의 참가자 상태: 시작 전 / 고르는 중 / 5명 완료 / 카드 소진
  function statusOf(p) {
    if (p.test) return { key: 'test', label: '테스트' };
    const pr = S.progress.get(p.id);
    const likes = pr ? pr.likes || 0 : 0;
    if (p.done && (!pr || likes >= MAX)) return { key: 'full', label: MAX + '명 완료' };
    if (p.done && pr && pr.left === 0) return { key: 'empty', label: '카드 소진 · ' + likes + '명' };
    if (pr && (pr.seen > 0 || likes > 0)) return { key: 'doing', label: '고르는 중 · ' + likes + '명' };
    return { key: 'start', label: '시작 전' };
  }
  function renderNoticeLast() {
    const has = !!S.noticeAt;
    $('notice-last').hidden = !has;
    if (!has) return;
    $('notice-last-text').textContent = S.noticeText ? '마지막 알림: “' + S.noticeText + '” · ' + ago(S.noticeAt) : '알림을 내렸어요 · ' + ago(S.noticeAt);
    $('notice-clear').hidden = !(S.noticeText && Date.now() - S.noticeAt < 20000);
  }

  function renderAdmin() {
    $('admin-login').hidden = S.admin;
    $('admin-panel').hidden = !S.admin;
    if (!S.admin) return;
    const all = [...S.profiles.values()].sort((a, b) => (!!a.test - !!b.test) || ((a.createdAt || 0) - (b.createdAt || 0)));
    const real = all.filter((p) => !p.test);
    const tests = all.filter((p) => p.test);
    const realVisible = real.filter((p) => !p.hidden);

    $('phase-seg').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.phase === S.phase)));
    $('phase-confirm').hidden = !pendingPhase;
    if (pendingPhase) {
      $('phase-confirm-text').textContent = PHASES[pendingPhase].text(realVisible.length);
      $('phase-yes').textContent = PHASES[pendingPhase].yes;
      $('phase-notice-row').hidden = pendingPhase !== 'ended';
    }

    const c = { start: 0, doing: 0, full: 0, empty: 0 };
    realVisible.forEach((p) => { c[statusOf(p).key]++; });
    const stat = (id, n, label) => h('div', { class: 'stat' }, h('b', { id, text: String(n) }), h('span', { text: label }));
    $('stats').replaceChildren(
      h('div', { class: 'stat wide' },
        h('b', { id: 'st-reg' }, String(realVisible.length), h('small', null, ' / ' + CAP)),
        h('span', { text: '등록 (실제 참가자)' }),
        h('small', { class: 'stat-sub', text: '테스트 ' + tests.length + '명 · 숨김 ' + all.filter((p) => p.hidden).length + '명' })),
      stat('st-start', c.start, '시작 전'), stat('st-doing', c.doing, '고르는 중'),
      stat('st-full', c.full, MAX + '명 완료'), stat('st-empty', c.empty, '카드 소진'));

    // 전체 알림: 남은 시간 안내는 카드 고르기 단계에서만
    const swiping = S.phase === 'swipe';
    $('notice-presets').querySelectorAll('button').forEach((b) => { b.disabled = !swiping || adminBusy; });
    $('notice-preset-note').hidden = swiping;
    renderNoticeLast();

    // 테스트 도구
    const isDemo = S.store.mode === 'demo';
    $('test-add').textContent = tests.length ? '예시 참가자 들어 있음 (' + tests.length + '명)' : '예시 참가자 34명 넣기';
    $('test-add').disabled = adminBusy || (!isDemo && (tests.length > 0 || S.phase !== 'registration'));
    $('test-add-note').hidden = isDemo || tests.length > 0 || S.phase === 'registration';
    $('test-add-note').textContent = '예시 참가자는 프로필 등록 단계에서만 넣을 수 있어요.';
    $('test-remove').hidden = !tests.length;
    $('test-confirm').hidden = !testConfirm;
    if (testConfirm) {
      const typed = $('test-type').value.trim() === '초기화';
      const needType = testConfirm === 'reset' && (real.length > 0 || S.phase !== 'registration');
      $('test-type-row').hidden = !needType;
      $('test-yes').classList.toggle('danger', testConfirm !== 'add');
      $('test-yes').disabled = adminBusy || (needType && !typed);
      if (testConfirm === 'add') {
        $('test-confirm-text').textContent = '예시 참가자 34명을 넣을까요? 참가자 카드에 함께 나와요. 실제 행사 전에는 꼭 지워 주세요.';
        $('test-yes').textContent = '넣기';
      } else if (testConfirm === 'remove') {
        $('test-confirm-text').textContent = '테스트 참가자 ' + tests.length + '명을 지울까요? 실제 참가자의 프로필과 기록은 그대로 남고, 테스트 참가자를 고른 자리는 비워져요.';
        $('test-yes').textContent = '테스트만 지우기';
      } else {
        $('test-confirm-text').textContent = '실제 참가자 ' + real.length + '명과 테스트 ' + tests.length + '명의 프로필, 고른 기록, LIKE, 링크드인이 모두 지워지고 진행 단계가 ‘프로필 등록’으로 돌아가요. 참가자는 처음부터 다시 등록해야 해요. 되돌릴 수 없어요.';
        $('test-yes').textContent = '모두 지우기';
      }
    }

    // 참가자 목록
    $('admin-filter').querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.filter === S.adminFilter));
      b.textContent = (b.dataset.filter === 'real' ? '실제 참가자 ' + real.length : '전체 ' + all.length);
    });
    const list = S.adminFilter === 'real' ? real : all;
    $('admin-rows').replaceChildren(...(list.length ? list.map(adminRow) : [h('p', { class: 'ob-help', text: '아직 등록한 참가자가 없어요.' })]));
    $('qr-url').textContent = entryUrl();
    drawQr($('qr'), 280);
  }
  function adminRow(p) {
    const st = statusOf(p);
    const isArmed = hideArmed.id === p.id && Date.now() - hideArmed.at < 3000;
    return h('div', { class: 'prow' + (p.hidden ? ' is-hidden' : '') },
      h('div', { class: 'p-main' },
        h('b', { text: p.name }), p.test ? h('span', { class: 'tag-test' }, '테스트') : null,
        h('span', { class: 'p-sub', text: p.company + ' · ' + p.title })),
      h('span', { class: 'state s-' + st.key, text: p.hidden ? '숨김' : st.label }),
      h('button', {
        type: 'button', class: 'ghost-btn' + (isArmed ? ' armed' : ''),
        onclick: () => {
          if (p.hidden) { enqueue(() => S.store.setHidden(p.id, false)); return; }
          const now = Date.now();
          if (hideArmed.id === p.id && now - hideArmed.at < 3000) {
            if (now - hideArmed.at < 400) return;
            hideArmed = { id: null, at: 0 };
            enqueue(() => S.store.setHidden(p.id, true));
            toast(p.name + '님 프로필을 숨겼어요.');
            return;
          }
          hideArmed = { id: p.id, at: now };
          render();
          setTimeout(render, 3050);
        },
      }, p.hidden ? '다시 보이기' : isArmed ? p.name + '님 숨기기' : '숨기기'));
  }

  // ---------- 데이터 변경 ----------
  let wasHidden = null;
  function onData() {
    if (S.pid) {
      const fresh = S.profiles.get(S.pid);
      if (fresh) {
        if (wasHidden === false && fresh.hidden) toast('운영진이 내 프로필을 숨겼어요. 프로필 탭을 확인해 주세요.', 3500);
        wasHidden = !!fresh.hidden;
        S.me = fresh;
        pruneGone();
      } else if (S.profilesLoaded && S.profilesServer && !S.creating) {
        kicked();
      }
    }
    route();
  }
  // 운영진이 초기화했거나 콘솔에서 지워 내 프로필이 없어진 경우: 떠 있던 화면을 닫고 이유를 알려 줍니다.
  function kicked() {
    signOut();
    ['finish', 'match', 'sheet'].forEach((id) => { $(id).hidden = true; });
    matchWho = null;
    wasHidden = null;
    meKey = '';
    likesKey = '';
    showBanner('운영진이 내 프로필과 기록을 지웠어요. 처음부터 다시 등록해 주세요.', 30000);
  }
  // 운영진이 테스트 참가자를 지웠는데 내가 그 사람을 골라 두었다면, 목록에서 빼고 자리를 돌려받습니다.
  function pruneGone() {
    if (!S.profilesServer || !S.swipesLoaded) return;
    const gone = (id) => !S.profiles.has(id);
    const likesGone = S.swipes.likes.filter(gone);
    if (!likesGone.length && !S.swipes.passes.some(gone)) return;
    S.swipes = { likes: S.swipes.likes.filter((id) => !gone(id)), passes: S.swipes.passes.filter((id) => !gone(id)) };
    saveSwipes(likesGone.length ? { remove: likesGone } : null, null);
  }

  // ---------- 연결 ----------
  function wire() {
    $('ob-back').append(icon('back'));
    $('btn-undo').append(icon('undo'));
    $('btn-nope').append(icon('x'));
    $('btn-like').append(icon('heart'));
    $('tb-swipe').querySelector('.tb-icon').append(icon('cards'));
    $('tb-likes').querySelector('.tb-icon').append(icon('heartLine'));
    $('tb-me').querySelector('.tb-icon').append(icon('person'));
    // 글자 수 제한이 있는 칸에 글자 수 표시
    ['in-company', 'in-intro', 'in-title'].forEach((id) => {
      const el = $(id);
      const wrap = h('div', { class: 'field' });
      el.replaceWith(wrap);
      wrap.append(el, limitCount(el));
    });

    $('ob-next').addEventListener('click', obNext);
    $('ob-back').addEventListener('click', () => { obBack(); });
    // 한 줄 입력칸에서 엔터: 다음 칸으로, 마지막 칸이면 '계속'
    $('ob-body').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      const t = e.target;
      if (!t.matches('input, textarea') || t.id === 'kw-custom') return;
      e.preventDefault();
      const step = t.closest('.ob-step');
      const fields = [...step.querySelectorAll('input:not([type=file]), textarea')].filter((x) => x.id !== 'kw-custom');
      const i = fields.indexOf(t);
      if (i >= 0 && i < fields.length - 1) fields[i + 1].focus();
      else { t.blur(); obNext(); }
    });
    $('in-name').addEventListener('input', (e) => { OB.d.name = e.target.value; syncNext(); });
    $('in-pin').addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
      OB.d.pin = e.target.value;
      syncNext();
    });
    $('in-company').addEventListener('input', (e) => { OB.d.company = e.target.value; renderCompanyLogo(); syncNext(); });
    $('in-intro').addEventListener('input', (e) => { OB.d.companyIntro = e.target.value; saveDraft(); });
    $('in-title').addEventListener('input', (e) => { OB.d.title = e.target.value; syncNext(); });
    $('in-topic').addEventListener('input', (e) => { OB.d.topic = e.target.value; updateTopicCount(); syncNext(); });
    $('in-linkedin').addEventListener('input', (e) => { OB.d.linkedin = e.target.value; syncNext(); });
    $('company-list').replaceChildren(...Object.keys(window.ND_LOGOS || {}).map((c) => h('option', { value: c })));
    $('kw-add').addEventListener('click', addCustomKeyword);
    $('kw-custom').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); addCustomKeyword(); } });
    $('career-add').addEventListener('click', () => {
      if (OB.d.careers.length < MAX_CAREERS) OB.d.careers.push({ period: '', org: '', role: '' });
      renderCareers();
      syncNext();
      const rows = $('in-careers').querySelectorAll('.career');
      if (rows.length) rows[rows.length - 1].querySelector('input').focus();
    });
    $('in-logo').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try { OB.d.logo = await processLogo(file); renderLogoSlot(); syncNext(); }
      catch (ex) { toast(ex && ex.message === 'size' ? '이미지가 너무 복잡해요. 더 단순한 로고 파일로 올려 주세요.' : '이미지를 읽지 못했어요. PNG나 JPG 파일로 다시 올려 주세요.', 3500); }
    });
    $('logo-badge').addEventListener('click', () => {
      if (OB.d.logo) { OB.d.logo = null; renderLogoSlot(); syncNext(); }
      else $('in-logo').click();
    });

    document.querySelectorAll('.tabbar button').forEach((b) => b.addEventListener('click', () => goTab(b.dataset.tab)));
    const seg = (lt) => {
      if (S.likesTab === lt) return;
      hideToast();
      shield();
      S.likesTab = lt;
      if (lt === 'in') S.newIds = new Set();
      likesKey = '';
      renderApp();
    };
    $('seg-in').addEventListener('click', () => seg('in'));
    $('seg-out').addEventListener('click', () => seg('out'));
    $('me-edit').addEventListener('click', () => { S.editing = true; route(); });
    $('me-out').addEventListener('click', () => { $('me-out-note').hidden = false; });
    $('me-out-yes').addEventListener('click', leaveDevice);
    $('btn-like').addEventListener('click', () => act('like', true));
    $('btn-nope').addEventListener('click', () => act('pass', true));
    $('btn-undo').addEventListener('click', undo);
    $('top-stop').addEventListener('click', () => { S.browsing = false; S.continuing = false; session.save(); render(); });
    $('finish-go').addEventListener('click', () => { closeFinish(); S.likesTab = 'in'; goTab('likes'); });
    $('finish-undo').addEventListener('click', () => { closeFinish(); undo(); });
    $('finish-close').addEventListener('click', closeFinish);
    $('match-view').addEventListener('click', () => { const p = matchWho; closeMatch(); if (p) openSheet(p, { mutual: true, from: 'list' }); });
    $('match-close').addEventListener('click', closeMatch);
    $('sheet').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeSheet(); });
    $('notice-x').addEventListener('click', hideBanner);
    document.addEventListener('keydown', (e) => {
      // Esc는 열린 화면 닫기·이전 질문으로만 씁니다 (앱 화면에서 '나가기' 안내는 휴대폰 뒤로가기 전용)
      if (e.key === 'Escape' && (S.view === 'onboard' || canGoBackInApp() && !(S.view === 'app' && $('sheet').hidden && $('match').hidden
        && $('finish').hidden && $('demo-menu').hidden && $('qr-full').hidden))) onBack();
      if (S.view !== 'app' || S.tab !== 'swipe' || !$('sheet').hidden || !$('finish').hidden || !$('match').hidden) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) return;
      if (e.key === 'ArrowRight') act('like', true);
      if (e.key === 'ArrowLeft') act('pass', true);
    });

    // 운영자
    const adminError = (text) => { $('admin-error').textContent = text; $('admin-error').hidden = !text; };
    $('admin-pin').addEventListener('input', () => adminError(''));
    $('admin-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pin = $('admin-pin').value.trim();
      if (!pin) { adminError('PIN을 입력해 주세요.'); return; }
      const ok = await S.store.becomeAdmin(pin);
      adminError(ok ? '' : 'PIN이 맞지 않아요.');
      if (ok) { S.admin = true; $('admin-pin').value = ''; watchAdmin(); render(); }
    });
    $('phase-seg').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-phase]');
      if (!b || b.dataset.phase === S.phase) return;
      pendingPhase = b.dataset.phase;
      $('phase-notice').checked = true;
      render();
    });
    $('phase-yes').addEventListener('click', () => {
      const next = pendingPhase;
      if (!next) return;
      pendingPhase = null;
      // 결과 공개와 '네트워킹 시작' 알림은 한 번에 (알림만 보내고 결과를 안 여는 실수가 없게)
      const withNotice = next === 'ended' && $('phase-notice').checked;
      adminTask(() => (withNotice ? S.store.sendNotice(NETWORKING_NOTICE, next) : S.store.setPhase(next)),
        withNotice ? '결과를 공개하고 네트워킹 시작 알림을 보냈어요.' : '진행 단계를 바꿨어요.');
    });
    $('phase-no').addEventListener('click', () => { pendingPhase = null; render(); });
    const sendNotice = (text) => adminTask(() => S.store.sendNotice(text, S.phase), '알림을 보냈어요. 참가자 화면 맨 위에 20초 동안 떠요.');
    $('notice-presets').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-notice]');
      if (b && !b.disabled) sendNotice(b.dataset.notice);
    });
    $('notice-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = cleanText($('notice-text').value, 60);
      if (!text) { toast('보낼 문구를 입력해 주세요.'); $('notice-text').focus(); return; }
      if (await sendNotice(text)) $('notice-text').value = '';
    });
    $('notice-clear').addEventListener('click', () => adminTask(() => S.store.sendNotice('', S.phase), '알림을 내렸어요.'));
    $('test-add').addEventListener('click', () => {
      if (S.store.mode === 'demo') { toast('시연 모드에는 예시 참가자가 이미 들어 있어요.'); return; }
      testConfirm = 'add';
      render();
    });
    $('test-remove').addEventListener('click', () => { testConfirm = 'remove'; render(); });
    $('test-reset').addEventListener('click', () => { testConfirm = 'reset'; $('test-type').value = ''; render(); });
    $('test-no').addEventListener('click', () => { testConfirm = null; render(); });
    $('test-type').addEventListener('input', render);
    $('test-yes').addEventListener('click', () => {
      const kind = testConfirm;
      testConfirm = null;
      const all = [...S.profiles.values()];
      if (kind === 'add') {
        const keys = ['name', 'company', 'companyIntro', 'logo', 'title', 'field', 'years', 'careers', 'experiences', 'keywords', 'lookingFor', 'topic'];
        const list = (ND.SAMPLE_PROFILES || []).map((p) => ({ id: 'test-' + p.id, data: Object.fromEntries(keys.map((k) => [k, p[k]])) }));
        adminTask(() => S.store.addTestProfiles(list), '예시 참가자 ' + list.length + '명을 넣었어요.');
      } else if (kind === 'remove') {
        const testIds = all.filter((p) => p.test).map((p) => p.id);
        // 테스트 참가자는 아무도 고르지 않으므로, 실제 참가자가 보낸 LIKE만 지우면 됩니다.
        adminTask(() => S.store.removeTestProfiles(testIds, all.filter((p) => !p.test).map((p) => p.id)), '테스트 참가자 ' + testIds.length + '명을 지웠어요.');
      } else if (kind === 'reset') {
        adminTask(() => S.store.resetAll(all.map((p) => p.id)), '모두 지웠어요. 진행 단계가 프로필 등록으로 돌아갔어요.');
      }
    });
    $('admin-filter').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-filter]');
      if (b) { S.adminFilter = b.dataset.filter; render(); }
    });
    // '몇 분 전'과 '알림 내리기' 버튼을 제때 바꾸려고 가끔 다시 그립니다.
    setInterval(() => { if (S.view === 'admin' && S.admin) renderNoticeLast(); }, 5000);
    $('qr-big').addEventListener('click', () => {
      $('qr-large-url').textContent = entryUrl();
      hideToast();
      $('qr-full').hidden = false;
      armBack();
      drawQr($('qr-large'), 520);
    });
    $('qr-close').addEventListener('click', () => { $('qr-full').hidden = true; shield(); });
    $('copy-url').addEventListener('click', () => {
      const fallback = () => {
        const range = document.createRange();
        range.selectNodeContents($('qr-url'));
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        toast('링크를 선택했어요. 길게 눌러 복사하세요.');
      };
      try { navigator.clipboard.writeText(entryUrl()).then(() => toast('링크를 복사했어요.'), fallback); }
      catch (ex) { fallback(); }
    });

    $('demo-chip').addEventListener('click', () => { $('demo-menu').hidden = false; armBack(); });
    $('demo-close').addEventListener('click', () => { $('demo-menu').hidden = true; shield(); });
    $('demo-menu').addEventListener('click', (e) => { if (e.target === $('demo-menu')) { $('demo-menu').hidden = true; shield(); } });
    $('demo-admin').addEventListener('click', () => { $('demo-menu').hidden = true; });
    $('demo-phase').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-phase]');
      if (b) S.store.setPhase(b.dataset.phase);
    });
    $('demo-reset').addEventListener('click', () => {
      S.store.reset();
      [LS_PID, LS_DRAFT, LS_COACH, LS_NOTICE, LS_EDIT].forEach((k) => store.del(k));
      try { Object.keys(localStorage).filter((k) => /^nd-(seen|viewed):/.test(k)).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* 무시 */ }
      try { sessionStorage.clear(); } catch (e) { /* 무시 */ }
      location.hash = '';
      location.reload();
    });
    window.addEventListener('hashchange', route);
    window.addEventListener('online', renderNet);
    window.addEventListener('offline', renderNet);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', fitViewport);
      fitViewport();
    }
  }

  async function boot() {
    wire();
    if (!window.crypto || !crypto.subtle) {
      showFatal('이 브라우저에서는 열 수 없어요', 'https 주소로 접속했는지 확인해 주세요.');
      return;
    }
    try {
      if (C.firebase && !C.demo) {
        S.store = await ND.createFirebaseStore(C);
      } else {
        S.store = ND.createDemoStore(C);
      }
    } catch (ex) {
      console.error(ex);
      const code = ex && ex.code ? String(ex.code) : '';
      showFatal('서버에 연결하지 못했어요',
        code.includes('operation-not-allowed')
          ? 'Firebase 콘솔에서 익명 로그인을 켜 주세요. (README 2단계)'
          : '인터넷 연결을 확인하고 새로고침해 주세요. 계속 안 되면 운영진에게 알려 주세요.',
        code);
      return;
    }

    S.store.watchSettings((s) => {
      const prev = S.phase;
      S.phase = ['registration', 'swipe', 'ended'].includes(s.phase) ? s.phase : 'registration';
      S.noticeText = s.notice || '';
      S.noticeAt = s.noticeAt || 0;
      if (prev !== 'swipe' && S.phase === 'swipe') { S.tab = 'swipe'; S.deckInitAt = 0; }
      showNotice(s);
      onData();
    });
    S.store.watchProfiles((list, meta) => {
      S.profiles = new Map(list.map((p) => [p.id, p]));
      S.profilesLoaded = true;
      S.profilesServer = !(meta && meta.fromCache);
      onData();
    });

    const saved = store.get(LS_PID);
    if (saved && await S.store.isOwner(saved)) {
      await enterAs(saved);
      // 프로필을 고치던 중 새로고침했으면 이어서
      const ed = store.json(LS_EDIT);
      if (fresh12h(ed) && ed.pid === saved) S.editing = true;
    }
    route();
    renderNet();
  }

  boot();
})();
