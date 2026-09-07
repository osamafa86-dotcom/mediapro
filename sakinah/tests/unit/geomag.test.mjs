import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  magneticField, declination, magneticToTrue, trueToMagnetic, decimalYear, WMM_EPOCH, WMM_VALID_UNTIL,
} from '../../js/core/geomag.js';

const require = createRequire(import.meta.url);
const TEST_VALUES = '/tmp/claude-0/-home-user-mediapro/c000bffe-65d6-581c-b6a2-d2d633ac7018/scratchpad/ref/WMM2025_TEST_VALUES.txt';

/** قراءة ملف قيم الاختبار الرسمية من NOAA: تُتجاهل أسطر '#'، والأعمدة: date alt lat lon X Y Z H F I D GV ... */
function parseTestValues(path) {
  return fs.readFileSync(path, 'utf8').split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const c = l.split(/\s+/).map(Number);
      return { date: c[0], altKm: c[1], lat: c[2], lon: c[3], X: c[4], Y: c[5], Z: c[6], H: c[7], F: c[8], I: c[9], D: c[10], GV: c[11] };
    });
}

test('ثوابت النموذج: epoch 2025.0 وصلاحية حتى 2030.0', () => {
  assert.equal(WMM_EPOCH, 2025.0);
  assert.equal(WMM_VALID_UNTIL, 2030.0);
});

test('قيم اختبار NOAA الرسمية لـ WMM2025: كل صف ضمن 1 nT و 0.01°', () => {
  const rows = parseTestValues(TEST_VALUES);
  assert.ok(rows.length >= 12, `عدد الصفوف ${rows.length}`);
  for (const r of rows) {
    const m = magneticField({ lat: r.lat, lon: r.lon, altKm: r.altKm, date: r.date });
    const tag = `(${r.date}, ${r.altKm}km, ${r.lat}, ${r.lon})`;
    assert.ok(Math.abs(r.X - m.x) <= 1.0, `X ${tag}: ${m.x} vs ${r.X}`);
    assert.ok(Math.abs(r.Y - m.y) <= 1.0, `Y ${tag}: ${m.y} vs ${r.Y}`);
    assert.ok(Math.abs(r.Z - m.z) <= 1.0, `Z ${tag}: ${m.z} vs ${r.Z}`);
    assert.ok(Math.abs(r.H - m.h) <= 1.0, `H ${tag}: ${m.h} vs ${r.H}`);
    assert.ok(Math.abs(r.F - m.f) <= 1.0, `F ${tag}: ${m.f} vs ${r.F}`);
    assert.ok(Math.abs(r.I - m.inclination) <= 0.01, `I ${tag}: ${m.inclination} vs ${r.I}`);
    assert.ok(Math.abs(r.D - m.declination) <= 0.01, `D ${tag}: ${m.declination} vs ${r.D}`);
    if (Number.isNaN(r.GV)) assert.ok(Number.isNaN(m.gridVariation), `GV ${tag} يجب أن يكون NaN`);
    else assert.ok(Math.abs(r.GV - m.gridVariation) <= 0.01, `GV ${tag}: ${m.gridVariation} vs ${r.GV}`);
    assert.equal(m.decimalYear, r.date);
    assert.equal(m.outOfRange, false);
  }
});

test('قيم معقولة: مكة 2026 بين 3.0 و4.5° شرقًا، نيويورك بين −13 و−12°', () => {
  const d2026 = new Date('2026-06-15T00:00:00Z');
  const makkah = declination(21.42, 39.83, 0, d2026);
  assert.ok(makkah > 3.0 && makkah < 4.5, `مكة: ${makkah}`);
  const nyc = declination(40.7128, -74.006, 0, d2026);
  assert.ok(nyc > -13 && nyc < -12, `نيويورك: ${nyc}`);
});

test('تحويل الاتجاهات: magneticToTrue(350, 15) === 5 والعكس', () => {
  assert.equal(magneticToTrue(350, 15), 5);
  assert.equal(trueToMagnetic(5, 15), 350);
  assert.equal(magneticToTrue(10, -15), 355);
  assert.equal(trueToMagnetic(355, -15), 10);
  assert.equal(magneticToTrue(0, 0), 0);
  assert.equal(magneticToTrue(360, 0), 0);
  // ذهاب وإياب
  for (const h of [0, 45, 123.4, 270, 359.9]) {
    for (const d of [-20, -3.5, 0, 4.2, 17]) {
      const back = trueToMagnetic(magneticToTrue(h, d), d);
      assert.ok(Math.abs(((back - h) % 360 + 540) % 360 - 180) < 1e-9, `${h}/${d} -> ${back}`);
    }
  }
});

test('مقارنة الانحراف مع حزمة geomagnetism (npm) في 12 نقطة حول العالم: |Δ| ≤ 0.05°', () => {
  const geomagnetism = require('geomagnetism');
  const date = new Date('2026-03-15T12:00:00Z');
  const model = geomagnetism.model(date);
  const points = [
    ['Makkah', 21.4225, 39.8262, 0.3], ['Amman', 31.9539, 35.9106, 0.8], ['Cairo', 30.0444, 31.2357, 0],
    ['London', 51.5074, -0.1278, 0], ['New York', 40.7128, -74.006, 0], ['Jakarta', -6.2088, 106.8456, 0],
    ['Sydney', -33.8688, 151.2093, 0], ['Cape Town', -33.9249, 18.4241, 0], ['Tokyo', 35.6762, 139.6503, 0],
    ['Anchorage', 61.2181, -149.9003, 0], ['Buenos Aires', -34.6037, -58.3816, 0], ['Reykjavik', 64.1466, -21.9426, 0],
  ];
  assert.equal(points.length, 12);
  for (const [name, lat, lon, alt] of points) {
    const ours = declination(lat, lon, alt, date);
    const ref = model.point([lat, lon, alt]).decl;
    assert.ok(Math.abs(ours - ref) <= 0.05, `${name}: ${ours} vs ${ref}`);
  }
});

test('السنة العشرية: بداية السنة، منتصفها، وسنة كبيسة، وتمرير رقم كما هو', () => {
  assert.equal(decimalYear(new Date('2026-01-01T00:00:00Z')), 2026);
  assert.ok(Math.abs(decimalYear(new Date('2026-07-02T12:00:00Z')) - 2026.5) < 1e-9); // 182.5/365
  assert.ok(Math.abs(decimalYear(new Date('2028-07-02T00:00:00Z')) - 2028.5) < 1e-9); // 183/366 (كبيسة)
  assert.equal(decimalYear(2027.25), 2027.25);
  assert.throws(() => decimalYear(new Date('invalid')), TypeError);
});

test('خارج فترة الصلاحية: يستمر الحساب مع outOfRange=true؛ داخلها false', () => {
  const inside = magneticField({ lat: 21.42, lon: 39.83, date: 2027.0 });
  assert.equal(inside.outOfRange, false);
  const future = magneticField({ lat: 21.42, lon: 39.83, date: new Date('2031-01-01T00:00:00Z') });
  assert.equal(future.outOfRange, true);
  assert.ok(Number.isFinite(future.declination) && Number.isFinite(future.f));
  const past = magneticField({ lat: 21.42, lon: 39.83, date: new Date('2024-06-01T00:00:00Z') });
  assert.equal(past.outOfRange, true);
  assert.ok(Number.isFinite(past.declination));
  // الاستقراء خطي: الانحراف عند 2031 قريب من 2029 + التغير السنوي
  const d29 = magneticField({ lat: 21.42, lon: 39.83, date: 2029.0 }).declination;
  const d30 = magneticField({ lat: 21.42, lon: 39.83, date: 2030.0 }).declination;
  const d31 = magneticField({ lat: 21.42, lon: 39.83, date: 2031.0 }).declination;
  assert.ok(Math.abs((d31 - d30) - (d30 - d29)) < 0.02, `استقراء غير سلس: ${d29} ${d30} ${d31}`);
});

test('القطبان: لا قسمة على صفر، والنتائج منتهية، وإشارة الميل صحيحة', () => {
  for (const lat of [90, -90, 89.99999, -89.99999]) {
    const m = magneticField({ lat, lon: 0, date: 2026.0 });
    for (const k of ['x', 'y', 'z', 'h', 'f', 'inclination', 'declination', 'gridVariation']) {
      assert.ok(Number.isFinite(m[k]), `${k} عند ${lat} = ${m[k]}`);
    }
    // القطب الجغرافي ليس قطب الميل المغناطيسي (الجنوبي يبعد نحو 28°) لذا الميل كبير لكنه ليس ±90
    assert.ok(Math.abs(m.inclination) > 60 && Math.sign(m.inclination) === Math.sign(lat), `الميل عند ${lat} = ${m.inclination}`);
    assert.ok(m.f > 45000 && m.f < 70000, `الشدة عند ${lat} = ${m.f}`);
  }
  // خط الطول 180 و−180 و540 يعطي النتيجة نفسها
  const a = magneticField({ lat: 10, lon: 180, date: 2026.0 }).declination;
  const b = magneticField({ lat: 10, lon: -180, date: 2026.0 }).declination;
  const c = magneticField({ lat: 10, lon: 540, date: 2026.0 }).declination;
  assert.ok(Math.abs(a - b) < 1e-9 && Math.abs(a - c) < 1e-9);
});

test('مدخلات غير صالحة تُرفض', () => {
  assert.throws(() => magneticField({ lat: 91, lon: 0 }), RangeError);
  assert.throws(() => magneticField({ lat: NaN, lon: 0 }), TypeError);
  assert.throws(() => magneticField({ lat: 0, lon: 'x' }), TypeError);
});
