import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setQuranData, searchText, foldDigits, normalizeForSearchA, normalizeForSearchB, loadQuran } from '../../js/core/quran.js';
import { getTafsir } from '../../js/core/tafsir.js';
import { reciterBitrate, ayahAudioUrl, RECITERS } from '../../js/platform/audio.js';

setQuranData(JSON.parse(fs.readFileSync(new URL('../../data/quran.json', import.meta.url), 'utf8')));

test('البحث يجد الكلمات المكتوبة بالألف الخنجرية والحروف الصغيرة في الرسم العثماني', () => {
  for (const [w, min] of [['الصلاة', 60], ['الزكاة', 25], ['السماوات', 150], ['الكتاب', 150], ['القرآن', 50], ['إبراهيم', 60], ['داود', 14], ['الرحمن', 45], ['العالمين', 60], ['الملائكة', 50], ['سليمان', 15]]) {
    const n = searchText(w, 1000).length; assert.ok(n >= min, `${w}: ${n} < ${min}`);
  }
});
test('ترتيب النتائج: الكلمة الكاملة قبل الجزئية، وبترتيب المصحف داخل كل مجموعة', () => {
  const r = searchText('يوم', 3000); assert.ok(r.length > 300);
  const wholeIdx = r.findIndex((a) => !/(^| )يوم( |$)/.test(normalizeForSearchB(a.text)));
  assert.ok(wholeIdx === -1 || r.slice(wholeIdx).every((a) => !/(^| )يوم( |$)/.test(normalizeForSearchB(a.text))), 'المطابقات الجزئية تأتي بعد الكاملة');
  assert.equal(r[0].n, 4, 'أول نتيجة كاملة لـ«يوم» هي 1:4');
});
test('الصورتان A وB للتطبيع', () => {
  assert.equal(normalizeForSearchA('ٱلصَّلَوٰةَ'), 'الصلاه');
  assert.equal(normalizeForSearchA('ٱلْكِتَٰبَ'), 'الكتاب');
  assert.equal(normalizeForSearchB('ٱلرَّحْمَٰنِ'), 'الرحمن');
  assert.equal(normalizeForSearchA('ٱلْقُرْءَانَ'), 'القران');
  assert.equal(foldDigits('الكهف ١٠ و۲۵۵'), 'الكهف 10 و255');
});
test('فشل تحميل quran.json لا يُخزَّن (إعادة المحاولة ممكنة)', async () => {
  const origFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: false, status: 503 }; };
  // النص محمّل بالفعل عبر setQuranData؛ نختبر المسار عبر وحدة جديدة معزولة
  const mod = await import(`../../js/core/quran.js?fresh=${Date.now()}`);
  await assert.rejects(() => mod.loadQuran('data/quran.json'));
  await assert.rejects(() => mod.loadQuran('data/quran.json'));
  assert.equal(calls, 2, 'كل محاولة تجلب من جديد');
  globalThis.fetch = origFetch;
});
test('تفسير مجموعة آيات يُحلّ إلى نص أول الآيات مع مدى المجموعة', async () => {
  const base = new URL('../../data/tafsir/', import.meta.url).href;
  globalThis.fetch = async (u) => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(new URL(u), 'utf8')) });
  const r67 = await getTafsir('muyassar', 4, 67, { baseUrl: base }); const r66 = await getTafsir('muyassar', 4, 66, { baseUrl: base });
  assert.equal(r67.html, r66.html); assert.deepEqual(r67.range, { from: 66, to: 68 }); assert.deepEqual(r66.range, { from: 66, to: 68 });
  const r1 = await getTafsir('muyassar', 1, 1, { baseUrl: base }); assert.equal(r1.range, null); assert.ok(r1.html.length > 20);
  let empty = 0; for (let s = 1; s <= 114; s++) { const a = JSON.parse(fs.readFileSync(new URL(`../../data/tafsir/muyassar/${s}.json`, import.meta.url), 'utf8')); empty += a.filter((x) => !x).length; }
  assert.equal(empty, 0, 'لا آية بلا تفسير على الجهاز');
});
test('معدلات البت لكل قارئ متاحة على الخادم (قائمة مُتحقق منها) وروابط الصوت صحيحة', () => {
  assert.equal(RECITERS.length, 16);
  for (const r of RECITERS) assert.ok(Array.isArray(r.bitrates) && r.bitrates.length >= 1 && r.bitrates.every((b) => [32, 40, 48, 64, 128, 192].includes(b)), r.id);
  assert.equal(reciterBitrate('ar.abdurrahmaansudais'), 64); assert.equal(reciterBitrate('ar.ibrahimakhbar'), 32); assert.equal(reciterBitrate('ar.alafasy'), 128);
  assert.equal(reciterBitrate('ar.alafasy', 5), 64, 'المحاولات بعد آخر بديل تثبت عليه');
  assert.equal(ayahAudioUrl('ar.abdulsamad', 1), 'https://cdn.islamic.network/quran/audio/64/ar.abdulsamad/1.mp3');
});
