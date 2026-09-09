import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FONT_BASE, fontBase, fontsBundled, pageFontUrl, surahNamesFontUrl } from '../../js/core/mushaf.js';

test('خطوط الصفحات من CDN افتراضيًا وبلا تضمين', () => {
  delete globalThis.window;
  assert.equal(fontsBundled(), false);
  assert.equal(fontBase(), FONT_BASE);
  assert.equal(pageFontUrl(293), `${FONT_BASE}hafs/v1/woff2/p293.woff2`);
  assert.equal(surahNamesFontUrl(), `${FONT_BASE}surah-names/v1/sura_names.woff2`);
});

test('في الغلاف الأصلي تُقرأ الخطوط المضمّنة من مسار محلي بالبنية نفسها', () => {
  globalThis.window = { SAKINAH_FONTS_BASE: './assets/fonts/quran/' };
  try {
    assert.equal(fontsBundled(), true);
    assert.equal(pageFontUrl(1), './assets/fonts/quran/hafs/v1/woff2/p1.woff2');
    assert.equal(surahNamesFontUrl(), './assets/fonts/quran/surah-names/v1/sura_names.woff2');
  } finally { delete globalThis.window; }
});
