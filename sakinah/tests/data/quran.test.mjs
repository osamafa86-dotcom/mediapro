import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { similarity, setQuranData, pageAyahs, surahAyahs, getAyah, getAyahBySurah, normalizeForMatch, tokenize, HifzMatcher, surahsStartingOn, pageLabel, searchText, SURAHS, JUZ_STARTS, TOTAL_PAGES, TOTAL_AYAHS } from '../../js/core/quran.js';

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

test('مُطابِق الحفظ: يستعيد التزامن إن أسقط التعرّف كلمات أكثر من مدى التخطي، ولا يقفز على ضجيج', () => {
  const words = surahAyahs(55).flatMap((a) => tokenize(a.text)).filter((w) => w.spoken); // الرحمن: «فبأي آلاء ربكما تكذبان» متكرّرة ٣١ مرة
  const spoken = words.map((w) => w.norm);

  // التعرّف أسقط خمس كلمات متتالية — بلا استعادة تزامن يقف المطابق إلى الأبد
  const m = new HifzMatcher(words);
  for (const w of [...spoken.slice(0, 8), ...spoken.slice(13, 60)]) m.feed(w);
  assert.ok(m.pos >= 58, `توقّف عند ${m.pos} من ${words.length}`);
  assert.equal(m.resynced, 1);

  // تلاوة سليمة كلمةً كلمة: لا يقفز رغم تكرار العبارة نفسها عشرات المرات
  const clean = new HifzMatcher(words);
  for (const w of spoken) clean.feed(w);
  assert.ok(clean.done, `pos ${clean.pos}/${words.length}`);
  assert.equal(clean.resynced, 0);

  // ضجيج لا علاقة له بالنصّ: لا يتقدّم ولا يستعيد التزامن
  const noise = new HifzMatcher(words);
  for (const w of 'السلام عليكم كيف حالك اليوم الطقس جميل هنا'.split(' ')) noise.feed(w);
  assert.equal(noise.pos, 0);
  assert.equal(noise.resynced, 0);

  // كلمة واحدة مطابقة بعيدًا لا تكفي للقفز — لا بدّ من تأكيد كلمتين متتاليتين
  const single = new HifzMatcher(words);
  for (const w of [spoken[0], 'xxxxxxxx', spoken[40]]) single.feed(w);
  assert.equal(single.resynced, 0);
});

test('سلامة تخطيط المصحف: رموز كل سطر تطابق كلماته، وكلمات كل آية متسلسلة كاملة بلا فجوة ولا تكرار', () => {
  const L = JSON.parse(fs.readFileSync(new URL('../../data/mushaf-layout.json', import.meta.url), 'utf8'));
  assert.equal(L.pages.length, TOTAL_PAGES);

  // ١) عدد الرموز في كل سطر = عدد الكلمات المعلنة في مقاطعه
  let wordLines = 0;
  for (const [pi, page] of L.pages.entries()) {
    for (const [li, ln] of page.entries()) {
      if (ln[0] !== 0) continue;
      wordLines++;
      const cells = ln[1].split('|').length;
      const declared = (ln[2] || []).reduce((a, r) => a + r[2], 0);
      assert.equal(cells, declared, `ص${pi + 1} س${li + 1}: ${cells} رمزًا مقابل ${declared} كلمة`);
    }
  }
  assert.ok(wordLines > 8000, `أسطر الكلمات ${wordLines}`);

  // ٢) كلمات كل آية مغطّاة مرة واحدة بالترتيب ٠..ن-١، ولها علامة نهاية واحدة بالضبط
  const cover = new Map(); const marks = new Map();
  for (const page of L.pages) for (const ln of page) {
    if (ln[0] !== 0) continue;
    for (const [n, k0, cnt, e] of ln[2] || []) {
      if (e) marks.set(n, (marks.get(n) || 0) + 1);
      if (!cover.has(n)) cover.set(n, []);
      for (let i = 0; i < (e ? cnt - 1 : cnt); i++) cover.get(n).push(k0 + i);
    }
  }
  assert.equal(cover.size, TOTAL_AYAHS);
  for (let n = 1; n <= TOTAL_AYAHS; n++) {
    const spoken = tokenize(getAyah(n).text).filter((w) => w.spoken).length;
    const got = cover.get(n);
    assert.equal(marks.get(n), 1, `الآية ${n}: علامات نهاية ${marks.get(n)}`);
    // ٣٧:١٣٠ وحدها يختلف فيها تقسيم المجمع عن تقسيم Tanzil («إِلْ يَاسِينَ» رمز واحد) وتُعالَج بـ maps
    const expected = L.maps[n] ? L.maps[n].length : spoken;
    assert.equal(got.length, expected, `الآية ${n}: ${got.length} كلمة في التخطيط مقابل ${expected}`);
    for (let i = 0; i < got.length; i++) assert.equal(got[i], i, `الآية ${n}: تسلسل الكلمات انكسر عند ${i}`);
  }

  // ٣) الاستثناء الوحيد موثّق ومحصور
  assert.deepEqual(Object.keys(L.maps), ['3918']);
  assert.equal(getAyah(3918).surah, 37); assert.equal(getAyah(3918).ayah, 130);
});

test('البحث النصي يجد الآية بلا تشكيل', () => {
  const r = searchText('الله لا اله الا هو الحي القيوم');
  assert.ok(r.some((a) => a.surah === 2 && a.ayah === 255));
  assert.equal(searchText('x').length, 0);
});
