/*
 * ตรรกะของตาชั่งสมการ (ไม่มีส่วนแสดงผล) — ใช้ได้ทั้งในเบราว์เซอร์และใน Node (สำหรับทดสอบ)
 *
 * แต่ละข้างของตาชั่งแทนด้วย { c, n }
 *   c = จำนวนกล่อง x (ทุกกล่องหนักเท่ากัน = ค่า x ที่ซ่อนไว้)
 *   n = จำนวนก้อนหนัก 1 หน่วย
 * state = { left, right, x }   x = คำตอบของสมการเริ่มต้น (น้ำหนักของกล่อง x)
 * ทุกฟังก์ชันไม่แก้ไข state เดิม (immutable)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BalanceModel = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LIMITS = {
    maxX: 8,        // กล่อง x สูงสุดต่อจาน
    maxUnits: 40,   // ก้อนสูงสุดต่อจาน
    maxAmount: 20,  // จำนวนก้อนที่เพิ่ม/นำออกได้ต่อครั้ง
    maxFactor: 9,   // ตัวคูณ/ตัวหารสูงสุด
    degPerUnit: 3,  // องศาที่คานเอียงต่อผลต่างน้ำหนัก 1 หน่วย
    maxAngle: 20
  };

  var MINUS = '−';
  var NEQ = '≠';
  var SIDE_NAME = { left: 'ข้างซ้าย', right: 'ข้างขวา' };
  var OP_VERB = { sub: 'ลบ', add: 'บวก', mul: 'คูณ', div: 'หาร' };
  var PROPERTY = {
    sub: 'สมบัติการเท่ากันเกี่ยวกับการลบ',
    add: 'สมบัติการเท่ากันเกี่ยวกับการบวก',
    mul: 'สมบัติการเท่ากันเกี่ยวกับการคูณ',
    div: 'สมบัติการเท่ากันเกี่ยวกับการหาร'
  };

  var PRESETS = [
    { text: 'x + 3 = 8', part: 1 },
    { text: 'x + 5 = 12', part: 1 },
    { text: 'x + 2 = 9', part: 1 },
    { text: '2x = 8', part: 2 },
    { text: '3x = 12', part: 2 },
    { text: '2x + 1 = 9', part: 2 }
  ];

  function side(c, n) { return { c: c, n: n }; }
  function copySide(s) { return { c: s.c, n: s.n }; }

  // ---------- การอ่านสมการ ----------

  function fail(msg) { return { ok: false, error: msg }; }

  function parseSide(str) {
    if (str === '') return fail('ทั้งสองข้างของเครื่องหมาย = ต้องมีพจน์');
    if (/-/.test(str)) return fail('กิจกรรมนี้ใช้เฉพาะการบวกและจำนวนเต็มบวก (ไม่มีการลบหรือจำนวนลบ)');
    var terms = str.split('+');
    var c = 0, n = 0, hasX = false, hasN = false;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      var mx = /^(\d*)x$/.exec(t);
      if (mx) {
        if (hasX) return fail('แต่ละข้างเขียนพจน์ที่มี x ได้เพียงพจน์เดียว');
        hasX = true;
        c = mx[1] === '' ? 1 : parseInt(mx[1], 10);
        if (c < 1) return fail('สัมประสิทธิ์ของ x ต้องเป็นจำนวนเต็มบวก');
      } else if (/^\d+$/.test(t)) {
        if (hasN) return fail('แต่ละข้างเขียนตัวเลขได้เพียงพจน์เดียว');
        hasN = true;
        n = parseInt(t, 10);
        if (n < 1) return fail('ใช้เฉพาะจำนวนเต็มบวก');
      } else {
        return fail('อ่านพจน์ “' + (t || ' ') + '” ไม่ได้ ลองเขียนแบบ 2x + 1 = 9');
      }
    }
    return { ok: true, side: side(c, n) };
  }

  /** อ่านสมการรูป x + a = b, ax = b, ax + b = c (x อยู่ข้างเดียว จะอยู่ซ้ายหรือขวาก็ได้) */
  function parseEquation(input) {
    if (typeof input !== 'string') return fail('กรุณาพิมพ์สมการ');
    var s = input.toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[−–—]/g, '-')
      .replace(/＋/g, '+')
      .replace(/＝/g, '=');
    if (s === '') return fail('กรุณาพิมพ์สมการ');
    var parts = s.split('=');
    if (parts.length !== 2) return fail('สมการต้องมีเครื่องหมาย = หนึ่งตัว');
    var L = parseSide(parts[0]);
    if (!L.ok) return L;
    var R = parseSide(parts[1]);
    if (!R.ok) return R;
    var left = L.side, right = R.side;
    if (left.c > 0 && right.c > 0) return fail('ให้มี x อยู่เพียงข้างเดียวของสมการ');
    if (left.c === 0 && right.c === 0) return fail('สมการต้องมีตัวไม่ทราบค่า x');
    var xs = left.c > 0 ? left : right;
    var other = left.c > 0 ? right : left;
    if (other.n < 1) return fail('ข้างที่ไม่มี x ต้องเป็นจำนวนเต็มบวก');
    if (xs.c > LIMITS.maxX) return fail('สัมประสิทธิ์ของ x ต้องไม่เกิน ' + LIMITS.maxX + ' (วางกล่องบนจานได้ไม่เกินนี้)');
    if (xs.n > LIMITS.maxUnits || other.n > LIMITS.maxUnits) return fail('ตัวเลขแต่ละข้างต้องไม่เกิน ' + LIMITS.maxUnits);
    var diff = other.n - xs.n;
    if (diff <= 0 || diff % xs.c !== 0) return fail('คำตอบของสมการนี้ไม่ใช่จำนวนเต็มบวก กรุณาเลือกตัวเลขใหม่');
    var eq = { left: copySide(left), right: copySide(right) };
    return { ok: true, eq: eq, x: diff / xs.c, text: formatEquationParts(left, right, '=') };
  }

  function createState(eq) {
    var xs = eq.left.c > 0 ? eq.left : eq.right;
    var other = eq.left.c > 0 ? eq.right : eq.left;
    return { left: copySide(eq.left), right: copySide(eq.right), x: (other.n - xs.n) / xs.c };
  }

  // ---------- น้ำหนักและการเอียง ----------

  function weightOf(s, x) { return s.c * x + s.n; }

  function weights(state) {
    return { left: weightOf(state.left, state.x), right: weightOf(state.right, state.x) };
  }

  /** -1 = ข้างซ้ายหนักกว่า (ซ้ายลง), 0 = สมดุล, 1 = ข้างขวาหนักกว่า (ขวาลง) */
  function tiltDirection(lw, rw) { return lw > rw ? -1 : lw < rw ? 1 : 0; }

  function tilt(state) { var w = weights(state); return tiltDirection(w.left, w.right); }

  /** มุมเอียงของคาน (องศา) แปรผันตามผลต่างน้ำหนัก มีเพดาน ค่าบวก = ข้างขวาลง */
  function tiltAngleFor(lw, rw) {
    var a = (rw - lw) * LIMITS.degPerUnit;
    return Math.max(-LIMITS.maxAngle, Math.min(LIMITS.maxAngle, a));
  }

  function tiltAngle(state) { var w = weights(state); return tiltAngleFor(w.left, w.right); }

  function isBalanced(state) { return tilt(state) === 0; }

  function xSideKey(state) { return state.left.c > 0 ? 'left' : 'right'; }
  function otherKey(k) { return k === 'left' ? 'right' : 'left'; }

  /** แก้สมการเสร็จ: สมดุล และเหลือ x 1 กล่องตามลำพังบนจานข้างหนึ่ง */
  function isSolved(state) {
    var xk = xSideKey(state);
    var xs = state[xk], other = state[otherKey(xk)];
    return isBalanced(state) && xs.c === 1 && xs.n === 0 && other.c === 0;
  }

  // ---------- การกระทำ ----------
  // action = { op: 'sub' | 'add' | 'div' | 'mul', k: จำนวนเต็มบวก, target: 'left' | 'right' | 'both' }

  function targetsOf(action) { return action.target === 'both' ? ['left', 'right'] : [action.target]; }

  function checkSide(s, action) {
    var k = action.k;
    switch (action.op) {
      case 'sub':
        if (k > s.n) return { code: 'NOT_ENOUGH', have: s.n, hasX: s.c > 0 };
        return null;
      case 'add':
        if (s.n + k > LIMITS.maxUnits) return { code: 'TOO_MANY' };
        return null;
      case 'div':
        if (s.c % k !== 0 || s.n % k !== 0) return { code: 'NOT_DIVISIBLE', c: s.c, n: s.n, badC: s.c % k !== 0, badN: s.n % k !== 0 };
        return null;
      case 'mul':
        if (s.c * k > LIMITS.maxX || s.n * k > LIMITS.maxUnits) return { code: 'TOO_MANY' };
        return null;
    }
    return { code: 'BAD_ACTION' };
  }

  function transformSide(s, action) {
    var k = action.k;
    switch (action.op) {
      case 'sub': return side(s.c, s.n - k);
      case 'add': return side(s.c, s.n + k);
      case 'div': return side(s.c / k, s.n / k);
      case 'mul': return side(s.c * k, s.n * k);
    }
  }

  function validAction(action) {
    if (!action || ['sub', 'add', 'div', 'mul'].indexOf(action.op) < 0) return false;
    if (['left', 'right', 'both'].indexOf(action.target) < 0) return false;
    var k = action.k;
    if (typeof k !== 'number' || k !== Math.floor(k) || k < 1) return false;
    if ((action.op === 'div' || action.op === 'mul') && (k < 2 || k > LIMITS.maxFactor)) return false;
    if ((action.op === 'sub' || action.op === 'add') && k > LIMITS.maxAmount) return false;
    return true;
  }

  /**
   * ทำการกระทำกับตาชั่ง คืนค่า { ok: true, state, step } หรือ { ok: false, errors, message }
   * การกระทำข้างเดียวที่ทำให้ไม่สมดุล "ทำได้" เสมอ (ไม่แก้ให้อัตโนมัติ)
   */
  function applyAction(state, action) {
    if (!validAction(action)) {
      return { ok: false, errors: [{ code: 'BAD_ACTION' }], message: 'การกระทำนี้ไม่ถูกต้อง' };
    }
    var keys = targetsOf(action);
    var errors = [];
    keys.forEach(function (key) {
      var e = checkSide(state[key], action);
      if (e) { e.side = key; errors.push(e); }
    });
    if (errors.length) {
      return { ok: false, errors: errors, message: errorMessage(errors, action) };
    }
    var next = { left: copySide(state.left), right: copySide(state.right), x: state.x };
    keys.forEach(function (key) { next[key] = transformSide(state[key], action); });
    return { ok: true, state: next, step: makeStep(state, action, next) };
  }

  function errorMessage(errors, action) {
    var k = action.k;
    return errors.map(function (e) {
      var name = SIDE_NAME[e.side];
      if (e.code === 'NOT_ENOUGH') {
        var base = e.have === 0
          ? name + 'ไม่มีก้อนให้นำออก'
          : name + 'มีก้อนอยู่ ' + e.have + ' ก้อน จึงนำออก ' + k + ' ก้อนไม่ได้';
        return base + (e.hasX ? ' (กล่อง x นำออกแบบก้อนไม่ได้)' : '');
      }
      if (e.code === 'NOT_DIVISIBLE') {
        var what = [];
        if (e.badC) what.push('กล่อง x ' + e.c + ' กล่อง');
        if (e.badN) what.push('ก้อน ' + e.n + ' ก้อน');
        var msg = 'แบ่ง' + name + 'เป็น ' + k + ' กลุ่มเท่า ๆ กันไม่ได้ เพราะ' + what.join(' และ ') +
          'แบ่งเป็น ' + k + ' กลุ่มให้เท่ากันพอดีไม่ได้ (ห้ามตัดแบ่งก้อนหรือกล่อง)';
        if (e.badN && !e.badC && e.c > 0) msg += ' — ลองคิดว่าควรทำอะไรกับก้อนก่อนแบ่งกลุ่ม';
        return msg;
      }
      if (e.code === 'TOO_MANY') {
        return 'ของบน' + name + 'จะมีมากเกินไปจนวางบนจานไม่พอ (วางได้ไม่เกิน ' +
          LIMITS.maxX + ' กล่อง และ ' + LIMITS.maxUnits + ' ก้อน)';
      }
      return 'การกระทำนี้ไม่ถูกต้อง';
    }).join(' / ');
  }

  // ---------- การเขียนสมการ ----------

  function formatSide(s) {
    var terms = [];
    if (s.c > 0) terms.push(s.c === 1 ? 'x' : s.c + 'x');
    if (s.n > 0 || s.c === 0) terms.push(String(s.n));
    return terms.join(' + ');
  }

  function isMultiTerm(s) { return s.c > 0 && s.n > 0; }

  function formatEquationParts(left, right, rel) {
    return formatSide(left) + ' ' + rel + ' ' + formatSide(right);
  }

  function relationOf(state) { return isBalanced(state) ? '=' : NEQ; }

  function formatEquation(state) {
    return formatEquationParts(state.left, state.right, relationOf(state));
  }

  /** ข้างหนึ่งในบรรทัดที่แสดงการกระทำ เช่น "x + 3 − 3", "(2x + 2) ÷ 2" */
  function formatOpSide(s, action) {
    var e = formatSide(s), k = action.k;
    var wrapped = isMultiTerm(s) ? '(' + e + ')' : e;
    switch (action.op) {
      case 'sub': return e + ' ' + MINUS + ' ' + k;
      case 'add': return e + ' + ' + k;
      case 'mul': return wrapped + ' × ' + k;
      case 'div': return wrapped + ' ÷ ' + k;
    }
  }

  function reasonText(action, after) {
    var verb = OP_VERB[action.op];
    if (action.target === 'both') return 'นำ ' + action.k + ' มา' + verb + 'ทั้งสองข้างของสมการ';
    return 'นำ ' + action.k + ' มา' + verb + 'เฉพาะ' + SIDE_NAME[action.target] +
      (isBalanced(after) ? '' : ' (ตาชั่งไม่สมดุล)');
  }

  /** บันทึกหนึ่งขั้น: บรรทัดแสดงการกระทำ + บรรทัดผลลัพธ์ */
  function makeStep(before, action, after) {
    var rel = relationOf(after);
    var hit = { left: false, right: false };
    targetsOf(action).forEach(function (k) { hit[k] = true; });
    var l = hit.left ? formatOpSide(before.left, action) : formatSide(before.left);
    var r = hit.right ? formatOpSide(before.right, action) : formatSide(before.right);
    return {
      action: { op: action.op, k: action.k, target: action.target },
      opLine: l + ' ' + rel + ' ' + r,
      resultLine: formatEquation(after),
      reason: reasonText(action, after),
      balanced: isBalanced(after),
      oneSide: action.target !== 'both'
    };
  }

  // ---------- ตรวจสอบคำตอบ (แทนค่า) ----------

  function substituteText(s, v) {
    var terms = [];
    if (s.c > 0) terms.push(s.c === 1 ? String(v) : s.c + '(' + v + ')');
    if (s.n > 0 || s.c === 0) terms.push(String(s.n));
    return terms.join(' + ');
  }

  /** แทน x ด้วย v ในสมการ eq แล้วดูว่าสองข้างเท่ากันหรือไม่ */
  function checkAnswer(eq, v) {
    var lw = weightOf(eq.left, v), rw = weightOf(eq.right, v);
    return {
      value: v,
      leftText: substituteText(eq.left, v),
      rightText: substituteText(eq.right, v),
      leftValue: lw,
      rightValue: rw,
      direction: tiltDirection(lw, rw),
      angle: tiltAngleFor(lw, rw),
      balanced: lw === rw
    };
  }

  // ---------- สำหรับโหมดครู ----------

  /** ขั้นถัดไปที่เหมาะสม (ทำทั้งสองข้าง) หรือ null ถ้าแก้เสร็จแล้ว/ตาชั่งไม่สมดุล */
  function nextStep(state) {
    if (!isBalanced(state) || isSolved(state)) return null;
    var xs = state[xSideKey(state)];
    if (xs.n > 0) return { op: 'sub', k: xs.n, target: 'both' };
    if (xs.c > 1) return { op: 'div', k: xs.c, target: 'both' };
    return null;
  }

  return {
    LIMITS: LIMITS,
    PRESETS: PRESETS,
    SIDE_NAME: SIDE_NAME,
    PROPERTY: PROPERTY,
    parseEquation: parseEquation,
    createState: createState,
    weights: weights,
    tilt: tilt,
    tiltDirection: tiltDirection,
    tiltAngle: tiltAngle,
    tiltAngleFor: tiltAngleFor,
    isBalanced: isBalanced,
    isSolved: isSolved,
    xSideKey: xSideKey,
    applyAction: applyAction,
    formatSide: formatSide,
    formatEquation: formatEquation,
    formatOpSide: formatOpSide,
    isMultiTerm: isMultiTerm,
    checkAnswer: checkAnswer,
    nextStep: nextStep
  };
});
