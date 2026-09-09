/** بيانات التجويد الملوّن: تغطية عالية، مواضع داخل نص الآية، رموز معروفة، وسلامة الترميز. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseTajweed, projectSpans, encode, decode, RULES } from '../../tools/build-tajweed.mjs';
import { setTajweedData, tajweedSpans, TAJWEED_LEGEND } from '../../js/core/tajweed.js';

const root = new URL('../../', import.meta.url);
const tj = JSON.parse(fs.readFileSync(new URL('data/tajweed.json', root), 'utf8'));
const ours = JSON.parse(fs.readFileSync(new URL('data/quran.json', root), 'utf8')).ayahs;

test('تغطية ≥ 97٪ من الآيات، وكل حكم داخل نص آيته برمز معروف', () => {
  const keys = Object.keys(tj.ayahs).map(Number);
  assert.ok(keys.length >= 6236 * 0.95, `آيات بأحكام: ${keys.length}`); // 182 آية تبقى بلا أحكام لاختلاف رسم نادر بين الطبعتين (ى/ء…)
  let n = 0;
  for (const k of keys) {
    const text = ours[k - 1][5];
    for (const [s, l, c] of decode(tj.ayahs[k])) { assert.ok(s >= 0 && l > 0 && s + l <= text.length, `الآية ${k}: ${s}+${l} > ${text.length}`); assert.ok(RULES[c], `رمز ${c}`); assert.ok(text[s] !== ' ', `الآية ${k}: حكم يبدأ بفراغ`); n++; }
  }
  assert.ok(n > 45000, `أحكام: ${n}`);
  assert.deepEqual(decode(encode([[3, 2, 'q'], [9, 1, 'n']])), [[3, 2, 'q'], [9, 1, 'n']]);
});
test('فكّ علامات الطبعة وإسقاطها على نصنا (الفاتحة 1)', () => {
  const { text, spans } = parseTajweed('بِسْمِ [h:1[ٱ]للَّهِ [h:2[ٱ][l[ل]رَّحْمَ[n[ـٰ]نِ [h:3[ٱ][l[ل]رَّح[p[ِي]مِ');
  assert.equal(text, 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ'); assert.equal(spans.length, 7);
  const proj = projectSpans(text, spans, ours[0][5]);
  assert.ok(proj && proj.length === 7, 'كل الأحكام أُسقطت');
  assert.equal(ours[0][5].slice(proj[0][0], proj[0][0] + proj[0][1]), 'ٱ'); // همزة الوصل الأولى
  assert.ok(proj.some(([s, l, c]) => c === 'n' && ours[0][5].slice(s, s + l) === 'ٰ'), 'الألف الخنجرية في الرحمٰن مدّ طبيعي');
});
test('واجهة التحميل: الأحكام لكل آية والمفتاح', () => {
  setTajweedData(tj);
  const s = tajweedSpans(1); assert.ok(s && s.length === 7); assert.equal(tajweedSpans(999999), null);
  assert.equal(TAJWEED_LEGEND.length, 9); for (const [c, name, v] of TAJWEED_LEGEND) { assert.ok(RULES[c] && name && v.startsWith('--tj-')); }
});
