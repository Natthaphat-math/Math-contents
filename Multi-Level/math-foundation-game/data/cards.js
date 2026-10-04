// Every card in the game.
//
// id        stable code, shared with cards/cards.json
// name      the card name; must match its design in cards/cards.json
// title     display name when it differs from name
// kind      number · binop · prefix · postfix · function · set · braces ·
//           system · infinity · concept
// op        for operator kinds: which operation the card performs
// value     for number / set / system cards
// transmute what the card becomes when played alone (⇒)
// star      MVP priority from the card list
// m1        playable in milestone 1 (others show as locked "?")
import { Q, R, C, SET, SYS } from '../src/engine/values.js';

const EMPTY = SET([]);

const n = (id, symbol, name, value, extra = {}) =>
  ({ id, symbol, name, category: 'numbers', kind: 'number', value, m1: true, ...extra });
const op = (id, symbol, name, kind, opName, extra = {}) =>
  ({ id, symbol, name, category: 'operations', kind, op: opName, m1: true, ...extra });
const card = (id, symbol, name, category, kind, extra = {}) =>
  ({ id, symbol, name, category, kind, m1: true, ...extra });
const later = (id, symbol, name, category) =>
  ({ id, symbol, name, category, kind: 'concept', m1: false });

export const CARDS = [
  // Numbers
  n('N01', '0', 'Zero', Q(0)),
  n('N02', '1', 'One', Q(1)),
  n('N12', '2', 'Two', Q(2), { tagline: 'One more than one.' }),
  n('N13', '3', 'Three', Q(3), { tagline: 'S(2): the next one after two.' }),
  n('N14', '4', 'Four', Q(4), { tagline: '2 + 2, and 2 × 2, and 2².' }),
  n('N15', '5', 'Five', Q(5), { tagline: 'The fingers on one hand.' }),
  n('N16', '6', 'Six', Q(6), { tagline: '1 × 2 × 3 = 1 + 2 + 3.' }),
  n('N17', '7', 'Seven', Q(7), { tagline: 'A prime: only 1 × 7 makes it.' }),
  n('N18', '8', 'Eight', Q(8), { tagline: '2 × 2 × 2 = 2³.' }),
  n('N19', '9', 'Nine', Q(9), { tagline: '3 × 3 = 3².' }),
  n('N20', '10', 'Ten', Q(10), { tagline: 'The base of our digits.' }),
  n('N21', '100', 'One Hundred', Q(100), { tagline: '10 × 10: what per-cent is out of.' }),
  n('N03', '−1', 'Negative One', Q(-1), { star: true }),
  n('N04', '½', 'One Half', Q(1, 2), { star: true, transmute: { show: 'decimal' } }),
  n('N05', '0.3̇', 'Repeating Decimal', Q(1, 3), { star: true, transmute: { show: 'fraction' } }),
  n('N06', '√2', 'Root Two', R(Math.SQRT2, '√2'), { star: true }),
  n('N07', 'π', 'Pi', R(Math.PI, 'π'), { star: true }),
  n('N08', 'e', 'Eulers Number', R(Math.E, 'e'), { title: 'Euler’s Number', star: true }),
  n('N09', 'i', 'Imaginary Unit', C(0, 1)),
  card('N10', '∞', 'Infinity', 'numbers', 'infinity'),
  card('N11', '%', 'Percent', 'numbers', 'postfix', { op: '%' }),

  // Operations
  op('O01', '+', 'Addition', 'binop', '+', { star: true }),
  op('O02', '−', 'Subtraction', 'binop', '−', { star: true }),
  op('O03', '×', 'Multiplication', 'binop', '×', { star: true }),
  op('O04', '÷', 'Division', 'binop', '÷', { star: true }),
  op('O05', '=', 'Equals', 'binop', '='),
  op('O06', 'aᵇ', 'Exponent', 'binop', 'aᵇ', { star: true }),
  op('O07', '√', 'Square Root', 'prefix', '√'),
  op('O08', '|x|', 'Absolute Value', 'prefix', '|x|'),
  op('O09', 'n!', 'Factorial', 'postfix', 'n!'),

  // Sets & Logic
  card('S14', '{}', 'Empty Braces', 'sets', 'braces', { start: true, transmute: { to: 'S01' }, tagline: 'Braces with nothing inside.' }),
  card('S01', '∅', 'The Empty Set', 'sets', 'set', { value: EMPTY, transmute: { rule: 'count' } }),
  card('S15', '{∅}', 'Set of Empty Set', 'sets', 'set', { value: SET([EMPTY]), transmute: { rule: 'count' }, tagline: 'A set holding one thing: nothing.' }),
  card('S16', 'ℕ', 'Natural Numbers', 'sets', 'system', { value: SYS('N'), tagline: '0, 1, 2, 3, … counting forever.' }),
  card('S17', 'ℤ', 'Integers', 'sets', 'system', { value: SYS('Z'), tagline: 'The naturals and their opposites.' }),
  card('S18', 'ℚ', 'Rational Numbers', 'sets', 'system', { value: SYS('Q'), tagline: 'Every fraction a ⁄ b.' }),
  card('S06', 'ℝ', 'Real Numbers', 'sets', 'system', { value: SYS('R') }),
  card('S07', 'ℂ', 'Complex Numbers', 'sets', 'system', { value: SYS('C') }),
  card('S02', '∈', 'Element Of', 'sets', 'concept'),
  card('S03', '∪', 'Union', 'sets', 'concept'),
  card('S10', '→', 'Implication', 'sets', 'concept'),
  later('S04', '∩', 'Intersection', 'sets'),
  later('S05', '⊆', 'Subset', 'sets'),
  later('S08', '∧', 'And', 'sets'),
  later('S09', '∨', 'Or', 'sets'),
  later('S11', '↔', 'If and Only If', 'sets'),
  later('S12', '∀', 'For All', 'sets'),
  later('S13', '∃', 'There Exists', 'sets'),

  // Algebra & Functions
  card('A08', 'S(n)', 'Successor', 'algebra', 'function', { op: 'S', tagline: 'The next one: n ∪ {n}.' }),
  card('A01', 'x', 'Variable', 'algebra', 'concept'),
  card('A02', 'f(x)', 'Function', 'algebra', 'concept', { star: true }),
  card('A03', 'f⁻¹', 'Inverse Function', 'algebra', 'concept'),
  card('A04', 'log', 'Logarithm', 'algebra', 'binop', { op: 'log', star: true }),
  card('A06', 'Σ', 'Summation', 'algebra', 'concept'),
  card('A07', 'aₙ', 'Sequence', 'algebra', 'concept'),
  later('A05', 'ax²+bx+c', 'Quadratic', 'algebra'),

  // Geometry & Trig
  card('G01', '△', 'Triangle', 'geometry', 'concept', { transmute: { to: 'G02' } }),
  card('G02', 'θ', 'Angle', 'geometry', 'concept'),
  card('G08', 'rad', 'Radian', 'geometry', 'concept'),
  later('G03', 'a²+b²=c²', 'Pythagoras', 'geometry'),
  later('G04', 'sin', 'Sine', 'geometry'),
  later('G05', 'cos', 'Cosine', 'geometry'),
  later('G06', 'tan', 'Tangent', 'geometry'),
  later('G07', '⊥ ∥', 'Two Lines', 'geometry'),

  // Vectors & Matrices
  card('V01', 'v⃗', 'Vector', 'vectors', 'concept'),
  card('V02', '[ ]', 'Matrix', 'vectors', 'concept', { star: true }),
  later('V03', 'det', 'Determinant', 'vectors'),

  // Calculus
  card('C01', 'lim', 'Limit', 'calculus', 'concept', { tagline: 'Where a sequence is heading.' }),
  card('C02', 'd/dx', 'Derivative', 'calculus', 'concept', { star: true, tagline: 'The slope at a single point.' }),
  card('C03', '∫', 'Integral', 'calculus', 'concept', { star: true, tagline: 'The area under a curve.' }),

  // Probability & Statistics
  later('P01', 'P(A)', 'Probability', 'probability'),
  later('P02', 'ⁿCᵣ', 'Combinations', 'probability'),
  later('P03', 'x̄', 'Mean', 'probability'),
  later('P04', 'σ', 'Standard Deviation', 'probability'),
];

export const CARD = Object.fromEntries(CARDS.map((c) => [c.id, c]));
export const BY_SYMBOL = Object.fromEntries(CARDS.map((c) => [c.symbol, c.id]));

// Which card unlocks which number system (ℕ is always the working world).
export const SYSTEM_CARD = { N: 'S16', Z: 'S17', Q: 'S18', R: 'S06', C: 'S07' };
