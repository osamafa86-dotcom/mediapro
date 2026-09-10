import Foundation

/// آية من نص تنزيل العثماني (حفص) مع موضعها
public struct Ayah: Sendable, Hashable, Identifiable {
  /// الرقم العام 1..6236
  public let n: Int
  public let surah: Int
  public let ayah: Int
  public let page: Int
  public let juz: Int
  public let hizbQuarter: Int
  public let text: String
  public var id: Int { n }
}

/// نص القرآن كاملًا (يُحمَّل عند أول طلب، ~1.4 م.ب) مع فهارس الصفحات والسور
public final class QuranText: @unchecked Sendable {
  public let ayahs: [Ayah]
  private let byPage: [Int: [Ayah]]
  private let bySurah: [Int: [Ayah]]
  private var hizbPages: [Int: Int] = [:]

  private struct Row: Decodable {
    let s: Int, a: Int, p: Int, j: Int, hq: Int, t: String
    init(from d: Decoder) throws { var c = try d.unkeyedContainer(); s = try c.decode(Int.self); a = try c.decode(Int.self); p = try c.decode(Int.self); j = try c.decode(Int.self); hq = try c.decode(Int.self); t = try c.decode(String.self) }
  }
  private struct File: Decodable { let ayahs: [Row] }

  public init(data: Data) throws {
    let f = try JSONDecoder().decode(File.self, from: data)
    var list: [Ayah] = []; list.reserveCapacity(f.ayahs.count)
    for (i, r) in f.ayahs.enumerated() { list.append(Ayah(n: i + 1, surah: r.s, ayah: r.a, page: r.p, juz: r.j, hizbQuarter: r.hq, text: r.t)) }
    ayahs = list
    byPage = Dictionary(grouping: list, by: \.page)
    bySurah = Dictionary(grouping: list, by: \.surah)
    for a in list where (a.hizbQuarter - 1) % 4 == 0 { let h = (a.hizbQuarter + 3) / 4; if hizbPages[h] == nil { hizbPages[h] = a.page } }
  }
  /// النسخة المضمّنة (تحميل كسول مرة واحدة)
  public static let shared: QuranText = {
    let url = Bundle.module.url(forResource: "quran", withExtension: "json", subdirectory: "Resources") ?? Bundle.module.url(forResource: "quran", withExtension: "json")!
    return try! QuranText(data: Data(contentsOf: url))
  }()

  public func ayah(_ n: Int) -> Ayah? { (1...ayahs.count).contains(n) ? ayahs[n - 1] : nil }
  public func ayah(surah: Int, ayah: Int) -> Ayah? { guard let l = bySurah[surah], (1...l.count).contains(ayah) else { return nil }; return l[ayah - 1] }
  public func pageAyahs(_ page: Int) -> [Ayah] { byPage[page] ?? [] }
  public func surahAyahs(_ surah: Int) -> [Ayah] { bySurah[surah] ?? [] }
  public func page(surah: Int, ayah: Int) -> Int? { self.ayah(surah: surah, ayah: ayah)?.page }
  /// السور التي تبدأ في هذه الصفحة
  public func surahsStarting(onPage p: Int) -> [Int] { pageAyahs(p).filter { $0.ayah == 1 }.map(\.surah) }
  public struct PageLabel: Sendable { public let juz: Int; public let hizb: Int; public let quarter: Int; public let surah: Int }
  /// الجزء والحزب والربع وسورة أول آية في الصفحة (للعنوان)
  public func label(ofPage p: Int) -> PageLabel? {
    guard let a = pageAyahs(p).first else { return nil }
    return PageLabel(juz: a.juz, hizb: (a.hizbQuarter + 3) / 4, quarter: ((a.hizbQuarter - 1) % 4) + 1, surah: a.surah)
  }
  public func hizbStartPage(_ h: Int) -> Int? { hizbPages[h] }
}
