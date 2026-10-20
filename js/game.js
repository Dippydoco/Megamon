/* ============ game.js — game flow and main loop ============
 *
 *   login ──> personality test ──> menu ──> run ──> summary ──> menu
 *                (first time only)    │
 *                                     ├─ Pokémon (collection)
 *                                     ├─ Upgrades
 *                                     └─ Gacha
 *
 * Loop states: 'ui' (menus, with the world in the background), 'playing',
 * 'levelup', 'paused', 'over'.
 *
 * Co-op (G.Coop.active): the host runs enemies, objects and
 * experience; each player their own Pokémon. Pausing doesn't stop the game, the level
 * cards wait for everyone to choose and a fallen teammate gets up if another
 * stays next to them. See net/coop.js.
 */
G.Game = (() => {
  let cv, ctx, dpr = 1, w = 0, h = 0;
  let state = 'ui';
  let time = 0, last = 0, pendingLevels = 0;
  let pl = null;
  let caught = [];          // shinies caught this run
  let biome = -1;

  const st = { get time() { return time; } };

  // ---------------- startup ----------------

  function init() {
    cv = document.getElementById('game');
    ctx = cv.getContext('2d');
    resize();
    addEventListener('resize', resize);
    G.Touch.init(cv);
    // On mobile: when switching apps or rotating to portrait, the run pauses.
    document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
    G.RunUI.wirePause(() => { if (!G.Coop.active) state = 'playing'; G.UI.hideAll(); }, quitRun);
    Backdrop.init();
    last = performance.now();
    requestAnimationFrame(loop);
  }

  function resize() {
    // Internal resolution ×1.5 at most: on ×2 screens drawing twice the
    // pixels was one of the most expensive things, and with pixel art it doesn't show.
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    w = cv.clientWidth; h = cv.clientHeight;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    G.Camera.resize(w, h, dpr);
    checkOrientation();
  }

  /** Phone in portrait: a notice to rotate it (and pause). */
  function checkOrientation() {
    const portrait = G.Touch.active && innerHeight > innerWidth;
    const el = document.getElementById('rotate');
    if (!el) return;
    if (portrait && !document.getElementById('rotate-ico').innerHTML) document.getElementById('rotate-ico').innerHTML = G.Icons.html('phone', 48);
    el.classList.toggle('hidden', !portrait);
    if (portrait) autoPause();
  }

  /** Pauses on its own (solo only: in a group the others carry on). */
  function autoPause() {
    G.Touch.reset();
    if (state === 'playing' && !G.Coop.active) { state = 'paused'; G.RunUI.showPause(); }
  }

  /** Pause/resume (Esc or P key, or the mobile pause button). */
  let holdBy = [];                   // group: who is choosing a fusion (everything paused)

  function togglePause() {
    // In a group the menu pauses the game for everyone while it's open (pauseSync holds / releases the group).
    if (G.Coop.active) {
      if (G.UI.isOpen('scr-pause')) { G.UI.hide('scr-pause'); return; }
      if (state !== 'playing') return;
      G.RunUI.showPause(true); G.Audio.sfx('pause');
      return;
    }
    if (state === 'playing') { state = 'paused'; G.RunUI.showPause(); G.Audio.sfx('pause'); }
    else if (state === 'paused') { state = 'playing'; G.UI.hideAll(); }
  }

  // ---------------- run ----------------

  /** @param coop  { seed, host, members } for a group run */
  function startRun(coop = null) {
    holdBy = []; awayBy = null;
    openItem = null; laterItems.length = 0;      // nothing left over from the last run's choice screens
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
    // Shortcuts: moves with a fixed slot (save.pbind[dex] = [id of 1, id of 2, ...]),
    // before learning anything: addMove already places them.
    (save.pbind && save.pbind[mon.dex] || []).forEach((id, i) => { if (id) pl.bind[id] = i; });
    pl.addMove(G.startMoveOf(mon.dex));
    // "Veto" upgrade: moves you don't want to come up.
    pl.banned = new Set((save.pban && save.pban[mon.dex] || []).slice(0, perks.bans));
    // "Repertoire" upgrade: a second random attacking move.
    if (perks.startMoves >= 2) {
      const pool = G.Moves.poolFor(mon).filter(id => !pl.hasMove(id) && !pl.banned.has(id) && G.Moves.BY_ID[id].kind !== 'buff');
      if (pool.length) pl.addMove(G.U.pick(pool));
      pl.setActive(0);
    }
    G.RunLog.start(pl);          // run details for balancing (added to the history entry at the end)

    teamStats.clear();
    if (coop) {
      hookStats();
      G.Coop.begin(coop, pl, coopApi);
      G.Social.setPlaying(true);
    }
    G.Camera.x = pl.x; G.Camera.y = pl.y; G.Camera.shake = 0;
    // Local sprite sheets: the partner and the first enemies.
    G.Sprites.preload([mon.dex], 8000, pl.shiny);
    G.Audio.music(G.BIOME_MUSIC[0]);
    // For the leaderboard: the server records when the run starts (anti-cheat).
    if (!coop || G.Coop.isHost) G.Ranking.runStarted(coop ? 'g' : 's');
    deathT = 0;

    state = 'playing';
  }

  function quitRun() {
    if (G.Coop.active) G.Coop.leave();
    endRun(false);
  }

  /** All the players in the run (you first). */
  function everyone() { return G.Coop.active ? G.Coop.players() : [pl]; }

  /** Experience needed for the next level (locked chests). */
  function levelXp() {
    if (!pl) return 20;
    const k = (G.Coop.active ? G.Coop.xpFactor() : 1) * (pl.xpMul || 1);
    return Math.ceil((pl.xpNext - pl.xp + 1) / k);
  }

  // Full-screen flash (trip to the rift).
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

  /** What co-op needs from the game. */
  /**
   * Tickets picked up are saved as soon as you get them (like shinies):
   * previously only at the end, and if the tab closed suddenly they were lost.
   * `banked` = this run's tickets that are already in the save.
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
    // Guest: the host sends the clock and the team's data.
    syncTeam(t) {
      if (Math.abs(t.time - time) > 0.4) time = t.time;
      if (t.level > pl.level) G.Audio.sfx('xp');
      const cap = G.RARITY_GROWTH_CAP || 30, gain = Math.min(t.level, cap) - Math.min(pl.level, cap);
      if (gain > 0 && pl.growth) pl.addMaxHp(pl.mon.hp * pl.growth * gain);   // low-rarity growth (up to the cap level)
      pl.level = t.level; pl.xp = t.xp; pl.xpNext = t.xpNext;
      pl.kills = t.kills; pl.bosses = t.bosses; pl.coins = t.coins;
      if (t.t1 > pl.t1 || t.t10 > pl.t10) G.Audio.sfx('shiny');
      pl.t1 = t.t1 || 0; pl.t10 = t.t10 || 0;
      bankTickets();
    },
    levelStart(level) {
      // (If you had the item choice open, it comes back when finished: afterLevelUp.)
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
    /** Are you choosing something that pauses the run (item or bond)? */
    choosing() { return state === 'choice'; },
    inLevelUp() { return state === 'levelup'; },
    shiny(dex) { G.onShinyCaught({ dex, name: (G.DEX_BY[dex] || {}).name || '' }); },
    over(d) {
      if (d) Object.assign(pl, { kills: d.ki, bosses: d.bo, coins: d.co, level: Math.max(pl.level, d.lv || 1), t1: d.t1 || pl.t1, t10: d.t10 || pl.t10 });
      if (d && d.t) time = d.t;
      if (d && d.why === 'host') G.UI.toast('The host has ended the game', 3200);
      endRun(!(d && d.why === 'host'));
    },
    lost(msg) { G.UI.toast(msg, 3600); endRun(false); },
    item(id) { offerItem(id); },
    /** Aegislash event: everyone rolls their own 3 items to choose from (or skip). */
    armoury() { if (pl) offerItem(G.Items.rollMany(3, pl.item)); },       // downed players pick too (they keep it if revived)
    tutor() { if (pl) offerItem({ tutor: tutorMoves(pl) }); },             // Spiritomb: each player gets their own 3 moves
    mateLeft() {},
    /** Group: who is choosing a fusion. While anyone is, everything is paused. */
    hold(names) {
      holdBy = names || [];
      const mine = G.UI.isOpen('scr-bond');
      if (holdBy.length) {
        if (state === 'playing') state = 'held';
        if (pl && pl.bonds > 0) offerBond(true);      // if you have a bond too, you choose at the same time
        // Who is choosing is now shown by the HUD's fixed banner (waitingChoosers);
        // here only an old notice is cleared (or the "waiting for the host" one is kept).
        G.Spawner.say(awayBy ? awayText() : '', awayBy ? 999 : 0, true);
      } else {
        if (state === 'held' && !awayBy) state = 'playing';
        G.Spawner.say(awayBy ? awayText() : '', awayBy ? 999 : 0, true);
      }
    },
    /** Group (guest): the host has left the tab or isn't responding: everything paused. */
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
  const awayText = () => 'Paused: waiting for ' + awayBy + ' (host)…';

  /** You've brought a lost Pokémon home and it joins you (events.js). */
  G.onRescue = (dex, name) => {
    if (!G.DB.save || !pl) return;
    const isNew = !G.DB.owns(dex);
    if (isNew) { G.DB.grant(dex, 'rescue'); G.DB.commit(true); }
    else pl.coins += 150;
    G.Spawner.say(isNew ? name + ' joins your team!' : name + ' thanks you! (+150 coins, you already had it)', 4);
    G.Audio.sfx('shinyGet');
  };

  /** A wild shiny falls: you keep it (and the normal version if you didn't have it). */
  G.onShinyCaught = e => {
    if (!G.DB.save || !pl) return;
    if (G.Coop.isHost) G.Coop.shinyCaught(e);
    const isNew = G.DB.grantShiny(e.dex, 'wild');
    G.DB.save.stats.shinies++;
    G.DB.commit(true);
    caught.push({ dex: e.dex, isNew });
    G.Spawner.say(isNew ? 'You got a shiny ' + e.name + '!' : 'Another shiny ' + e.name + '! (+300 coins)', 4);
    if (!isNew) pl.coins += 300;
    G.Audio.sfx('shinyGet');
  };

  function endRun(dead = true) {
    if (state === 'over' || !pl) return;
    const coop = !!pl.uid;                    // only group runs give it a uid
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
      time: Math.floor(time / 5),
      defeated: Math.floor(pl.kills * 0.25),
      bosses: pl.bosses * 80,
      collected: pl.coins
    };
    // Daily featured Pokémon (systems/featured.js): +50% PokéCoins.
    const feat = G.Featured && G.Featured.is(pl.dex) ? G.Featured.BONUS : 1;
    const coins = Math.round((parts.time + parts.defeated + parts.bosses + parts.collected) * mul * feat);
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
    // Runs that were left (quit, or the group ended under you) aren't recorded, so they don't take up slots
    // (20-10-2026). Runs that reached Arceus are always kept (their star count comes from the history).
    const runLog = G.RunLog.finish(pl, { dead, judged: !!judge && dead, fail: portalLost, team: coop ? team.length : 1 });
    if (dead || portalLost || judge) G.DB.addHistory({
      id: Date.now(), d: pl.dex, sh: pl.shiny ? 1 : 0, t: Math.floor(time), lv: pl.level, k: pl.kills, b: pl.bosses, c: coins,
      dd: mine.d, dt: mine.t, m: pl.moves.map(m => [m.id, m.lvl]), it: pl.item || '', x: dead ? 1 : 0, g: coop ? 1 : 0,
      mt: team.filter(m => m.uid !== pl.uid).map(m => [m.name, m.dex, m.shiny ? 1 : 0]),
      ar: judge ? [Math.floor(judge.time), judge.bosses] : 0,
      kb: dead && pl.killer ? pl.killer : 0,
      z: runLog
    });
    portalLost = false;
    if (judge) G.Progress.event('judgeEnd', judge);
    G.Judgment.reset();
    G.Progress.event('runEnd', { time, level: pl.level, coins: pl.coins, types: pl.mon.types, group: coop });
    G.Progress.checkAch();
    // To the cloud at the end of the run (at most every 30 min); if the record gets
    // into a top (today, week or month), straight away (below, after uploading it to the leaderboard).
    G.DB.commit('run');
    if (G.Social.me) {
      try { G.Social.publishProfile(); } catch (e) { console.warn(e); }
      try { G.Social.publishHistory(); } catch (e) { console.warn(e); }
    }

    // Leaderboard: in solo each player their own; in a group the host uploads it.
    const mark = { t: Math.floor(time), lv: pl.level, kills: pl.kills };
    // If the run has been tampered with (see clean()), it isn't uploaded to the leaderboard (silently); everything else is.
    const ok = clean();
    const sent = ok && !coop ? G.Ranking.submitSolo(Object.assign(mark, { dex: pl.dex, shiny: pl.shiny }))
               : ok && wasHost ? G.Ranking.submitGroup(Object.assign(mark, { members: team })) : null;
    if (sent) sent.then(b => { if (b && b.some(p => p !== 'a')) G.DB.commit(true); }).catch(() => {});

    G.RunUI.showOver({
      dead, killer: dead && pl.killer ? pl.killer : null, recent: dead && pl.hits ? pl.hits.slice(-4) : [],
      time, level: pl.level, kills: pl.kills, bosses: pl.bosses, coins, record, t1: pl.t1, t10: pl.t10, judge,
      moves: pl.moves, caught, mine, team: () => [...teamStats.values()], order: team.map(m => m.uid),
      breakdown: Object.entries(parts).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(' · ') +
                 (mul > 1 ? ` · ×${mul.toFixed(2)} Fortune` : '') + (feat > 1 ? ` · ×${feat} Featured Pokémon` : '')
    }, () => { pl = null; G.Flow.afterRun(); });
  }

  /*
   * Clean run? Only things no legitimate player can do, with
   * huge margins (the system from 10-10 gave false positives):
   *   - the run's clock goes faster than real time (speed hacks)
   *   - your Pokémon's functions replaced (that's how someone makes themselves invincible)
   *   - health, attack, speed or cooldown far above what's possible
   *   - the test functions have been used (skipping the clock...)
   * If something trips, that run isn't uploaded to the leaderboard (silently) and that's all.
   */
  let runReal = 0, tampered = false;
  let portalLost = false;          // the run ended by losing the Zygarde Portal (run details: end 'p')
  function clean() {
    if (tampered) return false;
    if (time > (performance.now() - runReal) / 1000 + 10) return false;
    for (const k of ['hurt', 'update', 'heal', 'gainXp']) if (Object.prototype.hasOwnProperty.call(pl, k)) return false;
    if (!isFinite(pl.hp) || !isFinite(pl.maxHp) || pl.hp > pl.maxHp + 1 || pl.maxHp > 50000) return false;
    if (pl.atkMul > 2000 || pl.spdMul > 25 || pl.cdMul < 0.03 || pl.level > 20 + time / 3) return false;
    return true;
  }

  // ---------------- level-up ----------------

  function maybeLevelUp() {
    if (pendingLevels <= 0 || state !== 'playing') return;
    if (G.Coop.active) {
      // In a group, the cards appear for everyone at once and it waits for them to choose.
      if (G.Coop.players().every(p => p.dead)) return;
      pendingLevels--;
      G.Coop.levelStart(pl.level);
      return;
    }
    // Never open cards with the Pokémon down (dying and picking up XP on the same frame).
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

  // ---------------- bonds ----------------

  /**
   * A legendary's bond: you choose which moves are fused.
   * If it can't be done right now (there aren't two loose ones), it's kept until you learn
   * another move. It's checked every frame: if another screen covers it (level
   * cards in a group, pause), it comes back when that closes.
   * @param quiet  don't announce if it can't be done yet
   */
  function offerBond(quiet = false) {
    if (!pl || pl.bonds <= 0 || pl.dead || (state !== 'playing' && state !== 'held') || G.Rift.inArena) return;
    if (['scr-bond', 'scr-pause', 'scr-item', 'scr-levelup'].some(G.UI.isOpen)) return;
    const opt = pl.bondOptions();
    if (!opt) {
      if (!quiet) G.Spawner.say('Bond saved: learn another move to use it', 3, true);
      return;
    }
    // The game pauses; in a group, for everyone until each one chooses (G.Coop.holdStart).
    state = 'choice';
    if (G.Coop.active) G.Coop.holdStart();
    G.Audio.sfx('levelup');
    G.RunUI.showBond(opt, picked => {
      const group = pl.fuse(picked, opt.group);
      G.Audio.sfx('legend');
      G.FX.ring(pl.x, pl.y, 8, 130, '#ff8ad8', 0.8, 6);
      G.FX.burst(pl.x, pl.y - pl.bodyH * 0.5, '#ffb3e6', 40, 240);
      G.Spawner.say('Bond! ' + group.length + ' moves at once', 2.6, true);
      if (state === 'choice') state = holdBy.length ? 'held' : 'playing';
      if (G.Coop.active) G.Coop.holdEnd();
      afterLevelUp();                       // items that arrived while the Bond screen was open
    });
  }

  // ---------------- recogida ----------------

  const PICK_SFX = { xp: 'xp', xpBig: 'xp', coin: 'coin', heal: 'heal', bomb: 'break', stopwatch: 'confirm', magnet: 'confirm', ticket: 'shiny', ticket10: 'legend', item: 'legend' };

  /*
   * Co-op: the item choice and the level cards can't cover each other.
   * If an item arrives with the cards open, it waits for you to choose a card; and if
   * the cards arrive with the item choice open, it comes back when
   * finished. (Previously one closed the other, nobody could finish choosing and the
   * run stayed paused for everyone.)
   */
  let openItem = null;           // { cur, next, take } unfinished item choice
  const laterItems = [];         // items picked up with the level cards open
  function afterLevelUp() {
    if (state !== 'playing' && state !== 'held') return;
    if (openItem && !G.UI.isOpen('scr-item')) {
      const o = openItem;
      if (o.mine) { state = 'choice'; if (G.Coop.active) G.Coop.holdStart(); }
      if (o.band) G.RunUI.showMoveChoice(pl, o.pick);              // Choice Band: which move to lock into
      else if (o.tutor) G.RunUI.showTutor(pl, o.tutor, o.take);   // Spiritomb's moves
      else if (o.tutorForget) G.RunUI.showTutorForget(pl, o.tutorForget, o.forget);
      else if (o.list) G.RunUI.showArmoury(o.cur, o.list, o.take); else G.RunUI.showItemChoice(o.cur, o.next, o.take);
      return;
    }
    if (laterItems.length) offerItem(laterItems.shift());
  }

  /**
   * Spiritomb's offer: 3 moves from OUTSIDE this Pokémon's pool (other types), each of a different type,
   * favouring ones that suit its Attack / Sp. Atk. No signature moves, nothing it has or has banned.
   */
  function tutorMoves(p) {
    const own = new Set(G.Moves.poolFor(p.mon));
    const lean = p.mon.lean;
    const bursts = p.moves.filter(m => m.kind === 'burst').length, noBurst = bursts >= 2 || p.moves.length < 2;
    let cand = G.Moves.ALL.filter(m => !m.sig && !own.has(m.id) && !p.hasMove(m.id) && !(p.banned && p.banned.has(m.id))
                                  && !(noBurst && m.kind === 'burst'));
    const out = [], types = new Set();
    while (out.length < 3 && cand.length) {
      const w = cand.map(m => (m.kind === 'buff' || m.kind === 'burst' ? 0.4 : 1) * (!m.cat || !lean || lean === 'mixed' ? 1 : m.cat === lean ? 1.6 : 0.5)
                              * (types.has(m.type) ? 0.05 : 1));
      let r = Math.random() * w.reduce((s, x) => s + x, 0), i = 0;
      while (i < cand.length - 1 && (r -= w[i]) > 0) i++;
      out.push(cand[i].id); types.add(cand[i].type);
      cand = cand.filter((_, j) => j !== i);
    }
    return out;
  }

  /** Learns a tutored move; with every slot full it takes the place of `forget` (a move instance, bond included). */
  function learnTutored(id, forget) {
    const name = G.Moves.BY_ID[id].name;
    if (forget) {
      const m = G.Moves.instance(id, 1);
      pl.moves[pl.moves.indexOf(forget)] = m;
      const g = pl.slots.find(s => s.includes(forget));
      if (g) g[g.indexOf(forget)] = m;
      if (G.Projectiles.clearOrbs) G.Projectiles.clearOrbs(pl);
    } else if (!pl.addMove(id)) return;
    G.Spawner.say(pl.mon.name + ' learned ' + name + '!', 2.6, true);
    G.Audio.sfx('confirm');
  }

  /** You picked up an item: if you aren't holding one you put it on; if you are, you choose. */
  function offerItem(id) {
    const tut = id && id.tutor ? id.tutor.filter(x => G.Moves.BY_ID[x]) : null;    // Spiritomb: moves, not items
    const list = Array.isArray(id) ? id.filter(x => G.Items.BY[x]) : null;      // Aegislash Armoury: several to choose from
    if (!pl || (tut ? !tut.length : list ? !list.length : !G.Items.BY[id])) return;
    if (state === 'levelup' || G.UI.isOpen('scr-levelup') || G.UI.isOpen('scr-bond')) { laterItems.push(id); return; }
    // Another item choice (or the Choice Band move pick) is already open: this one waits its turn.
    // (Zygarde drops 3 items that are all pulled in at once: the third used to replace the second's screen,
    // the game forgot which choice had paused it, and after picking it stayed paused for good.)
    if (openItem || state === 'choice' || G.UI.isOpen('scr-item')) { laterItems.push(id); return; }
    let mine = false;            // this choice is the one that paused the game
    const take = got => {
      openItem = null;
      if (got && got !== pl.item) {
        pl.equip(got);
        G.Spawner.say("You're holding " + G.Items.BY[got].name + '!', 2.6, true);
        G.Progress.event('item', { id: got });
        // Choice Band locks you into one move: pick which one now, before the game goes on.
        if (got === 'choiceband' && pl.slots.length > 1) {
          if (!mine && !pl.dead && (state === 'playing' || state === 'held')) {
            mine = true; state = 'choice';
            if (G.Coop.active) G.Coop.holdStart();
          }
          // Remembered in openItem like the item choice: in co-op the level-up cards can arrive while this is open
          // and replace it; afterLevelUp() shows it again. (Before, it was lost and the band locked whatever move
          // was active, most often with Repertoire, which gives you 2 moves while level-ups are still very fast.)
          const pick = i => {
            openItem = null;
            if (i !== pl.active) { pl.active = i; G.Projectiles.clearOrbs(pl); }
            G.Audio.sfx('confirm');
            finish();
          };
          openItem = { band: true, pick, get mine() { return mine; } };
          G.RunUI.showMoveChoice(pl, pick);
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
    if (tut) {
      if ((state === 'playing' || state === 'held') && !pl.dead) {
        mine = true;
        state = 'choice';
        if (G.Coop.active) G.Coop.holdStart();
      }
      // Pick a move; with every slot full, then which move it replaces (backing out of that = skip).
      const pickMove = got => {
        openItem = null;
        if (got && !pl.hasMove(got)) {
          if (pl.slots.length < pl.maxMoves) learnTutored(got);
          else {
            const forget = m => { openItem = null; if (m) learnTutored(got, m); finish(); };
            openItem = { tutorForget: got, forget, get mine() { return mine; } };
            G.RunUI.showTutorForget(pl, got, forget);
            return;
          }
        }
        finish();
      };
      openItem = { tutor: tut, take: pickMove, get mine() { return mine; } };
      G.RunUI.showTutor(pl, tut, pickMove);
      return;
    }
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
    // For now the Life Orb isn't put on automatically: if it's the first thing you find, you choose to accept or discard it.
    if (!pl.item && id !== 'lifeorb') { take(id); return; }
    if (pl.item === id) { G.Spawner.say('You already hold ' + G.Items.BY[id].name, 2, true); return; }
    // The game pauses while you choose; in a group, for everyone (as with
    // fusions). Previously in a group it carried on and you got hit while choosing.
    if (state === 'playing' || state === 'held') {
      mine = true;
      state = 'choice';
      if (G.Coop.active) G.Coop.holdStart();
    }
    openItem = { cur: pl.item || null, next: id, take, get mine() { return mine; } };
    G.RunUI.showItemChoice(pl.item || null, id, take);
  }

  /** @param who  whoever picked it up (in co-op it can be a teammate) */
  function onCollect(p, who = pl) {
    const mine = who === pl;
    if (G.Coop.active && !G.Coop.isHost) {
      // Copy of an object from the host: they decide the effect.
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
      G.FX.dmgText(who.x, who.y - who.bodyH - 8, p.kind === 'ticket' ? '+1 ticket' : 'Ticket ×10!', p.kind === 'ticket' ? '#ffd23f' : '#d9a6ff', true);
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
    // Arceus's Judgment: Space, Enter or Esc skip the animation (if allowed).
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
      // Esc on a menu sub-screen goes back to the menu.
      if (G.Input.tap('escape') && !G.UI.isOpen('scr-profile') && ['scr-dex', 'scr-upgrades', 'scr-gacha', 'scr-friends', 'scr-rank', 'scr-goals'].some(G.UI.isOpen)
          && document.getElementById('pull-fx').classList.contains('hidden')) G.MenuUI.open();
      return;
    }
    if (G.Input.tap('escape') || G.Input.tap('keyp')) { togglePause(); return; }
    if (state !== 'playing' || !pl) return;
    // Down in a group: Q / E (or arrows, or Tab) change who you're watching.
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
  // The next frame is requested BEFORE anything else: if something fails halfway, the
  // game carries on (previously it froze forever and you had to reload;
  // that's how a huge run was lost when a rift opened).
  // If it fails frame after frame (the game no longer advances or shows), the
  // run is treated as over after ~3 s and saved: time, defeated,
  // records and leaderboard. Better that than a black screen and losing everything.
  let loopErrs = 0, errRun = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    try { frame(ts); errRun = 0; }
    catch (e) {
      if (loopErrs++ < 5) console.error('[Game] frame failed:', e);
      G.Input.endFrame();
      if (++errRun === 180 && pl && state !== 'ui' && state !== 'over') {
        try {
          G.UI.hideAll();
          quitRun();
          G.UI.toast('The game crashed: your run has been saved up to this point', 5000);
        } catch (e2) { console.error('[Game] could not close the run:', e2); }
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
    choiceFailsafe(Math.min(1 / 30, real));
    choiceTimeout(real);

    if (state === 'playing') update(dt);
    else if (pl && state !== 'ui') { G.FX.update(dt * 0.25); pl.anim.update(dt * 0.25); }
    // The network is always serviced (also with the level cards open).
    if (G.Coop.active && pl && state !== 'ui' && state !== 'over') G.Coop.tick(dt);

    if (pl && state !== 'ui') render(); else Backdrop.render(ctx, w, h, dpr, dt);
    G.UI.tick(dt);

    G.Input.endFrame();
  }

  /**
   * Failsafe (every frame, solo and co-op): paused "choosing" but no choice screen is open (another screen
   * replaced it, or the choice that paused the game was lost) -> after half a second, carry on instead of
   * staying frozen for good (in co-op it froze the whole group). It used to sit inside update(), which
   * never runs while choosing, so it could not fire.
   */
  /** Group: while your pause menu is open the whole group is held (like choosing a bond); released when it closes. */
  let pauseHeld = false;
  function pauseSync() {
    const want = G.Coop.active && state !== 'over' && G.UI.isOpen('scr-pause');
    if (want === pauseHeld) return;
    pauseHeld = want;
    if (!want && !G.Coop.active) return;       // the group is already gone (run over): nothing to release
    if (want) G.Coop.holdStart(); else G.Coop.holdEnd();
  }

  /*
   * Group run, host only: a choice screen left open for 2 minutes is decided for you (first level card; skip /
   * keep for item and move offers; the first move for a bond), as guests in that case are removed (coop.js).
   */
  let choiceOpenT = 0;
  function choiceTimeout(real) {
    const open = ['scr-levelup', 'scr-item', 'scr-bond'].find(G.UI.isOpen);
    if (!G.Coop.active || !G.Coop.isHost || !open || (state !== 'levelup' && state !== 'choice')) { choiceOpenT = 0; return; }
    choiceOpenT += Math.min(real, 1);
    if (choiceOpenT < 120) return;
    choiceOpenT = 0;
    console.warn('[Game] choice left open for 2 minutes in a group: deciding it');
    G.Spawner.say('You took over 2 minutes to choose, so it was picked for you', 3, true);
    if (open === 'scr-levelup') { const c = document.querySelector('#cards .card'); if (c) c.click(); }
    else if (open === 'scr-item') { const cs = document.querySelectorAll('#item-cards .card'); if (cs.length) cs[cs.length - 1].click(); }
    else G.RunUI.pickBond(0);
  }

  let lostChoiceT = 0;
  function choiceFailsafe(real) {
    pauseSync();
    if (state !== 'choice' || ['scr-bond', 'scr-item', 'scr-mod', 'scr-levelup'].some(G.UI.isOpen)) { lostChoiceT = 0; return; }
    lostChoiceT += real;
    if (lostChoiceT < 0.5) return;
    lostChoiceT = 0;
    console.warn('[Game] paused for a choice with no choice screen open: carrying on');
    state = holdBy.length ? 'held' : 'playing';
    if (G.Coop.active) G.Coop.holdEnd();
    afterLevelUp();             // anything still waiting (another item, the Choice Band pick) comes up now
  }

  function update(dt) {
    const coop = G.Coop.active;
    // Arceus's Judgment: while the animation lasts, everything else stops.
    if (G.Judgment.cinematic) {
      G.Judgment.cineTick(dt);
      pl.anim.update(dt);
      if (coop) for (const p of G.Coop.puppets()) p.netUpdate(dt);
      G.World.update(dt, G.Camera);
      G.FX.update(dt);
      G.Audio.music(G.Judgment.music);
      return;
    }
    // After falling, let the Faint animation be seen before the summary.
    // (Not in the rift arena: there, falling just sends you back.)
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
    G.RunLog.tick(pl, time);

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

  // ---------------- spectator (down in a group) ----------------
  // While you're down, the camera follows a living teammate; Q / E (or the on-screen
  // buttons) move to the previous / next. When you get up it comes back to you on its own.
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

  /** Down in a group: a teammate next to you gradually revives you. */
  function reviveTick(dt) {
    let helper = null, best = 56 * 56;
    for (const p of G.Coop.puppets()) {
      const d2 = p.dead ? Infinity : G.U.dist2(p.x, p.y, pl.x, pl.y);
      if (d2 < best) { best = d2; helper = p; }
    }
    // In Arceus's Judgment the progress doesn't decay, so teammates can revive you a bit at a time while dodging.
    pl.reviveT = helper ? (pl.reviveT || 0) + dt : G.Judgment.active ? (pl.reviveT || 0) : Math.max(0, (pl.reviveT || 0) - dt * 0.5);
    if (pl.reviveT >= G.Player.REVIVE_TIME) {
      if (helper && helper.uid) pl.revivedBy.push(helper.uid);       // credited to them in the end-of-run stats
      pl.revive(0.5);
    }
  }

  /** Host: if everyone falls, it's over (after seeing the last one fall). */
  function checkAllDown(dt) {
    if (G.Rift.inArena || !G.Coop.players().every(p => p.dead)) { deathT = 0; return; }
    deathT += dt;
    if (deathT > 1.6) {
      deathT = 0;
      G.Coop.over(summary());
      endRun(true);
    }
  }

  // ---------------- drawing ----------------

  function drawScene(cam, extra) {
    const t = performance.now() / 1000;
    G.World.drawGround(ctx, cam);
    G.World.drawLiquid(ctx, cam, t);
    G.Hazards.draw(ctx);
    G.Combat.drawGroundFields(ctx);
    G.Pickups.draw(ctx);

    // Everything with "feet" is sorted by Y: objects, enemies, player.
    const items = [];
    // Flat things (springs, traps) always below everything else.
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
    // Fog: the vignette closes in a little (without covering the centre).
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
      // "Less flashing": the screen flash stays at a third.
      ctx.globalAlpha = Math.min(1, flashT / flashDur * 1.4) * (G.Settings.get('calm') ? 0.3 : 1);
      ctx.fillStyle = flashCol;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  // ---------------- menu background ----------------

  /**
   * The real world, with wild Pokémon wandering and the camera drifting.
   * That way the menu shows from the first second what the game looks like.
   */
  const Backdrop = (() => {
    let wanderers = [], t = 0, ready = false, sceneT = 0, cur = 0, sw = null;
    let goldT = 0, evT = 0, banner = null, tags = [], hourOv = null, lastTeam = 0, tapHooked = false;
    const CAST = [1, 4, 7, 25, 133, 52, 39, 35, 16, 43, 60, 69, 74, 92, 129, 147, 113, 143, 54, 79];
    const SCENE_TIME = 30, FADE_HALF = 0.6;
    const FONT = '800 8px Pixelify,"Segoe UI",system-ui,sans-serif';
    // Background scenes, in order: the normal map (3 palettes) and rift arenas with their legendary
    // and a small team surrounding it. The arenas use the same code as the real ones.
    // The team comes from a group run in your history (if there is one); otherwise, the one here.
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

    /** A boss's scale (as in enemy.js): ~110 px tall, in multiples of 0.5. */
    function bossScale(dex) {
      const m = G.Sprites.animMeta(dex, 'Idle');
      const h = (m ? m.ay : 30) * G.Sprites.PX;
      return G.U.clamp(Math.round(110 / h * 2) / 2, 1, 2);
    }

    // ---------------- Pokémon from your runs ----------------

    const myName = () => (G.Social && G.Social.me && G.Social.me.name) || 'You';
    const hasSprite = d => !!(G.SPRITE_META && G.SPRITE_META[d]);

    /** A team from a group run in your history (you + your teammates); if there isn't one, your latest Pokémon. */
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

    /** Up to 6 Pokémon from your runs (yours and your teammates') to wander the map. */
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
        // The legendary to the north (large) and the team to the south, facing it.
        const team = historyTeam() || sc.team.map(d => ({ dex: d }));
        G.Sprites.preload([sc.boss, ...team.map(m => m.dex)], 6000);
        const boss = spawn({ dex: sc.boss }, { x: cx, y: cy - ts * 3, leash: ts * 2.2, boss: true });
        wanderers = [boss, ...team.map((m, k) => spawn(m, {
          x: cx + (k - (team.length - 1) / 2) * ts * 1.8, y: cy + ts * 3.5, leash: ts * 3, target: boss }))];
        // Each arena brings its weather, like the real ones.
        const th = G.Tiles.ARENA_THEMES[sc.arena];
        if (th && th.weather) { G.Weather.showcase(th.weather, 9999); say(WX_NAME[th.weather], '#9fd8ff'); }
      } else {
        G.World.setBiome(sc.map, true);
        G.Camera.x = 0; G.Camera.y = 0;
        const hc = historyCast(), have = new Set(hc.map(m => m.dex));
        const base = CAST.filter(d => !have.has(d)).slice(0, 20 - hc.length);
        G.Sprites.preload(hc.map(m => m.dex), 6000);
        wanderers = [...hc, ...base.map(d => ({ dex: d }))].map(m => spawn(m, null));
        // Sometimes, weather (the same as in the game, depending on the biome).
        if (Math.random() < 0.55) {
          const k = G.Weather.pickFor(sc.map);
          G.Weather.showcase(k, G.U.rand(40, 60)); say(WX_NAME[k], '#9fd8ff');
        }
      }
    }

    function init() {
      applyScene(0);
      ready = true;
      // Touching the background (not a button or a panel) makes the Pokémon react.
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

    /** `m` = { dex, sh?, label? }. `home` = null: anywhere on the screen (map); otherwise, { x, y, leash, boss, target } of an arena. */
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
        // Golden hour / thief: a golden glow behind, like the golden enemies.
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

    // ---------------- game events, in the menu ----------------

    function spawnThief() {
      // As in runs: a Meowth loaded with coins or, 1 in 4, a Gholdengo.
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
      try { last = +localStorage.getItem(key) || 0; } catch (e) { /* nothing */ }
      if (Date.now() - last >= THIEF_CD) {
        try { localStorage.setItem(key, String(Date.now())); } catch (e) { /* nothing */ }
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

    // ---------------- touching a Pokémon ----------------

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

    // ---------------- time of day ----------------

    // A tint by the player's real time: night, dawn, dusk.
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
      if (a > 0.2 && !SCENES[cur].arena) {            // at night, a few twinkling stars
        ctx.fillStyle = '#ffffff';
        for (const [sx, sy, ph] of STARS) {
          ctx.globalAlpha = (0.25 + 0.5 * Math.abs(Math.sin(t * 1.3 + ph))) * Math.min(1, (a - 0.2) * 8);
          ctx.fillRect(Math.round(sx * w), Math.round(sy * h), 2, 2);
        }
        ctx.globalAlpha = 1;
      }
    }

    // ---------------- every frame ----------------

    function step(dt) {
      t += dt;
      G.World.update(dt, G.Camera);
      G.FX.update(dt);
      G.Weather.tickMenu(dt);
      // Slow camera drift.
      G.Camera.x += Math.cos(t * 0.05) * 14 * dt;
      G.Camera.y += Math.sin(t * 0.037) * 10 * dt;
      G.Camera.follow(G.Camera.x, G.Camera.y, dt);

      // Scene change: fade to black, change and fade back.
      sceneT += dt;
      if (!sw && sceneT > SCENE_TIME) sw = { t: 0, done: false };
      if (sw) {
        sw.t += dt;
        if (!sw.done && sw.t >= FADE_HALF) { sw.done = true; applyScene(cur + 1); }
        if (sw.t >= FADE_HALF * 2) sw = null;
      }

      // Run events (golden hour, thief, horde): every so often, on the map.
      if (goldT > 0) goldT -= dt;
      evT -= dt;
      if (evT <= 0) { evT = G.U.rand(14, 22); startEvent(); }
      // (Tag ages come from the clock in drawTags: if this update stops, e.g. a run starts, they still fade out.)

      for (let i = wanderers.length - 1; i >= 0; i--) {
        const wd = wanderers[i];
        const hm = wd.home;
        if (goldT > 0 && !wd.temp && !(hm && hm.boss) && Math.random() < dt * 2) {
          G.FX.px(wd.x + G.U.rand(-wd.r, wd.r), wd.y - G.U.rand(0, G.Sprites.bodyHeight(wd.dex, wd.scale)), '#ffd23f', { vy: -34, life: 0.6 });
        }
        if (wd.temp) {
          // Thief or horde: they cross the screen and leave.
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
          // Wanders, stops or "attacks" the air every so often.
          wd.t = G.U.rand(1, 3.5);
          const r = Math.random();
          const walk = hm && hm.boss ? 0.35 : 0.55;
          if (r < walk) {
            let a = Math.random() * 6.2832;
            // In the arena they don't stray from their place.
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
        else if (hm && hm.boss) wd.anim.dir = G.Sprites.dirFromAngle(Math.PI / 2);   // the legendary faces its team
        wd.anim.loop(moving ? 'Walk' : 'Idle');
        wd.anim.update(dt);
        // If it ends up off camera, it reappears inside.
        if (!G.Camera.sees(wd.x, wd.y, 120)) Object.assign(wd, spawn(wd.m, hm));
      }
    }

    function drawTags(ctx) {
      // Age by the real clock, not by update(): a "Caught!" left over when the backdrop stopped updating
      // (starting a run right after catching the thief) used to stay on screen for good.
      const now = performance.now();
      for (const tg of tags) { if (tg.born == null) tg.born = now - tg.t * 1000; tg.t = (now - tg.born) / 1000; }
      tags = tags.filter(tg => tg.t < 2.4);
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

    /** On returning from a run, restores the menu world. */
    function restore() {
      sw = null;
      applyScene(cur);
    }

    /** For testing: { hour, scene, event: 'gold' | 'thief' | 'horde' | 'weather:rain' } */
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
    tutor() { if (pl) offerItem({ tutor: tutorMoves(pl) }); },             // Spiritomb: each player gets their own 3 moves
    init, startRun, everyone, levelXp, flash, offerBond,
    /** For testing: skips the run's clock. */
    debugTime(t) { tampered = true; time = t; },
    /**
     * Balance Lab: advances the run `n` steps of `dt` seconds right now, without drawing
     * (the lab drives the game this way, much faster than real time). The run counts as
     * tampered, so it never reaches the leaderboard.
     */
    labStep(n, dt = 1 / 60) {
      tampered = true;
      for (let i = 0; i < n && pl && state === 'playing'; i++) update(dt);
    },
    /** For recording videos: slow motion (0.5 = half speed). */
    debugSpeed(k) { if (k > 1) tampered = true; speedK = k; },
    togglePause,
    /** Zygarde Portal lost: the run ends for everyone (the host ends it for the group). */
    failRun() {
      if (state === 'over' || !pl) return;
      if (G.Coop.active) { if (!G.Coop.isHost) return; G.Coop.over(summary()); }
      portalLost = true;
      endRun(true);
    },
    /** Abandons the run in progress (e.g. when signing out from Settings). */
    quit() { if (state !== 'ui' && state !== 'over') quitRun(); },
    /** For recording videos: opens the level-up cards. */
    debugLevelUp() { tampered = true; pl.level++; pendingLevels++; },
    toUI() { state = 'ui'; Backdrop.restore(); },
    /** For testing: controls the menu background. */
    debugBackdrop(o) { return Backdrop.debug(o); },
    /** Group: the OTHER players who are choosing (bond or item) and have the run paused. */
    get waitingChoosers() {
      const me = G.Social.me && G.Social.me.name;
      return holdBy.filter(n => n !== me && n !== 'You');
    },
    /** Down in a group: who you're watching ({ name, color, index, count }) or null. */
    get spectating() {
      const m = spectated();
      if (!m) return null;
      const list = specList();
      return { name: m.name, color: m.color, index: list.indexOf(m) + 1, count: list.length, lo: m.pl.net && m.pl.net.lo };
    },
    cycleSpectate,
    get state() { return state; }, get player() { return pl; }, st
  };
})();

/* ============ Flow — transitions between screens ============ */
G.Flow = {
  boot() {
    G.UI.initChrome();
    G.LoginUI.init(); G.TestUI.init(); G.MenuUI.init(); G.GachaUI.init();
    G.SocialUI.init(); G.RankingUI.init(); G.ModUI.init(); G.GoalsUI.init(); G.ProfileUI.init(); G.SettingsUI.init(); G.SupportUI.init(); G.NewsUI.init(); G.CodexUI.init(); G.Updater.init();
    // Your name at the top right opens your profile.
    document.getElementById('user-pill').onclick = () => G.GoalsUI.open('profile');
    G.Audio.music('village');     // plays after the first click (the browser requires it)
    G.Game.init();
    // The database (cloud or local) recovers the previous session.
    G.DB.ready().then(restored => {
      document.getElementById('boot').classList.add('hidden');
      // Balance Lab (address with ?dev&lab): straight into the test bench, no login or menu.
      if (G.LabUI && G.LabUI.wanted()) { G.LabUI.start(); return; }
      // In another task: creating the sound to check it costs ~60 ms and mustn't block loading.
      setTimeout(() => this.tapToStart(() => { if (restored) this.afterLogin(); else this.toLogin(); }), 0);
    });
  },
  /**
   * "Tap to start": browsers don't let a website play sound until
   * something is touched. With this screen the music starts as soon as you enter.
   * (If the browser already allows sound, it doesn't appear.)
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
  /** On closing the summary: to the room if you're still in one, otherwise to the menu. */
  afterRun() {
    if (G.Social.room) {
      if (G.Game.state !== 'ui') G.Game.toUI();
      G.Audio.music('village');
      if (G.Social.room.isHost) G.Social.setOpen(true);
      G.LobbyUI.open();
    } else this.goMenu();
  },
  play() { if (G.Game.state === 'ui') G.Game.startRun(); },     // (a second Play click mustn't restart the run)
  /** Starts the group run (the host sends it to everyone). */
  startCoop(cfg) {
    if (G.Game.state !== 'ui' || !G.Social.room) return;
    G.LobbyUI.close();
    G.Game.startRun(cfg);
  }
};
