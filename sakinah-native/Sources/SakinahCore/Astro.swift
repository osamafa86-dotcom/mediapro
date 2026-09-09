import Foundation

/// حسابات فلكية لموقع الشمس (Jean Meeus, "Astronomical Algorithms", 2nd ed.) — مطابقة لـ astro.js ولمكتبة adhan.
/// الزوايا بالدرجات ما لم يُذكر غير ذلك، والأزمنة بالتوقيت العالمي.
public enum Astro {
  /// اليوم اليولياني لتاريخ ميلادي (الشهر 1..12) — Meeus ص 60
  public static func julianDay(year: Int, month: Int, day: Int, hours: Double = 0) -> Double {
    let Y = Double(month > 2 ? year : year - 1)
    let M = Double(month > 2 ? month : month + 12)
    let D = Double(day) + hours / 24
    let A = (Y / 100).rounded(.towardZero)
    let B = (2 - A + (A / 4).rounded(.towardZero)).rounded(.towardZero)
    return (365.25 * (Y + 4716)).rounded(.towardZero) + (30.6001 * (M + 1)).rounded(.towardZero) + D + B - 1524.5
  }
  /// اليوم اليولياني للحظة معيّنة (UTC)
  public static func julianDay(from date: Date) -> Double { date.timeIntervalSince1970 / 86400 + 2440587.5 }
  public static func julianCentury(_ jd: Double) -> Double { (jd - 2451545.0) / 36525 }

  public static func meanSolarLongitude(_ T: Double) -> Double { unwindAngle(280.4664567 + 36000.76983 * T + 0.0003032 * T * T) }
  public static func meanLunarLongitude(_ T: Double) -> Double { unwindAngle(218.3165 + 481267.8813 * T) }
  public static func ascendingLunarNodeLongitude(_ T: Double) -> Double { unwindAngle(125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000) }
  public static func meanSolarAnomaly(_ T: Double) -> Double { unwindAngle(357.52911 + 35999.05029 * T - 0.0001537 * T * T) }
  public static func solarEquationOfTheCenter(_ T: Double, _ M: Double) -> Double {
    let Mrad = d2r(M)
    return (1.914602 - 0.004817 * T - 0.000014 * T * T) * sin(Mrad) + (0.019993 - 0.000101 * T) * sin(2 * Mrad) + 0.000289 * sin(3 * Mrad)
  }
  public static func apparentSolarLongitude(_ T: Double, _ L0: Double) -> Double {
    let longitude = L0 + solarEquationOfTheCenter(T, meanSolarAnomaly(T))
    let Omega = 125.04 - 1934.136 * T
    return unwindAngle(longitude - 0.00569 - 0.00478 * sin(d2r(Omega)))
  }
  public static func meanObliquityOfTheEcliptic(_ T: Double) -> Double { 23.439291 - 0.013004167 * T - 0.0000001639 * T * T + 0.0000005036 * T * T * T }
  public static func apparentObliquityOfTheEcliptic(_ T: Double, _ epsilon0: Double) -> Double { epsilon0 + 0.00256 * cos(d2r(125.04 - 1934.136 * T)) }
  public static func meanSiderealTime(_ T: Double) -> Double {
    let JD = T * 36525 + 2451545.0
    return unwindAngle(280.46061837 + 360.98564736629 * (JD - 2451545) + 0.000387933 * T * T - (T * T * T) / 38710000)
  }
  public static func nutationInLongitude(_ T: Double, _ L0: Double, _ Lp: Double, _ Omega: Double) -> Double {
    (-17.2 / 3600) * sin(d2r(Omega)) - (1.32 / 3600) * sin(2 * d2r(L0)) - (0.23 / 3600) * sin(2 * d2r(Lp)) + (0.21 / 3600) * sin(2 * d2r(Omega))
  }
  public static func nutationInObliquity(_ T: Double, _ L0: Double, _ Lp: Double, _ Omega: Double) -> Double {
    (9.2 / 3600) * cos(d2r(Omega)) + (0.57 / 3600) * cos(2 * d2r(L0)) + (0.1 / 3600) * cos(2 * d2r(Lp)) - (0.09 / 3600) * cos(2 * d2r(Omega))
  }
  /// ارتفاع جرم سماوي فوق الأفق — Meeus ص 93
  public static func altitudeOfCelestialBody(phi: Double, delta: Double, H: Double) -> Double {
    r2d(asin(sin(d2r(phi)) * sin(d2r(delta)) + cos(d2r(phi)) * cos(d2r(delta)) * cos(d2r(H))))
  }

  public struct SolarCoordinates: Sendable {
    public let declination: Double
    public let rightAscension: Double
    public let apparentSiderealTime: Double
    public let apparentLongitude: Double
  }
  /// الإحداثيات الظاهرية للشمس عند يوم يولياني معيّن
  public static func solarCoordinates(_ jd: Double) -> SolarCoordinates {
    let T = julianCentury(jd)
    let L0 = meanSolarLongitude(T)
    let Lp = meanLunarLongitude(T)
    let Omega = ascendingLunarNodeLongitude(T)
    let Lambda = d2r(apparentSolarLongitude(T, L0))
    let Theta0 = meanSiderealTime(T)
    let dPsi = nutationInLongitude(T, L0, Lp, Omega)
    let dEpsilon = nutationInObliquity(T, L0, Lp, Omega)
    let Epsilon0 = meanObliquityOfTheEcliptic(T)
    let EpsilonApparent = d2r(apparentObliquityOfTheEcliptic(T, Epsilon0))
    return SolarCoordinates(
      declination: r2d(asin(sin(EpsilonApparent) * sin(Lambda))),
      rightAscension: unwindAngle(r2d(atan2(cos(EpsilonApparent) * sin(Lambda), cos(Lambda)))),
      apparentSiderealTime: Theta0 + (dPsi * 3600 * cos(d2r(Epsilon0 + dEpsilon))) / 3600,
      apparentLongitude: r2d(Lambda))
  }

  public static func approximateTransit(longitude: Double, siderealTime: Double, rightAscension: Double) -> Double {
    let Lw = -longitude
    let m0 = normalizeToScale((rightAscension + Lw - siderealTime) / 360, 1)
    let expected = normalizeToScale((12.0 - longitude / 15.0) / 24.0, 1)
    if m0 - expected > 0.5 { return m0 - 1 }
    if expected - m0 > 0.5 { return m0 + 1 }
    return m0
  }
  public static func correctedTransit(m0: Double, longitude: Double, siderealTime: Double, a2: Double, a1: Double, a3: Double) -> Double {
    let Lw = -longitude
    let Theta = unwindAngle(siderealTime + 360.985647 * m0)
    let a = unwindAngle(interpolateAngles(a2, a1, a3, m0))
    let H = quadrantShiftAngle(Theta - Lw - a)
    return (m0 + H / -360) * 24
  }
  public static func correctedHourAngle(m0: Double, h0: Double, coords: Coordinates, afterTransit: Bool, siderealTime: Double,
                                        a2: Double, a1: Double, a3: Double, d2: Double, d1: Double, d3: Double) -> Double {
    let Lw = -coords.longitude
    let term1 = sin(d2r(h0)) - sin(d2r(coords.latitude)) * sin(d2r(d2))
    let term2 = cos(d2r(coords.latitude)) * cos(d2r(d2))
    let H0 = r2d(acos(term1 / term2)) // NaN إذا لم تبلغ الشمس هذه الزاوية (خطوط العرض العالية)
    let m = afterTransit ? m0 + H0 / 360 : m0 - H0 / 360
    let Theta = unwindAngle(siderealTime + 360.985647 * m)
    let a = unwindAngle(interpolateAngles(a2, a1, a3, m))
    let delta = interpolate(d2, d1, d3, m)
    let H = Theta - Lw - a
    let h = altitudeOfCelestialBody(phi: coords.latitude, delta: delta, H: H)
    let dm = (h - h0) / (360 * cos(d2r(delta)) * cos(d2r(coords.latitude)) * sin(d2r(H)))
    return (m + dm) * 24
  }
  /// استكمال بثلاث قيم متساوية التباعد — Meeus ص 24
  public static func interpolate(_ y2: Double, _ y1: Double, _ y3: Double, _ n: Double) -> Double {
    let a = y2 - y1, b = y3 - y2, c = b - a
    return y2 + (n / 2) * (a + b + n * c)
  }
  public static func interpolateAngles(_ y2: Double, _ y1: Double, _ y3: Double, _ n: Double) -> Double {
    let a = unwindAngle(y2 - y1), b = unwindAngle(y3 - y2), c = b - a
    return y2 + (n / 2) * (a + b + n * c)
  }
  /// الانكسار الجوي التقريبي (Sæmundsson) بالدرجات لارتفاع ظاهري
  public static func refraction(_ hDeg: Double) -> Double {
    if hDeg < -1 { return 0 }
    return (1.02 / tan(d2r(hDeg + 10.3 / (hDeg + 5.11)))) / 60
  }

  public struct SunPosition: Sendable {
    /// من الشمال الحقيقي باتجاه عقارب الساعة (0..360)
    public let azimuth: Double
    /// هندسي (بدون انكسار)
    public let altitude: Double
    public let declination: Double
    public let hourAngle: Double
    /// بالدقائق
    public let equationOfTime: Double
    public let rightAscension: Double
  }
  /// موقع الشمس في السماء لحظةً معيّنة
  public static func sunPosition(at date: Date, latitude: Double, longitude: Double) -> SunPosition {
    let jd = julianDay(from: date)
    let s = solarCoordinates(jd)
    let T = julianCentury(jd)
    let H = quadrantShiftAngle(unwindAngle(s.apparentSiderealTime + longitude - s.rightAscension))
    let phi = d2r(latitude), delta = d2r(s.declination), Hr = d2r(H)
    let altitude = r2d(asin(sin(phi) * sin(delta) + cos(phi) * cos(delta) * cos(Hr)))
    let azSouth = r2d(atan2(sin(Hr), cos(Hr) * sin(phi) - tan(delta) * cos(phi)))
    let azimuth = unwindAngle(azSouth + 180)
    let L0 = meanSolarLongitude(T)
    var E = L0 - 0.0057183 - s.rightAscension + (s.apparentSiderealTime - meanSiderealTime(T))
    E = quadrantShiftAngle(E) * 4
    return SunPosition(azimuth: azimuth, altitude: altitude, declination: s.declination, hourAngle: H, equationOfTime: E, rightAscension: s.rightAscension)
  }
}

/// إحداثيات جغرافية (درجات)
public struct Coordinates: Sendable, Hashable, Codable {
  public var latitude: Double
  public var longitude: Double
  public init(latitude: Double, longitude: Double) { self.latitude = latitude; self.longitude = longitude }
}

/// أوقات الشمس ليوم مدني عند موقع معيّن؛ القيم بالساعات UT (قد تكون سالبة أو > 24 لأن اليوم يبدأ في UT)
public struct SolarTime: Sendable {
  public let observer: Coordinates
  public let solar: Astro.SolarCoordinates
  public let prevSolar: Astro.SolarCoordinates
  public let nextSolar: Astro.SolarCoordinates
  public let approxTransit: Double
  public let transit: Double
  public let sunrise: Double
  public let sunset: Double

  public init(date: CivilDate, coords: Coordinates) {
    let jd = Astro.julianDay(year: date.year, month: date.month, day: date.day, hours: 0)
    observer = coords
    solar = Astro.solarCoordinates(jd)
    prevSolar = Astro.solarCoordinates(jd - 1)
    nextSolar = Astro.solarCoordinates(jd + 1)
    let m0 = Astro.approximateTransit(longitude: coords.longitude, siderealTime: solar.apparentSiderealTime, rightAscension: solar.rightAscension)
    let solarAltitude = -50.0 / 60.0 // نصف قطر الشمس + الانكسار الجوي
    approxTransit = m0
    transit = Astro.correctedTransit(m0: m0, longitude: coords.longitude, siderealTime: solar.apparentSiderealTime,
                                     a2: solar.rightAscension, a1: prevSolar.rightAscension, a3: nextSolar.rightAscension)
    sunrise = SolarTime.hourAngle(angle: solarAltitude, afterTransit: false, approxTransit: m0, observer: coords, solar: solar, prev: prevSolar, next: nextSolar)
    sunset = SolarTime.hourAngle(angle: solarAltitude, afterTransit: true, approxTransit: m0, observer: coords, solar: solar, prev: prevSolar, next: nextSolar)
  }
  private static func hourAngle(angle: Double, afterTransit: Bool, approxTransit: Double, observer: Coordinates,
                                solar: Astro.SolarCoordinates, prev: Astro.SolarCoordinates, next: Astro.SolarCoordinates) -> Double {
    Astro.correctedHourAngle(m0: approxTransit, h0: angle, coords: observer, afterTransit: afterTransit, siderealTime: solar.apparentSiderealTime,
                             a2: solar.rightAscension, a1: prev.rightAscension, a3: next.rightAscension,
                             d2: solar.declination, d1: prev.declination, d3: next.declination)
  }
  /// وقت بلوغ الشمس زاوية ارتفاع معيّنة قبل/بعد الزوال
  public func hourAngle(_ angle: Double, afterTransit: Bool) -> Double {
    SolarTime.hourAngle(angle: angle, afterTransit: afterTransit, approxTransit: approxTransit, observer: observer, solar: solar, prev: prevSolar, next: nextSolar)
  }
  /// وقت العصر: حين يصير ظل الشيء مثله (1) أو مثليه (2) زيادةً على ظل الزوال
  public func afternoon(shadowLength: Double) -> Double {
    let tangent = abs(observer.latitude - solar.declination)
    let inverse = shadowLength + tan(d2r(tangent))
    let angle = r2d(atan(1.0 / inverse))
    return hourAngle(angle, afterTransit: true)
  }
  public var isValid: Bool { !sunrise.isNaN && !sunset.isNaN }
}
