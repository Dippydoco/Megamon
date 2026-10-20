/* ============ mod-ui.js — leaderboard moderation (hidden screen) ============
 * Only the moderation account sees it (G.Ranking.isAdmin, and firestore.rules
 * admin(): even if someone opened this screen, the server wouldn't let them
 * do anything). It's opened with the leaderboard's "Moderation" button.
 *
 *   Reports           records reported by players, most reported
 *                     first: delete the record, ban (they can't upload
 *                     records again, and their record is deleted from all current
 *                     tables) or dismiss the report.
 *   Banned            the accounts banned from the leaderboard; they can be unbanned.
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
      else await renderMarked(list);
    } catch (e) {
      list.innerHTML = '<p class="sub">Could not load (' + esc(e.code || e.message) + ').</p>';
    }
  }

  /** "s_w2026-42" -> "Solo · Week" */
  function boardName(b) {
    const [m, p] = b.split('_');
    const mode = m === 'g' ? 'Group' : 'Solo';
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
      const mode = g.board.startsWith('g_') ? 'g' : 's';
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
          <small>${esc(boardName(g.board))}${info ? ' · Lv. ' + (info.lv || 1) + ' · ' + (info.kills || 0).toLocaleString('en') + ' defeated' : ' · no longer in the top 50'}</small>
          ${sus ? '<small class="mod-warn">Over 90 min: very unusual, check it</small>' : ''}</span>
        <span class="time${sus ? ' mod-warn' : ''}">${fmt(t)}</span>`);
      const acts = document.createElement('span');
      acts.className = 'mod-acts';
      const busy = async (fn, msg) => {
        acts.querySelectorAll('button').forEach(b => { b.disabled = true; });
        try { await fn(); G.UI.toast(msg); row.remove(); }
        catch (e) { G.UI.toast('Failed: ' + (e.code || e.message)); acts.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
      };
      acts.append(
        btn('Delete entry', 'ghost', () => busy(async () => {
          await G.Ranking.removeEverywhere(g.e, mode, [], g.board);
          await G.Ranking.dismiss(g.ids);
        }, 'Entry deleted')),
        btn('Ban', 'danger', () => {
          if (!confirm('Ban ' + g.names.join(', ') + '? They will no longer be able to appear on the leaderboard, and their entry is deleted.')) return;
          busy(async () => {
            const uids = g.e.split('_');
            for (const u of uids) await G.Ranking.setMarked(u, true).catch(() => {});
            await G.Ranking.removeEverywhere(g.e, mode, [], g.board);
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

  return { init, open };
})();
