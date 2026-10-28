// 실제 행사용 저장소: Firebase 익명 로그인 + Firestore.
// 데이터 구조와 접근 권한은 firestore.rules에 정의되어 있습니다.
//   keys/{해시}                 이름+뒤 4자리 해시 → 프로필 id (해시를 아는 사람만 조회 가능)
//   owners/{pid}/uids/{uid}     이 기기가 프로필 주인임을 증명
//   profiles/{pid}              공개 프로필
//   swipes/{pid}                내가 고른 사람·넘긴 사람 (본인만 읽음)
//   private/{pid}               내 링크드인 주소 (본인만 읽음)
//   inbox/{pid}/likes/{보낸 pid} 나를 고른 사람 + 보낸 사람의 링크드인 (받은 사람과 보낸 사람만 읽음)
//   progress/{pid}              고른 수·본 카드 수·남은 카드 수 (운영자 화면 진행 현황용, 누구를 골랐는지는 없음)
//   settings/event              진행 단계와 전체 알림 (운영자만 바꿈)
//   admins/{uid}                운영자 기기
(function () {
  const ND = (window.ND = window.ND || {});

  ND.createFirebaseStore = async function (C) {
    const sdk = C.firebaseSdkBase || 'https://www.gstatic.com/firebasejs/10.12.2/';
    const [appM, authM, fsM] = await Promise.all([
      import(sdk + 'firebase-app.js'),
      import(sdk + 'firebase-auth.js'),
      import(sdk + 'firebase-firestore.js'),
    ]);
    const app = appM.initializeApp(C.firebase);
    const auth = authM.getAuth(app);
    // 쓰기·읽기를 이 기기(IndexedDB)에도 보관합니다. 인터넷이 끊긴 채 고르고 새로고침해도
    // 고른 기록이 남아 있다가 연결되면 서버로 보내집니다. 보관할 수 없는 브라우저는 자동으로 메모리만 씁니다.
    let db;
    try {
      db = fsM.initializeFirestore(app, { localCache: fsM.persistentLocalCache({ tabManager: fsM.persistentMultipleTabManager() }) });
    } catch (e) {
      console.warn('local cache off', e);
      db = fsM.getFirestore(app);
    }
    if (C.emulator) {
      authM.connectAuthEmulator(auth, 'http://' + C.emulator.host + ':' + C.emulator.auth, { disableWarnings: true });
      fsM.connectFirestoreEmulator(db, C.emulator.host, C.emulator.firestore);
    }

    await new Promise((resolve) => { const off = authM.onAuthStateChanged(auth, () => { off(); resolve(); }); });
    if (!auth.currentUser) await authM.signInAnonymously(auth);
    let uid = auth.currentUser.uid;

    const { doc, getDoc, setDoc, updateDoc, collection, onSnapshot, writeBatch, serverTimestamp } = fsM;
    // 쓰기 묶음은 한 번에 500건까지라 나눠서 보냅니다.
    async function commitInChunks(ops) {
      for (let i = 0; i < ops.length; i += 400) {
        const b = writeBatch(db);
        ops.slice(i, i + 400).forEach((op) => op(b));
        await b.commit();
      }
    }
    const ms = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : 0);
    const report = (label) => (err) => { console.error(label, err); if (ND.onStoreError) ND.onStoreError(err); };

    async function isOwner(pid) {
      try { return (await getDoc(doc(db, 'owners', pid, 'uids', uid))).exists(); } catch (e) { return false; }
    }

    return {
      mode: 'live',
      isOwner,
      async findKey(hash) {
        const snap = await getDoc(doc(db, 'keys', hash));
        return snap.exists() ? snap.data().pid : null;
      },
      async claim(hash, pid) {
        if (await isOwner(pid)) return;
        await setDoc(doc(db, 'owners', pid, 'uids', uid), { k: hash });
      },
      // existingPid: 키는 남아 있는데 프로필이 지워진 경우, 이미 claim한 같은 id로 다시 만듭니다.
      // 이때 예전에 고른 기록이 남아 있으면 비우고, 예전에 보낸 LIKE도 지웁니다.
      async createProfile(hash, data, existingPid) {
        const pid = existingPid || doc(collection(db, 'profiles')).id;
        const b = writeBatch(db);
        if (!existingPid) {
          b.set(doc(db, 'keys', hash), { pid });
          b.set(doc(db, 'owners', pid, 'uids', uid), { k: hash });
        } else {
          const old = await getDoc(doc(db, 'swipes', pid));
          if (old.exists()) {
            (old.data().likes || []).forEach((to) => b.delete(doc(db, 'inbox', to, 'likes', pid)));
            b.set(doc(db, 'swipes', pid), { likes: [], passes: [], updatedAt: serverTimestamp() });
          }
          b.set(doc(db, 'progress', pid), { likes: 0, seen: 0, updatedAt: serverTimestamp() });
        }
        b.set(doc(db, 'profiles', pid), Object.assign({}, data, {
          hidden: false, done: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        }));
        await b.commit();
        return pid;
      },
      async updateProfile(pid, data) {
        await updateDoc(doc(db, 'profiles', pid), Object.assign({}, data, { updatedAt: serverTimestamp() }));
      },
      watchSettings(cb) {
        return onSnapshot(doc(db, 'settings', 'event'), (s) => {
          const v = s.exists() ? s.data() : { phase: 'registration' };
          cb(Object.assign({}, v, { noticeAt: ms(v.noticeAt) }));
        }, report('settings'));
      },
      // meta.fromCache: 서버가 아니라 이 기기 보관본에서 온 목록 (지워진 사람 판단에 쓰지 않음)
      watchProfiles(cb) {
        return onSnapshot(collection(db, 'profiles'), (qs) => cb(qs.docs.map((d) => {
          const v = d.data();
          return Object.assign({}, v, { id: d.id, createdAt: ms(v.createdAt), updatedAt: ms(v.updatedAt) });
        }), { fromCache: qs.metadata.fromCache }), report('profiles'));
      },
      // 운영자 화면 진행 현황 (운영자만 읽을 수 있음)
      watchProgress(cb) {
        return onSnapshot(collection(db, 'progress'), (qs) => cb(qs.docs.map((d) => Object.assign({}, d.data(), { id: d.id }))), report('progress'));
      },
      watchSwipes(pid, cb) {
        return onSnapshot(doc(db, 'swipes', pid),
          (s) => cb(s.exists() ? s.data() : { likes: [], passes: [] }), report('swipes'));
      },
      watchInbox(pid, cb) {
        return onSnapshot(collection(db, 'inbox', pid, 'likes'),
          (qs) => cb(qs.docs.map((d) => ({ id: d.id, at: ms(d.data().at) || Date.now(), ln: d.data().ln || '' }))), report('inbox'));
      },
      watchPrivate(pid, cb) {
        return onSnapshot(doc(db, 'private', pid), (s) => cb(s.exists() ? s.data() : { linkedin: '', met: [] }), report('private'));
      },
      // 내 링크드인·'대화했어요' 목록을 저장합니다. 링크드인이 바뀌면 이미 고른 사람에게 보낸 LIKE에도 반영합니다.
      async savePrivate(pid, fields, likes) {
        const b = writeBatch(db);
        b.set(doc(db, 'private', pid), Object.assign({}, fields, { updatedAt: serverTimestamp() }), { merge: true });
        if ('linkedin' in fields) {
          (likes || []).forEach((to) => b.set(doc(db, 'inbox', to, 'likes', pid), { ln: fields.linkedin }, { merge: true }));
        }
        await b.commit();
      },
      // change: {add: 고른 사람 pid, ln: 내 링크드인} | {remove: 되돌린 사람 pid 또는 그 목록} | null
      // done: true/false/null(그대로), progress: {left: 남은 카드 수}
      async saveSwipe(pid, swipes, change, done, progress) {
        const b = writeBatch(db);
        b.set(doc(db, 'swipes', pid), { likes: swipes.likes, passes: swipes.passes, updatedAt: serverTimestamp() });
        if (change && change.add) b.set(doc(db, 'inbox', change.add, 'likes', pid), { at: serverTimestamp(), ln: change.ln || '' });
        if (change && change.remove) [].concat(change.remove).forEach((to) => b.delete(doc(db, 'inbox', to, 'likes', pid)));
        if (typeof done === 'boolean') b.update(doc(db, 'profiles', pid), { done });
        const pr = { likes: swipes.likes.length, seen: Math.min(200, swipes.likes.length + swipes.passes.length), updatedAt: serverTimestamp() };
        if (progress && Number.isInteger(progress.left)) pr.left = Math.min(200, progress.left);
        b.set(doc(db, 'progress', pid), pr);
        await b.commit();
      },
      async isAdmin() {
        try { return (await getDoc(doc(db, 'admins', uid))).exists(); } catch (e) { return false; }
      },
      async becomeAdmin(pin) {
        try { await setDoc(doc(db, 'admins', uid), { pin }); return true; } catch (e) { return false; }
      },
      async setPhase(phase) {
        await setDoc(doc(db, 'settings', 'event'), { phase, updatedAt: serverTimestamp() }, { merge: true });
      },
      // 모든 참가자 화면 위에 잠깐 띄우는 알림. 빈 문구를 보내면 떠 있는 알림을 내립니다.
      async sendNotice(text, phase) {
        await setDoc(doc(db, 'settings', 'event'), { phase, notice: text, noticeAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
      },
      // 공용 기기에서 다음 사람이 쓰도록, 이 기기의 익명 계정을 새로 받습니다.
      async resetDevice() {
        await authM.signOut(auth);
        await authM.signInAnonymously(auth);
        uid = auth.currentUser.uid;
      },
      async setHidden(pid, hidden) {
        await updateDoc(doc(db, 'profiles', pid), { hidden });
      },
      // 리허설용 가상 참가자를 넣습니다 (test: true). 이미 있는 id는 덮어씁니다.
      async addTestProfiles(list) {
        await commitInChunks(list.map((p) => (b) => b.set(doc(db, 'profiles', p.id), Object.assign({}, p.data, {
          test: true, hidden: false, done: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        }))));
      },
      // 테스트 참가자만 지웁니다. 실제 참가자(realPids)가 테스트 참가자에게 보낸 LIKE도 지웁니다.
      // (실제 참가자 화면은 지워진 사람을 고른 목록에서 스스로 빼고 자리를 돌려받습니다.)
      async removeTestProfiles(testIds, realPids) {
        const ops = [];
        testIds.forEach((to) => realPids.forEach((from) => {
          if (to !== from) ops.push((b) => b.delete(doc(db, 'inbox', to, 'likes', from)));
        }));
        testIds.forEach((pid) => ops.push((b) => b.delete(doc(db, 'profiles', pid))));
        await commitInChunks(ops);
      },
      // 전체 초기화: 지금 있는 프로필과 그 사람들의 고른 기록·LIKE·링크드인을 지우고 등록 단계로 되돌립니다.
      // LIKE 목록은 운영자도 읽을 수 없으므로, 모든 (받은 사람, 보낸 사람) 조합을 지웁니다.
      async resetAll(pids) {
        const ops = [];
        pids.forEach((to) => pids.forEach((from) => {
          if (to !== from) ops.push((b) => b.delete(doc(db, 'inbox', to, 'likes', from)));
        }));
        pids.forEach((pid) => {
          ops.push((b) => b.delete(doc(db, 'swipes', pid)));
          ops.push((b) => b.delete(doc(db, 'private', pid)));
          ops.push((b) => b.delete(doc(db, 'progress', pid)));
          ops.push((b) => b.delete(doc(db, 'profiles', pid)));
        });
        await commitInChunks(ops);
        await setDoc(doc(db, 'settings', 'event'), { phase: 'registration', updatedAt: serverTimestamp() });
      },
    };
  };
})();
