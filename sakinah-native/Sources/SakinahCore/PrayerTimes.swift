import Foundation

/// مذهب العصر
public enum Madhab: String, Sendable, Codable { case shafi, hanafi }
/// قواعد خطوط العرض العالية
public enum HighLatitudeRule: String, Sendable, Codable, CaseIterable {
  case auto, middleOfTheNight = "middleofthenight", seventhOfTheNight = "seventhofthenight", twilightAngle = "twilightangle"
  public var nameAr: String {
    switch self {
    case .auto: "تلقائي (منتصف الليل، ونسبة زاوية الشفق حين لا يتحقق الشفق أو فوق 48°)"
    case .middleOfTheNight: "منتصف الليل"
    case .seventhOfTheNight: "سُبع الليل"
    case .twilightAngle: "نسبة زاوية الشفق"
    }
  }
}
public enum PolarResolution: String, Sendable, Codable { case aqrabBalad = "aqrabbalad", unresolved }
public enum Shafaq: String, Sendable, Codable { case general, ahmer, abyad }

/// معاملات الطريقة المخصّصة
public struct CustomMethodParams: Sendable, Hashable, Codable {
  public var fajrAngle: Double?
  public var ishaAngle: Double?
  public var ishaInterval: Double?
  public var maghribAngle: Double?
  public init(fajrAngle: Double? = nil, ishaAngle: Double? = nil, ishaInterval: Double? = nil, maghribAngle: Double? = nil) {
    self.fajrAngle = fajrAngle; self.ishaAngle = ishaAngle; self.ishaInterval = ishaInterval; self.maghribAngle = maghribAngle
  }
}

/// إعدادات الحساب — مطابقة لـ defaultParams في prayer-times.js
public struct PrayerParams: Sendable, Hashable, Codable {
  public var method: String = "MuslimWorldLeague"
  public var madhab: Madhab = .shafi
  public var highLatitudeRule: HighLatitudeRule = .auto
  public var polarResolution: PolarResolution = .aqrabBalad
  /// تعديلات المستخدم بالدقائق
  public var adjustments: PrayerAdjustments = .zero
  public var custom: CustomMethodParams? = nil
  /// لتفعيل بديل أم القرى الرمضاني (120 دقيقة)
  public var isRamadan: Bool = false
  /// nil = حسب الطريقة
  public var rounding: Rounding? = nil
  public var shafaq: Shafaq = .general
  /// المنطقة الزمنية للمستخدم: تضمن وقوع المواقيت في اليوم المدني المطلوب حتى في المناطق التي يخالف توقيتها خط طولها بأكثر من 12 ساعة
  public var tz: String? = nil
  public init() {}
}

/// نتيجة الحساب ليوم مدني؛ الأوقات nil حين لا تتحقق الزاوية (خطوط العرض العالية بلا قاعدة)
public struct PrayerTimesResult: Sendable {
  public var fajr: Date?, sunrise: Date?, dhuhr: Date?, asr: Date?, sunset: Date?, maghrib: Date?, isha: Date?
  public let date: CivilDate
  public let coords: Coordinates
  public let resolved: Resolved
  public struct Resolved: Sendable {
    public let method: CalculationMethod
    public let polarResolved: Bool
    public let usedLatitude: Double
    public let fajrSafe: Bool
    public let ishaSafe: Bool
    public let nightSeconds: Double
    public let dayShifted: Bool
    public let rule: HighLatitudeRule
    public let fajrRule: HighLatitudeRule?
    public let ishaRule: HighLatitudeRule?
  }
  public subscript(_ p: Prayer) -> Date? {
    switch p { case .fajr: fajr; case .sunrise: sunrise; case .dhuhr: dhuhr; case .asr: asr; case .maghrib: maghrib; case .isha: isha }
  }
}

public enum PrayerTimes {
  static func roundedMinute(_ date: Date?, _ rounding: Rounding = .nearest) -> Date? {
    guard let date else { return nil }
    let seconds = Int(date.timeIntervalSince1970.rounded(.down)) % 60
    var offset = seconds >= 30 ? 60 - seconds : -seconds
    if rounding == .up { offset = 60 - seconds } else if rounding == .none { offset = 0 }
    return date.addingTimeInterval(Double(offset))
  }
  private static func addSeconds(_ d: Date?, _ s: Double) -> Date? { d.map { $0.addingTimeInterval(s) } }
  private static func addMinutes(_ d: Date?, _ m: Double) -> Date? { addSeconds(d, m * 60) }

  /// حلّ «أقرب بلد»: الاقتراب من خط الاستواء بخطوات نصف درجة حتى تظهر الشمس وتغيب
  private static func aqrabBalad(_ coords: Coordinates, _ date: CivilDate, _ tomorrow: CivilDate) -> (Coordinates, SolarTime, SolarTime)? {
    var lat = coords.latitude
    for _ in 0..<100 {
      lat -= (lat > 0 ? 1.0 : (lat < 0 ? -1.0 : 0)) * 0.5
      let c = Coordinates(latitude: lat, longitude: coords.longitude)
      let st = SolarTime(date: date, coords: c), st2 = SolarTime(date: tomorrow, coords: c)
      if st.isValid && st2.isValid { return (c, st, st2) }
      if abs(lat) < 65 { break }
    }
    return nil
  }

  private static func daysSinceSolstice(_ doy: Int, _ year: Int, _ latitude: Double, leap: Bool) -> Int {
    let daysInYear = leap ? 366 : 365
    if latitude >= 0 { var d = doy + 10; if d >= daysInYear { d -= daysInYear }; return d }
    var d = doy - (leap ? 173 : 172); if d < 0 { d += daysInYear }; return d
  }
  private static func seasonalAdjustment(_ a: Double, _ b: Double, _ c: Double, _ d: Double, _ dyy: Int) -> Double {
    let x = Double(dyy)
    if dyy < 91 { return a + ((b - a) / 91) * x }
    if dyy < 137 { return b + ((c - b) / 46) * (x - 91) }
    if dyy < 183 { return c + ((d - c) / 46) * (x - 137) }
    if dyy < 229 { return d + ((c - d) / 46) * (x - 183) }
    if dyy < 275 { return c + ((b - c) / 46) * (x - 229) }
    return b + ((a - b) / 91) * (x - 275)
  }
  private static func seasonAdjustedMorningTwilight(_ latitude: Double, _ date: CivilDate, _ sunrise: Date?) -> Date? {
    let L = abs(latitude)
    let adj = seasonalAdjustment(75 + (28.65 / 55) * L, 75 + (19.44 / 55) * L, 75 + (32.74 / 55) * L, 75 + (48.1 / 55) * L, daysSinceSolstice(date.dayOfYear, date.year, latitude, leap: date.isLeapYear))
    return addSeconds(sunrise, (adj * -60).rounded(.toNearestOrAwayFromZero))
  }
  private static func seasonAdjustedEveningTwilight(_ latitude: Double, _ date: CivilDate, _ sunset: Date?, _ shafaq: Shafaq) -> Date? {
    let L = abs(latitude)
    let a: Double, b: Double, c: Double, d: Double
    switch shafaq {
    case .ahmer: a = 62 + (17.4 / 55) * L; b = 62 - (7.16 / 55) * L; c = 62 + (5.12 / 55) * L; d = 62 + (19.44 / 55) * L
    case .abyad: a = 75 + (25.6 / 55) * L; b = 75 + (7.16 / 55) * L; c = 75 + (36.84 / 55) * L; d = 75 + (81.84 / 55) * L
    case .general: a = 75 + (25.6 / 55) * L; b = 75 + (2.05 / 55) * L; c = 75 - (9.21 / 55) * L; d = 75 + (6.14 / 55) * L
    }
    let adj = seasonalAdjustment(a, b, c, d, daysSinceSolstice(date.dayOfYear, date.year, latitude, leap: date.isLeapYear))
    return addSeconds(sunset, (adj * 60).rounded(.toNearestOrAwayFromZero))
  }

  /// المعاملات الفعلية للطريقة المختارة (مع الطريقة المخصّصة والبديل الرمضاني)
  public static func resolveMethodParams(_ params: PrayerParams) -> CalculationMethod {
    var p = Methods.method(params.method)
    if params.method == "Custom", let custom = params.custom {
      func angle(_ v: Double?, _ def: Double) -> Double { if let v, v.isFinite, v >= 4, v <= 30 { return v }; return def }
      func nonneg(_ v: Double?, _ def: Double) -> Double { if let v, v.isFinite, v >= 0, v <= 180 { return v }; return def }
      let mg = custom.maghribAngle
      p = CalculationMethod(id: p.id, nameAr: p.nameAr, nameEn: p.nameEn, fajrAngle: angle(custom.fajrAngle, 18), ishaAngle: angle(custom.ishaAngle, 17),
                            ishaInterval: nonneg(custom.ishaInterval, 0), ishaIntervalRamadan: p.ishaIntervalRamadan,
                            maghribAngle: (mg != nil && mg!.isFinite && mg! > 0 && mg! <= 10) ? mg! : 0, maghribInterval: p.maghribInterval,
                            adjustments: p.adjustments, rounding: p.rounding, aladhanId: p.aladhanId, region: p.region, seasonal: p.seasonal)
    }
    if params.isRamadan, let r = p.ishaIntervalRamadan { p.ishaInterval = r }
    if let r = params.rounding { p.rounding = r }
    return p
  }

  private static func nightPortions(_ rule: HighLatitudeRule, _ latitude: Double, _ fajrAngle: Double, _ ishaAngle: Double) -> (fajr: Double, isha: Double, rule: HighLatitudeRule) {
    let r: HighLatitudeRule = rule == .auto ? (latitude > 48 ? .twilightAngle : .middleOfTheNight) : rule
    if r == .seventhOfTheNight { return (1.0 / 7, 1.0 / 7, r) }
    if r == .twilightAngle { return (fajrAngle / 60, ishaAngle / 60, r) }
    return (0.5, 0.5, r)
  }

  /// حساب مواقيت الصلاة ليوم مدني معيّن
  public static func compute(coords: Coordinates, date: CivilDate, params: PrayerParams = PrayerParams(), _ shifted: Bool = false) -> PrayerTimesResult {
    let mp = resolveMethodParams(params)
    let tomorrow = date.adding(days: 1)
    var usedCoords = coords
    var solarTime = SolarTime(date: date, coords: coords)
    var tomorrowSolarTime = SolarTime(date: tomorrow, coords: coords)
    var dhuhrTime = date.utcDate(hours: solarTime.transit)
    var sunriseTime = date.utcDate(hours: solarTime.sunrise)
    var sunsetTime = date.utcDate(hours: solarTime.sunset)
    var polarResolved = false

    // المناطق التي يخالف توقيتها خط طولها بأكثر من 12 ساعة: قد يقع الزوال في يوم مدني مجاور
    if let tzId = params.tz, !shifted, let dh = dhuhrTime, let tz = TimeZone(identifier: tzId) {
      let c = CivilDate(dh, in: tz)
      let diff = Int((c.utcMidnight.timeIntervalSince(date.utcMidnight) / 86400).rounded())
      if diff != 0 && abs(diff) == 1 {
        var r = compute(coords: coords, date: date.adding(days: -diff), params: params, true)
        r = PrayerTimesResult(fajr: r.fajr, sunrise: r.sunrise, dhuhr: r.dhuhr, asr: r.asr, sunset: r.sunset, maghrib: r.maghrib, isha: r.isha, date: date, coords: r.coords, resolved: r.resolved)
        return r
      }
    }

    if (sunriseTime == nil || sunsetTime == nil || tomorrowSolarTime.sunrise.isNaN) && params.polarResolution == .aqrabBalad {
      if let (c, st, st2) = aqrabBalad(coords, date, tomorrow) {
        polarResolved = true
        usedCoords = c; solarTime = st; tomorrowSolarTime = st2
        dhuhrTime = date.utcDate(hours: solarTime.transit)
        sunriseTime = date.utcDate(hours: solarTime.sunrise)
        sunsetTime = date.utcDate(hours: solarTime.sunset)
      }
    }

    let shadow: Double = params.madhab == .hanafi ? 2 : 1
    let asrTime = date.utcDate(hours: solarTime.afternoon(shadowLength: shadow))
    let tomorrowSunrise = tomorrow.utcDate(hours: tomorrowSolarTime.sunrise)
    let night: Double = { if let ts = tomorrowSunrise, let ss = sunsetTime { return ts.timeIntervalSince(ss) }; return .nan }()
    let portions = nightPortions(params.highLatitudeRule, usedCoords.latitude, mp.fajrAngle, mp.ishaAngle)
    let isMoonsighting = mp.id == "MoonsightingCommittee"

    // ---- الفجر ----
    var fajrTime = date.utcDate(hours: solarTime.hourAngle(-mp.fajrAngle, afterTransit: false))
    if isMoonsighting && coords.latitude >= 55 { fajrTime = addSeconds(sunriseTime, -night / 7) }
    let autoRule = params.highLatitudeRule == .auto
    let fajrPortion = (autoRule && fajrTime == nil) ? mp.fajrAngle / 60 : portions.fajr
    let safeFajr: Date? = isMoonsighting ? seasonAdjustedMorningTwilight(coords.latitude, date, sunriseTime) : addSeconds(sunriseTime, -fajrPortion * night)
    var fajrSafe = false
    if fajrTime == nil || (safeFajr != nil && safeFajr! > fajrTime!) { fajrTime = safeFajr; fajrSafe = true }

    // ---- العشاء ----
    var ishaTime: Date?; var ishaSafe = false; var ishaRuleUsed: HighLatitudeRule? = nil
    if mp.ishaInterval > 0 {
      ishaTime = addMinutes(sunsetTime, mp.ishaInterval)
    } else {
      ishaTime = date.utcDate(hours: solarTime.hourAngle(-mp.ishaAngle, afterTransit: true))
      if isMoonsighting && coords.latitude >= 55 { ishaTime = addSeconds(sunsetTime, night / 7) }
      let ishaPortion = (autoRule && ishaTime == nil) ? mp.ishaAngle / 60 : portions.isha
      ishaRuleUsed = ishaPortion == portions.isha ? portions.rule : .twilightAngle
      let safeIsha: Date? = isMoonsighting ? seasonAdjustedEveningTwilight(coords.latitude, date, sunsetTime, params.shafaq) : addSeconds(sunsetTime, ishaPortion * night)
      if ishaTime == nil || (safeIsha != nil && safeIsha! < ishaTime!) { ishaTime = safeIsha; ishaSafe = true }
    }

    // ---- المغرب ----
    var maghribTime = sunsetTime
    if mp.maghribAngle != 0 {
      if let angleBased = date.utcDate(hours: solarTime.hourAngle(-mp.maghribAngle, afterTransit: true)), let ss = sunsetTime, let ish = ishaTime, ss < angleBased, ish > angleBased {
        maghribTime = angleBased
      }
    }
    if mp.maghribInterval != 0 { maghribTime = addMinutes(maghribTime, mp.maghribInterval) }

    func adj(_ k: Prayer) -> Double { params.adjustments[k] + mp.adjustments[k] }
    let rounding = mp.rounding
    let resolved = PrayerTimesResult.Resolved(
      method: mp, polarResolved: polarResolved, usedLatitude: usedCoords.latitude, fajrSafe: fajrSafe, ishaSafe: ishaSafe, nightSeconds: night,
      dayShifted: shifted, rule: portions.rule,
      fajrRule: fajrSafe ? (fajrPortion == portions.fajr ? portions.rule : .twilightAngle) : nil,
      ishaRule: ishaSafe ? ishaRuleUsed : nil)
    return PrayerTimesResult(
      fajr: roundedMinute(addMinutes(fajrTime, adj(.fajr)), rounding),
      sunrise: roundedMinute(addMinutes(sunriseTime, adj(.sunrise)), rounding),
      dhuhr: roundedMinute(addMinutes(dhuhrTime, adj(.dhuhr)), rounding),
      asr: roundedMinute(addMinutes(asrTime, adj(.asr)), rounding),
      sunset: roundedMinute(sunsetTime, rounding),
      maghrib: roundedMinute(addMinutes(maghribTime, adj(.maghrib)), rounding),
      isha: roundedMinute(addMinutes(ishaTime, adj(.isha)), rounding),
      date: date, coords: coords, resolved: resolved)
  }

  public struct SunnahTimes: Sendable {
    public let middleOfNight: Date?
    public let lastThird: Date?
    public let nextFajr: Date?
  }
  /// منتصف الليل الشرعي والثلث الأخير (من المغرب إلى فجر الغد)
  public static func sunnahTimes(coords: Coordinates, date: CivilDate, params: PrayerParams = PrayerParams()) -> SunnahTimes {
    let today = compute(coords: coords, date: date, params: params)
    let next = compute(coords: coords, date: date.adding(days: 1), params: params)
    guard let nf = next.fajr, let mg = today.maghrib else { return SunnahTimes(middleOfNight: nil, lastThird: nil, nextFajr: next.fajr) }
    let nightDuration = nf.timeIntervalSince(mg)
    return SunnahTimes(middleOfNight: roundedMinute(mg.addingTimeInterval(nightDuration / 2)), lastThird: roundedMinute(mg.addingTimeInterval(nightDuration * (2.0 / 3))), nextFajr: nf)
  }

  public struct NextPrayer: Sendable { public let key: Prayer; public let time: Date; public let isTomorrow: Bool; public let isYesterday: Bool }
  public struct DayTimeline: Sendable {
    public let date: CivilDate
    public let times: PrayerTimesResult
    public let sunnah: SunnahTimes
    /// nil لا يحدث عمليًا؛ يُحدَّد دائمًا
    public let current: Prayer
    public let next: NextPrayer
    public let yesterdayIsha: Date?
  }
  /// جدول اليوم مع الصلاة الحالية والتالية، مع ما قبل الفجر وما بعد العشاء
  public static func dayTimeline(coords: Coordinates, tz: TimeZone, params: PrayerParams = PrayerParams(), now: Date = Date()) -> DayTimeline {
    var params = params; params.tz = tz.identifier
    let date = CivilDate(now, in: tz)
    let times = compute(coords: coords, date: date, params: params)
    var current: Prayer? = nil; var next: NextPrayer? = nil
    for k in Prayer.allCases { guard let t = times[k] else { continue }
      if now >= t { current = k } else if next == nil { next = NextPrayer(key: k, time: t, isTomorrow: false, isYesterday: false) }
    }
    var yesterdayIsha: Date? = nil
    if current == nil {
      let yesterday = compute(coords: coords, date: date.adding(days: -1), params: params)
      if let yi = yesterday.isha, yi > now { current = .maghrib; next = NextPrayer(key: .isha, time: yi, isTomorrow: false, isYesterday: true) } else { current = .isha }
      yesterdayIsha = yesterday.isha
    }
    if next == nil {
      let tomorrow = compute(coords: coords, date: date.adding(days: 1), params: params)
      next = NextPrayer(key: .fajr, time: tomorrow.fajr ?? now.addingTimeInterval(86400), isTomorrow: true, isYesterday: false)
    }
    let beforeFajr = times.fajr.map { now < $0 } ?? false
    let sunnah = sunnahTimes(coords: coords, date: beforeFajr ? date.adding(days: -1) : date, params: params)
    return DayTimeline(date: date, times: times, sunnah: sunnah, current: current!, next: next!, yesterdayIsha: yesterdayIsha)
  }

  /// جدول شهري
  public static func monthTable(coords: Coordinates, year: Int, month: Int, params: PrayerParams = PrayerParams()) -> [PrayerTimesResult] {
    (1...CivilDate.daysInMonth(year: year, month: month)).map { compute(coords: coords, date: CivilDate(year: year, month: month, day: $0), params: params) }
  }
}
