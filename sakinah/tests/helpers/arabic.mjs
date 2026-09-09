/** أدوات تطبيع النص العربي للاختبارات — تعيد تصدير وحدة التطبيع المشتركة في التطبيق كي يُختبر السلوك الفعلي نفسه */
export { normalizeArabic, containsNormalized } from '../../js/core/arabic.js';
import { normalizeArabic as _n } from '../../js/core/arabic.js';
/** أطول بادئة مشتركة (بعد التطبيع) — تفيد في تشخيص أين يبدأ الاختلاف */
export function firstMismatch(haystack, needle) {
  const h = _n(haystack), n = _n(needle);
  if (h.includes(n)) return -1;
  let lo = 0, hi = n.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (h.includes(n.slice(0, mid))) lo = mid; else hi = mid - 1; }
  return lo;
}
