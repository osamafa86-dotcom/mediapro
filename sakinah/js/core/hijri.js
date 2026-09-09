import { cachedFormatter } from './intl-cache.js';
/**
 * التاريخ الهجري (تقويم أم القرى) اعتمادًا على Intl (ICU) المدمج في المتصفح،
 * مع بديل حسابي (التقويم الهجري الجدولي/الكويتي) عند غياب دعم التقويم.
 * يدعم تعديل المستخدم ±يومين لمطابقة الرؤية المحلية.
 */
export const HIJRI_MONTHS_AR = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
];
export const WEEKDAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

let umalquraSupported = null;
function supportsUmalqura() {
  if (umalquraSupported !== null) return umalquraSupported;
  try {
    const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { timeZone: 'UTC', day: 'numeric', month: 'numeric', year: 'numeric' });
    umalquraSupported = f.resolvedOptions().calendar === 'islamic-umalqura';
  } catch { umalquraSupported = false; }
  return umalquraSupported;
}

/**
 * @param {Date} date
 * @param {string} tz  المنطقة الزمنية لتحديد اليوم المدني
 * @param {number} offsetDays  تعديل المستخدم (±)
 * @returns {{day:number, month:number, year:number, monthName:string, weekday:string, formatted:string, source:'umalqura'|'tabular'}}
 */
export function hijriDate(date = new Date(), tz = 'UTC', offsetDays = 0) {
  // اليوم المدني في منطقة المستخدم، ثم إزاحته بالأيام على مستوى التاريخ (لا بالمللي ثانية) لتفادي أثر التوقيت الصيفي
  const civ = cachedFormatter('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(date).reduce((o, p) => (o[p.type] = +p.value, o), {});
  const shifted = new Date(Date.UTC(civ.year, civ.month - 1, civ.day + (offsetDays | 0), 12));
  let day, month, year, source;
  if (supportsUmalqura()) {
    const parts = cachedFormatter('en-u-ca-islamic-umalqura-nu-latn', { timeZone: 'UTC', day: 'numeric', month: 'numeric', year: 'numeric' })
      .formatToParts(shifted).reduce((o, p) => (o[p.type] = p.value, o), {});
    day = +parts.day; month = +parts.month; year = +parts.year; source = 'umalqura';
  } else {
    ({ day, month, year } = tabularHijri(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate())); source = 'tabular';
  }
  const weekdayIndex = weekdayInTz(date, tz);
  const monthName = HIJRI_MONTHS_AR[month - 1];
  return { day, month, year, monthName, weekday: WEEKDAYS_AR[weekdayIndex], formatted: `${day} ${monthName} ${year}هـ`, source };
}

export function weekdayInTz(date, tz) {
  const w = cachedFormatter('en-US', { timeZone: tz, weekday: 'short' }).format(date);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(w);
}

/** هل اليوم في رمضان؟ (لتفعيل تعديل أم القرى الرمضاني) */
export function isRamadan(date = new Date(), tz = 'UTC', offsetDays = 0) {
  return hijriDate(date, tz, offsetDays).month === 9;
}

/** التقويم الهجري الجدولي (الخوارزمية الكويتية) — بديل تقريبي قد يختلف يومًا عن أم القرى */
export function tabularHijri(gy, gm, gd) {
  let jd;
  {
    const a = Math.floor((14 - gm) / 12), y = gy + 4800 - a, m = gm + 12 * a - 3;
    jd = gd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  }
  const l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  let l2 = l - 10631 * n + 354;
  const j = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) + Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  l2 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l2) / 709);
  const day = l2 - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { day, month, year };
}

/** التاريخ الميلادي المنسّق بالعربية */
export function gregorianFormatted(date = new Date(), tz = 'UTC', numerals = 'latn') {
  return new Intl.DateTimeFormat(`ar-u-nu-${numerals}`, { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}
