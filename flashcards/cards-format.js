/* flashcards/cards-format.js — reads the plain-text card file (cards.js).
   cards.js sets window.CARD_SOURCE to a function whose body is one big comment;
   the text inside that comment is the card file. Reading it via Function#toString
   means the teacher can type LaTeX exactly as in a .tex file (single backslashes,
   `${`, backticks…). The only text that cannot appear is the comment terminator.

   Structure:  # บท: (unit — shown as one deck)  →  # หัวข้อ: (optional topic inside the unit)  →  == cards.
   In the code a unit is still called "topic" (deck name), and a หัวข้อ is "section".

   Output (globals used by app.js):
     CARDS        [{ topic, section?, level, id, front, back, frontTikz?, backTikz?, line }]
     TOPIC_GLYPH  { [topic]: symbol }
     CARD_ERRORS  [{ line, message }]  — problems found; bad cards are skipped
     CLASSES      [{ name, code, picks: [{ unit, topics: null | [หัวข้อ …] }] }] — class links
                  (flashcards.html?class=<code>); topics null = the whole unit

   Classes (written after the units, made in card-editor.html → ห้องเรียน):
     # ห้องเรียน: ม.2/3
     # ลิงก์: m2-3                                  ← a-z 0-9 -
     # เลือก: จำนวนเต็ม                              ← the whole unit
     # เลือก: เศษส่วน › การบวกเศษส่วน | การลบเศษส่วน   ← only these หัวข้อ ("ทั่วไป" = cards without one)
   Cards marked "ซ่อน: ใช่" are left out of CARDS (their id stays reserved).

   For the card editor (card-editor.html) there is also a lossless round trip:
     splitFile(fileText)   → { before, text, after, lineOffset }  (wrapper vs. card text)
     parseDocument(text)   → { preamble, units:[{ name, level, glyph, comments,
                               topics:[{ name|null, comments, cards:[…] }] }], trailing }
     serialize(doc)        → card text again; comments stay attached to the unit /
                             topic / card they were written directly above.
*/
(function (root) {
  'use strict';

  const LEVEL_ALIASES = {
    ps: 'ps', 'ประถม': 'ps',
    jh: 'jh', 'ม.ต้น': 'jh', 'มต้น': 'jh',
    sh: 'sh', 'ม.ปลาย': 'sh', 'มปลาย': 'sh',
    uni: 'uni', 'มหาลัย': 'uni', 'มหาวิทยาลัย': 'uni',
  };
  // Field labels at the start of a line → card property
  const FIELDS = { 'ถาม': 'front', 'ตอบ': 'back', 'รูปถาม': 'frontTikz', 'รูปตอบ': 'backTikz', 'ซ่อน': 'hiddenRaw' };
  const FIELD_RE = /^(รูปถาม|รูปตอบ|ถาม|ตอบ|ซ่อน)\s*:\s*(.*)$/;
  const YES = ['ใช่', 'yes', 'true', '1'];
  const isYes = v => YES.includes(String(v || '').trim().split('\n')[0].trim().toLowerCase());
  // Lines of card content may not start like this (they would be read as structure)
  const RESERVED_LINE_RE = /^(\s*\/\/|==|(รูปถาม|รูปตอบ|ถาม|ตอบ|ซ่อน)\s*:|#\s*(บท|หัวข้อ|ระดับ|สัญลักษณ์|ห้องเรียน|ลิงก์|เลือก)\s*:)/;
  const HEADER_RE = /^#\s*(บท|หัวข้อ|ระดับ|สัญลักษณ์|ห้องเรียน|ลิงก์|เลือก)\s*:\s*(.*)$/;
  const CLASS_CODE_RE = /^[a-z0-9-]+$/;
  // "# เลือก: unit" or "# เลือก: unit › topic | topic"
  function parsePick(value) {
    const i = value.indexOf('›');
    if (i < 0) return { unit: value.trim(), topics: null };
    return { unit: value.slice(0, i).trim(), topics: value.slice(i + 1).split('|').map(x => x.trim()).filter(Boolean) };
  }
  const pickText = p => p.unit + (p.topics ? ' › ' + p.topics.join(' | ') : '');
  const CARD_RE = /^==\s*(.*)$/;
  const COMMENT_RE = /^\s*\/\//;

  // Text between the first "/*" and the last "*/" of the wrapper function.
  function extractSource(fn) {
    if (typeof fn === 'string') return fn;
    const src = String(fn || '');
    const start = src.indexOf('/*');
    const end = src.lastIndexOf('*/');
    return start >= 0 && end > start ? src.slice(start + 2, end) : '';
  }

  // Trim leading/trailing blank lines of a field; keep blank lines in the middle.
  function finishField(lines) {
    let a = 0, b = lines.length;
    while (a < b && !lines[a].trim()) a++;
    while (b > a && !lines[b - 1].trim()) b--;
    return lines.slice(a, b).join('\n');
  }

  // lineOffset: added to every reported line so numbers match the file in the editor.
  function parse(text, lineOffset) {
    const off = lineOffset || 0;
    const cards = [];
    const glyphs = {};
    const errors = [];
    const topicLevel = {};
    const seenIds = new Map(); // id → line
    const classes = [];
    let cls = null;            // the class being read (after "# ห้องเรียน:")
    let topic = null, level = null, section = null;
    let card = null, field = null, buf = [];

    const err = (line, message) => errors.push({ line, message });

    function closeField() {
      if (card && field) card[field] = finishField(buf);
      field = null; buf = [];
    }
    function closeCard() {
      closeField();
      if (!card) return;
      const c = card;
      card = null;
      if (!c.id) { err(c.line, 'การ์ดไม่มี id (ต้องเขียนต่อจาก ==)'); return; }
      if (!c.topic) { err(c.line, 'การ์ด ' + c.id + ' อยู่ก่อน "# บท:" บรรทัดแรก'); return; }
      if (!c.level) { err(c.line, 'บท "' + c.topic + '" ยังไม่มี "# ระดับ:"'); return; }
      if (!c.front || !c.back) { err(c.line, 'การ์ด ' + c.id + ' ต้องมีทั้ง "ถาม:" และ "ตอบ:"'); return; }
      if (seenIds.has(c.id)) { err(c.line, 'id "' + c.id + '" ซ้ำกับการ์ดบรรทัด ' + seenIds.get(c.id)); return; }
      seenIds.set(c.id, c.line);
      const hidden = 'hiddenRaw' in c && isYes(c.hiddenRaw);
      delete c.hiddenRaw;
      if (!hidden) cards.push(c);   // hidden: id reserved, card not shown
    }

    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    lines.forEach((raw, i) => {
      const n = i + 1 + off;
      if (COMMENT_RE.test(raw)) return;           // // comment line
      const line = raw.replace(/\s+$/, '');
      const t = line.trimStart();

      const h = t.match(HEADER_RE);
      if (h) {
        closeCard();
        const value = h[2].trim();
        if (h[1] === 'ห้องเรียน') {
          cls = { name: value, code: '', picks: [], line: n };
          classes.push(cls);
          topic = null; section = null; level = null;
          if (!value) err(n, '"# ห้องเรียน:" ต้องมีชื่อห้อง');
          return;
        }
        if (h[1] === 'ลิงก์' || h[1] === 'เลือก') {
          if (!cls) { err(n, '"# ' + h[1] + ':" ต้องอยู่หลัง "# ห้องเรียน:"'); return; }
          if (h[1] === 'ลิงก์') {
            if (!CLASS_CODE_RE.test(value)) err(n, 'ลิงก์ห้อง "' + value + '" ใช้ได้เฉพาะ a-z 0-9 และ -');
            cls.code = value;
          } else if (value) cls.picks.push(parsePick(value));
          return;
        }
        cls = null;
        if (h[1] === 'บท') {
          topic = value || null;
          section = null;
          level = topic && topicLevel[topic] ? topicLevel[topic] : null;
          if (!topic) err(n, '"# บท:" ต้องมีชื่อบท');
        } else if (h[1] === 'หัวข้อ') {
          if (!topic) { err(n, '"# หัวข้อ:" ต้องอยู่หลัง "# บท:"'); return; }
          section = value || null;
        } else if (h[1] === 'ระดับ') {
          const code = LEVEL_ALIASES[value.replace(/\s+/g, '')] || LEVEL_ALIASES[value];
          if (!code) { err(n, 'ระดับ "' + value + '" ไม่รู้จัก ใช้ ps, jh, sh หรือ uni'); return; }
          if (!topic) { err(n, '"# ระดับ:" ต้องอยู่หลัง "# บท:"'); return; }
          if (topicLevel[topic] && topicLevel[topic] !== code) err(n, 'บท "' + topic + '" ถูกตั้งระดับไว้ต่างกันสองที่');
          topicLevel[topic] = level = code;
        } else if (topic && value) {
          glyphs[topic] = value;
        }
        return;
      }

      const c = t.match(CARD_RE);
      if (c) {
        closeCard();
        if (cls) { err(n, 'การ์ดต้องอยู่ใต้ "# บท:" ไม่ใช่ใต้ "# ห้องเรียน:"'); return; }
        card = { topic, level, id: c[1].trim(), front: '', back: '', line: n };
        if (section) card.section = section;
        return;
      }

      const f = t.match(FIELD_RE);
      if (f && card) {
        closeField();
        field = FIELDS[f[1]];
        if (card[field]) err(n, 'การ์ด ' + card.id + ' มี "' + f[1] + ':" สองครั้ง ใช้อันหลัง');
        buf = [f[2]];
        return;
      }

      if (field) { buf.push(t); return; }
      if (t && card) err(n, 'ข้อความนี้ไม่อยู่ใต้ "ถาม:" หรือ "ตอบ:" จึงถูกข้าม');
      else if (t && !card) err(n, 'ข้อความนี้อยู่นอกการ์ด (ต้องขึ้นต้นการ์ดด้วย ==) จึงถูกข้าม');
    });
    closeCard();

    // Remove empty optional fields so the app sees "no diagram"
    cards.forEach(c => { if (!c.frontTikz) delete c.frontTikz; if (!c.backTikz) delete c.backTikz; });

    // Classes: a link code each (no two alike), units that exist
    const units = new Set(cards.map(c => c.topic)), codes = new Map();
    classes.forEach(k => {
      if (!k.code) err(k.line, 'ห้องเรียน "' + k.name + '" ยังไม่มี "# ลิงก์:"');
      else if (codes.has(k.code)) err(k.line, 'ลิงก์ห้อง "' + k.code + '" ซ้ำกับห้อง "' + codes.get(k.code) + '"');
      else codes.set(k.code, k.name);
      k.picks.forEach(pk => { if (!units.has(pk.unit)) err(k.line, 'ห้องเรียน "' + k.name + '": ไม่พบบท "' + pk.unit + '"'); });
    });
    return { cards, glyphs, errors, classes: classes.filter(k => k.code && codes.get(k.code) === k.name) };
  }

  /* ======================================================================
     Editor round trip
     ====================================================================== */

  // Split the raw text of cards.js (or a draft file) into wrapper and card text.
  function splitFile(fileText) {
    const src = String(fileText || '').replace(/\r\n?/g, '\n');
    const start = src.indexOf('/*');
    const end = src.lastIndexOf('*/');
    if (start < 0 || end <= start) return null;
    return {
      before: src.slice(0, start + 2),
      text: src.slice(start + 2, end),
      after: src.slice(end),
      lineOffset: src.slice(0, start).split('\n').length - 1,
    };
  }

  function parseDocument(text) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    const doc = { preamble: [], units: [], classes: [], trailing: [] };
    let unit = null, topic = null, card = null, field = null, buf = [], cls = null;
    let pending = [];          // comment lines waiting for the next unit/topic/card
    let started = false;

    function closeField() {
      if (card && field) card[field] = finishField(buf);
      field = null; buf = [];
    }
    function closeCard() {
      closeField();
      if (card) {
        card.hidden = 'hiddenRaw' in card && isYes(card.hiddenRaw);
        delete card.hiddenRaw;
      }
      card = null;
    }
    // Before the first unit: the last comment block directly above it (no blank line)
    // belongs to that unit; everything earlier is the preamble (rules header).
    function start() {
      if (started) return;
      started = true;
      let k = pending.length;
      while (k > 0 && pending[k - 1].comment) k--;
      doc.preamble = pending.slice(0, k).map(x => x.raw);
      while (doc.preamble.length > 1 && !doc.preamble[doc.preamble.length - 1].trim()) doc.preamble.pop(); // serialize adds the gap
      pending = pending.slice(k);
    }
    const takeComments = () => { const c = pending.map(x => x.raw); pending = []; return c; };
    function getUnit(name, line) {
      let u = doc.units.find(x => x.name === name);
      if (!u) { u = { name, level: '', glyph: '', comments: [], topics: [], line }; doc.units.push(u); }
      return u;
    }
    function getTopic(u, name) {
      let t = u.topics.find(x => x.name === name);
      if (!t) {
        t = { name, comments: [], cards: [] };
        if (name === null) u.topics.unshift(t); else u.topics.push(t);  // cards without หัวข้อ come first
      }
      return t;
    }

    lines.forEach((raw, i) => {
      const n = i + 1;
      const isComment = COMMENT_RE.test(raw);
      const t = raw.replace(/\s+$/, '').trimStart();
      if (!started) {
        const structural = !isComment && (HEADER_RE.test(t) || CARD_RE.test(t));
        if (!structural) {
          if (!isComment && t) pending.push({ raw: '// ' + t, comment: true }); // stray text: keep as a note
          else pending.push({ raw: raw.replace(/\s+$/, ''), comment: isComment });
          if (!t) pending.forEach(x => { x.comment = x.comment && false; });  // a blank line detaches earlier comments
          return;
        }
        start();
      }
      // Notes wait until we know what follows: a unit/topic/card header (the note
      // belongs to it) or more of the current card (the note belongs to that card).
      if (isComment) { pending.push({ raw: raw.trim(), comment: true }); return; }

      const h = t.match(HEADER_RE);
      if (h) {
        closeCard();
        const value = h[2].trim();
        if (h[1] === 'ห้องเรียน') {
          cls = { name: value, code: '', picks: [], comments: takeComments() };
          doc.classes.push(cls);
          unit = null; topic = null;
          return;
        }
        if (h[1] === 'ลิงก์' || h[1] === 'เลือก') {
          if (!cls) { pending.push({ raw: '// ' + t, comment: true }); return; }   // keep stray lines as notes
          if (pending.length) cls.comments.push(...takeComments());
          if (h[1] === 'ลิงก์') cls.code = value; else if (value) cls.picks.push(parsePick(value));
          return;
        }
        cls = null;
        if (h[1] === 'บท') {
          unit = getUnit(value, n);
          unit.comments.push(...takeComments());
          topic = null;
        } else if (h[1] === 'หัวข้อ') {
          if (!unit) unit = getUnit('', n);
          topic = getTopic(unit, value || '');
          topic.comments.push(...takeComments());
        } else {
          if (!unit) unit = getUnit('', n);
          unit.comments.push(...takeComments());
          if (h[1] === 'ระดับ') unit.level = LEVEL_ALIASES[value.replace(/\s+/g, '')] || LEVEL_ALIASES[value] || value;
          else unit.glyph = value;
        }
        return;
      }
      const c = t.match(CARD_RE);
      if (c) {
        closeCard();
        if (!unit) unit = getUnit('', n);
        const tp = topic || getTopic(unit, null);
        card = { id: c[1].trim(), front: '', back: '', frontTikz: '', backTikz: '', hidden: false, comments: takeComments(), line: n };
        tp.cards.push(card);
        return;
      }
      const f = t.match(FIELD_RE);
      if (f && card) {
        if (pending.length) card.comments.push(...takeComments());
        closeField();
        field = FIELDS[f[1]];
        buf = [f[2]];
        return;
      }
      if (field) {
        if (t && pending.length) card.comments.push(...takeComments());
        if (t || !pending.length) buf.push(t);
        return;
      }
      if (t) pending.push({ raw: '// ' + t, comment: true }); // text outside a card: keep it as a note
    });
    closeCard();
    if (!started) { doc.preamble = pending.map(x => x.raw); pending = []; }
    doc.trailing = pending.map(x => x.raw).filter(l => l.trim());
    return doc;
  }

  function fieldLines(label, value, ownLine) {
    if (!value) return [];
    const ls = String(value).split('\n');
    return ownLine ? [label + ':', ...ls] : [label + ': ' + ls[0], ...ls.slice(1)];
  }
  function serialize(doc) {
    const out = [...doc.preamble];
    doc.units.forEach(u => {
      out.push('', '', ...u.comments, '# บท: ' + u.name, '# ระดับ: ' + u.level);
      if (u.glyph) out.push('# สัญลักษณ์: ' + u.glyph);
      u.topics.forEach(t => {
        if (t.name !== null) out.push('', ...t.comments, '# หัวข้อ: ' + t.name);
        t.cards.forEach(c => {
          out.push('', ...c.comments, '== ' + c.id,
            ...fieldLines('ถาม', c.front), ...fieldLines('ตอบ', c.back),
            ...fieldLines('รูปถาม', c.frontTikz, true), ...fieldLines('รูปตอบ', c.backTikz, true));
          if (c.hidden) out.push('ซ่อน: ใช่');
        });
      });
    });
    (doc.classes || []).forEach(k => {
      out.push('', '', ...k.comments, '# ห้องเรียน: ' + k.name, '# ลิงก์: ' + k.code, ...k.picks.map(p => '# เลือก: ' + pickText(p)));
    });
    if (doc.trailing.length) out.push('', ...doc.trailing);
    return out.join('\n') + '\n\n';
  }

  // Content lines that would break the file when written back (for the editor)
  function contentProblems(value) {
    const problems = [];
    String(value || '').split('\n').forEach((l, i) => {
      if (i > 0 && RESERVED_LINE_RE.test(l.trimStart())) problems.push('บรรทัดที่ ' + (i + 1) + ' ห้ามขึ้นต้นด้วย "' + l.trim().slice(0, 12) + '"');
    });
    if (String(value || '').includes('*/')) problems.push('ห้ามมี * ตามด้วย / ติดกัน');
    return problems;
  }

  // Diagrams are pre-drawn as flashcards/figures/<figureId>.svg by render-figures.mjs (GitHub Action).
  // The id depends only on the TikZ code (spaces at line ends and blank lines don't count),
  // so the app, the editor and the Action always agree on which picture belongs to a card.
  function normalizeTikz(tikz) {
    return String(tikz || '').split('\n').map(l => l.trim()).filter(Boolean).join('\n');
  }
  function figureId(tikz) {
    const s = normalizeTikz(tikz);
    if (!s) return '';
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57; // cyrb53
    for (let i = 0; i < s.length; i++) {
      const ch = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
  }

  const CardsFormat = { parse, extractSource, splitFile, parseDocument, serialize, contentProblems, normalizeTikz, figureId, parsePick, pickText, CLASS_CODE_RE, LEVEL_ALIASES };
  root.CardsFormat = CardsFormat;
  if (typeof module !== 'undefined' && module.exports) module.exports = CardsFormat;

  // In the page: turn cards.js into the globals app.js expects.
  if (typeof window !== 'undefined' && window.CARD_SOURCE) {
    // The card text starts on line 2 of cards.js (right after "/*"), so line 1 of the text is file line 2.
    const out = parse(extractSource(window.CARD_SOURCE), 1);
    window.CARDS = out.cards;
    window.TOPIC_GLYPH = out.glyphs;
    window.CARD_ERRORS = out.errors;
    window.CLASSES = out.classes;
    if (out.errors.length && window.console) {
      console.warn('cards.js: ' + out.errors.length + ' problem(s)\n' +
        out.errors.map(e => '  บรรทัด ' + e.line + ': ' + e.message).join('\n'));
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
