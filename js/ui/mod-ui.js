/* ============ mod-ui.js — leaderboard moderation (hidden screen) ============
 * Only the moderation account sees it (G.Ranking.isAdmin, and firestore.rules
 * admin(): even if someone opened this screen, the server wouldn't let them
 * do anything). It's opened with the leaderboard's "Moderation" button.
 *
 *   Reports           records reported by players, most reported
 *                     first: remove the record from the Time survived tables, from the Most kills
 *                     tables (separately), ban (they can't upload records again, and their record
 *                     is deleted from all current tables) or dismiss the report.
 *   Banned            the accounts banned from the leaderboard; they can be unbanned.
 *   Add record        put a verified run from a player's history on Time survived and/or Most kills.
 * The leaderboard itself also shows the admin a remove button on each row (ranking-ui.js), for the
 * category being viewed.
 */
G.ModUI = (() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let tab = 'rep';

  function init() {
    $('mod-back').onclick = () => G.RankingUI.open();
    $('mod-purge').onclick = async () => {
      if (!confirm('Remove ALL entries over 2 hours from the leaderboard (all boards)? This cannot be undone.')) return;
      const b = $('mod-purge');
      b.disabled = true;
      try {
        const r = await G.Ranking.purgeAbove(7200, (i, n) => { b.textContent = 'Checking ' + i + ' / ' + n + '…'; });
        G.UI.toast('Removed ' + r.rows + ' entries over 2 hours (' + r.boards + ' boards)', 5000);
      } catch (e) { G.UI.toast('Failed: ' + (e.code || e.message), 5000); }
      b.disabled = false; b.textContent = 'Remove entries over 2 hours';
      render();
    };
    document.querySelectorAll('#mod-tabs .tab').forEach(t => { t.onclick = () => { tab = t.dataset.tab; render(); }; });
    $('mod-export').onclick = exportRuns;
  }

  /**
   * Downloads every shared run history (histories/{uid}: players who left "Share my run history" on)
   * as one JSON file, with each player's nickname, for balance analysis. One read per player.
   */
  async function exportRuns() {
    const b = $('mod-export');
    b.disabled = true; b.textContent = 'Exporting…';
    try {
      const fs = G.DB.fb.fs;
      const snap = await fs.collection('histories').get();
      const players = await Promise.all(snap.docs.map(async d => {
        const prof = await fs.collection('profiles').doc(d.id).get().catch(() => null);
        const runs = ((d.data() || {}).runs || []).map(r => { try { return typeof r === 'string' ? JSON.parse(r) : r; } catch (e) { return null; } }).filter(Boolean);
        return { uid: d.id, name: prof && prof.exists ? prof.data().name : '', runs };
      }));
      const data = { exportedAt: new Date().toISOString(), version: (G.VERSION || ''), players };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'megamon-runs-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      G.UI.toast('Exported ' + players.reduce((n, p) => n + p.runs.length, 0) + ' runs from ' + players.length + ' players', 5000);
    } catch (e) { G.UI.toast('Export failed: ' + (e.code || e.message), 5000); }
    b.disabled = false; b.textContent = 'Export runs';
  }

  function open() {
    if (!G.Ranking.isAdmin()) return;
    G.UI.show('scr-mod', true);
    render();
  }

  const fmt = t => G.U.mmss(t || 0);
  const btn = (label, cls, fn) => { const b = document.createElement('button'); b.className = 'btn small ' + cls; b.textContent = label; b.onclick = fn; return b; };

  async function render() {
    document.querySelectorAll('#mod-tabs .tab').forEach(t => t.classList.toggle('on', t.dataset.tab === tab));
    const list = $('mod-list');
    list.innerHTML = '<p class="sub">Loading…</p>';
    try {
      if (tab === 'rep') await renderReports(list);
      else if (tab === 'add') renderAdd(list);
      else await renderMarked(list);
    } catch (e) {
      list.innerHTML = '<p class="sub">Could not load (' + esc(e.code || e.message) + ').</p>';
    }
  }

  /**
   * Add record: a verified run from a player's shared history goes on the leaderboard (for runs the
   * server refused at the time). Find the player by nickname, pick the run, confirm.
   */
  function renderAdd(list) {
    list.innerHTML = `<p class="sub">Put a verified run from a player's run history on the leaderboard (for runs the server refused at the time).
      Time survived and Most kills are added separately. Only runs they share on their profile can be found.</p>
      <form class="row" id="mod-add-form" autocomplete="off" style="gap:6px;margin:6px 0">
        <input id="mod-add-name" class="field grow" placeholder="Player nickname" spellcheck="false">
        <button class="btn small gold" type="submit">Find runs</button></form><div id="mod-add-runs"></div>`;
    $('mod-add-form').onsubmit = async e => {
      e.preventDefault();
      const name = $('mod-add-name').value.trim();
      const out = $('mod-add-runs');
      if (!name) return;
      out.innerHTML = '<p class="sub">Loading…</p>';
      try {
        const n = await G.DB.fb.fs.collection('names').doc(name.toLowerCase()).get();
        if (!n.exists) { out.innerHTML = '<p class="sub">No player with that nickname.</p>'; return; }
        const owner = { uid: n.data().uid, name };
        const prof = await G.DB.fb.fs.collection('profiles').doc(owner.uid).get().catch(() => null);
        if (prof && prof.exists && prof.data().name) owner.name = prof.data().name;
        const runs = (await G.Social.getHistory(owner.uid)).slice().sort((a, b) => b.t - a.t).slice(0, 25);
        if (!runs.length) { out.innerHTML = '<p class="sub">No shared runs for ' + esc(owner.name) + '.</p>'; return; }
        out.innerHTML = '';
        for (const r of runs) {
          const row = document.createElement('div');
          row.className = 'rk-row mod-row';
          const mon = G.DEX_BY[r.d];
          const team = r.g ? 'Group of ' + (1 + (r.mt || []).length) + ': ' + (r.mt || []).map(m => m[0]).join(', ') : 'Solo';
          row.innerHTML = `<span class="pos">${fmt(r.t)}</span><span class="who"><b>${esc(mon ? mon.name : '#' + r.d)} · ${(r.k || 0).toLocaleString('en-GB')} defeated · Lv. ${r.lv}</b>
            <small>${esc(team)} · ${new Date(r.id).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${r.ar ? ' · reached Arceus' : ''}</small></span>`;
          const acts = document.createElement('span');
          acts.className = 'mod-acts';
          const addBtn = (which, label, what) => {
            const b = btn(label, 'gold', async () => {
              if (!confirm('Add ' + owner.name + "'s run (" + what + ') to ' + CAT[which] + '?')) return;
              b.disabled = true; b.textContent = 'Adding…';
              try {
                const res = await G.Ranking.adminAdd(r, owner, which);
                const msg = res.errs.length ? 'Some tables refused it: ' + res.errs.join('; ') : 'Added to ' + res.boards + ' ' + CAT[which] + ' tables' + (res.missing.length ? ' (not found: ' + res.missing.join(', ') + ')' : '');
                G.UI.toast(msg, 6000);
                b.textContent = res.errs.length ? 'Partly added' : 'Added';
              } catch (err) { G.UI.toast('Failed: ' + (err.code || err.message), 6000); b.disabled = false; b.textContent = label; }
            });
            return b;
          };
          const kb = addBtn('kills', 'Add to Most kills', (r.k || 0).toLocaleString('en-GB') + ' defeated');
          if (!(r.k > 0)) { kb.disabled = true; kb.title = 'No kills in this run'; }
          acts.append(addBtn('time', 'Add to Time survived', fmt(r.t)), kb);
          row.appendChild(acts);
          out.appendChild(row);
        }
      } catch (err) { out.innerHTML = '<p class="sub">Could not load (' + esc(err.code || err.message) + ').</p>'; }
    };
  }

  const CAT = { time: 'Time survived', kills: 'Most kills', both: 'Time survived and Most kills' };

  /** "s_w2026-42" -> "Solo · Time survived · Week", "gk_m202610j_n3" -> "Group of 3 · Most kills · Month" */
  function boardName(b) {
    const [m, p] = b.split('_');
    const n = (b.match(/_n(\d)$/) || [])[1];
    const mode = (m[0] === 'g' ? 'Group' + (n ? ' of ' + n : '') : 'Solo') + ' · ' + CAT[G.Ranking.kindOf(b)];
    const per = p.startsWith('d') ? 'Today' : p.startsWith('w') ? 'Week' : p.startsWith('m') ? 'Month' : 'All time';
    const dex = (b.match(/_p(\d+)$/) || [])[1];
    return mode + ' · ' + per + (dex && G.DEX_BY[dex] ? ' · only ' + G.DEX_BY[dex].name : '');
  }
  // Arceus's Judgment (minute 30) ends most runs by minute ~33, but strong players have survived past an hour
  // (21-10-2026), so only runs past 90 minutes are flagged as unusual.
  const SUSPECT_T = 90 * 60;

  async function renderReports(list) {
    const groups = await G.Ranking.reports();
    list.innerHTML = groups.length ? '' : '<p class="sub">No reports.</p>';
    for (const g of groups) {
      const row = document.createElement('div');
      row.className = 'rk-row mod-row rep';
      const mode = G.Ranking.modeOf(g.board), kind = G.Ranking.kindOf(g.board);
      // What the record currently shows in its table (level, defeated, Pokémon).
      const info = await G.Ranking.entryInfo(g.board, g.e).catch(() => null);
      const t = info ? info.t : g.t;
      const sus = t > SUSPECT_T;
      const mons = document.createElement('span');
      mons.className = 'mons';
      if (info) info.dex.forEach((d, i) => { if (G.DEX_BY[d]) mons.appendChild(G.UI.spriteCanvas(d, 44, 40, { scale: 1, shiny: !!(info.shiny || [])[i] })); });
      row.innerHTML = `<span class="pos" title="times reported">${g.n}×</span>`;
      row.appendChild(mons);
      row.insertAdjacentHTML('beforeend', `<span class="who"><b translate="no">${g.names.map(esc).join(' · ')}</b>
          <small>Reported in ${esc(boardName(g.board))}${info ? ' · Lv. ' + (info.lv || 1) + ' · ' + (info.kills || 0).toLocaleString('en') + ' defeated' : ' · no longer in the top 50'}</small>
          ${sus ? '<small class="mod-warn">Over 90 min: very unusual, check it</small>' : ''}</span>
        <span class="time${sus ? ' mod-warn' : ''}">${fmt(t)}</span>`);
      const acts = document.createElement('span');
      acts.className = 'mod-acts';
      const busy = async (fn, msg, keep) => {
        acts.querySelectorAll('button').forEach(b => { b.disabled = true; });
        try { await fn(); G.UI.toast(msg); if (keep) keep(); else row.remove(); }
        catch (e) { G.UI.toast('Failed: ' + (e.code || e.message)); acts.querySelectorAll('button').forEach(b => { b.disabled = !!b.dataset.done; }); }
      };
      const dexes = info ? info.dex : [];
      // Removing from one category leaves the row so the other can still be removed (or the report dismissed).
      const removeBtn = which => {
        const b = btn('Remove from ' + CAT[which], 'ghost', () => {
          if (!confirm('Remove ' + g.names.join(', ') + "'s record from all current " + CAT[which] + ' tables?')) return;
          busy(async () => {
            await G.Ranking.removeEverywhere(g.e, mode, dexes, g.board, which);
            if (which === kind) await G.Ranking.dismiss(g.ids);
          }, 'Removed from ' + CAT[which], () => {
            b.dataset.done = '1'; b.textContent = 'Removed from ' + CAT[which];
            acts.querySelectorAll('button').forEach(x => { x.disabled = !!x.dataset.done; });
            row.classList.add('mod-done');
          });
        });
        return b;
      };
      acts.append(
        removeBtn('time'),
        removeBtn('kills'),
        btn('Ban', 'danger', () => {
          if (!confirm('Ban ' + g.names.join(', ') + '? They will no longer be able to appear on the leaderboard, and their entry is deleted.')) return;
          busy(async () => {
            const uids = g.e.split('_');
            for (const u of uids) await G.Ranking.setMarked(u, true).catch(() => {});
            await G.Ranking.removeEverywhere(g.e, mode, dexes, g.board, 'both');
            await G.Ranking.dismiss(g.ids);
          }, 'Banned');
        }),
        btn('Dismiss', 'ghost', () => busy(() => G.Ranking.dismiss(g.ids), 'Report dismissed'))
      );
      row.appendChild(acts);
      list.appendChild(row);
    }
  }

  async function renderMarked(list) {
    const accs = await G.Ranking.markedAccounts();
    list.innerHTML = accs.length ? '' : '<p class="sub">No banned accounts.</p>';
    for (const a of accs) {
      const row = document.createElement('div');
      row.className = 'rk-row mod-row';
      row.innerHTML = `<span class="pos"></span>
        <span class="who"><b translate="no">${esc(a.name)}</b><small translate="no">${a.coins.toLocaleString('en')} coins · ${a.t1} tickets · ${a.t10} ×10 · ${a.owned} Pokémon · ${esc(a.uid)}</small></span>`;
      const acts = document.createElement('span');
      acts.className = 'mod-acts';
      acts.append(btn('Unban', 'ghost', async () => {
        try { await G.Ranking.setMarked(a.uid, false); G.UI.toast('Unbanned'); row.remove(); }
        catch (e) { G.UI.toast('Failed: ' + (e.code || e.message)); }
      }));
      row.appendChild(acts);
      list.appendChild(row);
    }
  }

  /** Leaderboard row (admin): removes that record from the category being viewed. */
  async function removeRow(r, b, which, done) {
    if (!G.Ranking.isAdmin()) return;
    if (!confirm('Remove ' + r.names.join(', ') + "'s record from all current " + CAT[which] + ' tables? Their ' +
      (which === 'time' ? 'Most kills' : 'Time survived') + ' record stays.')) return;
    try {
      await G.Ranking.removeEverywhere(r.id, G.Ranking.modeOf(b), r.dex || [], b, which);
      G.UI.toast('Removed from ' + CAT[which]);
      if (done) done();
    } catch (e) { G.UI.toast('Failed: ' + (e.code || e.message), 5000); }
  }

  return { init, open, removeRow };
})();
