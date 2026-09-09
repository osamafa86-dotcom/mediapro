import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wordAt, RECITERS, hasWordTiming, reciterBitrate, ayahAudioUrl } from '../../js/platform/audio.js';
import { makePlan, planStatus, streak, logPage, stats, daysBetween, addDaysKey } from '../../js/core/khatmah.js';

test('توقيتات الكلمات: البحث الثنائي يعيد موضع الكلمة الجارية ويثبّت الأخيرة بين المقاطع', () => {
  const seg = [[1, 60, 610], [2, 620, 1310], [3, 1320, 2450], [4, 2460, 5970]];
  assert.equal(wordAt(seg, 0.0), null); assert.equal(wordAt(seg, 0.1), 1); assert.equal(wordAt(seg, 0.615), 1); assert.equal(wordAt(seg, 1.0), 2); assert.equal(wordAt(seg, 3.0), 4); assert.equal(wordAt(seg, 9), 4);
  assert.equal(wordAt(null, 1), null); assert.equal(wordAt([], 1), null);
});
test('القرّاء: 21 قارئًا، 12 منهم بتوقيتات كلمات، والقرّاء الحصريون لـ quran.com بلا معدلات Islamic Network', () => {
  assert.equal(RECITERS.length, 21);
  assert.equal(RECITERS.filter((r) => r.qdc).length, 12);
  for (const r of RECITERS.filter((r) => r.id.startsWith('qdc.'))) { assert.ok(r.qdc && r.bitrates.length === 0, r.id); assert.equal(reciterBitrate(r.id), null); }
  assert.ok(hasWordTiming('ar.alafasy') && !hasWordTiming('ar.mahermuaiqly'));
  assert.equal(ayahAudioUrl('ar.abdurrahmaansudais', 5), 'https://cdn.islamic.network/quran/audio/64/ar.abdurrahmaansudais/5.mp3');
  assert.ok(new Set(RECITERS.map((r) => r.id)).size === RECITERS.length && new Set(RECITERS.filter((r) => r.qdc).map((r) => r.qdc)).size === 12);
});
test('خطة الختمة: الصفحات اليومية، التقدّم مع الالتفاف، التأخّر، السلسلة، وسجل الصفحات', () => {
  const plan = makePlan({ startPage: 300, startedAt: '2026-09-01', days: 30 });
  assert.equal(plan.dailyPages, 21);
  assert.equal(makePlan({ startPage: 1, startedAt: '2026-09-01', days: 604 }).dailyPages, 1);
  // اليوم الثالث، وصل الصفحة 340 (40 صفحة)، المتوقع 63 → متأخر 23
  let log = {}; for (const p of [301, 302, 303]) log = logPage(log, '2026-09-03', p);
  const st = planStatus(plan, 340, log, '2026-09-03');
  assert.equal(st.done, 40); assert.equal(st.dayIndex, 2); assert.equal(st.expected, 63); assert.equal(st.behind, 23); assert.equal(st.todayPages, 3); assert.equal(st.todayTarget, 44);
  // الالتفاف: بدأ من 600 ووصل الصفحة 10 → 14 صفحة
  assert.equal(planStatus(makePlan({ startPage: 600, startedAt: '2026-09-01', days: 30 }), 10, {}, '2026-09-01').done, 14);
  // السلسلة: قرأ أمس وقبله ولم يقرأ اليوم بعد → 2
  let l2 = {}; l2 = logPage(l2, '2026-09-08', 5); l2 = logPage(l2, '2026-09-07', 4); l2 = logPage(l2, '2026-09-05', 1);
  assert.equal(streak(l2, '2026-09-09'), 2); assert.equal(streak(logPage(l2, '2026-09-09', 6), '2026-09-09'), 3);
  assert.deepEqual(logPage({ '2026-09-09': [3] }, '2026-09-09', 3)['2026-09-09'], [3], 'لا تكرار');
  assert.equal(daysBetween('2026-09-01', '2026-09-09'), 8); assert.equal(addDaysKey('2026-09-30', 1), '2026-10-01');
  const s = stats({ '2026-09-09': [1, 2], '2026-09-03': [1], '2026-08-15': [1, 2, 3] }, '2026-09-09');
  assert.equal(s.week, 3); assert.equal(s.month, 6);
});
