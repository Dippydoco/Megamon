/* ============ mastery.js — per-Pokémon Mastery (out of runs, cosmetic only) ============
 * Every Pokémon has its own Mastery level, earned by playing runs with it (28-10-2026). The rewards stop at Mastery 10
 * (MAX, "mastered"), but the level keeps going past it with no further rewards, just the number. It gives no
 * stats: every reward is cosmetic (ribbons, titles, a footstep trail, a run intro, an aura, a profile banner, its
 * skins). Shown as a ribbon and "Mastery N", never "level", so it isn't mixed up with the per-Pokémon Upgrades.
 *
 * Save:  mxp   dex -> total Mastery XP (only grows; the cloud merge keeps the highest)
 *        mday  dex -> 'YYYY-MM-DD' of its last first-run-of-the-day bonus
 *        mxpInit  1 once the head start from the run history has been given
 *
 * XP per run (award): 5 per minute survived (up to 30), 2 per level, 10 per boss, 25 per legendary in a rift,
 * 100 for reaching Arceus; Battle Tower 4 per floor cleared and 25 per boss floor. +10% in a group, ×1.5 for the
 * first run of the day with that Pokémon. Runs under a minute give nothing.
 */
G.Mastery = (() => {
  // Total XP needed for Mastery 1..10 (doubled on 28-10-2026: it was 100 ... 4,000). Past 10 each level costs STEP more.
  const NEED = [0, 200, 500, 900, 1400, 2000, 2800, 3800, 5000, 6400, 8000];
  const MAX = 10, STEP = 3200, CAP = 999;
  /** Total XP needed for Mastery `l` (any level, past 10 too). */
  const need = l => (l <= MAX ? NEED[l] : NEED[MAX] + (l - MAX) * STEP);
  const DAILY = 1.5, GROUP = 1.1;

  const save = () => G.DB.save;
  const xpOf = (dex, s = save()) => (s && s.mxp && s.mxp[dex]) || 0;
  function levelFor(xp) {
    if (xp >= NEED[MAX]) return Math.min(CAP, MAX + Math.floor((xp - NEED[MAX]) / STEP));
    let l = 0; while (l < MAX && xp >= NEED[l + 1]) l++; return l;
  }
  const level = (dex, s = save()) => levelFor(xpOf(dex, s));
  /** { lv, xp, into, span, frac } for drawing a bar. */
  function progress(dex, s = save()) {
    const xp = xpOf(dex, s), lv = levelFor(xp);
    if (lv >= CAP) return { lv, xp, into: 0, span: 0, frac: 1 };
    const into = xp - need(lv), span = need(lv + 1) - need(lv);
    return { lv, xp, into, span, frac: into / span };
  }
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const dailyReady = (dex, s = save()) => !(s && s.mday && s.mday[dex] === today());

  // ---------------- rewards ----------------

  const TIERS = { 1: 'bronze', 4: 'silver', 7: 'gold', 10: 'crown' };
  /** Ribbon tier for a Mastery level: '' (none), 'bronze', 'silver', 'gold' or 'crown'. */
  function ribbon(lv) { return lv >= 10 ? 'crown' : lv >= 7 ? 'gold' : lv >= 4 ? 'silver' : lv >= 1 ? 'bronze' : ''; }

  /** The ribbon as HTML ('' below Mastery 1): medal by tier and the number. */
  function badge(lv, size = 14) {
    if (!lv) return '';
    const t = ribbon(lv), ic = { bronze: 'medal1', silver: 'medal2', gold: 'medal3', crown: 'crown' }[t];
    return `<span class="mst-rib mst-${t}" title="Mastery ${lv}">${G.Icons.html(ic, size)}<b>${lv}</b></span>`;
  }

  /** What each Mastery level gives this Pokémon (its own forms included), for the reward track. */
  function track(dex) {
    const mon = G.DEX_BY[dex], name = mon ? mon.name : '?';
    const forms = (G.SkinData.OF[dex] || []);
    const fem = forms.find(f => f.cat === 'female');
    const megas = forms.filter(f => f.route.kind === 'mega');
    const out = [];
    const add = (lv, text, icon) => out.push({ lv, text, icon });
    add(1, 'Bronze ribbon on its card', 'medal1');
    add(2, 'Footstep trail in runs, in its type colour', 'boot');
    add(3, 'Title "' + name + ' Trainer"', 'medal2');
    add(4, 'Silver ribbon and a type-coloured card frame', 'medal2');
    add(5, fem ? 'Skin: ' + fem.name : 'A soft glow in its type colour in runs', fem ? 'shiny' : 'sprout');
    add(6, 'Run intro: a hop and a spin when a run starts', 'boot');
    add(7, 'Gold ribbon; your co-op name tag takes its type colour', 'medal3');
    add(8, 'A subtle sparkle aura in runs', 'shiny');
    add(9, 'A profile banner featuring ' + name, 'star');
    add(10, 'Crown, title "Master of ' + name + '"' + (megas.length ? ', and ' + megas.map(f => f.name).join(' and ') + ' (with its gold star)' : ''), 'crown');
    for (const f of forms) if (f.route.kind === 'mastery' && f.cat !== 'female') add(f.route.level, 'Skin: ' + f.name, 'shiny');
    return out.sort((a, b) => a.lv - b.lv);
  }

  /** Titles from Mastery (added to the profile's title list). */
  function titles(s = save()) {
    const out = [];
    for (const d in (s && s.mxp) || {}) {
      const mon = G.DEX_BY[d], lv = level(d, s);
      if (!mon) continue;
      if (lv >= 10) out.push('Master of ' + mon.name);
      if (lv >= 3) out.push(mon.name + ' Trainer');
    }
    return out;
  }

  /** Profile banners from Mastery 9 ('m' + dex; see data/cosmetics.js). */
  function banners(s = save()) {
    return Object.keys((s && s.mxp) || {}).filter(d => G.DEX_BY[d] && level(d, s) >= 9).map(Number);
  }

  // ---------------- XP ----------------

  /** XP parts for a finished run. r = { time, level, bosses, legends, judged, tower, group } */
  function partsFor(r) {
    const p = {};
    if (r.tower) {
      const cleared = Math.max(0, (r.tower.best || r.tower.floor || 0) - (r.tower.start || 1) + (r.tower.won ? 1 : 0));
      let bossFloors = 0;
      for (let f = r.tower.start || 1; f < (r.tower.start || 1) + cleared; f++) if (f % 5 === 0) bossFloors++;
      p.floors = cleared * 4;
      p.boss = bossFloors * 25;
    } else {
      p.time = Math.floor(Math.min(30, (r.time || 0) / 60)) * 5;
      p.level = (r.level || 0) * 2;
      p.bosses = (r.bosses || 0) * 10;
      p.legends = (r.legends || 0) * 25;
      if (r.judged) p.arceus = 100;
    }
    return p;
  }

  /**
   * Gives a finished run's Mastery XP to its Pokémon. Returns what the run-end screen shows:
   * { dex, before, after, gained, parts, daily, group, lvBefore, lvAfter }, or null.
   */
  function award(dex, r) {
    const s = save();
    if (!s || !G.DEX_BY[dex]) return null;
    if (!r.tower && (r.time || 0) < 60) return { dex, none: 'Runs under a minute give no Mastery XP.' };
    const parts = partsFor(r);
    let gained = Object.values(parts).reduce((a, b) => a + b, 0);
    const daily = dailyReady(dex, s);
    if (r.group) gained *= GROUP;
    if (daily) gained *= DAILY;
    gained = Math.round(gained);
    s.mxp = s.mxp || {}; s.mday = s.mday || {};
    const before = s.mxp[dex] || 0;
    s.mxp[dex] = before + gained;
    if (daily && gained > 0) s.mday[dex] = today();
    const out = { dex, before, after: s.mxp[dex], gained, parts, daily, group: !!r.group,
                  lvBefore: levelFor(before), lvAfter: levelFor(s.mxp[dex]) };
    if (G.Skins) G.Skins.check(true);
    return out;
  }

  /** Head start for existing players: XP from the runs in the history, plus 300 per time it reached Arceus. Once. */
  function backfill(s) {
    if (!s || s.mxpInit) return;
    const got = {};
    for (const e of s.history || []) {
      if (!e.d) continue;
      const p = partsFor({ time: e.t, level: e.lv, bosses: e.b, judged: !!e.ar, group: !!e.g });
      let x = Object.values(p).reduce((a, b) => a + b, 0);
      if (e.g) x *= GROUP;
      got[e.d] = (got[e.d] || 0) + x;
    }
    // Arceus runs already counted above give their 100 each; the gold star count adds 300 per time on top.
    for (const d in s.arceusN || {}) got[d] = (got[d] || 0) + 300 * (s.arceusN[d] || 0);
    s.mxp = s.mxp || {};
    for (const d in got) if (G.DEX_BY[d]) s.mxp[d] = Math.max(s.mxp[d] || 0, Math.round(got[d]));
    s.mxpInit = 1;
  }

  /** Totals for the Mastery tab and achievements. */
  function totals(s = save()) {
    let levels = 0, mastered = 0, played = 0;
    for (const d in (s && s.mxp) || {}) {
      if (!G.DEX_BY[d]) continue;
      const l = level(d, s);
      if (s.mxp[d] > 0) played++;
      levels += l;
      if (l >= MAX) mastered++;
    }
    return { levels, mastered, played };
  }

  /** Your top Pokémon by Mastery: [[dex, level], ...]. */
  function top(n = 3, s = save()) {
    return Object.keys((s && s.mxp) || {}).filter(d => G.DEX_BY[d] && s.mxp[d] > 0)
      .sort((a, b) => s.mxp[b] - s.mxp[a]).slice(0, n).map(d => [+d, level(d, s)]);
  }

  return { NEED, MAX, need, DAILY, GROUP, xpOf, level, levelFor, progress, ribbon, badge, TIERS, track, titles, banners,
           award, backfill, totals, top, dailyReady, partsFor };
})();
