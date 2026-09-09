import Foundation

/// يوم مدني (سنة/شهر/يوم، الشهر 1..12) في منطقة زمنية ما — مستقل عن اللحظة
public struct CivilDate: Sendable, Hashable, Codable {
  public var year: Int
  public var month: Int
  public var day: Int
  public init(year: Int, month: Int, day: Int) { self.year = year; self.month = month; self.day = day }

  static let utcCalendar: Calendar = { var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "UTC")!; c.locale = Locale(identifier: "en_US_POSIX"); return c }()
  static func calendar(in tz: TimeZone) -> Calendar { var c = Calendar(identifier: .gregorian); c.timeZone = tz; c.locale = Locale(identifier: "en_US_POSIX"); return c }

  /// اليوم المدني للحظة معيّنة في منطقة زمنية
  public init(_ date: Date, in tz: TimeZone) {
    let comps = CivilDate.calendar(in: tz).dateComponents([.year, .month, .day], from: date)
    self.init(year: comps.year!, month: comps.month!, day: comps.day!)
  }
  /// منتصف ليل هذا اليوم بالتوقيت العالمي (لحظة)
  public var utcMidnight: Date { CivilDate.utcCalendar.date(from: DateComponents(year: year, month: month, day: day))! }
  /// يوم بعد n أيام (يتجاوز حدود الشهر والسنة)
  public func adding(days n: Int) -> CivilDate {
    let d = CivilDate.utcCalendar.date(byAdding: .day, value: n, to: utcMidnight)!
    return CivilDate(d, in: TimeZone(identifier: "UTC")!)
  }
  public var isLeapYear: Bool { year % 4 == 0 && (year % 100 != 0 || year % 400 == 0) }
  /// ترتيب اليوم في السنة (1..366)
  public var dayOfYear: Int {
    let months = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    var n = 0; if month > 1 { for i in 0..<(month - 1) { n += months[i] } }
    return n + day
  }
  /// لحظة الظهيرة المحلية (12:00 بتوقيت المنطقة) لهذا اليوم — للاستعلامات اليومية (رمضان، الهجري)
  public func localNoon(in tz: TimeZone) -> Date {
    CivilDate.calendar(in: tz).date(from: DateComponents(year: year, month: month, day: day, hour: 12))!
  }
  /// أول لحظة في اليوم المدني (00:00 محليًا، أو أول وقت صالح إن سقطت 00:00 في تحويل التوقيت الصيفي)
  public func localMidnight(in tz: TimeZone) -> Date {
    CivilDate.calendar(in: tz).date(from: DateComponents(year: year, month: month, day: day, hour: 0, minute: 0))!
  }
  /// تحويل ساعات UT (كسرية) إلى لحظة في هذا اليوم (كما في adhan: اقتطاع الثواني)؛ nil إن كانت القيمة غير محدودة
  public func utcDate(hours: Double) -> Date? {
    guard hours.isFinite else { return nil }
    let h = hours.rounded(.down)
    let min = ((hours - h) * 60).rounded(.down)
    let sec = ((hours - (h + min / 60)) * 3600).rounded(.down)
    return utcMidnight.addingTimeInterval(h * 3600 + min * 60 + sec)
  }
  /// عدد أيام الشهر
  public static func daysInMonth(year: Int, month: Int) -> Int {
    let first = CivilDate(year: year, month: month, day: 1).utcMidnight
    return utcCalendar.range(of: .day, in: .month, for: first)!.count
  }
  /// يوم الأسبوع (0 = الأحد) للحظة في منطقة زمنية
  public static func weekdayIndex(of date: Date, in tz: TimeZone) -> Int { calendar(in: tz).component(.weekday, from: date) - 1 }
}
