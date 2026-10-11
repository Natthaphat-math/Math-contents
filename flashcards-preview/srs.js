/* flashcards/srs.js — spaced repetition (Leitner boxes) + saved-progress handling.
   Pure logic only: no DOM. Used by app.js and by tests/srs-tests.html.

   Storage keys (all under the shared natthaphat-math.github.io origin, so namespaced):
     mathFlashcards.progress.v1  — OLD format, { [cardId]: 'remembered' | 'review' }.
                                   Still read on every load and still written on every
                                   answer, so the previous version of the app keeps
                                   working if we ever roll back.
     mathFlashcards.srs.v2       — NEW format, see emptyState() below.
     mathFlashcards.settings.v1  — theme / palette / filter (handled in app.js).
     mathFlashcards.stats.v1     — answers per day (streak) and new cards started today.
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
    // cards: { [cardId]: { box: 1..5, due: 'YYYY-MM-DD', last: 'remembered'|'review', seen: n, t?: ms } }
    // t = time of the last answer (used to merge progress from two devices; older records have none)
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
  function answer(state, id, knew, today, now) {
    const prev = state.cards[id];
    const box = knew ? Math.min(MAX_BOX, (prev ? prev.box : 1) + 1) : 1;
    const rec = {
      box,
      due: addDays(today, INTERVAL_DAYS[box]),
      last: knew ? 'remembered' : 'review',
      seen: (prev ? prev.seen : 0) + 1,
      t: now || Date.now(),
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
    try { storage.removeItem(KEY_V2); storage.removeItem(KEY_V1); storage.removeItem(KEY_STATS); } catch (err) { /* ignore */ }
  }

  /* ======================================================================
     Daily new cards + streak (mathFlashcards.stats.v1)
     stats = { days: { 'YYYY-MM-DD': answers }, newDay, newCount, extraNew }
     ====================================================================== */
  const KEY_STATS = 'mathFlashcards.stats.v1';
  const NEW_PER_DAY_CHOICES = [5, 10, 15, 20, 30];
  const DEFAULT_NEW_PER_DAY = 10;
  const STREAK_MIN = 5;          // answers needed for a day to count in the streak

  function emptyStats() { return { days: {}, newDay: '', newCount: 0, extraNew: 0 }; }
  function normStats(st, today) {
    const s = Object.assign(emptyStats(), st || {});
    if (!s.days || typeof s.days !== 'object') s.days = {};
    if (s.newDay !== today) { s.newDay = today; s.newCount = 0; s.extraNew = 0; }
    return s;
  }
  // wasNew: the card had never been answered before (it is "started" today)
  function recordAnswer(st, today, wasNew) {
    const s = normStats(st, today);
    s.days[today] = (s.days[today] || 0) + 1;
    if (wasNew) s.newCount++;
    // keep about a year of history
    Object.keys(s.days).forEach(d => { if (daysBetween(d, today) > 400) delete s.days[d]; });
    return s;
  }
  function unrecordAnswer(st, today, wasNew) {
    const s = normStats(st, today);
    if (s.days[today]) s.days[today]--;
    if (wasNew && s.newCount > 0) s.newCount--;
    return s;
  }
  function newAllowance(st, today, limit) {
    const s = normStats(st, today);
    return Math.max(0, limit + s.extraNew - s.newCount);
  }
  function addExtraNew(st, today, n) { const s = normStats(st, today); s.extraNew += n; return s; }
  function todayCount(st, today) { return (st && st.days && st.days[today]) || 0; }
  // Days in a row with at least STREAK_MIN answers, ending today (or yesterday while
  // today isn't finished yet, so the streak doesn't look broken in the morning).
  function streak(st, today) {
    const days = (st && st.days) || {};
    let d = (days[today] || 0) >= STREAK_MIN ? today : addDays(today, -1);
    let n = 0;
    while ((days[d] || 0) >= STREAK_MIN) { n++; d = addDays(d, -1); }
    return n;
  }
  function loadStats(storage, today) { return normStats(readJSON(storage, KEY_STATS), today); }
  function saveStats(storage, st) { writeJSON(storage, KEY_STATS, st); }

  /* Which cards to study now, from cards in teaching order:
     every answered card that is due, plus the first `allowance` never-answered cards. */
  function selectDue(state, ids, today, allowance) {
    const reviews = [], fresh = [];
    let newTotal = 0;
    ids.forEach(id => {
      const r = state.cards[id];
      if (r) { if (r.due <= today) reviews.push(id); }
      else { newTotal++; if (fresh.length < allowance) fresh.push(id); }
    });
    return { reviews, fresh, newTotal };
  }

  /* ======================================================================
     Backup / move to another device
     Code = "FC1" + ("z" deflated | "j" plain) + "." + base64url(JSON)
     ====================================================================== */
  function b64urlEncode(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(str) {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function pipe(bytes, stream) {
    const s = new Blob([bytes]).stream().pipeThrough(stream);
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  const canDeflate = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

  // Compact snapshot of everything worth moving: progress, pins/ticks, daily setting, recent days
  function makeBackup(state, stats, settings, today) {
    const c = Object.keys(state.cards).map(id => {
      const r = state.cards[id];
      return [id, r.box, daysBetween(today, r.due), r.last === 'remembered' ? 1 : 0, r.seen || 1, r.t ? Math.round(r.t / 60000) : 0];
    });
    const days = {};
    Object.keys((stats && stats.days) || {}).forEach(d => { if (daysBetween(d, today) <= 60) days[d] = stats.days[d]; });
    return { v: 1, d: today, c, p: (settings && settings.pins) || [], o: (settings && settings.off) || {}, n: settings && settings.newPerDay, s: days };
  }
  async function encodeBackup(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    if (canDeflate()) {
      try { return 'FC1z.' + b64urlEncode(await pipe(bytes, new CompressionStream('deflate-raw'))); } catch (e) { /* fall through */ }
    }
    return 'FC1j.' + b64urlEncode(bytes);
  }
  async function decodeBackup(code) {
    const m = String(code || '').trim().match(/(FC1[zj])\.([A-Za-z0-9_-]+)/);
    if (!m) throw new Error('รหัสไม่ถูกต้อง');
    let bytes = b64urlDecode(m[2]);
    if (m[1] === 'FC1z') {
      if (!canDeflate()) throw new Error('เบราว์เซอร์นี้อ่านรหัสแบบย่อไม่ได้ ลองเปิดใน Chrome หรือ Safari รุ่นใหม่');
      bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    }
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    if (!obj || obj.v !== 1 || !Array.isArray(obj.c)) throw new Error('รหัสไม่ถูกต้อง');
    return obj;
  }
  /* Merge a backup into this device: for each card keep the most recent answer
     (records without a time count as oldest). Pins/ticks: union / this device first.
     Returns counts for the confirmation message. */
  function mergeBackup(state, stats, settings, backup) {
    let added = 0, updated = 0, kept = 0;
    backup.c.forEach(([id, box, dueOff, rem, seen, tMin]) => {
      const incoming = { box, due: addDays(backup.d, dueOff), last: rem ? 'remembered' : 'review', seen, t: tMin ? tMin * 60000 : 0 };
      const local = state.cards[id];
      if (!local) { state.cards[id] = incoming; added++; }
      else if ((incoming.t || 0) > (local.t || 0)) { state.cards[id] = incoming; updated++; }
      else kept++;
    });
    const s = stats || emptyStats();
    Object.keys(backup.s || {}).forEach(d => { s.days[d] = Math.max(s.days[d] || 0, backup.s[d]); });
    const pins = settings.pins || [];
    (backup.p || []).forEach(t => { if (!pins.includes(t)) pins.push(t); });
    settings.pins = pins;
    settings.off = Object.assign({}, backup.o || {}, settings.off || {});
    if (!settings.newPerDayChosen && NEW_PER_DAY_CHOICES.includes(backup.n)) settings.newPerDay = backup.n;
    return { added, updated, kept };
  }

  const SRS = {
    KEY_V1, KEY_V2, KEY_STATS, MAX_BOX, INTERVAL_DAYS, MASTERED_BOX, MIGRATED_BOX,
    NEW_PER_DAY_CHOICES, DEFAULT_NEW_PER_DAY, STREAK_MIN,
    toDay, addDays, daysBetween, assignIds, emptyState, fromV1, reconcile,
    answer, boxOf, isDue, isMastered, lastAnswer, toV1, load, save, clearAll,
    emptyStats, recordAnswer, unrecordAnswer, newAllowance, addExtraNew, todayCount, streak, loadStats, saveStats,
    selectDue, makeBackup, encodeBackup, decodeBackup, mergeBackup,
  };
  root.SRS = SRS;
  if (typeof module !== 'undefined' && module.exports) module.exports = SRS;
})(typeof window !== 'undefined' ? window : globalThis);
