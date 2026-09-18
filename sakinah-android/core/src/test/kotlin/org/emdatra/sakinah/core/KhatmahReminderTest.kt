package org.emdatra.sakinah.core

import java.time.Instant
import java.time.ZoneId
import kotlin.test.*

/** تذكير الختمة بعد صلاة — الحالات نفسها في KhatmahReminderTests.swift */
class KhatmahReminderTest {
  @Test fun afterPrayerParsing() {
    assertEquals(Prayer.ISHA, Reminders.afterPrayer("after:isha"))
    assertEquals(Prayer.FAJR, Reminders.afterPrayer("after:fajr"))
    assertNull(Reminders.afterPrayer("09:00")); assertNull(Reminders.afterPrayer("after:noon")); assertNull(Reminders.afterPrayer(null))
  }
  @Test fun dailyIgnoresAfterPrayer() {
    val fixed = KhatmahPlan.make(1, "2026-09-18", 30, "21:30"); val after = KhatmahPlan.make(1, "2026-09-18", 30, "after:isha")
    assertEquals(listOf("daily:khatmah"), Reminders.daily(ExtraReminderPrefs(), fixed).map { it.id })
    assertTrue(Reminders.daily(ExtraReminderPrefs(), after).isEmpty())
  }
  @Test fun afterPrayerRemindersFollowTheTimetable() {
    val plan = KhatmahPlan.make(1, "2026-09-18", 30, "after:isha")
    val zone = ZoneId.of("Asia/Amman"); val params = PrayerParams(tz = zone.id); val coords = Coordinates(31.95, 35.93)
    val now = Instant.ofEpochSecond(1_789_000_000)
    val items = Reminders.khatmahAfterPrayer(coords, zone, params, plan, now, days = 3)
    assertEquals(3, items.size)
    assertTrue(items.all { it.kind == ReminderKind.KHATMAH && it.prayer == Prayer.ISHA && it.time.isAfter(now) })
    assertEquals(items.map { it.time }, items.map { it.time }.sorted())
    assertTrue(Reminders.khatmahAfterPrayer(coords, zone, params, null, now).isEmpty())
  }
}
