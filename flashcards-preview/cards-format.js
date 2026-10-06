/* flashcards/cards-format.js — reads the plain-text card file (cards.js).
   cards.js sets window.CARD_SOURCE to a function whose body is one big comment;
   the text inside that comment is the card file. Reading it via Function#toString
   means the teacher can type LaTeX exactly as in a .tex file (single backslashes,
   `${`, backticks…). The only text that cannot appear is the comment terminator.

   Output (globals used by app.js):
     CARDS        [{ topic, level, id, front, back, frontTikz?, backTikz?, line }]
     TOPIC_GLYPH  { [topic]: symbol }
     CARD_ERRORS  [{ line, message }]  — problems found; bad cards are skipped
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
  const FIELDS = { 'ถาม': 'front', 'ตอบ': 'back', 'รูปถาม': 'frontTikz', 'รูปตอบ': 'backTikz' };
  const FIELD_RE = /^(รูปถาม|รูปตอบ|ถาม|ตอบ)\s*:\s*(.*)$/;
  const HEADER_RE = /^#\s*(หัวข้อ|ระดับ|สัญลักษณ์)\s*:\s*(.*)$/;
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
    let topic = null, level = null;
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
      if (!c.topic) { err(c.line, 'การ์ด ' + c.id + ' อยู่ก่อน "# หัวข้อ:" บรรทัดแรก'); return; }
      if (!c.level) { err(c.line, 'หัวข้อ "' + c.topic + '" ยังไม่มี "# ระดับ:"'); return; }
      if (!c.front || !c.back) { err(c.line, 'การ์ด ' + c.id + ' ต้องมีทั้ง "ถาม:" และ "ตอบ:"'); return; }
      if (seenIds.has(c.id)) { err(c.line, 'id "' + c.id + '" ซ้ำกับการ์ดบรรทัด ' + seenIds.get(c.id)); return; }
      seenIds.set(c.id, c.line);
      cards.push(c);
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
        if (h[1] === 'หัวข้อ') {
          topic = value || null;
          level = topic && topicLevel[topic] ? topicLevel[topic] : null;
          if (!topic) err(n, '"# หัวข้อ:" ต้องมีชื่อหัวข้อ');
        } else if (h[1] === 'ระดับ') {
          const code = LEVEL_ALIASES[value.replace(/\s+/g, '')] || LEVEL_ALIASES[value];
          if (!code) { err(n, 'ระดับ "' + value + '" ไม่รู้จัก ใช้ ps, jh, sh หรือ uni'); return; }
          if (!topic) { err(n, '"# ระดับ:" ต้องอยู่หลัง "# หัวข้อ:"'); return; }
          if (topicLevel[topic] && topicLevel[topic] !== code) err(n, 'หัวข้อ "' + topic + '" ถูกตั้งระดับไว้ต่างกันสองที่');
          topicLevel[topic] = level = code;
        } else if (topic && value) {
          glyphs[topic] = value;
        }
        return;
      }

      const c = t.match(CARD_RE);
      if (c) {
        closeCard();
        card = { topic, level, id: c[1].trim(), front: '', back: '', line: n };
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
    return { cards, glyphs, errors };
  }

  const CardsFormat = { parse, extractSource };
  root.CardsFormat = CardsFormat;
  if (typeof module !== 'undefined' && module.exports) module.exports = CardsFormat;

  // In the page: turn cards.js into the globals app.js expects.
  if (typeof window !== 'undefined' && window.CARD_SOURCE) {
    // The card text starts on line 2 of cards.js (right after "/*"), so line 1 of the text is file line 2.
    const out = parse(extractSource(window.CARD_SOURCE), 1);
    window.CARDS = out.cards;
    window.TOPIC_GLYPH = out.glyphs;
    window.CARD_ERRORS = out.errors;
    if (out.errors.length && window.console) {
      console.warn('cards.js: ' + out.errors.length + ' problem(s)\n' +
        out.errors.map(e => '  บรรทัด ' + e.line + ': ' + e.message).join('\n'));
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
