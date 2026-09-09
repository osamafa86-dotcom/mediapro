/**
 * تطبيع النص العربي للبحث والمقارنة (مشترك بين الأحاديث والأذكار والاختبارات):
 * يزيل التشكيل والتطويل وعلامات التنسيق والترقيم، ويوحّد الهمزات والألف المقصورة والتاء المربوطة، ويجعل ﷺ وصيغها المكتوبة شيئًا واحدًا.
 */
const TASHKEEL = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const FORMAT = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\u061C]/g;
const PUNCT = /[،؛؟٪-٭۔«»()\[\]{}"'“”‘’:.,!?\-–—_*\/\\|~^`]/g;
const SALAT = /صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ|صلى الله عليه وسلم|صلى الله عليه و سلم|صلّى الله عليه وسلّم|ﷺ/g;

export function normalizeArabic(s) {
  if (!s) return '';
  return String(s)
    .replace(FORMAT, '')
    .replace(SALAT, ' ﷺ ')
    .replace(TASHKEEL, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ة/g, 'ه').replace(/ﻻ/g, 'لا')
    .replace(PUNCT, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
/** هل النص needle موجود (بعد التطبيع) داخل haystack؟ */
export function containsNormalized(haystack, needle) { return normalizeArabic(haystack).includes(normalizeArabic(needle)); }
