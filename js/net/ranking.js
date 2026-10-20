/* ============ ranking.js — time-survived leaderboard ============
 * Firestore (designed to use as little of the free plan as possible):
 *
 *   lbs/{table}        SUMMARY: the table's top 50 in ONE document
 *                      { top: { id: { t, uids, names, dex, shiny, lv, kills } }, me, ev }
 *                      Viewing a leaderboard tab = 1 read (previously ~52).
 *   lb/{table}/e/{id}  each player's or team's record (the one used to
 *                      work out your rank if you're not in the top 50)
 *
 *   table = mode + period:
 *     s_d20261008   solo, today               g_...   group
 *     s_w2026-41    ISO week                  s_m202610  month
 *     s_all2        all-time   (the yearly table was removed on 2026-10-10)
 *     s_all2_p25    all-time with Pikachu only (the per-Pokémon filter only
 *                   exists in the all-time table: that way each run writes half as much)
 *                   (all2 since Arceus's Judgment: with the end at
 *                    minute 30, the all-time table started from scratch; the old tables
 *                    s_all and s_all_pN stay on the server unused)
 *   id = your uid (solo) or the team's uids sorted and joined with "_".
 *   Group tables are split by team size (20-10-2026): g_w2026-43j_n3 is groups of 3,
 *   g_all2_p25_n4 groups of 4 with Pikachu, gk_..._n2 most kills in pairs. The older
 *   unsplit group tables (no _n) are still read and their rows shown under their
 *   team's size, so existing records kept their place; nothing new is written to them.
 *
 * Savings:
 *   - What's read is cached for 30 min in the browser (switching tabs and back: 0).
 *   - Your best records are remembered in the browser: at the end of a run
 *     nothing needs reading to know whether you've improved, and it only writes
 *     where you improve.
 *   - The summary is only touched if your record gets into the top 50.
 *   - In daily, weekly and monthly only top-50 records are stored: if
 *     you don't get in nothing is written and your rank shows as "outside the top 50".
 *     Your exact rank, even if you're 3,000th, only in the all-time table. With lots of
 *     people playing, it saves about 6 in 10 leaderboard writes.
 *
 * Periods are counted in Spanish time (Europe/Madrid).
 */
G.Ranking = (() => {
  const TZ = 'Europe/Madrid';
  const PERIODS = [['d', 'Daily'], ['w', 'Weekly'], ['m', 'Monthly'], ['a', 'All-time']];
  // Periods in which only the top 50 is stored (see above).
  // ('p' = a Pokémon's all-time table: almost every run got into its
  //  Pokémon's and wrote; now also only the top 50.)
  const TOP_ONLY = new Set(['d', 'w', 'm', 'p']);
  const TOP = 50;
  // Runs shorter than 2 minutes aren't uploaded (they never get into a top that
  // matters and they were many reads and writes for nothing: beginners
  // often die in the first minute; it was 1 min until 14-10-2026).
  const MIN_T = 120;
  const TTL = 30 * 60 * 1000;            // cache of what's been read (30 min: fewer Firestore reads)

  const fbx = () => G.DB.online ? G.DB.fb : null;

  // ---------------- periodos ----------------

  function madridDate(date) {
    const p = {};
    for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)) p[x.type] = x.value;
    return { y: +p.year, m: +p.month, d: +p.day };
  }

  /** ISO week (Monday to Sunday) of a y-m-d date. */
  function isoWeek(y, m, d) {
    const t = new Date(Date.UTC(y, m - 1, d));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return { year: t.getUTCFullYear(), week: Math.ceil(((t - y0) / 86400000 + 1) / 7) };
  }

  const ALL = 'all2';                     // all-time (see above)
  function periodIds(date = new Date()) {
    const { y, m, d } = madridDate(date);
    const w = isoWeek(y, m, d);
    const p2 = n => String(n).padStart(2, '0');
    return { d: 'd' + y + p2(m) + p2(d), w: 'w' + w.year + '-' + p2(w.week), m: 'm' + y + p2(m), y: 'y' + y, a: ALL };
  }

  /*
   * Table names: those from periodIds() except week and month, which carry
   * a "j" (since Arceus's Judgment, 14-10-2026: they started from scratch like the
   * all-time table, which had records from before the minute-30 ending). periodIds()
   * stays the same because the missions use it too (progress.js).
   */
  function boardIds(date) {
    const p = periodIds(date);
    return Object.assign({}, p, { w: p.w + 'j', m: p.m + 'j' });
  }

  /** The per-Pokémon filter only exists in the all-time table. */
  function board(mode, period, dex, size) {
    return mode + '_' + boardIds()[period] + (dex && period === 'a' && mode.length === 1 ? '_p' + dex : '')
      + (mode[0] === 'g' && size ? '_n' + size : '');
  }
  const SIZES = [2, 3, 4, 5];

  const col = b => fbx().fs.collection('lb').doc(b).collection('e');
  const sumRef = b => fbx().fs.collection('lbs').doc(b);

  // ---------------- browser cache ----------------

  const mem = new Map();                 // clave -> { at, v }
  // Your exact rank (outside the top 50) costs 1 read for every 1,000 records
  // ahead of you: it's kept for 6 h, and checked again sooner if you improve.
  const RANK_TTL = 6 * 3600 * 1000;
  const ttlOf = k => (k.startsWith('r:') ? RANK_TTL : TTL);
  function cacheGet(k) {
    let c = mem.get(k);
    if (!c) { try { c = JSON.parse(localStorage.getItem('ps.rk.c.' + k) || 'null'); } catch (e) { c = null; } if (c) mem.set(k, c); }
    return c && Date.now() - c.at < ttlOf(k) ? c.v : undefined;
  }
  function cacheSet(k, v) {
    const c = { at: Date.now(), v };
    mem.set(k, c);
    try { localStorage.setItem('ps.rk.c.' + k, JSON.stringify(c)); } catch (e) { /* lleno */ }
  }
  /** Deletes what's expired (the browser cache doesn't grow without limit). */
  function cachePrune() {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith('ps.rk.c.')) continue;
        const c = JSON.parse(localStorage.getItem(k) || 'null');
        if (!c || Date.now() - c.at > ttlOf(k.slice(8))) localStorage.removeItem(k);
      }
    } catch (e) { /* nothing */ }
  }
  cachePrune();

  // Your best records per table (so there's no read before writing).
  // (best2 since 2026-10-12: the broken records were removed from the leaderboard; this way anyone
  //  who had one looks up their real record again and can get back in.)
  const bestKey = () => 'ps.rk.best2.' + (fbx() ? fbx().uid : '');
  function bests() { try { return JSON.parse(localStorage.getItem(bestKey()) || '{}'); } catch (e) { return {}; } }
  function saveBests(b) {
    // Only the tables for the current periods and the all-time ones are kept.
    const cur = Object.values(boardIds());
    for (const k of Object.keys(b)) if (!cur.some(p => k.split(':')[0].split('_')[1] === p)) delete b[k];
    try { localStorage.setItem(bestKey(), JSON.stringify(b)); } catch (e) { /* lleno */ }
  }

  // ---------------- each table's threshold ----------------
  /*
   * The lowest record in each table's top 50, when it's full. It can only
   * rise over time, so an old value is still useful: if your record
   * doesn't beat it, it definitely won't get in and nothing needs reading (each summary
   * weighs ~30 KB and up to 5 were checked at the end of a run; 13-10-2026).
   */
  const THR = 'ps.rk.thr';
  function thresholds() { try { return JSON.parse(localStorage.getItem(THR) || '{}'); } catch (e) { return {}; } }
  function noteTop(b, top) {
    const vals = Object.values(top || {});
    if (vals.length < TOP) return;
    const vk = vkOf(b);
    const low = Math.min(...vals.map(v => v[vk] || 0));
    const t = thresholds();
    if ((t[b] || 0) >= low) return;
    t[b] = low;
    // Only the tables for the current periods (and the all-time ones).
    const cur = Object.values(boardIds());
    for (const k of Object.keys(t)) if (!cur.some(p => k.split('_')[1] === p)) delete t[k];
    try { localStorage.setItem(THR, JSON.stringify(t)); } catch (e) { /* lleno */ }
  }

  // ---------------- guardar ----------------

  // Kills tables ('sk_' solo, 'gk_' group) rank by `kills`; the time tables by `t`.
  const vkOf = b => /^[sg]k_/.test(b) ? 'kills' : 't';
  // `at` = when the record was set (ms). Top-50 rows store it as a number; entry docs have a Timestamp.
  const atMs = a => (a && a.toMillis ? a.toMillis() : typeof a === 'number' ? a : 0);
  const rowOf = (id, v) => ({ id, t: v.t, uids: v.uids || [], names: v.names || [], dex: v.dex || [], shiny: v.shiny || [], lv: v.lv, kills: v.kills, at: atMs(v.at) });
  const sorted = (top, vk = 't') => Object.entries(top || {}).map(([id, v]) => rowOf(id, v)).sort((a, b) => (b[vk] || 0) - (a[vk] || 0));
  const now = () => firebase.firestore.FieldValue.serverTimestamp();

  // ---------------- anti-trampas ----------------

  /**
   * When the FIRST run of the session starts (in a group, the host) the
   * server records the time: no record can last longer than the real time
   * since then (firestore.rules, validEntry). Once per session and not on
   * every run (14-10-2026: it was almost 150,000 extra writes a day; it's
   * just as safe, because the session always starts before the run).
   * It first waits for the previous run's record to finish uploading.
   */
  let busy = Promise.resolve(), runMarked = '';
  function runStarted(mode) {
    const fb = fbx();
    if (!fb || runMarked === fb.uid) return;
    runMarked = fb.uid;
    const go = n => fb.fs.collection('runs').doc(fb.uid).set({ startedAt: now(), mode })
      .catch(e => {
        console.warn('[Ranking] start:', e.code || e.message);
        if (n < 2) setTimeout(() => go(n + 1), 15000); else runMarked = '';
      });
    busy.then(() => go(0));
  }
  /** A record's upload (so the next run waits for it to finish). */
  function track(p) { busy = p.catch(() => {}); return p; }

  /** Saves the entry in each table where it improves. → periods improved */
  async function store(boards, id, entry, errs = null) {
    const fb = fbx();
    const better = [];
    const known = bests();
    await Promise.all(boards.map(async ([b, period]) => {
      const key = b + ':' + id;
      const vk = vkOf(b), v = entry[vk];
      try {
        const topOnly = TOP_ONLY.has(period);
        // If you don't reach the 50th record this browser knows of, you don't get in: in
        // daily, weekly, monthly and per-Pokémon there's nothing to do (or read).
        const thr = thresholds()[b] || 0;
        if (topOnly && thr && v <= thr) return;
        // Did you already have a better record? In the all-time table, if this browser doesn't
        // know, your record is checked once (small). In the others the
        // summary says so, which is read anyway inside the transaction below.
        if (known[key] === undefined && !topOnly) {
          const old = await col(b).doc(id).get();
          known[key] = old.exists ? (old.data()[vk] || 0) : 0;
        }
        if ((known[key] || 0) >= v) return;
        const data = Object.assign({}, entry, { at: firebase.firestore.FieldValue.serverTimestamp() });
        // If the table is already full and you don't reach the top 50, the summary needn't be touched
        // (and in daily, weekly and monthly, the record isn't even stored).
        const cached = cacheGet('s:' + b);
        if (thr && v <= thr && !(cached && id in cached)) {
          if (!topOnly) await col(b).doc(id).set(data);
          else { known[key] = v; return; }
        } else {
          let entered = true;
          let newTop = null;
          await fb.fs.runTransaction(async tx => {
            const s = await tx.get(sumRef(b));
            const top = Object.assign({}, s.exists ? s.data().top : {});
            // (No "shiny" if there aren't any: the summary weighs less.)
            const mine = { t: entry.t, uids: entry.uids, names: entry.names, dex: entry.dex, lv: entry.lv, kills: entry.kills, at: Date.now() };
            if (entry.shiny.some(Boolean)) mine.shiny = entry.shiny;
            let ev = '';
            // You were already there with a better record (another computer): nothing to write.
            if (id in top && (top[id][vk] || 0) >= v) { entered = false; newTop = top; return; }
            if (!(id in top) && Object.keys(top).length >= TOP) {
              const low = sorted(top, vk).pop();
              if ((low[vk] || 0) >= v) {                                // doesn't get into the top
                if (!topOnly) tx.set(col(b).doc(id), data);
                entered = false; newTop = top; return;
              }
              ev = low.id; delete top[ev];
            }
            tx.set(col(b).doc(id), data);
            top[id] = mine;
            tx.set(sumRef(b), { top, me: id, ev });
            newTop = top;
          });
          if (newTop) { cacheSet('s:' + b, newTop); noteTop(b, newTop); }
          if (topOnly && !entered) { known[key] = v; return; }
        }
        known[key] = v;
        if (/^g/.test(b)) known[b + ':*'] = Math.max(known[b + ':*'] || 0, v);
        mem.delete('r:' + b); try { localStorage.removeItem('ps.rk.c.r:' + b); } catch (e) { /* nothing */ }
        if (vk === 't' && period && period !== 'p' && !better.includes(period)) better.push(period);
      } catch (e) { console.warn('[Ranking] could not save to', b, e.code || e.message); if (errs) errs.push(b + ': ' + (e.code || e.message)); }
    }));
    saveBests(known);
    return better;
  }

  function announce(better) {
    if (!better.length) return;
    const names = { d: 'today', w: 'of the week', m: 'of the month', a: 'all-time' };
    const best = PERIODS.map(p => p[0]).filter(p => better.includes(p)).pop();
    G.UI.toast('New best record ' + names[best] + ' on the leaderboard!', 3400);
  }

  function submitSolo(r) { return track(submitSoloNow(r)); }
  async function submitSoloNow(r) {
    const fb = fbx();
    if (!fb || !G.Social.me || r.t < MIN_T) return [];
    const ids = boardIds();
    const entry = { t: r.t, uids: [fb.uid], names: [G.Social.me.name], dex: [r.dex], shiny: [!!r.shiny], lv: r.lv, kills: r.kills };
    const boards = PERIODS.map(([p]) => ['s_' + ids[p], p]);
    boards.push(['s_' + ALL + '_p' + r.dex, 'p']);
    if (r.kills > 0) for (const [p] of PERIODS) boards.push(['sk_' + ids[p], p]);       // most-kills tables
    const better = await store(boards, fb.uid, entry);
    announce(better);
    return better;
  }

  /** The host uploads it, with the whole team. */
  function submitGroup(r) { return track(submitGroupNow(r)); }
  async function submitGroupNow(r) {
    const fb = fbx();
    if (!fb || r.t < MIN_T || !r.members || r.members.length < 2) return [];
    const ms = r.members.slice().sort((a, b) => (a.uid < b.uid ? -1 : 1));
    const id = ms.map(m => m.uid).join('_');
    const entry = { t: r.t, uids: ms.map(m => m.uid), names: ms.map(m => m.name), dex: ms.map(m => m.dex),
                    shiny: ms.map(m => !!m.shiny), lv: r.lv, kills: r.kills };
    const ids = boardIds(), n = '_n' + ms.length;          // a table per team size
    const boards = PERIODS.map(([p]) => ['g_' + ids[p] + n, p]);
    for (const d of new Set(entry.dex)) boards.push(['g_' + ALL + '_p' + d + n, 'p']);
    if (r.kills > 0) for (const [p] of PERIODS) boards.push(['gk_' + ids[p] + n, p]);       // most-kills tables
    const better = await store(boards, id, entry);
    announce(better);
    return better;
  }

  // ---------------- leer ----------------

  /** A table's top 50 (1 read, or 0 if it was read less than 30 min ago). */
  const inflight = new Map();             // table -> read in progress (the list and your rank share it)
  async function summary(b) {
    const c = cacheGet('s:' + b);
    if (c !== undefined) return c;
    if (!inflight.has(b)) {
      inflight.set(b, sumRef(b).get().then(s => {
        const top = s.exists ? (s.data().top || {}) : {};
        cacheSet('s:' + b, top);
        noteTop(b, top);
        return top;
      }).finally(() => inflight.delete(b)));
    }
    return inflight.get(b);
  }

  /**
   * A table's best records.
   * @param friendsOnly  only you and your friends
   */
  async function top(mode, period, dex, friendsOnly, size) {
    const rows = await topRows(mode, period, dex, friendsOnly, size);
    if (period === 'a') await fillDates(board(mode, period, mode.length > 1 ? null : dex, size), rows);
    return rows;
  }

  /**
   * A table's top rows. For a group size, its own table plus that size's rows from the
   * older unsplit group table (best per team; each row remembers its table in `src`).
   */
  async function summaryRows(mode, period, dex, size) {
    const b = board(mode, period, dex, size), vk = vkOf(b);
    const own = sorted(await summary(b), vk).map(r => Object.assign(r, { src: b }));
    if (mode[0] !== 'g' || !size) return own;
    const old = board(mode, period, dex);
    const legacy = sorted(await summary(old), vk).filter(r => r.uids.length === size).map(r => Object.assign(r, { src: old }));
    const all = new Map();
    for (const r of [...legacy, ...own]) if (!all.has(r.id) || (all.get(r.id)[vk] || 0) < (r[vk] || 0)) all.set(r.id, r);
    return [...all.values()].sort((a, c) => (c[vk] || 0) - (a[vk] || 0));
  }

  /**
   * All-time rows set before dates were stored have no `at`: read it once from the
   * record itself and remember it in this browser (so each old row costs one read, ever).
   */
  async function fillDates(b, rows) {
    const vk = vkOf(b), KEY = 'ps.rk.dates';
    let c = {};
    try { c = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { c = {}; }
    const need = [];
    for (const r of rows) {
      if (r.at) continue;
      const k = (r.src || b) + ':' + r.id + ':' + r[vk];
      if (c[k]) r.at = c[k]; else need.push([r, k]);
    }
    if (!need.length) return;
    await Promise.all(need.map(async ([r, k]) => {
      try {
        const d = await col(r.src || b).doc(r.id).get();
        const at = d.exists ? atMs(d.data().at) : 0;
        if (at) { r.at = at; c[k] = at; }
      } catch (e) { /* no date */ }
    }));
    try {
      if (Object.keys(c).length > 800) c = Object.fromEntries(Object.entries(c).slice(-400));
      localStorage.setItem(KEY, JSON.stringify(c));
    } catch (e) { /* nothing */ }
  }

  async function topRows(mode, period, dex, friendsOnly, size) {
    const fb = fbx();
    if (!fb) return [];
    if (mode.length > 1) dex = null;                      // no per-Pokémon filter on kills tables
    const b = board(mode, period, dex, size), vk = vkOf(b);
    const rows = await summaryRows(mode, period, dex, size);
    if (!friendsOnly) return rows.slice(0, TOP);
    const circle = [fb.uid, ...G.Social.friends.filter(f => f.status === 'ok').map(f => f.uid)].slice(0, 30);
    const inTop = rows.filter(r => r.uids.some(u => circle.includes(u)));
    // In daily, weekly, monthly and per-Pokémon there are no records outside the top 50.
    if (TOP_ONLY.has(period) || dex) return inTop;
    // Friends who aren't in the top 50: looked up separately (and cached for 30 min).
    const ck = 'f:' + b + ':' + circle.slice().sort().join(',');
    let extra = cacheGet(ck);
    if (extra === undefined) {
      if (mode[0] === 's') {
        const missing = circle.filter(u => !inTop.some(r => r.id === u));
        const docs = await Promise.all(missing.map(u => col(b).doc(u).get().catch(() => null)));
        extra = docs.filter(d => d && d.exists).map(d => rowOf(d.id, d.data()));
      } else {
        extra = [];
        for (const t of size ? [board(mode, period, dex), b] : [b]) {
          const s = await col(t).where('uids', 'array-contains-any', circle).get();
          extra.push(...s.docs.map(d => Object.assign(rowOf(d.id, d.data()), { src: t })).filter(r => !size || r.uids.length === size));
        }
      }
      cacheSet(ck, extra);
    }
    const all = new Map();
    for (const r of [...inTop, ...extra]) if (!all.has(r.id) || (all.get(r.id)[vk] || 0) < (r[vk] || 0)) all.set(r.id, r);
    return [...all.values()].sort((a, c) => (c[vk] || 0) - (a[vk] || 0)).slice(0, TOP);
  }

  /** Your rank in the table (even if you're not in the top). → { pos, t, row } | null */
  async function myRank(mode, period, dex, size) {
    const fb = fbx();
    if (!fb) return null;
    if (mode.length > 1) dex = null;
    const b = board(mode, period, dex, size), vk = vkOf(b);
    // Are you in the top 50? Then the rank comes from the summary, at no cost.
    const rows = await summaryRows(mode, period, dex, size);
    const i = rows.findIndex(r => r.uids.includes(fb.uid));
    if (i >= 0) return { pos: i + 1, t: rows[i][vk], row: rows[i] };
    if (TOP_ONLY.has(period) || dex) return { out: true };
    const ck = 'r:' + b;
    const c = cacheGet(ck);
    if (c !== undefined) return c;
    // If this browser already knows you have no record in this table, it isn't checked.
    const kb = bests(), mk = b + ':' + (mode[0] === 's' ? fb.uid : '*');
    if (kb[mk] === 0) { cacheSet(ck, null); return null; }
    let mine = null;
    if (mode[0] === 's') {
      const d = await col(b).doc(fb.uid).get();
      if (d.exists) mine = rowOf(d.id, d.data());
    } else {
      for (const t of size ? [board(mode, period, dex), b] : [b]) {
        const s = await col(t).where('uids', 'array-contains', fb.uid).get();
        for (const d of s.docs) {
          const r = rowOf(d.id, d.data());
          if (size && r.uids.length !== size) continue;
          if (!mine || r[vk] > mine[vk]) mine = r;
        }
      }
    }
    kb[mk] = mine ? mine[vk] : 0;
    saveBests(kb);
    let res = null;
    // (By size: the records ahead in its own table, plus that size's rows ahead in the older table's top 50.)
    if (mine) res = { pos: (await countAbove(b, mine[vk], vk)) + 1
      + (size ? rows.filter(r => r.src !== b && (r[vk] || 0) > mine[vk]).length : 0), t: mine[vk], row: mine };
    cacheSet(ck, res);
    return res;
  }

  /**
   * How many entries have more time. The SDK's "compat" version doesn't have
   * count(), so the REST aggregation API is used (1 read for every
   * 1,000 entries, instead of reading them all). Only used if you're not in the top 50.
   */
  async function countAbove(b, t, vk = 't') {
    const fb = fbx();
    const cfg = G.FIREBASE_CONFIG;
    const base = fb.emulator ? 'http://127.0.0.1:8080/v1' : 'https://firestore.googleapis.com/v1';
    const url = `${base}/projects/${cfg.projectId}/databases/(default)/documents/lb/${encodeURIComponent(b)}:runAggregationQuery`;
    const token = await fb.auth.currentUser.getIdToken();
    const body = { structuredAggregationQuery: {
      structuredQuery: { from: [{ collectionId: 'e' }],
        where: { fieldFilter: { field: { fieldPath: vk }, op: 'GREATER_THAN', value: { integerValue: String(t) } } } },
      aggregations: [{ alias: 'n', count: {} }] } };
    try {
      const r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      const n = j && j[0] && j[0].result && j[0].result.aggregateFields && j[0].result.aggregateFields.n;
      return n ? +n.integerValue : 0;
    } catch (e) {
      console.warn('[Ranking] rank:', e.message);
      return 0;
    }
  }

  /** When deleting the account: removes your rows from the summaries this browser knows of. */
  async function removeMine() {
    const fb = fbx();
    if (!fb) return;
    const ids = boardIds();
    const boards = new Set();
    for (const m of ['s', 'g', 'sk', 'gk']) for (const [p] of PERIODS) {
      boards.add(m + '_' + ids[p]);
      if (m[0] === 'g') for (const n of SIZES) boards.add(m + '_' + ids[p] + '_n' + n);
    }
    for (const k of Object.keys(bests())) boards.add(k.split(':')[0]);
    await Promise.all([...boards].map(b => fb.fs.runTransaction(async tx => {
      const s = await tx.get(sumRef(b));
      if (!s.exists) return;
      const top = s.data().top || {};
      for (const [id, v] of Object.entries(top)) {
        if (!(v.uids || []).includes(fb.uid)) continue;
        // One row per write (the rules only allow removing one at a time).
        const next = Object.assign({}, top); delete next[id];
        tx.set(sumRef(b), { top: next, me: '', ev: id });
        return;
      }
    }).catch(() => {})));
    try { localStorage.removeItem(bestKey()); } catch (e) { /* nothing */ }
  }

  // ---------------- reports and moderation ----------------

  /** Reports a suspicious record (once per record and player). → true if it was sent */
  const repKey = () => 'ps.rk.rep.' + (fbx() ? fbx().uid : '');
  function reported() { try { return new Set(JSON.parse(localStorage.getItem(repKey()) || '[]')); } catch (e) { return new Set(); } }
  async function report(b, row) {
    const fb = fbx();
    if (!fb) return false;
    const key = b + '__' + row.id;
    const done = reported();
    if (!done.has(key)) {
      // (If you had already reported it from another computer, the server won't allow a repeat: no matter.)
      await fb.fs.collection('reports').doc(key + '__' + fb.uid)
        .set({ board: b, e: row.id, names: row.names.slice(0, 5), t: row.t | 0, by: fb.uid, at: now() }).catch(() => {});
      done.add(key);
      try { localStorage.setItem(repKey(), JSON.stringify([...done].slice(-300))); } catch (e) { /* lleno */ }
    }
    return true;
  }

  // Moderation account (firestore.rules, admin()): the hidden screen in js/ui/mod-ui.js.
  const ADMINS = ['Hn5Mdk51FGN9Rkj1BDMVcOvF1N53'];
  const isAdmin = () => !!fbx() && ADMINS.includes(fbx().uid);

  /** Admin: the reports, grouped by record (most reported first). */
  async function reports() {
    const s = await fbx().fs.collection('reports').orderBy('at', 'desc').limit(400).get();
    const by = new Map();
    for (const d of s.docs) {
      const v = d.data(), k = v.board + '__' + v.e;
      if (!by.has(k)) by.set(k, { board: v.board, e: v.e, names: v.names || [], t: v.t, n: 0, ids: [], at: v.at && v.at.toMillis ? v.at.toMillis() : 0 });
      const g = by.get(k); g.n++; g.ids.push(d.id);
    }
    return [...by.values()].sort((a, b) => b.n - a.n || b.at - a.at);
  }

  /** Admin: a record's row in its table's top 50 (or null if it's no longer there). */
  async function entryInfo(b, e) {
    const top = await summary(b);
    return top[e] ? rowOf(e, top[e]) : null;
  }

  /** Admin: removes a record from a table (the record and its top-50 row). */
  async function removeEntry(b, e) {
    const fb = fbx();
    await col(b).doc(e).delete().catch(() => {});
    await fb.fs.runTransaction(async tx => {
      const s = await tx.get(sumRef(b));
      const top = Object.assign({}, s.exists ? s.data().top : {});
      if (!(e in top)) return;
      delete top[e];
      tx.set(sumRef(b), { top, me: '', ev: e });
    }).catch(err => console.warn('[Ranking] remove', b, err.code || err.message));
    cacheSet('s:' + b, undefined);
  }

  /** Admin: removes a player's or team's record from all current tables (and from `also`). */
  async function removeEverywhere(e, mode, dexes = [], also = null) {
    const ids = boardIds();
    const boards = new Set(PERIODS.flatMap(([p]) => [mode + '_' + ids[p], mode + 'k_' + ids[p]]));
    for (const d of dexes) boards.add(mode + '_' + ALL + '_p' + d);
    if (mode === 'g') for (const b of [...boards]) for (const n of SIZES) boards.add(b + '_n' + n);
    if (also) boards.add(also);
    await Promise.all([...boards].map(b => removeEntry(b, e)));
  }

  /**
   * Admin: removes from ALL tables the records longer than `maxT` seconds (the
   * rows of each top 50 and the loose records in the all-time table). With Arceus's
   * Judgment most runs end by ~33 min (a few strong ones pass an hour; the server allows up to 2 h). → { rows, boards }
   */
  async function purgeAbove(maxT, onProgress) {
    const fs = fbx().fs;
    const all = await fs.collection('lbs').get();
    let rows = 0, boards = 0, n = 0;
    for (const d of all.docs) {
      n++;
      if (onProgress && n % 50 === 0) onProgress(n, all.size);
      const top = d.data().top || {};
      const bad = Object.keys(top).filter(id => (top[id].t || 0) > maxT);
      if (!bad.length) continue;
      await fs.runTransaction(async tx => {
        const s = await tx.get(d.ref);
        const cur = Object.assign({}, (s.exists && s.data().top) || {});
        const gone = Object.keys(cur).filter(id => (cur[id].t || 0) > maxT);
        if (!gone.length) return;
        for (const id of gone) delete cur[id];
        tx.set(d.ref, { top: cur, me: '', ev: gone[0] });
      });
      await Promise.all(bad.map(id => fs.collection('lb').doc(d.id).collection('e').doc(id).delete().catch(() => {})));
      rows += bad.length; boards++;
      mem.delete('s:' + d.id); try { localStorage.removeItem('ps.rk.c.s:' + d.id); } catch (e) { /* nothing */ }
    }
    // All-time records that aren't in the top 50 (used for the exact rank).
    for (const b of ['s_' + ALL, 'g_' + ALL, ...SIZES.map(n => 'g_' + ALL + '_n' + n)]) {
      const q = await col(b).where('t', '>', maxT).get();
      await Promise.all(q.docs.map(e => e.ref.delete().catch(() => {})));
      rows += q.size;
    }
    return { rows, boards };
  }

  /**
   * Admin: puts a verified run from a player's history on the leaderboard (one the server refused
   * at the time, e.g. over the old 1-hour limit). It goes to the tables of the day, week and month
   * it was played, all-time, its Pokémon's all-time table and the kills tables, like a normal record.
   * @param run    a history entry ({ id: end time ms, d, sh, t, lv, k, g, mt: [[name, dex, shiny]] })
   * @param owner  { uid, name } of the player whose history it is
   * → { boards: tables written, better: tables where it improved, missing: teammates not found }
   */
  async function adminAdd(run, owner) {
    const fb = fbx();
    if (!fb || !isAdmin()) throw new Error('admin only');
    const when = new Date(run.id || Date.now());
    const ids = boardIds(when);
    let members = [{ uid: owner.uid, name: owner.name, dex: run.d, shiny: !!run.sh }];
    const missing = [];
    if (run.g && Array.isArray(run.mt)) {
      for (const [name, dex, sh] of run.mt) {
        const n = await fb.fs.collection('names').doc(String(name).toLowerCase()).get().catch(() => null);
        if (n && n.exists && n.data().uid) members.push({ uid: n.data().uid, name, dex, shiny: !!sh });
        else missing.push(name);
      }
    }
    if (run.g && members.length < 2) throw new Error('teammates not found: ' + missing.join(', '));
    const group = members.length > 1;
    members = members.sort((a, b) => (a.uid < b.uid ? -1 : 1));
    const id = members.map(m => m.uid).join('_');
    const entry = { t: Math.floor(run.t), uids: members.map(m => m.uid), names: members.map(m => m.name),
                    dex: members.map(m => m.dex), shiny: members.map(m => m.shiny), lv: Math.max(1, run.lv | 0), kills: run.k | 0 };
    const boards = [];
    if (group) {
      const n = '_n' + members.length;
      for (const [p] of PERIODS) boards.push(['g_' + ids[p] + n, p]);
      for (const d of new Set(entry.dex)) boards.push(['g_' + ALL + '_p' + d + n, 'p']);
      if (entry.kills > 0) for (const [p] of PERIODS) boards.push(['gk_' + ids[p] + n, p]);
    } else {
      for (const [p] of PERIODS) boards.push(['s_' + ids[p], p]);
      boards.push(['s_' + ALL + '_p' + run.d, 'p']);
      if (entry.kills > 0) for (const [p] of PERIODS) boards.push(['sk_' + ids[p], p]);
    }
    const errs = [];
    const better = await store(boards, id, entry, errs);
    for (const [b] of boards) { mem.delete('s:' + b); try { localStorage.removeItem('ps.rk.c.s:' + b); } catch (e) { /* nothing */ } }
    return { boards: boards.length, better, missing, errs };
  }

  /** Admin: bans or unbans an account from the leaderboard (banned = can't upload records). */
  function setMarked(uid, on) { return fbx().fs.collection('saves').doc(uid).update({ ban: !!on }); }
  /** Admin: deletes reports already seen. */
  function dismiss(ids) { return Promise.all(ids.map(id => fbx().fs.collection('reports').doc(id).delete().catch(() => {}))); }
  /** Admin: accounts banned from the leaderboard. */
  async function markedAccounts() {
    const s = await fbx().fs.collection('saves').where('ban', '==', true).limit(100).get();
    return s.docs.map(d => { const v = d.data().save || {}; return { uid: d.id, name: v.name || '?', coins: v.coins || 0,
      t1: (v.tickets || {}).t1 || 0, t10: (v.tickets || {}).t10 || 0, owned: Object.keys(v.owned || {}).length }; });
  }

  return { PERIODS, SIZES, periodIds, board, runStarted, submitSolo, submitGroup, top, myRank, removeMine,
           report, reported, isAdmin, reports, adminAdd, entryInfo, removeEntry, purgeAbove, removeEverywhere, setMarked, dismiss, markedAccounts };
})();
