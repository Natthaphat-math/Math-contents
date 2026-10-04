// Decides whether the cards in the play area form a valid play, and which
// button label it gets. The label depends only on the SHAPE of the play,
// never on its answer, so the button cannot give answers away.
//
// A token is { id } for a card, { temp: value, show? } for a temporary
// result card, or { blank: true } for a "?".
import { CARD } from '../../data/cards.js';
import { COMBOS, OPERATOR_PAIRS } from '../../data/combos.js';
import { parseNotation } from './notation.js';
import { setToNumber } from './values.js';

export const MAX_CARDS = 5;

const OPERATOR_KINDS = new Set(['binop', 'prefix', 'postfix']);
const VALUE_KINDS = new Set(['number', 'set', 'system']);
const ATOM_KINDS = new Set(['number', 'set', 'system', 'infinity']);

export const cardOf = (t) => (t && t.id ? CARD[t.id] : null);
export const isOperator = (t) => OPERATOR_KINDS.has(cardOf(t)?.kind);
export const isFunction = (t) => cardOf(t)?.kind === 'function';
export const isValue = (t) => !!t && (t.temp !== undefined || VALUE_KINDS.has(cardOf(t)?.kind));
const opOf = (t) => cardOf(t)?.op ?? null;

// ---- expressions ------------------------------------------------------------
//   eq    := sum ('=' sum)?
//   sum   := prod (('+' | '−') prod)*
//   prod  := power (('×' | '÷') power)*
//   power := unary (('aᵇ' | 'log') power)?        right-associative
//   unary := ('√' | '|x|' | S(n)) unary | post
//   post  := atom ('n!' | '%' | S(n))*
//   atom  := number | set | system | ∞ | temp | ?
const FAIL = Symbol('fail');

export function parseExpr(tokens) {
  let i = 0;
  const kindAt = (j) => {
    const t = tokens[j];
    if (!t) return null;
    if (t.blank) return 'blank';
    if (t.temp !== undefined) return 'temp';
    return cardOf(t)?.kind ?? null;
  };
  const atom = () => {
    const k = kindAt(i);
    if (ATOM_KINDS.has(k) || k === 'temp' || k === 'blank') return { t: 'atom', tok: tokens[i++] };
    throw FAIL;
  };
  const post = () => {
    let node = atom();
    while (kindAt(i) === 'postfix' || kindAt(i) === 'function') {
      const tok = tokens[i++];
      node = { t: 'un', op: opOf(tok), a: node, tok };
    }
    return node;
  };
  const unary = () => {
    const k = kindAt(i);
    if (k === 'prefix' || k === 'function') {
      const tok = tokens[i++];
      return { t: 'un', op: opOf(tok), a: unary(), tok };
    }
    return post();
  };
  const power = () => {
    const l = unary();
    const op = opOf(tokens[i]);
    if (op === 'aᵇ' || op === 'log') {
      const tok = tokens[i++];
      return { t: 'bin', op, l, r: power(), tok };
    }
    return l;
  };
  const chain = (next, ops) => {
    let l = next();
    while (ops.includes(opOf(tokens[i]))) {
      const tok = tokens[i++];
      l = { t: 'bin', op: tok && opOf(tok), l, r: next(), tok };
    }
    return l;
  };
  const sum = () => chain(() => chain(power, ['×', '÷']), ['+', '−']);
  const eq = () => {
    const l = sum();
    if (opOf(tokens[i]) === '=') {
      const tok = tokens[i++];
      return { t: 'bin', op: '=', l, r: sum(), tok };
    }
    return l;
  };
  try {
    const tree = eq();
    return i === tokens.length ? tree : null;
  } catch (e) {
    if (e === FAIL) return null;
    throw e;
  }
}

export function containsBlank(node) {
  if (!node) return false;
  if (node.t === 'atom') return !!node.tok.blank;
  if (node.t === 'un') return containsBlank(node.a);
  return containsBlank(node.l) || containsBlank(node.r);
}

// ---- concept pairings and operator pairs ------------------------------------

const PARSED_COMBOS = COMBOS.map((c) => ({ ...c, ids: parseNotation(c.play).ids }));

export function matchCombo(tokens) {
  if (tokens.some((t) => !t.id)) return null;
  for (const combo of PARSED_COMBOS) {
    if (combo.ids.length !== tokens.length) continue;
    const left = tokens.map((t) => t.id);
    let ok = true;
    for (const need of combo.ids.filter((x) => x !== '#num')) {
      const at = left.indexOf(need);
      if (at < 0) { ok = false; break; }
      left.splice(at, 1);
    }
    if (ok && left.every((id) => CARD[id].kind === 'number')) return combo;
  }
  return null;
}

export function matchOperatorPair(tokens) {
  const ops = tokens.map(opOf).sort();
  return OPERATOR_PAIRS.find((p) => [...p.ops].sort().join() === ops.join()) ?? null;
}

// What a single token becomes when transmuted, or null.
export function transmuteOf(t) {
  if (t.temp !== undefined) return t.temp.k === 'set' && setToNumber(t.temp) !== null ? { rule: 'count' } : null;
  const c = cardOf(t);
  if (!c?.transmute) return null;
  if (c.transmute.rule === 'count' && setToNumber(c.value) === null) return null;
  return c.transmute;
}

// ---- classification ---------------------------------------------------------

export function classify(tokens) {
  const n = tokens.length;
  if (n === 0 || n > MAX_CARDS) return null;

  const blanks = tokens.filter((t) => t.blank).length;
  if (blanks) {
    if (blanks !== 1) return null;
    const tree = parseExpr(tokens);
    if (tree && tree.t === 'bin' && tree.op === '=' && containsBlank(tree)) return { shape: 'solve', label: 'Solve', tree };
    return null;
  }

  const combo = matchCombo(tokens);
  if (combo) return { shape: 'combo', label: tokens.some(isOperator) ? 'Evaluate' : 'Combine', combo };

  if (n === 1) return transmuteOf(tokens[0]) ? { shape: 'transmute', label: 'Transmute' } : null;

  if (tokens.some(isOperator)) {
    if (n === 2 && tokens.every((t) => isOperator(t) || isFunction(t))) {
      const pair = matchOperatorPair(tokens);
      return pair ? { shape: 'opPair', label: 'Combine', pair } : null;
    }
    const tree = parseExpr(tokens);
    return tree ? { shape: 'evaluate', label: 'Evaluate', tree } : null;
  }

  if (n !== 2) return null;
  const [a, b] = tokens;
  const braces = tokens.find((t) => cardOf(t)?.kind === 'braces');
  if (braces) {
    const other = a === braces ? b : a;
    return isValue(other) ? { shape: 'wrap', label: 'Combine' } : null;
  }
  if (isFunction(a) && isFunction(b)) return { shape: 'iterate', label: 'Combine' };
  const fn = isFunction(a) ? a : isFunction(b) ? b : null;
  if (fn) return isValue(fn === a ? b : a) ? { shape: 'apply', label: 'Combine' } : null;
  if (isValue(a) && isValue(b)) return { shape: 'compare', label: 'Combine' };
  return null;
}
