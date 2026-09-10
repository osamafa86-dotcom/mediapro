import SwiftUI
import UserNotifications
import SakinahCore

/// شاشة الإعدادات (تصميم Figma 13): مجموعات ببطاقات، صفوف بقيمة على اليسار، ومبدّلات مضمّنة
struct SettingsView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  @State private var showAdhanPicker = false
  @State private var showPrePicker = false
  @State private var showNumerals = false
  @State private var denied = false
  private var version: String { (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "—" }
  private var build: String { (Bundle.main.infoDictionary?["CFBundleVersion"] as? String) ?? "—" }

  var body: some View {
    @Bindable var settings = model.settings
    ScrollView {
      VStack(spacing: DS.Space.s4) {
        locationGroup(settings)
        notificationsGroup(settings)
        appearanceGroup(settings)
        dataGroup
        aboutGroup
      }
      .padding(.horizontal, DS.Space.s4).padding(.top, DS.Space.s2).padding(.bottom, DS.Space.s8)
    }
    .background(DS.C.bgCanvas)
    .safeAreaInset(edge: .top, spacing: 0) {
      HStack {
        Spacer()
        Text("الإعدادات").font(DS.F.headingLg).foregroundStyle(DS.C.textPrimary)
        Spacer()
        DSIconButton(systemName: "chevron.forward", label: "رجوع") { dismiss() }
      }
      .padding(.horizontal, DS.Space.s4).padding(.vertical, DS.Space.s3).background(DS.C.bgCanvas)
    }
    .navigationBarHidden(true)
    .onChange(of: settings.highLatitudeRule) { model.rescheduleNotifications() }
    .onChange(of: settings.hour12) { model.rescheduleNotifications() }
    .onChange(of: settings.numerals) { model.rescheduleNotifications() }
  }

  // MARK: الموقع والحساب

  @ViewBuilder private func locationGroup(_ settings: Settings) -> some View {
    let s = model.settings
    SettingsGroup("الموقع والحساب") {
      NavigationLink { CityPickerView().environment(model) } label: {
        SettingsRow(title: "الموقع", subtitle: model.location.placeName ?? "غير محدد", value: model.location.mode == .gps ? "تلقائي" : "تغيير")
      }.buttonStyle(.plain)
      SettingsDivider()
      NavigationLink { MethodPicker().environment(model) } label: {
        SettingsRow(title: "طريقة الحساب", subtitle: s.methodIsAutomatic ? "تُختار حسب الدولة" : "اختيار يدوي", value: Methods.method(s.methodId).nameAr)
      }.buttonStyle(.plain)
      SettingsDivider()
      HStack {
        Text("مذهب العصر").font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary)
        Spacer()
        DSSegmented(items: ["حنفي", "الجمهور"], selection: Binding(
          get: { s.madhab == .hanafi ? 0 : 1 },
          set: { model.settings.madhab = $0 == 0 ? .hanafi : .shafi; model.rescheduleNotifications() }))
          .frame(width: 168)
      }
      .padding(.vertical, DS.Space.s2).padding(.horizontal, DS.Space.s3)
      SettingsDivider()
      HStack {
        Text("خطوط العرض العالية").font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary)
        Spacer()
        Picker("", selection: Binding(get: { s.highLatitudeRule }, set: { model.settings.highLatitudeRule = $0 })) {
          ForEach(HighLatitudeRule.allCases, id: \.self) { r in Text(r == .auto ? "تلقائي" : r.nameAr).tag(r) }
        }
        .labelsHidden().tint(DS.C.brandPrimary)
      }
      .padding(.vertical, DS.Space.s2).padding(.horizontal, DS.Space.s3)
      SettingsDivider()
      NavigationLink { MonthTableView().environment(model) } label: {
        SettingsRow(title: "الجدول الشهري", subtitle: "تصدير إلى التقويم (ICS)", value: nil)
      }.buttonStyle(.plain)
    }
  }

  // MARK: الإشعارات

  @ViewBuilder private func notificationsGroup(_ settings: Settings) -> some View {
    let n = model.notifications
    let prefs = Binding<ReminderPrefs>(get: { model.settings.reminders }, set: { model.settings.reminders = $0; model.rescheduleNotifications() })
    SettingsGroup("الإشعارات") {
      Toggle(isOn: Binding(get: { prefs.wrappedValue.enabled }, set: { on in
        if on { Task { let ok = await n.requestAuthorization(); await MainActor.run { denied = !ok; prefs.wrappedValue.enabled = ok } } }
        else { prefs.wrappedValue.enabled = false }
      })) {
        VStack(alignment: .trailing, spacing: 2) {
          Text("إشعارات الصلاة").font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary)
          Text(statusText).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).lineLimit(1).minimumScaleFactor(0.7)
        }
      }
      .toggleStyle(DSToggleStyle()).padding(.vertical, DS.Space.s2).padding(.horizontal, DS.Space.s3)
      if denied || n.authorization == .denied {
        Text("الإذن مرفوض — فعّل الإشعارات للتطبيق من إعدادات النظام")
          .font(DS.F.labelXs).foregroundStyle(DS.C.danger)
          .frame(maxWidth: .infinity, alignment: .trailing).padding(.horizontal, DS.Space.s3).padding(.bottom, DS.Space.s2)
      }
      if prefs.wrappedValue.enabled {
        SettingsDivider()
        Button { showAdhanPicker = true } label: {
          SettingsRow(title: "صوت الأذان", subtitle: nil, value: soundLabel(prefs.wrappedValue.sound))
        }.buttonStyle(.plain)
        SettingsDivider()
        Button { showPrePicker = true } label: {
          SettingsRow(title: "تنبيه قبل الصلاة", subtitle: nil, value: prefs.wrappedValue.preMinutes == 0 ? "لا" : "\(Fmt.number(prefs.wrappedValue.preMinutes, numerals: model.settings.numerals)) د")
        }.buttonStyle(.plain)
        SettingsDivider()
        NavigationLink { PrayerTogglesView().environment(model) } label: {
          SettingsRow(title: "الصلوات المُنبَّه لها", subtitle: nil, value: "\(Fmt.number(prefs.wrappedValue.prayers.count, numerals: model.settings.numerals)) من \(Fmt.number(Prayer.allCases.count, numerals: model.settings.numerals))")
        }.buttonStyle(.plain)
        SettingsDivider()
        Toggle(isOn: Binding(get: { model.settings.fullAdhanInApp }, set: { model.settings.fullAdhanInApp = $0 })) {
          VStack(alignment: .trailing, spacing: 2) {
            Text("الأذان الكامل داخل التطبيق").font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary)
            Text("في الإشعار يُسمع ٢٨ ثانية — حدّ النظام").font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary)
          }
        }
        .toggleStyle(DSToggleStyle()).padding(.vertical, DS.Space.s2).padding(.horizontal, DS.Space.s3)
        SettingsDivider()
        Button { model.adhan.isPlaying ? model.adhan.stop() : model.adhan.play(sound: prefs.wrappedValue.sound) } label: {
          SettingsRow(title: model.adhan.isPlaying ? "إيقاف الأذان" : "تجربة الأذان", subtitle: nil, value: nil, tint: DS.C.brandPrimary)
        }.buttonStyle(.plain)
      }
      SettingsDivider()
      Toggle(isOn: adhkarBinding) {
        VStack(alignment: .trailing, spacing: 2) {
          Text("أذكار الصباح والمساء").font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary)
          Text("بعد الفجر والعصر بـ\(Fmt.number(model.content.extraReminders.morningAfter, numerals: model.settings.numerals)) دقيقة")
            .font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary)
        }
      }
      .toggleStyle(DSToggleStyle()).padding(.vertical, DS.Space.s2).padding(.horizontal, DS.Space.s3)
      SettingsDivider()
      Toggle(isOn: Binding(get: { model.content.extraReminders.hadithDaily }, set: { var x = model.content.extraReminders; x.hadithDaily = $0; model.content.extraReminders = x; model.rescheduleNotifications() })) {
        VStack(alignment: .trailing, spacing: 2) {
          Text("حديث اليوم").font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary)
          Text(model.content.extraReminders.hadithTime).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary)
        }
      }
      .toggleStyle(DSToggleStyle()).padding(.vertical, DS.Space.s2).padding(.horizontal, DS.Space.s3)
      SettingsDivider()
      Toggle(isOn: Binding(get: { model.settings.liveActivity }, set: { model.settings.liveActivity = $0; LiveActivityManager.sync(model) })) {
        VStack(alignment: .trailing, spacing: 2) {
          Text("نشاط مباشر للصلاة القادمة").font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary)
          Text("عدّ تنازلي على شاشة القفل والجزيرة الديناميكية").font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary)
        }
      }
      .toggleStyle(DSToggleStyle()).padding(.vertical, DS.Space.s2).padding(.horizontal, DS.Space.s3)
    }
    .confirmationDialog("صوت الأذان", isPresented: $showAdhanPicker, titleVisibility: .visible) {
      Button("أذان — الشيخ عبد الباسط فخري") { var p = prefs.wrappedValue; p.sound = "adhan-fakhry"; prefs.wrappedValue = p }
      Button("أذان — عزيز") { var p = prefs.wrappedValue; p.sound = "adhan-azeez"; prefs.wrappedValue = p }
      Button("نغمة النظام") { var p = prefs.wrappedValue; p.sound = "chime"; prefs.wrappedValue = p }
      Button("صامت") { var p = prefs.wrappedValue; p.sound = "none"; prefs.wrappedValue = p }
      Button("إلغاء", role: .cancel) {}
    }
    .confirmationDialog("تنبيه قبل الصلاة", isPresented: $showPrePicker, titleVisibility: .visible) {
      ForEach([0, 5, 10, 15, 20, 30], id: \.self) { m in
        Button(m == 0 ? "لا تنبيه" : "\(Fmt.number(m, numerals: model.settings.numerals)) دقيقة") { var p = prefs.wrappedValue; p.preMinutes = m; prefs.wrappedValue = p }
      }
      Button("إلغاء", role: .cancel) {}
    }
  }

  private var adhkarBinding: Binding<Bool> {
    Binding(get: { model.content.extraReminders.adhkarMorning || model.content.extraReminders.adhkarEvening },
            set: { on in var x = model.content.extraReminders; x.adhkarMorning = on; x.adhkarEvening = on; model.content.extraReminders = x; model.rescheduleNotifications() })
  }
  private func soundLabel(_ id: String) -> String {
    switch id { case "adhan-fakhry": return "فخري · كامل"; case "adhan-azeez": return "عزيز · كامل"; case "chime": return "نغمة"; default: return "صامت" }
  }
  private var statusText: String {
    let n = model.notifications
    guard model.settings.reminders.enabled else { return "تصل حتى والتطبيق مغلق" }
    if let until = n.scheduledUntil { return "\(Fmt.number(n.pendingCount, numerals: model.settings.numerals)) موعدًا حتى \(Fmt.gregorian(until, tz: model.timeZone, numerals: model.settings.numerals))" }
    return "قيد الجدولة…"
  }

  // MARK: المظهر

  @ViewBuilder private func appearanceGroup(_ settings: Settings) -> some View {
    SettingsGroup("المظهر") {
      HStack {
        Text("الأرقام").font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary)
        Spacer()
        DSSegmented(items: ["١٢٣", "123"], selection: Binding(
          get: { model.settings.numerals == "arab" ? 0 : 1 },
          set: { model.settings.numerals = $0 == 0 ? "arab" : "latn" }))
          .frame(width: 140)
      }
      .padding(.vertical, DS.Space.s2).padding(.horizontal, DS.Space.s3)
      SettingsDivider()
      HStack {
        Text("نظام ١٢ ساعة").font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary)
        Spacer()
        Toggle("", isOn: Binding(get: { model.settings.hour12 }, set: { model.settings.hour12 = $0 })).labelsHidden().toggleStyle(DSToggleStyle())
      }
      .padding(.vertical, DS.Space.s2).padding(.horizontal, DS.Space.s3)
      SettingsDivider()
      HStack {
        VStack(alignment: .trailing, spacing: 2) {
          Text("تعديل التاريخ الهجري").font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary)
          Text("\(Fmt.number(model.settings.hijriOffset, numerals: model.settings.numerals)) يوم").font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary)
        }
        Spacer()
        Stepper("", value: Binding(get: { model.settings.hijriOffset }, set: { model.settings.hijriOffset = $0 }), in: -2...2).labelsHidden()
      }
      .padding(.vertical, DS.Space.s2).padding(.horizontal, DS.Space.s3)
      SettingsDivider()
      HStack {
        VStack(alignment: .trailing, spacing: 2) {
          Text("حجم نص الأذكار والأحاديث").font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary)
          Text("\(Int(model.content.textScale * 100))٪").font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary)
        }
        Spacer()
        HStack(spacing: DS.Space.s2) {
          DSIconButton(systemName: "minus", style: .soft, size: 34, iconSize: 13, label: "تصغير") { model.content.textScale = max(0.8, model.content.textScale - 0.1) }
          DSIconButton(systemName: "plus", style: .soft, size: 34, iconSize: 13, label: "تكبير") { model.content.textScale = min(1.6, model.content.textScale + 0.1) }
        }
      }
      .padding(.vertical, DS.Space.s2).padding(.horizontal, DS.Space.s3)
      SettingsDivider()
      Toggle(isOn: Binding(get: { model.settings.haptics }, set: { model.settings.haptics = $0 })) {
        Text("الاهتزاز عند العدّ").font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary)
      }
      .toggleStyle(DSToggleStyle()).padding(.vertical, DS.Space.s2).padding(.horizontal, DS.Space.s3)
    }
  }

  // MARK: البيانات وعن التطبيق

  private var dataGroup: some View {
    SettingsGroup("البيانات") {
      NavigationLink { BackupView().environment(model) } label: {
        SettingsRow(title: "النسخ الاحتياطي", subtitle: "تصدير واستيراد إعداداتك وعلاماتك", value: nil)
      }.buttonStyle(.plain)
      SettingsDivider()
      NavigationLink { DownloadsView().environment(model) } label: {
        SettingsRow(title: "التلاوات دون اتصال", subtitle: "تنزيل السور وحذفها", value: nil)
      }.buttonStyle(.plain)
    }
  }

  private var aboutGroup: some View {
    VStack(alignment: .trailing, spacing: DS.Space.s2) {
      Text("عن التطبيق").font(DS.F.labelSm).foregroundStyle(DS.C.textTertiary)
        .frame(maxWidth: .infinity, alignment: .trailing).padding(.horizontal, DS.Space.s1)
      VStack(alignment: .trailing, spacing: DS.Space.s2) {
        HStack {
          Text("الإصدار").font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary)
          Spacer()
          Text("\(version) (بناء \(build))").font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary).monospacedDigit()
        }
        Text("تطبيق أصلي بالكامل (Swift وSwiftUI) على نواة SakinahCore المُختبرة رقمًا برقم ضد محرّك سكينة المُتحقَّق منه. كل الحسابات تجري على جهازك؛ لا حساب ولا تتبّع.")
          .font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary)
          .frame(maxWidth: .infinity, alignment: .trailing)
      }
      .dsCard(padding: DS.Space.s4)
    }
  }
}

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
