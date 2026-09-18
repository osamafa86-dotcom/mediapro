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
    "mushaf", "mushaf-page", "mushaf-bar", "mushaf-ayah", "mushaf-nav", "mushaf-khatmah", "mushaf-display", "mushaf-hifz" -> AppTab.Mushaf
    "adhkar", "hisn", "tasbih" -> AppTab.Adhkar
    "hadith", "more", "sky-settings" -> AppTab.More
    else -> null
  }
  /** صفحة المصحف التي يُفتح عليها القارئ مباشرةً (سورة الشعراء — صفحة كثيفة الرسم) */
  val readerPage: Int? get() = if (route in setOf("mushaf-page", "mushaf-bar", "mushaf-ayah", "mushaf-nav", "mushaf-display", "mushaf-hifz")) 270 else null
  /** يُبقي الشريط الموحّد ظاهراً بدل انزلاقه بعد ثوانٍ */
  val keepChrome: Boolean get() = route == "mushaf-bar" || route == "mushaf-ayah"
  /** لقطات المصحف v2: آية محدّدة مع رصيفها، ورقة مفتوحة في القارئ، جلسة إخفاء للحفظ، وورقة الختمة في المكتبة */
  val readerSelectsAyah: Boolean get() = route == "mushaf-ayah"
  val readerSheet: String? get() = when (route) { "mushaf-nav" -> "nav"; "mushaf-display" -> "display"; else -> null }
  val readerHifz: Boolean get() = route == "mushaf-hifz"
  val librarySheet: String? get() = if (route == "mushaf-khatmah") "khatmah" else null
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
    // ورقة الختمة تحتاج خطةً وسجلّ ورد كي تُظهر حالةً حقيقية: خطة ٣٠ يومًا بدأت قبل خمسة أيام وورد ٢١ صفحة في أربعة منها
    if (route == "mushaf-khatmah" || route == "mushaf") {
      val today = Store.todayKey
      Store.khatmah = org.emdatra.sakinah.core.KhatmahPlan.make(1, org.emdatra.sakinah.core.DayKey.adding(today, -5), 30, "after:isha")
      var log: org.emdatra.sakinah.core.WirdLog = emptyMap()
      for ((i, d) in listOf(-5, -4, -3, -1, 0).withIndex()) for (p in (i * 21 + 1)..((i + 1) * 21)) log = org.emdatra.sakinah.core.Wird.mark(log, org.emdatra.sakinah.core.DayKey.adding(today, d), p, 1)
      Store.wird = log
      Store.lastRead = LastRead(106, 5, 1, System.currentTimeMillis().toDouble())
    }
    Store.save()
  }
}
