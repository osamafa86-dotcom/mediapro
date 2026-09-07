/**
 * تحقق آلي من قاعدة بيانات المدن (js/data/cities.js):
 * البنية والمعرّفات والإحداثيات والمناطق الزمنية، وتغطية جامعة الدول العربية،
 * ومطابقة إحداثيات 25 مدينة مشهورة، وصحة nearestCity.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, COUNTRIES, nearestCity, haversineKm } from '../../js/data/cities.js';

const byId = new Map(CITIES.map((c) => [c.id, c]));
const COUNTRY_CODES = new Set(COUNTRIES.map((c) => c.code));
const REQUIRED = ['id', 'nameAr', 'nameEn', 'countryAr', 'countryCode', 'lat', 'lon', 'tz'];

/** إزاحة المنطقة الزمنية بالساعات عند تاريخ معيّن (عبر Intl). */
function tzOffsetHours(tz, date) {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName').value; // مثل GMT+05:30 أو GMT
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(part);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) + Number(m[3]) / 60);
}

test('عدد المدن >= 300 والمعرّفات فريدة', () => {
  assert.ok(Array.isArray(CITIES));
  assert.ok(CITIES.length >= 300, `عدد المدن ${CITIES.length} أقل من 300`);
  const ids = new Set(CITIES.map((c) => c.id));
  assert.equal(ids.size, CITIES.length, 'توجد معرّفات مكررة');
});

test('كل مدينة تحمل الحقول المطلوبة بأنواع صحيحة', () => {
  for (const c of CITIES) {
    for (const k of REQUIRED) {
      assert.ok(k in c, `${c.id ?? '?'}: الحقل ${k} مفقود`);
    }
    assert.deepEqual(Object.keys(c).sort(), [...REQUIRED].sort(), `${c.id}: حقول زائدة أو ناقصة`);
    for (const k of ['id', 'nameAr', 'nameEn', 'countryAr', 'countryCode', 'tz']) {
      assert.equal(typeof c[k], 'string', `${c.id}: ${k} ليس نصًا`);
      assert.ok(c[k].trim().length > 0, `${c.id}: ${k} فارغ`);
      assert.equal(c[k], c[k].trim(), `${c.id}: ${k} يحوي فراغات طرفية`);
    }
    assert.ok(Number.isFinite(c.lat) && Number.isFinite(c.lon), `${c.id}: إحداثيات غير رقمية`);
  }
});

test('صيغة المعرّف cc-slug ومطابقته لرمز الدولة', () => {
  for (const c of CITIES) {
    assert.match(c.id, /^[a-z]{2}-[a-z0-9]+(-[a-z0-9]+)*$/, `${c.id}: صيغة المعرّف`);
    assert.equal(c.id.slice(0, 2), c.countryCode.toLowerCase(), `${c.id}: بادئة المعرّف لا تطابق ${c.countryCode}`);
    assert.match(c.countryCode, /^[A-Z]{2}$/, `${c.id}: رمز الدولة`);
  }
});

test('الأسماء العربية عربية والإنجليزية لاتينية', () => {
  for (const c of CITIES) {
    assert.match(c.nameAr, /[؀-ۿ]/, `${c.id}: nameAr ليس عربيًا`);
    assert.match(c.countryAr, /[؀-ۿ]/, `${c.id}: countryAr ليس عربيًا`);
    assert.doesNotMatch(c.nameEn, /[؀-ۿ]/, `${c.id}: nameEn يحوي حروفًا عربية`);
    assert.match(c.nameEn, /^[\p{Script=Latin}' .,()-]+$/u, `${c.id}: nameEn يحوي رموزًا غير متوقعة`);
  }
});

test('الإحداثيات ضمن المدى وبأربع منازل عشرية على الأكثر', () => {
  for (const c of CITIES) {
    assert.ok(c.lat >= -90 && c.lat <= 90, `${c.id}: lat=${c.lat}`);
    assert.ok(c.lon >= -180 && c.lon <= 180, `${c.id}: lon=${c.lon}`);
    assert.equal(Math.round(c.lat * 1e4) / 1e4, c.lat, `${c.id}: lat أكثر من 4 منازل`);
    assert.equal(Math.round(c.lon * 1e4) / 1e4, c.lon, `${c.id}: lon أكثر من 4 منازل`);
  }
});

test('لا توجد مدينتان بنفس الإحداثيات', () => {
  const seen = new Map();
  for (const c of CITIES) {
    const key = `${c.lat},${c.lon}`;
    assert.ok(!seen.has(key), `${c.id} و ${seen.get(key)} بنفس الإحداثيات`);
    seen.set(key, c.id);
  }
});

test('كل منطقة زمنية مقبولة لدى Intl.DateTimeFormat', () => {
  for (const c of CITIES) {
    assert.doesNotThrow(() => new Intl.DateTimeFormat('en', { timeZone: c.tz }), `${c.id}: tz غير صالحة ${c.tz}`);
    assert.match(c.tz, /^[A-Z][A-Za-z_]+(\/[A-Za-z_+-]+){1,2}$/, `${c.id}: صيغة tz ${c.tz}`);
  }
});

test('الإزاحة الزمنية تتناسب مع خط الطول (كشف الأخطاء الجسيمة)', () => {
  // فرق بين إزاحة المنطقة الزمنية وبين خط الطول/15 لا يتجاوز 3 ساعات (شينجيانغ ≈ 2.9 ساعة)
  const jan = new Date('2026-01-15T12:00:00Z');
  const jul = new Date('2026-07-15T12:00:00Z');
  for (const c of CITIES) {
    const solar = c.lon / 15;
    for (const d of [jan, jul]) {
      const off = tzOffsetHours(c.tz, d);
      assert.ok(Math.abs(off - solar) <= 3, `${c.id}: tz ${c.tz} (${off}h) بعيدة عن خط الطول ${c.lon} (${solar.toFixed(2)}h)`);
    }
  }
});

test('COUNTRIES: رموز فريدة، وكل رمز مدينة موجود، وكل دولة لها مدينة واحدة على الأقل', () => {
  assert.ok(Array.isArray(COUNTRIES) && COUNTRIES.length > 0);
  const codes = COUNTRIES.map((c) => c.code);
  assert.equal(new Set(codes).size, codes.length, 'رموز دول مكررة');
  for (const k of COUNTRIES) {
    assert.match(k.code, /^[A-Z]{2}$/);
    assert.match(k.nameAr, /[؀-ۿ]/);
    assert.equal(typeof k.nameEn, 'string');
    assert.ok(k.nameEn.length > 0);
  }
  const used = new Set(CITIES.map((c) => c.countryCode));
  for (const c of CITIES) {
    assert.ok(COUNTRY_CODES.has(c.countryCode), `${c.id}: رمز الدولة ${c.countryCode} غير موجود في COUNTRIES`);
    const k = COUNTRIES.find((x) => x.code === c.countryCode);
    assert.equal(c.countryAr, k.nameAr, `${c.id}: countryAr لا يطابق COUNTRIES`);
  }
  for (const code of COUNTRY_CODES) {
    assert.ok(used.has(code), `الدولة ${code} بلا مدن`);
  }
});

test('المدن مجمّعة حسب الدولة (لا تتفرّق مدن دولة واحدة)', () => {
  const seenDone = new Set();
  let prev = null;
  for (const c of CITIES) {
    if (c.countryCode !== prev) {
      assert.ok(!seenDone.has(c.countryCode), `مدن ${c.countryCode} متفرّقة في القائمة`);
      if (prev) seenDone.add(prev);
      prev = c.countryCode;
    }
  }
});

test('دول جامعة الدول العربية الـ22 حاضرة كلها مع عواصمها', () => {
  const CAPITALS = {
    SA: 'sa-riyadh', AE: 'ae-abu-dhabi', KW: 'kw-kuwait-city', QA: 'qa-doha', BH: 'bh-manama',
    OM: 'om-muscat', YE: 'ye-sanaa', JO: 'jo-amman', PS: 'ps-jerusalem', LB: 'lb-beirut',
    SY: 'sy-damascus', IQ: 'iq-baghdad', EG: 'eg-cairo', SD: 'sd-khartoum', LY: 'ly-tripoli',
    TN: 'tn-tunis', DZ: 'dz-algiers', MA: 'ma-rabat', MR: 'mr-nouakchott', SO: 'so-mogadishu',
    DJ: 'dj-djibouti', KM: 'km-moroni',
  };
  assert.equal(Object.keys(CAPITALS).length, 22);
  for (const [code, id] of Object.entries(CAPITALS)) {
    assert.ok(COUNTRY_CODES.has(code), `الدولة ${code} غير موجودة`);
    const cap = byId.get(id);
    assert.ok(cap, `العاصمة ${id} مفقودة`);
    assert.equal(cap.countryCode, code);
    const count = CITIES.filter((c) => c.countryCode === code).length;
    assert.ok(count >= 4, `${code}: ${count} مدن فقط`);
  }
});

test('المدن الفلسطينية تستعمل Asia/Hebron أو Asia/Gaza', () => {
  const ps = CITIES.filter((c) => c.countryCode === 'PS');
  assert.ok(ps.length >= 8);
  for (const c of ps) {
    assert.ok(['Asia/Hebron', 'Asia/Gaza'].includes(c.tz), `${c.id}: tz ${c.tz}`);
  }
  assert.equal(byId.get('ps-gaza').tz, 'Asia/Gaza');
  assert.equal(byId.get('ps-khan-yunis').tz, 'Asia/Gaza');
  assert.equal(byId.get('ps-rafah').tz, 'Asia/Gaza');
  assert.equal(byId.get('ps-ramallah').tz, 'Asia/Hebron');
  assert.equal(byId.get('ps-hebron').tz, 'Asia/Hebron');
});

test('مناطق زمنية للدول متعددة المناطق', () => {
  const expect = {
    'us-new-york': 'America/New_York',
    'us-chicago': 'America/Chicago',
    'us-denver': 'America/Denver',
    'us-phoenix': 'America/Phoenix',
    'us-los-angeles': 'America/Los_Angeles',
    'us-detroit': 'America/Detroit',
    'us-anchorage': 'America/Anchorage',
    'us-honolulu': 'Pacific/Honolulu',
    'ca-toronto': 'America/Toronto',
    'ca-vancouver': 'America/Vancouver',
    'ca-calgary': 'America/Edmonton',
    'ca-saskatoon': 'America/Regina',
    'ca-winnipeg': 'America/Winnipeg',
    'ca-halifax': 'America/Halifax',
    'au-sydney': 'Australia/Sydney',
    'au-perth': 'Australia/Perth',
    'au-adelaide': 'Australia/Adelaide',
    'au-brisbane': 'Australia/Brisbane',
    'au-darwin': 'Australia/Darwin',
    'ru-moscow': 'Europe/Moscow',
    'ru-ufa': 'Asia/Yekaterinburg',
    'id-jakarta': 'Asia/Jakarta',
    'id-makassar': 'Asia/Makassar',
    'id-denpasar': 'Asia/Makassar',
    'id-jayapura': 'Asia/Jayapura',
    'my-kuching': 'Asia/Kuching',
    'br-sao-paulo': 'America/Sao_Paulo',
    'br-manaus': 'America/Manaus',
    'mx-mexico-city': 'America/Mexico_City',
    'mx-tijuana': 'America/Tijuana',
    'mx-cancun': 'America/Cancun',
    'cn-urumqi': 'Asia/Shanghai',
    'kz-aktobe': 'Asia/Aqtobe',
    'uz-samarkand': 'Asia/Samarkand',
    'es-ceuta': 'Africa/Ceuta',
  };
  for (const [id, tz] of Object.entries(expect)) {
    const c = byId.get(id);
    assert.ok(c, `${id} مفقودة`);
    assert.equal(c.tz, tz, `${id}: tz`);
  }
});

test('إحداثيات 25 مدينة مشهورة مطابقة ضمن 0.1°', () => {
  const KNOWN = [
    ['sa-makkah', 21.4225, 39.8262],
    ['sa-madinah', 24.4672, 39.6111],
    ['sa-riyadh', 24.7136, 46.6753],
    ['sa-jeddah', 21.4858, 39.1925],
    ['eg-cairo', 30.0444, 31.2357],
    ['jo-amman', 31.9539, 35.9106],
    ['ps-jerusalem', 31.7683, 35.2137],
    ['ps-gaza', 31.5017, 34.4668],
    ['ae-dubai', 25.2048, 55.2708],
    ['qa-doha', 25.2854, 51.5310],
    ['kw-kuwait-city', 29.3759, 47.9774],
    ['iq-baghdad', 33.3152, 44.3661],
    ['sy-damascus', 33.5138, 36.2765],
    ['lb-beirut', 33.8938, 35.5018],
    ['ma-casablanca', 33.5731, -7.5898],
    ['dz-algiers', 36.7538, 3.0588],
    ['tn-tunis', 36.8065, 10.1815],
    ['tr-istanbul', 41.0082, 28.9784],
    ['pk-karachi', 24.8607, 67.0011],
    ['id-jakarta', -6.2088, 106.8456],
    ['my-kuala-lumpur', 3.1390, 101.6869],
    ['gb-london', 51.5074, -0.1278],
    ['fr-paris', 48.8566, 2.3522],
    ['us-new-york', 40.7128, -74.0060],
    ['au-sydney', -33.8688, 151.2093],
  ];
  assert.equal(KNOWN.length, 25);
  for (const [id, lat, lon] of KNOWN) {
    const c = byId.get(id);
    assert.ok(c, `${id} مفقودة`);
    assert.ok(Math.abs(c.lat - lat) <= 0.1, `${id}: lat ${c.lat} ≠ ${lat}`);
    assert.ok(Math.abs(c.lon - lon) <= 0.1, `${id}: lon ${c.lon} ≠ ${lon}`);
  }
});

test('haversineKm: مسافات معروفة', () => {
  const r = byId.get('sa-riyadh');
  const m = byId.get('sa-makkah');
  const km = haversineKm(r.lat, r.lon, m.lat, m.lon);
  assert.ok(km > 780 && km < 820, `الرياض–مكة ${km.toFixed(0)} كم`); // ≈ 790 كم
  assert.equal(haversineKm(0, 0, 0, 0), 0);
  const ny = byId.get('us-new-york');
  const ln = byId.get('gb-london');
  const km2 = haversineKm(ny.lat, ny.lon, ln.lat, ln.lon);
  assert.ok(km2 > 5500 && km2 < 5600, `نيويورك–لندن ${km2.toFixed(0)} كم`); // ≈ 5570 كم
});

test('nearestCity يعيد أقرب مدينة', () => {
  assert.equal(nearestCity(24.7, 46.7).id, 'sa-riyadh');
  assert.equal(nearestCity(21.42, 39.83).id, 'sa-makkah');
  assert.equal(nearestCity(31.9, 35.9).id, 'jo-amman');
  assert.equal(nearestCity(51.5, -0.1).id, 'gb-london');
  assert.equal(nearestCity(-6.2, 106.8).id, 'id-jakarta');
  assert.equal(nearestCity(40.75, -73.95).id, 'us-new-york');
  assert.equal(nearestCity(31.5, 34.45).id, 'ps-gaza');
  // خط التاريخ: نقطة قرب أوكلاند من الجهة الشرقية
  assert.equal(nearestCity(-36.9, 175.0).id, 'nz-auckland');
  // مدخلات غير صالحة
  assert.equal(nearestCity(NaN, 10), null);
  assert.equal(nearestCity(undefined, undefined), null);
  // الكائن المعاد هو نفسه كائن القائمة
  assert.equal(nearestCity(24.7, 46.7), byId.get('sa-riyadh'));
});
