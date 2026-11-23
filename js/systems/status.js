/* ============ status.js — status conditions on YOUR Pokémon (23-11-2026) ============
 * Enemy hits can leave a status on you, by the type of the hit:
 *
 *   BRN  Burned     fire            loses health over time
 *   PSN  Poisoned   poison, bug     loses health over time (slower, lasts longer)
 *   SED  Seeded     grass           Leech Seed: loses a little health over time
 *   CHL  Chilled    ice             moves 35% slower
 *   PAR  Paralyzed  electric        15% slower, and now and then can't move or attack for a moment
 *   CNF  Confused   psychic, fairy  your movement is reversed
 *   CRS  Cursed     ghost, dark     healing and regeneration are halved
 *   SLP  Asleep     boss pools      can't move or attack until something hits you (or it wears off)
 *
 * Only one status at a time (like the games): a new one waits until the current one is over, and after one
 * ends you can't get another for a moment (longer after sleep, so you can walk out of a sleep pool).
 * Health lost to a status never knocks you out: it stops at 1.
 *
 * Bosses also leave status POOLS on the ground (Enemy.bossStart 'pool', drawn by systems/hazards.js): standing
 * in one gives you its status. Sleep is the pool of most types.
 *
 * Every computer handles only its own Pokémon (the hits, shots and hazards that land on it), so nothing is sent
 * over the network except the pools, which travel with the hazards ('hz').
 */
G.Status = (() => {
  const DEFS = {
    brn: { name: 'Burned',    tag: 'BRN', col: '#ff7b3d', dur: 4,   dot: 0.012, fx: '#ffb347' },
    psn: { name: 'Poisoned',  tag: 'PSN', col: '#b061e0', dur: 6,   dot: 0.008, fx: '#d58cff' },
    sed: { name: 'Seeded',    tag: 'SED', col: '#5fc23a', dur: 5,   dot: 0.007, fx: '#9be56c' },
    chl: { name: 'Chilled',   tag: 'CHL', col: '#7fd8f5', dur: 3,   spd: 0.65,  fx: '#e6f8ff' },
    par: { name: 'Paralyzed', tag: 'PAR', col: '#e8c020', dur: 4,   spd: 0.85,  fx: '#fff27a' },
    cnf: { name: 'Confused',  tag: 'CNF', col: '#e070c0', dur: 2.5,             fx: '#ffb3e6' },
    crs: { name: 'Cursed',    tag: 'CRS', col: '#6d4fc0', dur: 6,   heal: 0.5,  fx: '#a58cff' },
    slp: { name: 'Asleep',    tag: 'SLP', col: '#8a9cff', dur: 4,               fx: '#dfe5ff' }
  };
  /** The status a hit of each type can leave. */
  const BY_TYPE = { fire: 'brn', poison: 'psn', bug: 'psn', grass: 'sed', ice: 'chl', electric: 'par',
                    psychic: 'cnf', fairy: 'cnf', ghost: 'crs', dark: 'crs' };
  /** The status of a boss's pool, by the boss's attack type (sleep for the rest). */
  const POOL = { poison: 'psn', bug: 'psn', fire: 'brn', ice: 'chl', water: 'chl', electric: 'par', steel: 'par', ghost: 'crs', dark: 'crs' };
  /** Your own types that are immune (as in the games: Fire can't be burned, Steel can't be poisoned...). */
  const TYPE_IMMUNE = { brn: ['fire'], psn: ['poison', 'steel'], sed: ['grass'], chl: ['ice'], par: ['electric'], cnf: ['dark'], crs: ['normal'] };

  // Chance that a hit leaves its status: ordinary foes, bosses (and rift legends), and bosses' warned attacks.
  const CHANCE = { hit: 0.05, boss: 0.15, hazard: 0.25 };
  const GRACE = 2, SLEEP_GRACE = 2.5;        // seconds after a status ends with no new one

  const S = pl => pl.st || (pl.st = { id: null, t: 0, grace: 0, tick: 0, stall: 0, stallIn: 1.2 });

  /** Pools: the status a boss of type `type` leaves on the ground. */
  const poolFor = type => POOL[type] || 'slp';

  function immune(pl, id) {
    const types = G.Abil.defTypes(pl) || [];
    if ((TYPE_IMMUNE[id] || []).some(t => types.includes(t))) return true;
    return G.Abil.statusImmune(pl, id);
  }

  /**
   * Gives status `id` to `pl` (your own Pokémon). `k`: duration multiplier. → true if it landed (or refreshed).
   */
  function apply(pl, id, k = 1) {
    const d = DEFS[id], s = S(pl);
    if (!d || pl.dead || pl !== G.Game.player) return false;
    if (s.id && s.id !== id) return false;                 // one at a time
    if (!s.id && s.grace > 0) return false;
    if (immune(pl, id)) return false;
    const dur = d.dur * k / (G.Abil.statusK(pl) || 1);     // (Early Bird: half as long)
    const fresh = s.id !== id;
    if (fresh) { s.id = id; s.tick = 0.5; s.stall = 0; s.stallIn = G.U.rand(0.8, 1.4); s.t = dur; }
    else if (id !== 'slp') s.t = Math.max(s.t, dur);      // (sleep isn't extended: you'd never wake up in a pool)
    if (fresh) {
      G.FX.dmgText(pl.x, pl.y - pl.bodyH - 14, d.name + '!', d.col, true);
      G.FX.ring(pl.x, pl.y, pl.r, pl.r * 2.6, d.col, 0.4, 3);
      G.FX.burst(pl.x, pl.y - pl.bodyH * 0.5, d.fx, 8, 90);
      G.Abil.debuff(pl, null);                             // (Defiant, Competitive...)
    }
    return true;
  }

  /**
   * A hit landed on you (Player.hurt): it may leave the status of its type.
   * `src`: the hit's source ({ k: 'shot' | 'contact' | 'zone' | 'beam' ..., e, own, st }).
   */
  function fromHit(pl, type, src) {
    if (!src || pl.dead) return;
    // A boss's pool or a hazard that names its status.
    if (src.st) { apply(pl, src.st); return; }
    const id = type && BY_TYPE[type];
    if (!id) return;
    const k = src.k;
    if (k !== 'shot' && k !== 'contact' && k !== 'zone' && k !== 'beam') return;
    const boss = !!(src.own || (src.e && (src.e.boss || src.e.legend)));
    const p = (k === 'zone' || k === 'beam') && boss ? CHANCE.hazard : boss ? CHANCE.boss : CHANCE.hit;
    if (Math.random() < p) apply(pl, id, boss ? 1 : 0.75);
  }

  /** Something hurt you: it wakes you up. */
  function onHurt(pl) {
    const s = pl.st;
    if (s && s.id === 'slp') { end(pl); G.FX.dmgText(pl.x, pl.y - pl.bodyH - 14, 'Woke up!', '#ffffff', true); }
  }

  function end(pl) {
    const s = S(pl);
    if (!s.id) return;
    s.grace = s.id === 'slp' ? SLEEP_GRACE : GRACE;
    s.id = null; s.t = 0; s.stall = 0;
  }

  /** Clears everything (death, revive, a new run, the Balance Lab, Natural Cure). */
  function clear(pl) { if (pl.st) { pl.st.id = null; pl.st.t = 0; pl.st.grace = 0; pl.st.stall = 0; } }

  /** Every frame, for your own Pokémon (Player.update). */
  function update(pl, dt) {
    const s = pl.st;
    if (!s) return;
    if (pl.dead) { clear(pl); return; }
    if (s.grace > 0) s.grace -= dt;
    if (!s.id) return;
    const d = DEFS[s.id];
    if ((s.t -= dt) <= 0) { end(pl); return; }
    // Health over time: every half second, never below 1.
    if (d.dot && (s.tick -= dt) <= 0) {
      s.tick = 0.5;
      const lose = Math.min(pl.maxHp * d.dot * 0.5, Math.max(0, pl.hp - 1));
      if (lose > 0) {
        pl.hp -= lose; pl.dmgTaken += lose;
        G.FX.dmgText(pl.x + G.U.rand(-6, 6), pl.y - pl.bodyH - 2, '-' + Math.max(1, Math.round(lose)), d.col, false);
      }
      G.FX.burst(pl.x, pl.y - pl.bodyH * 0.5, d.fx, 3, 50);
    }
    // Paralysis: now and then you lock up for a moment.
    if (s.id === 'par') {
      if (s.stall > 0) s.stall -= dt;
      else if ((s.stallIn -= dt) <= 0) {
        s.stall = 0.4; s.stallIn = G.U.rand(1.1, 1.7);
        G.FX.dmgText(pl.x, pl.y - pl.bodyH - 14, 'Fully paralyzed!', d.col, false);
        G.FX.burst(pl.x, pl.y - pl.bodyH * 0.5, d.fx, 6, 80);
      }
    }
    // A little of the status in the air.
    if (Math.random() < dt * 6) G.FX.px(pl.x + G.U.rand(-pl.r, pl.r), pl.y - pl.bodyH * G.U.rand(0.3, 1), d.fx, { vy: -30, life: 0.5 });
  }

  // ---------------- what the rest of the game asks ----------------
  const id = pl => (pl.st && pl.st.id) || null;
  /** Can't move or attack: asleep, or locked up by paralysis. */
  const stuck = pl => !!pl.st && (pl.st.id === 'slp' || (pl.st.id === 'par' && pl.st.stall > 0));
  const confused = pl => !!pl.st && pl.st.id === 'cnf';
  const spdK = pl => { const d = pl.st && pl.st.id && DEFS[pl.st.id]; return (d && d.spd) || 1; };
  const healK = pl => { const d = pl.st && pl.st.id && DEFS[pl.st.id]; return (d && d.heal) || 1; };

  /** A tag over your head (like the games' status labels), and floating z's while asleep. */
  function draw(ctx, pl) {
    const s = pl.st;
    if (!s || !s.id || pl.dead) return;
    const d = DEFS[s.id], x = pl.x, y = pl.y - pl.bodyH - 10;
    ctx.save();
    ctx.font = '700 9px m6x11,Pixelify,"Segoe UI",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = 22, h = 10;
    ctx.globalAlpha = s.t < 1 && Math.floor(s.t * 8) % 2 ? 0.5 : 0.95;   // blinks as it wears off
    ctx.fillStyle = d.col;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, 3); else ctx.rect(x - w / 2, y - h / 2, w, h);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(d.tag, x, y + 0.5);
    if (s.id === 'slp') {
      const t = performance.now() / 1000;
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.6 + i / 3) % 1;
        ctx.globalAlpha = 1 - k;
        ctx.font = '700 ' + (8 + i * 2) + 'px m6x11,Pixelify,"Segoe UI",sans-serif';
        ctx.fillStyle = '#dfe5ff';
        ctx.fillText('z', x + 10 + k * 10, y - 6 - k * 16);
      }
    }
    ctx.restore();
  }

  return { DEFS, BY_TYPE, poolFor, apply, fromHit, onHurt, update, clear, id, stuck, confused, spdK, healK, draw };
})();
