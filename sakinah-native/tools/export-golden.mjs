// يولّد بيانات المرجع الذهبية من محرك نسخة الويب (المُتحقَّق منه ضد adhan-js وAlAdhan) لاختبار النواة الأصلية
// التشغيل: node sakinah-native/tools/export-golden.mjs  (من جذر المستودع) → Tests/SakinahCoreTests/Fixtures/golden.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, '../../sakinah/js/core');
const { computePrayerTimes, dayTimeline, sunnahTimes, defaultParams } = await import(path.join(web, 'prayer-times.js'));
const { defaultMethodFor } = await import(path.join(web, 'methods.js'));
const { hijriDate } = await import(path.join(web, 'hijri.js'));
const { qiblaInfo, sunQiblaMoments, kaabaZenithEvents } = await import(path.join(web, 'qibla.js'));
const { magneticField } = await import(path.join(web, 'geomag.js'));

const ep = (d) => (d instanceof Date && !isNaN(d) ? Math.round(d.getTime() / 1000) : null);
const places = [
  ['Makkah', 21.4225, 39.8262, 'Asia/Riyadh', 'SA'], ['Riyadh', 24.7136, 46.6753, 'Asia/Riyadh', 'SA'], ['Amman', 31.9539, 35.9106, 'Asia/Amman', 'JO'],
  ['Cairo', 30.0444, 31.2357, 'Africa/Cairo', 'EG'], ['Istanbul', 41.0082, 28.9784, 'Europe/Istanbul', 'TR'], ['London', 51.5074, -0.1278, 'Europe/London', 'GB'],
  ['Oslo', 59.9139, 10.7522, 'Europe/Oslo', 'NO'], ['Tromso', 69.6496, 18.9560, 'Europe/Oslo', 'NO'], ['Reykjavik', 64.1466, -21.9426, 'Atlantic/Reykjavik', 'IS'],
  ['NewYork', 40.7128, -74.0060, 'America/New_York', 'US'], ['Jakarta', -6.2088, 106.8456, 'Asia/Jakarta', 'ID'], ['KualaLumpur', 3.1390, 101.6869, 'Asia/Kuala_Lumpur', 'MY'],
  ['Sydney', -33.8688, 151.2093, 'Australia/Sydney', 'AU'], ['Apia', -13.8506, -171.7513, 'Pacific/Apia', 'WS'], ['Kiritimati', 1.8721, -157.4278, 'Pacific/Kiritimati', 'KI'],
  ['Tehran', 35.6892, 51.3890, 'Asia/Tehran', 'IR'], ['Karachi', 24.8607, 67.0011, 'Asia/Karachi', 'PK'], ['Singapore', 1.3521, 103.8198, 'Asia/Singapore', 'SG'],
];
const dates = [[2026, 1, 15], [2026, 3, 20], [2026, 6, 21], [2026, 9, 9], [2026, 12, 21], [2027, 6, 21]];
const paramSets = (cc, tz) => [
  { method: defaultMethodFor({ countryCode: cc, tz }) },
  { method: 'MuslimWorldLeague', madhab: 'hanafi' },
  { method: 'UmmAlQura', isRamadan: true },
  { method: 'MoonsightingCommittee', shafaq: 'ahmer' },
  { method: 'Custom', custom: { fajrAngle: 16, ishaAngle: 14, ishaInterval: 0, maghribAngle: 4 } },
  { method: 'Egyptian', highLatitudeRule: 'seventhofthenight', adjustments: { fajr: 2, isha: -3 } },
  { method: 'Tehran', rounding: 'none' },
];
const prayer = [];
for (const [id, lat, lon, tz, cc] of places) for (const [y, m, d] of dates) for (const ps of paramSets(cc, tz)) {
  const params = defaultParams({ ...ps, tz });
  const r = computePrayerTimes({ latitude: lat, longitude: lon }, { year: y, month: m, day: d }, params);
  prayer.push({ id, lat, lon, tz, date: { year: y, month: m, day: d }, params: { method: params.method, madhab: params.madhab, highLatitudeRule: params.highLatitudeRule, polarResolution: params.polarResolution, isRamadan: params.isRamadan, shafaq: params.shafaq, rounding: params.rounding, custom: params.custom, adjustments: params.adjustments },
    times: { fajr: ep(r.fajr), sunrise: ep(r.sunrise), dhuhr: ep(r.dhuhr), asr: ep(r.asr), sunset: ep(r.sunset), maghrib: ep(r.maghrib), isha: ep(r.isha) },
    resolved: { polarResolved: r.resolved.polarResolved, fajrSafe: r.resolved.fajrSafe, ishaSafe: r.resolved.ishaSafe, usedLatitude: r.resolved.usedLatitude, rule: r.resolved.rule, dayShifted: r.resolved.dayShifted } });
}
const timeline = [];
for (const [id, lat, lon, tz, cc] of places) for (const nowIso of ['2026-09-09T02:30:00Z', '2026-09-09T11:00:00Z', '2026-09-09T20:15:00Z', '2026-06-21T23:30:00Z']) {
  const now = new Date(nowIso); const params = defaultParams({ method: defaultMethodFor({ countryCode: cc, tz }) });
  const t = dayTimeline({ latitude: lat, longitude: lon }, tz, params, now);
  timeline.push({ id, lat, lon, tz, method: params.method, now: ep(now), date: t.date, current: t.current, next: { key: t.next.key, time: ep(t.next.time), isTomorrow: !!t.next.isTomorrow, isYesterday: !!t.next.isYesterday }, sunnah: { middleOfNight: ep(t.sunnah.middleOfNight), lastThird: ep(t.sunnah.lastThird) }, yesterdayIsha: ep(t.yesterdayIsha) });
}
const hijri = [];
for (const tz of ['Asia/Riyadh', 'America/New_York', 'Pacific/Apia', 'UTC']) for (let i = 0; i < 40; i++) {
  const d = new Date(Date.UTC(2025, 0, 1, 20, 30) + i * 23 * 86400000);
  for (const off of [-2, 0, 1]) { const h = hijriDate(d, tz, off); hijri.push({ epoch: ep(d), tz, offset: off, day: h.day, month: h.month, year: h.year, weekday: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].indexOf(h.weekday), source: h.source }); }
}
const qibla = places.map(([id, lat, lon]) => { const q = qiblaInfo(lat, lon); return { id, lat, lon, bearing: q.bearing, bearingSpherical: q.bearingSpherical, distanceKm: q.distanceKm, difference: q.difference, compassPoint: q.compassPoint, antipodal: q.antipodal }; });
qibla.push((() => { const q = qiblaInfo(-21.4225, -140.1738); return { id: 'antipode', lat: -21.4225, lon: -140.1738, bearing: q.bearing, bearingSpherical: q.bearingSpherical, distanceKm: q.distanceKm, difference: q.difference, compassPoint: q.compassPoint, antipodal: q.antipodal }; })());
const sunMoments = [];
for (const [id, lat, lon, tz] of places.slice(0, 8)) for (const [y, m, d] of [[2026, 3, 20], [2026, 7, 15]]) { const s = sunQiblaMoments(lat, lon, { year: y, month: m, day: d }, tz); sunMoments.push({ id, lat, lon, tz, civil: { year: y, month: m, day: d }, bearing: s.bearing, sunAtQibla: ep(s.sunAtQibla), shadowAtQibla: ep(s.shadowAtQibla) }); }
const zenith = { 2026: kaabaZenithEvents(2026).map((e) => ({ time: ep(e.time), altitude: e.altitude })), 2027: kaabaZenithEvents(2027).map((e) => ({ time: ep(e.time), altitude: e.altitude })) };
const geomag = [];
for (const [id, lat, lon] of places) for (const dy of [2025.0, 2026.69, 2029.5, 2031.0]) for (const alt of [0, 1.5]) { const f = magneticField({ lat, lon, altKm: alt, date: dy }); geomag.push({ id, lat, lon, altKm: alt, decimalYear: dy, declination: f.declination, inclination: f.inclination, f: f.f, h: f.h, x: f.x, y: f.y, z: f.z, gridVariation: Number.isNaN(f.gridVariation) ? null : f.gridVariation, outOfRange: f.outOfRange }); }
for (const [lat, lon] of [[89.99, 0], [-89.99, 45], [0, 180], [55, -100], [-60, 120]]) { const f = magneticField({ lat, lon, altKm: 0, date: 2027.25 }); geomag.push({ id: `p${lat}_${lon}`, lat, lon, altKm: 0, decimalYear: 2027.25, declination: f.declination, inclination: f.inclination, f: f.f, h: f.h, x: f.x, y: f.y, z: f.z, gridVariation: Number.isNaN(f.gridVariation) ? null : f.gridVariation, outOfRange: f.outOfRange }); }
const methods = [['SA', 'Asia/Riyadh'], ['JO', null], [null, 'Europe/London'], [null, 'America/Bogota'], ['ZZ', 'Asia/Tokyo'], [null, null]].map(([cc, tz]) => ({ countryCode: cc, tz, method: defaultMethodFor({ countryCode: cc || undefined, tz: tz || undefined }) }));
const out = { generatedAt: new Date().toISOString(), prayer, timeline, hijri, qibla, sunMoments, zenith, geomag, methods };
const dest = path.resolve(here, '../Tests/SakinahCoreTests/Fixtures/golden.json');
fs.writeFileSync(dest, JSON.stringify(out));
console.log(`golden: prayer ${prayer.length}, timeline ${timeline.length}, hijri ${hijri.length}, qibla ${qibla.length}, sunMoments ${sunMoments.length}, geomag ${geomag.length} → ${path.relative(process.cwd(), dest)} (${(fs.statSync(dest).size / 1024).toFixed(0)} KB)`);
