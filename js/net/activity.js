/* ============ activity.js — qué estás haciendo (para la lista de amigos) ============
 * Mira cada pocos segundos en qué pantalla estás (menú, gacha, mejoras, partida...) y se lo
 * dice a G.Social.setActivity, que sólo escribe cuando cambia (y como mucho una vez por minuto).
 * En una partida manda además cuándo empezó, para que los amigos vean cuánto lleva.
 */
G.Activity = (() => {
  const SCREEN = [['scr-gacha', 'gacha'], ['scr-upgrades', 'upgrades'], ['scr-dex', 'dex'],
                  ['scr-rank', 'rank'], ['scr-goals', 'goals'], ['scr-lobby', 'lobby']];

  function current() {
    const st = G.Game.state;
    if (st && st !== 'ui' && st !== 'over') {
      const kind = G.Judgment.active ? 'arceus' : G.Coop.active ? 'group' : 'run';
      return { act: kind, since: G.Social.now() - G.Game.st.time * 1000 };
    }
    for (const [id, a] of SCREEN) if (G.UI.isOpen(id)) return { act: a, since: 0 };
    return { act: 'menu', since: 0 };
  }

  function tick() {
    if (!G.Social.started) return;
    const c = current();
    G.Social.setActivity(c.act, c.since);
    if (c.since) G.Social.touch(5 * 60 * 1000);      // light heartbeat during a run
  }

  setInterval(tick, 3000);
  G.Settings.on(k => { if (k === 'shareAct') G.Social.touch(0); });
  return { current, tick };
})();
