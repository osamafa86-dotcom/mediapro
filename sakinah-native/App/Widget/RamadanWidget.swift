import SwiftUI
import WidgetKit
import AppIntents
import SakinahCore

// MARK: - ودجت رمضان (المرحلة الرابعة — ramadan-widget.png)
// «١٢ رمضان»، «السحور حتى ٤:٤٠»، «الإفطار ٥:٢٢»، «بعد ٢٣ دقيقة» فوق سماء الغروب.
// يحسب الامتداد كلّ شيء بنفسه من النواة (لا App Group — لا صلاحيات جديدة): المكان والطريقة من إعدادات الودجت نفسها،
// والهجري من أمّ القرى **بلا إزاحة المستخدم** (±يومين في إعدادات التطبيق لا يراها الامتداد)، والإمساك قبل الفجر
// بعشر دقائق (افتراض التطبيق؛ إعداد «الإمساك قبل الفجر» في التطبيق لا يصل الامتداد كذلك).

struct RamadanEntry: TimelineEntry {
  let date: Date
  let place: String
  let tz: TimeZone
  let numerals: String
  /// يوم رمضان للصوم القادم أو الجاري (بعد المغرب: صوم الغد)، أو nil خارج الشهر
  let day: Int?
  let imsak: Date?
  let iftar: Date?
  /// قبل الإمساك (ليلًا): العدّ إليه — وإلا إلى الإفطار
  let beforeImsak: Bool
  /// خارج رمضان: الأيام الباقية إليه
  let daysToRamadan: Int?
  /// أوّل أيام العيد (بعد آخر إفطار)
  let eid: Bool
  let message: String?

  static var placeholder: RamadanEntry {
    let now = Date()
    return RamadanEntry(date: now, place: "مكة المكرمة", tz: .current, numerals: "latn", day: 12,
                        imsak: now.addingTimeInterval(-11 * 3600), iftar: now.addingTimeInterval(23 * 60),
                        beforeImsak: false, daysToRamadan: nil, eid: false, message: nil)
  }

  static func missing(_ now: Date, numerals: String) -> RamadanEntry {
    RamadanEntry(date: now, place: "", tz: .current, numerals: numerals, day: nil, imsak: nil, iftar: nil, beforeImsak: false,
                 daysToRamadan: nil, eid: false, message: "افتح التطبيق وحدّد موقعك أو اختر مدينة من إعدادات الودجت")
  }

  /// الموعد الذي يُعدّ إليه
  var target: Date? { beforeImsak ? imsak : iftar }
}

/// الخطّ الزمني على الجهاز بلا اتصال: مدخلٌ كل دقيقة لساعتين (كي يبقى «بعد ٢٣ دقيقة» صحيحًا)، وعند الإمساك والمغرب
/// ومنتصف الليل خلال يوم؛ وخارج رمضان مدخلٌ عند كل منتصف ليل
struct RamadanProvider: AppIntentTimelineProvider {
  /// الإمساك قبل الفجر بالدقائق — افتراض التطبيق (الامتداد لا يقرأ إعداداته)
  static let imsakMinutes: Double = 10

  func placeholder(in context: Context) -> RamadanEntry { .placeholder }

  func snapshot(for configuration: PrayerWidgetIntent, in context: Context) async -> RamadanEntry {
    guard let place = PrayerProvider().resolve(configuration) else { return .placeholder }
    return entry(place, at: Date())
  }

  func timeline(for configuration: PrayerWidgetIntent, in context: Context) async -> Timeline<RamadanEntry> {
    let now = Date()
    guard let place = PrayerProvider().resolve(configuration) else {
      return Timeline(entries: [RamadanEntry.missing(now, numerals: configuration.numerals.rawValue)], policy: .after(now.addingTimeInterval(1800)))
    }
    let first = entry(place, at: now)
    let horizon = now.addingTimeInterval(86400)
    var dates = Set<Date>()
    // منتصف الليل: يتبدّل اليوم الهجري (ويدخل رمضان أو يخرج)
    var civil = CivilDate(now, in: place.tz)
    for _ in 0..<2 {
      civil = civil.adding(days: 1)
      let m = civil.localMidnight(in: place.tz)
      if m > now && m < horizon { dates.insert(m) }
    }
    guard first.day != nil else {
      let entries = [first] + dates.sorted().map { entry(place, at: $0) }
      return Timeline(entries: entries, policy: .after(now.addingTimeInterval(6 * 3600)))
    }
    // الإمساك والمغرب اليوم والغد
    let today = CivilDate(now, in: place.tz)
    for d in [today, today.adding(days: 1)] {
      let times = PrayerTimes.compute(coords: place.coords, date: d, params: params(place, at: d.localNoon(in: place.tz)))
      if let f = times.fajr {
        let imsak = f.addingTimeInterval(-Self.imsakMinutes * 60)
        if imsak > now && imsak < horizon { dates.insert(imsak) }
      }
      if let m = times.maghrib, m > now, m < horizon { dates.insert(m) }
    }
    // كل دقيقة تامّة لساعتين
    let firstMinute = (now.timeIntervalSinceReferenceDate / 60).rounded(.down) * 60 + 60
    for i in 0..<120 { dates.insert(Date(timeIntervalSinceReferenceDate: firstMinute + Double(i) * 60)) }
    let entries = [first] + dates.sorted().map { entry(place, at: $0) }
    return Timeline(entries: entries, policy: .after(Date(timeIntervalSinceReferenceDate: firstMinute + 119 * 60)))
  }

  private func params(_ place: WidgetPlace, at date: Date) -> PrayerParams {
    var p = place.params
    p.isRamadan = Hijri.isRamadan(date, tz: place.tz)
    return p
  }

  /// مدخل للحظة: صوم اليوم حتى المغرب، ثم صوم الغد (سحوره وإمساكه وإفطاره)
  func entry(_ place: WidgetPlace, at date: Date) -> RamadanEntry {
    let tz = place.tz
    let today = CivilDate(date, in: tz)
    let todayTimes = PrayerTimes.compute(coords: place.coords, date: today, params: params(place, at: date))
    let afterIftar = todayTimes.maghrib.map { date >= $0 } ?? false
    let fastDay = afterIftar ? today.adding(days: 1) : today
    let noon = fastDay.localNoon(in: tz)
    let h = Hijri.date(noon, tz: tz)
    guard h.month == 9 else {
      let eid = h.month == 10 && h.day == 1
      return RamadanEntry(date: date, place: place.name, tz: tz, numerals: place.numerals, day: nil, imsak: nil, iftar: nil,
                          beforeImsak: false, daysToRamadan: eid ? nil : daysToRamadan(from: noon, tz: tz), eid: eid, message: nil)
    }
    let times = afterIftar ? PrayerTimes.compute(coords: place.coords, date: fastDay, params: params(place, at: noon)) : todayTimes
    let imsak = times.fajr.map { $0.addingTimeInterval(-Self.imsakMinutes * 60) }
    let beforeImsak = imsak.map { date < $0 } ?? false
    return RamadanEntry(date: date, place: place.name, tz: tz, numerals: place.numerals, day: h.day, imsak: imsak, iftar: times.maghrib,
                        beforeImsak: beforeImsak, daysToRamadan: nil, eid: false, message: nil)
  }

  /// الأيام حتى أوّل رمضان قادم (حتى ٤٠٠ يوم)
  private func daysToRamadan(from date: Date, tz: TimeZone) -> Int? {
    var d = date
    for n in 0..<400 {
      if Hijri.date(d, tz: tz).month == 9 { return n }
      d = d.addingTimeInterval(86400)
    }
    return nil
  }
}

struct RamadanWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: "org.emdatra.sakinah.ramadan", intent: PrayerWidgetIntent.self, provider: RamadanProvider()) { entry in
      RamadanWidgetView(entry: entry)
    }
    .configurationDisplayName("رمضان")
    .description("السحور حتى الإمساك، والإفطار وعدٌّ إليه، ويوم الشهر")
    .supportedFamilies([.systemSmall, .accessoryRectangular])
  }
}

struct RamadanWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: RamadanEntry

  private var ink: WidgetInk { WidgetInk(.ghurub) }
  private func num(_ v: Int) -> String { WFmt.number(v, entry.numerals) }
  private func time(_ d: Date?) -> String { d.map { WFmt.time($0, tz: entry.tz, numerals: entry.numerals) } ?? "—" }
  private var remaining: String {
    guard let t = entry.target else { return "" }
    return "بعد \(WFmt.longRemaining(t.timeIntervalSince(entry.date), entry.numerals))"
  }

  var body: some View {
    content
      .environment(\.layoutDirection, .rightToLeft)
      .environment(\.locale, WFmt.locale(entry.numerals))
      .widgetURL(SakinahURL.today)
      .containerBackground(for: .widget) { background }
  }

  @ViewBuilder private var background: some View {
    if family == .systemSmall {
      LinearGradient(colors: SkyPalette.of(.ghurub).stops.map { $0.wColor }, startPoint: .top, endPoint: .bottom)
    } else {
      Color.clear
    }
  }

  @ViewBuilder private var content: some View {
    if let msg = entry.message {
      if family == .systemSmall {
        Text(msg).font(.system(size: 12)).foregroundStyle(ink.text).multilineTextAlignment(.center)
      } else {
        Label("حدّد موقعك", systemImage: "location.slash")
      }
    } else if let day = entry.day {
      if family == .systemSmall { small(day) } else { rectangular(day) }
    } else {
      outside
    }
  }

  // MARK: صغير (ramadan-widget.png)
  private func small(_ day: Int) -> some View {
    VStack(alignment: .leading, spacing: 0) {
      Text("\(num(day)) رمضان").font(.system(size: 13, weight: .semibold)).foregroundStyle(ink.soft).lineLimit(1)
      Spacer(minLength: 4)
      row("السحور حتى", time(entry.imsak), on: entry.beforeImsak)
      row("الإفطار", time(entry.iftar), on: !entry.beforeImsak).padding(.top, 4)
      Spacer(minLength: 4)
      Text(remaining).font(.system(size: 12, weight: .medium)).foregroundStyle(ink.muted).lineLimit(1).minimumScaleFactor(0.8)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }

  /// صفّ «الاسم … الوقت»: الموعد الذي يُعدّ إليه بخطٍّ أكبر
  private func row(_ label: String, _ value: String, on: Bool) -> some View {
    HStack(alignment: .firstTextBaseline, spacing: 6) {
      Text(label).font(.system(size: on ? 15 : 13, weight: on ? .bold : .medium)).foregroundStyle(on ? ink.text : ink.soft).lineLimit(1).minimumScaleFactor(0.8)
      Spacer(minLength: 4)
      Text(value).font(.system(size: on ? 20 : 15, weight: on ? .bold : .medium)).monospacedDigit().foregroundStyle(on ? ink.text : ink.soft)
        .lineLimit(1).minimumScaleFactor(0.7)
    }
  }

  // MARK: شاشة القفل
  private func rectangular(_ day: Int) -> some View {
    let label = entry.beforeImsak ? "الإمساك" : "الإفطار"
    let at = entry.beforeImsak ? entry.imsak : entry.iftar
    return VStack(alignment: .leading, spacing: 1) {
      HStack(spacing: 4) {
        Image(systemName: entry.beforeImsak ? "moon.stars.fill" : "sunset.fill").font(.system(size: 12, weight: .semibold))
        Text("\(label) \(time(at))").font(.system(size: 15, weight: .bold)).lineLimit(1).minimumScaleFactor(0.8)
      }
      .widgetAccentable()
      Text(remaining).font(.system(size: 13, weight: .medium)).lineLimit(1).minimumScaleFactor(0.8)
      Text("\(num(day)) رمضان").font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(1)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  // MARK: خارج رمضان
  /// «بعد ٩٦ يومًا» قبل الشهر، أو تهنئة العيد في أوّل أيامه
  private var outsideLine: String {
    if entry.eid { return "عيدٌ مبارك، تقبّل الله منّا ومنكم" }
    guard let n = entry.daysToRamadan else { return "" }
    return "بعد " + WFmt.counted(n, entry.numerals, one: "يوم واحد", two: "يومين", few: "أيام", many: "يومًا")
  }

  @ViewBuilder private var outside: some View {
    let line = outsideLine
    if family == .systemSmall {
      VStack(alignment: .leading, spacing: 4) {
        Image(systemName: "moon.stars.fill").font(.system(size: 15, weight: .semibold)).foregroundStyle(ink.text)
        Spacer(minLength: 0)
        Text(entry.eid ? "العيد" : "رمضان").font(.system(size: 20, weight: .bold)).foregroundStyle(ink.text).lineLimit(1)
        Text(line).font(.system(size: 12, weight: .medium)).foregroundStyle(ink.soft).lineLimit(2).minimumScaleFactor(0.8)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    } else {
      VStack(alignment: .leading, spacing: 1) {
        Text(entry.eid ? "العيد" : "رمضان").font(.system(size: 15, weight: .bold)).widgetAccentable()
        Text(line).font(.system(size: 13)).lineLimit(2).minimumScaleFactor(0.8)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}
