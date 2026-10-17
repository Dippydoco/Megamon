/* ============ items.js — objetos equipables (uno por run) ============
 * Se encuentran en los cofres (a veces en los normales, a menudo en los de
 * candado) y los sueltan los jefes. Sólo puedes llevar UNO; si encuentras
 * otro, eliges con cuál quedarte. Duran lo que dura la run.
 *
 *   on(pl)   se lo pones (lo que hace mientras lo llevas)
 *   off(pl)  se lo quitas (deshace lo de on)
 * Los que reaccionan a algo (golpe mortal, daño hecho...) los mira el
 * jugador con pl.hasItem(id).
 */
G.Items = (() => {
  const LIST = [
    { id: 'leftovers', name: 'Restos', desc: 'Recuperas un 1,5% de tu vida por segundo.',
      on: p => { p.regenFlat += p.maxHp * 0.015; p._itemRegen = p.maxHp * 0.015; },
      off: p => { p.regenFlat -= p._itemRegen || 0; } },
    { id: 'choiceband', name: 'Cinta Elección', desc: '+40% de daño, pero no puedes cambiar de movimiento.',
      on: p => { p.atkMul *= 1.4; }, off: p => { p.atkMul /= 1.4; } },
    { id: 'quickclaw', name: 'Garra Rápida', desc: '-20% de recarga en todos tus movimientos.',
      on: p => { p.cdMul *= 0.8; }, off: p => { p.cdMul /= 0.8; } },
    { id: 'focussash', name: 'Banda Focus', desc: 'Un golpe que te dejaría KO te deja con 1 de vida (cada 60 s).',
      on: () => {}, off: () => {} },
    { id: 'shellbell', name: 'Cascabel Concha', desc: 'Recuperas vida con el daño que haces.',
      on: () => {}, off: () => {} },
    { id: 'amuletcoin', name: 'Moneda Amuleto', desc: '+50% de Pokémonedas al acabar la run.',
      on: p => { p.coinMul *= 1.5; }, off: p => { p.coinMul /= 1.5; } },
    { id: 'luckyegg', name: 'Huevo Suerte', desc: '+30% de experiencia.',
      on: p => { p.xpMul *= 1.3; }, off: p => { p.xpMul /= 1.3; } },
    { id: 'lifeorb', name: 'Vidasfera', desc: '+50% de daño, pero cada ataque te quita un poco de vida.',
      on: p => { p.atkMul *= 1.5; }, off: p => { p.atkMul /= 1.5; } },
    { id: 'choicescarf', name: 'Pañuelo Elección', desc: '+35% de velocidad.',
      on: p => { p.spdMul *= 1.35; }, off: p => { p.spdMul /= 1.35; } },
    { id: 'rockyhelmet', name: 'Casco Dentado', desc: 'Los que te golpean cuerpo a cuerpo reciben daño.',
      on: () => {}, off: () => {} },
    { id: 'assaultvest', name: 'Chaleco Asalto', desc: '+20% de reducción de daño recibido.',
      on: p => { p.dmgReduce += 0.2; }, off: p => { p.dmgReduce -= 0.2; } },
    // ---- 17-10-2026 (efectos en combat.js, player.js e interact.js) ----
    { id: 'scopelens', name: 'Scope Lens', desc: '+20% critical hit chance.', on: () => {}, off: () => {} },
    { id: 'flameorb', name: 'Flame Orb', desc: 'Your hits have a 30% chance to burn the enemy.', on: () => {}, off: () => {} },
    { id: 'toxicorb', name: 'Toxic Orb', desc: 'Your hits have a 30% chance to poison the enemy.', on: () => {}, off: () => {} },
    { id: 'kingsrock', name: "King's Rock", desc: 'Your hits have a 6% chance to freeze the enemy for 1.2 s (not bosses).', on: () => {}, off: () => {} },
    { id: 'bindingband', name: 'Binding Band', desc: 'Your hits slow enemies by 25% for 1.5 s.', on: () => {}, off: () => {} },
    { id: 'brightpowder', name: 'Bright Powder', desc: '10% chance to dodge any hit.', on: () => {}, off: () => {} },
    { id: 'heavyboots', name: 'Heavy-Duty Boots', desc: 'You ignore lava damage, the slowing and sliding of water, mud and ice, and all ground traps (poison, sticky and explosive).', on: () => {}, off: () => {} },
    { id: 'lightclay', name: 'Light Clay', desc: 'Shrine powers (Fury, Thunderbolt, Magnet, Haste, Guardian) last 50% longer.', on: () => {}, off: () => {} }
  ];
  const BY = {};
  for (const it of LIST) BY[it.id] = it;

  /** Uno al azar, distinto del que ya llevas. */
  function roll(except) {
    const pool = LIST.filter(i => i.id !== except);
    return G.U.pick(pool).id;
  }

  return { LIST, BY, roll };
})();
