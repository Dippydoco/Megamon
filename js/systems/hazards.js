/* ============ hazards.js — enemies' warned attacks ============
 * A hazard is first drawn on the ground as a WARNING (it fills up) and, when
 * the time is up, it hits whoever is inside:
 *
 *   zone  circle (Ground/Fire/Poison zones, explosions, leap landings)
 *   beam  straight beam from the enemy (Electric, Psychic, Dragon, Ice)
 *
 * Each computer draws the hazards and checks only ITS Pokémon. In
 * co-op the host creates them and sends them with 'hz'.
 *
 * Bosses' hazards carry their owner (`own`, the enemy id). If the boss dies before they go off, they fade
 * away harmlessly (cancelOwner, called from Enemy.die on every computer). Other enemies' warnings still go off.
 *
 * Arceus's ones (systems/judgment.js) take a % of health (pct) regardless of
 * types or defence (pure), and the Judgment falls as a pillar of light (vis).
 *
 * Status pools (23-11-2026, bosses' 'pool' attack): a zone with `st` (a status, systems/status.js) and `lin`
 * (seconds it stays on the ground after it lands). Landing hits like a zone and leaves the status; after that,
 * standing in the pool gives it to you. A boss's pools fade away when it falls.
 */
G.Hazards = (() => {
  let list = [];

  const FADE = 0.25;          // seconds a cancelled warning takes to fade out

  /** h: { kind, x, y, r | angle, len, w, delay, dmg, type, color, pct?, pure?, vis?, own?, st?, lin? } */
  function add(h, fromNet = false) {
    const o = Object.assign({ t: 0, hit: false, end: 0.3 }, h);
    if (o.lin) o.end = o.lin;
    list.push(o);
    if (!fromNet && G.Coop.isHost) {
      G.Coop.broadcast(['hz', { kind: o.kind, x: Math.round(o.x), y: Math.round(o.y), r: o.r, angle: o.angle, len: o.len, w: o.w,
                                delay: o.delay, dmg: Math.round(o.dmg), type: o.type, color: o.color, pct: o.pct, pure: o.pure, vis: o.vis, sd: o.sd, own: o.own,
                                st: o.st, lin: o.lin }]);
    }
    return o;
  }

  function clear() { list = []; }

  /** The boss `id` has fallen: its warnings that haven't gone off yet fade away without hitting. */
  function cancelOwner(id) {
    if (!id) return;
    for (const h of list) if (h.own === id && (!h.hit || h.lin) && !h.cancel) { h.cancel = true; h.ct = 0; }
  }

  function inside(h, x, y, r) {
    if (h.kind === 'zone') return G.U.dist2(x, y, h.x, h.y) < (h.r + r * 0.6) ** 2;
    const ca = Math.cos(h.angle), sa = Math.sin(h.angle);
    const px = x - h.x, py = y - h.y;
    const along = px * ca + py * sa;
    if (along < -r || along > h.len + r) return false;
    return Math.abs(-px * sa + py * ca) <= h.w / 2 + r * 0.6;
  }

  function update(dt) {
    const pl = G.Game.player;
    for (let i = list.length - 1; i >= 0; i--) {
      const h = list[i];
      if (h.cancel) { h.ct += dt; if (h.ct >= FADE) list.splice(i, 1); continue; }
      h.t += dt;
      if (!h.hit && h.t >= h.delay) {
        h.hit = true;
        detonate(h);
        if (pl && !pl.dead && inside(h, pl.x, pl.y, pl.r)) {
          pl.breakInvuln();
          pl.hurt(h.pct ? Math.max(h.dmg, pl.maxHp * h.pct) : h.dmg, h.type, !!h.pure,
                  { k: h.kind, d: h.sd, e: h.from && !h.from.dead ? h.from : null, own: h.own, st: h.st });
        }
      } else if (h.hit && h.lin && h.st && pl && !pl.dead && inside(h, pl.x, pl.y, pl.r * 0.5)) {
        G.Status.apply(pl, h.st);                  // standing in a status pool
      }
      if (h.hit && h.t >= h.delay + h.end) list.splice(i, 1);
    }
  }

  function detonate(h) {
    const near = G.Camera.sees(h.x, h.y, 120);
    if (h.vis === 'pillar') {
      // Pillar of light falling from the sky.
      G.FX.beam(h.x, h.y, -Math.PI / 2, 420, h.r * 1.1, h.color, G.VFX.forType('electric'));
      G.FX.ring(h.x, h.y, 4, h.r * 1.3, '#fff3c8', 0.4, 5);
      G.FX.burst(h.x, h.y - 6, h.color, 10, 180);
      if (near) { G.Audio.sfx('judge'); G.Camera.kick(0.2); }
    } else if (h.kind === 'zone') {
      G.FX.ring(h.x, h.y, 4, h.r, h.color, 0.35, 5);
      G.FX.burst(h.x, h.y - 6, h.color, Math.round(h.r / 3), 160);
      if (near) { G.Audio.sfx('break'); if (h.r > 60) G.Camera.kick(0.35); }
    } else {
      G.FX.beam(h.x, h.y - G.LIFT, h.angle, h.len, h.w, h.color, G.VFX.forType(h.type || (h.pure ? 'electric' : 'normal')));
      if (near) G.Audio.sfx('shot', { kind: 'beam', type: h.type });
    }
  }

  /** A status pool on the ground: a puddle in its status's colour, bubbling, that fades out at the end. */
  function drawPool(ctx, h) {
    const left = h.delay + h.lin - h.t;
    let a = Math.min(1, left / 0.6, (h.t - h.delay) / 0.2);
    if (h.cancel) a *= Math.max(0, 1 - h.ct / FADE);
    if (a <= 0) return;
    const d = G.Status.DEFS[h.st], col = d ? d.col : h.color, now = performance.now() / 1000;
    ctx.save();
    ctx.globalAlpha = 0.34 * a; ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.75, 0, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 0.22 * a;
    ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * (0.62 + Math.sin(now * 2.2) * 0.06), h.r * 0.46, 0, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 0.7 * a; ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.75, 0, 0, 6.2832); ctx.stroke();
    ctx.restore();
    if (a > 0.5 && Math.random() < 0.25) {
      const ang = Math.random() * 6.2832, rr = Math.sqrt(Math.random()) * h.r * 0.85;
      G.FX.px(h.x + Math.cos(ang) * rr, h.y + Math.sin(ang) * rr * 0.75, d ? d.fx : '#ffffff', { vy: -22, life: 0.6 });
    }
  }

  /** Warnings on the ground (below the Pokémon). */
  function draw(ctx) {
    const blink = Math.sin(performance.now() / 60) > 0;
    for (const h of list) {
      if (h.hit) { if (h.lin) drawPool(ctx, h); continue; }
      const k = Math.min(1, h.t / h.delay);
      const a = h.cancel ? Math.max(0, 1 - h.ct / FADE) : 1;      // a cancelled warning fades out
      ctx.save();
      if (h.kind === 'zone') {
        ctx.globalAlpha = (0.16) * a;
        ctx.fillStyle = h.color;
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.75, 0, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = (0.32) * a;
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * k, h.r * 0.75 * k, 0, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = (k > 0.75 && blink && !h.cancel ? 0.95 : 0.6) * a;
        ctx.strokeStyle = h.color; ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.75, 0, 0, 6.2832); ctx.stroke();
      } else {
        ctx.translate(h.x, h.y);
        ctx.rotate(h.angle);
        ctx.globalAlpha = (0.14) * a;
        ctx.fillStyle = h.color;
        ctx.fillRect(0, -h.w / 2, h.len, h.w);
        ctx.globalAlpha = (0.34) * a;
        ctx.fillRect(0, -h.w / 2 * k, h.len, h.w * k);
        ctx.globalAlpha = (k > 0.75 && blink && !h.cancel ? 0.95 : 0.55) * a;
        ctx.strokeStyle = h.color; ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(0, -h.w / 2, h.len, h.w);
      }
      ctx.restore();
    }
  }

  return { add, clear, cancelOwner, update, draw, inside, get all() { return list; }, get count() { return list.length; } };
})();
