import Foundation

/// تصدير المواقيت إلى تقويم iCalendar (ICS) — مطابق لـ buildICS في notifications.js
public enum ICS {
  static let stampFormatter: DateFormatter = { let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = TimeZone(identifier: "UTC"); f.dateFormat = "yyyyMMdd'T'HHmmss'Z'"; return f }()
  public static func date(_ d: Date) -> String { stampFormatter.string(from: d) }
  public static func escape(_ s: String) -> String {
    s.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: ";", with: "\\;").replacingOccurrences(of: ",", with: "\\,").replacingOccurrences(of: "\n", with: "\\n")
  }
  /// طيّ السطور الأطول من 75 بايت (RFC 5545) دون قطع حرف متعدد البايتات
  public static func fold(_ line: String) -> String {
    var out: [String] = []; var cur = ""; var bytes = 0
    for ch in line {
      let b = ch.utf8.count
      if bytes + b > 75 { out.append(cur); cur = " "; bytes = 1 }
      cur.append(ch); bytes += b
    }
    out.append(cur); return out.joined(separator: "\r\n")
  }
  public struct Options: Sendable { public var locationName: String? = nil; public var prayers: Set<Prayer> = Set(Prayer.allCases); public var preMinutes: Int = 0; public var includeSunrise = false; public init() {} }

  /// أيام من PrayerTimes.compute
  public static func build(days: [PrayerTimesResult], options: Options = Options(), now: Date = Date()) -> String {
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sakinah//Prayer Times//AR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:مواقيت الصلاة — سكينة"]
    let stamp = date(now)
    for day in days {
      for key in Prayer.allCases {
        guard options.prayers.contains(key) else { continue }
        if key == .sunrise && !options.includeSunrise { continue }
        guard let t = day[key] else { continue }
        let name = key == .sunrise ? "الشروق" : "صلاة \(key.nameAr)"
        let uid = "\(date(t))-\(key.rawValue)@sakinah"
        lines += ["BEGIN:VEVENT", "UID:\(uid)", "DTSTAMP:\(stamp)", "DTSTART:\(date(t))", "DTEND:\(date(t.addingTimeInterval(600)))",
                  "SUMMARY:\(escape(name))", "DESCRIPTION:\(escape("\(name)\(options.locationName.map { " — \($0)" } ?? "")\nمن تطبيق سكينة"))", "TRANSP:TRANSPARENT"]
        if key != .sunrise {
          lines += ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:\(escape(name))", "TRIGGER:PT0M", "END:VALARM"]
          if options.preMinutes > 0 { lines += ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:\(escape("اقترب موعد \(name)"))", "TRIGGER:-PT\(options.preMinutes)M", "END:VALARM"] }
        }
        lines.append("END:VEVENT")
      }
    }
    lines.append("END:VCALENDAR")
    return lines.map(fold).joined(separator: "\r\n") + "\r\n"
  }
}
