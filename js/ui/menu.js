/* ============ menu.js — main menu, collection and upgrades ============ */
G.MenuUI = (() => {
  const $ = G.UI.$;
  const GEN_NAMES = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Teselia', 'Kalos', 'Alola', 'Galar', 'Paldea'];
  let dexFilter = 'all', dexGen = 1, dexSel = null;

  // ---- hover tooltip for moves (Pokémon tab and the ban picker): name, type, kind and what it does ----
  function moveTip() {
    let el = document.getElementById('mv-tip');
    if (!el) { el = document.createElement('div'); el.id = 'mv-tip'; document.body.appendChild(el); }
    return el;
  }
  function showMoveTip(id, ev) {
    const m = G.Moves.BY_ID[id];
    if (!m) return;
    const T = G.T || (s => s), col = G.U.TYPE_COLOR[m.type] || '#9fb1c9', el = moveTip();
    el.style.borderColor = col;
    el.innerHTML = `<div class="mt-head"><b>${T(m.name)}</b> <span class="mt-type" style="background:${col}">${T(G.U.TYPE_NAME[m.type] || m.type)}</span>
      <span class="mt-kind">${G.Icons.KIND_NAME[m.kind] || m.kind}</span></div><div class="mt-desc">${T(m.desc || '')}</div>`;
    el.style.display = 'block';
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = Math.max(6, Math.min(innerWidth - w - 6, ev.clientX + 14)) + 'px';
    el.style.top = Math.max(6, Math.min(innerHeight - h - 6, ev.clientY + 16)) + 'px';
  }
  function hideMoveTip() { const el = document.getElementById('mv-tip'); if (el) el.style.display = 'none'; }
  document.addEventListener('mouseover', e => { const t = e.target.closest && e.target.closest('[data-mv]'); if (t) showMoveTip(t.dataset.mv, e); else hideMoveTip(); });
  document.addEventListener('mousemove', e => { const t = e.target.closest && e.target.closest('[data-mv]'); if (t) showMoveTip(t.dataset.mv, e); });
  document.addEventListener('scroll', hideMoveTip, true);
  document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-mv]'); if (t) showMoveTip(t.dataset.mv, e); else hideMoveTip(); });

  function init() {
    const ICON = { play: 'ball', dex: 'book', upgrades: 'up', gacha: 'ball4', goals: 'medal3', friends: 'friends', rank: 'trophy', settings: 'gear' };
    document.querySelectorAll('#scr-menu [data-go]').forEach(b => {
      b.insertAdjacentHTML('afterbegin', `<span class="mi-ico">${G.Icons.html(ICON[b.dataset.go], 26)}</span>`);
      b.dataset.sfx = b.dataset.go === 'play' ? 'confirm' : 'click';
      b.onclick = () => {
        const go = b.dataset.go;
        if (go === 'play') { if (G.Social.room) G.LobbyUI.open(); else G.Updater.gate().then(ok => { if (ok) G.Flow.play(); }); }
        else if (go === 'dex') openDex();
        else if (go === 'upgrades') openUpgrades();
        else if (go === 'gacha') G.GachaUI.open();
        else if (go === 'goals') G.GoalsUI.open();
        else if (go === 'friends') G.FriendsUI.open();
        else if (go === 'rank') G.RankingUI.open();
        else if (go === 'settings') G.SettingsUI.open();
      };
    });
    document.querySelectorAll('[data-back]').forEach(b => { b.onclick = open; });
    $('menu-random').innerHTML = G.Icons.html('cards', 14) + ' Random partner';
    $('menu-random').onclick = openRandom;
    $('rnd-again').onclick = spinRandom;
    $('rnd-done').onclick = () => { if (spinning) return; G.UI.hide('scr-random'); open(); };
    G.Social.on(() => { if (G.UI.isOpen('scr-menu')) socialLine(); });
    $('btn-logout').onclick = () => {
      if (G.DB.guest && !confirm('Eres invitado: se perderá todo el progreso. ¿Salir?')) return;
      G.Audio.music(null);
      G.DB.logout().then(() => G.Flow.toLogin());
    };
  }

  // ---------------- main menu ----------------

  function open() {
    const s = G.DB.save;
    const mon = G.DEX_BY[s.partner];
    const shiny = !!s.partnerShiny && G.DB.ownsShiny(mon.dex);
    G.UI.chrome(true);
    G.UI.show('scr-menu');
    G.UI.sprite($('menu-partner'), mon.dex, { lively: true, scale: 4, hero: true, shiny });
    $('menu-partner').style.setProperty('--stage-c', shiny ? '#9ae6ff' : G.U.TYPE_COLOR[mon.types[0]]);
    $('menu-partner').classList.toggle('shiny', shiny);
    $('menu-partner-name').innerHTML = mon.name + (shiny ? ' ' + G.Icons.html('shiny', 24) : '') + (reachedArceus(mon.dex) ? ' ' + arcStar(24) : '');
    $('menu-partner-info').innerHTML = G.UI.typeChips(mon.types) + ' ' + G.UI.stars(mon.rarity);
    // Normal / shiny by hand, right here (on mobile it couldn't be found in the details).
    const seg = $('menu-shiny');
    seg.classList.toggle('hidden', !G.DB.ownsShiny(mon.dex));
    seg.lastChild.innerHTML = G.Icons.html('shiny', 12) + ' Shiny';
    seg.querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', (b.dataset.v === '1') === shiny);
      b.onclick = () => {
        if ((b.dataset.v === '1') === shiny) return;
        s.partnerShiny = b.dataset.v === '1';
        G.DB.commit();
        G.Social.refreshMember();         // if you're in a room, the others see it straight away
        G.Audio.sfx('confirm');
        open();
      };
    });

    const owned = Object.keys(s.owned).filter(d => G.DEX_BY[d]).length;
    const shinies = Object.keys(s.shiny || {}).length;
    $('menu-dex-count').textContent = `${owned} / ${G.DEX.length}` + (shinies ? ` · ${shinies} shiny` : '');

    const st = s.stats;
    $('menu-stats').innerHTML =
      `Runs <b style="color:#fff">${st.runs}</b> · Mejor tiempo <b style="color:#fff">${G.U.mmss(st.bestTime)}</b><br>` +
      `Mejor nivel <b style="color:#fff">${st.bestLevel}</b> · Derrotados <b style="color:#fff">${st.totalKills.toLocaleString('es')}</b>` +
      (G.DB.guest ? '<br><span style="color:#ffb0b8">Modo invitado: no se guarda</span>' : '');

    socialLine();
    // Mission rewards waiting to be collected.
    G.Progress.checkAch();
    const pend = G.Progress.pending();
    $('menu-goals-sub').textContent = pend ? pend + (pend === 1 ? ' premio por recoger' : ' premios por recoger') : 'Misiones, logros y perfil';
    $('menu-goals-sub').classList.toggle('gold', pend > 0);
    // With a cloud account: friends online, invitations and (once) the nickname.
    if (G.DB.online && !G.Social.started) {
      G.Social.start().then(r => {
        if (r === 'need-nick' && !G.NickUI.skipped && G.UI.isOpen('scr-menu')) G.NickUI.open();
        socialLine();
      });
    }
    G.InvitePop.refresh();
  }

  /** Text below "Friends" and "Play": who's online, requests, room. */
  function socialLine() {
    const room = G.Social.room;
    const play = document.querySelector('#scr-menu [data-go=play] small');
    if (play) play.textContent = room ? 'Volver a tu sala (' + room.members.length + '/' + G.Social.MAX_PLAYERS + ')' : 'Entra en la mazmorra';
    const fr = G.Social.friends;
    const on = fr.filter(f => f.status === 'ok' && f.online).length;
    const req = fr.filter(f => f.status === 'in').length;
    const parts = [];
    if (on) parts.push(on + ' en línea');
    if (req) parts.push(req + (req === 1 ? ' solicitud' : ' solicitudes'));
    const msgs = G.Chat ? G.Chat.totalUnread() : 0;
    if (msgs) parts.push(msgs + (msgs === 1 ? ' new message' : ' new messages'));
    $('menu-friends-sub').textContent = parts.length ? parts.join(' · ') : 'Play in a group, up to 5';
    $('menu-friends-sub').classList.toggle('gold', req > 0 || msgs > 0);
  }

  // ---------------- collection ----------------

  function openDex() {
    G.UI.show('scr-dex', true);
    const s = G.DB.save;
    if (dexSel == null) { dexSel = s.partner; dexGen = G.DEX_BY[s.partner].gen; }
    const owned = Object.keys(s.owned).filter(d => G.DEX_BY[d]).length;
    $('dex-total').textContent = `${owned} / ${G.DEX.length}`;

    // Generation tabs, with how many you have of each.
    const tabs = $('dex-gens');
    tabs.innerHTML = '';
    GEN_NAMES.forEach((name, i) => {
      const g = i + 1;
      const total = G.DEX.filter(p => p.gen === g).length;
      const have = G.DEX.filter(p => p.gen === g && s.owned[p.dex]).length;
      const b = document.createElement('button');
      b.className = 'gen-tab' + (g === dexGen ? ' on' : '');
      b.innerHTML = `<b>${name}</b><small>${have}/${total}</small>`;
      b.onclick = () => { dexGen = g; openDex(); };
      tabs.appendChild(b);
    });

    const F = [['all', 'Todos'], ['own', 'Tengo'], ['miss', 'Me faltan'], ['shiny', 'Shiny'], ['new', 'New'],
               ['5', 5], ['4', 4], ['3', 3], ['2', 2], ['1', 1]];
    const fb = $('dex-filters');
    fb.innerHTML = '';
    for (const [k, label] of F) {
      const c = document.createElement('button');
      c.className = 'chip' + (k === dexFilter ? ' on' : '');
      c.innerHTML = k === 'shiny' ? G.Icons.html('shiny', 12) + ' Shiny'
                  : typeof label === 'number' ? G.Icons.rarity(label, 12) + ' ' + G.Gacha.RARITY_NAME[label] : label;
      c.onclick = () => { dexFilter = k; openDex(); };
      fb.appendChild(c);
    }
    wireDexSearch();
    renderGrid();
    showDetail(dexSel);
  }

  // Recently added Pokémon: they carry a "NEW" tag in the Pokédex.
  // (To remove it, delete the number here. Added on 17-10-2026.)
  const NEW_DEX = new Set([593, 865, 879, 948, 1025]);

  /** Gold star: this Pokémon has reached Arceus in a run. */
  const reachedArceus = dex => !!(G.DB.save.arceus && G.DB.save.arceus[dex]);
  const arcTimes = () => Math.max(1, (G.DB.save.stats || {}).judged || 0);   // total times you have reached Arceus (any Pokémon)
  const arcTitle = () => 'Reached Arceus' + (arcTimes() > 1 ? ' · ' + arcTimes() + ' times in total' : '');
  const arcStar = size => `<span title="${arcTitle()}">${G.Icons.html('star', size)}${arcTimes() > 1 ? `<small style="color:#ffe27a;font-weight:800;margin-left:2px">×${arcTimes()}</small>` : ''}</span>`;

  // Search box: matches the names of Pokémon you own (unknown ones stay "???") or any Dex number, across every generation.
  let dexQuery = '';
  const SEARCH_MAX = 120;
  const fold = t => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '');
  function wireDexSearch() {
    const q = $('dex-q');
    if (q.dataset.wired) return;
    q.dataset.wired = '1';
    q.oninput = () => { dexQuery = q.value; $('dex-q-clear').classList.toggle('hidden', !dexQuery); renderGrid(); };
    $('dex-q-clear').onclick = () => { q.value = ''; q.oninput(); q.focus(); };
  }

  function renderGrid() {
    const s = G.DB.save;
    const grid = $('dex-grid');
    grid.innerHTML = '';
    const query = fold(dexQuery).trim();
    const numQ = /^\d+$/.test(query) ? +query : 0;
    let shown = 0, more = 0;
    for (const p of G.DEX) {
      if (query) {
        const known = !!s.owned[p.dex];
        const hit = (known && fold(p.name).includes(query)) || (numQ && (String(p.dex) === String(numQ) || String(p.dex).startsWith(String(numQ))));
        if (!hit) continue;
      } else if (p.gen !== dexGen && dexFilter !== 'new') continue;      // the New filter shows every generation
      const own = !!s.owned[p.dex], sh = !!(s.shiny && s.shiny[p.dex]);
      if (dexFilter === 'own' && !own) continue;
      if (dexFilter === 'miss' && own) continue;
      if (dexFilter === 'shiny' && !sh) continue;
      if (dexFilter === 'new' && !NEW_DEX.has(p.dex)) continue;
      if (/^\d$/.test(dexFilter) && p.rarity !== +dexFilter) continue;
      if (query) { if (shown >= SEARCH_MAX) { more++; continue; } shown++; }

      const cell = document.createElement('div');
      cell.className = 'cell' + (own ? '' : ' locked') + (p.dex === dexSel ? ' on' : '');
      cell.insertAdjacentHTML('beforeend', `<span class="no">${String(p.dex).padStart(3, '0')}</span>`);
      if (NEW_DEX.has(p.dex)) cell.insertAdjacentHTML('beforeend', '<span class="tag-new">NEW</span>');
      if (own && reachedArceus(p.dex)) cell.insertAdjacentHTML('beforeend', `<span class="badge-arc${p.dex === s.partner || sh ? ' shift' : ''}" title="${arcTitle()}">${G.Icons.html('star', 14)}</span>`);
      if (p.dex === s.partner) cell.insertAdjacentHTML('beforeend', `<span class="badge-r" title="Compañero">${G.Icons.html('crown', 14)}</span>`);
      else if (sh) cell.insertAdjacentHTML('beforeend', `<span class="badge-r" title="Tienes su shiny">${G.Icons.html('shiny', 12)}</span>`);
      const useShiny = sh && p.dex === s.partner && s.partnerShiny;
      cell.appendChild(G.UI.spriteCanvas(p.dex, 92, 80, { scale: 2, silhouette: !own, shadow: own, shiny: useShiny }));
      cell.insertAdjacentHTML('beforeend', `<b>${own ? p.name : '???'}</b>${G.UI.stars(p.rarity, 9)}`);
      cell.onclick = () => {
        dexSel = p.dex;
        grid.querySelectorAll('.cell').forEach(c => c.classList.remove('on'));
        cell.classList.add('on');
        showDetail(p.dex);
      };
      grid.appendChild(cell);
    }
    if (more) grid.insertAdjacentHTML('beforeend', `<p class="sub" style="grid-column:1/-1">…and ${more} more. Type a little more to narrow it down.</p>`);
    if (!grid.children.length) grid.innerHTML = query ? '<p class="sub" style="grid-column:1/-1">No Pokémon you own match that.</p>' : '<p class="sub" style="grid-column:1/-1">Ninguno con este filtro.</p>';
  }

  // Variant being viewed in the details (normal or shiny).
  let viewShiny = false;

  function showDetail(dex) {
    const s = G.DB.save;
    const p = G.DEX_BY[dex];
    const own = !!s.owned[dex];
    const hasSh = G.DB.ownsShiny(dex);
    const isPartner = dex === s.partner;
    if (!hasSh) viewShiny = false;
    else if (isPartner && dex !== showDetail.last) viewShiny = !!s.partnerShiny;
    showDetail.last = dex;

    const max = { hp: 183, atk: 1.55, spd: 137 };
    const bar = (label, v, m, txt) =>
      `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${Math.min(100, v / m * 100)}%"></i></div><span>${txt}</span></div>`;
    const usingThis = isPartner && (!hasSh || !!s.partnerShiny === viewShiny);

    const box = $('dex-detail');
    box.innerHTML = `
      <canvas id="dex-big" class="stage" width="220" height="190"></canvas>
      ${hasSh ? `<div class="seg">
          <button class="${viewShiny ? '' : 'on'}" data-v="0">Normal</button>
          <button class="${viewShiny ? 'on' : ''}" data-v="1">${G.Icons.html('shiny', 12)} Shiny</button></div>` : ''}
      <div class="center">
        <div style="color:var(--muted);font-size:13px">Nº ${String(p.dex).padStart(3, '0')} · ${GEN_NAMES[p.gen - 1]}</div>
        <h3>${own ? p.name : '???'}${own && reachedArceus(p.dex) ? ' ' + arcStar(20) : ''}${NEW_DEX.has(p.dex) ? ' <span class="tag-new inline">NEW</span>' : ''}</h3>
        <div style="color:${G.Gacha.RARITY_COLOR[p.rarity]}">${G.UI.stars(p.rarity, 24)} ${G.Gacha.RARITY_NAME[p.rarity]}</div>
        <div style="margin:6px 0">${own ? G.UI.typeChips(p.types) : ''}</div>
      </div>
      ${own ? `
        ${bar('Vida', p.hp, max.hp, p.hp)}
        ${bar('Ataque', p.atk, max.atk, '×' + p.atk.toFixed(2))}
        ${bar('Velocidad', p.spd, max.spd, p.spd)}
        <p style="font-size:14px;margin:10px 0 4px">Empieza con <b class="gold">${G.Moves.BY_ID[G.startMoveOf(dex)].name}</b></p>
        <p class="move-icons">
          ${G.Moves.poolFor(p).map(id => `<span data-mv="${id}">${G.Icons.html('move:' + id, 16)}</span>`).join('')}</p>
        ${usingThis
          ? '<button class="btn grow" disabled style="width:100%">Es tu compañero</button>'
          : `<button id="dex-pick" class="btn gold" data-sfx="confirm" style="width:100%">Elegir de compañero${viewShiny ? ' (shiny)' : ''}</button>`}
      ` : `<p class="center" style="color:var(--muted)">Aún no lo tienes.<br>Consíguelo en el banner de <b class="gold">${GEN_NAMES[p.gen - 1]}</b>
            o derrotándolo cuando salga shiny.</p>`}
    `;
    $('dex-big').style.setProperty('--stage-c', !own ? '#5b83d6' : viewShiny ? '#9ae6ff' : G.U.TYPE_COLOR[p.types[0]]);
    $('dex-big').classList.toggle('shiny', own && viewShiny);
    G.UI.sprite($('dex-big'), dex, { lively: own, spin: own, silhouette: !own, scale: 3, hero: true, shiny: own && viewShiny });
    box.querySelectorAll('.seg button').forEach(b => {
      b.onclick = () => { viewShiny = b.dataset.v === '1'; showDetail(dex); };
    });
    const pick = $('dex-pick');
    if (pick) pick.onclick = () => {
      s.partner = dex;
      s.partnerShiny = hasSh && viewShiny;
      G.DB.commit();
      G.Social.refreshMember();           // if you're in a room, the others see it straight away
      G.UI.toast(p.name + (s.partnerShiny ? ' shiny' : '') + ' es ahora tu compañero');
      renderGrid(); showDetail(dex);
    };
  }

  // ---------------- random partner ----------------

  /*
   * Picks a random Pokémon from the ones you own and makes it your partner. The animation shuffles
   * blacked-out silhouettes, slowing down until it lands on the winner, then reveals it.
   * (A different one from your current partner whenever you own more than one; if you own the
   * shiny version too, it is a coin flip between normal and shiny.)
   */
  let spinning = false;

  function openRandom() {
    const owned = Object.keys(G.DB.save.owned).map(Number).filter(d => G.DEX_BY[d] && G.SPRITE_META[d]);
    if (owned.length < 2) { G.UI.toast('You need at least 2 Pokémon to use the randomiser'); return; }
    $('rnd-name').textContent = '???';
    $('rnd-info').innerHTML = '';
    G.UI.show('scr-random', true);
    spinRandom();
  }

  function spinRandom() {
    if (spinning) return;
    const s = G.DB.save;
    const owned = Object.keys(s.owned).map(Number).filter(d => G.DEX_BY[d] && G.SPRITE_META[d]);
    const pool = owned.length > 1 ? owned.filter(d => d !== s.partner) : owned;
    const target = G.U.pick(pool);
    const shiny = G.DB.ownsShiny(target) && Math.random() < 0.5;
    // The silhouettes it flicks through on the way (all of them are Pokémon you own).
    const N = 24, seq = [];
    while (seq.length < N - 1) seq.push(G.U.pick(owned));
    seq.push(target);
    spinning = true;
    $('rnd-again').disabled = true; $('rnd-done').disabled = true;
    $('rnd-sub').textContent = 'Shuffling…';
    $('rnd-name').textContent = '???';
    $('rnd-info').innerHTML = '';
    const cv = $('rnd-stage');
    cv.style.setProperty('--stage-c', '#5b83d6');
    cv.classList.remove('shiny');
    cv.classList.add('shuffling');
    // Wait (briefly) for the sprites to be ready so no silhouette flashes empty.
    const handles = [...new Set(seq)].map(d => G.Sprites.sheet(d, 'Idle', false)).filter(Boolean);
    const t0 = performance.now();
    const go = () => {
      if (handles.every(h => h.ready || h.failed) || performance.now() - t0 > 2500) return run();
      setTimeout(go, 60);
    };
    const run = () => {
      let i = 0;
      const next = () => {
        G.UI.sprite(cv, seq[i], { silhouette: true, scale: 3, hero: true });
        G.Audio.sfx('hover');
        if (++i < N) {
          // Starts fast and slows right down at the end.
          setTimeout(next, 60 + 360 * Math.pow(i / (N - 1), 2.4));
        } else setTimeout(reveal, 800);
      };
      next();
    };
    const reveal = () => {
      const p = G.DEX_BY[target];
      cv.classList.remove('shuffling');
      cv.style.setProperty('--stage-c', shiny ? '#9ae6ff' : G.U.TYPE_COLOR[p.types[0]]);
      cv.classList.toggle('shiny', shiny);
      G.UI.sprite(cv, target, { lively: true, spin: true, scale: 3, hero: true, shiny });
      $('rnd-name').innerHTML = p.name + (shiny ? ' ' + G.Icons.html('shiny', 22) : '');
      $('rnd-info').innerHTML = G.UI.typeChips(p.types) + ' ' + G.UI.stars(p.rarity);
      $('rnd-sub').textContent = 'Your new partner!';
      G.Audio.sfx(shiny ? 'shinyGet' : p.rarity >= 5 ? 'legend' : 'confirm');
      // It becomes your partner right away (spin again for another one).
      s.partner = target;
      s.partnerShiny = shiny;
      G.DB.commit();
      G.Social.refreshMember();
      spinning = false;
      $('rnd-again').disabled = false; $('rnd-done').disabled = false;
    };
    go();
  }

  // ---------------- upgrades ----------------

  let upgDex = null;

  function openUpgrades() {
    G.UI.show('scr-upgrades', true);
    const s = G.DB.save;
    if (!upgDex || !s.owned[upgDex]) upgDex = s.partner;
    // Picker with your Pokémon: the partner first, then those that already have upgrades.
    const sel = $('upg-mon');
    const lv = d => Object.values(s.pupg[d] || {}).reduce((a, b) => a + b, 0);
    const mons = Object.keys(s.owned).map(Number).filter(d => G.DEX_BY[d])
      .sort((a, b) => (b === s.partner) - (a === s.partner) || lv(b) - lv(a) || a - b);
    sel.innerHTML = mons.map(d => `<option value="${d}">${G.DEX_BY[d].name}${d === s.partner ? ' (compañero)' : ''}${lv(d) ? ' · ' + lv(d) + (G.I18n.lang === 'en' ? (lv(d) === 1 ? ' level' : ' levels') : (lv(d) === 1 ? ' nivel' : ' niveles')) : ''}</option>`).join('');
    sel.value = upgDex;
    sel.onchange = () => { upgDex = +sel.value; G.Audio.sfx('select'); renderUpgrades(); };
    renderUpgrades();
  }

  function renderUpgrades() {
    const s = G.DB.save;
    const levels = G.DB.upgradesOf(upgDex);
    const mon = G.DEX_BY[upgDex];
    const shiny = upgDex === s.partner && !!s.partnerShiny && G.DB.ownsShiny(upgDex);
    G.UI.sprite($('upg-stage'), upgDex, { lively: true, scale: 2, hero: true, shiny });
    $('upg-stage').style.setProperty('--stage-c', shiny ? '#9ae6ff' : G.U.TYPE_COLOR[mon.types[0]]);
    const box = $('upg-list');
    box.innerHTML = '';
    for (const u of G.Upgrades.LIST) {
      const lvl = levels[u.id] || 0;
      const maxed = lvl >= u.max;
      const cost = maxed ? 0 : G.Upgrades.cost(u.id, lvl);
      const el = document.createElement('div');
      el.className = 'panel upg-item';
      el.innerHTML = `
        <div class="ic">${G.Icons.html(u.icon, 32)}</div>
        <div>
          <b>${u.name}</b> <span style="color:var(--muted);font-size:13px">${u.unit}</span>
          <div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>
        </div>
        <div class="upg-btns">
          ${u.id === 'ban' && lvl > 0 ? `<button class="btn small" data-ban>Elegir (${banList().length}/${lvl})</button>` : ''}
          <button class="btn small ${maxed ? '' : 'gold'}" data-buy data-sfx="none" ${maxed || s.coins < cost ? 'disabled' : ''}>
          ${maxed ? 'Máx.' : `<span class="coin"></span> ${cost}`}</button></div>`;
      if (u.id === 'ban' && lvl > 0) el.querySelector('[data-ban]').onclick = () => { banOpen = !banOpen; renderUpgrades(); };
      el.querySelector('[data-buy]').onclick = () => {
        // Everything is read again on pressing (the save may have changed since it was drawn).
        const sv = G.DB.save, lv = G.DB.upgradesOf(upgDex), now = lv[u.id] || 0;
        if (now >= u.max) { renderUpgrades(); return; }
        const price = G.Upgrades.cost(u.id, now);
        if (sv.coins < price) { renderUpgrades(); return; }
        sv.coins -= price;
        lv[u.id] = now + 1;
        G.DB.commit(true);
        G.Audio.sfx('buy');
        G.UI.refreshCoins();
        G.UI.toast(`${mon.name} · ${u.name}: nivel ${now + 1}`);
        renderUpgrades();
      };
      box.appendChild(el);
      if (u.id === 'ban' && lvl > 0 && banOpen) box.appendChild(banPicker(lvl));
    }
    box.appendChild(bindPanel());
  }

  // ---------------- shortcuts: a fixed slot for each move ----------------
  // save.pbind[dex] = [move for slot 1, for 2, for 3, for 4] (or null).
  function bindPanel() {
    const s = G.DB.save;
    s.pbind = s.pbind || {};
    const list = s.pbind[upgDex] || [null, null, null, null];
    const mon = G.DEX_BY[upgDex];
    const ids = G.Moves.poolFor(mon).concat([G.startMoveOf(upgDex)]).filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => G.Moves.BY_ID[a].name.localeCompare(G.Moves.BY_ID[b].name, 'es'));
    const el = document.createElement('div');
    el.className = 'panel bind-panel';
    el.innerHTML = `<b>Atajos de movimientos</b>
      <p class="sub" style="margin:2px 0 8px">Elige qué movimiento va siempre en cada hueco (teclas 1-4 o los iconos de abajo), para la memoria muscular. Si aún no tienes tantos movimientos, va al hueco más cercano.</p>
      <div class="bind-slots">${[0, 1, 2, 3].map(i => `<label class="bind-slot"><span>${i + 1}</span>
        <select class="field" data-slot="${i}"><option value="">Libre</option>${ids.map(id =>
          `<option value="${id}" ${list[i] === id ? 'selected' : ''}>${G.Moves.BY_ID[id].name}</option>`).join('')}</select></label>`).join('')}</div>`;
    el.querySelectorAll('select[data-slot]').forEach(sel => {
      sel.onchange = () => {
        const l = (s.pbind[upgDex] || [null, null, null, null]).slice(0, 4);
        while (l.length < 4) l.push(null);
        const i = +sel.dataset.slot, id = sel.value || null;
        // A move can only be in one slot.
        for (let j = 0; j < 4; j++) if (id && l[j] === id) l[j] = null;
        l[i] = id;
        s.pbind[upgDex] = l;
        G.DB.commit();
        G.Audio.sfx('select');
        renderUpgrades();
      };
    });
    return el;
  }

  // ---------------- veto: blocked moves ----------------
  // List per Pokémon in save.pban[dex]; with N levels of Veto, N moves.
  let banOpen = false;
  function banList() {
    const s = G.DB.save;
    s.pban = s.pban || {};
    return s.pban[upgDex] || (s.pban[upgDex] = []);
  }
  function banPicker(max) {
    const mon = G.DEX_BY[upgDex];
    const start = G.startMoveOf(upgDex);
    const ids = G.Moves.poolFor(mon).filter(id => id !== start)
      .sort((a, b) => G.Moves.BY_ID[a].name.localeCompare(G.Moves.BY_ID[b].name, 'es'));
    const list = banList();
    const el = document.createElement('div');
    el.className = 'panel ban-picker';
    el.innerHTML = `<p class="sub" style="margin:0 0 8px">Toca los movimientos que no quieres que te salgan en las cartas (${list.length}/${max}). El movimiento de inicio no se puede vetar.</p>
      <div class="ban-moves">${ids.map(id => { const d = G.Moves.BY_ID[id]; const on = list.includes(id);
        return `<button class="chip ${on ? 'on ban' : ''}" data-id="${id}" data-mv="${id}">${G.Icons.html('move:' + id, 16)} ${d.name}${on ? ' ' + G.Icons.html('ban', 14) : ''}</button>`; }).join('')}</div>`;
    el.querySelectorAll('[data-id]').forEach(b => {
      b.onclick = () => {
        const l = banList(), id = b.dataset.id, i = l.indexOf(id);
        if (i >= 0) l.splice(i, 1);
        else if (l.length >= max) { G.UI.toast('Ya tienes ' + max + ' vetados: quita uno primero'); return; }
        else l.push(id);
        G.DB.commit();
        G.Audio.sfx('select');
        renderUpgrades();
      };
    });
    return el;
  }

  return { init, open, GEN_NAMES, refreshSocial() { if (G.UI.isOpen('scr-menu')) socialLine(); } };
})();
