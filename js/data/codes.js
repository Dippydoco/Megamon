/* ============ codes.js — redeemable codes (Settings > Code) ============
 * Each code is stored as a SHA-256 fingerprint, not as text, so it can't be
 * read here. To add a new one, from the project folder:
 *
 *     node tools/make_code.js MYCODE t1=5 t10=1 coins=200 until=2026-12-31
 *
 * and paste the line it prints into the list below.
 *   t1     normal tickets          coins  coins
 *   t10    ×10 tickets             until  (optional) last day to redeem it, YYYY-MM-DD
 * Each account can redeem each code ONCE. Case and hyphens don't matter.
 */
G.CODES = [
  // CHINESEPARLIAMENT  ->  433 normal tickets (the yellow ones)
  { h: '6b96515e2b085a96c6f147e0bc6993c056cd2e30443e5de7aaef476399136b24', t1: 433 },
  // Demo-mode code (multi-use, never spent): turns the gacha's dummy pulls on/off on this device.
  { h: '0f08f16718b5fd451156c1deb691ea1a88a38ecc2926ab0e9fb3f2a178ae8d93', demo: true },
  // Temporary gift code (name not written here): 100 normal tickets + 25,000 coins, redeemable until 2026-10-25
  { h: '839c2e06d04853964c96cf0dab830a57634ff0d9df33b4ce3f4191881d21172e', t1: 100, coins: 25000, until: '2026-10-25' },
];
