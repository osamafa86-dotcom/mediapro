import SwiftUI
import SakinahCore

/// شاشة المواقيت: الصلاة القادمة بعدّ تنازلي، وجدول اليوم، والتاريخ الهجري
struct PrayerView: View {
  @Environment(AppModel.self) private var model
  @State private var showMethods = false

  var body: some View {
    NavigationStack {
      TimelineView(.periodic(from: .now, by: 1)) { ctx in
        content(now: ctx.date)
      }
      .background(Theme.background)
      .navigationTitle("سكينة")
      .toolbar {
        ToolbarItem(placement: .topBarTrailing) {
          NavigationLink { MonthTableView() } label: { Image(systemName: "calendar") }.accessibilityLabel("الجدول الشهري")
        }
        ToolbarItem(placement: .topBarTrailing) {
          NavigationLink { CityPickerView() } label: { Image(systemName: model.location.mode == .gps ? "location" : "mappin.and.ellipse") }.accessibilityLabel("الموقع")
        }
      }
      .sheet(isPresented: $showMethods) { MethodPicker() }
    }
  }

  @ViewBuilder
  private func content(now: Date) -> some View {
    let s = model.settings
    let h = model.hijri(now: now); let tz = model.timeZone
    ScrollView {
      VStack(spacing: 16) {
        VStack(spacing: 4) {
          Text(h.formatted).font(.arabic(22, weight: .bold))
          Text(Fmt.gregorian(now, tz: tz, numerals: s.numerals)).font(.arabic(14)).foregroundStyle(.secondary)
          if let name = model.location.placeName { Label(name, systemImage: "mappin").font(.arabic(13)).foregroundStyle(.secondary) }
        }
        .padding(.top, 8)

        if let t = model.timeline(now: now) {
          nextCard(t, now: now)
          timesList(t)
          sunnahRow(t)
        } else {
          locationPrompt
        }
      }
      .padding()
    }
  }

  private func nextCard(_ t: PrayerTimes.DayTimeline, now: Date) -> some View {
    let s = model.settings
    let remaining = t.next.time.timeIntervalSince(now)
    return VStack(spacing: 6) {
      Text(t.next.isTomorrow ? "فجر الغد بعد" : "\(t.next.key.nameAr) بعد").font(.arabic(15)).foregroundStyle(.white.opacity(0.9))
      Text(Fmt.countdown(remaining, numerals: s.numerals)).font(.system(size: 44, weight: .bold, design: .rounded)).monospacedDigit().foregroundStyle(.white)
      Text(Fmt.time(t.next.time, tz: model.timeZone, hour12: s.hour12, numerals: s.numerals)).font(.arabic(16, weight: .semibold)).foregroundStyle(.white.opacity(0.95))
      Button { showMethods = true } label: {
        Text(Methods.method(s.methodId).nameAr).font(.arabic(12)).foregroundStyle(.white.opacity(0.85)).padding(.horizontal, 10).padding(.vertical, 4).background(.white.opacity(0.15), in: Capsule())
      }
    }
    .frame(maxWidth: .infinity)
    .padding(20)
    .background(LinearGradient(colors: [Theme.primary, Theme.primaryStrong], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 22))
  }

  private func timesList(_ t: PrayerTimes.DayTimeline) -> some View {
    let s = model.settings
    return VStack(spacing: 0) {
      ForEach(Prayer.allCases, id: \.self) { p in
        let isCurrent = t.current == p
        HStack {
          Text(p.nameAr).font(.arabic(17, weight: isCurrent ? .bold : .regular))
          Spacer()
          Text(Fmt.time(t.times[p], tz: model.timeZone, hour12: s.hour12, numerals: s.numerals)).font(.system(size: 17, weight: isCurrent ? .bold : .regular, design: .rounded)).monospacedDigit()
        }
        .padding(.vertical, 12).padding(.horizontal, 16)
        .background(isCurrent ? Theme.primary.opacity(0.12) : .clear)
        .overlay(alignment: .leading) { if isCurrent { Rectangle().fill(Theme.primary).frame(width: 4) } }
        if p != .isha { Divider().padding(.leading, 16) }
      }
    }
    .background(Theme.cardBackground, in: RoundedRectangle(cornerRadius: 16))
  }

  private func sunnahRow(_ t: PrayerTimes.DayTimeline) -> some View {
    let s = model.settings
    return HStack {
      VStack(alignment: .leading, spacing: 2) { Text("منتصف الليل").font(.arabic(13)).foregroundStyle(.secondary); Text(Fmt.time(t.sunnah.middleOfNight, tz: model.timeZone, hour12: s.hour12, numerals: s.numerals)).font(.arabic(16, weight: .semibold)) }
      Spacer()
      VStack(alignment: .leading, spacing: 2) { Text("الثلث الأخير").font(.arabic(13)).foregroundStyle(.secondary); Text(Fmt.time(t.sunnah.lastThird, tz: model.timeZone, hour12: s.hour12, numerals: s.numerals)).font(.arabic(16, weight: .semibold)) }
    }
    .padding(16).background(Theme.cardBackground, in: RoundedRectangle(cornerRadius: 16))
  }

  private var locationPrompt: some View {
    VStack(spacing: 12) {
      Image(systemName: "location.circle").font(.system(size: 44)).foregroundStyle(Theme.primary)
      Text("حدّد موقعك لحساب المواقيت").font(.arabic(17, weight: .semibold))
      Text("يُستخدم الموقع على جهازك فقط لحساب المواقيت واتجاه القبلة، ولا يُرسل إلى أي خادم.").font(.arabic(13)).foregroundStyle(.secondary).multilineTextAlignment(.center)
      if let e = model.location.errorMessage { Text(e).font(.arabic(13)).foregroundStyle(.red).multilineTextAlignment(.center) }
      Button { model.location.requestLocation() } label: { Text("تحديد الموقع").font(.arabic(16, weight: .bold)).padding(.horizontal, 24).padding(.vertical, 10) }.buttonStyle(.borderedProminent)
      NavigationLink { CityPickerView() } label: { Text("أو اختر مدينتك يدويًا").font(.arabic(14)) }
    }
    .padding(24).frame(maxWidth: .infinity).background(Theme.cardBackground, in: RoundedRectangle(cornerRadius: 16))
  }
}

/// اختيار طريقة الحساب
struct MethodPicker: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    NavigationStack {
      List {
        Section {
          Toggle(isOn: Binding(get: { model.settings.methodIsAutomatic }, set: { v in model.settings.methodIsAutomatic = v; if v { model.applyAutomaticMethodIfNeeded() }; model.rescheduleNotifications() })) {
            VStack(alignment: .leading) { Text("تلقائي حسب الدولة").font(.arabic(16)); Text("تُختار الهيئة الرسمية لبلدك من الموقع").font(.arabic(12)).foregroundStyle(.secondary) }
          }
        }
        Section("الطرق") {
          ForEach(Methods.order, id: \.self) { id in
            let m = Methods.method(id)
            Button {
              model.settings.methodIsAutomatic = false; model.settings.methodId = id; model.rescheduleNotifications(); dismiss()
            } label: {
              HStack { VStack(alignment: .leading) { Text(m.nameAr).font(.arabic(16)); Text(m.nameEn).font(.system(size: 12)).foregroundStyle(.secondary) }; Spacer(); if model.settings.methodId == id { Image(systemName: "checkmark").foregroundStyle(Theme.primary) } }
            }.foregroundStyle(.primary)
          }
        }
        Section("مذهب العصر") {
          Picker("مذهب العصر", selection: Binding(get: { model.settings.madhab }, set: { model.settings.madhab = $0; model.rescheduleNotifications() })) {
            Text("الجمهور (مثل الظل)").tag(Madhab.shafi); Text("الحنفي (مثلا الظل)").tag(Madhab.hanafi)
          }.pickerStyle(.inline).labelsHidden()
        }
      }
      .navigationTitle("طريقة الحساب")
      .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("تم") { dismiss() } } }
    }
  }
}
