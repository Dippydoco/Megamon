/* ============ charms.js — Shiny Charms, one per region ============
 * Own every Pokémon of a region (every Pokémon of that generation in the Pokédex) and you get its Shiny
 * Charm: shiny odds are doubled for Pokémon from that region wherever a shiny can turn up:
 *   - wild enemies in runs (systems/spawner.js rollShiny)
 *   - rift legendaries (systems/rift.js)
 *   - gacha pulls (systems/gacha.js pull)
 * Not in Gacha Battles (ui/minigames.js): there everyone has the same odds.
 * In group runs only the host spawns enemies and rifts, so the host's charms count there.
 * Having a charm needs nothing stored: it's worked out from save.owned. save.charms (gen -> date) only
 * remembers which ones you've already been told about (check(), run from DB.commit).
 */
G.Charms = (() => {
  const MULT = 2;
  let cache = null, cacheSave = null, cacheN = -1;

  /** The generations whose Pokédex is complete in `save` (cached: owned only ever grows). */
  function list(save = G.DB.save) {
    if (!save || !save.owned) return [];
    const n = Object.keys(save.owned).length;
    if (cache && cacheSave === save && cacheN === n) return cache;
    const all = {}, have = {};
    for (const p of G.DEX) {
      all[p.gen] = (all[p.gen] || 0) + 1;
      if (save.owned[p.dex]) have[p.gen] = (have[p.gen] || 0) + 1;
    }
    cache = Object.keys(all).map(Number).filter(g => have[g] === all[g]).sort((a, b) => a - b);
    cacheSave = save; cacheN = n;
    return cache;
  }
  const has = (gen, save) => list(save).includes(gen);
  /** Shiny odds multiplier for one Pokémon (by its region). `gens` overrides your own charms (Gacha Battle). */
  function mult(dex, gens) {
    const p = G.DEX_BY[dex];
    if (!p) return 1;
    return (gens || list()).includes(p.gen) ? MULT : 1;
  }
  const regionName = gen => ((G.Gacha.BANNERS[gen - 1] || {}).name) || 'Gen ' + gen;

  /** New charms since last time: remembered in the save and announced once. */
  function check(save) {
    if (!save || !save.owned) return;
    save.charms = save.charms && typeof save.charms === 'object' ? save.charms : {};
    const fresh = list(save).filter(g => !save.charms[g]);
    if (!fresh.length) return;
    for (const g of fresh) save.charms[g] = Date.now();
    const names = fresh.map(regionName).join(', ');
    setTimeout(() => {
      if (G.UI && G.UI.toast) G.UI.toast('Shiny Charm earned: ' + names + '! Shiny odds ×' + MULT + ' for ' + (fresh.length > 1 ? 'those regions' : 'that region') + '.', 5000);
      if (G.Audio) G.Audio.sfx('shinyGet');
    }, 300);
  }

  /**
   * Shining Badges (21-11-2026): the shiny of every Pokémon of a region that has a shiny sprite.
   * → { all: gen -> how many count, have: gen -> how many you own, done: [gens], left: gen -> [dex without a shiny
   * sprite] }. Cached like list(): shinies only ever grow. Earning one is an achievement (data/achievements.js
   * 'shine<gen>'), which also gives its title; this only counts, for the screens and the public profile.
   */
  let shCache = null, shSave = null, shN = -1;
  function shining(save = G.DB.save) {
    const n = save && save.shiny ? Object.keys(save.shiny).length : 0;
    if (shCache && shSave === save && shN === n) return shCache;
    const all = {}, have = {}, left = {};
    for (const p of G.DEX) {
      if (!G.Sprites.hasShiny(p.dex)) { (left[p.gen] = left[p.gen] || []).push(p.dex); continue; }
      all[p.gen] = (all[p.gen] || 0) + 1;
      if (save && save.shiny && save.shiny[p.dex]) have[p.gen] = (have[p.gen] || 0) + 1;
    }
    const done = Object.keys(all).map(Number).filter(g => have[g] === all[g]).sort((a, b) => a - b);
    shCache = { all, have, done, left }; shSave = save; shN = n;
    return shCache;
  }
  /** When the region's Shining Badge was earned (its achievement), or 0. */
  const shiningAt = (gen, save = G.DB.save) => (save && save.ach && save.ach['shine' + gen]) || 0;

  return { MULT, list, has, mult, check, regionName, shining, shiningAt };
})();
