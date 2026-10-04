# Math Foundation — Plan

A math discovery card game. The player builds mathematics from nothing: every new card
exists because the existing cards couldn't answer something.

Status: **M1 built.** All 56 M1 cards are reachable from `{}`; the scripted walkthrough in
`tests/engine.test.js` reaches them in 50 plays (−1 at play 26, ½ 31, √2 35, π 45,
matrix 47, ∫ 50). Decisions below are approved.

---

## 1. Platform & stack

- **Mobile-first web app**, portrait phone first; desktop works (hand moves to a side column).
- **Plain HTML + CSS + ES modules**, no framework, no dependencies, no build step for development.
- Hosted from the **public GitHub repo via GitHub Pages** (`index.html` in this folder).
- `tools/build.mjs` also produces a **single self-contained file**
  `dist/math-foundation-game.html` (CSS, JS and 1× card art inlined) for quick testing.
- The engine is pure JS with no DOM access, unit-tested with `node --test`.
- Progress lives in `localStorage` plus an export/import code. No backend, no personal data.
  (iOS Safari clears site storage after 7 days without a visit unless the page is added to
  the home screen — the export code is the safety net.)

## 2. Visual design — "the mathematician's notebook"

Extends the existing card art: cream paper, condensed serif symbols, mono labels, a
category dot. The table is faint graph paper, like the sketch. Motion is calm: cards glide
into the play area, an unlock flips a "?" card over to reveal its art.

- Fonts: **Instrument Serif** (symbols, titles), **Newsreader** (body), **IBM Plex Mono** (labels).
- Paper `#F6F2E9`, panel `#EFEADF`, muted text `#5E5A52`.
- Category colors (sampled from the card art; Calculus is new):

| Category | Color name | Hex | Id prefix |
|---|---|---|---|
| Numbers | terracotta | `#B4502F` | N |
| Operations | ink | `#1B1A17` | O |
| Sets & Logic | indigo | `#2F4B7C` | S |
| Algebra & Functions | green | `#3F6B45` | A |
| Geometry & Trig | teal | `#2A6B6E` | G |
| Vectors & Matrices | plum | `#6E3B63` | V |
| Calculus | ochre | `#A8761F` | C |
| Probability & Statistics | slate | `#4A5563` | P |

### Phone layout
```
┌───────────────────────────┐
│ Math Foundation  Library ☰│
│   ℕ ⊂ ℤ ⊂ ℚ ⊂ ℝ ⊂ ℂ       │  number-system ladder (lights up)
│  Question: 2, +, ? : 5    │  only when the game asks one
│   1, +, 1 : 2   [2]       │  result line + result card (tap it to reuse)
│   ┌──┐ ┌──┐ ┌──┐ · ·      │  PLAY AREA: ordered row, max 5 (dots = capacity)
│   │1 │ │+ │ │1 │          │
│        [ Evaluate ]       │  button appears only for a valid play, in thumb reach
├───────────────────────────┤
│ All New ●N ●O ●S ●A …     │  sticky category chips (count + new dot)
│ [0][1][2][3][∅][{}] …     │  hand = every owned card, grouped by category
└───────────────────────────┘
```
- **Tap** a hand card: add it to the end of the play area. **Drag** (mouse, or touch-and-hold
  then move): insert at a position / reorder. **Tap** a card in the play area: return it.
  **Hold without moving**: inspect the full card art.
- **Cards are reusable types**, not consumed; the same card can appear twice (`1, +, 1`).
- Small cards (hand, play area, library grid) are drawn in code — symbol in category
  color, dot, id. The full card (from `cards/cards.json`) shows in the inspector and the unlock
  reveal; medium tiles with the card's drawing show the result card and the library.
- Library + discovery log: same grid, grouped by category with jump chips; locked cards are
  "?" inside their own category; each card shows paths found ("2 of 3").

## 3. Notation (used in code, data and docs)

- `,` separates cards played together; `:` precedes the result: `1, +, 1 : 2`.
- `⇒` marks a transmute: `∅ ⇒ 0`.
- `🔓` marks an unlock: `1 🔓 S(n)`.

## 4. Data model

**Card** (`data/cards.js`):
```js
{ id: 'N12', symbol: '2', name: 'Two', category: 'numbers', kind: 'number',
  value: 2, chapter: 1, star: false, m1: true, tagline: '…' }
```
Its look (drawing, tagline, formulas, facts) lives in `cards/cards.json` under the same id.
`kind` ∈ number · binop · prefix · postfix · function · set · braces · system · concept · blank.

**Paths** (`data/paths.js`) — every way to obtain a card. Any one path is enough; each
path fires once; the card is granted the first time any of its paths fires. Results,
transmutes and unlocks all use the same model.
```js
{ card: 'N12', paths: [
    { id: 'succ', play: '1, S(n) : 2' },                 // exact recipe, in notation
    { id: 'add',  play: '1, +, 1 : 2' },
    { id: 'set',  pattern: 'setForm', n: 2, hidden: true } ] }
{ card: 'A08', paths: [ { id: 'own1', own: 'N02' } ] }  // 1 🔓 S(n)
{ card: 'S17', also: ['N03'], paths: [ { id: 'stuck', stuck: 'Z' } ] }   // 3, −, 5 🔓 ℤ (+ −1)
{ card: 'O06', paths: [ { id: 'rep', pattern: 'repeat', op: '×', min: 3 } ] }
{ card: 'A01', paths: [ { id: 'q', question: 'add-blank', solved: 1 } ] }
{ card: 'N10', paths: [ { id: 'run', event: 'keep-going' }, { id: 'succN', play: 'ℕ, S(n)' } ] }
```
Trigger types: `own`, `play` (exact, parsed from notation at load; order ignored when the
play has no − ÷ aᵇ log), `pattern` (a small vocabulary of named, tested matchers:
`repeat`, `consecutive`, `opposites`, `relation`, `applyToSet`, `inversePair`, `halfPower`,
`divBy100`, `setForm`, `firstEvaluate`, `sameInput`, `transmuteChain`), `stuck`,
`question`, `event`, `combo` (exact concept pairings for later chapters).

One pattern = one path, however many numbers match it (a path is an idea, not an input).
Any result whose value has a card also grants that card ("found another way"), but only
listed paths count toward "x of y".

**The stuck rule**: a play is stuck when its answer lives in a number system the player
hasn't unlocked (ℕ is always the working world; ℤ ℚ ℝ ℂ must be unlocked). The engine
knows each value's smallest system, so stuck plays need no special data.
Stuck → unlock the system (+ its example card) → re-evaluate → temporary result card.
`3, −, 5` → stuck in ℕ → 🔓 ℤ, −1 → `3, −, 5 : −2`.

**No theorem yet**: undefined in every system (`1, ÷, 0`) — gentle message, hint at lim.

**Temporary result cards**: made in code, dashed border, value + smallest set
("25 ∈ ℕ", "∈ ?" before ℕ is owned). Exact BigInt rationals; enormous results show as
"≈ 10²⁰⁰ ∈ ℕ (201 digits)". A temp card may be used in the very next play (scratch),
never enters the hand.

**Number cards**: 0–10 and 100. S(10) gives a temporary 11 → "keep going" → ∞.

## 5. The action button

The label depends on the **shape** of the play, never on the answer:

| Shape | Label |
|---|---|
| 1 card that has a transmute | **Transmute** |
| Contains an operator (+ − × ÷ = aᵇ log √ \|x\| n! %) | **Evaluate** |
| 2+ cards, no operator | **Combine** |
| A question from the game | **Check** |
| Your own `?` with `=` in the sandbox | **Solve** |

- Stuck plays show Evaluate like any other, so the surprise isn't spoiled. Never "Unlock".
- Expressions are valid by **grammar** (numbers and operators alternate, standard
  precedence), so the button means "this is grammatical math", not "this discovers something".
- Operator-free plays follow general rules — wrap (`x, {}` → {x}), apply a function
  (`1, S(n)`), iterate (`S(n), S(n)`), compare (=, <, ∈, ⊆, opposites), relate two
  operators (inverse / repeated) — so most pairs are valid and the button doesn't point at
  discoveries. The only real leak is a handful of later concept pairings; finding those is
  the fun.
- Questions: Check appears as soon as the blank is filled, right or wrong. Wrong answers
  get "too small / too big" with a number-line nudge. The answer is always an owned card.
- Order: expressions read left to right (order matters for − ÷ aᵇ log); Combine plays
  ignore order; triggers made only of + or × ignore order.

## 6. Architecture

```
projects/math-foundation-game/
  index.html · styles/app.css · PLAN.md · README.md · package.json
  data/        categories.js · cards.js · paths.js · combos.js
  src/engine/  values.js     exact numbers, sets, ℕ⊂ℤ⊂ℚ⊂ℝ⊂ℂ membership
               notation.js   parse/format "1, +, 1 : 2"
               grammar.js    play shape → button label (or none)
               evaluate.js   compute result / transmute / stuck / no theorem
               patterns.js   named trigger matchers
               questions.js  question generator (answers always owned)
               game.js       state, discovery, fire-once paths, cascades
  src/state/   store.js      localStorage, versioned, export code
  src/ui/      app.js, cardview.js, drag.js, overlays.js …
  tests/       engine tests + golden walkthrough (every M1 card reachable from {})
  tools/       build.mjs → dist/math-foundation-game.html
  cards/       card art (existing files untouched)
```

## 7. Unlock plan (M1)

Start with `{}`.

**Sets & foundations**
| Card | Paths |
|---|---|
| ∅ | `{} ⇒ ∅` |
| 0 | `∅ ⇒ 0` |
| {∅} | `∅, {} : {∅}` (general rule: `x, {}` wraps x) |
| 1 | `{∅} ⇒ 1` |
| S(n), + | `1 🔓` |
| 2 | `1, S(n) : 2` · `1, +, 1 : 2` · hidden: transmute the set `{∅, {∅}}` ⇒ 2 |
| = | first successful Evaluate |
| 3 … 10 | any play whose result is that number |
| ℕ | `S(n), S(n) : ℕ` |
| ∈ | compare a set with a set containing it (`∅, {∅}`) |
| ∪ | S(n) played on a set card (shows n ∪ {n}) |
| ∞ | S on 10 → "keep going" runner · `ℕ, S(n) : ℕ` (no last element) |
| ⇒ | two transmutes in a row on the same chain ({} ⇒ ∅ ⇒ 0) |

**Arithmetic & number systems**
| Card | Paths |
|---|---|
| × | repeated same addend: `1, +, 1` · `2, +, 2, +, 2` (one pattern) |
| aᵇ | repeated same factor, 3+: `2, ×, 2, ×, 2` · `1, ×, 1, ×, 1` |
| n! | `1, ×, 2, ×, 3 : 6` (any order) |
| 100 | `10, ×, 10 : 100` · `10, aᵇ, 2 : 100` |
| x | 1st solved `a, +, ? : c` question · a sandbox Solve |
| − | 3rd solved `a, +, ? : c` question |
| ℤ + −1 | stuck needing ℤ (`3, −, 5`); −1 also from `0, −, 1` |
| \|x\| | opposites: `−1, 1` |
| ÷ | 3rd solved `a, ×, ? : c` question |
| ℚ + ½ | stuck needing ℚ (`1, ÷, 2`); ½ also from `1, ÷, 2` |
| 0.3̇ | `1, ÷, 3 : 0.3̇` (bonus: `0.3̇, ×, 3 : 1`) |
| % | `n, ÷, 100` |
| log | solved `2, aᵇ, ? : 8` question |
| √, √2, ℝ | squeeze question `?, aᵇ, 2 : 2` (bisect, never lands) · ℝ + √2 also from stuck needing ℝ (`2, aᵇ, ½`, `2, log, 3`) · √ also from `a, aᵇ, ½` |
| i, ℂ | stuck needing ℂ: `√, −1` |
| f(x) | three different functions on the same input (`S(n), 4` · `√, 4` · `|x|, 4`) · `S(n), x` |
| f⁻¹ | an inverse pair (`+, −` · `×, ÷` · `aᵇ, log` · `aᵇ, √` · `d/dx, ∫`) · solved `S(n), ? : 5` question |

`1, ÷, 0` is "no theorem yet", hinting at lim.

**Short paths to the later ★ cards** (all within the 5-card cap)
| Card | Path |
|---|---|
| aₙ | `f(x), ℕ` |
| Σ | `+, aₙ` |
| △ | `√2 🔓 △` (the unit square's diagonal) |
| θ | `△ ⇒ θ` |
| π, rad | `θ, +, θ, +, θ` (a triangle's angles make a half-turn) |
| v⃗ | `n, θ` (a length and a direction) |
| matrix | `v⃗, v⃗` |
| lim | `aₙ, ∞` |
| e | `Σ, 1, ÷, n!` |
| d/dx | `lim, △, f(x)` |
| ∫ | `lim, Σ, f(x)` |

Locked "?" in M1 (paths come in M2): ∩ ⊆ ∧ ∨ ⇔ ∀ ∃ · ax²+bx+c · a²+b²=c² sin cos tan ⊥∥ ·
det · P(A) ⁿCᵣ x̄ σ.

Decisions: 0.5 is **not** a card (`½ ⇒` shows a temporary "0.5 ∈ ℚ"; N05 0.3̇ takes the ★
decimal slot). The ℕ⊂ℤ⊂ℚ⊂ℝ⊂ℂ chain is a **live ladder in the top bar**, not a card.

## 8. Milestones

- **M1 (MVP)**: engine + data + tests; sandbox table, questions (+, ×, aᵇ blanks, squeeze,
  S-blank), discovery log with paths, library with locked "?", card rendering,
  persistence + export code; Chapters 1–3 in full plus the short paths to every ★.
- **M2**: remaining Geometry/Trig, det, the quadratic, Probability, logic cards (∧ from ∩,
  ∨ from ∪, ∀ from the ∞ path), offline play (service worker), hint lamp for near misses.
- **M3**: daily challenge generated from the date (no server), proof-ordering boss levels
  (starting with "√2 is irrational"), sound.

## 9. Cards

Cards are data, not images: `cards/cards.json` holds every card's text and SVG drawing,
`cards/cards.js` renders it (sharp at any size), and the fonts ship in `cards/fonts/`.
All 74 cards are designed, including the Calculus suit (ochre). The PNG art was retired
(it remains in git history).

- Small cards (hand, play area): the symbol, drawn in code.
- Medium tiles (result card, library): the card's drawing. Drawings too busy to read small
  (truth tables, Pascal's triangle) set `"tile": "glyph"` and show the symbol instead.
- Full card (reveal, inspector): the whole design.

S10 Implication and S11 If and Only If use → and ↔, so ⇒ stays reserved for the
transmute notation.

## 10. Hosting

GitHub Pages from `Natthaphat-math/Math-contents` (branch `main`), folder
`Multi-Level/math-foundation-game/`: the source folder as-is (static files, no build step).
