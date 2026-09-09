import Foundation

/// اتجاه القبلة: دائرة عظمى، وجيوديسية Vincenty على WGS-84، والتحقق بالشمس — مطابق لـ qibla.js
public enum Qibla {
  /// إحداثيات الكعبة المشرفة (مركز البناء)
  public static let kaaba = Coordinates(latitude: 21.4225241, longitude: 39.8261818)
  static let A = 6378137.0, F = 1 / 298.257223563
  static let B = A * (1 - F)

  /// اتجاه القبلة (دائرة عظمى) بالدرجات من الشمال الحقيقي باتجاه عقارب الساعة
  public static func spherical(latitude: Double, longitude: Double) -> Double {
    let φ1 = d2r(latitude), φ2 = d2r(kaaba.latitude), Δλ = d2r(kaaba.longitude - longitude)
    let y = sin(Δλ)
    let x = cos(φ1) * tan(φ2) - sin(φ1) * cos(Δλ)
    return unwindAngle(r2d(atan2(y, x)))
  }
  /// المسافة على الكرة (هافرساين) بالكيلومترات
  public static func distanceSphericalKm(lat1: Double, lon1: Double, lat2: Double = kaaba.latitude, lon2: Double = kaaba.longitude) -> Double {
    let R = 6371.0088
    let φ1 = d2r(lat1), φ2 = d2r(lat2), dφ = d2r(lat2 - lat1), dλ = d2r(lon2 - lon1)
    let a = pow(sin(dφ / 2), 2) + cos(φ1) * cos(φ2) * pow(sin(dλ / 2), 2)
    return 2 * R * asin(min(1, sqrt(a)))
  }

  public struct Vincenty: Sendable { public let distanceKm: Double; public let initialBearing: Double; public let finalBearing: Double; public let converged: Bool }
  /// حلّ Vincenty العكسي على مجسّم WGS-84
  public static func vincentyInverse(lat1: Double, lon1: Double, lat2: Double = kaaba.latitude, lon2: Double = kaaba.longitude) -> Vincenty {
    let φ1 = d2r(lat1), φ2 = d2r(lat2)
    let L = d2r(lon2 - lon1)
    let tanU1 = (1 - F) * tan(φ1), cosU1 = 1 / sqrt(1 + tanU1 * tanU1), sinU1 = tanU1 * cosU1
    let tanU2 = (1 - F) * tan(φ2), cosU2 = 1 / sqrt(1 + tanU2 * tanU2), sinU2 = tanU2 * cosU2
    var λ = L, λʹ = 0.0, iterations = 0
    var sinλ = 0.0, cosλ = 0.0, sinσ = 0.0, cosσ = 0.0, σ = 0.0, sinα = 0.0, cos2α = 0.0, cos2σm = 0.0, C = 0.0
    repeat {
      sinλ = sin(λ); cosλ = cos(λ)
      let sinSqσ = pow(cosU2 * sinλ, 2) + pow(cosU1 * sinU2 - sinU1 * cosU2 * cosλ, 2)
      sinσ = sqrt(sinSqσ)
      if sinσ == 0 { return Vincenty(distanceKm: 0, initialBearing: 0, finalBearing: 0, converged: true) }
      cosσ = sinU1 * sinU2 + cosU1 * cosU2 * cosλ
      σ = atan2(sinσ, cosσ)
      sinα = (cosU1 * cosU2 * sinλ) / sinσ
      cos2α = 1 - sinα * sinα
      cos2σm = cos2α != 0 ? cosσ - (2 * sinU1 * sinU2) / cos2α : 0
      C = (F / 16) * cos2α * (4 + F * (4 - 3 * cos2α))
      λʹ = λ
      λ = L + (1 - C) * F * sinα * (σ + C * sinσ * (cos2σm + C * cosσ * (-1 + 2 * cos2σm * cos2σm)))
      iterations += 1
    } while abs(λ - λʹ) > 1e-12 && iterations < 200
    let converged = iterations < 200
    if !converged {
      return Vincenty(distanceKm: distanceSphericalKm(lat1: lat1, lon1: lon1, lat2: lat2, lon2: lon2), initialBearing: spherical(latitude: lat1, longitude: lon1), finalBearing: .nan, converged: false)
    }
    let uSq = (cos2α * (A * A - B * B)) / (B * B)
    let Acoef = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)))
    let Bcoef = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)))
    let Δσ = Bcoef * sinσ * (cos2σm + (Bcoef / 4) * (cosσ * (-1 + 2 * cos2σm * cos2σm) - (Bcoef / 6) * cos2σm * (-3 + 4 * sinσ * sinσ) * (-3 + 4 * cos2σm * cos2σm)))
    let s = B * Acoef * (σ - Δσ)
    let α1 = atan2(cosU2 * sinλ, cosU1 * sinU2 - sinU1 * cosU2 * cosλ)
    let α2 = atan2(cosU1 * sinλ, -sinU1 * cosU2 + cosU1 * sinU2 * cosλ)
    return Vincenty(distanceKm: s / 1000, initialBearing: unwindAngle(r2d(α1)), finalBearing: unwindAngle(r2d(α2)), converged: true)
  }

  public struct Info: Sendable {
    /// الاتجاه الجيوديسي (الأدق)
    public let bearing: Double
    public let bearingSpherical: Double
    public let distanceKm: Double
    public let difference: Double
    public let compassPoint: String
    /// قرب النقطة المقابلة للكعبة: الاتجاه غير محدد عمليًا
    public let antipodal: Bool
  }
  /// معلومات القبلة الكاملة لموقع
  public static func info(latitude: Double, longitude: Double) -> Info {
    let sph = spherical(latitude: latitude, longitude: longitude)
    let v = vincentyInverse(lat1: latitude, lon1: longitude)
    let bearing = v.converged ? v.initialBearing : sph
    return Info(bearing: bearing, bearingSpherical: sph, distanceKm: v.distanceKm, difference: quadrantShiftAngle(bearing - sph),
                compassPoint: compassPointAr(bearing), antipodal: !v.converged || v.distanceKm > 19900)
  }
  /// هامش خطأ الاتجاه (درجات) الناتج عن عدم يقين الموقع
  public static func bearingUncertainty(distanceKm: Double, locationErrorM: Double) -> Double {
    let d = distanceKm * 1000, e = max(0, locationErrorM)
    if !(d > 0) || e >= d { return 180 }
    return r2d(asin(e / d))
  }
  static let pointsAr = ["شمال", "شمال شرق", "شرق", "جنوب شرق", "جنوب", "جنوب غرب", "غرب", "شمال غرب"]
  public static func compassPointAr(_ bearing: Double) -> String { pointsAr[Int((unwindAngle(bearing) / 45).rounded(.toNearestOrAwayFromZero)) % 8] }
  /// الفرق الموقّع بين اتجاهين (-180..180]: موجب = الهدف على يمين المرجع
  public static func signedDifference(target: Double, reference: Double) -> Double { quadrantShiftAngle(unwindAngle(target - reference)) }

  public struct SunMoments: Sendable { public let bearing: Double; public let sunAtQibla: Date?; public let shadowAtQibla: Date? }
  /// لحظات التحقق بالشمس خلال يوم مدني: الشمس في اتجاه القبلة، أو معاكسة لها فيشير الظل إلى القبلة
  public static func sunQiblaMoments(latitude: Double, longitude: Double, civil: CivilDate, tz: TimeZone) -> SunMoments {
    let bearing = info(latitude: latitude, longitude: longitude).bearing
    let start = civil.localMidnight(in: tz)
    func find(_ target: Double) -> Date? {
      var prev: Double? = nil; var prevT: Date? = nil
      var m = 0
      while m <= 1440 {
        let t = start.addingTimeInterval(Double(m) * 60)
        let p = Astro.sunPosition(at: t, latitude: latitude, longitude: longitude)
        let f = signedDifference(target: p.azimuth, reference: target)
        if let pv = prev, let pt = prevT, (f.sign != pv.sign) && f != 0 && pv != 0, abs(f - pv) < 180 {
          var lo = pt, hi = t, flo = pv
          for _ in 0..<25 {
            let mid = Date(timeIntervalSince1970: (lo.timeIntervalSince1970 + hi.timeIntervalSince1970) / 2)
            let fm = signedDifference(target: Astro.sunPosition(at: mid, latitude: latitude, longitude: longitude).azimuth, reference: target)
            if (fm.sign == flo.sign) { lo = mid; flo = fm } else { hi = mid }
          }
          let res = Date(timeIntervalSince1970: ((lo.timeIntervalSince1970 + hi.timeIntervalSince1970) / 2).rounded())
          let pr = Astro.sunPosition(at: res, latitude: latitude, longitude: longitude)
          if pr.altitude > 0 && pr.altitude < 85 && abs(signedDifference(target: pr.azimuth, reference: target)) < 0.5 { return res }
        }
        prev = f; prevT = t
        m += 2
      }
      return nil
    }
    return SunMoments(bearing: bearing, sunAtQibla: find(bearing), shadowAtQibla: find(unwindAngle(bearing + 180)))
  }

  public struct ZenithEvent: Sendable { public let time: Date; public let altitude: Double }
  /// حادثتا تعامد الشمس على الكعبة في سنة معيّنة (نحو 27/28 مايو و15/16 يوليو)
  public static func kaabaZenithEvents(year: Int) -> [ZenithEvent] {
    var events: [ZenithEvent] = []
    for (m1, d1, m2, d2) in [(5, 20, 6, 5), (7, 8, 7, 24)] {
      var best: ZenithEvent? = nil
      var jd = Astro.julianDay(year: year, month: m1, day: d1)
      let end = Astro.julianDay(year: year, month: m2, day: d2)
      while jd <= end {
        let civil = CivilDate(Date(timeIntervalSince1970: (jd - 2440587.5) * 86400), in: TimeZone(identifier: "UTC")!)
        let st = SolarTime(date: civil, coords: kaaba)
        let t = civil.utcMidnight.addingTimeInterval(st.transit * 3600)
        let alt = Astro.sunPosition(at: t, latitude: kaaba.latitude, longitude: kaaba.longitude).altitude
        if best == nil || alt > best!.altitude { best = ZenithEvent(time: t, altitude: alt) }
        jd += 1
      }
      if let best { events.append(best) }
    }
    return events
  }

  /// نقاط على قوس الدائرة العظمى من نقطة إلى أخرى — للرسم على الخريطة؛ n+1 نقطة [lat, lon]
  public static func greatCirclePoints(lat1: Double, lon1: Double, lat2: Double, lon2: Double, n: Int = 64) -> [(Double, Double)] {
    let d = Double.pi / 180
    func toVec(_ la: Double, _ lo: Double) -> (Double, Double, Double) { (cos(la * d) * cos(lo * d), cos(la * d) * sin(lo * d), sin(la * d)) }
    let a = toVec(lat1, lon1), b = toVec(lat2, lon2)
    let dot = max(-1, min(1, a.0 * b.0 + a.1 * b.1 + a.2 * b.2))
    let omega = acos(dot)
    if omega < 1e-7 { return [(lat1, lon1), (lat2, lon2)] }
    var pts: [(Double, Double)] = []
    for i in 0...n {
      let t = Double(i) / Double(n); let s1 = sin((1 - t) * omega) / sin(omega), s2 = sin(t * omega) / sin(omega)
      let x = s1 * a.0 + s2 * b.0, y = s1 * a.1 + s2 * b.1, z = s1 * a.2 + s2 * b.2
      pts.append((atan2(z, hypot(x, y)) / d, atan2(y, x) / d))
    }
    return pts
  }
}
