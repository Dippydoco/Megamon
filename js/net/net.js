/* ============ net.js — connection between the players in a room ============
 * Star topology: the HOST talks to each guest; guests
 * only talk to the host (it forwards whatever is needed).
 *
 * Two paths, at the same time:
 *   direct   WebRTC (data channel between browsers, without going through any
 *            server). The negotiation (signalling) goes through the database.
 *            Only with Google's free STUN: if the network doesn't allow a direct
 *            connection (some routers and mobile data), that pair can't
 *            play together. Cloudflare's TURN was REMOVED on 15-10-2026 (paid).
 *   relay    (OFF) messages would go through the Realtime Database:
 *            rooms/{room}/q/{recipient}/{id}, at $1 per GB.
 *
 * It sends over the direct channel if it's open; if not, over the relay. The
 * receiver listens to both, so there's no need to agree.
 *
 * API:  open(roomId, isHost, hostUid) · close() · send(to, msg) · toHost(msg)
 *       broadcast(msg) · on(fn(from, msg)) · onPeer(fn(uid, state))
 *       peers() · mode(uid) -> 'connecting' | 'direct' | 'relay' | 'closed'
 */
G.Net = (() => {
  const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  const DIRECT_TIMEOUT = 9000;     // ms to get a direct channel before using the relay
  // Relay through the Realtime Database turned ON again in Megamon (17-10-2026): the project is on the
  // free plan (Spark), so it costs nothing, and without it two players on the same wifi (or with
  // routers that don't allow the direct connection) couldn't play together. It's only used if the direct
  // channel can't be established; if it's established later, it switches to it. (The original turned it off: at $1 per GB.)
  // If the project moves to a paid plan, check the Realtime Database spending.
  const ALLOW_RELAY = true, RETRY_MS = 15000;


  // If a direct connection that was working drops, it tries to rebuild it during this
  // time before giving that person up for lost (a wifi drop of a few seconds
  // no longer kicks you out of the run).
  const RECOVER_MS = 25000, DISCONNECT_GRACE = 8000;
  const recover = new Map();       // uid -> deadline for recovering the connection
  let members = null;              // uids currently in the room (according to the database)

  // Log of why people drop (console + localStorage 'megamon_netlog').
  const history = [];
  function note(ev, u, extra) {
    const r = { t: new Date().toISOString().slice(11, 19), ev, u: u ? String(u).slice(0, 6) : '', x: extra || '' };
    history.push(r); if (history.length > 40) history.shift();
    console.warn('[Net]', r.t, ev, r.u, r.x);
    try { localStorage.setItem('megamon_netlog', JSON.stringify(history)); } catch (e) { /* nothing */ }
  }

  let rtdb = null, uid = null, roomId = null, isHost = false, hostUid = null;
  let qref = null;
  const peers = new Map();         // uid -> { pc, dc, mode, timer }
  const handlers = new Set(), peerHandlers = new Set();
  let stats = { sent: 0, recv: 0, relaySent: 0 };

  // ---- Connection diagnostics (lobby > "Connection details") ----
  // Per other player: which kinds of network addresses each side found, signalling counts, ICE state.
  const diags = new Map();          // uid -> { tries, loc:{}, rem:{}, sigOut, sigIn, ice, gather, err:[], at }
  const dbErrors = [];              // problems writing the signalling messages to the database
  function diagOf(u) {
    let d = diags.get(u);
    if (!d) { d = { tries: 0, loc: {}, rem: {}, sigOut: 0, sigIn: 0, ice: '-', gather: '-', err: [] }; diags.set(u, d); }
    return d;
  }
  // 'host' addresses ending in .local are Chrome's privacy names (mDNS): they only work if both PCs can answer mDNS on the LAN.
  function candKind(line) {
    const m = /typ (host|srflx|prflx|relay)/.exec(line || '');
    if (!m) return 'other';
    if (m[1] === 'host') return /\.local /.test(line) ? 'host(mDNS)' : 'host(ip)';
    return m[1];
  }

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
    // Guest: a slot for the host from now on (replaced when its
    // offer arrives). That way, if it never arrives, it carries on over the relay and we know when it leaves.
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

  /** The host calls this when the room's members change. */
  function syncMembers(uids) {
    if (!roomId) return;
    members = uids;
    if (isHost) {
      for (const u of uids) if (u !== uid && !peers.has(u)) connect(u);
      for (const u of [...peers.keys()]) {
        if (uids.includes(u)) continue;
        // Their place in the room has disappeared (for example a database outage),
        // but if the direct channel is still open, they stay in the run.
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
    const dg = diagOf(u);
    dg.tries++; dg.loc = {}; dg.rem = {}; dg.sigOut = 0; dg.sigIn = 0; dg.ice = '-'; dg.gather = '-'; dg.err = []; dg.at = Date.now();
    // No WebRTC (old or blocked browser): straight over the relay.
    let pc;
    try { pc = p.pc = new RTCPeerConnection({ iceServers: ICE }); }
    catch (e) { p.mode = 'relay'; emitPeer(u); return p; }
    pc.onicecandidate = e => {
      if (e.candidate) { const k = candKind(e.candidate.candidate); dg.loc[k] = (dg.loc[k] || 0) + 1; signal(u, { c: e.candidate.toJSON() }); }
    };
    pc.oniceconnectionstatechange = () => { dg.ice = pc.iceConnectionState; };
    pc.onicegatheringstatechange = () => { dg.gather = pc.iceGatheringState; };
    pc.onicecandidateerror = e => { if (dg.err.length < 4) dg.err.push((e.errorCode || '?') + ' ' + String(e.url || '').slice(0, 40)); };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'connected') { clearTimeout(p.discT); return; }
      if (p.mode === 'closed' || peers.get(u) !== p) return;
      if (s === 'disconnected') {
        // It usually fixes itself in a few seconds; if not, the connection is rebuilt.
        clearTimeout(p.discT);
        p.discT = setTimeout(() => { if (peers.get(u) === p && pc.connectionState !== 'connected') lose(u, p, 'ice-disconnected'); }, DISCONNECT_GRACE);
      } else if (s === 'failed') { clearTimeout(p.discT); lose(u, p, 'ice-failed'); }
    };
    // If there's no direct channel within a few seconds, it carries on over the relay.
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

  /** A connection that was working has dropped: try to rebuild it before giving up. */
  function lose(u, p, why) {
    if (!p || p.mode === 'closed' || peers.get(u) !== p) return;
    note('lost: ' + why, u, 'wasDirect=' + !!p.wasDirect);
    const gone = isHost && members && !members.includes(u);      // they've left the room: no need to wait for them
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
      // Recovering: the host offers the connection again (with a new call);
      // the guest waits for that offer until the deadline.
      clearTimeout(p.timer); clearTimeout(p.discT);
      try { if (p.pc) p.pc.close(); } catch (e) { /* nothing */ }
      p.mode = 'connecting';
      if (isHost) p.timer = setTimeout(() => { if (peers.get(u) === p && roomId && (!members || members.includes(u))) { drop(u, true); connect(u); } else if (peers.get(u) === p) { recover.delete(u); useRelay(u); } }, 1500);
      else p.timer = setTimeout(() => { if (peers.get(u) === p && p.mode !== 'direct') useRelay(u); }, Math.max(500, dl - Date.now() + 50));
      return;
    }
    if (dl) { recover.delete(u); note('gave up recovering', u, p.why || ''); }
    if (ALLOW_RELAY) { p.mode = 'relay'; emitPeer(u); return; }
    // No relay: you can't play with that person for now. The host retries.
    clearTimeout(p.timer);
    p.mode = 'failed';
    try { if (p.pc) p.pc.close(); } catch (e) { /* nothing */ }
    emitPeer(u);
    if (isHost) p.timer = setTimeout(() => {
      if (peers.get(u) !== p || p.mode !== 'failed' || !roomId) return;
      if (members && !members.includes(u)) { drop(u); return; }      // no longer in the room
      drop(u, true); connect(u);
    }, RETRY_MS);
  }

  /** Host: opens a connection with a guest. */
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

  const pendingIce = new Map();     // candidates arriving before the offer

  async function onSignal(from, sig) {
    let p = peers.get(from);
    try {
      if (sig.sdp) diagOf(from).sigIn++;
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
        const k = candKind(sig.c.candidate), dg = diagOf(from);
        dg.rem[k] = (dg.rem[k] || 0) + 1;
        if (p && p.pc && p.pc.remoteDescription) await p.pc.addIceCandidate(sig.c).catch(() => {});
        else { if (!pendingIce.has(from)) pendingIce.set(from, []); pendingIce.get(from).push(sig.c); }
      }
    } catch (e) {
      console.warn('[Net] signalling:', e.message);
      useRelay(from);
    }
  }

  function signal(to, sig) { diagOf(to).sigOut++; relayPush(to, { f: uid, sig }); }

  function drop(u, silent) {
    const p = peers.get(u);
    if (!p) return;
    clearTimeout(p.timer);
    p.mode = 'closed';
    try { if (p.dc) p.dc.close(); } catch (e) { /* nothing */ }
    try { if (p.pc) p.pc.close(); } catch (e) { /* nothing */ }
    peers.delete(u);
    if (!silent) emitPeer(u);
  }

  // ---------------- send / receive ----------------

  function relayPush(to, env) {
    if (!rtdb || !roomId) return;
    rtdb.ref('rooms/' + roomId + '/q/' + to).push(JSON.stringify(env)).catch(e => { console.warn('[Net] relay:', e.code || e.message); if (dbErrors.length < 5) dbErrors.push(e.code || e.message); });
  }

  function send(to, msg) {
    if (!roomId) return;
    const p = peers.get(to);
    stats.sent++;
    if (p && p.dc && p.dc.readyState === 'open') {
      try { p.dc.send(JSON.stringify(msg)); return; } catch (e) { /* falls back to the relay */ }
    }
    // Without the relay, the run's data doesn't go through the database (it's lost: that
    // pair isn't connected). Only the start notice goes through.
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

  /**
   * Plain-text report of why a connection is (not) working, with a guess at the cause.
   * `names`: uid -> nickname. Nothing private: only kinds of addresses (never the addresses), counts and states.
   */
  function report(names = {}) {
    const L = [];
    const kinds = o => Object.keys(o).map(k => k + '×' + o[k]).join(', ') || 'none';
    L.push('Megamon connection report · ' + new Date().toISOString());
    L.push('Game: ' + G.UI.buildLabel());
    L.push('Browser: ' + navigator.userAgent);
    L.push('Room open: ' + !!roomId + ' · you are ' + (isHost ? 'host' : 'guest') + ' · WebRTC: ' + (typeof RTCPeerConnection !== 'undefined'));
    L.push('Messages: sent ' + stats.sent + ', received ' + stats.recv + (dbErrors.length ? ' · database errors: ' + dbErrors.join(', ') : ''));
    for (const [u, p] of peers) {
      const d = diagOf(u);
      L.push('');
      L.push('Player ' + (names[u] || String(u).slice(0, 6)) + ': ' + p.mode + (p.why ? ' (' + p.why + ')' : '') + ' · attempts ' + d.tries);
      L.push('  your addresses found: ' + kinds(d.loc));
      L.push('  their addresses seen: ' + kinds(d.rem));
      L.push('  setup messages sent ' + d.sigOut + ' / received ' + d.sigIn + ' · ICE ' + d.ice + ' · gathering ' + d.gather + (d.err.length ? ' · STUN errors: ' + d.err.join('; ') : ''));
      // Guess
      let why = '';
      if (p.mode === 'direct') why = 'Connected fine.';
      else if (dbErrors.length) why = 'The database refused the setup messages (' + dbErrors[0] + '): check the Realtime Database rules.';
      else if (!d.sigIn) why = 'Nothing arrived from the other player: they may not have joined properly, or the database is not delivering messages.';
      else if (!d.loc.srflx && !d.loc['host(ip)']) why = 'Your browser found no public address: STUN (stun.l.google.com) looks blocked on your network/browser.';
      else if (!d.rem.srflx && !d.rem['host(ip)'] && d.rem['host(mDNS)']) why = 'Their side only offered private mDNS names and no public address. Same-network play needs mDNS to work (Windows: set the network to Private, allow the browser in the firewall; no VPN; no Wi-Fi client isolation).';
      else why = 'Both sides found addresses but could not reach each other. On the same home network this is usually router hairpinning plus blocked mDNS. A relay (TURN or the database fallback) fixes it.';
      L.push('  likely cause: ' + why);
    }
    const log = history.slice(-10).map(r => r.t + ' ' + r.ev + ' ' + r.u + ' ' + r.x);
    if (log.length) { L.push(''); L.push('Recent events:'); L.push(...log.map(x => '  ' + x)); }
    return L.join('\n');
  }

  return {
    report, open, close, syncMembers, send, toHost, broadcast,
    on(fn) { handlers.add(fn); }, off(fn) { handlers.delete(fn); },
    onPeer(fn) { peerHandlers.add(fn); },
    mode(u) { const p = peers.get(u); return p ? p.mode : 'closed'; },
    /** Is it going over the relay (or is there no connection)? Then it's sent less often. */
    slow(u) { const p = peers.get(u); return !p || p.mode !== 'direct'; },
    peers() { return [...peers.keys()]; },
    get open_() { return !!roomId; },
    get isHost() { return isHost; },
    get uid() { return uid; },
    get hostUid() { return hostUid; },
    stats, history,
    /** Reason for `u`'s last drop (to tell the player). */
    why(u) { const p = peers.get(u); return p && p.why || ''; }
  };
})();
