#!/usr/bin/env node
// Draws every TikZ diagram in flashcards/cards.js and flashcards/drafts/*.js as an SVG picture,
// so phones show a small ready-made image instead of downloading TikZJax (~3.5 MB) and
// compiling the diagram themselves.
//
//   node flashcards/render-figures.mjs
//
// Needs latex + dvisvgm (TeX Live). Run by .github/workflows/flashcards-figures.yml after every
// change to cards.js or a draft; nobody needs to run it by hand.
// Output (do not edit by hand):
//   flashcards/figures/<id>.svg   one file per diagram; <id> = CardsFormat.figureId(TikZ code)
//   flashcards/figures/index.js   window.CARD_FIGURES = { id: [width, height] }   (CSS px)
//                                 window.CARD_FIGURE_ERRORS = { id: 'TeX error' }
// A diagram that TeX cannot draw is listed in CARD_FIGURE_ERRORS; the app then falls back to
// TikZJax for it, exactly as before. Pictures no card uses any more are deleted.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const mod = { exports: {} };
new Function('module', 'exports', fs.readFileSync(path.join(here, 'cards-format.js'), 'utf8'))(mod, mod.exports);
const CF = mod.exports;

const outDir = path.join(here, 'figures');
const draftsDir = path.join(here, 'drafts');
const files = [path.join(here, 'cards.js')];
if (fs.existsSync(draftsDir)) fs.readdirSync(draftsDir).filter(f => f.endsWith('.js')).sort().forEach(f => files.push(path.join(draftsDir, f)));

// Every diagram, hidden cards included (the editor previews them too)
const wanted = new Map(); // id → normalised TikZ
for (const file of files) {
  const split = CF.splitFile(fs.readFileSync(file, 'utf8'));
  if (!split) continue;
  const doc = CF.parseDocument(split.text);
  doc.units.forEach(u => u.topics.forEach(t => t.cards.forEach(c => [c.frontTikz, c.backTikz].forEach(tikz => {
    const id = CF.figureId(tikz);
    if (id) wanted.set(id, CF.normalizeTikz(tikz));
  }))));
}

const PREAMBLE = String.raw`\documentclass[dvisvgm,tikz,border=1pt]{standalone}
\usepackage{amsmath,amssymb}
\usetikzlibrary{arrows,arrows.meta,calc,angles,quotes,positioning,patterns,decorations.markings,decorations.pathreplacing,shapes.geometric,intersections,through,backgrounds}
\begin{document}
`;

const sizeOf = svg => {
  const m = /<svg[^>]*\swidth='([\d.]+)pt'[^>]*\sheight='([\d.]+)pt'/.exec(svg) || /<svg[^>]*\swidth="([\d.]+)pt"[^>]*\sheight="([\d.]+)pt"/.exec(svg);
  return m ? [+(m[1] * 4 / 3).toFixed(1), +(m[2] * 4 / 3).toFixed(1)] : null; // 1pt = 4/3 CSS px
};
// First TeX error with the line it points at, e.g. "Undefined control sequence. (\foo)"
function texError(log) {
  const lines = log.split('\n');
  const i = lines.findIndex(l => l.startsWith('! '));
  if (i < 0) return 'TeX stopped without an error message';
  const at = lines.slice(i + 1, i + 6).find(l => /^l\.\d+/.test(l));
  return (lines[i].slice(2) + (at ? ' — ' + at.replace(/^l\.\d+\s*/, '').trim() : '')).slice(0, 300);
}

fs.mkdirSync(outDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'figures-'));
const sizes = {}, errors = {};
let drawn = 0;
for (const [id, tikz] of wanted) {
  const svgPath = path.join(outDir, id + '.svg');
  if (fs.existsSync(svgPath)) {
    const size = sizeOf(fs.readFileSync(svgPath, 'utf8'));
    if (size) { sizes[id] = size; continue; }
  }
  const tex = path.join(tmp, id + '.tex');
  const body = /\\begin\{tikzpicture\}/.test(tikz) ? tikz : '\\begin{tikzpicture}\n' + tikz + '\n\\end{tikzpicture}';
  fs.writeFileSync(tex, PREAMBLE + body + '\n\\end{document}\n');
  try {
    execFileSync('latex', ['-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', id + '.tex'], { cwd: tmp, stdio: 'pipe', timeout: 60000 });
    execFileSync('dvisvgm', ['--no-fonts', '--precision=3', '--optimize', '-o', svgPath, id + '.dvi'], { cwd: tmp, stdio: 'pipe', timeout: 60000 });
    const size = sizeOf(fs.readFileSync(svgPath, 'utf8'));
    if (!size) throw new Error('dvisvgm produced no size');
    sizes[id] = size; drawn++;
    console.log(`  ✓ ${id}`);
  } catch (e) {
    const logFile = path.join(tmp, id + '.log');
    errors[id] = fs.existsSync(logFile) ? texError(fs.readFileSync(logFile, 'utf8')) : String(e.message).split('\n')[0];
    if (fs.existsSync(svgPath)) fs.unlinkSync(svgPath);
    console.log(`  ✗ ${id}: ${errors[id]}\n${tikz.split('\n').map(l => '      ' + l).join('\n')}`);
  }
}
fs.rmSync(tmp, { recursive: true, force: true });

// Remove pictures no card uses any more
let removed = 0;
fs.readdirSync(outDir).filter(f => f.endsWith('.svg') && !wanted.has(f.slice(0, -4))).forEach(f => { fs.unlinkSync(path.join(outDir, f)); removed++; });

const sorted = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
fs.writeFileSync(path.join(outDir, 'index.js'),
  '// สร้างอัตโนมัติโดย flashcards/render-figures.mjs — ห้ามแก้ไขไฟล์นี้หรือไฟล์ .svg ในโฟลเดอร์นี้\n' +
  '// Generated by flashcards/render-figures.mjs — do not edit this file or the .svg files here.\n' +
  'window.CARD_FIGURES = ' + JSON.stringify(sorted(sizes)) + ';\n' +
  'window.CARD_FIGURE_ERRORS = ' + JSON.stringify(sorted(errors), null, 1) + ';\n');

console.log(`${wanted.size} diagram(s): ${drawn} drawn now, ${Object.keys(sizes).length - drawn} already drawn, ${Object.keys(errors).length} failed, ${removed} old picture(s) removed.`);
