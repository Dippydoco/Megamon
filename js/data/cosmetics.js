/* ============ cosmetics.js — profile and chat decorations ============
 * Profile banner and border (shown on your public profile) and the colour of your name in chat.
 * Only the id is stored (profile.banner / profile.frame / profile.chatColor / profile.pbg / profile.wall); the
 * look is here and in css/style.css ([data-banner] / [data-frame] / [data-wall]). A few are unlocked by playing.
 * (19-10-2026) The profile's background colour and wallpaper travel inside the published `banner` field
 * ("bannerId~colour~wallpaper", see pack()), so the profile document and its server rules don't change.
 * Animated banners (`anim`) get their motion from the CSS.
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
    { id: 'arceus', name: 'Arceus', bg: 'radial-gradient(circle at 50% 120%, #fff6c8, transparent 70%), linear-gradient(135deg, #4a3a0c, #b8932e 55%, #e8cf70)', lock: 'arceus' },
    // ---- 19-10-2026 ----
    { id: 'starfall', name: 'Starfall', anim: true,
      bg: 'radial-gradient(ellipse at 85% 20%, rgba(255,246,200,.35), transparent 30%), linear-gradient(160deg, #04061a, #101848 55%, #2a1e5c)' },
    { id: 'aurora', name: 'Aurora', anim: true,
      bg: 'linear-gradient(115deg, transparent 20%, rgba(80,255,180,.45) 35%, transparent 50%, rgba(120,140,255,.4) 65%, transparent 80%), linear-gradient(180deg, #03101c, #0b2a3a 70%, #123c3a)' },
    { id: 'storm', name: 'Thunderstorm', anim: true,
      bg: 'linear-gradient(170deg, #1a1f2e, #2f3850 50%, #4a5470)' },
    { id: 'sakura', name: 'Sakura', bg: 'radial-gradient(circle at 15% 40%, #ffd1e3 0 3px, transparent 4px), radial-gradient(circle at 60% 25%, #ffe3ef 0 2px, transparent 3px), radial-gradient(circle at 82% 70%, #ffc1d8 0 3px, transparent 4px), radial-gradient(circle at 38% 78%, #fff 0 2px, transparent 3px), linear-gradient(135deg, #7a2c4f, #d46a92 55%, #f6b7cf)' },
    { id: 'dunes', name: 'Dunes', bg: 'radial-gradient(ellipse at 30% 140%, #c98a3c 0 45%, transparent 46%), radial-gradient(ellipse at 80% 150%, #b5742b 0 50%, transparent 51%), linear-gradient(180deg, #ffcf7a, #f2a14a 60%, #d9822f)' },
    { id: 'deepsea', name: 'Deep sea', anim: true,
      bg: 'radial-gradient(circle at 20% 70%, rgba(150,220,255,.5) 0 2px, transparent 3px), radial-gradient(circle at 70% 40%, rgba(150,220,255,.4) 0 3px, transparent 4px), linear-gradient(180deg, #0a3d6b, #052245 60%, #020c1f)' },
    { id: 'meadow', name: 'Meadow', bg: 'radial-gradient(circle at 20% 75%, #ffe14d 0 2px, transparent 3px), radial-gradient(circle at 55% 85%, #fff 0 2px, transparent 3px), radial-gradient(circle at 80% 72%, #ff9ed8 0 2px, transparent 3px), linear-gradient(180deg, #8fd3ff 0 45%, #5fbf5a 46%, #3f8f3a)' },
    { id: 'ghostly', name: 'Haunted', anim: true, lock: 'legend',
      bg: 'radial-gradient(ellipse at 50% 120%, rgba(160,90,255,.55), transparent 60%), linear-gradient(135deg, #0d0618, #2a1240 55%, #3e1d5c)' }
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
    { id: 'arceus', name: 'Arceus', color: '#fff4b8', lock: 'arceus' },
    // ---- 19-10-2026 (the animated ones are in the CSS) ----
    { id: 'bronze', name: 'Bronze', color: '#c98a4b' },
    { id: 'obsidian', name: 'Obsidian', color: '#3a3550' },
    { id: 'frost', name: 'Frost', color: '#a8e6ff' },
    { id: 'leaf', name: 'Leaf', color: '#7ed957' },
    { id: 'flame', name: 'Flame', color: '#ff7a2e' },
    { id: 'neon', name: 'Neon', color: '#3df5ff' },
    { id: 'starlight', name: 'Starlight', color: '#e6e0ff', lock: 'shiny' }
  ];

  // Profile background colour (the box behind everything; '' = the game's usual blue).
  const BG_COLORS = [
    { id: '', name: 'Default', c: '' },
    { id: 'm', name: 'Midnight', c: '#0b0f24' },
    { id: 'p', name: 'Plum', c: '#2a1236' },
    { id: 'w', name: 'Wine', c: '#3a1220' },
    { id: 'r', name: 'Rust', c: '#3a1f0e' },
    { id: 'o', name: 'Olive', c: '#26300f' },
    { id: 'f', name: 'Forest', c: '#0e2e1c' },
    { id: 't', name: 'Teal', c: '#0b2e33' },
    { id: 'n', name: 'Navy', c: '#0d1f45' },
    { id: 's', name: 'Slate', c: '#252a36' },
    { id: 'c', name: 'Charcoal', c: '#141414' }
  ];

  // Wallpaper: a pattern over the profile's background (drawn in the CSS, [data-wall]).
  const WALLPAPERS = [
    { id: '', name: 'None' },
    { id: 'd', name: 'Dots' },
    { id: 'g', name: 'Grid' },
    { id: 'b', name: 'Poké Balls' },
    { id: 'v', name: 'Waves' },
    { id: 'z', name: 'Diamonds' },
    { id: 'x', name: 'Stars' },
    { id: 'h', name: 'Scales' },
    { id: 'l', name: 'Stripes' }
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

  /** The published `banner` field: "id" or "id~colour~wallpaper" (fits the 16-character limit). */
  function pack(prof) {
    const bg = find(BG_COLORS, prof.pbg).id, wall = find(WALLPAPERS, prof.wall).id;
    return (prof.banner || '') + (bg || wall ? '~' + bg + '~' + wall : '');
  }
  function unpack(v) {
    const [banner, bg, wall] = String(v || '').split('~');
    return { banner: banner || '', pbg: bg || '', wall: wall || '' };
  }

  /**
   * Mastery 9 banners (28-10-2026, systems/mastery.js): 'm' + dex, a gradient in the Pokémon's type colours with its
   * sprite on the right. Fits the 16-character `banner` field like the others.
   */
  function monBanner(dex) {
    const p = G.DEX_BY[dex];
    if (!p) return null;
    const c1 = G.U.TYPE_COLOR[p.types[0]], c2 = G.U.TYPE_COLOR[p.types[1] || p.types[0]];
    return { id: 'm' + p.dex, name: p.name, dex: p.dex, bg: `linear-gradient(120deg, #0b1020 0%, ${c1} 55%, ${c2} 100%)` };
  }
  const bannerOf = id => (/^m\d+$/.test(id || '') && monBanner(+id.slice(1))) || find(BANNERS, id);

  /** Dresses the public profile window: banner on the head, border, background colour and wallpaper on the box. */
  function apply(box, head, d) {
    const u = unpack(d.banner);
    const fr = find(FRAMES, d.frame), bn = bannerOf(u.banner);
    const bg = find(BG_COLORS, u.pbg), wall = find(WALLPAPERS, u.wall);
    if (bg.c) box.style.setProperty('--pbg', bg.c); else box.style.removeProperty('--pbg');
    if (bg.c) box.dataset.pbg = bg.id; else delete box.dataset.pbg;
    if (wall.id) box.dataset.wall = wall.id; else delete box.dataset.wall;
    if (fr.id) box.dataset.frame = fr.id; else delete box.dataset.frame;
    if (fr.color) box.style.setProperty('--fc', fr.color); else box.style.removeProperty('--fc');
    if (head) {
      head.dataset.banner = bn.id;
      head.style.background = bn.id ? bn.bg : '';
      const old = head.querySelector('.bn-mon');
      if (old) old.remove();
      if (bn.dex && G.UI) {
        const cv = G.UI.spriteCanvas(bn.dex, 72, 60, { scale: 2, lively: true, shadow: false });
        cv.className = 'bn-mon';
        head.appendChild(cv);
      }
    }
  }

  return { BANNERS, FRAMES, NAME_COLORS, BG_COLORS, WALLPAPERS, pack, unpack, find, unlocked, hint, chatColor, validColor, apply, monBanner };
})();
