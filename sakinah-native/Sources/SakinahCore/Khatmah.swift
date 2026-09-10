import Foundation

/// مفاتيح الأيام «YYYY-MM-DD» وحساب الأيام بينها (تقويم ميلادي صرف كما في الويب)
public enum DayKey {
  /// أيام منذ 1970-01-01 (خوارزمية Howard Hinnant)
  public static func daysFromCivil(_ y0: Int, _ m: Int, _ d: Int) -> Int {
    let y = m <= 2 ? y0 - 1 : y0
    let era = (y >= 0 ? y : y - 399) / 400
    let yoe = y - era * 400
    let doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
    return era * 146097 + doe - 719468
  }
  public static func civilFromDays(_ z0: Int) -> (year: Int, month: Int, day: Int) {
    let z = z0 + 719468
    let era = (z >= 0 ? z : z - 146096) / 146097
    let doe = z - era * 146097
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365
    let y = yoe + era * 400
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
    let mp = (5 * doy + 2) / 153
    let d = doy - (153 * mp + 2) / 5 + 1
    let m = mp + (mp < 10 ? 3 : -9)
    return (m <= 2 ? y + 1 : y, m, d)
  }
  public static func parse(_ key: String) -> (year: Int, month: Int, day: Int)? {
    let p = key.split(separator: "-").compactMap { Int($0) }; guard p.count == 3 else { return nil }; return (p[0], p[1], p[2])
  }
  public static func key(_ y: Int, _ m: Int, _ d: Int) -> String { String(format: "%04d-%02d-%02d", y, m, d) }
  public static func key(_ date: Date, tz: TimeZone) -> String { let c = CivilDate(date, in: tz); return key(c.year, c.month, c.day) }
  public static func daysBetween(_ a: String, _ b: String) -> Int {
    guard let x = parse(a), let y = parse(b) else { return 0 }
    return daysFromCivil(y.year, y.month, y.day) - daysFromCivil(x.year, x.month, x.day)
  }
  public static func adding(_ key: String, days n: Int) -> String {
    guard let p = parse(key) else { return key }
    let c = civilFromDays(daysFromCivil(p.year, p.month, p.day) + n); return self.key(c.year, c.month, c.day)
  }
}

/// سجل القراءة: { 'YYYY-MM-DD': [صفحات فريدة قُرئت في اليوم] }
public typealias ReadLog = [String: [Int]]

/// خطة الختمة: نقطة البداية، تاريخ البدء، المدة، الورد اليومي، وتذكير اختياري «HH:MM»
public struct KhatmahPlan: Sendable, Hashable, Codable {
  public var startPage: Int; public var startedAt: String; public var days: Int; public var dailyPages: Int; public var reminder: String?
  public init(startPage: Int = 1, startedAt: String, days: Int = 30, reminder: String? = nil) {
    let d = max(1, min(604, days))
    self.startPage = max(1, min(Khatmah.total, startPage)); self.startedAt = startedAt; self.days = d; self.dailyPages = Int((Double(Khatmah.total) / Double(d)).rounded(.up)); self.reminder = reminder
  }
}
public struct KhatmahStatus: Sendable, Hashable, Codable {
  public let done: Int, remaining: Int, percent: Int, dayIndex: Int, expected: Int, behind: Int, todayPages: Int, todayTarget: Int, daysLeft: Int, neededPerDay: Int
  public let etaKey: String
  public let finished: Bool
}
public struct ReadStats: Sendable, Hashable, Codable { public let week: Int; public let month: Int; public let avgDay: Double }

public enum Khatmah {
  public static let total = 604
  /// الصفحات المقطوعة من بداية الخطة حتى الصفحة الحالية (مع الالتفاف عند 604)
  public static func pagesDone(_ plan: KhatmahPlan, currentPage: Int) -> Int {
    guard currentPage > 0 else { return 0 }
    return ((currentPage - plan.startPage) % total + total) % total
  }
  public static func status(_ plan: KhatmahPlan, currentPage: Int, log: ReadLog, today: String) -> KhatmahStatus {
    let done = pagesDone(plan, currentPage: currentPage)
    let dayIndex = max(0, DayKey.daysBetween(plan.startedAt, today))
    let expected = min(total, (dayIndex + 1) * plan.dailyPages)
    let todayPages = log[today]?.count ?? 0
    let remaining = total - done
    let behind = max(0, expected - done)
    let daysLeft = max(0, plan.days - dayIndex)
    let neededPerDay = daysLeft > 0 ? Int((Double(remaining) / Double(daysLeft)).rounded(.up)) : remaining
    let etaKey = DayKey.adding(today, days: max(0, Int((Double(remaining) / Double(max(1, plan.dailyPages))).rounded(.up))))
    return KhatmahStatus(done: done, remaining: remaining, percent: Int((Double(done) / Double(total) * 100).rounded()), dayIndex: dayIndex, expected: expected, behind: behind, todayPages: todayPages,
                         todayTarget: min(plan.dailyPages + behind, remaining), daysLeft: daysLeft, neededPerDay: neededPerDay, etaKey: etaKey, finished: done >= total - 1 && currentPage == total)
  }
  /// سلسلة الأيام المتتالية (حتى اليوم أو الأمس) التي قُرئت فيها صفحة على الأقل
  public static func streak(_ log: ReadLog, today: String) -> Int {
    var n = 0; var key = today
    if (log[key]?.isEmpty ?? true) { key = DayKey.adding(key, days: -1) }
    while let pages = log[key], !pages.isEmpty { n += 1; key = DayKey.adding(key, days: -1) }
    return n
  }
  /// تسجيل صفحة في سجل اليوم (بلا تكرار)، مع تقليم السجل إلى 400 يوم
  public static func log(_ log: ReadLog, today: String, page: Int) -> ReadLog {
    var out = log
    var set = Set(out[today] ?? []); set.insert(page); out[today] = set.sorted()
    let keys = out.keys.sorted(); if keys.count > 400 { for k in keys.prefix(keys.count - 400) { out.removeValue(forKey: k) } }
    return out
  }
  /// صفحات آخر 7 و30 يومًا ومتوسط يومي (منزلة عشرية واحدة)
  public static func stats(_ log: ReadLog, today: String) -> ReadStats {
    var w = 0, m = 0
    for i in 0..<30 { let n = log[DayKey.adding(today, days: -i)]?.count ?? 0; m += n; if i < 7 { w += n } }
    return ReadStats(week: w, month: m, avgDay: (Double(m) / 30 * 10).rounded() / 10)
  }
}

/// تحدّي نشط كما يُحفظ: { id, startedAt, startPage, from, to }
public struct ActiveChallenge: Sendable, Hashable, Codable { public var id: String; public var startedAt: String; public var startPage: Int; public var from: Int; public var to: Int
  public init(id: String, startedAt: String, startPage: Int, from: Int, to: Int) { self.id = id; self.startedAt = startedAt; self.startPage = startPage; self.from = from; self.to = to } }
public struct ChallengeProgress: Sendable, Hashable, Codable {
  public let id: String, name: String, from: Int, to: Int, total: Int, done: Int, pct: Int, dayIndex: Int, daysLeft: Int
  public let finished: Bool, late: Bool
  public let minutesLeft: Int
}
public struct HeatDay: Sendable, Hashable, Codable { public let key: String; public let count: Int }

public enum Challenges {
  public static var all: [Challenge] { Catalog.shared.challenges }
  public static func estimateMinutes(_ pages: Int) -> Int { pages * Catalog.shared.minutesPerPage }
  /// يثبّت مدى تحدٍّ نسبي (من موضع القراءة الحالي)
  public static func resolveRange(_ ch: Challenge, startPage: Int = 1) -> (from: Int, to: Int) {
    if let f = ch.from, let t = ch.to { return (f, t) }
    let from = max(1, min(604, startPage)); return (from, min(604, from + (ch.span ?? 20) - 1))
  }
  public static func progress(_ active: ActiveChallenge?, log: ReadLog, today: String) -> ChallengeProgress? {
    guard let active, let ch = Catalog.shared.challenge(active.id) else { return nil }
    let from = active.from, to = active.to
    let total = to - from + 1
    var done = Set<Int>()
    for (key, pages) in log where key >= active.startedAt { for p in pages where p >= from && p <= to { done.insert(p) } }
    let dayIndex = max(0, DayKey.daysBetween(active.startedAt, today))
    let daysLeft = max(0, ch.days - dayIndex - 1)
    let finished = done.count >= total
    return ChallengeProgress(id: ch.id, name: ch.name, from: from, to: to, total: total, done: done.count, pct: Int((Double(done.count) / Double(total) * 100).rounded()), dayIndex: dayIndex, daysLeft: daysLeft,
                             finished: finished, late: !finished && dayIndex >= ch.days, minutesLeft: estimateMinutes(total - done.count))
  }
  /// خريطة حرارة آخر `days` يومًا من الأقدم إلى الأحدث
  public static func heatmap(_ log: ReadLog, today: String, days: Int = 90) -> [HeatDay] {
    (0..<days).reversed().map { i in let k = DayKey.adding(today, days: -i); return HeatDay(key: k, count: log[k]?.count ?? 0) }
  }
}
