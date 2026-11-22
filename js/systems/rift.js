/* ============ rift.js — rifts and the legendary's arena ============
 *
 * Every so often (a few times per run) a RIFT opens near a
 * player. It lasts GRIETA_TTL seconds; if you step in, it takes you (with the whole group)
 * to a closed arena in the Distortion World, against a LEGENDARY Pokémon.
 *
 *   win      the legendary drops tickets (the ×10, half the time) and coins, and each player gets a
 *            BOND (fuses moves, see Player.fuse); a few
 *            seconds later you return to where you were on the map and choose the fusion
 *   lose     (everyone falls or time runs out) you return with no reward and some
 *            health; the run continues
 *
 * While the arena lasts, the map's enemies are stored (EnemyMgr.stash) and
 * no new ones appear; on returning everything is as it was.
 *
 * Eternamax Eternatus (21-11-2026): at minute ET_AT of a survival run the whole group is pulled into its arena
 * (cfg.et), a three-phase fight: Eternatus, then at two thirds of its health Eternamax Eternatus (a giant that stays
 * put and fires more), and at one third it's enraged. Win and each player picks Gigantamax or the Z-Move for the
 * rest of the run (systems/powers.js). Lose and you're back on the map with no power; the run goes on.
 *
 * Co-op: the host decides. Messages (see coop.js):
 *   'rift' x y ttl · 'riftx' · 'arena' cfg · 'aw' (won) · 'al' (lost)
 *   'zm' (Zygarde Portal: the transformation into Mega Zygarde begins)
 *   'em' (Eternatus becomes Eternamax Eternatus) · 'e3' (Eternatus's last phase)
 *   and from guest to host 're' (I've entered the rift).
 */
G.Rift = (() => {
  // (0.14 until 11-10-2026: more rifts so bonds are seen)
  // Less luck (12-10-2026): each time it doesn't come up, the next is more
  // likely (20 %, 40 %, 60 %, 80 %, 100 %): at most 2.5 min without a rift.
  // From 2 min before Arceus's Judgment (minute 30) they no longer open.
  // Spread out (29-10-2026): after a rift opens, the next check waits REST more seconds once it has gone (the checks
  // stop while a rift or arena is up), so about 12 rifts in a full run instead of about 18; at most 3¼ min without one.
  const CHECK = 30, CHANCE = 0.2, TTL = 45, REST = 45;
  const ARENA_R = 11, ARENA_TIME = 120, FROM = 75;
  const MEGA_DEX = 9718;    // Mega Zygarde sprite (assets/pokemon/9718, tools/fetch_zygarde_mega.py)
  const MEGA_SWAP = 1.6, MEGA_TIME = 3.2;   // seconds: sprite/arena change · untouchable
  // Zygarde Portal: health = this many seconds of your team's measured single-target damage (see spawnLegend).
  // The measurement is a peak (best seconds), and Mega Zygarde heals back to 65% at half health, so the real fight
  // lasts well over this; 45 s leaves room inside ZY_TIME.
  const ZY_DPS_SECONDS = 45;
  const ZY_TIME = 180;      // Zygarde Portal fight: more time, much tougher boss
  // Eternamax Eternatus: when (run seconds), how long the fight may last, the arena's size, its health in seconds of
  // your team's measured single-target damage (it's fought in three phases), and Eternamax's size.
  const ET_AT = 900, ET_TIME = 210, ET_R = 13, ET_DPS_SECONDS = 60, ET_DEX = 890, ET_SCALE = 1.5;
  const arenaTime = () => (arena && arena.et ? ET_TIME : arena && arena.hard ? ZY_TIME : ARENA_TIME);
  let etDone = false, etWarned = false;
  /** A survival run that hasn't met Eternatus yet (no Battle Tower). */
  const etDue = () => !etDone && !G.Tower.active && !G.Judgment.active;
  let rift = null;          // { x, y, ttl, t }
  const EXIT_SAFE = 3;      // seconds of immunity on leaving the rift
  let arena = null;         // { tx, ty, r, dex, shiny, x, y, back, biome, t, phase, endT, bossId }
  let checkT = CHECK, asked = false, downT = 0, misses = 0;
  let wins = 0;             // rift legendaries beaten this run (not the Zygarde Portal): later rifts and bosses scale with it
  // Tougher rifts (08-11-2026): with 3+ bonds (4 bonded moves) legendaries fell in seconds. Each rift won makes the next
  // one tougher, more so after the first two, and its health is at least this many seconds of the team's measured
  // single-target damage (judgment.js singleDps), capped so it still fits in ARENA_TIME.
  const riftHpK = w => 1 + 0.25 * w + 0.35 * Math.max(0, w - 2);
  const riftDmgK = w => 1 + 0.12 * w + 0.15 * Math.max(0, w - 2);
  const riftDpsSecs = w => Math.min(40, 8 + 6 * w);
  const authority = () => !G.Coop.active || G.Coop.isHost;
  const TS = () => G.Tiles.T * G.Sprites.PX;

  /**
   * @param newRun  true only when a run starts (game.js): Eternatus comes once per run, so Arceus's Judgment, which
   *                also calls reset() at minute 30, must not bring it back (22-11-2026: it pulled players in again).
   */
  function reset(newRun = false) {
    rift = null; arena = null; checkT = CHECK; asked = false; downT = 0; misses = 0; wins = 0;
    if (newRun) { etDone = false; etWarned = false; }
  }

  // ---------------- rift on the map ----------------

  function update(dt, pl, time) {
    // Eternamax Eternatus: a warning a few seconds before (on every screen), then the host pulls everyone in.
    // An arena already going on finishes first (the run clock is stopped inside it anyway).
    if (etDue() && !etWarned && time >= ET_AT - 6 && !arena) {
      etWarned = true;
      G.Spawner.say('The ground shakes… Eternatus is awakening!', 5, true);
      G.Camera.kick(1.2);
      G.Audio.sfx('boss');
    }
    if (etDue() && !arena && authority() && time >= ET_AT) {
      etDone = true;
      if (rift) { rift = null; if (G.Coop.isHost) G.Coop.broadcast(['riftx']); }
      start(null, null, true);
    }
    if (rift) {
      rift.t += dt;
      rift.ttl -= dt;
      if (rift.ttl <= 0) { rift = null; return; }
      if (!arena && !pl.dead && G.U.dist2(pl.x, pl.y, rift.x, rift.y - 10) < 30 * 30) enter();
    } else if (!arena && authority() && time > FROM && time < G.Judgment.AT - 120 && !(etDue() && time > ET_AT - 60)) {
      checkT -= dt;
      if (checkT <= 0) {
        checkT = CHECK;
        if (G.EnemyMgr.bossAlive()) return;           // with a boss alive it doesn't count as an attempt
        if (Math.random() < CHANCE * (1 + misses)) { misses = 0; checkT = CHECK + REST; open(); }
        else misses++;
      }
    }
    if (arena) arenaTick(dt, pl);
  }

  function open() {
    const alive = G.Game.everyone().filter(p => !p.dead);
    const near = G.U.pick(alive.length ? alive : [G.Game.player]);
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * 6.2832, d = G.U.rand(380, 560);
      const x = near.x + Math.cos(a) * d, y = near.y + Math.sin(a) * d * 0.85;
      if (!G.World.isFree(x, y, 22)) continue;
      show(x, y, TTL);
      if (G.Coop.isHost) G.Coop.broadcast(['rift', Math.round(x), Math.round(y), TTL]);
      return;
    }
  }

  /** The rift appears (including the one the host sends). */
  function show(x, y, ttl) {
    rift = { x, y, ttl, t: 0 };
    asked = false;
    // (The big notice is drawn by hud.js while rift.t < 4.5 s.)
    G.Audio.sfx('rift');
    G.FX.ring(x, y, 6, 80, '#b48aff', 0.7, 5);
  }

  function enter() {
    if (asked) return;
    asked = true;
    if (authority()) start();
    else G.Coop.toHost(['re']);
  }

  // ---------------- arena ----------------

  /** Whoever is in charge: chooses the legendary and the place, and tells everyone. */
  let nextType = null;          // testing/videos: type of the next arena

  function start(forceType, zy, et) {
    if (arena) return;
    forceType = forceType || nextType; nextType = null;
    let pool = G.DEX.filter(p => p.leg && G.SPRITE_META[p.dex]);
    if (forceType && pool.some(p => p.types.includes(forceType))) pool = pool.filter(p => p.types.includes(forceType));
    // Legendaries you haven't defeated yet come up 4 times more often (fewer repeats).
    const beaten = (G.DB.save && G.DB.save.legends) || {};
    const ws = pool.map(p => (beaten[p.dex] ? 1 : 4));
    let r = Math.random() * ws.reduce((a, b) => a + b, 0), mi = 0;
    while (mi < pool.length - 1 && (r -= ws[mi]) > 0) mi++;
    const mon = zy ? G.DEX_BY[718] : et ? G.DEX_BY[ET_DEX] : pool[mi];
    const here = zy || (!et && rift) || G.Game.player;      // the exit: where the rift was (the same for everyone)
    const cfg = {
      bx: Math.round(here.x), by: Math.round(here.y),
      tx: 5000 + Math.floor(Math.random() * 3000), ty: 5000 + Math.floor(Math.random() * 3000), r: et ? ET_R : ARENA_R,
      dex: mon.dex, shiny: G.Sprites.hasShiny(mon.dex) && Math.random() < G.Charms.mult(mon.dex) / 512,
      // The arena is one of its types', at random.
      type: zy ? 'zygarde' : et ? 'eternatus' : (forceType || G.U.pick(mon.types))
    };
    if (zy) { cfg.hard = 1; cfg.zy = 1; cfg.btype = G.U.pick(mon.types); }     // btype: counts as a rift of that type for goals
    if (et) { cfg.hard = 1; cfg.et = 1; }
    if (G.Coop.isHost) G.Coop.broadcast(['arena', cfg]);
    begin(cfg);
    spawnLegend();
  }

  /** On each computer: the trip to the arena. */
  function begin(cfg) {
    if (!cfg.et) G.RunLog.rift('in', cfg.zy);
    const pl = G.Game.player;
    const ts = TS();
    if (cfg.zy) G.Sprites.preload([MEGA_DEX], 8000, !!cfg.shiny);       // Mega Zygarde's sheets, ready before the change
    if (cfg.et) etDone = true;                                          // (guests too: no second warning)
    arena = Object.assign({}, cfg, {
      x: cfg.tx * ts + ts / 2, y: cfg.ty * ts + ts / 2,
      back: cfg.bx != null ? { x: cfg.bx, y: cfg.by } : rift ? { x: rift.x, y: rift.y } : { x: pl.x, y: pl.y }, biome: G.World.biome, t: 0, phase: 'fight', endT: 0, bossId: 0
    });
    rift = null; asked = false; downT = 0;
    if (authority()) G.EnemyMgr.stash(); else G.EnemyMgr.clearRemote();
    G.Projectiles.clear();
    G.Combat.clearFields();
    G.Hazards.clear();
    G.World.setArena({ tx: cfg.tx, ty: cfg.ty, r: cfg.r, type: cfg.type });
    G.World.setBiome(G.Tiles.arenaBiome(cfg.type), true);
    // Each arena brings its weather (the volcano, sun; the glacier, snow...).
    const th = G.Tiles.ARENA_THEMES[cfg.type];
    if (th && th.weather) G.Weather.force(th.weather, ZY_TIME + 15);
    // (The exit is where the rift was, the same for everyone.)
    // Everyone at the south of the arena, in a row; the legendary appears to the north.
    const ps = G.Game.everyone();
    ps.forEach((p, i) => { p.x = arena.x + (i - (ps.length - 1) / 2) * 34; p.y = arena.y + ts * 3; });
    G.Camera.x = pl.x; G.Camera.y = pl.y;
    G.Game.flash(cfg.et ? '#ff4d7a' : '#c9a6ff', 0.9);
    G.Audio.sfx('rift');
    G.Spawner.say(cfg.et ? 'Eternatus pulled you into its lair!' : 'You entered the rift…', 2.6, true);
  }

  function spawnLegend() {
    const mon = G.DEX_BY[arena.dex];
    const t = G.Game.st.time;
    const n = G.Game.everyone().length;
    const ts = TS();
    const hard = !!arena.hard;       // Zygarde Portal: tougher than a normal rift legend
    let hp = Math.round((3200 + t * 9) * G.Coop.scaleHp(n) * (n > 1 ? 1.4 : 1) * (hard ? 2.5 : 1));
    // Zygarde Portal: health also follows how hard your team really hits ONE target (the same measurement Arceus
    // uses, judgment.js singleDps), so strong teams cannot melt it. Not totalDps: that is damage spread over the
    // whole horde (area attacks), many times what anyone can do to a single boss (18-10-2026: 2 players, 75% left).
    if (arena.et) hp = Math.max(Math.round(hp * 1.3), Math.round(G.Judgment.singleDps() * ET_DPS_SECONDS));   // (three phases)
    else if (hard) hp = Math.max(hp, Math.round(G.Judgment.singleDps() * ZY_DPS_SECONDS));
    else hp = Math.max(Math.round(hp * riftHpK(wins)), Math.round(G.Judgment.singleDps() * riftDpsSecs(wins)));
    const dk = hard ? 1.35 : riftDmgK(wins);
    const def = {
      dex: mon.dex, name: mon.name,
      hp,
      spd: Math.round(G.U.clamp(48 + (mon.spd - 78) * 0.6, 48, 105) * (hard ? 1.15 : 1 + 0.03 * Math.min(wins, 8))),
      dmg: Math.round((36 + t / 20) * dk), xp: Math.round((500 + t * 1.2) * (hard ? 2 : 1)),
      behavior: mon.types.some(x => ['psychic', 'electric', 'ghost', 'fairy', 'fire', 'water', 'ice', 'dragon'].includes(x)) ? 'ranged' : 'charger',
      shotDmg: Math.round((18 + t / 40) * dk), shotCd: hard ? 0.65 : Math.max(0.6, 0.9 - 0.04 * wins), range: hard ? 340 : 300
    };
    const e = new G.Enemy(def, arena.x, arena.y - ts * 3.5, { hp: 1, spd: 1, dmg: 1 }, true);
    e.legend = true;
    e.hard = hard;
    if (arena.et) { e.eternal = true; e.noEnrage = true; }     // its own kit and phases (enemy.js bossInit, etPhase below)
    // It collides with walls and columns like you: if it flew over the
    // rocks, your shots couldn't reach it (the Celebi bug).
    e.flying = false;
    if (arena.shiny) e.makeShiny();
    G.EnemyMgr.add(e);
    arena.bossId = e.id;
    G.Spawner.say(arena.et ? (e.shiny ? 'A shiny ' : '') + 'Eternatus awakens! Defeat it to gain its power'
      : hard ? (e.shiny ? 'A shiny ' : '') + e.name + ' guards the portal!' : (e.shiny ? 'A shiny ' : '') + e.name + ' was waiting in the rift!', 3.2);
    G.Camera.kick(1.1);
    G.Audio.sfx('boss');
  }

  /** Nobody leaves the arena's circle (in case something pushes too hard). */
  function keepInside() {
    const ts = TS(), max = (arena.r - 1.4) * ts;
    for (const e of G.EnemyMgr.all()) {
      if (e.remote) continue;
      const dx = e.x - arena.x, dy = e.y - arena.y, d = Math.hypot(dx, dy);
      if (d > max) { e.x = arena.x + dx / d * max; e.y = arena.y + dy / d * max; }
    }
  }

  function arenaTick(dt, pl) {
    arena.t += dt;
    if (arena.phase === 'fight') {
      if ((arena.zy || arena.et) && arena.mega) megaAdvance(dt);    // every machine runs its own copy of the transformation
      if (!authority()) return;
      keepInside();
      const boss = G.EnemyMgr.get(arena.bossId);
      if (arena.zy && boss && !boss.dead && !arena.mega && boss.hp <= boss.maxHp * 0.5) {
        if (G.Coop.isHost) G.Coop.broadcast(['zm']);
        startMega();
      }
      // Eternatus: Eternamax at two thirds of its health, enraged at one third.
      if (arena.et && boss && !boss.dead) {
        if (!arena.mega && boss.hp <= boss.maxHp * 2 / 3) { if (G.Coop.isHost) G.Coop.broadcast(['em']); startMega(); }
        else if (arena.megaDone && !arena.p3 && boss.hp <= boss.maxHp / 3) { if (G.Coop.isHost) G.Coop.broadcast(['e3']); etLast(); }
      }
      if (!boss || boss.dead) { G.Coop.isHost && G.Coop.broadcast(['aw']); won(); return; }
      const allDown = G.Game.everyone().every(p => p.dead);
      downT = allDown ? downT + dt : 0;
      if (downT > 1.4 || arena.t > arenaTime()) { G.Coop.isHost && G.Coop.broadcast(['al']); lost(); }
      return;
    }
    arena.endT -= dt;
    if (arena.endT <= 0) {
      // Zygarde Portal: losing the fight ends the whole run (no escape back to the map).
      if (arena.zy && arena.phase === 'lost') { arena.endT = 999; G.Game.failRun(); }      // (Eternatus doesn't: you're just back on the map)
      else finish();
    }
  }

  // ---- Zygarde Portal: at half health Zygarde turns into Mega Zygarde ----

  /** The boss entity: the real one on the host/solo, the copy on guests. */
  function zyBoss() {
    return authority() ? G.EnemyMgr.get(arena.bossId) : G.EnemyMgr.all().find(e => e.boss && !e.dead);
  }

  /** Starts the transformation (host/solo, and guests when the host says 'zm'). */
  function startMega() {
    if (!arena || !(arena.zy || arena.et) || arena.mega) return;
    arena.mega = 1; arena.megaT = 0;
    G.Spawner.say(arena.et ? 'Eternatus is drawing in all the power of Galar!' : 'Zygarde is changing form!', 3, true);
    G.Camera.kick(1.2);
    G.Game.flash('#eafff0', 0.6);
    G.Audio.sfx('boss');                                   // TODO: its own sound (see TODO.md)
    const boss = zyBoss();
    if (boss && authority()) { boss.megaT = MEGA_TIME; boss.freezeT = MEGA_TIME; }
  }

  function megaAdvance(dt) {
    arena.megaT += dt;
    const boss = zyBoss();
    if (boss && authority()) boss.megaT = Math.max(0, MEGA_TIME - arena.megaT);
    if (arena.megaT < MEGA_SWAP || arena.megaDone) return;
    arena.megaDone = 1;
    if (arena.et) { eternamax(boss); return; }
    if (boss) {
      boss.dex = MEGA_DEX; boss.name = 'Mega Zygarde'; boss.scale = 1;
      boss.def = Object.assign({}, boss.def, { dex: MEGA_DEX, name: 'Mega Zygarde' });
      boss.anim = new G.Sprites.Animator(MEGA_DEX, 1, !!boss.shiny);
      boss.r = G.Sprites.bodyRadius(MEGA_DEX, 1);
      boss.bodyH = G.Sprites.bodyHeight(MEGA_DEX, 1);
      if (authority()) { boss.hp = Math.round(boss.maxHp * 0.65); boss.dmg *= 1.25; boss.spd *= 1.1; }
    }
    // The arena changes with it: purple cells and toxic pools.
    G.World.setArena({ tx: arena.tx, ty: arena.ty, r: arena.r, type: 'zygarde2' });
    G.World.setBiome(G.Tiles.arenaBiome('zygarde2'), true);
    arena.type = 'zygarde2';
    G.Game.flash('#d9b8ff', 0.8);
    G.Camera.kick(1.4);
    G.Spawner.say('MEGA ZYGARDE', 3, true);
  }

  // ---- Eternamax Eternatus: phases 2 and 3 ----

  /** Phase 2 (every machine): the giant Eternamax, rooted in the middle; the arena turns red. */
  function eternamax(boss) {
    const ts = TS();
    if (boss) {
      boss.name = 'Eternamax Eternatus';
      boss.def = Object.assign({}, boss.def, { name: boss.name });
      boss.scale = ET_SCALE;
      boss.anim = new G.Sprites.Animator(ET_DEX, ET_SCALE, !!boss.shiny);
      boss.r = G.Sprites.bodyRadius(ET_DEX, ET_SCALE);
      boss.bodyH = G.Sprites.bodyHeight(ET_DEX, ET_SCALE);
      if (authority()) {
        boss.x = arena.x; boss.y = arena.y - ts * 1.5;
        boss.anchored = true;
        boss.dmg *= 1.15;
        if (!boss.ai) boss.bossInit();
        Object.assign(boss.ai, { melee: ['slam'], ranged: ['beam', 'cross', 'ring', 'spiral', 'rain'], cast: null, cd: 1.4 });
      }
    }
    G.World.setArena({ tx: arena.tx, ty: arena.ty, r: arena.r, type: 'eternatus2' });
    G.World.setBiome(G.Tiles.arenaBiome('eternatus2'), true);
    arena.type = 'eternatus2';
    G.Game.flash('#ff7a9a', 0.8);
    G.Camera.kick(1.6);
    G.Spawner.say('ETERNAMAX ETERNATUS', 3, true);
  }

  /** Phase 3 (every machine; the host changes the boss): enraged, with every attack it has. */
  function etLast() {
    if (!arena || !arena.et || arena.p3) return;
    arena.p3 = 1;
    const boss = zyBoss();
    if (boss && authority()) {
      if (!boss.ai) boss.bossInit();
      boss.ai.ranged = ['beam', 'cross', 'ring', 'spiral', 'barrage', 'nova'];
      if (!boss.ai.fury) boss.enrage();
    }
    G.Spawner.say('Eternamax Eternatus unleashes its full power!', 3, true);
    G.Game.flash('#ff2d5a', 0.6);
    G.Camera.kick(1.2);
  }

  function won() {
    if (!arena || arena.phase !== 'fight') return;
    arena.phase = 'won'; arena.endT = 5;
    // (Eternatus isn't a rift: it doesn't count for rift goals, the rift scaling or the Rusted Sword, and gives no
    // Bond: its reward is the power you choose on the way out, plus the loot.)
    if (!arena.et) G.RunLog.rift('w', arena.zy);
    if (!arena.zy && !arena.et) wins++;
    if (!arena.et) G.Progress.event('rift', { type: arena.btype || arena.type });
    G.Pickups.pullAll();
    G.Spawner.say(arena.et ? 'You defeated Eternamax Eternatus! Its power is yours to claim…' : 'You defeated ' + G.DEX_BY[arena.dex].name + '! Grab your reward…', 3.4, true);
    G.Audio.sfx('legend');
    if (arena.et) return;
    const pl = G.Game.player;
    if (pl && !arena.zy) {          // the Zygarde Portal gives no Bond (its reward is the extra loot)
      pl.bonds++;
      G.FX.dmgText(pl.x, pl.y - pl.bodyH - 10, 'Bond!', '#ff8ad8', true);
      G.FX.ring(pl.x, pl.y, 8, 90, '#ff8ad8', 0.7, 5);
    }
    G.Items.riftWon(pl);            // Rusted Sword: rifts won while holding it (the Zygarde Portal counts too)
  }

  function lost() {
    if (!arena || arena.phase !== 'fight') return;
    arena.phase = 'lost'; arena.endT = 1.2;
    if (!arena.et) G.RunLog.rift('l', arena.zy);
    G.Spawner.say(arena.zy ? 'Zygarde has ended your run…' : arena.et ? 'Eternatus drove you back… its power slips away' : 'The rift threw you out…', 2.6, true);
    G.Audio.sfx('back');
  }

  /** On each computer: back to the map. */
  function finish() {
    const pl = G.Game.player;
    const a = arena;
    arena = null;
    G.World.setBiome(a.biome, true);
    G.Weather.clear();
    // Guest: nothing is deleted. The host announces the arena's enemies that
    // leave and the map's ones that return; if the guest finished its count-
    // down a little later (it almost always does), it deleted the ones that had just
    // returned and they couldn't be seen until they fell (only their attacks).
    if (authority()) G.EnemyMgr.restore();
    G.Projectiles.clear();
    G.Combat.clearFields();
    G.Hazards.clear();
    for (const p of G.Game.everyone()) { p.x = a.back.x; p.y = a.back.y; }
    pl.x = a.back.x; pl.y = a.back.y;
    if (pl.dead) pl.revive(0.3);
    // A few seconds of not taking damage on leaving (enemies come back all at once).
    for (const p of G.Game.everyone()) p.invuln = Math.max(p.invuln || 0, EXIT_SAFE);
    pl.invuln = Math.max(pl.invuln || 0, EXIT_SAFE);
    G.Camera.x = pl.x; G.Camera.y = pl.y;
    G.Game.flash(a.et ? '#ff4d7a' : '#c9a6ff', 0.8);
    if (a.et && a.phase === 'won') G.Game.offerPower();          // each player picks Gigantamax or the Z-Move
    if (pl.bonds > 0) G.Game.offerBond();
  }

  // ---------------- drawing ----------------

  /** The rift, to sort it by Y with the rest of the scene. */
  /** Zygarde arena: glowing rings, light under each monolith, the portal you came through, and the transformation effects. */
  // (Eternatus's arena uses the same rings and monolith lights, in red and pink, with no portal.)
  const LOOK = { zy: { a: '#4dff9a', b: '#c27bff', la: 'rgba(77,255,154,0.55)', lb: 'rgba(194,123,255,0.55)', ta: '#7dffb0', tb: '#d9a6ff',
                       ga: 'rgba(160,255,200,0.9)', gb: 'rgba(215,170,255,0.9)' },
                 et: { a: '#ff3d6e', b: '#ff9ad0', la: 'rgba(255,61,110,0.55)', lb: 'rgba(255,154,208,0.55)', ta: '#ff6b8a', tb: '#ffc2dc',
                       ga: 'rgba(255,120,150,0.9)', gb: 'rgba(255,190,220,0.9)' } };
  function zyDraw(ctx) {
    const ts = TS(), t = arena.t, mega = !!arena.megaDone, L = arena.et ? LOOK.et : LOOK.zy;
    ctx.save();
    ctx.strokeStyle = mega ? L.b : L.a;
    ctx.lineWidth = 5; ctx.globalAlpha = 0.20 + 0.10 * Math.sin(t * 2);
    ctx.beginPath(); ctx.arc(arena.x, arena.y, 7.5 * ts, 0, 6.2832); ctx.stroke();
    ctx.lineWidth = 3; ctx.globalAlpha = 0.16 + 0.08 * Math.sin(t * 2 + 1.5);
    ctx.beginPath(); ctx.arc(arena.x, arena.y, 3.4 * ts, 0, 6.2832); ctx.stroke();
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 6 + k * Math.PI / 3;
      const mx = arena.x + (Math.round(Math.cos(a) * 7.5) + 0.5) * ts, my = arena.y + (Math.round(Math.sin(a) * 7.5) + 0.5) * ts;
      const g = ctx.createRadialGradient(mx, my, 4, mx, my, 70);
      g.addColorStop(0, mega ? L.lb : L.la); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 2.2 + k); ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(mx, my, 70, 0, 6.2832); ctx.fill();
    }
    // The portal you came through, at the south edge.
    if (arena.zy) {
      const img = G.Tiles.propSprite(0, 'zportal', 0), P = G.Sprites.PX, w = img.width * P / 2, h = img.height * P / 2, py = arena.y + 5.7 * ts;   // (arena exit keeps the old 64-unit size)
      ctx.globalAlpha = 0.9;
      ctx.drawImage(img, Math.round(arena.x - w / 2), Math.round(py - h / 2), w, h);
    }
    ctx.restore();

    // Transformation: rings, glow and light rays around the boss.
    const boss = arena.mega && arena.megaT < MEGA_TIME ? zyBoss() : null;
    if (!boss) return;
    const mt = arena.megaT, x = boss.x, y = boss.y - boss.bodyH * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const p = (mt * 0.9 + i / 3) % 1;
      ctx.globalAlpha = (1 - p) * 0.7; ctx.strokeStyle = mt < MEGA_SWAP ? L.ta : L.tb; ctx.lineWidth = 6 * (1 - p) + 1;
      ctx.beginPath(); ctx.arc(x, y, 30 + p * 230, 0, 6.2832); ctx.stroke();
    }
    const peak = Math.max(0, 1 - Math.abs(mt - MEGA_SWAP) / MEGA_SWAP);
    const g = ctx.createRadialGradient(x, y, 10, x, y, 150);
    g.addColorStop(0, mt < MEGA_SWAP ? L.ga : L.gb); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = peak * 0.8; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, 150, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = peak * 0.5; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
    for (let k = 0; k < 10; k++) {
      const a = k * 0.6283 + mt * 1.2, r0 = 60, r1 = 140 + 80 * peak;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.stroke();
    }
    ctx.restore();
  }

  function drawable() {
    // Zygarde arena: drawn under everything, except during the transformation (effects go on top).
    if (arena && (arena.zy || arena.et)) return { y: arena.mega && arena.megaT < MEGA_TIME ? arena.y + 9999 : arena.y - 9999, draw: zyDraw };
    if (!rift) return null;
    return {
      y: rift.y,
      draw(ctx) {
        const P = G.Sprites.PX;
        const img = G.Tiles.propSprite(0, 'rift', Math.floor(rift.t * 8) % 4);
        const w = img.width * P, h = img.height * P;
        const fadeIn = Math.min(1, rift.t * 2), fadeOut = Math.min(1, rift.ttl / 1.5);
        ctx.save();
        ctx.globalAlpha = 0.25 * fadeIn * fadeOut;
        ctx.fillStyle = '#7b3cff';
        ctx.beginPath(); ctx.ellipse(rift.x, rift.y, 34, 12, 0, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = fadeIn * fadeOut;
        ctx.drawImage(img, Math.round(rift.x - w / 2), Math.round(rift.y - h + 4), w, h);
        ctx.restore();
        if (Math.random() < 0.3) G.FX.px(rift.x + G.U.rand(-14, 14), rift.y - G.U.rand(10, 80), '#d9c2ff', { vy: -40, life: 0.6 });
      }
    };
  }

  // ---------------- red ----------------

  function onEvent(ev) {
    switch (ev[0]) {
      case 'rift': show(ev[1], ev[2], ev[3]); break;
      case 'riftx': rift = null; break;
      case 'arena': begin(ev[1]); break;
      case 'zm': startMega(); break;
      case 'em': startMega(); break;
      case 'e3': etLast(); break;
      case 'aw': won(); break;
      case 'al': lost(); break;
    }
  }

  return {
    reset, update, drawable, onEvent, enterRequest() { if (!arena) start(); },
    /** Can a Zygarde Portal be used right now? (not in a fight, not near Arceus' Judgment) */
    canZygarde() { return !arena && G.Game.st.time < G.Judgment.AT - 120 && !(etDue() && G.Game.st.time > ET_AT - 60); },
    /** Seconds into a survival run when Eternamax Eternatus comes. */
    ET_AT,
    /** Host/solo: a player stepped on the portal at tile (tx,ty), world (x,y). */
    startZygarde(tx, ty, x, y) {
      if (arena || !authority() || G.World.altarUsed(tx, ty) || !this.canZygarde()) return;
      G.World.markUsed(tx, ty);
      if (G.Coop.isHost) G.Coop.broadcast(['gu', tx, ty]);
      start(null, { x, y });
    },
    get rift() { return rift; }, get arena() { return arena; },
    get inArena() { return !!arena; },
    /** Rift legendaries beaten this run (open-map bosses scale with it too: spawner.js). */
    get wins() { return wins; },
    get timeLeft() { return arena ? Math.max(0, arenaTime() - arena.t) : 0; },
    debugOpen() { open(); },
    /** Tests: the Zygarde Portal fight right now, as if you had stepped on a portal where you stand. */
    debugZygarde() { const p = G.Game.player; start(null, { x: p.x, y: p.y }); },
    /** Tests: the Eternamax Eternatus fight right now. */
    debugEternatus() { etDone = true; start(null, null, true); },
    /** For testing: an arena of one type right now. */
    debugArena(type) { start(type); },
    /** For videos: the next rift you enter will be of this type. */
    debugNextType(type) { nextType = type; }
  };
})();
