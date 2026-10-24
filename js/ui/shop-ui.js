/* ============ shop-ui.js — the Shop: Klefki's Key Items and Sableye's Arceus Shop ============
 *
 * One menu tile, two stalls (24-10-2026). Both are drawn the way PokéSurvivor's Kecleon shop is: a small
 * pixel-art market stall on a canvas (scaled ×3, pixelated) with a striped awning, shelves of goods, two
 * lanterns and a counter. The first time each stall is opened in a session its shutter rattles and rolls up,
 * the goods pop onto the shelves, the lanterns light, the shopkeeper appears and hops, and the sign drops in.
 * Tap the stall (or turn on Calm in Settings) to skip it. After that the shopkeeper wanders, hops, spins and
 * chats in a speech bubble, walks over to whatever row you point at, and cheers when you buy something
 * (the item flies from the shelf into the list).
 *
 *   Key Items     Klefki (707). PokéCoins. data/keyitems.js G.KeyItems.
 *   Arceus Shop   shiny Sableye (302). Arceus Stars. Menu themes and player card themes (G.Themes).
 *
 * G.KeyItemUI: the Key Item slot under your partner on the main menu, and its picker.
 */

// ---- pixel icons for the key items and the shop (12×12, same style as ui/icons.js) ----
(() => {
  const FLUTE = ['.........kkk', '........kdsk', '.......kdddk', '......kdhdk.', '.....kdddk..', '....kdhdk...',
                 '...kdddk....', '..kdhdk.....', '.kdddk......', 'kddsk.......', 'kddk........', 'kkk.........'];
  const GEM = ['.....kk.....', '....kwwk....', '...kwccck...', '..kwccccck..', '.kwcccccbck.', 'kwcccccccbck',
               'kcccccccbbck', '.kcccccbbck.', '..kcccbbck..', '...kccbck...', '....kcck....', '.....kk.....'];
  Object.assign(G.Icons.UI, {
    'ki-herb': { pal: { g: '#4fb85a', G: '#9ff07a', b: '#8a5a2a' }, rows: [
      '....kk......', '...kGgk.kk..', '..kgGgkkGgk.', '..kgggkgggk.', '...kggkggk..', '.kk.kkgkk...',
      'kGgk..kk....', 'kgGgk.kgk...', '.kggkkgk....', '..kkkgk.....', '....kbk.....', '....kkk.....'] },
    'ki-black': { pal: { d: '#3a3a4a', s: '#8a8aa6', h: '#06060c' }, rows: FLUTE },
    'ki-white': { pal: { d: '#e8eef8', s: '#ffffff', h: '#6f7f9f' }, rows: FLUTE },
    'ki-pouch': { pal: { r: '#3fae5c', R: '#8fe0a0', g: '#ffd23f', y: '#ffd23f' }, rows: [
      '...kk..kk...', '....kkkk....', '....kyyk....', '...kkkkkk...', '..krrrrrrk..', '.krrRrrrrrk.',
      '.krrrrgrrrk.', 'krrrrgggrrrk', 'krrrrrgrrrrk', 'krrrrrrrrrrk', '.krrrrrrrrk.', '..kkkkkkkk..'] },
    'ki-iron': { pal: { g: '#8a94a8', w: '#e6ecf5', d: '#4c5468' }, rows: [
      '....kkkk....', '..kkwwggkk..', '.kwwggggggk.', '.kwgggggggk.', 'kwggggggggdk', 'kgggggggggdk',
      'kgggggggggdk', 'kggggggggddk', '.kggggggddk.', '.kgggggdddk.', '..kkddddkk..', '....kkkk....'] },
    'ki-glass': { pal: { w: '#ffffff', c: '#9fe8ff', b: '#4fb4e0' }, rows: GEM },
    'ki-tail': { pal: { p: '#ff9ab8', w: '#fff0f4' }, rows: [
      '..kkkk......', '.kppppk.....', 'kppkkppk....', 'kpk..kpk....', 'kpk..kpk....', '.k...kpk....',
      '.....kppk...', '......kppk..', '.......kppk.', '........kppk', '.........kwk', '..........k.'] },
    'ki-ring': { pal: { r: '#ff5f6d', w: '#ffffff' }, rows: [
      '....kkkk....', '..kkrrrrkk..', '.krrwwwwrrk.', '.krwwrrwwrk.', 'krwwrrrrwwrk', 'krwrrkkrrwrk',
      'krwrrkkrrwrk', 'krwwrrrrwwrk', '.krwwrrwwrk.', '.krrwwwwrrk.', '..kkrrrrkk..', '....kkkk....'] },
    'ki-star': { pal: { y: '#ffd76a', w: '#fff6d0' }, rows: [
      '.....kk.....', '....kyyk....', '....kyyk....', 'kkkkkyykkkkk', 'kyyyyyyyyyyk', '.kyyywwyyyk.',
      '..kyywwyyk..', '..kyyyyyyk..', '.kyyykkyyyk.', '.kyyk..kyyk.', 'kyyk....kyyk', 'kkk......kkk'] },
    'ki-key': { pal: { y: '#c9d6e6' }, rows: [
      '..kkkk......', '.kyyyyk.....', 'kyykkyyk....', 'kyk..kyk....', 'kyykkyyk....', '.kyyyyk.....',
      '..kyyk......', '..kyyk......', '..kyykkk....', '..kyyyyk....', '..kyykkk....', '..kkkk......'] },
    shop: { pal: { r: '#ff5f6d', w: '#ffffff', y: '#ffd23f', s: '#9ae6ff', b: '#b07a4a', B: '#8a5528' }, rows: [
      'kkkkkkkkkkkk', 'krwrwrwrwrwk', 'krwrwrwrwrwk', '.krkwkrkwkk.', '.k........k.', '.k.yy..ss.k.',
      '.k.yy..ss.k.', 'kkkkkkkkkkkk', 'kbbbbbbbbbbk', 'kbBbbbbbbBbk', 'kbbbbbbbbbbk', 'kkkkkkkkkkkk'] },
    'gem-p': { pal: { w: '#f4e6ff', c: '#b07bff', b: '#6a3fc0' }, rows: GEM },
    'gem-r': { pal: { w: '#ffe6ea', c: '#ff5f7a', b: '#b0283f' }, rows: GEM },
    'gem-g': { pal: { w: '#e6fff0', c: '#5fe08a', b: '#2a9a50' }, rows: GEM },
    palette: { pal: { w: '#e8d7b4', r: '#ff5f6d', b: '#4fb4ff', g: '#5fe08a', y: '#ffd23f' }, rows: [
      '...kkkkk....', '.kkwwwwwkk..', 'kwwrrwwwwwk.', 'kwwrrwwbbwwk', 'kwwwwwwbbwwk', 'kwggwwwwwwk.',
      'kwggwwwkkk..', 'kwwwwwk.....', 'kwyywwk.....', '.kyywwwk....', '..kwwwwwk...', '...kkkkk....'] },
    cardi: { pal: { b: '#5a3596', w: '#ffffff', p: '#ffd23f', r: '#5fe08a' }, rows: [
      '............', '............', 'kkkkkkkkkkkk', 'kbbbbbbbbbbk', 'kbkkkkbwwwbk', 'kbkppkbbbbbk',
      'kbkppkbrrrbk', 'kbkkkkbbbbbk', 'kbbbbbbbbbbk', 'kkkkkkkkkkkk', '............', '............'] }
  });
})();

// ======================= the stall scene =======================

G.Stall = class Stall {
  /**
   * @param host   the .shop-stall element (holds the canvas, sign and bubble)
   * @param o      { keeper: { dex, shiny }, look, goods: [icon names], lines: { greet, buy, idle, poor, wear }, special }
   */
  constructor(host, o) {
    this.host = host;
    this.o = o;
    this.cv = host.querySelector('canvas');
    this.ctx = this.cv.getContext('2d');
    this.sign = host.querySelector('.shop-sign');
    this.bubble = host.querySelector('.shop-bubble');
    this.W = 300; this.H = 98;
    this.k = new G.Sprites.Animator(o.keeper.dex, 0.5, !!o.keeper.shiny);
    this.k.loop('Idle');
    this.kp = { x: 150, y: 0, vy: 0, z: 0, tx: null, alpha: 0, think: 2, dir: 0, spin: 0, fade: 0 };
    this.parts = [];
    this.introT = 0; this.intro = false; this.opened = false;
    this.shutter = 1;            // 1 = closed, 0 = rolled up
    this.lit = [false, false];
    this.goodsShown = 0;
    this.slotPop = {};           // shelf slot -> time it popped back (sold)
    this.sold = {};              // shelf slot -> sold (empty) until this time
    this.bubbleT = 0;
    this.seed = 4242;
    this.cv.onclick = () => { if (this.intro) this.finishIntro(true); else this.poke(); };
    this.geo();
  }

  // ---------- sizing ----------
  resize() {
    const r = this.host.getBoundingClientRect();
    const W = Math.max(120, Math.floor(r.width / 3)), H = Math.max(60, Math.floor(r.height / 3));
    if (W !== this.W || H !== this.H || this.cv.width !== W) {
      this.W = W; this.H = H; this.cv.width = W; this.cv.height = H;
      this.ctx.imageSmoothingEnabled = false;
    }
    this.geo();
  }
  geo() {
    const W = this.W, H = this.H;
    const SW = Math.min(W - 8, 178), sx = Math.round((W - SW) / 2);
    const ground = H - 16;
    const roofY = H >= 90 ? 16 : 4, roofH = 15;
    this.g = { W, H, SW, sx, ground, roofY, roofH, wallTop: roofY + roofH, counter: ground - 17, floor: ground - 15 };   // feet just behind the counter's top: the shopkeeper shows above it
    if (this.kp.x < sx + 14 || this.kp.x > sx + SW - 14) this.kp.x = sx + SW * 0.62;
  }

  // ---------- the opening ----------
  open() {
    this.resize();
    const calm = G.Settings && G.Settings.get('calm');
    if (this.opened || calm) { this.finishIntro(false); return; }
    this.opened = true;
    this.intro = true; this.introT = 0; this.shutter = 1; this.lit = [false, false]; this.goodsShown = 0;
    this.kp.alpha = 0; this.kp.x = this.g.sx + this.g.SW * 0.62;
    this.host.classList.add('opening');
    this.sign.className = 'shop-sign';
    this.hideBubble();
    this.steps = [
      [300, () => { this.shake = 0.25; G.Audio.sfx('shake'); }],
      [650, () => { this.shake = 0.25; G.Audio.sfx('shake'); }],
      [950, () => { this.rolling = true; G.Audio.sfx('chest'); this.dust(); }],
      [1500, () => { this.popping = true; }],
      [1850, () => { this.lit[0] = true; G.Audio.sfx('select'); }],
      [2000, () => { this.lit[1] = true; G.Audio.sfx('select'); }],
      [2150, () => { this.kp.alpha = 1; this.sparkle(this.kp.x, this.g.floor - 14, 10); G.Audio.sfx('shiny'); }],
      [2550, () => { this.kp.spin = 0.8; }],
      [2950, () => { this.hop(95); this.k.play('Attack'); this.confetti(this.kp.x, this.g.counter - 8, 50); G.Audio.sfx('levelup'); this.sign.classList.add('show'); }],
      [3600, () => this.finishIntro(false)]
    ];
  }
  finishIntro(skipped) {
    this.intro = false; this.steps = null; this.rolling = false; this.popping = false;
    this.shutter = 0; this.lit = [true, true]; this.goodsShown = 999; this.kp.alpha = 1; this.kp.spin = 0;
    this.host.classList.remove('opening');
    this.sign.className = 'shop-sign shown lit';
    this.opened = true;
    if (skipped) this.sparkle(this.kp.x, this.g.floor - 14, 6);
    this.say(G.U.pick(this.o.lines.greet));
    this.kp.think = 2.5;
  }

  // ---------- shopkeeper ----------
  hop(v) { if (this.kp.z <= 0.01) this.kp.vy = v; }
  poke() { this.hop(85); this.k.play('Attack'); this.sparkle(this.kp.x, this.g.floor - 16, 4); if (Math.random() < 0.5) this.say(G.U.pick(this.o.lines.idle)); }
  /** Walk to the shelf slot for list row i (of n), face it and point. */
  pointAt(i, n) {
    if (this.intro) return;
    const g = this.g, x = g.sx + 14 + (g.SW - 28) * (n > 1 ? i / (n - 1) : 0.5);
    this.kp.tx = x; this.kp.after = 'point'; this.kp.think = 3.5;
  }
  /** Something was bought: cheer, confetti, and the item's icon flies from its shelf slot to `toEl`. */
  bought(icon, toEl, slot) {
    this.hop(85); this.kp.spin = 0.6; this.k.play('Attack');
    const g = this.g, pos = slot != null ? this.slotPos(slot) : [this.kp.x, g.counter - 6];
    this.confetti(pos[0], pos[1], 24);
    this.say(G.U.pick(this.o.lines.buy));
    if (slot != null) { this.sold[slot] = performance.now() + 1400; }
    if (toEl) this.fly(icon, pos, toEl);
    G.Audio.sfx('buy');
  }
  poor() { this.say(G.U.pick(this.o.lines.poor)); G.Audio.sfx('error'); this.k.play('Hurt'); }

  say(text) {
    if (!text) return;
    const b = this.bubble;
    b.textContent = text;
    b.classList.remove('hide', 'pop');
    void b.offsetWidth;
    b.classList.add('pop');
    this.bubbleT = 6;
    this.placeBubble();
  }
  hideBubble() { this.bubble.classList.add('hide'); this.bubbleT = 0; }
  placeBubble() {
    const b = this.bubble, hw = this.host.clientWidth;
    const bw = b.offsetWidth, bh = b.offsetHeight;
    const kx = this.kp.x * 3, ky = (this.g.floor - this.kp.z - 26) * 3;
    // Left of the shopkeeper (tail pointing at it); on the right side if there's no room.
    let left = kx - bw - 22, flip = false;
    if (left < 6) { left = kx + 22; flip = true; }
    left = Math.max(6, Math.min(hw - bw - 6, left));
    b.classList.toggle('flip', flip);
    b.style.left = left + 'px';
    b.style.top = Math.max(4, ky - bh / 2) + 'px';
  }

  think() {
    const K = this.kp, g = this.g, r = Math.random();
    K.think = G.U.rand(1.6, 4.4);
    const lo = g.sx + 14, hi = g.sx + g.SW - 14;
    if (r < 0.34) { K.tx = G.U.rand(lo, hi); K.after = null; }
    else if (r < 0.5) { this.hop(70); }
    else if (r < 0.64) { K.dir = 0; this.k.loop('Idle'); }
    else if (r < 0.74) { K.spin = 0.8; }
    else if (r < 0.84) { K.fade = 1.3; }                          // Klefki jingles / Sableye melts into the dark
    else { this.k.play('Attack'); }
    if (Math.random() < 0.18) this.say(G.U.pick(this.o.lines.idle));
  }

  // ---------- particles ----------
  dust() { const g = this.g; for (let i = 0; i < 16; i++) this.parts.push({ x: g.sx + G.U.rand(6, g.SW - 6), y: g.counter - 2, vx: G.U.rand(-14, 14), vy: G.U.rand(-18, -4), life: G.U.rand(0.5, 0.9), col: '#d8c8a8', g: 10 }); }
  confetti(x, y, n) {
    const C = ['#ff5f6d', '#ffd23f', '#5fe08a', '#4fb4ff', '#c47bff', '#ffffff'];
    for (let i = 0; i < n; i++) this.parts.push({ x, y, vx: G.U.rand(-60, 60), vy: G.U.rand(-90, -30), life: G.U.rand(0.8, 1.5), col: G.U.pick(C), g: 140, sq: 1 });
  }
  sparkle(x, y, n) { for (let i = 0; i < n; i++) this.parts.push({ x: x + G.U.rand(-10, 10), y: y + G.U.rand(-10, 8), vx: 0, vy: -6, life: G.U.rand(0.4, 0.8), col: '#fff6c0', g: 0, star: 1 }); }

  // ---------- update + draw ----------
  update(dt) {
    if (this.intro) {
      this.introT += dt * 1000;
      while (this.steps && this.steps.length && this.introT >= this.steps[0][0]) this.steps.shift()[1]();
      if (this.rolling) this.shutter = Math.max(0, this.shutter - dt * 1.6);
      if (this.popping) this.goodsShown += dt / 0.05;
    }
    if (this.shake > 0) this.shake -= dt;
    const K = this.kp;
    if (!this.intro) {
      if ((K.think -= dt) <= 0 && K.tx == null) this.think();
      if (this.bubbleT > 0 && (this.bubbleT -= dt) <= 0) this.hideBubble();
    }
    // walking
    if (K.tx != null) {
      const d = K.tx - K.x, step = 55 * dt;
      if (Math.abs(d) <= step) {
        K.x = K.tx; K.tx = null; K.dir = 0; this.k.loop('Idle');
        if (K.after === 'point') { this.k.play('Attack'); K.after = null; }
      } else { K.x += Math.sign(d) * step; K.dir = d > 0 ? 2 : 6; this.k.loop('Walk', 1.3); }
    }
    // hopping
    if (K.vy || K.z > 0) { K.z += K.vy * dt; K.vy -= 380 * dt; if (K.z <= 0) { K.z = 0; K.vy = 0; } }
    if (K.spin > 0) { K.spin -= dt; K.spinAcc = (K.spinAcc || 0) + dt; if (K.spinAcc > 0.1) { K.spinAcc = 0; K.dir = (K.dir + 1) % 8; } if (K.spin <= 0) K.dir = 0; }
    if (K.fade > 0) { K.fade -= dt; if (K.fade <= 0) this.sparkle(K.x, this.g.floor - 14, 5); }
    this.k.dir = K.dir;
    this.k.update(dt);
    for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; }
    this.parts = this.parts.filter(p => p.life > 0);
    if (this.bubbleT > 0) this.placeBubble();
  }

  slotPos(i) {
    const g = this.g, per = Math.max(1, Math.floor((g.SW - 24) / 14));
    const row = Math.floor(i / per) % 2, col = i % per;
    const x0 = g.sx + 12 + ((g.SW - 24) - per * 14) / 2;
    return [Math.round(x0 + col * 14 + 7), row === 0 ? g.wallTop + 13 : g.wallTop + 27];
  }

  draw() {
    const c = this.ctx, g = this.g, L = this.o.look, t = performance.now() / 1000;
    const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    c.setTransform(1, 0, 0, 1, 0, 0);
    // sky
    const bands = L.sky.length;
    for (let i = 0; i < bands; i++) R(0, Math.floor(g.ground * i / bands), g.W, Math.ceil(g.ground / bands) + 1, L.sky[i]);
    if (L.stars) for (let i = 0; i < 26; i++) {
      const sx = (i * 97.3 + 11) % g.W, sy = (i * 37.9 + 5) % (g.ground * 0.6);
      if (Math.sin(t * 2 + i) > -0.3) R(sx, sy, 1, 1, i % 5 ? '#d8d0ff' : '#ffffff');
    }
    // sun / moon
    const mx = g.W * 0.86, my = 12;
    c.fillStyle = L.orb[0]; c.beginPath(); c.arc(mx, my, 5, 0, 6.2832); c.fill();
    c.fillStyle = L.orb[1]; c.beginPath(); c.arc(mx - (L.stars ? 2 : 0), my - (L.stars ? 1 : 0), 4, 0, 6.2832); c.fill();
    // clouds
    if (!L.stars) for (let i = 0; i < 4; i++) {
      const w = 10 + (i * 3) % 10, x = ((i * 83 + t * (1.5 + i * 0.6)) % (g.W + 30)) - 20, y = 6 + i * 6;
      R(x, y, w, 3, '#ffffff'); R(x + 2, y - 2, w - 5, 2, '#ffffff');
    }
    // hills and trees
    for (let x = 0; x < g.W; x++) {
      const h = 10 + Math.sin(x * 0.045 + 1.3) * 5 + Math.sin(x * 0.11) * 2;
      R(x, g.ground - h, 1, h, L.hill);
    }
    for (let i = 0; i < 9; i++) {
      const x = (i * 47.7 + 9) % g.W;
      if (x > g.sx - 6 && x < g.sx + g.SW + 6) continue;
      R(x + 3, g.ground - 9, 2, 6, L.trunk);
      R(x, g.ground - 17, 8, 8, L.leaf[0]); R(x + 1, g.ground - 20, 6, 4, L.leaf[1]); R(x + 2, g.ground - 19, 2, 2, L.leaf[2]);
    }
    // ground
    R(0, g.ground, g.W, g.H - g.ground, L.grass);
    R(0, g.ground + 5, g.W, g.H - g.ground - 5, L.path);
    R(0, g.ground + 5, g.W, 1, L.pathEdge);
    for (let i = 0; i < 18; i++) { const x = (i * 61.3) % g.W; R(x, g.ground + 8 + (i % 3) * 2, 1, 1, L.pathEdge); }
    R(g.sx - 2, g.ground, g.SW + 4, 2, 'rgba(0,0,0,.25)');

    // ---- back wall and shelves ----
    const wy = g.wallTop;
    R(g.sx + 2, wy, g.SW - 4, g.ground - wy, L.wall);
    for (let x = g.sx + 8; x < g.sx + g.SW - 4; x += 9) R(x, wy, 1, g.ground - wy, L.seam);
    R(g.sx + 2, wy, g.SW - 4, 2, L.valance);
    for (const sy of [wy + 13, wy + 27]) { R(g.sx + 6, sy, g.SW - 12, 2, L.shelf[0]); R(g.sx + 6, sy, g.SW - 12, 1, L.shelf[1]); R(g.sx + 6, sy + 2, g.SW - 12, 1, L.shelf[2]); }
    const goods = this.o.goods, per = Math.max(1, Math.floor((g.SW - 24) / 14)), now = performance.now();
    const slots = Math.min(per * 2, Math.floor(this.goodsShown));
    for (let i = 0; i < slots; i++) {
      if (this.sold[i] && now < this.sold[i]) continue;
      if (this.sold[i]) { delete this.sold[i]; this.slotPop[i] = now; this.sparkle(...this.slotPos(i), 3); }
      const [x, y] = this.slotPos(i);
      const pop = this.slotPop[i] ? Math.min(1, (now - this.slotPop[i]) / 250) : 1;
      const s = Math.round(12 * (pop < 1 ? 0.5 + pop * 0.5 : 1));
      G.Icons.draw(c, goods[i % goods.length], x - s / 2, y - s, s);
    }

    // ---- shopkeeper (behind the counter) ----
    const K = this.kp;
    if (K.alpha > 0) {
      const fa = K.fade > 0 ? 0.15 + 0.85 * Math.abs(Math.cos(K.fade * 4)) : 1;
      c.fillStyle = 'rgba(0,0,0,.28)';
      c.beginPath(); c.ellipse(K.x, g.floor, Math.max(3, 8 - K.z * 0.15), 2, 0, 0, 6.2832); c.fill();
      this.k.draw(c, Math.round(K.x), Math.round(g.floor - K.z), { alpha: K.alpha * fa });
    }

    // ---- shutter ----
    if (this.shutter > 0) {
      const top = wy, full = g.counter - wy, h = Math.round(full * this.shutter);
      const sh = this.shake > 0 ? Math.round(Math.sin(t * 90) * 1.5) : 0;
      for (let y = top; y < top + h; y += 3) R(g.sx + 3 + sh, y, g.SW - 6, 3, ((y - top) / 3) % 2 ? L.shut[0] : L.shut[1]);
      for (let y = top + 2; y < top + h; y += 3) R(g.sx + 3 + sh, y, g.SW - 6, 1, L.shut[2]);
      R(g.sx + 3 + sh, top + h - 1, g.SW - 6, 1, L.shut[2]);
    }

    // ---- counter ----
    const cy = g.counter;
    R(g.sx + 3, cy, g.SW - 6, g.ground - cy, L.counter[0]);
    R(g.sx + 3, cy, g.SW - 6, 2, L.counter[1]);
    for (let y = cy + 5; y < g.ground; y += 4) R(g.sx + 6, y, g.SW - 12, 1, L.counter[2]);
    G.Icons.draw(c, L.till, g.sx + g.SW - 24, cy - 8, 8);
    G.Icons.draw(c, L.till, g.sx + g.SW - 17, cy - 7, 7);

    // ---- posts, awning, lanterns ----
    R(g.sx + 1, g.roofY + g.roofH, 3, g.ground - g.roofY - g.roofH, L.post[0]); R(g.sx + 1, g.roofY + g.roofH, 1, g.ground - g.roofY - g.roofH, L.post[1]);
    R(g.sx + g.SW - 4, g.roofY + g.roofH, 3, g.ground - g.roofY - g.roofH, L.post[0]); R(g.sx + g.SW - 4, g.roofY + g.roofH, 1, g.ground - g.roofY - g.roofH, L.post[1]);
    for (let x = g.sx, i = 0; x < g.sx + g.SW; x += 8, i++) {
      const w = Math.min(8, g.sx + g.SW - x), col = i % 2 ? L.awn[1] : L.awn[0];
      R(x, g.roofY + 3, w, g.roofH - 3, col);
      // scallops
      c.fillStyle = i % 2 ? L.awn[3] : L.awn[2];
      c.beginPath(); c.arc(x + w / 2, g.roofY + g.roofH, w / 2, 0, Math.PI); c.fill();
      R(x, g.roofY + g.roofH - 1, w, 1, col);
    }
    R(g.sx - 2, g.roofY, g.SW + 4, 3, L.awnTop[0]); R(g.sx - 2, g.roofY, g.SW + 4, 1, L.awnTop[1]);
    for (const [i, lx] of [[0, g.sx + 10], [1, g.sx + g.SW - 14]]) {
      const sw = Math.round(Math.sin(t * 2 + i) * 1), ly = g.roofY + g.roofH + 4;
      R(lx + 2 + sw * 0.5, ly - 3, 1, 3, '#2a1a10');
      if (this.lit[i]) {
        const gr = c.createRadialGradient(lx + 3 + sw, ly + 3, 1, lx + 3 + sw, ly + 3, 34 + Math.sin(t * 3 + i) * 3);
        gr.addColorStop(0, L.glow); gr.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = gr; c.fillRect(lx - 34, ly - 34, 74, 74);
      }
      R(lx + sw, ly, 6, 7, this.lit[i] ? L.lamp[0] : L.lampOff[0]);
      R(lx + 1 + sw, ly + 1, 4, 5, this.lit[i] ? L.lamp[1] : L.lampOff[1]);
      R(lx + sw, ly, 6, 1, '#2a1a10'); R(lx + sw, ly + 6, 6, 1, '#2a1a10');
    }

    // ---- particles ----
    for (const p of this.parts) {
      c.globalAlpha = Math.min(1, p.life * 2);
      if (p.star) { R(p.x, p.y - 1, 1, 3, p.col); R(p.x - 1, p.y, 3, 1, p.col); }
      else R(p.x, p.y, p.sq ? 2 : 1, p.sq ? 2 : 1, p.col);
    }
    c.globalAlpha = 1;
  }

  /** The purchased item's icon arcs from its shelf slot into the list row's icon. */
  fly(icon, pos, toEl) {
    const r = this.cv.getBoundingClientRect(), sx = r.left + pos[0] * (r.width / this.W), sy = r.top + (pos[1] - 6) * (r.height / this.H);
    const tr = toEl.getBoundingClientRect(), tx = tr.left + tr.width / 2, ty = tr.top + tr.height / 2;
    const el = document.createElement('div');
    el.className = 'shop-fly';
    el.innerHTML = G.Icons.html(icon, 32);
    document.body.appendChild(el);
    const mx = (sx + tx) / 2, my = Math.min(sy, ty) - 70;
    const kf = [
      { transform: `translate(${sx - 16}px,${sy - 16}px) scale(.5) rotate(-10deg)`, opacity: 0 },
      { transform: `translate(${sx - 16}px,${sy - 46}px) scale(1.3) rotate(-10deg)`, opacity: 1, offset: 0.25 },
      { transform: `translate(${mx - 16}px,${my - 16}px) scale(1.2) rotate(8deg)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${tx - 16}px,${ty - 16}px) scale(.7) rotate(0deg)`, opacity: 1 }
    ];
    const a = el.animate ? el.animate(kf, { duration: 950, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' }) : null;
    const done = () => { el.remove(); toEl.classList.remove('bump'); void toEl.offsetWidth; toEl.classList.add('bump'); };
    if (a) a.onfinish = done; else setTimeout(done, 950);
  }
};

// ======================= the Shop screen =======================

G.ShopUI = (() => {
  const $ = G.UI.$;
  let tab = 'keys';            // 'keys' (Klefki) | 'arceus' (Sableye)
  let raf = 0, lastT = 0, stall = null;
  const stalls = {};

  const LOOKS = {
    keys: {
      sky: ['#6fb8f0', '#7fc2f3', '#90ccf6', '#a3d7f9', '#b4e0fc', '#c4e8ff'], orb: ['#fff4b0', '#ffe066'],
      hill: '#6fae76', trunk: '#5a3a24', leaf: ['#2f7a45', '#3f9a55', '#6fc47a'], grass: '#4f9a4a', path: '#c9a46a', pathEdge: '#8f6a3a',
      wall: '#4a3e52', seam: '#3a3042', valance: '#ff7fb2', shelf: ['#8a92a6', '#c9d2e2', '#2a2a34'],
      awn: ['#ff8fbf', '#eef2f8', '#d9619b', '#c3c9d6'], awnTop: ['#8a92a6', '#e6ecf5'], post: ['#7c8496', '#c9d2e2'],
      counter: ['#9aa3b8', '#d6deec', '#6f7890'], shut: ['#a7afc2', '#8f97ab', '#5c6478'],
      lamp: ['#ff7fb2', '#ffd6ea'], lampOff: ['#7a4a5e', '#4a2a3a'], glow: 'rgba(255,170,210,.42)', till: 'coin'
    },
    arceus: {
      sky: ['#140c2e', '#1c1240', '#251852', '#2f1f62', '#3a2672', '#462e80'], orb: ['#f4f0ff', '#140c2e'], stars: true,
      hill: '#2a1a4a', trunk: '#1a1030', leaf: ['#33205e', '#43307a', '#7a5ac0'], grass: '#2c2250', path: '#4a3a6e', pathEdge: '#2a1e48',
      wall: '#241a3a', seam: '#1a1230', valance: '#7a3fd0', shelf: ['#5a3f7a', '#9a7ac8', '#120a20'],
      awn: ['#5a2a96', '#2a1a4a', '#3e1a6e', '#1a1030'], awnTop: ['#ffd23f', '#fff3b0'], post: ['#3a2a5a', '#6a5a8a'],
      counter: ['#3a2a5a', '#7a5ac0', '#241a3a'], shut: ['#4a3a6e', '#3a2a5a', '#1e1434'],
      lamp: ['#7fffd0', '#e6fff6'], lampOff: ['#2a4a42', '#1a2a26'], glow: 'rgba(120,255,210,.35)', till: 'star'
    }
  };

  const OPTS = {
    keys: {
      keeper: { dex: 707, shiny: false }, look: LOOKS.keys, sign: "Klefki's Key Items",
      goods: ['ki-herb', 'ki-black', 'ki-white', 'ki-pouch', 'ki-iron', 'ki-glass', 'ki-tail', 'ki-ring', 'ki-star', 'ki-key'],
      lines: {
        greet: ['Jingle jingle! Welcome to Klefki\'s Key Items!', 'Clink! Keys for every kind of trainer!'],
        buy: ['Clink! It\'s yours!', 'A fine key for a fine trainer!', 'Jingle! Put it in your slot!'],
        idle: ['One Key Item per run, choose well!', 'Jingle jingle…', 'Pick yours under your partner, on the menu!', 'They\'re yours to keep, forever!'],
        poor: ['Not enough PokéCoins… jingle…', 'Come back with more coins!'],
        wear: ['Good pick! It\'s in your slot.', 'Clink! Ready for your next run!']
      }
    },
    arceus: {
      keeper: { dex: 302, shiny: true }, look: LOOKS.arceus, sign: "Sableye's Arceus Shop",
      goods: ['gem-p', 'palette', 'gem-g', 'cardi', 'star', 'gem-r', 'palette', 'gem-p', 'cardi', 'gem-g'],
      lines: {
        greet: ['Sa-ble! Welcome to the Arceus Shop!', 'Kehehe… shiny stars for shiny things!'],
        buy: ['Kehehe! Wear it well!', 'Ooh, sparkly choice!', 'Sa-ble! Looking shiny!'],
        idle: ['Reach Arceus in a run to earn a Star!', 'Gems… stars… all so shiny…', 'Kehehe…'],
        poor: ['You need more Arceus Stars… kehehe.', 'No Stars, no sparkles!'],
        wear: ['Kehehe, a new look!', 'Sa-ble! Very stylish!']
      }
    }
  };

  function init() {
    document.querySelectorAll('#shop-tabs [data-tab]').forEach(b => {
      b.onclick = () => { if (tab !== b.dataset.tab) { tab = b.dataset.tab; render(); } };
    });
    $('shop-tabs').querySelector('[data-tab=keys]').insertAdjacentHTML('afterbegin', G.Icons.html('ki-key', 22));
    $('shop-tabs').querySelector('[data-tab=arceus]').insertAdjacentHTML('afterbegin', G.Icons.html('star', 22));
    window.addEventListener('resize', () => { if (stall && G.UI.isOpen('scr-shop')) stall.resize(); });
  }

  function open(which) {
    if (which) tab = which;
    G.UI.show('scr-shop', true);
    render();
    if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(loop); }
  }

  function loop(now) {
    raf = 0;
    if (!G.UI.isOpen('scr-shop')) return;
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    if (stall) { stall.update(dt); stall.draw(); }
    for (const cv of document.querySelectorAll('#shop-body canvas.card-pv')) G.HUD.cardPreview(cv, cv.dataset.id, cv.dataset.dex, cv.dataset.sh === '1', cv.dataset.nm);
    raf = requestAnimationFrame(loop);
  }

  function render() {
    document.querySelectorAll('#shop-tabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const host = $('shop-stall');
    host.dataset.shop = tab;
    $('shop-sign').textContent = OPTS[tab].sign;
    if (!stalls[tab]) stalls[tab] = new G.Stall(host, OPTS[tab]);
    if (stall !== stalls[tab]) { stall = stalls[tab]; stall.k.loop('Idle'); requestAnimationFrame(() => stall.open()); }
    $('shop-wallet').innerHTML = tab === 'keys'
      ? `<span class="coin"></span> <b>${G.DB.save.coins.toLocaleString('en')}</b> PokéCoins`
      : `${G.Icons.html('star', 18)} <b>${G.DB.stars()}</b> Arceus ${G.DB.stars() === 1 ? 'Star' : 'Stars'}`;
    if (tab === 'keys') renderKeys(); else renderArceus();
  }

  // ---------------- Klefki: Key Items ----------------

  function renderKeys() {
    const s = G.DB.save, box = $('shop-body');
    $('shop-sub').innerHTML = 'Key Items are bought once and kept forever. Take <b>one</b> into each run: pick it under your partner on the main menu. It\'s passive and lasts the whole run, separate from held items.';
    box.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'shop-list';
    const eq = G.KeyItems.equipped();
    G.KeyItems.LIST.forEach((k, i) => {
      const own = G.KeyItems.owns(k.id), on = eq === k.id;
      const el = document.createElement('div');
      el.className = 'panel shop-row' + (own ? ' owned' : '') + (on ? ' on' : '');
      el.innerHTML = `
        <div class="ic">${G.Icons.html(k.icon, 32)}</div>
        <div class="txt">
          <b>${k.name}</b> <span class="ki-tag t-${k.tag.toLowerCase().replace(/[^a-z]/g, '')}">${k.tag}</span>${on ? ' <span class="have">In your slot</span>' : own ? ' <span class="have">Owned</span>' : ''}
          <div class="ds">${k.desc}</div>
          <div class="ki-lines">${k.lines.map(l => `<span>${l}</span>`).join('')}</div>
          ${k.note ? `<div class="ki-note">${k.note}</div>` : ''}
        </div>
        <div class="buy"></div>`;
      const b = document.createElement('button');
      if (!own) {
        b.className = 'btn small gold'; b.dataset.sfx = 'none';
        b.innerHTML = `<span class="coin"></span> ${k.price.toLocaleString('en')}`;
        b.disabled = s.coins < k.price;
        b.onclick = () => {
          const err = G.KeyItems.buy(k.id);
          if (err) { stall.poor(); G.UI.toast(err); return; }
          G.UI.refreshCoins();
          G.UI.toast(k.name + ' is yours!' + (G.KeyItems.equipped() === k.id ? ' It\'s in your Key Item slot.' : ''));
          const slot = OPTS.keys.goods.indexOf(k.icon);
          render();
          const icEl = box.querySelectorAll('.shop-row .ic')[i];
          stall.bought(k.icon, icEl, slot >= 0 ? slot : null);
        };
      } else {
        b.className = 'btn small' + (on ? ' ghost' : '');
        b.dataset.sfx = 'confirm';
        b.textContent = on ? 'Take off' : 'Take it';
        b.onclick = () => {
          G.KeyItems.equip(on ? '' : k.id);
          if (!on) stall.say(G.U.pick(OPTS.keys.lines.wear));
          render();
        };
      }
      el.querySelector('.buy').appendChild(b);
      el.onmouseenter = () => stall && stall.pointAt(OPTS.keys.goods.indexOf(k.icon), OPTS.keys.goods.length);
      list.appendChild(el);
    });
    box.appendChild(list);
  }

  // ---------------- Sableye: Arceus Shop ----------------

  function renderArceus() {
    const s = G.DB.save, box = $('shop-body'), stars = G.DB.stars();
    $('shop-sub').innerHTML = 'Spend Arceus Stars on looks: you earn one every time a run reaches Arceus. Themes are kept forever and you can switch between the ones you own at any time.';
    box.innerHTML = '';
    const mon = G.DEX_BY[s.partner] || G.DEX[0], shiny = !!s.partnerShiny && G.DB.ownsShiny(mon.dex);

    const h1 = document.createElement('h3');
    h1.className = 'shop-h';
    h1.innerHTML = G.Icons.html('palette', 18) + ' Menu themes <small>Recolour the menu boxes, tiles and top bar</small>';
    box.appendChild(h1);
    const g1 = document.createElement('div');
    g1.className = 'theme-grid';
    G.Themes.MENU.forEach((th, i) => {
      const own = G.Themes.owns('m', th.id), on = G.Themes.menuId() === th.id, v = th.vars;
      const el = document.createElement('div');
      el.className = 'panel theme-card' + (on ? ' on' : '') + (th.premium ? ' premium' : '');
      el.innerHTML = `
        <div class="mt-pv ic" style="background:linear-gradient(180deg, ${v.box1}, ${v.box2});box-shadow:inset 0 0 0 2px ${v.edgeIn}">
          <i style="background:${v.tile};border-color:${v.accent}"></i><i style="background:${v.tile}"></i><i style="background:${v.tile}"></i>
          <span class="mt-pill" style="background:${v.pill}"></span>
        </div>
        <b>${th.name}</b>${th.premium ? ' <span class="ki-tag t-premium">Premium</span>' : ''}
        <div class="buy"></div>`;
      el.querySelector('.buy').appendChild(themeButton('m', th, own, on, stars, el, i));
      el.onmouseenter = () => stall && stall.pointAt(i, G.Themes.MENU.length);
      g1.appendChild(el);
    });
    box.appendChild(g1);

    const h2 = document.createElement('h3');
    h2.className = 'shop-h';
    h2.innerHTML = G.Icons.html('cardi', 18) + ' Player card themes <small>Your card in runs (top left). Teammates see it too.</small>';
    box.appendChild(h2);
    const g2 = document.createElement('div');
    g2.className = 'theme-grid cards';
    G.Themes.CARD.forEach((th, i) => {
      const own = G.Themes.owns('c', th.id), on = G.Themes.cardId() === th.id;
      const el = document.createElement('div');
      el.className = 'panel theme-card' + (on ? ' on' : '') + (th.premium ? ' premium' : '');
      el.innerHTML = `
        <canvas class="card-pv ic" width="330" height="54" data-id="${th.id}" data-dex="${mon.dex}" data-sh="${shiny ? 1 : 0}" data-nm="${mon.name}"></canvas>
        <b>${th.name}</b>${th.premium ? ' <span class="ki-tag t-premium">Premium</span>' : ''}
        <div class="buy"></div>`;
      el.querySelector('.buy').appendChild(themeButton('c', th, own, on, stars, el, i));
      el.onmouseenter = () => stall && stall.pointAt(i, G.Themes.CARD.length);
      g2.appendChild(el);
    });
    box.appendChild(g2);
  }

  function themeButton(kind, th, own, on, stars, el, i) {
    const b = document.createElement('button');
    if (!own) {
      b.className = 'btn small gold'; b.dataset.sfx = 'none';
      b.innerHTML = `${G.Icons.html('star', 14)} ${th.price}`;
      b.disabled = stars < th.price;
      b.onclick = () => {
        const err = G.Themes.buy(kind, th.id);
        if (err) { stall.poor(); G.UI.toast(err); return; }
        G.UI.refreshCoins();
        G.UI.toast(th.name + (kind === 'm' ? ' menu theme' : ' card theme') + ' is yours, and you\'re wearing it!');
        render();
        const icEl = $('shop-body').querySelectorAll(kind === 'm' ? '.theme-grid:not(.cards) .ic' : '.theme-grid.cards .ic')[i];
        stall.bought(kind === 'm' ? 'palette' : 'cardi', icEl, kind === 'm' ? 1 : 3);
      };
    } else {
      b.className = 'btn small' + (on ? ' ghost' : '');
      b.dataset.sfx = 'confirm';
      b.textContent = on ? 'Wearing' : 'Wear';
      b.disabled = on;
      b.onclick = () => { G.Themes.wear(kind, th.id); stall.say(G.U.pick(OPTS.arceus.lines.wear)); render(); };
    }
    return b;
  }

  return { init, open, render, get tab() { return tab; } };
})();

// ======================= the Key Item slot on the main menu =======================

G.KeyItemUI = (() => {
  const $ = G.UI.$;

  function init() {
    $('menu-keyitem').onclick = openPicker;
    $('kip-close').onclick = () => G.UI.hide('scr-kipick');
    $('kip-shop').onclick = () => { G.UI.hide('scr-kipick'); G.ShopUI.open('keys'); };
  }

  /** The slot under your partner: the Key Item you'll take into your next run. */
  function renderSlot() {
    const id = G.KeyItems.equipped(), k = G.KeyItems.BY[id], n = G.KeyItems.count;
    const el = $('menu-keyitem');
    el.classList.toggle('empty', !k);
    el.innerHTML = k
      ? `<span class="ki-ic">${G.Icons.html(k.icon, 26)}</span><span class="ki-t"><small>Key Item</small><b>${k.name}</b></span>`
      : `<span class="ki-ic">${G.Icons.html('ki-key', 26)}</span><span class="ki-t"><small>Key Item</small><b>${n ? 'None' : 'Get one in the Shop'}</b></span>`;
    el.title = k ? k.name + ': ' + k.desc + ' (click to change)' : 'Choose a Key Item to take into your runs';
  }

  function openPicker() {
    if (!G.KeyItems.count) { G.ShopUI.open('keys'); return; }
    const box = $('kip-list'), eq = G.KeyItems.equipped();
    box.innerHTML = '';
    const add = (k) => {
      const el = document.createElement('button');
      el.className = 'panel kip-row' + ((k ? k.id : '') === eq ? ' on' : '');
      el.dataset.sfx = 'confirm';
      el.innerHTML = k
        ? `<span class="ic">${G.Icons.html(k.icon, 30)}</span><span class="txt"><b>${k.name}</b><small>${k.lines.join(' · ')}</small></span>`
        : `<span class="ic">${G.Icons.html('ban', 30)}</span><span class="txt"><b>None</b><small>Run without a Key Item</small></span>`;
      el.onclick = () => {
        G.KeyItems.equip(k ? k.id : '');
        G.UI.hide('scr-kipick');
        renderSlot();
        G.UI.toast(k ? k.name + ' is in your Key Item slot' : 'No Key Item for your next run');
      };
      box.appendChild(el);
    };
    add(null);
    for (const k of G.KeyItems.LIST) if (G.KeyItems.owns(k.id)) add(k);
    $('kip-shop').classList.toggle('hidden', G.KeyItems.count >= G.KeyItems.LIST.length);
    G.UI.show('scr-kipick', true);
  }

  return { init, renderSlot, openPicker };
})();
