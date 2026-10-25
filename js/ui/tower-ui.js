/* ============ tower-ui.js — the Battle Tower's screens ============
 *   scr-tower   from the menu tile: Climb (partner, start floor, the 50-floor map, records) and the BP Shop
 *               (Badge unlocks, Battle Tower themes, exchange)
 *   scr-tbadge  in a run, after a boss: pick 1 of 3 Badges
 *   lobby       the room host picks the mode (Survival or a Battle Tower Expedition) and its start floor
 */
G.TowerUI = (() => {
  const $ = id => document.getElementById(id);
  const D = () => G.TowerData;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let tab = 'climb', startFloor = 1, starting = false;

  const T = () => (G.DB.save && G.DB.save.tower) || { bp: 0, cp: 0, best: 0, bestX: 0, firsts: {}, badges: {}, runs: 0 };

  function init() {
    document.querySelectorAll('#tower-tabs .shop-tab').forEach(b => { b.onclick = () => { tab = b.dataset.tab; render(); }; });
    // Badge pick with the keyboard.
    addEventListener('keydown', ev => {
      if (!badgeCb || !G.UI.isOpen('scr-tbadge')) return;
      const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(ev.code);
      if (i >= 0 && badgeList[i]) { ev.preventDefault(); pickBadge(i); }
    });
  }

  function open(t) {
    if (t) tab = t;
    const starts = D().starts(T().cp);
    if (!starts.includes(startFloor)) startFloor = starts[starts.length - 1];
    G.UI.show('scr-tower', true);
    render();
  }

  function render() {
    document.querySelectorAll('#tower-tabs .shop-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    $('tower-wallet').innerHTML = `${G.Icons.html('bp', 18)} <b>${T().bp || 0}</b> BP`;
    const box = $('tower-body');
    box.innerHTML = '';
    if (tab === 'shop') renderShop(box); else renderClimb(box);
  }

  // ---------------- Climb ----------------

  function renderClimb(box) {
    const s = G.DB.save, t = T(), mon = G.DEX_BY[s.partner] || G.DEX[0], shiny = !!s.partnerShiny && G.DB.ownsShiny(mon.dex);
    const starts = D().starts(t.cp);
    const head = D().headStart(startFloor);
    box.insertAdjacentHTML('beforeend', `
      <p class="sub">Climb 50 floors of bosses and hordes on your own. Beat a gatekeeper (10F, 20F…) to save a checkpoint for good;
        fall, and you can start again from there, with any partner. Battle Points come with every floor.</p>
      <div class="tw-top">
        <div class="panel tw-partner"><canvas id="tw-mon" width="120" height="96"></canvas>
          <div><b>${esc(mon.name)}</b><small>Your partner for this climb</small>
          <button id="tw-change" class="btn small ghost">Change partner</button></div></div>
        <div class="panel tw-start">
          <b>Start from</b>
          <div class="seg tw-seg" id="tw-starts">${starts.map(f => `<button data-f="${f}" class="${f === startFloor ? 'on' : ''}">${f}F</button>`).join('')}</div>
          <small>${head ? 'Head start: ' + head + ' free levels' : t.cp ? 'From the bottom, no head start' : 'Beat 10F to unlock a checkpoint'}</small>
          <button id="tw-go" class="btn gold" data-sfx="confirm">Enter the tower</button>
        </div>
      </div>
      <div class="tw-records">
        <span>Best climb <b>${t.best ? t.best + 'F' : '—'}</b></span>
        <span>Best expedition <b>${t.bestX ? t.bestX + 'F' : '—'}</b></span>
        <span>Checkpoint <b>${t.cp ? t.cp + 'F' : '—'}</b></span>
        <span>Runs <b>${t.runs || 0}</b></span>
        <span>Statues <b>${Object.keys(t.firsts || {}).filter(n => n % 5 === 0).length} / 10</b></span>
      </div>
      <h3 class="shop-h">${G.Icons.html('tower', 18)} The tower <small>Gold: cleared at least once</small></h3>
      <div class="tw-map" id="tw-map"></div>`);
    G.UI.sprite($('tw-mon'), mon.dex, { shiny, lively: true });
    $('tw-change').onclick = () => { G.UI.hide('scr-tower'); document.querySelector('#scr-menu [data-go=dex]').click(); };
    document.querySelectorAll('#tw-starts button').forEach(b => { b.onclick = () => { startFloor = +b.dataset.f; render(); }; });
    $('tw-go').onclick = () => {
      if (starting || G.Game.state !== 'ui') return;
      starting = true;
      G.Updater.gate().then(ok => { starting = false; if (ok) G.Flow.playTower(startFloor); }, () => { starting = false; });
    };
    // The map: a row per section, newest at the top (it's a tower).
    const map = $('tw-map');
    for (let sec = D().SECTIONS.length - 1; sec >= 0; sec--) {
      const S = D().SECTIONS[sec], row = document.createElement('div');
      row.className = 'tw-row';
      const chips = [];
      for (let i = 1; i <= D().SECTION; i++) {
        const n = sec * D().SECTION + i, f = D().floor(n);
        const done = !!(t.firsts && t.firsts[n]);
        const big = f.kind !== 'horde';
        const title = f.kind === 'horde' ? 'Horde' : (G.DEX_BY[f.dex] || {}).name;
        chips.push(`<i class="${done ? 'done' : ''} ${big ? 'big' : ''} ${f.kind}" title="${n}F · ${esc(title)}">${n}</i>`);
      }
      const boss = G.DEX_BY[S.boss], gate = G.DEX_BY[sec === D().SECTIONS.length - 1 ? 384 : S.gate];
      row.innerHTML = `<div class="tw-sec"><b>${esc(S.name)}</b><small>5F ${esc(boss.name)} · ${sec === D().SECTIONS.length - 1 ? 'Summit' : 'Gate'} ${esc(gate.name)}</small></div>
        <div class="tw-chips">${chips.join('')}</div>`;
      map.appendChild(row);
    }
  }

  // ---------------- BP Shop ----------------

  function renderShop(box) {
    const t = T(), bp = t.bp || 0, s = G.DB.save;
    box.insertAdjacentHTML('beforeend', `<p class="sub">Battle Points come from every floor you clear, in a Climb or an Expedition.</p>
      <h3 class="shop-h">${G.Icons.html('medal3', 18)} Badges <small>Unlocked Badges can be offered after every boss, for every run</small></h3>
      <div class="shop-list" id="tw-badges"></div>
      <h3 class="shop-h">${G.Icons.html('tower', 18)} Battle Tower themes <small>Wear them from here or the Star Shop</small></h3>
      <div class="theme-grid" id="tw-mthemes"></div>
      <div class="theme-grid cards" id="tw-cthemes"></div>
      <h3 class="shop-h">${G.Icons.html('coin', 18)} Exchange <small>A poor rate on purpose: BP is best spent in the tower</small></h3>
      <div class="shop-list" id="tw-ex"></div>`);
    const list = $('tw-badges');
    for (const b of D().BADGES) {
      const own = !b.cost || (t.badges && t.badges[b.id]);
      const el = document.createElement('div');
      el.className = 'panel shop-row' + (own ? ' on' : '');
      el.innerHTML = `<div class="ic">${G.Icons.html(b.icon, 30)}</div>
        <div class="txt"><b>${esc(b.name)}</b><div class="ds">${esc(b.desc)}</div>${!b.cost ? '<div class="have">Free</div>' : own ? '<div class="have">Unlocked</div>' : ''}</div><div class="buy"></div>`;
      if (!own) {
        const btn = document.createElement('button');
        btn.className = 'btn small gold';
        btn.innerHTML = `${G.Icons.html('bp', 14)} ${b.cost}`;
        btn.disabled = bp < b.cost;
        btn.onclick = () => {
          if ((T().bp || 0) < b.cost) return;
          s.tower.bp -= b.cost;
          s.tower.badges[b.id] = Date.now();
          G.DB.commit(true);
          G.Audio.sfx('confirm');
          G.UI.toast(b.name + ' unlocked: it can come up after bosses now');
          render();
        };
        el.querySelector('.buy').appendChild(btn);
      }
      list.appendChild(el);
    }
    // Themes (data/keyitems.js G.Themes entries with `bp`).
    const mon = G.DEX_BY[s.partner] || G.DEX[0], shiny = !!s.partnerShiny && G.DB.ownsShiny(mon.dex);
    for (const [kind, arr, grid] of [['m', G.Themes.MENU, 'tw-mthemes'], ['c', G.Themes.CARD, 'tw-cthemes']]) {
      for (const th of arr.filter(x => x.bp)) {
        const own = G.Themes.owns(kind, th.id), on = (kind === 'm' ? G.Themes.menuId() : G.Themes.cardId()) === th.id;
        const el = document.createElement('div');
        el.className = 'panel theme-card' + (on ? ' on' : '');
        const v = th.vars;
        el.innerHTML = (kind === 'm'
          ? `<div class="mt-pv" style="background:linear-gradient(180deg, ${v.box1}, ${v.box2});box-shadow:inset 0 0 0 2px ${v.edgeIn}">
               <i style="background:${v.tile};border-color:${v.accent}"></i><i style="background:${v.tile}"></i><i style="background:${v.tile}"></i>
               <span class="mt-pill" style="background:${v.pill}"></span></div>`
          : `<canvas class="card-pv" width="330" height="54"></canvas>`) +
          `<b>${esc(th.name)}</b><small>${kind === 'm' ? 'Menu theme' : 'Player card'}</small><div class="buy"></div>`;
        const btn = document.createElement('button');
        if (!own) {
          btn.className = 'btn small gold';
          btn.innerHTML = `${G.Icons.html('bp', 14)} ${th.bp}`;
          btn.disabled = bp < th.bp;
          btn.onclick = () => {
            const err = G.Themes.buyBp(kind, th.id);
            if (err) { G.UI.toast(err); return; }
            G.Audio.sfx('confirm');
            G.UI.toast(th.name + ' is yours, and you\'re wearing it!');
            render();
          };
        } else {
          btn.className = 'btn small' + (on ? ' ghost' : '');
          btn.textContent = on ? 'Wearing' : 'Wear';
          btn.disabled = on;
          btn.onclick = () => { G.Themes.wear(kind, th.id); render(); };
        }
        el.querySelector('.buy').appendChild(btn);
        $(grid).appendChild(el);
        const cv = el.querySelector('canvas.card-pv');
        if (cv) G.HUD.cardPreview(cv, th.id, mon.dex, shiny, mon.name);
      }
    }
    // Exchange.
    const ex = $('tw-ex');
    for (const x of D().EXCHANGE) {
      const el = document.createElement('div');
      el.className = 'panel shop-row';
      el.innerHTML = `<div class="ic">${G.Icons.html(x.icon, 30)}</div><div class="txt"><b>${esc(x.name)}</b><div class="ds">For ${x.cost} Battle Points</div></div><div class="buy"></div>`;
      const btn = document.createElement('button');
      btn.className = 'btn small gold';
      btn.innerHTML = `${G.Icons.html('bp', 14)} ${x.cost}`;
      btn.disabled = bp < x.cost;
      btn.onclick = () => {
        if ((T().bp || 0) < x.cost) return;
        s.tower.bp -= x.cost;
        x.give(s);
        G.DB.commit(true);
        G.UI.refreshCoins();
        G.Audio.sfx('coin');
        G.UI.toast('Exchanged: ' + x.name);
        render();
      };
      el.querySelector('.buy').appendChild(btn);
      ex.appendChild(el);
    }
  }

  // ---------------- Badge pick (in a run) ----------------

  let badgeCb = null, badgeList = [];
  function showBadges(list, cb) {
    badgeList = list; badgeCb = cb;
    const box = $('tbadge-cards');
    box.innerHTML = '';
    list.forEach((b, i) => {
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `<div class="ico" style="background:#ffd23f33">${G.Icons.html(b.icon, 32)}</div>
        <div class="txt"><div class="nm">${esc(b.name)} <span class="tag-chip" style="background:#ffd23f">Badge</span></div><div class="ds">${esc(b.desc)}</div></div>
        <div class="key">${i + 1}</div>`;
      el.dataset.sfx = 'none';
      el.onclick = () => pickBadge(i);
      box.appendChild(el);
    });
    G.UI.show('scr-tbadge');
  }
  function pickBadge(i) {
    const cb = badgeCb, b = badgeList[i];
    if (!cb || !b) return;
    badgeCb = null; badgeList = [];
    G.UI.hide('scr-tbadge');
    cb(b);
  }
  function closeBadges() {
    if (badgeCb) { badgeCb = null; badgeList = []; }
    const el = $('scr-tbadge');
    if (el && !el.classList.contains('hidden')) G.UI.hide('scr-tbadge');
  }

  // ---------------- friends room: the mode ----------------
  // The host picks Survival or a Battle Tower Expedition (and where it starts); guests see the host's choice.
  let lobby = { tower: false, start: 1 };
  let lobbyHooked = false;
  function hookLobby() {
    if (lobbyHooked) return;
    lobbyHooked = true;
    G.Net.on((from, msg) => {
      if (!msg || msg.k !== 'lmode' || G.Net.isHost) return;
      lobby = { tower: !!msg.tower, start: msg.start | 0 || 1 };
      if (G.UI.isOpen('scr-lobby')) G.LobbyUI.render();
    });
  }
  function sendLobbyMode() { if (G.Social.room && G.Social.room.isHost) G.Net.broadcast({ k: 'lmode', tower: lobby.tower ? 1 : 0, start: lobby.start }); }

  /** Draws the mode row in the room (social-ui.js render). */
  function lobbyTools(el) {
    hookLobby();
    const room = G.Social.room;
    if (!el || !room) return;
    if (!room.isHost) {
      el.innerHTML = `<p class="note">Mode: <b>${lobby.tower ? 'Battle Tower Expedition from ' + lobby.start + 'F' : 'Survival'}</b> (the host picks)</p>`;
      return;
    }
    const starts = D().starts(T().cp);
    if (!starts.includes(lobby.start)) lobby.start = 1;
    el.innerHTML = `<div class="seg tw-seg" id="lm-mode"><button data-m="0" class="${lobby.tower ? '' : 'on'}">Survival</button><button data-m="1" class="${lobby.tower ? 'on' : ''}">Battle Tower</button></div>
      ${lobby.tower ? `<div class="seg tw-seg" id="lm-start" style="margin-top:6px">${starts.map(f => `<button data-f="${f}" class="${f === lobby.start ? 'on' : ''}">${f}F</button>`).join('')}</div>
      <p class="note">Expedition: the same 50 floors as a roguelike run, with co-op event floors. It never moves anyone's checkpoint, but everyone earns Battle Points. You can start from any checkpoint you have saved.</p>` : ''}`;
    el.querySelectorAll('#lm-mode button').forEach(b => { b.onclick = () => { lobby.tower = b.dataset.m === '1'; sendLobbyMode(); G.LobbyUI.render(); }; });
    el.querySelectorAll('#lm-start button').forEach(b => { b.onclick = () => { lobby.start = +b.dataset.f; sendLobbyMode(); G.LobbyUI.render(); }; });
  }
  /** For the room's start message: the tower config, or null for Survival. */
  function lobbyCfg() { return lobby.tower ? { mode: 'exp', start: lobby.start } : null; }

  return { init, open, render, showBadges, closeBadges, lobbyTools, lobbyCfg, sendLobbyMode };
})();
