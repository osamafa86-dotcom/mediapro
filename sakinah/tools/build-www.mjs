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
// العلم يُكتب في ملف بدل شيفرة مضمّنة كي تبقى سياسة أمان المحتوى (script-src 'self') سارية داخل الغلاف الأصلي أيضًا
const boot = path.join(out, 'js/boot-theme.js');
fs.writeFileSync(boot, 'window.SAKINAH_NATIVE = true;\n' + fs.readFileSync(boot, 'utf8'));
if (!fs.readFileSync(path.join(out, 'index.html'), 'utf8').includes('js/boot-theme.js')) throw new Error('index.html لا يحمّل boot-theme.js');
console.log('www/ ready');
