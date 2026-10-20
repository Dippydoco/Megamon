/* ============ leaveguard.js — don't lose a run by accident ============
 * During a run (any state but the menus and the end screen):
 *   - closing the tab, reloading, typing another address or following a link in the same tab asks the
 *     browser's "Leave site?" confirmation first (beforeunload);
 *   - the Back button (or the phone's back gesture) doesn't leave: it opens the pause menu instead.
 *     From there "Quit run" is the way out.
 * Nothing changes outside runs, and the auto-updater only reloads outside runs, so it never sees the prompt.
 * Opening another site in a new tab doesn't touch the game (it pauses itself while hidden).
 */
G.LeaveGuard = (() => {
  const inRun = () => !!G.Game && G.Game.state !== 'ui' && G.Game.state !== 'over' && !(G.Lab && G.Lab.active);
  let armed = false;

  addEventListener('beforeunload', e => {
    if (!inRun()) return;
    e.preventDefault();
    e.returnValue = '';          // older browsers need this to show the prompt
    return '';
  });

  // A history step of our own while a run is going, so Back lands on it instead of leaving the page.
  function arm() {
    if (armed) return;
    try { history.pushState({ megamonRun: 1 }, ''); armed = true; } catch (e) { /* nothing */ }
  }
  addEventListener('popstate', () => {
    armed = false;
    if (!inRun()) return;
    arm();                                          // stay on the page
    if (G.Game.state === 'playing') G.Game.togglePause();
    else G.UI.toast('Use Quit run in the pause menu to leave', 2200);
  });
  // Armed whenever a run is on (checked cheaply; pushState only once per run).
  setInterval(() => { if (inRun()) arm(); }, 1000);

  return { inRun };
})();
