/**
 * تحديد الموقع: GPS مع احتياط قائمة المدن دون اتصال، وتسمية الموقع (جيوكود عكسي اختياري).
 * كائن الموقع: { lat, lon, tz, name, countryCode, countryAr, cityId, source, accuracy, updatedAt }
 */
import { CITIES, nearestCity } from '../data/cities.js';

export function deviceTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

export function isGeolocationSupported() { return typeof navigator !== 'undefined' && 'geolocation' in navigator; }

/** طلب الموقع من الجهاز */
export function getPosition({ timeout = 15000, highAccuracy = true, maximumAge = 5 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) return reject(Object.assign(new Error('unsupported'), { code: 'unsupported' }));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      (err) => reject(Object.assign(new Error(err.message), { code: err.code === 1 ? 'denied' : err.code === 2 ? 'unavailable' : 'timeout' })),
      { enableHighAccuracy: highAccuracy, timeout, maximumAge },
    );
  });
}

/** كشف الموقع بالكامل: إحداثيات + منطقة زمنية + اسم */
export async function detectLocation(opts = {}) {
  let pos;
  try { pos = await getPosition(opts); }
  catch (e) {
    if (e.code === 'timeout' && opts.highAccuracy !== false) pos = await getPosition({ ...opts, highAccuracy: false, timeout: 20000 });
    else throw e;
  }
  const lat = +pos.coords.latitude.toFixed(5), lon = +pos.coords.longitude.toFixed(5);
  const near = nearestCity(lat, lon);
  // المنطقة الزمنية: من الجهاز عادةً؛ لكن إن كانت أقرب مدينة (≤ 60 كم) في منطقة تختلف إزاحتها الآن عن منطقة الجهاز
  // (مسافر لم يغيّر توقيت جهازه) نأخذ منطقة المدينة وإلا انزاحت كل الأوقات بفارق المنطقتين
  const devTz = deviceTimeZone();
  const nearKm = near ? haversineKm(lat, lon, near.lat, near.lon) : Infinity;
  const tz = near && nearKm <= 60 && near.tz && near.tz !== devTz && tzOffsetMinutes(near.tz) !== tzOffsetMinutes(devTz) ? near.tz : devTz;
  const loc = {
    lat, lon, tz, tzFromCity: tz !== devTz, accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null,
    name: near ? near.nameAr : `${lat.toFixed(3)}, ${lon.toFixed(3)}`, countryCode: near ? near.countryCode : null, countryAr: near ? near.countryAr : '',
    cityId: null, source: 'gps', updatedAt: Date.now(), approxName: true,
  };
  // إذا كانت أقرب مدينة بعيدة جدًا (> 60 كم) نُبقي الاسم تقريبيًا مع الإشارة للمسافة
  if (near) {
    const d = haversineKm(lat, lon, near.lat, near.lon);
    loc.nearestKm = Math.round(d);
    if (d > 60) loc.name = `قرب ${near.nameAr}`;
  }
  // تسمية المدينة عبر الإنترنت اختيارية، وبإحداثيات مقرّبة إلى منزلتين (نحو كيلومتر) لا بالموقع الدقيق
  try {
    const g = opts.geocode === false ? null : await reverseGeocode(+lat.toFixed(2), +lon.toFixed(2));
    if (g) {
      if (g.city) loc.name = g.city;
      if (g.countryCode) loc.countryCode = g.countryCode;
      if (g.countryName) loc.countryAr = g.countryName;
      loc.approxName = false;
    }
  } catch { /* دون اتصال: نكتفي بأقرب مدينة */ }
  return loc;
}

/** إزاحة منطقة زمنية عن UTC بالدقائق في لحظة معيّنة */
export function tzOffsetMinutes(tz, date = new Date()) {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(date).reduce((o, x) => (o[x.type] = x.value, o), {});
    return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(date.getTime() / 60000) * 60000) / 60000);
  } catch { return 0; }
}

/** جيوكود عكسي مجاني دون مفتاح (BigDataCloud) — أفضل جهد فقط. الإحداثيات تُقرَّب إلى منزلتين دائمًا حمايةً للخصوصية */
export async function reverseGeocode(lat, lon, { timeoutMs = 6000 } = {}) {
  if (typeof fetch === 'undefined' || (typeof navigator !== 'undefined' && navigator.onLine === false)) return null;
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${(+lat).toFixed(2)}&longitude=${(+lon).toFixed(2)}&localityLanguage=ar`;
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const j = await res.json();
    return { city: j.city || j.locality || j.principalSubdivision || null, countryCode: j.countryCode || null, countryName: j.countryName || null };
  } finally { clearTimeout(t); }
}

export function locationFromCity(city) {
  return { lat: city.lat, lon: city.lon, tz: city.tz, name: city.nameAr, countryCode: city.countryCode, countryAr: city.countryAr, cityId: city.id, source: 'city', accuracy: null, updatedAt: Date.now() };
}
export function locationFromCoords(lat, lon, tz) {
  const near = nearestCity(lat, lon);
  return { lat: +lat, lon: +lon, tz: tz || (near ? near.tz : deviceTimeZone()), name: near ? `قرب ${near.nameAr}` : `${lat}, ${lon}`, countryCode: near ? near.countryCode : null, countryAr: near ? near.countryAr : '', cityId: null, source: 'manual', accuracy: null, updatedAt: Date.now() };
}

/** بحث في قائمة المدن (بالعربية أو الإنجليزية) */
export function searchCities(q, limit = 30) {
  const s = normalize(q);
  if (!s) return CITIES.slice(0, limit);
  const scored = [];
  for (const c of CITIES) {
    const a = normalize(c.nameAr), e = c.nameEn.toLowerCase(), k = normalize(c.countryAr);
    let score = 0;
    if (a.startsWith(s) || e.startsWith(s)) score = 3; else if (a.includes(s) || e.includes(s)) score = 2; else if (k.includes(s)) score = 1;
    if (score) scored.push([score, c]);
  }
  return scored.sort((x, y) => y[0] - x[0]).slice(0, limit).map((x) => x[1]);
}
function normalize(s) { return String(s || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[ًٌٍَُِّْ]/g, '').trim(); }

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, d = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * d) / 2) ** 2 + Math.cos(lat1 * d) * Math.cos(lat2 * d) * Math.sin(((lon2 - lon1) * d) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function describeLocation(loc) {
  if (!loc) return 'لم يُحدَّد الموقع';
  return loc.countryAr && !loc.name.includes(loc.countryAr) ? `${loc.name}، ${loc.countryAr}` : loc.name;
}
