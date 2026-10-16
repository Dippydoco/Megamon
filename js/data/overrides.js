/* ============ overrides.js — TUS AJUSTES de stats (edita este archivo) ============
 * Se carga justo después de pokedex.js y modifica G.DEX sin tocar el archivo
 * generado. Así tus cambios no se pierden si algún día se vuelve a generar
 * pokedex.js, y se ve de un vistazo qué has tocado.
 *
 * Campos que se pueden cambiar de cada Pokémon:
 *   hp     vida máxima base             (normal: ~70-130)
 *   spd    velocidad de movimiento base (normal: ~80-130)
 *   atk    multiplicador de daño base   (normal: ~0.8-1.5)
 *   rarity rareza en el gacha 1-5       (tambien afecta a qué enemigos salen)
 *   bst    "fuerza total": decide qué enemigos aparecen en cada fase
 *   types  tipos, p. ej. ['fire', 'flying']
 *
 * Para probar: abre dev.html (carga cada script por separado, no hace falta
 * compilar), guarda este archivo y recarga la página.
 * Para el juego empaquetado (index.html): node tools/build.js --expose --sin-seo
 */

// 1) Ajuste GLOBAL: multiplica el stat de TODOS los Pokémon. 1 = sin cambios.
G.DEX_GLOBAL = { hp: 1, spd: 1, atk: 1 };

// 2) Ajustes por Pokémon, por número de Pokédex. Ejemplos (quita las // para usarlos):
G.DEX_OVERRIDES = {
  // 6:   { hp: 130, atk: 1.5 },               // Charizard más resistente y fuerte
  // 25:  { spd: 130 },                        // Pikachu más rápido
  // 150: { atk: 1.8, hp: 140, rarity: 5 },    // Mewtwo
};

// ---- Aplicar (no hace falta tocar nada de aquí hacia abajo) ----
(() => {
  const g = G.DEX_GLOBAL, ov = G.DEX_OVERRIDES;
  for (const p of G.DEX) {
    if (g.hp !== 1) p.hp = Math.round(p.hp * g.hp);
    if (g.spd !== 1) p.spd = Math.round(p.spd * g.spd);
    if (g.atk !== 1) p.atk = Math.round(p.atk * g.atk * 100) / 100;
    if (ov[p.dex]) Object.assign(p, ov[p.dex]);   // el ajuste propio manda sobre el global
  }
  for (const k of Object.keys(ov)) if (!G.DEX_BY[k]) console.warn('overrides.js: no existe el Pokémon nº ' + k);
})();
