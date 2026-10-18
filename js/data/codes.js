/* ============ codes.js — códigos canjeables (Ajustes > Código) ============
 * Cada código se guarda como huella SHA-256, no en texto, así que no se puede
 * leer aquí. Para añadir uno nuevo, desde la carpeta del proyecto:
 *
 *     node tools/make_code.js MICODIGO t1=5 t10=1 coins=200 until=2026-12-31
 *
 * y pega la línea que imprime dentro de la lista de abajo.
 *   t1     tickets normales        coins  monedas
 *   t10    tickets ×10             until  (opcional) último día para canjearlo, AAAA-MM-DD
 * Cada cuenta puede canjear cada código UNA vez. No distingue mayúsculas ni guiones.
 */
G.CODES = [
  // CHINESEPARLIAMENT  ->  433 tickets normales (los amarillos)
  { h: '6b96515e2b085a96c6f147e0bc6993c056cd2e30443e5de7aaef476399136b24', t1: 433 },
  // Demo-mode code (multi-use, never spent): turns the gacha's dummy pulls on/off on this device.
  { h: '0f08f16718b5fd451156c1deb691ea1a88a38ecc2926ab0e9fb3f2a178ae8d93', demo: true },
  // Temporary gift code (name not written here): 100 normal tickets + 25,000 coins, redeemable until 2026-10-25
  { h: '839c2e06d04853964c96cf0dab830a57634ff0d9df33b4ce3f4191881d21172e', t1: 100, coins: 25000, until: '2026-10-25' },
];
