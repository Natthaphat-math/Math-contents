// Named trigger matchers. Each takes (path, ctx, cardId) and says whether a
// play matches. ctx: { tokens, outcome, prevTransmuteOut, sameInputMax }.
// A pattern is one idea, so it counts as one path however many numbers fit.
import { CARD } from '../../data/cards.js';
import { isNumeric, isInt, key } from './values.js';

const okPlay = (o) => o.status === 'ok';

// Tokens that alternate number, op, number, op, number…
function chainOf(tokens) {
  if (tokens.length < 3 || tokens.length % 2 === 0) return null;
  const values = [], ops = [];
  for (let i = 0; i < tokens.length; i++) {
    const c = tokens[i].id ? CARD[tokens[i].id] : null;
    if (!c) return null;
    if (i % 2 === 0) { if (c.kind !== 'number') return null; values.push(c); }
    else { if (c.kind !== 'binop') return null; ops.push(c.op); }
  }
  return { values, ops };
}

export const PATTERNS = {
  produces: (path, { outcome }, cardId) => okPlay(outcome) && outcome.cardId === cardId,

  setForm: (path, { tokens, outcome }) =>
    outcome.shape === 'transmute' && okPlay(outcome) && tokens[0].temp !== undefined &&
    isInt(outcome.value) && outcome.value.n === BigInt(path.n),

  firstEvaluate: (path, { outcome }) =>
    outcome.shape === 'evaluate' && okPlay(outcome) && isNumeric(outcome.value),

  relation: (path, { outcome }) => outcome.relation === path.rel,

  applyToSet: (path, { outcome }) => outcome.shape === 'apply' && okPlay(outcome) && outcome.input?.k === 'set',

  transmuteChain: (path, { tokens, outcome, prevTransmuteOut }) =>
    outcome.shape === 'transmute' && okPlay(outcome) && !!prevTransmuteOut && tokens[0].id === prevTransmuteOut,

  repeat: (path, { tokens, outcome }) => {
    if (outcome.shape !== 'evaluate' || !okPlay(outcome)) return false;
    const ch = chainOf(tokens);
    return !!ch && ch.values.length >= path.min && ch.ops.every((o) => o === path.op) &&
      ch.values.every((c) => c.id === ch.values[0].id);
  },

  consecutive: (path, { tokens, outcome }) => {
    if (outcome.shape !== 'evaluate' || !okPlay(outcome)) return false;
    const ch = chainOf(tokens);
    if (!ch || ch.values.length < 3 || !ch.ops.every((o) => o === '×')) return false;
    const nums = ch.values.map((c) => key(c.value)).sort();
    const want = ch.values.map((_, i) => key(CARD[['N02', 'N12', 'N13', 'N14', 'N15'][i]].value)).sort();
    return nums.join() === want.join();
  },

  solved: (path, { outcome }) => outcome.shape === 'solve' && okPlay(outcome),

  inversePair: (path, { outcome }) => outcome.relation === 'inverse',

  halfPower: (path, { outcome }) => {
    const t = outcome.tree;
    return outcome.shape === 'evaluate' && okPlay(outcome) && t?.t === 'bin' && t.op === 'aᵇ' &&
      t.r.t === 'atom' && t.r.tok.id === 'N04';
  },

  divBy100: (path, { outcome }) => {
    const t = outcome.tree;
    return outcome.shape === 'evaluate' && okPlay(outcome) && t?.t === 'bin' && t.op === '÷' &&
      t.r.t === 'atom' && t.r.tok.id === 'N21';
  },

  sameInput: (path, { sameInputMax }) => sameInputMax >= path.count,
};
