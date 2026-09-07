/**
 * اختبارات انحدار للمشكلات التي كشفتها المراجعة العدائية.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePrayerTimes, defaultParams, dayTimeline, civilDate, addDays, resolveMethodParams } from '../../js/core/prayer-times.js';
import { hijriDate } from '../../js/core/hijri.js';
import { localMidnightUTC, sunQiblaMoments, qiblaInfo } from '../../js/core/qibla.js';
import { headingFromEuler } from '../../js/platform/compass.js';
import { sunPosition } from '../../js/core/astro.js';

test('المناطق التي يخالف توقيتها خط طولها بأكثر من 12 ساعة: المواقيت تقع في اليوم المدني المطلوب (آبيا، كيريتيماتي)', () => {
  for (const [name, lat, lon, tz] of [['Apia', -13.8333, -171.7667, 'Pacific/Apia'], ['Kiritimati', 1.8721, -157.4278, 'Pacific/Kiritimati'], ['Nukualofa', -21.1394, -175.2018, 'Pacific/Tongatapu'], ['Adak', 51.88, -176.65, 'America/Adak']]) {
    for (const d of [{ year: 2026, month: 9, day: 15 }, { year: 2026, month: 1, day: 3 }, { year: 2026, month: 6, day: 21 }]) {
      const t = computePrayerTimes({ latitude: lat, longitude: lon }, d, defaultParams({ method: 'MuslimWorldLeague', tz }));
      assert.deepEqual(civilDate(t.dhuhr, tz), d, `${name} dhuhr civil date`);
      assert.deepEqual(civilDate(t.maghrib, tz), d, `${name} maghrib civil date`);
      assert.ok(t.fajr < t.sunrise && t.sunrise < t.dhuhr && t.dhuhr < t.asr && t.asr < t.maghrib && t.maghrib < t.isha, `${name} order`);
    }
  }
  // بدون tz يبقى السلوك القديم (متوافق مع adhan)
  const noTz = computePrayerTimes({ latitude: -13.8333, longitude: -171.7667 }, { year: 2026, month: 9, day: 15 }, defaultParams({ method: 'MuslimWorldLeague' }));
  assert.equal(noTz.resolved.dayShifted, false);
});

test('عشاء الأمس بعد منتصف الليل (أوسلو صيفًا): يبقى "التالي" هو العشاء ولا يُقفز إلى الفجر', () => {
  const oslo = { latitude: 59.9139, longitude: 10.7522 }, tz = 'Europe/Oslo';
  const p = defaultParams({ method: 'MuslimWorldLeague' }); // تلقائي: زاوية الشفق فوق 48°
  const y = computePrayerTimes(oslo, { year: 2026, month: 6, day: 20 }, defaultParams({ ...p, tz }));
  assert.ok(civilDate(y.isha, tz).day === 21, `isha of June 20 falls after midnight: ${y.isha.toISOString()}`);
  const now = new Date(y.isha.getTime() - 5 * 60000); // 00:07 بتوقيت أوسلو: بعد منتصف الليل وقبل عشاء الأمس بخمس دقائق
  assert.equal(civilDate(now, tz).day, 21);
  const tl = dayTimeline(oslo, tz, p, now);
  assert.equal(tl.next.key, 'isha'); assert.equal(tl.next.isYesterday, true); assert.equal(tl.current, 'maghrib');
  assert.equal(tl.next.time.getTime(), y.isha.getTime());
  const after = dayTimeline(oslo, tz, p, new Date(y.isha.getTime() + 60000));
  assert.equal(after.next.key, 'fajr'); assert.equal(after.current, 'isha');
});

test('قبل الفجر يعود منتصف الليل والثلث الأخير لليلة الجارية (مغرب الأمس → فجر اليوم)', () => {
  const c = { latitude: 24.7136, longitude: 46.6753 }, tz = 'Asia/Riyadh', p = defaultParams({ method: 'UmmAlQura' });
  const early = dayTimeline(c, tz, p, new Date(Date.UTC(2026, 8, 6, 23, 0))); // 02:00 صباح 7 سبتمبر بالرياض
  const yesterday = computePrayerTimes(c, { year: 2026, month: 9, day: 6 }, p);
  const today = computePrayerTimes(c, { year: 2026, month: 9, day: 7 }, p);
  const expectedMid = new Date(yesterday.maghrib.getTime() + (today.fajr - yesterday.maghrib) / 2);
  assert.ok(Math.abs(early.sunnah.middleOfNight - expectedMid) <= 60000, `mid ${early.sunnah.middleOfNight.toISOString()} vs ${expectedMid.toISOString()}`);
  assert.ok(early.sunnah.middleOfNight < today.fajr && early.sunnah.lastThird < today.fajr);
});

test('الطريقة المخصّصة تتجاهل القيم غير الصالحة وتعود للافتراضي', () => {
  const bad = resolveMethodParams(defaultParams({ method: 'Custom', custom: { fajrAngle: 0, ishaAngle: NaN, ishaInterval: -5, maghribAngle: 90 } }));
  assert.deepEqual([bad.fajrAngle, bad.ishaAngle, bad.ishaInterval, bad.maghribAngle], [18, 17, 0, 0]);
  const good = resolveMethodParams(defaultParams({ method: 'Custom', custom: { fajrAngle: 19.5, ishaAngle: 17.5, ishaInterval: 0, maghribAngle: 4 } }));
  assert.deepEqual([good.fajrAngle, good.ishaAngle, good.maghribAngle], [19.5, 17.5, 4]);
});

test('إزاحة التاريخ الهجري تعمل على مستوى اليوم المدني حتى في ليلة التوقيت الصيفي', () => {
  // في عمّان (كانت تطبق التوقيت الصيفي حتى 2022) نستخدم أوروبا/برلين: 29 مارس 2026 قفزة الساعة 02:00 → 03:00
  const t = new Date(Date.UTC(2026, 2, 29, 0, 30)); // 01:30 بتوقيت برلين (قبل القفزة)
  const base = hijriDate(t, 'Europe/Berlin', 0), minus = hijriDate(t, 'Europe/Berlin', -1);
  assert.equal(base.day - minus.day, 1, 'exactly one day back');
});

test('localMidnightUTC عند تحويل التوقيت الصيفي منتصف الليل (القاهرة 2026) يعطي أول لحظة في اليوم المدني', () => {
  // مصر: التوقيت الصيفي يبدأ آخر جمعة من أبريل عند 00:00 → 01:00 (24 أبريل 2026)
  const m = localMidnightUTC({ year: 2026, month: 4, day: 24 }, 'Africa/Cairo');
  assert.deepEqual(civilDate(m, 'Africa/Cairo'), { year: 2026, month: 4, day: 24 });
  assert.deepEqual(civilDate(new Date(m.getTime() - 60000), 'Africa/Cairo'), { year: 2026, month: 4, day: 23 });
});

test('sunQiblaMoments لا تعطي عبورًا زائفًا قرب سمت الرأس (خط الاستواء يوم الاعتدال)', () => {
  const r = sunQiblaMoments(0.0, 39.8262, { year: 2026, month: 3, day: 20 }, 'Africa/Nairobi');
  for (const k of ['sunAtQibla', 'shadowAtQibla']) if (r[k]) {
    const p = sunPosition(r[k], 0.0, 39.8262);
    assert.ok(p.altitude < 85, `${k} altitude ${p.altitude}`);
  }
});

test('qiblaInfo يعلّم النقاط شبه المقابلة للكعبة', () => {
  assert.equal(qiblaInfo(-21.4225241, -140.1738182).antipodal, true);
  assert.equal(qiblaInfo(31.95, 35.91).antipodal, false);
});

test('headingFromEuler لا يقفز عند الانتقال بين الوضع الأفقي والرأسي مع وجود ميل جانبي', () => {
  let prev = null, maxJump = 0;
  for (let beta = 60; beta <= 90; beta += 0.5) {
    const hdg = headingFromEuler(40, beta, 15);
    if (prev !== null) { let d = Math.abs(hdg - prev); if (d > 180) d = 360 - d; maxJump = Math.max(maxJump, d); }
    prev = hdg;
  }
  assert.ok(maxJump < 3, `max jump ${maxJump}`);
});
