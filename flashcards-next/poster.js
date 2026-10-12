/* flashcards/poster.js — the pictures students can keep and share (drawn on a canvas, nothing uploaded).
   Poster.drawMonth(canvas, month)   1080 × 1350 month poster, style "เส้นทาง": every day of the month on a
                                     winding path, streaks as thick bars, one shape per day:
                                     ● ทวนครบ  ■ ทวนแล้ว  ▲ วันเรียนใหม่  ◆ วันพิเศษ (milestone); size = cards answered
   Poster.drawStreak(canvas, card)   1080 × 1080 streak card for a milestone (3, 7, 14, 30, 60, 100 days)
   month = { y, m, days: [{ d, kind|null, n, rest, on, future, today }], studied, cards, best }
   card  = { count, date: 'YYYY-MM-DD', strip: [kind|'rest'|null …] (the days leading up to it) }
   Colours follow the student's palette (CSS variables); the paper is always light so a shared
   picture looks the same everywhere. */
(function (root) {
  'use strict';

  const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const KIND_SHAPE = { cleared: 'ps', steady: 'sh', fresh: 'jh', special: 'uni' };
  const KIND_LABEL = { cleared: 'ทวนครบ', steady: 'ทวนแล้ว', fresh: 'วันเรียนใหม่', special: 'วันพิเศษ' };
  const LEGEND = ['cleared', 'steady', 'fresh', 'special'];
  const PAPER = { paper: '#F4F5FA', ink: '#15163A', muted: '#7D809C', faint: '#D6D9E8', rule: '#E3E6F2' };
  const font = (w, px) => w + ' ' + px + 'px Prompt, "Noto Sans Thai", sans-serif';

  function colors() {
    const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
    return Object.assign({ ps: v('--lv-ps') || '#FFC229', jh: v('--lv-jh') || '#CF3A1D', sh: v('--lv-sh') || '#2D3A8C', uni: v('--lv-uni') || '#0B7A54',
      brand: v('--brand') || '#2D3A8C', sun: v('--sun') || '#FFC229' }, PAPER);
  }
  // Make sure the Thai font is ready before drawing text on the canvas
  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([font(800, 100), font(600, 30), font(500, 30)].map(f => document.fonts.load(f, 'กขค 0123'))).catch(() => {});
  }

  function shape(ctx, kind, cx, cy, size, color) {
    const r = size / 2;
    ctx.fillStyle = color; ctx.beginPath();
    if (kind === 'ps') ctx.arc(cx, cy, r, 0, Math.PI * 2);
    else if (kind === 'jh') { ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy + r * .82); ctx.lineTo(cx - r, cy + r * .82); ctx.closePath(); }
    else if (kind === 'sh') { const s = r * .84; if (ctx.roundRect) ctx.roundRect(cx - s, cy - s, 2 * s, 2 * s, size * .05); else ctx.rect(cx - s, cy - s, 2 * s, 2 * s); }
    else { ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * .82, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r * .82, cy); ctx.closePath(); }
    ctx.fill();
  }
  function restMark(ctx, cx, cy, r, color) {
    ctx.save(); ctx.setLineDash([r * .38, r * .3]); ctx.lineWidth = Math.max(3, r * .14); ctx.strokeStyle = color;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  const daySize = (base, n) => base * Math.min(1, .55 + n / 80);

  // 1080 × 1350: header 0–230 · numbers 270–420 · path 470–1170 · legend 1222 · name 1300
  const X0 = 84, WIDE = 1080 - 168, BODY_TOP = 470, BODY_BOTTOM = 1170;
  function drawMonth(canvas, month) {
    const p = colors(), ctx = canvas.getContext('2d');
    canvas.width = 1080; canvas.height = 1350;
    ctx.fillStyle = p.paper; ctx.fillRect(0, 0, 1080, 1350);

    // header: month + year, with the sun cropped by the corner
    ctx.fillStyle = p.brand; ctx.fillRect(0, 0, 1080, 230);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 1080, 230); ctx.clip();
    ctx.fillStyle = p.sun; ctx.beginPath(); ctx.arc(1030, 40, 180, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'left';
    ctx.font = font(800, 100); ctx.fillText(MONTHS[month.m - 1], X0, 148);
    ctx.font = font(500, 36); ctx.globalAlpha = .85; ctx.fillText('พ.ศ. ' + (month.y + 543), X0 + 4, 200); ctx.globalAlpha = 1;

    // three numbers, each with room of its own
    const cols = [[month.studied, 'วันที่ทวน'], [month.cards, 'ใบที่ตอบ'], [month.best, 'วันต่อเนื่องสูงสุด']], cw = WIDE / 3;
    cols.forEach(([v, label], i) => {
      const x = X0 + cw * i;
      if (i) { ctx.fillStyle = p.rule; ctx.fillRect(x - 1, 290, 2, 110); }
      ctx.textAlign = 'center'; ctx.fillStyle = p.ink; ctx.font = font(800, 80); ctx.fillText(String(v), x + cw / 2, 362);
      ctx.fillStyle = p.muted; ctx.font = font(500, 28); ctx.fillText(label, x + cw / 2, 404);
    });
    ctx.fillStyle = p.rule; ctx.fillRect(X0, 440, WIDE, 2);

    // the path: 7 days a row, back and forth
    const per = 7, rows = Math.ceil(month.days.length / per), x0 = X0 + 40, dx = (WIDE - 80) / (per - 1);
    // rows of shapes from y 520 to 1080, leaving room under the last row for its day numbers
    const span = BODY_BOTTOM - BODY_TOP - 140, dy = Math.min(150, span / Math.max(1, rows - 1)), y0 = BODY_TOP + 50 + (span - dy * (rows - 1)) / 2;
    const pos = month.days.map((x, i) => { const r = Math.floor(i / per), c = i % per; return { x: x0 + dx * (r % 2 ? per - 1 - c : c), y: y0 + dy * r }; });
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = p.faint; ctx.lineWidth = 6;
    ctx.beginPath(); pos.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
    ctx.strokeStyle = p.ink; ctx.lineWidth = 18;
    for (let i = 1; i < month.days.length; i++) {
      if (month.days[i - 1].on && month.days[i].on) { ctx.beginPath(); ctx.moveTo(pos[i - 1].x, pos[i - 1].y); ctx.lineTo(pos[i].x, pos[i].y); ctx.stroke(); }
    }
    month.days.forEach((x, i) => {
      const q = pos[i];
      if (x.kind) { const s = KIND_SHAPE[x.kind]; shape(ctx, s, q.x, q.y, daySize(92, x.n), p[s]); }
      else if (x.rest) { ctx.fillStyle = p.paper; ctx.beginPath(); ctx.arc(q.x, q.y, 24, 0, Math.PI * 2); ctx.fill(); restMark(ctx, q.x, q.y, 20, p.muted); }
      else { ctx.fillStyle = x.future ? p.faint : p.muted; ctx.beginPath(); ctx.arc(q.x, q.y, 7, 0, Math.PI * 2); ctx.fill(); }
      ctx.font = font(x.today ? 800 : 500, 22); ctx.textAlign = 'center';
      const tw = ctx.measureText(String(x.d)).width; // a little paper behind the number, so a bar never runs through it
      ctx.fillStyle = p.paper; ctx.fillRect(q.x - tw / 2 - 6, q.y + 52, tw + 12, 28);
      ctx.fillStyle = x.future ? p.faint : x.today ? p.ink : p.muted; ctx.fillText(String(x.d), q.x, q.y + 72);
    });

    // legend + app name
    ctx.fillStyle = p.rule; ctx.fillRect(X0, 1180, WIDE, 2);
    const lw = WIDE / 4;
    LEGEND.forEach((k, i) => {
      const x = X0 + lw * i + 26, s = KIND_SHAPE[k];
      shape(ctx, s, x, 1213, 30, p[s]);
      ctx.fillStyle = p.ink; ctx.font = font(500, 26); ctx.textAlign = 'left'; ctx.fillText(KIND_LABEL[k], x + 28, 1222);
    });
    ctx.fillStyle = p.muted; ctx.font = font(600, 26); ctx.textAlign = 'center'; ctx.fillText('บัตรคำคณิตศาสตร์', 540, 1300);
    ctx.textAlign = 'left';
  }

  function drawStreak(canvas, card) {
    const p = colors(), ctx = canvas.getContext('2d'), W = 1080;
    canvas.width = W; canvas.height = W;
    ctx.fillStyle = p.brand; ctx.fillRect(0, 0, W, W);
    ctx.fillStyle = p.sun; ctx.beginPath(); ctx.arc(W / 2, 420, 260, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PAPER.ink; ctx.textAlign = 'center'; ctx.font = font(800, card.count >= 100 ? 200 : 250); ctx.fillText(String(card.count), W / 2, card.count >= 100 ? 490 : 505);
    ctx.fillStyle = '#FFFFFF'; ctx.font = font(800, 72); ctx.fillText('วันต่อเนื่อง', W / 2, 790);
    const strip = card.strip || [], step = 62, x0 = W / 2 - step * (strip.length - 1) / 2;
    strip.forEach((k, i) => {
      const x = x0 + step * i;
      if (k === 'rest') restMark(ctx, x, 890, 14, 'rgba(255,255,255,.7)');
      else if (k) { const s = KIND_SHAPE[k]; shape(ctx, s, x, 890, 42, s === 'sh' ? '#FFFFFF' : p[s]); } // the blue square would vanish on blue
    });
    const [y, mo, d] = card.date.split('-').map(Number);
    ctx.font = font(500, 30); ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillText(d + ' ' + MONTHS[mo - 1] + ' ' + (y + 543) + ' · บัตรคำคณิตศาสตร์', W / 2, 1000);
    ctx.textAlign = 'left';
  }

  root.Poster = { drawMonth, drawStreak, fontsReady, MONTHS, KIND_SHAPE, KIND_LABEL };
})(typeof window !== 'undefined' ? window : globalThis);
