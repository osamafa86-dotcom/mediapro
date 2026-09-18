import Foundation
import MapKit
import SakinahCore

/// مسجد قريب مع بعده واتجاهه من موقع المستخدم
struct Mosque: Identifiable, Codable, Hashable {
  let id: String
  let name: String
  let latitude: Double
  let longitude: Double
  let address: String?
  var distanceKm: Double
  var bearing: Double
  var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: latitude, longitude: longitude) }
}

/// المساجد القريبة من خرائط آبل (MKLocalSearch): لا مفتاح ولا خادم لنا، وبيانات آبل هي الأوثق على iOS.
/// المركز المرسل مقرّب إلى ~١ كم كي يبقى ما يغادر الجهاز «موقعًا تقريبيًّا» كما في سياسة الخصوصية،
/// والمسافات تُحسب على الجهاز من الموقع الدقيق. نتائج الخلية نفسها تُخزَّن يومًا فلا تُعاد الشبكة مع كل فتح.
@Observable
final class MosqueFinder {
  var results: [Mosque] = []
  var loading = false
  var error: String?

  private struct Cache: Codable { let key: String; let at: Date; let items: [Mosque] }
  private static let cacheKey = "mosques.cache"
  private static let nameKeys = ["مسجد", "جامع", "مصلى", "مصلّى", "mosque", "masjid", "jami", "cami", "mescit", "mosquée", "moschee", "mezquita", "мечеть"]

  static func cellKey(_ c: Coordinates) -> String { String(format: "%.2f,%.2f", c.latitude, c.longitude) }

  static func cached(for c: Coordinates) -> [Mosque]? {
    guard let d = UserDefaults.standard.data(forKey: cacheKey), let cache = try? JSONDecoder().decode(Cache.self, from: d),
          cache.key == cellKey(c), Date().timeIntervalSince(cache.at) < 86_400 else { return nil }
    return cache.items.map { rerank($0, from: c) }.sorted { $0.distanceKm < $1.distanceKm }
  }

  /// خرائط آبل ترتّب بالشهرة لا بالقرب (قِيس في إسطنبول: «السلطان أحمد» أقرب مسجد وهو على نصف ساعة)
  /// فالبحث أربع كلمات (عربي/إنجليزي/تركي) في مدى ضيّق أوّلًا ثم واسع، ثم تُدمج OpenStreetMap
  /// — أشمل للمساجد الصغيرة — حين تصل، والترتيب بالمسافة المحسوبة على الجهاز.
  func nearby(around c: Coordinates, query: String? = nil, force: Bool = false) async {
    let q = query?.trimmingCharacters(in: .whitespaces) ?? ""
    if !force, q.isEmpty, let hit = Self.cached(for: c) { results = hit; return }
    loading = true; error = nil
    let apple = await Self.appleSearch(around: c, query: q)
    if !apple.isEmpty { results = Self.merge(apple, [], from: c); loading = false }
    let osm = (try? await OSMMosques.tiered(around: c, query: q)) ?? []
    let merged = Self.merge(apple, osm, from: c)
    loading = false
    if merged.isEmpty { error = apple.isEmpty && osm.isEmpty ? "تعذّر جلب المساجد — تحقّق من الاتصال" : nil }
    results = merged
    if q.isEmpty, !merged.isEmpty { Self.store(merged, for: c) }
  }

  private static func appleSearch(around c: Coordinates, query q: String) async -> [Mosque] {
    let terms = q.isEmpty ? ["مسجد", "mosque", "masjid", "cami"] : ["مسجد \(q)", q]
    func run(_ term: String, meters: Double) async -> [Mosque] {
      let req = MKLocalSearch.Request()
      req.naturalLanguageQuery = term
      let center = CLLocationCoordinate2D(latitude: (c.latitude * 100).rounded() / 100, longitude: (c.longitude * 100).rounded() / 100)
      req.region = MKCoordinateRegion(center: center, latitudinalMeters: meters, longitudinalMeters: meters)
      req.resultTypes = .pointOfInterest
      guard let resp = try? await MKLocalSearch(request: req).start() else { return [] }
      return resp.mapItems.compactMap { item -> Mosque? in
        guard let name = item.name, !name.isEmpty else { return nil }
        let p = item.placemark
        let addr = [p.thoroughfare, p.subLocality ?? p.locality].compactMap { $0 }.joined(separator: "، ")
        return Mosque(id: String(format: "apple/%.5f,%.5f", p.coordinate.latitude, p.coordinate.longitude), name: name,
                      latitude: p.coordinate.latitude, longitude: p.coordinate.longitude, address: addr.isEmpty ? nil : addr, distanceKm: 0, bearing: 0)
      }
    }
    var out: [Mosque] = []
    await withTaskGroup(of: [Mosque].self) { g in
      for t in terms { g.addTask { await run(t, meters: q.isEmpty ? 2_500 : 20_000) } }
      for await r in g { out += r }
    }
    if q.isEmpty, out.count < 8 {
      await withTaskGroup(of: [Mosque].self) { g in
        for t in terms { g.addTask { await run(t, meters: 8_000) } }
        for await r in g { out += r }
      }
    }
    // ترشيح لطيف: ما يُقرأ مسجدًا في اسمه؛ وإن أفرغ القائمة أُبقيت كما جاءت
    let named = out.filter { m in nameKeys.contains { m.name.lowercased().contains($0) } }
    return named.isEmpty ? out : named
  }

  /// دمج المصدرين: المكرّر ضمن ٤٠ م يُحذف، والترتيب بالبعد
  private static func merge(_ a: [Mosque], _ b: [Mosque], from c: Coordinates) -> [Mosque] {
    var out: [Mosque] = []
    for m in (a + b).map({ rerank($0, from: c) }) {
      if out.contains(where: { Qibla.distanceSphericalKm(lat1: $0.latitude, lon1: $0.longitude, lat2: m.latitude, lon2: m.longitude) < 0.04 }) { continue }
      out.append(m)
    }
    return Array(out.sorted { $0.distanceKm < $1.distanceKm }.prefix(60))
  }

  private static func rerank(_ m: Mosque, from c: Coordinates) -> Mosque {
    var x = m
    x.distanceKm = Qibla.distanceSphericalKm(lat1: c.latitude, lon1: c.longitude, lat2: m.latitude, lon2: m.longitude)
    x.bearing = Qibla.vincentyInverse(lat1: c.latitude, lon1: c.longitude, lat2: m.latitude, lon2: m.longitude).initialBearing
    return x
  }
  private static func store(_ items: [Mosque], for c: Coordinates) {
    if let d = try? JSONEncoder().encode(Cache(key: cellKey(c), at: Date(), items: items)) { UserDefaults.standard.set(d, forKey: cacheKey) }
  }

  /// الاتجاهات سيرًا في خرائط آبل
  static func openDirections(to m: Mosque) {
    let item = MKMapItem(placemark: MKPlacemark(coordinate: m.coordinate)); item.name = m.name
    item.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeWalking])
  }

  static func distanceLabel(_ km: Double, numerals n: String) -> String {
    km < 1 ? "\(Fmt.number(Int((km * 100).rounded()) * 10, numerals: n)) م" : "\(Fmt.decimal(km, digits: 1, numerals: n)) كم"
  }
  static func walkLabel(_ km: Double, numerals n: String) -> String {
    "\(Fmt.number(max(1, Int((km / 5 * 60).rounded())), numerals: n)) د سيرًا"
  }
}

/// OpenStreetMap عبر Overpass — يكمّل خرائط آبل في المساجد الصغيرة. الخادم العام بطيء ويسقط أحيانًا
/// (قِيس: ١٢ ث و504 مرّةً من ثلاث) فهو مصدر ثانٍ لا أوّل، والمدى يتّسع على مراحل لأن `around`
/// لا يرتّب بالقرب: مدى واسع بحدٍّ ٨٠ قد يُسقط الأقرب.
enum OSMMosques {
  static func tiered(around c: Coordinates, query: String) async throws -> [Mosque] {
    if !query.isEmpty { return try await fetch(around: c, radius: 15_000, query: query) }
    var out: [Mosque] = []
    for r in [1_500, 4_000, 10_000] {
      out = try await fetch(around: c, radius: r, query: "")
      if out.count >= 5 { break }
    }
    return out
  }
  static func fetch(around c: Coordinates, radius: Int, query: String) async throws -> [Mosque] {
    let rl = (c.latitude * 100).rounded() / 100, ro = (c.longitude * 100).rounded() / 100
    let name = query.isEmpty ? "" : "[\"name\"~\"\(query.replacingOccurrences(of: "\"", with: "").replacingOccurrences(of: "\\", with: ""))\",i]"
    let ql = "[out:json][timeout:20];nwr[\"amenity\"=\"place_of_worship\"][\"religion\"=\"muslim\"]\(name)(around:\(radius),\(rl),\(ro));out center tags 80;"
    var req = URLRequest(url: URL(string: "https://overpass-api.de/api/interpreter")!)
    req.httpMethod = "POST"; req.timeoutInterval = 25
    req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
    req.setValue("Sakinah/5.1 (+https://github.com/osamafa86-dotcom/mediapro)", forHTTPHeaderField: "User-Agent")
    let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-._~"))
    req.httpBody = ("data=" + (ql.addingPercentEncoding(withAllowedCharacters: allowed) ?? ql)).data(using: .utf8)
    let (data, resp) = try await URLSession.shared.data(for: req)
    guard let h = resp as? HTTPURLResponse, (200..<300).contains(h.statusCode) else { throw URLError(.badServerResponse) }
    struct R: Decodable {
      struct E: Decodable { struct C: Decodable { let lat: Double; let lon: Double }; let type: String; let id: Int64; let lat: Double?; let lon: Double?; let center: C?; let tags: [String: String]? }
      let elements: [E]
    }
    let r = try JSONDecoder().decode(R.self, from: data)
    return r.elements.compactMap { e in
      guard let la = e.center?.lat ?? e.lat, let lo = e.center?.lon ?? e.lon else { return nil }
      let t = e.tags ?? [:]
      let name = t["name:ar"] ?? t["name"] ?? "مسجد (بلا اسم)"
      let addr = [t["addr:street"], t["addr:city"]].compactMap { $0 }.joined(separator: "، ")
      return Mosque(id: "osm/\(e.type)/\(e.id)", name: name, latitude: la, longitude: lo, address: addr.isEmpty ? nil : addr, distanceKm: 0, bearing: 0)
    }
  }
}
