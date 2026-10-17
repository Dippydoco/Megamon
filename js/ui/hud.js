/* ============ hud.js — interfaz dentro del canvas ============
 * Se dibuja en coordenadas de PANTALLA (sin la transformación de cámara).
 */
G.HUD = (() => {
  let HUD_SCALE = 1.55;       // tamaño del bloque de arriba a la izquierda (vida, compañeros, buffs)
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

  function draw(ctx, w, h, pl, st) {
    HUD_SCALE = w < 640 ? 1.2 : w < 1000 ? 1.4 : 1.55;      // en pantallas estrechas, menos para no tapar el reloj
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    G.Touch.clearButtons();
    const touch = G.Touch.active;

    // ---------- barra de experiencia (borde superior) ----------
    const xpF = pl.xp / pl.xpNext;
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(0, 0, w, 7);
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#4fd1ff'); g.addColorStop(1, '#a98bff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w * G.U.clamp(xpF, 0, 1), 7);

    // ---------- vida + nivel + buffs (arriba a la izquierda, a escala HUD_SCALE) ----------
    const px = 16, py = 20;
    portraitDt = Math.min(0.1, (performance.now() - portraitT) / 1000);
    portraitT = performance.now();
    ctx.save();
    ctx.scale(HUD_SCALE, HUD_SCALE);
    // Tu tarjeta: igual que las de los compañeros (icono de tu Pokémon, nombre, vida), con el nivel.
    drawCard(ctx, px, py, {
      key: 'me', pl, name: pl.mon.name, nameCol: '#eaf2ff', color: '#ffcb3d', tag: 'Lv. ' + pl.level,
      hp: pl.hp, maxHp: pl.maxHp, dead: pl.dead, barCol: '#ff5f6d'
    });

    // Buffs activos y poder de altar: píldoras con icono + texto. Si no caben en
    // una fila (hasta el final de la barra de vida) pasan a la siguiente, sin solaparse.
    const COL = { atk: '#ff6b4d', spd: '#7fe0ff', def: '#b0b8c8', regen: '#5fe08a' };
    const LBL = { atk: 'ATK', spd: 'SPD', def: 'DEF', regen: 'REGEN' };
    const ICO = { atk: 'fist', spd: 'boot', def: 'shield', regen: 'sprout' };
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

    // ---------- reloj / bioma / kills ----------
    ctx.textAlign = 'center';
    ctx.font = F(800, 26);
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.fillText(G.U.mmss(st.time), w / 2, 42);
    ctx.font = F(600, 10);
    ctx.fillStyle = '#8fa3c4';
    ctx.fillText(G.World.biomeName().toUpperCase() + '  ·  ' + pl.kills + ' DERROTADOS  ·  ' + pl.coins + ' MONEDAS', w / 2, 58);

    // ---------- clima (arriba a la derecha) ----------
    const wx = G.Weather.current;
    if (wx) {
      ctx.font = F(800, 11);
      ctx.textAlign = 'left';
      const txt = wx.name.toUpperCase() + ' · ' + Math.ceil(wx.left) + 's';
      const tw = ctx.measureText(txt).width + 40;
      const x0 = w - tw - 16 - (touch ? 56 : 0), y0 = 14;
      roundRect(ctx, x0, y0, tw, 26, 9);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill();
      G.Icons.draw(ctx, wx.icon, x0 + 6, y0 + 3, 20);
      ctx.fillStyle = wx.color;
      ctx.fillText(txt, x0 + 32, y0 + 17);
    }

    // ---------- barra del jefe (arriba en el centro): icono, nombre grande y vida ----------
    const boss = G.EnemyMgr.all().find(e => e.boss && !e.dead);
    if (boss) {
      const bw = Math.min(480, w - 190), bx0 = (w - bw) / 2, IS = 48, by = 64;
      const pulseB = 0.5 + 0.5 * Math.sin(performance.now() / 300);
      // Icono del jefe
      roundRect(ctx, bx0 - IS - 10, by, IS, IS, 9);
      ctx.fillStyle = 'rgba(40,10,10,.75)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,203,61,' + (0.6 + 0.4 * pulseB) + ')'; ctx.lineWidth = 2.5; ctx.stroke();
      portraitBox(ctx, 'boss-hud', boss, bx0 - IS - 10, by, IS);
      // Nombre y porcentaje
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

    // ---------- flechas a los jefes que no se ven (en el borde de la pantalla) ----------
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
        // Círculo con el icono del jefe
        ctx.beginPath(); ctx.arc(0, 0, 25, 0, 6.2832);
        ctx.fillStyle = 'rgba(30,8,8,.85)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,203,61,' + (0.65 + 0.35 * beat) + ')'; ctx.lineWidth = 3; ctx.stroke();
        ctx.save();
        ctx.beginPath(); ctx.arc(0, 0, 23, 0, 6.2832); ctx.clip();
        portraitBox(ctx, 'boss-arrow-' + e.id, e, -23, -23, 46);
        ctx.restore();
        // Flecha grande hacia el jefe, por fuera del círculo
        ctx.fillStyle = 'rgba(255,90,70,' + (0.8 + 0.2 * beat) + ')';
        ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 48, Math.sin(a) * 48);
        ctx.lineTo(Math.cos(a + 0.6) * 28, Math.sin(a + 0.6) * 28);
        ctx.lineTo(Math.cos(a - 0.6) * 28, Math.sin(a - 0.6) * 28);
        ctx.closePath(); ctx.stroke(); ctx.fill();
        // Nombre y distancia, al lado contrario de la flecha para que no se salga
        ctx.font = F(800, 12);
        const ca = Math.cos(a), sa = Math.sin(a);
        ctx.textAlign = ca > 0.3 ? 'right' : ca < -0.3 ? 'left' : 'center';
        const lx = -ca * 34, ly = -sa * 34 + (Math.abs(sa) > 0.6 ? (sa > 0 ? -4 : 14) : 4);
        const lbl = e.name.toUpperCase() + ' · ' + metres + ' m';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)';
        ctx.strokeText(lbl, lx, ly); ctx.fillStyle = '#ffe08a'; ctx.fillText(lbl, lx, ly);
        ctx.restore();
      }
    }

    // ---------- espectador: caído en grupo, miras a un compañero ----------
    const spec = G.Game.spectating;
    if (spec) {
      const cx = w / 2, cy = h - 130, bs = 40;
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
        // Botones ◀ ▶ (ratón o toque)
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

    // ---------- aviso ----------
    // ---------- shinies fuera de pantalla: destello en el borde ----------
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

    // Grieta: flecha grande que late en el borde si no se ve, y si se ve, una
    // flecha que bota encima; en la arena, cuenta atrás.
    const rift = G.Rift.rift;
    if (rift) {
      const sx = (rift.x - cam.left()) * cam.scale, sy = (rift.y - 40 - cam.top()) * cam.scale;
      const now = performance.now() / 1000, beat = 0.5 + Math.sin(now * 7) * 0.5;
      const label = 'GRIETA · ' + Math.round(G.U.dist(pl.x, pl.y, rift.x, rift.y) / 32) + ' m · ' + Math.ceil(rift.ttl) + ' s';
      const off = sx < 0 || sx > w || sy < 0 || sy > h;
      ctx.save();
      if (off) {
        const M = 52, ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 70, h - M - 80);
        const a = Math.atan2(sy - ey, sx - ex), ca = Math.cos(a), sa = Math.sin(a);
        ctx.translate(ex, ey);
        // Halo que late.
        ctx.globalAlpha = 0.18 + beat * 0.22;
        ctx.fillStyle = '#b48aff';
        ctx.beginPath(); ctx.arc(0, 0, 30 + beat * 8, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 1;
        const tri = (k) => {
          ctx.beginPath();
          ctx.moveTo(ca * 40 * k, sa * 40 * k);
          ctx.lineTo(Math.cos(a + 2.45) * 20 * k, Math.sin(a + 2.45) * 20 * k);
          ctx.lineTo(Math.cos(a - 2.45) * 20 * k, Math.sin(a - 2.45) * 20 * k);
          ctx.closePath();
        };
        tri(1.12); ctx.fillStyle = '#1a0b33'; ctx.fill();
        tri(1); ctx.fillStyle = beat > 0.5 ? '#e2d0ff' : '#a06bff'; ctx.fill();
        ctx.font = F(800, 12);
        ctx.textAlign = ca > 0.3 ? 'right' : ca < -0.3 ? 'left' : 'center';
        const lx = -ca * 34, ly = -sa * 30 + 4;
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)';
        ctx.strokeText(label, lx, ly);
        ctx.fillStyle = '#e2d0ff';
        ctx.fillText(label, lx, ly);
      } else {
        // Encima de la grieta: flecha hacia abajo que bota.
        const by = sy - 46 - Math.abs(Math.sin(now * 4)) * 10;
        ctx.translate(sx, by);
        ctx.beginPath(); ctx.moveTo(-15, -12); ctx.lineTo(15, -12); ctx.lineTo(0, 8); ctx.closePath();
        ctx.lineWidth = 4; ctx.strokeStyle = '#1a0b33'; ctx.stroke();
        ctx.fillStyle = beat > 0.5 ? '#e2d0ff' : '#a06bff'; ctx.fill();
        ctx.font = F(800, 11); ctx.textAlign = 'center';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)';
        const l2 = 'GRIETA · ' + Math.ceil(rift.ttl) + ' s';
        ctx.strokeText(l2, 0, -18); ctx.fillStyle = '#e2d0ff'; ctx.fillText(l2, 0, -18);
      }
      ctx.restore();
    }
    if (G.Rift.inArena) {
      ctx.textAlign = 'center';
      ctx.font = F(800, 12);
      ctx.fillStyle = '#d9c2ff';
      ctx.fillText('GRIETA · ' + G.U.mmss(G.Rift.timeLeft), w / 2, boss ? 130 : 76);
    }

    // Eventos: cuenta atrás, flecha al Pokémon perdido / a la marca y a los duendes.
    G.Events.drawHud(ctx, w, h, pl, F);

    // Aviso propio al abrirse una grieta (no lo tapan los otros avisos).
    if (rift && rift.t < 4.5) {
      const a = Math.min(1, rift.t * 4, (4.5 - rift.t) * 2), pop = 1 + Math.max(0, 0.25 - rift.t) * 1.6;
      const y0 = h * 0.2;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(w / 2, y0); ctx.scale(pop, pop);
      ctx.font = F(800, 20);
      const t1 = '¡SE HA ABIERTO UNA GRIETA!', t2 = 'Sigue la flecha morada: dentro te espera un legendario';
      const bw = Math.min(w - 24, Math.max(ctx.measureText(t1).width, (ctx.font = F(700, 11), ctx.measureText(t2).width)) + 36);
      roundRect(ctx, -bw / 2, -26, bw, 52, 10);
      ctx.fillStyle = 'rgba(26,11,51,.88)'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#b48aff'; ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = F(800, 20); ctx.fillStyle = '#e2d0ff'; ctx.fillText(t1, 0, -2);
      ctx.font = F(700, 11); ctx.fillStyle = '#c9b0ff'; ctx.fillText(t2, 0, 16);
      ctx.restore();
    }

    // Grupo: alguien está eligiendo vínculo u objeto y la partida está parada para todos.
    const choosers = G.Coop.active ? G.Game.waitingChoosers : [];
    if (choosers.length) {
      const names = choosers.length > 2 ? choosers.slice(0, 2).join(', ') + ' +' + (choosers.length - 2) : choosers.join(' & ');
      const txt = names + (choosers.length > 1 ? ' are choosing…' : ' is choosing…');
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
      ctx.save();
      ctx.globalAlpha = a;
      // Siempre centrado (antes heredaba la alineación de lo último dibujado, p.
      // ej. la flecha de un duende del tesoro, y salía descolocado).
      ctx.textAlign = 'center';
      ctx.font = F(800, 22);
      ctx.fillStyle = '#ffcb3d';
      ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 4;
      ctx.strokeText(ban.text, w / 2, h * 0.3);
      ctx.fillText(ban.text, w / 2, h * 0.3);
      ctx.restore();
    }

    // ---------- ranura de movimientos ----------
    const S = w < 640 ? 54 : 66, GAP = w < 640 ? 9 : 11, K = S / 54;      // bigger on wider screens
    const n = Math.max(1, pl.slots.length);
    const totalW = n * S + (n - 1) * GAP;
    let sx = (w - totalW) / 2;
    // Por encima de la barra de inicio del iPhone (allí los toques a veces no llegan).
    let sy = h - S - 18 - (touch ? Math.min(28, G.Touch.safeArea().bottom) : 0);
    // En móvil, donde la haya puesto el jugador: el bloque objeto + todos los
    // huecos (aunque aún no estén llenos), por su centro, como en el editor
    // (layout-ui.js); los ataques nuevos van saliendo hacia la derecha.
    const pb = touch && G.Touch.spot('bar');
    if (pb) {
      const nAll = Math.max(n, pl.maxMoves), bw = S + 18 + nAll * S + (nAll - 1) * GAP;
      sx = G.U.clamp(pb[0] * w - bw / 2, 6, Math.max(6, w - bw - 6)) + S + 18;
      sy = G.U.clamp(pb[1] * h - S / 2, 24, h - S - 6);
    }
    const BOND = '#ff8ad8';
    const tips = [];            // hover tooltips for moves and the held item
    const cdOf = m => m.kind === 'orbit' ? 0 : G.U.clamp(m.t / (m.cd * pl.cdMul), 0, 1);

    for (let i = 0; i < n; i++) {
      const g = pl.slots[i] || [];
      const m = g[0];
      const fused = g.length > 1;
      const on = i === pl.active;
      const x = sx + i * (S + GAP);
      const y = on ? sy - 6 : sy;
      // Tocar (o hacer clic en) un icono activa ese movimiento.
      if (m) G.Touch.addButton(x, y, S, S, () => { if (G.Game.state === 'playing' && pl.active !== i) { pl.setActive(i); G.Audio.sfx('click'); } }, GAP / 2 + 3);
      const col = m ? G.U.TYPE_COLOR[m.type] : '#4a5468';

      // fondo
      roundRect(ctx, x, y, S, S, 12);
      ctx.fillStyle = on ? 'rgba(20,30,50,.95)' : 'rgba(10,16,28,.8)';
      ctx.fill();
      ctx.lineWidth = on ? 2.5 : fused || (m && m.evolved) ? 2 : 1.2;
      // Vínculo: borde rosa. Evolucionado: dorado.
      ctx.strokeStyle = fused ? BOND : m && m.evolved ? '#ffd23f' : on ? col : 'rgba(140,170,210,.22)';
      ctx.stroke();

      if (!m) continue;
      tips.push({ x, y, w: S, h: S, title: fused ? m.name + ' +' + (g.length - 1) : m.name, col: fused ? BOND : col,
                  lines: g.map(gm => (fused ? gm.name + ': ' : '') + (gm.def.desc || '') + (gm.lvl ? ' (Lv. ' + gm.lvl + '/' + gm.def.maxLvl + ')' : '')) });

      if (fused) {
        // Vínculo: los movimientos en una cuadrícula de 2×2, cada uno con su recarga.
        const C = Math.round(22 * K), P = (S - C * 2) / 3;
        g.forEach((gm, k) => {
          const cx = x + P + (k % 2) * (C + P), cy = y + P + Math.floor(k / 2) * (C + P);
          G.Icons.draw(ctx, 'move:' + gm.id, cx, cy, C);
          const f = cdOf(gm);
          if (f > 0) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(cx, cy, C, C * f); }
          if (gm.evolved) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1; ctx.strokeRect(cx + 0.5, cy + 0.5, C - 1, C - 1); }
          // Destello al lanzarse.
          const fl = 1 - (performance.now() - (gm.castAt || 0)) / 180;
          if (fl > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (fl * 0.55).toFixed(2) + ')'; ctx.fillRect(cx, cy, C, C); }
        });
      } else {
        // recarga: se vacía de abajo a arriba
        const cdFrac = cdOf(m);
        if (cdFrac > 0) {
          ctx.save();
          roundRect(ctx, x, y, S, S, 12); ctx.clip();
          ctx.fillStyle = 'rgba(0,0,0,.6)';
          ctx.fillRect(x, y, S, S * cdFrac);
          ctx.restore();
        }

        // emblema del tipo + insignia de la familia
        G.Icons.draw(ctx, 'move:' + m.id, x + (S - 32 * K) / 2, y + (S - 32 * K) / 2 - 2, 32 * K);

        // nivel del movimiento (puntitos)
        const dots = m.def.maxLvl;
        const dw = Math.round(4 * K), dgap = 2;
        const tw = dots * dw + (dots - 1) * dgap;
        for (let d = 0; d < dots; d++) {
          ctx.fillStyle = d < m.lvl ? col : 'rgba(255,255,255,.18)';
          ctx.fillRect(x + (S - tw) / 2 + d * (dw + dgap), y + S - 9 * K, dw, 3);
        }
      }

      // tecla
      ctx.font = F(800, Math.round(11 * K));
      ctx.fillStyle = fused ? BOND : on ? col : 'rgba(200,215,240,.85)';
      ctx.textAlign = 'left';
      ctx.fillText(String(i + 1), x + 4, y + 12 * K);

      // nombre encima del activo (con un vínculo: "Ascuas +2")
      if (on) {
        ctx.font = F(800, Math.round(13 * K));
        ctx.textAlign = 'center';
        const nm = fused ? m.name + ' +' + (g.length - 1) : m.name;
        ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)';
        ctx.strokeText(nm, x + S / 2, y - 8);
        ctx.fillStyle = '#fff';
        ctx.fillText(nm, x + S / 2, y - 8);
      }
    }

    // ---------- vínculo guardado (aún no hay dos movimientos sueltos) ----------
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

    // ---------- objeto equipado (a la izquierda de los movimientos) ----------
    {
      const ix = sx - S - 18, iy = sy;
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
        ctx.strokeText(G.Items.BY[pl.item].name, ix + S / 2, iy - 8);
        ctx.fillStyle = '#ffd23f';
        ctx.fillText(G.Items.BY[pl.item].name, ix + S / 2, iy - 8);
        tips.push({ x: ix, y: iy, w: S, h: S, title: G.Items.BY[pl.item].name, col: '#ffd23f', lines: [G.Items.BY[pl.item].desc] });
      }
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
        const bx = G.U.clamp(tp.x + tp.w / 2 - bw / 2, 6, w - bw - 6), by = tp.y - bh - 32;
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

    // ---------- botón de pausa (táctil) ----------
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

    // pista de controles
    if (st.time < 14) {
      ctx.font = F(600, 10);
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(180,200,230,.55)';
      ctx.fillText(touch ? 'Arrastra el dedo para moverte  ·  toca un ataque para cambiarlo'
                         : 'WASD moverse  ·  1-4 / Q / E o clic en un ataque para cambiarlo  ·  Esc pausa', w / 2, h - 4);
    }

    ctx.restore();
  }

  // ---------------- cooperativo ----------------

  /**
   * - Vida de cada compañero debajo de la tuya.
   * - Flecha en el borde de la pantalla hacia los que no se ven, con su nombre
   *   y a cuántos metros están (roja y parpadeando si está caído).
   * - Si has caído tú: aviso y barra de "te están levantando".
   */
  // Tarjeta de jugador (tú y tus compañeros): recuadro con el icono de su Pokémon, nombre,
  // vida en números y barra. Se dibuja ya en el espacio escalado del HUD.
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

  /** Dibuja el Pokémon `o` (de frente, en reposo) dentro de un recuadro (x, y, size) ya recortado. */
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

  /** c = { key, pl, name, nameCol, color, tag?, hp, maxHp, dead, barCol } */
  function drawCard(ctx, x, y, c) {
    const o = c.pl, t = performance.now() / 1000;
    roundRect(ctx, x, y, CARD_W, CARD_H, 8);
    ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.fill();
    // Icono del Pokémon (de frente, en un recuadro redondeado)
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
    // Gold star on your own portrait if this Pokémon has reached Arceus.
    if (c.key === 'me' && G.DB.save.arceus && G.DB.save.arceus[o.dex]) G.Icons.draw(ctx, 'star', ix + CARD_IC - 9, iy - 5, 13);
    // Nombre (y nivel), vida y barra
    const tx = x + CARD_IC + 10;
    ctx.textAlign = 'left';
    ctx.font = F(800, 11);
    ctx.fillStyle = c.nameCol;
    ctx.fillText(c.name, tx, y + 14);
    if (c.tag) {
      const nw = ctx.measureText(c.name).width;
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
    // Lista de compañeros (a la izquierda, hacia abajo): una tarjeta por jugador.
    ctx.save();
    ctx.scale(HUD_SCALE, HUD_SCALE);
    for (const m of G.Coop.mates) {
      if (!m.connected) continue;
      const o = m.pl;
      drawCard(ctx, px, y, { key: m.uid, pl: o, name: m.name, nameCol: m.color, color: m.color,
                             hp: o.hp, maxHp: o.maxHp, dead: o.dead, barCol: '#5fe08a' });
      y += CARD_H + CARD_GAP;
    }
    ctx.restore();

    // Flechas hacia los compañeros fuera de la vista.
    for (const m of G.Coop.mates) {
      if (!m.connected) continue;
      const o = m.pl;
      const sx = (o.x - cam.left()) * cam.scale, sy = (o.y - o.bodyH * 0.5 - cam.top()) * cam.scale;
      if (sx > 0 && sx < w && sy > 0 && sy < h) continue;
      const M = 42;
      const ex = G.U.clamp(sx, M, w - M), ey = G.U.clamp(sy, M + 70, h - M - 80);
      const a = Math.atan2(sy - ey, sx - ex);
      const metres = Math.round(G.U.dist(pl.x, pl.y, o.x, o.y) / 32);
      const col = o.dead ? (Math.sin(t * 8) > 0 ? '#ff5f6d' : '#ffd0d5') : m.color;
      ctx.save();
      ctx.translate(ex, ey);
      // Flecha
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, 6.2832); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 28, Math.sin(a) * 28);
      ctx.lineTo(Math.cos(a + 2.4) * 14, Math.sin(a + 2.4) * 14);
      ctx.lineTo(Math.cos(a - 2.4) * 14, Math.sin(a - 2.4) * 14);
      ctx.closePath(); ctx.fill();
      // Inicial del compañero dentro del círculo
      ctx.font = F(800, 14);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(m.name.charAt(0).toUpperCase(), 0, 5);
      // Nombre y distancia: al lado contrario de la flecha, para que no se salga
      const lx = -Math.cos(a) * 30, ly = -Math.sin(a) * 26 + 4;
      ctx.font = F(800, 12);
      const label = (o.dead ? '¡' + m.name + ' necesita ayuda! ' : m.name + ' ') + '· ' + metres + ' m';
      ctx.textAlign = Math.cos(a) > 0.3 ? 'right' : Math.cos(a) < -0.3 ? 'left' : 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)';
      ctx.strokeText(label, lx, ly);
      ctx.fillStyle = col;
      ctx.fillText(label, lx, ly);
      ctx.restore();
    }

    // Tú, caído.
    if (pl.dead) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = F(800, 20);
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)';
      const msg = G.Coop.players().every(p => p.dead) ? 'Habéis caído todos…' : 'Has caído: un compañero puede levantarte';
      ctx.strokeText(msg, w / 2, h * 0.62);
      ctx.fillStyle = '#ffb0b8';
      ctx.fillText(msg, w / 2, h * 0.62);
      const f = (pl.reviveT || 0) / G.Player.REVIVE_TIME;
      if (f > 0) bar(ctx, w / 2 - 110, h * 0.62 + 12, 220, 10, f, '#5fe08a');
      ctx.restore();
    }
  }

  return { draw, roundRect, bar };
})();
