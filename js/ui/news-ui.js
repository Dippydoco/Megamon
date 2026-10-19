/* ============ news-ui.js — "What's new" ============
 * A button in the top bar that opens the list of game changes
 * (js/data/changelog.js). It shows a dot while there's something you haven't seen.
 */
G.NewsUI = (() => {
  const $ = G.UI.$;
  const KEY = 'ps.news.seen';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // The last thing you've seen = how many entries there were (so several entries on the same day are flagged too).
  const latest = () => String(G.CHANGELOG.length);
  function seen() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }

  function init() {
    const b = $('btn-news');
    b.innerHTML = G.Icons.html('book', 18) + ' <span>What\'s new</span><i class="dot"></i>';
    b.onclick = open;
    $('news-close').onclick = close;
    refresh();
  }
  function refresh() { $('btn-news').classList.toggle('new', seen() !== latest()); }

  /** "18 October 2026 · 15:14": from the entry's `at` (UTC, shown in the reader's own time zone); old entries without it show just the date. */
  function fmt(v) {
    const lang = 'en-GB';
    const dt = v.at ? new Date(v.at) : null;
    if (dt && !isNaN(dt)) {
      return dt.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' }) + ' · ' +
             dt.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
    }
    const [y, m, day] = v.d.split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // ---------------- topics, filters and search ----------------
  // Every entry gets topics automatically from its text (or set `topic: ['moves', ...]` in the changelog to decide yourself).
  const TOPICS = [
    ['moves',   'Moves',     /\b(moves?|attacks?|bursts?|bonds?|bonded|evolv\w*|evolution|upgrades?|codex|cooldowns?|projectiles?|melee|beams?|boomerangs?|ranged)\b/gi],
    ['pokemon', 'Pokémon',   /\b(pok[eé]mon|partner|starters?|shiny|shinies|gacha|legendar\w*|dwebble|zygarde|arceus|mega|tickets?)\b/gi],
    ['coop',    'Co-op',     /\b(co-op|group|groups|team|teammates?|room|host|guests?|friends?|invit\w*)\b/gi],
    ['balance', 'Balance',   /\b(harder|easier|stronger|weaker|nerf\w*|buff\w*|balance|bosses|boss|enem(y|ies)|rift|rifts|arena|spawn\w*|healers?|hp|health)\b/gi],
    ['account', 'Account',   /\b(account|nickname|nicknames|login|log in|sign in|profile|cloud|settings|history|leaderboard|ranking|redeem|codes?)\b/gi],
    ['ui',      'Interface', /\b(menus?|screen|buttons?|mobile|phone|phones|touch|fullscreen|chat|notices?|icons?|hud|banner|pause|paused)\b/gi]
  ];
  // The two topics an entry talks about most (so the filter stays useful instead of matching everything).
  const topicsOf = v => {
    if (v._topics) return v._topics;
    if (Array.isArray(v.topic) && v.topic.length) return (v._topics = v.topic);
    const text = [v.title, v.title].concat(v.new || [], v.chg || [], v.fix || []).join(' ');     // (the title counts double)
    const scored = TOPICS.map(([k, , re]) => [k, (text.match(re) || []).length]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
    const out = scored.slice(0, 2).map(x => x[0]);
    return (v._topics = out.length ? out : ['other']);
  };
  const TYPES = [['new', 'New'], ['chg', 'Changes'], ['fix', 'Fixes']];
  const filter = { type: '', topic: '', q: '' };

  function matches(v) {
    if (filter.type && !(v[filter.type] && v[filter.type].length)) return false;
    if (filter.topic && !topicsOf(v).includes(filter.topic)) return false;
    if (filter.q) {
      const hay = [v.title].concat(v.new || [], v.chg || [], v.fix || []).join(' ').toLowerCase();
      if (!filter.q.toLowerCase().split(/\s+/).every(w => hay.includes(w))) return false;
    }
    return true;
  }

  const dayLabel = v => {
    const dt = v.at ? new Date(v.at) : null;
    const d = dt && !isNaN(dt) ? dt : new Date(v.d + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  function chips(items, cur, key) {
    return items.map(([k, lbl, n]) => `<button class="chip ${cur === k ? 'on' : ''}" data-f="${key}" data-v="${k}">${esc(lbl)}${n != null ? ` <small>${n}</small>` : ''}</button>`).join('');
  }

  function renderList(seenN) {
    const list = G.CHANGELOG.map((v, i) => ({ v, i })).filter(({ v }) => matches(v));
    const box = $('news-list');
    if (!list.length) { box.innerHTML = '<p class="sub" style="margin:14px 0">Nothing matches. Try another word or clear the filters.</p>'; return list.length; }
    let lastDay = '';
    box.innerHTML = list.map(({ v, i }) => {
      const day = dayLabel(v);
      const head = day !== lastDay ? `<h4 class="news-date">${esc(day)}</h4>` : '';
      lastDay = day;
      const unseen = i < seenN;
      return head + `<div class="news-day${unseen ? ' unseen' : ''}"><h3>${esc(v.title || '')}${unseen ? ' <em class="news-new">NEW</em>' : ''}<small>${fmt(v)}</small></h3>` +
        TYPES.filter(([k]) => v[k] && v[k].length).map(([k, lbl]) =>
          `<div class="news-part"><span class="news-tag ${k}">${lbl}</span><ul>${v[k].map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`).join('') +
        `<div class="news-topics">${topicsOf(v).map(t => { const f = TOPICS.find(x => x[0] === t); return `<button class="news-topic" data-f="topic" data-v="${t}">${f ? f[1] : 'Other'}</button>`; }).join('')}</div>` +
        '</div>';
    }).join('');
    return list.length;
  }

  function renderBar(seenN) {
    const count = pred => G.CHANGELOG.filter(pred).length;
    const types = TYPES.map(([k, l]) => [k, l, count(v => v[k] && v[k].length)]);
    const topics = TOPICS.map(([k, l]) => [k, l, count(v => topicsOf(v).includes(k))]).filter(t => t[2]);
    $('news-filters').innerHTML =
      `<input id="news-q" class="field" type="search" placeholder="Search changes…" value="${esc(filter.q)}" autocomplete="off" spellcheck="false">` +
      `<div class="chips news-chips">${chips(types, filter.type, 'type')}</div>` +
      `<div class="chips news-chips">${chips(topics, filter.topic, 'topic')}</div>`;
    const q = $('news-q');
    q.oninput = () => { filter.q = q.value.trim(); renderList(seenN); wire(); };
  }
  /** Chips and topic tags: click to filter, click again to clear. */
  function wire() {
    $('scr-news').querySelectorAll('[data-f]').forEach(b => {
      b.onclick = () => {
        const k = b.dataset.f, v = b.dataset.v;
        filter[k] = filter[k] === v ? '' : v;
        const top = $('news-body').scrollTop;
        render();
        $('news-body').scrollTop = top;
      };
    });
  }

  let seenAtOpen = 0;
  function render() {
    renderBar(seenAtOpen);
    renderList(seenAtOpen);
    wire();
  }

  function open() {
    // Entries newer than the last time you looked are marked NEW (the list is newest first).
    const last = parseInt(seen(), 10);
    seenAtOpen = Number.isFinite(last) ? Math.max(0, G.CHANGELOG.length - last) : 0;
    filter.type = filter.topic = filter.q = '';
    render();
    $('news-body').scrollTop = 0;
    $('scr-news').classList.remove('hidden');
    try { localStorage.setItem(KEY, latest()); } catch (e) { /* nothing */ }
    refresh();
  }
  function close() { $('scr-news').classList.add('hidden'); }

  return { init, open, close };
})();
