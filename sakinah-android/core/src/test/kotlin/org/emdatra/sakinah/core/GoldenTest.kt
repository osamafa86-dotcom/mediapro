package org.emdatra.sakinah.core

import kotlinx.serialization.json.*
import java.io.File
import java.time.Instant
import java.time.ZoneId
import kotlin.math.abs
import kotlin.test.*

/** المرجع الذهبي المشترك (Fixtures/golden.json من مستودع النواة Swift، المولَّد من محرّك الويب) */
class GoldenTest {
  companion object {
    val g: JsonObject by lazy {
      val candidates = listOf("../../sakinah-native/Tests/SakinahCoreTests/Fixtures/golden.json", "../sakinah-native/Tests/SakinahCoreTests/Fixtures/golden.json")
      val f = candidates.map { File(it) }.first { it.exists() }
      Json.parseToJsonElement(f.readText()).jsonObject
    }
    fun epoch(i: Instant?): Long? = i?.let { Math.round(epochSeconds(it)) }
    fun JsonElement.int() = jsonPrimitive.int; fun JsonElement.dbl() = jsonPrimitive.double; fun JsonElement.str() = jsonPrimitive.content
    fun JsonObject.intOrNull(k: String): Long? = this[k]?.let { if (it is JsonNull) null else it.jsonPrimitive.long }
    fun civil(o: JsonObject) = CivilDate(o.getValue("year").int(), o.getValue("month").int(), o.getValue("day").int())
    fun params(p: JsonObject, tz: String): PrayerParams {
      val adj = p.getValue("adjustments").jsonObject
      return PrayerParams(method = p.getValue("method").str(), madhab = Madhab.of(p.getValue("madhab").str()), highLatitudeRule = HighLatitudeRule.of(p.getValue("highLatitudeRule").str()),
        polarResolution = PolarResolution.of(p.getValue("polarResolution").str()), isRamadan = p.getValue("isRamadan").jsonPrimitive.boolean, shafaq = Shafaq.of(p.getValue("shafaq").str()),
        rounding = p["rounding"]?.let { if (it is JsonNull) null else Rounding.of(it.str()) },
        custom = p["custom"]?.let { if (it is JsonNull) null else it.jsonObject.let { c -> CustomMethodParams(c["fajrAngle"]?.dblOrNull(), c["ishaAngle"]?.dblOrNull(), c["ishaInterval"]?.dblOrNull(), c["maghribAngle"]?.dblOrNull()) } },
        adjustments = PrayerAdjustments(adj.getValue("fajr").dbl(), adj.getValue("sunrise").dbl(), adj.getValue("dhuhr").dbl(), adj.getValue("asr").dbl(), adj.getValue("maghrib").dbl(), adj.getValue("isha").dbl()), tz = tz)
    }
    fun JsonElement.dblOrNull(): Double? = if (this is JsonNull) null else jsonPrimitive.double
  }

  @Test fun prayerTimesMatchWebEngine() {
    val mismatches = ArrayList<String>(); var checked = 0; var exact = 0; var total = 0
    for (c0 in g.getValue("prayer").jsonArray) {
      val c = c0.jsonObject; val date = civil(c.getValue("date").jsonObject)
      val r = PrayerTimes.compute(Coordinates(c.getValue("lat").dbl(), c.getValue("lon").dbl()), date, params(c.getValue("params").jsonObject, c.getValue("tz").str()))
      val times = c.getValue("times").jsonObject
      for ((name, got) in listOf("fajr" to r.fajr, "sunrise" to r.sunrise, "dhuhr" to r.dhuhr, "asr" to r.asr, "sunset" to r.sunset, "maghrib" to r.maghrib, "isha" to r.isha)) {
        checked++; val want = times.intOrNull(name); val ge = epoch(got)
        if (name != "sunset") { total++; if (want == ge) exact++ }
        if (want != ge) { if (want != null && ge != null && abs(want - ge) <= 60) continue; mismatches.add("${c.getValue("id").str()} $date ${c.getValue("params").jsonObject.getValue("method").str()} $name: want $want got $ge") }
      }
      val res = c.getValue("resolved").jsonObject
      if (res.getValue("polarResolved").jsonPrimitive.boolean != r.resolved.polarResolved || res.getValue("fajrSafe").jsonPrimitive.boolean != r.resolved.fajrSafe || res.getValue("ishaSafe").jsonPrimitive.boolean != r.resolved.ishaSafe || res.getValue("rule").str() != r.resolved.rule.id || abs(res.getValue("usedLatitude").dbl() - r.resolved.usedLatitude) > 1e-9)
        mismatches.add("${c.getValue("id").str()} $date resolved: want $res got ${r.resolved}")
    }
    assertTrue(mismatches.isEmpty(), "${mismatches.size} mismatches of $checked:\n" + mismatches.take(25).joinToString("\n"))
    assertTrue(checked > 4000); assertTrue(exact.toDouble() / total > 0.999, "exact $exact/$total")
  }

  @Test fun dayTimelineMatchesWebEngine() {
    for (c0 in g.getValue("timeline").jsonArray) {
      val c = c0.jsonObject; val id = c.getValue("id").str()
      val t = PrayerTimes.dayTimeline(Coordinates(c.getValue("lat").dbl(), c.getValue("lon").dbl()), ZoneId.of(c.getValue("tz").str()), PrayerParams(method = c.getValue("method").str()), Instant.ofEpochSecond(c.getValue("now").jsonPrimitive.long))
      assertEquals(civil(c.getValue("date").jsonObject), t.date, id)
      assertEquals(c.getValue("current").str(), t.current.id, "$id current")
      val n = c.getValue("next").jsonObject
      assertEquals(n.getValue("key").str(), t.next.key.id, "$id next"); assertEquals(n.getValue("time").jsonPrimitive.long, epoch(t.next.time), "$id next time")
      assertEquals(n.getValue("isTomorrow").jsonPrimitive.boolean, t.next.isTomorrow); assertEquals(n.getValue("isYesterday").jsonPrimitive.boolean, t.next.isYesterday)
      val s = c.getValue("sunnah").jsonObject
      assertEquals(s.intOrNull("middleOfNight"), epoch(t.sunnah.middleOfNight), "$id midnight"); assertEquals(s.intOrNull("lastThird"), epoch(t.sunnah.lastThird), "$id lastThird")
      assertEquals(c.intOrNull("yesterdayIsha"), epoch(t.yesterdayIsha), "$id yesterdayIsha")
    }
  }

  @Test fun hijriMatchesUmmAlQura() {
    val mismatches = ArrayList<String>()
    for (c0 in g.getValue("hijri").jsonArray) {
      val c = c0.jsonObject
      val h = Hijri.date(Instant.ofEpochSecond(c.getValue("epoch").jsonPrimitive.long), ZoneId.of(c.getValue("tz").str()), c.getValue("offset").int())
      if (h.day != c.getValue("day").int() || h.month != c.getValue("month").int() || h.year != c.getValue("year").int() || h.weekdayIndex != c.getValue("weekday").int())
        mismatches.add("${c.getValue("epoch")} ${c.getValue("tz").str()} ${c.getValue("offset")}: want ${c.getValue("day")}/${c.getValue("month")}/${c.getValue("year")} wd${c.getValue("weekday")} got ${h.day}/${h.month}/${h.year} wd${h.weekdayIndex} (${h.source})")
    }
    assertTrue(mismatches.isEmpty(), "${mismatches.size} hijri mismatches:\n" + mismatches.take(15).joinToString("\n"))
  }

  @Test fun qiblaSunAndZenithMatchWebEngine() {
    for (c0 in g.getValue("qibla").jsonArray) {
      val c = c0.jsonObject; val q = Qibla.info(c.getValue("lat").dbl(), c.getValue("lon").dbl()); val id = c.getValue("id").str()
      assertEquals(c.getValue("bearing").dbl(), q.bearing, 1e-7, id); assertEquals(c.getValue("bearingSpherical").dbl(), q.bearingSpherical, 1e-7, id)
      assertEquals(c.getValue("distanceKm").dbl(), q.distanceKm, 1e-6, id); assertEquals(c.getValue("difference").dbl(), q.difference, 1e-7, id)
      assertEquals(c.getValue("compassPoint").str(), q.compassPoint, id); assertEquals(c.getValue("antipodal").jsonPrimitive.boolean, q.antipodal, id)
    }
    for (c0 in g.getValue("sunMoments").jsonArray) {
      val c = c0.jsonObject; val id = c.getValue("id").str()
      val s = Qibla.sunQiblaMoments(c.getValue("lat").dbl(), c.getValue("lon").dbl(), civil(c.getValue("civil").jsonObject), ZoneId.of(c.getValue("tz").str()))
      assertEquals(c.getValue("bearing").dbl(), s.bearing, 1e-7, id)
      assertEquals(c.intOrNull("sunAtQibla"), epoch(s.sunAtQibla), "$id sunAtQibla"); assertEquals(c.intOrNull("shadowAtQibla"), epoch(s.shadowAtQibla), "$id shadowAtQibla")
    }
    for ((year, events) in g.getValue("zenith").jsonObject) {
      val got = Qibla.kaabaZenithEvents(year.toInt()); val ev = events.jsonArray
      assertEquals(ev.size, got.size)
      for ((gg, w) in got.zip(ev)) { assertEquals(w.jsonObject.getValue("time").jsonPrimitive.long, epoch(gg.time), year); assertEquals(w.jsonObject.getValue("altitude").dbl(), gg.altitude, 1e-6) }
    }
  }

  @Test fun geomagMatchesWebEngine() {
    for (c0 in g.getValue("geomag").jsonArray) {
      val c = c0.jsonObject; val id = c.getValue("id").str()
      val f = Geomag.field(c.getValue("lat").dbl(), c.getValue("lon").dbl(), c.getValue("altKm").dbl(), c.getValue("decimalYear").dbl())
      assertEquals(c.getValue("declination").dbl(), f.declination, 1e-8, id); assertEquals(c.getValue("inclination").dbl(), f.inclination, 1e-8, id)
      assertEquals(c.getValue("f").dbl(), f.f, 1e-5, id); assertEquals(c.getValue("h").dbl(), f.h, 1e-5, id)
      assertEquals(c.getValue("x").dbl(), f.x, 1e-5, id); assertEquals(c.getValue("y").dbl(), f.y, 1e-5, id); assertEquals(c.getValue("z").dbl(), f.z, 1e-5, id)
      val gv = c["gridVariation"]?.let { if (it is JsonNull) null else it.dbl() }
      if (gv != null) assertEquals(gv, f.gridVariation ?: Double.NaN, 1e-8, id) else assertNull(f.gridVariation, id)
      assertEquals(c.getValue("outOfRange").jsonPrimitive.boolean, f.outOfRange, id)
    }
    assertEquals(2026.0, Geomag.decimalYear(Instant.ofEpochSecond(1_767_225_600)), 1e-9)
  }

  @Test fun methodsAndCivilDate() {
    for (c0 in g.getValue("methods").jsonArray) { val c = c0.jsonObject; assertEquals(c.getValue("method").str(), Methods.defaultMethod(c["countryCode"]?.let { if (it is JsonNull) null else it.str() }, c["tz"]?.let { if (it is JsonNull) null else it.str() })) }
    assertEquals(Methods.all.size, Methods.order.size)
    val zone = ZoneId.of("Asia/Amman"); val d = CivilDate.of(Instant.ofEpochSecond(1_788_912_000), zone)
    assertEquals(CivilDate(2026, 9, 9), d); assertEquals(CivilDate(2026, 10, 9), d.adding(30)); assertEquals(366, CivilDate(2024, 12, 31).dayOfYear); assertEquals(28, CivilDate.daysInMonth(2026, 2))
    assertEquals(epochSeconds(d.utcMidnight) + 25.5 * 3600, epochSeconds(d.utcDate(25.5)!!), 1e-6); assertNull(d.utcDate(Double.NaN))
    val db = CityDatabase.bundled
    assertTrue(db.cities.size > 600); assertEquals("JO", db.search("عمّان").first().countryCode); assertEquals("SA", db.search("Makkah").first().countryCode); assertEquals("ام القري", CityDatabase.normalize("أُمُّ القُرى"))
    assertEquals("JO", db.nearest(31.95, 35.91)!!.first.countryCode)
  }
}
