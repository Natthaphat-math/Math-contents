/* ส่วนแสดงผลและการโต้ตอบของตาชั่งสมการ (ไม่มีการส่งข้อมูลออกนอกเครื่อง ไม่เก็บข้อมูลใด ๆ) */
(function () {
  'use strict';

  var M = window.BalanceModel;
  var NEQ = '≠';

  // ---------- เรขาคณิตของตาชั่ง (หน่วย viewBox) ----------
  var PIVOT_X = 200, PIVOT_Y = 34, ARM = 136, HANG = 112;
  var XS = 30, XG = 4, XPER = 4;           // กล่อง x
  var US = 12, UG = 1.5, UPER = 10;        // ก้อน 1 หน่วย (แถวละ 10 แบ่ง 5+5)

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- พารามิเตอร์จาก URL ----------
  function readParams() {
    var out = {};
    location.search.replace(/^\?/, '').split('&').forEach(function (pair) {
      if (!pair) return;
      var i = pair.indexOf('=');
      var key = i < 0 ? pair : pair.slice(0, i);
      var val = i < 0 ? '1' : pair.slice(i + 1);
      try { key = decodeURIComponent(key); val = decodeURIComponent(val); } catch (e) { /* ignore */ }
      out[key.toLowerCase()] = val;
    });
    return out;
  }
  function flag(v) { return v !== undefined && v !== '0' && v !== 'false' && v !== 'off'; }

  var params = readParams();

  // ---------- สถานะของแอป (อยู่ในหน่วยความจำเท่านั้น) ----------
  var app = {
    startEq: null, startText: '', state: null,
    history: [], log: [],
    op: null, k: 1, target: null,
    predict: flag(params.predict),
    teacher: flag(params.teacher),
    logAlways: flag(params.log),
    logRevealed: false,
    checking: null,
    busy: false,
    angle: 0,
    pending: null
  };

  // ---------- DOM ----------
  function $(id) { return document.getElementById(id); }
  var el = {
    eqCard: $('equationCard'), eqLeft: $('eqLeft'), eqRight: $('eqRight'), eqRel: $('eqRel'), eqStart: $('eqStart'),
    scale: $('scale'), scaleTitle: $('scaleTitle'), beam: $('beam'), panL: $('panL'), panR: $('panR'),
    status: $('status'), feedback: $('feedback'),
    opBtns: [].slice.call(document.querySelectorAll('[data-op]')),
    targetBtns: [].slice.call(document.querySelectorAll('[data-target]')),
    kMinus: $('kMinus'), kPlus: $('kPlus'), kValue: $('kValue'), kUnit: $('kUnit'), amountLabel: $('amountLabel'),
    go: $('goBtn'), undo: $('undoBtn'), reset: $('resetBtn'), predictToggle: $('predictToggle'),
    checkForm: $('checkForm'), checkInput: $('checkInput'), checkResult: $('checkResult'),
    checkBanner: $('checkBanner'), checkBannerText: $('checkBannerText'), exitCheck: $('exitCheck'),
    logGate: $('logGate'), logAsk: $('logAsk'), logConfirm: $('logConfirm'), logYes: $('logYes'), logNo: $('logNo'),
    logBox: $('logBox'), logList: $('logList'), logHide: $('logHide'),
    teacherCard: $('teacherCard'), teacherFlag: $('teacherFlag'), logAlwaysToggle: $('logAlwaysToggle'),
    stepBtn: $('stepBtn'), solveBtn: $('solveBtn'), revealBtn: $('revealBtn'),
    openEq: $('openEq'), eqDialog: $('eqDialog'), presets1: $('presets1'), presets2: $('presets2'),
    customForm: $('customForm'), customInput: $('customInput'), customError: $('customError'),
    shareBox: $('shareBox'), shareLink: $('shareLink'), copyLink: $('copyLink'),
    predictDialog: $('predictDialog'), predictQuestion: $('predictQuestion'),
    bigToggle: $('bigToggle')
  };

  // ---------- ตัวช่วยข้อความ ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /** ข้อความคณิต → HTML (x เป็นตัวเอียง) */
  function math(text) {
    return '<span class="math">' + esc(text).replace(/x/g, '<i class="var">x</i>') + '</span>';
  }
  var SIDE_ONLY = { left: 'ข้างซ้ายเท่านั้น', right: 'ข้างขวาเท่านั้น', both: 'ทั้งสองข้าง' };
  var DIR_TEXT = { '-1': 'ข้างซ้ายหนักกว่า', '0': 'สมดุล', '1': 'ข้างขวาหนักกว่า' };

  function actionSentence(op, k, target) {
    var t = SIDE_ONLY[target];
    switch (op) {
      case 'sub': return 'นำก้อนออก ' + k + ' ก้อน จาก' + t;
      case 'add': return 'เพิ่มก้อน ' + k + ' ก้อน ที่' + t;
      case 'div': return 'แบ่ง' + t + 'เป็น ' + k + ' กลุ่มเท่า ๆ กัน แล้วเก็บไว้ 1 กลุ่ม';
      case 'mul': return 'คูณ' + t + 'ด้วย ' + k + ' (ของบนจานเพิ่มเป็น ' + k + ' เท่า)';
    }
    return '';
  }

  function sideDescription(s, value) {
    var parts = [];
    if (s.c > 0) parts.push((value != null ? 'กล่องหนัก ' + value + ' ' : 'กล่อง x ') + s.c + ' กล่อง');
    if (s.n > 0) parts.push('ก้อน ' + s.n + ' ก้อน');
    return parts.length ? parts.join(' และ') : 'จานว่าง';
  }

  // ---------- วาดของบนจาน ----------
  function layoutItems(c, n) {
    var items = [], bottom = HANG - 1.5, i, row, col, inRow, w, xRows;
    for (i = 0; i < c; i++) {
      row = Math.floor(i / XPER); col = i % XPER;
      inRow = Math.min(XPER, c - row * XPER);
      w = inRow * XS + (inRow - 1) * XG;
      items.push({ kind: 'x', idx: i, x: -w / 2 + col * (XS + XG), y: bottom - (row + 1) * XS - row * XG });
    }
    xRows = Math.ceil(c / XPER);
    var base = bottom - (xRows ? xRows * XS + (xRows - 1) * XG + 4 : 0);
    for (i = 0; i < n; i++) {
      row = Math.floor(i / UPER); col = i % UPER;
      inRow = Math.min(UPER, n - row * UPER);
      w = inRow * US + (inRow - 1) * UG + (inRow > 5 ? 4 : 0);
      items.push({
        kind: 'u', idx: i,
        x: -w / 2 + col * (US + UG) + (col >= 5 ? 4 : 0),
        y: base - (row + 1) * US - row * UG
      });
    }
    return items;
  }

  function panMarkup(s, mark, value) {
    mark = mark || {};
    var out = [
      '<line class="s-string" x1="0" y1="0" x2="-68" y2="' + HANG + '"/>',
      '<line class="s-string" x1="0" y1="0" x2="68" y2="' + HANG + '"/>',
      '<path class="s-tray" d="M-74 ' + HANG + ' h148 q-6 13 -20 13 h-108 q-14 0 -20 -13z"/>',
      '<circle class="s-hook" r="4"/>'
    ];
    layoutItems(s.c, s.n).forEach(function (it) {
      var cls = 'it';
      var total = it.kind === 'x' ? s.c : s.n;
      var leave = it.kind === 'x' ? mark.leaveC : mark.leaveN;
      var enter = it.kind === 'x' ? mark.enterC : mark.enterN;
      if (leave && it.idx >= total - leave) cls += ' leaving';
      if (enter && it.idx >= total - enter) cls += ' entering';
      if (it.kind === 'x') {
        var label = value != null ? String(value) : 'x';
        var fs = label.length >= 3 ? 12 : label.length === 2 ? 15 : 19;
        out.push('<g class="' + cls + ' it-x' + (value != null ? ' it-val' : '') + '">' +
          '<rect x="' + it.x + '" y="' + it.y + '" width="' + XS + '" height="' + XS + '" rx="4"/>' +
          '<text x="' + (it.x + XS / 2) + '" y="' + (it.y + XS / 2) + '" font-size="' + fs + '">' + esc(label) + '</text></g>');
      } else {
        out.push('<rect class="' + cls + ' it-u" x="' + it.x + '" y="' + it.y + '" width="' + US + '" height="' + US + '" rx="2"/>');
      }
    });
    return out.join('');
  }

  function drawPans(left, right, markL, markR, value) {
    el.panL.innerHTML = panMarkup(left, markL, value);
    el.panR.innerHTML = panMarkup(right, markR, value);
  }

  // ---------- การเอียงของคาน ----------
  var rafId = 0;
  function setAngle(a) {
    app.angle = a;
    var rad = a * Math.PI / 180;
    var dx = ARM * Math.cos(rad), dy = ARM * Math.sin(rad);
    el.beam.setAttribute('transform', 'rotate(' + a.toFixed(3) + ' ' + PIVOT_X + ' ' + PIVOT_Y + ')');
    el.panL.setAttribute('transform', 'translate(' + (PIVOT_X - dx).toFixed(2) + ' ' + (PIVOT_Y - dy).toFixed(2) + ')');
    el.panR.setAttribute('transform', 'translate(' + (PIVOT_X + dx).toFixed(2) + ' ' + (PIVOT_Y + dy).toFixed(2) + ')');
  }
  function animateAngle(target) {
    cancelAnimationFrame(rafId);
    var from = app.angle;
    if (reduceMotion || Math.abs(target - from) < 0.01) { setAngle(target); return; }
    var t0 = performance.now(), D = 900;
    function frame(t) {
      var p = Math.min(1, (t - t0) / D);
      // แกว่งเล็กน้อยแล้วหยุด เหมือนตาชั่งจริง
      var e = p >= 1 ? 1 : 1 - Math.exp(-5.5 * p) * Math.cos(8 * p);
      setAngle(from + (target - from) * e);
      if (p < 1) rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);
  }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, reduceMotion ? 0 : ms); }); }

  // ---------- แสดงผลสมการ / สถานะ ----------
  function renderEquation() {
    var card = el.eqCard;
    if (app.checking) {
      var c = app.checking;
      el.eqLeft.innerHTML = math(c.leftText) + '<span class="eq-val">= ' + c.leftValue + '</span>';
      el.eqRight.innerHTML = math(c.rightText) + (c.rightText !== String(c.rightValue) ? '<span class="eq-val">= ' + c.rightValue + '</span>' : '');
      el.eqRel.textContent = c.balanced ? '=' : NEQ;
      card.classList.toggle('unbalanced', !c.balanced);
      card.classList.add('checking');
      el.eqStart.innerHTML = 'แทน <i class="var">x</i> ด้วย ' + c.value + ' ในสมการเริ่มต้น ' + math(app.startText);
      return;
    }
    var bal = M.isBalanced(app.state);
    card.classList.remove('checking');
    card.classList.toggle('unbalanced', !bal);
    el.eqLeft.innerHTML = math(M.formatSide(app.state.left));
    el.eqRight.innerHTML = math(M.formatSide(app.state.right));
    el.eqRel.textContent = bal ? '=' : NEQ;
    el.eqStart.innerHTML = 'สมการเริ่มต้น ' + math(app.startText);
  }

  function renderStatus(dir) {
    el.status.className = 'status ' + (dir === 0 ? 'is-balanced' : 'is-unbalanced');
    el.status.innerHTML = dir === 0
      ? '<span class="status-icon" aria-hidden="true">⚖</span> สมดุล'
      : '<span class="status-icon" aria-hidden="true">' + (dir < 0 ? '◣' : '◢') + '</span> ไม่สมดุล · ' + DIR_TEXT[dir];
  }

  function describeScale() {
    if (app.checking) {
      var eq = app.startEq, v = app.checking.value;
      el.scaleTitle.textContent = 'ตาชั่งเมื่อแทน x ด้วย ' + v + ': ข้างซ้ายมี' + sideDescription(eq.left, v) +
        ' ข้างขวามี' + sideDescription(eq.right, v) + ' ' + DIR_TEXT[app.checking.direction];
      return;
    }
    var s = app.state;
    el.scaleTitle.textContent = 'ตาชั่ง: ข้างซ้ายมี' + sideDescription(s.left) + ' ข้างขวามี' +
      sideDescription(s.right) + ' — ' + DIR_TEXT[M.tilt(s)];
  }

  function renderScaleNow() {
    if (app.checking) {
      drawPans(app.startEq.left, app.startEq.right, null, null, app.checking.value);
    } else {
      drawPans(app.state.left, app.state.right);
    }
    describeScale();
  }

  // ---------- ข้อความตอบกลับ ----------
  var ICON = { ok: '✓', warn: '⚠', err: '✕', info: 'i' };
  function setFeedback(kind, htmlLines) {
    el.feedback.className = 'feedback fb-' + kind;
    el.feedback.innerHTML = '<span class="fb-icon" aria-hidden="true">' + ICON[kind] + '</span><div>' +
      htmlLines.map(function (l) { return '<p>' + l + '</p>'; }).join('') + '</div>';
  }

  var LEGEND_X = '<svg viewBox="0 0 20 20" class="lg-x" aria-hidden="true"><rect x="1" y="1" width="18" height="18" rx="3"/><text x="10" y="10.5">x</text></svg>';
  var LEGEND_U = '<svg viewBox="0 0 12 12" class="lg-u" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="2"/></svg>';

  function introFeedback() {
    setFeedback('info', [
      '<b>เป้าหมาย:</b> ทำให้เหลือกล่อง <i class="var">x</i> 1 กล่องอยู่ตามลำพังบนจานข้างหนึ่ง โดยที่ตาชั่งยังสมดุล',
      LEGEND_X + ' กล่อง <i class="var">x</i> ทุกกล่องหนักเท่ากัน (ยังไม่รู้ว่าเท่าไร) · ' + LEGEND_U + ' ก้อนเล็กหนักก้อนละ 1'
    ]);
  }

  function feedbackAfter(prev, next, action, prediction) {
    var prevBal = M.isBalanced(prev), nextBal = M.isBalanced(next), dir = M.tilt(next);
    var lines = [], kind;
    if (prediction != null) {
      var right = prediction === dir;
      lines.push('คุณทายว่า “' + DIR_TEXT[prediction] + '” · ผลจริง: <b>' + DIR_TEXT[dir] + '</b> ' +
        (right ? '— ทายถูก ✓' : '— ทายไม่ตรง ✗'));
    }
    if (action.target === 'both') {
      if (prevBal) {
        kind = 'ok';
        lines.push('<b>ทำแบบเดียวกันทั้งสองข้าง ตาชั่งยังสมดุล</b> (' + M.PROPERTY[action.op] + ')');
        if (!M.isSolved(next)) {
          if (action.op === 'add') lines.push('สมการยังเป็นจริง แต่ข้างที่มี <i class="var">x</i> มีก้อนมากขึ้น — จะให้ <i class="var">x</i> อยู่ตามลำพัง ควร “เพิ่ม” หรือ “นำออก”?');
          if (action.op === 'mul') lines.push('สมการยังเป็นจริง แต่กล่อง <i class="var">x</i> มีมากขึ้น — จะให้เหลือ <i class="var">x</i> กล่องเดียว ควร “คูณ” หรือ “แบ่งกลุ่ม”?');
        }
      } else {
        kind = nextBal ? 'ok' : 'warn';
        lines.push(nextBal
          ? '<b>ตาชั่งกลับมาสมดุลแล้ว</b>'
          : '<b>ทำแบบเดียวกันทั้งสองข้าง แต่ตาชั่งยังไม่สมดุล</b> เพราะก่อนหน้านี้ตาชั่งไม่สมดุลอยู่แล้ว');
      }
    } else {
      var name = M.SIDE_NAME[action.target];
      if (nextBal) {
        kind = 'ok';
        lines.push('<b>ตาชั่งกลับมาสมดุลอีกครั้ง</b>');
      } else {
        kind = 'warn';
        lines.push('<b>ตาชั่งไม่สมดุล!</b> ทำกับ' + name + 'เพียงข้างเดียว ตอนนี้' + DIR_TEXT[dir] +
          ' ข้างซ้ายและข้างขวาจึงไม่เท่ากัน (' + NEQ + ')');
        if (prevBal) lines.push('ลองคิดดู: ต้องทำอย่างไรตาชั่งจึงจะกลับมาสมดุล?');
      }
    }
    if (M.isSolved(next)) {
      lines.push('🎉 <b><i class="var">x</i> อยู่ตามลำพังและตาชั่งสมดุล</b> ได้ ' + math(M.formatEquation(next)) +
        ' — ลองตรวจสอบคำตอบโดยแทนค่า <i class="var">x</i> ในสมการเริ่มต้น');
    }
    setFeedback(kind, lines);
  }

  // ---------- แผงควบคุม ----------
  var K_LIMITS = { sub: [1, M.LIMITS.maxAmount], add: [1, M.LIMITS.maxAmount], div: [2, M.LIMITS.maxFactor], mul: [2, M.LIMITS.maxFactor] };
  var K_LABEL = { sub: ['นำออก', 'ก้อน'], add: ['เพิ่ม', 'ก้อน'], div: ['แบ่งเป็น', 'กลุ่ม'], mul: ['คูณด้วย', ''] };

  function clampK() {
    var lim = K_LIMITS[app.op] || [1, M.LIMITS.maxAmount];
    app.k = Math.max(lim[0], Math.min(lim[1], app.k));
    return lim;
  }

  function renderControls() {
    var locked = !!app.checking || app.busy;
    el.opBtns.forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.op === app.op));
      b.disabled = locked;
    });
    el.targetBtns.forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.target === app.target));
      b.disabled = locked;
    });
    var lim = clampK();
    el.kValue.textContent = app.k;
    var lab = K_LABEL[app.op] || ['จำนวน', ''];
    el.amountLabel.textContent = lab[0];
    el.kUnit.textContent = lab[1];
    el.kMinus.disabled = locked || app.k <= lim[0];
    el.kPlus.disabled = locked || app.k >= lim[1];

    if (app.op && app.target) {
      el.go.textContent = actionSentence(app.op, app.k, app.target);
      el.go.disabled = locked;
    } else {
      el.go.textContent = !app.op ? 'เลือกการกระทำก่อน' : 'เลือกว่าจะทำกับข้างใด';
      el.go.disabled = true;
    }
    el.undo.disabled = locked || app.history.length === 0;
    el.reset.disabled = locked || app.history.length === 0;
    el.predictToggle.checked = app.predict;
    el.stepBtn.disabled = locked;
    el.solveBtn.disabled = locked;
  }

  // ---------- บันทึกขั้นตอน ----------
  function opSideHTML(s, action, hit) {
    if (!hit) return math(M.formatSide(s));
    if (action.op === 'div') {
      return '<span class="frac"><span class="frac-n">' + math(M.formatSide(s)) + '</span><span class="frac-d">' + action.k + '</span></span>';
    }
    return math(M.formatOpSide(s, action));
  }

  function renderLog() {
    var visible = app.logAlways || app.logRevealed;
    el.logGate.hidden = visible;
    el.logBox.hidden = !visible;
    el.logHide.hidden = app.logAlways;
    if (!visible) return;
    var html = ['<li class="log-start"><span class="log-eq">' + math(app.startText) + '</span><span class="log-why">สมการเริ่มต้น</span></li>'];
    app.log.forEach(function (e) {
      var hitL = e.action.target !== 'right', hitR = e.action.target !== 'left';
      var rel = e.step.balanced ? '=' : NEQ;
      var cls = e.step.balanced ? '' : ' log-bad';
      html.push('<li class="log-op' + cls + '"><span class="log-eq">' + opSideHTML(e.before.left, e.action, hitL) +
        ' <span class="rel">' + rel + '</span> ' + opSideHTML(e.before.right, e.action, hitR) + '</span>' +
        '<span class="log-why">' + (e.step.balanced ? '' : '⚠ ') + esc(e.step.reason) + '</span></li>');
      html.push('<li class="log-res' + cls + '"><span class="log-eq">' + math(e.step.resultLine) + '</span></li>');
    });
    el.logList.innerHTML = html.join('');
  }

  // ---------- โหลดสมการ ----------
  function loadEquation(text) {
    var p = M.parseEquation(text);
    if (!p.ok) return p;
    app.startEq = p.eq;
    app.startText = p.text;
    app.state = M.createState(p.eq);
    app.history = [];
    app.log = [];
    app.logRevealed = false;
    app.checking = null;
    app.target = null;
    el.checkResult.innerHTML = '';
    el.checkInput.value = '';
    $('checkHint').innerHTML = 'แทนค่า <i class="var">x</i> ลงในสมการเริ่มต้น ' + math(app.startText) + ' แล้วดูว่าตาชั่งสมดุลหรือไม่';
    el.checkBanner.hidden = true;
    el.logConfirm.hidden = true;
    renderScaleNow();
    setAngle(M.tiltAngle(app.state));
    renderEquation();
    renderStatus(M.tilt(app.state));
    renderControls();
    renderLog();
    introFeedback();
    return p;
  }

  // ---------- การกระทำ ----------
  function marksFor(prev, next, action) {
    var marks = { left: {}, right: {} };
    ['left', 'right'].forEach(function (key) {
      if (action.target !== 'both' && action.target !== key) return;
      var a = prev[key], b = next[key];
      if (action.op === 'sub' || action.op === 'div') marks[key] = { leaveC: a.c - b.c, leaveN: a.n - b.n };
      else marks[key] = { enterC: b.c - a.c, enterN: b.n - a.n };
    });
    return marks;
  }

  function commit(result, action, prediction) {
    var prev = app.state, next = result.state;
    app.history.push(prev);
    app.state = next;
    app.log.push({ before: prev, action: action, step: result.step });
    app.target = null;
    app.busy = true;
    renderControls();

    var marks = marksFor(prev, next, action);
    var removing = action.op === 'sub' || action.op === 'div';
    var p;
    if (removing && !reduceMotion) {
      drawPans(prev.left, prev.right, marks.left, marks.right);
      p = wait(420).then(function () { drawPans(next.left, next.right); });
    } else {
      drawPans(next.left, next.right, marks.left, marks.right);
      p = wait(120);
    }
    return p.then(function () {
      animateAngle(M.tiltAngle(next));
      renderEquation();
      renderStatus(M.tilt(next));
      describeScale();
      feedbackAfter(prev, next, action, prediction);
      renderLog();
      return wait(500);
    }).then(function () {
      app.busy = false;
      renderControls();
    });
  }

  function tryAction(action, prediction) {
    var r = M.applyAction(app.state, action);
    if (!r.ok) {
      setFeedback('err', ['<b>ทำแบบนี้ไม่ได้</b>', esc(r.message)]);
      return Promise.resolve(false);
    }
    return commit(r, action, prediction).then(function () { return true; });
  }

  function onGo() {
    if (app.busy || app.checking || !app.op || !app.target) return;
    var action = { op: app.op, k: app.k, target: app.target };
    var test = M.applyAction(app.state, action);
    if (!test.ok) { setFeedback('err', ['<b>ทำแบบนี้ไม่ได้</b>', esc(test.message)]); return; }
    if (app.predict && action.target !== 'both') {
      app.pending = action;
      el.predictQuestion.textContent = 'ถ้า' + actionSentence(action.op, action.k, action.target) + ' ตาชั่งจะเป็นอย่างไร?';
      openDialog(el.predictDialog);
      return;
    }
    tryAction(action, null);
  }

  function onPredict(dir) {
    var action = app.pending;
    app.pending = null;
    closeDialog(el.predictDialog);
    if (!action) return;
    tryAction(action, dir).then(function () { el.go.focus(); });
  }

  function onUndo() {
    if (app.busy || !app.history.length) return;
    app.state = app.history.pop();
    app.log.pop();
    renderScaleNow();
    animateAngle(M.tiltAngle(app.state));
    renderEquation();
    renderStatus(M.tilt(app.state));
    renderControls();
    renderLog();
    setFeedback('info', ['ย้อนกลับ 1 ขั้น · ตอนนี้ตาชั่ง' + (M.isBalanced(app.state) ? 'สมดุล' : 'ไม่สมดุล (' + DIR_TEXT[M.tilt(app.state)] + ')')]);
  }

  function onReset() {
    if (app.busy) return;
    loadEquation(app.startText);
    setFeedback('info', ['เริ่มใหม่ที่สมการ ' + math(app.startText)]);
  }

  // ---------- ตรวจสอบคำตอบ ----------
  function onCheck(ev) {
    ev.preventDefault();
    if (app.busy) return;
    var raw = el.checkInput.value.trim();
    var msg = null;
    if (raw === '') msg = 'พิมพ์ค่าของ x ที่หาได้ก่อน';
    else if (!/^\d+$/.test(raw)) msg = 'กิจกรรมนี้ใช้เฉพาะจำนวนเต็มบวก (เช่น 4)';
    else if (parseInt(raw, 10) > 999) msg = 'ตัวเลขมากเกินไป ลองตัวเลขที่ไม่เกิน 999';
    if (msg) { el.checkResult.innerHTML = '<p class="form-error">' + esc(msg) + '</p>'; return; }
    var v = parseInt(raw, 10);
    var c = M.checkAnswer(app.startEq, v);
    app.checking = c;
    el.checkBanner.hidden = false;
    el.checkBannerText.innerHTML = 'กำลังตรวจสอบ: แทน <i class="var">x</i> ด้วย ' + v;
    drawPans(app.startEq.left, app.startEq.right, null, null, v);
    animateAngle(c.angle);
    renderEquation();
    renderStatus(c.direction);
    describeScale();
    renderControls();
    var verdict = c.balanced
      ? '<p class="check-ok"><b>' + c.leftValue + ' = ' + c.rightValue + '</b> ตาชั่งสมดุล ✓ ดังนั้น ' + v + ' เป็นคำตอบของสมการ</p>'
      : '<p class="check-bad"><b>' + c.leftValue + ' ' + NEQ + ' ' + c.rightValue + '</b> ตาชั่งไม่สมดุล ✗ ดังนั้น ' + v + ' ไม่ใช่คำตอบของสมการ</p>';
    el.checkResult.innerHTML =
      '<p>แทน <i class="var">x</i> ด้วย ' + v + ' ในสมการ ' + math(app.startText) + '</p>' +
      '<p>ข้างซ้าย: ' + math(c.leftText) + (c.leftText !== String(c.leftValue) ? ' = ' + c.leftValue : '') + '</p>' +
      '<p>ข้างขวา: ' + math(c.rightText) + (c.rightText !== String(c.rightValue) ? ' = ' + c.rightValue : '') + '</p>' +
      verdict +
      '<button type="button" class="btn btn-small" data-exit-check>กลับไปที่ตาชั่ง</button>';
    setFeedback(c.balanced ? 'ok' : 'warn', [c.balanced
      ? 'แทนค่าแล้วตาชั่งสมดุล — <b>' + v + ' เป็นคำตอบของสมการ</b>'
      : 'แทนค่าแล้วตาชั่งไม่สมดุล (' + DIR_TEXT[c.direction] + ') — ' + v + ' ยังไม่ใช่คำตอบ']);
  }

  function exitCheck() {
    if (!app.checking) return;
    app.checking = null;
    el.checkBanner.hidden = true;
    el.checkResult.innerHTML = '';
    renderScaleNow();
    animateAngle(M.tiltAngle(app.state));
    renderEquation();
    renderStatus(M.tilt(app.state));
    renderControls();
    setFeedback('info', ['กลับมาที่ตาชั่งแล้ว · ' + math(M.formatEquation(app.state))]);
    el.checkInput.focus();
  }

  // ---------- โหมดครู ----------
  function teacherStep() {
    if (app.busy || app.checking) return Promise.resolve(false);
    var a = M.nextStep(app.state);
    if (!a) {
      setFeedback('info', [M.isSolved(app.state)
        ? 'แก้สมการเสร็จแล้ว: ' + math(M.formatEquation(app.state))
        : 'ตาชั่งไม่สมดุล — กด “ย้อนกลับ” หรือ “เริ่มใหม่” ก่อน']);
      return Promise.resolve(false);
    }
    app.op = a.op; app.k = a.k; app.target = a.target;
    renderControls();
    return tryAction(a, null);
  }

  function teacherSolve() {
    function loop() {
      return teacherStep().then(function (did) {
        if (did && !M.isSolved(app.state)) return wait(700).then(loop);
      });
    }
    loop();
  }

  function applyTeacherMode() {
    el.teacherCard.hidden = !app.teacher;
    el.teacherFlag.hidden = !app.teacher;
    el.customForm.hidden = !app.teacher;
    el.logAlwaysToggle.checked = app.logAlways;
  }

  // ---------- กล่องโต้ตอบ ----------
  function openDialog(d) {
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
  }
  function closeDialog(d) {
    if (typeof d.close === 'function') d.close();
    else d.removeAttribute('open');
  }

  function buildPresets() {
    M.PRESETS.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn preset-btn';
      b.innerHTML = math(p.text);
      b.addEventListener('click', function () {
        loadEquation(p.text);
        closeDialog(el.eqDialog);
        el.go.focus();
      });
      (p.part === 1 ? el.presets1 : el.presets2).appendChild(b);
    });
  }

  function studentLink(text) {
    return location.href.split(/[?#]/)[0] + '?eq=' + encodeURIComponent(text.replace(/\s+/g, ''));
  }
  function updateShare() {
    el.shareBox.hidden = false;
    el.shareLink.value = studentLink(app.startText);
    el.copyLink.textContent = 'คัดลอก';
  }

  // ---------- ผูกเหตุการณ์ ----------
  function bind() {
    el.opBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        var op = b.dataset.op;
        if (op !== app.op && (op === 'div' || op === 'mul') && app.k < 2) app.k = 2;
        app.op = op;
        renderControls();
      });
    });
    el.targetBtns.forEach(function (b) {
      b.addEventListener('click', function () { app.target = b.dataset.target; renderControls(); });
    });
    el.kMinus.addEventListener('click', function () { app.k--; renderControls(); });
    el.kPlus.addEventListener('click', function () { app.k++; renderControls(); });
    el.go.addEventListener('click', onGo);
    el.undo.addEventListener('click', onUndo);
    el.reset.addEventListener('click', onReset);
    el.predictToggle.addEventListener('change', function () { app.predict = el.predictToggle.checked; });

    el.checkForm.addEventListener('submit', onCheck);
    el.exitCheck.addEventListener('click', exitCheck);
    el.checkResult.addEventListener('click', function (e) {
      if (e.target.closest('[data-exit-check]')) exitCheck();
    });

    el.logAsk.addEventListener('click', function () { el.logConfirm.hidden = false; el.logYes.focus(); });
    el.logNo.addEventListener('click', function () { el.logConfirm.hidden = true; el.logAsk.focus(); });
    el.logYes.addEventListener('click', function () { app.logRevealed = true; el.logConfirm.hidden = true; renderLog(); el.logHide.focus(); });
    el.logHide.addEventListener('click', function () { app.logRevealed = false; renderLog(); el.logAsk.focus(); });

    el.logAlwaysToggle.addEventListener('change', function () { app.logAlways = el.logAlwaysToggle.checked; renderLog(); });
    el.stepBtn.addEventListener('click', teacherStep);
    el.solveBtn.addEventListener('click', teacherSolve);
    el.revealBtn.addEventListener('click', function () {
      setFeedback('info', ['(โหมดครู) ค่าของ <i class="var">x</i> ในสมการ ' + math(app.startText) + ' คือ <b>' + app.state.x + '</b>']);
    });

    el.openEq.addEventListener('click', function () {
      if (app.teacher) updateShare();
      openDialog(el.eqDialog);
    });
    el.customForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var r = loadEquation(el.customInput.value);
      if (!r.ok) { el.customError.textContent = r.error; return; }
      el.customError.textContent = '';
      updateShare();
      setFeedback('info', ['ใช้สมการ ' + math(r.text) + ' แล้ว']);
    });
    el.copyLink.addEventListener('click', function () {
      var done = function () { el.copyLink.textContent = 'คัดลอกแล้ว ✓'; };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(el.shareLink.value).then(done, function () { el.shareLink.select(); });
      } else {
        el.shareLink.select();
        try { if (document.execCommand('copy')) done(); } catch (err) { /* ผู้ใช้คัดลอกเองได้ */ }
      }
    });

    [el.eqDialog, el.predictDialog].forEach(function (d) {
      d.addEventListener('click', function (e) {
        if (e.target === d || e.target.closest('[data-close]')) { closeDialog(d); app.pending = null; }
      });
      d.addEventListener('cancel', function () { app.pending = null; });
    });
    [].forEach.call(document.querySelectorAll('[data-predict]'), function (b) {
      b.addEventListener('click', function () { onPredict(parseInt(b.dataset.predict, 10)); });
    });

    el.bigToggle.addEventListener('click', function () { setBig(!document.documentElement.classList.contains('big')); });
  }

  function setBig(on) {
    document.documentElement.classList.toggle('big', on);
    el.bigToggle.setAttribute('aria-pressed', String(on));
  }

  // ---------- ออฟไลน์ (เฉพาะเมื่อเปิดผ่าน http/https) ----------
  function setupOffline() {
    if (!/^https?:$/.test(location.protocol)) return;
    var link = document.createElement('link');
    link.rel = 'manifest';
    link.href = 'manifest.webmanifest';
    document.head.appendChild(link);
    // ไม่ใช้ service worker บนเครื่องที่กำลังพัฒนา เพื่อให้เห็นไฟล์ที่แก้ไขทันที
    var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    if ('serviceWorker' in navigator && !local) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () { /* ใช้งานต่อได้แม้ลงทะเบียนไม่สำเร็จ */ });
      });
    }
  }

  // ---------- เริ่มต้น ----------
  function init() {
    buildPresets();
    bind();
    applyTeacherMode();
    setBig(flag(params.big));
    var first = M.PRESETS[0].text, urlError = null;
    if (params.eq) {
      var p = M.parseEquation(params.eq);
      if (p.ok) first = p.text; else urlError = p.error;
    }
    loadEquation(first);
    if (urlError) setFeedback('err', ['สมการในลิงก์ใช้ไม่ได้: ' + esc(urlError), 'จึงเปิดสมการ ' + math(first) + ' แทน']);
    setupOffline();
  }

  init();
})();
