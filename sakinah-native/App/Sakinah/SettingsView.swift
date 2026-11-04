import SwiftUI
import UserNotifications
import StoreKit
import SakinahCore

/// الإعدادات (المرحلة الثانية — تصميم «الإعدادات — iOS»): رأسٌ بـ«‹ اليوم» وعنوانٍ كوفي كبير، ثم خمس مجموعات:
/// الصلاة، التنبيهات، القرآن والتلاوة، المظهر، عن سكينة. كل صفّ: أيقونة في مربّع ناعم (يمين)، عنوان، قيمة وسهم (يسار).
/// ما كان في الإعدادات القديمة ولم يعد صفًّا هنا انتقل إلى شاشةٍ فرعية: الأذان وتنبيهاته («الأذان»)، والأرقام والساعة
/// والتاريخ الهجري والاهتزاز («الأرقام والوقت والتاريخ»)، وخطوط العرض العالية (ورقة «طريقة الحساب»).
/// ملاحظة اتجاه: البيئة RTL، فأوّل عنصر في HStack يقع يمينًا، و`.leading` هو اليمين.
struct SettingsView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  @Environment(\.openURL) private var openURL
  @Environment(\.requestReview) private var requestReview
  @Environment(\.colorScheme) private var scheme
  /// اسم الشاشة التي فُتحت منها (للرابط «‹ اليوم»)
  var backTitle = "اليوم"
  @State private var sheet: SettingsSheet?
  @State private var showAsr = false
  @State private var showTextScale = false
  /// طبعة رمضان: «الإمساك قبل الفجر» (يظهر الصفّ في رمضان وحده)
  @State private var showImsak = false

  enum SettingsSheet: Int, Identifiable { case methods, adhkarReminders, khatmah, display, legend, reciter; var id: Int { rawValue } }
  private struct TextScaleOption: Hashable { let value: Double; let label: String }
  private static let textScales: [TextScaleOption] = [
    TextScaleOption(value: 0.8, label: "صغير"), TextScaleOption(value: 1.0, label: "عادي"), TextScaleOption(value: 1.2, label: "كبير"),
    TextScaleOption(value: 1.4, label: "أكبر"), TextScaleOption(value: 1.6, label: "الأكبر"),
  ]
  private var version: String { (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "—" }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 22) {
        SettingsHeader(title: "الإعدادات", backTitle: backTitle) { dismiss() }
        prayerGroup
        alertsGroup
        quranGroup
        appearanceGroup
        aboutGroup
        Text("سكينة \u{2066}\(version)\u{2069} — بلا إعلانات ولا تتبّع")
          .font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).frame(maxWidth: .infinity)
      }
      .padding(.horizontal, DS.Space.s4).padding(.top, DS.Space.s2).padding(.bottom, DS.Space.s8)
      .readableWidth()
    }
    .background(DS.C.bgCanvas)
    .navigationBarHidden(true)
    .sheet(item: $sheet) { s in sheetView(s) }
    .confirmationDialog("وقت العصر", isPresented: $showAsr, titleVisibility: .visible) {
      Button("الجمهور (مثل الظل)") { model.settings.madhab = .shafi; model.rescheduleNotifications() }
      Button("الحنفي (مثلا الظل)") { model.settings.madhab = .hanafi; model.rescheduleNotifications() }
      Button("إلغاء", role: .cancel) {}
    }
    .confirmationDialog("حجم خط القراءة", isPresented: $showTextScale, titleVisibility: .visible) {
      ForEach(Self.textScales, id: \.self) { o in
        Button(o.label) { model.content.textScale = o.value }
      }
      Button("إلغاء", role: .cancel) {}
    } message: {
      Text("لنصوص الأذكار والأحاديث")
    }
    .confirmationDialog("الإمساك قبل الفجر", isPresented: $showImsak, titleVisibility: .visible) {
      ForEach(RamadanEdition.imsakChoices, id: \.self) { m in
        Button(RamadanEdition.imsakLabel(m, numerals: model.settings.numerals)) { model.settings.imsakOffset = m; LiveActivityManager.sync(model) }
      }
      Button("إلغاء", role: .cancel) {}
    } message: {
      Text("موعد الإمساك في «اليوم» وبطاقة المواقيت خلال رمضان")
    }
  }

  // MARK: ١ · الصلاة
  private var prayerGroup: some View {
    let s = model.settings
    return SettingsSection("الصلاة") {
      NavigationLink { CityPickerView().environment(model).tabBarClearance() } label: {
        SettingsItemRow(icon: "mappin.and.ellipse", title: "الموقع", value: model.location.placeName ?? "غير محدّد")
      }
      .buttonStyle(.plain)
      SettingsRowDivider()
      Button { sheet = .methods } label: {
        SettingsItemRow(icon: "calendar", title: "طريقة الحساب", value: Methods.method(s.methodId).nameAr)
      }
      .buttonStyle(.plain)
      SettingsRowDivider()
      Button { showAsr = true } label: {
        SettingsItemRow(icon: "sun.max", title: "وقت العصر", value: s.madhab == .hanafi ? "الحنفي" : "الجمهور")
      }
      .buttonStyle(.plain)
      // طبعة رمضان: صفٌّ صغير يظهر في الشهر وحده (وفي لقطة `ramadan`)
      if RamadanEdition.day(model, now: Date()) != nil {
        SettingsRowDivider()
        Button { showImsak = true } label: {
          SettingsItemRow(icon: "moon.stars", title: "الإمساك قبل الفجر", value: RamadanEdition.imsakLabel(s.imsakOffset, numerals: s.numerals))
        }
        .buttonStyle(.plain)
      }
    }
  }

  // MARK: ٢ · التنبيهات
  private var alertsGroup: some View {
    SettingsSection("التنبيهات") {
      NavigationLink { NotificationSettingsView().environment(model).tabBarClearance() } label: {
        SettingsItemRow(icon: "bell", title: "الأذان", value: adhanValue)
      }
      .buttonStyle(.plain)
      SettingsRowDivider()
      Button { sheet = .adhkarReminders } label: {
        SettingsItemRow(icon: "sparkles", title: "تذكير الأذكار", value: adhkarValue)
      }
      .buttonStyle(.plain)
      SettingsRowDivider()
      Button { sheet = .khatmah } label: {
        SettingsItemRow(icon: "book", title: "تذكير الورد", value: wirdValue)
      }
      .buttonStyle(.plain)
    }
  }
  private var adhanValue: String {
    let r = model.settings.reminders
    guard r.enabled else { return "مطفأ" }
    if model.notifications.authorization == .denied { return "الإذن مرفوض" }
    let c = r.prayers.filter { $0 != .sunrise }.count
    switch c {
    case 0: return "لا صلاة"
    case 1: return "صلاة واحدة"
    case 2: return "صلاتان"
    default: return "\(num(c)) صلوات"
    }
  }
  private var adhkarValue: String {
    let x = model.content.extraReminders
    switch (x.adhkarMorning, x.adhkarEvening) {
    case (true, true): return "الصباح والمساء"
    case (true, false): return "الصباح"
    case (false, true): return "المساء"
    default: return "مطفأ"
    }
  }
  /// تذكير الختمة: بعد صلاة، أو في ساعةٍ ثابتة «HH:mm»، أو مطفأ (ولا خطة = مطفأ)
  private var wirdValue: String {
    guard let plan = model.quran.khatmah, let r = plan.reminder else { return "مطفأ" }
    if let p = Reminders.afterPrayer(r) { return "بعد \(p.nameAr)" }
    let hm = r.split(separator: ":").compactMap { Int($0) }
    guard hm.count == 2, let d = Calendar.current.date(bySettingHour: hm[0], minute: hm[1], second: 0, of: Date()) else { return "مطفأ" }
    return Fmt.time(d, tz: .current, hour12: model.settings.hour12, numerals: model.settings.numerals)
  }

  // MARK: ٣ · القرآن والتلاوة
  private var quranGroup: some View {
    let q = model.quran
    let bytes = model.downloads.totalBytes()
    return SettingsSection("القرآن والتلاوة") {
      Button { sheet = .display } label: {
        SettingsItemRow(icon: "book.closed", title: "المصحف والخط", value: q.isTextMode ? "نص متدفق" : "مصحف المدينة")
      }
      .buttonStyle(.plain)
      SettingsRowDivider()
      Button { sheet = .reciter } label: {
        SettingsItemRow(icon: "headphones", title: "القارئ", value: Catalog.shared.reciter(q.reciter).name)
      }
      .buttonStyle(.plain)
      SettingsRowDivider()
      NavigationLink { DownloadsView().environment(model) } label: {
        SettingsItemRow(icon: "arrow.down.circle", title: "التنزيلات", value: bytes > 0 ? AudioDownloads.fmtBytes(bytes, numerals: model.settings.numerals) : "لا تنزيلات")
      }
      .buttonStyle(.plain)
    }
  }

  // MARK: ٤ · المظهر
  /// لا صفّ «الوضع»: التطبيق يتبع وضع النظام ولا إعداد له
  private var appearanceGroup: some View {
    SettingsSection("المظهر") {
      NavigationLink { SkySettingsView().environment(model).tabBarClearance() } label: {
        SettingsItemRow(icon: "sun.horizon", title: "السماء", value: skyValue)
      }
      .buttonStyle(.plain)
      SettingsRowDivider()
      Button { showTextScale = true } label: {
        SettingsItemRow(icon: "textformat.size", title: "حجم خط القراءة", value: scaleLabel(model.content.textScale))
      }
      .buttonStyle(.plain)
      SettingsRowDivider()
      NavigationLink { FormatsSettingsView().environment(model).tabBarClearance() } label: {
        SettingsItemRow(icon: "textformat.123", title: "الأرقام والوقت والتاريخ", value: formatsValue)
      }
      .buttonStyle(.plain)
    }
  }
  private var skyValue: String {
    let sky = model.settings.sky
    switch sky.mode {
    case .auto: return sky.weather ? "حيّة مع الوقت والطقس" : "حيّة مع الوقت"
    case .fixed: return "ثابتة"
    case .custom: return "بلونك"
    }
  }
  private func scaleLabel(_ v: Double) -> String {
    let nearest = Self.textScales.min(by: { abs($0.value - v) < abs($1.value - v) })
    return nearest?.label ?? "عادي"
  }
  private var formatsValue: String {
    let s = model.settings
    return "\(num(123))، \(num(s.hour12 ? 12 : 24)) ساعة"
  }

  // MARK: ٥ · عن سكينة
  private var aboutGroup: some View {
    SettingsSection("عن سكينة") {
      NavigationLink { PrivacyAboutView().environment(model).tabBarClearance() } label: {
        SettingsItemRow(icon: "hand.raised", title: "الخصوصية")
      }
      .buttonStyle(.plain)
      SettingsRowDivider()
      // قناة التواصل القائمة نفسها في صفحة المتجر وسياسة الخصوصية (صفحة المسائل على GitHub)
      Button { if let u = URL(string: SakinahLinks.support) { openURL(u) } } label: {
        SettingsItemRow(icon: "envelope", title: "تواصل معنا")
      }
      .buttonStyle(.plain)
      .accessibilityHint("يفتح صفحة المسائل على GitHub")
      SettingsRowDivider()
      Button { requestReview() } label: {
        SettingsItemRow(icon: "star", title: "قيّم التطبيق")
      }
      .buttonStyle(.plain)
      SettingsRowDivider()
      NavigationLink { BackupView().environment(model).tabBarClearance() } label: {
        SettingsItemRow(icon: "externaldrive", title: "النسخة الاحتياطية")
      }
      .buttonStyle(.plain)
    }
  }

  // MARK: الأوراق
  @ViewBuilder private func sheetView(_ s: SettingsSheet) -> some View {
    switch s {
    case .methods: MethodPicker().environment(model).environment(\.tabBarInset, 0)
    case .adhkarReminders: AdhkarRemindersSheet().environment(model)
    case .khatmah: KhatmahSheet().environment(model)
    case .display: DisplaySheet(onLegend: { sheet = .legend }).environment(model)
    case .legend: TajweedLegendSheet(dark: scheme == .dark)
    case .reciter: ReciterPickerSheet().environment(model)
    }
  }

  private func num(_ v: Int) -> String { Fmt.number(v, numerals: model.settings.numerals) }
}

/// روابط قائمة (من بيانات المتجر: privacy_url وsupport_url) — لا عناوين مخترعة
enum SakinahLinks {
  static let privacy = "https://osamafa86-dotcom.github.io/mediapro/privacy.html"
  static let support = "https://github.com/osamafa86-dotcom/mediapro/issues"
}

// MARK: - الأذان والتنبيهات (شاشة فرعية — كل ما كان في مجموعة «الإشعارات» القديمة)
struct NotificationSettingsView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  @State private var showAdhanPicker = false
  @State private var showPrePicker = false
  @State private var denied = false
  @State private var testSent = false

  var body: some View {
    let n = model.notifications
    let prefs = Binding<ReminderPrefs>(get: { model.settings.reminders }, set: { model.settings.reminders = $0; model.rescheduleNotifications() })
    let issues = AdhanGuard.issues(model, includeSnoozed: true).count
    ScrollView {
      VStack(alignment: .leading, spacing: 22) {
        SettingsHeader(title: "الأذان والتنبيهات", backTitle: "الإعدادات") { dismiss() }
        SettingsSection("الضمان") {
          NavigationLink { AdhanGuardView().environment(model).tabBarClearance() } label: {
            SettingsItemRow(icon: "checkmark.shield", title: "ضمان الأذان",
                            value: issues == 0 ? "كل الفحوص سليمة" : (issues == 1 ? "بندٌ يحتاج إصلاحًا" : "\(num(issues)) بنود تحتاج إصلاحًا"))
          }
          .buttonStyle(.plain)
        }
        SettingsSection("الأذان") {
          SettingsToggleRow(icon: "bell", title: "إشعارات الصلاة", subtitle: statusText, isOn: Binding(get: { prefs.wrappedValue.enabled }, set: { on in
            if on { Task { let ok = await n.requestAuthorization(); await MainActor.run { denied = !ok; prefs.wrappedValue.enabled = ok } } }
            else { prefs.wrappedValue.enabled = false }
          }))
          if denied || n.authorization == .denied {
            Text("الإذن مرفوض — فعّل الإشعارات للتطبيق من إعدادات النظام")
              .font(DS.F.labelXs).foregroundStyle(DS.C.danger)
              .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 14).padding(.bottom, DS.Space.s2)
          }
          // مجموعتان (Group) كي لا تتجاوز الكتلة عشرة عناصر في ViewBuilder
          if prefs.wrappedValue.enabled {
            Group {
              SettingsRowDivider()
              Button { showAdhanPicker = true } label: {
                SettingsItemRow(icon: "speaker.wave.2", title: "صوت الأذان", value: soundLabel(prefs.wrappedValue.sound))
              }
              .buttonStyle(.plain)
              SettingsRowDivider()
              Button { showPrePicker = true } label: {
                SettingsItemRow(icon: "clock", title: "تنبيه قبل الصلاة", value: prefs.wrappedValue.preMinutes == 0 ? "لا" : "\(num(prefs.wrappedValue.preMinutes)) د")
              }
              .buttonStyle(.plain)
              SettingsRowDivider()
              NavigationLink { PrayerTogglesView().environment(model).tabBarClearance() } label: {
                SettingsItemRow(icon: "list.bullet", title: "الصلوات المُنبَّه لها", value: "\(num(prefs.wrappedValue.prayers.count)) من \(num(Prayer.allCases.count))")
              }
              .buttonStyle(.plain)
            }
            Group {
              SettingsRowDivider()
              SettingsToggleRow(icon: "speaker.wave.3", title: "الأذان الكامل داخل التطبيق", subtitle: "في الإشعار يُسمع ٢٨ ثانية — حدّ النظام",
                                isOn: Binding(get: { model.settings.fullAdhanInApp }, set: { model.settings.fullAdhanInApp = $0 }))
              SettingsRowDivider()
              Button { model.adhan.isPlaying ? model.adhan.stop() : model.adhan.play(sound: prefs.wrappedValue.sound) } label: {
                SettingsItemRow(icon: model.adhan.isPlaying ? "stop.fill" : "play.fill", title: model.adhan.isPlaying ? "إيقاف الأذان" : "تجربة الأذان", tint: DS.C.brandPrimary, chevron: false)
              }
              .buttonStyle(.plain)
              SettingsRowDivider()
              Button {
                AdhanGuard.test(sound: prefs.wrappedValue.sound); testSent = true
                Task { try? await Task.sleep(for: .seconds(12)); testSent = false }
              } label: {
                SettingsItemRow(icon: "bell.badge", title: testSent ? "أُرسل الاختبار: انتظر ١٠ ثوانٍ" : "اختبر إشعار الأذان", tint: DS.C.brandPrimary, chevron: false)
              }
              .buttonStyle(.plain)
              .disabled(testSent)
            }
          }
        }
        SettingsSection("تنبيهات أخرى") {
          SettingsToggleRow(icon: "text.book.closed", title: "حديث اليوم", subtitle: "يوميًا \u{2066}\(model.content.extraReminders.hadithTime)\u{2069}",
                            isOn: Binding(get: { model.content.extraReminders.hadithDaily }, set: { var x = model.content.extraReminders; x.hadithDaily = $0; model.content.extraReminders = x; model.rescheduleNotifications() }))
          SettingsRowDivider()
          SettingsToggleRow(icon: "bolt", title: "نشاط مباشر للصلاة القادمة", subtitle: "عدّ تنازلي على شاشة القفل والجزيرة الديناميكية",
                            isOn: Binding(get: { model.settings.liveActivity }, set: { model.settings.liveActivity = $0; LiveActivityManager.sync(model) }))
        }
        Text("تذكير الأذكار ووقت حديث اليوم من صفّ «تذكير الأذكار» في الإعدادات.")
          .font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).fixedSize(horizontal: false, vertical: true)
      }
      .padding(.horizontal, DS.Space.s4).padding(.top, DS.Space.s2).padding(.bottom, DS.Space.s8)
      .readableWidth()
    }
    .background(DS.C.bgCanvas)
    .navigationBarHidden(true)
    .confirmationDialog("صوت الأذان", isPresented: $showAdhanPicker, titleVisibility: .visible) {
      Button("أذان — الشيخ عبد الباسط فخري") { var p = prefs.wrappedValue; p.sound = "adhan-fakhry"; prefs.wrappedValue = p }
      Button("أذان — عزيز") { var p = prefs.wrappedValue; p.sound = "adhan-azeez"; prefs.wrappedValue = p }
      Button("نغمة النظام") { var p = prefs.wrappedValue; p.sound = "chime"; prefs.wrappedValue = p }
      Button("صامت") { var p = prefs.wrappedValue; p.sound = "none"; prefs.wrappedValue = p }
      Button("إلغاء", role: .cancel) {}
    }
    .confirmationDialog("تنبيه قبل الصلاة", isPresented: $showPrePicker, titleVisibility: .visible) {
      ForEach([0, 5, 10, 15, 20, 30], id: \.self) { m in
        Button(m == 0 ? "لا تنبيه" : "\(num(m)) دقيقة") { var p = prefs.wrappedValue; p.preMinutes = m; prefs.wrappedValue = p }
      }
      Button("إلغاء", role: .cancel) {}
    }
  }

  private func soundLabel(_ id: String) -> String {
    switch id { case "adhan-fakhry": return "فخري، كامل"; case "adhan-azeez": return "عزيز، كامل"; case "chime": return "نغمة"; default: return "صامت" }
  }
  private var statusText: String {
    let n = model.notifications
    guard model.settings.reminders.enabled else { return "تصل حتى والتطبيق مغلق" }
    if let until = n.scheduledUntil { return "\(num(n.pendingCount)) موعدًا حتى \(Fmt.gregorian(until, tz: model.timeZone, numerals: model.settings.numerals))" }
    return "قيد الجدولة…"
  }
  private func num(_ v: Int) -> String { Fmt.number(v, numerals: model.settings.numerals) }
}

// MARK: - الأرقام والوقت والتاريخ (شاشة فرعية — كانت في «المظهر» القديمة)
struct FormatsSettingsView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    let s = model.settings
    let h = model.hijri(now: Date())
    let off = s.hijriOffset
    let offText = off == 0 ? "بلا تعديل" : "تعديل \u{2066}\(off > 0 ? "+" : "−")\(num(abs(off)))\u{2069} \(abs(off) == 1 ? "يوم" : "يومان")"
    ScrollView {
      VStack(alignment: .leading, spacing: 22) {
        SettingsHeader(title: "الأرقام والوقت والتاريخ", backTitle: "الإعدادات") { dismiss() }
        SettingsSection("العرض") {
          HStack(spacing: 12) {
            SettingsIcon(name: "textformat.123")
            Text("الأرقام").font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary)
            Spacer(minLength: 8)
            DSSegmented(items: ["١٢٣", "123"], selection: Binding(
              get: { model.settings.numerals == "arab" ? 0 : 1 },
              set: { model.settings.numerals = $0 == 0 ? "arab" : "latn"; model.rescheduleNotifications() }))
              .frame(width: 150)
          }
          .padding(.horizontal, 14).frame(minHeight: 60)
          SettingsRowDivider()
          SettingsToggleRow(icon: "clock", title: "نظام ١٢ ساعة", subtitle: nil,
                            isOn: Binding(get: { model.settings.hour12 }, set: { model.settings.hour12 = $0; model.rescheduleNotifications() }))
          SettingsRowDivider()
          HStack(spacing: 12) {
            SettingsIcon(name: "moon")
            VStack(alignment: .leading, spacing: 2) {
              Text("تعديل التاريخ الهجري").font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary)
              Text("اليوم \(num(h.day)) \(h.monthName) \(num(h.year))هـ — \(offText)").font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary)
                .lineLimit(2).minimumScaleFactor(0.85)
            }
            Spacer(minLength: 8)
            Stepper("تعديل التاريخ الهجري", value: Binding(get: { model.settings.hijriOffset }, set: { model.settings.hijriOffset = $0; model.rescheduleNotifications() }), in: -2...2)
              .labelsHidden()
          }
          .padding(.horizontal, 14).padding(.vertical, 8).frame(minHeight: 60)
        }
        SettingsSection("العدّ") {
          SettingsToggleRow(icon: "iphone.radiowaves.left.and.right", title: "الاهتزاز عند العدّ", subtitle: "في المسبحة والأذكار",
                            isOn: Binding(get: { model.settings.haptics }, set: { model.settings.haptics = $0 }))
        }
      }
      .padding(.horizontal, DS.Space.s4).padding(.top, DS.Space.s2).padding(.bottom, DS.Space.s8)
      .readableWidth()
    }
    .background(DS.C.bgCanvas)
    .navigationBarHidden(true)
  }
  private func num(_ v: Int) -> String { Fmt.number(v, numerals: model.settings.numerals) }
}

// MARK: - الخصوصية (شاشة فرعية — نصّ «عن التطبيق» القائم والإصدار، ورابط السياسة الكاملة)
struct PrivacyAboutView: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(\.openURL) private var openURL
  private var version: String { (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "—" }
  private var build: String { (Bundle.main.infoDictionary?["CFBundleVersion"] as? String) ?? "—" }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 22) {
        SettingsHeader(title: "الخصوصية", backTitle: "الإعدادات") { dismiss() }
        VStack(alignment: .leading, spacing: 10) {
          Text("كل الحسابات على جهازك").font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary)
          Text("تطبيق أصلي بالكامل (Swift وSwiftUI) على نواة SakinahCore المُختبرة رقمًا برقم ضد محرّك سكينة المُتحقَّق منه. كل الحسابات تجري على جهازك؛ لا حساب ولا تتبّع.")
            .font(DS.F.bodySm).foregroundStyle(DS.C.textSecondary).fixedSize(horizontal: false, vertical: true)
          Text("الشبكة تُستعمل فقط عند الطلب: لجلب التلاوات وخطوط صفحات المصحف، وتلاوة الأذكار، والمساجد القريبة، والطقس إن فعّلته.")
            .font(DS.F.bodySm).foregroundStyle(DS.C.textSecondary).fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(DS.C.bgSurface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(DS.C.borderSubtle, lineWidth: 1))
        SettingsSection("المزيد") {
          Button { if let u = URL(string: SakinahLinks.privacy) { openURL(u) } } label: {
            SettingsItemRow(icon: "doc.text", title: "سياسة الخصوصية كاملة")
          }
          .buttonStyle(.plain)
          SettingsRowDivider()
          SettingsItemRow(icon: "info.circle", title: "الإصدار", value: "\u{2066}\(version) (\(build))\u{2069}", chevron: false)
        }
      }
      .padding(.horizontal, DS.Space.s4).padding(.top, DS.Space.s2).padding(.bottom, DS.Space.s8)
      .readableWidth()
    }
    .background(DS.C.bgCanvas)
    .navigationBarHidden(true)
  }
}

// MARK: - مكوّنات الإعدادات الجديدة
/// رأس شاشةٍ فرعية: رابط رجوع «‹ اليوم» (يمين) ثم عنوان كوفي كبير
struct SettingsHeader: View {
  let title: String
  var backTitle: String? = nil
  var onBack: () -> Void = {}
  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      if let backTitle {
        Button(action: onBack) {
          HStack(spacing: 4) {
            Image(systemName: "chevron.backward").font(.system(size: 15, weight: .semibold))
            Text(backTitle).font(DS.F.labelMd)
          }
          .foregroundStyle(DS.C.brandPrimary)
          .frame(minHeight: 44).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("رجوع إلى \(backTitle)")
      }
      Text(title).font(DS.kufi(32, .bold)).foregroundStyle(DS.C.textPrimary).lineLimit(1).minimumScaleFactor(0.7)
        .accessibilityAddTraits(.isHeader)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// مجموعة: عنوانٌ صغير (يمين) فوق بطاقةٍ بحدٍّ خفيف تضمّ الصفوف
struct SettingsSection<Content: View>: View {
  let title: String
  @ViewBuilder var content: () -> Content
  init(_ title: String, @ViewBuilder content: @escaping () -> Content) { self.title = title; self.content = content }
  var body: some View {
    VStack(alignment: .leading, spacing: DS.Space.s2) {
      Text(title).font(DS.F.labelSm).foregroundStyle(DS.C.textTertiary).padding(.horizontal, DS.Space.s1)
        .accessibilityAddTraits(.isHeader)
      VStack(spacing: 0) { content() }
        .frame(maxWidth: .infinity)
        .background(DS.C.bgSurface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(DS.C.borderSubtle, lineWidth: 1))
    }
  }
}

/// أيقونة الصفّ في مربّع ناعم
struct SettingsIcon: View {
  let name: String
  var body: some View {
    Image(systemName: name).font(.system(size: 15, weight: .medium)).foregroundStyle(DS.C.brandPrimary)
      .frame(width: 34, height: 34)
      .background(DS.C.brandSoft, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
      .accessibilityHidden(true)
  }
}

/// صفّ: أيقونة (يمين)، عنوان، ثم القيمة والسهم (يسار) — يُقرأ جملةً واحدة
struct SettingsItemRow: View {
  let icon: String
  let title: String
  var value: String? = nil
  var tint: Color? = nil
  var chevron = true
  var body: some View {
    HStack(spacing: 12) {
      SettingsIcon(name: icon)
      Text(title).font(DS.F.bodyMd).foregroundStyle(tint ?? DS.C.textPrimary).lineLimit(1).minimumScaleFactor(0.85)
      Spacer(minLength: 8)
      if let value {
        Text(value).font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary).lineLimit(1).minimumScaleFactor(0.75)
      }
      if chevron { DSChevron() }
    }
    .padding(.horizontal, 14).frame(minHeight: 54)
    .contentShape(Rectangle())
    .accessibilityElement(children: .combine)
  }
}

/// صفّ مفتاح: أيقونة وعنوان ووصف اختياري (يمين)، والمفتاح (يسار)
struct SettingsToggleRow: View {
  let icon: String
  let title: String
  var subtitle: String? = nil
  @Binding var isOn: Bool
  var body: some View {
    Toggle(isOn: $isOn) {
      HStack(spacing: 12) {
        SettingsIcon(name: icon)
        VStack(alignment: .leading, spacing: 2) {
          Text(title).font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary)
          if let subtitle {
            Text(subtitle).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).fixedSize(horizontal: false, vertical: true)
          }
        }
      }
    }
    .toggleStyle(DSToggleStyle())
    .padding(.horizontal, 14).padding(.vertical, 8).frame(minHeight: 54)
  }
}

/// فاصلٌ يبدأ بعد الأيقونة
struct SettingsRowDivider: View {
  var body: some View { Divider().overlay(DS.C.borderSubtle).padding(.leading, 60) }
}

// MARK: - مكوّنات قديمة تستعملها شاشات أخرى (مظهر السماء، ضمان الأذان، الصلوات المنبَّه لها)
/// مجموعة إعدادات: عنوان صغير فوق بطاقة تضمّ الصفوف
struct SettingsGroup<Content: View>: View {
  let title: String
  @ViewBuilder var content: () -> Content
  init(_ title: String, @ViewBuilder content: @escaping () -> Content) { self.title = title; self.content = content }
  var body: some View {
    VStack(alignment: .trailing, spacing: DS.Space.s2) {
      Text(title).font(DS.F.labelSm).foregroundStyle(DS.C.textTertiary)
        .frame(maxWidth: .infinity, alignment: .trailing).padding(.horizontal, DS.Space.s1)
      VStack(spacing: 0) { content() }.dsCard(padding: DS.Space.s1)
    }
  }
}

/// صفّ إعداد: عنوان ووصف على اليمين، وقيمة وسهم على اليسار
struct SettingsRow: View {
  let title: String
  var subtitle: String? = nil
  var value: String? = nil
  var tint: Color? = nil
  var body: some View {
    HStack(spacing: DS.Space.s3) {
      if let v = value {
        HStack(spacing: 2) {
          Text(v).font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary).lineLimit(1).minimumScaleFactor(0.7)
          Image(systemName: "chevron.forward").font(.system(size: 11, weight: .semibold)).foregroundStyle(DS.C.textTertiary)
        }
      } else {
        Image(systemName: "chevron.forward").font(.system(size: 11, weight: .semibold)).foregroundStyle(DS.C.textTertiary)
      }
      Spacer(minLength: 0)
      VStack(alignment: .trailing, spacing: 2) {
        Text(title).font(DS.F.bodyMd).foregroundStyle(tint ?? DS.C.textPrimary)
        if let s = subtitle { Text(s).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).lineLimit(1).minimumScaleFactor(0.7) }
      }
    }
    .padding(.vertical, DS.Space.s3).padding(.horizontal, DS.Space.s3)
    .contentShape(Rectangle())
  }
}

struct SettingsDivider: View {
  var body: some View { Divider().overlay(DS.C.borderSubtle).padding(.horizontal, DS.Space.s3) }
}

/// اختيار الصلوات التي يصلها التنبيه
struct PrayerTogglesView: View {
  @Environment(AppModel.self) private var model
  var body: some View {
    let prefs = Binding<ReminderPrefs>(get: { model.settings.reminders }, set: { model.settings.reminders = $0; model.rescheduleNotifications() })
    ScrollView {
      SettingsGroup("الصلوات") {
        ForEach(Array(Prayer.allCases.enumerated()), id: \.element) { i, p in
          if i > 0 { SettingsDivider() }
          Toggle(isOn: Binding(
            get: { prefs.wrappedValue.prayers.contains(p) },
            set: { v in if v { prefs.wrappedValue.prayers.insert(p) } else { prefs.wrappedValue.prayers.remove(p) } })) {
            Text(p == .sunrise ? "الشروق (تنبيه هادئ)" : p.nameAr).font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary)
          }
          .toggleStyle(DSToggleStyle()).padding(.vertical, DS.Space.s2).padding(.horizontal, DS.Space.s3)
        }
      }
      .padding(DS.Space.s4)
    }
    .background(DS.C.bgCanvas)
    .navigationTitle("الصلوات المُنبَّه لها").navigationBarTitleDisplayMode(.inline)
  }
}
