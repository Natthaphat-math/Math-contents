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

// Class results: text form of a game, and the same pattern in the Firestore rules.
const sample = [
  { bet: { type: 'tang', num: 3 }, dice: [3, 1, 3] },
  { bet: { type: 'high' }, dice: [6, 5, 4] },
  { bet: { type: 'low' }, dice: [1, 1, 1] }
];
const enc = C.encodeRounds(sample);
check('เข้ารหัสผลเกม: t3313,h654,l111', enc === 't3313,h654,l111', enc);
check('ถอดรหัสแล้วได้ผลเดิม', JSON.stringify(C.decodeRounds(enc)) === JSON.stringify(sample));
const twenty = Array(20).fill('h123').join(',');
check('รับได้ 20 รอบพอดี (ยาว ' + twenty.replace(/h/g, 't1').length + ' ตัวอักษร ≤ 119)',
  C.decodeRounds(twenty) !== null && Array(20).fill('t1123').join(',').length <= 119);
const bad = [twenty + ',h123', 'h127', 't7123', 'x123', '', 'h123,', '<img src=x onerror=alert(1)>', 'h123\nh123', null, 42];
check('ปฏิเสธข้อมูลผิดรูปแบบ (21 รอบ, เลข 7, HTML, ค่าว่าง, ไม่ใช่ข้อความ)',
  bad.every((x) => C.decodeRounds(x) === null));

const rules = readFileSync(new URL('../M4-6/dice-classroom.firestore.rules', import.meta.url), 'utf8');
check('กฎ Firestore ใช้รูปแบบ rounds เดียวกับหน้าเว็บ', rules.includes(`matches('${C.ROUNDS_PATTERN}')`));
check('กฎ Firestore จำกัดกลุ่ม 1–' + C.MAX_GROUPS, rules.includes(`d.group <= ${C.MAX_GROUPS}`));
check('กฎ Firestore ใช้ hasOnly + hasAll และเขียนได้เฉพาะเอกสารของตัวเอง',
  /hasOnly\(\['group', 'rounds', 'updatedAt'\]\)/.test(rules) && /hasAll\(/.test(rules) && rules.includes('request.auth.uid == uid'));
check('กฎ Firestore ไม่มีอีเมลจริง (ใช้ TEACHER_EMAIL)', rules.includes("'TEACHER_EMAIL'") && !/@[a-z0-9-]+\./i.test(rules));
check('ไม่มีกฎแบบเปิด (allow ... if true)', !/if\s+true/.test(rules));

// Static safety checks on the page source.
const blocks = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
const scripts = blocks.map((m) => m[2]).join('\n');
const classic = blocks.filter((m) => !/type="module"/.test(m[1])).map((m) => m[2]).join('\n');
const modules = blocks.filter((m) => /type="module"/.test(m[1])).map((m) => m[2]).join('\n');
check('ไม่ใช้ innerHTML / outerHTML / insertAdjacentHTML / document.write',
  !/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(scripts));
check('ตัวเกมไม่ติดต่อเครือข่ายเอง (ไม่มี fetch / XMLHttpRequest / sendBeacon / WebSocket)',
  !/\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(scripts));
check('ไม่เก็บข้อมูลในเครื่อง (ไม่มี localStorage / sessionStorage / indexedDB / cookie)',
  !/localStorage|sessionStorage|indexedDB|document\.cookie/.test(scripts));
const imports = [...modules.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
check('ไฟล์ภายนอกมีแค่ Firebase SDK จาก gstatic (ไม่มี CDN อื่น / ฟอนต์ออนไลน์)',
  imports.length === 3 && imports.every((u) => u.startsWith('https://www.gstatic.com/firebasejs/')) &&
  !/<script[^>]+src=|<link[^>]+href=["']https?:|@import|url\(\s*["']?https?:/i.test(html) &&
  !/https?:\/\//.test(classic));
check('ส่งขึ้น Firestore เฉพาะ group, rounds, updatedAt',
  /setDoc\(doc\(db, COLL, u\.uid\), \{ group, rounds, updatedAt: serverTimestamp\(\) \}\)/.test(modules) &&
  (modules.match(/setDoc\(/g) || []).length === 1);
check('ไม่ใช้ Math.random', !/Math\.random/.test(scripts));
check('ไม่มีสัญลักษณ์เงิน', !/[$฿€£¥]/.test(html.replace(/<script[\s\S]*?<\/script>/g, '')));

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? '✓' : '✗'} ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
}
console.log(`\nผ่าน ${results.length - failed} / ${results.length}`);
process.exit(failed ? 1 : 0);
