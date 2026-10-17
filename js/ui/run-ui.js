/* ============ run-ui.js — cartas de nivel, pausa y fin de run ============ */
G.RunUI = (() => {
  const $ = G.UI.$;
  let offers = null, offerCb = null, coopMode = false;

  /** @param coop  en grupo: tras elegir, se queda esperando a los demás */
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
   * Cambiar las cartas: 1 vez gratis por partida y 1 más por cada jefe
   * derrotado (en grupo cuentan los jefes del equipo; cada uno tiene los suyos).
   */
  function rerollsLeft() {
    const p = G.Game.player;
    // 1 gratis + los comprados en Mejoras (antes, 1 más por cada jefe).
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
        ? `<span class="tag-chip" style="background:${c.color}">Nuevo · ${c.tag}</span>`
        : c.type === 'up' || c.type === 'evo'
          ? `<span class="tag-chip" style="background:${c.color}">${c.tag}</span>`
          : `<span class="tag-chip" style="background:${c.color === '#ffd23f' ? '#ffd23f' : '#9fb1c9'}">${c.tag}</span>`;
      if (c.type === 'evo') el.classList.add('evo');
      el.innerHTML =
        `<div class="ico" style="background:${c.color}33">${G.Icons.html(c.icon, 32)}</div>
         <div class="txt"><div class="nm">${c.title} ${tag}</div><div class="ds">${c.desc}</div></div>
         <div class="key">${i + 1}</div>`;
      el.dataset.sfx = 'none';             // el juego pone su propio sonido al elegir
      el.onclick = () => pick(i);
      box.appendChild(el);
    });
  }

  function pick(i) {
    if (!offers || !offers[i]) return;
    const c = offers[i], cb = offerCb;
    offers = null; offerCb = null;
    $('lvl-reroll').classList.add('hidden');
    $('lvl-skip').classList.add('hidden');
    if (coopMode) {
      // Se queda la carta elegida a la vista mientras eligen los demás.
      $('cards').querySelectorAll('.card').forEach((el, j) => el.classList.toggle('picked', j === i));
      $('cards').classList.add('done');
    } else G.UI.hide('scr-levelup');
    cb(c);
  }

  /** Cooperativo: quién falta por elegir. */
  function setWaiting(names) {
    const me = G.Social.me ? G.Social.me.name : '';
    const others = names.filter(n => n !== me);
    const list = a => a.length > 1 ? a.slice(0, -1).join(', ') + (G.I18n.lang === 'en' ? ' and ' : ' y ') + a[a.length - 1] : a[0];
    $('lvl-wait').textContent = !names.length ? ''
      : !others.length ? 'Elige tu carta'
      : names.includes(me) ? 'Faltan por elegir: ' + list([...others, G.I18n.lang === 'en' ? 'you' : 'tú'])
      : 'Esperando a ' + list(others) + '…';
  }

  function closeLevelUp() {
    offers = null; offerCb = null;
    $('cards').classList.remove('done');
    G.UI.hide('scr-levelup');
  }

  /**
   * Mensaje de apoyo (Ko-fi) al acabar: tras un récord o cada 10 partidas,
   * nunca en la primera y como mucho una vez al día. Se cierra con la X.
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
    $('over-title').textContent = r.dead ? 'Has caído…' : 'Run terminada';
    $('over-stats').innerHTML = `
      <div><span>Tiempo</span><b>${G.U.mmss(r.time)}</b></div>
      <div><span>Nivel</span><b>${r.level}</b></div>
      <div><span>Derrotados</span><b>${r.kills}</b></div>
      <div><span>Jefes</span><b>${r.bosses}</b></div>
      ${r.judge ? `<div style="grid-column:1/-1"><span>Ante Arceus</span><b class="gold">${G.U.mmss(r.judge.time)} · ${r.judge.bosses} ${r.judge.bosses === 1 ? 'legendario' : 'legendarios'}</b></div>` : ''}
      <div style="grid-column:1/-1"><span>Pokémonedas ganadas</span>
        <b class="gold"><span class="coin"></span> +${r.coins}</b>
        <div style="font-size:12px;color:var(--muted)">${r.breakdown}</div></div>
      ${r.t1 || r.t10 ? `<div style="grid-column:1/-1"><span>Tickets del gacha</span><b>
        ${r.t1 ? G.Icons.html('ticket', 22) + ' +' + r.t1 + ' ' : ''}${r.t10 ? G.Icons.html('ticket10', 22) + ' +' + r.t10 + ' ×10' : ''}</b></div>` : ''}
      <div style="grid-column:1/-1"><span>Movimientos</span><b style="font-size:15px">
        ${r.moves.map(m => `${G.Icons.html('move:' + m.id, 16)} ${m.name} Nv.${m.lvl}`).join(' · ') || '—'}</b></div>
      ${r.caught && r.caught.length ? `<div style="grid-column:1/-1" class="caught"><span>${G.Icons.html('shiny', 12)} Shinies conseguidos</span>
        <div class="caught-row" id="over-caught"></div></div>` : ''}
      ${r.record ? '<div style="grid-column:1/-1;text-align:center" class="gold">¡Nuevo récord de tiempo!</div>' : ''}
      ${askSupport(r) ? `<div class="support-ask" id="over-ask" style="grid-column:1/-1">
        <button class="x" type="button" aria-label="Cerrar">×</button>
        <p>¿Te está gustando Megamon? Lo hago yo solo y los servidores cuestan dinero. Si quieres, puedes ayudarme a mantenerlo en línea.</p>
        <a class="btn small gold" href="${G.Funding.url}" target="_blank" rel="noopener">${G.Icons.html('heart', 14)} Apoyar en Ko-fi</a>
      </div>` : ''}`;
    const ask = $('over-ask');
    if (ask) ask.querySelector('.x').onclick = () => ask.remove();
    $('btn-again').onclick = onBack;
    if (r.caught && r.caught.length) {
      const row = $('over-caught');
      for (const c of r.caught) {
        const w = document.createElement('div');
        w.appendChild(G.UI.spriteCanvas(c.dex, 90, 72, { shiny: true, lively: true, scale: 2 }));
        w.insertAdjacentHTML('beforeend', `<small>${G.DEX_BY[c.dex].name}${c.isNew ? ' · ¡nuevo!' : ''}</small>`);
        row.appendChild(w);
      }
    }
    G.UI.show('scr-over');
  }

  /** Has encontrado un objeto llevando ya otro: ¿con cuál te quedas? */
  function showItemChoice(cur, next, cb) {
    const box = $('item-cards');
    box.innerHTML = '';
    // Sin objeto (cur = null): se ofrece el nuevo para aceptarlo o descartarlo.
    const opts = cur ? [[cur, 'Quedarme con'], [next, 'Cambiar a']] : [[next, 'Take'], [null, 'Discard']];
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

  // ---------------- vínculo: qué movimientos se fusionan ----------------

  let bond = null;          // { opt, cb, first, list }

  /**
   * @param opt  pl.bondOptions(): 'add' (uno suelto al grupo) o 'pair' (dos sueltos, en dos pasos)
   * @param cb   recibe la lista de movimientos que se juntan
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
    $('bond-sub').textContent = opt.mode === 'add' ? 'Elige qué movimiento se une a ' + names(opt.group)
      : step2 ? '¿Con cuál unes ' + first.name + '?' : 'Elige el primer movimiento que vas a unir';
    $('bond-back').classList.toggle('hidden', !step2);
    bond.list = step2 ? opt.loose.filter(m => m !== first) : opt.loose;
    const box = $('bond-cards');
    box.innerHTML = '';
    bond.list.forEach((m, i) => {
      const col = G.U.TYPE_COLOR[m.type];
      const desc = opt.mode === 'add' ? 'Se lanzará a la vez que ' + names(opt.group) + '.'
        : step2 ? 'Se lanzará a la vez que ' + first.name + '. Queda un hueco libre.'
        : m.desc || '';
      const el = document.createElement('div');
      el.className = 'card' + (opt.mode === 'add' || step2 ? ' bond' : '');
      el.innerHTML =
        `<div class="ico" style="background:${col}33">${G.Icons.html('move:' + m.id, 32)}</div>
         <div class="txt"><div class="nm">${m.name} <span class="tag-chip" style="background:${col}">Nv.${m.lvl}</span></div><div class="ds">${desc}</div></div>
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
    $('btn-quit').textContent = coop ? 'Salir de la partida' : 'Abandonar run';
    G.UI.show('scr-pause');
  }

  function wirePause(onResume, onQuit) {
    $('btn-resume').onclick = onResume;
    $('btn-quit').onclick = onQuit;
  }

  return { showLevelUp, reroll, skip, showItemChoice, showMoveChoice, showBond, pickBond, bondBack, pick, setWaiting, closeLevelUp, showOver, refreshTeam, wirePause, showPause };
})();
