import SwiftUI
import UserNotifications
import SakinahCore

struct SettingsView: View {
  @Environment(AppModel.self) private var model
  private var version: String { (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "—" }
  private var build: String { (Bundle.main.infoDictionary?["CFBundleVersion"] as? String) ?? "—" }

  var body: some View {
    @Bindable var settings = model.settings
    Group {
      Form {
        Section("الموقع") {
          NavigationLink { CityPickerView() } label: { HStack { Text("المكان"); Spacer(); Text(model.location.placeName ?? "غير محدد").foregroundStyle(.secondary).lineLimit(1) } }
          if model.location.mode == .gps { Button("تحديث الموقع") { model.location.requestLocation() } }
        }
        Section("المواقيت") {
          NavigationLink { MethodPicker() } label: { HStack { Text("طريقة الحساب"); Spacer(); Text(Methods.method(settings.methodId).nameAr).font(.arabic(13)).foregroundStyle(.secondary).lineLimit(1) } }
          Picker("خطوط العرض العالية", selection: $settings.highLatitudeRule) {
            ForEach(HighLatitudeRule.allCases, id: \.self) { r in Text(r == .auto ? "تلقائي" : r.nameAr).tag(r) }
          }
          NavigationLink("الجدول الشهري وتصدير التقويم") { MonthTableView() }
        }
        NotificationsSection()
        ExtraRemindersSection()
        Section {
          Toggle(isOn: Binding(get: { model.settings.liveActivity }, set: { model.settings.liveActivity = $0; LiveActivityManager.sync(model) })) { VStack(alignment: .leading) { Text("نشاط مباشر للصلاة القادمة"); Text("عدّ تنازلي على شاشة القفل والجزيرة الديناميكية؛ يُحدَّث عند فتح التطبيق").font(.arabic(12)).foregroundStyle(.secondary) } }
        } header: { Text("شاشة القفل") } footer: { Text("أضف ودجت «مواقيت الصلاة» إلى الشاشة الرئيسية أو شاشة القفل من محرر الودجات: يعمل بموقع الجهاز أو بمدينة تختارها من إعدادات الودجت.").font(.arabic(11)) }
        Section("العرض") {
          Toggle("نظام 12 ساعة", isOn: $settings.hour12)
          Picker("الأرقام", selection: $settings.numerals) { Text("1 2 3").tag("latn"); Text("١ ٢ ٣").tag("arab") }
          Stepper("تعديل التاريخ الهجري: \(Fmt.number(settings.hijriOffset, numerals: settings.numerals)) يوم", value: $settings.hijriOffset, in: -2...2)
        }
        BackupSection()
        Section("عن التطبيق") {
          HStack { Text("الإصدار"); Spacer(); Text("\(version) (بناء \(build))").foregroundStyle(.secondary) }
          Text("تطبيق أصلي بالكامل (Swift وSwiftUI) على نواة SakinahCore المُختبرة رقمًا برقم ضد محرك سكينة المُتحقَّق منه. كل الحسابات تتم على جهازك؛ لا حساب ولا تتبّع.").font(.arabic(13)).foregroundStyle(.secondary)
        }
      }
      .navigationTitle("الإعدادات").navigationBarTitleDisplayMode(.inline)
      .onChange(of: settings.highLatitudeRule) { model.rescheduleNotifications() }
      .onChange(of: settings.hour12) { model.rescheduleNotifications() }
      .onChange(of: settings.numerals) { model.rescheduleNotifications() }
    }
  }
}

/// قسم الإشعارات: تفعيل، الصلوات، تذكير قبل الأذان، الصوت، تجربة الأذان
struct NotificationsSection: View {
  @Environment(AppModel.self) private var model
  @State private var denied = false

  private var prefs: Binding<ReminderPrefs> { Binding(get: { model.settings.reminders }, set: { model.settings.reminders = $0; model.rescheduleNotifications() }) }

  var body: some View {
    let n = model.notifications
    Section {
      Toggle(isOn: Binding(get: { prefs.wrappedValue.enabled }, set: { on in
        if on { Task { let ok = await n.requestAuthorization(); await MainActor.run { denied = !ok; prefs.wrappedValue.enabled = ok } } } else { prefs.wrappedValue.enabled = false }
      })) {
        VStack(alignment: .leading) { Text("تذكير بمواعيد الصلاة").font(.arabic(16)); Text(statusText).font(.arabic(12)).foregroundStyle(.secondary) }
      }
      if denied || n.authorization == .denied { Text("الإذن مرفوض — فعّل الإشعارات للتطبيق من إعدادات النظام").font(.arabic(13)).foregroundStyle(.red) }
      if prefs.wrappedValue.enabled {
        ForEach(Prayer.allCases, id: \.self) { p in
          Toggle(p == .sunrise ? "الشروق (تنبيه هادئ)" : p.nameAr, isOn: Binding(get: { prefs.wrappedValue.prayers.contains(p) }, set: { v in if v { prefs.wrappedValue.prayers.insert(p) } else { prefs.wrappedValue.prayers.remove(p) } }))
        }
        Picker("تذكير قبل الأذان", selection: Binding(get: { prefs.wrappedValue.preMinutes }, set: { prefs.wrappedValue.preMinutes = $0 })) {
          Text("لا").tag(0); Text("٥ دقائق").tag(5); Text("١٠ دقائق").tag(10); Text("١٥ دقيقة").tag(15); Text("٢٠ دقيقة").tag(20); Text("٣٠ دقيقة").tag(30)
        }
        Picker("صوت الإشعار", selection: Binding(get: { prefs.wrappedValue.sound }, set: { prefs.wrappedValue.sound = $0 })) {
          Text("أذان (الشيخ عبد الباسط فخري)").tag("adhan-fakhry"); Text("أذان (عزيز)").tag("adhan-azeez"); Text("نغمة النظام").tag("chime"); Text("صامت").tag("none")
        }
        Toggle("الأذان الكامل داخل التطبيق عند دخول الوقت", isOn: Binding(get: { model.settings.fullAdhanInApp }, set: { model.settings.fullAdhanInApp = $0 }))
        Button(model.adhan.isPlaying ? "إيقاف الأذان" : "تجربة الأذان") {
          if model.adhan.isPlaying { model.adhan.stop() } else { model.adhan.play(sound: prefs.wrappedValue.sound) }
        }
      }
    } header: { Text("الإشعارات") } footer: {
      Text("في الإشعار (والتطبيق مغلق) يُسمع مقطع 28 ثانية من الأذان — حدّ النظام — وداخل التطبيق الأذان كاملًا. تُجدوَل أقرب 60 موعدًا وتُجدَّد تلقائيًا عند فتح التطبيق.").font(.arabic(12))
    }
  }

  private var statusText: String {
    let n = model.notifications
    guard model.settings.reminders.enabled else { return "إشعارات النظام تصل حتى والتطبيق مغلق" }
    if let until = n.scheduledUntil { return "\(Fmt.number(n.pendingCount, numerals: model.settings.numerals)) موعدًا مجدولًا حتى \(Fmt.gregorian(until, tz: model.timeZone, numerals: model.settings.numerals))" }
    return "قيد الجدولة…"
  }
}
