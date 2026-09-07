import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hijriDate, isRamadan, tabularHijri, HIJRI_MONTHS_AR } from '../../js/core/hijri.js';

test('أم القرى: 6 سبتمبر 2026 = 24 ربيع الأول 1448هـ (حسب ICU)', () => {
  const h = hijriDate(new Date(Date.UTC(2026, 8, 6, 12)), 'Asia/Riyadh');
  assert.equal(h.year, 1448); assert.equal(h.month, 3); assert.equal(h.day, 24);
  assert.equal(h.monthName, 'ربيع الأول'); assert.equal(h.weekday, 'الأحد');
  assert.equal(h.formatted, '24 ربيع الأول 1448هـ');
});

test('تواريخ معروفة: 1 رمضان 1445 = 11 مارس 2024، عيد الفطر 1445 = 10 أبريل 2024 (أم القرى)', () => {
  assert.deepEqual([hijriDate(new Date(Date.UTC(2024, 2, 11, 12)), 'Asia/Riyadh').month, hijriDate(new Date(Date.UTC(2024, 2, 11, 12)), 'Asia/Riyadh').day], [9, 1]);
  assert.deepEqual([hijriDate(new Date(Date.UTC(2024, 3, 10, 12)), 'Asia/Riyadh').month, hijriDate(new Date(Date.UTC(2024, 3, 10, 12)), 'Asia/Riyadh').day], [10, 1]);
  // 1 محرم 1446 = 7 يوليو 2024
  const h = hijriDate(new Date(Date.UTC(2024, 6, 7, 12)), 'Asia/Riyadh');
  assert.deepEqual([h.year, h.month, h.day], [1446, 1, 1]);
});

test('اليوم الهجري يتبع اليوم المدني في المنطقة الزمنية', () => {
  const t = new Date(Date.UTC(2026, 8, 6, 22, 0)); // 01:00 في الرياض من اليوم التالي
  assert.equal(hijriDate(t, 'Asia/Riyadh').day, 25);
  assert.equal(hijriDate(t, 'America/New_York').day, 24);
});

test('تعديل المستخدم يزيح اليوم', () => {
  const t = new Date(Date.UTC(2026, 8, 6, 12));
  assert.equal(hijriDate(t, 'Asia/Riyadh', 1).day, 25);
  assert.equal(hijriDate(t, 'Asia/Riyadh', -1).day, 23);
});

test('isRamadan صحيحة', () => {
  assert.equal(isRamadan(new Date(Date.UTC(2024, 2, 20, 12)), 'Asia/Riyadh'), true);
  assert.equal(isRamadan(new Date(Date.UTC(2026, 8, 6, 12)), 'Asia/Riyadh'), false);
});

test('البديل الجدولي قريب من أم القرى (±1 يوم) لعدة تواريخ', () => {
  for (const [y, m, d] of [[2024, 3, 11], [2026, 9, 6], [2030, 1, 1], [2027, 6, 15]]) {
    const u = hijriDate(new Date(Date.UTC(y, m - 1, d, 12)), 'UTC');
    const t = tabularHijri(y, m, d);
    const du = u.year * 360 + u.month * 30 + u.day, dt = t.year * 360 + t.month * 30 + t.day;
    assert.ok(Math.abs(du - dt) <= 1, `${y}-${m}-${d}: umalqura ${JSON.stringify(u)} vs tabular ${JSON.stringify(t)}`);
  }
  assert.equal(HIJRI_MONTHS_AR.length, 12);
});
