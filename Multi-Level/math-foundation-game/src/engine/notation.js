// Play notation: commas separate cards played together, ":" precedes the
// result, "⇒" marks a transmute.
//   '1, +, 1 : 2'    '∅ ⇒ 0'    '#num, θ'  (#num = any number card)
import { BY_SYMBOL } from '../../data/cards.js';

export function parseNotation(text) {
  let body = text.trim(), result = null, transmute = false;
  const arrow = body.indexOf(' ⇒ ');
  if (arrow >= 0) {
    transmute = true;
    result = body.slice(arrow + 3).trim();
    body = body.slice(0, arrow);
  } else {
    const colon = body.lastIndexOf(' : ');
    if (colon >= 0) { result = body.slice(colon + 3).trim(); body = body.slice(0, colon); }
  }
  const ids = body.split(',').map((s) => s.trim()).map((sym) => {
    if (sym === '#num') return '#num';
    const id = BY_SYMBOL[sym];
    if (!id) throw new Error(`Unknown card symbol "${sym}" in "${text}"`);
    return id;
  });
  return { ids, result, transmute };
}
