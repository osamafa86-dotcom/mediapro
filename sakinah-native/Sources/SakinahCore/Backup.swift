import Foundation

/// النسخة الاحتياطية بصيغة نسخة الويب نفسها ({ app: 'sakinah', schema: 1, exportedAt, settings }) — كل الحقول اختيارية لتقبل أي نسخة قديمة
public struct WebBackup: Codable, Sendable {
  public var app: String = "sakinah"
  public var schema: Int = 1
  public var exportedAt: String?
  public var settings: WebSettings
  public init(settings: WebSettings, exportedAt: Date = Date()) { self.settings = settings; self.exportedAt = ISO8601DateFormatter().string(from: exportedAt) }

  /// قراءة نسخة: الصيغة الكاملة أو كائن الإعدادات مباشرة
  public static func parse(_ data: Data) throws -> WebBackup {
    let dec = JSONDecoder()
    if let b = try? dec.decode(WebBackup.self, from: data), b.app == "sakinah" { return b }
    let s = try dec.decode(WebSettings.self, from: data)
    guard s.location != nil || s.quran != nil || s.method != nil else { throw BackupError.notSakinah }
    return WebBackup(settings: s)
  }
  public func encoded() throws -> Data { let e = JSONEncoder(); e.outputFormatting = [.prettyPrinted, .sortedKeys]; return try e.encode(self) }
}
public enum BackupError: Error { case notSakinah }

public struct WebSettings: Codable, Sendable {
  public struct Location: Codable, Sendable { public var lat: Double?; public var lon: Double?; public var tz: String?; public var name: String?; public var countryCode: String?; public var cityId: String?; public var source: String?
    public init(lat: Double?, lon: Double?, tz: String?, name: String?, countryCode: String?, cityId: String?, source: String?) { self.lat = lat; self.lon = lon; self.tz = tz; self.name = name; self.countryCode = countryCode; self.cityId = cityId; self.source = source } }
  public struct Notifications: Codable, Sendable {
    public struct AdhkarPrefs: Codable, Sendable { public var morning: Bool?; public var evening: Bool?; public var morningAfter: Int?; public var eveningAfter: Int?
      public init(morning: Bool?, evening: Bool?, morningAfter: Int?, eveningAfter: Int?) { self.morning = morning; self.evening = evening; self.morningAfter = morningAfter; self.eveningAfter = eveningAfter } }
    public struct HadithDaily: Codable, Sendable { public var enabled: Bool?; public var time: String?; public init(enabled: Bool?, time: String?) { self.enabled = enabled; self.time = time } }
    public var enabled: Bool?; public var prayers: [String: Bool]?; public var preMinutes: Int?; public var sound: String?; public var vibrate: Bool?
    public var adhkar: AdhkarPrefs?; public var hadithDaily: HadithDaily?
    public init() {}
  }
  public struct LastRead: Codable, Sendable { public var page: Int; public var surah: Int?; public var ayah: Int?; public var at: Double?; public init(page: Int, surah: Int?, ayah: Int?, at: Double?) { self.page = page; self.surah = surah; self.ayah = ayah; self.at = at } }
  public struct Bookmark: Codable, Sendable, Hashable { public var surah: Int; public var ayah: Int; public var page: Int?; public var at: Double?; public var note: String?; public var color: String?
    public init(surah: Int, ayah: Int, page: Int?, at: Double?, note: String?, color: String?) { self.surah = surah; self.ayah = ayah; self.page = page; self.at = at; self.note = note; self.color = color } }
  public struct Quran: Codable, Sendable {
    public var lastRead: LastRead?; public var bookmarks: [Bookmark]?
    public var reciter: String?; public var repeatAyah: Int?; public var repeatRange: Bool?; public var rate: Double?; public var follow: Bool?
    public var fontScale: Double?; public var hifzOnlyCurrent: Bool?; public var theme: String?; public var themeLight: String?; public var themeDark: String?; public var themeAuto: Bool?
    public var night: Bool?; public var paper: String?
    public var dim: Double?; public var keepAwake: Bool?; public var lineHeight: Double?; public var tajweed: Bool?; public var scroll: String?; public var textFont: String?; public var fitText: Bool?
    public var challenge: ActiveChallenge?; public var tafsir: String?; public var view: String?; public var wordHighlight: Bool?
    public var khatmah: KhatmahPlan?; public var readLog: ReadLog?
    public init() {}
  }
  public struct AdhkarProgress: Codable, Sendable { public var date: String?; public var morning: [String: Int]?; public var evening: [String: Int]?; public var eveningDate: String?
    public init(date: String?, morning: [String: Int]?, evening: [String: Int]?, eveningDate: String?) { self.date = date; self.morning = morning; self.evening = evening; self.eveningDate = eveningDate } }

  public var location: Location?
  public var method: String?
  public var madhab: String?
  public var highLatitudeRule: String?
  public var hijriOffset: Int?
  public var hour12: Bool?
  public var numerals: String?
  public var theme: String?
  public var notifications: Notifications?
  public var quran: Quran?
  public var adhkarProgress: AdhkarProgress?
  public var favorites: [String]?
  public var tasbih: TasbihState?
  public var hisnFavorites: [Int]?
  public var shareTheme: String?
  public var textScale: Double?
  public init() {}
}
