/* ============ world.js — arena abierta infinita con obstáculos ============
 *
 * Terreno por tile, determinista (ruido de valor con semilla):
 *   floor   suelo (con manchas de tierra)
 *   wall    formaciones rocosas: bloquean a quien camina y a los proyectiles
 *   liquid  agua (ralentiza) o lava en el volcán (quema)
 *
 * Objetos del escenario (props), dibujados ordenados por Y con las entidades:
 *   tree    bloquea, indestructible (cobertura)
 *   rock    bloquea, se rompe; puede soltar experiencia, monedas o bayas
 *   chest   bloquea, se rompe; suelta un buen botín
 *   grass   hierba alta, no bloquea; se corta con cualquier ataque
 *   altar   altar de poder: al tocarlo da un poder temporal (una vez)
 *   spring  manantial: cura mientras estás encima; se agota y se recarga
 *   bigchest cofre con candado: se abre quedándote al lado unos segundos
 *   trap    trampa (veneno, pegajosa, explosiva): salta al pisarla, también
 *           con los enemigos
 *   (la lógica de los interactivos está en systems/interact.js)
 *
 * Grieta: setArena() convierte una zona lejana del mapa en una arena redonda
 * cerrada por paredes, donde se lucha contra un legendario (systems/rift.js).
 *
 * Los Pokémon voladores, los fantasma y los jefes ignoran el terreno.
 *
 * Coordenadas: (x, y) de una entidad = sus PIES, en el plano del suelo.
 * Los chunks se separan en DATOS (baratos, siempre) e IMAGEN (horneada a
 * resolución de arte y sólo para los visibles).
 */
G.World = (() => {
  const T = G.Tiles.T;                     // px de arte por tile
  const N = 16;                            // tiles por chunk
  const TS = T * G.Sprites.PX;             // tamaño de tile en mundo (32)
  const CW = N * TS;                       // tamaño de chunk en mundo (512)
  const FLOOR = 0, WALL = 1, LIQUID = 2;
  const KIND = ['floor', 'wall', 'liquid'];

  let seed = 1, biome = 0;
  let arena = null;                        // { tx, ty, r } en tiles
  const data = new Map();                  // "cx,cy" -> datos del chunk
  let images = new Map();                  // "cx,cy" -> canvas horneado
  // Cambio de bioma: durante FADE segundos se funde la paleta vieja con la nueva.
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

  /** Terreno "puro" de un tile (sin caché). */
  function arenaDist(tx, ty) { return arena ? Math.hypot(tx - arena.tx, ty - arena.ty) : Infinity; }

  /**
   * Pasillo libre de la arena: donde aparecéis (sur) y el legendario (norte).
   * Con `clear` en el tema, además un claro donde aterriza Arceus (5 al norte).
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

  function terrainRaw(tx, ty) {
    const ad = arenaDist(tx, ty);
    if (ad < arena_outer()) {
      if (ad >= arena.r) return WALL;
      if (arenaSafe(tx, ty)) return FLOOR;
      const th = arena.th;
      // Columnas de 2×2 (cobertura) y charcos según el tipo de la arena.
      if (th.ring && ringBlock(tx, ty)) return WALL;
      if (th.pillars && ad < arena.r - 2 && H(tx >> 1, ty >> 1, seed + 31 + arena.tx) < th.pillars) return WALL;
      if (th.pools && ad < arena.r - 1.5 && fbm(tx / 3.2, ty / 3.2, seed + 37 + arena.tx) < th.pools) return LIQUID;
      return FLOOR;
    }
    const d = Math.hypot(tx, ty);
    if (d < 9) return FLOOR;                          // claro inicial
    const ramp = G.U.clamp((d - 9) / 8, 0, 1);       // aparición suave
    if (fbm(tx / 13, ty / 13, seed + 101) < 0.04 + 0.23 * ramp) return LIQUID;
    if (fbm(tx / 8, ty / 8, seed + 202) > 1 - 0.27 * ramp) return WALL;
    return FLOOR;
  }

  // ---------------- datos de chunk ----------------

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

      // Necesita suelo alrededor para no pegarse a paredes / agua.
      let open = true;
      for (let b = -1; b <= 1 && open; b++) for (let a = -1; a <= 1; a++)
        if (terrainRaw(tx + a, ty + b) !== FLOOR) { open = false; break; }

      // Dentro de la arena: la decoración de su tipo (y nada en el pasillo).
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
      // Interactivos (raros), lejos del claro del principio.
      const hs = H(tx, ty, seed + 909);
      if (open && Math.hypot(tx, ty) > 12 && hs < 0.0032) {
        type = hs < 0.0004 ? 'altar' : hs < 0.0008 ? 'spring' : hs < 0.0011 ? 'bigchest' : 'trap';
        kind = Math.floor(H(tx, ty, seed + 910) * (type === 'altar' ? 6 : 3));
      }
      // Zygarde Portal: very rare, further out than the other specials (about 1 per 15 chunks).
      if (!type && open && portalTile(tx, ty)) type = 'zportal';
      if (type) { /* ya elegido */ }
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
      used: usedAlt.has(tx + ',' + ty), charge: 1, open: 0          // altar / manantial / cofre con candado
    };
  }

  // ---------------- consultas ----------------

  const tileOf = v => Math.floor(v / TS);

  function kindAt(x, y) { return KIND[terrainAt(tileOf(x), tileOf(y))]; }
  function isWall(x, y) { return terrainAt(tileOf(x), tileOf(y)) === WALL; }
  function isLiquid(x, y) { return terrainAt(tileOf(x), tileOf(y)) === LIQUID; }
  function liquidKind() { return G.Tiles.BIOMES[biome].liquid; }

  /**
   * Efecto del charco actual sobre un Pokémon de estos tipos:
   *   { slow, dmg, every, color, slide }  (dmg en % de vida máxima)
   * Los de su tipo no sufren el suyo (Fuego en lava, Veneno en veneno...).
   */
  const LIQ = {
    water: { slow: 0.6, immune: ['water'] },     // los de tipo agua nadan sin frenarse
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

  /** ¿Se puede pasar por esta casilla andando? (pathing.js) */
  function walkable(tx, ty) {
    const t = terrainAt(tx, ty);
    if (t === WALL) return false;
    if (t === LIQUID && (LIQ[liquidKind()] || {}).dmg) return false;   // lava, veneno, descarga
    const p = propAtTile(tx, ty);
    return !(p && p.solid);
  }

  /** ¿Hay sitio para que algo de radio r esté aquí? */
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

  /** Objetos destructibles (incluida la hierba) que tocan un círculo. */
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

  /** Objetos interactivos (altares, manantiales, cofres con candado, trampas) cerca. */
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

  /** Roca o cofre más cercano (para apuntar cuando no hay enemigos). */
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
   * Empuja un círculo fuera de paredes y objetos sólidos (deslizando).
   * Devuelve true si ha chocado con algo.
   */
  function collide(e) {
    const r = e.r;
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      const t0x = tileOf(e.x - r), t1x = tileOf(e.x + r), t0y = tileOf(e.y - r), t1y = tileOf(e.y + r);
      for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) {
        if (terrainAt(tx, ty) === WALL) {
          // Punto más cercano de la caja del tile al centro del círculo.
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
            // Centro dentro de la caja: sal por el lado más cercano.
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

  /** ¿Choca un proyectil aquí? Devuelve 'wall', el prop sólido, o null. */
  function projectileBlock(x, y, r) {
    const tx = tileOf(x), ty = tileOf(y);
    if (terrainAt(tx, ty) === WALL) return 'wall';
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
      const p = propAtTile(tx + a, ty + b);
      if (p && p.solid && G.U.dist2(x, y, p.x, p.y) < (r + p.r) ** 2) return p;
    }
    return null;
  }

  // ---------------- daño a objetos ----------------

  function damageProp(p, amount, color = '#fff') {
    if (!p.destructible || p.hp <= 0) return false;
    p.hp -= amount;
    p.flash = 0.08;
    if (p.type !== 'grass') G.FX.spark(p.x, p.y - 10, color, 0, -1, 3);
    if (p.hp <= 0) { destroyProp(p); return true; }
    return false;
  }

  /** Rompe el objeto de esa casilla (llega por la red en cooperativo). */
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
      // Botín grande: monedas, tickets y experiencia para subir un nivel.
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

  // ---------------- dibujo ----------------

  function chunkImage(cx, cy, bi = biome, cache = images) {
    const k = cx + ',' + cy;
    let img = cache.get(k);
    if (img) return img;
    const at = (tx, ty) => KIND[terrainAt(tx, ty)];
    // Campo continuo de "tierra"; tiles.js lo muestrea en rejilla y lo
    // interpola por píxel para que las manchas tengan bordes orgánicos.
    const S = 6 * G.Tiles.T;
    const dirtField = (gx, gy) => fbm(gx / S, gy / S, seed + 303);
    img = G.Tiles.paintChunk(cx, cy, N, at, dirtField, bi, seed);
    if (cache.size > MAX_IMAGES) cache.delete(cache.keys().next().value);
    cache.set(k, img);
    return img;
  }

  /** 0..1 del fundido de bioma (suavizado), o null si no hay. */
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
      // +1 de solape: con escalas no enteras evita juntas entre chunks.
      if (k == null) { ctx.drawImage(chunkImage(cx, cy), cx * CW, cy * CW, CW + 1, CW + 1); continue; }
      // Fundido: el bioma viejo debajo y el nuevo apareciendo encima.
      ctx.drawImage(chunkImage(cx, cy, fade.from, fade.images), cx * CW, cy * CW, CW + 1, CW + 1);
      ctx.globalAlpha = k;
      ctx.drawImage(chunkImage(cx, cy), cx * CW, cy * CW, CW + 1, CW + 1);
      ctx.globalAlpha = 1;
    }
  }

  /** Brillos animados sobre el agua / burbujas de la lava (y del veneno y la electricidad). */
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

  /** Props visibles, para mezclarlos en el orden por Y con las entidades. */
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
      // Planos (manantial, trampa): pegados al suelo, centrados en su casilla.
      ctx.drawImage(img, Math.round(p.x - w / 2), Math.round(p.y - 8 - h / 2), w, h);
      if (p.type === 'spring' && p.charge >= 0.15 && Math.sin(t * 3 + p.wiggle) > 0.92) {
        G.FX.twinkle(p.x + G.U.rand(-20, 20), p.y - 8 + G.U.rand(-6, 6));
      }
      return;
    }
    if (p.type === 'altar' && !p.used) {
      // Halo del orbe, latiendo.
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
      // El objeto viejo se desvanece mientras aparece el nuevo.
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
   * @param i        bioma (G.Tiles.ARENA y siguientes son las arenas de la grieta)
   * @param instant  sin fundido (al empezar una run)
   * Una run cambia de bioma cada 4 min y recorre toda la lista; al acabarse,
   * vuelve a empezar. (Antes, pasado el último, hacia el minuto 84, se pedía
   * un bioma que no existe: pantalla negra, el juego roto y niveles sin fin.)
   */
  function setBiome(i, instant = false) {
    const n = G.Tiles.BIOMES.length;
    const b = ((i % n) + n) % n;
    if (b === biome) return;
    // El terreno es el mismo: sólo cambia la paleta, fundiéndose poco a poco.
    fade = instant ? null : { from: biome, images, t: 0 };
    biome = b;
    images = new Map();
  }

  function biomeName() { return G.Tiles.BIOMES[biome].name; }

  /** Viñeta en coordenadas de pantalla. */
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
    /** Arena de la grieta: { tx, ty, r } (en tiles) o null. */
    setArena(a) {
      arena = a;
      if (!a) return;
      a.th = G.Tiles.ARENA_THEMES[a.type] || G.Tiles.ARENA_THEMES.normal;
      // Olvida los chunks de esa zona (si se hubieran generado antes).
      const R = a.r + 9;
      for (const k of [...data.keys(), ...images.keys()]) {
        const [cx, cy] = k.split(',').map(Number);
        if (Math.abs(cx * N + N / 2 - a.tx) < R + N && Math.abs(cy * N + N / 2 - a.ty) < R + N) { data.delete(k); images.delete(k); }
      }
    },
    get arena() { return arena; }, drawGround, drawLiquid, visibleProps, drawProp, drawVignette,
    get biome() { return biome; }
  };
})();
