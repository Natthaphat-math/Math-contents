// Questions the game asks, like `2, +, ? : 5`. A question is only served
// when its answer card is already owned, and questions are gated so the
// inverses arrive in order: − before ÷ before log before √.
import { CARDS } from '../../data/cards.js';
import { Q, add, mul, pow, succ, compare, equals, isNatural, toFloat } from './values.js';

const NUMBER_ID = new Map(); // natural number → card id
for (const c of CARDS) if (c.kind === 'number' && isNatural(c.value)) NUMBER_ID.set(Number(c.value.n), c.id);

const ownedNaturals = (owns) => [...NUMBER_ID].filter(([, id]) => owns(id)).map(([n]) => n).sort((a, b) => a - b);

function triples(owns, op, min, f) {
  const nums = ownedNaturals(owns), have = new Set(nums), out = [];
  for (const a of nums) for (const b of nums) {
    if (a < min || b < min) continue;
    const c = f(a, b);
    if (have.has(c)) out.push([a, b, c]);
  }
  return out;
}

export const QUESTION_KINDS = [
  {
    kind: 'add-blank', until: 'O02', needs: ['O01'], op: 'O01', minOptions: 2,
    options: (owns) => triples(owns, '+', 1, (a, b) => a + b),
    apply: (a, x) => add(a, x),
  },
  {
    kind: 'mul-blank', until: 'O04', needs: ['O03', 'O02'], op: 'O03', minOptions: 2,
    options: (owns) => triples(owns, '×', 2, (a, b) => a * b),
    apply: (a, x) => mul(a, x),
  },
  {
    kind: 'pow-blank', until: 'A04', needs: ['O06', 'O04'], op: 'O06', minOptions: 1,
    options: (owns) => triples(owns, 'aᵇ', 2, (a, b) => a ** b),
    apply: (a, x) => pow(a, x),
  },
  {
    kind: 'succ-blank', until: 'A03', needs: ['A08', 'A02'], minOptions: 1,
    options: (owns) => ownedNaturals(owns).filter((c) => c >= 2 && ownedNaturals(owns).includes(c - 1)).map((c) => [null, c - 1, c]),
    apply: (_, x) => succ(x),
  },
  { kind: 'squeeze', until: 'S06', needs: ['O06', 'S18', 'N02', 'N12'], minOptions: 1, options: () => [[null, null, 2]] },
];
const KIND = Object.fromEntries(QUESTION_KINDS.map((k) => [k.kind, k]));

// The next question to offer, or null. `seed` varies the numbers.
export function nextQuestion(owns, seed, last) {
  for (const def of QUESTION_KINDS) {
    if (owns(def.until) || !def.needs.every(owns)) continue;
    let opts = def.options(owns);
    if (opts.length < def.minOptions) continue;
    if (opts.length > 1 && last) opts = opts.filter((o) => o.join() !== last);
    const [a, answer, c] = opts[Math.abs(seed * 7 + 3) % opts.length];
    return build(def, a, answer, c);
  }
  return null;
}

function build(def, a, answer, c) {
  const id = (n) => NUMBER_ID.get(n);
  const blank = { blank: true };
  let tokens;
  if (def.kind === 'succ-blank') tokens = [{ id: 'A08' }, blank];
  else if (def.kind === 'squeeze') tokens = [blank, { id: 'O06' }, { id: 'N12' }];
  else tokens = [{ id: id(a) }, { id: def.op }, blank];
  return { kind: def.kind, tokens, target: id(c), a, answer, key: [a, answer, c].join() };
}

// Check an answer. Returns { correct, dir: 'small' | 'big', value }.
export function checkAnswer(q, value) {
  const target = Q(q.kind === 'squeeze' ? 2 : targetOf(q));
  const got = q.kind === 'squeeze' ? mul(value, value) : KIND[q.kind].apply(q.a === null ? null : Q(q.a), value);
  if (equals(got, target)) return { correct: true, value: got };
  return { correct: false, dir: compare(got, target) < 0 ? 'small' : 'big', value: got };
}
const targetOf = (q) => Number(q.key.split(',')[2]);

// The squeeze: halve the gap between a too-small and a too-big guess.
export function squeezeStep(lo, hi) {
  const mid = mul(add(lo, hi), Q(1, 2));
  const sq = mul(mid, mid);
  return { mid, square: sq, dir: compare(sq, Q(2)) < 0 ? 'small' : 'big', approx: toFloat(mid) };
}
export const SQUEEZE_STEPS = 6;
