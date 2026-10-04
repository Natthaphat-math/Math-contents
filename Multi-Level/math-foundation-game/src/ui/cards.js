// Card views. Small cards (hand, play area) are drawn in code: symbol, dot, id.
// Medium tiles show the card's drawing; full cards are rendered from
// cards/cards.json. A code-drawn placeholder covers any card without a design.
import { h } from './dom.js';
import { CATEGORY } from '../../data/categories.js';
import { valueText } from '../engine/evaluate.js';
import { system, SYSTEM_SYMBOL } from '../engine/values.js';
import { renderCard, renderArt } from '../../cards/cards.js';
import { getDeck, designOf } from './deck.js';

const catVar = (category) => ({ '--cat': `var(--${category})` });

function sizeClass(text) {
  const n = [...text.normalize('NFC')].length;
  return n >= 7 ? 's8' : n >= 5 ? 's5' : n >= 3 ? 's3' : '';
}

export function miniCard(card, { fresh = false, extraClass = '', label } = {}) {
  return h('button', {
    type: 'button', class: `mc ${fresh ? 'fresh' : ''} ${extraClass}`.trim(), style: catVar(card.category),
    'aria-label': label ?? `${card.title ?? card.name} (${card.symbol})`, 'data-id': card.id,
  },
  h('span', { class: 'cdot' }),
  h('span', { class: `sym ${sizeClass(card.symbol)}` }, card.symbol),
  h('span', { class: 'cid' }, card.id),
  fresh ? h('span', { class: 'new' }, 'new') : null);
}

// The set label on a temporary result card: "∈ ℕ", or "∈ ?" before ℕ is named.
export function setLabel(value, owns) {
  const s = system(value);
  if (!s) return value.k === 'set' ? 'a set' : '';
  if (s === 'N' && !owns('S16')) return '∈ ?';
  return `∈ ${SYSTEM_SYMBOL[s]}`;
}

export function tempCard(value, show, owns) {
  const s = system(value);
  const cat = s ? 'numbers' : value.k === 'set' || value.k === 'sys' ? 'sets' : 'operations';
  const text = valueText(value, show);
  return h('button', { type: 'button', class: 'mc temp', style: catVar(cat), 'aria-label': `Temporary result ${text}` },
    h('span', { class: `sym ${sizeClass(text)}` }, text),
    h('span', { class: 'setlab' }, setLabel(value, owns)));
}

export function lockedCard(card) {
  return h('div', { class: 'mc locked', style: catVar(card.category), 'aria-label': 'Undiscovered card' },
    h('span', { class: 'sym' }, '?'));
}

export function blankCard(label = '?') {
  return h('button', { type: 'button', class: 'mc blank', 'aria-label': 'Blank' }, h('span', { class: 'sym' }, label));
}

export function placeholder(card) {
  const cat = CATEGORY[card.category];
  return h('div', { class: 'ph', style: catVar(card.category), role: 'img', 'aria-label': `${card.title ?? card.name} card` },
    h('div', { class: 'ph-top' }, h('span', {}, `No. ${card.id}`), h('span', {}, h('span', { class: 'dot' }), cat.name)),
    h('div', { class: 'ph-panel' }, h('span', { class: `ph-sym ${sizeClass(card.symbol)}` }, card.symbol)),
    h('div', { class: 'ph-title' }, card.title ?? card.name),
    card.tagline ? h('div', { class: 'ph-tag' }, card.tagline) : null);
}

// The whole card, as designed in cards.json.
export function fullCard(card) {
  const design = designOf(card.id);
  return h('div', { class: 'full-card', style: catVar(card.category) },
    design ? renderCard(design, { deck: getDeck(), width: '100%' }) : placeholder(card));
}

// A medium tile: the card's drawing (or its symbol, for drawings too busy to
// read small) with the card's name underneath.
export function artTile(card, { fresh = false, tag = 'button' } = {}) {
  const design = designOf(card.id);
  const panel = h('span', { class: 'tile-art' });
  if (design && design.tile !== 'glyph') panel.append(renderArt(design));
  else panel.append(h('span', { class: `tile-sym ${sizeClass(card.symbol)}` }, card.symbol));
  return h(tag, {
    type: tag === 'button' ? 'button' : null, class: `tile ${fresh ? 'fresh' : ''}`.trim(), style: catVar(card.category),
    'aria-label': `${card.title ?? card.name} (${card.symbol})`, 'data-id': card.id,
  }, panel, h('span', { class: 'tile-name' }, card.title ?? card.name), fresh ? h('span', { class: 'new' }, 'new') : null);
}

export function lockedTile(card) {
  return h('div', { class: 'tile locked', style: catVar(card.category), 'aria-label': 'Undiscovered card' },
    h('span', { class: 'tile-art' }, h('span', { class: 'tile-sym' }, '?')), h('span', { class: 'tile-name' }, '?'));
}
