import XCTest

/// اختبار واجهةٍ حقيقي لقسم المصحف: نقراتٌ فعلية على المحاكي لا تغييرُ حالةٍ برمجي
/// (لقطات `-sakinahShot` تُظهر الشاشة لكنها لا تثبت أن النقر يصل إلى الزرّ).
///
/// يُشغَّل في سير لقطات wilt بعد بناء المحاكي: `xcodebuild test -only-testing:SakinahUITests`.
/// اللقطات تُكتب إلى المجلد الذي يسمّيه المتغيّر `SHOT_DIR` (يُمرَّر بـ `TEST_RUNNER_SHOT_DIR`) لتُرفع مع الأثر.
final class MushafUITests: XCTestCase {
  override func setUpWithError() throws {
    continueAfterFailure = false
    // أيّ تنبيه نظام (إذن إشعارات أو موقع) يُغلَق بأوّل زرّ كي لا يحجب الشاشة
    addUIInterruptionMonitor(withDescription: "system alert") { alert in
      let b = alert.buttons.firstMatch
      if b.exists { b.tap(); return true }
      return false
    }
  }

  // MARK: أدوات
  private func launch(_ route: String) -> XCUIApplication {
    let app = XCUIApplication()
    app.launchArguments = ["-sakinahShot", route, "-AppleLanguages", "(ar)", "-AppleLocale", "ar_JO"]
    app.launch()
    return app
  }
  /// أيّ عنصر تحتوي تسميته النصّ (الصفوف قد تُدمَج عناصرها في زرّ واحد فلا تبقى staticText مستقلة)
  private func any(_ app: XCUIApplication, containing text: String) -> XCUIElement {
    app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
  }
  private func snap(_ name: String) {
    let shot = XCUIScreen.main.screenshot()
    let att = XCTAttachment(screenshot: shot); att.name = name; att.lifetime = .keepAlways; add(att)
    guard let dir = ProcessInfo.processInfo.environment["SHOT_DIR"], !dir.isEmpty else { return }
    try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
    try? shot.pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
  }
  private func arabicDigits(_ s: String) -> String {
    String(s.map { c -> Character in
      guard let d = c.wholeNumberValue, c.isASCII else { return c }
      return Character(UnicodeScalar(0x0660 + d)!)
    })
  }

  // MARK: ١ — مقسّم الفهرس يستجيب للنقر (السور → الأجزاء → الأحزاب → العلامات → السور)
  func test1_librarySegmentsRespondToTaps() {
    let app = launch("mushaf")
    let juzTab = app.buttons["الأجزاء"]
    XCTAssertTrue(juzTab.waitForExistence(timeout: 25), "مقسّم الفهرس لم يظهر")
    XCTAssertTrue(any(app, containing: "الفاتحة").waitForExistence(timeout: 10), "صفوف السور لم تظهر في البداية")
    snap("ui-00-library")

    juzTab.tap()
    XCTAssertTrue(any(app, containing: "الجزء الأول").waitForExistence(timeout: 6), "نقر «الأجزاء» لم يعرض صفوف الأجزاء")
    XCTAssertTrue(juzTab.isSelected, "نقر «الأجزاء» لم ينقل التحديد إليه")
    snap("ui-01-juz")

    app.buttons["الأحزاب"].tap()
    XCTAssertTrue(any(app, containing: "الحزب ١").waitForExistence(timeout: 6), "نقر «الأحزاب» لم يعرض صفوف الأحزاب")
    snap("ui-02-hizb")

    app.buttons["العلامات"].tap()
    XCTAssertTrue(any(app, containing: "لا علامات بعد").waitForExistence(timeout: 6), "نقر «العلامات» لم يعرض تبويب العلامات")
    snap("ui-03-bookmarks-empty")

    app.buttons["السور"].tap()
    XCTAssertTrue(any(app, containing: "الفاتحة").waitForExistence(timeout: 6), "العودة إلى «السور» لم تعرض صفوف السور")
  }

  // MARK: ٢ — علامة من رصيف الآية (نقر كلمة → «علامة» → «حفظ العلامة») ثم تظهر في تبويب «العلامات»
  func test2_bookmarkSavedFromReaderAppearsInLibrary() {
    let app = launch("mushaf-page")
    let page = app.descendants(matching: .any)["صفحة ٢٧٠"]
    XCTAssertTrue(page.waitForExistence(timeout: 25), "صفحة المصحف لم تظهر")
    sleep(3) // خطّ الصفحة يُحمَّل عند أوّل ظهور

    // نقر كلمة من الصفحة (المسار نفسه الذي يسلكه المستخدم عند الضغط على رقم الآية)
    var dockShown = false
    for (dx, dy) in [(0.5, 0.42), (0.42, 0.5), (0.58, 0.58), (0.5, 0.3)] {
      page.coordinate(withNormalizedOffset: CGVector(dx: dx, dy: dy)).tap()
      if app.buttons["علامة"].waitForExistence(timeout: 3) || app.buttons["معلَّمة"].exists { dockShown = true; break }
    }
    XCTAssertTrue(dockShown, "نقر كلمة في الصفحة لم يُظهر رصيف الآية")
    snap("ui-04-dock")

    (app.buttons["علامة"].exists ? app.buttons["علامة"] : app.buttons["معلَّمة"]).tap()
    let save = app.buttons.matching(NSPredicate(format: "label IN %@", ["حفظ العلامة", "تحديث العلامة"])).firstMatch
    XCTAssertTrue(save.waitForExistence(timeout: 6), "ورقة العلامة لم تُفتح من الرصيف")
    // عنوان الورقة «علامة — النحل: 27» → صفّ المكتبة «النحل: ٢٧»
    let titleEl = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "علامة — ")).firstMatch
    XCTAssertTrue(titleEl.waitForExistence(timeout: 4), "عنوان ورقة العلامة لم يظهر")
    let title = titleEl.label
    let ref = String(title.dropFirst("علامة — ".count))
    let expectedRow = arabicDigits(ref)
    snap("ui-05-bookmark-sheet")
    save.tap()
    XCTAssertTrue(app.buttons["معلَّمة"].waitForExistence(timeout: 6), "الرصيف لم يعكس حفظ العلامة")
    snap("ui-06-saved")

    // إغلاق القارئ (الشريط قد يكون اختفى بعد السكون: نقرة على هامش الصفحة تُظهره)
    let close = app.buttons["إغلاق المصحف"]
    if !close.waitForExistence(timeout: 2) || !close.isHittable {
      page.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.015)).tap()
      XCTAssertTrue(close.waitForExistence(timeout: 4), "زرّ إغلاق المصحف لم يظهر")
    }
    close.tap()

    // المكتبة: تبويب «العلامات» يعرض العلامة المحفوظة
    let tab = app.buttons["العلامات"]
    XCTAssertTrue(tab.waitForExistence(timeout: 15), "المكتبة لم تظهر بعد إغلاق القارئ")
    tab.tap()
    XCTAssertTrue(any(app, containing: expectedRow).waitForExistence(timeout: 6), "العلامة «\(expectedRow)» لم تظهر في تبويب «العلامات»")
    XCTAssertTrue(any(app, containing: "٢٧٠").exists, "رقم صفحة العلامة لم يظهر في صفّها")
    snap("ui-07-bookmarks")
  }
}
