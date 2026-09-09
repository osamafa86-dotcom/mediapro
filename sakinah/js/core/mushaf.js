/**
 * نواة تخطيط مصحف المدينة: تحميل data/mushaf-layout.json (مولّد بـ tools/build-mushaf-layout.mjs من بيانات مجمع الملك فهد
 * عبر واجهة quran.com) وفكّ ترميز الأسطر إلى كلمات مع رقم الآية وفهرس الكلمة المنطوقة، وعناوين خطوط الصفحات (QCF v1).
 * دوال نقية بلا DOM كي تُختبر تحت node:test.
 */
import { TOTAL_PAGES } from '../data/quran-meta.js';

let layout = null; let loading = null;

/** قاعدة خطوط الصفحات (KFGQPC QCF v1، مثبّتة على إصدار محدد من مستودع quran.com كي لا تتغير الرموز) */
export const FONT_BASE = 'https://cdn.jsdelivr.net/gh/quran/quran.com-frontend-next@aff1a035b09b66f28047b3216edcae4c5c949a49/public/fonts/quran/';
/** في الغلاف الأصلي (iOS/Android) تُضمَّن الخطوط الـ604 داخل التطبيق (tools/build-www.mjs) فتُعرض الصفحات فورًا ودون اتصال */
export function fontBase() { return (typeof window !== 'undefined' && window.SAKINAH_FONTS_BASE) || FONT_BASE; }
export function fontsBundled() { return typeof window !== 'undefined' && !!window.SAKINAH_FONTS_BASE; }
export const SURAH_NAMES_FONT_URL = FONT_BASE + 'surah-names/v1/sura_names.woff2';
export function surahNamesFontUrl() { return fontBase() + 'surah-names/v1/sura_names.woff2'; }
export function pageFontUrl(p) { return `${fontBase()}hafs/v1/woff2/p${p}.woff2`; }
export function pageFontFamily(p) { return `qcf-p${p}`; }
/** رمز اسم السورة في خط أسماء السور: رقم السورة بثلاث خانات */
export function surahNameGlyph(surah) { return String(surah).padStart(3, '0'); }

/** تحميل التخطيط (مرة واحدة). في النسخة أحادية الملف يكون مضمّنًا في window.SAKINAH_MUSHAF */
export async function loadMushafLayout(url = 'data/mushaf-layout.json') {
  if (layout) return layout;
  if (loading) return loading;
  loading = (async () => {
    let raw;
    if (typeof window !== 'undefined' && window.SAKINAH_MUSHAF) raw = window.SAKINAH_MUSHAF;
    else { const res = await fetch(url); if (!res.ok) throw new Error('mushaf layout load failed ' + res.status); raw = await res.json(); }
    setMushafLayout(raw);
    return layout;
  })().catch((e) => { loading = null; throw e; });
  return loading;
}
export function setMushafLayout(raw) {
  if (!raw || !Array.isArray(raw.pages) || raw.pages.length !== TOTAL_PAGES) throw new Error('bad mushaf layout');
  layout = raw; return layout;
}
export function isMushafLoaded() { return !!layout; }
export function mushafInfo() { return layout ? { font: layout.font, source: layout.source } : null; }

/**
 * أسطر صفحة مفكوكة الترميز:
 *   { type: 'header', surah } | { type: 'basmala' } | { type: 'words', words: [{ glyph, n, k, end, rub, sajda }] }
 *   rub: الكلمة تبدأ بعلامة ربع الحزب ۞ (رمزها الأول)؛ sajda: تنتهي بعلامة السجدة ۩ (رمزها الأخير)
 *   k: فهرس الكلمة بين الكلمات المنطوقة للآية (يطابق tokenize(text).filter(spoken))، أو -1 لرمز لا يقابل كلمة (علامة نهاية الآية أو كلمة بلا مقابل)
 */
export function pageLines(p) {
  if (!layout) throw new Error('mushaf layout not loaded');
  const raw = layout.pages[p - 1]; if (!raw) return [];
  return raw.map((line) => {
    if (line[0] === 1) return { type: 'header', surah: line[1] };
    if (line[0] === 2) return { type: 'basmala' };
    const glyphs = line[1] ? line[1].split('|') : []; const words = []; let gi = 0;
    const rub = new Set(line[3] || []), saj = new Set(line[4] || []);
    for (const [n, k0, cnt, e] of line[2]) {
      for (let j = 0; j < cnt; j++) {
        const isEnd = e === 1 && j === cnt - 1;
        let k = -1;
        if (!isEnd) { const map = layout.maps && layout.maps[n]; k = map ? map[k0 + j] ?? -1 : k0 + j; }
        words.push({ glyph: glyphs[gi], n, k, end: isEnd, rub: rub.has(gi), sajda: saj.has(gi) }); gi++;
      }
    }
    return { type: 'words', words };
  });
}
/** عدد أسطر الصفحة في المصحف المطبوع (الفاتحة وأول البقرة 8 أسطر، وسائر الصفحات 15) */
export function pageLineCount(p) { return p <= 2 ? 8 : 15; }
/** السور التي تظهر ترويستها في هذه الصفحة (قد تكون ترويسة سورة تبدأ كلماتها في الصفحة التالية) */
export function headersOnPage(p) { return pageLines(p).filter((l) => l.type === 'header').map((l) => l.surah); }
/** أرقام الآيات التي تظهر كلماتها في هذه الصفحة بترتيبها */
export function ayahsOnPage(p) {
  const seen = []; for (const l of pageLines(p)) if (l.type === 'words') for (const w of l.words) if (seen[seen.length - 1] !== w.n) seen.push(w.n);
  return seen;
}

const JUZ_ORDINALS = ['الأَوَّلُ', 'الثَّانِي', 'الثَّالِثُ', 'الرَّابِعُ', 'الخَامِسُ', 'السَّادِسُ', 'السَّابِعُ', 'الثَّامِنُ', 'التَّاسِعُ', 'العَاشِرُ',
  'الحَادِيَ عَشَرَ', 'الثَّانِيَ عَشَرَ', 'الثَّالِثَ عَشَرَ', 'الرَّابِعَ عَشَرَ', 'الخَامِسَ عَشَرَ', 'السَّادِسَ عَشَرَ', 'السَّابِعَ عَشَرَ', 'الثَّامِنَ عَشَرَ', 'التَّاسِعَ عَشَرَ', 'العِشْرُونَ',
  'الحَادِي وَالعِشْرُونَ', 'الثَّانِي وَالعِشْرُونَ', 'الثَّالِثُ وَالعِشْرُونَ', 'الرَّابِعُ وَالعِشْرُونَ', 'الخَامِسُ وَالعِشْرُونَ', 'السَّادِسُ وَالعِشْرُونَ', 'السَّابِعُ وَالعِشْرُونَ', 'الثَّامِنُ وَالعِشْرُونَ', 'التَّاسِعُ وَالعِشْرُونَ', 'الثَّلَاثُونَ'];
/** اسم الجزء بالحروف كما يُكتب في رأس صفحات المصحف: «الجُزْءُ السَّادِسُ وَالعِشْرُونَ» */
export function juzName(j, { vocalized = true } = {}) {
  const o = JUZ_ORDINALS[j - 1]; if (!o) return '';
  const s = `الجُزْءُ ${o}`;
  return vocalized ? s : s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
}
