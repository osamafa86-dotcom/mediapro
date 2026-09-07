import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { similarity, setQuranData, pageAyahs, surahAyahs, getAyahBySurah, normalizeForMatch, tokenize, HifzMatcher, surahsStartingOn, pageLabel, searchText, SURAHS, JUZ_STARTS, TOTAL_PAGES } from '../../js/core/quran.js';

const raw = JSON.parse(fs.readFileSync(new URL('../../data/quran.json', import.meta.url), 'utf8'));
const q = setQuranData(raw);

test('سلامة بيانات المصحف: 6236 آية، 114 سورة، 604 صفحات غير فارغة، 30 جزءًا، 15 سجدة', () => {
  assert.equal(q.ayahs.length, 6236);
  assert.equal(SURAHS.length, 114);
  assert.equal(SURAHS.reduce((a, s) => a + s.ayahs, 0), 6236);
  for (let p = 1; p <= TOTAL_PAGES; p++) assert.ok(pageAyahs(p).length > 0, `page ${p} empty`);
  assert.equal(JUZ_STARTS.length, 30);
  assert.deepEqual(JUZ_STARTS[29], { juz: 30, surah: 78, ayah: 1, page: 582 });
  assert.equal(raw.sajda.length, 15);
  for (const s of SURAHS) assert.equal(surahAyahs(s.n).length, s.ayahs, `surah ${s.n} count`);
  // ترتيب الصفحات والأرقام متسلسل
  let prevPage = 1; for (const a of q.ayahs) { assert.ok(a.page >= prevPage && a.page <= prevPage + 1, `page jump at ${a.n}`); prevPage = a.page; }
});

test('البسملة: آية في الفاتحة، مفصولة عن أول آية في سائر السور، وغائبة في التوبة', () => {
  assert.equal(normalizeForMatch(getAyahBySurah(1, 1).text), 'بسم الله الرحمن الرحيم');
  assert.equal(normalizeForMatch(getAyahBySurah(2, 1).text), 'الم');
  assert.equal(normalizeForMatch(getAyahBySurah(112, 1).text), 'قل هو الله احد');
  assert.ok(normalizeForMatch(getAyahBySurah(9, 1).text).startsWith('براءه من الله'));
  assert.equal(normalizeForMatch(getAyahBySurah(114, 6).text), 'من الجنه والناس');
  assert.ok(normalizeForMatch(getAyahBySurah(2, 255).text).startsWith('الله لا اله الا هو الحي القيوم لا تاخذه'));
});

test('الصفحات: الفاتحة صفحة 1، البقرة تبدأ صفحة 2، الناس صفحة 604، وترويسات السور', () => {
  assert.deepEqual(surahsStartingOn(1), [1]); assert.deepEqual(surahsStartingOn(2), [2]);
  assert.deepEqual(surahsStartingOn(604), [112, 113, 114]);
  assert.equal(SURAHS[0].page, 1); assert.equal(SURAHS[1].page, 2); assert.equal(SURAHS[113].page, 604);
  assert.deepEqual(pageLabel(1), { juz: 1, hizb: 1, quarter: 1 });
  assert.equal(pageLabel(582).juz, 30);
  assert.equal(SURAHS[0].name, 'الفاتحة'); assert.equal(SURAHS[2].name, 'آل عمران');
});

test('التطبيع والتجزئة: علامات الوقف ليست كلمات منطوقة، والرسم العثماني يطابق الإملاء الحديث', () => {
  const t = tokenize(getAyahBySurah(2, 2).text);
  const spoken = t.filter((w) => w.spoken).map((w) => w.norm);
  assert.deepEqual(spoken, ['ذلك', 'الكتب', 'لا', 'ريب', 'فيه', 'هدي', 'للمتقين']); // الألف الخنجرية تُحذف (الكتب ≈ الكتاب بتسامح المطابق)
  assert.ok(t.some((w) => !w.spoken), 'contains waqf marks');
  assert.equal(normalizeForMatch('الرَّحْمَٰنِ'), 'الرحمن');
  assert.equal(normalizeForMatch('ٱلصِّرَٰطَ'), 'الصرط'); // الألف الخنجرية تُحذف؛ التشابه مع 'الصراط' 0.83 فيقبله المطابق
  assert.equal(normalizeForMatch('ٱلصَّلَوٰةَ'), 'الصلوه'); // رسم عثماني (الصلوة) يخالف الإملاء الحديث (الصلاة) — يعالجه تسامح المطابق
  assert.ok(similarity('الصلوه', 'الصلاه') >= 0.66 && similarity('الصرط', 'الصراط') >= 0.66 && similarity('ذلك', 'ذلك') === 1);
});

test('مُطابِق الحفظ: يكشف الكلمات بالترتيب، يتسامح مع التخطي والأخطاء الصوتية، ويتجاهل الكلمات الدخيلة', () => {
  const words = surahAyahs(1).flatMap((a) => tokenize(a.text)).filter((w) => w.spoken);
  const m = new HifzMatcher(words);
  assert.deepEqual(m.feed('بسم الله'), [0, 1]);
  assert.deepEqual(m.feed('الرحمان الرحيم'), [2, 3]); // "الرحمان" إملاء صوتي شائع
  assert.deepEqual(m.feed('يعني الحمد'), [4]); // كلمة دخيلة تُتجاهل
  assert.deepEqual(m.feed('رب العالمين'), [5, 6, 7]); // تخطي "لله" يُكشف تلقائيًا
  assert.equal(m.pos, 8); assert.equal(m.unmatched, 1); assert.equal(m.skipped, 1);
  assert.equal(m.hint(), 8);
  m.feed('الرحيم مالك يوم الدين اياك نعبد واياك نستعين اهدنا الصراط المستقيم صراط الذين انعمت عليهم غير المغضوب عليهم ولا الضالين');
  assert.ok(m.done, `pos ${m.pos}/${words.length}`);
});

test('البحث النصي يجد الآية بلا تشكيل', () => {
  const r = searchText('الله لا اله الا هو الحي القيوم');
  assert.ok(r.some((a) => a.surah === 2 && a.ayah === 255));
  assert.equal(searchText('x').length, 0);
});
