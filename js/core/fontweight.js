/* ============ fontweight.js — letra normal en los textos pequeños ============
 * La tipografía Pixelify en negrita cierra casi del todo la boca de la "C" y, en
 * tamaños pequeños, se confunde con una "O". En el canvas (HUD, flechas, avisos...)
 * todo texto de 17 px o menos que pida negrita (600+) se dibuja con el peso normal
 * (400). Los textos de HTML lo hacen con las reglas del final de css/style.css.
 * Los títulos y avisos grandes siguen en negrita.
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
