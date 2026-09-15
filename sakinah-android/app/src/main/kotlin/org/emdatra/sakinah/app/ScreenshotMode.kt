package org.emdatra.sakinah.app

import org.emdatra.sakinah.app.ui.AppTab
import org.emdatra.sakinah.core.CityDatabase

/**
 * وضع لقطات المتجر (Google Play) — يُفعَّل بمعطى الإطلاق فقط، ولا أثر له في الاستعمال العادي:
 *   adb shell am start -n org.emdatra.sakinah/.app.MainActivity --es sakinahShot mushaf-bar
 * المسارات نفسها التي في نسخة iOS كي تتطابق اللقطات بين المتجرين.
 */
object ScreenshotMode {
  var route: String? = null; private set
  val active: Boolean get() = route != null
  val tab: AppTab? get() = when (route) {
    "prayer" -> AppTab.Prayer; "qibla" -> AppTab.Qibla
    "mushaf", "mushaf-page", "mushaf-bar" -> AppTab.Mushaf
    "adhkar", "hisn", "tasbih" -> AppTab.Adhkar
    "hadith", "more" -> AppTab.More
    else -> null
  }
  /** صفحة المصحف التي يُفتح عليها القارئ مباشرةً (سورة الشعراء — صفحة كثيفة الرسم) */
  val readerPage: Int? get() = if (route == "mushaf-page" || route == "mushaf-bar") 270 else null
  /** يُبقي الشريط الموحّد ظاهراً بدل انزلاقه بعد ثوانٍ */
  val keepChrome: Boolean get() = route == "mushaf-bar"

  /** تهيئة حالةٍ ثابتة: بلا مقدّمة، أرقام عربية، مدينة عمّان — فالمحاكي بلا موقع */
  fun arm(r: String?) {
    route = r?.takeIf { it.isNotEmpty() }
    if (!active) return
    Store.seenIntro = true; Store.numerals = "arab"; Store.seenChromeHint = true
    CityDatabase.bundled.city("jo-amman")?.let { Store.useCity(it) }
    Store.save()
  }
}
