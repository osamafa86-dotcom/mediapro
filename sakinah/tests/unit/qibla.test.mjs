import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as adhan from 'adhan';
import { bearingUncertainty, qiblaSpherical, qiblaInfo, vincentyInverse, distanceSphericalKm, sunQiblaMoments, kaabaZenithEvents, signedDifference, localMidnightUTC, compassPointAr } from '../../js/core/qibla.js';
import { sunPosition } from '../../js/core/astro.js';

const CITIES = [
  ['Makkah', 21.4225, 39.8262], ['Madinah', 24.4672, 39.6111], ['Riyadh', 24.7136, 46.6753], ['Amman', 31.9539, 35.9106],
  ['Cairo', 30.0444, 31.2357], ['Istanbul', 41.0082, 28.9784], ['London', 51.5074, -0.1278], ['New York', 40.7128, -74.006],
  ['Jakarta', -6.2088, 106.8456], ['Sydney', -33.8688, 151.2093], ['Karachi', 24.8607, 67.0011], ['Cape Town', -33.9249, 18.4241],
  ['Tokyo', 35.6762, 139.6503], ['Los Angeles', 34.0522, -118.2437], ['Anchorage', 61.2181, -149.9003], ['Buenos Aires', -34.6037, -58.3816],
];

test('الحل الكروي مطابق لـ adhan-js Qibla', () => {
  for (const [name, lat, lon] of CITIES) {
    const ours = qiblaSpherical(lat, lon), ref = adhan.Qibla(new adhan.Coordinates(lat, lon));
    assert.ok(Math.abs(signedDifference(ours, ref)) < 1e-6, `${name}: ${ours} vs ${ref}`);
  }
});

test('قيم معروفة: نيويورك ≈ 58.48°، لندن ≈ 118.99°، جاكرتا ≈ 295.15°', () => {
  assert.ok(Math.abs(qiblaSpherical(40.7128, -74.006) - 58.48) < 0.02);
  assert.ok(Math.abs(qiblaSpherical(51.5074, -0.1278) - 118.99) < 0.02);
  assert.ok(Math.abs(qiblaSpherical(-6.2088, 106.8456) - 295.15) < 0.02);
});

test('Vincenty: المسافة والاتجاه الجيوديسي معقولان ويقاربان الحل الكروي (فرق < 0.3°)', () => {
  for (const [name, lat, lon] of CITIES) {
    const info = qiblaInfo(lat, lon);
    assert.ok(Math.abs(info.difference) < 0.3, `${name} diff ${info.difference}`);
    const sph = distanceSphericalKm(lat, lon);
    assert.ok(Math.abs(info.distanceKm - sph) / Math.max(sph, 1) < 0.006, `${name} distance ${info.distanceKm} vs ${sph}`);
  }
  // مسافة معروفة: نيويورك ↔ مكة ≈ 10,300 كم؛ لندن ↔ مكة ≈ 4,800 كم
  assert.ok(Math.abs(qiblaInfo(40.7128, -74.006).distanceKm - 10300) < 60);
  assert.ok(Math.abs(qiblaInfo(51.5074, -0.1278).distanceKm - 4800) < 40);
  // على الكعبة نفسها
  assert.equal(vincentyInverse(21.4225241, 39.8261818).distanceKm, 0);
});

test('Vincenty متماثل: الاتجاه النهائي من A إلى B يعاكس الاتجاه الابتدائي من B إلى A', () => {
  const ab = vincentyInverse(31.9539, 35.9106, 21.4225241, 39.8261818);
  const ba = vincentyInverse(21.4225241, 39.8261818, 31.9539, 35.9106);
  assert.ok(Math.abs(ab.distanceKm - ba.distanceKm) < 1e-6);
  assert.ok(Math.abs(signedDifference(ab.finalBearing, ba.initialBearing + 180)) < 1e-6);
});

test('نقاط شبه متقابلة لا تُعطّل الحساب', () => {
  const info = qiblaInfo(-21.4225241, 39.8261818 - 180); // النقطة المقابلة للكعبة
  assert.ok(Number.isFinite(info.bearing));
  assert.ok(info.distanceKm > 19900 && info.distanceKm < 20100);
});

test('تعامد الشمس على الكعبة: 27/28 مايو ~09:18 UTC و15/16 يوليو ~09:27 UTC', () => {
  const ev = kaabaZenithEvents(2026);
  assert.equal(ev.length, 2);
  const [a, b] = ev;
  assert.ok(a.altitude > 89.9 && b.altitude > 89.9, `altitudes ${a.altitude} ${b.altitude}`);
  assert.equal(a.time.getUTCMonth(), 4); assert.ok([27, 28].includes(a.time.getUTCDate()));
  assert.ok(Math.abs(a.time.getUTCHours() * 60 + a.time.getUTCMinutes() - (9 * 60 + 18)) <= 2);
  assert.equal(b.time.getUTCMonth(), 6); assert.ok([15, 16].includes(b.time.getUTCDate()));
  assert.ok(Math.abs(b.time.getUTCHours() * 60 + b.time.getUTCMinutes() - (9 * 60 + 27)) <= 2);
});

test('لحظة الشمس في اتجاه القبلة: سمت الشمس يساوي اتجاه القبلة وقتها والشمس فوق الأفق', () => {
  const lat = 31.9539, lon = 35.9106, tz = 'Asia/Amman';
  const r = sunQiblaMoments(lat, lon, { year: 2026, month: 9, day: 6 }, tz);
  assert.ok(r.sunAtQibla instanceof Date, 'sunAtQibla exists in Amman in September (qibla ~158°)');
  const p = sunPosition(r.sunAtQibla, lat, lon);
  assert.ok(Math.abs(signedDifference(p.azimuth, r.bearing)) < 0.01, `az ${p.azimuth} vs ${r.bearing}`);
  assert.ok(p.altitude > 0);
  // في يوم التعامد على الكعبة تكون لحظة الشمس-القبلة في عمّان قريبة من 09:18 UTC
  const z = sunQiblaMoments(lat, lon, { year: 2026, month: 5, day: 28 }, tz);
  assert.ok(Math.abs(z.sunAtQibla.getTime() - Date.UTC(2026, 4, 28, 9, 18)) < 3 * 60000);
});

test('localMidnightUTC صحيح عبر مناطق زمنية مختلفة', () => {
  assert.equal(localMidnightUTC({ year: 2026, month: 9, day: 6 }, 'Asia/Riyadh').toISOString(), '2026-09-05T21:00:00.000Z');
  assert.equal(localMidnightUTC({ year: 2026, month: 9, day: 6 }, 'America/New_York').toISOString(), '2026-09-06T04:00:00.000Z');
  assert.equal(localMidnightUTC({ year: 2026, month: 1, day: 15 }, 'America/New_York').toISOString(), '2026-01-15T05:00:00.000Z');
});

test('الاتجاهات الاسمية بالعربية', () => {
  assert.equal(compassPointAr(0), 'شمال'); assert.equal(compassPointAr(150), 'جنوب شرق'); assert.equal(compassPointAr(295), 'شمال غرب');
});

test('نقاط الدائرة العظمى: تبدأ وتنتهي بالطرفين، وتمرّ شمالًا من نيويورك إلى مكة (التفسير البصري للاتجاه الشمالي الشرقي)', async () => {
  const { greatCirclePoints, KAABA } = await import('../../js/core/qibla.js');
  const pts = greatCirclePoints(40.7128, -74.006, KAABA.latitude, KAABA.longitude, 32);
  assert.equal(pts.length, 33);
  assert.ok(Math.abs(pts[0][0] - 40.7128) < 1e-9 && Math.abs(pts[0][1] + 74.006) < 1e-9);
  assert.ok(Math.abs(pts[32][0] - KAABA.latitude) < 1e-6 && Math.abs(pts[32][1] - KAABA.longitude) < 1e-6);
  const maxLat = Math.max(...pts.map((p) => p[0]));
  assert.ok(maxLat > 45 && maxLat < 55, `القوس يصعد إلى ${maxLat.toFixed(1)}° شمالًا (أعلى من طرفيه 40.7° و21.4°)`);
  // خطوط الطول تتزايد رتيبًا (لا يعبر خط التاريخ)
  for (let i = 1; i < pts.length; i++) assert.ok(pts[i][1] > pts[i - 1][1]);
  assert.deepEqual(greatCirclePoints(10, 10, 10, 10), [[10, 10], [10, 10]]);
});

test('هامش خطأ الاتجاه بسبب الموقع: مدينة «مكة» المحفوظة عند الكعبة → غير محدد؛ ±50 م على بعد 240 م ≈ ±12°؛ 8 كم على بعد 1000 كم < 0.5°', () => {
  const makkahPreset = qiblaInfo(21.4225, 39.8262); // إحداثيات مدينة مكة في القائمة = الكعبة تقريبًا
  assert.ok(makkahPreset.distanceKm < 0.01, `المسافة ${makkahPreset.distanceKm}`);
  assert.equal(bearingUncertainty(makkahPreset.distanceKm, 8000), 180);
  assert.ok(Math.abs(bearingUncertainty(0.24, 50) - 12.02) < 0.1);
  assert.ok(bearingUncertainty(1000, 8000) < 0.5);
  assert.equal(bearingUncertainty(0, 10), 180);
  assert.ok(bearingUncertainty(0.237, 20) < 5); // GPS جيد على بعد 237 م: هامش مقبول
});
