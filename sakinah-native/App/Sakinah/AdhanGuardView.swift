import SwiftUI
import UserNotifications
import SakinahCore

/// «ضمان الأذان» (صفحة «١١ · اليوم الحيّ» في فيغما) على iOS: لا بطارية ولا منبّهات دقيقة هنا،
/// فالفحص للإذن، والتنبيهات الحسّاسة للوقت (كي لا يحجب «التركيز» الأذان)، والصوت، والظهور، ومدى الجدول (حدّ ٦٤ إشعاراً)،
/// ثم الأذانات القادمة مطابَقةً بطلبات النظام المعلّقة فعلاً — لا بما «يُفترض» أنه جُدوِل.
enum AdhanGuard {
  enum Check: String { case notifications, focus, sound, visibility, horizon }
  struct Status: Identifiable {
    let check: Check; let ok: Bool; let title: String; let detail: String
    var advice: String? = nil; var opensSettings = true
    var id: String { check.rawValue }
  }
  struct Upcoming: Identifiable { let prayer: Prayer; let time: Date; let scheduled: Bool; var id: Date { time } }

  static func checks(_ model: AppModel) -> [Status] {
    let n = model.notifications, prefs = model.settings.reminders
    var out: [Status] = []
    switch (n.authorization, prefs.enabled) {
    case (.denied, _): out.append(Status(check: .notifications, ok: false, title: "الإشعارات", detail: "مرفوضة في إعدادات النظام"))
    case (_, false): out.append(Status(check: .notifications, ok: false, title: "الإشعارات", detail: "إشعارات الصلاة مطفأة في سكينة", opensSettings: false))
    case (.notDetermined, true): out.append(Status(check: .notifications, ok: false, title: "الإشعارات", detail: "لم يُطلب الإذن بعد", opensSettings: false))
    default: out.append(Status(check: .notifications, ok: true, title: "الإشعارات", detail: "مسموحة"))
    }
    // التنبيهات الحسّاسة للوقت: إطفاؤها يجعل «التركيز» و«عدم الإزعاج» يحجبان الأذان
    if n.timeSensitive == .disabled {
      out.append(Status(check: .focus, ok: false, title: "التركيز وعدم الإزعاج", detail: "قد يحجبان الأذان",
                        advice: "افتح الإعداد ثم فعّل «التنبيهات الحسّاسة للوقت» لسكينة."))
    } else {
      out.append(Status(check: .focus, ok: true, title: "التركيز وعدم الإزعاج", detail: n.timeSensitive == .enabled ? "الأذان يتجاوزهما" : "يتبعان إعدادات جهازك"))
    }
    if !n.alertsVisible, n.authorization == .authorized {
      out.append(Status(check: .visibility, ok: false, title: "ظهور الإشعار", detail: "لا يظهر في القفل ولا الإشعارات ولا الشعارات"))
    }
    if n.soundSetting == .disabled {
      out.append(Status(check: .sound, ok: false, title: "صوت الأذان", detail: "أصوات إشعارات سكينة مطفأة في إعدادات النظام"))
    } else {
      let label: String = prefs.sound == "none" ? "صامت: يصلك الإشعار بلا صوت" : prefs.usesAdhanSound ? "أذانٌ مضمَّن في التطبيق، يعمل بلا شبكة" : "نغمة النظام"
      out.append(Status(check: .sound, ok: true, title: "صوت الأذان", detail: label))
    }
    // iOS يحتفظ بـ٦٤ إشعاراً على الأكثر: الجدول يمتدّ أياماً ويتجدّد كلّما فُتح التطبيق
    if prefs.enabled, n.authorization != .denied {
      if let until = n.scheduledUntil {
        let days = Int(until.timeIntervalSinceNow / 86_400)
        let s = model.settings
        let when = Fmt.shortDate(until, tz: model.timeZone, numerals: s.numerals)
        out.append(days >= 2
          ? Status(check: .horizon, ok: true, title: "مدى الجدول", detail: "مجدولٌ حتى \(when)، ويمتدّ كلّما فتحت سكينة")
          : Status(check: .horizon, ok: false, title: "مدى الجدول", detail: "ينتهي في \(when)", advice: "افتح سكينة مرّةً كلّ بضعة أيام ليمتدّ الجدول؛ iOS لا يحتفظ إلا بعددٍ محدود من الإشعارات.", opensSettings: false))
      }
    }
    return out
  }

  static func upcoming(_ model: AppModel, count: Int = 4) -> [Upcoming] {
    guard let coords = model.coordinates else { return [] }
    let tz = model.timeZone, s = model.settings
    return Reminders.upcoming(coords: coords, tz: tz, params: s.params(tz: tz), prefs: s.reminders, max: 24,
                              format: { Fmt.time($0, tz: tz, hour12: s.hour12, numerals: s.numerals) })
      .filter { $0.kind == .adhan && $0.prayer != nil }.prefix(count)
      .map { Upcoming(prayer: $0.prayer!, time: $0.time, scheduled: model.notifications.pendingIDs.contains($0.id)) }
  }

  static func dayLabel(_ d: Date, tz: TimeZone) -> String {
    var cal = Calendar(identifier: .gregorian); cal.timeZone = tz
    if cal.isDateInToday(d) { return "اليوم" }
    if cal.isDateInTomorrow(d) { return "غداً" }
    return Hijri.weekdaysAr[(cal.component(.weekday, from: d) - 1) % 7]
  }

  /// اختبارٌ بالطريق نفسه: إشعار أذانٍ حسّاس للوقت بعد ١٠ ثوانٍ وبالصوت المختار
  static func test(sound: String) {
    let c = UNMutableNotificationContent()
    c.title = "اختبار الأذان"; c.body = "إن وصلك هذا في وقته فأذانك مضمون بإذن الله"
    c.userInfo = ["kind": "test"]; c.interruptionLevel = .timeSensitive
    c.sound = sound.hasPrefix("adhan") ? UNNotificationSound(named: UNNotificationSoundName("adhan_short.wav")) : (sound == "none" ? nil : .default)
    UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "adhan-guard-test", content: c, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 10, repeats: false)))
  }

  /// «ذكّرني لاحقاً»: يُخفي البند من الرئيسية ثلاثة أيام (ويبقى ظاهراً في شاشة الفحص)
  static func snooze(_ c: Check) { UserDefaults.standard.set(Date().addingTimeInterval(3 * 86_400), forKey: "adhanGuard.snooze.\(c.rawValue)") }
  static func snoozed(_ c: Check) -> Bool { ((UserDefaults.standard.object(forKey: "adhanGuard.snooze.\(c.rawValue)") as? Date) ?? .distantPast) > Date() }
  static func issues(_ model: AppModel, includeSnoozed: Bool = false) -> [Status] { checks(model).filter { !$0.ok && (includeSnoozed || !snoozed($0.check)) } }

  /// سطر الرئيسية الدائم: هل منبّه الأذان القادم قائمٌ عند النظام؟ (يُحسب من معرّف الطلب مباشرةً — رخيصٌ كل ثانية)
  static func homeLine(_ model: AppModel, _ t: PrayerTimes.DayTimeline) -> (ok: Bool, text: String, icon: String)? {
    if ScreenshotMode.active { return nil }
    let prefs = model.settings.reminders
    guard prefs.enabled, model.notifications.authorization != .denied else { return (false, "الأذان غير مفعّل", "bell.slash") }
    let key = t.next.key
    guard key != .sunrise, prefs.prayers.contains(key) else { return nil }
    let d = CivilDate(t.next.time, in: model.timeZone)
    let scheduled = model.notifications.pendingIDs.contains("\(d.year)-\(d.month)-\(d.day):\(key.rawValue)")
    if !scheduled { return (false, "غير مجدول — افحص", "exclamationmark.circle") }
    return issues(model).isEmpty ? (true, "مجدولٌ على جهازك", "checkmark") : (false, "مجدول، وقد يتأخر — افحص", "exclamationmark.circle")
  }

  static func openSettings() {
    if let u = URL(string: UIApplication.openNotificationSettingsURLString) { UIApplication.shared.open(u) }
  }
}

struct AdhanGuardView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  @Environment(\.scenePhase) private var phase
  @State private var expanded: AdhanGuard.Check?
  @State private var touched = false
  @State private var testSent = false
  @State private var showMethods = false

  var body: some View {
    let checks = AdhanGuard.checks(model)
    let failing = checks.filter { !$0.ok }
    let upcoming = AdhanGuard.upcoming(model)
    ScrollView {
      VStack(spacing: DS.Space.s3) {
        banner(failing.count)

        label("الفحص")
        VStack(spacing: 0) {
          ForEach(Array(checks.enumerated()), id: \.element.id) { i, s in
            if i > 0 { SettingsDivider() }
            let open = !s.ok && (touched ? expanded == s.check : s.check == failing.first?.check)
            checkRow(s, open: open)
          }
        }.dsCard(padding: 0, radius: DS.Radius.lg)

        if model.settings.reminders.enabled, !upcoming.isEmpty {
          label("الأذان القادم — مجدولٌ على جهازك")
          VStack(spacing: 0) {
            ForEach(Array(upcoming.enumerated()), id: \.element.id) { i, u in
              if i > 0 { SettingsDivider() }
              HStack(spacing: DS.Space.s2) {
                Text(u.prayer.nameAr).font(DS.readex(14, .semibold)).foregroundStyle(DS.C.textPrimary).frame(width: 64, alignment: .leading)
                Text(Fmt.time(u.time, tz: model.timeZone, hour12: model.settings.hour12, numerals: model.settings.numerals)).font(DS.F.labelMd).foregroundStyle(DS.C.textPrimary).monospacedDigit()
                Text(AdhanGuard.dayLabel(u.time, tz: model.timeZone)).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary)
                Spacer(minLength: 4)
                if u.scheduled {
                  Label("مجدول", systemImage: "checkmark").font(DS.F.labelXs).foregroundStyle(DS.C.success).labelStyle(.titleAndIcon)
                } else {
                  Text("غير مجدول").font(DS.readex(11, .semibold)).foregroundStyle(DS.C.danger)
                }
              }
              .padding(.horizontal, DS.Space.s4).padding(.vertical, DS.Space.s3)
              .accessibilityElement(children: .combine)
            }
          }.dsCard(padding: 0, radius: DS.Radius.lg)
          Text(upcoming.allSatisfy(\.scheduled) ? "يُعاد الجدول كلّما فتحت سكينة، وعند تغيّر الموقع أو المنطقة الزمنية." : "أُعيدت الجدولة الآن؛ إن بقي «غير مجدول» فأعد فتح سكينة أو راجع الإذن أعلاه.")
            .font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, DS.Space.s1)
        }

        label("ما يصلك من إشعارات")
        VStack(spacing: 0) {
          let only = !model.content.extraReminders.any
          radio("الأذان وحده", "موصى به: لا شيء يزاحم نداء الصلاة", on: only) { setAdhanOnly(true) }
          SettingsDivider()
          radio("الأذان وتذكيرات الأذكار", "أذكار الصباح والمساء في أوقاتها، ويُضبط كلٌّ منها من الإعدادات", on: !only) { setAdhanOnly(false) }
        }.dsCard(padding: 0, radius: DS.Radius.lg)

        label("المواقيت")
        Button { showMethods = true } label: {
          let m = Methods.method(model.settings.methodId), num = model.settings.numerals
          let isha = m.ishaInterval > 0 ? "\(Fmt.number(Int(m.ishaInterval), numerals: num)) دقيقة بعد المغرب" : "\(Fmt.decimal(m.ishaAngle, digits: 1, numerals: num))°"
          SettingsRow(title: "طريقة الحساب", subtitle: "\(m.nameAr)، الفجر \(Fmt.decimal(m.fajrAngle, digits: 1, numerals: num))° والعشاء \(isha)", value: nil)
        }.buttonStyle(.plain).dsCard(padding: DS.Space.s1, radius: DS.Radius.lg)

        DSButton(title: testSent ? "أُرسل الاختبار: انتظر ١٠ ثوانٍ" : "اختبر الأذان: يصلك بعد ١٠ ثوانٍ", kind: .soft, icon: "bell.badge") {
          AdhanGuard.test(sound: model.settings.reminders.sound); testSent = true
          Task { try? await Task.sleep(for: .seconds(12)); testSent = false }
        }
        .disabled(testSent).padding(.top, DS.Space.s2)
        Text("الفحص يجري على جهازك وحده، ولا يُرسَل شيءٌ منه إلى أيّ مكان.")
          .font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).multilineTextAlignment(.center).frame(maxWidth: .infinity)
      }
      .padding(.horizontal, DS.Space.s4).padding(.top, DS.Space.s2).padding(.bottom, DS.Space.s8)
    }
    .background(DS.C.bgCanvas)
    .safeAreaInset(edge: .top, spacing: 0) {
      HStack {
        Spacer()
        Text("ضمان الأذان").font(DS.F.headingLg).foregroundStyle(DS.C.textPrimary)
        Spacer()
        DSIconButton(systemName: "chevron.forward", label: "رجوع") { dismiss() }
      }
      .padding(.horizontal, DS.Space.s4).padding(.vertical, DS.Space.s3).background(DS.C.bgCanvas)
    }
    .navigationBarHidden(true)
    .onAppear { model.rescheduleNotifications() }
    .onChange(of: phase) { if phase == .active { model.notifications.refreshStatus() } }
    .sheet(isPresented: $showMethods, onDismiss: { model.rescheduleNotifications() }) { MethodPicker().environment(model).environment(\.tabBarInset, 0) }
  }

  private func setAdhanOnly(_ only: Bool) {
    var x = model.content.extraReminders
    if only { x.adhkarMorning = false; x.adhkarEvening = false; x.hadithDaily = false } else { x.adhkarMorning = true; x.adhkarEvening = true }
    model.content.extraReminders = x; model.rescheduleNotifications()
  }

  private func label(_ t: String) -> some View {
    Text(t).font(DS.F.labelSm).foregroundStyle(DS.C.textTertiary).frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, DS.Space.s1).padding(.top, DS.Space.s2)
  }

  private func banner(_ failing: Int) -> some View {
    let ok = failing == 0
    let num = model.settings.numerals
    let title = switch failing { case 0: "الأذان مضمونٌ على هذا الجهاز"; case 1: "بقيت خطوةٌ واحدة ليصلك الأذان في وقته"; case 2: "بقيت خطوتان ليصلك الأذان في وقته"; default: "بقيت \(Fmt.number(failing, numerals: num)) خطوات ليصلك الأذان في وقته" }
    return HStack(alignment: .top, spacing: DS.Space.s3) {
      Image(systemName: ok ? "checkmark.shield" : "bell.badge").font(.system(size: 18, weight: .medium))
        .foregroundStyle(ok ? DS.C.brandPrimary : DS.C.accentGoldStrong)
        .frame(width: 40, height: 40).background(DS.C.bgSurface, in: Circle())
      VStack(alignment: .leading, spacing: 4) {
        Text(title).font(DS.readex(15, .bold)).foregroundStyle(DS.C.textPrimary)
        Text(ok ? "الإذن والصوت والتركيز سليمة، والأذانات القادمة مجدولة عند النظام." : "إعداداتٌ في جهازك قد تحجب الأذان أو تؤخّره حين يكون التطبيق مغلقاً. كلٌّ منها مشروحٌ أدناه.")
          .font(DS.readex(12.5)).foregroundStyle(DS.C.textSecondary).fixedSize(horizontal: false, vertical: true)
      }
      Spacer(minLength: 0)
    }
    .padding(DS.Space.s4)
    .background(ok ? DS.C.brandSoft : DS.C.accentGoldSoft, in: RoundedRectangle(cornerRadius: DS.Radius.lg, style: .continuous))
    .accessibilityElement(children: .combine)
  }

  private func checkRow(_ s: AdhanGuard.Status, open: Bool) -> some View {
    VStack(alignment: .leading, spacing: DS.Space.s3) {
      Button {
        guard !s.ok else { return }
        touched = true; expanded = open ? nil : s.check
      } label: {
        HStack(spacing: DS.Space.s3) {
          Image(systemName: s.ok ? "checkmark" : "bell.badge").font(.system(size: 13, weight: .semibold))
            .foregroundStyle(s.ok ? DS.C.brandPrimary : DS.C.accentGoldStrong)
            .frame(width: 28, height: 28)
            .background(s.ok ? DS.C.brandSoft : DS.C.bgSurface, in: Circle())
            .overlay { if !s.ok { Circle().stroke(DS.C.accentGold, lineWidth: 1) } }
          VStack(alignment: .leading, spacing: 2) {
            Text(s.title).font(DS.readex(14, .semibold)).foregroundStyle(DS.C.textPrimary)
            Text(s.detail).font(DS.F.labelXs).foregroundStyle(s.ok ? DS.C.textSecondary : DS.C.warning)
          }
          Spacer(minLength: 0)
        }
        .contentShape(Rectangle())
      }
      .buttonStyle(.plain)
      .accessibilityValue(s.ok ? "سليم" : "يحتاج إصلاحاً")
      if open {
        if let a = s.advice { Text(a).font(DS.readex(12.5)).foregroundStyle(DS.C.textSecondary).fixedSize(horizontal: false, vertical: true) }
        HStack(spacing: DS.Space.s2) {
          DSButton(title: s.opensSettings ? "افتح الإعداد" : (s.check == .notifications ? "فعّل الإشعارات" : "حسناً")) { fix(s) }
          DSButton(title: "ذكّرني لاحقاً", kind: .outline) { AdhanGuard.snooze(s.check); touched = true; expanded = nil }
        }
      }
    }
    .padding(.horizontal, DS.Space.s4).padding(.vertical, DS.Space.s3)
    .background(s.ok ? Color.clear : DS.C.accentGoldSoft.opacity(open ? 1 : 0.55))
  }

  private func fix(_ s: AdhanGuard.Status) {
    if s.opensSettings { AdhanGuard.openSettings(); return }
    if s.check == .notifications {
      Task {
        let ok = await model.notifications.requestAuthorization()
        await MainActor.run { var r = model.settings.reminders; r.enabled = ok; model.settings.reminders = r; model.rescheduleNotifications() }
      }
    } else { model.rescheduleNotifications(); touched = true; expanded = nil }
  }

  private func radio(_ title: String, _ subtitle: String, on: Bool, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      HStack(spacing: DS.Space.s3) {
        Circle().stroke(on ? DS.C.brandPrimary : DS.C.borderStrong, lineWidth: 2).frame(width: 22, height: 22)
          .overlay { if on { Circle().fill(DS.C.brandPrimary).frame(width: 11, height: 11) } }
        VStack(alignment: .leading, spacing: 2) {
          Text(title).font(DS.readex(14, .semibold)).foregroundStyle(DS.C.textPrimary)
          Text(subtitle).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).fixedSize(horizontal: false, vertical: true)
        }
        Spacer(minLength: 0)
      }
      .padding(.horizontal, DS.Space.s4).padding(.vertical, DS.Space.s3).contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityAddTraits(on ? [.isSelected] : [])
  }
}
