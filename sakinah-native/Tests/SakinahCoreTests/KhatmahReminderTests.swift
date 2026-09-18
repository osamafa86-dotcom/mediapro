import XCTest
@testable import SakinahCore

final class KhatmahReminderTests: XCTestCase {
  func testAfterPrayerParsing() {
    XCTAssertEqual(Reminders.afterPrayer("after:isha"), .isha)
    XCTAssertEqual(Reminders.afterPrayer("after:fajr"), .fajr)
    XCTAssertNil(Reminders.afterPrayer("09:00"))
    XCTAssertNil(Reminders.afterPrayer("after:noon"))
    XCTAssertNil(Reminders.afterPrayer(nil))
  }
  /// الوقت الثابت يذهب إلى التذكير اليومي المتكرر، و«بعد صلاة» لا يُنتج تذكيرًا يوميًا ثابتًا
  func testDailyIgnoresAfterPrayer() {
    let fixed = KhatmahPlan(startPage: 1, startedAt: "2026-09-18", days: 30, reminder: "21:30")
    let after = KhatmahPlan(startPage: 1, startedAt: "2026-09-18", days: 30, reminder: "after:isha")
    XCTAssertEqual(Reminders.daily(prefs: ExtraReminderPrefs(), khatmah: fixed).map(\.id), ["daily:khatmah"])
    XCTAssertTrue(Reminders.daily(prefs: ExtraReminderPrefs(), khatmah: after).isEmpty)
  }
  func testAfterPrayerRemindersFollowTheTimetable() {
    let plan = KhatmahPlan(startPage: 1, startedAt: "2026-09-18", days: 30, reminder: "after:isha")
    let tz = TimeZone(identifier: "Asia/Amman")!
    var params = PrayerParams(); params.tz = tz.identifier
    let coords = Coordinates(latitude: 31.95, longitude: 35.93)
    let now = Date(timeIntervalSince1970: 1_789_000_000)
    let items = Reminders.khatmahAfterPrayer(coords: coords, tz: tz, params: params, plan: plan, now: now, days: 3)
    XCTAssertEqual(items.count, 3)
    XCTAssertTrue(items.allSatisfy { $0.kind == .khatmah && $0.prayer == .isha && $0.time > now })
    XCTAssertTrue(items.map(\.time) == items.map(\.time).sorted())
    XCTAssertTrue(Reminders.khatmahAfterPrayer(coords: coords, tz: tz, params: params, plan: nil, now: now).isEmpty)
  }
}
