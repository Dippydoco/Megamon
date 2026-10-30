/* ============ world.js — infinite open arena with obstacles ============
 *
 * Terrain per tile, deterministic (seeded value noise):
 *   floor   ground (with patches of dirt)
 *   wall    rock formations: block walkers and projectiles
 *   liquid  water (slows) or lava in the volcano (burns)
 *
 * Scenery objects (props), drawn sorted by Y with the entities:
 *   tree    blocks, indestructible (cover)
 *   rock    blocks, breaks; may drop experience, coins or berries
 *   chest   blocks, breaks; drops good loot
 *   grass   tall grass, doesn't block; cut by any attack
 *   altar   power altar: touching it gives a temporary power (once)
 *   spring  spring: heals while you stand on it; runs dry and refills
 *   bigchest locked chest: opens if you stay next to it for a few seconds
 *   trap    trap (poison, sticky, explosive): triggers when stepped on, enemies
 *           included
 *   (the interactables' logic is in systems/interact.js)
 *
 * Rift: setArena() turns a distant area of the map into a round arena
 * closed off by walls, where you fight a legendary (systems/rift.js).
 *
 * Flying Pokémon, ghosts and bosses ignore terrain.
 *
 * Coordinates: an entity's (x, y) = its FEET, on the ground plane.
 * Chunks are split into DATA (cheap, always) and IMAGE (baked at
 * art resolution and only for the visible ones).
 */
G.World = (() => {
  const T = G.Tiles.T;                     // art px per tile
  const N = 16;                            // tiles per chunk
  const TS = T * G.Sprites.PX;             // tile size in the world (32)
  const CW = N * TS;                       // chunk size in the world (512)
  const FLOOR = 0, WALL = 1, LIQUID = 2;
  const KIND = ['floor', 'wall', 'liquid'];

  let seed = 1, biome = 0;
  let arena = null;                        // { tx, ty, r } in tiles
  const data = new Map();                  // "cx,cy" -> chunk data
  let images = new Map();                  // "cx,cy" -> canvas horneado
  // Biome change: for FADE seconds the old palette blends into the new one.
  const FADE = 2.6;
  let fade = null;                         // { from, images, t }
  const MAX_IMAGES = 48, MAX_DATA = 400;
  const broken = new Set();                // props destruidos: "tx,ty"
  let nextPropId = 1;

  // ---------------- ruido ----------------

  const H = (x, y, s) => G.U.hash(x, y, s);

  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = H(xi, yi, s), b = H(xi + 1, yi, s), c = H(xi, yi + 1, s), d = H(xi + 1, yi + 1, s);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }
  const fbm = (x, y, s) => vnoise(x, y, s) * 0.65 + vnoise(x * 2.13 + 17, y * 2.13 - 9, s + 1) * 0.35;

  /** A tile's "pure" terrain (no cache). */
  function arenaDist(tx, ty) { return arena ? Math.hypot(tx - arena.tx, ty - arena.ty) : Infinity; }

  /**
   * The arena's clear corridor: where you appear (south) and the legendary (north).
   * With `clear` in the theme, also a clearing where Arceus lands (5 to the north).
   */
  function arenaSafe(tx, ty) {
    const lx = tx - arena.tx, ly = ty - arena.ty;
    return (Math.abs(lx) <= 2 && ly >= -6 && ly <= 5) || Math.hypot(lx, ly) < 2.5 ||
           (arena.th.clear > 0 && Math.hypot(lx, ly + 5) < arena.th.clear);
  }

  /** Six 2x2 monoliths in a ring around the centre (Zygarde arena theme `ring`). */
  function ringBlock(tx, ty) {
    const lx = tx - arena.tx, ly = ty - arena.ty;
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 6 + k * Math.PI / 3, bx = Math.round(Math.cos(a) * 7.5), by = Math.round(Math.sin(a) * 7.5);
      if (lx - bx >= 0 && lx - bx <= 1 && ly - by >= 0 && ly - by <= 1) return true;
    }
    return false;
  }

  /**
   * Battle Tower dungeon floors (systems/towerfloors.js): an arena can carry a hand-built or generated map instead
   * of the round shape: { x0, y0, w, h, rows } in tiles, rows of '#' wall, '.' floor, '~' liquid. Everything up to
   * MAP_PAD tiles around it is wall. Returns null outside that area.
   */
  const MAP_PAD = 10;
  function inMap(tx, ty, pad = MAP_PAD) {
    const m = arena && arena.map;
    return !!m && tx >= m.x0 - pad && ty >= m.y0 - pad && tx < m.x0 + m.w + pad && ty < m.y0 + m.h + pad;
  }
  function mapTile(tx, ty) {
    if (!inMap(tx, ty)) return null;
    const m = arena.map, lx = tx - m.x0, ly = ty - m.y0;
    if (lx < 0 || ly < 0 || lx >= m.w || ly >= m.h) return WALL;
    const c = m.rows[ly][lx];
    return c === '.' ? FLOOR : c === '~' ? LIQUID : WALL;
  }

  function terrainRaw(tx, ty) {
    if (arena && arena.map) { const mt = mapTile(tx, ty); if (mt != null) return mt; }
    const ad = arenaDist(tx, ty);
    if (ad < arena_outer()) {
      if (ad >= arena.r) return WALL;
      if (arenaSafe(tx, ty)) return FLOOR;
      const th = arena.th;
      // 2×2 columns (cover) and puddles depending on the arena's type.
      if (th.ring && ringBlock(tx, ty)) return WALL;
      if (th.pillars && ad < arena.r - 2 && H(tx >> 1, ty >> 1, seed + 31 + arena.tx) < th.pillars) return WALL;
      if (th.pools && ad < arena.r - 1.5 && fbm(tx / 3.2, ty / 3.2, seed + 37 + arena.tx) < th.pools) return LIQUID;
      return FLOOR;
    }
    const d = Math.hypot(tx, ty);
    if (d < 9) return FLOOR;                          // starting clearing
    const ramp = G.U.clamp((d - 9) / 8, 0, 1);       // gentle appearance
    if (fbm(tx / 13, ty / 13, seed + 101) < 0.04 + 0.23 * ramp) return LIQUID;
    if (fbm(tx / 8, ty / 8, seed + 202) > 1 - 0.27 * ramp) return WALL;
    return FLOOR;
  }

  // ---------------- chunk data ----------------

  function chunkData(cx, cy) {
    const k = cx + ',' + cy;
    let c = data.get(k);
    if (c) return c;

    c = { cx, cy, terr: new Uint8Array(N * N),
          props: [], propAt: new Map(), liquids: [] };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const tx = cx * N + i, ty = cy * N + j;
      const t = terrainRaw(tx, ty);
      c.terr[j * N + i] = t;
      if (t === LIQUID) c.liquids.push(tx, ty);
    }
    if (data.size > MAX_DATA) data.delete(data.keys().next().value);
    data.set(k, c);
    placeProps(c);
    return c;
  }

  function terrainAt(tx, ty) {
    const cx = Math.floor(tx / N), cy = Math.floor(ty / N);
    const c = data.get(cx + ',' + cy) || chunkData(cx, cy);
    return c.terr[(ty - cy * N) * N + (tx - cx * N)];
  }

  const arena_outer = () => (arena ? arena.r + 7 : 0);

  /** Is (tx,ty) a Zygarde Portal tile? (pure function of the seed, so neighbouring chunks agree) */
  function portalTile(tx, ty) {
    const h = H(tx, ty, seed + 919);
    if (h >= 0.000004 || Math.hypot(tx, ty) <= 25) return false;
    for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++)
      if (terrainRaw(tx + a, ty + b) !== FLOOR) return false;
    // Spacing: of two candidates closer than 12 tiles, only the one with the lower hash survives.
    for (let b = -12; b <= 12; b++) for (let a = -12; a <= 12; a++) {
      if (!a && !b) continue;
      const h2 = H(tx + a, ty + b, seed + 919);
      if (h2 < 0.000004 && (h2 < h || (h2 === h && (b < 0 || (b === 0 && a < 0))))) return false;
    }
    return true;
  }
  /** Keep a clear area around portals: no trees, rocks, chests or grass within 4 tiles. */
  function nearPortal(tx, ty) {
    for (let b = -5; b <= 5; b++) for (let a = -5; a <= 5; a++)
      if ((a || b) && portalTile(tx + a, ty + b)) return true;
    return false;
  }

  function placeProps(c) {
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (c.terr[j * N + i] !== FLOOR) continue;
      const tx = c.cx * N + i, ty = c.cy * N + j;
      if (Math.hypot(tx, ty) < 7) continue;
      if (broken.has(tx + ',' + ty)) continue;
      if (inMap(tx, ty)) continue;                 // a dungeon floor's map: no trees, chests or traps of the open world

      // Needs ground around it so it isn't stuck against walls / water.
      let open = true;
      for (let b = -1; b <= 1 && open; b++) for (let a = -1; a <= 1; a++)
        if (terrainRaw(tx + a, ty + b) !== FLOOR) { open = false; break; }

      // Inside the arena: its type's decoration (and nothing in the corridor).
      const ad = arenaDist(tx, ty);
      if (ad < arena_outer() + 2) {
        if (!arena || ad >= arena.r - 1.2 || arenaSafe(tx, ty)) continue;
        const pr = arena.th.props, hh = H(tx, ty, seed + 777);
        let at = null;
        if (open && hh < (pr.tree || 0)) at = 'tree';
        else if (open && hh < (pr.tree || 0) + (pr.rock || 0)) at = 'rock';
        else if (hh > 1 - (pr.grass || 0)) at = 'grass';
        if (at) { const p = makeProp(at, tx, ty); c.props.push(p); if (p.solid) c.propAt.set(tx + ',' + ty, p); }
        continue;
      }

      const h = H(tx, ty, seed + 404);
      const grove = fbm(tx / 10, ty / 10, seed + 505) > 0.6;
      let type = null, kind = 0;
      // Interactables (rare), far from the starting clearing.
      const hs = H(tx, ty, seed + 909);
      if (open && Math.hypot(tx, ty) > 12 && hs < 0.0032) {
        type = hs < 0.0004 ? 'altar' : hs < 0.0008 ? 'spring' : hs < 0.0011 ? 'bigchest' : 'trap';
        kind = Math.floor(H(tx, ty, seed + 910) * (type === 'altar' ? 6 : 3));
      }
      // Zygarde Portal: very rare, further out than the other specials (about 1 per 15 chunks).
      if (!type && open && portalTile(tx, ty)) type = 'zportal';
      if (type) { /* already chosen */ }
      else if (open && h < (grove ? 0.07 : 0.006)) type = 'tree';
      else if (open && h > 0.992) type = 'rock';
      else if (open && h > 0.985 && h <= 0.992 && H(tx, ty, seed + 606) < 0.07) type = 'chest';
      else if (fbm(tx / 5, ty / 5, seed + 707) > 0.66 && H(tx, ty, seed + 808) < 0.75) type = 'grass';
      if (!type) continue;
      if (type !== 'zportal' && nearPortal(tx, ty)) continue;

      const p = makeProp(type, tx, ty, kind);
      c.props.push(p);
      if (p.solid) c.propAt.set(tx + ',' + ty, p);
    }
  }

  const PROP = {
    tree:  { solid: true,  hp: Infinity, r: 13 },
    rock:  { solid: true,  hp: 34,       r: 12 },
    chest: { solid: true,  hp: 22,       r: 12 },
    grass: { solid: false, hp: 1,        r: 14 },
    altar:    { solid: true,  hp: Infinity, r: 9 },
    spring:   { solid: false, hp: Infinity, r: 22, flat: true },
    bigchest: { solid: true,  hp: Infinity, r: 14 },
    trap:     { solid: false, hp: Infinity, r: 9, flat: true },
    zportal:  { solid: false, hp: Infinity, r: 22, flat: true }
  };
  const SPECIAL = new Set(['altar', 'spring', 'bigchest', 'trap', 'zportal']);

  // Team-wide altars (Gold): once one player takes it, it is used up for everybody (see interact.js).
  const usedAlt = new Set();
  function markUsed(tx, ty) {
    usedAlt.add(tx + ',' + ty);
    const c = data.get(Math.floor(tx / N) + ',' + Math.floor(ty / N));
    const p = c && c.props.find(o => o.tx === tx && o.ty === ty);
    if (p) p.used = true;
  }
  const altarUsed = (tx, ty) => usedAlt.has(tx + ',' + ty);

  function makeProp(type, tx, ty, kind = 0) {
    const d = PROP[type];
    return {
      id: nextPropId++, type, tx, ty, kind,
      x: tx * TS + TS / 2, y: ty * TS + TS - 4,
      r: d.r, hp: d.hp, maxHp: d.hp, solid: d.solid, flat: !!d.flat,
      destructible: d.hp !== Infinity, flash: 0,
      wiggle: H(tx, ty, 9) * 6.28,
      used: usedAlt.has(tx + ',' + ty), charge: 1, open: 0          // altar / spring / locked chest
    };
  }

  // ---------------- consultas ----------------

  const tileOf = v => Math.floor(v / TS);

  function kindAt(x, y) { return KIND[terrainAt(tileOf(x), tileOf(y))]; }
  function isWall(x, y) { return terrainAt(tileOf(x), tileOf(y)) === WALL; }
  function isLiquid(x, y) { return terrainAt(tileOf(x), tileOf(y)) === LIQUID; }
  function liquidKind() { return G.Tiles.BIOMES[biome].liquid; }

  /**
   * Effect of the current puddle on a Pokémon of these types:
   *   { slow, dmg, every, color, slide }  (dmg in % of max health)
   * Those of its type don't suffer their own (Fire in lava, Poison in poison...).
   */
  const LIQ = {
    water: { slow: 0.6, immune: ['water'] },     // water types swim without slowing down
    swamp: { slow: 0.45, immune: ['water'] },
    lava:   { dmg: 0.06, flat: 5, every: 0.5, color: '#ff8a3d', immune: ['fire'] },
    poison: { dmg: 0.035, flat: 3, every: 0.5, color: '#c86bdc', immune: ['poison', 'steel'] },
    spark:  { dmg: 0.045, flat: 4, every: 0.7, color: '#ffe14d', immune: ['electric', 'ground'] },
    ice:    { slide: true, immune: ['ice'] }
  };
  function liquidEffect(types) {
    const e = LIQ[liquidKind()] || LIQ.water;
    if (e.immune && types && types.some(t => e.immune.includes(t))) return {};
    return e;
  }

  function propAtTile(tx, ty) {
    const cx = Math.floor(tx / N), cy = Math.floor(ty / N);
    const c = data.get(cx + ',' + cy) || chunkData(cx, cy);
    return c.propAt.get(tx + ',' + ty) || null;
  }

  /** Can this tile be crossed on foot? (pathing.js) */
  function walkable(tx, ty) {
    const t = terrainAt(tx, ty);
    if (t === WALL) return false;
    if (t === LIQUID && (LIQ[liquidKind()] || {}).dmg) return false;   // lava, poison, charge
    const p = propAtTile(tx, ty);
    return !(p && p.solid);
  }

  /** Is there room for something of radius r to be here? */
  function isFree(x, y, r = 12, allowLiquid = false) {
    const t0x = tileOf(x - r), t1x = tileOf(x + r), t0y = tileOf(y - r), t1y = tileOf(y + r);
    for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) {
      const t = terrainAt(tx, ty);
      if (t === WALL || (!allowLiquid && t === LIQUID)) return false;
      const p = propAtTile(tx, ty);
      if (p && G.U.dist2(x, y, p.x, p.y) < (r + p.r) ** 2) return false;
    }
    return true;
  }

  /** Destructible objects (grass included) touching a circle. */
  function propsInCircle(x, y, r) {
    const out = [];
    const c0x = Math.floor((x - r) / CW), c1x = Math.floor((x + r) / CW);
    const c0y = Math.floor((y - r) / CW), c1y = Math.floor((y + r) / CW);
    for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
      const c = chunkData(cx, cy);
      for (const p of c.props) {
        if (!p.destructible || p.hp <= 0) continue;
        if (G.U.dist2(x, y, p.x, p.y) <= (r + p.r) ** 2) out.push(p);
      }
    }
    return out;
  }

  /** Interactive objects (altars, springs, locked chests, traps) nearby. */
  function specialsNear(x, y, r) {
    const out = [];
    const c0x = Math.floor((x - r) / CW), c1x = Math.floor((x + r) / CW);
    const c0y = Math.floor((y - r) / CW), c1y = Math.floor((y + r) / CW);
    for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
      for (const p of chunkData(cx, cy).props) {
        if (SPECIAL.has(p.type) && G.U.dist2(x, y, p.x, p.y) <= (r + p.r) ** 2) out.push(p);
      }
    }
    return out;
  }

  /** Nearest rock or chest (for aiming when there are no enemies). */
  function nearestBreakable(x, y, r) {
    let best = null, bd = r * r;
    for (const p of propsInCircle(x, y, r)) {
      if (!p.solid) continue;
      const d = G.U.dist2(x, y, p.x, p.y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  /**
   * Pushes a circle out of walls and solid objects (sliding).
   * Returns true if it hit something.
   */
  function collide(e) {
    const r = e.r;
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      const t0x = tileOf(e.x - r), t1x = tileOf(e.x + r), t0y = tileOf(e.y - r), t1y = tileOf(e.y + r);
      for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) {
        if (terrainAt(tx, ty) === WALL) {
          // Nearest point of the tile's box to the circle's centre.
          const bx0 = tx * TS, by0 = ty * TS, bx1 = bx0 + TS, by1 = by0 + TS;
          const qx = G.U.clamp(e.x, bx0, bx1), qy = G.U.clamp(e.y, by0, by1);
          let dx = e.x - qx, dy = e.y - qy;
          const d2 = dx * dx + dy * dy;
          if (d2 >= r * r) continue;
          hit = true;
          if (d2 > 1e-6) {
            const d = Math.sqrt(d2);
            e.x += dx / d * (r - d); e.y += dy / d * (r - d);
          } else {
            // Centre inside the box: exit through the nearest side.
            const l = e.x - bx0, rr = bx1 - e.x, u = e.y - by0, b = by1 - e.y;
            const m = Math.min(l, rr, u, b);
            if (m === l) e.x = bx0 - r; else if (m === rr) e.x = bx1 + r;
            else if (m === u) e.y = by0 - r; else e.y = by1 + r;
          }
        }
        const p = propAtTile(tx, ty);
        if (p && p.solid) {
          const dx = e.x - p.x, dy = e.y - p.y;
          const min = r + p.r, d2 = dx * dx + dy * dy;
          if (d2 < min * min) {
            hit = true;
            const d = Math.sqrt(d2) || 0.01;
            e.x = p.x + dx / d * min; e.y = p.y + dy / d * min;
          }
        }
      }
    }
    return hit;
  }

  /** Does a projectile collide here? Returns 'wall', the solid prop, or null. */
  function projectileBlock(x, y, r) {
    const tx = tileOf(x), ty = tileOf(y);
    if (terrainAt(tx, ty) === WALL) return 'wall';
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
      const p = propAtTile(tx + a, ty + b);
      if (p && p.solid && G.U.dist2(x, y, p.x, p.y) < (r + p.r) ** 2) return p;
    }
    return null;
  }

  // ---------------- damage to objects ----------------

  function damageProp(p, amount, color = '#fff') {
    if (!p.destructible || p.hp <= 0) return false;
    p.hp -= amount;
    p.flash = 0.08;
    if (p.type !== 'grass') G.FX.spark(p.x, p.y - 10, color, 0, -1, 3);
    if (p.hp <= 0) { destroyProp(p); return true; }
    return false;
  }

  /** Breaks the object on that tile (arrives over the network in co-op). */
  function breakAt(tx, ty) {
    const k = tx + ',' + ty;
    if (broken.has(k)) return;
    const c = data.get(Math.floor(tx / N) + ',' + Math.floor(ty / N));
    const p = c && c.props.find(o => o.tx === tx && o.ty === ty);
    if (p) destroyProp(p, true); else broken.add(k);
  }

  function destroyProp(p, fromNet = false) {
    broken.add(p.tx + ',' + p.ty);
    if (G.Coop.active && !fromNet) G.Coop.propBroken(p);
    const cx = Math.floor(p.tx / N), cy = Math.floor(p.ty / N);
    const c = data.get(cx + ',' + cy);
    if (c) {
      c.props.splice(c.props.indexOf(p), 1);
      c.propAt.delete(p.tx + ',' + p.ty);
    }
    const B = G.Tiles.BIOMES[biome];
    G.Audio.sfx(p.type === 'grass' ? 'grass' : p.type === 'chest' ? 'chest' : 'break');
    if (p.type === 'grass') {
      G.FX.burst(p.x, p.y - 6, B.grass[1], 6, 70);
      const r = Math.random();
      if (r < 0.05) G.Pickups.drop('heal', p.x, p.y);
      else if (r < 0.11) G.Pickups.drop('coin', p.x, p.y, 1);
      return;
    }
    if (p.type === 'rock') {
      G.FX.burst(p.x, p.y - 10, B.rock[1], 14, 140);
      G.FX.ring(p.x, p.y - 8, 4, 26, B.rock[2], 0.3, 3);
      const r = Math.random();
      if (r < 0.40) G.Pickups.dropXp(p.x, p.y, 6);
      if (r > 0.75) G.Pickups.drop('coin', p.x, p.y, 2);
      if (r > 0.94) G.Pickups.drop('heal', p.x + 8, p.y);
      return;
    }
    if (p.type === 'chest') {
      G.FX.burst(p.x, p.y - 10, '#f2c443', 22, 180);
      G.FX.ring(p.x, p.y - 8, 6, 46, '#f2c443', 0.45, 4);
      G.Camera.kick(0.25);
      const n = G.U.randInt(4, 7);
      for (let i = 0; i < n; i++) G.Pickups.drop('coin', p.x + G.U.rand(-14, 14), p.y + G.U.rand(-10, 10), 3);
      G.Pickups.drop(Math.random() < 0.5 ? 'heal' : 'magnet', p.x, p.y);
      G.Pickups.dropXp(p.x, p.y, 20);
      if (Math.random() < 0.08) G.Pickups.drop('item', p.x, p.y - 12, G.Items.roll());
      return;
    }
    if (p.type === 'bigchest') {
      // Big loot: coins, tickets and enough experience to level up.
      G.FX.burst(p.x, p.y - 12, '#f2c443', 34, 220);
      G.FX.ring(p.x, p.y - 8, 6, 80, '#f2c443', 0.6, 5);
      G.Camera.kick(0.4);
      for (let i = 0; i < 9; i++) G.Pickups.drop('coin', p.x + G.U.rand(-22, 22), p.y + G.U.rand(-14, 14), 4);
      const tk = G.U.randInt(1, 3);
      for (let i = 0; i < tk; i++) G.Pickups.drop('ticket', p.x + G.U.rand(-16, 16), p.y + G.U.rand(-10, 10), 1);
      if (Math.random() < 0.15) G.Pickups.drop('ticket10', p.x, p.y - 10, 1);
      if (Math.random() < 0.5) G.Pickups.drop('item', p.x + 14, p.y - 14, G.Items.roll());
      G.Pickups.dropXp(p.x, p.y, G.Game.levelXp());
      G.Progress.event('chest');
      return;
    }
    if (p.type === 'trap') G.Interact.trapEffect(p);
  }

  // ---------------- drawing ----------------

  function chunkImage(cx, cy, bi = biome, cache = images) {
    const k = cx + ',' + cy;
    let img = cache.get(k);
    if (img) { cache.delete(k); cache.set(k, img); return img; }      // most recently used last (eviction takes the oldest)
    const at = (tx, ty) => KIND[terrainAt(tx, ty)];
    // Continuous "dirt" field; tiles.js samples it on a grid and
    // interpolates it per pixel so the patches have organic edges.
    const S = 6 * G.Tiles.T;
    const dirtField = (gx, gy) => fbm(gx / S, gy / S, seed + 303);
    img = G.Tiles.paintChunk(cx, cy, N, at, dirtField, bi, seed);
    if (cache.size > MAX_IMAGES) cache.delete(cache.keys().next().value);
    cache.set(k, img);
    return img;
  }

  /** 0..1 of the biome crossfade (smoothed), or null if there isn't one. */
  function fadeK() { if (!fade) return null; const x = Math.min(1, fade.t / FADE); return x * x * (3 - 2 * x); }

  function visibleChunks(cam, pad = 0) {
    const out = [];
    const x0 = Math.floor((cam.left() - pad) / CW), x1 = Math.floor((cam.left() + cam.w + pad) / CW);
    const y0 = Math.floor((cam.top() - pad) / CW), y1 = Math.floor((cam.top() + cam.h + pad) / CW);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) out.push([cx, cy]);
    return out;
  }

  function drawGround(ctx, cam) {
    ctx.imageSmoothingEnabled = false;
    const k = fadeK();
    for (const [cx, cy] of visibleChunks(cam)) {
      // +1 overlap: with non-integer scales it avoids seams between chunks.
      if (k == null) { ctx.drawImage(chunkImage(cx, cy), cx * CW, cy * CW, CW + 1, CW + 1); continue; }
      // Crossfade: the old biome below and the new one appearing on top. The new biome's chunks are painted a couple
      // per frame by update() (30-10-2026: all of them in one frame froze the game at every biome change); until
      // one is ready, the old one shows on its own.
      // A chunk that scrolls in during the fade only gets the new biome (it isn't painted in the old one as well).
      const ck = cx + ',' + cy, old = fade.images.get(ck), nu = images.get(ck) || (old ? null : chunkImage(cx, cy));
      if (old) ctx.drawImage(old, cx * CW, cy * CW, CW + 1, CW + 1);
      if (!nu) continue;
      ctx.globalAlpha = old ? k : 1;
      ctx.drawImage(nu, cx * CW, cy * CW, CW + 1, CW + 1);
      ctx.globalAlpha = 1;
    }
  }

  /** Animated glints on the water / lava bubbles (and poison and electricity). */
  function drawLiquid(ctx, cam, t) {
    const B = G.Tiles.BIOMES[biome];
    const lava = B.liquid === 'lava' || B.liquid === 'poison' || B.liquid === 'spark';
    ctx.fillStyle = B.foam;
    const P = G.Sprites.PX;
    for (const [cx, cy] of visibleChunks(cam)) {
      const c = chunkData(cx, cy);
      for (let i = 0; i < c.liquids.length; i += 2) {
        const tx = c.liquids[i], ty = c.liquids[i + 1];
        const x = tx * TS, y = ty * TS;
        if (!cam.sees(x + TS / 2, y + TS / 2, TS)) continue;
        const ph = H(tx, ty, 77) * 6.28;
        const k = (Math.sin(t * (lava ? 2.2 : 1.6) + ph) + 1) / 2;
        ctx.globalAlpha = lava ? 0.35 + k * 0.5 : k * 0.7;
        const sx = x + Math.floor(H(tx, ty, 78) * 12 + 2) * P;
        const sy = y + Math.floor(H(tx, ty, 79) * 12 + 2) * P;
        ctx.fillRect(sx + Math.round(k * 2) * P, sy, P * (lava ? 2 : 3), P);
        if (lava && k > 0.8) ctx.fillRect(sx, sy - P * 2, P, P);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Visible props, to mix them into the Y order with the entities. */
  function visibleProps(cam) {
    const out = [];
    for (const [cx, cy] of visibleChunks(cam, 60)) {
      for (const p of chunkData(cx, cy).props) if (cam.sees(p.x, p.y, 70)) out.push(p);
    }
    return out;
  }

  // Power altars: a floating icon (same as the buff icon in the HUD) and a particle effect
  // of their own, so each one can be told apart without remembering colours.
  const ALTAR_ICON = ['fist', 'boot', 'magnet', 'clock', 'shield', 'coin'];
  const ALTAR_COL = ['#ff5f6d', '#5fd4ff', '#ff8ad8', '#b48cff', '#c9d6e6', '#ffd23f'];
  function drawAltarSign(ctx, p, t, h, P) {
    const k = p.kind, col = ALTAR_COL[k];
    const ox = p.x, oy = p.y - h + 11 * P;                    // centre of the orb
    const iy = oy - 34 + Math.sin(t * 2.2 + p.wiggle) * 3;     // icon, bobbing
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,26,.78)';
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ox, iy, 15, 0, 6.2832); ctx.fill(); ctx.stroke();
    G.Icons.draw(ctx, ALTAR_ICON[k], ox - 11, iy - 11, 22);
    ctx.restore();
    // Particles (sparse; the effect system caps them by quality).
    if (G.Game.state !== 'playing') return;
    const r = Math.random();
    if (k === 0 && r < 0.07) G.FX.px(ox + G.U.rand(-8, 8), oy + 4, r < 0.03 ? '#ffd23f' : '#ff7b3d', { vy: -45, vx: G.U.rand(-8, 8), life: 0.9 });
    else if (k === 1 && r < 0.09) G.FX.px(ox + G.U.rand(-14, 14), oy + G.U.rand(-14, 10), '#d8f6ff', { vx: G.U.rand(-60, 60), vy: G.U.rand(-60, 60), life: 0.16 });
    else if (k === 2 && r < 0.07) {
      const a = Math.random() * 6.2832;
      G.FX.px(ox + Math.cos(a) * 34, oy + Math.sin(a) * 34, '#ff8ad8', { vx: -Math.cos(a) * 55, vy: -Math.sin(a) * 55, life: 0.6, drag: 1 });
    } else if (k === 3 && (!p.tk || t - p.tk > 1.4)) {
      p.tk = t;                                                // a ring every 1.4 s, like a ticking clock
      G.FX.ring(ox, oy, 6, 26, '#b48cff', 0.5, 2);
    } else if (k === 4 && r < 0.12) {
      const a = t * 2.6 + p.wiggle;                             // silver motes circling the orb, like a shield
      G.FX.px(ox + Math.cos(a) * 20, oy + Math.sin(a) * 12, '#e6eef8', { life: 0.35, drag: 1 });
    } else if (k === 5 && r < 0.08) {
      G.FX.px(ox + G.U.rand(-12, 12), oy + G.U.rand(-6, 10), r < 0.02 ? '#ffffff' : '#ffd23f', { vy: -28, life: 0.75 });   // glints
      if (r < 0.01) G.FX.twinkle(ox + G.U.rand(-16, 16), oy + G.U.rand(-12, 8));
    }
  }

  function drawProp(ctx, p, t) {
    const P = G.Sprites.PX;
    const variant = p.type === 'grass' ? (Math.sin(t * 2.4 + p.wiggle) > 0.55 ? 1 : 0)
                  : p.type === 'rock' ? (p.hp < p.maxHp * 0.5 ? 1 : 0)
                  : p.type === 'altar' ? p.kind * 2 + (p.used ? 1 : 0)
                  : p.type === 'spring' ? (p.charge < 0.15 ? 1 : 0)
                  : p.type === 'trap' ? p.kind : 0;
    if (p.type === 'zportal' && p.used) return;       // a portal works only once
    const img = G.Tiles.propSprite(biome, p.type, variant);
    const w = img.width * P, h = img.height * P;
    if (p.type === 'zportal') {
      const S = 2, cx = p.x, cy = p.y - 8;          // the portal is drawn twice as big as before (S)
      const pulse = Math.sin(t * 2.4 + p.wiggle);
      ctx.save();
      // Soft green ground glow (two layers) and a faint light column rising from the portal.
      ctx.globalAlpha = 0.28 + pulse * 0.1;
      ctx.fillStyle = '#5fe08a';
      ctx.beginPath(); ctx.ellipse(cx, cy, 48 * S, 28 * S, 0, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 0.22 + pulse * 0.08;
      ctx.fillStyle = '#c8ff7a';
      ctx.beginPath(); ctx.ellipse(cx, cy, 30 * S, 17 * S, 0, 0, 6.2832); ctx.fill();
      const g = ctx.createLinearGradient(0, cy, 0, cy - 110 * S);
      g.addColorStop(0, 'rgba(120,255,160,0.30)'); g.addColorStop(1, 'rgba(120,255,160,0)');
      ctx.globalAlpha = 0.8 + pulse * 0.2;
      ctx.fillStyle = g;
      ctx.fillRect(cx - 26 * S, cy - 110 * S, 52 * S, 110 * S);
      ctx.restore();
      // Rising sparks, motes circling the rim, and a ring pulse every 1.6 s.
      if (Math.random() < 0.55) G.FX.px(cx + G.U.rand(-28, 28) * S, cy + G.U.rand(-8, 10) * S, Math.random() < 0.5 ? '#9dffb8' : '#d6ff5f', { vy: -G.U.rand(30, 60), life: 1 });
      if (Math.random() < 0.35) {
        const a = t * 2 + Math.random() * 6.2832;
        G.FX.px(cx + Math.cos(a) * 34 * S, cy + Math.sin(a) * 18 * S, '#ffffff', { vy: -20, life: 0.5 });
      }
      if (!p.tk || t - p.tk > 1.6) { p.tk = t; G.FX.ring(cx, cy, 8, 46 * S, '#7dffa8', 0.6, 3); }
      if (Math.random() < 0.03) G.FX.twinkle(cx + G.U.rand(-30, 30) * S, cy + G.U.rand(-14, 10) * S);
    }
    if (p.flat) {
      // Flat ones (spring, trap): stuck to the ground, centred on their tile.
      ctx.drawImage(img, Math.round(p.x - w / 2), Math.round(p.y - 8 - h / 2), w, h);
      if (p.type === 'spring' && p.charge >= 0.15 && Math.sin(t * 3 + p.wiggle) > 0.92) {
        G.FX.twinkle(p.x + G.U.rand(-20, 20), p.y - 8 + G.U.rand(-6, 6));
      }
      return;
    }
    if (p.type === 'altar' && !p.used) {
      // The orb's halo, pulsing.
      const col = ['#ff5f6d', '#5fd4ff', '#ff8ad8', '#b48cff', '#c9d6e6', '#ffd23f'][p.kind];
      ctx.save();
      ctx.globalAlpha = 0.22 + Math.sin(t * 3 + p.wiggle) * 0.1;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(p.x, p.y - h + 11 * P, 13, 0, 6.2832); ctx.fill();
      ctx.restore();
    }
    if (p.type === 'bigchest' && p.open > 0) {
      ctx.save();
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y - h / 2, 26, -Math.PI / 2, -Math.PI / 2 + 6.2832 * Math.min(1, p.open / G.Interact.CHEST_TIME));
      ctx.stroke();
      ctx.restore();
    }
    if (p.type !== 'grass') {
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * 1.1, p.r * 0.38, 0, 0, 6.2832); ctx.fill();
    }
    ctx.save();
    const x = Math.round(p.x - w / 2), y = Math.round(p.y - h + (p.type === 'grass' ? 4 : 2));
    const k = fadeK();
    if (k != null) {
      // The old object fades out while the new one appears.
      const old = G.Tiles.propSprite(fade.from, p.type, variant);
      ctx.globalAlpha = 1 - k;
      ctx.drawImage(old, Math.round(p.x - old.width * P / 2), Math.round(p.y - old.height * P + (p.type === 'grass' ? 4 : 2)), old.width * P, old.height * P);
      ctx.globalAlpha = k;
    }
    ctx.drawImage(img, x, y, w, h);
    if (p.type === 'altar' && !p.used) drawAltarSign(ctx, p, t, h, P);
    if (p.flash > 0) { ctx.globalAlpha = 0.6; ctx.drawImage(G.Sprites.white(img), x, y, w, h); }
    ctx.restore();
  }

  function update(dt, cam) {
    if (fade && (fade.t += dt) >= FADE) fade = null;
    // Pre-bake (30-10-2026): the ground chunks just outside the view (and, during a biome fade, the new biome's) are
    // painted ahead of time, one per frame, instead of several at once in the frame they scroll into view.
    const ahead = visibleChunks(cam, CW * 0.8);
    if (ahead.length < MAX_IMAGES - 4) {
      for (const [cx, cy] of ahead) if (!images.has(cx + ',' + cy)) { chunkImage(cx, cy); break; }
    }
    for (const [cx, cy] of visibleChunks(cam, 60)) {
      for (const p of chunkData(cx, cy).props) if (p.flash > 0) p.flash -= dt;
    }
  }

  // ---------------- control ----------------

  function reset(s) {
    seed = (s | 0) || 1;
    usedAlt.clear();
    data.clear(); images.clear(); broken.clear();
    fade = null; arena = null;
  }

  /**
   * @param i        biome (G.Tiles.ARENA and onwards are the rift arenas)
   * @param instant  no crossfade (when starting a run)
   * A run changes biome every 4 min and goes through the whole list; when it runs out,
   * it starts again. (Previously, past the last one, around minute 84, it asked for
   * a biome that doesn't exist: black screen, the game broken and endless levels.)
   */
  function setBiome(i, instant = false) {
    const n = G.Tiles.BIOMES.length;
    const b = ((i % n) + n) % n;
    if (b === biome) return;
    // The terrain is the same: only the palette changes, blending gradually.
    fade = instant ? null : { from: biome, images, t: 0 };
    biome = b;
    images = new Map();
  }

  function biomeName() { return G.Tiles.BIOMES[biome].name; }

  /** Vignette in screen coordinates. */
  function drawVignette(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.34, w / 2, h / 2, Math.max(w, h) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  return {
    TS, CW, reset, setBiome, biomeName, liquidKind, liquidEffect, walkable,
    kindAt, isWall, isLiquid, isFree, collide, projectileBlock, propsInCircle, nearestBreakable,
    damageProp, breakAt, specialsNear, update, markUsed, altarUsed,
    breakProp(p) { if (!broken.has(p.tx + ',' + p.ty)) destroyProp(p); },
    /** Rift arena: { tx, ty, r } (in tiles) or null. */
    setArena(a) {
      arena = a;
      if (!a) return;
      a.th = G.Tiles.ARENA_THEMES[a.type] || G.Tiles.ARENA_THEMES.normal;
      // Forgets that area's chunks (if they'd been generated before). (A map: its whole rectangle.)
      const R = a.map ? Math.max(a.map.w, a.map.h) / 2 + MAP_PAD + 4 : a.r + 9;
      for (const k of [...data.keys(), ...images.keys()]) {
        const [cx, cy] = k.split(',').map(Number);
        if (Math.abs(cx * N + N / 2 - a.tx) < R + N && Math.abs(cy * N + N / 2 - a.ty) < R + N) { data.delete(k); images.delete(k); }
      }
    },
    get arena() { return arena; }, drawGround, drawLiquid, visibleProps, drawProp, drawVignette,
    get biome() { return biome; }
  };
})();
