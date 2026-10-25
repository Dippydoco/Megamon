/* ============ menu.js — main menu, collection and upgrades ============ */
G.MenuUI = (() => {
  let playing = false;          // a Play click is being handled (waiting for the version check)
  const $ = G.UI.$;
  const GEN_NAMES = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova', 'Kalos', 'Alola', 'Galar', 'Paldea'];
  let dexFilter = 'all', dexGen = 1, dexSel = null;      // dexGen 0: the All tab (every generation)

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
    // Physical or Special (which attacking stat it uses); boosters and status moves have neither.
    const cat = m.cat === 'physical' ? '<span class="mt-cat phys">Physical</span>' : m.cat === 'special' ? '<span class="mt-cat spec">Special</span>' : '';
    el.innerHTML = `<div class="mt-head"><b>${T(m.name)}</b> <span class="mt-type" style="background:${col}">${T(G.U.TYPE_NAME[m.type] || m.type)}</span>
      ${cat} <span class="mt-kind">${G.Icons.KIND_NAME[m.kind] || m.kind}</span></div><div class="mt-desc">${T(m.desc || '')}</div>`;
    el.style.display = 'block';
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = Math.max(6, Math.min(innerWidth - w - 6, ev.clientX + 14)) + 'px';
    el.style.top = Math.max(6, Math.min(innerHeight - h - 6, ev.clientY + 16)) + 'px';
  }
  // Abilities use the same tooltip box: name, category, what it does (and who has it, in the Codex).
  const AB_COL = { Offense: '#ff8a5c', Defense: '#7fb8ff', Mobility: '#8fe07a', Sustain: '#5fe0b0', Status: '#c58aff',
                   Weather: '#ffd23f', Utility: '#d6e0f2', Team: '#ff8ad8' };
  G.AB_COL = AB_COL;
  function showAbilityTip(id, ev) {
    const a = G.ABILITIES && G.ABILITIES[id];
    if (!a) return;
    const el = moveTip(), col = AB_COL[a.c] || '#9fb1c9';
    const who = G.DEX.filter(p => G.MON_ABILITY[p.dex] === id).map(p => p.name);
    el.style.borderColor = col;
    el.innerHTML = `<div class="mt-head"><b>${a.n}</b> <span class="mt-type" style="background:${col}">${a.c}</span></div>
      <div class="mt-desc">${a.d}</div>
      <div class="mt-who">${who.length <= 6 ? who.join(', ') : who.slice(0, 6).join(', ') + ' +' + (who.length - 6) + ' more'}</div>`;
    el.style.display = 'block';
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = Math.max(6, Math.min(innerWidth - w - 6, ev.clientX + 14)) + 'px';
    el.style.top = Math.max(6, Math.min(innerHeight - h - 6, ev.clientY + 16)) + 'px';
  }
  function tipFor(e) {
    const t = e.target.closest && e.target.closest('[data-mv],[data-ab]');
    if (!t) return false;
    if (t.dataset.ab) showAbilityTip(t.dataset.ab, e); else showMoveTip(t.dataset.mv, e);
    return true;
  }
  function hideMoveTip() { const el = document.getElementById('mv-tip'); if (el) el.style.display = 'none'; }
  document.addEventListener('mouseover', e => { if (!tipFor(e)) hideMoveTip(); });
  document.addEventListener('mousemove', e => { tipFor(e); });
  document.addEventListener('scroll', hideMoveTip, true);
  document.addEventListener('click', e => { if (!tipFor(e)) hideMoveTip(); });

  function init() {
    const ICON = { play: 'ball', dex: 'book', codex: 'codex', mini: 'cards', upgrades: 'up', gacha: 'ball4', goals: 'medal3', friends: 'friends', rank: 'trophy', settings: 'gear', shop: 'shop', tower: 'tower' };
    document.querySelectorAll('#scr-menu [data-go]').forEach(b => {
      b.insertAdjacentHTML('afterbegin', `<span class="mi-ico">${G.Icons.html(ICON[b.dataset.go], 26)}</span>`);
      b.dataset.sfx = b.dataset.go === 'play' ? 'confirm' : 'click';
      b.onclick = () => {
        const go = b.dataset.go;
        if (go === 'play') {
          if (G.Social.room) G.LobbyUI.open();
          else if (!playing) {
            // Play clicked twice while the version check runs: start once (the second used to restart the run).
            playing = true;
            G.Updater.gate().then(ok => { playing = false; if (ok) G.Flow.play(); }, () => { playing = false; });
          }
        }
        else if (go === 'tower') {
          // In a room the tower is played as an Expedition, chosen as the room's mode.
          if (G.Social.room) { G.LobbyUI.open(); G.UI.toast('In a room: the host picks Battle Tower as the mode to start an Expedition', 3200); }
          else G.TowerUI.open();
        }
        else if (go === 'dex') openDex();
        else if (go === 'codex') G.CodexUI.open();
        else if (go === 'mini') G.MiniUI.open();
        else if (go === 'upgrades') openUpgrades();
        else if (go === 'shop') G.ShopUI.open();
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
      if (G.DB.guest && !confirm('You\'re a guest: all your progress will be lost. Log out?')) return;
      G.Audio.music(null);
      G.Themes.applyMenu('');          // the next account starts with the classic look until its menu opens
      G.DB.logout().then(() => G.Flow.toLogin());
    };
  }

  // ---------------- main menu ----------------

  /** Today's featured Pokémon under the partner: tap one you own to make it your partner. */
  function featuredStrip() {
    const box = $('menu-featured');
    const list = G.Featured.today();
    if (!list.length) { box.classList.add('hidden'); return; }
    const s = G.DB.save;
    box.classList.remove('hidden');
    box.innerHTML = `<div class="ft-h">Today's featured <b>+${Math.round((G.Featured.BONUS - 1) * 100)}% PokéCoins</b></div><div class="ft-row"></div>` +
      `<div class="ft-note">Everyone can play them today, with every upgrade (except Ban)</div>`;
    const row = box.querySelector('.ft-row');
    for (const d of list) {
      const p = G.DEX_BY[d], own = G.DB.canUse(d);       // featured: on loan to everyone today
      const b = document.createElement('button');
      b.className = 'ft-mon' + (own ? '' : ' locked') + (d === s.partner ? ' on' : '');
      b.title = d === s.partner ? p.name + ' is your partner' : 'Make ' + p.name + ' your partner' + (G.DB.onLoan(d) ? ' (on loan for today)' : '');
      b.appendChild(G.UI.spriteCanvas(d, 52, 46, { scale: 1, silhouette: !own }));
      b.insertAdjacentHTML('beforeend', `<small>${own ? p.name : '???'}</small>`);
      b.onclick = () => {
        if (!own || d === s.partner) return;
        s.partner = d; s.partnerShiny = false;
        G.DB.commit(); G.Social.refreshMember(); G.Audio.sfx('confirm');
        G.UI.toast(p.name + ' is now your partner');
        open();
      };
      row.appendChild(b);
    }
  }

  function open() {
    const s = G.DB.save;
    // A featured Pokémon on loan was your partner and its day is over: back to your last own partner.
    if (s.partner != null && !G.DB.canUse(s.partner)) {
      const gone = (G.DEX_BY[s.partner] || {}).name;
      const back = [s.partnerBack, s.starter].find(d => d != null && G.DB.owns(d))
        ?? Object.keys(s.owned).map(Number).find(d => G.DEX_BY[d]);
      if (back != null) {
        s.partner = back; s.partnerShiny = false; G.DB.commit();
        if (gone) G.UI.toast(gone + '\'s featured day is over: ' + G.DEX_BY[back].name + ' is your partner again', 4200);
      }
    } else if (G.DB.owns(s.partner) && s.partnerBack !== s.partner) s.partnerBack = s.partner;   // remembered for the above
    const mon = G.DEX_BY[s.partner];
    const shiny = !!s.partnerShiny && G.DB.ownsShiny(mon.dex);
    G.Themes.applyMenu();            // your Arceus Shop menu theme
    G.UI.chrome(true);
    G.UI.show('scr-menu');
    G.KeyItemUI.renderSlot();        // the Key Item you'll take into your next run
    G.UI.sprite($('menu-partner'), mon.dex, { lively: true, scale: 4, hero: true, shiny });
    $('menu-partner').style.setProperty('--stage-c', shiny ? '#9ae6ff' : G.U.TYPE_COLOR[mon.types[0]]);
    $('menu-partner').classList.toggle('shiny', shiny);
    $('menu-partner-name').innerHTML = mon.name + (shiny ? ' ' + G.Icons.html('shiny', 24) : '') + (reachedArceus(mon.dex) ? ' ' + arcStar(24, mon.dex) : '');
    $('menu-partner-info').innerHTML = G.UI.typeChips(mon.types) + ' ' + G.UI.stars(mon.rarity);
    featuredStrip();
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

    // Gacha tile: tickets ready to use.
    const tk = s.tickets || { t1: 0, t10: 0 };
    const pulls = (tk.t1 || 0) + (tk.t10 || 0);
    $('menu-gacha-sub').textContent = pulls ? pulls + (pulls === 1 ? ' ticket ready' : ' tickets ready') : 'Pokémon and shinies';
    $('menu-gacha-sub').classList.toggle('gold', pulls > 0);
    // Upgrades tile: how many levels your partner has.
    const plv = Object.values(s.pupg && s.pupg[s.partner] || {}).reduce((a, b) => a + b, 0);
    $('menu-upg-sub').textContent = plv ? mon.name + ': ' + plv + (plv === 1 ? ' level' : ' levels') : 'Stronger every run';
    // Shop tile: what you can afford right now.
    const canKey = G.KeyItems.LIST.filter(k => !G.KeyItems.owns(k.id) && s.coins >= k.price).length;
    const stars = G.DB.stars();
    $('menu-shop-sub').textContent = stars ? stars + (stars === 1 ? ' Star to spend' : ' Stars to spend')
      : canKey ? canKey + (canKey === 1 ? ' Key Item to buy' : ' Key Items to buy') : 'Key Items and themes';
    $('menu-shop-sub').classList.toggle('gold', stars > 0 || canKey > 0);

    // Battle Tower tile: your checkpoint and Battle Points.
    const T = s.tower || {};
    $('menu-tower-sub').textContent = T.best ? 'Best ' + T.best + 'F · ' + (T.bp || 0) + ' BP' : 'Climb 50 floors';
    $('menu-tower-sub').classList.toggle('gold', (T.bp || 0) >= 40);

    // Your record, in a small line under the partner (it used to be a box under the menu).
    const st = s.stats;
    $('menu-stats').innerHTML =
      `Runs <b>${st.runs}</b> · Best <b>${G.U.mmss(st.bestTime)}</b> · Lv <b>${st.bestLevel}</b> · Defeated <b>${st.totalKills.toLocaleString('en')}</b>` +
      (G.DB.guest ? '<br><span class="guest">Guest mode: nothing is saved</span>' : '');

    socialLine();
    // Mission rewards waiting to be collected.
    G.Progress.checkAch();
    const pend = G.Progress.pending();
    $('menu-goals-sub').textContent = pend ? pend + (pend === 1 ? ' reward to claim' : ' rewards to claim') : 'Achievements and profile';
    $('menu-goals-sub').classList.toggle('gold', pend > 0);
    tileAlert('goals', pend > 0);
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
    if (play) play.textContent = room ? 'Back to your room (' + room.members.length + '/' + G.Social.MAX_PLAYERS + ')' : 'Enter the dungeon';
    const fr = G.Social.friends;
    const on = fr.filter(f => f.status === 'ok' && f.online).length;
    const req = fr.filter(f => f.status === 'in').length;
    const parts = [];
    if (on) parts.push(on + ' online');
    if (req) parts.push(req + (req === 1 ? ' request' : ' requests'));
    const msgs = G.Chat ? G.Chat.totalUnread() : 0;
    if (msgs) parts.push(msgs + (msgs === 1 ? ' new message' : ' new messages'));
    $('menu-friends-sub').textContent = parts.length ? parts.join(' · ') : 'Play in a group, up to 5';
    $('menu-friends-sub').classList.toggle('gold', req > 0 || msgs > 0);
    tileAlert('friends', req > 0 || msgs > 0);
  }

  /** Red dot on a menu tile: something there is waiting for you. */
  function tileAlert(go, on) {
    const b = document.querySelector('#scr-menu [data-go=' + go + ']');
    if (b) b.classList.toggle('alert', !!on);
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
    // All: every generation at once (24-10-2026).
    const all = document.createElement('button');
    const haveAll = G.DEX.filter(p => s.owned[p.dex]).length;
    all.className = 'gen-tab' + (dexGen === 0 ? ' on' : '');
    all.innerHTML = `<b>All</b><small>${haveAll}/${G.DEX.length}</small>`;
    all.onclick = () => { dexGen = 0; openDex(); };
    tabs.appendChild(all);
    GEN_NAMES.forEach((name, i) => {
      const g = i + 1;
      const total = G.DEX.filter(p => p.gen === g).length;
      const have = G.DEX.filter(p => p.gen === g && s.owned[p.dex]).length;
      const b = document.createElement('button');
      const charm = have === total;
      b.className = 'gen-tab' + (g === dexGen ? ' on' : '') + (charm ? ' charm' : '');
      b.innerHTML = `<b>${name}</b><small>${charm ? G.Icons.html('shiny', 10) + ' ' : ''}${have}/${total}</small>`;
      if (charm) b.title = 'Complete! Shiny Charm: shiny odds ×' + G.Charms.MULT + ' for ' + name + ' Pokémon';
      b.onclick = () => { dexGen = g; openDex(); };
      tabs.appendChild(b);
    });

    const F = [['all', 'All'], ['fav', 'Favourites'], ['own', 'Owned'], ['miss', 'Missing'], ['shiny', 'Shiny'], ['new', 'New'],
               ['5', 5], ['4', 4], ['3', 3], ['2', 2], ['1', 1]];
    const fb = $('dex-filters');
    fb.innerHTML = '';
    for (const [k, label] of F) {
      const c = document.createElement('button');
      c.className = 'chip' + (k === dexFilter ? ' on' : '');
      c.innerHTML = k === 'fav' ? G.Icons.html('heart', 12) + ' Favourites'
                  : k === 'shiny' ? G.Icons.html('shiny', 12) + ' Shiny'
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

  /** Favourite Pokémon (heart in the Pokémon tab, and the Favourites filter). */
  const isFav = dex => !!(G.DB.save.favMon && G.DB.save.favMon[dex]);

  /** Gold star: this Pokémon has reached Arceus in a run. */
  const reachedArceus = dex => !!(G.DB.save.arceus && G.DB.save.arceus[dex]);
  const arcTimes = dex => G.arcCount(G.DB.save, dex);   // times THIS Pokémon has reached Arceus
  const arcTitle = dex => 'Reached Arceus' + (arcTimes(dex) > 1 ? ' · ' + arcTimes(dex) + ' times with this Pokémon' : '');
  const arcStar = (size, dex) => `<span title="${arcTitle(dex)}">${G.Icons.html('star', size)}${arcTimes(dex) > 1 ? `<small style="color:#ffe27a;font-weight:800;margin-left:2px">×${arcTimes(dex)}</small>` : ''}</span>`;

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

  // The All tab can show ~1,000 cells: their sprites are drawn only as they scroll into view.
  let dexIO = null;
  function renderGrid() {
    const s = G.DB.save;
    const grid = $('dex-grid');
    grid.innerHTML = '';
    const query = fold(dexQuery).trim();
    if (dexIO) { dexIO.disconnect(); dexIO = null; }
    if (dexGen === 0 && !query && 'IntersectionObserver' in window) {
      dexIO = new IntersectionObserver(list => {
        for (const en of list) {
          if (!en.isIntersecting) continue;
          dexIO.unobserve(en.target);
          const d = en.target._lazy;
          if (d) { en.target._lazy = null; G.UI.sprite(en.target, d.dex, d.opts); }
        }
      }, { rootMargin: '400px 0px' });
    }
    const numQ = /^\d+$/.test(query) ? +query : 0;
    let shown = 0, more = 0;
    for (const p of G.DEX) {
      if (query) {
        const known = G.DB.canUse(p.dex);
        const hit = (known && fold(p.name).includes(query)) || (numQ && (String(p.dex) === String(numQ) || String(p.dex).startsWith(String(numQ))));
        if (!hit) continue;
      } else if (dexGen && p.gen !== dexGen && dexFilter !== 'new' && dexFilter !== 'fav') continue;      // these filters show every generation
      const own = G.DB.canUse(p.dex), sh = !!(s.shiny && s.shiny[p.dex]);     // (featured ones are on loan today)
      const fav = own && isFav(p.dex);
      if (dexFilter === 'fav' && !fav) continue;
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
      if (fav) cell.insertAdjacentHTML('beforeend', `<span class="badge-fav" title="Favourite">${G.Icons.html('heart', 12)}</span>`);
      if (own && reachedArceus(p.dex)) cell.insertAdjacentHTML('beforeend', `<span class="badge-arc${p.dex === s.partner || sh ? ' shift' : ''}" title="${arcTitle(p.dex)}">${G.Icons.html('star', 14)}</span>`);
      if (p.dex === s.partner) cell.insertAdjacentHTML('beforeend', `<span class="badge-r" title="Partner">${G.Icons.html('crown', 14)}</span>`);
      else if (sh) cell.insertAdjacentHTML('beforeend', `<span class="badge-r" title="You have its shiny">${G.Icons.html('shiny', 12)}</span>`);
      const useShiny = sh && p.dex === s.partner && s.partnerShiny;
      const sOpts = { scale: 2, silhouette: !own, shadow: own, shiny: useShiny };
      if (dexIO) {
        const cv = document.createElement('canvas');
        cv.width = 92; cv.height = 80; cv._lazy = { dex: p.dex, opts: sOpts };
        cell.appendChild(cv);
        dexIO.observe(cv);
      } else cell.appendChild(G.UI.spriteCanvas(p.dex, 92, 80, sOpts));
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
    if (!grid.children.length) grid.innerHTML = query ? '<p class="sub" style="grid-column:1/-1">No Pokémon you own match that.</p>' : '<p class="sub" style="grid-column:1/-1">None with this filter.</p>';
  }

  // Variant being viewed in the details (normal or shiny).
  let viewShiny = false;

  function showDetail(dex) {
    const s = G.DB.save;
    const p = G.DEX_BY[dex];
    const own = G.DB.canUse(dex), loan = G.DB.onLoan(dex);
    const hasSh = G.DB.ownsShiny(dex);
    const isPartner = dex === s.partner;
    if (!hasSh) viewShiny = false;
    else if (isPartner && dex !== showDetail.last) viewShiny = !!s.partnerShiny;
    showDetail.last = dex;

    const max = { hp: 183, atk: 1.55, spa: 1.55, def: 150, spd: 137 };
    const LEAN = { physical: 'Physical attacker: better with physical moves', special: 'Special attacker: better with special moves',
                   mixed: 'Mixed attacker: as good with physical as with special moves' };
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
        <h3>${own ? p.name : '???'}${own && reachedArceus(p.dex) ? ' ' + arcStar(20, p.dex) : ''}${NEW_DEX.has(p.dex) ? ' <span class="tag-new inline">NEW</span>' : ''}</h3>
        <div style="color:${G.Gacha.RARITY_COLOR[p.rarity]}">${G.UI.stars(p.rarity, 24)} ${G.Gacha.RARITY_NAME[p.rarity]}</div>
        ${loan ? '<div class="loan-note">Featured today: on loan until the day ends</div>' : ''}
        <div style="margin:6px 0">${own ? G.UI.typeChips(p.types) : ''}</div>
        ${own && G.abilityOf(dex) ? `<div class="ab-line">Ability <span class="ab-chip" data-ab="${G.abilityOf(dex).id}" style="--ac:${AB_COL[G.abilityOf(dex).c]}">${G.abilityOf(dex).n}</span></div>` : ''}
      </div>
      ${own ? `
        ${bar('HP', p.hp, max.hp, p.hp)}
        ${bar('Attack', p.atk, max.atk, '×' + p.atk.toFixed(2))}
        ${bar('Sp. Atk', p.spa, max.spa, '×' + p.spa.toFixed(2))}
        ${p.def != null ? bar('Defense', p.def, max.def, p.def) : ''}
        ${bar('Speed', p.spd, max.spd, p.spd)}
        <p style="font-size:13px;margin:6px 0 0;color:var(--muted)">${LEAN[p.lean] || ''}</p>
        <p style="font-size:14px;margin:10px 0 4px">Starts with <b class="gold">${G.Moves.BY_ID[G.startMoveOf(dex)].name}</b></p>
        <p class="move-icons">
          ${G.Moves.poolFor(p).map(id => `<span data-mv="${id}">${G.Icons.html('move:' + id, 16)}</span>`).join('')}</p>
        <button id="dex-fav" class="btn ghost" style="width:100%;margin-bottom:6px">${G.Icons.html('heart', 14)} ${isFav(dex) ? 'Remove from favourites' : 'Add to favourites'}</button>
        ${usingThis
          ? '<button class="btn grow" disabled style="width:100%">It\'s your partner</button>'
          : `<button id="dex-pick" class="btn gold" data-sfx="confirm" style="width:100%">Choose as partner${viewShiny ? ' (shiny)' : ''}</button>`}
      ` : `<p class="center" style="color:var(--muted)">You don't have it yet.<br>Get it from the <b class="gold">${GEN_NAMES[p.gen - 1]}</b> banner
            or by defeating it when it appears as a shiny.</p>`}
    `;
    $('dex-big').style.setProperty('--stage-c', !own ? '#5b83d6' : viewShiny ? '#9ae6ff' : G.U.TYPE_COLOR[p.types[0]]);
    $('dex-big').classList.toggle('shiny', own && viewShiny);
    G.UI.sprite($('dex-big'), dex, { lively: own, spin: own, silhouette: !own, scale: 3, hero: true, shiny: own && viewShiny });
    box.querySelectorAll('.seg button').forEach(b => {
      b.onclick = () => { viewShiny = b.dataset.v === '1'; showDetail(dex); };
    });
    const favBtn = $('dex-fav');
    if (favBtn) favBtn.onclick = () => {
      s.favMon = s.favMon || {};
      if (s.favMon[dex]) delete s.favMon[dex]; else s.favMon[dex] = 1;
      G.DB.commit();
      G.UI.toast(p.name + (s.favMon[dex] ? ' added to' : ' removed from') + ' favourites');
      renderGrid(); showDetail(dex);
    };
    const pick = $('dex-pick');
    if (pick) pick.onclick = () => {
      s.partner = dex;
      s.partnerShiny = hasSh && viewShiny;
      G.DB.commit();
      G.Social.refreshMember();           // if you're in a room, the others see it straight away
      G.UI.toast((s.partnerShiny ? 'Shiny ' : '') + p.name + ' is now your partner');
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
    if (!upgDex || !G.DB.canUse(upgDex)) upgDex = s.partner;
    // Picker with your Pokémon: the partner first, then those that already have upgrades.
    const sel = $('upg-mon');
    const lv = d => Object.values(s.pupg[d] || {}).reduce((a, b) => a + b, 0);
    const mons = [...new Set([...Object.keys(s.owned).map(Number), ...G.Featured.today().filter(d => G.DB.canUse(d))])].filter(d => G.DEX_BY[d])
      .sort((a, b) => (b === s.partner) - (a === s.partner) || lv(b) - lv(a) || a - b);
    sel.innerHTML = mons.map(d => `<option value="${d}">${G.DEX_BY[d].name}${d === s.partner ? ' (partner)' : ''}${lv(d) ? ' · ' + lv(d) + (lv(d) === 1 ? ' level' : ' levels') : ''}</option>`).join('');
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
    // Featured today: runs use every upgrade at max (except Ban); what's bought here is kept for later.
    const feat = G.Featured.is(upgDex);
    $('upg-feat').classList.toggle('hidden', !feat);
    if (feat) $('upg-feat').innerHTML = `${G.Icons.html('star', 16)} <b>${mon.name} is featured today:</b> in runs it has every upgrade at max, except Ban. ` +
      `What you buy here is yours to keep after today.`;
    const box = $('upg-list');
    box.innerHTML = '';
    let banLvl = 0, startLvl = 0;
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
          ${u.id === 'ban' && lvl > 0 ? `<button class="btn small" data-ban>Choose (${banList().length}/${lvl})</button>` : ''}
          ${u.id === 'moves' && lvl > 0 ? `<button class="btn small" data-start>Choose (${startList().length}/${lvl})</button>` : ''}
          <button class="btn small ${maxed ? '' : 'gold'}" data-buy data-sfx="none" ${maxed || s.coins < cost ? 'disabled' : ''}>
          ${maxed ? 'Max.' : `<span class="coin"></span> ${cost}`}</button></div>`;
      if (u.id === 'ban' && lvl > 0) el.querySelector('[data-ban]').onclick = () => { banOpen = !banOpen; banScroll = banOpen; renderUpgrades(); };
      if (u.id === 'moves' && lvl > 0) el.querySelector('[data-start]').onclick = () => { startOpen = !startOpen; startScroll = startOpen; renderUpgrades(); };
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
        G.UI.toast(`${mon.name} · ${u.name}: level ${now + 1}`);
        renderUpgrades();
      };
      box.appendChild(el);
      if (u.id === 'ban') banLvl = lvl;
      if (u.id === 'moves') startLvl = lvl;
    }
    if (startLvl > 0 && startOpen) {
      const pk = startPicker(startLvl);
      box.appendChild(pk);
      if (startScroll) { startScroll = false; setTimeout(() => pk.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30); }
    }
    // The ban picker goes AFTER the whole list (it used to sit between Ban and Skip, which pushed Skip off the screen).
    if (banLvl > 0 && banOpen) {
      const pk = banPicker(banLvl);
      box.appendChild(pk);
      if (banScroll) { banScroll = false; setTimeout(() => pk.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30); }
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
      .sort((a, b) => G.Moves.BY_ID[a].name.localeCompare(G.Moves.BY_ID[b].name, 'en'));
    const el = document.createElement('div');
    el.className = 'panel bind-panel';
    el.innerHTML = `<b>Move shortcuts</b>
      <p class="sub" style="margin:2px 0 8px">Choose which move always goes in each slot (keys 1-4 or the icons at the bottom), for muscle memory. If you don't have that many moves yet, it goes to the nearest slot.</p>
      <div class="bind-slots">${[0, 1, 2, 3].map(i => `<label class="bind-slot"><span>${i + 1}</span>
        <select class="field" data-slot="${i}"><option value="">Free</option>${ids.map(id =>
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

  // ---------------- starting moves: the moves a run begins with ----------------
  // List per Pokémon in save.pstart[dex]; with N levels of Starting Moves, up to N moves (game.js startRun).
  let startOpen = false, startScroll = false;
  function startList() {
    const s = G.DB.save;
    s.pstart = s.pstart || {};
    return s.pstart[upgDex] || (s.pstart[upgDex] = []);
  }
  function startPicker(max) {
    const mon = G.DEX_BY[upgDex];
    const def = G.startMoveOf(upgDex);
    const ids = G.startableMoves(mon)
      .sort((a, b) => (b === def) - (a === def) || G.Moves.BY_ID[a].name.localeCompare(G.Moves.BY_ID[b].name, 'en'));
    const list = startList();
    const dn = G.Moves.BY_ID[def].name;
    const rest = list.length >= max ? ''
      : max >= 2 ? (list.length ? ' The open pick is filled with ' + dn + ' (or a random attacking move if you chose ' + dn + ').' : ' With none chosen you start with ' + dn + ' and a random attacking move.')
      : ' With none chosen you start with ' + dn + '.';
    const el = document.createElement('div');
    el.className = 'panel ban-picker';
    el.innerHTML = `<p class="sub" style="margin:0 0 8px">Tap the move${max > 1 ? 's' : ''} ${mon.name} starts every run with (${list.length}/${max}).${rest}</p>
      <div class="ban-moves">${ids.map(id => { const d = G.Moves.BY_ID[id]; const on = list.includes(id);
        return `<button class="chip ${on ? 'on' : ''}" data-id="${id}" data-mv="${id}">${G.Icons.html('move:' + id, 16)} ${d.name}${id === def ? ' <small>(default)</small>' : ''}${on ? ' ' + G.Icons.html('star', 14) : ''}</button>`; }).join('')}</div>`;
    el.querySelectorAll('[data-id]').forEach(b => {
      b.onclick = () => {
        const l = startList(), id = b.dataset.id, i = l.indexOf(id);
        if (i >= 0) l.splice(i, 1);
        else if (l.length >= max) {
          if (max === 1) l.splice(0, 1, id);                  // one pick: tapping another swaps it
          else { G.UI.toast('You already have ' + max + ' chosen: remove one first'); return; }
        } else l.push(id);
        G.DB.commit();
        G.Audio.sfx('select');
        renderUpgrades();
      };
    });
    return el;
  }

  // ---------------- veto: blocked moves ----------------
  // List per Pokémon in save.pban[dex]; with N levels of Veto, N moves.
  let banOpen = false, banScroll = false;
  function banList() {
    const s = G.DB.save;
    s.pban = s.pban || {};
    return s.pban[upgDex] || (s.pban[upgDex] = []);
  }
  function banPicker(max) {
    const mon = G.DEX_BY[upgDex];
    const start = G.startMoveOf(upgDex);
    const ids = G.Moves.poolFor(mon).filter(id => id !== start)
      .sort((a, b) => G.Moves.BY_ID[a].name.localeCompare(G.Moves.BY_ID[b].name, 'en'));
    const list = banList();
    const el = document.createElement('div');
    el.className = 'panel ban-picker';
    el.innerHTML = `<p class="sub" style="margin:0 0 8px">Tap the moves you don't want in your cards (${list.length}/${max}). The starting move can't be banned.</p>
      <div class="ban-moves">${ids.map(id => { const d = G.Moves.BY_ID[id]; const on = list.includes(id);
        return `<button class="chip ${on ? 'on ban' : ''}" data-id="${id}" data-mv="${id}">${G.Icons.html('move:' + id, 16)} ${d.name}${on ? ' ' + G.Icons.html('ban', 14) : ''}</button>`; }).join('')}</div>`;
    el.querySelectorAll('[data-id]').forEach(b => {
      b.onclick = () => {
        const l = banList(), id = b.dataset.id, i = l.indexOf(id);
        if (i >= 0) l.splice(i, 1);
        else if (l.length >= max) { G.UI.toast('You already have ' + max + ' banned: remove one first'); return; }
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
