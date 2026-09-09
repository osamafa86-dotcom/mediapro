/**
 * تخزين الإعدادات والحالة محليًا (localStorage) مع قيم افتراضية ونظام اشتراك بسيط.
 */
const KEY = 'sakinah:v1';
const BACKUP_KEY = 'sakinah:v1.corrupt'; // نسخة من الحمولة التالفة (إن وُجدت) للتشخيص بدل إسقاطها بصمت
export const SCHEMA = 1;

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
    sound: 'chime',          // 'chime' | 'adhan-fakhry' | 'adhan-azeez' | 'none'
    nativeUntil: null,       // آخر موعد مجدوَل كإشعار نظام (التطبيق الأصلي)
    vibrate: true,
    adhkar: { morning: false, evening: false, morningAfter: 30, eveningAfter: 30 }, // تذكير الأذكار: بعد الفجر/العصر بدقائق
    hadithDaily: { enabled: false, time: '09:00' }, // إشعار حديث اليوم
  },
  compass: { declinationMode: 'auto' }, // 'auto' | 'on' | 'off'
  privacy: { geocode: true },   // تسمية المدينة عبر الإنترنت بإحداثيات مقرّبة (نحو 1 كم)؛ الإيقاف يكتفي بأقرب مدينة من القائمة
  quran: {
    lastRead: null,          // { page, surah, ayah, at }
    bookmarks: [],           // [{ surah, ayah, page, at }]
    reciter: 'ar.alafasy', repeatAyah: 1, repeatRange: false, rate: 1, follow: true,
    fontScale: 1, hifzOnlyCurrent: true, night: false, paper: 'cream', fontsOffline: false, hintShown: false,
    theme: 'cream', themeLight: 'cream', themeDark: 'dark', themeAuto: false, // سمة الصفحة (core/mushaf-themes.js)؛ night/paper للترقية فقط
    dim: 0, keepAwake: true, lineHeight: 2.15, // تعتيم الصفحة (0–0.6)، إبقاء الشاشة مضاءة، تباعد الأسطر في وضع النص
    tajweed: false, scroll: 'horizontal', autoSpeed: 40, textFont: 'amiri', fitText: true, // التجويد الملوّن (وضع النص)، اتجاه التصفح، سرعة التمرير التلقائي (بكسل/ث)، خط وضع النص
    challenge: null,         // تحدّي القراءة النشط { id, startedAt, startPage, from, to }
    tafsir: 'muyassar', view: 'pages', // view: 'pages' صفحات المصحف | 'text' نص متدفق بحجم قابل للتغيير
    wordHighlight: true,     // تظليل الكلمة أثناء التلاوة (مصدر quran.com للقرّاء الذين تتوفر توقيتاتهم)
    downloads: {},           // { [reciterId]: { [surah]: { files, bytes, at } } }
    khatmah: null,           // خطة الختمة (core/khatmah.js)
    readLog: {},             // { 'YYYY-MM-DD': [pages] }
  },
  adhkarProgress: { date: null, morning: {}, evening: {} },
  favorites: [],
  seenIntro: false,
  icsUntil: null,            // آخر يوم يغطيه تقويم ICS المصدَّر (لتذكير إعادة التصدير)
  tasbih: null,              // حالة المسبحة (core/tasbih.js)
  hisnFavorites: [],         // أبواب حصن المسلم المفضلة (أرقامها)
  shareTheme: 'green',       // سمة بطاقة المشاركة
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
/** حمولة صالحة = كائن عادي؛ أي شيء آخر (مصفوفة، نص، null) يُهمل مع الاحتفاظ بنسخة تشخيصية */
function loadStored() {
  if (typeof localStorage === 'undefined') return {};
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { return {}; }
  const parsed = safeParse(raw);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  if (raw) { try { localStorage.setItem(BACKUP_KEY, raw); } catch { /* تجاهل */ } console.warn('storage: حمولة تالفة أُهملت وحُفظت نسخة منها في', BACKUP_KEY); }
  return {};
}
let state = deepMerge(clone(DEFAULT_SETTINGS), loadStored());
state.schema = SCHEMA;
/** آخر خطأ حفظ (امتلاء التخزين مثلًا) ومستمعوه، كي تُخبر الواجهة المستخدم بدل الصمت */
export let lastPersistError = null;
const persistListeners = new Set();
export function onPersistError(fn) { persistListeners.add(fn); return () => persistListeners.delete(fn); }

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
export function resetAll() { state = clone(DEFAULT_SETTINGS); state.schema = SCHEMA; persist(); for (const fn of listeners) fn(state, {}); }

/** تصدير الحالة كلها (الإعدادات والعلامات والتقدّم) نصًا JSON لنسخة احتياطية */
export function exportJSON() {
  return JSON.stringify({ app: 'sakinah', schema: SCHEMA, exportedAt: new Date().toISOString(), settings: state }, null, 1);
}
/**
 * استيراد نسخة احتياطية: تُدمج فوق الافتراضيات (لا فوق الحالة الحالية) كي تحلّ محلها بالكامل، مع التحقق من الشكل.
 * @returns {{ok:boolean, error?:string, exportedAt?:string}}
 */
export function importJSON(text) {
  const data = safeParse(text);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: 'invalid' };
  const src = data.app === 'sakinah' && data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings) ? data.settings : (data.location !== undefined || data.quran !== undefined ? data : null);
  if (!src) return { ok: false, error: 'not-sakinah' };
  state = deepMerge(clone(DEFAULT_SETTINGS), src); state.schema = SCHEMA;
  persist();
  for (const fn of listeners) { try { fn(state, {}); } catch (e) { console.error(e); } }
  return { ok: true, exportedAt: data.exportedAt || null };
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); lastPersistError = null; }
  catch (e) {
    // امتلاء التخزين أو وضع خاص يمنع الكتابة: لا نصمت — تُبلَّغ الواجهة مرة لتنبيه المستخدم
    lastPersistError = e;
    console.warn('storage failed', e);
    for (const fn of persistListeners) { try { fn(e); } catch { /* تجاهل */ } }
  }
}
