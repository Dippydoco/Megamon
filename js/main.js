/* ============ main.js — startup ============ */
(() => {
  // If a file fails to load (a mobile connection dropping), it's better
  // to warn than to start half-loaded.
  const NEED = ['U', 'Settings', 'DB', 'Audio', 'Input', 'Touch', 'Sprites', 'Camera', 'Moves', 'Enemies', 'Upgrades', 'Items',
                'World', 'FX', 'Projectiles', 'EnemyMgr', 'Pickups', 'Player', 'Combat', 'Spawner', 'LevelUp', 'Gacha',
                'Rift', 'Weather', 'Progress', 'Hazards', 'Social', 'Net', 'Coop', 'Ranking', 'Icons', 'UI', 'HUD',
                'MenuUI', 'RunUI', 'SettingsUI', 'Funding', 'SupportUI', 'Game', 'Flow', 'TowerData', 'Tower', 'TowerBosses', 'TowerHub', 'TowerFloors', 'TowerUI'];
  function broken() {
    // (In the published version G isn't on window: it's wrapped, see tools/build.js.)
    const miss = NEED.filter(k => typeof G !== 'object' || !G[k]);
    if (!miss.length) return false;
    const el = document.getElementById('boot');
    el.innerHTML = 'The game could not load completely (did the connection drop?).<br><button class="btn gold" style="margin-top:12px" onclick="location.reload()">Reload</button>';
    console.warn('[Startup] missing:', miss.join(', '));
    return true;
  }

  // Maintenance (moving to new servers): no getting in or signing
  // in, so nothing is written while accounts and saves are being copied.
  // To test locally: add ?dev to the address.
  const MAINTENANCE = false;
  function maintenance() {
    if (!MAINTENANCE || /[?&]dev\b/.test(location.search)) return false;
    const el = document.getElementById('boot');
    el.innerHTML = '<div class="boot-in"><h1>Megamon</h1>' +
      '<p><b>We are under maintenance.</b></p><p>We are moving the game to new servers so it can stay free for everyone. ' +
      'Your account, your save and your Pokémon are safe. Please come back in a few hours!</p>' +
      '<button class="btn gold" style="margin-top:12px" onclick="location.reload()">Try again</button></div>';
    return true;
  }

  function boot() {
    if (maintenance()) return;
    if (broken()) return;
    // Waits for the pixel font so the UI doesn't jump when it loads.
    const ready = document.fonts && document.fonts.load ? document.fonts.load('16px Pixelify') : Promise.resolve();
    ready.catch(() => {}).then(() => G.Flow.boot());
  }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot);
  else boot();

  // Installable as an app (PWA). Only over http(s): opened by double-click (file://) it isn't needed.
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('[PWA]', e.message)));
  }
})();
