import Foundation
import SakinahCore

/// تنسيقات عربية للوقت والتاريخ والأرقام
enum Fmt {
  static func locale(numerals: String) -> Locale { Locale(identifier: numerals == "arab" ? "ar_SA@numbers=arab" : "ar_SA@numbers=latn") }

  static func time(_ date: Date?, tz: TimeZone, hour12: Bool, numerals: String) -> String {
    guard let date else { return "—" }
    let f = DateFormatter()
    f.locale = locale(numerals: numerals)
    f.timeZone = tz
    f.dateFormat = hour12 ? "h:mm a" : "HH:mm"
    return f.string(from: date)
  }

  static func gregorian(_ date: Date, tz: TimeZone, numerals: String) -> String {
    let f = DateFormatter()
    f.locale = locale(numerals: numerals)
    f.timeZone = tz
    f.dateFormat = "EEEE، d MMMM yyyy"
    return f.string(from: date)
  }

  static func number(_ n: Int, numerals: String) -> String {
    let f = NumberFormatter(); f.locale = locale(numerals: numerals); f.numberStyle = .decimal; f.usesGroupingSeparator = false
    return f.string(from: NSNumber(value: n)) ?? String(n)
  }

  static func decimal(_ v: Double, digits: Int, numerals: String) -> String {
    let f = NumberFormatter(); f.locale = locale(numerals: numerals); f.maximumFractionDigits = digits; f.minimumFractionDigits = 0
    return f.string(from: NSNumber(value: v)) ?? String(v)
  }
  /// تاريخ مختصر «١٠ سبتمبر»
  static func shortDate(_ date: Date, tz: TimeZone, numerals: String) -> String {
    let f = DateFormatter(); f.locale = locale(numerals: numerals); f.timeZone = tz; f.dateFormat = "d MMMM"; return f.string(from: date)
  }
  static func shortDate(key: String, numerals: String) -> String {
    guard let p = DayKey.parse(key) else { return key }
    var c = DateComponents(); c.year = p.year; c.month = p.month; c.day = p.day; c.timeZone = TimeZone(identifier: "UTC")
    let cal = Calendar(identifier: .gregorian); guard let d = cal.date(from: c) else { return key }
    return shortDate(d, tz: TimeZone(identifier: "UTC")!, numerals: numerals)
  }

  static func countdown(_ seconds: TimeInterval, numerals: String) -> String {
    let s = max(0, Int(seconds))
    let h = s / 3600, m = (s % 3600) / 60, sec = s % 60
    let two = { (v: Int) -> String in let t = number(v, numerals: numerals); return v < 10 ? number(0, numerals: numerals) + t : t }
    return h > 0 ? "\(number(h, numerals: numerals)):\(two(m)):\(two(sec))" : "\(two(m)):\(two(sec))"
  }

  static func distance(_ km: Double, numerals: String) -> String {
    let f = NumberFormatter(); f.locale = locale(numerals: numerals); f.maximumFractionDigits = km < 100 ? 1 : 0
    return (f.string(from: NSNumber(value: km)) ?? "\(km)") + " كم"
  }

  static func degrees(_ deg: Double, numerals: String) -> String {
    let f = NumberFormatter(); f.locale = locale(numerals: numerals); f.maximumFractionDigits = 1
    return (f.string(from: NSNumber(value: deg)) ?? "\(deg)") + "°"
  }
}
