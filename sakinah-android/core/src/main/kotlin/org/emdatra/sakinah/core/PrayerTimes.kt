package org.emdatra.sakinah.core

import java.time.Instant
import java.time.ZoneId
import kotlin.math.abs
import kotlin.math.floor

enum class Madhab(val id: String) { SHAFI("shafi"), HANAFI("hanafi"); companion object { fun of(s: String?) = entries.firstOrNull { it.id == s } ?: SHAFI } }
enum class HighLatitudeRule(val id: String, val nameAr: String) {
  AUTO("auto", "تلقائي (منتصف الليل، ونسبة زاوية الشفق حين لا يتحقق الشفق أو فوق 48°)"), MIDDLE_OF_THE_NIGHT("middleofthenight", "منتصف الليل"), SEVENTH_OF_THE_NIGHT("seventhofthenight", "سُبع الليل"), TWILIGHT_ANGLE("twilightangle", "نسبة زاوية الشفق");
  companion object { fun of(s: String?) = entries.firstOrNull { it.id == s } ?: AUTO }
}
enum class PolarResolution(val id: String) { AQRAB_BALAD("aqrabbalad"), UNRESOLVED("unresolved"); companion object { fun of(s: String?) = entries.firstOrNull { it.id == s } ?: AQRAB_BALAD } }
enum class Shafaq(val id: String) { GENERAL("general"), AHMER("ahmer"), ABYAD("abyad"); companion object { fun of(s: String?) = entries.firstOrNull { it.id == s } ?: GENERAL } }
data class CustomMethodParams(val fajrAngle: Double? = null, val ishaAngle: Double? = null, val ishaInterval: Double? = null, val maghribAngle: Double? = null)
data class PrayerParams(val method: String = "MuslimWorldLeague", val madhab: Madhab = Madhab.SHAFI, val highLatitudeRule: HighLatitudeRule = HighLatitudeRule.AUTO, val polarResolution: PolarResolution = PolarResolution.AQRAB_BALAD,
  val adjustments: PrayerAdjustments = PrayerAdjustments.ZERO, val custom: CustomMethodParams? = null, val isRamadan: Boolean = false, val rounding: Rounding? = null, val shafaq: Shafaq = Shafaq.GENERAL, val tz: String? = null)

data class Resolved(val method: CalculationMethod, val polarResolved: Boolean, val usedLatitude: Double, val fajrSafe: Boolean, val ishaSafe: Boolean, val nightSeconds: Double, val dayShifted: Boolean, val rule: HighLatitudeRule, val fajrRule: HighLatitudeRule?, val ishaRule: HighLatitudeRule?)
data class PrayerTimesResult(val fajr: Instant?, val sunrise: Instant?, val dhuhr: Instant?, val asr: Instant?, val sunset: Instant?, val maghrib: Instant?, val isha: Instant?, val date: CivilDate, val coords: Coordinates, val resolved: Resolved) {
  operator fun get(p: Prayer) = when (p) { Prayer.FAJR -> fajr; Prayer.SUNRISE -> sunrise; Prayer.DHUHR -> dhuhr; Prayer.ASR -> asr; Prayer.MAGHRIB -> maghrib; Prayer.ISHA -> isha }
}

object PrayerTimes {
  fun roundedMinute(date: Instant?, rounding: Rounding = Rounding.NEAREST): Instant? {
    if (date == null) return null
    val seconds = (floor(epochSeconds(date)).toLong() % 60).toInt()
    var offset = if (seconds >= 30) 60 - seconds else -seconds
    if (rounding == Rounding.UP) offset = 60 - seconds else if (rounding == Rounding.NONE) offset = 0
    return date.plusSecondsD(offset.toDouble())
  }
  private fun addSeconds(d: Instant?, s: Double) = d?.plusSecondsD(s)
  private fun addMinutes(d: Instant?, m: Double) = addSeconds(d, m * 60)

  private fun aqrabBalad(coords: Coordinates, date: CivilDate, tomorrow: CivilDate): Triple<Coordinates, SolarTime, SolarTime>? {
    var lat = coords.latitude
    for (i in 0 until 100) {
      lat -= (if (lat > 0) 1.0 else if (lat < 0) -1.0 else 0.0) * 0.5
      val c = Coordinates(lat, coords.longitude)
      val st = SolarTime(date, c); val st2 = SolarTime(tomorrow, c)
      if (st.isValid && st2.isValid) return Triple(c, st, st2)
      if (abs(lat) < 65) break
    }
    return null
  }
  private fun daysSinceSolstice(doy: Int, latitude: Double, leap: Boolean): Int {
    val daysInYear = if (leap) 366 else 365
    if (latitude >= 0) { var d = doy + 10; if (d >= daysInYear) d -= daysInYear; return d }
    var d = doy - (if (leap) 173 else 172); if (d < 0) d += daysInYear; return d
  }
  private fun seasonalAdjustment(a: Double, b: Double, c: Double, d: Double, dyy: Int): Double {
    val x = dyy.toDouble()
    return when {
      dyy < 91 -> a + ((b - a) / 91) * x
      dyy < 137 -> b + ((c - b) / 46) * (x - 91)
      dyy < 183 -> c + ((d - c) / 46) * (x - 137)
      dyy < 229 -> d + ((c - d) / 46) * (x - 183)
      dyy < 275 -> c + ((b - c) / 46) * (x - 229)
      else -> b + ((a - b) / 91) * (x - 275)
    }
  }
  private fun seasonAdjustedMorningTwilight(latitude: Double, date: CivilDate, sunrise: Instant?): Instant? {
    val l = abs(latitude)
    val adj = seasonalAdjustment(75 + (28.65 / 55) * l, 75 + (19.44 / 55) * l, 75 + (32.74 / 55) * l, 75 + (48.1 / 55) * l, daysSinceSolstice(date.dayOfYear, latitude, date.isLeapYear))
    return addSeconds(sunrise, roundAway(adj * -60))
  }
  private fun seasonAdjustedEveningTwilight(latitude: Double, date: CivilDate, sunset: Instant?, shafaq: Shafaq): Instant? {
    val l = abs(latitude)
    val (a, b, c, d) = when (shafaq) {
      Shafaq.AHMER -> listOf(62 + (17.4 / 55) * l, 62 - (7.16 / 55) * l, 62 + (5.12 / 55) * l, 62 + (19.44 / 55) * l)
      Shafaq.ABYAD -> listOf(75 + (25.6 / 55) * l, 75 + (7.16 / 55) * l, 75 + (36.84 / 55) * l, 75 + (81.84 / 55) * l)
      Shafaq.GENERAL -> listOf(75 + (25.6 / 55) * l, 75 + (2.05 / 55) * l, 75 - (9.21 / 55) * l, 75 + (6.14 / 55) * l)
    }
    val adj = seasonalAdjustment(a, b, c, d, daysSinceSolstice(date.dayOfYear, latitude, date.isLeapYear))
    return addSeconds(sunset, roundAway(adj * 60))
  }
  fun resolveMethodParams(params: PrayerParams): CalculationMethod {
    var p = Methods.method(params.method)
    if (params.method == "Custom" && params.custom != null) {
      val custom = params.custom
      fun angle(v: Double?, def: Double) = if (v != null && v.isFinite() && v >= 4 && v <= 30) v else def
      fun nonneg(v: Double?, def: Double) = if (v != null && v.isFinite() && v >= 0 && v <= 180) v else def
      val mg = custom.maghribAngle
      p = p.copy(fajrAngle = angle(custom.fajrAngle, 18.0), ishaAngle = angle(custom.ishaAngle, 17.0), ishaInterval = nonneg(custom.ishaInterval, 0.0),
        maghribAngle = if (mg != null && mg.isFinite() && mg > 0 && mg <= 10) mg else 0.0)
    }
    if (params.isRamadan && p.ishaIntervalRamadan != null) p = p.copy(ishaInterval = p.ishaIntervalRamadan)
    if (params.rounding != null) p = p.copy(rounding = params.rounding)
    return p
  }
  private data class Portions(val fajr: Double, val isha: Double, val rule: HighLatitudeRule)
  private fun nightPortions(rule: HighLatitudeRule, latitude: Double, fajrAngle: Double, ishaAngle: Double): Portions {
    val r = if (rule == HighLatitudeRule.AUTO) (if (latitude > 48) HighLatitudeRule.TWILIGHT_ANGLE else HighLatitudeRule.MIDDLE_OF_THE_NIGHT) else rule
    if (r == HighLatitudeRule.SEVENTH_OF_THE_NIGHT) return Portions(1.0 / 7, 1.0 / 7, r)
    if (r == HighLatitudeRule.TWILIGHT_ANGLE) return Portions(fajrAngle / 60, ishaAngle / 60, r)
    return Portions(0.5, 0.5, r)
  }

  fun compute(coords: Coordinates, date: CivilDate, params: PrayerParams = PrayerParams(), shifted: Boolean = false): PrayerTimesResult {
    val mp = resolveMethodParams(params)
    val tomorrow = date.adding(1)
    var usedCoords = coords
    var solarTime = SolarTime(date, coords); var tomorrowSolarTime = SolarTime(tomorrow, coords)
    var dhuhrTime = date.utcDate(solarTime.transit); var sunriseTime = date.utcDate(solarTime.sunrise); var sunsetTime = date.utcDate(solarTime.sunset)
    var polarResolved = false
    val tzId = params.tz
    if (tzId != null && !shifted && dhuhrTime != null) {
      val zone = try { ZoneId.of(tzId) } catch (e: Exception) { null }
      if (zone != null) {
        val c = CivilDate.of(dhuhrTime, zone)
        val diff = Math.round((epochSeconds(c.utcMidnight) - epochSeconds(date.utcMidnight)) / 86400).toInt()
        if (diff != 0 && abs(diff) == 1) { val r = compute(coords, date.adding(-diff), params, true); return r.copy(date = date) }
      }
    }
    if ((sunriseTime == null || sunsetTime == null || tomorrowSolarTime.sunrise.isNaN()) && params.polarResolution == PolarResolution.AQRAB_BALAD) {
      aqrabBalad(coords, date, tomorrow)?.let { (c, st, st2) ->
        polarResolved = true; usedCoords = c; solarTime = st; tomorrowSolarTime = st2
        dhuhrTime = date.utcDate(solarTime.transit); sunriseTime = date.utcDate(solarTime.sunrise); sunsetTime = date.utcDate(solarTime.sunset)
      }
    }
    val shadow = if (params.madhab == Madhab.HANAFI) 2.0 else 1.0
    val asrTime = date.utcDate(solarTime.afternoon(shadow))
    val tomorrowSunrise = tomorrow.utcDate(tomorrowSolarTime.sunrise)
    val night = if (tomorrowSunrise != null && sunsetTime != null) epochSeconds(tomorrowSunrise) - epochSeconds(sunsetTime) else Double.NaN
    val portions = nightPortions(params.highLatitudeRule, usedCoords.latitude, mp.fajrAngle, mp.ishaAngle)
    val isMoonsighting = mp.id == "MoonsightingCommittee"

    var fajrTime = date.utcDate(solarTime.hourAngle(-mp.fajrAngle, false))
    if (isMoonsighting && coords.latitude >= 55) fajrTime = addSeconds(sunriseTime, -night / 7)
    val autoRule = params.highLatitudeRule == HighLatitudeRule.AUTO
    val fajrPortion = if (autoRule && fajrTime == null) mp.fajrAngle / 60 else portions.fajr
    val safeFajr = if (isMoonsighting) seasonAdjustedMorningTwilight(coords.latitude, date, sunriseTime) else addSeconds(sunriseTime, -fajrPortion * night)
    var fajrSafe = false
    if (fajrTime == null || (safeFajr != null && safeFajr.isAfter(fajrTime))) { fajrTime = safeFajr; fajrSafe = true }

    var ishaTime: Instant?; var ishaSafe = false; var ishaRuleUsed: HighLatitudeRule? = null
    if (mp.ishaInterval > 0) ishaTime = addMinutes(sunsetTime, mp.ishaInterval)
    else {
      ishaTime = date.utcDate(solarTime.hourAngle(-mp.ishaAngle, true))
      if (isMoonsighting && coords.latitude >= 55) ishaTime = addSeconds(sunsetTime, night / 7)
      val ishaPortion = if (autoRule && ishaTime == null) mp.ishaAngle / 60 else portions.isha
      ishaRuleUsed = if (ishaPortion == portions.isha) portions.rule else HighLatitudeRule.TWILIGHT_ANGLE
      val safeIsha = if (isMoonsighting) seasonAdjustedEveningTwilight(coords.latitude, date, sunsetTime, params.shafaq) else addSeconds(sunsetTime, ishaPortion * night)
      if (ishaTime == null || (safeIsha != null && safeIsha.isBefore(ishaTime))) { ishaTime = safeIsha; ishaSafe = true }
    }
    var maghribTime = sunsetTime
    if (mp.maghribAngle != 0.0) {
      val angleBased = date.utcDate(solarTime.hourAngle(-mp.maghribAngle, true))
      if (angleBased != null && sunsetTime != null && ishaTime != null && sunsetTime.isBefore(angleBased) && ishaTime.isAfter(angleBased)) maghribTime = angleBased
    }
    if (mp.maghribInterval != 0.0) maghribTime = addMinutes(maghribTime, mp.maghribInterval)
    fun adj(k: Prayer) = params.adjustments[k] + mp.adjustments[k]
    val rounding = mp.rounding
    val resolved = Resolved(mp, polarResolved, usedCoords.latitude, fajrSafe, ishaSafe, night, shifted, portions.rule,
      if (fajrSafe) (if (fajrPortion == portions.fajr) portions.rule else HighLatitudeRule.TWILIGHT_ANGLE) else null, if (ishaSafe) ishaRuleUsed else null)
    return PrayerTimesResult(roundedMinute(addMinutes(fajrTime, adj(Prayer.FAJR)), rounding), roundedMinute(addMinutes(sunriseTime, adj(Prayer.SUNRISE)), rounding), roundedMinute(addMinutes(dhuhrTime, adj(Prayer.DHUHR)), rounding),
      roundedMinute(addMinutes(asrTime, adj(Prayer.ASR)), rounding), roundedMinute(sunsetTime, rounding), roundedMinute(addMinutes(maghribTime, adj(Prayer.MAGHRIB)), rounding), roundedMinute(addMinutes(ishaTime, adj(Prayer.ISHA)), rounding), date, coords, resolved)
  }

  data class SunnahTimes(val middleOfNight: Instant?, val lastThird: Instant?, val nextFajr: Instant?)
  fun sunnahTimes(coords: Coordinates, date: CivilDate, params: PrayerParams = PrayerParams()): SunnahTimes {
    val today = compute(coords, date, params); val next = compute(coords, date.adding(1), params)
    val nf = next.fajr; val mg = today.maghrib
    if (nf == null || mg == null) return SunnahTimes(null, null, next.fajr)
    val night = epochSeconds(nf) - epochSeconds(mg)
    return SunnahTimes(roundedMinute(mg.plusSecondsD(night / 2)), roundedMinute(mg.plusSecondsD(night * (2.0 / 3))), nf)
  }
  data class NextPrayer(val key: Prayer, val time: Instant, val isTomorrow: Boolean, val isYesterday: Boolean)
  data class DayTimeline(val date: CivilDate, val times: PrayerTimesResult, val sunnah: SunnahTimes, val current: Prayer, val next: NextPrayer, val yesterdayIsha: Instant?)
  fun dayTimeline(coords: Coordinates, zone: ZoneId, params0: PrayerParams = PrayerParams(), now: Instant = Instant.now()): DayTimeline {
    val params = params0.copy(tz = zone.id)
    val date = CivilDate.of(now, zone)
    val times = compute(coords, date, params)
    var current: Prayer? = null; var next: NextPrayer? = null
    for (k in Prayer.entries) { val t = times[k] ?: continue; if (!now.isBefore(t)) current = k else if (next == null) next = NextPrayer(k, t, false, false) }
    var yesterdayIsha: Instant? = null
    if (current == null) {
      val y = compute(coords, date.adding(-1), params)
      val yi = y.isha
      if (yi != null && yi.isAfter(now)) { current = Prayer.MAGHRIB; next = NextPrayer(Prayer.ISHA, yi, false, true) } else current = Prayer.ISHA
      yesterdayIsha = y.isha
    }
    if (next == null) { val tm = compute(coords, date.adding(1), params); next = NextPrayer(Prayer.FAJR, tm.fajr ?: now.plusSeconds(86400), true, false) }
    val beforeFajr = times.fajr?.let { now.isBefore(it) } ?: false
    val sunnah = sunnahTimes(coords, if (beforeFajr) date.adding(-1) else date, params)
    return DayTimeline(date, times, sunnah, current, next, yesterdayIsha)
  }
  fun monthTable(coords: Coordinates, year: Int, month: Int, params: PrayerParams = PrayerParams()): List<PrayerTimesResult> =
    (1..CivilDate.daysInMonth(year, month)).map { compute(coords, CivilDate(year, month, it), params) }
}
