import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setQuranData, pageAyahs, getAyah, getAyahBySurah, tokenize, SURAHS, TOTAL_PAGES } from '../../js/core/quran.js';
import { setMushafLayout, pageLines, pageLineCount, headersOnPage, ayahsOnPage, surahNameGlyph, pageFontUrl, pageFontFamily } from '../../js/core/mushaf.js';

setQuranData(JSON.parse(fs.readFileSync(new URL('../../data/quran.json', import.meta.url), 'utf8')));
const raw = JSON.parse(fs.readFileSync(new URL('../../data/mushaf-layout.json', import.meta.url), 'utf8'));
setMushafLayout(raw);

test('بنية التخطيط: 604 صفحات، 8 أسطر للصفحتين الأوليين و15 لسائرها، ورموز في نطاق خطوط QCF فقط', () => {
  assert.equal(raw.pages.length, TOTAL_PAGES);
  for (let p = 1; p <= TOTAL_PAGES; p++) {
    const lines = pageLines(p);
    assert.equal(lines.length, pageLineCount(p), `page ${p} line count`);
    for (const l of lines) {
      if (l.type !== 'words') continue;
      assert.ok(l.words.length > 0, `page ${p}: empty words line`);
      for (const w of l.words) assert.match(w.glyph, /^[ﭐ-﷿](?: ?[ﭐ-﷿]){0,3}$/, `page ${p}: glyph ${JSON.stringify(w.glyph)}`);
    }
  }
});

test('كل آية: كلماتها في التخطيط تساوي كلماتها المنطوقة في النص بالترتيب، وعلامة نهاية واحدة، وصفحتها مطابقة', () => {
  const perAyah = new Map(); // n -> { ks: [], ends: 0, pages: Set }
  for (let p = 1; p <= TOTAL_PAGES; p++) {
    for (const l of pageLines(p)) {
      if (l.type !== 'words') continue;
      for (const w of l.words) {
        if (!perAyah.has(w.n)) perAyah.set(w.n, { ks: [], ends: 0, pages: new Set() });
        const e = perAyah.get(w.n); e.pages.add(p);
        if (w.end) e.ends++; else e.ks.push(w.k);
      }
    }
    // الآيات الظاهرة في الصفحة هي آيات الصفحة في نص المصحف بالترتيب نفسه
    assert.deepEqual(ayahsOnPage(p), pageAyahs(p).map((a) => a.n), `page ${p} ayah order`);
  }
  assert.equal(perAyah.size, 6236);
  let overrides = 0;
  for (const [n, e] of perAyah) {
    const a = getAyah(n); const spoken = tokenize(a.text).filter((t) => t.spoken).length;
    assert.equal(e.ends, 1, `ayah ${n} end markers`);
    if (raw.maps[n]) { overrides++; assert.ok(e.ks.every((k) => k >= -1 && k < spoken), `ayah ${n} override range`); continue; }
    assert.deepEqual(e.ks, Array.from({ length: spoken }, (_, i) => i), `ayah ${n} (${a.surah}:${a.ayah}) word indices`);
  }
  assert.equal(overrides, 1);
  // الاستثناء الوحيد: «إِلْ يَاسِينَ» كلمة واحدة في رسم المجمع وكلمتان في نص Tanzil
  const ilyasin = getAyahBySurah(37, 130); assert.deepEqual(raw.maps[ilyasin.n], [0, 1, 2]);
});

test('ترويسات السور والبسملة: لكل سورة ترويسة واحدة، والبسملة تليها مباشرة (أو أول الصفحة التالية) وتغيب في الفاتحة والتوبة', () => {
  const headerPages = new Map();
  for (let p = 1; p <= TOTAL_PAGES; p++) for (const s of headersOnPage(p)) { assert.ok(!headerPages.has(s), `surah ${s} header twice`); headerPages.set(s, p); }
  assert.equal(headerPages.size, 114);
  let footHeaders = 0;
  for (const s of SURAHS) {
    const p = headerPages.get(s.n); const lines = pageLines(p); const i = lines.findIndex((l) => l.type === 'header' && l.surah === s.n);
    const firstAyah = getAyahBySurah(s.n, 1);
    if (s.n === 1 || s.n === 9) { assert.equal(p, firstAyah.page); assert.notEqual(lines[i + 1] && lines[i + 1].type, 'basmala', `surah ${s.n} must not have basmala line`); assert.equal(lines[i + 1].words[0].n, firstAyah.n); continue; }
    if (i === lines.length - 1) { // ترويسة في آخر الصفحة السابقة
      footHeaders++; assert.equal(p, firstAyah.page - 1, `surah ${s.n} foot header page`);
      const next = pageLines(p + 1); assert.equal(next[0].type, 'basmala', `surah ${s.n}: basmala at top of next page`); assert.equal(next[1].words[0].n, firstAyah.n);
    } else {
      assert.equal(p, firstAyah.page, `surah ${s.n} header page`);
      assert.equal(lines[i + 1].type, 'basmala', `surah ${s.n}: basmala after header`);
      assert.equal(lines[i + 2].words[0].n, firstAyah.n, `surah ${s.n}: first ayah after basmala`);
    }
  }
  assert.equal(footHeaders, 21);
  assert.deepEqual(headersOnPage(604), [112, 113, 114]);
  assert.deepEqual(headersOnPage(76), [4]);
  assert.deepEqual(headersOnPage(1), [1]);
});

test('الصفحة الأولى: البسملة هي الآية الأولى بخمس كلمات في السطر الثاني، والفاتحة كاملة في 7 أسطر', () => {
  const lines = pageLines(1);
  assert.equal(lines[0].type, 'header'); assert.equal(lines[1].type, 'words');
  assert.deepEqual(lines[1].words.map((w) => w.k), [0, 1, 2, 3, -1]);
  assert.equal(lines.filter((l) => l.type === 'words').length, 7);
});

test('علامات ربع الحزب ۞ (199) والسجدة ۩ (15) في مواضعها من نص المصحف', () => {
  let rub = 0, saj = 0;
  for (let p = 1; p <= TOTAL_PAGES; p++) for (const l of pageLines(p)) if (l.type === 'words') for (const w of l.words) {
    if (w.rub) { rub++; const a = getAyah(w.n); assert.ok(a.text.startsWith('۞') && w.k === 0, `rub mark at ${a.surah}:${a.ayah}`); assert.ok(/^[ﭐ-﷿] ?[ﭐ-﷿]/.test(w.glyph), 'rub glyph precedes the word'); }
    if (w.sajda) { saj++; const a = getAyah(w.n); assert.ok(a.sajda, `sajda mark on a sajda ayah ${a.surah}:${a.ayah}`); }
  }
  assert.equal(rub, 199); assert.equal(saj, 15);
});

test('مساعدات الخطوط', () => {
  assert.equal(surahNameGlyph(1), '001'); assert.equal(surahNameGlyph(114), '114');
  assert.match(pageFontUrl(604), /\/hafs\/v1\/woff2\/p604\.woff2$/);
  assert.equal(pageFontFamily(12), 'qcf-p12');
});

test('أسماء الأجزاء بالحروف كما في رأس صفحات المصحف', async () => {
  const { juzName } = await import('../../js/core/mushaf.js');
  assert.equal(juzName(1, { vocalized: false }), 'الجزء الأول');
  assert.equal(juzName(11, { vocalized: false }), 'الجزء الحادي عشر');
  assert.equal(juzName(20, { vocalized: false }), 'الجزء العشرون');
  assert.equal(juzName(26, { vocalized: false }), 'الجزء السادس والعشرون');
  assert.equal(juzName(30, { vocalized: false }), 'الجزء الثلاثون');
  assert.match(juzName(26), /الجُزْءُ السَّادِسُ وَالعِشْرُونَ/);
  assert.equal(juzName(31), '');
});
