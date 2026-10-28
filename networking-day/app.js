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
  const yearsShort = (y) => (y === '15년 이상' ? '15년+' : y || '');

  const $ = (id) => document.getElementById(id);
  const VIEWS = ['loading', 'error', 'onboard', 'app', 'admin'];

  const S = {
    store: null,
    pid: null,
    me: null,
    profiles: new Map(),
    profilesLoaded: false,
    phase: 'registration',
    notice: null,
    swipes: { likes: [], passes: [] },
    inbox: [],
    myLinkedin: '',
    met: [],
    deckOrder: [],
    renderedTop: null,
    last: null,
    creating: false,
    editing: false,
    continuing: false, // 다 고른 뒤 남은·새 카드 이어서 보기
    admin: false,
    view: null,
    tab: 'swipe',
    likesTab: 'in',
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
  const lsSeen = () => 'nd-seen:' + EVENT_ID + ':' + MODE + ':' + S.pid;

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
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
  }
  ND.onStoreError = (err) => {
    const code = err && err.code ? String(err.code) : '';
    if (code.includes('permission')) toast('권한이 없어 불러오지 못했어요. 운영진에게 알려 주세요.');
    else toast('연결이 불안정해요. 잠시 뒤 다시 시도합니다.');
  };

  // ---------- 연결 상태·저장 대기 (13) ----------
  let pendingWrites = 0;
  let slowTimer = null;
  function renderNet() {
    const offline = navigator.onLine === false;
    const b = $('net-banner');
    if (offline) {
      b.textContent = '인터넷 연결이 끊겼어요. 다시 연결되면 고른 기록이 자동으로 저장돼요.';
      b.hidden = false;
    } else if (pendingWrites > 0 && slowTimer === 'shown') {
      b.textContent = '저장하는 중이에요. 연결이 느려요.';
      b.hidden = false;
    } else {
      b.hidden = true;
    }
  }
  let queue = Promise.resolve();
  function enqueue(fn) {
    pendingWrites++;
    if (!slowTimer) slowTimer = setTimeout(() => { slowTimer = 'shown'; renderNet(); }, 5000);
    queue = queue.then(fn).catch((err) => {
      console.error(err);
      toast('저장하지 못했어요. 인터넷 연결을 확인해 주세요.');
    }).finally(() => {
      pendingWrites--;
      if (pendingWrites === 0) { if (slowTimer !== 'shown') clearTimeout(slowTimer); slowTimer = null; }
      renderNet();
    });
    return queue;
  }

  // ---------- 뒤로가기 (3, 14) ----------
  // 앱 안에서 되돌아갈 곳이 있을 때만 기록을 하나 쌓아 두고, 휴대폰 뒤로가기를 앱 안의 '뒤로'로 씁니다.
  let guardOn = false;
  function armBack() {
    if (guardOn) return;
    try { history.pushState({ nd: 1 }, ''); guardOn = true; } catch (e) { /* 무시 */ }
  }
  function canGoBackInApp() {
    return !$('sheet').hidden || !$('match').hidden || !$('finish').hidden || !$('demo-menu').hidden || !$('qr-full').hidden
      || (S.view === 'onboard' && (OB.i > 0 || OB.mode === 'edit'));
  }
  function onBack() {
    if (!$('qr-full').hidden) { $('qr-full').hidden = true; return true; }
    if (!$('demo-menu').hidden) { $('demo-menu').hidden = true; return true; }
    if (!$('sheet').hidden) { closeSheet(); return true; }
    if (!$('match').hidden) { closeMatch(); return true; }
    if (!$('finish').hidden) { $('finish').hidden = true; return true; }
    if (S.view === 'onboard') { obBack(); return true; }
    return false;
  }
  window.addEventListener('popstate', () => {
    guardOn = false;
    if (onBack() && canGoBackInApp()) armBack();
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

  // 로고에서 대표 색 두 개를 뽑아 카드 배경으로 씁니다 (19). 투명 배경에 밝은 로고면 어두운 타일에 올립니다 (22).
  const PALETTE = new Map();
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
    return { colors, lightOnClear: clear > total * 0.15 && opaque > 0 && lum / opaque > 200 };
  }
  function analyzeLogo(src) {
    if (PALETTE.has(src)) return Promise.resolve(PALETTE.get(src));
    return new Promise((resolve) => {
      const img = new Image();
      const done = (res) => { PALETTE.set(src, res); resolve(res); };
      img.onload = () => { try { done(analyzePixels(readPixels(img, 24))); } catch (e) { done({ colors: [], lightOnClear: false }); } };
      img.onerror = () => done({ colors: [], lightOnClear: false });
      img.src = src;
    });
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
    const apply = (pal) => {
      bg.style.background = bgCss(pal.colors, fallback);
      tile.classList.toggle('dark', !!pal.lightOnClear);
    };
    if (!src) apply({ colors: [], lightOnClear: false });
    else if (PALETTE.has(src)) apply(PALETTE.get(src));
    else { apply({ colors: [], lightOnClear: false }); analyzeLogo(src).then(apply); }
    return [bg, h('div', { class: 'v-shade' }), tile];
  }

  // ---------- 링크드인 ----------
  // 링크드인 주소를 https://www.linkedin.com/in/아이디 형태로 맞춥니다. 빈 값은 '', 형식이 틀리면 null.
  function normLinkedin(v) {
    const s = String(v || '').trim();
    if (!s) return '';
    const m = s.match(/^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/(in|pub)\/([^\s?#]+)/i);
    const id = m ? m[2].replace(/\/+$/, '') : '';
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
        h('p', { class: 'ci-bio' }, h('span', { class: 'ci-bio-text', text: '“' + p.topic + '”' })),
        h('button', { type: 'button', class: 'ci-more', 'data-more': '' }, '더 보기'),
      ];
    }
    if (kind === 'org') {
      return [
        null,
        line('building', p.company),
        p.companyIntro ? line('info', p.companyIntro) : null,
        line('tag', p.field + ' · 경력 ' + p.years),
        (p.lookingFor || []).length ? line('search', '찾고 있어요: ' + p.lookingFor.join(', ')) : null,
      ];
    }
    if (kind === 'exp') {
      return [null, head('star', '대표 경험'),
        h('ul', { class: 'ci-list' }, (p.experiences || []).map((x) => h('li', null, h('span', { class: 'clamp', text: x }))))];
    }
    if (kind === 'career') {
      return [null, head('history', '이전 경력'),
        h('ul', { class: 'ci-list' }, careersOf(p).map((c) => h('li', null, h('span', { class: 'clamp' },
          c.period ? h('span', { class: 'ci-period', text: c.period }) : null, [c.org, c.role].filter(Boolean).join(' · ')))))];
    }
    return [null, head('tag', '관심 키워드'),
      h('div', { class: 'ci-chips' }, p.keywords.map((k) => h('span', { class: 'ci-chip' + (shared.includes(k) ? ' shared' : ''), text: k })))];
  }
  function nameEl(p) {
    return h('h3', { class: 'ci-name' }, h('span', { text: p.name }), h('span', { class: 'ci-years', text: yearsShort(p.years) }));
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
    if (target && target.closest('[data-more]')) { openSheet(card._p); return; }
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
        type: 'button', class: 'card-more', 'aria-label': p.name + ' 프로필 자세히 보기',
        onclick: (e) => { e.stopPropagation(); openSheet(p); },
      }, icon('up')));
    card._p = p;
    card._pages = pages;
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
    if (!S.pid || S.editing) return 'onboard';
    if (!S.me) return 'loading';
    return 'app';
  }

  function route() {
    if (!S.store || S.view === 'error') return;
    const next = decide();
    if (next !== S.view) {
      S.view = next;
      VIEWS.forEach((v) => { $('view-' + v).hidden = v !== next; });
      $('app').classList.toggle('wide', next === 'admin');
      $('demo-chip').hidden = !(S.store.mode === 'demo' && next !== 'admin');
      if (next === 'onboard') {
        if (S.editing) startOnboarding('edit');
        else if (!OB.mode || OB.mode === 'edit') startOnboarding('login');
      }
      if (next === 'admin') enterAdmin();
      if (next === 'app') S.renderedTop = null;
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
    seen = null;
    store.set(LS_PID, pid);
    S.unsub.push(S.store.watchSwipes(pid, (sw) => {
      S.swipes = { likes: (sw.likes || []).slice(), passes: (sw.passes || []).slice() };
      onData();
    }));
    S.unsub.push(S.store.watchInbox(pid, (list) => { S.inbox = list; onData(); }));
    S.unsub.push(S.store.watchPrivate(pid, (v) => { S.myLinkedin = v.linkedin || ''; S.met = (v.met || []).slice(); onData(); }));
  }
  function signOut() {
    S.unsub.forEach((u) => u());
    S.unsub = [];
    S.pid = null;
    S.me = null;
    S.editing = false;
    S.continuing = false;
    OB.mode = null;
    store.del(LS_PID);
  }

  // ---------- 가입·프로필 입력 (3, 6, 11, 12) ----------
  const LOGIN_STEPS = ['welcome', 'name', 'pin', 'rules'];
  const PROFILE_STEPS = ['company', 'logo', 'job', 'exp', 'topic', 'tags', 'contact'];
  const OB = { mode: null, base: [], i: 0, d: null, hash: null, pid: null, busy: false };
  // 명단에서 로고를 찾은 회사는 로고 화면을 건너뜁니다.
  const obSteps = () => OB.base.filter((s) => !(s === 'logo' && mappedLogo(OB.d && OB.d.company)));
  const stepId = () => obSteps()[OB.i];

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

  // 새로 가입하는 중인 내용은 이 기기에 임시로 저장해 두었다가, 새로고침해도 이어서 입력합니다. (번호는 저장하지 않음)
  function saveDraft() {
    if (OB.mode !== 'login' || !OB.d) return;
    const d = Object.assign({}, OB.d, { pin: '' });
    delete d._field; delete d._years;
    store.set(LS_DRAFT, JSON.stringify({ step: stepId(), d, hash: OB.hash, pid: OB.pid, at: Date.now() }));
  }
  const clearDraft = () => store.del(LS_DRAFT);

  function startOnboarding(mode) {
    OB.mode = mode;
    OB.i = 0;
    OB.hash = null;
    OB.pid = null;
    if (mode === 'edit') {
      OB.base = PROFILE_STEPS.slice();
      OB.d = draftFrom(S.me);
    } else {
      OB.base = LOGIN_STEPS.concat(PROFILE_STEPS);
      OB.d = blankDraft();
      const saved = store.json(LS_DRAFT);
      if (saved && saved.d && Date.now() - (saved.at || 0) < 12 * 3600 * 1000) {
        OB.d = Object.assign(blankDraft(), saved.d, { pin: '' });
        if (saved.hash) {
          OB.hash = saved.hash;
          OB.pid = saved.pid || null;
          const idx = obSteps().indexOf(saved.step);
          OB.i = idx > 3 ? idx : 3;
          toast('입력하던 내용을 불러왔어요.');
        }
      }
    }
    fillInputs();
    showStep();
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
    $('in-title').placeholder = '예) ' + (ex.title || '');
    $('in-topic').value = d.topic;
    $('in-topic').placeholder = '예) ' + (ex.topic || '');
    $('topic-count').textContent = d.topic.length + '/60';
    $('in-linkedin').value = d.linkedin;
    const exExps = ex.experiences || [];
    $('in-exps').replaceChildren(...[0, 1, 2].map((i) => h('input', {
      class: 'box-input', type: 'text', maxlength: 60, enterkeyhint: i < 2 ? 'next' : 'done', 'aria-label': '대표 경험 ' + (i + 1),
      placeholder: i < exExps.length ? '예) ' + exExps[i] : '경험 하나 더 (선택)', value: d.experiences[i],
      oninput: (e) => { d.experiences[i] = e.target.value; syncNext(); },
    })));
    renderCareers();
    renderPills();
    renderCompanyLogo();
    renderLogoSlot();
  }

  function renderCareers() {
    const d = OB.d;
    const ex = (ND.EXAMPLE_PROFILE && ND.EXAMPLE_PROFILE.careers[0]) || { period: '2018–2021', org: '한빛대 지능로봇연구실', role: '연구원' };
    $('in-careers').replaceChildren(...d.careers.map((c, idx) => {
      const field = (key, ph, cls) => h('input', {
        class: 'box-input' + (cls ? ' ' + cls : ''), type: 'text', maxlength: key === 'period' ? 20 : 30, enterkeyhint: 'next',
        'aria-label': { period: '기간', org: '소속', role: '역할' }[key], placeholder: '예) ' + ph, value: c[key] || '',
        oninput: (e) => { c[key] = e.target.value; syncNext(); },
      });
      return h('div', { class: 'career' },
        field('period', ex.period),
        h('button', { type: 'button', class: 'text-btn del', onclick: () => { d.careers.splice(idx, 1); renderCareers(); syncNext(); } }, '삭제'),
        field('org', ex.org, 'full'),
        field('role', ex.role, 'full'));
    }));
    $('career-add').hidden = d.careers.length >= MAX_CAREERS;
  }

  function pills(container, options, selected, { single = false, max = 99, label = '' } = {}) {
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
          else if (selected.length >= max) { toast(label + '은(는) 최대 ' + max + '개까지 고를 수 있어요.'); return; }
          else selected.push(opt);
          renderPills();
          syncNext();
        },
      }, opt);
    }));
  }
  function renderPills() {
    const d = OB.d;
    d._field = d._field || (d.field ? [d.field] : []);
    d._years = d._years || (d.years ? [d.years] : []);
    pills($('in-field'), FIELDS, d._field, { single: true });
    pills($('in-years'), YEARS, d._years, { single: true });
    d.field = d._field[0] || '';
    d.years = d._years[0] || '';
    pills($('in-keywords'), KEYWORDS.concat(d.extraKeywords), d.keywords, { max: MAX_KEYWORDS, label: '관심 키워드' });
    pills($('in-looking'), LOOKING, d.lookingFor, { max: MAX_LOOKING, label: '찾고 있어요' });
  }
  function addCustomKeyword() {
    const d = OB.d;
    const v = cleanText($('kw-custom').value, 15);
    if (!v) return;
    if (!KEYWORDS.includes(v) && !d.extraKeywords.includes(v)) d.extraKeywords.push(v);
    if (!d.keywords.includes(v)) {
      if (d.keywords.length >= MAX_KEYWORDS) { toast('관심 키워드는 최대 ' + MAX_KEYWORDS + '개까지 고를 수 있어요.'); return; }
      d.keywords.push(v);
    }
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

  // 160px 정사각형으로 줄여 저장합니다. 투명 배경에 밝은 로고는 투명 PNG 그대로(어두운 타일에 표시), 나머지는 흰 바탕 webp.
  function processLogo(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('type')); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const size = 160;
          const pad = 12;
          const iw = img.naturalWidth || size;
          const ih = img.naturalHeight || size;
          const r = Math.min((size - pad * 2) / iw, (size - pad * 2) / ih);
          const draw = (bg) => {
            const c = document.createElement('canvas');
            c.width = size; c.height = size;
            const ctx = c.getContext('2d');
            if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size); }
            ctx.drawImage(img, (size - iw * r) / 2, (size - ih * r) / 2, iw * r, ih * r);
            return c;
          };
          const clear = draw(null);
          const look = analyzePixels(clear.getContext('2d').getImageData(0, 0, size, size).data);
          if (look.lightOnClear) { resolve(clear.toDataURL('image/png')); return; }
          const c = draw('#ffffff');
          let out = c.toDataURL('image/webp', 0.86);
          if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/jpeg', 0.88);
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

  // 빠진 항목이 있으면 무엇이 빠졌는지 알려 줍니다 (6).
  function missing(id) {
    const d = OB.d;
    if (id === 'name' && cleanText(d.name, 20).length < 2) return '이름을 두 글자 이상 입력해 주세요.';
    if (id === 'pin' && !/^\d{4}$/.test(d.pin)) return '휴대폰 번호 뒤 4자리를 숫자로 입력해 주세요.';
    if (id === 'company' && !cleanText(d.company, 30)) return '회사·기관명을 입력해 주세요.';
    if (id === 'job') {
      if (!cleanText(d.title, 30)) return '직함·직무를 입력해 주세요.';
      if (!d.field) return '직무 분야를 골라 주세요.';
      if (!d.years) return '경력 연차를 골라 주세요.';
    }
    if (id === 'exp' && !d.experiences.some((x) => cleanText(x, 60))) return '대표 경험을 하나 이상 입력해 주세요.';
    if (id === 'topic' && !cleanText(d.topic, 60)) return '나누고 싶은 이야기를 한 줄 적어 주세요.';
    if (id === 'contact' && normLinkedin(d.linkedin) === null) return 'linkedin.com/in/ 으로 시작하는 주소를 입력하거나 비워 두세요.';
    return '';
  }
  function nextLabel(id) {
    const d = OB.d;
    if (id === 'welcome') return '시작하기';
    if (id === 'rules') return '동의합니다';
    if (id === 'logo') return d.logo ? '계속' : '로고 없이 계속';
    if (id === 'contact') {
      if (OB.mode === 'edit') return '저장하기';
      return normLinkedin(d.linkedin) ? '완료' : '건너뛰고 완료';
    }
    return '계속';
  }
  function syncNext() {
    const id = stepId();
    const btn = $('ob-next');
    btn.disabled = OB.busy;
    btn.classList.toggle('dim', !!missing(id)); // 흐리게만 표시하고 누르면 빠진 항목을 알려 줌
    btn.textContent = OB.busy ? '잠시만요' : nextLabel(id);
    $('ob-msg').hidden = true;
    saveDraft();
  }

  function showStep() {
    const steps = obSteps();
    if (OB.i >= steps.length) OB.i = steps.length - 1;
    const id = stepId();
    document.querySelectorAll('.ob-step').forEach((s) => { s.hidden = s.dataset.step !== id; });
    $('view-onboard').classList.toggle('is-welcome', id === 'welcome');
    const counted = steps.filter((s) => s !== 'welcome');
    const pos = steps.slice(0, OB.i + 1).filter((s) => s !== 'welcome').length;
    $('ob-bar').style.width = (pos / counted.length) * 100 + '%';
    $('ob-back').hidden = id === 'welcome';
    $('ob-foot-note').hidden = id !== 'welcome';
    $('ob-body').scrollTop = 0;
    if (id === 'logo') renderLogoSlot();
    syncNext();
    if (canGoBackInApp()) armBack();
    const focusTarget = { name: 'in-name', pin: 'in-pin', company: 'in-company', job: 'in-title', topic: 'in-topic', contact: 'in-linkedin' }[id];
    if (focusTarget) setTimeout(() => { if (S.view === 'onboard' && stepId() === id) $(focusTarget).focus({ preventScroll: true }); }, 60);
  }

  function obBack() {
    if (OB.busy) return;
    if (OB.i === 0 && OB.mode === 'edit') { S.editing = false; OB.mode = null; route(); return; }
    if (OB.i > 0) { OB.i--; showStep(); }
  }

  async function obNext() {
    const id = stepId();
    if (OB.busy) return;
    const why = missing(id);
    if (why) {
      $('ob-msg').textContent = why;
      $('ob-msg').hidden = false;
      const btn = $('ob-next');
      btn.classList.remove('shake');
      void btn.offsetWidth;
      btn.classList.add('shake');
      return;
    }
    if (id === 'pin') { await lookup(); return; }
    if (OB.i === obSteps().length - 1) { await saveProfile(); return; }
    OB.i++;
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

  function collectProfile() {
    const d = OB.d;
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

  async function saveProfile() {
    const data = collectProfile();
    const ln = normLinkedin(OB.d.linkedin) || '';
    OB.busy = true; syncNext();
    try {
      if (OB.mode === 'edit') {
        await S.store.updateProfile(S.pid, data);
        if (ln !== S.myLinkedin) await S.store.savePrivate(S.pid, { linkedin: ln }, S.swipes.likes);
        S.myLinkedin = ln;
        S.me = Object.assign({}, S.me, data);
        S.editing = false;
        OB.mode = null;
        S.tab = 'me';
        toast('프로필을 저장했어요.');
      } else {
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
      }
      route();
    } catch (ex) {
      console.error(ex);
      S.creating = false;
      toast('저장하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.');
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

  function renderApp() {
    ['swipe', 'likes', 'me'].forEach((t) => {
      $('tab-' + t).hidden = S.tab !== t;
      const b = $('tb-' + t);
      if (S.tab === t) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    const n = inboxPeople().length;
    $('tb-badge').hidden = n === 0;
    $('tb-badge').textContent = String(n);
    if (S.tab === 'swipe') renderSwipeTab();
    else if (S.tab === 'likes') renderLikesTab();
    else renderMeTab();
  }
  function goTab(t) {
    S.tab = t;
    if (t === 'swipe') S.renderedTop = null;
    renderApp();
  }

  // --- 새 LIKE·서로 선택 알림 (8) ---
  let seen = null; // { inbox: [...], mutual: [...] }
  function checkNews() {
    if (!S.pid || !unlocked() || !S.profilesLoaded) return;
    const inIds = inboxPeople().map((x) => x.p.id);
    const mutualIds = inIds.filter((id) => S.swipes.likes.includes(id));
    if (!seen) seen = store.json(lsSeen());
    if (!seen) {
      // 처음 열리는 순간(완료 화면)에는 지금 상태를 기준으로 삼고 따로 알리지 않습니다.
      seen = { inbox: inIds, mutual: mutualIds };
      store.set(lsSeen(), JSON.stringify(seen));
      return;
    }
    const newIn = inIds.filter((id) => !seen.inbox.includes(id) && !mutualIds.includes(id));
    const newMutual = mutualIds.filter((id) => !seen.mutual.includes(id));
    if (!newIn.length && !newMutual.length) return;
    seen = { inbox: Array.from(new Set(seen.inbox.concat(inIds))), mutual: Array.from(new Set(seen.mutual.concat(mutualIds))) };
    store.set(lsSeen(), JSON.stringify(seen));
    if (newMutual.length && $('finish').hidden) showMatch(S.profiles.get(newMutual[0]));
    else if (newIn.length) {
      const p = S.profiles.get(newIn[0]);
      toast('새로 나를 고른 사람: ' + p.name + ' (' + p.company + ')' + (newIn.length > 1 ? ' 외 ' + (newIn.length - 1) + '명' : ''));
    }
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
  function closeMatch() { $('match').hidden = true; matchWho = null; }

  // --- 스와이프 탭 ---
  function candidates() {
    const seenIds = new Set(S.swipes.likes.concat(S.swipes.passes));
    return visibleProfiles().filter((p) => p.id !== S.pid && !seenIds.has(p.id));
  }
  function syncDeck() {
    const ids = new Set(candidates().map((p) => p.id));
    S.deckOrder = S.deckOrder.filter((id) => ids.has(id));
    const known = new Set(S.deckOrder);
    const fresh = [...ids].filter((id) => !known.has(id)).sort((a, b) => hash32(S.pid + a) - hash32(S.pid + b));
    S.deckOrder.push(...fresh);
  }

  function swipeMode() {
    if (S.phase === 'registration') return 'wait';
    if (S.phase === 'ended') return 'ended';
    if (picksFull()) return 'done';
    if (S.me && S.me.done && !S.continuing) return 'done';
    if (!S.deckOrder.length) return S.me && S.me.done ? 'done' : 'empty';
    return 'deck';
  }

  function renderSwipeTab() {
    syncDeck();
    $('pick-count').replaceChildren(icon('heart'), S.swipes.likes.length + ' / ' + MAX);
    const mode = swipeMode();
    $('deck-area').hidden = mode !== 'deck';
    $('radar').hidden = mode === 'deck';
    if (mode !== 'deck') { renderRadar(mode); S.renderedTop = null; return; }

    $('btn-undo').disabled = !S.last;
    const top = S.deckOrder[0];
    const second = S.deckOrder[1] || null;
    const key = top + '|' + second;
    if (acting || S.renderedTop === key) return;
    S.renderedTop = key;
    const kids = [];
    if (second && S.profiles.get(second)) {
      const back = cardEl(S.profiles.get(second), { swipe: true });
      back.classList.add('back');
      back.setAttribute('aria-hidden', 'true');
      kids.push(back);
    }
    const front = cardEl(S.profiles.get(top), { swipe: true });
    front.classList.add('top');
    bindDrag(front);
    kids.push(front);
    if (!store.get(LS_COACH)) kids.push(coachEl());
    $('deck').replaceChildren(...kids);
  }

  // 처음 한 번만 보여 주는 사용 안내 (2)
  function coachEl() {
    const el = h('div', { class: 'coach', role: 'dialog', 'aria-label': '사용 방법' },
      h('div', { class: 'coach-zone' }, h('b', null, '‹'), '왼쪽을 탭하면', h('br'), '이전 정보'),
      h('div', { class: 'coach-zone' }, h('b', null, '›'), '오른쪽을 탭하면', h('br'), '다음 정보'),
      h('div', { class: 'coach-foot' },
        h('span', null, '← 밀면 넘기기 · 밀면 고르기 →'),
        h('button', { type: 'button', class: 'cta' }, '알겠어요')));
    el.addEventListener('click', () => { store.set(LS_COACH, '1'); el.remove(); });
    return el;
  }

  function renderRadar(mode) {
    const n = visibleProfiles().length;
    const likes = S.swipes.likes.length;
    syncDeck();
    const left = S.deckOrder.length;
    const passed = S.swipes.passes.filter((id) => { const p = S.profiles.get(id); return p && !p.hidden; }).length;
    $('radar-ring').classList.toggle('live', mode === 'wait' || mode === 'empty');
    if (S.me) $('radar-logo').replaceChildren(logoEl(S.me));
    const goLikes = () => h('button', { type: 'button', class: 'cta', onclick: () => { S.likesTab = 'in'; goTab('likes'); } }, 'LIKE 확인하기');
    const more = () => (likes < MAX && left
      ? h('button', { type: 'button', class: 'ghost-btn', onclick: () => { S.continuing = true; S.renderedTop = null; render(); } },
        (MAX - likes) + '명 더 고르기 · 남은 카드 ' + left + '장')
      : null);
    const revisit = () => (likes < MAX && !left && passed
      ? h('button', { type: 'button', class: 'ghost-btn', onclick: revisitPasses }, '넘긴 ' + passed + '명 다시 보기')
      : null);
    const content = {
      wait: ['곧 카드가 열려요', '지금 ' + n + '명 참여 중이에요. 운영진이 시작하면 이 화면이 바로 바뀌어요.', []],
      empty: ['새 참가자를 기다리는 중', '다른 참가자가 등록하면 바로 카드가 나타나요.', [revisit()]],
      done: [likes >= MAX ? MAX + '명을 모두 골랐어요' : likes + '명을 골랐어요',
        likes >= MAX ? 'LIKE에서 누가 나를 골랐는지 확인하고 찾아가 인사해 보세요.' : '남은 자리는 더 고르거나, 이대로 LIKE를 확인해도 돼요.',
        [goLikes(), more(), revisit()]],
      ended: ['네트워킹 시간이에요', '명찰의 이름과 회사를 보고 찾아가 인사해 보세요.', [goLikes()]],
    }[mode];
    $('radar-title').textContent = content[0];
    $('radar-text').textContent = content[1];
    $('radar-actions').replaceChildren(...content[2].filter(Boolean));
  }

  // 넘긴 사람을 다시 카드로 (7)
  function revisitPasses() {
    const likes = S.swipes.likes.slice();
    S.swipes = { likes, passes: [] };
    S.continuing = true;
    S.renderedTop = null;
    S.last = null;
    enqueue(() => S.store.saveSwipe(S.pid, { likes, passes: [] }, null, null));
    render();
  }
  // 고른 사람 취소 (7)
  function unpick(id) {
    const likes = S.swipes.likes.filter((x) => x !== id);
    const passes = S.swipes.passes.slice();
    S.swipes = { likes, passes };
    S.renderedTop = null;
    likesKey = '';
    enqueue(() => S.store.saveSwipe(S.pid, { likes, passes }, { remove: id }, null));
    toast('선택을 취소했어요. 스와이프에서 다른 사람을 고를 수 있어요.');
    render();
  }

  function bindDrag(card) {
    let sx = 0, sy = 0, dx = 0, pointer = null, decided = false, dragging = false, moved = false;
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
      if (e.button !== 0 || card.dataset.leaving || e.target.closest('.card-more')) return;
      sx = e.clientX; sy = e.clientY; dx = 0; pointer = e.pointerId; decided = false; dragging = false; moved = false;
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
      if (dx > 90) act('like');
      else if (dx < -90) act('pass');
      else reset();
    });
    card.addEventListener('pointercancel', (e) => { if (e.pointerId === pointer) { pointer = null; dragging = false; reset(); } });
  }

  function flyOut(kind) {
    const card = $('deck').querySelector('.card.top');
    if (!card) return Promise.resolve();
    card.dataset.leaving = '1';
    card.classList.remove('dragging');
    const stamp = card.querySelector(kind === 'like' ? '.stamp.like' : '.stamp.nope');
    if (stamp) stamp.style.opacity = 1;
    const dir = kind === 'like' ? 1 : -1;
    card.style.transform = 'translate(' + dir * 140 + '%, 40px) rotate(' + dir * 22 + 'deg)';
    card.style.opacity = '0';
    const back = $('deck').querySelector('.card.back');
    if (back) { back.classList.remove('back'); back.style.transform = ''; }
    return new Promise((r) => setTimeout(r, 260));
  }

  let acting = false;
  async function act(kind) {
    if (acting || S.view !== 'app' || S.tab !== 'swipe' || swipeMode() !== 'deck') return;
    const coach = $('deck').querySelector('.coach');
    if (coach) { store.set(LS_COACH, '1'); coach.remove(); }
    const id = S.deckOrder[0];
    if (!id) return;
    if (kind === 'like' && picksFull()) return;
    acting = true;
    const likes = S.swipes.likes.slice();
    const passes = S.swipes.passes.slice();
    if (kind === 'like') likes.push(id); else passes.push(id);
    S.swipes = { likes, passes };
    S.deckOrder.shift();
    S.last = { id, kind };
    const finished = likes.length >= MAX || S.deckOrder.length === 0;
    const wasDone = !!(S.me && S.me.done);
    const ln = S.myLinkedin;
    enqueue(() => S.store.saveSwipe(S.pid, { likes, passes }, kind === 'like' ? { add: id, ln } : null, finished && !wasDone ? true : null));
    await flyOut(kind);
    acting = false;
    S.renderedTop = null;
    if (finished) {
      S.last = null;
      S.continuing = false;
      if (S.me) S.me = Object.assign({}, S.me, { done: true });
      if (!wasDone) showFinish();
    }
    render();
  }

  function undo() {
    if (!S.last || acting) return;
    const { id, kind } = S.last;
    const likes = S.swipes.likes.filter((x) => x !== id);
    const passes = S.swipes.passes.filter((x) => x !== id);
    S.swipes = { likes, passes };
    S.deckOrder = [id].concat(S.deckOrder.filter((x) => x !== id));
    S.last = null;
    S.renderedTop = null;
    enqueue(() => S.store.saveSwipe(S.pid, { likes, passes }, kind === 'like' ? { remove: id } : null, null));
    render();
  }

  function showFinish() {
    const picks = minePeople();
    const mineIds = new Set(picks.map((p) => p.id));
    const mutual = inboxPeople().filter((x) => mineIds.has(x.p.id)).length;
    $('finish-title').textContent = picks.length >= MAX ? MAX + '명 선택 완료!' : '카드를 다 넘겼어요';
    $('finish-logos').replaceChildren(...picks.map((p) => h('span', { class: 'fl' }, logoEl(p))));
    $('finish-text').textContent = mutual
      ? '나를 고른 사람 중 ' + mutual + '명을 나도 골랐어요.'
      : '이제 누가 나를 골랐는지 확인해 보세요.';
    $('finish').hidden = false;
    armBack();
  }

  // --- LIKE 탭 (7, 9) ---
  let likesKey = '';
  function renderLikesTab() {
    const open = unlocked();
    const inList = inboxPeople();
    const mine = minePeople();
    const inIds = new Set(inList.map((x) => x.p.id));
    $('likes-count').textContent = String(inList.length);
    $('seg-in').textContent = '나를 고른 사람 ' + inList.length;
    $('seg-out').textContent = '내가 고른 사람 ' + mine.length;
    $('seg-in').setAttribute('aria-pressed', String(S.likesTab === 'in'));
    $('seg-out').setAttribute('aria-pressed', String(S.likesTab === 'out'));

    const key = [S.likesTab, open, S.phase, S.met.join(','), inList.map((x) => x.p.id + ':' + (x.p.updatedAt || '') + ':' + lnFrom(x.p.id)).join(','),
      mine.map((p) => p.id + ':' + (p.updatedAt || '')).join(',')].join('|');
    if (key === likesKey) return;
    likesKey = key;

    const body = $('likes-body');
    if (S.likesTab === 'in') {
      if (!inList.length) {
        body.replaceChildren(h('div', { class: 'empty-box' }, h('b', null, '아직 나를 고른 사람이 없어요'),
          h('span', null, '다른 참가자들이 카드를 넘기는 중이에요. 누군가 나를 고르면 바로 여기에 나타나요.')));
      } else if (!open) {
        body.replaceChildren(
          h('div', { class: 'locked-grid' }, inList.map((x) => h('div', { class: 'locked-tile', 'aria-hidden': 'true' }, ...visualEls(x.p)))),
          h('div', { class: 'lock-box' }, icon('lock'),
            h('b', null, inList.length + '명이 나와 대화하고 싶어해요'),
            h('p', null, MAX + '명을 모두 고르면 누군지 볼 수 있어요.'),
            S.phase === 'swipe' ? h('button', { type: 'button', class: 'cta', onclick: () => goTab('swipe') }, '계속 고르기') : null));
      } else {
        const metN = inList.filter((x) => S.met.includes(x.p.id)).length;
        body.replaceChildren(...[
          metN ? h('p', { class: 'met-count', text: '대화 완료 ' + metN + ' / ' + inList.length + '명' }) : null,
          h('ul', null, inList.map((x) => likeItem(x.p, S.swipes.likes.includes(x.p.id), { canUnpick: false }))),
        ].filter(Boolean));
      }
    } else if (!mine.length) {
      body.replaceChildren(h('div', { class: 'empty-box' }, h('b', null, '아직 고른 사람이 없어요'),
        S.phase === 'swipe' ? h('button', { type: 'button', class: 'ghost-btn', onclick: () => goTab('swipe') }, '카드 넘기러 가기') : null));
    } else {
      body.replaceChildren(h('ul', null, mine.map((p) => likeItem(p, open && inIds.has(p.id), { canUnpick: S.phase === 'swipe' }))));
    }
  }

  function toggleMet(id) {
    const met = S.met.includes(id) ? S.met.filter((x) => x !== id) : S.met.concat(id);
    S.met = met;
    likesKey = '';
    enqueue(() => S.store.savePrivate(S.pid, { met }, null));
    render();
  }

  function likeItem(p, mutual, { canUnpick }) {
    const open = () => openSheet(p, mutual);
    const met = S.met.includes(p.id);
    let armed = null;
    const unpickBtn = canUnpick ? h('button', {
      type: 'button', class: 'chip-btn warn',
      onclick: (e) => {
        const b = e.currentTarget;
        if (b.classList.contains('armed')) { unpick(p.id); return; }
        b.classList.add('armed');
        b.textContent = '한 번 더 누르면 취소돼요';
        clearTimeout(armed);
        armed = setTimeout(() => { b.classList.remove('armed'); b.textContent = '선택 취소'; }, 3000);
      },
    }, '선택 취소') : null;
    return h('li', { class: 'li' + (met ? ' met' : '') },
      h('p', { class: 'li-name' }, p.name, h('span', { text: ', ' + yearsShort(p.years) })),
      h('div', { class: 'li-row' },
        h('button', { type: 'button', class: 'li-card', onclick: open, 'aria-label': p.name + ' 프로필 보기' },
          ...visualEls(p),
          h('span', { class: 'li-meta' },
            mutual ? h('span', { class: 'li-mutual' }, '서로 선택') : null,
            h('span', { class: 'li-sub', text: p.company + ' · ' + p.title }))),
        h('button', { type: 'button', class: 'li-quote', onclick: open },
          h('span', { class: 'li-q-k' }, icon('quote'), '이런 이야기를 나누고 싶어요'),
          h('span', { class: 'li-q-v', text: p.topic }))),
      h('div', { class: 'li-actions' },
        unlocked() ? h('button', { type: 'button', class: 'chip-btn' + (met ? ' on' : ''), 'aria-pressed': String(met), onclick: () => toggleMet(p.id) },
          icon('check'), met ? '대화했어요' : '대화했으면 눌러 주세요') : null,
        mutual ? linkedinBtn(lnFrom(p.id)) : null,
        unpickBtn));
  }

  // --- 프로필 탭 (5) ---
  let meKey = '';
  function renderMeTab() {
    $('me-linkedin').textContent = S.myLinkedin
      ? '링크드인: ' + S.myLinkedin.replace('https://www.', '') + ' (서로 고른 사람에게만 보여요)'
      : '링크드인을 넣으면 서로 고른 사람에게만 보여요. 프로필 수정에서 추가할 수 있어요.';
    const key = JSON.stringify(S.me);
    if (key === meKey) return;
    meKey = key;
    $('me-card').replaceChildren(cardEl(S.me));
  }
  async function leaveDevice() {
    $('me-out-note').hidden = true;
    try { if (S.store.resetDevice) await S.store.resetDevice(); } catch (e) { console.error(e); }
    signOut();
    clearDraft();
    meKey = '';
    likesKey = '';
    toast('이 기기에서 나갔어요. 다음 사람이 등록할 수 있어요.');
    route();
  }

  // ---------- 프로필 전체 보기 (14) ----------
  function openSheet(p, mutual) {
    const shared = sharedKeywords(p);
    const careers = careersOf(p);
    if (mutual === undefined) mutual = unlocked() && S.swipes.likes.includes(p.id) && S.inbox.some((x) => x.id === p.id);
    const sec = (title, ...body) => h('section', { class: 'sh-sec' }, h('h3', { text: title }), ...body);
    $('sheet-body').replaceChildren(
      h('div', { class: 'sh-visual' }, ...visualEls(p),
        h('button', { type: 'button', class: 'sh-close', 'aria-label': '닫기', 'data-close': '' }, icon('down'))),
      h('div', { class: 'sh-content' },
        h('h2', { class: 'sh-name' }, p.name, h('span', { class: 'ci-years', text: ' ' + yearsShort(p.years) })),
        mutual ? h('span', { class: 'li-mutual' }, '서로 선택') : null,
        mutual ? linkedinBtn(lnFrom(p.id)) : null,
        h('div', { class: 'sh-lines' }, line('briefcase', p.title + ' · ' + p.field), line('building', p.company)),
        sec('이런 이야기를 나누고 싶어요', h('p', { class: 'sh-quote', text: p.topic })),
        p.companyIntro ? sec('회사가 하는 일', h('p', { text: p.companyIntro })) : null,
        sec('대표 경험', h('ul', { class: 'ci-list' }, (p.experiences || []).map((x) => h('li', { text: x })))),
        careers.length ? sec('이전 경력', h('ul', { class: 'ci-list' }, careers.map((c) => h('li', null,
          c.period ? h('span', { class: 'ci-period', text: c.period }) : null, [c.org, c.role].filter(Boolean).join(' · '))))) : null,
        (p.keywords || []).length ? sec('관심 키워드', h('div', { class: 'ci-chips' },
          p.keywords.map((k) => h('span', { class: 'ci-chip' + (shared.includes(k) ? ' shared' : ''), text: k })))) : null,
        (p.lookingFor || []).length ? sec('찾고 있어요', h('div', { class: 'ci-chips' },
          p.lookingFor.map((k) => h('span', { class: 'ci-chip', text: k })))) : null));
    $('sheet').hidden = false;
    $('sheet-body').scrollTop = 0;
    $('sheet-body').querySelector('.sh-close').focus({ preventScroll: true });
    armBack();
  }
  function closeSheet() { $('sheet').hidden = true; }

  // ---------- 전체 알림 (21) ----------
  let noticeTimer = null;
  function showNotice(s) {
    if (!s || !s.notice || !s.noticeAt) return;
    const last = Number(store.get(LS_NOTICE) || 0);
    if (s.noticeAt <= last || Date.now() - s.noticeAt > 10 * 60 * 1000) return;
    store.set(LS_NOTICE, String(s.noticeAt));
    const b = $('notice-banner');
    b.textContent = s.notice;
    b.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { b.hidden = true; }, 10000);
  }

  // ---------- 운영자 ----------
  let pendingPhase = null;
  let resetPending = false;
  let adminBusy = false;
  async function adminTask(fn, done) {
    if (adminBusy) return;
    adminBusy = true;
    ['test-add', 'test-reset', 'reset-yes', 'notice-send'].forEach((id) => { $(id).disabled = true; });
    try { await fn(); toast(done); }
    catch (ex) { console.error(ex); toast('처리하지 못했어요. 운영자 PIN으로 다시 들어와 주세요.'); }
    finally {
      adminBusy = false;
      ['test-add', 'test-reset', 'reset-yes', 'notice-send'].forEach((id) => { $(id).disabled = false; });
      render();
    }
  }
  async function enterAdmin() {
    S.admin = await S.store.isAdmin();
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
  const PHASE_TEXT = {
    registration: '프로필 등록 단계로 바꿀까요? 참가자 화면이 대기 화면으로 바뀝니다.',
    swipe: '스와이프를 시작할까요? 등록한 참가자 화면이 바로 카드 화면으로 바뀝니다.',
    ended: '종료할까요? 참가자는 더 고를 수 없고 LIKE 목록만 보게 됩니다.',
  };

  function renderAdmin() {
    $('admin-login').hidden = S.admin;
    $('admin-panel').hidden = !S.admin;
    if (!S.admin) return;
    $('phase-seg').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.phase === S.phase)));
    $('phase-confirm').hidden = !pendingPhase;
    if (pendingPhase) $('phase-confirm-text').textContent = PHASE_TEXT[pendingPhase];
    $('reset-confirm').hidden = !resetPending;
    $('reset-n').textContent = String(S.profiles.size);
    const all = [...S.profiles.values()].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const visible = all.filter((p) => !p.hidden);
    const doneN = visible.filter((p) => p.done).length;
    $('st-reg').replaceChildren(String(visible.length), h('small', null, ' / ' + CAP));
    $('st-doing').textContent = S.phase === 'swipe' ? String(visible.filter((p) => !p.test).length - visible.filter((p) => !p.test && p.done).length) : '–';
    $('st-done').textContent = String(doneN);
    $('st-hidden').textContent = String(all.length - visible.length);
    $('admin-rows').replaceChildren(...all.map((p) => h('tr', { class: p.hidden ? 'is-hidden' : null },
      h('td', null, p.name, p.test ? h('span', { class: 'tag-test' }, '테스트') : null),
      h('td', { class: 'wrap', text: p.company }),
      h('td', { class: 'wrap', text: p.title }),
      h('td', null, h('span', { class: 'state' + (p.done ? ' done' : ''), text: p.done ? '완료' : '진행 전' })),
      h('td', null, h('button', {
        type: 'button', class: 'ghost-btn',
        onclick: () => enqueue(() => S.store.setHidden(p.id, !p.hidden)),
      }, p.hidden ? '다시 보이기' : '숨기기')))));
    $('qr-url').textContent = entryUrl();
    drawQr($('qr'), 280);
  }

  // ---------- 데이터 변경 ----------
  function onData() {
    if (S.pid) {
      const fresh = S.profiles.get(S.pid);
      if (fresh) S.me = fresh;
      else if (S.profilesLoaded && !S.creating) signOut(); // 운영진이 콘솔에서 프로필을 지운 경우
    }
    route();
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
    $('in-topic').addEventListener('input', (e) => { OB.d.topic = e.target.value; $('topic-count').textContent = e.target.value.length + '/60'; syncNext(); });
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
      catch (ex) { toast('이미지를 읽지 못했어요. PNG나 JPG 파일로 다시 올려 주세요.'); }
    });
    $('logo-badge').addEventListener('click', () => {
      if (OB.d.logo) { OB.d.logo = null; renderLogoSlot(); syncNext(); }
      else $('in-logo').click();
    });

    document.querySelectorAll('.tabbar button').forEach((b) => b.addEventListener('click', () => goTab(b.dataset.tab)));
    $('seg-in').addEventListener('click', () => { S.likesTab = 'in'; renderApp(); });
    $('seg-out').addEventListener('click', () => { S.likesTab = 'out'; renderApp(); });
    $('me-edit').addEventListener('click', () => { S.editing = true; route(); });
    $('me-out').addEventListener('click', () => { $('me-out-note').hidden = false; });
    $('me-out-yes').addEventListener('click', leaveDevice);
    $('btn-like').addEventListener('click', () => act('like'));
    $('btn-nope').addEventListener('click', () => act('pass'));
    $('btn-undo').addEventListener('click', undo);
    $('finish-go').addEventListener('click', () => { $('finish').hidden = true; S.likesTab = 'in'; goTab('likes'); });
    $('finish-close').addEventListener('click', () => { $('finish').hidden = true; });
    $('match-view').addEventListener('click', () => { const p = matchWho; closeMatch(); if (p) openSheet(p, true); });
    $('match-close').addEventListener('click', closeMatch);
    $('sheet').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeSheet(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { onBack(); }
      if (S.view !== 'app' || S.tab !== 'swipe' || !$('sheet').hidden || !$('finish').hidden || !$('match').hidden) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) return;
      if (e.key === 'ArrowRight') act('like');
      if (e.key === 'ArrowLeft') act('pass');
    });

    $('admin-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pin = $('admin-pin').value.trim();
      if (!pin) return;
      const ok = await S.store.becomeAdmin(pin);
      $('admin-error').hidden = ok;
      if (ok) { S.admin = true; $('admin-pin').value = ''; render(); }
    });
    $('phase-seg').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-phase]');
      if (!b || b.dataset.phase === S.phase) return;
      pendingPhase = b.dataset.phase;
      render();
    });
    $('phase-yes').addEventListener('click', async () => {
      const next = pendingPhase;
      pendingPhase = null;
      try { await S.store.setPhase(next); toast('진행 단계를 바꿨어요.'); }
      catch (ex) { console.error(ex); toast('바꾸지 못했어요. 운영자 PIN으로 다시 들어와 주세요.'); }
      render();
    });
    $('phase-no').addEventListener('click', () => { pendingPhase = null; render(); });
    $('notice-presets').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-notice]');
      if (b) adminTask(() => S.store.sendNotice(b.dataset.notice, S.phase), '알림을 보냈어요.');
    });
    $('notice-send').addEventListener('click', () => {
      const text = cleanText($('notice-text').value, 60);
      if (!text) return;
      adminTask(() => S.store.sendNotice(text, S.phase), '알림을 보냈어요.').then(() => { $('notice-text').value = ''; });
    });
    $('test-add').addEventListener('click', () => {
      if (S.store.mode === 'demo') { toast('시연 모드에는 예시 참가자가 이미 들어 있어요.'); return; }
      const keys = ['name', 'company', 'companyIntro', 'logo', 'title', 'field', 'years', 'careers', 'experiences', 'keywords', 'lookingFor', 'topic'];
      const list = (ND.SAMPLE_PROFILES || []).map((p) => ({
        id: 'test-' + p.id,
        data: Object.fromEntries(keys.map((k) => [k, p[k]])),
      }));
      adminTask(() => S.store.addTestProfiles(list), '예시 참가자 ' + list.length + '명을 넣었어요.');
    });
    $('test-reset').addEventListener('click', () => { resetPending = true; render(); });
    $('reset-no').addEventListener('click', () => { resetPending = false; render(); });
    $('reset-yes').addEventListener('click', () => {
      resetPending = false;
      const pids = [...S.profiles.keys()];
      adminTask(() => S.store.resetAll(pids), '모두 지웠어요. 진행 단계가 프로필 등록으로 돌아갔어요.');
    });
    $('qr-big').addEventListener('click', () => {
      $('qr-large-url').textContent = entryUrl();
      $('qr-full').hidden = false;
      armBack();
      drawQr($('qr-large'), 520);
    });
    $('qr-close').addEventListener('click', () => { $('qr-full').hidden = true; });
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
    $('demo-close').addEventListener('click', () => { $('demo-menu').hidden = true; });
    $('demo-menu').addEventListener('click', (e) => { if (e.target === $('demo-menu')) $('demo-menu').hidden = true; });
    $('demo-admin').addEventListener('click', () => { $('demo-menu').hidden = true; });
    $('demo-phase').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-phase]');
      if (b) S.store.setPhase(b.dataset.phase);
    });
    $('demo-reset').addEventListener('click', () => {
      S.store.reset();
      [LS_PID, LS_DRAFT, LS_COACH, LS_NOTICE].forEach((k) => store.del(k));
      try { Object.keys(localStorage).filter((k) => k.startsWith('nd-seen:')).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* 무시 */ }
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
      if (prev !== 'swipe' && S.phase === 'swipe') { S.tab = 'swipe'; S.renderedTop = null; }
      showNotice(s);
      onData();
    });
    S.store.watchProfiles((list) => {
      S.profiles = new Map(list.map((p) => [p.id, p]));
      S.profilesLoaded = true;
      onData();
    });

    const saved = store.get(LS_PID);
    if (saved && await S.store.isOwner(saved)) await enterAs(saved);
    route();
    renderNet();
  }

  boot();
})();
