/**
 * اتجاه القبلة بدقة عالية
 * ----------------------
 * 1) الدائرة العظمى على كرة (الصيغة الكلاسيكية) — كافية لمعظم الاستخدامات.
 * 2) الجيوديسية على مجسّم WGS-84 بطريقة Vincenty (1975) — أدق بفارق قد يبلغ 0.2° في بعض المناطق،
 *    وتعطي المسافة الحقيقية إلى الكعبة.
 * 3) التحقق بالشمس: لحظات يكون فيها سمت الشمس مساويًا لاتجاه القبلة (أو معاكسًا له فيشير الظل إلى القبلة)،
 *    وحادثتا تعامد الشمس على الكعبة سنويًا — طرق مستقلة عن البوصلة المغناطيسية.
 */
import { d2r, r2d, unwindAngle, quadrantShiftAngle, sunPosition, SolarTime, julianDay, solarCoordinates } from './astro.js';

/** إحداثيات الكعبة المشرفة (مركز البناء) */
export const KAABA = { latitude: 21.4225241, longitude: 39.8261818 };

// WGS-84
const A = 6378137.0, F = 1 / 298.257223563, B = A * (1 - F);

/** اتجاه القبلة (دائرة عظمى) بالدرجات من الشمال الحقيقي باتجاه عقارب الساعة */
export function qiblaSpherical(latitude, longitude) {
  const φ1 = d2r(latitude), φ2 = d2r(KAABA.latitude), Δλ = d2r(KAABA.longitude - longitude);
  const y = Math.sin(Δλ);
  const x = Math.cos(φ1) * Math.tan(φ2) - Math.sin(φ1) * Math.cos(Δλ);
  return unwindAngle(r2d(Math.atan2(y, x)));
}

/** المسافة على الكرة (هافرساين) بالكيلومترات */
export function distanceSphericalKm(lat1, lon1, lat2 = KAABA.latitude, lon2 = KAABA.longitude) {
  const R = 6371.0088;
  const φ1 = d2r(lat1), φ2 = d2r(lat2), dφ = d2r(lat2 - lat1), dλ = d2r(lon2 - lon1);
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * حلّ Vincenty العكسي على مجسّم WGS-84.
 * @returns {{distanceKm:number, initialBearing:number, finalBearing:number, converged:boolean}}
 */
export function vincentyInverse(lat1, lon1, lat2 = KAABA.latitude, lon2 = KAABA.longitude) {
  const φ1 = d2r(lat1), φ2 = d2r(lat2);
  const L = d2r(lon2 - lon1);
  const tanU1 = (1 - F) * Math.tan(φ1), cosU1 = 1 / Math.sqrt(1 + tanU1 * tanU1), sinU1 = tanU1 * cosU1;
  const tanU2 = (1 - F) * Math.tan(φ2), cosU2 = 1 / Math.sqrt(1 + tanU2 * tanU2), sinU2 = tanU2 * cosU2;
  let λ = L, λʹ, iterations = 0;
  let sinλ, cosλ, sinσ, cosσ, σ, sinα, cos2α, cos2σm, C;
  do {
    sinλ = Math.sin(λ); cosλ = Math.cos(λ);
    const sinSqσ = (cosU2 * sinλ) ** 2 + (cosU1 * sinU2 - sinU1 * cosU2 * cosλ) ** 2;
    sinσ = Math.sqrt(sinSqσ);
    if (sinσ === 0) return { distanceKm: 0, initialBearing: 0, finalBearing: 0, converged: true }; // نقطتان متطابقتان
    cosσ = sinU1 * sinU2 + cosU1 * cosU2 * cosλ;
    σ = Math.atan2(sinσ, cosσ);
    sinα = (cosU1 * cosU2 * sinλ) / sinσ;
    cos2α = 1 - sinα * sinα;
    cos2σm = cos2α !== 0 ? cosσ - (2 * sinU1 * sinU2) / cos2α : 0; // خط الاستواء
    C = (F / 16) * cos2α * (4 + F * (4 - 3 * cos2α));
    λʹ = λ;
    λ = L + (1 - C) * F * sinα * (σ + C * sinσ * (cos2σm + C * cosσ * (-1 + 2 * cos2σm * cos2σm)));
  } while (Math.abs(λ - λʹ) > 1e-12 && ++iterations < 200);
  const converged = iterations < 200;
  if (!converged) {
    // نقاط شبه متقابلة قطريًا: نعود إلى الحل الكروي
    return { distanceKm: distanceSphericalKm(lat1, lon1, lat2, lon2), initialBearing: qiblaSpherical(lat1, lon1), finalBearing: NaN, converged: false };
  }
  const uSq = (cos2α * (A * A - B * B)) / (B * B);
  const Acoef = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const Bcoef = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const Δσ = Bcoef * sinσ * (cos2σm + (Bcoef / 4) * (cosσ * (-1 + 2 * cos2σm * cos2σm) - (Bcoef / 6) * cos2σm * (-3 + 4 * sinσ * sinσ) * (-3 + 4 * cos2σm * cos2σm)));
  const s = B * Acoef * (σ - Δσ);
  const α1 = Math.atan2(cosU2 * sinλ, cosU1 * sinU2 - sinU1 * cosU2 * cosλ);
  const α2 = Math.atan2(cosU1 * sinλ, -sinU1 * cosU2 + cosU1 * sinU2 * cosλ);
  return { distanceKm: s / 1000, initialBearing: unwindAngle(r2d(α1)), finalBearing: unwindAngle(r2d(α2)), converged: true };
}

/**
 * معلومات القبلة الكاملة لموقع.
 * bearing: الاتجاه الجيوديسي (الأدق)؛ bearingSpherical: الحل الكروي؛ distanceKm: المسافة الجيوديسية
 */
export function qiblaInfo(latitude, longitude) {
  const sph = qiblaSpherical(latitude, longitude);
  const v = vincentyInverse(latitude, longitude);
  const bearing = v.converged ? v.initialBearing : sph;
  return {
    bearing, bearingSpherical: sph, distanceKm: v.distanceKm,
    difference: quadrantShiftAngle(bearing - sph),
    compassPoint: compassPointAr(bearing),
    /** قرب النقطة المقابلة للكعبة (شرق بولينيزيا) لا يتقارب حل Vincenty والاتجاه غير محدد عمليًا */
    antipodal: !v.converged || v.distanceKm > 19900,
  };
}

const POINTS_AR = ['شمال', 'شمال شرق', 'شرق', 'جنوب شرق', 'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب'];
export function compassPointAr(bearing) {
  return POINTS_AR[Math.round(unwindAngle(bearing) / 45) % 8];
}

/** الفرق الموقّع بين اتجاهين (-180..180]: موجب = القبلة على يمين المرجع */
export function signedDifference(target, reference) {
  return quadrantShiftAngle(unwindAngle(target - reference));
}

/**
 * لحظات التحقق بالشمس خلال يوم مدني في منطقة زمنية:
 * - sunAtQibla: الشمس في اتجاه القبلة تمامًا (استقبل الشمس = استقبلت القبلة)
 * - shadowAtQibla: الشمس معاكسة للقبلة (ظلّ العمود الرأسي يشير إلى القبلة)
 * @returns {{sunAtQibla: Date|null, shadowAtQibla: Date|null}}
 */
export function sunQiblaMoments(latitude, longitude, civil, tz) {
  const bearing = qiblaInfo(latitude, longitude).bearing;
  const start = localMidnightUTC(civil, tz);
  const find = (target) => {
    let prev = null, prevT = null;
    for (let m = 0; m <= 1440; m += 2) {
      const t = new Date(start.getTime() + m * 60000);
      const p = sunPosition(t, latitude, longitude);
      const f = signedDifference(p.azimuth, target);
      if (prev !== null && Math.sign(f) !== Math.sign(prev) && Math.abs(f - prev) < 180) {
        // تنقيح بالتنصيف
        let lo = prevT, hi = t, flo = prev;
        for (let i = 0; i < 25; i++) {
          const mid = new Date((lo.getTime() + hi.getTime()) / 2);
          const fm = signedDifference(sunPosition(mid, latitude, longitude).azimuth, target);
          if (Math.sign(fm) === Math.sign(flo)) { lo = mid; flo = fm; } else hi = mid;
        }
        const res = new Date(Math.round((lo.getTime() + hi.getTime()) / 2000) * 1000);
        const pr = sunPosition(res, latitude, longitude);
        // نرفض العبور الزائف قرب سمت الرأس (السمت ينقلب 180° في ثوانٍ) ونتأكد أن الفرق المتبقي صغير فعلًا
        if (pr.altitude > 0 && pr.altitude < 85 && Math.abs(signedDifference(pr.azimuth, target)) < 0.5) return res;
      }
      prev = f; prevT = t;
    }
    return null;
  };
  return { bearing, sunAtQibla: find(bearing), shadowAtQibla: find(unwindAngle(bearing + 180)) };
}

/** منتصف الليل المحلي (بداية اليوم المدني) كلحظة UTC */
export function localMidnightUTC(civil, tz) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
  const wall = (ms) => { const p = fmt.formatToParts(new Date(ms)).reduce((o, x) => (o[x.type] = x.value, o), {}); return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute); };
  const target = Date.UTC(civil.year, civil.month - 1, civil.day, 0, 0, 0);
  // نبدأ من تخمين UTC ثم نصحّح بفارق المنطقة (تكرار حتى الاستقرار)
  let guess = target;
  for (let i = 0; i < 4; i++) { const next = target - (wall(guess) - guess); if (next === guess) break; guess = next; }
  // إن لم تكن الساعة 00:00 موجودة (تحويل التوقيت الصيفي عند منتصف الليل كما في القاهرة) نأخذ أول لحظة في اليوم المدني المطلوب
  if (wall(guess) < target) { let t = guess; for (let i = 0; i < 180 && wall(t) < target; i++) t += 60000; guess = t; }
  return new Date(guess);
}

/**
 * حادثتا تعامد الشمس على الكعبة في سنة معيّنة (نحو 27/28 مايو و15/16 يوليو، الساعة ~09:18 و~09:27 UTC).
 * @returns {Array<{time: Date, altitude: number}>}
 */
export function kaabaZenithEvents(year) {
  const events = [];
  for (const [m1, d1, m2, d2] of [[5, 20, 6, 5], [7, 8, 7, 24]]) {
    let best = null;
    for (let jd = julianDay(year, m1, d1); jd <= julianDay(year, m2, d2); jd += 1) {
      const civil = jdToCivil(jd);
      const st = new SolarTime(civil, KAABA);
      const t = new Date(Date.UTC(civil.year, civil.month - 1, civil.day) + st.transit * 3600000);
      const alt = sunPosition(t, KAABA.latitude, KAABA.longitude).altitude;
      if (!best || alt > best.altitude) best = { time: t, altitude: alt };
    }
    events.push(best);
  }
  return events;
}

function jdToCivil(jd) {
  const d = new Date((jd - 2440587.5) * 86400000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export { sunPosition, solarCoordinates };

/**
 * نقاط على قوس الدائرة العظمى (أقصر مسار على الكرة) من نقطة إلى أخرى — للرسم على الخريطة.
 * استيفاء كروي (slerp) على المتجهات الواحدة؛ يعيد [[lat, lon], ...] بعدد n+1 نقطة.
 */
export function greatCirclePoints(lat1, lon1, lat2, lon2, n = 64) {
  const d = Math.PI / 180;
  const toVec = (la, lo) => [Math.cos(la * d) * Math.cos(lo * d), Math.cos(la * d) * Math.sin(lo * d), Math.sin(la * d)];
  const a = toVec(lat1, lon1), b = toVec(lat2, lon2);
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(dot); const pts = [];
  if (omega < 1e-7) return [[lat1, lon1], [lat2, lon2]]; // النقطتان متطابقتان عمليًا
  for (let i = 0; i <= n; i++) {
    const t = i / n; const s1 = Math.sin((1 - t) * omega) / Math.sin(omega), s2 = Math.sin(t * omega) / Math.sin(omega);
    const x = s1 * a[0] + s2 * b[0], y = s1 * a[1] + s2 * b[1], z = s1 * a[2] + s2 * b[2];
    pts.push([Math.atan2(z, Math.hypot(x, y)) / d, Math.atan2(y, x) / d]);
  }
  return pts;
}
