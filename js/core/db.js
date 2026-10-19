/* ============ db.js — database: Firebase (cloud) or local ============
 * ALL access to persistent data goes through here. The rest of the game only
 * uses G.DB.*.
 *
 * Two modes (decided in ready()):
 *
 *   CLOUD  (Firebase Authentication + Cloud Firestore)
 *     If there's configuration in js/core/firebase-config.js and the game is opened
 *     from a website (http/https, localhost too). The save is stored in
 *     saves/{uid} and can be continued on any computer.
 *       - Username + password: Firebase asks for an email, so the name is
 *         turned into an internal one (nothing is ever sent to it).
 *       - Google account.
 *     A local copy is also kept so you can play offline; when
 *     syncing it MERGES (see merge): collections are combined and a Pokémon
 *     or a shiny is never lost.
 *
 *   LOCAL (localStorage)
 *     If there's no configuration or it's opened by double-click (file://). As
 *     before: accounts and saves only in this browser.
 *       ps.accounts      { key: { name, salt, hash, created } }
 *       ps.save.<key>    that account's save
 *       ps.session       the last account with a session
 *
 * Guest mode plays with an in-memory save that isn't stored.
 */
/** How many times this Pokémon (dex) has reached Arceus in the given save (stars from before per-Pokémon counts = 1). */
G.arcCount = (save, dex) => {
  if (!save || !save.arceus || !save.arceus[dex]) return 0;
  return Math.max(1, Math.min(999, (save.arceusN || {})[dex] || 0));
};

G.DB = (() => {
  const K_ACC = 'ps.accounts', K_SES = 'ps.session', K_SAVE = 'ps.save.';
  const K_CLOUD = 'ps.cloud.', K_MIGRATED = 'ps.migrated.';
  const VERSION = 3;
  const START_COINS = 500;
  const SDK = 'https://www.gstatic.com/firebasejs/13.0.0/';
  const NAME_DOMAIN = 'jugadores.pokesurvivor.net';   // only for the internal email

  let mode = 'local';       // 'cloud' | 'local'
  let localReason = '';     // why there's no cloud: 'file' | 'config' | 'host' | 'error'
  let user = null;          // nombre visible
  let key = null;           // local key (lowercase) or Firebase uid
  let guest = false;
  let save = null;
  let storageOk = true;

  // ---------------- almacenamiento local seguro ----------------

  function read(k) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }
    catch (e) { storageOk = false; return null; }
  }
  function write(k, v) {
    const s = JSON.stringify(v);
    try { localStorage.setItem(k, s); return true; }
    catch (e) {
      // Browser storage full (mostly from what the leaderboard stores): the
      // dispensable is freed and it retries. Previously the save copy stopped
      // being stored without warning and, on reloading, it went back to the cloud one.
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && /^ps\.rk\.c\./.test(key)) localStorage.removeItem(key);
        }
        localStorage.setItem(k, s); return true;
      } catch (e2) { storageOk = false; return false; }
    }
  }
  function remove(k) { try { localStorage.removeItem(k); } catch (e) { /* nothing */ } }

  // ---------------- save ----------------

  function newSave(name) {
    return {
      v: VERSION,
      name,
      created: Date.now(),
      updated: Date.now(),    // last modification (for merging)
      coins: START_COINS,
      owned: {},              // dex -> { at, from: 'starter'|'gacha'|'wild' }
      shiny: {},              // dex -> { at, from } — variantes shiny conseguidas
      partner: null,          // dex of the Pokémon you play with
      partnerShiny: false,    // play with its shiny version (if you have it)
      starter: null,          // dex you got in the test
      personality: null,      // { trait, scores }
      upgrades: {},           // (old) account upgrades; now they're per Pokémon
      pupg: {},               // dex -> { id -> level }: each Pokémon's upgrades
      tickets: { t1: 0, t10: 0 },   // gacha tickets (x1 and x10)
      codes: {},              // code fingerprint -> date: redeemed codes (js/systems/redeem.js)
      pity: {},               // banner generation -> pulls without a ★5
      legends: {},            // dex -> date: legendaries defeated in rifts
      history: [],            // latest runs (most recent first, max. HISTORY_MAX): see cleanHistory()
      arceus: {},             // dex -> date: Pokémon that have reached Arceus (gold star)
      arceusN: {},            // dex -> how many times that Pokémon has reached Arceus (since 19-10-2026)
      arenas: {},             // type -> date: rift arenas won
      itemsFound: {},         // id -> date: held items found
      evoMoves: {},           // id -> date: moves ever evolved
      ach: {},                // id -> date: achievements earned
      missions: {},           // the day's / week's missions (systems/progress.js)
      profile: { favs: [], title: '' },   // public profile: 3 favourites and title
      stats: { runs: 0, bestTime: 0, bestLevel: 0, totalKills: 0, pulls: 0, coinsEarned: 0, shinies: 0,
               bossesTotal: 0, riftWins: 0, evolutions: 0, missionsDone: 0, groupRuns: 0, bestGroupTime: 0 }
    };
  }

  // ---------------- run history ----------------
  /*
   * Each run ends up in save.history (most recent first, up to HISTORY_MAX):
   *   id date (ms) · d dex · sh shiny · t seconds · lv level · k defeated · b bosses · c coins
   *   dd damage dealt · dt damage taken · m [[move, level]] · it item · x 1 = you fell (0 = you quit)
   *   g 1 = in a group · mt [[name, dex, shiny]] teammates · ar [seconds, legendaries] against Arceus (or 0)
   *   kb who defeated you { d dex, n name, a attack, ty type, h damage, e effect } (or 0): see systems/killer.js
   *   z  run details for balancing (moves' damage, level-up cards, upgrades...): see systems/runlog.js.
   *      Only the latest DETAIL_MAX runs keep them, so the save stays small.
   */
  const HISTORY_MAX = 100, DETAIL_MAX = 30;
  function cleanHistory(list) {
    // In the cloud, `m` and `mt` are stored as JSON strings (Firestore refuses arrays inside arrays): see packSave.
    const arr = v => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { return []; } } return Array.isArray(v) ? v : []; };
    const n = v => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);
    const out = [], seen = new Set();
    for (const e of Array.isArray(list) ? list : []) {
      if (!isObj(e) || !n(e.id) || seen.has(e.id) || (G.DEX_BY && !G.DEX_BY[e.d])) continue;
      seen.add(e.id);
      out.push({
        id: n(e.id), d: n(e.d), sh: e.sh ? 1 : 0, t: Math.min(n(e.t), 86400), lv: n(e.lv), k: n(e.k), b: n(e.b), c: n(e.c),
        dd: n(e.dd), dt: n(e.dt),
        m: arr(e.m).filter(x => Array.isArray(x) && typeof x[0] === 'string' && (!G.Moves || G.Moves.BY_ID[x[0]]))
            .slice(0, 12).map(x => [x[0], Math.min(n(x[1]), 99)]),
        it: typeof e.it === 'string' && (!G.Items || !e.it || G.Items.BY[e.it]) ? e.it : '',
        x: e.x ? 1 : 0, g: e.g ? 1 : 0,
        mt: arr(e.mt).filter(x => Array.isArray(x)).slice(0, 4)
            .map(x => [String(x[0] || '').slice(0, 20), G.DEX_BY && G.DEX_BY[x[1]] ? n(x[1]) : 0, x[2] ? 1 : 0]),
        ar: Array.isArray(e.ar) ? [n(e.ar[0]), n(e.ar[1])] : 0,
        kb: e.x && G.Killer ? G.Killer.clean(e.kb) : 0,
        z: e.z && G.RunLog ? G.RunLog.clean(e.z) : 0
      });
    }
    const runs = out.sort((a, b) => b.id - a.id).slice(0, HISTORY_MAX);
    for (let i = 0; i < runs.length; i++) if (!runs[i].z || i >= DETAIL_MAX) delete runs[i].z;
    return runs;
  }
  /** Records a finished run at the start of the history. */
  function addHistory(entry) {
    if (!save) return;
    save.history = cleanHistory([entry, ...(save.history || [])]);
  }

  /** Fills in fields missing from saves of earlier versions. */
  function migrate(s, name) {
    const base = newSave(name || s.name);
    for (const k in base) if (s[k] == null) s[k] = base[k];
    for (const k in base.stats) if (s.stats[k] == null) s.stats[k] = base.stats[k];
    // v1 -> v2: there was a single banner (Kanto) with the pity as a number.
    if (typeof s.pity === 'number') s.pity = { 1: s.pity };
    // v2 -> v3: upgrades belonged to the account; they go to the partner at the time.
    if (!s.pupgDone) {
      if (s.partner && Object.values(s.upgrades || {}).some(v => v > 0)) {
        s.pupg[s.partner] = Object.assign({}, s.upgrades);
      }
      s.pupgDone = true;
    }
    s.tickets = Object.assign({ t1: 0, t10: 0 }, s.tickets);
    s.history = cleanHistory(s.history);
    // Arceus stars per Pokémon (19-10-2026): count the runs in the history that reached Arceus with each one,
    // so stars earned before per-Pokémon counts aren't stuck at 1. Never lowers a count (older runs may be off the list).
    s.arceusN = s.arceusN && typeof s.arceusN === 'object' ? s.arceusN : {};
    const arcRuns = {};
    for (const e of s.history) if (e.ar && e.d) arcRuns[e.d] = (arcRuns[e.d] || 0) + 1;
    for (const d in arcRuns) {
      s.arceus = s.arceus || {};
      if (!s.arceus[d]) s.arceus[d] = Date.now();
      s.arceusN[d] = Math.max(s.arceusN[d] || 0, arcRuns[d]);
    }
    sanitize(s);
    s.v = VERSION;
    return s;
  }

  /**
   * Removes the impossible from a hand-edited save (the browser copy
   * can be tampered with): negative or odd numbers, upgrades above the
   * maximum and Pokémon that don't exist. Whatever is possible is stopped by the
   * server (firestore.rules, saves).
   */
  function sanitize(s) {
    const n = v => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);
    s.coins = n(s.coins);
    s.tickets.t1 = n(s.tickets.t1);
    s.tickets.t10 = n(s.tickets.t10);
    if (isObj(s.led)) {
      for (const dev of Object.keys(s.led)) {
        const e = s.led[dev];
        if (!isObj(e)) { delete s.led[dev]; continue; }
        for (const k of Object.keys(e)) {
          if (!CUR[k] || !Array.isArray(e[k])) { delete e[k]; continue; }
          e[k] = [n(e[k][0]), n(e[k][1])];
        }
      }
    } else delete s.led;
    if (G.DEX_BY) for (const coll of ['owned', 'shiny']) {
      for (const d of Object.keys(s[coll] || {})) if (!G.DEX_BY[d]) delete s[coll][d];
    }
    // Shortcuts: 4 slots with a move that exists (or null), without repeats.
    if (s.pbind && typeof s.pbind === 'object') {
      for (const d of Object.keys(s.pbind)) {
        const l = Array.isArray(s.pbind[d]) ? s.pbind[d].slice(0, 4) : [];
        const seen = new Set();
        s.pbind[d] = [0, 1, 2, 3].map(i => {
          const id = l[i];
          if (typeof id !== 'string' || (G.Moves && !G.Moves.BY_ID[id]) || seen.has(id)) return null;
          seen.add(id); return id;
        });
      }
    } else s.pbind = {};
    // Veto: lists of moves that exist, without repeats, at most 3.
    if (s.pban && typeof s.pban === 'object') {
      for (const d of Object.keys(s.pban)) {
        const l = Array.isArray(s.pban[d]) ? s.pban[d] : [];
        s.pban[d] = [...new Set(l.filter(id => typeof id === 'string' && (!G.Moves || G.Moves.BY_ID[id])))].slice(0, 3);
      }
    } else s.pban = {};
    if (G.Upgrades) for (const d of Object.keys(s.pupg || {})) {
      const u = s.pupg[d];
      if (!u || typeof u !== 'object') { delete s.pupg[d]; continue; }
      for (const id of Object.keys(u)) {
        if (!G.Upgrades.BY[id]) delete u[id];
        else u[id] = Math.min(G.Upgrades.BY[id].max, n(u[id]));
      }
    }
  }

  /**
   * Merges two versions of the same save (e.g. one played offline
   * and the cloud one). Nothing earned is ever lost:
   *   - collections (owned, shiny): union
   *   - upgrades and stats: the maximum of each
   *   - coins, partner, pity...: those of the most recent version
   * It's idempotent: merging twice gives the same result.
   */
  /*
   * LEDGER of coins and tickets (14-10-2026). Previously coins and tickets
   * were "those of the most recent version": if a device with old data (the
   * phone with yesterday's tab open) saved something, its number won and
   * what was earned on the other was lost (one player went from 36 tickets to 3).
   * Now each device records in save.led[device] what it has earned and spent
   * of each thing ([earned, spent], they only grow) and the balance is the sum of
   * all of them: when merging the highest of each entry is taken and nothing is lost.
   *   led.base: the balance there was before the ledger (or at the start).
   *   led.old:  changes from an earlier version of the game (tabs not updated).
   */
  const CUR = {
    c: [s => s.coins, (s, v) => { s.coins = v; }],
    t1: [s => s.tickets.t1, (s, v) => { s.tickets.t1 = v; }],
    t10: [s => s.tickets.t10, (s, v) => { s.tickets.t10 = v; }]
  };
  // This device (browser): a random name that stays saved.
  const DEV = (() => {
    let d = read('ps.dev');
    if (typeof d !== 'string' || !/^[a-z0-9]{6,12}$/.test(d)) { d = 'd' + Math.random().toString(36).slice(2, 10); write('ps.dev', d); }
    return d;
  })();
  const num = v => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);
  const balOf = s => { const o = {}; for (const k in CUR) o[k] = num(CUR[k][0](s)); return o; };
  function ledSum(led, k) {
    let t = 0;
    for (const dev in led) { const e = led[dev] && led[dev][k]; if (e) t += num(e[0]) - num(e[1]); }
    return t;
  }
  function addTo(led, dev, k, d) {
    if (!d) return;
    const e = led[dev] = led[dev] || {};
    const p = e[k] = e[k] || [0, 0];
    if (d > 0) p[0] = num(p[0]) + d; else p[1] = num(p[1]) - d;
  }
  /** A save's ledger (without touching it); whatever doesn't add up goes to `dev`. */
  function ledOf(s, dev) {
    if (!isObj(s.led)) {
      const b = balOf(s), base = {};
      for (const k in CUR) base[k] = [b[k], 0];
      return { base };
    }
    const led = JSON.parse(JSON.stringify(s.led)), b = balOf(s);
    // A negative balance (the same spent on two devices offline) shows as 0.
    for (const k in CUR) addTo(led, dev, k, b[k] - Math.max(0, ledSum(led, k)));
    return led;
  }
  /** Records in THIS device's ledger what has changed since last time. */
  function fold(s) {
    if (!s) return s;
    s.led = ledOf(s, DEV);
    return s;
  }

  function merge(a, b) {
    if (!a) return b;
    if (!b) return a;
    const newer = (a.updated || 0) >= (b.updated || 0) ? a : b;
    const older = newer === a ? b : a;
    const r = JSON.parse(JSON.stringify(newer));
    // Coins and tickets: the highest of each entry from each device, and the balance is the sum.
    const la = ledOf(a, 'old'), lb = ledOf(b, 'old'), led = {};
    for (const src of [la, lb]) for (const dev in src) for (const k in src[dev]) {
      const p = ((led[dev] = led[dev] || {})[k] = led[dev][k] || [0, 0]), q = src[dev][k];
      p[0] = Math.max(p[0], num(q[0])); p[1] = Math.max(p[1], num(q[1]));
    }
    r.led = led;
    r.tickets = r.tickets || { t1: 0, t10: 0 };
    for (const k in CUR) CUR[k][1](r, Math.max(0, ledSum(led, k)));
    for (const coll of ['owned', 'shiny']) {
      r[coll] = r[coll] || {};
      for (const k in older[coll] || {}) {
        if (!r[coll][k] || (older[coll][k].at || 0) < (r[coll][k].at || 0)) r[coll][k] = older[coll][k];
      }
    }
    for (const k in older.upgrades || {}) r.upgrades[k] = Math.max(r.upgrades[k] || 0, older.upgrades[k]);
    r.pupg = r.pupg || {};
    for (const d in older.pupg || {}) {
      const mine = r.pupg[d] = r.pupg[d] || {};
      for (const k in older.pupg[d]) mine[k] = Math.max(mine[k] || 0, older.pupg[d][k]);
    }
    r.pupgDone = r.pupgDone || older.pupgDone;
    // What's earned is never lost: union of legendaries, arenas, items, achievements...
    for (const coll of ['legends', 'arceus', 'arenas', 'itemsFound', 'evoMoves', 'ach']) {
      r[coll] = r[coll] || {};
      for (const k in older[coll] || {}) if (!r[coll][k]) r[coll][k] = older[coll][k];
    }
    r.arceusN = r.arceusN || {};
    for (const k in older.arceusN || {}) r.arceusN[k] = Math.max(r.arceusN[k] || 0, older.arceusN[k] || 0);
    // History: union of both copies' runs (by date), with the cap.
    r.history = cleanHistory([...(r.history || []), ...(older.history || [])]);
    // Missions from the same day/week: the highest progress and whatever was already collected.
    const mo = older.missions || {}, mr = r.missions = r.missions || {};
    for (const [per, list] of [['day', 'daily'], ['week', 'weekly']]) {
      if (mr[per] !== mo[per] || !mr[list] || !mo[list]) continue;
      mr[list].forEach((m, i) => {
        const o = mo[list][i];
        if (!o || o.id !== m.id) return;
        m.prog = Math.max(m.prog || 0, o.prog || 0);
        m.claimed = m.claimed || o.claimed;
        m.told = m.told || o.told;
      });
    }
    for (const k in older.stats || {}) r.stats[k] = Math.max(r.stats[k] || 0, older.stats[k] || 0);
    if (r.starter == null) r.starter = older.starter;
    if (r.personality == null) r.personality = older.personality;
    if (r.partner == null || !r.owned[r.partner]) { r.partner = older.partner; r.partnerShiny = older.partnerShiny; }
    r.created = Math.min(a.created || Date.now(), b.created || Date.now());
    r.updated = Math.max(a.updated || 0, b.updated || 0);
    return r;
  }

  /** Replaces the contents of `save` without changing the object (other modules hold it). */
  // Copies `s` onto the save WITHOUT changing the objects inside (upgrades,
  // Pokémon...): open screens keep references to them. Previously they were
  // replaced, and a purchase made just after uploading the save was
  // recorded on the old copy: the coins were charged and the upgrade was lost.
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  function assignDeep(dst, src) {
    for (const k of Object.keys(dst)) if (!(k in src)) delete dst[k];
    for (const k in src) {
      if (isObj(src[k]) && isObj(dst[k])) assignDeep(dst[k], src[k]);
      else dst[k] = src[k];
    }
  }
  function applyInPlace(s) { assignDeep(save, s); }

  const VALID = /^[A-Za-z0-9_ñÑáéíóúÁÉÍÓÚ]{3,16}$/;

  // =====================================================================
  //                               MODO LOCAL
  // =====================================================================

  async function hash(pass, salt) {
    const text = salt + ':' + pass;
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677);
    }
    return 'f' + (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
  }

  function randomSalt() {
    const a = new Uint8Array(12);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (let i = 0; i < a.length; i++) a[i] = Math.random() * 256;
    return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function loadLocal(k, name) {
    const s = read(K_SAVE + k);
    return s ? migrate(s, name) : newSave(name);
  }

  function beginLocal(k, name) {
    key = k; user = name; guest = false;
    save = fold(loadLocal(k, name));
    write(K_SES, k);
  }

  async function registerLocal(name, pass) {
    const accs = read(K_ACC) || {};
    const k = name.toLowerCase();
    if (accs[k]) return { ok: false, error: 'That name is already taken.' };
    const salt = randomSalt();
    accs[k] = { name, salt, hash: await hash(pass, salt), created: Date.now() };
    if (!write(K_ACC, accs)) return { ok: false, error: 'The browser won\'t let us save data (incognito mode?).' };
    beginLocal(k, name);
    write(K_SAVE + k, save);
    return { ok: true, isNew: true };
  }

  async function loginLocal(name, pass) {
    const accs = read(K_ACC) || {};
    const acc = accs[name.toLowerCase()];
    if (!acc || acc.hash !== await hash(pass || '', acc.salt)) {
      return { ok: false, error: 'Wrong username or password.' };
    }
    beginLocal(name.toLowerCase(), acc.name);
    return { ok: true, isNew: !save.partner };
  }

  function restoreLocal() {
    const k = read(K_SES);
    if (!k) return false;
    const accs = read(K_ACC) || {};
    if (!accs[k]) { remove(K_SES); return false; }
    beginLocal(k, accs[k].name);
    return true;
  }

  /** An old local account's save, if the name and password match. */
  async function legacySave(name, pass) {
    const k = (name || '').toLowerCase();
    const acc = (read(K_ACC) || {})[k];
    if (!acc || read(K_MIGRATED + k)) return null;
    if (acc.hash !== await hash(pass || '', acc.salt)) return null;
    const s = read(K_SAVE + k);
    return s ? { key: k, save: migrate(s, acc.name) } : null;
  }

  // =====================================================================
  //                               CLOUD MODE
  // =====================================================================

  let auth = null, fs = null, rtdb = null, uid = null, unlisten = null;
  let pushT = 0, retryT = 0, pending = false, pushing = null, lastPush = 0;
  // At most one upload every 30 min (with thousands of players, every 5 min
  // was tens of thousands of writes an hour); what costs something
  // (gacha, upgrades), after 30 s. The local copy is always saved immediately (and merged with the
  // cloud when signing in again), and on hiding or closing the tab what's pending is uploaded.
  // After pulls and purchases it uploads after 3 min (it was 30 s: anyone doing lots of pulls
  // saved twice a minute and it was millions of writes a day). What's done stays
  // in the browser copy immediately, and is uploaded on leaving the tab.
  // Since 13-10-2026, normally every 2 h (it was 30 min: 216,000 players a day
  // saved about 12 million times); on closing the tab, always; on
  // switching tabs, if it's been more than 30 min.
  // Whatever is worth something (pulls, purchases, new Pokémon, shinies, rewards,
  // records that get into a top) is uploaded straight away, and at the end of each run
  // at most every 30 min:
  // with 2 h, anyone opening the game on another device (or in another
  // app's browser) saw the old cloud copy and thought they'd lost it.
  const PUSH_GAP = 2 * 3600 * 1000, PUSH_GAP_URGENT = 15 * 1000, PUSH_GAP_RUN = 30 * 60 * 1000, HIDE_GAP = 30 * 60 * 1000;
  let syncState = 'local';           // 'ok' | 'syncing' | 'pending' | 'offline' | 'local'
  const listeners = new Set();

  function setSync(s) { syncState = s; listeners.forEach(fn => { try { fn(s); } catch (e) { /* nothing */ } }); }

  function loadScript(src) {
    return new Promise((res, rej) => {
      const el = document.createElement('script');
      el.src = src; el.async = true;
      el.onload = res; el.onerror = () => rej(new Error('Could not load ' + src));
      document.head.appendChild(el);
    });
  }

  /*
   * The cloud (Firebase) only from the official website: the
   * code is on GitHub, and a copy published on another website without changing
   * firebase-config.js would store its accounts and saves in OUR project
   * (and we'd pay for it). There the game runs in local mode. What
   * really locks it down is the API key restricted to these domains in
   * Google Cloud; this stops copies that don't even look (14-10-2026).
   */
  const HOSTS = ['dippydoco.github.io', 'localhost', '127.0.0.1'];

  async function initCloud() {
    const cfg = G.FIREBASE_CONFIG;
    if (!/^https?:$/.test(location.protocol)) { localReason = 'file'; return false; }
    if (cfg && !cfg.emulator && !HOSTS.includes(location.hostname)) { localReason = 'host'; return false; }
    if (!cfg || !cfg.apiKey || !cfg.projectId) { localReason = 'config'; return false; }
    await loadScript(SDK + 'firebase-app-compat.js');
    await loadScript(SDK + 'firebase-auth-compat.js');
    await loadScript(SDK + 'firebase-firestore-compat.js');
    // Realtime database: friends online, invitations and rooms.
    if (cfg.databaseURL) await loadScript(SDK + 'firebase-database-compat.js');
    firebase.initializeApp(cfg);
    auth = firebase.auth();
    fs = firebase.firestore();
    // Some networks and antivirus programs cut live updates (friends,
    // invitations): Firebase tries another way of receiving them if needed.
    try { fs.settings({ experimentalAutoDetectLongPolling: true }); } catch (e) { /* it already was */ }
    rtdb = cfg.databaseURL ? firebase.database() : null;
    // Only for testing: { ..., emulator: true } uses the local Firebase emulator.
    if (cfg.emulator) {
      auth.useEmulator('http://127.0.0.1:9099');
      fs.useEmulator('127.0.0.1', 8080);
      if (rtdb) rtdb.useEmulator('127.0.0.1', 9000);
    }
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    auth.languageCode = 'en';
    addEventListener('online', () => { if (pending) pushNow(); });
    // On leaving or closing the tab what's pending is uploaded, but no more than
    // once every 10 min: people switch tabs often and each save was
    // uploaded every ~9 min instead of every 30 (12-10-2026, Firebase's biggest
    // cost). Whatever isn't uploaded stays in this browser's copy and is
    // uploaded on signing in again.
    const hideFlush = () => { if (pending && Date.now() - lastPush > HIDE_GAP) pushNow(); };
    let hiddenAt = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); hideFlush(); }
      else if (hiddenAt && Date.now() - hiddenAt > PULL_GAP) pullSoon();
    });
    // On closing or reloading the page, what's pending is always uploaded.
    addEventListener('pagehide', () => { if (pending) pushNow(); });
    return true;
  }

  /*
   * On returning to the game after more than 30 min away (the phone with
   * yesterday's tab open), the cloud save is downloaded and merged with the one here
   * (1 read): that way what was earned on the other device shows up. Mid-run
   * it waits until you're back at the menu.
   */
  const PULL_GAP = 30 * 60 * 1000;
  let lastPull = 0, pullT = 0;
  function pullSoon() {
    clearTimeout(pullT);
    if (mode !== 'cloud' || guest || !save || !uid || Date.now() - lastPull < PULL_GAP) return;
    if (pushing || (G.Game && G.Game.state && G.Game.state !== 'ui')) { pullT = setTimeout(pullSoon, 20000); return; }
    lastPull = Date.now();
    const u = uid;
    docRef().get().then(snap => {
      if (!snap.exists || !save || uid !== u) return;
      applyInPlace(merge(plain(fold(save)), migrate(snap.data().save)));
      write(K_CLOUD + uid, save);
      if (G.UI && G.UI.refreshCoins) G.UI.refreshCoins();
    }).catch(e => console.warn('[DB] could not download the save:', e.code || e.message));
  }

  /** Firebase asks for an email: the name is encoded into an internal, unique and valid one. */
  function nameToEmail(name) {
    const hex = [...new TextEncoder().encode(name.trim().toLowerCase())].map(b => b.toString(16).padStart(2, '0')).join('');
    return hex + '@' + NAME_DOMAIN;
  }

  function displayNameOf(u) {
    const n = ((u && u.displayName) || 'Trainer').trim().split(/\s+/)[0].replace(/[^A-Za-z0-9_ñÑáéíóúÁÉÍÓÚ]/g, '');
    return (n || 'Trainer').slice(0, 16);
  }

  const docRef = () => fs.collection('saves').doc(uid);
  const plain = s => JSON.parse(JSON.stringify(s));
  /** The copy that goes to Firestore: run history has lists of lists (moves, teammates), which Firestore refuses, so they go as JSON strings. */
  const packSave = s => Object.assign({}, s, { history: (s.history || []).map(e => Object.assign({}, e, { m: JSON.stringify(e.m || []), mt: JSON.stringify(e.mt || []) },
                                                                                     e.z ? { z: JSON.stringify(e.z) } : {})) });      // Firestore no admite undefined

  /** Opens the cloud save of a user who has just authenticated. */
  async function openCloud(u, opts = {}) {
    uid = u.uid;
    const cached = read(K_CLOUD + uid);
    let remote = null, online = true;
    try {
      const snap = await docRef().get();
      remote = snap.exists ? snap.data().save : null;
    } catch (e) {
      if (!cached) throw e;                // offline and no copy: there's nothing to open
      online = false;
    }
    let s = merge(cached && fold(migrate(cached)), remote && migrate(remote));
    if (!s) s = newSave(opts.name || displayNameOf(u));
    if (opts.legacy) {
      s = merge(s, opts.legacy.save);
      write(K_MIGRATED + opts.legacy.key, uid);
    }
    save = fold(migrate(s, s.name));
    key = uid; user = save.name; guest = false;
    write(K_CLOUD + uid, save);
    lastPull = Date.now();
    // It only uploads if there's something the cloud doesn't have (a new account, progress
    // from this computer not yet uploaded...), and WITHOUT waiting: previously the menu didn't appear until
    // the upload finished, and with Firebase slow it took up to 9 s to get in.
    // (Comparing the whole text almost always gave "different" and it uploaded on every
    // sign-in: now only if this copy is newer than the cloud's.)
    const same = remote && !opts.legacy && (!cached || (cached.updated || 0) <= (remote.updated || 0));
    lastPush = Date.now();       // the first purchase or ticket doesn't upload immediately: it waits like the others
    if (!online) { pending = true; setSync('offline'); scheduleRetry(); }
    else if (same) setSync('ok');
    else pushNow();
  }

  /*
   * The document is no longer listened to live (each change cost a read).
   * If you play on two computers, the saves are merged when signing in and on
   * each upload (a transaction with merge()).
   */
  function stopListening() { if (unlisten) { unlisten(); unlisten = null; } }

  /*
   * If the admin has banned the account from the leaderboard (ban = true in the cloud, see
   * firestore.rules), every save has to keep it: it's copied from the cloud.
   * It never uploads twice in less than 65 s; meanwhile, everything is in the browser.
   */
  const K_OK = 'ps.cloudok.', MIN_GAP = 65000;
  const sinceOk = () => Date.now() - (+read(K_OK + uid) || 0);

  /** Uploads the save, merging it with whatever is in the cloud (transaction). */
  function pushNow() {
    if (mode !== 'cloud' || guest || !save || !uid) return Promise.resolve();
    // If an upload is already under way, another is done right after it (for whatever changed meanwhile).
    if (pushing) { pending = true; return pushing.then(() => (pending ? pushNow() : undefined)); }
    clearTimeout(pushT); pushT = 0; pushDue = 0;
    if (navigator.onLine === false) {
      pending = true; setSync('offline'); scheduleRetry();
      return Promise.resolve();
    }
    if (sinceOk() < MIN_GAP) {
      pending = true; setSync('pending');
      schedulePush(MIN_GAP - sinceOk() + 500);
      return Promise.resolve();
    }
    pending = false;
    lastPush = Date.now();
    setSync('syncing');
    let merged = null;
    const tr = fs.runTransaction(async tx => {
      const ref = docRef();
      const snap = await tx.get(ref);
      const remote = snap.exists ? migrate(snap.data().save) : null;
      merged = remote ? merge(plain(fold(save)), remote) : plain(fold(save));
      const doc = { save: packSave(merged), updatedAt: firebase.firestore.FieldValue.serverTimestamp(), v: VERSION };
      if (snap.exists && snap.data().ban === true) doc.ban = true;
      tx.set(ref, doc);
    });
    // If the network drops halfway, Firestore can be left waiting: 12 s cap.
    const timeout = new Promise((_, rej) => setTimeout(() => rej({ code: 'unavailable' }), 12000));
    let failed = false;
    pushing = Promise.race([tr, timeout]).then(() => {
      fails = 0;
      write(K_OK + uid, Date.now());
      // It MERGES with the current one (doesn't overwrite): if you changed something
      // while it was uploading (choosing a partner, a purchase...), it isn't lost.
      if (merged && save) { applyInPlace(merge(plain(fold(save)), merged)); write(K_CLOUD + uid, save); }
      setSync(pending ? 'pending' : 'ok');
      if (G.UI && G.UI.refreshCoins) G.UI.refreshCoins();
    }).catch(e => {
      console.warn('[DB] could not sync:', e.code || e.message);
      pending = true; failed = true;
      setSync(navigator.onLine === false || e.code === 'unavailable' ? 'offline' : 'pending');
      scheduleRetry();
    }).finally(() => {
      pushing = null;
      // (If it failed, the retry is already scheduled with its growing wait.)
      if (!failed && pending && syncState === 'pending') schedulePush(Math.max(1500, PUSH_GAP - (Date.now() - lastPush)));
    });
    return pushing;
  }

  // If an upload was already scheduled earlier, it's respected (a purchase doesn't wait for the next run).
  let pushDue = 0;
  function schedulePush(ms) {
    const due = Date.now() + ms;
    if (pushT && pushDue && pushDue <= due) return;
    clearTimeout(pushT); pushDue = due;
    pushT = setTimeout(() => { pushT = 0; pushDue = 0; pushNow(); }, ms);
  }
  /**
   * Retry with a growing wait: 15 s, 30 s, 1 min, 2 min... up to 10 min.
   * With many players, always retrying after 15 s when Firebase fails
   * (quota used up, outage) multiplied the reads (it happened on 10-10-2026).
   */
  let fails = 0;
  function scheduleRetry() {
    const ms = Math.min(10 * 60e3, 15e3 * Math.pow(2, fails)) * (0.8 + Math.random() * 0.4);
    fails = Math.min(fails + 1, 8);
    clearTimeout(retryT);
    retryT = setTimeout(() => { if (pending) pushNow(); }, ms);
  }

  function authError(e) {
    const c = (e && e.code) || '';
    const M = {
      'auth/email-already-in-use': 'That name is already taken.',
      'auth/invalid-credential': 'Wrong username or password.',
      'auth/invalid-login-credentials': 'Wrong username or password.',
      'auth/wrong-password': 'Wrong username or password.',
      'auth/user-not-found': 'Wrong username or password.',
      'auth/weak-password': 'The password must be at least 6 characters long.',
      'auth/too-many-requests': 'Too many attempts in a row. Please wait a moment.',
      'auth/network-request-failed': 'No internet connection.',
      'auth/popup-blocked': 'The browser blocked the Google window. Please allow pop-ups.',
      'auth/unauthorized-domain': 'This domain is not authorized in Firebase (Authentication > Settings > Authorized domains).',
      'auth/operation-not-allowed': 'That sign-in method is not enabled in Firebase.',
      // New account sign-up disabled in Firebase (Authentication > Settings).
      'auth/admin-restricted-operation': 'New accounts cannot be created right now. If you already have an account, sign in as usual; otherwise, you can play as a guest.',
      'auth/requires-recent-login': 'For security, please log in again and repeat the action.',
      'permission-denied': 'The database denied access (check the Firestore rules).',
      'unavailable': 'No connection to the database.'
    };
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return '';
    return M[c] || ('Error: ' + (c || (e && e.message) || 'desconocido'));
  }

  // =====================================================================
  //                           PUBLIC API
  // =====================================================================

  let readyP = null;

  /** Starts the database and recovers the previous session. → true if there's a session. */
  function ready() {
    if (readyP) return readyP;
    readyP = (async () => {
      try { if (await initCloud()) mode = 'cloud'; }
      catch (e) { console.warn('[DB] no cloud:', e.message); localReason = 'error'; mode = 'local'; }
      if (mode === 'local') { setSync('local'); return restoreLocal(); }
      const u = await new Promise(res => { const off = auth.onAuthStateChanged(x => { off(); res(x); }); });
      if (!u) return false;
      try { await openCloud(u); return true; }
      catch (e) { console.warn('[DB] could not open the save:', e.code || e.message); return false; }
    })();
    return readyP;
  }

  async function register(name, pass) {
    name = (name || '').trim();
    if (!VALID.test(name)) return { ok: false, error: 'The name must be 3-16 letters, numbers or _.' };
    const min = mode === 'cloud' ? 6 : 4;
    if ((pass || '').length < min) return { ok: false, error: `The password must be at least ${min} characters long.` };
    if (mode === 'local') return registerLocal(name, pass);
    // Monthly account cap (Firebase charges from 50,000 a month).
    try {
      const legacy = await legacySave(name, pass);
      const cred = await auth.createUserWithEmailAndPassword(nameToEmail(name), pass);
      await openCloud(cred.user, { name, legacy });
      return { ok: true, isNew: !save.partner, imported: !!legacy };
    } catch (e) { return { ok: false, error: authError(e) }; }
  }

  async function login(name, pass) {
    name = (name || '').trim();
    if (mode === 'local') return loginLocal(name, pass);
    try {
      const legacy = await legacySave(name, pass);
      const cred = await auth.signInWithEmailAndPassword(nameToEmail(name), pass || '');
      await openCloud(cred.user, { name, legacy });
      return { ok: true, isNew: !save.partner, imported: !!legacy };
    } catch (e) { return { ok: false, error: authError(e) }; }
  }

  async function loginWithGoogle() {
    if (mode !== 'cloud') return { ok: false, error: 'Google sign-in needs the online version of the game.' };
    try {
      const cred = await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      await openCloud(cred.user, { name: displayNameOf(cred.user) });
      return { ok: true, isNew: !save.partner };
    } catch (e) { return { ok: false, error: authError(e) }; }
  }

  /** Changes the name shown in the save (when choosing a nickname). */
  function setName(n) {
    if (!save || guest) return;
    save.name = n; user = n;
    commit();
  }

  /**
   * Balance Lab (?dev&lab): a throwaway save in memory. Like a guest it never writes anything
   * (commit() does nothing), and unlike playAsGuest it leaves the stored session alone, so
   * your real account is still signed in when you leave the lab.
   */
  function labSave() {
    user = 'Lab'; key = null; guest = true; uid = null;
    save = newSave('Lab');
    return save;
  }

  function playAsGuest() {
    user = 'Guest'; key = null; guest = true; uid = null;
    save = newSave('Guest');
    if (mode === 'local') remove(K_SES);
    return { ok: true, isNew: true };
  }

  /**
   * Saves the current game (does nothing in guest mode). In the browser,
   * immediately; in the cloud:
   * @param urgent  true: what's worth something (pulls, purchases, Pokémon, rewards): straight away
   *                'run': at the end of a run (at most every 30 min) · false: every 2 h
   */
  function commit(urgent = false) {
    if (guest || !key || !save) return false;
    save.updated = Date.now();
    fold(save);
    if (mode === 'local') return write(K_SAVE + key, save);
    write(K_CLOUD + uid, save);
    pending = true;
    setSync('pending');
    const gap = urgent === 'run' ? PUSH_GAP_RUN : urgent ? PUSH_GAP_URGENT : PUSH_GAP;
    schedulePush(Math.max(1200, gap - (Date.now() - lastPush)));
    return true;
  }

  /** Functions that run on signing out or deleting the account (friends, rooms...). */
  const leaveHooks = [];

  async function logout() {
    for (const fn of leaveHooks) { try { await fn('logout'); } catch (e) { /* nothing */ } }
    if (mode === 'cloud' && !guest && save) {
      if (pending) { try { await pushNow(); } catch (e) { /* the local copy remains */ } }
      stopListening();
      try { await auth.signOut(); } catch (e) { /* nothing */ }
    } else if (mode === 'local' && !guest) {
      commit();
      remove(K_SES);
    }
    clearTimeout(pushT); clearTimeout(retryT);
    user = key = save = uid = null; guest = false; pending = false;
    setSync(mode === 'cloud' ? 'ok' : 'local');
  }

  function nameAccount() { return !!(auth && auth.currentUser && (auth.currentUser.email || '').endsWith('@' + NAME_DOMAIN)); }

  /*
   * Recovering the account: name-and-password accounts don't have a real email
   * (a link can't be sent to them), so they're offered to LINK their Gmail:
   * if they ever forget the password, they sign in with Google and it's the same account.
   * Firebase's account system does it (free): not a single database read or
   * write.
   */
  function hasGoogle() {
    const u = auth && auth.currentUser;
    return !!(u && u.providerData.some(p => p.providerId === 'google.com'));
  }
  async function linkGoogle() {
    if (!auth || !auth.currentUser) return { ok: false, error: 'Sign in first.' };
    try {
      await auth.currentUser.linkWithPopup(new firebase.auth.GoogleAuthProvider());
      return { ok: true };
    } catch (e) {
      const c = (e && e.code) || '';
      if (c === 'auth/provider-already-linked') return { ok: true };
      if (c === 'auth/credential-already-in-use' || c === 'auth/email-already-in-use')
        return { ok: false, error: 'That Gmail already has its own game account. Use another Gmail.' };
      return { ok: false, error: authError(e) };
    }
  }

  /**
   * Deletes the account and the save (in the cloud or in this browser).
   * @param pass  password (name-and-password accounts)
   */
  async function deleteAccount(pass) {
    if (guest || !key) return { ok: false, error: 'There is no account to delete.' };
    if (mode === 'local') {
      const accs = read(K_ACC) || {};
      delete accs[key];
      write(K_ACC, accs);
      remove(K_SAVE + key); remove(K_SES);
      user = key = save = null;
      return { ok: true };
    }
    try {
      // First it confirms who you are: Firebase only allows deleting the account if
      // you signed in recently. Previously the data was deleted and then
      // that last step failed: the account was left empty but still existed and its name
      // couldn't be used again.
      const cu = auth.currentUser;
      if (nameAccount()) {
        if (!pass) return { ok: false, error: 'Type your password.' };
        await cu.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(cu.email, pass));
      } else {
        await cu.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider());
      }
      clearTimeout(pushT); clearTimeout(retryT); pending = false;
      stopListening();
      for (const fn of leaveHooks) await fn('delete');
      await docRef().delete();
      remove(K_CLOUD + uid);
      await auth.currentUser.delete();
      user = key = save = uid = null;
      return { ok: true };
    } catch (e) { return { ok: false, error: authError(e) }; }
  }

  // ---------------- save helpers ----------------

  function owns(dex) { return !!(save && save.owned[dex]); }

  function grant(dex, from) {
    if (!save.owned[dex]) save.owned[dex] = { at: Date.now(), from };
  }

  function ownsShiny(dex) { return !!(save && save.shiny && save.shiny[dex]); }

  /** Upgrades bought for a Pokémon: { id -> level }. */
  function upgradesOf(dex) {
    if (!save) return {};
    save.pupg = save.pupg || {};
    return save.pupg[dex] || (save.pupg[dex] = {});
  }

  /** Gives the shiny version (and the normal one, if it wasn't owned). Returns true if it's new. */
  function grantShiny(dex, from) {
    grant(dex, from);
    if (save.shiny[dex]) return false;
    save.shiny[dex] = { at: Date.now(), from };
    return true;
  }

  return {
    ready, register, login, loginWithGoogle, playAsGuest, labSave, logout, commit, deleteAccount, flush: pushNow,
    owns, grant, ownsShiny, grantShiny, merge, setName, upgradesOf, addHistory, cleanHistory, HISTORY_MAX,
    onSync(fn) { listeners.add(fn); },
    onLeave(fn) { leaveHooks.push(fn); },
    /** Low-level access for the network modules (cloud mode only). */
    get fb() { return mode === 'cloud' ? { auth, fs, rtdb, uid, emulator: !!(G.FIREBASE_CONFIG || {}).emulator } : null; },
    /** Are the online features (friends, leaderboard, multiplayer) available? */
    get online() { return mode === 'cloud' && !guest && !!uid && !!save; },
    /** Is the account a username-and-password one (not Google)? */
    get nameAccount() { return nameAccount(); },
    get hasGoogle() { return hasGoogle(); }, linkGoogle,
    get mode() { return mode; },
    get localReason() { return localReason; },
    get syncState() { return syncState; },
    get user() { return user; },
    get guest() { return guest; },
    get save() { return save; },
    get loggedIn() { return !!save; },
    get storageOk() { return storageOk; },
    START_COINS
  };
})();
