/**
 * يولّد data/tajweed.json — أحكام التجويد الملوّنة لكل آية (مواضع حروف داخل نصنا) من طبعة «القرآن المجوّد» في alquran.cloud
 * (quran-tajweed: نص بعلامات [رمز:رقم[حروف]). نص الطبعة يختلف عن نص Tanzil لدينا في ترميز بعض العلامات (ٲ بدل الألف الخنجرية،
 * تطويل قبل الألف الخنجرية، فواصل عرض)، فنُطابق على مستوى الحروف (لا العلامات): تسلسل الحروف واحد في الآيتين، ثم نُسقط كل حكم
 * على حروفه في نصنا مع علاماتها. الناتج مضغوط: لكل آية سلسلة "بداية,طول,رمز;…" بمواضع أحرف نصنا.
 * التشغيل: node tools/build-tajweed.mjs [ملف JSON محلي للطبعة | يُجلب من الشبكة]
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
export const RULES = {
  h: 'همزة وصل', s: 'حرف ساكن لا يُنطق', l: 'لام شمسية', n: 'مدّ طبيعي (حركتان)', p: 'مدّ جائز (٢–٤–٦)', m: 'مدّ لازم (٦ حركات)', o: 'مدّ واجب متصل (٤–٥)',
  q: 'قلقلة', g: 'غنّة (حركتان)', f: 'إخفاء', c: 'إخفاء شفوي', i: 'إقلاب', a: 'إدغام بغنّة', u: 'إدغام بلا غنّة', w: 'إدغام شفوي', d: 'إدغام متجانسين', b: 'إدغام متقاربين',
};
const isLetter = (ch) => /[\u0621-\u064A\u0671\u066E]/.test(ch) && ch !== '\u0640'; // الحروف (مع ألف الوصل) دون التطويل؛ ٲ (U+0672) في الطبعة تقابل الألف الخنجرية عندنا فتُعدّ علامة
const canon = (ch) => ch.replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627').replace(/[\u0624\u0626]/g, '\u0621').replace(/\u066E/g, '\u0649'); // ٮ (U+066E) في الطبعة حامل للألف الخنجرية مكان ى عندنا // للمطابقة فقط: الطبعة تكتب بعض الهمزات على كرسي مختلف
const isMark = (ch) => !isLetter(ch) && ch !== ' ';

/** يفكّ علامات الطبعة: يعيد النص الخام وقائمة الأحكام [بداية, نهاية) بمواضع ذلك النص */
export function parseTajweed(raw) {
  let text = ''; const spans = []; const stack = [];
  for (let p = 0; p < raw.length; p++) {
    const c = raw[p];
    if (c === '[') { const m = raw.slice(p).match(/^\[([a-z]+)(?::\d+)?\[/); if (m) { stack.push({ code: m[1], start: text.length }); p += m[0].length - 1; continue; } }
    if (c === ']' && stack.length) { const s = stack.pop(); spans.push([s.start, text.length, s.code]); continue; }
    text += c;
  }
  return { text, spans };
}
/** الحروف مع مواضعها ومدى علاماتها اللاحقة في نص */
function letterMap(text) {
  const out = []; // { i: موضع الحرف, end: نهاية علاماته اللاحقة }
  for (let i = 0; i < text.length; i++) { if (!isLetter(text[i])) continue; let e = i + 1; while (e < text.length && isMark(text[e])) e++; out.push({ i, end: e }); }
  return out;
}
/**
 * يُسقط أحكام نص الطبعة على نصنا. لكل حكم: الحروف التي يغطيها → المدى نفسه في نصنا (حروفًا وعلاماتها)؛
 * والحكم الذي يغطي علامات فقط (كألف خنجرية) يُلحق بعلامات الحرف السابق المطابقة.
 */
export function projectSpans(apiText, spans, ourText) {
  const A = letterMap(apiText), O = letterMap(ourText);
  // لكل حرف في الطبعة مداه عندنا (قد يغطي حرفين: أ ↔ ءا)
  const M = []; let j = 0;
  for (let k = 0; k < A.length; k++) {
    if (j >= O.length) return null;
    const a = canon(apiText[A[k].i]), o = canon(ourText[O[j].i]);
    if (a === o) { M.push({ i: O[j].i, end: O[j].end }); j++; continue; }
    if (a === '\u0627' && o === '\u0621' && j + 1 < O.length && canon(ourText[O[j + 1].i]) === '\u0627') { M.push({ i: O[j].i, end: O[j + 1].end }); j += 2; continue; }
    // نكتب ألفًا مقصورة حاملةً للألف الخنجرية (مِيكَىٰلَ) حيث تكتب الطبعة تطويلًا: الحرف الزائد عندنا يُلحق بمدى الحرف السابق
    if (o === '\u0649' && ourText[O[j].i + 1] === '\u0670' && M.length) { M[M.length - 1].end = O[j].end; j++; k--; continue; }
    return null;
  }
  if (j !== O.length) return null;
  const letterIndexAt = (pos) => { let lo = 0, hi = A.length - 1, ans = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (A[mid].i <= pos) { ans = mid; lo = mid + 1; } else hi = mid - 1; } return ans; };
  const out = [];
  for (const [s, e, code] of spans) {
    if (e <= s) continue;
    const covered = []; for (let k = 0; k < A.length; k++) { if (A[k].i >= s && A[k].i < e) covered.push(k); if (A[k].i >= e) break; }
    if (covered.length) { const a = M[covered[0]].i, b = M[covered[covered.length - 1]].end; out.push([a, b - a, code]); continue; }
    const prev = letterIndexAt(s); if (prev < 0) continue; // علامات فقط: تُلحق بعلامات الحرف السابق
    const marks = apiText.slice(s, e).replace(/[ٲـ‌‍]/g, 'ٰ');
    const cluster = ourText.slice(M[prev].i + 1, M[prev].end); let from = -1, to = -1;
    for (let j = 0; j < cluster.length; j++) if (marks.includes(cluster[j])) { if (from < 0) from = j; to = j + 1; }
    if (from >= 0) out.push([M[prev].i + 1 + from, to - from, code]);
  }
  out.sort((x, y) => x[0] - y[0]);
  return out;
}
export function encode(spans) { return spans.map(([s, l, c]) => `${s},${l},${c}`).join(';'); }
export function decode(str) { return str ? str.split(';').map((x) => { const [s, l, c] = x.split(','); return [+s, +l, c]; }) : []; }

export async function main(src) {
  let json;
  if (src && fs.existsSync(src)) json = JSON.parse(fs.readFileSync(src, 'utf8'));
  else { const r = await fetch('https://api.alquran.cloud/v1/quran/quran-tajweed'); if (!r.ok) throw new Error('fetch ' + r.status); json = await r.json(); }
  const ours = JSON.parse(fs.readFileSync(path.join(root, 'data/quran.json'), 'utf8')).ayahs;
  const api = []; for (const s of json.data.surahs) for (const a of s.ayahs) api.push(a.text);
  if (api.length !== ours.length) throw new Error('عدد الآيات مختلف');
  const out = {}; let unmatched = 0, total = 0; const codes = {};
  for (let i = 0; i < api.length; i++) {
    const { text, spans } = parseTajweed(api[i].replace(/آ/g, 'ءا')); // الطبعة تكتب آ حيث نكتب ءا (كما في Tanzil)
    const proj = projectSpans(text, spans, ours[i][5]);
    if (!proj) { unmatched++; continue; }
    for (const [, , c] of proj) { codes[c] = (codes[c] || 0) + 1; if (!RULES[c]) throw new Error('رمز غير معروف ' + c); }
    total += proj.length; if (proj.length) out[i + 1] = encode(proj);
  }
  const data = { v: 1, source: 'alquran.cloud quran-tajweed', rules: RULES, ayahs: out };
  fs.writeFileSync(path.join(root, 'data/tajweed.json'), JSON.stringify(data));
  console.log(`data/tajweed.json: ${Object.keys(out).length} آية بأحكام، ${total} حكمًا، ${unmatched} آية لم تُطابق حروفها، ${(fs.statSync(path.join(root, 'data/tajweed.json')).size / 1024).toFixed(0)} KB`);
  console.log('الأحكام:', JSON.stringify(codes));
  return { unmatched, total };
}
if (process.argv[1] && import.meta.url === new URL('file://' + path.resolve(process.argv[1])).href) main(process.argv[2]);
