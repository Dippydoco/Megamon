/* ============ poker.js — Mini-Game: Texas Hold'em between players (08-11-2026) ============
 * No-limit Texas Hold'em in a friends room, played with ×1 tickets (blinds 1 and 2). Like the other mini-games it
 * needs no new servers or rules:
 *   - the host deals and runs the table: rooms/{id}/g = { type:'pk', id, seats:[uid], phase:'wait'|'hand', h, res, nextAt }
 *   - each player writes their seat and moves to rooms/{id}/m/{uid}/pk = { id, sit, bal, n, seq, a, amt }
 *     (bal: their ×1 tickets, read by the host when a hand starts: that is their stack for the hand)
 *   - hole cards go only to their owner, over the room's peer channel (G.Net: direct, or the owner-only relay queue
 *     rooms/{id}/q/{uid}); a player who missed them asks the host again ('pkq'). Nobody else sees them until a showdown.
 *     (The host's device deals, so it knows the deck: fine among friends.)
 * Tickets move only when a hand ends: the host writes each player's result to g.res and every player applies their
 * own once (save.pk.done[hand id]). Closing the table mid-hand moves nothing.
 *
 * h = { n, hid, ps:[uid in seat order, dealer first], st:{uid: stack left}, bet:{uid: this street}, put:{uid: this hand},
 *       fold:{uid:1}, all:{uid:1}, board:[cards], street 0-3, cur, minR, acted:{uid:1}, to, seq, at, last:{u,a,amt},
 *       done, show:{uid:[cards]}, win:{uid:n}, desc:{uid:'Two Pair'}, sb, bb }
 */
G.PokerUI = (() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SB = 1, BB = 2;
  const ACT = 30;                              // seconds to act (then check if possible, otherwise fold)
  const SHOW_MS = 7000;                        // a finished hand stays up this long before the next deal
  const START_MS = 3000;                       // first deal this long after enough players sit
  const STREETS = ['Pre-flop', 'Flop', 'Turn', 'River', 'Showdown'];

  // ---------------- hand ranking ----------------
  const V = c => '23456789TJQKA'.indexOf(c[0]) + 2;
  const CAT = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'];
  function eval5(cs) {
    const vals = cs.map(V).sort((a, b) => b - a);
    const flush = cs.every(c => c[1] === cs[0][1]);
    const uniq = [...new Set(vals)];
    let straight = 0;
    if (uniq.length === 5) {
      if (vals[0] - vals[4] === 4) straight = vals[0];
      else if (vals.join() === '14,5,4,3,2') straight = 5;           // the wheel
    }
    if (straight && flush) return [8, straight];
    const cnt = {};
    for (const v of vals) cnt[v] = (cnt[v] || 0) + 1;
    const groups = Object.keys(cnt).map(Number).sort((a, b) => cnt[b] - cnt[a] || b - a);
    const shape = groups.map(v => cnt[v]).join('');
    if (shape === '41') return [7, ...groups];
    if (shape === '32') return [6, ...groups];
    if (flush) return [5, ...vals];
    if (straight) return [4, straight];
    if (shape === '311') return [3, ...groups];
    if (shape === '221') return [2, ...groups];
    if (shape === '2111') return [1, ...groups];
    return [0, ...vals];
  }
  const cmp = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; };
  /** Best 5 of up to 7 cards. */
  function best(cards) {
    let top = null;
    const n = cards.length;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
      const s = eval5([cards[a], cards[b], cards[c], cards[d], cards[e]]);
      if (!top || cmp(s, top) > 0) top = s;
    }
    return top;
  }
  const NAME_V = v => ({ 14: 'Aces', 13: 'Kings', 12: 'Queens', 11: 'Jacks', 10: 'Tens', 9: 'Nines', 8: 'Eights', 7: 'Sevens', 6: 'Sixes', 5: 'Fives', 4: 'Fours', 3: 'Threes', 2: 'Twos' }[v]);
  const HIGH_V = v => ({ 14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack', 10: 'Ten' }[v] || String(v));
  function describe(s) {
    switch (s[0]) {
      case 8: return s[1] === 14 ? 'Royal Flush' : 'Straight Flush, ' + HIGH_V(s[1]) + ' high';
      case 7: return 'Four ' + NAME_V(s[1]);
      case 6: return 'Full House, ' + NAME_V(s[1]) + ' over ' + NAME_V(s[2]);
      case 5: return 'Flush, ' + HIGH_V(s[1]) + ' high';
      case 4: return 'Straight, ' + HIGH_V(s[1]) + ' high';
      case 3: return 'Three ' + NAME_V(s[1]);
      case 2: return 'Two Pair, ' + NAME_V(s[1]) + ' and ' + NAME_V(s[2]);
      case 1: return 'Pair of ' + NAME_V(s[1]);
      default: return HIGH_V(s[1]) + ' high';
    }
  }

  // ---------------- plumbing ----------------
  const room = () => G.Social.room;
  const meUid = () => G.Social.uid || 'me';
  const now = () => G.Social.syncNow();
  const tickets = () => (G.DB.save.tickets || {}).t1 || 0;
  const plural = n => n + ' ×1 ticket' + (n === 1 ? '' : 's');
  const game = () => { const g = room() && room().game; return g && g.type === 'pk' ? g : null; };
  const isHost = () => !!(room() && room().isHost);
  const memberOf = uid => (room() && room().members.find(m => m.uid === uid)) || null;
  const nameOf = uid => (uid === meUid() ? 'You' : (memberOf(uid) || {}).name || 'Someone');
  const pkOf = uid => { const g = game(), m = memberOf(uid); return g && m && m.pk && m.pk.id === g.id ? m.pk : null; };
  const O = v => v || {};                         // (the database drops empty objects)
  const A = v => v || [];

  function pkState() {
    const s = G.DB.save;
    s.pk = s.pk && typeof s.pk === 'object' ? s.pk : {};
    const done = s.pk.done && typeof s.pk.done === 'object' ? s.pk.done : {};
    const cut = Date.now() - 3 * 864e5;
    for (const k in done) if (typeof done[k] !== 'number' || done[k] < cut) delete done[k];
    s.pk = { done };
    return s.pk;
  }

  // ---------------- your seat ----------------
  let mine = null;                                // what you last wrote to m/{you}/pk
  function writeMine(extra) {
    const g = game();
    if (!g) return;
    mine = Object.assign({}, mine && mine.id === g.id ? mine : { id: g.id, sit: 0 }, { bal: tickets() }, extra || {});
    G.Social.setMine('pk', mine);
  }
  function sit(on) {
    if (on && tickets() < BB) { G.UI.toast('You need at least ' + BB + ' ×1 tickets to sit down'); return; }
    G.Audio.sfx(on ? 'confirm' : 'back');
    writeMine({ sit: on ? 1 : 0 });
  }
  function act(a, amt) {
    const g = game(), h = g && g.h;
    if (!h || h.done || h.to !== meUid()) return;
    G.Audio.sfx(a === 'fold' ? 'back' : a === 'raise' ? 'coin' : 'select');
    writeMine({ n: h.n, seq: h.seq, a, amt: amt || 0 });
  }

  // ---------------- hole cards ----------------
  let hole = null;                                // { id, n, c:[2 cards] } your cards for hand n
  let holes = {}, deck = [], holesFor = '';       // host only: everyone's cards and the deck, for hand `holesFor`
  let askT = 0;
  function onNet(from, msg) {
    if (!msg || (msg.k !== 'pkh' && msg.k !== 'pkq')) return;
    const g = game();
    if (!g) return;
    if (msg.k === 'pkh' && room() && from === room().host && msg.id === g.id) {
      hole = { id: msg.id, n: msg.n, c: msg.c };
      if (G.UI.isOpen('scr-poker')) render();
    } else if (msg.k === 'pkq' && isHost() && msg.id === g.id && holesFor === g.id + ':' + msg.n && holes[from]) {
      G.Net.send(from, { k: 'pkh', id: g.id, n: msg.n, c: holes[from] });
    }
  }
  /** In a hand without your cards (missed message, reload): ask the host again, at most every 2 s. */
  function askHole() {
    const g = game(), h = g && g.h;
    if (!h || h.done || isHost() || !A(h.ps).includes(meUid())) return;
    if (hole && hole.id === g.id && hole.n === h.n) return;
    if (Date.now() - askT < 2000) return;
    askT = Date.now();
    G.Net.toHost({ k: 'pkq', id: g.id, n: h.n });
  }

  // ---------------- the table (host) ----------------
  function open() {
    if (G.Game.state !== 'ui') return;
    const r = room();
    if (!r || r.members.length < 2) { G.UI.toast('Poker is played against friends: open a room and invite them'); return; }
    if (r.game && r.game.type !== 'pk') { G.UI.toast('Another mini-game is on: finish it first'); return; }
    if (!r.game) {
      if (!r.isHost) { G.UI.toast('Only the host can open the table'); return; }
      G.Social.setGame({ type: 'pk', id: Date.now().toString(36), seats: [], phase: 'wait', n: 0, res: [], nextAt: 0 });
      return;
    }
    show();
  }

  const nextIn = (list, u, ok) => {               // the next player after u in list (wrapping) that passes ok
    const i = list.indexOf(u);
    for (let k = 1; k <= list.length; k++) { const x = list[(i + k) % list.length]; if (ok(x)) return x; }
    return null;
  };

  // The host waits for its own write to come back before acting again, so a move is never applied twice
  // (that would draw extra cards from the deck).
  let hostWait = 0;
  function hw(v) { hostWait = Date.now(); G.Social.setGame(v); }
  function hostTick() {
    const g = game();
    if (!g || !isHost()) return;
    if (hostWait && Date.now() - hostWait < 3000) return;
    const here = room().members.map(m => m.uid);
    // Seats: players who sat down (in the order they sat), minus those who left or stood up (once out of a hand).
    const inHand = g.h && !g.h.done ? A(g.h.ps) : [];
    let seats = A(g.seats).filter(u => here.includes(u) && ((pkOf(u) || {}).sit || inHand.includes(u)));
    for (const u of here) if (!seats.includes(u) && (pkOf(u) || {}).sit) seats.push(u);
    if (seats.join() !== A(g.seats).join()) { hw(Object.assign({}, g, { seats })); return; }
    const h = g.h;
    if (h && !h.done) {
      const u = h.to, m = pkOf(u);
      if (!here.includes(u) || (m && !m.sit)) { hw(applyAndRecord(g, h, u, 'fold')); return; }
      if (m && m.n === h.n && m.seq === h.seq && m.a) { hw(applyAndRecord(g, h, u, m.a, m.amt)); return; }
      if (now() - h.at > ACT * 1000) hw(applyAndRecord(g, h, u, (O(h.bet)[u] || 0) >= h.cur ? 'check' : 'fold'));
      return;
    }
    // Between hands: deal when 2+ seated players can pay the big blind.
    const ready = seats.filter(u => { const m = pkOf(u); return m && m.sit && (m.bal || 0) >= BB; });
    if (ready.length < 2) {
      const clear = h && h.done && now() > (g.nextAt || 0);
      if (g.phase !== 'wait' || clear || (!h && g.nextAt)) hw(Object.assign({}, g, { phase: 'wait', h: clear ? null : h || null, nextAt: h && !clear ? g.nextAt : 0 }));
      return;
    }
    if (h && h.done && now() < (g.nextAt || 0)) return;            // the last hand's result is still up
    if (!h && !g.nextAt) { hw(Object.assign({}, g, { nextAt: now() + START_MS })); return; }
    if (now() < (g.nextAt || 0)) return;
    deal(g, ready);
  }

  function deal(g, ready) {
    const order = A(g.seats).filter(u => ready.includes(u));
    const nd = g.dealer ? nextIn(A(g.seats), g.dealer, u => order.includes(u)) : null;
    const dealer = nd && order.includes(nd) ? nd : order[0];
    const di = order.indexOf(dealer);
    const ps = order.slice(di).concat(order.slice(0, di));       // dealer first
    const n = (g.n || 0) + 1, hid = g.id + '-' + n;
    const st = {}, bet = {}, put = {};
    for (const u of ps) { st[u] = Math.max(0, Math.floor((pkOf(u) || {}).bal || 0)); bet[u] = 0; put[u] = 0; }
    const heads = ps.length === 2;
    const sb = heads ? ps[0] : ps[1], bb = heads ? ps[1] : ps[2];
    const h = { n, hid, ps, st, bet, put, fold: {}, all: {}, board: [], street: 0, cur: 0, minR: BB, acted: {}, to: '', seq: 0, at: now(),
                last: null, done: 0, show: {}, win: {}, desc: {}, sb, bb };
    const post = (u, amt) => { const x = Math.min(amt, h.st[u]); h.st[u] -= x; h.bet[u] += x; h.put[u] += x; if (!h.st[u]) h.all[u] = 1; };
    post(sb, SB); post(bb, BB);
    h.cur = Math.max(h.bet[sb], h.bet[bb]);
    // Deal: two cards each, privately.
    deck = G.Cards.shoe(1); holes = {}; holesFor = g.id + ':' + n;
    for (const u of ps) holes[u] = [deck.pop(), deck.pop()];
    hole = { id: g.id, n, c: holes[meUid()] || null };
    for (const u of ps) if (u !== meUid()) G.Net.send(u, { k: 'pkh', id: g.id, n, c: holes[u] });
    // First to act pre-flop: after the big blind (heads-up: the dealer, who is the small blind).
    h.to = nextIn(ps, bb, u => !h.all[u]) || bb;
    const out = settleStreet(h);
    hw(Object.assign({}, g, { phase: 'hand', n, dealer, h: out, nextAt: 0 }, out.done ? resFields(g, out) : {}));
  }

  /** Applies a move by u and moves the hand on (returns the new hand). */
  function apply(h0, u, a, amt) {
    const h = JSON.parse(JSON.stringify(h0));
    for (const k of ['st', 'bet', 'put', 'fold', 'all', 'acted', 'show', 'win', 'desc']) h[k] = O(h[k]);
    h.board = A(h.board); h.ps = A(h.ps);
    const b = h.bet[u] || 0, stack = h.st[u] || 0;
    const move = x => { x = Math.max(0, Math.min(x, h.st[u])); h.st[u] -= x; h.bet[u] = (h.bet[u] || 0) + x; h.put[u] = (h.put[u] || 0) + x; if (!h.st[u]) h.all[u] = 1; };
    if (a === 'check' && b < h.cur) a = 'fold';
    if (a === 'fold') h.fold[u] = 1;
    else if (a === 'call') move(h.cur - b);
    else if (a === 'raise') {
      let to = Math.floor(+amt) || 0;
      const max = b + stack;
      if (to >= max) to = max;                                     // all in
      else if (to < h.cur + h.minR) to = Math.min(max, h.cur + h.minR);
      if (to <= h.cur) { move(h.cur - b); a = 'call'; }
      else {
        if (to - h.cur >= h.minR) h.minR = to - h.cur;
        h.cur = to; h.acted = {};                                  // everyone else acts again
        move(to - b);
      }
    }
    h.acted[u] = 1;
    h.seq++;
    h.last = { u, a, amt: a === 'raise' ? h.bet[u] : a === 'call' ? h.bet[u] : 0, all: h.all[u] ? 1 : 0 };
    h.at = now();
    const out = settleStreet(h);
    return out;
  }

  /** Finds who acts next, deals the next street, or finishes the hand. */
  function settleStreet(h) {
    for (;;) {
      const live = h.ps.filter(u => !h.fold[u]);
      if (live.length === 1) { finishFold(h, live[0]); return h; }
      const can = live.filter(u => !h.all[u]);
      const need = can.length <= 1 ? can.filter(u => (h.bet[u] || 0) < h.cur) : can.filter(u => !h.acted[u] || (h.bet[u] || 0) < h.cur);
      if (need.length) {
        if (!need.includes(h.to)) h.to = nextIn(h.ps, h.to || h.ps[0], x => need.includes(x));
        return h;
      }
      // The street is over.
      h.street++;
      h.bet = {}; h.cur = 0; h.minR = BB; h.acted = {};
      for (const u of h.ps) h.bet[u] = 0;
      if (h.street === 1) h.board.push(deck.pop(), deck.pop(), deck.pop());
      else if (h.street <= 3) h.board.push(deck.pop());
      else { showdown(h); return h; }
      h.to = nextIn(h.ps, h.ps[0], x => !h.fold[x] && !h.all[x]) || h.ps[0];     // first after the dealer
      h.at = now();
    }
  }

  function finishFold(h, w) {
    const pot = h.ps.reduce((a, u) => a + (h.put[u] || 0), 0);
    h.win = { [w]: pot };
    h.done = 1; h.to = '';
  }
  function showdown(h) {
    const live = h.ps.filter(u => !h.fold[u]);
    const score = {};
    for (const u of live) { score[u] = best(holes[u].concat(h.board)); h.show[u] = holes[u]; h.desc[u] = describe(score[u]); }
    // Pots, side pots included: each level of contribution is shared by the best hands that reached it.
    const levels = [...new Set(h.ps.map(u => h.put[u] || 0).filter(v => v > 0))].sort((a, b) => a - b);
    let prev = 0;
    h.win = {};
    for (const lv of levels) {
      const pot = h.ps.reduce((a, u) => a + Math.min(h.put[u] || 0, lv) - Math.min(h.put[u] || 0, prev), 0);
      let elig = live.filter(u => (h.put[u] || 0) >= lv);
      if (!elig.length) elig = h.ps.filter(u => (h.put[u] || 0) >= lv);       // (only someone who folded reached it)
      let top = null, ws = [];
      for (const u of elig) {
        const s = score[u] || [-1];
        const c = top ? cmp(s, top) : 1;
        if (c > 0) { top = s; ws = [u]; } else if (c === 0) ws.push(u);
      }
      const share = Math.floor(pot / ws.length);
      let rest = pot - share * ws.length;
      for (const u of h.ps) if (ws.includes(u)) { h.win[u] = (h.win[u] || 0) + share + (rest > 0 ? 1 : 0); if (rest > 0) rest--; }
      prev = lv;
    }
    h.done = 1; h.to = ''; h.street = 4;
  }

  /** The finished hand's result, added to g.res for everyone to settle. */
  function resFields(g, h) {
    const d = {};
    for (const u of h.ps) d[u] = (O(h.win)[u] || 0) - (O(h.put)[u] || 0);
    return { res: [{ hid: h.hid, d }].concat(A(g.res)).slice(0, 8), nextAt: now() + SHOW_MS };
  }

  /** A move applied to the table; the moment a hand finishes its result goes into g.res for everyone to settle. */
  function applyAndRecord(g, h, u, a, amt) { const out = apply(h, u, a, amt); return Object.assign({}, g, { h: out }, out.done ? resFields(g, out) : {}); }

  // ---------------- settling ----------------
  function settle() {
    const g = game();
    if (!g) return;
    const st = pkState(), me = meUid(), s = G.DB.save;
    let changed = false;
    for (const r of A(g.res)) {
      const d = O(r.d)[me];
      if (d == null || st.done[r.hid]) continue;
      st.done[r.hid] = Date.now();
      s.tickets.t1 = Math.max(0, s.tickets.t1 + d);
      changed = true;
    }
    if (changed) { G.DB.commit(true); G.UI.refreshCoins(); if (mine && mine.id === g.id) writeMine(); }
  }

  // ---------------- screen ----------------
  let timer = 0, raiseTo = 0, raiseKey = '';
  function show() {
    if (G.Game.state !== 'ui') return;
    if (!G.UI.isOpen('scr-poker')) G.UI.show('scr-poker', true);
    clearInterval(timer);
    timer = setInterval(() => { if (!G.UI.isOpen('scr-poker')) { clearInterval(timer); return; } askHole(); clock(); }, 500);
    render();
  }
  function clock() {
    const g = game(), el = $('pk-clock');
    if (!el || !g || !g.h || g.h.done) { if (el) el.textContent = ''; return; }
    el.textContent = Math.max(0, Math.ceil(ACT - (now() - g.h.at) / 1000)) + ' s';
  }

  const LAST = { fold: 'folds', check: 'checks', call: 'calls', raise: 'raises to' };
  function render() {
    const g = game();
    if (!g) { if (G.UI.isOpen('scr-poker')) G.LobbyUI.open(); return; }
    settle();
    const h = g.h, me = meUid();
    const myPk = pkOf(me), seated = !!(myPk && myPk.sit);
    const pot = h ? A(h.ps).reduce((a, u) => a + (O(h.put)[u] || 0), 0) : 0;
    const body = $('pk-body');
    // Board.
    const board = h ? A(h.board) : [];
    let html = `<div class="pk-felt"><div class="pk-street">${h ? (h.done ? (h.street >= 4 ? 'Showdown' : 'Hand over') : STREETS[h.street]) : 'Waiting for players'}</div>
      <div class="pk-board">${[0, 1, 2, 3, 4].map(i => board[i] ? G.Cards.html(board[i]) : '<div class="pc slot"></div>').join('')}</div>
      <div class="pk-pot">Pot <b class="gold">${pot}</b></div></div>`;
    // Result.
    if (h && h.done) {
      const ws = Object.keys(O(h.win)).filter(u => O(h.win)[u] > 0);
      html += `<p class="pk-result">${ws.map(u => `${esc(nameOf(u))} ${u === me ? 'win' : 'wins'} <b class="gold">${O(h.win)[u]}</b>${O(h.desc)[u] ? ' with ' + esc(O(h.desc)[u]) : ''}`).join(' · ')}</p>`;
    } else if (h && h.last) {
      const l = h.last;
      html += `<p class="pk-last">${esc(nameOf(l.u))} ${l.all && l.a !== 'fold' ? 'goes all in' + (l.amt ? ' (' + l.amt + ')' : '') : LAST[l.a] + (l.a === 'raise' || l.a === 'call' ? ' ' + l.amt : '')}</p>`;
    }
    // Seats.
    const seats = h && !h.done ? A(h.ps) : A(g.seats).length ? A(g.seats) : [];
    const shown = h ? A(h.ps) : [];
    const list = [...new Set(seats.concat(shown))];
    html += '<div class="pk-seats">' + (list.length ? list.map(u => {
      const inH = h && A(h.ps).includes(u), m = pkOf(u);
      const stack = inH ? O(h.st)[u] || 0 : (m ? m.bal || 0 : 0);
      const fold = inH && O(h.fold)[u], all = inH && O(h.all)[u], toAct = h && !h.done && h.to === u;
      let cards = '';
      if (inH) {
        if (O(h.show)[u]) cards = G.Cards.row(h.show[u]);
        else if (u === me && hole && hole.id === g.id && hole.n === h.n && hole.c) cards = G.Cards.row(hole.c, { cls: fold ? 'dim' : '' });
        else if (!fold) cards = G.Cards.row(['??', '??'], { cls: 'small' });
      }
      const badges = (g.dealer === u && h ? '<i class="pk-b d">D</i>' : '') + (h && h.sb === u && !h.done ? '<i class="pk-b">SB</i>' : '') + (h && h.bb === u && !h.done ? '<i class="pk-b">BB</i>' : '');
      const won = h && h.done && O(h.win)[u] > 0;
      return `<div class="pk-seat${toAct ? ' now' : ''}${fold ? ' folded' : ''}${won ? ' won' : ''}${u === me ? ' me' : ''}">
        <div class="pk-nm">${badges}${esc(nameOf(u))}</div>
        <div class="pk-cards">${cards}</div>
        <small>${fold ? 'Folded' : all ? 'All in' : 'Stack ' + stack}${toAct ? ' · <span id="pk-clock"></span>' : ''}</small>
        ${inH && !h.done && O(h.bet)[u] ? `<i class="pk-chip">${O(h.bet)[u]}</i>` : ''}
        ${h && h.done && O(h.desc)[u] ? `<small class="pk-desc">${esc(O(h.desc)[u])}</small>` : ''}
      </div>`;
    }).join('') : '<p class="sub center">Nobody is sitting yet.</p>') + '</div>';
    body.innerHTML = html;
    // Controls.
    const ctl = document.createElement('div'); ctl.className = 'rl-ctl';
    const row = () => { const r = document.createElement('div'); r.className = 'row'; r.style.cssText = 'justify-content:center;gap:8px;flex-wrap:wrap;margin-top:6px'; ctl.appendChild(r); return r; };
    const add = (r, t, cls, fn, dis) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = t; b.onclick = fn; b.disabled = !!dis; r.appendChild(b); return b; };
    if (h && !h.done && h.to === me) {
      const b = O(h.bet)[me] || 0, stack = O(h.st)[me] || 0, toCall = Math.max(0, h.cur - b);
      const minTo = Math.min(b + stack, h.cur + h.minR), maxTo = b + stack;
      const key = g.id + ':' + h.n + ':' + h.seq;
      if (raiseKey !== key) { raiseKey = key; raiseTo = minTo; }
      raiseTo = Math.max(minTo, Math.min(maxTo, raiseTo));
      ctl.insertAdjacentHTML('beforeend', '<p class="center"><b class="gold">Your move</b> · to call: ' + Math.min(toCall, stack) + '</p>');
      const r = row();
      add(r, 'Fold', 'ghost', () => act('fold'));
      if (toCall === 0) add(r, 'Check', '', () => act('check'));
      else add(r, (toCall >= stack ? 'All in ' : 'Call ') + Math.min(toCall, stack), '', () => act('call'));
      if (maxTo > h.cur) {
        const rr = document.createElement('div'); rr.className = 'pk-raise';
        rr.innerHTML = `<label>Raise to <input type="number" min="${minTo}" max="${maxTo}" step="1" inputmode="numeric" value="${raiseTo}"></label>`;
        const inp = rr.querySelector('input');
        inp.oninput = () => { const v = Math.floor(+inp.value); if (v > 0) raiseTo = v; };
        inp.onchange = () => { raiseTo = Math.max(minTo, Math.min(maxTo, Math.floor(+inp.value) || minTo)); inp.value = raiseTo; };
        const quick = document.createElement('div'); quick.className = 'gb-quick';
        const potNow = pot;
        for (const [t, v] of [['Min', minTo], ['½ Pot', h.cur + Math.floor((potNow + toCall) / 2)], ['Pot', h.cur + potNow + toCall], ['All in', maxTo]]) {
          const q = document.createElement('button'); q.className = 'btn small ghost'; q.textContent = t;
          q.onclick = () => { raiseTo = Math.max(minTo, Math.min(maxTo, v)); inp.value = raiseTo; };
          quick.appendChild(q);
        }
        rr.appendChild(quick);
        const go = document.createElement('button'); go.className = 'btn gold'; go.textContent = 'Raise';
        go.onclick = () => act('raise', Math.max(minTo, Math.min(maxTo, Math.floor(+inp.value) || raiseTo)));
        rr.appendChild(go);
        ctl.appendChild(rr);
      }
    } else if (h && !h.done && A(h.ps).includes(me) && O(h.fold)[me] == null) {
      ctl.insertAdjacentHTML('beforeend', `<p class="center sub">Waiting for ${esc(nameOf(h.to))}…</p>`);
    }
    const r2 = row();
    if (!seated) add(r2, 'Sit down', 'gold', () => sit(true), tickets() < BB);
    else add(r2, h && !h.done && A(h.ps).includes(me) && !O(h.fold)[me] ? 'Stand up (folds)' : 'Stand up', 'ghost', () => sit(false));
    if (isHost()) add(r2, 'Close the table', 'small ghost', () => G.Social.setGame(null));
    ctl.insertAdjacentHTML('beforeend', `<p class="note center">You have ${plural(tickets())}. Blinds ${SB}/${BB}. Your stack each hand is all the ×1 tickets you have; what you win or lose is settled when the hand ends.${!seated && tickets() < BB ? ' You need at least ' + BB + ' tickets to sit down.' : ''}</p>`);
    if (!h || h.done) {
      const ready = A(g.seats).filter(u => { const m = pkOf(u); return m && m.sit && (m.bal || 0) >= BB; });
      if (ready.length < 2) ctl.insertAdjacentHTML('afterbegin', '<p class="center sub">The next hand starts when 2 or more players sit down.</p>');
      else if (g.nextAt && now() < g.nextAt) ctl.insertAdjacentHTML('afterbegin', '<p class="center sub">Next hand in a moment…</p>');
    }
    body.appendChild(ctl);
    clock();
    // Sounds: a new card on the board, your turn.
    const sk = h ? h.n + ':' + board.length + ':' + (h.to === me) + ':' + h.done : '';
    if (sk !== lastSound) {
      if (h && lastSound && h.to === me && !h.done) G.Audio.sfx('levelup');
      else if (h && h.done && !lastSound.endsWith('1')) G.Audio.sfx(O(h.win)[me] > 0 ? 'legend' : 'select');
      lastSound = sk;
    }
  }
  let lastSound = '';

  // ---------------- wiring ----------------
  function onGame() {
    const g = game();
    if (G.Game.state !== 'ui') return;
    hostWait = 0;
    if (g) {
      settle();
      if (!mine || mine.id !== g.id) mine = null;
      show();
      return;
    }
    if (G.UI.isOpen('scr-poker')) G.LobbyUI.open();
  }
  function init() {
    $('pk-back').onclick = () => G.LobbyUI.open();
    G.Net.on(onNet);
    // The host runs the table even with the poker screen closed.
    setInterval(() => { if (isHost() && game() && G.Game.state === 'ui') hostTick(); }, 400);
    G.Social.on(what => {
      if (what === 'game') onGame();
      else if (what === 'room' && G.UI.isOpen('scr-poker')) { if (isHost()) hostTick(); render(); }
    });
  }

  return { init, open, show, isOn: () => !!game(), best, describe, eval5, _apply: apply };
})();
