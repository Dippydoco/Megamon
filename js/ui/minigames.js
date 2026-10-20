/* ============ minigames.js — Mini-Games: Gacha Battle and Draft Night ============
 * Both are played inside a friends room (net/social.js), so they need no new servers or rules:
 *   - the host writes the shared state to rooms/{id}/g  (G.Social.setGame)
 *   - each player writes their own answer to rooms/{id}/m/{uid}/...  (G.Social.setMine)
 * Everyone in the room listens to both, so all screens move together.
 *
 * GACHA BATTLE  g = { type:'gb', id, stake, phase:'join'|'roll', host seed `hs`, seed, players:[uid], startAt }
 *   Each player who joins stakes `stake` ×1 tickets (m/{uid}/gb = { id, s: their seed }). When the host
 *   starts, everybody's pulls come from one shared seed, so every screen shows the same pulls, revealed
 *   card by card at the same moment (startAt, server time). Everyone keeps what they pull, as with a normal
 *   pull (no pity). The winner (highest score) also wins the other players' stakes as tickets.
 *   Score: ★1 1 · ★2 3 · ★3 8 · ★4 25 · ★5 100 points, shiny ×3. Ties: best single pull, then a seeded coin flip.
 *   At most DAILY battles a day per player (save.gb).
 *
 * DRAFT NIGHT   g = { type:'draft', id, pool:[dex], order:[uid], picks:{uid:dex}, turn, turnAt, phase:'pick'|'done' }
 *   The host deals a pool of 3 Pokémon per player; players pick one each in a random order (TURN s each,
 *   then a random pick). The next group run uses the drafted Pokémon (game.js startRun, cfg.draft).
 */
G.MiniUI = (() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const STAKES = [1, 3, 5];
  const DAILY = 3;
  const POINTS = { 1: 1, 2: 3, 3: 8, 4: 25, 5: 100 };
  const REVEAL_MS = 1100, LEAD_MS = 2500;      // one card per player every REVEAL_MS, starting LEAD_MS after the host starts
  const TURN = 25;                              // seconds per draft pick

  // ---------------- seeded randomness (identical on every device) ----------------
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seedStr) {
    let a = hash(seedStr);
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pickR = (r, list) => list[Math.floor(r() * list.length)];

  const room = () => G.Social.room;
  const game = () => (room() && room().game) || null;
  const meUid = () => G.Social.uid;
  const nameOf = uid => ((room() && room().members.find(m => m.uid === uid)) || {}).name || 'Someone';
  const mineOf = (uid, key) => ((room() && room().members.find(m => m.uid === uid)) || {})[key];
  const now = () => G.Social.now();
  // Sprites go in as placeholders (a canvas's drawing is lost in innerHTML) and are filled in afterwards.
  const spr = (dex, w, h, shiny) => `<i class="mg-spr" data-d="${dex}" data-w="${w}" data-h="${h}"${shiny ? ' data-s="1"' : ''}></i>`;
  function fillSprites(root) {
    for (const el of root.querySelectorAll('i.mg-spr')) {
      el.replaceWith(G.UI.spriteCanvas(+el.dataset.d, +el.dataset.w, +el.dataset.h, { scale: +el.dataset.w > 60 ? 2 : 1, shiny: el.dataset.s === '1' }));
    }
  }

  // ================= Mini-Games screen (main menu) =================
  function open() {
    if (!G.SocialUI.needOnline()) return;
    if (!G.Social.started) G.Social.start();
    G.UI.show('scr-mini', true);
    const inRoom = !!room();
    $('mini-room').textContent = inRoom ? 'Go to your room' : 'Open a room';
    $('mini-room').onclick = async () => {
      if (!G.Social.me) { G.UI.toast('Choose a nickname first (in Friends)'); return; }
      if (!room()) await G.Social.createRoom();
      G.LobbyUI.open();
    };
  }

  // ================= Gacha Battle =================
  function gbState() {
    const s = G.DB.save;
    const day = new Date().toISOString().slice(0, 10);
    s.gb = s.gb && typeof s.gb === 'object' ? s.gb : {};
    if (s.gb.day !== day) { s.gb.day = day; s.gb.n = 0; s.gb.done = {}; }
    s.gb.done = s.gb.done || {};
    return s.gb;
  }
  const battlesLeft = () => Math.max(0, DAILY - (gbState().n || 0));

  /** Host: opens a battle for everyone in the room. */
  function hostBattle(stake) {
    const r = room();
    if (!r || !r.isHost || game()) return;
    G.Social.setGame({ type: 'gb', id: Date.now().toString(36), stake, phase: 'join', hs: Math.floor(Math.random() * 1e9) });
  }

  /** Every pull of one player, from the shared seed. Like a "surprise me" pull: a random region per pull. */
  function pullsFor(g, uid) {
    const r = rng(g.seed + ':' + uid);
    const total = G.Gacha.RATES.reduce((a, [, w]) => a + w, 0);
    const out = [];
    for (let i = 0; i < g.stake; i++) {
      let x = r() * total, want = 1;
      for (const [rr, w] of G.Gacha.RATES) { x -= w; if (x <= 0) { want = rr; break; } }
      const gen = pickR(r, G.Gacha.BANNERS).gen;
      let rarity = want, list = [];
      for (const d of [0, -1, 1, -2, 2, -3, 3]) {
        const rr = want + d;
        if (rr < 1 || rr > 5) continue;
        list = G.Gacha.pool(rr, gen);
        if (list.length) { rarity = rr; break; }
      }
      if (!list.length) list = G.DEX.filter(p => p.gen === gen && G.SPRITE_META[p.dex]);
      const mon = pickR(r, list);
      const shiny = G.Sprites.hasShiny(mon.dex) && r() < G.Gacha.SHINY_RATE;
      out.push({ dex: mon.dex, rarity, shiny });
    }
    return out;
  }
  const scoreOf = pulls => pulls.reduce((s, p) => s + POINTS[p.rarity] * (p.shiny ? 3 : 1), 0);

  /** Everyone's pulls, scores and the winner (the same result on every screen). */
  function results(g) {
    const rows = g.players.map(uid => {
      const pulls = pullsFor(g, uid);
      return { uid, pulls, score: scoreOf(pulls), best: Math.max(...pulls.map(p => p.rarity * 10 + (p.shiny ? 5 : 0))) };
    });
    const flip = rng(g.seed + ':flip');
    const tie = Object.fromEntries(rows.map(x => [x.uid, flip()]));
    const winner = rows.slice().sort((a, b) => b.score - a.score || b.best - a.best || tie[b.uid] - tie[a.uid])[0].uid;
    return { rows, winner };
  }

  /** Your share of a finished battle, applied to your save once (stake out, pulls in, the pot if you won). */
  function settle(g) {
    const s = G.DB.save, st = gbState();
    if (!g.players.includes(meUid()) || st.done[g.id]) return;
    st.done[g.id] = 1; st.n = (st.n || 0) + 1;
    s.tickets.t1 = Math.max(0, s.tickets.t1 - g.stake);
    s.shiny = s.shiny || {};
    const { rows, winner } = results(g);
    const mine = rows.find(x => x.uid === meUid());
    for (const p of mine.pulls) {
      let refund = 0;
      if (p.shiny) {
        if (!s.shiny[p.dex]) s.shiny[p.dex] = { at: Date.now(), from: 'battle' }; else refund = G.Gacha.REFUND[p.rarity] * 3;
        if (!s.owned[p.dex]) s.owned[p.dex] = { at: Date.now(), from: 'battle' };
      } else if (!s.owned[p.dex]) s.owned[p.dex] = { at: Date.now(), from: 'battle' };
      else refund = G.Gacha.REFUND[p.rarity];
      s.coins += refund;
    }
    s.stats.pulls = (s.stats.pulls || 0) + mine.pulls.length;
    if (winner === meUid()) s.tickets.t1 += g.stake * (g.players.length - 1);
    G.DB.commit(true);
  }

  // ---- battle screen ----
  let raf = 0;
  function showBattle() {
    if (G.Game.state !== 'ui') return;
    if (!G.UI.isOpen('scr-gbattle')) G.UI.show('scr-gbattle', true);
    renderBattle();
  }

  function renderBattle() {
    const g = game(), r = room();
    if (!g || g.type !== 'gb' || !r) { closeBattle(); return; }
    const box = $('gb-body');
    $('gb-title').textContent = 'Gacha Battle · ' + g.stake + (g.stake === 1 ? ' pull' : ' pulls') + ' each';
    if (g.phase === 'join') {
      const joined = r.members.filter(m => (m.gb || {}).id === g.id);
      const me = r.members.find(m => m.uid === meUid());
      const amIn = me && (me.gb || {}).id === g.id;
      const t1 = G.DB.save.tickets.t1, left = battlesLeft();
      box.innerHTML = `<p class="sub">Everyone who joins stakes <b class="gold">${g.stake} ×1 ticket${g.stake > 1 ? 's' : ''}</b> and pulls ${g.stake}.
        You keep what you pull. The best pulls win everyone else's tickets.</p>
        <div class="gb-join">${r.members.map(m => `<div class="gb-chip${(m.gb || {}).id === g.id ? ' in' : ''}">${spr(m.dex, 40, 36, m.shiny)}<span>${esc(m.name)}</span><small>${(m.gb || {}).id === g.id ? 'In' : 'Watching'}</small></div>`).join('')}</div>
        <p class="note">Score: ★1 1 · ★2 3 · ★3 8 · ★4 25 · ★5 100 points, shiny ×3. You can battle ${left} more time${left === 1 ? '' : 's'} today.</p>`;
      const row = document.createElement('div'); row.className = 'row'; row.style.justifyContent = 'center'; row.style.gap = '8px';
      const btn = (t, cls, fn, dis) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = t; b.onclick = fn; b.disabled = !!dis; row.appendChild(b); };
      if (!amIn) btn('Join (' + g.stake + ' ticket' + (g.stake > 1 ? 's' : '') + ')', 'gold', () => G.Social.setMine('gb', { id: g.id, s: Math.floor(Math.random() * 1e9) }),
        t1 < g.stake || left <= 0);
      else btn('Leave the battle', 'ghost', () => G.Social.setMine('gb', null));
      if (r.isHost) {
        btn('Start (' + joined.length + ' in)', 'gold', () => {
          const players = joined.map(m => m.uid);
          if (players.length < 2) return;
          const seed = String(g.hs) + ':' + joined.map(m => m.uid + '=' + m.gb.s).sort().join(',');
          G.Social.setGame(Object.assign({}, g, { phase: 'roll', players, seed, startAt: now() + LEAD_MS }));
        }, joined.length < 2);
        btn('Cancel', 'ghost', () => G.Social.setGame(null));
      }
      box.appendChild(row);
      fillSprites(box);
      if (amIn && t1 < g.stake) box.insertAdjacentHTML('beforeend', '<p class="note">You no longer have enough tickets for this battle.</p>');
      else if (!amIn && t1 < g.stake) box.insertAdjacentHTML('beforeend', `<p class="note">You need ${g.stake} ×1 tickets to join. You can still watch.</p>`);
      else if (!amIn && left <= 0) box.insertAdjacentHTML('beforeend', '<p class="note">That\'s your battles for today. You can still watch.</p>');
      return;
    }
    // Rolling: settle right away (so nothing is lost if the page closes), reveal in step with everyone.
    settle(g);
    const res = results(g);
    clearTimeout(raf);
    const n = g.stake;
    let last = -1;
    const tick = () => {
      if (!G.UI.isOpen('scr-gbattle')) return;
      const t = now() - g.startAt;
      const shown = t < 0 ? 0 : Math.min(n, Math.floor(t / REVEAL_MS) + 1);
      const done = shown >= n && t > n * REVEAL_MS + 600;
      const key = shown + (done ? 100 : 0);
      if (key === last) { raf = setTimeout(tick, 100); return; }
      if (last >= 0 && shown > (last % 100)) G.Audio.sfx('select');
      last = key;
      box.innerHTML = `<div class="gb-cols">${res.rows.map(x => {
        const partial = x.pulls.slice(0, shown), sc = scoreOf(partial);
        const win = done && x.uid === res.winner;
        return `<div class="gb-col${win ? ' win' : ''}"><div class="gb-name">${esc(nameOf(x.uid))}${win ? ' 🏆' : ''}</div>
          <div class="gb-score">${sc}</div>
          <div class="gb-pulls">${x.pulls.map((p, i) => i < shown
            ? `<div class="gb-card r${p.rarity}${p.shiny ? ' sh' : ''}" style="--rc:${G.Gacha.RARITY_COLOR[p.rarity]}" title="${esc(G.DEX_BY[p.dex].name)}">${spr(p.dex, 48, 42, p.shiny)}<small>${'★'.repeat(p.rarity)}${p.shiny ? ' ✦' : ''}</small></div>`
            : '<div class="gb-card back">?</div>').join('')}</div></div>`;
      }).join('')}</div>` + (shown === 0 ? '<p class="sub center">Get ready…</p>' : '');
      fillSprites(box);
      if (done) {
        const w = res.winner, pot = g.stake * (g.players.length - 1);
        box.insertAdjacentHTML('beforeend', `<p class="gb-result">${w === meUid() ? 'You win' : esc(nameOf(w)) + ' wins'} <b class="gold">+${pot} ×1 ticket${pot > 1 ? 's' : ''}</b></p>`);
        const row = document.createElement('div'); row.className = 'row'; row.style.justifyContent = 'center'; row.style.gap = '8px';
        const b = document.createElement('button'); b.className = 'btn gold'; b.textContent = room() && room().isHost ? 'Back to the room' : 'Close';
        b.onclick = () => { if (room() && room().isHost) G.Social.setGame(null); closeBattle(); };
        row.appendChild(b);
        box.appendChild(row);
        G.Audio.sfx('confirm');
        return;
      }
      raf = setTimeout(tick, 100);
    };
    tick();
  }

  function closeBattle() {
    clearTimeout(raf);
    if (G.UI.isOpen('scr-gbattle')) { if (room()) G.LobbyUI.open(); else G.MenuUI.open(); }
  }

  // ================= Draft Night =================
  function hostDraft() {
    const r = room();
    if (!r || !r.isHost || game() || r.members.length < 2) return;
    const R = rng(String(Math.random()));
    const order = r.members.map(m => m.uid).sort(() => R() - 0.5);
    // A pool of 3 per player, spread over the rarities so every pick has something good on offer.
    const all = G.DEX.filter(p => !p.leg && G.SPRITE_META[p.dex]);
    const tiers = [[1, 2], [3], [4, 5]];
    const pool = [];
    for (let i = 0; i < order.length; i++) for (const t of tiers) {
      const list = all.filter(p => t.includes(p.rarity) && !pool.includes(p.dex));
      pool.push(pickR(R, list).dex);
    }
    G.Social.setGame({ type: 'draft', id: Date.now().toString(36), pool: pool.sort(() => R() - 0.5), order, picks: {}, turn: 0, turnAt: now(), phase: 'pick' });
  }

  /** Host: records a pick (its own, a guest's or a timed-out random one) and moves the turn on. */
  function hostRecord(uid, dex) {
    const g = game();
    if (!g || g.type !== 'draft' || g.phase !== 'pick' || g.order[g.turn] !== uid) return;
    const taken = Object.values(g.picks || {});
    if (!g.pool.includes(dex) || taken.includes(dex)) return;
    const picks = Object.assign({}, g.picks, { [uid]: dex });
    const turn = g.turn + 1;
    G.Social.setGame(Object.assign({}, g, { picks, turn, turnAt: now(), phase: turn >= g.order.length ? 'done' : 'pick' }));
  }

  /** Host: watches the guests' picks and the turn timer. */
  function hostTick() {
    const g = game(), r = room();
    if (!g || !r || !r.isHost || g.type !== 'draft' || g.phase !== 'pick') return;
    const cur = g.order[g.turn];
    if (!r.members.some(m => m.uid === cur)) {          // left the room: skip them
      const order = g.order.filter(u => u !== cur);
      G.Social.setGame(Object.assign({}, g, { order, turnAt: now(), phase: g.turn >= order.length ? 'done' : 'pick' }));
      return;
    }
    const dp = mineOf(cur, 'dp');
    if (dp && dp.id === g.id) { hostRecord(cur, dp.dex); return; }
    if (now() - g.turnAt > TURN * 1000) {
      const left = g.pool.filter(d => !Object.values(g.picks || {}).includes(d));
      hostRecord(cur, left[Math.floor(Math.random() * left.length)]);
    }
  }

  function pickDraft(dex) {
    const g = game();
    if (!g || g.type !== 'draft' || g.order[g.turn] !== meUid()) return;
    G.Audio.sfx('confirm');
    if (room().isHost) hostRecord(meUid(), dex);
    else G.Social.setMine('dp', { id: g.id, dex });
  }

  let draftTimer = 0;
  function showDraft() {
    if (G.Game.state !== 'ui') return;
    if (!G.UI.isOpen('scr-draft')) G.UI.show('scr-draft', true);
    renderDraft();
    clearInterval(draftTimer);
    draftTimer = setInterval(() => { if (!G.UI.isOpen('scr-draft')) { clearInterval(draftTimer); return; } hostTick(); renderClock(); }, 500);
  }
  function renderClock() {
    const g = game(), el = $('dr-clock');
    if (!el || !g || g.phase !== 'pick') return;
    el.textContent = Math.max(0, Math.ceil(TURN - (now() - g.turnAt) / 1000)) + ' s';
  }
  function renderDraft() {
    const g = game(), r = room();
    if (!g || g.type !== 'draft' || !r) { if (G.UI.isOpen('scr-draft')) G.LobbyUI.open(); return; }
    const taken = Object.values(g.picks || {}), cur = g.order[g.turn], myTurn = g.phase === 'pick' && cur === meUid();
    $('dr-sub').innerHTML = g.phase === 'done' ? 'Draft complete! The next group run uses these Pokémon.'
      : myTurn ? `<b class="gold">Your pick!</b> <span id="dr-clock"></span>` : `${esc(nameOf(cur))} is picking… <span id="dr-clock"></span>`;
    $('dr-order').innerHTML = g.order.map((u, i) => {
      const d = (g.picks || {})[u];
      return `<div class="dr-seat${i === g.turn && g.phase === 'pick' ? ' now' : ''}"><small>${i + 1}</small><b>${esc(nameOf(u))}</b>${d ? spr(d, 44, 40) + `<span>${esc(G.DEX_BY[d].name)}</span>` : '<span class="sub">…</span>'}</div>`;
    }).join('');
    fillSprites($('dr-order'));
    const pool = $('dr-pool');
    pool.innerHTML = '';
    for (const d of g.pool) {
      const p = G.DEX_BY[d], gone = taken.includes(d);
      const b = document.createElement('button');
      b.className = 'dr-mon' + (gone ? ' gone' : '') + (myTurn && !gone ? ' can' : '');
      b.style.setProperty('--rc', G.Gacha.RARITY_COLOR[p.rarity]);
      b.appendChild(G.UI.spriteCanvas(d, 72, 64, { scale: 2 }));
      b.insertAdjacentHTML('beforeend', `<b>${esc(p.name)}</b>${G.UI.typeChips(p.types)}<small>${G.UI.stars(p.rarity, 10)}</small>`);
      b.disabled = !myTurn || gone;
      b.onclick = () => pickDraft(d);
      pool.appendChild(b);
    }
    $('dr-start').classList.toggle('hidden', !(r.isHost && g.phase === 'done'));
    $('dr-cancel').classList.toggle('hidden', !r.isHost);
    renderClock();
  }

  /** The drafted Pokémon for a group run's config (host, lobby start), or null if there's no finished draft. */
  function draftedFor(uid) {
    const g = game();
    return g && g.type === 'draft' && g.phase === 'done' && g.picks ? g.picks[uid] || null : null;
  }

  // ================= wiring =================
  function onGame() {
    const g = game();
    if (G.Game.state !== 'ui') return;
    if (g && g.type === 'gb') showBattle();
    else if (g && g.type === 'draft') showDraft();
    else {
      if (G.UI.isOpen('scr-gbattle') || G.UI.isOpen('scr-draft')) G.LobbyUI.open();
    }
  }

  function init() {
    $('mini-gb').onclick = () => { $('mini-room').click(); };
    $('mini-draft').onclick = () => { $('mini-room').click(); };
    $('dr-start').onclick = () => G.LobbyUI.startDraftRun();
    $('dr-cancel').onclick = () => G.Social.setGame(null);
    $('gb-back').onclick = () => G.LobbyUI.open();
    $('dr-back').onclick = () => G.LobbyUI.open();
    G.Social.on(what => {
      if (what === 'game') onGame();
      else if (what === 'room') {
        if (G.UI.isOpen('scr-gbattle') && game() && game().phase === 'join') renderBattle();
        if (G.UI.isOpen('scr-draft')) { hostTick(); renderDraft(); }
      }
    });
  }

  /** Lobby: the host's mini-game buttons (social-ui.js renders them). */
  function lobbyTools(box) {
    const r = room();
    if (!r) { box.innerHTML = ''; return; }
    const g = game();
    if (g) {
      box.innerHTML = `<p class="note">${g.type === 'gb' ? 'A Gacha Battle is on.' : g.phase === 'done' ? 'Draft done: the next group run uses the drafted Pokémon.' : 'Draft Night is on.'}</p>`;
      const b = document.createElement('button'); b.className = 'btn small'; b.textContent = 'Open it';
      b.onclick = () => (g.type === 'gb' ? showBattle() : showDraft());
      box.appendChild(b);
      return;
    }
    if (!r.isHost) { box.innerHTML = '<p class="note">The host can start a Gacha Battle or Draft Night.</p>'; return; }
    box.innerHTML = '';
    const row = document.createElement('div'); row.className = 'row'; row.style.gap = '6px'; row.style.flexWrap = 'wrap';
    for (const s of STAKES) {
      const b = document.createElement('button'); b.className = 'btn small'; b.textContent = 'Gacha Battle ×' + s;
      b.title = 'Everyone who joins stakes ' + s + ' ×1 ticket' + (s > 1 ? 's' : '') + '; the best pulls win the pot';
      b.disabled = r.members.length < 2; b.onclick = () => hostBattle(s);
      row.appendChild(b);
    }
    const d = document.createElement('button'); d.className = 'btn small gold'; d.textContent = 'Draft Night';
    d.title = 'Take turns drafting Pokémon for the next group run'; d.disabled = r.members.length < 2; d.onclick = hostDraft;
    row.appendChild(d);
    box.appendChild(row);
    if (r.members.length < 2) box.insertAdjacentHTML('beforeend', '<p class="note">Invite a friend to play.</p>');
  }

  return { init, open, lobbyTools, draftedFor, DAILY };
})();
