/* ============ support-ui.js — "Apoyar el proyecto" ============
 * Botón con un corazón en la barra del menú (sólo si hay cuenta de Ko-fi en
 * js/data/funding.js) y una ventana que explica, con números, a qué va el
 * dinero. No se cobra nada dentro del juego: el pago es en Ko-fi.
 */
G.SupportUI = (() => {
  const $ = G.UI.$;
  const F = G.Funding;
  const val = v => typeof v === 'number'
    ? (Math.round(v * 100) / 100).toLocaleString(G.I18n.lang === 'en' ? 'en' : 'es', { style: 'currency', currency: 'EUR' }) + ' / mes'
    : v;

  function init() {
    const b = $('btn-support');
    b.classList.remove('hidden');
    b.innerHTML = G.Icons.html('heart', 18) + ' <span>Apoyar</span>';
    b.onclick = open;
    $('sup-close').onclick = close;
  }

  // Sin enlaces ni donaciones: el botón es una broma.
  function open() {
    $('sup-body').innerHTML = `
      <p style="text-align:center;font-size:22px;margin:18px 0 8px">Buy Ryan a Taco Bell</p>
      <p class="sub" style="text-align:center;margin-bottom:6px">(this is a joke, the game is free and always will be)</p>`;
    $('scr-support').classList.remove('hidden');
  }
  function close() { $('scr-support').classList.add('hidden'); }

  return { init, open, close };
})();
