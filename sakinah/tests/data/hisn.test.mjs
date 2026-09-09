/** تحقق آلي من بيانات حصن المسلم الكامل مقابل البيانات الرسمية لموقع الكتاب (tests/fixtures/hisn_all.json). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HISN_CHAPTERS, HISN_SECTIONS, hisnChapter, hisnItem, hisnAudioUrl } from '../../js/data/hisn.js';
import { ADHKAR } from '../../js/data/adhkar.js';
import { normalizeArabic } from '../helpers/arabic.mjs';

const SRC = JSON.parse(fs.readFileSync(new URL('../fixtures/hisn_all.json', import.meta.url), 'utf8'));

test('132 بابًا و267 ذكرًا بأرقام متصلة كما في الكتاب', () => {
  assert.equal(HISN_CHAPTERS.length, 132);
  HISN_CHAPTERS.forEach((c, i) => assert.equal(c.id, i + 1));
  const ids = HISN_CHAPTERS.flatMap((c) => c.items.map((it) => it.id));
  assert.equal(ids.length, 267);
  ids.forEach((id, i) => assert.equal(id, i + 1));
});
test('الأقسام تغطي كل باب مرة واحدة بالضبط', () => {
  const all = HISN_SECTIONS.flatMap((s) => s.chapters);
  assert.equal(all.length, 132); assert.equal(new Set(all).size, 132);
  for (const s of HISN_SECTIONS) { assert.ok(s.title.length > 3); for (const id of s.chapters) assert.ok(hisnChapter(id), `الباب ${id}`); }
});
test('كل ذكر يطابق المصدر الرسمي كلمةً كلمة (بعد إزالة أقواس التنصيص فقط)', () => {
  for (const c of SRC) for (const it of c.items) {
    const mine = hisnItem(it.id); assert.ok(mine, `الذكر ${it.id}`);
    assert.equal(mine.chapter.id, c.id);
    assert.equal(normalizeArabic(mine.text), normalizeArabic(it.text), `الذكر ${it.id}`);
    assert.equal(mine.repeat, Number(it.repeat) || 1);
    assert.ok(!/\(\(|\)\)/.test(mine.text), `أقواس تنصيص باقية في ${it.id}`);
    assert.ok(mine.text.length > 3 && !/\s{2}/.test(mine.text), `نص الذكر ${it.id}`); // 197 «وَلَكَ» جواب قصير
  }
});
test('العناوين نظيفة: بلا حروف عرض ولا واو منفصلة ولا أخطاء المصدر المعروفة', () => {
  for (const c of HISN_CHAPTERS) {
    assert.equal(c.title, c.title.normalize('NFKC'), c.title);
    assert.ok(!/ و /.test(c.title), c.title);
    assert.ok((c.title.match(/[ً-ْ]/g) || []).length <= 3, `عنوان مشكول بالكامل ${c.id}: ${c.title}`); // حركات مفردة للتمييز (بُلِيَ، غُلب) مقبولة
  }
  assert.equal(hisnChapter(15).title, 'أذكار الأذان');
  assert.equal(hisnChapter(47).title, 'تهنئة المولود له وجوابه');
  assert.equal(hisnChapter(84).title, 'ما يقال في المجلس');
  assert.equal(hisnChapter(104).title, 'الدعاء إذا نزل منزلًا في سفر أو غيره');
});
test('باب أذكار الصباح والمساء (27) هو نفسه أذكار شاشة الصباح والمساء (75–98)', () => {
  const ids = hisnChapter(27).items.map((it) => it.id).sort((a, b) => a - b);
  assert.deepEqual(ids, ADHKAR.map((d) => d.hisnId).sort((a, b) => a - b));
  for (const d of ADHKAR) { const it = hisnItem(d.hisnId); assert.ok(normalizeArabic(it.text).includes(normalizeArabic(d.text).split(' ').slice(0, 6).join(' ')), `الذكر ${d.hisnId}`); }
});
test('الصوت: رابط https لكل ذكر إلا ما لا تسجيل له في المصدر (153)', () => {
  const none = HISN_CHAPTERS.flatMap((c) => c.items).filter((it) => it.audio === false).map((it) => it.id);
  assert.deepEqual(none, [153]);
  assert.equal(hisnAudioUrl(75), 'https://www.hisnmuslim.com/audio/ar/75.mp3');
});
