import SwiftUI
import SakinahCore

/// شاشة المواقيت (تصميم Figma «01 · الصلاة · الرئيسية»): ترحيب وموقع، حبّة التاريخ، بطاقة الصلاة القادمة بعدّ تنازلي وشريط تقدّم،
/// جدول اليوم مع تفعيل تذكير كل صلاة، بلاطات الوصول السريع، والسنن (منتصف الليل والثلث الأخير)
struct PrayerView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.switchTab) private var switchTab
  @State private var showMethods = false

  var body: some View {
    NavigationStack {
      TimelineView(.periodic(from: .now, by: 1)) { ctx in content(now: ctx.date) }
        .background(DS.C.bgCanvas)
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showMethods) { MethodPicker() }
    }
  }

  @ViewBuilder
  private func content(now: Date) -> some View {
    let s = model.settings; let tz = model.timeZone
    ScrollView(showsIndicators: false) {
      VStack(spacing: 16) {
        header
        DSPill(icon: "moon.stars", text: model.hijri(now: now).formatted, secondary: Fmt.shortDate(now, tz: tz, numerals: s.numerals))
          .frame(maxWidth: .infinity, alignment: .leading)
        if let t = model.timeline(now: now) {
          hero(t, now: now)
          todayCard(t)
          quickTiles
          sunnahRow(t)
        } else {
          locationPrompt
        }
      }
      .padding(.horizontal, 20).padding(.top, 6).padding(.bottom, 24)
    }
  }

  // MARK: رأس الصفحة
  private var header: some View {
    HStack(alignment: .center, spacing: 8) {
      VStack(alignment: .leading, spacing: 2) {
        Text("السلام عليكم ورحمة الله").font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary)
        HStack(spacing: 6) {
          Image(systemName: "mappin").font(.system(size: 15, weight: .semibold)).foregroundStyle(DS.C.brandPrimary)
          Text(model.location.placeName ?? "حدّد موقعك").font(DS.F.displayMd).foregroundStyle(DS.C.textPrimary).lineLimit(1).minimumScaleFactor(0.7)
        }
      }
      Spacer()
      NavigationLink { MonthTableView() } label: { DSIcon(systemName: "calendar") }.buttonStyle(.plain).accessibilityLabel("الجدول الشهري")
      NavigationLink { CityPickerView() } label: { DSIcon(systemName: model.location.mode == .gps ? "location" : "mappin.and.ellipse") }.buttonStyle(.plain).accessibilityLabel("الموقع")
    }
  }

  // MARK: بطاقة الصلاة القادمة
  private func hero(_ t: PrayerTimes.DayTimeline, now: Date) -> some View {
    let s = model.settings
    let remaining = t.next.time.timeIntervalSince(now)
    let start = t.times[t.current] ?? t.yesterdayIsha
    let total = start.map { t.next.time.timeIntervalSince($0) } ?? 0
    let elapsed = total > 0 ? min(1, max(0, now.timeIntervalSince(start!) / total)) : 0
    let pct = Fmt.number(Int((elapsed * 100).rounded()), numerals: s.numerals)
    return VStack(alignment: .leading, spacing: 10) {
      HStack {
        Text("الصلاة القادمة").font(DS.F.labelMd).foregroundStyle(DS.C.textOnDarkMuted)
        Spacer()
        Button { showMethods = true } label: {
          HStack(spacing: 6) { Image(systemName: "slider.horizontal.3").font(.system(size: 11, weight: .semibold)); Text(Methods.method(s.methodId).nameAr).font(DS.F.labelSm).lineLimit(1) }
            .foregroundStyle(DS.C.accentGold).padding(.vertical, 6).padding(.horizontal, 12).background(Color.white.opacity(0.12), in: Capsule())
        }.buttonStyle(.plain).accessibilityLabel("طريقة الحساب")
      }
      HStack(alignment: .lastTextBaseline) {
        Text(t.next.isTomorrow ? "فجر الغد" : t.next.key.nameAr).font(DS.F.displayHero).foregroundStyle(DS.C.textOnDark)
        Spacer()
        Text(Fmt.countdown(remaining, numerals: s.numerals)).font(DS.F.numericHero).monospacedDigit().foregroundStyle(DS.C.textOnDark).lineLimit(1).minimumScaleFactor(0.5)
      }
      HStack(spacing: 8) {
        Text("الأذان \(Fmt.time(t.next.time, tz: model.timeZone, hour12: s.hour12, numerals: s.numerals))").font(DS.F.labelSm).foregroundStyle(DS.C.textOnDarkMuted)
        Text("·").foregroundStyle(DS.C.textOnDarkMuted)
        Text("الآن وقت \(t.current.nameAr)").font(DS.F.labelSm).foregroundStyle(DS.C.textOnDarkMuted)
        Spacer()
        Text("مضى \(pct)٪").font(DS.F.labelSm).foregroundStyle(DS.C.accentGold)
      }
      ProgressTrack(progress: elapsed).padding(.top, 2)
    }
    .padding(.vertical, 22).padding(.horizontal, 24)
    .nightCard()
  }

  // MARK: جدول اليوم
  private func todayCard(_ t: PrayerTimes.DayTimeline) -> some View {
    VStack(spacing: 4) {
      HStack {
        Text("مواقيت اليوم").font(DS.F.headingMd).foregroundStyle(DS.C.textPrimary)
        Spacer()
        NavigationLink { MonthTableView() } label: { DSLinkLabel(title: "الجدول الشهري") }.buttonStyle(.plain)
      }
      .padding(.horizontal, 8).padding(.top, 8).padding(.bottom, 4)
      ForEach(Prayer.allCases, id: \.self) { p in prayerRow(p, t) }
    }
    .dsCard(padding: 8)
  }

  private func icon(for p: Prayer) -> String {
    switch p { case .fajr: return "sunrise"; case .sunrise: return "sun.horizon"; case .dhuhr: return "sun.max"; case .asr: return "sun.min"; case .maghrib: return "sunset"; case .isha: return "moon.stars" }
  }

  private func prayerRow(_ p: Prayer, _ t: PrayerTimes.DayTimeline) -> some View {
    let s = model.settings
    let isNext = t.next.key == p && !t.next.isTomorrow
    let remind = s.reminders.prayers.contains(p)
    let tint: Color = isNext ? DS.C.brandPrimary : DS.C.textPrimary
    return HStack(spacing: 10) {
      Image(systemName: icon(for: p)).font(.system(size: 17, weight: .medium)).foregroundStyle(isNext ? DS.C.brandPrimary : DS.C.textTertiary).frame(width: 24)
      Text(p.nameAr).font(isNext ? DS.F.headingSm : DS.F.bodyLg).foregroundStyle(tint)
      if isNext { DSBadge(text: "القادمة") }
      Spacer()
      Text(Fmt.time(t.times[p], tz: model.timeZone, hour12: s.hour12, numerals: s.numerals)).font(DS.F.numericMd).monospacedDigit().foregroundStyle(tint)
      Button {
        var r = s.reminders
        if remind { r.prayers.remove(p) } else { r.prayers.insert(p) }
        s.reminders = r; model.rescheduleNotifications()
      } label: {
        Image(systemName: remind ? "bell.fill" : "bell.slash").font(.system(size: 15, weight: .medium))
          .foregroundStyle(remind ? (isNext ? DS.C.brandPrimary : DS.C.textSecondary) : DS.C.textTertiary)
          .frame(width: 32, height: 32).contentShape(Rectangle())
      }
      .buttonStyle(.plain)
      .accessibilityLabel(remind ? "إيقاف تذكير \(p.nameAr)" : "تفعيل تذكير \(p.nameAr)")
    }
    .padding(.vertical, 10).padding(.horizontal, 12)
    .background(isNext ? DS.C.brandSoft : .clear, in: RoundedRectangle(cornerRadius: DS.Radius.lg, style: .continuous))
  }

  // MARK: بلاطات الوصول السريع
  private var quickTiles: some View {
    HStack(spacing: 10) {
      Button { switchTab(.qibla) } label: { DSQuickTile(icon: "location.north.circle", title: "القبلة") }.buttonStyle(.plain)
      NavigationLink { MonthTableView() } label: { DSQuickTile(icon: "calendar", title: "الإمساكية") }.buttonStyle(.plain)
      Button { switchTab(.adhkar) } label: { DSQuickTile(icon: "circle.hexagongrid", title: "الأذكار") }.buttonStyle(.plain)
      Button { switchTab(.mushaf) } label: { DSQuickTile(icon: "book", title: "الورد") }.buttonStyle(.plain)
    }
  }

  // MARK: السنن
  private func sunnahRow(_ t: PrayerTimes.DayTimeline) -> some View {
    let s = model.settings
    return HStack(spacing: 10) {
      DSStatTile(value: Fmt.time(t.sunnah.middleOfNight, tz: model.timeZone, hour12: s.hour12, numerals: s.numerals), label: "منتصف الليل")
      DSStatTile(value: Fmt.time(t.sunnah.lastThird, tz: model.timeZone, hour12: s.hour12, numerals: s.numerals), label: "الثلث الأخير")
    }
  }

  // MARK: لا موقع بعد
  private var locationPrompt: some View {
    VStack(spacing: 14) {
      DSIcon(systemName: "location.circle", style: .soft, size: 72, iconSize: 32)
      Text("حدّد موقعك لحساب المواقيت").font(DS.F.headingLg).foregroundStyle(DS.C.textPrimary)
      Text("يُستخدم الموقع على جهازك فقط لحساب المواقيت واتجاه القبلة، ولا يُرسل إلى أي خادم.").font(DS.F.bodyMd).foregroundStyle(DS.C.textSecondary).multilineTextAlignment(.center)
      if let e = model.location.errorMessage { Text(e).font(DS.F.bodySm).foregroundStyle(DS.C.danger).multilineTextAlignment(.center) }
      DSButton(title: "استخدام موقع الجهاز", icon: "location.fill") { model.location.requestLocation() }
      NavigationLink { CityPickerView() } label: { DSButtonLabel(title: "اختيار مدينة يدويًا · ٦٤٩ مدينة", kind: .outline, icon: "magnifyingglass") }.buttonStyle(.plain)
    }
    .frame(maxWidth: .infinity)
    .dsCard(padding: 24)
  }
}

/// اختيار طريقة الحساب ومذهب العصر
struct MethodPicker: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    NavigationStack {
      List {
        Section {
          Toggle(isOn: Binding(get: { model.settings.methodIsAutomatic }, set: { v in model.settings.methodIsAutomatic = v; if v { model.applyAutomaticMethodIfNeeded() }; model.rescheduleNotifications() })) {
            VStack(alignment: .leading) { Text("تلقائي حسب الدولة").font(DS.F.bodyLg); Text("تُختار الهيئة الرسمية لبلدك من الموقع").font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary) }
          }.toggleStyle(DSToggleStyle())
        }
        Section("الطرق") {
          ForEach(Methods.order, id: \.self) { id in
            let m = Methods.method(id)
            Button {
              model.settings.methodIsAutomatic = false; model.settings.methodId = id; model.rescheduleNotifications(); dismiss()
            } label: {
              HStack { VStack(alignment: .leading) { Text(m.nameAr).font(DS.F.bodyLg); Text(m.nameEn).font(.system(size: 12)).foregroundStyle(DS.C.textSecondary) }; Spacer(); if model.settings.methodId == id { Image(systemName: "checkmark").foregroundStyle(DS.C.brandPrimary) } }
            }.foregroundStyle(DS.C.textPrimary)
          }
        }
        Section("مذهب العصر") {
          Picker("مذهب العصر", selection: Binding(get: { model.settings.madhab }, set: { model.settings.madhab = $0; model.rescheduleNotifications() })) {
            Text("الجمهور (مثل الظل)").tag(Madhab.shafi); Text("الحنفي (مثلا الظل)").tag(Madhab.hanafi)
          }.pickerStyle(.inline).labelsHidden()
        }
      }
      .scrollContentBackground(.hidden).background(DS.C.bgCanvas)
      .navigationTitle("طريقة الحساب").navigationBarTitleDisplayMode(.inline)
      .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("تم") { dismiss() }.font(DS.F.labelMd) } }
    }
  }
}
