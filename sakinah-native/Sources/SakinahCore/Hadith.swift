import Foundation

/// حديث مختار من الصحيحين
public struct Hadith: Sendable, Hashable, Codable, Identifiable {
  public struct AlsoIn: Sendable, Hashable, Codable { public let collection: String; public let number: Int }
  public let id: String
  public let collection: String
  public let number: Int
  public let grade: String
  public let narrator: String
  public let text: String
  public let topic: String
  public let lesson: String
  public let alsoIn: AlsoIn?
  /// «صحيح البخاري (16) وصحيح مسلم (43)»
  public var reference: String {
    let col = collection == "bukhari" ? "صحيح البخاري" : "صحيح مسلم"
    var ref = "\(col) (\(number))"
    if let a = alsoIn { ref += " و\(a.collection == "bukhari" ? "صحيح البخاري" : "صحيح مسلم") (\(a.number))" }
    return ref
  }
}
/// حديث من الأربعين النووية
public struct NawawiHadith: Sendable, Hashable, Codable, Identifiable { public let n: Int; public let title: String; public let text: String; public let takhrij: String
  public var id: String { "nawawi-\(n)" } }

public enum HadithLibrary {
  private struct File: Decodable { let topics: [String]; let hadiths: [Hadith]; let nawawi: [NawawiHadith] }
  private static let file: File = {
    let url = Bundle.module.url(forResource: "hadith", withExtension: "json", subdirectory: "Resources") ?? Bundle.module.url(forResource: "hadith", withExtension: "json")!
    return try! JSONDecoder().decode(File.self, from: Data(contentsOf: url))
  }()
  public static var topics: [String] { file.topics }
  public static var hadiths: [Hadith] { file.hadiths }
  public static var nawawi: [NawawiHadith] { file.nawawi }
  /// حديث اليوم: اختيار ثابت لليوم المدني (يتغير يوميًا ولا يتكرر قبل مرور القائمة)
  public static func hadithOfDay(year: Int, month: Int, day: Int) -> Hadith {
    let idx = DayKey.daysFromCivil(year, month, day); let n = file.hadiths.count
    return file.hadiths[((idx % n) + n) % n]
  }
  public static func hadithOfDay(_ date: Date = Date(), tz: TimeZone = .current) -> Hadith { let c = CivilDate(date, in: tz); return hadithOfDay(year: c.year, month: c.month, day: c.day) }
  private static func strip(_ s: String) -> String { CityDatabase.normalize(s).lowercased() }
  public static func searchSahih(_ q: String, topic: String? = nil, favorites: Set<String> = [], onlyFavorites: Bool = false) -> [Hadith] {
    let qq = strip(q)
    return file.hadiths.filter { h in (topic == nil || h.topic == topic) && (!onlyFavorites || favorites.contains(h.id)) && (qq.isEmpty || strip(h.text).contains(qq) || strip(h.narrator).contains(qq) || strip(h.lesson).contains(qq)) }
  }
  public static func searchNawawi(_ q: String, favorites: Set<String> = [], onlyFavorites: Bool = false) -> [NawawiHadith] {
    let qq = strip(q)
    return file.nawawi.filter { n in (!onlyFavorites || favorites.contains(n.id)) && (qq.isEmpty || strip(n.text).contains(qq) || strip(n.takhrij).contains(qq) || strip(n.title).contains(qq)) }
  }
}
