package org.emdatra.sakinah.core

import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

/** تصدير المواقيت إلى تقويم iCalendar (ICS) — مطابق لنسختي الويب وiOS */
object ICS {
  private val stamp: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC)
  fun date(i: Instant): String = stamp.format(i)
  fun escape(s: String): String = s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")

  /** طيّ السطور الأطول من 75 بايت (RFC 5545) دون قطع حرف متعدد البايتات */
  fun fold(line: String): String {
    val out = StringBuilder()
    var cur = StringBuilder()
    var bytes = 0
    for (ch in line) {
      val b = ch.toString().toByteArray(Charsets.UTF_8).size
      if (bytes + b > 75) { if (out.isNotEmpty()) out.append("\r\n"); out.append(cur); cur = StringBuilder(" "); bytes = 1 }
      cur.append(ch); bytes += b
    }
    if (out.isNotEmpty()) out.append("\r\n")
    out.append(cur)
    return out.toString()
  }

  data class Options(
    val locationName: String? = null,
    val prayers: Set<String> = Prayer.entries.map { it.id }.toSet(),
    val preMinutes: Int = 0,
    val includeSunrise: Boolean = false,
  )

  /** أيام من PrayerTimes.monthTable */
  fun build(days: List<PrayerTimesResult>, options: Options = Options(), now: Instant = Instant.now()): String {
    val lines = mutableListOf(
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sakinah//Prayer Times//AR",
      "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:مواقيت الصلاة — سكينة",
    )
    val ts = date(now)
    for (day in days) {
      for (key in Prayer.entries) {
        if (key.id !in options.prayers) continue
        if (key == Prayer.SUNRISE && !options.includeSunrise) continue
        val t = day[key] ?: continue
        val name = if (key == Prayer.SUNRISE) "الشروق" else "صلاة ${key.nameAr}"
        lines += listOf(
          "BEGIN:VEVENT", "UID:${date(t)}-${key.id}@sakinah", "DTSTAMP:$ts",
          "DTSTART:${date(t)}", "DTEND:${date(t.plusSeconds(600))}",
          "SUMMARY:${escape(name)}",
          "DESCRIPTION:${escape(name + (options.locationName?.let { " — $it" } ?: "") + "\nمن تطبيق سكينة")}",
          "TRANSP:TRANSPARENT",
        )
        if (key != Prayer.SUNRISE) {
          lines += listOf("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:${escape(name)}", "TRIGGER:PT0M", "END:VALARM")
          if (options.preMinutes > 0) {
            lines += listOf("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:${escape("اقترب موعد $name")}", "TRIGGER:-PT${options.preMinutes}M", "END:VALARM")
          }
        }
        lines += "END:VEVENT"
      }
    }
    lines += "END:VCALENDAR"
    return lines.joinToString("\r\n") { fold(it) } + "\r\n"
  }
}
