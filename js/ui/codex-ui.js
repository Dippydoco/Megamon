/* ============ codex-ui.js — the Codex: every move in the game, browsable ============
 * Opened from the main menu. Lists every move (old, new and burst) with its type, style,
 * cooldown, power, what it does and what it evolves into, without having to find a Pokémon
 * that learns it. Filter by type and style, search by name, sort, and click a move for the
 * full details (its 5 levels, its evolution and its effects).
 *
 * Built to grow into the encyclopedia: each section (only "Moves" for now) is an entry in
 * SECTIONS with its own render(); add items, shrines... there and a tab appears for each.
 * Everything is read from the game data (G.Moves, G.LevelUp.STATS), so new moves show up on their own.
 */
G.CodexUI = (() => {
  const CAT = { physical: 'Physical', special: 'Special' };   // uses Attack / Sp. Atk
  const $ = G.UI.$;
  const ORDER = ['normal', 'fire', 'water', 'grass', 'electric', 'psychic', 'poison', 'ground', 'flying', 'bug',
                 'rock', 'ice', 'fighting', 'ghost', 'dragon', 'fairy', 'steel', 'dark'];
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fmt = n => (Math.round(n * 100) / 100).toString();
  // "New" tag: moves added in the last 30 days (their `added` date in data/moves.js).
  const NEW_DAYS = 30;
  const isNew = m => !!m.added && Date.now() - Date.parse(m.added + 'T00:00:00Z') < NEW_DAYS * 864e5;
  const NEW_TAG = '<span class="cx-new">New</span>';

  // What the player picked last (kept while the page is open).
  const st = { section: 'moves', type: 'all', kind: 'all', sort: 'type', q: '', only: '', sel: null };

  // ---------------- move facts ----------------

  /** Upgrade (level-up card) that unlocks the evolution: { name, icon }. */
  function needOf(id) {
    const s = G.LevelUp.STATS.find(x => x.id === id);
    return s ? { name: s.title, icon: s.icon } : { name: G.Moves.NEED_NAME[id] || id, icon: 'up' };
  }

  /** Short effect tags for a move ("Burns", "Homing"...). */
  function effects(m) {
    const out = [], fx = m.fx || {};
    if (m.burn) out.push('Burns');
    if (m.poison) out.push('Poisons');
    if (m.slow) out.push('Slows');
    if (fx.freeze) out.push('Can freeze');
    if (fx.chill) out.push('Freezes on repeated hits');
    if (fx.stun) out.push('Can stun');
    if (fx.vuln) out.push('Enemies take +25% damage');
    if (fx.drain || m.drain) out.push('Heals you');
    if (fx.exec) out.push('Finishes off weak enemies');
    if (m.hex) out.push('Bonus vs. statused enemies');
    if (m.homing) out.push('Homing');
    if (m.pierce > 0 && m.kind !== 'boomerang') out.push('Pierces');
    if (m.knock >= 60 && m.kind !== 'burst') out.push('Knockback');
    if (m.taunt || m.id === 'substitute') out.push('Draws enemies');
    if (m.kind === 'burst') out.push('Charges in the background', 'Can\'t be bonded');
    return out;
  }

  /** The numbers worth showing, as [label, value] rows. */
  function statsOf(m) {
    // (Orbits are always out: their "cooldown" is how often each orb can hit the same enemy.)
    const r = [m.kind === 'orbit' ? ['Hits every', fmt(m.cd) + ' s'] : ['Cooldown', fmt(m.cd) + ' s']];
    if (m.dmg) r.push(['Power', fmt(m.dmg)]);
    if (m.kind === 'buff') r.push(['Per stack', '+' + Math.round(m.amount * (m.stat === 'regen' ? 1 : 100)) + (m.stat === 'regen' ? ' HP/s' : '%')], ['Max stacks', m.stacks], ['Lasts', fmt(m.dur) + ' s']);
    if (m.count > 1 && m.kind !== 'buff') r.push([m.kind === 'chain' ? 'Jumps' : m.kind === 'orbit' ? 'Orbs' : m.kind === 'mine' ? 'Mines' : m.kind === 'meteor' || m.id === 'draco-meteor' ? 'Meteors' : 'Shots', m.count]);
    if (m.pierce > 0 && m.kind !== 'boomerang') r.push(['Pierce', m.pierce]);
    if (m.radius && m.kind !== 'chain') r.push([['beam', 'dash', 'boomerang'].includes(m.kind) || m.id === 'hyper-beam' ? 'Range' : 'Radius', Math.round(m.radius)]);
    if (m.kind === 'burst' && m.dur) r.push([m.id === 'thunder-wave' ? 'Stun' : 'Lasts', fmt(m.dur) + ' s']);
    if (m.amount && m.kind === 'burst') r.push(['Heals', Math.round(m.amount * 100) + '% HP']);
    if (m.selfHp) r.push(['HP cost', Math.round(m.selfHp * 100) + '%']);
    return r;
  }

  function evoOf(m) {
    const e = G.Moves.EVO[m.id];
    if (!e) return null;
    const inst = G.Moves.instance(m.id, m.maxLvl);
    const info = G.Moves.evoInfo(inst, {});
    return { name: e[0], need: needOf(e[1]), text: info ? info.text : '' };
  }

  // ---------------- filtering and sorting ----------------

  const SORTS = {
    type:  { label: 'Type', fn: (a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type) || a.name.localeCompare(b.name) },
    name:  { label: 'Name (A–Z)', fn: (a, b) => a.name.localeCompare(b.name) },
    cdUp:  { label: 'Cooldown (fastest first)', fn: (a, b) => a.cd - b.cd || a.name.localeCompare(b.name) },
    cdDn:  { label: 'Cooldown (slowest first)', fn: (a, b) => b.cd - a.cd || a.name.localeCompare(b.name) },
    power: { label: 'Power (highest first)', fn: (a, b) => (b.dmg || 0) - (a.dmg || 0) || a.name.localeCompare(b.name) },
    style: { label: 'Style', fn: (a, b) => (G.Icons.KIND_NAME[a.kind] || '').localeCompare(G.Icons.KIND_NAME[b.kind] || '') || a.name.localeCompare(b.name) },
    evo:   { label: 'Evolution upgrade', fn: (a, b) => evoNeed(a).localeCompare(evoNeed(b)) || a.name.localeCompare(b.name) }
  };
  const evoNeed = m => { const e = G.Moves.EVO[m.id]; return e ? needOf(e[1]).name : '~'; };

  function partner() { return G.DEX_BY[G.DB.save && G.DB.save.partner]; }

  function list() {
    const q = st.q.trim().toLowerCase();
    const learn = st.only === 'partner' && partner() ? new Set(G.Moves.poolFor(partner())) : null;
    return G.Moves.ALL.filter(m => {
      if (st.type !== 'all' && m.type !== st.type) return false;
      if (st.kind !== 'all' && m.kind !== st.kind) return false;
      if (st.only === 'evo' && !G.Moves.EVO[m.id]) return false;
      if (st.only === 'burst' && m.kind !== 'burst') return false;
      if (st.only === 'new' && !isNew(m)) return false;
      if (learn && !learn.has(m.id)) return false;
      if (q) {
        const e = G.Moves.EVO[m.id];
        const hay = (m.name + ' ' + (e ? e[0] : '') + ' ' + G.U.TYPE_NAME[m.type] + ' ' + (G.Icons.KIND_NAME[m.kind] || '') + ' ' + (CAT[m.cat] || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort(SORTS[st.sort].fn);
  }

  // ---------------- drawing ----------------

  function renderControls() {
    const types = ORDER.filter(t => G.Moves.POOL[t]);
    $('cx-types').innerHTML = `<button class="chip${st.type === 'all' ? ' on' : ''}" data-type="all">All types</button>` +
      types.map(t => `<button class="chip cx-tchip${st.type === t ? ' on' : ''}" data-type="${t}" style="--tc:${G.U.TYPE_COLOR[t]}">${G.U.TYPE_NAME[t]}</button>`).join('');
    const kinds = [...new Set(G.Moves.ALL.map(m => m.kind))].sort((a, b) => (G.Icons.KIND_NAME[a] || a).localeCompare(G.Icons.KIND_NAME[b] || b));
    $('cx-kind').innerHTML = '<option value="all">All styles</option>' + kinds.map(k => `<option value="${k}"${st.kind === k ? ' selected' : ''}>${G.Icons.KIND_NAME[k] || k}</option>`).join('');
    $('cx-sort').innerHTML = Object.entries(SORTS).map(([k, s]) => `<option value="${k}"${st.sort === k ? ' selected' : ''}>Sort: ${s.label}</option>`).join('');
    const p = partner();
    const anyNew = G.Moves.ALL.some(isNew);
    const ONLY = [['', 'All moves']].concat(anyNew ? [['new', 'New']] : [], [['evo', 'Evolve'], ['burst', 'Burst moves']], p ? [['partner', 'Learnable by ' + p.name]] : []);
    if ((st.only === 'partner' && !p) || (st.only === 'new' && !anyNew)) st.only = '';
    $('cx-only').innerHTML = ONLY.map(([k, l]) => `<button class="chip${st.only === k ? ' on' : ''}" data-only="${k}">${esc(l)}</button>`).join('');
  }

  function renderList() {
    const rows = list();
    $('cx-count').textContent = rows.length === G.Moves.ALL.length ? rows.length + ' moves' : rows.length + ' of ' + G.Moves.ALL.length + ' moves';
    if (!rows.length) { $('cx-list').innerHTML = '<p class="sub cx-empty">No move matches. Try another filter.</p>'; return; }
    $('cx-list').innerHTML = rows.map(m => {
      const e = G.Moves.EVO[m.id];
      const evo = e ? `<span class="cx-evo">→ ${esc(e[0])} ${G.Icons.html(needOf(e[1]).icon, 12)}</span>` : m.kind === 'burst' ? '<span class="cx-evo cx-burst">Burst</span>' : '<span class="cx-evo cx-none">Doesn\'t evolve</span>';
      return `<button class="cx-row${st.sel === m.id ? ' on' : ''}" data-id="${m.id}" style="--tc:${G.U.TYPE_COLOR[m.type]}">
        <span class="cx-ico">${G.Icons.html('move:' + m.id, 32)}</span>
        <span class="cx-main"><b>${esc(m.name)}${isNew(m) ? NEW_TAG : ''}</b><span class="cx-tags">${G.UI.typeChips([m.type])}<span class="cx-kind">${G.Icons.KIND_NAME[m.kind] || m.kind}${CAT[m.cat] ? ' · ' + CAT[m.cat] : ''}</span></span></span>
        <span class="cx-num"><small>Cooldown</small>${m.kind === 'orbit' ? 'Always on' : fmt(m.cd) + ' s'}</span>
        <span class="cx-num"><small>Power</small>${m.dmg ? fmt(m.dmg) : '—'}</span>
        ${evo}
      </button>`;
    }).join('');
  }

  function renderDetail() {
    const m = G.Moves.BY_ID[st.sel];
    const box = $('cx-detail');
    if (!m) { box.innerHTML = '<p class="sub">Pick a move to see everything about it: its 5 levels, what it evolves into and how.</p>'; return; }
    const col = G.U.TYPE_COLOR[m.type];
    const evo = evoOf(m);
    const fx = effects(m);
    const p = partner();
    const learns = p && G.Moves.poolFor(p).includes(m.id);
    box.style.setProperty('--tc', col);
    box.innerHTML = `
      <div class="cx-dhead">${G.Icons.html('move:' + m.id, 48)}<div><h3>${esc(m.name)}${isNew(m) ? NEW_TAG : ''}</h3>${G.UI.typeChips([m.type])}<span class="cx-kind">${G.Icons.KIND_NAME[m.kind] || m.kind}${CAT[m.cat] ? ' · ' + CAT[m.cat] : ''}</span></div></div>
      <p class="cx-desc">${esc(m.desc)}</p>
      ${fx.length ? `<div class="cx-fx">${fx.map(f => `<span>${esc(f)}</span>`).join('')}</div>` : ''}
      <div class="cx-stats">${statsOf(m).map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('')}</div>
      <h4>Levels</h4>
      <ol class="cx-ups"><li>Learned</li>${m.ups.map(u => `<li>${esc(u.t)}</li>`).join('')}</ol>
      <h4>Evolution</h4>
      ${evo ? `<p class="cx-evobox"><b>${esc(evo.name)}</b><br>At level ${m.maxLvl}, once you've taken ${G.Icons.html(evo.need.icon, 14)} <b>${esc(evo.need.name)}</b> in that run.<br><span class="sub">${esc(evo.text)}</span></p>`
            : `<p class="sub">${m.kind === 'buff' ? 'Boosters don\'t evolve.' : m.kind === 'burst' ? 'Burst moves don\'t evolve: they get stronger through their own levels.' : 'This move doesn\'t evolve.'}</p>`}
      <p class="sub cx-who">Learned by ${m.type === 'normal' ? 'every Pokémon' : G.U.TYPE_NAME[m.type] + '-type Pokémon'}.${p ? (learns ? ' Your partner ' + esc(p.name) + ' can learn it.' : ' Your partner ' + esc(p.name) + ' can\'t learn it.') : ''}</p>`;
  }

  function renderMoves() {
    renderControls();
    renderList();
    renderDetail();
  }

  // ---------------- abilities ----------------
  const AB_CATS = ['Offense', 'Defense', 'Mobility', 'Sustain', 'Status', 'Weather', 'Utility', 'Team'];
  const ab = { q: '', cat: 'all' };
  function renderAbilities() {
    const all = Object.entries(G.ABILITIES || {}).map(([id, a]) => Object.assign({ id }, a));
    const holders = {};
    for (const p of G.DEX) { const id = G.MON_ABILITY[p.dex]; if (id) (holders[id] = holders[id] || []).push(p.name); }
    const q = ab.q.trim().toLowerCase();
    const rows = all.filter(a => (ab.cat === 'all' || a.c === ab.cat)
      && (!q || (a.n + ' ' + a.d + ' ' + (holders[a.id] || []).join(' ')).toLowerCase().includes(q)))
      .sort((a, b) => a.n.localeCompare(b.n));
    $('cx-count').textContent = rows.length === all.length ? all.length + ' abilities' : rows.length + ' of ' + all.length + ' abilities';
    $('cx-ab-cats').innerHTML = `<button class="chip${ab.cat === 'all' ? ' on' : ''}" data-cat="all">All</button>` +
      AB_CATS.map(c => `<button class="chip cx-tchip${ab.cat === c ? ' on' : ''}" data-cat="${c}" style="--tc:${G.AB_COL[c]}">${c}</button>`).join('');
    $('cx-ab-list').innerHTML = rows.length ? rows.map(a => {
      const h = holders[a.id] || [];
      return `<div class="ab-row" data-ab="${a.id}" style="--ac:${G.AB_COL[a.c]}">
        <b>${esc(a.n)}</b><span class="ab-cat">${a.c}</span><span class="ab-d">${esc(a.d)}</span>
        <small>${esc(h.slice(0, 3).join(', '))}${h.length > 3 ? ' +' + (h.length - 3) : ''}</small></div>`;
    }).join('') : '<p class="sub cx-empty">No ability matches.</p>';
  }

  const SECTIONS = { moves: { label: 'Moves', icon: 'codex', render: renderMoves },
                     abilities: { label: 'Abilities', icon: 'star', render: renderAbilities } };

  function render() {
    const keys = Object.keys(SECTIONS);
    $('cx-tabs').classList.toggle('hidden', keys.length < 2);
    $('cx-tabs').innerHTML = keys.map(k => `<button class="cx-bigtab${st.section === k ? ' on' : ''}" data-sec="${k}">${G.Icons.html(SECTIONS[k].icon, 24)} ${SECTIONS[k].label}</button>`).join('');
    const isAb = st.section === 'abilities';
    for (const id of ['cx-tools', 'cx-types', 'cx-only', 'cx-split']) $(id).classList.toggle('hidden', isAb);
    $('cx-ab').classList.toggle('hidden', !isAb);
    SECTIONS[st.section].render();
  }

  // ---------------- events ----------------

  function init() {
    $('cx-types').onclick = e => { const b = e.target.closest('[data-type]'); if (!b) return; st.type = b.dataset.type; G.Audio.sfx('click'); renderMoves(); };
    $('cx-only').onclick = e => { const b = e.target.closest('[data-only]'); if (!b) return; st.only = b.dataset.only; G.Audio.sfx('click'); renderMoves(); };
    $('cx-kind').onchange = e => { st.kind = e.target.value; renderList(); };
    $('cx-sort').onchange = e => { st.sort = e.target.value; renderList(); };
    $('cx-q').oninput = e => { st.q = e.target.value; renderList(); };
    $('cx-list').onclick = e => {
      const b = e.target.closest('[data-id]'); if (!b) return;
      st.sel = b.dataset.id; G.Audio.sfx('select');
      for (const r of $('cx-list').querySelectorAll('.cx-row')) r.classList.toggle('on', r.dataset.id === st.sel);
      renderDetail();
      // On narrow screens the details sit below the list: bring them into view.
      if (matchMedia('(max-width: 760px)').matches) $('cx-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    $('cx-tabs').onclick = e => { const t = e.target.closest('[data-sec]'); if (!t) return; st.section = t.dataset.sec; G.Audio.sfx('click'); render(); };
    $('cx-ab-q').oninput = e => { ab.q = e.target.value; renderAbilities(); };
    $('cx-ab-cats').onclick = e => { const b = e.target.closest('[data-cat]'); if (!b) return; ab.cat = b.dataset.cat; G.Audio.sfx('click'); renderAbilities(); };
  }

  function open() {
    G.UI.show('scr-codex');
    $('cx-q').value = st.q;
    render();
  }

  return { init, open, SECTIONS };
})();
