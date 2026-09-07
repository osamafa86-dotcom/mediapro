/**
 * محرك حساب مواقيت الصلاة
 * ------------------------
 * يعتمد على الحسابات الفلكية في astro.js ويطبّق طرق الحساب في methods.js.
 * - يُحسب اليوم المدني في المنطقة الزمنية للمستخدم (وليس منطقة المتصفح) ثم تُنتج لحظات UTC دقيقة.
 * - يدعم مذهبَي العصر (الشافعي/الحنفي)، وقواعد خطوط العرض العالية، وحلّ المناطق القطبية،
 *   وتعديلات الدقائق (الهيئة + المستخدم)، وتقريب الدقائق، ومنتصف الليل وثلثه الأخير.
 * الخوارزمية مطابقة لمكتبة adhan-js (MIT © Batoul Apps) وتُختبر ضدها آليًا.
 */
import { SolarTime, d2r, r2d } from './astro.js';
import { getMethod } from './methods.js';

export const PRAYERS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const PRAYER_NAMES_AR = {
  fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء',
  middleOfNight: 'منتصف الليل', lastThird: 'الثلث الأخير',
};

export const HIGH_LATITUDE_RULES = {
  Auto: 'auto',
  MiddleOfTheNight: 'middleofthenight',
  SeventhOfTheNight: 'seventhofthenight',
  TwilightAngle: 'twilightangle',
};
export const HIGH_LATITUDE_RULE_NAMES_AR = {
  auto: 'تلقائي (نسبة زاوية الشفق فوق 48°)',
  middleofthenight: 'منتصف الليل',
  seventhofthenight: 'سُبع الليل',
  twilightangle: 'نسبة زاوية الشفق',
};

/** الإعدادات الافتراضية لعملية الحساب */
export function defaultParams(overrides = {}) {
  return {
    method: 'MuslimWorldLeague',
    madhab: 'shafi',              // 'shafi' | 'hanafi'
    highLatitudeRule: 'auto',
    polarResolution: 'aqrabbalad',// 'aqrabbalad' | 'unresolved'
    adjustments: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }, // تعديلات المستخدم
    custom: null,                 // { fajrAngle, ishaAngle, ishaInterval, maghribAngle } للطريقة المخصّصة
    isRamadan: false,             // لتفعيل بديل أم القرى الرمضاني (120 دقيقة)
    rounding: null,               // null = حسب الطريقة
    ...overrides,
    ...(overrides.adjustments ? { adjustments: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0, ...overrides.adjustments } } : {}),
  };
}

/** مكوّنات التاريخ المدني (سنة/شهر/يوم) للحظة معيّنة في منطقة زمنية */
export function civilDate(date, tz) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' });
  const parts = Object.fromEntries(fmt.formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
  return { year: parts.year, month: parts.month, day: parts.day };
}

export function addDays({ year, month, day }, n) {
  const d = new Date(Date.UTC(year, month - 1, day + n));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function isLeapYear(y) { return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0); }
function dayOfYear({ year, month, day }) {
  const months = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let n = 0; for (let i = 0; i < month - 1; i++) n += months[i];
  return n + day;
}

/** تحويل ساعات UT (كسرية) إلى لحظة Date في اليوم المدني المعطى (كما في adhan: اقتطاع الثواني) */
function utcDate({ year, month, day }, hours) {
  if (!Number.isFinite(hours)) return new Date(NaN);
  const h = Math.floor(hours);
  const min = Math.floor((hours - h) * 60);
  const sec = Math.floor((hours - (h + min / 60)) * 3600);
  return new Date(Date.UTC(year, month - 1, day, h, min, sec));
}
const addSeconds = (date, s) => new Date(date.getTime() + s * 1000);
const addMinutes = (date, m) => addSeconds(date, m * 60);
const isValid = (d) => d instanceof Date && !isNaN(d.getTime());

function roundedMinute(date, rounding = 'nearest') {
  if (!isValid(date)) return date;
  const seconds = date.getUTCSeconds();
  let offset = seconds >= 30 ? 60 - seconds : -seconds;
  if (rounding === 'up') offset = 60 - seconds;
  else if (rounding === 'none') offset = 0;
  return addSeconds(date, offset);
}

const isValidSolarTime = (st) => !isNaN(st.sunrise) && !isNaN(st.sunset);

/** حلّ "أقرب بلد": الاقتراب من خط الاستواء بخطوات نصف درجة حتى تظهر الشمس وتغيب */
function aqrabBalad(coords, date, tomorrow) {
  let lat = coords.latitude;
  for (let i = 0; i < 100; i++) {
    lat -= Math.sign(lat) * 0.5;
    const c = { latitude: lat, longitude: coords.longitude };
    const st = new SolarTime(date, c), st2 = new SolarTime(tomorrow, c);
    if (isValidSolarTime(st) && isValidSolarTime(st2)) return { coords: c, solarTime: st, tomorrowSolarTime: st2 };
    if (Math.abs(lat) < 65) break;
  }
  return null;
}

/** قواعد لجنة رؤية الهلال للشفق الموسمي (خطوط العرض العالية) */
function daysSinceSolstice(doy, year, latitude) {
  const daysInYear = isLeapYear(year) ? 366 : 365;
  if (latitude >= 0) { let d = doy + 10; if (d >= daysInYear) d -= daysInYear; return d; }
  let d = doy - (isLeapYear(year) ? 173 : 172); if (d < 0) d += daysInYear; return d;
}
function seasonalAdjustment(a, b, c, d, dyy) {
  if (dyy < 91) return a + ((b - a) / 91) * dyy;
  if (dyy < 137) return b + ((c - b) / 46) * (dyy - 91);
  if (dyy < 183) return c + ((d - c) / 46) * (dyy - 137);
  if (dyy < 229) return d + ((c - d) / 46) * (dyy - 183);
  if (dyy < 275) return c + ((b - c) / 46) * (dyy - 229);
  return b + ((a - b) / 91) * (dyy - 275);
}
function seasonAdjustedMorningTwilight(latitude, doy, year, sunrise) {
  const L = Math.abs(latitude);
  const adj = seasonalAdjustment(75 + (28.65 / 55) * L, 75 + (19.44 / 55) * L, 75 + (32.74 / 55) * L, 75 + (48.1 / 55) * L, daysSinceSolstice(doy, year, latitude));
  return addSeconds(sunrise, Math.round(adj * -60));
}
function seasonAdjustedEveningTwilight(latitude, doy, year, sunset, shafaq = 'general') {
  const L = Math.abs(latitude);
  let a, b, c, d;
  if (shafaq === 'ahmer') { a = 62 + (17.4 / 55) * L; b = 62 - (7.16 / 55) * L; c = 62 + (5.12 / 55) * L; d = 62 + (19.44 / 55) * L; }
  else if (shafaq === 'abyad') { a = 75 + (25.6 / 55) * L; b = 75 + (7.16 / 55) * L; c = 75 + (36.84 / 55) * L; d = 75 + (81.84 / 55) * L; }
  else { a = 75 + (25.6 / 55) * L; b = 75 + (2.05 / 55) * L; c = 75 - (9.21 / 55) * L; d = 75 + (6.14 / 55) * L; }
  const adj = seasonalAdjustment(a, b, c, d, daysSinceSolstice(doy, year, latitude));
  return addSeconds(sunset, Math.round(adj * 60));
}

/** المعاملات الفعلية للطريقة المختارة (مع الطريقة المخصّصة والبديل الرمضاني) */
export function resolveMethodParams(params) {
  const base = getMethod(params.method);
  const p = { ...base, adjustments: { ...base.adjustments } };
  if (params.method === 'Custom' && params.custom) {
    Object.assign(p, {
      fajrAngle: Number(params.custom.fajrAngle ?? 18),
      ishaAngle: Number(params.custom.ishaAngle ?? 17),
      ishaInterval: Number(params.custom.ishaInterval ?? 0),
      maghribAngle: Number(params.custom.maghribAngle ?? 0),
    });
  }
  if (params.isRamadan && p.ishaIntervalRamadan) p.ishaInterval = p.ishaIntervalRamadan;
  if (params.rounding) p.rounding = params.rounding;
  return p;
}

function nightPortions(rule, latitude, fajrAngle, ishaAngle) {
  // تلقائي: فوق 48° نستخدم «نسبة زاوية الشفق» (الافتراضي في AlAdhan) لأنها لا تُقيّد إلا حين يطول الشفق فعلًا صيفًا؛
  // ودونه «منتصف الليل» (لا يُقيّد عمليًا).
  const r = rule === 'auto' ? (latitude > 48 ? 'twilightangle' : 'middleofthenight') : rule;
  if (r === 'seventhofthenight') return { fajr: 1 / 7, isha: 1 / 7 };
  if (r === 'twilightangle') return { fajr: fajrAngle / 60, isha: ishaAngle / 60 };
  return { fajr: 1 / 2, isha: 1 / 2 };
}

/**
 * حساب مواقيت الصلاة ليوم مدني معيّن.
 * @param {{latitude:number, longitude:number}} coords
 * @param {{year:number, month:number, day:number}} date  اليوم المدني في منطقة المستخدم (الشهر 1..12)
 * @param {object} params  انظر defaultParams
 * @returns {{fajr:Date, sunrise:Date, dhuhr:Date, asr:Date, maghrib:Date, isha:Date, sunset:Date, date:object, coords:object, resolved:object}}
 */
export function computePrayerTimes(coords, date, params = defaultParams()) {
  params = defaultParams(params);
  const mp = resolveMethodParams(params);
  const tomorrow = addDays(date, 1);
  let usedCoords = coords;
  let solarTime = new SolarTime(date, coords);
  let tomorrowSolarTime = new SolarTime(tomorrow, coords);

  let dhuhrTime = utcDate(date, solarTime.transit);
  let sunriseTime = utcDate(date, solarTime.sunrise);
  let sunsetTime = utcDate(date, solarTime.sunset);
  let polarResolved = false;

  if ((!isValid(sunriseTime) || !isValid(sunsetTime) || isNaN(tomorrowSolarTime.sunrise)) && params.polarResolution === 'aqrabbalad') {
    const r = aqrabBalad(coords, date, tomorrow);
    if (r) {
      polarResolved = true;
      usedCoords = r.coords; solarTime = r.solarTime; tomorrowSolarTime = r.tomorrowSolarTime;
      dhuhrTime = utcDate(date, solarTime.transit);
      sunriseTime = utcDate(date, solarTime.sunrise);
      sunsetTime = utcDate(date, solarTime.sunset);
    }
  }

  const shadow = params.madhab === 'hanafi' ? 2 : 1;
  const asrTime = utcDate(date, solarTime.afternoon(shadow));
  const tomorrowSunrise = utcDate(tomorrow, tomorrowSolarTime.sunrise);
  const night = (tomorrowSunrise.getTime() - sunsetTime.getTime()) / 1000; // ثوانٍ
  const portions = nightPortions(params.highLatitudeRule, usedCoords.latitude, mp.fajrAngle, mp.ishaAngle);
  const isMoonsighting = mp.id === 'MoonsightingCommittee';
  const doy = dayOfYear(date);

  // ---- الفجر ----
  let fajrTime = utcDate(date, solarTime.hourAngle(-mp.fajrAngle, false));
  if (isMoonsighting && usedCoords.latitude >= 55) fajrTime = addSeconds(sunriseTime, -night / 7);
  const safeFajr = isMoonsighting
    ? seasonAdjustedMorningTwilight(usedCoords.latitude, doy, date.year, sunriseTime)
    : addSeconds(sunriseTime, -portions.fajr * night);
  let fajrSafe = false;
  if (!isValid(fajrTime) || safeFajr > fajrTime) { fajrTime = safeFajr; fajrSafe = true; }

  // ---- العشاء ----
  let ishaTime, ishaSafe = false;
  if (mp.ishaInterval > 0) {
    ishaTime = addMinutes(sunsetTime, mp.ishaInterval);
  } else {
    ishaTime = utcDate(date, solarTime.hourAngle(-mp.ishaAngle, true));
    if (isMoonsighting && usedCoords.latitude >= 55) ishaTime = addSeconds(sunsetTime, night / 7);
    const safeIsha = isMoonsighting
      ? seasonAdjustedEveningTwilight(usedCoords.latitude, doy, date.year, sunsetTime, params.shafaq)
      : addSeconds(sunsetTime, portions.isha * night);
    if (!isValid(ishaTime) || safeIsha < ishaTime) { ishaTime = safeIsha; ishaSafe = true; }
  }

  // ---- المغرب ----
  let maghribTime = sunsetTime;
  if (mp.maghribAngle) {
    const angleBased = utcDate(date, solarTime.hourAngle(-mp.maghribAngle, true));
    if (sunsetTime < angleBased && ishaTime > angleBased) maghribTime = angleBased;
  }
  if (mp.maghribInterval) maghribTime = addMinutes(maghribTime, mp.maghribInterval);

  const adj = (k) => (params.adjustments[k] || 0) + (mp.adjustments[k] || 0);
  const rounding = mp.rounding || 'nearest';
  const out = {
    fajr: roundedMinute(addMinutes(fajrTime, adj('fajr')), rounding),
    sunrise: roundedMinute(addMinutes(sunriseTime, adj('sunrise')), rounding),
    dhuhr: roundedMinute(addMinutes(dhuhrTime, adj('dhuhr')), rounding),
    asr: roundedMinute(addMinutes(asrTime, adj('asr')), rounding),
    sunset: roundedMinute(sunsetTime, rounding),
    maghrib: roundedMinute(addMinutes(maghribTime, adj('maghrib')), rounding),
    isha: roundedMinute(addMinutes(ishaTime, adj('isha')), rounding),
    date, coords,
    resolved: { method: mp, polarResolved, usedLatitude: usedCoords.latitude, fajrSafe, ishaSafe, nightSeconds: night },
  };
  return out;
}

/** منتصف الليل الشرعي والثلث الأخير (من المغرب إلى فجر الغد) */
export function sunnahTimes(coords, date, params = defaultParams()) {
  const today = computePrayerTimes(coords, date, params);
  const next = computePrayerTimes(coords, addDays(date, 1), params);
  const nightDuration = (next.fajr.getTime() - today.maghrib.getTime()) / 1000;
  return {
    middleOfNight: roundedMinute(addSeconds(today.maghrib, nightDuration / 2)),
    lastThird: roundedMinute(addSeconds(today.maghrib, nightDuration * (2 / 3))),
    nextFajr: next.fajr,
  };
}

/**
 * جدول يوم كامل مع الصلاة الحالية والتالية، مع التعامل مع ما قبل الفجر وما بعد العشاء.
 * @returns {{times, current:string|null, next:{key:string, time:Date}, sunnah}}
 */
export function dayTimeline(coords, tz, params = defaultParams(), now = new Date()) {
  const date = civilDate(now, tz);
  const times = computePrayerTimes(coords, date, params);
  const sunnah = sunnahTimes(coords, date, params);
  const order = PRAYERS.filter(k => isValid(times[k]));
  let current = null, next = null;
  for (const k of order) {
    if (now >= times[k]) current = k; else if (!next) next = { key: k, time: times[k], isTomorrow: false };
  }
  if (!next) {
    const tomorrow = computePrayerTimes(coords, addDays(date, 1), params);
    next = { key: 'fajr', time: tomorrow.fajr, isTomorrow: true };
  }
  if (current === null) {
    // قبل الفجر: الصلاة "الحالية" هي عشاء الأمس
    current = 'isha';
  }
  return { date, times, sunnah, current, next };
}

/** جدول شهري */
export function monthTable(coords, year, month, params = defaultParams()) {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const rows = [];
  for (let d = 1; d <= days; d++) rows.push(computePrayerTimes(coords, { year, month, day: d }, params));
  return rows;
}

/** تنسيق وقت في منطقة زمنية معيّنة (12/24 ساعة) بالأرقام العربية أو اللاتينية */
export function formatTime(date, tz, { hour12 = true, numerals = 'latn', locale = 'ar' } = {}) {
  if (!isValid(date)) return '—';
  return new Intl.DateTimeFormat(`${locale}-u-nu-${numerals}`, { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12 }).format(date);
}

export { isValid as isValidDate };
