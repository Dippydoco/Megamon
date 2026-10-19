/* ============ social.js — nickname, friends, online status, invitations and rooms ============
 * Only works with a cloud account (G.DB.online). Uses:
 *
 *   Firestore
 *     names/{lowercase nickname}   { uid }               unique nicknames
 *     profiles/{uid}               { name, lower, at }   public nickname
 *     friendships/{uidA_uidB}      { users, from, to, status: 'pending'|'ok', names, at }
 *
 *     pres/{uid}                   { on, at, room, play } online (approximate)
 *     inv/{to_from}                { to, from, room, name, at } invitations
 *
 *   Realtime Database: ONLY while you're in a room or group run
 *     rooms/{id}          { host, open, at, m: { uid: { name, dex, shiny } }, q: ... }
 *                         the room; q/ holds net.js's messages
 *
 * Why it's like this: Firebase's free plan only allows 100 simultaneous
 * connections to the Realtime Database. If everyone were connected for the
 * "online" status, that would be the maximum number of players. Now only those
 * in a room count; "online" goes through Firestore with a heartbeat every 10 min
 * and is only read when opening Friends or the room (what's read is valid for 1 min).
 *
 * The rest of the game listens for changes with G.Social.on(fn).
 */
G.Social = (() => {
  // Nicknames: letters, numbers, _ and emoji (3-16 characters, an emoji counts as one). The invisible emoji-style marker
  // (U+FE0F) is dropped so two names can't look the same while being different.
  const NICK_CH = '(?:[A-Za-z0-9_ñÑáéíóúÁÉÍÓÚ]|\\p{Extended_Pictographic}(?:[\\u{1F3FB}-\\u{1F3FF}])?(?:\\u200d\\p{Extended_Pictographic}(?:[\\u{1F3FB}-\\u{1F3FF}])?)*|[\\u{1F1E6}-\\u{1F1FF}]{2})';
  const NICK_RE = new RegExp('^' + NICK_CH + '+$', 'u');
  const cleanNick = s => String(s || '').replace(/[\ufe0e\ufe0f]/g, '').trim();
  const VALID = { test(s) {
    if (!NICK_RE.test(s)) return false;
    const n = [...s].length;                       // characters (code points)
    return n >= 3 && n <= 16 && s.length <= 24;
  } };
  const MAX_PLAYERS = 5;
  const INVITE_TTL = 3 * 60 * 1000;
  /*
   * Real time: the web server's (the Date header of version.json, free).
   * If the device's clock was ahead (e.g. the time zone set wrongly),
   * every invitation looked expired and was deleted without being shown, and
   * friends always showed as offline (it happened in 2026-10).
   */
  let skew = 0;
  const now = () => Date.now() + skew;
  function measureSkew() {
    const t0 = Date.now();
    fetch('version.json?t=' + t0, { method: 'HEAD', cache: 'no-store' }).then(r => {
      const d = Date.parse(r.headers.get('date') || '');
      if (!d) return;
      const s = d + 500 - (t0 + Date.now()) / 2;          // (the header is in seconds)
      skew = Math.abs(s) > 60000 ? s : 0;
      if (skew) console.warn('[Social] this device\'s clock is off by', Math.round(skew / 60000), 'min: correcting');
    }).catch(() => {});
  }
  // Presence heartbeat: every 30 min (it was 15; before that 10). 57,000 players with
  // friends were writing it 4 times an hour (13-10-2026, less Firestore spending).
  const BEAT = 30 * 60 * 1000;
  const ONLINE = 40 * 60 * 1000;        // "online" if the last heartbeat is more recent
  const PRES_TTL = 60 * 1000;           // what's read about friends is valid for 1 min

  let fb = null, uid = null;
  let me = null;                    // { uid, name }
  let friends = new Map();          // otherUid -> { uid, name, pid, status: 'ok'|'in'|'out', online, play }
  let unFriends = null;
  let beatT = 0, presAt = 0, unInv = null;
  const pres = new Map();           // otherUid -> { online, play, room, seen } (the last read)
  const sentInv = new Set();        // who you invited (to withdraw it when leaving)
  let room = null;                  // { id, host, isHost, members: [{ uid, name, dex, shiny }] }
  let roomRefs = [];
  const invites = new Map();        // fromUid -> { from, name, room, at }
  const listeners = new Set();
  let started = false;

  function emit(what) { listeners.forEach(fn => { try { fn(what); } catch (e) { console.warn(e); } }); }
  const ts = () => firebase.database.ServerValue.TIMESTAMP;
  const fts = () => firebase.firestore.FieldValue.serverTimestamp();
  const msOf = v => (v && v.toMillis ? v.toMillis() : +v || 0);
  const pidOf = (a, b) => (a < b ? a + '_' + b : b + '_' + a);

  // ---------------- startup ----------------

  /** After signing in. → 'ok' | 'need-nick' | 'off' (no cloud) */
  async function start() {
    if (!G.DB.online) return 'off';
    if (started) return me ? 'ok' : 'need-nick';
    fb = G.DB.fb; uid = fb.uid;
    started = true;
    measureSkew();
    // The nickname rarely changes (Settings > Account): it's remembered in this browser so the
    // profile isn't read on every visit (one read fewer per player and session).
    const NICK = 'ps.nick.' + uid;
    let cachedNick = null;
    try { cachedNick = localStorage.getItem(NICK); } catch (e) { /* nothing */ }
    const prof = cachedNick ? { name: cachedNick }
      : await fb.fs.collection('profiles').doc(uid).get().then(s => s.exists ? s.data() : null).catch(() => null);
    if (prof) {
      me = { uid, name: prof.name };
      if (G.DB.user !== prof.name) G.DB.setName(prof.name);
      try { localStorage.setItem(NICK, prof.name); } catch (e) { /* nothing */ }
    }
    else if (G.DB.nameAccount) {
      // Name and password accounts: their name is already unique, so it's used as the nickname.
      const r = await claimNick(G.DB.save.name);
      if (!r.ok) return 'need-nick';
    } else return 'need-nick';
    online();
    setTimeout(() => publishHistory(), 4000);             // shared copy of your run history (see publishHistory)
    return 'ok';
  }

  /** Reserves a unique nickname and creates the public profile. */
  async function claimNick(name) {
    name = cleanNick(name);
    if (!VALID.test(name)) return { ok: false, error: 'The nickname must be 3-16 letters, numbers, _ or emoji.' };
    const lower = name.toLowerCase();
    const oldLower = me && me.name ? me.name.toLowerCase() : '';
    try {
      await fb.fs.runTransaction(async tx => {
        const nref = fb.fs.collection('names').doc(lower);
        const oref = oldLower && oldLower !== lower ? fb.fs.collection('names').doc(oldLower) : null;
        const n = await tx.get(nref);
        const o = oref ? await tx.get(oref) : null;         // (all reads go before the writes)
        if (n.exists && n.data().uid !== uid) throw { code: 'taken' };
        if (!n.exists) tx.set(nref, { uid });
        if (o && o.exists && o.data().uid === uid) tx.delete(oref);       // changing it: the old nickname is free again
        tx.set(fb.fs.collection('profiles').doc(uid),
          { name, lower, at: firebase.firestore.FieldValue.serverTimestamp() });
      });
    } catch (e) {
      if (e && e.code === 'taken') return { ok: false, error: 'That nickname is already taken.' };
      return { ok: false, error: "Couldn't save the nickname (" + ((e && e.code) || 'error') + ').' };
    }
    me = { uid, name };
    try { localStorage.setItem('ps.nick.' + uid, name); } catch (e) { /* nothing */ }
    G.DB.setName(name);
    if (started && !beatT) online();
    publishProfile(true);
    // Friends keep your name inside each friendship: update your side (needs the rule in firestore.rules; if it is refused, they see it after a re-add).
    {
      for (const f of friends.values()) {
        if (f.pid && f.status === 'ok') fb.fs.collection('friendships').doc(f.pid).update({ ['names.' + uid]: name }).catch(() => {});
      }
    }
    return { ok: true };
  }

  /** Presence (heartbeat), friends and invitations. None of this uses the Realtime Database. */
  function online() {
    if (beatT) return;                        // already running
    if (fb.rtdb) fb.rtdb.goOffline();         // only connects on entering a room
    writeStatus();
    clearInterval(beatT);
    beatT = setInterval(() => { if (document.visibilityState === 'visible') writeStatus(); }, BEAT);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', onHide);
    listenFriends();
  }

  /** Room invitations: they can only come from friends, so with no friends nothing is listened to (reads). */
  function listenInvites() {
    if (unInv || !fb) return;
    unInv = fb.fs.collection('inv').where('to', '==', uid).onSnapshot(snap => {
      snap.docChanges().forEach(ch => {
        const v = ch.doc.data();
        if (ch.type === 'removed') { invites.delete(v.from); emit('invites'); return; }
        onInvite(ch.doc.ref, v);
      });
    }, e => console.warn('[Social] invitaciones:', e.code || e.message));
  }

  let playing = false, lastBeat = 0;
  /** Is there anyone who can read your "online" status? (only confirmed friends) */
  const hasFriends = () => [...friends.values()].some(f => f.status === 'ok');
  // What you are doing (menu, gacha, in a run...) and, for runs, when it started (server clock).
  // Friends read it with the rest of your status. Written only when it changes (at most one write
  // per ACT_GAP) plus a light heartbeat during a run; turned off by the "Show what I'm doing" setting.
  const ACTS = new Set(['menu', 'gacha', 'upgrades', 'dex', 'rank', 'goals', 'lobby', 'run', 'group', 'arceus']);
  const RUNS = new Set(['run', 'group', 'arceus']);
  const ACT_GAP = 30 * 1000, RUN_FRESH = 12 * 60 * 1000;
  let act = '', actSince = 0, actMon = 0, actOk = true, monOk = true, actT = 0;

  function writeStatus(on = true) {
    // With no friends nobody reads it: no write is spent (Firebase's daily quota).
    if (!fb || !me || !hasFriends()) return;
    lastBeat = Date.now();
    if (!act && G.Activity) { const c = G.Activity.current(); act = c.act; actSince = c.since; }   // first write after login
    const doc = { on, at: fts(), room: room ? room.id : '', play: playing };
    if (actOk) {
      const share = on && G.Settings.get('shareAct') !== false;
      doc.act = share ? act : '';
      doc.since = share && RUNS.has(act) ? Math.round(actSince) : 0;
      if (monOk) doc.mon = share && RUNS.has(act) ? actMon : 0;
    }
    const ref = fb.fs.collection('pres').doc(uid);
    ref.set(doc).catch(e => {
      // Rules not republished yet (they don't know mon, or act/since): keep the status working with fewer fields.
      if (!(e && e.code === 'permission-denied')) return;
      if (monOk && actOk) {
        monOk = false; delete doc.mon;
        return ref.set(doc).catch(e2 => {
          if (e2 && e2.code === 'permission-denied') { actOk = false; ref.set({ on, at: fts(), room: room ? room.id : '', play: playing }).catch(() => {}); }
        });
      }
      if (actOk) { actOk = false; ref.set({ on, at: fts(), room: room ? room.id : '', play: playing }).catch(() => {}); }
    });
  }
  function setPlaying(p) { if (playing !== !!p) { playing = !!p; writeStatus(); } }

  /** Tell friends what you are doing. `since` = server-clock ms when the run started (runs only). */
  function setActivity(a, since = 0, mon = 0) {
    if (!ACTS.has(a)) a = '';
    if (a === act && (!since || Math.abs(since - actSince) < 5000) && (mon || 0) === actMon) return;
    act = a; actSince = since || 0; actMon = mon || 0;
    if (!started || actT) return;
    const wait = Math.max(0, ACT_GAP - (Date.now() - lastBeat));
    if (!wait) writeStatus();
    else actT = setTimeout(() => { actT = 0; writeStatus(); }, wait);
  }
  /** Re-send the status if the last one is older than `minAge` ms (run heartbeat; 0 = now). */
  function touch(minAge = 0) {
    if (!started || document.visibilityState !== 'visible') return;
    if (Date.now() - lastBeat >= minAge) writeStatus();
  }
  // On returning to the tab after a while, a heartbeat; on closing it, "offline".
  function onVisible() { if (document.visibilityState === 'visible' && Date.now() - lastBeat > BEAT) writeStatus(); }
  function onHide() { writeStatus(false); }

  async function stop(why) {
    if (!started) return;
    await leaveRoom().catch(() => {});
    if (unFriends) { unFriends(); unFriends = null; }
    if (unInv) { unInv(); unInv = null; }
    clearInterval(beatT); beatT = 0;
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('pagehide', onHide);
    if (me) await fb.fs.collection('pres').doc(uid).delete().catch(() => {});
    if (why === 'delete') {
      try { localStorage.removeItem('ps.nick.' + uid); } catch (e) { /* nothing */ }
      await deleteAll().catch(e => console.warn('[Social] delete:', e));
    }
    friends.clear(); invites.clear(); sentInv.clear(); pres.clear(); presAt = 0;
    me = null; started = false; fb = null; uid = null; playing = false;
    emit('stop');
  }

  /** When deleting the account: friendships, leaderboard records, profile and nickname. */
  async function deleteAll() {
    // Each step separately: if one fails, the others are deleted anyway.
    const step = async (what, fn) => { try { await fn(); } catch (e) { console.warn('[Social] could not delete ' + what + ':', e.code || e.message); } };
    const del = async q => { const s = await q.get(); await Promise.all(s.docs.map(d => d.ref.delete().catch(() => {}))); };
    await step('chats', () => del(fb.fs.collection('chats').where('users', 'array-contains', uid)));
    await step('amistades', () => del(fb.fs.collection('friendships').where('users', 'array-contains', uid)));
    await step('leaderboard rows', () => G.Ranking.removeMine());
    await step('invitaciones', () => del(fb.fs.collection('inv').where('to', '==', uid)));
    await step('records', () => del(fb.fs.collectionGroup('e').where('uids', 'array-contains', uid)));
    await step('run in progress', () => fb.fs.collection('runs').doc(uid).delete());
    await step('historial', () => fb.fs.collection('histories').doc(uid).delete());
    await step('nickname', async () => {
      const prof = await fb.fs.collection('profiles').doc(uid).get();
      const lower = prof.exists ? prof.data().lower : me && me.name.toLowerCase();
      if (lower) await fb.fs.collection('names').doc(lower).delete().catch(() => {});
      if (prof.exists) await fb.fs.collection('profiles').doc(uid).delete();
    });
  }

  // ---------------- friends ----------------

  function listenFriends() {
    unFriends = fb.fs.collection('friendships').where('users', 'array-contains', uid).onSnapshot(snap => {
      const next = new Map();
      snap.forEach(d => {
        const f = d.data();
        const other = f.users[0] === uid ? f.users[1] : f.users[0];
        next.set(other, Object.assign({
          uid: other, pid: d.id, name: (f.names && f.names[other]) || '???',
          status: f.status === 'ok' ? 'ok' : f.to === uid ? 'in' : 'out',
          online: false, play: false, room: '', seen: 0
        }, pres.get(other) || {}));
      });
      // A new friend (or one just accepted): check whether they're online.
      const added = [...next.values()].some(f => f.status === 'ok' && (!friends.has(f.uid) || friends.get(f.uid).status !== 'ok'));
      const hadFriends = hasFriends();
      friends = next;
      emit('friends');
      // Your first friend: now there is someone to read your "online" status and invite you.
      if (!hadFriends && hasFriends()) writeStatus();
      if (hasFriends()) listenInvites();
      // Check whether they're online a moment later: your friend has also just
      // received the friendship and is writing their "online" status at the same time.
      if (added) setTimeout(() => { if (started) refreshPresence(true); }, 2500);
    }, e => console.warn('[Social] friends:', e.code || e.message));
  }

  /**
   * Reads your friends' "online" status (1 read per friend). It's only called when
   * opening Friends or the room, and what's read is valid for 1 min.
   */
  async function refreshPresence(force = false) {
    if (!fb || (!force && Date.now() - presAt < PRES_TTL)) return;
    presAt = Date.now();
    const ok = [...friends.values()].filter(f => f.status === 'ok');
    const docs = await Promise.all(ok.map(f => fb.fs.collection('pres').doc(f.uid).get().catch(() => null)));
    const t = now();
    ok.forEach((f, i) => {
      const v = docs[i] && docs[i].exists ? docs[i].data() : null;
      const on = !!(v && v.on && t - msOf(v.at) < ONLINE);
      const p = { online: on, play: !!(on && v.play), room: on ? v.room : '', seen: v ? msOf(v.at) : 0, act: '', since: 0, mon: 0 };
      if (on && typeof v.act === 'string' && ACTS.has(v.act)) {
        // A run with no recent sign of life (crash, closed tab) is not shown as a run.
        if (!RUNS.has(v.act) || t - msOf(v.at) < RUN_FRESH) p.act = v.act;
        const sn = +v.since;
        if (RUNS.has(p.act) && G.DEX_BY[v.mon]) p.mon = +v.mon;
        if (RUNS.has(p.act) && Number.isFinite(sn) && sn > 0 && sn <= t + 60000 && t - sn < 6 * 3600 * 1000) p.since = sn;
      }
      pres.set(f.uid, p);
      // The friends list may have been refreshed while reading: it's applied to the current one.
      const cur = friends.get(f.uid);
      if (cur) Object.assign(cur, p);
    });
    emit('presence');
  }

  /** Sends a friend request (or accepts the one they had already sent you). */
  async function request(name) {
    name = cleanNick(name);
    if (!me) return { ok: false, error: 'Choose your nickname first.' };
    if (!VALID.test(name)) return { ok: false, error: 'Type your friend\'s exact nickname.' };
    const n = await fb.fs.collection('names').doc(name.toLowerCase()).get().catch(() => null);
    if (!n || !n.exists) return { ok: false, error: 'There\'s no player with that nickname.' };
    const other = n.data().uid;
    if (other === uid) return { ok: false, error: 'That\'s you.' };
    const f = friends.get(other);
    if (f && f.status === 'ok') return { ok: false, error: 'You\'re already friends.' };
    if (f && f.status === 'out') return { ok: false, error: 'You already sent them a request.' };
    if (f && f.status === 'in') return accept(other);
    const prof = await fb.fs.collection('profiles').doc(other).get().catch(() => null);
    const otherName = prof && prof.exists ? prof.data().name : name;
    const users = [uid, other].sort();
    try {
      await fb.fs.collection('friendships').doc(users[0] + '_' + users[1]).set({
        users, from: uid, to: other, status: 'pending',
        names: { [uid]: me.name, [other]: otherName },
        at: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { ok: true, msg: 'Request sent to ' + otherName };
    } catch (e) { return { ok: false, error: "Couldn't send it (" + (e.code || 'error') + ').' }; }
  }

  async function accept(other) {
    const f = friends.get(other);
    if (!f || f.status !== 'in') return { ok: false, error: 'There\'s no request.' };
    try {
      await fb.fs.collection('friendships').doc(f.pid).update({
        status: 'ok', at: firebase.firestore.FieldValue.serverTimestamp(), ['names.' + uid]: me.name
      });
      return { ok: true, msg: "You're now friends with " + f.name };
    } catch (e) { return { ok: false, error: "Couldn't accept it (" + (e.code || 'error') + ').' }; }
  }

  async function remove(other) {
    const f = friends.get(other);
    if (!f) return { ok: false };
    try {
      if (f.status === 'ok' && G.Chat) await G.Chat.purge(other);     // their conversation goes too (needs the friendship for the rules)
      await fb.fs.collection('friendships').doc(f.pid).delete(); return { ok: true };
    }
    catch (e) { return { ok: false, error: "Couldn't remove it (" + (e.code || 'error') + ').' }; }
  }

  // ---------------- rooms ----------------

  function memberInfo() {
    const s = G.DB.save;
    return { name: me.name, dex: s.partner, shiny: !!s.partnerShiny && G.DB.ownsShiny(s.partner), at: ts() };
  }

  /**
   * The Realtime Database only connects while you're in a room: each
   * open connection uses downloads (charged above 360 MB a day).
   * (On 11-10-2026 there was an online-players counter that kept it always
   * connected; it was removed for that reason.)
   */
  function rtOn() { if (fb.rtdb) fb.rtdb.goOnline(); }
  function rtOff() { if (fb && fb.rtdb && !room) fb.rtdb.goOffline(); }

  async function createRoom() {
    if (room) return room;
    rtOn();
    const id = fb.rtdb.ref('rooms').push().key;
    await fb.rtdb.ref('rooms/' + id).set({ host: uid, open: true, at: ts(), m: { [uid]: memberInfo() } });
    enterRoom(id, uid);
    return room;
  }

  async function joinRoom(id) {
    if (room && room.id === id) return { ok: true };
    if (room) await leaveRoom();
    rtOn();
    let open = null, host = null;
    try {
      open = (await fb.rtdb.ref('rooms/' + id + '/open').get()).val();
      host = (await fb.rtdb.ref('rooms/' + id + '/host').get()).val();
    } catch (e) { /* room deleted */ }
    if (!host) { rtOff(); return { ok: false, error: 'That room no longer exists.' }; }
    if (open !== true) { rtOff(); return { ok: false, error: 'That room\'s game has already started.' }; }
    try { await fb.rtdb.ref('rooms/' + id + '/m/' + uid).set(memberInfo()); }
    catch (e) { rtOff(); return { ok: false, error: 'Couldn\'t join the room.' }; }
    const n = (await fb.rtdb.ref('rooms/' + id + '/m').get()).numChildren();
    if (n > MAX_PLAYERS) {
      await fb.rtdb.ref('rooms/' + id + '/m/' + uid).remove();
      rtOff();
      return { ok: false, error: 'The room is full (max ' + MAX_PLAYERS + ').' };
    }
    enterRoom(id, host);
    return { ok: true };
  }

  function enterRoom(id, host) {
    room = { id, host, isHost: host === uid, members: [], open: true };
    watchRoomDisconnect();
    const mref = fb.rtdb.ref('rooms/' + id + '/m');
    mref.on('value', s => {
      if (!room || room.id !== id) return;
      const m = s.val() || {};
      // The host always first; the rest in order of arrival.
      room.members = Object.keys(m).map(k => Object.assign({ uid: k }, m[k]))
        .sort((a, b) => (a.uid === room.host ? -1 : b.uid === room.host ? 1 : (a.at || 0) - (b.at || 0)));
      healMember();
      emit('room');
    }, () => closedRoom());
    const href = fb.rtdb.ref('rooms/' + id + '/host');
    href.on('value', s => { if (room && room.id === id && !s.val()) closedRoom(); }, () => closedRoom());
    const oref = fb.rtdb.ref('rooms/' + id + '/open');
    oref.on('value', s => { if (room && room.id === id) { room.open = s.val() === true; emit('room'); } }, () => {});
    // If the connection to the database drops, the server deletes your place (onDisconnect).
    // When the connection comes back it's put back, so a short drop doesn't take you out of the room.
    const cref = fb.rtdb.ref('.info/connected');
    let wasOn = false;
    cref.on('value', s => {
      const on = s.val() === true;
      if (on && wasOn && room && room.id === id && !room.isHost) rejoinSpot(id);
      wasOn = on;
    });
    roomRefs = [mref, href, oref, cref];
    writeStatus();
    emit('room');
  }

  /** Puts you back in the room after a database drop (if the room still exists). */
  async function rejoinSpot(id) {
    try {
      const host = (await fb.rtdb.ref('rooms/' + id + '/host').get()).val();
      if (!host || !room || room.id !== id) return;
      const ref = fb.rtdb.ref('rooms/' + id + '/m/' + uid);
      if (!(await ref.get()).exists()) { await ref.set(memberInfo()); console.warn('[Social] place recovered after a drop'); }
      watchRoomDisconnect();        // the disconnect notice is used up when it fires: it's armed again
    } catch (e) { console.warn('[Social] could not recover the place:', e.code || e.message); }
  }

  /** If the browser closes, the room (host) or your place (guest) is deleted automatically. */
  function watchRoomDisconnect() {
    if (!room) return;
    const ref = room.isHost ? fb.rtdb.ref('rooms/' + room.id) : fb.rtdb.ref('rooms/' + room.id + '/m/' + uid);
    ref.onDisconnect().remove();
  }

  function detachRoom() {
    for (const r of roomRefs) r.off();
    roomRefs = [];
  }

  function closedRoom() {
    if (!room) return;
    detachRoom();
    room = null;
    retractInvites();
    writeStatus();
    rtOff();
    emit('room-closed');
  }

  async function leaveRoom() {
    if (!room) return;
    const r = room;
    detachRoom();
    room = null;
    const ref = r.isHost ? fb.rtdb.ref('rooms/' + r.id) : fb.rtdb.ref('rooms/' + r.id + '/m/' + uid);
    ref.onDisconnect().cancel().catch(() => {});
    await ref.remove().catch(() => {});
    retractInvites();
    writeStatus();
    rtOff();
    emit('room');
  }

  /** The host closes the room to new players when the run starts. */
  function setOpen(open) {
    if (room && room.isHost) fb.rtdb.ref('rooms/' + room.id + '/open').set(!!open).catch(() => {});
  }

  /** Updates your Pokémon in the room (if you change partner). */
  function refreshMember() {
    if (!room || !me) return Promise.resolve();
    return fb.rtdb.ref('rooms/' + room.id + '/m/' + uid).update(
      { dex: G.DB.save.partner, shiny: !!G.DB.save.partnerShiny && G.DB.ownsShiny(G.DB.save.partner) }).catch(() => {});
  }

  /**
   * If what the others see of your partner doesn't match yours (you changed
   * Pokémon outside the room, or the upload failed), it fixes itself. Only one attempt at a
   * time, so it doesn't repeat while the reply arrives.
   */
  let healing = false;
  function healMember() {
    if (healing || !room || !me || !G.DB.save) return;
    const mine = room.members.find(m => m.uid === uid);
    if (!mine) return;
    const dex = G.DB.save.partner, shiny = !!G.DB.save.partnerShiny && G.DB.ownsShiny(dex);
    if (mine.dex === dex && !!mine.shiny === shiny) return;
    healing = true;
    refreshMember().then(() => { setTimeout(() => { healing = false; }, 1500); });
  }

  // ---------------- invitaciones ----------------

  async function invite(other) {
    const f = friends.get(other);
    if (!f || f.status !== 'ok') return { ok: false, error: 'You can only invite your friends.' };
    if (room && room.members.length >= MAX_PLAYERS) return { ok: false, error: 'The room is full.' };
    if (room && !room.isHost) return { ok: false, error: 'Only the room host can invite.' };
    if (!room) await createRoom();
    try {
      await fb.fs.collection('inv').doc(other + '_' + uid).set({ to: other, from: uid, room: room.id, name: me.name, at: fts() });
    } catch (e) { return { ok: false, error: "Couldn't send the invite (" + (e.code || 'error') + ').' }; }
    sentInv.add(other);
    return { ok: true, msg: 'Invite sent to ' + f.name };
  }

  /** Withdraws the invitations you sent (when leaving the room). */
  function retractInvites() {
    if (!fb) return;
    for (const o of sentInv) fb.fs.collection('inv').doc(o + '_' + uid).delete().catch(() => {});
    sentInv.clear();
  }

  function onInvite(ref, v) {
    // Expired ones are deleted; only those from confirmed friends are accepted.
    if (!v || (v.at && now() - msOf(v.at) > INVITE_TTL)) { ref.delete().catch(() => {}); return; }
    const f = friends.get(v.from);
    if (f && f.status !== 'ok') return;
    invites.set(v.from, { from: v.from, name: v.name, room: v.room, at: msOf(v.at) || now() });
    emit('invites');
  }

  const invDoc = from => fb.fs.collection('inv').doc(uid + '_' + from);

  async function acceptInvite(from) {
    const inv = invites.get(from);
    if (!inv || now() - inv.at > INVITE_TTL) { invites.delete(from); emit('invites'); return { ok: false, error: 'The invite has expired.' }; }
    invites.delete(from);
    invDoc(from).delete().catch(() => {});
    emit('invites');
    return joinRoom(inv.room);
  }

  function declineInvite(from) {
    invites.delete(from);
    invDoc(from).delete().catch(() => {});
    emit('invites');
  }

  // ---------------- public profile ----------------

  /** What's shown about you (also for your preview, without uploading it). */
  function profileData() {
    const s = G.DB.save, st = s.stats, prof = s.profile || {};
    const unlocked = G.AchDefs.LIST.filter(a => s.ach && s.ach[a.id]);
    const medals = unlocked.slice().sort((a, b) => (b.tier - a.tier) || (s.ach[b.id] - s.ach[a.id])).slice(0, 8).map(a => a.id);
    return {
      name: me ? me.name : G.DB.user,
      favs: (prof.favs || []).slice(0, 3).map(f => ({ dex: f.dex | 0, shiny: !!f.shiny })),
      title: prof.title || '',
      banner: prof.banner || '',
      frame: prof.frame || '',
      best: { solo: st.bestTime | 0, group: st.bestGroupTime | 0, level: st.bestLevel | 0, bosses: st.bossesTotal | 0,
              legends: Object.keys(s.legends || {}).length, kills: st.totalKills | 0, medals: unlocked.length },
      medals
    };
  }

  let pubT = 0, pubAt = 0, pubLast = '';
  /**
   * Uploads your profile (with a short wait, in case you change several things
   * in a row), but ONLY if something visible at a glance has changed:
   * time and level records, legendaries, medals, title or favourites.
   * Bosses and defeated counts (which change every run) are uploaded with the rest
   * when it's due, not on their own: the profile was being written 200,000 times a day
   * (13-10-2026). If you change favourites or title (force), immediately.
   */
  function publishProfile(force = false) {
    if (!me || !fb) return;
    if (!force && Date.now() - pubAt < 2 * 3600 * 1000) return;    // at most every 2 h (it was 30 min)
    clearTimeout(pubT);
    pubT = setTimeout(() => {
      if (!me || !fb) return;
      const d = profileData();
      // To decide whether to upload (remembered between sessions): without bosses or defeated counts.
      const key = JSON.stringify(Object.assign({}, d, { best: Object.assign({}, d.best, { kills: 0, bosses: 0 }) }));
      const lsKey = 'ps.pub.' + uid;
      if (!pubLast) { try { pubLast = localStorage.getItem(lsKey) || ''; } catch (e) { /* nothing */ } }
      if (key === pubLast) return;
      pubLast = key; pubAt = Date.now();
      try { localStorage.setItem(lsKey, key); } catch (e) { /* nothing */ }
      fb.fs.collection('profiles').doc(uid).set(Object.assign(d, {
        name: me.name, lower: me.name.toLowerCase(), at: firebase.firestore.FieldValue.serverTimestamp()
      })).catch(e => { pubLast = ''; console.warn('[Social] profile:', e.code || e.message); });
    }, 800);
  }

  // ---------------- run history (shared copy) ----------------
  /*
   * histories/{uid} = { at, runs: [...] } is a copy of your last runs (the same entries as save.history)
   * so other players can open them from your profile. One write per finished run. Settings "Share my
   * run history" off: the copy is deleted. Only your own computer writes it (see firestore.rules).
   */
  let histPub = '';
  function publishHistory() {
    if (!me || !fb || !uid) return;
    const on = G.Settings.get('shareHist') !== false;
    const list = (G.DB.save && G.DB.save.history) || [];
    const key = on && list.length ? list[0].id + ':' + list.length : on ? 'empty' : 'off';
    const lsKey = 'ps.hist.' + uid;
    if (!histPub) { try { histPub = localStorage.getItem(lsKey) || ''; } catch (e) { /* nothing */ } }
    if (key === histPub) return;
    const ref = fb.fs.collection('histories').doc(uid);
    const done = () => { histPub = key; try { localStorage.setItem(lsKey, key); } catch (e) { /* nothing */ } };
    const fail = e => console.warn('[Social] history:', e.code || e.message);
    // Firestore refuses arrays inside arrays (a run has moves and teammates lists), so each run goes up as a JSON string.
    try {
      if (!on || !list.length) ref.delete().then(done).catch(fail);
      else ref.set({ at: firebase.firestore.FieldValue.serverTimestamp(), runs: list.slice(0, G.DB.HISTORY_MAX).map(r => JSON.stringify(r)) }).then(done).catch(fail);
    } catch (e) { fail(e); }   // never let this break the end of a run
  }
  G.Settings.on(k => { if (k === 'shareHist') publishHistory(); });

  /** Another player's shared run history: an array of runs (empty if they share nothing). Yours comes straight from your save. */
  const histCache = new Map();
  async function getHistory(other) {
    if (other === uid) return (G.DB.save && G.DB.save.history) || [];
    if (!fb) return [];
    const c = histCache.get(other);
    if (c && Date.now() - c.at < 3 * 60 * 1000) return c.v;
    const d = await fb.fs.collection('histories').doc(other).get().catch(() => null);
    const raw = d && d.exists ? ((d.data() || {}).runs || []) : [];
    const v = G.DB.cleanHistory(raw.map(r => { try { return typeof r === 'string' ? JSON.parse(r) : r; } catch (e) { return null; } }));
    histCache.set(other, { at: Date.now(), v });
    return v;
  }

  /** Another player's public profile. */
  const profCache = new Map();
  async function getProfile(other) {
    if (!fb) return null;
    // Yours comes from your save (without reading anything and always up to date).
    if (other === uid && me) return Object.assign(profileData(), { name: me.name });
    const c = profCache.get(other);
    if (c && Date.now() - c.at < 10 * 60 * 1000) return c.v;     // what's read is valid for 10 min
    const d = await fb.fs.collection('profiles').doc(other).get().catch(() => null);
    const v = d && d.exists ? d.data() : null;
    profCache.set(other, { at: Date.now(), v });
    return v;
  }

  // On signing out or deleting the account.
  G.DB.onLeave(why => stop(why));

  return {
    start, stop, claimNick, request, accept, remove, publishProfile, getProfile, profileData, publishHistory, getHistory,
    createRoom, joinRoom, leaveRoom, setOpen, refreshMember, setPlaying, setActivity, touch, refreshPresence,
    invite, acceptInvite, declineInvite,
    on(fn) { listeners.add(fn); }, off(fn) { listeners.delete(fn); },
    get me() { return me; },
    get started() { return started; },
    get friends() { return [...friends.values()]; },
    get invites() { return [...invites.values()]; },
    get room() { return room; },
    get uid() { return uid; },
    /** The real time (corrects the device's clock if it's off). */
    now,
    VALID, MAX_PLAYERS
  };
})();
