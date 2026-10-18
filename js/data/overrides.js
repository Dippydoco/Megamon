/* ============ overrides.js — YOUR stat TWEAKS (edit this file) ============
 * Loaded right after pokedex.js and modifies G.DEX without touching the
 * generated file. That way your changes aren't lost if pokedex.js is ever
 * regenerated, and you can see at a glance what you've changed.
 *
 * Fields that can be changed for each Pokémon:
 *   hp     base max health          (normal: ~70-130)
 *   spd    base movement speed      (normal: ~80-130)
 *   atk    base damage multiplier   (normal: ~0.8-1.5)
 *   rarity gacha rarity 1-5        (also affects which enemies appear)
 *   bst    "total strength": decides which enemies appear in each phase
 *   types  types, e.g. ['fire', 'flying']
 *
 * To test: open dev.html (it loads each script separately, no need to
 * build), save this file and reload the page.
 * For the packaged game (index.html): node tools/build.js --expose --sin-seo
 */

// 1) GLOBAL tweak: multiplies the stat of ALL Pokémon. 1 = no change.
G.DEX_GLOBAL = { hp: 1, spd: 1, atk: 1 };

// 2) Per-Pokémon tweaks, by Pokédex number. Examples (remove the // to use them):
G.DEX_OVERRIDES = {
  // 6:   { hp: 130, atk: 1.5 },               // tougher and stronger Charizard
  // 25:  { spd: 130 },                        // faster Pikachu
  // 150: { atk: 1.8, hp: 140, rarity: 5 },    // Mewtwo
};

// ---- Apply (nothing needs changing from here down) ----
(() => {
  const g = G.DEX_GLOBAL, ov = G.DEX_OVERRIDES;
  for (const p of G.DEX) {
    if (g.hp !== 1) p.hp = Math.round(p.hp * g.hp);
    if (g.spd !== 1) p.spd = Math.round(p.spd * g.spd);
    if (g.atk !== 1) p.atk = Math.round(p.atk * g.atk * 100) / 100;
    if (ov[p.dex]) Object.assign(p, ov[p.dex]);   // the per-Pokémon tweak takes priority over the global one
  }
  for (const k of Object.keys(ov)) if (!G.DEX_BY[k]) console.warn('overrides.js: no existe el Pokémon nº ' + k);
})();
