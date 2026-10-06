/* flashcards/srs.js — spaced repetition (Leitner boxes) + saved-progress handling.
   Pure logic only: no DOM. Used by app.js and by tests/srs-tests.html.

   Storage keys (all under the shared natthaphat-math.github.io origin, so namespaced):
     mathFlashcards.progress.v1  — OLD format, { [cardId]: 'remembered' | 'review' }.
                                   Still read on every load and still written on every
                                   answer, so the previous version of the app keeps
                                   working if we ever roll back.
     mathFlashcards.srs.v2       — NEW format, see emptyState() below.
     mathFlashcards.settings.v1  — theme / palette / filter (handled in app.js).
*/
(function (root) {
  'use strict';

  const KEY_V1 = 'mathFlashcards.progress.v1';
  const KEY_V2 = 'mathFlashcards.srs.v2';

  const MAX_BOX = 5;
  // Days until a card comes back after it lands in box n (index = box number).
  const INTERVAL_DAYS = [0, 1, 2, 4, 7, 14];
  // A card counts as "จำได้" from box 2 up, i.e. the student's latest answer was
  // "จำได้" — the same meaning the label had in the old app.
  const MASTERED_BOX = 2;
  // Old 'remembered' cards start here: counted as จำได้, back for a check in 1–3 days.
  const MIGRATED_BOX = 3;

  /* ---------- dates: whole local days as 'YYYY-MM-DD' strings ---------- */
  function toDay(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  function addDays(dayStr, n) {
    const [y, m, d] = dayStr.split('-').map(Number);
    return toDay(new Date(y, m - 1, d + n));
  }
  function daysBetween(fromDay, toDayStr) {
    const [y1, m1, d1] = fromDay.split('-').map(Number);
    const [y2, m2, d2] = toDayStr.split('-').map(Number);
    return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
  }

  /* Small deterministic hash so migrated cards spread over 1–3 days the same way
     on every device/reload (no Math.random → the result is testable). */
  function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* ---------- card ids: identical rules to the old app ---------- */
  // Explicit `id` wins; otherwise topic + 1-based position within that topic.
  // Changing this would make students lose progress on cards without an id.
  function assignIds(cards) {
    const ids = new Map();
    const seenPerTopic = {};
    cards.forEach(c => {
      seenPerTopic[c.topic] = (seenPerTopic[c.topic] || 0) + 1;
      ids.set(c, c.id || (c.topic + '__' + seenPerTopic[c.topic]));
    });
    return ids;
  }

  /* ---------- state ---------- */
  function emptyState() {
    // cards: { [cardId]: { box: 1..5, due: 'YYYY-MM-DD', last: 'remembered'|'review', seen: n } }
    return { version: 2, cards: {}, migratedFromV1: false };
  }

  // Convert one old v1 status into a v2 record.
  function fromV1(id, status, today) {
    if (status === 'review') return { box: 1, due: today, last: 'review', seen: 1 };
    if (status === 'remembered') {
      const spread = 1 + (hashString(id) % 3); // 1, 2 or 3 days
      return { box: MIGRATED_BOX, due: addDays(today, spread), last: 'remembered', seen: 1 };
    }
    return null;
  }

  /* Bring v2 in line with v1.
     - First run (no v2 yet): every v1 entry is converted.
     - Later runs: if v1 says something different from v2's `last` answer, the student
       must have used the old app in between (rollback) — re-convert just that card.
     Returns { state, changed, firstMigration }. */
  function reconcile(v2, v1, today) {
    const firstMigration = !v2;
    const state = v2 ? v2 : emptyState();
    let changed = firstMigration;
    // v1 is always written together with v2, so an empty v1 next to a non-empty v2
    // means the old app's "ล้างความคืบหน้า" button was used — honour that reset.
    if (v2 && v1 && !Object.keys(v1).length && Object.keys(state.cards).length) {
      state.cards = {};
      changed = true;
    }
    Object.keys(v1 || {}).forEach(id => {
      const status = v1[id];
      const rec = state.cards[id];
      if (!rec || rec.last !== status) {
        const converted = fromV1(id, status, today);
        if (converted) { state.cards[id] = converted; changed = true; }
      }
    });
    if (firstMigration && v1 && Object.keys(v1).length) state.migratedFromV1 = true;
    return { state, changed, firstMigration };
  }

  /* ---------- Leitner rules ---------- */
  // New cards count as box 1 (they are stored only after the first answer).
  // knew = true  → move up one box (max 5)
  // knew = false → back to box 1
  function answer(state, id, knew, today) {
    const prev = state.cards[id];
    const box = knew ? Math.min(MAX_BOX, (prev ? prev.box : 1) + 1) : 1;
    const rec = {
      box,
      due: addDays(today, INTERVAL_DAYS[box]),
      last: knew ? 'remembered' : 'review',
      seen: (prev ? prev.seen : 0) + 1,
    };
    state.cards[id] = rec;
    return rec;
  }

  function boxOf(state, id) { const r = state.cards[id]; return r ? r.box : 0; } // 0 = new
  function isDue(state, id, today) {
    const r = state.cards[id];
    return !r || r.due <= today; // new cards are always due
  }
  function isMastered(state, id) { return boxOf(state, id) >= MASTERED_BOX; }
  function lastAnswer(state, id) { const r = state.cards[id]; return r ? r.last : null; }

  // v1 mirror of the current state (what the old app would show).
  function toV1(state) {
    const out = {};
    Object.keys(state.cards).forEach(id => { out[id] = state.cards[id].last; });
    return out;
  }

  /* ---------- storage (every access guarded: private mode can throw) ---------- */
  function readJSON(storage, key) {
    try { const raw = storage.getItem(key); return raw ? JSON.parse(raw) : null; }
    catch (err) { return null; }
  }
  function writeJSON(storage, key, value) {
    try { storage.setItem(key, JSON.stringify(value)); return true; }
    catch (err) { return false; }
  }

  function isValidV2(obj) { return obj && obj.version === 2 && obj.cards && typeof obj.cards === 'object'; }

  function load(storage, today) {
    const v1 = readJSON(storage, KEY_V1); // null when the key doesn't exist at all
    const rawV2 = readJSON(storage, KEY_V2);
    const result = reconcile(isValidV2(rawV2) ? rawV2 : null, v1, today);
    if (result.changed) save(storage, result.state);
    return result;
  }
  function save(storage, state) {
    writeJSON(storage, KEY_V2, state);
    writeJSON(storage, KEY_V1, toV1(state));
  }
  function clearAll(storage) {
    try { storage.removeItem(KEY_V2); storage.removeItem(KEY_V1); } catch (err) { /* ignore */ }
  }

  const SRS = {
    KEY_V1, KEY_V2, MAX_BOX, INTERVAL_DAYS, MASTERED_BOX, MIGRATED_BOX,
    toDay, addDays, daysBetween, assignIds, emptyState, fromV1, reconcile,
    answer, boxOf, isDue, isMastered, lastAnswer, toV1, load, save, clearAll,
  };
  root.SRS = SRS;
  if (typeof module !== 'undefined' && module.exports) module.exports = SRS;
})(typeof window !== 'undefined' ? window : globalThis);
