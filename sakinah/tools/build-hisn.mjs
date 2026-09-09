/**
 * يولّد js/data/hisn.js — كتاب «حصن المسلم» كاملًا (132 بابًا، 267 ذكرًا) من البيانات الرسمية لموقع الكتاب
 * (hisnmuslim.com/api/ar/{1..132}.json) المحفوظة في tests/fixtures/hisn_all.json.
 * التنظيف: إزالة أقواس التنصيص (( )) و( ) المحيطة بالذكر، وتصحيح عناوين وردت بحروف عرض أو أخطاء طباعية؛ لا يُغيَّر حرف من الذكر نفسه
 * (يتحقق tests/data/hisn.test.mjs من تطابق الكلمات مع المصدر). التشغيل: node tools/build-hisn.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const src = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/hisn_all.json'), 'utf8'));

// عناوين المصدر التي تحتاج تصحيحًا (أخطاء طباعية: الآذان، مترلا؛ أو تشكيل شاذ؛ أو مسافات)
const TITLE_FIX = {
  2: 'دعاء لبس الثوب', 3: 'دعاء لبس الثوب الجديد', 15: 'أذكار الأذان',
  46: 'الدعاء حينما يقع ما لا يرضاه أو غُلب على أمره', 104: 'الدعاء إذا نزل منزلًا في سفر أو غيره',
  110: 'الدعاء عند سماع صياح الديك ونهيق الحمار', 115: 'كيف يلبي المحرم في الحج أو العمرة؟',
};
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
export const SECTIONS = [
  { title: 'الاستيقاظ واللباس والطهارة', chapters: range(1, 9) },
  { title: 'المنزل والمسجد', chapters: range(10, 14) },
  { title: 'الأذان والصلاة', chapters: range(15, 26) },
  { title: 'الصباح والمساء والنوم', chapters: range(27, 33) },
  { title: 'الهموم والكروب والخوف', chapters: range(34, 46) },
  { title: 'الأهل والمرض والموت', chapters: range(47, 60) },
  { title: 'الطبيعة والطعام والصيام', chapters: range(61, 76) },
  { title: 'الآداب والمعاملات', chapters: range(77, 94) },
  { title: 'السفر والركوب', chapters: range(95, 105) },
  { title: 'مناسبات وأحوال متفرقة', chapters: [...range(106, 114), ...range(122, 128)] },
  { title: 'الحج والعمرة', chapters: range(115, 121) },
  { title: 'الاستغفار والتسبيح وجوامع الخير', chapters: range(129, 132) },
];

function cleanTitle(id, t) {
  if (TITLE_FIX[id]) return TITLE_FIX[id];
  return t.normalize('NFKC')            // حروف العرض (ﺗﻬنئة، اﻟﻤﺠلس) → حروف عادية
    .replace(/ و (?=\S)/g, ' و')         // «العدو و ذي» → «العدو وذي»
    .replace(/\s+/g, ' ').trim();
}
function cleanText(t) {
  let s = String(t).replace(/\s+/g, ' ').trim();
  s = s.replace(/\(\(\s*/g, '').replace(/\s*\)\)/g, '');            // أقواس التنصيص المزدوجة
  if (/^\(\s/.test(s) && /\s\)\.?$/.test(s)) s = s.replace(/^\(\s*/, '').replace(/\s*\)(\.?)$/, '$1'); // ( … ) حول الذكر كله
  return s.replace(/\s+([،.؛])/g, '$1').replace(/\s+/g, ' ').trim();
}

const chapters = src.map((c) => ({
  id: c.id, title: cleanTitle(c.id, c.title),
  items: c.items.map((it) => {
    const audio = !!it.audio && it.audio.endsWith(`/audio/ar/${it.id}.mp3`); // الذكر 153 بلا تسجيل في المصدر
    return { id: it.id, text: cleanText(it.text), repeat: Number(it.repeat) || 1, ...(audio ? {} : { audio: false }) };
  }),
}));
const covered = SECTIONS.flatMap((s) => s.chapters);
if (new Set(covered).size !== chapters.length || covered.length !== chapters.length) throw new Error('الأقسام لا تغطي الأبواب مرة واحدة بالضبط');

const out = `/**
 * حصن المسلم من أذكار الكتاب والسنة — الشيخ سعيد بن علي بن وهف القحطاني: الكتاب كاملًا (${chapters.length} بابًا، ${chapters.reduce((n, c) => n + c.items.length, 0)} ذكرًا).
 * النصوص من البيانات الرسمية لموقع الكتاب hisnmuslim.com (واجهة api/ar) بتشكيلها، بلا أقواس التنصيص المحيطة بالذكر.
 * يُولَّد هذا الملف بـ tools/build-hisn.mjs ولا يُحرَّر يدويًا؛ التحقق في tests/data/hisn.test.mjs.
 * الصوت (اختياري، عند الطلب): تلاوة الذكر من الموقع نفسه — hisnAudioUrl(id).
 */
export const HISN_SECTIONS = ${JSON.stringify(SECTIONS)};
export const HISN_CHAPTERS = ${JSON.stringify(chapters)};
export const hisnAudioUrl = (id) => \`https://www.hisnmuslim.com/audio/ar/\${id}.mp3\`;
export function hisnChapter(id) { return HISN_CHAPTERS.find((c) => c.id === Number(id)) || null; }
export function hisnItem(id) { for (const c of HISN_CHAPTERS) { const it = c.items.find((x) => x.id === Number(id)); if (it) return { ...it, chapter: c }; } return null; }
`;
fs.writeFileSync(path.join(root, 'js/data/hisn.js'), out);
console.log(`js/data/hisn.js: ${chapters.length} بابًا، ${chapters.reduce((n, c) => n + c.items.length, 0)} ذكرًا، ${(out.length / 1024).toFixed(0)} KB`);
