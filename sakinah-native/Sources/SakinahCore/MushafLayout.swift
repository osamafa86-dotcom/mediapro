import Foundation

/// كلمة (أو رمز) في سطر من صفحة المصحف بخط الصفحة (QCF v1)
public struct MushafWord: Sendable, Hashable {
  /// الرموز الخاصة بخط الصفحة (رمز واحد غالبًا، وقد يكون رمزين لكلمة مركّبة)
  public let glyph: String
  /// الرقم العام للآية 1..6236
  public let n: Int
  /// فهرس الكلمة بين الكلمات المنطوقة للآية، أو -1 لرمز لا يقابل كلمة (علامة نهاية الآية)
  public let k: Int
  /// علامة نهاية الآية (يُرسم فيها رقم الآية)
  public let end: Bool
  /// تبدأ بعلامة ربع الحزب ۞
  public let rub: Bool
  /// تنتهي بعلامة السجدة ۩
  public let sajda: Bool
}

/// سطر من أسطر الصفحة كما في مصحف المدينة: ترويسة سورة، أو بسملة، أو كلمات
public enum MushafLine: Sendable, Hashable {
  case header(surah: Int)
  case basmala
  case words([MushafWord])

  public var words: [MushafWord] { if case .words(let w) = self { return w }; return [] }
  public var headerSurah: Int? { if case .header(let s) = self { return s }; return nil }
}

/// تخطيط صفحات مصحف المدينة (604 صفحة) المولَّد من بيانات مجمع الملك فهد — يُحمَّل عند أول طلب (~600 ك.ب)
public final class MushafLayout: @unchecked Sendable {
  public static let totalPages = 604
  public let font: String
  public let source: String
  private let raw: [[RawLine]]
  private let maps: [Int: [Int]]
  private var cache: [Int: [MushafLine]] = [:]
  private let lock = NSLock()

  /// [0, "g|g|…", [[n,k0,cnt,e],…], rub[], saj[]] | [1, surah] | [2]
  private struct RawLine: Decodable {
    let kind: Int; let glyphs: String; let runs: [[Int]]; let rub: [Int]; let saj: [Int]; let surah: Int
    init(from d: Decoder) throws {
      var c = try d.unkeyedContainer()
      kind = try c.decode(Int.self)
      switch kind {
      case 1: surah = try c.decode(Int.self); glyphs = ""; runs = []; rub = []; saj = []
      case 2: surah = 0; glyphs = ""; runs = []; rub = []; saj = []
      default:
        surah = 0
        glyphs = (try? c.decode(String.self)) ?? ""
        runs = (try? c.decode([[Int]].self)) ?? []
        rub = c.isAtEnd ? [] : ((try? c.decode([Int].self)) ?? [])
        saj = c.isAtEnd ? [] : ((try? c.decode([Int].self)) ?? [])
      }
    }
  }
  private struct File: Decodable { let v: Int; let font: String; let source: String; let pages: [[RawLine]]; let maps: [String: [Int]]? }

  public init(data: Data) throws {
    let f = try JSONDecoder().decode(File.self, from: data)
    guard f.pages.count == MushafLayout.totalPages else { throw NSError(domain: "MushafLayout", code: 1, userInfo: [NSLocalizedDescriptionKey: "bad mushaf layout"]) }
    font = f.font; source = f.source; raw = f.pages
    var m: [Int: [Int]] = [:]; for (k, v) in f.maps ?? [:] { if let n = Int(k) { m[n] = v } }
    maps = m
  }
  /// النسخة المضمّنة (تحميل كسول مرة واحدة)
  public static let shared: MushafLayout = {
    let url = Bundle.module.url(forResource: "mushaf-layout", withExtension: "json", subdirectory: "Resources") ?? Bundle.module.url(forResource: "mushaf-layout", withExtension: "json")!
    return try! MushafLayout(data: Data(contentsOf: url))
  }()

  /// عدد أسطر الصفحة في المصحف المطبوع (الفاتحة وأول البقرة 8 أسطر، وسائر الصفحات 15)
  public static func lineCount(ofPage p: Int) -> Int { p <= 2 ? 8 : 15 }

  /// أسطر الصفحة مفكوكة الترميز (تُخزَّن بعد أول فكّ)
  public func lines(ofPage p: Int) -> [MushafLine] {
    guard (1...MushafLayout.totalPages).contains(p) else { return [] }
    lock.lock(); defer { lock.unlock() }
    if let c = cache[p] { return c }
    let out = raw[p - 1].map(decode)
    cache[p] = out
    return out
  }
  private func decode(_ line: RawLine) -> MushafLine {
    if line.kind == 1 { return .header(surah: line.surah) }
    if line.kind == 2 { return .basmala }
    let glyphs = line.glyphs.isEmpty ? [] : line.glyphs.split(separator: "|", omittingEmptySubsequences: false).map(String.init)
    let rub = Set(line.rub), saj = Set(line.saj)
    var words: [MushafWord] = []; var gi = 0
    for run in line.runs where run.count >= 4 {
      let n = run[0], k0 = run[1], cnt = run[2], e = run[3]
      for j in 0..<cnt {
        let isEnd = e == 1 && j == cnt - 1
        var k = -1
        if !isEnd {
          if let map = maps[n] { k = (0..<map.count).contains(k0 + j) ? map[k0 + j] : -1 } else { k = k0 + j }
        }
        words.append(MushafWord(glyph: gi < glyphs.count ? glyphs[gi] : "", n: n, k: k, end: isEnd, rub: rub.contains(gi), sajda: saj.contains(gi)))
        gi += 1
      }
    }
    return .words(words)
  }
  /// السور التي تظهر ترويستها في هذه الصفحة (قد تكون ترويسة سورة تبدأ كلماتها في الصفحة التالية)
  public func headers(onPage p: Int) -> [Int] { lines(ofPage: p).compactMap(\.headerSurah) }
  /// أرقام الآيات (العامة) التي تظهر كلماتها في هذه الصفحة بترتيبها
  public func ayahs(onPage p: Int) -> [Int] {
    var seen: [Int] = []
    for l in lines(ofPage: p) { for w in l.words where seen.last != w.n { seen.append(w.n) } }
    return seen
  }
  /// أول صفحة تظهر فيها كلمات الآية العامة n (بحث ثنائي على الصفحات)
  public func page(ofAyah n: Int, hint: QuranText? = nil) -> Int? {
    if let t = hint, let a = t.ayah(n) { return a.page }
    var lo = 1, hi = MushafLayout.totalPages
    while lo <= hi {
      let mid = (lo + hi) / 2
      let a = ayahs(onPage: mid)
      guard let first = a.first, let last = a.last else { return nil }
      if n < first { hi = mid - 1 } else if n > last { lo = mid + 1 } else { return mid }
    }
    return nil
  }
}
