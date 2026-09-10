import XCTest
@testable import SakinahCore

final class Phase2Tests: XCTestCase {
  func testCityDatabaseLoadsAndSearches() {
    let db = CityDatabase.bundled
    XCTAssertGreaterThan(db.cities.count, 600)
    XCTAssertGreaterThan(db.countries.count, 100)
    let amman = db.search("عمّان")
    XCTAssertEqual(amman.first?.countryCode, "JO", "\(amman.prefix(3).map(\.nameAr))")
    XCTAssertEqual(db.search("Makkah").first?.countryCode, "SA")
    XCTAssertEqual(db.search("القاهره").first?.id, db.search("القاهرة").first?.id)
    XCTAssertTrue(db.search("الاردن").allSatisfy { $0.countryCode == "JO" })
    XCTAssertEqual(db.search("").count, 30)
    XCTAssertEqual(CityDatabase.normalize("أُمُّ القُرى"), "ام القري")
    let near = db.nearest(lat: 31.95, lon: 35.91)
    XCTAssertEqual(near?.city.countryCode, "JO"); XCTAssertLessThan(near?.km ?? 999, 30)
    XCTAssertNotNil(TimeZone(identifier: db.cities[0].tz))
    for c in db.cities { XCTAssertNotNil(TimeZone(identifier: c.tz), c.id) }
  }

  func testRemindersBuildAndUpcoming() {
    let tz = TimeZone(identifier: "Asia/Amman")!
    var prefs = ReminderPrefs(); prefs.enabled = true; prefs.preMinutes = 10; prefs.prayers.insert(.sunrise)
    var params = PrayerParams(); params.method = "Jordan"
    let coords = Coordinates(latitude: 31.9539, longitude: 35.9106)
    let now = Date(timeIntervalSince1970: 1_788_912_000) // 2026-09-09T00:00Z
    let day = PrayerTimes.compute(coords: coords, date: CivilDate(now, in: tz), params: params)
    let items = Reminders.build(times: day, prefs: prefs, dateKey: "2026-9-9", format: { _ in "5:00" })
    XCTAssertEqual(items.count, 11) // 5 صلوات × (أذان + قبل) + الشروق
    XCTAssertEqual(items.filter { $0.kind == .pre }.count, 5)
    XCTAssertTrue(items.contains { $0.kind == .sunrise && $0.title == "طلوع الشمس" })
    XCTAssertTrue(items.contains { $0.title == "حان الآن موعد صلاة الفجر" && $0.id == "2026-9-9:fajr" })
    let pre = items.first { $0.id == "2026-9-9:fajr:pre" }!
    XCTAssertEqual(pre.time, day.fajr!.addingTimeInterval(-600))
    XCTAssertEqual(pre.body, "بقي 10 دقيقة على الأذان (5:00)")

    let up = Reminders.upcoming(coords: coords, tz: tz, params: params, prefs: prefs, now: now, max: 60, format: { _ in "" })
    XCTAssertEqual(up.count, 60)
    XCTAssertTrue(zip(up, up.dropFirst()).allSatisfy { $0.time <= $1.time })
    XCTAssertEqual(Set(up.map(\.id)).count, 60)
    XCTAssertEqual(Set(up.map(Reminders.numericId)).count, 60)
    XCTAssertTrue(up.allSatisfy { $0.time > now })
    prefs.enabled = false
    XCTAssertTrue(Reminders.upcoming(coords: coords, tz: tz, params: params, prefs: prefs, now: now, format: { _ in "" }).isEmpty)
  }

  func testICS() {
    let tz = TimeZone(identifier: "Asia/Riyadh")!
    let coords = Coordinates(latitude: 21.4225, longitude: 39.8262)
    var params = PrayerParams(); params.method = "UmmAlQura"; params.tz = tz.identifier
    let days = PrayerTimes.monthTable(coords: coords, year: 2026, month: 9, params: params)
    var opts = ICS.Options(); opts.locationName = "مكة"; opts.preMinutes = 5
    let ics = ICS.build(days: days, options: opts, now: Date(timeIntervalSince1970: 1_788_912_000))
    XCTAssertTrue(ics.hasPrefix("BEGIN:VCALENDAR\r\nVERSION:2.0"))
    XCTAssertTrue(ics.hasSuffix("END:VCALENDAR\r\n"))
    XCTAssertEqual(ics.components(separatedBy: "BEGIN:VEVENT").count - 1, 30 * 5)
    XCTAssertTrue(ics.contains("SUMMARY:صلاة الفجر"))
    XCTAssertTrue(ics.contains("TRIGGER:-PT5M"))
    XCTAssertTrue(ics.contains("DTSTAMP:20260909T000000Z"))
    for line in ics.components(separatedBy: "\r\n") { XCTAssertLessThanOrEqual(line.utf8.count, 75, line) }
    XCTAssertEqual(ICS.escape("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne")
  }
}
