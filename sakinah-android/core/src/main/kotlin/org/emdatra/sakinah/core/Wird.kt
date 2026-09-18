package org.emdatra.sakinah.core

import java.time.Instant
import java.time.ZoneId
import kotlin.math.ceil
import kotlin.math.roundToInt

/** سجلّ الورد: { يوم → عدد الصفحات المقطوعة من بداية الخطة حتى آخر ذلك اليوم } — الأرقام نفسها في Wird.swift */
typealias WirdLog = Map<String, Int>

object Wird {
  const val MAX_STEP = 3
  fun index(page: Int, startPage: Int) = ((page - startPage) % Khatmah.TOTAL + Khatmah.TOTAL) % Khatmah.TOTAL
  fun done(log: WirdLog) = log.values.maxOrNull() ?: 0
  /** يتقدّم فقط حين تكون الصفحة تالية لموضع الخطة (أو بعده بثلاث على الأكثر) */
  fun mark(log: WirdLog, today: String, page: Int, startPage: Int): WirdLog {
    val idx = index(page, startPage) + 1; val last = done(log)
    if (idx <= last || idx - last > MAX_STEP + 1) return log
    val out = HashMap(log); out[today] = maxOf(out[today] ?: 0, idx)
    val keys = out.keys.sorted(); if (keys.size > 400) for (k in keys.take(keys.size - 400)) out.remove(k)
    return out
  }
  fun pages(log: WirdLog, day: String): Int { val d = log[day] ?: return 0; val before = log.filter { it.key < day }.values.maxOrNull() ?: 0; return maxOf(0, d - before) }
  data class Commitment(val done: Int, val total: Int, val days: List<Boolean>)
  fun commitment(log: WirdLog, today: String, target: Int, days: Int = 14): Commitment {
    val flags = (days - 1 downTo 0).map { i -> pages(log, DayKey.adding(today, -i)) >= maxOf(1, target) }
    return Commitment(flags.count { it }, days, flags)
  }
}

fun Khatmah.status(plan: KhatmahPlan, wird: WirdLog, today: String): KhatmahStatus {
  val done = minOf(TOTAL, Wird.done(wird)); val dayIndex = maxOf(0, DayKey.daysBetween(plan.startedAt, today)); val expected = minOf(TOTAL, (dayIndex + 1) * plan.dailyPages)
  val todayPages = Wird.pages(wird, today); val remaining = TOTAL - done; val behind = maxOf(0, expected - done); val daysLeft = maxOf(0, plan.days - dayIndex)
  val neededPerDay = if (daysLeft > 0) ceil(remaining.toDouble() / daysLeft).toInt() else remaining
  val etaKey = DayKey.adding(today, maxOf(0, ceil(remaining.toDouble() / maxOf(1, plan.dailyPages)).toInt()))
  return KhatmahStatus(done, remaining, (done.toDouble() / TOTAL * 100).roundToInt(), dayIndex, expected, behind, todayPages, minOf(plan.dailyPages + behind, remaining), daysLeft, neededPerDay, etaKey, done >= TOTAL)
}
fun Khatmah.days(unit: String, fallback: Int = 30) = when (unit) { "hizb" -> 60; "juz" -> 30; else -> fallback }

/** أوراد مسنونة بدل «التحدّيات»: بلا مؤقّت ولا حالة تأخّر */
data class SunnahWird(val id: String, val name: String, val desc: String, val from: Int, val to: Int, val window: Window, val reminderAfter: Prayer?) {
  enum class Window { FRIDAY_EVE, NIGHTLY, FREE }
  val pages get() = to - from + 1
}
object Awrad {
  val all = listOf(
    SunnahWird("kahf", "سورة الكهف", "من مغرب الخميس إلى مغرب الجمعة", 293, 304, SunnahWird.Window.FRIDAY_EVE, null),
    SunnahWird("mulk", "سورة الملك بعد العشاء", "كل ليلة", 562, 564, SunnahWird.Window.NIGHTLY, Prayer.ISHA),
    SunnahWird("amma", "جزء عمّ", "على مهلك", 582, 604, SunnahWird.Window.FREE, null))
  fun wird(id: String) = all.firstOrNull { it.id == id }
  /** نافذة الكهف: ٤ = الخميس، ٥ = الجمعة (٠ الأحد) */
  fun kahfDays(today: String, weekdayIndex: Int, maghribPassed: Boolean): List<String>? = when {
    weekdayIndex == 4 && maghribPassed -> listOf(today, DayKey.adding(today, 1))
    weekdayIndex == 5 && !maghribPassed -> listOf(DayKey.adding(today, -1), today)
    else -> null
  }
  fun days(w: SunnahWird, today: String, weekdayIndex: Int, maghribPassed: Boolean): List<String> = when (w.window) {
    SunnahWird.Window.FRIDAY_EVE -> kahfDays(today, weekdayIndex, maghribPassed) ?: emptyList()
    SunnahWird.Window.NIGHTLY -> listOf(today)
    SunnahWird.Window.FREE -> (0 until 30).map { DayKey.adding(today, -it) }
  }
  fun progress(w: SunnahWird, log: ReadLog, days: List<String>): Pair<Int, Int> { val set = HashSet<Int>(); for (d in days) for (p in log[d] ?: emptyList()) if (p in w.from..w.to) set.add(p); return set.size to w.pages }
}

/** أوّل كلمتين من الآية التي يبدأ بها الجزء (بلا ۞)؛ الجزء الأول «الفاتحة» */
fun QuranText.juzStartPhrase(j: Int, words: Int = 2): String {
  if (j !in 1..30) return ""
  val s = QuranMeta.juzStarts[j - 1]; if (s.surah == 1) return "الفاتحة"
  val a = ayah(s.surah, s.ayah) ?: return ""
  return a.text.split(' ').filter { it != "۞" }.take(words).joinToString(" ")
}
fun QuranText.quarterStart(q: Int): Ayah? = ayahs.firstOrNull { it.hizbQuarter == q }
fun QuranText.quarters(hizb: Int): List<Ayah> = (1..4).mapNotNull { quarterStart((hizb - 1) * 4 + it) }

/** أيام حتى آخر يوم في رمضان القادم (أو الجاري) */
fun Hijri.daysUntilEndOfRamadan(from: Instant = Instant.now(), zone: ZoneId, offsetDays: Int = 0): Int {
  var d = from; var n = 0; var seen = false
  while (n < 400) { val h = date(d, zone, offsetDays); if (h.month == 9) seen = true else if (seen) return n; d = d.plusSeconds(86_400); n++ }
  return n
}
