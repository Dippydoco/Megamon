/* ============ fontweight.js — regular weight for small text ============
 * The Pixelify typeface in bold almost closes the mouth of the "C" and, at
 * small sizes, it gets confused with an "O". On the canvas (HUD, arrows, notices...)
 * any text of 17 px or less that asks for bold (600+) is drawn with the regular weight
 * (400). HTML text does it with the rules at the end of css/style.css.
 * Titles and big notices stay bold.
 */
(() => {
  const MAX_PX = 17;
  const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font');
  if (!d || !d.set) return;
  const RE = /^\s*(?:(bold|[6-9]00)\s+)(\d+(?:\.\d+)?)px/i;
  Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', {
    configurable: true, enumerable: d.enumerable,
    get: d.get,
    set(v) {
      if (typeof v === 'string') v = v.replace(RE, (m, w, s) => (+s <= MAX_PX ? '400 ' + s + 'px' : m));
      d.set.call(this, v);
    }
  });
})();
