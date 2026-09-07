// نسخ ملفات التشغيل فقط (بلا اختبارات وأدوات) إلى www/ لاستخدامها في غلاف iOS/Android (Capacitor)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const item of ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'data', 'assets']) {
  fs.cpSync(path.join(root, item), path.join(out, item), { recursive: true });
}
// داخل الغلاف الأصلي لا يعمل عامل الخدمة على نظام الملفات المحلي؛ نضيف علمًا يعطّله ويُعلم التطبيق أنه داخل غلاف
let html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
html = html.replace('<script type="module" src="js/app.js"></script>', '<script>window.SAKINAH_NATIVE = true;</script>\n  <script type="module" src="js/app.js"></script>');
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('www/ ready');
