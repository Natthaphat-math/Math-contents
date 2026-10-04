// Full-screen layers: the unlock reveal, the card inspector, the library
// (with the discovery log) and the menu.
import { h, clear, toast } from './dom.js';
import { fullCard, artTile, lockedTile } from './cards.js';
import { CARD, CARDS } from '../../data/cards.js';
import { CATEGORIES } from '../../data/categories.js';
import { PATHS_BY_CARD, sanitizeState } from '../engine/game.js';
import { exportCode, importCode } from '../state/store.js';

function layer(el, onClose) {
  const close = () => { el.remove(); document.removeEventListener('keydown', esc); onClose?.(); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc);
  document.body.append(el);
  return close;
}

// ---- reveal -----------------------------------------------------------------

export function reveal(game, grants, done) {
  const queue = [...grants];
  const next = () => {
    const g = queue.shift();
    if (!g) { done?.(); return; }
    const card = CARD[g.id];
    const { found, total } = game.pathCount(g.id);
    const flip = h('div', { class: 'flip' },
      h('div', { class: 'flip-inner' },
        h('div', { class: 'flip-front' }, fullCard(card)),
        h('div', { class: 'flip-back', style: { '--cat': `var(--${card.category})` } }, '?')));
    const scrim = h('div', { class: 'scrim', role: 'dialog', 'aria-label': `New card: ${card.title ?? card.name}` },
      h('div', { class: 'reveal' },
        h('div', { class: 'reveal-kicker' }, g.via === 'result' ? 'Discovered' : '🔓 Unlocked'),
        flip,
        g.because ? h('div', { class: 'reveal-because' }, g.because) : null,
        total > 1 ? h('div', { class: 'reveal-paths' }, `Paths found: ${found} of ${total}`) : null,
        h('div', { class: 'reveal-tap' }, queue.length ? `Tap for the next one (${queue.length} more)` : 'Tap to continue')));
    const close = layer(scrim, null);
    scrim.addEventListener('click', () => { close(); next(); });
  };
  next();
}

// ---- inspector --------------------------------------------------------------

export function pathLines(game, id) {
  const entry = PATHS_BY_CARD[id];
  if (!entry) return [];
  const found = new Set(game.s.found[id] ?? []);
  return entry.paths.map((p) => {
    if (found.has(p.id)) return { known: true, text: p.play ?? p.desc ?? p.id };
    return { known: false, text: p.hidden ? '? a hidden path' : '? another path' };
  });
}

export function inspect(game, card, onClose) {
  game.markSeen(card.id);
  const lines = pathLines(game, card.id);
  const { found, total } = game.pathCount(card.id);
  const body = h('div', { class: 'inspect' },
    fullCard(card),
    lines.length ? h('div', { class: 'paths' },
      h('h3', {}, `Paths found: ${found} of ${total}`),
      h('ol', {}, lines.map((l) => h('li', { class: l.known ? '' : 'unknown' },
        h('span', { class: 'mark' }, l.known ? '✓' : '·'), h('span', {}, l.text))))) : null,
    h('button', { type: 'button', class: 'text-btn inspect-close' }, 'Close'));
  const scrim = h('div', { class: 'scrim', role: 'dialog', 'aria-label': card.title ?? card.name }, body);
  const close = layer(scrim, onClose);
  scrim.addEventListener('click', close);
}

// ---- library ----------------------------------------------------------------

export function library(game, onClose) {
  let tab = 'cards', filter = 'all';
  const body = h('div', { class: 'sheet-body' });
  const tabs = h('div', { class: 'tabs' });
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-label': 'Library' },
    h('div', { class: 'sheet-head' },
      h('div', { class: 'sheet-title' }, 'Library'), tabs,
      h('button', { type: 'button', class: 'icon-btn', onclick: () => close(), 'aria-label': 'Close library' }, '✕')),
    body);

  const render = () => {
    clear(tabs, ['cards', 'log'].map((t) => h('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(tab === t), onclick: () => { tab = t; render(); },
    }, t === 'cards' ? 'Cards' : 'Log')));
    if (tab === 'log') return renderLog();
    const owned = CARDS.filter((c) => game.owns(c.id)).length;
    const chips = h('div', { class: 'chips', style: { padding: '8px 0' } },
      h('button', { type: 'button', class: 'chip', 'aria-pressed': String(filter === 'all'), onclick: () => { filter = 'all'; render(); } }, 'All'),
      CATEGORIES.map((cat) => h('button', {
        type: 'button', class: 'chip', style: { '--cat': `var(--${cat.id})` }, 'aria-pressed': String(filter === cat.id),
        onclick: () => { filter = cat.id; render(); },
      }, h('span', { class: 'dot' }), cat.short)));
    const sections = CATEGORIES.filter((cat) => filter === 'all' || filter === cat.id).map((cat) => {
      const cards = CARDS.filter((c) => c.category === cat.id);
      const have = cards.filter((c) => game.owns(c.id)).length;
      return h('section', {},
        h('div', { class: 'section-head', style: { '--cat': `var(--${cat.id})`, background: 'var(--paper)' } },
          h('span', { class: 'dot' }), `${cat.name} · ${have} / ${cards.length}`),
        h('div', { class: 'tile-grid' }, cards.map((c) => {
          if (!game.owns(c.id)) return lockedTile(c);
          const el = artTile(c, { fresh: !game.s.owned[c.id].seen });
          el.addEventListener('click', () => inspect(game, c, render));
          return el;
        })));
    });
    clear(body, h('p', { class: 'progress' }, `${owned} of ${CARDS.length} cards discovered`), chips, sections);
  };

  const renderLog = () => {
    const items = [...game.s.log].reverse();
    clear(body, items.length ? items.map((e) => h('div', { class: 'log-item' },
      h('div', { class: 'log-n' }, `Play ${e.n}`),
      h('div', { class: 'log-text' }, e.text),
      e.grants.length ? h('div', { class: 'log-grants' }, `🔓 ${e.grants.map((id) => CARD[id].symbol).join('  ')}`) : null))
      : h('p', { class: 'progress' }, 'Nothing yet. Play a card.'));
  };

  const close = layer(sheet, onClose);
  render();
}

// ---- menu -------------------------------------------------------------------

export function menu(game, { onReset, onImport }) {
  const code = h('textarea', { readonly: true, 'aria-label': 'Your progress code' });
  code.value = exportCode(game.s);
  const incoming = h('textarea', { placeholder: 'Paste a progress code here', 'aria-label': 'Progress code to load' });

  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-label': 'Menu' },
    h('div', { class: 'sheet-head' },
      h('div', { class: 'sheet-title' }, 'Math Foundation'),
      h('button', { type: 'button', class: 'icon-btn', onclick: () => close(), 'aria-label': 'Close menu' }, '✕')),
    h('div', { class: 'sheet-body' },
      h('section', { class: 'menu-section' },
        h('h3', {}, 'How to play'),
        h('p', {}, 'Build mathematics from nothing. Tap cards in your hand to put up to five of them in the play area, or drag them there and into order.'),
        h('p', {}, 'When the cards form a real play, a button appears: ', h('b', {}, 'Transmute'), ' for one card, ',
          h('b', {}, 'Evaluate'), ' for a calculation, ', h('b', {}, 'Combine'), ' for cards played together. No button means the cards say nothing yet.'),
        h('p', {}, 'Some plays get stuck. That’s fine: being stuck is how new numbers are found.'),
        h('p', {}, 'Hold a card to see it in full, with every path to it you’ve found. Tap a result card to play it again.')),
      h('section', { class: 'menu-section' },
        h('h3', {}, 'Save your progress'),
        h('p', {}, 'Progress is kept in this browser only. Copy this code somewhere safe to move it to another device, or in case the browser clears its storage.'),
        code,
        h('div', { class: 'row' }, h('button', {
          type: 'button', class: 'pill-btn',
          onclick: async () => {
            try { await navigator.clipboard.writeText(code.value); toast('Copied'); } catch { code.select(); toast('Select and copy the code'); }
          },
        }, 'Copy code'))),
      h('section', { class: 'menu-section' },
        h('h3', {}, 'Load progress'),
        incoming,
        h('div', { class: 'row' }, h('button', {
          type: 'button', class: 'pill-btn',
          onclick: () => {
            const state = sanitizeState(importCode(incoming.value));
            if (!state) { toast('That code didn’t work'); return; }
            if (!confirm('Replace your current progress with this code?')) return;
            close(); onImport(state);
          },
        }, 'Load'))),
      h('section', { class: 'menu-section' },
        h('h3', {}, 'Start over'),
        h('p', {}, 'Forget every card and begin again from {}.'),
        h('div', { class: 'row' }, h('button', {
          type: 'button', class: 'pill-btn danger',
          onclick: () => { if (confirm('Erase all progress and start from nothing?')) { close(); onReset(); } },
        }, 'Erase progress'))),
      h('p', { class: 'progress' }, `${game.ownedCount()} of ${CARDS.length} cards · ${game.s.plays} plays`)));
  const close = layer(sheet, null);
}

