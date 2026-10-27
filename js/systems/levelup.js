/* ============ levelup.js — the three level-up cards ============
 * Card kinds:
 *   new   learn a new move (only if there are free slots out of 4; a bond frees slots)
 *   up    upgrade a move you already have
 *   stat  a perk: a permanent upgrade for the run, with levels
 *
 * Perks (27-10-2026, like Megabonk's tomes): you can hold up to `pl.maxTomes` (4) different perks. Once the slots
 * are full, only the perks you already have keep coming up (until they reach their cap). Every perk has a cap.
 * The Sitrus Berry is not a perk: it heals at once and never takes a slot. A perk's level is pl.statsTaken[id];
 * the perks you hold are its keys, in the order you took them (tomesOf).
 */
G.LevelUp = (() => {

  // Linear stacking for multipliers shared with other systems: level n gives exactly (1 + k·n), however it was reached.
  const lin = (k, n) => (1 + k * (n + 1)) / (1 + k * n);
  const lvOf = (pl, id) => (pl && pl.statsTaken && pl.statsTaken[id]) || 0;

  // Caps raised on 27-10-2026 (perks can be held in only 4 slots now, so each one goes deeper); Vigor and
  // Synthesis got caps for the first time. Armor: +5% a level up to its 70% cap (it was +6%, cap reached at 12).
  const STATS = [
    { id: 'hp',   icon: 'heart', title: 'Vigor',        desc: '+20 max HP (and heals it).',
      apply: pl => pl.addMaxHp(20), max: 12 },
    { id: 'atk',  icon: 'fist', title: 'Power',     desc: '+10% damage with every move.',
      apply: pl => pl.atkMul *= 1.10, max: 50 },
    { id: 'spd',  icon: 'boot', title: 'Sprint',      desc: '+7% movement speed.',
      apply: pl => pl.spdMul *= 1.07, max: 12 },
    { id: 'cd',   icon: 'clock', title: 'Reflexes',     desc: '-8% cooldown on every move.',
      apply: pl => pl.cdMul *= 0.92, max: 13 },
    { id: 'def',  icon: 'shield', title: 'Armor',       desc: '+5% damage reduction.',
      apply: pl => pl.dmgReduce = Math.min(0.7, pl.dmgReduce + 0.05), max: 14 },
    { id: 'rgn',  icon: 'sprout', title: 'Synthesis',     desc: '+0.9 HP regenerated per second.',
      apply: pl => pl.regenFlat += 0.9, max: 15 },
    { id: 'mag',  icon: 'magnet', title: 'Magnet',         desc: '+30% experience pickup radius.',
      apply: pl => pl.magnet *= 1.30, max: 10 },
    { id: 'xp',   icon: 'book', title: 'Learning',  desc: '+12% experience gained.',
      apply: pl => pl.xpMul *= 1.12, max: 12 },
    { id: 'area', icon: 'reach', title: 'Reach',      desc: '+10% size of every area attack.',
      apply: pl => pl.areaMul *= 1.10, max: 10 },
    { id: 'crit', icon: 'focus', title: 'Focus',      desc: '+4% critical-hit chance (critical hits do ×1.5 damage).',
      apply: pl => pl.critChance += 0.04, max: 10 },
    // Farming perks (27-10-2026). Pay Day is read at the end of the run (game.js endRun, coinK); Shiny Lure by the
    // spawner (shinyK: the team's average in a group, since the host rolls every shiny).
    { id: 'coin', icon: 'coin', title: 'Pay Day', desc: '+12% PokéCoins from this run.',
      apply: () => {}, max: 10 },
    { id: 'shiny', icon: 'shiny', title: 'Shiny Lure', desc: '+30% chance for wild Pokémon to be shiny.',
      apply: () => {}, max: 10 },
    // Difficulty: more and tougher wild Pokémon for everyone (the team's average in a group), more experience and
    // PokéCoins for you. Not in the Battle Tower, whose floors set their own numbers.
    { id: 'roar', icon: 'flag', title: 'Roar', desc: 'Harder run: +10% wild Pokémon, +8% their health, +5% their damage. You get +8% experience and +8% PokéCoins.',
      apply: (pl, n = lvOf(pl, 'roar')) => { pl.xpMul *= lin(0.08, n); }, max: 10 },
    { id: 'heal', icon: 'berry', title: 'Sitrus Berry',   desc: 'Restores 45% of your HP right now.',
      apply: pl => pl.healItem(0.45), instant: true }
  ];
  const BY = {};
  for (const s of STATS) BY[s.id] = s;

  /** The perks a player holds, in the order taken: [id...] (the Sitrus Berry is not one). */
  function tomesOf(pl) {
    const st = (pl && pl.statsTaken) || {};
    return Object.keys(st).filter(k => st[k] > 0 && BY[k] && !BY[k].instant);
  }
  const maxTomes = pl => (pl && pl.maxTomes) || 4;

  // ---- what perks do outside the player (read every frame by the spawner: cached briefly) ----
  /** A teammate's perk levels: yours from the run, theirs from their shared state ("id.lvl,id.lvl"). */
  function levelsOf(p) {
    if (!p.remote) return p.statsTaken || {};
    const out = {}, s = (p.net && p.net.tm) || '';
    for (const part of s.split(',')) { const [id, n] = part.split('.'); if (id) out[id] = +n || 0; }
    return out;
  }
  let fxT = -1, fx = null;
  function teamFx() {
    const now = performance.now();
    if (fx && now - fxT < 400) return fx;
    fxT = now;
    const ps = G.Game && G.Game.everyone ? G.Game.everyone().filter(Boolean) : [];
    let roar = 0, shiny = 0;
    for (const p of ps) { const l = levelsOf(p); roar += l.roar || 0; shiny += l.shiny || 0; }
    const n = Math.max(1, ps.length), r = roar / n;
    fx = { rate: 1 + 0.10 * r, cap: 1 + 0.06 * r, hp: 1 + 0.08 * r, dmg: 1 + 0.05 * r, shiny: 1 + 0.30 * shiny / n };
    return fx;
  }
  const inTower = () => !!(G.Tower && G.Tower.active);
  /** Roar (spawner.js): enemies per second, field cap, wild Pokémon health and damage. */
  const roarRate = () => (inTower() ? 1 : teamFx().rate);
  const roarCap = () => (inTower() ? 1 : teamFx().cap);
  const roarHp = () => (inTower() ? 1 : teamFx().hp);
  const roarDmg = () => (inTower() ? 1 : teamFx().dmg);
  /** Shiny Lure (spawner.js rollShiny). */
  const shinyK = () => teamFx().shiny;
  /** Your PokéCoins at the end of the run (game.js endRun): Pay Day and Roar. */
  const coinK = pl => 1 + 0.12 * lvOf(pl, 'coin') + 0.08 * lvOf(pl, 'roar');
  /** Short form of your perks for teammates ("atk.5,cd.3"). */
  const share = pl => tomesOf(pl).map(id => id + '.' + lvOf(pl, id)).join(',');

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
    // Perk slots: a perk you don't hold yet only comes up while a slot is free (the berry never takes one).
    const held = tomesOf(pl), full = held.length >= maxTomes(pl);
    const fits = s => s.instant || held.includes(s.id) || !full;
    // (Battle Tower: no experience there, so no Learning card, and no Roar: the floors set their own difficulty.)
    const useful = s => !((s.id === 'xp' || s.id === 'roar') && inTower());
    const pickStats = G.U.pickN(STATS.filter(s => !waiting[s.id] && room(s) && fits(s) && useful(s)), 5)
      .concat(STATS.filter(s => waiting[s.id] && fits(s) && useful(s)));
    for (const s of pickStats) {
      const evoFor = waiting[s.id], have = held.includes(s.id);
      out.push({
        w: evoFor ? 14 : pl.slots.length < pl.maxMoves ? 4 : 7,
        type: 'stat', key: 'stat:' + s.id,
        icon: s.icon, color: evoFor ? '#ffd23f' : '#8fa3c4',
        tag: evoFor ? 'Evolves ' + evoFor.name : s.instant ? 'Instant' : have ? 'Perk' : 'New perk · slot ' + (held.length + 1) + '/' + maxTomes(pl),
        title: s.title, desc: s.desc,
        // How many you have taken so far this run (shown on the card); the healing berry is not a stack.
        owned: s.instant ? null : (pl.statsTaken[s.id] || 0), cap: s.max || 0,
        apply: p => { const n = p.statsTaken[s.id] || 0; s.apply(p, n); p.statsTaken[s.id] = n + 1; fxT = -1; }
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

  return { offer, STATS, BY, tomesOf, maxTomes, share, roarRate, roarCap, roarHp, roarDmg, shinyK, coinK };
})();
