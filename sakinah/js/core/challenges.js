/**
 * تحدّيات القراءة وخريطة الحرارة: تحدّيات محدّدة بمدى صفحات ومدة، تقدّمها من سجل الصفحات المقروءة (readLog)،
 * وتقدير زمن القراءة بمتوسط دقيقتين للصفحة. منطق نقي بلا واجهة.
 */
import { daysBetween, addDaysKey } from './khatmah.js';

export const MINUTES_PER_PAGE = 2;
export const CHALLENGES = [
  { id: 'kahf', name: 'سورة الكهف', desc: 'سنّة يوم الجمعة', from: 293, to: 304, days: 1 },
  { id: 'mulk', name: 'سورة الملك قبل النوم', desc: 'ثلاث صفحات كل ليلة', from: 562, to: 564, days: 1 },
  { id: 'yasin', name: 'سورة يس', desc: 'ستّ صفحات في جلسة', from: 440, to: 445, days: 1 },
  { id: 'amma', name: 'جزء عمّ في أسبوع', desc: 'قصار السور: 23 صفحة', from: 582, to: 604, days: 7 },
  { id: 'tabarak', name: 'جزء تبارك في أسبوع', desc: '20 صفحة', from: 562, to: 581, days: 7 },
  { id: 'baqara', name: 'سورة البقرة في ثلاثة أيام', desc: '48 صفحة', from: 2, to: 49, days: 3 },
  { id: 'juz-3days', name: 'جزء في ثلاثة أيام', desc: '20 صفحة من موضعك الحالي', from: null, to: null, days: 3, span: 20 },
  { id: 'hizb-daily', name: 'حزب كل يوم', desc: '10 صفحات يوميًا لأسبوع', from: null, to: null, days: 7, span: 70 },
];
export function challengeById(id) { return CHALLENGES.find((c) => c.id === id) || null; }
/** يثبّت مدى تحدٍّ نسبي (من موضع القراءة الحالي) */
export function resolveRange(ch, startPage = 1) {
  if (ch.from) return { from: ch.from, to: ch.to };
  const from = Math.max(1, Math.min(604, startPage || 1)); return { from, to: Math.min(604, from + ch.span - 1) };
}
export const estimateMinutes = (pages) => pages * MINUTES_PER_PAGE;
/** حالة تحدٍّ نشط: { done, total, pct, dayIndex, daysLeft, finished, late, minutesLeft } */
export function challengeProgress(active, readLog, todayKey) {
  if (!active) return null;
  const ch = challengeById(active.id); if (!ch) return null;
  const { from, to } = active.from ? active : resolveRange(ch, active.startPage);
  const total = to - from + 1; const done = new Set();
  for (const [key, pages] of Object.entries(readLog || {})) {
    if (key < active.startedAt) continue;
    for (const p of pages) if (p >= from && p <= to) done.add(p);
  }
  const dayIndex = Math.max(0, daysBetween(active.startedAt, todayKey));
  const daysLeft = Math.max(0, ch.days - dayIndex - 1);
  const finished = done.size >= total;
  return { id: ch.id, name: ch.name, from, to, total, done: done.size, pct: Math.round((done.size / total) * 100), dayIndex, daysLeft, finished, late: !finished && dayIndex >= ch.days, minutesLeft: estimateMinutes(total - done.size) };
}
/** خريطة حرارة آخر days يومًا: [{ key, count }] من الأقدم إلى الأحدث */
export function heatmap(readLog, todayKey, days = 90) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) { const key = addDaysKey(todayKey, -i); out.push({ key, count: readLog && readLog[key] ? readLog[key].length : 0 }); }
  return out;
}
