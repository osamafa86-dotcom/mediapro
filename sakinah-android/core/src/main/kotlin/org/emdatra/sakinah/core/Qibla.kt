package org.emdatra.sakinah.core

import java.time.Instant
import java.time.ZoneId
import kotlin.math.*

/** اتجاه القبلة: دائرة عظمى، وجيوديسية Vincenty على WGS-84، والتحقق بالشمس — مطابق لـ qibla.js */
object Qibla {
  val kaaba = Coordinates(21.4225241, 39.8261818)
  private const val A = 6378137.0; private const val F = 1 / 298.257223563; private val B = A * (1 - F)
  fun spherical(latitude: Double, longitude: Double): Double {
    val p1 = d2r(latitude); val p2 = d2r(kaaba.latitude); val dl = d2r(kaaba.longitude - longitude)
    return unwindAngle(r2d(atan2(sin(dl), cos(p1) * tan(p2) - sin(p1) * cos(dl))))
  }
  fun distanceSphericalKm(lat1: Double, lon1: Double, lat2: Double = kaaba.latitude, lon2: Double = kaaba.longitude): Double {
    val r = 6371.0088; val p1 = d2r(lat1); val p2 = d2r(lat2); val dp = d2r(lat2 - lat1); val dl = d2r(lon2 - lon1)
    val a = sin(dp / 2).pow(2) + cos(p1) * cos(p2) * sin(dl / 2).pow(2)
    return 2 * r * asin(min(1.0, sqrt(a)))
  }
  data class Vincenty(val distanceKm: Double, val initialBearing: Double, val finalBearing: Double, val converged: Boolean)
  fun vincentyInverse(lat1: Double, lon1: Double, lat2: Double = kaaba.latitude, lon2: Double = kaaba.longitude): Vincenty {
    val p1 = d2r(lat1); val p2 = d2r(lat2); val l = d2r(lon2 - lon1)
    val tanU1 = (1 - F) * tan(p1); val cosU1 = 1 / sqrt(1 + tanU1 * tanU1); val sinU1 = tanU1 * cosU1
    val tanU2 = (1 - F) * tan(p2); val cosU2 = 1 / sqrt(1 + tanU2 * tanU2); val sinU2 = tanU2 * cosU2
    var lambda = l; var lambdaP: Double; var iterations = 0
    var sinL = 0.0; var cosL = 0.0; var sinS = 0.0; var cosS = 0.0; var sigma = 0.0; var sinA = 0.0; var cos2A = 0.0; var cos2Sm = 0.0; var c: Double
    do {
      sinL = sin(lambda); cosL = cos(lambda)
      val sinSq = (cosU2 * sinL).pow(2) + (cosU1 * sinU2 - sinU1 * cosU2 * cosL).pow(2)
      sinS = sqrt(sinSq)
      if (sinS == 0.0) return Vincenty(0.0, 0.0, 0.0, true)
      cosS = sinU1 * sinU2 + cosU1 * cosU2 * cosL
      sigma = atan2(sinS, cosS)
      sinA = (cosU1 * cosU2 * sinL) / sinS
      cos2A = 1 - sinA * sinA
      cos2Sm = if (cos2A != 0.0) cosS - (2 * sinU1 * sinU2) / cos2A else 0.0
      c = (F / 16) * cos2A * (4 + F * (4 - 3 * cos2A))
      lambdaP = lambda
      lambda = l + (1 - c) * F * sinA * (sigma + c * sinS * (cos2Sm + c * cosS * (-1 + 2 * cos2Sm * cos2Sm)))
      iterations++
    } while (abs(lambda - lambdaP) > 1e-12 && iterations < 200)
    if (iterations >= 200) return Vincenty(distanceSphericalKm(lat1, lon1, lat2, lon2), spherical(lat1, lon1), Double.NaN, false)
    val uSq = (cos2A * (A * A - B * B)) / (B * B)
    val aC = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)))
    val bC = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)))
    val dS = bC * sinS * (cos2Sm + (bC / 4) * (cosS * (-1 + 2 * cos2Sm * cos2Sm) - (bC / 6) * cos2Sm * (-3 + 4 * sinS * sinS) * (-3 + 4 * cos2Sm * cos2Sm)))
    val s = B * aC * (sigma - dS)
    val a1 = atan2(cosU2 * sinL, cosU1 * sinU2 - sinU1 * cosU2 * cosL)
    val a2 = atan2(cosU1 * sinL, -sinU1 * cosU2 + cosU1 * sinU2 * cosL)
    return Vincenty(s / 1000, unwindAngle(r2d(a1)), unwindAngle(r2d(a2)), true)
  }
  data class Info(val bearing: Double, val bearingSpherical: Double, val distanceKm: Double, val difference: Double, val compassPoint: String, val antipodal: Boolean)
  fun info(latitude: Double, longitude: Double): Info {
    val sph = spherical(latitude, longitude); val v = vincentyInverse(latitude, longitude)
    val bearing = if (v.converged) v.initialBearing else sph
    return Info(bearing, sph, v.distanceKm, quadrantShiftAngle(bearing - sph), compassPointAr(bearing), !v.converged || v.distanceKm > 19900)
  }
  fun bearingUncertainty(distanceKm: Double, locationErrorM: Double): Double { val d = distanceKm * 1000; val e = max(0.0, locationErrorM); if (!(d > 0) || e >= d) return 180.0; return r2d(asin(e / d)) }
  private val pointsAr = listOf("شمال", "شمال شرق", "شرق", "جنوب شرق", "جنوب", "جنوب غرب", "غرب", "شمال غرب")
  fun compassPointAr(bearing: Double) = pointsAr[(roundAway(unwindAngle(bearing) / 45).toInt()) % 8]
  fun signedDifference(target: Double, reference: Double) = quadrantShiftAngle(unwindAngle(target - reference))

  data class SunMoments(val bearing: Double, val sunAtQibla: Instant?, val shadowAtQibla: Instant?)
  fun sunQiblaMoments(latitude: Double, longitude: Double, civil: CivilDate, zone: ZoneId): SunMoments {
    val bearing = info(latitude, longitude).bearing
    val start = civil.localMidnight(zone)
    fun find(target: Double): Instant? {
      var prev: Double? = null; var prevT: Instant? = null; var m = 0
      while (m <= 1440) {
        val t = start.plusSeconds(m * 60L)
        val p = Astro.sunPosition(t, latitude, longitude)
        val f = signedDifference(p.azimuth, target)
        val pv = prev; val pt = prevT
        if (pv != null && pt != null && (f < 0) != (pv < 0) && f != 0.0 && pv != 0.0 && abs(f - pv) < 180) {
          var lo: Instant = pt; var hi: Instant = t; var flo: Double = pv
          repeat(25) {
            val mid = instantOf((epochSeconds(lo) + epochSeconds(hi)) / 2)
            val fm = signedDifference(Astro.sunPosition(mid, latitude, longitude).azimuth, target)
            if ((fm < 0) == (flo < 0)) { lo = mid; flo = fm } else hi = mid
          }
          val res = Instant.ofEpochSecond(roundAway((epochSeconds(lo) + epochSeconds(hi)) / 2).toLong())
          val pr = Astro.sunPosition(res, latitude, longitude)
          if (pr.altitude > 0 && pr.altitude < 85 && abs(signedDifference(pr.azimuth, target)) < 0.5) return res
        }
        prev = f; prevT = t; m += 2
      }
      return null
    }
    return SunMoments(bearing, find(bearing), find(unwindAngle(bearing + 180)))
  }
  data class ZenithEvent(val time: Instant, val altitude: Double)
  fun kaabaZenithEvents(year: Int): List<ZenithEvent> {
    val events = ArrayList<ZenithEvent>()
    for ((m1, d1, m2, d2) in listOf(listOf(5, 20, 6, 5), listOf(7, 8, 7, 24))) {
      var best: ZenithEvent? = null
      var jd = Astro.julianDay(year, m1, d1); val end = Astro.julianDay(year, m2, d2)
      while (jd <= end) {
        val civil = CivilDate.of(instantOf((jd - 2440587.5) * 86400), ZoneId.of("UTC"))
        val st = SolarTime(civil, kaaba)
        val t = civil.utcMidnight.plusSecondsD(st.transit * 3600)
        val alt = Astro.sunPosition(t, kaaba.latitude, kaaba.longitude).altitude
        if (best == null || alt > best.altitude) best = ZenithEvent(t, alt)
        jd += 1
      }
      best?.let { events.add(it) }
    }
    return events
  }
}
