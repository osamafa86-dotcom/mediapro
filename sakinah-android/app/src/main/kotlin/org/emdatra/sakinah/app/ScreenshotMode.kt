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
  /** المرحلة الثانية: «المزيد» صار «المكتبة»، والإعدادات (ومنها «مظهر السماء» و«ضمان الأذان») والبحث تُفتح من رأس «اليوم» */
  val tab: AppTab? get() = when (route) {
    "prayer", "qibla", "qibla-sun", "qibla-map", "home", "today", "search", "settings", "sky-settings", "adhan-guard", "ramadan" -> AppTab.Home
    "mushaf", "mushaf-juz", "mushaf-page", "mushaf-spread", "mushaf-bar", "mushaf-ayah", "mushaf-nav", "mushaf-khatmah", "mushaf-display", "mushaf-hifz", "review-ayahs" -> AppTab.Mushaf
    "adhkar", "hisn", "tasbih" -> AppTab.Adhkar
    "hadith", "more", "library", "library-qibla" -> AppTab.Library
    else -> null
  }
  /** ما يُفتح فوق «اليوم» مباشرةً في وضع اللقطات: البحث (باستعلام التصميم)، الإعدادات، مظهر السماء، ضمان الأذان */
  val todayRoute: String? get() = when (route) { "search" -> "search"; "settings" -> "settings"; "sky-settings" -> "settings:sky"; "adhan-guard" -> "guard"; else -> null }
  val searchQuery: String get() = if (route == "search") "الصبر" else ""
  /** صفحة المصحف التي يُفتح عليها القارئ مباشرةً (سورة الشعراء — صفحة كثيفة الرسم) */
  val readerPage: Int? get() = if (route == "mushaf-spread") 1 else if (route in setOf("mushaf-page", "mushaf-bar", "mushaf-ayah", "mushaf-nav", "mushaf-display", "mushaf-hifz")) 270 else null
  /** يُبقي الشريط الموحّد ظاهراً بدل انزلاقه بعد ثوانٍ */
  val keepChrome: Boolean get() = route == "mushaf-bar" || route == "mushaf-ayah"
  /** لقطات المصحف v2: آية محدّدة مع رصيفها، ورقة مفتوحة في القارئ، جلسة إخفاء للحفظ، وورقة الختمة في المكتبة */
  val readerSelectsAyah: Boolean get() = route == "mushaf-ayah"
  val readerSheet: String? get() = when (route) { "mushaf-nav" -> "nav"; "mushaf-display" -> "display"; else -> null }
  val readerHifz: Boolean get() = route == "mushaf-hifz"
  val librarySheet: String? get() = if (route == "mushaf-khatmah") "khatmah" else null
  /** تبويب الفهرس الذي تُفتح عليه المكتبة (الأجزاء في لقطة التحقّق من تبديل التبويبات) */
  val libraryTab: Int get() = if (route == "mushaf-juz") 1 else 0
  /** مسارات «qibla» و«qibla-sun» و«qibla-map» تفتح القبلة الكاملة فوق الرئيسية على تبويبها (المرحلة الخامسة) */
  val fullQibla: Boolean get() = route == "qibla" || route == "qibla-sun" || route == "qibla-map"
  val qiblaTab: Int get() = when (route) { "qibla-sun" -> 1; "qibla-map" -> 2; else -> 0 }

  /** تهيئة حالةٍ ثابتة: بلا مقدّمة، أرقام عربية، مدينة عمّان — فالمحاكي بلا موقع */
  fun arm(r: String?, sky: String? = null, weather: String? = null) {
    route = r?.takeIf { it.isNotEmpty() }
    if (!active) return
    skyPhase = sky?.let { id -> org.emdatra.sakinah.core.SkyPhase.entries.firstOrNull { it.id == id } }
    skyWeather = org.emdatra.sakinah.core.SkyWeather.of(weather)
    Store.seenIntro = true; Store.numerals = "arab"; Store.seenChromeHint = true
    CityDatabase.bundled.city("jo-amman")?.let { Store.useCity(it) }
    // المرحلة الخامسة (البيانات نفسها في لقطات iOS): «tasbih»/«adhkar» — سجلّ أسبوعٍ للمسبحة (٢٤٠ اليوم من ١٢٬٤٠٠)،
    // وحضورٌ في أيام الأسبوع عدا أمس، ومفضّلة؛ «review-ayahs» — أربع آيات موسومة ضعيفة
    if (route == "tasbih" || route == "adhkar") {
      val today = Store.todayKey; val dk = org.emdatra.sakinah.core.DayKey
      Store.tasbih = org.emdatra.sakinah.core.TasbihState(phrase = "subhan", target = 33, count = 23, rounds = 1,
        totals = mapOf("subhan" to org.emdatra.sakinah.core.TasbihTotals(12_400, 240, today)))
      Store.putTasbihDaily(listOf(-6 to 180, -5 to 330, -4 to 0, -3 to 99, -2 to 240, -1 to 410, 0 to 240).associate { (d, v) -> dk.adding(today, d) to v })
      val sinceSat = (org.emdatra.sakinah.core.CivilDate.weekdayIndex(java.time.Instant.now(), Store.zone) + 1) % 7
      Store.adhkarLog = (0..sinceSat).map { dk.adding(today, -it) }.filter { it != dk.adding(today, -1) }.associateWith { listOf("morning") }
      Store.favorites = listOf("dhikr:a01"); Store.hisnFavorites = listOf(34, 129)
    }
    if (route == "review-ayahs") {
      val q = org.emdatra.sakinah.core.QuranText.shared
      Store.weakAyahs = listOfNotNull(q.ayah(2, 255)?.n, q.ayah(2, 286)?.n, q.ayah(18, 10)?.n, q.ayah(67, 2)?.n)
    }
    // ورقة الختمة تحتاج خطةً وسجلّ ورد كي تُظهر حالةً حقيقية: خطة ٣٠ يومًا بدأت قبل خمسة أيام وورد ٢١ صفحة في أربعة منها
    if (route == "mushaf-khatmah" || route == "mushaf") {
      val today = Store.todayKey
      Store.khatmah = org.emdatra.sakinah.core.KhatmahPlan.make(1, org.emdatra.sakinah.core.DayKey.adding(today, -5), 30, "after:isha")
      var log: org.emdatra.sakinah.core.WirdLog = emptyMap()
      for ((i, d) in listOf(-5, -4, -3, -1, 0).withIndex()) for (p in (i * 21 + 1)..((i + 1) * 21)) log = org.emdatra.sakinah.core.Wird.mark(log, org.emdatra.sakinah.core.DayKey.adding(today, d), p, 1)
      Store.wird = log
      Store.lastRead = LastRead(106, 5, 1, System.currentTimeMillis().toDouble())
    }
    // المرحلة الرابعة — «ramadan»: طبعة رمضان بتاريخٍ ثابت (١٢ رمضان، انظر Ramadan.forced) وختمة رمضان بدأت أوّل الشهر:
    // ٢١ صفحة في كلّ يومٍ من الأيام الأحد عشر الماضية (في موعدها) وثماني صفحات اليوم (صلاتان من خمس).
    // و«mushaf-spread» يفتح القارئ على الفاتحة والبقرة (صفحتين متقابلتين متى كانت النافذة موسّعة أفقية أو في وضع الكتاب).
    if (route == "ramadan") {
      val today = Store.todayKey; val start = org.emdatra.sakinah.core.DayKey.adding(today, -(Ramadan.SHOT_DAY - 1))
      Store.khatmah = org.emdatra.sakinah.core.KhatmahPlan.make(1, start, 30, null)
      var log: org.emdatra.sakinah.core.WirdLog = emptyMap()
      for (d in 0 until Ramadan.SHOT_DAY - 1) for (p in (d * 21 + 1)..((d + 1) * 21)) log = org.emdatra.sakinah.core.Wird.mark(log, org.emdatra.sakinah.core.DayKey.adding(start, d), p, 1)
      for (p in ((Ramadan.SHOT_DAY - 1) * 21 + 1)..((Ramadan.SHOT_DAY - 1) * 21 + 8)) log = org.emdatra.sakinah.core.Wird.mark(log, today, p, 1)
      Store.wird = log; Store.nowHidden = null
    }
    Store.save()
  }
}
