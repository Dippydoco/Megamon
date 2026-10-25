/* ============ abilrun.js — abilities in runs ============
 * Each Pokémon's ability (data/abilities.js: G.ABILITIES / G.MON_ABILITY) acts in runs (since 24-10-2026).
 * Every ability is one entry of A below, with the hooks it needs:
 *
 *   start(pl, S)          the run starts (pl: your Player, S: its ability state, pl.abS)
 *   tick(pl, S, dt)       every frame, on your own computer
 *   stat(pl, S, o)        fills the frame's numbers o: { atk, spa, spd, cd, dr, crit, critMul, regen, reach, heal }
 *   move(pl, S, m)        damage multiplier for one of YOUR moves (at cast time, through Player.pow)
 *   cd(pl, S, m)          cooldown multiplier for one of your moves
 *   hit(pl, S, e, c)      at the moment of a hit on enemy e: c = { type, k (type × weather), mul, crit, pierce, noFx, fxK }
 *   inc(pl, S, h)         a hit is about to hurt you: h = { amount, type, pure, src, e (attacker or null), block, absorb }
 *   hurt(pl, S, h, d)     you've just lost d HP to it
 *   contact(pl, S, e)     an enemy touched you
 *   lethal(pl, S, h, before)  a hit would knock you out: return true to survive at 1 HP
 *   cast(pl, S, m)        you cast m (before it runs); can set S.castMul for that cast
 *   aura(p, es, dt)       HOST / SOLO: enemies es near player p (yours or a teammate's): slows, auras...
 *   team(me, mate, o)     a nearby teammate with this ability changes YOUR numbers o (and o.move(m) for moves)
 *
 * Where the game has no matching mechanic, the closest real one is used:
 *   - Players don't get burned or poisoned. (25-10-2026) The abilities that only worked while you were "burned" or
 *     "poisoned" (Guts, Marvel Scale, Quick Feet, Flare Boost, Poison Heal, Shed Skin, Natural Cure, Hydration, Healer,
 *     Synchronize) were reworked into effects that always come up in a run. "Can't be burned / poisoned" means Fire /
 *     Poison hits deal 20% less (see incoming). "Slowed" means a trap, Hyper Beam's recharge or slowing water/snow.
 *   - "Debuffed" (Defiant, Competitive) = getting slowed, or hit by a boss's or legendary's attack.
 *   - "Contact" = enemies touching you (and melee / dash moves on your side).
 * Weather and terrain bringers start their weather on the host (or solo); everyone sees it.
 */
G.Abil = (() => {
  // ---------------- move families (by id) ----------------
  const SET = a => new Set(a);
  const PUNCH = SET(['drain-punch', 'thunder-punch', 'ice-punch', 'sucker-punch', 'meteor-mash', 'karate-chop', 'focus-punch', 'arm-thrust', 'meteor-assault']);
  const BITE = SET(['bite', 'bug-bite', 'lick', 'ice-fang']);
  const SLICE = SET(['razor-leaf', 'psycho-cut', 'air-slash', 'air-cutter', 'cross-poison', 'aerial-ace', 'karate-chop',
                     'shadow-claw', 'dragon-claw', 'metal-claw', 'breaking-swipe', 'leaf-storm',
                     'leaf-blade', 'fury-cutter', 'sacred-sword', 'razor-shell', 'stone-axe']);
  const SOUND = SET(['hyper-voice', 'bug-buzz', 'disarming-voice', 'boomburst', 'clanging-scales']);
  const PULSE = SET(['aura-sphere', 'dark-pulse', 'dragon-rage', 'water-pulse', 'psywave']);
  const DANCE = SET(['swords-dance', 'dragon-dance']);
  const WIND = SET(['gust', 'ominous-wind', 'fairy-wind', 'heat-wave', 'air-cutter', 'leaf-storm', 'whirlwind', 'tailwind', 'dual-wingbeat']);
  const RECKLESS = SET(['body-slam', 'explosion', 'rollout', 'flame-wheel', 'spark', 'aqua-jet', 'spirit-break', 'psyshield-bash', 'blaze-kick', 'megahorn']);
  const SUPPORT = SET(['protect', 'recover', 'thunder-wave', 'will-o-wisp', 'substitute', 'reflect', 'aqua-ring', 'tailwind', 'iron-defense', 'dark-void', 'tar-shot']);
  const CONTACT_KIND = SET(['melee', 'dash', 'roll', 'spin', 'burrow', 'counter', 'throw', 'combo', 'thrust', 'focus']);
  const contact = m => CONTACT_KIND.has(m.kind);
  const hasFx = m => !!(m.burn || m.poison || m.slow || (m.fx && (m.fx.freeze || m.fx.stun || m.fx.chill || m.fx.vuln)));

  // ---------------- small helpers ----------------
  const now = () => (G.Game.st && G.Game.st.time) || 0;
  const hp = pl => pl.hp / Math.max(1, pl.maxHp);
  const say = (pl, txt, col = '#ffe08a') => G.FX.dmgText(pl.x, pl.y - pl.bodyH - 16, txt, col, true);
  const biomeName = () => { const b = G.World.biome; const B = typeof b === 'number' ? G.Tiles.BIOMES[b] : b; return (B && B.name) || ''; };
  const forest = () => /Forest|Jungle|Meadow/.test(biomeName());
  const cave = () => /Cave|Grotto/.test(biomeName());
  const volcano = () => /Volcano/.test(biomeName());
  const wx = k => { const w = G.Weather.current; return !!(w && w.kind === k); };
  const boss = e => !!(e && (e.boss || e.legend || e.judge));
  const authority = () => !G.Coop.active || G.Coop.isHost;
  /** A timed stacking buff kept in the ability state: add(S, 'key', amount, secs, maxStacks); val(S, 'key'). */
  function add(S, k, amt, secs, max = 1) { const b = S.b[k] || (S.b[k] = { n: 0, t: 0, amt }); b.amt = amt; b.n = Math.min(max, b.n + 1); b.t = secs; }
  const val = (S, k) => { const b = S.b[k]; return b && b.n > 0 ? b.n * b.amt : 0; };
  const on = (S, k) => val(S, k) > 0;
  /** Foes within r of you (counted at most 4 times a second): n, and how many of them are poisoned. */
  function crowd(pl, S, dt, r) {
    if ((S.crowdT = (S.crowdT || 0) - dt) > 0) return S.crowd || { n: 0, psn: 0 };
    S.crowdT = 0.25;
    let n = 0, psn = 0;
    for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, r)) { if (e.dead) continue; n++; if (e.poison > 0) psn++; }
    return (S.crowd = { n, psn });
  }
  /** A weather the ability brings: 60 s at the start, then 30 s every 4 minutes (host / solo starts it, everyone sees it). */
  function bringWeather(S, kind, dt) {
    if (!authority() || G.Rift.inArena || G.Judgment.active || G.Tower.active) return;
    S.wxT = (S.wxT == null ? 0 : S.wxT - dt);
    if (S.wxT > 0) return;
    const first = !S.wxDone;
    S.wxDone = true; S.wxT = 240;
    const cur = G.Weather.current;
    if (cur && cur.kind === kind && cur.left > 20) return;
    G.Weather.debugStart(kind, first ? 60 : 30);
  }
  /** Terrain (Electric / Psychic / Misty Surge): active for the first 30 s and 30 s of every 4 minutes (same clock for all). */
  const terrainOn = () => { const t = now(); return t < 30 || t % 240 < 30; };
  /** Enemies near p (host / solo copies only). */
  const near = (p, R) => G.EnemyMgr.queryCircle(p.x, p.y, R).filter(e => !e.dead && !e.remote);

  // Stat-stacking every 25 defeated foes (Beast Boost, Moxie...): up to +30%.
  const stackKills = (S, pl) => Math.min(0.3, Math.floor(Math.max(0, pl.kills - (S.kills0 || 0)) / 25) * 0.02);
  // A low-HP type boost (Blaze, Torrent, Overgrow, Swarm).
  const pinch = type => ({ move: (pl, S, m) => (m.type === type && hp(pl) < 0.4 ? 1.35 : 1) });
  const typeUp = (type, k) => ({ move: (pl, S, m) => (m.type === type ? k : 1) });
  // Absorbing a type: no damage, and a reaction.
  const absorb = (type, react) => ({
    inc: (pl, S, h) => { if (h.type === type && !h.pure) { h.absorb = true; react(pl, S, h); } }
  });
  const healAbsorb = type => absorb(type, (pl, S, h) => pl.heal(Math.max(2, h.amount * 0.25)));
  const buffAbsorb = (type, key, amt) => absorb(type, (pl, S) => add(S, key, amt, 6, 3));
  // "Foes that touch you have a 30% chance to ..."
  const touch = fn => ({ contact: (pl, S, e) => { if (Math.random() < 0.3) fn(pl, S, e); } });
  // Flat damage reduction (and nothing else the game can show).
  const dr = x => ({ stat: (pl, S, o) => { o.dr += x; } });
  const merge = (...xs) => Object.assign({}, ...xs.map(x => x || {}), {
    // Several hooks of the same name chain.
    ...['stat', 'tick', 'start', 'inc', 'hurt', 'contact', 'hit', 'cast', 'aura'].reduce((acc, k) => {
      const fs = xs.filter(x => x && x[k]).map(x => x[k]);
      if (fs.length > 1) acc[k] = (...a) => { for (const f of fs) f(...a); };
      return acc;
    }, {}),
    ...['move', 'cd'].reduce((acc, k) => {
      const fs = xs.filter(x => x && x[k]).map(x => x[k]);
      if (fs.length > 1) acc[k] = (...a) => fs.reduce((v, f) => v * f(...a), 1);
      return acc;
    }, {})
  });
  // Immunity to being slowed (and to the pseudo-statuses).
  const noSlow = { noSlow: true };
  const noBurn = { noBurn: true }, noPoison = { noPoison: true };
  const noStatus = { noSlow: true, noBurn: true, noPoison: true };
  const noLava = { noLava: true };
  const noWx = { noWx: true };

  // ---------------- the abilities ----------------
  const A = {
    // ===== Offense =====
    'adaptability': { move: (pl, S, m) => (pl.mon.types.includes(m.type) ? 1.25 : 1) },
    'analytic': { hit: (pl, S, e, c) => { if (e.abHitAt && now() - e.abHitAt < 1) c.mul *= 1.25; e.abHitAt = now(); } },
    'anger-point': { hit: (pl, S, e, c) => { if (c.crit) add(S, 'anger', 0.5, 8); }, hurt: (pl, S, h, d) => { if (d > pl.maxHp * 0.2) add(S, 'anger', 0.5, 8); },
                     stat: (pl, S, o) => { o.atk *= 1 + val(S, 'anger'); } },
    'beast-boost': { stat: (pl, S, o) => { const k = 1 + stackKills(S, pl); if (pl.baseAtk >= pl.baseSpa) o.atk *= k; else o.spa *= k; } },
    'berserk': { stat: (pl, S, o) => { if (hp(pl) < 0.5) o.spa *= 1.3; } },
    'blaze': pinch('fire'),
    'chilling-neigh': { stat: (pl, S, o) => { o.atk *= 1 + stackKills(S, pl); } },
    'competitive': { debuff: (pl, S) => add(S, 'comp', 0.2, 8, 3), stat: (pl, S, o) => { o.spa *= 1 + val(S, 'comp'); } },
    'compound-eyes': { stat: (pl, S, o) => { o.crit += 0.1; o.shotLife *= 1.15; } },
    'contrary': { tick: (pl, S, dt) => { if ((S.ct = (S.ct || 0) + dt) >= 20) { S.ct = 0; S.contrary = Math.min(5, (S.contrary || 0) + 1); say(pl, 'Contrary!'); } },
                  stat: (pl, S, o) => { const k = 1 + 0.08 * (S.contrary || 0); o.atk *= k; o.spa *= k; } },
    'defeatist': { stat: (pl, S, o) => { const k = hp(pl) >= 0.5 ? 1.3 : 0.8; o.atk *= k; o.spa *= k; } },
    'defiant': { debuff: (pl, S) => add(S, 'defi', 0.2, 8, 3), stat: (pl, S, o) => { o.atk *= 1 + val(S, 'defi'); } },
    'download': { tick: (pl, S, dt) => {
                    if ((S.dl = (S.dl == null ? 0 : S.dl - dt)) > 0) return;
                    S.dl = 30; const m = pl.activeMove(); S.dlStat = m && m.cat === 'physical' ? 'atk' : 'spa'; add(S, 'dl', 0.2, 30); say(pl, 'Download: ' + (S.dlStat === 'atk' ? 'Attack' : 'Sp. Atk') + ' up');
                  },
                  stat: (pl, S, o) => { if (on(S, 'dl')) o[S.dlStat] *= 1.2; } },
    'dragons-maw': typeUp('dragon', 1.4),
    'electromorphosis': { hurt: (pl, S) => { S.charged = true; }, cast: (pl, S, m) => { if (S.charged && m.type === 'electric') { S.castMul = 2; S.charged = false; say(pl, 'Charged!', '#ffe14d'); } } },
    // (25-10-2026 reworks: these used to need you burned / poisoned, which players never are.)
    'flare-boost': { stat: (pl, S, o) => { o.spa *= 1 + 0.5 * (1 - hp(pl)); } },
    'grim-neigh': { stat: (pl, S, o) => { o.spa *= 1 + stackKills(S, pl); } },
    'guts': { hurt: (pl, S) => { add(S, 'guts', 0.08, 6, 5); }, stat: (pl, S, o) => { o.atk *= 1 + val(S, 'guts'); } },
    'huge-power': { stat: (pl, S, o) => { o.atk *= 1.35; } },
    'hunger-switch': { move: (pl, S, m) => { const full = Math.floor(now() / 10) % 2 === 0; return (full ? m.type === 'electric' : m.type === 'dark') ? 1.15 : 1; } },
    'hustle': { stat: (pl, S, o) => { o.atk *= 1.25; }, hit: (pl, S, e, c, m) => { if (m && m.cat === 'physical' && Math.random() < 0.1) { c.mul = 0; c.miss = true; } } },
    'infiltrator': { hit: (pl, S, e, c) => { c.pierce = true; } },
    'intrepid-sword': { stat: (pl, S, o) => { o.atk *= now() < 180 ? 1.3 : 1.1; } },
    'iron-fist': { move: (pl, S, m) => (PUNCH.has(m.id) ? 1.25 : 1) },
    'justified': { hurt: (pl, S, h) => { if (h.type === 'dark') add(S, 'just', 0.2, 8, 3); }, stat: (pl, S, o) => { o.atk *= 1 + val(S, 'just'); },
                   hit: (pl, S, e, c) => { if ((e.types || []).includes('dark')) c.mul *= 1.15; } },
    'keen-eye': { stat: (pl, S, o) => { o.crit += 0.06; o.reach *= 1.1; o.shotLife *= 1.1; } },
    'libero': { move: () => 1.15 },
    'protean': { move: () => 1.15 },
    'lightning-rod': merge(buffAbsorb('electric', 'rod', 0.2), { stat: (pl, S, o) => { o.spa *= 1 + val(S, 'rod'); } }),
    'storm-drain': merge(buffAbsorb('water', 'storm', 0.2), { stat: (pl, S, o) => { o.spa *= 1 + val(S, 'storm'); } }),
    'liquid-voice': { type: (pl, m) => (SOUND.has(m.id) ? 'water' : null), move: (pl, S, m) => (SOUND.has(m.id) ? 1.15 : 1) },
    'long-reach': { reachMove: m => (contact(m) ? 1.3 : 1) },
    'mega-launcher': { move: (pl, S, m) => (PULSE.has(m.id) || m.kind === 'aura' ? 1.35 : 1), reachMove: m => (PULSE.has(m.id) || m.kind === 'aura' ? 1.35 : 1) },
    'merciless': { hit: (pl, S, e, c) => { if (e.poison > 0) c.crit = true; } },
    'mold-breaker': { hit: (pl, S, e, c) => { c.pierce = true; if (c.k < 0.5) c.mul *= 1 / Math.max(0.3, c.k); } },
    'moxie': { stat: (pl, S, o) => { o.atk *= 1 + stackKills(S, pl); } },
    'normalize': { type: () => 'normal', move: () => 1.2 * 1.2 },
    'pixilate': { type: (pl, m) => (m.type === 'normal' ? 'fairy' : null), move: (pl, S, m) => (m.type === 'normal' ? 1.2 : 1) },
    'refrigerate': { type: (pl, m) => (m.type === 'normal' ? 'ice' : null), move: (pl, S, m) => (m.type === 'normal' ? 1.2 : 1) },
    'propeller-tail': { pierce: 1 },
    'protosynthesis': { stat: (pl, S, o) => { const k = wx('sun') ? 1.3 : 1.15; bestStat(pl, o, k); } },
    'quark-drive': { stat: (pl, S, o) => { const k = pl.power ? 1.3 : 1.15; bestStat(pl, o, k); } },
    'punk-rock': { move: (pl, S, m) => (SOUND.has(m.id) ? 1.3 : 1) },
    'pure-power': { stat: (pl, S, o) => { o.atk *= 1.35; } },
    'reckless': { move: (pl, S, m) => (m.kind === 'dash' || RECKLESS.has(m.id) ? 1.25 : 1) },
    'sap-sipper': merge(buffAbsorb('grass', 'sap', 0.2), { stat: (pl, S, o) => { o.atk *= 1 + val(S, 'sap'); } }),
    'schooling': { tick: (pl, S) => {
                     const want = pl.level >= 20 && hp(pl) > 0.25;
                     if (want && !S.school) { const b0 = pl.maxHp; pl.addMaxHp(pl.maxHp * 0.5); S.school = pl.maxHp - b0; say(pl, 'School Form!', '#7fb8ff'); }
                     else if (!want && S.school) { pl.maxHp -= S.school; pl.hp = Math.min(pl.hp, pl.maxHp); S.school = 0; say(pl, 'Solo Form', '#9fb1c9'); }
                   },
                   stat: (pl, S, o) => { if (S.school) { o.atk *= 1.4; o.spa *= 1.4; } } },
    'sharpness': { move: (pl, S, m) => (SLICE.has(m.id) ? 1.35 : 1) },
    'sheer-force': { move: (pl, S, m) => (hasFx(m) ? 1.3 : 1), hit: (pl, S, e, c) => { c.noFx = true; } },
    'simple': { simple: true },
    'skill-link': { extraShots: m => (m.kind === 'projectile' && (m.count | 0) >= 2 ? 1 : 0) },
    'slow-start': { stat: (pl, S, o) => { if (now() < 300) { o.atk *= 0.5; o.spd *= 0.5; } else { o.atk *= 1.4; o.spd *= 1.2; } },
                    tick: (pl, S) => { if (!S.slowDone && now() >= 300) { S.slowDone = true; say(pl, 'Slow Start is over!'); } } },
    'sniper': { stat: (pl, S, o) => { o.critMul *= 2.25 / 1.5; } },
    'solar-power': { stat: (pl, S, o) => { o.spa *= wx('sun') ? 1.4 : 1.12; },
                     tick: (pl, S, dt) => { if (wx('sun') && pl.hp > pl.maxHp * 0.02 + 1) pl.hp -= pl.maxHp * 0.01 * dt; } },
    'soul-heart': { stat: (pl, S, o) => { o.spa *= 1 + stackKills(S, pl); } },
    'stance-change': { cast: (pl, S) => { S.lastCast = now(); },
                       stat: (pl, S, o) => { if (now() - (S.lastCast || -9) < 2) { o.atk *= 1.25; o.spa *= 1.25; } else o.dr += 0.25; } },
    'steelworker': typeUp('steel', 1.4),
    'strong-jaw': { move: (pl, S, m) => (BITE.has(m.id) ? 1.35 : 1) },
    'super-luck': { stat: (pl, S, o) => { o.crit += 0.1; } },
    'supreme-overlord': { stat: (pl, S, o) => {
                            const downs = G.Coop.active ? G.Coop.puppets().reduce((n, p) => n + (p.downs || (p.dead ? 1 : 0)), 0) : 0;
                            const k = 1 + Math.min(0.3, 0.05 * (downs + (pl.bosses || 0))); o.atk *= k; o.spa *= k;
                          } },
    'swarm': pinch('bug'), 'torrent': pinch('water'), 'overgrow': pinch('grass'),
    'technician': { move: (pl, S, m) => ((m.def ? m.def.cd : m.cd) < 0.8 ? 1.35 : 1) },
    'teravolt': merge({ hit: (pl, S, e, c) => { c.pierce = true; } }, typeUp('electric', 1.15)),
    'turboblaze': merge({ hit: (pl, S, e, c) => { c.pierce = true; } }, typeUp('fire', 1.15)),
    'tinted-lens': { hit: (pl, S, e, c) => { if (c.k < 1 && c.k > 0) c.mul *= Math.min(2, 1 / c.k); } },
    'tough-claws': { move: (pl, S, m) => (contact(m) ? 1.25 : 1) },
    'transistor': typeUp('electric', 1.3),
    'truant': { cd: () => 2, move: () => 2.2 },
    'unseen-fist': { stat: (pl, S, o) => { o.atk *= 1.1; }, hit: (pl, S, e, c, m) => { if (m && contact(m)) c.pierce = true; } },
    'water-bubble': merge(typeUp('water', 1.3), { inc: (pl, S, h) => { if (h.type === 'fire') h.amount *= 0.6; } }),
    'wind-power': { hurt: (pl, S, h) => { if (h.type === 'flying') S.charged = true; },
                    cast: (pl, S, m) => { if (S.charged && m.type === 'electric') { S.castMul = 2; S.charged = false; say(pl, 'Charged!', '#ffe14d'); } } },
    'zen-mode': { types: pl => (hp(pl) < 0.5 ? ['psychic'] : null), stat: (pl, S, o) => { if (hp(pl) < 0.5) o.spa *= 1.3; },
                  tick: (pl, S) => { const z = hp(pl) < 0.5; if (z !== !!S.zen) { S.zen = z; say(pl, z ? 'Zen Mode!' : 'Standard Mode', '#c58aff'); } } },
    'zero-to-hero': { tick: (pl, S) => { if (!S.hero && ((pl.bosses || 0) > 0 || pl.revivedBy.length)) { S.hero = true; pl.addMaxHp(pl.maxHp * 0.3); say(pl, 'Hero Form!', '#7fb8ff'); } },
                      stat: (pl, S, o) => { if (S.hero) o.atk *= 1.3; } },
    'sand-force': merge(noWx, { move: (pl, S, m) => (['rock', 'ground', 'steel'].includes(m.type) ? (wx('sand') ? 1.3 : 1.12) : 1) }),
    'transistor-dup': null,

    // ===== Defense =====
    'aura-break': { inc: (pl, S, h) => { if (boss(h.e)) h.amount *= 0.8; }, team: (me, mate, o) => { o.bossDr *= 0.8; } },
    'battle-armor': dr(0.06), 'shell-armor': dr(0.06), 'big-pecks': dr(0.06),
    'beads-of-ruin': { aura: (p, es) => { for (const e of es) e.abRuinT = 0.6; } },
    'bulletproof': { inc: (pl, S, h) => { if (h.src && h.src.k === 'shot') h.amount *= 0.7; } },
    'clear-body': merge(noSlow, dr(0.05)),
    'full-metal-body': merge(noSlow, dr(0.12)),
    'color-change': { hurt: (pl, S, h) => { if (h.type && h.type !== S.cc) { S.cc = h.type; say(pl, 'Now ' + (G.U.TYPE_NAME[h.type] || h.type) + '!', G.U.TYPE_COLOR[h.type]); } },
                      types: (pl, S) => (S.cc ? [S.cc] : null) },
    'comatose': noStatus,
    'dauntless-shield': { stat: (pl, S, o) => { o.dr += now() < 180 ? 0.3 : 0.08; } },
    'dazzling': merge(dr(0.05), { inc: (pl, S, h) => { if (lunge(h)) h.block = 'Dazzling'; } }),
    'queenly-majesty': merge(dr(0.05), { inc: (pl, S, h) => { if (lunge(h)) h.block = 'Queenly Majesty'; } }),
    'disguise': { start: (pl, S) => { S.disg = 0; }, tick: (pl, S, dt) => { if (S.disg > 0) S.disg -= dt; },
                  inc: (pl, S, h) => { if (!(S.disg > 0)) { S.disg = 90; h.block = 'Disguise!'; } } },
    'filter': { inc: (pl, S, h) => { if (h.k > 1) h.amount *= 0.75; } },
    'solid-rock': { inc: (pl, S, h) => { if (h.k > 1) h.amount *= 0.75; } },
    'prism-armor': merge(dr(0.05), { inc: (pl, S, h) => { if (h.k > 1) h.amount *= 0.7; } }),
    'flash-fire': merge(noLava, absorb('fire', (pl, S) => add(S, 'ff', 0.3, 6)), { move: (pl, S, m) => (m.type === 'fire' && on(S, 'ff') ? 1.3 : 1) }),
    'fluffy': { inc: (pl, S, h) => { if (h.src && h.src.k === 'contact') h.amount *= 0.65; if (h.type === 'fire') h.amount *= 1.3; } },
    'fur-coat': { inc: (pl, S, h) => { if (h.src && h.src.k === 'contact') h.amount *= 0.7; } },
    'good-as-gold': merge(noStatus, { noDebuff: true }),
    'grass-pelt': { stat: (pl, S, o) => { if (forest()) o.dr += 0.2; } },
    'ice-face': { tick: (pl, S, dt) => { if (S.face > 0) S.face -= dt * (wx('snow') ? 60 : 1); },
                  inc: (pl, S, h) => { if (h.src && h.src.k === 'shot' && !(S.face > 0)) { S.face = 60; h.block = 'Ice Face!'; } } },
    'ice-scales': { inc: (pl, S, h) => { if (h.src && (h.src.k === 'shot' || h.src.k === 'beam')) h.amount *= 0.65; } },
    'illusion': { tick: (pl, S, dt) => { S.ill = (S.ill || 0) + dt; if (S.ill >= 30) { S.ill = 0; say(pl, 'Illusion', '#c8d4ea'); } },
                  inc: (pl, S, h) => { if ((S.ill || 0) < 3 && h.e && !boss(h.e)) h.block = 'Illusion'; } },
    'immunity': merge(noPoison, dr(0.05)),
    'inner-focus': merge(noSlow, { noDebuff: true }),
    'insomnia': { stat: (pl, S, o) => { o.regen += 0.3; } },
    'intimidate': { inc: (pl, S, h) => { if (h.e) h.amount *= boss(h.e) ? 0.92 : 0.85; } },
    'iron-barbs': { contact: (pl, S, e) => { e.hurt(e.dmg * (boss(e) ? 0.05 : 0.15) * 3, '#9aa6b5', e.x - pl.x, e.y - pl.y, 40); } },
    'rough-skin': { contact: (pl, S, e) => { e.hurt(e.dmg * (boss(e) ? 0.05 : 0.15) * 3, '#c8a070', e.x - pl.x, e.y - pl.y, 40); } },
    'leaf-guard': { noSlowIf: () => forest() || wx('sun'), noBurnIf: () => forest() || wx('sun'), noPoisonIf: () => forest() || wx('sun') },
    'levitate': merge(noLava, { noWater: true, inc: (pl, S, h) => { if (h.type === 'ground' && !h.pure) h.block = 'Levitate'; if (h.src && h.src.k === 'trap') h.block = 'Levitate'; } }),
    'limber': noSlow,
    'liquid-ooze': { hit: (pl, S, e, c) => { if ((e.types || []).includes('poison')) c.mul *= 1.1; } },
    'magic-bounce': merge(noSlow, { debuff: (pl, S, src) => { if (src && src.e) src.e.applySlow(0.3, 2); } }),
    'magic-guard': { noWx: true, noLava: true, inc: (pl, S, h) => { if (h.src && (h.src.k === 'liquid' || h.src.k === 'trap')) h.block = 'Magic Guard'; } },
    'magma-armor': merge(noSlow, noLava, noWx),
    'marvel-scale': { hurt: (pl, S) => { add(S, 'marvel', 0.3, 3); }, stat: (pl, S, o) => { o.dr += val(S, 'marvel'); } },
    'mirror-armor': merge(noSlow, dr(0.08), { debuff: (pl, S, src) => { if (src && src.e) src.e.applySlow(0.3, 2); } }),
    'multiscale': { inc: (pl, S, h) => { if (pl.hp >= pl.maxHp - 0.5 && !h.pure) h.amount *= 0.5; } },
    'shadow-shield': { inc: (pl, S, h) => { if (pl.hp >= pl.maxHp - 0.5) h.amount *= 0.5; } },
    'neutralizing-gas': { aura: (p, es) => { for (const e of es) if (e.shield > 0) { e.shield = 0; e.shieldT = 0; } } },
    'no-guard': { hit: (pl, S, e, c) => { c.pierce = true; }, noDodge: true },
    'overcoat': merge(noWx, { inc: (pl, S, h) => { if (h.src && (h.src.k === 'zone' || h.src.k === 'beam')) h.amount *= 0.9; } }),
    'own-tempo': merge(noSlow, { stat: (pl, S, o) => { o.spd *= 1.05; } }),
    'pressure': { aura: (p, es, dt) => { for (const e of es) { if (e.shotCd > 0) e.shotCd += dt * 0.15; if (e.ai && e.ai.cd > 0) e.ai.cd += dt * 0.15; if (e.skillCd > 0) e.skillCd += dt * 0.15; } } },
    'purifying-salt': merge(noStatus, { inc: (pl, S, h) => { if (h.type === 'ghost') h.amount *= 0.7; } }),
    'rock-head': merge(dr(0.05), { noRecoil: true }),
    'shield-dust': merge(noStatus, { inc: (pl, S, h) => { if (h.src && (h.src.k === 'zone' || h.src.k === 'beam')) h.amount *= 0.9; } }),
    'shields-down': { stat: (pl, S, o) => { if (hp(pl) > 0.5) o.dr += 0.25; else { o.atk *= 1.3; o.spa *= 1.3; o.spd *= 1.3; } },
                      noSlowIf: pl => hp(pl) > 0.5, noBurnIf: pl => hp(pl) > 0.5, noPoisonIf: pl => hp(pl) > 0.5 },
    'soundproof': { inc: (pl, S, h) => { if (boss(h.e)) h.amount *= 0.9; } },
    'stall': { cd: () => 1.15, stat: (pl, S, o) => { o.dr += 0.15; } },
    'stalwart': merge(noSlow, { hit: (pl, S, e, c) => { c.pierce = true; } }),
    'stamina': { hurt: (pl, S) => add(S, 'stam', 0.04, 8, 5), stat: (pl, S, o) => { o.dr += val(S, 'stam'); } },
    'stench': { aura: (p, es, dt) => { for (const e of es) if (Math.random() < 0.1 * dt * 4 && e.shotCd > 0) e.shotCd += 0.5; } },
    // Sturdy works exactly like a Focus Sash (25-10-2026): any hit that would knock you out leaves you at 1 HP, once every
    // 60 s, whatever your health was. Its cooldown is separate from a held Focus Sash's (player.js hurt does the 1 HP + 1.2 s invuln).
    'sturdy': { lethal: (pl, S) => { if (now() - (S.sturdyAt == null ? -999 : S.sturdyAt) > 60) { S.sturdyAt = now(); say(pl, 'Sturdy!', '#c8a070'); return true; } return false; } },
    'supersweet-syrup': { tick: (pl, S) => {
                            const b = G.EnemyMgr.bossAlive();
                            if (!S.syrup0 || (b && !S.syrupB)) { S.syrup0 = true; for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, 260)) if (!e.dead) e.applySlow(0.3, 4); say(pl, 'Supersweet Syrup', '#ffb0d8'); }
                            S.syrupB = b;
                          } },
    'tera-shift': { start: pl => { pl.addMaxHp(pl.maxHp * 0.2); }, stat: (pl, S, o) => { o.dr += 0.1; } },
    'thermal-exchange': merge(noBurn, { hurt: (pl, S, h) => { if (h.type === 'fire') add(S, 'therm', 0.15, 6, 3); }, stat: (pl, S, o) => { o.atk *= 1 + val(S, 'therm'); } }),
    'thick-fat': { inc: (pl, S, h) => { if (h.type === 'fire' || h.type === 'ice') h.amount *= 0.65; } },
    'unaware': { inc: (pl, S, h) => { if (boss(h.e)) h.amount *= 0.85; } },
    'unnerve': { inc: (pl, S, h) => { if (h.e) h.amount *= 0.9; } },
    'vital-spirit': { cd: () => 0.95 },
    'water-compaction': { hurt: (pl, S, h) => { if (h.type === 'water') add(S, 'wcomp', 0.15, 8, 3); }, stat: (pl, S, o) => { o.dr += val(S, 'wcomp') + (pl.inLiquid ? 0.1 : 0); } },
    'water-veil': merge(noBurn, noLava),
    'well-baked-body': merge(noLava, absorb('fire', (pl, S) => add(S, 'baked', 0.1, 6, 3)), { stat: (pl, S, o) => { o.dr += val(S, 'baked'); } }),
    'wonder-guard': { start: pl => { pl.maxHp = Math.max(1, Math.round(pl.maxHp / 4)); pl.hp = pl.maxHp; }, maxHpK: 0.25,
                      inc: (pl, S, h) => { if (h.type && !h.pure && !(h.k > 1)) h.block = 'Wonder Guard'; } },
    'early-bird': { stat: (pl, S, o) => { o.spd *= 1.05; }, slowK: 2 },

    // ===== Status (effects on foes) =====
    'arena-trap': merge({ aura: (p, es) => { for (const e of es) if (!e.flying) e.applySlow(0.2, 0.4); } }, typeUp('ground', 1.1)),
    'bad-dreams': { aura: (p, es, dt) => { for (const e of es) if (e.freezeT > 0) e.hurt(e.maxHp * (boss(e) ? 0.005 : 0.04) * dt * 4, '#8a5cff'); } },
    'corrosion': { hit: (pl, S, e, c) => { c.poisonK = 1.3; } },
    'cotton-down': { hurt: pl => { for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, 110)) if (!e.dead) e.applySlow(0.25, 2); } },
    'cursed-body': { hurt: (pl, S, h) => { const e = h.e; if (e && !e.dead && Math.random() < 0.3) { if (boss(e)) e.applySlow(0.3, 1.5); else e.freeze(1.2); } } },
    'cute-charm': touch((pl, S, e) => { if (!boss(e)) { e.freeze(1.5, true); say(pl, 'Charmed!', '#ff8ad8'); } }),
    'effect-spore': touch((pl, S, e) => { const r = Math.random(); if (r < 0.34) e.applyPoison(2); else if (r < 0.67) e.applySlow(0.3, 2); else e.freeze(0.8, true); }),
    'flame-body': merge(noLava, touch((pl, S, e) => e.applyBurn(2))),
    'gulp-missile': { cast: (pl, S, m) => { if (m.type === 'water' && !S.gulp) { S.gulp = true; say(pl, 'Caught prey!', '#7fb8ff'); } },
                      hurt: (pl, S, h) => { if (S.gulp && h.e && !h.e.dead) { S.gulp = false; h.e.hurt(boss(h.e) ? h.e.maxHp * 0.04 + 40 : 80 + pl.level * 18, '#4fb4ff', h.e.x - pl.x, h.e.y - pl.y, 160); say(pl, 'Gulp Missile!', '#4fb4ff'); } } },
    'innards-out': { death: (pl, S, d) => { for (const e of G.EnemyMgr.queryCircle(pl.x, pl.y, 160)) if (!e.dead) e.hurt(Math.min(d * 2, 600 + pl.level * 30), '#ff6b8a', e.x - pl.x, e.y - pl.y, 120); } },
    'lingering-aroma': touch((pl, S, e) => { e.abMuteT = 5; }),
    'mummy': touch((pl, S, e) => { e.abMuteT = 5; }),
    'magnet-pull': { stat: (pl, S, o) => { o.magnet *= 1.2; },
                     hit: (pl, S, e, c) => { if ((e.types || []).includes('steel')) c.mul *= 1.2; },
                     aura: (p, es, dt) => { for (const e of es) if ((e.types || []).includes('steel') && !e.boss) { const [nx, ny] = G.U.norm(p.x - e.x, p.y - e.y); e.kx += nx * 220 * dt; e.ky += ny * 220 * dt; } } },
    'mycelium-might': { cd: () => 1.05, hit: (pl, S, e, c) => { c.fxK = 1.5; } },
    'perish-body': touch((pl, S, e) => { if (!e.abPerish) { e.abPerish = 5; e.abPerishDmg = boss(e) ? 60 + pl.level * 8 : 120 + pl.level * 20; } }),
    'poison-point': touch((pl, S, e) => e.applyPoison(2)),
    'poison-puppeteer': { hit: (pl, S, e, c, m) => { if (m && m.poison && !boss(e) && Math.random() < 0.15) e.freeze(1.2, true); } },
    'seed-sower': { hurt: (pl, S) => { S.seedT = 5; }, tick: (pl, S, dt) => { if (S.seedT > 0) { S.seedT -= dt; pl.hp = Math.min(pl.maxHp, pl.hp + dt); } } },
    'serene-grace': { hit: (pl, S, e, c) => { c.fxK = 2; }, stat: (pl, S, o) => { o.critFx = 2; } },
    'shadow-tag': { aura: (p, es) => { for (const e of es) { e.applySlow(0.2, 0.4); if (e.behavior === 'thief') e.applySlow(0.4, 0.4); } } },
    'static': merge(touch((pl, S, e) => e.freeze(0.8, true)), typeUp('electric', 1.05)),
    'synchronize': { hurt: (pl, S, h) => { const e = h.e; if (!e || e.dead) return; if (h.type === 'fire') e.applyBurn(2); else if (h.type === 'poison') e.applyPoison(2); else e.applySlow(0.3, 2); } ,
                     debuff: (pl, S, src) => { if (src && src.e) src.e.applySlow(0.3, 2); } },
    'toxic-chain': { hit: (pl, S, e) => { if (Math.random() < 0.3) e.applyPoison(3); } },
    'toxic-debris': { hurt: (pl, S) => { S.spikes = { x: pl.x, y: pl.y, t: 8, tick: 0 }; },
                      tick: (pl, S, dt) => {
                        const s = S.spikes; if (!s) return;
                        s.t -= dt; s.tick -= dt; if (s.t <= 0) { S.spikes = null; return; }
                        if (Math.random() < dt * 6) G.FX.px(s.x + G.U.rand(-40, 40), s.y + G.U.rand(-26, 26), '#c58aff', { vy: -8, life: 0.5 });
                        if (s.tick <= 0) { s.tick = 0.5; for (const e of G.EnemyMgr.queryCircle(s.x, s.y, 55)) if (!e.dead && !e.flying) e.applyPoison(1); }
                      } },
    'wandering-spirit': touch((pl, S, e) => { e.abWeakT = 5; }),

    // ===== Sustain =====
    'cheek-pouch': { stat: (pl, S, o) => { o.heal *= 1.5; } },
    'cud-chew': { onHeal: (pl, S, amt) => { S.cud = { t: 10, amt }; },
                  tick: (pl, S, dt) => { if (S.cud && (S.cud.t -= dt) <= 0) { pl.heal(S.cud.amt); S.cud = null; say(pl, 'Cud Chew', '#5fe0b0'); } } },
    'dry-skin': { tick: (pl, S, dt) => { if (pl.inLiquid && G.World.liquidKind() !== 'lava') pl.hp = Math.min(pl.maxHp, pl.hp + 2 * dt); if (wx('rain')) pl.hp = Math.min(pl.maxHp, pl.hp + 1.5 * dt); },
                  inc: (pl, S, h) => { if (h.type === 'fire' || (wx('sun') && h.e)) h.amount *= 1.2; } },
    'earth-eater': healAbsorb('ground'),
    'gluttony': { stat: (pl, S, o) => { o.heal *= 1.3; o.healReach *= 1.5; } },
    'harvest': { tick: (pl, S, dt) => { S.harv = (S.harv || 0) + dt * (wx('sun') ? 2 : 1); if (S.harv >= 45) { S.harv = 0; pl.healItem(0.15, true); say(pl, 'Harvest!', '#5fe0b0'); G.FX.sp('heart', 'grass', pl.x, pl.y - 10, { vy: -30, life: 0.6 }); } } },
    'hydration': { stat: (pl, S, o) => { if (wx('rain') || pl.inLiquid) { o.regen += 2; o.spd *= 1.1; } } },
    'ice-body': merge(noWx, { stat: (pl, S, o) => { o.regen += wx('snow') || cave() ? 2 : 0.5; } }),
    'natural-cure': { tick: (pl, S, dt) => {
                        if (S.cureT > 0) S.cureT -= dt;
                        if (S.cureSlot !== undefined && S.cureSlot !== pl.active && !(S.cureT > 0) && pl.hp < pl.maxHp) {
                          S.cureT = 6; pl.hp = Math.min(pl.maxHp, pl.hp + pl.maxHp * 0.04); say(pl, 'Natural Cure', '#5fe0b0');
                        }
                        S.cureSlot = pl.active;
                      } },
    'poison-heal': { tick: (pl, S, dt) => { crowd(pl, S, dt, 220); },
                     stat: (pl, S, o) => { o.regen += Math.min(3, 0.5 * ((S.crowd && S.crowd.psn) || 0)); },
                     inc: (pl, S, h) => { if (h.type === 'poison' && !h.pure) h.amount *= 0.5; if (h.src && h.src.a === 'Poison trap') h.block = 'Poison Heal'; } },
    'rain-dish': { stat: (pl, S, o) => { o.regen += wx('rain') ? 2 : 0.5; } },
    'regenerator': { hurt: (pl, S) => { S.regenAt = now(); }, stat: (pl, S, o) => { if (now() - (S.regenAt == null ? -9 : S.regenAt) >= 3) o.regen += 1.2; } },
    'ripen': { stat: (pl, S, o) => { o.heal *= 2; } },
    'shed-skin': { tick: (pl, S, dt) => { if (S.skinT > 0 && (S.skinT -= dt) <= 0) say(pl, 'New skin', '#5fe0b0'); },
                   inc: (pl, S, h) => { if (!(S.skinT > 0) && !h.pure) { S.skinT = 15; h.block = 'Shed Skin'; } } },
    'triage': { drainK: 1.5, stat: (pl, S, o) => { o.heal *= 1.5; } },
    'volt-absorb': healAbsorb('electric'),
    'water-absorb': merge(healAbsorb('water'), { tick: (pl, S, dt) => { if (pl.inLiquid && G.World.liquidKind() !== 'lava') pl.hp = Math.min(pl.maxHp, pl.hp + dt); } }),

    // ===== Mobility =====
    'chlorophyll': { stat: (pl, S, o) => { o.spd *= wx('sun') ? 1.3 : forest() ? 1.1 : 1; } },
    'emergency-exit': { tick: (pl, S) => lowEscape(pl, S) , stat: (pl, S, o) => { if (on(S, 'esc')) o.spd *= 1.5; } },
    'wimp-out': { tick: (pl, S) => lowEscape(pl, S), stat: (pl, S, o) => { if (on(S, 'esc')) o.spd *= 1.5; } },
    'gale-wings': { cd: (pl, S, m) => (m.type === 'flying' && pl.hp >= pl.maxHp - 0.5 ? 0.7 : 1), stat: (pl, S, o) => { if (pl.hp >= pl.maxHp - 0.5) o.spd *= 1.15; } },
    'motor-drive': merge(buffAbsorb('electric', 'motor', 0.15), { stat: (pl, S, o) => { o.spd *= 1 + val(S, 'motor'); } }),
    'quick-feet': merge(noSlow, { tick: (pl, S, dt) => { crowd(pl, S, dt, 140); }, stat: (pl, S, o) => { if (S.crowd && S.crowd.n >= 5) o.spd *= 1.3; } }),
    'rattled': { hurt: (pl, S, h) => { if (['bug', 'ghost', 'dark'].includes(h.type)) add(S, 'rat', 0.2, 5); }, stat: (pl, S, o) => { o.spd *= 1 + val(S, 'rat'); } },
    'sand-rush': merge(noWx, { stat: (pl, S, o) => { o.spd *= wx('sand') ? 1.3 : volcano() ? 1.1 : 1; } }),
    'slush-rush': merge(noWx, { stat: (pl, S, o) => { if (wx('snow')) o.spd *= 1.3; } }),
    'speed-boost': { stat: (pl, S, o) => { o.spd *= 1 + Math.min(0.3, Math.floor(now() / 30) * 0.02); } },
    'steadfast': merge(noSlow, { hurt: (pl, S, h) => { if (h.src && h.src.k === 'contact') add(S, 'stead', 0.15, 4); }, stat: (pl, S, o) => { o.spd *= 1 + val(S, 'stead'); } }),
    'swift-swim': { noWater: true, stat: (pl, S, o) => { if (wx('rain')) o.spd *= 1.3; } },
    'unburden': { stat: (pl, S, o) => { if (!pl.item || S.itemGone) o.spd *= 1.3; }, tick: (pl, S) => { if (S.hadItem && !pl.item) S.itemGone = true; if (pl.item) S.hadItem = true; } },
    'wind-rider': { inc: (pl, S, h) => { if (h.type === 'flying' && !h.pure) { h.absorb = true; add(S, 'wind', 0.2, 6); } },
                    stat: (pl, S, o) => { const k = 1 + val(S, 'wind'); o.atk *= k; o.spd *= k; } },

    // ===== Weather =====
    'air-lock': merge(noWx, { inc: (pl, S, h) => { if (h.e && h.e.legend) h.amount *= 0.9; } }, { team: (me, mate, o) => { o.noWx = true; } }),
    'cloud-nine': noWx,
    'drizzle': { tick: (pl, S, dt) => bringWeather(S, 'rain', dt) },
    'drought': { tick: (pl, S, dt) => bringWeather(S, 'sun', dt) },
    'orichalcum-pulse': { tick: (pl, S, dt) => bringWeather(S, 'sun', dt), stat: (pl, S, o) => { if (wx('sun')) o.atk *= 1.25; } },
    'sand-stream': merge(noWx, { tick: (pl, S, dt) => bringWeather(S, 'sand', dt) }),
    'snow-warning': merge(noWx, { tick: (pl, S, dt) => bringWeather(S, 'snow', dt) }),
    'sand-spit': merge(noWx, { hurt: (pl, S) => { if (authority() && !G.Weather.current && !G.Rift.inArena && !G.Judgment.active && !G.Tower.active && now() - (S.spitAt == null ? -99 : S.spitAt) > 30) { S.spitAt = now(); G.Weather.debugStart('sand', 6); } } }),
    'forecast': { types: () => (wx('sun') ? ['fire'] : wx('rain') ? ['water'] : wx('snow') ? ['ice'] : null),
                  move: (pl, S, m) => ((wx('sun') && m.type === 'fire') || (wx('rain') && m.type === 'water') || (wx('snow') && m.type === 'ice') ? 1.2 : 1), noWxOut: true },

    // ===== Team =====
    'battery': { team: (me, mate, o) => { o.spaTeam *= 1.2; } },
    'power-spot': { team: (me, mate, o) => { o.atkTeam *= 1.2; o.spaTeam *= 1.2; } },
    'commander': { stat: (pl, S, o) => { if (G.Coop.active && G.Coop.puppets().some(p => p.dex === 977)) { o.atk *= 1.3; o.spa *= 1.3; o.spd *= 1.3; o.dr += 0.1; } } },
    'dark-aura': { move: (pl, S, m) => (m.type === 'dark' ? 1.3 : 1), teamAll: (me, mate, o) => { o.types.dark = (o.types.dark || 1) * 1.3; } },
    'fairy-aura': { move: (pl, S, m) => (m.type === 'fairy' ? 1.3 : 1), teamAll: (me, mate, o) => { o.types.fairy = (o.types.fairy || 1) * 1.3; } },
    'electric-surge': { tick: (pl, S) => terrainMsg(pl, S, 'Electric Terrain', '#ffe14d'), move: (pl, S, m) => (m.type === 'electric' && terrainOn() ? 1.3 : 1),
                        teamAll: (me, mate, o) => { if (terrainOn()) o.types.electric = (o.types.electric || 1) * 1.3; } },
    'psychic-surge': { tick: (pl, S) => terrainMsg(pl, S, 'Psychic Terrain', '#ff8ad8'), move: (pl, S, m) => (m.type === 'psychic' && terrainOn() ? 1.3 : 1),
                       teamAll: (me, mate, o) => { if (terrainOn()) o.types.psychic = (o.types.psychic || 1) * 1.3; }, shotSlow: true },
    'misty-surge': { tick: (pl, S) => terrainMsg(pl, S, 'Misty Terrain', '#ffb0d8'), noSlowIf: () => terrainOn(), noBurnIf: () => terrainOn(), noPoisonIf: () => terrainOn(),
                     teamAll: (me, mate, o) => { if (terrainOn()) o.noStatus = true; } },
    'flower-gift': { stat: (pl, S, o) => { if (forest() || wx('sun')) { o.atk *= 1.15; o.spa *= 1.15; } },
                     team: (me, mate, o) => { if (forest() || wx('sun')) { o.atkTeam *= 1.15; o.spaTeam *= 1.15; } } },
    'healer': { reviveK: 1.3, stat: (pl, S, o) => { o.regen += 0.6; }, team: (me, mate, o) => { o.regen += 0.6; } },
    'hospitality': { reviveHeal: 0.25, team: (me, mate, o) => { o.regen += 0.5; } },
    'receiver': { tick: (pl, S) => {
                    if (!G.Coop.active) return;
                    S.recv = S.recv || new Set();
                    for (const m of G.Coop.mates) if (m.pl.dead && !S.recv.has(m.uid)) { S.recv.add(m.uid); say(pl, 'Receiver: +20%', '#ff8ad8'); }
                  },
                  stat: (pl, S, o) => { const k = 1 + 0.2 * (S.recv ? S.recv.size : 0); o.atk *= k; o.spa *= k; } },
    'sweet-veil': merge(noSlow, { team: (me, mate, o) => { o.noStatus = true; } }),
    'symbiosis': { onHeal: (pl, S, amt) => { if (G.Coop.active) G.Coop.healTeam(amt / Math.max(1, pl.maxHp) / 2, pl); } },
    'telepathy': { team: (me, mate, o) => { o.dr += 0.08; } },
    'victory-star': { stat: (pl, S, o) => { o.crit += 0.1; o.reach *= 1.1; }, team: (me, mate, o) => { o.crit += 0.1; o.reach *= 1.1; } },

    // ===== Utility =====
    'ball-fetch': { ticketK: 1.15 },
    'dancer': { dance: true },
    'honey-gather': { start: pl => { pl.coinMul *= 1.3; } },
    'pickup': { start: pl => { pl.coinMul *= 1.25; }, berryDrop: 0.006 },
    'imposter': { tick: (pl, S) => {
                    if (S.copied) return;
                    const b = G.EnemyMgr.all().find(e => !e.dead && (e.boss || e.legend) && G.U.dist(pl.x, pl.y, e.x, e.y) < 360);
                    if (!b) return;
                    S.copied = (b.types || []).slice(0, 2); pl.addMaxHp(pl.maxHp * 0.2);
                    say(pl, 'Transformed into ' + b.name + '!', '#c58aff');
                  },
                  types: (pl, S) => S.copied || null, stat: (pl, S, o) => { if (S.copied) { o.atk *= 1.15; o.spa *= 1.15; } },
                  move: (pl, S, m) => (S.copied && S.copied.includes(m.type) ? 1.2 : 1) },
    'magician': { hit: (pl, S, e, c) => { if ((e.boss || e.behavior === 'thief') && !e.abStolen && Math.random() < 0.05 && authority()) { e.abStolen = true; for (let i = 0; i < 4; i++) G.Pickups.drop('coin', e.x + G.U.rand(-20, 20), e.y + G.U.rand(-14, 14), 5); say(pl, 'Magician!', '#ffd23f'); } } },
    'multitype': { types: pl => { const m = strongest(pl); return m ? [m.type] : null; }, move: (pl, S, m) => { const s = strongest(pl); return s && s.type === m.type ? 1.15 : 1; } },
    'prankster': { cd: (pl, S, m) => (m.kind === 'buff' || m.kind === 'wall' || SUPPORT.has(m.id) ? 0.7 : 1) },
    'rks-system': { move: (pl, S, m) => (m.type === biomeType() ? 1.2 : 1), types: () => [biomeType()] },
    'trace': { start: (pl, S) => {
                 const pick = G.Coop.active ? G.Coop.puppets().map(p => G.MON_ABILITY[p.dex]).filter(id => id && id !== 'trace' && A[id])
                   : G.DEX.filter(p => p.types.includes('psychic')).map(p => G.MON_ABILITY[p.dex]).filter(id => id && id !== 'trace' && A[id]);
                 if (!pick.length) return;
                 pl.ab = G.U.pick(pick);
                 const sp = A[pl.ab];
                 if (sp.start) sp.start(pl, S);
                 say(pl, 'Traced ' + G.ABILITIES[pl.ab].n + '!', '#c58aff');
               } }
  };
  delete A['transistor-dup'];

  /** An enemy's dash or leap (Dazzling, Queenly Majesty): a charger mid-dash, or a jumper's landing. */
  function lunge(h) {
    const e = h.e;
    if (!e || h.pure) return false;
    return (h.src.k === 'contact' && (e.phase === 'dash' || !!e.jump)) || (h.src.k === 'zone' && e.behavior === 'jumper');
  }
  function bestStat(pl, o, k) {
    const a = pl.baseAtk, s = pl.baseSpa, sp = pl.baseSpd / 100;
    if (a >= s && a >= sp) o.atk *= k; else if (s >= sp) o.spa *= k; else o.spd *= k;
  }
  function lowEscape(pl, S) {
    if (hp(pl) < 0.5 && !S.low && now() - (S.escAt == null ? -99 : S.escAt) > 60) {
      S.escAt = now(); add(S, 'esc', 0.5, 3); pl.invuln = Math.max(pl.invuln, 1.5); say(pl, 'Escape!', '#8fe07a');
    }
    S.low = hp(pl) < 0.5;
  }
  function terrainMsg(pl, S, name, col) {
    const a = terrainOn();
    if (a && !S.terr) say(pl, name + '!', col);
    S.terr = a;
    if (a && Math.random() < 0.15) G.FX.px(pl.x + G.U.rand(-60, 60), pl.y + G.U.rand(-30, 30), col, { vy: -14, life: 0.6 });
  }
  function strongest(pl) { return pl.moves.reduce((b, m) => (!b || (m.lvl || 1) > (b.lvl || 1) ? m : b), null); }
  function biomeType() { return volcano() ? 'fire' : cave() ? 'rock' : 'grass'; }

  // ---------------- engine ----------------
  const spec = pl => (pl && pl.ab && A[pl.ab]) || null;
  /** The ability id of any player (yours: after Trace; a teammate's: from their Pokémon). */
  const idOf = p => (p === G.Game.player ? p.ab : G.MON_ABILITY[p.dex]);

  /** The run starts: your ability is set up. */
  function start(pl) {
    pl.ab = G.MON_ABILITY[pl.dex] || null;
    pl.abS = { b: {}, kills0: pl.kills || 0 };
    pl.abO = blank();
    const s = spec(pl);
    if (s && s.start) s.start(pl, pl.abS);
    refresh(pl);
  }

  function blank() {
    return { atk: 1, spa: 1, spd: 1, cd: 1, dr: 0, crit: 0, critMul: 1, critFx: 1, regen: 0, reach: 1, shotLife: 1, heal: 1, healReach: 1, magnet: 1,
             atkTeam: 1, spaTeam: 1, bossDr: 1, types: {}, noWx: false, noStatus: false };
  }

  /** Teammates near you (alive) and all teammates, with their abilities. */
  function mates(pl) {
    if (!G.Coop.active) return [];
    return G.Coop.puppets().filter(p => !p.dead).map(p => ({ p, id: G.MON_ABILITY[p.dex], near: G.U.dist2(p.x, p.y, pl.x, pl.y) < 300 * 300 }));
  }

  /** Recomputes this frame's numbers (your ability, then nearby teammates'). */
  function refresh(pl) {
    const S = pl.abS, s = spec(pl), o = blank();
    if (s && s.stat) s.stat(pl, S, o);
    for (const m of mates(pl)) {
      const ms = A[m.id];
      if (!ms) continue;
      if (m.near && ms.team) ms.team(pl, m.p, o);
      if (ms.teamAll) ms.teamAll(pl, m.p, o);
    }
    // Simple: every bonus from your ability is 50% stronger (its own numbers and timed buffs).
    if (s && s.simple) {
      const b = pl.buffs;
      o.atk *= 1 + 0.5 * ((b.atk.n * b.atk.amount) || 0); o.spd *= 1 + 0.5 * ((b.spd.n * b.spd.amount) || 0);
    }
    pl.abO = o;
  }

  /** Every frame, on your computer. */
  function tick(pl, dt) {
    const S = pl.abS;
    if (!S || pl.dead) return;
    for (const k in S.b) { const b = S.b[k]; if (b.n > 0 && (b.t -= dt) <= 0) b.n = 0; }
    // Status shortening (Early Bird): slows wear off faster.
    const s = spec(pl);
    if (s && s.slowK && pl.slowT > 0) pl.slowT -= dt * (s.slowK - 1);
    // Getting slowed counts as a debuff (Defiant, Competitive, Magic Bounce...), once per slow.
    if (pl.slowT > 0 && !S.wasSlow) debuff(pl, null);
    S.wasSlow = pl.slowT > 0;
    if (pl.slowT > 0 && slowImmune(pl)) pl.slowT = 0;
    if (s && s.tick) s.tick(pl, S, dt);
    refresh(pl);
    if (pl.abO.regen > 0) pl.hp = Math.min(pl.maxHp, pl.hp + pl.abO.regen * dt);
  }

  /** Host / solo: abilities that act on the enemies around each player (yours and your teammates'). */
  let auraT = 0;
  function hostTick(dt) {
    if (!authority()) return;
    // Perish Body's mark, Wandering Spirit's and Mummy's timers, Beads of Ruin: on the enemies themselves.
    for (const e of G.EnemyMgr.all()) {
      if (e.dead || e.remote) continue;
      if (e.abRuinT > 0) e.abRuinT -= dt;
      if (e.abWeakT > 0) e.abWeakT -= dt;
      if (e.abMuteT > 0) { e.abMuteT -= dt; if (e.shotCd != null && e.shotCd < 0.3) e.shotCd = 0.3; }
      if (e.abPerish > 0 && (e.abPerish -= dt) <= 0) { e.hurt(e.abPerishDmg || 100, '#8a5cff'); G.FX.ring(e.x, e.y, 4, 40, '#8a5cff', 0.4, 3); }
    }
    if ((auraT += dt) < 0.25) return;
    const step = auraT; auraT = 0;
    for (const p of G.Game.everyone()) {
      if (!p || p.dead) continue;
      const s = A[idOf(p)];
      if (s && s.aura) s.aura(p, near(p, 170), step);
    }
  }

  // ---- numbers used around the game ----
  const O = pl => pl.abO || blank();
  /** Damage of one of your moves (Player.pow): Attack / Sp. Atk from your ability and team, and move bonuses. */
  function pow(pl, m) {
    const o = O(pl), S = pl.abS, s = spec(pl);
    let k = m && m.cat === 'physical' ? o.atk * o.atkTeam : m && m.cat === 'special' ? o.spa * o.spaTeam : Math.max(o.atk * o.atkTeam, o.spa * o.spaTeam);
    if (m) {
      if (s && s.move) k *= s.move(pl, S, m);
      if (o.types[m.type]) k *= o.types[m.type];
      if (S && S.castMul && S.castFor === m) k *= S.castMul;
    }
    return k;
  }
  function cdK(pl, m) { const s = spec(pl); return s && s.cd ? s.cd(pl, pl.abS, m) : 1; }
  function reachK(pl, m) { const s = spec(pl); return O(pl).reach * (s && s.reachMove ? s.reachMove(m) : 1); }
  function extraShots(pl, m) { const s = spec(pl); return s && s.extraShots ? s.extraShots(m) : 0; }
  function extraPierce(pl) { const s = spec(pl); return s && s.pierce || 0; }
  function shotLife(pl) { return O(pl).shotLife; }
  const crit = pl => O(pl).crit;
  const critMul = pl => O(pl).critMul;
  const critFxK = pl => O(pl).critFx;
  const spdK = pl => O(pl).spd;
  const drAdd = pl => O(pl).dr;
  const magnetK = pl => O(pl).magnet;
  const healReach = pl => O(pl).healReach;
  const drainK = pl => { const s = spec(pl); return s && s.drainK || 1; };
  const maxHpK = pl => { const s = spec(pl); return s && s.maxHpK || 1; };
  function slowImmune(pl) {
    const s = spec(pl), S = pl.abS;
    if (O(pl).noStatus) return true;
    return !!(s && (s.noSlow || (s.noSlowIf && s.noSlowIf(pl, S))));
  }
  function burnImmune(pl) { const s = spec(pl); return O(pl).noStatus || !!(s && (s.noBurn || (s.noBurnIf && s.noBurnIf(pl, pl.abS)))); }
  function poisonImmune(pl) { const s = spec(pl); return O(pl).noStatus || !!(s && (s.noPoison || (s.noPoisonIf && s.noPoisonIf(pl, pl.abS)))); }
  /** No weather downsides (chip damage, snow slow, weakened types). */
  function wxSafe(pl) { const s = spec(pl); return O(pl).noWx || !!(s && (s.noWx || s.noWxOut)); }
  function lavaSafe(pl) { const s = spec(pl); return !!(s && s.noLava); }
  function waterSafe(pl) { const s = spec(pl); return !!(s && s.noWater); }
  /** Your defensive types (Color Change, Forecast, Zen Mode, Imposter...). */
  function defTypes(pl) { const s = spec(pl); return (s && s.types && s.types(pl, pl.abS)) || pl.mon.types; }
  /** Weather on YOUR attacks: no weakened types with Cloud Nine and the like. */
  function wxOut(pl, type) { const k = G.Weather.mult(type); return k < 1 && wxSafe(pl) ? 1 : k; }
  function wxIn(pl, type) { const k = G.Weather.mult(type); return k > 1 && wxSafe(pl) ? 1 : k; }
  /** A move's type after Normalize / Pixilate / Refrigerate / Liquid Voice. */
  function moveType(pl, m) { const s = spec(pl); return (s && s.type && m && s.type(pl, m)) || (m && m.type); }
  function ticketK() { return G.Game.everyone().some(p => p && (A[idOf(p)] || {}).ticketK) ? 1.15 : 1; }
  function enemyShotK() { return terrainOn() && G.Game.everyone().some(p => p && idOf(p) === 'psychic-surge') ? 0.7 : 1; }
  function reviveK(helper) { return helper && G.MON_ABILITY[helper.dex] === 'healer' ? 1.3 : 1; }
  function reviveHeal(helper) { return helper && G.MON_ABILITY[helper.dex] === 'hospitality' ? 0.25 : 0; }

  /** A hit of yours lands on e: c gets the multiplier, forced crit, shield piercing and status changes. */
  function onHit(pl, e, c, m) {
    const s = spec(pl);
    if (s && s.hit) s.hit(pl, pl.abS, e, c, m);
    if (e.abRuinT > 0) c.mul *= 1.15;                         // Beads of Ruin (everyone's hits)
    return c;
  }

  /** Before your move runs (Electromorphosis, Gulp Missile, Stance Change...). */
  function beforeCast(pl, m) {
    const S = pl.abS, s = spec(pl);
    if (!S) return;
    S.castMul = 0; S.castFor = m;
    if (s && s.cast) s.cast(pl, S, m);
  }
  function afterCast(pl, m) { const S = pl.abS; if (S) { S.castMul = 0; S.castFor = null; } }
  const dances = (pl, m) => { const s = spec(pl); return !!(s && s.dance && DANCE.has(m.id)); };

  /** A debuff landed on you (slowed, or a boss's / legendary's attack). */
  function debuff(pl, src) {
    const s = spec(pl), S = pl.abS;
    if (!s || !S || s.noDebuff) return;
    if (s.debuff) s.debuff(pl, S, src);
  }

  /**
   * A hit is about to hurt you. → the damage left, or -1 if it does nothing (blocked or absorbed).
   * `k`: the type multiplier against your (ability-adjusted) types.
   */
  function incoming(pl, amount, type, pure, src, k) {
    const S = pl.abS, s = spec(pl);
    if (!S) return amount;
    const h = { amount, type, pure, src, e: src && src.e || null, k: k || 1, block: null, absorb: false };
    if (s && s.inc) s.inc(pl, S, h);
    // "Can't be burned / poisoned" (Water Veil, Immunity, Comatose, Misty Terrain...): players never get those
    // statuses, so instead their Fire / Poison hits deal 20% less (25-10-2026).
    if (!h.pure && ((type === 'fire' && burnImmune(pl)) || (type === 'poison' && poisonImmune(pl)))) h.amount *= 0.8;
    if (h.e && boss(h.e)) h.amount *= O(pl).bossDr;
    if (h.e && h.e.abWeakT > 0) h.amount *= 0.8;                // Wandering Spirit (on the host's copies)
    if (h.block) {
      pl.invuln = Math.max(pl.invuln, 0.45);
      if (!S.blockSaid || now() - S.blockSaid > 1) { S.blockSaid = now(); say(pl, typeof h.block === 'string' ? h.block : 'Blocked!', '#c8d4ea'); }
      return -1;
    }
    if (h.absorb) {
      pl.invuln = Math.max(pl.invuln, 0.3);
      if (!S.blockSaid || now() - S.blockSaid > 1) { S.blockSaid = now(); say(pl, 'Absorbed!', '#5fe0b0'); }
      return -1;
    }
    S.lastInc = h;
    return h.amount;
  }

  /** You've just lost d HP. */
  function hurt(pl, d, type, src) {
    const S = pl.abS, s = spec(pl);
    if (!S) return;
    const h = S.lastInc || { type, src, e: src && src.e || null };
    S.lastInc = null;
    if (h.e && boss(h.e)) debuff(pl, h);
    if (s && s.hurt) s.hurt(pl, S, h, d);
  }

  /** A hit would knock you out: true to survive at 1 HP (Sturdy). */
  function lethal(pl, d) {
    const s = spec(pl), S = pl.abS;
    return !!(s && s.lethal && S && s.lethal(pl, S, null, pl.hp + d));
  }
  function death(pl, d) { const s = spec(pl); if (s && s.death) s.death(pl, pl.abS, d); }

  /** An enemy touched you (after its hit). */
  function contactHit(pl, e) { const s = spec(pl); if (s && s.contact && !e.dead) s.contact(pl, pl.abS, e); }

  /** Healing items and berries: how much they heal, and what happens after (Cud Chew, Natural Cure, Symbiosis). */
  function healK(pl) { return O(pl).heal; }
  function afterHeal(pl, amt) { const s = spec(pl); if (s && s.onHeal) s.onHeal(pl, pl.abS, amt); }

  /** Enemy damage changes from the enemy's side (Wandering Spirit's weakening). */
  function enemyDmgK(e) { return e && e.abWeakT > 0 ? 0.8 : 1; }

  /** For the pause menu: your ability's name and text. */
  function info(pl) { const id = pl && pl.ab; return id && G.ABILITIES[id] ? Object.assign({ id }, G.ABILITIES[id]) : null; }

  return { A, start, tick, hostTick, pow, cdK, reachK, extraShots, extraPierce, shotLife, crit, critMul, critFxK, spdK, drAdd, magnetK, healReach,
           drainK, maxHpK, slowImmune, wxSafe, lavaSafe, waterSafe, defTypes, wxOut, wxIn, moveType, ticketK, enemyShotK, reviveK, reviveHeal,
           noRecoil: pl => !!(spec(pl) || {}).noRecoil, onHit, beforeCast, afterCast, dances, incoming, hurt, lethal, death, contactHit, healK, afterHeal, enemyDmgK, info, terrainOn,
           berryDrop: () => (G.Game.everyone().some(p => p && (A[idOf(p)] || {}).berryDrop) ? 0.006 : 0) };
})();
