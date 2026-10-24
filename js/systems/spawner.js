/* ============ spawner.js — waves, bosses and shinies ============
 * Enemies appear in a ring just outside the view, so they never
 * materialise on screen. Every ~45 s there's a "surge": a concentrated
 * rush from one particular side, to break the rhythm.
 *
 * Each enemy has a 1/4096 chance to be shiny (as in the classic games), doubled by its region's Shiny Charm.
 * A run kills 1,500–4,000, so one shows up every 1–3 runs.
 *
 * Co-op (host only): they appear around a random living player,
 * out of EVERYONE's view, and there are more and stronger ones depending on how many
 * of you are playing (see G.Coop.scaleRate / scaleHp).
 */
G.Spawner = (() => {
  // Cap on enemies at once (previously 420: with that many it slowed down).
  // (22-10-2026: enemies spawned near the cap no longer get +60% health, +25% damage and +60% XP. Only a player
  //  who couldn't keep up met them, which pushed them further behind; refreshOldest keeps a full field current now.)
  const FULL_FROM = 0.85;           // from this share of the cap the field counts as full (refreshOldest)
  let CAP = 64;                 // grows a little with a 5th player
  // Fewer Pokémon but stronger (the screen doesn't get cluttered): ~24% of
  // the previous number spawn, each with more health, damage and experience.
  const DENSITY = 0.24, DMG_K = 2.2, XP_K = 5.6;
  // The extra toughness grows with the run: ×3.3 at the start and up to ×5
  // around minute 6, when you already have attacks to take them down.
  const hpK = t => 3.3 + Math.min(1.7, t / 210);
  // Kills are worth more as the run goes on (22-10-2026): ×1 at the start, ×1.75 at minute 15, ×2.5 at minute 30.
  // Enemy health grows ~175× over a run but XP per kill only grew ~4×, so a run that fell behind stopped levelling.
  const xpT = t => 1 + t / 1200;
  const SHINY_RATE = 1 / 4096;
  let acc = 0, bossIdx = 0, surgeT = 32, announce = null, announceT = 0, announceDur = 0, announceDex = 0, preloadT = 0;
  let forceShiny = 0;           // for testing: the next N come out shiny

  function reset() {
    acc = 0; bossIdx = 0; surgeT = 32; announce = null; announceT = 0; preloadT = 0;
    G.Enemies.rollRun();
    G.Sprites.preload(G.Enemies.upcomingDex(0, 80));
  }

  /** Enemies per second by the run's minute. */
  function rate(t) {
    return (1.6 + t * 0.028 + Math.pow(t / 60, 1.6) * 0.5) * DENSITY;
  }

  function ringPoint(pl, angle) {
    const d = G.Camera.outerRadius() + G.U.rand(10, 70);
    return [pl.x + Math.cos(angle) * d, pl.y + Math.sin(angle) * d * 0.9];
  }

  let players = [];

  /** Would any player see it? (so it doesn't appear in front of anyone) */
  function seenByAnyone(x, y) {
    const r = G.Camera.outerRadius() - 30;
    return players.some(o => G.U.dist2(o.x, o.y, x, y) < r * r);
  }

  /** A point on the ring where it fits: not inside walls or in water. */
  function freePoint(pl, angle, flying) {
    for (let i = 0; i < 8; i++) {
      const a = angle + (i === 0 ? 0 : G.U.rand(-0.9, 0.9));
      const [x, y] = ringPoint(pl, a);
      if (players.length > 1 && seenByAnyone(x, y)) continue;
      if (flying || G.World.isFree(x, y, 14)) return [x, y];
    }
    return null;
  }

  /** The player the next enemy spawns around. */
  function anchor() {
    const alive = players.filter(o => !o.dead);
    return alive.length ? G.U.pick(alive) : players[0];
  }

  function scaled(sc, k) { return k === 1 ? sc : Object.assign({}, sc, { hp: sc.hp * k }); }

  function isFlyer(def) { return G.Sprites.hovers(def.dex); }

  function rollShiny(dex) {
    if (!G.Sprites.hasShiny(dex)) return false;
    if (forceShiny > 0) { forceShiny--; return true; }
    return Math.random() < SHINY_RATE * G.Charms.mult(dex);      // Shiny Charm: ×2 for completed regions
  }

  // Supports never gang up: at most this many of each alive at once (on the whole map, so in co-op it's for the
  // whole team: only the host spawns enemies). Their minions are ordinary enemies and don't count.
  const SUPPORT_MAX = { healer: 3, shielder: 3, summoner: 3 };

  function spawnOne(pl, t, angle) {
    const bag = G.Enemies.bagAt(t);
    const alive = {};
    for (const x of G.EnemyMgr.all()) if (!x.dead && SUPPORT_MAX[x.behavior]) alive[x.behavior] = (alive[x.behavior] || 0) + 1;
    const full = b => SUPPORT_MAX[b] && (alive[b] || 0) >= SUPPORT_MAX[b];
    const open = bag.filter(d => !full(d.behavior));
    if (!open.length) return null;                 // (only supports left in this tier's bag and all of them are full)
    const def = G.U.pick(open);
    const pt = freePoint(pl, angle == null ? Math.random() * 6.2832 : angle, isFlyer(def));
    if (!pt) return null;
    const shiny = rollShiny(def.dex);
    const e = new G.Enemy(def, pt[0], pt[1], scaled(G.Enemies.scale(t), G.Coop.scaleHp(players.length) * hpK(t)));
    e.dmg *= DMG_K; e.xp = Math.round(e.xp * XP_K * xpT(t)); e.born = t;
    const rp = G.Enemies.ramp(def, t);
    if (rp) { e.maxHp = e.hp = Math.max(1, Math.round(e.maxHp * rp.hp)); e.dmg *= rp.dmg; }
    if (shiny) e.makeShiny();
    if (G.Events.golden) e.makeGolden();
    G.EnemyMgr.add(e);
    if (shiny) {
      say('A shiny ' + e.name + ' is nearby!', 3.4);
      G.Audio.sfx('shiny');
    }
    return e;
  }

  // ---- a full field never freezes (22-10-2026) ----
  // Nothing spawns while the field is full, so a herd you can't kill kept the stats it was born with and the
  // run stopped getting harder: you could walk it in circles for ever. Now, while it's full, every 1.5 s the
  // oldest enemy at the back (out of view or far behind) comes round ahead of you with the stats a new one would have.
  const NO_REFRESH = new Set(['thief', 'aegis', 'tutor', 'healer', 'shielder', 'summoner']);
  let refreshT = 0;
  function refreshOldest(t) {
    let pick = null, best = 25;            // at least 25 s old
    for (const e of G.EnemyMgr.all()) {
      if (e.dead || e.boss || e.shiny || e.golden || e.remote || e.legend || e.judge || NO_REFRESH.has(e.behavior)) continue;
      const age = t - (e.born || 0);
      if (age < best) continue;
      if (players.some(o => G.U.dist2(o.x, o.y, e.x, e.y) < 330 * 330)) continue;      // not one close to anyone
      best = age; pick = e;
    }
    if (!pick) return;
    const p = nearestTo(pick);
    if (!p) return;
    const sc = G.Enemies.scale(t), rp = G.Enemies.ramp(pick.def, t);
    const hp = Math.round(pick.def.hp * sc.hp * G.Coop.scaleHp(players.length) * hpK(t) * (rp ? rp.hp : 1));
    const dmg = pick.def.dmg * sc.dmg * DMG_K * (rp ? rp.dmg : 1);
    if (hp > pick.maxHp) { pick.hp = Math.round(pick.hp / pick.maxHp * hp); pick.maxHp = hp; }
    pick.dmg = Math.max(pick.dmg, dmg);
    pick.xp = Math.max(pick.xp, Math.round(pick.def.xp * XP_K * xpT(t)));
    pick.spd = Math.max(pick.spd, pick.def.spd * sc.spd);
    pick.born = t; pick.chaseT = 0;
    if (G.Camera.sees(pick.x, pick.y, 0)) G.FX.burst(pick.x, pick.y - pick.bodyH * 0.5, '#c9d4e8', 8, 90);
    G.Spawner.ahead(pick, p);
  }
  function nearestTo(e) {
    let best = null, bd = Infinity;
    for (const o of players) { if (o.dead) continue; const d = G.U.dist2(o.x, o.y, e.x, e.y); if (d < bd) { bd = d; best = o; } }
    return best;
  }

  function spawnBoss(pl, t, b) {
    const [x, y] = ringPoint(pl, Math.random() * 6.2832);
    const e = new G.Enemy(b, x, y, scaled(G.Enemies.bossScale(t), G.Coop.scaleHp(players.length) * (players.length > 4 ? 1.55 : players.length > 1 ? 1.4 : 1)), true);
    if (rollShiny(b.dex)) e.makeShiny();
    G.EnemyMgr.add(e);
    say('A wild ' + (e.shiny ? 'shiny ' : '') + e.name + ' appeared!', 3.2);
    G.Camera.kick(1.1);
    G.Audio.sfx('boss');
    return e;
  }

  /** @param who  the player or the list of players (co-op) */
  function update(dt, who, t) {
    players = Array.isArray(who) ? who : [who];
    // More players, more room on the field (20-10-2026): a flat 64 split across a whole team left each
    // player a third of the enemies, so group runs got ~1/3 of solo's kills (and levels) in the same time.
    CAP = 64 + 32 * Math.min(3, Math.max(0, players.length - 1)) + (players.length > 4 ? 12 : 0);
    if (announceT > 0) announceT -= dt;
    // In the rift arena nothing else spawns (and the boss clock waits).
    // In Arceus's Judgment, only its legendaries (systems/judgment.js).
    if (G.Rift.inArena || G.Judgment.active) return;

    // Preloads what will appear in the next minute.
    preloadT -= dt;
    if (preloadT <= 0) { preloadT = 10; G.Sprites.preload(G.Enemies.upcomingDex(t, 60)); }

    // --- bosses ---
    const b = G.Enemies.BOSSES[bossIdx];
    if (b && t >= b.at) { spawnBoss(anchor(), t, b); bossIdx++; }

    // Boss fight: waves drop to 25% and there are no surges, so the
    // boss gets a moment of its own and can be targeted among the crowd.
    const bossFight = G.EnemyMgr.bossAlive();

    // --- goteo normal ---
    if (G.EnemyMgr.count < CAP) {
      acc += rate(t) * G.Coop.scaleRate(players.length) * (bossFight ? 0.25 : 1) * dt;
      let n = Math.floor(acc);
      acc -= n;
      while (n-- > 0 && G.EnemyMgr.count < CAP) spawnOne(anchor(), t);
    }

    // --- full field: keep it fresh (see refreshOldest) ---
    if (G.EnemyMgr.count >= CAP * FULL_FROM && !bossFight && (refreshT -= dt) <= 0) { refreshT = 1.5; refreshOldest(t); }

    // --- marea ---
    if (!bossFight) surgeT -= dt;
    if (surgeT <= 0) {
      surgeT = G.U.rand(38, 56);
      const base = Math.random() * 6.2832;
      const target = anchor();
      const n = Math.min(CAP - G.EnemyMgr.count, Math.round((14 + Math.floor(t / 22)) * G.Coop.scaleRate(players.length) * 0.4));
      for (let i = 0; i < n; i++) spawnOne(target, t, base + G.U.rand(-0.55, 0.55));
      say('Pokémon swarm!', 2.2);
      G.Audio.sfx('surge');
    }
  }

  /** A bunch at once from one side (when a horde starts). */
  function burst(n) {
    const base = Math.random() * 6.2832, target = anchor() || G.Game.player, t = G.Game.st.time;
    for (let i = 0; i < n && G.EnemyMgr.count < CAP + 10; i++) spawnOne(target, t, base + G.U.rand(-0.6, 0.6));
  }

  /** Surrounds a player: `n` at once, spread evenly from every side (Voltorb swarm waves). */
  function ring(n) {
    const target = anchor() || G.Game.player, t = G.Game.st.time, a0 = Math.random() * 6.2832;
    let made = 0;
    for (let i = 0; i < n && G.EnemyMgr.count < CAP + 24; i++)
      if (spawnOne(target, t, a0 + (i / n) * 6.2832 + G.U.rand(-0.15, 0.15))) made++;
    return made;
  }

  /**
   * A straggler reappears ahead of the player (where they're running),
   * out of view. Returns false if there's no room (then it's removed).
   */
  function ahead(e, pl) {
    if (!players.length) players = [pl];
    const sp = Math.hypot(pl._vx || 0, pl._vy || 0);
    const a0 = sp > 20 ? Math.atan2(pl._vy, pl._vx) : Math.random() * 6.2832;
    const pt = freePoint(pl, a0 + G.U.rand(-0.9, 0.9), e.flying);
    if (!pt) return false;
    e.x = pt[0]; e.y = pt[1]; e.kx = e.ky = 0;
    e.phase = 'walk'; e.pt = 0; e.jump = null; e.jumpLift = 0;
    return true;
  }

  /** Big on-screen notice (also used by the biome and the shinies). */
  /** @param local  only on this computer (not sent to teammates) */
  function say(text, secs = 2.6, local = false, dex = 0) {
    announce = text; announceT = secs; announceDur = secs; announceDex = dex || 0;
    if (G.Coop.isHost && !local) G.Coop.say(text, secs, dex);
  }

  function banner() { return announceT > 0 ? { text: announce, t: announceT, dur: announceDur, dex: announceDex } : null; }

  /** Co-op guest: only the notice's timer runs. */
  function tickBanner(dt) { if (announceT > 0) announceT -= dt; }

  return { reset, update, ahead, burst, ring, tickBanner, banner, say, rate, SHINY_RATE, CAP,
           debugForceShiny(n = 1) { forceShiny = n; } };
})();
