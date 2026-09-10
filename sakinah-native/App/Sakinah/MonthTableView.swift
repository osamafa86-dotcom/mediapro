import SwiftUI
import SakinahCore

/// الجدول الشهري (تصميم Figma 15): بطاقة جدول بصفّ رأس، صفّ اليوم مميّز، وزر تصدير إلى التقويم
struct MonthTableView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
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
  private var gregorianTitle: String {
    let f = DateFormatter(); f.locale = Fmt.locale(numerals: model.settings.numerals); f.dateFormat = "MMMM yyyy"
    return f.string(from: CivilDate(year: year, month: month, day: 1).localNoon(in: model.timeZone))
  }
  private var hijriTitle: String {
    let mid = CivilDate(year: year, month: month, day: 15).localNoon(in: model.timeZone)
    let h = Hijri.date(mid, tz: model.timeZone, offsetDays: model.settings.hijriOffset)
    return "\(Hijri.monthsAr[h.month - 1]) \(Fmt.number(h.year, numerals: model.settings.numerals))هـ"
  }
  private func shift(_ n: Int) {
    var m = month + n; var y = year
    if m < 1 { m = 12; y -= 1 } else if m > 12 { m = 1; y += 1 }
    withAnimation(.snappy(duration: 0.2)) { month = m; year = y }
  }

  var body: some View {
    let s = model.settings; let tz = model.timeZone; let today = CivilDate(Date(), in: tz)
    ScrollView {
      VStack(spacing: DS.Space.s3) {
        monthSwitcher
        if rows.isEmpty {
          Text("حدّد موقعك أولًا لعرض جدول الشهر").font(DS.F.bodySm).foregroundStyle(DS.C.textTertiary).padding(.top, DS.Space.s8)
        } else {
          table(rows: rows, today: today, s: s, tz: tz)
          ShareLink(item: icsFile(), preview: SharePreview("مواقيت \(gregorianTitle)", image: Image(systemName: "calendar"))) {
            DSButtonLabel(title: "تصدير إلى التقويم (ICS)", kind: .soft, icon: "calendar")
          }
          Text("الأوقات بتوقيت \(model.location.placeName ?? "موقعك") · تُحدَّث تلقائيًا عند تغيير الموقع أو الطريقة")
            .font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).multilineTextAlignment(.center)
        }
      }
      .padding(.horizontal, DS.Space.s4).padding(.top, DS.Space.s2).padding(.bottom, DS.Space.s8)
    }
    .background(DS.C.bgCanvas)
    .safeAreaInset(edge: .top, spacing: 0) {
      HStack {
        ShareLink(item: icsFile(), preview: SharePreview("مواقيت \(gregorianTitle)", image: Image(systemName: "calendar"))) {
          DSIcon(systemName: "square.and.arrow.up")
        }
        Spacer()
        Text("الجدول الشهري").font(DS.F.headingLg).foregroundStyle(DS.C.textPrimary)
        Spacer()
        DSIconButton(systemName: "chevron.forward", label: "رجوع") { dismiss() }
      }
      .padding(.horizontal, DS.Space.s4).padding(.vertical, DS.Space.s3).background(DS.C.bgCanvas)
    }
    .navigationBarHidden(true)
  }

  private var monthSwitcher: some View {
    HStack {
      DSIconButton(systemName: "chevron.forward", label: "الشهر السابق") { shift(-1) }
      Spacer()
      VStack(spacing: 2) {
        Text(hijriTitle).font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary)
        Text("\(gregorianTitle) · \(model.location.placeName ?? "—") · \(Methods.method(model.settings.methodId).nameAr)")
          .font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).lineLimit(1).minimumScaleFactor(0.7)
      }
      Spacer()
      DSIconButton(systemName: "chevron.backward", label: "الشهر التالي") { shift(1) }
    }
  }

  private func table(rows: [PrayerTimesResult], today: CivilDate, s: Settings, tz: TimeZone) -> some View {
    VStack(spacing: 0) {
      HStack(spacing: 0) {
        ForEach(Array(Prayer.allCases.reversed()), id: \.self) { p in
          cell(p.nameAr, bold: true, color: DS.C.textTertiary)
        }
        cell("اليوم", w: 42, bold: true, color: DS.C.textTertiary)
      }
      .padding(.vertical, DS.Space.s2)
      Divider().overlay(DS.C.borderSubtle)
      ForEach(rows, id: \.date) { r in
        let isToday = r.date == today
        HStack(spacing: 0) {
          ForEach(Array(Prayer.allCases.reversed()), id: \.self) { p in
            cell(Fmt.time(r[p], tz: tz, hour12: s.hour12, numerals: s.numerals).replacingOccurrences(of: " ", with: "\u{200A}"),
                 bold: isToday, color: isToday ? DS.C.brandStrong : DS.C.textPrimary)
          }
          cell("\(weekdayLetter(r.date)) \(Fmt.number(r.date.day, numerals: s.numerals))", w: 42, bold: isToday, color: isToday ? DS.C.brandStrong : DS.C.textSecondary)
        }
        .padding(.vertical, DS.Space.s2)
        .background(isToday ? DS.C.brandSoft : .clear)
        if r.date != rows.last?.date { Divider().overlay(DS.C.borderSubtle.opacity(0.6)) }
      }
    }
    .dsCard(padding: DS.Space.s2)
  }

  private func weekdayLetter(_ d: CivilDate) -> String {
    AdhkarStreak.letter(DayKey.key(d.year, d.month, d.day))
  }

  private func cell(_ t: String, w: CGFloat? = nil, bold: Bool = false, color: Color = DS.C.textPrimary) -> some View {
    Text(t)
      .font(DS.F.numericSm).fontWeight(bold ? .semibold : .regular)
      .foregroundStyle(color)
      .monospacedDigit().lineLimit(1).minimumScaleFactor(0.65)
      .frame(width: w).frame(maxWidth: w == nil ? .infinity : nil)
  }

  private func icsFile() -> URL {
    var o = ICS.Options()
    o.locationName = model.location.placeName
    o.preMinutes = model.settings.reminders.preMinutes
    o.includeSunrise = model.settings.reminders.prayers.contains(.sunrise)
    let text = ICS.build(days: rows, options: o)
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("sakinah-\(year)-\(month).ics")
    try? text.data(using: .utf8)?.write(to: url)
    return url
  }
}
