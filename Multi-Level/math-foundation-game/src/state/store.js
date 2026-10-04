// Progress lives in this browser's localStorage, plus an export code the
// player can copy somewhere safe. Every access is guarded: storage can be
// missing or blocked (private windows, previews).
const KEY = 'math-foundation.v1';
const UI_KEY = 'math-foundation.ui';

const read = (k) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };

export const loadState = () => read(KEY);
export const saveState = (s) => write(KEY, s);
export const clearState = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };
export const loadPrefs = () => read(UI_KEY) ?? {};
export const savePrefs = (p) => write(UI_KEY, p);

export function exportCode(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function importCode(code) {
  try {
    const bin = atob(code.replace(/\s+/g, ''));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}
