/* ============ overrides.js — YOUR stat TWEAKS (edit this file) ============
 * Loaded right after pokedex.js and modifies G.DEX without touching the
 * generated file. That way your changes aren't lost if pokedex.js is ever
 * regenerated, and you can see at a glance what you've changed.
 *
 * Fields that can be changed for each Pokémon:
 *   hp     base max health          (normal: ~70-130)
 *   spd    base movement speed      (normal: ~80-130)
 *   atk    Attack: damage multiplier for physical moves  (normal: ~0.8-1.5)
 *   def    Defense: 70 is neutral, higher takes less damage (130: -15%), lower a little more (30: +4%)
 *   spa    Sp. Atk: damage multiplier for special moves  (normal: ~0.8-1.5)
 *   rarity gacha rarity 1-5        (also affects which enemies appear)
 *   bst    "total strength": decides which enemies appear in each phase
 *   types  types, e.g. ['fire', 'flying']
 *
 * To test: open dev.html (it loads each script separately, no need to
 * build), save this file and reload the page.
 * For the packaged game (index.html): node tools/build.js --expose --no-seo
 */

// 1) GLOBAL tweak: multiplies the stat of ALL Pokémon. 1 = no change.
G.DEX_GLOBAL = { hp: 1, spd: 1, atk: 1, spa: 1 };

// 2) Per-Pokémon tweaks, by Pokédex number. Examples (remove the // to use them):
G.DEX_OVERRIDES = {
  // 6:   { hp: 130, spa: 1.5 },               // tougher Charizard with stronger special moves
  // 25:  { spd: 130 },                        // faster Pikachu
  // 150: { spa: 1.8, hp: 140, rarity: 5 },    // Mewtwo
  557: { hp: 120, spd: 108, atk: 1.35 },       // Dwebble (19-10-2026): sturdier, quicker and hits harder, with its signature move Beat
};

// 3) Lower rarities are stronger, so common and unevolved Pokémon stay viable (19-10-2026):
//    a bonus to HP, Attack and Sp. Atk by gacha rarity (on top of the global tweak, before the per-Pokémon one)...
G.RARITY_BONUS = { 1: 0.15, 2: 0.10, 3: 0.05, 4: 0, 5: 0 };
//    Defense gets a bigger one: rarer Pokémon have much more of it, and it would undo the rest of the bonus.
G.RARITY_DEF_BONUS = { 1: 0.60, 2: 0.38, 3: 0.16, 4: 0, 5: 0 };
//    ...and more damage and max HP with every level in a run (on top of the cards), so they catch up later on.
G.RARITY_GROWTH = { 1: 0.015, 2: 0.010, 3: 0.005, 4: 0, 5: 0 };
G.RARITY_GROWTH_CAP = 30;   // it stops at this level (1★: +43.5% at most), so they don't outgrow everything in long runs

// ---- Apply (nothing needs changing from here down) ----
(() => {
  const g = G.DEX_GLOBAL, ov = G.DEX_OVERRIDES;
  for (const p of G.DEX) {
    if (g.hp !== 1) p.hp = Math.round(p.hp * g.hp);
    if (g.spd !== 1) p.spd = Math.round(p.spd * g.spd);
    if (g.atk !== 1) p.atk = Math.round(p.atk * g.atk * 100) / 100;
    if (g.spa !== 1) p.spa = Math.round(p.spa * g.spa * 100) / 100;
    const rb = G.RARITY_BONUS[p.rarity] || 0;
    const db = G.RARITY_DEF_BONUS[p.rarity] || 0;
    if (db && p.def != null) p.def = Math.round(p.def * (1 + db));
    if (rb) {
      p.hp = Math.round(p.hp * (1 + rb));
      p.atk = Math.round(p.atk * (1 + rb) * 100) / 100;
      p.spa = Math.round(p.spa * (1 + rb) * 100) / 100;
    }
    if (ov[p.dex]) Object.assign(p, ov[p.dex]);   // the per-Pokémon tweak takes priority over the global one
    // Physical or special attacker: 5% or more ahead in one of them (about 18 base-stat points); otherwise mixed (equally good with both).
    p.lean = p.atk >= p.spa * 1.05 ? 'physical' : p.spa >= p.atk * 1.05 ? 'special' : 'mixed';
  }
  for (const k of Object.keys(ov)) if (!G.DEX_BY[k]) console.warn('overrides.js: there is no Pokémon no. ' + k);
})();
