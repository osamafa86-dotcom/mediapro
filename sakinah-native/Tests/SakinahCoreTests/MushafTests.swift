import XCTest
@testable import SakinahCore

/// مطابقة مفكّك التخطيط مع محرّك الويب (المرجع المولَّد في Fixtures/golden.json)
final class MushafTests: XCTestCase {
  private struct GWord: Decodable { let glyph: String; let n: Int; let k: Int; let end: Bool; let rub: Bool; let sajda: Bool }
  private struct GLine: Decodable { let type: String; let surah: Int?; let words: [GWord]? }
  private struct GPage: Decodable { let lineCount: Int; let headers: [Int]; let ayahs: [Int]; let lines: [GLine] }
  private struct Golden: Decodable { let layoutPages: [String: GPage]; let juzNames: [String] }

  private func golden() throws -> Golden {
    let url = Bundle.module.url(forResource: "golden", withExtension: "json", subdirectory: "Fixtures") ?? Bundle.module.url(forResource: "golden", withExtension: "json")!
    return try JSONDecoder().decode(Golden.self, from: Data(contentsOf: url))
  }

  func testLayoutMatchesWebEngine() throws {
    let g = try golden()
    let layout = MushafLayout.shared
    XCTAssertEqual(g.layoutPages.count, 9)
    for (ps, gp) in g.layoutPages {
      let p = Int(ps)!
      XCTAssertEqual(MushafLayout.lineCount(ofPage: p), gp.lineCount, "lineCount p\(p)")
      XCTAssertEqual(layout.headers(onPage: p), gp.headers, "headers p\(p)")
      XCTAssertEqual(layout.ayahs(onPage: p), gp.ayahs, "ayahs p\(p)")
      let lines = layout.lines(ofPage: p)
      XCTAssertEqual(lines.count, gp.lines.count, "lines p\(p)")
      for (i, (l, gl)) in zip(lines, gp.lines).enumerated() {
        switch l {
        case .header(let s): XCTAssertEqual(gl.type, "header", "p\(p) l\(i)"); XCTAssertEqual(s, gl.surah, "p\(p) l\(i)")
        case .basmala: XCTAssertEqual(gl.type, "basmala", "p\(p) l\(i)")
        case .words(let ws):
          XCTAssertEqual(gl.type, "words", "p\(p) l\(i)")
          let gws = gl.words ?? []
          XCTAssertEqual(ws.count, gws.count, "p\(p) l\(i) word count")
          for (w, gw) in zip(ws, gws) {
            XCTAssertEqual(w.glyph, gw.glyph, "p\(p) l\(i)"); XCTAssertEqual(w.n, gw.n, "p\(p) l\(i)"); XCTAssertEqual(w.k, gw.k, "p\(p) l\(i) n\(w.n)")
            XCTAssertEqual(w.end, gw.end, "p\(p) l\(i)"); XCTAssertEqual(w.rub, gw.rub, "p\(p) l\(i)"); XCTAssertEqual(w.sajda, gw.sajda, "p\(p) l\(i)")
          }
        }
      }
    }
    // كل الصفحات تُفكّ بلا استثناء وعدد أسطرها كما في المطبوع
    var total = 0
    for p in 1...604 {
      let ls = layout.lines(ofPage: p)
      XCTAssertEqual(ls.count, MushafLayout.lineCount(ofPage: p), "p\(p)")
      for l in ls { for w in l.words { XCTAssertFalse(w.glyph.isEmpty, "p\(p) empty glyph n\(w.n)") } }
      total += ls.reduce(0) { $0 + $1.words.filter(\.end).count }
    }
    XCTAssertEqual(total, 6236, "عدد علامات نهاية الآيات")
    XCTAssertEqual(layout.page(ofAyah: 1), 1); XCTAssertEqual(layout.page(ofAyah: 6236), 604); XCTAssertEqual(layout.page(ofAyah: 2000), QuranText.shared.ayah(2000)?.page)
  }

  func testJuzNamesAndMeta() throws {
    let g = try golden()
    XCTAssertEqual(g.juzNames.count, 30)
    for (i, name) in g.juzNames.enumerated() { XCTAssertEqual(QuranMeta.juzName(i + 1), name) }
    XCTAssertEqual(QuranMeta.juzName(26, vocalized: false), "الجزء السادس والعشرون")
    XCTAssertEqual(QuranMeta.surahs.count, 114); XCTAssertEqual(QuranMeta.totalPages, 604)
    XCTAssertEqual(QuranMeta.surah(2).page, 2); XCTAssertEqual(QuranMeta.surah(114).page, 604)
    XCTAssertEqual(QuranMeta.juz(ofPage: 1), 1); XCTAssertEqual(QuranMeta.juz(ofPage: 22), 2); XCTAssertEqual(QuranMeta.juz(ofPage: 604), 30)
    XCTAssertEqual(QuranMeta.arabicDigits(604), "٦٠٤")
  }

  func testQuranText() {
    let t = QuranText.shared
    XCTAssertEqual(t.ayahs.count, 6236)
    XCTAssertEqual(t.ayah(surah: 1, ayah: 1)?.n, 1); XCTAssertEqual(t.ayah(surah: 2, ayah: 1)?.n, 8); XCTAssertEqual(t.ayah(surah: 114, ayah: 6)?.n, 6236)
    XCTAssertEqual(t.pageAyahs(1).count, 7); XCTAssertEqual(t.surahAyahs(2).count, 286)
    XCTAssertEqual(t.surahsStarting(onPage: 604), [112, 113, 114]); XCTAssertEqual(t.surahsStarting(onPage: 187), [9])
    let l = t.label(ofPage: 50)!; XCTAssertEqual(l.juz, 3); XCTAssertEqual(l.surah, 3); XCTAssertEqual(QuranMeta.juzStartPage(3), 42)
    XCTAssertEqual(t.hizbStartPage(1), 1); XCTAssertEqual(t.hizbStartPage(60), 591)
    XCTAssertTrue(t.ayah(1)!.text.hasPrefix("بِسْمِ ٱللَّهِ"))
    // آيات الصفحة في النص تطابق آيات الصفحة في التخطيط
    for p in [1, 2, 3, 50, 187, 293, 302, 545, 604] { XCTAssertEqual(t.pageAyahs(p).map(\.n), MushafLayout.shared.ayahs(onPage: p), "p\(p)") }
  }
}
