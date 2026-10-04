// The eight card categories. Colors are sampled from the card art
// (Calculus has no art yet, so ochre is new).
export const CATEGORIES = [
  { id: 'numbers', name: 'Numbers', short: 'Num', color: 'terracotta', hex: '#B4502F', prefix: 'N' },
  { id: 'operations', name: 'Operations', short: 'Ops', color: 'ink', hex: '#1B1A17', prefix: 'O' },
  { id: 'sets', name: 'Sets & Logic', short: 'Sets', color: 'indigo', hex: '#2F4B7C', prefix: 'S' },
  { id: 'algebra', name: 'Algebra & Functions', short: 'Alg', color: 'green', hex: '#3F6B45', prefix: 'A' },
  { id: 'geometry', name: 'Geometry & Trig', short: 'Geo', color: 'teal', hex: '#2A6B6E', prefix: 'G' },
  { id: 'vectors', name: 'Vectors & Matrices', short: 'Vec', color: 'plum', hex: '#6E3B63', prefix: 'V' },
  { id: 'calculus', name: 'Calculus', short: 'Calc', color: 'ochre', hex: '#A8761F', prefix: 'C' },
  { id: 'probability', name: 'Probability & Statistics', short: 'Prob', color: 'slate', hex: '#4A5563', prefix: 'P' },
];

export const CATEGORY = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
