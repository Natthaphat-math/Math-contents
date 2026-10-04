// Concept pairings: exact card combinations that mean something even though
// no arithmetic happens. Written in play notation; `#num` matches any number
// card. Order never matters here.
export const COMBOS = [
  { id: 'fx', play: 'S(n), x', note: 'S(x) = x + 1: a rule that works for any input at all.' },
  { id: 'seq', play: 'f(x), ℕ', note: 'Feed 1, 2, 3, … into a function and out comes a list: a₁, a₂, a₃, …' },
  { id: 'sigma', play: '+, aₙ', note: 'Add up a whole list: a₁ + a₂ + a₃ + …' },
  { id: 'lim', play: 'aₙ, ∞', note: '1, ½, ⅓, ¼, … never reaches 0, but gets as close as you like. Where a list is heading is its limit.' },
  { id: 'pi', play: 'θ, +, θ, +, θ', note: 'A triangle’s three angles always make a half-turn: 180°, which is π radians.' },
  { id: 'vec', play: '#num, θ', note: 'A length and a direction: an arrow.' },
  { id: 'mat', play: 'v⃗, v⃗', note: 'Arrows side by side make a grid of numbers that moves space.' },
  { id: 'e', play: 'Σ, 1, ÷, n!', note: '1/0! + 1/1! + 1/2! + 1/3! + … = 2.71828…' },
  { id: 'ddx', play: 'lim, △, f(x)', note: 'Shrink the slope triangle on a curve until it vanishes: the slope at one point.' },
  { id: 'int', play: 'lim, Σ, f(x)', note: 'Add up infinitely many thin slices under a curve: the area.' },
  { id: 'ftc', play: 'd/dx, ∫', relation: 'inverse', note: 'Differentiating undoes integrating: two halves of one idea.' },
];

// Two operators played together (order never matters).
export const OPERATOR_PAIRS = [
  { ops: ['+', '−'], relation: 'inverse', note: '− undoes +.' },
  { ops: ['×', '÷'], relation: 'inverse', note: '÷ undoes ×.' },
  { ops: ['aᵇ', 'log'], relation: 'inverse', note: 'log undoes aᵇ: it finds the power.' },
  { ops: ['aᵇ', '√'], relation: 'inverse', note: '√ undoes squaring.' },
  { ops: ['+', '×'], relation: 'repeat', note: '× is repeated +.' },
  { ops: ['×', 'aᵇ'], relation: 'repeat', note: 'aᵇ is repeated ×.' },
  { ops: ['S', '+'], relation: 'repeat', note: '+ is repeated S: 3 + 2 = S(S(3)).' },
];
