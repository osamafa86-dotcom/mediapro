/**
 * خطة الختمة وإحصاءات القراءة (حسابات صرفة قابلة للاختبار):
 * الخطة: { startPage, startedAt (YYYY-MM-DD), days, dailyPages, reminder: 'HH:MM'|null }
 * سجل القراءة: { 'YYYY-MM-DD': [pages...] } صفحات فريدة قُرئت في اليوم (بقاء ≥ 8 ثوانٍ في الصفحة)
 */
export const TOTAL = 604;
export function makePlan({ startPage = 1, startedAt, days = 30, reminder = null }) {
  const d = Math.max(1, Math.min(604, Math.round(days)));
  return { startPage: Math.max(1, Math.min(TOTAL, startPage | 0)), startedAt, days: d, dailyPages: Math.ceil(TOTAL / d), reminder };
}
/** عدد الصفحات المقطوعة من بداية الخطة حتى صفحة القراءة الحالية (مع الالتفاف عند 604) */
export function pagesDone(plan, currentPage) {
  if (!plan || !currentPage) return 0;
  const done = ((currentPage - plan.startPage) % TOTAL + TOTAL) % TOTAL;
  return done;
}
export function daysBetween(a, b) { const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number); return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000); }
export function addDaysKey(key, n) { const [y, m, d] = key.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`; }
/**
 * حالة اليوم: الهدف اليومي، ما قُرئ اليوم، الصفحات المتبقية، المتأخَّر عن الجدول، وتاريخ الإنجاز المتوقع بوتيرة الخطة أو الوتيرة الفعلية
 */
export function planStatus(plan, currentPage, readLog, todayKey) {
  const done = pagesDone(plan, currentPage);
  const dayIndex = Math.max(0, daysBetween(plan.startedAt, todayKey)); // 0 = اليوم الأول
  const expected = Math.min(TOTAL, (dayIndex + 1) * plan.dailyPages);
  const todayPages = (readLog && readLog[todayKey] ? readLog[todayKey].length : 0);
  const remaining = TOTAL - done;
  const behind = Math.max(0, expected - done);
  const daysLeft = Math.max(0, plan.days - dayIndex);
  const neededPerDay = daysLeft > 0 ? Math.ceil(remaining / daysLeft) : remaining;
  const etaKey = addDaysKey(todayKey, Math.max(0, Math.ceil(remaining / Math.max(1, plan.dailyPages)) - (todayPages >= plan.dailyPages ? 0 : 0)));
  return { done, remaining, percent: Math.round((done / TOTAL) * 100), dayIndex, expected, behind, todayPages, todayTarget: Math.min(plan.dailyPages + behind, remaining), daysLeft, neededPerDay, etaKey, finished: done >= TOTAL - 1 && currentPage === TOTAL };
}
/** سلسلة الأيام المتتالية (حتى اليوم أو الأمس) التي قُرئت فيها صفحة على الأقل */
export function streak(readLog, todayKey) {
  if (!readLog) return 0;
  let n = 0; let key = todayKey;
  if (!(readLog[key] && readLog[key].length)) key = addDaysKey(key, -1); // إن لم يقرأ اليوم بعد نحسب من الأمس
  while (readLog[key] && readLog[key].length) { n++; key = addDaysKey(key, -1); }
  return n;
}
/** تسجيل صفحة في سجل اليوم (بلا تكرار)، مع تقليم السجل إلى 400 يوم */
export function logPage(readLog, todayKey, page) {
  const log = { ...(readLog || {}) };
  const today = new Set(log[todayKey] || []); today.add(page); log[todayKey] = [...today].sort((a, b) => a - b);
  const keys = Object.keys(log).sort(); if (keys.length > 400) for (const k of keys.slice(0, keys.length - 400)) delete log[k];
  return log;
}
/** إحصاءات عامة: صفحات آخر 7 و30 يومًا ومتوسط يومي */
export function stats(readLog, todayKey) {
  let w = 0, m = 0;
  for (let i = 0; i < 30; i++) { const k = addDaysKey(todayKey, -i); const n = readLog && readLog[k] ? readLog[k].length : 0; m += n; if (i < 7) w += n; }
  return { week: w, month: m, avgDay: +(m / 30).toFixed(1) };
}
