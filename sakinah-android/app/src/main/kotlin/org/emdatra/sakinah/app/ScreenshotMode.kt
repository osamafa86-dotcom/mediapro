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
  /** لقطات التحقّق من نظام السماء: فرض طور (`--es sakinahSky dhuhr`) وطقس (`--es sakinahWeather rain`) — لا أثر لهما في التشغيل العادي */
  var skyPhase: org.emdatra.sakinah.core.SkyPhase? = null; private set
  var skyWeather: org.emdatra.sakinah.core.SkyWeather? = null; private set
  val tab: AppTab? get() = when (route) {
    "prayer", "qibla", "home" -> AppTab.Home
    "mushaf", "mushaf-page", "mushaf-bar" -> AppTab.Mushaf
    "adhkar", "hisn", "tasbih" -> AppTab.Adhkar
    "hadith", "more", "sky-settings" -> AppTab.More
    else -> null
  }
  /** صفحة المصحف التي يُفتح عليها القارئ مباشرةً (سورة الشعراء — صفحة كثيفة الرسم) */
  val readerPage: Int? get() = if (route == "mushaf-page" || route == "mushaf-bar") 270 else null
  /** يُبقي الشريط الموحّد ظاهراً بدل انزلاقه بعد ثوانٍ */
  val keepChrome: Boolean get() = route == "mushaf-bar"
  /** مسار «qibla» يفتح القبلة الكاملة فوق الرئيسية */
  val fullQibla: Boolean get() = route == "qibla"

  /** تهيئة حالةٍ ثابتة: بلا مقدّمة، أرقام عربية، مدينة عمّان — فالمحاكي بلا موقع */
  fun arm(r: String?, sky: String? = null, weather: String? = null) {
    route = r?.takeIf { it.isNotEmpty() }
    if (!active) return
    skyPhase = sky?.let { id -> org.emdatra.sakinah.core.SkyPhase.entries.firstOrNull { it.id == id } }
    skyWeather = org.emdatra.sakinah.core.SkyWeather.of(weather)
    Store.seenIntro = true; Store.numerals = "arab"; Store.seenChromeHint = true
    CityDatabase.bundled.city("jo-amman")?.let { Store.useCity(it) }
    Store.save()
  }
}
