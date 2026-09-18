import XCTest
@testable import SakinahCore

/// الورد بتقدّم الموضع، الالتزام، الأوراد المسنونة، وأوائل الأجزاء — الأرقام نفسها في WirdTest.kt
final class WirdTests: XCTestCase {
  func testWirdAdvancesOnlyContiguously() {
    var log: WirdLog = [:]
    log = Wird.mark(log, today: "2026-09-18", page: 1, startPage: 1)
    log = Wird.mark(log, today: "2026-09-18", page: 2, startPage: 1)
    log = Wird.mark(log, today: "2026-09-18", page: 3, startPage: 1)
    XCTAssertEqual(Wird.done(log), 3)
    // قفزة إلى الكهف لا تُحتسب
    log = Wird.mark(log, today: "2026-09-18", page: 293, startPage: 1)
    XCTAssertEqual(Wird.done(log), 3)
    // العودة والمتابعة تُحتسب
    log = Wird.mark(log, today: "2026-09-19", page: 4, startPage: 1)
    log = Wird.mark(log, today: "2026-09-19", page: 7, startPage: 1)   // قفزة ٣ مسموحة
    XCTAssertEqual(Wird.pages(log, day: "2026-09-18"), 3)
    XCTAssertEqual(Wird.pages(log, day: "2026-09-19"), 4)
    // الرجوع للخلف لا ينقص
    log = Wird.mark(log, today: "2026-09-19", page: 2, startPage: 1)
    XCTAssertEqual(Wird.done(log), 7)
  }
  func testWirdWrapsAroundFromMidMushaf() {
    var log: WirdLog = [:]
    log = Wird.mark(log, today: "d1", page: 603, startPage: 603)
    log = Wird.mark(log, today: "d1", page: 604, startPage: 603)
    log = Wird.mark(log, today: "d1", page: 1, startPage: 603)
    XCTAssertEqual(Wird.done(log), 3)
  }
  func testCommitmentCountsDaysReachingTarget() {
    var log: WirdLog = [:]
    for i in 0..<14 {
      let day = DayKey.adding("2026-09-18", days: -(13 - i))
      let pages = i % 4 == 3 ? 2 : 5
      for _ in 0..<pages { log = Wird.mark(log, today: day, page: Wird.done(log) + 1, startPage: 1) }
    }
    let c = Wird.commitment(log, today: "2026-09-18", target: 5, days: 14)
    XCTAssertEqual(c.total, 14); XCTAssertEqual(c.done, 11); XCTAssertEqual(c.days.count, 14); XCTAssertFalse(c.days[3]); XCTAssertTrue(c.days[13])
  }
  func testKhatmahStatusFromWird() {
    var log: WirdLog = [:]
    for p in 1...42 { log = Wird.mark(log, today: p <= 21 ? "2026-09-17" : "2026-09-18", page: p, startPage: 1) }
    let plan = KhatmahPlan(startPage: 1, startedAt: "2026-09-17", days: 30)
    let s = Khatmah.status(plan, wird: log, today: "2026-09-18")
    XCTAssertEqual(s.done, 42); XCTAssertEqual(s.todayPages, 21); XCTAssertEqual(s.behind, 0); XCTAssertEqual(s.percent, 7)
    XCTAssertEqual(Khatmah.days(forUnit: "hizb"), 60); XCTAssertEqual(Khatmah.days(forUnit: "juz"), 30)
  }
  func testKahfWindow() {
    XCTAssertEqual(Awrad.kahfDays(today: "2026-09-17", weekdayIndex: 4, maghribPassed: true), ["2026-09-17", "2026-09-18"])
    XCTAssertNil(Awrad.kahfDays(today: "2026-09-17", weekdayIndex: 4, maghribPassed: false))
    XCTAssertEqual(Awrad.kahfDays(today: "2026-09-18", weekdayIndex: 5, maghribPassed: false), ["2026-09-17", "2026-09-18"])
    XCTAssertNil(Awrad.kahfDays(today: "2026-09-18", weekdayIndex: 5, maghribPassed: true))
    let kahf = Awrad.wird("kahf")!
    let log: ReadLog = ["2026-09-17": [293, 294, 295], "2026-09-18": [296, 100]]
    let p = Awrad.progress(kahf, log: log, days: ["2026-09-17", "2026-09-18"])
    XCTAssertEqual(p.done, 4); XCTAssertEqual(p.total, 12)
    XCTAssertEqual(Awrad.wird("mulk")?.reminderAfter, .isha)
  }
  func testJuzStartPhrasesComeFromTheCorpus() {
    let q = QuranText.shared
    XCTAssertEqual(q.juzStartPhrase(1), "الفاتحة")
    XCTAssertEqual(q.juzStartPhrase(4), "كُلُّ ٱلطَّعَامِ")
    XCTAssertEqual(q.juzStartPhrase(20), "فَمَا كَانَ")
    XCTAssertEqual(q.juzStartPhrase(30), "عَمَّ يَتَسَآءَلُونَ")
    XCTAssertFalse(q.juzStartPhrase(2).contains("۞"))
    XCTAssertEqual(q.quarterStart(1)?.page, 1)
    XCTAssertEqual(q.quarters(ofHizb: 27).count, 4)
    XCTAssertEqual(q.quarters(ofHizb: 27).first?.page, QuranText.shared.hizbStartPage(27))
  }
}
