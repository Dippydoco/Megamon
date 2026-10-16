/* Crea la línea de un código canjeable para js/data/codes.js
 *
 *   node tools/make_code.js MICODIGO t1=5 t10=1 coins=200 until=2026-12-31
 *
 * (t1, t10, coins y until son opcionales.) Usa la misma huella que
 * js/systems/redeem.js: SHA-256 de "megamon-codes:" + el código normalizado.
 */
const crypto = require('crypto');
const [code, ...opts] = process.argv.slice(2);
if (!code) { console.error('Uso: node tools/make_code.js CODIGO [t1=N] [t10=N] [coins=N] [until=AAAA-MM-DD]'); process.exit(1); }
const norm = code.toUpperCase().replace(/[\s\-_]/g, '');
const h = crypto.createHash('sha256').update('megamon-codes:' + norm).digest('hex');
const parts = [`h: '${h}'`];
for (const o of opts) {
  const [k, v] = o.split('=');
  if (['t1', 't10', 'coins'].includes(k) && /^\d+$/.test(v)) parts.push(`${k}: ${v}`);
  else if (k === 'until' && /^\d{4}-\d{2}-\d{2}$/.test(v)) parts.push(`until: '${v}'`);
  else { console.error('Opción no válida: ' + o); process.exit(1); }
}
console.log(`  // ${norm}\n  { ${parts.join(', ')} },`);
