package org.emdatra.sakinah.app

import android.content.Context
import org.emdatra.sakinah.core.*
import java.time.Instant
import java.time.ZoneId
import kotlin.math.ceil

/**
 * طبعة رمضان (المرحلة الرابعة — ramadan-today.png): تُفعَّل حين يكون الشهر الهجريّ رمضان بحساب التطبيق نفسه
 * (أم القرى مع تعديل المستخدم ±يومين)، أو في مسار اللقطات «ramadan» الذي يفرض ١٢ رمضان من شهرٍ ثلاثينيّ للتجربة.
 * كل ما هنا حسابٌ على الجهاز: الإمساك قبل الفجر بإعداد المستخدم، والصوم من الفجر إلى المغرب، وأيام الشهر الباقية،
 * وختمة رمضان فوق محرّك الختمة القائم (KhatmahPlan + سجلّ الورد) بلا محرّكٍ ثانٍ.
 */
object Ramadan {
  /** مسار اللقطات: ١٢ رمضان ١٤٤٨ من شهرٍ ثلاثينيّ */
  const val SHOT_DAY = 12; private const val SHOT_LENGTH = 30; private const val SHOT_YEAR = 1448
  val forced: Boolean get() = ScreenshotMode.route == "ramadan"

  /** التاريخ الهجريّ المعروض (المفروض في مسار اللقطات) */
  fun hijri(now: Instant = Instant.now(), zone: ZoneId = Store.zone): HijriDate {
    val h = Hijri.date(now, zone, Store.hijriOffset)
    return if (forced) h.copy(day = SHOT_DAY, month = 9, year = SHOT_YEAR) else h
  }
  fun active(now: Instant = Instant.now(), zone: ZoneId = Store.zone): Boolean = forced || Hijri.date(now, zone, Store.hijriOffset).month == 9
  /** اليوم من الشهر (١…٣٠)، أو null خارج رمضان */
  fun day(now: Instant = Instant.now(), zone: ZoneId = Store.zone): Int? = hijri(now, zone).takeIf { it.month == 9 }?.day

  // حساب الأيام الباقية يمرّ على الأيام واحداً واحداً — يُحفظ ليومه كي لا يتكرّر مع كل ثانية في «اليوم»
  private var cache: Pair<String, Int>? = null
  /** أيام رمضان الباقية بما فيها اليوم */
  fun daysLeft(now: Instant = Instant.now(), zone: ZoneId = Store.zone): Int {
    if (forced) return SHOT_LENGTH - SHOT_DAY + 1
    val k = "${DayKey.key(now, zone)}|${Store.hijriOffset}|${zone.id}"
    cache?.takeIf { it.first == k }?.let { return it.second }
    return Hijri.daysUntilEndOfRamadan(now, zone, Store.hijriOffset).also { cache = k to it }
  }
  /** طول الشهر: ما مضى منه وما بقي (٢٩ أو ٣٠) */
  fun length(now: Instant = Instant.now(), zone: ZoneId = Store.zone): Int = ((day(now, zone) ?: 1) - 1 + daysLeft(now, zone)).coerceIn(1, 30)
  fun firstDayKey(today: String, now: Instant = Instant.now()): String = DayKey.adding(today, -((day(now) ?: 1) - 1))
  fun lastDayKey(today: String, now: Instant = Instant.now()): String = DayKey.adding(today, daysLeft(now) - 1)

  private var untilCache: Pair<String, Int>? = null
  /** أيامٌ حتى أول رمضان القادم (لويدجت رمضان خارج الشهر) */
  fun daysUntilStart(now: Instant = Instant.now(), zone: ZoneId = Store.zone): Int {
    val k = "${DayKey.key(now, zone)}|${Store.hijriOffset}|${zone.id}"
    untilCache?.takeIf { it.first == k }?.let { return it.second }
    var n = 0; var d = now
    while (n < 400 && Hijri.date(d, zone, Store.hijriOffset).month != 9) { d = d.plusSeconds(86_400); n++ }
    return n.also { untilCache = k to it }
  }

  // ---- المواقيت
  /** الإمساك: الفجر ناقص إعداد «الإمساك قبل الفجر» (١٠ دقائق افتراضاً) */
  fun imsak(fajr: Instant?): Instant? = fajr?.minusSeconds(Store.imsakMinutes * 60L)
  /** الإمساك القادم: من فجر الغد بعد العشاء، ومن فجر اليوم قبله */
  fun nextImsak(tl: PrayerTimes.DayTimeline): Instant? = imsak(if (tl.next.key == Prayer.FAJR) tl.next.time else tl.times.fajr)
  /** صائمٌ الآن: من فجر اليوم إلى مغربه */
  fun fasting(tl: PrayerTimes.DayTimeline, now: Instant): Boolean {
    val f = tl.times.fajr ?: return false; val m = tl.times.maghrib ?: return false
    return !now.isBefore(f) && now.isBefore(m)
  }
  /** «السحور حتى الإمساك»: بعد العشاء (أو بعد منتصف الليل) وقبل الإمساك */
  fun suhoor(tl: PrayerTimes.DayTimeline, now: Instant): Boolean { val i = nextImsak(tl) ?: return false; return tl.next.key == Prayer.FAJR && now.isBefore(i) }
  /** الإفطار القادم: مغرب اليوم، أو مغرب الغد بعد أن يمضي */
  fun nextIftar(tl: PrayerTimes.DayTimeline, now: Instant): Instant? {
    val m = tl.times.maghrib
    if (m != null && now.isBefore(m)) return m
    val c = Store.coords ?: return m
    return runCatching { PrayerTimes.compute(c, tl.date.adding(1), Store.params()).maghrib }.getOrNull() ?: m
  }

  // ---- ختمة رمضان فوق محرّك الختمة القائم
  /** خطّةٌ تنتهي آخر يوم من هذا الشهر وبدأت فيه = ختمة رمضان */
  fun isPlan(plan: KhatmahPlan?, today: String, now: Instant = Instant.now()): Boolean =
    plan != null && DayKey.adding(plan.startedAt, plan.days - 1) == lastDayKey(today, now) && plan.startedAt >= firstDayKey(today, now)
  /** «ابدأ ختمة رمضان»: المصحف كاملاً من الفاتحة على ما بقي من الشهر — خطّة ختمةٍ عادية في المحرّك نفسه (وتذكيرها يبقى إن كان) */
  fun startPlan(ctx: Context, now: Instant = Instant.now()) {
    val today = Store.todayKey
    Store.wird = emptyMap()
    Store.khatmah = KhatmahPlan.make(1, today, maxOf(1, daysLeft(now)), Store.khatmah?.reminder)
    Store.save(); Notify.schedule(ctx); LiveDay.refresh(ctx)
  }
  /** حصّة اليوم بإعادة التوزيع: ما بقي قبل ورد اليوم على ما بقي من الأيام (فاليوم الفائت يتوزّع بلا لوم) */
  fun share(stt: KhatmahStatus): Int {
    val before = stt.done - stt.todayPages
    return ceil((Khatmah.TOTAL - before).toDouble() / maxOf(1, stt.daysLeft)).toInt().coerceAtLeast(0)
  }
  /** الصفحة التالية في الخطّة (لزرّ «اقرأ حصّتك») */
  fun nextPage(): Int? { val plan = Store.khatmah ?: return null; val stt = Khatmah.status(plan, Store.wird, Store.todayKey); return ((plan.startPage - 1 + stt.done) % Khatmah.TOTAL) + 1 }
}
