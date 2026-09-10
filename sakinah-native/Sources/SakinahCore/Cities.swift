import Foundation

/// مدينة من قاعدة المدن دون اتصال (المصدر: sakinah/js/data/cities.js عبر tools/export-data.mjs)
public struct City: Sendable, Hashable, Codable, Identifiable {
  public let id: String
  public let nameAr: String
  public let nameEn: String
  public let countryAr: String
  public let countryCode: String
  public let lat: Double
  public let lon: Double
  public let tz: String
  public var coordinates: Coordinates { Coordinates(latitude: lat, longitude: lon) }
  public var timeZone: TimeZone { TimeZone(identifier: tz) ?? .current }
}

public struct Country: Sendable, Hashable, Codable { public let code: String; public let nameAr: String; public let nameEn: String? }

public struct CityDatabase: Sendable {
  public let cities: [City]
  public let countries: [Country]
  private struct File: Decodable { let cities: [City]; let countries: [CountryRaw] }
  private struct CountryRaw: Decodable { let code: String; let nameAr: String; let nameEn: String? }

  public init(data: Data) throws {
    let f = try JSONDecoder().decode(File.self, from: data)
    cities = f.cities; countries = f.countries.map { Country(code: $0.code, nameAr: $0.nameAr, nameEn: $0.nameEn) }
  }
  /// القاعدة المضمّنة في الحزمة
  public static let bundled: CityDatabase = {
    guard let url = Bundle.module.url(forResource: "cities", withExtension: "json", subdirectory: "Resources") ?? Bundle.module.url(forResource: "cities", withExtension: "json"),
          let data = try? Data(contentsOf: url), let db = try? CityDatabase(data: data) else { return CityDatabase(cities: [], countries: []) }
    return db
  }()
  init(cities: [City], countries: [Country]) { self.cities = cities; self.countries = countries }

  /// تسوية للبحث (بالعربية أو الإنجليزية) — مطابقة لـ location.js
  public static func normalize(_ s: String) -> String {
    // إزالة التشكيل أولًا على مستوى الرموز (الحرف مع حركته عنقود واحد في Swift فلا يطابقه الاستبدال)
    var t = s.lowercased()
    t.unicodeScalars.removeAll { (0x064B...0x0652).contains($0.value) }
    for (a, b) in [("أ", "ا"), ("إ", "ا"), ("آ", "ا"), ("ة", "ه"), ("ى", "ي")] { t = t.replacingOccurrences(of: a, with: b) }
    return t.trimmingCharacters(in: .whitespaces)
  }

  /// بحث بالاسم العربي أو الإنجليزي ثم الدولة، مرتّب بالأفضلية
  public func search(_ q: String, limit: Int = 30) -> [City] {
    let s = CityDatabase.normalize(q)
    if s.isEmpty { return Array(cities.prefix(limit)) }
    var scored: [(Int, City)] = []
    for c in cities {
      let a = CityDatabase.normalize(c.nameAr), e = c.nameEn.lowercased(), k = CityDatabase.normalize(c.countryAr)
      var score = 0
      if a.hasPrefix(s) || e.hasPrefix(s) { score = 3 } else if a.contains(s) || e.contains(s) { score = 2 } else if k.contains(s) { score = 1 }
      if score > 0 { scored.append((score, c)) }
    }
    return scored.sorted { $0.0 > $1.0 }.prefix(limit).map { $0.1 }
  }

  public static func haversineKm(_ lat1: Double, _ lon1: Double, _ lat2: Double, _ lon2: Double) -> Double {
    let R = 6371.0, d = Double.pi / 180
    let a = pow(sin(((lat2 - lat1) * d) / 2), 2) + cos(lat1 * d) * cos(lat2 * d) * pow(sin(((lon2 - lon1) * d) / 2), 2)
    return 2 * R * asin(sqrt(a))
  }
  /// أقرب مدينة إلى إحداثيات
  public func nearest(lat: Double, lon: Double) -> (city: City, km: Double)? {
    var best: (City, Double)? = nil
    for c in cities { let km = CityDatabase.haversineKm(lat, lon, c.lat, c.lon); if best == nil || km < best!.1 { best = (c, km) } }
    return best.map { ($0.0, $0.1) }
  }
  public func city(id: String) -> City? { cities.first { $0.id == id } }
}
