/**
 * التجويد الملوّن: تحميل كسول لبيانات الأحكام (data/tajweed.json المولَّد بـ tools/build-tajweed.mjs) وفكّ ترميزها لكل آية
 * [بداية, طول, رمز] بمواضع أحرف نص الآية عندنا، مع مفتاح الألوان للواجهة.
 */
let data = null; let loading = null; const cache = new Map();
export async function loadTajweed(url = 'data/tajweed.json') {
  if (data) return data; if (loading) return loading;
  loading = (async () => {
    let raw;
    if (typeof window !== 'undefined' && window.SAKINAH_TAJWEED) raw = window.SAKINAH_TAJWEED;
    else { const res = await fetch(url); if (!res.ok) throw new Error('tajweed load failed ' + res.status); raw = await res.json(); }
    data = raw; return data;
  })().catch((e) => { loading = null; throw e; });
  return loading;
}
export function setTajweedData(raw) { data = raw; cache.clear(); }
export const isTajweedLoaded = () => !!data;
/** أحكام آية (رقم عام): [[start, len, code], …] أو null */
export function tajweedSpans(n) {
  if (!data) return null;
  if (cache.has(n)) return cache.get(n);
  const s = data.ayahs[n]; const v = s ? s.split(';').map((x) => { const [a, b, c] = x.split(','); return [+a, +b, c]; }) : null;
  cache.set(n, v); return v;
}
/** مفتاح الألوان: [رمز ممثِّل، الاسم، متغيّر اللون] */
export const TAJWEED_LEGEND = [
  ['m', 'مدّ لازم (٦ حركات)', '--tj-madd6'], ['o', 'مدّ واجب متصل (٤–٥ حركات)', '--tj-madd45'], ['p', 'مدّ جائز منفصل أو عارض (٢–٤–٦)', '--tj-madd246'], ['n', 'مدّ طبيعي (حركتان)', '--tj-madd2'],
  ['g', 'غنّة، إخفاء، إقلاب، إدغام بغنّة', '--tj-ghunnah'], ['q', 'قلقلة', '--tj-qalqala'], ['u', 'إدغام بلا غنّة', '--tj-idgham'], ['h', 'همزة وصل، حرف لا يُنطق، لام شمسية', '--tj-silent'], ['d', 'إدغام متجانسين ومتقاربين', '--tj-other'],
];
