# Math Foundation

A math discovery card game. You start with a pair of empty braces `{}` and build
mathematics from nothing: every new card exists because the cards you had couldn't
answer something.

See [PLAN.md](PLAN.md) for the design, the data model and the full unlock plan.

## Play

- **Online:** served by GitHub Pages from this folder (`index.html`).
- **Locally:** ES modules need a web server, so from this folder run
  `python3 -m http.server` and open <http://localhost:8000/>.
- **One file:** `npm run build` writes `dist/math-foundation-game.html`, with the CSS,
  JS, card designs and fonts inlined. Open it anywhere, no server needed.

Progress is saved in the browser. Menu → *Save your progress* gives a code to back it up
or move it to another device. On iPhone, add the page to the home screen: Safari clears
storage for sites you haven't visited in 7 days.

## How it plays

Tap cards in your hand to put up to five in the play area. Drag to insert or reorder;
tap a card in the play area to send it back; hold any card to see its full art and
the paths to it you've found.

A button appears only when the cards form a real play:

| Button | Shape |
|---|---|
| Transmute | one card that can become another (`∅ ⇒ 0`) |
| Evaluate | a calculation with an operator (`1, +, 1`) |
| Combine | cards played together without an operator (`1, S(n)`) |
| Check | answering a question from the game |
| Solve | your own question with `?` and `=` |

The label depends on the shape of the play, never on the answer. Plays that get stuck
(`3, −, 5` in ℕ) and plays with no answer (`1, ÷, 0`) show the same button as any
other.

## Notation

Commas separate cards played together; a colon precedes the result.
`1, S(n) : 2` · `1, +, 1 : 2` · `∅ ⇒ 0` (transmute) · `1 🔓 S(n)` (unlock).
The same notation is used in `data/paths.js` and `data/combos.js`.

## Develop

```
npm test          # engine tests (incl. a walkthrough from {} to every M1 card) and card checks
npm run build     # dist/math-foundation-game.html
```

No dependencies, no build step for development. Node 18+ for tests and the build.

```
data/          categories, cards, paths (how each card is obtained), combos
src/engine/    values, notation, grammar (the button), evaluate, patterns, questions, game
src/state/     localStorage + export code
src/ui/        app, cards, deck, overlays, gesture, dom
styles/        app.css
tests/         node --test
tools/         build.mjs
cards/         card designs (cards.json), renderer, styles, fonts
```

## Cards

Every card is drawn from `cards/cards.json` as HTML and SVG, so it stays sharp at any size.
See [cards/README.md](cards/README.md) for the data format and how to add a card, and open
`cards/index.html` through a server for a gallery of all 74.

- Small cards in the hand and play area show the symbol (drawn in code).
- Medium tiles (the result card, the library) show the card's drawing.
- The unlock reveal and the inspector show the whole card.

If the deck can't load, the game still plays and shows code-drawn placeholders.
