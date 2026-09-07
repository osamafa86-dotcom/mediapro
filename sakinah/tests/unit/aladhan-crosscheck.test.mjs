/**
 * مقارنة مستقلة مع خدمة AlAdhan (api.aladhan.com) — تنفيذ مختلف تمامًا للخوارزمية.
 * يُتجاوز الاختبار تلقائيًا دون اتصال. التسامح: دقيقتان (اختلافات التقريب/الانكسار بين التنفيذات).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePrayerTimes, defaultParams } from '../../js/core/prayer-times.js';

const CASES = [
  { name: 'مكة/أم القرى', lat: 21.4225, lon: 39.8262, method: 'UmmAlQura', aladhan: 4, tz: 'Asia/Riyadh' },
  { name: 'عمّان/الأردن', lat: 31.9539, lon: 35.9106, method: 'Jordan', aladhan: 23, tz: 'Asia/Amman' },
  { name: 'القاهرة/المصرية', lat: 30.0444, lon: 31.2357, method: 'Egyptian', aladhan: 5, tz: 'Africa/Cairo' },
  { name: 'إسطنبول/ديانت', lat: 41.0082, lon: 28.9784, method: 'Turkey', aladhan: 13, tz: 'Europe/Istanbul' },
  { name: 'لندن/رابطة', lat: 51.5074, lon: -0.1278, method: 'MuslimWorldLeague', aladhan: 3, tz: 'Europe/London' },
  { name: 'نيويورك/ISNA', lat: 40.7128, lon: -74.006, method: 'NorthAmerica', aladhan: 2, tz: 'America/New_York' },
  { name: 'كوالالمبور/JAKIM', lat: 3.139, lon: 101.6869, method: 'JAKIM', aladhan: 17, tz: 'Asia/Kuala_Lumpur' },
  { name: 'الدوحة/قطر', lat: 25.2854, lon: 51.531, method: 'Qatar', aladhan: 10, tz: 'Asia/Qatar' },
];
const DATE = { year: 2026, month: 9, day: 15 };

async function online() {
  try { const c = new AbortController(); setTimeout(() => c.abort(), 6000); const r = await fetch('https://api.aladhan.com/v1/methods', { signal: c.signal }); return r.ok; } catch { return false; }
}
const isOnline = await online();

function toMinutes(hhmm) { const [h, m] = hhmm.split(' ')[0].split(':').map(Number); return h * 60 + m; }
function localMinutes(date, tz) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', hour: 'numeric', minute: 'numeric' }).formatToParts(date).reduce((o, x) => (o[x.type] = x.value, o), {});
  return Number(p.hour) * 60 + Number(p.minute);
}

test('مواقيتنا ضمن دقيقتين من AlAdhan لثماني مدن/طرق', { skip: !isOnline && 'offline' }, async () => {
  const report = [];
  for (const c of CASES) {
    const url = `https://api.aladhan.com/v1/timings/${String(DATE.day).padStart(2, '0')}-${String(DATE.month).padStart(2, '0')}-${DATE.year}?latitude=${c.lat}&longitude=${c.lon}&method=${c.aladhan}&school=0&timezonestring=${encodeURIComponent(c.tz)}`;
    const res = await fetch(url); const j = await res.json(); const t = j.data.timings;
    const ours = computePrayerTimes({ latitude: c.lat, longitude: c.lon }, DATE, defaultParams({ method: c.method }));
    for (const [k, ak] of [['fajr', 'Fajr'], ['sunrise', 'Sunrise'], ['dhuhr', 'Dhuhr'], ['asr', 'Asr'], ['maghrib', 'Maghrib'], ['isha', 'Isha']]) {
      const diff = localMinutes(ours[k], c.tz) - toMinutes(t[ak]);
      report.push(`${c.name} ${k}: ${diff > 0 ? '+' : ''}${diff}`);
      assert.ok(Math.abs(diff) <= 2, `${c.name} ${k}: ours ${localMinutes(ours[k], c.tz)} vs aladhan ${t[ak]} (diff ${diff} min)`);
    }
  }
  console.log(report.join(' | '));
});
