// بناء نسخة "ملف واحد" من التطبيق: dist/sakinah-standalone.html (كل CSS وJS والبيانات مضمّنة)
// التشغيل: npm run build:standalone
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, 'dist');
fs.mkdirSync(out, { recursive: true });

const result = await build({
  entryPoints: [path.join(root, 'js/app.js')],
  bundle: true, format: 'iife', platform: 'browser', target: ['es2020'],
  minify: true, charset: 'utf8', legalComments: 'none', write: false, logLevel: 'warning',
});
const js = result.outputFiles[0].text;
const fontB64 = fs.readFileSync(path.join(root, 'assets/fonts/AmiriQuran.woff2')).toString('base64');
const css = fs.readFileSync(path.join(root, 'css/app.css'), 'utf8').replace("url('../assets/fonts/AmiriQuran.woff2')", `url(data:font/woff2;base64,${fontB64})`);
const svg = fs.readFileSync(path.join(root, 'assets/icons/icon.svg'), 'utf8');
const svgUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const quranJson = fs.readFileSync(path.join(root, 'data/quran.json'), 'utf8').replace(/<\/script/gi, '<\\/script');
const mushafJson = fs.readFileSync(path.join(root, 'data/mushaf-layout.json'), 'utf8').replace(/<\/script/gi, '<\\/script');
const tajweedJson = fs.readFileSync(path.join(root, 'data/tajweed.json'), 'utf8').replace(/<\/script/gi, '<\\/script');

// دوال بدل سلاسل الاستبدال: المحتوى المضمّن قد يحوي أنماط $& و$' التي يفسّرها String.replace
const bootTheme = fs.readFileSync(path.join(root, 'js/boot-theme.js'), 'utf8');
html = html
  // نسخة الملف الواحد تعمل من file:// وكل شيفرتها مضمّنة، فلا تنطبق عليها سياسة script-src 'self'
  .replace(/\s*<!-- سياسة أمان المحتوى[^\n]*\n\s*<meta http-equiv="Content-Security-Policy"[^>]*>/, '')
  .replace(/\s*<!-- خطوط الواجهة مستضافة محليًا[^\n]*\n/, '')
  .replace(/\s*<link rel="preload"[^>]*as="font"[^>]*>/g, '')            // الخطوط مضمّنة في CSS
  .replace(/\s*<link rel="stylesheet" href="css\/fonts.css">/, '')
  .replace(/\s*<!-- modulepreload:start[^\n]*\n[\s\S]*?<!-- modulepreload:end -->/, '') // الشيفرة كلها في حزمة واحدة
  .replace(/<script src="js\/boot-theme.js"><\/script>/, () => `<script>${bootTheme}</script>`)
  .replace(/\s*<link rel="manifest"[^>]*>/, '')
  .replace(/\s*<link rel="apple-touch-icon"[^>]*>/, '')
  .replace(/<link rel="icon" href="assets\/icons\/icon.svg" type="image\/svg\+xml">/, () => `<link rel="icon" href="${svgUri}" type="image/svg+xml">`)
  .replace(/<link rel="stylesheet" href="css\/app.css">/, () => `<style>\n${css}\n</style>`)
  .replace(/<script type="module" src="js\/app.js"><\/script>/, () => `<script>window.SAKINAH_STANDALONE=true;window.SAKINAH_QURAN=${quranJson};window.SAKINAH_MUSHAF=${mushafJson};window.SAKINAH_TAJWEED=${tajweedJson};</script>\n<script>\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>`)
  .replace('<title>سكينة — مواقيت الصلاة والقبلة والأذكار</title>', '<title>سكينة — نسخة تجريبية (ملف واحد)</title>');

if (!html.includes('SAKINAH_STANDALONE') || html.includes('css/app.css') || html.includes('css/fonts.css') || html.includes('Content-Security-Policy') || html.includes('boot-theme.js')) throw new Error('template replacement failed');
const target = path.join(out, 'sakinah-standalone.html');
fs.writeFileSync(target, html);
console.log('wrote', target, (fs.statSync(target).size / 1024).toFixed(0) + ' KB');
