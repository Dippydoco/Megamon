/* ============ combat.js — running moves and collisions ============
 * Only the player's ACTIVE move runs. Each `kind` has its
 * implementation here. Every attack also damages the scenery's destructible
 * objects (rocks, chests, tall grass).
 *
 * Everything happens on the ground plane: (x, y) are feet / shadow.
 *
 * Co-op: each computer runs ITS player's attacks. Teammates'
 * arrive over the network and are replayed as a "ghost" (ghostCast): they
 * look the same, but do no damage here (their owner already did it).
 *
 * Whatever stays on the map for a while (mines, falling meteors, turrets,
 * trail puddles) lives in `fields` and is updated/drawn here.
 */
G.Combat = (() => {
  let ghost = false;
  let fields = [];

  // ---------------- run the active move ----------------

  function tick(dt, pl, now) {
    if (pl.dead) return;
    // Bonds: every move in the active slot, each with its own cooldown.
    const group = pl.activeGroup();
    // Dig only hides you: the moves bonded with it keep attacking (it used to freeze the whole group).
    for (const m of group) { tickMove(dt, pl, m, now); G.RunLog.active(pl, m.id, dt); }
    // Burst moves charge in the background too (the rest only charge while active).
    // When one is ready it chimes and its slot glows, so you know it's time to switch to it.
    for (const m of pl.moves) {
      if (m.kind !== 'burst' || group.includes(m) || m.t <= 0) continue;
      m.t -= dt;
      if (m.t <= 0) { m.t = 0; m.readyAt = performance.now(); if (pl === G.Game.player) G.Audio.sfx('ready'); }
    }
  }

  function tickMove(dt, pl, m, now) {
    if (m.kind === 'orbit' || m.kind === 'spin') { orbit(pl, m, dt, now); return; }
    if (m.kind === 'roll') { roll(pl, m, dt); return; }
    if (m.kind === 'counter') { counter(pl, m, dt); return; }

    m.t -= dt;
    if (m.t > 0) return;
    // Attacks that need a target wait until they have one (don't waste the animation on thin air).
    // In a bond the shared target (a far boss, a chest) can be out of a short move's reach while foes crowd
    // you: then that move picks the nearest foe inside its own reach instead of sitting idle.
    let alt = null;
    if (needsTarget(m)) {
      const R = reach(sized(pl, m));
      if (!(pl.target && G.U.dist(pl.x, pl.y, pl.target.x, pl.target.y) <= R)) {
        alt = G.Projectiles.nearest(G.EnemyMgr.all(), pl.x, pl.y, R);
        if (!alt) { m.t = 0.05; return; }
      }
    }
    m.t = Math.max(0.05, m.cd * pl.cdMul);
    const aim0 = pl.aim;
    if (alt) pl.aim = Math.atan2(alt.y - pl.y, alt.x - pl.x);
    pl.cast(m);
    G.RunLog.cast(pl, m.id);
    if (G.Coop.active) G.Coop.cast(pl, m);
    // Bond: its icon flashes on the HUD when cast (one that bursts right next to the
    // enemy, like Ember after Quick Attack, can hardly be seen).
    m.castAt = performance.now();

    run(pl, m);
    if (alt) pl.aim = aim0;
  }

  // Reach (level-up): kinds whose `radius` is an AREA (not a range) and grows with it.
  // Beams and dashes grow in width instead; projectiles, cones, chains and boomerangs don't change.
  const AREA_R = ['melee', 'aura', 'orbit', 'mine', 'meteor', 'trail', 'turret'];

  /** The move as this player casts it: same object, with area sizes scaled by Reach. */
  function sized(pl, m) {
    const A = pl.areaMul || 1;
    if (A === 1) return m;
    const s = Object.create(m);
    if (AREA_R.includes(m.kind) && m.radius) s.radius = m.radius * A;
    if (m.kind === 'beam' || m.kind === 'dash') s.width = (m.width || 34) * A;
    // Bursts: Hyper Beam grows in width; the rest (blast, wave, meteors, shield push) in radius.
    if (m.kind === 'burst') { if (m.width) s.width = m.width * A; else if (m.radius) s.radius = m.radius * A; }
    return s;
  }

  function run(pl, m) {
    m = sized(pl, m);
    // Ancient Power: each cast has a chance to raise your damage for a while ([chance, +damage, seconds, max stacks]).
    if (m.surge && !ghost && Math.random() < m.surge[0]) {
      pl.addBuff('surge', m.surge[1], m.surge[2], m.surge[3]);
      G.FX.dmgText(pl.x, pl.y - pl.bodyH - 8, 'Power up!', '#c6b08a');
    }
    switch (m.kind) {
      case 'projectile': fireProjectiles(pl, m); break;
      case 'melee':      melee(pl, m); break;
      case 'beam':       beam(pl, m); break;
      case 'nova':       nova(pl, m); break;
      case 'aura':       aura(pl, m); break;
      case 'buff':       buff(pl, m); break;
      case 'boomerang':  boomerang(pl, m); break;
      case 'chain':      chain(pl, m); break;
      case 'mine':       mines(pl, m); break;
      case 'meteor':     meteors(pl, m); break;
      case 'turret':     turret(pl, m); break;
      case 'dash':       dash(pl, m); break;
      case 'trail':      trailPatch(pl, m); break;
      case 'cone':       cone(pl, m); break;
      case 'burst':      burst(pl, m); break;
      case 'charge':     charge(pl, m); break;
      case 'ricochet':   ricochet(pl, m); break;
      case 'cage':       cage(pl, m); break;
      case 'wall':       wall(pl, m); break;
      case 'burrow':     burrow(pl, m); break;
      case 'swarm':      swarm(pl, m); break;
      case 'throw':      toss(pl, m); break;
      case 'roll':       rollFx(pl, m); break;          // (teammates' copies: just the look)
      case 'counter':    counterFx(pl, m); break;
    }
  }

  const TARGETED = ['melee', 'beam', 'projectile', 'boomerang', 'chain', 'meteor', 'dash', 'cone', 'charge', 'ricochet', 'cage', 'burrow', 'throw'];
  function needsTarget(m) { return TARGETED.includes(m.kind); }
  function reach(m) {
    if (m.kind === 'melee') return m.radius + 40;      // melee starts swinging a little earlier (it used to wait until foes were on top of you)
    if (m.kind === 'beam') return m.radius + 20;
    if (m.kind === 'boomerang') return m.radius + 40;
    if (m.kind === 'chain') return 280;
    if (m.kind === 'meteor') return 340;
    if (m.kind === 'dash') return m.radius + 60;
    if (m.kind === 'cone') return m.speed * m.life + 30;
    if (m.kind === 'charge') return m.radius + 20;
    if (m.kind === 'ricochet') return 420;
    if (m.kind === 'cage') return 320;
    if (m.kind === 'burrow') return m.range || 260;
    if (m.kind === 'throw') return m.radius + 30;
    return 520;
  }

  function payload(m) {
    return { burn: m.burn || 0, poison: m.poison || 0, slow: m.slow || 0, knock: m.knock || 0, mtype: m.type, fx: m.fx || null, mid: m.id };
  }

  /** Type chart × weather for an attack of type `type` against `e`. */
  function typeK(type, e) { return G.Types.mult(type, e.types) * G.Weather.mult(type); }

  function fireProjectiles(pl, m) {
    const col = G.U.TYPE_COLOR[m.type];
    const vis = G.VFX.forMove(m);
    const n = Math.max(1, m.count | 0);
    const spread = m.spread || 0;
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : (i / (n - 1) - 0.5) * spread * n;
      const a = pl.aim + off + G.U.rand(-0.03, 0.03);
      G.Projectiles.spawn(Object.assign({
        x: pl.x + Math.cos(a) * 3, y: pl.y + Math.sin(a) * 3,
        vx: Math.cos(a) * m.speed, vy: Math.sin(a) * m.speed,
        dmg: m.dmg * pl.pow(m), r: m.size, life: m.life,
        pierce: m.pierce | 0, color: col, homing: m.homing || 0,
        hits: new Set(), vis, ghost, owner: pl
      }, payload(m)));
    }
    G.FX.spark(pl.x + Math.cos(pl.aim) * pl.r, pl.y - G.LIFT + Math.sin(pl.aim) * pl.r,
               col, Math.cos(pl.aim), Math.sin(pl.aim), 3);
  }

  function nova(pl, m) {
    const col = G.U.TYPE_COLOR[m.type];
    const vis = G.VFX.forMove(m);
    const n = Math.max(3, m.count | 0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.2832 + G.U.rand(-0.06, 0.06);
      G.Projectiles.spawn(Object.assign({
        x: pl.x + Math.cos(a) * 3, y: pl.y + Math.sin(a) * 3,
        vx: Math.cos(a) * m.speed, vy: Math.sin(a) * m.speed,
        dmg: m.dmg * pl.pow(m), r: m.size, life: m.life,
        pierce: m.pierce | 0, color: col, homing: m.homing || 0,
        hits: new Set(), vis, ghost, owner: pl
      }, payload(m)));
    }
    G.FX.ring(pl.x, pl.y, pl.r, pl.r * 4, col, 0.3, 3);
  }

  function inArc(px, py, x, y, aim, half) {
    const a = Math.atan2(y - py, x - px);
    return Math.abs(((a - aim + Math.PI * 3) % 6.2832) - Math.PI) <= half;
  }

  function melee(pl, m) {
    const col = G.U.TYPE_COLOR[m.type];
    const half = Math.min(m.arc, 6.2832) / 2;
    G.FX.slash(pl.x, pl.y - G.LIFT * 0.5, pl.aim, m.radius, m.arc, col, G.VFX.forMove(m));
    if (ghost) return;

    for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, m.radius + 30)) {      // (+30: the foe's body counts, not just its centre)
      if (!inArc(pl.x, pl.y, e.x, e.y, pl.aim, half)) continue;
      hit(pl, e, m.dmg * pl.pow(m), col, e.x - pl.x, e.y - pl.y, m.knock || 0, m);
    }
    for (const p of G.World.propsInCircle(pl.x, pl.y, m.radius)) {
      if (inArc(pl.x, pl.y, p.x, p.y, pl.aim, half)) G.World.damageProp(p, m.dmg * pl.pow(m), col);
    }
  }

  function beam(pl, m) {
    const col = G.U.TYPE_COLOR[m.type];
    const w = m.width;
    const ca = Math.cos(pl.aim), sa = Math.sin(pl.aim);

    // The beam stops at the first wall.
    let len = m.radius;
    for (let d = 8; d < m.radius; d += 8) {
      if (G.World.isWall(pl.x + ca * d, pl.y + sa * d)) { len = d; break; }
    }
    G.FX.beam(pl.x, pl.y - G.LIFT, pl.aim, len, w, col, G.VFX.forMove(m));
    if (ghost) return;
    G.Camera.kick(0.08);

    const mx = pl.x + ca * len / 2, my = pl.y + sa * len / 2;
    const onBeam = (x, y, r) => {
      const px = x - pl.x, py = y - pl.y;
      const along = px * ca + py * sa;
      if (along < -r || along > len + r) return false;
      return Math.abs(-px * sa + py * ca) <= w / 2 + r;
    };
    for (const e of G.EnemyMgr.queryCircle(mx, my, len / 2 + w)) {
      if (onBeam(e.x, e.y, e.r)) hit(pl, e, m.dmg * pl.pow(m), col, ca, sa, 0, m);
    }
    for (const p of G.World.propsInCircle(mx, my, len / 2 + w)) {
      if (onBeam(p.x, p.y, p.r)) G.World.damageProp(p, m.dmg * pl.pow(m), col);
    }
  }

  function aura(pl, m) {
    const col = G.U.TYPE_COLOR[m.type];
    G.FX.ring(pl.x, pl.y, m.radius * 0.5, m.radius, col, 0.28, 2);
    const vis = G.VFX.forMove(m);
    if (vis.aura) {
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * 6.2832, r = m.radius * G.U.rand(0.45, 1);
        const x = pl.x + Math.cos(a) * r, y = pl.y + Math.sin(a) * r * 0.8 - G.LIFT * 0.5;
        // Grass Knot pulls towards you; poison and shadows rise; the rest spin.
        const v = vis.inward ? [-Math.cos(a) * r * 2.2, -Math.sin(a) * r * 1.8]
                : vis.rise ? [G.U.rand(-10, 10), -55]
                : [-Math.sin(a) * 70, Math.cos(a) * 55];
        G.FX.sp(vis.aura, vis.pal, x, y, { vx: v[0], vy: v[1], life: 0.42,
          spin: G.VFX.spins(vis.aura) ? G.U.rand(-6, 6) : 0 });
      }
    }
    if (ghost) return;
    let healed = 0;
    for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, m.radius)) {
      hit(pl, e, m.dmg * pl.pow(m), col, e.x - pl.x, e.y - pl.y, 0, m);
      if (m.drain) healed += m.drain;
    }
    for (const p of G.World.propsInCircle(pl.x, pl.y, m.radius)) G.World.damageProp(p, m.dmg * pl.pow(m), col);
    if (healed > 0) pl.heal(Math.min(healed, 6));
  }

  function buff(pl, m) {
    pl.addBuff(m.stat, m.amount, m.dur, m.stacks | 0);
    const col = G.U.TYPE_COLOR[m.type];
    G.FX.ring(pl.x, pl.y, pl.r * 2.4, pl.r * 1.1, col, 0.35, 2.5);
    const vis = G.VFX.forMove(m);
    for (let i = 0; i < 3; i++) {
      G.FX.sp(vis.buff || 'arrow', vis.pal, pl.x + G.U.rand(-pl.r * 1.4, pl.r * 1.4),
              pl.y - G.U.rand(0, pl.bodyH * 0.8), { vy: -70, life: 0.6 });
    }
  }

  // ---------------- familias nuevas (2026-10-10) ----------------

  /** Boomerang: goes out to the enemy, stops and comes back to you, hitting on the way out and back. */
  function boomerang(pl, m) {
    const col = G.U.TYPE_COLOR[m.type], vis = G.VFX.forMove(m);
    const n = Math.max(1, m.count | 0), spread = m.spread || 0.5;
    const out = m.radius / m.speed;                       // seconds on the way out
    for (let i = 0; i < n; i++) {
      const a = pl.aim + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread * Math.min(n, 3));
      G.Projectiles.spawn(Object.assign({
        x: pl.x, y: pl.y, vx: Math.cos(a) * m.speed, vy: Math.sin(a) * m.speed,
        dmg: m.dmg * pl.pow(m), r: m.size, life: out * 4 + 1.5, pierce: 999, color: col,
        hits: new Set(), vis, ghost, owner: pl, boom: out, bsp: m.speed * 1.1
      }, payload(m)));
    }
  }

  /** Chain: hits an enemy and jumps to the next nearest ones (each jump, a little less). */
  function chain(pl, m) {
    const col = G.U.TYPE_COLOR[m.type], vis = G.VFX.forMove(m);
    let cur = pl.target && !pl.target.dead && pl.target.hurt ? pl.target : G.Projectiles.nearest(G.EnemyMgr.all(), pl.x, pl.y, reach(m));
    if (!cur) return;
    let fx = pl.x, fy = pl.y - G.LIFT, k = 1;
    const done = new Set();
    const n = Math.max(1, m.count | 0);
    for (let i = 0; i < n && cur; i++) {
      done.add(cur.id);
      const tx = cur.x, ty = cur.y - cur.bodyH * 0.5;
      G.FX.beam(fx, fy, Math.atan2(ty - fy, tx - fx), Math.hypot(tx - fx, ty - fy), 10, col, vis);
      if (!ghost) {
        // Hex: more damage to anyone already suffering a status.
        const hex = m.hex && (cur.burn > 0 || cur.poison > 0 || cur.slow > 0) ? m.hex : 1;
        hit(pl, cur, m.dmg * pl.pow(m) * k * hex, col, tx - fx, ty - fy, 0, m);
      }
      k *= 0.85;
      fx = tx; fy = ty;
      let best = null, bd = m.radius * m.radius;
      for (const e of G.EnemyMgr.queryCircle(cur.x, cur.y, m.radius)) {
        if (done.has(e.id)) continue;
        const d = G.U.dist2(cur.x, cur.y, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      }
      cur = best;
    }
    if (!ghost) G.Camera.kick(0.05);
  }

  /** Mines: stay on the ground and burst when an enemy steps on them. */
  function mines(pl, m) {
    const col = G.U.TYPE_COLOR[m.type], vis = G.VFX.forMove(m);
    const n = Math.max(1, m.count | 0);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.2832, d = n === 1 ? 0 : G.U.rand(18, 46);
      fields.push({ kind: 'mine', owner: pl, ghost, m, col, vis, x: pl.x + Math.cos(a) * d, y: pl.y + Math.sin(a) * d * 0.8,
                    t: 0, arm: 0.35, life: m.dur || 7, r: m.radius, dmg: m.dmg * pl.pow(m) });
    }
    // Only a few per player at most: the oldest ones go.
    const mine = fields.filter(f => f.kind === 'mine' && f.owner === pl);
    for (const f of mine.slice(0, Math.max(0, mine.length - (4 + n * 2)))) f.gone = true;
  }

  /** Meteors: fall from the sky on nearby enemies (the shadow warns where). */
  function meteors(pl, m) {
    const col = G.U.TYPE_COLOR[m.type], vis = G.VFX.forMove(m);
    const n = Math.max(1, m.count | 0);
    const near = G.EnemyMgr.queryCircle(pl.x, pl.y, reach(m)).filter(e => !e.dead);
    G.U.shuffle ? G.U.shuffle(near) : near.sort(() => Math.random() - 0.5);
    for (let i = 0; i < n; i++) {
      const e = near[i];
      const x = e ? e.x + G.U.rand(-8, 8) : pl.x + G.U.rand(-140, 140);
      const y = e ? e.y + G.U.rand(-6, 6) : pl.y + G.U.rand(-110, 110);
      fields.push({ kind: 'meteor', owner: pl, ghost, m, col, vis, x, y, t: -i * 0.09, fall: 0.5, r: m.radius, dmg: m.dmg * pl.pow(m) });
    }
  }

  /** Turret: leaves something on the ground that shoots on its own for a while. */
  function turret(pl, m) {
    const col = G.U.TYPE_COLOR[m.type], vis = G.VFX.forMove(m);
    const a = pl.aim + Math.PI + G.U.rand(-0.6, 0.6);
    fields.push({ kind: 'turret', owner: pl, ghost, m, col, vis, x: pl.x + Math.cos(a) * 26, y: pl.y + Math.sin(a) * 20,
                  t: 0, life: m.dur || 6, shotT: 0.3, dmg: m.dmg * pl.pow(m),
                  hp: m.hp || 0, maxHp: m.hp || 0, hitCd: 0, hurtT: 0 });
    const mine = fields.filter(f => f.kind === 'turret' && f.owner === pl && !f.gone);
    for (const f of mine.slice(0, Math.max(0, mine.length - Math.max(1, m.count | 0)))) f.gone = true;
    G.FX.ring(pl.x, pl.y, 4, 30, col, 0.3, 2);
  }

  /**
   * Substitute: the decoy enemies go for. Returns it if `e` should chase it instead of the player
   * (ordinary enemies within its taunt range that are not already on top of the player).
   */
  function decoyFor(e, pl) {
    if (e.boss || e.legend || e.judge || e.behavior === 'thief' || e.behavior === 'aegis') return null;
    let best = null, bd = Infinity;
    for (const f of fields) {
      if (f.kind !== 'turret' || !f.hp || f.gone || f.t < 0.25) continue;
      if (f.ghost && !G.Coop.isHost) continue;      // a teammate's Substitute: only the host (who runs the enemies) lets it draw them
      const d = G.U.dist2(e.x, e.y, f.x, f.y), rg = f.m.taunt || 320;
      if (d < rg * rg && d < bd) { bd = d; best = f; }
    }
    if (!best) return null;
    if (pl && G.U.dist2(e.x, e.y, pl.x, pl.y) < 70 * 70) return null;      // already on you: keep hitting you
    return best;
  }

  /** The decoy as a stand-in "player" for enemy AI (position, size, no velocity). */
  function decoyTarget(f, pl) {
    const t = Object.create(pl);
    t.x = f.x; t.y = f.y; t.r = 12; t._vx = 0; t._vy = 0; t.dead = false;
    return t;
  }

  /** Enemies touching the decoy hit it; at 0 hits it breaks and explodes. */
  function decoyContacts(dt) {
    for (let i = fields.length - 1; i >= 0; i--) {
      const f = fields[i];
      if (f.kind !== 'turret' || !f.hp || f.gone) continue;
      // In co-op the host decides when any Substitute breaks (its owner is told with 'sb'): a guest's own copy never
      // counts hits, because the enemies it sees there are only copies and do not chase it.
      if (G.Coop.active && !G.Coop.isHost) continue;
      if (f.hitCd > 0) f.hitCd -= dt;
      if (f.hurtT > 0) f.hurtT -= dt;
      for (const e of G.EnemyMgr.queryCircle(f.x, f.y, 40)) {
        if (G.U.dist2(e.x, e.y, f.x, f.y) > (e.r + 12) * (e.r + 12)) continue;
        if (e.touchCd > 0 || e.freezeT > 0 || e.behavior === 'thief' || e.boss) continue;
        e.touchCd = 0.55;
        e.strike(f);
        const [nx, ny] = G.U.norm(e.x - f.x, e.y - f.y);
        e.kx += nx * 150; e.ky += ny * 150;
        if (f.hitCd > 0) continue;
        f.hitCd = 0.25; f.hurtT = 0.2; f.hp--;
        G.FX.burst(f.x, f.y - 14, '#e8dcb8', 4, 70);
        if (G.Camera.sees(f.x, f.y, 40)) G.Audio.sfx('hit');
        if (f.hp > 0 && G.Coop.isHost && f.owner && f.owner.uid) G.Coop.broadcast(['sh', f.owner.uid, f.hp]);   // so everyone's hit bar goes down
        if (f.hp <= 0) { breakDecoy(f); fields.splice(i, 1); break; }
      }
    }
  }

  function breakDecoy(f) {
    const r = f.m.radius || 70;
    G.FX.ring(f.x, f.y, 6, r, f.col, 0.4, 5);
    G.FX.burst(f.x, f.y - 12, '#e8dcb8', 18, 190);
    G.FX.burst(f.x, f.y - 12, f.col, 10, 150);
    if (G.Camera.sees(f.x, f.y, 40)) { G.Audio.sfx('break'); G.Camera.kick(0.25); }
    blast(f, r, f.m.boom || 3);
    if (G.Coop.isHost && f.owner && f.owner.uid) G.Coop.broadcast(['sb', f.owner.uid]);     // tell the owner (to explode for real) and everyone else (to drop the copy)
  }

  /** The host says this player's Substitute has `hp` hits left: everyone's copy (the owner's too) follows. */
  function netHurt(uid, hp) {
    let best = null;
    for (const f of fields) {
      if (f.kind === 'turret' && f.hp && !f.gone && f.owner && f.owner.uid === uid && (!best || f.t > best.t)) best = f;
    }
    if (!best || hp >= best.hp) return;
    best.hp = Math.max(1, hp); best.hurtT = 0.2;
    G.FX.burst(best.x, best.y - 14, '#e8dcb8', 4, 70);
  }

  /** The host says this player's Substitute broke: the owner's own copy explodes, everyone else's just disappears. */
  function netBreak(uid) {
    let best = null;
    for (const f of fields) {
      if (f.kind === 'turret' && f.hp && !f.gone && f.owner && f.owner.uid === uid && (!best || f.t > best.t)) best = f;
    }
    if (!best) return;
    fields.splice(fields.indexOf(best), 1);
    breakDecoy(best);
  }

  /** Charge: you dash like lightning at the enemy and hit everything on the way. */
  function dash(pl, m) {
    const col = G.U.TYPE_COLOR[m.type], vis = G.VFX.forMove(m);
    const ca = Math.cos(pl.aim), sa = Math.sin(pl.aim);
    const sx = pl.x, sy = pl.y;
    let len = 0;
    for (let d = 8; d <= m.radius; d += 8) {
      if (!G.World.isFree(sx + ca * d, sy + sa * d, pl.r * 0.8, true)) break;
      len = d;
    }
    // Trail: several copies of the hit along the path.
    for (let d = 0; d <= len; d += 22) G.FX.sp(vis.proj || 'streak', vis.pal, sx + ca * d, sy + sa * d - G.LIFT * 0.6, { life: 0.22, angle: pl.aim });
    G.FX.slash(sx + ca * len, sy + sa * len - G.LIFT * 0.5, pl.aim, 34, 2.2, col, vis);
    if (ghost) return;
    pl.x = sx + ca * len; pl.y = sy + sa * len;
    G.World.collide(pl);
    pl.invuln = Math.max(pl.invuln || 0, 0.3);
    if (m.guard) { pl.guardAmt = m.guard[0]; pl.guardT = m.guard[1]; }      // Psyshield Bash: less damage taken for a moment
    const w = m.width || 34;
    const mx = sx + ca * len / 2, my = sy + sa * len / 2;
    for (const e of G.EnemyMgr.queryCircle(mx, my, len / 2 + w)) {
      if (segDist2(sx, sy, pl.x, pl.y, e.x, e.y) <= (w / 2 + e.r) ** 2) hit(pl, e, m.dmg * pl.pow(m), col, ca, sa, m.knock || 0, m);
    }
    for (const p of G.World.propsInCircle(mx, my, len / 2 + w)) {
      if (segDist2(sx, sy, pl.x, pl.y, p.x, p.y) <= (w / 2 + p.r) ** 2) G.World.damageProp(p, m.dmg * pl.pow(m), col);
    }
    G.Camera.kick(0.12);
  }

  /** Trail: you leave puddles that hurt whatever passes over them. */
  function trailPatch(pl, m) {
    const col = G.U.TYPE_COLOR[m.type], vis = G.VFX.forMove(m);
    // Standing still it doesn't leave a new one on top of the last (only now and then).
    // (Only if that puddle still exists: after the fields are cleared, standing still used to block the trail for good.)
    const last = pl.lastPatch;
    if (last && fields.includes(last) && G.U.dist2(last.x, last.y, pl.x, pl.y) < (m.radius * 0.9) ** 2 && last.t < 1) return;
    const f = { kind: 'patch', owner: pl, ghost, m, col, vis, x: pl.x, y: pl.y, t: 0, life: m.dur || 3, r: m.radius,
                tick: 0, dmg: m.dmg * pl.pow(m) };
    fields.push(f);
    pl.lastPatch = f;
    const mine = fields.filter(o => o.kind === 'patch' && o.owner === pl && !o.gone);
    for (const o of mine.slice(0, Math.max(0, mine.length - 18))) o.gone = true;
  }

  /** Short fan: many quick shots that don't go far (breath, jet...). */
  function cone(pl, m) {
    const col = G.U.TYPE_COLOR[m.type], vis = G.VFX.forMove(m);
    const n = Math.max(2, m.count | 0), arc = m.arc || 0.9;
    for (let i = 0; i < n; i++) {
      const a = pl.aim + (i / (n - 1) - 0.5) * arc + G.U.rand(-0.05, 0.05);
      const sp = m.speed * G.U.rand(0.85, 1.1);
      G.Projectiles.spawn(Object.assign({
        x: pl.x + Math.cos(a) * 4, y: pl.y + Math.sin(a) * 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        dmg: m.dmg * pl.pow(m), r: m.size, life: m.life * G.U.rand(0.85, 1.05), pierce: m.pierce | 0, color: col,
        hits: new Set(), vis, ghost, owner: pl
      }, payload(m)));
    }
    G.FX.spark(pl.x + Math.cos(pl.aim) * pl.r, pl.y - G.LIFT + Math.sin(pl.aim) * pl.r, col, Math.cos(pl.aim), Math.sin(pl.aim), 5);
  }

  // ---------------- burst moves (18-10-2026) ----------------
  // They fire once, the moment you switch to them with their cooldown ready (tickMove does that:
  // they don't wait for a target). The cooldown then runs whether they're active or not (tick).

  /** Hyper Beam: turns to the line through the most enemies it can reach (keeps the aim if there are none). */
  function aimBestLine(pl, m) {
    const near = G.EnemyMgr.queryCircle(pl.x, pl.y, m.radius);
    if (!near.length) return;
    const half = (m.width || 56) / 2;
    let best = -1, bestA = pl.aim, bestD = Infinity;
    for (const t of near) {
      const a = Math.atan2(t.y - pl.y, t.x - pl.x), ca = Math.cos(a), sa = Math.sin(a);
      // The beam stops at the first wall: only what's before it counts.
      let len = m.radius;
      for (let d = 8; d < m.radius; d += 8) if (G.World.isWall(pl.x + ca * d, pl.y + sa * d)) { len = d; break; }
      let n = 0;
      for (const e of near) {
        const dx = e.x - pl.x, dy = e.y - pl.y, along = dx * ca + dy * sa;
        if (along >= -e.r && along <= len + e.r && Math.abs(-dx * sa + dy * ca) <= half + e.r) n++;
      }
      const d = Math.hypot(t.x - pl.x, t.y - pl.y);     // a tie goes to the nearer target
      if (n > best || (n === best && d < bestD)) { best = n; bestA = a; bestD = d; }
    }
    pl.aim = bestA;
    pl.attackFace = Math.max(pl.attackFace || 0, 0.4);
  }

  function burst(pl, m) {
    const col = G.U.TYPE_COLOR[m.type];
    switch (m.id) {
      case 'hyper-beam':
        if (!ghost) aimBestLine(pl, m);      // (teammates' copies use the aim the owner sends)
        beam(pl, m);
        G.FX.ring(pl.x, pl.y, pl.r, pl.r * 5, col, 0.35, 4);
        if (!ghost) { G.Camera.kick(0.35); pl.slowT = Math.max(pl.slowT, 1); }       // it has to recharge
        break;
      case 'explosion': {
        G.FX.ring(pl.x, pl.y, 8, m.radius, '#ffb347', 0.45, 6);
        G.FX.ring(pl.x, pl.y, 4, m.radius * 0.7, '#fff2a0', 0.3, 4);
        G.FX.burst(pl.x, pl.y - pl.bodyH * 0.5, '#ff8a3d', 34, 260);
        G.FX.burst(pl.x, pl.y - pl.bodyH * 0.5, '#5a5048', 18, 180);
        if (G.Camera.sees(pl.x, pl.y, 60)) G.Audio.sfx('break');
        if (ghost) break;
        G.Camera.kick(0.5);
        for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, m.radius)) hit(pl, e, m.dmg * pl.pow(m), col, e.x - pl.x, e.y - pl.y, m.knock || 0, m);
        for (const p of G.World.propsInCircle(pl.x, pl.y, m.radius)) G.World.damageProp(p, m.dmg * pl.pow(m), col);
        // The price: part of your health, but never the last of it.
        const cost = Math.min(pl.maxHp * (m.selfHp || 0), Math.max(0, pl.hp - 1));
        if (cost >= 1) { pl.hp -= cost; G.FX.dmgText(pl.x, pl.y - pl.bodyH - 6, '-' + Math.round(cost), '#ff8a96'); }
        break;
      }
      case 'protect':
        // (Shown on teammates' screens too; only the owner is actually protected.)
        pl.protectUntil = performance.now() + m.dur * 1000;
        G.FX.ring(pl.x, pl.y, pl.r, pl.r * 3, '#9fd8ff', 0.4, 4);
        if (ghost) break;
        pl.invuln = Math.max(pl.invuln || 0, m.dur);
        pl.protectT = m.dur;
        for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, m.radius)) {
          if (e.boss) continue;
          const [nx, ny] = G.U.norm(e.x - pl.x, e.y - pl.y);
          e.kx += nx * m.knock; e.ky += ny * m.knock;
        }
        break;
      case 'recover':
        G.FX.ring(pl.x, pl.y, 4, pl.r * 3.2, '#5fe08a', 0.45, 4);
        for (let i = 0; i < 6; i++) G.FX.sp('heart', 'grass', pl.x + G.U.rand(-pl.r, pl.r), pl.y - G.U.rand(0, pl.bodyH), { vy: -60, life: 0.7 });
        if (ghost) break;
        pl.heal(pl.maxHp * m.amount);
        G.Audio.sfx('heal');
        break;
      case 'thunder-wave':
        G.FX.ring(pl.x, pl.y, 10, m.radius, col, 0.5, 5);
        G.FX.ring(pl.x, pl.y, 6, m.radius * 0.6, '#fff36a', 0.35, 3);
        for (let i = 0; i < 14; i++) {
          const a = i / 14 * 6.2832, r = m.radius * G.U.rand(0.3, 0.95);
          G.FX.sp('bolt', 'electric', pl.x + Math.cos(a) * r, pl.y + Math.sin(a) * r * 0.8 - G.LIFT, { life: 0.3, angle: a });
        }
        if (ghost) break;
        G.Camera.kick(0.2);
        for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, m.radius)) {
          hit(pl, e, m.dmg * pl.pow(m), col, e.x - pl.x, e.y - pl.y, 0, m);
          if (e.boss || e.legend || e.judge) e.applySlow(0.5, 2);
          else e.freeze(m.dur, true);
        }
        break;
      case 'draco-meteor':
        meteors(pl, m);
        G.FX.ring(pl.x, pl.y, pl.r, pl.r * 4, col, 0.35, 3);
        break;
    }
  }

  // ---------------- new styles (19-10-2026, Batch 2) ----------------

  /** Charge (Solar Beam): a wind-up while it gathers light, then a huge beam where you are aiming. */
  function charge(pl, m) {
    fields.push({ kind: 'charge', owner: pl, ghost, m, col: G.U.TYPE_COLOR[m.type], vis: G.VFX.forMove(m), x: pl.x, y: pl.y, t: 0, life: m.delay + 0.1 });
    G.FX.ring(pl.x, pl.y, pl.r * 3, pl.r, G.U.TYPE_COLOR[m.type], m.delay, 2);
  }

  /** Ricochet (Electro Ball, Power Gem, Mirror Shot): a shot that bounces from foe to foe. */
  function ricochet(pl, m) {
    const col = G.U.TYPE_COLOR[m.type], vis = G.VFX.forMove(m), n = Math.max(1, m.count | 0);
    for (let i = 0; i < n; i++) {
      const a = pl.aim + (n === 1 ? 0 : (i / (n - 1) - 0.5) * 0.5);
      G.Projectiles.spawn(Object.assign({
        x: pl.x + Math.cos(a) * 3, y: pl.y + Math.sin(a) * 3, vx: Math.cos(a) * m.speed, vy: Math.sin(a) * m.speed,
        dmg: m.dmg * pl.pow(m), r: m.size, life: m.life, pierce: 0, color: col, hits: new Set(), vis, ghost, owner: pl,
        bounce: m.bounces | 0, grow: m.grow || 1
      }, payload(m)));
    }
  }

  /** After hitting `e`: heads for the nearest enemy it hasn't hit yet (true if it found one). */
  function bounceFrom(p, e) {
    let best = null, bd = 240 * 240;
    for (const o of G.EnemyMgr.queryCircle(e.x, e.y, 240)) {
      if (o === e || o.dead || p.hits.has(o.id)) continue;
      const d = G.U.dist2(e.x, e.y, o.x, o.y);
      if (d < bd) { bd = d; best = o; }
    }
    if (!best) return false;
    const sp = Math.hypot(p.vx, p.vy) * 1.08;
    const [dx, dy] = G.U.norm(best.x - p.x, best.cy() - p.y);
    p.vx = dx * sp; p.vy = dy * sp;
    p.bounce--; p.dmg *= p.grow || 1; p.t = Math.min(p.t, p.life * 0.4);
    G.FX.spark(p.x, p.y - G.LIFT, p.color, dx, dy, 4);
    return true;
  }

  /** Cage (Thunder Cage, Sand Tomb): a ring around the target's group; inside it hurts, and nobody gets out. */
  function cage(pl, m) {
    const tg = pl.target && !pl.target.dead ? pl.target : G.Projectiles.nearest(G.EnemyMgr.all(), pl.x, pl.y, reach(m));
    if (!tg) return;
    fields.push({ kind: 'cage', owner: pl, ghost, m, col: G.U.TYPE_COLOR[m.type], vis: G.VFX.forMove(m), x: tg.x, y: tg.y,
                  r: m.radius, life: m.dur, t: 0, tick: 0, dmg: m.dmg * pl.pow(m), zap: new Map(), inside: new Set() });
    G.FX.ring(tg.x, tg.y, 4, m.radius, G.U.TYPE_COLOR[m.type], 0.4, 4);
    // At most 2 cages per player (more piled up and multiplied the damage): the oldest goes.
    const mine = fields.filter(f => f.kind === 'cage' && f.owner === pl && !f.gone);
    for (const f of mine.slice(0, -2)) f.gone = true;
  }

  /** Wall (Reflect): a barrier in front of you that stops enemy shots (Mirror Coat sends them back). */
  function wall(pl, m) {
    const d = m.dist || 34;
    fields.push({ kind: 'wall', owner: pl, ghost, m, col: G.U.TYPE_COLOR[m.type], x: pl.x + Math.cos(pl.aim) * d, y: pl.y + Math.sin(pl.aim) * d,
                  a: pl.aim, w: m.width, life: m.dur, t: 0, reflect: !!m.reflect });
    const mine = fields.filter(f => f.kind === 'wall' && f.owner === pl && !f.gone);
    for (const f of mine.slice(0, Math.max(0, mine.length - 2))) f.gone = true;
  }

  /** Enemy shot `p` against the walls: blocked (and maybe reflected). Teammates' walls block on your screen too. */
  function wallBlocks(p) {
    for (const f of fields) {
      if (f.kind !== 'wall' || f.gone) continue;
      const ca = Math.cos(f.a), sa = Math.sin(f.a);
      const dx = p.x - f.x, dy = p.y - f.y;
      const along = -dx * sa + dy * ca, across = dx * ca + dy * sa;          // along the wall / through it
      if (Math.abs(along) > f.w / 2 + p.r || Math.abs(across) > 8 + p.r) continue;
      G.FX.burst(p.x, p.y - G.LIFT, f.col, 6, 90);
      if (f.reflect) {
        // Mirror Coat: back at the enemies, stronger (a teammate's reflection is only shown here).
        G.Projectiles.spawn({ x: p.x, y: p.y, vx: -(p.vx || 0) * 1.2, vy: -(p.vy || 0) * 1.2, dmg: (p.dmg || 10) * 2 * (f.owner.pow ? f.owner.pow(f.m) : 1),
                              r: p.r, life: 1.2, pierce: 1, color: f.col, hits: new Set(), vis: G.VFX.forMove(f.m),
                              ghost: f.ghost, owner: f.owner, mtype: f.m.type, mid: f.m.id });
      }
      return true;
    }
    return false;
  }

  /** Burrow (Dig): underground for a moment (can't be hit), then you burst up under the biggest group. */
  function burrow(pl, m) {
    let best = null, bestN = 0;
    for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, reach(m))) {
      if (e.dead) continue;
      const n = G.EnemyMgr.queryCircle(e.x, e.y, 70).length;
      if (n > bestN) { bestN = n; best = e; }
    }
    if (!best) return;
    fields.push({ kind: 'burrow', owner: pl, ghost, m, col: G.U.TYPE_COLOR[m.type], vis: G.VFX.forMove(m), x: best.x, y: best.y,
                  t: 0, life: m.dur + 0.05 });
    G.FX.burst(pl.x, pl.y - 4, '#aa7c3c', 12, 120);
    if (!ghost) { pl.burrowT = m.dur; pl.invuln = Math.max(pl.invuln || 0, m.dur + 0.3); }
  }

  /** Swarm (Infestation): little bugs that chase foes on their own and keep biting. */
  function swarm(pl, m) {
    const col = G.U.TYPE_COLOR[m.type], vis = G.VFX.forMove(m), n = Math.max(1, m.count | 0);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.2832;
      G.Projectiles.spawn(Object.assign({
        x: pl.x + Math.cos(a) * 10, y: pl.y + Math.sin(a) * 8, vx: Math.cos(a) * m.speed, vy: Math.sin(a) * m.speed,
        dmg: m.dmg * pl.pow(m), r: m.size, life: m.dur, pierce: 1e6, color: col, homing: 5, swarm: true,
        hitLog: new Map(), rehit: m.rehit || 0.5, vis, ghost, owner: pl
      }, payload(m)));
    }
    const mine = G.Projectiles.all().filter(p => p.swarm && p.owner === pl);
    for (const p of mine.slice(0, Math.max(0, mine.length - n * 3))) G.Projectiles.remove(p);
  }

  /** Throw (Seismic Toss): grabs the nearest foe and hurls it into the others. Bosses (and enemies a teammate's
   *  computer runs) are too heavy to throw: they take a big hit and are knocked back instead. */
  function toss(pl, m) {
    const e = pl.target && !pl.target.dead && G.U.dist(pl.x, pl.y, pl.target.x, pl.target.y) <= reach(m) ? pl.target
            : G.Projectiles.nearest(G.EnemyMgr.all(), pl.x, pl.y, reach(m));
    if (!e) return;
    const col = G.U.TYPE_COLOR[m.type];
    G.FX.slash(e.x, e.y - G.LIFT * 0.5, pl.aim, 30, 2.4, col, G.VFX.forMove(m));
    if (ghost) return;
    if (e.boss || e.remote) {
      hit(pl, e, m.dmg * pl.pow(m) * 1.3, col, Math.cos(pl.aim), Math.sin(pl.aim), 320, m);
      fields.push({ kind: 'land', owner: pl, ghost, m, col, x: e.x + Math.cos(pl.aim) * 60, y: e.y + Math.sin(pl.aim) * 50, t: 0, life: 0.3, dmg: m.dmg * pl.pow(m) * 0.6 });
      return;
    }
    e.freeze(0.6);
    fields.push({ kind: 'throw', owner: pl, ghost, m, col, e, vx: Math.cos(pl.aim) * m.speed, vy: Math.sin(pl.aim) * m.speed,
                  t: 0, dur: 0.45, dmg: m.dmg * pl.pow(m), done: new Set([e.id]) });   // (dur, not life: life would remove it before it lands)
    G.Camera.kick(0.15);
  }

  /** Roll (Rollout): while it's your active move you're a boulder; the longer you keep moving, the bigger and
   *  harder it hits (momentum drops when you stop). */
  function roll(pl, m, dt) {
    const max = m.max || 1.5;
    pl.rollMom = G.U.clamp((pl.rollMom || 0) + (pl.walking ? (m.rate || 0.4) * dt : -dt * 0.8), 0, max);
    m.t -= dt;
    if (m.t > 0) return;
    m.t = Math.max(0.05, m.cd * pl.cdMul);
    const k = 1 + pl.rollMom, r = m.radius * (1 + pl.rollMom * 0.5) * (pl.areaMul || 1);
    G.RunLog.cast(pl, m.id);
    if (G.Coop.active) G.Coop.cast(pl, m);
    rollFx(pl, m, r);
    for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, r)) hit(pl, e, m.dmg * pl.pow(m) * k, G.U.TYPE_COLOR[m.type], e.x - pl.x, e.y - pl.y, 60 + 60 * pl.rollMom, m);
    for (const p of G.World.propsInCircle(pl.x, pl.y, r)) G.World.damageProp(p, m.dmg * pl.pow(m) * k, G.U.TYPE_COLOR[m.type]);
  }
  function rollFx(pl, m, r) {
    r = r || m.radius * (1 + (pl.rollMom || 0) * 0.5);
    G.FX.sp('rock', 'rock', pl.x, pl.y - pl.bodyH * 0.4, { life: 0.3, scale: 1 + (pl.rollMom || 0) * 0.6, spin: 9 });
    if (Math.random() < 0.5) G.FX.burst(pl.x, pl.y, '#aa7c3c', 3, 60);
    if ((pl.rollMom || 0) > 0.6) G.FX.ring(pl.x, pl.y, r * 0.6, r, G.U.TYPE_COLOR[m.type], 0.2, 2);
  }

  /** Counter (Sucker Punch): waits for a foe to come close, then strikes it first. */
  function counter(pl, m, dt) {
    m.t -= dt;
    if (m.t > 0) return;
    const e = G.Projectiles.nearest(G.EnemyMgr.all(), pl.x, pl.y, m.radius * (pl.areaMul || 1));
    if (!e) { m.t = 0.05; return; }
    m.t = Math.max(0.05, m.cd * pl.cdMul);
    pl.aim = Math.atan2(e.y - pl.y, e.x - pl.x);
    pl.cast(m);
    G.RunLog.cast(pl, m.id);
    if (G.Coop.active) G.Coop.cast(pl, m);
    m.castAt = performance.now();
    counterFx(pl, m, e);
    hit(pl, e, m.dmg * pl.pow(m), G.U.TYPE_COLOR[m.type], e.x - pl.x, e.y - pl.y, m.knock || 0, m);
  }
  function counterFx(pl, m, e) {
    const x = e ? e.x : pl.x + Math.cos(pl.aim) * 40, y = e ? e.y : pl.y + Math.sin(pl.aim) * 40;
    G.FX.slash(x, y - G.LIFT * 0.5, pl.aim, 30, 2, G.U.TYPE_COLOR[m.type], G.VFX.forMove(m));
    G.FX.sp('streak', 'dark', (pl.x + x) / 2, (pl.y + y) / 2 - G.LIFT * 0.5, { life: 0.15, angle: pl.aim });
  }

  /** The new styles' fields, every frame (from updateFields). */
  function updateNewField(f, dt, i) {
    if (f.kind === 'charge') {
      const o = f.owner;
      if (Math.random() < dt * 30) {
        const a = Math.random() * 6.2832, r = G.U.rand(30, 60);
        G.FX.sp('star', f.vis.pal, o.x + Math.cos(a) * r, o.y + Math.sin(a) * r * 0.8 - G.LIFT, { vx: -Math.cos(a) * r * 2.5, vy: -Math.sin(a) * r * 2, life: 0.35 });
      }
      if (f.t >= f.m.delay) {
        const prev = ghost; ghost = f.ghost;
        try { if (!o.dead) { beam(o, f.m); if (!ghost) G.Camera.kick(0.3); } } finally { ghost = prev; }
        fields.splice(i, 1);
      }
      return;
    }
    if (f.kind === 'cage') {
      f.tick -= dt;
      if (f.tick <= 0) { f.tick = 0.5; blast(f, f.r); }
      if (f.ghost) return;
      // Nobody gets out: the ones inside that reach the edge are pushed back (and Thunder Cage shocks them).
      // Foes walking in from outside aren't shocked or pulled: they're caught once they're inside.
      for (const e of G.EnemyMgr.queryCircle(f.x, f.y, f.r + 18)) {
        const dx = e.x - f.x, dy = e.y - f.y, d = Math.hypot(dx, dy) || 1;
        if (d < f.r - 8) { f.inside.add(e.id); if (f.m.slow) e.applySlow(f.m.slow, 0.6); continue; }
        if (!f.inside.has(e.id)) continue;
        if (!e.remote && !e.boss) { e.x = f.x + dx / d * (f.r - 8); e.y = f.y + dy / d * (f.r - 8); e.kx = 0; e.ky = 0; }
        if (f.m.edge && (f.zap.get(e.id) || 0) <= f.t) {
          f.zap.set(e.id, f.t + 0.6);
          hit(f.owner, e, f.dmg * f.m.edge, f.col, -dx, -dy, 0, f.m);
          G.FX.spark(e.x, e.y - e.bodyH * 0.5, f.col, -dx / d, -dy / d, 4);
        }
      }
      return;
    }
    if (f.kind === 'burrow') {
      if (Math.random() < dt * 20) G.FX.px(f.x + G.U.rand(-20, 20), f.y - 2, '#aa7c3c', { vy: -30, life: 0.3 });
      if (f.t >= f.m.dur) {
        const o = f.owner;
        G.FX.ring(f.x, f.y, 6, f.m.radius, f.col, 0.4, 5);
        G.FX.burst(f.x, f.y - 6, '#aa7c3c', 22, 200);
        if (!f.ghost) {
          if (G.World.isFree(f.x, f.y, o.r * 0.8, true)) { o.x = f.x; o.y = f.y; }
          o.burrowT = 0;
          G.Camera.kick(0.35);
          if (G.Camera.sees(f.x, f.y, 40)) G.Audio.sfx('break');
          f.dmg = f.m.dmg * o.pow(f.m);
          blast(f, f.m.radius);
        }
        fields.splice(i, 1);
      }
      return;
    }
    if (f.kind === 'throw') {
      const e = f.e;
      if (e.dead) { fields.splice(i, 1); return; }
      const nx = e.x + f.vx * dt, ny = e.y + f.vy * dt;
      const wallHit = G.World.isWall(nx, ny);
      if (!wallHit) { e.x = nx; e.y = ny; }
      e.freezeT = Math.max(e.freezeT || 0, 0.1);
      for (const o of G.EnemyMgr.queryCircle(e.x, e.y, e.r + 20)) {
        if (f.done.has(o.id) || G.U.dist2(o.x, o.y, e.x, e.y) > (o.r + e.r) ** 2) continue;
        f.done.add(o.id);
        hit(f.owner, o, f.dmg * 0.7, f.col, f.vx, f.vy, 140, f.m);
      }
      if (wallHit || f.t >= f.dur) {
        // Landing: the thrown foe and everything around it.
        G.FX.ring(e.x, e.y, 6, f.m.splash, f.col, 0.35, 4);
        G.FX.burst(e.x, e.y - 6, '#e8dcb8', 14, 160);
        if (G.Camera.sees(e.x, e.y, 40)) { G.Audio.sfx('break'); G.Camera.kick(0.2); }
        hit(f.owner, e, f.dmg, f.col, f.vx, f.vy, 60, f.m);
        f.x = e.x; f.y = e.y; f.dmg *= 0.5;
        for (const o of G.EnemyMgr.queryCircle(e.x, e.y, f.m.splash)) if (o !== e) hit(f.owner, o, f.dmg, f.col, o.x - e.x, o.y - e.y, 100, f.m);
        fields.splice(i, 1);
      }
      return;
    }
    if (f.kind === 'land') {
      if (f.t >= 0.25) {
        G.FX.ring(f.x, f.y, 6, f.m.splash, f.col, 0.35, 4);
        blast(f, f.m.splash);
        fields.splice(i, 1);
      }
    }
  }

  /** Ground layer of the new styles' fields. */
  function drawNewGround(ctx, f, now) {
    if (f.kind === 'cage') {
      const a = Math.min(1, (f.life - f.t) * 2, f.t * 6);
      ctx.globalAlpha = 0.18 * a; ctx.fillStyle = f.col;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.62, 0, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 0.8 * a; ctx.strokeStyle = f.col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.62, 0, 0, 6.2832); ctx.stroke();
      // Bars all around (flickering for Thunder Cage, swirling sand for Sand Tomb).
      const n = 14;
      for (let k = 0; k < n; k++) {
        const ang = k / n * 6.2832 + (f.m.edge ? 0 : now * 0.8);
        const x = f.x + Math.cos(ang) * f.r, y = f.y + Math.sin(ang) * f.r * 0.62;
        ctx.globalAlpha = a * (f.m.edge ? 0.6 + 0.4 * Math.sin(now * 20 + k) : 0.7);
        ctx.fillStyle = f.col; ctx.fillRect(Math.round(x - 1), Math.round(y - 16), 2, 16);
      }
    } else if (f.kind === 'burrow') {
      ctx.globalAlpha = 0.45; ctx.fillStyle = '#6e4c1e';
      const k = Math.min(1, f.t / f.m.dur);
      ctx.beginPath(); ctx.ellipse(f.x, f.y, 10 + k * 14, (10 + k * 14) * 0.5, 0, 0, 6.2832); ctx.fill();
    }
  }

  /** Air layer: the Reflect barrier. */
  function drawNewAir(ctx, f, now) {
    if (f.kind !== 'wall') return;
    const a = Math.min(1, (f.life - f.t) * 2, f.t * 8);
    const ca = Math.cos(f.a), sa = Math.sin(f.a), hw = f.w / 2;
    const x0 = f.x - sa * hw, y0 = f.y + ca * hw, x1 = f.x + sa * hw, y1 = f.y - ca * hw;
    const col = f.reflect ? '#ffb3e6' : f.col, H = 24, pulse = 0.75 + Math.sin(now * 10) * 0.2;
    ctx.save();
    ctx.lineCap = 'round';
    // A glowing pane: a thick translucent band standing up from the ground, bright edges, a shimmer running along it.
    for (let k = 0; k <= H; k += 6) {
      ctx.globalAlpha = 0.22 * a; ctx.strokeStyle = col; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(x0, y0 - k); ctx.lineTo(x1, y1 - k); ctx.stroke();
    }
    ctx.globalAlpha = pulse * a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0, y0 - H); ctx.lineTo(x1, y1 - H); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 - H); ctx.moveTo(x1, y1); ctx.lineTo(x1, y1 - H); ctx.stroke();
    const sh = (now * 0.8) % 1;
    ctx.globalAlpha = 0.6 * a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x0 + (x1 - x0) * sh, y0 + (y1 - y0) * sh); ctx.lineTo(x0 + (x1 - x0) * sh, y0 + (y1 - y0) * sh - H); ctx.stroke();
    ctx.restore();
  }

  /** Damage from a field (mine, meteor, puddle) to everything in its circle. */
  function blast(f, r, k = 1) {
    if (f.ghost) return;
    const pl = f.owner, m = f.m;
    for (const e of G.EnemyMgr.queryCircle(f.x, f.y, r)) hit(pl, e, f.dmg * k, f.col, e.x - f.x, e.y - f.y, m.knock || 0, m);
    for (const p of G.World.propsInCircle(f.x, f.y, r)) G.World.damageProp(p, f.dmg * k, f.col);
  }

  const NEW_FIELDS = ['charge', 'cage', 'burrow', 'throw', 'land'];
  function updateFields(dt) {
    decoyContacts(dt);
    for (let i = fields.length - 1; i >= 0; i--) {
      const f = fields[i];
      f.t += dt;
      if (f.gone || !f.owner || (f.life && f.t >= f.life && f.kind !== 'mine')) { fields.splice(i, 1); continue; }
      if (f.kind === 'mine') {
        const armed = f.t >= f.arm;
        const trig = armed && G.EnemyMgr.queryCircle(f.x, f.y, 14).length > 0;
        if (trig || f.t >= f.life) {
          G.FX.ring(f.x, f.y, 4, f.r, f.col, 0.3, 4);
          G.FX.burst(f.x, f.y - 6, f.col, 10, 150);
          if (G.Camera.sees(f.x, f.y, 40)) G.Audio.sfx('break');
          blast(f, f.r, trig ? 1 : 0.5);
          fields.splice(i, 1);
        }
      } else if (f.kind === 'meteor') {
        if (f.t >= f.fall) {
          G.FX.ring(f.x, f.y, 4, f.r, f.col, 0.35, 4);
          G.FX.burst(f.x, f.y - 6, f.col, 12, 170);
          if (G.Camera.sees(f.x, f.y, 40)) { G.Audio.sfx('break'); G.Camera.kick(0.12); }
          blast(f, f.r);
          fields.splice(i, 1);
        }
      } else if (f.kind === 'turret') {
        f.shotT -= dt;
        if (f.shotT <= 0) {
          const m = f.m;
          const tg = G.Projectiles.nearest(G.EnemyMgr.all(), f.x, f.y, m.range || 300);
          f.shotT = tg ? m.rate || 0.6 : 0.15;
          if (tg) {
            const a = Math.atan2(tg.y - f.y, tg.x - f.x);
            G.Projectiles.spawn(Object.assign({
              x: f.x, y: f.y, vx: Math.cos(a) * (m.speed || 300), vy: Math.sin(a) * (m.speed || 300),
              dmg: f.dmg, r: m.size || 6, life: 1.4, pierce: m.pierce | 0, color: f.col,
              hits: new Set(), vis: f.vis, ghost: f.ghost, owner: f.owner
            }, payload(m)));
            f.kick = 0.12;
          }
        }
        if (f.kick > 0) f.kick -= dt;
      } else if (NEW_FIELDS.includes(f.kind)) {
        updateNewField(f, dt, i);
      } else if (f.kind === 'patch') {
        f.tick -= dt;
        if (f.tick <= 0) { f.tick = 0.5; blast(f, f.r); }
        if (f.vis.aura && Math.random() < dt * 3 && G.Camera.sees(f.x, f.y, 20)) {
          G.FX.sp(f.vis.aura, f.vis.pal, f.x + G.U.rand(-f.r, f.r) * 0.6, f.y - 4, { vy: -40, life: 0.4 });
        }
      }
    }
  }

  /** The parts of fields that go on the ground (below the Pokémon). */
  function drawGroundFields(ctx) {
    const now = performance.now() / 1000;
    for (const f of fields) {
      if (!G.Camera.sees(f.x, f.y, 60)) continue;
      ctx.save();
      if (f.kind === 'patch') {
        const a = Math.min(1, (f.life - f.t) * 2, f.t * 6);
        ctx.globalAlpha = 0.32 * a;
        ctx.fillStyle = f.col;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.62, 0, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 0.5 * a;
        ctx.strokeStyle = f.col; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * 0.8, f.r * 0.5, 0, 0, 6.2832); ctx.stroke();
      } else if (f.kind === 'mine') {
        const armed = f.t >= f.arm, blink = armed && Math.sin(now * 8 + f.x) > 0.3;
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = f.col;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * 0.45, f.r * 0.28, 0, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 1;
        G.VFX.draw(ctx, f.vis.proj, f.vis.pal, f.x, f.y - 4, { scale: 1, alpha: blink ? 1 : 0.75, frame: 0 });
      } else if (f.kind === 'meteor') {
        const k = G.U.clamp(f.t / f.fall, 0, 1);
        ctx.globalAlpha = 0.2 + k * 0.3;
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (0.3 + k * 0.7), f.r * 0.6 * (0.3 + k * 0.7), 0, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = f.col; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.6, 0, 0, 6.2832); ctx.stroke();
      } else if (f.kind === 'turret') {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(f.x, f.y, 11, 4.5, 0, 0, 6.2832); ctx.fill();
      } else drawNewGround(ctx, f, now);
      ctx.restore();
    }
  }

  // ---- Substitute: a stitched plush doll of the owner's Pokémon, made from its own sprite ----
  const dolls = new Map();      // dex -> canvas (or null while the sprite is still loading)
  const DOLL = { d: [74, 58, 44], m: [168, 150, 118], l: [232, 220, 186], line: [84, 64, 46], thread: [250, 242, 214] };

  function makeDoll(dex) {
    const m = G.Sprites.animMeta(dex, 'Idle'), sh = G.Sprites.sheet(dex, 'Idle');
    if (!m || !sh || !sh.ready) return null;
    const src = document.createElement('canvas'); src.width = m.w; src.height = m.h;
    src.getContext('2d').drawImage(sh.img, 0, 0, m.w, m.h, 0, 0, m.w, m.h);
    const sd = src.getContext('2d').getImageData(0, 0, m.w, m.h).data, P = 2, W = m.w + P * 2, H = m.h + P * 2;
    const A = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && sd[(y * m.w + x) * 4 + 3] > 40;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'), img = c.createImageData(W, H), o = img.data;
    const put = (x, y, col) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; o[i] = col[0]; o[i + 1] = col[1]; o[i + 2] = col[2]; o[i + 3] = 255; };
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (!A(x, y)) continue;
      const i = (y * m.w + x) * 4, L = (sd[i] * 0.3 + sd[i + 1] * 0.59 + sd[i + 2] * 0.11) / 255;
      put(x + P, y + P, L < 0.32 ? DOLL.d : L < 0.62 ? DOLL.m : DOLL.l);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    for (let y = -1; y <= m.h; y++) for (let x = -1; x <= m.w; x++) {
      if (!A(x, y) && (A(x + 1, y) || A(x - 1, y) || A(x, y + 1) || A(x, y - 1))) put(x + P, y + P, DOLL.line);
    }
    // A neat 5x5 cross-stitch patch on the body: the spot nearest the lower middle where all 25 pixels sit on the sprite.
    const tx = Math.round((x0 + x1) / 2), ty = Math.round(y0 + (y1 - y0) * 0.66);
    let best = null, bd = 1e9;
    for (let y = y0 + 2; y <= y1 - 2; y++) for (let x = x0 + 2; x <= x1 - 2; x++) {
      let ok = true;
      for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2; dx++) if (!A(x + dx, y + dy)) { ok = false; break; }
      const d = (x - tx) * (x - tx) + (y - ty) * (y - ty);
      if (ok && d < bd) { bd = d; best = [x, y]; }
    }
    if (best) {
      const [bx, by] = [best[0] + P, best[1] + P];
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) put(bx + dx, by + dy, DOLL.m);
      for (let i = -2; i <= 2; i++) { put(bx + i, by + i, DOLL.thread); put(bx + i, by - i, DOLL.thread); }
    }
    c.putImageData(img, 0, 0);
    return { cv, ax: m.ax + P, ay: m.ay + P };
  }

  function dollFor(dex) {
    let d = dolls.get(dex);
    if (!d) { d = makeDoll(dex); if (d) dolls.set(dex, d); }
    return d;
  }

  /** The parts of fields that go on top (falling meteors, turrets). */
  function drawAirFields(ctx) {
    const now = performance.now() / 1000;
    for (const f of fields) {
      if (!G.Camera.sees(f.x, f.y, 200)) continue;
      if (f.kind === 'wall') { drawNewAir(ctx, f, now); continue; }
      if (f.kind === 'meteor' && f.t > 0) {
        const k = G.U.clamp(f.t / f.fall, 0, 1);
        G.VFX.draw(ctx, f.vis.proj, f.vis.pal, f.x + (1 - k) * 40, f.y - (1 - k) * 170 - 6,
                   { scale: 1.5, angle: Math.atan2(170, -40), frame: Math.floor(now * 12) });
      } else if (f.kind === 'turret') {
        const fade = Math.min(1, (f.life - f.t) * 2, f.t * 5);
        const bob = Math.sin(now * 4 + f.x) * 2 - (f.kick > 0 ? 2 : 0);
        const doll = f.m.id === 'substitute' && f.owner && f.owner.mon ? dollFor(f.owner.mon.dex) : null;
        if (doll) {
          const k = G.Sprites.PX * ((f.owner.anim && f.owner.anim.scale) || 1) * 0.9;
          const prev = ctx.globalAlpha, imgS = ctx.imageSmoothingEnabled;
          ctx.globalAlpha = prev * fade * (f.hurtT > 0 && Math.floor(f.hurtT * 40) % 2 ? 0.45 : 1); ctx.imageSmoothingEnabled = false;
          ctx.drawImage(doll.cv, Math.round(f.x - doll.ax * k), Math.round(f.y - 8 + bob - doll.ay * k), doll.cv.width * k, doll.cv.height * k);
          ctx.globalAlpha = prev; ctx.imageSmoothingEnabled = imgS;
          if (f.maxHp) {       // little stitches: one per hit it can still take
            const n = f.maxHp, sw = Math.min(5, 36 / n), w = n * sw, bx = Math.round(f.x - w / 2), by = Math.round(f.y - 8 + bob - doll.ay * k - 7);
            ctx.globalAlpha = prev * fade;
            ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(bx - 1, by - 1, w + 2, 5);
            for (let i = 0; i < n; i++) { ctx.fillStyle = i < f.hp ? '#f6eed2' : '#5b4632'; ctx.fillRect(bx + i * sw, by, Math.max(1, sw - 1), 3); }
            ctx.globalAlpha = prev;
          }
        } else G.VFX.draw(ctx, f.vis.proj, f.vis.pal, f.x, f.y - 16 + bob, { scale: 1.5, alpha: fade, frame: Math.floor(now * 8) });
      }
    }
  }

  function clearFields(owner) { fields = owner ? fields.filter(f => f.owner !== owner) : []; }

  function orbit(pl, m, dt, now, isGhost = false) {
    const col = G.U.TYPE_COLOR[m.type];
    const want = Math.max(1, m.count | 0);
    // Each orbit move has its own orbs (there can be two in a bond).
    const mine = p => p.orb && p.owner === pl && p.mid === m.id;
    const orbs = G.Projectiles.all().filter(mine);
    // If the number of orbs changes (when upgrading the move), they're all spread
    // evenly from where the first one is, without jumps.
    const relayout = orbs.length !== want;
    const base = orbs.length ? orbs[0].oa : now * m.speed;
    if (orbs.length > want) for (const p of orbs.slice(want)) G.Projectiles.remove(p);

    for (let i = orbs.length; i < want; i++) {
      G.Projectiles.spawnOrb({
        owner: pl, ghost: isGhost, mid: m.id,
        x: pl.x, y: pl.y, r: m.size, color: col, vis: G.VFX.forMove(m),
        dmg: m.dmg * pl.pow(m),
        oa: (i / want) * 6.2832, orad: m.radius * (pl.areaMul || 1), ospeed: m.speed,
        rehit: Math.max(0.12, m.cd),
        knock: m.knock || 0, burn: m.burn || 0, poison: m.poison || 0, slow: m.slow || 0, mtype: m.type, fx: m.fx || null
      });
    }
    const live = G.Projectiles.all().filter(mine);
    // Gyro Ball (spin): up to ×(1 + still) damage standing still, ×1 at a run (stillK is smoothed in Player.update).
    const spinK = m.kind === 'spin' ? 1 + (m.still || 1) * (pl.stillK || 0) : 1;
    live.forEach((p, i) => {
      p.dmg = m.dmg * pl.pow(m) * spinK;
      p.orad = m.radius * (pl.areaMul || 1);
      p.ospeed = m.speed;
      p.r = m.size;
      if (relayout) p.oa = base + (i / live.length) * 6.2832;
    });

    // A focus animation every so often, so it looks alive.
    pl.orbCastT = (pl.orbCastT || 0) - dt;
    if (pl.orbCastT <= 0) { pl.orbCastT = 1.6; pl.cast({ kind: 'orbit', cd: 1.6 }); }
  }

  /** Replays a teammate's attack just to show it (no damage). */
  function ghostCast(pl, id, lvl, aim, evolved, area) {
    const def = G.Moves.BY_ID[id];
    if (!def || def.kind === 'orbit') return;
    const m = G.Moves.instance(id, lvl);
    if (evolved) G.Moves.evolve(m);
    pl.aim = aim;
    pl.areaMul = area || 1;           // the teammate's Reach, so their attack looks as big as it really is
    ghost = true;
    try {
      pl.cast(m);
      run(pl, m);
    } finally { ghost = false; }
  }

  /** Orbs of a teammate who has an orbit move active (visual only). */
  function ghostOrbit(pl, dt, now) {
    const m = pl.activeMove();
    if (m && (m.kind === 'orbit' || m.kind === 'spin') && !pl.dead) orbit(pl, m, dt, now, true);
    else if (G.Projectiles.all().some(p => p.orb && p.owner === pl)) G.Projectiles.clearOrbs(pl);
  }

  // Critical hit (Upgrades → Critical Hit): x1.5 damage, a big orange number.
  const CRIT_MUL = 1.5;
  // (fx.crit: moves with a high critical-hit chance, like Cross Poison or Shadow Claw, add to it.)
  const isCrit = (pl, fx) => {
    if (ghost) return false;
    if (fx && fx.alwaysCrit) return true;                // Wicked Blow
    const c = pl.critChance + (pl.hasItem('scopelens') ? 0.2 : 0) + (fx && fx.crit || 0);
    return c > 0 && Math.random() < c;
  };

  /** Items that act on hitting: Flame/Toxic Orb, King's Rock, Binding Band. */
  function itemHit(pl, e) {
    const it = pl.item;
    if (!it || ghost) return;
    if (it === 'flameorb') { if (Math.random() < 0.3) e.applyBurn(1); }
    else if (it === 'toxicorb') { if (Math.random() < 0.3) e.applyPoison(1); }
    else if (it === 'kingsrock') { if (Math.random() < 0.06 && !e.boss && !e.judge) e.freeze(1.2); }
    else if (it === 'bindingband') e.applySlow(0.25, 1.5);
  }

  function hit(pl, e, dmg, col, dx, dy, knock, m) {
    const k = typeK(m.type, e);
    const crit = isCrit(pl, m.fx);
    dmg *= k * (crit ? CRIT_MUL : 1) * execMul(m.fx, e);
    if (m.kind === 'melee' && (e.boss || e.legend || e.judge)) dmg *= 1.25;      // melee has to stand in the boss's fire: +25% against bosses and legendaries
    const lethal = e.hp <= dmg;
    e.hurt(dmg, col, dx, dy, knock, crit ? 'crit' : G.Types.label(G.Types.mult(m.type, e.types)));
    if (!ghost) { pl.onDealt(dmg); G.RunLog.dmg(pl, m.id, dmg); }
    pl.dmgDealt += dmg;
    if (dmg > pl.bigHit) pl.bigHit = dmg;
    if (m.burn) e.applyBurn(m.burn, m.id);
    if (m.poison) e.applyPoison(m.poison, m.id);
    if (m.slow) e.applySlow(m.slow);
    if (m.fx) hitFx(pl, e, dmg, m.fx, lethal);
    itemHit(pl, e);
  }

  /*
   * Extra on-hit effects of some moves (`fx` in data/moves.js):
   *   drain   share of the damage that heals you (through Player.drain, which caps it)
   *   vuln    seconds the enemy takes +25% damage from everyone (Acid Spray)
   *   freeze  [chance, seconds] to freeze it solid (Ice Shard)
   *   chill   hits within 1.2 s that freeze it (Frost Breath): every `chill` hits, 1 s of ice
   *   stun    [chance, seconds] to stun it (Dragon Breath)
   *   exec    damage multiplier on enemies below 30% HP (Pursuit; bosses get half the bonus)
   *   fell    a kill raises your damage for a moment (Fell Stinger)
   * Bosses, rift legends and Arceus's legends can't be frozen or stunned (Enemy.freeze).
   */
  function execMul(fx, e) {
    if (!fx || !fx.exec || e.hp > e.maxHp * 0.3) return 1;
    return e.boss || e.legend || e.judge ? 1 + (fx.exec - 1) / 2 : fx.exec;
  }

  function hitFx(pl, e, dmg, fx, lethal) {
    if (ghost) return;
    if (fx.drain) {
      pl.drain(dmg * fx.drain);
      // A little green heart drifts from the enemy (not on every hit: it would be a cloud).
      if (Math.random() < 0.35) {
        const [nx, ny] = G.U.norm(pl.x - e.x, pl.y - e.y);
        G.FX.sp('heart', 'grass', e.x, e.y - e.bodyH * 0.5, { vx: nx * 90, vy: ny * 90 - 20, life: 0.45, scale: 0.8 });
      }
    }
    if (fx.vuln) e.vuln(fx.vuln);
    if (fx.freeze && Math.random() < fx.freeze[0]) e.freeze(fx.freeze[1]);
    if (fx.stun && Math.random() < fx.stun[0]) e.freeze(fx.stun[1], true);
    if (fx.chill) {
      const now = performance.now();
      e.chill = now - (e.chillAt || 0) < 1200 ? (e.chill || 0) + 1 : 1;
      e.chillAt = now;
      if (e.chill >= fx.chill) { e.chill = 0; e.freeze(1); }
    }
    if (fx.fell && lethal) pl.addBuff('fell', 0.05, 4, 5);
  }

  // ---------------- colisiones ----------------

  /** Distance² from point (cx, cy) to segment (ax, ay)-(bx, by). */
  function segDist2(ax, ay, bx, by, cx, cy) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 ? ((cx - ax) * dx + (cy - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + dx * t - cx, qy = ay + dy * t - cy;
    return qx * qx + qy * qy;
  }

  function resolve(dt, pl, now) {
    const projectiles = G.Projectiles.all();

    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];

      // --- enemy shots: walls and solid objects give cover ---
      if (!p.friendly) {
        if (wallBlocks(p)) { projectiles.splice(i, 1); continue; }
        if (G.World.projectileBlock(p.x, p.y, p.r)) {
          G.FX.burst(p.x, p.y - G.LIFT, p.color, 5, 70);
          projectiles.splice(i, 1);
          continue;
        }
        if (G.U.dist2(p.x, p.y, pl.x, pl.y) < (p.r + pl.r) * (p.r + pl.r)) {
          pl.hurt(p.dmg, p.mtype, false, { k: 'shot', d: p.sd });
          G.FX.burst(p.x, p.y - G.LIFT, p.color, 7, 110);
          projectiles.splice(i, 1);
        }
        continue;
      }

      // --- player shots ---
      // A teammate's orbs: visual only.
      if (p.orb && p.ghost) continue;
      const rehits = p.orb || p.swarm;                  // orbs and swarm bugs: hit the same enemy again after `rehit` s
      if (!rehits) {
        const block = G.World.projectileBlock(p.x, p.y, p.r);
        if (block === 'wall' || (block && !block.destructible)) {
          G.FX.burst(p.x, p.y - G.LIFT, p.color, 5, 80);
          projectiles.splice(i, 1);
          continue;
        }
      }

      // Scenery objects (rocks, chests, grass).
      let consumed = false;
      for (const prop of G.World.propsInCircle(p.x, p.y, p.r)) {
        if (rehits) {
          const k = 'p' + prop.id, last = p.hitLog.get(k) || -99;
          if (now - last < p.rehit) continue;
          p.hitLog.set(k, now);
          G.World.damageProp(prop, p.dmg, p.color);
          continue;
        }
        if (p.phits.has(prop.id)) continue;
        p.phits.add(prop.id);
        if (!p.ghost) G.World.damageProp(prop, p.dmg, p.color);
        // Grass doesn't stop it; solid things use up pierce.
        if (prop.solid) {
          if (p.pierce > 0) p.pierce--;
          else { consumed = true; break; }
        }
      }
      if (consumed) {
        G.FX.burst(p.x, p.y - G.LIFT, p.color, 5, 80);
        projectiles.splice(i, 1);
        continue;
      }

      // Enemies. SWEPT collision: the whole stretch travelled this
      // frame is checked, not just the end point. A Thunder Shock moves 8 units per
      // frame: without this it passed through enemies pressed against the player, who
      // were immune to every projectile move.
      const sx = p.orb || p.px == null ? p.x : p.px, sy = p.orb || p.py == null ? p.y : p.py;
      const half = Math.hypot(p.x - sx, p.y - sy) / 2;
      for (const e of G.EnemyMgr.queryCircle((sx + p.x) / 2, (sy + p.y) / 2, half + p.r)) {
        if (segDist2(sx, sy, p.x, p.y, e.x, e.y) > (p.r + e.r) * (p.r + e.r)) continue;
        if (rehits) {
          const last = p.hitLog.get(e.id) || -99;
          if (now - last < p.rehit) continue;
          p.hitLog.set(e.id, now);
          // Orbits last the whole run: old hits are forgotten.
          if (p.hitLog.size > 300) for (const [k, t] of p.hitLog) if (now - t > p.rehit) p.hitLog.delete(k);
        } else {
          if (p.hits.has(e.id)) continue;
          p.hits.add(e.id);
        }

        // A teammate's ghost shot: it collides and shows, but does no damage.
        if (p.ghost) {
          G.FX.sp('impact', p.vis ? p.vis.pal : 'normal', e.x, e.y - e.bodyH * 0.5, { life: 0.12, scale: 1 });
          if (p.bounce > 0 && bounceFrom(p, e)) break;
          if (rehits) continue;
          if (p.pierce > 0) { p.pierce--; continue; }
          G.FX.burst(p.x, p.y - G.LIFT, p.color, 5, 80);
          projectiles.splice(i, 1);
          break;
        }

        const crit = isCrit(pl, p.fx);
        const k = (p.mtype ? typeK(p.mtype, e) : 1) * (crit ? CRIT_MUL : 1) * execMul(p.fx, e);
        const lethal = e.hp <= p.dmg * k;
        e.hurt(p.dmg * k, p.color, p.vx || (e.x - pl.x), p.vy || (e.y - pl.y), p.knock,
               crit ? 'crit' : p.mtype ? G.Types.label(G.Types.mult(p.mtype, e.types)) : null);
        if (Math.random() < 0.5) G.FX.sp('impact', p.vis ? p.vis.pal : 'normal', e.x, e.y - e.bodyH * 0.5, { life: 0.12, scale: 1 });
        pl.dmgDealt += p.dmg * k;
        if (p.dmg * k > pl.bigHit) pl.bigHit = p.dmg * k;
        pl.onDealt(p.dmg * k);
        G.RunLog.dmg(pl, p.mid, p.dmg * k);
        if (p.burn) e.applyBurn(p.burn, p.mid);
        if (p.poison) e.applyPoison(p.poison, p.mid);
        if (p.slow) e.applySlow(p.slow);
        if (p.fx) hitFx(pl, e, p.dmg * k, p.fx, lethal);
        itemHit(pl, e);

        // Ricochet: off to the next enemy instead of stopping.
        if (p.bounce > 0 && bounceFrom(p, e)) break;
        if (!rehits) {
          if (p.pierce > 0) { p.pierce--; }
          else {
            G.FX.burst(p.x, p.y - G.LIFT, p.color, 5, 80);
            projectiles.splice(i, 1);
            break;
          }
        }
      }
    }

    // --- enemy <-> player contact ---
    if (pl.dead) return;
    for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, pl.r + 40)) {
      if (G.U.dist2(e.x, e.y, pl.x, pl.y) > (e.r + pl.r) * (e.r + pl.r)) continue;
      if (e.touchCd > 0 || e.freezeT > 0 || e.behavior === 'thief') continue;
      e.touchCd = 0.55;
      e.strike(pl);
      pl.hurt(e.dmg, e.atkType, false, { k: 'contact', d: e.dex });
      if (pl.hasItem('rockyhelmet')) e.hurt(15 + pl.level * 4, '#9aa6b5', e.x - pl.x, e.y - pl.y, 80);
      const [nx, ny] = G.U.norm(e.x - pl.x, e.y - pl.y);
      e.kx += nx * 150; e.ky += ny * 150;
    }
  }

  return { decoyFor, decoyTarget, netBreak, netHurt, reach, tick, resolve, ghostCast, ghostOrbit, updateFields, drawGroundFields, drawAirFields, clearFields,
           get fieldCount() { return fields.length; } };
})();
