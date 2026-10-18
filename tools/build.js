/* Packages the game for publishing: a single minified JS instead of ~60.
 *   node tools/build.js
 *
 * - dev.html is the "source" page: it loads each script separately (for
 *   comfortable programming and debugging). EDIT dev.html, not index.html.
 * - index.html is generated from dev.html, replacing the block of scripts
 *   with js/app.min.js (with the fingerprint in the URL so it isn't cached).
 * - node tools/build.js --no-seo   ->  without the SEO parts (canonical, social cards, structured data).
 * - node tools/build.js --force    ->  mandatory update: runs in progress are ended (and saved).
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const DEV = path.join(ROOT, 'dev.html'), OUT = path.join(ROOT, 'index.html');
const BEGIN = '<!-- scripts:begin -->', END = '<!-- scripts:end -->';

const dev = fs.readFileSync(DEV, 'utf8');
const i = dev.indexOf(BEGIN), j = dev.indexOf(END);
if (i < 0 || j < 0) throw new Error('dev.html is missing the markers ' + BEGIN + ' / ' + END);
const block = dev.slice(i, j + END.length);
const files = [...block.matchAll(/<script[^>]*src="(js\/[^"]+\.js)"/g)].map(m => m[1]);

// Joins the files in order; each separated by ';' in case one doesn't end in a semicolon.
let joined = files.map(f => `/* ${f} */\n` + fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n');
// Anti-cheat: in the published version the game is WRAPPED in a function:
// G no longer exists in the browser console (F12), and with it the shortcuts to
// become invincible, skip the clock, etc. (dev.html stays as it is, for programming).
//   --expose   no wrapping or obfuscation (for automated tests)
const EXPOSE = process.argv.includes('--expose');
if (!EXPOSE) {
  const WIN_G = 'window.G = window.G || {};';
  if (!joined.includes(WIN_G)) throw new Error('util.js no longer creates G as expected: check build.js');
  joined = '(() => {\n' + joined.replace(WIN_G, 'var G = {};') + '\n})();\n';
}
const tmp = path.join(ROOT, 'tools', 'cache', 'app.js');
fs.mkdirSync(path.dirname(tmp), { recursive: true });
fs.writeFileSync(tmp, joined);
const outJs = path.join(ROOT, 'js', 'app.min.js');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const shell = process.platform === 'win32';
execFileSync(npx, ['--yes', 'terser@5', tmp, '--compress', 'passes=1', '--mangle', '--comments', 'false', '--ecma', '2020', '-o', outJs],
  { stdio: 'inherit', shell });
// And obfuscated: the code becomes unreadable and breaks if it is reformatted to
// tamper with it. Strings go in an encoded table (only some of them, so the game
// isn't slowed down). Fixed seed: the same code always gives the same file.
if (!EXPOSE) {
  execFileSync(npx, ['--yes', 'javascript-obfuscator@4.1.1', outJs, '--output', outJs,
    '--compact', 'true', '--self-defending', 'true', '--seed', '7',
    '--string-array', 'true', '--string-array-encoding', 'base64', '--string-array-threshold', '0.1',
    '--identifier-names-generator', 'hexadecimal', '--rename-globals', 'false', '--transform-object-keys', 'false',
    '--split-strings', 'false', '--control-flow-flattening', 'false', '--dead-code-injection', 'false',
    '--unicode-escape-sequence', 'false', '--target', 'browser'], { stdio: 'inherit', shell });
}
const min = fs.readFileSync(outJs);
// The hash covers the scripts AND the stylesheet: a CSS-only change must also reach players
// (the stylesheet URL carries the hash too, so browsers don't keep an old copy).
const css = fs.readFileSync(path.join(ROOT, 'css', 'style.css'));
const hash = crypto.createHash('sha1').update(min).update(css).digest('hex').slice(0, 10);

let html = dev.slice(0, i) + `<script>window.PS_BUILD=${JSON.stringify({ v: hash, at: new Date().toISOString() })};</script>\n<script defer src="js/app.min.js?v=${hash}"></script>` + dev.slice(j + END.length);
html = html.replace('href="css/style.css"', `href="css/style.css?v=${hash}"`);
html = html.replace(/<meta name="robots" content="noindex">\s*/, '');
// --no-seo: no canonical/social/structured data or links to the pages
// (for publishing before the pokesurvivor.com domain exists).
const NO_SEO = process.argv.includes('--no-seo');
html = NO_SEO ? html.replace(/<!-- seo:begin -->[\s\S]*?<!-- seo:end -->\n?/g, '') : html.replace(/<!-- seo:(begin|end) -->\n?/g, '');
html = html.replace(/<!-- dev.html: source page[^>]*-->/, '<!-- GENERATED from dev.html by tools/build.js: do not edit by hand (edit dev.html). -->');
fs.writeFileSync(OUT, html);
// Published version: players check it every 5 min and, if it changes, the game
// updates itself (in the menu, or when the run ends). See js/core/updater.js.
// --force: mandatory version, also interrupts runs in progress (saving them).
const FORCE = process.argv.includes('--force');
fs.writeFileSync(path.join(ROOT, 'version.json'), JSON.stringify(Object.assign({ v: hash, at: new Date().toISOString() }, FORCE ? { force: true } : {})) + '\n');
console.log(`${FORCE ? '[MANDATORY] ' : ''}${NO_SEO ? '[no SEO] ' : ''}${EXPOSE ? '[UNPROTECTED, tests only] ' : ''}ok: ${files.length} scripts · ${(joined.length / 1024).toFixed(0)} KB -> ${(min.length / 1024).toFixed(0)} KB (app.min.js?v=${hash})`);
