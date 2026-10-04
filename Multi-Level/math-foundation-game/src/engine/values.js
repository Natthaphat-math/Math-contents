// Mathematical values used by the engine.
//
//   { k: 'q', n, d }        exact rational, BigInt n / d, d > 0, reduced
//   { k: 'r', x, sym? }     real number known only approximately (irrational)
//   { k: 'c', re, im }      complex number with im ≠ 0 (float parts)
//   { k: 'huge', exp, neg } integer too large to hold, ≈ 10^exp
//   { k: 'set', els }       finite set, elements canonical and sorted
//   { k: 'sys', id }        a named number system: N Z Q R C
//   { k: 'bool', b }
//
// Operations throw Undefined when an answer does not exist in any system
// ("no theorem yet"). Which number system an answer needs is a separate
// question, answered by system(), so the engine can decide what is stuck.

export class Undefined extends Error {
  constructor(why) { super(why); this.why = why; }
}

const MINUS = '−';
const abs = (b) => (b < 0n ? -b : b);
function gcd(a, b) { a = abs(a); b = abs(b); while (b) [a, b] = [b, a % b]; return a; }

export function Q(n, d = 1n) {
  n = BigInt(n); d = BigInt(d);
  if (d === 0n) throw new Undefined('div0');
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d) || 1n;
  return { k: 'q', n: n / g, d: d / g };
}
export const R = (x, sym) => (sym ? { k: 'r', x, sym } : { k: 'r', x });
export const SYS = (id) => ({ k: 'sys', id });
export const BOOL = (b) => ({ k: 'bool', b });
export const HUGE = (exp, neg = false) => ({ k: 'huge', exp, neg });

export function SET(els) {
  const seen = new Map();
  for (const e of els) seen.set(key(e), e);
  // Shorter keys first, so ∅ comes before {∅} and 2 before 10.
  const keys = [...seen.keys()].sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));
  return { k: 'set', els: keys.map((kk) => seen.get(kk)) };
}

export function C(re, im) {
  const clean = (v) => {
    if (Math.abs(v) < 1e-12) return 0;
    const r = Math.round(v);
    return Math.abs(v - r) < 1e-9 ? r : v;
  };
  re = clean(re); im = clean(im);
  if (im === 0) return real(re);
  return { k: 'c', re, im };
}

export const isNumeric = (v) => v && (v.k === 'q' || v.k === 'r' || v.k === 'c' || v.k === 'huge');
export const isReal = (v) => v && (v.k === 'q' || v.k === 'r' || v.k === 'huge');
export const isInt = (v) => v && v.k === 'q' && v.d === 1n;
export const isNatural = (v) => isInt(v) && v.n >= 0n;

// Float approximation of a real value.
export function toFloat(v) {
  if (v.k === 'q') {
    const x = Number(v.n) / Number(v.d);
    if (Number.isFinite(x)) return x;
    return Math.sign(Number(v.n)) * 10 ** (log10Abs(v.n) - log10Abs(v.d));
  }
  if (v.k === 'r') return v.x;
  if (v.k === 'huge') return v.neg ? -Infinity : Infinity;
  throw new Undefined('notReal');
}

function log10Abs(b) {
  b = abs(b);
  if (b === 0n) return -Infinity;
  const s = b.toString();
  if (s.length <= 15) return Math.log10(Number(s));
  return s.length - 15 + Math.log10(Number(s.slice(0, 15)));
}

// A float result from real inputs: snap to a simple fraction when it is one
// (so √2 × √2 gives exactly 2).
function real(x) {
  if (!Number.isFinite(x)) throw new Undefined('overflow');
  for (let d = 1; d <= 64; d++) {
    const n = Math.round(x * d);
    if (Math.abs(x * d - n) < 1e-9 * Math.max(1, Math.abs(x * d))) return Q(n, d);
  }
  return R(x);
}

const cx = (v) => (v.k === 'c' ? { re: v.re, im: v.im } : { re: toFloat(v), im: 0 });

export function neg(v) {
  if (v.k === 'q') return Q(-v.n, v.d);
  if (v.k === 'r') return R(-v.x);
  if (v.k === 'c') return C(-v.re, -v.im);
  if (v.k === 'huge') return HUGE(v.exp, !v.neg);
  throw new Undefined('notNumber');
}

function needNumbers(a, b) {
  if (!isNumeric(a) || !isNumeric(b)) throw new Undefined('notNumber');
}

function hugeLog(v) { // log10 |v| for sizing huge results
  if (v.k === 'huge') return v.exp;
  if (v.k === 'q') return log10Abs(v.n) - log10Abs(v.d);
  return Math.log10(Math.abs(toFloat(v)));
}
const signNeg = (v) => (v.k === 'huge' ? v.neg : v.k === 'q' ? v.n < 0n : toFloat(v) < 0);

export function add(a, b) {
  needNumbers(a, b);
  if (a.k === 'huge' || b.k === 'huge') {
    if (a.k === 'c' || b.k === 'c') throw new Undefined('huge');
    if (signNeg(a) !== signNeg(b)) throw new Undefined('huge');
    return HUGE(Math.max(hugeLog(a), hugeLog(b)), signNeg(a));
  }
  if (a.k === 'q' && b.k === 'q') return Q(a.n * b.d + b.n * a.d, a.d * b.d);
  if (a.k === 'c' || b.k === 'c') { const x = cx(a), y = cx(b); return C(x.re + y.re, x.im + y.im); }
  return real(toFloat(a) + toFloat(b));
}

export const sub = (a, b) => { needNumbers(a, b); return add(a, neg(b)); };

export function mul(a, b) {
  needNumbers(a, b);
  if (a.k === 'huge' || b.k === 'huge') {
    if (a.k === 'c' || b.k === 'c') throw new Undefined('huge');
    if (isZero(a) || isZero(b)) return Q(0);
    return HUGE(hugeLog(a) + hugeLog(b), signNeg(a) !== signNeg(b));
  }
  if (a.k === 'q' && b.k === 'q') return Q(a.n * b.n, a.d * b.d);
  if (a.k === 'c' || b.k === 'c') {
    const x = cx(a), y = cx(b);
    return C(x.re * y.re - x.im * y.im, x.re * y.im + x.im * y.re);
  }
  return real(toFloat(a) * toFloat(b));
}

export const isZero = (v) => (v.k === 'q' && v.n === 0n) || (v.k === 'r' && v.x === 0);

export function div(a, b) {
  needNumbers(a, b);
  if (isZero(b)) throw new Undefined('div0');
  if (a.k === 'huge' || b.k === 'huge') {
    if (b.k === 'huge') throw new Undefined('huge');
    if (a.k === 'c' || b.k === 'c') throw new Undefined('huge');
    const e = hugeLog(a) - hugeLog(b);
    if (e < 300) throw new Undefined('huge');
    return HUGE(e, signNeg(a) !== signNeg(b));
  }
  if (a.k === 'q' && b.k === 'q') return Q(a.n * b.d, a.d * b.n);
  if (a.k === 'c' || b.k === 'c') {
    const x = cx(a), y = cx(b), m = y.re * y.re + y.im * y.im;
    return C((x.re * y.re + x.im * y.im) / m, (x.im * y.re - x.re * y.im) / m);
  }
  return real(toFloat(a) / toFloat(b));
}

// Integer k-th root of a non-negative BigInt, or null when not exact.
function irootExact(x, k) {
  if (x < 0n) return null;
  if (x < 2n) return x;
  // Newton's method from an overestimate converges down to floor(x^(1/k)).
  let r = 1n << BigInt(Math.ceil(x.toString(2).length / Number(k)));
  for (;;) {
    const next = ((k - 1n) * r + x / r ** (k - 1n)) / k;
    if (next >= r) break;
    r = next;
  }
  return r ** k === x ? r : null;
}
function rootQ(a, k) { // exact k-th root of a non-negative rational, or null
  if (k > 64n) return null;
  const n = irootExact(a.n, k), d = irootExact(a.d, k);
  return n !== null && d !== null ? Q(n, d) : null;
}

function powInt(a, n) {
  if (a.k === 'q') {
    if (n === 0n) return Q(1);
    if (n < 0n) {
      if (a.n === 0n) throw new Undefined('div0');
      return powInt(Q(a.d, a.n), -n);
    }
    const digits = Number(n) * Math.max(log10Abs(a.n), log10Abs(a.d));
    if (digits > 1200) {
      if (a.d !== 1n) throw new Undefined('huge');
      return HUGE(Number(n) * log10Abs(a.n), a.n < 0n && n % 2n === 1n);
    }
    return Q(a.n ** n, a.d ** n);
  }
  if (a.k === 'r') return real(Math.pow(a.x, Number(n)));
  if (a.k === 'huge') {
    if (n <= 0n) throw new Undefined('huge');
    return HUGE(a.exp * Number(n), a.neg && n % 2n === 1n);
  }
  if (a.k === 'c') {
    if (abs(n) > 256n) throw new Undefined('huge');
    let r = Q(1), base = a, e = abs(n);
    while (e > 0n) { if (e & 1n) r = mul(r, base); base = mul(base, base); e >>= 1n; }
    return n < 0n ? div(Q(1), r) : r;
  }
  throw new Undefined('notNumber');
}

function polarPow(a, t) { // principal value of a^t for any numeric a, real t
  const { re, im } = cx(a);
  const r = Math.hypot(re, im), th = Math.atan2(im, re);
  if (r === 0) { if (t > 0) return Q(0); throw new Undefined('div0'); }
  const m = Math.pow(r, t);
  return C(m * Math.cos(th * t), m * Math.sin(th * t));
}

export function pow(a, b) {
  needNumbers(a, b);
  if (b.k === 'huge' || b.k === 'c') throw new Undefined(b.k === 'c' ? 'complexPower' : 'huge');
  if (b.k === 'q' && b.d === 1n) return powInt(a, b.n);
  if (a.k === 'huge') throw new Undefined('huge');
  if (b.k === 'q' && a.k === 'q') {
    if (a.n >= 0n) {
      const r = rootQ(a, b.d);
      if (r) return powInt(r, b.n);
      return R(Math.pow(toFloat(a), toFloat(b))); // irrational for sure
    }
    if (b.d % 2n === 1n) { // odd root of a negative number stays real
      const p = pow(neg(a), b);
      return b.n % 2n === 0n ? p : neg(p);
    }
    return polarPow(a, toFloat(b));
  }
  if (a.k === 'c') return polarPow(a, toFloat(b));
  const x = toFloat(a), t = toFloat(b);
  if (x > 0) return real(Math.pow(x, t));
  if (x === 0) { if (t > 0) return Q(0); throw new Undefined('div0'); }
  return polarPow(a, t);
}

export const sqrt = (v) => {
  if (!isNumeric(v)) throw new Undefined('notNumber');
  if (v.k === 'huge') { if (v.neg) throw new Undefined('huge'); return HUGE(v.exp / 2); }
  return pow(v, Q(1, 2));
};

// base log x: the y with base^y = x.
export function logb(base, x) {
  needNumbers(base, x);
  if (!isReal(base) || !isReal(x) || base.k === 'huge') throw new Undefined('logDomain');
  const B = toFloat(base);
  if (B <= 0 || B === 1) throw new Undefined('logBase');
  if (x.k === 'huge') { if (x.neg) throw new Undefined('logDomain'); return real(x.exp / Math.log10(B)); }
  const X = toFloat(x);
  if (X <= 0) throw new Undefined('logDomain');
  const y = Math.log(X) / Math.log(B);
  if (base.k === 'q' && x.k === 'q') {
    for (let den = 1; den <= 6; den++) {
      const cand = Q(Math.round(y * den), den);
      try { if (equals(pow(base, cand), x)) return cand; } catch { /* not this one */ }
    }
    return R(y); // provably irrational: no small fraction works
  }
  return real(y);
}

export function absval(v) {
  if (v.k === 'q') return Q(abs(v.n), v.d);
  if (v.k === 'r') return v.x >= 0 ? v : R(-v.x);
  if (v.k === 'c') return real(Math.hypot(v.re, v.im));
  if (v.k === 'huge') return HUGE(v.exp);
  if (v.k === 'set') return Q(v.els.length); // |A| = how many elements
  throw new Undefined(v.k === 'sys' ? 'infiniteSet' : 'notNumber');
}

export function factorial(v) {
  if (!isNatural(v)) throw new Undefined('factDomain');
  const n = Number(v.n);
  if (n <= 450) { let r = 1n; for (let i = 2n; i <= v.n; i++) r *= i; return Q(r); }
  const lg = (n * Math.log(n) - n + 0.5 * Math.log(2 * Math.PI * n)) / Math.LN10;
  return HUGE(lg);
}

export function succ(v) {
  if (v.k === 'set') return SET([...v.els, v]); // n ∪ {n}
  if (v.k === 'sys') return v;                  // ℕ has no last element
  return add(v, Q(1));
}

export const percent = (v) => div(v, Q(100));

// Smallest number system that contains v (null for non-numbers).
export function system(v) {
  if (!v) return null;
  if (v.k === 'q') return v.d !== 1n ? 'Q' : v.n >= 0n ? 'N' : 'Z';
  if (v.k === 'huge') return v.neg ? 'Z' : 'N';
  if (v.k === 'r') return 'R';
  if (v.k === 'c') return 'C';
  return null;
}
export const SYSTEM_ORDER = ['N', 'Z', 'Q', 'R', 'C'];
export const SYSTEM_SYMBOL = { N: 'ℕ', Z: 'ℤ', Q: 'ℚ', R: 'ℝ', C: 'ℂ' };

// Canonical string, used for equality and for looking up the card of a value.
export function key(v) {
  switch (v.k) {
    case 'q': return `q${v.n}/${v.d}`;
    case 'r': return `r${v.x.toPrecision(12)}`;
    case 'c': return `c${v.re.toPrecision(12)},${v.im.toPrecision(12)}`;
    case 'huge': return `h${v.neg ? '-' : ''}${v.exp.toPrecision(12)}`;
    case 'set': return `{${v.els.map(key).join(',')}}`;
    case 'sys': return `s${v.id}`;
    case 'bool': return `b${v.b}`;
    default: return '?';
  }
}
export const equals = (a, b) => key(a) === key(b);

export function compare(a, b) { // -1, 0, 1 for real values
  if (a.k === 'q' && b.k === 'q') {
    const l = a.n * b.d, r = b.n * a.d;
    return l < r ? -1 : l > r ? 1 : 0;
  }
  const x = toFloat(a), y = toFloat(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

// Von Neumann numerals: 0 = ∅, n + 1 = n ∪ {n}.
const VN = [SET([])];
for (let i = 1; i <= 12; i++) VN.push(succ(VN[i - 1]));
const VN_KEYS = new Map(VN.map((s, i) => [key(s), i]));
export const vonNeumann = (n) => VN[n];
export const setToNumber = (v) => (v.k === 'set' && VN_KEYS.has(key(v)) ? VN_KEYS.get(key(v)) : null);

export function isElement(a, b) { // a ∈ b
  if (b.k === 'set') return b.els.some((e) => equals(e, a));
  if (b.k === 'sys') {
    const s = system(a);
    return s !== null && SYSTEM_ORDER.indexOf(s) <= SYSTEM_ORDER.indexOf(b.id);
  }
  return false;
}
export function isSubset(a, b) { // a ⊆ b
  if (a.k === 'set' && b.k === 'set') return a.els.every((e) => isElement(e, b));
  if (a.k === 'sys' && b.k === 'sys') return SYSTEM_ORDER.indexOf(a.id) <= SYSTEM_ORDER.indexOf(b.id);
  if (a.k === 'set' && b.k === 'sys') return a.els.every((e) => isElement(e, b));
  return false;
}

// ---- display ---------------------------------------------------------------

const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
export const superscript = (s) => String(s).split('').map((c) => SUP[c] ?? c).join('');
const sign = (s) => s.replace(/^-/, MINUS);

function intText(n) {
  const s = abs(n).toString();
  const body = s.length > 15 ? `${s[0]}.${s.slice(1, 4)} × 10${superscript(s.length - 1)}` : s;
  return (n < 0n ? MINUS : '') + body;
}

// Decimal expansion with repeating digits marked by a dot above (0.3̇, 0.1̇42857̇).
export function decimalText(v) {
  if (v.k !== 'q') return format(v);
  const negative = v.n < 0n;
  let n = abs(v.n); const d = v.d;
  const whole = n / d; n %= d;
  let digits = ''; const seen = new Map();
  while (n !== 0n && !seen.has(n) && digits.length < 12) {
    seen.set(n, digits.length);
    n *= 10n; digits += (n / d).toString(); n %= d;
  }
  let frac = digits;
  if (n !== 0n && seen.has(n)) {
    const start = seen.get(n), rep = digits.slice(start);
    const dot = (c) => c + '̇';
    const marked = rep.length === 1 ? dot(rep) : dot(rep[0]) + rep.slice(1, -1) + dot(rep.at(-1));
    frac = digits.slice(0, start) + marked;
  } else if (n !== 0n) frac += '…';
  return (negative ? MINUS : '') + whole.toString() + (frac ? '.' + frac : '');
}

function floatText(x) {
  const s = Math.abs(x) >= 1e6 || (Math.abs(x) < 1e-4 && x !== 0) ? x.toExponential(4) : String(+x.toPrecision(6));
  return sign(s) + '…';
}

export function format(v) {
  switch (v.k) {
    case 'q': return v.d === 1n ? intText(v.n) : `${v.n < 0n ? MINUS : ''}${abs(v.n)}⁄${v.d}`;
    case 'r': return v.sym ?? floatText(v.x);
    case 'c': {
      const num = (x) => (Number.isInteger(x) ? sign(String(x)) : floatText(x));
      const im = v.im === 1 ? 'i' : v.im === -1 ? `${MINUS}i` : `${num(v.im)}i`;
      if (v.re === 0) return im;
      const imAbs = Math.abs(v.im) === 1 ? 'i' : `${num(Math.abs(v.im))}i`;
      return `${num(v.re)} ${v.im < 0 ? MINUS : '+'} ${imAbs}`;
    }
    case 'huge':
      if (!Number.isFinite(v.exp)) return (v.neg ? MINUS : '') + 'unimaginably huge';
      return `${v.neg ? MINUS : ''}≈ 10${superscript(Math.floor(v.exp))}`;
    case 'set': {
      if (v.els.length === 0) return '∅';
      const s = `{${v.els.map(format).join(', ')}}`;
      return s.length > 36 ? `{ ${v.els.length} elements }` : s;
    }
    case 'sys': return SYSTEM_SYMBOL[v.id];
    case 'bool': return v.b ? 'true' : 'false';
    default: return '?';
  }
}

// Extra line for very large numbers, e.g. "(201 digits)".
export function sizeNote(v) {
  if (v.k === 'huge' && Number.isFinite(v.exp)) return `${Math.floor(v.exp) + 1} digits`;
  if (v.k === 'q' && v.d === 1n) { const len = abs(v.n).toString().length; if (len > 15) return `${len} digits`; }
  return null;
}
