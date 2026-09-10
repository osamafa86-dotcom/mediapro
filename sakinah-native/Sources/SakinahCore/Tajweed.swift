import Foundation

/// مقطع حكم تجويد داخل نص الآية: [بداية، طول] بمواضع رموز النص، والرمز (h,s,l,n,p,m,o,q,g,f,c,i,a,u,w,d,b)
public struct TajweedSpan: Sendable, Hashable { public let start: Int; public let length: Int; public let code: String }

/// التجويد الملوّن: أحكام كل آية (data/tajweed.json المولَّد من طبعة alquran.cloud المجوّدة مسقطةً على رسم المدينة)
public final class Tajweed: @unchecked Sendable {
  public static let shared: Tajweed = {
    let url = Bundle.module.url(forResource: "tajweed", withExtension: "json", subdirectory: "Resources") ?? Bundle.module.url(forResource: "tajweed", withExtension: "json")!
    return try! Tajweed(data: Data(contentsOf: url))
  }()
  private struct File: Decodable { let v: Int; let source: String; let rules: [String: String]; let ayahs: [String: String] }
  public let source: String
  /// أسماء الأحكام بالرمز
  public let rules: [String: String]
  private let raw: [String: String]
  private var cache: [Int: [TajweedSpan]] = [:]
  private let lock = NSLock()

  public init(data: Data) throws {
    let f = try JSONDecoder().decode(File.self, from: data)
    source = f.source; rules = f.rules; raw = f.ayahs
  }
  /// أحكام آية (رقم عام) مرتبة بالبداية، أو مصفوفة فارغة
  public func spans(_ n: Int) -> [TajweedSpan] {
    lock.lock(); defer { lock.unlock() }
    if let c = cache[n] { return c }
    let out: [TajweedSpan] = (raw[String(n)] ?? "").split(separator: ";").compactMap { part in
      let f = part.split(separator: ",", omittingEmptySubsequences: false)
      guard f.count == 3, let a = Int(f[0]), let b = Int(f[1]) else { return nil }
      return TajweedSpan(start: a, length: b, code: String(f[2]))
    }
    cache[n] = out; return out
  }
  /// مجموعة اللون لرمز الحكم (كما في مفتاح الألوان)
  public static func group(of code: String) -> String {
    for (g, codes) in Catalog.shared.tajweed.groups where codes.contains(code) { return g }
    return "other"
  }
  /// تقسيم كلمة إلى مقاطع ملوّنة: (النص، رمز الحكم أو nil) بحسب موضع الكلمة في نص الآية
  public static func segments(word: String, start: Int, spans: [TajweedSpan]) -> [(text: String, code: String?)] {
    var out: [(String, String?)] = []; var buf: [Unicode.Scalar] = []; var cur: String? = nil
    func flush() { if !buf.isEmpty { out.append((String(String.UnicodeScalarView(buf)), cur)); buf = [] } }
    for (i, sc) in word.unicodeScalars.enumerated() {
      let pos = start + i; var code: String? = nil
      for s in spans { if pos >= s.start && pos < s.start + s.length { code = s.code; break }; if s.start > pos { break } }
      if code != cur { flush(); cur = code }
      buf.append(sc)
    }
    flush(); return out
  }
}
