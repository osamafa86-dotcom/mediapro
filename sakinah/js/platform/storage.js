/**
 * تخزين الإعدادات والحالة محليًا (localStorage) مع قيم افتراضية ونظام اشتراك بسيط.
 */
const KEY = 'sakinah:v1';

export const DEFAULT_SETTINGS = {
  location: null,            // { lat, lon, tz, name, countryCode, cityId, source: 'gps'|'city'|'manual', accuracy }
  method: 'auto',            // 'auto' أو معرّف طريقة من methods.js
  madhab: 'shafi',           // 'shafi' | 'hanafi'
  highLatitudeRule: 'auto',
  shafaq: 'general',         // لطريقة Moonsighting فقط: 'general' | 'ahmer' | 'abyad'
  adjustments: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  custom: { fajrAngle: 18, ishaAngle: 17, ishaInterval: 0, maghribAngle: 0 },
  hijriOffset: 0,
  hour12: true,
  numerals: 'latn',          // 'latn' | 'arab'
  theme: 'auto',             // 'auto' | 'light' | 'dark'
  notifications: {
    enabled: false,
    prayers: { fajr: true, sunrise: false, dhuhr: true, asr: true, maghrib: true, isha: true },
    preMinutes: 0,           // تذكير قبل الأذان بدقائق (0 = عند الأذان فقط)
    sound: 'chime',          // 'chime' | 'none'
    vibrate: true,
  },
  compass: { declinationMode: 'auto' }, // 'auto' | 'on' | 'off'
  privacy: { geocode: true },   // تسمية المدينة عبر الإنترنت بإحداثيات مقرّبة (نحو 1 كم)؛ الإيقاف يكتفي بأقرب مدينة من القائمة
  quran: {
    lastRead: null,          // { page, surah, ayah, at }
    bookmarks: [],           // [{ surah, ayah, page, at }]
    reciter: 'ar.alafasy', repeatAyah: 1, repeatRange: false, rate: 1, follow: true,
    fontScale: 1, hifzOnlyCurrent: true, night: false, paper: 'cream', fontsOffline: false, hintShown: false,
    tafsir: 'muyassar', view: 'pages', // view: 'pages' صفحات المصحف | 'text' نص متدفق بحجم قابل للتغيير
  },
  adhkarProgress: { date: null, morning: {}, evening: {} },
  favorites: [],
  seenIntro: false,
};

function safeParse(raw) {
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch === undefined ? base : patch;
  const out = { ...base };
  for (const k of Object.keys(patch)) {
    out[k] = (base && typeof base[k] === 'object' && base[k] !== null && !Array.isArray(base[k]))
      ? deepMerge(base[k], patch[k]) : patch[k];
  }
  return out;
}

const listeners = new Set();
const clone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
// نسخة عميقة من الافتراضيات حتى لا تشاركها الحالة بالمرجع
let state = deepMerge(clone(DEFAULT_SETTINGS), safeParse(typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null) || {});

export function getSettings() { return state; }
export function get(path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state);
}
/** تحديث جزئي (دمج عميق) مع حفظ وإشعار المشتركين */
export function update(patch) {
  state = deepMerge(state, patch);
  persist();
  for (const fn of listeners) { try { fn(state, patch); } catch (e) { console.error(e); } }
  return state;
}
export function set(path, value) {
  const keys = path.split('.');
  const patch = {}; let cur = patch;
  keys.forEach((k, i) => { cur[k] = i === keys.length - 1 ? value : {}; cur = cur[k]; });
  return update(patch);
}
/** استبدال قيمة كاملة دون دمج عميق (للكائنات التي يجب تصفيرها مثل تقدّم الأذكار) */
export function replace(path, value) {
  const keys = path.split('.');
  const next = { ...state }; let cur = next;
  keys.forEach((k, i) => {
    if (i === keys.length - 1) cur[k] = value;
    else { cur[k] = { ...(cur[k] || {}) }; cur = cur[k]; }
  });
  state = next; persist();
  for (const fn of listeners) { try { fn(state, { [path]: value }); } catch (e) { console.error(e); } }
  return state;
}
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function resetAll() { state = clone(DEFAULT_SETTINGS); persist(); for (const fn of listeners) fn(state, {}); }

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('storage failed', e); }
}
