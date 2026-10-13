/* flashcards/app.js — UI for the math flashcards app.
   Depends on (loaded before this file): KaTeX + auto-render (CDN), data.js (CARDS,
   TOPIC_GLYPH) and srs.js (SRS). Card content is authored by the teacher in data.js;
   it is still HTML-escaped before being put on the page. */
(function () {
  'use strict';

  /* =======================================================================
     Constants & small helpers
     ======================================================================= */
  const LEVELS = [
    { code: 'ps', label: 'ประถม' },
    { code: 'jh', label: 'ม.ต้น' },
    { code: 'sh', label: 'ม.ปลาย' },
    { code: 'uni', label: 'มหาลัย' },
  ];
  const LEVEL_LABEL = Object.fromEntries(LEVELS.map(l => [l.code, l.label]));
  const SETTINGS_KEY = 'mathFlashcards.settings.v1';
  const SWIPE_THRESHOLD = 90;   // px of horizontal drag that counts as an answer
  const MAX_SEGMENTS = 40;      // above this the progress bar becomes one continuous bar

  const $ = id => document.getElementById(id);
  // A preview copy (tools/make-preview.mjs) shares progress with the live app but must not
  // install itself or take over the offline helper.
  const PREVIEW = window.FLASHCARDS_PREVIEW === true;
  const reduceMotion = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const prefersDark = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : { matches: false };

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // Same mini-format as the previous version: **bold** and real line breaks.
  function formatFace(raw) {
    return escapeHtml(raw)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }
  // Thai text in the data mixes "ำ" (U+0E33) and "ํา" (U+0E4D U+0E32); treat them the same when searching.
  function normalize(s) {
    return String(s || '').replace(/ํา/g, 'ำ').toLowerCase();
  }
  // Card text without LaTeX commands, for search only.
  function searchableText(raw) {
    return normalize(String(raw || '').replace(/\\[a-zA-Z]+/g, ' ').replace(/[$*{}\\^_]/g, ' '));
  }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function today() { return SRS.toDay(new Date()); }
  function levelCode(level) { return LEVEL_LABEL[level] ? level : 'sh'; } // styling fallback only
  function levelLabel(level) { return LEVEL_LABEL[level] || level || ''; }
  function pct(part, whole) { return whole ? Math.round((part / whole) * 100) : 0; }
  // "พรุ่งนี้" / "ในอีก 3 วัน" — used as "กลับมาอีกที…"
  function comeBackWhen(day) {
    const d = SRS.daysBetween(today(), day);
    return d <= 1 ? 'พรุ่งนี้' : 'ในอีก ' + d + ' วัน';
  }

  /* =======================================================================
     Data: cards → decks. A deck is one บท (unit; called "topic" in the code).
     Inside a deck, cards can be grouped by หัวข้อ ("section"), in order of
     first appearance. Cards without a หัวข้อ in a unit that has some are
     grouped as "ทั่วไป".
     ======================================================================= */
  const NO_SECTION = '';
  const sectionLabel = key => key || 'ทั่วไป';
  const CARD_LIST = (typeof CARDS !== 'undefined' && Array.isArray(CARDS)) ? CARDS : [];
  const GLYPHS = (typeof TOPIC_GLYPH !== 'undefined' && TOPIC_GLYPH) ? TOPIC_GLYPH : {};
  const IDS = SRS.assignIds(CARD_LIST);
  const idOf = card => IDS.get(card);

  const DECKS = (function buildDecks() {
    const map = new Map();
    CARD_LIST.forEach(c => {
      if (!map.has(c.topic)) map.set(c.topic, { topic: c.topic, level: c.level, cards: [], sections: [], text: normalize(c.topic) });
      const deck = map.get(c.topic);
      deck.cards.push(c);
      const key = c.section || NO_SECTION;
      let sec = deck.sections.find(s => s.key === key);
      if (!sec) deck.sections.push(sec = { key, cards: [] });
      sec.cards.push(c);
      deck.text += ' ' + normalize(c.section) + ' ' + searchableText(c.front) + ' ' + searchableText(c.back);
    });
    return [...map.values()];
  })();
  const deckByTopic = topic => DECKS.find(d => d.topic === topic);
  const hasSections = deck => deck.sections.some(s => s.key !== NO_SECTION);
  function glyphFor(topic) { return GLYPHS[topic] || (topic ? topic.charAt(0).toUpperCase() : '?'); }

  /* =======================================================================
     Storage: progress (srs.js) + settings
     ======================================================================= */
  const storage = (function () {
    try { const s = window.localStorage; s.getItem('x'); return s; }
    catch (err) { // private mode etc. — keep working for this visit only
      const mem = {};
      return { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
    }
  })();

  let srs = SRS.load(storage, today()).state;
  const saveProgress = () => SRS.save(storage, srs);

  const settings = Object.assign({ theme: null, palette: 'bauhaus', filter: 'all', noticeDone: false, pins: [] },
    (function () { try { return JSON.parse(storage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (e) { return {}; } })());
  if (!Array.isArray(settings.pins)) settings.pins = [];
  // Unticked หัวข้อ per unit: { [unit]: [sectionKey, …] }. Stored as "off" so topics
  // the teacher adds later start ticked.
  if (!settings.off || typeof settings.off !== 'object' || Array.isArray(settings.off)) settings.off = {};
  // Pinned decks are "my decks": once a student has any, the app opens on them.
  if (settings.pins.some(t => DECKS.some(d => d.topic === t))) settings.filter = 'pinned';
  if (!['all', 'pinned', ...LEVELS.map(l => l.code)].includes(settings.filter)) settings.filter = 'all';
  if (!SRS.NEW_PER_DAY_CHOICES.includes(settings.newPerDay)) settings.newPerDay = SRS.DEFAULT_NEW_PER_DAY;
  // End-of-round celebration style; sound and vibration stay off unless the student turns them on
  if (!Celebrate.STYLES.includes(settings.celebrate)) settings.celebrate = Celebrate.DEFAULT_STYLE;
  settings.sound = settings.sound === true;
  settings.vibe = settings.vibe === true && Celebrate.canVibrate();
  function saveSettings() { try { storage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ } }

  // Answers per day (streak) and how many new cards were started today
  let stats = SRS.loadStats(storage, today());
  const saveStats = () => SRS.saveStats(storage, stats);
  const allowance = () => SRS.newAllowance(stats, today(), settings.newPerDay);
  /* "ใบที่รอทวน" for a set of cards (in teaching order): every studied card that is due,
     plus the first few never-studied cards — at most today's new-card allowance. */
  function dueSet(cards) {
    const r = SRS.selectDue(srs, cards.map(idOf), today(), allowance());
    const pick = new Set([...r.reviews, ...r.fresh]);
    return { cards: cards.filter(c => pick.has(idOf(c))), reviews: r.reviews.length, fresh: r.fresh.length, newTotal: r.newTotal };
  }

  // How many cards will be waiting tomorrow: reviews due by then + tomorrow's new cards
  function tomorrowCount(cards) {
    const tomorrow = SRS.addDays(today(), 1);
    let reviews = 0, unseen = 0;
    cards.forEach(c => { const r = srs.cards[idOf(c)]; if (r) { if (r.due <= tomorrow) reviews++; } else unseen++; });
    return reviews + Math.min(settings.newPerDay, unseen);
  }
  // Cards answered today (each card once), for the "X จาก Y ใบ" ring
  function answeredToday(cards) {
    const t = today();
    return cards.filter(c => { const r = srs.cards[idOf(c)]; return r && r.t && SRS.toDay(new Date(r.t)) === t; }).length;
  }

  // Topics the student ticked in a unit (all, if the unit has no หัวข้อ)
  const isSectionOn = (deck, key) => !(settings.off[deck.topic] || []).includes(key);
  function activeCards(deck) {
    if (!hasSections(deck)) return deck.cards;
    return deck.sections.filter(s => isSectionOn(deck, s.key)).flatMap(s => s.cards);
  }
  function setSectionOn(deck, key, on) {
    const off = (settings.off[deck.topic] || []).filter(k => k !== key);
    if (!on) off.push(key);
    if (off.length) settings.off[deck.topic] = off; else delete settings.off[deck.topic];
    saveSettings();
  }

  // Per-deck numbers used across screens
  function deckStats(cards) {
    const t = today();
    let mastered = 0, nextDue = null;
    const boxes = [0, 0, 0, 0, 0, 0]; // index 0 = new
    cards.forEach(c => {
      const id = idOf(c);
      const box = SRS.boxOf(srs, id);
      boxes[box]++;
      const r = srs.cards[id];
      if (r && r.due > t && (!nextDue || r.due < nextDue)) nextDue = r.due;
      if (SRS.isMastered(srs, id)) mastered++;
    });
    const d = dueSet(cards);
    return { total: cards.length, due: d.cards.length, fresh: d.fresh, newTotal: d.newTotal, mastered, boxes, nextDue };
  }

  /* =======================================================================
     Theme & palette
     ======================================================================= */
  const root = document.documentElement;
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  function isDark() { return settings.theme ? settings.theme === 'dark' : prefersDark.matches; }
  function applyTheme() {
    root.setAttribute('data-theme', isDark() ? 'dark' : 'light');
    root.setAttribute('data-palette', settings.palette === 'classic' ? 'classic' : 'bauhaus');
    document.querySelectorAll('.js-theme-toggle').forEach(btn => {
      btn.querySelector('use').setAttribute('href', isDark() ? '#i-sun' : '#i-moon');
      btn.setAttribute('aria-label', isDark() ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด');
    });
    updateThemeColor();
  }
  function updateThemeColor() {
    if (!metaTheme) return;
    const cs = getComputedStyle(root);
    let color = cs.getPropertyValue('--bg');
    if (currentScreen === 'home') color = cs.getPropertyValue('--brand');
    if (currentScreen === 'study' && !isDark() && session) {
      color = cs.getPropertyValue('--lv-' + levelCode(currentCard() ? currentCard().level : 'sh'));
    }
    metaTheme.setAttribute('content', color.trim() || '#2D3A8C');
  }
  const onSystemThemeChange = () => { if (!settings.theme) applyTheme(); };
  if (prefersDark.addEventListener) prefersDark.addEventListener('change', onSystemThemeChange);
  else if (prefersDark.addListener) prefersDark.addListener(onSystemThemeChange);

  document.querySelectorAll('.js-theme-toggle').forEach(btn => btn.addEventListener('click', () => {
    settings.theme = isDark() ? 'light' : 'dark';
    saveSettings(); applyTheme();
  }));

  /* =======================================================================
     Screens + browser history (Android back button returns inside the app)
     ======================================================================= */
  const SCREENS = { home: $('screen-home'), hub: $('screen-hub'), grid: $('screen-grid'), study: $('screen-study') };
  let currentScreen = 'home';
  let currentTopic = null;

  function show(name) {
    Object.entries(SCREENS).forEach(([key, el]) => {
      const on = key === name;
      el.classList.toggle('active', on);
      el.toggleAttribute('inert', !on);
      el.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    currentScreen = name;
    updateThemeColor();
  }
  function focusFirst(name) {
    // Study: focus the card itself so Space flips it straight away.
    const target = name === 'study' ? cardDrag : (SCREENS[name].querySelector('.js-back') || SCREENS[name].querySelector('h1, h2'));
    if (target && document.activeElement !== $('search')) target.focus({ preventScroll: true });
  }
  function navigate(name, data) {
    history.pushState(Object.assign({ screen: name }, data || {}), '');
    route(history.state, true);
  }
  function route(state, moveFocus) {
    const s = state || { screen: 'home' };
    if (s.screen !== 'study') stopCelebration();
    if (s.topic) currentTopic = s.topic;
    if (s.screen === 'hub' && deckByTopic(currentTopic)) renderHub();
    else if (s.screen === 'grid' && deckByTopic(currentTopic)) renderGrid();
    else if (s.screen === 'study' && session) { /* returning forward into a running session */ }
    else { renderHome(); s.screen = 'home'; }
    show(s.screen);
    if (moveFocus) focusFirst(s.screen);
  }
  window.addEventListener('popstate', e => route(e.state, true));
  document.querySelectorAll('.js-back').forEach(btn => btn.addEventListener('click', () => history.back()));

  /* =======================================================================
     Shared render bits
     ======================================================================= */
  function boxDots(box) {
    const label = box ? 'กล่อง ' + box + ' จาก 5' : 'การ์ดใหม่';
    let html = '';
    for (let i = 1; i <= SRS.MAX_BOX; i++) html += '<i class="' + (i <= box ? 'on' : '') + '"></i>';
    return '<span class="leitner' + (box ? '' : ' new') + '" role="img" aria-label="' + label + '">' + html + '</span>';
  }
  function levelTagHtml(level) {
    const code = levelCode(level);
    return '<span class="shape ' + code + '" aria-hidden="true"></span>' + escapeHtml(levelLabel(level));
  }

  // ---- TikZ: load TikZJax only when a card actually has a diagram (same as before) ----
  let tikzLoading = null;
  function ensureTikzJax() {
    if (window.__tikzjaxLoaded || tikzLoading) return tikzLoading;
    tikzLoading = new Promise(resolve => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/@rod2ik/tikzjax/dist/fonts.min.css';
      document.head.appendChild(link);
      const scr = document.createElement('script');
      scr.src = 'https://cdn.jsdelivr.net/npm/@rod2ik/tikzjax/dist/tikzjax.min.js';
      scr.onload = () => { window.__tikzjaxLoaded = true; resolve(); };
      scr.onerror = () => resolve();
      document.head.appendChild(scr);
    });
    return tikzLoading;
  }
  // Diagrams are normally ready-made pictures (flashcards/figures/, drawn by a GitHub Action);
  // TikZJax is only the fallback for a diagram that has no picture yet.
  const FIGURE_DIR = 'flashcards/figures/';
  function figureOf(tikz) {
    const id = window.CardsFormat ? CardsFormat.figureId(tikz) : '';
    const size = id && window.CARD_FIGURES && window.CARD_FIGURES[id];
    return size ? { src: FIGURE_DIR + id + '.svg', w: size[0], h: size[1] } : null;
  }
  function tikzScript(holder, tikz) {
    ensureTikzJax();
    const scriptEl = document.createElement('script');
    scriptEl.type = 'text/tikz';
    scriptEl.textContent = tikz;
    holder.replaceChildren(scriptEl);
  }
  // Fetch a card's pictures ahead of time (also keeps them for offline use)
  function preloadFigures(card) {
    if (!card) return;
    [card.frontTikz, card.backTikz].forEach(t => { const f = t && figureOf(t); if (f) new Image().src = f.src; });
  }
  function renderFace(el, text, tikz) {
    el.innerHTML = formatFace(text);
    if (tikz) {
      const holder = document.createElement('div');
      holder.className = 'tikz-holder';
      const fig = figureOf(tikz);
      if (fig) {
        const img = new Image(fig.w, fig.h);
        img.alt = 'รูปประกอบ';
        img.decoding = 'async';
        img.onerror = () => tikzScript(holder, tikz);
        img.src = fig.src;
        holder.appendChild(img);
      } else {
        tikzScript(holder, tikz);
      }
      el.appendChild(holder);
    }
    if (window.renderMathInElement) {
      window.renderMathInElement(el, {
        delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }],
        throwOnError: false,
      });
    }
  }

  let toastTimer = null;
  // toast('ข้อความ') or toast('ข้อความ', { label: 'เลิกทำ', onClick }, 5000)
  function toast(msg, action, ms) {
    const el = $('toast'), btn = $('toast-action');
    $('toast-text').textContent = msg;
    btn.hidden = !action;
    btn.onclick = action ? () => { hideToast(); action.onClick(); } : null;
    if (action) btn.textContent = action.label;
    el.classList.toggle('has-action', !!action);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, ms || 2200);
  }
  function hideToast() { $('toast').classList.remove('show'); $('toast-action').onclick = null; }
  function announce(msg) { $('live').textContent = msg; }

  /* =======================================================================
     HOME — level filter, search, deck tiles
     ======================================================================= */
  let query = '';
  const searchEl = $('search');

  const isPinned = topic => settings.pins.includes(topic);
  function decksInFilter() {
    if (settings.filter === 'pinned') return DECKS.filter(d => isPinned(d.topic));
    return DECKS.filter(d => settings.filter === 'all' || d.level === settings.filter);
  }
  function visibleDecks() {
    const q = normalize(query.trim());
    // Keep file order everywhere, so a tile never jumps away right after it is pinned.
    return decksInFilter().filter(d => !q || d.text.includes(q));
  }

  function togglePin(topic) {
    const firstPin = !settings.pins.length;
    if (isPinned(topic)) settings.pins = settings.pins.filter(t => t !== topic);
    else settings.pins.push(topic);
    saveSettings();
    toast(isPinned(topic) ? (firstPin ? 'ปักหมุดแล้ว ดูได้ที่แถบ “ปักหมุด”' : 'ปักหมุดแล้ว') : 'เลิกปักหมุดแล้ว');
  }
  const PIN_ICON = '<svg aria-hidden="true"><use href="#i-pin"/></svg>';

  function renderFilters() {
    const el = $('filters');
    el.innerHTML = '';
    [{ code: 'pinned', label: 'ปักหมุด' }, { code: 'all', label: 'ทั้งหมด' }, ...LEVELS].forEach(chip => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      const count = chip.code === 'all' || chip.code === 'pinned' ? 1 : DECKS.filter(d => d.level === chip.code).length;
      if (!count) btn.classList.add('empty');
      btn.setAttribute('aria-pressed', settings.filter === chip.code ? 'true' : 'false');
      const icon = chip.code === 'pinned' ? PIN_ICON : chip.code === 'all' ? '' : '<span class="shape ' + chip.code + '" aria-hidden="true"></span>';
      btn.innerHTML = icon + escapeHtml(chip.label);
      btn.addEventListener('click', () => {
        settings.filter = chip.code;
        saveSettings();
        renderHome();
      });
      el.appendChild(btn);
    });
  }

  function renderDecks() {
    const grid = $('deck-grid');
    const decks = visibleDecks();
    grid.innerHTML = '';
    $('result-line').textContent = query.trim() ? 'พบ ' + decks.length + ' หัวข้อ' : '';

    if (!decks.length) {
      const searching = !!query.trim();
      const noPins = !searching && settings.filter === 'pinned';
      const title = searching ? 'ไม่พบหัวข้อ “' + escapeHtml(query.trim()) + '”' : noPins ? 'ยังไม่ได้ปักหมุดชุดไหน' : 'ยังไม่มีชุดการ์ดในระดับนี้';
      const text = searching ? 'ลองค้นด้วยคำอื่น หรือดูทุกระดับชั้น' : noPins ? 'แตะปุ่มหมุดบนชุดการ์ด เพื่อเก็บชุดที่เรียนอยู่ไว้ตรงนี้' : 'เลือกระดับชั้นอื่นเพื่อดูชุดการ์ด';
      grid.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-art" aria-hidden="true"><span class="shape ps"></span><span class="shape jh"></span><span class="shape sh"></span><span class="shape uni"></span></div>' +
          '<h3>' + title + '</h3><p>' + text + '</p>' +
          '<button class="pill-btn" type="button" id="empty-reset">' + (searching ? 'ล้างการค้นหา' : noPins ? 'เลือกบทที่เรียนอยู่' : 'ดูทุกระดับชั้น') + '</button>' +
        '</div>';
      $('empty-reset').addEventListener('click', () => {
        if (noPins) { openWelcome(); return; }
        query = ''; searchEl.value = '';
        settings.filter = 'all'; saveSettings();
        renderHome(); searchEl.focus();
      });
      return;
    }

    decks.forEach((deck, i) => {
      const st = deckStats(deck.cards);
      const dueTicked = deckStats(activeCards(deck)).due; // due count follows the ticked หัวข้อ
      const code = levelCode(deck.level);
      const m = SRS.mastery(srs, deck.cards.map(idOf));
      const cell = document.createElement('div');
      cell.className = 'deck-cell';
      cell.style.animationDelay = Math.min(i * 40, 400) + 'ms';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'deck lv-' + code + (m.expert ? ' expert' : '');
      btn.innerHTML =
        '<span class="big-shape ' + code + '" aria-hidden="true"><span class="glyph">' + escapeHtml(glyphFor(deck.topic)) + '</span></span>' +
        '<span class="level-tag">' + levelTagHtml(deck.level) + '</span>' +
        '<span class="deck-title">' + escapeHtml(deck.topic) + '</span>' +
        '<span class="deck-count">' + st.total + ' ใบ</span>' +
        (dueTicked ? '<span class="due-badge">' + dueTicked + ' ใบรอทวน</span>' : '') +
        '<span class="deck-foot">' + masteryRing(m) +
          '<span class="deck-pct">' + (m.expert ? '<b>เชี่ยวชาญแล้ว</b>' : 'ชำนาญ ' + Math.round(m.score * 100) + '%') + '</span></span>';
      btn.addEventListener('click', () => navigate('hub', { topic: deck.topic }));

      // Pin toggle sits beside (not inside) the tile button: buttons can't be nested.
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'pin-btn';
      pin.innerHTML = PIN_ICON;
      setPinState(pin, deck.topic, false);
      pin.addEventListener('click', () => { togglePin(deck.topic); renderHome(); });

      cell.append(btn, pin);
      grid.appendChild(cell);
    });
  }
  // The unit's mastery ring: fills as its cards reach boxes 2–4; gold with a star when all are in box 4+
  const RING_C = 2 * Math.PI * 15;
  function masteryRing(m) {
    return '<svg class="m-ring" viewBox="0 0 36 36" aria-hidden="true">' +
      '<circle class="m-track" cx="18" cy="18" r="15"/>' +
      '<circle class="m-fill" cx="18" cy="18" r="15" transform="rotate(-90 18 18)" stroke-dasharray="' + RING_C.toFixed(2) + '" stroke-dashoffset="' + (RING_C * (1 - m.score)).toFixed(2) + '"/>' +
      (m.expert ? '<path class="m-star" d="M18 10.5l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5-3.7-3.4 5-.6z"/>' : '') +
      '</svg>';
  }
  function setPinState(btn, topic, withText) {
    const on = isPinned(topic);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    // a button that shows its words is named by them (+ aria-pressed); the icon-only pins need a label
    if (withText) { btn.removeAttribute('aria-label'); btn.querySelector('.pin-text').textContent = on ? 'ปักหมุดแล้ว' : 'ปักหมุด'; }
    else btn.setAttribute('aria-label', (on ? 'เลิกปักหมุด ' : 'ปักหมุด ') + topic);
  }

  // Cards written in the wrong format are skipped; tell the teacher where.
  function renderCardErrors() {
    const errors = (typeof CARD_ERRORS !== 'undefined' && Array.isArray(CARD_ERRORS)) ? CARD_ERRORS : [];
    const box = $('card-errors');
    box.hidden = !errors.length;
    if (!errors.length) return;
    $('card-errors-title').textContent = 'มี ' + errors.length + ' จุดในไฟล์การ์ดที่เขียนไม่ตรงรูปแบบ การ์ดเหล่านั้นจึงยังไม่แสดง';
    $('card-errors-list').innerHTML = errors.map(e =>
      '<li>บรรทัด ' + e.line + ': ' + escapeHtml(e.message) + '</li>').join('');
  }

  function renderDueLine() {
    const cards = decksInFilter().flatMap(activeCards);
    const st = deckStats(cards);
    renderHeroMeta();
    // new cards arrive a few per day: say how many are still waiting
    const waiting = st.newTotal - st.fresh;
    const note = $('new-note');
    // explained during the first week of studying; after that students know how it works
    const studyDays = Object.keys(stats.days || {}).filter(d => stats.days[d] > 0).length;
    note.hidden = !(waiting > 0 && studyDays < 7);
    if (!note.hidden) note.textContent = 'การ์ดใหม่มาวันละ ' + settings.newPerDay + ' ใบ · ยังรออีก ' + waiting + ' ใบ (ปรับได้ในตั้งค่า)';
    const line = $('due-line');
    const cta = $('study-due-all');
    const pinnedTab = settings.filter === 'pinned';
    if (st.due) {
      line.innerHTML = 'ได้เวลาทวนแล้ว <b>' + st.due + '</b> ใบ';
      $('study-due-all-label').textContent = 'เริ่มทวน ' + st.due + ' ใบ';
      cta.disabled = false;
    } else if (cards.length && SRS.todayCount(stats, today())) {
      // Studied today and nothing left: a clear finish line (and a ● on the poster)
      if (!((stats.info || {})[today()] || {}).c) { stats = SRS.markCleared(stats, today()); saveStats(); }
      const next = tomorrowCount(cards);
      line.innerHTML = '<span class="done-mark" aria-hidden="true"></span><b>เสร็จแล้ววันนี้</b> · ' +
        (next ? 'พรุ่งนี้มี ' + next + ' ใบ' : 'กลับมาอีกที' + comeBackWhen(st.nextDue));
      $('study-due-all-label').textContent = pinnedTab ? 'เลือกวิธีทวน' : 'วันนี้ทวนครบแล้ว';
      cta.disabled = !pinnedTab;
    } else if (cards.length) {
      line.textContent = 'วันนี้ทวนครบแล้ว กลับมาอีกที' + comeBackWhen(st.nextDue);
      // In the pinned tab students can still review everything (e.g. before a test)
      $('study-due-all-label').textContent = pinnedTab ? 'เลือกวิธีทวน' : 'วันนี้ทวนครบแล้ว';
      cta.disabled = !pinnedTab;
    } else {
      line.textContent = settings.filter === 'pinned' ? 'ปักหมุดชุดการ์ดที่เรียนอยู่ แล้วเริ่มทวนได้เลย' : 'ยังไม่มีการ์ดในระดับนี้';
      $('study-due-all-label').textContent = 'เริ่มทวน';
      cta.disabled = true;
    }
  }

  // "วันนี้ทวนแล้ว 12 ใบ · ต่อเนื่อง 5 วัน"
  function renderHeroMeta() {
    const n = SRS.todayCount(stats, today());
    const info = SRS.streakInfo(stats, today());
    const run = info.count;
    const el = $('hero-meta');
    const parts = [];
    if (n) parts.push('<span>วันนี้ทวนแล้ว <b>' + n + '</b> ใบ</span>');
    if (run >= 2) {
      // yesterday was missed but forgiven: say so, and that today keeps it going
      const restYesterday = info.rest[0] === SRS.addDays(today(), -1) && !info.todayDone;
      parts.push('<span class="streak"><svg aria-hidden="true"><use href="#i-flame"/></svg>ต่อเนื่อง <b>' + run + '</b> วัน' +
        (restYesterday ? '<small> (เมื่อวานเป็นวันพัก ทวนวันนี้เพื่อไปต่อ)</small>' : '') + '</span>');
    }
    // once there is anything to draw, the student's poster is one tap away
    if (Object.keys(stats.days || {}).some(d => stats.days[d] > 0)) parts.push('<button class="poster-link" type="button" data-open-poster>โปสเตอร์ของฉัน ›</button>');
    el.innerHTML = parts.join('');
    el.hidden = !parts.length;
  }

  function renderNotice() {
    $('notice').hidden = !(srs.migratedFromV1 && !settings.noticeDone);
  }

  function renderHome() {
    renderFilters();
    renderDueLine();
    renderDecks();
    renderNotice();
    renderCardErrors();
  }

  searchEl.addEventListener('input', () => { query = searchEl.value; renderDecks(); });
  $('study-due-all').addEventListener('click', () => {
    if (settings.filter === 'pinned') { openStudyChoice(); return; }
    const scope = decksInFilter().flatMap(activeCards);
    const due = dueSet(scope).cards;
    if (due.length) startSession(due, { title: 'การ์ดที่รอทวน', mixed: true, ordered: true, scope });
  });

  // The three ways to study a set of cards (used by the deck page and the pinned tab)
  function studyModes(cards, title, opts) {
    const st = deckStats(cards);
    const mixed = !!(opts && opts.mixed);
    const dueCards = dueSet(cards).cards;
    const notYet = cards.filter(c => SRS.lastAnswer(srs, idOf(c)) !== 'remembered');
    const none = !cards.length;
    const then = fn => () => { if (opts && opts.before) opts.before(); fn(); };
    return [
      modeButton({
        primary: true, icon: String(dueCards.length), title: 'ใบที่รอทวนอยู่',
        sub: none ? 'เลือกอย่างน้อย 1 หัวข้อ'
          : dueCards.length ? dueCards.length + ' ใบ' + (st.fresh ? ' (การ์ดใหม่ ' + st.fresh + ')' : '') + ' ใบที่ยังจำไม่ได้จะมาก่อน'
          : st.newTotal ? 'วันนี้เรียนการ์ดใหม่ครบแล้ว ใช้ “ทบทวนทั้งหมด” ได้ไม่จำกัด'
          : 'ไม่มีใบรอทวนวันนี้ กลับมาอีกที' + comeBackWhen(st.nextDue),
        disabled: !dueCards.length,
        onClick: then(() => startSession(dueCards, { title, mixed, ordered: true, scope: cards })),
      }),
      modeButton({
        icon: '∀', title: 'ทบทวนทั้งหมด', sub: none ? 'เลือกอย่างน้อย 1 หัวข้อ' : cards.length + ' ใบ สุ่มลำดับ',
        disabled: none,
        onClick: then(() => startSession(cards, { title, mixed })),
      }),
      modeButton({
        icon: '↺', title: 'ทบทวนใบที่ยังจำไม่ได้',
        sub: none ? 'เลือกอย่างน้อย 1 หัวข้อ' : notYet.length ? notYet.length + ' ใบ' : 'จำได้ครบทุกใบแล้ว',
        disabled: !notYet.length,
        onClick: then(() => startSession(notYet, { title, mixed })),
      }),
    ];
  }

  // Pinned tab: choose how to review all pinned units (their ticked หัวข้อ)
  const choiceDialog = $('study-choice');
  function openStudyChoice() {
    const decks = decksInFilter();
    const cards = decks.flatMap(activeCards);
    $('choice-sub').textContent = decks.length + ' บทที่ปักหมุด รวม ' + cards.length + ' ใบ';
    const list = $('choice-list');
    list.innerHTML = '';
    studyModes(cards, 'ที่ปักหมุดไว้', { mixed: true, before: () => choiceDialog.close() }).forEach(b => list.appendChild(b));
    if (choiceDialog.showModal) choiceDialog.showModal(); else choiceDialog.setAttribute('open', '');
  }
  choiceDialog.addEventListener('click', e => { if (e.target === choiceDialog) choiceDialog.close(); });
  $('notice-keep').addEventListener('click', () => {
    settings.noticeDone = true; saveSettings(); renderNotice();
    toast('ใช้สีใหม่');
  });
  $('notice-classic').addEventListener('click', () => {
    settings.noticeDone = true; settings.palette = 'classic'; saveSettings();
    applyTheme(); renderNotice();
    toast('เปลี่ยนเป็นสีคลาสสิกแล้ว');
  });

  /* =======================================================================
     HUB — one deck, choose how to study
     ======================================================================= */
  function renderHub() {
    const deck = deckByTopic(currentTopic);
    const code = levelCode(deck.level);
    const st = deckStats(deck.cards);

    $('hub-card').className = 'hub-card lv-' + code;
    $('hub-shape').className = 'big-shape ' + code;
    $('hub-glyph').textContent = glyphFor(deck.topic);
    $('hub-level').innerHTML = levelTagHtml(deck.level);
    $('hub-topic').textContent = deck.topic;
    setPinState($('hub-pin'), deck.topic, true);
    const m = SRS.mastery(srs, deck.cards.map(idOf));
    $('hub-sub').textContent = 'การ์ด ' + st.total + ' ใบ' + (hasSections(deck) ? ' ' + deck.sections.length + ' หัวข้อ' : '') +
      ' จำได้แล้ว ' + st.mastered + ' ใบ (' + pct(st.mastered, st.total) + '%) · ' +
      (m.expert ? 'เชี่ยวชาญแล้ว ★' : 'ชำนาญ ' + Math.round(m.score * 100) + '%');
    renderTopicList(deck);
    renderHubStudy(deck);
  }

  // Tick list of หัวข้อ (only for units that have them)
  function renderTopicList(deck) {
    const panel = $('topic-panel');
    panel.hidden = !hasSections(deck);
    if (panel.hidden) return;
    const list = $('topic-list');
    list.innerHTML = '';
    deck.sections.forEach((sec, i) => {
      const row = document.createElement('label');
      row.className = 'topic-row';
      row.innerHTML =
        '<input type="checkbox">' +
        '<span class="topic-check" aria-hidden="true"></span>' +
        '<span class="topic-name"></span>' +
        '<span class="topic-meta"></span>';
      const input = row.querySelector('input');
      input.checked = isSectionOn(deck, sec.key);
      input.dataset.key = sec.key;
      row.querySelector('.topic-name').textContent = sectionLabel(sec.key);
      input.addEventListener('change', () => {
        setSectionOn(deck, sec.key, input.checked);
        renderHubStudy(deck);
      });
      list.appendChild(row);
    });
    $('topic-all').onclick = () => {
      const allOn = deck.sections.every(s => isSectionOn(deck, s.key));
      deck.sections.forEach(s => setSectionOn(deck, s.key, !allOn));
      list.querySelectorAll('input').forEach(inp => { inp.checked = !allOn; });
      renderHubStudy(deck);
    };
  }

  // Everything on the deck page that depends on which หัวข้อ are ticked
  function renderHubStudy(deck) {
    const t = today();
    if (hasSections(deck)) {
      $('topic-list').querySelectorAll('.topic-row').forEach((row, i) => {
        const sec = deck.sections[i];
        const due = dueSet(sec.cards).cards.length;
        row.querySelector('.topic-meta').innerHTML = sec.cards.length + ' ใบ' + (due ? ' <span class="due-badge">' + due + ' รอทวน</span>' : '');
      });
      const allOn = deck.sections.every(s => isSectionOn(deck, s.key));
      $('topic-all').textContent = allOn ? 'ไม่เลือกทั้งหมด' : 'เลือกทั้งหมด';
      const on = deck.sections.filter(s => isSectionOn(deck, s.key)).length;
      $('topic-count').textContent = 'เลือก ' + on + ' จาก ' + deck.sections.length + ' หัวข้อ';
    }
    const cards = activeCards(deck);
    const st = deckStats(cards);

    // Box distribution (of the ticked หัวข้อ)
    const maxCount = Math.max(1, ...st.boxes);
    $('hub-boxes').innerHTML = st.boxes.map((n, box) =>
      '<div class="box-cell"><div class="stack"><span style="height:' + Math.round((n / maxCount) * 100) + '%"></span></div>' +
      '<b>' + n + '</b><small>' + (box ? 'กล่อง ' + box : 'ใหม่') + '</small></div>').join('');

    // Modes (ticked หัวข้อ only); the overview always shows the whole unit
    const list = $('mode-list');
    list.innerHTML = '';
    studyModes(cards, deck.topic).forEach(b => list.appendChild(b));
    list.appendChild(modeButton({
      icon: '⊞', title: 'ดูภาพรวมการ์ดทั้งหมด', sub: deck.cards.length + ' ใบ ดูเฉพาะด้านหน้า',
      onClick: () => navigate('grid', { topic: deck.topic }),
    }));
  }
  function modeButton({ primary, icon, title, sub, disabled, onClick }) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mode' + (primary ? ' primary' : '');
    btn.disabled = !!disabled;
    btn.innerHTML =
      '<span class="mode-icon" aria-hidden="true">' + escapeHtml(icon) + '</span>' +
      '<span class="mode-text"><span class="mode-title">' + escapeHtml(title) + '</span>' +
      '<span class="mode-sub">' + escapeHtml(sub) + '</span></span>';
    if (!disabled) btn.addEventListener('click', onClick);
    return btn;
  }

  $('hub-pin').addEventListener('click', () => {
    togglePin(currentTopic);
    setPinState($('hub-pin'), currentTopic, true);
  });

  /* =======================================================================
     GRID — all card fronts at a glance (no flip, no swipe)
     ======================================================================= */
  function renderGrid() {
    const deck = deckByTopic(currentTopic);
    $('grid-topic').textContent = deck.topic;
    $('grid-sub').textContent = levelLabel(deck.level) + ' ' + deck.cards.length + ' ใบ';
    const wrap = $('grid-wrap');
    wrap.innerHTML = '';
    let i = 0;
    // Grouped under a heading per หัวข้อ (no headings for units without หัวข้อ)
    deck.sections.forEach(sec => {
      if (hasSections(deck)) {
        const h = document.createElement('h3');
        h.className = 'grid-heading';
        h.innerHTML = escapeHtml(sectionLabel(sec.key)) + ' <span>' + sec.cards.length + ' ใบ</span>';
        wrap.appendChild(h);
      }
      sec.cards.forEach(card => {
        const tile = document.createElement('div');
        tile.className = 'grid-card';
        tile.style.animationDelay = Math.min(i * 25, 400) + 'ms';
        tile.innerHTML = '<span class="grid-index">' + (++i) + '</span>' + boxDots(SRS.boxOf(srs, idOf(card))) + '<span class="grid-content"></span>';
        // Diagrams are skipped here to keep the overview light (same as before).
        renderFace(tile.querySelector('.grid-content'), card.front, null);
        wrap.appendChild(tile);
      });
    });
  }

  /* =======================================================================
     STUDY SESSION
     session = {
       title, mixed, pool (original cards, for "shuffle whole deck again"),
       cards (order for this round), index,
       answers: Map id → true/false (this round),
       before:  Map id → saved record before this round (so re-answering a card
                after going back doesn't move it two boxes)
     }
     ======================================================================= */
  let session = null;
  let revealed = false;
  let animating = false;

  const studyEl = SCREENS.study;
  const cardDrag = $('card-drag');
  const cardFlip = $('card-flip');
  const currentCard = () => (session ? session.cards[session.index] : null);

  function startSession(cards, opts) {
    let order = shuffle(cards.slice());
    // Due mode: missed cards (box 1) first, then new cards, then higher boxes — shuffled within each group.
    if (opts.ordered) {
      const rank = c => { const box = SRS.boxOf(srs, idOf(c)); return box === 0 ? 1.5 : box; };
      order.sort((a, b) => rank(a) - rank(b));
    }
    session = {
      title: opts.title, mixed: !!opts.mixed, pool: cards.slice(),
      cards: order, index: 0, answers: new Map(), before: new Map(),
      dueMode: !!opts.ordered, scope: opts.scope || null,
      streakBefore: SRS.streak(stats, today()),
      history: [], // this round's answers, newest last: ↶ takes them back one by one
    };
    stopCelebration();
    order.forEach(preloadFigures); // diagrams are small; having them all makes a session work offline
    $('study-title').textContent = session.title;
    if (currentScreen === 'study') { renderCard(); return; } // restarting from the summary
    renderCard();
    navigate('study');
  }

  function setLevelClass(level) {
    const code = levelCode(level);
    ['ps', 'jh', 'sh', 'uni'].forEach(c => studyEl.classList.toggle('lv-' + c, c === code));
    $('ghost-shape').className = 'ghost-shape ' + code;
  }

  function renderCard() {
    const card = currentCard();
    const id = idOf(card);
    revealed = false;
    animating = false;

    // Reset card position/flip without animating
    cardDrag.style.transition = 'none';
    cardDrag.style.transform = '';
    cardDrag.style.opacity = '';
    cardFlip.classList.remove('flipped');
    $('wash-yes').style.opacity = 0;
    $('wash-no').style.opacity = 0;

    cardDrag.hidden = false;
    $('ghost-shape').hidden = false;
    $('summary').hidden = true;
    $('summary-actions').hidden = true;
    $('counter').hidden = false;
    $('segments').hidden = false;

    setLevelClass(card.level);
    const box = SRS.boxOf(srs, id);
    $('front-level').innerHTML = levelTagHtml(card.level);
    $('front-box').outerHTML = boxDots(box).replace('<span class="leitner', '<span id="front-box" class="leitner');
    $('back-box').outerHTML = boxDots(box).replace('<span class="leitner', '<span id="back-box" class="leitner');
    // Unit name in mixed sessions, plus the หัวข้อ when the card has one
    $('front-topic').textContent = session.mixed
      ? card.topic + (card.section ? ' › ' + card.section : '')
      : (card.section || '');
    renderFace($('front-content'), card.front, card.frontTikz);
    renderFace($('back-content'), card.back, card.backTikz);
    // Very short fronts (a single symbol like ℤ) get a bigger type size.
    $('front-content').classList.toggle('short', !card.frontTikz && String(card.front).replace(/\s+/g, '').length <= 24);
    $('front-content').parentElement.scrollTop = 0;
    $('back-content').parentElement.scrollTop = 0;

    updateFaceState();
    renderProgress();
    $('undo-btn').disabled = !session.history.length;
    showSwipeHint();
    announce('การ์ดที่ ' + (session.index + 1) + ' จาก ' + session.cards.length);
    updateThemeColor();

    void cardDrag.offsetWidth; // apply the reset before re-enabling transitions
    cardDrag.style.transition = '';
  }

  function updateFaceState() {
    cardFlip.classList.toggle('flipped', revealed);
    $('face-front').setAttribute('aria-hidden', revealed ? 'true' : 'false');
    $('face-back').setAttribute('aria-hidden', revealed ? 'false' : 'true');
    $('nav-row').hidden = revealed;
    $('answer-row').hidden = !revealed;
  }

  function renderProgress() {
    const n = session.cards.length;
    const masteredInRound = session.pool.filter(c => SRS.isMastered(srs, idOf(c))).length;
    $('counter-pos').textContent = Math.min(session.index + 1, n);
    $('counter-total').textContent = n + ' ใบ';
    $('counter-mastery').textContent = 'จำได้ ' + pct(masteredInRound, session.pool.length) + '%';

    const seg = $('segments');
    seg.setAttribute('aria-valuemax', n);
    seg.setAttribute('aria-valuenow', session.index);
    seg.setAttribute('aria-valuetext', 'การ์ดที่ ' + Math.min(session.index + 1, n) + ' จาก ' + n);
    if (n <= MAX_SEGMENTS) {
      seg.classList.remove('continuous');
      seg.innerHTML = session.cards.map((c, i) => {
        const a = session.answers.get(idOf(c));
        const cls = a === true ? 'yes' : a === false ? 'no' : (i === session.index ? 'current' : '');
        return '<i class="' + cls + '"></i>';
      }).join('');
    } else {
      seg.classList.add('continuous');
      seg.innerHTML = '<i style="width:' + pct(session.index, n) + '%"></i>';
    }
  }

  function flip() {
    if (!session || animating || !$('summary').hidden) return;
    revealed = !revealed;
    updateFaceState();
    announce(revealed ? 'คำตอบ' : 'คำถาม');
  }

  function answer(knew) {
    if (!session || animating || !$('summary').hidden) return;
    Celebrate.unlock(settings.sound); // inside the tap, so iPhones allow the sound at the end
    const card = currentCard();
    const id = idOf(card);

    // Everything needed to take this answer back (undo)
    const firstInSession = !session.before.has(id);
    const action = {
      id, index: session.index, knew, firstInSession,
      record: srs.cards[id] ? Object.assign({}, srs.cards[id]) : null,
      prevAnswer: session.answers.get(id),
      wasNew: firstInSession && !srs.cards[id],
    };
    // Undo this round's earlier answer for the same card before applying the new one
    if (firstInSession) session.before.set(id, srs.cards[id] ? Object.assign({}, srs.cards[id]) : null);
    else {
      const prev = session.before.get(id);
      if (prev) srs.cards[id] = Object.assign({}, prev); else delete srs.cards[id];
    }
    SRS.answer(srs, id, knew, today());
    saveProgress();
    if (firstInSession) { stats = SRS.recordAnswer(stats, today(), action.wasNew); saveStats(); }
    session.answers.set(id, knew);
    session.history.push(action);
    // the card's "จำได้ / ทบทวน" stamp confirms the answer; ↶ (bottom left) takes it back any time
    if (!settings.swipeHintDone) { settings.swipeHintDone = true; saveSettings(); $('swipe-hint').hidden = true; }

    const advance = () => {
      session.index++;
      if (session.index < session.cards.length) renderCard();
      else showSummary();
    };
    if (reduceMotion.matches) { advance(); return; }

    animating = true;
    const dir = knew ? 1 : -1;
    $(knew ? 'wash-yes' : 'wash-no').style.opacity = 1;
    cardDrag.style.transition = 'transform .38s cubic-bezier(.2,.8,.2,1), opacity .38s ease';
    cardDrag.style.transform = 'translateX(' + (dir * (window.innerWidth || 600)) + 'px) rotate(' + (dir * 18) + 'deg)';
    cardDrag.style.opacity = '0';
    setTimeout(advance, 380);
  }

  // Take back the latest answer of this round (a mis-swipe): restore the card, counts and
  // position. Each tap steps one answer further back; it also works from the end screen.
  function undoLast() {
    if (!session || animating || !session.history.length) return;
    const a = session.history.pop();
    stopCelebration();
    if (a.record) srs.cards[a.id] = a.record; else delete srs.cards[a.id];
    saveProgress();
    if (a.firstInSession) {
      session.before.delete(a.id);
      stats = SRS.unrecordAnswer(stats, today(), a.wasNew); saveStats();
    }
    if (a.prevAnswer === undefined) session.answers.delete(a.id); else session.answers.set(a.id, a.prevAnswer);
    session.index = a.index;
    renderCard();
    announce('เลิกทำแล้ว กลับไปที่การ์ดเดิม');
  }

  // First card ever on this device: show that cards can be swiped, with a gentle wiggle
  function showSwipeHint() {
    const hint = $('swipe-hint');
    hint.hidden = !!settings.swipeHintDone;
    if (settings.swipeHintDone || session.hinted || reduceMotion.matches || !cardDrag.animate) return;
    session.hinted = true;
    const opts = { duration: 1600, delay: 700, easing: 'ease-in-out' };
    cardDrag.animate([{ transform: 'none' }, { transform: 'translateX(26px) rotate(1.3deg)', offset: .25 }, { transform: 'none', offset: .5 },
      { transform: 'translateX(-26px) rotate(-1.3deg)', offset: .75 }, { transform: 'none' }], opts);
    $('wash-yes').animate([{ opacity: 0 }, { opacity: .55, offset: .25 }, { opacity: 0, offset: .5 }, { opacity: 0 }], opts);
    $('wash-no').animate([{ opacity: 0 }, { opacity: 0, offset: .5 }, { opacity: .55, offset: .75 }, { opacity: 0 }], opts);
  }

  function go(delta) {
    if (!session || animating || !$('summary').hidden) return;
    const next = session.index + delta;
    if (next < 0) return;
    session.index = next;
    if (next >= session.cards.length) showSummary(); else renderCard();
  }

  function shuffleRest() {
    if (!session || animating || !$('summary').hidden) return;
    const done = session.cards.slice(0, session.index);
    const rest = shuffle(session.cards.slice(session.index));
    session.cards = done.concat(rest);
    renderCard();
    toast('สลับลำดับการ์ดที่เหลือแล้ว');
  }

  function showSummary() {
    animating = false;
    const n = session.cards.length;
    let yes = 0, no = 0;
    session.answers.forEach(v => (v ? yes++ : no++));
    const skipped = n - yes - no;
    const retry = session.cards.filter(c => session.answers.get(idOf(c)) !== true);

    cardDrag.hidden = true;
    $('ghost-shape').hidden = true;
    $('nav-row').hidden = true;
    $('answer-row').hidden = true;
    $('summary').hidden = false;
    $('summary-actions').hidden = false;
    session.index = n;
    renderProgress();
    $('counter-pos').textContent = n;

    // Today so far: cards answered today vs. still waiting (in the cards this round came from)
    const home = homeScope();
    const scopeCards = session.scope || home;
    const left = dueSet(scopeCards).cards.length;
    const done = answeredToday([...new Set([...scopeCards, ...session.pool])]);
    const full = left === 0 && done > 0;  // nothing left to review today
    const answered = yes + no;
    const streakNow = SRS.streak(stats, today());
    const streakUp = streakNow > session.streakBefore;
    const milestone = SRS.streakMilestone(session.streakBefore, streakNow);
    if (full) stats = SRS.markCleared(stats, today());
    if (milestone || full) { stats = SRS.unlockMilestones(stats, today()); saveStats(); }

    $('summary-title').textContent = full ? 'ทวนครบแล้ววันนี้!' : n === yes ? 'จบชุดนี้แล้ว!' : 'จบรอบนี้แล้ว!';
    $('summary-milestone').hidden = !milestone;
    $('summary-milestone').textContent = milestone ? 'ทวนต่อเนื่องครบ ' + milestone + ' วัน!' : '';
    $('summary-today').hidden = full || !left || !answered;
    $('summary-today').textContent = 'วันนี้ยังมีการ์ดรอทวนอีก ' + left + ' ใบ';
    $('summary-praise').hidden = !(n > 0 && yes === n);
    const streakShown = streakUp ? session.streakBefore : streakNow;
    $('summary-stats').innerHTML =
      '<div class="stat yes"><b>' + yes + '</b><span>จำได้</span></div>' +
      '<div class="stat no"><b>' + no + '</b><span>ยังจำไม่ได้</span></div>' +
      (skipped ? '<div class="stat"><b>' + skipped + '</b><span>ข้าม</span></div>' : '') +
      (streakNow ? '<div class="stat streak"><b><svg aria-hidden="true"><use href="#i-flame"/></svg><span class="num" id="summary-streak">' + streakShown + '</span></b><span>วันต่อเนื่อง</span></div>' : '');

    // When do these cards come back? (After a cleared day: how many are waiting tomorrow.)
    const t = today();
    const future = session.pool.map(c => srs.cards[idOf(c)]).filter(r => r && r.due > t).map(r => r.due).sort();
    const tomorrow = full ? tomorrowCount(home.length ? home : scopeCards) : 0;
    if (full && tomorrow) {
      $('summary-next').textContent = 'พรุ่งนี้มีการ์ดรอทวน ' + tomorrow + ' ใบ แล้วเจอกันพรุ่งนี้';
    } else if (future.length) {
      const first = future[0];
      const count = future.filter(d => d === first).length;
      const days = SRS.daysBetween(t, first);
      $('summary-next').textContent = (days <= 1 ? 'พรุ่งนี้มีอีก ' : 'อีก ' + days + ' วันจะมีอีก ') + count + ' ใบที่รอทวน การ์ดที่จำได้จะกลับมาช้าลงเรื่อย ๆ';
    } else {
      $('summary-next').textContent = '';
    }

    // Which cards were answered "ยังจำไม่ได้" — tap to see question + answer
    const missed = session.cards.filter(c => session.answers.get(idOf(c)) === false);
    const box = $('summary-missed');
    box.hidden = !missed.length;
    box.open = false;
    if (missed.length) {
      $('summary-missed-title').textContent = 'ดูใบที่ยังจำไม่ได้ (' + missed.length + ')';
      const list = $('summary-missed-list');
      list.innerHTML = '';
      missed.forEach(c => {
        const li = document.createElement('li');
        const q = document.createElement('div'); q.className = 'missed-q';
        const a = document.createElement('div'); a.className = 'missed-a';
        renderFace(q, c.front, null); renderFace(a, c.back, null);
        li.append(q, a); list.appendChild(li);
      });
    }

    /* One clear next step, the picture to keep (if any), everything else as small links:
       missed cards → review them · cards still waiting today → keep going · otherwise → done */
    const actions = $('summary-actions');
    actions.innerHTML = '';
    const scope = session.scope;
    const moreNew = session.dueMode && scope && allowance() === 0 && scope.some(c => !srs.cards[idOf(c)]);
    const finish = () => history.back();
    const keepGoing = () => startSession(dueSet(scopeCards).cards, { title: 'การ์ดที่รอทวน', mixed: true, ordered: true, scope: scopeCards });
    if (retry.length) {
      const label = skipped && no ? 'ทบทวนใบที่ยังจำไม่ได้และที่ข้าม' : skipped ? 'ทบทวนใบที่ข้าม' : 'ทบทวนใบที่ยังจำไม่ได้';
      actions.appendChild(actionBtn(label + ' (' + retry.length + ')', 'answer-btn btn-know',
        () => startSession(retry, { title: session.title, mixed: session.mixed })));
    } else if (left && answered) {
      actions.appendChild(actionBtn('ทวนต่ออีก ' + left + ' ใบ', 'answer-btn btn-know', keepGoing));
    } else {
      actions.appendChild(actionBtn('เสร็จแล้ว', 'answer-btn btn-know', finish));
    }
    // the picture to keep: the new streak card, or this month's poster after a cleared day
    if (milestone) actions.appendChild(actionBtn('ดูการ์ด ' + milestone + ' วันต่อเนื่อง', 'answer-btn ghost-btn', () => openPoster({ card: milestone })));
    else if (full) actions.appendChild(actionBtn('ดูโปสเตอร์เดือนนี้', 'answer-btn ghost-btn', () => openPoster()));
    const links = document.createElement('div');
    links.className = 'summary-links';
    if (retry.length || (left && answered)) links.appendChild(actionBtn('เสร็จแล้ว', 'link-btn', finish));
    links.appendChild(actionBtn('สุ่มใหม่ทั้งชุด', 'link-btn', () => startSession(session.pool, { title: session.title, mixed: session.mixed })));
    if (moreNew) {
      links.appendChild(actionBtn('+ การ์ดใหม่อีก ' + settings.newPerDay + ' ใบวันนี้', 'link-btn', () => {
        stats = SRS.addExtraNew(stats, today(), settings.newPerDay); saveStats();
        startSession(dueSet(scope).cards, { title: session.title, mixed: session.mixed, ordered: true, scope });
      }));
    }
    if (session.history.length) links.appendChild(actionBtn('↶ แก้คำตอบใบสุดท้าย', 'link-btn', undoLast));
    actions.appendChild(links);

    announce((full ? 'ทวนครบแล้ววันนี้ ' : 'จบรอบนี้ ') + 'จำได้ ' + yes + ' จาก ' + n + ' ใบ');
    $('summary-title').focus({ preventScroll: true });

    // The celebration; the text and buttons appear when it says so
    const summary = $('summary');
    summary.classList.add('pre'); actions.classList.add('pre');
    const lastLevel = levelCode((session.cards[n - 1] || session.cards[0]).level);
    celebration = Celebrate.play({
      art: $('summary-art'), style: settings.celebrate, full, done, goal: done + left, shape: lastLevel,
      sound: settings.sound && answered > 0, vibe: settings.vibe && answered > 0,
      reduce: reduceMotion.matches || !answered,
      onReveal: () => revealSummary(!reduceMotion.matches && answered > 0),
      onStreak: () => { if (streakUp) Celebrate.tickNumber($('summary-streak'), streakNow, settings.sound); if (milestone) Celebrate.buzz(settings.vibe, [30, 60, 30]); },
    });
  }
  let celebration = null;
  function stopCelebration() { if (celebration) { celebration.skip(); celebration = null; } }
  function revealSummary(animate) {
    const summary = $('summary'), actions = $('summary-actions');
    if (!summary.classList.contains('pre')) return;
    summary.classList.remove('pre'); actions.classList.remove('pre');
    if (!animate) return;
    [...summary.children].filter(el => el.id !== 'summary-art' && !el.hidden).concat([actions]).forEach((el, i) =>
      el.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: i * 60, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
  }
  // Tap the end screen to skip the animation
  $('summary').addEventListener('click', () => { if (celebration && celebration.playing()) celebration.skip(); });
  function homeScope() { return decksInFilter().flatMap(activeCards); }
  function actionBtn(label, cls, onClick) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = cls; b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  // ---- buttons ----
  $('flip-btn').addEventListener('click', () => { flip(); $('know-btn').focus({ preventScroll: true }); });
  $('know-btn').addEventListener('click', () => { answer(true); $('flip-btn').focus({ preventScroll: true }); });
  $('miss-btn').addEventListener('click', () => { answer(false); $('flip-btn').focus({ preventScroll: true }); });
  $('undo-btn').addEventListener('click', undoLast);
  $('next-btn').addEventListener('click', () => go(1));
  $('shuffle-btn').addEventListener('click', shuffleRest);

  // ---- swipe / tap on the card ----
  // touch-action: pan-y lets long cards scroll vertically; a mostly-horizontal drag answers.
  let drag = null;
  cardDrag.addEventListener('pointerdown', e => {
    if (animating || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, moved: false, horizontal: null };
  });
  cardDrag.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) drag.moved = true;
    if (drag.horizontal === null && drag.moved) {
      drag.horizontal = Math.abs(dx) > Math.abs(dy);
      if (drag.horizontal) { try { cardDrag.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } cardDrag.style.transition = 'none'; }
    }
    if (!drag.horizontal) return;
    drag.dx = dx;
    cardDrag.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx / 20) + 'deg)';
    const ratio = clamp(dx / SWIPE_THRESHOLD, -1, 1);
    $('wash-yes').style.opacity = Math.max(0, ratio);
    $('wash-no').style.opacity = Math.max(0, -ratio);
  });
  function endDrag(e, cancelled) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    try { cardDrag.releasePointerCapture(drag.id); } catch (err) { /* ignore */ }
    const d = drag;
    drag = null;
    if (!cancelled && d.horizontal && Math.abs(d.dx) > SWIPE_THRESHOLD) { answer(d.dx > 0); return; }
    cardDrag.style.transition = 'transform .3s cubic-bezier(.2,.8,.2,1)';
    cardDrag.style.transform = '';
    $('wash-yes').style.opacity = 0;
    $('wash-no').style.opacity = 0;
    if (!cancelled && !d.moved) flip();
  }
  cardDrag.addEventListener('pointerup', e => endDrag(e, false));
  cardDrag.addEventListener('pointercancel', e => endDrag(e, true));

  // ---- keyboard ----
  document.addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]')) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (e.key === 'Escape') {
      if (currentScreen !== 'home') { e.preventDefault(); history.back(); }
      return;
    }
    if (currentScreen !== 'study' || !$('summary').hidden || e.altKey || e.ctrlKey || e.metaKey) return;

    const onOtherButton = tag === 'BUTTON' && e.target !== cardDrag;
    if ((e.key === ' ' || e.key === 'Enter') && !onOtherButton) { e.preventDefault(); flip(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); answer(true); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); answer(false); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); undoLast(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); go(1); return; }
  });
  document.addEventListener('keydown', e => {
    if ((e.key === 'z' || e.key === 'Z') && currentScreen === 'study' && !document.querySelector('dialog[open]') &&
        !(e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) { e.preventDefault(); undoLast(); }
  });

  /* =======================================================================
     SETTINGS sheet
     ======================================================================= */
  const dialog = $('settings');
  const resetBtn = $('reset-btn');
  let resetArmed = false, resetTimer = null;

  function disarmReset() {
    resetArmed = false;
    clearTimeout(resetTimer);
    resetBtn.textContent = 'ล้างความคืบหน้าที่บันทึกไว้';
    resetBtn.classList.remove('armed');
  }
  function openSettings() {
    dialog.querySelector('input[name="theme"][value="' + (settings.theme || 'system') + '"]').checked = true;
    dialog.querySelector('input[name="palette"][value="' + (settings.palette === 'classic' ? 'classic' : 'bauhaus') + '"]').checked = true;
    dialog.querySelector('input[name="newPerDay"][value="' + settings.newPerDay + '"]').checked = true;
    dialog.querySelector('input[name="celebrate"][value="' + settings.celebrate + '"]').checked = true;
    $('sound-on').checked = settings.sound;
    $('vibe-on').checked = settings.vibe;
    $('vibe-field').hidden = !Celebrate.canVibrate(); // iPhones and iPads can't vibrate from a website
    renderClassInfo();
    $('feedback-note').textContent = Celebrate.canVibrate() ? 'เล่นตอนจบรอบ ปิดไว้ก่อนเป็นค่าเริ่มต้น' : 'เล่นเสียงตอนจบรอบ ปิดไว้ก่อนเป็นค่าเริ่มต้น';
    $('install-field').hidden = PREVIEW || isStandalone() || !(deferredInstall || isIOS());
    const saved = Object.keys(srs.cards).length;
    $('progress-note').textContent = saved ? 'บันทึกไว้ ' + saved + ' ใบในเบราว์เซอร์นี้' : 'ยังไม่มีความคืบหน้าที่บันทึกไว้';
    resetBtn.hidden = !saved;
    disarmReset();
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
    tryCelebration(false);
  }
  // A small preview of the chosen celebration inside the settings sheet
  let tryPlay = null;
  function tryCelebration(animate) {
    if (tryPlay) tryPlay.skip();
    const pin = DECKS.find(d => isPinned(d.topic));
    tryPlay = Celebrate.play({
      art: $('cel-try-art'), style: settings.celebrate, full: true, done: 20, goal: 20,
      shape: levelCode(pin ? pin.level : 'jh'), layer: dialog,
      sound: animate && settings.sound, vibe: animate && settings.vibe, reduce: !animate || reduceMotion.matches,
    });
  }
  $('cel-try-btn').addEventListener('click', () => { Celebrate.unlock(settings.sound); tryCelebration(true); });
  dialog.addEventListener('close', () => { if (tryPlay) { tryPlay.skip(); tryPlay = null; } });
  document.querySelectorAll('.js-open-settings').forEach(b => b.addEventListener('click', openSettings));
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); }); // tap outside closes
  dialog.addEventListener('change', e => {
    if (e.target.name === 'theme') settings.theme = e.target.value === 'system' ? null : e.target.value;
    if (e.target.name === 'palette') { settings.palette = e.target.value; settings.noticeDone = true; renderNotice(); }
    if (e.target.name === 'newPerDay') { settings.newPerDay = Number(e.target.value); settings.newPerDayChosen = true; renderHome(); }
    if (e.target.name === 'celebrate') { settings.celebrate = e.target.value; Celebrate.unlock(settings.sound); saveSettings(); tryCelebration(true); }
    if (e.target.id === 'sound-on') { settings.sound = e.target.checked; if (settings.sound) { Celebrate.unlock(true); Celebrate.tone(true, 'C6'); } }
    if (e.target.id === 'vibe-on') { settings.vibe = e.target.checked; Celebrate.buzz(settings.vibe, 20); }
    saveSettings(); applyTheme();
  });
  resetBtn.addEventListener('click', () => {
    if (!resetArmed) {
      resetArmed = true;
      resetBtn.textContent = 'แตะอีกครั้งเพื่อยืนยัน';
      resetBtn.classList.add('armed');
      resetTimer = setTimeout(disarmReset, 4000);
      return;
    }
    disarmReset();
    SRS.clearAll(storage);
    srs = SRS.emptyState();
    stats = SRS.loadStats(storage, today());
    dialog.close();
    renderHome();
    toast('ล้างความคืบหน้าแล้ว');
  });

  /* =======================================================================
     WELCOME — "เรียนบทไหนอยู่?" → pins (first visit, or from settings)
     ======================================================================= */
  const welcome = $('welcome');
  function openWelcome() {
    const list = $('welcome-list');
    list.innerHTML = '';
    const studied = new Set(DECKS.filter(d => d.cards.some(c => srs.cards[idOf(c)])).map(d => d.topic));
    LEVELS.forEach(l => {
      const decks = DECKS.filter(d => d.level === l.code);
      if (!decks.length) return;
      const group = document.createElement('fieldset');
      group.className = 'welcome-group';
      group.innerHTML = '<legend><span class="shape ' + l.code + '" aria-hidden="true"></span>' + escapeHtml(l.label) + '</legend>' +
        '<button class="text-btn" type="button">เลือกทั้งหมด</button>';
      decks.forEach(d => {
        const row = document.createElement('label');
        row.className = 'topic-row';
        row.innerHTML = '<input type="checkbox"><span class="topic-check" aria-hidden="true"></span><span class="topic-name"></span><span class="topic-meta"></span>';
        const input = row.querySelector('input');
        input.value = d.topic;
        input.checked = settings.pins.length ? isPinned(d.topic) : studied.has(d.topic);
        row.querySelector('.topic-name').textContent = d.topic;
        row.querySelector('.topic-meta').textContent = d.cards.length + ' ใบ';
        group.appendChild(row);
      });
      group.querySelector('.text-btn').addEventListener('click', () => {
        const boxes = [...group.querySelectorAll('input')];
        const all = boxes.every(b => b.checked);
        boxes.forEach(b => { b.checked = !all; });
        updateWelcome();
      });
      list.appendChild(group);
    });
    list.onchange = updateWelcome;
    updateWelcome();
    if (welcome.showModal) welcome.showModal(); else welcome.setAttribute('open', '');
  }
  function updateWelcome() {
    const n = welcome.querySelectorAll('#welcome-list input:checked').length;
    $('welcome-done').textContent = n ? 'เริ่มเลย (' + n + ' บท)' : 'เลือกอย่างน้อย 1 บท';
    $('welcome-done').disabled = !n;
    welcome.querySelectorAll('.welcome-group').forEach(g => {
      const boxes = [...g.querySelectorAll('input')];
      g.querySelector('.text-btn').textContent = boxes.every(b => b.checked) ? 'ไม่เลือกทั้งหมด' : 'เลือกทั้งหมด';
    });
  }
  $('welcome-done').addEventListener('click', () => {
    settings.pins = [...welcome.querySelectorAll('#welcome-list input:checked')].map(i => i.value);
    settings.welcomeDone = true;
    if (settings.pins.length) settings.filter = 'pinned';
    saveSettings(); welcome.close(); renderHome();
    toast('ปักหมุด ' + settings.pins.length + ' บทแล้ว');
  });
  $('welcome-skip').addEventListener('click', () => { settings.welcomeDone = true; saveSettings(); welcome.close(); });
  welcome.addEventListener('cancel', () => { settings.welcomeDone = true; saveSettings(); });
  $('open-welcome').addEventListener('click', () => { dialog.close(); openWelcome(); });

  /* =======================================================================
     MOVE / BACK UP PROGRESS — QR code or text code, merged by latest answer
     ======================================================================= */
  const QR_MAX_URL = 1400;   // longer links make QR codes too dense to scan from a phone screen
  let qrLoading = null;
  function loadQr() {
    if (window.qrcode) return Promise.resolve();
    if (!qrLoading) qrLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'flashcards/vendor/qrcode.js'; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
    return qrLoading;
  }
  function restoreUrl(code) { return location.origin + location.pathname + '#restore=' + code; }
  async function openBackup() {
    const body = $('backup-body');
    body.innerHTML = '<p class="field-note">กำลังสร้างรหัส…</p>';
    const bd = $('backup-dialog');
    if (bd.showModal) bd.showModal(); else bd.setAttribute('open', '');
    const count = Object.keys(srs.cards).length;
    const code = await SRS.encodeBackup(SRS.makeBackup(srs, stats, settings, today()));
    const url = restoreUrl(code);
    body.innerHTML = '';
    const note = document.createElement('p'); note.className = 'field-note';
    note.textContent = 'ความคืบหน้า ' + count + ' ใบ และบทที่ปักหมุด (ไม่มีข้อมูลส่วนตัว) เครื่องใหม่จะรวมกับของเดิม ไม่ลบอะไร';
    body.appendChild(note);
    if (url.length <= QR_MAX_URL) {
      try {
        await loadQr();
        const qr = window.qrcode(0, 'L'); qr.addData(url); qr.make();
        const holder = document.createElement('div'); holder.className = 'qr';
        holder.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 3, scalable: true });
        const svg = holder.querySelector('svg'); if (svg) svg.setAttribute('aria-label', 'QR code สำหรับย้ายความคืบหน้า');
        body.appendChild(holder);
        const how = document.createElement('p'); how.className = 'field-note';
        how.textContent = 'ใช้กล้องของเครื่องใหม่สแกน QR นี้ แล้วกด “รวมเข้ากับเครื่องนี้”';
        body.appendChild(how);
      } catch (e) { /* no QR: the code below still works */ }
    } else {
      const big = document.createElement('p'); big.className = 'field-note';
      big.textContent = 'ความคืบหน้าเยอะเกินกว่าจะใส่ใน QR ได้ ใช้รหัสด้านล่างแทน (เช่น ส่งให้ตัวเองทาง LINE)';
      body.appendChild(big);
    }
    const box = document.createElement('textarea');
    box.className = 'code-box'; box.readOnly = true; box.rows = 3; box.value = code; box.setAttribute('aria-label', 'รหัสความคืบหน้า');
    const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'act-btn primary'; copy.textContent = 'คัดลอกรหัส';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(code); } catch (e) { box.focus(); box.select(); document.execCommand('copy'); }
      copy.textContent = 'คัดลอกแล้ว ✓';
    });
    const row = document.createElement('div'); row.className = 'btn-row'; row.appendChild(copy);
    body.append(box, row);
  }
  let pendingBackup = null;
  async function checkRestoreCode() {
    const code = $('restore-code').value.trim();
    pendingBackup = null;
    $('restore-apply').disabled = true;
    if (!code) { $('restore-result').textContent = ''; return; }
    try {
      const b = await SRS.decodeBackup(code);
      // dry run on copies to show what would change
      const res = SRS.mergeBackup(JSON.parse(JSON.stringify(srs)), SRS.emptyStats(), { pins: settings.pins.slice(), off: {} }, b);
      $('restore-result').textContent = 'พบความคืบหน้า ' + b.c.length + ' ใบ: เพิ่มใหม่ ' + res.added + ' ใบ อัปเดต ' + res.updated + ' ใบ คงของเครื่องนี้ ' + res.kept + ' ใบ';
      pendingBackup = b;
      $('restore-apply').disabled = false;
    } catch (e) {
      $('restore-result').textContent = e.message || 'รหัสไม่ถูกต้อง';
    }
  }
  function openRestore(code) {
    $('restore-code').value = code || '';
    $('restore-result').textContent = '';
    const rd = $('restore-dialog');
    if (rd.showModal) rd.showModal(); else rd.setAttribute('open', '');
    checkRestoreCode();
  }
  $('restore-code').addEventListener('input', checkRestoreCode);
  $('restore-apply').addEventListener('click', () => {
    if (!pendingBackup) return;
    const res = SRS.mergeBackup(srs, stats, settings, pendingBackup);
    saveProgress(); saveStats();
    settings.welcomeDone = true;
    if (settings.pins.length) settings.filter = 'pinned';
    saveSettings();
    $('restore-dialog').close(); renderHome();
    toast('รวมความคืบหน้าแล้ว (' + (res.added + res.updated) + ' ใบ)');
  });
  $('backup-btn').addEventListener('click', () => { dialog.close(); openBackup(); });
  $('restore-btn').addEventListener('click', () => { dialog.close(); openRestore(''); });

  /* =======================================================================
     MY POSTER: the month as a picture + streak cards (poster.js draws them)
     ======================================================================= */
  const posterDialog = $('poster-dialog');
  const posterCanvas = document.createElement('canvas');
  let posterView = { month: '', card: 0 }, posterUrl = null;
  const ymOf = day => day.slice(0, 7);
  function shiftMonth(ym, n) { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function firstMonth() { const days = Object.keys(stats.days || {}).filter(d => stats.days[d] > 0).sort(); return days.length ? ymOf(days[0]) : ymOf(today()); }
  // Everything poster.js needs for one month
  function monthData(ym) {
    const [y, m] = ym.split('-').map(Number), len = new Date(y, m, 0).getDate(), t = today();
    const from = ym + '-01', to = [ym + '-' + String(len).padStart(2, '0'), t].sort()[0];
    const hist = from <= t ? SRS.streakHistory(stats, from, to) : {};
    const days = [];
    for (let d = 1; d <= len; d++) {
      const k = ym + '-' + String(d).padStart(2, '0'), h = hist[k];
      const kind = h ? SRS.dayKind(stats, hist, k) : null;
      days.push({ d, kind, n: h ? h.n : 0, rest: !!(h && h.rest), on: !!(h && (h.run || h.rest)), future: k > t, today: k === t });
    }
    return { y, m, days, studied: days.filter(x => x.n).length, cards: days.reduce((a, x) => a + x.n, 0), best: Math.max(0, ...Object.values(hist).map(h => h.run)) };
  }
  // The days leading up to a milestone, for the strip on its card
  function streakCardData(count) {
    const date = stats.reached[count];
    const n = Math.min(count, 14), from = SRS.addDays(date, -(n - 1)), hist = SRS.streakHistory(stats, from, date), strip = [];
    for (let i = 0; i < n; i++) { const k = SRS.addDays(from, i); strip.push(hist[k] && hist[k].n ? SRS.dayKind(stats, hist, k) : hist[k] && hist[k].rest ? 'rest' : null); }
    return { count, date, strip };
  }
  async function renderPoster() {
    await Poster.fontsReady();
    const card = posterView.card;
    if (card) Poster.drawStreak(posterCanvas, streakCardData(card));
    else Poster.drawMonth(posterCanvas, monthData(posterView.month));
    const [y, m] = posterView.month.split('-').map(Number);
    $('poster-nav').hidden = !!card;
    $('poster-back').hidden = !card;
    $('poster-label').textContent = Poster.MONTHS[m - 1] + ' ' + (y + 543);
    $('poster-prev').disabled = posterView.month <= firstMonth();
    $('poster-next').disabled = posterView.month >= ymOf(today());
    $('poster-img').alt = card ? 'การ์ดทวนต่อเนื่อง ' + card + ' วัน' : 'โปสเตอร์เดือน' + Poster.MONTHS[m - 1];
    const blob = await new Promise(r => posterCanvas.toBlob(r, 'image/png'));
    if (posterUrl) URL.revokeObjectURL(posterUrl);
    posterUrl = blob ? URL.createObjectURL(blob) : posterCanvas.toDataURL('image/png');
    $('poster-img').src = posterUrl;
    renderBadges();
  }
  function renderBadges() {
    const best = SRS.streak(stats, today());
    $('poster-badges').innerHTML = SRS.STREAK_MILESTONES.map(n => {
      const date = stats.reached[n];
      if (!date) return '<div class="badge locked" aria-label="' + n + ' วัน ยังไม่ปลดล็อก"><span class="disc">' + n + '</span><b>' + n + ' วัน</b><small>อีก ' + (n - Math.min(best, n)) + ' วัน</small></div>';
      const [, mo, d] = date.split('-').map(Number);
      return '<button class="badge" type="button" data-card="' + n + '"' + (posterView.card === n ? ' aria-pressed="true"' : '') + '><span class="disc">' + n + '</span><b>' + n + ' วัน</b><small>' + d + ' ' + Poster.MONTHS[mo - 1].slice(0, 3) + '.</small></button>';
    }).join('');
  }
  function openPoster(opts) {
    stats = SRS.unlockMilestones(stats, today()); saveStats();
    posterView = { month: ymOf(today()), card: (opts && opts.card) || 0 };
    if (posterView.card && !stats.reached[posterView.card]) posterView.card = 0;
    renderPoster();
    if (!posterDialog.open) { if (posterDialog.showModal) posterDialog.showModal(); else posterDialog.setAttribute('open', ''); }
  }
  async function sharePoster() {
    const blob = await new Promise(r => posterCanvas.toBlob(r, 'image/png'));
    if (!blob) return;
    const name = posterView.card ? 'streak-' + posterView.card + '.png' : 'poster-' + posterView.month + '.png';
    const file = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); } catch (e) { /* closed the share sheet */ }
      return;
    }
    // no share sheet (most computers): save the picture instead
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('บันทึกรูปแล้ว');
  }
  $('poster-prev').addEventListener('click', () => { posterView.month = shiftMonth(posterView.month, -1); renderPoster(); });
  $('poster-next').addEventListener('click', () => { posterView.month = shiftMonth(posterView.month, 1); renderPoster(); });
  $('poster-back').addEventListener('click', () => { posterView.card = 0; renderPoster(); });
  $('poster-share').addEventListener('click', sharePoster);
  $('poster-badges').addEventListener('click', e => { const b = e.target.closest('[data-card]'); if (b) { posterView.card = Number(b.dataset.card); renderPoster(); } });
  posterDialog.addEventListener('click', e => { if (e.target === posterDialog) posterDialog.close(); });
  $('hero-meta').addEventListener('click', e => { if (e.target.closest('[data-open-poster]')) openPoster(); });

  /* =======================================================================
     INSTALL AS APP + offline helper + LINE in-app browser
     ======================================================================= */
  let deferredInstall = null;
  const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const inLine = () => /\bLine\//i.test(navigator.userAgent);
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; renderInstallCard(); });
  window.addEventListener('appinstalled', () => { deferredInstall = null; settings.installDismissed = true; saveSettings(); renderInstallCard(); toast('ติดตั้งแล้ว เปิดได้จากหน้าจอโฮม'); });
  async function install() {
    if (deferredInstall) {
      deferredInstall.prompt();
      try { await deferredInstall.userChoice; } catch (e) { /* ignore */ }
      deferredInstall = null; renderInstallCard();
      return;
    }
    // iPhone / iPad: Safari has no install button for websites, so explain the two taps
    const body = $('install-help-body');
    body.innerHTML = inLine()
      ? '<p class="field-note">เปิดหน้านี้ใน Safari ก่อน (แตะ ⋯ แล้วเลือก “เปิดในเบราว์เซอร์”) จากนั้นติดตั้งตามขั้นตอนนี้</p>' : '';
    body.innerHTML += '<ol class="steps-list"><li>แตะปุ่ม <b>แชร์</b> (สี่เหลี่ยมมีลูกศรชี้ขึ้น) ด้านล่างหรือด้านบนของ Safari</li>' +
      '<li>เลื่อนลงแล้วแตะ <b>เพิ่มไปยังหน้าจอโฮม</b></li><li>แตะ <b>เพิ่ม</b> แล้วเปิดแอป “บัตรคำ” จากหน้าจอโฮม</li></ol>' +
      '<p class="field-note">เมื่อติดตั้งแล้ว iPhone จะไม่ลบความคืบหน้าแม้ไม่ได้เปิดหลายวัน</p>';
    const d = $('install-help');
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  document.querySelectorAll('.js-install').forEach(b => b.addEventListener('click', () => { if (dialog.open) dialog.close(); install(); }));
  // Suggest installing once the student has really started (≥ 10 answers), never in the installed app
  function renderInstallCard() {
    const answered = Object.values(stats.days || {}).reduce((a, b) => a + b, 0);
    const show = !PREVIEW && !isStandalone() && !inLine() && !settings.installDismissed && answered >= 10 && !!(deferredInstall || isIOS());
    $('install-card').hidden = !show;
    if (show && isIOS()) $('install-card-text').textContent = 'เปิดได้ในแตะเดียว ใช้ได้แม้ไม่มีอินเทอร์เน็ต และ iPhone จะไม่ลบความคืบหน้าของคุณ';
  }
  $('install-later').addEventListener('click', () => { settings.installDismissed = true; saveSettings(); renderInstallCard(); });
  function renderLineBanner() {
    $('line-banner').hidden = !(inLine() && !sessionStorageGet('lineDismissed'));
  }
  function sessionStorageGet(k) { try { return sessionStorage.getItem('mathFlashcards.' + k); } catch (e) { return null; } }
  $('line-dismiss').addEventListener('click', () => { try { sessionStorage.setItem('mathFlashcards.lineDismissed', '1'); } catch (e) { /* ignore */ } renderLineBanner(); });

  // Offline helper (service worker): only on the real site / local test server, never in a preview
  if (!PREVIEW && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('flashcards-sw.js', { scope: './flashcards' }).catch(() => { /* offline mode is optional */ });
    });
  }

  /* =======================================================================
     CLASS LINKS: flashcards.html?class=<code> (classes are written in cards.js)
     Joining pins the class's units and ticks only its หัวข้อ. On every later visit the app
     follows the teacher's changes (a topic added or removed, a unit added or dropped)
     without undoing what the student changed themselves: only differences between the
     class as last seen (settings.classSnap) and the class now are applied.
     ======================================================================= */
  const CLASS_LIST = (typeof CLASSES !== 'undefined' && Array.isArray(CLASSES)) ? CLASSES : [];
  const classByCode = code => CLASS_LIST.find(k => k.code === code);
  const topicKey = name => (name === 'ทั่วไป' ? NO_SECTION : name);
  // unit → set of หัวข้อ keys the class wants (only units and topics that exist)
  function classTarget(k) {
    const m = new Map();
    k.picks.forEach(p => {
      const deck = deckByTopic(p.unit);
      if (!deck) return;
      const all = deck.sections.map(s => s.key);
      m.set(p.unit, new Set(p.topics ? p.topics.map(topicKey).filter(x => all.includes(x)) : all));
    });
    return m;
  }
  function syncClass(k, joining) {
    const target = classTarget(k);
    const prev = (!joining && settings.classSnap) || {};
    const snap = {};
    let pinned = 0;
    if (joining) settings.classPinned = [];
    target.forEach((want, unit) => {
      const deck = deckByTopic(unit), all = deck.sections.map(s => s.key), p = prev[unit];
      if (!p) {
        if (!isPinned(unit)) { settings.pins.push(unit); settings.classPinned.push(unit); pinned++; }
        all.forEach(key => setSectionOn(deck, key, want.has(key)));
      } else {
        const wasOn = new Set(p.on), known = new Set(p.known);
        // a topic that is new (to this phone) follows the class; otherwise only what the class changed
        all.forEach(key => { if (!known.has(key) || want.has(key) !== wasOn.has(key)) setSectionOn(deck, key, want.has(key)); });
      }
      snap[unit] = { on: [...want], known: all };
    });
    // units the class no longer has: unpin the ones the class pinned
    Object.keys(prev).forEach(unit => {
      if (!target.has(unit) && settings.classPinned.includes(unit)) {
        settings.pins = settings.pins.filter(x => x !== unit);
        settings.classPinned = settings.classPinned.filter(x => x !== unit);
      }
    });
    settings.classSnap = snap;
    settings.className = k.name;
    saveSettings();
    return { units: target.size, pinned };
  }
  function joinClassFromLink() {
    const params = new URLSearchParams(location.search);
    const code = params.get('class');
    if (!code) return false;
    params.delete('class'); params.delete('openExternalBrowser');
    history.replaceState({ screen: 'home' }, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash);
    const k = classByCode(code);
    if (!k) { toast('ไม่พบห้องเรียนนี้ ลิงก์อาจเก่าแล้ว ลองขอลิงก์ใหม่จากครู'); return false; }
    const again = settings.classCode === code;
    settings.classCode = code;
    if (!Array.isArray(settings.classPinned)) settings.classPinned = [];
    const r = syncClass(k, !again);
    settings.welcomeDone = true;
    settings.filter = 'pinned';
    saveSettings();
    renderHome();
    toast(again ? 'อัปเดตห้อง ' + k.name + ' แล้ว' : 'เข้าห้อง ' + k.name + ' แล้ว · ปักหมุด ' + r.units + ' บท');
    return true;
  }
  function followClass() {
    if (!settings.classCode) return;
    const k = classByCode(settings.classCode);
    if (!k) return;                    // the class is gone from cards.js: keep everything as it is
    if (!Array.isArray(settings.classPinned)) settings.classPinned = [];
    syncClass(k, false);
  }
  function renderClassInfo() {
    const on = !!settings.classCode;
    $('class-info').hidden = !on;
    if (!on) return;
    const k = classByCode(settings.classCode);
    $('class-note').textContent = k
      ? k.name + ' · ' + classTarget(k).size + ' บท (ครูเพิ่มหัวข้อใหม่ได้ แอปจะอัปเดตเอง)'
      : (settings.className || settings.classCode) + ' (ครูปิดห้องนี้แล้ว)';
  }
  $('leave-class').addEventListener('click', () => {
    const name = settings.className || '';
    settings.classCode = null; settings.classSnap = null; settings.classPinned = []; settings.className = null;
    saveSettings(); renderClassInfo();
    toast('ออกจากห้อง ' + name + ' แล้ว บทที่ปักหมุดไว้ยังอยู่');
  });

  /* =======================================================================
     Go
     ======================================================================= */
  applyTheme();
  history.replaceState({ screen: 'home' }, '');
  followClass();                       // before the first render: today's units and topics
  renderHome();
  renderLineBanner();
  renderInstallCard();
  show('home');
  // Opened from a QR code: "#restore=FC1…"
  const restoreMatch = location.hash.match(/^#restore=(FC1[zj]\.[A-Za-z0-9_-]+)/);
  if (restoreMatch) {
    history.replaceState({ screen: 'home' }, '', location.pathname + location.search);
    openRestore(restoreMatch[1]);
  } else if (joinClassFromLink()) {
    /* joined (or updated) a class from its link: no welcome screen */
  } else if (!settings.welcomeDone && !settings.pins.length && DECKS.length) {
    openWelcome();
  }
})();
