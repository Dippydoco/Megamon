/* ============ featured.js — daily featured Pokémon ============
 * Every day (Europe/Madrid, like the leaderboard and missions) three Pokémon are featured:
 * one Common/Uncommon, one Rare and one Epic/Legendary-rarity (never a legendary Pokémon).
 * Everyone gets the same three: they're picked from the date alone.
 * A run with a featured Pokémon earns +50% PokéCoins at the end (game.js endRun).
 * Shown on the main menu (menu.js) and as a filter in the Pokémon tab.
 */
G.Featured = (() => {
  const BONUS = 1.5;
  const GROUPS = [[1, 2], [3], [4, 5]];

  function dayKey(date = new Date()) {
    const p = {};
    for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)) p[x.type] = x.value;
    return p.year + p.month + p.day;
  }
  // Small deterministic hash (the same on every device).
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  let cache = null;
  function today() {
    const k = dayKey();
    if (cache && cache.k === k) return cache.list;
    const list = GROUPS.map((rs, i) => {
      const pool = G.DEX.filter(p => rs.includes(p.rarity) && !p.leg && (!G.SPRITE_META || G.SPRITE_META[p.dex]));
      return pool.length ? pool[hash(k + ':' + i) % pool.length].dex : null;
    }).filter(Boolean);
    cache = { k, list };
    return list;
  }
  const is = dex => today().includes(+dex);

  return { today, is, BONUS };
})();
