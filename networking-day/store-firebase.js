// 실제 행사용 저장소: Firebase 익명 로그인 + Firestore.
// 데이터 구조와 접근 권한은 firestore.rules에 정의되어 있습니다.
//   keys/{해시}                 이름+뒤 4자리 해시 → 프로필 id (해시를 아는 사람만 조회 가능)
//   owners/{pid}/uids/{uid}     이 기기가 프로필 주인임을 증명
//   profiles/{pid}              공개 프로필
//   swipes/{pid}                내가 고른 사람·넘긴 사람 (본인만 읽음)
//   inbox/{pid}/likes/{보낸 pid} 나를 고른 사람 (받은 사람과 보낸 사람만 읽음)
//   settings/event              진행 단계 (운영자만 바꿈)
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
    const db = fsM.getFirestore(app);
    if (C.emulator) {
      authM.connectAuthEmulator(auth, 'http://' + C.emulator.host + ':' + C.emulator.auth, { disableWarnings: true });
      fsM.connectFirestoreEmulator(db, C.emulator.host, C.emulator.firestore);
    }

    await new Promise((resolve) => { const off = authM.onAuthStateChanged(auth, () => { off(); resolve(); }); });
    if (!auth.currentUser) await authM.signInAnonymously(auth);
    const uid = auth.currentUser.uid;

    const { doc, getDoc, setDoc, updateDoc, collection, onSnapshot, writeBatch, serverTimestamp } = fsM;
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
      async createProfile(hash, data, existingPid) {
        const pid = existingPid || doc(collection(db, 'profiles')).id;
        const b = writeBatch(db);
        if (!existingPid) {
          b.set(doc(db, 'keys', hash), { pid });
          b.set(doc(db, 'owners', pid, 'uids', uid), { k: hash });
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
        return onSnapshot(doc(db, 'settings', 'event'),
          (s) => cb(s.exists() ? s.data() : { phase: 'registration' }), report('settings'));
      },
      watchProfiles(cb) {
        return onSnapshot(collection(db, 'profiles'), (qs) => cb(qs.docs.map((d) => {
          const v = d.data();
          return Object.assign({}, v, { id: d.id, createdAt: ms(v.createdAt) });
        })), report('profiles'));
      },
      watchSwipes(pid, cb) {
        return onSnapshot(doc(db, 'swipes', pid),
          (s) => cb(s.exists() ? s.data() : { likes: [], passes: [] }), report('swipes'));
      },
      watchInbox(pid, cb) {
        return onSnapshot(collection(db, 'inbox', pid, 'likes'),
          (qs) => cb(qs.docs.map((d) => ({ id: d.id, at: ms(d.data().at) || Date.now() }))), report('inbox'));
      },
      // change: {add: 고른 사람 pid} | {remove: 되돌린 사람 pid} | null, done: true/false/null(그대로)
      async saveSwipe(pid, swipes, change, done) {
        const b = writeBatch(db);
        b.set(doc(db, 'swipes', pid), { likes: swipes.likes, passes: swipes.passes, updatedAt: serverTimestamp() });
        if (change && change.add) b.set(doc(db, 'inbox', change.add, 'likes', pid), { at: serverTimestamp() });
        if (change && change.remove) b.delete(doc(db, 'inbox', change.remove, 'likes', pid));
        if (typeof done === 'boolean') b.update(doc(db, 'profiles', pid), { done });
        await b.commit();
      },
      async isAdmin() {
        try { return (await getDoc(doc(db, 'admins', uid))).exists(); } catch (e) { return false; }
      },
      async becomeAdmin(pin) {
        try { await setDoc(doc(db, 'admins', uid), { pin }); return true; } catch (e) { return false; }
      },
      async setPhase(phase) {
        await setDoc(doc(db, 'settings', 'event'), { phase, updatedAt: serverTimestamp() });
      },
      async setHidden(pid, hidden) {
        await updateDoc(doc(db, 'profiles', pid), { hidden });
      },
    };
  };
})();
