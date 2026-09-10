import Foundation

/// وصف السورة (من quran-meta.json المولَّد من نسخة تنزيل العثمانية)
public struct Surah: Sendable, Hashable, Codable, Identifiable {
  public let n: Int
  public let name: String
  public let vocalized: String
  public let plain: String
  public let en: String
  public let ayahs: Int
  /// مكية / مدنية
  public let type: String
  /// أول صفحة
  public let page: Int
  public var id: Int { n }
}
public struct JuzStart: Sendable, Hashable, Codable { public let juz: Int; public let surah: Int; public let ayah: Int; public let page: Int }

public enum QuranMeta {
  private struct File: Decodable { let surahs: [Surah]; let juzStarts: [JuzStart]; let totalAyahs: Int; let totalPages: Int; let basmala: String }
  private static let file: File = {
    let url = Bundle.module.url(forResource: "quran-meta", withExtension: "json", subdirectory: "Resources") ?? Bundle.module.url(forResource: "quran-meta", withExtension: "json")!
    return try! JSONDecoder().decode(File.self, from: Data(contentsOf: url))
  }()
  public static var surahs: [Surah] { file.surahs }
  public static var juzStarts: [JuzStart] { file.juzStarts }
  public static var totalAyahs: Int { file.totalAyahs }
  public static var totalPages: Int { file.totalPages }
  public static var basmala: String { file.basmala }
  public static func surah(_ n: Int) -> Surah { file.surahs[n - 1] }
  /// الجزء الذي تقع فيه الصفحة (من بدايات الأجزاء)
  public static func juz(ofPage p: Int) -> Int { (file.juzStarts.last { $0.page <= p }?.juz) ?? 1 }
  public static func juzStartPage(_ j: Int) -> Int { file.juzStarts[j - 1].page }
  /// السورة التي يقع فيها أول سطر كلمات في الصفحة تقريبًا (آخر سورة بدأت في صفحة ≤ p)
  public static func firstSurah(onPage p: Int) -> Surah { file.surahs.last { $0.page <= p } ?? file.surahs[0] }

  static let juzOrdinals = ["الأَوَّلُ", "الثَّانِي", "الثَّالِثُ", "الرَّابِعُ", "الخَامِسُ", "السَّادِسُ", "السَّابِعُ", "الثَّامِنُ", "التَّاسِعُ", "العَاشِرُ",
    "الحَادِيَ عَشَرَ", "الثَّانِيَ عَشَرَ", "الثَّالِثَ عَشَرَ", "الرَّابِعَ عَشَرَ", "الخَامِسَ عَشَرَ", "السَّادِسَ عَشَرَ", "السَّابِعَ عَشَرَ", "الثَّامِنَ عَشَرَ", "التَّاسِعَ عَشَرَ", "العِشْرُونَ",
    "الحَادِي وَالعِشْرُونَ", "الثَّانِي وَالعِشْرُونَ", "الثَّالِثُ وَالعِشْرُونَ", "الرَّابِعُ وَالعِشْرُونَ", "الخَامِسُ وَالعِشْرُونَ", "السَّادِسُ وَالعِشْرُونَ", "السَّابِعُ وَالعِشْرُونَ", "الثَّامِنُ وَالعِشْرُونَ", "التَّاسِعُ وَالعِشْرُونَ", "الثَّلَاثُونَ"]
  /// اسم الجزء كما يُكتب في رأس صفحات المصحف: «الجُزْءُ السَّادِسُ وَالعِشْرُونَ»
  public static func juzName(_ j: Int, vocalized: Bool = true) -> String {
    guard (1...30).contains(j) else { return "" }
    let s = "الجُزْءُ \(juzOrdinals[j - 1])"
    if vocalized { return s }
    var t = s; t.unicodeScalars.removeAll { (0x0610...0x061A).contains($0.value) || (0x064B...0x065F).contains($0.value) || $0.value == 0x0670 || (0x06D6...0x06ED).contains($0.value) }
    return t
  }
  /// الأرقام المشرقية
  public static func arabicDigits(_ n: Int) -> String { String(String(n).map { c in c.isNumber ? "٠١٢٣٤٥٦٧٨٩"[String("٠١٢٣٤٥٦٧٨٩").index(String("٠١٢٣٤٥٦٧٨٩").startIndex, offsetBy: c.wholeNumberValue!)] : c }) }
}
