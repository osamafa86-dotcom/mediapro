// نسخ ملفات التشغيل فقط (بلا اختبارات وأدوات) إلى www/ لاستخدامها في غلاف iOS/Android (Capacitor)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FONT_BASE, pageFontUrl } from '../js/core/mushaf.js';
import { TOTAL_PAGES } from '../js/data/quran-meta.js';

async function bundleFonts() {
  const cacheDir = path.join(root, '.cache/fonts-qcf'); fs.mkdirSync(cacheDir, { recursive: true });
  const rel = (url) => url.slice(FONT_BASE.length); // hafs/v1/woff2/pN.woff2 | surah-names/v1/sura_names.woff2
  const urls = [FONT_BASE + 'surah-names/v1/sura_names.woff2']; for (let p = 1; p <= TOTAL_PAGES; p++) urls.push(pageFontUrl(p));
  const queue = urls.slice(); let fetched = 0; const failed = [];
  const worker = async () => {
    while (queue.length) {
      const url = queue.shift(); const f = path.join(cacheDir, rel(url));
      if (fs.existsSync(f) && fs.statSync(f).size > 1000) continue;
      let ok = false;
      for (let attempt = 0; attempt < 3 && !ok; attempt++) {
        try { const res = await fetch(url); if (res.ok) { const buf = Buffer.from(await res.arrayBuffer()); if (buf.length > 1000) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf); ok = true; fetched++; } } } catch { /* إعادة المحاولة */ }
        if (!ok) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
      if (!ok) failed.push(url);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  if (failed.length) throw new Error(`تعذّر جلب ${failed.length} خطًا: ${failed[0]}`);
  const dest = path.join(out, 'assets/fonts/quran');
  for (const url of urls) { const d = path.join(dest, rel(url)); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(cacheDir, rel(url)), d); }
  console.log(`خطوط المصحف: ${urls.length} ملفًا مضمّنة (${fetched} جُلب الآن، والباقي من .cache/fonts-qcf)`);
  return "window.SAKINAH_FONTS_BASE = './assets/fonts/quran/';\n";
}
const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const item of ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'data', 'assets']) {
  fs.cpSync(path.join(root, item), path.join(out, item), { recursive: true });
}
// داخل الغلاف الأصلي لا يعمل عامل الخدمة على نظام الملفات المحلي؛ نضيف علمًا يعطّله ويُعلم التطبيق أنه داخل غلاف
// العلم يُكتب في ملف بدل شيفرة مضمّنة كي تبقى سياسة أمان المحتوى (script-src 'self') سارية داخل الغلاف الأصلي أيضًا
const boot = path.join(out, 'js/boot-theme.js');
// خطوط صفحات المصحف الـ604 (وخط أسماء السور، ≈48 م.ب) تُضمَّن داخل التطبيق كي تُعرض الصفحات فورًا ودون اتصال (لا عامل خدمة في الغلاف)
// تُجلب من CDN مرة واحدة إلى .cache/fonts-qcf ثم تُنسخ؛ SAKINAH_SKIP_FONTS=1 يتخطاها (تجارب محلية)
const fontsFlag = process.env.SAKINAH_SKIP_FONTS ? '' : await bundleFonts();
fs.writeFileSync(boot, 'window.SAKINAH_NATIVE = true;\n' + fontsFlag + fs.readFileSync(boot, 'utf8'));
if (!fs.readFileSync(path.join(out, 'index.html'), 'utf8').includes('js/boot-theme.js')) throw new Error('index.html لا يحمّل boot-theme.js');
console.log('www/ ready');
