/**
 * التفاسير: التفسير الميسر (مجمع الملك فهد) مضمّن دون اتصال في data/tafsir/muyassar/{سورة}.json (مولّد بـ tools/build-tafsir.mjs)،
 * وتفاسير أخرى (السعدي، ابن كثير، الطبري، القرطبي، البغوي، الوسيط) تُجلب عند الطلب من واجهة quran.com وتُخزَّن محليًا (Cache API).
 * النصوص تُنظَّف إلى وسوم آمنة فقط (b, i, p, br) قبل العرض.
 */
export const TAFSIR_SOURCES = [
  { id: 'muyassar', name: 'التفسير الميسر', short: 'الميسر', offline: true, api: 16, by: 'مجمع الملك فهد لطباعة المصحف الشريف' },
  { id: 'saadi', name: 'تيسير الكريم الرحمن (السعدي)', short: 'السعدي', api: 91, by: 'عبد الرحمن بن ناصر السعدي' },
  { id: 'ibnkathir', name: 'تفسير القرآن العظيم (ابن كثير)', short: 'ابن كثير', api: 14, by: 'إسماعيل بن كثير' },
  { id: 'baghawi', name: 'معالم التنزيل (البغوي)', short: 'البغوي', api: 94, by: 'الحسين بن مسعود البغوي' },
  { id: 'qurtubi', name: 'الجامع لأحكام القرآن (القرطبي)', short: 'القرطبي', api: 90, by: 'محمد بن أحمد القرطبي' },
  { id: 'tabari', name: 'جامع البيان (الطبري)', short: 'الطبري', api: 15, by: 'محمد بن جرير الطبري' },
  { id: 'wasit', name: 'التفسير الوسيط', short: 'الوسيط', api: 93, by: 'محمد سيد طنطاوي' },
];
export const DEFAULT_TAFSIR = 'muyassar';
const API = 'https://api.quran.com/api/v4/tafsirs/';
const CACHE = 'sakinah-tafsir';
const mem = new Map();

/** تنظيف HTML التفسير: الأقواس الخضراء (نص الآية) → <b>، الزرقاء → <i>، فقرات وفواصل أسطر فقط؛ وكل ما عداه نصٌّ */
export function sanitizeTafsirHtml(html) {
  if (!html) return '';
  let s = String(html).replace(/\r/g, '');
  const spans = []; // مكدس لإغلاق span بالوسم المقابل لفتحها
  s = s.replace(/<\s*(\/?)\s*([a-zA-Z0-9]+)([^>]*)>/g, (m, close, tag, attrs) => {
    tag = tag.toLowerCase();
    if (tag === 'span') {
      if (close) { const t = spans.pop(); return t === 'b' ? '</b>' : t === 'i' ? '</i>' : ''; }
      const t = /class\s*=\s*["']?\s*green/i.test(attrs) ? 'b' : /class\s*=\s*["']?\s*blue/i.test(attrs) ? 'i' : 'x';
      spans.push(t); return t === 'b' ? '<b>' : t === 'i' ? '<i>' : '';
    }
    if (tag === 'b' || tag === 'strong') return close ? '</b>' : '<b>';
    if (tag === 'i' || tag === 'em') return close ? '</i>' : '<i>';
    if (tag === 'p' || tag === 'div') return close ? '</p>' : '<p>';
    if (tag === 'br') return '<br>';
    if (/^h[1-6]$/.test(tag)) return close ? '</b></p>' : '<p><b>';
    if (tag === 'li') return close ? '</p>' : '<p>• ';
    return '';
  });
  s = s.replace(/<p>\s*<\/p>/g, '').replace(/(<br>\s*){3,}/g, '<br><br>').trim();
  return s;
}

const hasCaches = () => typeof caches !== 'undefined' && typeof Request !== 'undefined';
async function cachedJson(url, { network = true } = {}) {
  if (mem.has(url)) return mem.get(url);
  if (hasCaches()) { try { const c = await caches.open(CACHE); const hit = await c.match(url); if (hit) { const j = await hit.json(); mem.set(url, j); return j; } } catch { /* لا كاش */ } }
  if (!network) return null;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  mem.set(url, json);
  if (hasCaches()) { try { const c = await caches.open(CACHE); await c.put(url, new Response(JSON.stringify(json), { headers: { 'content-type': 'application/json' } })); } catch { /* تجاهل */ } }
  return json;
}

/**
 * نص تفسير آية. يعيد { html, source, offline } أو يرمي خطأً إن تعذّر (دون اتصال ولا كاش).
 * @param {string} sourceId معرّف المصدر من TAFSIR_SOURCES
 */
export async function getTafsir(sourceId, surah, ayah, { baseUrl = 'data/tafsir/' } = {}) {
  const src = TAFSIR_SOURCES.find((s) => s.id === sourceId) || TAFSIR_SOURCES[0];
  if (src.offline) {
    try {
      const arr = await cachedJson(`${baseUrl}${src.id}/${surah}.json`);
      if (Array.isArray(arr) && arr[ayah - 1]) return { html: arr[ayah - 1], source: src, offline: true };
    } catch { /* نسخة الملف الواحد أو ملف ناقص: نجرّب الشبكة */ }
  }
  const json = await cachedJson(`${API}${src.api}/by_ayah/${surah}:${ayah}`);
  const text = json && json.tafsir && json.tafsir.text;
  if (!text) throw new Error('empty tafsir');
  return { html: sanitizeTafsirHtml(text), source: src, offline: false };
}
export function tafsirSource(id) { return TAFSIR_SOURCES.find((s) => s.id === id) || TAFSIR_SOURCES[0]; }
