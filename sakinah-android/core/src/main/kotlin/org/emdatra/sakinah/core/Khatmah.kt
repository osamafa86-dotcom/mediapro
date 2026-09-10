package org.emdatra.sakinah.core

import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.ZoneId
import kotlin.math.ceil
import kotlin.math.roundToInt

/** مفاتيح الأيام «YYYY-MM-DD» (تقويم ميلادي صرف) */
object DayKey {
  fun daysFromCivil(y0: Int, m: Int, d: Int): Int { val y = if (m <= 2) y0 - 1 else y0; val era = (if (y >= 0) y else y - 399) / 400; val yoe = y - era * 400; val doy = (153 * (m + (if (m > 2) -3 else 9)) + 2) / 5 + d - 1; val doe = yoe * 365 + yoe / 4 - yoe / 100 + doy; return era * 146097 + doe - 719468 }
  fun civilFromDays(z0: Int): Triple<Int, Int, Int> { val z = z0 + 719468; val era = (if (z >= 0) z else z - 146096) / 146097; val doe = z - era * 146097; val yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365; val y = yoe + era * 400; val doy = doe - (365 * yoe + yoe / 4 - yoe / 100); val mp = (5 * doy + 2) / 153; val d = doy - (153 * mp + 2) / 5 + 1; val m = mp + (if (mp < 10) 3 else -9); return Triple(if (m <= 2) y + 1 else y, m, d) }
  fun parse(key: String): Triple<Int, Int, Int>? { val p = key.split('-').mapNotNull { it.toIntOrNull() }; return if (p.size == 3) Triple(p[0], p[1], p[2]) else null }
  fun key(y: Int, m: Int, d: Int) = "%04d-%02d-%02d".format(y, m, d)
  fun key(instant: Instant, zone: ZoneId) = CivilDate.of(instant, zone).key
  fun daysBetween(a: String, b: String): Int { val x = parse(a) ?: return 0; val y = parse(b) ?: return 0; return daysFromCivil(y.first, y.second, y.third) - daysFromCivil(x.first, x.second, x.third) }
  fun adding(key: String, days: Int): String { val p = parse(key) ?: return key; val c = civilFromDays(daysFromCivil(p.first, p.second, p.third) + days); return key(c.first, c.second, c.third) }
}
typealias ReadLog = Map<String, List<Int>>

@Serializable data class KhatmahPlan(val startPage: Int, val startedAt: String, val days: Int, val dailyPages: Int, val reminder: String? = null) {
  companion object { fun make(startPage: Int = 1, startedAt: String, days: Int = 30, reminder: String? = null): KhatmahPlan { val d = maxOf(1, minOf(604, days)); return KhatmahPlan(maxOf(1, minOf(Khatmah.TOTAL, startPage)), startedAt, d, ceil(Khatmah.TOTAL.toDouble() / d).toInt(), reminder) } }
}
@Serializable data class KhatmahStatus(val done: Int, val remaining: Int, val percent: Int, val dayIndex: Int, val expected: Int, val behind: Int, val todayPages: Int, val todayTarget: Int, val daysLeft: Int, val neededPerDay: Int, val etaKey: String, val finished: Boolean)
@Serializable data class ReadStats(val week: Int, val month: Int, val avgDay: Double)
object Khatmah {
  const val TOTAL = 604
  fun pagesDone(plan: KhatmahPlan, currentPage: Int) = if (currentPage <= 0) 0 else ((currentPage - plan.startPage) % TOTAL + TOTAL) % TOTAL
  fun status(plan: KhatmahPlan, currentPage: Int, log: ReadLog, today: String): KhatmahStatus {
    val done = pagesDone(plan, currentPage); val dayIndex = maxOf(0, DayKey.daysBetween(plan.startedAt, today)); val expected = minOf(TOTAL, (dayIndex + 1) * plan.dailyPages)
    val todayPages = log[today]?.size ?: 0; val remaining = TOTAL - done; val behind = maxOf(0, expected - done); val daysLeft = maxOf(0, plan.days - dayIndex)
    val neededPerDay = if (daysLeft > 0) ceil(remaining.toDouble() / daysLeft).toInt() else remaining
    val etaKey = DayKey.adding(today, maxOf(0, ceil(remaining.toDouble() / maxOf(1, plan.dailyPages)).toInt()))
    return KhatmahStatus(done, remaining, (done.toDouble() / TOTAL * 100).roundToInt(), dayIndex, expected, behind, todayPages, minOf(plan.dailyPages + behind, remaining), daysLeft, neededPerDay, etaKey, done >= TOTAL - 1 && currentPage == TOTAL)
  }
  fun streak(log: ReadLog, today: String): Int { var n = 0; var key = today; if (log[key].isNullOrEmpty()) key = DayKey.adding(key, -1); while (!log[key].isNullOrEmpty()) { n++; key = DayKey.adding(key, -1) }; return n }
  fun log(log: ReadLog, today: String, page: Int): ReadLog { val out = HashMap(log); out[today] = ((out[today] ?: emptyList()) + page).toSortedSet().toList(); val keys = out.keys.sorted(); if (keys.size > 400) for (k in keys.take(keys.size - 400)) out.remove(k); return out }
  fun stats(log: ReadLog, today: String): ReadStats { var w = 0; var m = 0; for (i in 0 until 30) { val n = log[DayKey.adding(today, -i)]?.size ?: 0; m += n; if (i < 7) w += n }; return ReadStats(w, m, Math.round(m.toDouble() / 30 * 10) / 10.0) }
}
@Serializable data class ActiveChallenge(val id: String, val startedAt: String, val startPage: Int, val from: Int, val to: Int)
@Serializable data class ChallengeProgress(val id: String, val name: String, val from: Int, val to: Int, val total: Int, val done: Int, val pct: Int, val dayIndex: Int, val daysLeft: Int, val finished: Boolean, val late: Boolean, val minutesLeft: Int)
@Serializable data class HeatDay(val key: String, val count: Int)
object Challenges {
  val all get() = Catalog.shared.challenges
  fun estimateMinutes(pages: Int) = pages * Catalog.shared.minutesPerPage
  fun resolveRange(ch: Challenge, startPage: Int = 1): Pair<Int, Int> { if (ch.from != null && ch.to != null) return ch.from to ch.to; val from = maxOf(1, minOf(604, startPage)); return from to minOf(604, from + (ch.span ?: 20) - 1) }
  fun progress(active: ActiveChallenge?, log: ReadLog, today: String): ChallengeProgress? {
    if (active == null) return null; val ch = Catalog.shared.challenge(active.id) ?: return null
    val total = active.to - active.from + 1; val done = HashSet<Int>()
    for ((key, pages) in log) if (key >= active.startedAt) for (p in pages) if (p in active.from..active.to) done.add(p)
    val dayIndex = maxOf(0, DayKey.daysBetween(active.startedAt, today)); val daysLeft = maxOf(0, ch.days - dayIndex - 1); val finished = done.size >= total
    return ChallengeProgress(ch.id, ch.name, active.from, active.to, total, done.size, (done.size.toDouble() / total * 100).roundToInt(), dayIndex, daysLeft, finished, !finished && dayIndex >= ch.days, estimateMinutes(total - done.size))
  }
  fun heatmap(log: ReadLog, today: String, days: Int = 90): List<HeatDay> = (days - 1 downTo 0).map { i -> val k = DayKey.adding(today, -i); HeatDay(k, log[k]?.size ?: 0) }
}

@Serializable data class TasbihTotals(val total: Int, val today: Int, val date: String)
@Serializable data class TasbihState(val phrase: String = "subhan", val target: Int = 33, val custom: String = "", val count: Int = 0, val rounds: Int = 0, val totals: Map<String, TasbihTotals> = emptyMap())
object Tasbih {
  val phrases get() = Catalog.shared.tasbih.phrases
  val targets get() = Catalog.shared.tasbih.targets
  fun phraseText(s: TasbihState): String { val p = phrases.firstOrNull { it.id == s.phrase } ?: phrases[0]; if (p.id == "custom") { val t = s.custom.trim(); return t.ifEmpty { "ذكر" } }; return p.text }
  fun tap(state: TasbihState, today: String): Pair<TasbihState, Boolean> {
    var t = state.totals[state.phrase] ?: TasbihTotals(0, 0, today)
    if (t.date != today) t = t.copy(today = 0, date = today)
    t = t.copy(total = t.total + 1, today = t.today + 1)
    var s = state.copy(totals = state.totals + (state.phrase to t), count = state.count + 1)
    var reached = false
    if (s.target > 0 && s.count >= s.target) { reached = true; s = s.copy(rounds = s.rounds + 1, count = 0) }
    return s to reached
  }
  fun undo(state: TasbihState, today: String): TasbihState {
    if (state.count <= 0 && state.rounds <= 0) return state
    var s = state
    s.totals[s.phrase]?.let { t -> if (t.total > 0) s = s.copy(totals = s.totals + (s.phrase to t.copy(total = t.total - 1, today = if (t.date == today && t.today > 0) t.today - 1 else t.today))) }
    s = if (s.count > 0) s.copy(count = s.count - 1) else s.copy(rounds = s.rounds - 1, count = if (s.target > 0) s.target - 1 else 0)
    return s
  }
  fun reset(state: TasbihState) = state.copy(count = 0, rounds = 0)
  fun todayCount(s: TasbihState, today: String) = s.totals[s.phrase]?.let { if (it.date == today) it.today else 0 } ?: 0
  fun totalCount(s: TasbihState) = s.totals[s.phrase]?.total ?: 0
  fun grandTotal(s: TasbihState) = s.totals.values.sumOf { it.total }
}
