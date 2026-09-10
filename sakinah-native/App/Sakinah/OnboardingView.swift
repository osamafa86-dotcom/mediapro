import SwiftUI
import SakinahCore

/// تهيئة أول تشغيل (تصميم Figma 14a–14c): ترحيب → الموقع → الإشعارات؛ كل خطوة قابلة للتخطي وتُستكمل من الإعدادات
struct OnboardingView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  @State private var step = 0
  @State private var showCities = false
  @State private var locating = false
  @State private var preReminder = true
  @State private var adhkarReminders = false

  var body: some View {
    ZStack {
      DS.C.bgCanvas.ignoresSafeArea()
      switch step {
      case 0: welcome.transition(.opacity)
      case 1: location.transition(.move(edge: .leading).combined(with: .opacity))
      default: notifications.transition(.move(edge: .leading).combined(with: .opacity))
      }
    }
    .animation(.snappy(duration: 0.3), value: step)
    .sheet(isPresented: $showCities) { NavigationStack { CityPickerView().navigationTitle("اختيار المدينة").navigationBarTitleDisplayMode(.inline) }.environment(model) }
    .onChange(of: model.location.placeName) { if step == 1, model.location.coordinate != nil { locating = false } }
  }

  private func finish() { model.settings.seenIntro = true; dismiss() }

  // MARK: 1 · مرحبًا
  private var welcome: some View {
    VStack(spacing: 0) {
      ZStack {
        DS.nightGradient
        GeometryReader { g in
          let cx = g.size.width / 2, cy = g.size.height * 0.52
          ZStack {
            ForEach(Array([(520.0, 0.10), (400.0, 0.16), (290.0, 0.24)].enumerated()), id: \.offset) { _, r in
              Circle().stroke(DS.C.accentGold.opacity(r.1), lineWidth: 1).frame(width: r.0, height: r.0).position(x: cx, y: cy)
            }
            Circle().fill(DS.C.accentGold.opacity(0.12)).frame(width: 180, height: 180).position(x: cx, y: cy)
            Image(systemName: "moon").font(.system(size: 96, weight: .thin)).foregroundStyle(DS.C.accentGold).position(x: cx + 4, y: cy)
            ForEach(Array([(70.0, 90.0, 3.0), (120.0, 160.0, 2.0), (300.0, 110.0, 3.0), (330.0, 200.0, 2.0), (90.0, 300.0, 2.0), (290.0, 330.0, 3.0), (200.0, 60.0, 2.0)].enumerated()), id: \.offset) { _, s in
              Circle().fill(Color.white.opacity(0.8)).frame(width: s.2, height: s.2).position(x: s.0, y: s.1)
            }
            VStack(spacing: 2) {
              Text("سكينة").font(DS.kufi(48, .bold)).foregroundStyle(DS.C.textOnDark)
              Text("مواقيتك · مصحفك · أذكارك").font(DS.F.labelMd).foregroundStyle(DS.C.accentGold)
            }.position(x: cx, y: g.size.height - 70)
          }
        }
      }
      .frame(height: 430)
      .ignoresSafeArea(edges: .top)
      VStack(spacing: 12) {
        Text("السكينة في مكان واحد").font(DS.F.displayMd).foregroundStyle(DS.C.textPrimary)
        Text("مواقيت دقيقة، مصحف بخط المدينة، أذكار وحصن المسلم، ومسبحة. يعمل كاملًا دون اتصال، بلا إعلانات ولا تتبّع.").font(DS.F.bodyMd).foregroundStyle(DS.C.textSecondary).multilineTextAlignment(.center)
        Spacer(minLength: 4)
        dots(0)
        DSButton(title: "ابدأ", icon: "chevron.forward") { step = 1 }
        Text("كل الحسابات على جهازك، والشبكة تُستخدم فقط لجلب التلاوات والترجمات عند طلبها.").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).multilineTextAlignment(.center)
      }
      .padding(.horizontal, 30).padding(.top, 28).padding(.bottom, 10)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(DS.C.bgCanvas, in: UnevenRoundedRectangle(topLeadingRadius: 32, topTrailingRadius: 32))
      .offset(y: -32)
      .padding(.bottom, -32)
    }
    .ignoresSafeArea(edges: .top)
  }

  // MARK: 2 · الموقع
  private var location: some View {
    let hasLoc = model.location.coordinate != nil
    return page(icon: "mappin", tone: .teal, title: "حدّد موقعك لحساب المواقيت", body: "نحتاج موقعك التقريبي لحساب مواقيت الصلاة واتجاه القبلة والانحراف المغناطيسي.", dot: 1, skip: { step = 2 }) {
      HStack(spacing: 6) { Image(systemName: "checkmark.shield").font(.system(size: 12, weight: .semibold)); Text("الإحداثيات تُقرَّب وتبقى على جهازك · لا تُرسل لأي خادم").font(DS.F.labelXs) }
        .foregroundStyle(DS.C.success).padding(.vertical, 8).padding(.horizontal, 12).background(DS.C.success.opacity(0.12), in: Capsule())
      if hasLoc, let name = model.location.placeName {
        HStack(spacing: 6) { Image(systemName: "checkmark.circle.fill"); Text("الموقع: \(name)").font(DS.F.labelMd) }.foregroundStyle(DS.C.brandPrimary)
      }
      if let e = model.location.errorMessage { Text(e).font(DS.F.bodySm).foregroundStyle(DS.C.danger).multilineTextAlignment(.center) }
    } buttons: {
      if hasLoc {
        DSButton(title: "متابعة", icon: "chevron.forward") { step = 2 }
        DSButton(title: "تغيير المدينة", kind: .outline, icon: "magnifyingglass") { showCities = true }
      } else {
        DSButton(title: locating ? "جارٍ تحديد الموقع…" : "استخدام موقع الجهاز", icon: "location.fill") { locating = true; model.location.useDeviceLocation() }.disabled(locating).opacity(locating ? 0.7 : 1)
        DSButton(title: "اختيار مدينة يدويًا · ٦٤٩ مدينة", kind: .outline, icon: "magnifyingglass") { showCities = true }
      }
    }
  }

  // MARK: 3 · الإشعارات
  private var notifications: some View {
    page(icon: "bell", tone: .gold, title: "لا تفوّت صلاة", body: "إشعارات محلية على جهازك تُجدَّد تلقائيًا، مع الأذان الكامل أو تنبيه هادئ.", dot: 2, skip: finish) {
      VStack(spacing: 0) {
        optionRow("الأذان كاملًا عند كل صلاة", "صوت مكة · يمكن تغييره لاحقًا", Binding(get: { model.settings.reminders.usesAdhanSound }, set: { on in var r = model.settings.reminders; r.sound = on ? "adhan-fakhry" : "chime"; model.settings.reminders = r }))
        Divider().overlay(DS.C.borderSubtle)
        optionRow("تنبيه قبل الصلاة", "قبل ١٠ دقائق", $preReminder)
        Divider().overlay(DS.C.borderSubtle)
        optionRow("أذكار الصباح والمساء", "بعد الفجر وبعد العصر", $adhkarReminders)
      }
      .padding(2).dsCard(padding: 2)
    } buttons: {
      DSButton(title: "تفعيل الإشعارات", icon: "chevron.forward") {
        Task {
          let ok = await model.notifications.requestAuthorization()
          await MainActor.run {
            var r = model.settings.reminders; r.enabled = ok; r.preMinutes = preReminder ? 10 : 0; model.settings.reminders = r
            var x = model.content.extraReminders; x.adhkarMorning = adhkarReminders; x.adhkarEvening = adhkarReminders; model.content.extraReminders = x
            model.rescheduleNotifications(); finish()
          }
        }
      }
      Button { finish() } label: { Text("لاحقًا").font(DS.F.labelMd).foregroundStyle(DS.C.textSecondary).frame(maxWidth: .infinity).padding(12) }.buttonStyle(.plain)
    }
  }

  private func optionRow(_ title: String, _ sub: String, _ isOn: Binding<Bool>) -> some View {
    Toggle(isOn: isOn) { VStack(alignment: .leading, spacing: 0) { Text(title).font(DS.F.labelMd).foregroundStyle(DS.C.textPrimary); Text(sub).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary) } }
      .toggleStyle(DSToggleStyle()).padding(.vertical, 10).padding(.horizontal, 14)
  }

  private enum Tone { case teal, gold }
  private func page<Extra: View, Buttons: View>(icon: String, tone: Tone, title: String, body: String, dot: Int, skip: @escaping () -> Void, @ViewBuilder extra: () -> Extra, @ViewBuilder buttons: () -> Buttons) -> some View {
    let tint = tone == .teal ? DS.C.brandPrimary : DS.C.accentGoldStrong
    let disc = tone == .teal ? DS.C.brandSoft : DS.C.accentGoldSoft
    return VStack(spacing: 14) {
      HStack { Spacer(); Button(action: skip) { Text("تخطّي").font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary).padding(10) }.buttonStyle(.plain) }
      Spacer(minLength: 0)
      ZStack {
        Circle().stroke(tint.opacity(0.35), lineWidth: 1).frame(width: 200, height: 200)
        Circle().stroke(tint.opacity(0.6), lineWidth: 1).frame(width: 166, height: 166)
        Circle().fill(disc).frame(width: 124, height: 124)
        Image(systemName: icon).font(.system(size: 52, weight: .light)).foregroundStyle(tint)
      }
      .frame(height: 200)
      Text(title).font(DS.F.displayMd).foregroundStyle(DS.C.textPrimary).multilineTextAlignment(.center)
      Text(body).font(DS.F.bodyMd).foregroundStyle(DS.C.textSecondary).multilineTextAlignment(.center)
      extra()
      Spacer(minLength: 0)
      dots(dot)
      buttons()
    }
    .padding(.horizontal, 30).padding(.bottom, 8)
  }

  private func dots(_ active: Int) -> some View {
    HStack(spacing: 6) { ForEach(0..<3, id: \.self) { i in Capsule().fill(i == active ? DS.C.accentGold : DS.C.borderStrong).frame(width: i == active ? 24 : 8, height: 8) } }
      .animation(.snappy(duration: 0.25), value: active)
  }
}
