/* ============ net.js — conexión entre los jugadores de una sala ============
 * Topología en estrella: el ANFITRIÓN habla con cada invitado; los invitados
 * sólo hablan con el anfitrión (él reenvía lo que haga falta).
 *
 * Dos caminos, a la vez:
 *   directo  WebRTC (canal de datos entre navegadores, sin pasar por ningún
 *            servidor). La negociación (señalización) va por la base de datos.
 *            Sólo con STUN gratuito de Google: si la red no deja conectar
 *            directo (algunos routers y datos móviles), esa pareja no puede
 *            jugar junta. El TURN de Cloudflare se QUITÓ el 15-10-2026 (de pago).
 *   relé     (APAGADO) los mensajes irían por la Realtime Database:
 *            rooms/{sala}/q/{destinatario}/{id}, a 1 $ el GB.
 *
 * Se envía por el canal directo si está abierto; si no, por el relé. El que
 * recibe escucha los dos, así que no hace falta ponerse de acuerdo.
 *
 * API:  open(roomId, isHost, hostUid) · close() · send(to, msg) · toHost(msg)
 *       broadcast(msg) · on(fn(from, msg)) · onPeer(fn(uid, state))
 *       peers() · mode(uid) -> 'connecting' | 'direct' | 'relay' | 'closed'
 */
G.Net = (() => {
  const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  const DIRECT_TIMEOUT = 9000;     // ms para conseguir canal directo antes de usar el relé
  // Relé por la Realtime Database APAGADO (12-10-2026): a 1 $ el GB era lo que más
  // costaba del cooperativo. Sin conexión directa, esa pareja no puede jugar
  // junta ('failed') y el anfitrión lo reintenta cada RETRY_MS. Por la base de datos
  // sólo pasa la señalización (unos pocos mensajes pequeños para conectarse).
  const ALLOW_RELAY = false, RETRY_MS = 15000;


  // Si una conexión directa que ya iba bien se cae, se intenta rehacer durante este
  // tiempo antes de dar a esa persona por perdida (un corte de wifi de unos segundos
  // ya no te echa de la partida).
  const RECOVER_MS = 25000, DISCONNECT_GRACE = 8000;
  const recover = new Map();       // uid -> hora límite para recuperar la conexión
  let members = null;              // uids que hay ahora en la sala (según la base de datos)

  // Registro de por qué se cae la gente (consola + localStorage 'megamon_netlog').
  const history = [];
  function note(ev, u, extra) {
    const r = { t: new Date().toISOString().slice(11, 19), ev, u: u ? String(u).slice(0, 6) : '', x: extra || '' };
    history.push(r); if (history.length > 40) history.shift();
    console.warn('[Net]', r.t, ev, r.u, r.x);
    try { localStorage.setItem('megamon_netlog', JSON.stringify(history)); } catch (e) { /* nada */ }
  }

  let rtdb = null, uid = null, roomId = null, isHost = false, hostUid = null;
  let qref = null;
  const peers = new Map();         // uid -> { pc, dc, mode, timer }
  const handlers = new Set(), peerHandlers = new Set();
  let stats = { sent: 0, recv: 0, relaySent: 0 };

  function emitPeer(u) {
    const p = peers.get(u);
    peerHandlers.forEach(fn => { try { fn(u, p ? p.mode : 'closed'); } catch (e) { console.warn(e); } });
  }

  // ---------------- apertura ----------------

  function open(id, host, hostId) {
    if (roomId === id) return;
    close();
    const fb = G.DB.fb;
    rtdb = fb.rtdb; uid = fb.uid;
    roomId = id; isHost = host; hostUid = hostId;
    qref = rtdb.ref('rooms/' + id + '/q/' + uid);
    qref.on('child_added', s => {
      const raw = s.val();
      s.ref.remove().catch(() => {});
      let m;
      try { m = JSON.parse(raw); } catch (e) { return; }
      if (!m || !m.f) return;
      if (m.sig) onSignal(m.f, m.sig);
      else deliver(m.f, m.d);
    });
    // Invitado: hueco para el anfitrión desde ya (se sustituye al llegar su
    // oferta). Así, si no llega nunca, se sigue por el relé y se sabe cuándo se va.
    if (!isHost) {
      const p = { pc: null, dc: null, mode: 'connecting', timer: 0 };
      p.timer = setTimeout(() => { if (p.mode === 'connecting') { p.mode = ALLOW_RELAY ? 'relay' : 'failed'; emitPeer(hostId); } }, DIRECT_TIMEOUT + 3000);
      peers.set(hostId, p);
    }
  }

  function close() {
    for (const u of [...peers.keys()]) drop(u);
    recover.clear(); members = null;
    if (qref) { qref.off(); qref = null; }
    roomId = null; isHost = false; hostUid = null;
  }

  /** El anfitrión llama a esto cuando cambian los miembros de la sala. */
  function syncMembers(uids) {
    if (!roomId) return;
    members = uids;
    if (isHost) {
      for (const u of uids) if (u !== uid && !peers.has(u)) connect(u);
      for (const u of [...peers.keys()]) {
        if (uids.includes(u)) continue;
        // Su plaza en la sala ha desaparecido (por ejemplo un corte de la base de datos),
        // pero si el canal directo sigue abierto, sigue en la partida.
        const p = peers.get(u);
        if (p && p.mode === 'direct' && p.dc && p.dc.readyState === 'open') { note('room-spot-missing (link still open)', u); continue; }
        drop(u);
      }
    } else if (!uids.includes(hostUid)) {
      drop(hostUid);
    }
  }

  // ---------------- WebRTC ----------------

  function newPeer(u) {
    const p = { pc: null, dc: null, mode: 'connecting', timer: 0 };
    peers.set(u, p);
    // Sin WebRTC (navegador antiguo o bloqueado): directamente por el relé.
    let pc;
    try { pc = p.pc = new RTCPeerConnection({ iceServers: ICE }); }
    catch (e) { p.mode = 'relay'; emitPeer(u); return p; }
    pc.onicecandidate = e => { if (e.candidate) signal(u, { c: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'connected') { clearTimeout(p.discT); return; }
      if (p.mode === 'closed' || peers.get(u) !== p) return;
      if (s === 'disconnected') {
        // Suele arreglarse solo en unos segundos; si no, se rehace la conexión.
        clearTimeout(p.discT);
        p.discT = setTimeout(() => { if (peers.get(u) === p && pc.connectionState !== 'connected') lose(u, p, 'ice-disconnected'); }, DISCONNECT_GRACE);
      } else if (s === 'failed') { clearTimeout(p.discT); lose(u, p, 'ice-failed'); }
    };
    // Si en unos segundos no hay canal directo, se sigue por el relé.
    p.timer = setTimeout(() => { if (p.mode === 'connecting') useRelay(u); }, DIRECT_TIMEOUT);
    emitPeer(u);
    return p;
  }

  function wireChannel(u, p, dc) {
    p.dc = dc;
    dc.onopen = () => { clearTimeout(p.timer); p.mode = 'direct'; p.wasDirect = true; if (recover.delete(u)) note('recovered', u); emitPeer(u); };
    dc.onclose = () => { if (p.mode === 'direct' && peers.get(u) === p) lose(u, p, 'channel-closed'); };
    dc.onmessage = e => {
      let m;
      try { m = JSON.parse(e.data); } catch (err) { return; }
      deliver(u, m);
    };
  }

  /** Una conexión que iba bien se ha caído: se intenta rehacer antes de rendirse. */
  function lose(u, p, why) {
    if (!p || p.mode === 'closed' || peers.get(u) !== p) return;
    note('lost: ' + why, u, 'wasDirect=' + !!p.wasDirect);
    const gone = isHost && members && !members.includes(u);      // se ha ido de la sala: no hay que esperarle
    if (!gone && (p.wasDirect || recover.has(u))) {
      if (!recover.has(u)) recover.set(u, Date.now() + RECOVER_MS);
      p.mode = 'connecting';
      emitPeer(u);
    }
    p.why = why;
    useRelay(u);
  }

  function useRelay(u) {
    const p = peers.get(u);
    if (!p || p.mode === 'direct' || p.mode === 'closed' || p.mode === 'failed') return;
    const dl = recover.get(u);
    if (dl && Date.now() < dl && !ALLOW_RELAY) {
      // Recuperando: el anfitrión vuelve a ofrecer la conexión (con otra llamada nueva);
      // el invitado espera esa oferta hasta el límite.
      clearTimeout(p.timer); clearTimeout(p.discT);
      try { if (p.pc) p.pc.close(); } catch (e) { /* nada */ }
      p.mode = 'connecting';
      if (isHost) p.timer = setTimeout(() => { if (peers.get(u) === p && roomId && (!members || members.includes(u))) { drop(u, true); connect(u); } else if (peers.get(u) === p) { recover.delete(u); useRelay(u); } }, 1500);
      else p.timer = setTimeout(() => { if (peers.get(u) === p && p.mode !== 'direct') useRelay(u); }, Math.max(500, dl - Date.now() + 50));
      return;
    }
    if (dl) { recover.delete(u); note('gave up recovering', u, p.why || ''); }
    if (ALLOW_RELAY) { p.mode = 'relay'; emitPeer(u); return; }
    // Sin relé: no se puede jugar con esa persona por ahora. El anfitrión reintenta.
    clearTimeout(p.timer);
    p.mode = 'failed';
    try { if (p.pc) p.pc.close(); } catch (e) { /* nada */ }
    emitPeer(u);
    if (isHost) p.timer = setTimeout(() => {
      if (peers.get(u) !== p || p.mode !== 'failed' || !roomId) return;
      if (members && !members.includes(u)) { drop(u); return; }      // ya no está en la sala
      drop(u, true); connect(u);
    }, RETRY_MS);
  }

  /** Anfitrión: abre conexión con un invitado. */
  async function connect(u) {
    if (!roomId || peers.has(u)) return;
    const p = newPeer(u);
    if (!p.pc) return;
    wireChannel(u, p, p.pc.createDataChannel('g', { ordered: true }));
    try {
      const offer = await p.pc.createOffer();
      await p.pc.setLocalDescription(offer);
      signal(u, { sdp: p.pc.localDescription.toJSON() });
    } catch (e) { useRelay(u); }
  }

  const pendingIce = new Map();     // candidatos que llegan antes que la oferta

  async function onSignal(from, sig) {
    let p = peers.get(from);
    try {
      if (sig.sdp && sig.sdp.type === 'offer') {
        if (isHost) return;
        if (p) drop(from, true);
        p = newPeer(from);
        if (!p.pc) return;
        p.pc.ondatachannel = e => wireChannel(from, p, e.channel);
        await p.pc.setRemoteDescription(sig.sdp);
        const ans = await p.pc.createAnswer();
        await p.pc.setLocalDescription(ans);
        signal(from, { sdp: p.pc.localDescription.toJSON() });
        for (const c of pendingIce.get(from) || []) await p.pc.addIceCandidate(c).catch(() => {});
        pendingIce.delete(from);
      } else if (sig.sdp && sig.sdp.type === 'answer') {
        if (p && p.pc) await p.pc.setRemoteDescription(sig.sdp);
      } else if (sig.c) {
        if (p && p.pc && p.pc.remoteDescription) await p.pc.addIceCandidate(sig.c).catch(() => {});
        else { if (!pendingIce.has(from)) pendingIce.set(from, []); pendingIce.get(from).push(sig.c); }
      }
    } catch (e) {
      console.warn('[Net] señalización:', e.message);
      useRelay(from);
    }
  }

  function signal(to, sig) { relayPush(to, { f: uid, sig }); }

  function drop(u, silent) {
    const p = peers.get(u);
    if (!p) return;
    clearTimeout(p.timer);
    p.mode = 'closed';
    try { if (p.dc) p.dc.close(); } catch (e) { /* nada */ }
    try { if (p.pc) p.pc.close(); } catch (e) { /* nada */ }
    peers.delete(u);
    if (!silent) emitPeer(u);
  }

  // ---------------- envío / recepción ----------------

  function relayPush(to, env) {
    if (!rtdb || !roomId) return;
    rtdb.ref('rooms/' + roomId + '/q/' + to).push(JSON.stringify(env)).catch(e => console.warn('[Net] relé:', e.code || e.message));
  }

  function send(to, msg) {
    if (!roomId) return;
    const p = peers.get(to);
    stats.sent++;
    if (p && p.dc && p.dc.readyState === 'open') {
      try { p.dc.send(JSON.stringify(msg)); return; } catch (e) { /* cae al relé */ }
    }
    // Sin relé, los datos de la partida no van por la base de datos (se pierden: esa
    // pareja no está conectada). Sólo pasa el aviso de empezar.
    if (!ALLOW_RELAY && !(msg && msg.k === 'start')) return;
    stats.relaySent++;
    relayPush(to, { f: uid, d: msg });
  }

  function toHost(msg) { if (!isHost && hostUid) send(hostUid, msg); }
  function broadcast(msg, except) { for (const u of peers.keys()) if (u !== except) send(u, msg); }

  function deliver(from, msg) {
    stats.recv++;
    handlers.forEach(fn => { try { fn(from, msg); } catch (e) { console.error('[Net] mensaje:', e); } });
  }

  return {
    open, close, syncMembers, send, toHost, broadcast,
    on(fn) { handlers.add(fn); }, off(fn) { handlers.delete(fn); },
    onPeer(fn) { peerHandlers.add(fn); },
    mode(u) { const p = peers.get(u); return p ? p.mode : 'closed'; },
    /** ¿Va por el relé (o no hay conexión)? Entonces se manda menos a menudo. */
    slow(u) { const p = peers.get(u); return !p || p.mode !== 'direct'; },
    peers() { return [...peers.keys()]; },
    get open_() { return !!roomId; },
    get isHost() { return isHost; },
    get uid() { return uid; },
    get hostUid() { return hostUid; },
    stats, history,
    /** Motivo de la última caída de `u` (para avisar al jugador). */
    why(u) { const p = peers.get(u); return p && p.why || ''; }
  };
})();
