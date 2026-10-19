/* ============ run-ui.js — level-up cards, pause and end of run ============ */
G.RunUI = (() => {
  const $ = G.UI.$;
  let offers = null, offerCb = null, coopMode = false;

  /** @param coop  in a group: after choosing, it waits for the others */
  function showLevelUp(level, list, cb, coop = false) {
    offerCb = cb; coopMode = coop;
    $('lvl-num').textContent = level;
    $('lvl-wait').textContent = '';
    $('lvl-wait').classList.toggle('hidden', !coop);
    $('cards').classList.remove('done');
    renderCards(list);
    $('lvl-reroll').onclick = reroll;
    $('lvl-skip').onclick = skip;
    G.UI.show('scr-levelup');
  }

  /**
   * Reroll the cards: 1 free time per run and 1 more for each boss
   * defeated (in a group the team's bosses count; each player has their own).
   */
  function rerollsLeft() {
    const p = G.Game.player;
    // 1 free + those bought in Upgrades (previously, 1 more for each boss).
    return p ? Math.max(0, 1 + (p.rerollBonus || 0) - (p.rerolls || 0)) : 0;
  }

  /** Skips bought in Upgrades (per run): take nothing from this level-up. */
  function skipsLeft() {
    const p = G.Game.player;
    return p ? Math.max(0, (p.skipBonus || 0) - (p.skips || 0)) : 0;
  }

  function skip() {
    if (!offers || skipsLeft() <= 0) return;
    const p = G.Game.player, cb = offerCb;
    p.skips = (p.skips || 0) + 1;
    offers = null; offerCb = null;
    $('lvl-reroll').classList.add('hidden');
    $('lvl-skip').classList.add('hidden');
    if (coopMode) $('cards').classList.add('done');
    else G.UI.hide('scr-levelup');
    G.UI.toast('Level-up skipped (' + skipsLeft() + ' left)');
    G.RunLog.skip();
    cb({ apply() {} });
  }

  function reroll() {
    if (!offers || rerollsLeft() <= 0) return;
    const p = G.Game.player;
    p.rerolls = (p.rerolls || 0) + 1;
    G.Audio.sfx('select');
    renderCards(G.LevelUp.offer(p));
  }

  function renderCards(list) {
    offers = list;
    G.RunLog.offer(list);              // run details: what was offered (a reroll calls this again)
    const left = rerollsLeft();
    $('lvl-rr-n').textContent = left;
    $('lvl-reroll').classList.toggle('hidden', left <= 0);
    const sk = skipsLeft();
    $('lvl-skip-n').textContent = sk;
    $('lvl-skip').classList.toggle('hidden', sk <= 0);
    const box = $('cards');
    box.innerHTML = '';
    list.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'card';
      const tag = c.type === 'new'
        ? `<span class="tag-chip" style="background:${c.color}">New · ${c.tag}</span>`
        : c.type === 'up' || c.type === 'evo'
          ? `<span class="tag-chip" style="background:${c.color}">${c.tag}</span>`
          : `<span class="tag-chip" style="background:${c.color === '#ffd23f' ? '#ffd23f' : '#9fb1c9'}">${c.tag}</span>`;
      if (c.type === 'evo') el.classList.add('evo');
      const owned = c.type === 'stat' && c.owned != null
        ? ` <span class="owned-chip${c.owned ? '' : ' none'}" translate="no">Owned ${c.owned}${c.cap ? '/' + c.cap : ''}</span>` : '';
      el.innerHTML =
        `<div class="ico" style="background:${c.color}33">${G.Icons.html(c.icon, 32)}</div>
         <div class="txt"><div class="nm">${c.title} ${tag}${owned}${c.kind ? ' ' + G.Icons.kindTag(c.kind) : ''}</div><div class="ds">${c.desc}</div></div>
         <div class="key">${i + 1}</div>`;
      el.dataset.sfx = 'none';             // the game plays its own sound on choosing
      el.onclick = () => pick(i);
      box.appendChild(el);
    });
  }

  function pick(i) {
    if (!offers || !offers[i]) return;
    const c = offers[i], cb = offerCb;
    offers = null; offerCb = null;
    G.RunLog.pick(i);
    $('lvl-reroll').classList.add('hidden');
    $('lvl-skip').classList.add('hidden');
    if (coopMode) {
      // The chosen card stays visible while the others choose.
      $('cards').querySelectorAll('.card').forEach((el, j) => el.classList.toggle('picked', j === i));
      $('cards').classList.add('done');
    } else G.UI.hide('scr-levelup');
    cb(c);
  }

  /** Co-op: who still has to choose. */
  function setWaiting(names) {
    const me = G.Social.me ? G.Social.me.name : '';
    const others = names.filter(n => n !== me);
    const list = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0];
    $('lvl-wait').textContent = !names.length ? ''
      : !others.length ? 'Choose your card'
      : names.includes(me) ? 'Still choosing: ' + list([...others, 'you'])
      : 'Waiting for ' + list(others) + '…';
  }

  function closeLevelUp() {
    offers = null; offerCb = null;
    $('cards').classList.remove('done');
    G.UI.hide('scr-levelup');
  }

  /**
   * Support message (Ko-fi) at the end: after a record or every 10 runs,
   * never on the first and at most once a day. Closed with the X.
   */
  function askSupport(r) {
    if (!G.Funding || !G.Funding.url) return false;
    const runs = (G.DB.save && G.DB.save.stats && G.DB.save.stats.runs) || 0;
    if (runs < 2 || !(r.record || runs % 10 === 0)) return false;
    const today = new Date().toISOString().slice(0, 10);
    try { if (localStorage.getItem('ps.ask') === today) return false; localStorage.setItem('ps.ask', today); } catch (e) { return false; }
    return true;
  }

  // Stats tab: one column per player (everyone's numbers arrive from the other computers).
  let overRes = null;
  function refreshTeam() {
    const r = overRes, box = $('over-team');
    if (!r || !box) return;
    let list = r.team ? r.team() : [];
    if (!list.length) list = [r.mine];
    else if (r.mine && !list.some(p => p.u === r.mine.u)) list = [r.mine, ...list];     // you are always in your own table
    const rank = u => { const i = (r.order || []).indexOf(u); return i < 0 ? 99 : i; };
    list = list.slice().sort((a, b) => rank(a.u) - rank(b.u));
    const n = x => Math.round(x).toLocaleString('en-GB');
    const rows = [
      ['Damage dealt', p => p.d, n],
      ['Biggest hit', p => p.b, n],
      ['Damage taken', p => p.t, n],
      ['Times downed', p => p.dn, n],
      ['Revives given', p => list.reduce((s, q) => s + (q.rb || []).filter(u => u === p.u).length, 0), n],
      ['Shrines used', p => p.sr, n]
    ];
    const lowGood = new Set(['Damage taken', 'Times downed']);
    let h = '<table class="ptable"><thead><tr><th></th>' +
      list.map(p => `<th><span class="pc" data-dex="${p.dex}" data-sh="${p.sh ? 1 : 0}"></span><div translate="no">${esc(p.n)}</div></th>`).join('') + '</tr></thead><tbody>';
    for (const [label, get, fmt] of rows) {
      const vals = list.map(get), best = lowGood.has(label) ? Math.min(...vals) : Math.max(...vals);
      h += `<tr><td>${label}</td>` + vals.map(v => `<td class="${list.length > 1 && v === best && (v > 0 || lowGood.has(label)) ? 'top' : ''}">${fmt(v)}</td>`).join('') + '</tr>';
    }
    h += '</tbody></table>';
    if (list.length > 1) h += '<p class="sub" style="margin:8px 0 0">Gold marks the best in each row.</p>';
    box.innerHTML = h;
    box.querySelectorAll('.pc').forEach(el => {
      if (G.DEX_BY[+el.dataset.dex]) el.appendChild(G.UI.spriteCanvas(+el.dataset.dex, 44, 44, { shiny: el.dataset.sh === '1' }));
    });
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function showOver(r, onBack) {
    overRes = r;
    const setTab = t => {
      document.querySelectorAll('#over-tabs .tab').forEach(el => el.classList.toggle('on', el.dataset.tab === t));
      $('over-stats').classList.toggle('hidden', t !== 'sum');
      $('over-team').classList.toggle('hidden', t !== 'team');
      if (t === 'team') refreshTeam();
    };
    document.querySelectorAll('#over-tabs .tab').forEach(el => { el.onclick = () => setTab(el.dataset.tab); });
    setTab('sum');
    $('over-title').textContent = r.dead ? 'You fell…' : 'Run over';
    $('over-stats').innerHTML = `
      <div><span>Time</span><b>${G.U.mmss(r.time)}</b></div>
      <div><span>Level</span><b>${r.level}</b></div>
      <div><span>Defeated</span><b>${r.kills}</b></div>
      <div><span>Bosses</span><b>${r.bosses}</b></div>
      ${r.judge ? `<div style="grid-column:1/-1"><span>Against Arceus</span><b class="gold">${G.U.mmss(r.judge.time)} · ${r.judge.bosses} ${r.judge.bosses === 1 ? 'legendary' : 'legendaries'}</b></div>` : ''}
      <div style="grid-column:1/-1"><span>Poké Coins earned</span>
        <b class="gold"><span class="coin"></span> +${r.coins}</b>
        <div style="font-size:12px;color:var(--muted)">${r.breakdown}</div></div>
      ${r.t1 || r.t10 ? `<div style="grid-column:1/-1"><span>Gacha tickets</span><b>
        ${r.t1 ? G.Icons.html('ticket', 22) + ' +' + r.t1 + ' ' : ''}${r.t10 ? G.Icons.html('ticket10', 22) + ' +' + r.t10 + ' ×10' : ''}</b></div>` : ''}
      ${r.killer ? `<div style="grid-column:1/-1" class="killer"><span>Defeated by</span>
        <div class="killer-main"><span class="killer-sprite"></span><div>
          <b>${esc(r.killer.n)}</b>
          <small>${esc(r.killer.a)}${r.killer.ty ? ` · <i class="ktype" style="color:${G.U.TYPE_COLOR[r.killer.ty] || '#ccc'}">${esc(r.killer.ty)}</i>` : ''}${r.killer.e === 'super' ? ' · super effective' : r.killer.e === 'weak' ? ' · not very effective' : ''}</small>
        </div><em>${r.killer.h} damage</em></div>
        ${(r.recent || []).length > 1 ? `<div class="killer-prev">Hits before that: ${r.recent.slice(0, -1).reverse().map(h => `${esc(h.n)} (${esc(h.a)}, ${h.h})`).join(' · ')}</div>` : ''}
      </div>` : ''}
      <div style="grid-column:1/-1"><span>Moves</span><b style="font-size:15px">
        ${r.moves.map(m => `${G.Icons.html('move:' + m.id, 16)} ${m.name} Lv.${m.lvl}`).join(' · ') || '—'}</b></div>
      ${r.caught && r.caught.length ? `<div style="grid-column:1/-1" class="caught"><span>${G.Icons.html('shiny', 12)} Shinies caught</span>
        <div class="caught-row" id="over-caught"></div></div>` : ''}
      ${r.record ? '<div style="grid-column:1/-1;text-align:center" class="gold">New time record!</div>' : ''}
      ${askSupport(r) ? `<div class="support-ask" id="over-ask" style="grid-column:1/-1">
        <button class="x" type="button" aria-label="Close">×</button>
        <p>Enjoying Megamon? I make it on my own and the servers cost money. If you like, you can help me keep it online.</p>
        <a class="btn small gold" href="${G.Funding.url}" target="_blank" rel="noopener">${G.Icons.html('heart', 14)} Support on Ko-fi</a>
      </div>` : ''}`;
    const ks = document.querySelector('#over-stats .killer-sprite');
    if (ks && r.killer && r.killer.d) ks.appendChild(G.UI.spriteCanvas(r.killer.d, 56, 48, { scale: 1 }));
    const ask = $('over-ask');
    if (ask) ask.querySelector('.x').onclick = () => ask.remove();
    $('btn-again').onclick = onBack;
    if (r.caught && r.caught.length) {
      const row = $('over-caught');
      for (const c of r.caught) {
        const w = document.createElement('div');
        w.appendChild(G.UI.spriteCanvas(c.dex, 90, 72, { shiny: true, lively: true, scale: 2 }));
        w.insertAdjacentHTML('beforeend', `<small>${G.DEX_BY[c.dex].name}${c.isNew ? ' · new!' : ''}</small>`);
        row.appendChild(w);
      }
    }
    G.UI.show('scr-over');
  }

  /** You found an item while already holding one: which do you keep? */
  function showItemChoice(cur, next, cb) {
    const box = $('item-cards');
    box.innerHTML = '';
    // No item (cur = null): the new one is offered to accept or discard.
    const opts = cur ? [[cur, 'Keep'], [next, 'Switch to']] : [[next, 'Take'], [null, 'Discard']];
    opts.forEach(([id, verb], i) => {
      const it = id ? G.Items.BY[id] : null;
      const el = document.createElement('div');
      el.className = 'card' + (cur && i === 1 ? ' evo' : '');
      el.innerHTML = it
        ? `<div class="ico">${G.Icons.html(id, 36)}</div>
        <div class="txt"><div class="nm">${verb} ${it.name}</div><div class="ds">${it.desc}</div></div>
        <div class="key">${i + 1}</div>`
        : `<div class="ico">${G.Icons.html('ban', 36)}</div>
        <div class="txt"><div class="nm">${verb} ${G.Items.BY[next].name}</div><div class="ds">Leave it behind and keep going without an item.</div></div>
        <div class="key">${i + 1}</div>`;
      el.onclick = () => { G.UI.hide('scr-item'); cb(id); };
      box.appendChild(el);
    });
    $('item-title').textContent = 'An item!';
    $('item-sub').innerHTML = 'You can only carry one · <kbd>1</kbd> <kbd>2</kbd>';
    G.UI.show('scr-item');
  }

  /** Aegislash's Armoury: pick one of the offered items, or skip. */
  function showArmoury(cur, ids, cb) {
    const box = $('item-cards');
    box.innerHTML = '';
    ids.forEach((id, i) => {
      const it = G.Items.BY[id];
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `<div class="ico">${G.Icons.html(id, 36)}</div>
        <div class="txt"><div class="nm">Take ${it.name}</div><div class="ds">${it.desc}</div></div>
        <div class="key">${i + 1}</div>`;
      el.onclick = () => { G.UI.hide('scr-item'); cb(id); };
      box.appendChild(el);
    });
    const skip = document.createElement('div');
    skip.className = 'card';
    skip.innerHTML = `<div class="ico">${G.Icons.html('ban', 36)}</div>
      <div class="txt"><div class="nm">Skip</div><div class="ds">${cur ? 'Take nothing and keep ' + G.Items.BY[cur].name + '.' : 'Take nothing and carry on without an item.'}</div></div>
      <div class="key">${ids.length + 1}</div>`;
    skip.onclick = () => { G.UI.hide('scr-item'); cb(null); };
    box.appendChild(skip);
    $('item-title').textContent = 'An Armoury of Items!';
    $('item-sub').innerHTML = (cur ? 'Taking one replaces ' + G.Items.BY[cur].name + ' · ' : 'You can only carry one · ') + 'keys <kbd>1</kbd>-<kbd>' + (ids.length + 1) + '</kbd>';
    G.UI.show('scr-item');
  }

  /** Spiritomb, the move tutor: one of 3 moves from outside your pool, or skip. */
  function showTutor(pl, ids, cb) {
    const box = $('item-cards');
    box.innerHTML = '';
    ids.forEach((id, i) => {
      const m = G.Moves.BY_ID[id], col = G.U.TYPE_COLOR[m.type];
      const cat = m.cat ? ' · ' + (m.cat === 'physical' ? 'Physical' : 'Special') : '';
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `<div class="ico" style="background:${col}33">${G.Icons.html('move:' + id, 36)}</div>
        <div class="txt"><div class="nm">${m.name} <span class="tag-chip" style="background:${col}">${G.U.TYPE_NAME[m.type]}${cat}</span> ${G.Icons.kindTag(m.kind)}</div><div class="ds">${m.desc || ''}</div></div>
        <div class="key">${i + 1}</div>`;
      el.onclick = () => { G.UI.hide('scr-item'); cb(id); };
      box.appendChild(el);
    });
    const skip = document.createElement('div');
    skip.className = 'card';
    skip.innerHTML = `<div class="ico">${G.Icons.html('ban', 36)}</div>
      <div class="txt"><div class="nm">Skip</div><div class="ds">Learn nothing and keep your moves.</div></div>
      <div class="key">${ids.length + 1}</div>`;
    skip.onclick = () => { G.UI.hide('scr-item'); cb(null); };
    box.appendChild(skip);
    $('item-title').textContent = 'Spiritomb\'s otherworldly moves';
    $('item-sub').innerHTML = (pl.slots.length >= pl.maxMoves ? 'Your moves are full: you\'ll pick one to forget · ' : '')
      + 'keys <kbd>1</kbd>-<kbd>' + (ids.length + 1) + '</kbd>';
    G.UI.show('scr-item');
  }

  /** Every slot is full: which move does the tutored one replace? (Keep them all = skip.) */
  function showTutorForget(pl, id, cb) {
    const box = $('item-cards');
    box.innerHTML = '';
    // Burst moves can't be bonded, so a tutored burst move can only replace a move that isn't in a bond.
    const burst = G.Moves.BY_ID[id].kind === 'burst';
    const list = pl.moves.filter(m => !burst || !pl.slots.some(g => g.length > 1 && g.includes(m)));
    list.forEach((m, i) => {
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `<div class="ico">${G.Icons.html('move:' + m.id, 36)}</div>
        <div class="txt"><div class="nm">Forget ${m.name} <small>Lv.${m.lvl}</small></div><div class="ds">${m.def.desc || ''}</div></div>
        <div class="key">${i + 1}</div>`;
      el.onclick = () => { G.UI.hide('scr-item'); cb(m); };
      box.appendChild(el);
    });
    const keep = document.createElement('div');
    keep.className = 'card';
    keep.innerHTML = `<div class="ico">${G.Icons.html('ban', 36)}</div>
      <div class="txt"><div class="nm">Keep my moves</div><div class="ds">Don't learn ${G.Moves.BY_ID[id].name}.</div></div>
      <div class="key">${list.length + 1}</div>`;
    keep.onclick = () => { G.UI.hide('scr-item'); cb(null); };
    box.appendChild(keep);
    $('item-title').textContent = 'Learn ' + G.Moves.BY_ID[id].name + '?';
    $('item-sub').innerHTML = 'Choose a move to forget · keys <kbd>1</kbd>-<kbd>' + (list.length + 1) + '</kbd>';
    G.UI.show('scr-item');
  }

  /** Choice Band just equipped: which move do you want to be locked into? */
  function showMoveChoice(pl, cb) {
    const box = $('item-cards');
    box.innerHTML = '';
    pl.slots.forEach((g, i) => {
      const m = g[0];
      if (!m) return;
      const nm = g.length > 1 ? m.name + ' +' + (g.length - 1) : m.name;
      const el = document.createElement('div');
      el.className = 'card' + (i === pl.active ? ' evo' : '');
      el.innerHTML = `<div class="ico">${G.Icons.html('move:' + m.id, 36)}</div>
        <div class="txt"><div class="nm">${nm}</div><div class="ds">${m.def.desc || ''}</div></div>
        <div class="key">${i + 1}</div>`;
      el.onclick = () => { G.UI.hide('scr-item'); cb(i); };
      box.appendChild(el);
    });
    $('item-title').textContent = 'Choice Band: pick your move';
    $('item-sub').innerHTML = 'You will be locked into it while you hold the band · <kbd>1</kbd>–<kbd>' + pl.slots.length + '</kbd>';
    G.UI.show('scr-item');
  }

  // ---------------- bond: which moves are fused ----------------

  let bond = null;          // { opt, cb, first, list }

  /**
   * @param opt  pl.bondOptions(): 'add' (one loose move to the group) or 'pair' (two loose ones, in two steps)
   * @param cb   receives the list of moves that are joined
   */
  function showBond(opt, cb) {
    bond = { opt, cb, first: null, list: [] };
    $('bond-back').onclick = bondBack;
    renderBond();
    G.UI.show('scr-bond');
  }

  function renderBond() {
    const { opt, first } = bond;
    const names = ms => ms.map(m => m.name).join(' + ');
    const step2 = opt.mode === 'pair' && first;
    $('bond-sub').textContent = opt.mode === 'add' ? 'Choose which move joins ' + names(opt.group)
      : step2 ? 'Which move do you bond ' + first.name + ' with?' : 'Choose the first move to bond';
    $('bond-back').classList.toggle('hidden', !step2);
    bond.list = step2 ? opt.loose.filter(m => m !== first) : opt.loose;
    const box = $('bond-cards');
    box.innerHTML = '';
    bond.list.forEach((m, i) => {
      const col = G.U.TYPE_COLOR[m.type];
      const desc = opt.mode === 'add' ? 'It will fire at the same time as ' + names(opt.group) + '.'
        : step2 ? 'It will fire at the same time as ' + first.name + '. A slot is freed.'
        : m.desc || '';
      const el = document.createElement('div');
      el.className = 'card' + (opt.mode === 'add' || step2 ? ' bond' : '');
      el.innerHTML =
        `<div class="ico" style="background:${col}33">${G.Icons.html('move:' + m.id, 32)}</div>
         <div class="txt"><div class="nm">${m.name} <span class="tag-chip" style="background:${col}">Lv.${m.lvl}</span> ${G.Icons.kindTag(m.kind)}</div><div class="ds">${desc}</div></div>
         <div class="key">${i + 1}</div>`;
      el.dataset.sfx = 'none';
      el.onclick = () => pickBond(i);
      box.appendChild(el);
    });
  }

  function pickBond(i) {
    if (!bond || !bond.list[i]) return;
    const m = bond.list[i];
    if (bond.opt.mode === 'pair' && !bond.first) {
      bond.first = m;
      G.Audio.sfx('select');
      renderBond();
      return;
    }
    const picked = bond.opt.mode === 'add' ? [m] : [bond.first, m];
    const cb = bond.cb;
    bond = null;
    G.UI.hide('scr-bond');
    cb(picked);
  }

  function bondBack() {
    if (!bond) return;
    bond.first = null;
    renderBond();
  }

  function showPause(coop = false) {
    G.UI.soundControls($('pause-sound'));
    $('pause-coop').classList.toggle('hidden', !coop);
    $('btn-quit').textContent = coop ? 'Leave the game' : 'Quit run';
    G.UI.show('scr-pause');
  }

  function wirePause(onResume, onQuit) {
    $('btn-resume').onclick = onResume;
    $('btn-quit').onclick = onQuit;
  }

  return { showLevelUp, reroll, skip, showItemChoice, showArmoury, showTutor, showTutorForget, showMoveChoice, showBond, pickBond, bondBack, pick, setWaiting, closeLevelUp, showOver, refreshTeam, wirePause, showPause };
})();
