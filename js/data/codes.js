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
];
