/* ============ camera.js — view and world<->screen transform ============
 * The visible width of the world is constant (VIEW_W) whatever the
 * window size, so the game feels the same on any screen.
 */
G.Camera = {
  x: 0, y: 0,
  scale: 1,
  VIEW_W: 768,              // 20% more view than at the start (640)
  shake: 0,
  _sx: 0, _sy: 0,

  /** Recalculates the scale for the canvas's current size. */
  dpr: 1,

  // On screens wider than 16:9 (phones in landscape) it also guarantees
  // a minimum world height, so you don't see a narrow strip.
  MIN_VIEW_H: 420,

  resize(cssW, cssH, dpr = 1) {
    this.dpr = dpr;
    this.scale = Math.min(cssW / this.VIEW_W, cssH / this.MIN_VIEW_H);
    this.w = cssW / this.scale;
    this.h = cssH / this.scale;
  },

  follow(tx, ty, dt) {
    this.x = G.U.damp(this.x, tx, 9, dt);
    this.y = G.U.damp(this.y, ty, 9, dt);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.4);
      const a = this.shake * 7;
      this._sx = G.U.rand(-a, a);
      this._sy = G.U.rand(-a, a);
    } else { this._sx = this._sy = 0; }
  },

  kick(amount) {
    if (G.Settings.get('calm')) amount *= 0.25;      // "less shake"
    this.shake = Math.min(1.2, this.shake + amount);
  },

  /** Applies the camera transform to the context. */
  apply(ctx) {
    // Rounds to physical screen pixels: without this, 1 px seams appear
    // between chunks and sprites "shimmer" when moving.
    const k = this.scale * this.dpr;
    ctx.translate(Math.round((-this.left() + this._sx) * k) / k,
                  Math.round((-this.top() + this._sy) * k) / k);
  },

  left() { return this.x - this.w / 2; },
  top() { return this.y - this.h / 2; },

  /** Is the point inside the view (with a margin)? */
  sees(x, y, pad = 60) {
    return x > this.left() - pad && x < this.left() + this.w + pad &&
           y > this.top() - pad && y < this.top() + this.h + pad;
  },

  /** Radius of the circle enclosing the view: used to spawn outside it. */
  outerRadius() { return Math.hypot(this.w, this.h) / 2 + 40; }
};
