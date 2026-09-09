/**
 * رسم الاعتماديات الثابتة (import/export … from) بدءًا من js/app.js — لتوليد وسوم modulepreload في index.html
 * (تحميل كل وحدات الإقلاع دفعة واحدة بدل سلسلة طلبات متتابعة) وللتحقق من قائمة عامل الخدمة.
 * التشغيل: node tools/module-graph.mjs [--write]  (--write يحدّث index.html بين علامتي modulepreload)
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const RE = /^\s*(?:import|export)\s[^;'"]*?from\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm;

/** المسارات (نسبةً إلى الجذر، مثل js/app.js) لكل وحدة تُحمَّل ثابتًا من نقطة الدخول، بترتيب الاكتشاف */
export function staticGraph(entry = 'js/app.js') {
  const seen = []; const stack = [entry];
  while (stack.length) {
    const rel = stack.shift(); if (seen.includes(rel)) continue; seen.push(rel);
    const src = fs.readFileSync(path.join(root, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const m of src.matchAll(RE)) { const spec = m[1] || m[2]; if (!spec.startsWith('.')) continue; const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec)); if (!seen.includes(target)) stack.push(target); }
  }
  return seen;
}
export function preloadBlock(graph) {
  return graph.filter((p) => p !== 'js/app.js').map((p) => `  <link rel="modulepreload" href="${p}">`).join('\n');
}
export function writeIndex(graph) {
  const file = path.join(root, 'index.html'); let html = fs.readFileSync(file, 'utf8');
  const start = '  <!-- modulepreload:start (يولَّد بـ tools/module-graph.mjs --write) -->', end = '  <!-- modulepreload:end -->';
  const block = `${start}\n${preloadBlock(graph)}\n${end}`;
  if (html.includes(start)) html = html.replace(new RegExp(`${start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), block);
  else html = html.replace('  <script type="module" src="js/app.js"></script>', `${block}\n  <script type="module" src="js/app.js"></script>`);
  fs.writeFileSync(file, html);
}
if (process.argv[1] && import.meta.url === new URL('file://' + path.resolve(process.argv[1])).href) {
  const g = staticGraph();
  if (process.argv.includes('--write')) { writeIndex(g); console.log(`index.html: ${g.length - 1} وسم modulepreload`); }
  else console.log(g.join('\n'));
}
