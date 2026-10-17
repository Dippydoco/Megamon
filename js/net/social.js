/* ============ social.js — apodo, amigos, en línea, invitaciones y salas ============
 * Sólo funciona con cuenta en la nube (G.DB.online). Usa:
 *
 *   Firestore
 *     names/{apodo en minúsculas}  { uid }               apodos únicos
 *     profiles/{uid}               { name, lower, at }   apodo público
 *     friendships/{uidA_uidB}      { users, from, to, status: 'pending'|'ok', names, at }
 *
 *     pres/{uid}                   { on, at, room, play } en línea (aproximado)
 *     inv/{para_de}                { to, from, room, name, at } invitaciones
 *
 *   Realtime Database: SÓLO mientras estás en una sala o partida en grupo
 *     rooms/{id}          { host, open, at, m: { uid: { name, dex, shiny } }, q: ... }
 *                         la sala; q/ son los mensajes de net.js
 *
 * Por qué así: el plan gratuito de Firebase sólo admite 100 conexiones a la
 * vez a la Realtime Database. Si todo el mundo estuviera conectado para el
 * "en línea", ése sería el máximo de jugadores. Ahora sólo cuentan los que
 * están en una sala; el "en línea" va por Firestore con un latido cada 10 min
 * y se lee sólo al abrir Amigos o la sala (lo leído vale 1 min).
 *
 * El resto del juego escucha los cambios con G.Social.on(fn).
 */
G.Social = (() => {
  const VALID = /^[A-Za-z0-9_ñÑáéíóúÁÉÍÓÚ]{3,16}$/;
  const MAX_PLAYERS = 5;
  const INVITE_TTL = 3 * 60 * 1000;
  /*
   * Hora real: la del servidor de la web (cabecera Date de version.json, gratis).
   * Si el reloj del aparato va adelantado (p. ej. la zona horaria mal puesta),
   * todas las invitaciones parecían caducadas y se borraban sin enseñarse, y
   * los amigos salían siempre desconectados (pasaba en 2026-10).
   */
  let skew = 0;
  const now = () => Date.now() + skew;
  function measureSkew() {
    const t0 = Date.now();
    fetch('version.json?t=' + t0, { method: 'HEAD', cache: 'no-store' }).then(r => {
      const d = Date.parse(r.headers.get('date') || '');
      if (!d) return;
      const s = d + 500 - (t0 + Date.now()) / 2;          // (la cabecera va en segundos)
      skew = Math.abs(s) > 60000 ? s : 0;
      if (skew) console.warn('[Social] el reloj de este aparato va desfasado', Math.round(skew / 60000), 'min: se corrige');
    }).catch(() => {});
  }
  // Latido de presencia: cada 30 min (era 15; antes 10). 57.000 jugadores con
  // amigos lo escribían 4 veces por hora (13-10-2026, menos gasto de Firestore).
  const BEAT = 30 * 60 * 1000;
  const ONLINE = 40 * 60 * 1000;        // "en línea" si el último latido es más reciente
  const PRES_TTL = 60 * 1000;           // lo leído de los amigos vale 1 min

  let fb = null, uid = null;
  let me = null;                    // { uid, name }
  let friends = new Map();          // otherUid -> { uid, name, pid, status: 'ok'|'in'|'out', online, play }
  let unFriends = null;
  let beatT = 0, presAt = 0, unInv = null;
  const pres = new Map();           // otherUid -> { online, play, room, seen } (lo último leído)
  const sentInv = new Set();        // a quién invitaste (para retirarlo al salir)
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

  // ---------------- arranque ----------------

  /** Tras iniciar sesión. → 'ok' | 'need-nick' | 'off' (sin nube) */
  async function start() {
    if (!G.DB.online) return 'off';
    if (started) return me ? 'ok' : 'need-nick';
    fb = G.DB.fb; uid = fb.uid;
    started = true;
    measureSkew();
    // El apodo no cambia nunca: se recuerda en este navegador y así no se lee
    // el perfil en cada visita (una lectura menos por jugador y sesión).
    const NICK = 'ps.nick.' + uid;
    let cachedNick = null;
    try { cachedNick = localStorage.getItem(NICK); } catch (e) { /* nada */ }
    const prof = cachedNick ? { name: cachedNick }
      : await fb.fs.collection('profiles').doc(uid).get().then(s => s.exists ? s.data() : null).catch(() => null);
    if (prof) {
      me = { uid, name: prof.name };
      if (G.DB.user !== prof.name) G.DB.setName(prof.name);
      try { localStorage.setItem(NICK, prof.name); } catch (e) { /* nada */ }
    }
    else if (G.DB.nameAccount) {
      // Cuentas de nombre y contraseña: su nombre ya es único, se usa de apodo.
      const r = await claimNick(G.DB.save.name);
      if (!r.ok) return 'need-nick';
    } else return 'need-nick';
    online();
    return 'ok';
  }

  /** Reserva un apodo único y crea el perfil público. */
  async function claimNick(name) {
    name = (name || '').trim();
    if (!VALID.test(name)) return { ok: false, error: 'El apodo debe tener 3-16 letras, números o _.' };
    const lower = name.toLowerCase();
    try {
      await fb.fs.runTransaction(async tx => {
        const nref = fb.fs.collection('names').doc(lower);
        const n = await tx.get(nref);
        if (n.exists && n.data().uid !== uid) throw { code: 'taken' };
        if (!n.exists) tx.set(nref, { uid });
        tx.set(fb.fs.collection('profiles').doc(uid),
          { name, lower, at: firebase.firestore.FieldValue.serverTimestamp() });
      });
    } catch (e) {
      if (e && e.code === 'taken') return { ok: false, error: 'Ese apodo ya lo tiene otro jugador.' };
      return { ok: false, error: 'No se pudo guardar el apodo (' + ((e && e.code) || 'error') + ').' };
    }
    me = { uid, name };
    try { localStorage.setItem('ps.nick.' + uid, name); } catch (e) { /* nada */ }
    G.DB.setName(name);
    if (started && !beatT) online();
    publishProfile(true);
    return { ok: true };
  }

  /** Presencia (latido), amigos e invitaciones. Nada de esto usa la Realtime Database. */
  function online() {
    if (beatT) return;                        // ya estaba en marcha
    if (fb.rtdb) fb.rtdb.goOffline();         // se conecta sólo al entrar en una sala
    writeStatus();
    clearInterval(beatT);
    beatT = setInterval(() => { if (document.visibilityState === 'visible') writeStatus(); }, BEAT);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', onHide);
    listenFriends();
  }

  /** Invitaciones a salas: sólo te pueden llegar de amigos, así que sin amigos no se escucha (lecturas). */
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
  /** ¿Hay alguien que pueda leer tu "en línea"? (sólo los amigos confirmados) */
  const hasFriends = () => [...friends.values()].some(f => f.status === 'ok');
  // What you are doing (menu, gacha, in a run...) and, for runs, when it started (server clock).
  // Friends read it with the rest of your status. Written only when it changes (at most one write
  // per ACT_GAP) plus a light heartbeat during a run; turned off by the "Show what I'm doing" setting.
  const ACTS = new Set(['menu', 'gacha', 'upgrades', 'dex', 'rank', 'goals', 'lobby', 'run', 'group', 'arceus']);
  const RUNS = new Set(['run', 'group', 'arceus']);
  const ACT_GAP = 30 * 1000, RUN_FRESH = 12 * 60 * 1000;
  let act = '', actSince = 0, actOk = true, actT = 0;

  function writeStatus(on = true) {
    // Sin amigos nadie lo lee: no se gasta una escritura (cupo diario de Firebase).
    if (!fb || !me || !hasFriends()) return;
    lastBeat = Date.now();
    if (!act && G.Activity) { const c = G.Activity.current(); act = c.act; actSince = c.since; }   // first write after login
    const doc = { on, at: fts(), room: room ? room.id : '', play: playing };
    if (actOk) {
      const share = on && G.Settings.get('shareAct') !== false;
      doc.act = share ? act : '';
      doc.since = share && RUNS.has(act) ? Math.round(actSince) : 0;
    }
    fb.fs.collection('pres').doc(uid).set(doc).catch(e => {
      // Rules not republished yet (they don't know act/since): keep the old status working.
      if (actOk && e && e.code === 'permission-denied') {
        actOk = false;
        fb.fs.collection('pres').doc(uid).set({ on, at: fts(), room: room ? room.id : '', play: playing }).catch(() => {});
      }
    });
  }
  function setPlaying(p) { if (playing !== !!p) { playing = !!p; writeStatus(); } }

  /** Tell friends what you are doing. `since` = server-clock ms when the run started (runs only). */
  function setActivity(a, since = 0) {
    if (!ACTS.has(a)) a = '';
    if (a === act && (!since || Math.abs(since - actSince) < 5000)) return;
    act = a; actSince = since || 0;
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
  // Al volver a la pestaña tras un rato, un latido; al cerrarla, "desconectado".
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
      try { localStorage.removeItem('ps.nick.' + uid); } catch (e) { /* nada */ }
      await deleteAll().catch(e => console.warn('[Social] borrar:', e));
    }
    friends.clear(); invites.clear(); sentInv.clear(); pres.clear(); presAt = 0;
    me = null; started = false; fb = null; uid = null; playing = false;
    emit('stop');
  }

  /** Al borrar la cuenta: amistades, marcas del ranking, perfil y apodo. */
  async function deleteAll() {
    // Cada paso por separado: si uno falla, los demás se borran igual.
    const step = async (what, fn) => { try { await fn(); } catch (e) { console.warn('[Social] no se pudo borrar ' + what + ':', e.code || e.message); } };
    const del = async q => { const s = await q.get(); await Promise.all(s.docs.map(d => d.ref.delete().catch(() => {}))); };
    await step('chats', () => del(fb.fs.collection('chats').where('users', 'array-contains', uid)));
    await step('amistades', () => del(fb.fs.collection('friendships').where('users', 'array-contains', uid)));
    await step('filas del ranking', () => G.Ranking.removeMine());
    await step('invitaciones', () => del(fb.fs.collection('inv').where('to', '==', uid)));
    await step('marcas', () => del(fb.fs.collectionGroup('e').where('uids', 'array-contains', uid)));
    await step('partida en curso', () => fb.fs.collection('runs').doc(uid).delete());
    await step('apodo', async () => {
      const prof = await fb.fs.collection('profiles').doc(uid).get();
      const lower = prof.exists ? prof.data().lower : me && me.name.toLowerCase();
      if (lower) await fb.fs.collection('names').doc(lower).delete().catch(() => {});
      if (prof.exists) await fb.fs.collection('profiles').doc(uid).delete();
    });
  }

  // ---------------- amigos ----------------

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
      // Un amigo nuevo (o recién aceptado): se mira si está en línea.
      const added = [...next.values()].some(f => f.status === 'ok' && (!friends.has(f.uid) || friends.get(f.uid).status !== 'ok'));
      const hadFriends = hasFriends();
      friends = next;
      emit('friends');
      // Tu primer amigo: ahora sí hay quien lea tu "en línea" y quien te invite.
      if (!hadFriends && hasFriends()) writeStatus();
      if (hasFriends()) listenInvites();
      // Se mira si está en línea un momento después: tu amigo también acaba de
      // recibir la amistad y está apuntando su "en línea" a la vez.
      if (added) setTimeout(() => { if (started) refreshPresence(true); }, 2500);
    }, e => console.warn('[Social] amigos:', e.code || e.message));
  }

  /**
   * Lee el "en línea" de tus amigos (1 lectura por amigo). Sólo se llama al
   * abrir Amigos o la sala, y lo leído vale 1 min.
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
      const p = { online: on, play: !!(on && v.play), room: on ? v.room : '', seen: v ? msOf(v.at) : 0, act: '', since: 0 };
      if (on && typeof v.act === 'string' && ACTS.has(v.act)) {
        // A run with no recent sign of life (crash, closed tab) is not shown as a run.
        if (!RUNS.has(v.act) || t - msOf(v.at) < RUN_FRESH) p.act = v.act;
        const sn = +v.since;
        if (RUNS.has(p.act) && Number.isFinite(sn) && sn > 0 && sn <= t + 60000 && t - sn < 6 * 3600 * 1000) p.since = sn;
      }
      pres.set(f.uid, p);
      // La lista de amigos puede haberse renovado mientras se leía: se aplica a la actual.
      const cur = friends.get(f.uid);
      if (cur) Object.assign(cur, p);
    });
    emit('presence');
  }

  /** Envía una solicitud de amistad (o acepta la que ya te había mandado). */
  async function request(name) {
    name = (name || '').trim();
    if (!me) return { ok: false, error: 'Primero elige tu apodo.' };
    if (!VALID.test(name)) return { ok: false, error: 'Escribe el apodo exacto de tu amigo.' };
    const n = await fb.fs.collection('names').doc(name.toLowerCase()).get().catch(() => null);
    if (!n || !n.exists) return { ok: false, error: 'No hay ningún jugador con ese apodo.' };
    const other = n.data().uid;
    if (other === uid) return { ok: false, error: 'Ese eres tú.' };
    const f = friends.get(other);
    if (f && f.status === 'ok') return { ok: false, error: 'Ya sois amigos.' };
    if (f && f.status === 'out') return { ok: false, error: 'Ya le enviaste una solicitud.' };
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
      return { ok: true, msg: 'Solicitud enviada a ' + otherName };
    } catch (e) { return { ok: false, error: 'No se pudo enviar (' + (e.code || 'error') + ').' }; }
  }

  async function accept(other) {
    const f = friends.get(other);
    if (!f || f.status !== 'in') return { ok: false, error: 'No hay solicitud.' };
    try {
      await fb.fs.collection('friendships').doc(f.pid).update({
        status: 'ok', at: firebase.firestore.FieldValue.serverTimestamp(), ['names.' + uid]: me.name
      });
      return { ok: true, msg: 'Ahora eres amigo de ' + f.name };
    } catch (e) { return { ok: false, error: 'No se pudo aceptar (' + (e.code || 'error') + ').' }; }
  }

  async function remove(other) {
    const f = friends.get(other);
    if (!f) return { ok: false };
    try {
      if (f.status === 'ok' && G.Chat) await G.Chat.purge(other);     // their conversation goes too (needs the friendship for the rules)
      await fb.fs.collection('friendships').doc(f.pid).delete(); return { ok: true };
    }
    catch (e) { return { ok: false, error: 'No se pudo borrar (' + (e.code || 'error') + ').' }; }
  }

  // ---------------- salas ----------------

  function memberInfo() {
    const s = G.DB.save;
    return { name: me.name, dex: s.partner, shiny: !!s.partnerShiny && G.DB.ownsShiny(s.partner), at: ts() };
  }

  /**
   * La Realtime Database sólo se conecta mientras estás en una sala: cada
   * conexión abierta gasta descargas (se pagan a partir de 360 MB al día).
   * (El 11-10-2026 hubo un contador de gente en línea que la tenía siempre
   * conectada; se quitó por eso.)
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
    } catch (e) { /* sala borrada */ }
    if (!host) { rtOff(); return { ok: false, error: 'Esa sala ya no existe.' }; }
    if (open !== true) { rtOff(); return { ok: false, error: 'La partida de esa sala ya ha empezado.' }; }
    try { await fb.rtdb.ref('rooms/' + id + '/m/' + uid).set(memberInfo()); }
    catch (e) { rtOff(); return { ok: false, error: 'No se pudo entrar en la sala.' }; }
    const n = (await fb.rtdb.ref('rooms/' + id + '/m').get()).numChildren();
    if (n > MAX_PLAYERS) {
      await fb.rtdb.ref('rooms/' + id + '/m/' + uid).remove();
      rtOff();
      return { ok: false, error: 'La sala está llena (máximo ' + MAX_PLAYERS + ').' };
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
      // El anfitrión siempre primero; el resto por orden de llegada.
      room.members = Object.keys(m).map(k => Object.assign({ uid: k }, m[k]))
        .sort((a, b) => (a.uid === room.host ? -1 : b.uid === room.host ? 1 : (a.at || 0) - (b.at || 0)));
      healMember();
      emit('room');
    }, () => closedRoom());
    const href = fb.rtdb.ref('rooms/' + id + '/host');
    href.on('value', s => { if (room && room.id === id && !s.val()) closedRoom(); }, () => closedRoom());
    const oref = fb.rtdb.ref('rooms/' + id + '/open');
    oref.on('value', s => { if (room && room.id === id) { room.open = s.val() === true; emit('room'); } }, () => {});
    // Si se corta la conexión con la base de datos, el servidor borra tu plaza (onDisconnect).
    // Al volver la conexión se vuelve a poner, para que un corte corto no te saque de la sala.
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

  /** Vuelve a ponerte en la sala tras un corte de la base de datos (si la sala sigue). */
  async function rejoinSpot(id) {
    try {
      const host = (await fb.rtdb.ref('rooms/' + id + '/host').get()).val();
      if (!host || !room || room.id !== id) return;
      const ref = fb.rtdb.ref('rooms/' + id + '/m/' + uid);
      if (!(await ref.get()).exists()) { await ref.set(memberInfo()); console.warn('[Social] plaza recuperada tras un corte'); }
      watchRoomDisconnect();        // el aviso de desconexión se gasta al saltar: se vuelve a armar
    } catch (e) { console.warn('[Social] no se pudo recuperar la plaza:', e.code || e.message); }
  }

  /** Si se cierra el navegador, la sala (anfitrión) o tu plaza (invitado) se borran solas. */
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

  /** El anfitrión cierra la sala a nuevos jugadores al empezar la partida. */
  function setOpen(open) {
    if (room && room.isHost) fb.rtdb.ref('rooms/' + room.id + '/open').set(!!open).catch(() => {});
  }

  /** Actualiza tu Pokémon en la sala (si cambias de compañero). */
  function refreshMember() {
    if (!room || !me) return Promise.resolve();
    return fb.rtdb.ref('rooms/' + room.id + '/m/' + uid).update(
      { dex: G.DB.save.partner, shiny: !!G.DB.save.partnerShiny && G.DB.ownsShiny(G.DB.save.partner) }).catch(() => {});
  }

  /**
   * Si lo que ven los demás de tu compañero no coincide con el tuyo (cambiaste de
   * Pokémon fuera de la sala, o falló la subida), se corrige solo. Sólo un intento a la
   * vez, para no repetir mientras llega la respuesta.
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
    if (!f || f.status !== 'ok') return { ok: false, error: 'Sólo puedes invitar a tus amigos.' };
    if (room && room.members.length >= MAX_PLAYERS) return { ok: false, error: 'La sala está llena.' };
    if (room && !room.isHost) return { ok: false, error: 'Sólo el anfitrión de la sala puede invitar.' };
    if (!room) await createRoom();
    try {
      await fb.fs.collection('inv').doc(other + '_' + uid).set({ to: other, from: uid, room: room.id, name: me.name, at: fts() });
    } catch (e) { return { ok: false, error: 'No se pudo invitar (' + (e.code || 'error') + ').' }; }
    sentInv.add(other);
    return { ok: true, msg: 'Invitación enviada a ' + f.name };
  }

  /** Retira las invitaciones que mandaste (al salir de la sala). */
  function retractInvites() {
    if (!fb) return;
    for (const o of sentInv) fb.fs.collection('inv').doc(o + '_' + uid).delete().catch(() => {});
    sentInv.clear();
  }

  function onInvite(ref, v) {
    // Las caducadas se borran; sólo se aceptan de amigos confirmados.
    if (!v || (v.at && now() - msOf(v.at) > INVITE_TTL)) { ref.delete().catch(() => {}); return; }
    const f = friends.get(v.from);
    if (f && f.status !== 'ok') return;
    invites.set(v.from, { from: v.from, name: v.name, room: v.room, at: msOf(v.at) || now() });
    emit('invites');
  }

  const invDoc = from => fb.fs.collection('inv').doc(uid + '_' + from);

  async function acceptInvite(from) {
    const inv = invites.get(from);
    if (!inv || now() - inv.at > INVITE_TTL) { invites.delete(from); emit('invites'); return { ok: false, error: 'La invitación ha caducado.' }; }
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

  // ---------------- perfil público ----------------

  /** Lo que se enseña de ti (también para tu vista previa, sin subirlo). */
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
   * Sube tu perfil (con un poco de espera, por si cambias varias cosas
   * seguidas), pero SÓLO si ha cambiado algo de lo que se ve a primera vista:
   * récords de tiempo y nivel, legendarios, medallas, título o favoritos.
   * Los jefes y derrotados (que cambian en cada partida) se suben con lo demás
   * cuando toca, no por sí solos: el perfil se escribía 200.000 veces al día
   * (13-10-2026). Si cambias favoritos o título (force), al momento.
   */
  function publishProfile(force = false) {
    if (!me || !fb) return;
    if (!force && Date.now() - pubAt < 2 * 3600 * 1000) return;    // como mucho cada 2 h (era 30 min)
    clearTimeout(pubT);
    pubT = setTimeout(() => {
      if (!me || !fb) return;
      const d = profileData();
      // Para decidir si se sube (se recuerda entre sesiones): sin jefes ni derrotados.
      const key = JSON.stringify(Object.assign({}, d, { best: Object.assign({}, d.best, { kills: 0, bosses: 0 }) }));
      const lsKey = 'ps.pub.' + uid;
      if (!pubLast) { try { pubLast = localStorage.getItem(lsKey) || ''; } catch (e) { /* nada */ } }
      if (key === pubLast) return;
      pubLast = key; pubAt = Date.now();
      try { localStorage.setItem(lsKey, key); } catch (e) { /* nada */ }
      fb.fs.collection('profiles').doc(uid).set(Object.assign(d, {
        name: me.name, lower: me.name.toLowerCase(), at: firebase.firestore.FieldValue.serverTimestamp()
      })).catch(e => { pubLast = ''; console.warn('[Social] perfil:', e.code || e.message); });
    }, 800);
  }

  /** El perfil público de otro jugador. */
  const profCache = new Map();
  async function getProfile(other) {
    if (!fb) return null;
    // El tuyo sale de tu partida (sin leer nada y siempre al día).
    if (other === uid && me) return Object.assign(profileData(), { name: me.name });
    const c = profCache.get(other);
    if (c && Date.now() - c.at < 10 * 60 * 1000) return c.v;     // lo leído vale 10 min
    const d = await fb.fs.collection('profiles').doc(other).get().catch(() => null);
    const v = d && d.exists ? d.data() : null;
    profCache.set(other, { at: Date.now(), v });
    return v;
  }

  // Al cerrar sesión o borrar la cuenta.
  G.DB.onLeave(why => stop(why));

  return {
    start, stop, claimNick, request, accept, remove, publishProfile, getProfile, profileData,
    createRoom, joinRoom, leaveRoom, setOpen, refreshMember, setPlaying, setActivity, touch, refreshPresence,
    invite, acceptInvite, declineInvite,
    on(fn) { listeners.add(fn); }, off(fn) { listeners.delete(fn); },
    get me() { return me; },
    get started() { return started; },
    get friends() { return [...friends.values()]; },
    get invites() { return [...invites.values()]; },
    get room() { return room; },
    get uid() { return uid; },
    /** La hora real (corrige el reloj del aparato si va desfasado). */
    now,
    VALID, MAX_PLAYERS
  };
})();
