/* ============ runlog.js — run details for balancing ============
 * While a run lasts this collects what is needed to balance the game, and at the end it is
 * added to that run's history entry as `z` (only the latest 30 runs keep it: core/db.js).
 * It rides on the writes that already happen at the end of a run: no extra cost.
 * Each player records their own run (co-op included). Guests have no account: nothing leaves the browser.
 *
 * z = {
 *   v   format (1) · gv game version · ts team size · in 't' touch / 'k' keyboard
 *   end how it ended: 'd' fainted · 'q' left · 'j' Arceus's Judgment · 'p' lost the Zygarde Portal
 *   mv  per move: [code, level, evolved 0/1, damage dealt (burn and poison included), seconds active, casts,
 *       bond: 0 if not bonded, else the same number (1, 2...) for moves bonded together at the end]
 *   lu  level-up cards, one group per level-up separated by '|': the 3 cards offered, the one picked marked '*'.
 *       Card = n (new move) / u (upgrade) / e (evolution) + move code, or s + upgrade id (satk, scd, sarea...).
 *       A group ending in '~' was rerolled, in '-' skipped. Up to 60 groups.
 *   rr  rerolls · sk skips · sw times you switched moves
 *   st  upgrades taken, 'atk6,cd2,crit4'
 *   ev  evolutions [[code, second]] · bd bonds [[moves in the bond, second]] · it items [[id, second]]
 *   lc  your level at the end of each minute (up to 60)
 *   pw  shrine powers used {id: times} · rf rifts {r: entered, rw: won, rl: lost, z, zw, zl for the Zygarde Portal}
 *   ec  events {id: times} · wx weather {kind: times}
 *   pk  shop upgrades of that Pokémon when the run started, 'crit5,hp8'
 * }
 * Move codes are positions in CODES below (base 36), so a run is short. CODES is APPEND-ONLY:
 * add new moves at the end and never reorder or remove, or old runs would point at the wrong move.
 * A move missing from CODES is written by its id instead (still readable).
 */
G.RunLog = (() => {
  const CODES = [
    'tackle', 'quick-attack', 'swords-dance', 'agility', 'harden', 'ember', 'flamethrower', 'fire-spin', 'heat-wave',
    'water-gun', 'bubble', 'hydro-pump', 'aqua-ring', 'vine-whip', 'razor-leaf', 'leaf-storm', 'giga-drain',
    'thunder-shock', 'discharge', 'thunderbolt', 'confusion', 'psybeam', 'psychic', 'sludge', 'mud-shot', 'gust',
    'wing-attack', 'body-slam', 'hyper-voice', 'poison-sting', 'toxic', 'bulldoze', 'bug-bite', 'string-shot',
    'bug-buzz', 'rock-throw', 'rock-slide', 'ice-beam', 'powder-snow', 'karate-chop', 'aura-sphere', 'lick',
    'shadow-ball', 'dragon-rage', 'dragon-dance', 'fairy-wind', 'dazzling-gleam', 'metal-claw', 'flash-cannon',
    'bite', 'dark-pulse', 'night-shade', 'bonemerang', 'psycho-cut', 'spikes', 'toxic-spikes', 'hail', 'meteor-mash',
    'will-o-wisp', 'substitute', 'aerial-ace', 'flame-wheel', 'bubble-beam', 'hex', 'absorb', 'acid-spray',
    'pin-missile', 'ice-shard', 'frost-breath', 'drain-punch', 'dragon-breath', 'pursuit', 'hyper-beam', 'explosion',
    'protect', 'recover', 'thunder-wave', 'draco-meteor',
    // 19-10-2026 (Batch 2)
    'seed-bomb', 'spark', 'thunder-punch', 'zing-zap', 'zen-headbutt', 'psyshield-bash', 'cross-poison', 'scorching-sands',
    'drill-peck', 'air-slash', 'air-cutter', 'signal-beam', 'ancient-power', 'sandstorm', 'ice-punch', 'icicle-spear',
    'vacuum-wave', 'shadow-claw', 'spirit-shackle', 'ominous-wind', 'dragon-claw', 'dragon-darts', 'breaking-swipe',
    'play-rough', 'spirit-break', 'disarming-voice', 'solar-beam', 'electro-ball', 'thunder-cage', 'reflect', 'dig',
    'sand-tomb', 'infestation', 'rollout', 'power-gem', 'seismic-toss', 'gyro-ball', 'mirror-shot', 'sucker-punch',
    'fiery-wrath',
    'beat', 'aqua-jet', 'liquidation'
  ];
  const IDX = new Map(CODES.map((id, i) => [id, i]));
  const code = id => (IDX.has(id) ? IDX.get(id).toString(36) : id);
  /** Code -> move id (for reading runs back). */
  function idOf(c) {
    if (typeof c === 'number') return CODES[c] || null;
    if (/^[0-9a-z]{1,2}$/.test(c) && !G.Moves.BY_ID[c]) return CODES[parseInt(c, 36)] || null;
    return G.Moves.BY_ID[c] ? c : null;
  }

  const MAX_LU = 60, MAX_LC = 60;
  const VERSION = (() => {
    const tag = document.querySelector('script[src*="app.min.js?v="]');
    return tag ? (tag.getAttribute('src').match(/v=([0-9a-f]+)/) || [])[1] || 'dev' : 'dev';
  })();

  let L = null;            // the current run's log (null outside a run)

  const mine = pl => !!L && !!pl && pl === G.Game.player;
  const sec = () => Math.floor(G.Game.st ? G.Game.st.time || 0 : 0);
  const mv = id => L.mv[id] || (L.mv[id] = { d: 0, a: 0, c: 0 });
  const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };

  // ---------------- during the run ----------------

  function start(pl) {
    const up = G.DB.upgradesOf ? G.DB.upgradesOf(pl.dex) || {} : {};
    L = {
      mv: {}, lu: [], cur: null, sw: 0, ev: [], bd: [], it: [], lc: [], pw: {}, rf: {}, ec: {}, wx: {},
      pk: Object.keys(up).filter(k => up[k] > 0).sort().map(k => k + up[k]).join(','),
      in: G.Touch && G.Touch.active ? 't' : 'k', ts: 1
    };
  }

  /** Damage `amount` dealt by the local player's move `id` (direct hits, fields, orbs). */
  function dmg(pl, id, amount) { if (mine(pl) && id && amount > 0) mv(id).d += amount; }
  /** Burn or poison ticks: credited to the move that applied them (only ever set by the local player's hits). */
  function dot(id, amount) { if (L && id && amount > 0) mv(id).d += amount; }
  function active(pl, id, dt) { if (mine(pl)) mv(id).a += dt; }
  function cast(pl, id) { if (mine(pl)) mv(id).c++; }
  function switched(pl) { if (mine(pl)) L.sw++; }

  /** Level-up cards shown (again after a reroll). */
  function offer(cards) {
    if (!L) return;
    if (L.cur) close('~');                       // the previous offer was rerolled
    L.cur = cards.map(c => cardCode(c.key));
  }
  function pick(i) { if (L && L.cur) { if (L.cur[i] != null) L.cur[i] = '*' + L.cur[i]; close(''); } }
  function skip() { if (L && L.cur) close('-'); }
  function close(mark) {
    if (L.lu.length < MAX_LU) L.lu.push(L.cur.join(',') + mark);
    L.cur = null;
  }
  function cardCode(key) {
    const [t, id] = String(key).split(':');
    if (t === 'stat') return 's' + id;
    return ({ new: 'n', up: 'u', evo: 'e' }[t] || '?') + code(id);
  }

  function evo(id) { if (L) L.ev.push([code(id), sec()]); }
  function bond(pl, size) { if (mine(pl)) L.bd.push([size, sec()]); }
  function item(pl, id) { if (mine(pl) && id) L.it.push([id, sec()]); }
  function power(pl, id) { if (mine(pl) && id) bump(L.pw, id); }
  /** what: 'in' entered · 'w' won · 'l' lost. zy: the Zygarde Portal. */
  function rift(what, zy) { if (L) bump(L.rf, (zy ? 'z' : 'r') + (what === 'in' ? '' : what)); }
  function event(id) { if (L && id) bump(L.ec, id); }
  function weather(kind) { if (L && kind) bump(L.wx, kind); }
  /** Every frame: your level at the end of each minute. */
  function tick(pl, time) {
    if (!mine(pl)) return;
    while (L.lc.length < MAX_LC && time >= (L.lc.length + 1) * 60) L.lc.push(pl.level);
  }

  // ---------------- end of the run ----------------

  /** The details block for this run's history entry (and the log is closed). */
  function finish(pl, o = {}) {
    if (!L) return 0;
    if (L.cur) close('-');
    const st = pl.statsTaken || {};
    const z = {
      v: 1, gv: VERSION, ts: o.team || 1, in: L.in,
      end: o.fail ? 'p' : o.judged ? 'j' : o.dead ? 'd' : 'q',
      mv: pl.moves.map(m => {
        const s = L.mv[m.id] || { d: 0, a: 0, c: 0 };
        const groups = (pl.slots || []).filter(g => g.length > 1), b = groups.findIndex(g => g.includes(m)) + 1;
        return [code(m.id), m.lvl, m.evolved ? 1 : 0, Math.round(s.d), Math.round(s.a), s.c, b];
      }),
      lu: L.lu.join('|'), rr: pl.rerolls || 0, sk: pl.skips || 0, sw: L.sw,
      st: Object.keys(st).filter(k => st[k] > 0).map(k => k + st[k]).join(','),
      ev: L.ev, bd: L.bd, it: L.it, lc: L.lc, pw: L.pw, rf: L.rf, ec: L.ec, wx: L.wx, pk: L.pk
    };
    L = null;
    return z;
  }

  /** Cleans a details block read back from a save or another player (anything odd is dropped). */
  function clean(z) {
    if (typeof z === 'string') { try { z = JSON.parse(z); } catch (e) { return 0; } }
    if (!z || typeof z !== 'object' || Array.isArray(z)) return 0;
    const n = v => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);
    const s = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
    const pairs = (a, max, f) => (Array.isArray(a) ? a.filter(Array.isArray).slice(0, max).map(f) : []);
    const counts = o => {
      const out = {};
      if (o && typeof o === 'object' && !Array.isArray(o)) for (const k of Object.keys(o).slice(0, 30)) if (n(o[k])) out[k.slice(0, 24)] = n(o[k]);
      return out;
    };
    const c = v => (typeof v === 'number' || typeof v === 'string' ? String(v).slice(0, 24) : '');
    return {
      v: n(z.v) || 1, gv: s(z.gv, 16), ts: Math.min(n(z.ts) || 1, 5), in: z.in === 't' ? 't' : 'k',
      end: ['d', 'q', 'j', 'p'].includes(z.end) ? z.end : 'q',
      mv: pairs(z.mv, 12, x => [c(x[0]), Math.min(n(x[1]), 9), x[2] ? 1 : 0, n(x[3]), n(x[4]), n(x[5]), Math.min(n(x[6]), 4)]).filter(x => idOf(x[0])),
      lu: s(z.lu, 1600), rr: n(z.rr), sk: n(z.sk), sw: n(z.sw), st: s(z.st, 200),
      ev: pairs(z.ev, 12, x => [c(x[0]), n(x[1])]), bd: pairs(z.bd, 8, x => [n(x[0]), n(x[1])]),
      it: pairs(z.it, 10, x => [c(x[0]), n(x[1])]), lc: (Array.isArray(z.lc) ? z.lc : []).slice(0, MAX_LC).map(n),
      pw: counts(z.pw), rf: counts(z.rf), ec: counts(z.ec), wx: counts(z.wx), pk: s(z.pk, 300)
    };
  }

  return { start, finish, clean, dmg, dot, active, cast, switched, offer, pick, skip, evo, bond, item, power, rift, event, weather, tick,
           idOf, code, CODES, VERSION, get on() { return !!L; } };
})();
