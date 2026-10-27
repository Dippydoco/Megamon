/* ============ moveset-ui.js — the Moveset screen (main menu) ============
 * Pick, per Pokémon, the G.Moveset.SIZE moves that can come up as new-move cards in its runs (systems/moveset.js).
 * Moves are grouped by type (signature first, Normal last). Gold = chosen by you, dashed = filled in automatically
 * (tap one to make it yours), plain = left out. Below SIZE chosen, the rest is always filled automatically.
 */
G.MovesetUI = (() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let dex = null;

  function init() {
    $('ms-reset').onclick = () => {
      if (!G.Moveset.edited(dex)) return;
      G.Moveset.set(dex, []);
      G.Audio.sfx('back');
      G.UI.toast('Back to the automatic moveset');
      render();
    };
    $('ms-clear').onclick = () => {
      G.Moveset.set(dex, []);
      // An empty choice means "automatic"; clearing to pick from scratch keeps a marker so nothing is auto-chosen
      // only on screen: the run still fills to SIZE, so nothing is ever lost.
      clearing = true;
      G.Audio.sfx('select');
      render();
    };
  }
  let clearing = false;          // just pressed "Start from scratch": show the auto fill as off until you tap

  function open() {
    const s = G.DB.save;
    if (!dex || !G.DB.canUse(dex)) dex = s.partner;
    G.UI.show('scr-moveset', true);
    const sel = $('ms-mon');
    const mons = [...new Set([...Object.keys(s.owned).map(Number), ...G.Featured.today().filter(d => G.DB.canUse(d))])].filter(d => G.DEX_BY[d])
      .sort((a, b) => (b === s.partner) - (a === s.partner) || G.Moveset.edited(b) - G.Moveset.edited(a) || a - b);
    sel.innerHTML = mons.map(d => `<option value="${d}">${esc(G.DEX_BY[d].name)}${d === s.partner ? ' (partner)' : ''}${G.Moveset.edited(d) ? ' · custom' : ''}</option>`).join('');
    sel.value = dex;
    sel.onchange = () => { dex = +sel.value; clearing = false; G.Audio.sfx('select'); render(); };
    clearing = false;
    render();
  }

  function render() {
    const s = G.DB.save, mon = G.DEX_BY[dex], N = G.Moveset.SIZE;
    if (!mon) return;
    const shiny = dex === s.partner && !!s.partnerShiny && G.DB.ownsShiny(dex);
    G.UI.sprite($('ms-stage'), dex, { lively: true, scale: 2, hero: true, shiny });
    $('ms-stage').style.setProperty('--stage-c', shiny ? '#9ae6ff' : G.U.TYPE_COLOR[mon.types[0]]);
    const mine = G.Moveset.chosen(dex);
    const full = clearing ? mine : G.Moveset.of(dex);
    const auto = new Set(full.filter(id => !mine.includes(id)));
    const start = G.startMoveOf(dex);
    $('ms-count').innerHTML = `<b>${full.length}/${N}</b> in the moveset · ${mine.length} chosen by you` +
      (auto.size ? ` · ${auto.size} filled in automatically` : clearing && mine.length < N ? ` · ${N - mine.length} left (filled in automatically if you leave them)` : '');
    $('ms-reset').disabled = !mine.length;

    // Groups: signature, the Pokémon's own types, then Normal.
    const pool = G.Moveset.poolOf(mon);
    const groups = [];
    const sig = pool.filter(id => G.Moves.BY_ID[id].sig === dex);
    if (sig.length) groups.push(['Signature', sig]);
    for (const t of mon.types) if (t !== 'normal') groups.push([G.U.TYPE_NAME[t], pool.filter(id => G.Moves.BY_ID[id].type === t && !sig.includes(id))]);
    groups.push(['Normal', pool.filter(id => G.Moves.BY_ID[id].type === 'normal' && !sig.includes(id))]);
    const byName = (a, b) => G.Moves.BY_ID[a].name.localeCompare(G.Moves.BY_ID[b].name, 'en');

    const box = $('ms-list');
    box.innerHTML = '';
    for (const [title, ids] of groups) {
      if (!ids.length) continue;
      box.insertAdjacentHTML('beforeend', `<h3 class="ms-h">${esc(title)} <span class="sub">${ids.filter(id => full.includes(id)).length}/${ids.length}</span></h3>`);
      const grid = document.createElement('div');
      grid.className = 'ms-grid';
      for (const id of ids.slice().sort(byName)) {
        const d = G.Moves.BY_ID[id], on = mine.includes(id), au = auto.has(id);
        const fam = G.Moves.familyOf(id), ev = G.Moves.evoNeed(id), perk = ev && G.LevelUp.BY[ev.needs];
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ms-mv' + (on ? ' on' : au ? ' auto' : '');
        b.dataset.mv = id;                 // the menu's move tooltip (menu.js)
        b.style.setProperty('--tc', G.U.TYPE_COLOR[d.type]);
        b.innerHTML = `${G.Icons.html('move:' + id, 32)}<span class="ms-t"><b>${esc(d.name)}</b>
          <small>${G.Icons.kindTag(d.kind)}${d.cat ? ' ' + (d.cat === 'physical' ? 'Physical' : 'Special') : ''}${id === start ? ' · starting move' : ''}</small>
          ${perk ? `<small class="ms-evo">${esc(fam.name)} · evolves with ${G.Icons.html(perk.icon, 12)} ${esc(perk.title)}</small>` : ''}</span>
          <em>${on ? '✓' : au ? 'Auto' : ''}</em>`;
        b.onclick = () => toggle(id, on);
        grid.appendChild(b);
      }
      box.appendChild(grid);
    }
  }

  function toggle(id, on) {
    const N = G.Moveset.SIZE, mine = G.Moveset.chosen(dex);
    if (on) mine.splice(mine.indexOf(id), 1);
    else {
      if (mine.length >= N) { G.UI.toast('Your moveset is full (' + N + '): remove a move first'); G.Audio.sfx('error'); return; }
      mine.push(id);
    }
    G.Moveset.set(dex, mine);
    G.Audio.sfx('select');
    render();
  }

  return { init, open };
})();
