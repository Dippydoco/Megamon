/* ============ enemy.js — wild Pokémon and their manager ============
 * (x, y) are the FEET. Mystery Dungeon animations:
 *   Walk when moving · Idle when still · Charge when aiming a charge ·
 *   Attack when charging or hitting you · Shoot when shooting · Hurt when hit ·
 *   Faint when falling (it stays on the ground and fades).
 *
 * Flyers, ghosts and bosses ignore terrain. The rest collide
 * with walls and objects, move slower in water and burn in lava.
 *
 * The manager keeps a spatial grid (rebuilt every frame) for
 * separating enemies and for projectile collisions.
 */
(() => {
  let nextId = 1;
  /** Bosses are enlarged up to ~110 tall, depending on how big their sprite already is. */
  function bossScale(dex) {
    const m = G.Sprites.animMeta(dex, 'Idle');
    const h = (m ? m.ay : 30) * G.Sprites.PX;
    // In multiples of 0.5: with the camera at ×2 each art pixel takes up a
    // whole number of screen pixels (scales like 1.37 distort it).
    return G.U.clamp(Math.round(110 / h * 2) / 2, 1, 2);
  }

  class Enemy {
    constructor(def, x, y, sc, boss = false) {
      this.id = nextId++;
      this.def = def;
      this.dex = def.dex;
      this.name = (G.DEX_BY[def.dex] && G.DEX_BY[def.dex].name) || def.name;
      this.x = x; this.y = y;
      this.boss = boss;
      this.scale = boss ? bossScale(def.dex) : 1;
      this.anim = new G.Sprites.Animator(def.dex, this.scale);
      this.r = G.Sprites.bodyRadius(def.dex, this.scale);
      this.bodyH = G.Sprites.bodyHeight(def.dex, this.scale);

      this.maxHp = Math.round(def.hp * sc.hp);
      this.hp = this.maxHp;
      this.spd = def.spd * sc.spd;
      this.dmg = def.dmg * sc.dmg;
      this.xp = def.xp;
      this.behavior = def.behavior;

      const types = (G.DEX_BY[def.dex] && G.DEX_BY[def.dex].types) || [];
      this.types = types.length ? types : ['normal'];
      this.atkType = this.types[0];         // type of its hits (type chart)
      // Only those that FLOAT in their sprite fly over rocks and water (a
      // Rowlet walks even though it's a Flying type). Bosses, because of their size, too.
      this.flying = boss || G.Sprites.hovers(def.dex);

      this.flash = 0;
      this.slow = 0; this.slowT = 0;
      this.burn = 0; this.burnT = 0; this.burnTick = 0;
      this.poison = 0; this.poisonT = 0; this.poisonTick = 0;
      this.lavaTick = 0;
      this.kx = 0; this.ky = 0;
      this.touchCd = 0; this.freezeT = 0; this.stunned = false; this.vulnT = 0;
      this.dead = false;
      this.fade = 0;             // fade time after falling

      // embestida
      this.phase = 'walk'; this.pt = 0; this.dx = 0; this.dy = 0;
      // distancia
      this.shotCd = def.shotCd ? G.U.rand(0.3, def.shotCd) : 0;
      // desatasco
      this.stuckT = 0; this.sideT = 0; this.side = 1;
      this.bob = Math.random() * 6.28;
      this.shiny = false;
      this.sparkT = 0;
      // personalidades
      this.sc = sc;                       // the run's scale (for its summons)
      this.shield = 0; this.shieldT = 0;  // shield that absorbs damage
      this.skillCd = G.U.rand(1, 4);      // shields / leaps
      // Aegislash event (events.js): Shield Forme (takes ~85% less damage, slow) <-> Blade Forme (full damage, fast).
      this.aegisShield = def.behavior === 'aegis'; this.formT = 5;
      this.minions = [];
      this.jump = null;                   // { sx, sy, tx, ty, t, dur }
      // Stragglers: if they fall behind, out of view, while you're fleeing,
      // they reappear ahead (see EnemyMgr.update).
      this.lagT = 0;
    }

    cy() { return this.y; }

    /** Makes it shiny: another sprite, more toughness and much more XP. */
    makeShiny() {
      this.shiny = true;
      this.anim = new G.Sprites.Animator(this.dex, this.scale, true);
      this.maxHp *= 2; this.hp = this.maxHp;
      this.xp *= 5;
      G.Sprites.preload([this.dex], 4000, true);
    }

    /** Aegislash: alternates Shield Forme (5 s) and Blade Forme (4 s). → speed factor for this form. */
    aegisTick(dt) {
      if ((this.formT -= dt) <= 0) {
        this.aegisShield = !this.aegisShield;
        this.formT = this.aegisShield ? 5 : 4;
        const col = this.aegisShield ? '#8fb4ff' : '#ff5f6d';
        G.FX.ring(this.x, this.y - this.bodyH * 0.4, this.r, this.r * 3.2, col, 0.45, 4);
        G.FX.burst(this.x, this.y - this.bodyH * 0.5, col, 14, 170);
        if (G.Camera.sees(this.x, this.y, 0)) G.Audio.sfx(this.aegisShield ? 'select' : 'surge');
      }
      return this.aegisShield ? 0.5 : 1.7;
    }

    /** Golden hour (events.js): double experience and sometimes coins. */
    makeGolden() {
      if (this.golden || this.boss || this.behavior === 'thief' || this.behavior === 'aegis' || this.behavior === 'tutor') return;
      this.golden = true;
      this.xp *= 2;
    }

    /** @param eff  'super' | 'weak' | null (type chart, only to show it) */
    hurt(amount, color = '#fff', dirX = 0, dirY = 0, knock = 0, eff = null) {
      if (this.megaT > 0) return;          // Zygarde is untouchable while it turns into Mega Zygarde (rift.js)
      if (this.dead) return;
      // Aegislash in Shield Forme: hits barely scratch it (the host decides, so this also covers teammates' hits).
      if (!this.remote && this.behavior === 'aegis' && this.aegisShield && !this._abPierce) { amount *= 0.15; eff = 'weak'; }
      if (this.vulnT > 0) amount *= 1.25;             // Acid Spray: takes more damage from everyone (only the host's copy has vulnT)
      // Afflicted (20-10-2026): +8% damage taken for each kind of status it carries (burn, poison, slow, frozen/stunned),
      // so status builds pay off. Bosses count too. (Host's copy; guests' numbers show without it.)
      if (!this.remote) {
        const n = (this.burn > 0) + (this.poison > 0) + (this.slowT > 0 && this.slow > 0) + (this.freezeT > 0);
        if (n) amount *= 1 + 0.08 * n;
      }
      const d = Math.max(1, Math.round(amount));
      // Copy of an enemy from the host: the hit is sent to them, since they're
      // the one who decides whether it falls. Here it's only shown (number, flash and animation).
      if (this.remote) {
        G.Coop.hit(this, d, color, dirX, dirY, knock);
        // (Acid Spray: the host adds the +25%; here it's only so the number shown is the real one.)
        const shown = this.net && this.net.st & 64 ? Math.round(d * 1.25) : d;
        this.hp = Math.max(1, this.hp - shown);
        this.showHurt(shown, color, dirX, dirY, eff);
        return;
      }
      this.hurtAt = G.Game.st.time;        // healers skip enemies hit in the last 2 s (healAround)
      // Shield: absorbs first.
      if (this.shield > 0 && !this._abPierce) {           // (abilities like Infiltrator go straight through: combat.js)
        const a = Math.min(this.shield, d);
        this.shield -= a;
        if (a >= d) { G.FX.dmgText(this.x, this.y - this.bodyH - 4, d, '#9fd8ff'); this.flash = 0.05; return; }
        amount = d - a;
      }
      this.hp -= Math.max(1, Math.round(amount));
      G.Judgment.noteDmg(amount, this);
      this.showHurt(d, color, dirX, dirY, eff);
      if (knock > 0 && !this.boss) {
        const [nx, ny] = G.U.norm(dirX, dirY);
        this.kx += nx * knock;
        this.ky += ny * knock;
      }
      if (G.Coop.isHost) G.Coop.hurtShown(this, d, color);
      // Battle Tower scripts can refuse a knockout (Twin Bond: a twin gets back up while its partner stands).
      if (this.hp <= 0 && !(this.onLethal && this.onLethal())) this.die();
    }

    /** What's SEEN when taking a hit. */
    showHurt(d, color, dirX = 0, dirY = 0, eff = null) {
      this.flash = 0.09;
      // Super effective: a big yellow number. Not very effective: grey. Critical: big and orange.
      G.FX.dmgText(this.x, this.y - this.bodyH - 4, d, eff === 'crit' ? '#ff9a3c' : eff === 'super' ? '#ffe14d' : eff === 'weak' ? '#a3abb8' : color,
                   this.boss || eff === 'super' || eff === 'crit');
      G.FX.spark(this.x, this.y - this.bodyH * 0.5, color, dirX, dirY, 3);
      if (!this.anim.busy() && this.phase !== 'dash') this.anim.play('Hurt');
      G.Audio.sfx('hit');
    }

    /** Stopwatch: it stays frozen (doesn't move, attack or animate) for a few seconds. */
    freeze(dur, stun = false) {
      if (this.judge || this.boss) return;
      if (this.remote) { G.Coop.status(this, stun ? 'z' : 'f', dur); return; }
      // Stun (Dragon Breath) works like freezing but looks different; a longer ice freeze wins.
      if (dur >= (this.freezeT || 0)) this.stunned = stun;
      this.freezeT = Math.max(this.freezeT || 0, dur);
    }

    /** Psywave, Magical Torque: confused for `dur` s, it wanders and bumps into other foes (bosses are only slowed). */
    confuse(dur) {
      if (this.boss || this.legend || this.judge) { this.applySlow(0.4, dur); return; }
      if (this.remote) { G.Coop.status(this, 'c', dur); return; }
      this.confT = Math.max(this.confT || 0, dur);
      this.confA = Math.random() * 6.2832;
    }

    /** Water Pulse: soaked for `dur` s, it takes +25% from Electric and Ice moves (combat.js). Kept on every copy. */
    soak(dur) { this.soakT = Math.max(this.soakT || 0, dur); }

    /** Acid Spray: for `dur` seconds it takes +25% damage from everyone. */
    vuln(dur) {
      if (this.remote) { G.Coop.status(this, 'v', dur); return; }
      this.vulnT = Math.max(this.vulnT || 0, dur);
    }

    applySlow(factor, dur = 1.2) {
      if (this.remote) { G.Coop.status(this, 's', factor); return; }
      this.slow = Math.max(this.slow, factor);
      this.slowT = Math.max(this.slowT, dur);
    }
    /** @param src  id of the local player's move that applied it (run details credit the ticks to it) */
    applyBurn(stacks = 1, src = null) {
      if (this.remote) { G.Coop.status(this, 'b', stacks); return; }
      this.burn = Math.min(8, this.burn + stacks); this.burnT = 3; this.burnSrc = src;
    }
    applyPoison(stacks = 1, src = null) {
      if (this.remote) { G.Coop.status(this, 'p', stacks); return; }
      this.poison = Math.min(8, this.poison + stacks); this.poisonT = 4; this.poisonSrc = src;
    }

    /** Owner id for its warned attacks: only bosses' are cancelled when they fall (Hazards.cancelOwner). */
    hzOwner() { return this.boss ? this.id : 0; }

    die() {
      if (this.dead) return;
      this.dead = true;
      if (this.boss) G.Hazards.cancelOwner(this.id);      // its warned attacks fade away without going off
      this.fade = 0.9;
      this.anim.play('Faint', { hold: true });
      const col = this.boss ? '#ffd95e' : '#ffffff';
      const cy = this.y - this.bodyH * 0.5;
      G.FX.burst(this.x, cy, col, this.boss ? 34 : 9, this.boss ? 260 : 120);
      G.FX.ring(this.x, this.y, this.r, this.r * (this.boss ? 6 : 2.6), col, this.boss ? 0.6 : 0.3, this.boss ? 6 : 3);
      // On a copy, the host shares out the loot and the shinies.
      if (this.remote) {
        if (this.boss) G.Camera.kick(0.9);
        G.Audio.sfx(this.boss ? 'bossDown' : 'faint');
        if (this.shiny) { G.FX.burst(this.x, cy, '#ffe9a0', 30, 220); G.FX.ring(this.x, this.y, this.r, this.r * 7, '#9ae6ff', 0.7, 5); }
        return;
      }
      // (The legendaries of Arceus's Judgment only give experience.)
      if (this.boss && !this.judge && this.behavior !== 'clone') {
        G.Camera.kick(0.9);
        for (let i = 0; i < 10; i++) G.Pickups.drop('coin', this.x + G.U.rand(-40, 40), this.y + G.U.rand(-30, 30), 5);
        // Bosses always drop a held item.
        G.Pickups.drop('item', this.x - 26, this.y - 10, G.Items.roll());
        G.KeyItems.bossDown(this);          // Wishing Star: sometimes 2 tickets
      }
      if (!this.noXp) G.Pickups.dropXp(this.x, this.y, this.xp, this.boss, !!this.legend, !!this.judge);   // (Battle Tower puzzles: late arrivals give none)
      if (this.golden && Math.random() < 0.35) G.Pickups.drop('coin', this.x + 6, this.y - 4, 3);
      // Treasure goblin: Meowth drops coins; Gholdengo, a ×10 ticket.
      if (this.behavior === 'thief') {
        const n = this.def.loot === 'ticket10' ? 6 : 20;
        for (let i = 0; i < n; i++) G.Pickups.drop('coin', this.x + G.U.rand(-36, 36), this.y + G.U.rand(-26, 26), 5);
        if (this.def.loot === 'ticket10') G.Pickups.drop('ticket10', this.x, this.y - 12, 1);
        G.FX.ring(this.x, this.y, this.r, this.r * 5, '#ffd23f', 0.6, 4);
      }
      // Aegislash: coins and the Armoury (everyone picks one of 3 items, or skips).
      // Spiritomb, the move tutor: coins and a move from outside your pool (everyone picks one of 3, or skips).
      if (this.behavior === 'tutor') {
        for (let i = 0; i < 6; i++) G.Pickups.drop('coin', this.x + G.U.rand(-36, 36), this.y + G.U.rand(-26, 26), 5);
        G.FX.ring(this.x, this.y, this.r, this.r * 5, '#9b6bd6', 0.6, 4);
        G.Events.tutor();
      }
      if (this.behavior === 'aegis') {
        for (let i = 0; i < 10; i++) G.Pickups.drop('coin', this.x + G.U.rand(-40, 40), this.y + G.U.rand(-28, 28), 5);
        G.FX.ring(this.x, this.y, this.r, this.r * 5, '#9fb4ff', 0.6, 4);
        G.Events.armoury();
      }
      if (this.legend) {
        // The rift legendary: loose tickets and coins (the ×10, about
        // half the time; it used to always give 2).
        for (let i = 0; i < 3; i++) G.Pickups.drop('ticket', this.x + G.U.rand(-30, 30), this.y + G.U.rand(-20, 20), 1);
        for (let i = 0; i < 10; i++) G.Pickups.drop('coin', this.x + G.U.rand(-50, 50), this.y + G.U.rand(-35, 35), 8);
        if (this.hard) {
          // Zygarde Portal bonus: a x10 ticket, 4 more tickets, 25 more coins and 2 items.
          G.Pickups.drop('ticket10', this.x, this.y - 14, 1);
          for (let i = 0; i < 4; i++) G.Pickups.drop('ticket', this.x + G.U.rand(-34, 34), this.y + G.U.rand(-22, 22), 1);
          for (let i = 0; i < 25; i++) G.Pickups.drop('coin', this.x + G.U.rand(-60, 60), this.y + G.U.rand(-40, 40), 8);
          for (let i = 0; i < 2; i++) G.Pickups.drop('item', this.x + (i ? 24 : -24), this.y - 18, G.Items.roll());
        }
      }
      G.Audio.sfx(this.boss ? 'bossDown' : 'faint');
      if (this.shiny) {
        G.FX.burst(this.x, cy, '#ffe9a0', 30, 220);
        G.FX.ring(this.x, this.y, this.r, this.r * 7, '#9ae6ff', 0.7, 5);
        if (G.onShinyCaught) G.onShinyCaught(this);
      }
    }

    /**
     * Copy of an enemy from the host: it heads to the last position received
     * (plus the estimated velocity, so it doesn't move in jumps) and animates according to
     * how it moves or the animation it has on the host.
     */
    netUpdate(dt) {
      this.anim.update(dt);
      if (this.flash > 0) this.flash -= dt;
      if (this.dead) { this.fade -= dt; return; }
      if (this.touchCd > 0) this.touchCd -= dt;
      if (this.soakT > 0) this.soakT -= dt;
      this.bob += dt * 6;
      if (this.shiny) {
        this.sparkT -= dt;
        if (this.sparkT <= 0) { this.sparkT = 0.22; G.FX.twinkle(this.x + G.U.rand(-this.r, this.r) * 1.2, this.y - G.U.rand(4, this.bodyH * 1.1)); }
      }
      if (this.life > 0) this.life -= dt;
      const n = this.net;
      if (!n) return;
      // Dead-reckoning: it runs ahead by about one update gap, and the slower the updates
      // arrive (relay), the more gently it eases toward the target, so it glides instead of hopping.
      const gap = n.gap || 0.07;
      const lead = Math.min(gap * 1.3, n.age);
      n.age += dt;
      const tx = n.x + n.vx * lead, ty = n.y + n.vy * lead;
      const k = G.U.clamp(1.6 / gap, 4, 12);
      const ox = this.x, oy = this.y;
      if (G.U.dist2(this.x, this.y, tx, ty) > 160 * 160) { this.x = tx; this.y = ty; }
      else { this.x = G.U.damp(this.x, tx, k, dt); this.y = G.U.damp(this.y, ty, k, dt); }
      const vx = (this.x - ox) / (dt || 1), vy = (this.y - oy) / (dt || 1);
      const moving = Math.abs(vx) + Math.abs(vy) > 8;
      this.anim.dir = n.dir;
      // One-off animations (charge, shot...) started by the host.
      if (n.anim !== this.lastNetAnim) {
        this.lastNetAnim = n.anim;
        const a = G.Coop.ANIMS[n.anim];
        if (a && a !== 'Idle' && a !== 'Walk' && a !== 'Faint') this.anim.play(a, { speed: 1.4 });
      }
      this.anim.loop(moving ? 'Walk' : 'Idle');
    }

    update(dt, pl) {
      // Off screen there's no need to animate (but it does move and think).
      const seen = G.Camera.sees(this.x, this.y, 120);
      if ((seen || this.dead) && !(this.freezeT > 0)) this.anim.update(dt);
      if (this.flash > 0) this.flash -= dt;
      if (this.dead) { this.fade -= dt; return; }
      if (this.shiny && seen) {
        this.sparkT -= dt;
        if (this.sparkT <= 0) {
          this.sparkT = 0.22;
          G.FX.twinkle(this.x + G.U.rand(-this.r, this.r) * 1.2, this.y - G.U.rand(4, this.bodyH * 1.1));
        }
      }
      if (this.touchCd > 0) this.touchCd -= dt;
      this.bob += dt * 6;

      // --- estados ---
      if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.slow = 0; }
      if (this.soakT > 0) this.soakT -= dt;
      if (this.vulnT > 0) this.vulnT -= dt;
      if (this.burn > 0) {
        this.burnT -= dt; this.burnTick -= dt;
        if (this.burnTick <= 0) {
          this.burnTick = 0.5;
          const d = 1.6 * this.burn * (1 + pl.level * 0.06);
          this.hurt(d, '#ff9a4d');
          G.RunLog.dot(this.burnSrc, d);
        }
        if (this.burnT <= 0) this.burn = 0;
      }
      if (this.poison > 0) {
        this.poisonT -= dt; this.poisonTick -= dt;
        if (this.poisonTick <= 0) { this.poisonTick = 0.6; // Bosses, rift legends and Arceus' legends resist: a small share of max HP per stack, hard-capped per tick.
          const big = this.boss || this.legend || this.judge;
          const d = big ? Math.min(this.maxHp * 0.0012 * this.poison, 3 + 14 * this.poison) : this.maxHp * 0.012 * this.poison + 1;
          this.hurt(d, '#d47cf0');
          G.RunLog.dot(this.poisonSrc, d); }
        if (this.poisonT <= 0) this.poison = 0;
      }
      if (this.dead) return;
      // Asleep (Battle Tower Mystery Dungeon rooms): still until a player comes close or it's hit.
      if (this.asleep) {
        if (G.U.dist2(this.x, this.y, pl.x, pl.y) < 250 * 250 || this.hp < this.maxHp) { this.asleep = false; G.FX.dmgText(this.x, this.y - this.bodyH - 6, '!', '#ffd23f', true); }
        else { this.anim.loop('Idle', 0.4); if (seen && Math.random() < dt * 0.8) G.FX.dmgText(this.x, this.y - this.bodyH - 6, 'z', '#cfe0ff'); return; }
      }
      if (this.freezeT > 0) {
        this.freezeT -= dt;
        this.kx *= Math.pow(0.001, dt); this.ky *= Math.pow(0.001, dt);
        if (seen && Math.random() < dt * 5) G.FX.px(this.x + G.U.rand(-this.r, this.r), this.y - G.U.rand(2, this.bodyH), this.stunned ? '#ffe14d' : '#bfefff', { vy: -10, life: 0.5 });
        return;
      }

      // Confused (Psywave, Magical Torque): wanders about, doesn't attack, and the foes it bumps into take its hit.
      if (this.confT > 0) {
        this.confT -= dt;
        this.confA += G.U.rand(-3, 3) * dt;
        const sp = this.spd * 0.55;
        this.x += (Math.cos(this.confA) * sp + this.kx) * dt; this.y += (Math.sin(this.confA) * sp + this.ky) * dt;
        this.kx *= Math.pow(0.0015, dt); this.ky *= Math.pow(0.0015, dt);
        if (!this.flying && G.World.collide(this)) this.confA += Math.PI * 0.7;
        if ((this.confHitT = (this.confHitT || 0) - dt) <= 0) {
          for (const o of G.EnemyMgr.queryCircle(this.x, this.y, this.r + 24)) {
            if (o === this || o.dead || G.U.dist2(o.x, o.y, this.x, this.y) > (o.r + this.r) ** 2) continue;
            o.hurt(this.dmg, '#ff9fcf', o.x - this.x, o.y - this.y, 60);
            this.confHitT = 0.5;
            break;
          }
        }
        if (seen && Math.random() < dt * 4) G.FX.sp('star', 'psychic', this.x + G.U.rand(-6, 6), this.y - this.bodyH - 4, { life: 0.4, vy: -12, scale: 0.6 });
        this.anim.dir = G.Sprites.dirFromAngle(this.confA);
        this.anim.loop('Walk', 0.8);
        return;
      }

      // --- terreno ---
      let terrainMul = 1;
      // (The legendary is at home: its arena doesn't affect it. Arceus's ones neither.)
      if (!this.flying && !this.legend && !this.judge && G.World.isLiquid(this.x, this.y)) {
        const le = G.World.liquidEffect(this.types);
        if (le.dmg) {
          this.lavaTick -= dt;
          if (this.lavaTick <= 0) { this.lavaTick = le.every; this.hurt(6 + this.maxHp * 0.04, le.color); }
          if (this.dead) return;
        } else if (le.slow) terrainMul = le.slow < 0.5 ? 0.45 : 0.55;
      }

      const spd = this.spd * (1 - this.slow) * terrainMul * G.Weather.speedFor(this.types) * G.KeyItems.enemySpd() * (this.behavior === 'aegis' ? this.aegisTick(dt) : 1)
                * this.catchUp(dt, pl);
      let [dx, dy] = G.U.norm(pl.x - this.x, pl.y - this.y);
      const dist = G.U.dist(this.x, this.y, pl.x, pl.y);
      // Treasure goblin: flees from you (zigzagging) as soon as you get close.
      if (this.behavior === 'thief') {
        this.zig = (this.zig || 0) + dt;
        const near = dist < 300, a = Math.atan2(-dy, -dx) + Math.sin(this.zig * 2.2) * 0.7;
        const k = near ? 1 : 0.35;
        const vx0 = Math.cos(a) * spd * k, vy0 = Math.sin(a) * spd * k;
        const ox = this.x, oy = this.y;
        this.x += (vx0 + this.kx) * dt; this.y += (vy0 + this.ky) * dt;
        this.kx *= Math.pow(0.0015, dt); this.ky *= Math.pow(0.0015, dt);
        if (G.World.collide(this) && Math.hypot(this.x - ox, this.y - oy) < spd * k * dt * 0.3) this.zig += 1.4;
        if (Math.random() < dt * 6 && G.Camera.sees(this.x, this.y, 0)) G.FX.twinkle(this.x + G.U.rand(-this.r, this.r), this.y - G.U.rand(4, this.bodyH));
        this.anim.dir = G.Sprites.dirFromAngle(a);
        this.anim.loop('Walk', 1.4);
        return;
      }
      // Runner: heads to where you're GOING to be (cuts you off if you just flee).
      if (this.behavior === 'runner' && pl._vx != null) {
        const lead = G.U.clamp(dist / Math.max(60, spd), 0, 1.4);
        [dx, dy] = G.U.norm(pl.x + pl._vx * lead - this.x, pl.y + pl._vy * lead - this.y);
        if (G.Camera.sees(this.x, this.y, 0) && Math.random() < dt * 10) G.FX.px(this.x - dx * 8 + G.U.rand(-4, 4), this.y, '#e8dcc0', { vy: -12, life: 0.35 });
      }

      // --- personality (shields, leaps, explosion) ---
      if (this.shieldT > 0 && (this.shieldT -= dt) <= 0) this.shield = 0;
      if (this.jump) { this.updateJump(dt); return; }
      if (this.behavior === 'bomber' && this.phase === 'fuse') {
        this.pt -= dt;
        this.flash = Math.floor(this.pt * 10) % 2 ? 0.05 : 0;
        if (this.pt <= 0) { this.hp = 0; this.die(); }
        this.anim.loop('Idle');
        return;
      }
      if (this.behavior === 'bomber' && dist < this.r + pl.r + 26) { this.startFuse(); return; }
      if (this.behavior === 'shielder' || this.behavior === 'jumper') {
        this.skillCd -= dt;
        if (this.skillCd <= 0) {
          if (this.behavior === 'shielder') { this.skillCd = 6; this.castShields(); }
          else if (dist < 250) { this.skillCd = G.U.rand(5, 7); this.startJump(pl); return; }
          else this.skillCd = 0.5;
        }
      }

      // If it's been stuck against something for a while, it goes around one side.
      if (this.sideT > 0) {
        this.sideT -= dt;
        const a = Math.atan2(dy, dx) + this.side * 1.25;
        dx = Math.cos(a); dy = Math.sin(a);
      }

      // A path around obstacles (for those that don't fly).
      if (!this.flying && this.phase !== 'dash' && this.sideT <= 0) {
        const pd = G.Path.dirFor(this, pl);
        if (pd && !(this.keepsDistance() && dist < (this.def.range || 200) * 0.82)) { dx = pd[0]; dy = pd[1]; }
      }

      let vx = dx * spd, vy = dy * spd;
      let animBase = 'Walk';

      if (this.boss) {
        [vx, vy, animBase] = this.bossMove(dt, pl, dist, dx, dy, spd);
      } else if (this.behavior === 'charger') {
        this.pt -= dt;
        if (this.phase === 'walk') {
          if (dist < 200 && this.pt <= 0) {
            this.phase = 'aim'; this.pt = 0.55;
            this.anim.play('Charge', { speed: 1.6 });
          }
        } else if (this.phase === 'aim') {
          vx = vy = 0; animBase = 'Idle';
          if (this.pt <= 0) {
            this.phase = 'dash'; this.pt = 0.42;
            this.dx = dx; this.dy = dy;
            this.anim.play('Attack', { speed: 1.4 });
            G.FX.ring(this.x, this.y, this.r, this.r * 2.4, '#ff6b6b', 0.25, 2);
          }
        } else if (this.phase === 'dash') {
          vx = this.dx * spd * 3.4; vy = this.dy * spd * 3.4;
          if (this.pt <= 0) { this.phase = 'walk'; this.pt = 1.1; }
        }
      } else if (this.keepsDistance()) {
        const range = this.def.range || 200;
        const keep = range * 0.82;
        // Straight from you (not the path) to get away.
        const [ddx, ddy] = G.U.norm(pl.x - this.x, pl.y - this.y);
        if (dist < keep * 0.75) { vx = -ddx * spd * 0.8; vy = -ddy * spd * 0.8; }
        else if (dist < keep) { vx *= 0.1; vy *= 0.1; animBase = 'Idle'; }
        this.shotCd -= dt;
        if (this.shotCd <= 0 && dist < range) {
          this.shotCd = this.def.shotCd || 2;
          this.special(pl, ddx, ddy);
        }
      }

      // --- integration ---
      const ox = this.x, oy = this.y;
      this.x += this.kx * dt; this.y += this.ky * dt;
      this.kx *= Math.pow(0.0015, dt); this.ky *= Math.pow(0.0015, dt);
      this.x += vx * dt; this.y += vy * dt;

      if (!this.flying && G.World.collide(this)) {
        // Has it moved much less than it wanted to?
        const want = Math.hypot(vx, vy) * dt;
        const got = Math.hypot(this.x - ox, this.y - oy);
        if (want > 0.5 && got < want * 0.35) {
          this.stuckT += dt;
          if (this.stuckT > 0.35 && this.sideT <= 0) {
            this.sideT = 0.7; this.stuckT = 0;
            this.side = Math.random() < 0.5 ? -1 : 1;
          }
        } else this.stuckT = 0;
      }

      // --- animation ---
      const moving = Math.abs(vx) + Math.abs(vy) > 2;
      const faceA = this.phase === 'dash' ? Math.atan2(this.dy, this.dx)
                  : moving ? Math.atan2(vy, vx) : Math.atan2(pl.y - this.y, pl.x - this.x);
      this.anim.dir = G.Sprites.dirFromAngle(faceA);
      this.anim.loop(moving ? animBase : 'Idle', moving ? Math.max(0.6, spd / 70) : 1);
    }

    // ---------------- bosses ----------------
    // Each boss (and each rift legendary) has 4 attacks: 2
    // close-range (Stomp always + Charge or Leap) and 2 ranged depending on its type.
    // It alternates between coming for you and fighting from range, so the one
    // that shoots also rushes you and the melee one also
    // shoots. Everything warns on the ground. Below half health it
    // becomes enraged: faster, less waiting and sometimes it chains two attacks.

    bossInit() {
      const T = this.types, has = (...xs) => xs.some(x => T.includes(x));
      const melee = ['slam', G.U.hash(this.dex, 3, 7) < 0.5 ? 'dash' : 'leap'];
      const pref = has('fire', 'ground', 'poison', 'rock', 'grass') ? 'rain'
                 : has('electric', 'psychic', 'dragon', 'ice', 'steel') ? 'beam'
                 : has('fairy', 'ghost', 'water', 'flying') ? 'nova' : 'volley';
      const others = ['rain', 'beam', 'nova', 'volley'].filter(x => x !== pref);
      const ranged = [pref, others[Math.floor(G.U.hash(this.dex, 5, 9) * 3) % 3]];
      // Battle Tower bosses (not Gengar's clones) learn two more from the tower's set (2026-10-25):
      //   ring     a ring of blasts around itself: hug it or stay well away
      //   cross    a + of beams from where it stands, then an x
      //   barrage  four blasts that follow you, one every 0.4 s
      //   spiral   rings of shots that turn a little each time, for 1.6 s
      if (this.tower && this.behavior !== 'clone') {
        const extra = ['ring', 'cross', 'barrage', 'spiral'], k = Math.floor(G.U.hash(this.dex, 11, 13) * 4) % 4;
        ranged.push(extra[k], extra[(k + 1 + Math.floor(G.U.hash(this.dex, 17, 19) * 3)) % 4]);
      }
      const far = this.behavior === 'ranged';
      this.ai = { melee, ranged, farLike: far ? 0.65 : 0.35, mode: far ? 'far' : 'close', modeT: G.U.rand(6, 8),
                  cd: 1.6, cast: null, fury: false, side: Math.random() < 0.5 ? -1 : 1 };
    }

    bossMove(dt, pl, dist, dx, dy, spd) {
      if (!this.ai) this.bossInit();
      const ai = this.ai;
      // Battle Tower bosses with their own script (systems/towerbosses.js) act first; null = use the shared kit below.
      if (this.script) { const r = G.TowerBosses.move(this, dt, pl, dist, dx, dy, spd); if (r) return r; }
      if (!ai.fury && !this.noEnrage && this.hp < this.maxHp * 0.5) this.enrage();
      const k = ai.fury ? 1.25 : 1;
      if (ai.cast) return this.bossCast(dt, pl);
      ai.modeT -= dt; ai.cd -= dt * k;
      // It always alternates: it stays longer at its favourite distance (7-9 s) than at the other (4-5 s).
      if (ai.modeT <= 0) {
        ai.mode = ai.mode === 'far' ? 'close' : 'far';
        ai.modeT = (ai.mode === 'far') === (ai.farLike > 0.5) ? G.U.rand(7, 9) : G.U.rand(4, 5);
        ai.side = -ai.side;
      }
      let vx = dx * spd * k * 1.1, vy = dy * spd * k * 1.1;
      const [ddx, ddy] = G.U.norm(pl.x - this.x, pl.y - this.y);
      if (ai.mode === 'far') {
        if (dist < 170) { vx = -ddx * spd; vy = -ddy * spd; }
        else if (dist < 300) { vx = -ddy * spd * 0.55 * ai.side; vy = ddx * spd * 0.55 * ai.side; }   // te rodea
      }
      if (ai.cd <= 0) {
        let id = null;
        if (ai.mode === 'close') {
          const ok = ai.melee.filter(m => m === 'slam' ? dist < 125 : dist < 320);
          // Now and then, even if it's close, it shoots too.
          id = ok.length && Math.random() < 0.8 ? G.U.pick(ok) : dist < 480 ? G.U.pick(ai.ranged) : null;
        } else {
          id = dist < 115 ? 'slam' : dist < 430 ? G.U.pick(ai.ranged) : null;
        }
        if (id) this.bossStart(id, pl);
      }
      return [vx, vy, 'Walk'];
    }

    enrage() {
      this.ai.fury = true;
      this.spd *= 1.15;
      if (!this.judge) G.Spawner.say(this.name + ' is enraged!', 2.4);
      G.FX.ring(this.x, this.y, this.r, this.r * 5, '#ff4a4a', 0.6, 5);
      G.Camera.kick(0.5);
      G.Audio.sfx('boss');
    }

    bossStart(id, pl) {
      const ai = this.ai, f = ai.fury ? 0.8 : 1, type = this.atkType;
      const col = G.U.TYPE_COLOR[type] || '#ff7a9e';
      const ang = Math.atan2(pl.y - this.y, pl.x - this.x);
      const c = ai.cast = { id, t: 0, wind: 0.6 * f, after: 0.35, ang };
      switch (id) {
        case 'slam':       // stomp: a wave around it
          c.wind = 0.85 * f;
          G.Hazards.add({ sd: this.dex, own: this.hzOwner(), from: this, kind: 'zone', x: this.x, y: this.y, r: 96 + this.r, delay: c.wind, dmg: this.dmg * 1.3, type, color: col });
          this.anim.play('Charge', { speed: 1.2 });
          break;
        case 'dash':       // charge in a straight line
          c.wind = 0.75 * f; c.len = 330; c.dur = 0.32;
          G.Hazards.add({ sd: this.dex, own: this.hzOwner(), from: this, kind: 'beam', x: this.x, y: this.y, angle: ang, len: c.len + this.r, w: this.r * 2 + 16,
                          delay: c.wind + c.dur, dmg: this.dmg * 1.2, type, color: col });
          this.anim.play('Charge', { speed: 1.3 });
          break;
        case 'leap':       // leap and land on you
          this.jump = { sx: this.x, sy: this.y, tx: pl.x, ty: pl.y, t: -0.5 * f, dur: 0.65 };
          G.Hazards.add({ sd: this.dex, own: this.hzOwner(), from: this, kind: 'zone', x: pl.x, y: pl.y, r: 82, delay: 0.5 * f + 0.65, dmg: this.dmg * 1.25, type, color: col });
          this.anim.play('Charge', { speed: 1.4 });
          ai.cast = null; ai.cd = G.U.rand(1.4, 2) + 0.6;
          break;
        case 'rain': {     // zones falling around you
          const n = ai.fury ? 6 : 4;
          for (let i = 0; i < n; i++) {
            const a = i ? Math.random() * 6.2832 : 0, d = i ? G.U.rand(40, 120) : 0;
            G.Hazards.add({ sd: this.dex, own: this.hzOwner(), from: this, kind: 'zone', x: pl.x + Math.cos(a) * d, y: pl.y + Math.sin(a) * d * 0.8, r: 50,
                            delay: 1.05 + i * 0.12, dmg: this.shotDmg() * 1.15, type, color: col });
          }
          c.wind = 0.5; this.anim.play('Shoot');
          break;
        }
        case 'beam': {     // beams in a fan
          const n = ai.fury ? 5 : 3, sp = ai.fury ? 0.42 : 0.5;
          for (let i = 0; i < n; i++) {
            G.Hazards.add({ sd: this.dex, own: this.hzOwner(), from: this, kind: 'beam', x: this.x, y: this.y, angle: ang + (i - (n - 1) / 2) * sp, len: 400, w: 26,
                            delay: 1.0, dmg: this.shotDmg() * 1.2, type, color: col });
          }
          c.wind = 1.0; c.after = 0.25; this.anim.play('Charge', { speed: 1.1 });
          break;
        }
        case 'ring': {     // Battle Tower: a ring of blasts around itself (safe close in, or far out)
          c.wind = 0.9 * f; c.after = 0.4;
          const n = ai.fury ? 12 : 10, rr = 150 + this.r;
          for (let i = 0; i < n; i++) {
            const a = i / n * 6.2832;
            G.Hazards.add({ sd: this.dex, own: this.hzOwner(), from: this, kind: 'zone', x: this.x + Math.cos(a) * rr, y: this.y + Math.sin(a) * rr * 0.8, r: 46,
                            delay: c.wind + 0.15, dmg: this.shotDmg() * 1.25, type, color: col });
          }
          this.anim.play('Charge', { speed: 1.2 });
          break;
        }
        case 'cross': {    // Battle Tower: a + of beams, then an x
          c.wind = 1.0 * f; c.after = 0.9;
          const a0 = Math.round(ang / 1.5708) * 1.5708;
          for (let k = 0; k < 8; k++) {
            G.Hazards.add({ sd: this.dex, own: this.hzOwner(), from: this, kind: 'beam', x: this.x, y: this.y, angle: a0 + k * 0.7854, len: 460, w: 32,
                            delay: (k % 2 ? 1.7 : 1.0) * f, dmg: this.shotDmg() * 1.2, type, color: col });
          }
          this.anim.play('Charge', { speed: 1.1 });
          break;
        }
        case 'barrage':    // Battle Tower: blasts that follow you (placed in bossCast)
          c.wind = 0.5; c.after = 1.7; c.next = 0; c.k = 0;
          this.anim.play('Shoot');
          break;
        case 'spiral':     // Battle Tower: turning rings of shots (fired in bossCast)
          c.wind = 0.6 * f; c.after = 1.6; c.next = 0; c.k = 0;
          this.anim.play('Charge', { speed: 1.3 });
          G.FX.ring(this.x, this.y, this.r, this.r * 2.4, col, c.wind, 2);
          break;
        case 'volley':     // fan of shots
        case 'nova':       // ring of shots
          c.wind = (id === 'nova' ? 0.7 : 0.5) * f;
          this.anim.play('Charge', { speed: 1.4 });
          G.FX.ring(this.x, this.y, this.r, this.r * 2.4, col, c.wind, 2);
          break;
      }
    }

    bossCast(dt, pl) {
      const ai = this.ai, c = ai.cast;
      c.t += dt;
      if (c.id === 'dash' && c.t >= c.wind) {
        if (!c.go) { c.go = true; this.anim.play('Attack', { speed: 1.6 }); }
        if (c.t >= c.wind + c.dur) return this.bossEnd();
        const sp = c.len / c.dur;
        return [Math.cos(c.ang) * sp, Math.sin(c.ang) * sp, 'Walk'];
      }
      // Battle Tower: the two attacks that keep going after the wind-up.
      if ((c.id === 'barrage' || c.id === 'spiral') && c.t >= c.wind) {
        if ((c.next -= dt) <= 0) {
          if (c.id === 'barrage' && c.k < 4) {
            c.next = 0.4; c.k++;
            G.Hazards.add({ sd: this.dex, own: this.hzOwner(), from: this, kind: 'zone', x: pl.x, y: pl.y, r: 58, delay: 0.8, dmg: this.shotDmg() * 1.2,
                            type: this.atkType, color: G.U.TYPE_COLOR[this.atkType] || '#ff7a9e' });
          } else if (c.id === 'spiral') {
            c.next = 0.27; c.k++;
            const n = ai.fury ? 10 : 8, a = c.k * 0.21;
            this.shoot(Math.cos(a), Math.sin(a), 6.2832 * (n - 1) / n, n, 0.6);
          }
        }
        if (c.t >= c.wind + c.after) return this.bossEnd();
        return [0, 0, 'Idle'];
      }
      if (c.t >= c.wind && !c.fired) {
        c.fired = true;
        const [ax, ay] = G.U.norm(pl.x - this.x, pl.y - this.y);
        if (c.id === 'volley') this.shoot(ax, ay, 1.1, ai.fury ? 9 : 7, 0.8);
        else if (c.id === 'nova') { const n = ai.fury ? 18 : 14; this.shoot(ax, ay, 6.2832 * (n - 1) / n, n, 0.7); }
        else if (c.id === 'slam') this.anim.play('Attack', { speed: 1.4 });
      }
      if (c.t >= c.wind + c.after) return this.bossEnd();
      return [0, 0, 'Idle'];
    }

    bossEnd() {
      const ai = this.ai;
      ai.cast = null;
      ai.cd = G.U.rand(1.3, 2.0);
      if (ai.fury && Math.random() < 0.35) ai.cd = 0.3;    // chains another
      return [0, 0, 'Idle'];
    }

    keepsDistance() { return ['ranged', 'fan', 'beamer', 'zoner', 'healer', 'summoner'].includes(this.behavior); }

    shotDmg() { return (this.def.shotDmg || 10) * (this.dmg / this.def.dmg); }

    /** Normal enemy shot (one, or several in a fan). */
    shoot(ax, ay, spread = 0, n = 1, k = 1) {
      const sp = 190 * G.Abil.enemyShotK(), type = this.atkType;      // (Psychic Terrain slows enemy shots)
      const base = Math.atan2(ay, ax);
      for (let i = 0; i < n; i++) {
        const a = base + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread);
        const shot = G.Projectiles.spawn({
          x: this.x, y: this.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          dmg: this.shotDmg() * k, r: 7, life: 2.4 / G.Abil.enemyShotK(), friendly: false, color: '#ff7a9e', mtype: type, sd: this.dex, from: this,
          vis: G.VFX.forType(type)
        });
        if (G.Coop.isHost) G.Coop.enemyShot(shot, type);
      }
      this.anim.play('Shoot');
      G.FX.ring(this.x, this.y - G.LIFT, 4, 14, '#ff7a9e', 0.2, 2);
    }

    /** What each personality does when its turn comes (host / solo). */
    special(pl, dx, dy) {
      const col = G.U.TYPE_COLOR[this.atkType] || '#ff7a9e';
      switch (this.behavior) {
        case 'fan': { const n = this.def.fanN || 5; this.shoot(dx, dy, n === 3 ? 0.6 : 0.9, n, 0.65); break; }
        case 'beamer':
          // Warned beam: the strip on the ground is seen first.
          G.Hazards.add({ sd: this.dex, own: this.hzOwner(), from: this, kind: 'beam', x: this.x, y: this.y, angle: Math.atan2(dy, dx), len: 360, w: 22,
                          delay: 1.0, dmg: this.shotDmg() * 1.05, type: this.atkType, color: col });
          this.anim.play('Charge', { speed: 1.2 });
          break;
        case 'zoner': {
          const n = G.U.randInt(1, this.def.zones || 3);
          for (let i = 0; i < n; i++) {
            G.Hazards.add({ sd: this.dex, own: this.hzOwner(), from: this, kind: 'zone', x: pl.x + (i ? G.U.rand(-70, 70) : 0), y: pl.y + (i ? G.U.rand(-55, 55) : 0), r: 44,
                            delay: 1.2, dmg: this.shotDmg() * 0.95, type: this.atkType, color: col });
          }
          this.anim.play('Shoot');
          break;
        }
        case 'healer': this.healAround(); break;
        case 'summoner': this.summon(); break;
        default: this.shoot(dx, dy);
      }
    }

    healAround() {
      // 7 % of health (it was 15 %: with several healers they healed more than you hit).
      // 22-10-2026: no longer grows with your Attack, and it skips anything hit in the last 2 s, so
      // focused fire always wins. Before, a herd of 64 inside 3 healers' range got back 50-130 % of
      // all the damage dealt from minute 10 on, and runs stalled with no kills (and no XP) for good.
      const k = 0.07, now = G.Game.st.time;
      let n = 0;
      for (const e of G.EnemyMgr.queryCircle(this.x, this.y, 150)) {
        if (e.dead || e.boss || e.hp >= e.maxHp || e.hurtAt > now - 2) continue;      // bosses don't heal
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * k);
        G.FX.burst(e.x, e.y - e.bodyH * 0.6, '#7dffb0', 5, 60);
        n++;
      }
      this.anim.play('Charge');
      G.FX.ring(this.x, this.y, 8, 150, '#5fe08a', 0.5, 3);
      if (G.Coop.isHost) G.Coop.broadcast(['fxr', Math.round(this.x), Math.round(this.y), 150, '#5fe08a']);
      if (n && G.Camera.sees(this.x, this.y, 0)) G.Audio.sfx('heal');
    }

    /**
     * Catch-up (22-10-2026): most enemies are slower than you, so a herd that can't be killed could be
     * walked in circles for ever. One that has been chasing you for over 8 s without landing a hit speeds
     * up (+3 % a second, up to +35 %); hitting you, or losing you, resets it. Not bosses, the event
     * Pokémon or those that keep their distance.
     */
    catchUp(dt, pl) {
      if (this.boss || this.legend || this.judge || this.keepsDistance() || ['thief', 'aegis', 'tutor'].includes(this.behavior)) return 1;
      if (this.touchCd > 0.4) this.chaseT = 0;                                  // it has just hit you
      else if (G.U.dist2(this.x, this.y, pl.x, pl.y) < 420 * 420) this.chaseT = (this.chaseT || 0) + dt;
      else this.chaseT = Math.max(0, (this.chaseT || 0) - dt * 2);
      return 1 + Math.min(0.35, Math.max(0, this.chaseT - 8) * 0.03);
    }

    castShields() {
      const near = G.EnemyMgr.queryCircle(this.x, this.y, 160).filter(e => !e.dead)
        .sort((a, b) => G.U.dist2(a.x, a.y, this.x, this.y) - G.U.dist2(b.x, b.y, this.x, this.y)).slice(0, 6);
      for (const e of near) { e.shield = Math.max(e.shield, e.maxHp * 0.35); e.shieldT = 8; }
      this.anim.play('Charge');
      G.FX.ring(this.x, this.y, 8, 160, '#7fc8ff', 0.5, 3);
      if (G.Coop.isHost) G.Coop.broadcast(['fxr', Math.round(this.x), Math.round(this.y), 160, '#7fc8ff']);
    }

    summon() {
      this.minions = this.minions.filter(m => !m.dead && G.EnemyMgr.get(m.id));
      // With the general enemy cap (fewer Pokémon on screen), with a small margin.
      if (this.minions.length >= 4 || G.EnemyMgr.count > G.Spawner.CAP + 25) return;
      const dex = this.def.minion || this.dex;
      const mon = G.DEX_BY[dex];
      const def = { dex, name: mon ? mon.name : '', hp: Math.round(this.def.hp * 0.35), spd: Math.round(this.def.spd * 1.1),
                    dmg: Math.round(this.def.dmg * 0.6), xp: Math.max(1, Math.round(this.def.xp * 0.25)), behavior: 'chase' };
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * 6.2832;
        const m = new Enemy(def, this.x + Math.cos(a) * 30, this.y + Math.sin(a) * 22, this.sc || { hp: 1, spd: 1, dmg: 1 });
        G.EnemyMgr.add(m);
        this.minions.push(m);
        G.FX.burst(m.x, m.y - 8, '#c47bff', 8, 90);
      }
      this.anim.play('Charge');
      G.FX.ring(this.x, this.y, 8, 50, '#c47bff', 0.4, 3);
    }

    startFuse() {
      this.phase = 'fuse'; this.pt = 1.0;
      G.Hazards.add({ sd: this.dex, own: this.hzOwner(), from: this, kind: 'zone', x: this.x, y: this.y, r: 62, delay: 1.0, dmg: this.dmg * 1.4, type: this.atkType, color: '#ff7b3d' });
    }

    startJump(pl) {
      const tx = pl.x, ty = pl.y;
      this.jump = { sx: this.x, sy: this.y, tx, ty, t: -0.45, dur: 0.6 };
      this.anim.play('Charge', { speed: 1.4 });
      G.Hazards.add({ sd: this.dex, own: this.hzOwner(), from: this, kind: 'zone', x: tx, y: ty, r: 50, delay: 1.05, dmg: this.dmg * 1.2, type: this.atkType,
                      color: G.U.TYPE_COLOR[this.atkType] || '#ff7a9e' });
    }

    /** Leap: it crouches, flies in an arc and lands where you were. */
    updateJump(dt) {
      const j = this.jump;
      j.t += dt;
      if (j.t < 0) { this.anim.loop('Idle'); return; }
      const k = Math.min(1, j.t / j.dur);
      this.x = j.sx + (j.tx - j.sx) * k;
      this.y = j.sy + (j.ty - j.sy) * k;
      this.jumpLift = Math.sin(k * Math.PI) * 46;
      this.anim.dir = G.Sprites.dirFromAngle(Math.atan2(j.ty - j.sy, j.tx - j.sx));
      if (k >= 1) {
        this.jump = null; this.jumpLift = 0;
        if (!this.flying) G.World.collide(this);
        this.anim.play('Attack', { speed: 1.4 });
      }
    }

    /** Called by combat.js when it touches you: animates the hit. */
    strike(pl) {
      if (!this.anim.busy()) {
        this.anim.dir = G.Sprites.dirFromAngle(Math.atan2(pl.y - this.y, pl.x - this.x));
        this.anim.play('Attack', { speed: 1.5 });
      }
    }

    /** Small chips above the health bar: one per status, burn/poison with the stack count. */
    drawStatus(ctx) {
      const st = this.remote ? (this.net && this.net.st) || 0 : 0;
      const burn = this.remote ? (st >> 7) & 15 : this.burn | 0;
      const poison = this.remote ? (st >> 11) & 15 : this.poison | 0;
      const slow = this.remote ? !!(st & 32768) : this.slowT > 0 && this.slow > 0;
      const frozen = this.remote ? !!(st & 8) : this.freezeT > 0;
      const chips = [];
      if (burn) chips.push(['#ff7a2f', burn]);
      if (poison) chips.push(['#b45ee0', poison]);
      if (slow) chips.push(['#5fa8ff', 0]);
      if (frozen) chips.push(['#bff3ff', 0]);
      if (!chips.length) return false;
      const H = 9, gap = 2;
      const wOf = c => (c[1] ? 15 : 7);
      const total = chips.reduce((s, c) => s + wOf(c), 0) + gap * (chips.length - 1);
      let x = Math.round(this.x - total / 2);
      const y = Math.round(this.y - this.bodyH - (this.boss || this.hp < this.maxHp ? 22 : 14));
      ctx.save();
      ctx.font = '700 8px Pixelify,"Segoe UI",system-ui,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const c of chips) {
        const w = wOf(c);
        ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(x - 1, y - 1, w + 2, H + 2);
        ctx.fillStyle = c[0]; ctx.fillRect(x, y, w, H);
        if (c[1]) { ctx.fillStyle = '#10131a'; ctx.fillText(String(c[1]), x + w / 2, y + H / 2 + 0.5); }
        x += w + gap;
      }
      ctx.restore();
      return true;
    }

    draw(ctx) {
      const alpha = this.dead ? G.U.clamp(this.fade / 0.5, 0, 1) : 1;
      if (alpha <= 0) return;

      const gold = this.golden || this.behavior === 'thief' || (this.remote && !this.boss && G.Events.golden);
      if ((this.boss || this.shiny || gold) && !this.dead) {
        ctx.save();
        ctx.globalAlpha = (gold && !this.boss ? 0.32 : 0.22) + Math.sin(this.bob * 0.5) * 0.06;
        ctx.fillStyle = this.ai && this.ai.fury ? '#ff4a4a' : this.shiny ? '#9ae6ff' : gold ? '#ffd23f' : '#ffd95e';
        ctx.beginPath(); ctx.ellipse(this.x, this.y, this.r * 1.6, this.r * 0.6, 0, 0, 6.2832); ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      if (this.behavior !== 'clone') G.Sprites.drawShadow(ctx, this.dex, this.x, this.y, this.scale);     // (Gengar's clones cast none: the tell)
      // Floaters are already in the air in their sprite: they just bob a little.
      // (And the leapers, in an arc.)
      const lift = (this.flying && !this.boss ? 1 + Math.sin(this.bob) * 1.5 : 0) + (this.jumpLift || 0);
      this.anim.draw(ctx, this.x, this.y - lift, { flash: this.flash > 0, alpha });
      ctx.restore();

      if (this.dead) return;

      // Shield: a blue bubble.
      if (this.shield > 0 || (this.net && this.net.st & 4)) {
        ctx.save();
        ctx.globalAlpha = 0.35 + Math.sin(this.bob) * 0.08;
        ctx.strokeStyle = '#9fd8ff'; ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(127,200,255,.14)';
        ctx.beginPath(); ctx.ellipse(this.x, this.y - this.bodyH * 0.45, this.r * 1.5, this.bodyH * 0.65, 0, 0, 6.2832);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }

      // Aegislash: blue bubble + shield icon in Shield Forme, red aura + fist in Blade Forme.
      if (this.behavior === 'aegis') {
        const sh = this.remote ? !!(this.net && this.net.st & 16) : this.aegisShield;
        ctx.save();
        ctx.globalAlpha = 0.3 + Math.sin(this.bob) * 0.06;
        ctx.fillStyle = sh ? '#8fb4ff' : '#ff5f6d';
        ctx.beginPath(); ctx.ellipse(this.x, this.y - this.bodyH * 0.45, this.r * 1.5, this.bodyH * 0.62, 0, 0, 6.2832); ctx.fill();
        ctx.restore();
        G.Icons.draw(ctx, sh ? 'shield' : 'fist', Math.round(this.x - 7), Math.round(this.y - this.bodyH - (this.hp < this.maxHp ? 30 : 22)), 14);
      }

      if (this.freezeT > 0 || (this.net && this.net.st & 8)) {
        const stun = this.remote ? !!(this.net && this.net.st & 32) : this.stunned;
        const top = this.y - this.bodyH - (this.hp < this.maxHp ? 26 : 18);
        ctx.save();
        if (stun) {
          // Stunned: little stars circling over its head.
          for (let i = 0; i < 3; i++) {
            const a = this.bob * 1.6 + i * 2.094;
            G.Icons.draw(ctx, 'star', Math.round(this.x + Math.cos(a) * this.r * 0.9 - 4), Math.round(top + 4 + Math.sin(a) * 3), 8);
          }
        } else {
          ctx.globalAlpha = 0.28 + Math.sin(this.bob * 0.5) * 0.05;
          ctx.fillStyle = '#9fe6ff';
          ctx.beginPath(); ctx.ellipse(this.x, this.y - this.bodyH * 0.45, this.r * 1.2, this.bodyH * 0.6, 0, 0, 6.2832); ctx.fill();
        }
        ctx.restore();
        if (!stun) G.Icons.draw(ctx, 'stopwatch', Math.round(this.x - 6), Math.round(top - 12), 12);
      }

      // Acid Spray: green acid drips off it while it takes more damage.
      if (this.vulnT > 0 || (this.net && this.net.st & 64)) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#9be04a';
        ctx.beginPath(); ctx.ellipse(this.x, this.y, this.r * 1.1, this.r * 0.45, 0, 0, 6.2832); ctx.fill();
        ctx.restore();
        if (Math.random() < 0.12) G.FX.px(this.x + G.U.rand(-this.r, this.r) * 0.7, this.y - G.U.rand(4, this.bodyH * 0.8), '#b6f05a', { vy: 30, life: 0.4 });
      }

      if (this.burn > 0 || this.poison > 0 || (this.net && this.net.st & 3)) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = this.burn > 0 || (this.net && this.net.st & 1) ? '#ff8a3d' : '#c86bdc';
        ctx.beginPath(); ctx.ellipse(this.x, this.y, this.r * 1.2, this.r * 0.5, 0, 0, 6.2832); ctx.fill();
        ctx.restore();
      }

      // Status badges over its head: burn and poison with their stacks, slowed, frozen/stunned (20-10-2026).
      const stLift = this.drawStatus(ctx) ? 12 : 0;     // icons above go up a row to make room

      // Supports: an icon above, so you know who to go for first.
      const SUP = { healer: 'heart', shielder: 'shield', summoner: 'friends' };
      if (SUP[this.behavior]) G.Icons.draw(ctx, SUP[this.behavior], Math.round(this.x - 6), Math.round(this.y - this.bodyH - (this.hp < this.maxHp ? 26 : 18) - stLift), 12);

      if (this.boss || this.hp < this.maxHp) {
        const w = this.boss ? 90 : Math.max(22, this.r * 2);
        const y = this.y - this.bodyH - 10;
        ctx.fillStyle = 'rgba(0,0,0,.6)';
        ctx.fillRect(this.x - w / 2, y, w, 3.4);
        ctx.fillStyle = this.boss ? '#ffcb3d' : '#ff5f6d';
        ctx.fillRect(this.x - w / 2, y, w * Math.max(0, this.hp / this.maxHp), 3.4);
      }
    }
  }

  // ---------------- gestor ----------------

  G.Enemy = Enemy;

  G.EnemyMgr = (() => {
    let list = [];            // vivos
    let corpses = [];         // falling / fading out
    const CELL = 52;
    const grid = new Map();

    const byId = new Map();
    // Stopwatch: while it lasts, enemies that appear are frozen too (bosses are slowed), for the time that is left.
    let stopLeft = 0;
    function timeStop(dur) { stopLeft = Math.max(stopLeft, dur); }
    function clear() { list = []; corpses = []; grid.clear(); byId.clear(); stopLeft = 0; }
    function all() { return list; }
    function add(e) {
      if (stopLeft > 0 && !e.judge && !e.remote) { if (e.boss) e.applySlow(0.5, stopLeft); else e.freeze(stopLeft); }
      list.push(e);
      byId.set(e.id, e);
      if (G.Coop.isHost) G.Coop.enemyAdded(e);
      return e;
    }
    function get(id) { return byId.get(id); }

    /** Local copy of an enemy from the host (co-op). */
    function addRemote(o) {
      if (byId.has(o.id)) return byId.get(o.id);
      const def = { dex: o.dex, hp: o.hp, spd: 0, dmg: o.dmg, xp: 0, behavior: o.beh || 'remote' };
      const e = new Enemy(def, o.x, o.y, { hp: 1, spd: 1, dmg: 1 }, o.boss);
      e.id = o.id;
      e.remote = true;
      if (o.shiny) e.makeShiny();
      e.maxHp = o.hp; e.hp = o.hp;
      if (o.life > 0) e.life = o.life;                 // Aegislash / thief: time left before it leaves
      e.net = { x: o.x, y: o.y, vx: 0, vy: 0, age: 0, dir: 0, anim: 0, st: 0 };
      list.push(e);
      byId.set(e.id, e);
      return e;
    }

    // --- rift arena ---
    let stashed = null;

    /** Stores the map's enemies while the arena lasts. */
    function stash() {
      stashed = list.filter(e => !e.dead);
      for (const e of stashed) byId.delete(e.id);
      list = []; corpses = [];
    }

    /** On returning: removes the arena's ones and brings back the map's (telling the others). */
    function restore() {
      for (const e of list) { byId.delete(e.id); if (G.Coop.isHost) G.Coop.enemyGone(e, false); }
      list = []; corpses = [];
      for (const e of stashed || []) add(e);
      stashed = null;
    }

    /** Guest: deletes the copies (they'll arrive again from the host). */
    function clearRemote() {
      for (const e of list) if (e.remote) byId.delete(e.id);
      list = list.filter(e => !e.remote);
      corpses = corpses.filter(e => !e.remote);
    }

    /** Removes a copy (the host says it has fallen or moved away). */
    function removeRemote(id, died) {
      const e = byId.get(id);
      if (!e) return;
      byId.delete(id);
      if (died) { e.die(); G.Progress.kill(e); }
      const i = list.indexOf(e);
      if (i >= 0) list.splice(i, 1);
      if (died) corpses.push(e);
    }

    function key(cx, cy) { return cx * 73856093 ^ cy * 19349663; }

    function rebuildGrid() {
      grid.clear();
      for (const e of list) {
        if (e.dead) continue;
        const k = key(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
        let b = grid.get(k);
        if (!b) grid.set(k, b = []);
        b.push(e);
      }
    }

    /** Living enemies whose circle touches this circle. */
    function queryCircle(x, y, r) {
      const out = [];
      const c0x = Math.floor((x - r) / CELL) - 1, c1x = Math.floor((x + r) / CELL) + 1;
      const c0y = Math.floor((y - r) / CELL) - 1, c1y = Math.floor((y + r) / CELL) + 1;
      for (let cy = c0y; cy <= c1y; cy++) {
        for (let cx = c0x; cx <= c1x; cx++) {
          const b = grid.get(key(cx, cy));
          if (!b) continue;
          for (const e of b) {
            if (e.dead) continue;
            const rr = r + e.r;
            if (G.U.dist2(x, y, e.x, e.y) <= rr * rr) out.push(e);
          }
        }
      }
      return out;
    }

    function separate(dt) {
      for (const e of list) {
        if (e.dead) continue;
        const cx = Math.floor(e.x / CELL), cy = Math.floor(e.y / CELL);
        let px = 0, py = 0, n = 0;
        for (let j = -1; j <= 1; j++) {
          for (let i = -1; i <= 1; i++) {
            const b = grid.get(key(cx + i, cy + j));
            if (!b) continue;
            for (const o of b) {
              if (o === e || o.dead) continue;
              const min = (e.r + o.r) * 0.82;
              const dx = e.x - o.x, dy = e.y - o.y;
              const d2 = dx * dx + dy * dy;
              if (d2 > min * min || d2 < 1e-4) continue;
              const d = Math.sqrt(d2);
              const f = (min - d) / min;
              px += (dx / d) * f; py += (dy / d) * f;
              if (++n > 6) break;
            }
          }
        }
        if (n) {
          e.x += px * 42 * dt;
          e.y += py * 42 * dt;
          if (!e.flying) G.World.collide(e);
        }
      }
    }

    /** The nearest living player (fallen ones don't attract anyone). A Ring Target holder counts as nearer. */
    function nearestPlayer(players, x, y) {
      let best = null, bd = Infinity;
      for (const p of players) {
        if (p.dead) continue;
        const d = G.U.dist2(x, y, p.x, p.y) * G.KeyItems.targetK(p);
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    }

    /**
     * @param players  [local player, ...teammates]. The run's stats
     *                 (defeated, bosses) are recorded on the first.
     */
    // Seconds a straggler has to be out of view before returning ahead.
    const LAG_T = 2.5;

    function update(dt, players) {
      if (stopLeft > 0) stopLeft = Math.max(0, stopLeft - dt);
      if (!Array.isArray(players)) players = [players];
      const pl = players[0];
      // Smoothed velocity of each player (works for teammates too).
      for (const p of players) {
        if (p._px != null && dt > 0) {
          const k = Math.min(1, dt * 5);
          p._vx += ((p.x - p._px) / dt - p._vx) * k; p._vy += ((p.y - p._py) / dt - p._vy) * k;
          if (Math.abs(p.x - p._px) > 200 || Math.abs(p.y - p._py) > 200) p._vx = p._vy = 0;    // teletransporte
        } else { p._vx = 0; p._vy = 0; }
        p._px = p.x; p._py = p.y;
      }
      rebuildGrid();
      for (const e of list) {
        if (e.remote) e.netUpdate(dt);
        else {
          const tp = nearestPlayer(players, e.x, e.y) || pl;
          const dc = G.Combat.decoyFor(e, tp);       // Substitute: go for the decoy instead
          e.update(dt, dc ? G.Combat.decoyTarget(dc, tp) : tp);
        }
      }
      if (!G.Coop.active || G.Coop.isHost) separate(dt);
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        if (e.remote) {
          // Co-op guest: a treasure goblin (Meowth / Gholdengo) or Aegislash that the host's "it left" message
          // never removed would stay on screen forever. Once its time is up (plus a grace for lag), or if the
          // copy has outlived the longest it could last, it leaves here too.
          if ((e.behavior === 'thief' || e.behavior === 'aegis' || e.behavior === 'tutor') && !e.dead) {
            e.remoteT = (e.remoteT || 0) + dt;
            if (e.life <= 0) e.overT = (e.overT || 0) + dt;
            if (e.overT > 3 || e.remoteT > (e.behavior === 'aegis' ? 80 : e.behavior === 'tutor' ? 65 : 20)) {
              G.FX.burst(e.x, e.y - 10, e.behavior === 'aegis' ? '#9fb4ff' : '#ffd23f', 16, 140);
              list.splice(i, 1); byId.delete(e.id);
            }
          }
          continue;
        }
        if (e.dead) {
          pl.kills++;
          if (e.boss && !e.judge && e.behavior !== 'clone') pl.bosses++;
          G.Progress.kill(e);
          corpses.push(e);
          list.splice(i, 1);
          byId.delete(e.id);
          if (G.Coop.isHost) G.Coop.enemyGone(e, true);
          continue;
        }
        const near = nearestPlayer(players, e.x, e.y) || pl;
        // The treasure goblin escapes if you don't catch it in time.
        if (e.behavior === 'aegis' && e.life < 16 && !e.warned) { e.warned = true; G.Spawner.say('The Aegislash is about to leave!', 2.4); }
        if (e.behavior === 'tutor' && e.life < 12 && !e.warned) { e.warned = true; G.Spawner.say('Spiritomb\'s portal is closing!', 2.4); }
        if ((e.behavior === 'thief' || e.behavior === 'aegis' || e.behavior === 'tutor') && (e.life -= dt) <= 0) {
          G.FX.burst(e.x, e.y - 10, e.behavior === 'aegis' ? '#9fb4ff' : e.behavior === 'tutor' ? '#9b6bd6' : '#ffd23f', 16, 140);
          G.Spawner.say(e.behavior === 'aegis' ? 'The Aegislash left with its armoury!' : e.behavior === 'tutor' ? 'Spiritomb sank back into its portal.' : e.name + ' got away!', 2.4);
          list.splice(i, 1); byId.delete(e.id);
          if (G.Coop.isHost) G.Coop.enemyGone(e, false);
          continue;
        }
        if (e.boss || e.shiny || G.Rift.inArena || G.Tower.active) continue;      // (arenas are closed: nothing to catch up)
        // Stragglers: those that fall behind while you run and have been
        // OUT OF VIEW (of everyone) for a while reappear ahead of you. That way
        // you can't simply run away, and one you're looking at never disappears.
        const d2 = G.U.dist2(e.x, e.y, near.x, near.y);
        const R = G.Camera.outerRadius() + 40;
        const unseen = d2 > R * R && !G.Camera.sees(e.x, e.y, 60);
        const sp = Math.hypot(near._vx || 0, near._vy || 0);
        const behind = sp > 40 && ((e.x - near.x) * near._vx + (e.y - near.y) * near._vy) < -0.2 * Math.sqrt(d2) * sp;
        if (unseen && behind) e.lagT += dt;
        else if (!unseen) e.lagT = 0;
        if ((unseen && e.lagT > LAG_T) || d2 > 1400 * 1400) {
          e.lagT = 0;
          if (!G.Spawner.ahead(e, near)) { list.splice(i, 1); byId.delete(e.id); if (G.Coop.isHost) G.Coop.enemyGone(e, false); }
        }
      }
      for (let i = corpses.length - 1; i >= 0; i--) {
        if (corpses[i].remote) corpses[i].netUpdate(dt); else corpses[i].update(dt, pl);
        if (corpses[i].fade <= 0) corpses.splice(i, 1);
      }
      if (corpses.length > 120) corpses.splice(0, corpses.length - 120);
    }

    /** What has to be drawn sorted by Y along with the rest of the scene. */
    function drawables(cam) {
      const out = [];
      for (const e of corpses) if (cam.sees(e.x, e.y, 80)) out.push(e);
      for (const e of list) if (cam.sees(e.x, e.y, 80)) out.push(e);
      return out;
    }

    function bossAlive() { return list.some(e => e.boss && !e.dead); }
    function shinies() { return list.filter(e => e.shiny && !e.dead); }

    return { timeStop, clear, all, add, get, addRemote, removeRemote, stash, restore, clearRemote, update, drawables, queryCircle, rebuildGrid, bossAlive, shinies, nearestPlayer,
             get count() { return list.length; } };
  })();
})();
