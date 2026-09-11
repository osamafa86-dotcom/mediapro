import XCTest
@testable import SakinahCore

/// سلامة تخطيط المصحف في النسخة الأصلية: ما تعرضه الصفحة هو نصّ الآية نفسه، كلمةً كلمة، في كل صفحة.
/// بيانات حسّاسة، فلا يكفي فحصها في محرّك الويب — هذا الفحص يجري على الشيفرة التي تُرسم على الجهاز.
final class MushafLayoutIntegrityTests: XCTestCase {
  /// الآية الوحيدة التي يختلف فيها تقسيم كلمات المجمع عن تقسيم Tanzil: ٣٧:١٣٠ «سلام على إل ياسين»
  private let mappedAyah = 3918

  func testEveryPageRendersItsAyahsWordForWord() {
    let text = QuranText.shared
    let layout = MushafLayout.shared
    var cover: [Int: [Int]] = [:]
    var marks: [Int: Int] = [:]
    var wordLines = 0

    for p in 1...MushafLayout.totalPages {
      let lines = layout.lines(ofPage: p)
      XCTAssertFalse(lines.isEmpty, "الصفحة \(p) فارغة")
      for line in lines {
        let ws = line.words
        if ws.isEmpty { continue }
        wordLines += 1
        for w in ws {
          XCTAssertFalse(w.glyph.isEmpty, "ص\(p): كلمة بلا رمز في الآية \(w.n)")
          if w.end { marks[w.n, default: 0] += 1 } else if w.k >= 0 { cover[w.n, default: []].append(w.k) }
        }
      }
    }

    XCTAssertGreaterThan(wordLines, 8000, "أسطر الكلمات \(wordLines)")
    XCTAssertEqual(cover.count, 6236, "آيات ظهرت كلماتها")

    for n in 1...6236 {
      XCTAssertEqual(marks[n], 1, "الآية \(n): علامات نهاية \(marks[n] ?? 0)")
      guard let ayah = text.ayah(n) else { return XCTFail("الآية \(n) غير موجودة") }
      let spoken = QuranNormalize.tokenize(ayah.text).filter(\.spoken).count
      let got = cover[n] ?? []
      let expected = n == mappedAyah ? 3 : spoken
      XCTAssertEqual(got.count, expected, "الآية \(n): \(got.count) كلمة في التخطيط مقابل \(expected)")
      // متسلسلة ٠..ن‑١ بلا فجوة ولا تكرار — فلا كلمة تسقط ولا تتكرّر ولا تخرج عن ترتيبها
      for (i, k) in got.enumerated() where k != i {
        return XCTFail("الآية \(n): تسلسل الكلمات انكسر عند \(i) (وجد \(k))")
      }
    }
  }

  /// ترتيب الآيات المعروضة في كل صفحة هو ترتيبها في النصّ — لا صفحة تعرض آية صفحة أخرى
  func testPageAyahOrderMatchesText() {
    for p in 1...MushafLayout.totalPages {
      let fromLayout = MushafLayout.shared.ayahs(onPage: p)
      let fromText = QuranText.shared.pageAyahs(p).map(\.n)
      XCTAssertEqual(fromLayout, fromText, "الصفحة \(p)")
    }
  }
}
