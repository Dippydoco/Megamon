/* ============ blackjack.js — Mini-Game: Blackjack against Murkrow (08-11-2026) ============
 * Each player plays their own hand against the dealer, Murkrow, betting ×1 tickets.
 * In a friends room (like Roulette, ui/roulette.js) players take turns at one table and the room watches:
 *   - the host writes the table to rooms/{id}/g = { type:'bj', id, order:[uid], turn, round, turnAt }
 *     and only runs the turns (who plays, skipping players who are away);
 *   - the player whose turn it is plays the hand on their own device and writes it to rooms/{id}/m/{uid}/bj =
 *     { id, round, at, st } so everyone sees it (the dealer's hole card stays hidden until it is turned over),
 *     and settles their own tickets (save.bj.done[hand id]).
 * Alone (no room): a table on this device only (`solo`).
 *
 * Rules: 6-deck shoe, freshly shuffled every hand. Dealer stands on all 17s. Blackjack pays 3 to 2 (rounded down),
 * a win 1 to 1, a tie returns the bet. Double down on the first two cards (one more card, bet doubled).
 * No splitting or insurance. The dealer checks for blackjack when showing an Ace or a ten.
 */
G.BlackjackUI = (() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DEALER = 198;                          // Murkrow
  const TURN = 45;                             // seconds to place a bet on your turn
  const IDLE = 60;                             // seconds without a move mid-hand before the turn is skipped
  const SHOW_MS = 3500;                        // the result stays up this long before the next player
  const STEP_MS = 650;                         // the dealer draws one card every STEP_MS
  const CHIPS = [1, 5, 10, 25, 100];

  // ---- hands ----
  const cardVal = c => (c[0] === 'A' ? 11 : 'TJQK'.includes(c[0]) ? 10 : +c[0]);
  function value(cards) {
    let t = 0, aces = 0;
    for (const c of cards || []) { if (!c || c === '??') continue; t += cardVal(c); if (c[0] === 'A') aces++; }
    while (t > 21 && aces) { t -= 10; aces--; }
    return { t, soft: aces > 0 };
  }
  const isBJ = cards => cards.length === 2 && value(cards).t === 21;

  // ---- room / solo plumbing ----
  const room = () => G.Social.room;
  const meUid = () => G.Social.uid || 'me';
  const now = () => G.Social.syncNow();
  const tickets = () => (G.DB.save.tickets || {}).t1 || 0;
  const plural = n => n + ' ×1 ticket' + (n === 1 ? '' : 's');
  let solo = null, soloMine = null;
  const roomGame = () => { const g = room() && room().game; return g && g.type === 'bj' ? g : null; };
  const cur = () => solo || roomGame();
  const isHost = () => !!solo || !!(room() && room().isHost);
  function write(g) { if (solo) { solo = g; render(); } else G.Social.setGame(g); }
  function mineOf(uid) {
    if (solo) return uid === meUid() ? soloMine : null;
    return ((room() && room().members.find(m => m.uid === uid)) || {}).bj || null;
  }
  function setMine(v) { if (solo) { soloMine = v; render(); } else G.Social.setMine('bj', v); }
  const nameOf = uid => (solo ? 'You' : ((room() && room().members.find(m => m.uid === uid)) || {}).name || (uid === meUid() ? 'You' : 'Someone'));

  function bjState() {
    const s = G.DB.save;
    s.bj = s.bj && typeof s.bj === 'object' ? s.bj : {};
    const done = s.bj.done && typeof s.bj.done === 'object' ? s.bj.done : {};
    const cut = Date.now() - 3 * 864e5;
    for (const k in done) if (typeof done[k] !== 'number' || done[k] < cut) delete done[k];
    s.bj = { done };
    return s.bj;
  }

  // ---------------- the table (host) ----------------
  const fresh = order => ({ type: 'bj', id: Date.now().toString(36), order, turn: 0, round: 0, turnAt: now() });
  function nextTurn(g, order = g.order) {
    const turn = order.length ? (g.turn + 1) % order.length : 0;
    return Object.assign({}, g, { order, turn, round: (g.round || 0) + 1, turnAt: now() });
  }
  function open() {
    if (G.Game.state !== 'ui') return;
    const r = room();
    if (r) {
      if (r.game && r.game.type !== 'bj') { G.UI.toast('Another mini-game is on: finish it first'); return; }
      if (!r.game) {
        if (!r.isHost) { G.UI.toast('Only the host can open the table'); return; }
        solo = null;
        G.Social.setGame(fresh(r.members.map(m => m.uid)));
        return;
      }
      solo = null; show(); return;
    }
    solo = fresh([meUid()]); soloMine = null;
    show();
  }

  function hostTick() {
    const g = cur();
    if (!g || !isHost()) return;
    if (!solo) {
      const here = room().members.map(m => m.uid);
      const gone = g.order.filter(u => !here.includes(u)), added = here.filter(u => !g.order.includes(u));
      if (gone.length || added.length) {
        const curU = g.order[g.turn];
        const order = g.order.filter(u => here.includes(u)).concat(added);
        if (!order.length) { write(null); return; }
        let turn = order.indexOf(curU);
        if (turn < 0) {
          const rest = g.order.slice(g.turn + 1).concat(g.order.slice(0, g.turn)).find(u => here.includes(u));
          write(Object.assign({}, g, { order, turn: Math.max(0, order.indexOf(rest)), round: (g.round || 0) + 1, turnAt: now() }));
          return;
        }
        write(Object.assign({}, g, { order, turn }));
        return;
      }
    }
    const u = g.order[g.turn], m = mineOf(u);
    const mine = m && m.id === g.id && m.round === g.round ? m : null;
    if (mine && mine.pass) { write(nextTurn(g)); return; }
    if (mine && mine.st && mine.st.ph === 'done') { if (now() > (mine.at || 0) + SHOW_MS) write(nextTurn(g)); return; }
    if (solo) return;                                       // alone there's no clock
    if (mine && mine.st) { if (now() - (mine.at || 0) > IDLE * 1000) write(nextTurn(g)); return; }
    if (now() - g.turnAt > TURN * 1000) write(nextTurn(g));
  }

  // ---------------- your hand ----------------
  // The full hand lives here; what is published hides the dealer's hole card until it is turned over.
  let hand = null;                 // { gid, round, sid, bet, p, d, hide, ph, res, ret, dbl, shoe }
  let wantBet = 5, busy = false;
  const myTurn = g => g && g.order[g.turn] === meUid();
  function publish() {
    const h = hand;
    if (!h) return;
    const st = { sid: h.sid, bet: h.bet, p: h.p, d: h.hide ? [h.d[0], '??'] : h.d, ph: h.ph, res: h.res || '', ret: h.ret || 0, dbl: h.dbl ? 1 : 0 };
    setMine({ id: h.gid, round: h.round, at: now(), st });
  }
  const draw = () => hand.shoe.pop();

  function deal() {
    const g = cur();
    if (!myTurn(g) || busy || (hand && hand.gid === g.id && hand.round === g.round)) return;
    const bet = Math.floor(wantBet);
    if (bet < 1) return;
    if (tickets() < bet) { G.UI.toast('You don\'t have enough ×1 tickets'); return; }
    const s = G.DB.save;
    const sid = g.id + '-' + g.round + '-' + meUid().slice(0, 6);
    if (bjState().done[sid]) return;
    s.tickets.t1 -= bet;                                    // the bet goes on the table now
    bjState().done[sid] = Date.now();
    G.DB.commit(true);
    G.UI.refreshCoins();
    hand = { gid: g.id, round: g.round, sid, bet, p: [], d: [], hide: true, ph: 'play', res: '', ret: 0, dbl: false, shoe: G.Cards.shoe(6) };
    hand.p.push(draw()); hand.d.push(draw()); hand.p.push(draw()); hand.d.push(draw());
    G.Audio.sfx('confirm');
    say('Cards are out!');
    anim('Nod');
    // Naturals: the dealer peeks when showing an Ace or a ten.
    const pBJ = isBJ(hand.p), dBJ = isBJ(hand.d), peek = 'AKQJT'.includes(hand.d[0][0]);
    if (pBJ || (peek && dBJ)) {
      hand.hide = false;
      finish(pBJ && dBJ ? 'push' : pBJ ? 'bj' : 'lose');
      return;
    }
    publish(); render();
  }
  function hit() {
    if (!canAct()) return;
    hand.p.push(draw());
    G.Audio.sfx('select');
    const v = value(hand.p).t;
    if (v > 21) { hand.hide = false; finish('bust'); return; }
    if (v === 21) { stand(); return; }
    publish(); render();
  }
  function double() {
    if (!canAct() || hand.p.length !== 2 || tickets() < hand.bet) return;
    G.DB.save.tickets.t1 -= hand.bet;
    G.DB.commit(true); G.UI.refreshCoins();
    hand.bet *= 2; hand.dbl = true;
    hand.p.push(draw());
    G.Audio.sfx('coin');
    if (value(hand.p).t > 21) { hand.hide = false; finish('bust'); return; }
    stand();
  }
  function stand() {
    if (!canAct()) return;
    hand.ph = 'dealer'; hand.hide = false; busy = true;
    publish(); render();
    const step = () => {
      if (!hand || hand.ph !== 'dealer') { busy = false; return; }
      if (value(hand.d).t < 17) {
        hand.d.push(draw());
        G.Audio.sfx('select');
        publish(); render();
        setTimeout(step, STEP_MS);
        return;
      }
      busy = false;
      const d = value(hand.d).t, p = value(hand.p).t;
      finish(d > 21 ? 'dbust' : p > d ? 'win' : p === d ? 'push' : 'lose');
    };
    setTimeout(step, STEP_MS);
  }
  const canAct = () => { const g = cur(); return hand && hand.ph === 'play' && !busy && g && hand.gid === g.id && hand.round === g.round && myTurn(g); };
  const RET = { bj: 2.5, win: 2, dbust: 2, push: 1, lose: 0, bust: 0 };
  function finish(res) {
    hand.res = res; hand.ph = 'done'; hand.hide = false;
    hand.ret = res === 'bj' ? hand.bet + Math.floor(hand.bet * 1.5) : Math.round(hand.bet * RET[res]);
    if (hand.ret) { G.DB.save.tickets.t1 += hand.ret; G.DB.commit(true); G.UI.refreshCoins(); }
    publish(); render();
  }
  /** Your turn was skipped mid-hand (away too long): you stand, the dealer plays it out at once, you're paid. */
  function abandon() {
    if (!hand || hand.ph === 'done') return;
    hand.ph = 'dealer'; hand.hide = false; busy = false;
    while (value(hand.d).t < 17) hand.d.push(draw());
    const d = value(hand.d).t, p = value(hand.p).t;
    const res = p > 21 ? 'bust' : d > 21 ? 'dbust' : p > d ? 'win' : p === d ? 'push' : 'lose';
    hand.res = res; hand.ph = 'done';
    hand.ret = Math.round(hand.bet * RET[res]);
    if (hand.ret) { G.DB.save.tickets.t1 += hand.ret; G.DB.commit(true); G.UI.refreshCoins(); }
    G.UI.toast('Your blackjack hand was played out for you: ' + (hand.ret > hand.bet ? 'won' : hand.ret === hand.bet ? 'push' : 'lost'), 3200);
  }
  function pass() { const g = cur(); if (!myTurn(g) || hand && hand.gid === g.id && hand.round === g.round) return; setMine({ id: g.id, round: g.round, at: now(), pass: 1 }); }

  // ---------------- Murkrow ----------------
  let speech = '', animator = null, mkRaf = 0, lastTs = 0;
  function say(t) { speech = t; const el = $('bj-say'); if (el) el.textContent = t; }
  function anim(a) { if (animator) animator.play(a); }
  function dealerLoop() {
    cancelAnimationFrame(mkRaf);
    const frame = ts => {
      if (!G.UI.isOpen('scr-bj')) return;
      const cv = $('bj-murkrow');
      if (cv) {
        if (!animator) { animator = new G.Sprites.Animator(DEALER, 2); animator.dir = 0; animator.loop('Idle'); }
        const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0; lastTs = ts;
        animator.update(dt);
        const c = cv.getContext('2d');
        c.imageSmoothingEnabled = false;
        c.clearRect(0, 0, cv.width, cv.height);
        animator.draw(c, cv.width / 2, cv.height - 6);
      }
      mkRaf = requestAnimationFrame(frame);
    };
    mkRaf = requestAnimationFrame(frame);
  }

  // ---------------- screen ----------------
  let timer = 0;
  function show() {
    if (G.Game.state !== 'ui') return;
    if (!G.UI.isOpen('scr-bj')) G.UI.show('scr-bj', true);
    clearInterval(timer);
    timer = setInterval(() => { if (!G.UI.isOpen('scr-bj')) { clearInterval(timer); return; } hostTick(); clock(); }, 400);
    G.Sprites.preload([DEALER]);
    render();
    dealerLoop();
  }
  function close() {
    clearInterval(timer); cancelAnimationFrame(mkRaf);
    if (solo) { if (hand && hand.ph !== 'done' && hand.gid === solo.id) abandon(); solo = null; soloMine = null; }
    if (!G.UI.isOpen('scr-bj')) return;
    if (room()) G.LobbyUI.open(); else G.MiniUI.open();
  }
  function clock() {
    const g = cur(), el = $('bj-clock');
    if (!el) return;
    const m = g && mineOf(g.order[g.turn]);
    const started = m && m.id === g.id && m.round === g.round && m.st;
    el.textContent = g && !solo && !started ? Math.max(0, Math.ceil(TURN - (now() - g.turnAt) / 1000)) + ' s' : '';
  }

  const RES_TEXT = { bj: 'Blackjack!', win: 'Win!', dbust: 'Murkrow busts!', push: 'Push', lose: 'Murkrow wins', bust: 'Bust!' };
  let lastRes = '';
  function render() {
    const g = cur();
    if (!g) { if (G.UI.isOpen('scr-bj')) close(); return; }
    // Your hand from a turn that has moved on (skipped while away): finish it so the tickets are settled.
    if (hand && hand.ph !== 'done' && (hand.gid !== g.id || hand.round !== g.round)) abandon();
    const body = $('bj-body');
    if (!body.querySelector('#bj-murkrow')) {
      body.innerHTML = `<div class="bj-dealer"><canvas id="bj-murkrow" width="128" height="128"></canvas><div class="bj-bubble" id="bj-say"></div></div>
        <div class="bj-felt">
          <div class="bj-row"><small>Murkrow</small><div class="bj-cards" id="bj-dcards"></div><b class="bj-tot" id="bj-dtot"></b></div>
          <div class="bj-mid" id="bj-mid"></div>
          <div class="bj-row"><small id="bj-pname"></small><div class="bj-cards" id="bj-pcards"></div><b class="bj-tot" id="bj-ptot"></b></div>
        </div>
        <div id="bj-turn" class="center bj-turn"></div>
        <div id="bj-ctl" class="rl-ctl"></div>
        <div id="bj-seats" class="rl-seats" style="justify-content:center;margin-top:8px"></div>
        <p class="note">6 decks, shuffled every hand. Murkrow stands on 17. Blackjack pays 3 to 2, a win 1 to 1, a tie gives your bet back. Double down on your first two cards. No splitting.</p>`;
      say(speech || 'Place your bet!');
    }
    $('bj-back').textContent = solo ? 'Back' : 'Room';
    const u = g.order[g.turn], mt = myTurn(g);
    const m = mineOf(u), mine = m && m.id === g.id && m.round === g.round ? m : null;
    // What's on the felt: your own full hand on your turn, otherwise the current player's published one.
    const live = mt && hand && hand.gid === g.id && hand.round === g.round;
    const st = live ? { bet: hand.bet, p: hand.p, d: hand.hide ? [hand.d[0], '??'] : hand.d, ph: hand.ph, res: hand.res, ret: hand.ret, dbl: hand.dbl }
      : mine && mine.st ? mine.st : null;
    const prevD = $('bj-dcards').children.length, prevP = $('bj-pcards').children.length;
    $('bj-dcards').innerHTML = st ? G.Cards.row(st.d, {}) : '';
    $('bj-pcards').innerHTML = st ? G.Cards.row(st.p, {}) : '';
    // Fresh cards slide in.
    [...$('bj-dcards').children].slice(prevD).forEach(c => c.classList.add('in'));
    [...$('bj-pcards').children].slice(prevP).forEach(c => c.classList.add('in'));
    const dv = st ? value(st.d) : null, pv = st ? value(st.p) : null;
    $('bj-dtot').textContent = st && st.d.length ? (st.d.includes('??') ? value([st.d[0]]).t + ' + ?' : dv.t) : '';
    $('bj-ptot').textContent = st && st.p.length ? (pv.soft && pv.t < 21 && st.ph === 'play' ? (pv.t - 10) + ' / ' + pv.t : pv.t) : '';
    $('bj-pname').textContent = mt ? 'You' : nameOf(u);
    // Middle: the bet, then the result.
    const who = mt ? 'You' : esc(nameOf(u));
    let mid = '';
    if (st) {
      mid = `<span class="bj-bet">Bet ${plural(st.bet)}${st.dbl ? ' (doubled)' : ''}</span>`;
      if (st.ph === 'done') {
        const net = st.ret - st.bet;
        mid += `<span class="bj-res ${net > 0 ? 'win' : net < 0 ? 'lose' : ''}">${RES_TEXT[st.res] || ''} ${net > 0 ? who + ' +' + plural(net) : net < 0 ? who + ' −' + plural(-net) : ''}</span>`;
      }
    }
    $('bj-mid').innerHTML = mid;
    // Murkrow reacts once per result.
    const rk = st && st.ph === 'done' ? g.id + ':' + g.round + ':' + st.res : '';
    if (rk && rk !== lastRes) {
      lastRes = rk;
      const net = st.ret - st.bet;
      anim(net > 0 ? 'Hurt' : net < 0 ? 'Pose' : 'Nod');
      say(st.res === 'dbust' ? 'Caw! I bust…' : st.res === 'bj' ? 'Blackjack… lucky!' : net > 0 ? 'You got me this time.' : net < 0 ? (st.res === 'bust' ? 'Too many! Caw caw!' : 'The house wins. Caw!') : 'A tie. Bets back.');
      G.Audio.sfx(net > 0 ? 'legend' : net < 0 ? 'back' : 'select');
    } else if (!st) say(mt ? 'Place your bet!' : nameOf(u) + ' is betting…');
    else if (st.ph === 'play') say(mt ? 'Hit or stand?' : nameOf(u) + ' is thinking…');
    else if (st.ph === 'dealer') say('My turn…');
    $('bj-turn').innerHTML = mt ? (st ? '' : '<b class="gold">Your turn!</b> Place a bet <span id="bj-clock"></span>')
      : `<b>${esc(nameOf(u))}</b>${st ? '\'s hand' : ' is betting… <span id="bj-clock"></span>'}`;
    $('bj-seats').innerHTML = solo ? '' : g.order.map((x, i) => `<span class="rl-seat${i === g.turn ? ' now' : ''}">${esc(nameOf(x))}</span>`).join('');
    // Controls.
    const ctl = $('bj-ctl');
    ctl.innerHTML = '';
    const row = () => { const r = document.createElement('div'); r.className = 'row'; r.style.cssText = 'justify-content:center;gap:8px;flex-wrap:wrap;margin-top:6px'; ctl.appendChild(r); return r; };
    const add = (r, t, cls, fn, dis) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = t; b.onclick = fn; b.disabled = !!dis; r.appendChild(b); return b; };
    if (mt && !live && !(mine && mine.pass)) {
      wantBet = Math.max(0, Math.min(wantBet, tickets()));
      const chips = document.createElement('div'); chips.className = 'rl-chips';
      for (const v of CHIPS) {
        const b = document.createElement('button'); b.className = 'rl-chipbtn'; b.textContent = '+' + v;
        b.onclick = () => { if (wantBet + v > tickets()) { G.UI.toast('You only have ' + plural(tickets())); return; } wantBet += v; G.Audio.sfx('coin'); render(); };
        chips.appendChild(b);
      }
      ctl.appendChild(chips);
      ctl.insertAdjacentHTML('beforeend', `<p class="center">Bet: <b class="gold">${plural(wantBet)}</b> · you have ${plural(tickets())}</p>`);
      const r = row();
      add(r, 'Deal', 'gold', deal, wantBet < 1 || tickets() < wantBet);
      add(r, 'Clear bet', 'ghost', () => { wantBet = 0; render(); }, !wantBet);
      if (!solo) add(r, 'Pass', 'ghost', pass);
      if (tickets() < 1) ctl.insertAdjacentHTML('beforeend', '<p class="note">You need ×1 tickets to play.</p>');
    } else if (live && hand.ph === 'play') {
      const r = row();
      add(r, 'Hit', 'gold', hit, busy);
      add(r, 'Stand', '', stand, busy);
      add(r, 'Double', 'ghost', double, busy || hand.p.length !== 2 || tickets() < hand.bet);
    } else if (live && hand.ph === 'done' && solo) {
      const r = row();
      add(r, 'Next hand', 'gold', () => { const gg = cur(); if (gg) write(nextTurn(gg)); });
    }
    if (!solo && room() && room().isHost) {
      const r = row();
      if (!mt && !(st && st.ph !== 'done')) add(r, 'Skip ' + nameOf(u) + '\'s turn', 'small ghost', () => { const gg = cur(); if (gg) write(nextTurn(gg)); });
      add(r, 'Close the table', 'small ghost', () => G.Social.setGame(null), !!(st && st.ph !== 'done'));
    }
    clock();
  }

  // ---------------- wiring ----------------
  function onGame() {
    const g = roomGame();
    if (G.Game.state !== 'ui') return;
    if (g) { solo = null; show(); return; }
    if (hand && hand.ph !== 'done' && !solo) abandon();      // the table closed mid-hand
    if (!solo && G.UI.isOpen('scr-bj')) G.LobbyUI.open();
  }
  function init() {
    $('bj-back').onclick = () => {
      if (solo && hand && hand.ph !== 'done' && hand.gid === solo.id) { G.UI.toast('Finish your hand first'); return; }
      close();
    };
    setInterval(() => { const r = room(); if (!solo && r && r.isHost && roomGame() && G.Game.state === 'ui') hostTick(); }, 500);
    G.Social.on(what => {
      if (what === 'game') onGame();
      else if (what === 'room' && G.UI.isOpen('scr-bj')) { hostTick(); render(); }
    });
  }

  return { init, open, show, isOn: () => !!roomGame(), value };
})();
