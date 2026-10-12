/* flashcards/celebrate.js — the end-of-round celebration, sound and vibration.
   Three styles the student picks in settings (ring is the default):
     ring  — today's goal ring fills to "X จาก Y ใบ"; when the day is cleared it closes with a ripple
     stack — the four level shapes drop in and stack; the diamond balances on the triangle's tip
     burst — a sun bursts into confetti made of the four shapes
   "full" = nothing left to review today (the big version); otherwise a shorter, quieter one.
   Sound and vibration are off unless the student turns them on. Everything is skippable
   (tap), and with reduced motion only the final picture fades in.

   Celebrate.play({ art, style, full, done, goal, shape, sound, vibe, reduce, onReveal, onStreak })
     art      element (about 240 × 132) the picture is drawn in
     shape    level code of the round (ps | jh | sh | uni), shown in the closed ring
     onReveal called when the text under the picture should appear
     onStreak called when the streak number should tick up
     layer    where the confetti canvas goes (default: the page; pass an open dialog)
   → { skip(), playing() } */
(function (root) {
  'use strict';

  /* ---------- sound: tiny synthesised notes, nothing to download ---------- */
  let ac = null;
  function audio(on) {
    if (!on) return null;
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
    } catch (e) { return null; }
    return ac;
  }
  // Call from a tap/key handler so iPhones allow sound later in the round
  function unlock(on) { const a = audio(on); if (a && a.state === 'suspended') a.resume(); }
  const NOTE = { C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5, E6: 1318.5, G6: 1568 };
  function tone(on, f, o) {
    const a = audio(on); if (!a) return;
    o = Object.assign({ dur: .45, type: 'sine', vol: .14, at: 0 }, o || {});
    const t = a.currentTime + o.at, osc = a.createOscillator(), g = a.createGain();
    osc.type = o.type; osc.frequency.value = f;
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol, t + .012);
    g.gain.exponentialRampToValueAtTime(.0001, t + o.dur);
    osc.connect(g).connect(a.destination); osc.start(t); osc.stop(t + o.dur + .05);
  }
  const chord = (on, notes) => notes.forEach((n, i) => tone(on, NOTE[n], { at: i * .03, dur: 1.1, vol: .08, type: i ? 'sine' : 'triangle' }));
  function pop(on) {
    const a = audio(on); if (!a) return;
    const len = Math.floor(a.sampleRate * .09), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf; bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = .8; g.gain.value = .45;
    src.connect(bp).connect(g).connect(a.destination); src.start();
  }
  const canVibrate = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  function buzz(on, pattern) { if (on && canVibrate()) { try { navigator.vibrate(pattern); } catch (e) { /* ignore */ } } }

  /* ---------- helpers ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  function shapeEl(code, x, y, w, h) {
    const el = document.createElement('span');
    el.className = 'shape ' + code + ' cel-shape';
    Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    return el;
  }
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  // A full-screen canvas for the confetti, created on first use. `layer` = where it lives:
  // the page, or an open dialog (a modal dialog covers everything outside it).
  let canvas = null;
  function fxCanvas(layer) {
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'cel-canvas';
      canvas.setAttribute('aria-hidden', 'true');
    }
    const host = layer || document.body;
    if (canvas.parentNode !== host) host.appendChild(canvas);
    return canvas;
  }

  /* ---------- the pictures (final state) ---------- */
  // Stack: positions inside a 240 × 132 box, ground = bottom edge
  const STACK = [
    { code: 'sh', x: 64, y: 66, w: 66, h: 66, note: 'C5' },
    { code: 'jh', x: 136, y: 70, w: 62, h: 62, note: 'E5' },
    { code: 'ps', x: 71, y: 14, w: 52, h: 52, note: 'G5' },
    { code: 'uni', x: 149, y: 30, w: 36, h: 40, note: 'C6' },
  ];
  function drawStack(art) {
    art.innerHTML = '<span class="cel-ground"></span>';
    return STACK.map(s => { const el = shapeEl(s.code, s.x, s.y, s.w, s.h); el.style.transformOrigin = '50% 100%'; art.appendChild(el); return el; });
  }
  function drawBurst(art) {
    art.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'cel-row';
    const items = [['ps', 44], ['jh', 52], ['sh', 44], ['uni', 52]].map(([c, s]) => {
      const el = document.createElement('span'); el.className = 'shape ' + c;
      el.style.width = el.style.height = s + 'px'; row.appendChild(el); return el;
    });
    const sun = shapeEl('ps', 75, 16, 90, 90);
    sun.classList.add('cel-sun');
    art.append(row, sun);
    return { items, sun };
  }
  const R = 50, CIRC = 2 * Math.PI * R;
  function drawRing(art, frac, done, goal, shape) {
    const full = frac >= 1;
    art.innerHTML =
      '<svg class="cel-ring" viewBox="0 0 132 132" width="132" height="132" aria-hidden="true">' +
        '<circle class="cel-rip" cx="66" cy="66" r="' + R + '" stroke-width="3" opacity="0"/>' +
        '<circle class="cel-rip" cx="66" cy="66" r="' + R + '" stroke-width="2" opacity="0"/>' +
        '<circle class="cel-track" cx="66" cy="66" r="' + R + '" stroke-width="12"/>' +
        '<circle class="cel-fill" cx="66" cy="66" r="' + R + '" stroke-width="12" transform="rotate(-90 66 66)" stroke-dasharray="' + CIRC + '" stroke-dashoffset="' + (CIRC * (1 - frac)) + '"/>' +
      '</svg>' +
      '<div class="cel-count"' + (full ? ' style="opacity:0"' : '') + '><b>' + done + '</b><span>จาก ' + goal + ' ใบ</span></div>';
    const s = shapeEl(shape, 96, 42, 48, 48);
    s.classList.add('cel-center');
    if (!full) s.style.opacity = 0;
    art.appendChild(s);
    return { fill: art.querySelector('.cel-fill'), rips: art.querySelectorAll('.cel-rip'), count: art.querySelector('.cel-count'), num: art.querySelector('.cel-count b'), center: s };
  }

  /* ---------- play ---------- */
  function play(o) {
    const art = o.art;
    const full = !!o.full;
    const frac = o.goal ? Math.min(1, o.done / o.goal) : 1;
    let timers = [], anims = [], raf = 0, particles = [], playing = true;
    const later = (ms, fn) => timers.push(setTimeout(fn, ms));
    const anim = (el, frames, opts) => { const a = el.animate(frames, Object.assign({ fill: 'both' }, opts)); anims.push(a); return a; };
    const snd = !!o.sound, vib = !!o.vibe;
    const reveal = () => { if (o.onReveal) o.onReveal(); };
    const streak = () => { if (o.onStreak) o.onStreak(); };

    function drawFinal() {
      if (o.style === 'stack') drawStack(art);
      else if (o.style === 'burst') drawBurst(art).sun.style.opacity = 0;
      else drawRing(art, frac, o.done, o.goal, o.shape);
    }
    function stop() {
      timers.forEach(clearTimeout); timers = [];
      anims.forEach(a => { try { a.cancel(); } catch (e) { /* ignore */ } }); anims = [];
      cancelAnimationFrame(raf); raf = 0; particles = [];
      if (canvas) { const ctx = canvas.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
    }
    function skip() {
      if (!playing) return;
      playing = false; stop(); drawFinal(); reveal(); streak();
    }
    const finish = () => { playing = false; };

    if (o.reduce || !art.animate) {
      drawFinal();
      playing = false;
      reveal(); streak();
      if (full) { chord(snd, ['C5', 'E5', 'G5']); buzz(vib, 20); }
      return { skip() {}, playing: () => false };
    }

    if (o.style === 'stack') {
      const els = drawStack(art);
      const gap = full ? 300 : 110, drop = full ? 300 : 170, dur = full ? 720 : 520;
      els.forEach((el, i) => {
        const d = i * gap + (full && i === 3 ? 120 : 0);
        el.style.visibility = 'hidden'; // shows up only when its fall starts
        later(d, () => {
          el.style.visibility = '';
          anim(el, [
            { transform: 'translateY(-' + drop + 'px)', offset: 0, easing: 'cubic-bezier(.55,0,1,.45)' },
            { transform: 'translateY(0)', offset: .55, easing: 'ease-out' },
            { transform: 'translateY(0) scale(1.16,.8)', offset: .68, easing: 'ease-out' },
            { transform: 'translateY(-12px) scale(.95,1.05)', offset: .84, easing: 'ease-in' },
            { transform: 'none', offset: 1 },
          ], { duration: dur });
        });
        later(d + dur * .55, () => { if (full || i === 3) { tone(snd, NOTE[STACK[i].note], { dur: .5 }); buzz(vib, 12); } });
      });
      const end = 3 * gap + (full ? 120 : 0) + dur;
      if (full) later(end, () => anim(els[3], [{ transform: 'rotate(0)' }, { transform: 'rotate(11deg)' }, { transform: 'rotate(-8deg)' }, { transform: 'rotate(4deg)' }, { transform: 'rotate(-2deg)' }, { transform: 'rotate(0)' }], { duration: 900, easing: 'ease-out', fill: 'none' }));
      anim(art.querySelector('.cel-ground'), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 420, delay: end - 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
      later(end - 120, reveal);
      later(end + (full ? 500 : 250), () => { streak(); if (full) { chord(snd, ['C5', 'E5', 'G5', 'C6']); buzz(vib, [20, 40, 30]); } finish(); });
    } else if (o.style === 'burst') {
      const { items, sun } = drawBurst(art);
      anim(sun, [{ transform: 'scale(0)' }, { transform: 'scale(1.18)', offset: .7 }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
      later(80, () => tone(snd, NOTE.C5, { dur: .35, vol: .07, type: 'triangle' }));
      later(470, () => {
        anim(sun, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.5)', opacity: 0 }], { duration: 180, easing: 'ease-out' });
        const r = sun.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2, full ? 80 : 28, full);
        pop(snd); ['C6', 'E6', 'G6'].forEach((n, i) => tone(snd, NOTE[n], { at: .05 + i * .06, dur: .4, vol: .06 }));
        buzz(vib, full ? [25, 30, 45] : 20);
      });
      items.forEach((el, i) => anim(el, [{ opacity: 0, transform: 'translateY(24px) scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 620 + i * 80, easing: 'cubic-bezier(.2,1.3,.4,1)' }));
      later(820, reveal);
      later(1500, () => { streak(); if (full) chord(snd, ['C5', 'G5', 'C6']); });
      later(full ? 2900 : 2000, finish);
    } else {
      const g = drawRing(art, frac, 0, o.goal, o.shape);
      const dur = full ? 1200 : 900, target = o.done;
      g.count.style.opacity = 1; g.center.style.opacity = 0;
      anim(g.fill, [{ strokeDashoffset: CIRC }, { strokeDashoffset: CIRC * (1 - frac) }], { duration: dur, delay: 150, easing: 'cubic-bezier(.45,0,.2,1)' });
      const t0 = performance.now() + 150;
      let shown = 0;
      const tick = now => {
        const p = Math.max(0, Math.min(1, (now - t0) / dur));
        const e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        const v = Math.round(target * e);
        if (v !== shown) {
          shown = v; g.num.textContent = String(v);
          if (target && v % Math.max(1, Math.round(target / 5)) === 0) tone(snd, 440 * Math.pow(2, v / Math.max(target, 1)), { dur: .08, vol: .03, type: 'triangle' });
        }
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      const end = 150 + dur;
      if (full) {
        later(end, () => {
          anim(g.fill, [{ strokeWidth: 12 }, { strokeWidth: 17 }, { strokeWidth: 12 }], { duration: 380, easing: 'ease-out' });
          anim(g.count, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.6)' }], { duration: 180, easing: 'ease-in' });
          anim(g.center, [{ opacity: 0, transform: 'scale(0) rotate(-30deg)' }, { opacity: 1, transform: 'scale(1.2) rotate(6deg)', offset: .65 }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 120, easing: 'cubic-bezier(.2,.8,.2,1)' });
          [[0, 0, 1.68], [1, 140, 1.88]].forEach(([i, d, s]) =>
            anim(g.rips[i], [{ transform: 'scale(1)', opacity: .7 }, { transform: 'scale(' + s + ')', opacity: 0 }], { duration: 900, delay: d, easing: 'cubic-bezier(.2,.8,.2,1)' }));
          chord(snd, ['C5', 'E5', 'G5', 'C6']); buzz(vib, [15, 40, 25]);
        });
      } else {
        later(end, () => tone(snd, NOTE.E5, { dur: .4, vol: .07 }));
      }
      later(end - 200, reveal);
      later(end + (full ? 700 : 400), () => { streak(); finish(); });
    }

    function burst(x, y, n, big) {
      const c = fxCanvas(o.layer);
      const kinds = [['c', cssVar('--lv-ps')], ['t', cssVar('--lv-jh')], ['s', cssVar('--lv-sh')], ['d', cssVar('--lv-uni')]];
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2, sp = (big ? 260 : 180) + Math.random() * (big ? 520 : 300), k = kinds[i % 4];
        particles.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - (big ? 380 : 260), r: 5 + Math.random() * 7, rot: Math.random() * 6, vr: (Math.random() - .5) * 12, kind: k[0], color: k[1], age: 0 });
      }
      let last = performance.now();
      const step = now => {
        const dt = Math.min(.033, (now - last) / 1000); last = now;
        // particles live in viewport coordinates; the canvas may sit anywhere (e.g. in a dialog)
        const dpr = window.devicePixelRatio || 1, cr = c.getBoundingClientRect(), w = cr.width, h = cr.height;
        if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
        const ctx = c.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, -cr.left * dpr, -cr.top * dpr); ctx.clearRect(cr.left, cr.top, w, h);
        particles = particles.filter(p => p.y < cr.top + h + 30 && p.age < 3);
        particles.forEach(p => {
          p.age += dt; p.vy += 1500 * dt; p.vx *= (1 - 1.2 * dt); p.vy *= (1 - .6 * dt);
          p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.globalAlpha = Math.max(0, Math.min(1, (3 - p.age) / .5));
          ctx.fillStyle = p.color; ctx.beginPath();
          const r = p.r;
          if (p.kind === 'c') ctx.arc(0, 0, r, 0, Math.PI * 2);
          else if (p.kind === 't') { ctx.moveTo(0, -r); ctx.lineTo(r, r * .8); ctx.lineTo(-r, r * .8); }
          else if (p.kind === 's') ctx.rect(-r * .85, -r * .85, r * 1.7, r * 1.7);
          else { ctx.moveTo(0, -r); ctx.lineTo(r * .8, 0); ctx.lineTo(0, r); ctx.lineTo(-r * .8, 0); }
          ctx.fill(); ctx.restore();
        });
        if (particles.length) raf = requestAnimationFrame(step); else { ctx.clearRect(cr.left, cr.top, w, h); raf = 0; }
      };
      raf = requestAnimationFrame(step);
    }

    return { skip, playing: () => playing };
  }

  // The streak number flips to its new value
  function tickNumber(el, value, sound) {
    if (!el) return;
    if (!el.animate) { el.textContent = value; return; }
    el.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-100%)', opacity: 0 }], { duration: 160, easing: 'ease-in' }).onfinish = () => {
      el.textContent = value;
      el.animate([{ transform: 'translateY(100%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.2,1.4,.4,1)' });
      const icon = el.previousElementSibling;
      if (icon && icon.animate) icon.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.45)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' });
      tone(sound, NOTE.G6, { dur: .25, vol: .05 });
    };
  }

  root.Celebrate = { play, tickNumber, unlock, canVibrate, buzz, tone: (on, n) => tone(on, NOTE[n] || n), STYLES: ['ring', 'stack', 'burst'], DEFAULT_STYLE: 'ring' };
})(typeof window !== 'undefined' ? window : globalThis);
