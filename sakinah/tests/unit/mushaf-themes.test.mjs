/** سمات المصحف: تباين كافٍ في كل سمة، ترقية الإعدادات القديمة، ومتغيرات CSS كاملة؛ وبداية الأحزاب من بيانات المصحف. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MUSHAF_THEMES, THEME_GROUPS, themeById, isDarkTheme, migrateTheme, themeVars, contrastRatio } from '../../js/core/mushaf-themes.js';
import { setQuranData, hizbStartPage, JUZ_STARTS, TOTAL_PAGES } from '../../js/core/quran.js';

test('كل سمة لها معرّف فريد واسم ومجموعة معروفة وتباين حبر/ورق ≥ 7:1', () => {
  assert.ok(MUSHAF_THEMES.length >= 12);
  assert.equal(new Set(MUSHAF_THEMES.map((t) => t.id)).size, MUSHAF_THEMES.length);
  const groups = new Set(THEME_GROUPS.map(([g]) => g));
  for (const t of MUSHAF_THEMES) {
    assert.ok(groups.has(t.group), t.id); assert.ok(t.name.length > 2);
    for (const k of ['paper', 'paper2', 'ink']) assert.match(t[k], /^#[0-9a-f]{6}$/, `${t.id}.${k}`);
    assert.ok(contrastRatio(t.ink, t.paper) >= 7, `${t.id}: تباين ${contrastRatio(t.ink, t.paper).toFixed(1)}`);
    if (t.gradient) assert.ok(t.gradient.startsWith('linear-gradient('));
  }
  assert.ok(['cream', 'white', 'sugar', 'sepia', 'dark', 'black'].every((id) => MUSHAF_THEMES.some((t) => t.id === id)));
});
test('السمة المطلوبة سكري فاتحة، والداكنة تُعرَف من مجموعتها', () => {
  assert.equal(themeById('sugar').name, 'سكري'); assert.equal(isDarkTheme('sugar'), false); assert.equal(isDarkTheme('midnight'), true); assert.equal(themeById('nope').id, 'cream');
});
test('ترقية الإعدادات القديمة: night → داكن، paper white → أبيض، وإلا كريمي', () => {
  assert.equal(migrateTheme({ night: true, paper: 'white' }), 'dark');
  assert.equal(migrateTheme({ night: false, paper: 'white' }), 'white');
  assert.equal(migrateTheme({}), 'cream');
  assert.equal(migrateTheme({ theme: 'sky', night: true }), 'sky');
  assert.equal(migrateTheme({ theme: 'bogus' }), 'cream');
});
test('متغيرات CSS كاملة لكل سمة (ورق، حبر، خلفية، ذهبي، تظليل)', () => {
  for (const t of MUSHAF_THEMES) {
    const v = themeVars(t.id);
    for (const k of ['--paper', '--paper-2', '--ink', '--paper-bg', '--reader-bg', '--gold-1', '--marker', '--mp-hl', '--mp-sel']) assert.ok(v[k], `${t.id} ${k}`);
    assert.equal(v['--paper-bg'], t.gradient || t.paper);
  }
});
test('بداية كل حزب: الحزب الفردي يبدأ مع جزئه، والصفحات متزايدة', () => {
  setQuranData(JSON.parse(fs.readFileSync(new URL('../../data/quran.json', import.meta.url), 'utf8')));
  assert.equal(hizbStartPage(1), 1);
  for (let j = 1; j <= 30; j++) assert.equal(hizbStartPage(2 * j - 1), JUZ_STARTS[j - 1].page, `الحزب ${2 * j - 1}`);
  let prev = 0; for (let h = 1; h <= 60; h++) { const p = hizbStartPage(h); assert.ok(p > prev && p <= TOTAL_PAGES, `الحزب ${h}`); prev = p; }
  assert.equal(hizbStartPage(61), null);
});
