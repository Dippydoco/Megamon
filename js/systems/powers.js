/* ============ powers.js — Gigantamax and Z-Moves (Eternamax Eternatus's reward) ============
 * Beating Eternamax Eternatus at minute 15 (systems/rift.js) lets each player pick ONE power for the rest of the
 * run (game.js offerItem with { power }):
 *   gmax   Gigantamax: grow huge for GMAX_DUR seconds. You take half damage, heal 30%, your moves hit 30% harder
 *          and 30% wider, and you crush the foes and breakable scenery you touch.
 *   zmove  Z-Move: a huge attack of your Pokémon's main type (Inferno Overdrive, Hydro Vortex...) that hits every
 *          foe on screen. Bosses, rift legendaries and Arceus's legendaries take half.
 * Press G (or tap the power's button on the HUD) when it's charged. Both start charged.
 *
 * Each power is a hidden "move" (registered in G.Moves.BY_ID only, never in G.Moves.ALL, so it is never offered,
 * listed in the Codex or tested in the lab). That way it goes through the normal cast (G.Combat.fireNow): the cast
 * animation, the run log's damage by move, and co-op, where teammates replay it (ghostCast) to see it.
 * The player keeps it in pl.gimmick (a move instance); pl.gmaxT is the time left as a giant.
 */
G.Powers = (() => {
  const GMAX_DUR = 12, GMAX_SCALE = 2, GMAX_DMG = 1.3, GMAX_AREA = 1.3, GMAX_TAKEN = 0.5, GMAX_HEAL = 0.3;
  const BOSS_K = 0.5;           // Z-Moves on bosses, rift legendaries and Arceus's legendaries
  const GROW = 0.5;             // seconds to grow and to shrink back

  // The Z-Move of each type (the games' names).
  const Z = {
    normal: 'Breakneck Blitz', fighting: 'All-Out Pummeling', flying: 'Supersonic Skystrike', poison: 'Acid Downpour',
    ground: 'Tectonic Rage', rock: 'Continental Crush', bug: 'Savage Spin-Out', ghost: 'Never-Ending Nightmare',
    steel: 'Corkscrew Crash', fire: 'Inferno Overdrive', water: 'Hydro Vortex', grass: 'Bloom Doom',
    electric: 'Gigavolt Havoc', psychic: 'Shattered Psyche', ice: 'Subzero Slammer', dragon: 'Devastating Drake',
    dark: 'Black Hole Eclipse', fairy: 'Twinkle Tackle'
  };
  const KINDS = {
    gmax: { name: 'Gigantamax', icon: 'gmax', cd: 60,
            desc: () => `Grow huge for ${GMAX_DUR} s: take half damage, heal 30%, your moves hit 30% harder and wider, and you crush the foes you touch. Recharges in 60 s.` },
    zmove: { name: 'Z-Move', icon: 'zmove', cd: 45,
             desc: pl => `Unleash ${zName(pl)}, a huge ${typeName(pl)}-type attack that hits every foe on screen (bosses take half). Recharges in 45 s.` }
  };
  const mainType = pl => (pl && pl.mon && pl.mon.types[0]) || 'normal';
  const zName = pl => Z[mainType(pl)] || Z.normal;
  const typeName = pl => (G.U.TYPE_NAME && G.U.TYPE_NAME[mainType(pl)]) || mainType(pl);

  // ---- the hidden moves ----
  for (const type in Z) {
    G.Moves.BY_ID['z-' + type] = { id: 'z-' + type, name: Z[type], type, kind: 'zmove', cat: null, cd: KINDS.zmove.cd,
                                   dmg: 650, radius: 760, knock: 260, ups: [], maxLvl: 1, power: 'zmove',
                                   desc: 'Z-Move: hits every foe on screen.' };
  }
  G.Moves.BY_ID['g-max'] = { id: 'g-max', name: 'Gigantamax', type: 'normal', kind: 'gmax', cat: null, cd: KINDS.gmax.cd,
                             dmg: 30, dur: GMAX_DUR, ups: [], maxLvl: 1, power: 'gmax', desc: 'Gigantamax: grow huge for a while.' };

  /** You chose a power (game.js): it starts charged. */
  function grant(pl, kind) {
    if (!pl || !KINDS[kind]) return;
    const m = G.Moves.instance(kind === 'gmax' ? 'g-max' : 'z-' + (Z[mainType(pl)] ? mainType(pl) : 'normal'), 1);
    m.t = 0;
    pl.gimmick = m;
    pl.gmaxT = 0;
    G.Spawner.say(KINDS[kind].name + ' is yours! Press G (or tap its button) when it glows', 3.6, true);
    G.Audio.sfx('confirm');
  }

  /** G key / the HUD button: use it if it's charged. */
  function fire(pl) {
    const m = pl && pl.gimmick;
    if (!m || pl.dead || G.Game.state !== 'playing') return false;
    if (m.t > 0) { G.FX.dmgText(pl.x, pl.y - pl.bodyH - 8, m.name + ': ' + Math.ceil(m.t) + ' s', '#c8d4ea'); return false; }
    if (pl.gmaxT > 0) return false;
    if (!G.Combat.fireNow(pl, m)) return false;
    m.t = m.cd;                       // (a fixed recharge: Reflexes and Quick Claw don't shorten it)
    return true;
  }

  /** Every frame, your own player (game.js): recharging, and the giant's timer and crushing. */
  let crushT = 0;
  function tick(pl, dt) {
    const m = pl && pl.gimmick;
    if (!m) return;
    if (m.t > 0 && !pl.dead) m.t = Math.max(0, m.t - dt);
    if (!(pl.gmaxT > 0)) return;
    pl.gmaxT = pl.dead ? 0 : Math.max(0, pl.gmaxT - dt);
    if ((crushT -= dt) > 0 || giantK(pl) < 0.6) return;
    crushT = 0.25;
    const R = pl.r * GMAX_SCALE + 26, col = G.U.TYPE_COLOR[mainType(pl)] || '#ff4a5e';
    for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, R + 40)) {
      if (e.dead || G.U.dist(pl.x, pl.y, e.x, e.y) > R + e.r) continue;
      const big = e.boss || e.legend || e.judge;
      G.Combat.strike(pl, e, m.dmg * pl.pow(m), col, e.x - pl.x, e.y - pl.y, big ? 0 : 240, m);
    }
    for (const p of G.World.propsInCircle(pl.x, pl.y, R)) if (p.destructible) G.World.damageProp(p, 9999, col);
  }

  /** 0..1: how grown the giant is (for drawing, and so it only crushes once it's big). Teammates use gmaxUntil. */
  function giantK(pl) {
    let left, dur;
    if (pl.gmaxT > 0) { left = pl.gmaxT; dur = pl.gmaxDur || GMAX_DUR; }
    else if (pl.gmaxUntil > performance.now()) { left = (pl.gmaxUntil - performance.now()) / 1000; dur = pl.gmaxDur || GMAX_DUR; }
    else return 0;
    return Math.max(0, Math.min(1, (dur - left) / GROW, left / GROW));
  }
  const giant = pl => !!pl && (pl.gmaxT > 0 || pl.gmaxUntil > performance.now());

  /** Combat: the cast itself (also on teammates' screens, with `ghost`: the look only). */
  function cast(pl, m, ghost) {
    const col = G.U.TYPE_COLOR[m.type] || '#ff4a5e';
    if (m.kind === 'gmax') {
      pl.gmaxDur = m.dur || GMAX_DUR;
      if (ghost) pl.gmaxUntil = performance.now() + pl.gmaxDur * 1000;
      else { pl.gmaxT = pl.gmaxDur; pl.heal(pl.maxHp * GMAX_HEAL); pl.invuln = Math.max(pl.invuln || 0, GROW + 0.3); }
      G.FX.ring(pl.x, pl.y, pl.r, pl.r * 9, '#ff3b5c', 0.7, 6);
      G.FX.ring(pl.x, pl.y, pl.r, pl.r * 6, '#ffb3c1', 0.5, 4);
      G.FX.burst(pl.x, pl.y - pl.bodyH, '#ff3b5c', 40, 260);
      G.FX.dmgText(pl.x, pl.y - pl.bodyH * 2 - 10, 'GIGANTAMAX!', '#ff6b81', true);
      if (G.Camera.sees(pl.x, pl.y, 60)) { G.Audio.sfx('boss'); G.Camera.kick(ghost ? 0.3 : 0.9); }
      if (!ghost) G.Game.flash('#ff5c7a', 0.45);
      return;
    }
    // Z-Move: a wave across the whole screen.
    G.FX.dmgText(pl.x, pl.y - pl.bodyH - 18, m.name.toUpperCase() + '!', col, true);
    for (let i = 0; i < 4; i++) G.FX.ring(pl.x, pl.y, 10 + i * 30, m.radius * (0.55 + i * 0.15), i % 2 ? '#ffffff' : col, 0.55 + i * 0.12, 8 - i);
    G.FX.burst(pl.x, pl.y - pl.bodyH * 0.5, col, 60, 420);
    G.FX.burst(pl.x, pl.y - pl.bodyH * 0.5, '#fff6c8', 30, 300);
    if (G.Camera.sees(pl.x, pl.y, 200)) { G.Audio.sfx('legend'); G.Camera.kick(ghost ? 0.4 : 1.2); }
    if (ghost) return;
    G.Game.flash(col, 0.6);
    for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, m.radius)) {
      if (e.dead) continue;
      const big = e.boss || e.legend || e.judge;
      G.Combat.strike(pl, e, m.dmg * pl.pow(m) * (big ? BOSS_K : 1), col, e.x - pl.x, e.y - pl.y, big ? 0 : m.knock, m);
    }
    for (const p of G.World.propsInCircle(pl.x, pl.y, m.radius)) if (p.destructible) G.World.damageProp(p, m.dmg * pl.pow(m), col);
  }

  /** The choice cards (ui/run-ui.js showPowers). */
  const info = (kind, pl) => ({ name: kind === 'zmove' ? 'Z-Move: ' + zName(pl) : KINDS[kind].name, icon: KINDS[kind].icon, desc: KINDS[kind].desc(pl) });

  return { KINDS, GMAX_SCALE, GMAX_DMG, GMAX_AREA, GMAX_TAKEN, grant, fire, tick, cast, giant, giantK, info, zName };
})();
