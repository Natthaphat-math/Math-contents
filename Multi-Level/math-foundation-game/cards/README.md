# Math Foundation Cards

74 math cards (numbers, operations, sets & logic, algebra, geometry & trig,
probability & statistics, vectors & matrices, calculus) for the Math Foundation card game.
This folder is the single source of truth for how every card looks; the game renders
its cards from it.

The cards are **not images**. Each card is built at runtime from `cards.json` as HTML + inline
SVG, so it stays sharp at any size, on any screen, and every card can be edited as data.

## Files

```
cards/
├── cards.json   all card content + drawings (the source of truth)
├── cards.css    card styles (all sizes scale with the card width)
├── cards.js     ES module: loadDeck(), indexDeck(), renderCard(), renderArt()
├── index.html   gallery / test page with a size slider and suit filter
└── fonts/       Instrument Serif, IBM Plex Mono, Newsreader (+ OFL licenses)
```

`index.html` loads `cards.json` with `fetch`, so open it through a web server
(`npx serve .`, `python3 -m http.server`, or GitHub Pages), not by double-clicking the file.

## Using a card in the game

```html
<link rel="stylesheet" href="cards/cards.css">
<script type="module">
  import { loadDeck, renderCard } from './cards/cards.js';

  const deck = await loadDeck('./cards/cards.json');
  const hand = document.querySelector('#hand');
  for (const id of ['N01', 'O01', 'N02']) {
    hand.append(renderCard(deck.byId[id], { deck, width: 220 }));
  }
</script>
```

- **Size:** pass `width` (a number of px or any CSS length like `'22vw'`), or set
  `--mfc-width` on `.mfc-card` in CSS. Never scale cards with `transform: scale()` or
  by stretching screenshots — change the width and the card re-lays itself out crisply.
- **Clickable cards:** `renderCard(card, { deck, tag: 'button' })` gives a real button
  (keyboard- and screen-reader-accessible). Each card carries `data-card-id` and `data-suit`.
- **Color:** each suit has an `accent` in `cards.json`. Override one card with
  `{ accent: '#…' }`, or set `--accent` in CSS (e.g. for a highlighted / selected state).
  Drawings use `currentColor`, so they follow `--accent` automatically.

Lookups on the loaded deck: `deck.byId.N07`, `deck.bySuit.geometry`, `deck.suitById.numbers`.

- **Just the drawing:** `renderArt(card)` returns the card's `<svg>` on its own. The game
  uses it for medium-size tiles (the result card and the library).

## Data shape (`cards.json`)

```jsonc
{
  "version": 1,
  "designSize": { "width": 420, "height": 680 },   // aspect ratio of every card
  "suits": [ { "id": "numbers", "code": "N", "name": "Numbers", "accent": "#B4502F" }, … ],
  "cards": [
    {
      "id": "N07",                      // suit code + number; stable, use it in game logic
      "slug": "pi",
      "suit": "numbers",
      "glyph": "π",                     // short symbol, handy for small UI (hand, log, tooltips)
      "name": "Pi",
      "tagline": "Circumference over diameter.",
      "formulas": ["π ≈ 3.14159", "C = πd"],
      "facts": ["…", "…", "…"],
      "origin": { "label": "Symbol π", "value": "William Jones · 1706" },
      "tile": "glyph",                  // optional: drawing too busy to read small;
                                        // medium tiles show the glyph instead
      "art": {
        "alt": "The letter pi above a circle…",  // accessible description of the drawing
        "viewBox": "0 0 354 250",
        "svg": "<text …>π</text><circle …/>…"    // inner SVG markup; accent = currentColor
      }
    }
  ]
}
```

Suit codes: `N` Numbers · `O` Operations · `S` Sets & Logic · `A` Algebra & Functions ·
`G` Geometry & Trig · `P` Probability & Statistics · `V` Vectors & Matrices · `C` Calculus.

## Notes for editing (humans and Claude Code)

- **Add a card:** append an object to `cards` with the next id in its suit, and add the same
  id to the game's `data/cards.js` (`glyph` = the game's `symbol`, `name` = its `title ?? name`;
  `npm test` checks both match). Draw the art in a
  354×250 box; use `currentColor` for the accent and `#1B1A17` (ink) / `#5E5A52` (muted) for
  the rest. Fonts available inside the SVG: `Instrument Serif`, `IBM Plex Mono`, `Newsreader`.
- **Layout:** `cards.css` expresses every size as `cqw` of the card (1 design px = 100/420 cqw),
  so the whole card scales as one piece. Keep that convention when adding elements.
- **Security:** `renderCard` inserts all text with `textContent`. Only `art.svg` is inserted as
  markup, and it must only ever come from this repo's `cards.json` — never from player input,
  a database, or another site. `tests/cards.test.js` rejects anything but plain shapes and text
  (no scripts, event handlers, links, `url()` or `style` attributes).
- **Planned next:** University cards.

## Fonts

Instrument Serif, IBM Plex Mono and Newsreader are under the SIL Open Font License 1.1
(see `fonts/OFL-*.txt`) — free to use and ship with the game. Ship them unmodified: a subset
of IBM Plex Mono would be a modified version, which may not keep the reserved name "Plex".
