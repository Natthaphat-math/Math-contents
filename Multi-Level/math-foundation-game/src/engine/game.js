// Game state and discovery. No DOM here, so it runs under `node --test`.
import { CARD, CARDS, SYSTEM_CARD } from '../../data/cards.js';
import { PATHS } from '../../data/paths.js';
import { parseNotation } from './notation.js';
import { classify } from './grammar.js';
import { evaluate } from './evaluate.js';
import { PATTERNS } from './patterns.js';
import { nextQuestion, checkAnswer } from './questions.js';
import { SYSTEM_SYMBOL } from './values.js';

export const SAVE_VERSION = 1;
const ORDER_SENSITIVE = new Set(['O02', 'O04', 'O06', 'A04']); // − ÷ aᵇ log

// Parse every exact recipe once, at load.
export const PATH_TABLE = PATHS.map((entry) => ({
  ...entry,
  paths: entry.paths.map((p) => (p.play ? { ...p, parsed: parseNotation(p.play) } : p)),
}));
export const PATHS_BY_CARD = Object.fromEntries(PATH_TABLE.map((e) => [e.card, e]));

export function freshState() {
  const owned = {};
  let n = 0;
  for (const c of CARDS) if (c.start) owned[c.id] = { n: ++n, seen: false };
  return {
    v: SAVE_VERSION, owned, counter: n, found: {}, solved: {}, plays: 0,
    applied: {}, prevTransmuteOut: null, log: [], snoozeUntil: 0, lastQuestion: null,
  };
}

// Accept only well-formed saved state; drop anything unknown.
export function sanitizeState(raw) {
  if (!raw || typeof raw !== 'object' || raw.v !== SAVE_VERSION || typeof raw.owned !== 'object') return null;
  const s = freshState();
  const int = (x) => (Number.isInteger(x) && x >= 0 ? x : 0);
  for (const [id, o] of Object.entries(raw.owned)) {
    if (CARD[id]) s.owned[id] = { n: int(o?.n), seen: !!o?.seen };
  }
  s.counter = Math.max(int(raw.counter), ...Object.values(s.owned).map((o) => o.n));
  for (const [id, list] of Object.entries(raw.found ?? {})) {
    const valid = new Set((PATHS_BY_CARD[id]?.paths ?? []).map((p) => p.id));
    if (Array.isArray(list)) s.found[id] = list.filter((p) => valid.has(p));
  }
  for (const [k, v] of Object.entries(raw.solved ?? {})) if (typeof k === 'string') s.solved[k] = int(v);
  s.plays = int(raw.plays);
  for (const [k, v] of Object.entries(raw.applied ?? {})) if (Array.isArray(v)) s.applied[String(k)] = v.map(String).slice(0, 10);
  s.prevTransmuteOut = CARD[raw.prevTransmuteOut] ? raw.prevTransmuteOut : null;
  if (Array.isArray(raw.log)) {
    s.log = raw.log.slice(-200).map((e) => ({
      n: int(e?.n), text: String(e?.text ?? ''), grants: Array.isArray(e?.grants) ? e.grants.filter((g) => CARD[g]) : [],
    }));
  }
  s.snoozeUntil = int(raw.snoozeUntil);
  s.lastQuestion = typeof raw.lastQuestion === 'string' ? raw.lastQuestion : null;
  return s;
}

function playMatches(parsed, tokens, outcome) {
  if (outcome.status !== 'ok' && outcome.status !== 'relation') return false;
  if (parsed.transmute !== (outcome.shape === 'transmute')) return false;
  if (tokens.length !== parsed.ids.length || tokens.some((t) => !t.id)) return false;
  const ids = tokens.map((t) => t.id);
  if (parsed.transmute || ids.some((id) => ORDER_SENSITIVE.has(id))) return ids.join() === parsed.ids.join();
  return [...ids].sort().join() === [...parsed.ids].sort().join();
}

export class Game {
  constructor(state) {
    this.s = sanitizeState(state) ?? freshState();
  }

  owns = (id) => !!this.s.owned[id];

  systems() {
    const set = new Set(['N']);
    for (const [sys, id] of Object.entries(SYSTEM_CARD)) if (this.owns(id)) set.add(sys);
    return set;
  }

  env() { return { systems: this.systems(), owns: this.owns }; }

  classify(tokens) { return classify(tokens); }

  // Paths found for a card, and how many it has in total.
  pathCount(id) {
    const all = PATHS_BY_CARD[id]?.paths ?? [];
    return { found: (this.s.found[id] ?? []).length, total: all.length };
  }

  // ---- discovery ----------------------------------------------------------

  grant(id, via, because, grants) {
    if (this.owns(id) || !CARD[id]) return;
    this.s.owned[id] = { n: ++this.s.counter, seen: false };
    grants.push({ id, via, because });
    for (const extra of PATHS_BY_CARD[id]?.also ?? []) {
      this.grant(extra, 'unlock', `arrives with ${CARD[id].symbol}`, grants);
    }
    this.match({ kind: 'own', id }, grants);
  }

  firePath(entry, path, ctx, grants) {
    const list = (this.s.found[entry.card] ??= []);
    if (list.includes(path.id)) return;
    list.push(path.id);
    const produced = ctx.outcome?.cardId === entry.card;
    this.grant(entry.card, produced ? 'result' : 'unlock', this.because(path, ctx), grants);
  }

  because(path, ctx) {
    if (path.own) return `because you own ${CARD[path.own].symbol}`;
    if (ctx.kind === 'question') return 'from answering questions';
    if (ctx.kind === 'event') return path.desc ?? '';
    if (ctx.outcome?.status === 'stuck') return `${ctx.outcome.text}`;
    return ctx.outcome?.text ?? '';
  }

  triggerMatches(path, ctx, cardId) {
    switch (ctx.kind) {
      case 'own': return path.own === ctx.id;
      case 'question': return path.question === ctx.qkind && ctx.count >= path.solved;
      case 'event': return path.event === ctx.name;
      case 'play': {
        const o = ctx.outcome;
        if (path.play) return playMatches(path.parsed, ctx.tokens, o);
        if (path.pattern) return PATTERNS[path.pattern](path, ctx, cardId);
        if (path.stuck) return o.status === 'stuck' && o.stuckIn === path.stuck;
        if (path.combo) return o.combo === path.combo;
        return false;
      }
      default: return false;
    }
  }

  match(ctx, grants) {
    for (const entry of PATH_TABLE) {
      if (!CARD[entry.card]?.m1) continue;
      for (const path of entry.paths) {
        if ((this.s.found[entry.card] ?? []).includes(path.id)) continue;
        if (this.triggerMatches(path, ctx, entry.card)) this.firePath(entry, path, ctx, grants);
      }
    }
  }

  // ---- plays --------------------------------------------------------------

  play(tokens) {
    const cls = classify(tokens);
    if (!cls) return null;
    this.s.plays++;
    const grants = [];
    const first = evaluate(tokens, cls, this.env());
    this.resolve(tokens, first, grants);
    let resolved = null;
    if (first.status === 'stuck' && this.systems().has(first.stuckIn)) {
      resolved = evaluate(tokens, cls, this.env());
      this.resolve(tokens, resolved, grants);
    }
    const final = resolved ?? first;
    this.s.prevTransmuteOut = final.shape === 'transmute' && final.cardId ? final.cardId : null;
    for (const t of tokens) if (t.id && this.s.owned[t.id]) this.s.owned[t.id].seen = true;
    this.addLog(first.status === 'stuck' && resolved ? `${first.text} → ${resolved.text}` : final.text, grants);
    return { outcome: first, resolved, grants };
  }

  resolve(tokens, outcome, grants) {
    let sameInputMax = 0;
    if (outcome.status === 'ok' && outcome.applied) {
      const { input, op } = outcome.applied;
      const list = (this.s.applied[input] ??= []);
      if (!list.includes(op)) list.push(op);
      sameInputMax = list.length;
    }
    this.match({ kind: 'play', tokens, outcome, prevTransmuteOut: this.s.prevTransmuteOut, sameInputMax }, grants);
    if (outcome.status === 'ok' && outcome.cardId && CARD[outcome.cardId].m1) {
      this.grant(outcome.cardId, 'result', outcome.text, grants);
    }
  }

  event(name) {
    const grants = [];
    this.match({ kind: 'event', name }, grants);
    if (grants.length) this.addLog(name === 'keep-going' ? 'S, S, S, … there is always a next one' : name, grants);
    return grants;
  }

  addLog(text, grants) {
    this.s.log.push({ n: this.s.plays, text, grants: grants.map((g) => g.id) });
    if (this.s.log.length > 200) this.s.log.splice(0, this.s.log.length - 200);
  }

  markSeen(id) { if (this.s.owned[id]) this.s.owned[id].seen = true; }

  // ---- questions ----------------------------------------------------------

  offerQuestion() {
    if (this.s.plays < this.s.snoozeUntil) return null;
    return nextQuestion(this.owns, this.s.plays + (this.s.solved.total ?? 0), this.s.lastQuestion);
  }

  snoozeQuestion() { this.s.snoozeUntil = this.s.plays + 3; }

  answer(q, value) {
    const res = checkAnswer(q, value);
    if (!res.correct) return { ...res, grants: [] };
    return { ...res, grants: this.solveQuestion(q) };
  }

  solveQuestion(q) {
    const count = (this.s.solved[q.kind] = (this.s.solved[q.kind] ?? 0) + 1);
    this.s.solved.total = (this.s.solved.total ?? 0) + 1;
    this.s.lastQuestion = q.key;
    const grants = [];
    this.match({ kind: 'question', qkind: q.kind, count }, grants);
    this.addLog(`Question answered: ${q.kind}`, grants);
    return grants;
  }

  // ---- summaries for the UI -----------------------------------------------

  ownedCount() { return Object.keys(this.s.owned).length; }

  ladder() {
    const sys = this.systems();
    return Object.entries(SYSTEM_SYMBOL).map(([id, symbol]) => ({
      id, symbol, card: SYSTEM_CARD[id], lit: id === 'N' ? this.owns('S16') : sys.has(id),
    }));
  }
}
