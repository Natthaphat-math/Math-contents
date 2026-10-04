// Tap, hold and drag on one element, for mouse and touch.
//   tap   quick press and release
//   hold  press without moving (inspect)
//   drag  mouse: press and move; touch: press briefly, then move
// On touch a quick swipe still scrolls the hand; the card only lifts for a
// drag after the finger rests on it for a moment.
const ARM_MS = 170, HOLD_MS = 520, SLOP = 7;

export function gesture(el, { tap, hold, drag }) {
  el.addEventListener('click', (e) => { if (e.detail === 0) tap?.(e); }); // keyboard
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const touch = e.pointerType !== 'mouse';
    const x0 = e.clientX, y0 = e.clientY;
    let state = touch ? 'pending' : 'armed';
    let session = null;

    const armTimer = touch ? setTimeout(() => {
      if (state === 'pending') { state = 'armed'; if (drag) el.classList.add('lift'); }
    }, ARM_MS) : null;
    const holdTimer = setTimeout(() => {
      if (state === 'pending' || state === 'armed') { state = 'held'; cleanup(); hold?.(); }
    }, HOLD_MS);

    const move = (ev) => {
      const dist = Math.hypot(ev.clientX - x0, ev.clientY - y0);
      if (state === 'pending' && dist > SLOP) { state = 'scroll'; cleanup(); return; }
      if (state === 'armed' && dist > SLOP && drag) {
        state = 'drag'; clearTimeout(holdTimer); el.classList.remove('lift');
        session = drag(ev);
      }
      if (state === 'drag') session?.move(ev);
    };
    const up = (ev) => {
      if (state === 'drag') session?.end(ev);
      else if (state === 'pending' || state === 'armed') tap?.(ev);
      state = 'done'; cleanup();
    };
    const cancel = () => { if (state === 'drag') session?.cancel(); state = 'done'; cleanup(); };
    const blockScroll = (ev) => { if (state === 'armed' || state === 'drag') ev.preventDefault(); };

    function cleanup() {
      clearTimeout(armTimer); clearTimeout(holdTimer);
      el.classList.remove('lift');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      el.removeEventListener('touchmove', blockScroll);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    el.addEventListener('touchmove', blockScroll, { passive: false });
  });
}
