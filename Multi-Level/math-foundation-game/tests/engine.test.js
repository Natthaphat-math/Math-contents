import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, CARD, BY_SYMBOL } from '../data/cards.js';
import { PATHS } from '../data/paths.js';
import { COMBOS } from '../data/combos.js';
import { parseNotation } from '../src/engine/notation.js';
import { classify } from '../src/engine/grammar.js';
import { evaluate, valueText } from '../src/engine/evaluate.js';
import { Game } from '../src/engine/game.js';
import { PATTERNS } from '../src/engine/patterns.js';
import { Q, format, decimalText, pow, logb, sqrt, factorial, key } from '../src/engine/values.js';

const tok = (text) => text.split(',').map((s) => s.trim()).map((sym) => {
  if (sym === '?') return { blank: true };
  assert.ok(BY_SYMBOL[sym], `unknown symbol ${sym}`);
  return { id: BY_SYMBOL[sym] };
});
const ALL = { systems: new Set(['N', 'Z', 'Q', 'R', 'C']), owns: () => true };
const ONLY_N = { systems: new Set(['N']), owns: () => false };
const run = (text, env = ALL) => { const t = tok(text); const c = classify(t); return c && evaluate(t, c, env); };

test('card data is consistent', () => {
  const ids = new Set(), symbols = new Set();
  for (const c of CARDS) {
    assert.ok(!ids.has(c.id), `duplicate id ${c.id}`); ids.add(c.id);
    assert.ok(!symbols.has(c.symbol), `duplicate symbol ${c.symbol}`); symbols.add(c.symbol);
    assert.match(c.id, /^[NOSAGVCP]\d\d$/);
  }
  assert.equal(CARDS.filter((c) => c.m1).length, 56);
});

test('every path references real cards and valid triggers', () => {
  const combos = new Set(COMBOS.map((c) => c.id));
  for (const entry of PATHS) {
    assert.ok(CARD[entry.card], entry.card);
    for (const a of entry.also ?? []) assert.ok(CARD[a], a);
    for (const p of entry.paths) {
      if (p.play) parseNotation(p.play);
      if (p.own) assert.ok(CARD[p.own], p.own);
      if (p.pattern) assert.ok(PATTERNS[p.pattern], p.pattern);
      if (p.combo) assert.ok(combos.has(p.combo), p.combo);
    }
  }
  for (const c of COMBOS) parseNotation(c.play);
});

test('every exact recipe produces the result it states', () => {
  for (const entry of PATHS) for (const p of entry.paths) {
    if (!p.play) continue;
    const { ids, result } = parseNotation(p.play);
    const tokens = ids.map((id) => ({ id }));
    const cls = classify(tokens);
    assert.ok(cls, `no button for ${p.play}`);
    const o = evaluate(tokens, cls, ALL);
    assert.equal(o.status, 'ok', `${p.play}: ${o.status} ${o.note ?? ''}`);
    if (result) {
      const shown = o.cardId ? CARD[o.cardId].symbol : valueText(o.value, o.show);
      assert.equal(shown, result, p.play);
    }
  }
});

test('button labels depend on shape, not answer', () => {
  const label = (t) => classify(tok(t))?.label ?? null;
  assert.equal(label('{}'), 'Transmute');
  assert.equal(label('∅'), 'Transmute');
  assert.equal(label('2'), null);
  assert.equal(label('1, +, 1'), 'Evaluate');
  assert.equal(label('3, −, 5'), 'Evaluate');   // stuck plays look like any other
  assert.equal(label('1, ÷, 0'), 'Evaluate');
  assert.equal(label('1, +'), null);
  assert.equal(label('+, 1'), null);
  assert.equal(label('1, 2, 3'), null);
  assert.equal(label('1, S(n)'), 'Combine');
  assert.equal(label('S(n), 1'), 'Combine');
  assert.equal(label('∅, {}'), 'Combine');
  assert.equal(label('2, 3'), 'Combine');
  assert.equal(label('+, −'), 'Combine');
  assert.equal(label('+, ÷'), null);
  assert.equal(label('2, +, ?, =, 5'), 'Solve');
  assert.equal(label('2, ×, 2, ×, 2'), 'Evaluate');
  assert.equal(label('1, +, 2, +, 3, +, 4'), null); // more than 5 cards
});

test('arithmetic is exact and results are labelled with their set', () => {
  assert.equal(run('2, +, 3, ×, 4').value.n, 14n);
  assert.equal(run('2, aᵇ, 3, aᵇ, 2').value.n, 512n); // right-associative
  assert.equal(format(run('10, aᵇ, 10, aᵇ, 10').value), '≈ 10¹⁰⁰⁰⁰⁰⁰⁰⁰⁰⁰');
  assert.equal(format(run('100, ÷, 4').value), '25');
  assert.equal(decimalText(Q(1, 3)), '0.3̇');
  assert.equal(decimalText(Q(1, 7)), '0.1̇42857̇');
  assert.equal(decimalText(Q(1, 2)), '0.5');
  assert.equal(key(sqrt(Q(4))), key(Q(2)));
  assert.equal(format(logb(Q(2), Q(8))), '3');
  assert.equal(format(logb(Q(4), Q(2))), '1⁄2');
  assert.equal(logb(Q(2), Q(3)).k, 'r');
  assert.equal(format(pow(Q(-1), Q(1, 2))), 'i');
  assert.equal(run('√2, ×, √2').cardId, 'N12');
  assert.equal(run('i, ×, i').cardId, 'N03');
  assert.equal(factorial(Q(500)).k, 'huge');
});

test('stuck plays name the missing number system', () => {
  const o = run('3, −, 5', ONLY_N);
  assert.equal(o.status, 'stuck');
  assert.equal(o.stuckIn, 'Z');
  assert.equal(run('1, ÷, 3', { systems: new Set(['N', 'Z']), owns: () => false }).stuckIn, 'Q');
  assert.equal(run('√, −1', { systems: new Set(['N', 'Z', 'Q', 'R']), owns: () => false }).stuckIn, 'C');
  assert.equal(run('3, −, 5').value.n, -2n);
});

test('no theorem yet for undefined plays', () => {
  const o = run('1, ÷, 0');
  assert.equal(o.status, 'undefined');
  assert.match(o.note, /limit|∞/);
  assert.equal(run('∞, +, 1').status, 'undefined');
});

test('comparisons and the sandbox solver', () => {
  assert.equal(run('−1, 1').relation, 'opposites');
  assert.equal(run('∅, {∅}').relation, 'in');
  assert.equal(run('0, ∅').relation, 'equal');
  assert.equal(run('2, ℕ').relation, 'in');
  assert.equal(format(run('2, +, ?, =, 5').value), '3');
  assert.equal(format(run('?, aᵇ, 2, =, 9').value), '3');
  assert.equal(run('?, aᵇ, 2, =, 2', { systems: new Set(['N', 'Z', 'Q']), owns: () => false }).stuckIn, 'R');
});

// Plays through the whole of milestone 1 from `{}`, the way a player could.
test('golden walkthrough: every M1 card is reachable from {}', () => {
  const g = new Game();
  const firstSeen = {};
  let plays = 0;
  const note = (grants) => { for (const x of grants) firstSeen[x.id] ??= plays; return grants.map((x) => x.id); };
  const play = (text, expect = []) => {
    plays++;
    const r = g.play(tok(text));
    assert.ok(r, `no valid play: ${text}`);
    const got = note(r.grants);
    for (const id of expect) assert.ok(g.owns(id), `${text} should give ${CARD[id].symbol}; got ${got.map((i) => CARD[i].symbol)}`);
    return r;
  };
  const answerQuestions = (kind, times) => {
    for (let i = 0; i < times; i++) {
      const q = g.offerQuestion();
      assert.ok(q, `expected a ${kind} question`);
      assert.equal(q.kind, kind);
      plays++;
      if (kind === 'squeeze') { note(g.solveQuestion(q)); continue; }
      const res = g.answer(q, CARD[BY_SYMBOL[String(q.answer)]].value);
      assert.ok(res.correct);
      note(res.grants);
    }
  };

  play('{}', ['S01']);
  play('∅', ['N01', 'S10']);                  // two transmutes in a row → ⇒
  play('∅, {}', ['S15']);
  play('{∅}', ['N02', 'A08', 'O01']);
  play('1, S(n)', ['N12']);
  play('1, +, 1', ['O05', 'O03']);
  for (let n = 2; n < 10; n++) play(`${n}, S(n)`, [BY_SYMBOL[String(n + 1)]]);
  play('S(n), S(n)', ['S16']);
  play('∅, {∅}', ['S02']);
  const setTwo = play('S(n), {∅}', ['S03']);
  plays++; note(g.play([{ temp: setTwo.outcome.value }]).grants);
  assert.equal(g.pathCount('N12').found, 3);
  const eleven = play('10, S(n)');
  assert.ok(eleven.outcome.keepGoing);
  note(g.event('keep-going'));
  assert.ok(g.owns('N10'));
  play('2, ×, 2, ×, 2', ['O06']);
  play('1, ×, 2, ×, 3', ['O09']);
  play('10, ×, 10', ['N21']);
  answerQuestions('add-blank', 3);
  assert.ok(g.owns('A01') && g.owns('O02'));
  const stuck = play('3, −, 5', ['S17', 'N03']);
  assert.equal(stuck.outcome.status, 'stuck');
  assert.equal(format(stuck.resolved.value), '−2');
  play('−1, 1', ['O08']);
  answerQuestions('mul-blank', 3);
  assert.ok(g.owns('O04'));
  play('1, ÷, 2', ['S18', 'N04']);
  play('1, ÷, 3', ['N05']);
  play('1, ÷, 100', ['N11']);
  answerQuestions('pow-blank', 1);
  assert.ok(g.owns('A04'));
  answerQuestions('squeeze', 1);
  assert.ok(g.owns('O07') && g.owns('N06') && g.owns('S06') && g.owns('G01'));
  play('√, −1', ['S07', 'N09']);
  play('S(n), 4'); play('√, 4'); play('|x|, 4', ['A02']);
  play('+, −', ['A03']);
  play('f(x), ℕ', ['A07']);
  play('+, aₙ', ['A06']);
  play('aₙ, ∞', ['C01']);
  play('△', ['G02']);
  play('θ, +, θ, +, θ', ['N07', 'G08']);
  play('1, θ', ['V01']);
  play('v⃗, v⃗', ['V02']);
  play('Σ, 1, ÷, n!', ['N08']);
  play('lim, △, f(x)', ['C02']);
  play('lim, Σ, f(x)', ['C03']);

  const missing = CARDS.filter((c) => c.m1 && !g.owns(c.id)).map((c) => c.symbol);
  assert.deepEqual(missing, []);
  const stars = CARDS.filter((c) => c.star).map((c) => `${c.symbol} ${firstSeen[c.id]}`);
  console.log(`  plays to each ★ card: ${stars.join(' · ')}  (total ${plays})`);
});

test('alternative paths', () => {
  const g = new Game({ ...new Game().s, owned: Object.fromEntries(['N02', 'N12', 'O06', 'N04', 'S17', 'S18', 'A08', 'N20', 'N21'].map((id, i) => [id, { n: i + 1, seen: true }])) });
  const r = g.play(tok('2, aᵇ, ½'));
  assert.equal(r.outcome.status, 'stuck');
  assert.ok(g.owns('S06') && g.owns('N06') && g.owns('O07')); // ℝ, √2 and √ via halfPower
  g.play(tok('10, aᵇ, 2'));
  assert.equal(g.pathCount('N21').found, 1);
  g.play(tok('ℕ, S(n)'.replace('ℕ', '10')));
  assert.ok(!g.owns('N10'));
});

test('saved state is sanitized', () => {
  const g = new Game({ v: 1, owned: { N01: { n: 1 }, BAD: { n: 2 }, '<img>': {} }, found: { N01: ['count', 'nope'] }, log: [{ text: '<b>', grants: ['X'] }] });
  assert.ok(g.owns('N01') && g.owns('S14'));
  assert.ok(!g.owns('BAD'));
  assert.deepEqual(g.s.found.N01, ['count']);
  assert.deepEqual(g.s.log[0].grants, []);
  assert.ok(new Game({ v: 99 }).owns('S14'));
});
