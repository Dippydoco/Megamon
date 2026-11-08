/* ============ roulette.js — Mini-Game: Roulette (08-11-2026) ============
 * A European roulette wheel (single zero, 37 pockets) played with ×1 gacha tickets.
 * Played in a friends room like the other mini-games (ui/minigames.js), so it needs no new servers or rules:
 *   - the host writes the table to rooms/{id}/g  (G.Social.setGame)
 *   - each player writes their own bets to rooms/{id}/m/{uid}/rl  (G.Social.setMine)
 * Everyone in the room sees the table, the current player's chips as they place them, and the spin.
 *
 * g = { type:'rl', id, order:[uid], turn, round, turnAt, phase:'bet'|'spin', spin:{ uid, bets, n, at, sid }, hist:[n] }
 *   One player at a time (order, joining players go to the back). On your turn you place chips and press Spin:
 *   m/{uid}/rl = { id, round, bets:{ key: tickets }, go } (go: 1 = spin, 'pass' = skip the turn).
 *   The host draws the number, writes `spin` (at = server time the wheel starts) and every screen plays the same spin.
 *   The spinner settles their own tickets once (save.rl.done[sid]). After the spin the turn passes on.
 *   A turn not used within TURN seconds is skipped.
 * Alone (no room): a table on this device only (`solo`), same rules.
 *
 * Bets and payouts (the winnings; the stake comes back too): a number 35 to 1 · a dozen or a column 2 to 1 ·
 * red/black, odd/even, 1-18/19-36 1 to 1. On 0 every outside bet loses. No table limit: you can bet all the ×1 tickets you have
 * (the 100-ticket limit was removed on 08-11-2026).
 */
G.RouletteUI = (() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TURN = 45;                           // seconds to place your bets
  const SPIN_MS = 6500, SHOW_MS = 3800;      // wheel spin · result shown before the next turn
  const LEAD_MS = 1200;                      // the wheel starts this long after the host draws (so everyone has it before it moves)
  const CHIPS = [1, 5, 10, 25, 100];
  const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const colorOf = n => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black');

  // ---- bets ----
  const OUTSIDE = {
    red:  { label: 'Red',   pay: 1, win: n => n > 0 && RED.has(n) },
    black:{ label: 'Black', pay: 1, win: n => n > 0 && !RED.has(n) },
    odd:  { label: 'Odd',   pay: 1, win: n => n > 0 && n % 2 === 1 },
    even: { label: 'Even',  pay: 1, win: n => n > 0 && n % 2 === 0 },
    low:  { label: '1-18',  pay: 1, win: n => n >= 1 && n <= 18 },
    high: { label: '19-36', pay: 1, win: n => n >= 19 },
    d1:   { label: '1st 12', pay: 2, win: n => n >= 1 && n <= 12 },
    d2:   { label: '2nd 12', pay: 2, win: n => n >= 13 && n <= 24 },
    d3:   { label: '3rd 12', pay: 2, win: n => n >= 25 },
    c1:   { label: '2 to 1', pay: 2, win: n => n > 0 && n % 3 === 1 },     // bottom row: 1, 4 … 34
    c2:   { label: '2 to 1', pay: 2, win: n => n > 0 && n % 3 === 2 },     // middle row: 2, 5 … 35
    c3:   { label: '2 to 1', pay: 2, win: n => n > 0 && n % 3 === 0 }      // top row: 3, 6 … 36
  };
  const validKey = k => OUTSIDE[k] || (/^n([0-9]|[12][0-9]|3[0-6])$/.test(k));
  const payOf = k => (OUTSIDE[k] ? OUTSIDE[k].pay : 35);
  const wins = (k, n) => (OUTSIDE[k] ? OUTSIDE[k].win(n) : +k.slice(1) === n);
  const nameOfBet = k => (OUTSIDE[k] ? (k[0] === 'c' ? 'Column ' + k[1] : OUTSIDE[k].label) : 'Number ' + k.slice(1));
  /** Clean bets: known keys, whole tickets. */
  function cleanBets(b) {
    const out = {};
    for (const k in (b || {})) {
      const v = Math.floor(+b[k]);
      if (!validKey(k) || !(v > 0)) continue;
      out[k] = v;
    }
    return out;
  }
  const total = b => Object.values(b || {}).reduce((a, v) => a + v, 0);
  /** Tickets back from a spin (stakes of the winning bets plus their winnings). */
  const payout = (b, n) => Object.keys(b || {}).reduce((a, k) => a + (wins(k, n) ? b[k] * (payOf(k) + 1) : 0), 0);

  // ---- room / solo plumbing ----
  const room = () => G.Social.room;
  const meUid = () => G.Social.uid || 'me';
  const now = () => G.Social.syncNow();               // the server's clock, so every screen spins in step
  const tickets = () => (G.DB.save.tickets || {}).t1 || 0;
  let solo = null, soloMine = null;
  const roomGame = () => { const g = room() && room().game; return g && g.type === 'rl' ? g : null; };
  const cur = () => solo || roomGame();
  const isHost = () => !!solo || !!(room() && room().isHost);
  function write(g) { if (solo) { solo = g; render(); } else G.Social.setGame(g); }
  function mineOf(uid) {
    if (solo) return uid === meUid() ? soloMine : null;
    return ((room() && room().members.find(m => m.uid === uid)) || {}).rl || null;
  }
  function setMine(v) { if (solo) { soloMine = v; hostTick(); render(); } else G.Social.setMine('rl', v); }
  const nameOf = uid => (solo ? 'You' : ((room() && room().members.find(m => m.uid === uid)) || {}).name || (uid === meUid() ? 'You' : 'Someone'));
  const plural = n => n + ' ×1 ticket' + (n === 1 ? '' : 's');

  function rlState() {
    const s = G.DB.save;
    s.rl = s.rl && typeof s.rl === 'object' ? s.rl : {};
    const done = s.rl.done && typeof s.rl.done === 'object' ? s.rl.done : {};
    const cut = Date.now() - 3 * 864e5;
    for (const k in done) if (typeof done[k] !== 'number' || done[k] < cut) delete done[k];
    s.rl = { done };
    return s.rl;
  }

  // ---------------- host ----------------
  function open() {
    if (G.Game.state !== 'ui') return;
    const r = room();
    if (r) {
      if (r.game && r.game.type !== 'rl') { G.UI.toast('Another mini-game is on: finish it first'); return; }
      if (!r.game) {
        if (!r.isHost) { G.UI.toast('Only the host can open the table'); return; }
        solo = null;
        G.Social.setGame(fresh(r.members.map(m => m.uid)));
        return;                                   // the game listener opens the screen
      }
      solo = null; show(); return;
    }
    solo = fresh([meUid()]); soloMine = null;
    show();
  }
  const fresh = order => ({ type: 'rl', id: Date.now().toString(36), order, turn: 0, round: 0, turnAt: now(), phase: 'bet', hist: [] });

  function nextTurn(g, order = g.order) {
    const turn = order.length ? (g.turn + 1) % order.length : 0;
    return Object.assign({}, g, { order, turn, round: (g.round || 0) + 1, turnAt: now(), phase: 'bet', spin: null });
  }

  /** Host: keeps the seats in step with the room, spins when the player says so, passes the turn on. */
  function hostTick() {
    const g = cur();
    if (!g || !isHost()) return;
    // Seats: newcomers at the back; leavers removed (the turn stays on whoever was next).
    if (!solo) {
      const here = room().members.map(m => m.uid);
      const gone = g.order.filter(u => !here.includes(u)), added = here.filter(u => !g.order.includes(u));
      if (gone.length || added.length) {
        const curU = g.order[g.turn];
        let order = g.order.filter(u => here.includes(u)).concat(added);
        if (!order.length) { write(null); return; }
        let turn = order.indexOf(curU);
        if (turn < 0) {                                   // the current player left: the next seat goes
          const rest = g.order.slice(g.turn + 1).concat(g.order.slice(0, g.turn)).find(u => here.includes(u));
          turn = Math.max(0, order.indexOf(rest));
          write(Object.assign({}, g, { order, turn, round: (g.round || 0) + 1, turnAt: now(), phase: g.phase === 'spin' ? g.phase : 'bet' }));
          return;
        }
        write(Object.assign({}, g, { order, turn }));
        return;
      }
    }
    if (g.phase === 'bet') {
      const u = g.order[g.turn], m = mineOf(u);
      if (m && m.id === g.id && m.round === g.round && m.go) {
        if (m.go === 'pass') { write(nextTurn(g)); return; }
        const bets = cleanBets(m.bets);
        if (total(bets)) {
          const n = WHEEL[Math.floor(Math.random() * WHEEL.length)];
          const sid = g.id + '-' + g.round;
          write(Object.assign({}, g, { phase: 'spin', spin: { uid: u, bets, n, at: now() + LEAD_MS, sid }, hist: [n].concat(g.hist || []).slice(0, 12) }));
          return;
        }
      }
      if (!solo && now() - g.turnAt > TURN * 1000) write(nextTurn(g));     // (alone there's no clock)
    } else if (g.phase === 'spin' && g.spin && now() > g.spin.at + SPIN_MS + SHOW_MS) {
      write(nextTurn(g));
    }
  }

  /** Your share of a spin, applied once (stakes out, winnings in). */
  function settle(g) {
    const sp = g.spin, s = G.DB.save;
    if (!sp || sp.uid !== meUid()) return;
    const st = rlState();
    if (st.done[sp.sid]) return;
    st.done[sp.sid] = Date.now();
    const stake = Math.min(total(sp.bets), tickets());
    s.tickets.t1 = Math.max(0, s.tickets.t1 - stake);
    // (If you somehow had less than you bet, winnings are scaled to what was really on the table.)
    const back = payout(sp.bets, sp.n), k = total(sp.bets) ? stake / total(sp.bets) : 0;
    s.tickets.t1 += Math.floor(back * k);
    s.stats = s.stats || {};
    s.stats.rlSpins = (s.stats.rlSpins || 0) + 1;
    G.DB.commit(true);
  }

  // ---------------- your bets ----------------
  let chip = 1;
  let myBets = {}, myKey = '';                 // bets being placed this turn (kept across re-renders), for game:round
  let pushT = 0;
  function myTurn(g) { return g && g.phase === 'bet' && g.order[g.turn] === meUid(); }
  function syncMine(g, go) {
    clearTimeout(pushT);
    const v = { id: g.id, round: g.round, bets: myBets, go: go || 0 };
    if (go || solo) setMine(v);
    else pushT = setTimeout(() => setMine(v), 150);       // live chips for the watchers, not one write per tap
  }
  function placeBet(k) {
    const g = cur();
    if (!myTurn(g) || !validKey(k)) return;
    const left = tickets() - total(myBets);
    if (left <= 0) { G.UI.toast('You have no more ×1 tickets'); G.Audio.sfx('error'); return; }
    const v = Math.min(chip, left);
    myBets = Object.assign({}, myBets, { [k]: (myBets[k] || 0) + v });
    undo.push([k, v]);
    G.Audio.sfx('coin');
    syncMine(g);
    render();
  }
  let undo = [];
  function undoBet() {
    const g = cur(), u = undo.pop();
    if (!myTurn(g) || !u) return;
    const b = Object.assign({}, myBets); b[u[0]] -= u[1]; if (b[u[0]] <= 0) delete b[u[0]];
    myBets = b; syncMine(g); G.Audio.sfx('back'); render();
  }
  function clearBets() { const g = cur(); if (!myTurn(g)) return; myBets = {}; undo = []; syncMine(g); G.Audio.sfx('back'); render(); }
  function spin() {
    const g = cur();
    if (!myTurn(g) || !total(myBets)) return;
    if (tickets() < total(myBets)) { G.UI.toast('You don\'t have enough ×1 tickets for these bets'); return; }
    G.Audio.sfx('confirm');
    syncMine(g, 1);
    sent = g.id + ':' + g.round;
    render();
  }
  function pass() { const g = cur(); if (!myTurn(g)) return; myBets = {}; undo = []; syncMine(g, 'pass'); sent = g.id + ':' + g.round; render(); }
  let sent = '';

  // ---------------- screen ----------------
  let timer = 0, raf = 0, lastPhaseKey = '';
  function show() {
    if (G.Game.state !== 'ui') return;
    if (!G.UI.isOpen('scr-roulette')) G.UI.show('scr-roulette', true);
    clearInterval(timer);
    timer = setInterval(() => {
      if (!G.UI.isOpen('scr-roulette')) { clearInterval(timer); return; }
      hostTick(); clock();
    }, 400);
    render();
    loop();
  }
  function close() {
    clearInterval(timer); cancelAnimationFrame(raf);
    const wasSolo = !!solo;
    if (wasSolo) { solo = null; soloMine = null; }
    if (!G.UI.isOpen('scr-roulette')) return;
    if (room()) G.LobbyUI.open(); else G.MiniUI.open();
  }

  function clock() {
    const g = cur(), el = $('rl-clock');
    if (!el) return;
    el.textContent = g && g.phase === 'bet' && !solo ? Math.max(0, Math.ceil(TURN - (now() - g.turnAt) / 1000)) + ' s' : '';
  }

  /** The bets shown on the table: yours while you place them, otherwise the current player's (live, from the room). */
  function shownBets(g) {
    if (!g) return {};
    if (g.phase === 'spin' && g.spin) return g.spin.bets || {};
    const u = g.order[g.turn];
    if (u === meUid()) return myBets;
    const m = mineOf(u);
    return m && m.id === g.id && m.round === g.round ? cleanBets(m.bets) : {};
  }

  function cell(k, label, cls = '') {
    return `<button class="rl-c ${cls}" data-k="${k}"><span>${label}</span></button>`;
  }
  function tableHtml() {
    let h = '<div class="rl-table">' + cell('n0', '0', 'green zero');
    for (let row = 0; row < 3; row++) {                 // top row 3, 6 … 36; bottom row 1, 4 … 34
      for (let col = 0; col < 12; col++) {
        const n = col * 3 + (3 - row);
        h += cell('n' + n, n, colorOf(n)).replace('class="rl-c', `style="grid-row:${row + 1};grid-column:${col + 2}" class="rl-c`);
      }
      h += cell('c' + (3 - row), '2:1', 'out col').replace('class="rl-c', `style="grid-row:${row + 1};grid-column:14" class="rl-c`);
    }
    ['d1', 'd2', 'd3'].forEach((k, i) => { h += cell(k, OUTSIDE[k].label, 'out').replace('class="rl-c', `style="grid-row:4;grid-column:${2 + i * 4} / span 4" class="rl-c`); });
    ['low', 'even', 'red', 'black', 'odd', 'high'].forEach((k, i) => {
      h += cell(k, k === 'red' || k === 'black' ? '◆' : OUTSIDE[k].label, 'out ' + (k === 'red' || k === 'black' ? k : ''))
        .replace('class="rl-c', `style="grid-row:5;grid-column:${2 + i * 2} / span 2" class="rl-c`);
    });
    return h + '</div>';
  }

  function render() {
    const g = cur();
    if (!g) { if (G.UI.isOpen('scr-roulette')) close(); return; }
    if (g.phase === 'spin') settle(g);
    const key = g.id + ':' + g.round;
    if (myKey !== key) {                              // a new turn: start with an empty table
      myKey = key; myBets = {}; undo = []; sent = '';
    }
    const body = $('rl-body');
    if (!body.querySelector('.rl-table')) {
      body.innerHTML = `<div class="rl-top">
          <canvas id="rl-wheel" width="260" height="260"></canvas>
          <div class="rl-info"><div id="rl-turn" class="rl-turn"></div><div id="rl-res" class="rl-res"></div>
            <div class="rl-hist-l">Last numbers</div><div id="rl-hist" class="rl-hist"></div><div id="rl-seats" class="rl-seats"></div></div>
        </div>
        ${tableHtml()}
        <div id="rl-ctl" class="rl-ctl"></div>
        <p class="note">European wheel (one zero). Pays: a number 35 to 1 · a dozen or a column 2 to 1 · red, black, odd, even, 1-18 or 19-36 1 to 1. On 0 only bets on 0 win. No table limit: bet as many ×1 tickets as you have.</p>`;
      body.querySelectorAll('.rl-c').forEach(b => { b.onclick = () => placeBet(b.dataset.k); });
    }
    $('rl-back').textContent = solo ? 'Back' : 'Room';
    const spinning = g.phase === 'spin' && g.spin;
    const u = spinning ? g.spin.uid : g.order[g.turn], mine = u === meUid(), mt = myTurn(g);
    $('rl-turn').innerHTML = spinning ? `<b>${mine ? 'Your' : esc(nameOf(u)) + '\'s'} spin</b>`
      : mt ? (sent === key ? '<b>Spinning…</b>' : `<b class="gold">Your turn!</b> Place your chips <span id="rl-clock"></span>`)
      : `<b>${esc(nameOf(u))}</b> is betting… <span id="rl-clock"></span>`;
    $('rl-hist').innerHTML = (g.hist || []).slice(spinning && !landed(g) ? 1 : 0).map(n => `<i class="rl-h ${colorOf(n)}">${n}</i>`).join('') || '<small class="sub">None yet</small>';
    $('rl-seats').innerHTML = solo ? '' : g.order.map((x, i) => `<span class="rl-seat${i === g.turn ? ' now' : ''}">${esc(nameOf(x))}</span>`).join('');
    // Chips on the table.
    const bets = shownBets(g), tot = total(bets);
    const win = spinning && landed(g) ? g.spin.n : -1;
    $('rl-body').querySelectorAll('.rl-c').forEach(b => {
      const k = b.dataset.k, v = bets[k];
      let c = b.querySelector('.rl-chip');
      if (v && !c) { c = document.createElement('i'); c.className = 'rl-chip'; b.appendChild(c); }
      if (c) { if (v) c.textContent = v; else c.remove(); }
      b.disabled = !mt || sent === key;
      b.classList.toggle('hit', win >= 0 && wins(k, win));
      b.classList.toggle('lose', win >= 0 && !!v && !wins(k, win));
    });
    // Controls.
    const ctl = $('rl-ctl');
    ctl.innerHTML = '';
    if (mt && sent !== key) {
      const chips = document.createElement('div'); chips.className = 'rl-chips';
      for (const v of CHIPS) {
        const b = document.createElement('button'); b.className = 'rl-chipbtn' + (v === chip ? ' on' : ''); b.textContent = v;
        b.title = 'Chip of ' + plural(v); b.onclick = () => { chip = v; G.Audio.sfx('select'); render(); };
        chips.appendChild(b);
      }
      ctl.appendChild(chips);
      ctl.insertAdjacentHTML('beforeend', `<p class="center">On the table: <b class="gold">${plural(tot)}</b> · you have ${plural(tickets())}</p>`);
      const row = document.createElement('div'); row.className = 'row'; row.style.cssText = 'justify-content:center;gap:8px;flex-wrap:wrap';
      const add = (t, cls, fn, dis) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = t; b.onclick = fn; b.disabled = !!dis; row.appendChild(b); };
      add('Spin', 'gold', spin, !tot);
      add('Undo', 'ghost', undoBet, !undo.length);
      add('Clear', 'ghost', clearBets, !tot);
      if (!solo) add('Pass', 'ghost', pass);
      ctl.appendChild(row);
      if (tickets() < 1) ctl.insertAdjacentHTML('beforeend', '<p class="note">You need ×1 tickets to bet. Pass to let the next player go.</p>');
    } else if (!spinning && tot) {
      ctl.insertAdjacentHTML('beforeend', `<p class="center">${esc(nameOf(u))} has <b class="gold">${plural(tot)}</b> on the table</p>`);
    } else if (spinning) {
      ctl.insertAdjacentHTML('beforeend', `<p class="center">${mine ? 'You bet' : esc(nameOf(u)) + ' bet'} <b class="gold">${plural(total(g.spin.bets))}</b></p>`);
    }
    if (!solo && room() && room().isHost && !spinning && !mt) {
      const row = document.createElement('div'); row.className = 'row'; row.style.cssText = 'justify-content:center;gap:8px;margin-top:6px';
      const b = document.createElement('button'); b.className = 'btn small ghost'; b.textContent = 'Skip ' + nameOf(u) + '\'s turn';
      b.onclick = () => { const gg = cur(); if (gg && gg.phase === 'bet') write(nextTurn(gg)); };
      row.appendChild(b);
      ctl.appendChild(row);
    }
    if (!solo && room() && room().isHost) {
      const row = document.createElement('div'); row.className = 'row'; row.style.cssText = 'justify-content:center;margin-top:6px';
      const b = document.createElement('button'); b.className = 'btn small ghost'; b.textContent = 'Close the table';
      b.disabled = !!spinning; b.onclick = () => G.Social.setGame(null);
      row.appendChild(b);
      ctl.appendChild(row);
    }
    resultLine(g);
    clock();
  }

  // ---------------- the wheel ----------------
  const landed = g => g && g.spin && now() >= g.spin.at + SPIN_MS;
  function resultLine(g) {
    const el = $('rl-res');
    if (!el) return;
    if (!(g.phase === 'spin' && g.spin && landed(g))) { el.innerHTML = ''; return; }
    const sp = g.spin, n = sp.n, back = payout(sp.bets, n), bet = total(sp.bets), who = sp.uid === meUid() ? 'You' : esc(nameOf(sp.uid));
    const net = back - bet;
    el.innerHTML = `<b class="rl-num ${colorOf(n)}">${n}</b> ${n === 0 ? 'Zero' : colorOf(n) === 'red' ? 'Red' : 'Black'}<br>` +
      (net > 0 ? `${who} ${sp.uid === meUid() ? 'win' : 'wins'} <b class="gold">+${plural(net)}</b>`
        : net === 0 ? `${who} ${sp.uid === meUid() ? 'break' : 'breaks'} even`
        : `${who} ${sp.uid === meUid() ? 'lose' : 'loses'} <b>${plural(-net)}</b>`);
  }

  const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const STEP = Math.PI * 2 / WHEEL.length;
  let idleA = 0, lastT = 0, lastTick = -1, phaseSeen = '';
  /** Wheel and ball angles at time `t` of a spin (the same on every screen). */
  function spinPose(sp, t) {
    const p = G.U.clamp(t / SPIN_MS, 0, 1);
    const ew = 1 - Math.pow(1 - p, 3), eb = 1 - Math.pow(1 - p, 2.4);
    const w0 = (hashStr(sp.sid) % 3600) / 3600 * Math.PI * 2;
    const wheel = w0 + ew * Math.PI * 2 * 2.5;
    const idx = WHEEL.indexOf(sp.n);
    const ballEnd = w0 + Math.PI * 2 * 2.5 + idx * STEP;
    const ball = ballEnd - (1 - eb) * Math.PI * 2 * 7;           // the ball runs the other way and slows down
    // The ball rides the outer track, then drops into the pockets with a little bounce.
    const drop = G.U.clamp((p - 0.62) / 0.3, 0, 1);
    const bounce = drop < 1 ? Math.abs(Math.sin(drop * Math.PI * 3)) * (1 - drop) * 0.12 : 0;
    return { wheel, ball, br: 1 - drop * 0.27 + bounce, p };
  }
  function loop() {
    cancelAnimationFrame(raf);
    const frame = ts => {
      if (!G.UI.isOpen('scr-roulette')) return;
      const dt = lastT ? Math.min(0.1, (ts - lastT) / 1000) : 0; lastT = ts;
      draw(dt);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }
  function draw(dt) {
    const cv = $('rl-wheel'), g = cur();
    if (!cv || !g) return;
    const ctx = cv.getContext('2d'), W = cv.width, R = W / 2 - 6, cx = W / 2, cy = W / 2;
    let wheelA, ballA = null, br = 1;
    if (g.phase === 'spin' && g.spin) {
      const t = now() - g.spin.at;
      const ps = spinPose(g.spin, Math.max(0, t));
      wheelA = ps.wheel; ballA = ps.ball; br = ps.br;
      idleA = wheelA;
      // A click each time the ball passes a pocket (fewer as it slows).
      if (t > 0 && ps.p < 1) {
        const k = Math.floor((ballA - wheelA) / STEP);
        if (k !== lastTick && ps.p < 0.92) { lastTick = k; if (Math.random() < 0.5) G.Audio.sfx('hover'); }
      }
      const pk = g.spin.sid + (ps.p >= 1 ? ':land' : '');
      if (phaseSeen !== pk) {
        if (ps.p >= 1 && phaseSeen === g.spin.sid) {
          const net = payout(g.spin.bets, g.spin.n) - total(g.spin.bets);
          G.Audio.sfx(net > 0 ? 'legend' : net === 0 ? 'select' : 'back');
          if (g.spin.uid === meUid()) G.UI.refreshCoins();
          render();
        }
        phaseSeen = pk;
      }
    } else {
      idleA += dt * 0.25; wheelA = idleA;
      const last = (g.hist || [])[0];
      if (last != null) { ballA = wheelA + WHEEL.indexOf(last) * STEP; br = 0.73; }
      if (phaseSeen !== '') phaseSeen = '';
    }
    ctx.clearRect(0, 0, W, W);
    // Rim.
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = '#5b3a1c'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.93, 0, Math.PI * 2); ctx.fillStyle = '#2a1a0c'; ctx.fill();
    // Pockets.
    const r1 = R * 0.86, r0 = R * 0.6;
    for (let i = 0; i < WHEEL.length; i++) {
      const n = WHEEL[i], a = wheelA + i * STEP - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - STEP / 2) * r0, cy + Math.sin(a - STEP / 2) * r0);
      ctx.arc(cx, cy, r1, a - STEP / 2, a + STEP / 2);
      ctx.arc(cx, cy, r0, a + STEP / 2, a - STEP / 2, true);
      ctx.closePath();
      ctx.fillStyle = n === 0 ? '#1f8f4a' : RED.has(n) ? '#c8283a' : '#1b1b24';
      ctx.fill();
      ctx.strokeStyle = '#d9b45a'; ctx.lineWidth = 1; ctx.stroke();
      ctx.save();
      ctx.translate(cx + Math.cos(a) * (r1 - 11), cy + Math.sin(a) * (r1 - 11));
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = '#fff'; ctx.font = '12px "Pixeloid Sans", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n, 0, 0);
      ctx.restore();
    }
    // Hub.
    ctx.beginPath(); ctx.arc(cx, cy, r0, 0, Math.PI * 2); ctx.fillStyle = '#3a2412'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r0 * 0.45, 0, Math.PI * 2); ctx.fillStyle = '#d9b45a'; ctx.fill();
    for (let i = 0; i < 4; i++) {
      const a = wheelA + i * Math.PI / 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r0 * 0.85, cy + Math.sin(a) * r0 * 0.85);
      ctx.strokeStyle = '#d9b45a'; ctx.lineWidth = 4; ctx.stroke();
    }
    // Ball.
    if (ballA != null) {
      const a = ballA - Math.PI / 2, rr = R * 0.97 * br - 6;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#f6f6f6'; ctx.fill(); ctx.strokeStyle = '#999'; ctx.lineWidth = 1; ctx.stroke();
    }
  }

  // ---------------- wiring ----------------
  function onGame() {
    const g = roomGame();
    if (G.Game.state !== 'ui') return;
    if (g) { solo = null; show(); return; }
    if (!solo && G.UI.isOpen('scr-roulette')) G.LobbyUI.open();
  }

  function init() {
    // The host runs the table even with the roulette screen closed (in the room, another menu), so turns keep moving.
    setInterval(() => { const r = room(); if (!solo && r && r.isHost && roomGame() && G.Game.state === 'ui') hostTick(); }, 500);
    $('rl-back').onclick = () => {
      const g = cur();
      if (solo && g && g.phase === 'spin' && !landed(g)) { G.UI.toast('Wait for the ball to stop'); return; }
      close();
    };
    G.Social.on(what => {
      if (what === 'game') onGame();
      else if (what === 'room' && G.UI.isOpen('scr-roulette')) { hostTick(); render(); }
    });
  }

  return { init, open, show, isOn: () => !!roomGame() };
})();
