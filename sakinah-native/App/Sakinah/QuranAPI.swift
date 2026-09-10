import Foundation

/// ترجمات الآيات ومعاني الكلمات من quran.com (عند الطلب، مع تخزين على القرص) — لا تُستخدم إلا حين يطلبها المستخدم
enum QuranAPI {
  struct TranslationInfo: Identifiable, Codable, Hashable { let id: Int; let name: String; let authorName: String; let languageName: String }
  struct Word: Identifiable, Hashable { let id: Int; let text: String; let meaning: String; let isEnd: Bool }
  static let wbwLanguages: [(code: String, name: String)] = [("en", "English"), ("ur", "اردو"), ("id", "Indonesia"), ("tr", "Türkçe"), ("bn", "বাংলা"), ("fa", "فارسی"), ("hi", "हिन्दी")]
  static let defaultTranslation = 20 // Saheeh International
  private static let base = "https://api.quran.com/api/v4/"
  private static var cacheDir: URL {
    let d = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("qapi", isDirectory: true)
    try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true); return d
  }
  private static func fetch(_ path: String, cacheKey: String, maxAge: TimeInterval) async throws -> Data {
    let file = cacheDir.appendingPathComponent(cacheKey.replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "?", with: "_").replacingOccurrences(of: "&", with: "_").replacingOccurrences(of: "=", with: "-") + ".json")
    if let attrs = try? FileManager.default.attributesOfItem(atPath: file.path), let m = attrs[.modificationDate] as? Date, Date().timeIntervalSince(m) < maxAge, let d = try? Data(contentsOf: file) { return d }
    var req = URLRequest(url: URL(string: base + path)!); req.setValue("application/json", forHTTPHeaderField: "accept"); req.timeoutInterval = 12
    let (data, resp) = try await URLSession.shared.data(for: req)
    guard let h = resp as? HTTPURLResponse, (200..<300).contains(h.statusCode) else { throw URLError(.badServerResponse) }
    try? data.write(to: file)
    return data
  }
  /// قائمة الترجمات المتاحة (أسماء اللغات بالإنجليزية كما يعيدها المصدر)
  static func translationsList() async throws -> [TranslationInfo] {
    struct R: Decodable { struct T: Decodable { let id: Int; let name: String; let author_name: String?; let language_name: String? }; let translations: [T] }
    let d = try await fetch("resources/translations", cacheKey: "translations-list", maxAge: 7 * 86400)
    return try JSONDecoder().decode(R.self, from: d).translations.map { TranslationInfo(id: $0.id, name: $0.name, authorName: $0.author_name ?? "", languageName: ($0.language_name ?? "").capitalized) }.sorted { ($0.languageName, $0.name) < ($1.languageName, $1.name) }
  }
  /// ترجمة آية (بلا وسوم HTML وحواشٍ)
  static func translation(id: Int, surah: Int, ayah: Int) async throws -> String {
    struct R: Decodable { struct T: Decodable { let text: String }; let translations: [T] }
    let d = try await fetch("quran/translations/\(id)?verse_key=\(surah):\(ayah)", cacheKey: "tr-\(id)-\(surah)-\(ayah)", maxAge: 365 * 86400)
    guard let t = try JSONDecoder().decode(R.self, from: d).translations.first?.text else { throw URLError(.resourceUnavailable) }
    return stripTags(t)
  }
  /// معاني الكلمات (كلمة بكلمة) بلغة معيّنة
  static func words(surah: Int, ayah: Int, lang: String) async throws -> [Word] {
    struct R: Decodable { struct V: Decodable { struct W: Decodable { struct Tr: Decodable { let text: String? }; let id: Int; let text_uthmani: String?; let char_type_name: String?; let translation: Tr? }; let words: [W] }; let verse: V }
    let d = try await fetch("verses/by_key/\(surah):\(ayah)?words=true&word_fields=text_uthmani&language=\(lang)", cacheKey: "wbw-\(lang)-\(surah)-\(ayah)", maxAge: 365 * 86400)
    return try JSONDecoder().decode(R.self, from: d).verse.words.map { Word(id: $0.id, text: $0.text_uthmani ?? "", meaning: stripTags($0.translation?.text ?? ""), isEnd: $0.char_type_name == "end") }
  }
  static func stripTags(_ s: String) -> String {
    var out = ""; var inTag = false; var inSup = false
    var i = s.startIndex
    while i < s.endIndex {
      let c = s[i]
      if c == "<" { inTag = true; let rest = s[i...]; if rest.hasPrefix("<sup") { inSup = true } else if rest.hasPrefix("</sup") { inSup = false; if let close = rest.firstIndex(of: ">") { i = s.index(after: close); inTag = false; continue } } }
      else if c == ">" { inTag = false }
      else if !inTag && !inSup { out.append(c) }
      i = s.index(after: i)
    }
    return out.replacingOccurrences(of: "&nbsp;", with: " ").replacingOccurrences(of: "&amp;", with: "&").replacingOccurrences(of: "&quot;", with: "\"").trimmingCharacters(in: .whitespacesAndNewlines)
  }
}
