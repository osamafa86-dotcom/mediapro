import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildICS, buildReminders } from '../../js/platform/notifications.js';
import { computePrayerTimes, defaultParams } from '../../js/core/prayer-times.js';

const c = { latitude: 24.7136, longitude: 46.6753 };
const day = computePrayerTimes(c, { year: 2026, month: 9, day: 6 }, defaultParams({ method: 'UmmAlQura' }));

test('buildReminders يُنتج تذكيرًا لكل صلاة مفعّلة مع التذكير المسبق', () => {
  const r = buildReminders(day, { prayers: { fajr: true, sunrise: false, dhuhr: true, asr: false, maghrib: true, isha: true }, preMinutes: 10 }, (d) => d.toISOString(), '2026-09-06');
  assert.equal(r.filter(x => x.kind === 'adhan').length, 4);
  assert.equal(r.filter(x => x.kind === 'pre').length, 4);
  const pre = r.find(x => x.id === '2026-09-06:fajr:pre');
  assert.equal(day.fajr.getTime() - pre.time.getTime(), 10 * 60000);
  assert.ok(!r.some(x => x.kind === 'sunrise'));
});

test('buildICS ينتج تقويمًا صالحًا مع منبّهات', () => {
  const ics = buildICS([day], { locationName: 'الرياض', preMinutes: 5, includeSunrise: false });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.trim().endsWith('END:VCALENDAR'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 5);
  assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 10);
  assert.ok(ics.includes('DTSTART:' + day.fajr.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')));
  assert.ok(ics.includes('TRIGGER:-PT5M'));
  assert.ok(ics.includes('SUMMARY:صلاة الفجر'));
});
