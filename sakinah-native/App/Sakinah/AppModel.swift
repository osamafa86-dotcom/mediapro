import Foundation
import Observation
import SakinahCore

/// آخر موضع قراءة: الصفحة وأول آية فيها ووقت الحفظ (ملّي ثانية منذ 1970 كما في الويب)
struct LastRead: Codable, Equatable { var page: Int; var surah: Int; var ayah: Int; var at: Double }

/// إعدادات المستخدم (تُحفظ في UserDefaults) — مفاتيح مطابقة لمعاني نسخة الويب كي يسهل استيراد النسخة الاحتياطية لاحقًا
@Observable
final class Settings {
  private let d = UserDefaults.standard
  var methodId: String { didSet { d.set(methodId, forKey: "prayer.method") } }
  var madhab: Madhab { didSet { d.set(madhab.rawValue, forKey: "prayer.madhab") } }
  var highLatitudeRule: HighLatitudeRule { didSet { d.set(highLatitudeRule.rawValue, forKey: "prayer.highLat") } }
  var hour12: Bool { didSet { d.set(hour12, forKey: "ui.hour12") } }
  var numerals: String { didSet { d.set(numerals, forKey: "ui.numerals") } }
  var hijriOffset: Int { didSet { d.set(hijriOffset, forKey: "hijri.offset") } }
  var methodIsAutomatic: Bool { didSet { d.set(methodIsAutomatic, forKey: "prayer.methodAuto") } }
  var reminders: ReminderPrefs { didSet { if let data = try? JSONEncoder().encode(reminders) { d.set(data, forKey: "notifications.prefs") } } }
  /// تشغيل الأذان الكامل داخل التطبيق عند دخول الوقت والتطبيق مفتوح
  var fullAdhanInApp: Bool { didSet { d.set(fullAdhanInApp, forKey: "notifications.fullAdhan") } }
  /// آخر موضع قراءة في المصحف (المفتاح نفسه في الويب: quran.lastRead)
  var seenIntro: Bool { didSet { d.set(seenIntro, forKey: "seenIntro") } }
  /// نشاط مباشر للصلاة القادمة على شاشة القفل (يُحدَّث عند فتح التطبيق)
  var liveActivity: Bool { didSet { d.set(liveActivity, forKey: "liveActivity") } }
  /// اهتزاز عند العدّ في المسبحة والأذكار
  var haptics: Bool { didSet { d.set(haptics, forKey: "ui.haptics") } }
  /// نقرة مسموعة عند العدّ في المسبحة
  var tasbihSound: Bool { didSet { d.set(tasbihSound, forKey: "ui.tasbihSound") } }
  var lastRead: LastRead? { didSet { if let v = lastRead, let data = try? JSONEncoder().encode(v) { d.set(data, forKey: "quran.lastRead") } else { d.removeObject(forKey: "quran.lastRead") } } }

  init() {
    methodId = d.string(forKey: "prayer.method") ?? "MuslimWorldLeague"
    madhab = Madhab(rawValue: d.string(forKey: "prayer.madhab") ?? "") ?? .shafi
    highLatitudeRule = HighLatitudeRule(rawValue: d.string(forKey: "prayer.highLat") ?? "") ?? .auto
    hour12 = d.object(forKey: "ui.hour12") as? Bool ?? true
    numerals = d.string(forKey: "ui.numerals") ?? "latn"
    hijriOffset = d.integer(forKey: "hijri.offset")
    methodIsAutomatic = d.object(forKey: "prayer.methodAuto") as? Bool ?? true
    reminders = (d.data(forKey: "notifications.prefs")).flatMap { try? JSONDecoder().decode(ReminderPrefs.self, from: $0) } ?? ReminderPrefs()
    fullAdhanInApp = d.object(forKey: "notifications.fullAdhan") as? Bool ?? true
    seenIntro = d.bool(forKey: "seenIntro")
    liveActivity = d.bool(forKey: "liveActivity")
    haptics = d.object(forKey: "ui.haptics") as? Bool ?? true
    tasbihSound = d.bool(forKey: "ui.tasbihSound")
    lastRead = d.data(forKey: "quran.lastRead").flatMap { try? JSONDecoder().decode(LastRead.self, from: $0) }
  }

  func params(tz: TimeZone) -> PrayerParams {
    var p = PrayerParams()
    p.method = methodId; p.madhab = madhab; p.highLatitudeRule = highLatitudeRule
    p.isRamadan = Hijri.isRamadan(tz: tz, offsetDays: hijriOffset)
    p.tz = tz.identifier
    return p
  }
  var params: PrayerParams { params(tz: .current) }
}

/// نموذج التطبيق: الإعدادات + الموقع + الإشعارات + حساب اليوم (مع ذاكرة مؤقتة لأن الشاشة تُحدَّث كل ثانية)
@Observable
final class AppModel {
  let settings = Settings()
  let location = LocationService()
  let notifications = NotificationService()
  let adhan = AdhanPlayer()
  let quran = QuranPrefs()
  let content = ContentPrefs()
  let player = RecitationPlayer()
  let downloads = AudioDownloads()

  @ObservationIgnored private var cacheKey = ""
  @ObservationIgnored private var cacheDay: PrayerTimes.DayTimeline?

  init() {
    player.downloads = downloads
    notifications.onForegroundAdhan = { [weak self] _ in
      guard let self, self.settings.fullAdhanInApp, self.settings.reminders.usesAdhanSound else { return }
      self.adhan.play(sound: self.settings.reminders.sound)
    }
  }

  var coordinates: Coordinates? {
    guard let c = location.coordinate else { return nil }
    return Coordinates(latitude: c.latitude, longitude: c.longitude)
  }
  var timeZone: TimeZone { location.timeZone }

  /// جدول اليوم للحظة معيّنة؛ يُعاد استخدام آخر حساب ما دامت الصلاة الحالية والقادمة لم تتغيرا
  func timeline(now: Date) -> PrayerTimes.DayTimeline? {
    guard let coords = coordinates else { return nil }
    let tz = timeZone
    let key = "\(coords.latitude),\(coords.longitude)|\(tz.identifier)|\(settings.methodId)|\(settings.madhab.rawValue)|\(settings.highLatitudeRule.rawValue)|\(settings.hijriOffset)|\(CivilDate(now, in: tz))"
    if key == cacheKey, let c = cacheDay, now < c.next.time, c.times[c.current].map({ now >= $0 }) ?? true { return c }
    let t = PrayerTimes.dayTimeline(coords: coords, tz: tz, params: settings.params(tz: tz), now: now)
    cacheKey = key; cacheDay = t
    return t
  }

  func hijri(now: Date) -> HijriDate { Hijri.date(now, tz: timeZone, offsetDays: settings.hijriOffset) }

  /// عند وصول الدولة من الموقع: الطريقة الافتراضية لها ما دام المستخدم لم يختر يدويًا
  func applyAutomaticMethodIfNeeded() {
    guard settings.methodIsAutomatic else { return }
    let m = Methods.defaultMethod(countryCode: location.countryCode, tz: timeZone.identifier)
    if m != settings.methodId { settings.methodId = m }
  }

  /// مفتاح اليوم المدني «YYYY-MM-DD» بتوقيت الموقع
  var todayKey: String { DayKey.key(Date(), tz: timeZone) }

  /// إعادة جدولة إشعارات النظام من النواة: الصلوات (أقرب المواعيد) + الأذكار (7 أيام) + اليومية المتكررة (حديث اليوم، ورد الختمة) ضمن حدّ 64 إشعارًا
  func rescheduleNotifications() {
    let prefs = settings.reminders; let extras = content.extraReminders; let tz = timeZone; let s = settings
    let number = { Fmt.number($0, numerals: s.numerals) }
    let daily = Reminders.daily(prefs: extras, khatmah: quran.khatmah, number: number)
    guard let coords = coordinates else { notifications.sync(reminders: [], daily: daily, prefs: prefs, tz: timeZone); return }
    let adhkar = Reminders.adhkar(coords: coords, tz: tz, params: s.params(tz: tz), prefs: extras, days: 7)
    let budget = max(20, 60 - daily.count - adhkar.count)
    let items = Reminders.upcoming(coords: coords, tz: tz, params: s.params(tz: tz), prefs: prefs, max: budget,
                                   format: { Fmt.time($0, tz: tz, hour12: s.hour12, numerals: s.numerals) }, number: number)
    notifications.sync(reminders: items + adhkar, daily: daily, prefs: prefs, tz: tz)
  }
}
