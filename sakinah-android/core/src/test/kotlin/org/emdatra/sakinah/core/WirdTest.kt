package org.emdatra.sakinah.core

import kotlin.test.*

/** الورد بتقدّم الموضع، الالتزام، الأوراد المسنونة، وأوائل الأجزاء — الأرقام نفسها في WirdTests.swift */
class WirdTest {
  @Test fun wirdAdvancesOnlyContiguously() {
    var log: WirdLog = emptyMap()
    log = Wird.mark(log, "2026-09-18", 1, 1); log = Wird.mark(log, "2026-09-18", 2, 1); log = Wird.mark(log, "2026-09-18", 3, 1)
    assertEquals(3, Wird.done(log))
    log = Wird.mark(log, "2026-09-18", 293, 1); assertEquals(3, Wird.done(log))
    log = Wird.mark(log, "2026-09-19", 4, 1); log = Wird.mark(log, "2026-09-19", 7, 1)
    assertEquals(3, Wird.pages(log, "2026-09-18")); assertEquals(4, Wird.pages(log, "2026-09-19"))
    log = Wird.mark(log, "2026-09-19", 2, 1); assertEquals(7, Wird.done(log))
  }
  @Test fun wirdWrapsAroundFromMidMushaf() {
    var log: WirdLog = emptyMap()
    log = Wird.mark(log, "d1", 603, 603); log = Wird.mark(log, "d1", 604, 603); log = Wird.mark(log, "d1", 1, 603)
    assertEquals(3, Wird.done(log))
  }
  @Test fun commitmentCountsDaysReachingTarget() {
    var log: WirdLog = emptyMap()
    for (i in 0 until 14) { val day = DayKey.adding("2026-09-18", -(13 - i)); val pages = if (i % 4 == 3) 2 else 5; repeat(pages) { log = Wird.mark(log, day, Wird.done(log) + 1, 1) } }
    val c = Wird.commitment(log, "2026-09-18", 5, 14)
    assertEquals(14, c.total); assertEquals(11, c.done); assertFalse(c.days[3]); assertTrue(c.days[13])
  }
  @Test fun khatmahStatusFromWird() {
    var log: WirdLog = emptyMap()
    for (p in 1..42) log = Wird.mark(log, if (p <= 21) "2026-09-17" else "2026-09-18", p, 1)
    val plan = KhatmahPlan.make(1, "2026-09-17", 30)
    val s = Khatmah.status(plan, log, "2026-09-18")
    assertEquals(42, s.done); assertEquals(21, s.todayPages); assertEquals(0, s.behind); assertEquals(7, s.percent)
    assertEquals(60, Khatmah.days("hizb")); assertEquals(30, Khatmah.days("juz"))
  }
  @Test fun kahfWindow() {
    assertEquals(listOf("2026-09-17", "2026-09-18"), Awrad.kahfDays("2026-09-17", 4, true))
    assertNull(Awrad.kahfDays("2026-09-17", 4, false))
    assertEquals(listOf("2026-09-17", "2026-09-18"), Awrad.kahfDays("2026-09-18", 5, false))
    assertNull(Awrad.kahfDays("2026-09-18", 5, true))
    val p = Awrad.progress(Awrad.wird("kahf")!!, mapOf("2026-09-17" to listOf(293, 294, 295), "2026-09-18" to listOf(296, 100)), listOf("2026-09-17", "2026-09-18"))
    assertEquals(4 to 12, p)
    assertEquals(Prayer.ISHA, Awrad.wird("mulk")?.reminderAfter)
  }
  @Test fun juzStartPhrasesComeFromTheCorpus() {
    val q = QuranText.shared
    assertEquals("الفاتحة", q.juzStartPhrase(1)); assertEquals("كُلُّ ٱلطَّعَامِ", q.juzStartPhrase(4)); assertEquals("فَمَا كَانَ", q.juzStartPhrase(20)); assertEquals("عَمَّ يَتَسَآءَلُونَ", q.juzStartPhrase(30))
    assertFalse(q.juzStartPhrase(2).contains("۞"))
    assertEquals(1, q.quarterStart(1)?.page); assertEquals(4, q.quarters(27).size); assertEquals(q.hizbStartPage(27), q.quarters(27).first().page)
  }
}
