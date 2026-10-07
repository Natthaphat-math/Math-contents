/* card-editor/editor.js — the teacher's card editor.

   What it does
   - Loads the live flashcards/cards.js (straight from GitHub, so it is always the newest)
     and Claude's draft files in flashcards/drafts/.
   - Units, topics and cards can be edited and reordered (drag, or the ▲▼ buttons).
     Cards move only within their own unit.
   - "ส่งออก cards.js" builds the complete new file to paste over cards.js on GitHub.
   - Work in progress is kept in this browser (localStorage) until it is exported.

   Nothing is ever written to GitHub from this page: publishing = copy + paste + Commit.
   All card text is shown with textContent / escaped HTML (preview uses the app's format).
*/
(function () {
  'use strict';

  /* =======================================================================
     Config + helpers
     ======================================================================= */
  const REPO = 'Natthaphat-math/Math-contents';
  const BRANCH = 'main';
  const CARDS_PATH = 'flashcards/cards.js';
  const DRAFTS_DIR = 'flashcards/drafts';
  const WORK_KEY = 'cardEditor.work.v1';
  const LEVELS = [
    { code: 'ps', label: 'ประถม' }, { code: 'jh', label: 'ม.ต้น' },
    { code: 'sh', label: 'ม.ปลาย' }, { code: 'uni', label: 'มหาลัย' },
  ];
  const LEVEL_LABEL = Object.fromEntries(LEVELS.map(l => [l.code, l.label]));
  const CF = window.CardsFormat;

  const $ = id => document.getElementById(id);
  // Tiny DOM builder: h('div', {class: 'x', onclick: fn}, child, 'text', …). Strings become text nodes.
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === false) return;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    });
    kids.flat().forEach(k => { if (k !== null && k !== undefined && k !== false) el.append(k instanceof Node ? k : String(k)); });
    return el;
  }
  const escapeHtml = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const formatFace = raw => escapeHtml(raw).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  const plain = s => String(s || '').replace(/\$+/g, '').replace(/\*\*/g, '').replace(/\\[a-zA-Z]+/g, '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
  function hash(str) { let x = 2166136261; for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); }
  let uidCounter = 0;
  const uid = () => 'u' + (++uidCounter) + '-' + Math.random().toString(36).slice(2, 6);
  let toastTimer;
  function toast(msg) {
    const el = $('toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }
  // Notes are stored as "// text" lines; the form shows them without the slashes.
  const notesToText = lines => (lines || []).map(l => l.replace(/^\s*\/\/ ?/, '')).join('\n');
  const textToNotes = text => String(text || '').split('\n').map(l => l.replace(/\s+$/, '')).filter((l, i, a) => l || (i > 0 && i < a.length - 1)).map(l => l ? '// ' + l : '//');

  /* =======================================================================
     State
     ======================================================================= */
  const state = {
    base: null,        // { text, hash, split, ids:Set, snap:Map(id → snapshot), unitNames:Set }
    doc: null,         // working document (CardsFormat.parseDocument + uids)
    decisions: {},     // drafts: { [file]: { [id]: 'rejected' } }
    exportedHash: null,
    drafts: [],        // [{ name, text, meta, doc, errors }]
    draftsError: '',
    sel: null,         // { kind: 'card'|'topic'|'unit'|'draft', uid | file+id }
    tab: 'cards',
    collapsed: {},     // unit uid → true
  };

  function withUids(doc) {
    doc.units.forEach(u => {
      u.uid = u.uid || uid();
      u.topics.forEach(t => {
        t.uid = t.uid || uid();
        t.cards.forEach(c => { c.uid = c.uid || uid(); });
      });
    });
    return doc;
  }
  const allCards = (doc = state.doc) => doc.units.flatMap(u => u.topics.flatMap(t => t.cards.map(c => ({ u, t, c }))));
  const findCard = id => allCards().find(x => x.c.uid === id);
  const findTopic = id => { for (const u of state.doc.units) for (const t of u.topics) if (t.uid === id) return { u, t }; return null; };
  const findUnit = id => state.doc.units.find(u => u.uid === id);

  // What a card looked like in the published file, for "แก้แล้ว" badges and the export summary
  const snapOf = (c, u, t) => JSON.stringify({ front: c.front, back: c.back, frontTikz: c.frontTikz, backTikz: c.backTikz, hidden: !!c.hidden, comments: c.comments, unit: u.name, topic: t.name });
  function indexBase(text) {
    const split = CF.splitFile(text);
    if (!split) throw new Error('อ่านไฟล์ cards.js ไม่ได้ (ไม่พบส่วนการ์ด)');
    const doc = CF.parseDocument(split.text);
    const ids = new Set(); const snap = new Map(); const order = [];
    allCards(doc).forEach(({ u, t, c }) => { ids.add(c.id); snap.set(c.id, snapOf(c, u, t)); order.push(c.id); });
    return { text, hash: hash(text), split, ids, snap, order, unitNames: new Set(doc.units.map(u => u.name)), doc };
  }
  function cardStatus(c, u, t) {
    if (!state.base.ids.has(c.id) || c.isNew) return 'new';
    return state.base.snap.get(c.id) === snapOf(c, u, t) ? '' : 'edit';
  }

  /* =======================================================================
     Validation (export is blocked while there are errors)
     ======================================================================= */
  function validate() {
    const issues = new Map(); // uid → [{ msg, warn }]
    const add = (id, msg, warn) => { if (!issues.has(id)) issues.set(id, []); issues.get(id).push({ msg, warn: !!warn }); };
    const idCount = new Map();
    allCards().forEach(({ c }) => idCount.set(c.id, (idCount.get(c.id) || 0) + 1));
    const unitNames = new Map();
    state.doc.units.forEach(u => {
      unitNames.set(u.name, (unitNames.get(u.name) || 0) + 1);
      if (!u.name.trim()) add(u.uid, 'บทต้องมีชื่อ');
      if (!LEVEL_LABEL[u.level]) add(u.uid, 'เลือกระดับของบท');
      if (/\*\//.test(u.name + u.glyph + u.comments.join(''))) add(u.uid, 'ห้ามมี * ตามด้วย / ติดกัน');
      const topicNames = new Map();
      u.topics.forEach(t => {
        if (t.name === null) return;
        if (!t.name.trim()) add(t.uid, 'หัวข้อต้องมีชื่อ');
        topicNames.set(t.name, (topicNames.get(t.name) || 0) + 1);
        if (/\*\//.test(t.name + t.comments.join(''))) add(t.uid, 'ห้ามมี * ตามด้วย / ติดกัน');
      });
      u.topics.forEach(t => { if (t.name !== null && topicNames.get(t.name) > 1) add(t.uid, 'มีหัวข้อชื่อนี้ซ้ำในบทเดียวกัน'); });
      u.topics.forEach(t => t.cards.forEach(c => {
        if (!c.id.trim()) add(c.uid, 'การ์ดต้องมี id');
        else if (/\s/.test(c.id)) add(c.uid, 'id ห้ามมีช่องว่าง');
        if (idCount.get(c.id) > 1) add(c.uid, 'id "' + c.id + '" ซ้ำกับการ์ดอื่น');
        if (!c.front.trim()) add(c.uid, 'ยังไม่มีคำถาม (ถาม)');
        if (!c.back.trim()) add(c.uid, 'ยังไม่มีคำตอบ (ตอบ)');
        [['ถาม', c.front], ['ตอบ', c.back], ['รูปถาม', c.frontTikz], ['รูปตอบ', c.backTikz]].forEach(([label, v]) =>
          CF.contentProblems(v).forEach(p => add(c.uid, label + ': ' + p)));
        [['รูปถาม', c.frontTikz], ['รูปตอบ', c.backTikz]].forEach(([label, v]) => {
          if (v && v.trim() && !/\\begin\{tikzpicture\}/.test(v)) add(c.uid, label + ': ควรขึ้นต้นด้วย \\begin{tikzpicture}', true);
        });
        if (c.comments.join('').includes('*/')) add(c.uid, 'โน้ต: ห้ามมี * ตามด้วย / ติดกัน');
      }));
    });
    state.doc.units.forEach(u => { if (unitNames.get(u.name) > 1) add(u.uid, 'มีบทชื่อนี้ซ้ำ (จะถูกรวมเป็นบทเดียว)'); });
    return issues;
  }
  const errorsOnly = issues => [...issues.entries()].filter(([, list]) => list.some(x => !x.warn));

  /* =======================================================================
     Saving work in this browser
     ======================================================================= */
  let saveTimer;
  function saveWork() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(WORK_KEY, JSON.stringify({
          baseHash: state.base.hash, exportedHash: state.exportedHash, doc: state.doc, decisions: state.decisions, savedAt: Date.now(),
        }));
      } catch (e) { /* storage full or blocked: keep working in memory */ }
    }, 250);
  }
  function loadWork() { try { return JSON.parse(localStorage.getItem(WORK_KEY) || 'null'); } catch (e) { return null; } }
  function clearWork() { try { localStorage.removeItem(WORK_KEY); } catch (e) { /* ignore */ } }
  const currentText = () => state.base.split.before + CF.serialize(state.doc) + state.base.split.after;
  const isDirty = () => currentText() !== state.base.text;

  function changed() {           // call after every edit
    saveWork();
    renderStatus();
  }

  /* =======================================================================
     Loading from GitHub (falls back to the site's own copy)
     ======================================================================= */
  async function fetchText(url, opts) {
    const r = await fetch(url, Object.assign({ cache: 'no-store' }, opts || {}));
    if (!r.ok) throw new Error(r.status + ' ' + url);
    return r.text();
  }
  async function loadBaseText() {
    try {
      return { text: await fetchText(`https://api.github.com/repos/${REPO}/contents/${CARDS_PATH}?ref=${BRANCH}`, { headers: { Accept: 'application/vnd.github.raw' } }), from: 'GitHub' };
    } catch (e) {
      return { text: await fetchText(CARDS_PATH + '?t=' + Date.now()), from: 'เว็บไซต์' };
    }
  }
  async function loadDrafts() {
    let list;
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${DRAFTS_DIR}?ref=${BRANCH}`, { cache: 'no-store' });
      if (r.status === 404) return [];
      if (!r.ok) throw new Error(String(r.status));
      list = await r.json();
    } catch (e) {
      state.draftsError = 'โหลดรายการไฟล์ร่างจาก GitHub ไม่ได้ (' + e.message + ') ลองโหลดหน้าใหม่อีกครั้งภายหลัง';
      return [];
    }
    const files = list.filter(f => f.type === 'file' && /\.js$/.test(f.name)).sort((a, b) => b.name.localeCompare(a.name));
    const out = [];
    for (const f of files) {
      try {
        const text = await fetchText(f.download_url);
        const split = CF.splitFile(text);
        if (!split) { out.push({ name: f.name, text, meta: {}, doc: { units: [] }, errors: ['ไฟล์นี้ไม่มีส่วนการ์ด (/* … */)'] }); continue; }
        const meta = {};
        split.text.split('\n').slice(0, 15).forEach(l => {
          const m = l.match(/^\s*\/\/\s*(จาก|วันที่|หมายเหตุ)\s*:\s*(.+)$/);
          if (m) meta[m[1]] = m[2].trim();
        });
        const errors = CF.parse(split.text, split.lineOffset).errors.map(e => 'บรรทัด ' + e.line + ': ' + e.message);
        out.push({ name: f.name, text, meta, doc: CF.parseDocument(split.text), errors });
      } catch (e) {
        out.push({ name: f.name, text: '', meta: {}, doc: { units: [] }, errors: ['โหลดไฟล์ไม่ได้: ' + e.message] });
      }
    }
    return out;
  }

  async function init() {
    if (!CF || !CF.parseDocument) { $('status').textContent = 'โหลดไม่สำเร็จ: ไม่พบ cards-format.js รุ่นใหม่'; return; }
    let base;
    try {
      base = await loadBaseText();
      state.base = indexBase(base.text);
    } catch (e) {
      $('status').textContent = 'โหลด cards.js ไม่ได้: ' + e.message;
      return;
    }
    state.loadedFrom = base.from;
    state.loadedAt = new Date();

    const saved = loadWork();
    const fresh = () => withUids(CF.parseDocument(state.base.split.text));
    if (saved && saved.exportedHash && saved.exportedHash === state.base.hash) {
      clearWork(); state.doc = fresh();
      showBanner('ไฟล์ที่คุณส่งออกไว้ถูก Commit แล้ว เริ่มงานใหม่จากไฟล์ล่าสุดให้แล้ว', null, 'ok');
    } else if (saved && saved.doc && saved.baseHash === state.base.hash) {
      state.doc = withUids(saved.doc); state.decisions = saved.decisions || {}; state.exportedHash = saved.exportedHash || null;
    } else if (saved && saved.doc) {
      // The file on GitHub changed since this work started (someone committed something else).
      state.doc = fresh();
      showBanner('cards.js บน GitHub เปลี่ยนไปหลังจากคุณเริ่มแก้ในเบราว์เซอร์นี้ ถ้าทำงานต่อจากที่ค้างไว้แล้วส่งออก การเปลี่ยนแปลงอื่นบน GitHub จะหายไป', [
        { label: 'เริ่มใหม่จากไฟล์ล่าสุด', primary: true, onClick: () => { clearWork(); state.doc = fresh(); state.decisions = {}; hideBanner(); renderAll(); } },
        { label: 'ทำงานต่อจากที่ค้างไว้', onClick: () => { state.doc = withUids(saved.doc); state.decisions = saved.decisions || {}; state.base.hash = saved.baseHash; hideBanner(); renderAll(); toast('ใช้งานที่ค้างไว้ ระวังทับการแก้ไขอื่นบน GitHub'); } },
      ], 'bad');
    } else {
      state.doc = fresh();
    }
    const loadErrors = CF.parse(state.base.split.text, state.base.split.lineOffset).errors;
    if (loadErrors.length && !$('banner').textContent) {
      showBanner('cards.js มี ' + loadErrors.length + ' จุดที่เขียนไม่ตรงรูปแบบ ตรวจดูการ์ดที่ขึ้นป้าย "ผิด" แล้วแก้ก่อนส่งออก', null, 'bad');
    }
    renderAll();
    state.drafts = await loadDrafts();
    renderAll();
  }

  /* =======================================================================
     Banner + status
     ======================================================================= */
  function showBanner(text, actions, kind) {
    const b = $('banner');
    b.className = 'banner' + (kind === 'bad' ? ' bad' : '');
    b.replaceChildren(h('p', {}, text), ...(actions || []).map(a => h('button', { class: 'act' + (a.primary ? ' primary' : ''), type: 'button', onclick: a.onClick }, a.label)));
    if (!actions) b.append(h('button', { class: 'act', type: 'button', onclick: hideBanner }, 'ปิด'));
    b.hidden = false;
  }
  function hideBanner() { $('banner').hidden = true; $('banner').replaceChildren(); }

  function renderStatus() {
    const n = allCards().length;
    const parts = ['การ์ด ' + n + ' ใบ ใน ' + state.doc.units.length + ' บท'];
    parts.push(isDirty() ? 'มีการแก้ไขที่ยังไม่ได้ส่งออก (บันทึกไว้ในเบราว์เซอร์นี้)' : 'ตรงกับไฟล์บน ' + state.loadedFrom);
    $('status').textContent = parts.join(' — ');
    const pending = pendingDraftCount();
    $('draft-count').textContent = pending ? String(pending) : '';
  }

  function renderAll() {
    renderStatus();
    $('outline').hidden = state.tab !== 'cards';
    $('drafts').hidden = state.tab !== 'drafts';
    $('tab-cards').setAttribute('aria-selected', String(state.tab === 'cards'));
    $('tab-drafts').setAttribute('aria-selected', String(state.tab === 'drafts'));
    if (state.tab === 'cards') renderOutline(); else renderDrafts();
    renderEditor();
    renderPreview();
  }

  /* =======================================================================
     Outline: units → topics → cards, with drag & drop (SortableJS)
     ======================================================================= */
  let sortables = [];
  function renderOutline() {
    sortables.forEach(s => s.destroy()); sortables = [];
    const issues = validate();
    const root = $('outline');
    const unitsEl = h('div', { class: 'units' });
    state.doc.units.forEach((u, ui) => {
      const count = u.topics.reduce((a, t) => a + t.cards.length, 0);
      const bad = issues.has(u.uid);
      const unitEl = h('div', { class: 'unit' + (state.collapsed[u.uid] ? ' collapsed' : '') + (state.sel && state.sel.uid === u.uid ? ' selected' : ''), dataset: { uid: u.uid } },
        h('div', { class: 'unit-head' },
          h('span', { class: 'handle unit-handle', title: 'ลากเพื่อย้ายบท', 'aria-hidden': 'true' }, '⋮⋮'),
          h('button', { class: 'toggle', type: 'button', 'aria-label': (state.collapsed[u.uid] ? 'ขยาย ' : 'ย่อ ') + u.name, 'aria-expanded': String(!state.collapsed[u.uid]), onclick: () => { state.collapsed[u.uid] = !state.collapsed[u.uid]; renderOutline(); } }, state.collapsed[u.uid] ? '▸' : '▾'),
          h('span', { class: 'shape ' + (LEVEL_LABEL[u.level] ? u.level : 'sh'), 'aria-hidden': 'true' }),
          h('button', { class: 'unit-name', type: 'button', onclick: () => select({ kind: 'unit', uid: u.uid }) }, u.name || '(ไม่มีชื่อบท)'),
          bad ? h('span', { class: 'badge err' }, 'ผิด') : null,
          h('span', { class: 'count' }, String(count)),
          h('button', { class: 'mini', type: 'button', 'aria-label': 'เลื่อนบทขึ้น', disabled: ui === 0, onclick: () => moveUnit(u, -1) }, '▲'),
          h('button', { class: 'mini', type: 'button', 'aria-label': 'เลื่อนบทลง', disabled: ui === state.doc.units.length - 1, onclick: () => moveUnit(u, 1) }, '▼')),
        h('div', { class: 'unit-body' }));
      const body = unitEl.querySelector('.unit-body');
      let num = 0;
      const cardList = t => {
        const list = h('div', { class: 'cards', dataset: { topic: t.uid } });
        t.cards.forEach(c => list.append(cardRow(u, t, c, ++num, issues)));
        sortables.push(makeSortable(list, { group: 'cards-' + u.uid, handle: '.card-handle' }));
        return list;
      };
      const nullTopic = u.topics.find(t => t.name === null);
      const named = u.topics.filter(t => t.name !== null);
      if (nullTopic && (nullTopic.cards.length || !named.length)) body.append(cardList(nullTopic));
      const topicsEl = h('div', { class: 'topics' });
      named.forEach(t => {
        const sel = state.sel && state.sel.uid === t.uid;
        topicsEl.append(h('div', { class: 'topic' + (sel ? ' selected' : ''), dataset: { uid: t.uid } },
          h('div', { class: 'topic-head' },
            h('span', { class: 'handle topic-handle', title: 'ลากเพื่อย้ายหัวข้อ', 'aria-hidden': 'true' }, '⋮⋮'),
            h('button', { class: 'topic-name', type: 'button', onclick: () => select({ kind: 'topic', uid: t.uid }) }, t.name || '(ไม่มีชื่อหัวข้อ)'),
            issues.has(t.uid) ? h('span', { class: 'badge err' }, 'ผิด') : null,
            h('span', { class: 'count' }, String(t.cards.length))),
          cardList(t)));
      });
      body.append(topicsEl);
      sortables.push(makeSortable(topicsEl, { group: 'topics-' + u.uid, handle: '.topic-handle' }));
      body.append(h('div', { class: 'add-row' },
        h('button', { class: 'link-btn', type: 'button', onclick: () => newCard(u, (state.sel && findTopic(state.sel.uid) && findTopic(state.sel.uid).u === u) ? findTopic(state.sel.uid).t : null) }, '+ การ์ด'),
        h('button', { class: 'link-btn', type: 'button', onclick: () => newTopic(u) }, '+ หัวข้อ')));
      unitsEl.append(unitEl);
    });
    sortables.push(makeSortable(unitsEl, { group: 'units', handle: '.unit-handle' }));
    const allCollapsed = state.doc.units.length && state.doc.units.every(u => state.collapsed[u.uid]);
    const tools = h('div', { class: 'outline-tools' },
      h('button', { class: 'link-btn', type: 'button', onclick: () => { state.doc.units.forEach(u => { state.collapsed[u.uid] = !allCollapsed; }); renderOutline(); } },
        allCollapsed ? 'ขยายทั้งหมด' : 'ย่อทั้งหมด (สะดวกเวลาลากจัดลำดับบท)'));
    root.replaceChildren(tools, unitsEl, h('button', { class: 'new-unit', type: 'button', onclick: newUnit }, '+ บทใหม่'));
  }
  function cardRow(u, t, c, num, issues) {
    const st = cardStatus(c, u, t);
    const sel = state.sel && state.sel.uid === c.uid;
    const errs = issues.get(c.uid);
    return h('div', { class: 'card-row' + (sel ? ' selected' : '') + (c.hidden ? ' is-hidden' : ''), dataset: { uid: c.uid, id: c.id }, title: c.id, tabindex: '0', role: 'button', 'aria-pressed': String(!!sel),
      onclick: () => select({ kind: 'card', uid: c.uid }),
      onkeydown: e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select({ kind: 'card', uid: c.uid }); }
        if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); moveCard(c.uid, e.key === 'ArrowUp' ? -1 : 1, true); }
      } },
      h('span', { class: 'handle card-handle', title: 'ลากเพื่อย้ายการ์ด', 'aria-hidden': 'true' }, '⋮⋮'),
      h('span', { class: 'num' }, String(num)),
      oneLine(c.front, 'card-text', '(ยังไม่มีคำถาม)'),
      h('span', { class: 'badges' },
        st === 'new' ? h('span', { class: 'badge new' }, 'ใหม่') : null,
        st === 'edit' ? h('span', { class: 'badge edit' }, 'แก้แล้ว') : null,
        c.hidden ? h('span', { class: 'badge' }, 'ซ่อน') : null,
        errs && errs.some(x => !x.warn) ? h('span', { class: 'badge err' }, 'ผิด') : null));
  }
  // One line of card text with formulas rendered (falls back to plain text)
  function oneLine(text, cls, empty) {
    const span = h('span', { class: cls });
    const t = String(text || '').replace(/\$\$/g, '$').split('\n').join('  ').trim();
    if (!t) { span.textContent = empty; return span; }
    span.innerHTML = formatFace(t);
    if (window.renderMathInElement) window.renderMathInElement(span, { delimiters: [{ left: '$', right: '$', display: false }], throwOnError: false });
    return span;
  }
  function makeSortable(el, opts) {
    if (!window.Sortable) return { destroy() {} };
    return window.Sortable.create(el, {
      group: opts.group, handle: opts.handle, animation: 150, ghostClass: 'sortable-ghost', fallbackOnBody: true, swapThreshold: .6,
      forceFallback: true,   // pointer-based dragging: same behaviour for mouse and touch
      onEnd: syncFromDom,
    });
  }
  // After a drag, read the new order back from the page.
  function syncFromDom() {
    const byUid = new Map();
    state.doc.units.forEach(u => { byUid.set(u.uid, u); u.topics.forEach(t => { byUid.set(t.uid, t); t.cards.forEach(c => byUid.set(c.uid, c)); }); });
    const units = [...$('outline').querySelectorAll('.units > .unit')].map(el => byUid.get(el.dataset.uid));
    units.forEach(u => {
      const el = $('outline').querySelector('.unit[data-uid="' + u.uid + '"]');
      const nullTopic = u.topics.find(t => t.name === null);
      const named = [...el.querySelectorAll('.topics > .topic')].map(te => byUid.get(te.dataset.uid));
      el.querySelectorAll('.cards').forEach(list => {
        const t = byUid.get(list.dataset.topic);
        t.cards = [...list.querySelectorAll(':scope > .card-row')].map(r => byUid.get(r.dataset.uid));
      });
      u.topics = nullTopic ? [nullTopic, ...named] : named;
    });
    state.doc.units = units;
    changed(); renderOutline();
  }

  /* ---------- structure edits ---------- */
  function moveUnit(u, d) {
    const a = state.doc.units, i = a.indexOf(u), j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]]; changed(); renderOutline();
  }
  function moveTopic(t, d) {
    const { u } = findTopic(t.uid);
    const named = u.topics.filter(x => x.name !== null);
    const i = named.indexOf(t), j = i + d;
    if (j < 0 || j >= named.length) return;
    [named[i], named[j]] = [named[j], named[i]];
    const nullTopic = u.topics.find(x => x.name === null);
    u.topics = nullTopic ? [nullTopic, ...named] : named;
    changed(); renderAll();
  }
  // Move a card one step up/down inside its unit (crossing into the next/previous topic at the edges)
  function moveCard(cardUid, d, keepFocus) {
    const { u, t, c } = findCard(cardUid);
    const i = t.cards.indexOf(c);
    if (i + d >= 0 && i + d < t.cards.length) { [t.cards[i], t.cards[i + d]] = [t.cards[i + d], t.cards[i]]; }
    else {
      const ti = u.topics.indexOf(t), nt = u.topics[ti + d];
      if (!nt) return;
      t.cards.splice(i, 1);
      if (d < 0) nt.cards.push(c); else nt.cards.unshift(c);
    }
    changed(); renderAll();
    if (keepFocus) { const row = $('outline').querySelector('.card-row[data-uid="' + cardUid + '"]'); if (row) row.focus(); }
  }
  function suggestId(u) {
    const ids = new Set(allCards().map(x => x.c.id));
    const prefixes = u.topics.flatMap(t => t.cards.map(c => (c.id.match(/^(.*?)-[^-]*$/) || [])[1])).filter(Boolean);
    const counts = prefixes.reduce((m, p) => m.set(p, (m.get(p) || 0) + 1), new Map());
    const prefix = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const base = prefix ? prefix[0] : 'card';
    let n = 1; while (ids.has(base + '-new-' + n)) n++;
    return base + '-new-' + n;
  }
  function newCard(u, t) {
    if (!u) u = state.doc.units[0];
    if (!u) { toast('สร้างบทก่อน แล้วจึงเพิ่มการ์ด'); return; }
    if (!t) { t = u.topics.find(x => x.name === null) || u.topics[u.topics.length - 1]; }
    if (!t) { t = { uid: uid(), name: null, comments: [], cards: [] }; u.topics.unshift(t); }
    const c = { uid: uid(), id: suggestId(u), front: '', back: '', frontTikz: '', backTikz: '', hidden: false, comments: [], isNew: true };
    t.cards.push(c);
    state.collapsed[u.uid] = false; state.tab = 'cards';
    changed(); select({ kind: 'card', uid: c.uid });
    setTimeout(() => { const f = $('f-front'); if (f) f.focus(); }, 0);
  }
  function newTopic(u) {
    const t = { uid: uid(), name: 'หัวข้อใหม่', comments: [], cards: [] };
    u.topics.push(t); changed(); select({ kind: 'topic', uid: t.uid });
    setTimeout(() => { const f = $('f-topic-name'); if (f) { f.focus(); f.select(); } }, 0);
  }
  function newUnit() {
    const u = { uid: uid(), name: 'บทใหม่', level: 'sh', glyph: '', comments: [], topics: [{ uid: uid(), name: null, comments: [], cards: [] }] };
    state.doc.units.push(u); changed(); select({ kind: 'unit', uid: u.uid });
    setTimeout(() => { const f = $('f-unit-name'); if (f) { f.focus(); f.select(); } }, 0);
  }

  function select(sel) {
    state.sel = sel;
    renderAll();
    if (window.matchMedia && matchMedia('(max-width: 760px)').matches) document.querySelector('.editor-pane').scrollIntoView({ behavior: 'smooth' });
  }

  /* =======================================================================
     Editor pane (forms)
     ======================================================================= */
  function field(label, input, hint) {
    return h('label', { class: 'field' }, h('span', {}, label), input, hint ? h('small', {}, hint) : null);
  }
  function textarea(id, value, rows, oninput) {
    const ta = h('textarea', { id, rows: String(rows), spellcheck: 'false' });
    ta.value = value || '';
    ta.addEventListener('input', () => oninput(ta.value));
    return ta;
  }
  function problemsList(uidKey) {
    const list = validate().get(uidKey) || [];
    return h('ul', { class: 'problems', id: 'problems' }, list.map(p => h('li', { class: p.warn ? 'warn' : '' }, p.msg)));
  }
  function refreshAfterTyping(uidKey) {
    // light refresh while typing: problems, the outline row, preview, status
    const old = $('problems'); if (old) old.replaceWith(problemsList(uidKey));
    renderOutline(); renderPreview(); changed();
  }
  let typingTimer;
  // Works for text boxes (gets an input event) and the textarea helper (gets the value)
  const onType = (uidKey, fn) => v => {
    fn(v && v.target ? v.target.value : v);
    clearTimeout(typingTimer); typingTimer = setTimeout(() => refreshAfterTyping(uidKey), 200);
  };

  function renderEditor() {
    const root = $('editor');
    const sel = state.sel;
    if (sel && sel.kind === 'card' && findCard(sel.uid)) return root.replaceChildren(cardForm(findCard(sel.uid)));
    if (sel && sel.kind === 'topic' && findTopic(sel.uid)) return root.replaceChildren(topicForm(findTopic(sel.uid)));
    if (sel && sel.kind === 'unit' && findUnit(sel.uid)) return root.replaceChildren(unitForm(findUnit(sel.uid)));
    if (sel && sel.kind === 'draft') return root.replaceChildren(draftInfo(sel));
    root.replaceChildren(h('div', { class: 'empty' },
      h('div', { class: 'shapes', 'aria-hidden': 'true' }, h('i', { class: 'shape ps' }), h('i', { class: 'shape jh' }), h('i', { class: 'shape sh' }), h('i', { class: 'shape uni' })),
      h('p', {}, 'เลือกการ์ด หัวข้อ หรือบททางซ้ายเพื่อแก้ไข'),
      h('p', {}, 'ลาก ⋮⋮ เพื่อเปลี่ยนลำดับ หรือกด + การ์ดใหม่')));
  }

  function cardForm({ u, t, c }) {
    const published = state.base.ids.has(c.id) && !c.isNew;
    const st = cardStatus(c, u, t);
    const topicSel = h('select', { id: 'f-topic' },
      u.topics.map(tp => { const o = h('option', { value: tp.uid }, tp.name === null ? '(ไม่มีหัวข้อ)' : tp.name); if (tp === t) o.selected = true; return o; }));
    topicSel.addEventListener('change', () => {
      const target = u.topics.find(x => x.uid === topicSel.value);
      t.cards.splice(t.cards.indexOf(c), 1); target.cards.push(c);
      changed(); renderAll(); toast('ย้ายไปท้ายหัวข้อ "' + (target.name || 'ไม่มีหัวข้อ') + '" แล้ว');
    });
    const idInput = h('input', { type: 'text', id: 'f-id', value: c.id, readonly: published, autocomplete: 'off', spellcheck: 'false' });
    idInput.addEventListener('input', onType(c.uid, v => { c.id = v.trim(); }));
    const hasTikz = !!(c.frontTikz || c.backTikz);
    const hidden = h('input', { type: 'checkbox', id: 'f-hidden', checked: !!c.hidden });
    hidden.addEventListener('change', () => { c.hidden = hidden.checked; refreshAfterTyping(c.uid); });
    return h('div', {},
      h('p', { class: 'crumb' }, h('span', { class: 'shape ' + (LEVEL_LABEL[u.level] ? u.level : 'sh') }), u.name, t.name ? ' › ' + t.name : ''),
      h('div', { class: 'form-head' },
        h('h2', {}, published ? 'แก้ไขการ์ด' : 'การ์ดใหม่'),
        st === 'edit' ? h('span', { class: 'badge edit' }, 'แก้แล้ว') : null,
        st === 'new' ? h('span', { class: 'badge new' }, 'ใหม่') : null),
      problemsList(c.uid),
      h('div', { class: 'row2' },
        field('หัวข้อ', topicSel, 'ย้ายได้เฉพาะภายในบทนี้'),
        field('id', idInput, published ? '🔒 id ของการ์ดที่เผยแพร่แล้วเปลี่ยนไม่ได้ เพราะความคืบหน้าของนักเรียนผูกกับ id' : 'ไม่ซ้ำกับการ์ดอื่น ใช้ a-z 0-9 และ - เช่น set-union-2')),
      field('ถาม (ด้านหน้า)', textarea('f-front', c.front, 4, onType(c.uid, v => { c.front = v; })), 'พิมพ์ LaTeX ตามปกติ $...$ หรือ $$...$$ และ **ตัวหนา**'),
      field('ตอบ (ด้านหลัง)', textarea('f-back', c.back, 4, onType(c.uid, v => { c.back = v; }))),
      h('details', { class: 'more', open: hasTikz },
        h('summary', {}, 'รูป TikZ (ไม่บังคับ)'),
        field('รูปถาม', textarea('f-ftikz', c.frontTikz, 5, onType(c.uid, v => { c.frontTikz = v; }))),
        field('รูปตอบ', textarea('f-btikz', c.backTikz, 5, onType(c.uid, v => { c.backTikz = v; })))),
      h('label', { class: 'check' }, hidden, 'ซ่อนการ์ดนี้จากนักเรียน (ยังอยู่ในไฟล์)'),
      field('โน้ต (แอปไม่แสดง)', textarea('f-notes', notesToText(c.comments), 2, onType(c.uid, v => { c.comments = textToNotes(v); })), 'จะเขียนเป็นบรรทัด // ไว้เหนือการ์ดนี้'),
      h('div', { class: 'form-actions' },
        h('button', { class: 'act', type: 'button', onclick: () => moveCard(c.uid, -1) }, '▲ เลื่อนขึ้น'),
        h('button', { class: 'act', type: 'button', onclick: () => moveCard(c.uid, 1) }, '▼ เลื่อนลง'),
        st === 'edit' ? h('button', { class: 'act', type: 'button', onclick: () => revertCard(c) }, 'ย้อนกลับเป็นแบบที่เผยแพร่') : null,
        h('button', { class: 'act danger', type: 'button', onclick: () => deleteCard(c, published) }, 'ลบการ์ด')));
  }
  function revertCard(c) {
    const orig = allCards(state.base.doc).find(x => x.c.id === c.id);
    if (!orig) return;
    ['front', 'back', 'frontTikz', 'backTikz', 'hidden'].forEach(k => { c[k] = orig.c[k]; });
    c.comments = orig.c.comments.slice();
    changed(); renderAll(); toast('ย้อนกลับเนื้อหาแล้ว (ตำแหน่งไม่เปลี่ยน)');
  }
  function deleteCard(c, published) {
    const msg = published
      ? 'ลบการ์ด "' + c.id + '"?\nนักเรียนใช้การ์ดนี้อยู่ ความคืบหน้าของการ์ดนี้จะหายไป\nถ้าแค่อยากพักไว้ ใช้ "ซ่อน" แทน'
      : 'ลบการ์ดใหม่ "' + (c.id || '') + '"?';
    if (!confirm(msg)) return;
    const { t } = findCard(c.uid);
    t.cards.splice(t.cards.indexOf(c), 1);
    state.sel = null; changed(); renderAll(); toast('ลบการ์ดแล้ว');
  }

  function topicForm({ u, t }) {
    const name = h('input', { type: 'text', id: 'f-topic-name', value: t.name, autocomplete: 'off' });
    name.addEventListener('input', onType(t.uid, v => { t.name = v.trim(); }));
    return h('div', {},
      h('p', { class: 'crumb' }, h('span', { class: 'shape ' + (LEVEL_LABEL[u.level] ? u.level : 'sh') }), u.name),
      h('div', { class: 'form-head' }, h('h2', {}, 'หัวข้อ')),
      problemsList(t.uid),
      field('ชื่อหัวข้อ', name, 'นักเรียนจะเห็นชื่อนี้ในหน้าบท และเลือกทวนตามหัวข้อได้'),
      field('โน้ต (แอปไม่แสดง)', textarea('f-notes', notesToText(t.comments), 2, onType(t.uid, v => { t.comments = textToNotes(v); }))),
      h('p', { class: 'hint' }, 'การ์ดในหัวข้อนี้: ' + t.cards.length + ' ใบ'),
      h('div', { class: 'form-actions' },
        h('button', { class: 'act', type: 'button', onclick: () => moveTopic(t, -1) }, '▲ เลื่อนหัวข้อขึ้น'),
        h('button', { class: 'act', type: 'button', onclick: () => moveTopic(t, 1) }, '▼ เลื่อนหัวข้อลง'),
        h('button', { class: 'act', type: 'button', onclick: () => newCard(u, t) }, '+ การ์ดในหัวข้อนี้'),
        h('button', { class: 'act danger', type: 'button', onclick: () => deleteTopic(u, t) }, 'ลบหัวข้อ')));
  }
  function deleteTopic(u, t) {
    if (!confirm('ลบหัวข้อ "' + t.name + '"?\nการ์ด ' + t.cards.length + ' ใบในหัวข้อนี้จะย้ายไปอยู่ "ไม่มีหัวข้อ" ของบทนี้ (ไม่ถูกลบ)')) return;
    let nullTopic = u.topics.find(x => x.name === null);
    if (!nullTopic) { nullTopic = { uid: uid(), name: null, comments: [], cards: [] }; u.topics.unshift(nullTopic); }
    nullTopic.cards.push(...t.cards);
    if (t.comments.length) nullTopic.cards.length && nullTopic.cards[0].comments.unshift(...t.comments);
    u.topics.splice(u.topics.indexOf(t), 1);
    state.sel = { kind: 'unit', uid: u.uid }; changed(); renderAll(); toast('ลบหัวข้อแล้ว การ์ดยังอยู่ในบท');
  }

  function unitForm(u) {
    const published = state.base.unitNames.has(u.name);
    const name = h('input', { type: 'text', id: 'f-unit-name', value: u.name, autocomplete: 'off' });
    name.addEventListener('input', onType(u.uid, v => { u.name = v.trim(); }));
    const level = h('select', { id: 'f-level' }, LEVELS.map(l => { const o = h('option', { value: l.code }, l.label + ' (' + l.code + ')'); if (u.level === l.code) o.selected = true; return o; }));
    level.addEventListener('change', () => { u.level = level.value; refreshAfterTyping(u.uid); });
    const glyph = h('input', { type: 'text', id: 'f-glyph', value: u.glyph, maxlength: '6', autocomplete: 'off' });
    glyph.addEventListener('input', onType(u.uid, v => { u.glyph = v.trim(); }));
    const count = u.topics.reduce((a, t) => a + t.cards.length, 0);
    const renamed = state.base.unitNames.size && !published && allCards().some(x => x.u === u && state.base.ids.has(x.c.id));
    return h('div', {},
      h('div', { class: 'form-head' }, h('h2', {}, 'บท')),
      problemsList(u.uid),
      renamed ? h('ul', { class: 'problems' }, h('li', { class: 'warn' }, 'เปลี่ยนชื่อบทแล้ว: นักเรียนที่ปักหมุดบทนี้ไว้ต้องปักหมุดใหม่ (ความคืบหน้ายังอยู่)')) : null,
      field('ชื่อบท', name, 'แต่ละบทคือ 1 ชุดการ์ดบนหน้าแรกของแอป'),
      h('div', { class: 'row2' }, field('ระดับ', level), field('สัญลักษณ์ (ไม่บังคับ)', glyph, 'สั้น 1–4 ตัวอักษร เช่น ∈ ℝ f(x)')),
      field('โน้ต (แอปไม่แสดง)', textarea('f-notes', notesToText(u.comments), 2, onType(u.uid, v => { u.comments = textToNotes(v); }))),
      h('p', { class: 'hint' }, 'การ์ดในบทนี้: ' + count + ' ใบ ใน ' + u.topics.filter(t => t.name !== null).length + ' หัวข้อ'),
      h('div', { class: 'form-actions' },
        h('button', { class: 'act', type: 'button', onclick: () => moveUnit(u, -1) }, '▲ เลื่อนบทขึ้น'),
        h('button', { class: 'act', type: 'button', onclick: () => moveUnit(u, 1) }, '▼ เลื่อนบทลง'),
        h('button', { class: 'act', type: 'button', onclick: () => newCard(u, null) }, '+ การ์ด'),
        h('button', { class: 'act', type: 'button', onclick: () => newTopic(u) }, '+ หัวข้อ'),
        h('button', { class: 'act danger', type: 'button', onclick: () => deleteUnit(u, count) }, 'ลบบท')));
  }
  function deleteUnit(u, count) {
    const used = allCards().filter(x => x.u === u && state.base.ids.has(x.c.id)).length;
    if (!confirm('ลบบท "' + u.name + '" และการ์ดทั้งหมด ' + count + ' ใบ?' + (used ? '\nมี ' + used + ' ใบที่นักเรียนใช้อยู่ ความคืบหน้าของการ์ดเหล่านั้นจะหายไป' : ''))) return;
    state.doc.units.splice(state.doc.units.indexOf(u), 1);
    state.sel = null; changed(); renderAll(); toast('ลบบทแล้ว');
  }

  /* =======================================================================
     Preview (same formatting as the app: escaped text, **bold**, KaTeX, TikZ)
     ======================================================================= */
  let tikzLoading = null;
  function ensureTikzJax() {
    if (window.__tikzjaxLoaded || tikzLoading) return;
    tikzLoading = true;
    document.head.append(h('link', { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/@rod2ik/tikzjax/dist/fonts.min.css' }));
    const s = h('script', { src: 'https://cdn.jsdelivr.net/npm/@rod2ik/tikzjax/dist/tikzjax.min.js' });
    s.onload = () => { window.__tikzjaxLoaded = true; };
    document.head.append(s);
  }
  function face(text, tikz) {
    const inner = h('div', { class: 'pv-inner' });
    inner.innerHTML = formatFace(text || '');
    if (tikz && tikz.trim()) {
      ensureTikzJax();
      const holder = h('div', { class: 'tikz-holder' });
      const sc = document.createElement('script'); sc.type = 'text/tikz'; sc.textContent = tikz;
      holder.append(sc); inner.append(holder);
    }
    if (window.renderMathInElement) window.renderMathInElement(inner, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false });
    return inner;
  }
  function previewCard(c, unit, topicName) {
    const code = LEVEL_LABEL[unit.level] ? unit.level : 'sh';
    const front = face(c.front, c.frontTikz);
    if (!c.frontTikz && String(c.front).replace(/\s+/g, '').length <= 24) front.classList.add('short');
    return h('div', { class: 'pv-wrap' },
      c.hidden ? h('p', { class: 'pv-hidden' }, 'การ์ดนี้ถูกซ่อน นักเรียนจะไม่เห็น') : null,
      h('div', {}, h('p', { class: 'pv-label' }, 'ด้านหน้า'),
        h('div', { class: 'pv-card' },
          h('div', { class: 'pv-meta' }, h('span', { class: 'pv-tag' }, h('span', { class: 'shape ' + code }), LEVEL_LABEL[code])),
          topicName ? h('p', { class: 'pv-topic' }, topicName) : null,
          h('div', { class: 'pv-body' }, front))),
      h('div', {}, h('p', { class: 'pv-label' }, 'ด้านหลัง'),
        h('div', { class: 'pv-card back' },
          h('div', { class: 'pv-meta' }, h('span', { class: 'pv-answer' }, 'คำตอบ')),
          h('div', { class: 'pv-body' }, face(c.back, c.backTikz)))));
  }
  function renderPreview() {
    const root = $('preview');
    const sel = state.sel;
    if (sel && sel.kind === 'card' && findCard(sel.uid)) { const { u, t, c } = findCard(sel.uid); return root.replaceChildren(previewCard(c, u, t.name)); }
    if (sel && sel.kind === 'draft') { const d = draftCardOf(sel); if (d) return root.replaceChildren(previewCard(d.c, d.u, d.t.name)); }
    root.replaceChildren(h('p', { class: 'hint' }, 'เลือกการ์ดเพื่อดูตัวอย่าง'));
  }

  /* =======================================================================
     Drafts from Claude (flashcards/drafts/*.js)
     ======================================================================= */
  const decision = (file, id) => (state.decisions[file] || {})[id];
  function setDecision(file, id, v) {
    state.decisions[file] = state.decisions[file] || {};
    if (v) state.decisions[file][id] = v; else delete state.decisions[file][id];
  }
  function draftCards(d) { return allCards(d.doc); }
  // published: already in cards.js · added: in the working file · rejected · pending
  function draftState(file, x) {
    if (state.base.ids.has(x.c.id)) return 'published';
    if (allCards().some(y => y.c.origin && y.c.origin.file === file && y.c.origin.id === x.c.id)) return 'added';
    if (decision(file, x.c.id) === 'rejected') return 'rejected';
    return 'pending';
  }
  function pendingDraftCount() { return state.drafts.reduce((a, d) => a + draftCards(d).filter(x => draftState(d.name, x) === 'pending').length, 0); }
  function draftCardOf(sel) {
    const d = state.drafts.find(f => f.name === sel.file);
    return d ? draftCards(d).find(x => x.c.id === sel.id) : null;
  }

  function addDraftCard(file, x, quiet) {
    // the same unit / topic (by name) in the working file, created if missing
    let u = state.doc.units.find(y => y.name === x.u.name);
    if (!u) { u = { uid: uid(), name: x.u.name, level: x.u.level, glyph: x.u.glyph, comments: x.u.comments.slice(), topics: [] }; state.doc.units.push(u); }
    let t = u.topics.find(y => y.name === x.t.name);
    if (!t) { t = { uid: uid(), name: x.t.name, comments: x.t.comments.slice(), cards: [] }; if (t.name === null) u.topics.unshift(t); else u.topics.push(t); }
    const ids = new Set(allCards().map(y => y.c.id));
    let id = x.c.id, n = 2;
    while (ids.has(id)) id = x.c.id + '-' + n++;
    const c = { uid: uid(), id, front: x.c.front, back: x.c.back, frontTikz: x.c.frontTikz, backTikz: x.c.backTikz, hidden: false, comments: x.c.comments.slice(), isNew: true, origin: { file, id: x.c.id } };
    t.cards.push(c);
    setDecision(file, x.c.id, null);
    if (!quiet) toast(id !== x.c.id ? 'เพิ่มแล้ว (เปลี่ยน id เป็น ' + id + ' เพราะซ้ำ)' : 'เพิ่มเข้า "' + u.name + '" แล้ว');
    return c;
  }

  function renderDrafts() {
    const root = $('drafts');
    const kids = [];
    kids.push(h('p', { class: 'draft-note' }, 'การ์ดที่ Claude เขียนไว้ในโฟลเดอร์ flashcards/drafts/ กด "เพิ่ม" เพื่อนำเข้าไปในไฟล์ แล้วแก้/ลากจัดลำดับในแท็บการ์ดทั้งหมดได้'));
    if (state.draftsError) kids.push(h('p', { class: 'draft-errors' }, state.draftsError));
    if (!state.drafts.length && !state.draftsError) kids.push(h('div', { class: 'empty' }, h('p', {}, 'ยังไม่มีไฟล์ร่าง'), h('p', {}, 'ส่ง PDF ให้ Claude ใน repo Math-contents แล้วบอกว่า "ทำการ์ดจากไฟล์นี้"')));
    state.drafts.forEach(d => {
      const list = draftCards(d).map(x => ({ x, st: draftState(d.name, x) }));
      const pending = list.filter(y => y.st === 'pending');
      const counts = ['pending', 'added', 'rejected', 'published'].map(k => list.filter(y => y.st === k).length);
      const fileEl = h('div', { class: 'draft-file' },
        h('h3', {}, d.name),
        h('p', { class: 'draft-meta' }, [d.meta['จาก'] ? 'จาก: ' + d.meta['จาก'] : '', d.meta['วันที่'] ? 'วันที่: ' + d.meta['วันที่'] : ''].filter(Boolean).join('  ') || ' '),
        h('p', { class: 'draft-meta' }, 'รอตรวจ ' + counts[0] + '  เพิ่มแล้ว ' + counts[1] + '  ไม่ใช้ ' + counts[2] + '  เผยแพร่แล้ว ' + counts[3]),
        d.errors.length ? h('ul', { class: 'draft-errors' }, d.errors.map(e => h('li', {}, e))) : null,
        pending.length > 1 ? h('div', { class: 'draft-actions' }, h('button', { class: 'act primary', type: 'button', onclick: () => { pending.forEach(y => addDraftCard(d.name, y.x, true)); changed(); renderAll(); toast('เพิ่ม ' + pending.length + ' ใบแล้ว'); } }, 'เพิ่มทั้งหมดที่รอตรวจ (' + pending.length + ')')) : null);
      list.filter(y => y.st === 'pending' || y.st === 'rejected').forEach(({ x, st }) => {
        const sel = state.sel && state.sel.kind === 'draft' && state.sel.file === d.name && state.sel.id === x.c.id;
        fileEl.append(h('div', { class: 'draft-card' + (sel ? ' selected' : ''), tabindex: '0', role: 'button', onclick: e => { if (e.target.closest('button')) return; select({ kind: 'draft', file: d.name, id: x.c.id }); },
          onkeydown: e => { if (e.key === 'Enter') select({ kind: 'draft', file: d.name, id: x.c.id }); } },
          h('span', { class: 'draft-where' }, x.u.name + (x.t.name ? ' › ' + x.t.name : '') + '  ·  ' + x.c.id + (st === 'rejected' ? '  (ไม่ใช้)' : '')),
          oneLine(x.c.front, 'draft-text', '(ไม่มีคำถาม)'),
          h('div', { class: 'draft-actions' },
            st === 'pending' ? h('button', { class: 'act primary', type: 'button', onclick: () => { const c = addDraftCard(d.name, x); changed(); select({ kind: 'card', uid: c.uid }); } }, 'เพิ่ม') : null,
            st === 'pending' ? h('button', { class: 'act', type: 'button', onclick: () => { setDecision(d.name, x.c.id, 'rejected'); changed(); renderAll(); } }, 'ไม่ใช้') : null,
            st === 'rejected' ? h('button', { class: 'act', type: 'button', onclick: () => { setDecision(d.name, x.c.id, null); changed(); renderAll(); } }, 'กู้คืน') : null)));
      });
      if (!pending.length && !counts[2]) fileEl.append(h('p', { class: 'draft-note' }, 'ตรวจครบทุกใบแล้ว ลบไฟล์นี้ใน GitHub ได้เมื่อ Commit cards.js แล้ว'));
      kids.push(fileEl);
    });
    root.replaceChildren(...kids);
  }
  function draftInfo(sel) {
    const x = draftCardOf(sel);
    if (!x) return h('div', { class: 'empty' }, h('p', {}, 'ไม่พบการ์ดนี้ในไฟล์ร่าง'));
    const st = draftState(sel.file, x);
    const exists = state.doc.units.some(u => u.name === x.u.name);
    return h('div', {},
      h('p', { class: 'crumb' }, 'ร่างจาก ' + sel.file),
      h('div', { class: 'form-head' }, h('h2', {}, x.c.id)),
      h('p', { class: 'hint' }, 'จะเพิ่มเข้า: ' + x.u.name + (x.t.name ? ' › ' + x.t.name : '') + (exists ? '' : '  (บทใหม่ ระดับ ' + (LEVEL_LABEL[x.u.level] || x.u.level) + ')')),
      h('p', { class: 'hint' }, 'กด "เพิ่ม" แล้วแก้ข้อความ ย้ายหัวข้อ หรือลากจัดลำดับได้ในแท็บการ์ดทั้งหมด'),
      x.c.comments.length ? h('p', { class: 'hint' }, 'โน้ตจาก Claude: ' + notesToText(x.c.comments)) : null,
      h('div', { class: 'form-actions' },
        st === 'pending' ? h('button', { class: 'act primary', type: 'button', onclick: () => { const c = addDraftCard(sel.file, x); changed(); state.tab = 'cards'; select({ kind: 'card', uid: c.uid }); } }, 'เพิ่มแล้วแก้ไข') : null,
        st === 'pending' ? h('button', { class: 'act', type: 'button', onclick: () => { setDecision(sel.file, x.c.id, 'rejected'); changed(); renderAll(); } }, 'ไม่ใช้') : null,
        st === 'rejected' ? h('button', { class: 'act', type: 'button', onclick: () => { setDecision(sel.file, x.c.id, null); changed(); renderAll(); } }, 'กู้คืน') : null));
  }

  /* =======================================================================
     Export: complete cards.js to paste over the file on GitHub
     ======================================================================= */
  function exportSummary() {
    const now = allCards();
    const nowIds = new Set(now.map(x => x.c.id));
    const added = now.filter(x => !state.base.ids.has(x.c.id)).length;
    const edited = now.filter(x => state.base.ids.has(x.c.id) && cardStatus(x.c, x.u, x.t) === 'edit').length;
    const removed = [...state.base.ids].filter(id => !nowIds.has(id));
    const orderNow = now.map(x => x.c.id).filter(id => state.base.ids.has(id));
    const orderBase = state.base.order.filter(id => nowIds.has(id));
    const moved = orderNow.join('|') !== orderBase.join('|');
    const unitsGone = [...state.base.unitNames].filter(n => !state.doc.units.some(u => u.name === n));
    return { added, edited, removed, moved, unitsGone };
  }
  function openExport() {
    const issues = validate();
    const errs = errorsOnly(issues);
    const body = $('export-body');
    if (errs.length) {
      body.replaceChildren(
        h('p', {}, 'ยังส่งออกไม่ได้ มี ' + errs.length + ' จุดที่ต้องแก้ก่อน:'),
        h('ul', { class: 'problems' }, errs.slice(0, 30).map(([id, list]) => {
          const card = findCard(id), tp = findTopic(id), un = findUnit(id);
          const where = card ? 'การ์ด ' + (card.c.id || '(ไม่มี id)') : tp ? 'หัวข้อ ' + tp.t.name : un ? 'บท ' + un.name : '';
          return h('li', {}, h('button', { class: 'link-btn', type: 'button', onclick: () => { $('export-dialog').close(); state.tab = 'cards'; select({ kind: card ? 'card' : tp ? 'topic' : 'unit', uid: id }); } }, where), ': ' + list.filter(x => !x.warn).map(x => x.msg).join(', '));
        })));
      $('export-dialog').showModal();
      return;
    }
    const text = currentText();
    // Final safety check: the file must read back without errors and with the same cards
    const check = CF.parse(CF.splitFile(text).text);
    const sum = exportSummary();
    const items = [];
    if (sum.added) items.push('เพิ่ม ' + sum.added + ' ใบ');
    if (sum.edited) items.push('แก้ ' + sum.edited + ' ใบ');
    if (sum.removed.length) items.push('ลบ ' + sum.removed.length + ' ใบ');
    if (sum.moved) items.push('เปลี่ยนลำดับ');
    if (!items.length) items.push(isDirty() ? 'เปลี่ยนโน้ต/ลำดับบทหรือหัวข้อ' : 'ไม่มีการเปลี่ยนแปลง');
    const ta = h('textarea', { class: 'export-text', readonly: true, spellcheck: 'false', 'aria-label': 'เนื้อหา cards.js ใหม่' });
    ta.value = text;
    const copyBtn = h('button', { class: 'act primary', type: 'button', onclick: async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch (e) { /* fall back below */ }
      if (!ok) {   // older browsers / blocked clipboard: copy from a temporary text box
        const tmp = h('textarea', { style: 'position:fixed;top:0;left:0;opacity:0' }); tmp.value = text;
        document.body.append(tmp); tmp.select();
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        tmp.remove();
      }
      if (!ok) { ta.closest('details').open = true; ta.focus(); ta.select(); toast('คัดลอกอัตโนมัติไม่ได้ กด Ctrl+C (⌘+C) เพื่อคัดลอกข้อความที่เลือกไว้'); return; }
      state.exportedHash = hash(text); saveWork();
      copyBtn.textContent = 'คัดลอกแล้ว ✓';
      toast('คัดลอกทั้งไฟล์แล้ว ไปวางแทนใน GitHub ได้เลย');
    } }, 'คัดลอกทั้งไฟล์');
    body.replaceChildren(...[
      h('ul', { class: 'summary-list' }, items.map(i => h('li', {}, i))),
      check.errors.length ? h('ul', { class: 'problems' }, h('li', {}, 'ตรวจไฟล์ที่ส่งออกแล้วพบปัญหา: ' + check.errors[0].message)) : null,
      sum.removed.length ? h('ul', { class: 'problems' }, h('li', { class: 'warn' }, 'การ์ดที่ถูกลบ (ความคืบหน้านักเรียนของการ์ดเหล่านี้จะหายไป): ' + sum.removed.join(', '))) : null,
      sum.unitsGone.length ? h('ul', { class: 'problems' }, h('li', { class: 'warn' }, 'บทที่เปลี่ยนชื่อ/ลบ: ' + sum.unitsGone.join(', ') + ' — นักเรียนที่ปักหมุดไว้ต้องปักหมุดใหม่')) : null,
      h('ol', { class: 'steps' },
        h('li', {}, 'กด ', h('b', {}, 'คัดลอกทั้งไฟล์')),
        h('li', {}, 'กด ', h('a', { href: `https://github.com/${REPO}/edit/${BRANCH}/${CARDS_PATH}`, target: '_blank', rel: 'noopener' }, 'เปิด cards.js ใน GitHub ↗')),
        h('li', {}, 'คลิกในช่องแก้ไข กด Ctrl+A (Mac: ⌘+A) แล้ววาง Ctrl+V (⌘+V)'),
        h('li', {}, 'กด Commit changes แล้วรอ 1–10 นาที แอปจะอัปเดตเอง')),
      h('div', { class: 'form-actions' }, copyBtn,
        h('a', { class: 'act', href: `https://github.com/${REPO}/edit/${BRANCH}/${CARDS_PATH}`, target: '_blank', rel: 'noopener', style: 'display:inline-flex;align-items:center;text-decoration:none;color:inherit' }, 'เปิด cards.js ใน GitHub ↗')),
      h('p', { class: 'hint' }, 'หลัง Commit แล้ว เปิดหน้านี้ใหม่ ระบบจะเริ่มจากไฟล์ใหม่ให้เอง งานที่ค้างในเบราว์เซอร์จะถูกล้าง'),
      h('details', { class: 'more' }, h('summary', {}, 'ดูเนื้อหาไฟล์'), ta)].filter(Boolean));   // optional warnings may be null
    $('export-dialog').showModal();
  }

  /* =======================================================================
     Wire up
     ======================================================================= */
  $('tab-cards').addEventListener('click', () => { state.tab = 'cards'; renderAll(); });
  $('tab-drafts').addEventListener('click', () => { state.tab = 'drafts'; renderAll(); });
  $('new-card').addEventListener('click', () => {
    const s = state.sel;
    const ctx = s && (s.kind === 'card' ? findCard(s.uid) : s.kind === 'topic' ? findTopic(s.uid) : s.kind === 'unit' ? { u: findUnit(s.uid) } : null);
    newCard(ctx && ctx.u, ctx && ctx.t);
  });
  $('export-btn').addEventListener('click', () => { if (state.doc) openExport(); });
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  $('export-dialog').addEventListener('click', e => { if (e.target === $('export-dialog')) $('export-dialog').close(); });
  window.addEventListener('beforeunload', () => { if (state.doc) { clearTimeout(saveTimer); try { localStorage.setItem(WORK_KEY, JSON.stringify({ baseHash: state.base.hash, exportedHash: state.exportedHash, doc: state.doc, decisions: state.decisions, savedAt: Date.now() })); } catch (e) { /* ignore */ } } });

  init();
})();
