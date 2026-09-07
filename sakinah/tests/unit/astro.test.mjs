import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sunPosition, julianDay, julianDayFromDate, solarCoordinates, SolarTime, refraction } from '../../js/core/astro.js';

test('اليوم اليولياني: J2000.0 = 2451545.0، و 1 يناير 2026 = 2461041.5', () => {
  assert.equal(julianDay(2000, 1, 1, 12), 2451545.0);
  assert.equal(julianDay(2026, 1, 1), 2461041.5);
  assert.ok(Math.abs(julianDayFromDate(new Date(Date.UTC(2000, 0, 1, 12))) - 2451545.0) < 1e-9);
});

test('ميل الشمس ≈ +23.44° عند الانقلاب الصيفي و ≈ 0 عند الاعتدال', () => {
  const summer = solarCoordinates(julianDay(2026, 6, 21, 8)).declination;
  assert.ok(Math.abs(summer - 23.43) < 0.05, `summer ${summer}`);
  const equinox = solarCoordinates(julianDay(2026, 3, 20, 14)).declination;
  assert.ok(Math.abs(equinox) < 0.1, `equinox ${equinox}`);
});

test('سمت الشمس عند الزوال = 180° في نصف الكرة الشمالي (خارج المدارين) وارتفاعها = 90 − |φ − δ|', () => {
  const lat = 31.95, lon = 35.91;
  const st = new SolarTime({ year: 2026, month: 9, day: 6 }, { latitude: lat, longitude: lon });
  const transit = new Date(Date.UTC(2026, 8, 6) + st.transit * 3600000);
  const p = sunPosition(transit, lat, lon);
  assert.ok(Math.abs(p.azimuth - 180) < 0.05, `azimuth ${p.azimuth}`);
  assert.ok(Math.abs(p.altitude - (90 - Math.abs(lat - p.declination))) < 0.02, `altitude ${p.altitude}`);
});

test('الشمس تشرق شرقًا وتغرب غربًا تقريبًا يوم الاعتدال، وتحت الأفق منتصف الليل', () => {
  const lat = 24.71, lon = 46.68;
  const st = new SolarTime({ year: 2026, month: 3, day: 20 }, { latitude: lat, longitude: lon });
  const rise = sunPosition(new Date(Date.UTC(2026, 2, 20) + st.sunrise * 3600000), lat, lon);
  const set = sunPosition(new Date(Date.UTC(2026, 2, 20) + st.sunset * 3600000), lat, lon);
  assert.ok(Math.abs(rise.azimuth - 90) < 1.5, `rise az ${rise.azimuth}`);
  assert.ok(Math.abs(set.azimuth - 270) < 1.5, `set az ${set.azimuth}`);
  assert.ok(Math.abs(rise.altitude + 0.833) < 0.05, `rise alt ${rise.altitude}`);
  const midnight = sunPosition(new Date(Date.UTC(2026, 2, 20, 21)), lat, lon);
  assert.ok(midnight.altitude < -50);
});

test('معادلة الزمن ضمن ±16.5 دقيقة، وقيمها المعروفة: ~ −14 دقيقة في 11 فبراير و ~ +16 في 3 نوفمبر', () => {
  const feb = sunPosition(new Date(Date.UTC(2026, 1, 11, 12)), 0, 0).equationOfTime;
  const nov = sunPosition(new Date(Date.UTC(2026, 10, 3, 12)), 0, 0).equationOfTime;
  assert.ok(Math.abs(feb - (-14.2)) < 0.4, `feb ${feb}`);
  assert.ok(Math.abs(nov - 16.4) < 0.4, `nov ${nov}`);
  for (let m = 0; m < 12; m++) assert.ok(Math.abs(sunPosition(new Date(Date.UTC(2026, m, 15, 12)), 0, 0).equationOfTime) < 16.6);
});

test('الانكسار الجوي (Sæmundsson، المدخل ارتفاع هندسي) ≈ 29′ عند الأفق وصفر تحت −1°', () => {
  assert.ok(Math.abs(refraction(0) * 60 - 29.0) < 1.0);
  assert.equal(refraction(-5), 0);
  assert.ok(refraction(45) * 60 < 1.1);
});
