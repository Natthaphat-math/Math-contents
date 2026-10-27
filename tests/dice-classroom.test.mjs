#!/usr/bin/env node
// Tests for M4-6/dice-classroom.html: runs the page's own core script (no DOM)
// and checks the theoretical counts, unbiased dice and 10,000-roll simulations.
// Run: node tests/dice-classroom.test.mjs
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';

const html = readFileSync(new URL('../M4-6/dice-classroom.html', import.meta.url), 'utf8');
const core = html.match(/<script id="dice-core">([\s\S]*?)<\/script>/);
if (!core) {
  console.error('✗ ไม่พบ <script id="dice-core"> ในหน้าเว็บ');
  process.exit(1);
}

const ctx = vm.createContext({ crypto: webcrypto, Uint8Array, Float64Array, Int32Array, Math });
vm.runInContext(core[1], ctx);
const C = ctx.DiceCore;

const results = C.selfTest();

function check(name, pass, detail = '') {
  results.push({ name, pass: !!pass, detail });
}

// Payout spot checks (independent of the enumeration).
check('เต็งเลข 2 ออก 2-2-5 ได้ 2', C.payout({ type: 'tang', num: 2 }, [2, 2, 5]) === 2);
check('เต็งเลข 6 ออก 1-2-3 เสีย 1', C.payout({ type: 'tang', num: 6 }, [1, 2, 3]) === -1);
check('สูง ออก 4-4-4 (ตอง ผลรวม 12) เสีย 1', C.payout({ type: 'high' }, [4, 4, 4]) === -1);
check('ต่ำ ออก 3-3-3 (ตอง ผลรวม 9) เสีย 1', C.payout({ type: 'low' }, [3, 3, 3]) === -1);
check('สูง ออก 5-6-6 (ผลรวม 17) ได้ 1', C.payout({ type: 'high' }, [5, 6, 6]) === 1);
check('ต่ำ ออก 1-4-5 (ผลรวม 10) ได้ 1', C.payout({ type: 'low' }, [1, 4, 5]) === 1);
check('สูง ออก 1-4-5 (ผลรวม 10) เสีย 1', C.payout({ type: 'high' }, [1, 4, 5]) === -1);

// The rejection sampler must skip bytes 252..255 and keep reading.
const seq = [255, 252, 253, 254, 5, 0, 251];
let i = 0;
const fake = () => seq[i++];
check('ทิ้งไบต์ 252–255 แล้วสุ่มใหม่', C.rollDie(fake) === 6 && C.rollDie(fake) === 1 && C.rollDie(fake) === 6);

// Static safety checks on the page source.
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
check('ไม่ใช้ innerHTML / outerHTML / insertAdjacentHTML / document.write',
  !/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(scripts));
check('ไม่ส่งข้อมูลออก (ไม่มี fetch / XMLHttpRequest / sendBeacon / WebSocket)',
  !/\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(scripts));
check('ไม่เก็บข้อมูลในเครื่อง (ไม่มี localStorage / sessionStorage / indexedDB / cookie)',
  !/localStorage|sessionStorage|indexedDB|document\.cookie/.test(scripts));
check('ไม่โหลดไฟล์ภายนอก (ไม่มี CDN / ฟอนต์ออนไลน์)',
  !/<script[^>]+src=|<link[^>]+href=["']https?:|@import|url\(\s*["']?https?:/i.test(html));
check('ไม่ใช้ Math.random', !/Math\.random/.test(scripts));
check('ไม่มีสัญลักษณ์เงิน', !/[$฿€£¥]/.test(html.replace(/<script[\s\S]*?<\/script>/g, '')));

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? '✓' : '✗'} ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
}
console.log(`\nผ่าน ${results.length - failed} / ${results.length}`);
process.exit(failed ? 1 : 0);
