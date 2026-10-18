/* ============ game.js — flujo del juego y bucle principal ============
 *
 *   login ──> test de personalidad ──> menú ──> run ──> resumen ──> menú
 *                (sólo la 1ª vez)          │
 *                                          ├─ Pokémon (colección)
 *                                          ├─ Mejoras
 *                                          └─ Gacha
 *
 * Estados del bucle: 'ui' (menús, con el mundo de fondo), 'playing',
 * 'levelup', 'paused', 'over'.
 *
 * Cooperativo (G.Coop.active): el anfitrión lleva enemigos, objetos y
 * experiencia; cada uno su Pokémon. La pausa no para el juego, las cartas de
 * nivel esperan a que elijan todos y un compañero caído se levanta si otro
 * se queda a su lado. Ver net/coop.js.
 */
G.Game = (() => {
  let cv, ctx, dpr = 1, w = 0, h = 0;
  let state = 'ui';
  let time = 0, last = 0, pendingLevels = 0;
  let pl = null;
  let caught = [];          // shinies conseguidos en esta run
  let biome = -1;

  const st = { get time() { return time; } };

  // ---------------- arranque ----------------

  function init() {
    cv = document.getElementById('game');
    ctx = cv.getContext('2d');
    resize();
    addEventListener('resize', resize);
    G.Touch.init(cv);
    // En móvil: al cambiar de app o girarlo en vertical, la partida se pausa.
    document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
    G.RunUI.wirePause(() => { state = 'playing'; G.UI.hideAll(); }, quitRun);
    Backdrop.init();
    last = performance.now();
    requestAnimationFrame(loop);
  }

  function resize() {
    // Resolución interna como mucho ×1,5: en pantallas ×2 dibujar el doble de
    // píxeles era de lo que más costaba, y con el pixel art no se nota.
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    w = cv.clientWidth; h = cv.clientHeight;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    G.Camera.resize(w, h, dpr);
    checkOrientation();
  }

  /** Móvil en vertical: aviso de girarlo (y pausa). */
  function checkOrientation() {
    const portrait = G.Touch.active && innerHeight > innerWidth;
    const el = document.getElementById('rotate');
    if (!el) return;
    if (portrait && !document.getElementById('rotate-ico').innerHTML) document.getElementById('rotate-ico').innerHTML = G.Icons.html('phone', 48);
    el.classList.toggle('hidden', !portrait);
    if (portrait) autoPause();
  }

  /** Pausa sola (sólo en solitario: en grupo los demás siguen). */
  function autoPause() {
    G.Touch.reset();
    if (state === 'playing' && !G.Coop.active) { state = 'paused'; G.RunUI.showPause(); }
  }

  /** Pausa/continúa (tecla Esc o P, o el botón de pausa del móvil). */
  let holdBy = [];                   // grupo: quién está eligiendo fusión (todo parado)

  function togglePause() {
    // En grupo la pausa no para el juego (los demás siguen jugando).
    if (G.Coop.active) {
      if (state !== 'playing') return;
      if (G.UI.isOpen('scr-pause')) G.UI.hide('scr-pause');
      else { G.RunUI.showPause(true); G.Audio.sfx('pause'); }
      return;
    }
    if (state === 'playing') { state = 'paused'; G.RunUI.showPause(); G.Audio.sfx('pause'); }
    else if (state === 'paused') { state = 'playing'; G.UI.hideAll(); }
  }

  // ---------------- run ----------------

  /** @param coop  { seed, host, members } para una partida en grupo */
  function startRun(coop = null) {
    holdBy = []; awayBy = null;
    const save = G.DB.save;
    const mon = G.DEX_BY[save.partner];
    const perks = G.Upgrades.perks(G.DB.upgradesOf(mon.dex));

    G.UI.hideAll();
    G.UI.chrome(false);
    G.FX.clear();
    G.Projectiles.clear();
    G.Combat.clearFields();
    G.EnemyMgr.clear();
    G.Pickups.clear();
    G.Spawner.reset();
    G.Rift.reset();
    G.Judgment.reset();
    G.Events.reset();
    G.Weather.reset();
    G.Path.clear();
    G.Hazards.clear();
    G.World.reset(coop ? coop.seed : Math.floor(Math.random() * 1e6));
    G.World.setBiome(0, true);
    biome = 0;
    time = 0; pendingLevels = 0;
    runReal = performance.now(); tampered = false;

    pl = new G.Player(mon, perks, !!save.partnerShiny && G.DB.ownsShiny(mon.dex));
    banked = { t1: 0, t10: 0 };
    caught = [];
    // Atajos: movimientos con hueco fijo (save.pbind[dex] = [id del 1, id del 2, ...]),
    // antes de aprender nada: addMove ya los coloca.
    (save.pbind && save.pbind[mon.dex] || []).forEach((id, i) => { if (id) pl.bind[id] = i; });
    pl.addMove(G.startMoveOf(mon.dex));
    // Mejora "Veto": movimientos que no quieres que te salgan.
    pl.banned = new Set((save.pban && save.pban[mon.dex] || []).slice(0, perks.bans));
    // Mejora "Repertorio": un segundo movimiento de ataque al azar.
    if (perks.startMoves >= 2) {
      const pool = G.Moves.poolFor(mon).filter(id => !pl.hasMove(id) && !pl.banned.has(id) && G.Moves.BY_ID[id].kind !== 'buff');
      if (pool.length) pl.addMove(G.U.pick(pool));
      pl.setActive(0);
    }

    teamStats.clear();
    if (coop) {
      hookStats();
      G.Coop.begin(coop, pl, coopApi);
      G.Social.setPlaying(true);
    }
    G.Camera.x = pl.x; G.Camera.y = pl.y; G.Camera.shake = 0;
    // Hojas de sprites locales: el compañero y los primeros enemigos.
    G.Sprites.preload([mon.dex], 8000, pl.shiny);
    G.Audio.music(G.BIOME_MUSIC[0]);
    // Para el ranking: el servidor apunta cuándo empieza la partida (anti-trampas).
    if (!coop || G.Coop.isHost) G.Ranking.runStarted(coop ? 'g' : 's');
    deathT = 0;

    state = 'playing';
  }

  function quitRun() {
    if (G.Coop.active) G.Coop.leave();
    endRun(false);
  }

  /** Todos los jugadores de la partida (tú primero). */
  function everyone() { return G.Coop.active ? G.Coop.players() : [pl]; }

  /** Experiencia que hace falta para el siguiente nivel (cofres con candado). */
  function levelXp() {
    if (!pl) return 20;
    const k = (G.Coop.active ? G.Coop.xpFactor() : 1) * (pl.xpMul || 1);
    return Math.ceil((pl.xpNext - pl.xp + 1) / k);
  }

  // Destello de pantalla completa (viaje a la grieta).
  let flashT = 0, flashDur = 1, flashCol = '#fff';
  function flash(col, dur) { flashCol = col; flashDur = dur; flashT = dur; }

  function teamState() {
    return { time, level: pl.level, xp: pl.xp, xpNext: pl.xpNext, kills: pl.kills, bosses: pl.bosses, coins: pl.coins, t1: pl.t1, t10: pl.t10 };
  }
  // ---- end-of-run stats: everyone sends theirs (via the host) so all see the whole team ----
  const teamStats = new Map();            // uid -> stats of each player in the run
  let statsHooked = false;
  function myStats() {
    const me = G.Social.me;
    return { u: pl.uid || 'me', n: (me && me.name) || 'You', dex: pl.dex, sh: pl.shiny ? 1 : 0,
             d: Math.round(pl.dmgDealt), t: Math.round(pl.dmgTaken), b: Math.round(pl.bigHit),
             dn: pl.downs, sr: pl.shrines, rb: pl.revivedBy.slice() };
  }
  function hookStats() {
    if (statsHooked) return;
    statsHooked = true;
    G.Net.on((from, msg) => {
      if (!msg || msg.k !== 'rs' || !msg.s) return;
      // The host relays everyone's stats, so on a guest `from` is the host: the real owner travels in `s.u`.
      // (On the host, never trust s.u: the sender is `from`.)
      const owner = G.Net.isHost ? from : (msg.s.u || from);
      teamStats.set(owner, Object.assign({}, msg.s, { u: owner }));
      if (G.Net.isHost) G.Net.broadcast({ k: 'rs', s: Object.assign({}, msg.s, { u: from }) }, from);
      if (state === 'over' && G.RunUI.refreshTeam) G.RunUI.refreshTeam();
    });
  }
  function shareStats(s) {
    teamStats.set(s.u, s);
    if (G.Net.isHost) G.Net.broadcast({ k: 'rs', s }); else G.Net.toHost({ k: 'rs', s });
  }

  function summary() { return { t: time, ki: pl.kills, bo: pl.bosses, co: pl.coins, lv: pl.level, t1: pl.t1, t10: pl.t10 }; }

  /** Lo que el cooperativo necesita del juego. */
  /**
   * Los tickets recogidos se guardan en cuanto los coges (como los shinies):
   * antes sólo al acabar, y si la pestaña se cerraba de golpe se perdían.
   * `banked` = los de esta partida que ya están en la partida guardada.
   */
  let banked = { t1: 0, t10: 0 };
  function bankTickets(save_ = true) {
    const sv = G.DB.save;
    if (!sv || !pl) return;
    sv.tickets = sv.tickets || { t1: 0, t10: 0 };
    const d1 = Math.max(0, pl.t1 - banked.t1), d10 = Math.max(0, pl.t10 - banked.t10);
    if (!d1 && !d10) return;
    sv.tickets.t1 += d1; sv.tickets.t10 += d10;
    banked = { t1: pl.t1, t10: pl.t10 };
    if (save_) G.DB.commit('run');
  }

  const coopApi = {
    team: teamState,
    summary,
    // Invitado: el anfitrión manda el reloj y lo del equipo.
    syncTeam(t) {
      if (Math.abs(t.time - time) > 0.4) time = t.time;
      if (t.level > pl.level) G.Audio.sfx('xp');
      pl.level = t.level; pl.xp = t.xp; pl.xpNext = t.xpNext;
      pl.kills = t.kills; pl.bosses = t.bosses; pl.coins = t.coins;
      if (t.t1 > pl.t1 || t.t10 > pl.t10) G.Audio.sfx('shiny');
      pl.t1 = t.t1 || 0; pl.t10 = t.t10 || 0;
      bankTickets();
    },
    levelStart(level) {
      // (Si tenías abierta la elección de objeto, vuelve al terminar: afterLevelUp.)
      if (state === 'choice' && openItem && G.Coop.active) G.Coop.holdEnd();
      state = 'levelup';
      G.UI.hide('scr-pause');
      G.Audio.sfx('levelup');
      G.RunUI.showLevelUp(level, G.LevelUp.offer(pl), card => {
        G.Audio.sfx('confirm');
        card.apply(pl);
        G.Coop.localPicked();
      }, true);
    },
    waiting(names) { G.RunUI.setWaiting(names); },
    resume() {
      G.RunUI.closeLevelUp();
      if (state === 'levelup') { state = holdBy.length ? 'held' : 'playing'; afterLevelUp(); }
    },
    /** ¿Estás eligiendo algo que para la partida (objeto o vínculo)? */
    choosing() { return state === 'choice'; },
    inLevelUp() { return state === 'levelup'; },
    shiny(dex) { G.onShinyCaught({ dex, name: (G.DEX_BY[dex] || {}).name || '' }); },
    over(d) {
      if (d) Object.assign(pl, { kills: d.ki, bosses: d.bo, coins: d.co, level: Math.max(pl.level, d.lv || 1), t1: d.t1 || pl.t1, t10: d.t10 || pl.t10 });
      if (d && d.t) time = d.t;
      if (d && d.why === 'host') G.UI.toast('El anfitrión ha terminado la partida', 3200);
      endRun(!(d && d.why === 'host'));
    },
    lost(msg) { G.UI.toast(msg, 3600); endRun(false); },
    item(id) { offerItem(id); },
    /** Aegislash event: everyone rolls their own 3 items to choose from (or skip). */
    armoury() { if (pl) offerItem(G.Items.rollMany(3, pl.item)); },       // downed players pick too (they keep it if revived)
    mateLeft() {},
    /** Grupo: quién está eligiendo fusión. Mientras haya alguien, todo parado. */
    hold(names) {
      holdBy = names || [];
      const mine = G.UI.isOpen('scr-bond');
      if (holdBy.length) {
        if (state === 'playing') state = 'held';
        if (pl && pl.bonds > 0) offerBond(true);      // si tú también tienes vínculo, eliges a la vez
        // Quién está eligiendo lo enseña ahora el cartel fijo del HUD (waitingChoosers);
        // aquí sólo se quita un aviso viejo (o se deja el de "esperando al anfitrión").
        G.Spawner.say(awayBy ? awayText() : '', awayBy ? 999 : 0, true);
      } else {
        if (state === 'held' && !awayBy) state = 'playing';
        G.Spawner.say(awayBy ? awayText() : '', awayBy ? 999 : 0, true);
      }
    },
    /** Grupo (invitado): el anfitrión se ha ido de la pestaña o no responde: todo parado. */
    away(name) {
      awayBy = name || null;
      if (awayBy) {
        if (state === 'playing') state = 'held';
        G.Spawner.say(awayText(), 999, true);
      } else if (!holdBy.length) {
        if (state === 'held') state = 'playing';
        G.Spawner.say('', 0, true);
      }
    }
  };
  let awayBy = null;
  const awayText = () => 'Pausa: esperando a ' + awayBy + ' (anfitrión)…';

  /** Has llevado a casa a un Pokémon perdido y se une a ti (events.js). */
  G.onRescue = (dex, name) => {
    if (!G.DB.save || !pl) return;
    const isNew = !G.DB.owns(dex);
    if (isNew) { G.DB.grant(dex, 'rescue'); G.DB.commit(true); }
    else pl.coins += 150;
    G.Spawner.say(isNew ? '¡' + name + ' se une a tu equipo!' : '¡' + name + ' te da las gracias! (+150 monedas, ya lo tenías)', 4);
    G.Audio.sfx('shinyGet');
  };

  /** Un shiny salvaje cae: te lo quedas (y la versión normal si no la tenías). */
  G.onShinyCaught = e => {
    if (!G.DB.save || !pl) return;
    if (G.Coop.isHost) G.Coop.shinyCaught(e);
    const isNew = G.DB.grantShiny(e.dex, 'wild');
    G.DB.save.stats.shinies++;
    G.DB.commit(true);
    caught.push({ dex: e.dex, isNew });
    G.Spawner.say(isNew ? '¡Has conseguido a ' + e.name + ' shiny!' : '¡Otro ' + e.name + ' shiny! (+300 monedas)', 4);
    if (!isNew) pl.coins += 300;
    G.Audio.sfx('shinyGet');
  };

  function endRun(dead = true) {
    if (state === 'over' || !pl) return;
    const coop = !!pl.uid;                    // sólo las partidas en grupo le ponen uid
    const wasHost = !!pl.coopHost;
    const mine = myStats();
    if (coop) shareStats(mine); else teamStats.clear();
    const team = coop ? G.Coop.members.slice() : [];
    if (G.Coop.active) G.Coop.end();
    if (coop) G.Social.setPlaying(false);
    state = 'over';
    G.Audio.music(null);
    G.Audio.sfx(dead ? 'gameover' : 'back');
    const save = G.DB.save;
    const mul = pl.coinMul;
    const parts = {
      tiempo: Math.floor(time / 5),
      derrotados: Math.floor(pl.kills * 0.25),
      jefes: pl.bosses * 80,
      recogidas: pl.coins
    };
    const coins = Math.round((parts.tiempo + parts.derrotados + parts.jefes + parts.recogidas) * mul);
    const record = time > save.stats.bestTime;

    save.coins += coins;
    bankTickets(false);
    save.stats.runs++;
    save.stats.totalKills += pl.kills;
    save.stats.bestTime = Math.max(save.stats.bestTime, Math.floor(time));
    if (coop) save.stats.bestGroupTime = Math.max(save.stats.bestGroupTime || 0, Math.floor(time));
    save.stats.bestLevel = Math.max(save.stats.bestLevel, pl.level);
    save.stats.coinsEarned += coins;
    const judge = G.Judgment.summary();
    // Match history (last 100 runs): see core/db.js, cleanHistory.
    G.DB.addHistory({
      id: Date.now(), d: pl.dex, sh: pl.shiny ? 1 : 0, t: Math.floor(time), lv: pl.level, k: pl.kills, b: pl.bosses, c: coins,
      dd: mine.d, dt: mine.t, m: pl.moves.map(m => [m.id, m.lvl]), it: pl.item || '', x: dead ? 1 : 0, g: coop ? 1 : 0,
      mt: team.filter(m => m.uid !== pl.uid).map(m => [m.name, m.dex, m.shiny ? 1 : 0]),
      ar: judge ? [Math.floor(judge.time), judge.bosses] : 0,
      kb: dead && pl.killer ? pl.killer : 0
    });
    if (judge) G.Progress.event('judgeEnd', judge);
    G.Judgment.reset();
    G.Progress.event('runEnd', { time, level: pl.level, coins: pl.coins, types: pl.mon.types, group: coop });
    G.Progress.checkAch();
    // A la nube al acabar la partida (como mucho cada 30 min); si la marca entra
    // en un top (hoy, semana o mes), enseguida (abajo, tras subirla al ranking).
    G.DB.commit('run');
    if (G.Social.me) {
      try { G.Social.publishProfile(); } catch (e) { console.warn(e); }
      try { G.Social.publishHistory(); } catch (e) { console.warn(e); }
    }

    // Ranking: en solitario cada uno lo suyo; en grupo lo sube el anfitrión.
    const mark = { t: Math.floor(time), lv: pl.level, kills: pl.kills };
    // Si la partida se ha tocado (ver clean()), no sube al ranking (sin avisar); lo demás, sí.
    const ok = clean();
    const sent = ok && !coop ? G.Ranking.submitSolo(Object.assign(mark, { dex: pl.dex, shiny: pl.shiny }))
               : ok && wasHost ? G.Ranking.submitGroup(Object.assign(mark, { members: team })) : null;
    if (sent) sent.then(b => { if (b && b.some(p => p !== 'a')) G.DB.commit(true); }).catch(() => {});

    G.RunUI.showOver({
      dead, killer: dead && pl.killer ? pl.killer : null, recent: dead && pl.hits ? pl.hits.slice(-4) : [],
      time, level: pl.level, kills: pl.kills, bosses: pl.bosses, coins, record, t1: pl.t1, t10: pl.t10, judge,
      moves: pl.moves, caught, mine, team: () => [...teamStats.values()], order: team.map(m => m.uid),
      breakdown: Object.entries(parts).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(' · ') +
                 (mul > 1 ? ` · ×${mul.toFixed(2)} Fortuna` : '')
    }, () => { pl = null; G.Flow.afterRun(); });
  }

  /*
   * ¿Partida limpia? Sólo cosas que ningún jugador legal puede hacer, con
   * márgenes enormes (el sistema del 10-10 daba falsos positivos):
   *   - el reloj de la partida va más deprisa que el real (trucos de velocidad)
   *   - funciones de tu Pokémon sustituidas (así se hace uno invencible)
   *   - vida, ataque, velocidad o recarga muy por encima de lo posible
   *   - se han usado las funciones de pruebas (saltar el reloj...)
   * Si algo salta, esa partida no sube al ranking (sin avisar) y nada más.
   */
  let runReal = 0, tampered = false;
  function clean() {
    if (tampered) return false;
    if (time > (performance.now() - runReal) / 1000 + 10) return false;
    for (const k of ['hurt', 'update', 'heal', 'gainXp']) if (Object.prototype.hasOwnProperty.call(pl, k)) return false;
    if (!isFinite(pl.hp) || !isFinite(pl.maxHp) || pl.hp > pl.maxHp + 1 || pl.maxHp > 50000) return false;
    if (pl.atkMul > 2000 || pl.spdMul > 25 || pl.cdMul < 0.03 || pl.level > 20 + time / 3) return false;
    return true;
  }

  // ---------------- subida de nivel ----------------

  function maybeLevelUp() {
    if (pendingLevels <= 0 || state !== 'playing') return;
    if (G.Coop.active) {
      // En grupo, las cartas salen a la vez para todos y se espera a que elijan.
      if (G.Coop.players().every(p => p.dead)) return;
      pendingLevels--;
      G.Coop.levelStart(pl.level);
      return;
    }
    // Nunca abras cartas con el Pokémon caído (morir y recoger XP en el mismo frame).
    if (pl.dead) return;
    pendingLevels--;
    state = 'levelup';
    G.Audio.sfx('levelup');
    G.RunUI.showLevelUp(pl.level, G.LevelUp.offer(pl), card => {
      G.Audio.sfx('confirm');
      card.apply(pl);
      state = 'playing';
      afterLevelUp();       // an item/armoury picked up meanwhile comes back now
    });
  }

  // ---------------- vínculos ----------------

  /**
   * Vínculo de un legendario: eliges qué movimientos se fusionan.
   * Si ahora no se puede (no hay dos sueltos), se guarda hasta que aprendas
   * otro movimiento. Se mira en cada fotograma: si otra pantalla la tapa (cartas
   * de nivel en grupo, pausa), vuelve a salir al cerrarla.
   * @param quiet  no avisar si todavía no se puede
   */
  function offerBond(quiet = false) {
    if (!pl || pl.bonds <= 0 || pl.dead || (state !== 'playing' && state !== 'held') || G.Rift.inArena) return;
    if (['scr-bond', 'scr-pause', 'scr-item', 'scr-levelup'].some(G.UI.isOpen)) return;
    const opt = pl.bondOptions();
    if (!opt) {
      if (!quiet) G.Spawner.say('Guardas el vínculo: aprende otro movimiento para usarlo', 3, true);
      return;
    }
    // Se para el juego; en grupo, para todos hasta que cada uno elige (G.Coop.holdStart).
    state = 'choice';
    if (G.Coop.active) G.Coop.holdStart();
    G.Audio.sfx('levelup');
    G.RunUI.showBond(opt, picked => {
      const group = pl.fuse(picked, opt.group);
      G.Audio.sfx('legend');
      G.FX.ring(pl.x, pl.y, 8, 130, '#ff8ad8', 0.8, 6);
      G.FX.burst(pl.x, pl.y - pl.bodyH * 0.5, '#ffb3e6', 40, 240);
      G.Spawner.say('¡Vínculo! ' + group.length + ' movimientos a la vez', 2.6, true);
      if (state === 'choice') state = holdBy.length ? 'held' : 'playing';
      if (G.Coop.active) G.Coop.holdEnd();
      afterLevelUp();                       // items that arrived while the Bond screen was open
    });
  }

  // ---------------- recogida ----------------

  const PICK_SFX = { xp: 'xp', xpBig: 'xp', coin: 'coin', heal: 'heal', bomb: 'break', stopwatch: 'confirm', magnet: 'confirm', ticket: 'shiny', ticket10: 'legend', item: 'legend' };

  /*
   * Cooperativo: la elección de objeto y las cartas de nivel no pueden taparse.
   * Si llega un objeto con las cartas abiertas, espera a que elijas carta; y si
   * las cartas llegan con la elección de objeto abierta, ésta vuelve a salir al
   * terminar. (Antes una cerraba la otra, nadie podía terminar de elegir y la
   * partida se quedaba parada para todos.)
   */
  let openItem = null;           // { cur, next, take } elección de objeto sin terminar
  const laterItems = [];         // objetos recogidos con las cartas de nivel abiertas
  function afterLevelUp() {
    if (state !== 'playing' && state !== 'held') return;
    if (openItem && !G.UI.isOpen('scr-item')) {
      const o = openItem;
      if (o.mine) { state = 'choice'; if (G.Coop.active) G.Coop.holdStart(); }
      if (o.list) G.RunUI.showArmoury(o.cur, o.list, o.take); else G.RunUI.showItemChoice(o.cur, o.next, o.take);
      return;
    }
    if (laterItems.length) offerItem(laterItems.shift());
  }

  /** Has cogido un objeto: si no llevas ninguno te lo pones; si no, eliges. */
  function offerItem(id) {
    const list = Array.isArray(id) ? id.filter(x => G.Items.BY[x]) : null;      // Aegislash Armoury: several to choose from
    if (!pl || (list ? !list.length : !G.Items.BY[id])) return;
    if (state === 'levelup' || G.UI.isOpen('scr-levelup') || G.UI.isOpen('scr-bond')) { laterItems.push(id); return; }
    let mine = false;            // esta elección es la que ha parado el juego
    const take = got => {
      openItem = null;
      if (got && got !== pl.item) {
        pl.equip(got);
        G.Spawner.say('¡Llevas ' + G.Items.BY[got].name + '!', 2.6, true);
        G.Progress.event('item', { id: got });
        // Choice Band locks you into one move: pick which one now, before the game goes on.
        if (got === 'choiceband' && pl.slots.length > 1) {
          if (!mine && !pl.dead && (state === 'playing' || state === 'held')) {
            mine = true; state = 'choice';
            if (G.Coop.active) G.Coop.holdStart();
          }
          G.RunUI.showMoveChoice(pl, i => {
            if (i !== pl.active) { pl.active = i; G.Projectiles.clearOrbs(pl); }
            G.Audio.sfx('confirm');
            finish();
          });
          return;
        }
      }
      finish();
    };
    const finish = () => {
      if (!mine) { afterLevelUp(); return; }
      if (state === 'choice') state = holdBy.length ? 'held' : 'playing';
      if (G.Coop.active) G.Coop.holdEnd();
      afterLevelUp();
    };
    if (list) {
      // A downed player chooses without freezing the game for everyone else.
      if ((state === 'playing' || state === 'held') && !pl.dead) {
        mine = true;
        state = 'choice';
        if (G.Coop.active) G.Coop.holdStart();
      }
      openItem = { cur: pl.item || null, next: null, list, take, get mine() { return mine; } };
      G.RunUI.showArmoury(pl.item || null, list, take);
      return;
    }
    // De momento la Vidasfera no se pone sola: si es lo primero que encuentras, eliges aceptarla o descartarla.
    if (!pl.item && id !== 'lifeorb') { take(id); return; }
    if (pl.item === id) { G.Spawner.say('Ya llevas ' + G.Items.BY[id].name, 2, true); return; }
    // Se para el juego mientras eliges; en grupo, para todos (como con las
    // fusiones). Antes en grupo seguía y te pegaban mientras elegías.
    if (state === 'playing' || state === 'held') {
      mine = true;
      state = 'choice';
      if (G.Coop.active) G.Coop.holdStart();
    }
    openItem = { cur: pl.item || null, next: id, take, get mine() { return mine; } };
    G.RunUI.showItemChoice(pl.item || null, id, take);
  }

  /** @param who  quien lo ha cogido (en cooperativo puede ser un compañero) */
  function onCollect(p, who = pl) {
    const mine = who === pl;
    if (G.Coop.active && !G.Coop.isHost) {
      // Copia de un objeto del anfitrión: el efecto lo decide él.
      if (mine) G.Audio.sfx(PICK_SFX[p.kind]);
      return;
    }
    if (G.Coop.active) G.Coop.collected(p, who);
    if (mine || p.kind === 'bomb') G.Audio.sfx(PICK_SFX[p.kind]);
    if (p.kind === 'xp' || p.kind === 'xpBig') {
      pendingLevels += pl.gainXp(p.value * (G.Coop.active ? G.Coop.xpFactor() : 1));
      return;
    }
    if (p.kind === 'coin') {
      const v = G.Interact.goldCoin(p.value);            // Gold shrine combo (team-wide)
      pl.coins += v;
      G.FX.dmgText(who.x, who.y - who.bodyH - 6, '+' + v, v > p.value ? '#fff08a' : '#ffd23f');
      return;
    }
    if (p.kind === 'item') {
      if (mine) offerItem(p.value);
      return;
    }
    if (p.kind === 'ticket' || p.kind === 'ticket10') {
      if (p.kind === 'ticket') pl.t1++; else pl.t10++;
      bankTickets();
      G.FX.dmgText(who.x, who.y - who.bodyH - 8, p.kind === 'ticket' ? '+1 ticket' : '¡Ticket ×10!', p.kind === 'ticket' ? '#ffd23f' : '#d9a6ff', true);
      G.FX.ring(who.x, who.y, 6, 50, p.kind === 'ticket' ? '#ffd23f' : '#c47bff', 0.4, 3);
      return;
    }
    if (p.kind === 'heal') {
      if (mine) pl.heal(pl.maxHp * 0.3);
      G.FX.ring(who.x, who.y, 6, 60, '#5fe08a', 0.4, 3);
      return;
    }
    if (p.kind === 'magnet') {
      G.Pickups.pullAll();
      G.FX.ring(who.x, who.y, 10, 420, '#ff9ed8', 0.6, 4);
      return;
    }
    if (p.kind === 'stopwatch') {
      const R = G.Camera.outerRadius();
      G.FX.swirl(who.x, who.y, R * 0.55);
      G.FX.ring(who.x, who.y, 10, R * 0.6, '#8fe3ff', 0.6, 4);
      for (const e of G.EnemyMgr.all()) {
        if (e.dead || e.judge) continue;
        if (e.boss) e.applySlow(0.5, 8);
        else e.freeze(7);
      }
      G.EnemyMgr.timeStop(7);          // new arrivals are frozen too while it lasts
      return;
    }
    if (p.kind === 'bomb') {
      if (G.U.dist2(who.x, who.y, pl.x, pl.y) < 500 * 500) G.Camera.kick(0.8);
      const R = G.Camera.outerRadius();
      G.FX.ring(who.x, who.y, 20, R, '#ff7b3d', 0.5, 6);
      for (const e of G.EnemyMgr.all()) {
        if (mine ? !G.Camera.sees(e.x, e.y, 0) : G.U.dist2(e.x, e.y, who.x, who.y) > R * R) continue;
        e.hurt(60 + pl.level * 14, '#ff7b3d', e.x - who.x, e.y - who.y, 160);
      }
    }
  }

  // ---------------- teclado ----------------

  function handleKeys() {
    if (G.SettingsUI.isOpen) { if (G.Input.tap('escape')) G.SettingsUI.close(); return; }
    // La Sentencia de Arceus: Espacio, Intro o Esc saltan la animación (si se puede).
    if (G.Judgment.cinematic && state === 'playing') {
      if (['space', 'enter', 'escape'].some(k => G.Input.tap(k))) G.Judgment.skip();
      return;
    }
    if (state === 'levelup') {
      for (let i = 0; i < 3; i++) {
        if (G.Input.tap('digit' + (i + 1)) || G.Input.tap('numpad' + (i + 1))) G.RunUI.pick(i);
      }
      if (G.Input.tap('keyr')) G.RunUI.reroll();
      if (G.Input.tap('keyx')) G.RunUI.skip();
      return;
    }
    if (G.UI.isOpen('scr-bond')) {
      for (let i = 0; i < 4; i++) {
        if (G.Input.tap('digit' + (i + 1)) || G.Input.tap('numpad' + (i + 1))) G.RunUI.pickBond(i);
      }
      return;
    }
    if (G.UI.isOpen('scr-item')) {
      for (let i = 0; i < 6; i++) {
        if (G.Input.tap('digit' + (i + 1)) || G.Input.tap('numpad' + (i + 1))) { const c = document.querySelectorAll('#item-cards .card')[i]; if (c) c.click(); }
      }
      return;
    }
    if (state === 'ui') {
      // Esc en una subpantalla del menú vuelve al menú.
      if (G.Input.tap('escape') && !G.UI.isOpen('scr-profile') && ['scr-dex', 'scr-upgrades', 'scr-gacha', 'scr-friends', 'scr-rank', 'scr-goals'].some(G.UI.isOpen)
          && document.getElementById('pull-fx').classList.contains('hidden')) G.MenuUI.open();
      return;
    }
    if (G.Input.tap('escape') || G.Input.tap('keyp')) { togglePause(); return; }
    if (state !== 'playing' || !pl) return;
    // Caído en grupo: Q / E (o flechas, o Tab) cambian a quién miras.
    if (pl.dead && G.Coop.active) {
      if (G.Input.tap('keyq') || G.Input.tap('arrowleft')) cycleSpectate(-1);
      if (G.Input.tap('keye') || G.Input.tap('arrowright') || G.Input.tap('tab')) cycleSpectate(1);
      return;
    }
    for (let i = 0; i < 4; i++) {
      if (G.Input.tap('digit' + (i + 1)) || G.Input.tap('numpad' + (i + 1))) pl.setActive(i);
    }
    if (G.Input.tap('keyq')) pl.cycle(-1);
    if (G.Input.tap('keye') || G.Input.tap('tab')) pl.cycle(1);
  }

  // ---------------- bucle ----------------

  let deathT = 0;

  let frameDt = 0, speedK = 1;
  let fpsShown = 60, fpsAcc = 0, fpsN = 0;
  // El siguiente fotograma se pide ANTES de nada: si algo falla a mitad, el
  // juego sigue (antes se quedaba congelado para siempre y había que recargar;
  // así se perdió una partida enorme al abrirse una grieta).
  // Si falla fotograma tras fotograma (el juego ya no avanza ni se ve), la
  // partida se da por terminada a los ~3 s y se guarda: tiempo, derrotados,
  // récords y ranking. Mejor eso que una pantalla negra y perderlo todo.
  let loopErrs = 0, errRun = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    try { frame(ts); errRun = 0; }
    catch (e) {
      if (loopErrs++ < 5) console.error('[Game] fallo en un fotograma:', e);
      G.Input.endFrame();
      if (++errRun === 180 && pl && state !== 'ui' && state !== 'over') {
        try {
          G.UI.hideAll();
          quitRun();
          G.UI.toast('El juego ha fallado: tu partida se ha guardado hasta aquí', 5000);
        } catch (e2) { console.error('[Game] no se pudo cerrar la partida:', e2); }
      }
    }
  }

  function frame(ts) {
    const real = (ts - last) / 1000 || 0;
    const dt = Math.min(1 / 30, real) * speedK;
    last = ts;
    if (state === 'playing') G.Settings.sample(real);
    fpsAcc += real; fpsN++;
    if (fpsAcc >= 0.5) { fpsShown = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    frameDt = state === 'playing' ? dt : 0;
    // The full-screen flash fades in real time, also while the game is paused (a teammate choosing a Bond used to freeze it at full strength).
    if (flashT > 0) flashT -= Math.min(1 / 30, real);

    handleKeys();

    if (state === 'playing') update(dt);
    else if (pl && state !== 'ui') { G.FX.update(dt * 0.25); pl.anim.update(dt * 0.25); }
    // La red se atiende siempre (también con las cartas de nivel abiertas).
    if (G.Coop.active && pl && state !== 'ui' && state !== 'over') G.Coop.tick(dt);

    if (pl && state !== 'ui') render(); else Backdrop.render(ctx, w, h, dpr, dt);
    G.UI.tick(dt);

    G.Input.endFrame();
  }

  function update(dt) {
    const coop = G.Coop.active;
    // Failsafe: flagged as choosing but no choice screen is open (another screen replaced it) -> would freeze the whole group.
    if (coop && state === 'choice' && !['scr-bond', 'scr-item', 'scr-mod', 'scr-levelup'].some(G.UI.isOpen)) {
      state = holdBy.length ? 'held' : 'playing';
      G.Coop.holdEnd();
    }
    // La Sentencia de Arceus: mientras dura la animación, todo lo demás se para.
    if (G.Judgment.cinematic) {
      G.Judgment.cineTick(dt);
      pl.anim.update(dt);
      if (coop) for (const p of G.Coop.puppets()) p.netUpdate(dt);
      G.World.update(dt, G.Camera);
      G.FX.update(dt);
      G.Audio.music(G.Judgment.music);
      return;
    }
    // Tras caer, deja que se vea la animación de Faint antes del resumen.
    // (En la arena de la grieta no: allí caer sólo te echa de vuelta.)
    if (pl.dead && !coop && !G.Rift.inArena) {
      deathT += dt;
      pl.update(dt);
      G.EnemyMgr.update(dt * 0.3, pl);
      G.FX.update(dt);
      G.Camera.follow(pl.x, pl.y, dt);
      if (deathT > 1.3) { deathT = 0; endRun(true); }
      return;
    }
    // The run clock stops inside a rift or portal arena (normal rifts and the Zygarde Portal): the fight there has
    // its own countdown, and the minutes spent in it no longer bring biomes, difficulty or Arceus closer.
    if (!G.Rift.inArena) time += dt;

    const b = Math.floor(time / 240);
    if (b !== biome && !G.Rift.inArena && !G.Judgment.active) {
      biome = b;
      G.World.setBiome(b);
      G.Audio.sfx('biome');
      G.Spawner.say('— ' + G.World.biomeName() + ' —', 3);
      G.FX.ring(pl.x, pl.y, 10, G.Camera.outerRadius(), '#ffffff', 0.7, 6);
    }

    pl.frozen = coop && (G.UI.isOpen('scr-pause') || G.UI.isOpen('scr-item'));
    pl.update(dt);
    if (coop) {
      for (const p of G.Coop.puppets()) { p.netUpdate(dt); G.Combat.ghostOrbit(p, dt, time); }
      if (pl.dead) reviveTick(dt);
    }
    const spec = spectated();
    G.Camera.follow(spec ? spec.pl.x : pl.x, spec ? spec.pl.y : pl.y, dt);
    G.World.update(dt, G.Camera);

    const all = everyone();
    if (!coop || G.Coop.isHost) { G.Path.update(dt, all); G.Spawner.update(dt, all, time); }
    else G.Spawner.tickBanner(dt);
    G.EnemyMgr.update(dt, all);
    G.EnemyMgr.rebuildGrid();
    G.Combat.tick(dt, pl, time);
    G.Projectiles.update(dt, pl, G.EnemyMgr.all());
    G.Combat.resolve(dt, pl, time);
    G.Combat.updateFields(dt);
    G.Pickups.update(dt, all, onCollect);
    G.Hazards.update(dt);
    G.Interact.update(dt, pl);
    G.Rift.update(dt, pl, time);
    G.Judgment.update(dt, pl, time);
    G.Events.update(dt, all, time);
    G.Weather.update(dt, time, pl);
    G.FX.update(dt);

    G.Audio.music(G.Judgment.active ? G.Judgment.music : G.Rift.inArena ? 'rift' : G.EnemyMgr.bossAlive() ? 'boss' : G.BIOME_MUSIC[biome % G.BIOME_MUSIC.length]);
    if (!coop || G.Coop.isHost) maybeLevelUp();
    if (pl.bonds > 0) offerBond(true);
    if (G.Coop.isHost) checkAllDown(dt);
  }

  // ---------------- espectador (caído en grupo) ----------------
  // Mientras estás caído, la cámara sigue a un compañero vivo; Q / E (o los botones de
  // la pantalla) pasan al anterior / siguiente. Al levantarte vuelve a ti sola.
  let specUid = null;
  function specList() { return G.Coop.active ? G.Coop.mates.filter(m => m.connected && !m.pl.dead) : []; }
  function spectated() {
    if (!pl || !pl.dead || !G.Coop.active) return null;
    const list = specList();
    if (!list.length) return null;
    return list.find(m => m.uid === specUid) || (specUid = list[0].uid, list[0]);
  }
  function cycleSpectate(dir) {
    const list = specList();
    if (list.length < 2 || !pl || !pl.dead) return;
    const i = Math.max(0, list.findIndex(m => m.uid === specUid));
    specUid = list[(i + dir + list.length) % list.length].uid;
    G.Audio.sfx('select');
  }

  /** Caído en grupo: un compañero a tu lado te va levantando. */
  function reviveTick(dt) {
    let helper = null, best = 56 * 56;
    for (const p of G.Coop.puppets()) {
      const d2 = p.dead ? Infinity : G.U.dist2(p.x, p.y, pl.x, pl.y);
      if (d2 < best) { best = d2; helper = p; }
    }
    pl.reviveT = helper ? (pl.reviveT || 0) + dt : Math.max(0, (pl.reviveT || 0) - dt * 0.5);
    if (pl.reviveT >= G.Player.REVIVE_TIME) {
      if (helper && helper.uid) pl.revivedBy.push(helper.uid);       // credited to them in the end-of-run stats
      pl.revive(0.5);
    }
  }

  /** Anfitrión: si caéis todos, se acaba (tras ver caer al último). */
  function checkAllDown(dt) {
    if (G.Rift.inArena || !G.Coop.players().every(p => p.dead)) { deathT = 0; return; }
    deathT += dt;
    if (deathT > 1.6) {
      deathT = 0;
      G.Coop.over(summary());
      endRun(true);
    }
  }

  // ---------------- dibujo ----------------

  function drawScene(cam, extra) {
    const t = performance.now() / 1000;
    G.World.drawGround(ctx, cam);
    G.World.drawLiquid(ctx, cam, t);
    G.Hazards.draw(ctx);
    G.Combat.drawGroundFields(ctx);
    G.Pickups.draw(ctx);

    // Todo lo que tiene "pies" se ordena por Y: objetos, enemigos, jugador.
    const items = [];
    // Los planos (manantiales, trampas) siempre debajo de todo lo demás.
    for (const p of G.World.visibleProps(cam)) items.push({ y: p.flat ? p.y - 4000 : p.y, prop: p });
    for (const e of G.EnemyMgr.drawables(cam)) items.push({ y: e.y, ent: e });
    for (const e of extra) items.push({ y: e.y, ent: e });
    const rift = G.Rift.drawable();
    if (rift) items.push({ y: rift.y, ent: rift });
    const arceus = pl && state !== 'ui' ? G.Judgment.drawable() : null;
    if (arceus) items.push({ y: arceus.y, ent: arceus });
    if (pl && state !== 'ui') for (const d of G.Events.drawables()) items.push({ y: d.y, ent: d });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) {
      if (it.prop) G.World.drawProp(ctx, it.prop, t);
      else it.ent.draw(ctx);
    }
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;

    ctx.save();
    ctx.scale(G.Camera.scale, G.Camera.scale);
    G.Camera.apply(ctx);
    drawScene(G.Camera, G.Coop.active ? [pl, ...G.Coop.puppets()] : [pl]);
    G.Projectiles.draw(ctx);
    G.Combat.drawAirFields(ctx);
    G.FX.draw(ctx);
    G.Judgment.drawAir(ctx);
    ctx.restore();

    G.Weather.draw(ctx, w, h, frameDt);
    G.World.drawVignette(ctx, w, h);
    // Niebla: la viñeta se cierra un poco (sin tapar el centro).
    const fog = G.Weather.vignette;
    if (fog > 0) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.62);
      g.addColorStop(0, 'rgba(200,205,220,0)');
      g.addColorStop(1, `rgba(200,205,220,${0.45 * fog})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    if (!G.Judgment.cinematic) G.HUD.draw(ctx, w, h, pl, st);
    G.Judgment.drawOverlay(ctx, w, h);
    G.Touch.draw(ctx);
    if (G.Settings.get('fps')) {
      ctx.save();
      ctx.font = '700 11px Pixelify, monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = fpsShown >= 50 ? '#5fe08a' : fpsShown >= 30 ? '#ffd23f' : '#ff5f6d';
      ctx.fillText(fpsShown + ' FPS', w - 10, h - 8);
      ctx.restore();
    }
    if (flashT > 0) {
      ctx.save();
      // "Menos destellos": el fogonazo de pantalla se queda en un tercio.
      ctx.globalAlpha = Math.min(1, flashT / flashDur * 1.4) * (G.Settings.get('calm') ? 0.3 : 1);
      ctx.fillStyle = flashCol;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  // ---------------- fondo de los menús ----------------

  /**
   * El mundo de verdad, con Pokémon salvajes paseando y la cámara a la deriva.
   * Así el menú enseña desde el primer segundo cómo se ve el juego.
   */
  const Backdrop = (() => {
    let wanderers = [], t = 0, ready = false, sceneT = 0, cur = 0, sw = null;
    let goldT = 0, evT = 0, banner = null, tags = [], hourOv = null, lastTeam = 0, tapHooked = false;
    const CAST = [1, 4, 7, 25, 133, 52, 39, 35, 16, 43, 60, 69, 74, 92, 129, 147, 113, 143, 54, 79];
    const SCENE_TIME = 30, FADE_HALF = 0.6;
    const FONT = '800 8px Pixelify,"Segoe UI",system-ui,sans-serif';
    // Escenas del fondo, en orden: el mapa normal (3 paletas) y arenas de grieta con su legendario
    // y un pequeño equipo que lo rodea. Las arenas usan el mismo código que las de verdad.
    // El equipo sale de una partida en grupo de tu historial (si la hay); si no, el de aquí.
    const SCENES = [
      { map: 0 },
      { arena: 'fire', boss: 244, team: [6, 25, 448, 94] },        // Entei
      { map: 1 },
      { arena: 'ice', boss: 144, team: [9, 25, 59, 3] },          // Articuno
      { map: 2 },
      { arena: 'water', boss: 382, team: [25, 6, 3, 65] },        // Kyogre
      { arena: 'ghost', boss: 487, team: [25, 448, 9, 6] },       // Giratina
      { arena: 'electric', boss: 145, team: [6, 9, 94, 448] },    // Zapdos
      { arena: 'dragon', boss: 384, team: [25, 9, 94, 3] },       // Rayquaza
      { arena: 'judgment', boss: 493, team: [6, 9, 3, 25] }       // Arceus
    ];
    const ARENA_TX = 5200, ARENA_TY = 5200, ARENA_R = 11;
    const WX_NAME = { sun: 'Harsh sunlight', rain: 'Rain', sand: 'Sandstorm', snow: 'Snowfall', fog: 'Fog' };
    const HORDE_TYPES = ['fire', 'water', 'grass', 'electric', 'ice', 'psychic', 'ghost', 'dragon', 'fighting', 'poison', 'bug', 'rock'];

    /** Escala de un jefe (como en enemy.js): ~110 px de alto, en múltiplos de 0,5. */
    function bossScale(dex) {
      const m = G.Sprites.animMeta(dex, 'Idle');
      const h = (m ? m.ay : 30) * G.Sprites.PX;
      return G.U.clamp(Math.round(110 / h * 2) / 2, 1, 2);
    }

    // ---------------- Pokémon de tus partidas ----------------

    const myName = () => (G.Social && G.Social.me && G.Social.me.name) || 'You';
    const hasSprite = d => !!(G.SPRITE_META && G.SPRITE_META[d]);

    /** Un equipo de una partida en grupo de tu historial (tú + tus compañeros); si no hay, tus últimos Pokémon. */
    function historyTeam() {
      const hist = (G.DB.save && G.DB.save.history) || [];
      const groups = hist.filter(e => e.g && e.mt && e.mt.length && hasSprite(e.d));
      if (groups.length) {
        const pool = groups.length > 1 ? groups.filter(e => e.id !== lastTeam) : groups;
        const e = G.U.pick(pool);
        lastTeam = e.id;
        const mem = [{ dex: e.d, sh: !!e.sh, label: myName() }, ...e.mt.map(([n, d, sh]) => ({ dex: d, sh: !!sh, label: n }))];
        return mem.filter(m => hasSprite(m.dex)).slice(0, 5);
      }
      const seen = new Set(), own = [];
      for (const e of hist) if (!seen.has(e.d) && hasSprite(e.d)) { seen.add(e.d); own.push({ dex: e.d, sh: !!e.sh, label: myName() }); }
      return own.length >= 2 ? own.slice(0, 4) : null;
    }

    /** Hasta 6 Pokémon de tus partidas (tuyos y de tus compañeros) para pasear por el mapa. */
    function historyCast() {
      const hist = (G.DB.save && G.DB.save.history) || [], out = new Map();
      for (const e of hist.slice(0, 30)) {
        if (hasSprite(e.d) && !out.has(e.d)) out.set(e.d, { dex: e.d, sh: !!e.sh, label: myName() });
        for (const [n, d, sh] of e.mt || []) if (hasSprite(d) && !out.has(d)) out.set(d, { dex: d, sh: !!sh, label: n });
      }
      const all = [...out.values()];
      for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
      return all.slice(0, 6);
    }

    // ---------------- escenas ----------------

    function say(text, col = '#ffffff') { banner = { text, col, t: 0 }; }

    function applyScene(i) {
      cur = ((i % SCENES.length) + SCENES.length) % SCENES.length;
      const sc = SCENES[cur];
      G.World.reset(4242);
      G.FX.clear(); G.Projectiles.clear(); G.Combat.clearFields(); G.EnemyMgr.clear(); G.Pickups.clear();
      G.Weather.clear();
      t = 0; sceneT = 0; goldT = 0; tags = []; banner = null;
      evT = G.U.rand(7, 12);
      if (sc.arena) {
        const ts = G.World.TS, cx = ARENA_TX * ts + ts / 2, cy = ARENA_TY * ts + ts / 2;
        G.World.setArena({ tx: ARENA_TX, ty: ARENA_TY, r: ARENA_R, type: sc.arena });
        G.World.setBiome(G.Tiles.arenaBiome(sc.arena), true);
        G.Camera.x = cx; G.Camera.y = cy + ts;
        // El legendario al norte (en grande) y el equipo al sur, mirándole.
        const team = historyTeam() || sc.team.map(d => ({ dex: d }));
        G.Sprites.preload([sc.boss, ...team.map(m => m.dex)], 6000);
        const boss = spawn({ dex: sc.boss }, { x: cx, y: cy - ts * 3, leash: ts * 2.2, boss: true });
        wanderers = [boss, ...team.map((m, k) => spawn(m, {
          x: cx + (k - (team.length - 1) / 2) * ts * 1.8, y: cy + ts * 3.5, leash: ts * 3, target: boss }))];
        // Cada arena trae su clima, como las de verdad.
        const th = G.Tiles.ARENA_THEMES[sc.arena];
        if (th && th.weather) { G.Weather.showcase(th.weather, 9999); say(WX_NAME[th.weather], '#9fd8ff'); }
      } else {
        G.World.setBiome(sc.map, true);
        G.Camera.x = 0; G.Camera.y = 0;
        const hc = historyCast(), have = new Set(hc.map(m => m.dex));
        const base = CAST.filter(d => !have.has(d)).slice(0, 20 - hc.length);
        G.Sprites.preload(hc.map(m => m.dex), 6000);
        wanderers = [...hc, ...base.map(d => ({ dex: d }))].map(m => spawn(m, null));
        // A veces, clima (los mismos del juego, según el bioma).
        if (Math.random() < 0.55) {
          const k = G.Weather.pickFor(sc.map);
          G.Weather.showcase(k, G.U.rand(40, 60)); say(WX_NAME[k], '#9fd8ff');
        }
      }
    }

    function init() {
      applyScene(0);
      ready = true;
      // Tocar el fondo (no un botón ni un panel) hace reaccionar a los Pokémon.
      if (!tapHooked) {
        tapHooked = true;
        // The treasure thief runs in front of the main menu: tapping it catches it even if a menu button is under it.
        let swallow = 0;
        document.addEventListener('pointerdown', e => {
          if (!ready || state !== 'ui' || sw || !menuOnly()) return;
          if (hitThief(e.clientX, e.clientY)) { swallow = performance.now(); e.preventDefault(); e.stopPropagation(); }
        }, true);
        document.addEventListener('click', e => {
          if (swallow && performance.now() - swallow < 700) { swallow = 0; e.preventDefault(); e.stopPropagation(); }
        }, true);
        document.addEventListener('pointerdown', e => {
          if (!ready || state !== 'ui' || sw) return;
          const el = e.target;
          if (el && (el.id === 'game' || (el.classList && el.classList.contains('scr')))) tap(e.clientX, e.clientY);
        });
      }
    }

    /** `m` = { dex, sh?, label? }. `home` = null: en cualquier sitio de la pantalla (mapa); si no, { x, y, leash, boss, target } de una arena. */
    function spawn(m, home) {
      const dex = m.dex;
      const scale = home && home.boss ? bossScale(dex) : 1;
      const a = new G.Sprites.Animator(dex, scale, !!m.sh);
      const r = G.Sprites.bodyRadius(dex, scale);
      let x = 0, y = 0;
      if (home) { x = home.x; y = home.y; }
      else {
        for (let i = 0; i < 20; i++) {
          x = G.Camera.x + G.U.rand(-1, 1) * G.Camera.w * 0.6;
          y = G.Camera.y + G.U.rand(-1, 1) * G.Camera.h * 0.6;
          if (G.World.isFree(x, y, r)) break;
        }
      }
      return { dex, m, anim: a, x, y, r, vx: 0, vy: 0, t: 0, home, scale, draw(ctx) {
        G.Sprites.drawShadow(ctx, this.dex, this.x, this.y, this.scale);
        // Hora dorada / ladrón: un brillo dorado detrás, como los enemigos dorados.
        if ((goldT > 0 && !(this.home && this.home.boss)) || this.thief) {
          const h = G.Sprites.bodyHeight(this.dex, this.scale);
          ctx.save();
          ctx.globalAlpha = 0.3 + Math.sin(t * 5 + this.x) * 0.06;
          ctx.fillStyle = '#ffd23f';
          ctx.beginPath(); ctx.ellipse(this.x, this.y - h * 0.45, this.r * 1.3, h * 0.6, 0, 0, 6.2832); ctx.fill();
          ctx.restore();
        }
        this.anim.draw(ctx, this.x, this.y);
        if (this.thief) G.Icons.draw(ctx, 'coin', this.x - 6, this.y - G.Sprites.bodyHeight(this.dex, this.scale) - 14, 12);
      } };
    }

    // ---------------- eventos del juego, en el menú ----------------

    function spawnThief() {
      // Como en las partidas: un Meowth cargado de monedas o, 1 de cada 4, un Gholdengo.
      const dex = Math.random() < 0.25 && hasSprite(1000) ? 1000 : 52;
      const left = Math.random() < 0.5;
      const x = left ? G.Camera.left() - 30 : G.Camera.left() + G.Camera.w + 30, y = G.Camera.y + G.U.rand(-0.3, 0.3) * G.Camera.h;
      const wd = spawn({ dex, label: dex === 1000 ? 'Gholdengo' : 'Meowth' }, { x, y, leash: 0 });
      Object.assign(wd, { temp: true, thief: true, life: 15, vx: (left ? 1 : -1) * 120, vy: G.U.rand(-30, 30) });
      wanderers.push(wd);
      say('Treasure thief! Catch it!', '#ffd23f');
    }

    function spawnHorde() {
      const type = G.U.pick(HORDE_TYPES);
      const pool = G.DEX.filter(p => !p.leg && p.rarity <= 3 && p.types.includes(type) && hasSprite(p.dex));
      if (pool.length < 4) return;
      const pick = [...pool].sort(() => Math.random() - 0.5).slice(0, 10);
      const dirR = Math.random() < 0.5, base = G.Camera.y + G.U.rand(-0.25, 0.25) * G.Camera.h;
      G.Sprites.preload(pick.map(p => p.dex), 5000);
      pick.forEach((p, i) => {
        const x = dirR ? G.Camera.left() - 40 - (i % 5) * 44 : G.Camera.left() + G.Camera.w + 40 + (i % 5) * 44;
        const y = base + (Math.floor(i / 5) - 0.5) * 56 + G.U.rand(-12, 12);
        const wd = spawn({ dex: p.dex }, { x, y, leash: 0 });
        Object.assign(wd, { temp: true, life: 30, vx: (dirR ? 1 : -1) * G.U.rand(70, 90), vy: 0 });
        wanderers.push(wd);
      });
      say('Horde: ' + type[0].toUpperCase() + type.slice(1) + ' type', G.U.TYPE_COLOR[type] || '#ffffff');
    }

    function startEvent() {
      if (SCENES[cur].arena || goldT > 0 || wanderers.some(w => w.temp)) return;
      const k = Math.random();
      if (k < 0.3) { goldT = 14; say('Gold Hour', '#ffd23f'); G.Audio.sfx('select'); }
      else if (k < 0.65) spawnThief();
      else spawnHorde();
    }

    // ---------------- the treasure thief in front of the main menu ----------------

    /** True while the main menu is the only screen open (the thief is shown, and can be caught, only then). */
    function menuOnly() {
      return G.UI.isOpen('scr-menu') && [...document.querySelectorAll('.scr:not(.hidden)')].every(e => e.id === 'scr-menu');
    }

    /** The thief under a screen point, if any (generous hit area: it is fast). */
    function hitThief(px, py) {
      const wx = G.Camera.left() + px / G.Camera.scale, wy = G.Camera.top() + py / G.Camera.scale;
      for (const wd of wanderers) {
        if (!wd.thief || wd.life < 0.3) continue;
        const h = G.Sprites.bodyHeight(wd.dex, wd.scale);
        if (Math.hypot(wx - wd.x, wy - (wd.y - h * 0.5)) < Math.max(wd.r, h * 0.5) + 16) { catchThief(wd); return true; }
      }
      return false;
    }

    const THIEF_CD = 10 * 60 * 1000;      // a ticket from the thief at most once every 10 minutes (otherwise a few coins)
    function catchThief(wd) {
      const h = G.Sprites.bodyHeight(wd.dex, wd.scale);
      G.FX.ring(wd.x, wd.y - h * 0.5, 6, 46, '#ffd23f', 0.45, 4);
      G.FX.burst(wd.x, wd.y - h * 0.5, '#ffd23f', 30, 230);
      G.Audio.sfx('buy');
      tags.push({ x: wd.x, y: wd.y - h - 14, text: 'Caught!', t: 0, col: '#ffd23f' });
      wd.life = Math.min(wd.life, 0.25);
      if (!G.DB.save) return;
      const key = 'megamon.thiefT';
      let last = 0;
      try { last = +localStorage.getItem(key) || 0; } catch (e) { /* nada */ }
      if (Date.now() - last >= THIEF_CD) {
        try { localStorage.setItem(key, String(Date.now())); } catch (e) { /* nada */ }
        G.Progress.grant({ t1: 1 });
        G.UI.toast('You caught the treasure thief! +1 ticket', 2600);
      } else {
        G.Progress.grant({ coins: 25 });
        G.UI.toast('You caught the treasure thief! +25 coins', 2200);
      }
      G.DB.commit();
    }

    // Drawn on a layer in front of the menu, so it stays visible (and clickable) over the buttons.
    let layer = null;
    function drawThiefLayer(w, h, dpr) {
      if (!layer) {
        const cv = document.createElement('canvas');
        cv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:21';
        document.body.appendChild(cv);
        layer = { cv, c: cv.getContext('2d') };
      }
      const show = state === 'ui' && !sw && menuOnly() && (tags.length || wanderers.some(x => x.thief));
      if (!show) { if (layer.on) { layer.c.setTransform(1, 0, 0, 1, 0, 0); layer.c.clearRect(0, 0, layer.cv.width, layer.cv.height); layer.on = false; } return; }
      const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
      if (layer.cv.width !== pw || layer.cv.height !== ph) { layer.cv.width = pw; layer.cv.height = ph; }
      const c = layer.c;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      c.imageSmoothingEnabled = false;
      c.save();
      c.scale(G.Camera.scale, G.Camera.scale);
      G.Camera.apply(c);
      for (const wd of wanderers) if (wd.thief) wd.draw(c);
      drawTags(c);
      c.restore();
      layer.on = true;
    }

    // ---------------- tocar un Pokémon ----------------

    function tap(px, py) {
      const wx = G.Camera.left() + px / G.Camera.scale, wy = G.Camera.top() + py / G.Camera.scale;
      let best = null, bd = Infinity;
      for (const wd of wanderers) {
        const h = G.Sprites.bodyHeight(wd.dex, wd.scale);
        const d = Math.hypot(wx - wd.x, wy - (wd.y - h * 0.5));
        if (d < Math.max(wd.r, h * 0.5) + 10 && d < bd) { best = wd; bd = d; }
      }
      if (!best) return;
      const mon = G.DEX_BY[best.dex], h = G.Sprites.bodyHeight(best.dex, best.scale);
      const col = (mon && G.U.TYPE_COLOR[mon.types[0]]) || '#ffffff';
      G.FX.ring(best.x, best.y - h * 0.5, 6, 46, col, 0.45, 4);
      G.FX.burst(best.x, best.y - h * 0.5, col, 14, 150);
      if (best.thief) { catchThief(best); return; }
      best.anim.play(G.U.pick(['Attack', 'Shoot', 'Charge']));
      best.anim.dir = G.Sprites.dirFromAngle(Math.PI / 2);
      best.vx = best.vy = 0; best.t = G.U.rand(1.6, 2.8);
      tags.push({ x: best.x, y: best.y - h - 8, text: (best.m && best.m.label) || (mon ? mon.name : ''), t: 0, col: '#ffffff' });
    }

    // ---------------- hora del día ----------------

    // Tinte según la hora real del jugador: noche, amanecer, atardecer.
    const TOD = [[0, 12, 16, 58, .36], [5, 12, 16, 58, .36], [6.5, 255, 140, 110, .16], [8.5, 255, 200, 140, .05], [10, 0, 0, 0, 0],
                 [16, 0, 0, 0, 0], [17.5, 255, 170, 90, .10], [19.5, 200, 90, 110, .20], [21, 40, 30, 90, .30], [22.5, 12, 16, 58, .36], [24, 12, 16, 58, .36]];
    function todColor() {
      const d = new Date(), h = hourOv != null ? hourOv : d.getHours() + d.getMinutes() / 60;
      for (let i = 1; i < TOD.length; i++) {
        if (h <= TOD[i][0]) {
          const a = TOD[i - 1], b = TOD[i], k = (h - a[0]) / (b[0] - a[0] || 1);
          return [0, 1, 2, 3].map(j => a[j + 1] + (b[j + 1] - a[j + 1]) * k);
        }
      }
      return [0, 0, 0, 0];
    }
    const STARS = Array.from({ length: 40 }, (_, i) => [G.U.hash(i, 1, 7), G.U.hash(i, 2, 7) * 0.7, G.U.hash(i, 3, 7) * 6.28]);
    function drawTod(ctx, w, h) {
      const [r, g, b, a0] = todColor();
      const a = a0 * (SCENES[cur].arena ? 0.6 : 1);
      if (a < 0.01) return;
      ctx.fillStyle = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
      ctx.fillRect(0, 0, w, h);
      if (a > 0.2 && !SCENES[cur].arena) {            // de noche, unas estrellas que parpadean
        ctx.fillStyle = '#ffffff';
        for (const [sx, sy, ph] of STARS) {
          ctx.globalAlpha = (0.25 + 0.5 * Math.abs(Math.sin(t * 1.3 + ph))) * Math.min(1, (a - 0.2) * 8);
          ctx.fillRect(Math.round(sx * w), Math.round(sy * h), 2, 2);
        }
        ctx.globalAlpha = 1;
      }
    }

    // ---------------- cada fotograma ----------------

    function step(dt) {
      t += dt;
      G.World.update(dt, G.Camera);
      G.FX.update(dt);
      G.Weather.tickMenu(dt);
      // Deriva lenta de la cámara.
      G.Camera.x += Math.cos(t * 0.05) * 14 * dt;
      G.Camera.y += Math.sin(t * 0.037) * 10 * dt;
      G.Camera.follow(G.Camera.x, G.Camera.y, dt);

      // Cambio de escena: fundido a negro, cambio y fundido de vuelta.
      sceneT += dt;
      if (!sw && sceneT > SCENE_TIME) sw = { t: 0, done: false };
      if (sw) {
        sw.t += dt;
        if (!sw.done && sw.t >= FADE_HALF) { sw.done = true; applyScene(cur + 1); }
        if (sw.t >= FADE_HALF * 2) sw = null;
      }

      // Eventos de partida (hora dorada, ladrón, horda): de vez en cuando, en el mapa.
      if (goldT > 0) goldT -= dt;
      evT -= dt;
      if (evT <= 0) { evT = G.U.rand(14, 22); startEvent(); }
      for (const tg of tags) tg.t += dt;
      tags = tags.filter(tg => tg.t < 2.4);

      for (let i = wanderers.length - 1; i >= 0; i--) {
        const wd = wanderers[i];
        const hm = wd.home;
        if (goldT > 0 && !wd.temp && !(hm && hm.boss) && Math.random() < dt * 2) {
          G.FX.px(wd.x + G.U.rand(-wd.r, wd.r), wd.y - G.U.rand(0, G.Sprites.bodyHeight(wd.dex, wd.scale)), '#ffd23f', { vy: -34, life: 0.6 });
        }
        if (wd.temp) {
          // Ladrón u horda: cruzan la pantalla y se van.
          wd.life -= dt;
          if (wd.thief && Math.random() < dt * 0.7) wd.vy = G.U.rand(-60, 60);
          wd.x += wd.vx * dt; wd.y += wd.vy * dt;
          G.World.collide(wd);
          wd.anim.dir = G.Sprites.dirFromAngle(Math.atan2(wd.vy, wd.vx));
          wd.anim.loop('Walk', 1.4);
          wd.anim.update(dt);
          if (wd.life <= 0 || (!wd.thief && Math.abs(wd.x - G.Camera.x) > G.Camera.w * 0.5 + 160 && wd.life < 27)) {
            if (wd.thief) G.FX.burst(wd.x, wd.y - 10, '#ffffff', 12, 120);
            wanderers.splice(i, 1);
          }
          continue;
        }
        wd.t -= dt;
        if (wd.t <= 0) {
          // Pasea, se para o "ataca" al aire de vez en cuando.
          wd.t = G.U.rand(1, 3.5);
          const r = Math.random();
          const walk = hm && hm.boss ? 0.35 : 0.55;
          if (r < walk) {
            let a = Math.random() * 6.2832;
            // En la arena no se alejan de su sitio.
            if (hm && Math.hypot(wd.x - hm.x, wd.y - hm.y) > hm.leash) a = Math.atan2(hm.y - wd.y, hm.x - wd.x);
            const s = hm && hm.boss ? G.U.rand(14, 28) : G.U.rand(25, 55);
            wd.vx = Math.cos(a) * s; wd.vy = Math.sin(a) * s;
          } else {
            wd.vx = wd.vy = 0;
            if (r > (hm && hm.boss ? 0.55 : 0.8)) wd.anim.play(G.U.pick(['Attack', 'Shoot', 'Charge']));
          }
        }
        wd.x += wd.vx * dt; wd.y += wd.vy * dt;
        G.World.collide(wd);
        const moving = Math.abs(wd.vx) + Math.abs(wd.vy) > 1;
        if (moving) wd.anim.dir = G.Sprites.dirFromAngle(Math.atan2(wd.vy, wd.vx));
        else if (hm && hm.target) wd.anim.dir = G.Sprites.dirFromAngle(Math.atan2(hm.target.y - wd.y, hm.target.x - wd.x));
        else if (hm && hm.boss) wd.anim.dir = G.Sprites.dirFromAngle(Math.PI / 2);   // el legendario mira a su equipo
        wd.anim.loop(moving ? 'Walk' : 'Idle');
        wd.anim.update(dt);
        // Si se queda fuera de cámara, reaparece dentro.
        if (!G.Camera.sees(wd.x, wd.y, 120)) Object.assign(wd, spawn(wd.m, hm));
      }
    }

    function drawTags(ctx) {
      ctx.font = FONT; ctx.textAlign = 'center';
      for (const tg of tags) {
        const k = tg.t / 2.4;
        ctx.globalAlpha = k < 0.8 ? 1 : (1 - k) / 0.2;
        const y = Math.round(tg.y - tg.t * 8);
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,8,24,.85)'; ctx.strokeText(tg.text, Math.round(tg.x), y);
        ctx.fillStyle = tg.col; ctx.fillText(tg.text, Math.round(tg.x), y);
      }
      ctx.globalAlpha = 1;
    }

    function render(ctx, w, h, dpr, dt) {
      if (!ready) return;
      step(dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.scale(G.Camera.scale, G.Camera.scale);
      G.Camera.apply(ctx);
      drawScene(G.Camera, wanderers);
      G.FX.draw(ctx);
      drawTags(ctx);
      ctx.restore();
      drawTod(ctx, w, h);
      G.Weather.draw(ctx, w, h, dt);
      G.World.drawVignette(ctx, w, h);
      drawThiefLayer(w, h, dpr);
      if (banner) {
        banner.t += dt;
        const k = banner.t < 0.4 ? banner.t / 0.4 : banner.t > 3.6 ? Math.max(0, (4 - banner.t) / 0.4) : 1;
        if (banner.t > 4) banner = null;
        else {
          ctx.save();
          ctx.globalAlpha = k;
          ctx.font = '800 15px Pixelify,"Segoe UI",system-ui,sans-serif';
          ctx.textAlign = 'center';
          const tw = ctx.measureText(banner.text).width + 28, bx = w / 2 - tw / 2, by = h - 70;
          ctx.fillStyle = 'rgba(8,6,22,.62)'; ctx.fillRect(Math.round(bx), by, Math.round(tw), 28);
          ctx.fillStyle = banner.col; ctx.fillText(banner.text, w / 2, by + 19);
          ctx.restore();
        }
      }
      if (sw) {
        const k = sw.t < FADE_HALF ? sw.t / FADE_HALF : 1 - (sw.t - FADE_HALF) / FADE_HALF;
        ctx.save();
        ctx.globalAlpha = G.U.clamp(k, 0, 1);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
    }

    /** Al volver de una run, recupera el mundo del menú. */
    function restore() {
      sw = null;
      applyScene(cur);
    }

    /** Para pruebas: { hour, scene, event: 'gold' | 'thief' | 'horde' | 'weather:rain' } */
    function debug(o = {}) {
      if (o.hour !== undefined) hourOv = o.hour;
      if (o.scene !== undefined) applyScene(o.scene);
      if (o.event === 'gold') { goldT = 14; say('Gold Hour', '#ffd23f'); }
      else if (o.event === 'thief') spawnThief();
      else if (o.event === 'horde') spawnHorde();
      else if (o.event && o.event.startsWith('weather:')) { G.Weather.showcase(o.event.slice(8), 30); say(WX_NAME[o.event.slice(8)], '#9fd8ff'); }
      return { wanderers: wanderers.map(w => ({ dex: w.dex, x: w.x, y: w.y, label: w.m && w.m.label, temp: !!w.temp })), scene: cur };
    }

    return { init, render, restore, tap, debug };
  })();

  return {
    /** Aegislash event: everyone rolls their own 3 items to choose from (or skip). */
    armoury() { if (pl) offerItem(G.Items.rollMany(3, pl.item)); },       // downed players pick too (they keep it if revived)
    init, startRun, everyone, levelXp, flash, offerBond,
    /** Para pruebas: salta el reloj de la run. */
    debugTime(t) { tampered = true; time = t; },
    /** Para grabar vídeos: cámara lenta (0,5 = mitad de velocidad). */
    debugSpeed(k) { if (k > 1) tampered = true; speedK = k; },
    togglePause,
    /** Zygarde Portal lost: the run ends for everyone (the host ends it for the group). */
    failRun() {
      if (state === 'over' || !pl) return;
      if (G.Coop.active) { if (!G.Coop.isHost) return; G.Coop.over(summary()); }
      endRun(true);
    },
    /** Abandona la partida en curso (p. ej. al cerrar sesión desde Ajustes). */
    quit() { if (state !== 'ui' && state !== 'over') quitRun(); },
    /** Para grabar vídeos: abre las cartas de subir de nivel. */
    debugLevelUp() { tampered = true; pl.level++; pendingLevels++; },
    toUI() { state = 'ui'; Backdrop.restore(); },
    /** Para pruebas: controla el fondo del menú. */
    debugBackdrop(o) { return Backdrop.debug(o); },
    /** Grupo: los OTROS jugadores que están eligiendo (vínculo u objeto) y tienen la partida parada. */
    get waitingChoosers() {
      const me = G.Social.me && G.Social.me.name;
      return holdBy.filter(n => n !== me && n !== 'Tú');
    },
    /** Caído en grupo: a quién miras ({ name, color, index, count }) o null. */
    get spectating() {
      const m = spectated();
      if (!m) return null;
      const list = specList();
      return { name: m.name, color: m.color, index: list.indexOf(m) + 1, count: list.length };
    },
    cycleSpectate,
    get state() { return state; }, get player() { return pl; }, st
  };
})();

/* ============ Flow — transiciones entre pantallas ============ */
G.Flow = {
  boot() {
    G.UI.initChrome();
    G.LoginUI.init(); G.TestUI.init(); G.MenuUI.init(); G.GachaUI.init();
    G.SocialUI.init(); G.RankingUI.init(); G.ModUI.init(); G.GoalsUI.init(); G.ProfileUI.init(); G.SettingsUI.init(); G.SupportUI.init(); G.NewsUI.init(); G.Updater.init();
    // Tu nombre arriba a la derecha abre tu perfil.
    document.getElementById('user-pill').onclick = () => G.GoalsUI.open('profile');
    G.Audio.music('village');     // suena tras el primer clic (lo exige el navegador)
    G.Game.init();
    // La base de datos (nube o local) recupera la sesión anterior.
    G.DB.ready().then(restored => {
      document.getElementById('boot').classList.add('hidden');
      // En otra tarea: crear el sonido para comprobarlo cuesta ~60 ms y no debe bloquear la carga.
      setTimeout(() => this.tapToStart(() => { if (restored) this.afterLogin(); else this.toLogin(); }), 0);
    });
  },
  /**
   * "Pulsa para empezar": los navegadores no dejan que una web suene hasta
   * que se toca algo. Con esta pantalla la música empieza en cuanto entras.
   * (Si el navegador ya deja sonar, no sale.)
   */
  tapToStart(then) {
    G.Audio.unlock();
    if (G.Audio.canPlay()) { then(); return; }
    const el = document.getElementById('tap-start');
    el.classList.remove('hidden');
    const go = e => {
      if (e.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) return;
      e.preventDefault(); e.stopPropagation();
      G.Audio.unlock();
      el.classList.add('hidden');
      el.removeEventListener('click', go); removeEventListener('keydown', go, true);
      then();
    };
    el.addEventListener('click', go);
    addEventListener('keydown', go, true);
  },
  toLogin() { G.Audio.music('village'); G.LoginUI.open(); },
  afterLogin() {
    G.Audio.music('village');
    if (!G.DB.save.partner) G.TestUI.start();
    else this.goMenu();
  },
  goMenu() {
    if (G.Game.state !== 'ui') G.Game.toUI();
    G.Audio.music('village');
    G.MenuUI.open();
    G.LoginUI.offerRecovery();
  },
  /** Al cerrar el resumen: a la sala si sigues en una, si no al menú. */
  afterRun() {
    if (G.Social.room) {
      if (G.Game.state !== 'ui') G.Game.toUI();
      G.Audio.music('village');
      if (G.Social.room.isHost) G.Social.setOpen(true);
      G.LobbyUI.open();
    } else this.goMenu();
  },
  play() { G.Game.startRun(); },
  /** Empieza la partida en grupo (el anfitrión la manda a todos). */
  startCoop(cfg) {
    if (G.Game.state !== 'ui' || !G.Social.room) return;
    G.LobbyUI.close();
    G.Game.startRun(cfg);
  }
};
