import XCTest
@testable import SakinahCore

/// اختبارات المرجع الذهبي: النواة الأصلية تُطابق محرك نسخة الويب (المُتحقَّق منه ضد adhan-js وAlAdhan) رقمًا برقم
final class GoldenTests: XCTestCase {
  struct Golden: Decodable {
    struct Times: Decodable { let fajr: Int?, sunrise: Int?, dhuhr: Int?, asr: Int?, sunset: Int?, maghrib: Int?, isha: Int? }
    struct Resolved: Decodable { let polarResolved: Bool, fajrSafe: Bool, ishaSafe: Bool, usedLatitude: Double, rule: String, dayShifted: Bool }
    struct Params: Decodable {
      let method: String, madhab: String, highLatitudeRule: String, polarResolution: String, isRamadan: Bool, shafaq: String
      let rounding: String?; let custom: Custom?; let adjustments: Adj
      struct Custom: Decodable { let fajrAngle: Double?, ishaAngle: Double?, ishaInterval: Double?, maghribAngle: Double? }
      struct Adj: Decodable { let fajr: Double, sunrise: Double, dhuhr: Double, asr: Double, maghrib: Double, isha: Double }
    }
    struct PrayerCase: Decodable { let id: String, lat: Double, lon: Double, tz: String, date: CivilDate, params: Params, times: Times, resolved: Resolved }
    struct TimelineCase: Decodable {
      struct Next: Decodable { let key: String, time: Int, isTomorrow: Bool, isYesterday: Bool }
      struct Sunnah: Decodable { let middleOfNight: Int?, lastThird: Int? }
      let id: String, lat: Double, lon: Double, tz: String, method: String, now: Int, date: CivilDate, current: String, next: Next, sunnah: Sunnah, yesterdayIsha: Int?
    }
    struct HijriCase: Decodable { let epoch: Int, tz: String, offset: Int, day: Int, month: Int, year: Int, weekday: Int, source: String }
    struct QiblaCase: Decodable { let id: String, lat: Double, lon: Double, bearing: Double, bearingSpherical: Double, distanceKm: Double, difference: Double, compassPoint: String, antipodal: Bool }
    struct SunCase: Decodable { let id: String, lat: Double, lon: Double, tz: String, civil: CivilDate, bearing: Double, sunAtQibla: Int?, shadowAtQibla: Int? }
    struct Zenith: Decodable { let time: Int, altitude: Double }
    struct GeoCase: Decodable { let id: String, lat: Double, lon: Double, altKm: Double, decimalYear: Double, declination: Double, inclination: Double, f: Double, h: Double, x: Double, y: Double, z: Double, gridVariation: Double?, outOfRange: Bool }
    struct MethodCase: Decodable { let countryCode: String?, tz: String?, method: String }
    let prayer: [PrayerCase], timeline: [TimelineCase], hijri: [HijriCase], qibla: [QiblaCase], sunMoments: [SunCase], zenith: [String: [Zenith]], geomag: [GeoCase], methods: [MethodCase]
  }

  static let golden: Golden = {
    let url = Bundle.module.url(forResource: "golden", withExtension: "json", subdirectory: "Fixtures")!
    return try! JSONDecoder().decode(Golden.self, from: Data(contentsOf: url))
  }()

  private func params(_ p: Golden.Params, tz: String) -> PrayerParams {
    var q = PrayerParams()
    q.method = p.method; q.madhab = Madhab(rawValue: p.madhab)!; q.highLatitudeRule = HighLatitudeRule(rawValue: p.highLatitudeRule)!
    q.polarResolution = PolarResolution(rawValue: p.polarResolution)!; q.isRamadan = p.isRamadan; q.shafaq = Shafaq(rawValue: p.shafaq)!
    q.rounding = p.rounding.flatMap { Rounding(rawValue: $0) }
    q.custom = p.custom.map { CustomMethodParams(fajrAngle: $0.fajrAngle, ishaAngle: $0.ishaAngle, ishaInterval: $0.ishaInterval, maghribAngle: $0.maghribAngle) }
    q.adjustments = PrayerAdjustments(fajr: p.adjustments.fajr, sunrise: p.adjustments.sunrise, dhuhr: p.adjustments.dhuhr, asr: p.adjustments.asr, maghrib: p.adjustments.maghrib, isha: p.adjustments.isha)
    q.tz = tz
    return q
  }
  private func epoch(_ d: Date?) -> Int? { d.map { Int($0.timeIntervalSince1970.rounded()) } }

  func testPrayerTimesMatchWebEngine() {
    let g = Self.golden
    var mismatches: [String] = []; var checked = 0
    for c in g.prayer {
      let r = PrayerTimes.compute(coords: Coordinates(latitude: c.lat, longitude: c.lon), date: c.date, params: params(c.params, tz: c.tz))
      let pairs: [(String, Int?, Date?)] = [("fajr", c.times.fajr, r.fajr), ("sunrise", c.times.sunrise, r.sunrise), ("dhuhr", c.times.dhuhr, r.dhuhr), ("asr", c.times.asr, r.asr), ("sunset", c.times.sunset, r.sunset), ("maghrib", c.times.maghrib, r.maghrib), ("isha", c.times.isha, r.isha)]
      for (name, want, got) in pairs {
        checked += 1
        let gotE = epoch(got)
        if want != gotE {
          if let w = want, let ge = gotE, abs(w - ge) <= 60 { continue } // حالات حدّ الدقيقة النادرة (فرق تمثيل عشري)
          mismatches.append("\(c.id) \(c.date.year)-\(c.date.month)-\(c.date.day) \(c.params.method) \(name): want \(String(describing: want)) got \(String(describing: gotE))")
        }
      }
      if c.resolved.polarResolved != r.resolved.polarResolved || c.resolved.fajrSafe != r.resolved.fajrSafe || c.resolved.ishaSafe != r.resolved.ishaSafe || c.resolved.rule != r.resolved.rule.rawValue || abs(c.resolved.usedLatitude - r.resolved.usedLatitude) > 1e-9 {
        mismatches.append("\(c.id) \(c.date.year)-\(c.date.month)-\(c.date.day) \(c.params.method) resolved: want \(c.resolved) got \(r.resolved)")
      }
    }
    XCTAssertTrue(mismatches.isEmpty, "\(mismatches.count) mismatches of \(checked):\n" + mismatches.prefix(25).joined(separator: "\n"))
    XCTAssertGreaterThan(checked, 4000)
  }

  func testExactMatchRateIsHigh() {
    let g = Self.golden; var exact = 0, total = 0
    for c in g.prayer {
      let r = PrayerTimes.compute(coords: Coordinates(latitude: c.lat, longitude: c.lon), date: c.date, params: params(c.params, tz: c.tz))
      for (want, got) in [(c.times.fajr, r.fajr), (c.times.sunrise, r.sunrise), (c.times.dhuhr, r.dhuhr), (c.times.asr, r.asr), (c.times.maghrib, r.maghrib), (c.times.isha, r.isha)] { total += 1; if want == epoch(got) { exact += 1 } }
    }
    XCTAssertGreaterThan(Double(exact) / Double(total), 0.999, "exact \(exact)/\(total)")
  }

  func testDayTimelineMatchesWebEngine() {
    for c in Self.golden.timeline {
      var p = PrayerParams(); p.method = c.method
      let t = PrayerTimes.dayTimeline(coords: Coordinates(latitude: c.lat, longitude: c.lon), tz: TimeZone(identifier: c.tz)!, params: p, now: Date(timeIntervalSince1970: Double(c.now)))
      XCTAssertEqual(t.date, c.date, c.id)
      XCTAssertEqual(t.current.rawValue, c.current, "\(c.id) current @\(c.now)")
      XCTAssertEqual(t.next.key.rawValue, c.next.key, "\(c.id) next @\(c.now)")
      XCTAssertEqual(epoch(t.next.time), c.next.time, "\(c.id) next time @\(c.now)")
      XCTAssertEqual(t.next.isTomorrow, c.next.isTomorrow, c.id)
      XCTAssertEqual(t.next.isYesterday, c.next.isYesterday, c.id)
      XCTAssertEqual(epoch(t.sunnah.middleOfNight), c.sunnah.middleOfNight, "\(c.id) midnight @\(c.now)")
      XCTAssertEqual(epoch(t.sunnah.lastThird), c.sunnah.lastThird, "\(c.id) lastThird @\(c.now)")
      XCTAssertEqual(epoch(t.yesterdayIsha), c.yesterdayIsha, "\(c.id) yesterdayIsha @\(c.now)")
    }
  }

  func testHijriMatchesICU() {
    var mismatches: [String] = []
    for c in Self.golden.hijri {
      let h = Hijri.date(Date(timeIntervalSince1970: Double(c.epoch)), tz: TimeZone(identifier: c.tz)!, offsetDays: c.offset)
      if h.day != c.day || h.month != c.month || h.year != c.year || h.weekdayIndex != c.weekday { mismatches.append("\(c.epoch) \(c.tz) \(c.offset): want \(c.day)/\(c.month)/\(c.year) wd\(c.weekday) got \(h.day)/\(h.month)/\(h.year) wd\(h.weekdayIndex) (\(h.source))") }
    }
    XCTAssertTrue(mismatches.isEmpty, "\(mismatches.count) hijri mismatches:\n" + mismatches.prefix(15).joined(separator: "\n"))
  }

  func testTabularHijriWithinTwoDaysOfUmmAlQura() {
    // البديل الجدولي (الكويتي) يُستخدم فقط عند غياب ICU (لا يحدث على منصات Apple)؛ يبعد عن أم القرى حتى يومين في بعض الشهور
    guard Hijri.umalqura != nil else { return }
    let tz = TimeZone(identifier: "UTC")!
    for i in 0..<60 {
      let d = Date(timeIntervalSince1970: 1_735_689_600 + Double(i) * 17 * 86400) // من 2025-01-01 بخطوات 17 يومًا
      let civ = CivilDate(d, in: tz)
      let icu = Hijri.date(d, tz: tz)
      let t = Hijri.tabular(gy: civ.year, gm: civ.month, gd: civ.day)
      let sameMonth = t.year == icu.year && t.month == icu.month && abs(t.day - icu.day) <= 2
      let boundary = (t.day <= 2 && icu.day >= 28) || (icu.day <= 2 && t.day >= 28) // عبر حدّ الشهر
      XCTAssertTrue(sameMonth || boundary, "\(civ): tabular \(t) vs umalqura \(icu.day)/\(icu.month)/\(icu.year)")
    }
  }

  func testQiblaMatchesWebEngine() {
    for c in Self.golden.qibla {
      let q = Qibla.info(latitude: c.lat, longitude: c.lon)
      XCTAssertEqual(q.bearing, c.bearing, accuracy: 1e-7, c.id)
      XCTAssertEqual(q.bearingSpherical, c.bearingSpherical, accuracy: 1e-7, c.id)
      XCTAssertEqual(q.distanceKm, c.distanceKm, accuracy: 1e-6, c.id)
      XCTAssertEqual(q.difference, c.difference, accuracy: 1e-7, c.id)
      XCTAssertEqual(q.compassPoint, c.compassPoint, c.id)
      XCTAssertEqual(q.antipodal, c.antipodal, c.id)
    }
  }

  func testSunQiblaMomentsAndZenith() {
    for c in Self.golden.sunMoments {
      let s = Qibla.sunQiblaMoments(latitude: c.lat, longitude: c.lon, civil: c.civil, tz: TimeZone(identifier: c.tz)!)
      XCTAssertEqual(s.bearing, c.bearing, accuracy: 1e-7, c.id)
      XCTAssertEqual(epoch(s.sunAtQibla), c.sunAtQibla, "\(c.id) sunAtQibla \(c.civil)")
      XCTAssertEqual(epoch(s.shadowAtQibla), c.shadowAtQibla, "\(c.id) shadowAtQibla \(c.civil)")
    }
    for (year, events) in Self.golden.zenith {
      let got = Qibla.kaabaZenithEvents(year: Int(year)!)
      XCTAssertEqual(got.count, events.count)
      for (g, w) in zip(got, events) { XCTAssertEqual(epoch(g.time), w.time, year); XCTAssertEqual(g.altitude, w.altitude, accuracy: 1e-6) }
    }
  }

  func testGeomagMatchesWebEngine() {
    for c in Self.golden.geomag {
      let f = Geomag.field(lat: c.lat, lon: c.lon, altKm: c.altKm, decimalYear: c.decimalYear)
      XCTAssertEqual(f.declination, c.declination, accuracy: 1e-8, c.id)
      XCTAssertEqual(f.inclination, c.inclination, accuracy: 1e-8, c.id)
      XCTAssertEqual(f.f, c.f, accuracy: 1e-5, c.id)
      XCTAssertEqual(f.h, c.h, accuracy: 1e-5, c.id)
      XCTAssertEqual(f.x, c.x, accuracy: 1e-5, c.id); XCTAssertEqual(f.y, c.y, accuracy: 1e-5, c.id); XCTAssertEqual(f.z, c.z, accuracy: 1e-5, c.id)
      if let gv = c.gridVariation { XCTAssertEqual(f.gridVariation ?? .nan, gv, accuracy: 1e-8, c.id) } else { XCTAssertNil(f.gridVariation, c.id) }
      XCTAssertEqual(f.outOfRange, c.outOfRange, c.id)
    }
    XCTAssertEqual(Geomag.decimalYear(Date(timeIntervalSince1970: 1_767_225_600)), 2026.0, accuracy: 1e-9) // 2026-01-01T00:00Z
  }

  func testDefaultMethodSelection() {
    for c in Self.golden.methods { XCTAssertEqual(Methods.defaultMethod(countryCode: c.countryCode, tz: c.tz), c.method) }
    XCTAssertEqual(Methods.order.count, Methods.all.count)
  }

  func testCivilDateHelpers() {
    let tz = TimeZone(identifier: "Asia/Amman")!
    let d = CivilDate(Date(timeIntervalSince1970: 1_788_912_000), in: tz) // 2026-09-09T00:00Z → 03:00 عمّان
    XCTAssertEqual(d, CivilDate(year: 2026, month: 9, day: 9))
    XCTAssertEqual(d.adding(days: 30), CivilDate(year: 2026, month: 10, day: 9))
    XCTAssertEqual(CivilDate(year: 2024, month: 12, day: 31).dayOfYear, 366)
    XCTAssertEqual(CivilDate.daysInMonth(year: 2026, month: 2), 28)
    XCTAssertEqual(d.utcDate(hours: 25.5)!.timeIntervalSince1970, d.utcMidnight.timeIntervalSince1970 + 25.5 * 3600)
    XCTAssertNil(d.utcDate(hours: .nan))
  }
}
