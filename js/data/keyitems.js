/* ============ keyitems.js — Key Items and Arceus Shop themes ============
 *
 * KEY ITEMS (24-10-2026). Bought once with PokéCoins in Klefki's stall (ui/shop-ui.js) and owned for good
 * (save.keyItems = { id: date }). You take ONE into a run, chosen under your partner on the main menu
 * (save.keyItem). A key item is not a held item: it has its own slot, is always passive, and lasts the whole run.
 *
 *   herb    Revival Herb   you revive downed teammates twice as fast, and they get up with +25% HP
 *   black   Black Flute    +35% enemy spawns (and a fuller field), +25% XP
 *   white   White Flute    -30% enemy spawns (and a smaller field), -10% XP
 *   pouch   Lucky Pouch    each level-up: 20% you pick two cards, 10% the pouch is empty (no card)
 *   iron    Iron Ball      -15% speed, -20% damage taken
 *   glass   Glass Charm    +25% damage, -25% max HP
 *   tail    Lagging Tail   every enemy is 10% slower, and so are you
 *   ring    Ring Target    enemies go for you first (group runs), -15% damage taken, -10% damage dealt
 *   star    Wishing Star   bosses have +25% HP, and each one has a 50% chance to drop 2 gacha tickets
 *
 * Team effects (spawns, enemy speed, boss HP) are worked out by the host from everyone's key item: it travels in
 * each player's shared state (net/coop.js, `ki`). Averages for the flutes, "anyone" for the rest.
 *
 * ARCEUS SHOP THEMES. Bought with Arceus Stars in Sableye's stall (G.DB.spendStars), owned for good
 * (save.themes = { id: date }), one of each kind worn at a time (save.menuTheme, save.cardTheme).
 *   Menu themes recolour the menu boxes and top bar (css: html[data-mtheme]).
 *   Card themes restyle your player card in runs (ui/hud.js drawCard); teammates see yours (`ct` in coop.js).
 */
G.KeyItems = (() => {
  const LIST = [
    { id: 'herb', name: 'Revival Herb', icon: 'ki-herb', price: 900, tag: 'Team',
      desc: 'Revive downed teammates twice as fast, and they get back up with 25% more HP.',
      lines: ['Revive teammates ×2 faster', 'Revived teammates +25% HP'], note: 'Only does something in group runs.' },
    { id: 'black', name: 'Black Flute', icon: 'ki-black', price: 1200, tag: 'Trade-off',
      desc: 'Calls in more wild Pokémon: +35% spawns and a fuller field, and +25% experience.',
      lines: ['+35% enemy spawns', '+25% experience'], note: 'In a group, the flutes of the whole team are averaged.' },
    { id: 'white', name: 'White Flute', icon: 'ki-white', price: 800, tag: 'Trade-off',
      desc: 'Keeps wild Pokémon away: -30% spawns and a smaller field, but -10% experience.',
      lines: ['-30% enemy spawns', '-10% experience'], note: 'In a group, the flutes of the whole team are averaged.' },
    { id: 'pouch', name: 'Lucky Pouch', icon: 'ki-pouch', price: 1800, tag: 'Gamble',
      desc: 'Every level-up is a gamble: 20% chance you pick two cards, 10% chance the pouch is empty.',
      lines: ['20%: pick 2 cards', '10%: no card'] },
    { id: 'iron', name: 'Iron Ball', icon: 'ki-iron', price: 1000, tag: 'Trade-off',
      desc: 'Heavy and safe: you move 15% slower but take 20% less damage.',
      lines: ['-15% speed', '-20% damage taken'] },
    { id: 'glass', name: 'Glass Charm', icon: 'ki-glass', price: 1400, tag: 'Trade-off',
      desc: 'Hit hard, break easily: +25% damage, -25% max HP.',
      lines: ['+25% damage', '-25% max HP'] },
    { id: 'tail', name: 'Lagging Tail', icon: 'ki-tail', price: 1000, tag: 'Trade-off',
      desc: 'Everything slows down: every enemy is 10% slower, and so are you.',
      lines: ['Enemies -10% speed', 'You -10% speed'], note: 'In a group, it slows the enemies for everyone.' },
    { id: 'ring', name: 'Ring Target', icon: 'ki-ring', price: 1200, tag: 'Team',
      desc: 'Enemies go for you first. You take 15% less damage but deal 10% less.',
      lines: ['Enemies target you first', '-15% damage taken', '-10% damage dealt'], note: 'Drawing enemies matters most in group runs.' },
    { id: 'star', name: 'Wishing Star', icon: 'ki-star', price: 2400, tag: 'Gamble',
      desc: 'Bosses have 25% more HP, but each one has a 50% chance to drop 2 gacha tickets.',
      lines: ['Bosses +25% HP', '50%: 2 tickets per boss'], note: 'In a group, one holder is enough.' }
  ];
  const BY = {};
  for (const k of LIST) BY[k.id] = k;

  const save = () => G.DB.save || {};
  const owns = id => !!(BY[id] && save().keyItems && save().keyItems[id]);
  /** The key item you'll take into your next run ('' = none). */
  const equipped = () => { const id = save().keyItem; return owns(id) ? id : ''; };

  /** A player's key item: yours from the run, a teammate's from their shared state. */
  function of(p) {
    if (!p) return '';
    const id = p.keyItem != null ? p.keyItem : (p.net && p.net.ki) || '';
    return BY[id] ? id : '';
  }
  /** Everyone in the run (living or not). */
  function team() { return G.Game && G.Game.everyone ? G.Game.everyone().filter(Boolean) : []; }
  const anyone = id => team().some(p => of(p) === id);

  // Team effects are read every frame by many enemies: cached for a short while.
  let cacheT = -1, cache = null;
  function teamFx() {
    const now = performance.now();
    if (cache && now - cacheT < 400) return cache;
    cacheT = now;
    const ps = team(), n = Math.max(1, ps.length);
    let rate = 0, cap = 0;
    for (const p of ps) {
      const id = of(p);
      rate += id === 'black' ? 1.35 : id === 'white' ? 0.7 : 1;
      cap += id === 'black' ? 1.25 : id === 'white' ? 0.8 : 1;
    }
    cache = {
      rate: ps.length ? rate / n : 1,
      cap: ps.length ? cap / n : 1,
      enemySpd: ps.some(p => of(p) === 'tail') ? 0.9 : 1,
      bossHp: ps.some(p => of(p) === 'star') ? 1.25 : 1,
      star: ps.some(p => of(p) === 'star')
    };
    return cache;
  }

  /** At the start of a run (game.js startRun): your key item and its stat changes. */
  function apply(pl) {
    const id = equipped();
    pl.keyItem = id;
    cache = null;
    if (id === 'black') pl.xpMul *= 1.25;
    else if (id === 'white') pl.xpMul *= 0.9;
    else if (id === 'iron') { pl.spdMul *= 0.85; pl.dmgReduce += 0.2; }
    else if (id === 'glass') { pl.atkMul *= 1.25; pl.maxHp = Math.max(1, Math.round(pl.maxHp * 0.75)); pl.hp = pl.maxHp; }
    else if (id === 'tail') pl.spdMul *= 0.9;
    else if (id === 'ring') { pl.dmgReduce += 0.15; pl.atkMul *= 0.9; }
    return id;
  }

  // ---- hooks used around the game ----
  /** Enemies per second and the field cap (spawner.js). */
  const spawnRate = () => teamFx().rate;
  const capMul = () => teamFx().cap;
  /** Every enemy's speed (enemy.js). */
  const enemySpd = () => teamFx().enemySpd;
  /** Boss health (spawner.js spawnBoss). */
  const bossHp = () => teamFx().bossHp;
  /** Revival Herb: how fast `helper` revives you, and the extra HP you get up with (game.js reviveTick). */
  const reviveK = helper => (of(helper) === 'herb' ? 2 : 1);
  const reviveHeal = helper => (of(helper) === 'herb' ? 0.25 : 0);
  /** Ring Target: enemies pick the "nearest" player with its distance shrunk (enemy.js nearestPlayer). */
  const targetK = p => (of(p) === 'ring' ? 0.36 : 1);      // on squared distances: 0.6× the distance
  /** Lucky Pouch: what this level-up does: 'double' | 'empty' | ''. */
  function pouchRoll(pl) {
    if (of(pl) !== 'pouch') return '';
    const r = Math.random();
    return r < 0.2 ? 'double' : r < 0.3 ? 'empty' : '';
  }
  /** Wishing Star: a normal boss went down (enemy.js, host only). */
  function bossDown(e) {
    if (e.legend || (G.Coop.active && !G.Coop.isHost)) return;      // normal bosses only; the host drops the loot
    if (!teamFx().star || Math.random() >= 0.5) return;
    for (let i = 0; i < 2; i++) G.Pickups.drop('ticket', e.x + (i ? 18 : -18), e.y - 16, 1);
    G.FX.ring(e.x, e.y, 6, 60, '#ffe27a', 0.6, 4);
    G.Spawner.say('Wishing Star! 2 tickets', 2.4);
  }

  /** Buy one in the shop. Returns '' if it worked, or why not. */
  function buy(id) {
    const s = G.DB.save, k = BY[id];
    if (!s || !k) return 'Unknown item';
    s.keyItems = s.keyItems || {};
    if (s.keyItems[id]) return 'You already have it';
    if (s.coins < k.price) return 'Not enough PokéCoins';
    s.coins -= k.price;
    s.keyItems[id] = Date.now();
    if (!equipped()) s.keyItem = id;          // your first key item goes straight into the slot
    G.DB.commit(true);
    return '';
  }

  function equip(id) {
    const s = G.DB.save;
    if (!s || (id && !owns(id))) return false;
    s.keyItem = id || '';
    G.DB.commit();
    return true;
  }

  return { LIST, BY, owns, equipped, of, apply, buy, equip, spawnRate, capMul, enemySpd, bossHp, reviveK, reviveHeal,
           targetK, pouchRoll, bossDown, anyone, get count() { return LIST.filter(k => owns(k.id)).length; } };
})();

G.Themes = (() => {
  // Menu themes: the PMD boxes' two blues and inner edge, the top bar pills and the menu tiles.
  // vars: box1 / box2 (box gradient), edgeIn (inner border), pill (top bar), tile (tile tint), accent (tile hover border).
  const MENU = [
    { id: '', name: 'Classic Blue', price: 0, vars: { box1: '#2c519f', box2: '#1a3170', edgeIn: '#5b83d6', pill: 'rgba(10,20,50,.85)', tile: 'rgba(255,255,255,.04)', accent: '#ffd23f' } },
    { id: 'ember', name: 'Ember', price: 1, vars: { box1: '#a33a2c', box2: '#5c1712', edgeIn: '#e0735a', pill: 'rgba(60,14,10,.88)', tile: 'rgba(255,170,120,.06)', accent: '#ffb35c' } },
    { id: 'verdant', name: 'Verdant', price: 1, vars: { box1: '#2f7d47', box2: '#153f24', edgeIn: '#62c47f', pill: 'rgba(10,40,20,.88)', tile: 'rgba(160,255,180,.05)', accent: '#b6f27a' } },
    { id: 'lagoon', name: 'Lagoon', price: 1, vars: { box1: '#1d7f8c', box2: '#0c3f4a', edgeIn: '#55c8d4', pill: 'rgba(6,36,44,.88)', tile: 'rgba(140,240,255,.05)', accent: '#7ff0ff' } },
    { id: 'phantom', name: 'Phantom', price: 1, vars: { box1: '#5a3596', box2: '#2a1552', edgeIn: '#9b74e0', pill: 'rgba(30,12,56,.88)', tile: 'rgba(200,160,255,.06)', accent: '#d7a6ff' } },
    { id: 'sakura', name: 'Sakura', price: 1, vars: { box1: '#a8467a', box2: '#5a1c40', edgeIn: '#e88ab8', pill: 'rgba(56,14,36,.88)', tile: 'rgba(255,180,220,.06)', accent: '#ffc2e2' } },
    { id: 'obsidian', name: 'Obsidian', price: 2, vars: { box1: '#33363f', box2: '#121318', edgeIn: '#6a6f7e', pill: 'rgba(12,12,16,.9)', tile: 'rgba(255,255,255,.035)', accent: '#e6e9f2' } },
    { id: 'arceus', name: 'Arceus Gold', price: 3, vars: { box1: '#7a5c16', box2: '#3a2a06', edgeIn: '#e8c45a', pill: 'rgba(40,28,4,.9)', tile: 'rgba(255,220,120,.07)', accent: '#ffe27a' }, premium: true }
  ];
  // Card themes for your player card in runs. bg: two gradient colours, border, ring (portrait frame),
  // name and bar colours. fx: 'shine' (a light sweep), 'stars' (twinkles), 'rainbow' (cycling border).
  const CARD = [
    { id: '', name: 'Classic', price: 0, bg: ['rgba(0,0,0,.42)', 'rgba(0,0,0,.42)'], border: null, ring: '#ffcb3d', name_: '#eaf2ff', bar: '#ff5f6d' },
    { id: 'ember', name: 'Ember', price: 2, bg: ['rgba(120,30,14,.82)', 'rgba(40,8,4,.82)'], border: '#ff7b3d', ring: '#ffb35c', name_: '#ffe2c8', bar: '#ff8a3d' },
    { id: 'tide', name: 'Tide', price: 2, bg: ['rgba(14,70,130,.82)', 'rgba(4,22,52,.82)'], border: '#4fb4ff', ring: '#9fdcff', name_: '#dff2ff', bar: '#4fd1ff' },
    { id: 'verdant', name: 'Verdant', price: 2, bg: ['rgba(26,96,44,.82)', 'rgba(6,34,14,.82)'], border: '#5fe08a', ring: '#b6f27a', name_: '#e4ffe9', bar: '#5fe08a' },
    { id: 'phantom', name: 'Phantom', price: 2, bg: ['rgba(70,30,120,.82)', 'rgba(22,8,46,.82)'], border: '#b07bff', ring: '#d7a6ff', name_: '#f0e4ff', bar: '#c47bff' },
    { id: 'frost', name: 'Frost', price: 2, bg: ['rgba(150,200,230,.55)', 'rgba(30,60,90,.82)'], border: '#dff6ff', ring: '#ffffff', name_: '#ffffff', bar: '#9ae6ff' },
    { id: 'gilded', name: 'Gilded', price: 4, bg: ['rgba(110,80,14,.88)', 'rgba(40,26,2,.88)'], border: '#ffd23f', ring: '#ffe27a', name_: '#fff3c4', bar: '#ffd23f', fx: 'shine', premium: true },
    { id: 'cosmic', name: 'Cosmic', price: 5, bg: ['rgba(20,10,60,.9)', 'rgba(4,2,20,.9)'], border: '#ffffff', ring: '#ffffff', name_: '#ffffff', bar: '#a98bff', fx: 'rainbow', stars: true, premium: true }
  ];
  const MBY = {}, CBY = {};
  for (const t of MENU) MBY[t.id] = t;
  for (const t of CARD) CBY[t.id] = t;
  const key = (kind, id) => kind + ':' + id;

  const save = () => G.DB.save || {};
  function owns(kind, id) {
    if (!id) return true;                     // the classic look is free
    return !!(save().themes && save().themes[key(kind, id)]);
  }
  const menuId = () => { const id = save().menuTheme || ''; return MBY[id] && owns('m', id) ? id : ''; };
  const cardId = () => { const id = save().cardTheme || ''; return CBY[id] && owns('c', id) ? id : ''; };
  const card = id => CBY[id] || CBY[''];

  /** Puts the chosen menu theme on the page (CSS variables). */
  function applyMenu(id = menuId()) {
    const t = MBY[id] || MBY[''], r = document.documentElement.style, v = t.vars;
    r.setProperty('--box1', v.box1); r.setProperty('--box2', v.box2); r.setProperty('--edge-in', v.edgeIn);
    r.setProperty('--pill-bg', v.pill); r.setProperty('--tile-bg', v.tile); r.setProperty('--tile-accent', v.accent);
    document.documentElement.dataset.mtheme = id || 'classic';
  }

  /** kind 'm' (menu) or 'c' (card). Returns '' if it worked, or why not. */
  function buy(kind, id) {
    const s = G.DB.save, t = (kind === 'm' ? MBY : CBY)[id];
    if (!s || !t || !id) return 'Unknown theme';
    s.themes = s.themes || {};
    if (s.themes[key(kind, id)]) return 'You already have it';
    if (G.DB.stars() < t.price) return 'Not enough Arceus Stars';
    if (!G.DB.spendStars(t.price)) return 'Not enough Arceus Stars';
    s.themes[key(kind, id)] = Date.now();
    wear(kind, id);
    G.DB.commit(true);
    return '';
  }

  function wear(kind, id) {
    const s = G.DB.save;
    if (!s || !owns(kind, id)) return false;
    if (kind === 'm') { s.menuTheme = id; applyMenu(id); } else s.cardTheme = id;
    G.DB.commit();
    return true;
  }

  return { MENU, CARD, MBY, CBY, owns, menuId, cardId, card, applyMenu, buy, wear };
})();
