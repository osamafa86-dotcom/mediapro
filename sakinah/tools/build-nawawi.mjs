/**
 * يولّد js/data/nawawi.js — الأربعون النووية (42 حديثًا) من نسختين مستقلتين مأخوذتين من sunnah.com:
 * - tests/fixtures/nawawi40-ara.json (fawazahmed0/hadith-api، الطبعة ara-nawawi): المتن مع التخريج كاملًا وأرقام الحديث في الصحيحين.
 * - tests/fixtures/nawawi40.json (AhmedBaset/hadith-json): تُستخدم للمقارنة الآلية للمتن كلمةً كلمة (tests/data/nawawi.test.mjs).
 * التشغيل: node tools/build-nawawi.mjs — يطبع تقرير المطابقة ويفشل إن اختلف متن.
 */
import fs from 'node:fs';
import path from 'node:path';
import { normalizeArabic } from '../js/core/arabic.js';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const A = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/nawawi40-ara.json'), 'utf8')).hadiths;
const B = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/nawawi40.json'), 'utf8')).hadiths;

const MARK = /(رَوَاهُ|رَوَيْنَاهُ|حَدِيثٌ حَسَنٌ|حديث حسن|مُتَّفَقٌ عَلَيْهِ)/;
/** يفصل المتن عن التخريج: التخريج يبدأ من أول علامة تخريج بعد نهاية القول المنقول */
export function splitHadith(raw) {
  const parts = String(raw).replace(/\s+/g, ' ').split('<br>').map((s) => s.trim()).filter(Boolean);
  let main = parts[0]; let takhrij = '';
  const m = main.match(MARK);
  if (m) { takhrij = main.slice(m.index).trim(); main = main.slice(0, m.index).trim(); }
  const extra = parts.slice(1).map((p) => p.replace(/[\[\]]/g, '').replace(/\s+/g, ' ').trim()).filter((p) => p && !/^[،,.\s]+$/.test(p));
  if (!takhrij && extra.length) takhrij = extra.join(' ');
  let variant = '';
  const v = takhrij.match(/و[\u064B-\u0652]?ف[\u064B-\u0652]?ي\s+ر[\u064B-\u0652]?و[\u064B-\u0652]?ا[\u064B-\u0652]?ي[\u064B-\u0652]?ة/); // «وفي رواية لمسلم/غير الترمذي: …» جزء من الحديث لا من التخريج
  if (v) { variant = takhrij.slice(v.index).trim(); takhrij = takhrij.slice(0, v.index).trim(); }
  takhrij = takhrij.replace(/\[رقم:\s*(\d+)\]/g, '(رقم $1)').replace(/\s+([،.])/g, '$1').replace(/[\[\]]/g, '').replace(/"([^"]+)"/g, '«$1»').replace(/\s+([،.])/g, '$1').replace(/^[،,\s]+/, '').replace(/[،,\s]+$/, '').trim();
  main = (main + (variant ? '\n' + variant : '')).replace(/\[\s*([^\]]*?)\s*\]/g, (m, inner) => (/^(\d|رقم)/.test(inner) ? ' ' : ' ' + inner + ' ')).replace(/[ \t]+([،.؛:])/g, '$1').replace(/[ \t]*"[ \t]*/g, '"').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
  // علامات التنصيص الغربية حول القول → أقواس تنصيص عربية «»
  main = main.replace(/[\[\]]/g, ' ').replace(/[ \t]+([،.؛:»])/g, '$1').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim(); // قوس افتُتح قبل التخريج
  let open = true; main = main.replace(/"/g, () => { const r = open ? '«' : '»'; open = !open; return r; });
  takhrij = takhrij.replace(/،(?=\S)/g, '، ');
  let tq = true; takhrij = takhrij.replace(/"/g, () => { const r = tq ? '«' : '»'; tq = !tq; return r; }); if (!tq) takhrij = takhrij.replace(/«([^»]*)$/, '$1');
  return { text: main, takhrij };
}
const ORD = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
export function ordinal(n) {
  if (n <= 10) return ORD[n - 1];
  if (n < 20) return n === 11 ? 'الحادي عشر' : `${ORD[n - 11]} عشر`;
  const tens = { 2: 'العشرون', 3: 'الثلاثون', 4: 'الأربعون' }[Math.floor(n / 10)]; const u = n % 10;
  return u === 0 ? tens : `${u === 1 ? 'الحادي' : ORD[u - 1]} و${tens}`;
}

// كلمات أسقطتها النسخة الثانية لأنها كانت روابط في صفحة المصدر (موثّقة بعد المراجعة اليدوية للمتن الكامل)
export const KNOWN_GAPS = {
  14: 'أسقطت «يَشْهَدُ أَنْ لَا إلَهَ إلَّا اللَّهُ وَأَنِّي رَسُولُ اللَّهِ»',
  19: 'أسقطت الرواية الثانية «وفي رواية غير الترمذي: احفظ الله تجده أمامك…» المطبوعة في الأربعين',
};
export function main() {
const rows = []; const report = []; const gaps = [];
for (const h of A.slice().sort((a, b) => a.hadithnumber - b.hadithnumber)) {
  const n = Number(h.hadithnumber); const { text, takhrij } = splitHadith(h.text);
  if (!takhrij) throw new Error(`لا تخريج للحديث ${n}`);
  const b = B.find((x) => x.idInBook === n);
  const bLines = b.arabic.split('\n').map((s) => s.trim()).filter((s) => s && !/^[،,.\s]+$/.test(s));
  const bMatn = []; for (const l of bLines) { const mm = l.match(MARK); if (/^بهذا اللفظ|^، ، في/.test(l)) break; if (mm) { const lead = l.slice(0, mm.index).trim(); if (lead.split(/\s+/).filter(Boolean).length > 2) bMatn.push(lead); break; } bMatn.push(l); }
  const wa = normalizeArabic(text).split(' '), wb = normalizeArabic(bMatn.join(' ')).split(' ');
  let i = 0; for (const w of wb) { while (i < wa.length && wa[i] !== w) i++; if (i >= wa.length) { report.push(`${n}: كلمة «${w}» في النسخة الثانية ليست في المتن`); break; } i++; }
  if (wb.length !== wa.length) { if (KNOWN_GAPS[n]) gaps.push(`${n}: ${wa.length - wb.length} كلمة (${KNOWN_GAPS[n]})`); else report.push(`${n}: النسخة الثانية ${wb.length} كلمة مقابل ${wa.length} — فرق غير موثّق: «${wa.filter((w) => !wb.includes(w)).slice(0, 6).join(' ')}»`); }
  rows.push({ n, title: `الحديث ${ordinal(n)}`, text, takhrij });
}
if (report.length) { console.error('اختلافات المتن بين النسختين:\n' + report.join('\n')); process.exit(1); }

const out = `/**
 * الأربعون النووية للإمام يحيى بن شرف النووي (42 حديثًا بزيادتي ابن رجب).
 * المتن والتخريج من نسخة sunnah.com (عبر fawazahmed0/hadith-api)، وقد قورن المتن كلمةً كلمة آليًا مع نسخة ثانية مستقلة (AhmedBaset/hadith-json).
 * يُولَّد هذا الملف بـ tools/build-nawawi.mjs ولا يُحرَّر يدويًا؛ التحقق في tests/data/nawawi.test.mjs.
 */
export const NAWAWI = ${JSON.stringify(rows)};
export function nawawiHadith(n) { return NAWAWI[n - 1] || null; }
`;
fs.writeFileSync(path.join(root, 'js/data/nawawi.js'), out);
console.log(`js/data/nawawi.js: ${rows.length} حديثًا، ${(out.length / 1024).toFixed(0)} KB — المتون مطابقة للنسخة الثانية${gaps.length ? ` (فجوات موثّقة: ${gaps.join('؛ ')})` : ''}`);
}
if (process.argv[1] && import.meta.url === new URL('file://' + path.resolve(process.argv[1])).href) main();
