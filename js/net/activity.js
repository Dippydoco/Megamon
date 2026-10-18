/* ============ activity.js — what you're doing (for the friends list) ============
 * Every few seconds it checks which screen you're on (menu, gacha, upgrades, run...) and tells
 * G.Social.setActivity, which only writes when it changes (and at most once a minute).
 * During a run it also sends when it started, so friends can see how long it's been going.
 */
G.Activity = (() => {
  const SCREEN = [['scr-gacha', 'gacha'], ['scr-upgrades', 'upgrades'], ['scr-dex', 'dex'],
                  ['scr-rank', 'rank'], ['scr-goals', 'goals'], ['scr-lobby', 'lobby']];

  function current() {
    const st = G.Game.state;
    if (st && st !== 'ui' && st !== 'over') {
      const kind = G.Judgment.active ? 'arceus' : G.Coop.active ? 'group' : 'run';
      const pl = G.Game.player;
      return { act: kind, since: G.Social.now() - G.Game.st.time * 1000, mon: pl ? pl.dex : 0 };
    }
    for (const [id, a] of SCREEN) if (G.UI.isOpen(id)) return { act: a, since: 0 };
    return { act: 'menu', since: 0 };
  }

  function tick() {
    if (!G.Social.started) return;
    const c = current();
    G.Social.setActivity(c.act, c.since, c.mon);
    if (c.since) G.Social.touch(5 * 60 * 1000);      // light heartbeat during a run
  }

  setInterval(tick, 3000);
  G.Settings.on(k => { if (k === 'shareAct') G.Social.touch(0); });
  return { current, tick };
})();
