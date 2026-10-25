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
    if (script === 'rayquaza') { Object.assign(e.tsc, { phase: 1, ascentT: 6, gustT: 6, streamT: 4, chain: 0 }); e.noEnrage = true; }
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
    ctx.save();
    ctx.fillStyle = 'rgba(6,2,16,.86)';
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    for (const p of ps) {
      const sx = (p.x - cam.left()) * cam.scale, sy = (p.y - 20 - cam.top()) * cam.scale, r = 175 * cam.scale;
      ctx.moveTo(sx + r, sy);
      ctx.arc(sx, sy, r, 0, 6.2832, true);
    }
    ctx.fill('evenodd');
    ctx.restore();
  }

  return { reset, setup, move, pairTwins, tick, onNet, drawOverlay, get dark() { return dark; } };
})();
