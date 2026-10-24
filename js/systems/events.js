/* ============ events.js — mid-run events and treasure goblins ============
 *
 * Every 4-5 minutes (never with a boss alive or in the rift) one of these happens:
 *
 *   horde   Horde of one type: 30 s in which everything that spawns is of the
 *           same type (if your type beats them, it's your moment)
 *   volt    Voltorb swarm: 25 s in which waves of Voltorb and Electrode surround you
 *           from every side and rush in to self-destruct (only they spawn)
 *   gold    Golden hour: 30 s of golden enemies that give double
 *           experience and sometimes drop coins
 *   lost    Lost Pokémon: you touch it, it follows you and you lead it to the marker.
 *           Enemies hurt it; if it falls (or you take longer than 2 min), it leaves.
 *           Reward: heals half your health, coins, a ticket and, 1 time in
 *           5, it joins your collection.
 *
 * Treasure goblins (1-2 per run, see Enemy behavior 'thief'): a
 * Meowth loaded with coins (or, 1 in 4, a Gholdengo with a ×10 ticket)
 * that flees and escapes after 15 s if you don't catch it.
 *
 * Co-op: the host decides and announces it with 'ev' (see coop.js). Everyone sees the
 * same thing and the reward is for everyone.
 */
G.Events = (() => {
  const EVERY = [240, 300], DUR = 30, LOST_TIME = 120;
  // Voltorb swarm: how long it lasts and how often a fresh wave closes in around you.
  const VOLT_DUR = 25, VOLT_WAVE = 6.5;
  const THIEF_FIRST = [120, 240], THIEF_NEXT = [240, 360], THIEF_LIFE = 15;
  // Aegislash and its Armoury of items: kill it (it leaves after AEGIS_LIFE s) and everyone picks 1 of 3 items, or skips.
  const AEGIS_FIRST = [330, 450], AEGIS_NEXT = [420, 600], AEGIS_LIFE = 75, AEGIS_MAX = 3, AEGIS_DEX = 681;
  // Spiritomb, the move tutor: defeat it (it leaves after TUTOR_LIFE s) and everyone picks 1 of 3 moves from outside their pool.
  const TUTOR_FIRST = [200, 320], TUTOR_NEXT = [360, 480], TUTOR_LIFE = 60, TUTOR_MAX = 2, TUTOR_DEX = 442;
  const authority = () => !G.Coop.active || G.Coop.isHost;

  let nextT = 0, cur = null, last = null, thiefT = 0, thieves = 0, aegisT = 0, aegises = 0, tutorT = 0, tutors = 0;
  let lost = null;      // { dex, name, x, y, hp, maxHp, state, follow, tx, ty, t, anim, r, hitCd, netT, grant }

  function reset() {
    nextT = G.U.rand(EVERY[0], EVERY[1]);
    cur = null; last = null; lost = null;
    thiefT = G.U.rand(THIEF_FIRST[0], THIEF_FIRST[1]); thieves = 0;
    aegisT = G.U.rand(AEGIS_FIRST[0], AEGIS_FIRST[1]); aegises = 0;
    tutorT = G.U.rand(TUTOR_FIRST[0], TUTOR_FIRST[1]); tutors = 0;
  }

  // ---------------- ciclo ----------------

  function update(dt, players, time) {
    if (cur) {
      cur.t += dt;
      if (cur.id !== 'lost' && cur.t >= cur.dur && authority()) end();
      else if (cur.id === 'volt' && authority() && (cur.wave -= dt) <= 0) { cur.wave = VOLT_WAVE; voltWave(players, time); }
    }
    if (lost) lostTick(dt, players);
    if (!authority() || G.Rift.inArena || G.Judgment.active) return;

    if (thieves < 2) {
      thiefT -= dt;
      if (thiefT <= 0) {
        if (G.EnemyMgr.bossAlive()) thiefT = 8;
        else { spawnThief(players, time); thieves++; thiefT = G.U.rand(THIEF_NEXT[0], THIEF_NEXT[1]); }
      }
    }

    if (aegises < AEGIS_MAX) {
      aegisT -= dt;
      if (aegisT <= 0) {
        if (G.EnemyMgr.bossAlive()) aegisT = 8;
        else { if (spawnAegis(players, time)) aegises++; aegisT = G.U.rand(AEGIS_NEXT[0], AEGIS_NEXT[1]); }
      }
    }

    if (tutors < TUTOR_MAX) {
      tutorT -= dt;
      if (tutorT <= 0) {
        if (G.EnemyMgr.bossAlive() || G.EnemyMgr.all().some(e => e.behavior === 'aegis' && !e.dead)) tutorT = 8;
        else { if (spawnTutor(players, time)) tutors++; tutorT = G.U.rand(TUTOR_NEXT[0], TUTOR_NEXT[1]); }
      }
    }

    if (cur) return;
    nextT -= dt;
    if (nextT > 0) return;
    if (G.EnemyMgr.bossAlive()) { nextT = 10; return; }
    nextT = G.U.rand(EVERY[0], EVERY[1]);
    const ids = ['horde', 'volt', 'gold', 'lost'].filter(id => id !== last);
    start(G.U.pick(ids), time, players);
  }

  function start(id, time, players) {
    last = id;
    G.RunLog.event(id);
    if (id === 'horde') {
      const types = G.Enemies.hordeTypes(time);
      if (!types.length) return start('gold', time, players);
      const type = G.U.pick(types);
      const defs = G.Enemies.hordeDefs(type, time);
      G.Sprites.preload(defs.map(d => d.dex));
      cur = { id, t: 0, dur: DUR, type, defs };
      G.Spawner.burst(Math.round(6 * G.Coop.scaleRate(players.length)));
    } else if (id === 'volt') {
      const defs = G.Enemies.voltDefs(time);
      if (!defs.length) return start('gold', time, players);
      G.Sprites.preload(defs.map(d => d.dex));
      cur = { id, t: 0, dur: VOLT_DUR, defs, wave: VOLT_WAVE };
      voltWave(players, time);
    } else if (id === 'gold') {
      cur = { id, t: 0, dur: DUR };
      for (const e of G.EnemyMgr.all()) if (!e.remote) e.makeGolden();
    } else {
      if (!spawnLost(players)) return;
      cur = { id, t: 0, dur: Infinity };
    }
    announce();
    if (G.Coop.isHost) G.Coop.broadcast(['ev', 's', id, cur.type || '']);
  }

  /** A ring of Voltorb / Electrode around a player; bigger later in the run and with more players. */
  function voltWave(players, time) {
    G.Spawner.ring(Math.round(Math.min(26, 12 + time / 60) * G.Coop.scaleRate(players.length) * 0.75));
  }

  function announce() {
    if (!cur) return;
    if (cur.id === 'horde') say('A ' + G.U.TYPE_NAME[cur.type] + '-type horde!', 3, G.U.TYPE_COLOR[cur.type]);
    else if (cur.id === 'volt') say('Voltorb swarm! Keep moving, they self-destruct!', 3.2, '#ffd23f', 100);
    else if (cur.id === 'gold') say('Golden hour! Double experience', 3, '#ffd23f');
    else if (lost) say('A ' + lost.name + ' is lost! Find it and take it to the marker', 3.4, '#7dffb0', lost.dex);
    G.Audio.sfx(cur.id === 'gold' ? 'shiny' : 'surge');
  }

  function say(text, secs, _col, dex) { G.Spawner.say(text, secs, true, dex); }

  function end() {
    if (!cur) return;
    cur = null;
    if (G.Coop.isHost) G.Coop.broadcast(['ev', 'e']);
  }

  /** What spawns during a horde or a Voltorb swarm (used by G.Enemies.bagAt). */
  function bag() { return cur && (cur.id === 'horde' || cur.id === 'volt') && cur.defs && cur.defs.length ? cur.defs : null; }

  // ---------------- treasure goblin ----------------

  function spawnThief(players, time) {
    const gold = Math.random() < 0.25;
    const dex = gold ? 1000 : 52;
    const mon = G.DEX_BY[dex];
    if (!mon || !G.SPRITE_META[dex]) return;
    const pl = G.U.pick(players.filter(p => !p.dead).length ? players.filter(p => !p.dead) : players);
    G.Sprites.preload([dex]);
    const def = { dex, name: mon.name, behavior: 'thief', hp: Math.round(60 * (1 + time / 95) * (gold ? 1.5 : 1)),
                  spd: 92, dmg: 0, xp: 10, loot: gold ? 'ticket10' : 'coins' };
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * 6.2832, d = G.U.rand(230, 300);
      const x = pl.x + Math.cos(a) * d, y = pl.y + Math.sin(a) * d * 0.8;
      if (!G.World.isFree(x, y, 14)) continue;
      const e = new G.Enemy(def, x, y, { hp: 1, spd: 1, dmg: 1 });
      e.life = THIEF_LIFE;
      G.EnemyMgr.add(e);
      G.FX.ring(x, y, 4, 40, '#ffd23f', 0.5, 3);
      G.Spawner.say(gold ? 'A ' + mon.name + ' with a ×10 ticket! Catch it before it runs away!'
                         : 'A ' + mon.name + ' loaded with coins! Catch it before it runs away!', 3.2, false, dex);
      G.Audio.sfx('shiny');
      return;
    }
  }

  // ---------------- Aegislash and its armoury ----------------

  function spawnAegis(players, time) {
    const mon = G.DEX_BY[AEGIS_DEX];
    if (!mon || !G.SPRITE_META[AEGIS_DEX]) return false;
    const alive = players.filter(p => !p.dead);
    const pl = G.U.pick(alive.length ? alive : players);
    G.Sprites.preload([AEGIS_DEX]);
    const n = players.length;
    const def = { dex: AEGIS_DEX, name: mon.name, behavior: 'aegis', hp: Math.round((420 + time * 4) * G.Coop.scaleHp(n)),
                  spd: 66, dmg: Math.round(22 + time / 25), xp: Math.round(120 + time / 3) };
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * 6.2832, d = G.U.rand(260, 330);
      const x = pl.x + Math.cos(a) * d, y = pl.y + Math.sin(a) * d * 0.8;
      if (!G.World.isFree(x, y, 18)) continue;
      const e = new G.Enemy(def, x, y, { hp: 1, spd: 1, dmg: 1 });
      e.life = AEGIS_LIFE;
      G.EnemyMgr.add(e);
      G.FX.ring(x, y, 4, 60, '#9fb4ff', 0.6, 4);
      G.Spawner.say('An Aegislash appears with an Armoury of Items!', 5, false, AEGIS_DEX);
      G.Audio.sfx('legend');
      return true;
    }
    return false;
  }

  // ---------------- Spiritomb, the move tutor ----------------

  function spawnTutor(players, time) {
    const mon = G.DEX_BY[TUTOR_DEX];
    if (!mon || !G.SPRITE_META[TUTOR_DEX]) return false;
    const alive = players.filter(p => !p.dead);
    const pl = G.U.pick(alive.length ? alive : players);
    G.Sprites.preload([TUTOR_DEX]);
    const def = { dex: TUTOR_DEX, name: mon.name, behavior: 'tutor', hp: Math.round((260 + time * 2.6) * G.Coop.scaleHp(players.length)),
                  spd: 58, dmg: Math.round(14 + time / 30), xp: Math.round(80 + time / 4) };
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * 6.2832, d = G.U.rand(250, 320);
      const x = pl.x + Math.cos(a) * d, y = pl.y + Math.sin(a) * d * 0.8;
      if (!G.World.isFree(x, y, 18)) continue;
      const e = new G.Enemy(def, x, y, { hp: 1, spd: 1, dmg: 1 });
      e.life = TUTOR_LIFE;
      G.EnemyMgr.add(e);
      G.FX.ring(x, y, 4, 60, '#9b6bd6', 0.6, 4);
      G.Spawner.say('Spiritomb opens a portal of otherworldly moves! Defeat it to learn one!', 5, false, TUTOR_DEX);
      G.Audio.sfx('legend');
      return true;
    }
    return false;
  }

  /** Spiritomb fell (host or solo): everyone chooses a move (each from their own Pokémon's offer). */
  function tutor() {
    G.Game.tutor();
    if (G.Coop.isHost) G.Coop.broadcast(['ev', 'tut']);
  }

  /** The Aegislash fell (host or solo): everyone chooses an item. */
  function armoury() {
    G.Game.armoury();
    if (G.Coop.isHost) G.Coop.broadcast(['ev', 'arm']);
  }

  // ---------------- lost Pokémon ----------------

  function spawnLost(players) {
    const alive = players.filter(p => !p.dead);
    const pl = G.U.pick(alive.length ? alive : players);
    const pool = G.DEX.filter(p => p.rarity <= 3 && !p.leg && G.SPRITE_META[p.dex] && !G.Sprites.hovers(p.dex));
    const mon = G.U.pick(pool);
    let at = null, to = null;
    for (let i = 0; i < 20 && !at; i++) {
      const a = Math.random() * 6.2832, d = G.U.rand(220, 300);
      const x = pl.x + Math.cos(a) * d, y = pl.y + Math.sin(a) * d * 0.8;
      if (G.World.isFree(x, y, 16)) at = [x, y];
    }
    for (let i = 0; i < 30 && at && !to; i++) {
      const a = Math.random() * 6.2832, d = G.U.rand(700, 850);
      const x = at[0] + Math.cos(a) * d, y = at[1] + Math.sin(a) * d * 0.85;
      if (G.World.isFree(x, y, 30)) to = [x, y];
    }
    if (!at || !to) return false;
    makeLost({ dex: mon.dex, x: at[0], y: at[1], tx: to[0], ty: to[1], state: 'wait', hp: 100, grant: Math.random() < 0.2 });
    G.Sprites.preload([mon.dex]);
    return true;
  }

  function makeLost(o) {
    const mon = G.DEX_BY[o.dex];
    lost = Object.assign({ name: mon ? mon.name : '', maxHp: 100, t: 0, hitCd: 0, netT: 0, follow: null,
                           anim: new G.Sprites.Animator(o.dex, 1), r: G.Sprites.bodyRadius(o.dex) }, o);
  }

  function lostTick(dt, players) {
    const L = lost;
    L.t += dt;
    L.anim.update(dt);
    if (!authority()) { L.anim.loop(L.moving ? 'Walk' : 'Idle'); return; }

    if (L.state === 'wait') {
      const p = players.find(o => !o.dead && G.U.dist2(o.x, o.y, L.x, L.y) < (o.r + L.r + 18) ** 2);
      if (p) { L.state = 'follow'; L.follow = p; say(L.name + ' is following you! Take it to the green marker', 3, '#7dffb0', L.dex); G.Audio.sfx('confirm'); }
      L.moving = false;
    } else {
      const p = L.follow && !L.follow.dead ? L.follow : players.find(o => !o.dead) || L.follow;
      const d = G.U.dist(L.x, L.y, p.x, p.y), keep = p.r + L.r + 14;
      L.moving = d > keep;
      if (L.moving) {
        const sp = Math.min(d - keep, Math.max(120, p.spd * 1.15) * dt);
        const [nx, ny] = G.U.norm(p.x - L.x, p.y - L.y);
        L.x += nx * sp; L.y += ny * sp;
        G.World.collide(L);
        L.anim.dir = G.Sprites.dirFromAngle(Math.atan2(ny, nx));
      }
      if (G.U.dist2(L.x, L.y, L.tx, L.ty) < 56 * 56) return rescued();
    }
    L.anim.loop(L.moving ? 'Walk' : 'Idle');

    // Enemies that touch it hurt it.
    if ((L.hitCd -= dt) <= 0) {
      const hits = G.EnemyMgr.queryCircle(L.x, L.y, L.r).filter(e => !e.dead && e.behavior !== 'thief');
      if (hits.length) {
        L.hitCd = 0.5;
        L.hp -= Math.min(30, hits.reduce((a, e) => a + 4 + e.dmg * 0.12, 0));
        L.flash = 0.1;
        G.FX.burst(L.x, L.y - 10, '#ff5f6d', 4, 60);
        if (L.hp <= 0) return gone(L.name + ' got scared and ran away…!');
      }
    }
    if (L.flash > 0) L.flash -= dt;
    if (L.t > LOST_TIME) return gone(L.name + ' got tired of waiting and left…');

    if (G.Coop.isHost && (L.netT -= dt) <= 0) {
      L.netT = 0.1;
      G.Coop.broadcast(['ev', 'lp', L.dex, Math.round(L.x), Math.round(L.y), Math.round(L.hp), L.state === 'follow' ? 1 : 0,
                        Math.round(L.tx), Math.round(L.ty), L.anim.dir, L.moving ? 1 : 0]);
    }
  }

  function rescued() {
    const L = lost;
    for (let i = 0; i < 12; i++) G.Pickups.drop('coin', L.tx + G.U.rand(-40, 40), L.ty + G.U.rand(-30, 30), 5);
    G.Pickups.drop('ticket', L.tx, L.ty - 12, 1);
    if (G.Coop.isHost) G.Coop.broadcast(['ev', 'rw', L.dex, L.grant ? 1 : 0]);
    reward(L.dex, L.grant);
    lost = null;
    end();
  }

  /** On each computer: heals, and if it's due, the Pokémon joins your collection. */
  function reward(dex, grant) {
    const pl = G.Game.player;
    if (pl && !pl.dead) { pl.heal(pl.maxHp * 0.5); G.FX.ring(pl.x, pl.y, 6, 70, '#5fe08a', 0.5, 3); }
    const name = (G.DEX_BY[dex] || {}).name || '';
    G.FX.burst(lost ? lost.tx : pl.x, lost ? lost.ty - 10 : pl.y, '#7dffb0', 24, 180);
    G.Audio.sfx('legend');
    if (grant && G.onRescue) G.onRescue(dex, name);
    else say('You brought ' + name + ' home! It thanks you', 3.2, '#7dffb0');
  }

  function gone(msg) {
    if (G.Coop.isHost) G.Coop.broadcast(['ev', 'lx', msg]);
    say(msg, 3);
    lost = null;
    end();
  }

  // ---------------- red ----------------

  function onNet(ev) {
    switch (ev[1]) {
      case 's': cur = { id: ev[2], t: 0, dur: ev[2] === 'lost' ? Infinity : ev[2] === 'volt' ? VOLT_DUR : DUR, type: ev[3] || null }; break;
      case 'e': cur = null; break;
      case 'arm': G.Game.armoury(); break;
      case 'tut': G.Game.tutor(); break;
      case 'lp': {
        const [, , dex, x, y, hp, follow, tx, ty, dir, moving] = ev;
        if (!lost || lost.dex !== dex) makeLost({ dex, x, y, tx, ty, hp, state: follow ? 'follow' : 'wait' });
        Object.assign(lost, { x, y, hp, tx, ty, moving: !!moving, state: follow ? 'follow' : 'wait' });
        lost.anim.dir = dir;
        break;
      }
      case 'rw': reward(ev[2], !!ev[3]); lost = null; break;
      case 'lx': say(ev[2], 3); lost = null; break;
    }
  }

  // ---------------- drawing ----------------

  /** The lost Pokémon and the marker, to sort them by Y with everything else. */
  function drawables() {
    if (!lost) return [];
    const L = lost;
    const now = performance.now() / 1000;
    const goal = {
      y: L.ty - 4000,          // on the ground, below everything
      draw(ctx) {
        const k = 0.5 + Math.sin(now * 4) * 0.5;
        ctx.save();
        ctx.globalAlpha = 0.25 + k * 0.15;
        ctx.fillStyle = '#5fe08a';
        ctx.beginPath(); ctx.ellipse(L.tx, L.ty, 56, 40, 0, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#7dffb0'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.ellipse(L.tx, L.ty, 56, 40, 0, 0, 6.2832); ctx.stroke();
        ctx.restore();
        G.Icons.draw(ctx, 'heart', Math.round(L.tx - 8), Math.round(L.ty - 30 - k * 6), 16);
      }
    };
    const mon = {
      y: L.y,
      draw(ctx) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#7dffb0';
        ctx.beginPath(); ctx.ellipse(L.x, L.y, L.r * 1.5, L.r * 0.6, 0, 0, 6.2832); ctx.fill();
        ctx.restore();
        G.Sprites.drawShadow(ctx, L.dex, L.x, L.y, 1);
        L.anim.draw(ctx, L.x, L.y, { flash: L.flash > 0 });
        const h = G.Sprites.bodyHeight(L.dex, 1);
        if (L.state === 'wait') {
          // A "!" bouncing above it: it's waiting for you to touch it.
          const by = L.y - h - 14 - Math.abs(Math.sin(now * 5)) * 6;
          ctx.save();
          ctx.font = '700 16px Pixelify, monospace'; ctx.textAlign = 'center';
          ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.strokeText('!', L.x, by);
          ctx.fillStyle = '#7dffb0'; ctx.fillText('!', L.x, by);
          ctx.restore();
        }
        const w = 30, y = L.y - h - 6;
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(L.x - w / 2, y, w, 3.4);
        ctx.fillStyle = '#5fe08a'; ctx.fillRect(L.x - w / 2, y, w * Math.max(0, L.hp / L.maxHp), 3.4);
      }
    };
    return [goal, mon];
  }

  /** Edge arrow towards the lost Pokémon (or towards the marker, if it's already following you). */
  function drawHud(ctx, w, h, pl, F) {
    const cam = G.Camera;
    if (lost) {
      const L = lost, to = L.state === 'wait' ? [L.x, L.y - 10] : [L.tx, L.ty];
      edgeArrow(ctx, w, h, cam, to[0], to[1], '#7dffb0', (L.state === 'wait' ? L.name : 'Marker') + ' · ' +
                Math.round(G.U.dist(pl.x, pl.y, to[0], to[1]) / 32) + ' m', F, L.state === 'wait' ? { key: 'lost', dex: L.dex } : null);
    }
    for (const e of G.EnemyMgr.all()) {
      if (e.behavior === 'thief' && !e.dead) edgeArrow(ctx, w, h, cam, e.x, e.y - 10, '#ffd23f', e.name, F, { key: 't' + e.id, dex: e.dex, shiny: e.shiny });
      if (e.behavior === 'tutor' && !e.dead) edgeArrow(ctx, w, h, cam, e.x, e.y - 10, '#9b6bd6', e.name + (Number.isFinite(e.life) ? ' · ' + Math.max(0, Math.ceil(e.life)) + ' s' : ''), F, { key: 'u' + e.id, dex: e.dex });
      if (e.behavior === 'aegis' && !e.dead) edgeArrow(ctx, w, h, cam, e.x, e.y - 10, '#9fb4ff', e.name + (Number.isFinite(e.life) ? ' · ' + Math.max(0, Math.ceil(e.life)) + ' s' : ''), F, { key: 'a' + e.id, dex: e.dex });
    }
    if (cur && cur.id !== 'lost') {
      const left = Math.max(0, Math.ceil(cur.dur - cur.t));
      const txt = (cur.id === 'gold' ? 'GOLDEN HOUR' : cur.id === 'volt' ? 'VOLTORB SWARM' : G.U.TYPE_NAME[cur.type].toUpperCase() + ' HORDE') + ' · ' + left + ' s';
      ctx.save();
      ctx.font = F(800, 12); ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.8)';
      ctx.strokeText(txt, w / 2, 112);
      ctx.fillStyle = cur.id === 'gold' ? '#ffd23f' : cur.id === 'volt' ? '#ff5a3d' : G.U.TYPE_COLOR[cur.type] || '#fff';
      ctx.fillText(txt, w / 2, 112);
      ctx.restore();
    }
  }

  function edgeArrow(ctx, w, h, cam, x, y, col, label, F, mon) {
    const sx = (x - cam.left()) * cam.scale, sy = (y - cam.top()) * cam.scale;
    if (sx > 0 && sx < w && sy > 0 && sy < h) return;
    if (mon && mon.dex && G.HUD) return badgeArrow(ctx, w, h, sx, sy, col, label, F, mon);
    const K = w < 640 ? 1.35 : 1.7;                       // bigger arrows (and labels) so they are easy to spot
    const M = 40 + 14 * K, ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 70, h - M - 80);
    const a = Math.atan2(sy - ey, sx - ex), ca = Math.cos(a), sa = Math.sin(a);
    const pulse = 0.7 + Math.sin(performance.now() / 160) * 0.3;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.lineJoin = 'round';
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.moveTo(ca * 30 * K, sa * 30 * K);
    ctx.lineTo(Math.cos(a + 2.45) * 15 * K, Math.sin(a + 2.45) * 15 * K);
    ctx.lineTo(Math.cos(a - 2.45) * 15 * K, Math.sin(a - 2.45) * 15 * K);
    ctx.closePath();
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#000'; ctx.stroke();
    ctx.fillStyle = col; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = F(800, Math.round(11 * K));
    ctx.textAlign = ca > 0.3 ? 'right' : ca < -0.3 ? 'left' : 'center';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.88)';
    const lx = -ca * 26 * K, ly = -sa * 24 * K + 4 * K;
    ctx.strokeText(label, lx, ly);
    ctx.fillStyle = col; ctx.fillText(label, lx, ly);
    ctx.restore();
  }

  /** Like the boss arrows: a round badge with the event Pokémon, an arrow pointing to it and the label opposite. */
  function badgeArrow(ctx, w, h, sx, sy, col, label, F, mon) {
    const M = 64, ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 110, h - M - 90);
    const a = Math.atan2(sy - ey, sx - ex), ca = Math.cos(a), sa = Math.sin(a);
    const beat = 0.5 + 0.5 * Math.sin(performance.now() / 160);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.arc(0, 0, 27, 0, 6.2832);
    ctx.fillStyle = 'rgba(10,12,24,.9)'; ctx.fill();
    ctx.globalAlpha = 0.65 + 0.35 * beat;
    ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, 24, 0, 6.2832); ctx.clip();
    G.HUD.portraitBox(ctx, 'ev-' + mon.key, mon, -24, -24, 48);
    ctx.restore();
    ctx.globalAlpha = 0.8 + 0.2 * beat;
    ctx.beginPath();
    ctx.moveTo(ca * 54, sa * 54);
    ctx.lineTo(Math.cos(a + 0.62) * 31, Math.sin(a + 0.62) * 31);
    ctx.lineTo(Math.cos(a - 0.62) * 31, Math.sin(a - 0.62) * 31);
    ctx.closePath();
    ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(0,0,0,.9)'; ctx.stroke();
    ctx.fillStyle = col; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = F(800, 15);
    ctx.textAlign = ca > 0.3 ? 'right' : ca < -0.3 ? 'left' : 'center';
    const lx = -ca * 36, ly = -sa * 36 + (Math.abs(sa) > 0.6 ? (sa > 0 ? -4 : 14) : 4);
    ctx.lineWidth = 4.5; ctx.strokeStyle = 'rgba(0,0,0,.88)';
    ctx.strokeText(label, lx, ly);
    ctx.fillStyle = col; ctx.fillText(label, lx, ly);
    ctx.restore();
  }

  return {
    reset, update, bag, onNet, drawables, drawHud, armoury, tutor,
    get golden() { return !!cur && cur.id === 'gold'; },
    get current() { return cur ? cur.id : null; },
    /** For testing. */
    debugStart(id) { start(id, G.Game.st.time, G.Game.everyone()); },
    debugThief() { spawnThief(G.Game.everyone(), G.Game.st.time); },
    debugAegis() { return spawnAegis(G.Game.everyone(), G.Game.st.time); },
    _dbg() { return lost && { x: lost.x, y: lost.y, tx: lost.tx, ty: lost.ty, state: lost.state, hp: lost.hp }; }
  };
})();
