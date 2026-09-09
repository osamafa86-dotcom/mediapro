/** رسم وحدات الإقلاع: index.html يُحمّل كل وحدة ثابتة مسبقًا (modulepreload)، وعامل الخدمة يخزّنها كلها دون اتصال. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { staticGraph } from '../../tools/module-graph.mjs';

const root = new URL('../../', import.meta.url).pathname;
const graph = staticGraph();
// كل ما قد يُحمَّل لاحقًا (الشاشات الكسولة وبياناتها) يجب أن يكون في كاش عامل الخدمة أيضًا
const LAZY_ENTRIES = ['js/ui/quran-view.js', 'js/ui/qibla-view.js', 'js/ui/adhkar-view.js', 'js/ui/more-view.js', 'js/ui/hadith-view.js', 'js/ui/settings-view.js', 'js/ui/hisn-view.js', 'js/ui/tasbih-view.js', 'js/data/hisn.js', 'js/data/world-land.js', 'js/data/hadith.js', 'js/core/tafsir.js', 'js/core/geomag.js'];
const full = [...new Set([...graph, ...LAZY_ENTRIES.flatMap((e) => staticGraph(e))])];

test('وسوم modulepreload في index.html تطابق رسم الاعتماديات الثابتة تمامًا', () => {
  const html = fs.readFileSync(root + 'index.html', 'utf8');
  const links = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((m) => m[1]);
  assert.deepEqual(links, graph.filter((p) => p !== 'js/app.js'), 'شغّل: node tools/module-graph.mjs --write');
  assert.ok(graph.length > 12 && graph.length < 40, `حجم رسم الإقلاع ${graph.length}`);
});
test('عامل الخدمة يخزّن كل وحدات الإقلاع والوحدات الكسولة', () => {
  const sw = fs.readFileSync(root + 'sw.js', 'utf8');
  const missing = full.filter((p) => !sw.includes(`'./${p}'`));
  assert.deepEqual(missing, [], 'وحدات ناقصة في قائمة CORE بعامل الخدمة');
  assert.ok(full.length > graph.length + 10);
});
test('البيانات الثقيلة لا تُحمَّل عند الإقلاع (كسولة)', () => {
  for (const heavy of ['js/data/hisn.js', 'js/data/world-land.js', 'js/data/nawawi.js', 'js/data/hadith/part-a.js', 'js/ui/quran-view.js', 'js/ui/mushaf-reader.js', 'js/platform/audio.js']) assert.ok(!graph.includes(heavy), `${heavy} في رسم الإقلاع`);
  for (const p of full) assert.ok(fs.existsSync(root + p), p);
});
