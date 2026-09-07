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
const css = fs.readFileSync(path.join(root, 'css/app.css'), 'utf8');
const svg = fs.readFileSync(path.join(root, 'assets/icons/icon.svg'), 'utf8');
const svgUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

html = html
  .replace(/\s*<link rel="manifest"[^>]*>/, '')
  .replace(/\s*<link rel="apple-touch-icon"[^>]*>/, '')
  .replace(/<link rel="icon" href="assets\/icons\/icon.svg" type="image\/svg\+xml">/, `<link rel="icon" href="${svgUri}" type="image/svg+xml">`)
  .replace(/<link rel="stylesheet" href="css\/app.css">/, `<style>\n${css}\n</style>`)
  .replace(/<script type="module" src="js\/app.js"><\/script>/, `<script>window.SAKINAH_STANDALONE=true;</script>\n<script>\n${js}\n</script>`)
  .replace('<title>سكينة — مواقيت الصلاة والقبلة والأذكار</title>', '<title>سكينة — نسخة تجريبية (ملف واحد)</title>');

if (!html.includes('SAKINAH_STANDALONE') || html.includes('css/app.css')) throw new Error('template replacement failed');
const target = path.join(out, 'sakinah-standalone.html');
fs.writeFileSync(target, html);
console.log('wrote', target, (fs.statSync(target).size / 1024).toFixed(0) + ' KB');
