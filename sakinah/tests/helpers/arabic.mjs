/**
 * أدوات تطبيع النص العربي للمقارنة في الاختبارات.
 * تُزيل التشكيل والتطويل وعلامات الترقيم وتوحّد بعض الحروف، ثم تضغط المسافات.
 */
const TASHKEEL = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const FORMAT = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\u061C]/g;
const PUNCT = /[،؛؟٪-٭۔«»()\[\]{}"'“”‘’،؛؟:.,!?\-–—_*\/\\|~^`ـ]/g;

export function normalizeArabic(s) {
  if (!s) return '';
  return s
    .replace(FORMAT, '')
    .replace(/صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ|صلى الله عليه وسلم|صلى الله عليه و سلم|ﷺ/g, ' ﷺ ')
    .replace(TASHKEEL, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ﻻ/g, 'لا')
    .replace(PUNCT, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** هل النص `needle` موجود حرفيًا (بعد التطبيع) داخل `haystack`؟ */
export function containsNormalized(haystack, needle) {
  return normalizeArabic(haystack).includes(normalizeArabic(needle));
}

/** أطول بادئة مشتركة (بعد التطبيع) — تفيد في تشخيص أين يبدأ الاختلاف */
export function firstMismatch(haystack, needle) {
  const h = normalizeArabic(haystack), n = normalizeArabic(needle);
  if (h.includes(n)) return -1;
  // ابحث عن أطول بادئة من n موجودة في h
  let lo = 0, hi = n.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (h.includes(n.slice(0, mid))) lo = mid; else hi = mid - 1; }
  return lo;
}
