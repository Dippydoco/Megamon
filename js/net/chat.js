/* ============ chat.js — chat con amigos y chat de sala ============
 * Dos chats distintos:
 *
 *   Chat de sala   Por el mismo canal directo (WebRTC) de la sala / partida en grupo.
 *                  No se guarda en ningún sitio: al cerrar la sala desaparece. Va por
 *                  el anfitrión: el invitado se lo manda y él lo reparte.
 *   Chat privado   Firestore  chats/{uidA_uidB}  { users, msgs: [{ f, t, at }], seen: { uid: ms } }
 *                  Un único documento por pareja de amigos con sus últimos 25 mensajes
 *                  (los viejos se tiran al llegar los nuevos), así que no crece nunca.
 *                  Una sola escucha (consulta por tus chats) para todos los amigos y sólo
 *                  se pone en marcha cuando ya tienes algún amigo. `seen` guarda hasta
 *                  dónde leyó cada uno (los "sin leer").
 *
 * Silenciar a un amigo se guarda en este navegador (no sube nada).
 * Los textos se muestran siempre como texto (nunca como HTML).
 */
G.Chat = (() => {
  const MAX_LEN = 140;                  // caracteres por mensaje
  const DM_KEEP = 25;                   // mensajes que se guardan por pareja
  const ROOM_KEEP = 60;                 // mensajes de sala que se recuerdan (sólo en memoria)
  const DM_GAP = 1200, ROOM_GAP = 700;  // ms mínimos entre dos mensajes tuyos

  const listeners = new Set();
  const emit = (what, a, b) => listeners.forEach(fn => { try { fn(what, a, b); } catch (e) { console.warn(e); } });

  // Control and invisible/line-separator characters (built as a string so the minifier can't turn the escapes into raw characters).
  const BAD = new RegExp('[\\u0000-\\u001f\\u007f\\u200b-\\u200f\\u2028-\\u202e]', 'g');

  /** Limpia un texto: sin saltos ni caracteres de control, espacios juntos, tope de largo. */
  function clean(t) {
    return String(t == null ? '' : t).replace(BAD, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
  }

  // ---------------- silenciados (sólo en este navegador) ----------------

  let muted = null;
  const mKey = () => 'ps.mute.' + (G.Social.uid || '');
  function loadMuted() {
    if (muted) return muted;
    muted = new Set();
    try { for (const u of JSON.parse(localStorage.getItem(mKey()) || '[]')) muted.add(u); } catch (e) { /* nada */ }
    return muted;
  }
  const isMuted = u => loadMuted().has(u);
  function setMuted(u, on) {
    const m = loadMuted();
    if (on) m.add(u); else m.delete(u);
    try { localStorage.setItem(mKey(), JSON.stringify([...m])); } catch (e) { /* nada */ }
    emit('mute', u);
  }

  // ---------------- chat de sala ----------------

  let roomLog = [];                     // { u, name, t, at }
  let lastRoomSend = 0;

  function nameOf(u) {
    const room = G.Social.room;
    const m = room && room.members.find(x => x.uid === u);
    if (m) return m.name;
    const f = G.Social.friends.find(x => x.uid === u);
    return f ? f.name : '???';
  }

  function addRoom(u, text) {
    text = clean(text);
    if (!text) return null;
    const line = { u, name: u === G.Social.uid ? (G.Social.me ? G.Social.me.name : 'You') : nameOf(u), t: text, at: Date.now() };
    roomLog.push(line);
    if (roomLog.length > ROOM_KEEP) roomLog.shift();
    emit('room', line);
    return line;
  }

  /** Mandas un mensaje a tu sala. → { ok } | { ok:false, error } */
  function sendRoom(text) {
    const room = G.Social.room;
    text = clean(text);
    if (!room) return { ok: false, error: 'You are not in a room.' };
    if (!text) return { ok: false, error: '' };
    if (Date.now() - lastRoomSend < ROOM_GAP) return { ok: false, error: 'Slow down a little.' };
    lastRoomSend = Date.now();
    addRoom(G.Social.uid, text);
    if (G.Net.isHost) G.Net.broadcast({ k: 'ch', u: G.Social.uid, t: text });
    else G.Net.toHost({ k: 'ch', t: text });
    return { ok: true };
  }

  function onNet(from, msg) {
    if (!msg || msg.k !== 'ch' || typeof msg.t !== 'string') return;
    const room = G.Social.room;
    if (!room) return;
    if (G.Net.isHost) {
      // Un invitado te escribe: se reparte a los demás (con su uid de verdad: el del canal).
      if (!room.members.some(m => m.uid === from)) return;
      const text = clean(msg.t);
      if (!text) return;
      if (!isMuted(from)) addRoom(from, text);      // (silenciado: no lo ves, pero se reparte a los demás)
      G.Net.broadcast({ k: 'ch', u: from, t: text }, from);
    } else if (from === room.host && typeof msg.u === 'string' && msg.u !== G.Social.uid) {
      if (isMuted(msg.u)) return;
      addRoom(msg.u, msg.t);
    }
  }
  G.Net.on(onNet);

  G.Social.on(what => {
    if (!G.Social.room && roomLog.length) { roomLog = []; emit('room'); }
    if (what === 'friends') maybeListen();
    if (what === 'stop') teardown();
  });

  // ---------------- chat privado ----------------

  const chats = new Map();              // otherUid -> { msgs, seen }
  let unsub = null;
  let lastDmSend = 0;
  const pidOf = (a, b) => (a < b ? a + '_' + b : b + '_' + a);

  const hasFriends = () => G.Social.friends.some(f => f.status === 'ok');

  function maybeListen() {
    if (unsub || !G.Social.started || !G.DB.fb || !G.Social.me || !hasFriends()) return;
    const uid = G.Social.uid;
    let first = true;                     // the first batch is what was already there: nothing is "new"
    unsub = G.DB.fb.fs.collection('chats').where('users', 'array-contains', uid).onSnapshot(snap => {
      const initial = first; first = false;
      snap.docChanges().forEach(ch => {
        const d = ch.doc.data();
        const other = d.users[0] === uid ? d.users[1] : d.users[0];
        if (ch.type === 'removed') { chats.delete(other); emit('dm', other); return; }
        const prev = chats.get(other);
        const msgs = Array.isArray(d.msgs) ? d.msgs : [];
        const seen = +((d.seen || {})[uid]) || 0;
        // El "visto" que acabas de marcar aquí no se pisa con uno más viejo del servidor.
        chats.set(other, { msgs, seen: Math.max(seen, prev ? prev.seen : 0) });
        emit('dm', other);
        const last = msgs[msgs.length - 1];
        const had = prev ? prev.msgs.length : -1;
        if (!initial && last && last.f === other && (!prev || msgs.length !== had || last.at !== (prev.msgs[had - 1] || {}).at)) emit('dm-new', other, last);
      });
    }, e => console.warn('[Chat] chats:', e.code || e.message));
  }

  function teardown() {
    if (unsub) { unsub(); unsub = null; }
    chats.clear(); muted = null; roomLog = [];
    emit('dm'); emit('room');
  }

  /** Mensajes de un amigo (los últimos 25, antiguos primero). */
  const history = other => (chats.get(other) || { msgs: [] }).msgs;

  /** Mensajes sin leer de un amigo (los silenciados no cuentan). */
  function unread(other) {
    if (isMuted(other)) return 0;
    const c = chats.get(other);
    return c ? c.msgs.filter(m => m.f === other && m.at > c.seen).length : 0;
  }
  const totalUnread = () => G.Social.friends.reduce((n, f) => n + (f.status === 'ok' ? unread(f.uid) : 0), 0);

  async function send(other, text) {
    const f = G.Social.friends.find(x => x.uid === other);
    if (!f || f.status !== 'ok') return { ok: false, error: 'You can only chat with your friends.' };
    text = clean(text);
    if (!text) return { ok: false, error: '' };
    if (Date.now() - lastDmSend < DM_GAP) return { ok: false, error: 'Slow down a little.' };
    lastDmSend = Date.now();
    const uid = G.Social.uid, fs = G.DB.fb.fs;
    const ref = fs.collection('chats').doc(pidOf(uid, other));
    const msg = { f: uid, t: text, at: Math.round(G.Social.now()) };
    try {
      await fs.runTransaction(async tx => {
        const s = await tx.get(ref);
        const d = s.exists ? s.data() : { users: [uid, other].sort(), msgs: [], seen: {} };
        const msgs = (Array.isArray(d.msgs) ? d.msgs : []).concat([msg]).slice(-DM_KEEP);
        tx.set(ref, { users: d.users, msgs, seen: Object.assign({}, d.seen || {}, { [uid]: msg.at }) });
      });
    } catch (e) { return { ok: false, error: 'Could not send (' + (e.code || 'error') + ').' }; }
    return { ok: true };
  }

  /** Marca como leído lo que ha escrito ese amigo (una escritura, y sólo si había algo). */
  async function markRead(other) {
    const c = chats.get(other);
    if (!c) return;
    const last = c.msgs[c.msgs.length - 1];
    if (!last || last.f !== other || last.at <= c.seen) return;
    c.seen = last.at;
    emit('dm', other);
    const uid = G.Social.uid;
    try { await G.DB.fb.fs.collection('chats').doc(pidOf(uid, other)).update({ ['seen.' + uid]: last.at }); }
    catch (e) { console.warn('[Chat] visto:', e.code || e.message); }
  }

  /** Al quitar un amigo (o borrar la cuenta) se borra también su conversación. */
  async function purge(other) {
    chats.delete(other);
    try { await G.DB.fb.fs.collection('chats').doc(pidOf(G.Social.uid, other)).delete(); } catch (e) { /* no había */ }
    emit('dm', other);
  }

  return {
    MAX_LEN, DM_KEEP, clean, isMuted, setMuted,
    sendRoom, roomLog: () => roomLog,
    send, markRead, purge, history, unread, totalUnread, listen: maybeListen, onNet,
    on(fn) { listeners.add(fn); }, off(fn) { listeners.delete(fn); }
  };
})();
