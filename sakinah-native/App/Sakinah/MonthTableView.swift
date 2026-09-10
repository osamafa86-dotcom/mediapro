import SwiftUI
import SakinahCore

/// الجدول الشهري مع تصدير إلى التقويم (ICS)
struct MonthTableView: View {
  @Environment(AppModel.self) private var model
  @State private var year: Int
  @State private var month: Int

  init() {
    let c = Calendar.current.dateComponents([.year, .month], from: Date())
    _year = State(initialValue: c.year!); _month = State(initialValue: c.month!)
  }

  private var rows: [PrayerTimesResult] {
    guard let coords = model.coordinates else { return [] }
    var p = model.settings.params; p.tz = model.timeZone.identifier
    return PrayerTimes.monthTable(coords: coords, year: year, month: month, params: p)
  }
  private var monthTitle: String {
    let f = DateFormatter(); f.locale = Fmt.locale(numerals: model.settings.numerals); f.dateFormat = "MMMM yyyy"
    return f.string(from: CivilDate(year: year, month: month, day: 1).localNoon(in: model.timeZone))
  }
  private func shift(_ n: Int) { var m = month + n; var y = year; if m < 1 { m = 12; y -= 1 } else if m > 12 { m = 1; y += 1 }; month = m; year = y }

  var body: some View {
    let s = model.settings; let tz = model.timeZone; let today = CivilDate(Date(), in: tz)
    VStack(spacing: 0) {
      HStack {
        Button { shift(-1) } label: { Image(systemName: "chevron.forward") }
        Spacer(); Text(monthTitle).font(.arabic(17, weight: .bold)); Spacer()
        Button { shift(1) } label: { Image(systemName: "chevron.backward") }
      }.padding()
      HStack(spacing: 0) {
        cell("اليوم", w: 44, bold: true)
        ForEach(Prayer.allCases, id: \.self) { p in cell(p.nameAr, bold: true) }
      }.padding(.vertical, 6).background(Theme.primary.opacity(0.12))
      ScrollView {
        LazyVStack(spacing: 0) {
          ForEach(rows, id: \.date) { r in
            let isToday = r.date == today
            HStack(spacing: 0) {
              cell(Fmt.number(r.date.day, numerals: s.numerals), w: 44, bold: isToday)
              ForEach(Prayer.allCases, id: \.self) { p in cell(Fmt.time(r[p], tz: tz, hour12: s.hour12, numerals: s.numerals).replacingOccurrences(of: " ", with: "\u{200A}"), bold: isToday) }
            }
            .padding(.vertical, 7)
            .background(isToday ? Theme.gold.opacity(0.18) : Color.clear)
            Divider()
          }
        }
      }
    }
    .navigationTitle("الجدول الشهري")
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        ShareLink(item: icsFile(), preview: SharePreview("مواقيت \(monthTitle)", image: Image(systemName: "calendar"))) { Image(systemName: "square.and.arrow.up") }
      }
    }
  }

  private func cell(_ t: String, w: CGFloat? = nil, bold: Bool = false) -> some View {
    Text(t).font(.system(size: 12.5, weight: bold ? .bold : .regular, design: .rounded)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
      .frame(width: w).frame(maxWidth: w == nil ? .infinity : nil)
  }

  private func icsFile() -> URL {
    var o = ICS.Options(); o.locationName = model.location.placeName; o.preMinutes = model.settings.reminders.preMinutes; o.includeSunrise = model.settings.reminders.prayers.contains(.sunrise)
    let text = ICS.build(days: rows, options: o)
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("sakinah-\(year)-\(month).ics")
    try? text.data(using: .utf8)?.write(to: url)
    return url
  }
}
