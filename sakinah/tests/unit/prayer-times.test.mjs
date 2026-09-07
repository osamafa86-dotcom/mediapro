/**
 * اختبارات مطابقة محرك مواقيت الصلاة مقابل adhan-js (المرجع) عبر مواقع/تواريخ/طرق متعددة،
 * واختبارات سلوكية (المذهب الحنفي، خطوط العرض العالية، المناطق القطبية، التعديلات، المنطقة الزمنية).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as adhan from 'adhan';
import { computePrayerTimes, defaultParams, civilDate, dayTimeline, sunnahTimes, monthTable, PRAYERS } from '../../js/core/prayer-times.js';
import { METHODS } from '../../js/core/methods.js';

const LOCATIONS = [
  ['Makkah', 21.4225, 39.8262], ['Madinah', 24.4672, 39.6111], ['Riyadh', 24.7136, 46.6753],
  ['Amman', 31.9539, 35.9106], ['Cairo', 30.0444, 31.2357], ['Istanbul', 41.0082, 28.9784],
  ['London', 51.5074, -0.1278], ['New York', 40.7128, -74.006], ['Jakarta', -6.2088, 106.8456],
  ['Sydney', -33.8688, 151.2093], ['Karachi', 24.8607, 67.0011], ['Casablanca', 33.5731, -7.5898],
  ['Oslo', 59.9139, 10.7522], ['Anchorage', 61.2181, -149.9003], ['Buenos Aires', -34.6037, -58.3816],
  ['Tokyo', 35.6762, 139.6503], ['Auckland', -36.8485, 174.7633], ['Honolulu', 21.3069, -157.8583],
  ['Cape Town', -33.9249, 18.4241], ['Kuala Lumpur', 3.139, 101.6869],
];
const DATES = [
  [2026, 1, 1], [2026, 3, 20], [2026, 6, 21], [2026, 9, 6], [2026, 9, 23], [2026, 12, 21],
  [2027, 2, 28], [2028, 2, 29], [2025, 7, 4], [2030, 11, 15],
];
// الطرق المشتركة مع adhan-js وأسماؤها هناك
const ADHAN_METHODS = {
  MuslimWorldLeague: 'MuslimWorldLeague', Egyptian: 'Egyptian', Karachi: 'Karachi', UmmAlQura: 'UmmAlQura',
  Dubai: 'Dubai', MoonsightingCommittee: 'MoonsightingCommittee', NorthAmerica: 'NorthAmerica', Kuwait: 'Kuwait',
  Qatar: 'Qatar', Singapore: 'Singapore', Tehran: 'Tehran', Turkey: 'Turkey',
};

function adhanTimes(lat, lon, [y, m, d], methodId, { madhab = 'shafi', rule = 'middleofthenight' } = {}) {
  const params = adhan.CalculationMethod[ADHAN_METHODS[methodId]]();
  params.madhab = madhab === 'hanafi' ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
  params.highLatitudeRule = rule;
  // adhan يستخدم مكوّنات التاريخ المحلي لجهاز التشغيل؛ نبني التاريخ محليًا بنفس المكوّنات
  return new adhan.PrayerTimes(new adhan.Coordinates(lat, lon), new Date(y, m - 1, d), params);
}

test('مطابقة تامة مع adhan-js لكل الطرق المشتركة عبر 20 موقعًا و10 تواريخ', () => {
  let compared = 0; const diffs = [];
  for (const [name, lat, lon] of LOCATIONS) {
    for (const date of DATES) {
      for (const methodId of Object.keys(ADHAN_METHODS)) {
        const ours = computePrayerTimes({ latitude: lat, longitude: lon }, { year: date[0], month: date[1], day: date[2] },
          defaultParams({ method: methodId, highLatitudeRule: 'middleofthenight', polarResolution: 'unresolved' }));
        const ref = adhanTimes(lat, lon, date, methodId);
        for (const k of PRAYERS) {
          const a = ours[k].getTime(), b = ref[k].getTime();
          compared++;
          if (Number.isNaN(a) && Number.isNaN(b)) continue;
          if (a !== b) diffs.push(`${name} ${date.join('-')} ${methodId} ${k}: ours=${ours[k].toISOString()} adhan=${ref[k].toISOString()}`);
        }
      }
    }
  }
  assert.ok(compared > 10000, 'compared enough');
  assert.deepEqual(diffs.slice(0, 20), [], `${diffs.length} mismatches out of ${compared}\n` + diffs.slice(0, 20).join('\n'));
});

test('مطابقة المذهب الحنفي وقواعد خطوط العرض العالية مع adhan-js', () => {
  const diffs = [];
  for (const [name, lat, lon] of LOCATIONS) {
    for (const date of DATES.slice(0, 6)) {
      for (const rule of ['middleofthenight', 'seventhofthenight', 'twilightangle']) {
        for (const madhab of ['shafi', 'hanafi']) {
          const ours = computePrayerTimes({ latitude: lat, longitude: lon }, { year: date[0], month: date[1], day: date[2] },
            defaultParams({ method: 'MuslimWorldLeague', madhab, highLatitudeRule: rule, polarResolution: 'unresolved' }));
          const ref = adhanTimes(lat, lon, date, 'MuslimWorldLeague', { madhab, rule });
          for (const k of PRAYERS) {
            const a = ours[k].getTime(), b = ref[k].getTime();
            if (Number.isNaN(a) && Number.isNaN(b)) continue;
            if (a !== b) diffs.push(`${name} ${date.join('-')} ${rule} ${madhab} ${k}: ${ours[k].toISOString()} vs ${ref[k].toISOString()}`);
          }
        }
      }
    }
  }
  assert.deepEqual(diffs.slice(0, 20), [], `${diffs.length} mismatches\n` + diffs.slice(0, 20).join('\n'));
});

test('قاعدة "تلقائي" تختار نسبة زاوية الشفق فوق خط عرض 48 ومنتصف الليل دونه', () => {
  const d = { year: 2026, month: 6, day: 21 };
  const oslo = { latitude: 59.9139, longitude: 10.7522 };
  const auto = computePrayerTimes(oslo, d, defaultParams({ method: 'MuslimWorldLeague', highLatitudeRule: 'auto' }));
  const twilight = computePrayerTimes(oslo, d, defaultParams({ method: 'MuslimWorldLeague', highLatitudeRule: 'twilightangle' }));
  assert.equal(auto.fajr.getTime(), twilight.fajr.getTime());
  assert.equal(auto.isha.getTime(), twilight.isha.getTime());
  assert.ok(auto.resolved.fajrSafe && auto.resolved.ishaSafe, 'في أوسلو صيفًا لا يتحقق شفق 18° فتُستخدم القاعدة');
  const cairo = { latitude: 30.0444, longitude: 31.2357 };
  const autoC = computePrayerTimes(cairo, d, defaultParams({ method: 'Egyptian', highLatitudeRule: 'auto' }));
  const midC = computePrayerTimes(cairo, d, defaultParams({ method: 'Egyptian', highLatitudeRule: 'middleofthenight' }));
  assert.equal(autoC.fajr.getTime(), midC.fajr.getTime());
});

test('المناطق القطبية: أقرب بلد يعطي أوقاتًا صالحة في ترومسو صيفًا وشتاءً', () => {
  const tromso = { latitude: 69.6492, longitude: 18.9553 };
  for (const d of [{ year: 2026, month: 6, day: 21 }, { year: 2026, month: 12, day: 21 }]) {
    const t = computePrayerTimes(tromso, d, defaultParams({ method: 'MuslimWorldLeague' }));
    for (const k of PRAYERS) assert.ok(!Number.isNaN(t[k].getTime()), `${k} should be valid on ${d.month}/${d.day}`);
    assert.ok(t.resolved.polarResolved);
    assert.ok(t.fajr < t.sunrise && t.sunrise < t.dhuhr && t.dhuhr < t.asr && t.asr < t.maghrib && t.maghrib < t.isha);
  }
  const unresolved = computePrayerTimes(tromso, { year: 2026, month: 6, day: 21 }, defaultParams({ method: 'MuslimWorldLeague', polarResolution: 'unresolved' }));
  assert.ok(Number.isNaN(unresolved.sunrise.getTime()));
});

test('أم القرى: العشاء بعد المغرب بـ 90 دقيقة، و120 دقيقة في رمضان', () => {
  const c = { latitude: 21.4225, longitude: 39.8262 }, d = { year: 2026, month: 3, day: 1 };
  const t = computePrayerTimes(c, d, defaultParams({ method: 'UmmAlQura' }));
  assert.equal((t.isha - t.maghrib) / 60000, 90);
  const r = computePrayerTimes(c, d, defaultParams({ method: 'UmmAlQura', isRamadan: true }));
  assert.equal((r.isha - r.maghrib) / 60000, 120);
});

test('الأردن: المغرب بعد الغروب بخمس دقائق والعشاء بزاوية 18°', () => {
  const c = { latitude: 31.9539, longitude: 35.9106 }, d = { year: 2026, month: 9, day: 6 };
  const t = computePrayerTimes(c, d, defaultParams({ method: 'Jordan' }));
  assert.equal((t.maghrib - t.sunset) / 60000, 5);
  const mwl = computePrayerTimes(c, d, defaultParams({ method: 'Karachi' })); // 18/18 بلا تعديل مغرب
  assert.equal(t.isha.getTime(), mwl.isha.getTime());
  assert.equal(t.fajr.getTime(), mwl.fajr.getTime());
});

test('تعديلات المستخدم تُضاف بالدقائق لكل صلاة', () => {
  const c = { latitude: 24.7136, longitude: 46.6753 }, d = { year: 2026, month: 9, day: 6 };
  const base = computePrayerTimes(c, d, defaultParams({ method: 'UmmAlQura' }));
  const adj = computePrayerTimes(c, d, defaultParams({ method: 'UmmAlQura', adjustments: { fajr: 2, isha: -3 } }));
  assert.equal((adj.fajr - base.fajr) / 60000, 2);
  assert.equal((adj.isha - base.isha) / 60000, -3);
  assert.equal(adj.dhuhr.getTime(), base.dhuhr.getTime());
});

test('الطريقة المخصّصة تستخدم الزوايا المعطاة', () => {
  const c = { latitude: 30.0444, longitude: 31.2357 }, d = { year: 2026, month: 9, day: 6 };
  const custom = computePrayerTimes(c, d, defaultParams({ method: 'Custom', custom: { fajrAngle: 19.5, ishaAngle: 17.5 } }));
  const egy = computePrayerTimes(c, d, defaultParams({ method: 'Egyptian' }));
  // المصرية تضيف دقيقة للظهر فقط؛ الفجر والعشاء يجب أن يتطابقا
  assert.equal(custom.fajr.getTime(), egy.fajr.getTime());
  assert.equal(custom.isha.getTime(), egy.isha.getTime());
});

test('civilDate تعطي اليوم المدني الصحيح في منطقة المستخدم لا منطقة الجهاز', () => {
  const instant = new Date(Date.UTC(2026, 8, 6, 22, 30)); // 22:30 UTC
  assert.deepEqual(civilDate(instant, 'Asia/Riyadh'), { year: 2026, month: 9, day: 7 }); // 01:30 من اليوم التالي
  assert.deepEqual(civilDate(instant, 'America/Los_Angeles'), { year: 2026, month: 9, day: 6 });
  assert.deepEqual(civilDate(instant, 'Pacific/Auckland'), { year: 2026, month: 9, day: 7 });
});

test('dayTimeline: قبل الفجر تكون التالية الفجر، وبعد العشاء تكون فجر الغد', () => {
  const c = { latitude: 21.4225, longitude: 39.8262 }, tz = 'Asia/Riyadh', p = defaultParams({ method: 'UmmAlQura' });
  const early = dayTimeline(c, tz, p, new Date(Date.UTC(2026, 8, 6, 0, 30))); // 03:30 محليًا
  assert.equal(early.next.key, 'fajr'); assert.equal(early.next.isTomorrow, false); assert.equal(early.current, 'isha');
  const late = dayTimeline(c, tz, p, new Date(Date.UTC(2026, 8, 6, 19, 0))); // 22:00 محليًا
  assert.equal(late.next.key, 'fajr'); assert.equal(late.next.isTomorrow, true); assert.equal(late.current, 'isha');
  assert.equal(late.next.time.toISOString(), '2026-09-07T01:48:00.000Z');
  const noon = dayTimeline(c, tz, p, new Date(Date.UTC(2026, 8, 6, 10, 0)));
  assert.equal(noon.current, 'dhuhr'); assert.equal(noon.next.key, 'asr');
});

test('منتصف الليل والثلث الأخير مطابقان لـ adhan SunnahTimes', () => {
  const c = { latitude: 31.9539, longitude: 35.9106 };
  const ours = sunnahTimes(c, { year: 2026, month: 9, day: 6 }, defaultParams({ method: 'MuslimWorldLeague' }));
  const ref = new adhan.SunnahTimes(adhanTimes(31.9539, 35.9106, [2026, 9, 6], 'MuslimWorldLeague'));
  assert.equal(ours.middleOfNight.getTime(), ref.middleOfTheNight.getTime());
  assert.equal(ours.lastThird.getTime(), ref.lastThirdOfTheNight.getTime());
});

test('الجدول الشهري يعطي عدد أيام الشهر الصحيح', () => {
  const rows = monthTable({ latitude: 24.7136, longitude: 46.6753 }, 2028, 2, defaultParams({ method: 'UmmAlQura' }));
  assert.equal(rows.length, 29);
  assert.ok(rows.every(r => r.fajr < r.isha));
});

test('كل طرق الحساب المعرّفة تنتج أوقاتًا مرتبة في الرياض', () => {
  const c = { latitude: 24.7136, longitude: 46.6753 }, d = { year: 2026, month: 9, day: 6 };
  for (const id of Object.keys(METHODS)) {
    const t = computePrayerTimes(c, d, defaultParams({ method: id }));
    assert.ok(t.fajr < t.sunrise && t.sunrise < t.dhuhr && t.dhuhr < t.asr && t.asr < t.maghrib && t.maghrib < t.isha, `order for ${id}`);
  }
});
