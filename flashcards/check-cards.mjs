#!/usr/bin/env node
// Checks flashcards/cards.js and the draft files in flashcards/drafts/.
//   node flashcards/check-cards.mjs                 → cards.js + every draft
//   node flashcards/check-cards.mjs drafts/x.js     → cards.js + the given draft(s)
// Exit code 1 when anything must be fixed. Used by Claude before committing a draft.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// cards-format.js is a browser script; load it without relying on the package "type".
const mod = { exports: {} };
new Function('module', 'exports', fs.readFileSync(path.join(here, 'cards-format.js'), 'utf8'))(mod, mod.exports);
const CF = mod.exports;
const LEVELS = ['ps', 'jh', 'sh', 'uni'];

let problems = 0, warnings = 0;
const err = (file, msg) => { problems++; console.log(`  ✗ ${file}: ${msg}`); };
const warn = (file, msg) => { warnings++; console.log(`  ! ${file}: ${msg}`); };

function load(file) {
  const text = fs.readFileSync(file, 'utf8');
  const split = CF.splitFile(text);
  if (!split) { err(file, 'no card section: the file must contain /* … */ (see the first two lines of cards.js)'); return null; }
  if (!/^\/\/.*\nwindow\.CARD_SOURCE = function \(\) \{\/\*/.test(text)) warn(file, 'first two lines should match cards.js (comment line, then "window.CARD_SOURCE = function () {/*")');
  if (!/\*\/\};\s*$/.test(text)) err(file, 'the last line must be */};');
  return { file, text, split, doc: CF.parseDocument(split.text), parsed: CF.parse(split.text, split.lineOffset) };
}
const cardsOf = doc => doc.units.flatMap(u => u.topics.flatMap(t => t.cards.map(c => ({ u, t, c }))));

const cardsFile = path.join(here, 'cards.js');
const base = load(cardsFile);
if (!base) process.exit(1);
console.log(`cards.js: ${base.parsed.cards.length} cards shown to students`);
base.parsed.errors.forEach(e => err('cards.js', `line ${e.line}: ${e.message}`));
const baseIds = new Set(cardsOf(base.doc).map(x => x.c.id));
const baseUnits = new Map(base.doc.units.map(u => [u.name, u]));

const draftsDir = path.join(here, 'drafts');
const args = process.argv.slice(2);
const draftFiles = args.length
  ? args.map(a => path.resolve(a))
  : (fs.existsSync(draftsDir) ? fs.readdirSync(draftsDir).filter(f => f.endsWith('.js')).sort().map(f => path.join(draftsDir, f)) : []);

const seen = new Map(); // id → draft file
for (const f of draftFiles) {
  const rel = path.relative(process.cwd(), f);
  const name = rel.startsWith('..') ? path.basename(f) : rel;
  const d = load(f);
  if (!d) continue;
  const list = cardsOf(d.doc);
  console.log(`${name}: ${list.length} cards in ${d.doc.units.length} unit(s)`);
  d.parsed.errors.forEach(e => err(name, `line ${e.line}: ${e.message}`));
  d.doc.units.forEach(u => {
    if (!u.name) err(name, 'a card comes before any "# บท:" line');
    if (!LEVELS.includes(u.level)) err(name, `unit "${u.name}": "# ระดับ:" must be ps, jh, sh or uni`);
    const existing = baseUnits.get(u.name);
    if (existing && existing.level !== u.level) warn(name, `unit "${u.name}" is level ${existing.level} in cards.js but ${u.level} here`);
    if (!existing) warn(name, `unit "${u.name}" is new (not in cards.js) — fine if intended; use the exact existing name to add to a unit`);
  });
  list.forEach(({ c }) => {
    if (/\s/.test(c.id)) err(name, `id "${c.id}" contains a space`);
    if (!/^[a-z0-9-]+$/.test(c.id)) warn(name, `id "${c.id}": prefer lowercase a-z, 0-9 and -`);
    if (baseIds.has(c.id)) err(name, `id "${c.id}" already exists in cards.js`);
    if (seen.has(c.id) && seen.get(c.id) !== name) err(name, `id "${c.id}" is also used in ${seen.get(c.id)}`);
    seen.set(c.id, name);
    [['ถาม', c.front], ['ตอบ', c.back], ['รูปถาม', c.frontTikz], ['รูปตอบ', c.backTikz]].forEach(([label, v]) =>
      CF.contentProblems(v).forEach(p => err(name, `${c.id} ${label}: ${p}`)));
    if (!c.front || !c.back) err(name, `${c.id}: needs both ถาม: and ตอบ:`);
  });
}

console.log(problems ? `\n${problems} problem(s) to fix, ${warnings} warning(s).` : `\nOK — no problems${warnings ? `, ${warnings} warning(s)` : ''}.`);
process.exit(problems ? 1 : 0);
