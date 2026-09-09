/** المرحلة 3: المسبحة، لفّ أسطر بطاقة المشاركة، تذكيرات الأذكار وحديث اليوم، ومعرّفات الإشعارات الأصلية. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTasbih, normalizeTasbih, tap, undo, resetCount, todayCount, totalCount, grandTotal, phraseText, TASBIH_PHRASES } from '../../js/core/tasbih.js';
import { wrapLines, fontSizeFor } from '../../js/core/share-card.js';
import { buildExtraReminders, zonedDate } from '../../js/platform/notifications.js';
import { numericId } from '../../js/platform/native-notifications.js';

test('المسبحة: الهدف 33 يكمل دورة ويعود للصفر، والإحصاء يتراكم', () => {
  let s = defaultTasbih(); let reached = 0;
  for (let i = 0; i < 33; i++) { const r = tap(s, '2026-09-09'); s = r.state; if (r.reached) reached++; }
  assert.equal(reached, 1); assert.equal(s.count, 0); assert.equal(s.rounds, 1);
  s = tap(s, '2026-09-09').state; assert.equal(s.count, 1);
  assert.equal(totalCount(s), 34); assert.equal(todayCount(s, '2026-09-09'), 34); assert.equal(todayCount(s, '2026-09-10'), 0);
  s = tap(s, '2026-09-10').state; assert.equal(todayCount(s, '2026-09-10'), 1); assert.equal(totalCount(s), 35);
  s = undo(s, '2026-09-10'); assert.equal(s.count, 1); assert.equal(totalCount(s), 34);
  s = undo(s, '2026-09-10'); s = undo(s, '2026-09-10'); assert.equal(s.count, 32); assert.equal(s.rounds, 0);
  s = resetCount(s); assert.equal(s.count, 0); assert.equal(totalCount(s), 32);
  s = { ...s, phrase: 'hamd' }; s = tap(s, '2026-09-10').state; assert.equal(grandTotal(s), 33);
  assert.equal(phraseText({ ...s, phrase: 'custom', custom: '  ' }), 'ذكر'); assert.equal(phraseText({ ...s, phrase: 'subhan' }), TASBIH_PHRASES[0].text);
  const unl = { ...defaultTasbih(), target: 0 }; let u = unl; for (let i = 0; i < 40; i++) u = tap(u, 'd').state; assert.equal(u.count, 40); assert.equal(u.rounds, 0);
  assert.deepEqual(normalizeTasbih(null), defaultTasbih()); assert.equal(normalizeTasbih({ phrase: 'akbar', totals: 5 }).phrase, 'akbar');
});
test('لفّ الأسطر: يحترم العرض والفقرات ويُبقي الكلمة الطويلة وحدها', () => {
  const m = (s) => s.length * 10;
  assert.deepEqual(wrapLines(m, 'كلمة كلمة كلمة كلمة', 100), ['كلمة كلمة', 'كلمة كلمة']);
  assert.deepEqual(wrapLines(m, 'أ\n\nب', 100), ['أ', '', 'ب']);
  assert.deepEqual(wrapLines(m, 'كلمةطويلةجدًاجدًا ب', 50), ['كلمةطويلةجدًاجدًا', 'ب']);
  assert.ok(fontSizeFor(50) > fontSizeFor(400) && fontSizeFor(400) > fontSizeFor(1000));
});
test('تذكيرات الأذكار: بعد الفجر والعصر بالدقائق المختارة، وتُحذف عند الإيقاف', () => {
  const fajr = new Date('2026-09-09T02:10:00Z'), asr = new Date('2026-09-09T12:30:00Z');
  const out = buildExtraReminders({ fajr, asr }, { adhkar: { morning: true, evening: true, morningAfter: 20, eveningAfter: 45 } }, '2026-9-9');
  assert.equal(out.length, 2);
  assert.equal(out[0].kind, 'adhkar'); assert.equal(out[0].prayer, 'fajr'); assert.equal(out[0].time.getTime(), fajr.getTime() + 20 * 60000); assert.equal(out[0].url, './index.html#/adhkar');
  assert.equal(out[1].prayer, 'asr'); assert.equal(out[1].time.getTime(), asr.getTime() + 45 * 60000);
  assert.deepEqual(buildExtraReminders({ fajr, asr }, { adhkar: { morning: false, evening: false } }, 'k'), []);
  assert.deepEqual(buildExtraReminders({ fajr: new Date(NaN), asr }, { adhkar: { morning: true, evening: false } }, 'k'), []);
});
test('حديث اليوم في الوقت المحلي للمنطقة، مع الانتقال الصيفي', () => {
  assert.equal(zonedDate({ year: 2026, month: 9, day: 9 }, 9, 30, 'Asia/Amman').toISOString(), '2026-09-09T06:30:00.000Z');
  assert.equal(zonedDate({ year: 2026, month: 1, day: 15 }, 9, 0, 'America/New_York').toISOString(), '2026-01-15T14:00:00.000Z');
  assert.equal(zonedDate({ year: 2026, month: 7, day: 15 }, 9, 0, 'America/New_York').toISOString(), '2026-07-15T13:00:00.000Z');
  const out = buildExtraReminders({}, { hadithDaily: { enabled: true, time: '07:15' } }, '2026-9-9', { civil: { year: 2026, month: 9, day: 9 }, tz: 'Asia/Riyadh', hadith: 'نص' });
  assert.equal(out.length, 1); assert.equal(out[0].kind, 'hadith'); assert.equal(out[0].time.toISOString(), '2026-09-09T04:15:00.000Z'); assert.equal(out[0].body, 'نص'); assert.equal(out[0].url, './index.html#/hadith');
  assert.equal(buildExtraReminders({}, { hadithDaily: { enabled: true } }, 'k', { civil: { year: 2026, month: 9, day: 9 }, tz: 'Asia/Riyadh', hadith: '' }).length, 0);
});
test('معرّفات الإشعارات الأصلية متمايزة لكل الأنواع في اليوم نفسه', () => {
  const t = new Date('2026-09-09T05:00:00Z');
  const ids = [
    { time: t, kind: 'adhan', prayer: 'fajr' }, { time: t, kind: 'pre', prayer: 'fajr' }, { time: t, kind: 'adhkar', prayer: 'fajr' },
    { time: t, kind: 'sunrise' }, { time: t, kind: 'hadith' }, { time: t, kind: 'adhan', prayer: 'asr' }, { time: t, kind: 'adhkar', prayer: 'asr' },
  ].map(numericId);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => Number.isInteger(id) && id > 0 && id < 2 ** 31));
});
