/* ============ updater.js — automatic updates ============
 * When a new version is published (node tools/build.js writes version.json with
 * the fingerprint of js/app.min.js), every player gets it without losing anything:
 *
 *   - Every 5 min (and on returning to the tab) version.json is checked (served by
 *     GitHub Pages: it costs nothing).
 *   - If they're NOT in a run: an "updating in 5 s…" notice and the page reloads.
 *     If they're in the gacha, the upgrade shop, the settings or typing in
 *     a field, it waits until they finish. In a co-op room, it reloads
 *     anyway (decided on 12-10-2026).
 *   - If they're IN A RUN: left alone. When it ends, the run is saved as
 *     usual (records, coins, tickets, leaderboard) and, on returning to the menu, it
 *     reloads.
 *   - Before reloading it waits for the save to upload to the cloud
 *     (a few seconds at most; if not, it stays in this browser and is uploaded on
 *     signing in).
 *   - MANDATORY version (node tools/build.js --force writes force:true in
 *     version.json): anyone in a run sees a 10 s notice and the run
 *     ends as if abandoned (coins, tickets, records and
 *     leaderboard are saved), uploads to the cloud and reloads. Only players
 *     who already have this updater.js understand it (since 15-10-2026).
 * And you can't START a run once a new version is published: on pressing Play (or
 *   Start in the room) version.json is checked and, if there's a new version, the page reloads instead of
 *   starting (gate(), since 18-10-2026).
 * It only works on the published site (with app.min.js); in dev.html or by
 * double-click (file://) it does nothing.
 */
G.Updater = (() => {
  const EVERY = 5 * 60 * 1000, COUNTDOWN = 5, FORCED = 10;
  const tag = document.querySelector('script[src*="app.min.js?v="]');
  const mine = tag ? (tag.getAttribute('src').match(/v=([0-9a-f]+)/) || [])[1] : null;
  let pending = false, forced = false, lastCheck = 0, timer = 0, counting = false;

  async function check() {
    if (!mine || pending) return;
    lastCheck = Date.now();
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      if (j && j.v && j.v !== mine) { pending = true; forced = !!j.force; console.log('[Update] new version', j.v, '(this is', mine + ')', forced ? 'MANDATORY' : ''); }
    } catch (e) { /* no network: check next time */ }
  }

  /**
   * Before STARTING a run (Play, Start in the room): checks version.json right away
   * (if it hasn't been checked for more than 10 s) and, if there's a new version, won't let it start: it reloads.
   * Returns true if the run can start. With no network or in dev.html: true.
   */
  async function gate() {
    if (!mine || !location.protocol.startsWith('http')) return true;
    if (!pending && Date.now() - lastCheck > 10000) await Promise.race([check(), new Promise(r => setTimeout(r, 3000))]);
    if (!pending) return true;
    if (!counting) {
      counting = true;
      G.UI.toast('A new version is out: updating now so you can start a game…', 2500);
      setTimeout(reload, 1500);
    }
    return false;
  }

  /** Can it reload now without interrupting anything? */
  function safe() {
    if (!G.Game || G.Game.state !== 'ui') return false;                   // in a run or on the summary
    if (['scr-gacha', 'scr-upgrades', 'scr-settings', 'scr-codex'].some(id => document.getElementById(id) && G.UI.isOpen(id))) return false;
    const fx = document.getElementById('pull-fx');
    if (fx && !fx.classList.contains('hidden')) return false;             // gacha pull in progress
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false;   // typing (password, nickname...)
    return true;
  }

  async function reload() {
    // Let the save upload to the cloud before reloading (6 s at most).
    const dirty = G.DB.syncState && G.DB.syncState !== 'ok' && G.DB.syncState !== 'local';
    if (dirty) { try { await Promise.race([G.DB.flush(), new Promise(r => setTimeout(r, 6000))]); } catch (e) { /* stays in this browser */ } }
    location.reload();
  }

  function countdown() {
    counting = true;
    let n = COUNTDOWN;
    const tick = () => {
      if (!safe()) { counting = false; G.UI.toast('', 1); return; }     // a run has started: wait
      if (n <= 0) { reload(); return; }
      G.UI.toast('A new version of the game is out: updating in ' + n + ' s…', 1500);
      n--;
      setTimeout(tick, 1000);
    };
    tick();
  }

  /** Is a run being played (which a mandatory version must close)? */
  function inRun() { return G.Game && G.Game.state !== 'ui' && G.Game.state !== 'over'; }

  /** Mandatory version mid-run: notice, the run ends (everything is saved) and the page reloads. */
  function forceEnd() {
    counting = true;
    let n = FORCED;
    const tick = () => {
      if (!inRun()) { reload(); return; }                                 // they ended it themselves
      if (n <= 0) {
        G.Game.quit();                                                    // like abandoning: what was earned is saved
        setTimeout(reload, 4000);                                         // lets the record and leaderboard go through
        return;
      }
      G.UI.toast('Required update: your run is saved and the game reloads in ' + n + ' s…', 1500);
      n--;
      setTimeout(tick, 1000);
    };
    tick();
  }

  function loop() {
    if (pending && forced && !counting && inRun()) { forceEnd(); return; }
    if (pending && forced && !counting && G.Game && G.Game.state === 'over') { reload(); return; }   // summary: already saved
    if (pending && !counting && safe()) countdown();
    if (!pending && Date.now() - lastCheck > EVERY) check();
  }

  function init() {
    if (!mine || !location.protocol.startsWith('http')) return;
    clearInterval(timer);
    timer = setInterval(loop, 2000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - lastCheck > 60000) check(); });
    setTimeout(check, 30000);
  }

  return { init, check, gate, get pending() { return pending; }, get version() { return mine; } };
})();
