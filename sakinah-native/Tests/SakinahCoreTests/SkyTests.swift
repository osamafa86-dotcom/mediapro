import XCTest
@testable import SakinahCore

/// محرّك السماء: الأطوار من المواقيت، نوافذ الانتقال، طبقات الطقس، والتفضيلات — الأرقام نفسها في Sky.kt
final class SkyTests: XCTestCase {
  private let tz = TimeZone(identifier: "Europe/Istanbul")!
  private func at(_ h: Int, _ m: Int, day: Int = 18) -> Date {
    var c = DateComponents(); c.year = 2026; c.month = 9; c.day = day; c.hour = h; c.minute = m
    var cal = Calendar(identifier: .gregorian); cal.timeZone = tz
    return cal.date(from: c)!
  }
  private var inputs: SkyInputs {
    SkyInputs(fajr: at(5, 14), sunrise: at(6, 40), dhuhr: at(13, 3), asr: at(16, 30), maghrib: at(19, 15), isha: at(20, 36),
              prevIsha: at(20, 38, day: 17), nextFajr: at(5, 15, day: 19), tz: tz)
  }
  private func phaseAt(_ h: Int, _ m: Int, day: Int = 18) -> (phase: SkyPhase, blendTo: SkyPhase?, t: Double) { SkyEngine.phase(at: at(h, m, day: day), inputs: inputs) }

  func testPhasesFollowThePrayerDay() {
    XCTAssertEqual(phaseAt(1, 0).phase, .night)
    XCTAssertEqual(phaseAt(3, 0).phase, .sahar)
    XCTAssertEqual(phaseAt(5, 30).phase, .fajr)
    XCTAssertEqual(phaseAt(7, 0).phase, .sunrise)
    XCTAssertEqual(phaseAt(9, 0).phase, .duha)
    XCTAssertEqual(phaseAt(14, 0).phase, .dhuhr)
    XCTAssertEqual(phaseAt(17, 30).phase, .asr)
    XCTAssertEqual(phaseAt(18, 50).phase, .ghurub)
    XCTAssertEqual(phaseAt(20, 0).phase, .shafaq)
    XCTAssertEqual(phaseAt(23, 0).phase, .night)
    XCTAssertEqual(phaseAt(3, 30, day: 19).phase, .sahar)
  }

  func testBlendWindowIsTwentyMinutesAroundEachBoundary() {
    let r1 = phaseAt(19, 5)
    XCTAssertEqual(r1.phase, .ghurub); XCTAssertEqual(r1.blendTo, .shafaq); XCTAssertEqual(r1.t, 0, accuracy: 1e-9)
    let r2 = phaseAt(19, 15)
    XCTAssertEqual(r2.phase, .ghurub); XCTAssertEqual(r2.blendTo, .shafaq); XCTAssertEqual(r2.t, 0.5, accuracy: 1e-9)
    XCTAssertEqual(SkyEngine.state(at: at(19, 15), inputs: inputs, prefs: .default, weather: nil).dominant, .shafaq)
    let r3 = phaseAt(19, 24)
    XCTAssertEqual(r3.blendTo, .shafaq); XCTAssertTrue(r3.t > 0.9 && r3.t < 1.0)
    let r4 = phaseAt(19, 40)
    XCTAssertEqual(r4.phase, .shafaq); XCTAssertNil(r4.blendTo)
  }

  func testBlendedPaletteInterpolatesAndSwitchesInkAtMidpoint() {
    let a = SkyPalette.of(.asr), b = SkyPalette.of(.ghurub)
    let mid = a.blended(with: b, t: 0.5)
    XCTAssertEqual(mid.stops.count, 4)
    XCTAssertEqual(mid.stops[0].r, (a.stops[0].r + b.stops[0].r) / 2, accuracy: 1e-9)
    XCTAssertEqual(a.blended(with: b, t: 0.49).ink, .ink); XCTAssertEqual(mid.ink, .paper)
    XCTAssertEqual(a.blended(with: b, t: 0), a); XCTAssertEqual(a.blended(with: b, t: 1).stops, b.stops)
  }

  func testPalettesHaveFourStopsAndFigmaHexes() {
    for p in SkyPhase.allCases { XCTAssertEqual(SkyPalette.of(p).stops.count, 4, p.rawValue) }
    XCTAssertEqual(SkyPalette.of(.shafaq).stops[0].hex, 0x04181A)
    XCTAssertEqual(SkyPalette.of(.shafaq).stops[3].hex, 0x0E5C55)
    XCTAssertEqual(SkyPalette.of(.sahar).stops[3].hex, 0xD98B58)
    XCTAssertEqual(SkyPalette.of(.duha).ink, .ink); XCTAssertEqual(SkyPalette.of(.dhuhr).ink, .paper)
  }

  func testWeatherMappingFromWmoCodes() {
    XCTAssertEqual(SkyWeather.from(wmo: 0, cloudCover: 10), .clear)
    XCTAssertEqual(SkyWeather.from(wmo: 2, cloudCover: 40), .partlyCloudy)
    XCTAssertEqual(SkyWeather.from(wmo: 2, cloudCover: 90), .overcast)
    XCTAssertEqual(SkyWeather.from(wmo: 3, cloudCover: 100), .overcast); XCTAssertEqual(SkyWeather.from(wmo: 45, cloudCover: 0), .overcast)
    XCTAssertEqual(SkyWeather.from(wmo: 61, cloudCover: 100), .rain); XCTAssertEqual(SkyWeather.from(wmo: 95, cloudCover: 100), .rain); XCTAssertEqual(SkyWeather.from(wmo: 80, cloudCover: 60), .rain)
    XCTAssertEqual(SkyWeather.from(wmo: 73, cloudCover: 100), .snow); XCTAssertEqual(SkyWeather.from(wmo: 86, cloudCover: 100), .snow)
    XCTAssertEqual(SkyWeather.from(wmo: 0, cloudCover: 10, dust: 220), .dust)
  }

  func testWeatherLayersDarkenOrTintButNeverChangeClearSkies() {
    let noon = SkyPalette.of(.dhuhr)
    XCTAssertEqual(noon.weathered(.clear), noon); XCTAssertEqual(noon.weathered(.partlyCloudy), noon)
    XCTAssertLessThan(noon.weathered(.overcast).stops[0].luminance, noon.stops[0].luminance)
    XCTAssertLessThan(noon.weathered(.rain).stops[0].luminance, noon.weathered(.overcast).stops[0].luminance)
    XCTAssertEqual(SkyPalette.of(.duha).weathered(.rain).ink, .paper)
    XCTAssertGreaterThan(noon.weathered(.snow).stops[3].luminance, noon.stops[3].luminance)
    XCTAssertGreaterThan(noon.weathered(.dust).stops[1].r, noon.stops[1].r)
  }

  func testPrefsOverrideTheClock() {
    let fixed = SkyEngine.state(at: at(14, 0), inputs: inputs, prefs: SkyPrefs(mode: .fixed, fixedPhase: .night), weather: .rain)
    XCTAssertEqual(fixed.phase, .night); XCTAssertEqual(fixed.weather, .clear); XCTAssertEqual(fixed.palette, SkyPalette.of(.night))
    let custom = SkyEngine.state(at: at(14, 0), inputs: inputs, prefs: SkyPrefs(mode: .custom, accent: .rose), weather: nil)
    XCTAssertEqual(custom.palette.stops[2].hex, SkyAccent.rose.hex); XCTAssertEqual(custom.palette.ink, .paper)
    XCTAssertEqual(SkyEngine.state(at: at(14, 0), inputs: inputs, prefs: SkyPrefs(weather: false), weather: .rain).weather, .clear)
    let autoWeather = SkyEngine.state(at: at(14, 0), inputs: inputs, prefs: SkyPrefs(weather: true), weather: .rain)
    XCTAssertEqual(autoWeather.weather, .rain); XCTAssertEqual(autoWeather.phase, .dhuhr)
  }

  func testPolarFallbackUsesTheClock() {
    let polar = SkyInputs(fajr: nil, sunrise: nil, dhuhr: nil, asr: nil, maghrib: nil, isha: nil, tz: tz)
    XCTAssertEqual(SkyEngine.phase(at: at(9, 0), inputs: polar).phase, .duha)
    XCTAssertEqual(SkyEngine.phase(at: at(23, 30), inputs: polar).phase, .night)
  }

  func testRGBRoundTripsHex() { XCTAssertEqual(SkyRGB(hex: 0x9A4E5E).hex, 0x9A4E5E); XCTAssertEqual(SkyRGB(r: 1, g: 1, b: 1).hex, 0xFFFFFF) }

  func testPrefsRoundTripJSON() throws {
    let p = SkyPrefs(mode: .fixed, fixedPhase: .ghurub, accent: .copper, weather: true, reduceMotion: true)
    let data = try JSONEncoder().encode(p)
    XCTAssertEqual(try JSONDecoder().decode(SkyPrefs.self, from: data), p)
  }
}
