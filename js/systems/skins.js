/* ============ skins.js — alternate forms worn as cosmetic skins ============
 * The catalogue and routes are in data/skins.js (G.SkinData); the sprites are drawn by G.Sprites like any
 * Pokémon, using the form's sprite id (100000 + dex*100 + form). A skin only changes the animation sheet: your
 * Pokémon's stats, types, moves, ability, hitbox and shadow stay the base Pokémon's.
 *
 * Save:  skins   form id -> date unlocked (merged as a union across devices)
 *        skinOn  dex -> worn form id (0 / missing = default)
 *        fc      challenge counters: sv {type: kills as Silvally} · wx {sun, rain, snow: seconds as Castform}
 *                · cs (seconds of sun as Cherrim) · dg (Disguise blocks as Mimikyu) · th {dex: rift wins}
 * Shinies: if you own a Pokémon's shiny, every skin you unlock for it also comes in shiny (when drawn).
 */
G.Skins = (() => {
  const D = () => G.SkinData;
  const S = () => G.DB.save;
  const now = () => Date.now();

  const has = (id, s = S()) => !!(s && s.skins && s.skins[id]);
  /** How many skins you have (`noCosplay`: not counting Cosplay Pikachu, for its own challenge). */
  function count(s = S(), noCosplay = false) {
    let n = 0;
    for (const id in (s && s.skins) || {}) {
      const f = D().BY[id];
      if (f && !(noCosplay && f.dex === 25 && f.form === 'Cosplay')) n++;
    }
    return n;
  }
  /** Can you wear it now? (unlocked, and you own or have on loan the base Pokémon) */
  const wearable = (id, s = S()) => { const f = D().BY[id]; return !!(f && has(id, s) && G.DB.canUse(f.dex)); };

  /** The worn skin of a Pokémon (0 = default). */
  function worn(dex, s = S()) {
    const id = s && s.skinOn && s.skinOn[dex];
    return id && D().BY[id] && D().BY[id].dex === +dex && has(id, s) ? +id : 0;
  }
  /** The sprite id to draw for `dex` wearing skin `sk` (any player's: checked against the catalogue). */
  function sprite(dex, sk) {
    const f = sk && D().BY[sk];
    return f && f.dex === +dex && G.SPRITE_META[f.id] ? f.id : +dex;
  }
  /** Your own Pokémon's sprite id (with the skin you wear on it). */
  const mine = dex => sprite(dex, worn(dex));

  function wear(dex, id) {
    const s = S();
    if (!s) return;
    s.skinOn = s.skinOn || {};
    if (!id) delete s.skinOn[dex];
    else if (wearable(id, s) && D().BY[id].dex === +dex) s.skinOn[dex] = +id;
    G.DB.commit();
    if (s.partner === +dex && G.Social && G.Social.refreshMember) G.Social.refreshMember();
  }

  // ---------------- unlocking ----------------

  function grant(id, quiet) {
    const s = S(), f = D().BY[id];
    if (!s || !f || has(id, s)) return false;
    s.skins = s.skins || {};
    s.skins[id] = now();
    if (!quiet && G.Progress.notify) G.Progress.notify('New skin: ' + f.name + '!', 'Wear it from ' + G.DEX_BY[f.dex].name + '\'s page', { dex: f.id, tier: 3 });
    return true;
  }

  /** Is this form's condition met right now (for the routes checked here: mega, mastery, counted challenges)? */
  function ready(f, s = S()) {
    const r = f.route;
    if (r.kind === 'mega') return G.Mastery.level(f.dex, s) >= G.Mastery.MAX && !!(s.arceus && s.arceus[f.dex]);
    if (r.kind === 'mastery') return G.Mastery.level(f.dex, s) >= r.level;
    if (r.kind === 'challenge' && r.ch.goal) return r.ch.val(s) >= r.ch.goal;
    return false;
  }

  /** Unlocks every skin whose condition is met. `notify`: tell the player (otherwise silent, e.g. on load). */
  function check(notify = true) {
    const s = S();
    if (!s) return 0;
    let n = 0;
    for (const f of D().LIST) if (!has(f.id, s) && ready(f, s)) { grant(f.id, !notify); n++; }
    if (n) G.Progress.checkAch();
    return n;
  }

  /** Progress text for a locked skin ("Mastery 3 / 5", "120 / 300"...). */
  function progressText(f, s = S()) {
    const r = f.route;
    if (r.kind === 'mega') {
      const lv = G.Mastery.level(f.dex, s), star = !!(s.arceus && s.arceus[f.dex]);
      return `Mastery ${lv} / 10 · ${star ? 'gold star ✓' : 'reach Arceus with it'}`;
    }
    if (r.kind === 'mastery') return `Mastery ${G.Mastery.level(f.dex, s)} / ${r.level}`;
    if (r.kind === 'challenge' && r.ch.goal) {
      const v = Math.min(r.ch.goal, r.ch.val(s));
      return r.ch.unit === 's' ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')} / ${r.ch.goal / 60}:00` : `${v} / ${r.ch.goal}`;
    }
    if (r.kind === 'shop') return 'Smeargle\'s Studio · ' + r.price.toLocaleString('en') + ' PokéCoins';
    return '';
  }
  /** How a skin is unlocked, in one line. */
  function howText(f) {
    const r = f.route;
    if (r.kind === 'mega') return 'Reach Mastery 10 and reach Arceus with ' + G.DEX_BY[f.dex].name;
    if (r.kind === 'mastery') return 'Reach Mastery ' + r.level + ' with ' + G.DEX_BY[f.dex].name;
    if (r.kind === 'challenge') return r.ch.text;
    return 'Buy it at Smeargle\'s Studio (Shop)';
  }

  // ---------------- Smeargle's Studio ----------------

  const SPOT_N = 4, SPOT_OFF = 0.3;
  function seedRng(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const dayKey = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  /** Today's Daily Spotlight: up to 4 shop forms of Pokémon you own and don't have yet, 30% off. */
  function spotlight(s = S()) {
    if (!s) return [];
    const pool = D().LIST.filter(f => f.route.kind === 'shop' && G.DB.owns(f.dex) && !has(f.id, s));
    const r = seedRng(dayKey() + ':' + (s.created || 0));
    const out = [];
    while (out.length < SPOT_N && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0].id);
    return out;
  }
  function priceOf(id, s = S()) {
    const f = D().BY[id];
    if (!f || f.route.kind !== 'shop') return 0;
    return spotlight(s).includes(f.id) ? Math.round(f.route.price * (1 - SPOT_OFF) / 10) * 10 : f.route.price;
  }
  /** Buys a shop skin. Returns '' or the reason it can't. */
  function buy(id) {
    const s = S(), f = D().BY[id];
    if (!s || !f || f.route.kind !== 'shop') return 'Not for sale';
    if (has(id, s)) return 'You already have it';
    if (!G.DB.owns(f.dex)) return 'You need ' + G.DEX_BY[f.dex].name + ' first';
    const p = priceOf(id, s);
    if (s.coins < p) return 'Not enough PokéCoins';
    s.coins -= p;
    s.skins = s.skins || {};
    s.skins[id] = now();
    G.DB.commit(true);
    G.Progress.checkAch();
    check(true);                                    // Cosplay Pikachu counts skins
    return '';
  }

  // ---------------- challenge events ----------------

  const fcOf = s => (s.fc = s.fc || {});
  const me = () => G.Game && G.Game.player;
  const perkLv = (pl, id) => (pl && pl.statsTaken && pl.statsTaken[id]) || 0;
  function formId(dex, form) { const f = (D().OF[dex] || []).find(x => x.form === form); return f ? f.id : 0; }

  /** An enemy fell (progress.js kill, also teammates' kills): Silvally's type counts, rift legendaries. */
  function onKill(types, legend) {
    const s = S(), pl = me();
    if (!s || !pl) return;
    if (pl.dex === 773 && types && types.length) {
      const sv = fcOf(s).sv = fcOf(s).sv || {};
      for (const t of types) sv[t] = (sv[t] || 0) + 1;
    }
    if (!legend) return;
    if ((legend === 483 || legend === 484 || legend === 487) && perkLv(pl, 'roar') >= 10) grant(formId(legend, 'Origin'));
    if (legend === 645 || legend === 905) { const th = fcOf(s).th = fcOf(s).th || {}; th[legend] = (th[legend] || 0) + 1; }
    if (pl.dex === 646 && legend === 644) grant(formId(646, 'Black'));
    if (pl.dex === 646 && legend === 643) grant(formId(646, 'White'));
    check(true);
  }

  /** Every frame of a run (game.js update): weather time for Castform and Cherrim. */
  let chkT = 0;
  function tick(dt, pl) {
    if (!pl || pl.dead || (pl.dex !== 351 && pl.dex !== 421)) return;
    const w = G.Weather.current, s = S();
    if (!w || !s) return;
    const f = fcOf(s);
    if (pl.dex === 351 && (w.kind === 'sun' || w.kind === 'rain' || w.kind === 'snow')) { f.wx = f.wx || {}; f.wx[w.kind] = (f.wx[w.kind] || 0) + dt; }
    if (pl.dex === 421 && w.kind === 'sun') f.cs = (f.cs || 0) + dt;
    chkT -= dt;
    if (chkT <= 0) { chkT = 5; check(true); }
  }

  /** Mimikyu's Disguise blocked a hit (systems/abilrun.js). */
  function disguise(pl) {
    const s = S();
    if (!s || !pl || pl.remote || pl.dex !== 778) return;
    fcOf(s).dg = (fcOf(s).dg || 0) + 1;
    check(true);
  }

  /** An Unown Sequence floor was cleared (systems/tower.js): a letter you don't have yet. */
  function unown() {
    const s = S();
    if (!s) return;
    const left = (D().OF[201] || []).filter(f => !has(f.id, s));
    if (left.length) grant(left[Math.floor(Math.random() * left.length)].id);
    G.Progress.checkAch();
  }

  /** The run ended (game.js endRun): seasons, Deoxys's perks, Pikachu Libre. */
  function runEnd(pl, time) {
    const s = S();
    if (!s || !pl || time < 60) return;
    const m = new Date().getMonth();                              // 0 = January
    const season = m >= 5 && m <= 7 ? 'Summer' : m >= 8 && m <= 10 ? 'Autumn' : m === 11 || m <= 1 ? 'Winter' : '';
    if (season && (pl.dex === 585 || pl.dex === 586)) grant(formId(pl.dex, season));
    if (pl.dex === 386) {
      const by = G.LevelUp.BY;
      if (perkLv(pl, 'atk') >= by.atk.max) grant(formId(386, 'Attack'));
      if (perkLv(pl, 'def') >= by.def.max) grant(formId(386, 'Defense'));
      if (perkLv(pl, 'cd') >= by.cd.max) grant(formId(386, 'Speed'));
    }
    if (pl.dex === 25 && pl.kills >= 500) {
      const attacks = pl.moves.filter(mv => mv.cat);
      if (attacks.length && attacks.every(mv => mv.cat === 'physical')) grant(formId(25, 'Libre'));
    }
    check(true);
  }

  return { has, count, wearable, worn, sprite, mine, wear, grant, check, ready, progressText, howText,
           spotlight, priceOf, buy, SPOT_OFF, onKill, tick, disguise, unown, runEnd, formId };
})();
