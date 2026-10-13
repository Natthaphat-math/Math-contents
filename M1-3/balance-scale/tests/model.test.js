// รันด้วย: node --test   (Node 18 ขึ้นไป ไม่ต้องติดตั้งอะไรเพิ่ม)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/model.js');

const MINUS = '−';
const NEQ = '≠';

function start(text) {
  const p = M.parseEquation(text);
  assert.ok(p.ok, `parse failed for ${text}: ${p.error}`);
  return M.createState(p.eq);
}
function act(state, op, k, target) {
  return M.applyAction(state, { op, k, target });
}

test('presets parse with the expected integer solutions', () => {
  const expected = { 'x + 3 = 8': 5, 'x + 5 = 12': 7, 'x + 2 = 9': 7, '2x = 8': 4, '3x = 12': 4, '2x + 1 = 9': 4 };
  for (const p of M.PRESETS) {
    const r = M.parseEquation(p.text);
    assert.ok(r.ok, p.text);
    assert.equal(r.x, expected[p.text]);
    assert.equal(r.text, p.text);
    assert.ok(M.isBalanced(M.createState(r.eq)), `${p.text} starts balanced`);
  }
});

test('parser accepts flexible spacing, x on the right, and Unicode signs', () => {
  assert.equal(M.parseEquation('2x+1=9').x, 4);
  assert.equal(M.parseEquation(' 12 = 3X ').x, 4);
  assert.equal(M.parseEquation('1 + 2x = 9').x, 4);
  assert.equal(M.parseEquation('x = 5').x, 5);
  assert.deepEqual(M.parseEquation('9 = 2x + 1').eq, { left: { c: 0, n: 9 }, right: { c: 2, n: 1 } });
});

test('parser rejects equations outside the lesson scope', () => {
  const bad = [
    'x + 3 = 2',      // negative solution
    'x + 3 = 3',      // zero solution
    '2x + 1 = 8',     // non-integer solution
    '2x = x + 3',     // x on both sides
    '3 + 4 = 7',      // no x
    'x - 3 = 5',      // subtraction / negatives
    'x + 3',          // no equals sign
    'x = 2 = 2',      // two equals signs
    'x + y = 3',      // unknown token
    '9x = 18',        // too many boxes for the pan
    'x + 1 = 99',     // too many blocks
    'x + x = 4',      // two x terms on one side
    ''
  ];
  for (const s of bad) {
    const r = M.parseEquation(s);
    assert.equal(r.ok, false, `should reject "${s}"`);
    assert.equal(typeof r.error, 'string');
    assert.ok(r.error.length > 0);
  }
});

test('tilt direction and balanced detection', () => {
  const s = start('x + 3 = 8');            // x = 5, both sides weigh 8
  assert.equal(M.tilt(s), 0);
  assert.equal(M.tiltAngle(s), 0);
  assert.deepEqual(M.weights(s), { left: 8, right: 8 });

  const leftOnly = act(s, 'sub', 3, 'left').state;  // 5 vs 8
  assert.equal(M.tilt(leftOnly), 1, 'right side heavier');
  assert.ok(M.tiltAngle(leftOnly) > 0, 'positive angle means the right pan goes down');
  assert.equal(M.isBalanced(leftOnly), false);

  const rightAdd = act(s, 'add', 2, 'right').state; // 8 vs 10
  assert.equal(M.tilt(rightAdd), 1);
  const leftAdd = act(s, 'add', 2, 'left').state;   // 10 vs 8
  assert.equal(M.tilt(leftAdd), -1, 'left side heavier');
  assert.ok(M.tiltAngle(leftAdd) < 0);
});

test('tilt angle is proportional to the weight difference and capped', () => {
  const d = M.LIMITS.degPerUnit;
  assert.equal(M.tiltAngleFor(8, 9), d);
  assert.equal(M.tiltAngleFor(8, 10), 2 * d);
  assert.equal(M.tiltAngleFor(10, 8), -2 * d);
  assert.equal(M.tiltAngleFor(0, 1000), M.LIMITS.maxAngle);
  assert.equal(M.tiltAngleFor(1000, 0), -M.LIMITS.maxAngle);
});

test('remove from both sides: equivalent step, log line, solved', () => {
  const s = start('x + 3 = 8');
  const r = act(s, 'sub', 3, 'both');
  assert.ok(r.ok);
  assert.deepEqual(r.state.left, { c: 1, n: 0 });
  assert.deepEqual(r.state.right, { c: 0, n: 5 });
  assert.ok(M.isBalanced(r.state));
  assert.ok(M.isSolved(r.state));
  assert.equal(r.step.opLine, `x + 3 ${MINUS} 3 = 8 ${MINUS} 3`);
  assert.equal(r.step.resultLine, 'x = 5');
  assert.equal(r.step.reason, 'นำ 3 มาลบทั้งสองข้างของสมการ');
  assert.equal(r.step.balanced, true);
  assert.equal(r.step.oneSide, false);
});

test('one-side operations are allowed, unbalance the scale and are not auto-corrected', () => {
  const s = start('x + 3 = 8');
  const r = act(s, 'sub', 3, 'left');
  assert.ok(r.ok, 'one-side move must be permitted');
  assert.deepEqual(r.state.left, { c: 1, n: 0 });
  assert.deepEqual(r.state.right, { c: 0, n: 8 }, 'right side untouched');
  assert.equal(M.formatEquation(r.state), `x ${NEQ} 8`);
  assert.equal(r.step.opLine, `x + 3 ${MINUS} 3 ${NEQ} 8`);
  assert.equal(r.step.resultLine, `x ${NEQ} 8`);
  assert.equal(r.step.oneSide, true);
  assert.equal(r.step.balanced, false);
  assert.match(r.step.reason, /เฉพาะข้างซ้าย/);
  assert.equal(M.isSolved(r.state), false, 'x alone but unbalanced is not a solution');

  // doing the same to the other side afterwards restores balance
  const r2 = act(r.state, 'sub', 3, 'right');
  assert.ok(M.isBalanced(r2.state));
  assert.equal(M.formatEquation(r2.state), 'x = 5');
});

test('every one-side add/sub/mul/div from a balanced state unbalances the scale', () => {
  for (const p of M.PRESETS) {
    const s = start(p.text);
    for (const target of ['left', 'right']) {
      for (const [op, k] of [['add', 1], ['add', 4], ['sub', 1], ['mul', 2], ['div', 2]]) {
        const r = act(s, op, k, target);
        if (!r.ok) continue; // impossible move, tested elsewhere
        assert.equal(M.isBalanced(r.state), false, `${p.text} ${op} ${k} ${target}`);
      }
    }
  }
});

test('both-side operations always keep balance and the same solution (equivalent equations)', () => {
  for (const p of M.PRESETS) {
    const s = start(p.text);
    for (const op of ['add', 'sub', 'mul', 'div']) {
      for (let k = (op === 'mul' || op === 'div') ? 2 : 1; k <= 6; k++) {
        const r = act(s, op, k, 'both');
        if (!r.ok) continue;
        assert.ok(M.isBalanced(r.state), `${p.text} ${op} ${k}`);
        assert.equal(r.state.x, s.x);
        // the displayed equation is still true for the hidden x
        const chk = M.checkAnswer({ left: r.state.left, right: r.state.right }, s.x);
        assert.ok(chk.balanced);
        assert.equal(r.step.opLine.includes(NEQ), false);
      }
    }
  }
});

test('invalid moves are blocked with a Thai explanation and do not change state', () => {
  const s = start('x + 3 = 8');
  const before = JSON.stringify(s);

  const tooMany = act(s, 'sub', 4, 'both');
  assert.equal(tooMany.ok, false);
  assert.equal(tooMany.errors.length, 1);
  assert.equal(tooMany.errors[0].code, 'NOT_ENOUGH');
  assert.equal(tooMany.errors[0].side, 'left');
  assert.match(tooMany.message, /ข้างซ้ายมีก้อนอยู่ 3 ก้อน/);

  const noBlocks = act(start('2x = 8'), 'sub', 1, 'left');
  assert.equal(noBlocks.ok, false);
  assert.match(noBlocks.message, /ไม่มีก้อนให้นำออก/);

  const overflow = act(s, 'mul', 9, 'both');
  assert.equal(overflow.ok, false);
  assert.equal(overflow.errors[0].code, 'TOO_MANY');

  const overAdd = act(start('x + 3 = 38'), 'add', 5, 'right');
  assert.equal(overAdd.ok, false);
  assert.equal(overAdd.errors[0].code, 'TOO_MANY');

  for (const bad of [{ op: 'mul', k: 1, target: 'both' }, { op: 'add', k: 0, target: 'left' },
    { op: 'add', k: 1.5, target: 'left' }, { op: 'zap', k: 1, target: 'left' }, { op: 'add', k: 1, target: 'middle' }]) {
    assert.equal(M.applyAction(s, bad).ok, false);
  }
  assert.equal(JSON.stringify(s), before, 'state is immutable');
});

test('divide: must split into whole equal groups', () => {
  const s = start('2x + 1 = 9');
  const r = act(s, 'div', 2, 'both');
  assert.equal(r.ok, false, 'cannot split 2x + 1 into 2 equal whole groups');
  assert.equal(r.errors[0].code, 'NOT_DIVISIBLE');
  assert.equal(r.errors.length, 2, 'both sides (1 block and 9 blocks) are not divisible by 2');
  assert.match(r.message, /ก้อน 1 ก้อน/);

  const odd = act(start('3x = 12'), 'div', 2, 'both');
  assert.equal(odd.ok, false);
  assert.match(odd.message, /กล่อง x 3 กล่อง/);

  const step1 = act(s, 'sub', 1, 'both');
  assert.equal(M.formatEquation(step1.state), '2x = 8');
  const step2 = act(step1.state, 'div', 2, 'both');
  assert.ok(step2.ok);
  assert.equal(step2.step.opLine, '2x ÷ 2 = 8 ÷ 2');
  assert.equal(M.formatEquation(step2.state), 'x = 4');
  assert.ok(M.isSolved(step2.state));

  // multi-term side is wrapped in parentheses
  const grouped = act(start('2x + 2 = 10'), 'div', 2, 'both');
  assert.equal(grouped.step.opLine, '(2x + 2) ÷ 2 = 10 ÷ 2');
  assert.equal(M.formatEquation(grouped.state), 'x + 1 = 5');
});

test('divide or multiply only one side', () => {
  const r = act(start('2x = 8'), 'div', 2, 'right');
  assert.ok(r.ok);
  assert.equal(M.formatEquation(r.state), `2x ${NEQ} 4`);
  assert.equal(M.tilt(r.state), -1, 'left heavier');

  const m = act(start('3x = 12'), 'mul', 2, 'left');
  assert.equal(M.formatEquation(m.state), `6x ${NEQ} 12`);
  assert.equal(M.tilt(m.state), -1);
});

test('multiply both sides', () => {
  const r = act(start('x + 3 = 8'), 'mul', 2, 'both');
  assert.ok(r.ok);
  assert.equal(M.formatEquation(r.state), '2x + 6 = 16');
  assert.equal(r.step.opLine, '(x + 3) × 2 = 8 × 2');
  assert.equal(r.step.reason, 'นำ 2 มาคูณทั้งสองข้างของสมการ');
});

test('x on the right pan works the same way', () => {
  const s = start('12 = 3x');
  assert.equal(M.xSideKey(s), 'right');
  const r = act(s, 'div', 3, 'both');
  assert.equal(M.formatEquation(r.state), '4 = x');
  assert.ok(M.isSolved(r.state));
});

test('a side can reach zero blocks and is written as 0', () => {
  const r = act(start('x + 3 = 8'), 'sub', 8, 'right');
  assert.equal(M.formatEquation(r.state), `x + 3 ${NEQ} 0`);
  assert.equal(M.tilt(r.state), -1);
});

test('substitution check', () => {
  const eq = M.parseEquation('2x + 1 = 9').eq;
  const good = M.checkAnswer(eq, 4);
  assert.equal(good.balanced, true);
  assert.equal(good.leftText, '2(4) + 1');
  assert.equal(good.leftValue, 9);
  assert.equal(good.direction, 0);

  const bad = M.checkAnswer(eq, 5);
  assert.equal(bad.balanced, false);
  assert.equal(bad.leftValue, 11);
  assert.equal(bad.direction, -1);

  const low = M.checkAnswer(M.parseEquation('x + 3 = 8').eq, 2);
  assert.equal(low.leftText, '2 + 3');
  assert.equal(low.direction, 1);
});

test('teacher auto-solve reaches x alone for every preset', () => {
  for (const p of M.PRESETS) {
    let s = start(p.text);
    for (let i = 0; i < 5 && !M.isSolved(s); i++) {
      const a = M.nextStep(s);
      assert.ok(a, `${p.text} has a next step`);
      const r = M.applyAction(s, a);
      assert.ok(r.ok);
      s = r.state;
    }
    assert.ok(M.isSolved(s), `${p.text} solved`);
    assert.equal(M.nextStep(s), null);
  }
  const unbalanced = act(start('x + 3 = 8'), 'add', 1, 'left').state;
  assert.equal(M.nextStep(unbalanced), null, 'no auto-step from an unbalanced scale');
});
