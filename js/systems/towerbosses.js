/* ============ towerbosses.js — Battle Tower bosses with a script of their own ============
 *
 * Every other boss uses the shared kit in entities/enemy.js (Stomp, Charge or Leap, two ranged attacks by type,
 * enraged below half health). A scripted boss gets `e.script` and its move() runs first every frame:
 * it returns [vx, vy, anim] to take over, or null to let the shared kit act. These are the templates for
 * redesigning the rest of the bosses: one mechanic of its own, phases that add something, a punish window.
 *
 *   slaking   Truant: it acts, then loafs for 3 s (takes +25% damage, stands still). Below half health,
 *             Slack Off heals it and it skips loafing for a while.
 *   gengar    Shadow clones: Double Team every 14 s, two clones and a shuffle; only the real one casts a
 *             shadow. Below half health the lights go out: you only see close around you.
 *   rayquaza  The summit, 3 phases: Dragon Ascent (three chained charges); at 2/3 health a storm with wind
 *             gusts that push everyone; at 1/3 Delta Stream (spinning cross beams) and Draco Meteor.
 *   twins     Plusle and Minun (Expedition event): when one falls it gets back up unless its partner falls
 *             within 6 s.
 *   Gatekeepers: the shared kit plus two signature attacks each, one every 7-10 s, taking turns (SIG):
 *     entei     Eruption Line (blasts racing along the ground towards you) · Fire Spin (a ring of fire around
 *               you with one gap, then the middle goes up)
 *     suicune   Aurora Sweep (a fan of beams firing one after another, a sweep to outrun) · Tidal Wave (rows of
 *               water rolling across the arena, each with a gap)
 *     raikou    Thunder Cage (strikes at four corners around you, then where you stand) · Volt Dash (three
 *               charges in a row, each leaving a shocking trail)
 *     groudon   Precipice Blades (six lines of blasts running outwards from it) · Eruption Field (blasts all over
 *               the arena at once, one on you)
 *   Rayquaza also rains Draco Meteor fields from phase 2.
 *
 * Only the host (or solo) runs the scripts. What every computer must see or feel (floating text, the wind,
 * the darkness) goes out as 'tw' 'sc' events (systems/tower.js -> onNet).
 */
G.TowerBosses = (() => {
  const authority = () => !G.Coop.active || G.Coop.isHost;
  const TS = () => G.Tiles.T * G.Sprites.PX;

  // ---- shared state every computer keeps (sent with 'sc') ----
  let wind = null;        // { a, t, dur, f } gust pushing the local player
  let dark = false;       // Gengar's lights out

  function reset() { wind = null; dark = false; }

  /** Effects everyone sees: run here and send it. */
  function net(...ev) {
    apply(ev);
    if (G.Coop.isHost) G.Coop.broadcast(['tw', 'sc', ...ev]);
  }
  function apply(ev) {
    switch (ev[0]) {
      case 'tx': {                       // floating text over an enemy: id, text, colour
        const e = G.EnemyMgr.get(ev[1]);
        if (e) G.FX.dmgText(e.x, e.y - e.bodyH - 14, ev[2], ev[3], true);
        break;
      }
      case 'wind': wind = { a: ev[1], t: 0, dur: ev[2], f: ev[3] }; G.Audio.sfx('surge'); break;
      case 'wx': G.Weather.force(ev[1], ev[2]); break;
      case 'dark': dark = !!ev[1]; G.Game.flash(dark ? '#1a0b33' : '#ffffff', 0.6); break;
      case 'say': G.Spawner.say(ev[1], ev[2] || 2.6, true); break;
      case 'flash': G.Game.flash(ev[1], ev[2] || 0.6); G.Camera.kick(1.1); break;
    }
  }
  function onNet(ev) { apply(ev.slice(2)); }

  /** Every computer, every frame: the wind pushes your own Pokémon. */
  function tick(dt) {
    const pl = G.Game.player;
    if (!wind || !pl) return;
    wind.t += dt;
    if (wind.t >= wind.dur) { wind = null; return; }
    if (!pl.dead) {
      pl.x += Math.cos(wind.a) * wind.f * dt;
      pl.y += Math.sin(wind.a) * wind.f * dt;
      G.World.collide(pl);
    }
    if (Math.random() < dt * 30) {
      const c = G.Camera;
      G.FX.px(c.x + G.U.rand(-400, 400), c.y + G.U.rand(-260, 260), '#e8f6ff', { vx: Math.cos(wind.a) * 420, vy: Math.sin(wind.a) * 420, life: 0.5 });
    }
  }

  // ---------------- setup ----------------

  function setup(e, script) {
    e.script = script;
    e.tsc = { t: 0 };
    if (script === 'slaking') Object.assign(e.tsc, { mode: 'act', left: 5, slackCd: 0 });
    if (script === 'gengar') Object.assign(e.tsc, { teamT: 4, clones: [] });
    if (script === 'rayquaza') { Object.assign(e.tsc, { phase: 1, ascentT: 6, gustT: 6, streamT: 4, chain: 0, meteorT: 5 }); e.noEnrage = true; }
    if (SIG[script]) Object.assign(e.tsc, { sigT: 4, sigI: 0, chain: 0 });
  }

  function move(e, dt, pl, dist, dx, dy, spd) {
    const S = e.tsc;
    if (!S) return null;
    S.t += dt;
    switch (e.script) {
      case 'slaking': return slaking(e, S, dt, pl);
      case 'gengar': return gengar(e, S, dt, pl);
      case 'rayquaza': return rayquaza(e, S, dt, pl);
      case 'twins': return twins(e, S, dt);
      case 'entei': case 'suicune': case 'raikou': case 'groudon': return signature(e, S, dt, pl);
    }
    return null;
  }

  // ---------------- Slaking: Truant ----------------
  function slaking(e, S, dt, pl) {
    const ai = e.ai;
    S.slackCd -= dt;
    if (S.mode === 'act') {
      S.left -= dt;
      if (S.left <= 0 && !ai.cast && !e.jump) {
        if (e.hp < e.maxHp * 0.5 && S.slackCd <= 0) {
          // Slack Off: heals and keeps going for 10 s.
          e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.06);
          S.slackCd = 22; S.left = 10;
          net('tx', e.id, 'Slack Off!', '#8fffb0');
          G.FX.ring(e.x, e.y, 8, 90, '#8fffb0', 0.6, 4);
        } else {
          S.mode = 'loaf'; S.left = 3.2; S.zT = 0;
          e.vuln(3.2);
          net('tx', e.id, 'Loafing around…', '#cfe0ff');
        }
      }
      return null;
    }
    // Loafing: still, and an easy target.
    S.left -= dt;
    if ((S.zT -= dt) <= 0) { S.zT = 0.8; net('tx', e.id, 'z', '#cfe0ff'); }
    if (S.left <= 0) { S.mode = 'act'; S.left = e.ai.fury ? 4 : 5.5; ai.cd = 0.4; }
    e.anim.loop('Idle', 0.4);
    return [0, 0, 'Idle'];
  }

  // ---------------- Gengar: shadow clones ----------------
  function gengar(e, S, dt, pl) {
    if (!dark && e.hp < e.maxHp * 0.5) {
      net('dark', 1);
      net('say', 'Gengar put out the lights!', 2.6);
    }
    S.clones = S.clones.filter(id => { const c = G.EnemyMgr.get(id); return c && !c.dead; });
    S.teamT -= dt;
    if (S.teamT <= 0 && !e.ai.cast && !e.jump) {
      S.teamT = e.ai.fury ? 11 : 14;
      doubleTeam(e, S);
    }
    // Clones only last a while.
    for (const id of S.clones) {
      const c = G.EnemyMgr.get(id);
      if (c && (c.cloneT -= dt) <= 0) { G.FX.burst(c.x, c.y - 20, '#7b5cff', 14, 120); c.hp = 0; c.dead = true; c.fade = 0.3; }
    }
    return null;
  }

  function doubleTeam(e, S) {
    const arena = G.Tower.floor, ts = TS();
    if (!arena) return;
    const spots = [];
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * 6.2832, d = G.U.rand(2, (arena.cfg.r - 3)) * ts;
      spots.push([arena.x + Math.cos(a) * d, arena.y + Math.sin(a) * d * 0.85]);
    }
    G.FX.burst(e.x, e.y - 20, '#7b5cff', 24, 160);
    [e.x, e.y] = spots[0];
    for (let i = 1; i < 3; i++) {
      const def = Object.assign({}, e.def, { hp: Math.max(1, Math.round(e.maxHp * 0.04)), behavior: 'clone' });
      const c = new G.Enemy(def, spots[i][0], spots[i][1], { hp: 1, spd: 1, dmg: 0.35 }, true);
      c.maxHp = c.hp = def.hp;
      c.flying = false; c.cloneT = 9; c.tower = 'clone'; c.noEnrage = true;
      if (e.shiny) c.makeShiny();
      G.EnemyMgr.add(c);
      S.clones.push(c.id);
      G.FX.burst(c.x, c.y - 20, '#7b5cff', 18, 140);
    }
    net('tx', e.id, 'Double Team!', '#c9a6ff');
    G.Audio.sfx('rift');
  }

  // ---------------- Rayquaza: the summit ----------------
  function rayquaza(e, S, dt, pl) {
    const ai = e.ai, f = e.hp / e.maxHp;
    // Phase changes: a short untouchable roar, then something new.
    if (S.phase === 1 && f < 0.66) { S.phase = 2; roar(e, 'Rayquaza calls up a storm!'); net('wx', 'rain', 9999); net('flash', '#cfe8ff', 0.6); }
    if (S.phase === 2 && f < 0.33) {
      S.phase = 3; roar(e, 'DELTA STREAM');
      ai.fury = true; e.spd *= 1.15;
      net('flash', '#b8ffd0', 0.8);
    }
    if (e.megaT > 0) { e.megaT -= dt; e.anim.loop('Idle', 1); return [0, 0, 'Idle']; }

    // Dragon Ascent: three charges one after another.
    if (S.chain > 0 && !ai.cast) { S.chain--; e.bossStart('dash', pl); return e.bossCast(dt, pl); }
    S.ascentT -= dt;
    if (S.ascentT <= 0 && !ai.cast && !e.jump) {
      S.ascentT = S.phase === 3 ? 8 : 11;
      net('tx', e.id, 'Dragon Ascent!', '#8fffb0');
      S.chain = 2;
      e.bossStart('dash', pl);
      return e.bossCast(dt, pl);
    }
    // Phase 2+: Hurricane gusts push everyone one way.
    if (S.phase >= 2 && (S.gustT -= dt) <= 0) {
      S.gustT = S.phase === 3 ? 7 : 9;
      net('wind', Math.round(Math.random() * 628) / 100, 2.4, S.phase === 3 ? 150 : 120);
      net('say', 'Hurricane!', 1.6);
    }
    // Phase 2+: Draco Meteor fields.
    if (S.phase >= 2 && (S.meteorT -= dt) <= 0 && !ai.cast) {
      S.meteorT = S.phase === 3 ? 10 : 13;
      eruptionField(e, pl, '#b48aff', 'dragon');
      net('tx', e.id, 'Draco Meteor!', '#c9a6ff');
    }
    // Phase 3: Delta Stream, a spinning cross of warned beams from where it stands.
    if (S.phase === 3 && (S.streamT -= dt) <= 0 && !ai.cast) {
      S.streamT = 6;
      const a0 = Math.random() * 1.57, col = '#7fffb0';
      for (let k = 0; k < 4; k++) {
        for (let w = 0; w < 2; w++) {
          G.Hazards.add({ sd: e.dex, own: e.hzOwner(), from: e, kind: 'beam', x: e.x, y: e.y, angle: a0 + k * 1.5708 + w * 0.39, len: 520, w: 30,
                          delay: 1.1 + w * 0.7, dmg: e.shotDmg() * 1.3, type: 'dragon', color: col });
        }
      }
      // Draco Meteor: bigger zones around you.
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * 6.2832, d = G.U.rand(30, 150);
        G.Hazards.add({ sd: e.dex, own: e.hzOwner(), from: e, kind: 'zone', x: pl.x + Math.cos(a) * d, y: pl.y + Math.sin(a) * d * 0.8, r: 70,
                        delay: 1.4 + i * 0.25, dmg: e.shotDmg() * 1.4, type: 'dragon', color: '#b48aff' });
      }
      net('tx', e.id, 'Delta Stream!', '#7fffb0');
    }
    return null;
  }

  function roar(e, text) {
    e.megaT = 2.2;                      // untouchable while it roars (Enemy.hurt)
    if (e.ai) e.ai.cast = null;
    G.Hazards.cancelOwner(e.id);
    net('say', text, 3);
    G.Audio.sfx('boss');
  }

  // ---------------- gatekeepers' signature attacks ----------------

  const zone = (e, x, y, r, delay, k = 1.25, color, type) => G.Hazards.add({ sd: e.dex, own: e.hzOwner(), from: e, kind: 'zone', x, y, r, delay,
    dmg: e.shotDmg() * k, type: type || e.atkType, color: color || G.U.TYPE_COLOR[e.atkType] || '#ff7a9e' });
  const beam = (e, angle, len, w, delay, k = 1.2, color) => G.Hazards.add({ sd: e.dex, own: e.hzOwner(), from: e, kind: 'beam', x: e.x, y: e.y, angle, len, w, delay,
    dmg: e.shotDmg() * k, type: e.atkType, color: color || G.U.TYPE_COLOR[e.atkType] || '#ff7a9e' });
  /** The boss stands still while it casts (the shared kit's bossCast runs the pause). */
  function hold(e, wind, after = 0.4, anim = 'Charge') { e.ai.cast = { id: 'sig', t: 0, wind, after, ang: 0 }; e.anim.play(anim, { speed: 1.2 }); }
  const angTo = (e, pl) => Math.atan2(pl.y - e.y, pl.x - e.x);

  function eruptionLine(e, pl) {
    const a = angTo(e, pl), lines = e.ai.fury ? [-0.4, 0, 0.4] : [0];
    for (const off of lines) for (let i = 1; i <= 8; i++) zone(e, e.x + Math.cos(a + off) * i * 70, e.y + Math.sin(a + off) * i * 70 * 0.85, 50, 0.8 + i * 0.12, 1.3, '#ff7a3d', 'fire');
    hold(e, 0.8, 1.0);
    net('tx', e.id, 'Eruption!', '#ffb36b');
  }
  function fireSpin(e, pl) {
    const n = 12, gap = Math.floor(Math.random() * n), cx = pl.x, cy = pl.y;
    for (let i = 0; i < n; i++) {
      if (i === gap || i === (gap + 1) % n) continue;
      const a = i / n * 6.2832;
      zone(e, cx + Math.cos(a) * 125, cy + Math.sin(a) * 125 * 0.8, 42, 1.2, 1.2, '#ff5a2a', 'fire');
    }
    zone(e, cx, cy, 80, 2.0, 1.5, '#ff5a2a', 'fire');          // then the middle goes up: get out through the gap
    hold(e, 0.7, 0.8);
    net('tx', e.id, 'Fire Spin!', '#ffb36b');
  }
  function auroraSweep(e, pl) {
    const a = angTo(e, pl), n = 9, dir = Math.random() < 0.5 ? -1 : 1;
    for (let i = 0; i < n; i++) beam(e, a + dir * (i / (n - 1) - 0.5) * 2.4, 480, 30, 0.9 + i * 0.13, 1.25, '#9fe8ff');
    hold(e, 0.9, 1.3);
    net('tx', e.id, 'Aurora Beam!', '#bff3ff');
  }
  function tidalWave(e, pl) {
    // Rows of water across the arena, rolling from Suicune's side through you, each with a 2-blast gap.
    const a = angTo(e, pl), px = -Math.sin(a), py = Math.cos(a);
    for (let row = 0; row < 5; row++) {
      const d = 60 + row * 85, gap = Math.floor(Math.random() * 8);
      for (let k = -4; k <= 4; k++) {
        if (k + 4 === gap || k + 4 === gap + 1) continue;
        const x = e.x + Math.cos(a) * d + px * k * 64, y = e.y + Math.sin(a) * d * 0.85 + py * k * 64 * 0.85;
        zone(e, x, y, 38, 1.0 + row * 0.35, 1.15, '#4fb4ff', 'water');
      }
    }
    hold(e, 1.0, 1.6);
    net('tx', e.id, 'Tidal Wave!', '#9fdcff');
  }
  function thunderCage(e, pl) {
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) zone(e, pl.x + dx * 85, pl.y + dy * 70, 56, 1.0, 1.25, '#ffe14d', 'electric');
    zone(e, pl.x, pl.y, 76, 1.7, 1.45, '#ffe14d', 'electric');
    hold(e, 0.6, 1.0, 'Shoot');
    net('tx', e.id, 'Thunder!', '#fff3a0');
  }
  function voltDash(e, pl) {
    e.bossStart('dash', pl);
    const c = e.ai.cast;
    // A shocking trail along the charge, going off just after it passes.
    for (let i = 1; i <= 6; i++) zone(e, e.x + Math.cos(c.ang) * i * 55, e.y + Math.sin(c.ang) * i * 55, 34, c.wind + c.dur + 0.25, 0.9, '#ffe14d', 'electric');
  }
  function precipice(e, pl) {
    const a0 = angTo(e, pl);
    for (let k = 0; k < 6; k++) {
      const a = a0 + k * 1.0472;
      for (let i = 1; i <= 4; i++) zone(e, e.x + Math.cos(a) * i * 80, e.y + Math.sin(a) * i * 80 * 0.85, 44, 0.9 + i * 0.18, 1.35, '#ff7a3d', 'ground');
    }
    hold(e, 0.9, 1.2);
    net('tx', e.id, 'Precipice Blades!', '#ffb36b');
  }
  function eruptionField(e, pl, color = '#ff7a3d', type = 'fire') {
    const f = G.Tower.floor, ts = G.Tiles.T * G.Sprites.PX;
    const cx = f ? f.x : e.x, cy = f ? f.y : e.y, R = f ? (f.cfg.r - 2) * ts : 400;
    zone(e, pl.x, pl.y, 66, 1.5, 1.4, color, type);
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * 6.2832, d = Math.sqrt(Math.random()) * R;
      zone(e, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.85, 66, 1.5 + Math.random() * 0.4, 1.4, color, type);
    }
    hold(e, 0.8, 0.8, 'Shoot');
  }
  const SIG = { entei: [eruptionLine, fireSpin], suicune: [auroraSweep, tidalWave], raikou: [thunderCage, voltDash], groudon: [precipice, eruptionField] };

  /** Gatekeepers: the shared kit, with a signature attack every 7-10 s (faster when enraged), taking turns. */
  function signature(e, S, dt, pl) {
    const ai = e.ai;
    if (S.chain > 0 && !ai.cast && !e.jump) { S.chain--; voltDash(e, pl); return e.bossCast(dt, pl); }
    S.sigT -= dt * (ai.fury ? 1.4 : 1);
    if (S.sigT > 0 || ai.cast || e.jump) return null;
    S.sigT = G.U.rand(7, 10);
    const f = SIG[e.script][S.sigI++ % 2];
    if (f === voltDash) { S.chain = 2; net('tx', e.id, 'Volt Dash!', '#fff3a0'); }
    if (f === eruptionField) net('tx', e.id, 'Eruption!', '#ffb36b');
    f(e, pl);
    return e.bossCast(dt, pl);
  }

  // ---------------- Plusle & Minun: Twin Bond ----------------
  function pairTwins(a, b) {
    for (const [x, y] of [[a, b], [b, a]]) {
      x.tsc = { t: 0, down: false, downT: 0 }; x.script = 'twins'; x.twin = y.id; x.noEnrage = true;
      x.onLethal = () => {
        const o = G.EnemyMgr.get(x.twin);
        if (!o || o.dead) return false;               // partner gone: this one falls for good
        if (x.tsc.down) { x.hp = 1; return true; }     // already down: hits do nothing, the clock keeps running
        if (o.tsc && o.tsc.down) {                       // both down at once: both fall
          o.onLethal = null; o.hp = 0; o.die();
          return false;
        }
        x.hp = 1; x.tsc.down = true; x.tsc.downT = 6;
        if (x.ai) x.ai.cast = null;
        G.Hazards.cancelOwner(x.id);
        x.anim.play('Faint', { hold: true });
        net('tx', x.id, 'Down! (6 s)', '#ffd23f');
        return true;
      };
    }
  }

  function twins(e, S, dt) {
    if (!S.down) return null;
    S.downT -= dt;
    if (S.downT <= 0) {
      S.down = false;
      e.hp = Math.round(e.maxHp * 0.5);
      e.anim.play('Idle');
      net('tx', e.id, 'Back up!', '#ff8a8a');
      net('say', e.name + ' got back up! Down them together', 2.6);
      return null;
    }
    return [0, 0, 'Faint'];
  }

  // ---------------- drawing ----------------

  /** Screen space, over the scene: Gengar's darkness with a circle of light around each player. */
  function drawOverlay(ctx, w, h) {
    if (!dark || !G.Tower.active) return;
    const cam = G.Camera, ps = G.Game.everyone().filter(p => !p.dead);
    // (Shared with the Mystery Dungeon: overlapping lights add up instead of cancelling out.)
    G.TowerFloors.darkness(ctx, w, h, ps.map(p => [(p.x - cam.left()) * cam.scale, (p.y - 20 - cam.top()) * cam.scale, 190 * cam.scale]), 'rgba(6,2,16,.86)');
  }

  return { reset, setup, move, pairTwins, tick, onNet, drawOverlay, get dark() { return dark; } };
})();
