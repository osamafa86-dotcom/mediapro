import Foundation

/// التفسير الميسّر (مجمع الملك فهد) مضمّنًا: ملف لكل سورة (مصفوفة نصوص بترتيب الآيات، مع <b>…</b> لإبراز الألفاظ)
public final class Tafsir: @unchecked Sendable {
  public static let shared = Tafsir()
  private var cache: [Int: [String]] = [:]
  private let lock = NSLock()
  public struct Run: Sendable, Hashable { public let text: String; public let bold: Bool }

  public func surah(_ s: Int) -> [String] {
    lock.lock(); defer { lock.unlock() }
    if let c = cache[s] { return c }
    let url = Bundle.module.url(forResource: "\(s)", withExtension: "json", subdirectory: "Resources/tafsir-muyassar") ?? Bundle.module.url(forResource: "\(s)", withExtension: "json", subdirectory: "tafsir-muyassar")
    let arr = url.flatMap { try? Data(contentsOf: $0) }.flatMap { try? JSONDecoder().decode([String].self, from: $0) } ?? []
    cache[s] = arr; return arr
  }
  /// نص تفسير آية (HTML خام) أو nil
  public func text(surah s: Int, ayah a: Int) -> String? { let arr = surah(s); return (1...arr.count).contains(a) ? arr[a - 1] : nil }
  /// تفكيك <b>…</b> إلى مقاطع (عادي/غامق) وإزالة سائر الوسوم وفكّ الكيانات الشائعة
  public static func runs(_ html: String) -> [Run] {
    var out: [Run] = []; var buf = ""; var bold = false
    var i = html.startIndex
    func flush() { if !buf.isEmpty { out.append(Run(text: decode(buf), bold: bold)); buf = "" } }
    while i < html.endIndex {
      if html[i] == "<", let close = html[i...].firstIndex(of: ">") {
        let tag = html[html.index(after: i)..<close].lowercased().trimmingCharacters(in: .whitespaces)
        if tag == "b" || tag == "strong" { flush(); bold = true } else if tag == "/b" || tag == "/strong" { flush(); bold = false } else if tag == "br" || tag == "br/" || tag.hasPrefix("/p") { buf.append("\n") }
        i = html.index(after: close); continue
      }
      buf.append(html[i]); i = html.index(after: i)
    }
    flush(); return out
  }
  public static func plain(_ html: String) -> String { runs(html).map(\.text).joined() }
  private static func decode(_ s: String) -> String {
    s.replacingOccurrences(of: "&nbsp;", with: " ").replacingOccurrences(of: "&amp;", with: "&").replacingOccurrences(of: "&lt;", with: "<").replacingOccurrences(of: "&gt;", with: ">").replacingOccurrences(of: "&quot;", with: "\"")
  }
}
