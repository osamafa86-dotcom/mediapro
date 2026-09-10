import SwiftUI
import SakinahCore

/// وضع النص المتدفق: آيات الصفحة بخط أميري قرآن أو حفص بحجم وتباعد قابلين للتغيير، مع التجويد الملوّن وترويسات السور والبسملة
struct MushafTextPageView: View {
  @Environment(MushafReaderState.self) private var rs
  let page: Int
  var showChrome = true
  var insets = EdgeInsets()

  /// كلمة في وضع النص: النص الخام، موضعه في الآية، فهرس الكلمة المنطوقة أو -1، وهل هي علامة نهاية الآية
  struct TWord: Identifiable { let id: Int; let n: Int; let k: Int; let raw: String; let start: Int; let end: Bool; let spoken: Bool }
  enum Block: Identifiable { case header(Int), basmala, words([TWord]); var id: String { switch self { case .header(let s): return "h\(s)"; case .basmala: return "b"; case .words(let w): return "w\(w.first?.id ?? 0)" } } }

  /// خط حفص لا يرسم ثلاث علامات من نص تنزيل ويُظهر مكانها دائرة منقّطة، فتُبدَّل بما يرسمه الخط بالشكل ذاته (الطول محفوظ)
  static func hafsText(_ t: String) -> String {
    String(String.UnicodeScalarView(t.unicodeScalars.map { s -> Unicode.Scalar in switch s.value { case 0x06DF: return Unicode.Scalar(0x0652)!; case 0x06EB: return Unicode.Scalar(0x06E0)!; case 0x06E3: return Unicode.Scalar(0x06DC)!; default: return s } }))
  }
  static func blocks(page: Int, hafs: Bool) -> [Block] {
    var out: [Block] = []; var cur: [TWord] = []; var id = 0
    for a in QuranText.shared.pageAyahs(page) {
      if a.ayah == 1 {
        if !cur.isEmpty { out.append(.words(cur)); cur = [] }
        out.append(.header(a.surah)); if a.surah != 1 && a.surah != 9 { out.append(.basmala) }
      }
      let text = hafs ? hafsText(a.text) : a.text
      let scalars = Array(text.unicodeScalars); var pos = 0; var k = 0
      for t in QuranNormalize.tokenize(text) {
        let start = QuranTextIndexApp.find(t.raw, in: scalars, from: pos); pos = start + t.raw.unicodeScalars.count
        cur.append(TWord(id: id, n: a.n, k: t.spoken ? k : -1, raw: t.raw, start: start, end: false, spoken: t.spoken)); id += 1
        if t.spoken { k += 1 }
      }
      let marker = hafs ? QuranMeta.arabicDigits(a.ayah) : "۝" + QuranMeta.arabicDigits(a.ayah)
      cur.append(TWord(id: id, n: a.n, k: -1, raw: marker, start: -1, end: true, spoken: false)); id += 1
    }
    if !cur.isEmpty { out.append(.words(cur)) }
    return out
  }

  var body: some View {
    let hafs = rs.textFont == "hafs"
    let fontName = MushafFonts.shared.textFontName(rs.textFont)
    let blocks = Self.blocks(page: page, hafs: hafs)
    let label = QuranText.shared.label(ofPage: page)
    let palette = rs.palette
    GeometryReader { geo in
      let sideInset = max(geo.size.width * 0.035, max(insets.leading, insets.trailing))
      let W = geo.size.width - 2 * sideInset
      let base = W / MushafMetrics.fullLineEm
      VStack(spacing: 0) {
        if showChrome, let label { PageHead(page: page, label: label, size: base, palette: palette).padding(.horizontal, W * 0.01) }
        GeometryReader { inner in
          let H = inner.size.height - base * 0.4
          let size = TextFit.size(page: page, blocks: blocks, fontName: fontName, width: W - base * 0.8, height: H, base: base, scale: rs.fontScale, lineHeight: rs.lineHeight, fit: rs.fitText)
          let content = VStack(spacing: base * 0.2) {
            ForEach(blocks) { b in
              switch b {
              case .header(let s): SurahHeader(surah: s, size: base, palette: palette, plain: true).frame(height: base * 1.45).padding(.horizontal, base * 0.1)
              case .basmala: Text(QuranMeta.basmala).font(.custom(MushafFonts.amiriQuranFont, fixedSize: base * 0.95)).foregroundStyle(palette.ink).lineLimit(1).minimumScaleFactor(0.5).frame(maxWidth: W * 0.62).frame(height: base * 1.3)
              case .words(let ws):
                FlowLayout(spacing: size * 0.3, lineHeight: size * rs.lineHeight) {
                  ForEach(ws) { w in TextWord(word: w, fontName: fontName, size: size) }
                }
                .environment(\.layoutDirection, .leftToRight)
              }
            }
          }
          .padding(.horizontal, base * 0.4)
          let contentH = TextFit.height(page: page, blocks: blocks, fontName: fontName, width: W - base * 0.8, size: size, base: base, lineHeight: rs.lineHeight)
          Group {
            if contentH <= H + 1 { content.frame(width: W, height: inner.size.height, alignment: .center) }
            else { ScrollView(.vertical) { content.padding(.vertical, base * 0.2) }.frame(width: W, height: inner.size.height).scrollIndicators(.hidden) }
          }
        }
        if showChrome { Text(QuranMeta.arabicDigits(page)).font(.custom(MushafFonts.amiriQuranFont, fixedSize: base * 0.8)).foregroundStyle(palette.ink.opacity(0.85)).padding(.top, base * 0.1) }
      }
      .padding(.top, max(insets.top, 8)).padding(.bottom, max(insets.bottom, 6)).padding(.horizontal, sideInset)
      .frame(width: geo.size.width, height: geo.size.height)
    }
    .environment(\.layoutDirection, .rightToLeft)
  }
}

/// كلمة في وضع النص مع التجويد الملوّن وتظليل التلاوة والإخفاء
struct TextWord: View {
  @Environment(MushafReaderState.self) private var rs
  let word: MushafTextPageView.TWord
  let fontName: String
  let size: CGFloat
  var body: some View {
    let isMarker = word.end
    let base: Color = isMarker ? rs.palette.marker : (word.spoken ? rs.palette.ink : rs.palette.gold1)
    let st = rs.style(n: word.n, k: word.k, base: base)
    Text(attributed(st))
      .lineLimit(1).fixedSize()
      .background(st.bg.map { RoundedRectangle(cornerRadius: size * 0.16).fill($0) })
      .overlay { if st.current { RoundedRectangle(cornerRadius: size * 0.16).stroke(rs.accents.hideLine, lineWidth: 1) } }
      .contentShape(Rectangle())
      .onTapGesture { rs.onTapAyah?(word.n) }
  }
  private func attributed(_ st: MushafReaderState.WordStyle) -> AttributedString {
    let font = Font.custom(fontName, fixedSize: word.end ? size * 0.95 : (word.spoken ? size : size * 0.75))
    func piece(_ s: String, _ c: Color) -> AttributedString { var a = AttributedString(s); a.font = font; a.foregroundColor = c; return a }
    if st.hidden { return piece(word.raw, .clear) }
    guard rs.tajweed, word.spoken, word.start >= 0 else { return piece(word.raw, st.fg) }
    let spans = Tajweed.shared.spans(word.n); guard !spans.isEmpty else { return piece(word.raw, st.fg) }
    var out = AttributedString()
    for seg in Tajweed.segments(word: word.raw, start: word.start, spans: spans) { out.append(piece(seg.text, MushafPalette.tajweedColor(seg.code, dark: rs.isDark) ?? st.fg)) }
    return out
  }
}

/// ملاءمة وضع النص: الحجم من العرض × التكبير، ويُصغَّر حتى تظهر الصفحة كاملة عند تفعيل «ملاءمة الشاشة» (حدّ أدنى 12)
enum TextFit {
  private static var widths: [String: [CGFloat]] = [:]
  private static func wordWidths(page: Int, blocks: [MushafTextPageView.Block], fontName: String) -> [CGFloat] {
    let key = "\(page)|\(fontName)"
    if let w = widths[key] { return w }
    var out: [CGFloat] = []
    for b in blocks { if case .words(let ws) = b { for w in ws { out.append(MushafMetrics.textWidth(w.raw, fontName: fontName, size: 100) * (w.end ? 0.95 : (w.spoken ? 1 : 0.75))) } } }
    if widths.count > 40 { widths.removeAll() }
    widths[key] = out; return out
  }
  /// ارتفاع المحتوى المقدَّر بالتقسيم الجشع نفسه الذي يستخدمه التخطيط
  static func height(page: Int, blocks: [MushafTextPageView.Block], fontName: String, width: CGFloat, size: CGFloat, base: CGFloat, lineHeight: Double) -> CGFloat {
    var h: CGFloat = 0; var idx = 0
    let ww = wordWidths(page: page, blocks: blocks, fontName: fontName)
    for b in blocks {
      switch b {
      case .header: h += base * 1.45 + base * 0.2
      case .basmala: h += base * 1.3 + base * 0.2
      case .words(let ws):
        var rows = 1; var x: CGFloat = 0; let sp = size * 0.3
        for _ in ws {
          let w = (idx < ww.count ? ww[idx] : 200) * size / 100; idx += 1
          if x > 0 && x + sp + w > width { rows += 1; x = w } else { x = x == 0 ? w : x + sp + w }
        }
        h += CGFloat(rows) * size * lineHeight + base * 0.2
      }
    }
    return h
  }
  static func size(page: Int, blocks: [MushafTextPageView.Block], fontName: String, width: CGFloat, height: CGFloat, base: CGFloat, scale: Double, lineHeight: Double, fit: Bool) -> CGFloat {
    _ = wordWidths(page: page, blocks: blocks, fontName: fontName)
    var fs = base * 1.02 * scale
    guard fit, height > 0, self.height(page: page, blocks: blocks, fontName: fontName, width: width, size: fs, base: base, lineHeight: lineHeight) > height else { return fs }
    var lo = min(fs, 12), hi = fs
    for _ in 0..<8 { let mid = (lo + hi) / 2; if self.height(page: page, blocks: blocks, fontName: fontName, width: width, size: mid, base: base, lineHeight: lineHeight) > height { hi = mid } else { lo = mid } }
    fs = lo; return fs
  }
}

/// موضع نص كلمة داخل مصفوفة رموز الآية (كما يفعل indexOf في الويب)
enum QuranTextIndexApp {
  static func find(_ word: String, in scalars: [Unicode.Scalar], from: Int) -> Int {
    let w = Array(word.unicodeScalars); guard !w.isEmpty, scalars.count >= w.count else { return from }
    var i = max(0, from)
    while i + w.count <= scalars.count { if Array(scalars[i..<i + w.count]) == w { return i }; i += 1 }
    return from
  }
}
