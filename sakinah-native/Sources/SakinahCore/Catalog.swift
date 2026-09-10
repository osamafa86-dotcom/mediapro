import Foundation

/// قارئ: المعرّف، الاسم، معدلات البت على Islamic Network، ومعرّف التلاوة في quran.com إن توفرت توقيتات الكلمات
public struct Reciter: Sendable, Hashable, Codable, Identifiable { public let id: String; public let name: String; public let bitrates: [Int]; public let qdc: Int?
  public var hasWordTiming: Bool { qdc != nil } }
/// سمة صفحة المصحف (ألوان hex)
public struct MushafTheme: Sendable, Hashable, Codable, Identifiable { public let id: String; public let name: String; public let group: String; public let paper: String; public let paper2: String; public let ink: String; public let gradient: String?
  public var isDark: Bool { group == "dark" } }
public struct ThemeGroup: Sendable, Hashable, Codable { public let id: String; public let name: String }
public struct TajweedLegendItem: Sendable, Hashable, Codable { public let code: String; public let name: String; public let key: String }
public struct TajweedCatalog: Sendable, Hashable, Codable { public let legend: [TajweedLegendItem]; public let groups: [String: [String]]; public let light: [String: String]; public let dark: [String: String] }
/// تحدّي قراءة: مدى صفحات ثابت (from/to) أو نسبي من موضع القراءة (span)
public struct Challenge: Sendable, Hashable, Codable, Identifiable { public let id: String; public let name: String; public let desc: String; public let from: Int?; public let to: Int?; public let days: Int; public let span: Int? }
public struct TasbihPhrase: Sendable, Hashable, Codable, Identifiable { public let id: String; public let text: String }
public struct TasbihCatalog: Sendable, Hashable, Codable { public let phrases: [TasbihPhrase]; public let targets: [Int] }
public struct TafsirSource: Sendable, Hashable, Codable, Identifiable { public let id: String; public let name: String; public let author: String?; public let short: String?; public let bundled: Bool? }

/// الكتالوج المشترك مع نسخة الويب (catalog.json): القرّاء، السمات، ألوان التجويد، التحدّيات، صيغ المسبحة، مصادر التفسير
public struct Catalog: Sendable, Decodable {
  public let reciters: [Reciter]
  public let defaultReciter: String
  public let qdcBase: String
  public let themes: [MushafTheme]
  public let themeGroups: [ThemeGroup]
  public let tajweed: TajweedCatalog
  public let challenges: [Challenge]
  public let minutesPerPage: Int
  public let tasbih: TasbihCatalog
  public let tafsirSources: [TafsirSource]

  public static let shared: Catalog = {
    let url = Bundle.module.url(forResource: "catalog", withExtension: "json", subdirectory: "Resources") ?? Bundle.module.url(forResource: "catalog", withExtension: "json")!
    return try! JSONDecoder().decode(Catalog.self, from: Data(contentsOf: url))
  }()
  public func reciter(_ id: String) -> Reciter { reciters.first { $0.id == id } ?? reciters[0] }
  public func theme(_ id: String) -> MushafTheme { themes.first { $0.id == id } ?? themes[0] }
  public func challenge(_ id: String) -> Challenge? { challenges.first { $0.id == id } }
  /// السمة الفعلية من إعدادات قديمة (night/paper) أو معرّف
  public func migrateTheme(theme: String?, night: Bool, paper: String?) -> String {
    if let t = theme, themes.contains(where: { $0.id == t }) { return t }
    if night { return "dark" }
    return paper == "white" ? "white" : "cream"
  }
}

/// لون hex (#rrggbb) → مكوّنات 0..1 (للواجهات)
public struct HexColor: Sendable, Hashable { public let r: Double, g: Double, b: Double
  public init?(_ hex: String) {
    var h = hex.trimmingCharacters(in: .whitespaces); if h.hasPrefix("#") { h.removeFirst() }
    guard h.count == 6, let v = UInt32(h, radix: 16) else { return nil }
    r = Double((v >> 16) & 255) / 255; g = Double((v >> 8) & 255) / 255; b = Double(v & 255) / 255
  }
  /// نسبة التباين (WCAG)
  public static func contrast(_ a: HexColor, _ b: HexColor) -> Double {
    func lum(_ c: HexColor) -> Double { let f = { (v: Double) in v <= 0.03928 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b) }
    let l1 = lum(a), l2 = lum(b); return (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)
  }
}
