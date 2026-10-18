/* ============ support-ui.js — "Support the project" ============
 * A button with a heart in the menu bar (only if there's a Ko-fi account in
 * js/data/funding.js) and a window that explains, with numbers, where the
 * money goes. Nothing is charged inside the game: payment is on Ko-fi.
 */
G.SupportUI = (() => {
  const $ = G.UI.$;
  const F = G.Funding;
  const val = v => typeof v === 'number'
    ? (Math.round(v * 100) / 100).toLocaleString('en', { style: 'currency', currency: 'EUR' }) + ' / month'
    : v;

  function init() {
    const b = $('btn-support');
    b.classList.remove('hidden');
    b.innerHTML = G.Icons.html('heart', 18) + ' <span>Support</span>';
    b.onclick = open;
    $('sup-close').onclick = close;
  }

  // No links or donations: the button is a joke.
  function open() {
    $('sup-body').innerHTML = `
      <p style="text-align:center;font-size:22px;margin:18px 0 8px">Buy Ryan a Taco Bell</p>
      <p class="sub" style="text-align:center;margin-bottom:6px">(this is a joke, the game is free and always will be)</p>`;
    $('scr-support').classList.remove('hidden');
  }
  function close() { $('scr-support').classList.add('hidden'); }

  return { init, open, close };
})();
