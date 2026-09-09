import Foundation
import Observation
import SakinahCore

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

  init() {
    methodId = d.string(forKey: "prayer.method") ?? "MuslimWorldLeague"
    madhab = Madhab(rawValue: d.string(forKey: "prayer.madhab") ?? "") ?? .shafi
    highLatitudeRule = HighLatitudeRule(rawValue: d.string(forKey: "prayer.highLat") ?? "") ?? .auto
    hour12 = d.object(forKey: "ui.hour12") as? Bool ?? true
    numerals = d.string(forKey: "ui.numerals") ?? "latn"
    hijriOffset = d.integer(forKey: "hijri.offset")
    methodIsAutomatic = d.object(forKey: "prayer.methodAuto") as? Bool ?? true
  }

  var params: PrayerParams {
    var p = PrayerParams()
    p.method = methodId; p.madhab = madhab; p.highLatitudeRule = highLatitudeRule
    p.isRamadan = Hijri.isRamadan(tz: .current, offsetDays: hijriOffset)
    return p
  }
}

/// نموذج التطبيق: الإعدادات + الموقع + حساب اليوم
@Observable
final class AppModel {
  let settings = Settings()
  let location = LocationService()

  var coordinates: Coordinates? {
    guard let c = location.coordinate else { return nil }
    return Coordinates(latitude: c.latitude, longitude: c.longitude)
  }

  /// جدول اليوم للحظة معيّنة (يُعاد حسابه كل ثانية من TimelineView؛ الحساب خفيف)
  func timeline(now: Date) -> PrayerTimes.DayTimeline? {
    guard let coords = coordinates else { return nil }
    return PrayerTimes.dayTimeline(coords: coords, tz: .current, params: settings.params, now: now)
  }

  func hijri(now: Date) -> HijriDate { Hijri.date(now, tz: .current, offsetDays: settings.hijriOffset) }

  /// عند وصول الدولة من الموقع: الطريقة الافتراضية لها ما دام المستخدم لم يختر يدويًا
  func applyAutomaticMethodIfNeeded() {
    guard settings.methodIsAutomatic else { return }
    let m = Methods.defaultMethod(countryCode: location.countryCode, tz: TimeZone.current.identifier)
    if m != settings.methodId { settings.methodId = m }
  }
}
