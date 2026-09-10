import Foundation

/// إعدادات تذكيرات الصلاة — مطابقة لإعدادات نسخة الويب (notifications في storage.js)
public struct ReminderPrefs: Sendable, Hashable, Codable {
  public var enabled: Bool = false
  public var prayers: Set<Prayer> = [.fajr, .dhuhr, .asr, .maghrib, .isha]
  /// تذكير قبل الأذان بدقائق (0 = عند الأذان فقط)
  public var preMinutes: Int = 0
  /// none | chime | adhan-fakhry | adhan-azeez
  public var sound: String = "chime"
  public init() {}
  public var usesAdhanSound: Bool { sound.hasPrefix("adhan") }
}

public enum ReminderKind: String, Sendable, Codable { case adhan, pre, sunrise }

/// تذكير واحد بلحظته ونصّه
public struct Reminder: Sendable, Hashable, Codable, Identifiable {
  public let id: String
  public let time: Date
  public let kind: ReminderKind
  public let prayer: Prayer?
  public let title: String
  public let body: String
}

public enum Reminders {
  /// المعرّف الثابت (كما في التطبيق الهجيني): أيام منذ 2020-01-01 × 100 + ترتيب الصلاة × 10 + النوع
  public static func numericId(_ r: Reminder) -> Int {
    let day = Int((r.time.timeIntervalSince1970 - 1_577_836_800) / 86400)
    let idx = r.prayer.map { Prayer.allCases.firstIndex(of: $0)! + 1 } ?? 9
    let kind = r.kind == .adhan ? 0 : (r.kind == .pre ? 1 : 2)
    return day * 100 + idx * 10 + kind
  }

  /// تذكيرات يوم واحد من جدول المواقيت
  public static func build(times: PrayerTimesResult, prefs: ReminderPrefs, dateKey: String, format: (Date) -> String, number: (Int) -> String = { String($0) }) -> [Reminder] {
    var out: [Reminder] = []
    for key in Prayer.allCases {
      guard prefs.prayers.contains(key), let t = times[key] else { continue }
      let name = key.nameAr
      if key == .sunrise {
        out.append(Reminder(id: "\(dateKey):sunrise", time: t, kind: .sunrise, prayer: .sunrise, title: "طلوع الشمس", body: "طلعت الشمس (\(format(t))) — انتهى وقت الفجر"))
      } else {
        out.append(Reminder(id: "\(dateKey):\(key.rawValue)", time: t, kind: .adhan, prayer: key, title: "حان الآن موعد صلاة \(name)", body: "\(name) — \(format(t))"))
        if prefs.preMinutes > 0 {
          out.append(Reminder(id: "\(dateKey):\(key.rawValue):pre", time: t.addingTimeInterval(-Double(prefs.preMinutes) * 60), kind: .pre, prayer: key,
                              title: "اقترب موعد صلاة \(name)", body: "بقي \(number(prefs.preMinutes)) دقيقة على الأذان (\(format(t)))"))
        }
      }
    }
    return out
  }

  /// أقرب `max` تذكيرًا مستقبليًا (iOS يسمح بـ 64 إشعارًا معلّقًا) عبر الأيام القادمة
  public static func upcoming(coords: Coordinates, tz: TimeZone, params: PrayerParams, prefs: ReminderPrefs, now: Date = Date(), max: Int = 60, days: Int = 14,
                              format: (Date) -> String, number: (Int) -> String = { String($0) }) -> [Reminder] {
    guard prefs.enabled, !prefs.prayers.isEmpty else { return [] }
    var p = params; p.tz = tz.identifier
    var all: [Reminder] = []
    let start = CivilDate(now, in: tz)
    for i in 0..<days {
      let d = start.adding(days: i)
      let times = PrayerTimes.compute(coords: coords, date: d, params: p)
      all += build(times: times, prefs: prefs, dateKey: "\(d.year)-\(d.month)-\(d.day)", format: format, number: number)
      if all.filter({ $0.time > now.addingTimeInterval(15) }).count >= max { break }
    }
    return Array(all.filter { $0.time > now.addingTimeInterval(15) }.sorted { $0.time < $1.time }.prefix(max))
  }
}
