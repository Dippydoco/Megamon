/* ============ tower.js — the Battle Tower (a second main mode) ============
 *
 * A tower run is a normal run (game.js startRun with a `tower` config) that never touches the open map: every
 * floor is a closed arena (World.setArena, the same machinery as rifts) with one goal. Floor plans, Badges and
 * the BP shop are in data/tower.js; scripted bosses in systems/towerbosses.js.
 *
 *   Climb       solo. Beating a gatekeeper (10F, 20F...) saves that checkpoint for good; runs can start at any
 *               saved checkpoint, with free levels as a head start (TowerData.headStart).
 *   Expedition  co-op, from a friends room. Same floors as a pure roguelike run; never moves checkpoints. With 2+
 *               players the 3rd and 8th floor of each section are co-op event floors (Seal Plates, Twin Bond).
 *
 * A floor:  intro (1.4 s) -> fight -> clear (rewards, pickups pulled) -> cards (a level for everyone)
 *           -> badges (after bosses: pick 1 of 3) -> next (one or two stairways appear; walk into one) -> the next floor.
 * Floor kinds other than horde, bosses and the co-op events live in systems/towerfloors.js (objective, puzzle and
 * dungeon floors); the stairways offer them (TowerData.choices).
 * Rewards land in the save as soon as a floor is cleared (Battle Points, first-clear tickets, checkpoints), so a
 * tab closed mid-run loses nothing already earned.
 *
 * Difficulty runs on a "floor clock" (TowerData.dTime), not the run's clock: enemies are made with the stats of
 * that survival second. The run's clock still counts real time (shown at the end).
 *
 * Co-op: the host runs the floors and tells everyone. Messages ('tw', see coop.js):
 *   host -> all   'fl' cfg (a floor starts) · 'k' kills (horde progress) · 'pp' progress mask (plates)
 *                 'clr' n (floor cleared) · 'bdg' (pick your Badge) · 'win' · 'sc' ... (boss scripts)
 *   guest -> host 'bd' (I've picked my Badge)
 */
G.Tower = (() => {
  const D = () => G.TowerData;
  const authority = () => !G.Coop.active || G.Coop.isHost;
  const TS = () => G.Tiles.T * G.Sprites.PX;
  const INTRO = 1.4, BADGE_WAIT = 40;

  let run = null;        // { mode, start, floor, bp, t10, firsts, cp, won, badges:[], best }
  let fl = null;         // the floor being played: { cfg, phase, t, k0, kills, spawnT, bossIds, enraged, prog, mask, ... }
  let badgeWait = null;  // host: uids that still have to pick a Badge
  let netT = 0, lastKills = -1, syncT = 0;
  let forceEvents = false;   // tests (?dev): event floors even solo

  function reset() { run = null; fl = null; badgeWait = null; G.TowerBosses.reset(); if (G.TowerUI) G.TowerUI.closeBadges(); }

  /** Starts a tower run (every computer; the host / solo then opens the first floor). cfg: { mode, start } */
  function start(cfg) {
    const s = G.DB.save;
    const start = Math.max(1, Math.min(D().FLOORS, cfg.start | 0 || 1));
    run = { mode: cfg.mode === 'exp' ? 'exp' : 'climb', start, floor: start - 1, bp: 0, t10: 0, firsts: [], cpNew: 0, won: false, badges: [], best: start - 1 };
    fl = null; badgeWait = null;
    if (s && s.tower) s.tower.runs = (s.tower.runs || 0) + 1;
    if (authority()) {
      const head = D().headStart(start);
      if (head > 0) G.Game.grantLevels(head);
      openHub();     // every run starts in the entrance hall (systems/towerhub.js)
    }
  }

  // ---------------- floors ----------------

  /** Host / solo: the entrance hall, the room every tower run starts in. */
  function openHub() {
    const cfg = { n: run.start - 1, kind: 'hub', arena: 'tower', r: G.TowerHub.R, tx: 6000, ty: 5600, t: 0, section: 0,
                  np: G.Game.everyone().length };
    if (G.Coop.isHost) G.Coop.broadcast(['tw', 'fl', cfg]);
    beginFloor(cfg);
  }

  const coopFloors = () => (G.Coop.active && G.Game.everyone().length > 1 && run.mode === 'exp') || forceEvents;
  const kindOf = cfg => G.TowerFloors.get(cfg.kind);

  /** Host / solo: plans the next floor (of the kind on the stairway taken) and sends it to everyone. */
  function nextFloor(kind) {
    const n = run.floor + 1;
    const players = G.Game.everyone();
    const coop = coopFloors();
    const plan = D().floor(n, coop, kind);
    // A fresh patch of the far map for every floor (World.setArena forgets whatever was generated there).
    const cfg = Object.assign({}, plan, { tx: 6000 + n * 70, ty: 6000 + (n % 5) * 70, np: players.length });
    if (plan.kind === 'plates') {
      const k = Math.max(forceEvents ? 1 : 2, players.length), a0 = Math.random() * 6.2832;
      cfg.plates = [];
      for (let i = 0; i < k; i++) cfg.plates.push([Math.cos(a0 + i * 6.2832 / k) * 0.58, Math.sin(a0 + i * 6.2832 / k) * 0.58]);
    }
    if (plan.kind === 'horde' || plan.kind === 'plates') cfg.quota = Math.round((plan.quota || 0) * (1 + 0.6 * (players.length - 1)));
    const K = kindOf(cfg);
    if (K && K.plan) K.plan(cfg);
    if (G.Coop.isHost) G.Coop.broadcast(['tw', 'fl', cfg]);
    beginFloor(cfg);
  }

  /** Every computer: the trip to floor cfg.n. */
  function beginFloor(cfg) {
    if (!run) return;
    run.floor = cfg.n;
    fl = { cfg, phase: cfg.kind === 'hub' ? 'hub' : 'intro', t: 0, k0: 0, kills: 0, spawnT: 0, bossIds: [], enraged: false, prog: 0, mask: 0, done: {} };
    lastKills = -1;
    G.TowerBosses.reset();                           // no wind or darkness carried over
    G.TowerUI.closeBadges();                         // (a guest still picking when the host moved on)
    const pl = G.Game.player, ts = TS();
    if (authority()) G.EnemyMgr.clear(); else G.EnemyMgr.clearRemote();
    G.Pickups.clear();
    G.Projectiles.clear();
    G.Combat.clearFields();
    G.Hazards.clear();
    const K = kindOf(cfg), map = K && K.map ? K.map(cfg) : null;      // dungeon floors: a built map instead of a circle
    G.World.setArena({ tx: cfg.tx, ty: cfg.ty, r: map ? 1 : cfg.r, type: cfg.arena, map });
    G.World.setBiome(G.Tiles.arenaBiome(cfg.arena), true);
    const th = G.Tiles.ARENA_THEMES[cfg.arena];
    G.Weather.clear();
    if (th && th.weather) G.Weather.force(th.weather, 9999);
    fl.x = cfg.tx * ts + ts / 2; fl.y = cfg.ty * ts + ts / 2;
    // Everyone in a row at the south of the arena; bosses appear to the north.
    const ps = G.Game.everyone();
    const [sx, sy] = cfg.kind === 'hub' ? [fl.x, G.TowerHub.spawnY(fl)] : K && K.spawn ? K.spawn(fl) : [fl.x, fl.y + ts * 3];
    ps.forEach((p, i) => { p.x = sx + (i - (ps.length - 1) / 2) * 34; p.y = sy; });
    pl.x = sx + (ps.indexOf(pl) - (ps.length - 1) / 2) * 34; pl.y = sy;
    if (pl.dead) pl.revive(0.5);                     // a fallen teammate gets up on the next floor
    pl.invuln = Math.max(pl.invuln || 0, 2);
    G.Camera.x = pl.x; G.Camera.y = pl.y;
    G.Game.flash('#ffe9a8', 0.8);
    G.Audio.sfx('rift');
    // Sprites the floor needs.
    if (cfg.dex) G.Sprites.preload([cfg.dex], 8000);
    if (cfg.kind === 'twins') G.Sprites.preload([311, 312], 8000);
    G.Sprites.preload(G.Enemies.upcomingDex(cfg.t, 30));
    if (cfg.kind === 'hub') { G.TowerHub.preload(); G.Spawner.say('Battle Tower', 2.4, true); return; }
    const sec = D().SECTIONS[cfg.section];
    G.Spawner.say(cfg.n + 'F · ' + (cfg.kind === 'final' ? 'The Summit' : sec.name), 2.4, true);
  }

  /** Host / solo: what fills the floor once the intro is over. */
  function fight() {
    const cfg = fl.cfg, pl = G.Game.player;
    fl.phase = 'fight'; fl.t = 0; fl.k0 = pl.kills;
    const K = kindOf(cfg);
    if (K) { K.start(fl); return; }
    if (cfg.kind === 'horde' || cfg.kind === 'plates') {
      fl.bag = themedBag(cfg);
      G.Sprites.preload(fl.bag.map(d => d.dex), 8000);
      for (let i = 0; i < 4 + 2 * cfg.np; i++) spawnWild();
      return;
    }
    if (cfg.kind === 'twins') {
      const a = spawnBoss(311, cfg, -1), b = spawnBoss(312, cfg, 1);
      G.TowerBosses.pairTwins(a, b);
      G.Spawner.say('Plusle and Minun! Take them down together', 3.2);
      return;
    }
    const e = spawnBoss(cfg.dex, cfg, 0);
    G.Spawner.say((e.shiny ? 'A shiny ' : '') + e.name + (cfg.kind === 'final' ? ' rules the summit!' : cfg.kind === 'gate' ? ' guards the way up!' : ' blocks the stairs!'), 3.2);
  }

  /**
   * The floor's wild Pokémon, fitting its section and arena (Shadow Wing: Ghost, Dark, Poison, Psychic...):
   * up to 4 of the arena's type, 3 times as likely, plus 2 from two other types of the section, all with the floor
   * clock's tier stats. Falls back to the run's usual mix if a tier has too few of those types.
   */
  function themedBag(cfg) {
    const S = D().SECTIONS[cfg.section], bag = [];
    for (const d of G.Enemies.hordeDefs(cfg.arena, cfg.t)) bag.push(d, d, d);
    for (const ty of G.U.pickN((S.wild || []).filter(x => x !== cfg.arena), 2)) for (const d of G.Enemies.hordeDefs(ty, cfg.t).slice(0, 2)) bag.push(d);
    const out = bag.length >= 6 ? bag : bag.concat(G.Enemies.bagAt(cfg.t));
    // Healers and shielders come whatever the theme: the run's own (its cast at this tier), once each.
    const seen = new Set(), kinds = new Set();
    for (const d of G.Enemies.bagAt(cfg.t)) if (SUPPORT[d.behavior] && !seen.has(d.dex)) { seen.add(d.dex); kinds.add(d.behavior); out.push(d); }
    // (and if the run's cast has none of one kind at this tier, one from the whole tier)
    for (const d of G.Enemies.supportDefs(cfg.t)) if (!kinds.has(d.behavior)) out.push(d);
    return out;
  }
  const SUPPORT = { healer: 2, shielder: 2 };       // at most this many of each alive at once (tower floors)

  /**
   * A wild Pokémon somewhere inside the arena, away from everyone (or at `at`; dungeon floors pick their own spots).
   * noSupport: never a healer or shielder (Bounty marks).
   */
  function spawnWild(noSupport = false, at = null) {
    const cfg = fl.cfg, ts = TS(), ps = G.Game.everyone();
    const bag = fl.bag && fl.bag.length ? fl.bag : G.Enemies.bagAt(cfg.t);
    if (!bag.length) return null;
    const count = {};
    for (const e of G.EnemyMgr.all()) if (!e.dead && SUPPORT[e.behavior]) count[e.behavior] = (count[e.behavior] || 0) + 1;
    const ok = bag.filter(d => !SUPPORT[d.behavior] || (!noSupport && (count[d.behavior] || 0) < SUPPORT[d.behavior]));
    if (!ok.length) return null;
    const def = G.U.pick(ok);
    const flyer = G.Sprites.hovers(def.dex);
    const K = kindOf(cfg);
    for (let i = 0; i < 14; i++) {
      let x, y;
      if (at) [x, y] = i ? [at[0] + G.U.rand(-40, 40), at[1] + G.U.rand(-40, 40)] : at;
      else if (K && K.spawnPoint) { const p = K.spawnPoint(fl); if (!p) continue; [x, y] = p; }
      else { const a = Math.random() * 6.2832, d = G.U.rand(0.25, 0.86) * (cfg.r - 2) * ts; x = fl.x + Math.cos(a) * d; y = fl.y + Math.sin(a) * d; }
      if (!flyer && !G.World.isFree(x, y, 14)) continue;
      if (!at && ps.some(p => !p.dead && G.U.dist2(p.x, p.y, x, y) < 230 * 230)) continue;
      const e = G.Spawner.make(def, x, y, cfg.t, ps.length);
      G.EnemyMgr.add(e);
      G.FX.ring(x, y, 4, 34, '#d9c2ff', 0.35, 3);
      return e;
    }
    return null;
  }

  /** Horde floors: the enemies far from everyone warp in around a player. */
  function regroup() {
    const ps = G.Game.everyone().filter(p => !p.dead);
    if (!ps.length) return;
    let n = 0;
    for (const e of G.EnemyMgr.all()) {
      if (e.dead || e.remote || e.boss) continue;
      if (ps.some(p => G.U.dist2(p.x, p.y, e.x, e.y) < 260 * 260)) continue;
      const p = G.U.pick(ps);
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * 6.2832, d = G.U.rand(200, 280), x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
        if (!G.World.isFree(x, y, 14)) continue;
        G.FX.ring(e.x, e.y, 4, 30, '#d9c2ff', 0.3, 3);
        e.x = x; e.y = y; e.kx = e.ky = 0;
        G.FX.ring(x, y, 4, 34, '#d9c2ff', 0.35, 3);
        n++;
        break;
      }
    }
    if (n) G.Spawner.say('The last ones close in!', 1.8);
  }

  /** A boss for this floor (host / solo). side: -1 / 0 / 1 = where along the north it stands. */
  function spawnBoss(dex, cfg, side) {
    const mon = G.DEX_BY[dex], t = cfg.t, n = cfg.np, ts = TS();
    const ranged = mon.types.some(x => ['psychic', 'electric', 'ghost', 'fairy', 'fire', 'water', 'ice', 'dragon'].includes(x));
    let def, sc;
    if (cfg.kind === 'gate' || cfg.kind === 'final') {
      // Like a rift legendary of that minute (rift.js spawnLegend); the final one much tougher.
      const fin = cfg.kind === 'final';
      // (25-10-2026: much tougher, ×3 for gatekeepers and ×4.5 for Rayquaza over a rift legendary.)
      const hp = Math.round((3200 + t * 9) * G.Coop.scaleHp(n) * (n > 1 ? 1.4 : 1) * (fin ? 4.5 : 3));
      def = { dex, name: mon.name, hp,
              spd: Math.round(G.U.clamp(48 + (mon.spd - 78) * 0.6, 48, 105) * (fin ? 1.1 : 1)),
              dmg: Math.round((36 + t / 20) * (fin ? 1.3 : 1)), xp: Math.round((500 + t * 1.2) * (fin ? 2 : 1)),
              behavior: ranged ? 'ranged' : 'charger', shotDmg: Math.round((18 + t / 40) * (fin ? 1.3 : 1)), shotCd: fin ? 0.7 : 0.9, range: 300 };
      sc = { hp: 1, spd: 1, dmg: 1 };
    } else {
      // Like a survival boss of that section (enemies.js BOSS_SLOTS), on the floor clock.
      const slot = G.Enemies.BOSS_SLOTS[Math.min(G.Enemies.BOSS_SLOTS.length - 1, cfg.section)];
      const bs = (mon.spd - 78) / 0.42;
      // (25-10-2026: ×2.5 for 5th-floor bosses, ×1.5 for each twin.)
      def = { dex, name: mon.name, hp: Math.round(slot.hp * 1.35 * (cfg.kind === 'twins' ? 1.5 : 2.5)),
              spd: Math.round(G.U.clamp(40 + bs * 0.5, 40, 100)), dmg: Math.round(slot.dmg * 1.2), xp: slot.xp,
              behavior: ranged ? 'ranged' : (bs > 90 ? 'charger' : 'chase'), shotDmg: Math.round(slot.dmg * 0.55), shotCd: 1.1, range: 260 };
      const bsc = G.Enemies.bossScale(t);
      sc = Object.assign({}, bsc, { hp: bsc.hp * G.Coop.scaleHp(n) * (n > 1 ? 1.4 : 1) });
    }
    const e = new G.Enemy(def, fl.x + side * ts * 3, fl.y - ts * 3.5, sc, true);
    // A floor under the team's real damage too: health worth at least this many seconds of their best single-target
    // damage per second (the measurement Arceus and the Zygarde Portal use), so a strong build can't melt a boss.
    const secs = { boss: 30, twins: 18, gate: 40, final: 70 }[cfg.kind] || 0;
    const floorHp = Math.round(G.Judgment.singleDps() * secs);
    if (floorHp > e.maxHp) e.maxHp = e.hp = floorHp;
    e.flying = false;                 // collides with the arena's walls and columns, like rift legendaries
    e.tower = cfg.kind;
    if (G.Spawner.rollShiny(dex)) e.makeShiny();
    const script = cfg.kind === 'twins' ? 'twins' : cfg.script;
    if (script) G.TowerBosses.setup(e, script);
    G.EnemyMgr.add(e);
    fl.bossIds.push(e.id);
    G.Camera.kick(1.1);
    G.Audio.sfx('boss');
    return e;
  }

  /** Host: everything left on the floor goes (no rewards). */
  function wipe() {
    for (const e of G.EnemyMgr.all()) if (G.Coop.isHost) G.Coop.enemyGone(e, false);
    G.EnemyMgr.clear();
    G.Hazards.clear();
  }

  // ---------------- every frame ----------------

  function update(dt) {
    if (!run || !fl) return;
    fl.t += dt;
    G.TowerBosses.tick(dt);                          // every computer: the wind pushes your own Pokémon
    const K = kindOf(fl.cfg);
    if (K && K.local && fl.phase === 'fight') K.local(fl, dt);       // storms, traps: your own Pokémon
    if (!authority()) {
      if (fl.phase === 'hub') G.TowerHub.tick(fl, dt, false);
      if (fl.phase === 'intro' && fl.t >= INTRO) { fl.phase = 'fight'; fl.t = 0; }    // (the host started it about now)
      return;
    }
    const cfg = fl.cfg, pl = G.Game.player;
    // Co-op: the floor (and whether it's cleared) every 2 s, for a guest who missed a message or started late.
    if (G.Coop.isHost && (syncT -= dt) <= 0) {
      syncT = 2;
      G.Coop.broadcast(['tw', 'fl', cfg, ['clear', 'cards', 'badges', 'next', 'won', 'over'].includes(fl.phase) ? 1 : 0]);
      if (fl.choices) G.Coop.broadcast(['tw', 'ch', fl.choices]);
    }
    switch (fl.phase) {
      case 'hub':
        if (G.TowerHub.tick(fl, dt, true)) { G.Spawner.say('Up the stairs…', 1.6); nextFloor(D().choices(run.floor + 1, coopFloors(), run.mode, true)[0]); }
        break;
      case 'intro':
        if (fl.t >= INTRO) fight();
        break;
      case 'fight': {
        if (!(K && K.map)) keepInside();
        if (K) {
          if (G.Coop.isHost && K.state && (netT -= dt) <= 0) { netT = 0.25; G.Coop.broadcast(['tw', 'st', K.state(fl)]); }
          if (K.tick(fl, dt)) clear();
        } else if (cfg.kind === 'horde' || cfg.kind === 'plates') {
          const k = pl.kills - fl.k0;
          if (k !== fl.kills || fl.lastKillT == null) fl.lastKillT = fl.t;
          fl.kills = k;
          // Nobody left to find: after 10 s without a knockout, those hiding (behind columns, keeping their
          // distance) come back into the fight.
          if (fl.t - fl.lastKillT > 10) { fl.lastKillT = fl.t; regroup(); }
          const ps = G.Game.everyone().length;
          const cap = Math.round((10 + cfg.n / 4) * (1 + 0.5 * (ps - 1)) * (cfg.kind === 'plates' ? 0.7 : 1));
          const alive = G.EnemyMgr.all().filter(e => !e.dead).length;
          const left = cfg.kind === 'horde' ? cfg.quota - fl.kills : Infinity;
          if ((fl.spawnT -= dt) <= 0 && alive < cap && alive < left) { fl.spawnT = 0.45; spawnWild(); }
          if (cfg.kind === 'plates') platesTick(dt);
          else if (fl.kills >= cfg.quota) { clear(); break; }
          if (G.Coop.isHost && (netT -= dt) <= 0) {
            netT = 0.25;
            if (cfg.kind === 'plates') G.Coop.broadcast(['tw', 'pp', Math.round(fl.prog * 100) / 100, fl.mask]);
            else if (fl.kills !== lastKills) { lastKills = fl.kills; G.Coop.broadcast(['tw', 'k', fl.kills]); }
          }
          if (cfg.kind === 'plates' && fl.prog >= 1) clear();
        } else {
          const bosses = fl.bossIds.map(id => G.EnemyMgr.get(id)).filter(e => e && !e.dead);
          if (!bosses.length) { clear(); break; }
          if (!fl.enraged && cfg.limit && fl.t > cfg.limit) {
            fl.enraged = true;
            for (const e of bosses) { e.dmg *= 1.5; e.spd *= 1.2; if (e.ai && !e.ai.fury) e.enrage(); }
            G.Spawner.say('Out of time: ' + bosses[0].name + ' is furious!', 3);
          }
        }
        break;
      }
      case 'clear':
        if (fl.t >= 1.6) {
          wipe();
          if (cfg.kind === 'final') { fl.phase = 'won'; fl.t = 0; break; }
          G.Game.grantLevels(1);                    // a level for everyone (co-op: the cards wait for the whole team)
          fl.phase = 'cards'; fl.t = 0;
        }
        break;
      case 'cards':
        if (G.Game.state === 'playing' && !G.Game.pendingLevels && fl.t > 0.3) {
          if (['boss', 'gate', 'twins'].includes(cfg.kind)) {
            fl.phase = 'badges'; fl.t = 0;
            badgeWait = new Set(G.Game.everyone().filter(p => p !== pl && p.uid).map(p => p.uid));
            if (G.Coop.isHost) G.Coop.broadcast(['tw', 'bdg']);
            openBadges(() => { fl && (fl.done.me = 1); });
          } else toStairs();
        }
        break;
      case 'badges':
        if ((fl.done.me && (!badgeWait || !badgeWait.size)) || fl.t > BADGE_WAIT) { toStairs(); G.TowerUI.closeBadges(); }
        break;
      case 'next': {
        if (fl.t < 0.8) break;                       // (a moment, so nobody steps on one by accident)
        const s = (fl.choices || []).find(c => G.Game.everyone().some(p => !p.dead && G.U.dist2(p.x, p.y, c.x, c.y - 10) < 30 * 30));
        if (s) { G.Spawner.say(G.TowerData.KINDS[s.kind] ? G.TowerData.KINDS[s.kind].name + '!' : 'Up the stairs…', 1.6); nextFloor(s.kind); }
        break;
      }
      case 'won':
        if (fl.t >= 4.5) { fl.phase = 'over'; G.Game.towerEnd(); }
        break;
    }
  }

  /**
   * Host / solo: the landing. One or two stairways appear just ahead of the player (two = a choice of floor kind,
   * TowerData.choices); walking into one goes up to that floor.
   */
  function toStairs() {
    fl.phase = 'next'; fl.t = 0;
    const n = run.floor + 1, kinds = D().choices(n, coopFloors(), run.mode);
    const pl = G.Game.player, c = pl.dead ? (G.Game.everyone().find(p => !p.dead) || pl) : pl;
    const offs = kinds.length > 1 ? [[-90, -110], [90, -110]] : [[0, -110]];
    const tries = [[0, 0], [0, 220], [0, 110], [-120, 0], [120, 0], [0, -60]];
    fl.choices = kinds.map((kind, i) => {
      for (const [ax, ay] of tries) {
        const x = c.x + offs[i][0] + ax, y = c.y + offs[i][1] + ay;
        if (G.World.isFree(x, y, 24)) return { kind, x: Math.round(x), y: Math.round(y) };
      }
      return { kind, x: Math.round(c.x + offs[i][0]), y: Math.round(c.y) };
    });
    if (G.Coop.isHost) G.Coop.broadcast(['tw', 'ch', fl.choices]);
    G.Audio.sfx('confirm');
    G.Spawner.say(kinds.length > 1 ? 'Choose your stairs' : 'The stairs are open', 2, true);
  }

  /** Nothing leaves the arena's circle (a strong knock-back, a leap). */
  function keepInside() {
    const ts = TS(), max = (fl.cfg.r - 1.4) * ts;
    for (const e of G.EnemyMgr.all()) {
      if (e.remote) continue;
      const dx = e.x - fl.x, dy = e.y - fl.y, d = Math.hypot(dx, dy);
      if (d > max) { e.x = fl.x + dx / d * max; e.y = fl.y + dy / d * max; }
    }
  }

  // ---- Seal Plates (Expedition event) ----
  const PLATE_R = 46;
  function platePos(i) { const ts = TS(), p = fl.cfg.plates[i]; return [fl.x + p[0] * fl.cfg.r * ts, fl.y + p[1] * fl.cfg.r * ts * 0.85]; }
  function platesTick(dt) {
    const ps = G.Game.everyone().filter(p => !p.dead);
    let mask = 0;
    fl.cfg.plates.forEach((_, i) => {
      const [x, y] = platePos(i);
      if (ps.some(p => G.U.dist2(p.x, p.y, x, y) < PLATE_R * PLATE_R)) mask |= 1 << i;
    });
    const all = mask === (1 << fl.cfg.plates.length) - 1;
    if (all && !(fl.mask === mask)) G.Audio.sfx('confirm');
    fl.mask = mask;
    fl.prog = G.U.clamp(fl.prog + (all ? dt / 9 : -dt / 30), 0, 1);
  }

  // ---------------- clearing a floor ----------------

  /** Host / solo: the floor is beaten. */
  function clear() {
    if (!fl || fl.phase !== 'fight') return;
    if (G.Coop.isHost) G.Coop.broadcast(['tw', 'clr', fl.cfg.n]);
    onClear(fl.cfg.n);
  }

  /** Every computer: rewards (each player into their own save) and the pause before the next floor. */
  function onClear(n) {
    if (!run || !fl || fl.cfg.n !== n || fl.phase === 'clear') return;
    const cfg = fl.cfg, pl = G.Game.player, s = G.DB.save, D_ = D();
    fl.phase = 'clear'; fl.t = 0;
    G.Pickups.pullAll();
    G.Audio.sfx(cfg.kind === 'horde' || cfg.kind === 'plates' ? 'levelup' : 'legend');
    // Battle Points (+1 with the Bounty Badge).
    const K = kindOf(cfg);
    let bp = (D_.BP[cfg.kind] || 0) + (pl.towerBp || 0) + (K && K.bonus ? K.bonus(fl) : 0);
    let t10 = 0, notes = [];
    if (s && s.tower) {
      const T = s.tower;
      if (!T.firsts[n]) {
        T.firsts[n] = Date.now();
        const f = D_.FIRST[cfg.kind];
        if (f) { bp += f.bp; t10 += f.t10; run.firsts.push(n); if (f.t10) notes.push('first clear: +' + f.t10 + ' ×10 ticket' + (f.t10 > 1 ? 's' : '')); }
      }
      if (run.mode === 'climb') {
        T.best = Math.max(T.best || 0, n);
        if (D_.isCheckpoint(n) && n > (T.cp || 0) && n < D_.FLOORS) { T.cp = n; run.cpNew = n; notes.push('checkpoint saved'); }
      } else T.bestX = Math.max(T.bestX || 0, n);
      T.bp = (T.bp || 0) + bp;
      if (t10) { s.tickets = s.tickets || { t1: 0, t10: 0 }; s.tickets.t10 += t10; }
      G.DB.commit('run');
    }
    run.bp += bp; run.t10 += t10; run.best = Math.max(run.best, n);
    // A breather: heal (Medic Badge: more) and a moment of safety.
    if (!pl.dead) pl.healItem(pl.towerHeal || 0.15);
    pl.invuln = Math.max(pl.invuln || 0, 3);
    if (cfg.kind === 'final') {
      run.won = true;
      G.Spawner.say('You conquered the Battle Tower!', 5, true);
      G.Game.flash('#fff3c8', 1.2);
    } else {
      G.Spawner.say(n + 'F cleared! +' + bp + ' BP' + (notes.length ? ' · ' + notes.join(' · ') : ''), 3.2, true);
    }
  }

  // ---------------- Badges ----------------

  /** The Badges you can be offered: everyone's free ones plus those unlocked with BP, minus those you hold. */
  function badgePool() {
    const s = G.DB.save, owned = (s && s.tower && s.tower.badges) || {};
    return D().BADGES.filter(b => (!b.cost || owned[b.id]) && !run.badges.includes(b.id));
  }

  function openBadges(done) {
    const list = G.U.pickN(badgePool(), 3);
    if (!list.length) { done(); return; }
    G.TowerUI.showBadges(list, b => {
      const pl = G.Game.player;
      run.badges.push(b.id);
      b.apply(pl);
      G.Audio.sfx('confirm');
      G.FX.ring(pl.x, pl.y, 8, 110, '#ffd23f', 0.7, 5);
      done();
    });
  }

  // ---------------- end of the run ----------------

  /** Called by endRun: what the summary shows. Clears the tower state. */
  function finish() {
    if (!run) return null;
    const r = { mode: run.mode, start: run.start, floor: run.floor, best: run.best, bp: run.bp, t10: run.t10, cp: run.cpNew, won: run.won,
                badges: run.badges.slice(), firsts: run.firsts.length };
    const s = G.DB.save;
    if (s && s.tower) { if (run.mode === 'climb') s.tower.best = Math.max(s.tower.best || 0, run.best); else s.tower.bestX = Math.max(s.tower.bestX || 0, run.best); }
    reset();
    G.World.setArena(null);
    G.Weather.clear();
    return r;
  }

  // ---------------- network ----------------

  /** Guests: events from the host. */
  function onEvent(ev) {
    switch (ev[1]) {
      case 'fl':
        // (Also the host's 2-second sync: only a new floor moves you; a cleared flag you missed gives the rewards.)
        if (!fl || fl.cfg.n !== ev[2].n) beginFloor(ev[2]);
        if (ev[3] && fl && fl.cfg.n === ev[2].n && fl.phase !== 'clear') onClear(ev[2].n);
        break;
      case 'k': if (fl) fl.kills = ev[2]; break;
      case 'pp': if (fl) { fl.prog = ev[2]; fl.mask = ev[3]; } break;
      case 'clr': onClear(ev[2]); break;
      case 'bdg': openBadges(() => G.Coop.toHost(['tw', 'bd'])); break;
      case 'sc': G.TowerBosses.onNet(ev); break;
      case 'st': { const K = fl && kindOf(fl.cfg); if (K && K.apply) K.apply(fl, ev[2]); break; }      // a floor kind's state
      case 'ch': if (fl) fl.choices = ev[2]; break;                                                       // the landing's stairways
    }
  }
  /** Host: events from a guest. */
  function onClient(from, ev) {
    if (ev[1] === 'bd' && badgeWait) badgeWait.delete(from);
  }
  /** Host: someone left: don't wait for their Badge. */
  function mateLeft(uid) { if (badgeWait) badgeWait.delete(uid); }

  // ---------------- drawing ----------------

  /** On the ground, under everyone: the Seal Plates. */
  function drawGround(ctx) {
    if (fl && fl.cfg.kind === 'hub') { G.TowerHub.drawGround(ctx, fl); return; }
    const K = fl && kindOf(fl.cfg);
    if (K) { if (K.drawGround) K.drawGround(ctx, fl); return; }
    if (!fl || fl.cfg.kind !== 'plates' || !fl.cfg.plates) return;
    const now = performance.now() / 1000;
    fl.cfg.plates.forEach((_, i) => {
      const [x, y] = platePos(i), on = fl.mask & (1 << i);
      ctx.save();
      ctx.globalAlpha = 0.28 + (on ? 0.35 : 0.12 * Math.sin(now * 3 + i));
      ctx.fillStyle = on ? '#ffe27a' : '#9f8cff';
      ctx.beginPath(); ctx.ellipse(x, y, PLATE_R, PLATE_R * 0.7, 0, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = on ? '#fff3c8' : '#c9b8ff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, y, PLATE_R, PLATE_R * 0.7, 0, 0, 6.2832); ctx.stroke();
      // Progress ring around the centre plate glow.
      ctx.lineWidth = 5; ctx.strokeStyle = '#ffd23f';
      ctx.beginPath(); ctx.ellipse(x, y, PLATE_R + 8, (PLATE_R + 8) * 0.7, 0, -Math.PI / 2, -Math.PI / 2 + 6.2832 * fl.prog); ctx.stroke();
      ctx.restore();
    });
  }

  /** What the HUD shows instead of the survival clock. */
  function hud() {
    if (!run || !fl) return null;
    if (fl.cfg.kind === 'hub') return G.TowerHub.hud(run);
    const cfg = fl.cfg, sec = D().SECTIONS[cfg.section], K = kindOf(cfg);
    let goal = '', col = '#ffffff';
    if (K && (fl.phase === 'intro' || fl.phase === 'fight')) ({ goal, col } = K.hud(fl));
    else if (fl.phase === 'intro') goal = cfg.kind === 'horde' ? 'DEFEAT ' + cfg.quota + ' POKÉMON' : cfg.kind === 'plates' ? 'SEAL PLATES: HOLD EVERY PLATE AT ONCE' : cfg.kind === 'twins' ? 'TWIN BOND: DEFEAT BOTH TOGETHER' : 'BOSS FLOOR';
    else if (fl.phase === 'fight') {
      if (cfg.kind === 'horde') goal = 'DEFEATED ' + Math.min(cfg.quota, fl.kills) + ' / ' + cfg.quota;
      else if (cfg.kind === 'plates') { goal = 'SEAL ' + Math.round(fl.prog * 100) + '% · PLATES ' + bits(fl.mask) + ' / ' + cfg.plates.length; col = '#ffe27a'; }
      else if (cfg.limit) {
        const left = cfg.limit - fl.t;
        goal = left > 0 ? 'ENRAGE IN ' + G.U.mmss(left) : 'ENRAGED'; col = left > 20 ? '#ffffff' : '#ff6b6b';
      }
    } else if (fl.phase === 'clear' || fl.phase === 'cards') { goal = 'FLOOR CLEARED'; col = '#8fffb0'; }
    else if (fl.phase === 'badges') { goal = 'PICKING BADGES'; col = '#ffe27a'; }
    if (fl.choices && fl.phase !== 'fight') { goal = fl.choices.length > 1 ? 'CHOOSE YOUR STAIRS' : 'TAKE THE STAIRS'; col = '#8fe3ff'; }
    else if (fl.phase === 'won' || fl.phase === 'over') { goal = 'THE BATTLE TOWER IS YOURS'; col = '#ffe27a'; }
    return { big: cfg.n + 'F', place: (cfg.kind === 'final' ? 'THE SUMMIT' : sec.name.toUpperCase()), mode: run.mode === 'exp' ? 'EXPEDITION' : 'CLIMB', goal, col, bp: run.bp };
  }
  const bits = m => { let c = 0; while (m) { c += m & 1; m >>= 1; } return c; };

  /** Music for the floor. */
  function music() {
    if (!fl) return null;
    const k = fl.cfg.kind;
    if (k === 'hub') return 'village';
    if (k === 'gate' || k === 'final') return 'rift';
    if (k === 'boss' || k === 'twins') return 'boss';
    return G.BIOME_MUSIC[fl.cfg.section % G.BIOME_MUSIC.length];
  }

  return {
    reset, start, update, finish, onEvent, onClient, mateLeft, drawGround, hud, music,
    /** Things drawn sorted by Y with everyone (the hall's statues and doors, a floor's objects, the stairways). */
    drawables() {
      if (!fl) return [];
      if (fl.cfg.kind === 'hub') return G.TowerHub.drawables(fl);
      const K = kindOf(fl.cfg), out = K && K.drawables ? K.drawables(fl) : [];
      return fl.choices ? out.concat(G.TowerFloors.stairsDrawables(fl.choices)) : out;
    },
    /** Screen space, over the scene (the Mystery Dungeon's darkness). */
    drawOverlay(ctx, w, h) { const K = fl && kindOf(fl.cfg); if (K && K.drawOverlay && fl.phase !== 'hub') K.drawOverlay(ctx, w, h, fl); },
    spawnWild, regroup, themedBag,
    get active() { return !!run; },
    get run() { return run; },
    get floor() { return fl; },
    /** Tests (?dev): jump to floor n of this run (the host / solo). */
    debugFloor(n, kind) { if (!run || !authority()) return; run.floor = Math.max(0, Math.min(D().FLOORS, n) - 1); wipe(); nextFloor(kind); },
    /** Tests: event floors (Seal Plates, Twin Bond) even on your own. */
    debugEvents(on = true) { forceEvents = !!on; },
    /** Tests: clear the current floor now. */
    debugClear() { if (fl && fl.phase === 'fight' && authority()) clear(); }
  };
})();
