// Works out what a valid play means.
//
// Outcome:
//   { shape, label, status, value?, show?, cardId?, text, note?, stuckIn?,
//     relation?, combo?, tree?, input?, applied? }
// status: 'ok'        a result or transmute
//         'relation'  a comparison or concept pairing (no single value)
//         'stuck'     the answer lives in a number system not unlocked yet
//         'undefined' no answer in any system ("no theorem yet")
import { CARD, CARDS } from '../../data/cards.js';
import {
  Q, SET, SYS, BOOL, Undefined, key, format, decimalText, system, SYSTEM_ORDER, SYSTEM_SYMBOL,
  add, sub, mul, div, pow, sqrt, logb, absval, factorial, succ, percent, neg, equals, compare,
  isNumeric, isReal, isZero, setToNumber, vonNeumann, isElement, isSubset, isNatural,
} from './values.js';
import { cardOf, isFunction, containsBlank, transmuteOf } from './grammar.js';

class Stuck { constructor(sys) { this.sys = sys; } }

const VALUE_TO_CARD = new Map();
for (const c of CARDS) if (c.value) VALUE_TO_CARD.set(key(c.value), c.id);
export const cardForValue = (v) => (v ? VALUE_TO_CARD.get(key(v)) ?? null : null);

export function tokenValue(t) {
  if (t.temp !== undefined) return t.temp;
  const c = cardOf(t);
  if (c?.kind === 'infinity') throw new Undefined('infinity');
  if (!c?.value) throw new Undefined('notNumber');
  return c.value;
}

export function tokenText(t) {
  if (t.blank) return '?';
  if (t.temp !== undefined) return valueText(t.temp, t.show);
  return cardOf(t).symbol;
}
export const valueText = (v, show) => (show === 'decimal' ? decimalText(v) : format(v));
export const playText = (tokens) => tokens.map(tokenText).join(', ');

// ℕ is always the working world; ℤ ℚ ℝ ℂ must be unlocked. A value is fine if
// any unlocked system contains it (−2 is fine once ℚ is unlocked).
const rank = (s) => SYSTEM_ORDER.indexOf(s);
export const topSystem = (systems) => SYSTEM_ORDER.filter((s) => systems.has(s)).at(-1);
function check(v, env) {
  const s = system(v);
  if (s && rank(s) > rank(topSystem(env.systems))) throw new Stuck(s);
  return v;
}

function unary(op, a) {
  switch (op) {
    case '√': return sqrt(a);
    case '|x|': return absval(a);
    case 'n!': return factorial(a);
    case '%': return percent(a);
    case 'S': return succ(a);
    default: throw new Undefined('notNumber');
  }
}

function binary(op, l, r) {
  switch (op) {
    case '+': return add(l, r);
    case '−': return sub(l, r);
    case '×': return mul(l, r);
    case '÷': return div(l, r);
    case 'aᵇ': return pow(l, r);
    case 'log': return logb(l, r);
    case '=':
      if (isReal(l) && isReal(r)) return BOOL(compare(l, r) === 0);
      return BOOL(equals(l, r));
    default: throw new Undefined('notNumber');
  }
}

export function evalTree(node, env, blankValue) {
  if (node.t === 'atom') {
    if (node.tok.blank) return blankValue;
    return tokenValue(node.tok);
  }
  if (node.t === 'un') return check(unary(node.op, evalTree(node.a, env, blankValue)), env);
  return check(binary(node.op, evalTree(node.l, env, blankValue), evalTree(node.r, env, blankValue)), env);
}

// Solve `side = target` for the one blank inside `side`.
function solveFor(node, target, env) {
  check(target, env);
  if (node.t === 'atom') return target;
  if (node.t === 'un') {
    switch (node.op) {
      case 'S': return solveFor(node.a, sub(target, Q(1)), env);
      case '√':
        if (isReal(target) && compare(target, Q(0)) < 0) throw new Undefined('noSolution');
        return solveFor(node.a, pow(target, Q(2)), env);
      case '|x|':
        if (isReal(target) && compare(target, Q(0)) < 0) throw new Undefined('noSolution');
        return solveFor(node.a, target, env);
      case '%': return solveFor(node.a, mul(target, Q(100)), env);
      case 'n!':
        for (let n = 0; n <= 20; n++) if (equals(factorial(Q(n)), target)) return solveFor(node.a, Q(n), env);
        throw new Undefined('noSolution');
      default: throw new Undefined('noSolution');
    }
  }
  const blankLeft = containsBlank(node.l);
  const known = evalTree(blankLeft ? node.r : node.l, env);
  const side = blankLeft ? node.l : node.r;
  switch (node.op) {
    case '+': return solveFor(side, sub(target, known), env);
    case '−': return solveFor(side, blankLeft ? add(target, known) : sub(known, target), env);
    case '×':
      if (isZero(known)) throw new Undefined(isZero(target) ? 'anySolution' : 'noSolution');
      return solveFor(side, div(target, known), env);
    case '÷':
      if (blankLeft) return solveFor(side, mul(target, known), env);
      if (isZero(target)) throw new Undefined('noSolution');
      return solveFor(side, div(known, target), env);
    case 'aᵇ':
      if (blankLeft) {
        if (isZero(known)) throw new Undefined('noSolution');
        return solveFor(side, pow(target, div(Q(1), known)), env);
      }
      return solveFor(side, logb(known, target), env);
    case 'log':
      if (blankLeft) return solveFor(side, pow(target, div(Q(1), known)), env);
      return solveFor(side, pow(known, target), env);
    default: throw new Undefined('noSolution');
  }
}

const UNDEFINED_NOTES = {
  div0: 'No theorem yet. No number times 0 gives this. Watch what 1 ÷ n does as n grows: one day that will be a limit.',
  div0Lim: 'Still no value. But as n shrinks toward 0, 1 ÷ n grows past every number: its limit is ∞.',
  notNumber: 'These aren’t numbers you can calculate with. A transmute might turn them into some.',
  infinity: '∞ isn’t a number to calculate with. It’s where counting never stops.',
  logBase: 'No theorem yet: a logarithm needs a positive base that isn’t 1.',
  logDomain: 'No theorem yet: a logarithm needs a positive number.',
  factDomain: 'n! counts ways to arrange n things, so it needs a natural number.',
  huge: 'Too big to work with exactly here.',
  overflow: 'Too big to work with.',
  complexPower: 'No theorem yet: complex powers need more machinery.',
  noSolution: 'No value of ? makes this true.',
  anySolution: 'Every value of ? makes this true.',
  infiniteSet: 'An infinite set has no finite size.',
};

function stuckNote(env) {
  const world = SYSTEM_SYMBOL[topSystem(env.systems)];
  return `No number in ${world} answers this. It needs somewhere bigger to live.`;
}

// Evaluate a classified play. env: { systems: Set of unlocked systems, owns(id) }
export function evaluate(tokens, cls, env) {
  const base = { shape: cls.shape, label: cls.label, tokens, tree: cls.tree };
  const text = playText(tokens);
  try {
    return { ...base, ...compute(tokens, cls, env, text) };
  } catch (e) {
    if (e instanceof Stuck) {
      return { ...base, status: 'stuck', stuckIn: e.sys, text: `${text} : stuck in ${SYSTEM_SYMBOL[topSystem(env.systems)]}`, note: stuckNote(env) };
    }
    if (e instanceof Undefined) {
      const why = e.why === 'div0' && env.owns('C01') ? 'div0Lim' : e.why;
      return { ...base, status: 'undefined', text: `${text} : no theorem yet`, note: UNDEFINED_NOTES[why] ?? UNDEFINED_NOTES.notNumber, why: e.why };
    }
    throw e;
  }
}

function ok(value, text, extra = {}) {
  const cardId = cardForValue(value);
  const shown = cardId && !extra.show ? CARD[cardId].symbol : valueText(value, extra.show);
  return { status: 'ok', value, cardId, text: `${text} : ${shown}`, ...extra };
}

function compute(tokens, cls, env, text) {
  switch (cls.shape) {
    case 'transmute': {
      const t = tokens[0], rule = transmuteOf(t);
      const input = t.temp !== undefined ? t.temp : cardOf(t).value;
      const arrow = (out) => `${text} ⇒ ${out}`;
      if (rule.to) {
        const target = CARD[rule.to];
        return { status: 'ok', value: target.value ?? null, cardId: rule.to, text: arrow(target.symbol), input };
      }
      if (rule.rule === 'count') {
        const v = Q(setToNumber(input));
        return { status: 'ok', value: v, cardId: cardForValue(v), text: arrow(format(v)), input,
          note: t.temp !== undefined ? 'Counted: this set has as many elements as the number it stands for.' : undefined };
      }
      if (rule.show) {
        const show = rule.show === 'decimal' ? 'decimal' : 'fraction';
        return { status: 'ok', value: input, cardId: null, show, text: arrow(valueText(input, show)), input,
          note: 'The same number, written another way.' };
      }
      throw new Undefined('notNumber');
    }

    case 'evaluate': {
      const value = evalTree(cls.tree, env);
      const extra = {};
      if (cls.tree.t === 'un' && cls.tree.a.t === 'atom') {
        extra.applied = { input: key(tokenValue(cls.tree.a.tok)), op: cls.tree.op };
      }
      if (value.k === 'bool') {
        return { status: 'ok', value, cardId: null, text: `${text} : ${value.b ? 'true ✓' : 'false'}`, ...extra };
      }
      return ok(value, text, extra);
    }

    case 'solve': {
      const tree = cls.tree;
      const blankLeft = containsBlank(tree.l);
      const target = evalTree(blankLeft ? tree.r : tree.l, env);
      const x = solveFor(blankLeft ? tree.l : tree.r, target, env);
      const id = cardForValue(x);
      return { status: 'ok', value: x, cardId: id, text: `${text} : ? = ${id ? CARD[id].symbol : format(x)}` };
    }

    case 'wrap': {
      const other = tokens.find((t) => cardOf(t)?.kind !== 'braces');
      const value = SET([tokenValue(other)]);
      return ok(value, text);
    }

    case 'apply': {
      const other = tokens.find((t) => !isFunction(t));
      const input = tokenValue(other);
      const value = check(succ(input), env);
      if (input.k === 'sys') {
        return { status: 'ok', value, cardId: cardForValue(value), input, text: `${text} : ${format(value)}`,
          note: `S always finds a next one, so ${format(input)} has no last element.` };
      }
      const extra = { input, applied: { input: key(input), op: 'S' } };
      if (input.k === 'set') extra.note = `S(n) = n ∪ {n}: the set gains itself as a new element.`;
      const out = ok(value, text, extra);
      if (isNatural(value) && !out.cardId) out.keepGoing = true;
      return out;
    }

    case 'iterate':
      return { status: 'ok', value: SYS('N'), cardId: cardForValue(SYS('N')), text: `${text} : ℕ`,
        note: '0, S(0), S(S(0)), … every number S can reach, all together.' };

    case 'compare': return compareValues(tokens, text);

    case 'opPair':
      return { status: 'relation', relation: cls.pair.relation, text: `${text} : ${cls.pair.note}`, note: cls.pair.note };

    case 'combo':
      return { status: 'relation', relation: cls.combo.relation ?? 'combo', combo: cls.combo.id, text, note: cls.combo.note };

    default: throw new Undefined('notNumber');
  }
}

function compareValues(tokens, text) {
  const [a, b] = tokens.map(tokenValue);
  const [ta, tb] = tokens.map(tokenText);
  const rel = (relation, shown, note) => ({ status: 'relation', relation, text: shown, note });

  const asSet = (v) => (isNatural(v) && v.n <= 12n ? vonNeumann(Number(v.n)) : v);
  if (equals(a, b) || (a.k !== b.k && equals(asSet(a), asSet(b)))) {
    return rel('equal', `${ta} = ${tb}`, a.k !== b.k ? 'The same thing, written two ways.' : 'Equal.');
  }
  if (isNumeric(a) && isNumeric(b)) {
    if (!isZero(a) && equals(neg(a), b)) {
      return rel('opposites', `${ta} and ${tb} : opposites`, 'Mirror images across 0: the same distance from 0, on opposite sides.');
    }
    if (isReal(a) && isReal(b)) {
      const c = compare(a, b);
      return rel('order', c < 0 ? `${ta} < ${tb}` : `${ta} > ${tb}`, 'One is further along the number line.');
    }
    return rel('different', `${ta} ≠ ${tb}`, 'Different numbers.');
  }
  if (isElement(a, b)) return rel('in', `${ta} ∈ ${tb}`, `${ta} is one of the things inside ${tb}.`);
  if (isElement(b, a)) return rel('in', `${tb} ∈ ${ta}`, `${tb} is one of the things inside ${ta}.`);
  if (isSubset(a, b)) return rel('subset', `${ta} ⊆ ${tb}`, `Everything in ${ta} is also in ${tb}.`);
  if (isSubset(b, a)) return rel('subset', `${tb} ⊆ ${ta}`, `Everything in ${tb} is also in ${ta}.`);
  return rel('different', `${ta} ≠ ${tb}`, 'Nothing in common yet.');
}
