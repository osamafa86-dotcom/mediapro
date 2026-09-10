package org.emdatra.sakinah.core

import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.ZoneId

@Serializable data class ReminderPrefs(val enabled: Boolean = false, val prayers: Set<String> = setOf("fajr", "dhuhr", "asr", "maghrib", "isha"), val preMinutes: Int = 0, val sound: String = "chime") { val usesAdhanSound get() = sound.startsWith("adhan") }
enum class ReminderKind(val id: String) { ADHAN("adhan"), PRE("pre"), SUNRISE("sunrise"), ADHKAR("adhkar"), HADITH("hadith"), KHATMAH("khatmah") }
data class Reminder(val id: String, val time: Instant, val kind: ReminderKind, val prayer: Prayer?, val title: String, val body: String)
@Serializable data class ExtraReminderPrefs(val adhkarMorning: Boolean = false, val adhkarEvening: Boolean = false, val morningAfter: Int = 30, val eveningAfter: Int = 30, val hadithDaily: Boolean = false, val hadithTime: String = "09:00") { val any get() = adhkarMorning || adhkarEvening || hadithDaily }
data class DailyReminder(val id: String, val hour: Int, val minute: Int, val title: String, val body: String, val kind: ReminderKind)

object Reminders {
  fun numericId(r: Reminder): Int { val day = ((epochSeconds(r.time) - 1_577_836_800) / 86400).toInt(); val idx = r.prayer?.let { Prayer.entries.indexOf(it) + 1 } ?: 9; val kind = if (r.kind == ReminderKind.ADHAN) 0 else if (r.kind == ReminderKind.PRE) 1 else 2; return day * 100 + idx * 10 + kind }
  fun build(times: PrayerTimesResult, prefs: ReminderPrefs, dateKey: String, format: (Instant) -> String, number: (Int) -> String = { it.toString() }): List<Reminder> {
    val out = ArrayList<Reminder>()
    for (key in Prayer.entries) {
      if (key.id !in prefs.prayers) continue; val t = times[key] ?: continue; val name = key.nameAr
      if (key == Prayer.SUNRISE) out.add(Reminder("$dateKey:sunrise", t, ReminderKind.SUNRISE, key, "طلوع الشمس", "طلعت الشمس (${format(t)}) — انتهى وقت الفجر"))
      else { out.add(Reminder("$dateKey:${key.id}", t, ReminderKind.ADHAN, key, "حان الآن موعد صلاة $name", "$name — ${format(t)}")); if (prefs.preMinutes > 0) out.add(Reminder("$dateKey:${key.id}:pre", t.minusSeconds(prefs.preMinutes * 60L), ReminderKind.PRE, key, "اقترب موعد صلاة $name", "بقي ${number(prefs.preMinutes)} دقيقة على الأذان (${format(t)})")) }
    }
    return out
  }
  fun upcoming(coords: Coordinates, zone: ZoneId, params: PrayerParams, prefs: ReminderPrefs, now: Instant = Instant.now(), max: Int = 60, days: Int = 14, format: (Instant) -> String, number: (Int) -> String = { it.toString() }): List<Reminder> {
    if (!prefs.enabled || prefs.prayers.isEmpty()) return emptyList()
    val p = params.copy(tz = zone.id); val all = ArrayList<Reminder>(); val start = CivilDate.of(now, zone); val floor = now.plusSeconds(15)
    for (i in 0 until days) { val d = start.adding(i); all += build(PrayerTimes.compute(coords, d, p), prefs, "${d.year}-${d.month}-${d.day}", format, number); if (all.count { it.time.isAfter(floor) } >= max) break }
    return all.filter { it.time.isAfter(floor) }.sortedBy { it.time }.take(max)
  }
  fun adhkar(coords: Coordinates, zone: ZoneId, params: PrayerParams, prefs: ExtraReminderPrefs, now: Instant = Instant.now(), days: Int = 7): List<Reminder> {
    if (!prefs.adhkarMorning && !prefs.adhkarEvening) return emptyList()
    val p = params.copy(tz = zone.id); val out = ArrayList<Reminder>(); val start = CivilDate.of(now, zone)
    for (i in 0 until days) {
      val d = start.adding(i); val key = "${d.year}-${d.month}-${d.day}"; val t = PrayerTimes.compute(coords, d, p)
      if (prefs.adhkarMorning) t[Prayer.FAJR]?.let { out.add(Reminder("$key:adhkar:morning", it.plusSeconds(prefs.morningAfter * 60L), ReminderKind.ADHKAR, Prayer.FAJR, "أذكار الصباح", "حان وقت أذكار الصباح — ابدأ يومك بذكر الله")) }
      if (prefs.adhkarEvening) t[Prayer.ASR]?.let { out.add(Reminder("$key:adhkar:evening", it.plusSeconds(prefs.eveningAfter * 60L), ReminderKind.ADHKAR, Prayer.ASR, "أذكار المساء", "حان وقت أذكار المساء — اختم يومك بذكر الله")) }
    }
    val floor = now.plusSeconds(15); return out.filter { it.time.isAfter(floor) }.sortedBy { it.time }
  }
  fun daily(prefs: ExtraReminderPrefs, khatmah: KhatmahPlan?, number: (Int) -> String = { it.toString() }): List<DailyReminder> {
    val out = ArrayList<DailyReminder>()
    if (prefs.hadithDaily) parseHM(prefs.hadithTime)?.let { out.add(DailyReminder("daily:hadith", it.first, it.second, "حديث اليوم", "حديث جديد من الصحيحين في انتظارك", ReminderKind.HADITH)) }
    khatmah?.reminder?.let { r -> parseHM(r)?.let { out.add(DailyReminder("daily:khatmah", it.first, it.second, "ورد اليوم من القرآن", "${number(khatmah.dailyPages)} صفحات تُبقيك على جدول الختمة", ReminderKind.KHATMAH)) } }
    return out
  }
  fun parseHM(s: String): Pair<Int, Int>? { val p = s.split(':').mapNotNull { it.toIntOrNull() }; return if (p.size == 2 && p[0] in 0..23 && p[1] in 0..59) p[0] to p[1] else null }
}
