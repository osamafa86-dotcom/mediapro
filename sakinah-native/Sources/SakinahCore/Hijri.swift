import Foundation

/// التاريخ الهجري (تقويم أم القرى عبر Foundation/ICU) مع بديل جدولي، وتعديل المستخدم ±يومين — مطابق لـ hijri.js
public struct HijriDate: Sendable, Hashable, Codable {
  public let day: Int
  public let month: Int
  public let year: Int
  public let weekdayIndex: Int
  public let source: String
  public var monthName: String { Hijri.monthsAr[month - 1] }
  public var weekday: String { Hijri.weekdaysAr[weekdayIndex] }
  public var formatted: String { "\(day) \(monthName) \(year)هـ" }
}

public enum Hijri {
  public static let monthsAr = ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"]
  public static let weekdaysAr = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]

  static let umalqura: Calendar? = {
    var c = Calendar(identifier: .islamicUmmAlQura)
    c.timeZone = TimeZone(identifier: "UTC")!
    c.locale = Locale(identifier: "en_US_POSIX")
    // تحقق أن التقويم يعطي قيمًا معقولة (على بعض المنصات قد يغيب دعم ICU)
    let probe = c.dateComponents([.year], from: Date(timeIntervalSince1970: 1_700_000_000))
    return (probe.year ?? 0) > 1400 ? c : nil
  }()

  /// التاريخ الهجري لليوم المدني الذي تقع فيه اللحظة في المنطقة الزمنية، مع إزاحة أيام المستخدم
  public static func date(_ date: Date = Date(), tz: TimeZone, offsetDays: Int = 0) -> HijriDate {
    let civ = CivilDate(date, in: tz).adding(days: offsetDays)
    let shifted = civ.utcMidnight.addingTimeInterval(12 * 3600)
    let weekdayIndex = CivilDate.weekdayIndex(of: date, in: tz)
    if let cal = umalqura {
      let p = cal.dateComponents([.year, .month, .day], from: shifted)
      return HijriDate(day: p.day!, month: p.month!, year: p.year!, weekdayIndex: weekdayIndex, source: "umalqura")
    }
    let t = tabular(gy: civ.year, gm: civ.month, gd: civ.day)
    return HijriDate(day: t.day, month: t.month, year: t.year, weekdayIndex: weekdayIndex, source: "tabular")
  }

  /// هل اليوم في رمضان؟
  public static func isRamadan(_ d: Date = Date(), tz: TimeZone, offsetDays: Int = 0) -> Bool { date(d, tz: tz, offsetDays: offsetDays).month == 9 }

  /// التقويم الهجري الجدولي (الخوارزمية الكويتية) — بديل تقريبي عند غياب ICU، قد يختلف عن أم القرى بيوم أو يومين
  public static func tabular(gy: Int, gm: Int, gd: Int) -> (day: Int, month: Int, year: Int) {
    let a = (14 - gm) / 12, y = gy + 4800 - a, m = gm + 12 * a - 3
    let jd = gd + (153 * m + 2) / 5 + 365 * y + y / 4 - y / 100 + y / 400 - 32045
    let l = jd - 1948440 + 10632
    let n = (l - 1) / 10631
    var l2 = l - 10631 * n + 354
    let j = ((10985 - l2) / 5316) * ((50 * l2) / 17719) + (l2 / 5670) * ((43 * l2) / 15238)
    l2 = l2 - ((30 - j) / 15) * ((17719 * j) / 50) - (j / 16) * ((15238 * j) / 43) + 29
    let month = (24 * l2) / 709
    let day = l2 - (709 * month) / 24
    let year = 30 * n + j - 30
    return (day, month, year)
  }
}
