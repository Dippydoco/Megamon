/* ============ lab-ui.js — Balance Lab (developer tool) ============
 * Open the game with ?dev&lab in the address (e.g. dippydoco.github.io/Megamon/?dev&lab).
 * Instead of the menu you get a test bench on top of a real run:
 *   pick moves, levels (1-5 and evolved), a Pokémon, upgrades, an item and a scenario
 *   (one big target, a boss, a crowd, a swarm), and it runs each combination against
 *   training dummies with the REAL game engine, then shows a sortable table:
 *   damage per second, kills, hits, critical %, healing, enemy-seconds frozen / stunned /
 *   weakened. Download it as a CSV for a spreadsheet.
 *
 * Nothing here can touch real players or saves:
 *   - it uses a throwaway save in memory (G.DB.labSave: never written anywhere)
 *   - the run is marked as tampered (never sent to the leaderboard) and is never ended,
 *     so no history, coins or progress are recorded; leaving the lab reloads the page
 *   - it only exists with ?dev&lab; nobody sees it otherwise
 *
 * How a test works: the run is stepped by hand (G.Game.labStep, fixed 1/60 s steps) as fast
 * as the computer allows, with the normal clock stopped. The dummies have no type, so every
 * move hits for neutral damage; they deal no damage, and the player stands still in an
 * open clearing so walls and trees don't get in the way.
 */
G.LabUI = (() => {
  const DT = 1 / 60;
  const ORDER = ['normal', 'fire', 'water', 'grass', 'electric', 'psychic', 'poison', 'ground', 'flying', 'bug',
                 'rock', 'ice', 'fighting', 'ghost', 'dragon', 'fairy', 'steel', 'dark'];
  // Upgrades you can stack before a test (the level-up ones that change damage).
  const UPS = ['atk', 'cd', 'area', 'crit'];
  const SCENARIOS = {
    // (The single targets walk up to you like real enemies, so melee, orbits and mines reach them too.)
    single: { label: 'Single target (tough dummy)', count: 1, hp: 1e7, spd: 30, dist: 110, respawn: false },
    boss:   { label: 'Boss (can\'t be frozen, stunned or pushed)', count: 1, hp: 1e7, spd: 25, dist: 130, respawn: false, boss: true },
    crowd:  { label: 'Crowd (12 enemies, 150 HP, respawning)', count: 12, hp: 150, spd: 35, dist: 200, respawn: true },
    swarm:  { label: 'Swarm (30 enemies, 60 HP, respawning)', count: 30, hp: 60, spd: 45, dist: 230, respawn: true }
  };
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const r1 = n => Math.round(n * 10) / 10;

  let root = null, running = false, stopFlag = false, results = [], sortKey = 'dps', sortDir = -1, runNo = 0;
  const cfg = { mon: 151, moves: new Set(), levels: new Set([1, 5]), evo: true, scen: 'single', count: 1, hp: 1e7, spd: 0,
                dur: 20, ups: { atk: 0, cd: 0, area: 0, crit: 0 }, item: '', watch: false };

  function wanted() { return /[?&]dev\b/.test(location.search) && /[?&]lab\b/.test(location.search); }

  // ---------------- setting up the run ----------------

  // Counters filled in while a test runs (by the hooks below).
  const tally = { on: false, dmg: 0, hits: 0, crits: 0 };
  function hookOnce() {
    if (hookOnce.done) return;
    hookOnce.done = true;
    const E = G.Enemy.prototype, hurt = E.hurt, show = E.showHurt;
    E.hurt = function (...a) {
      const before = this.hp, wasDead = this.dead;
      hurt.apply(this, a);
      if (tally.on && !wasDead) tally.dmg += Math.max(0, Math.min(before, before - this.hp));
    };
    E.showHurt = function (d, color, dx, dy, eff) {
      // (Burn and poison ticks are damage, but not hits.)
      if (tally.on && color !== '#ff9a4d' && color !== '#d47cf0') { tally.hits++; if (eff === 'crit') tally.crits++; }
      return show.apply(this, arguments);
    };
  }

  /** Quietens everything that isn't the test: spawns, events, weather, rifts, level-ups, drops. */
  function sandbox() {
    G.Spawner.update = () => {};
    G.Events.update = () => {};
    G.Rift.update = () => {};
    G.Judgment.update = () => {};
    G.Weather.update = () => {};
    G.Weather.mult = () => 1;
    G.Weather.speedFor = () => 1;
    G.Interact.update = () => {};
    G.Hazards.update = () => {};
    G.Pickups.dropXp = () => {};
    G.Pickups.drop = () => {};
    const pl = G.Game.player;
    pl.hurt = () => {};
    pl.gainXp = () => 0;
    pl.invuln = 1e9;
  }

  /** Moves the player to an open spot: no walls, water or scenery within 330 px. */
  function clearing() {
    const pl = G.Game.player, R = 330;
    const ok = (x, y) => {
      if (G.World.propsInCircle(x, y, R).length) return false;
      for (let a = 0; a < 6.283; a += 0.4) for (const d of [60, 160, 260, R]) {
        const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
        if (G.World.isWall(px, py) || G.World.isLiquid(px, py)) return false;
      }
      return true;
    };
    if (ok(pl.x, pl.y)) return true;
    for (let i = 0; i < 1500; i++) {
      const a = Math.random() * 6.283, d = 200 + Math.random() * 4000;
      const x = pl.x + Math.cos(a) * d, y = pl.y + Math.sin(a) * d;
      if (ok(x, y)) { pl.x = x; pl.y = y; G.Camera.follow(x, y, 10); return true; }
    }
    return false;
  }

  /** Swaps the Pokémon in place (its attack stat is what scales damage). */
  function setMon(dex) {
    const pl = G.Game.player, mon = G.DEX_BY[dex];
    if (!mon || pl.dex === dex) return;
    G.Sprites.preload([dex]);
    pl.mon = mon; pl.dex = dex;
    pl.baseAtk = mon.atk; pl.baseSpd = mon.spd;
    pl.anim = new G.Sprites.Animator(dex, 1, false);
    pl.r = G.Sprites.bodyRadius(dex); pl.bodyH = G.Sprites.bodyHeight(dex);
  }

  /** A clean player for one test: base stats, the upgrades and item chosen, and only `id` at `lvl`. */
  function prepPlayer(id, lvl, evo) {
    const pl = G.Game.player;
    if (pl.item) pl.equip('');
    pl.atkMul = 1; pl.cdMul = 1; pl.critChance = 0; pl.areaMul = 1; pl.dmgReduce = 0; pl.regenFlat = 0;
    pl.statsTaken = {};
    for (const k in pl.buffs) pl.buffs[k].n = 0;
    pl.slowT = 0; pl.protectT = 0; pl.drainHeal = 0; pl.bellHeal = 0;
    for (const s of UPS) {
      const st = G.LevelUp.STATS.find(x => x.id === s);
      for (let i = 0; i < (cfg.ups[s] | 0); i++) st.apply(pl);
    }
    if (cfg.item) pl.equip(cfg.item);
    G.Projectiles.clear(); G.Combat.clearFields();
    pl.moves = []; pl.slots = []; pl.active = 0;
    pl.addMove(id);
    const m = pl.moves[0];
    while (m.lvl < lvl && G.Moves.levelUp(m));
    if (evo) G.Moves.evolve(m);
    m.t = 0;
    pl.hp = pl.maxHp * 0.5;
    return m;
  }

  function dummy(sc, x, y) {
    const def = { dex: sc.boss ? 143 : 19, name: 'Dummy', behavior: 'chase', hp: cfg.hp, spd: cfg.spd, dmg: 0, xp: 0 };
    const e = new G.Enemy(def, x, y, { hp: 1, spd: 1, dmg: 1 }, !!sc.boss);
    e.types = ['lab']; e.atkType = 'normal';           // no type: every move is neutral against it
    e.dmg = 0;
    if (sc.boss) e.bossMove = () => [0, 0, 'Idle'];    // a boss that just stands there
    G.EnemyMgr.add(e);
    return e;
  }

  function spawnAround(sc, n) {
    const pl = G.Game.player, out = [];
    for (let i = 0; i < n; i++) {
      const a = n === 1 ? 0 : i / n * 6.283 + Math.random() * 0.3;
      const d = n === 1 ? sc.dist : sc.dist * (0.7 + Math.random() * 0.5);
      out.push(dummy(sc, pl.x + Math.cos(a) * d, pl.y + Math.sin(a) * d * 0.8));
    }
    return out;
  }

  // ---------------- one test ----------------

  async function runOne(id, lvl, evo) {
    const pl = G.Game.player, sc = SCENARIOS[cfg.scen];
    G.EnemyMgr.clear();
    G.Game.debugTime(60);                       // early-game clock (and no biome or Arceus surprises)
    const m = prepPlayer(id, lvl, evo);
    let es = spawnAround(sc, cfg.count);
    const steps = Math.round(cfg.dur / DT), base = pl.hp;
    let kills = 0, heal = 0, frozen = 0, stunned = 0, weak = 0, done = 0;
    tally.dmg = 0; tally.hits = 0; tally.crits = 0; tally.on = true;
    try {
      while (done < steps && !stopFlag) {
        const t0 = performance.now();
        // Fast: as many steps as fit in ~14 ms, then let the browser draw a frame. Watch: real time.
        const budget = cfg.watch ? 1 : 1e9;
        let n = 0;
        // (Escape or P pauses the run, which would stall the lab: carry on.)
        if (G.Game.state === 'paused') { G.Game.togglePause(); G.UI.hideAll(); }
        while (done < steps && n < budget && performance.now() - t0 < 14) {
          G.Game.labStep(1, DT);
          done++; n++;
          pl.invuln = 1e9;
          if (pl.hp > base) { heal += pl.hp - base; pl.hp = base; }
          for (const e of es) {
            if (e.dead) continue;
            if (e.freezeT > 0) { if (e.stunned) stunned += DT; else frozen += DT; }
            if (e.vulnT > 0) weak += DT;
          }
          if (sc.respawn) {
            for (let i = 0; i < es.length; i++) if (es[i].dead) { kills++; es[i] = spawnAround(sc, 1)[0]; }
          }
        }
        progress(done / steps);
        await new Promise(r => requestAnimationFrame(r));
      }
    } finally { tally.on = false; }
    if (!sc.respawn) kills = es.filter(e => e.dead).length;
    const secs = done * DT;
    return {
      run: runNo, move: m.name, base: m.baseName || m.name, id, type: m.type, kind: m.kind, lvl, evo: !!m.evolved,
      dps: secs ? tally.dmg / secs : 0, dmg: tally.dmg, kills, hits: tally.hits,
      crit: tally.hits ? tally.crits / tally.hits * 100 : 0, heal: secs ? heal / secs : 0,
      frozen, stunned, weak, secs,
      setup: setupLabel()
    };
  }

  function setupLabel() {
    const u = UPS.filter(s => cfg.ups[s]).map(s => G.LevelUp.STATS.find(x => x.id === s).title + ' ×' + cfg.ups[s]).join(', ');
    return [G.DEX_BY[cfg.mon].name, SCENARIOS[cfg.scen].label.split(' (')[0], cfg.count + '×' + (cfg.hp >= 1e6 ? '∞' : cfg.hp) + ' HP',
            u || 'no upgrades', cfg.item ? G.Items.BY[cfg.item].name : 'no item', cfg.dur + ' s'].join(' · ');
  }

  async function runAll() {
    if (running) return;
    readForm();
    const list = [];
    for (const id of G.Moves.ALL.map(m => m.id)) {
      if (!cfg.moves.has(id)) continue;
      const def = G.Moves.BY_ID[id];
      for (const l of [...cfg.levels].sort()) if (l <= def.maxLvl) list.push([id, l, false]);
      if (cfg.evo && G.Moves.EVO[id]) list.push([id, def.maxLvl, true]);
    }
    if (!list.length) { status('Pick at least one move and one level.'); return; }
    running = true; stopFlag = false; runNo++;
    root.classList.add('busy');
    setMon(cfg.mon);
    if (!clearing()) status('Couldn\'t find an open clearing: results may be affected by walls or trees.');
    const t0 = performance.now();
    for (let i = 0; i < list.length && !stopFlag; i++) {
      const [id, l, e] = list[i];
      status(`Testing ${i + 1} / ${list.length}: ${G.Moves.BY_ID[id].name} ${e ? '(evolved)' : 'Lv. ' + l}…`);
      try { results.push(await runOne(id, l, e)); } catch (err) { console.error('[Lab]', id, err); }
      renderTable();
    }
    G.EnemyMgr.clear(); G.Projectiles.clear(); G.Combat.clearFields();
    running = false;
    root.classList.remove('busy');
    progress(0);
    status(`${stopFlag ? 'Stopped' : 'Done'}: ${list.length} test${list.length > 1 ? 's' : ''} in ${Math.round((performance.now() - t0) / 1000)} s (run #${runNo}).`);
  }

  // ---------------- the panel ----------------

  function status(t) { root.querySelector('#lab-status').textContent = t; }
  function progress(f) { root.querySelector('#lab-bar i').style.width = (f * 100).toFixed(1) + '%'; }

  function build() {
    root = document.createElement('div');
    root.id = 'lab';
    const typeOpts = ORDER.filter(t => G.Moves.POOL[t]).map(t => `<option value="${t}">${G.U.TYPE_NAME[t]}</option>`).join('');
    const kinds = [...new Set(G.Moves.ALL.map(m => m.kind))].sort();
    const mons = G.DEX.slice().sort((a, b) => a.name.localeCompare(b.name)).map(m => `<option value="${esc(m.name)}">`).join('');
    root.innerHTML = `
      <div class="lab-head"><b>Balance Lab</b><span class="sub">real game engine · nothing is saved</span>
        <button class="btn small ghost" id="lab-hide" title="Hide the panel to watch">Hide</button>
        <button class="btn small ghost" id="lab-exit">Exit</button></div>
      <div class="lab-body">
        <section class="lab-setup">
          <h4>Moves <span class="sub" id="lab-nmoves"></span></h4>
          <div class="lab-quick">
            <button class="chip" data-q="all">All</button><button class="chip" data-q="none">None</button>
            <button class="chip" data-q="new">New</button><button class="chip" data-q="burst">Burst</button>
            <select class="field" id="lab-qtype"><option value="">+ type…</option>${typeOpts}</select>
            <select class="field" id="lab-qkind"><option value="">+ style…</option>${kinds.map(k => `<option value="${k}">${G.Icons.KIND_NAME[k] || k}</option>`).join('')}</select>
          </div>
          <div class="lab-moves" id="lab-moves"></div>
          <h4>Levels</h4>
          <div class="lab-row">${[1, 2, 3, 4, 5].map(l => `<label class="lab-ck"><input type="checkbox" data-lvl="${l}"> Lv. ${l}</label>`).join('')}
            <label class="lab-ck"><input type="checkbox" id="lab-evo"> Evolved</label></div>
          <h4>Pokémon <span class="sub">(its attack stat scales damage)</span></h4>
          <input class="field" id="lab-mon" list="lab-mons" autocomplete="off"><datalist id="lab-mons">${mons}</datalist>
          <h4>Scenario</h4>
          <select class="field" id="lab-scen">${Object.entries(SCENARIOS).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join('')}</select>
          <div class="lab-row lab-nums">
            <label>Enemies <input class="field" type="number" id="lab-count" min="1" max="60"></label>
            <label>HP each <input class="field" type="number" id="lab-hp" min="1"></label>
            <label>Speed <input class="field" type="number" id="lab-spd" min="0" max="200"></label>
            <label>Seconds <input class="field" type="number" id="lab-dur" min="3" max="300"></label>
          </div>
          <h4>Upgrades and item</h4>
          <div class="lab-row lab-nums">${UPS.map(s => { const st = G.LevelUp.STATS.find(x => x.id === s); return `<label>${st.title} <input class="field" type="number" data-up="${s}" min="0" max="${st.max || 20}"></label>`; }).join('')}</div>
          <select class="field" id="lab-item"><option value="">No item</option>${G.Items.LIST.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join('')}</select>
          <label class="lab-ck lab-watch"><input type="checkbox" id="lab-watch"> Watch in real time (slow, to see what happens)</label>
          <div class="lab-row lab-go">
            <button class="btn gold" id="lab-run">Run tests</button>
            <button class="btn small ghost" id="lab-stop">Stop</button>
          </div>
          <div class="lab-bar" id="lab-bar"><i></i></div>
          <p class="sub" id="lab-status">Pick moves and press Run. Results stack up, so you can compare setups.</p>
        </section>
        <section class="lab-results">
          <div class="lab-row lab-rtools">
            <h4 style="margin:0">Results <span class="sub" id="lab-nres"></span></h4>
            <span class="grow"></span>
            <button class="btn small ghost" id="lab-csv">Download CSV</button>
            <button class="btn small ghost" id="lab-clear">Clear</button>
          </div>
          <div class="lab-tablewrap"><table class="lab-table" id="lab-table"></table></div>
          <p class="sub lab-note">DPS = damage per second dealt to the dummies (burn and poison included). Healing is HP per second.
            Frozen / Stunned / Weakened are enemy-seconds: 3 enemies frozen for 2 s = 6. Burst moves fire once per cooldown, so give them
            30 s or more. Hover a row to see the setup it was run with.</p>
        </section>
      </div>`;
    document.body.appendChild(root);
    const $ = s => root.querySelector(s);

    // moves list
    $('#lab-moves').innerHTML = ORDER.filter(t => G.Moves.POOL[t]).map(t =>
      `<div class="lab-mtype"><span class="type" style="background:${G.U.TYPE_COLOR[t]}">${G.U.TYPE_NAME[t]}</span>` +
      G.Moves.ALL.filter(m => m.type === t).map(m => `<label class="lab-ck"><input type="checkbox" data-mv="${m.id}"> ${esc(m.name)}</label>`).join('') + '</div>').join('');
    // defaults into the form
    $('#lab-mon').value = G.DEX_BY[cfg.mon].name;
    $('#lab-scen').value = cfg.scen;
    applyScenario();
    $('#lab-dur').value = cfg.dur;
    for (const s of UPS) root.querySelector(`[data-up=${s}]`).value = cfg.ups[s];
    for (const l of [1, 2, 3, 4, 5]) root.querySelector(`[data-lvl="${l}"]`).checked = cfg.levels.has(l);
    $('#lab-evo').checked = cfg.evo;

    // events
    $('#lab-scen').onchange = () => { cfg.scen = $('#lab-scen').value; applyScenario(); };
    root.querySelector('.lab-quick').onclick = e => {
      const q = e.target.dataset && e.target.dataset.q; if (!q) return;
      for (const c of root.querySelectorAll('[data-mv]')) {
        const m = G.Moves.BY_ID[c.dataset.mv];
        if (q === 'all') c.checked = true;
        else if (q === 'none') c.checked = false;
        else if (q === 'new') c.checked = c.checked || !!m.added;
        else if (q === 'burst') c.checked = c.checked || m.kind === 'burst';
      }
      countMoves();
    };
    $('#lab-qtype').onchange = e => { for (const c of root.querySelectorAll('[data-mv]')) if (G.Moves.BY_ID[c.dataset.mv].type === e.target.value) c.checked = true; e.target.value = ''; countMoves(); };
    $('#lab-qkind').onchange = e => { for (const c of root.querySelectorAll('[data-mv]')) if (G.Moves.BY_ID[c.dataset.mv].kind === e.target.value) c.checked = true; e.target.value = ''; countMoves(); };
    $('#lab-moves').onchange = countMoves;
    $('#lab-run').onclick = runAll;
    $('#lab-stop').onclick = () => { stopFlag = true; };
    $('#lab-clear').onclick = () => { results = []; renderTable(); };
    $('#lab-csv').onclick = downloadCsv;
    $('#lab-hide').onclick = () => { root.classList.toggle('mini'); $('#lab-hide').textContent = root.classList.contains('mini') ? 'Show' : 'Hide'; };
    $('#lab-exit').onclick = () => { if (!running || confirm('Stop the tests and leave the lab?')) location.href = location.pathname; };
    $('#lab-table').onclick = e => {
      const th = e.target.closest('th[data-k]'); if (!th) return;
      if (sortKey === th.dataset.k) sortDir = -sortDir; else { sortKey = th.dataset.k; sortDir = ['move', 'type', 'kind', 'setup'].includes(sortKey) ? 1 : -1; }
      renderTable();
    };
    countMoves();
    renderTable();
  }

  function applyScenario() {
    const sc = SCENARIOS[cfg.scen], $ = s => root.querySelector(s);
    $('#lab-count').value = sc.count; $('#lab-hp').value = sc.hp >= 1e6 ? 10000000 : sc.hp; $('#lab-spd').value = sc.spd;
  }
  function countMoves() { root.querySelector('#lab-nmoves').textContent = root.querySelectorAll('[data-mv]:checked').length + ' selected'; }

  function readForm() {
    const $ = s => root.querySelector(s);
    cfg.moves = new Set([...root.querySelectorAll('[data-mv]:checked')].map(c => c.dataset.mv));
    cfg.levels = new Set([...root.querySelectorAll('[data-lvl]:checked')].map(c => +c.dataset.lvl));
    cfg.evo = $('#lab-evo').checked;
    const name = $('#lab-mon').value.trim().toLowerCase();
    const mon = G.DEX.find(m => m.name.toLowerCase() === name) || G.DEX_BY[+name];
    if (mon) cfg.mon = mon.dex; else $('#lab-mon').value = G.DEX_BY[cfg.mon].name;
    cfg.scen = $('#lab-scen').value;
    const num = (s, lo, hi, d) => { const v = +$(s).value; return Number.isFinite(v) && v >= lo ? Math.min(hi, v) : d; };
    cfg.count = Math.round(num('#lab-count', 1, 60, 1));
    cfg.hp = Math.round(num('#lab-hp', 1, 1e9, 1e7));
    cfg.spd = num('#lab-spd', 0, 200, 0);
    cfg.dur = num('#lab-dur', 3, 300, 20);
    for (const s of UPS) cfg.ups[s] = Math.round(num(`[data-up=${s}]`, 0, 50, 0));
    cfg.item = $('#lab-item').value;
    cfg.watch = $('#lab-watch').checked;
  }

  const COLS = [
    ['run', 'Run'], ['move', 'Move'], ['type', 'Type'], ['kind', 'Style'], ['lvl', 'Lv'], ['dps', 'DPS'], ['dmg', 'Damage'], ['kills', 'Kills'],
    ['hits', 'Hits'], ['crit', 'Crit %'], ['heal', 'Heal/s'], ['frozen', 'Frozen'], ['stunned', 'Stunned'], ['weak', 'Weakened']
  ];
  function renderTable() {
    const t = root.querySelector('#lab-table');
    root.querySelector('#lab-nres').textContent = results.length ? results.length + ' rows' : '';
    if (!results.length) { t.innerHTML = '<tr><td class="sub">No results yet.</td></tr>'; return; }
    const val = r => r[sortKey];
    const rows = results.slice().sort((a, b) => {
      const x = val(a), y = val(b);
      return (typeof x === 'string' ? x.localeCompare(y) : x - y) * sortDir || b.dps - a.dps;
    });
    const top = Math.max(...results.map(r => r.dps)) || 1;
    t.innerHTML = '<thead><tr>' + COLS.map(([k, l]) => `<th data-k="${k}" class="${sortKey === k ? 'on' : ''}">${l}${sortKey === k ? (sortDir < 0 ? ' ▾' : ' ▴') : ''}</th>`).join('') + '</tr></thead><tbody>' +
      rows.map(r => `<tr title="${esc(r.setup)}">
        <td class="sub">#${r.run}</td><td><b>${esc(r.move)}</b>${r.evo ? ' <span class="lab-evo">evo</span>' : ''}</td>
        <td><span class="type" style="background:${G.U.TYPE_COLOR[r.type]}">${G.U.TYPE_NAME[r.type]}</span></td>
        <td>${G.Icons.KIND_NAME[r.kind] || r.kind}</td><td>${r.evo ? '★' : r.lvl}</td>
        <td class="lab-dps"><i style="width:${(r.dps / top * 100).toFixed(1)}%"></i><span>${Math.round(r.dps)}</span></td>
        <td>${Math.round(r.dmg)}</td><td>${r.kills}</td><td>${r.hits}</td><td>${r1(r.crit)}</td>
        <td>${r.heal ? r1(r.heal) : ''}</td><td>${r.frozen ? r1(r.frozen) : ''}</td><td>${r.stunned ? r1(r.stunned) : ''}</td><td>${r.weak ? r1(r.weak) : ''}</td></tr>`).join('') + '</tbody>';
  }

  function downloadCsv() {
    if (!results.length) return;
    const head = ['Run', 'Move', 'Base move', 'Type', 'Style', 'Level', 'Evolved', 'DPS', 'Damage', 'Kills', 'Hits', 'Crit %', 'Heal per s',
                  'Frozen (enemy-s)', 'Stunned (enemy-s)', 'Weakened (enemy-s)', 'Seconds', 'Setup'];
    const q = v => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v;
    const lines = [head.join(',')].concat(results.map(r => [r.run, r.move, r.base, G.U.TYPE_NAME[r.type], G.Icons.KIND_NAME[r.kind] || r.kind, r.lvl, r.evo ? 'yes' : 'no',
      r1(r.dps), Math.round(r.dmg), r.kills, r.hits, r1(r.crit), r1(r.heal), r1(r.frozen), r1(r.stunned), r1(r.weak), r1(r.secs), r.setup].map(q).join(',')));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = 'balance-lab-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------------- start ----------------

  function start() {
    hookOnce();
    const save = G.DB.labSave();
    save.partner = cfg.mon;
    G.UI.hideAll();
    G.UI.chrome(false);
    G.Game.startRun();
    G.Game.debugSpeed(0);              // the normal clock stops: only the lab moves the game (labStep)
    sandbox();
    G.EnemyMgr.clear();
    build();
    clearing();
    document.title = 'Balance Lab · ' + document.title;
  }

  return { wanted, start, get results() { return results; } };
})();
