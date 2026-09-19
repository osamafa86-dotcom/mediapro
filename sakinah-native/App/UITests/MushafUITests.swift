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
  /// أيّ عنصر تحتوي تسميته النصّ (الصفوف قد تُدمَج عناصرها في زرّ واحد فلا تبقى staticText مستقلة).
  /// تسميات SwiftUI تحشو الأرقام بمحارف عزل الاتجاه غير المرئية (U+2066…U+2069، U+200E/F): «الحزب ⁨١⁩» —
  /// فالمطابقة بتعبيرٍ يتسامح معها بين كل حرفين، وإلا فشل CONTAINS وإن كان النصّ ظاهرًا على الشاشة
  private func any(_ app: XCUIApplication, containing text: String) -> XCUIElement {
    app.descendants(matching: .any).matching(NSPredicate(format: "label MATCHES %@", loose(text))).firstMatch
  }
  private func loose(_ text: String) -> String {
    let iso = "[\\u2066-\\u2069\\u200E\\u200F]*"
    let body = clean(text).map { c -> String in c == " " ? "\\s+" : NSRegularExpression.escapedPattern(for: String(c)) }.joined(separator: iso)
    return "(?s).*" + iso + body + iso + ".*"
  }
  /// إزالة محارف عزل الاتجاه من نصٍّ قُرئ من تسمية عنصر
  private func clean(_ s: String) -> String {
    String(s.unicodeScalars.filter { !(0x2066...0x2069).contains($0.value) && $0.value != 0x200E && $0.value != 0x200F })
  }
  /// صفحة المصحف الظاهرة على الشاشة (المتصفّح يحمّل الجارتين خارجها أيضًا، وأوّل مطابقة قد تكون جارةً غير مرئية)
  private func visiblePage(_ app: XCUIApplication) -> XCUIElement? {
    let w = app.frame.width
    let pages = app.descendants(matching: .other).matching(NSPredicate(format: "label BEGINSWITH %@", "صفحة ")).allElementsBoundByIndex
    return pages.first { let f = $0.frame; return f.width > 0 && f.midX > 0 && f.midX < w } ?? pages.first
  }
  private func snap(_ name: String) {
    let shot = XCUIScreen.main.screenshot()
    let att = XCTAttachment(screenshot: shot); att.name = name; att.lifetime = .keepAlways; add(att)
    guard let dir = ProcessInfo.processInfo.environment["SHOT_DIR"], !dir.isEmpty else { return }
    try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
    try? shot.pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
  }
  /// عند الفشل: شجرة العناصر (بإطاراتها) في السجلّ ولقطة للشاشة — لمعرفة ما الذي يجلس فوق الزرّ
  private func dumpOnFailure(_ app: XCUIApplication, _ tag: String) {
    snap("zz-fail-\(tag)")
    let tree = app.debugDescription
    print("=== AX TREE (\(tag)) — \(tree.count) chars ===")
    print(tree.prefix(60_000))
    print("=== END AX TREE ===")
  }
  /// نقر مقسّم: إن لم ينتقل التحديد بنقرة الزرّ تُسجَّل الشجرة ثم تُجرَّب نقرة بالإحداثيات (تُميّز عطل الإطار من عطل الإصابة)
  @discardableResult private func tapSegment(_ app: XCUIApplication, _ label: String, expect rowText: String) -> Bool {
    let b = app.buttons[label]
    XCTAssertTrue(b.waitForExistence(timeout: 5), "زرّ «\(label)» غير موجود")
    b.tap()
    if any(app, containing: rowText).waitForExistence(timeout: 5), b.isSelected { return true }
    print("!! TAP «\(label)» DID NOT SWITCH (selected=\(b.isSelected)) — frame=\(b.frame)")
    dumpOnFailure(app, "tap-\(label)")
    b.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    let ok = any(app, containing: rowText).waitForExistence(timeout: 5)
    print("!! COORDINATE TAP «\(label)» → \(ok ? "switched" : "still nothing")")
    return false
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
    XCTAssertTrue(app.buttons["الأجزاء"].waitForExistence(timeout: 25), "مقسّم الفهرس لم يظهر")
    XCTAssertTrue(any(app, containing: "الفاتحة").waitForExistence(timeout: 10), "صفوف السور لم تظهر في البداية")
    snap("ui-00-library")

    let juz = tapSegment(app, "الأجزاء", expect: "الجزء الأول"); snap("ui-01-juz")
    let hizb = tapSegment(app, "الأحزاب", expect: "الحزب ١"); snap("ui-02-hizb")
    let marks = tapSegment(app, "العلامات", expect: "لا علامات بعد"); snap("ui-03-bookmarks-empty")
    let surahs = tapSegment(app, "السور", expect: "الفاتحة")
    // نقرة ثانية على تبويبٍ سبق فتحه (الحالة التي شكا منها المالك: بعد التنقّل لا يستجيب شيء)
    let juzAgain = tapSegment(app, "الأجزاء", expect: "الجزء الأول"); snap("ui-04-juz-again")

    XCTAssertTrue(juz, "نقر «الأجزاء» لم يعرض صفوف الأجزاء")
    XCTAssertTrue(hizb, "نقر «الأحزاب» لم يعرض صفوف الأحزاب")
    XCTAssertTrue(marks, "نقر «العلامات» لم يعرض تبويب العلامات")
    XCTAssertTrue(surahs, "العودة إلى «السور» لم تعرض صفوف السور")
    XCTAssertTrue(juzAgain, "النقرة الثانية على «الأجزاء» لم تستجب")
  }

  // MARK: ٢ — علامة بنقرة واحدة من رصيف الآية (سورة من الفهرس → نقر كلمة → «علامة») ثم تظهر في تبويب «العلامات»
  func test2_bookmarkSavedFromReaderAppearsInLibrary() {
    let app = launch("mushaf")
    let row = any(app, containing: "البقرة")
    XCTAssertTrue(row.waitForExistence(timeout: 25), "صفّ سورة البقرة لم يظهر في الفهرس")
    row.tap()
    let anyPage = app.descendants(matching: .other).matching(NSPredicate(format: "label BEGINSWITH %@", "صفحة ")).firstMatch
    if !anyPage.waitForExistence(timeout: 25) { dumpOnFailure(app, "no-page") }
    XCTAssertTrue(anyPage.exists, "صفحة المصحف لم تظهر بعد نقر سورة البقرة")
    sleep(3) // خطّ الصفحة يُحمَّل عند أوّل ظهور
    guard let page = visiblePage(app) else { XCTFail("لا صفحة ظاهرة على الشاشة"); return }
    print("!! visible page: \(page.label) frame=\(page.frame)")

    // نقر كلمة من الصفحة (المسار نفسه الذي يسلكه المستخدم عند الضغط على رقم الآية)
    var dockShown = false
    for (dx, dy) in [(0.5, 0.42), (0.42, 0.5), (0.58, 0.58), (0.5, 0.3)] {
      page.coordinate(withNormalizedOffset: CGVector(dx: dx, dy: dy)).tap()
      if app.buttons["علامة"].waitForExistence(timeout: 3) || app.buttons["معلَّمة"].exists { dockShown = true; break }
    }
    if !dockShown { dumpOnFailure(app, "no-dock") }
    XCTAssertTrue(dockShown, "نقر كلمة في الصفحة لم يُظهر رصيف الآية")
    snap("ui-04-dock")

    // مرجع الآية المحدّدة من رأس الرصيف («النحل، الآية ٢٧») → صفّ المكتبة «النحل: ٢٧»
    let head = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@ AND NOT label BEGINSWITH %@", "الآية ", "صفحة")).firstMatch
    XCTAssertTrue(head.waitForExistence(timeout: 4), "رأس الرصيف (السورة والآية) لم يظهر")
    let parts = clean(head.label).replacingOccurrences(of: "،", with: ",").split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
    let surahName = parts.first ?? ""
    let ayahDigits = parts.dropFirst().first(where: { $0.hasPrefix("الآية ") }).map { String($0.dropFirst("الآية ".count)) } ?? ""
    XCTAssertFalse(surahName.isEmpty || ayahDigits.isEmpty, "تعذّر قراءة مرجع الآية من الرصيف: \(head.label)")
    let expectedRow = "\(surahName): \(arabicDigits(ayahDigits))"

    // «علامة» تحفظ بنقرة واحدة: الرصيف يتحوّل إلى «معلَّمة» بلا ورقة ولا زرّ حفظ
    if app.buttons["معلَّمة"].exists { app.buttons["معلَّمة"].tap(); XCTAssertTrue(app.buttons["علامة"].waitForExistence(timeout: 4), "إزالة علامة قديمة لم تنعكس") }
    app.buttons["علامة"].tap()
    XCTAssertTrue(app.buttons["معلَّمة"].waitForExistence(timeout: 6), "نقر «علامة» لم يحفظ العلامة فورًا (الرصيف لم يتحوّل إلى «معلَّمة»)")
    XCTAssertFalse(app.buttons["حفظ العلامة"].exists, "ظهرت ورقة حفظ — المطلوب حفظ بنقرة واحدة")
    snap("ui-05-saved")

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
    if !any(app, containing: expectedRow).waitForExistence(timeout: 6) { dumpOnFailure(app, "no-bookmark-row") }
    XCTAssertTrue(any(app, containing: expectedRow).exists, "العلامة «\(expectedRow)» لم تظهر في تبويب «العلامات»")
    snap("ui-06-bookmarks")
  }
}
