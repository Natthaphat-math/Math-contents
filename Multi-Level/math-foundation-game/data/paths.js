// Every way to obtain a card. Any one path is enough; each path fires once.
// The card is granted the first time any of its paths fires. `also` cards are
// granted together with the card (a number system brings its example card).
//
// Trigger types (one per path):
//   own: id              owning a card (1 🔓 S(n))
//   play: 'notation'     an exact play; the ": result" part is checked by tests
//   pattern: name, …     a named matcher from src/engine/patterns.js
//   stuck: sys           a play got stuck needing that number system
//   question: kind, solved: n   answering n questions of a kind
//   event: name          a special interaction (the "keep going" runner)
//   combo: id            a concept pairing from data/combos.js
//
// `desc` is shown in the card's path list once found (plays describe themselves).
// `hidden` paths are not hinted at before they are found.
export const PATHS = [
  // Sets & foundations
  { card: 'S01', paths: [{ id: 'braces', play: '{} ⇒ ∅' }] },
  { card: 'N01', paths: [{ id: 'count', play: '∅ ⇒ 0' }] },
  { card: 'S15', paths: [{ id: 'wrap', play: '∅, {} : {∅}' }] },
  { card: 'N02', paths: [{ id: 'count', play: '{∅} ⇒ 1' }] },
  { card: 'A08', paths: [{ id: 'own1', own: 'N02' }] },
  { card: 'O01', paths: [{ id: 'own1', own: 'N02' }] },
  {
    card: 'N12', paths: [
      { id: 'succ', play: '1, S(n) : 2' },
      { id: 'add', play: '1, +, 1 : 2' },
      { id: 'set', pattern: 'setForm', n: 2, hidden: true, desc: 'The set {∅, {∅}} ⇒ 2' },
    ],
  },
  { card: 'O05', paths: [{ id: 'eval', pattern: 'firstEvaluate', desc: 'Your first calculation' }] },
  ...['N13', 'N14', 'N15', 'N16', 'N17', 'N18', 'N19', 'N20'].map((card) => ({
    card, paths: [{ id: 'make', pattern: 'produces', desc: 'Any play that makes it' }],
  })),
  { card: 'S16', paths: [{ id: 'iter', play: 'S(n), S(n) : ℕ' }] },
  { card: 'S02', paths: [{ id: 'in', pattern: 'relation', rel: 'in', desc: 'Compare a set with a set that contains it' }] },
  { card: 'S03', paths: [{ id: 'succSet', pattern: 'applyToSet', desc: 'S(n) on a set: n ∪ {n}' }] },
  {
    card: 'N10', paths: [
      { id: 'run', event: 'keep-going', desc: 'Keep going past the last number card' },
      { id: 'succN', play: 'ℕ, S(n) : ℕ' },
    ],
  },
  { card: 'S10', paths: [{ id: 'chain', pattern: 'transmuteChain', desc: 'Two transmutes in a row' }] },

  // Arithmetic
  { card: 'O03', paths: [{ id: 'rep', pattern: 'repeat', op: '+', min: 2, desc: 'The same number added again: a, +, a' }] },
  { card: 'O06', paths: [{ id: 'rep', pattern: 'repeat', op: '×', min: 3, desc: 'The same number multiplied again and again: a, ×, a, ×, a' }] },
  { card: 'O09', paths: [{ id: 'cons', pattern: 'consecutive', desc: '1, ×, 2, ×, 3' }] },
  {
    card: 'N21', paths: [
      { id: 'mul', play: '10, ×, 10 : 100' },
      { id: 'pow', play: '10, aᵇ, 2 : 100' },
    ],
  },
  {
    card: 'A01', paths: [
      { id: 'q', question: 'add-blank', solved: 1, desc: 'Answer a ? question' },
      { id: 'solve', pattern: 'solved', desc: 'Solve for your own ?' },
    ],
  },
  { card: 'O02', paths: [{ id: 'q', question: 'add-blank', solved: 3, desc: 'Undo + three times' }] },

  // Number systems
  { card: 'S17', also: ['N03'], paths: [{ id: 'stuck', stuck: 'Z', desc: 'Get stuck in ℕ' }] },
  { card: 'N03', paths: [{ id: 'sub', play: '0, −, 1 : −1' }] },
  { card: 'O08', paths: [{ id: 'opp', pattern: 'relation', rel: 'opposites', desc: 'Two numbers the same distance from 0' }] },
  { card: 'O04', paths: [{ id: 'q', question: 'mul-blank', solved: 3, desc: 'Undo × three times' }] },
  { card: 'S18', also: ['N04'], paths: [{ id: 'stuck', stuck: 'Q', desc: 'Get stuck in ℤ' }] },
  { card: 'N04', paths: [{ id: 'div', play: '1, ÷, 2 : ½' }] },
  { card: 'N05', paths: [{ id: 'div', play: '1, ÷, 3 : 0.3̇' }] },
  { card: 'N11', paths: [{ id: 'per', pattern: 'divBy100', desc: 'Divide anything by 100' }] },
  { card: 'A04', paths: [{ id: 'q', question: 'pow-blank', solved: 1, desc: 'Find the missing power' }] },
  {
    card: 'O07', paths: [
      { id: 'sq', question: 'squeeze', solved: 1, desc: 'Squeeze ?² = 2' },
      { id: 'half', pattern: 'halfPower', desc: 'Raise a number to the power ½' },
    ],
  },
  {
    card: 'N06', paths: [
      { id: 'sq', question: 'squeeze', solved: 1, desc: 'Squeeze ?² = 2' },
      { id: 'pow', play: '2, aᵇ, ½ : √2' },
    ],
  },
  {
    card: 'S06', also: ['N06'], paths: [
      { id: 'sq', question: 'squeeze', solved: 1, desc: 'Squeeze ?² = 2' },
      { id: 'stuck', stuck: 'R', desc: 'Get stuck in ℚ' },
    ],
  },
  { card: 'N09', paths: [{ id: 'root', play: '√, −1 : i' }] },
  { card: 'S07', also: ['N09'], paths: [{ id: 'stuck', stuck: 'C', desc: 'Get stuck in ℝ' }] },

  // Algebra & functions
  {
    card: 'A02', paths: [
      { id: 'same', pattern: 'sameInput', count: 3, desc: 'Three different machines on the same input' },
      { id: 'rule', combo: 'fx' },
    ],
  },
  {
    card: 'A03', paths: [
      { id: 'inv', pattern: 'inversePair', desc: 'Two operations that undo each other' },
      { id: 'q', question: 'succ-blank', solved: 1, desc: 'Run S(n) backwards' },
    ],
  },
  { card: 'A07', paths: [{ id: 'seq', combo: 'seq' }] },
  { card: 'A06', paths: [{ id: 'sum', combo: 'sigma' }] },

  // Short paths to the later ★ cards
  { card: 'G01', paths: [{ id: 'diag', own: 'N06', desc: 'The diagonal of a unit square is √2' }] },
  { card: 'G02', paths: [{ id: 'corner', play: '△ ⇒ θ' }] },
  { card: 'N07', paths: [{ id: 'tri', combo: 'pi' }] },
  { card: 'G08', paths: [{ id: 'tri', combo: 'pi' }] },
  { card: 'V01', paths: [{ id: 'arrow', combo: 'vec' }] },
  { card: 'V02', paths: [{ id: 'grid', combo: 'mat' }] },
  { card: 'C01', paths: [{ id: 'toward', combo: 'lim' }] },
  { card: 'N08', paths: [{ id: 'series', combo: 'e' }] },
  { card: 'C02', paths: [{ id: 'slope', combo: 'ddx' }] },
  { card: 'C03', paths: [{ id: 'area', combo: 'int' }] },
];
