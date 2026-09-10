import Foundation

/// ذكر من أذكار الصباح والمساء (حصن المسلم، الأرقام 75–98)
public struct Dhikr: Sendable, Hashable, Codable, Identifiable {
  public let id: String
  public let hisnId: Int
  /// both | morning | evening
  public let period: String
  public let text: String
  public let textEvening: String?
  public let repeatCount: Int
  public let repeatEvening: Int?
  public let reference: String
  public let virtue: String?
  public let note: String?
  enum CodingKeys: String, CodingKey { case id, hisnId, period, text, textEvening, repeatCount = "repeat", repeatEvening, reference, virtue, note }
  public func text(for period: String) -> String { period == "evening" ? (textEvening ?? text) : text }
  public func target(for period: String) -> Int { period == "evening" ? (repeatEvening ?? repeatCount) : repeatCount }
}
public enum Adhkar {
  private struct File: Decodable { let adhkar: [Dhikr] }
  public static let all: [Dhikr] = {
    let url = Bundle.module.url(forResource: "adhkar", withExtension: "json", subdirectory: "Resources") ?? Bundle.module.url(forResource: "adhkar", withExtension: "json")!
    return try! JSONDecoder().decode(File.self, from: Data(contentsOf: url)).adhkar
  }()
  public static func items(for period: String) -> [Dhikr] { all.filter { $0.period == "both" || $0.period == period } }
  /// الفترة التلقائية: صباح من الفجر إلى الظهر، مساء من العصر إلى الفجر، وإلا صباح
  public static func autoPeriod(now: Date, fajr: Date?, dhuhr: Date?, asr: Date?, tz: TimeZone) -> String {
    if let f = fajr, let d = dhuhr, let a = asr { return now >= f && now < d ? "morning" : (now >= a || now < f ? "evening" : "morning") }
    var cal = Calendar(identifier: .gregorian); cal.timeZone = tz
    let hr = cal.component(.hour, from: now); return hr >= 4 && hr < 12 ? "morning" : "evening"
  }
}

/// حصن المسلم كاملًا: 12 قسمًا، 132 بابًا، 267 ذكرًا
public struct HisnItem: Sendable, Hashable, Codable, Identifiable { public let id: Int; public let text: String; public let repeatCount: Int; public let audio: Bool?
  enum CodingKeys: String, CodingKey { case id, text, repeatCount = "repeat", audio }
  public var hasAudio: Bool { audio != false }
  public var audioURL: URL { URL(string: "https://www.hisnmuslim.com/audio/ar/\(id).mp3")! } }
public struct HisnChapter: Sendable, Hashable, Codable, Identifiable { public let id: Int; public let title: String; public let items: [HisnItem] }
public struct HisnSection: Sendable, Hashable, Codable { public let title: String; public let chapters: [Int] }
public enum Hisn {
  private struct File: Decodable { let sections: [HisnSection]; let chapters: [HisnChapter] }
  private static let file: File = {
    let url = Bundle.module.url(forResource: "hisn", withExtension: "json", subdirectory: "Resources") ?? Bundle.module.url(forResource: "hisn", withExtension: "json")!
    return try! JSONDecoder().decode(File.self, from: Data(contentsOf: url))
  }()
  public static var sections: [HisnSection] { file.sections }
  public static var chapters: [HisnChapter] { file.chapters }
  public static var itemCount: Int { file.chapters.reduce(0) { $0 + $1.items.count } }
  public static func chapter(_ id: Int) -> HisnChapter? { file.chapters.first { $0.id == id } }
  /// بحث في العناوين والنصوص بالتطبيع الموحّد
  public static func search(_ q: String, limit: Int = 60) -> (chapters: [HisnChapter], items: [(item: HisnItem, chapter: HisnChapter)]) {
    let nq = CityDatabase.normalize(q); guard nq.count >= 2 else { return ([], []) }
    let ch = file.chapters.filter { CityDatabase.normalize($0.title).contains(nq) }
    var items: [(HisnItem, HisnChapter)] = []
    outer: for c in file.chapters { for it in c.items { if items.count >= limit { break outer }; if CityDatabase.normalize(it.text).contains(nq) { items.append((it, c)) } } }
    return (ch, items)
  }
}
