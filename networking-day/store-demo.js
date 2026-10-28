// 시연 모드 저장소: 서버 없이 이 브라우저 안에서만 동작합니다.
// 실제 저장소(store-firebase.js)와 같은 함수를 제공합니다.
(function () {
  const ND = (window.ND = window.ND || {});

  ND.createDemoStore = function () {
    const KEY = 'nd-demo-v1';
    const fresh = () => ({ phase: 'registration', users: {}, keys: {}, owned: [], swipes: {}, inbox: {}, hidden: {}, admin: false });
    let st = fresh();
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (saved && typeof saved === 'object') st = Object.assign(fresh(), saved);
    } catch (e) { /* 저장소를 못 쓰면 메모리에서만 동작 */ }
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* 무시 */ } };

    const base = Date.parse('2026-11-16T11:10:00+09:00');
    const samples = ND.SAMPLE_PROFILES.map((p, i) => Object.assign({}, p, { done: i % 3 === 0, createdAt: base + i * 53000 }));

    const subs = { settings: new Set(), profiles: new Set(), swipes: new Map(), inbox: new Map() };
    const later = (fn) => setTimeout(fn, 0);
    const clone = (v) => JSON.parse(JSON.stringify(v));

    const allProfiles = () => samples.concat(Object.values(st.users))
      .map((p) => Object.assign({}, p, { hidden: !!st.hidden[p.id] }));
    const emitProfiles = () => { const list = allProfiles(); subs.profiles.forEach((cb) => later(() => cb(clone(list)))); };
    const emitSettings = () => subs.settings.forEach((cb) => later(() => cb({ phase: st.phase })));
    const emitKeyed = (map, pid, value) => (map.get(pid) || new Set()).forEach((cb) => later(() => cb(clone(value))));
    const watchKeyed = (map, pid, cb, value) => {
      if (!map.has(pid)) map.set(pid, new Set());
      map.get(pid).add(cb);
      later(() => cb(clone(value())));
      return () => map.get(pid).delete(cb);
    };

    // 예시 참가자 5명이 나를 골랐다고 가정 (무작위, 처음 만들 때 한 번 정해 저장)
    function seedInbox() {
      const now = Date.now();
      const ids = samples.map((p) => p.id);
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      return ids.slice(0, 5).map((id, k) => ({ id, at: now - k * 95000 }));
    }

    return {
      mode: 'demo',
      async isOwner(pid) { return st.owned.includes(pid); },
      async findKey(hash) { return st.keys[hash] || null; },
      async claim(hash, pid) {
        if (st.keys[hash] !== pid) throw new Error('key mismatch');
        if (!st.owned.includes(pid)) { st.owned.push(pid); save(); }
      },
      async createProfile(hash, data, existingPid) {
        const pid = existingPid || 'u' + Date.now().toString(36);
        st.users[pid] = Object.assign({}, data, { id: pid, done: false, createdAt: Date.now() });
        st.keys[hash] = pid;
        if (!st.owned.includes(pid)) st.owned.push(pid);
        st.inbox[pid] = seedInbox();
        save();
        emitProfiles();
        return pid;
      },
      async updateProfile(pid, data) {
        if (!st.users[pid]) throw new Error('not found');
        Object.assign(st.users[pid], data);
        save();
        emitProfiles();
      },
      watchSettings(cb) {
        subs.settings.add(cb);
        later(() => cb({ phase: st.phase }));
        return () => subs.settings.delete(cb);
      },
      watchProfiles(cb) {
        subs.profiles.add(cb);
        later(() => cb(clone(allProfiles())));
        return () => subs.profiles.delete(cb);
      },
      watchSwipes(pid, cb) {
        return watchKeyed(subs.swipes, pid, cb, () => st.swipes[pid] || { likes: [], passes: [] });
      },
      watchInbox(pid, cb) {
        return watchKeyed(subs.inbox, pid, cb, () => st.inbox[pid] || []);
      },
      async saveSwipe(pid, swipes, change, done) {
        st.swipes[pid] = { likes: swipes.likes.slice(), passes: swipes.passes.slice() };
        if (typeof done === 'boolean' && st.users[pid]) st.users[pid].done = done;
        save();
        emitKeyed(subs.swipes, pid, st.swipes[pid]);
        if (typeof done === 'boolean') emitProfiles();
      },
      async isAdmin() { return !!st.admin; },
      async becomeAdmin(pin) {
        if (pin !== '0000') return false;
        st.admin = true;
        save();
        return true;
      },
      async setPhase(phase) { st.phase = phase; save(); emitSettings(); },
      async setHidden(pid, hidden) {
        if (hidden) st.hidden[pid] = true; else delete st.hidden[pid];
        save();
        emitProfiles();
      },
      reset() { try { localStorage.removeItem(KEY); } catch (e) { /* 무시 */ } st = fresh(); },
    };
  };
})();
