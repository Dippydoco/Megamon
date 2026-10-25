/* ============ towerhub.js — the Battle Tower's entrance hall ============
 *
 * Every tower run starts here (systems/tower.js opens it as floor "hub"): a castle hall with two doors at the
 * far end, Climb (solo) on the left and Expedition (co-op) on the right. The door for the other mode is locked.
 * Walking through the open door starts the first floor. A red carpet runs from the entrance to the doors.
 *
 * Along the walls stand the statues of the bosses you have beaten (the first clear of each boss floor, from
 * save.tower.firsts): 5th-floor bosses on the left, gatekeepers on the right, lowest section nearest the
 * entrance, Rayquaza by the doors. A boss not beaten yet leaves an empty pedestal with a "?".
 * Statues are the boss's own sprite turned to stone, drawn once into a small canvas when its sheet has loaded.
 *
 * Co-op: the host decides when someone walks through the open door; each computer draws its own player's
 * statues (from their own save).
 */
G.TowerHub = (() => {
  const D = () => G.TowerData;
  const TS = () => G.Tiles.T * G.Sprites.PX;
  const R = 12;                 // the hall's radius in tiles
  const DOOR_W = 74, DOOR_H = 100, ENTER_R = 34;
  const STONE = '#b3aec0';
  let msgT = 0;

  /** The boss floors, in climbing order. */
  const bossFloors = () => { const out = []; for (let n = 5; n <= D().FLOORS; n += 5) out.push(n); return out; };
  const dexAt = n => D().floor(n).dex;
  const beaten = n => { const s = G.DB.save; return !!(s && s.tower && s.tower.firsts && s.tower.firsts[n]); };

  /** Where floor n's statue stands (feet), in world units. */
  function statuePos(fl, n) {
    const ts = TS(), sec = Math.floor((n - 1) / D().SECTION), left = n % D().SECTION === 5;
    return [fl.x + (left ? -1 : 1) * 6.4 * ts, fl.y + (6 - sec * 3) * ts];
  }
  function doors(fl) {
    const ts = TS(), mode = G.Tower.run ? G.Tower.run.mode : 'climb', y = fl.y - 10.1 * ts;     // set into the north wall
    return [
      { id: 'climb', name: 'CLIMB', sub: 'Solo', x: fl.x - 3.2 * ts, y, open: mode === 'climb' },
      { id: 'exp', name: 'EXPEDITION', sub: 'Co-op', x: fl.x + 3.2 * ts, y, open: mode === 'exp' }
    ];
  }
  /** Where players appear: by the entrance, at the south. */
  const spawnY = fl => fl.y + 8.6 * TS();

  function preload() { G.Sprites.preload(bossFloors().filter(beaten).map(dexAt), 8000); }

  // ---------------- every frame ----------------

  /**
   * Every computer: a notice when your Pokémon walks into the locked door.
   * Host / solo: returns true when someone walks through the open one (tower.js then starts the first floor).
   */
  function tick(fl, dt, host) {
    msgT -= dt;
    const pl = G.Game.player, ds = doors(fl);
    for (const d of ds) {
      if (d.open || !pl || pl.dead) continue;
      if (G.U.dist2(pl.x, pl.y, d.x, d.y + 10) < ENTER_R * ENTER_R && msgT <= 0) {
        msgT = 3;
        G.Spawner.say(d.id === 'exp' ? 'Locked: Expeditions start from a friends room' : 'Locked: the Climb is played on your own', 2.4, true);
        G.Audio.sfx('back');
      }
    }
    if (!host) return false;
    const open = ds.find(d => d.open);
    return G.Game.everyone().some(p => !p.dead && G.U.dist2(p.x, p.y, open.x, open.y + 10) < ENTER_R * ENTER_R);
  }

  // ---------------- drawing ----------------

  /** On the ground: the carpet and the glow of the open door. */
  function drawGround(ctx, fl) {
    const ts = TS(), ds = doors(fl), top = ds[0].y + 6, now = performance.now() / 1000;
    ctx.save();
    // Carpet: up the middle from the entrance, then across under both doors.
    const carpet = (x, y, w, h) => {
      ctx.fillStyle = '#7a1f2b'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#d8b25a'; ctx.lineWidth = 3; ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
    };
    ctx.globalAlpha = 0.92;
    carpet(fl.x - 26, top - 20, 52, spawnY(fl) + 30 - top);
    carpet(ds[0].x - 30, top - 26, ds[1].x - ds[0].x + 60, 46);
    // Warm light spilling from the open door.
    const open = ds.find(d => d.open);
    const g = ctx.createRadialGradient(open.x, open.y, 4, open.x, open.y, 120);
    g.addColorStop(0, 'rgba(255,226,140,' + (0.35 + 0.08 * Math.sin(now * 2.4)) + ')'); g.addColorStop(1, 'rgba(255,226,140,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(open.x, open.y + 10, 120, 70, 0, 0, 6.2832); ctx.fill();
    ctx.restore();
  }

  /** Statues and doors, sorted by Y with everyone else (tower.js -> game.js drawScene). */
  function drawables(fl) {
    const out = [];
    for (const n of bossFloors()) {
      const [x, y] = statuePos(fl, n);
      out.push({ y, draw: ctx => drawStatue(ctx, n, x, y) });
    }
    for (const d of doors(fl)) out.push({ y: d.y, draw: ctx => drawDoor(ctx, d, fl) });
    return out;
  }

  function label(ctx, text, x, y, size, col) {
    ctx.font = '800 ' + size + 'px Pixelify, monospace';
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(text, x, y);
    ctx.fillStyle = col; ctx.fillText(text, x, y);
  }

  function drawStatue(ctx, n, x, y) {
    const won = beaten(n), dex = dexAt(n), gate = n % D().SECTION === 0;
    ctx.save();
    // Pedestal: a stone block with a lighter top.
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(x, y + 16, 40, 10, 0, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#4a4458'; ctx.fillRect(x - 34, y - 2, 68, 18);
    ctx.fillStyle = gate ? '#8a7a52' : '#6e6880'; ctx.fillRect(x - 36, y - 8, 72, 8);
    ctx.fillStyle = '#2e2a38'; ctx.fillRect(x - 34, y + 14, 68, 2);
    if (won) {
      const img = statueImg(dex);
      if (img) {
        const k = Math.min(1.2, 74 / img.height);
        ctx.drawImage(img, Math.round(x - img.fx * k), Math.round(y - 6 - img.fy * k), Math.round(img.width * k), Math.round(img.height * k));
      }
    } else {
      label(ctx, '?', x, y - 20, 22, 'rgba(200,196,214,.55)');
    }
    label(ctx, n + 'F' + (won ? ' · ' + ((G.DEX_BY[dex] || {}).name || '') : ''), x, y + 34, 10, won ? (gate ? '#ffe27a' : '#e8e4f4') : '#8a8698');
    ctx.restore();
  }

  function drawDoor(ctx, d, fl) {
    const x = d.x, y = d.y, w = DOOR_W, h = DOOR_H, now = performance.now() / 1000;
    ctx.save();
    // Stone frame with a round arch.
    const arch = (inset) => {
      const ww = w - inset * 2, r = ww / 2;
      ctx.beginPath();
      ctx.moveTo(x - r, y);
      ctx.lineTo(x - r, y - h + r + inset);
      ctx.arc(x, y - h + r + inset, r, Math.PI, 0);
      ctx.lineTo(x + r, y);
      ctx.closePath();
    };
    ctx.fillStyle = '#3a3446'; arch(-8); ctx.fill();
    ctx.fillStyle = '#6e6880'; arch(-4); ctx.fill();
    // Inside: warm light if it's open, dark with bars if locked.
    if (d.open) {
      const g = ctx.createLinearGradient(0, y - h, 0, y);
      g.addColorStop(0, '#fff3c8'); g.addColorStop(1, '#d8a64a');
      ctx.fillStyle = g; arch(4); ctx.fill();
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(now * 3);
      ctx.fillStyle = '#ffffff'; arch(10); ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#14101c'; arch(4); ctx.fill();
      ctx.strokeStyle = '#8a8698'; ctx.lineWidth = 4;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x + i * 12, y - h + 18); ctx.lineTo(x + i * 12, y); ctx.stroke(); }
      G.Icons.draw(ctx, 'ban', x - 12, y - h / 2 - 12, 24);
    }
    // Name over the arch, and what it leads to.
    label(ctx, d.name, x, y - h - 14, 13, d.open ? '#ffe27a' : '#8a8698');
    const run = G.Tower.run;
    label(ctx, d.open ? d.sub + ' · from ' + (run ? run.start : 1) + 'F' : d.sub + ' · locked', x, y + 18, 10, d.open ? '#fff1cf' : '#8a8698');
    ctx.restore();
  }

  // ---- statues: the boss's Idle frame turned to stone, cached once its sheet has loaded ----
  const cache = new Map();
  function statueImg(dex) {
    if (cache.has(dex)) return cache.get(dex);
    const sh = G.Sprites.sheet(dex, 'Idle', false), m = G.Sprites.animMeta(dex, 'Idle', false);
    if (!sh || !sh.ready || !m) { G.Sprites.preload([dex], 4000); return null; }
    const P = G.Sprites.PX, cv = document.createElement('canvas');
    cv.width = m.w * P; cv.height = m.h * P;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    if ('filter' in c) c.filter = 'grayscale(1) contrast(1.1)';
    c.drawImage(sh.img, 0, 0, m.w, m.h, 0, 0, m.w * P, m.h * P);       // first frame, facing down
    c.filter = 'none';
    c.globalCompositeOperation = 'source-atop';
    c.globalAlpha = 'filter' in c ? 0.35 : 0.7;
    c.fillStyle = STONE; c.fillRect(0, 0, cv.width, cv.height);
    cv.fx = m.ax * P; cv.fy = m.ay * P;                                // where its feet are
    cache.set(dex, cv);
    return cv;
  }

  /** What the HUD shows in the hall. */
  function hud(run) {
    return { big: 'BATTLE TOWER', place: 'ENTRANCE HALL', mode: run.mode === 'exp' ? 'EXPEDITION' : 'CLIMB',
             goal: 'WALK THROUGH THE ' + (run.mode === 'exp' ? 'EXPEDITION' : 'CLIMB') + ' DOOR · STARTS AT ' + run.start + 'F', col: '#ffe27a', bp: run.bp };
  }

  return { R, tick, drawGround, drawables, preload, spawnY, hud,
           get statues() { return bossFloors().filter(beaten).length; } };
})();
