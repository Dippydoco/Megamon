/* ============ items.js — held items (one per run) ============
 * Found in chests (sometimes in normal ones, often in locked
 * ones) and dropped by bosses. You can only hold ONE; if you find
 * another, you choose which to keep. They last as long as the run.
 *
 *   on(pl)   you put it on (what it does while you hold it)
 *   off(pl)  you take it off (undoes what on did)
 * Those that react to something (a fatal hit, damage dealt...) are checked by
 * the player with pl.hasItem(id).
 *
 * Optional fields:
 *   ask      it has a drawback, so it is never put on by itself: even with empty hands you choose to take it
 *   noTower  not found in the Battle Tower (it needs experience, perks or rifts)
 *   hidden   never found: another item turns into it (Rusted Sword -> Crowned Sword)
 *   info(pl) short progress text for the HUD's item box ("+12%", "40/108", "1/2")
 *   note(pl) a sentence about your progress, added to the description on the HUD tip and the keep / switch cards
 */
G.Items = (() => {
  const LIST = [
    { id: 'leftovers', name: 'Leftovers', desc: 'You recover 1.5% of your HP per second.',
      on: p => { p.regenFlat += p.maxHp * 0.015; p._itemRegen = p.maxHp * 0.015; },
      off: p => { p.regenFlat -= p._itemRegen || 0; } },
    { id: 'choiceband', name: 'Choice Band', desc: '+40% damage, but you can\'t switch moves.',
      on: p => { p.atkMul *= 1.4; }, off: p => { p.atkMul /= 1.4; } },
    { id: 'quickclaw', name: 'Quick Claw', desc: '-20% cooldown on all your moves.',
      on: p => { p.cdMul *= 0.8; }, off: p => { p.cdMul /= 0.8; } },
    { id: 'focussash', name: 'Focus Sash', desc: 'A hit that would knock you out leaves you at 1 HP (every 60 s).',
      on: () => {}, off: () => {} },
    { id: 'shellbell', name: 'Shell Bell', desc: 'You heal for 4% of the damage you deal (up to 4 HP per second).',
      on: () => {}, off: () => {} },
    { id: 'amuletcoin', name: 'Amulet Coin', desc: '+50% PokéCoins at the end of the run.',
      on: p => { p.coinMul *= 1.5; }, off: p => { p.coinMul /= 1.5; } },
    { id: 'luckyegg', name: 'Lucky Egg', desc: '+30% experience.',
      on: p => { p.xpMul *= 1.3; }, off: p => { p.xpMul /= 1.3; } },
    // Life Orb (18-10-2026): it used to cost 1% of your max HP on every attack, which nobody wanted.
    // Now the price is fixed and up front: 30% less max HP while you hold it (Vigor picks are cut too,
    // in Player.addMaxHp). Taking it off gives that max HP back, but doesn't heal you.
    { id: 'lifeorb', name: 'Life Orb', desc: '+50% damage, but 30% less max HP.', ask: true,
      on: p => { p.atkMul *= 1.5; const cut = Math.round(p.maxHp * 0.3); p.maxHp -= cut; p.hp = Math.min(p.hp, p.maxHp); p._orbCut = cut; },
      off: p => { p.atkMul /= 1.5; p.maxHp += p._orbCut || 0; p._orbCut = 0; } },
    { id: 'choicescarf', name: 'Choice Scarf', desc: '+35% speed.',
      on: p => { p.spdMul *= 1.35; }, off: p => { p.spdMul /= 1.35; } },
    { id: 'rockyhelmet', name: 'Rocky Helmet', desc: 'Foes that hit you in melee take damage.',
      on: () => {}, off: () => {} },
    { id: 'assaultvest', name: 'Assault Vest', desc: '+20% damage reduction.',
      on: p => { p.dmgReduce += 0.2; }, off: p => { p.dmgReduce -= 0.2; } },
    // ---- 17-10-2026 (effects in combat.js, player.js and interact.js) ----
    { id: 'scopelens', name: 'Scope Lens', desc: '+20% critical hit chance.', on: () => {}, off: () => {} },
    { id: 'flameorb', name: 'Flame Orb', desc: 'Your hits have a 30% chance to burn the enemy.', on: () => {}, off: () => {} },
    { id: 'toxicorb', name: 'Toxic Orb', desc: 'Your hits have a 30% chance to poison the enemy.', on: () => {}, off: () => {} },
    { id: 'kingsrock', name: "King's Rock", desc: 'Your hits have a 6% chance to freeze the enemy for 1.2 s (not bosses).', on: () => {}, off: () => {} },
    { id: 'bindingband', name: 'Binding Band', desc: 'Your hits slow enemies by 25% for 1.5 s.', on: () => {}, off: () => {} },
    { id: 'brightpowder', name: 'Bright Powder', desc: '10% chance to dodge any hit.', on: () => {}, off: () => {} },
    { id: 'heavyboots', name: 'Heavy-Duty Boots', desc: 'You ignore lava damage, the slowing and sliding of water, mud and ice, and all ground traps (poison, sticky and explosive).', on: () => {}, off: () => {} },
    { id: 'lightclay', name: 'Light Clay', desc: 'Shrine powers (Fury, Thunderbolt, Magnet, Haste, Guardian) last 50% longer.', on: () => {}, off: () => {} },
    // ---- 15-11-2026: items you invest in (progress is counted in tick(), below) ----
    // Macho Brace: every level gained while holding it is +1% damage for the rest of the run (pl.braceLv, read by
    // Player.dmgMul), up to BRACE_MAX. The bonus stays when you swap the item out; only the slowdown goes.
    { id: 'machobrace', name: 'Macho Brace', ask: true, noTower: true,
      desc: '-15% movement speed. Each level you gain while holding it gives +1% damage for the rest of the run (up to +30%), kept even after you swap it out.',
      on: p => { p.spdMul *= 0.85; p._braceAt = p.level; }, off: p => { p.spdMul /= 0.85; },
      info: p => '+' + (p.braceLv || 0) + '%',
      note: p => (p.braceLv || 0) >= 30 ? 'Fully trained: +30% damage. Nothing more to gain from it.' : 'Trained so far: +' + (p.braceLv || 0) + '% damage.' },
    // Odd Keystone: knock out KEY_FIRST foes while holding it for +1 level in a random perk you hold; every reward
    // doubles the next requirement (108, 216, 432...). Progress (pl.keyN) and the count of rewards (pl.keyWon) stay
    // on the player, so putting it down and finding it again does not start over.
    { id: 'oddkeystone', name: 'Odd Keystone', noTower: true,
      desc: 'Knock out 108 foes while holding it to gain +1 level in a random perk you hold. Each reward doubles the number needed for the next.',
      on: p => { p._keyAt = p.kills; }, off: () => {},
      info: p => Math.floor(p.keyN || 0) + '/' + keyNeed(p),
      note: p => 'Sealed: ' + Math.floor(p.keyN || 0) + ' / ' + keyNeed(p) + ' foes' + (p.keyWon ? ' · ' + p.keyWon + ' reward' + (p.keyWon > 1 ? 's' : '') + ' so far.' : '.') },
    // Rusted Sword: a quest. It weakens you until you win SWORD_RIFTS rifts while holding it (rift.js -> riftWon);
    // then it becomes the Crowned Sword. Rifts won are kept on the player (pl.swordWins).
    { id: 'rustedsword', name: 'Rusted Sword', ask: true, noTower: true,
      desc: '-15% damage. Win 2 rifts while holding it and it is reforged into the Crowned Sword: +40% damage.',
      on: p => { p.atkMul *= 0.85; }, off: p => { p.atkMul /= 0.85; },
      info: p => Math.min(2, p.swordWins || 0) + '/2',
      note: p => 'Rifts won with it: ' + Math.min(2, p.swordWins || 0) + ' / 2.' },
    { id: 'crownedsword', name: 'Crowned Sword', hidden: true, desc: '+40% damage. Reforged from the Rusted Sword.',
      on: p => { p.atkMul *= 1.4; }, off: p => { p.atkMul /= 1.4; } }
  ];
  const BRACE_MAX = 30, KEY_FIRST = 108, SWORD_RIFTS = 2;
  /** Odd Keystone: foes needed for the next reward (doubles with every reward already won). */
  function keyNeed(p) { return KEY_FIRST * Math.pow(2, Math.min(20, (p && p.keyWon) || 0)); }
  const BY = {};
  for (const it of LIST) BY[it.id] = it;

  /** One at random, different from the one you already hold. */
  // (Battle Tower: no experience there, so no Lucky Egg.)
  // (Also out of the tower: the items that need experience, perks or rifts. Never found: the Crowned Sword, and
  // the Rusted Sword again once you hold the Crowned one.)
  const usable = (i, except) => !i.hidden && !((i.id === 'luckyegg' || i.noTower) && G.Tower && G.Tower.active)
    && !(i.id === 'rustedsword' && except === 'crownedsword');
  function roll(except) {
    const pool = LIST.filter(i => i.id !== except && usable(i, except));
    return G.U.pick(pool).id;
  }

  /** n different items (none of them `except`), for the Armoury choice. */
  function rollMany(n, except) {
    const pool = LIST.filter(i => i.id !== except && usable(i, except)).map(i => i.id);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool.slice(0, n);
  }

  const pop = (pl, txt, col) => { G.FX.dmgText(pl.x, pl.y - pl.bodyH - 10, txt, col, true); G.FX.ring(pl.x, pl.y, 8, 90, col, 0.7, 5); };

  /**
   * Every frame, for your own player (game.js): counts the levels and knockouts gained while holding an item.
   * It reads pl.level and pl.kills rather than hooking the level-up, because a co-op guest gets both from the host.
   */
  function tick(pl) {
    if (!pl || !pl.item) return;
    if (pl.item === 'machobrace') {
      const gain = pl.level - (pl._braceAt == null ? pl.level : pl._braceAt);
      pl._braceAt = pl.level;
      if (gain > 0 && (pl.braceLv || 0) < BRACE_MAX) {
        pl.braceLv = Math.min(BRACE_MAX, (pl.braceLv || 0) + gain);
        pop(pl, pl.braceLv >= BRACE_MAX ? 'Fully trained! +' + BRACE_MAX + '%' : 'Trained! +' + pl.braceLv + '%', '#ffb35c');
      }
    } else if (pl.item === 'oddkeystone') {
      const gain = pl.kills - (pl._keyAt == null ? pl.kills : pl._keyAt);
      pl._keyAt = pl.kills;
      if (gain > 0) pl.keyN = (pl.keyN || 0) + gain;
      // One reward per frame at most (what is left over carries on to the next count).
      const need = keyNeed(pl);
      if (pl.keyN < need) return;
      pl.keyN -= need;
      pl.keyWon = (pl.keyWon || 0) + 1;
      const perk = pl.dead ? null : G.LevelUp.bonusPerk(pl);
      if (perk) { pop(pl, 'Keystone: ' + perk.title + ' +1', '#c9a6ff'); G.Spawner.say('Odd Keystone: ' + perk.title + ' +1 (next: ' + keyNeed(pl) + ' foes)', 3, true); }
      else { pl.heal(pl.maxHp * 0.3); pop(pl, 'Keystone: healed', '#c9a6ff'); G.Spawner.say('Odd Keystone: no perk to raise, so it healed you', 3, true); }
      G.Audio.sfx('confirm');
    }
  }

  /** You won a rift (rift.js, on every player's own computer): the Rusted Sword's quest. */
  function riftWon(pl) {
    if (!pl || pl.item !== 'rustedsword') return;
    pl.swordWins = (pl.swordWins || 0) + 1;
    if (pl.swordWins < SWORD_RIFTS) { pop(pl, 'Rusted Sword ' + pl.swordWins + '/' + SWORD_RIFTS, '#c9d2de'); return; }
    pl.equip('crownedsword');
    pop(pl, 'Crowned Sword!', '#ffd23f');
    G.Spawner.say('The Rusted Sword was reforged into the Crowned Sword!', 3.4, true);
    G.Audio.sfx('confirm');
  }

  /** An item's description plus your progress with it (the HUD tip and the keep / switch cards). */
  function descFor(id, pl) {
    const it = BY[id];
    return it ? it.desc + (it.note && pl ? ' ' + it.note(pl) : '') : '';
  }

  return { LIST, BY, roll, rollMany, tick, riftWon, descFor };
})();
