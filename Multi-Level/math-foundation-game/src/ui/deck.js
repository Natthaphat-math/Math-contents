// The card designs (cards/cards.json). The single-file build inlines the
// deck as globalThis.__MF_DECK__; otherwise it is fetched next to the game.
// If it cannot load, the game still plays and shows code-drawn placeholders.
import { loadDeck, indexDeck } from '../../cards/cards.js';

let deck = null;
export const getDeck = () => deck;

// Game category id → deck suit id (only Sets & Logic differs).
const SUIT = { sets: 'sets-logic' };
export const suitOf = (category) => SUIT[category] ?? category;

export async function initDeck() {
  try {
    deck = globalThis.__MF_DECK__
      ? indexDeck(globalThis.__MF_DECK__)
      : await loadDeck(new URL('../../cards/cards.json', import.meta.url));
  } catch (err) {
    console.warn('Card designs unavailable, using placeholders.', err);
    deck = null;
  }
}

export const designOf = (id) => deck?.byId[id] ?? null;
