// Math Foundation Cards — renders cards from cards.json as real HTML + SVG.
// No dependencies. Works as an ES module:
//
//   import { loadDeck, renderCard } from './math-foundation-cards/cards.js';
//   const deck = await loadDeck('./math-foundation-cards/cards.json');
//   document.body.append(renderCard(deck.byId.N07, { width: 280 }));
//
// Text is always inserted with textContent (never innerHTML). The only markup
// inserted as HTML is each card's `art.svg`, which ships in this repo's own
// cards.json — keep it that way: never put user-supplied or fetched-from-
// elsewhere strings into `art.svg`.

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi'];
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Fetch cards.json and index it. */
export async function loadDeck(url = new URL('./cards.json', import.meta.url)) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load cards: ${res.status}`);
  return indexDeck(await res.json());
}

/** Add lookup tables to already-loaded deck data. */
export function indexDeck(data) {
  const suits = Object.fromEntries(data.suits.map((s) => [s.id, s]));
  const byId = Object.fromEntries(data.cards.map((c) => [c.id, c]));
  const bySuit = {};
  for (const c of data.cards) (bySuit[c.suit] ||= []).push(c);
  return { ...data, suits: data.suits, suitById: suits, byId, bySuit };
}

/** Just a card's drawing, as an <svg> (accent = currentColor). */
export function renderArt(card) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', card.art.viewBox);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', card.art.alt);
  svg.innerHTML = card.art.svg; // trusted: from this repo's cards.json only
  return svg;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * Build one card element.
 * @param {object} card     an entry from deck.cards
 * @param {object} [opts]
 * @param {object} [opts.deck]    the loaded deck (to look up the suit's name/accent)
 * @param {number|string} [opts.width]  e.g. 280 or '30vw' (default 420px)
 * @param {string} [opts.accent]  override the suit color
 * @param {string} [opts.tag]     wrapper element (default 'article'; use 'button' for clickable cards)
 */
export function renderCard(card, opts = {}) {
  const suit = opts.deck?.suitById?.[card.suit];
  const root = el(opts.tag || 'article', 'mfc-card');
  root.dataset.cardId = card.id;
  root.dataset.suit = card.suit;
  root.setAttribute('aria-label', `${card.name} (${card.glyph})`);
  if (opts.width != null) root.style.setProperty('--mfc-width', typeof opts.width === 'number' ? `${opts.width}px` : opts.width);
  const accent = opts.accent || suit?.accent;
  if (accent) root.style.setProperty('--accent', accent);

  const face = el('div', 'mfc-face');
  const frame = el('div', 'mfc-frame');

  const head = el('header', 'mfc-head');
  head.append(el('span', null, `No. ${card.id}`));
  const suitTag = el('span', 'mfc-suit');
  suitTag.append(el('span', 'mfc-dot'), document.createTextNode(suit?.name || card.suit));
  head.append(suitTag);

  const art = el('figure', 'mfc-art');
  art.style.margin = '0';
  art.append(renderArt(card));

  const titles = el('div');
  titles.append(el('h2', 'mfc-name', card.name), el('p', 'mfc-tagline', card.tagline));

  const formulas = el('ul', 'mfc-formulas');
  for (const f of card.formulas) formulas.append(el('li', null, f));

  const facts = el('ol', 'mfc-facts');
  card.facts.forEach((f, i) => {
    const li = el('li');
    li.append(el('span', 'mfc-num', ROMAN[i] || String(i + 1)), el('span', null, f));
    facts.append(li);
  });

  const origin = el('footer', 'mfc-origin');
  origin.append(el('span', null, card.origin.label), el('span', null, card.origin.value));

  frame.append(head, art, titles, formulas, facts, origin);
  face.append(frame);
  root.append(face);
  return root;
}
