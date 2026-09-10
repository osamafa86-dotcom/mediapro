package org.emdatra.sakinah.core

import java.time.Instant
import kotlin.math.*

/** إحداثيات جغرافية (درجات) */
data class Coordinates(val latitude: Double, val longitude: Double)

/** حسابات فلكية لموقع الشمس (Meeus) — مطابقة لـ astro.js ولمكتبة adhan */
object Astro {
  fun julianDay(year: Int, month: Int, day: Int, hours: Double = 0.0): Double {
    val y = (if (month > 2) year else year - 1).toDouble()
    val m = (if (month > 2) month else month + 12).toDouble()
    val d = day + hours / 24
    val a = truncate(y / 100)
    val b = truncate(2 - a + truncate(a / 4))
    return truncate(365.25 * (y + 4716)) + truncate(30.6001 * (m + 1)) + d + b - 1524.5
  }
  fun julianDay(instant: Instant) = epochSeconds(instant) / 86400 + 2440587.5
  fun julianCentury(jd: Double) = (jd - 2451545.0) / 36525
  fun meanSolarLongitude(t: Double) = unwindAngle(280.4664567 + 36000.76983 * t + 0.0003032 * t * t)
  fun meanLunarLongitude(t: Double) = unwindAngle(218.3165 + 481267.8813 * t)
  fun ascendingLunarNodeLongitude(t: Double) = unwindAngle(125.04452 - 1934.136261 * t + 0.0020708 * t * t + (t * t * t) / 450000)
  fun meanSolarAnomaly(t: Double) = unwindAngle(357.52911 + 35999.05029 * t - 0.0001537 * t * t)
  fun solarEquationOfTheCenter(t: Double, m: Double): Double { val mr = d2r(m); return (1.914602 - 0.004817 * t - 0.000014 * t * t) * sin(mr) + (0.019993 - 0.000101 * t) * sin(2 * mr) + 0.000289 * sin(3 * mr) }
  fun apparentSolarLongitude(t: Double, l0: Double): Double { val longitude = l0 + solarEquationOfTheCenter(t, meanSolarAnomaly(t)); val omega = 125.04 - 1934.136 * t; return unwindAngle(longitude - 0.00569 - 0.00478 * sin(d2r(omega))) }
  fun meanObliquityOfTheEcliptic(t: Double) = 23.439291 - 0.013004167 * t - 0.0000001639 * t * t + 0.0000005036 * t * t * t
  fun apparentObliquityOfTheEcliptic(t: Double, e0: Double) = e0 + 0.00256 * cos(d2r(125.04 - 1934.136 * t))
  fun meanSiderealTime(t: Double): Double { val jd = t * 36525 + 2451545.0; return unwindAngle(280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * t * t - (t * t * t) / 38710000) }
  fun nutationInLongitude(t: Double, l0: Double, lp: Double, omega: Double) = (-17.2 / 3600) * sin(d2r(omega)) - (1.32 / 3600) * sin(2 * d2r(l0)) - (0.23 / 3600) * sin(2 * d2r(lp)) + (0.21 / 3600) * sin(2 * d2r(omega))
  fun nutationInObliquity(t: Double, l0: Double, lp: Double, omega: Double) = (9.2 / 3600) * cos(d2r(omega)) + (0.57 / 3600) * cos(2 * d2r(l0)) + (0.1 / 3600) * cos(2 * d2r(lp)) - (0.09 / 3600) * cos(2 * d2r(omega))
  fun altitudeOfCelestialBody(phi: Double, delta: Double, h: Double) = r2d(asin(sin(d2r(phi)) * sin(d2r(delta)) + cos(d2r(phi)) * cos(d2r(delta)) * cos(d2r(h))))

  data class SolarCoordinates(val declination: Double, val rightAscension: Double, val apparentSiderealTime: Double, val apparentLongitude: Double)
  fun solarCoordinates(jd: Double): SolarCoordinates {
    val t = julianCentury(jd)
    val l0 = meanSolarLongitude(t); val lp = meanLunarLongitude(t); val omega = ascendingLunarNodeLongitude(t)
    val lambda = d2r(apparentSolarLongitude(t, l0)); val theta0 = meanSiderealTime(t)
    val dPsi = nutationInLongitude(t, l0, lp, omega); val dEps = nutationInObliquity(t, l0, lp, omega)
    val eps0 = meanObliquityOfTheEcliptic(t); val epsApp = d2r(apparentObliquityOfTheEcliptic(t, eps0))
    return SolarCoordinates(r2d(asin(sin(epsApp) * sin(lambda))), unwindAngle(r2d(atan2(cos(epsApp) * sin(lambda), cos(lambda)))),
      theta0 + (dPsi * 3600 * cos(d2r(eps0 + dEps))) / 3600, r2d(lambda))
  }
  fun approximateTransit(longitude: Double, siderealTime: Double, rightAscension: Double): Double {
    val lw = -longitude
    val m0 = normalizeToScale((rightAscension + lw - siderealTime) / 360, 1.0)
    val expected = normalizeToScale((12.0 - longitude / 15.0) / 24.0, 1.0)
    if (m0 - expected > 0.5) return m0 - 1
    if (expected - m0 > 0.5) return m0 + 1
    return m0
  }
  fun correctedTransit(m0: Double, longitude: Double, siderealTime: Double, a2: Double, a1: Double, a3: Double): Double {
    val lw = -longitude
    val theta = unwindAngle(siderealTime + 360.985647 * m0)
    val a = unwindAngle(interpolateAngles(a2, a1, a3, m0))
    val h = quadrantShiftAngle(theta - lw - a)
    return (m0 + h / -360) * 24
  }
  fun correctedHourAngle(m0: Double, h0: Double, coords: Coordinates, afterTransit: Boolean, siderealTime: Double, a2: Double, a1: Double, a3: Double, d2: Double, d1: Double, d3: Double): Double {
    val lw = -coords.longitude
    val term1 = sin(d2r(h0)) - sin(d2r(coords.latitude)) * sin(d2r(d2))
    val term2 = cos(d2r(coords.latitude)) * cos(d2r(d2))
    val hh0 = r2d(acos(term1 / term2))
    val m = if (afterTransit) m0 + hh0 / 360 else m0 - hh0 / 360
    val theta = unwindAngle(siderealTime + 360.985647 * m)
    val a = unwindAngle(interpolateAngles(a2, a1, a3, m))
    val delta = interpolate(d2, d1, d3, m)
    val h = theta - lw - a
    val alt = altitudeOfCelestialBody(coords.latitude, delta, h)
    val dm = (alt - h0) / (360 * cos(d2r(delta)) * cos(d2r(coords.latitude)) * sin(d2r(h)))
    return (m + dm) * 24
  }
  fun interpolate(y2: Double, y1: Double, y3: Double, n: Double): Double { val a = y2 - y1; val b = y3 - y2; val c = b - a; return y2 + (n / 2) * (a + b + n * c) }
  fun interpolateAngles(y2: Double, y1: Double, y3: Double, n: Double): Double { val a = unwindAngle(y2 - y1); val b = unwindAngle(y3 - y2); val c = b - a; return y2 + (n / 2) * (a + b + n * c) }

  data class SunPosition(val azimuth: Double, val altitude: Double, val declination: Double, val hourAngle: Double, val equationOfTime: Double, val rightAscension: Double)
  fun sunPosition(at: Instant, latitude: Double, longitude: Double): SunPosition {
    val jd = julianDay(at); val s = solarCoordinates(jd); val t = julianCentury(jd)
    val h = quadrantShiftAngle(unwindAngle(s.apparentSiderealTime + longitude - s.rightAscension))
    val phi = d2r(latitude); val delta = d2r(s.declination); val hr = d2r(h)
    val altitude = r2d(asin(sin(phi) * sin(delta) + cos(phi) * cos(delta) * cos(hr)))
    val azSouth = r2d(atan2(sin(hr), cos(hr) * sin(phi) - tan(delta) * cos(phi)))
    val l0 = meanSolarLongitude(t)
    var e = l0 - 0.0057183 - s.rightAscension + (s.apparentSiderealTime - meanSiderealTime(t))
    e = quadrantShiftAngle(e) * 4
    return SunPosition(unwindAngle(azSouth + 180), altitude, s.declination, h, e, s.rightAscension)
  }
}

/** ثوانٍ منذ 1970 (بكسور) */
fun epochSeconds(i: Instant): Double = i.epochSecond + i.nano / 1e9
fun Instant.plusSecondsD(s: Double): Instant = plusNanos(Math.round(s * 1e9))
fun instantOf(epoch: Double): Instant = Instant.ofEpochSecond(floor(epoch).toLong(), Math.round((epoch - floor(epoch)) * 1e9))

/** أوقات الشمس ليوم مدني عند موقع؛ القيم بالساعات UT */
class SolarTime(date: CivilDate, val observer: Coordinates) {
  val solar: Astro.SolarCoordinates; val prevSolar: Astro.SolarCoordinates; val nextSolar: Astro.SolarCoordinates
  val approxTransit: Double; val transit: Double; val sunrise: Double; val sunset: Double
  init {
    val jd = Astro.julianDay(date.year, date.month, date.day, 0.0)
    solar = Astro.solarCoordinates(jd); prevSolar = Astro.solarCoordinates(jd - 1); nextSolar = Astro.solarCoordinates(jd + 1)
    val m0 = Astro.approximateTransit(observer.longitude, solar.apparentSiderealTime, solar.rightAscension)
    val solarAltitude = -50.0 / 60.0
    approxTransit = m0
    transit = Astro.correctedTransit(m0, observer.longitude, solar.apparentSiderealTime, solar.rightAscension, prevSolar.rightAscension, nextSolar.rightAscension)
    sunrise = hourAngle(solarAltitude, false); sunset = hourAngle(solarAltitude, true)
  }
  fun hourAngle(angle: Double, afterTransit: Boolean): Double = Astro.correctedHourAngle(approxTransit, angle, observer, afterTransit, solar.apparentSiderealTime,
    solar.rightAscension, prevSolar.rightAscension, nextSolar.rightAscension, solar.declination, prevSolar.declination, nextSolar.declination)
  fun afternoon(shadowLength: Double): Double {
    val tangent = abs(observer.latitude - solar.declination)
    val inverse = shadowLength + tan(d2r(tangent))
    return hourAngle(r2d(atan(1.0 / inverse)), true)
  }
  val isValid get() = !sunrise.isNaN() && !sunset.isNaN()
}
