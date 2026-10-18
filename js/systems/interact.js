/* ============ interact.js — altares, manantiales, cofres con candado y trampas ============
 * Los objetos los coloca world.js (raros, en el suelo libre); aquí está lo que
 * pasa al tocarlos. Todo se mira alrededor de TU Pokémon:
 *
 *   altar     da un poder de 25 s (Furia, Rayo, Imán, Prisa o Guardian) y se apaga; el altar dorado
 *             (Gold) da un combo de monedas a todo el equipo y sólo lo puede usar uno
 *   spring    cura mientras estás encima; se agota y se recarga sola
 *   bigchest  quédate a su lado CHEST_TIME segundos (mientras te atacan) y se
 *             abre: monedas, tickets y experiencia para subir un nivel
 *   trap      salta al pisarla (tú o un enemigo) y afecta a todo lo cercano:
 *             veneno, pegajosa (ralentiza) o explosiva
 *
 * Cooperativo: altares y manantiales son de cada uno (en cada ordenador); el
 * cofre y las trampas se rompen como cualquier objeto y el anfitrión reparte
 * el botín y el daño a los enemigos (ver world.destroyProp y coop.propBroken).
 */
G.Interact = (() => {
  const CHEST_TIME = 3.5;
  const POWER_TIME = 25;
  const POWERS = [
    { id: 'dmg', name: 'Furia', desc: 'daño ×2', color: '#ff5f6d', on: p => { p.atkMul *= 2; }, off: p => { p.atkMul /= 2; } },
    { id: 'spd', name: 'Rayo', desc: '+45% velocidad', color: '#5fd4ff', on: p => { p.spdMul *= 1.45; }, off: p => { p.spdMul /= 1.45; } },
    { id: 'mag', name: 'Imán', desc: 'atraes todo desde lejos', color: '#ff8ad8', on: p => { p.magnet *= 4; }, off: p => { p.magnet /= 4; } },
    { id: 'cd', name: 'Prisa', desc: '-40% recarga', color: '#b48cff', on: p => { p.cdMul *= 0.6; }, off: p => { p.cdMul /= 0.6; } },
    { id: 'guard', name: 'Guardian', desc: '-35% damage taken', color: '#c9d6e6', on: p => { p.dmgReduce += 0.35; }, off: p => { p.dmgReduce -= 0.35; } }
  ];
  const KIND_GOLD = 5;               // altar kind 5 = Gold shrine (team-wide coin combo, not a personal power)

  // ---- Gold shrine: for 25 s every coin picked up by the team feeds a combo (a coin within 2.5 s of the
  // previous one). Multiplier = 1 + 0.15 per combo step, capped at ×3, and the extra coins per shrine are
  // capped at 80. Only the host adds coins; everyone sees the buff (the host sends it every frame).
  const GOLD = { TIME: 25, WINDOW: 2.5, STEP: 0.15, MAX: 3, BONUS_CAP: 80 };
  let gold = null;                   // { t, combo, idle, mult, frac, bonus }
  function goldStart() {
    gold = { t: GOLD.TIME, combo: 0, idle: 0, mult: 1, frac: 0, bonus: 0 };
    G.Spawner.say('Gold Shrine! Coins build a combo for ' + GOLD.TIME + ' s (whole team)', 3.2);
    G.Audio.sfx('legend');
  }
  /** Host: a coin of `value` was picked up. → value to add (with the combo bonus). */
  function goldCoin(value) {
    if (!gold || gold.t <= 0) return value;
    gold.combo++; gold.idle = 0;
    gold.mult = Math.min(GOLD.MAX, 1 + GOLD.STEP * gold.combo);
    gold.frac += value * (gold.mult - 1);
    let extra = Math.floor(gold.frac);
    gold.frac -= extra;
    extra = Math.max(0, Math.min(extra, GOLD.BONUS_CAP - gold.bonus));
    gold.bonus += extra;
    return value + extra;
  }
  const goldState = () => (gold && gold.t > 0 ? [Math.round(gold.t * 10) / 10, Math.round(gold.mult * 100), gold.bonus >= GOLD.BONUS_CAP ? 1 : 0] : null);
  function goldNet(a) { gold = a ? { t: a[0], combo: 0, idle: 0, mult: a[1] / 100, frac: 0, bonus: a[2] ? GOLD.BONUS_CAP : 0 } : null; }
  /** Host: a teammate asks to take the Gold shrine at tile (tx, ty); only the first one gets it. */
  function goldRequest(tx, ty, from) {
    if (G.World.altarUsed(tx, ty)) return;
    G.World.markUsed(tx, ty);
    goldStart();
    G.Coop.broadcast(['gu', tx, ty], from);
  }
  function goldTick(dt) {
    if (!gold) return;
    gold.t -= dt;
    if (gold.t <= 0) { gold = null; return; }
    if (authority()) {
      gold.idle += dt;
      if (gold.idle > GOLD.WINDOW && gold.combo > 0) { gold.combo = 0; gold.mult = 1; }
    }
  }
  const TRAP_R = 74;
  const authority = () => !G.Coop.active || G.Coop.isHost;
  let healShown = 0, healAcc = 0;

  function update(dt, pl) {
    goldTick(dt);
    if (!pl) return;
    for (const p of G.World.specialsNear(pl.x, pl.y, 720)) {
      const d2 = G.U.dist2(pl.x, pl.y, p.x, p.type === 'spring' || p.type === 'trap' ? p.y - 8 : p.y);
      switch (p.type) {
        case 'spring': spring(dt, pl, p, d2); break;
        case 'altar':
          // Contando el tamaño de tu Pokémon: uno grande (Reshiram, Zekrom...) choca
          // con el altar antes de llegar a 30 y no lo podía activar.
          if (!p.used && !pl.dead && d2 < Math.max(30, p.r + pl.r + 14) ** 2) usePower(pl, p);
          break;
        case 'bigchest':
          if (!pl.dead && d2 < Math.max(46, p.r + pl.r + 24) ** 2) {
            if (p.open === 0) G.Audio.sfx('select');
            p.open += dt;
            if (p.open >= CHEST_TIME) { p.open = 0; G.World.breakProp(p); }
          } else if (p.open > 0) p.open = Math.max(0, p.open - dt * 1.5);
          break;
        case 'trap':
          if (!pl.dead && d2 < 13 * 13) G.World.breakProp(p);
          else if (authority() && G.EnemyMgr.queryCircle(p.x, p.y - 8, 3).some(e => !e.flying && !e.remote)) G.World.breakProp(p);
          break;
      }
    }
  }

  function spring(dt, pl, p, d2) {
    if (p.charge < 1) p.charge = Math.min(1, p.charge + dt / 45);
    if (pl.dead || d2 > 26 * 26 || p.charge <= 0.02 || pl.hp >= pl.maxHp) return;
    const before = pl.hp;
    pl.hp = Math.min(pl.maxHp, pl.hp + pl.maxHp * 0.14 * dt);
    healAcc += pl.hp - before;
    p.charge = Math.max(0, p.charge - dt * 0.09);
    if (Math.random() < dt * 14) G.FX.px(pl.x + G.U.rand(-pl.r, pl.r), pl.y - G.U.rand(0, pl.bodyH), '#7dffb0', { vy: -50, life: 0.5 });
    healShown -= dt;
    if (healShown <= 0 && healAcc >= 1) {
      healShown = 0.6;
      G.FX.dmgText(pl.x, pl.y - pl.bodyH - 6, '+' + Math.round(healAcc), '#5fe08a');
      healAcc = 0;
      G.Audio.sfx('xp');
    }
    if (p.charge <= 0.02) G.Spawner.say('El manantial se ha secado (se recarga solo)', 2.2, true);
  }

  function usePower(pl, p) {
    p.used = true;
    pl.shrines++;
    if (p.kind === KIND_GOLD) {
      G.FX.ring(p.x, p.y - 20, 8, 110, '#ffd23f', 0.7, 5);
      G.FX.burst(pl.x, pl.y - pl.bodyH * 0.5, '#ffd23f', 28, 220);
      G.World.markUsed(p.tx, p.ty);
      if (!G.Coop.active) goldStart();
      else if (G.Coop.isHost) { goldStart(); G.Coop.broadcast(['gu', p.tx, p.ty]); }
      else G.Coop.toHost(['gs', p.tx, p.ty]);
      return;
    }
    const pw = POWERS[p.kind];
    pl.addPower(pw, POWER_TIME);
    G.FX.ring(p.x, p.y - 20, 8, 90, pw.color, 0.6, 5);
    G.FX.burst(pl.x, pl.y - pl.bodyH * 0.5, pw.color, 24, 200);
    G.Audio.sfx('legend');
    G.Spawner.say('¡Poder ' + pw.name + '! ' + pw.desc + ' durante ' + POWER_TIME + ' s', 3, true);
  }

  /**
   * Una trampa salta (en cada ordenador; ver la cabecera). El daño a enemigos
   * sólo lo hace quien manda; a ti te afecta si estás dentro.
   */
  function trapEffect(p) {
    const x = p.x, y = p.y - 8, k = p.kind;
    const col = ['#c86bdc', '#8bd94a', '#ff7b3d'][k];
    const pal = ['poison', 'grass', 'fire'][k];
    G.FX.ring(x, y, 6, TRAP_R, col, 0.5, k === 2 ? 7 : 4);
    G.FX.burst(x, y - 6, col, k === 2 ? 40 : 22, k === 2 ? 260 : 140);
    for (let i = 0; i < (k === 2 ? 10 : 7); i++) {
      const a = Math.random() * 6.2832, r = G.U.rand(8, TRAP_R * 0.8);
      G.FX.sp(k === 2 ? 'impact' : 'blob', pal, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7 - 6,
              { vy: k === 2 ? -30 : -45, life: G.U.rand(0.4, 0.8) });
    }
    G.Audio.sfx(k === 2 ? 'boss' : 'surge');
    if (k === 2 && G.U.dist2(x, y, G.Camera.x, G.Camera.y) < 500 * 500) G.Camera.kick(0.7);

    const pl = G.Game.player;
    const lvl = pl ? pl.level : 1;
    if (authority()) {
      for (const e of G.EnemyMgr.queryCircle(x, y, TRAP_R)) {
        if (e.remote) continue;
        if (k === 0) { e.applyPoison(5); e.hurt(14 + lvl * 3, '#d47cf0'); }
        else if (k === 1) { e.applySlow(0.65, 4.5); e.hurt(4, '#8bd94a'); }
        else e.hurt(90 + lvl * 18, '#ff7b3d', e.x - x, e.y - y, 220);
      }
    }
    if (pl && !pl.dead && G.U.dist2(x, y, pl.x, pl.y) < (TRAP_R * 0.7) ** 2) {
      if (pl.hasItem('heavyboots')) {           // Heavy-Duty Boots: immune to every trap
        G.FX.dmgText(pl.x, pl.y - pl.bodyH - 6, 'Immune!', '#aab4c4');
        return;
      }
      pl.breakInvuln();
      if (k === 0) pl.hurt(pl.maxHp * 0.1, null, false, { k: 'trap', n: 'Trapped chest', a: 'Poison trap' });
      else if (k === 1) { pl.slowT = 3.5; G.FX.dmgText(pl.x, pl.y - pl.bodyH - 6, '¡Pegajoso!', '#8bd94a'); }
      else pl.hurt(pl.maxHp * 0.2, null, false, { k: 'trap', n: 'Trapped chest', a: 'Explosive trap' });
    }
  }

  return { update, trapEffect, POWERS, CHEST_TIME, goldCoin, goldState, goldNet, goldRequest };
})();
