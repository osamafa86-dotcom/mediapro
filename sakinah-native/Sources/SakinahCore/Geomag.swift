import Foundation

/// النموذج المغناطيسي العالمي WMM2025 (NOAA/NCEI، المعاملات ملك عام) — مطابق لـ geomag.js
/// الاصطلاحات: خط العرض/الطول جيوديسي بالدرجات، الارتفاع بالكيلومتر فوق WGS-84، الانحراف موجب شرقًا
public enum Geomag {
  public static let epoch = 2025.0
  public static let validUntil = 2030.0
  public static let name = "WMM2025"
  static let nMax = 12

  // المعاملات مرتبة تسطيحًا بالفهرس i = n(n+1)/2 + m (الفهرس 0 غير مستخدم)
  static let G: [Double] = [
    0,
    -29351.8, -1410.8,
    -2556.6, 2951.1, 1649.3,
    1361, -2404.1, 1243.8, 453.6,
    895, 799.5, 55.7, -281.1, 12.1,
    -233.2, 368.9, 187.2, -138.7, -142, 20.9,
    64.4, 63.8, 76.9, -115.7, -40.9, 14.9, -60.7,
    79.5, -77, -8.8, 59.3, 15.8, 2.5, -11.1, 14.2,
    23.2, 10.8, -17.5, 2, -21.7, 16.9, 15, -16.8, 0.9,
    4.6, 7.8, 3, -0.2, -2.5, -13.1, 2.4, 8.6, -8.7, -12.9,
    -1.3, -6.4, 0.2, 2, -1, -0.6, -0.9, 1.5, 0.9, -2.7, -3.9,
    2.9, -1.5, -2.5, 2.4, -0.6, -0.1, -0.6, -0.1, 1.1, -1, -0.2, 2.6,
    -2, -0.2, 0.3, 1.2, -1.3, 0.6, 0.6, 0.5, -0.1, -0.4, -0.2, -1.3, -0.7,
  ]
  static let H: [Double] = [
    0,
    0, 4545.4,
    0, -3133.6, -815.1,
    0, -56.6, 237.5, -549.5,
    0, 278.6, -133.9, 212, -375.6,
    0, 45.4, 220.2, -122.9, 43, 106.1,
    0, -18.4, 16.8, 48.8, -59.8, 10.9, 72.7,
    0, -48.9, -14.4, -1, 23.4, -7.4, -25.1, -2.3,
    0, 7.1, -12.6, 11.4, -9.7, 12.7, 0.7, -5.2, 3.9,
    0, -24.8, 12.2, 8.3, -3.3, -5.2, 7.2, -0.6, 0.8, 10,
    0, 3.3, 0, 2.4, 5.3, -9.1, 0.4, -4.2, -3.8, 0.9, -9.1,
    0, 0, 2.9, -0.6, 0.2, 0.5, -0.3, -1.2, -1.7, -2.9, -1.8, -2.3,
    0, -1.3, 0.7, 1, -1.4, 0, 0.6, -0.1, 0.8, 0.1, -1, 0.1, 0.2,
  ]
  static let GDot: [Double] = [
    0,
    12, 9.7,
    -11.6, -5.2, -8,
    -1.3, -4.2, 0.4, -15.6,
    -1.6, -2.4, -6, 5.6, -7,
    0.6, 1.4, 0, 0.6, 2.2, 0.9,
    -0.2, -0.4, 0.9, 1.2, -0.9, 0.3, 0.9,
    0, -0.1, -0.1, 0.5, -0.1, -0.8, -0.8, 0.8,
    -0.1, 0.2, 0, 0.5, -0.1, 0.3, 0.2, 0, 0.2,
    0, -0.1, 0.1, 0.3, -0.3, 0, 0.3, -0.1, 0.1, -0.1,
    0.1, 0, 0.1, 0.1, 0, -0.3, 0, -0.1, -0.1, 0, 0,
    0, 0, 0, 0, 0, -0.1, 0, 0, -0.1, -0.1, -0.1, -0.1,
    0, 0, 0, 0, 0, 0, 0.1, 0, 0, 0, -0.1, 0, -0.1,
  ]
  static let HDot: [Double] = [
    0,
    0, -21.5,
    0, -27.7, -12.1,
    0, 4, -0.3, -4.1,
    0, -1.1, 4.1, 1.6, -4.4,
    0, -0.5, 2.2, 0.4, 1.7, 1.9,
    0, 0.3, -1.6, -0.4, 0.9, 0.7, 0.9,
    0, 0.6, 0.5, -0.8, 0, -1, 0.6, -0.2,
    0, -0.2, 0.5, -0.4, 0.4, -0.5, -0.6, 0.3, 0.2,
    0, -0.3, 0.3, -0.3, 0.3, 0.2, -0.1, -0.2, 0.4, 0.1,
    0, 0, 0, -0.2, 0.1, -0.1, 0.1, 0, -0.1, 0.2, 0,
    0, 0, 0.1, 0, 0.1, 0, 0, 0.1, 0, 0, 0, 0,
    0, 0, 0, -0.1, 0.1, 0, 0, 0, 0, 0, 0, 0, -0.1,
  ]
  static let wgsA = 6378.137, wgsB = 6356.7523142
  static let wgsEpsSq = 1 - (wgsB * wgsB) / (wgsA * wgsA)
  static let RE = 6371.2

  /// السنة العشرية (UTC)
  public static func decimalYear(_ date: Date) -> Double {
    let cal = CivilDate.utcCalendar
    let y = cal.component(.year, from: date)
    let start = cal.date(from: DateComponents(year: y, month: 1, day: 1))!.timeIntervalSince1970
    let end = cal.date(from: DateComponents(year: y + 1, month: 1, day: 1))!.timeIntervalSince1970
    return Double(y) + (date.timeIntervalSince1970 - start) / (end - start)
  }

  private static func legendre(_ x: Double, _ nMax: Int) -> (p: [Double], dp: [Double]) {
    let numTerms = (nMax + 1) * (nMax + 2) / 2
    var p = [Double](repeating: 0, count: numTerms), dp = p, norm = p
    let z = sqrt((1 - x) * (1 + x))
    p[0] = 1; dp[0] = 0; norm[0] = 1
    for n in 1...nMax {
      for m in 0...n {
        let i = n * (n + 1) / 2 + m
        if n == m {
          let i1 = (n - 1) * n / 2 + m - 1
          p[i] = z * p[i1]; dp[i] = z * dp[i1] + x * p[i1]
        } else if n == 1 && m == 0 {
          let i1 = (n - 1) * n / 2 + m
          p[i] = x * p[i1]; dp[i] = x * dp[i1] - z * p[i1]
        } else {
          let i1 = (n - 2) * (n - 1) / 2 + m
          let i2 = (n - 1) * n / 2 + m
          if m > n - 2 {
            p[i] = x * p[i2]; dp[i] = x * dp[i2] - z * p[i2]
          } else {
            let k = Double((n - 1) * (n - 1) - m * m) / Double((2 * n - 1) * (2 * n - 3))
            p[i] = x * p[i2] - k * p[i1]
            dp[i] = x * dp[i2] - z * p[i2] - k * dp[i1]
          }
        }
      }
    }
    for n in 1...nMax {
      let i0 = n * (n + 1) / 2
      norm[i0] = norm[(n - 1) * n / 2] * Double(2 * n - 1) / Double(n)
      for m in 1...n { norm[i0 + m] = norm[i0 + m - 1] * sqrt(Double((n - m + 1) * (m == 1 ? 2 : 1)) / Double(n + m)) }
    }
    for i in 1..<numTerms { p[i] *= norm[i]; dp[i] *= -norm[i] }
    return (p, dp)
  }

  public struct Field: Sendable {
    public let x: Double, y: Double, z: Double, h: Double, f: Double
    public let inclination: Double
    /// الانحراف (موجب شرقًا)
    public let declination: Double
    /// تباين الشبكة (nil إن كان |lat| < 55)
    public let gridVariation: Double?
    public let decimalYear: Double
    public let outOfRange: Bool
  }

  /// عناصر الحقل المغناطيسي الأرضي عند موقع وزمن
  public static func field(lat: Double, lon: Double, altKm: Double = 0, decimalYear year: Double) -> Field {
    let outOfRange = !(year >= epoch && year <= validUntil)
    let dt = year - epoch
    var g = [Double](repeating: 0, count: G.count), h = g
    for i in 1..<G.count { g[i] = G[i] + dt * GDot[i]; h[i] = H[i] + dt * HDot[i] }
    var phi = lat
    if phi >= 90 { phi = 89.9999 } else if phi <= -90 { phi = -89.9999 }
    let lambda = norm180(lon)
    let cosLat = cos(phi * DEG), sinLat = sin(phi * DEG)
    let rc = wgsA / sqrt(1 - wgsEpsSq * sinLat * sinLat)
    let xp = (rc + altKm) * cosLat
    let zp = (rc * (1 - wgsEpsSq) + altKm) * sinLat
    let r = sqrt(xp * xp + zp * zp)
    let phig = asin(zp / r)
    let cosPhig = cos(phig)
    let cosLam = cos(lambda * DEG), sinLam = sin(lambda * DEG)
    var cosM = [Double](repeating: 0, count: nMax + 1), sinM = cosM
    cosM[0] = 1; sinM[0] = 0; cosM[1] = cosLam; sinM[1] = sinLam
    if nMax >= 2 { for m in 2...nMax { cosM[m] = cosM[m - 1] * cosLam - sinM[m - 1] * sinLam; sinM[m] = cosM[m - 1] * sinLam + sinM[m - 1] * cosLam } }
    let ratio = RE / r
    var rpow = [Double](repeating: 0, count: nMax + 1)
    rpow[0] = ratio * ratio
    for n in 1...nMax { rpow[n] = rpow[n - 1] * ratio }
    let (p, dp) = legendre(sin(phig), nMax)
    var bx = 0.0, by = 0.0, bz = 0.0
    for n in 1...nMax {
      for m in 0...n {
        let i = n * (n + 1) / 2 + m
        let gc = g[i] * cosM[m] + h[i] * sinM[m]
        bz -= rpow[n] * gc * Double(n + 1) * p[i]
        by += rpow[n] * (g[i] * sinM[m] - h[i] * cosM[m]) * Double(m) * p[i]
        bx -= rpow[n] * gc * dp[i]
      }
    }
    by = abs(cosPhig) > 1e-10 ? by / cosPhig : 0
    let psi = phig - phi * DEG
    let cosPsi = cos(psi), sinPsi = sin(psi)
    let x = bx * cosPsi - bz * sinPsi
    let z = bx * sinPsi + bz * cosPsi
    let y = by
    let hh = sqrt(x * x + y * y)
    let f = sqrt(hh * hh + z * z)
    let declination = atan2(y, x) / DEG
    let inclination = atan2(z, hh) / DEG
    var gridVariation: Double? = nil
    if lat >= 55 { gridVariation = norm180(declination - lambda) } else if lat <= -55 { gridVariation = norm180(declination + lambda) }
    return Field(x: x, y: y, z: z, h: hh, f: f, inclination: inclination, declination: declination, gridVariation: gridVariation, decimalYear: year, outOfRange: outOfRange)
  }
  public static func field(lat: Double, lon: Double, altKm: Double = 0, date: Date = Date()) -> Field { field(lat: lat, lon: lon, altKm: altKm, decimalYear: decimalYear(date)) }
  /// الانحراف المغناطيسي بالدرجات (موجب شرقًا)
  public static func declination(lat: Double, lon: Double, altKm: Double = 0, date: Date = Date()) -> Double { field(lat: lat, lon: lon, altKm: altKm, date: date).declination }
  public static func magneticToTrue(_ magneticHeading: Double, declination decl: Double) -> Double { norm360(magneticHeading + decl) }
  public static func trueToMagnetic(_ trueHeading: Double, declination decl: Double) -> Double { norm360(trueHeading - decl) }
}
