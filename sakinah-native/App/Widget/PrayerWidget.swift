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
  // قاموس حرفي: معالج بيانات AppIntents يرفض القيم المحسوبة
  static var caseDisplayRepresentations: [MethodOption: DisplayRepresentation] = [
    .auto: "تلقائي حسب الدولة",
    .UmmAlQura: "جامعة أم القرى (السعودية)",
    .MuslimWorldLeague: "رابطة العالم الإسلامي",
    .Egyptian: "الهيئة المصرية العامة للمساحة",
    .Jordan: "وزارة الأوقاف الأردنية",
    .Kuwait: "الكويت",
    .Qatar: "قطر",
    .Dubai: "دبي (الإمارات)",
    .Gulf: "منطقة الخليج",
    .Karachi: "جامعة العلوم الإسلامية (كراتشي)",
    .NorthAmerica: "الجمعية الإسلامية لأمريكا الشمالية (ISNA)",
    .Turkey: "رئاسة الشؤون الدينية (تركيا)",
    .Tunisia: "تونس",
    .Algeria: "وزارة الشؤون الدينية الجزائرية",
    .Morocco: "وزارة الأوقاف المغربية",
    .Singapore: "المجلس الإسلامي بسنغافورة (MUIS)",
    .JAKIM: "دائرة التقدم الإسلامي الماليزية (JAKIM)",
    .Indonesia: "وزارة الشؤون الدينية الإندونيسية",
    .MoonsightingCommittee: "لجنة رؤية الهلال العالمية",
    .Tehran: "معهد الجيوفيزياء – جامعة طهران",
    .Jafari: "الطريقة الجعفرية (قم)",
    .France: "اتحاد المنظمات الإسلامية في فرنسا",
    .Russia: "الإدارة الدينية لمسلمي روسيا",
    .Portugal: "الجالية الإسلامية في لشبونة",
  ]
}
/// الأرقام في الودجت — الامتداد لا يقرأ إعدادات التطبيق (لا App Group) فيُختار هنا
enum NumeralsOption: String, AppEnum {
  case latn, arab
  static var typeDisplayRepresentation: TypeDisplayRepresentation = "الأرقام"
  static var caseDisplayRepresentations: [NumeralsOption: DisplayRepresentation] = [.latn: "لاتينية (123)", .arab: "عربية (١٢٣)"]
}

/// إعدادات الودجت: مدينة أو موقع الجهاز، المذهب، الطريقة، الأرقام
struct PrayerWidgetIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "مواقيت الصلاة"
  static var description = IntentDescription("الصلاة القادمة مع عدّ تنازلي، ومواقيت اليوم")
  @Parameter(title: "المدينة (اتركها فارغة لاستخدام موقع الجهاز)") var city: CityEntity?
  @Parameter(title: "مذهب العصر", default: .shafi) var madhab: MadhabOption
  @Parameter(title: "طريقة الحساب", default: .auto) var method: MethodOption
  @Parameter(title: "الأرقام", default: .latn) var numerals: NumeralsOption
  init() {}
}

struct PrayerRow: Hashable { let key: Prayer; let name: String; let time: Date }
/// أذكار الوقت في المدخل (القاعدة في AdhkarNowRule المشتركة مع النشاط المباشر)
struct AdhkarSlot: Hashable { let period: String; let title: String; let subtitle: String; let upcoming: Bool }
/// حديث اليوم من النواة (ملف الأحاديث مضمَّن في حزمة SakinahCore فيقرؤه الامتداد بلا بيانات التطبيق)
struct DailyHadith: Hashable { let text: String; let source: String }

struct PrayerEntry: TimelineEntry {
  let date: Date
  let place: String
  let tz: TimeZone
  let numerals: String
  let rows: [PrayerRow]
  let next: PrayerRow?
  /// الوقت الحالي وبدايته (لحلقة شاشة القفل)
  let current: Prayer?
  let windowStart: Date?
  /// طور السماء عند لحظة المدخل — يتبدّل عند حدود الأطوار وحدها
  let sky: SkyPhase
  let hijri: HijriDate
  let adhkar: AdhkarSlot?
  let hadith: DailyHadith?
  let message: String?

  static var placeholder: PrayerEntry {
    let now = Date()
    let rows = Prayer.allCases.enumerated().map { PrayerRow(key: $1, name: $1.nameAr, time: now.addingTimeInterval(Double($0 - 4) * 3600)) }
    return PrayerEntry(date: now, place: "مكة المكرمة", tz: .current, numerals: "latn", rows: rows,
                       next: PrayerRow(key: .maghrib, name: Prayer.maghrib.nameAr, time: now.addingTimeInterval(42 * 60)),
                       current: .asr, windowStart: now.addingTimeInterval(-90 * 60), sky: .asr, hijri: Hijri.date(now, tz: .current),
                       adhkar: AdhkarSlot(period: "evening", title: "أذكار المساء", subtitle: "أذكار اليوم", upcoming: false),
                       hadith: DailyHadith(text: "إنّما الأعمال بالنيّات", source: "متفق عليه"), message: nil)
  }

  static func missingLocation(_ now: Date, numerals: String) -> PrayerEntry {
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = .current
    return PrayerEntry(date: now, place: "", tz: .current, numerals: numerals, rows: [], next: nil, current: nil, windowStart: nil,
                       sky: SkyEngine.fallbackPhase(hour: cal.component(.hour, from: now)), hijri: Hijri.date(now, tz: .current),
                       adhkar: nil, hadith: nil, message: "افتح التطبيق وحدّد موقعك أو اختر مدينة من إعدادات الودجت")
  }
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

/// المكان المحسوم لخطّ زمني واحد (يُحسم مرّة ثم تُحسب كل المدخلات منه)
struct WidgetPlace {
  let coords: Coordinates
  let tz: TimeZone
  let name: String
  let params: PrayerParams
  let numerals: String

  func timeline(at date: Date) -> PrayerTimes.DayTimeline {
    var p = params
    p.isRamadan = Hijri.isRamadan(date, tz: tz)
    return PrayerTimes.dayTimeline(coords: coords, tz: tz, params: p, now: date)
  }
}

/// الخطّ الزمني يُحسب كلّه على الجهاز بلا اتصال: مدخلٌ عند كل صلاة وكل حدّ طور سماء وكل منتصف ليل خلال ٢٤ ساعة،
/// ومدخلٌ كل دقيقة لساعتين كي يبقى «بعد ٤٢ د» وحلقة القفل صحيحين، ثم يُطلب خطٌّ جديد
struct PrayerProvider: AppIntentTimelineProvider {
  /// عدد مدخلات الدقائق (صفر لودجت لا يعرض عدًّا كأذكار الوقت)
  var minuteEntries = 120

  func placeholder(in context: Context) -> PrayerEntry { .placeholder }

  func snapshot(for configuration: PrayerWidgetIntent, in context: Context) async -> PrayerEntry {
    guard let place = resolve(configuration) else { return .placeholder }
    return entry(place, at: Date())
  }

  func timeline(for configuration: PrayerWidgetIntent, in context: Context) async -> Timeline<PrayerEntry> {
    let now = Date()
    guard let place = resolve(configuration) else {
      return Timeline(entries: [PrayerEntry.missingLocation(now, numerals: configuration.numerals.rawValue)], policy: .after(now.addingTimeInterval(1800)))
    }
    let horizon = now.addingTimeInterval(86400)
    var dates = Set<Date>()
    // الصلوات وحدود أطوار السماء (اليوم والغد)
    for d in [now, horizon] {
      let tl = place.timeline(at: d)
      for k in Prayer.allCases {
        if let t = tl.times[k], t > now, t < horizon { dates.insert(t) }
      }
      if tl.next.time > now && tl.next.time < horizon { dates.insert(tl.next.time) }
      for b in WidgetSky.boundaries(timeline: tl, tz: place.tz, after: now, before: horizon) { dates.insert(b) }
    }
    // منتصف الليل: يتبدّل الهجري وحديث اليوم
    var day = CivilDate(now, in: place.tz)
    for _ in 0..<2 {
      day = day.adding(days: 1)
      let m = day.localMidnight(in: place.tz)
      if m > now && m < horizon { dates.insert(m) }
    }
    // كل دقيقة تامّة لساعتين
    let firstMinute = (now.timeIntervalSinceReferenceDate / 60).rounded(.down) * 60 + 60
    let count = max(0, minuteEntries)
    for i in 0..<count { dates.insert(Date(timeIntervalSinceReferenceDate: firstMinute + Double(i) * 60)) }

    let entries = [entry(place, at: now)] + dates.sorted().map { entry(place, at: $0) }
    let refresh = count > 0 ? Date(timeIntervalSinceReferenceDate: firstMinute + Double(count - 1) * 60) : now.addingTimeInterval(6 * 3600)
    return Timeline(entries: entries, policy: .after(refresh))
  }

  /// مدينة الودجت أو موقع الجهاز، والطريقة من الإعداد أو تلقائيًا من الدولة/المنطقة الزمنية
  func resolve(_ c: PrayerWidgetIntent) -> WidgetPlace? {
    let coords: Coordinates
    let tz: TimeZone
    let name: String
    let cc: String?
    if let ce = c.city, let city = CityDatabase.bundled.city(id: ce.id) {
      coords = city.coordinates; tz = city.timeZone; name = city.nameAr; cc = city.countryCode
    } else if let l = WidgetLocation.current() {
      coords = Coordinates(latitude: l.lat, longitude: l.lon); tz = .current; cc = nil
      name = CityDatabase.bundled.nearest(lat: l.lat, lon: l.lon).map { $0.km < 60 ? $0.city.nameAr : "موقع الجهاز" } ?? "موقع الجهاز"
    } else {
      return nil
    }
    var p = PrayerParams()
    p.method = c.method == .auto ? Methods.defaultMethod(countryCode: cc, tz: tz.identifier) : c.method.rawValue
    p.madhab = c.madhab == .hanafi ? .hanafi : .shafi
    return WidgetPlace(coords: coords, tz: tz, name: name, params: p, numerals: c.numerals.rawValue)
  }

  /// مدخل للحظة: المواقيت، القادمة، الطور، الهجري، أذكار الوقت، حديث اليوم
  func entry(_ place: WidgetPlace, at date: Date) -> PrayerEntry {
    let tl = place.timeline(at: date)
    let rows = Prayer.allCases.compactMap { k in tl.times[k].map { PrayerRow(key: k, name: k.nameAr, time: $0) } }
    let next = PrayerRow(key: tl.next.key, name: tl.next.key.nameAr, time: tl.next.time)
    var start: Date? = tl.yesterdayIsha
    if let t = tl.times[tl.current], t <= date { start = t }
    var slot: AdhkarSlot? = nil
    if let r = AdhkarNowRule.period(now: date, fajr: tl.times.fajr, dhuhr: tl.times.dhuhr, asr: tl.times.asr, isha: tl.times.isha) {
      slot = AdhkarSlot(period: r.period, title: AdhkarNowRule.title(r.period),
                        subtitle: adhkarSubtitle(r.period, upcoming: r.upcoming, numerals: place.numerals), upcoming: r.upcoming)
    }
    let h = HadithLibrary.hadithOfDay(date, tz: place.tz)
    let source = h.alsoIn != nil ? "متفق عليه" : (h.collection == "bukhari" ? "رواه البخاري" : "رواه مسلم")
    return PrayerEntry(date: date, place: place.name, tz: place.tz, numerals: place.numerals, rows: rows, next: next,
                       current: tl.current, windowStart: start, sky: WidgetSky.phase(at: date, timeline: tl, tz: place.tz),
                       hijri: Hijri.date(date, tz: place.tz), adhkar: slot, hadith: DailyHadith(text: h.text, source: source), message: nil)
  }

  private func adhkarSubtitle(_ period: String, upcoming: Bool, numerals: String) -> String {
    if upcoming { return "تبدأ مع العصر" }
    if period == "sleep" { return "قبل أن تنام" }
    return WFmt.dhikrCount(Adhkar.items(for: period).count, numerals)
  }
}

struct PrayerWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: "org.emdatra.sakinah.prayer", intent: PrayerWidgetIntent.self, provider: PrayerProvider()) { entry in
      PrayerWidgetView(entry: entry)
    }
    .configurationDisplayName("مواقيت الصلاة")
    .description("الصلاة القادمة فوق سماء الوقت، ومواقيت اليوم وأذكاره")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryCircular, .accessoryRectangular, .accessoryInline])
  }
}

/// الودجت بتصميم «اليوم الحيّ»: سماء الطور خلف الصلاة القادمة (widgets.png)، وعناصر شاشة القفل (lock.png)
struct PrayerWidgetView: View {
  @Environment(\.widgetFamily) private var family
  @Environment(\.showsWidgetContainerBackground) private var showsBackground
  let entry: PrayerEntry

  /// حين تُزال الخلفية (StandBy مثلًا) يُعامل النصّ كأنه فوق سماء داكنة
  private var ink: WidgetInk { WidgetInk(entry.sky, forceDark: !showsBackground) }
  private func time(_ d: Date) -> String { WFmt.time(d, tz: entry.tz, numerals: entry.numerals) }
  private func left(_ n: PrayerRow) -> TimeInterval { n.time.timeIntervalSince(entry.date) }

  var body: some View {
    content
      .environment(\.layoutDirection, .rightToLeft)
      .environment(\.locale, WFmt.locale(entry.numerals))
      .widgetURL(SakinahURL.today)
      .containerBackground(for: .widget) { background }
  }

  @ViewBuilder private var background: some View {
    switch family {
    case .systemSmall: WidgetSkyBackground(phase: entry.sky, discAt: UnitPoint(x: 0.27, y: 0.22))
    case .systemMedium: WidgetSkyBackground(phase: entry.sky, discAt: UnitPoint(x: 0.6, y: 0.17))
    case .systemLarge: WidgetSkyBackground(phase: entry.sky, discAt: UnitPoint(x: 0.6, y: 0.08))
    default: Color.clear
    }
  }

  @ViewBuilder private var content: some View {
    if let msg = entry.message {
      message(msg)
    } else if let n = entry.next {
      switch family {
      case .accessoryInline: inline(n)
      case .accessoryCircular: ring(n)
      case .accessoryRectangular: rectangular(n)
      case .systemSmall: small(n)
      case .systemLarge: large(n)
      default: medium(n)
      }
    }
  }

  @ViewBuilder private func message(_ msg: String) -> some View {
    switch family {
    case .accessoryInline, .accessoryCircular, .accessoryRectangular:
      Label("حدّد موقعك", systemImage: "location.slash")
    default:
      VStack(spacing: 6) {
        Image(systemName: "location.slash").font(.system(size: 18)).foregroundStyle(ink.muted)
        Text(msg).font(.system(size: 12)).foregroundStyle(ink.text).multilineTextAlignment(.center)
      }
    }
  }

  // MARK: الشاشة الرئيسية

  /// صغير: المدينة، اسم الصلاة، الوقت كبيرًا، «بعد ٤٢ د»
  private func small(_ n: PrayerRow) -> some View {
    VStack(alignment: .leading, spacing: 0) {
      Text(entry.place).font(.system(size: 11, weight: .medium)).foregroundStyle(ink.soft).lineLimit(1)
      Spacer(minLength: 0)
      Text(n.name).font(.system(size: 17, weight: .bold)).foregroundStyle(ink.text).lineLimit(1).minimumScaleFactor(0.7)
      Text(time(n.time)).font(.system(size: 44, weight: .light)).monospacedDigit().foregroundStyle(ink.text)
        .lineLimit(1).minimumScaleFactor(0.6)
      Text("بعد \(WFmt.shortRemaining(left(n), entry.numerals))").font(.system(size: 12, weight: .semibold))
        .foregroundStyle(ink.soft).lineLimit(1)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }

  /// متوسط: الصلاة القادمة وأذكار الوقت، ثم شريط الصلوات الخمس بإبراز القادمة
  private func medium(_ n: PrayerRow) -> some View {
    VStack(alignment: .leading, spacing: 0) {
      header(n)
      Spacer(minLength: 6)
      strip(n)
    }
  }

  /// كبير: المتوسط + حديث اليوم
  private func large(_ n: PrayerRow) -> some View {
    VStack(alignment: .leading, spacing: 12) {
      header(n)
      strip(n)
      // TODO(App Group): بطاقة «ورد اليوم» (الختمة وتقدّمها) تحتاج بيانات التطبيق — الامتداد بلا App Group مشترك
      // (لا صلاحيات جديدة في هذه المرحلة)؛ تُضاف هنا حين يُعتمد group.org.emdatra.sakinah في الهدفين.
      if let h = entry.hadith { hadithCard(h) }
      Spacer(minLength: 0)
    }
  }

  private func header(_ n: PrayerRow) -> some View {
    HStack(alignment: .top, spacing: 8) {
      VStack(alignment: .leading, spacing: 2) {
        Text("\(n.name) \(time(n.time))").font(.system(size: 19, weight: .bold)).monospacedDigit()
          .foregroundStyle(ink.text).lineLimit(1).minimumScaleFactor(0.75)
        Text("بعد \(WFmt.shortRemaining(left(n), entry.numerals))").font(.system(size: 12, weight: .medium))
          .foregroundStyle(ink.soft).lineLimit(1)
      }
      Spacer(minLength: 6)
      if let a = entry.adhkar {
        Link(destination: SakinahURL.adhkar(a.period)) { adhkarChip(a) }
      }
    }
  }

  private func adhkarChip(_ a: AdhkarSlot) -> some View {
    HStack(spacing: 4) {
      Image(systemName: "sparkles").font(.system(size: 10, weight: .semibold))
      Text(a.title).font(.system(size: 11, weight: .semibold)).lineLimit(1)
    }
    .foregroundStyle(WDS.hex(0x16211F))
    .padding(.horizontal, 10).padding(.vertical, 6)
    .background(Capsule().fill(Color.white.opacity(0.86)))
  }

  /// الصلوات الخمس (بلا الشروق)؛ فجر الغد بموعده إن كان هو القادم
  private func fivePrayers(_ n: PrayerRow) -> [PrayerRow] {
    entry.rows.filter { $0.key != .sunrise }.map { r in
      r.key == n.key ? PrayerRow(key: r.key, name: r.name, time: n.time) : r
    }
  }

  private func strip(_ n: PrayerRow) -> some View {
    let five = fivePrayers(n)
    let highlight: Prayer = n.key == .sunrise ? .dhuhr : n.key
    let ink = self.ink
    return HStack(spacing: 2) {
      ForEach(five, id: \.key) { r in
        VStack(spacing: 2) {
          Text(r.name).font(.system(size: 10, weight: .medium)).foregroundStyle(ink.stripText.opacity(0.75))
            .lineLimit(1).minimumScaleFactor(0.7)
          Text(time(r.time)).font(.system(size: 13, weight: .bold)).monospacedDigit().foregroundStyle(ink.stripText)
            .lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(RoundedRectangle(cornerRadius: 9, style: .continuous).fill(r.key == highlight ? ink.stripHighlight : Color.clear))
      }
    }
    .padding(4)
    .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(ink.strip))
  }

  private func hadithCard(_ h: DailyHadith) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("«\(h.text)»").font(.system(size: 16, weight: .regular, design: .serif)).foregroundStyle(ink.text)
        .lineSpacing(4).lineLimit(5).multilineTextAlignment(.leading)
      Text("حديث اليوم، \(h.source)").font(.system(size: 11, weight: .medium)).foregroundStyle(ink.muted)
    }
    .padding(14)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(ink.card))
  }

  // MARK: شاشة القفل

  private func inline(_ n: PrayerRow) -> some View {
    Text("\(n.name) ") + Text(n.time, style: .timer)
  }

  /// حلقة العدّ إلى الأذان: ما مضى من الوقت الحالي، و«٤٢د» واسم الصلاة في وسطها
  private func ring(_ n: PrayerRow) -> some View {
    Gauge(value: progress(n)) {
      Text(n.name)
    } currentValueLabel: {
      VStack(spacing: 0) {
        Text(WFmt.ringRemaining(left(n), entry.numerals)).font(.system(size: 14, weight: .bold)).lineLimit(1).minimumScaleFactor(0.5)
        Text(n.name).font(.system(size: 9, weight: .medium)).lineLimit(1).minimumScaleFactor(0.6)
      }
    }
    .gaugeStyle(.accessoryCircularCapacity)
    .widgetAccentable()
  }

  /// مستطيل: «المغرب ٤:٥٢»، «بعد ٤٢ دقيقة»، «العصر يمضي، الخليل»
  private func rectangular(_ n: PrayerRow) -> some View {
    VStack(alignment: .leading, spacing: 1) {
      HStack(spacing: 4) {
        Image(systemName: WFmt.symbol(n.key)).font(.system(size: 12, weight: .semibold))
        Text("\(n.name) \(time(n.time))").font(.system(size: 15, weight: .bold)).lineLimit(1).minimumScaleFactor(0.8)
      }
      .widgetAccentable()
      Text("بعد \(WFmt.longRemaining(left(n), entry.numerals))").font(.system(size: 13, weight: .medium))
        .lineLimit(1).minimumScaleFactor(0.8)
      Text(contextLine).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.8)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private var contextLine: String {
    guard let c = entry.current else { return entry.place }
    return entry.place.isEmpty ? "\(WFmt.currentName(c)) يمضي" : "\(WFmt.currentName(c)) يمضي، \(entry.place)"
  }

  private func progress(_ n: PrayerRow) -> Double {
    guard let s = entry.windowStart, n.time > s else { return 0 }
    return min(1, max(0, entry.date.timeIntervalSince(s) / n.time.timeIntervalSince(s)))
  }
}
