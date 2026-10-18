/* ============ moves.js — move catalogue ============
 *
 * kind (behaviour, implemented in systems/combat.js):
 *   projectile  fires `count` projectiles at the nearest enemy
 *   melee       arc hit around the Pokémon
 *   beam        straight beam that pierces everything in its way
 *   orbit       orbs circling around while the move is active
 *   nova        radial burst in all directions
 *   aura        circle of continuous damage around you
 *   buff        powers up the Pokémon itself (stackable, expires)
 *   ---- since 2026-10-10 (same graphics, another way to play) ----
 *   boomerang   goes out to the enemy and comes back to you, hitting on the way out and back
 *   chain       hits one and jumps to the next `count` nearest
 *   mine        mines on the ground that burst when stepped on
 *   meteor      `count` meteors fall on nearby enemies (the shadow warns)
 *   turret      leaves something that shoots on its own for `dur` seconds
 *   dash        you dash towards the enemy hitting everything on the way (taking no damage)
 *   trail       you leave puddles that hurt whatever steps on them
 *   cone        many short shots in a fan (breath, jet...)
 *
 * Only the ACTIVE move runs. It's switched with 1-4 / Q / E.
 *
 * The icon isn't stored here: G.Icons builds it (type emblem +
 * family badge), see ui/icons.js.
 *
 * Upgrades (lvl 1 -> 5) come from a shared ladder per `kind`:
 *   multiplicative mods -> dmg, cd, speed, radius, dur, amount, arc
 *   additive mods       -> count, pierce, stacks
 */
(() => {
  const LADDERS = {
    projectile: [
      { t: '+1 projectile',                  m: { count: 1, spread: 1.4 } },
      { t: '+45% damage',                     m: { dmg: 1.45 } },
      { t: '-25% cooldown',                  m: { cd: 0.75 } },
      { t: '+1 projectile and +1 pierce',   m: { count: 1, pierce: 1, spread: 1.2 } }
    ],
    melee: [
      { t: '+40% damage',                     m: { dmg: 1.40 } },
      { t: '+25% range',                  m: { radius: 1.25 } },
      { t: '-25% cooldown',                  m: { cd: 0.75 } },
      { t: 'Hits in 360° and +50% damage',    m: { arc: 9, dmg: 1.50 } }
    ],
    beam: [
      { t: '+45% damage',                     m: { dmg: 1.45 } },
      { t: '+30% range and width',         m: { radius: 1.30, width: 1.30 } },
      { t: '-25% cooldown',                  m: { cd: 0.75 } },
      { t: '+50% damage',                     m: { dmg: 1.50 } }
    ],
    orbit: [
      { t: '+1 orb',                       m: { count: 1 } },
      { t: '+55% damage',                     m: { dmg: 1.55 } },
      { t: '+25% radius and spins faster',  m: { radius: 1.25, speed: 1.35 } },
      { t: '+1 orb and +55% damage',           m: { count: 1, dmg: 1.55 } }
    ],
    nova: [
      { t: '+4 projectiles',                m: { count: 4 } },
      { t: '+40% damage',                     m: { dmg: 1.40 } },
      { t: '-25% cooldown',                  m: { cd: 0.75 } },
      { t: '+4 projectiles and +1 pierce', m: { count: 4, pierce: 1 } }
    ],
    aura: [
      { t: '+30% radius',                    m: { radius: 1.30 } },
      { t: '+45% damage',                     m: { dmg: 1.45 } },
      { t: 'Hits 40% more often',    m: { cd: 0.70 } },
      { t: '+30% radius and +50% damage',        m: { radius: 1.30, dmg: 1.50 } }
    ],
    boomerang: [
      { t: '+1 boomerang',                    m: { count: 1 } },
      { t: '+45% damage',                     m: { dmg: 1.45 } },
      { t: '+30% range',                  m: { radius: 1.30 } },
      { t: '+1 boomerang and +40% damage',        m: { count: 1, dmg: 1.40 } }
    ],
    chain: [
      { t: '+2 jumps',                     m: { count: 2 } },
      { t: '+45% damage',                     m: { dmg: 1.45 } },
      { t: '-25% cooldown',                  m: { cd: 0.75 } },
      { t: '+2 jumps and +40% damage',         m: { count: 2, dmg: 1.40 } }
    ],
    mine: [
      { t: '+1 mine',                       m: { count: 1 } },
      { t: '+50% damage',                     m: { dmg: 1.50 } },
      { t: '+30% blast radius',       m: { radius: 1.30 } },
      { t: '+1 mine and -25% cooldown',        m: { count: 1, cd: 0.75 } }
    ],
    meteor: [
      { t: '+1 meteor',                    m: { count: 1 } },
      { t: '+45% damage',                     m: { dmg: 1.45 } },
      { t: '+30% radius',                    m: { radius: 1.30 } },
      { t: '+2 meteors and -20% cooldown',    m: { count: 2, cd: 0.80 } }
    ],
    turret: [
      { t: '+50% damage',                     m: { dmg: 1.50 } },
      { t: 'Fires 35% faster',     m: { rate: 0.74 } },
      { t: '+1 at a time',                   m: { count: 1 } },
      { t: '+50% duration and +40% damage',     m: { dur: 1.50, dmg: 1.40 } }
    ],
    dash: [
      { t: '+40% damage',                     m: { dmg: 1.40 } },
      { t: '+30% distance',                m: { radius: 1.30 } },
      { t: '-25% cooldown',                  m: { cd: 0.75 } },
      { t: '+60% damage and wider',         m: { dmg: 1.60, width: 1.40 } }
    ],
    trail: [
      { t: '+40% damage',                     m: { dmg: 1.40 } },
      { t: '+40% duration',                 m: { dur: 1.40 } },
      { t: 'Pools 30% bigger',    m: { radius: 1.30 } },
      { t: '+50% damage and +30% radius',        m: { dmg: 1.50, radius: 1.30 } }
    ],
    cone: [
      { t: '+3 shots',                   m: { count: 3 } },
      { t: '+40% damage',                     m: { dmg: 1.40 } },
      { t: '+30% range',                  m: { life: 1.30 } },
      { t: '+3 shots and +1 pierce',  m: { count: 3, pierce: 1 } }
    ],
    // ---- new styles (19-10-2026) ----
    charge: [
      { t: '+40% damage', m: { dmg: 1.40 } }, { t: '-15% cooldown', m: { cd: 0.85 } },
      { t: 'A wider and longer beam', m: { width: 1.30, radius: 1.15 } }, { t: '+50% damage', m: { dmg: 1.50 } }
    ],
    ricochet: [
      { t: '+1 bounce', m: { bounces: 1 } }, { t: '+40% damage', m: { dmg: 1.40 } },
      { t: '-20% cooldown', m: { cd: 0.80 } }, { t: '+2 bounces', m: { bounces: 2 } }
    ],
    cage: [
      { t: '+25% radius', m: { radius: 1.25 } }, { t: '+40% damage', m: { dmg: 1.40 } },
      { t: '+40% duration', m: { dur: 1.40 } }, { t: '-20% cooldown', m: { cd: 0.80 } }
    ],
    wall: [
      { t: '30% wider', m: { width: 1.30 } }, { t: '+40% duration', m: { dur: 1.40 } },
      { t: '-20% cooldown', m: { cd: 0.80 } }, { t: '30% wider', m: { width: 1.30 } }
    ],
    burrow: [
      { t: '+40% damage', m: { dmg: 1.40 } }, { t: '+25% blast radius', m: { radius: 1.25 } },
      { t: '-20% cooldown', m: { cd: 0.80 } }, { t: '+50% damage', m: { dmg: 1.50 } }
    ],
    swarm: [
      { t: '+1 bug', m: { count: 1 } }, { t: '+40% damage', m: { dmg: 1.40 } },
      { t: 'Bugs last 40% longer', m: { dur: 1.40 } }, { t: '+2 bugs', m: { count: 2 } }
    ],
    roll: [
      { t: '+40% damage', m: { dmg: 1.40 } }, { t: '25% bigger', m: { radius: 1.25 } },
      { t: 'Builds momentum 40% faster', m: { rate: 1.40 } }, { t: '+50% damage', m: { dmg: 1.50 } }
    ],
    throw: [
      { t: '+40% damage', m: { dmg: 1.40 } }, { t: '+30% landing blast', m: { splash: 1.30 } },
      { t: '-20% cooldown', m: { cd: 0.80 } }, { t: '+50% damage', m: { dmg: 1.50 } }
    ],
    spin: [
      { t: '+40% damage', m: { dmg: 1.40 } }, { t: '+20% radius', m: { radius: 1.20 } },
      { t: 'Spins faster', m: { speed: 1.35 } }, { t: '+50% damage', m: { dmg: 1.50 } }
    ],
    counter: [
      { t: '+40% damage', m: { dmg: 1.40 } }, { t: '+25% reach', m: { radius: 1.25 } },
      { t: '-20% cooldown', m: { cd: 0.80 } }, { t: '+50% damage', m: { dmg: 1.50 } }
    ],
    buff: [
      { t: '+1 max stack',         m: { stacks: 1 } },
      { t: '+40% power',                 m: { amount: 1.40 } },
      { t: '+50% duration',                 m: { dur: 1.50 } },
      { t: '+1 stack and +40% power', m: { stacks: 1, amount: 1.40 } }
    ]
  };

  const RAW = [
    // ---------------- NORMAL (pool shared by everyone) ----------------
    { id: 'tackle', name: 'Tackle', type: 'normal', kind: 'melee',
      desc: 'A short sweep in front of you that hits everything in the arc.',
      cd: 0.50, dmg: 13, radius: 48, arc: 1.7, knock: 90 },

    { id: 'quick-attack', name: 'Quick Attack', type: 'normal', kind: 'dash',
      desc: 'Dash toward the nearest enemy, hitting everything along the way.',
      cd: 0.75, dmg: 20, radius: 110, width: 34, knock: 40 },

    { id: 'swords-dance', name: 'Swords Dance', type: 'normal', kind: 'buff',
      desc: 'Deals no damage. Stacks ATTACK while it\'s active.',
      cd: 0.85, stat: 'atk', amount: 0.13, dur: 7, stacks: 5 },

    { id: 'agility', name: 'Agility', type: 'normal', kind: 'buff',
      desc: 'Deals no damage. Stacks SPEED while it\'s active.',
      cd: 0.85, stat: 'spd', amount: 0.10, dur: 7, stacks: 5 },

    { id: 'harden', name: 'Harden', type: 'normal', kind: 'buff',
      desc: 'Deals no damage. Stacks DEFENSE while it\'s active.',
      cd: 0.85, stat: 'def', amount: 0.07, dur: 7, stacks: 5 },

    // ---------------- FIRE ----------------
    { id: 'ember', name: 'Ember', type: 'fire', kind: 'projectile',
      desc: 'Fires a fireball at the nearest enemy.',
      cd: 0.52, dmg: 18, speed: 310, count: 1, spread: 0.12, pierce: 0, life: 1.6, size: 7, burn: 1 },

    { id: 'flamethrower', name: 'Flamethrower', type: 'fire', kind: 'cone',
      desc: 'A short cone of flames that burns enemies.',
      cd: 0.70, dmg: 7, count: 7, arc: 0.9, speed: 380, life: 0.42, size: 6, pierce: 1, burn: 1 },

    { id: 'fire-spin', name: 'Fire Spin', type: 'fire', kind: 'orbit',
      desc: 'Flames orbit around you, hitting anything they touch.',
      cd: 0.30, dmg: 14, count: 3, radius: 62, speed: 2.4, size: 9, burn: 1 },

    { id: 'heat-wave', name: 'Heat Wave', type: 'fire', kind: 'nova',
      desc: 'A burst of flames in every direction.',
      cd: 1.25, dmg: 13, speed: 250, count: 10, pierce: 1, life: 1.1, size: 7, burn: 1 },

    // ---------------- WATER ----------------
    { id: 'water-gun', name: 'Water Gun', type: 'water', kind: 'projectile',
      desc: 'A piercing jet of water that passes through enemies.',
      cd: 0.44, dmg: 14, speed: 350, count: 1, spread: 0.10, pierce: 1, life: 1.5, size: 6 },

    { id: 'bubble', name: 'Bubble', type: 'water', kind: 'nova',
      desc: 'A fan of bubbles that slows the enemies they touch.',
      cd: 1.00, dmg: 9, speed: 210, count: 8, pierce: 0, life: 1.3, size: 8, slow: 0.45 },

    { id: 'hydro-pump', name: 'Hydro Pump', type: 'water', kind: 'beam',
      desc: 'A slow but devastating beam of water.',
      cd: 1.50, dmg: 29, radius: 250, width: 30 },

    { id: 'aqua-ring', name: 'Aqua Ring', type: 'water', kind: 'buff',
      desc: 'Deals no damage. Stacks HP regeneration while it\'s active.',
      cd: 0.90, stat: 'regen', amount: 1.6, dur: 8, stacks: 4 },

    // ---------------- GRASS ----------------
    { id: 'vine-whip', name: 'Vine Whip', type: 'grass', kind: 'melee',
      desc: 'Long whips that sweep a wide arc in front of you.',
      cd: 0.62, dmg: 16, radius: 68, arc: 1.3, knock: 60 },

    { id: 'razor-leaf', name: 'Razor Leaf', type: 'grass', kind: 'boomerang',
      desc: 'Two leaves fly out and come back, hitting enemies both ways.',
      cd: 0.90, dmg: 10, speed: 330, count: 2, spread: 0.5, radius: 210, size: 6 },

    { id: 'leaf-storm', name: 'Petal Blizzard', type: 'grass', kind: 'orbit',
      desc: 'A wide cyclone of leaves spins around you.',
      cd: 0.26, dmg: 14, count: 4, radius: 74, speed: 2.6, size: 8 },

    // (Formerly Giga Drain: it healed with every hit and was broken. Same id so saves don't break.)
    { id: 'giga-drain', name: 'Grass Knot', type: 'grass', kind: 'aura',
      desc: 'Roots snare and crush everything close to you.',
      cd: 0.55, dmg: 9, radius: 76 },

    // ---------------- ELECTRIC ----------------
    { id: 'thunder-shock', name: 'Thunder Shock', type: 'electric', kind: 'projectile',
      desc: 'A very fast bolt that pierces several enemies.',
      cd: 0.40, dmg: 13, speed: 480, count: 1, spread: 0.08, pierce: 2, life: 1.1, size: 5 },

    { id: 'discharge', name: 'Discharge', type: 'electric', kind: 'aura',
      desc: 'A constant electric field around you.',
      cd: 0.45, dmg: 8, radius: 70 },

    { id: 'thunderbolt', name: 'Thunderbolt', type: 'electric', kind: 'chain',
      desc: 'A bolt that chains from one enemy to the next.',
      cd: 0.95, dmg: 21, count: 4, radius: 140 },

    // ---------------- PSYCHIC ----------------
    // (11-10-2026: -22/-30 % damage and less homing; they were filling the leaderboard.)
    { id: 'confusion', name: 'Confusion', type: 'psychic', kind: 'projectile',
      desc: 'A psychic wave that homes in on its target.',
      cd: 0.58, dmg: 13, speed: 280, count: 1, spread: 0.1, pierce: 0, life: 2.2, size: 8, homing: 2.0 },

    { id: 'psybeam', name: 'Psybeam', type: 'psychic', kind: 'beam',
      desc: 'A wide, heavy-hitting psychic beam.',
      cd: 1.15, dmg: 17, radius: 215, width: 40 },

    { id: 'psychic', name: 'Psychic', type: 'psychic', kind: 'nova',
      desc: 'A psychic burst in every direction that seeks out enemies.',
      cd: 1.35, dmg: 10, speed: 230, count: 12, pierce: 1, life: 1.6, size: 7, homing: 1.0 },

    // ---------------- SECONDARY TYPES ----------------
    { id: 'sludge', name: 'Sludge', type: 'poison', kind: 'projectile',
      desc: 'Toxic sludge that poisons on impact.',
      cd: 0.60, dmg: 17, speed: 290, count: 1, spread: 0.12, pierce: 0, life: 1.5, size: 8, poison: 1 },

    { id: 'mud-shot', name: 'Mud Shot', type: 'ground', kind: 'nova',
      desc: 'Splashes mud around you and slows enemies.',
      cd: 1.10, dmg: 11, speed: 200, count: 7, pierce: 0, life: 1.0, size: 9, slow: 0.4 },

    { id: 'gust', name: 'Gust', type: 'flying', kind: 'orbit',
      desc: 'Whirlwinds orbit you and hit whatever they touch.',
      cd: 0.26, dmg: 13, count: 3, radius: 72, speed: 2.8, size: 8, knock: 40 },

    { id: 'wing-attack', name: 'Wing Attack', type: 'flying', kind: 'melee',
      desc: 'A wide wing sweep that knocks enemies back.',
      cd: 0.55, dmg: 14, radius: 58, arc: 1.9, knock: 70 },

    // ---------------- NORMAL (extra) ----------------
    { id: 'body-slam', name: 'Body Slam', type: 'normal', kind: 'melee',
      desc: 'A heavy tackle: slow, short range and brutal.',
      cd: 0.95, dmg: 30, radius: 46, arc: 2.2, knock: 140 },

    { id: 'hyper-voice', name: 'Hyper Voice', type: 'normal', kind: 'nova',
      desc: 'A sound wave that spreads in every direction.',
      cd: 1.15, dmg: 12, speed: 260, count: 9, pierce: 1, life: 0.9, size: 7 },

    // ---------------- POISON (extra) ----------------
    { id: 'poison-sting', name: 'Poison Sting', type: 'poison', kind: 'projectile',
      desc: 'A quick stinger that poisons.',
      cd: 0.34, dmg: 8, speed: 420, count: 1, spread: 0.08, pierce: 0, life: 1.0, size: 4, poison: 1 },

    { id: 'toxic', name: 'Toxic', type: 'poison', kind: 'trail',
      desc: 'Leaves pools of poison behind you as you move. Enemies standing in them are badly poisoned.',
      cd: 0.3, dmg: 6, radius: 26, dur: 3, poison: 1 },

    // ---------------- GROUND (extra) ----------------
    { id: 'bulldoze', name: 'Bulldoze', type: 'ground', kind: 'aura',
      desc: 'Shakes the ground around you, damaging and slowing nearby enemies.',
      cd: 0.7, dmg: 11, radius: 80, slow: 0.35 },

    // ---------------- BUG ----------------
    { id: 'bug-bite', name: 'Bug Bite', type: 'bug', kind: 'melee',
      desc: 'A quick bite in a short arc.',
      cd: 0.42, dmg: 11, radius: 44, arc: 1.6, knock: 40 },

    { id: 'string-shot', name: 'String Shot', type: 'bug', kind: 'mine',
      desc: 'Lays webs on the ground that trap and heavily slow enemies who step on them.',
      cd: 1.1, dmg: 14, count: 2, radius: 56, dur: 7, slow: 0.6 },

    { id: 'bug-buzz', name: 'Bug Buzz', type: 'bug', kind: 'aura',
      desc: 'A constant vibration that hurts everything near you.',
      cd: 0.45, dmg: 8, radius: 66 },

    // ---------------- ROCK ----------------
    { id: 'rock-throw', name: 'Rock Throw', type: 'rock', kind: 'projectile',
      desc: 'A heavy boulder that knocks the enemy back.',
      cd: 0.7, dmg: 24, speed: 260, count: 1, spread: 0.12, pierce: 0, life: 1.4, size: 9, knock: 90 },

    { id: 'rock-slide', name: 'Rock Slide', type: 'rock', kind: 'meteor',
      desc: 'Rocks fall from the sky onto nearby enemies.',
      cd: 1.3, dmg: 21, count: 3, radius: 46, knock: 50 },     // (12-10-2026: it was 26; it killed twice the average)

    // ---------------- ICE ----------------
    { id: 'ice-beam', name: 'Ice Beam', type: 'ice', kind: 'beam',
      desc: 'An icy beam that almost freezes enemies solid.',
      cd: 1.1, dmg: 20, radius: 220, width: 30, slow: 0.7 },

    { id: 'powder-snow', name: 'Powder Snow', type: 'ice', kind: 'aura',
      desc: 'A blizzard around you that slows enemies.',
      cd: 0.55, dmg: 8, radius: 76, slow: 0.45 },

    // ---------------- FIGHTING ----------------
    { id: 'karate-chop', name: 'Karate Chop', type: 'fighting', kind: 'melee',
      desc: 'A sharp, powerful blow straight ahead.',
      cd: 0.5, dmg: 18, radius: 50, arc: 1.2, knock: 110 },

    { id: 'aura-sphere', name: 'Aura Sphere', type: 'fighting', kind: 'projectile',
      desc: 'An energy sphere that never misses.',
      cd: 0.62, dmg: 17, speed: 300, count: 1, spread: 0.1, pierce: 0, life: 2.0, size: 8, homing: 4 },

    // ---------------- GHOST ----------------
    { id: 'lick', name: 'Lick', type: 'ghost', kind: 'melee',
      desc: 'A ghostly lick that briefly paralyzes enemies.',
      cd: 0.48, dmg: 12, radius: 48, arc: 1.8, slow: 0.4 },

    { id: 'shadow-ball', name: 'Shadow Ball', type: 'ghost', kind: 'projectile',
      desc: 'A shadow orb that pierces through several enemies.',
      cd: 0.66, dmg: 19, speed: 280, count: 1, spread: 0.1, pierce: 2, life: 1.6, size: 9 },

    // ---------------- DRAGON ----------------
    { id: 'dragon-rage', name: 'Dragon Rage', type: 'dragon', kind: 'beam',
      desc: 'A beam of draconic fire in a straight line.',
      cd: 1.0, dmg: 24, radius: 230, width: 34 },

    { id: 'dragon-dance', name: 'Dragon Dance', type: 'dragon', kind: 'buff',
      desc: 'Deals no damage. Stacks ATTACK faster than Swords Dance.',
      cd: 0.7, stat: 'atk', amount: 0.11, dur: 7, stacks: 5 },

    // ---------------- FAIRY ----------------
    { id: 'fairy-wind', name: 'Fairy Wind', type: 'fairy', kind: 'nova',
      desc: 'A magical breeze in every direction.',
      cd: 1.0, dmg: 11, speed: 230, count: 10, pierce: 0, life: 1.2, size: 7 },

    { id: 'dazzling-gleam', name: 'Dazzling Gleam', type: 'fairy', kind: 'aura',
      desc: 'A flash of light all around you.',
      cd: 0.5, dmg: 9, radius: 72 },

    // ---------------- STEEL ----------------
    { id: 'metal-claw', name: 'Metal Claw', type: 'steel', kind: 'melee',
      desc: 'A steel slash in an arc.',
      cd: 0.5, dmg: 15, radius: 50, arc: 1.6, knock: 60 },

    { id: 'flash-cannon', name: 'Flash Cannon', type: 'steel', kind: 'beam',
      desc: 'A piercing beam of metallic light.',
      cd: 1.05, dmg: 23, radius: 220, width: 30 },

    // ---------------- DARK ----------------
    { id: 'bite', name: 'Bite', type: 'dark', kind: 'melee',
      desc: 'A quick bite that knocks enemies back.',
      cd: 0.45, dmg: 14, radius: 46, arc: 1.5, knock: 70 },

    { id: 'dark-pulse', name: 'Dark Pulse', type: 'dark', kind: 'nova',
      desc: 'A wave of dark energy in every direction.',
      cd: 1.15, dmg: 14, speed: 240, count: 10, pierce: 1, life: 1.1, size: 8 },

    { id: 'night-shade', name: 'Night Shade', type: 'dark', kind: 'aura',
      desc: 'A shadow surrounds you and drains everything near you.',
      cd: 0.5, dmg: 9, radius: 72 },

    // ---------------- NEW (2026-10-10): same shapes, other mechanics ----------------
    { id: 'bonemerang', name: 'Bonemerang', type: 'ground', kind: 'boomerang',
      desc: 'A bone that flies out and back, hitting hard both ways.',
      cd: 0.95, dmg: 16, speed: 300, count: 1, radius: 230, size: 8, knock: 40 },

    { id: 'psycho-cut', name: 'Psycho Cut', type: 'psychic', kind: 'boomerang',
      desc: 'Psychic blades that fly out and return to you.',
      cd: 0.8, dmg: 9, speed: 360, count: 2, spread: 0.6, radius: 200, size: 7 },

    { id: 'spikes', name: 'Spikes', type: 'ground', kind: 'mine',
      desc: 'Scatters spikes that burst when enemies step on them.',
      cd: 1.2, dmg: 18, count: 2, radius: 60, dur: 8 },

    { id: 'toxic-spikes', name: 'Toxic Spikes', type: 'poison', kind: 'mine',
      desc: 'Poison spikes that badly poison enemies when they burst.',
      cd: 1.1, dmg: 11, count: 2, radius: 56, dur: 8, poison: 2 },

    { id: 'hail', name: 'Hail', type: 'ice', kind: 'meteor',
      desc: 'Hailstones fall on enemies and slow them.',
      cd: 1.2, dmg: 18, count: 4, radius: 40, slow: 0.4 },

    { id: 'meteor-mash', name: 'Meteor Mash', type: 'steel', kind: 'meteor',
      desc: 'Two steel meteors that crush where they land.',
      cd: 1.4, dmg: 34, count: 2, radius: 54, knock: 80 },

    { id: 'will-o-wisp', name: 'Will-O-Wisp', type: 'fire', kind: 'turret',
      desc: 'Leaves a floating flame that fires on its own and burns enemies.',
      cd: 3.5, dmg: 15, rate: 0.55, dur: 6, count: 1, range: 300, speed: 300, size: 7, burn: 1 },

    { id: 'substitute', name: 'Substitute', type: 'normal', kind: 'turret',
      desc: 'A plush decoy: nearby enemies go for it instead of you. It shoots back and explodes when it breaks.',
      cd: 4.0, dmg: 14, rate: 0.4, dur: 10, count: 1, range: 280, speed: 320, size: 6,
      hp: 8, radius: 70, boom: 3, taunt: 340,
      ups: [
        { t: 'Takes 4 more hits before it breaks', m: { hp: 4 } },
        { t: '+50% damage', m: { dmg: 1.50 } },
        { t: '+4 hits and a 30% bigger explosion', m: { hp: 4, radius: 1.30 } },
        { t: '+50% duration and a 50% stronger explosion', m: { dur: 1.50, boom: 1.50 } }
      ] },

    { id: 'aerial-ace', name: 'Aerial Ace', type: 'flying', kind: 'dash',
      desc: 'Dive through enemies, slashing everything you pass.',
      cd: 0.75, dmg: 18, radius: 120, width: 40, knock: 60 },

    { id: 'flame-wheel', name: 'Flame Wheel', type: 'fire', kind: 'trail',
      desc: 'You run wrapped in fire, leaving a trail of flames.',
      cd: 0.28, dmg: 10, radius: 28, dur: 2.6, burn: 1 },

    { id: 'bubble-beam', name: 'Bubble Beam', type: 'water', kind: 'cone',
      desc: 'A short fan of bubbles that slows enemies.',
      cd: 0.65, dmg: 6, count: 7, arc: 1.0, speed: 340, life: 0.45, size: 6, slow: 0.3 },

    { id: 'hex', name: 'Hex', type: 'ghost', kind: 'chain',
      desc: 'A curse that jumps between enemies. Much more damage to burned, poisoned or slowed ones.',
      cd: 0.9, dmg: 17, count: 4, radius: 150, hex: 1.7 },

    // ---------------- new moves (18-10-2026) ----------------
    // Same kinds as before, each with an on-hit effect (`fx`, see hitFx in systems/combat.js).
    { id: 'absorb', name: 'Absorb', type: 'grass', kind: 'projectile',
      desc: 'Homing seeds that heal you for part of the damage they deal.',
      cd: 0.55, dmg: 12, speed: 300, count: 1, spread: 0.16, pierce: 0, life: 1.6, size: 6, homing: 2.5,
      fx: { drain: 0.25 } },

    { id: 'acid-spray', name: 'Acid Spray', type: 'poison', kind: 'cone',
      desc: 'A spray of acid. Enemies hit take 25% more damage from everyone for a few seconds.',
      cd: 0.75, dmg: 6, count: 6, arc: 0.8, speed: 330, life: 0.42, size: 6, pierce: 1,
      fx: { vuln: 3 } },

    { id: 'pin-missile', name: 'Pin Missile', type: 'bug', kind: 'projectile',
      desc: 'A rapid volley of small homing needles.',
      cd: 0.60, dmg: 7, speed: 380, count: 3, spread: 0.22, pierce: 0, life: 1.3, size: 5, homing: 3 },

    { id: 'ice-shard', name: 'Ice Shard', type: 'ice', kind: 'projectile',
      desc: 'A very fast shard of ice that can freeze enemies solid for a moment.',
      cd: 0.42, dmg: 13, speed: 470, count: 1, spread: 0.10, pierce: 0, life: 1.2, size: 6,
      fx: { freeze: [0.2, 0.9] } },

    { id: 'frost-breath', name: 'Frost Breath', type: 'ice', kind: 'cone',
      desc: 'Icy breath that slows. Enemies that keep getting hit by it freeze.',
      cd: 0.70, dmg: 6, count: 7, arc: 0.9, speed: 340, life: 0.42, size: 6, pierce: 0, slow: 0.3,
      fx: { chill: 4 } },

    { id: 'drain-punch', name: 'Drain Punch', type: 'fighting', kind: 'melee',
      desc: 'A heavy punch in front of you that heals you for part of the damage.',
      cd: 0.55, dmg: 14, radius: 48, arc: 1.5, knock: 70,
      fx: { drain: 0.2 } },

    { id: 'dragon-breath', name: 'Dragon Breath', type: 'dragon', kind: 'cone',
      desc: 'A gust of dragon fire that can stun enemies.',
      cd: 0.70, dmg: 7, count: 7, arc: 0.9, speed: 360, life: 0.42, size: 6, pierce: 1,
      fx: { stun: [0.1, 0.7] } },

    { id: 'pursuit', name: 'Pursuit', type: 'dark', kind: 'projectile',
      desc: 'A homing shot that does double damage to enemies below 30% HP.',
      cd: 0.60, dmg: 16, speed: 360, count: 1, spread: 0.10, pierce: 0, life: 1.8, size: 7, homing: 3,
      fx: { exec: 2 } },

    // ---------------- burst moves (18-10-2026) ----------------
    // Long cooldown. They charge in the background while you use your other moves and fire the
    // moment you switch to them; then you switch back. They can't go in a bond (it would fire them
    // on its own and there'd be no reason to switch) and you can carry 2 at most. See burst() in combat.js.
    { id: 'hyper-beam', name: 'Hyper Beam', type: 'normal', kind: 'burst',
      desc: 'Burst · 18 s. A huge beam across the screen that pierces everything. You slow down for a moment after.',
      cd: 18, dmg: 200, radius: 560, width: 56,
      ups: [{ t: '+40% damage', m: { dmg: 1.40 } }, { t: '-15% cooldown', m: { cd: 0.85 } },
            { t: 'A wider and longer beam', m: { width: 1.30, radius: 1.15 } }, { t: '+50% damage', m: { dmg: 1.50 } }] },

    { id: 'explosion', name: 'Explosion', type: 'normal', kind: 'burst',
      desc: 'Burst · 22 s. A massive blast all around you. Costs 15% of your max HP (it never knocks you out).',
      cd: 22, dmg: 260, radius: 140, knock: 260, selfHp: 0.15,
      ups: [{ t: '+40% damage', m: { dmg: 1.40 } }, { t: '+25% blast radius', m: { radius: 1.25 } },
            { t: '-15% cooldown', m: { cd: 0.85 } }, { t: '+40% damage and it only costs 7.5% HP', m: { dmg: 1.40, selfHp: 0.075 } }] },

    { id: 'protect', name: 'Protect', type: 'normal', kind: 'burst',
      desc: 'Burst · 20 s. A shield: you take no damage at all for 3 seconds.',
      cd: 20, dur: 3, radius: 60, knock: 160,
      ups: [{ t: '+0.5 s shield', m: { dur: 3.5 / 3 } }, { t: '-15% cooldown', m: { cd: 0.85 } },
            { t: '+0.5 s shield', m: { dur: 4 / 3.5 } }, { t: '-15% cooldown', m: { cd: 0.85 } }] },

    { id: 'recover', name: 'Recover', type: 'normal', kind: 'burst',
      desc: 'Burst · 25 s. Heals 30% of your max HP at once.',
      cd: 25, amount: 0.30,
      ups: [{ t: 'Heals 35%', m: { amount: 0.35 / 0.30 } }, { t: '-15% cooldown', m: { cd: 0.85 } },
            { t: 'Heals 40%', m: { amount: 0.40 / 0.35 } }, { t: '-15% cooldown', m: { cd: 0.85 } }] },

    { id: 'thunder-wave', name: 'Thunder Wave', type: 'electric', kind: 'burst',
      desc: 'Burst · 20 s. A shock wave that stuns every enemy around you (bosses are slowed instead).',
      cd: 20, dmg: 20, radius: 380, dur: 1.2,
      ups: [{ t: 'Stuns 0.3 s longer', m: { dur: 1.25 } }, { t: '-15% cooldown', m: { cd: 0.85 } },
            { t: '+25% radius', m: { radius: 1.25 } }, { t: 'Stuns 0.3 s longer', m: { dur: 1.2 } }] },

    // ---------------- Batch 2 (19-10-2026): every type gets physical and special moves ----------------
    // (Physical / special is stored in `cat` for the future attack / special attack split; it doesn't change damage yet.)
    { id: 'seed-bomb', name: 'Seed Bomb', type: 'grass', kind: 'meteor', cat: 'physical',
      desc: 'Hard seeds rain down and burst on nearby foes.',
      cd: 1.3, dmg: 22, radius: 46, count: 3, knock: 40 },

    { id: 'spark', name: 'Spark', type: 'electric', kind: 'dash', cat: 'physical',
      desc: 'Charge through foes crackling with electricity; it can stun them.',
      cd: 0.75, dmg: 18, radius: 115, width: 36, knock: 50, fx: { stun: [0.15, 0.6] } },

    { id: 'thunder-punch', name: 'Thunder Punch', type: 'electric', kind: 'melee', cat: 'physical',
      desc: 'An electric punch in front of you; it can stun.',
      cd: 0.55, dmg: 15, radius: 50, arc: 1.4, knock: 80, fx: { stun: [0.12, 0.6] } },

    { id: 'zing-zap', name: 'Zing Zap', type: 'electric', kind: 'trail', cat: 'physical',
      desc: 'You leave crackling sparks where you run; foes that step on them get shocked and can be stunned.',
      cd: 0.3, dmg: 8, radius: 26, dur: 2.4, fx: { stun: [0.06, 0.5] } },

    { id: 'zen-headbutt', name: 'Zen Headbutt', type: 'psychic', kind: 'melee', cat: 'physical',
      desc: 'A headbutt with the force of the mind; it can stun.',
      cd: 0.6, dmg: 17, radius: 46, arc: 1.2, knock: 120, fx: { stun: [0.15, 0.7] } },

    { id: 'psyshield-bash', name: 'Psyshield Bash', type: 'psychic', kind: 'dash', cat: 'physical',
      desc: 'Dash in wrapped in psychic energy: you take 30% less damage for a moment after.',
      cd: 0.8, dmg: 21, radius: 115, width: 40, knock: 60, guard: [0.3, 1.5] },

    { id: 'cross-poison', name: 'Cross Poison', type: 'poison', kind: 'melee', cat: 'physical',
      desc: 'An X-shaped slash with a high critical-hit chance; it poisons.',
      cd: 0.5, dmg: 14, radius: 50, arc: 1.6, knock: 50, poison: 1, fx: { crit: 0.2 } },

    { id: 'scorching-sands', name: 'Scorching Sands', type: 'ground', kind: 'cone', cat: 'special',
      desc: 'A blast of burning sand in front of you that burns.',
      cd: 0.75, dmg: 7, count: 6, arc: 0.85, speed: 330, life: 0.42, size: 6, pierce: 1, burn: 1 },

    { id: 'drill-peck', name: 'Drill Peck', type: 'flying', kind: 'melee', cat: 'physical',
      desc: 'A spinning beak strike: a narrow, long-reaching and powerful hit.',
      cd: 0.55, dmg: 19, radius: 62, arc: 0.7, knock: 40 },

    { id: 'air-slash', name: 'Air Slash', type: 'flying', kind: 'projectile', cat: 'special',
      desc: 'Blades of air that pierce several foes; they can stun.',
      cd: 0.6, dmg: 14, speed: 340, count: 1, spread: 0.1, pierce: 2, life: 1.3, size: 7, fx: { stun: [0.1, 0.5] } },

    { id: 'air-cutter', name: 'Air Cutter', type: 'flying', kind: 'cone', cat: 'special',
      desc: 'A wide fan of razor wind.',
      cd: 0.7, dmg: 7, count: 7, arc: 1.1, speed: 360, life: 0.4, size: 6, pierce: 0 },

    { id: 'signal-beam', name: 'Signal Beam', type: 'bug', kind: 'beam', cat: 'special',
      desc: 'A flickering beam of light; it can stun.',
      cd: 1.1, dmg: 18, radius: 215, width: 32, fx: { stun: [0.15, 0.6] } },

    { id: 'ancient-power', name: 'Ancient Power', type: 'rock', kind: 'nova', cat: 'special',
      desc: 'A ring of ancient rocks in every direction; sometimes it raises your damage for a while.',
      cd: 1.2, dmg: 13, count: 8, speed: 230, life: 1.1, size: 8, pierce: 1, surge: [0.2, 0.1, 5, 3] },

    { id: 'sandstorm', name: 'Sandstorm', type: 'rock', kind: 'aura', cat: 'special',
      desc: 'A sandstorm whirls around you, chipping at everything close.',
      cd: 0.55, dmg: 8, radius: 78 },

    { id: 'ice-punch', name: 'Ice Punch', type: 'ice', kind: 'melee', cat: 'physical',
      desc: 'A freezing punch in front of you; it can freeze.',
      cd: 0.55, dmg: 15, radius: 50, arc: 1.4, knock: 70, fx: { freeze: [0.12, 0.8] } },

    { id: 'icicle-spear', name: 'Icicle Spear', type: 'ice', kind: 'projectile', cat: 'physical',
      desc: 'A volley of icicles that pierce.',
      cd: 0.55, dmg: 8, speed: 400, count: 3, spread: 0.14, pierce: 1, life: 1.1, size: 5 },

    { id: 'vacuum-wave', name: 'Vacuum Wave', type: 'fighting', kind: 'projectile', cat: 'special',
      desc: 'A very fast wave of fighting energy.',
      cd: 0.42, dmg: 12, speed: 520, count: 1, spread: 0.08, pierce: 1, life: 0.9, size: 7 },

    { id: 'shadow-claw', name: 'Shadow Claw', type: 'ghost', kind: 'melee', cat: 'physical',
      desc: 'Claws from the shadows with a high critical-hit chance.',
      cd: 0.5, dmg: 15, radius: 52, arc: 1.6, knock: 50, fx: { crit: 0.25 } },

    { id: 'spirit-shackle', name: 'Spirit Shackle', type: 'ghost', kind: 'projectile', cat: 'physical',
      desc: 'A ghostly arrow that pins foes, slowing them down.',
      cd: 0.6, dmg: 15, speed: 330, count: 1, spread: 0.1, pierce: 1, life: 1.6, size: 6, slow: 0.45 },

    { id: 'ominous-wind', name: 'Ominous Wind', type: 'ghost', kind: 'nova', cat: 'special',
      desc: 'A haunting wind in every direction; foes hit take more damage for a moment.',
      cd: 1.15, dmg: 11, count: 10, speed: 230, life: 1.1, size: 7, pierce: 0, fx: { vuln: 2 } },

    { id: 'dragon-claw', name: 'Dragon Claw', type: 'dragon', kind: 'melee', cat: 'physical',
      desc: 'Sharp dragon claws that sweep in front of you.',
      cd: 0.5, dmg: 16, radius: 52, arc: 1.8, knock: 60 },

    { id: 'dragon-darts', name: 'Dragon Darts', type: 'dragon', kind: 'projectile', cat: 'physical',
      desc: 'Two homing darts at a time.',
      cd: 0.55, dmg: 12, speed: 360, count: 2, spread: 0.2, pierce: 0, life: 1.6, size: 6, homing: 2.5 },

    { id: 'breaking-swipe', name: 'Breaking Swipe', type: 'dragon', kind: 'melee', cat: 'physical',
      desc: 'A tail sweep all around you; foes hit take more damage for a moment.',
      cd: 0.8, dmg: 14, radius: 54, arc: 6.3, knock: 90, fx: { vuln: 2.5 } },

    { id: 'play-rough', name: 'Play Rough', type: 'fairy', kind: 'melee', cat: 'physical',
      desc: 'A rough tumble that hits everything in front; foes hit take more damage for a moment.',
      cd: 0.6, dmg: 16, radius: 52, arc: 1.9, knock: 80, fx: { vuln: 2 } },

    { id: 'spirit-break', name: 'Spirit Break', type: 'fairy', kind: 'dash', cat: 'physical',
      desc: 'Dash through foes with a burst of fairy power.',
      cd: 0.75, dmg: 19, radius: 115, width: 38, knock: 60 },

    { id: 'fiery-wrath', name: 'Fiery Wrath', type: 'dark', kind: 'cone', cat: 'special',
      desc: 'A cone of dark flames in front of you; it can stun.',
      cd: 0.7, dmg: 7, count: 7, arc: 0.9, speed: 350, life: 0.42, size: 6, pierce: 1, fx: { stun: [0.08, 0.5] } },

    { id: 'disarming-voice', name: 'Disarming Voice', type: 'fairy', kind: 'nova', cat: 'special',
      desc: 'Charming cries all around you that home in on foes.',
      cd: 1.05, dmg: 10, count: 9, speed: 240, life: 1.3, size: 7, pierce: 0, homing: 1.2 },

    // ---- Batch 2: moves with the new styles (see the new-styles block in systems/combat.js) ----
    { id: 'solar-beam', name: 'Solar Beam', type: 'grass', kind: 'charge', cat: 'special',
      desc: 'Gathers sunlight for a moment, then fires a huge beam where you are aiming.',
      cd: 2.6, dmg: 70, radius: 480, width: 40, delay: 1.1 },

    { id: 'electro-ball', name: 'Electro Ball', type: 'electric', kind: 'ricochet', cat: 'special',
      desc: 'A ball of electricity that bounces from foe to foe, stronger with every bounce.',
      cd: 0.9, dmg: 19, speed: 330, count: 1, size: 8, life: 1.6, bounces: 3, grow: 1.15 },

    { id: 'thunder-cage', name: 'Thunder Cage', type: 'electric', kind: 'cage', cat: 'special',
      desc: 'Traps a group in an electric cage: everything inside is shocked, and foes trying to get out take a big jolt.',
      cd: 3.2, dmg: 9, radius: 70, dur: 4, edge: 2.0 },

    { id: 'reflect', name: 'Reflect', type: 'psychic', kind: 'wall', cat: null,
      desc: 'A barrier in front of you that blocks enemy shots for a few seconds.',
      cd: 5, dur: 3.5, width: 80, dist: 34 },

    { id: 'dig', name: 'Dig', type: 'ground', kind: 'burrow', cat: 'physical',
      desc: 'You dig underground (nothing can hit you), then burst up under the biggest group of foes.',
      cd: 2.2, dmg: 55, radius: 72, range: 260, dur: 0.8, knock: 120 },

    { id: 'sand-tomb', name: 'Sand Tomb', type: 'ground', kind: 'cage', cat: 'special',
      desc: 'Traps a group in swirling sand that slows them and keeps chipping at them; nobody gets out.',
      cd: 3, dmg: 8, radius: 70, dur: 4.5, slow: 0.5 },

    { id: 'infestation', name: 'Infestation', type: 'bug', kind: 'swarm', cat: 'special',
      desc: 'Releases little bugs that chase foes on their own and keep biting.',
      cd: 3.5, dmg: 6, count: 3, dur: 6, speed: 150, size: 5, rehit: 0.5 },

    { id: 'rollout', name: 'Rollout', type: 'rock', kind: 'roll', cat: 'physical',
      desc: 'You become a rolling boulder: the longer you keep moving, the bigger and harder you hit.',
      cd: 0.3, dmg: 10, radius: 34, rate: 0.4, max: 1.5 },

    { id: 'power-gem', name: 'Power Gem', type: 'rock', kind: 'ricochet', cat: 'special',
      desc: 'A shining gem that bounces between foes.',
      cd: 0.8, dmg: 18, speed: 340, count: 1, size: 7, life: 1.6, bounces: 4, grow: 1 },

    { id: 'seismic-toss', name: 'Seismic Toss', type: 'fighting', kind: 'throw', cat: 'physical',
      desc: 'Grabs the nearest foe and hurls it into the others. Bosses are too heavy: they take a big hit instead.',
      cd: 1.3, dmg: 44, radius: 70, speed: 300, splash: 50 },

    { id: 'gyro-ball', name: 'Gyro Ball', type: 'steel', kind: 'spin', cat: 'physical',
      desc: 'A steel ball spinning around you that hits harder the slower you move (double standing still).',
      cd: 0.35, dmg: 16, count: 1, radius: 38, speed: 3.0, size: 10, still: 1 },

    { id: 'mirror-shot', name: 'Mirror Shot', type: 'steel', kind: 'ricochet', cat: 'special',
      desc: 'A flash of light that bounces between foes and slows them.',
      cd: 0.85, dmg: 17, speed: 360, count: 1, size: 7, life: 1.5, bounces: 3, grow: 1, slow: 0.3 },

    { id: 'sucker-punch', name: 'Sucker Punch', type: 'dark', kind: 'counter', cat: 'physical',
      desc: 'Waits for a foe to come close, then strikes it first with a heavy blow.',
      cd: 0.9, dmg: 34, radius: 66, knock: 90 },

    { id: 'draco-meteor', name: 'Draco Meteor', type: 'dragon', kind: 'burst',
      desc: 'Burst · 20 s. A rain of 10 meteors on the enemies around you.',
      cd: 20, dmg: 70, count: 10, radius: 52, knock: 60,
      ups: [{ t: '+3 meteors', m: { count: 3 } }, { t: '+40% damage', m: { dmg: 1.40 } },
            { t: '-15% cooldown', m: { cd: 0.85 } }, { t: '+3 meteors and +30% radius', m: { count: 3, radius: 1.30 } }] }
  ];

  // Melee (12-10-2026): +20 % damage and +25 % reach and arc
  // (and -25 % damage taken while it's your active attack, in player.js).
  // They hit well, but you had to take much more risk than with ranged ones.
  for (const m of RAW) {
    if (m.kind !== 'melee') continue;
    m.dmg = Math.round(m.dmg * 1.2);
    m.radius = Math.round(m.radius * 1.25);
    if (m.arc) m.arc = Math.min(3, +(m.arc * 1.25).toFixed(2));
  }

  // When each move was added (only from 18-10-2026 on): the Codex marks recent ones as "New".
  const ADDED = {
    '2026-10-18': ['absorb', 'acid-spray', 'pin-missile', 'ice-shard', 'frost-breath', 'drain-punch', 'dragon-breath', 'pursuit',
                   'hyper-beam', 'explosion', 'protect', 'recover', 'thunder-wave', 'draco-meteor'],
    '2026-10-19': ['seed-bomb', 'spark', 'thunder-punch', 'zing-zap', 'zen-headbutt', 'psyshield-bash', 'cross-poison',
                   'scorching-sands', 'drill-peck', 'air-slash', 'air-cutter', 'signal-beam', 'ancient-power', 'sandstorm',
                   'ice-punch', 'icicle-spear', 'vacuum-wave', 'shadow-claw', 'spirit-shackle', 'ominous-wind', 'dragon-claw',
                   'dragon-darts', 'breaking-swipe', 'play-rough', 'spirit-break', 'disarming-voice',
                   'solar-beam', 'electro-ball', 'thunder-cage', 'reflect', 'dig', 'sand-tomb', 'infestation', 'rollout',
                   'power-gem', 'seismic-toss', 'gyro-ball', 'mirror-shot', 'sucker-punch', 'fiery-wrath']
  };
  for (const [d, ids] of Object.entries(ADDED)) for (const id of ids) RAW.find(m => m.id === id).added = d;

  // Physical or special (for the future attack / special attack split; nothing uses it for damage yet).
  // Older moves follow the same list as the original PokéSurvivor; newer ones set `cat` themselves.
  // Boosters and non-damaging bursts have none.
  const PHYSICAL = new Set(['tackle', 'quick-attack', 'vine-whip', 'razor-leaf', 'wing-attack', 'body-slam', 'poison-sting',
    'bulldoze', 'bug-bite', 'string-shot', 'rock-throw', 'rock-slide', 'karate-chop', 'lick', 'metal-claw', 'bite',
    'bonemerang', 'psycho-cut', 'spikes', 'toxic-spikes', 'meteor-mash', 'substitute', 'aerial-ace', 'flame-wheel',
    'pin-missile', 'ice-shard', 'drain-punch', 'pursuit', 'explosion']);
  for (const m of RAW) {
    if (m.cat !== undefined) continue;          // (set by the move itself; null = no category, like Reflect)
    m.cat = m.kind === 'buff' || (m.kind === 'burst' && !m.dmg) ? null : PHYSICAL.has(m.id) ? 'physical' : 'special';
  }

  // Move pool by type. Everyone has the `normal` pool.
  const POOL = {};
  for (const m of RAW) (POOL[m.type] = POOL[m.type] || []).push(m.id);

  const BY_ID = {};
  for (const m of RAW) {
    m.ups = m.ups || LADDERS[m.kind];
    m.maxLvl = m.ups.length + 1;
    BY_ID[m.id] = m;
  }

  /** Moves this Pokémon can learn (its types + normal). */
  function poolFor(mon) {
    const ids = new Set(POOL.normal);
    for (const t of mon.types) for (const id of (POOL[t] || [])) ids.add(id);
    return [...ids];
  }

  /**
   * A move instance in a run: the base numbers from `def` with all
   * the ladder's upgrades up to `lvl` already applied.
   */
  function instance(id, lvl = 1) {
    const def = BY_ID[id];
    const s = Object.assign({}, def, { id, def, lvl, t: 0 });
    delete s.ups;
    for (let i = 0; i < lvl - 1; i++) applyMods(s, def.ups[i].m);
    return s;
  }

  const MULT = ['dmg', 'cd', 'speed', 'radius', 'dur', 'amount', 'arc', 'width', 'spread', 'life', 'size', 'rate', 'boom', 'delay', 'splash'];
  const ADD = ['count', 'pierce', 'stacks', 'hp', 'bounces'];

  function applyMods(s, m) {
    for (const k in m) {
      if (MULT.includes(k) && s[k] != null) s[k] *= m[k];
      else if (ADD.includes(k)) s[k] = (s[k] || 0) + m[k];
      else s[k] = m[k];
    }
  }

  /** Levels up an instance that already exists. */
  function levelUp(s) {
    if (s.lvl >= s.def.maxLvl) return false;
    applyMods(s, s.def.ups[s.lvl - 1].m);
    s.lvl++;
    return true;
  }

  /** Text for the next upgrade, for the level-up card. */
  function nextUpText(s) {
    return s.lvl >= s.def.maxLvl ? null : s.def.ups[s.lvl - 1].t;
  }

  /** Starting move by main type (if the Pokémon doesn't come with one). */
  const START = {
    fire: 'ember', water: 'water-gun', grass: 'vine-whip', electric: 'thunder-shock',
    psychic: 'confusion', poison: 'sludge', ground: 'mud-shot', flying: 'gust',
    bug: 'bug-bite', rock: 'rock-throw', ice: 'ice-beam', fighting: 'karate-chop',
    ghost: 'shadow-ball', dragon: 'dragon-rage', fairy: 'fairy-wind', steel: 'metal-claw',
    dark: 'bite', normal: 'tackle'
  };
  function startFor(mon) {
    if (mon.start && BY_ID[mon.start]) return mon.start;
    for (const t of mon.types) if (START[t]) return START[t];
    return 'tackle';
  }

  // ---------------- move evolution ----------------
  /*
   * A move at MAX LEVEL evolves if during that run you've ever taken
   * its condition's upgrade (`needs`, an id from LevelUp.STATS). A golden
   * card appears. Boosters (buff) don't evolve.
   */
  const NEED_NAME = { hp: 'Vigor', atk: 'Power', spd: 'Sprint', cd: 'Reflexes', def: 'Armor',
                      rgn: 'Synthesis', mag: 'Magnet', xp: 'Learning', area: 'Reach', crit: 'Focus' };
  const EVO = {
    'tackle': ['Take Down', 'hp'],             'quick-attack': ['Extreme Speed', 'spd'],
    'body-slam': ['Giga Impact', 'hp'],     'hyper-voice': ['Uproar', 'area'],
    'ember': ['Fire Blast', 'atk'],           'flamethrower': ['Overheat', 'cd'],
    'fire-spin': ['Sacred Fire', 'rgn'],   'heat-wave': ['Eruption', 'area'],
    'water-gun': ['Scald', 'atk'],        'bubble': ['Surf', 'spd'],
    'hydro-pump': ['Hydro Cannon', 'atk'],     'vine-whip': ['Power Whip', 'atk'],
    'razor-leaf': ['Leaf Storm', 'crit'],     'leaf-storm': ['Petal Dance', 'rgn'],
    'giga-drain': ['Frenzy Plant', 'hp'],    'thunder-shock': ['Thunder', 'atk'],
    'discharge': ['Electric Terrain', 'def'], 'thunderbolt': ['Zap Cannon', 'cd'],
    'confusion': ['Psyshock', 'cd'],       'psybeam': ['Future Sight', 'xp'],
    'psychic': ['Expanding Force', 'area'],      'sludge': ['Sludge Bomb', 'atk'],
    'poison-sting': ['Poison Jab', 'spd'],  'toxic': ['Poison Gas', 'rgn'],
    'mud-shot': ['Earth Power', 'area'],      'bulldoze': ['Earthquake', 'area'],
    'gust': ['Hurricane', 'spd'],             'wing-attack': ['Brave Bird', 'atk'],
    'bug-bite': ['X-Scissor', 'atk'],         'string-shot': ['Sticky Web', 'cd'],
    'bug-buzz': ['Swarm', 'xp'],         'rock-throw': ['Stone Edge', 'crit'],
    'rock-slide': ['Stealth Rock', 'cd'],    'ice-beam': ['Blizzard', 'atk'],
    'powder-snow': ['Icy Wind', 'spd'],  'karate-chop': ['Close Combat', 'crit'],
    'aura-sphere': ['Focus Blast', 'cd'],   'lick': ['Shadow Punch', 'hp'],
    'shadow-ball': ['Phantom Force', 'cd'], 'dragon-rage': ['Dragon Energy', 'atk'],
    'fairy-wind': ['Moonblast', 'atk'],   'dazzling-gleam': ['Misty Terrain', 'area'],
    'metal-claw': ['Iron Head', 'def'], 'flash-cannon': ['Steel Beam', 'def'],
    'bite': ['Crunch', 'crit'],             'dark-pulse': ['Snarl', 'spd'],
    'night-shade': ['Nightmare', 'rgn'],
    'bonemerang': ['Bone Rush', 'atk'],    'psycho-cut': ['Psychic Fangs', 'crit'],
    'spikes': ['Fissure', 'def'],             'toxic-spikes': ['Gunk Shot', 'rgn'],
    'hail': ['Avalanche', 'cd'],                  'meteor-mash': ['Magnet Bomb', 'mag'],
    'will-o-wisp': ['Inferno', 'cd'],       'substitute': ['Double Team', 'def'],
    'aerial-ace': ['Acrobatics', 'spd'],       'flame-wheel': ['Flare Blitz', 'spd'],
    'bubble-beam': ['Aqua Tail', 'atk'],     'hex': ['Poltergeist', 'mag'],
    // 18-10-2026
    'absorb': ['Giga Drain', 'rgn'],          'acid-spray': ['Corrosive Gas', 'cd'],
    'pin-missile': ['Fell Stinger', 'atk'],   'ice-shard': ['Glacial Lance', 'atk'],
    'frost-breath': ['Sheer Cold', 'crit'],   'drain-punch': ['Hammer Arm', 'rgn'],
    'dragon-breath': ['Dragon Pulse', 'cd'],  'pursuit': ['Kowtow Cleave', 'crit'],
    // 19-10-2026 (Batch 2)
    'seed-bomb': ['Wood Hammer', 'area'],       'spark': ['Wild Charge', 'spd'],
    'thunder-punch': ['Plasma Fists', 'atk'],   'zing-zap': ['Volt Tackle', 'def'],
    'zen-headbutt': ['Psyblade', 'atk'],        'psyshield-bash': ['Hyperspace Fury', 'def'],
    'cross-poison': ['Dire Claw', 'crit'],      'scorching-sands': ["Land's Wrath", 'cd'],
    'drill-peck': ['Sky Attack', 'atk'],        'air-slash': ['Aeroblast', 'crit'],
    'air-cutter': ['Bleakwind Storm', 'cd'],    'signal-beam': ['Pollen Puff', 'rgn'],
    'ancient-power': ['Diamond Storm', 'def'],  'sandstorm': ['Salt Cure', 'area'],
    'ice-punch': ['Ice Hammer', 'atk'],         'icicle-spear': ['Icicle Crash', 'cd'],
    'vacuum-wave': ['Secret Sword', 'cd'],      'shadow-claw': ['Spectral Thief', 'crit'],
    'spirit-shackle': ['Last Respects', 'xp'],  'ominous-wind': ['Astral Barrage', 'area'],
    'dragon-claw': ['Dragon Hammer', 'atk'],    'dragon-darts': ['Glaive Rush', 'cd'],
    'breaking-swipe': ['Dual Chop', 'area'],    'play-rough': ['Magical Torque', 'atk'],
    'spirit-break': ['Light of Ruin', 'spd'],   'disarming-voice': ['Sparkly Swirl', 'cd'],
    'solar-beam': ['Chloroblast', 'atk'],       'electro-ball': ['Electro Drift', 'spd'],
    'thunder-cage': ['Rising Voltage', 'area'], 'reflect': ['Mirror Coat', 'def'],
    'dig': ['Drill Run', 'spd'],                'sand-tomb': ['Sandsear Storm', 'area'],
    'infestation': ['Attack Order', 'xp'],      'rollout': ['Head Smash', 'hp'],
    'power-gem': ['Meteor Beam', 'cd'],         'seismic-toss': ['Superpower', 'atk'],
    'gyro-ball': ['Heavy Slam', 'def'],         'mirror-shot': ['Doom Desire', 'xp'],
    'sucker-punch': ['Wicked Blow', 'atk'],     'fiery-wrath': ['Night Daze', 'cd']
  };
  // What it gains when evolving, depending on how it works.
  const EVO_MODS = {
    projectile: { t: '×1.8 damage, +2 projectiles, +2 pierce and bigger', m: { dmg: 1.8, count: 2, pierce: 2, size: 1.3, spread: 1.1 } },
    melee:      { t: '×1.9 damage, more range and hits in 360°', m: { dmg: 1.9, radius: 1.3, arc: 9 } },
    beam:       { t: '×1.8 damage, a 50% wider and longer beam', m: { dmg: 1.8, width: 1.5, radius: 1.2, cd: 0.85 } },
    orbit:      { t: '+2 orbs, ×1.7 damage and more radius', m: { count: 2, dmg: 1.7, radius: 1.15 } },
    nova:       { t: '+6 projectiles, ×1.6 damage and +1 pierce', m: { count: 6, dmg: 1.6, pierce: 1 } },
    aura:       { t: '×1.8 damage and 35% more radius', m: { dmg: 1.8, radius: 1.35 } },
    boomerang:  { t: '×1.8 damage, +1 boomerang and more range', m: { dmg: 1.8, count: 1, radius: 1.2, size: 1.2 } },
    chain:      { t: '×1.7 damage and +3 jumps', m: { dmg: 1.7, count: 3, radius: 1.2 } },
    mine:       { t: '×1.8 damage, +2 mines and a bigger blast', m: { dmg: 1.8, count: 2, radius: 1.25 } },
    meteor:     { t: '×1.7 damage, +2 meteors and more radius', m: { dmg: 1.7, count: 2, radius: 1.2 } },
    turret:     { t: '×1.8 damage, +1 at a time and fires faster', m: { dmg: 1.8, count: 1, rate: 0.8 } },
    dash:       { t: '×1.9 damage, more distance and less cooldown', m: { dmg: 1.9, radius: 1.25, cd: 0.8 } },
    trail:      { t: '×1.8 damage, bigger and longer-lasting pools', m: { dmg: 1.8, radius: 1.25, dur: 1.3 } },
    cone:       { t: '×1.7 damage, +4 shots and +1 pierce', m: { dmg: 1.7, count: 4, pierce: 1 } },
    charge:     { t: '×1.8 damage, charges 40% faster and a wider beam', m: { dmg: 1.8, delay: 0.6, width: 1.3 } },
    ricochet:   { t: '×1.7 damage, +3 bounces and +1 shot', m: { dmg: 1.7, bounces: 3, count: 1 } },
    cage:       { t: '×1.8 damage, a 25% bigger cage that lasts longer', m: { dmg: 1.8, radius: 1.25, dur: 1.25 } },
    burrow:     { t: '×1.8 damage, a bigger blast and less cooldown', m: { dmg: 1.8, radius: 1.3, cd: 0.85 } },
    swarm:      { t: '×1.7 damage and +2 bugs', m: { dmg: 1.7, count: 2 } },
    roll:       { t: '×1.8 damage, and you can build up much more momentum', m: { dmg: 1.8, max: 2.2 } },
    throw:      { t: '×1.8 damage and a 40% bigger landing blast', m: { dmg: 1.8, splash: 1.4 } },
    spin:       { t: '×1.8 damage and +1 ball', m: { dmg: 1.8, count: 1 } },
    counter:    { t: '×1.7 damage and more reach', m: { dmg: 1.7, radius: 1.2 } }
  };

  // Moves whose evolution differs from the generic one of their kind.
  const EVO_OWN = { substitute: { t: '×1.8 damage, +8 hits before it breaks and a bigger, stronger explosion', m: { dmg: 1.8, hp: 8, radius: 1.25, boom: 1.4 } },
    // Fell Stinger: the projectile evolution, and every kill gives +5% damage for 4 s (up to 5 at once).
    // Mirror Coat: shots that hit the barrier fly back at enemies, doing double damage.
    reflect: { t: 'Shots that hit it fly back at enemies, and it is 30% wider and lasts longer', m: { reflect: 1, width: 1.3, dur: 1.2 } },
    // Wicked Blow: always a critical hit.
    'sucker-punch': { t: '×1.7 damage, more reach, and every hit is a critical hit', m: { dmg: 1.7, radius: 1.2, fx: { alwaysCrit: 1 } } },
    'pin-missile': { t: '×1.8 damage, +2 needles, +2 pierce, and kills raise your damage for a moment',
                     m: { dmg: 1.8, count: 2, pierce: 2, size: 1.3, spread: 1.1, fx: { fell: 1 } } } };
  const evoMods = m => EVO_OWN[m.id] || EVO_MODS[m.kind];

  /** Can it evolve yet? → { name, needs, needName, text, ready } or null */
  function evoInfo(m, statsTaken) {
    const e = EVO[m.id];
    if (!e || m.evolved || m.lvl < m.def.maxLvl || !evoMods(m)) return null;
    const [name, needs] = e;
    return { name, needs, needName: NEED_NAME[needs], text: evoMods(m).t,
             ready: !!(statsTaken && statsTaken[needs]) };
  }

  /** Evolves an instance (changes name and power; it stays the same type). */
  function evolve(m) {
    const e = EVO[m.id];
    if (!e || m.evolved) return false;
    applyMods(m, evoMods(m).m);
    m.baseName = m.name;
    m.name = e[0];
    m.evolved = true;
    return true;
  }

  G.Moves = { ALL: RAW, BY_ID, POOL, poolFor, instance, levelUp, nextUpText, startFor,
              EVO, NEED_NAME, evoInfo, evolve };
})();
