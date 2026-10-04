// Builds dist/math-foundation-game.html: one self-contained file with the
// CSS, every JS module, the card designs (cards.json) and the fonts inlined,
// for quick testing anywhere (open the file, no server needed).
//
// Each ES module becomes a function scope in a tiny module table, so top-level
// names never collide. Supported syntax: `import { a, b as c } from './x.js'`
// and `export function|class|const|let`.
//
//   node tools/build.mjs
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => relative(ROOT, p).split('\\').join('/');

const order = [], seen = new Set();
function visit(file) {
  if (seen.has(file)) return;
  seen.add(file);
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/^import\s*\{[^}]*\}\s*from\s*'([^']+)';?/gm)) visit(resolve(dirname(file), m[1]));
  order.push(file);
}
visit(join(ROOT, 'src/main.js'));

function transform(file) {
  let src = readFileSync(file, 'utf8');
  if (/^export\s+(default|\{|\*)/m.test(src)) throw new Error(`${rel(file)}: unsupported export form`);
  if (/^import\s+(?!\{)/m.test(src)) throw new Error(`${rel(file)}: only named imports are supported`);
  src = src.replace(/^import\s*\{([^}]*)\}\s*from\s*'([^']+)';?/gm, (_, names, spec) => {
    const list = names.split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/\s+as\s+/, ': '));
    return `const { ${list.join(', ')} } = __m[${JSON.stringify(rel(resolve(dirname(file), spec)))}];`;
  });
  const exported = [];
  src = src.replace(/^export\s+(async\s+function|function|class|const|let)\s+([A-Za-z_$][\w$]*)/gm, (_, kind, name) => {
    exported.push(name);
    return `${kind} ${name}`;
  });
  return `__m[${JSON.stringify(rel(file))}] = (() => {\n${src}\nreturn { ${exported.join(', ')} };\n})();\n`;
}

const js = `const __m = {};\n${order.map(transform).join('\n')}`;
const tmp = mkdtempSync(join(tmpdir(), 'mf-build-'));
try { writeFileSync(join(tmp, 'bundle.mjs'), js); execFileSync(process.execPath, ['--check', join(tmp, 'bundle.mjs')]); }
finally { rmSync(tmp, { recursive: true, force: true }); } // syntax check

// Card designs and fonts.
const deck = JSON.parse(readFileSync(join(ROOT, 'cards/cards.json'), 'utf8'));
const fontData = (file) => `url(data:font/ttf;base64,${readFileSync(join(ROOT, 'cards', file)).toString('base64')}) format('truetype')`;
const cardsCss = readFileSync(join(ROOT, 'cards/cards.css'), 'utf8')
  .replace(/url\('(fonts\/[^']+\.ttf)'\) format\('truetype'\)/g, (_, file) => fontData(file));
if (/url\('fonts\//.test(cardsCss)) throw new Error('cards.css: a font was not inlined');

const css = readFileSync(join(ROOT, 'styles/app.css'), 'utf8');
const safe = (s) => s.replace(/<\/(script|style)/gi, '<\\/$1');
let html = readFileSync(join(ROOT, 'index.html'), 'utf8');
html = html.replace('<link rel="stylesheet" href="cards/cards.css">', () => `<style>\n${safe(cardsCss)}\n</style>`);
html = html.replace('<link rel="stylesheet" href="styles/app.css">', () => `<style>\n${safe(css)}\n</style>`);
html = html.replace('<script type="module" src="src/main.js"></script>', () =>
  `<script>globalThis.__MF_DECK__ = ${safe(JSON.stringify(deck))};</script>\n  <script type="module">\n${safe(js)}\n</script>`);
if (/src="src\/main\.js"|href="(styles\/app|cards\/cards)\.css"/.test(html)) throw new Error('index.html placeholders not found');

mkdirSync(join(ROOT, 'dist'), { recursive: true });
const out = join(ROOT, 'dist/math-foundation-game.html');
writeFileSync(out, html);
console.log(`${rel(out)}: ${order.length} modules, ${deck.cards.length} cards, ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB`);
