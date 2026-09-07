/**
 * نواة المصحف: تحميل النص، الفهارس (سورة/صفحة/جزء)، تطبيع النص للمطابقة، تجزئة الكلمات،
 * ومُطابِق تسلسلي متسامح لوضع مراجعة الحفظ (يقارن الكلمات المنطوقة بالكلمات المتوقعة).
 * النص: Tanzil (الرسم العثماني، حفص عن عاصم). الصفحات: مصحف المدينة النبوية (604 صفحات).
 */
import { SURAHS, JUZ_STARTS, TOTAL_PAGES, TOTAL_AYAHS, BASMALA } from '../data/quran-meta.js';
export { SURAHS, JUZ_STARTS, TOTAL_PAGES, TOTAL_AYAHS, BASMALA };

let quran = null; let loading = null;
const byPage = new Map(); const bySurah = new Map();

/** تحميل النص (مرة واحدة). في النسخة أحادية الملف يكون مضمّنًا في window.SAKINAH_QURAN */
export async function loadQuran(url = 'data/quran.json') {
  if (quran) return quran;
  if (loading) return loading;
  loading = (async () => {
    let raw;
    if (typeof window !== 'undefined' && window.SAKINAH_QURAN) raw = window.SAKINAH_QURAN;
    else { const res = await fetch(url); if (!res.ok) throw new Error('quran load failed ' + res.status); raw = await res.json(); }
    setQuranData(raw);
    return quran;
  })();
  return loading;
}
/** إدخال البيانات مباشرة (للاختبارات والنسخة المضمّنة) */
export function setQuranData(raw) {
  const sajda = new Set(raw.sajda || []);
  quran = { edition: raw.edition, ayahs: raw.ayahs.map((r, i) => ({ n: i + 1, surah: r[0], ayah: r[1], page: r[2], juz: r[3], hizbQuarter: r[4], text: r[5], sajda: sajda.has(i + 1) })) };
  byPage.clear(); bySurah.clear();
  for (const a of quran.ayahs) {
    if (!byPage.has(a.page)) byPage.set(a.page, []); byPage.get(a.page).push(a);
    if (!bySurah.has(a.surah)) bySurah.set(a.surah, []); bySurah.get(a.surah).push(a);
  }
  return quran;
}
export function isLoaded() { return !!quran; }
export function getAyah(n) { return quran ? quran.ayahs[n - 1] : null; }
export function getAyahBySurah(surah, ayah) { const list = bySurah.get(surah); return list ? list[ayah - 1] : null; }
export function pageAyahs(page) { return byPage.get(page) || []; }
export function surahAyahs(surah) { return bySurah.get(surah) || []; }
export function surahInfo(surah) { return SURAHS[surah - 1]; }
export function pageOf(surah, ayah) { const a = getAyahBySurah(surah, ayah); return a ? a.page : null; }
export function juzOfPage(page) { const list = byPage.get(page); return list && list.length ? list[0].juz : null; }
/** السور التي تبدأ في هذه الصفحة (لعرض ترويستها) */
export function surahsStartingOn(page) { return pageAyahs(page).filter((a) => a.ayah === 1).map((a) => a.surah); }
/** الجزء والحزب والربع لصفحة (للعنوان) */
export function pageLabel(page) {
  const list = pageAyahs(page); if (!list.length) return { juz: null, hizb: null, quarter: null };
  const hq = list[0].hizbQuarter; return { juz: list[0].juz, hizb: Math.ceil(hq / 4), quarter: ((hq - 1) % 4) + 1 };
}

/** تطبيع نص عثماني/إملائي إلى صورة مقارنة بسيطة: بلا تشكيل، بلا ألف خنجرية أو وصل، توحيد الهمزات والتاء المربوطة والألف المقصورة */
export function normalizeForMatch(s) {
  return String(s || '')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]|[\uFEFF\u200E\u200F\u06E5\u06E6]/g, '')
    .replace(/[ٱأإآ]/g, 'ا').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^ء-ي٠-٩\s]/g, '')
    .replace(/\s+/g, ' ').trim();
}
/** تجزئة آية إلى كلمات؛ الرموز المنفردة (علامات الوقف) تبقى للعرض لكنها ليست كلمات تُنطق */
export function tokenize(text) {
  return text.split(' ').filter(Boolean).map((t) => ({ raw: t, norm: normalizeForMatch(t), spoken: /[ء-ي]/.test(normalizeForMatch(t)) }));
}

/** مسافة ليفنشتاين (للمطابقة المتسامحة) */
export function levenshtein(a, b) {
  if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
export function similarity(a, b) { const m = Math.max(a.length, b.length); return m ? 1 - levenshtein(a, b) / m : 1; }

/**
 * مُطابِق الحفظ: يتتبع موضع الكلمة المتوقعة داخل قائمة كلمات (كلمات عدة آيات متتالية).
 * يقبل الكلمة إن طابقت المتوقعة (تشابه ≥ threshold) أو إحدى الكلمتين التاليتين (تخطي كلمة أو كلمتين)،
 * ويتجاهل الكلمات غير المطابقة (تكرار، تلعثم) بدل أن يتعطل.
 */
export class HifzMatcher {
  constructor(words, { threshold = 0.66, lookahead = 2 } = {}) {
    this.words = words; // [{norm, ...}] الكلمات المنطوقة فقط
    this.pos = 0; this.threshold = threshold; this.lookahead = lookahead;
    this.matched = 0; this.skipped = 0; this.unmatched = 0;
  }
  /** يعالج نصًا منطوقًا (كلمة أو أكثر) ويعيد قائمة فهارس الكلمات التي كُشفت الآن */
  feed(transcript) {
    const spoken = normalizeForMatch(transcript).split(' ').filter(Boolean);
    const revealed = [];
    for (const w of spoken) {
      if (this.pos >= this.words.length) break;
      let hit = -1;
      for (let k = 0; k <= this.lookahead && this.pos + k < this.words.length; k++) {
        const exp = this.words[this.pos + k].norm;
        if (exp === w || similarity(exp, w) >= this.threshold || (w.length >= 4 && exp.length >= 4 && (exp.startsWith(w) || w.startsWith(exp)))) { hit = k; break; }
      }
      if (hit < 0) { this.unmatched++; continue; }
      for (let k = 0; k < hit; k++) revealed.push(this.pos + k); // كلمات متخطّاة تُكشف أيضًا
      this.skipped += hit;
      revealed.push(this.pos + hit); this.matched++;
      this.pos += hit + 1;
    }
    return revealed;
  }
  /** كشف الكلمة التالية يدويًا (تلميح) */
  hint() { if (this.pos >= this.words.length) return null; return this.pos++; }
  get done() { return this.pos >= this.words.length; }
  get progress() { return this.words.length ? this.pos / this.words.length : 1; }
}

/** بحث نصي بسيط (بلا تشكيل) — يعيد حتى limit نتيجة */
export function searchText(q, limit = 50) {
  if (!quran) return [];
  const needle = normalizeForMatch(q); if (needle.length < 2) return [];
  const out = [];
  for (const a of quran.ayahs) { if (normalizeForMatch(a.text).includes(needle)) { out.push(a); if (out.length >= limit) break; } }
  return out;
}

/** تحويل رقم آية عالمي إلى نص مرجعي "البقرة: 255" */
export function refLabel(a) { return `${surahInfo(a.surah).name}: ${a.ayah}`; }

/** رقم الآية بالأرقام العربية المشرقية داخل علامة نهاية الآية */
export function ayahMarker(n, numerals = 'arab') {
  const s = String(n); return numerals === 'arab' ? s.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]) : s;
}
