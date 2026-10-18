/* ============ rift.js — grietas y arena del legendario ============
 *
 * De vez en cuando (pocas veces por partida) se abre una GRIETA cerca de un
 * jugador. Dura GRIETA_TTL segundos; si entras, te lleva (con todo el grupo)
 * a una arena cerrada en el Mundo Distorsión, contra un Pokémon LEGENDARIO.
 *
 *   ganas    el legendario suelta tickets (el ×10, la mitad de las veces) y monedas, y cada uno se lleva un
 *            VÍNCULO (fusiona movimientos, ver Player.fuse); a los pocos
 *            segundos volvéis al mapa donde estabais y se elige la fusión
 *   pierdes  (caéis todos o se acaba el tiempo) volvéis sin premio, con algo
 *            de vida; la partida sigue
 *
 * Mientras dura la arena, los enemigos del mapa se guardan (EnemyMgr.stash) y
 * no aparecen nuevos; al volver todo sigue como estaba.
 *
 * Cooperativo: lo decide el anfitrión. Mensajes (ver coop.js):
 *   'rift' x y ttl · 'riftx' · 'arena' cfg · 'aw' (ganada) · 'al' (perdida)
 *   'zm' (Portal de Zygarde: empieza la transformación en Mega Zygarde)
 *   y del invitado al anfitrión 're' (he entrado en la grieta).
 */
G.Rift = (() => {
  // (0.14 hasta el 11-10-2026: más grietas para que se vean los vínculos)
  // Menos azar (12-10-2026): cada vez que no sale, la siguiente es más
  // probable (20 %, 40 %, 60 %, 80 %, 100 %): como mucho 2,5 min sin grieta.
  // Desde 2 min antes de la Sentencia de Arceus (minuto 30) ya no se abren.
  const CHECK = 30, CHANCE = 0.2, TTL = 45;
  const ARENA_R = 11, ARENA_TIME = 120, FROM = 75;
  const MEGA_DEX = 9718;    // Mega Zygarde sprite (assets/pokemon/9718, tools/fetch_zygarde_mega.py)
  const MEGA_SWAP = 1.6, MEGA_TIME = 3.2;   // seconds: sprite/arena change · untouchable
  // Zygarde Portal: health = this many seconds of your team's measured single-target damage (see spawnLegend).
  // The measurement is a peak (best seconds), and Mega Zygarde heals back to 65% at half health, so the real fight
  // lasts well over this; 45 s leaves room inside ZY_TIME.
  const ZY_DPS_SECONDS = 45;
  const ZY_TIME = 180;      // Zygarde Portal fight: more time, much tougher boss
  const arenaTime = () => (arena && arena.hard ? ZY_TIME : ARENA_TIME);
  let rift = null;          // { x, y, ttl, t }
  const EXIT_SAFE = 3;      // segundos de inmunidad al salir de la grieta
  let arena = null;         // { tx, ty, r, dex, shiny, x, y, back, biome, t, phase, endT, bossId }
  let checkT = CHECK, asked = false, downT = 0, misses = 0;
  const authority = () => !G.Coop.active || G.Coop.isHost;
  const TS = () => G.Tiles.T * G.Sprites.PX;

  function reset() { rift = null; arena = null; checkT = CHECK; asked = false; downT = 0; misses = 0; }

  // ---------------- grieta en el mapa ----------------

  function update(dt, pl, time) {
    if (rift) {
      rift.t += dt;
      rift.ttl -= dt;
      if (rift.ttl <= 0) { rift = null; return; }
      if (!arena && !pl.dead && G.U.dist2(pl.x, pl.y, rift.x, rift.y - 10) < 30 * 30) enter();
    } else if (!arena && authority() && time > FROM && time < G.Judgment.AT - 120) {
      checkT -= dt;
      if (checkT <= 0) {
        checkT = CHECK;
        if (G.EnemyMgr.bossAlive()) return;           // con un jefe vivo no cuenta como intento
        if (Math.random() < CHANCE * (1 + misses)) { misses = 0; open(); }
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

  /** Aparece la grieta (también la que manda el anfitrión). */
  function show(x, y, ttl) {
    rift = { x, y, ttl, t: 0 };
    asked = false;
    // (El aviso grande lo dibuja hud.js mientras rift.t < 4,5 s.)
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

  /** Quien manda: elige legendario y lugar, y avisa a todos. */
  let nextType = null;          // pruebas/vídeos: tipo de la próxima arena

  function start(forceType, zy) {
    if (arena) return;
    forceType = forceType || nextType; nextType = null;
    let pool = G.DEX.filter(p => p.leg && G.SPRITE_META[p.dex]);
    if (forceType && pool.some(p => p.types.includes(forceType))) pool = pool.filter(p => p.types.includes(forceType));
    // Los legendarios que aún no has vencido salen 4 veces más (menos repetidos).
    const beaten = (G.DB.save && G.DB.save.legends) || {};
    const ws = pool.map(p => (beaten[p.dex] ? 1 : 4));
    let r = Math.random() * ws.reduce((a, b) => a + b, 0), mi = 0;
    while (mi < pool.length - 1 && (r -= ws[mi]) > 0) mi++;
    const mon = zy ? G.DEX_BY[718] : pool[mi];
    const here = zy || rift || G.Game.player;      // la salida: donde estaba la grieta (igual para todos)
    const cfg = {
      bx: Math.round(here.x), by: Math.round(here.y),
      tx: 5000 + Math.floor(Math.random() * 3000), ty: 5000 + Math.floor(Math.random() * 3000), r: ARENA_R,
      dex: mon.dex, shiny: G.Sprites.hasShiny(mon.dex) && Math.random() < 1 / 512,
      // La arena es la de uno de sus tipos, al azar.
      type: zy ? 'zygarde' : (forceType || G.U.pick(mon.types))
    };
    if (zy) { cfg.hard = 1; cfg.zy = 1; cfg.btype = G.U.pick(mon.types); }     // btype: counts as a rift of that type for goals
    if (G.Coop.isHost) G.Coop.broadcast(['arena', cfg]);
    begin(cfg);
    spawnLegend();
  }

  /** En cada ordenador: viaje a la arena. */
  function begin(cfg) {
    const pl = G.Game.player;
    const ts = TS();
    if (cfg.zy) G.Sprites.preload([MEGA_DEX], 8000, !!cfg.shiny);       // Mega Zygarde's sheets, ready before the change
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
    // Cada arena trae su clima (el volcán, sol; el glaciar, nieve...).
    const th = G.Tiles.ARENA_THEMES[cfg.type];
    if (th && th.weather) G.Weather.force(th.weather, ZY_TIME + 15);
    // (La salida es el sitio donde estaba la grieta, el mismo para todos.)
    // Todos al sur de la arena, en fila; el legendario aparece al norte.
    const ps = G.Game.everyone();
    ps.forEach((p, i) => { p.x = arena.x + (i - (ps.length - 1) / 2) * 34; p.y = arena.y + ts * 3; });
    G.Camera.x = pl.x; G.Camera.y = pl.y;
    G.Game.flash('#c9a6ff', 0.9);
    G.Audio.sfx('rift');
    G.Spawner.say('Has entrado en la grieta…', 2.4, true);
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
    if (hard) hp = Math.max(hp, Math.round(G.Judgment.singleDps() * ZY_DPS_SECONDS));
    const def = {
      dex: mon.dex, name: mon.name,
      hp,
      spd: Math.round(G.U.clamp(48 + (mon.spd - 78) * 0.6, 48, 105) * (hard ? 1.15 : 1)),
      dmg: Math.round((36 + t / 20) * (hard ? 1.35 : 1)), xp: Math.round((500 + t * 1.2) * (hard ? 2 : 1)),
      behavior: mon.types.some(x => ['psychic', 'electric', 'ghost', 'fairy', 'fire', 'water', 'ice', 'dragon'].includes(x)) ? 'ranged' : 'charger',
      shotDmg: Math.round((18 + t / 40) * (hard ? 1.35 : 1)), shotCd: hard ? 0.65 : 0.9, range: hard ? 340 : 300
    };
    const e = new G.Enemy(def, arena.x, arena.y - ts * 3.5, { hp: 1, spd: 1, dmg: 1 }, true);
    e.legend = true;
    e.hard = hard;
    // Choca con las paredes y columnas como tú: si volara por encima de las
    // rocas, tus disparos no podrían alcanzarle (bug de Celebi).
    e.flying = false;
    if (arena.shiny) e.makeShiny();
    G.EnemyMgr.add(e);
    arena.bossId = e.id;
    G.Spawner.say(hard ? (e.shiny ? 'A shiny ' : '') + e.name + ' guards the portal!' : '¡' + e.name + (e.shiny ? ' shiny' : '') + ' te esperaba en la grieta!', 3.2);
    G.Camera.kick(1.1);
    G.Audio.sfx('boss');
  }

  /** Nadie sale del círculo de la arena (por si algo empuja demasiado). */
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
      if (arena.zy && arena.mega) megaAdvance(dt);          // every machine runs its own copy of the transformation
      if (!authority()) return;
      keepInside();
      const boss = G.EnemyMgr.get(arena.bossId);
      if (arena.zy && boss && !boss.dead && !arena.mega && boss.hp <= boss.maxHp * 0.5) {
        if (G.Coop.isHost) G.Coop.broadcast(['zm']);
        startMega();
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
      if (arena.zy && arena.phase === 'lost') { arena.endT = 999; G.Game.failRun(); }
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
    if (!arena || !arena.zy || arena.mega) return;
    arena.mega = 1; arena.megaT = 0;
    G.Spawner.say('Zygarde is changing form!', 3, true);
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

  function won() {
    if (!arena || arena.phase !== 'fight') return;
    arena.phase = 'won'; arena.endT = 5;
    G.Progress.event('rift', { type: arena.btype || arena.type });
    G.Pickups.pullAll();
    G.Spawner.say('¡Has vencido a ' + G.DEX_BY[arena.dex].name + '! Recoge el premio…', 3.4, true);
    G.Audio.sfx('legend');
    const pl = G.Game.player;
    if (pl && !arena.zy) {          // the Zygarde Portal gives no Bond (its reward is the extra loot)
      pl.bonds++;
      G.FX.dmgText(pl.x, pl.y - pl.bodyH - 10, '¡Vínculo!', '#ff8ad8', true);
      G.FX.ring(pl.x, pl.y, 8, 90, '#ff8ad8', 0.7, 5);
    }
  }

  function lost() {
    if (!arena || arena.phase !== 'fight') return;
    arena.phase = 'lost'; arena.endT = 1.2;
    G.Spawner.say(arena.zy ? 'Zygarde has ended your run…' : 'La grieta os ha expulsado…', 2.6, true);
    G.Audio.sfx('back');
  }

  /** En cada ordenador: vuelta al mapa. */
  function finish() {
    const pl = G.Game.player;
    const a = arena;
    arena = null;
    G.World.setBiome(a.biome, true);
    G.Weather.clear();
    // Invitado: no se borra nada. El anfitrión avisa de los de la arena que se
    // van y de los del mapa que vuelven; si el invitado terminaba su cuenta
    // atrás un poco más tarde (pasa casi siempre), borraba los que acababan de
    // volver y no se veían hasta que caían (sólo sus ataques).
    if (authority()) G.EnemyMgr.restore();
    G.Projectiles.clear();
    G.Combat.clearFields();
    G.Hazards.clear();
    for (const p of G.Game.everyone()) { p.x = a.back.x; p.y = a.back.y; }
    pl.x = a.back.x; pl.y = a.back.y;
    if (pl.dead) pl.revive(0.3);
    // Unos segundos sin poder recibir daño al salir (los enemigos vuelven de golpe).
    for (const p of G.Game.everyone()) p.invuln = Math.max(p.invuln || 0, EXIT_SAFE);
    pl.invuln = Math.max(pl.invuln || 0, EXIT_SAFE);
    G.Camera.x = pl.x; G.Camera.y = pl.y;
    G.Game.flash('#c9a6ff', 0.8);
    if (pl.bonds > 0) G.Game.offerBond();
  }

  // ---------------- dibujo ----------------

  /** La grieta, para ordenarla por Y con el resto de la escena. */
  /** Zygarde arena: glowing rings, light under each monolith, the portal you came through, and the transformation effects. */
  function zyDraw(ctx) {
    const ts = TS(), t = arena.t, mega = !!arena.megaDone;
    ctx.save();
    ctx.strokeStyle = mega ? '#c27bff' : '#4dff9a';
    ctx.lineWidth = 5; ctx.globalAlpha = 0.20 + 0.10 * Math.sin(t * 2);
    ctx.beginPath(); ctx.arc(arena.x, arena.y, 7.5 * ts, 0, 6.2832); ctx.stroke();
    ctx.lineWidth = 3; ctx.globalAlpha = 0.16 + 0.08 * Math.sin(t * 2 + 1.5);
    ctx.beginPath(); ctx.arc(arena.x, arena.y, 3.4 * ts, 0, 6.2832); ctx.stroke();
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 6 + k * Math.PI / 3;
      const mx = arena.x + (Math.round(Math.cos(a) * 7.5) + 0.5) * ts, my = arena.y + (Math.round(Math.sin(a) * 7.5) + 0.5) * ts;
      const g = ctx.createRadialGradient(mx, my, 4, mx, my, 70);
      g.addColorStop(0, mega ? 'rgba(194,123,255,0.55)' : 'rgba(77,255,154,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 2.2 + k); ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(mx, my, 70, 0, 6.2832); ctx.fill();
    }
    // The portal you came through, at the south edge.
    const img = G.Tiles.propSprite(0, 'zportal', 0), P = G.Sprites.PX, w = img.width * P / 2, h = img.height * P / 2, py = arena.y + 5.7 * ts;   // (arena exit keeps the old 64-unit size)
    ctx.globalAlpha = 0.9;
    ctx.drawImage(img, Math.round(arena.x - w / 2), Math.round(py - h / 2), w, h);
    ctx.restore();

    // Transformation: rings, glow and light rays around the boss.
    const boss = arena.mega && arena.megaT < MEGA_TIME ? zyBoss() : null;
    if (!boss) return;
    const mt = arena.megaT, x = boss.x, y = boss.y - boss.bodyH * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const p = (mt * 0.9 + i / 3) % 1;
      ctx.globalAlpha = (1 - p) * 0.7; ctx.strokeStyle = mt < MEGA_SWAP ? '#7dffb0' : '#d9a6ff'; ctx.lineWidth = 6 * (1 - p) + 1;
      ctx.beginPath(); ctx.arc(x, y, 30 + p * 230, 0, 6.2832); ctx.stroke();
    }
    const peak = Math.max(0, 1 - Math.abs(mt - MEGA_SWAP) / MEGA_SWAP);
    const g = ctx.createRadialGradient(x, y, 10, x, y, 150);
    g.addColorStop(0, mt < MEGA_SWAP ? 'rgba(160,255,200,0.9)' : 'rgba(215,170,255,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
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
    if (arena && arena.zy) return { y: arena.mega && arena.megaT < MEGA_TIME ? arena.y + 9999 : arena.y - 9999, draw: zyDraw };
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
      case 'aw': won(); break;
      case 'al': lost(); break;
    }
  }

  return {
    reset, update, drawable, onEvent, enterRequest() { if (!arena) start(); },
    /** Can a Zygarde Portal be used right now? (not in a fight, not near Arceus' Judgment) */
    canZygarde() { return !arena && G.Game.st.time < G.Judgment.AT - 120; },
    /** Host/solo: a player stepped on the portal at tile (tx,ty), world (x,y). */
    startZygarde(tx, ty, x, y) {
      if (arena || !authority() || G.World.altarUsed(tx, ty) || !this.canZygarde()) return;
      G.World.markUsed(tx, ty);
      if (G.Coop.isHost) G.Coop.broadcast(['gu', tx, ty]);
      start(null, { x, y });
    },
    get rift() { return rift; }, get arena() { return arena; },
    get inArena() { return !!arena; },
    get timeLeft() { return arena ? Math.max(0, arenaTime() - arena.t) : 0; },
    debugOpen() { open(); },
    /** Tests: the Zygarde Portal fight right now, as if you had stepped on a portal where you stand. */
    debugZygarde() { const p = G.Game.player; start(null, { x: p.x, y: p.y }); },
    /** Para pruebas: arena de un tipo ya. */
    debugArena(type) { start(type); },
    /** Para vídeos: la próxima grieta en la que entres será de este tipo. */
    debugNextType(type) { nextType = type; }
  };
})();
