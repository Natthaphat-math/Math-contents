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
     Data: cards → decks (one deck per topic, in order of first appearance)
     ======================================================================= */
  const CARD_LIST = (typeof CARDS !== 'undefined' && Array.isArray(CARDS)) ? CARDS : [];
  const GLYPHS = (typeof TOPIC_GLYPH !== 'undefined' && TOPIC_GLYPH) ? TOPIC_GLYPH : {};
  const IDS = SRS.assignIds(CARD_LIST);
  const idOf = card => IDS.get(card);

  const DECKS = (function buildDecks() {
    const map = new Map();
    CARD_LIST.forEach(c => {
      if (!map.has(c.topic)) map.set(c.topic, { topic: c.topic, level: c.level, cards: [], text: normalize(c.topic) });
      const deck = map.get(c.topic);
      deck.cards.push(c);
      deck.text += ' ' + searchableText(c.front) + ' ' + searchableText(c.back);
    });
    return [...map.values()];
  })();
  const deckByTopic = topic => DECKS.find(d => d.topic === topic);
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

  const settings = Object.assign({ theme: null, palette: 'bauhaus', filter: 'all', noticeDone: false },
    (function () { try { return JSON.parse(storage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (e) { return {}; } })());
  function saveSettings() { try { storage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ } }

  // Per-deck numbers used across screens
  function deckStats(cards) {
    const t = today();
    let due = 0, mastered = 0, nextDue = null;
    const boxes = [0, 0, 0, 0, 0, 0]; // index 0 = new
    cards.forEach(c => {
      const id = idOf(c);
      const box = SRS.boxOf(srs, id);
      boxes[box]++;
      if (SRS.isDue(srs, id, t)) due++;
      else { const d = srs.cards[id].due; if (!nextDue || d < nextDue) nextDue = d; }
      if (SRS.isMastered(srs, id)) mastered++;
    });
    return { total: cards.length, due, mastered, boxes, nextDue };
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
    metaTheme.setAttribute('content', color.trim() || '#2338E0');
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
  function renderFace(el, text, tikz) {
    el.innerHTML = formatFace(text);
    if (tikz) {
      ensureTikzJax();
      const holder = document.createElement('div');
      holder.className = 'tikz-holder';
      const scriptEl = document.createElement('script');
      scriptEl.type = 'text/tikz';
      scriptEl.textContent = tikz;
      holder.appendChild(scriptEl);
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
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }
  function announce(msg) { $('live').textContent = msg; }

  /* =======================================================================
     HOME — level filter, search, deck tiles
     ======================================================================= */
  let query = '';
  const searchEl = $('search');

  function decksInFilter() {
    return DECKS.filter(d => settings.filter === 'all' || d.level === settings.filter);
  }
  function visibleDecks() {
    const q = normalize(query.trim());
    return decksInFilter().filter(d => !q || d.text.includes(q));
  }

  function renderFilters() {
    const el = $('filters');
    el.innerHTML = '';
    [{ code: 'all', label: 'ทั้งหมด' }, ...LEVELS].forEach(chip => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      const count = chip.code === 'all' ? DECKS.length : DECKS.filter(d => d.level === chip.code).length;
      if (!count) btn.classList.add('empty');
      btn.setAttribute('aria-pressed', settings.filter === chip.code ? 'true' : 'false');
      btn.innerHTML = (chip.code === 'all' ? '' : '<span class="shape ' + chip.code + '" aria-hidden="true"></span>') + escapeHtml(chip.label);
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
      grid.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-art" aria-hidden="true"><span class="shape ps"></span><span class="shape jh"></span><span class="shape sh"></span><span class="shape uni"></span></div>' +
          '<h3>' + (searching ? 'ไม่พบหัวข้อ “' + escapeHtml(query.trim()) + '”' : 'ยังไม่มีชุดการ์ดในระดับนี้') + '</h3>' +
          '<p>' + (searching ? 'ลองค้นด้วยคำอื่น หรือดูทุกระดับชั้น' : 'เลือกระดับชั้นอื่นเพื่อดูชุดการ์ด') + '</p>' +
          '<button class="pill-btn" type="button" id="empty-reset">' + (searching ? 'ล้างการค้นหา' : 'ดูทุกระดับชั้น') + '</button>' +
        '</div>';
      $('empty-reset').addEventListener('click', () => {
        query = ''; searchEl.value = '';
        settings.filter = 'all'; saveSettings();
        renderHome(); searchEl.focus();
      });
      return;
    }

    decks.forEach((deck, i) => {
      const st = deckStats(deck.cards);
      const code = levelCode(deck.level);
      const mastery = pct(st.mastered, st.total);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'deck lv-' + code;
      btn.style.animationDelay = Math.min(i * 40, 400) + 'ms';
      btn.innerHTML =
        '<span class="big-shape ' + code + '" aria-hidden="true"><span class="glyph">' + escapeHtml(glyphFor(deck.topic)) + '</span></span>' +
        '<span class="level-tag">' + levelTagHtml(deck.level) + '</span>' +
        '<span class="deck-title">' + escapeHtml(deck.topic) + '</span>' +
        '<span class="deck-count">' + st.total + ' ใบ</span>' +
        (st.due ? '<span class="due-badge">' + st.due + ' ใบรอทวน</span>' : '') +
        '<span class="deck-foot"><span class="deck-bar"><span style="width:' + mastery + '%"></span></span>' +
          '<span class="deck-pct">จำได้ ' + mastery + '%</span></span>';
      btn.addEventListener('click', () => navigate('hub', { topic: deck.topic }));
      grid.appendChild(btn);
    });
  }

  function renderDueLine() {
    const cards = decksInFilter().flatMap(d => d.cards);
    const st = deckStats(cards);
    const line = $('due-line');
    const cta = $('study-due-all');
    if (st.due) {
      line.innerHTML = 'ได้เวลาทวนแล้ว <b>' + st.due + '</b> ใบ';
      $('study-due-all-label').textContent = 'เริ่มทวน ' + st.due + ' ใบ';
      cta.disabled = false;
    } else if (cards.length) {
      line.textContent = 'วันนี้ทวนครบแล้ว กลับมาอีกที' + comeBackWhen(st.nextDue);
      $('study-due-all-label').textContent = 'วันนี้ทวนครบแล้ว';
      cta.disabled = true;
    } else {
      line.textContent = 'ยังไม่มีการ์ดในระดับนี้';
      $('study-due-all-label').textContent = 'เริ่มทวน';
      cta.disabled = true;
    }
  }

  function renderNotice() {
    $('notice').hidden = !(srs.migratedFromV1 && !settings.noticeDone);
  }

  function renderHome() {
    renderFilters();
    renderDueLine();
    renderDecks();
    renderNotice();
  }

  searchEl.addEventListener('input', () => { query = searchEl.value; renderDecks(); });
  $('study-due-all').addEventListener('click', () => {
    const t = today();
    const due = decksInFilter().flatMap(d => d.cards).filter(c => SRS.isDue(srs, idOf(c), t));
    if (due.length) startSession(due, { title: 'การ์ดที่รอทวน', mixed: true, ordered: true });
  });
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
    const t = today();

    $('hub-card').className = 'hub-card lv-' + code;
    $('hub-shape').className = 'big-shape ' + code;
    $('hub-glyph').textContent = glyphFor(deck.topic);
    $('hub-level').innerHTML = levelTagHtml(deck.level);
    $('hub-topic').textContent = deck.topic;
    $('hub-sub').textContent = 'การ์ด ' + st.total + ' ใบ จำได้แล้ว ' + st.mastered + ' ใบ (' + pct(st.mastered, st.total) + '%)';

    // Box distribution
    const maxCount = Math.max(1, ...st.boxes);
    $('hub-boxes').innerHTML = st.boxes.map((n, box) =>
      '<div class="box-cell"><div class="stack"><span style="height:' + Math.round((n / maxCount) * 100) + '%"></span></div>' +
      '<b>' + n + '</b><small>' + (box ? 'กล่อง ' + box : 'ใหม่') + '</small></div>').join('');

    // Modes
    const dueCards = deck.cards.filter(c => SRS.isDue(srs, idOf(c), t));
    const notYet = deck.cards.filter(c => SRS.lastAnswer(srs, idOf(c)) !== 'remembered');
    const list = $('mode-list');
    list.innerHTML = '';
    list.appendChild(modeButton({
      primary: true, icon: String(dueCards.length),
      title: 'ทวนใบที่รออยู่',
      sub: dueCards.length ? dueCards.length + ' ใบ ใบที่ยังจำไม่ได้จะมาก่อน' : 'ไม่มีใบรอทวนวันนี้ กลับมาอีกที' + comeBackWhen(st.nextDue),
      disabled: !dueCards.length,
      onClick: () => startSession(dueCards, { title: deck.topic, ordered: true }),
    }));
    list.appendChild(modeButton({
      icon: '∀', title: 'ทบทวนทั้งหมด', sub: deck.cards.length + ' ใบ สุ่มลำดับ',
      onClick: () => startSession(deck.cards, { title: deck.topic }),
    }));
    list.appendChild(modeButton({
      icon: '↺', title: 'ทบทวนใบที่ยังจำไม่ได้',
      sub: notYet.length ? notYet.length + ' ใบ' : 'จำได้ครบทุกใบแล้ว',
      disabled: !notYet.length,
      onClick: () => startSession(notYet, { title: deck.topic }),
    }));
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

  /* =======================================================================
     GRID — all card fronts at a glance (no flip, no swipe)
     ======================================================================= */
  function renderGrid() {
    const deck = deckByTopic(currentTopic);
    $('grid-topic').textContent = deck.topic;
    $('grid-sub').textContent = levelLabel(deck.level) + ' ' + deck.cards.length + ' ใบ';
    const wrap = $('grid-wrap');
    wrap.innerHTML = '';
    deck.cards.forEach((card, i) => {
      const tile = document.createElement('div');
      tile.className = 'grid-card';
      tile.style.animationDelay = Math.min(i * 25, 400) + 'ms';
      tile.innerHTML = '<span class="grid-index">' + (i + 1) + '</span>' + boxDots(SRS.boxOf(srs, idOf(card))) + '<span class="grid-content"></span>';
      // Diagrams are skipped here to keep the overview light (same as before).
      renderFace(tile.querySelector('.grid-content'), card.front, null);
      wrap.appendChild(tile);
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
    };
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
    $('front-topic').textContent = session.mixed ? card.topic : '';
    renderFace($('front-content'), card.front, card.frontTikz);
    renderFace($('back-content'), card.back, card.backTikz);
    // Very short fronts (a single symbol like ℤ) get a bigger type size.
    $('front-content').classList.toggle('short', !card.frontTikz && String(card.front).replace(/\s+/g, '').length <= 24);
    $('front-content').parentElement.scrollTop = 0;
    $('back-content').parentElement.scrollTop = 0;

    updateFaceState();
    renderProgress();
    $('prev-btn').disabled = session.index === 0;
    announce('การ์ดที่ ' + (session.index + 1) + ' จาก ' + session.cards.length);
    updateThemeColor();

    void cardDrag.offsetWidth; // apply the reset before re-enabling transitions
    cardDrag.style.transition = '';
  }

  function updateFaceState() {
    cardFlip.classList.toggle('flipped', revealed);
    $('face-front').setAttribute('aria-hidden', revealed ? 'true' : 'false');
    $('face-back').setAttribute('aria-hidden', revealed ? 'false' : 'true');
    cardDrag.setAttribute('aria-label', revealed ? 'ด้านคำตอบ แตะเพื่อพลิกกลับ' : 'ด้านคำถาม แตะเพื่อดูคำตอบ');
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
    const card = currentCard();
    const id = idOf(card);

    // Undo this round's earlier answer for the same card before applying the new one
    if (!session.before.has(id)) session.before.set(id, srs.cards[id] ? Object.assign({}, srs.cards[id]) : null);
    else {
      const prev = session.before.get(id);
      if (prev) srs.cards[id] = Object.assign({}, prev); else delete srs.cards[id];
    }
    SRS.answer(srs, id, knew, today());
    saveProgress();
    session.answers.set(id, knew);

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

    $('summary-title').textContent = n === yes ? 'จบชุดนี้แล้ว!' : 'จบรอบนี้แล้ว!';
    $('summary-praise').hidden = !(n > 0 && yes === n);
    $('summary-stats').innerHTML =
      '<div class="stat yes"><b>' + yes + '</b><span>จำได้</span></div>' +
      '<div class="stat no"><b>' + no + '</b><span>ยังจำไม่ได้</span></div>' +
      (skipped ? '<div class="stat"><b>' + skipped + '</b><span>ข้าม</span></div>' : '');

    // When do these cards come back?
    const t = today();
    const future = session.pool.map(c => srs.cards[idOf(c)]).filter(r => r && r.due > t).map(r => r.due).sort();
    if (future.length) {
      const first = future[0];
      const count = future.filter(d => d === first).length;
      const days = SRS.daysBetween(t, first);
      $('summary-next').textContent = (days <= 1 ? 'พรุ่งนี้มีอีก ' : 'อีก ' + days + ' วันจะมีอีก ') + count + ' ใบรอทวน การ์ดที่จำได้จะกลับมาช้าลงเรื่อย ๆ';
    } else {
      $('summary-next').textContent = '';
    }

    const actions = $('summary-actions');
    actions.innerHTML = '';
    if (retry.length) {
      const label = skipped && no ? 'ทบทวนใบที่ยังจำไม่ได้และที่ข้าม' : skipped ? 'ทบทวนใบที่ข้าม' : 'ทบทวนใบที่ยังจำไม่ได้';
      actions.appendChild(actionBtn(label + ' (' + retry.length + ')', 'answer-btn btn-know',
        () => startSession(retry, { title: session.title, mixed: session.mixed })));
    }
    actions.appendChild(actionBtn('สุ่มใหม่ทั้งชุด', 'answer-btn ' + (retry.length ? 'ghost-btn' : 'btn-know'),
      () => startSession(session.pool, { title: session.title, mixed: session.mixed })));
    actions.appendChild(actionBtn('กลับ', 'answer-btn ghost-btn', () => history.back()));

    announce('จบรอบนี้ จำได้ ' + yes + ' จาก ' + n + ' ใบ');
    $('summary-title').focus({ preventScroll: true });
  }
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
  $('prev-btn').addEventListener('click', () => go(-1));
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
    if ($('settings').open) return;
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
    if (e.key === 'ArrowUp') { e.preventDefault(); go(-1); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); go(1); return; }
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
    const saved = Object.keys(srs.cards).length;
    $('progress-note').textContent = saved ? 'บันทึกไว้ ' + saved + ' ใบในเบราว์เซอร์นี้' : 'ยังไม่มีความคืบหน้าที่บันทึกไว้';
    resetBtn.hidden = !saved;
    disarmReset();
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
  }
  document.querySelectorAll('.js-open-settings').forEach(b => b.addEventListener('click', openSettings));
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); }); // tap outside closes
  dialog.addEventListener('change', e => {
    if (e.target.name === 'theme') settings.theme = e.target.value === 'system' ? null : e.target.value;
    if (e.target.name === 'palette') { settings.palette = e.target.value; settings.noticeDone = true; renderNotice(); }
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
    dialog.close();
    renderHome();
    toast('ล้างความคืบหน้าแล้ว');
  });

  /* =======================================================================
     Go
     ======================================================================= */
  applyTheme();
  history.replaceState({ screen: 'home' }, '');
  renderHome();
  show('home');
})();
