// The card designs (cards/cards.json) must match the game's card data, and
// every drawing must be plain, inert SVG: renderCard inserts it as markup.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CARDS, CARD } from '../data/cards.js';
import { CATEGORY } from '../data/categories.js';

const deck = JSON.parse(readFileSync(new URL('../cards/cards.json', import.meta.url), 'utf8'));
const suitOf = (category) => (category === 'sets' ? 'sets-logic' : category);

test('every game card has a design that matches it', () => {
  const byId = Object.fromEntries(deck.cards.map((c) => [c.id, c]));
  for (const card of CARDS) {
    const d = byId[card.id];
    assert.ok(d, `${card.id} has no design in cards.json`);
    assert.equal(d.glyph, card.symbol, `${card.id} glyph`);
    assert.equal(d.name, card.title ?? card.name, `${card.id} name`);
    assert.equal(d.suit, suitOf(card.category), `${card.id} suit`);
  }
  for (const d of deck.cards) assert.ok(CARD[d.id], `${d.id} is designed but not in the game`);
});

test('suits match the game categories and colors', () => {
  for (const s of deck.suits) {
    const cat = Object.values(CATEGORY).find((c) => suitOf(c.id) === s.id);
    assert.ok(cat, `suit ${s.id}`);
    assert.equal(s.accent.toUpperCase(), cat.hex.toUpperCase(), `${s.id} accent`);
    assert.equal(s.code, cat.prefix, `${s.id} code`);
  }
});

test('every design is complete', () => {
  const ids = new Set();
  for (const c of deck.cards) {
    assert.ok(!ids.has(c.id), `duplicate ${c.id}`); ids.add(c.id);
    for (const f of ['slug', 'glyph', 'name', 'tagline']) assert.ok(c[f], `${c.id} ${f}`);
    assert.ok(c.formulas.length >= 1 && c.facts.length >= 1, `${c.id} formulas/facts`);
    assert.ok(c.origin?.label && c.origin?.value, `${c.id} origin`);
    assert.equal(c.art.viewBox, '0 0 354 250', `${c.id} viewBox`);
    assert.ok(c.art.alt && c.art.svg, `${c.id} art`);
    if (c.tile !== undefined) assert.equal(c.tile, 'glyph', `${c.id} tile`);
  }
});

test('drawings are inert SVG only', () => {
  const ALLOWED = new Set(['text', 'tspan', 'line', 'circle', 'ellipse', 'rect', 'path', 'polygon', 'polyline', 'g']);
  for (const c of deck.cards) {
    const svg = c.art.svg;
    for (const [, tag] of svg.matchAll(/<\/?\s*([a-zA-Z][\w:-]*)/g)) assert.ok(ALLOWED.has(tag), `${c.id}: <${tag}> is not allowed`);
    assert.doesNotMatch(svg, /\son\w+\s*=/i, `${c.id}: event handler`);
    assert.doesNotMatch(svg, /href|javascript:|url\(|\sstyle\s*=/i, `${c.id}: links, urls or styles`);
  }
});
