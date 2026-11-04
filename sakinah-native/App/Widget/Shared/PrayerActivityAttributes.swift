import Foundation
import ActivityKit

/// نشاط مباشر للصلاة القادمة (شاشة القفل والجزيرة الديناميكية) — الملف مشترك بين التطبيق وامتداد الودجت
/// (هدف التطبيق يبني مجلّد Widget/Shared كلّه في project.yml، وهدف الامتداد يبني مجلّد Widget كلّه)
struct PrayerActivityAttributes: ActivityAttributes {
  /// الحقول الجديدة (المرحلة ٣) اختيارية كي تُفكّ حالةٌ مرمَّزة من بناءٍ أقدم بلا فشل
  struct ContentState: Codable, Hashable {
    /// الصلاة القادمة: مفتاحها واسمها وموعد أذانها (نهاية العدّ التنازلي)
    var prayer: String
    var prayerName: String
    var time: Date
    var followingName: String?
    var followingTime: Date?
    /// بداية الوقت الحالي
    var startTime: Date?
    /// الوقت الحالي للعرض: «العصر»، و«الضحى» بين الشروق والظهر
    var currentName: String?
    /// الصلاة التي يسجّلها زرّ «صلّيتُ» (بين الشروق والظهر: الفجر) ويومها «yyyy-MM-dd» بتوقيت الموقع
    var prayedPrayer: String?
    var prayedName: String?
    var day: String?
    var prayed: Bool?
    /// أذكار الوقت: morning | evening | sleep وعنوانها
    var adhkarPeriod: String?
    var adhkarTitle: String?
    /// طور السماء (SkyPhase.rawValue) عند آخر تحديث من التطبيق
    var sky: String?
    /// شريط اليوم: مقطع الوقت الحالي (٠ الفجر … ٣ المغرب، ٤ العشاء إلى الفجر) وحدّاه
    var segment: Int?
    var segmentStart: Date?
    var segmentEnd: Date?
    /// الحرارة بالدرجة المئوية إن كانت مخزّنة في التطبيق وحديثة (لا شبكة من الامتداد)
    var temperature: Int?
    /// تفضيلات العرض من إعدادات التطبيق: latn | arab، ونظام ١٢ ساعة، ومنطقة الموقع الزمنية (قد تخالف الجهاز)
    var numerals: String?
    var hour12: Bool?
    var tz: String?
    /// طبعة رمضان (المرحلة الرابعة): العدّ إلى «الإفطار» نهارَ الصوم (prayer/time هما المغرب حينها)، ويوم الشهر،
    /// وصفحة «اقرأ حصّتك» (الصفحة التالية في الختمة أو آخر موضع قراءة)
    var iftar: Bool?
    var ramadanDay: Int?
    var readPage: Int?
  }
  var placeName: String
}

/// روابط التطبيق العميقة — تُبنى في الامتداد وتُفكّ في التطبيق (RootView.onOpenURL)؛ المخطّط مسجَّل في project.yml
enum SakinahURL {
  static let scheme = "sakinah"
  static var today: URL { URL(string: "sakinah://today")! }
  /// sakinah://adhkar/<morning|evening|sleep>
  static func adhkar(_ period: String) -> URL { URL(string: "sakinah://adhkar/\(period)") ?? today }
  /// sakinah://quran/<صفحة> — يفتح المصحف على الصفحة (٠ = آخر موضع قراءة)
  static func quran(_ page: Int) -> URL { URL(string: "sakinah://quran/\(page)") ?? today }
  /// sakinah://dua/<باب حصن المسلم> — يفتح الباب فوق التطبيق
  static func dua(_ chapter: Int) -> URL { URL(string: "sakinah://dua/\(chapter)") ?? today }
  /// باب «الدعاء عند إفطار الصائم» في حصن المسلم (زرّ «دعاء الإفطار» في النشاط المباشر وبطاقة «الآن»)
  static let iftarDuaChapter = 68

  enum Route { case today, adhkar(String), quran(Int), dua(Int) }
  static func route(_ url: URL) -> Route? {
    guard url.scheme?.lowercased() == scheme, let c = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return nil }
    let host = (c.host ?? "").lowercased()
    let first = c.path.split(separator: "/").first.map(String.init) ?? ""
    if host == "adhkar" {
      let known = ["morning", "evening", "sleep"].contains(first)
      return Route.adhkar(known ? first : "")
    }
    if host == "quran" { return Route.quran(Int(first) ?? 0) }
    if host == "dua", let id = Int(first) { return Route.dua(id) }
    return Route.today
  }
}

/// سجلّ «صلّيتُ» الخاص (بذرة سجلّ العبادات): مفتاح لكل صلاة في يومها في UserDefaults التطبيق
enum PrayedLog {
  static func key(day: String, prayer: String) -> String { "prayed.\(day).\(prayer)" }
}

/// أذكار الوقت بالقاعدة نفسها لبطاقة «الآن» في اليوم: الصباح من الفجر إلى الظهر، المساء من العصر إلى العشاء،
/// والنوم بعد العشاء حتى الفجر؛ وبين الظهر والعصر تُعرض أذكار المساء القادمة (upcoming)
enum AdhkarNowRule {
  static func period(now: Date, fajr: Date?, dhuhr: Date?, asr: Date?, isha: Date?) -> (period: String, upcoming: Bool)? {
    guard let fajr, let dhuhr, let asr else { return nil }
    if now >= fajr && now < dhuhr { return ("morning", false) }
    if now >= asr {
      if let isha, now >= isha { return ("sleep", false) }
      return ("evening", false)
    }
    if now < fajr { return ("sleep", false) }
    return ("evening", true)
  }
  static func title(_ period: String) -> String {
    switch period {
    case "morning": return "أذكار الصباح"
    case "evening": return "أذكار المساء"
    default: return "أذكار النوم"
    }
  }
}
