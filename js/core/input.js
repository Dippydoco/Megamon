/* ============ input.js — keyboard and mouse (touch is in touch.js) ============ */
G.Input = (() => {
  const down = new Set();
  const pressed = new Set();   // cleared every frame
  let mx = 0, my = 0, mdown = false;

  const MOVE_KEYS = {
    up: ['keyw', 'arrowup'], down: ['keys', 'arrowdown'],
    left: ['keya', 'arrowleft'], right: ['keyd', 'arrowright']
  };

  function code(e) { return (e.code || e.key).toLowerCase(); }

  // Typing in a text box (chat, nickname...) must not move the player or trigger game keys.
  const typing = e => { const t = e.target; return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); };

  addEventListener('keydown', e => {
    if (typing(e)) { down.clear(); return; }
    // Ctrl / Cmd shortcuts (and the OS menus they open) often swallow the keyup: don't hold movement through them.
    if (e.ctrlKey || e.metaKey || e.altKey) { down.clear(); return; }
    const c = code(e);
    if (!down.has(c)) pressed.add(c);
    down.add(c);
    // Stops the browser scrolling with arrows/space during the game.
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'space', 'tab'].includes(c)) e.preventDefault();
  });
  addEventListener('keyup', e => down.delete(code(e)));
  addEventListener('blur', () => { down.clear(); });
  // A key released while the page was hidden or another window had focus never sends keyup: forget held keys.
  document.addEventListener('visibilitychange', () => down.clear());
  addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  addEventListener('mousedown', () => mdown = true);
  addEventListener('mouseup', () => mdown = false);

  return {
    /** The player's movement vector (keyboard or touch joystick). */
    axis() {
      const t = G.Touch && G.Touch.vector();
      if (t && (t[0] || t[1])) return t;
      let x = 0, y = 0;
      if (MOVE_KEYS.left.some(k => down.has(k))) x -= 1;
      if (MOVE_KEYS.right.some(k => down.has(k))) x += 1;
      if (MOVE_KEYS.up.some(k => down.has(k))) y -= 1;
      if (MOVE_KEYS.down.some(k => down.has(k))) y += 1;
      return G.U.norm(x, y);
    },
    held(c) { return down.has(c); },
    /** Forget every held key (an overlay opened: a keyup may be missed while it's up). */
    reset() { down.clear(); },
    /** true only on the frame it was pressed. */
    tap(c) { return pressed.has(c); },
    mouse() { return { x: mx, y: my, down: mdown }; },
    endFrame() { pressed.clear(); }
  };
})();
