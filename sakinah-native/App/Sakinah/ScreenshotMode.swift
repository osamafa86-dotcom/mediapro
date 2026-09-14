import Foundation
import SakinahCore

/// وضع لقطات المتجر: يُشغَّل بوسيط إقلاع وحده، فلا أثر له في نسخة المستخدم.
///
/// لقطات App Store **يجب أن تكون من التطبيق نفسه** (‏Guideline 2.3.3)، ولا تكفي
/// صورٌ من نسخة الويب لأن واجهتها ليست هذه الواجهة. وقيادة الواجهة باختبار
/// XCUITest تعني كتابة مُحدِّدات لنصوصٍ عربية تتغيّر — فالأضبط أن يفتح التطبيق
/// نفسه الشاشةَ المطلوبة مباشرةً، والوسيط هو الطريق المعتاد لذلك في iOS.
///
/// يُقرأ الوسيط بصيغة `-sakinahShot <route>` لأن UserDefaults تلتقط أزواج
/// `-مفتاح قيمة` من وسائط الإقلاع تلقائياً.
enum ScreenshotMode {
  /// المسار المطلوب، أو nil في التشغيل العادي
  static let route: String? = {
    guard let r = UserDefaults.standard.string(forKey: "sakinahShot"), !r.isEmpty else { return nil }
    return r
  }()
  static var active: Bool { route != nil }

  /// التبويب الذي يُفتح عليه التطبيق
  static var tab: AppTab? {
    switch route {
    case "prayer": return .prayer
    case "qibla": return .qibla
    case "mushaf", "mushaf-page": return .mushaf
    case "adhkar", "hisn", "tasbih": return .adhkar
    case "hadith", "more": return .more
    default: return nil
    }
  }

  /// الصفحة التي يُفتح عليها قارئ المصحف، إن كان المسار يطلب القارئ
  static var readerPage: Int? { route == "mushaf-page" ? 270 : nil }

  /// موقع ثابت كي تُحسب المواقيت والقبلة بلا إذنٍ ولا شبكة — واللقطات تتكرّر بالنتيجة نفسها
  static func seed(_ model: AppModel) {
    guard active else { return }
    model.settings.seenIntro = true
    if let c = CityDatabase.bundled.city(id: "jo-amman") { model.location.useCity(c) }
  }
}
