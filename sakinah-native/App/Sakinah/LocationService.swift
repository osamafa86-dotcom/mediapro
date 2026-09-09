import Foundation
import CoreLocation
import Observation

/// الموقع والبوصلة عبر CoreLocation؛ آخر موقع يُحفظ للعمل دون اتصال وقبل الإذن التالي
@Observable
final class LocationService: NSObject, CLLocationManagerDelegate {
  private let manager = CLLocationManager()
  private let geocoder = CLGeocoder()
  private let defaults = UserDefaults.standard

  var coordinate: CLLocationCoordinate2D?
  var accuracyMeters: Double = 0
  var placeName: String?
  var countryCode: String?
  var authorization: CLAuthorizationStatus = .notDetermined
  var heading: CLHeading?
  var headingAvailable: Bool { CLLocationManager.headingAvailable() }
  var errorMessage: String?
  var onLocationResolved: (() -> Void)?

  override init() {
    super.init()
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    manager.headingFilter = 1
    authorization = manager.authorizationStatus
    let lat = defaults.double(forKey: "loc.lat"), lon = defaults.double(forKey: "loc.lon")
    if lat != 0 || lon != 0 { coordinate = CLLocationCoordinate2D(latitude: lat, longitude: lon); accuracyMeters = defaults.double(forKey: "loc.acc") }
    placeName = defaults.string(forKey: "loc.name")
    countryCode = defaults.string(forKey: "loc.cc")
  }

  var hasLocation: Bool { coordinate != nil }

  func requestLocation() {
    errorMessage = nil
    switch manager.authorizationStatus {
    case .notDetermined: manager.requestWhenInUseAuthorization()
    case .denied, .restricted: errorMessage = "إذن الموقع مرفوض — فعّله من إعدادات النظام للتطبيق"
    default: manager.requestLocation()
    }
  }

  func startHeading() { if CLLocationManager.headingAvailable() { manager.startUpdatingHeading() } }
  func stopHeading() { manager.stopUpdatingHeading() }

  // MARK: - CLLocationManagerDelegate (تصل على الخيط الرئيسي)
  func locationManagerDidChangeAuthorization(_ m: CLLocationManager) {
    authorization = m.authorizationStatus
    if authorization == .authorizedWhenInUse || authorization == .authorizedAlways { m.requestLocation() }
  }

  func locationManager(_ m: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let loc = locations.last else { return }
    coordinate = loc.coordinate
    accuracyMeters = loc.horizontalAccuracy
    defaults.set(loc.coordinate.latitude, forKey: "loc.lat"); defaults.set(loc.coordinate.longitude, forKey: "loc.lon"); defaults.set(loc.horizontalAccuracy, forKey: "loc.acc")
    Task { await self.reverseGeocode(loc) }
  }

  func locationManager(_ m: CLLocationManager, didFailWithError error: Error) {
    if coordinate == nil { errorMessage = "تعذّر تحديد الموقع — حاول مجددًا أو تأكد من تشغيل خدمات الموقع" }
  }

  func locationManager(_ m: CLLocationManager, didUpdateHeading newHeading: CLHeading) { heading = newHeading }
  func locationManagerShouldDisplayHeadingCalibration(_ m: CLLocationManager) -> Bool { true }

  private func reverseGeocode(_ loc: CLLocation) async {
    guard let p = try? await geocoder.reverseGeocodeLocation(loc).first else { return }
    let name = [p.locality, p.administrativeArea, p.country].compactMap { $0 }.first ?? p.name
    await MainActor.run {
      placeName = name
      countryCode = p.isoCountryCode
      defaults.set(name, forKey: "loc.name"); defaults.set(p.isoCountryCode, forKey: "loc.cc")
      onLocationResolved?()
    }
  }
}
