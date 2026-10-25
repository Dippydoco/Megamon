/* ============ tower.js (data) — the Battle Tower's floors, Badges and BP shop ============
 *
 * 50 floors in 5 sections of 10 (systems/tower.js runs them):
 *   horde   defeat a quota of Pokémon in a closed arena (most floors)
 *   boss    every 5th floor: a strong Pokémon, some with their own script (systems/towerbosses.js)
 *   gate    every 10th floor: a legendary gatekeeper; beating it in a Climb saves that checkpoint for good
 *   final   50F: Rayquaza
 * Expedition (co-op) swaps the 3rd and 8th floor of each section for a co-op event floor when 2+ play:
 *   plates  Seal Plates: one plate per player, all held at once breaks the seal
 *   twins   Twin Bond: Plusle and Minun get back up unless both fall within a few seconds
 * Every other floor is the player's choice of two stairways at the landing before it (choices()), rolled from
 * KINDS by weight (systems/towerfloors.js runs them):
 *   objective  survival, bounty, relic, hold, escort: a new win condition in the round arena
 *   puzzle     lights, sequence: Climb only, few enemies until their soft timer runs out
 *   dungeon    gauntlet, dungeon: built maps; rare early, common late. 4F (Gauntlet) and 9F (Mystery Dungeon)
 *              always are one, to teach them.
 *
 * The numbers are placeholders (no balance pass yet). Difficulty follows a "floor clock": floor n plays like
 * minute (n - 1) * 0.6 of a survival run, so 50F sits near minute 30.
 */
G.TowerData = (() => {
  const FLOORS = 50, SECTION = 10;
  const FLOOR_SECS = 36;                  // survival seconds of difficulty per floor

  // Each section: its 5th-floor boss, its gatekeeper, the two arenas its horde floors use (floors 1-4, then 6-9)
  // and `wild`: the types its wild Pokémon come from (systems/tower.js themedBag). A horde floor spawns mostly
  // Pokémon of its arena's type, with a few from the rest of the section's list.
  const SECTIONS = [
    { name: 'Meadow Wing', boss: 289, bossArena: 'normal', script: 'slaking', gate: 244, gateScript: 'entei', gateArena: 'fire',     horde: ['normal', 'grass'],
      wild: ['normal', 'grass', 'bug', 'fairy'] },
    { name: 'Shadow Wing', boss: 94,  bossArena: 'ghost',  script: 'gengar',  gate: 245, gateScript: 'suicune', gateArena: 'water',    horde: ['ghost', 'dark'],
      wild: ['ghost', 'dark', 'poison', 'psychic'] },
    { name: 'Stone Wing',  boss: 248, bossArena: 'rock',   script: '',        gate: 243, gateScript: 'raikou', gateArena: 'electric', horde: ['rock', 'fighting'],
      wild: ['rock', 'fighting', 'ground'] },
    { name: 'Iron Wing',   boss: 376, bossArena: 'steel',  script: '',        gate: 383, gateScript: 'groudon', gateArena: 'ground',   horde: ['steel', 'electric'],
      wild: ['steel', 'electric', 'ground', 'fire'] },
    { name: 'Sky Wing',    boss: 445, bossArena: 'dragon', script: '',        gate: 384, gateArena: 'flying',   horde: ['dragon', 'flying'],
      wild: ['dragon', 'flying', 'ice'] }
  ];

  const sectionOf = n => Math.min(SECTIONS.length - 1, Math.floor((n - 1) / SECTION));
  /** Survival-equivalent second for floor n (drives enemy tiers, stats and XP). */
  const dTime = n => (n - 1) * FLOOR_SECS;

  // ---- floor kinds offered at the landings ----
  // name: shown on the stairway and the HUD · family: objective / puzzle / dungeon · w: weight per section (0-4)
  const KINDS = {
    horde:    { name: 'Horde',           family: 'fight',     w: [6, 6, 5, 5, 4] },
    survival: { name: 'Survival',        family: 'objective', w: [3, 3, 3, 3, 3] },
    bounty:   { name: 'Bounty',          family: 'objective', w: [3, 3, 3, 3, 3] },
    relic:    { name: 'Relic Hunt',      family: 'objective', w: [3, 3, 3, 3, 3] },
    hold:     { name: 'Hold the Ground', family: 'objective', w: [2, 2, 2, 2, 2] },
    escort:   { name: 'Escort',          family: 'objective', w: [2, 2, 2, 2, 2] },
    lights:   { name: 'Lights Out',      family: 'puzzle',    w: [2, 2, 2, 2, 2], climb: true },
    sequence: { name: 'Unown Sequence',  family: 'puzzle',    w: [2, 2, 2, 2, 2], climb: true },
    gauntlet: { name: 'Gauntlet',        family: 'dungeon',   w: [0, 1, 2, 3, 4] },
    dungeon:  { name: 'Mystery Dungeon', family: 'dungeon',   w: [0, 1, 2, 3, 4] }
  };
  const INTRO_FLOORS = { 4: 'gauntlet', 9: 'dungeon' };    // the first of each dungeon floor, always

  /** The kind floor n must be (bosses, co-op events, introductions), or null if it's the player's choice. */
  function fixedKind(n, coop) {
    const i = (n - 1) % SECTION + 1;
    if (n === FLOORS) return 'final';
    if (i === SECTION) return 'gate';
    if (i === 5) return 'boss';
    if (coop && i === 3) return 'plates';
    if (coop && i === 8) return 'twins';
    return INTRO_FLOORS[n] || null;
  }

  /** The stairways offered for floor n: its fixed kind, or two different kinds rolled by weight. */
  function choices(n, coop, mode, first = false) {
    const fixed = fixedKind(n, coop);
    if (fixed) return [fixed];
    if (first) return ['horde'];                             // a run's first floor (through the hall's door)
    const sec = sectionOf(n), pool = [];
    for (const k in KINDS) {
      const K = KINDS[k];
      if (K.climb && mode !== 'climb') continue;            // puzzles: Climb only for now
      for (let i = 0; i < K.w[sec]; i++) pool.push(k);
    }
    const a = pool[Math.floor(Math.random() * pool.length)];
    const rest = pool.filter(k => k !== a);
    return [a, rest[Math.floor(Math.random() * rest.length)]];
  }

  /** The plan for floor n. `coop` = 2+ players in an Expedition (event floors); `kind` = the stairway taken. */
  function floor(n, coop = false, kind = null) {
    const S = SECTIONS[sectionOf(n)], i = (n - 1) % SECTION + 1;
    const base = { n, section: sectionOf(n), t: dTime(n) };
    kind = fixedKind(n, coop) || kind || 'horde';
    if (kind === 'final') return Object.assign(base, { kind, dex: 384, arena: 'flying', r: 15, script: 'rayquaza', limit: 240 });
    if (kind === 'gate') return Object.assign(base, { kind, dex: S.gate, arena: S.gateArena, r: 13, limit: 180, script: S.gateScript || '' });
    if (kind === 'boss') return Object.assign(base, { kind, dex: S.boss, arena: S.bossArena, r: 12, script: S.script, limit: 150 });
    const arena = S.horde[i < 5 ? 0 : 1];
    if (kind === 'plates') return Object.assign(base, { kind, arena, r: 15, quota: 0 });
    if (kind === 'twins') return Object.assign(base, { kind, arena, r: 13, limit: 150 });
    if (kind === 'horde') return Object.assign(base, { kind, arena, r: 15, quota: Math.round(16 + n * 0.6) });
    return Object.assign(base, { kind, arena, r: 15 });        // the rest: systems/towerfloors.js plans them
  }

  const isCheckpoint = n => n % SECTION === 0;
  /** Floors a run can start from: 1F and the floor after each unlocked checkpoint. */
  function starts(cp) {
    const out = [1];
    for (let c = SECTION; c <= Math.min(cp, FLOORS - SECTION); c += SECTION) out.push(c + 1);
    return out;
  }
  /** Free card picks for starting above 1F: catches a run up with one that climbed there. */
  const headStart = startFloor => Math.round((startFloor - 1) * 0.8);

  // ---- Battle Points ----
  const BP = { horde: 2, plates: 4, twins: 5, boss: 5, gate: 10, final: 30,
              survival: 3, bounty: 3, relic: 3, hold: 3, escort: 3, lights: 3, sequence: 3, gauntlet: 4, dungeon: 4 };
  // First clear of a floor (each account once, Climb or Expedition): ×10 tickets and bonus BP.
  const FIRST = { boss: { t10: 1, bp: 10 }, twins: { t10: 0, bp: 5 }, gate: { t10: 2, bp: 20 }, final: { t10: 5, bp: 100 } };

  // ---- Badges: run-long passives, pick 1 of 3 after every boss, gatekeeper and Twin Bond floor ----
  // `cost` 0 = everyone has it; otherwise it's unlocked with BP in the tower's BP shop.
  const BADGES = [
    { id: 'guts',    name: 'Guts Badge',      icon: 'fist',   cost: 0,  desc: '+12% damage with every move.', apply: p => { p.atkMul *= 1.12; } },
    { id: 'swift',   name: 'Swift Badge',     icon: 'boot',   cost: 0,  desc: '+8% movement speed and -5% cooldowns.', apply: p => { p.spdMul *= 1.08; p.cdMul *= 0.95; } },
    { id: 'sturdy',  name: 'Sturdy Badge',    icon: 'heart',  cost: 0,  desc: '+60 max HP (and heals it).', apply: p => p.addMaxHp(60) },
    { id: 'harvest', name: 'Harvest Badge',   icon: 'sprout', cost: 0,  desc: '+1.5 HP regenerated per second.', apply: p => { p.regenFlat += 1.5; } },
    { id: 'focus',   name: 'Focus Badge',     icon: 'focus',  cost: 40, desc: '+8% critical-hit chance.', apply: p => { p.critChance += 0.08; } },
    { id: 'reach',   name: 'Reach Badge',     icon: 'reach',  cost: 40, desc: '+15% size of every area attack.', apply: p => { p.areaMul *= 1.15; } },
    { id: 'scholar', name: 'Scholar Badge',   icon: 'book',   cost: 50, desc: '+20% experience gained.', apply: p => { p.xpMul *= 1.2; } },
    { id: 'iron',    name: 'Iron Badge',      icon: 'shield', cost: 60, desc: '+8% damage reduction.', apply: p => { p.dmgReduce = Math.min(0.7, p.dmgReduce + 0.08); } },
    { id: 'giant',   name: 'Giant Badge',     icon: 'star',   cost: 70, desc: '+20% damage to bosses and legendaries.', apply: p => { p.bossMul = (p.bossMul || 1) * 1.2; } },
    { id: 'medic',   name: 'Medic Badge',     icon: 'berry',  cost: 50, desc: 'Clearing a floor heals 40% instead of 15%.', apply: p => { p.towerHeal = 0.4; } },
    { id: 'bounty',  name: 'Bounty Badge',    icon: 'coin',   cost: 80, desc: '+1 Battle Point for every floor you clear.', apply: p => { p.towerBp = (p.towerBp || 0) + 1; } },
    { id: 'rush',    name: 'Rush Badge',      icon: 'up',     cost: 60, desc: '+20% damage, but -15% max HP.', apply: p => { p.atkMul *= 1.2; p.maxHp = Math.max(1, Math.round(p.maxHp * 0.85)); p.hp = Math.min(p.hp, p.maxHp); } }
  ];
  const BADGE_BY = {};
  for (const b of BADGES) BADGE_BY[b.id] = b;

  // ---- Exchange (a poor rate on purpose: BP is for the tower) ----
  const EXCHANGE = [
    { id: 'coins', name: '400 PokéCoins', icon: 'coin', cost: 20, give: s => { s.coins += 400; } },
    { id: 't1',    name: '1 Gacha ticket', icon: 'ticket', cost: 30, give: s => { s.tickets.t1 += 1; } },
    { id: 't10',   name: '1 ×10 ticket', icon: 'ticket10', cost: 250, give: s => { s.tickets.t10 += 1; } }
  ];

  return { FLOORS, SECTION, SECTIONS, FLOOR_SECS, sectionOf, dTime, floor, fixedKind, choices, KINDS, isCheckpoint, starts, headStart,
           BP, FIRST, BADGES, BADGE_BY, EXCHANGE };
})();
