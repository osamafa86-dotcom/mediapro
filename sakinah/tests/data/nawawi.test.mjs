/** تحقق آلي من الأربعين النووية: 42 حديثًا، ومتون مطابقة لنسخة ثانية مستقلة (tests/fixtures/nawawi40.json). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NAWAWI, nawawiHadith } from '../../js/data/nawawi.js';
import { normalizeArabic } from '../helpers/arabic.mjs';
import { KNOWN_GAPS } from '../../tools/build-nawawi.mjs'; // فجوات النسخة الثانية الموثّقة (كلمات كانت روابط في المصدر)

const B = JSON.parse(fs.readFileSync(new URL('../fixtures/nawawi40.json', import.meta.url), 'utf8')).hadiths;
const MARK = /(رَوَاهُ|رَوَيْنَاهُ|حَدِيثٌ حَسَنٌ|حديث حسن|مُتَّفَقٌ عَلَيْهِ)/;

test('42 حديثًا بترتيبها وعناوينها وتخريجها، بلا بقايا ترميز', () => {
  assert.equal(NAWAWI.length, 42);
  NAWAWI.forEach((h, i) => {
    assert.equal(h.n, i + 1); assert.ok(h.title.startsWith('الحديث '));
    assert.ok(h.text.length > 40 && h.takhrij.length > 5, `الحديث ${h.n}`);
    assert.ok(!/[\[\]<>"]/.test(h.text + h.takhrij), `بقايا ترميز في ${h.n}`);
    assert.ok(MARK.test(h.takhrij), `تخريج غير مألوف في ${h.n}: ${h.takhrij}`);
  });
  assert.equal(nawawiHadith(1).title, 'الحديث الأول'); assert.equal(nawawiHadith(11).title, 'الحديث الحادي عشر');
  assert.equal(nawawiHadith(20).title, 'الحديث العشرون'); assert.equal(nawawiHadith(21).title, 'الحديث الحادي والعشرون');
  assert.equal(nawawiHadith(42).title, 'الحديث الثاني والأربعون'); assert.equal(nawawiHadith(43), null);
});
test('متون مشهورة في مواضعها', () => {
  assert.ok(normalizeArabic(nawawiHadith(1).text).includes('انما الاعمال بالنيات'));
  assert.ok(normalizeArabic(nawawiHadith(2).text).includes('ان تعبد الله كانك تراه'));
  assert.ok(normalizeArabic(nawawiHadith(6).text).includes('الحلال بين'));
  assert.ok(normalizeArabic(nawawiHadith(13).text).includes('لا يومن احدكم حتي يحب لاخيه'));
  assert.ok(normalizeArabic(nawawiHadith(19).text).includes('احفظ الله يحفظك'));
  assert.ok(normalizeArabic(nawawiHadith(14).text).includes('يشهد ان لا اله الا الله واني رسول الله'));
  assert.ok(normalizeArabic(nawawiHadith(5).text).includes('من عمل عملا ليس عليه امرنا فهو رد'), 'رواية مسلم ضمن الحديث الخامس');
});
test('كل متن يحتوي كلمات النسخة الثانية المستقلة بترتيبها (لا تحريف ولا نقص)', () => {
  for (const h of NAWAWI) {
    const b = B.find((x) => x.idInBook === h.n);
    const lines = b.arabic.split('\n').map((s) => s.trim()).filter((s) => s && !/^[،,.\s]+$/.test(s));
    const m = [];
    for (const l of lines) { const mm = l.match(MARK); if (/^بهذا اللفظ|^، ، في/.test(l)) break; if (mm) { const lead = l.slice(0, mm.index).trim(); if (lead.split(/\s+/).filter(Boolean).length > 2) m.push(lead); break; } m.push(l); }
    const wa = normalizeArabic(h.text).split(' '), wb = normalizeArabic(m.join(' ')).split(' ');
    let i = 0; for (const w of wb) { while (i < wa.length && wa[i] !== w) i++; assert.ok(i < wa.length, `الحديث ${h.n}: كلمة «${w}» ليست في المتن بترتيبها`); i++; }
    assert.ok(wb.length >= wa.length * (KNOWN_GAPS[h.n] ? 0.5 : 0.95), `الحديث ${h.n}: تغطية النسخة الثانية ${wb.length}/${wa.length}`);
  }
});
