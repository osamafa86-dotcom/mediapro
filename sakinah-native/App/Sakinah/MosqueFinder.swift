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
  private static let nameKeys = ["مسجد", "جامع", "مصلى", "مصلّى", "mosque", "masjid", "jami", "camii", "mescit"]

  static func cellKey(_ c: Coordinates) -> String { String(format: "%.2f,%.2f", c.latitude, c.longitude) }

  static func cached(for c: Coordinates) -> [Mosque]? {
    guard let d = UserDefaults.standard.data(forKey: cacheKey), let cache = try? JSONDecoder().decode(Cache.self, from: d),
          cache.key == cellKey(c), Date().timeIntervalSince(cache.at) < 86_400 else { return nil }
    return cache.items.map { rerank($0, from: c) }.sorted { $0.distanceKm < $1.distanceKm }
  }

  func nearby(around c: Coordinates, query: String? = nil, force: Bool = false) async {
    let q = query?.trimmingCharacters(in: .whitespaces) ?? ""
    if !force, q.isEmpty, let hit = Self.cached(for: c) { results = hit; return }
    loading = true; error = nil
    defer { loading = false }
    let req = MKLocalSearch.Request()
    req.naturalLanguageQuery = q.isEmpty ? "مسجد" : "مسجد \(q)"
    let center = CLLocationCoordinate2D(latitude: (c.latitude * 100).rounded() / 100, longitude: (c.longitude * 100).rounded() / 100)
    let span: CLLocationDistance = q.isEmpty ? 6_000 : 20_000
    req.region = MKCoordinateRegion(center: center, latitudinalMeters: span, longitudinalMeters: span)
    req.resultTypes = .pointOfInterest
    do {
      let resp = try await MKLocalSearch(request: req).start()
      var items = resp.mapItems.compactMap { item -> Mosque? in
        guard let name = item.name, !name.isEmpty else { return nil }
        let p = item.placemark
        let addr = [p.thoroughfare, p.subLocality ?? p.locality].compactMap { $0 }.joined(separator: "، ")
        let m = Mosque(id: String(format: "%.5f,%.5f", p.coordinate.latitude, p.coordinate.longitude), name: name,
                       latitude: p.coordinate.latitude, longitude: p.coordinate.longitude, address: addr.isEmpty ? nil : addr, distanceKm: 0, bearing: 0)
        return Self.rerank(m, from: c)
      }
      // ترشيح لطيف: ما يُقرأ مسجدًا في اسمه؛ وإن أفرغ القائمة أُبقيت كما جاءت
      let named = items.filter { m in Self.nameKeys.contains { m.name.lowercased().contains($0) } }
      if !named.isEmpty { items = named }
      items.sort { $0.distanceKm < $1.distanceKm }
      results = Array(items.prefix(40))
      if q.isEmpty { Self.store(results, for: c) }
    } catch {
      self.error = "تعذّر جلب المساجد — تحقّق من الاتصال"
    }
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
