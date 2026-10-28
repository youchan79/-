// 오늘의 5명 — 화면과 흐름
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

  const $ = (id) => document.getElementById(id);
  const VIEWS = ['loading', 'error', 'entry', 'profile', 'wait', 'swipe', 'result', 'admin'];

  const S = {
    store: null,
    pid: null,
    me: null,
    profiles: new Map(),
    profilesLoaded: false,
    phase: 'registration',
    swipes: { likes: [], passes: [] },
    inbox: [],
    deckOrder: [],
    renderedTop: null,
    last: null,
    pending: null,     // 새 프로필 입력 중: {name, hash, pid}
    creating: false,
    editing: false,
    continuing: false, // 결과를 본 뒤 새 카드 이어서 고르기
    admin: false,
    view: null,
    unsub: [],
  };

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
  };
  const LS_PID = 'nd-pid:' + EVENT_ID + ':' + (C.firebase && !C.demo ? 'live' : 'demo');

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
    else toast('연결이 불안정해요. 잠시 뒤 자동으로 다시 시도합니다.');
  };

  let queue = Promise.resolve();
  function enqueue(fn) {
    queue = queue.then(fn).catch((err) => {
      console.error(err);
      toast('저장하지 못했어요. 인터넷 연결을 확인해 주세요.');
    });
    return queue;
  }

  // ---------- 로고·카드 ----------
  function logoEl(p, size) {
    const box = h('div', { class: 'logo' + (size ? ' ' + size : '') });
    const label = (p.company || '회사') + ' 로고';
    if (p.logo) {
      box.append(h('img', { src: p.logo, alt: label }));
    } else {
      const ch = (p.company || '?').trim().charAt(0).toUpperCase() || '?';
      box.classList.add('mono-logo');
      box.style.setProperty('--mono', MONO_COLORS[hash32(p.company || '') % MONO_COLORS.length]);
      box.setAttribute('role', 'img');
      box.setAttribute('aria-label', label);
      box.append(h('span', { 'aria-hidden': 'true', text: ch }));
    }
    return box;
  }

  function section(label, body) {
    return h('div', { class: 'pcard-sec' }, h('p', { class: 'k' }, label), body);
  }

  function cardEl(p) {
    const myKw = (S.me && S.me.keywords) || [];
    const shared = p.id === S.pid ? [] : (p.keywords || []).filter((k) => myKw.includes(k));
    const careers = (p.careers || []).filter((c) => c && (c.org || c.role));
    return h('article', { class: 'pcard', 'data-id': p.id },
      h('header', { class: 'pcard-head' },
        logoEl(p, ''),
        h('div', { class: 'pcard-org' },
          h('p', { class: 'pcard-company', text: p.company }),
          p.companyIntro ? h('p', { class: 'pcard-intro', text: p.companyIntro }) : null)),
      h('div', { class: 'pcard-body' },
        h('div', { class: 'pcard-who' },
          h('h3', { class: 'pcard-name', text: p.name }),
          h('p', { class: 'pcard-title', text: p.title }),
          h('p', { class: 'pcard-meta' },
            h('span', { class: 'tag', text: p.field }),
            h('span', { class: 'tag', text: '경력 ' + p.years }))),
        h('div', { class: 'pcard-topic' },
          h('p', { class: 'k', text: '이런 이야기를 나누고 싶어요' }),
          h('p', { class: 'v', text: '“' + p.topic + '”' })),
        section('대표 경험', h('ul', { class: 'bul' }, (p.experiences || []).map((x) => h('li', { text: x })))),
        careers.length ? section('이전 경력', h('ul', { class: 'careers' }, careers.map((c) =>
          h('li', null, h('span', { class: 'period', text: c.period || '' }),
            h('span', { text: [c.org, c.role].filter(Boolean).join(' · ') }))))) : null,
        (p.keywords || []).length ? section(
          ['관심 키워드', shared.length ? h('span', { class: 'shared-note', text: '나와 같은 관심 ' + shared.length + '개' }) : null],
          h('div', { class: 'chips static' }, p.keywords.map((k) => h('span', { class: 'chip' + (shared.includes(k) ? ' shared' : ''), text: k })))) : null,
        (p.lookingFor || []).length ? section('찾고 있어요',
          h('div', { class: 'chips static' }, p.lookingFor.map((k) => h('span', { class: 'chip', text: k })))) : null));
  }

  // ---------- 화면 전환 ----------
  function visibleProfiles() {
    return [...S.profiles.values()].filter((p) => !p.hidden);
  }
  function isFinished() {
    return S.swipes.likes.length >= MAX || !!(S.me && S.me.done);
  }

  function decide() {
    if (location.hash === '#admin') return 'admin';
    if (S.pending) return 'profile';
    if (!S.pid) return 'entry';
    if (S.editing) return 'profile';
    if (!S.me) return 'loading';
    if (S.phase === 'registration') return 'wait';
    if (S.phase === 'ended') return 'result';
    if (isFinished() && !S.continuing) return 'result';
    return 'swipe';
  }

  function route() {
    if (!S.store || S.view === 'error') return;
    const next = decide();
    if (next !== S.view) {
      const prev = S.view;
      S.view = next;
      VIEWS.forEach((v) => { $('screen-' + v).hidden = v !== next; });
      $('app').classList.toggle('fill', next === 'swipe');
      $('app').classList.toggle('wide', next === 'admin');
      if (prev) window.scrollTo(0, 0);
      enter(next);
    }
    $('bar-profile').hidden = !(S.pid && S.me && ['wait', 'swipe', 'result'].includes(S.view));
    render();
  }

  function enter(view) {
    if (view === 'profile') fillForm();
    if (view === 'swipe') { S.renderedTop = null; syncDeck(); }
    if (view === 'admin') enterAdmin();
  }

  function render() {
    if (S.view === 'wait') renderWait();
    else if (S.view === 'swipe') renderSwipe();
    else if (S.view === 'result') renderResult();
    else if (S.view === 'admin') renderAdmin();
    if (S.store && S.store.mode === 'demo') {
      const names = { registration: '등록', swipe: '스와이프', ended: '종료' };
      $('demo-phase').textContent = '단계: ' + names[S.phase] + ' → 바꾸기';
    }
  }

  function showFatal(title, text, detail) {
    $('error-title').textContent = title;
    $('error-text').textContent = text;
    $('error-detail').textContent = detail || '';
    VIEWS.forEach((v) => { $('screen-' + v).hidden = v !== 'error'; });
    S.view = 'error';
  }

  // ---------- 1. 입장 ----------
  async function onEntry(e) {
    e.preventDefault();
    const err = $('entry-error');
    const name = cleanText($('entry-name').value, 20);
    const pin = $('entry-pin').value.trim();
    err.hidden = true;
    let msg = '';
    if (name.length < 2) msg = '이름을 입력해 주세요.';
    else if (!/^\d{4}$/.test(pin)) msg = '휴대폰 번호 뒤 4자리를 숫자로 입력해 주세요.';
    else if (!$('entry-consent').checked) msg = '프로필 공개에 동의해야 참여할 수 있어요.';
    if (msg) { err.textContent = msg; err.hidden = false; return; }

    const btn = $('entry-submit');
    btn.disabled = true;
    btn.textContent = '확인하는 중';
    try {
      const hash = await keyHash(name, pin);
      const pid = await S.store.findKey(hash);
      if (pid) await S.store.claim(hash, pid);
      if (pid && (!S.profilesLoaded || S.profiles.has(pid))) {
        await enterAs(pid);
        toast(name + '님, 다시 오셨네요. 저장된 프로필을 불러왔어요.');
      } else {
        // 처음 왔거나, 운영진이 프로필을 지운 경우(키는 남아 있음) 새로 입력
        S.pending = { name, hash, pid: pid || null };
      }
      route();
    } catch (ex) {
      console.error(ex);
      err.textContent = '확인하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';
      err.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = '시작하기';
    }
  }

  async function enterAs(pid) {
    S.unsub.forEach((u) => u());
    S.unsub = [];
    S.pid = pid;
    S.me = S.profiles.get(pid) || null;
    S.swipes = { likes: [], passes: [] };
    S.inbox = [];
    S.deckOrder = [];
    store.set(LS_PID, pid);
    S.unsub.push(S.store.watchSwipes(pid, (sw) => {
      S.swipes = { likes: (sw.likes || []).slice(), passes: (sw.passes || []).slice() };
      onData();
    }));
    S.unsub.push(S.store.watchInbox(pid, (list) => { S.inbox = list; onData(); }));
  }

  // ---------- 2. 프로필 입력 ----------
  const F = { field: '', keywords: [], looking: [], logo: null, extraKeywords: [] };

  function choiceChips(container, options, selected, { single = false, max = 99, label } = {}) {
    container.replaceChildren(...options.map((opt) => {
      const on = selected.includes(opt);
      return h('button', {
        type: 'button', class: 'chip',
        role: single ? 'radio' : null,
        'aria-checked': single ? String(on) : null,
        'aria-pressed': single ? null : String(on),
        onclick: () => {
          if (single) { selected.length = 0; selected.push(opt); }
          else if (selected.includes(opt)) selected.splice(selected.indexOf(opt), 1);
          else if (selected.length >= max) { toast(label + '은(는) 최대 ' + max + '개까지 고를 수 있어요.'); return; }
          else selected.push(opt);
          choiceChips(container, options, selected, { single, max, label });
        },
      }, opt);
    }));
  }

  function renderLogoPreview() {
    const box = $('logo-preview');
    const company = $('f-company').value.trim();
    const fresh = F.logo || company ? logoEl({ logo: F.logo, company }, 'lg') : h('div', { class: 'logo lg empty' }, h('span', null, '로고'));
    fresh.id = 'logo-preview';
    box.replaceWith(fresh);
    $('logo-clear').hidden = !F.logo;
  }

  function careerRow(c, ex) {
    const row = h('div', { class: 'career-row' },
      h('input', { type: 'text', class: 'period', maxlength: 20, 'aria-label': '기간', placeholder: '예) ' + ex.period, value: c.period || '' }),
      h('button', { type: 'button', class: 'btn small ghost remove', onclick: () => { row.remove(); syncCareerAdd(); } }, '삭제'),
      h('input', { type: 'text', class: 'org', maxlength: 30, 'aria-label': '소속', placeholder: '예) ' + ex.org, value: c.org || '' }),
      h('input', { type: 'text', class: 'role', maxlength: 30, 'aria-label': '역할', placeholder: '예) ' + ex.role, value: c.role || '' }));
    return row;
  }
  function syncCareerAdd() {
    $('career-add').hidden = $('f-careers').children.length >= MAX_CAREERS;
  }

  function fillForm() {
    const ex = ND.EXAMPLE_PROFILE || {};
    const exCareer = (ex.careers && ex.careers[0]) || { period: '2018–2021', org: '한빛대 지능로봇연구실', role: '연구원' };
    const p = S.pending ? null : S.me;
    const editing = !!p;
    $('profile-heading').textContent = editing ? '내 프로필 수정' : '내 프로필 만들기';
    $('profile-submit').textContent = editing ? '저장하기' : '저장하고 계속';
    $('profile-cancel').hidden = !editing;
    $('profile-error').hidden = true;

    $('f-name').value = editing ? p.name : S.pending.name;
    $('f-company').value = editing ? p.company : '';
    $('f-company').placeholder = '예) ' + (ex.company || '');
    $('f-intro').value = editing ? (p.companyIntro || '') : '';
    $('f-intro').placeholder = '예) ' + (ex.companyIntro || '');
    $('f-title').value = editing ? p.title : '';
    $('f-title').placeholder = '예) ' + (ex.title || '');
    $('f-topic').value = editing ? p.topic : '';
    $('f-topic').placeholder = '예) ' + (ex.topic || '');
    updateTopicCount();

    F.field = editing ? p.field : '';
    F.logo = editing ? (p.logo || null) : null;
    F.keywords = editing ? (p.keywords || []).slice() : [];
    F.looking = editing ? (p.lookingFor || []).slice() : [];
    F.extraKeywords = F.keywords.filter((k) => !KEYWORDS.includes(k));

    const fieldSel = F.field ? [F.field] : [];
    F.fieldSel = fieldSel;
    choiceChips($('f-field'), FIELDS, fieldSel, { single: true });
    $('f-years').replaceChildren(h('option', { value: '' }, '선택해 주세요'),
      ...YEARS.map((y) => h('option', { value: y, selected: editing && p.years === y ? true : null }, y)));
    renderKeywordChips();
    choiceChips($('f-looking'), LOOKING, F.looking, { max: MAX_LOOKING, label: '찾고 있어요' });

    const exps = editing ? (p.experiences || []) : [];
    const exExps = ex.experiences || [];
    $('f-exps').replaceChildren(...[0, 1, 2].map((i) => h('input', {
      type: 'text', maxlength: 60, 'aria-label': '대표 경험 ' + (i + 1),
      placeholder: i < exExps.length ? '예) ' + exExps[i] : '(선택) 경험 하나 더',
      value: exps[i] || '',
    })));

    const careers = editing ? (p.careers || []) : [];
    $('f-careers').replaceChildren(...(careers.length ? careers : [{}]).slice(0, MAX_CAREERS).map((c) => careerRow(c, exCareer)));
    syncCareerAdd();
    renderLogoPreview();
  }

  function renderKeywordChips() {
    choiceChips($('f-keywords'), KEYWORDS.concat(F.extraKeywords), F.keywords, { max: MAX_KEYWORDS, label: '관심 키워드' });
  }
  function addCustomKeyword() {
    const input = $('kw-custom');
    const v = cleanText(input.value, 15);
    if (!v) return;
    if (!KEYWORDS.includes(v) && !F.extraKeywords.includes(v)) F.extraKeywords.push(v);
    if (!F.keywords.includes(v)) {
      if (F.keywords.length >= MAX_KEYWORDS) { toast('관심 키워드는 최대 ' + MAX_KEYWORDS + '개까지 고를 수 있어요.'); return; }
      F.keywords.push(v);
    }
    input.value = '';
    renderKeywordChips();
  }
  function updateTopicCount() {
    $('topic-count').textContent = $('f-topic').value.length + ' / 60';
  }

  function processLogo(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('type')); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      // 160px 정사각형 흰 바탕에 맞춰 넣고 webp(안 되면 jpeg)로 줄입니다. 한 장에 수십 KB 수준.
      img.onload = () => {
        try {
          const size = 160;
          const pad = 12;
          const c = document.createElement('canvas');
          c.width = size; c.height = size;
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, size, size);
          const iw = img.naturalWidth || size;
          const ih = img.naturalHeight || size;
          const r = Math.min((size - pad * 2) / iw, (size - pad * 2) / ih);
          ctx.drawImage(img, (size - iw * r) / 2, (size - ih * r) / 2, iw * r, ih * r);
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

  function collectForm() {
    const data = {
      company: cleanText($('f-company').value, 30),
      companyIntro: cleanText($('f-intro').value, 40),
      logo: F.logo || null,
      title: cleanText($('f-title').value, 30),
      field: F.fieldSel[0] || '',
      years: $('f-years').value,
      experiences: [...$('f-exps').querySelectorAll('input')].map((i) => cleanText(i.value, 60)).filter(Boolean),
      careers: [...$('f-careers').children].map((row) => ({
        period: cleanText(row.querySelector('.period').value, 20),
        org: cleanText(row.querySelector('.org').value, 30),
        role: cleanText(row.querySelector('.role').value, 30),
      })).filter((c) => c.org || c.role),
      keywords: F.keywords.slice(0, MAX_KEYWORDS),
      lookingFor: F.looking.slice(0, MAX_LOOKING),
      topic: cleanText($('f-topic').value, 60),
    };
    const missing = [];
    if (!data.company) missing.push(['회사·기관명', 'f-company']);
    if (!data.title) missing.push(['직함·직무', 'f-title']);
    if (!data.field) missing.push(['직무 분야', null]);
    if (!data.years) missing.push(['경력 연차', 'f-years']);
    if (!data.experiences.length) missing.push(['대표 경험', null]);
    if (!data.topic) missing.push(['이런 이야기를 나누고 싶어요', 'f-topic']);
    return { data, missing };
  }

  async function onProfileSubmit(e) {
    e.preventDefault();
    const { data, missing } = collectForm();
    const err = $('profile-error');
    if (missing.length) {
      err.textContent = '아직 비어 있어요: ' + missing.map((m) => m[0]).join(', ');
      err.hidden = false;
      const first = missing[0][1] ? $(missing[0][1]) : (missing[0][0] === '대표 경험' ? $('f-exps').querySelector('input') : $('f-field').querySelector('button'));
      if (first) first.focus();
      return;
    }
    err.hidden = true;
    const btn = $('profile-submit');
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = '저장하는 중';
    try {
      if (S.pending) {
        const name = S.pending.name;
        S.creating = true;
        const pid = await S.store.createProfile(S.pending.hash, Object.assign({ name }, data), S.pending.pid);
        S.pending = null;
        await enterAs(pid);
        S.me = S.profiles.get(pid) || Object.assign({ id: pid, name, hidden: false, done: false }, data);
        S.creating = false;
        toast('프로필을 저장했어요.');
      } else {
        await S.store.updateProfile(S.pid, data);
        S.me = Object.assign({}, S.me, data);
        S.editing = false;
        toast('수정한 내용을 저장했어요.');
      }
      route();
    } catch (ex) {
      console.error(ex);
      S.creating = false;
      err.textContent = '저장하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';
      err.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  // ---------- 3. 대기 ----------
  function renderWait() {
    $('wait-count').textContent = String(visibleProfiles().length);
    $('wait-cap').textContent = '명 등록 · 최대 ' + CAP + '명';
    const key = JSON.stringify(S.me) + (S.me && S.me.keywords);
    if ($('wait-card').dataset.key !== key) {
      $('wait-card').dataset.key = key;
      $('wait-card').replaceChildren(cardEl(S.me));
    }
  }

  // ---------- 4. 스와이프 ----------
  function candidates() {
    const seen = new Set(S.swipes.likes.concat(S.swipes.passes));
    return visibleProfiles().filter((p) => p.id !== S.pid && !seen.has(p.id));
  }
  function syncDeck() {
    const ids = new Set(candidates().map((p) => p.id));
    S.deckOrder = S.deckOrder.filter((id) => ids.has(id));
    const known = new Set(S.deckOrder);
    const fresh = [...ids].filter((id) => !known.has(id)).sort((a, b) => hash32(S.pid + a) - hash32(S.pid + b));
    S.deckOrder.push(...fresh);
  }

  function renderSwipe() {
    syncDeck();
    const likes = S.swipes.likes;
    $('picks-count').textContent = String(likes.length);
    $('picks-max').textContent = String(MAX);
    $('deck-left').textContent = String(S.deckOrder.length);
    const slots = [];
    for (let i = 0; i < MAX; i++) {
      const p = S.profiles.get(likes[i]);
      slots.push(p
        ? h('button', { type: 'button', class: 'slot filled', 'aria-label': p.name + ' 프로필 보기', onclick: () => openSheet(p) }, logoEl(p, 'xs'))
        : h('span', { class: 'slot', 'aria-hidden': 'true' }));
    }
    $('picks').replaceChildren(...slots);
    $('btn-undo').disabled = !S.last;
    const empty = S.deckOrder.length === 0;
    $('btn-like').disabled = empty;
    $('btn-pass').disabled = empty;

    const top = S.deckOrder[0] || null;
    const second = S.deckOrder[1] || null;
    const key = top + '|' + second;
    if (acting || S.renderedTop === key) return;
    S.renderedTop = key;
    const deck = $('deck');
    if (!top) {
      deck.replaceChildren(h('div', { class: 'deck-empty' },
        h('b', null, '아직 넘겨볼 카드가 없어요'),
        h('span', null, '다른 참가자가 프로필을 등록하면 여기에 바로 나타나요.')));
      return;
    }
    const kids = [];
    if (second && S.profiles.get(second)) {
      const back = cardEl(S.profiles.get(second));
      back.classList.add('back');
      back.setAttribute('aria-hidden', 'true');
      kids.push(back);
    }
    const front = cardEl(S.profiles.get(top));
    front.classList.add('top');
    front.prepend(h('span', { class: 'stamp like', 'aria-hidden': 'true' }, '대화하고 싶어요'),
      h('span', { class: 'stamp pass', 'aria-hidden': 'true' }, '넘기기'));
    bindDrag(front);
    kids.push(front);
    deck.replaceChildren(...kids);
  }

  function bindDrag(card) {
    let sx = 0, sy = 0, dx = 0, pointer = null, decided = false, dragging = false;
    const like = card.querySelector('.stamp.like');
    const pass = card.querySelector('.stamp.pass');
    const reset = () => {
      card.classList.remove('dragging');
      card.style.transform = '';
      like.style.opacity = 0;
      pass.style.opacity = 0;
    };
    card.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || card.dataset.leaving) return;
      sx = e.clientX; sy = e.clientY; dx = 0; pointer = e.pointerId; decided = false; dragging = false;
    });
    card.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pointer) return;
      const mx = e.clientX - sx;
      const my = e.clientY - sy;
      if (!decided) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        decided = true;
        dragging = Math.abs(mx) > Math.abs(my);
        if (dragging) { card.setPointerCapture(pointer); card.classList.add('dragging'); }
      }
      if (!dragging) return;
      dx = mx;
      card.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx / 22) + 'deg)';
      like.style.opacity = Math.max(0, Math.min(1, dx / 90));
      pass.style.opacity = Math.max(0, Math.min(1, -dx / 90));
    });
    const end = (e) => {
      if (e.pointerId !== pointer) return;
      pointer = null;
      if (!dragging) return;
      dragging = false;
      if (dx > 90) act('like');
      else if (dx < -90) act('pass');
      else reset();
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', (e) => { if (e.pointerId === pointer) { pointer = null; dragging = false; reset(); } });
  }

  function flyOut(kind) {
    const card = $('deck').querySelector('.pcard.top');
    if (!card) return Promise.resolve();
    card.dataset.leaving = '1';
    card.classList.remove('dragging');
    const stamp = card.querySelector(kind === 'like' ? '.stamp.like' : '.stamp.pass');
    if (stamp) stamp.style.opacity = 1;
    const dir = kind === 'like' ? 1 : -1;
    card.style.transform = 'translateX(' + dir * 130 + '%) rotate(' + dir * 14 + 'deg)';
    card.style.opacity = '0';
    return new Promise((r) => setTimeout(r, 230));
  }

  let acting = false;
  async function act(kind) {
    if (acting || S.view !== 'swipe') return;
    const id = S.deckOrder[0];
    if (!id) return;
    if (kind === 'like' && S.swipes.likes.length >= MAX) return;
    acting = true;
    const likes = S.swipes.likes.slice();
    const passes = S.swipes.passes.slice();
    if (kind === 'like') likes.push(id); else passes.push(id);
    S.swipes = { likes, passes };
    S.deckOrder.shift();
    S.last = { id, kind };
    const finished = likes.length >= MAX || S.deckOrder.length === 0;
    const wasDone = !!(S.me && S.me.done);
    enqueue(() => S.store.saveSwipe(S.pid, { likes, passes }, kind === 'like' ? { add: id } : null, finished && !wasDone ? true : null));
    await flyOut(kind);
    acting = false;
    if (finished) {
      S.last = null;
      S.continuing = false;
      if (S.me) S.me = Object.assign({}, S.me, { done: true });
      if (likes.length >= MAX) toast(MAX + '명을 모두 골랐어요. 나를 고른 사람을 확인해 보세요.');
      route();
    } else {
      S.renderedTop = null;
      render();
    }
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

  // ---------- 5. 결과 ----------
  function personEl(p, { mutual }) {
    return h('li', null, h('button', { type: 'button', class: 'person', onclick: () => openSheet(p, mutual) },
      logoEl(p, 'sm'),
      h('span', { class: 'person-main' },
        h('span', { class: 'person-name' }, p.name, mutual ? h('span', { class: 'badge' }, '서로 선택') : null),
        h('span', { class: 'person-sub', text: p.company + ' · ' + p.title }),
        h('span', { class: 'person-topic', text: '“' + p.topic + '”' }))));
  }

  function renderResult() {
    const mine = S.swipes.likes.map((id) => S.profiles.get(id)).filter((p) => p && !p.hidden);
    const mineIds = new Set(mine.map((p) => p.id));
    const inbox = S.inbox
      .map((x) => ({ p: S.profiles.get(x.id), at: x.at }))
      .filter((x) => x.p && !x.p.hidden && x.p.id !== S.pid)
      .sort((a, b) => (mineIds.has(b.p.id) - mineIds.has(a.p.id)) || (b.at - a.at));
    const inboxIds = new Set(inbox.map((x) => x.p.id));

    $('inbox-count').textContent = String(inbox.length);
    $('inbox-list').replaceChildren(...inbox.map((x) => personEl(x.p, { mutual: mineIds.has(x.p.id) })));
    $('inbox-empty').hidden = inbox.length > 0;
    $('mine-count').textContent = String(mine.length);
    $('mine-list').replaceChildren(...mine.map((p) => personEl(p, { mutual: inboxIds.has(p.id) })));
    $('mine-empty').hidden = mine.length > 0;

    const mutual = inbox.filter((x) => mineIds.has(x.p.id)).length;
    if (S.phase === 'ended') {
      $('result-eyebrow').textContent = '네트워킹 진행 중';
    } else {
      $('result-eyebrow').textContent = mine.length >= MAX ? MAX + '명 고르기 완료' : '카드를 모두 넘겼어요';
    }
    $('result-title').textContent = mutual
      ? '서로 대화하고 싶어한 사람이 ' + mutual + '명 있어요'
      : '이제 찾아가서 인사해 보세요';

    syncDeck();
    const more = S.phase === 'swipe' && S.swipes.likes.length < MAX ? S.deckOrder.length : 0;
    $('more-box').hidden = more === 0;
    $('more-n').textContent = String(more);
  }

  // ---------- 프로필 시트 ----------
  function openSheet(p, mutual) {
    $('sheet-body').replaceChildren(cardEl(p));
    $('sheet-badge').replaceChildren(mutual ? h('span', { class: 'badge' }, '서로 선택') : '');
    $('sheet').hidden = false;
    $('sheet').querySelector('.sheet-panel').scrollTop = 0;
    $('sheet').querySelector('.sheet-top [data-close]').focus({ preventScroll: true });
  }
  function closeSheet() { $('sheet').hidden = true; }

  // ---------- 운영자 ----------
  let pendingPhase = null;
  async function enterAdmin() {
    S.admin = await S.store.isAdmin();
    render();
  }
  function entryUrl() {
    return location.href.split('#')[0];
  }
  function drawQr(el, size) {
    if (!window.QRCode) { setTimeout(() => drawQr(el, size), 300); return; }
    if (el.dataset.url === entryUrl()) return;
    el.dataset.url = entryUrl();
    el.replaceChildren();
    // eslint-disable-next-line no-new
    new window.QRCode(el, { text: entryUrl(), width: size, height: size, colorDark: '#15181c', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
  }
  const PHASE_TEXT = {
    registration: '프로필 등록 단계로 바꿀까요? 참가자 화면이 대기 화면으로 바뀝니다.',
    swipe: '스와이프를 시작할까요? 등록한 참가자 화면이 바로 카드 화면으로 바뀝니다.',
    ended: '종료할까요? 참가자는 더 고를 수 없고 결과 화면만 보게 됩니다.',
  };

  function renderAdmin() {
    $('admin-login').hidden = S.admin;
    $('admin-panel').hidden = !S.admin;
    if (!S.admin) return;
    $('phase-seg').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.phase === S.phase)));
    $('phase-confirm').hidden = !pendingPhase;
    if (pendingPhase) $('phase-confirm-text').textContent = PHASE_TEXT[pendingPhase];

    const all = [...S.profiles.values()].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const visible = all.filter((p) => !p.hidden);
    $('st-reg').replaceChildren(String(visible.length), h('small', null, ' / ' + CAP));
    $('st-done').textContent = String(visible.filter((p) => p.done).length);
    $('st-hidden').textContent = String(all.length - visible.length);
    $('admin-rows').replaceChildren(...all.map((p) => h('tr', { class: p.hidden ? 'is-hidden' : null },
      h('td', { text: p.name }),
      h('td', { class: 'wrap', text: p.company }),
      h('td', { class: 'wrap', text: p.title }),
      h('td', null, h('span', { class: 'state' + (p.done ? ' done' : ''), text: p.done ? '완료' : '진행 전' })),
      h('td', null, h('button', {
        type: 'button', class: 'btn small ghost' + (p.hidden ? '' : ' danger'),
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
  function signOut() {
    S.unsub.forEach((u) => u());
    S.unsub = [];
    S.pid = null;
    S.me = null;
    S.editing = false;
    store.del(LS_PID);
  }

  // ---------- 연결 ----------
  function wire() {
    $('entry-form').addEventListener('submit', onEntry);
    $('entry-pin').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });
    $('profile-form').addEventListener('submit', onProfileSubmit);
    $('profile-cancel').addEventListener('click', () => { S.editing = false; route(); });
    $('f-topic').addEventListener('input', updateTopicCount);
    $('f-company').addEventListener('input', () => { if (!F.logo) renderLogoPreview(); });
    $('kw-add').addEventListener('click', addCustomKeyword);
    $('kw-custom').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomKeyword(); } });
    $('career-add').addEventListener('click', () => {
      const ex = (ND.EXAMPLE_PROFILE && ND.EXAMPLE_PROFILE.careers[0]) || { period: '', org: '', role: '' };
      if ($('f-careers').children.length < MAX_CAREERS) $('f-careers').append(careerRow({}, ex));
      syncCareerAdd();
    });
    $('logo-file').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try { F.logo = await processLogo(file); renderLogoPreview(); }
      catch (ex) { toast('이미지를 읽지 못했어요. PNG나 JPG 파일로 다시 올려 주세요.'); }
    });
    $('logo-clear').addEventListener('click', () => { F.logo = null; renderLogoPreview(); });

    const edit = () => { S.editing = true; route(); };
    $('bar-profile').addEventListener('click', edit);
    $('wait-edit').addEventListener('click', edit);
    $('result-edit').addEventListener('click', edit);
    $('brand').addEventListener('click', (e) => { if (location.hash !== '#admin') e.preventDefault(); });

    $('btn-like').addEventListener('click', () => act('like'));
    $('btn-pass').addEventListener('click', () => act('pass'));
    $('btn-undo').addEventListener('click', undo);
    $('more-btn').addEventListener('click', () => { S.continuing = true; route(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeSheet(); $('qr-full').hidden = true; }
      if (S.view !== 'swipe' || !$('sheet').hidden) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) return;
      if (e.key === 'ArrowRight') act('like');
      if (e.key === 'ArrowLeft') act('pass');
    });
    $('sheet').addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeSheet(); });

    $('admin-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pin = $('admin-pin').value.trim();
      if (!pin) return;
      const ok = await S.store.becomeAdmin(pin);
      $('admin-error').textContent = 'PIN이 맞지 않아요.';
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
    $('qr-big').addEventListener('click', () => {
      $('qr-large-url').textContent = entryUrl();
      $('qr-full').hidden = false;
      drawQr($('qr-large'), 520);
    });
    $('qr-close').addEventListener('click', () => { $('qr-full').hidden = true; });
    $('copy-url').addEventListener('click', () => {
      const url = entryUrl();
      const fallback = () => {
        const range = document.createRange();
        range.selectNodeContents($('qr-url'));
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        toast('링크를 선택했어요. 길게 눌러 복사하세요.');
      };
      try {
        navigator.clipboard.writeText(url).then(() => toast('링크를 복사했어요.'), fallback);
      } catch (ex) { fallback(); }
    });

    $('demo-phase').addEventListener('click', () => {
      const order = ['registration', 'swipe', 'ended'];
      S.store.setPhase(order[(order.indexOf(S.phase) + 1) % order.length]);
    });
    $('demo-reset').addEventListener('click', () => {
      S.store.reset();
      store.del(LS_PID);
      location.hash = '';
      location.reload();
    });
    window.addEventListener('hashchange', route);
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
        $('demo-banner').hidden = false;
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
      S.phase = ['registration', 'swipe', 'ended'].includes(s.phase) ? s.phase : 'registration';
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
  }

  boot();
})();
