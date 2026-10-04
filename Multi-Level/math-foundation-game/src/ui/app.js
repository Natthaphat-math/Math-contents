// The table: top bar, question banner, play area, action button, result,
// and the hand. All text is inserted as text nodes (see dom.js).
import { h, clear, toast } from './dom.js';
import { gesture } from './gesture.js';
import { miniCard, tempCard, blankCard, artTile } from './cards.js';
import { reveal, inspect, library, menu } from './overlays.js';
import { CARD, CARDS } from '../../data/cards.js';
import { CATEGORIES } from '../../data/categories.js';
import { MAX_CARDS } from '../engine/grammar.js';
import { playText, tokenValue } from '../engine/evaluate.js';
import { squeezeStep, SQUEEZE_STEPS } from '../engine/questions.js';
import { Game } from '../engine/game.js';
import { Q, format, decimalText, isNumeric, isReal, toFloat, sizeNote } from '../engine/values.js';
import { saveState, clearState, loadPrefs, savePrefs } from '../state/store.js';

const SVG = 'http://www.w3.org/2000/svg';

export function mountApp(root, initialState) {
  let game = new Game(initialState);
  const prefs = loadPrefs();
  const validFilter = (f) => f === 'all' || f === 'new' || CATEGORIES.some((c) => c.id === f);
  const ui = {
    tray: [], last: null, question: null, runner: null,
    filter: validFilter(prefs.filter) ? prefs.filter : 'all',
  };

  // ---- skeleton -------------------------------------------------------------
  const ladder = h('div', { class: 'ladder', role: 'group', 'aria-label': 'Number systems discovered' });
  const libBtn = h('button', { type: 'button', class: 'icon-btn', onclick: openLibrary }, 'Library');
  const menuBtn = h('button', { type: 'button', class: 'icon-btn', onclick: openMenu, 'aria-label': 'Menu' }, '☰');
  const banner = h('div', { class: 'banner' });
  const tray = h('div', { class: 'tray', 'aria-label': 'Play area' });
  const trayMeta = h('div', { class: 'tray-meta' });
  const actionRow = h('div', { class: 'action-row' });
  const result = h('div', { class: 'result', 'aria-live': 'polite' });
  const chips = h('nav', { class: 'chips', 'aria-label': 'Card categories' });
  const handScroll = h('div', { class: 'hand-scroll' });
  root.append(h('div', { class: 'app' },
    h('header', { class: 'top' },
      h('div', { class: 'brand' }, 'Build it from nothing', h('b', {}, 'Math Foundation')),
      ladder, libBtn, menuBtn),
    banner,
    h('main', { class: 'table' }, result, tray, trayMeta, actionRow),
    h('section', { class: 'hand', 'aria-label': 'Your cards' }, chips, handScroll)));

  const save = () => saveState(game.s);

  function renderAll() {
    renderTop(); renderBanner(); renderPlay(); renderResult(); renderHand();
  }
  function renderPlay() { renderTray(); renderAction(); }

  // ---- top bar --------------------------------------------------------------
  function renderTop() {
    clear(ladder, game.ladder().flatMap((s, i) => {
      const el = h('button', {
        type: 'button', class: `sys ${s.lit ? 'lit' : ''}`, 'aria-label': s.lit ? CARD[s.card].name : 'Not discovered yet',
        onclick: () => { if (s.lit) openInspect(CARD[s.card]); },
      }, s.symbol);
      return i ? [h('span', { class: 'sub', 'aria-hidden': 'true' }, '⊂'), el] : [el];
    }));
    libBtn.querySelector('.pip')?.remove();
    if (Object.values(game.s.owned).some((o) => !o.seen)) libBtn.append(h('span', { class: 'pip', 'aria-label': 'new cards' }));
  }

  // ---- questions ------------------------------------------------------------
  function renderBanner() {
    clear(banner);
    if (ui.question) return;
    const q = game.offerQuestion();
    if (!q) return;
    banner.append(h('div', { class: 'banner-inner' },
      h('div', { class: 'banner-text' },
        h('div', { class: 'banner-kicker' }, 'A question'),
        h('div', { class: 'banner-expr' }, `${playText(q.tokens)} : ${CARD[q.target].symbol}`)),
      h('button', { type: 'button', class: 'text-btn', onclick: () => { game.snoozeQuestion(); save(); renderBanner(); } }, 'Later'),
      h('button', { type: 'button', class: 'pill-btn', onclick: () => startQuestion(q) }, 'Answer')));
  }

  function startQuestion(q) {
    stopRunner();
    ui.question = { q, fill: null, feedback: null, tries: [], lo: null, hi: null, steps: [], done: false };
    ui.tray = [];
    renderAll();
  }

  function leaveQuestion() {
    if (!ui.question?.done) game.snoozeQuestion();
    ui.question = null;
    save();
    renderAll();
  }

  function check() {
    const qs = ui.question;
    const value = tokenValue(qs.fill);
    const res = game.answer(qs.q, value);
    const shown = playText(qs.q.tokens.map((t) => (t.blank ? qs.fill : t)));
    if (qs.q.kind === 'squeeze') {
      qs.tries.push({ v: value, sq: res.value, dir: res.dir });
      if (res.dir === 'small' && (!qs.lo || toFloat(value) > toFloat(qs.lo))) qs.lo = value;
      if (res.dir === 'big' && (!qs.hi || toFloat(value) < toFloat(qs.hi))) qs.hi = value;
      qs.feedback = { good: false, text: `${format(value)}² = ${decimalText(res.value)}: too ${res.dir}.`, guess: res.value };
      qs.fill = null;
      renderPlay(); renderResult();
      return;
    }
    if (res.correct) {
      qs.feedback = { good: true, text: `✓ ${shown} : ${CARD[qs.q.target].symbol}` };
      qs.done = true;
      save();
      renderPlay(); renderResult(); renderTop();
      const finish = () => { ui.question = null; renderAll(); };
      if (res.grants.length) setTimeout(() => reveal(game, res.grants, finish), 500);
      else setTimeout(finish, 900);
      return;
    }
    qs.feedback = { good: false, text: `${shown} : ${format(res.value)}. Too ${res.dir === 'small' ? 'small' : 'big'}.`, guess: res.value };
    renderResult();
  }

  function squeezeOnce() {
    const qs = ui.question;
    const step = squeezeStep(qs.lo, qs.hi);
    qs.steps.push(step);
    if (step.dir === 'small') qs.lo = step.mid; else qs.hi = step.mid;
    if (qs.steps.length >= SQUEEZE_STEPS) {
      qs.done = true;
      qs.feedback = { good: true, text: 'Every fraction misses. The gap halves forever but never closes: the answer isn’t in ℚ.' };
      const grants = game.solveQuestion(qs.q);
      save();
      renderResult();
      setTimeout(() => reveal(game, grants, () => { ui.question = null; renderAll(); }), 1400);
      return;
    }
    renderResult();
  }

  // ---- play area ------------------------------------------------------------
  function renderTray() {
    tray.classList.remove('drop');
    if (ui.question) return renderQuestionTray();
    if (!ui.tray.length) {
      const first = game.s.plays === 0;
      clear(tray, h('div', { class: 'tray-empty' }, first ? 'Tap {} below to put it here.' : 'Tap or drag up to five cards here.'));
    } else {
      clear(tray, ui.tray.map((t, i) => trayCard(t, i)));
    }
    clear(trayMeta,
      h('div', { class: 'dots', 'aria-label': `${ui.tray.length} of ${MAX_CARDS} cards` },
        Array.from({ length: MAX_CARDS }, (_, i) => h('i', { class: i < ui.tray.length ? 'on' : '' }))),
      ui.tray.length ? h('button', { type: 'button', class: 'text-btn', onclick: () => { ui.tray = []; renderPlay(); } }, 'Clear') : null);
  }

  function trayCard(t, i) {
    const el = t.blank ? blankCard() : t.temp !== undefined ? tempCard(t.temp, t.show, game.owns) : miniCard(CARD[t.id]);
    el.dataset.slot = String(i);
    gesture(el, {
      tap: () => { ui.tray.splice(i, 1); renderPlay(); },
      hold: t.id ? () => openInspect(CARD[t.id]) : null,
      drag: (ev) => startDrag(ev, t, el, i),
    });
    return el;
  }

  function renderQuestionTray() {
    const qs = ui.question;
    clear(tray, qs.q.tokens.map((t) => {
      if (t.blank) {
        const el = qs.fill ? (qs.fill.id ? miniCard(CARD[qs.fill.id]) : tempCard(qs.fill.temp, qs.fill.show, game.owns)) : blankCard();
        el.dataset.slot = '0';
        el.addEventListener('click', () => { qs.fill = null; renderPlay(); });
        return el;
      }
      const el = miniCard(CARD[t.id], { extraClass: 'given' });
      el.tabIndex = -1;
      return el;
    }), h('span', { class: 'colon', 'aria-hidden': 'true' }, ':'), (() => {
      const el = miniCard(CARD[qs.q.target], { extraClass: 'given' });
      el.tabIndex = -1;
      return el;
    })());
    clear(trayMeta, h('span', { class: 'hint' }, qs.q.kind === 'squeeze' ? 'Fill ? with a number card' : 'Fill ? from your hand'),
      h('button', { type: 'button', class: 'text-btn', onclick: leaveQuestion }, qs.done ? 'Close' : 'Leave question'));
  }

  function renderAction() {
    clear(actionRow);
    let label = null, act = null;
    if (ui.question) {
      if (ui.question.fill && !ui.question.done) { label = 'Check'; act = check; }
    } else {
      const cls = game.classify(ui.tray);
      if (cls) { label = cls.label; act = play; }
    }
    if (label) actionRow.append(h('button', { type: 'button', class: 'action', onclick: act }, label));
  }

  function addToken(token, index = ui.tray.length) {
    if (ui.question) {
      if (ui.question.done) return;
      const v = token.temp ?? (token.id ? CARD[token.id].value : null);
      if (!v || !isNumeric(v)) {
        toast('This question needs a number card');
        return;
      }
      ui.question.fill = token;
      ui.question.feedback = null;
      renderPlay(); renderResult();
      return;
    }
    if (ui.tray.length >= MAX_CARDS) { toast(`The play area holds ${MAX_CARDS} cards`); return; }
    ui.tray.splice(index, 0, { ...token });
    renderPlay();
    tray.querySelector(`[data-slot="${index}"]`)?.classList.add('landed');
  }

  function play() {
    const res = game.play(ui.tray);
    if (!res) return;
    stopRunner();
    ui.tray = [];
    ui.last = res;
    save();
    renderAll();
    if (res.grants.length) setTimeout(() => reveal(game, res.grants, () => { renderAll(); }), 420);
  }

  // ---- drag -----------------------------------------------------------------
  function indexAt(x) {
    const els = [...tray.querySelectorAll('[data-slot]')];
    const i = els.findIndex((el) => { const r = el.getBoundingClientRect(); return x < r.left + r.width / 2; });
    return i < 0 ? els.length : i;
  }

  function startDrag(ev, token, sourceEl, fromIndex) {
    const r = sourceEl.getBoundingClientRect();
    const ghost = sourceEl.cloneNode(true);
    ghost.classList.add('ghost');
    ghost.classList.remove('lift', 'landed');
    ghost.style.setProperty('--mw', `${r.width}px`);
    document.body.append(ghost);
    sourceEl.classList.add('dragging');
    const place = (e) => { ghost.style.left = `${e.clientX - r.width / 2}px`; ghost.style.top = `${e.clientY - r.height / 2}px`; };
    const over = (e) => {
      const t = tray.getBoundingClientRect();
      return e.clientX > t.left - 12 && e.clientX < t.right + 12 && e.clientY > t.top - 24 && e.clientY < t.bottom + 24;
    };
    const finish = () => { ghost.remove(); sourceEl.classList.remove('dragging'); tray.classList.remove('drop'); };
    place(ev);
    return {
      move(e) { place(e); tray.classList.toggle('drop', over(e)); },
      cancel: finish,
      end(e) {
        finish();
        const inside = over(e);
        if (fromIndex === null) { if (inside) addToken(token, indexAt(e.clientX)); return; }
        const [moved] = ui.tray.splice(fromIndex, 1);
        if (inside) {
          let to = indexAt(e.clientX);
          if (to > fromIndex) to--;
          ui.tray.splice(Math.min(to, ui.tray.length), 0, moved);
        }
        renderPlay();
      },
    };
  }

  // ---- result ---------------------------------------------------------------
  const line = (text, cls = '') => h('div', { class: `result-line ${cls}` }, text);
  const noteEl = (text) => (text ? h('p', { class: 'result-note' }, text) : document.createDocumentFragment());

  function renderResult() {
    clear(result);
    if (ui.question) renderQuestionResult(); else renderPlayResult();
    result.scrollTop = result.scrollHeight; // the newest line is at the bottom
  }

  function renderPlayResult() {
    const r = ui.last;
    if (!r) {
      if (game.s.plays === 0) result.append(noteEl('You start with nothing but a pair of empty braces. Everything else is waiting to be found.'));
      return;
    }
    const first = r.outcome, fin = r.resolved ?? r.outcome;
    if (r.resolved) result.append(line(first.text, 'dim'));
    if (fin.status === 'undefined') {
      result.append(line(fin.text), h('div', { class: 'no-theorem' }, 'No theorem yet'), noteEl(fin.note));
      return;
    }
    if (fin.status === 'stuck') { result.append(line(fin.text), noteEl(fin.note)); return; }
    if (fin.status === 'relation') {
      if (fin.shape === 'compare') result.append(h('div', { class: 'relation' }, fin.text), noteEl(fin.note));
      else result.append(line(playText(fin.tokens)), noteEl(fin.note));
      return;
    }
    result.append(line(fin.text));
    const token = fin.cardId ? { id: fin.cardId } : fin.value ? { temp: fin.value, show: fin.show } : null;
    if (token && !(fin.value?.k === 'bool')) {
      const el = token.id ? artTile(CARD[token.id], { fresh: !game.s.owned[token.id]?.seen }) : tempCard(token.temp, token.show, game.owns);
      gesture(el, {
        tap: () => addToken(token),
        hold: token.id ? () => openInspect(CARD[token.id]) : null,
        drag: (ev) => startDrag(ev, token, el, null),
      });
      result.append(h('div', { class: 'result-card' }, el));
      const size = fin.value && sizeNote(fin.value);
      if (size) result.append(h('div', { class: 'hint' }, size));
    }
    result.append(noteEl(fin.note));
    if (fin.keepGoing) {
      result.append(h('div', { class: 'keep-going' },
        h('p', { class: 'result-note' }, 'No card for this one. What comes after it?'),
        h('button', { type: 'button', class: 'pill-btn', onclick: () => startRunner(fin.value) }, 'Keep going →')));
    }
  }

  function renderQuestionResult() {
    const qs = ui.question;
    if (qs.q.kind === 'squeeze') return renderSqueeze(qs);
    if (qs.feedback) {
      result.append(h('p', { class: `feedback ${qs.feedback.good ? 'good' : ''}` }, qs.feedback.text));
      if (qs.feedback.guess) result.append(numberLine(qs.feedback.guess, Q(Number(qs.q.key.split(',')[2]))));
    } else if (!qs.fill) {
      result.append(noteEl('Which card makes this true?'));
    }
  }

  // The squeeze: a list of tries (last few), then either the next step or the verdict.
  function renderSqueeze(qs) {
    const rows = [
      ...qs.tries.map((t) => ({ v: format(t.v), sq: decimalText(t.sq), dir: t.dir })),
      ...qs.steps.map((s) => ({ v: decimalText(s.mid), sq: decimalText(s.square), dir: s.dir })),
    ].slice(-4);
    if (!rows.length) { result.append(noteEl('Which number, times itself, makes 2? Try a few.')); return; }
    const panel = h('div', { class: 'squeeze' },
      h('ul', {}, rows.map((row) => h('li', {}, h('span', {}, `${row.v}²`), h('span', { class: row.dir }, `${row.sq}  ${row.dir === 'small' ? '↓ small' : '↑ big'}`)))));
    if (qs.done) panel.append(h('p', { class: 'feedback good' }, qs.feedback.text));
    else if (qs.lo && qs.hi) {
      panel.append(h('p', { class: 'result-note' }, `Somewhere between ${decimalText(qs.lo)} and ${decimalText(qs.hi)}. Halve the gap?`),
        h('div', { style: { 'text-align': 'center', 'margin-top': '8px' } }, h('button', { type: 'button', class: 'pill-btn', onclick: squeezeOnce }, 'Try the middle')));
    } else {
      panel.append(h('p', { class: 'result-note' }, qs.lo ? 'Too small so far. Try something bigger.' : 'Too big so far. Try something smaller.'));
    }
    result.append(panel);
  }

  function numberLine(guess, target) {
    if (!isReal(guess)) return null;
    const g = toFloat(guess), t = toFloat(target);
    const lo = Math.min(g, t, 0), hi = Math.max(g, t) * 1.1 + 1;
    const x = (v) => 12 + ((v - lo) / (hi - lo)) * 336;
    const el = (tag, attrs) => { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
    const svg = el('svg', { class: 'numline', viewBox: '0 0 360 34', role: 'img', 'aria-label': `Your answer lands at ${format(guess)}, the target is ${format(target)}` });
    svg.append(el('line', { x1: 8, x2: 352, y1: 12, y2: 12, stroke: 'rgba(27,26,23,.35)', 'stroke-width': 1 }));
    const tick = el('line', { x1: x(t), x2: x(t), y1: 4, y2: 20, stroke: 'var(--sets)', 'stroke-width': 2 });
    const dot = el('circle', { cx: x(g), cy: 12, r: 5, fill: 'var(--numbers)' });
    const lbl = (v, text, fill) => { const n = el('text', { x: x(v), y: 31, 'text-anchor': 'middle', 'font-size': 10, 'font-family': 'IBM Plex Mono, monospace', fill }); n.textContent = text; return n; };
    svg.append(tick, dot, lbl(t, `target ${format(target)}`, 'var(--sets)'));
    if (Math.abs(x(g) - x(t)) > 60) svg.append(lbl(g, format(guess), 'var(--numbers)'));
    return svg;
  }

  // ---- the ∞ runner: S, S, S, … faster and faster -----------------------------
  function startRunner(value) {
    stopRunner();
    let n = value.n, step = 1n, delay = 280;
    const num = h('div', { class: 'runner-num' }, format(Q(n)));
    const holder = result.querySelector('.keep-going');
    result.querySelectorAll('.result-card, .result-note').forEach((el) => el.remove());
    clear(holder, num);
    const t0 = performance.now();
    const tick = () => {
      const elapsed = performance.now() - t0;
      n += step;
      num.textContent = format(Q(n));
      if (elapsed > 1400) step *= 3n;
      delay = Math.max(28, delay * 0.85);
      if (elapsed > 4300) {
        ui.runner = null;
        holder.append(h('div', { class: 'runner-msg' }, 'There is always a next one.'));
        const grants = game.event('keep-going');
        save();
        if (grants.length) setTimeout(() => reveal(game, grants, renderAll), 1100);
        return;
      }
      ui.runner = setTimeout(tick, delay);
    };
    ui.runner = setTimeout(tick, delay);
  }
  function stopRunner() { clearTimeout(ui.runner); ui.runner = null; }

  // ---- hand -----------------------------------------------------------------
  function setFilter(f) {
    ui.filter = ui.filter === f && f !== 'all' ? 'all' : f;
    savePrefs({ ...loadPrefs(), filter: ui.filter });
    handScroll.scrollTop = 0;
    renderHand();
  }

  function handCard(card) {
    const el = miniCard(card, { fresh: !game.s.owned[card.id].seen });
    gesture(el, {
      tap: () => addToken({ id: card.id }),
      hold: () => openInspect(card),
      drag: (ev) => startDrag(ev, { id: card.id }, el, null),
    });
    return el;
  }

  function toolCard() {
    const el = blankCard('?');
    el.classList.add('tool');
    el.setAttribute('aria-label', 'Blank: ask your own question with ? and =');
    el.append(h('span', { class: 'tool-lab' }, 'blank'));
    gesture(el, { tap: () => addToken({ blank: true }), drag: (ev) => startDrag(ev, { blank: true }, el, null) });
    return el;
  }

  function section(title, cat, cards, extra = []) {
    return h('section', {},
      h('div', { class: 'section-head', style: { '--cat': cat ? `var(--${cat})` : 'var(--ink)' } },
        h('span', { class: 'dot' }), `${title} · ${cards.length}`),
      h('div', { class: 'grid' }, extra, cards.map(handCard)));
  }

  function renderHand() {
    const keep = handScroll.scrollTop;
    const owned = CARDS.filter((c) => game.owns(c.id));
    const unseen = owned.filter((c) => !game.s.owned[c.id].seen);
    const chip = (id, text, count, cat) => h('button', {
      type: 'button', class: `chip ${count === 0 ? 'empty' : ''} ${id === 'new' ? 'new-chip' : ''}`,
      style: cat ? { '--cat': `var(--${cat})` } : null, 'aria-pressed': String(ui.filter === id),
      onclick: () => setFilter(id),
    }, cat ? h('span', { class: 'dot' }) : null, text, h('span', { class: 'count' }, String(count)));
    clear(chips,
      chip('all', 'All', owned.length),
      chip('new', 'New', unseen.length),
      CATEGORIES.map((cat) => chip(cat.id, cat.short, owned.filter((c) => c.category === cat.id).length, cat.id)));

    const showTool = game.owns('O05');
    let sections;
    if (ui.filter === 'new') {
      sections = unseen.length ? [section('New', 'numbers', unseen)]
        : [h('p', { class: 'hand-empty' }, 'Nothing new. Cards stay here until you play or inspect them.')];
    } else {
      const cats = CATEGORIES.filter((cat) => ui.filter === 'all' || ui.filter === cat.id);
      sections = cats.map((cat) => {
        const cards = owned.filter((c) => c.category === cat.id);
        const tool = showTool && cat.id === 'operations' ? [toolCard()] : [];
        return cards.length || tool.length ? section(cat.name, cat.id, cards, tool) : null;
      }).filter(Boolean);
      if (!sections.length) sections = [h('p', { class: 'hand-empty' }, 'No cards here yet.')];
    }
    clear(handScroll, sections);
    handScroll.scrollTop = keep;
  }

  // ---- layers ---------------------------------------------------------------
  function openInspect(card) { inspect(game, card, () => { save(); renderTop(); renderHand(); }); }
  function openLibrary() { library(game, () => { save(); renderTop(); renderHand(); }); }
  function openMenu() {
    menu(game, {
      onReset: () => { clearState(); game = new Game(); Object.assign(ui, { tray: [], last: null, question: null }); stopRunner(); renderAll(); },
      onImport: (state) => { game = new Game(state); save(); Object.assign(ui, { tray: [], last: null, question: null }); stopRunner(); renderAll(); toast('Progress loaded'); },
    });
  }

  renderAll();
}
