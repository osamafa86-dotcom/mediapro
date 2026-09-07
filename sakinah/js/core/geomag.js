/**
 * النموذج المغناطيسي العالمي WMM2025 — حساب الانحراف المغناطيسي (Declination) وعناصر الحقل
 * ---------------------------------------------------------------------------------------
 * تنفيذ ذاتي الاكتفاء (بلا اعتماديات) للخوارزمية القياسية لـ NOAA/NCEI:
 *   1) تحويل الإحداثيات الجيوديسية (WGS-84) إلى كروية مركزية الأرض.
 *   2) دوال لجندر المرافقة بتطبيع شميت شبه المعياري (Schmidt semi-normalized).
 *   3) تركيب التوافقيات الكروية حتى الدرجة/الرتبة 12 مع استقراء المعاملات زمنيًا بالتغير الزمني (SV).
 *   4) إعادة التدوير من الإطار الكروي إلى الجيوديسي، ثم اشتقاق العناصر X,Y,Z,H,F,I,D.
 *
 * المصدر: World Magnetic Model 2025 (WMM2025), NOAA National Centers for Environmental Information (NCEI)
 *         بالتعاون مع British Geological Survey — https://www.ncei.noaa.gov/products/world-magnetic-model
 *         المعاملات (WMM.COF) من إنتاج الحكومة الأمريكية وهي ملك عام (public domain).
 * Epoch: 2025.0 — صالح رسميًا من 2025.0 إلى 2030.0 (خارج هذه الفترة نستقرئ خطيًا ونضع outOfRange=true).
 * الخوارزمية: WMM2025 Technical Report (NOAA/NCEI) وبرنامج NOAA المرجعي بلغة C (GeomagnetismLibrary.c).
 *
 * الاصطلاحات: خط العرض/الطول جيوديسي بالدرجات (الطول موجب شرقًا)، الارتفاع بالكيلومتر فوق مجسّم WGS-84،
 * النتائج بالنانوتسلا والدرجات؛ الانحراف موجب شرقًا (الشمال المغناطيسي شرق الشمال الحقيقي).
 */

export const WMM_EPOCH = 2025.0;
export const WMM_VALID_UNTIL = 2030.0;
export const WMM_NAME = 'WMM2025';
const NMAX = 12;

// المعاملات مرتبة تسطيحًا بالفهرس i = n(n+1)/2 + m (الفهرس 0 غير مستخدم، n=0 لا يدخل في الحساب).
/** معاملات الحقل الرئيسي g(n,m) بوحدة nT — epoch 2025.0 */
const G = [
  0, // n=0 (غير مستخدم)
  -29351.8, -1410.8, // n=1 (m=0..1)
  -2556.6, 2951.1, 1649.3, // n=2 (m=0..2)
  1361, -2404.1, 1243.8, 453.6, // n=3 (m=0..3)
  895, 799.5, 55.7, -281.1, 12.1, // n=4 (m=0..4)
  -233.2, 368.9, 187.2, -138.7, -142, 20.9, // n=5 (m=0..5)
  64.4, 63.8, 76.9, -115.7, -40.9, 14.9, -60.7, // n=6 (m=0..6)
  79.5, -77, -8.8, 59.3, 15.8, 2.5, -11.1, 14.2, // n=7 (m=0..7)
  23.2, 10.8, -17.5, 2, -21.7, 16.9, 15, -16.8, 0.9, // n=8 (m=0..8)
  4.6, 7.8, 3, -0.2, -2.5, -13.1, 2.4, 8.6, -8.7, -12.9, // n=9 (m=0..9)
  -1.3, -6.4, 0.2, 2, -1, -0.6, -0.9, 1.5, 0.9, -2.7, -3.9, // n=10 (m=0..10)
  2.9, -1.5, -2.5, 2.4, -0.6, -0.1, -0.6, -0.1, 1.1, -1, -0.2, 2.6, // n=11 (m=0..11)
  -2, -0.2, 0.3, 1.2, -1.3, 0.6, 0.6, 0.5, -0.1, -0.4, -0.2, -1.3, -0.7, // n=12 (m=0..12)
];

/** معاملات الحقل الرئيسي h(n,m) بوحدة nT — epoch 2025.0 */
const H = [
  0, // n=0 (غير مستخدم)
  0, 4545.4, // n=1 (m=0..1)
  0, -3133.6, -815.1, // n=2 (m=0..2)
  0, -56.6, 237.5, -549.5, // n=3 (m=0..3)
  0, 278.6, -133.9, 212, -375.6, // n=4 (m=0..4)
  0, 45.4, 220.2, -122.9, 43, 106.1, // n=5 (m=0..5)
  0, -18.4, 16.8, 48.8, -59.8, 10.9, 72.7, // n=6 (m=0..6)
  0, -48.9, -14.4, -1, 23.4, -7.4, -25.1, -2.3, // n=7 (m=0..7)
  0, 7.1, -12.6, 11.4, -9.7, 12.7, 0.7, -5.2, 3.9, // n=8 (m=0..8)
  0, -24.8, 12.2, 8.3, -3.3, -5.2, 7.2, -0.6, 0.8, 10, // n=9 (m=0..9)
  0, 3.3, 0, 2.4, 5.3, -9.1, 0.4, -4.2, -3.8, 0.9, -9.1, // n=10 (m=0..10)
  0, 0, 2.9, -0.6, 0.2, 0.5, -0.3, -1.2, -1.7, -2.9, -1.8, -2.3, // n=11 (m=0..11)
  0, -1.3, 0.7, 1, -1.4, 0, 0.6, -0.1, 0.8, 0.1, -1, 0.1, 0.2, // n=12 (m=0..12)
];

/** التغير الزمني (secular variation) لـ g(n,m) بوحدة nT/سنة */
const G_DOT = [
  0, // n=0 (غير مستخدم)
  12, 9.7, // n=1 (m=0..1)
  -11.6, -5.2, -8, // n=2 (m=0..2)
  -1.3, -4.2, 0.4, -15.6, // n=3 (m=0..3)
  -1.6, -2.4, -6, 5.6, -7, // n=4 (m=0..4)
  0.6, 1.4, 0, 0.6, 2.2, 0.9, // n=5 (m=0..5)
  -0.2, -0.4, 0.9, 1.2, -0.9, 0.3, 0.9, // n=6 (m=0..6)
  0, -0.1, -0.1, 0.5, -0.1, -0.8, -0.8, 0.8, // n=7 (m=0..7)
  -0.1, 0.2, 0, 0.5, -0.1, 0.3, 0.2, 0, 0.2, // n=8 (m=0..8)
  0, -0.1, 0.1, 0.3, -0.3, 0, 0.3, -0.1, 0.1, -0.1, // n=9 (m=0..9)
  0.1, 0, 0.1, 0.1, 0, -0.3, 0, -0.1, -0.1, 0, 0, // n=10 (m=0..10)
  0, 0, 0, 0, 0, -0.1, 0, 0, -0.1, -0.1, -0.1, -0.1, // n=11 (m=0..11)
  0, 0, 0, 0, 0, 0, 0.1, 0, 0, 0, -0.1, 0, -0.1, // n=12 (m=0..12)
];

/** التغير الزمني (secular variation) لـ h(n,m) بوحدة nT/سنة */
const H_DOT = [
  0, // n=0 (غير مستخدم)
  0, -21.5, // n=1 (m=0..1)
  0, -27.7, -12.1, // n=2 (m=0..2)
  0, 4, -0.3, -4.1, // n=3 (m=0..3)
  0, -1.1, 4.1, 1.6, -4.4, // n=4 (m=0..4)
  0, -0.5, 2.2, 0.4, 1.7, 1.9, // n=5 (m=0..5)
  0, 0.3, -1.6, -0.4, 0.9, 0.7, 0.9, // n=6 (m=0..6)
  0, 0.6, 0.5, -0.8, 0, -1, 0.6, -0.2, // n=7 (m=0..7)
  0, -0.2, 0.5, -0.4, 0.4, -0.5, -0.6, 0.3, 0.2, // n=8 (m=0..8)
  0, -0.3, 0.3, -0.3, 0.3, 0.2, -0.1, -0.2, 0.4, 0.1, // n=9 (m=0..9)
  0, 0, 0, -0.2, 0.1, -0.1, 0.1, 0, -0.1, 0.2, 0, // n=10 (m=0..10)
  0, 0, 0.1, 0, 0.1, 0, 0, 0.1, 0, 0, 0, 0, // n=11 (m=0..11)
  0, 0, 0, -0.1, 0.1, 0, 0, 0, 0, 0, 0, 0, -0.1, // n=12 (m=0..12)
];

// مجسّم WGS-84 بالكيلومتر، ونصف القطر المرجعي المغناطيسي للنموذج
const WGS84_A = 6378.137;
const WGS84_B = 6356.7523142;
const WGS84_EPSSQ = 1 - (WGS84_B * WGS84_B) / (WGS84_A * WGS84_A); // مربع الشذوذ المركزي الأول
const RE = 6371.2;

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/** تسوية زاوية إلى المجال [0, 360) */
function norm360(a) {
  const r = a % 360;
  return r < 0 ? r + 360 : (r === 0 ? 0 : r);
}

/** تسوية زاوية إلى المجال (-180, 180] */
function norm180(a) {
  let r = norm360(a);
  if (r > 180) r -= 360;
  return r;
}

/**
 * السنة العشرية (UTC): السنة + (الزمن المنقضي منذ 1 يناير) / (طول السنة الفعلي 365 أو 366 يومًا).
 * تقبل كائن Date أو رقمًا (يُعاد كما هو باعتباره سنة عشرية جاهزة).
 */
export function decimalYear(date = new Date()) {
  if (typeof date === 'number') {
    if (!Number.isFinite(date)) throw new TypeError('decimalYear: قيمة السنة غير صالحة');
    return date;
  }
  const d = date instanceof Date ? date : new Date(date);
  const t = d.getTime();
  if (!Number.isFinite(t)) throw new TypeError('decimalYear: تاريخ غير صالح');
  const y = d.getUTCFullYear();
  const start = Date.UTC(y, 0, 1);
  const end = Date.UTC(y + 1, 0, 1);
  return y + (t - start) / (end - start);
}

/**
 * المعاملات المستقرأة زمنيًا: g(t) = g + (t − epoch)·ġ ، وكذلك h.
 * @param {number} dt الفرق بالسنوات عن الـ epoch
 */
function timedCoefficients(dt) {
  const len = G.length;
  const g = new Float64Array(len);
  const h = new Float64Array(len);
  for (let i = 1; i < len; i++) {
    g[i] = G[i] + dt * G_DOT[i];
    h[i] = H[i] + dt * H_DOT[i];
  }
  return { g, h };
}

/**
 * دوال لجندر المرافقة P(n,m) ومشتقاتها بالنسبة لخط العرض المركزي، بتطبيع شميت شبه المعياري.
 * تكافئ MAG_PcupLow في برنامج NOAA. x = sin(φ') حيث φ' خط العرض المركزي.
 * @returns {{p: Float64Array, dp: Float64Array}} dp = dP/dφ'
 */
function legendre(x, nMax) {
  const numTerms = (nMax + 1) * (nMax + 2) / 2;
  const p = new Float64Array(numTerms);
  const dp = new Float64Array(numTerms);
  const norm = new Float64Array(numTerms);
  const z = Math.sqrt((1 - x) * (1 + x)); // cos(φ')
  p[0] = 1; dp[0] = 0; norm[0] = 1;

  // دوال لجندر غير المطبّعة بالعلاقات التكرارية
  for (let n = 1; n <= nMax; n++) {
    for (let m = 0; m <= n; m++) {
      const i = n * (n + 1) / 2 + m;
      if (n === m) {
        const i1 = (n - 1) * n / 2 + m - 1;
        p[i] = z * p[i1];
        dp[i] = z * dp[i1] + x * p[i1];
      } else if (n === 1 && m === 0) {
        const i1 = (n - 1) * n / 2 + m;
        p[i] = x * p[i1];
        dp[i] = x * dp[i1] - z * p[i1];
      } else {
        const i1 = (n - 2) * (n - 1) / 2 + m;
        const i2 = (n - 1) * n / 2 + m;
        if (m > n - 2) {
          p[i] = x * p[i2];
          dp[i] = x * dp[i2] - z * p[i2];
        } else {
          const k = ((n - 1) * (n - 1) - m * m) / ((2 * n - 1) * (2 * n - 3));
          p[i] = x * p[i2] - k * p[i1];
          dp[i] = x * dp[i2] - z * p[i2] - k * dp[i1];
        }
      }
    }
  }

  // عوامل تطبيع شميت شبه المعياري
  for (let n = 1; n <= nMax; n++) {
    const i0 = n * (n + 1) / 2;
    norm[i0] = norm[(n - 1) * n / 2] * (2 * n - 1) / n;
    for (let m = 1; m <= n; m++) {
      norm[i0 + m] = norm[i0 + m - 1] * Math.sqrt(((n - m + 1) * (m === 1 ? 2 : 1)) / (n + m));
    }
  }

  // تطبيق التطبيع (إشارة المشتقة تُقلب لتصبح dP/dφ' بدلًا من dP/dθ)
  for (let i = 1; i < numTerms; i++) {
    p[i] *= norm[i];
    dp[i] *= -norm[i];
  }
  return { p, dp };
}

/**
 * حساب عناصر الحقل المغناطيسي الأرضي عند موقع وزمن.
 * @param {{lat:number, lon:number, altKm?:number, date?:Date|number}} params
 *   lat خط العرض الجيوديسي (−90..90)، lon خط الطول (موجب شرقًا)، altKm الارتفاع فوق مجسّم WGS-84 بالكيلومتر،
 *   date كائن Date (افتراضيًا الآن) أو سنة عشرية رقمية مثل 2027.5.
 * @returns {{x:number,y:number,z:number,h:number,f:number,inclination:number,declination:number,
 *            gridVariation:number,decimalYear:number,outOfRange:boolean}}
 *   x شمالًا، y شرقًا، z للأسفل (nT)؛ h الشدة الأفقية؛ f الشدة الكلية؛ inclination الميل (موجب للأسفل)؛
 *   declination الانحراف (موجب شرقًا)؛ gridVariation تباين الشبكة (NaN إن كان |lat| < 55).
 */
export function magneticField({ lat, lon, altKm = 0, date = new Date() } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new TypeError('magneticField: lat/lon يجب أن يكونا أرقامًا');
  if (lat < -90 || lat > 90) throw new RangeError('magneticField: خط العرض خارج المجال −90..90');
  if (!Number.isFinite(altKm)) altKm = 0;

  const year = decimalYear(date);
  const outOfRange = !(year >= WMM_EPOCH && year <= WMM_VALID_UNTIL);
  const { g, h } = timedCoefficients(year - WMM_EPOCH);

  // تفادي القسمة على صفر عند القطبين تمامًا (كما يفعل برنامج NOAA)
  let phi = lat;
  if (phi >= 90) phi = 89.9999;
  else if (phi <= -90) phi = -89.9999;
  const lambda = norm180(lon);

  // 1) جيوديسي → كروي مركزي الأرض
  const cosLat = Math.cos(phi * DEG), sinLat = Math.sin(phi * DEG);
  const rc = WGS84_A / Math.sqrt(1 - WGS84_EPSSQ * sinLat * sinLat);
  const xp = (rc + altKm) * cosLat;
  const zp = (rc * (1 - WGS84_EPSSQ) + altKm) * sinLat;
  const r = Math.sqrt(xp * xp + zp * zp);
  const phig = Math.asin(zp / r); // خط العرض المركزي (راديان)
  const sinPhig = Math.sin(phig), cosPhig = Math.cos(phig);

  // 2) المتغيرات التوافقية: قوى (Re/r) وجيوب/جيوب تمام مضاعفات خط الطول
  const cosLam = Math.cos(lambda * DEG), sinLam = Math.sin(lambda * DEG);
  const cosM = new Float64Array(NMAX + 1), sinM = new Float64Array(NMAX + 1);
  cosM[0] = 1; sinM[0] = 0; cosM[1] = cosLam; sinM[1] = sinLam;
  for (let m = 2; m <= NMAX; m++) {
    cosM[m] = cosM[m - 1] * cosLam - sinM[m - 1] * sinLam;
    sinM[m] = cosM[m - 1] * sinLam + sinM[m - 1] * cosLam;
  }
  const ratio = RE / r;
  const rpow = new Float64Array(NMAX + 1); // rpow[n] = (Re/r)^(n+2)
  rpow[0] = ratio * ratio;
  for (let n = 1; n <= NMAX; n++) rpow[n] = rpow[n - 1] * ratio;

  // 3) التركيب التوافقي الكروي
  const { p, dp } = legendre(sinPhig, NMAX);
  let bx = 0, by = 0, bz = 0;
  for (let n = 1; n <= NMAX; n++) {
    for (let m = 0; m <= n; m++) {
      const i = n * (n + 1) / 2 + m;
      const gc = g[i] * cosM[m] + h[i] * sinM[m];
      bz -= rpow[n] * gc * (n + 1) * p[i];
      by += rpow[n] * (g[i] * sinM[m] - h[i] * cosM[m]) * m * p[i];
      bx -= rpow[n] * gc * dp[i];
    }
  }
  // cosPhig لا يقترب من الصفر بفضل التزحزح عن القطب أعلاه
  by = Math.abs(cosPhig) > 1e-10 ? by / cosPhig : 0;

  // 4) التدوير من الإطار الكروي إلى الجيوديسي
  const psi = phig - phi * DEG;
  const cosPsi = Math.cos(psi), sinPsi = Math.sin(psi);
  const x = bx * cosPsi - bz * sinPsi;
  const z = bx * sinPsi + bz * cosPsi;
  const y = by;

  const hh = Math.sqrt(x * x + y * y);
  const f = Math.sqrt(hh * hh + z * z);
  const declination = Math.atan2(y, x) * RAD;
  const inclination = Math.atan2(z, hh) * RAD;

  // تباين الشبكة (Grid Variation) يُعرَّف فقط في المناطق القطبية |lat| ≥ 55
  let gridVariation = NaN;
  if (lat >= 55) gridVariation = norm180(declination - lambda);
  else if (lat <= -55) gridVariation = norm180(declination + lambda);

  return { x, y, z, h: hh, f, inclination, declination, gridVariation, decimalYear: year, outOfRange };
}

/**
 * الانحراف المغناطيسي بالدرجات (موجب شرقًا) — اختصار مناسب للبوصلة.
 * @param {number} lat  @param {number} lon  @param {number} [altKm=0]  @param {Date|number} [date=now]
 */
export function declination(lat, lon, altKm = 0, date = new Date()) {
  return magneticField({ lat, lon, altKm, date }).declination;
}

/** تحويل اتجاه مغناطيسي إلى اتجاه حقيقي: true = magnetic + declination، مسوًّى إلى [0, 360) */
export function magneticToTrue(magneticHeading, decl) {
  return norm360(magneticHeading + decl);
}

/** تحويل اتجاه حقيقي إلى اتجاه مغناطيسي: magnetic = true − declination، مسوًّى إلى [0, 360) */
export function trueToMagnetic(trueHeading, decl) {
  return norm360(trueHeading - decl);
}
