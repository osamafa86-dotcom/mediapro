import SwiftUI
import WidgetKit
import AppIntents
import SakinahCore

// MARK: - أذكار الوقت (صغير): الصباح أو المساء أو النوم بحسب الوقت، ولمسته تفتح جلسة الأذكار في التطبيق

struct AdhkarWidget: Widget {
  var body: some WidgetConfiguration {
    // الخطّ الزمني نفسه بلا مدخلات الدقائق: يتبدّل عند الصلوات وحدود أطوار السماء فقط
    AppIntentConfiguration(kind: "org.emdatra.sakinah.adhkar", intent: PrayerWidgetIntent.self, provider: PrayerProvider(minuteEntries: 0)) { entry in
      AdhkarWidgetView(entry: entry)
    }
    .configurationDisplayName("أذكار الوقت")
    .description("أذكار الصباح أو المساء أو النوم بحسب وقتك، تفتحها بلمسة")
    .supportedFamilies([.systemSmall])
  }
}

struct AdhkarWidgetView: View {
  @Environment(\.showsWidgetContainerBackground) private var showsBackground
  let entry: PrayerEntry

  var body: some View {
    let ink = WidgetInk(entry.sky, forceDark: !showsBackground)
    VStack(alignment: .leading, spacing: 2) {
      Image(systemName: "sparkles").font(.system(size: 15, weight: .semibold)).foregroundStyle(ink.text)
      Spacer(minLength: 0)
      if let a = entry.adhkar {
        Text(a.title).font(.system(size: 18, weight: .bold)).foregroundStyle(ink.text).lineLimit(2).minimumScaleFactor(0.8)
        Text(a.subtitle).font(.system(size: 11, weight: .medium)).foregroundStyle(ink.soft).lineLimit(1).minimumScaleFactor(0.8)
      } else {
        Text("أذكار الوقت").font(.system(size: 18, weight: .bold)).foregroundStyle(ink.text).lineLimit(1)
        Text(entry.message ?? "").font(.system(size: 10)).foregroundStyle(ink.soft).lineLimit(3)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .environment(\.layoutDirection, .rightToLeft)
    .environment(\.locale, WFmt.locale(entry.numerals))
    .widgetURL(entry.adhkar.map { SakinahURL.adhkar($0.period) } ?? SakinahURL.today)
    .containerBackground(for: .widget) { WidgetSkyBackground(phase: entry.sky, discAt: UnitPoint(x: 0.22, y: 0.22)) }
  }
}

// MARK: - التاريخ الهجري (شاشة القفل): «٢٤ / جمادى ١» في دائرة، ويتبدّل عند منتصف الليل

struct HijriWidgetIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "التاريخ الهجري"
  static var description = IntentDescription("اليوم والشهر الهجريان على شاشة القفل")
  @Parameter(title: "الأرقام", default: .latn) var numerals: NumeralsOption
  init() {}
}

struct HijriEntry: TimelineEntry {
  let date: Date
  let hijri: HijriDate
  let numerals: String
}

struct HijriProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> HijriEntry {
    HijriEntry(date: Date(), hijri: Hijri.date(Date(), tz: .current), numerals: "latn")
  }
  func snapshot(for configuration: HijriWidgetIntent, in context: Context) async -> HijriEntry {
    HijriEntry(date: Date(), hijri: Hijri.date(Date(), tz: .current), numerals: configuration.numerals.rawValue)
  }
  func timeline(for configuration: HijriWidgetIntent, in context: Context) async -> Timeline<HijriEntry> {
    let now = Date()
    let tz = TimeZone.current
    let n = configuration.numerals.rawValue
    var entries = [HijriEntry(date: now, hijri: Hijri.date(now, tz: tz), numerals: n)]
    var day = CivilDate(now, in: tz)
    for _ in 0..<3 {
      day = day.adding(days: 1)
      let m = day.localMidnight(in: tz)
      entries.append(HijriEntry(date: m, hijri: Hijri.date(m.addingTimeInterval(60), tz: tz), numerals: n))
    }
    return Timeline(entries: entries, policy: .atEnd)
  }
}

struct HijriWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: "org.emdatra.sakinah.hijri", intent: HijriWidgetIntent.self, provider: HijriProvider()) { entry in
      HijriWidgetView(entry: entry)
    }
    .configurationDisplayName("التاريخ الهجري")
    .description("اليوم الهجري على شاشة القفل")
    .supportedFamilies([.accessoryCircular, .accessoryInline])
  }
}

struct HijriWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: HijriEntry

  var body: some View {
    content
      .environment(\.layoutDirection, .rightToLeft)
      .environment(\.locale, WFmt.locale(entry.numerals))
      .widgetURL(SakinahURL.today)
      .containerBackground(for: .widget) { Color.clear }
  }

  @ViewBuilder private var content: some View {
    if family == .accessoryInline {
      Text("\(WFmt.number(entry.hijri.day, entry.numerals)) \(entry.hijri.monthName) \(WFmt.number(entry.hijri.year, entry.numerals))هـ")
    } else {
      ZStack {
        AccessoryWidgetBackground()
        VStack(spacing: 0) {
          Text(WFmt.number(entry.hijri.day, entry.numerals)).font(.system(size: 20, weight: .bold)).lineLimit(1).minimumScaleFactor(0.6)
          Text(WFmt.hijriMonthShort(entry.hijri.month, entry.numerals)).font(.system(size: 10, weight: .medium))
            .lineLimit(1).minimumScaleFactor(0.6)
        }
        .padding(.horizontal, 4)
        .widgetAccentable()
      }
    }
  }
}
