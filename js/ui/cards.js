/* ============ cards.js — playing cards for the card mini-games (08-11-2026) ============
 * Shared by Blackjack (ui/blackjack.js) and Poker (ui/poker.js).
 * A card is a 2-letter string: rank (2-9, T, J, Q, K, A) + suit (s ♠, h ♥, d ♦, c ♣), e.g. 'As', 'Td', '9h'.
 */
G.Cards = (() => {
  const RANKS = '23456789TJQKA', SUITS = 'shdc';
  const SUIT_CH = { s: '♠', h: '♥', d: '♦', c: '♣' };

  /** A fair random integer in [0, n) (crypto when the browser has it). */
  function rand(n) {
    if (window.crypto && crypto.getRandomValues) {
      const lim = Math.floor(4294967296 / n) * n, a = new Uint32Array(1);
      do crypto.getRandomValues(a); while (a[0] >= lim);
      return a[0] % n;
    }
    return Math.floor(Math.random() * n);
  }
  /** `decks` shuffled 52-card decks in one shoe (Fisher-Yates). */
  function shoe(decks = 1) {
    const out = [];
    for (let d = 0; d < decks; d++) for (const s of SUITS) for (const r of RANKS) out.push(r + s);
    for (let i = out.length - 1; i > 0; i--) { const j = rand(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  }
  const rankOf = c => c[0];
  const suitOf = c => c[1];
  const label = r => (r === 'T' ? '10' : r);
  const isRed = c => c[1] === 'h' || c[1] === 'd';

  /** HTML for a card (face up), or its back when `c` is falsy or '??'. opts.cls: extra classes. */
  function html(c, opts = {}) {
    const cls = opts.cls ? ' ' + opts.cls : '';
    if (!c || c === '??') return `<div class="pc back${cls}"></div>`;
    return `<div class="pc${isRed(c) ? ' red' : ''}${cls}" title="${label(c[0])}${SUIT_CH[c[1]]}"><b>${label(c[0])}</b><i>${SUIT_CH[c[1]]}</i><u>${SUIT_CH[c[1]]}</u></div>`;
  }
  const row = (cards, opts) => (cards || []).map(c => html(c, opts)).join('');

  return { RANKS, SUITS, SUIT_CH, rand, shoe, rankOf, suitOf, label, isRed, html, row };
})();
