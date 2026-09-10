package org.emdatra.sakinah.core

import java.time.Instant
import java.time.ZoneId
import java.time.chrono.HijrahDate
import java.time.temporal.ChronoField

/** التاريخ الهجري (أم القرى عبر java.time HijrahChronology) مع بديل جدولي، وتعديل المستخدم ±يومين */
data class HijriDate(val day: Int, val month: Int, val year: Int, val weekdayIndex: Int, val source: String) {
  val monthName get() = Hijri.monthsAr[month - 1]
  val weekday get() = Hijri.weekdaysAr[weekdayIndex]
  val formatted get() = "$day $monthName ${year}هـ"
}
object Hijri {
  val monthsAr = listOf("محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة")
  val weekdaysAr = listOf("الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت")
  fun date(instant: Instant = Instant.now(), zone: ZoneId, offsetDays: Int = 0): HijriDate {
    val civ = CivilDate.of(instant, zone).adding(offsetDays)
    val weekdayIndex = CivilDate.weekdayIndex(instant, zone)
    try {
      val h = HijrahDate.from(civ.local)
      return HijriDate(h.get(ChronoField.DAY_OF_MONTH), h.get(ChronoField.MONTH_OF_YEAR), h.get(ChronoField.YEAR), weekdayIndex, "umalqura")
    } catch (e: Exception) {
      val t = tabular(civ.year, civ.month, civ.day)
      return HijriDate(t.first, t.second, t.third, weekdayIndex, "tabular")
    }
  }
  fun isRamadan(instant: Instant = Instant.now(), zone: ZoneId, offsetDays: Int = 0) = date(instant, zone, offsetDays).month == 9
  /** التقويم الجدولي (الخوارزمية الكويتية): (يوم، شهر، سنة) */
  fun tabular(gy: Int, gm: Int, gd: Int): Triple<Int, Int, Int> {
    val a = (14 - gm) / 12; val y = gy + 4800 - a; val m = gm + 12 * a - 3
    val jd = gd + (153 * m + 2) / 5 + 365 * y + y / 4 - y / 100 + y / 400 - 32045
    val l = jd - 1948440 + 10632
    val n = (l - 1) / 10631
    var l2 = l - 10631 * n + 354
    val j = ((10985 - l2) / 5316) * ((50 * l2) / 17719) + (l2 / 5670) * ((43 * l2) / 15238)
    l2 = l2 - ((30 - j) / 15) * ((17719 * j) / 50) - (j / 16) * ((15238 * j) / 43) + 29
    val month = (24 * l2) / 709
    val day = l2 - (709 * month) / 24
    return Triple(day, month, 30 * n + j - 30)
  }
}
