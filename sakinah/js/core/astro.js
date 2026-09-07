/**
 * حسابات فلكية لموقع الشمس (Jean Meeus, "Astronomical Algorithms", 2nd ed.)
 * ---------------------------------------------------------------------------
 * تُستخدم لحساب مواقيت الصلاة (شروق/غروب/زوال/زوايا الشفق) وسمت الشمس (للتحقق من القبلة).
 * الخوارزميات متوافقة مع مكتبة adhan-js (MIT © Batoul Apps) التي استُخدمت مرجعًا للتحقق.
 * جميع الزوايا بالدرجات ما لم يُذكر غير ذلك، والأزمنة بالتوقيت العالمي (UT).
 */

export const DEG = Math.PI / 180;
export const d2r = (deg) => deg * DEG;
export const r2d = (rad) => rad / DEG;

/** إرجاع القيمة إلى المجال [0, max) */
export const normalizeToScale = (num, max) => num - max * Math.floor(num / max);
/** إرجاع الزاوية إلى المجال [0, 360) */
export const unwindAngle = (angle) => normalizeToScale(angle, 360);
/** إرجاع الزاوية إلى المجال [-180, 180] */
export const quadrantShiftAngle = (angle) =>
  angle >= -180 && angle <= 180 ? angle : angle - 360 * Math.round(angle / 360);

/** اليوم اليولياني لتاريخ ميلادي (الشهر 1..12) — Meeus ص 60 */
export function julianDay(year, month, day, hours = 0) {
  const Y = Math.trunc(month > 2 ? year : year - 1);
  const M = Math.trunc(month > 2 ? month : month + 12);
  const D = day + hours / 24;
  const A = Math.trunc(Y / 100);
  const B = Math.trunc(2 - A + Math.trunc(A / 4));
  return Math.trunc(365.25 * (Y + 4716)) + Math.trunc(30.6001 * (M + 1)) + D + B - 1524.5;
}

/** اليوم اليولياني لكائن Date (بالتوقيت العالمي) */
export function julianDayFromDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

/** القرن اليولياني منذ J2000.0 */
export const julianCentury = (jd) => (jd - 2451545.0) / 36525;

export function meanSolarLongitude(T) {
  return unwindAngle(280.4664567 + 36000.76983 * T + 0.0003032 * T * T);
}
export function meanLunarLongitude(T) {
  return unwindAngle(218.3165 + 481267.8813 * T);
}
export function ascendingLunarNodeLongitude(T) {
  return unwindAngle(125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000);
}
export function meanSolarAnomaly(T) {
  return unwindAngle(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
}
export function solarEquationOfTheCenter(T, M) {
  const Mrad = d2r(M);
  return (
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad) +
    0.000289 * Math.sin(3 * Mrad)
  );
}
export function apparentSolarLongitude(T, L0) {
  const longitude = L0 + solarEquationOfTheCenter(T, meanSolarAnomaly(T));
  const Omega = 125.04 - 1934.136 * T;
  return unwindAngle(longitude - 0.00569 - 0.00478 * Math.sin(d2r(Omega)));
}
export function meanObliquityOfTheEcliptic(T) {
  return 23.439291 - 0.013004167 * T - 0.0000001639 * T * T + 0.0000005036 * T * T * T;
}
export function apparentObliquityOfTheEcliptic(T, epsilon0) {
  return epsilon0 + 0.00256 * Math.cos(d2r(125.04 - 1934.136 * T));
}
export function meanSiderealTime(T) {
  const JD = T * 36525 + 2451545.0;
  return unwindAngle(
    280.46061837 + 360.98564736629 * (JD - 2451545) + 0.000387933 * T * T - (T * T * T) / 38710000
  );
}
export function nutationInLongitude(T, L0, Lp, Omega) {
  return (
    (-17.2 / 3600) * Math.sin(d2r(Omega)) -
    (1.32 / 3600) * Math.sin(2 * d2r(L0)) -
    (0.23 / 3600) * Math.sin(2 * d2r(Lp)) +
    (0.21 / 3600) * Math.sin(2 * d2r(Omega))
  );
}
export function nutationInObliquity(T, L0, Lp, Omega) {
  return (
    (9.2 / 3600) * Math.cos(d2r(Omega)) +
    (0.57 / 3600) * Math.cos(2 * d2r(L0)) +
    (0.1 / 3600) * Math.cos(2 * d2r(Lp)) -
    (0.09 / 3600) * Math.cos(2 * d2r(Omega))
  );
}

/** ارتفاع جرم سماوي فوق الأفق — Meeus ص 93 */
export function altitudeOfCelestialBody(phi, delta, H) {
  return r2d(
    Math.asin(
      Math.sin(d2r(phi)) * Math.sin(d2r(delta)) +
        Math.cos(d2r(phi)) * Math.cos(d2r(delta)) * Math.cos(d2r(H))
    )
  );
}

/** الإحداثيات الظاهرية للشمس عند يوم يولياني معيّن */
export function solarCoordinates(jd) {
  const T = julianCentury(jd);
  const L0 = meanSolarLongitude(T);
  const Lp = meanLunarLongitude(T);
  const Omega = ascendingLunarNodeLongitude(T);
  const Lambda = d2r(apparentSolarLongitude(T, L0));
  const Theta0 = meanSiderealTime(T);
  const dPsi = nutationInLongitude(T, L0, Lp, Omega);
  const dEpsilon = nutationInObliquity(T, L0, Lp, Omega);
  const Epsilon0 = meanObliquityOfTheEcliptic(T);
  const EpsilonApparent = d2r(apparentObliquityOfTheEcliptic(T, Epsilon0));
  return {
    /** ميل الشمس */
    declination: r2d(Math.asin(Math.sin(EpsilonApparent) * Math.sin(Lambda))),
    /** المطلع المستقيم */
    rightAscension: unwindAngle(r2d(Math.atan2(Math.cos(EpsilonApparent) * Math.sin(Lambda), Math.cos(Lambda)))),
    /** الزمن النجمي الظاهري في غرينتش (درجات) */
    apparentSiderealTime: Theta0 + (dPsi * 3600 * Math.cos(d2r(Epsilon0 + dEpsilon))) / 3600,
    /** الطول الظاهري للشمس */
    apparentLongitude: r2d(Lambda),
  };
}

export function approximateTransit(longitude, siderealTime, rightAscension) {
  const Lw = -longitude;
  const m0 = normalizeToScale((rightAscension + Lw - siderealTime) / 360, 1);
  // حماية قرب خط التاريخ الدولي: قد يخرج m0 ليوم آخر
  const expected = normalizeToScale((12.0 - longitude / 15.0) / 24.0, 1);
  if (m0 - expected > 0.5) return m0 - 1;
  if (expected - m0 > 0.5) return m0 + 1;
  return m0;
}

export function correctedTransit(m0, longitude, siderealTime, a2, a1, a3) {
  const Lw = -longitude;
  const Theta = unwindAngle(siderealTime + 360.985647 * m0);
  const a = unwindAngle(interpolateAngles(a2, a1, a3, m0));
  const H = quadrantShiftAngle(Theta - Lw - a);
  return (m0 + H / -360) * 24;
}

export function correctedHourAngle(m0, h0, coords, afterTransit, siderealTime, a2, a1, a3, d2, d1, d3) {
  const Lw = -coords.longitude;
  const term1 = Math.sin(d2r(h0)) - Math.sin(d2r(coords.latitude)) * Math.sin(d2r(d2));
  const term2 = Math.cos(d2r(coords.latitude)) * Math.cos(d2r(d2));
  const H0 = r2d(Math.acos(term1 / term2)); // NaN إذا لم تبلغ الشمس هذه الزاوية (خطوط العرض العالية)
  const m = afterTransit ? m0 + H0 / 360 : m0 - H0 / 360;
  const Theta = unwindAngle(siderealTime + 360.985647 * m);
  const a = unwindAngle(interpolateAngles(a2, a1, a3, m));
  const delta = interpolate(d2, d1, d3, m);
  const H = Theta - Lw - a;
  const h = altitudeOfCelestialBody(coords.latitude, delta, H);
  const dm = (h - h0) / (360 * Math.cos(d2r(delta)) * Math.cos(d2r(coords.latitude)) * Math.sin(d2r(H)));
  return (m + dm) * 24;
}

/** استكمال (interpolation) بثلاث قيم متساوية التباعد — Meeus ص 24 */
export function interpolate(y2, y1, y3, n) {
  const a = y2 - y1, b = y3 - y2, c = b - a;
  return y2 + (n / 2) * (a + b + n * c);
}
export function interpolateAngles(y2, y1, y3, n) {
  const a = unwindAngle(y2 - y1), b = unwindAngle(y3 - y2), c = b - a;
  return y2 + (n / 2) * (a + b + n * c);
}

/**
 * أوقات الشمس ليوم ميلادي (مكوّنات التاريخ المدني) عند موقع معيّن.
 * القيم بالساعات UT (قد تكون سالبة أو > 24 لأن اليوم يبدأ في UT).
 */
export class SolarTime {
  /**
   * @param {{year:number, month:number, day:number}} date  الشهر 1..12
   * @param {{latitude:number, longitude:number}} coords
   */
  constructor(date, coords) {
    const jd = julianDay(date.year, date.month, date.day, 0);
    this.observer = coords;
    this.solar = solarCoordinates(jd);
    this.prevSolar = solarCoordinates(jd - 1);
    this.nextSolar = solarCoordinates(jd + 1);
    const m0 = approximateTransit(coords.longitude, this.solar.apparentSiderealTime, this.solar.rightAscension);
    const solarAltitude = -50.0 / 60.0; // نصف قطر الشمس + الانكسار الجوي
    this.approxTransit = m0;
    this.transit = correctedTransit(m0, coords.longitude, this.solar.apparentSiderealTime,
      this.solar.rightAscension, this.prevSolar.rightAscension, this.nextSolar.rightAscension);
    this.sunrise = this.hourAngle(solarAltitude, false);
    this.sunset = this.hourAngle(solarAltitude, true);
  }
  /** وقت بلوغ الشمس زاوية ارتفاع معيّنة قبل/بعد الزوال */
  hourAngle(angle, afterTransit) {
    return correctedHourAngle(this.approxTransit, angle, this.observer, afterTransit,
      this.solar.apparentSiderealTime, this.solar.rightAscension, this.prevSolar.rightAscension,
      this.nextSolar.rightAscension, this.solar.declination, this.prevSolar.declination, this.nextSolar.declination);
  }
  /** وقت العصر: حين يصير ظل الشيء مثله (1) أو مثليه (2) زيادةً على ظل الزوال */
  afternoon(shadowLength) {
    const tangent = Math.abs(this.observer.latitude - this.solar.declination);
    const inverse = shadowLength + Math.tan(d2r(tangent));
    const angle = r2d(Math.atan(1.0 / inverse));
    return this.hourAngle(angle, true);
  }
}

/** الانكسار الجوي التقريبي (Sæmundsson) بالدرجات لارتفاع ظاهري h */
export function refraction(hDeg) {
  if (hDeg < -1) return 0;
  return (1.02 / Math.tan(d2r(hDeg + 10.3 / (hDeg + 5.11)))) / 60;
}

/**
 * موقع الشمس في السماء لحظةً معيّنة.
 * @returns {{azimuth:number, altitude:number, declination:number, hourAngle:number, equationOfTime:number}}
 *  azimuth: من الشمال الحقيقي باتجاه عقارب الساعة (0..360)؛ altitude: هندسي (بدون انكسار)
 */
export function sunPosition(date, latitude, longitude) {
  const jd = julianDayFromDate(date);
  const s = solarCoordinates(jd);
  const T = julianCentury(jd);
  const H = quadrantShiftAngle(unwindAngle(s.apparentSiderealTime + longitude - s.rightAscension));
  const phi = d2r(latitude), delta = d2r(s.declination), Hr = d2r(H);
  const altitude = r2d(Math.asin(Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(Hr)));
  // Meeus ص 93: السمت مقيس من الجنوب غربًا؛ نحوله إلى من الشمال شرقًا
  const azSouth = r2d(Math.atan2(Math.sin(Hr), Math.cos(Hr) * Math.sin(phi) - Math.tan(delta) * Math.cos(phi)));
  const azimuth = unwindAngle(azSouth + 180);
  // معادلة الزمن (بالدقائق) = الطول المتوسط - 0.0057183 - المطلع المستقيم + تصحيح النوتة
  const L0 = meanSolarLongitude(T);
  let E = L0 - 0.0057183 - s.rightAscension + (s.apparentSiderealTime - meanSiderealTime(T));
  E = quadrantShiftAngle(E) * 4;
  return { azimuth, altitude, declination: s.declination, hourAngle: H, equationOfTime: E, rightAscension: s.rightAscension };
}
