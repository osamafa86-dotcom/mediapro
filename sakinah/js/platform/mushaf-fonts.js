/**
 * تخزين خطوط صفحات المصحف (QCF v1) للعمل دون اتصال: تنزيل الخطوط الـ604 (وخط أسماء السور) إلى كاش عامل الخدمة
 * ("sakinah-mushaf-fonts") الذي يقدّمها لاحقًا لطلبات FontFace. يعمل من الصفحة مباشرة عبر Cache API (لا يحتاج عامل الخدمة للتنزيل).
 */
import { pageFontUrl, SURAH_NAMES_FONT_URL } from '../core/mushaf.js';
import { TOTAL_PAGES } from '../data/quran-meta.js';

export const FONT_CACHE = 'sakinah-mushaf-fonts';
const hasCache = () => typeof caches !== 'undefined';

/** عدد خطوط الصفحات المحفوظة */
export async function offlineFontsCount() {
  if (!hasCache()) return 0;
  try { const c = await caches.open(FONT_CACHE); const keys = await c.keys(); return keys.filter((r) => /\/hafs\/v1\/woff2\/p\d+\.woff2$/.test(r.url)).length; } catch { return 0; }
}

/** تنزيل كل خطوط الصفحات (يتخطى المحفوظ منها) مع رد تقدم (done, total)؛ يرمي خطأ إن فشل أي ملف بعد إعادة المحاولة */
export async function downloadAllPageFonts(onProgress = () => {}, { concurrency = 6 } = {}) {
  if (!hasCache()) throw new Error('Cache API unavailable');
  const cache = await caches.open(FONT_CACHE);
  const urls = [SURAH_NAMES_FONT_URL]; for (let p = 1; p <= TOTAL_PAGES; p++) urls.push(pageFontUrl(p));
  let done = 0; const total = urls.length; const queue = urls.slice(); let failed = 0;
  const worker = async () => {
    while (queue.length) {
      const url = queue.shift();
      if (!(await cache.match(url))) {
        let ok = false;
        for (let attempt = 0; attempt < 3 && !ok; attempt++) {
          try { const res = await fetch(url, { cache: 'force-cache' }); if (res.ok) { await cache.put(url, res); ok = true; } } catch { /* إعادة المحاولة */ }
          if (!ok) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
        if (!ok) failed++;
      }
      done++; onProgress(done, total);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  if (failed) throw new Error(`${failed} fonts failed`);
}

/** حذف الخطوط المحفوظة */
export async function clearOfflineFonts() { if (hasCache()) await caches.delete(FONT_CACHE); }
