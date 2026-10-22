/* ============ levelup.js — the three level-up cards ============
 * Card kinds:
 *   new   learn a new move (only if there are free slots out of 4; a bond frees slots)
 *   up    upgrade a move you already have
 *   stat  permanent upgrade for the run
 */
G.LevelUp = (() => {

  const STATS = [
    { id: 'hp',   icon: 'heart', title: 'Vigor',        desc: '+20 max HP (and heals it).',
      apply: pl => pl.addMaxHp(20) },
    { id: 'atk',  icon: 'fist', title: 'Power',     desc: '+10% damage with every move.',
      apply: pl => pl.atkMul *= 1.10, max: 40 },
    { id: 'spd',  icon: 'boot', title: 'Sprint',      desc: '+7% movement speed.',
      apply: pl => pl.spdMul *= 1.07, max: 8 },
    { id: 'cd',   icon: 'clock', title: 'Reflexes',     desc: '-8% cooldown on every move.',
      apply: pl => pl.cdMul *= 0.92, max: 10 },
    { id: 'def',  icon: 'shield', title: 'Armor',       desc: '+6% damage reduction.',
      apply: pl => pl.dmgReduce = Math.min(0.7, pl.dmgReduce + 0.06), max: 12 },
    { id: 'rgn',  icon: 'sprout', title: 'Synthesis',     desc: '+0.9 HP regenerated per second.',
      apply: pl => pl.regenFlat += 0.9 },
    { id: 'mag',  icon: 'magnet', title: 'Magnet',         desc: '+30% experience pickup radius.',
      apply: pl => pl.magnet *= 1.30, max: 6 },
    { id: 'xp',   icon: 'book', title: 'Learning',  desc: '+12% experience gained.',
      apply: pl => pl.xpMul *= 1.12, max: 8 },
    { id: 'area', icon: 'reach', title: 'Reach',      desc: '+10% size of every area attack.',
      apply: pl => pl.areaMul *= 1.10, max: 6 },
    { id: 'crit', icon: 'focus', title: 'Focus',      desc: '+4% critical-hit chance (critical hits do ×1.5 damage).',
      apply: pl => pl.critChance += 0.04, max: 6 },
    { id: 'heal', icon: 'berry', title: 'Sitrus Berry',   desc: 'Restores 45% of your HP right now.',
      apply: pl => pl.heal(pl.maxHp * 0.45) }
  ];

  /** Builds the set of candidate cards, with weights. */
  function candidates(pl) {
    const out = [];

    // --- new moves ---
    if (pl.slots.length < pl.maxMoves) {
      // With 2 boosters no more are offered: buffs don't deal damage and
      // filling the 4 slots with them leaves the run with no way out.
      const buffs = pl.moves.filter(m => m.kind === 'buff').length;
      // Burst moves: 2 at most (they don't attack on their own), and only once you have 2 moves to swap between.
      const bursts = pl.moves.filter(m => m.kind === 'burst').length;
      const pool = G.Moves.poolFor(pl.mon).filter(id =>
        !pl.hasMove(id) && !(pl.banned && pl.banned.has(id)) && !(buffs >= 2 && G.Moves.BY_ID[id].kind === 'buff') &&
        !(G.Moves.BY_ID[id].kind === 'burst' && (bursts >= 2 || pl.moves.length < 2)));
      for (const id of G.U.pickN(pool, 6)) {
        const d = G.Moves.BY_ID[id];
        // Moves that suit the Pokémon's better attacking stat turn up more often (mixed ones: all the same).
        const lean = pl.mon.lean, fit = !d.cat || !lean || lean === 'mixed' ? 1 : d.cat === lean ? 1.4 : 0.6;
        out.push({
          // (22-10-2026: fewer once you have 2 moves; only one slot fires at a time, so they add options, not damage.)
          w: (d.kind === 'burst' ? 5 : 10) * fit * (pl.moves.length >= 2 ? 0.6 : 1), type: 'new', key: 'new:' + id,
          icon: 'move:' + id, color: G.U.TYPE_COLOR[d.type],
          tag: G.U.TYPE_NAME[d.type] + (d.cat ? ' · ' + (d.cat === 'physical' ? 'Physical' : 'Special') : ''), kind: d.kind,
          title: d.name, desc: d.desc,
          apply: p => p.addMove(id)
        });
      }
    }

    // --- evolutions: move at max + its condition met ---
    const waiting = {};                   // stat -> move waiting for it to evolve
    for (const m of pl.moves) {
      const ev = G.Moves.evoInfo(m, pl.statsTaken);
      if (!ev) continue;
      if (!ev.ready) { waiting[ev.needs] = m; continue; }
      out.push({
        w: 40, type: 'evo', key: 'evo:' + m.id,
        icon: 'move:' + m.id, color: '#ffd23f', tag: 'EVOLUTION', kind: m.kind,
        title: m.name + ' → ' + ev.name, desc: ev.text,
        apply: p => {
          G.Moves.evolve(m);
          G.RunLog.evo(m.id);
          G.FX.ring(p.x, p.y, 8, 120, '#ffd23f', 0.8, 6);
          G.FX.burst(p.x, p.y - p.bodyH * 0.5, '#ffe14d', 40, 240);
          G.Audio.sfx('legend');
          G.Progress.event('evolve', { move: m.id });
        }
      });
    }

    // --- upgrades for moves you already have ---
    // (22-10-2026: the move you're using turns up twice as often. Before, your main attack's upgrade was on only
    //  about a quarter of the early level-ups, and some runs never saw it.)
    const using = new Set((pl.slots[pl.active] || []).map(m => m.id));
    for (const m of pl.moves) {
      const txt = G.Moves.nextUpText(m);
      if (!txt) continue;
      out.push({
        w: using.has(m.id) ? 16 : 8, type: 'up', key: 'up:' + m.id,
        icon: 'move:' + m.id, color: G.U.TYPE_COLOR[m.type],
        tag: 'Lv.' + m.lvl + ' > ' + (m.lvl + 1), kind: m.kind,
        title: m.name, desc: txt,
        apply: () => G.Moves.levelUp(m)
      });
    }

    // --- stats ---
    // Those that unlock an evolution always come up, with a notice.
    // Each upgrade has a cap on how many times (`max`): in very long runs they
    // piled up endlessly (speed, cooldown and experience through the roof) and the
    // game ended up freezing. Those an evolution needs always come up.
    const room = s => !s.max || (pl.statsTaken[s.id] || 0) < s.max;
    const pickStats = G.U.pickN(STATS.filter(s => !waiting[s.id] && room(s)), 5).concat(STATS.filter(s => waiting[s.id]));
    for (const s of pickStats) {
      const evoFor = waiting[s.id];
      out.push({
        w: evoFor ? 14 : pl.slots.length < pl.maxMoves ? 4 : 7,
        type: 'stat', key: 'stat:' + s.id,
        icon: s.icon, color: evoFor ? '#ffd23f' : '#8fa3c4', tag: evoFor ? 'Evolves ' + evoFor.name : 'Upgrade',
        title: s.title, desc: s.desc,
        // How many you have taken so far this run (shown on the card); the healing berry is not a stack.
        owned: s.id === 'heal' ? null : (pl.statsTaken[s.id] || 0), cap: s.max || 0,
        apply: p => { s.apply(p); p.statsTaken[s.id] = (p.statsTaken[s.id] || 0) + 1; }
      });
    }

    return out;
  }

  /** Returns 3 distinct cards, chosen by weight. */
  function offer(pl, n = 3) {
    const pool = candidates(pl);
    const picked = [];
    const used = new Set();
    // If an evolution is ready, its golden card always comes up.
    const evo = pool.findIndex(c => c.type === 'evo');
    if (evo >= 0) { const c = pool.splice(evo, 1)[0]; used.add(c.key); picked.push(c); }

    while (picked.length < n && pool.length) {
      const total = pool.reduce((a, c) => a + c.w, 0);
      let r = Math.random() * total, idx = 0;
      for (let i = 0; i < pool.length; i++) { r -= pool[i].w; if (r <= 0) { idx = i; break; } }
      const c = pool.splice(idx, 1)[0];
      if (used.has(c.key)) continue;
      used.add(c.key);
      picked.push(c);
    }
    return picked;
  }

  return { offer, STATS };
})();
