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

  // ---------------- mechanics ----------------
  /*
   * The hidden rules, one short card each. Weather and type numbers are read from the game data;
   * the rest mirror constants in the code (named next to each card), so update both together.
   */
  function mechCards() {
    const W = G.Weather.KINDS, TN = t => G.U.TYPE_NAME[t] || t;
    const wx = k => Object.entries(W[k].mult).map(([t, v]) => TN(t) + ' ×' + v).join(', ');
    return [
      ['Damage', [
        ['Physical and special', 'Physical moves use your Attack, special moves your Sp. Atk. Moves with neither use the higher one.'],
        ['Same-type bonus (STAB)', 'Single-type Pokémon deal ×1.2 damage with moves of their own type. Dual types don\'t get it.'],   // combat.js STAB
        ['Critical hits', 'Deal ×1.5 damage. Raised by Focus cards, the Critical Hit upgrade, Scope Lens (+20%) and some moves.'],   // combat.js CRIT_MUL
        ['Melee vs bosses', 'Melee moves deal +25% damage to bosses and legendaries.']                                                 // combat.js hit()
      ]],
      ['Defense', [
        ['Melee guard', 'While a melee move is in your active slot you take 25% less damage (another 25% less from legendaries\' attacks in rift arenas).'],   // player.js hurt()
        ['Defense stat', 'At 70 Defense you take normal damage. Each point above takes off 0.25% (up to -35%); each point below adds 0.1% (up to +10%).'],     // player.js defMul
        ['Damage reduction', 'Armor cards, items and buffs stack up to 80%. However much you stack, every hit still deals at least 15%.']
      ]],
      ['Status', [
        ['Afflicted', 'Enemies take +8% damage from everyone for each kind of status they have: burned, poisoned, slowed, frozen or stunned (up to +32%). Bosses too.'],   // enemy.js hurt()
        ['Burn', 'Stacks up to 8 and lasts 3 s, refreshed by each new burn. Damage every 0.5 s grows with stacks and your level.'],
        ['Poison', 'Stacks up to 8 and lasts 4 s. Deals a share of the enemy\'s max HP per stack, so it shines on tough foes (bosses resist most of it).'],
        ['Slow, freeze and stun', 'Slowed foes move slower. Frozen or stunned foes can\'t move or attack. Bosses can\'t be frozen or stunned.'],
        ['Confused', 'Psywave and Magical Torque can confuse foes for 1.5 s: they wander, stop attacking and hit the foes they bump into. Bosses are only slowed.'],   // enemy.js confuse
        ['Soaked', 'Water Pulse soaks foes for 4 s: soaked foes take +25% damage from Electric and Ice moves.'],   // combat.js abHit
        ['Status badges', 'The coloured chips over an enemy show its statuses: orange burn and purple poison (with stacks), blue slow, pale blue frozen.']
      ]],
      ['Types and weather', [
        ['Type matchups', 'Super effective ×1.6, not very effective ×0.6, immune ×0.3. Two types multiply, between ×0.3 and ×2.4. It works both ways: enemies hit you by type too.'],
        ['Harsh sunlight', wx('sun') + '.'],
        ['Rain', wx('rain') + '.'],
        ['Sandstorm', wx('sand') + '. Other types lose a little HP.'],
        ['Snowfall', wx('snow') + '. Other types lose a little HP and slow down.'],
        ['Fog', wx('fog') + '.']
      ]],
      ['Levels and rarity', (() => {
        const RN = G.Gacha.RARITY_NAME, cap = G.RARITY_GROWTH_CAP || 30;
        const pct = v => Math.round(v * 1000) / 10 + '%';
        const tier = r => {
          const b = G.RARITY_BONUS[r] || 0, d = G.RARITY_DEF_BONUS[r] || 0, g = G.RARITY_GROWTH[r] || 0;
          return b || d || g ? `+${pct(b)} HP, Attack and Sp. Atk, +${pct(d)} Defense; then +${pct(g)} damage and max HP every level up to level ${cap} (+${pct(g * (cap - 1))} at most).`
                             : 'No bonus: their base stats are already the highest.';
        };
        return [
          ['Levelling up', 'Each level offers 3 cards: a new move, a move upgrade, an evolution, a perk or a Sitrus Berry. Each level needs a bit more experience than the last.'],
          ['Perks', 'Perk cards (Power, Reflexes, Pay Day, Roar...) level up each time you take them, up to their cap. You can hold ' + G.LevelUp.maxTomes(null) + ' different perks: once your slots are full, only the ones you hold come up. A move\'s evolution needs a perk, so plan your slots. The Sitrus Berry heals at once and never takes a slot.'],   // levelup.js
          ['Roar', 'Each level: +10% wild Pokémon, +8% their health and +5% their damage, for +8% experience and +8% PokéCoins. In a group the whole team faces the team\'s average. Not offered in the Battle Tower.'],   // levelup.js teamFx
          ['No automatic growth', 'Epic and Legendary Pokémon only get stronger through cards. Lower rarities also grow by themselves each level (below).'],
          ...[1, 2, 3].map(r => [RN[r] + ' (' + r + '★)', tier(r)]),
          [RN[4] + ' and ' + RN[5], 'Highest base stats, no rarity bonus or growth.'],
          ['Enemies scale with time', 'Every minute, regular enemies gain about +63% of their starting HP and +14% damage, and get faster (up to +35%). Bosses gain about +10% HP and damage per minute.'],   // enemies.js scale/bossScale
          ['Featured Pokémon', 'Every day three Pokémon are featured (shown on the main menu). Runs with one of them earn +' + Math.round((G.Featured.BONUS - 1) * 100) + '% PokéCoins.'],
          ['Group runs', 'More players means more enemies, with more HP. Experience is shared, so each player levels a little slower.']
        ];
      })()],
      // Evolution families (moves.js FAMILIES): which perk evolves which kind of move.
      ['Evolution families', [
        ['How evolving works', 'A move evolves once it reaches max level and you hold the perk of its family. Every move of a family needs the same perk. Burst moves and boosters don\'t evolve.'],
        ...G.Moves.FAMILIES.map(f => [f.name + ' → ' + ((G.LevelUp.BY[f.need] || {}).title || f.need),
          f.kinds.map(k => G.Icons.KIND_NAME[k] || k).join(', ') + ' (' + f.why + ').'])
      ]],
      ['Abilities', [
        ['Always on', 'Every Pokémon has one ability (Abilities tab), active for the whole run. Pause the game to read yours.'],
        ['Burned or poisoned', 'Players are never burned or poisoned. Abilities that say you can\'t be burned or poisoned make Fire or Poison hits deal 20% less instead. You count as slowed while a trap, Hyper Beam or water slows you.'],   // abilrun.js
        ['Debuffs', 'Defiant, Competitive and the like trigger when you get slowed or hit by a boss\'s or legendary\'s attack.'],
        ['Weather and terrain', 'Drizzle, Drought, Sand Stream and Snow Warning bring their weather for 60 s at the start and 30 s every 4 minutes. Surge abilities do the same with their terrain.'],
        ['Teammates', 'Team abilities (Battery, Power Spot, Telepathy...) help teammates within a short distance of you.']
      ]],
      ['Shinies', [
        ['Shiny odds', 'Wild enemies are shiny 1 in ' + Math.round(1 / G.Spawner.SHINY_RATE) + ', rift legendaries 1 in 512 and gacha pulls 1 in ' + Math.round(1 / G.Gacha.SHINY_RATE) + '. Defeat a wild shiny to keep it. The Shiny Lure perk adds +30% a level to wild odds (in a group, the team\'s average).'],   // spawner.js, rift.js, gacha.js
        ['Shiny Charms', 'Own every Pokémon of a region to earn its Shiny Charm: shiny odds ×' + G.Charms.MULT + ' for that region\'s Pokémon in runs, rifts and the gacha (not Gacha Battles, where everyone has the same odds). In group runs the host\'s charms count. Completed regions show a sparkle in the Pokédex.']   // charms.js
      ]],
      ['Moves', [
        ['Active slot', 'Only the move in your selected slot attacks. Switch with 1-4, Q/E or by tapping the move bar.'],
        ['Bonds', 'Beating a legendary gives a bond: fuse moves into one slot (up to ' + G.Player.BOND_MAX + ') and they all fire together.'],
        ['Burst moves', 'Big moves that charge in the background even when not selected. Switch to them when they glow. At most 2, and they can\'t be bonded.'],
        ['Evolving moves', 'A move at max level evolves once you\'ve taken the stat card it needs in that run. Check the Moves tab.'],
        ['Reviving', 'In a group, stand next to a downed teammate for ' + G.Player.REVIVE_TIME + ' s to revive them. During Arceus\'s Judgment the progress doesn\'t drain away.']
      ]],
      // Key Items (data/keyitems.js): one card per item, straight from its shop text.
      ['Key Items', [
        ['How they work', 'Bought once in Klefki\'s Key Items (Shop) and kept forever. Take one into each run from the slot under your partner on the main menu. Always passive, for the whole run, and separate from held items. Not used in Draft Night runs.'],
        ...G.KeyItems.LIST.map(k => [k.name, k.desc + (k.note ? ' ' + k.note : '')])
      ]]
    ];
  }
  function renderMech() {
    const groups = mechCards();
    $('cx-count').textContent = groups.reduce((n, g) => n + g[1].length, 0) + ' rules';
    $('cx-mech').innerHTML = groups.map(([h, cards]) => `<h4 class="mech-h">${esc(h)}</h4><div class="mech-grid">` +
      cards.map(([t, d]) => `<div class="mech-card"><b>${esc(t)}</b><span>${esc(d)}</span></div>`).join('') + '</div>').join('');
  }

  const SECTIONS = { moves: { label: 'Moves', icon: 'codex', render: renderMoves },
                     abilities: { label: 'Abilities', icon: 'star', render: renderAbilities },
                     mech: { label: 'Mechanics', icon: 'gear', render: renderMech } };

  function render() {
    const keys = Object.keys(SECTIONS);
    $('cx-tabs').classList.toggle('hidden', keys.length < 2);
    $('cx-tabs').innerHTML = keys.map(k => `<button class="cx-bigtab${st.section === k ? ' on' : ''}" data-sec="${k}">${G.Icons.html(SECTIONS[k].icon, 24)} ${SECTIONS[k].label}</button>`).join('');
    const isMv = st.section === 'moves';
    for (const id of ['cx-tools', 'cx-types', 'cx-only', 'cx-split']) $(id).classList.toggle('hidden', !isMv);
    $('cx-ab').classList.toggle('hidden', st.section !== 'abilities');
    $('cx-mech').classList.toggle('hidden', st.section !== 'mech');
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
