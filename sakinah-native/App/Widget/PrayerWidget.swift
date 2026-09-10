import SwiftUI
import WidgetKit
import AppIntents
import CoreLocation
import SakinahCore

/// مدينة من قاعدة المدن المضمّنة لاختيارها في إعدادات الودجت
struct CityEntity: AppEntity {
  static var typeDisplayRepresentation: TypeDisplayRepresentation = "مدينة"
  static var defaultQuery = CityQuery()
  var id: String
  var name: String
  var country: String
  var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)", subtitle: "\(country)") }
  init(_ c: City) { id = c.id; name = c.nameAr; country = c.countryAr }
}
struct CityQuery: EntityStringQuery {
  func entities(for identifiers: [String]) async throws -> [CityEntity] { identifiers.compactMap { CityDatabase.bundled.city(id: $0) }.map(CityEntity.init) }
  func entities(matching string: String) async throws -> [CityEntity] { CityDatabase.bundled.search(string, limit: 30).map(CityEntity.init) }
  func suggestedEntities() async throws -> [CityEntity] { CityDatabase.bundled.cities.prefix(40).map(CityEntity.init) }
}
enum MadhabOption: String, AppEnum {
  case shafi, hanafi
  static var typeDisplayRepresentation: TypeDisplayRepresentation = "مذهب العصر"
  static var caseDisplayRepresentations: [MadhabOption: DisplayRepresentation] = [.shafi: "الجمهور (مثل واحد)", .hanafi: "حنفي (مثلان)"]
}
enum MethodOption: String, AppEnum {
  case auto, UmmAlQura, MuslimWorldLeague, Egyptian, Jordan, Kuwait, Qatar, Dubai, Gulf, Karachi, NorthAmerica, Turkey, Tunisia, Algeria, Morocco, Singapore, JAKIM, Indonesia, MoonsightingCommittee, Tehran, Jafari, France, Russia, Portugal
  static var typeDisplayRepresentation: TypeDisplayRepresentation = "طريقة الحساب"
  static var caseDisplayRepresentations: [MethodOption: DisplayRepresentation] {
    var d: [MethodOption: DisplayRepresentation] = [.auto: DisplayRepresentation(title: "تلقائي حسب الدولة")]
    for c in allCases where c != .auto { d[c] = DisplayRepresentation(title: "\(Methods.method(c.rawValue).nameAr)") }
    return d
  }
}

/// إعدادات الودجت: مدينة أو موقع الجهاز، المذهب، الطريقة
struct PrayerWidgetIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "مواقيت الصلاة"
  static var description = IntentDescription("الصلاة القادمة مع عدّ تنازلي، ومواقيت اليوم")
  @Parameter(title: "المدينة (اتركها فارغة لاستخدام موقع الجهاز)") var city: CityEntity?
  @Parameter(title: "مذهب العصر", default: .shafi) var madhab: MadhabOption
  @Parameter(title: "طريقة الحساب", default: .auto) var method: MethodOption
  init() {}
}

struct PrayerRow: Hashable { let key: Prayer; let name: String; let time: Date }
struct PrayerEntry: TimelineEntry {
  let date: Date
  let place: String
  let hijri: String
  let rows: [PrayerRow]
  let next: PrayerRow?
  let previousTime: Date?
  let message: String?
  static let placeholder = PrayerEntry(date: Date(), place: "مكة المكرمة", hijri: "١ محرم ١٤٤٨هـ",
    rows: Prayer.allCases.enumerated().map { PrayerRow(key: $1, name: $1.nameAr, time: Date().addingTimeInterval(Double($0) * 3600)) },
    next: PrayerRow(key: .dhuhr, name: "الظهر", time: Date().addingTimeInterval(1800)), previousTime: Date().addingTimeInterval(-3600), message: nil)
}

/// الموقع داخل الودجت: آخر موقع معروف للجهاز (بإذن التطبيق) مع حفظه احتياطًا
enum WidgetLocation {
  private static let d = UserDefaults.standard
  static func current() -> (lat: Double, lon: Double)? {
    let m = CLLocationManager()
    if m.isAuthorizedForWidgetUpdates, let l = m.location {
      d.set(l.coordinate.latitude, forKey: "w.lat"); d.set(l.coordinate.longitude, forKey: "w.lon")
      return (l.coordinate.latitude, l.coordinate.longitude)
    }
    if d.object(forKey: "w.lat") != nil { return (d.double(forKey: "w.lat"), d.double(forKey: "w.lon")) }
    return nil
  }
}

struct PrayerProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> PrayerEntry { .placeholder }
  func snapshot(for configuration: PrayerWidgetIntent, in context: Context) async -> PrayerEntry { entry(for: configuration, at: Date()) ?? .placeholder }
  func timeline(for configuration: PrayerWidgetIntent, in context: Context) async -> Timeline<PrayerEntry> {
    let now = Date()
    guard let first = entry(for: configuration, at: now) else {
      return Timeline(entries: [PrayerEntry(date: now, place: "", hijri: "", rows: [], next: nil, previousTime: nil, message: "افتح التطبيق وحدّد موقعك أو اختر مدينة من إعدادات الودجت")], policy: .after(now.addingTimeInterval(1800)))
    }
    var entries = [first]
    // مدخل عند كل موعد قادم خلال 24 ساعة كي يتبدّل «القادمة» في وقتها
    var boundaries = first.rows.map(\.time).filter { $0 > now }
    if let e2 = entry(for: configuration, at: now.addingTimeInterval(86400)) { boundaries += e2.rows.map(\.time).filter { $0 > now && $0 < now.addingTimeInterval(86400) } }
    for b in Array(Set(boundaries)).sorted() { if let e = entry(for: configuration, at: b.addingTimeInterval(1)) { entries.append(e) } }
    return Timeline(entries: entries, policy: .after(now.addingTimeInterval(6 * 3600)))
  }

  /// حساب المواقيت للحظة معيّنة: مدينة الودجت أو موقع الجهاز، والطريقة من الإعداد أو تلقائيًا من الدولة/المنطقة الزمنية
  func entry(for c: PrayerWidgetIntent, at date: Date) -> PrayerEntry? {
    let coords: Coordinates; let tz: TimeZone; let place: String; let cc: String?
    if let ce = c.city, let city = CityDatabase.bundled.city(id: ce.id) { coords = city.coordinates; tz = city.timeZone; place = city.nameAr; cc = city.countryCode }
    else if let l = WidgetLocation.current() { coords = Coordinates(latitude: l.lat, longitude: l.lon); tz = .current; place = CityDatabase.bundled.nearest(lat: l.lat, lon: l.lon).map { $0.km < 60 ? $0.city.nameAr : "موقع الجهاز" } ?? "موقع الجهاز"; cc = nil }
    else { return nil }
    var p = PrayerParams()
    p.method = c.method == .auto ? Methods.defaultMethod(countryCode: cc, tz: tz.identifier) : c.method.rawValue
    p.madhab = c.madhab == .hanafi ? .hanafi : .shafi
    p.isRamadan = Hijri.isRamadan(date, tz: tz)
    let tl = PrayerTimes.dayTimeline(coords: coords, tz: tz, params: p, now: date)
    let rows = Prayer.allCases.compactMap { k in tl.times[k].map { PrayerRow(key: k, name: k.nameAr, time: $0) } }
    let next = PrayerRow(key: tl.next.key, name: tl.next.key.nameAr, time: tl.next.time)
    let prev = tl.times[tl.current] ?? tl.yesterdayIsha
    return PrayerEntry(date: date, place: place, hijri: Hijri.date(date, tz: tz).formatted, rows: rows, next: next, previousTime: prev, message: nil)
  }
}

struct PrayerWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: "org.emdatra.sakinah.prayer", intent: PrayerWidgetIntent.self, provider: PrayerProvider()) { entry in
      PrayerWidgetView(entry: entry).environment(\.layoutDirection, .rightToLeft)
    }
    .configurationDisplayName("مواقيت الصلاة")
    .description("الصلاة القادمة مع عدّ تنازلي، ومواقيت اليوم كلها")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
  }
}

struct PrayerWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: PrayerEntry
  private let teal = Color(red: 0.059, green: 0.463, blue: 0.431)
  private func time(_ d: Date) -> String { let f = DateFormatter(); f.locale = Locale(identifier: "ar_SA@numbers=latn"); f.dateFormat = "h:mm"; return f.string(from: d) }
  private var progress: Double {
    guard let n = entry.next, let p = entry.previousTime, n.time > p else { return 0 }
    return min(1, max(0, Date().timeIntervalSince(p) / n.time.timeIntervalSince(p)))
  }
  var body: some View {
    Group {
      if let msg = entry.message { Text(msg).font(.system(size: 12)).multilineTextAlignment(.center) }
      else {
        switch family {
        case .accessoryInline: if let n = entry.next { Text("\(n.name) ") + Text(n.time, style: .timer) }
        case .accessoryCircular:
          Gauge(value: progress) { Image(systemName: "moon.stars") } currentValueLabel: { Text(entry.next?.name ?? "").font(.system(size: 11, weight: .bold)) }.gaugeStyle(.accessoryCircular)
        case .accessoryRectangular:
          VStack(alignment: .leading, spacing: 2) {
            if let n = entry.next {
              Text("الصلاة القادمة: \(n.name)").font(.system(size: 13, weight: .bold))
              HStack { Text(n.time, style: .time); Spacer(); Text(n.time, style: .timer).monospacedDigit() }.font(.system(size: 12))
            }
            Text(entry.place).font(.system(size: 10)).foregroundStyle(.secondary).lineLimit(1)
          }
        case .systemSmall:
          VStack(alignment: .leading, spacing: 4) {
            Text(entry.place).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(1)
            Spacer(minLength: 0)
            if let n = entry.next {
              Text(n.name).font(.system(size: 26, weight: .bold)).foregroundStyle(teal)
              Text(n.time, style: .time).font(.system(size: 18, weight: .semibold))
              Text(n.time, style: .timer).font(.system(size: 13)).monospacedDigit().foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
            Text(entry.hijri).font(.system(size: 10)).foregroundStyle(.secondary).lineLimit(1)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
        default:
          VStack(spacing: 6) {
            HStack { Text(entry.place).font(.system(size: 12, weight: .semibold)); Spacer(); Text(entry.hijri).font(.system(size: 11)).foregroundStyle(.secondary) }.lineLimit(1)
            HStack(spacing: 4) {
              ForEach(entry.rows.filter { $0.key != .sunrise }, id: \.key) { r in
                let isNext = r.key == entry.next?.key
                VStack(spacing: 3) {
                  Text(r.name).font(.system(size: 11, weight: isNext ? .bold : .regular))
                  Text(time(r.time)).font(.system(size: 13, weight: isNext ? .bold : .regular)).monospacedDigit()
                }
                .frame(maxWidth: .infinity).padding(.vertical, 6).background(isNext ? teal.opacity(0.18) : Color.clear, in: RoundedRectangle(cornerRadius: 8))
                .foregroundStyle(isNext ? teal : .primary)
              }
            }
            if let n = entry.next { HStack { Text("القادمة: \(n.name)").font(.system(size: 11)); Spacer(); Text(n.time, style: .timer).font(.system(size: 11)).monospacedDigit() }.foregroundStyle(.secondary) }
          }
        }
      }
    }
    .containerBackground(for: .widget) { Color(.systemBackground) }
  }
}
