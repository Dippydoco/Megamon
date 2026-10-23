/* ============ minigames.js — Mini-Games: Gacha Battle and Draft Night ============
 * Both are played inside a friends room (net/social.js), so they need no new servers or rules:
 *   - the host writes the shared state to rooms/{id}/g  (G.Social.setGame)
 *   - each player writes their own answer to rooms/{id}/m/{uid}/...  (G.Social.setMine)
 * Everyone in the room listens to both, so all screens move together.
 *
 * GACHA BATTLE  g = { type:'gb', id, phase:'join'|'roll', host seed `hs`, seed, players:[uid], stakes:{uid:n},
 *                     charms:{uid:[gen]}, startAt }
 *   Each player who joins picks their own stake: 1..MAX_STAKE ×1 tickets, and pulls that many
 *   (m/{uid}/gb = { id, s: their seed, n: stake, c: their Shiny Charm regions }). When the host starts,
 *   everybody's pulls come from one shared seed, so every screen shows the same pulls, revealed card by card
 *   at the same moment (startAt, server time). Everyone keeps what they pull, as with a normal pull (no pity).
 *   The winner (highest total score) also wins the other players' stakes as tickets. A bigger stake means more
 *   pulls, so a better chance to win, but more to lose.
 *   Score: ★1 1 · ★2 3 · ★3 8 · ★4 25 · ★5 100 points, shiny ×3. Ties: best single pull, then a seeded coin flip.
 *   No daily limit (save.gb.done only stops one battle being settled twice).
 *   Alone (no room, or nobody else in it): a battle against the Bot, played on your own device (`solo`).
 *   The Bot matches your stake; beat it and you win that many tickets. Its pulls aren't kept by anyone.
 *
 * DRAFT NIGHT   g = { type:'draft', id, pool:[dex], order:[uid], picks:{uid:dex}, turn, turnAt, phase:'pick'|'done' }
 *   The host deals a pool of 3 Pokémon per player; players pick one each in a random order (TURN s each,
 *   then a random pick). The next group run uses the drafted Pokémon (game.js startRun, cfg.draft).
 */
G.MiniUI = (() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MAX_STAKE = 100;
  const BOT = 'bot';
  const POINTS = { 1: 1, 2: 3, 3: 8, 4: 25, 5: 100 };
  const LEAD_MS = 2500;                         // the reveal starts LEAD_MS after the host starts
  const REVEAL_TOTAL = 14000;                   // big stakes reveal faster, so a battle never takes much longer than this
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
  const meUid = () => G.Social.uid || 'me';
  const nameOf = uid => uid === BOT ? 'Bot' : ((room() && room().members.find(m => m.uid === uid)) || {}).name || (uid === meUid() ? 'You' : 'Someone');
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
    s.gb = s.gb && typeof s.gb === 'object' ? s.gb : {};
    const done = s.gb.done && typeof s.gb.done === 'object' ? s.gb.done : {};
    // Old saves: { day, n, done: { id: 1 } }. Keep only the last 3 days of settled battles.
    const cut = Date.now() - 3 * 864e5;
    for (const k in done) if (typeof done[k] !== 'number' || done[k] < cut) { if (done[k] === 1) done[k] = Date.now(); else delete done[k]; }
    s.gb = { done };
    return s.gb;
  }

  let solo = null;                              // a battle against the Bot (only on this device)
  let wantStake = 3;                            // the stake typed in the box (kept across re-renders)
  const cur = () => solo || game();
  const stakeOf = (g, uid) => Math.max(1, Math.min(MAX_STAKE, ((g.stakes || {})[uid]) || g.stake || 1));
  const tickets = () => (G.DB.save.tickets || {}).t1 || 0;
  const clampStake = n => Math.max(1, Math.min(MAX_STAKE, Math.floor(+n) || 1));
  const plural = n => n + ' ×1 ticket' + (n === 1 ? '' : 's');
  const potFor = (g, uid) => g.players.filter(u => u !== uid).reduce((a, u) => a + stakeOf(g, u), 0);
  const revealMs = g => Math.max(140, Math.min(1100, Math.floor(REVEAL_TOTAL / Math.max(...g.players.map(u => stakeOf(g, u))))));

  /** Host: opens a battle for everyone in the room (each player picks their own stake when joining). */
  function hostBattle() {
    const r = room();
    if (!r || !r.isHost || game()) return;
    solo = null;
    G.Social.setGame({ type: 'gb', id: Date.now().toString(36), phase: 'join', hs: Math.floor(Math.random() * 1e9) });
  }

  /** On your own: a battle against the Bot, set up on this device. */
  function soloBattle() {
    if (game() && game().type === 'gb') { showBattle(); return; }
    solo = { type: 'gb', solo: true, id: 's' + Date.now().toString(36), phase: 'join' };
    showBattle();
  }
  function soloFrom(from) { lastFrom = from; soloBattle(); }
  function startSolo() {
    const n = clampStake(wantStake);
    if (!solo || solo.phase !== 'join' || tickets() < n) return;
    const me = meUid();
    solo = Object.assign({}, solo, { phase: 'roll', players: [me, BOT], stakes: { [me]: n, [BOT]: n },
      charms: { [me]: G.Charms.list().slice() }, seed: 'solo:' + Math.floor(Math.random() * 1e9), startAt: now() + LEAD_MS });
    renderBattle();
  }

  /** Every pull of one player, from the shared seed. Like a "surprise me" pull: a random region per pull. */
  function pullsFor(g, uid) {
    const r = rng(g.seed + ':' + uid);
    const total = G.Gacha.RATES.reduce((a, [, w]) => a + w, 0);
    const charms = ((g.charms || {})[uid]) || [];
    const out = [];
    for (let i = 0, n = stakeOf(g, uid); i < n; i++) {
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
      const shiny = G.Sprites.hasShiny(mon.dex) && r() < G.Gacha.SHINY_RATE * G.Charms.mult(mon.dex, charms);
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
    const s = G.DB.save, st = gbState(), me = meUid();
    if (!g.players.includes(me) || st.done[g.id]) return;
    st.done[g.id] = Date.now();
    s.tickets.t1 = Math.max(0, s.tickets.t1 - stakeOf(g, me));
    s.shiny = s.shiny || {};
    const { rows, winner } = results(g);
    const mine = rows.find(x => x.uid === me);
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
    if (winner === me) s.tickets.t1 += potFor(g, me);
    G.DB.commit(true);
  }

  // ---- battle screen ----
  let raf = 0;
  function showBattle() {
    if (G.Game.state !== 'ui') return;
    if (!G.UI.isOpen('scr-gbattle')) G.UI.show('scr-gbattle', true);
    renderBattle();
  }

  /** The stake box: a number from 1 to what you can afford (MAX_STAKE at most), with quick buttons. */
  function stakePicker(box, onChange) {
    const max = Math.max(1, Math.min(MAX_STAKE, tickets()));
    wantStake = clampStake(Math.min(wantStake, max));
    const wrap = document.createElement('div'); wrap.className = 'gb-stake';
    wrap.innerHTML = `<label>Your stake <input type="number" min="1" max="${max}" step="1" inputmode="numeric" value="${wantStake}"> ×1 tickets</label>`;
    const inp = wrap.querySelector('input');
    const set = v => { wantStake = clampStake(Math.min(v, max)); inp.value = wantStake; if (onChange) onChange(); };
    inp.oninput = () => { const v = Math.floor(+inp.value); if (v >= 1) { wantStake = clampStake(Math.min(v, max)); if (onChange) onChange(); } };
    inp.onchange = () => set(inp.value);
    inp.onblur = () => { if (pendingRender) { pendingRender = false; setTimeout(() => { if (G.UI.isOpen('scr-gbattle')) renderBattle(); }, 250); } };
    const quick = document.createElement('div'); quick.className = 'gb-quick';
    for (const [t, v] of [['1', 1], ['5', 5], ['10', 10], ['25', 25], ['Max', max]]) {
      if (v > max && t !== 'Max') continue;
      const b = document.createElement('button'); b.className = 'btn small ghost'; b.textContent = t; b.onclick = () => set(v);
      quick.appendChild(b);
    }
    wrap.appendChild(quick);
    box.appendChild(wrap);
    return inp;
  }
  const btnRow = () => { const row = document.createElement('div'); row.className = 'row'; row.style.justifyContent = 'center'; row.style.gap = '8px'; row.style.flexWrap = 'wrap'; return row; };
  const addBtn = (row, t, cls, fn, dis) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = t; b.onclick = fn; b.disabled = !!dis; row.appendChild(b); return b; };
  const SCORE_NOTE = 'Score: ★1 1 · ★2 3 · ★3 8 · ★4 25 · ★5 100 points, shiny ×3.';

  function renderSoloJoin(box) {
    const t1 = tickets();
    box.innerHTML = `<p class="sub">Nobody to battle? Take on the <b>Bot</b>. It matches your stake and you both pull at once.
      You keep what you pull, and if your pulls beat the Bot's you win its stake as tickets.</p>
      <div class="gb-join"><div class="gb-chip in">${spr(G.DB.save.partner, 40, 36, !!G.DB.save.partnerShiny && G.DB.ownsShiny(G.DB.save.partner))}<span>You</span><small>In</small></div>
      <div class="gb-chip in"><span class="gb-bot">🤖</span><span>Bot</span><small>Matches you</small></div></div>`;
    if (t1 < 1) {
      box.insertAdjacentHTML('beforeend', '<p class="note">You need at least 1 ×1 ticket to battle.</p>');
    } else {
      const go = () => { startBtn.textContent = 'Battle the Bot (' + plural(clampStake(wantStake)) + ')'; };
      stakePicker(box, go);
      const row = btnRow();
      const startBtn = addBtn(row, '', 'gold', startSolo);
      go();
      box.appendChild(row);
    }
    box.insertAdjacentHTML('beforeend', `<p class="note">${SCORE_NOTE} Want to play friends instead? Open a room from Mini-Games.</p>`);
    fillSprites(box);
  }

  function renderBattle() {
    const g = cur(), r = room();
    if (!g || g.type !== 'gb' || (!g.solo && !r)) { closeBattle(); return; }
    const box = $('gb-body');
    $('gb-back').textContent = g.solo ? 'Back' : 'Room';
    if (g.phase === 'join') {
      $('gb-title').textContent = g.solo ? 'Gacha Battle vs Bot' : 'Gacha Battle';
      if (g.solo) { renderSoloJoin(box); return; }
      const joined = r.members.filter(m => (m.gb || {}).id === g.id);
      const me = r.members.find(m => m.uid === meUid());
      const myEntry = me && (me.gb || {}).id === g.id ? me.gb : null;
      const t1 = tickets();
      const pot = joined.reduce((a, m) => a + stakeOf({ stakes: { x: m.gb.n } }, 'x'), 0);
      box.innerHTML = `<p class="sub">Everyone who joins picks their own stake of ×1 tickets and pulls that many.
        You keep what you pull. The best total score wins everyone else's tickets.</p>
        <div class="gb-join">${r.members.map(m => {
          const inIt = (m.gb || {}).id === g.id;
          return `<div class="gb-chip${inIt ? ' in' : ''}">${spr(m.dex, 40, 36, m.shiny)}<span>${esc(m.name)}</span><small>${inIt ? 'Stakes ' + stakeOf({ stakes: { x: m.gb.n } }, 'x') : 'Watching'}</small></div>`;
        }).join('')}</div>
        ${joined.length ? `<p class="center">Pot: <b class="gold">${plural(pot)}</b></p>` : ''}`;
      const sendMine = n => G.Social.setMine('gb', { id: g.id, s: (myEntry && myEntry.s) || Math.floor(Math.random() * 1e9), n, c: G.Charms.list().slice() });
      if (t1 >= 1) {
        let actBtn;
        const label = () => {
          if (!actBtn) return;
          const n = clampStake(wantStake);
          actBtn.textContent = myEntry ? (n === stakeOf({ stakes: { x: myEntry.n } }, 'x') ? 'Stake set' : 'Change stake to ' + n) : 'Join (' + plural(n) + ')';
          actBtn.disabled = myEntry && n === stakeOf({ stakes: { x: myEntry.n } }, 'x');
        };
        if (!myEntry) wantStake = clampStake(wantStake);
        else wantStake = stakeOf({ stakes: { x: myEntry.n } }, 'x');
        stakePicker(box, label);
        const row = btnRow();
        actBtn = addBtn(row, '', 'gold', () => { if (tickets() >= clampStake(wantStake)) sendMine(clampStake(wantStake)); });
        label();
        if (myEntry) addBtn(row, 'Leave the battle', 'ghost', () => G.Social.setMine('gb', null));
        box.appendChild(row);
      } else if (myEntry) {
        const row = btnRow(); addBtn(row, 'Leave the battle', 'ghost', () => G.Social.setMine('gb', null)); box.appendChild(row);
      }
      if (r.isHost) {
        const row = btnRow();
        addBtn(row, 'Start (' + joined.length + ' in)', 'gold', () => {
          const players = joined.map(m => m.uid);
          if (players.length < 2) return;
          const stakes = {}, charms = {};
          for (const m of joined) { stakes[m.uid] = stakeOf({ stakes: { x: m.gb.n } }, 'x'); charms[m.uid] = Array.isArray(m.gb.c) ? m.gb.c : []; }
          const seed = String(g.hs) + ':' + joined.map(m => m.uid + '=' + m.gb.s + '*' + stakes[m.uid]).sort().join(',');
          G.Social.setGame(Object.assign({}, g, { phase: 'roll', players, stakes, charms, seed, startAt: now() + LEAD_MS }));
        }, joined.length < 2);
        addBtn(row, 'Cancel', 'ghost', () => G.Social.setGame(null));
        box.appendChild(row);
        if (joined.length < 2) box.insertAdjacentHTML('beforeend', '<p class="note">At least 2 players need to join. On your own? Cancel and pick "Gacha Battle vs Bot".</p>');
      }
      fillSprites(box);
      if (myEntry && t1 < stakeOf({ stakes: { x: myEntry.n } }, 'x')) box.insertAdjacentHTML('beforeend', '<p class="note">You no longer have enough tickets for your stake. Lower it or leave.</p>');
      else if (!myEntry && t1 < 1) box.insertAdjacentHTML('beforeend', '<p class="note">You need at least 1 ×1 ticket to join. You can still watch.</p>');
      box.insertAdjacentHTML('beforeend', `<p class="note">${SCORE_NOTE}</p>`);
      return;
    }
    // Rolling: settle right away (so nothing is lost if the page closes), reveal in step with everyone.
    settle(g);
    const res = results(g);
    clearTimeout(raf);
    const n = Math.max(...g.players.map(u => stakeOf(g, u))), step = revealMs(g);
    const stakesSame = g.players.every(u => stakeOf(g, u) === n);
    $('gb-title').textContent = (g.solo ? 'Gacha Battle vs Bot · ' : 'Gacha Battle · ') + (stakesSame ? n + (n === 1 ? ' pull' : ' pulls') + ' each' : 'up to ' + n + ' pulls');
    // The columns are drawn once with face-down cards; each tick only turns over the new ones.
    box.innerHTML = `<div class="gb-cols">${res.rows.map(x => `<div class="gb-col" data-u="${esc(x.uid)}"><div class="gb-name">${x.uid === BOT ? '🤖 ' : ''}${esc(nameOf(x.uid))}</div>
        <small class="gb-st">${plural(stakeOf(g, x.uid))}</small>
        <div class="gb-score">0</div>
        <div class="gb-pulls${x.pulls.length > 20 ? ' many' : ''}">${x.pulls.map(() => '<div class="gb-card back">?</div>').join('')}</div></div>`).join('')}</div>
      <p class="sub center gb-ready">Get ready…</p>`;
    const cols = [...box.querySelectorAll('.gb-col')];
    let shownBefore = 0;
    const tick = () => {
      if (!G.UI.isOpen('scr-gbattle') || (cur() || {}).id !== g.id) return;
      const t = now() - g.startAt;
      const shown = t < 0 ? 0 : Math.min(n, Math.floor(t / step) + 1);
      const done = shown >= n && t > n * step + 600;
      if (shown > shownBefore) {
        const rd = box.querySelector('.gb-ready'); if (rd) rd.remove();
        res.rows.forEach((x, ci) => {
          const cards = cols[ci].querySelectorAll('.gb-pulls > .gb-card');
          for (let i = shownBefore; i < Math.min(shown, x.pulls.length); i++) {
            const p = x.pulls[i];
            const el = document.createElement('div');
            el.className = 'gb-card r' + p.rarity + (p.shiny ? ' sh' : '');
            el.style.setProperty('--rc', G.Gacha.RARITY_COLOR[p.rarity]);
            el.title = G.DEX_BY[p.dex].name;
            el.innerHTML = spr(p.dex, 48, 42, p.shiny) + `<small>${'★'.repeat(p.rarity)}${p.shiny ? ' ✦' : ''}</small>`;
            fillSprites(el);
            cards[i].replaceWith(el);
          }
          cols[ci].querySelector('.gb-score').textContent = scoreOf(x.pulls.slice(0, shown));
        });
        G.Audio.sfx('select');
        shownBefore = shown;
      }
      if (done) {
        const w = res.winner, pot = potFor(g, w);
        const wc = cols[res.rows.findIndex(x => x.uid === w)];
        wc.classList.add('win'); wc.querySelector('.gb-name').insertAdjacentText('beforeend', ' 🏆');
        box.insertAdjacentHTML('beforeend', `<p class="gb-result">${w === meUid() ? 'You win' : esc(nameOf(w)) + ' wins'} <b class="gold">+${plural(pot)}</b></p>`);
        const row = btnRow();
        if (g.solo) {
          addBtn(row, 'Again', 'gold', () => { solo = { type: 'gb', solo: true, id: 's' + Date.now().toString(36), phase: 'join' }; renderBattle(); }, tickets() < 1);
          addBtn(row, 'Close', 'ghost', closeBattle);
        } else {
          addBtn(row, room() && room().isHost ? 'Back to the room' : 'Close', 'gold', () => { if (room() && room().isHost) G.Social.setGame(null); closeBattle(); });
        }
        box.appendChild(row);
        G.Audio.sfx('confirm');
        return;
      }
      raf = setTimeout(tick, 80);
    };
    tick();
  }

  let lastFrom = 'mini';                        // where a Bot battle was opened from (to go back there)
  function closeBattle() {
    clearTimeout(raf);
    const wasSolo = !!solo;
    solo = null;
    if (!G.UI.isOpen('scr-gbattle')) return;
    if (room() && (!wasSolo || lastFrom === 'lobby')) { G.LobbyUI.open(); return; }
    open();
    if (G.UI.isOpen('scr-gbattle')) G.MenuUI.open();
  }
  /** Room updates while you type your stake would wipe the box: they wait until you leave it. */
  let pendingRender = false;
  function roomChanged() {
    const a = document.activeElement;
    if (a && a.tagName === 'INPUT' && $('gb-body').contains(a)) { pendingRender = true; return; }
    renderBattle();
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
    if (g && solo && solo.phase === 'join') solo = null;      // a room game takes over an unstarted Bot battle
    if (!g && solo && G.UI.isOpen('scr-gbattle')) return;     // your Bot battle carries on
    if (g && g.type === 'gb') showBattle();
    else if (g && g.type === 'draft') showDraft();
    else {
      if (G.UI.isOpen('scr-gbattle') || G.UI.isOpen('scr-draft')) G.LobbyUI.open();
    }
  }

  function init() {
    // Gacha Battle from the Mini-Games screen: to your room if friends are in it, otherwise against the Bot.
    $('mini-gb').onclick = () => { if (room() && room().members.length > 1) $('mini-room').click(); else soloFrom('mini'); };
    $('mini-draft').onclick = () => { $('mini-room').click(); };
    $('dr-start').onclick = () => G.LobbyUI.startDraftRun();
    $('dr-cancel').onclick = () => G.Social.setGame(null);
    $('gb-back').onclick = () => { if (solo) { if (solo.phase === 'roll') { G.UI.toast('Wait for the battle to finish'); return; } closeBattle(); } else G.LobbyUI.open(); };
    $('dr-back').onclick = () => G.LobbyUI.open();
    G.Social.on(what => {
      if (what === 'game') onGame();
      else if (what === 'room') {
        if (G.UI.isOpen('scr-gbattle') && !solo && game() && game().phase === 'join') roomChanged();
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
      b.onclick = () => (g.type === 'gb' ? (solo = null, showBattle()) : showDraft());
      box.appendChild(b);
      return;
    }
    if (!r.isHost) {
      box.innerHTML = '<p class="note">The host can start a Gacha Battle or Draft Night.</p>';
      const b = document.createElement('button'); b.className = 'btn small ghost'; b.textContent = 'Gacha Battle vs Bot';
      b.onclick = () => soloFrom('lobby');
      box.appendChild(b);
      return;
    }
    box.innerHTML = '';
    const row = document.createElement('div'); row.className = 'row'; row.style.gap = '6px'; row.style.flexWrap = 'wrap';
    const alone = r.members.length < 2;
    const b = document.createElement('button'); b.className = 'btn small'; b.textContent = alone ? 'Gacha Battle vs Bot' : 'Gacha Battle';
    b.title = alone ? 'Battle the Bot on your own: it matches your stake' : 'Everyone who joins picks their own stake; the best pulls win the pot';
    b.onclick = () => (alone ? soloFrom('lobby') : hostBattle());
    row.appendChild(b);
    const d = document.createElement('button'); d.className = 'btn small gold'; d.textContent = 'Draft Night';
    d.title = 'Take turns drafting Pokémon for the next group run'; d.disabled = r.members.length < 2; d.onclick = hostDraft;
    row.appendChild(d);
    box.appendChild(row);
    if (r.members.length < 2) box.insertAdjacentHTML('beforeend', '<p class="note">Invite a friend to play together, or battle the Bot meanwhile.</p>');
  }

  return { init, open, lobbyTools, draftedFor, MAX_STAKE };
})();
