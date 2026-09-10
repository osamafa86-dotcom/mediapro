package org.emdatra.sakinah.core

import java.time.*
import kotlin.math.floor

/** يوم مدني (سنة/شهر/يوم) — مستقل عن اللحظة */
data class CivilDate(val year: Int, val month: Int, val day: Int) : Comparable<CivilDate> {
  companion object {
    fun of(instant: Instant, zone: ZoneId): CivilDate { val d = LocalDate.ofInstant(instant, zone); return CivilDate(d.year, d.monthValue, d.dayOfMonth) }
    fun daysInMonth(year: Int, month: Int) = YearMonth.of(year, month).lengthOfMonth()
    /** يوم الأسبوع (0 = الأحد) للحظة في منطقة زمنية */
    fun weekdayIndex(instant: Instant, zone: ZoneId) = LocalDate.ofInstant(instant, zone).dayOfWeek.value % 7
  }
  val local: LocalDate get() = LocalDate.of(year, month, day)
  val utcMidnight: Instant get() = local.atStartOfDay(ZoneOffset.UTC).toInstant()
  fun adding(days: Int): CivilDate { val d = local.plusDays(days.toLong()); return CivilDate(d.year, d.monthValue, d.dayOfMonth) }
  val isLeapYear get() = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)
  val dayOfYear: Int get() { val months = intArrayOf(31, if (isLeapYear) 29 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31); var n = 0; for (i in 0 until month - 1) n += months[i]; return n + day }
  fun localNoon(zone: ZoneId): Instant = local.atTime(12, 0).atZone(zone).toInstant()
  fun localMidnight(zone: ZoneId): Instant = local.atStartOfDay(zone).toInstant()
  /** تحويل ساعات UT إلى لحظة في هذا اليوم (اقتطاع الثواني كما في adhan)؛ null إن كانت القيمة غير محدودة */
  fun utcDate(hours: Double): Instant? {
    if (!hours.isFinite()) return null
    val h = floor(hours); val min = floor((hours - h) * 60); val sec = floor((hours - (h + min / 60)) * 3600)
    return utcMidnight.plusSecondsD(h * 3600 + min * 60 + sec)
  }
  val key: String get() = "%04d-%02d-%02d".format(year, month, day)
  override fun compareTo(other: CivilDate) = local.compareTo(other.local)
  override fun toString() = "$year-$month-$day"
}
