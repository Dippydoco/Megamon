/* ============ cosmetics.js — profile and chat decorations ============
 * Profile banner and border (shown on your public profile) and the colour of your name in chat.
 * Only the id is stored (profile.banner / profile.frame / profile.chatColor); the look is here and in
 * css/style.css ([data-banner] / [data-frame]). A few are unlocked by playing.
 * Unlocks are checked on this device only (it is just decoration).
 */
G.Cosmetics = (() => {
  const s = () => G.DB.save || {};
  const count = o => Object.keys(o || {}).length;
  const has = {
    arceus: () => count(s().arceus) > 0,
    shiny: () => !!(s().ach && s().ach.shiny1),
    legend: () => count(s().legends) > 0
  };
  const HINT = {
    arceus: 'Reach Arceus with any Pokémon (gold star).',
    shiny: 'Catch your first shiny.',
    legend: 'Defeat a legendary in a rift.'
  };

  // `bg` is the banner's CSS background; `lock` names a requirement in `has`.
  const BANNERS = [
    { id: '', name: 'Plain', bg: 'linear-gradient(135deg, rgba(255,255,255,.07), rgba(255,255,255,.02))' },
    { id: 'forest', name: 'Forest', bg: 'linear-gradient(135deg, #1f5a2e, #3f8f4a 55%, #a6d96a)' },
    { id: 'ocean', name: 'Ocean', bg: 'linear-gradient(135deg, #0b2f66, #1d6fb8 55%, #73d0ff)' },
    { id: 'volcano', name: 'Volcano', bg: 'linear-gradient(135deg, #2a0d0d, #b3321c 55%, #ffb12e)' },
    { id: 'sunset', name: 'Sunset', bg: 'linear-gradient(135deg, #3a1c71, #d76d77 55%, #ffaf7b)' },
    { id: 'night', name: 'Night sky', bg: 'radial-gradient(circle at 20% 30%, #fff 0 1px, transparent 2px), radial-gradient(circle at 70% 60%, #fff 0 1px, transparent 2px), radial-gradient(circle at 45% 80%, #cfe0ff 0 1px, transparent 2px), linear-gradient(135deg, #070b1f, #1a2250)' },
    { id: 'snow', name: 'Snowfield', bg: 'linear-gradient(135deg, #5b7ea8, #cfe3f5 60%, #ffffff)' },
    { id: 'rift', name: 'Rift', bg: 'linear-gradient(135deg, #10061f, #4a1c8c 55%, #b36bff)' },
    { id: 'candy', name: 'Candy', bg: 'linear-gradient(135deg, #ff7eb3, #ffb6e1 55%, #fff0a8)' },
    { id: 'legend', name: 'Legendary', bg: 'linear-gradient(135deg, #1b1033, #5a2fa8 40%, #ffd23f)', lock: 'legend' },
    { id: 'shiny', name: 'Shiny shimmer', bg: 'linear-gradient(120deg, #2b7a78, #6fe8d8 30%, #ffd6f0 55%, #6fe8d8 80%, #2b7a78)', lock: 'shiny' },
    { id: 'arceus', name: 'Arceus', bg: 'radial-gradient(circle at 50% 120%, #fff6c8, transparent 70%), linear-gradient(135deg, #4a3a0c, #b8932e 55%, #e8cf70)', lock: 'arceus' }
  ];

  // Border colours (the glow and the animated one are in the CSS).
  const FRAMES = [
    { id: '', name: 'Default', color: '' },
    { id: 'gold', name: 'Gold', color: '#ffd23f' },
    { id: 'silver', name: 'Silver', color: '#d5deea' },
    { id: 'emerald', name: 'Emerald', color: '#3fd17a' },
    { id: 'ruby', name: 'Ruby', color: '#ff4d63' },
    { id: 'sapphire', name: 'Sapphire', color: '#4d9bff' },
    { id: 'violet', name: 'Violet', color: '#b07bff' },
    { id: 'rainbow', name: 'Rainbow', color: '#ff9ed8', lock: 'shiny' },
    { id: 'legend', name: 'Legendary', color: '#ffd23f', lock: 'legend' },
    { id: 'arceus', name: 'Arceus', color: '#fff4b8', lock: 'arceus' }
  ];

  // Chat name colours ('' = the default colours).
  const NAME_COLORS = ['', '#ff6b7a', '#ff9a3c', '#ffe14d', '#5fe08a', '#4fd6c9', '#6cb8ff', '#b08bff', '#ff8ad8', '#f4f8ff'];

  const find = (list, id) => list.find(x => x.id === (id || '')) || list[0];
  const unlocked = item => !item.lock || has[item.lock]();
  const hint = item => item.lock ? HINT[item.lock] : '';

  /** Colour of your name in chat, or '' (default). Only values from the palette count. */
  function chatColor() { const c = (s().profile || {}).chatColor; return NAME_COLORS.includes(c) ? c : ''; }
  /** Same check for a colour that came in over the network. */
  const validColor = c => (typeof c === 'string' && NAME_COLORS.includes(c) && c) || '';

  /** Dresses the public profile window: banner on the head, border on the box. */
  function apply(box, head, d) {
    const fr = find(FRAMES, d.frame), bn = find(BANNERS, d.banner);
    if (fr.id) box.dataset.frame = fr.id; else delete box.dataset.frame;
    if (fr.color) box.style.setProperty('--fc', fr.color); else box.style.removeProperty('--fc');
    if (head) {
      head.dataset.banner = bn.id;
      head.style.background = bn.id ? bn.bg : '';
    }
  }

  return { BANNERS, FRAMES, NAME_COLORS, find, unlocked, hint, chatColor, validColor, apply };
})();
