import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePrayerTimes, defaultParams, localNoonUTC, civilDate } from '../../js/core/prayer-times.js';
import { tzOffsetMinutes } from '../../js/platform/location.js';
import { JitterEstimator } from '../../js/platform/compass.js';
import { signedDifference } from '../../js/core/qibla.js';
import { normalizeArabic } from '../../js/core/arabic.js';
import { ADHKAR } from '../../js/data/adhkar.js';

test('P1: «تلقائي» بين 46.6° و48° يلجأ إلى نسبة زاوية الشفق لكل صلاة على حدة حين لا تتحقق الزاوية (زيورخ 21 يونيو، طريقة مصر)', () => {
  const zurich = { latitude: 47.3769, longitude: 8.5417 }, d = { year: 2026, month: 6, day: 21 };
  const auto = computePrayerTimes(zurich, d, defaultParams({ method: 'Egyptian', highLatitudeRule: 'auto', tz: 'Europe/Zurich' }));
  const twi = computePrayerTimes(zurich, d, defaultParams({ method: 'Egyptian', highLatitudeRule: 'twilightangle', tz: 'Europe/Zurich' }));
  const mid = computePrayerTimes(zurich, d, defaultParams({ method: 'Egyptian', highLatitudeRule: 'middleofthenight', tz: 'Europe/Zurich' }));
  assert.ok(auto.resolved.fajrSafe && auto.resolved.fajrRule === 'twilightangle', JSON.stringify(auto.resolved));
  assert.equal(auto.fajr.getTime(), twi.fajr.getTime(), 'الفجر التلقائي = نسبة زاوية الشفق');
  assert.ok(Math.abs(auto.fajr - mid.fajr) > 60 * 60000, 'الفرق عن منتصف الليل أكثر من ساعة (القفزة القديمة)');
  // في الشتاء تتحقق الزاوية فيبقى التلقائي بلا تقييد (منتصف الليل لا يُقيّد)
  const w = computePrayerTimes(zurich, { year: 2026, month: 1, day: 15 }, defaultParams({ method: 'Egyptian', highLatitudeRule: 'auto', tz: 'Europe/Zurich' }));
  assert.equal(w.resolved.fajrSafe, false); assert.equal(w.resolved.fajrRule, null);
  // فوق 48° لا يتغيّر السلوك القديم (فيينا)
  const vienna = computePrayerTimes({ latitude: 48.2082, longitude: 16.3738 }, d, defaultParams({ method: 'Egyptian', highLatitudeRule: 'auto', tz: 'Europe/Vienna' }));
  assert.equal(vienna.resolved.rule, 'twilightangle');
});

test('P2: بعد إزاحة خط التاريخ يعود التاريخ المطلوب لا المُزاح (آبيا 1 سبتمبر)', () => {
  const apia = { latitude: -13.8333, longitude: -171.75 }, d = { year: 2026, month: 9, day: 1 };
  const t = computePrayerTimes(apia, d, defaultParams({ method: 'MuslimWorldLeague', tz: 'Pacific/Apia' }));
  assert.deepEqual(t.date, d); assert.equal(t.resolved.dayShifted, true);
  assert.deepEqual(civilDate(t.dhuhr, 'Pacific/Apia'), d, 'الظهر يقع في اليوم المدني المطلوب');
});

test('P3: الظهيرة المحلية بدل 12:00 UTC (كيريتيماتي +14، عمّان صيفًا +3، نيويورك −4)', () => {
  const noon = (tz) => localNoonUTC({ year: 2026, month: 2, day: 17 }, tz);
  assert.equal(noon('Pacific/Kiritimati').toISOString(), '2026-02-16T22:00:00.000Z');
  assert.equal(noon('Asia/Amman').toISOString(), '2026-02-17T09:00:00.000Z');
  assert.equal(noon('America/New_York').toISOString(), '2026-02-17T17:00:00.000Z');
  assert.deepEqual(civilDate(noon('Pacific/Kiritimati'), 'Pacific/Kiritimati'), { year: 2026, month: 2, day: 17 });
});

test('P5: إزاحة المنطقة الزمنية بالدقائق (تُستخدم لتفضيل منطقة أقرب مدينة على منطقة الجهاز عند الاختلاف)', () => {
  const at = new Date('2026-07-01T12:00:00Z');
  assert.equal(tzOffsetMinutes('Asia/Riyadh', at), 180);
  assert.equal(tzOffsetMinutes('Asia/Kolkata', at), 330);
  assert.equal(tzOffsetMinutes('America/New_York', at), -240);
  assert.equal(tzOffsetMinutes('UTC', at), 0);
});

test('Q7: مقدّر تذبذب الاتجاه: دوران سلس ≈ دقة ممتازة، وضوضاء عشوائية ≈ دقة ضعيفة', () => {
  const smooth = new JitterEstimator(); let acc = null;
  for (let i = 0; i < 30; i++) acc = smooth.push((i * 3) % 360); // دوران 3° لكل قراءة
  assert.equal(acc, 0);
  const noisy = new JitterEstimator(); let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 30; i++) acc = noisy.push(90 + (rnd() - 0.5) * 40);
  assert.ok(acc >= 8, `ضوضاء ±20° → دقة مقدّرة ${acc}`);
  const wrap = new JitterEstimator(); for (let i = 0; i < 30; i++) acc = wrap.push((358 + i * 0.5) % 360); // عبور الشمال دون قفزة
  assert.equal(acc, 0);
});

test('Q2: زاوية متراكمة غير ملفوفة تعبر الشمال بأقصر مسار (359° → 1° تتحرك درجتين لا 358°)', () => {
  let rose = 0; const step = (heading) => { rose += signedDifference(-heading, rose); return rose; };
  step(350); step(359); const before = rose; step(1);
  assert.ok(Math.abs(rose - before) <= 2.001, `الفرق ${rose - before}`);
  step(180); step(181); const b2 = rose; step(179); assert.ok(Math.abs(rose - b2) <= 2.001, 'عبور ±180 دون دورة كاملة');
});

test('D4/D5: التطبيع الموحّد يجعل ﷺ وصيغتها المكتوبة واحدة، وكلمة «نبيّنا» صُحّحت حركتها', () => {
  assert.equal(normalizeArabic('قال رسول الله صلى الله عليه وسلم'), normalizeArabic('قال رسول الله ﷺ'));
  const bad = '\u0646\u064e\u0628\u064e\u064a'; // نَبَي (فتحة على الباء)
  const good = '\u0646\u064e\u0628\u0650\u064a\u0651'; // نَبِيّ
  assert.ok(!ADHKAR.some((d) => (d.text + (d.textEvening || '')).includes(bad)), 'لا فتحة على باء نبيّنا');
  assert.ok(ADHKAR.some((d) => d.text.includes(good)));
});
