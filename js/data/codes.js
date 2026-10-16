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
  // MEGAMON  ->  10 tickets + 1 ticket ×10
  { h: 'e0ccafa9ca3fc4e7a728e70ddf91703e77fa69e99136db02e2ba4b8b67ca1af5', t1: 10, t10: 1 },
];
