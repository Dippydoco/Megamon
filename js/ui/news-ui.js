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
    b.innerHTML = G.Icons.html('book', 18) + ' <span>Novedades</span><i class="dot"></i>';
    b.onclick = open;
    $('news-close').onclick = close;
    refresh();
  }
  function refresh() { $('btn-news').classList.toggle('new', seen() !== latest()); }

  /** "18 October 2026 · 15:14": from the entry's `at` (UTC, shown in the reader's own time zone); old entries without it show just the date. */
  function fmt(v) {
    const lang = G.I18n.lang === 'en' ? 'en-GB' : 'es-ES';
    const dt = v.at ? new Date(v.at) : null;
    if (dt && !isNaN(dt)) {
      return dt.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' }) + ' · ' +
             dt.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
    }
    const [y, m, day] = v.d.split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function open() {
    const en = G.I18n.lang === 'en' ? 1 : 0;
    // Each text is already in its language: translate="no" so i18n doesn't touch it.
    const PARTS = [['new', ['Nuevo', 'New']], ['chg', ['Cambios', 'Changes']], ['fix', ['Arreglos', 'Fixes']]];
    $('news-body').innerHTML = G.CHANGELOG.map(v =>
      `<div class="news-day" translate="no"><h3>${esc(v.title ? v.title[en] : '')}<small>${fmt(v)}</small></h3>` +
      PARTS.filter(([k]) => v[k] && v[k].length).map(([k, lbl]) =>
        `<div class="news-part"><span class="news-tag ${k}">${lbl[en]}</span><ul>${v[k].map(t => `<li>${esc(t[en])}</li>`).join('')}</ul></div>`).join('') +
      '</div>').join('');
    $('news-body').scrollTop = 0;
    $('scr-news').classList.remove('hidden');
    try { localStorage.setItem(KEY, latest()); } catch (e) { /* nothing */ }
    refresh();
  }
  function close() { $('scr-news').classList.add('hidden'); }

  return { init, open, close };
})();
