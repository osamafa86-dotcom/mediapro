/**
 * تذكير بمواعيد الصلاة
 * ------------------
 * - جدولة داخل الصفحة بدقة الدقيقة (تعمل ما دام التطبيق مفتوحًا أو في الخلفية) عبر Notification API
 *   من خلال عامل الخدمة عند توفره (يظهر الإشعار حتى لو كان التبويب خلفيًا).
 * - نغمة تنبيه مولّدة بـ Web Audio (بلا ملفات صوتية)، واهتزاز اختياري.
 * - تصدير تقويم ICS مع منبّهات: الطريقة الأكثر موثوقية للتذكير حين يكون التطبيق مغلقًا
 *   (لا تسمح المتصفحات بجدولة إشعارات مستقبلية دون خادم دفع).
 */
import { PRAYER_NAMES_AR } from '../core/prayer-times.js';
import * as nativeNotif from './native-notifications.js';
import { shareFile, isNative } from './native.js';

let nativePerm = null; // آخر حالة إذن معروفة في التطبيق الأصلي (الفحص هناك غير متزامن)
export function isSupported() { return nativeNotif.available() || (typeof window !== 'undefined' && 'Notification' in window); }
export function permissionState() {
  if (nativeNotif.available()) return nativePerm || 'default';
  return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
}
export async function refreshPermission() { if (nativeNotif.available()) nativePerm = await nativeNotif.permission(); return permissionState(); }
export async function requestPermission() {
  if (nativeNotif.available()) { nativePerm = await nativeNotif.requestPermission(); return nativePerm; }
  if (!isSupported()) return 'unsupported';
  try { return await Notification.requestPermission(); } catch { return Notification.permission; }
}

/* ---------- الأذان الكامل داخل التطبيق ---------- */
export const ADHAN_SOUNDS = [
  { id: 'chime', name: 'نغمة هادئة', file: null },
  { id: 'adhan-fakhry', name: 'أذان (صباح فخري)', file: 'assets/audio/adhan-fakhry.mp3', by: 'ملكية عامة' },
  { id: 'adhan-azeez', name: 'أذان (عاقب عزيز)', file: 'assets/audio/adhan-azeez.mp3', by: 'CC BY-SA 4.0' },
  { id: 'none', name: 'بلا صوت', file: null },
];
let adhanEl = null; const adhanListeners = new Set();
export function onAdhanState(fn) { adhanListeners.add(fn); return () => adhanListeners.delete(fn); }
const emitAdhan = (st) => { for (const fn of adhanListeners) { try { fn(st); } catch { /* تجاهل */ } } };
/** تشغيل صوت الأذان المختار (مقطع كامل)؛ يعيد true إن بدأ */
export async function playAdhan(id) {
  const s = ADHAN_SOUNDS.find((x) => x.id === id);
  if (!s || !s.file) { if (id === 'chime') playChime(); return false; }
  stopAdhan();
  try { adhanEl = new Audio(s.file); adhanEl.preload = 'auto'; adhanEl.addEventListener('ended', () => { adhanEl = null; emitAdhan('ended'); }); await adhanEl.play(); emitAdhan('playing'); return true; }
  catch { adhanEl = null; playChime(); return false; }
}
export function stopAdhan() { if (adhanEl) { try { adhanEl.pause(); } catch { /* تجاهل */ } adhanEl = null; emitAdhan('stopped'); } }
export function isAdhanPlaying() { return !!adhanEl && !adhanEl.paused; }

let audioCtx = null;
/** تجهيز الصوت من داخل إيماءة مستخدم (iOS يتطلب ذلك) */
export function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {}
}
/** نغمة هادئة من ثلاث نبرات */
export function playChime() {
  try {
    unlockAudio();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t = now + i * 0.28;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + 1);
    });
  } catch {}
}

async function swRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  try { return await navigator.serviceWorker.getRegistration(); } catch { return null; }
}

/** إظهار إشعار (عبر عامل الخدمة إن وُجد، وإلا مباشرة) */
export async function showNotification(title, body, { tag = 'sakinah', sticky = false, vibrate = true, url } = {}) {
  if (permissionState() !== 'granted') return false;
  const reg = await swRegistration();
  if (reg && reg.active) {
    reg.active.postMessage({ type: 'show-notification', title, body, tag, sticky, vibrate, url });
    return true;
  }
  try { new Notification(title, { body, tag, icon: 'assets/icons/icon-192.png', lang: 'ar', dir: 'rtl' }); return true; } catch { return false; }
}

/* ---------- المجدوِل ---------- */
let timer = null; let getSchedule = null; let onFire = null;
const FIRED_KEY = 'sakinah:fired';
function firedSet() { try { return new Set(JSON.parse(sessionStorage.getItem(FIRED_KEY) || '[]')); } catch { return new Set(); } }
function markFired(id) { const s = firedSet(); s.add(id); try { sessionStorage.setItem(FIRED_KEY, JSON.stringify([...s].slice(-200))); } catch {} }

/**
 * بدء المجدول. scheduleProvider() تُعيد مصفوفة { id, time: Date, title, body, kind }
 * تُفحص كل 20 ثانية وعند عودة الصفحة للواجهة؛ تُطلق العناصر التي حان وقتها خلال آخر 3 دقائق ولم تُطلق بعد.
 */
export function startScheduler(scheduleProvider, fireHandler) {
  getSchedule = scheduleProvider; onFire = fireHandler;
  stopScheduler();
  const tick = () => {
    if (!getSchedule) return;
    const now = Date.now(); const fired = firedSet();
    for (const item of getSchedule()) {
      const t = item.time.getTime();
      if (t <= now && now - t < 3 * 60 * 1000 && !fired.has(item.id)) { markFired(item.id); onFire && onFire(item); }
    }
  };
  timer = setInterval(tick, 20000);
  document.addEventListener('visibilitychange', tick);
  window.addEventListener('focus', tick);
  tick();
}
export function stopScheduler() { if (timer) clearInterval(timer); timer = null; }

/**
 * بناء قائمة التذكيرات ليوم من جدول المواقيت.
 * @param {object} times نتيجة computePrayerTimes
 * @param {object} prefs إعدادات الإشعارات { prayers: {fajr:true,...}, preMinutes }
 * @param {(d:Date)=>string} fmt منسّق الوقت
 */
export function buildReminders(times, prefs, fmt, dateKey, num = (v) => String(v)) {
  const out = [];
  for (const key of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']) {
    if (!prefs.prayers || !prefs.prayers[key]) continue;
    const t = times[key]; if (!(t instanceof Date) || isNaN(t)) continue;
    const name = PRAYER_NAMES_AR[key];
    if (key === 'sunrise') out.push({ id: `${dateKey}:${key}`, time: t, kind: 'sunrise', title: 'طلوع الشمس', body: `طلعت الشمس (${fmt(t)}) — انتهى وقت الفجر` });
    else out.push({ id: `${dateKey}:${key}`, time: t, kind: 'adhan', prayer: key, title: `حان الآن موعد صلاة ${name}`, body: `${name} — ${fmt(t)}` });
    if (prefs.preMinutes > 0 && key !== 'sunrise') {
      const pre = new Date(t.getTime() - prefs.preMinutes * 60000);
      out.push({ id: `${dateKey}:${key}:pre`, time: pre, kind: 'pre', prayer: key, title: `اقترب موعد صلاة ${name}`, body: `بقي ${num(prefs.preMinutes)} دقيقة على الأذان (${fmt(t)})` });
    }
  }
  return out;
}

/* ---------- تصدير ICS ---------- */
function icsDate(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
/** طيّ الأسطر الطويلة وفق RFC 5545 (≤ 75 بايت لكل سطر، متابعة بمسافة) */
function icsFold(line) {
  const enc = new TextEncoder(); const out = []; let cur = '';
  for (const ch of line) {
    if (enc.encode(cur + ch).length > 75) { out.push(cur); cur = ' ' + ch; } else cur += ch;
  }
  out.push(cur); return out.join('\r\n');
}
/**
 * @param {Array<{date, times}>} days  عناصر من computePrayerTimes
 * @param {object} opts { locationName, prayers: {fajr:true...}, preMinutes, includeSunrise }
 */
export function buildICS(days, opts = {}) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sakinah//Prayer Times//AR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:مواقيت الصلاة — سكينة'];
  const stamp = icsDate(new Date());
  for (const day of days) {
    for (const key of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']) {
      if (opts.prayers && opts.prayers[key] === false) continue;
      if (key === 'sunrise' && !opts.includeSunrise) continue;
      const t = day[key]; if (!(t instanceof Date) || isNaN(t)) continue;
      const name = key === 'sunrise' ? 'الشروق' : `صلاة ${PRAYER_NAMES_AR[key]}`;
      const uid = `${icsDate(t)}-${key}@sakinah`;
      lines.push('BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp}`, `DTSTART:${icsDate(t)}`, `DTEND:${icsDate(new Date(t.getTime() + 10 * 60000))}`,
        `SUMMARY:${icsEscape(name)}`, `DESCRIPTION:${icsEscape(`${name}${opts.locationName ? ' — ' + opts.locationName : ''}\nمن تطبيق سكينة`)}`, 'TRANSP:TRANSPARENT');
      if (key !== 'sunrise') {
        lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(name)}`, 'TRIGGER:PT0M', 'END:VALARM');
        if (opts.preMinutes > 0) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(`اقترب موعد ${name}`)}`, `TRIGGER:-PT${opts.preMinutes}M`, 'END:VALARM');
      }
      lines.push('END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}
export async function downloadFile(filename, content, type = 'text/calendar;charset=utf-8') {
  // داخل الغلاف الأصلي لا تعمل روابط التنزيل: نحفظ الملف ونفتح ورقة المشاركة (التقويم، الملفات، البريد…)
  if (isNative()) { if (await shareFile(filename, content, type.split(';')[0])) return; }
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}
