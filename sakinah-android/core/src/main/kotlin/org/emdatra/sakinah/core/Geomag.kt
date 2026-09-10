package org.emdatra.sakinah.core

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import kotlin.math.*

/** النموذج المغناطيسي العالمي WMM2025 — مطابق لـ geomag.js */
object Geomag {
  const val epoch = 2025.0; const val validUntil = 2030.0; const val name = "WMM2025"; private const val nMax = 12
  private val G = doubleArrayOf(0.0, -29351.8, -1410.8, -2556.6, 2951.1, 1649.3, 1361.0, -2404.1, 1243.8, 453.6, 895.0, 799.5, 55.7, -281.1, 12.1, -233.2, 368.9, 187.2, -138.7, -142.0, 20.9, 64.4, 63.8, 76.9, -115.7, -40.9, 14.9, -60.7, 79.5, -77.0, -8.8, 59.3, 15.8, 2.5, -11.1, 14.2, 23.2, 10.8, -17.5, 2.0, -21.7, 16.9, 15.0, -16.8, 0.9, 4.6, 7.8, 3.0, -0.2, -2.5, -13.1, 2.4, 8.6, -8.7, -12.9, -1.3, -6.4, 0.2, 2.0, -1.0, -0.6, -0.9, 1.5, 0.9, -2.7, -3.9, 2.9, -1.5, -2.5, 2.4, -0.6, -0.1, -0.6, -0.1, 1.1, -1.0, -0.2, 2.6, -2.0, -0.2, 0.3, 1.2, -1.3, 0.6, 0.6, 0.5, -0.1, -0.4, -0.2, -1.3, -0.7)
  private val H = doubleArrayOf(0.0, 0.0, 4545.4, 0.0, -3133.6, -815.1, 0.0, -56.6, 237.5, -549.5, 0.0, 278.6, -133.9, 212.0, -375.6, 0.0, 45.4, 220.2, -122.9, 43.0, 106.1, 0.0, -18.4, 16.8, 48.8, -59.8, 10.9, 72.7, 0.0, -48.9, -14.4, -1.0, 23.4, -7.4, -25.1, -2.3, 0.0, 7.1, -12.6, 11.4, -9.7, 12.7, 0.7, -5.2, 3.9, 0.0, -24.8, 12.2, 8.3, -3.3, -5.2, 7.2, -0.6, 0.8, 10.0, 0.0, 3.3, 0.0, 2.4, 5.3, -9.1, 0.4, -4.2, -3.8, 0.9, -9.1, 0.0, 0.0, 2.9, -0.6, 0.2, 0.5, -0.3, -1.2, -1.7, -2.9, -1.8, -2.3, 0.0, -1.3, 0.7, 1.0, -1.4, 0.0, 0.6, -0.1, 0.8, 0.1, -1.0, 0.1, 0.2)
  private val GDot = doubleArrayOf(0.0, 12.0, 9.7, -11.6, -5.2, -8.0, -1.3, -4.2, 0.4, -15.6, -1.6, -2.4, -6.0, 5.6, -7.0, 0.6, 1.4, 0.0, 0.6, 2.2, 0.9, -0.2, -0.4, 0.9, 1.2, -0.9, 0.3, 0.9, 0.0, -0.1, -0.1, 0.5, -0.1, -0.8, -0.8, 0.8, -0.1, 0.2, 0.0, 0.5, -0.1, 0.3, 0.2, 0.0, 0.2, 0.0, -0.1, 0.1, 0.3, -0.3, 0.0, 0.3, -0.1, 0.1, -0.1, 0.1, 0.0, 0.1, 0.1, 0.0, -0.3, 0.0, -0.1, -0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.1, 0.0, 0.0, -0.1, -0.1, -0.1, -0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1, 0.0, 0.0, 0.0, -0.1, 0.0, -0.1)
  private val HDot = doubleArrayOf(0.0, 0.0, -21.5, 0.0, -27.7, -12.1, 0.0, 4.0, -0.3, -4.1, 0.0, -1.1, 4.1, 1.6, -4.4, 0.0, -0.5, 2.2, 0.4, 1.7, 1.9, 0.0, 0.3, -1.6, -0.4, 0.9, 0.7, 0.9, 0.0, 0.6, 0.5, -0.8, 0.0, -1.0, 0.6, -0.2, 0.0, -0.2, 0.5, -0.4, 0.4, -0.5, -0.6, 0.3, 0.2, 0.0, -0.3, 0.3, -0.3, 0.3, 0.2, -0.1, -0.2, 0.4, 0.1, 0.0, 0.0, 0.0, -0.2, 0.1, -0.1, 0.1, 0.0, -0.1, 0.2, 0.0, 0.0, 0.0, 0.1, 0.0, 0.1, 0.0, 0.0, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.1, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.1)
  private const val wgsA = 6378.137; private const val wgsB = 6356.7523142; private val wgsEpsSq = 1 - (wgsB * wgsB) / (wgsA * wgsA); private const val RE = 6371.2

  fun decimalYear(instant: Instant): Double {
    val y = LocalDate.ofInstant(instant, ZoneOffset.UTC).year
    val start = LocalDate.of(y, 1, 1).atStartOfDay(ZoneOffset.UTC).toInstant(); val end = LocalDate.of(y + 1, 1, 1).atStartOfDay(ZoneOffset.UTC).toInstant()
    return y + (epochSeconds(instant) - epochSeconds(start)) / (epochSeconds(end) - epochSeconds(start))
  }
  private fun legendre(x: Double, nMax: Int): Pair<DoubleArray, DoubleArray> {
    val numTerms = (nMax + 1) * (nMax + 2) / 2
    val p = DoubleArray(numTerms); val dp = DoubleArray(numTerms); val norm = DoubleArray(numTerms)
    val z = sqrt((1 - x) * (1 + x))
    p[0] = 1.0; dp[0] = 0.0; norm[0] = 1.0
    for (n in 1..nMax) for (m in 0..n) {
      val i = n * (n + 1) / 2 + m
      if (n == m) { val i1 = (n - 1) * n / 2 + m - 1; p[i] = z * p[i1]; dp[i] = z * dp[i1] + x * p[i1] }
      else if (n == 1 && m == 0) { val i1 = (n - 1) * n / 2 + m; p[i] = x * p[i1]; dp[i] = x * dp[i1] - z * p[i1] }
      else {
        val i1 = (n - 2) * (n - 1) / 2 + m; val i2 = (n - 1) * n / 2 + m
        if (m > n - 2) { p[i] = x * p[i2]; dp[i] = x * dp[i2] - z * p[i2] }
        else { val k = ((n - 1) * (n - 1) - m * m).toDouble() / ((2 * n - 1) * (2 * n - 3)).toDouble(); p[i] = x * p[i2] - k * p[i1]; dp[i] = x * dp[i2] - z * p[i2] - k * dp[i1] }
      }
    }
    for (n in 1..nMax) {
      val i0 = n * (n + 1) / 2
      norm[i0] = norm[(n - 1) * n / 2] * (2 * n - 1).toDouble() / n.toDouble()
      for (m in 1..n) norm[i0 + m] = norm[i0 + m - 1] * sqrt(((n - m + 1) * (if (m == 1) 2 else 1)).toDouble() / (n + m).toDouble())
    }
    for (i in 1 until numTerms) { p[i] *= norm[i]; dp[i] *= -norm[i] }
    return Pair(p, dp)
  }
  data class Field(val x: Double, val y: Double, val z: Double, val h: Double, val f: Double, val inclination: Double, val declination: Double, val gridVariation: Double?, val decimalYear: Double, val outOfRange: Boolean)
  fun field(lat: Double, lon: Double, altKm: Double = 0.0, decimalYear: Double): Field {
    val outOfRange = !(decimalYear >= epoch && decimalYear <= validUntil)
    val dt = decimalYear - epoch
    val g = DoubleArray(G.size); val h = DoubleArray(G.size)
    for (i in 1 until G.size) { g[i] = G[i] + dt * GDot[i]; h[i] = H[i] + dt * HDot[i] }
    var phi = lat; if (phi >= 90) phi = 89.9999 else if (phi <= -90) phi = -89.9999
    val lambda = norm180(lon)
    val cosLat = cos(phi * DEG); val sinLat = sin(phi * DEG)
    val rc = wgsA / sqrt(1 - wgsEpsSq * sinLat * sinLat)
    val xp = (rc + altKm) * cosLat; val zp = (rc * (1 - wgsEpsSq) + altKm) * sinLat
    val r = sqrt(xp * xp + zp * zp); val phig = asin(zp / r); val cosPhig = cos(phig)
    val cosLam = cos(lambda * DEG); val sinLam = sin(lambda * DEG)
    val cosM = DoubleArray(nMax + 1); val sinM = DoubleArray(nMax + 1)
    cosM[0] = 1.0; sinM[0] = 0.0; cosM[1] = cosLam; sinM[1] = sinLam
    for (m in 2..nMax) { cosM[m] = cosM[m - 1] * cosLam - sinM[m - 1] * sinLam; sinM[m] = cosM[m - 1] * sinLam + sinM[m - 1] * cosLam }
    val ratio = RE / r
    val rpow = DoubleArray(nMax + 1); rpow[0] = ratio * ratio
    for (n in 1..nMax) rpow[n] = rpow[n - 1] * ratio
    val (p, dp) = legendre(sin(phig), nMax)
    var bx = 0.0; var by = 0.0; var bz = 0.0
    for (n in 1..nMax) for (m in 0..n) {
      val i = n * (n + 1) / 2 + m
      val gc = g[i] * cosM[m] + h[i] * sinM[m]
      bz -= rpow[n] * gc * (n + 1) * p[i]
      by += rpow[n] * (g[i] * sinM[m] - h[i] * cosM[m]) * m * p[i]
      bx -= rpow[n] * gc * dp[i]
    }
    by = if (abs(cosPhig) > 1e-10) by / cosPhig else 0.0
    val psi = phig - phi * DEG; val cosPsi = cos(psi); val sinPsi = sin(psi)
    val x = bx * cosPsi - bz * sinPsi; val z = bx * sinPsi + bz * cosPsi; val y = by
    val hh = sqrt(x * x + y * y); val f = sqrt(hh * hh + z * z)
    val declination = atan2(y, x) / DEG; val inclination = atan2(z, hh) / DEG
    val gv = if (lat >= 55) norm180(declination - lambda) else if (lat <= -55) norm180(declination + lambda) else null
    return Field(x, y, z, hh, f, inclination, declination, gv, decimalYear, outOfRange)
  }
  fun field(lat: Double, lon: Double, altKm: Double = 0.0, instant: Instant = Instant.now()) = field(lat, lon, altKm, decimalYear(instant))
  fun declination(lat: Double, lon: Double, altKm: Double = 0.0, instant: Instant = Instant.now()) = field(lat, lon, altKm, instant).declination
  fun magneticToTrue(magneticHeading: Double, decl: Double) = norm360(magneticHeading + decl)
  fun trueToMagnetic(trueHeading: Double, decl: Double) = norm360(trueHeading - decl)
}
