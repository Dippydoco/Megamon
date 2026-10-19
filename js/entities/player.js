/* ============ player.js — the Pokémon you control ============
 * (x, y) are the FEET. Only ONE move is active at a time: it fires
 * on its own and is switched with 1-4 / Q / E. Each shot plays the
 * matching Mystery Dungeon attack animation (Attack, Shoot or Charge).
 */
G.Player = class Player {
  /**
   * @param mon   G.DEX entry
   * @param perks permanent upgrades already resolved (see data/upgrades.js)
   */
  constructor(mon, perks = {}, shiny = false) {
    this.mon = mon;
    this.dex = mon.dex;
    this.shiny = shiny && G.Sprites.hasShiny(mon.dex);
    this.anim = new G.Sprites.Animator(mon.dex, 1, this.shiny);
    this.x = 0; this.y = 0;
    this.r = G.Sprites.bodyRadius(mon.dex);
    this.bodyH = G.Sprites.bodyHeight(mon.dex);

    this.atkMul = perks.atkMul || 1;
    this.spdMul = perks.spdMul || 1;
    this.cdMul = perks.cdMul || 1;
    this.dmgReduce = perks.dmgReduce || 0;
    this.regenFlat = perks.regen || 0;
    this.magnet = 78 * (perks.magnetMul || 1);
    this.xpMul = perks.xpMul || 1;
    this.coinMul = perks.coinMul || 1;
    this.areaMul = 1;          // Reach (level-up): size of area attacks

    this.maxHp = mon.hp + (perks.hp || 0);
    this.hp = this.maxHp;
    this.baseSpd = mon.spd;
    this.baseAtk = mon.atk;
    this.baseSpa = mon.spa != null ? mon.spa : mon.atk;   // Sp. Atk (special moves)
    this.baseDef = mon.def != null ? mon.def : 70;          // Defense (70 = neutral)

    this.moves = [];           // all the moves learned
    this.slots = [];           // slots: each one, a list of moves cast together
    this.active = 0;           // hueco activo
    this.maxMoves = 4;         // huecos
    this.bonds = 0;            // bonds to use (the legendaries' reward)

    this.buffs = {
      atk: { n: 0, t: 0, amount: 0 },
      spd: { n: 0, t: 0, amount: 0 },
      def: { n: 0, t: 0, amount: 0 },
      regen: { n: 0, t: 0, amount: 0 },
      fell: { n: 0, t: 0, amount: 0 },     // Fell Stinger: kills briefly raise damage
      surge: { n: 0, t: 0, amount: 0 }     // Ancient Power: a cast sometimes raises damage
    };

    this.level = 1;
    this.xp = 0;
    this.xpNext = Player.xpFor(1);
    this.kills = 0;
    this.bosses = 0;
    this.rerolls = 0;          // times the level cards have been rerolled this run
    this.skips = 0;            // level-ups skipped (taking nothing) in this run
    this.skipBonus = perks.skips || 0;       // skips bought in Upgrades (none by default)
    this.rerollBonus = perks.rerolls || 0;   // rerolls bought in Upgrades (plus the free one)
    this.critChance = perks.crit || 0;       // critical hit chance (Upgrades)
    this.banned = new Set();                 // vetoed moves (Upgrades → Veto): they don't appear on the cards
    this.bind = {};                          // move -> fixed slot (0-3), chosen in Upgrades
    this.coins = 0;            // coins picked up this run
    this.t1 = 0; this.t10 = 0; // gacha tickets picked up this run
    this.dmgDealt = 0;
    this.dmgTaken = 0; this.bigHit = 0; this.downs = 0; this.shrines = 0; this.revivedBy = [];   // end-of-run stats

    this.invuln = 0;
    this.flash = 0;
    this.aim = Math.PI / 2;
    this.moveAngle = Math.PI / 2;
    this.walking = false;
    this.inLiquid = false;
    this.lavaTick = 0;
    this.attackFace = 0;       // time it keeps facing the target after attacking
    this.dead = false;
    this.power = null;         // active altar power: { def, t, dur }
    this.slowT = 0;            // stuck by a trap
    this.item = null;          // equipped item (data/items.js), one per run
    this.sashT = -999;         // the last time the Focus Sash saved you
    this.bellHeal = 0;         // pending Shell Bell healing
    this.drainHeal = 0;        // pending healing from draining moves (Absorb, Drain Punch...)
    this.statsTaken = {};      // stat upgrades taken (evolution condition)
  }

  /** Seconds you have to stand next to a fallen teammate to revive them. */
  static get REVIVE_TIME() { return 3; }

  // (×2 and then ×4 on 2026-10-10: levelling up was too fast.)
  static xpFor(level) {
    return Math.floor((8 + level * 6 + Math.pow(level, 1.75) * 1.6) * 4);
  }

  cy() { return this.y; }

  // ---------------- stats efectivos ----------------
  // Damage boosts (Power cards, items, buffs...) raise Attack and Sp. Atk alike.
  get dmgMul() {
    const b = this.buffs;
    return this.atkMul * this.growthMul * (1 + b.atk.n * b.atk.amount) * (1 + b.fell.n * b.fell.amount) * (1 + b.surge.n * b.surge.amount);
  }
  /** Lower rarities grow stronger with each level (G.RARITY_GROWTH, in overrides.js). */
  get growth() { return (G.RARITY_GROWTH && G.RARITY_GROWTH[this.mon.rarity]) || 0; }
  get growthMul() { return 1 + this.growth * (Math.min(this.level, G.RARITY_GROWTH_CAP || 30) - 1); }
  /** Attack: multiplies physical moves. */
  get atk() { return this.baseAtk * this.dmgMul; }
  /** Sp. Atk: multiplies special moves. */
  get spa() { return this.baseSpa * this.dmgMul; }
  /** The multiplier a move uses: Attack for physical, Sp. Atk for special, the better one if it has no category. */
  pow(m) {
    const c = m && m.cat;
    return c === 'physical' ? this.atk : c === 'special' ? this.spa : Math.max(this.atk, this.spa);
  }
  get spd() {
    const s = this.baseSpd * this.spdMul * (1 + this.buffs.spd.n * this.buffs.spd.amount) * (this.slowT > 0 ? 0.5 : 1) * (this.reviveBoostT > 0 ? Player.REVIVE_BOOST : 1);
    const w = G.Weather.speedFor(this.mon.types);
    const slow = this.inLiquid && !this.hasItem('heavyboots') ? G.World.liquidEffect(this.mon.types).slow || 1 : 1;
    return s * slow * w;
  }
  get reduction() { return Math.min(0.8, this.dmgReduce + this.buffs.def.n * this.buffs.def.amount + (this.guardT > 0 ? this.guardAmt || 0 : 0)); }
  /** Defense: damage taken ×1 at 70; -0.25% per point above (at most -35%), +0.1% per point below (at most +10%).
   *  Separate from `reduction` (cards, items, buffs), so it doesn't use up its 80% cap. */
  get defMul() {
    const d = this.baseDef;
    return d >= 70 ? Math.max(0.65, 1 - (d - 70) * 0.0025) : Math.min(1.1, 1 + (70 - d) * 0.001);
  }
  get regen() { return this.regenFlat + this.buffs.regen.n * this.buffs.regen.amount; }

  // ---------------- moves ----------------
  addMove(id) {
    if (this.slots.length >= this.maxMoves || this.hasMove(id)) return false;
    const m = G.Moves.instance(id, 1);
    this.moves.push(m);
    const group = [m];
    this.slots.push(group);
    this.arrange();
    // Learning a new one does NOT switch moves: you keep the one you had selected
    // (arrange() already keeps the active slot even if they're reordered).
    return true;
  }

  /**
   * Fixed slots (Upgrades → Shortcuts): each move with a chosen slot goes
   * in that number for muscle memory (Confusion always in 1...).
   * Until you have that many moves, it goes to the nearest one; the others
   * fill the free slots in the order you learned them.
   */
  arrange() {
    const n = this.slots.length;
    if (n < 2 || !this.bind) return;
    const want = g => { let k = Infinity; for (const m of g) if (this.bind[m.id] != null) k = Math.min(k, this.bind[m.id]); return k; };
    const cur = this.slots[this.active];
    const out = new Array(n).fill(null);
    const bound = this.slots.filter(g => want(g) < Infinity).sort((a, b) => want(a) - want(b));
    for (const g of bound) {
      let p = Math.min(want(g), n - 1);
      while (p >= 0 && out[p]) p--;                          // taken: the one before
      if (p < 0) { p = 0; while (out[p]) p++; }              // or the first free one
      out[p] = g;
    }
    for (const g of this.slots) if (!out.includes(g)) out[out.indexOf(null)] = g;
    this.slots = out;
    if (cur) this.active = out.indexOf(cur);
  }

  hasMove(id) { return this.moves.some(m => m.id === id); }

  setActive(i) {
    if (i < 0 || i >= this.slots.length || i === this.active) return;
    // Choice Band: you can't switch moves.
    if (this.hasItem('choiceband') && this.slots[this.active]) {
      G.FX.dmgText(this.x, this.y - this.bodyH - 8, 'Choice Band', '#ff8ad8');
      return;
    }
    this.active = i;
    G.RunLog.switched(this);
    G.Projectiles.clearOrbs(this);
    G.Audio.sfx('select');
    // (Not burst moves: they keep their own long cooldown, or switching back and forth would reset it.)
    for (const m of this.slots[i]) if (m.kind !== 'burst') m.t = Math.min(m.t, m.cd * 0.35);
    const m = this.slots[i][0];
    G.FX.ring(this.x, this.y - G.LIFT * 0.5, 6, this.r * 3.4, G.U.TYPE_COLOR[m.type], 0.3, 3);
  }

  cycle(dir) {
    if (!this.slots.length) return;
    this.setActive((this.active + dir + this.slots.length) % this.slots.length);
  }

  // ---------------- bonds (fusions) ----------------
  // Each legendary defeated gives a bond. With it, moves are joined in a
  // single slot and cast together. Only one group grows (up to BOND_MAX); if
  // there's none half-built, the bond joins two loose moves.
  static get BOND_MAX() { return 4; }
  // On being revived: seconds without damage, and seconds of extra speed (×1.5).
  static get REVIVE_SAFE() { return 3; }
  static get REVIVE_BOOST_T() { return 4; }
  static get REVIVE_BOOST() { return 1.5; }

  /** What can be done now with a bond: add to a group or join two loose moves. */
  bondOptions() {
    // Burst moves can't be bonded: in a bond they'd fire on their own and switching would lose its point.
    const loose = this.slots.filter(s => s.length === 1 && s[0].kind !== 'burst').map(s => s[0]);
    const grow = this.slots.find(s => s.length > 1 && s.length < Player.BOND_MAX);
    if (grow) return loose.length ? { mode: 'add', group: grow, loose } : null;
    return loose.length >= 2 ? { mode: 'pair', group: null, loose } : null;
  }

  /** Joins `moves` (loose) into group `group` (or a new one) and uses up a bond. */
  fuse(moves, group = null) {
    const target = group || this.slots.find(s => s[0] === moves[0]);
    const cur = this.slots[this.active];
    for (const m of moves) {
      if (target.includes(m)) continue;
      const i = this.slots.findIndex(s => s.length === 1 && s[0] === m);
      if (i < 0) continue;
      this.slots.splice(i, 1);
      target.push(m);
    }
    this.arrange();
    // You stay on the slot you had selected. Only if the move you were using was one of the
    // moves just bonded (so its slot no longer exists) do you move to the new group.
    const a = this.slots.indexOf(cur);
    this.active = a >= 0 ? a : this.slots.indexOf(target);
    this.bonds = Math.max(0, this.bonds - 1);
    G.RunLog.bond(this, target.length);
    G.Projectiles.clearOrbs(this);
    return target;
  }

  /** Moves being cast now (the active slot's group). */
  activeGroup() { return this.slots[this.active] || []; }

  activeMove() { return this.activeGroup()[0]; }

  /**
   * Called by combat.js when casting a move. Picks the PMD animation and
   * speeds it up if the cooldown is shorter than the animation, so it chains.
   */
  cast(m) {
    const anim = { melee: 'Attack', beam: 'Shoot', projectile: 'Shoot', nova: 'Attack',
                   aura: 'Charge', buff: 'Charge', orbit: 'Charge', boomerang: 'Shoot', chain: 'Shoot',
                   mine: 'Charge', meteor: 'Charge', turret: 'Charge', dash: 'Attack', trail: 'Walk', cone: 'Shoot',
                   charge: 'Charge', ricochet: 'Shoot', cage: 'Charge', wall: 'Charge', burrow: 'Attack', swarm: 'Charge', roll: 'Walk',
                   throw: 'Attack', spin: 'Charge', counter: 'Attack', burst: 'Charge' }[m.kind] || 'Attack';
    // The new families sound like the closest of the original ones.
    const SND = { boomerang: 'projectile', chain: 'beam', mine: 'nova', meteor: 'nova', turret: 'buff', dash: 'melee', trail: 'aura', cone: 'projectile',
                  charge: 'beam', ricochet: 'projectile', cage: 'aura', wall: 'buff', burrow: 'melee', swarm: 'buff', roll: 'melee', throw: 'melee',
                  spin: 'orbit', counter: 'melee', burst: 'nova' };
    // The trail doesn't make a sound for every puddle (it would be a constant buzz).
    if (m.kind !== 'trail') G.Audio.sfx('shot', { kind: SND[m.kind] || m.kind, type: m.type });
    if (m.kind === 'trail') return;
    // Don't restart an animation that's halfway through: it would look jerky.
    if (this.anim.busy() && this.anim.progress() < 0.65) return;
    const meta = G.Sprites.animMeta(this.dex, anim);
    const len = meta ? meta.d.reduce((a, b) => a + b, 0) / 60 : 0.4;
    const cd = Math.max(0.12, m.cd * this.cdMul);
    this.anim.play(anim, { speed: Math.max(1, len / (cd * 0.9)) });
    this.attackFace = 0.35;
  }

  // ---------------- damage and healing ----------------
  /**
   * @param type  the attack's type (type chart and weather); with no type, damage as is
   * @param pure  damage that isn't reduced by defence or melee (Arceus)
   */
  hurt(amount, type = null, pure = false, src = null) {
    if (this.invuln > 0 || this.dead) return;
    // Bright Powder: 10 % chance to dodge any hit.
    if (this.hasItem('brightpowder') && Math.random() < 0.1) {
      this.invuln = Math.max(this.invuln, 0.3);
      G.FX.dmgText(this.x, this.y - this.bodyH - 4, 'Dodged!', '#f4f4ff', true);
      return;
    }
    let eff = null;
    if (type) {
      const k = G.Types.mult(type, this.mon.types);
      eff = G.Types.label(k);
      amount *= k * G.Weather.mult(type);
    }
    // With a melee attack active you take 30 % less: you have to
    // be right on top of enemies to hit (they were lagging far behind).
    let close = this.activeGroup().some(m => m.kind === 'melee') ? 0.7 : 1;
    // In a rift arena the legendary's shots, beams and blasts do 25 % less to a melee build (it has to cross its fire to hit it).
    if (close < 1 && G.Rift.inArena && src && (src.k === 'shot' || src.k === 'beam' || src.k === 'zone')) close *= 0.75;
    const d = pure ? Math.max(1, amount) : Math.max(1, amount * (1 - this.reduction) * close * this.defMul);
    // The stats only count health actually lost (the finishing blow from the
    // Arceus arena legendaries, which double without limit, doesn't add trillions of excess damage).
    this.dmgTaken += Math.min(d, Math.max(0, this.hp));
    this.hp -= d;
    // "Defeated by": remember the last few hits (who, which attack, how much).
    (this.hits || (this.hits = [])).push(G.Killer.make(src, type, d, eff, pure));
    if (this.hits.length > 4) this.hits.shift();
    this.invuln = 0.45;
    this.flash = 0.14;
    G.Audio.sfx('hurt');
    G.Camera.kick(0.28);
    G.FX.dmgText(this.x, this.y - this.bodyH - 4, '-' + Math.round(d), eff === 'super' ? '#ff3048' : eff === 'weak' ? '#c9a0a8' : '#ff6b7a', eff === 'super');
    G.FX.burst(this.x, this.y - this.bodyH * 0.5, '#ff5f6d', 6, 90);
    // Focus Sash: survives the hit with 1 health (once every 60 s).
    if (this.hp <= 0 && this.hasItem('focussash') && performance.now() - this.sashT > 60000) {
      this.sashT = performance.now();
      this.hp = 1; this.invuln = 1.2;
      G.FX.dmgText(this.x, this.y - this.bodyH - 16, 'Focus Sash!', '#ff9a3d', true);
      G.FX.ring(this.x, this.y, 6, 70, '#ff9a3d', 0.5, 4);
    }
    if (this.hp <= 0) {
      this.hp = 0; this.dead = true; this.downs++;
      this.killer = this.hits[this.hits.length - 1];
      this.anim.play('Faint', { hold: true });
      G.Projectiles.clearOrbs(this);
      this.reviveT = 0;
    }
  }

  heal(amount) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const got = Math.round(this.hp - before);
    if (got >= 1) G.FX.dmgText(this.x, this.y - this.bodyH - 6, '+' + got, '#5fe08a');
  }

  addMaxHp(amount) {
    // Life Orb: 30% less max HP, also on what you gain while holding it (given back if you take it off).
    if (this.hasItem('lifeorb')) { const cut = amount * 0.3; amount -= cut; this._orbCut = (this._orbCut || 0) + cut; }
    this.maxHp += amount; this.hp += amount;
  }

  /** Returns how many levels it went up (several can happen at once). */
  gainXp(amount) {
    this.xp += amount * this.xpMul;
    let leveled = 0;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = Player.xpFor(this.level);
      if (this.growth && this.level <= (G.RARITY_GROWTH_CAP || 30)) this.addMaxHp(this.mon.hp * this.growth);   // low-rarity growth: max HP too
      leveled++;
    }
    return leveled;
  }

  // ---------------- held item ----------------
  hasItem(id) { return this.item === id; }

  /** Puts on an item (and takes off the one it had). */
  equip(id) {
    if (this.item) G.Items.BY[this.item].off(this);
    this.item = id;
    if (id) { G.Items.BY[id].on(this); G.RunLog.item(this, id); }
  }

  /** Shell Bell: a little health from the damage you deal (cap 4/s). */
  onDealt(dmg) {
    if (this.item === 'shellbell') this.bellHeal = Math.min(4, this.bellHeal + dmg * 0.04);
  }

  /**
   * Draining moves: a share of the damage comes back as health. It goes into a small pool
   * that empties at most 2.5% of max HP per second, so no build can out-heal everything
   * (an old Giga Drain healed on every hit with no limit and made you unkillable).
   */
  drain(amount) {
    if (amount > 0) this.drainHeal = Math.min(this.maxHp * 0.05, this.drainHeal + amount);
  }

  /** An altar's power (see systems/interact.js): applied and removed on its own. */
  addPower(def, dur) {
    if (this.hasItem('lightclay')) dur *= 1.5;            // Light Clay
    if (this.power) this.power.def.off(this);
    def.on(this);
    this.power = { def, t: dur, dur };
    G.RunLog.power(this, def.id);
  }

  addBuff(stat, amount, dur, maxStacks) {
    const b = this.buffs[stat];
    if (!b) return;
    b.amount = amount;
    b.n = Math.min(maxStacks, b.n + 1);
    b.t = dur;
  }

  // ---------------- ciclo ----------------
  update(dt) {
    this.anim.update(dt);
    if (this.dead) return;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.reviveSafe > 0) this.reviveSafe -= dt;
    if (this.protectT > 0) this.protectT -= dt;
    if (this.guardT > 0) this.guardT -= dt;
    if (this.burrowT > 0) this.burrowT -= dt;
    // Gyro Ball: how still you are (1 standing, 0 running), smoothed so it doesn't flicker.
    this.stillK = (this.stillK || 0) + ((this.walking ? 0 : 1) - (this.stillK || 0)) * Math.min(1, dt * 3);
    if (this.reviveBoostT > 0) this.reviveBoostT -= dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.attackFace > 0) this.attackFace -= dt;

    for (const k in this.buffs) {
      const b = this.buffs[k];
      if (b.n > 0) { b.t -= dt; if (b.t <= 0) b.n = 0; }
    }
    if (this.slowT > 0) this.slowT -= dt;
    if (this.bellHeal > 0) { const h = Math.min(this.bellHeal, 4 * dt); this.hp = Math.min(this.maxHp, this.hp + h); this.bellHeal -= h; }
    if (this.drainHeal > 0) { const h = Math.min(this.drainHeal, this.maxHp * 0.025 * dt); this.hp = Math.min(this.maxHp, this.hp + h); this.drainHeal -= h; }
    if (this.power && (this.power.t -= dt) <= 0) { this.power.def.off(this); this.power = null; }
    if (this.regen > 0) this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);

    // --- movement with collisions ---
    // (In co-op pausing doesn't stop the game: you just stand still.)
    const [ax, ay] = this.frozen ? [0, 0] : G.Input.axis();
    this.walking = ax !== 0 || ay !== 0;
    const s = this.spd;
    // Ice: you slide (the velocity changes slowly).
    const slide = this.inLiquid && !this.hasItem('heavyboots') && G.World.liquidEffect(this.mon.types).slide;
    this.svx = slide ? G.U.damp(this.svx || 0, ax * s * 1.15, 1.6, dt) : ax * s;
    this.svy = slide ? G.U.damp(this.svy || 0, ay * s * 1.15, 1.6, dt) : ay * s;
    this.x += this.svx * dt;
    this.y += this.svy * dt;
    G.World.collide(this);
    if (this.walking) this.moveAngle = Math.atan2(ay, ax);

    // --- liquid terrain ---
    this.inLiquid = G.World.isLiquid(this.x, this.y);
    if (this.inLiquid) {
      const le = G.World.liquidEffect(this.mon.types);
      if (le.dmg && !this.hasItem('heavyboots')) {
        this.lavaTick -= dt;
        if (this.lavaTick <= 0) {
          this.lavaTick = le.every; this.breakInvuln();
          this.hurt(Math.max(le.flat, this.maxHp * le.dmg * 0.5), null, false, { k: 'liquid' });
          G.FX.burst(this.x, this.y - 4, le.color, 5, 70);
        }
      } else if (!le.dmg && this.walking && Math.random() < dt * 8) {
        G.FX.burst(this.x, this.y, le.slide ? '#ffffff' : '#b3defa', 2, 40);
      }
    }

    // --- aiming: nearest enemy; if there isn't one, where you're walking ---
    // Target priority by the active attack:
    //   ranged (projectile, beam): the boss if in range > whatever is touching you > the nearest
    //   melee and the rest:        whatever is touching you > the boss > the nearest
    // With a horde on top of you something is almost always touching you; if that always won,
    // ranged attacks would never hit the boss.
    // With no enemies, it aims at the nearest rock or chest.
    const all = G.EnemyMgr.all();
    const m = this.activeMove();
    const ranged = !!m && (m.kind === 'projectile' || m.kind === 'beam');
    const threat = G.Projectiles.nearest(all, this.x, this.y, this.r + 24);
    const boss = all.find(e => e.boss && !e.dead && G.U.dist(this.x, this.y, e.x, e.y) < 330);
    // A breakable chest within the active move's reach comes before
    // enemies: that way you don't need to stand between a Pokémon and the chest to break it.
    let chest = null;
    if (m) {
      // (reach() includes a margin for starting an attack; take it off, and cap it lower, so you don't aim at chests you can't actually hit)
      const cr = Math.max(40, Math.min(G.Combat.reach(m) - 25, 225));
      let bd = cr * cr;
      for (const p of G.World.propsInCircle(this.x, this.y, cr)) {
        if (p.type !== 'chest' || p.dead) continue;
        const d = G.U.dist2(this.x, this.y, p.x, p.y);
        if (d < bd) { bd = d; chest = p; }
      }
    }
    const tg = chest || (ranged ? boss || threat : threat || boss)
            || G.Projectiles.nearest(all, this.x, this.y, 520)
            || G.World.nearestBreakable(this.x, this.y, 200);
    this.target = tg;
    if (tg) this.aim = Math.atan2(tg.y - this.y, tg.x - this.x);
    else if (this.walking) this.aim = this.moveAngle;

    // --- animation: faces the target when attacking, otherwise where it's walking ---
    const face = this.attackFace > 0 || !this.walking ? this.aim : this.moveAngle;
    this.anim.dir = G.Sprites.dirFromAngle(face);
    this.anim.loop(this.walking ? 'Walk' : 'Idle', this.walking ? s / 110 : 1);
  }

  /** Hazards that ignore the short hit-protection call this; the protection after a revive survives it. */
  breakInvuln() { if (!(this.reviveSafe > 0) && !(this.protectT > 0)) this.invuln = 0; }

  /** Gets back up (revived by a teammate in co-op). */
  revive(frac = 0.5) {
    this.dead = false;
    this.hp = Math.max(1, this.maxHp * frac);
    this.invuln = Player.REVIVE_SAFE;               // a few seconds without damage so it doesn't fall again straight away
    this.reviveSafe = Player.REVIVE_SAFE;           // while this runs, ground zones, beams, traps and liquid cannot cancel it
    this.reviveBoostT = Player.REVIVE_BOOST_T;      // and a little more speed to get out of the way
    this.reviveT = 0;
    this.anim._start('Idle', false);
    G.FX.ring(this.x, this.y, 6, 70, '#5fe08a', 0.5, 4);
    G.FX.burst(this.x, this.y - this.bodyH * 0.5, '#9dffb8', 18, 150);
    G.Audio.sfx('heal');
  }

  // ---------------- teammate (co-op) ----------------

  /**
   * A teammate on another computer: their owner sends their state (position, health,
   * active move...) and it's followed smoothly here.
   * n = { x, y, ang, walk, hp, maxHp, dead, mv, ml, mag, aim, rev }
   */
  netUpdate(dt) {
    this.anim.update(dt);
    const n = this.net;
    if (!n) return;
    if (this.flash > 0) this.flash -= dt;
    if (this.attackFace > 0) this.attackFace -= dt;
    // Glide between updates: run ahead by about one update gap, and ease more gently when they arrive slowly.
    const gap = n.gap || 0.07, lead = Math.min(gap * 1.2, (n.age = (n.age || 0) + dt));
    const tx = n.x + (n.vx || 0) * lead, ty = n.y + (n.vy || 0) * lead, k = G.U.clamp(2 / gap, 5, 14);
    if (G.U.dist2(this.x, this.y, n.x, n.y) > 300 * 300) { this.x = n.x; this.y = n.y; }
    else { this.x = G.U.damp(this.x, tx, k, dt); this.y = G.U.damp(this.y, ty, k, dt); }
    if (n.hp < this.hp - 0.5 && !n.dead) this.flash = 0.14;
    this.hp = n.hp; this.maxHp = n.maxHp;
    this.magnet = n.mag || this.magnet;
    this.reviveT = n.rev || 0;
    if (n.dead && !this.dead) { this.dead = true; this.anim.play('Faint', { hold: true }); G.Projectiles.clearOrbs(this); }
    else if (!n.dead && this.dead) this.revive(n.hp / (n.maxHp || 1));
    // Active move (for the halo, the HUD and the orbs).
    if (n.mv && (!this.moves[0] || this.moves[0].id !== n.mv || this.moves[0].lvl !== n.ml) && G.Moves.BY_ID[n.mv]) {
      this.moves = [G.Moves.instance(n.mv, n.ml || 1)];
      this.slots = [this.moves.slice()];
      this.active = 0;
      G.Projectiles.clearOrbs(this);
    }
    if (this.dead) return;
    this.walking = !!n.walk;
    this.moveAngle = n.ang;
    this.aim = n.aim;
    const face = this.attackFace > 0 || !this.walking ? this.aim : this.moveAngle;
    this.anim.dir = G.Sprites.dirFromAngle(face);
    this.anim.loop(this.walking ? 'Walk' : 'Idle', this.walking ? this.baseSpd / 110 : 1);
  }

  draw(ctx) {
    // Halo in the active move's type, on the ground.
    const m = this.activeMove();
    if (m && !this.dead) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = G.U.TYPE_COLOR[m.type];
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(this.x, this.y, this.r * 1.5, this.r * 0.6, 0, 0, 6.2832); ctx.stroke();
      ctx.restore();
    }
    G.Sprites.drawShadow(ctx, this.dex, this.x, this.y);
    // Altar power: a ring of its colour pulsing under the feet.
    if (this.power && !this.dead) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(performance.now() / 120) * 0.15;
      ctx.strokeStyle = this.power.def.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(this.x, this.y, this.r * 2.1, this.r * 0.85, 0, 0, 6.2832); ctx.stroke();
      ctx.restore();
    }

    // Dig: underground, only a mound of earth moving about.
    if (this.burrowT > 0 && !this.dead) {
      ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = '#6e4c1e';
      ctx.beginPath(); ctx.ellipse(this.x, this.y, this.r * 1.2, this.r * 0.5, 0, 0, 6.2832); ctx.fill();
      ctx.restore();
      if (Math.random() < 0.3) G.FX.px(this.x + G.U.rand(-this.r, this.r), this.y - 2, '#aa7c3c', { vy: -25, life: 0.3 });
      return;
    }
    const shielded = !this.dead && (this.protectUntil || 0) > performance.now();
    const alpha = this.invuln > 0 && !this.dead && !shielded ? (Math.floor(this.invuln * 18) % 2 ? 0.45 : 1) : 1;
    this.anim.draw(ctx, this.x, this.y, { flash: this.flash > 0, softFlash: true, alpha, color: '#ffcb3d' });

    // Protect: a shimmering bubble around you (it flickers in its last second).
    if (shielded) {
      const left = (this.protectUntil - performance.now()) / 1000;
      if (left > 1 || Math.floor(left * 12) % 2) {
        ctx.save();
        const t = performance.now() / 1000, cy = this.y - this.bodyH * 0.45;
        ctx.globalAlpha = 0.18; ctx.fillStyle = '#9fd8ff';
        ctx.beginPath(); ctx.ellipse(this.x, cy, this.r * 1.7, this.bodyH * 0.75, 0, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 0.75 + Math.sin(t * 8) * 0.15; ctx.strokeStyle = '#d8f1ff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(this.x, cy, this.r * 1.7, this.bodyH * 0.75, 0, 0, 6.2832); ctx.stroke();
        ctx.restore();
      }
    }

    // Buff arcs around the feet.
    const COL = { atk: '#ff6b4d', spd: '#7fe0ff', def: '#b0b8c8', regen: '#5fe08a', fell: '#c7e04a', surge: '#c6b08a' };
    let i = 0;
    for (const k in this.buffs) {
      const b = this.buffs[k];
      if (b.n <= 0) continue;
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = COL[k];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.r * 1.8 + i * 5, (this.r * 1.8 + i * 5) * 0.42, 0, 0, 6.2832 * (b.n / 5));
      ctx.stroke();
      ctx.restore();
      i++;
    }

    // Co-op: a "reviving" ring and the name above.
    if (this.dead && this.reviveT > 0) {
      ctx.save();
      ctx.strokeStyle = '#5fe08a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.r * 2.4, this.r * 1.0, 0, -Math.PI / 2, -Math.PI / 2 + 6.2832 * Math.min(1, this.reviveT / G.Player.REVIVE_TIME));
      ctx.stroke();
      ctx.restore();
    }
    if (this.tag) {
      ctx.save();
      ctx.font = '700 7px Pixelify,"Segoe UI",sans-serif';
      ctx.textAlign = 'center';
      const y = this.y - this.bodyH - 8;
      ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(0,0,0,.75)';
      ctx.strokeText(this.tag, this.x, y);
      ctx.fillStyle = this.dead ? '#ff8a96' : this.tagColor || '#fff';
      ctx.fillText(this.tag, this.x, y);
      if (this.dead) {
        ctx.font = '700 6px Pixelify,"Segoe UI",sans-serif';
        ctx.strokeText(this.revLabel || '', this.x, y - 8);
        ctx.fillText(this.revLabel || '', this.x, y - 8);
      }
      ctx.restore();
    }
  }
};
