/**
 * مدير تنزيل التلاوات للعمل دون اتصال:
 * - الويب: الملفات تُحفظ في Cache API (sakinah-audio) ويقدّمها عامل الخدمة للمشغّل (مع دعم طلبات Range لـ Safari).
 * - التطبيق الأصلي (لا عامل خدمة): تُنزَّل عبر Filesystem إلى مجلد البيانات وتُحوَّل إلى رابط محلي عند التشغيل.
 * الفهرس (أي سورة نُزّلت لأي قارئ وحجمها) يُحفظ في إعدادات التطبيق quran.downloads.
 */
import { surahAudioUrls } from './audio.js';
import { plugin, isNative } from './native.js';

export const AUDIO_CACHE = 'sakinah-audio';
const hasCaches = () => typeof caches !== 'undefined';
const fileName = (url) => url.split('/').slice(-3).join('_').replace(/[^A-Za-z0-9_.-]/g, '_'); // Alafasy_mp3_001001.mp3 أو 128_ar.alafasy_1.mp3
const nativePath = (reciterId, url) => `sakinah-audio/${reciterId}/${fileName(url)}`;

/**
 * تنزيل سورة كاملة لقارئ. ayahs: آيات السورة [{n, surah, ayah}]. onProgress(done, total, bytes).
 * @returns {Promise<{files:number, bytes:number}>}
 */
export async function downloadSurah(reciterId, surah, ayahs, { onProgress, signal, words = true } = {}) {
  const list = await surahAudioUrls(reciterId, surah, ayahs, { words });
  if (!list.length) throw new Error('no-audio');
  let bytes = 0, done = 0;
  const F = isNative() ? plugin('Filesystem') : null;
  const cache = !F && hasCaches() ? await caches.open(AUDIO_CACHE) : null;
  if (!F && !cache) throw new Error('unsupported');
  const worker = async (item) => {
    if (signal && signal.aborted) throw new Error('aborted');
    if (F) {
      const r = await F.downloadFile({ url: item.url, path: nativePath(reciterId, item.url), directory: 'DATA', recursive: true });
      try { const st = await F.stat({ path: nativePath(reciterId, item.url), directory: 'DATA' }); bytes += st.size || 0; } catch { /* تجاهل */ }
      void r;
    } else {
      const hit = await cache.match(item.url);
      if (hit) { bytes += +(hit.headers.get('content-length') || 0); }
      else {
        const res = await fetch(item.url, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer(); bytes += buf.byteLength;
        await cache.put(item.url, new Response(buf, { headers: { 'content-type': res.headers.get('content-type') || 'audio/mpeg', 'content-length': String(buf.byteLength), 'accept-ranges': 'bytes' } }));
      }
    }
    done++; onProgress && onProgress(done, list.length, bytes);
  };
  // 3 تنزيلات متوازية
  const queue = list.slice(); const runners = Array.from({ length: 3 }, async () => { while (queue.length) { const it = queue.shift(); await worker(it); } });
  await Promise.all(runners);
  return { files: list.length, bytes };
}
/** حذف تنزيلات سورة لقارئ */
export async function deleteSurah(reciterId, surah, ayahs, { words = true } = {}) {
  let list = []; try { list = await surahAudioUrls(reciterId, surah, ayahs, { words }); } catch { return 0; }
  const F = isNative() ? plugin('Filesystem') : null; let removed = 0;
  if (F) { for (const it of list) { try { await F.deleteFile({ path: nativePath(reciterId, it.url), directory: 'DATA' }); removed++; } catch { /* غير موجود */ } } }
  else if (hasCaches()) { const cache = await caches.open(AUDIO_CACHE); for (const it of list) { if (await cache.delete(it.url)) removed++; } }
  return removed;
}
export async function clearAllAudio() {
  const F = isNative() ? plugin('Filesystem') : null;
  if (F) { try { await F.rmdir({ path: 'sakinah-audio', directory: 'DATA', recursive: true }); } catch { /* تجاهل */ } }
  else if (hasCaches()) await caches.delete(AUDIO_CACHE);
}
/** محوّل رابط → ملف محلي في التطبيق الأصلي (يُمرَّر إلى AyahPlayer.localResolver) */
export function makeLocalResolver(reciterIdGetter) {
  const F = isNative() ? plugin('Filesystem') : null; if (!F) return null;
  const C = window.Capacitor;
  return async (url) => {
    try {
      const path = nativePath(reciterIdGetter(), url);
      const st = await F.stat({ path, directory: 'DATA' }); if (!st || !st.uri) return null;
      return C && C.convertFileSrc ? C.convertFileSrc(st.uri) : null;
    } catch { return null; }
  };
}
/** تقدير الحجم المخزّن (الويب: حسب رؤوس content-length في الكاش) */
export async function storedBytes() {
  if (!hasCaches() || isNative()) return null;
  try { const c = await caches.open(AUDIO_CACHE); const keys = await c.keys(); let b = 0; for (const k of keys) { const r = await c.match(k); b += +(r && r.headers.get('content-length') || 0); } return { files: keys.length, bytes: b }; } catch { return null; }
}
export const fmtBytes = (b) => (b >= 1e9 ? `${(b / 1e9).toFixed(2)} ج.ب` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} م.ب` : `${Math.round(b / 1e3)} ك.ب`);
