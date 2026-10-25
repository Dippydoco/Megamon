/* ============ ranking-ui.js — leaderboard screen ============
 * Solo / Group tabs, period (daily ... all-time), everyone or friends only,
 * per-Pokémon filter (all-time only) and your rank at the bottom even if you're not
 * in the top. What's read is cached for 5 min (see ranking.js).
 */
G.RankingUI = (() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // metric: 't' time survived · 'k' most kills · 'l' highest level (25-10-2026)
  let mode = 's', period = 'w', scope = 'all', dex = null, metric = 't', size = 2;      // size: group size (2-5)
  const eff = () => mode + (metric === 'k' ? 'k' : metric === 'l' ? 'l' : '');
  const gs = () => (mode === 'g' ? size : null);
  let token = 0;
  // The view is remembered between visits (24-10-2026).
  const VIEW = 'ps.rk.view';
  try {
    const v = JSON.parse(localStorage.getItem(VIEW) || 'null');
    if (v) { mode = v.mode === 'g' ? 'g' : 's'; metric = ['k', 'l'].includes(v.metric) ? v.metric : 't'; period = ['d', 'w', 'm', 'a'].includes(v.period) ? v.period : 'w';
             scope = v.scope === 'friends' ? 'friends' : 'all'; size = [2, 3, 4, 5].includes(v.size) ? v.size : 2; }
  } catch (e) { /* nothing */ }
  const remember = () => { try { localStorage.setItem(VIEW, JSON.stringify({ mode, metric, period, scope, size })); } catch (e) { /* nothing */ } };
  const PERIOD_LABEL = { d: 'Today', w: 'This week', m: 'This month', a: 'All time' };

  function init() {
    const dl = $('rk-dl');
    dl.innerHTML = G.DEX.map(p => `<option value="${esc(p.name)}">`).join('');
    $('rk-poke').onchange = () => {
      const v = $('rk-poke').value.trim().toLowerCase();
      const p = G.DEX.find(x => x.name.toLowerCase() === v);
      if (!v) { setDex(null); return; }
      if (!p) { G.UI.toast('There\'s no Pokémon with that name'); return; }
      setDex(p.dex);
    };
    $('rk-clear').onclick = () => { $('rk-poke').value = ''; setDex(null); };
    $('rk-mod').onclick = () => G.ModUI.open();
  }

  /** The per-Pokémon filter only exists in the all-time table: picking one switches to that tab. */
  function setDex(d) {
    dex = d;
    if (d) { metric = 't'; if (period !== 'a') period = 'a'; }
    $('rk-clear').classList.toggle('hidden', !d);
    tabs(); load();
  }

  function open() {
    if (!G.SocialUI.needOnline()) return;
    G.UI.show('scr-rank', true);
    if (!G.Social.started) G.Social.start();
    $('rk-mod').classList.toggle('hidden', !G.Ranking.isAdmin());
    tabs();
    load();
  }

  function tabs() {
    const mk = (box, items, cur, set) => {
      box.innerHTML = '';
      for (const [k, label, tip] of items) {
        const b = document.createElement('button');
        b.className = k === cur ? 'on' : '';
        b.innerHTML = label;
        if (tip) b.title = tip;
        b.dataset.sfx = 'click';
        b.onclick = () => { if (k === cur) return; set(k); remember(); tabs(); load(); };
        box.appendChild(b);
      }
    };
    const dropDex = () => { if (dex) { dex = null; $('rk-poke').value = ''; $('rk-clear').classList.add('hidden'); } };
    mk($('rk-metric'), [['t', `${G.Icons.html('clock', 18)} Time survived`, 'The longest runs'], ['k', `${G.Icons.html('fist', 18)} Most kills`, 'The most Pokémon defeated in one run'],
                        ['l', `${G.Icons.html('up', 18)} Highest level`, 'The highest level your Pokémon reached in one run']],
       metric, k => { metric = k; if (k !== 't') dropDex(); });
    mk($('rk-mode'), [['s', `${G.Icons.html('user', 14)} Solo`], ['g', `${G.Icons.html('friends', 14)} Group`]], mode, k => { mode = k; });
    // Group: a separate leaderboard for each team size.
    $('rk-size').classList.toggle('hidden', mode !== 'g');
    $('rk-size-lab').classList.toggle('hidden', mode !== 'g');
    mk($('rk-size'), G.Ranking.SIZES.map(n => [n, String(n), 'Teams of ' + n + ' players']), size, k => { size = k; });
    mk($('rk-period'), G.Ranking.PERIODS.map(([k]) => [k, PERIOD_LABEL[k]]), period, k => { period = k; if (k !== 'a') dropDex(); });
    mk($('rk-scope'), [['all', 'Everyone'], ['friends', 'Friends']], scope, k => { scope = k; });
    // The Pokémon filter only exists for time survived (every period: picking one switches to All time).
    $('rk-poke-wrap').classList.toggle('hidden', metric !== 't');
    $('rk-poke').placeholder = period === 'a' ? 'Filter by Pokémon' : 'Pokémon (All time)';
    // What you're looking at, in words.
    $('rk-title').innerHTML = (metric === 'k' ? 'Most kills' : metric === 'l' ? 'Highest level' : 'Longest time survived') + ' · '
      + (mode === 's' ? 'Solo' : 'Groups of ' + size) + ' · ' + PERIOD_LABEL[period]
      + (dex ? ' · ' + esc(G.DEX_BY[dex].name) + ' only' : '') + (scope === 'friends' ? ' · <span class="gold">friends only</span>' : '');
  }

  const fmtK = n => (n || 0).toLocaleString('en-GB') + ' kills';
  const fmtL = n => 'Lv. ' + (n || 1);
  const fmt = t => t >= 3600 ? Math.floor(t / 3600) + ':' + G.U.mmss(t % 3600).padStart(5, '0') : G.U.mmss(t);

  async function load() {
    const my = ++token;
    const list = $('rk-list');
    list.innerHTML = '<p class="sub">Loading…</p>';
    $('rk-me').innerHTML = '';
    let rows = [], me = null;
    try {
      [rows, me] = await Promise.all([
        G.Ranking.top(eff(), period, dex, scope === 'friends', gs()),
        G.Social.me ? G.Ranking.myRank(eff(), period, dex, gs()) : Promise.resolve(null)
      ]);
    } catch (e) {
      if (my !== token) return;
      list.innerHTML = '<p class="sub">Couldn\'t load the leaderboard (' + esc(e.code || e.message) + ').</p>';
      return;
    }
    if (my !== token) return;
    list.innerHTML = '';
    if (!rows.length) {
      list.innerHTML = '<p class="sub">No records here yet. Be the first!</p>';
    }
    const uid = G.Social.uid;
    const b = G.Ranking.board(eff(), period, dex, gs()), done = G.Ranking.reported();
    rows.forEach((r, i) => list.appendChild(rowEl(r, i + 1, r.uids.includes(uid), b, done)));
    const val = metric === 'k' ? fmtK : metric === 'l' ? fmtL : fmt;

    const pn = { d: 'today', w: 'this week', m: 'this month', y: 'this year', a: 'of all time' }[period];
    const mon = dex ? G.DEX_BY[dex].name : '';
    const where = (mode === 's' ? 'solo' : 'in groups of ' + size) + (dex ? ' with ' + mon : '');
    $('rk-me').innerHTML = !G.Social.me ? 'Choose a nickname (in Friends) to appear on the leaderboard.'
      : me && me.out ? `<b>You:</b> not in the top 50 ${where} ${pn} yet. Your exact rank is in All time.`
      : me ? `<b>You:</b> <b class="gold">#${me.pos}</b> ${where} ${pn} · ${val(me.t)}`
      : `<b>You:</b> no ${where} record ${pn} yet.`;
  }

  function rowEl(r, pos, mine, b, done) {
    const kills = metric === 'k', level = metric === 'l';
    const el = document.createElement('div');
    el.className = 'rk-row' + (mine ? ' mine' : '') + (pos <= 3 ? ' top' + pos : '');
    el.insertAdjacentHTML('beforeend', `<span class="pos">${pos <= 3 ? G.Icons.html('trophy', 20) : ''}${pos}</span>`);
    const mons = document.createElement('span');
    mons.className = 'mons';
    r.dex.forEach((d, i) => { if (G.DEX_BY[d]) mons.appendChild(G.UI.spriteCanvas(d, 44, 40, { scale: 1, shiny: !!r.shiny[i] })); });
    el.appendChild(mons);
    el.insertAdjacentHTML('beforeend',
      `<span class="who"><b translate="no">${r.names.map((n, i) => `<a href="#" class="plink" data-u="${esc(r.uids[i] || '')}">${esc(n)}</a>`).join(' · ')}</b><small>${level ? fmt(r.t) + ' survived · ' + (r.kills || 0).toLocaleString('en') + ' defeated' : 'Lv. ' + (r.lv || 1) + ' · ' + (kills ? fmt(r.t) + ' survived' : (r.kills || 0).toLocaleString('en') + ' defeated')}${period === 'a' && r.at ? ' · <span translate="no">' + new Date(r.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + '</span>' : ''}</small></span>
       <span class="time">${kills ? (r.kills || 0).toLocaleString('en-GB') : level ? 'Lv. ' + (r.lv || 1) : fmt(r.t)}</span>`);
    el.querySelectorAll('.plink').forEach(a => { a.onclick = e => { e.preventDefault(); G.ProfileUI.show(a.dataset.u); }; });
    // Report a suspicious record (not your own). The admin reviews it (mod-ui.js).
    if (!mine && G.Social.me) {
      const rep = document.createElement('button');
      const rb = r.src || b, sent = done.has(rb + '__' + r.id);
      rep.className = 'rk-rep' + (sent ? ' sent' : '');
      rep.title = sent ? 'You already reported it' : 'Report suspicious record';
      rep.innerHTML = G.Icons.html('flag', 16);
      rep.onclick = async () => {
        if (rep.classList.contains('sent')) { G.UI.toast('You already reported this record'); return; }
        if (!confirm('Report ' + r.names.join(', ') + '\'s record as cheating?')) return;
        rep.classList.add('sent'); rep.title = 'You already reported it';
        await G.Ranking.report(rb, r);
        G.UI.toast('Thanks: we will review it');
      };
      el.appendChild(rep);
    } else el.appendChild(document.createElement('span'));
    // Moderation: remove this record from the category being viewed (Time survived, Most kills or Highest level) only.
    if (G.Ranking.isAdmin()) {
      el.classList.add('admin');
      const rm = document.createElement('button');
      rm.className = 'rk-rep rk-del';
      const cat = kills ? 'kills' : level ? 'level' : 'time';
      rm.title = 'Moderation: remove from ' + { kills: 'Most kills', level: 'Highest level', time: 'Time survived' }[cat];
      rm.textContent = '✕';
      rm.onclick = () => G.ModUI.removeRow(r, r.src || b, cat, () => { el.style.opacity = '.35'; rm.disabled = true; });
      el.appendChild(rm);
    }
    return el;
  }

  return { init, open };
})();
