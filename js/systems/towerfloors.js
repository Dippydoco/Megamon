/* ============ towerfloors.js — the Battle Tower's floor types ============
 *
 * Every floor kind that isn't a plain horde, a boss or a co-op event lives here, as one object each. tower.js
 * looks a kind up with get(kind) and calls, when the kind has them:
 *
 *   plan(cfg)            host: adds what every computer needs to cfg before it's sent (positions, a seed)
 *   map(cfg)             every computer: a tile map for World.setArena (dungeon floors); built from cfg.seed
 *   spawn(fl)            where players appear [x, y] (default: south of the centre)
 *   start(fl)            host: when the fight starts (first enemies, timers)
 *   tick(fl, dt)         host: every frame of the fight; returns true when the floor is beaten
 *   local(fl, dt)        every computer: things that touch only your own Pokémon (storm, traps)
 *   state(fl) / apply(fl, st)   host -> guests, 4 times a second, for what the HUD and the drawing need
 *   hud(fl)              { goal, col } for the HUD line under the floor number
 *   drawGround / drawables / drawOverlay   drawing (ground, Y-sorted things, screen-space)
 *   bonus(fl)            extra Battle Points when cleared
 *   spawnPoint(fl)       where trickle spawns go (dungeon floors)
 *
 *   objective  survival (last 75 s, a storm closes in at the end) · bounty (3 marked Pokémon) · relic (5 shards,
 *              each calls a wave) · hold (a moving zone) · escort (a lost Pokémon to the exit)
 *   puzzle     lights (Lights Out, 3×3) · sequence (Unown plates in the shown order). Climb only. Few enemies
 *              until a soft 90 s timer runs out; then they trickle in, so you're pushed on, never failed.
 *   dungeon    gauntlet (a corridor of rolling boulders and flame jets to a door; a speed bonus)
 *              dungeon (Mystery Dungeon: rooms and corridors, darkness, sleeping Pokémon, hidden traps, stairs)
 *
 * It also draws the landing's stairways (stairsDrawables) and the run of choice they offer (tower.js 'next').
 */
G.TowerFloors = (() => {
  const T = () => G.Tower;
  const TS = () => G.Tiles.T * G.Sprites.PX;
  const auth = () => !G.Coop.active || G.Coop.isHost;
  const alive = () => G.Game.everyone().filter(p => !p.dead);
  const near = (p, x, y, r) => G.U.dist2(p.x, p.y, x, y) < r * r;
  const anyNear = (x, y, r) => alive().some(p => near(p, x, y, r));
  const enemies = () => G.EnemyMgr.all().filter(e => !e.dead).length;
  const capFor = (fl, k = 1) => Math.round((10 + fl.cfg.n / 4) * (1 + 0.5 * (fl.cfg.np - 1)) * k);
  const hazardDmg = cfg => Math.round(12 + cfg.t / 30);
  const PUZZLE_TIME = 90;

  /** A point of the round arena from fractions of its radius (y squashed a little, like the plates). */
  const at = (fl, f) => [fl.x + f[0] * fl.cfg.r * TS(), fl.y + f[1] * fl.cfg.r * TS() * 0.85];
  function randFrac(min, max) { const a = Math.random() * 6.2832, d = G.U.rand(min, max); return [Math.round(Math.cos(a) * d * 100) / 100, Math.round(Math.sin(a) * d * 100) / 100]; }

  /** Host: keeps up to `cap` enemies, one every `every` seconds. */
  function trickle(fl, dt, cap, every) {
    fl.spawnT = (fl.spawnT || 0) - dt;
    if (fl.spawnT <= 0 && enemies() < cap) { fl.spawnT = every; T().spawnWild(); }
  }
  function useBag(fl) { fl.bag = T().themedBag(fl.cfg); G.Sprites.preload(fl.bag.map(d => d.dex), 8000); }

  function label(ctx, text, x, y, size, col) {
    ctx.font = '800 ' + size + 'px Pixelify, monospace';
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(text, x, y);
    ctx.fillStyle = col; ctx.fillText(text, x, y);
  }
  function disc(ctx, x, y, r, fill, alpha, stroke) {
    ctx.save();
    ctx.globalAlpha = alpha; ctx.fillStyle = fill;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.7, 0, 0, 6.2832); ctx.fill();
    if (stroke) { ctx.globalAlpha = 0.9; ctx.strokeStyle = stroke; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.restore();
  }
  /** Soft timer for puzzles: HUD text once it runs out. */
  const softLeft = fl => PUZZLE_TIME - fl.t;

  // =============================== objective floors ===============================

  const survival = {
    plan(cfg) { cfg.dur = 75; },
    start(fl) { useBag(fl); for (let i = 0; i < 4 + 2 * fl.cfg.np; i++) T().spawnWild(); },
    tick(fl, dt) {
      const step = Math.floor(fl.t / 15);
      trickle(fl, dt, capFor(fl) + step * 3, Math.max(0.18, 0.6 - step * 0.1));
      return fl.t >= fl.cfg.dur;
    },
    /** The storm: in the last 20 s a ring closes to 40% of the arena; outside it you lose 6% HP a second. */
    stormR(fl) {
      const left = fl.cfg.dur - fl.t;
      if (fl.phase !== 'fight' || left > 20) return 0;
      return (fl.cfg.r - 1) * TS() * (1 - 0.6 * G.U.clamp((20 - left) / 20, 0, 1));
    },
    local(fl, dt) {
      const R = survival.stormR(fl), pl = G.Game.player;
      if (!R || !pl || pl.dead || G.U.dist2(pl.x, pl.y, fl.x, fl.y) < R * R) { fl.stormT = 0; return; }
      if ((fl.stormT = (fl.stormT || 0) - dt) <= 0) { fl.stormT = 0.5; pl.hurt(pl.maxHp * 0.03, null, true, { k: 'liquid' }); }
    },
    state: fl => [Math.round(fl.t * 10) / 10],
    apply(fl, st) { fl.t = st[0]; },
    hud(fl) {
      const left = Math.max(0, fl.cfg.dur - fl.t);
      return { goal: 'SURVIVE ' + G.U.mmss(left) + (left <= 20 ? ' · THE STORM CLOSES IN' : ''), col: left <= 20 ? '#ff8a8a' : '#ffffff' };
    },
    drawGround(ctx, fl) {
      const R = survival.stormR(fl);
      if (!R) return;
      ctx.save();
      ctx.strokeStyle = '#b48aff'; ctx.lineWidth = 6; ctx.globalAlpha = 0.8 + 0.2 * Math.sin(performance.now() / 150);
      ctx.beginPath(); ctx.arc(fl.x, fl.y, R, 0, 6.2832); ctx.stroke();
      ctx.globalAlpha = 0.18; ctx.fillStyle = '#3a1a5a';
      ctx.beginPath(); ctx.arc(fl.x, fl.y, R + 1400, 0, 6.2832); ctx.arc(fl.x, fl.y, R, 0, 6.2832, true); ctx.fill();
      ctx.restore();
    }
  };

  const bounty = {
    start(fl) {
      useBag(fl);
      for (let i = 0; i < 4 + 2 * fl.cfg.np; i++) T().spawnWild();
      fl.marks = [];
      for (let i = 0; i < 3; i++) {
        const e = T().spawnWild(true);
        if (!e) continue;
        e.maxHp = e.hp = Math.round(e.maxHp * 4); e.xp *= 3; e.dmg *= 1.3; e.bounty = true;
        fl.marks.push(e.id);
      }
    },
    tick(fl, dt) {
      trickle(fl, dt, capFor(fl), 0.5);
      const left = fl.marks.filter(id => { const e = G.EnemyMgr.get(id); return e && !e.dead; });
      if (left.length < fl.marks.length) fl.lastGot = fl.t;
      fl.got = 3 - left.length;
      fl.marks = left;
      if (fl.t - (fl.lastGot || 0) > 14) { fl.lastGot = fl.t; T().regroup(); }       // a mark hiding: bring it back
      return !left.length;
    },
    state: fl => [fl.got || 0, fl.marks],
    apply(fl, st) { fl.got = st[0]; fl.marks = st[1]; },
    hud: fl => ({ goal: 'BOUNTY: DEFEAT THE MARKED POKÉMON · ' + (fl.got || 0) + ' / 3', col: '#ffd23f' }),
    drawables(fl) {
      return (fl.marks || []).map(id => G.EnemyMgr.get(id)).filter(e => e && !e.dead).map(e => ({
        y: e.y + 1,
        draw(ctx) {
          const b = Math.sin(performance.now() / 180) * 3;
          ctx.save();
          ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 2;
          const x = e.x, y = e.y - e.bodyH - 26 + b;
          ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.lineTo(x, y + 12); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r * 1.7, e.r * 0.65, 0, 0, 6.2832); ctx.fill();
          ctx.restore();
        }
      }));
    }
  };

  const relic = {
    plan(cfg) { cfg.shards = []; for (let i = 0; i < 5; i++) cfg.shards.push(randFrac(0.3, 0.8)); },
    start(fl) { useBag(fl); fl.mask = 0; for (let i = 0; i < 3 + cfg2(fl); i++) T().spawnWild(); },
    tick(fl, dt) {
      trickle(fl, dt, capFor(fl, 0.8), 0.7);
      fl.cfg.shards.forEach((f, i) => {
        if (fl.mask & (1 << i)) return;
        const [x, y] = at(fl, f);
        if (!anyNear(x, y, 34)) return;
        fl.mask |= 1 << i;
        G.Audio.sfx('shiny');
        G.FX.ring(x, y, 6, 90, '#7fe0ff', 0.6, 4);
        for (let k = 0; k < 3 + fl.cfg.np; k++) T().spawnWild();          // each shard calls a wave
      });
      return fl.mask === 31;
    },
    state: fl => [fl.mask || 0],
    apply(fl, st) { fl.mask = st[0]; },
    hud: fl => ({ goal: 'RELIC HUNT: SHARDS ' + bitsOf(fl.mask || 0) + ' / 5', col: '#7fe0ff' }),
    drawables(fl) {
      return fl.cfg.shards.map((f, i) => {
        const [x, y] = at(fl, f);
        return { y, draw(ctx) {
          if ((fl.mask || 0) & (1 << i)) return;
          const t = performance.now() / 1000, b = Math.sin(t * 3 + i) * 4;
          disc(ctx, x, y, 22, '#7fe0ff', 0.25);
          ctx.save();
          ctx.fillStyle = '#bff3ff'; ctx.strokeStyle = '#1d5a7a'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x, y - 34 + b); ctx.lineTo(x + 10, y - 18 + b); ctx.lineTo(x, y - 4 + b); ctx.lineTo(x - 10, y - 18 + b); ctx.closePath();
          ctx.fill(); ctx.stroke();
          ctx.restore();
        } };
      });
    }
  };
  const cfg2 = fl => 2 * fl.cfg.np;

  const hold = {
    plan(cfg) { cfg.zones = []; for (let i = 0; i < 6; i++) cfg.zones.push(randFrac(0.15, 0.65)); },
    start(fl) { useBag(fl); fl.prog = 0; for (let i = 0; i < 3 + cfg2(fl); i++) T().spawnWild(); },
    zone: fl => Math.floor(fl.t / 10) % fl.cfg.zones.length,
    tick(fl, dt) {
      trickle(fl, dt, capFor(fl, 0.8), 0.6);
      const [x, y] = at(fl, fl.cfg.zones[hold.zone(fl)]);
      fl.inZone = anyNear(x, y, 60);
      fl.prog = G.U.clamp(fl.prog + (fl.inZone ? dt / 30 : -dt / 60), 0, 1);
      return fl.prog >= 1;
    },
    state: fl => [Math.round(fl.prog * 100) / 100, Math.round(fl.t * 10) / 10, fl.inZone ? 1 : 0],
    apply(fl, st) { fl.prog = st[0]; fl.t = st[1]; fl.inZone = !!st[2]; },
    hud: fl => ({ goal: 'HOLD THE GROUND ' + Math.round((fl.prog || 0) * 100) + '% · THE ZONE MOVES IN ' + Math.ceil(10 - fl.t % 10) + 's', col: fl.inZone ? '#8fffb0' : '#ffe27a' }),
    drawGround(ctx, fl) {
      if (fl.phase !== 'fight') return;
      const [x, y] = at(fl, fl.cfg.zones[hold.zone(fl)]);
      disc(ctx, x, y, 60, fl.inZone ? '#8fffb0' : '#ffe27a', 0.25, fl.inZone ? '#d8ffe4' : '#fff3c8');
      ctx.save();
      ctx.lineWidth = 6; ctx.strokeStyle = '#ffd23f';
      ctx.beginPath(); ctx.ellipse(x, y, 70, 49, 0, -Math.PI / 2, -Math.PI / 2 + 6.2832 * (fl.prog || 0)); ctx.stroke();
      ctx.restore();
    }
  };

  // A lost Pokémon to bring to the exit at the north of the arena. It follows the nearest player, nearby enemies
  // hurt it, and if it faints it gets back up after 4 s (no fail state: it just slows you down).
  const LOST = [175, 172, 440, 173, 238, 298, 360, 406];
  const escort = {
    plan(cfg) { cfg.dex = LOST[Math.floor(Math.random() * LOST.length)]; },
    spawn(fl) { return [fl.x, fl.y + (fl.cfg.r - 3) * TS()]; },
    start(fl) {
      useBag(fl);
      fl.esc = { x: fl.x, y: fl.y + (fl.cfg.r - 4) * TS(), hp: 1, down: 0, r: 10 };
      for (let i = 0; i < 2 + fl.cfg.np; i++) T().spawnWild();
    },
    exit: fl => [fl.x, fl.y - (fl.cfg.r - 2.4) * TS()],
    tick(fl, dt) {
      trickle(fl, dt, capFor(fl, 0.7), 0.8);
      const s = fl.esc, ps = alive();
      if (s.down > 0) { if ((s.down -= dt) <= 0) { s.hp = 0.4; G.Spawner.say((G.DEX_BY[fl.cfg.dex] || {}).name + ' is back on its feet!', 2); } }
      else {
        let best = null, bd = Infinity;
        for (const p of ps) { const d = G.U.dist2(p.x, p.y, s.x, s.y); if (d < bd) { bd = d; best = p; } }
        if (best && bd > 48 * 48) {
          // Around columns and trees the way enemies go (the players' path field); if it still gets stuck for
          // 2 s, it hops to the player it follows.
          const pd = G.Path.dirFor(s, best);
          const [dx, dy] = pd || G.U.norm(best.x - s.x, best.y - s.y);
          const ox = s.x, oy = s.y;
          s.x += dx * 92 * dt; s.y += dy * 92 * dt;
          G.World.collide(s);
          s.moving = true;
          s.stuckT = Math.hypot(s.x - ox, s.y - oy) < 92 * dt * 0.3 ? (s.stuckT || 0) + dt : 0;
          if (s.stuckT > 2) { s.stuckT = 0; s.x = best.x + 30; s.y = best.y + 10; G.FX.ring(s.x, s.y, 4, 40, '#8fe3ff', 0.4, 3); }
        } else s.moving = false;
        for (const e of G.EnemyMgr.queryCircle(s.x, s.y, 40)) if (!e.dead) s.hp -= 0.05 * dt;
        if (s.hp <= 0) { s.hp = 0; s.down = 4; G.Spawner.say((G.DEX_BY[fl.cfg.dex] || {}).name + ' fainted! It needs a moment…', 2.2); }
      }
      const [ex, ey] = escort.exit(fl);
      return G.U.dist2(s.x, s.y, ex, ey) < 44 * 44;
    },
    state: fl => fl.esc ? [Math.round(fl.esc.x), Math.round(fl.esc.y), Math.round(fl.esc.hp * 100) / 100, fl.esc.down > 0 ? 1 : 0] : null,
    apply(fl, st) {
      if (!st) return;
      const s = fl.esc = fl.esc || { x: st[0], y: st[1], hp: 1, down: 0 };
      s.moving = Math.abs(st[0] - s.x) + Math.abs(st[1] - s.y) > 2;
      s.tx = st[0]; s.ty = st[1]; s.hp = st[2]; s.down = st[3];
    },
    local(fl, dt) {          // guests: glide towards the host's position
      const s = fl.esc;
      if (!s || auth() || s.tx == null) return;
      const k = Math.min(1, dt * 8);
      s.x += (s.tx - s.x) * k; s.y += (s.ty - s.y) * k;
    },
    hud(fl) {
      const nm = ((G.DEX_BY[fl.cfg.dex] || {}).name || 'it').toUpperCase(), s = fl.esc;
      return { goal: 'ESCORT ' + nm + ' TO THE EXIT' + (s ? (s.down > 0 ? ' · FAINTED' : ' · HP ' + Math.round(s.hp * 100) + '%') : ''), col: s && s.down > 0 ? '#ff8a8a' : '#8fe3ff' };
    },
    drawGround(ctx, fl) {
      const [x, y] = escort.exit(fl), t = performance.now() / 1000;
      disc(ctx, x, y, 50, '#8fe3ff', 0.25 + 0.1 * Math.sin(t * 3), '#dff6ff');
      label(ctx, 'EXIT', x, y + 6, 12, '#dff6ff');
    },
    drawables(fl) {
      const s = fl.esc;
      if (!s) return [];
      return [{ y: s.y, draw(ctx) {
        if (!fl.anim || fl.anim.dex !== fl.cfg.dex) fl.anim = new G.Sprites.Animator(fl.cfg.dex, 1);
        const a = fl.anim;
        a.loop(s.down > 0 ? 'Idle' : s.moving ? 'Walk' : 'Idle', s.down > 0 ? 0.3 : 1);
        a.update(1 / 60);
        G.Sprites.drawShadow(ctx, fl.cfg.dex, s.x, s.y, 1);
        a.draw(ctx, s.x, s.y, { alpha: s.down > 0 ? 0.5 : 1 });
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(s.x - 18, s.y + 8, 36, 5);
        ctx.fillStyle = s.down > 0 ? '#ff6b6b' : '#5fe08a'; ctx.fillRect(s.x - 18, s.y + 8, 36 * G.U.clamp(s.hp, 0, 1), 5);
        ctx.restore();
      } }];
    }
  };

  // =============================== puzzle floors (Climb only) ===============================

  // Lights Out: a 3×3 grid of tiles; stepping onto a tile flips it and its neighbours (up, down, left, right).
  // Scrambled from the solved state, so it can always be solved.
  const NB = i => [i, i - 3, i + 3, i % 3 ? i - 1 : -1, i % 3 < 2 ? i + 1 : -1].filter(j => j >= 0 && j < 9);
  const lights = {
    plan(cfg) {
      let m = 511;
      while (m === 511) { m = 511; for (let k = 0; k < 4 + Math.floor(Math.random() * 3); k++) for (const j of NB(Math.floor(Math.random() * 9))) m ^= 1 << j; }
      cfg.lit = m;
    },
    size: () => 1.8 * TS(),
    tileAt(fl, x, y) {
      const sz = lights.size(), x0 = fl.x - sz * 1.5, y0 = fl.y - sz * 2;
      const i = Math.floor((x - x0) / sz), j = Math.floor((y - y0) / sz);
      return i >= 0 && i < 3 && j >= 0 && j < 3 ? j * 3 + i : -1;
    },
    start(fl) { useBag(fl); fl.lit = fl.cfg.lit; fl.on = -1; },
    tick(fl, dt) {
      const pl = alive()[0];
      const idx = pl ? lights.tileAt(fl, pl.x, pl.y) : -1;
      if (idx >= 0 && idx !== fl.on) { for (const j of NB(idx)) fl.lit ^= 1 << j; G.Audio.sfx('select'); }
      fl.on = idx;
      if (softLeft(fl) <= 0) trickle(fl, dt, 6, 2);
      return fl.lit === 511;
    },
    state: fl => [fl.lit],
    apply(fl, st) { fl.lit = st[0]; },
    hud: fl => ({ goal: 'LIGHTS OUT: LIGHT ALL 9 TILES · ' + bitsOf(fl.lit == null ? fl.cfg.lit : fl.lit) + ' / 9' + (softLeft(fl) > 0 ? ' · ' + G.U.mmss(softLeft(fl)) : ' · THEY\'RE COMING'), col: softLeft(fl) > 0 ? '#ffe27a' : '#ff8a8a' }),
    drawGround(ctx, fl) {
      const sz = lights.size(), x0 = fl.x - sz * 1.5, y0 = fl.y - sz * 2, m = fl.lit == null ? fl.cfg.lit : fl.lit;
      ctx.save();
      for (let i = 0; i < 9; i++) {
        const x = x0 + (i % 3) * sz, y = y0 + Math.floor(i / 3) * sz, on = m & (1 << i);
        ctx.fillStyle = on ? '#ffe27a' : '#2a2040'; ctx.globalAlpha = on ? 0.75 : 0.8;
        ctx.fillRect(x + 4, y + 4, sz - 8, sz - 8);
        ctx.globalAlpha = 1; ctx.strokeStyle = on ? '#fff3c8' : '#6a5a9a'; ctx.lineWidth = 3;
        ctx.strokeRect(x + 4, y + 4, sz - 8, sz - 8);
      }
      ctx.restore();
    }
  };

  // Unown Sequence: six plates marked A-F light up in an order; step on them in that order. A wrong step resets
  // the sequence, calls a small wave and shows it again. Longer sequences in higher wings.
  const LETTERS = 'ABCDEF';
  const sequence = {
    plan(cfg) {
      cfg.seq = [];
      const len = 4 + cfg.section;
      for (let k = 0; k < len; k++) { let v; do v = Math.floor(Math.random() * 6); while (k && v === cfg.seq[k - 1]); cfg.seq.push(v); }
    },
    platePos: (fl, i) => at(fl, [Math.cos(i * 1.0472 - 1.5708) * 0.42, Math.sin(i * 1.0472 - 1.5708) * 0.42]),
    start(fl) { useBag(fl); fl.mode = 'show'; fl.showT = -1; fl.pos = 0; fl.on = -1; },
    tick(fl, dt) {
      if (softLeft(fl) <= 0) trickle(fl, dt, 6, 2);
      if (fl.mode === 'show') {
        fl.showT += dt;
        if (fl.showT >= fl.cfg.seq.length) { fl.mode = 'input'; fl.pos = 0; G.Spawner.say('Your turn: step on them in order', 2); }
        return false;
      }
      const pl = alive()[0];
      let idx = -1;
      if (pl) for (let i = 0; i < 6; i++) { const [x, y] = sequence.platePos(fl, i); if (near(pl, x, y, 40)) idx = i; }
      if (idx >= 0 && idx !== fl.on) {
        if (idx === fl.cfg.seq[fl.pos]) { fl.pos++; G.Audio.sfx('confirm'); fl.flash = { i: idx, ok: 1, t: 0.4 }; }
        else {
          fl.flash = { i: idx, ok: 0, t: 0.6 };
          G.Audio.sfx('back');
          G.Spawner.say('Wrong plate! Watch again…', 2);
          for (let k = 0; k < 3; k++) T().spawnWild();
          fl.mode = 'show'; fl.showT = -1.4; fl.pos = 0;
        }
      }
      fl.on = idx;
      if (fl.flash && (fl.flash.t -= dt) <= 0) fl.flash = null;
      return fl.pos >= fl.cfg.seq.length;
    },
    /** Which plate the sequence shows right now (-1 = none). */
    showing(fl) {
      if (fl.mode !== 'show' || fl.showT < 0) return -1;
      const k = Math.floor(fl.showT), f = fl.showT - k;
      return f < 0.75 ? fl.cfg.seq[k] : -1;
    },
    state: fl => [fl.mode === 'show' ? 1 : 0, Math.round((fl.showT || 0) * 100) / 100, fl.pos || 0],
    apply(fl, st) { fl.mode = st[0] ? 'show' : 'input'; fl.showT = st[1]; fl.pos = st[2]; },
    hud: fl => ({ goal: (fl.mode === 'input' ? 'UNOWN SEQUENCE: ' + (fl.pos || 0) + ' / ' + fl.cfg.seq.length : 'UNOWN SEQUENCE: WATCH THE PLATES') + (softLeft(fl) > 0 ? ' · ' + G.U.mmss(softLeft(fl)) : ' · THEY\'RE COMING'), col: '#c9a6ff' }),
    drawGround(ctx, fl) {
      const lit = sequence.showing(fl);
      for (let i = 0; i < 6; i++) {
        const [x, y] = sequence.platePos(fl, i);
        const fla = fl.flash && fl.flash.i === i;
        const col = i === lit ? '#e2d0ff' : fla ? (fl.flash.ok ? '#8fffb0' : '#ff6b6b') : '#5a3a8a';
        disc(ctx, x, y, 40, col, i === lit || fla ? 0.75 : 0.45, '#c9a6ff');
        label(ctx, LETTERS[i], x, y + 7, 18, i === lit ? '#2a1050' : '#e2d0ff');
      }
    }
  };

  // =============================== dungeon floors ===============================

  /** A seeded random generator (every computer builds the same map from cfg.seed). */
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const toRows = g => g.map(r => r.join(''));
  /** Tile (map coordinates) -> world point (its centre). */
  const tilePt = (m, lx, ly) => [(m.x0 + lx + 0.5) * TS(), (m.y0 + ly + 0.5) * TS()];

  // ---- Gauntlet: a corridor 9 tiles wide; reach the door at the top. Rolling boulders cross the corridor ahead of
  // the leader, flame jets pulse at fixed spots, and a few Pokémon chase from behind. Under the par time: +2 BP. ----
  const GW = 13, GH = 72, PAR = 40;
  const gauntlet = {
    plan(cfg) { cfg.seed = Math.floor(Math.random() * 1e9); },
    map(cfg) {
      if (cfg._map) return cfg._map;
      const g = [];
      for (let y = 0; y < GH; y++) { const row = []; for (let x = 0; x < GW; x++) row.push(x < 2 || x >= GW - 2 || y < 2 || y >= GH - 2 ? '#' : '.'); g.push(row); }
      // Columns for cover, alternating sides.
      for (let y = 10, k = 0; y < GH - 8; y += 9, k++) { const x = k % 2 ? 3 : GW - 5; for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) g[y + b][x + a] = '#'; }
      const m = { x0: cfg.tx - Math.floor(GW / 2), y0: cfg.ty - Math.floor(GH / 2), w: GW, h: GH, rows: toRows(g) };
      Object.defineProperty(cfg, '_map', { value: m, enumerable: false });      // (kept out of the network copy)
      return m;
    },
    spawn(fl) { return tilePt(gauntlet.map(fl.cfg), GW / 2 - 0.5, GH - 5); },
    door(fl) { return tilePt(gauntlet.map(fl.cfg), GW / 2 - 0.5, 3); },
    jets(fl) { const out = []; for (let y = 15, k = 0; y < GH - 6; y += 12, k++) out.push(tilePt(gauntlet.map(fl.cfg), k % 2 ? 4 : GW - 5, y)); return out; },
    spawnPoint(fl) {
      const ps = alive(); if (!ps.length) return null;
      const back = ps.reduce((a, p) => (p.y > a.y ? p : a));
      const m = gauntlet.map(fl.cfg);
      for (let i = 0; i < 8; i++) {
        const x = (m.x0 + 3 + Math.random() * (GW - 6)) * TS(), y = Math.min(back.y + G.U.rand(260, 380), (m.y0 + GH - 3) * TS());
        if (G.World.isFree(x, y, 14)) return [x, y];
      }
      return null;
    },
    start(fl) { useBag(fl); fl.rollT = 2; fl.jetT = 1; fl.chaseT = 3; },
    tick(fl, dt) {
      const ps = alive(), m = gauntlet.map(fl.cfg), ts = TS(), dmg = hazardDmg(fl.cfg);
      if (!ps.length) return false;
      const lead = ps.reduce((a, p) => (p.y < a.y ? p : a));
      // Rolling boulders: a warned beam across the whole corridor, ahead of whoever leads.
      if ((fl.rollT -= dt) <= 0) {
        fl.rollT = G.U.rand(1.3, 2.1);
        const y = Math.max((m.y0 + 3) * ts, lead.y - G.U.rand(140, 360));
        G.Hazards.add({ kind: 'beam', x: m.x0 * ts, y, angle: 0, len: GW * ts, w: 34, delay: 1.2, dmg, type: 'rock', color: '#c9a27a' });
      }
      // Flame jets: all fire together every 3 s.
      if ((fl.jetT -= dt) <= 0) {
        fl.jetT = 3;
        for (const [x, y] of gauntlet.jets(fl)) G.Hazards.add({ kind: 'zone', x, y, r: 54, delay: 1.0, dmg, type: 'fire', color: '#ff7a3d' });
      }
      if ((fl.chaseT -= dt) <= 0 && enemies() < 4 + fl.cfg.np) { fl.chaseT = 4.5; T().spawnWild(); }
      const [dx, dy] = gauntlet.door(fl);
      return ps.some(p => near(p, dx, dy + 20, 46));
    },
    bonus: fl => (fl.t <= PAR ? 2 : 0),
    hud: fl => ({ goal: 'GAUNTLET: REACH THE DOOR · ' + G.U.mmss(fl.t) + ' (PAR ' + G.U.mmss(PAR) + ')', col: fl.t <= PAR ? '#8fffb0' : '#ffffff' }),
    drawGround(ctx, fl) {
      const t = performance.now() / 1000;
      for (const [x, y] of gauntlet.jets(fl)) { disc(ctx, x, y, 16, '#ff7a3d', 0.5 + 0.2 * Math.sin(t * 6), '#3a1a0a'); }
    },
    drawables(fl) {
      const [x, y] = gauntlet.door(fl);
      return [{ y, draw(ctx) { drawDoor(ctx, x, y, 'EXIT', fl.t <= PAR ? 'Par ' + G.U.mmss(PAR) : ''); } }];
    }
  };

  // ---- Mystery Dungeon: 3×3 cells, each with a room, joined by corridors (a spanning tree plus two loops). You
  // start in one room; the stairs are in the room furthest away. Darkness except around each player, Pokémon
  // asleep in the rooms (they wake when you come close or hit them), hidden traps. Everyone has to stand on the
  // stairs to go up. After 45 s an arrow at the screen edge hints at the stairs. ----
  const DW = 54, DH = 42, CW_ = 18, CH_ = 14;
  function genDungeon(cfg) {
    const r = rng(cfg.seed), ri = (a, b) => a + Math.floor(r() * (b - a + 1));
    const g = []; for (let y = 0; y < DH; y++) g.push(new Array(DW).fill('#'));
    const rooms = [];
    for (let cy = 0; cy < 3; cy++) for (let cx = 0; cx < 3; cx++) {
      const w = ri(6, 11), h = ri(5, 8);
      const x = cx * CW_ + 1 + ri(0, CW_ - w - 2), y = cy * CH_ + 1 + ri(0, CH_ - h - 2);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) g[y + j][x + i] = '.';
      rooms.push({ x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2), links: [] });
    }
    const id = (cx, cy) => cy * 3 + cx;
    const link = (a, b) => {
      if (rooms[a].links.includes(b)) return;
      rooms[a].links.push(b); rooms[b].links.push(a);
      const A = rooms[a], B = rooms[b];
      let x = A.cx, y = A.cy;
      while (x !== B.cx) { g[y][x] = '.'; g[y + 1][x] = '.'; x += Math.sign(B.cx - x); }
      while (y !== B.cy) { g[y][x] = '.'; g[y][x + 1] = '.'; y += Math.sign(B.cy - y); }
    };
    // Spanning tree by a random walk over the 3×3 cells, then two extra links for loops.
    const seen = new Set([ri(0, 8)]), stack = [...seen];
    while (stack.length) {
      const c = stack[stack.length - 1], cx = c % 3, cy = Math.floor(c / 3);
      const nb = [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]].filter(([a, b]) => a >= 0 && a < 3 && b >= 0 && b < 3 && !seen.has(id(a, b)));
      if (!nb.length) { stack.pop(); continue; }
      const [a, b] = nb[Math.floor(r() * nb.length)], n = id(a, b);
      link(c, n); seen.add(n); stack.push(n);
    }
    for (let k = 0; k < 2; k++) {
      const a = ri(0, 8), cx = a % 3, cy = Math.floor(a / 3);
      const nb = [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]].filter(([x, y]) => x >= 0 && x < 3 && y >= 0 && y < 3);
      const [x, y] = nb[Math.floor(r() * nb.length)];
      link(a, id(x, y));
    }
    // Start room and the stairs in the room furthest from it (by links).
    const start = ri(0, 8), dist = new Array(9).fill(-1), q = [start];
    dist[start] = 0;
    while (q.length) { const c = q.shift(); for (const n of rooms[c].links) if (dist[n] < 0) { dist[n] = dist[c] + 1; q.push(n); } }
    let far = start; for (let i = 0; i < 9; i++) if (dist[i] > dist[far] || (dist[i] === dist[far] && r() < 0.5 && i !== start)) far = i;
    // Hidden traps in the other rooms.
    const KINDS = ['blast', 'blast', 'slow', 'warp'], traps = [];
    for (let k = 0; k < 4 + cfg.section; k++) {
      const ro = rooms[ri(0, 8)];
      if (ro === rooms[start] || ro === rooms[far]) continue;
      traps.push({ lx: ri(ro.x, ro.x + ro.w - 1), ly: ri(ro.y, ro.y + ro.h - 1), kind: KINDS[ri(0, KINDS.length - 1)] });
    }
    return { m: { x0: cfg.tx - DW / 2, y0: cfg.ty - DH / 2, w: DW, h: DH, rows: toRows(g) }, rooms, start, far, traps };
  }
  const dungeon = {
    plan(cfg) { cfg.seed = Math.floor(Math.random() * 1e9); },
    gen(cfg) {
      if (!cfg._gen) Object.defineProperty(cfg, '_gen', { value: genDungeon(cfg), enumerable: false });
      return cfg._gen;
    },
    map: cfg => dungeon.gen(cfg).m,
    spawn(fl) { const d = dungeon.gen(fl.cfg), ro = d.rooms[d.start]; return tilePt(d.m, ro.cx, ro.cy); },
    stairs(fl) { const d = dungeon.gen(fl.cfg), ro = d.rooms[d.far]; return tilePt(d.m, ro.cx, ro.cy); },
    roomPoint(fl, ro) { const d = dungeon.gen(fl.cfg); return tilePt(d.m, ro.x + Math.floor(Math.random() * ro.w), ro.y + Math.floor(Math.random() * ro.h)); },
    spawnPoint(fl) {
      const d = dungeon.gen(fl.cfg), ps = alive();
      for (let i = 0; i < 10; i++) {
        const [x, y] = dungeon.roomPoint(fl, d.rooms[Math.floor(Math.random() * 9)]);
        if (!ps.some(p => near(p, x, y, 300)) && G.World.isFree(x, y, 14)) return [x, y];
      }
      return null;
    },
    start(fl) {
      useBag(fl);
      const d = dungeon.gen(fl.cfg);
      d.rooms.forEach((ro, i) => {
        if (i === d.start) return;
        for (let k = 0; k < 2 + Math.floor(fl.cfg.section / 2) + (fl.cfg.np - 1); k++) {
          const [x, y] = dungeon.roomPoint(fl, ro);
          const e = T().spawnWild(false, [x, y]);
          if (e) e.asleep = true;                     // Enemy.update: wakes when a player comes close or hits it
        }
      });
      fl.trapsUsed = {};
    },
    tick(fl, dt) {
      const [sx, sy] = dungeon.stairs(fl), ps = alive();
      fl.onStairs = ps.filter(p => near(p, sx, sy, 60)).length;
      return ps.length > 0 && fl.onStairs === ps.length;
    },
    /** Every computer: traps under your own Pokémon. */
    local(fl, dt) {
      const pl = G.Game.player;
      if (!pl || pl.dead || fl.phase !== 'fight') return;
      const d = dungeon.gen(fl.cfg);
      fl.trapsUsed = fl.trapsUsed || {};
      d.traps.forEach((tp, i) => {
        if (fl.trapsUsed[i]) return;
        const [x, y] = tilePt(d.m, tp.lx, tp.ly);
        if (!near(pl, x, y, 20)) return;
        fl.trapsUsed[i] = 1;
        G.Audio.sfx('break');
        if (tp.kind === 'blast') G.Hazards.add({ kind: 'zone', x, y, r: 64, delay: 0.45, dmg: hazardDmg(fl.cfg) * 1.4, type: 'fire', color: '#ff7a4d' });
        else if (tp.kind === 'slow') { pl.slowT = Math.max(pl.slowT || 0, 4); G.FX.dmgText(pl.x, pl.y - pl.bodyH - 10, 'Sticky trap!', '#c7e04a', true); }
        else {
          const ro = d.rooms[Math.floor(Math.random() * 9)];
          [pl.x, pl.y] = tilePt(d.m, ro.cx, ro.cy);
          G.Camera.x = pl.x; G.Camera.y = pl.y;
          G.Game.flash('#c9a6ff', 0.5);
          G.FX.dmgText(pl.x, pl.y - pl.bodyH - 10, 'Warp trap!', '#c9a6ff', true);
        }
      });
    },
    state: fl => [fl.onStairs || 0],
    apply(fl, st) { fl.onStairs = st[0]; },
    hud(fl) {
      const n = alive().length, on = fl.onStairs || 0;
      return { goal: 'MYSTERY DUNGEON: FIND THE STAIRS' + (on && n > 1 ? ' · ' + on + ' / ' + n + ' ON THE STAIRS' : ''), col: '#ffe27a' };
    },
    drawGround(ctx, fl) {
      const d = dungeon.gen(fl.cfg), pl = G.Game.player;
      const [sx, sy] = dungeon.stairs(fl);
      drawStairsIcon(ctx, sx, sy, '#ffe27a');
      // Traps show once you're close (or once sprung).
      d.traps.forEach((tp, i) => {
        const [x, y] = tilePt(d.m, tp.lx, tp.ly);
        if (!(fl.trapsUsed && fl.trapsUsed[i]) && !(pl && near(pl, x, y, 110))) return;
        const col = tp.kind === 'blast' ? '#ff7a4d' : tp.kind === 'slow' ? '#c7e04a' : '#c9a6ff';
        disc(ctx, x, y, 14, col, fl.trapsUsed && fl.trapsUsed[i] ? 0.2 : 0.55, '#1a1220');
      });
    },
    /** Darkness, and after 45 s an arrow towards the stairs. */
    drawOverlay(ctx, w, h, fl) {
      const cam = G.Camera, ps = alive();
      ctx.save();
      ctx.fillStyle = 'rgba(6,4,14,.82)';
      ctx.beginPath(); ctx.rect(0, 0, w, h);
      for (const p of ps) {
        const sx = (p.x - cam.left()) * cam.scale, sy = (p.y - 20 - cam.top()) * cam.scale, r = 230 * cam.scale;
        ctx.moveTo(sx + r, sy); ctx.arc(sx, sy, r, 0, 6.2832, true);
      }
      ctx.fill('evenodd');
      const pl = G.Game.player;
      if (pl && fl.t > 45) {
        const [x, y] = dungeon.stairs(fl);
        const sx = (x - cam.left()) * cam.scale, sy = (y - cam.top()) * cam.scale;
        if (sx < 0 || sx > w || sy < 0 || sy > h) {
          const M = 50, ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 100, h - M - 90), a = Math.atan2(sy - ey, sx - ex);
          ctx.translate(ex, ey); ctx.rotate(a);
          ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(-10, -14); ctx.lineTo(-10, 14); ctx.closePath(); ctx.stroke(); ctx.fill();
        }
      }
      ctx.restore();
    }
  };

  // ---------------- shared drawing ----------------

  function drawStairsIcon(ctx, x, y, col) {
    ctx.save();
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = k % 2 ? '#6e6880' : '#8a8298';
      ctx.fillRect(x - 26 + k * 4, y - 6 - k * 8, 52 - k * 8, 8);
    }
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 0.6 + 0.3 * Math.sin(performance.now() / 200);
    ctx.strokeRect(x - 30, y - 40, 60, 44);
    ctx.restore();
  }
  function drawDoor(ctx, x, y, name, sub) {
    ctx.save();
    const w = 64, h = 86, r = w / 2;
    ctx.fillStyle = '#3a3446';
    ctx.beginPath(); ctx.moveTo(x - r - 6, y); ctx.lineTo(x - r - 6, y - h + r); ctx.arc(x, y - h + r, r + 6, Math.PI, 0); ctx.lineTo(x + r + 6, y); ctx.fill();
    const g = ctx.createLinearGradient(0, y - h, 0, y); g.addColorStop(0, '#fff3c8'); g.addColorStop(1, '#d8a64a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - r + 4, y); ctx.lineTo(x - r + 4, y - h + r); ctx.arc(x, y - h + r, r - 4, Math.PI, 0); ctx.lineTo(x + r - 4, y); ctx.fill();
    label(ctx, name, x, y - h - 10, 13, '#ffe27a');
    if (sub) label(ctx, sub, x, y + 16, 10, '#fff1cf');
    ctx.restore();
  }

  /** The landing's stairways: [{ kind, x, y }] -> drawables with the floor kind's name over each. */
  function stairsDrawables(list) {
    return (list || []).map(s => ({
      y: s.y,
      draw(ctx) {
        const K = G.TowerData.KINDS[s.kind], fam = K ? K.family : 'boss';
        const col = { fight: '#ff8a6b', objective: '#8fe3ff', puzzle: '#c9a6ff', dungeon: '#ffe27a' }[fam] || '#ff6b6b';
        drawStairsIcon(ctx, s.x, s.y, col);
        const name = K ? K.name : s.kind === 'gate' ? 'Gatekeeper' : s.kind === 'final' ? 'The Summit' : s.kind === 'plates' ? 'Seal Plates' : s.kind === 'twins' ? 'Twin Bond' : 'Boss';
        label(ctx, name.toUpperCase(), s.x, s.y - 50, 12, col);
        label(ctx, fam === 'fight' ? 'Fight' : fam === 'boss' ? 'Boss floor' : fam[0].toUpperCase() + fam.slice(1), s.x, s.y + 18, 9, '#e8e4f4');
      }
    }));
  }

  const bitsOf = m => { let c = 0; while (m) { c += m & 1; m >>= 1; } return c; };
  const KINDS = { survival, bounty, relic, hold, escort, lights, sequence, gauntlet, dungeon };

  return { get: k => KINDS[k] || null, stairsDrawables, rng, genDungeon };
})();
