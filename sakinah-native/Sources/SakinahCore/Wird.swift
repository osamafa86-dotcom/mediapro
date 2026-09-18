import Foundation

// MARK: - الورد بتقدّم الموضع (لا بمشاهدة الصفحة)
//
// سجلّ الورد: { "YYYY-MM-DD": عدد الصفحات المقطوعة من بداية الخطة حتى آخر ذلك اليوم }.
// يتقدّم فقط حين يقرأ المرء متتابعًا من موضع الخطة (قفزة ≤ ٣ صفحات)؛ القفز إلى الكهف يوم الجمعة
// أو التصفّح لا يُحتسب وردًا — وهو ما طلبته مراجعة المنتج: «الورد يُحتسب بتقدّم الموضع داخل الخطة».

public typealias WirdLog = [String: Int]

public enum Wird {
  public static let maxStep = 3
  /// فهرس الصفحة داخل الخطة (٠ = صفحة البداية) مع الالتفاف عند ٦٠٤
  public static func index(of page: Int, startPage: Int) -> Int { ((page - startPage) % Khatmah.total + Khatmah.total) % Khatmah.total }
  /// أبعد ما بلغته الخطة حتى الآن (عدد الصفحات المقطوعة)
  public static func done(_ log: WirdLog) -> Int { log.values.max() ?? 0 }
  /// تسجيل بلوغ صفحة: يتقدّم السجلّ إن كانت الصفحة تالية لموضع الخطة (أو بعده بثلاث على الأكثر)
  public static func mark(_ log: WirdLog, today: String, page: Int, startPage: Int) -> WirdLog {
    let idx = index(of: page, startPage: startPage) + 1   // عدد الصفحات المقطوعة لو بلغنا هذه الصفحة
    let last = done(log)
    guard idx > last, idx - last <= maxStep + 1 else { return log }
    var out = log
    out[today] = max(out[today] ?? 0, idx)
    let keys = out.keys.sorted(); if keys.count > 400 { for k in keys.prefix(keys.count - 400) { out.removeValue(forKey: k) } }
    return out
  }
  /// صفحات يومٍ بعينه = أبعد ذلك اليوم − أبعد آخر يومٍ مسجّل قبله
  public static func pages(_ log: WirdLog, day: String) -> Int {
    guard let d = log[day] else { return 0 }
    let before = log.filter { $0.key < day }.values.max() ?? 0
    return max(0, d - before)
  }
  public struct Commitment: Sendable, Hashable { public let done: Int; public let total: Int; public let days: [Bool] }
  /// آخر N أيام (من الأقدم إلى اليوم): اليوم ملتزَم إن بلغ ورده الهدف
  public static func commitment(_ log: WirdLog, today: String, target: Int, days n: Int = 14) -> Commitment {
    var flags: [Bool] = []
    for i in stride(from: n - 1, through: 0, by: -1) { let k = DayKey.adding(today, days: -i); flags.append(pages(log, day: k) >= max(1, target)) }
    return Commitment(done: flags.filter { $0 }.count, total: n, days: flags)
  }
}

public extension Khatmah {
  /// حالة الخطة من سجلّ الورد (تقدّم الموضع) بدل آخر صفحة مفتوحة
  static func status(_ plan: KhatmahPlan, wird: WirdLog, today: String) -> KhatmahStatus {
    let done = min(total, Wird.done(wird))
    let dayIndex = max(0, DayKey.daysBetween(plan.startedAt, today))
    let expected = min(total, (dayIndex + 1) * plan.dailyPages)
    let todayPages = Wird.pages(wird, day: today)
    let remaining = total - done
    let behind = max(0, expected - done)
    let daysLeft = max(0, plan.days - dayIndex)
    let neededPerDay = daysLeft > 0 ? Int((Double(remaining) / Double(daysLeft)).rounded(.up)) : remaining
    let etaKey = DayKey.adding(today, days: max(0, Int((Double(remaining) / Double(max(1, plan.dailyPages))).rounded(.up))))
    return KhatmahStatus(done: done, remaining: remaining, percent: Int((Double(done) / Double(total) * 100).rounded()), dayIndex: dayIndex, expected: expected, behind: behind,
                         todayPages: todayPages, todayTarget: min(plan.dailyPages + behind, remaining), daysLeft: daysLeft, neededPerDay: neededPerDay, etaKey: etaKey, finished: done >= total)
  }
  /// أيام الخطة لوحدة الورد: صفحة (٣٠ يومًا افتراضيًا تبقى كما هي)، حزب = ٦٠ يومًا، جزء = ٣٠ يومًا
  static func days(forUnit unit: String, fallback: Int = 30) -> Int { switch unit { case "hizb": return 60; case "juz": return 30; default: return fallback } }
}

// MARK: - أوراد مسنونة (بدل «التحدّيات»): بلا مؤقّت ولا حالة تأخّر
public struct SunnahWird: Sendable, Hashable, Identifiable {
  public enum Window: String, Sendable { case fridayEve, nightly, free }
  public let id: String; public let name: String; public let desc: String; public let from: Int; public let to: Int; public let window: Window; public let reminderAfter: Prayer?
  public var pages: Int { to - from + 1 }
}

public enum Awrad {
  public static let all: [SunnahWird] = [
    SunnahWird(id: "kahf", name: "سورة الكهف", desc: "من مغرب الخميس إلى مغرب الجمعة", from: 293, to: 304, window: .fridayEve, reminderAfter: nil),
    SunnahWird(id: "mulk", name: "سورة الملك بعد العشاء", desc: "كل ليلة", from: 562, to: 564, window: .nightly, reminderAfter: .isha),
    SunnahWird(id: "amma", name: "جزء عمّ", desc: "على مهلك", from: 582, to: 604, window: .free, reminderAfter: nil),
  ]
  public static func wird(_ id: String) -> SunnahWird? { all.first { $0.id == id } }
  /// أيام نافذة الكهف الشرعية (مغرب الخميس → مغرب الجمعة) إن كنّا داخلها، وإلا nil.
  /// `weekdayIndex`: ٠ الأحد … ٤ الخميس، ٥ الجمعة. `maghribPassed`: هل مضى مغرب اليوم.
  public static func kahfDays(today: String, weekdayIndex: Int, maghribPassed: Bool) -> [String]? {
    if weekdayIndex == 4 && maghribPassed { return [today, DayKey.adding(today, days: 1)] }
    if weekdayIndex == 5 && !maghribPassed { return [DayKey.adding(today, days: -1), today] }
    return nil
  }
  /// الأيام التي يُحتسب فيها ورد بعينه اليوم
  public static func days(for w: SunnahWird, today: String, weekdayIndex: Int, maghribPassed: Bool) -> [String] {
    switch w.window {
    case .fridayEve: return kahfDays(today: today, weekdayIndex: weekdayIndex, maghribPassed: maghribPassed) ?? []
    case .nightly: return [today]
    case .free: return (0..<30).map { DayKey.adding(today, days: -$0) }
    }
  }
  /// الصفحات المقروءة من نطاق الورد في تلك الأيام
  public static func progress(_ w: SunnahWird, log: ReadLog, days: [String]) -> (done: Int, total: Int) {
    var set = Set<Int>()
    for d in days { for p in log[d] ?? [] where p >= w.from && p <= w.to { set.insert(p) } }
    return (set.count, w.pages)
  }
}

// MARK: - أوائل الأجزاء والأرباع من المتن
public extension QuranText {
  /// أوّل كلمتين من الآية التي يبدأ بها الجزء (بلا علامة ۞)، من المتن لا من عرفٍ مكتوب — الجزء الأول «الفاتحة»
  func juzStartPhrase(_ j: Int, words n: Int = 2) -> String {
    guard (1...30).contains(j) else { return "" }
    let s = QuranMeta.juzStarts[j - 1]
    if s.surah == 1 { return "الفاتحة" }
    guard let a = ayah(surah: s.surah, ayah: s.ayah) else { return "" }
    let ws = a.text.split(separator: " ").map(String.init).filter { $0 != "۞" }
    return ws.prefix(n).joined(separator: " ")
  }
  /// صفحة بداية الربع (١…٢٤٠) وموضعه
  func quarterStart(_ q: Int) -> Ayah? { ayahs.first { $0.hizbQuarter == q } }
  /// أرباع حزبٍ (٤ أرباع) بآياتها الأولى
  func quarters(ofHizb h: Int) -> [Ayah] { (1...4).compactMap { quarterStart((h - 1) * 4 + $0) } }
}

public extension Hijri {
  /// عدد الأيام من اليوم حتى آخر يومٍ في رمضان القادم (أو الجاري) — لخطة «حتى آخر رمضان»
  static func daysUntilEndOfRamadan(from date: Date = Date(), tz: TimeZone, offsetDays: Int = 0) -> Int {
    var d = date; var n = 0; var seen = false
    while n < 400 {
      let h = Hijri.date(d, tz: tz, offsetDays: offsetDays)
      if h.month == 9 { seen = true } else if seen { return n }
      d = d.addingTimeInterval(86_400); n += 1
    }
    return n
  }
}
