import Foundation
import Observation
import SakinahCore

/// حفظ/قراءة قيم Codable في UserDefaults
enum Store {
  static let d = UserDefaults.standard
  static func load<T: Decodable>(_ key: String, _ def: T) -> T { d.data(forKey: key).flatMap { try? JSONDecoder().decode(T.self, from: $0) } ?? def }
  static func save<T: Encodable>(_ v: T?, _ key: String) { if let v, let data = try? JSONEncoder().encode(v) { d.set(data, forKey: key) } else { d.removeObject(forKey: key) } }
  static func str(_ key: String, _ def: String) -> String { d.string(forKey: key) ?? def }
  static func bool(_ key: String, _ def: Bool) -> Bool { d.object(forKey: key) as? Bool ?? def }
  static func int(_ key: String, _ def: Int) -> Int { d.object(forKey: key) as? Int ?? def }
  static func dbl(_ key: String, _ def: Double) -> Double { d.object(forKey: key) as? Double ?? def }
}

/// إعدادات المصحف والتلاوة (المفاتيح بمعاني نسخة الويب quran.* كي تُستورد النسخة الاحتياطية وتُصدَّر)
@Observable
final class QuranPrefs {
  var reciter: String { didSet { Store.d.set(reciter, forKey: "quran.reciter") } }
  var repeatAyah: Int { didSet { Store.d.set(repeatAyah, forKey: "quran.repeatAyah") } }
  var repeatRange: Bool { didSet { Store.d.set(repeatRange, forKey: "quran.repeatRange") } }
  var rate: Double { didSet { Store.d.set(rate, forKey: "quran.rate") } }
  var follow: Bool { didSet { Store.d.set(follow, forKey: "quran.follow") } }
  var wordHighlight: Bool { didSet { Store.d.set(wordHighlight, forKey: "quran.wordHighlight") } }
  var fontScale: Double { didSet { Store.d.set(fontScale, forKey: "quran.fontScale") } }
  var lineHeight: Double { didSet { Store.d.set(lineHeight, forKey: "quran.lineHeight") } }
  var hifzOnlyCurrent: Bool { didSet { Store.d.set(hifzOnlyCurrent, forKey: "quran.hifzOnlyCurrent") } }
  var theme: String { didSet { Store.d.set(theme, forKey: "quran.theme") } }
  var themeLight: String { didSet { Store.d.set(themeLight, forKey: "quran.themeLight") } }
  var themeDark: String { didSet { Store.d.set(themeDark, forKey: "quran.themeDark") } }
  var themeAuto: Bool { didSet { Store.d.set(themeAuto, forKey: "quran.themeAuto") } }
  var dim: Double { didSet { Store.d.set(dim, forKey: "quran.dim") } }
  var keepAwake: Bool { didSet { Store.d.set(keepAwake, forKey: "quran.keepAwake") } }
  /// عُرض تلميح إظهار شريطي القارئ مرة واحدة
  var seenChromeHint: Bool { didSet { Store.d.set(seenChromeHint, forKey: "quran.seenChromeHint") } }
  var tajweed: Bool { didSet { Store.d.set(tajweed, forKey: "quran.tajweed") } }
  /// pages | text
  var view: String { didSet { Store.d.set(view, forKey: "quran.view") } }
  /// horizontal | vertical
  var scroll: String { didSet { Store.d.set(scroll, forKey: "quran.scroll") } }
  /// amiri | hafs
  var textFont: String { didSet { Store.d.set(textFont, forKey: "quran.textFont") } }
  var fitText: Bool { didSet { Store.d.set(fitText, forKey: "quran.fitText") } }
  var tafsir: String { didSet { Store.d.set(tafsir, forKey: "quran.tafsir") } }
  var hintShown: Bool { didSet { Store.d.set(hintShown, forKey: "quran.hintShown") } }
  /// معرّف الترجمة في quran.com (الافتراضي Saheeh International)
  var translation: Int { didSet { Store.d.set(translation, forKey: "quran.translation") } }
  var wbwLanguage: String { didSet { Store.d.set(wbwLanguage, forKey: "quran.wbwLang") } }
  var bookmarks: [WebSettings.Bookmark] { didSet { Store.save(bookmarks, "quran.bookmarks") } }
  var khatmah: KhatmahPlan? { didSet { Store.save(khatmah, "quran.khatmah") } }
  var readLog: ReadLog { didSet { Store.save(readLog, "quran.readLog") } }
  var challenge: ActiveChallenge? { didSet { Store.save(challenge, "quran.challenge") } }

  init() {
    reciter = Store.str("quran.reciter", Catalog.shared.defaultReciter); repeatAyah = Store.int("quran.repeatAyah", 1); repeatRange = Store.bool("quran.repeatRange", false)
    rate = Store.dbl("quran.rate", 1); follow = Store.bool("quran.follow", true); wordHighlight = Store.bool("quran.wordHighlight", true)
    fontScale = Store.dbl("quran.fontScale", 1); lineHeight = Store.dbl("quran.lineHeight", 2.15); hifzOnlyCurrent = Store.bool("quran.hifzOnlyCurrent", true)
    theme = Store.str("quran.theme", "cream"); themeLight = Store.str("quran.themeLight", "cream"); themeDark = Store.str("quran.themeDark", "dark"); themeAuto = Store.bool("quran.themeAuto", false)
    dim = Store.dbl("quran.dim", 0); keepAwake = Store.bool("quran.keepAwake", true); tajweed = Store.bool("quran.tajweed", false); seenChromeHint = Store.bool("quran.seenChromeHint", false)
    view = Store.str("quran.view", "pages"); scroll = Store.str("quran.scroll", "horizontal"); textFont = Store.str("quran.textFont", "amiri"); fitText = Store.bool("quran.fitText", true)
    tafsir = Store.str("quran.tafsir", "muyassar"); hintShown = Store.bool("quran.hintShown", false)
    translation = Store.int("quran.translation", QuranAPI.defaultTranslation); wbwLanguage = Store.str("quran.wbwLang", "en")
    bookmarks = Store.load("quran.bookmarks", []); khatmah = Store.load("quran.khatmah", nil); readLog = Store.load("quran.readLog", [:]); challenge = Store.load("quran.challenge", nil)
  }

  var isTextMode: Bool { view == "text" }
  func isBookmarked(_ a: Ayah) -> Bool { bookmarks.contains { $0.surah == a.surah && $0.ayah == a.ayah } }
  func bookmark(for a: Ayah) -> WebSettings.Bookmark? { bookmarks.first { $0.surah == a.surah && $0.ayah == a.ayah } }
  func removeBookmark(_ a: Ayah) { bookmarks.removeAll { $0.surah == a.surah && $0.ayah == a.ayah } }
  func setBookmark(_ a: Ayah, note: String?, color: String) {
    let at = bookmark(for: a)?.at ?? Date().timeIntervalSince1970 * 1000
    removeBookmark(a); bookmarks.append(WebSettings.Bookmark(surah: a.surah, ayah: a.ayah, page: a.page, at: at, note: (note?.isEmpty ?? true) ? nil : note, color: color))
  }
  /// السمة الفعلية (تتبع النظام إن فُعّل ذلك)
  func effectiveTheme(systemDark: Bool) -> MushafTheme { Catalog.shared.theme(themeAuto ? (systemDark ? themeDark : themeLight) : theme) }
  func setTheme(_ id: String) {
    theme = id
    if Catalog.shared.theme(id).isDark { themeDark = id } else { themeLight = id }
  }
}

/// تفضيلات المحتوى: تقدّم الأذكار اليومي، مفضلة الأحاديث وحصن المسلم، المسبحة، سمة بطاقة المشاركة، حجم الخط، تذكيرات الأذكار والحديث
@Observable
final class ContentPrefs {
  var adhkarProgress: WebSettings.AdhkarProgress { didSet { Store.save(adhkarProgress, "adhkarProgress") } }
  var favorites: [String] { didSet { Store.save(favorites, "favorites") } }
  var tasbih: TasbihState { didSet { Store.save(tasbih, "tasbih") } }
  var hisnFavorites: [Int] { didSet { Store.save(hisnFavorites, "hisnFavorites") } }
  var adhkarLog: AdhkarLog { didSet { Store.save(adhkarLog, "adhkarLog") } }
  var shareTheme: String { didSet { Store.d.set(shareTheme, forKey: "shareTheme") } }
  var textScale: Double { didSet { Store.d.set(textScale, forKey: "textScale") } }
  var extraReminders: ExtraReminderPrefs { didSet { Store.save(extraReminders, "notifications.extras") } }
  init() {
    adhkarProgress = Store.load("adhkarProgress", WebSettings.AdhkarProgress(date: nil, morning: [:], evening: [:], eveningDate: nil))
    favorites = Store.load("favorites", []); tasbih = Store.load("tasbih", TasbihState()); hisnFavorites = Store.load("hisnFavorites", [])
    adhkarLog = Store.load("adhkarLog", [:])
    shareTheme = Store.str("shareTheme", "green"); textScale = Store.dbl("textScale", 1); extraReminders = Store.load("notifications.extras", ExtraReminderPrefs())
  }
  func toggleFavorite(_ id: String) { if let i = favorites.firstIndex(of: id) { favorites.remove(at: i) } else { favorites.append(id) } }
  func toggleHisnFavorite(_ id: Int) { if let i = hisnFavorites.firstIndex(of: id) { hisnFavorites.remove(at: i) } else { hisnFavorites.append(id) } }
}
