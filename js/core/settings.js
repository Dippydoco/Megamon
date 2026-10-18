/* ============ settings.js — this device's settings ============
 * Stored in the browser (not in the account): each PC or phone has its
 * own. The volume is stored separately by audio.js.
 *
 *   quality     'auto' | 'high' | 'mid' | 'low'   effects and particles
 *   dmgNumbers  true/false                        damage numbers
 *   dmgSize     0.8 | 1 | 1.35                    size of the damage numbers
 *   dmgShow     'all' | 'big'                     every hit, or only the important ones (crits, super effective, bosses)
 *   dmgColor    'type' | 'white'                  coloured damage numbers (by effectiveness) or white
 *   shareAct    true/false                        let your friends see what you're doing (menu, gacha, run...)
 *   shareHist   true/false                        let others see your run history (copy in histories/{uid})
 *   moveTags    true/false                        attack type tag (Projectile, Beam...) on the cards
 *   calm        true/false                        less shake and flashing
 *   fps         true/false                        FPS counter
 *   stick       0.8 | 1 | 1.25                    size of the touch joystick
 *   stickMode   'float' | 'fixed'                 joystick where you put your finger, or always in its place
 *   mouseStick  true/false                        move with the mouse: left button and drag (floating joystick)
 *   mouseLock   true/false                        the mouse joystick doesn't follow the cursor: it stays where you clicked (default: yes)
 *   pad         { bar, pause, stick } | null      where the buttons go on mobile (centre, relative
 *                                                 to the screen); set by layout-ui.js
 *
 *   G.Settings.get('quality')  ·  G.Settings.set('fps', true)  ·  G.Settings.on(fn)
 *   G.Settings.fx   effective level 0 (low) .. 2 (high), with 'auto' already resolved
 */
G.Settings = (() => {
  const KEY = 'ps.settings';
  const DEF = { quality: 'auto', dmgNumbers: true, dmgSize: 1, dmgShow: 'all', dmgColor: 'type', shareAct: true, shareHist: true, moveTags: true, calm: false, fps: false, stick: 1, stickMode: 'float', mouseStick: true, mouseLock: true, pad: null };
  let s = Object.assign({}, DEF);
  try { Object.assign(s, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* nothing */ }
  // One-time: the fixed mouse joystick became the default for everyone (also those who had saved the old default).
  if (s.lockV !== 1) { s.mouseLock = true; s.lockV = 1; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* nothing */ } }
  const fns = new Set();

  // Automatic quality: starts high (medium on mobile) and drops if it stutters.
  const touchy = matchMedia('(pointer: coarse)').matches;
  let autoLevel = touchy ? 1 : 2;
  let acc = 0, frames = 0, slowT = 0, fastT = 0;

  function save() { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* nothing */ } }
  function get(k) { return s[k]; }
  function set(k, v) { s[k] = v; save(); fns.forEach(fn => { try { fn(k, v); } catch (e) { /* nothing */ } }); }

  /** Called by the game loop every frame (only during a run). */
  function sample(dt) {
    if (s.quality !== 'auto' || dt <= 0) return;
    acc += dt; frames++;
    if (acc < 1) return;
    const fps = frames / acc;
    acc = 0; frames = 0;
    // 3 s in a row below 45 FPS: drop a level; 8 s above 57: go up.
    if (fps < 45) { slowT++; fastT = 0; } else if (fps > 57) { fastT++; slowT = 0; } else { slowT = fastT = 0; }
    if (slowT >= 3 && autoLevel > 0) { autoLevel--; slowT = 0; }
    if (fastT >= 8 && autoLevel < (touchy ? 1 : 2)) { autoLevel++; fastT = 0; }
  }

  return {
    get, set, sample, DEF,
    on(fn) { fns.add(fn); },
    get all() { return Object.assign({}, s); },
    get fx() { return s.quality === 'auto' ? autoLevel : s.quality === 'high' ? 2 : s.quality === 'mid' ? 1 : 0; },
    get autoLevel() { return autoLevel; },
    get touch() { return touchy; }
  };
})();
