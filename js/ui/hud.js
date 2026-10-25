/* ============ hud.js — interface inside the canvas ============
 * Drawn in SCREEN coordinates (without the camera transform).
 */
G.HUD = (() => {
  let HUD_SCALE = 1.55;       // size of the top-left block (health, teammates, buffs)
  const F = (w, s) => `${w} ${s}px Pixelify,"Segoe UI",system-ui,sans-serif`;

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function bar(ctx, x, y, w, h, frac, col, bg = 'rgba(0,0,0,.55)') {
    roundRect(ctx, x, y, w, h, h / 2); ctx.fillStyle = bg; ctx.fill();
    if (frac > 0) {
      ctx.save();
      roundRect(ctx, x, y, w, h, h / 2); ctx.clip();
      ctx.fillStyle = col;
      ctx.fillRect(x, y, w * G.U.clamp(frac, 0, 1), h);
      ctx.restore();
    }
  }

  /** The spectated teammate's moves and item, rebuilt only when their loadout string changes. */
  let svKey = null, svView = null;
  function specView() {
    const spec = G.Game.spectating;
    const lo = spec && spec.lo;
    if (!lo) return null;
    if (lo === svKey) return svView;
    const [slotsTxt, item, active] = lo.split('~');
    const slots = slotsTxt ? slotsTxt.split(';').map(g => g.split('+').map(t => {
      const [id, lvl, ev] = t.split('.');
      if (!G.Moves.BY_ID[id]) return null;
      const m = G.Moves.instance(id, Math.max(1, +lvl || 1));
      if (ev === '1') G.Moves.evolve(m);
      return m;
    }).filter(Boolean)).filter(g => g.length) : [];
    svKey = lo;
    svView = { slots, active: Math.min(+active || 0, Math.max(0, slots.length - 1)), item: G.Items.BY[item] ? item : null,
               maxMoves: Math.max(4, slots.length), cdMul: 1, bonds: 0 };
    return svView;
  }

  function draw(ctx, w, h, pl, st) {
    HUD_SCALE = w < 640 ? 1.2 : w < 1000 ? 1.4 : 1.55;      // on narrow screens, smaller so it doesn't cover the clock
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    G.Touch.clearButtons();
    const touch = G.Touch.active;

    // ---------- experience bar (top edge; empty in the Battle Tower, which has no experience) ----------
    const xpF = G.Tower.active ? 0 : pl.xp / pl.xpNext;
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(0, 0, w, 7);
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#4fd1ff'); g.addColorStop(1, '#a98bff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w * G.U.clamp(xpF, 0, 1), 7);

    // ---------- health + level + buffs (top left, at HUD_SCALE) ----------
    const px = 16, py = 20;
    portraitDt = Math.min(0.1, (performance.now() - portraitT) / 1000);
    portraitT = performance.now();
    ctx.save();
    ctx.scale(HUD_SCALE, HUD_SCALE);
    // Your card: like the teammates' (your Pokémon's icon, name, health), with the level.
    // (24-10-2026) Its look comes from your Arceus Shop card theme (data/keyitems.js G.Themes; Classic by default).
    const myTh = G.Themes.card(G.Themes.cardId());
    drawCard(ctx, px, py, {
      key: 'me', pl, name: pl.mon.name, nameCol: myTh.name_, color: myTh.ring, tag: 'Lv. ' + pl.level,
      hp: pl.hp, maxHp: pl.maxHp, dead: pl.dead, barCol: myTh.bar, theme: myTh
    });

    // Active buffs and altar power: pills with an icon + text. If they don't fit in
    // one row (up to the end of the health bar) they move to the next, without overlapping.
    const COL = { atk: '#ff6b4d', spd: '#7fe0ff', def: '#b0b8c8', regen: '#5fe08a', fell: '#c7e04a', surge: '#c6b08a' };
    const LBL = { atk: 'ATK', spd: 'SPD', def: 'DEF', regen: 'REGEN', fell: 'STINGER', surge: 'POWER' };
    const ICO = { atk: 'fist', spd: 'boot', def: 'shield', regen: 'sprout', fell: 'up', surge: 'fist' };
    const POWER_ICO = { dmg: 'fist', spd: 'boot', mag: 'magnet', cd: 'clock', guard: 'shield' };
    const pills = [];
    for (const k in pl.buffs) {
      const b = pl.buffs[k];
      if (b.n > 0) pills.push({ icon: ICO[k], txt: LBL[k] + ' ×' + b.n, col: COL[k], bg: 'rgba(0,0,0,.5)' });
    }
    if (pl.power) {
      const pw = pl.power;
      pills.push({ icon: POWER_ICO[pw.def.id] || 'star', txt: pw.def.name.toUpperCase() + ' ' + Math.ceil(pw.t) + 's', col: pw.def.color, bg: 'rgba(0,0,0,.6)' });
    }
    const gd = G.Interact.goldState();                 // Gold shrine combo (whole team)
    if (gd) pills.push({ icon: 'coin', txt: 'GOLD ×' + (gd[1] / 100).toFixed(2) + (gd[2] ? ' MAX' : '') + ' ' + Math.ceil(gd[0]) + 's', col: '#ffd23f', bg: 'rgba(70,52,0,.75)' });
    const PH = 18, PGAP = 5, MAXX = px + 216;
    let bx = px, rowY = py + CARD_H + CARD_GAP, rows = pills.length ? 1 : 0;
    ctx.textAlign = 'left';
    for (const pi of pills) {
      ctx.font = F(800, 10);
      const tw = 6 + 14 + 4 + ctx.measureText(pi.txt).width + 8;
      if (bx > px && bx + tw > MAXX) { bx = px; rowY += PH + 4; rows++; }
      roundRect(ctx, bx, rowY, tw, PH, 9);
      ctx.fillStyle = pi.bg; ctx.fill();
      G.Icons.draw(ctx, pi.icon, bx + 5, rowY + 2, 14);
      ctx.fillStyle = pi.col;
      ctx.fillText(pi.txt, bx + 5 + 14 + 4, rowY + 13);
      bx += tw + PGAP;
    }
    const coopTop = rows ? py + CARD_H + CARD_GAP + rows * (PH + 4) + 2 : py + CARD_H + CARD_GAP;
    ctx.restore();

    // ---------- clock / biome / kills ----------
    ctx.textAlign = 'center';
    ctx.font = F(800, 26);
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    // Battle Tower (systems/tower.js): the floor instead of the clock, and the floor's goal.
    const twr = G.Tower.active ? G.Tower.hud() : null;
    ctx.fillText(twr ? twr.big : G.U.mmss(st.time), w / 2, 42);
    // Stage · defeated · coins: bigger, bold, outlined and colour-coded so it reads over any ground (24-10-2026; was 10px grey).
    {
      const parts = twr ? [
        ['BATTLE TOWER · ' + twr.mode, '#ffd27a'],
        ['  ·  ', 'rgba(255,255,255,.6)'],
        [twr.place, '#8fe3ff'],
        ['  ·  ', 'rgba(255,255,255,.6)'],
        [twr.bp + ' BP', '#ffe27a']
      ] : [
        [G.World.biomeName().toUpperCase(), '#8fe3ff'],
        ['  ·  ', 'rgba(255,255,255,.6)'],
        [Math.floor(pl.kills || 0).toLocaleString('en') + ' DEFEATED', '#ffffff'],
        ['  ·  ', 'rgba(255,255,255,.6)'],
        [Math.floor(pl.coins || 0).toLocaleString('en') + ' COINS', '#ffd23f']
      ];
      ctx.save();
      ctx.font = F(800, 13);
      ctx.textAlign = 'left';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,.85)';
      const tw = parts.reduce((a, p) => a + ctx.measureText(p[0]).width, 0);
      let x = w / 2 - tw / 2;
      for (const [txt, col] of parts) {
        ctx.strokeText(txt, x, 61);
        ctx.fillStyle = col;
        ctx.fillText(txt, x, 61);
        x += ctx.measureText(txt).width;
      }
      if (twr && twr.goal) {
        ctx.font = F(800, 12);
        const gw = ctx.measureText(twr.goal).width;
        ctx.strokeText(twr.goal, w / 2 - gw / 2, 78);
        ctx.fillStyle = twr.col; ctx.fillText(twr.goal, w / 2 - gw / 2, 78);
      }
      ctx.restore();
      ctx.textAlign = 'center';
    }

    // ---------- weather (top right) ----------
    const wx = G.Weather.current;
    let wxBox = null;           // the weather chip's rectangle, for its hover tooltip
    if (wx) {
      ctx.font = F(800, 11);
      ctx.textAlign = 'left';
      const txt = wx.name.toUpperCase() + (wx.left > 999 ? '' : ' · ' + Math.ceil(wx.left) + 's');      // (an arena's own weather has no end)
      const tw = ctx.measureText(txt).width + 40;
      const x0 = w - tw - 16 - (touch ? 56 : 0), y0 = 14;
      wxBox = { x: x0, y: y0, w: tw, h: 26 };
      roundRect(ctx, x0, y0, tw, 26, 9);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill();
      G.Icons.draw(ctx, wx.icon, x0 + 6, y0 + 3, 20);
      ctx.fillStyle = wx.color;
      ctx.fillText(txt, x0 + 32, y0 + 17);
    }

    // ---------- boss bar (top centre): icon, big name and health ----------
    // (Gengar's clones in the Battle Tower are bosses too, but the bar shows the real one.)
    const boss = G.EnemyMgr.all().find(e => e.boss && !e.dead && e.behavior !== 'clone');
    if (boss) {
      const bw = Math.min(480, w - 190), bx0 = (w - bw) / 2, IS = 48, by = twr ? 86 : 64;
      const pulseB = 0.5 + 0.5 * Math.sin(performance.now() / 300);
      // Boss icon
      roundRect(ctx, bx0 - IS - 10, by, IS, IS, 9);
      ctx.fillStyle = 'rgba(40,10,10,.75)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,203,61,' + (0.6 + 0.4 * pulseB) + ')'; ctx.lineWidth = 2.5; ctx.stroke();
      portraitBox(ctx, 'boss-hud', boss, bx0 - IS - 10, by, IS);
      // Name and percentage
      ctx.font = F(800, 19);
      ctx.textAlign = 'left';
      ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.8)';
      const nm = boss.name.toUpperCase();
      ctx.strokeText(nm, bx0, by + 21); ctx.fillStyle = '#ffe08a'; ctx.fillText(nm, bx0, by + 21);
      ctx.textAlign = 'right';
      ctx.font = F(800, 14);
      const pct = Math.ceil(100 * boss.hp / boss.maxHp) + '%';
      ctx.strokeText(pct, bx0 + bw, by + 21); ctx.fillStyle = '#fff'; ctx.fillText(pct, bx0 + bw, by + 21);
      ctx.textAlign = 'center';
      bar(ctx, bx0, by + 28, bw, 20, boss.hp / boss.maxHp, '#ffcb3d');
    }

    // ---------- arrows to bosses that can't be seen (at the edge of the screen) ----------
    {
      const camB = G.Camera, tB = performance.now() / 1000;
      for (const e of G.EnemyMgr.all()) {
        if (!e.boss || e.dead) continue;
        const sx = (e.x - camB.left()) * camB.scale, sy = (e.y - e.bodyH * 0.5 - camB.top()) * camB.scale;
        if (sx > 0 && sx < w && sy > 0 && sy < h) continue;
        const M = 46;
        const ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 110, h - M - 90);
        const a = Math.atan2(sy - ey, sx - ex);
        const metres = Math.round(G.U.dist(pl.x, pl.y, e.x, e.y) / 32);
        const beat = 0.5 + 0.5 * Math.sin(tB * 6);
        ctx.save();
        ctx.translate(ex, ey);
        ctx.lineJoin = 'round';
        // Circle with the boss's icon
        ctx.beginPath(); ctx.arc(0, 0, 25, 0, 6.2832);
        ctx.fillStyle = 'rgba(30,8,8,.85)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,203,61,' + (0.65 + 0.35 * beat) + ')'; ctx.lineWidth = 3; ctx.stroke();
        ctx.save();
        ctx.beginPath(); ctx.arc(0, 0, 23, 0, 6.2832); ctx.clip();
        portraitBox(ctx, 'boss-arrow-' + e.id, e, -23, -23, 46);
        ctx.restore();
        // Big arrow towards the boss, outside the circle
        ctx.fillStyle = 'rgba(255,90,70,' + (0.8 + 0.2 * beat) + ')';
        ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 48, Math.sin(a) * 48);
        ctx.lineTo(Math.cos(a + 0.6) * 28, Math.sin(a + 0.6) * 28);
        ctx.lineTo(Math.cos(a - 0.6) * 28, Math.sin(a - 0.6) * 28);
        ctx.closePath(); ctx.stroke(); ctx.fill();
        // Name and distance, on the opposite side of the arrow so it doesn't go off screen
        ctx.font = F(800, 15);
        const ca = Math.cos(a), sa = Math.sin(a);
        ctx.textAlign = ca > 0.3 ? 'right' : ca < -0.3 ? 'left' : 'center';
        const lx = -ca * 34, ly = -sa * 34 + (Math.abs(sa) > 0.6 ? (sa > 0 ? -4 : 14) : 4);
        const lbl = e.name.toUpperCase() + ' · ' + metres + ' m';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)';
        ctx.strokeText(lbl, lx, ly); ctx.fillStyle = '#ffe08a'; ctx.fillText(lbl, lx, ly);
        ctx.restore();
      }
    }

    // ---------- spectator: down in a group, you watch a teammate ----------
    const spec = G.Game.spectating;
    if (spec) {
      // Sits above the move bar (its slots and the active move's name), which grew with the larger slots.
      const barS = w < 640 ? 58 : 72;
      const cx = w / 2, cy = h - barS - 80 - (touch ? Math.min(28, G.Touch.safeArea().bottom) : 0), bs = 40;
      ctx.save();
      ctx.font = F(800, 16);
      const label = 'Spectating: ' + spec.name;
      const tw = Math.max(ctx.measureText(label).width, 150);
      roundRect(ctx, cx - tw / 2 - 64, cy - 24, tw + 128, 48, 16);
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fill();
      ctx.strokeStyle = spec.color; ctx.lineWidth = 2; ctx.stroke();
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)';
      ctx.strokeText(label, cx, cy - 3); ctx.fillStyle = spec.color; ctx.fillText(label, cx, cy - 3);
      ctx.font = F(700, 11); ctx.fillStyle = '#c9d4ea';
      ctx.fillText(spec.count > 1 ? spec.index + ' / ' + spec.count + ' · Q / E to switch' : 'Waiting for a teammate to revive you', cx, cy + 15);
      if (spec.count > 1) {
        // ◀ ▶ buttons (mouse or touch)
        for (const [dir, bx] of [[-1, cx - tw / 2 - 64 - bs - 8], [1, cx + tw / 2 + 64 + 8]]) {
          roundRect(ctx, bx, cy - bs / 2, bs, bs, 12);
          ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fill();
          ctx.strokeStyle = spec.color; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          const mx = bx + bs / 2, my = cy;
          if (dir < 0) { ctx.moveTo(mx + 6, my - 9); ctx.lineTo(mx - 7, my); ctx.lineTo(mx + 6, my + 9); }
          else { ctx.moveTo(mx - 6, my - 9); ctx.lineTo(mx + 7, my); ctx.lineTo(mx - 6, my + 9); }
          ctx.closePath(); ctx.fill();
          G.Touch.addButton(bx, cy - bs / 2, bs, bs, () => G.Game.cycleSpectate(dir), 6);
        }
      }
      ctx.restore();
    }

    // ---------- notice ----------
    // ---------- off-screen shinies: a sparkle at the edge ----------
    const cam = G.Camera, pulse = 0.6 + Math.sin(performance.now() / 160) * 0.4;
    for (const e of G.EnemyMgr.shinies()) {
      const sx = (e.x - cam.left()) * cam.scale, sy = (e.y - cam.top()) * cam.scale;
      if (sx > 0 && sx < w && sy > 0 && sy < h) continue;
      const M = 34;
      const ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 60, h - M - 70);
      const a = Math.atan2(sy - ey, sx - ex);
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.translate(ex, ey);
      ctx.fillStyle = '#9ae6ff';
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 24, Math.sin(a) * 24);
      ctx.lineTo(Math.cos(a + 2.5) * 12, Math.sin(a + 2.5) * 12);
      ctx.lineTo(Math.cos(a - 2.5) * 12, Math.sin(a - 2.5) * 12);
      ctx.fill();
      ctx.globalAlpha = 1;
      G.Icons.draw(ctx, 'shiny', -12, -12, 24);
      ctx.restore();
    }

    if (G.Coop.active) drawCoop(ctx, w, h, pl, px, coopTop);

    // Rift: a big pulsing arrow at the edge if it can't be seen, and if it can, an
    // arrow bouncing above it; in the arena, a countdown.
    const rift = G.Rift.rift;
    if (rift) {
      const sx = (rift.x - cam.left()) * cam.scale, sy = (rift.y - 40 - cam.top()) * cam.scale;
      const now = performance.now() / 1000, beat = 0.5 + Math.sin(now * 7) * 0.5;
      const label = 'RIFT · ' + Math.round(G.U.dist(pl.x, pl.y, rift.x, rift.y) / 32) + ' m · ' + Math.ceil(rift.ttl) + ' s';
      const off = sx < 0 || sx > w || sy < 0 || sy > h;
      ctx.save();
      if (off) {
        // Like the boss arrows: a round badge with the rift itself as the icon, an arrow pointing to it and the label opposite.
        const M = 64, ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 110, h - M - 90);
        const a = Math.atan2(sy - ey, sx - ex), ca = Math.cos(a), sa = Math.sin(a);
        ctx.translate(ex, ey);
        ctx.lineJoin = 'round';
        // Halo that pulses.
        ctx.globalAlpha = 0.18 + beat * 0.22;
        ctx.fillStyle = '#b48aff';
        ctx.beginPath(); ctx.arc(0, 0, 34 + beat * 8, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 1;
        // Badge.
        ctx.beginPath(); ctx.arc(0, 0, 27, 0, 6.2832);
        ctx.fillStyle = 'rgba(20,8,40,.9)'; ctx.fill();
        ctx.strokeStyle = 'rgba(200,160,255,' + (0.65 + 0.35 * beat) + ')'; ctx.lineWidth = 3.5; ctx.stroke();
        const img = G.Tiles.propSprite(0, 'rift', Math.floor(rift.t * 8) % 4);
        if (img) {
          ctx.save();
          ctx.beginPath(); ctx.arc(0, 0, 24, 0, 6.2832); ctx.clip();
          const k = Math.min(46 / img.width, 46 / img.height);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, -img.width * k / 2, -img.height * k / 2, img.width * k, img.height * k);
          ctx.restore();
        }
        // Big arrow outside the badge.
        const tri = (k) => {
          ctx.beginPath();
          ctx.moveTo(ca * 52 * k, sa * 52 * k);
          ctx.lineTo(Math.cos(a + 0.62) * 30 * k, Math.sin(a + 0.62) * 30 * k);
          ctx.lineTo(Math.cos(a - 0.62) * 30 * k, Math.sin(a - 0.62) * 30 * k);
          ctx.closePath();
        };
        tri(1.1); ctx.fillStyle = '#1a0b33'; ctx.fill();
        tri(1); ctx.fillStyle = beat > 0.5 ? '#e2d0ff' : '#a06bff'; ctx.fill();
        ctx.font = F(800, 15);
        ctx.textAlign = ca > 0.3 ? 'right' : ca < -0.3 ? 'left' : 'center';
        const lx = -ca * 36, ly = -sa * 36 + (Math.abs(sa) > 0.6 ? (sa > 0 ? -4 : 14) : 4);
        ctx.lineWidth = 4.5; ctx.strokeStyle = 'rgba(0,0,0,.88)';
        ctx.strokeText(label, lx, ly);
        ctx.fillStyle = '#e2d0ff';
        ctx.fillText(label, lx, ly);
      } else {
        // Above the rift: a bouncing downward arrow.
        const by = sy - 46 - Math.abs(Math.sin(now * 4)) * 10;
        ctx.translate(sx, by);
        ctx.beginPath(); ctx.moveTo(-15, -12); ctx.lineTo(15, -12); ctx.lineTo(0, 8); ctx.closePath();
        ctx.lineWidth = 4; ctx.strokeStyle = '#1a0b33'; ctx.stroke();
        ctx.fillStyle = beat > 0.5 ? '#e2d0ff' : '#a06bff'; ctx.fill();
        ctx.font = F(800, 11); ctx.textAlign = 'center';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)';
        const l2 = 'RIFT · ' + Math.ceil(rift.ttl) + ' s';
        ctx.strokeText(l2, 0, -18); ctx.fillStyle = '#e2d0ff'; ctx.fillText(l2, 0, -18);
      }
      ctx.restore();
    }
    if (G.Rift.inArena) {
      ctx.textAlign = 'center';
      ctx.font = F(800, 12);
      ctx.fillStyle = '#d9c2ff';
      ctx.fillText('RIFT · ' + G.U.mmss(G.Rift.timeLeft), w / 2, boss ? 130 : 76);
    }

    // Events: countdown, arrow to the lost Pokémon / the marker and to the goblins.
    G.Events.drawHud(ctx, w, h, pl, F);

    // Its own notice when a rift opens (the other notices don't cover it).
    if (rift && rift.t < 4.5) {
      const a = Math.min(1, rift.t * 4, (4.5 - rift.t) * 2), pop = 1 + Math.max(0, 0.25 - rift.t) * 1.6;
      const y0 = h * 0.2;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(w / 2, y0); ctx.scale(pop, pop);
      ctx.font = F(800, 20);
      const t1 = 'A RIFT HAS OPENED!', t2 = 'Follow the purple arrow: a legendary awaits inside';
      const bw = Math.min(w - 24, Math.max(ctx.measureText(t1).width, (ctx.font = F(700, 11), ctx.measureText(t2).width)) + 36);
      roundRect(ctx, -bw / 2, -26, bw, 52, 10);
      ctx.fillStyle = 'rgba(26,11,51,.88)'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#b48aff'; ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = F(800, 20); ctx.fillStyle = '#e2d0ff'; ctx.fillText(t1, 0, -2);
      ctx.font = F(700, 11); ctx.fillStyle = '#c9b0ff'; ctx.fillText(t2, 0, 16);
      ctx.restore();
    }

    // Group: someone is choosing a bond or item and the run is paused for everyone.
    const choosers = G.Coop.active ? G.Game.waitingChoosers : [];
    if (choosers.length) {
      const names = choosers.length > 2 ? choosers.slice(0, 2).join(', ') + ' +' + (choosers.length - 2) : choosers.join(' & ');
      const txt = names + (choosers.length > 1 ? ' are in a menu…' : ' is in a menu…');
      const sub = 'Game paused';
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
      ctx.save();
      ctx.font = F(800, 14);
      const tw = Math.max(ctx.measureText(txt).width, 90) + 56, ph = 44, pxx = w / 2 - tw / 2, pyy = (boss ? 118 : 70) + (G.Rift.inArena ? 22 : 0);
      roundRect(ctx, pxx, pyy, tw, ph, 14);
      ctx.fillStyle = 'rgba(30,8,32,.82)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,138,216,' + (0.55 + 0.4 * pulse) + ')'; ctx.lineWidth = 2; ctx.stroke();
      G.Icons.draw(ctx, 'bond', pxx + 12, pyy + 10, 24);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffd3f2';
      ctx.fillText(txt, pxx + 44, pyy + 19);
      ctx.font = F(700, 10);
      ctx.fillStyle = '#c9a0bb';
      ctx.fillText(sub, pxx + 44, pyy + 34);
      ctx.restore();
    }

    const ban = G.Spawner.banner();
    if (ban) {
      const a = Math.min(1, ban.t * 1.6);
      // Bigger announcement: a pop-in, a dark pill behind it and a thick outline, so events are hard to miss.
      const age = Math.max(0, (ban.dur || ban.t) - ban.t), pop = 1 + 0.22 * Math.max(0, 1 - age / 0.3);
      ctx.save();
      ctx.globalAlpha = a;
      // Always centred (previously it inherited the alignment of the last thing drawn, e.g.
      // a treasure goblin's arrow, and came out misplaced).
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let size = w < 640 ? 24 : 34;
      const ic = ban.dex && G.DEX_BY[ban.dex] ? 60 : 0;          // room for the event Pokémon's badge
      ctx.font = F(800, size);
      const mw = ctx.measureText(ban.text).width;
      if (mw > w - 56 - ic) { size = Math.max(14, Math.floor(size * (w - 56 - ic) / mw)); ctx.font = F(800, size); }
      const tw = ctx.measureText(ban.text).width, by = h * 0.3, cw = tw + ic;
      ctx.translate(w / 2, by); ctx.scale(pop, pop);
      roundRect(ctx, -cw / 2 - 18, -Math.max(size * 0.85, ic ? 36 : 0), cw + 36, Math.max(size * 1.7, ic ? 72 : 0), Math.max(size, ic ? 36 : 0) * 0.5);
      ctx.fillStyle = 'rgba(8,10,20,.62)'; ctx.fill();
      if (ic) {
        // The Pokémon of the event, in a round badge on the left.
        const cx = -cw / 2 + 26;
        ctx.beginPath(); ctx.arc(cx, 0, 29, 0, 6.2832);
        ctx.fillStyle = 'rgba(10,12,24,.9)'; ctx.fill();
        ctx.strokeStyle = '#ffcb3d'; ctx.lineWidth = 3; ctx.stroke();
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, 0, 26, 0, 6.2832); ctx.clip();
        portraitBox(ctx, 'banner-ev', { dex: ban.dex }, cx - 26, -26, 52);
        ctx.restore();
      }
      ctx.lineJoin = 'round';
      ctx.fillStyle = '#ffcb3d';
      ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = Math.max(4, size / 6);
      ctx.strokeText(ban.text, ic / 2, 1);
      ctx.fillText(ban.text, ic / 2, 1);
      ctx.restore();
    }

    // ---------- move slots ----------
    // Spectating a teammate: show THEIR moves and held item (from their shared loadout) instead of yours.
    const ownPl = pl, sv = specView();
    if (sv) pl = sv;
    const S = w < 640 ? 58 : 72, GAP = w < 640 ? 9 : 12, K = S / 54;      // bigger on wider screens
    const n = Math.max(1, pl.slots.length);
    const totalW = n * S + (n - 1) * GAP;
    let sx = (w - totalW) / 2;
    // Above the iPhone's home bar (taps there sometimes don't arrive).
    let sy = h - S - 18 - (touch ? Math.min(28, G.Touch.safeArea().bottom) : 0);
    // On mobile, wherever the player has put it: the item block + all the
    // slots (even if they aren't filled yet), by their centre, as in the editor
    // (layout-ui.js); new attacks appear towards the right.
    const pb = touch && G.Touch.spot('bar');
    if (pb) {
      const nAll = Math.max(n, pl.maxMoves), bw = S + 18 + nAll * S + (nAll - 1) * GAP;
      sx = G.U.clamp(pb[0] * w - bw / 2, 6, Math.max(6, w - bw - 6)) + S + 18;
      sy = G.U.clamp(pb[1] * h - S / 2, 24, h - S - 6);
    }
    const BOND = '#ff8ad8';
    const tips = [];            // hover tooltips for moves and the held item
    const cdOf = m => m.kind === 'orbit' ? 0 : G.U.clamp(m.t / (m.cd * pl.cdMul), 0, 1);
    let moveLbl = null;         // horizontal extent of the active move's name, so the item's name can dodge it

    // A burst move's seconds left, centred on (cx, cy) with a thick outline so it reads over any icon.
    const burstSecs = (t, cx, cy, size) => {
      const txt = String(Math.ceil(t));
      ctx.font = F(900, size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(3, size / 4); ctx.strokeStyle = 'rgba(0,0,0,.9)'; ctx.strokeText(txt, cx, cy);
      ctx.fillStyle = '#fff'; ctx.fillText(txt, cx, cy);
      ctx.textBaseline = 'alphabetic';
    };
    for (let i = 0; i < n; i++) {
      const g = pl.slots[i] || [];
      const m = g[0];
      const fused = g.length > 1;
      const on = i === pl.active;
      const x = sx + i * (S + GAP);
      const y = on ? sy - 6 : sy;
      // Tapping (or clicking) an icon activates that move. With the mouse it can also be dragged onto another slot (swap).
      if (m && !sv) G.Touch.addButton(x, y, S, S, () => { if (G.Game.state === 'playing' && pl.active !== i) { pl.setActive(i); G.Audio.sfx('click'); } }, GAP / 2 + 3, i);
      const col = m ? G.U.TYPE_COLOR[m.type] : '#4a5468';

      // background
      roundRect(ctx, x, y, S, S, 12);
      ctx.fillStyle = on ? 'rgba(20,30,50,.95)' : 'rgba(10,16,28,.8)';
      ctx.fill();
      ctx.lineWidth = on ? 2.5 : fused || (m && m.evolved) ? 2 : 1.2;
      // Bond: pink border. Evolved: gold.
      ctx.strokeStyle = fused ? BOND : m && m.evolved ? '#ffd23f' : on ? col : 'rgba(140,170,210,.22)';
      ctx.stroke();

      if (!m) continue;
      tips.push({ x, y, w: S, h: S, title: fused ? m.name + ' +' + (g.length - 1) : m.name, col: fused ? BOND : col,
                  lines: g.map(gm => (fused ? gm.name + ': ' : '') + (gm.def.desc || '') + (gm.lvl ? ' (Lv. ' + gm.lvl + '/' + gm.def.maxLvl + ')' : '')) });

      if (fused) {
        // Bond: the moves in a 2×2 grid, each with its own cooldown.
        const C = Math.round(22 * K), P = (S - C * 2) / 3;
        g.forEach((gm, k) => {
          const cx = x + P + (k % 2) * (C + P), cy = y + P + Math.floor(k / 2) * (C + P);
          G.Icons.draw(ctx, 'move:' + gm.id, cx, cy, C);
          const f = cdOf(gm);
          if (f > 0) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(cx, cy, C, C * f); }
          if (gm.evolved) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1; ctx.strokeRect(cx + 0.5, cy + 0.5, C - 1, C - 1); }
          // Flash when cast.
          const fl = 1 - (performance.now() - (gm.castAt || 0)) / 180;
          if (fl > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (fl * 0.55).toFixed(2) + ')'; ctx.fillRect(cx, cy, C, C); }
        });
      } else {
        // cooldown: empties from the bottom up
        const cdFrac = cdOf(m);
        if (cdFrac > 0) {
          ctx.save();
          roundRect(ctx, x, y, S, S, 12); ctx.clip();
          ctx.fillStyle = 'rgba(0,0,0,.6)';
          ctx.fillRect(x, y, S, S * cdFrac);
          ctx.restore();
        }

        // Burst move, ready: a pulsing gold border (the seconds left while it charges go on top of the icon, below).
        if (m.kind === 'burst' && m.t <= 0.05 && !on) {
          const pulse = 0.55 + Math.sin(performance.now() / 160) * 0.35;
          ctx.save();
          roundRect(ctx, x - 2, y - 2, S + 4, S + 4, 13);
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,210,63,' + pulse.toFixed(2) + ')'; ctx.stroke();
          ctx.restore();
          // PC: the Burst key fires it without switching.
          if (!touch && !sv) {
            ctx.font = F(800, Math.round(10 * K)); ctx.textAlign = 'center'; ctx.lineJoin = 'round';
            ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText('SPACE', x + S / 2, y - 7);
            ctx.fillStyle = '#ffd23f'; ctx.fillText('SPACE', x + S / 2, y - 7);
          }
        }

        // type emblem + family badge
        // Icons only scale in whole steps (16 px each): on the bigger slots use 3x so the disc fills the box and the kind tag is easier to see.
        const IS = S >= 64 ? 48 : 32;
        G.Icons.draw(ctx, 'move:' + m.id, x + (S - IS) / 2, y + (S - IS) / 2 - (IS > 32 ? 5 : 2), IS);

        // move level (little dots)
        const dots = m.def.maxLvl;
        const dw = Math.round(4 * K), dgap = 2;
        const tw = dots * dw + (dots - 1) * dgap;
        for (let d = 0; d < dots; d++) {
          ctx.fillStyle = d < m.lvl ? col : 'rgba(255,255,255,.18)';
          ctx.fillRect(x + (S - tw) / 2 + d * (dw + dgap), y + S - 9 * K, dw, 3);
        }

        // Burst move charging: the icon dimmed and the seconds left, big and centred ON TOP of it.
        if (m.kind === 'burst' && m.t > 0.05) {
          ctx.save();
          roundRect(ctx, x, y, S, S, 12); ctx.clip();
          ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x, y, S, S);
          ctx.restore();
          burstSecs(m.t, x + S / 2, y + S / 2, Math.round(20 * K));
        }
      }

      // tecla
      ctx.font = F(800, Math.round(11 * K));
      ctx.fillStyle = fused ? BOND : on ? col : 'rgba(200,215,240,.85)';
      ctx.textAlign = 'left';
      ctx.fillText(String(i + 1), x + 4, y + 12 * K);

      // name above the active one (with a bond: "Ember +2")
      if (on) {
        ctx.font = F(800, Math.round(13 * K));
        ctx.textAlign = 'center';
        const nm = fused ? m.name + ' +' + (g.length - 1) : m.name;
        ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)';
        ctx.strokeText(nm, x + S / 2, y - 8);
        ctx.fillStyle = '#fff';
        ctx.fillText(nm, x + S / 2, y - 8);
        const hw = ctx.measureText(nm).width / 2 + 3;
        moveLbl = { x0: x + S / 2 - hw, x1: x + S / 2 + hw };
      }
    }

    // ---------- dragging a move onto another slot (PC) ----------
    const dg = !sv && G.Touch.dragging();
    if (dg && pl.slots[dg.slot]) {
      const slotXY = i => [sx + i * (S + GAP), i === pl.active ? sy - 6 : sy];
      const [ox, oy] = slotXY(dg.slot);
      ctx.save();
      roundRect(ctx, ox, oy, S, S, 12); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill();
      const to = G.Touch.slotAt(dg.x, dg.y);
      if (to >= 0 && to !== dg.slot) {
        const [tx, ty] = slotXY(to);
        roundRect(ctx, tx - 3, ty - 3, S + 6, S + 6, 14);
        ctx.setLineDash([6, 4]); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
      }
      ctx.globalAlpha = 0.85;
      const IS = S >= 64 ? 48 : 32;
      G.Icons.draw(ctx, 'move:' + pl.slots[dg.slot][0].id, dg.x - IS / 2, dg.y - IS / 2, IS);
      ctx.restore();
    }

    // ---------- bond saved (there aren't two loose moves yet) ----------
    if (pl.bonds > 0) {
      const bx = sx + totalW + 12, by = sy + S / 2 - 12;
      G.Icons.draw(ctx, 'bond', bx, by, 24);
      if (pl.bonds > 1) {
        ctx.font = F(800, 10);
        ctx.textAlign = 'left';
        ctx.fillStyle = BOND;
        ctx.fillText('×' + pl.bonds, bx + 25, by + 20);
      }
    }

    // ---------- equipped item (to the left of the moves) ----------
    {
      let ix = sx - S - 18;
      const iy = sy;
      // If the move's name (long when bonded, e.g. "Thunder Shock +2") would run into the item's name, slide the whole item box left instead of lifting the text.
      if (pl.item && moveLbl) {
        ctx.font = F(800, Math.round(12 * K));
        const iw0 = ctx.measureText(G.Items.BY[pl.item].name).width / 2 + 3;
        const over = ix + S / 2 + iw0 - (moveLbl.x0 - 4);
        if (over > 0) ix = Math.max(6, iw0 + 4 - S / 2, ix - over);   // never past the screen edge, name included
      }
      roundRect(ctx, ix, iy, S, S, 12);
      ctx.fillStyle = pl.item ? 'rgba(40,30,10,.9)' : 'rgba(10,16,28,.55)';
      ctx.fill();
      ctx.lineWidth = pl.item ? 2 : 1;
      ctx.strokeStyle = pl.item ? '#ffd23f' : 'rgba(140,170,210,.18)';
      ctx.stroke();
      if (pl.item) {
        G.Icons.draw(ctx, pl.item, ix + (S - 36 * K) / 2, iy + (S - 36 * K) / 2, 36 * K);
        ctx.font = F(800, Math.round(12 * K));
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)';
        const inm = G.Items.BY[pl.item].name, ly = iy - 8;
        ctx.strokeText(inm, ix + S / 2, ly);
        ctx.fillStyle = '#ffd23f';
        ctx.fillText(inm, ix + S / 2, ly);
        tips.push({ x: ix, y: iy, w: S, h: S, title: G.Items.BY[pl.item].name, col: '#ffd23f', lines: [G.Items.BY[pl.item].desc] });
      }
    }

    pl = ownPl;

    // The weather chip also explains itself on hover: what is boosted, what is weakened, who it hurts.
    if (wxBox && wx) {
      const T = G.T || (s => s);
      const up = Object.keys(wx.mult).filter(k => wx.mult[k] > 1), down = Object.keys(wx.mult).filter(k => wx.mult[k] < 1);
      const lines = [];
      if (up.length) lines.push('Boosted: ' + up.map(k => T(G.U.TYPE_NAME[k] || k) + ' ×' + wx.mult[k]).join(', '));
      if (down.length) lines.push('Weakened: ' + down.map(k => T(G.U.TYPE_NAME[k] || k) + ' ×' + wx.mult[k]).join(', '));
      if (wx.safe) lines.push('Other types lose a little HP' + (wx.slow ? ' and move more slowly' : '') + '.');
      lines.push('It affects you and the enemies alike.');
      tips.push({ x: wxBox.x, y: wxBox.y, w: wxBox.w, h: wxBox.h, title: wx.name, col: wx.color, lines, below: true });
    }

    // ---------- tooltip (mouse only): what the move or item does ----------
    if (!touch) {
      const ms = G.Input.mouse();
      const tp = tips.find(t => ms.x >= t.x && ms.x <= t.x + t.w && ms.y >= t.y && ms.y <= t.y + t.h);
      if (tp) {
        const T = G.T || (s => s), FS = 13, LH = 17, MW = 250;
        const wrap = (txt, font) => {
          ctx.font = font;
          const out = []; let cur = '';
          for (const word of T(txt).split(' ')) {
            const t2 = cur ? cur + ' ' + word : word;
            if (cur && ctx.measureText(t2).width > MW) { out.push(cur); cur = word; } else cur = t2;
          }
          if (cur) out.push(cur);
          return out;
        };
        const body = [];
        for (const l of tp.lines) body.push(...wrap(l, F(500, FS)));
        const title = T(tp.title);
        ctx.font = F(800, 15);
        const bw = Math.min(MW, Math.max(ctx.measureText(title).width, ...body.map(l => { ctx.font = F(500, FS); return ctx.measureText(l).width; }))) + 20;
        const bh = 14 + 20 + body.length * LH;
        const bx = G.U.clamp(tp.x + tp.w / 2 - bw / 2, 6, w - bw - 6), by = tp.below ? tp.y + tp.h + 8 : tp.y - bh - 32;
        roundRect(ctx, bx, by, bw, bh, 8);
        ctx.fillStyle = 'rgba(8,12,22,.95)'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = tp.col; ctx.stroke();
        ctx.textAlign = 'left';
        ctx.font = F(800, 15); ctx.fillStyle = tp.col;
        ctx.fillText(title, bx + 10, by + 22);
        ctx.font = F(500, FS); ctx.fillStyle = '#dbe6f7';
        body.forEach((l, i) => ctx.fillText(l, bx + 10, by + 42 + i * LH));
      }
    }

    // ---------- pause button (touch) ----------
    if (touch) {
      const sa = G.Touch.safeArea();
      const pp = G.Touch.spot('pause');
      const bx = pp ? G.U.clamp(pp[0] * w - 20, 4, w - 44) : w - 52 - Math.min(44, sa.right);
      const by = pp ? G.U.clamp(pp[1] * h - 20, 10, h - 44) : 12 + Math.min(20, sa.top), bs = 40;
      roundRect(ctx, bx, by, bs, bs, 10);
      ctx.fillStyle = 'rgba(10,16,28,.7)'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(244,248,255,.8)'; ctx.stroke();
      ctx.fillStyle = '#f4f8ff';
      ctx.fillRect(bx + 13, by + 11, 5, 18); ctx.fillRect(bx + 22, by + 11, 5, 18);
      G.Touch.addButton(bx, by, bs, bs, () => G.Game.togglePause(), 8);
    }

    // controls hint
    if (st.time < 14) {
      ctx.font = F(600, 10);
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(180,200,230,.55)';
      ctx.fillText(touch ? 'Drag your finger to move · tap a move to switch'
                         : 'WASD move · 1-4 / Q / E or click a move to switch · drag to reorder · Space burst · Esc pause', w / 2, h - 4);
    }

    ctx.restore();
  }

  // ---------------- co-op ----------------

  /**
   * - Each teammate's health below yours.
   * - An arrow at the edge of the screen towards those you can't see, with their name
   *   and how many metres away they are (red and blinking if they're down).
   * - If you're down: a notice and a "being revived" bar.
   */
  // Player card (you and your teammates): a box with their Pokémon's icon, name,
  // health in numbers and a bar. Drawn already in the HUD's scaled space.
  const CARD_W = 216, CARD_H = 34, CARD_GAP = 6, CARD_IC = 28;
  const portraits = new Map();
  let portraitT = performance.now(), portraitDt = 0;
  function portrait(key, o) {
    let p = portraits.get(key);
    if (!p || p.dex !== o.dex || p.shinyWanted !== !!o.shiny) {
      p = new G.Sprites.Animator(o.dex, 1, !!o.shiny);
      p.shinyWanted = !!o.shiny;
      p.dir = G.Sprites.dirFromAngle(Math.PI / 2);
      p.loop('Idle');
      portraits.set(key, p);
    }
    return p;
  }

  /** Draws Pokémon `o` (facing front, idle) inside an already clipped box (x, y, size). */
  function portraitBox(ctx, key, o, x, y, size) {
    const pt = portrait(key, o);
    pt.update(portraitDt);
    const am = G.Sprites.animMeta(o.dex, 'Idle', pt.shiny);
    pt.scale = Math.min(2, (size - 6) / ((am && am.ay) || 24)) / G.Sprites.PX;
    ctx.save();
    roundRect(ctx, x, y, size, size, 7); ctx.clip();
    pt.draw(ctx, x + size / 2, y + size - 3);
    ctx.restore();
  }

  /** The card's background and frame, from a card theme (Arceus Shop). Classic: the plain dark box. */
  function cardBack(ctx, x, y, th, t) {
    roundRect(ctx, x, y, CARD_W, CARD_H, 8);
    if (!th || !th.id) { ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.fill(); return; }
    const g = ctx.createLinearGradient(x, y, x + CARD_W, y + CARD_H);
    g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
    ctx.fillStyle = g; ctx.fill();
    ctx.save();
    roundRect(ctx, x, y, CARD_W, CARD_H, 8); ctx.clip();
    if (th.stars) {                                      // Cosmic: slow twinkling specks
      for (let i = 0; i < 14; i++) {
        const sx = x + ((i * 53.7) % CARD_W), sy = y + ((i * 19.3) % CARD_H);
        const a = 0.25 + 0.75 * Math.max(0, Math.sin(t * 2.2 + i * 1.7));
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
        ctx.fillRect(Math.round(sx), Math.round(sy), 1.2, 1.2);
      }
    }
    if (th.fx === 'shine') {                             // Gilded: a light sweep every few seconds
      const k = (t % 3.2) / 3.2, bx = x - 60 + k * (CARD_W + 120);
      const sg = ctx.createLinearGradient(bx - 30, y, bx + 30, y + CARD_H);
      sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,248,200,.35)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg; ctx.fillRect(x, y, CARD_W, CARD_H);
    }
    ctx.restore();
    roundRect(ctx, x + 0.75, y + 0.75, CARD_W - 1.5, CARD_H - 1.5, 7.5);
    ctx.lineWidth = 1.5;
    if (th.fx === 'rainbow') {                           // Cosmic: a border that cycles through the colours
      const rg = ctx.createLinearGradient(x, y, x + CARD_W, y);
      for (let i = 0; i <= 4; i++) rg.addColorStop(i / 4, `hsl(${Math.round((t * 60 + i * 90) % 360)},90%,70%)`);
      ctx.strokeStyle = rg;
    } else ctx.strokeStyle = th.border;
    ctx.stroke();
  }

  /** Shop preview: a card with theme `id`, for Pokémon `dex` (redraw it every frame to animate). */
  let pvT = performance.now();
  function cardPreview(cv, id, dex, shiny, name) {
    const ctx = cv.getContext('2d'), th = G.Themes.card(id);
    const now = performance.now();
    portraitDt = Math.min(0.1, (now - pvT) / 1000); pvT = now;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    const k = Math.min(cv.width / (CARD_W + 4), cv.height / (CARD_H + 4));
    ctx.imageSmoothingEnabled = false;
    ctx.scale(k, k);
    ctx.textBaseline = 'alphabetic';
    drawCard(ctx, 2, 2, { key: 'pv:' + (id || 'classic'), pl: { dex, shiny: !!shiny }, name, nameCol: th.name_, color: th.ring,
                          tag: 'Lv. 12', hp: 74, maxHp: 100, dead: false, barCol: th.bar, theme: th });
  }

  /** c = { key, pl, name, nameCol, color, tag?, hp, maxHp, dead, barCol, theme? } */
  function drawCard(ctx, x, y, c) {
    const o = c.pl, t = performance.now() / 1000;
    cardBack(ctx, x, y, c.theme, t);
    // The Pokémon's icon (facing front, in a rounded box)
    const ix = x + 3, iy = y + (CARD_H - CARD_IC) / 2;
    roundRect(ctx, ix, iy, CARD_IC, CARD_IC, 7);
    ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fill();
    ctx.strokeStyle = c.color; ctx.lineWidth = 1.5; ctx.stroke();
    const pt = portrait(c.key, o);
    pt.update(portraitDt);
    const am = G.Sprites.animMeta(o.dex, 'Idle', pt.shiny);
    pt.scale = Math.min(2, (CARD_IC - 6) / ((am && am.ay) || 24)) / G.Sprites.PX;
    ctx.save();
    roundRect(ctx, ix, iy, CARD_IC, CARD_IC, 7); ctx.clip();
    if (c.dead) ctx.globalAlpha = 0.4;
    pt.draw(ctx, ix + CARD_IC / 2, iy + CARD_IC - 3);
    ctx.restore();
    // Gold star if this Pokémon has reached Arceus (yours from your save, teammates' from their shared state).
    const arc = c.key === 'me' ? G.arcCount(G.DB.save, o.dex) : (o.net && o.net.ar) || 0;
    if (arc) {
      G.Icons.draw(ctx, 'star', ix + CARD_IC - 9, iy - 5, 13);
      if (arc > 1) {                                   // how many times they have reached Arceus, bottom-right of the portrait
        ctx.font = F(800, 10); ctx.textAlign = 'right';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText('×' + arc, ix + CARD_IC + 1, iy + CARD_IC + 1);
        ctx.fillStyle = '#ffe27a'; ctx.fillText('×' + arc, ix + CARD_IC + 1, iy + CARD_IC + 1);
        ctx.textAlign = 'left';
      }
    }
    // Name (and level), health and bar
    const tx = x + CARD_IC + 10;
    ctx.textAlign = 'left';
    ctx.font = F(800, 11);
    ctx.fillStyle = c.nameCol;
    ctx.fillText(c.name, tx, y + 14);
    let nw = ctx.measureText(c.name).width;
    // Shiny: the little red star after the name, as in the menu (teammates' too: their shiny comes with the game start).
    if (o.shiny) { G.Icons.draw(ctx, 'shiny', Math.round(tx + nw + 3), y + 4, 12); nw += 15; }
    if (c.tag) {
      ctx.font = F(700, 10);
      ctx.fillStyle = '#ffcb3d';
      ctx.fillText(c.tag, tx + nw + 7, y + 14);
    }
    ctx.textAlign = 'right';
    if (c.dead) {
      ctx.font = F(800, 10);
      ctx.fillStyle = Math.sin(t * 8) > 0 ? '#ff8a96' : '#ffd0d5';
      ctx.fillText('DOWN', x + CARD_W - 8, y + 14);
    } else {
      ctx.font = F(700, 9);
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.fillText(Math.ceil(c.hp) + ' / ' + Math.round(c.maxHp), x + CARD_W - 8, y + 14);
    }
    bar(ctx, tx, y + 19, CARD_W - (tx - x) - 8, 9, c.dead ? 0 : c.hp / c.maxHp, c.barCol);
    ctx.textAlign = 'left';
  }

  function drawCoop(ctx, w, h, pl, px, top) {
    const cam = G.Camera;
    const t = performance.now() / 1000;
    let y = top;
    // List of teammates (on the left, going down): one card per player.
    ctx.save();
    ctx.scale(HUD_SCALE, HUD_SCALE);
    for (const m of G.Coop.mates) {
      if (!m.connected) continue;
      const o = m.pl;
      // Teammates' cards wear their own card theme (their name keeps the team colour and the bar stays green).
      drawCard(ctx, px, y, { key: m.uid, pl: o, name: m.name, nameCol: m.color, color: m.color,
                             hp: o.hp, maxHp: o.maxHp, dead: o.dead, barCol: '#5fe08a', theme: G.Themes.card(o.net && o.net.ct) });
      y += CARD_H + CARD_GAP;
    }
    ctx.restore();

    // Arrows to teammates who are off screen: a round badge with the Pokémon they play, a big arrow and a label.
    for (const m of G.Coop.mates) {
      if (!m.connected) continue;
      const o = m.pl;
      const sx = (o.x - cam.left()) * cam.scale, sy = (o.y - o.bodyH * 0.5 - cam.top()) * cam.scale;
      if (sx > 0 && sx < w && sy > 0 && sy < h) continue;
      const M = 64;
      const ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 70, h - M - 100);
      const a = Math.atan2(sy - ey, sx - ex), ca = Math.cos(a), sa = Math.sin(a);
      const metres = Math.round(G.U.dist(pl.x, pl.y, o.x, o.y) / 32);
      const flash = o.dead && Math.sin(t * 8) > 0;
      const col = o.dead ? (flash ? '#ff5f6d' : '#ffd0d5') : m.color;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.lineJoin = 'round';
      // Badge with the teammate's Pokémon.
      ctx.beginPath(); ctx.arc(0, 0, 27, 0, 6.2832);
      ctx.fillStyle = 'rgba(10,14,28,.92)'; ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.stroke();
      if (G.DEX_BY[o.dex]) {
        ctx.save();
        ctx.beginPath(); ctx.arc(0, 0, 24, 0, 6.2832); ctx.clip();
        portraitBox(ctx, 'mate-arrow:' + m.uid, o, -24, -24, 48);
        ctx.restore();
      } else {
        ctx.font = F(800, 20); ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
        ctx.fillText(m.name.charAt(0).toUpperCase(), 0, 7);
      }
      // Big arrow outside the badge.
      const tri = k => {
        ctx.beginPath();
        ctx.moveTo(ca * 52 * k, sa * 52 * k);
        ctx.lineTo(Math.cos(a + 0.62) * 30 * k, Math.sin(a + 0.62) * 30 * k);
        ctx.lineTo(Math.cos(a - 0.62) * 30 * k, Math.sin(a - 0.62) * 30 * k);
        ctx.closePath();
      };
      tri(1.12); ctx.fillStyle = 'rgba(0,0,0,.85)'; ctx.fill();
      tri(1); ctx.fillStyle = col; ctx.fill();
      // Name and distance, opposite the arrow so it stays on screen.
      const lx = -ca * 36, ly = -sa * 36 + (Math.abs(sa) > 0.6 ? (sa > 0 ? -4 : 14) : 4);
      ctx.font = F(800, 15);
      const label = (o.dead ? m.name + ' needs help! ' : m.name + ' ') + '· ' + metres + ' m';
      ctx.textAlign = ca > 0.3 ? 'right' : ca < -0.3 ? 'left' : 'center';
      ctx.lineWidth = 4.5; ctx.strokeStyle = 'rgba(0,0,0,.88)';
      ctx.strokeText(label, lx, ly);
      ctx.fillStyle = col;
      ctx.fillText(label, lx, ly);
      ctx.restore();
    }

    // You, down.
    if (pl.dead) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = F(800, 20);
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)';
      const msg = G.Coop.players().every(p => p.dead) ? 'Everyone is down…' : 'You\'re down: a teammate can revive you';
      ctx.strokeText(msg, w / 2, h * 0.62);
      ctx.fillStyle = '#ffb0b8';
      ctx.fillText(msg, w / 2, h * 0.62);
      const f = (pl.reviveT || 0) / G.Player.REVIVE_TIME;
      if (f > 0) bar(ctx, w / 2 - 110, h * 0.62 + 12, 220, 10, f, '#5fe08a');
      ctx.restore();
    }

    // Reviving a teammate: a progress bar above you (on top of the ring that fills around them).
    if (!pl.dead && G.Coop.active) {
      let tgt = null;
      for (const p of G.Coop.puppets()) if (p.dead && (p.reviveT || 0) > 0 && G.U.dist2(p.x, p.y, pl.x, pl.y) < 80 * 80) tgt = p;
      if (tgt) {
        const k = G.Camera.scale || 1, cx = (pl.x - G.Camera.left()) * k, cy = (pl.y - G.Camera.top()) * k - ((pl.bodyH || 30) + 30) * k;
        const f = G.U.clamp(tgt.reviveT / G.Player.REVIVE_TIME, 0, 1), bw = 120;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = F(800, 14);
        ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.8)';
        const msg = 'Reviving ' + (tgt.tag || 'teammate') + '… ' + Math.round(f * 100) + '%';
        ctx.strokeText(msg, cx, cy - 6); ctx.fillStyle = '#e6ffee'; ctx.fillText(msg, cx, cy - 6);
        bar(ctx, cx - bw / 2, cy, bw, 11, f, '#5fe08a');
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.8)'; roundRect(ctx, cx - bw / 2, cy, bw, 11, 5.5); ctx.stroke();
        ctx.restore();
      }
    }
  }

  // A move icon dropped on another slot (touch.js, mouse drag): they swap.
  G.Touch.onDrop((a, b) => {
    const pl = G.Game.player;
    if (pl && G.Game.state === 'playing' && pl.swapSlots(a, b)) G.FX.dmgText(pl.x, pl.y - pl.bodyH - 8, 'Slots swapped', '#c8d4ea');
  });

  return { draw, roundRect, bar, portraitBox, cardPreview };
})();
