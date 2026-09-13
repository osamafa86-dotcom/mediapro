import Foundation
import CoreLocation
import UIKit
import Observation
import SakinahCore

/// الموقع (GPS أو مدينة مختارة دون اتصال) والبوصلة عبر CoreLocation؛ آخر موقع يُحفظ للعمل دون اتصال وقبل الإذن التالي
@Observable
final class LocationService: NSObject, CLLocationManagerDelegate {
  enum Mode: String { case gps, manual }
  private let manager = CLLocationManager()
  private let geocoder = CLGeocoder()
  private let defaults = UserDefaults.standard

  var mode: Mode
  var coordinate: CLLocationCoordinate2D?
  var accuracyMeters: Double = 0
  var placeName: String?
  var countryCode: String?
  var cityId: String?
  /// المنطقة الزمنية للموقع (مدينة مختارة) أو الجهاز
  var timeZoneId: String?
  var authorization: CLAuthorizationStatus = .notDetermined
  var heading: CLHeading?
  var headingAvailable: Bool { CLLocationManager.headingAvailable() }
  var errorMessage: String?
  var onLocationResolved: (() -> Void)?

  override init() {
    mode = Mode(rawValue: defaults.string(forKey: "loc.mode") ?? "") ?? .gps
    super.init()
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    manager.headingFilter = 1
    authorization = manager.authorizationStatus
    let lat = defaults.double(forKey: "loc.lat"), lon = defaults.double(forKey: "loc.lon")
    if lat != 0 || lon != 0 { coordinate = CLLocationCoordinate2D(latitude: lat, longitude: lon); accuracyMeters = defaults.double(forKey: "loc.acc") }
    placeName = defaults.string(forKey: "loc.name")
    countryCode = defaults.string(forKey: "loc.cc")
    cityId = defaults.string(forKey: "loc.city")
    timeZoneId = defaults.string(forKey: "loc.tz")
  }

  var hasLocation: Bool { coordinate != nil }
  var timeZone: TimeZone { (mode == .manual ? timeZoneId.flatMap { TimeZone(identifier: $0) } : nil) ?? .current }

  private func persist() {
    defaults.set(mode.rawValue, forKey: "loc.mode")
    if let c = coordinate { defaults.set(c.latitude, forKey: "loc.lat"); defaults.set(c.longitude, forKey: "loc.lon") }
    defaults.set(accuracyMeters, forKey: "loc.acc"); defaults.set(placeName, forKey: "loc.name"); defaults.set(countryCode, forKey: "loc.cc")
    defaults.set(cityId, forKey: "loc.city"); defaults.set(timeZoneId, forKey: "loc.tz")
  }

  /// مدينة من القاعدة دون اتصال
  func useCity(_ c: City) {
    mode = .manual; coordinate = CLLocationCoordinate2D(latitude: c.lat, longitude: c.lon); accuracyMeters = 0
    placeName = c.nameAr; countryCode = c.countryCode; cityId = c.id; timeZoneId = c.tz; errorMessage = nil
    persist(); onLocationResolved?()
  }
  func useDeviceLocation() { mode = .gps; cityId = nil; timeZoneId = nil; persist(); requestLocation() }

  func requestLocation() {
    errorMessage = nil
    switch manager.authorizationStatus {
    case .notDetermined: manager.requestWhenInUseAuthorization()
    case .denied, .restricted: errorMessage = "إذن الموقع مرفوض — فعّله من إعدادات النظام للتطبيق، أو اختر مدينتك يدويًا"
    default: manager.requestLocation()
    }
  }

  func startHeading() {
    guard CLLocationManager.headingAvailable() else { return }
    syncHeadingOrientation()
    manager.startUpdatingHeading()
  }
  func stopHeading() { manager.stopUpdatingHeading() }

  /// مرجعُ قراءة البوصلة هو اتجاه الجهاز، وافتراضه دائمًا «رأسي». فإن دارت الواجهة (والآيباد
  /// يدور) ولم يدُر المرجع معها، انحرفت قراءة الاتجاه تسعين درجة — والقبلة معها.
  ///
  /// ومَزلقٌ في UIKit: landscapeLeft في اصطلاح الواجهة هو landscapeRight في اصطلاح الجهاز
  /// (هكذا عُرِّفا في UIInterfaceOrientation نفسها)، وCLDeviceOrientation يتبع اصطلاح الجهاز.
  /// فالترجمة الساذجة تقلب الاتجاه بدل أن تصحّحه.
  func syncHeadingOrientation() {
    let interface = UIApplication.shared.connectedScenes
      .compactMap { ($0 as? UIWindowScene)?.interfaceOrientation }
      .first ?? .portrait
    let device: CLDeviceOrientation
    switch interface {
    case .portraitUpsideDown: device = .portraitUpsideDown
    case .landscapeLeft: device = .landscapeRight
    case .landscapeRight: device = .landscapeLeft
    default: device = .portrait
    }
    if manager.headingOrientation != device { manager.headingOrientation = device }
  }

  // MARK: - CLLocationManagerDelegate (تصل على الخيط الرئيسي)
  func locationManagerDidChangeAuthorization(_ m: CLLocationManager) {
    authorization = m.authorizationStatus
    if mode == .gps, authorization == .authorizedWhenInUse || authorization == .authorizedAlways { m.requestLocation() }
  }

  func locationManager(_ m: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard mode == .gps, let loc = locations.last else { return }
    coordinate = loc.coordinate
    accuracyMeters = loc.horizontalAccuracy
    persist()
    Task { await self.reverseGeocode(loc) }
  }

  func locationManager(_ m: CLLocationManager, didFailWithError error: Error) {
    if coordinate == nil { errorMessage = "تعذّر تحديد الموقع — حاول مجددًا أو اختر مدينتك يدويًا" }
  }

  func locationManager(_ m: CLLocationManager, didUpdateHeading newHeading: CLHeading) { heading = newHeading }
  func locationManagerShouldDisplayHeadingCalibration(_ m: CLLocationManager) -> Bool { true }

  private func reverseGeocode(_ loc: CLLocation) async {
    let placemark = try? await geocoder.reverseGeocodeLocation(loc).first
    await MainActor.run {
      if let p = placemark {
        placeName = [p.locality, p.administrativeArea, p.country].compactMap { $0 }.first ?? p.name
        countryCode = p.isoCountryCode
      } else if let near = CityDatabase.bundled.nearest(lat: loc.coordinate.latitude, lon: loc.coordinate.longitude) {
        placeName = "قرب \(near.city.nameAr)"; countryCode = near.city.countryCode
      }
      persist()
      onLocationResolved?()
    }
  }
}
