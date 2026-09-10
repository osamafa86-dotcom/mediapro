import SwiftUI
import CoreText
import SakinahCore

/// ألوان صفحة المصحف (السمة الورقية؛ السمات الأخرى في مرحلة لاحقة) — القيم نفسها في نسخة الويب
struct MushafPalette {
  var paper = Theme.paper
  var ink = Color(red: 0.17, green: 0.13, blue: 0.10)
  var marker = Color(red: 0.56, green: 0.45, blue: 0.19)   // #8f7430 علامة نهاية الآية
  var rub = Color(red: 0.72, green: 0.20, blue: 0.42)      // #b8336a علامة ربع الحزب
  var gold1 = Color(red: 0.66, green: 0.54, blue: 0.23)    // #a98a3a
  var gold2 = Color(red: 0.81, green: 0.71, blue: 0.44)    // #cfb46f
  var gold3 = Color(red: 0.91, green: 0.86, blue: 0.70)    // #e9dcb2
  static let paper = MushafPalette()
}

/// قياسات الصفحة كما في المطبوع (نسخة الويب نفسها): السطر الكامل ≈ 14.85em، وارتفاع السطر بين 1.12em و2em
enum MushafMetrics {
  static let fullLineEm: CGFloat = 14.85
  static let rowMinEm: CGFloat = 1.12
  static let rowMaxEm: CGFloat = 2.0
  static let rows = 15

  struct Fit: Equatable { let fontSize: CGFloat; let bodyHeight: CGFloat }
  private static var cache: [String: Fit] = [:]

  /// حجم الخط من العرض، ثم تصحيح بالقياس (CoreText) إن تجاوز أي سطر العرض، وضبطه على الارتفاع المتاح
  static func fit(page p: Int, lines: [MushafLine], width W: CGFloat, height H: CGFloat) -> Fit {
    let key = "\(p)|\(Int(W))|\(Int(H))"
    if let c = cache[key] { return c }
    var size = W / fullLineEm
    if H > 0 {
      let rowH = H / CGFloat(rows)
      if rowH < size * rowMinEm { size = rowH / rowMinEm }
    }
    let maxW = maxLineWidth(fontName: MushafFonts.pageFontName(p), size: size, lines: lines)
    if maxW > W + 0.5 { size *= W / maxW }
    let bodyH = H > 0 ? min(H, CGFloat(rows) * size * rowMaxEm) : CGFloat(rows) * size * 1.09
    let f = Fit(fontSize: size, bodyHeight: bodyH)
    if cache.count > 64 { cache.removeAll() }
    cache[key] = f
    return f
  }
  static func maxLineWidth(fontName: String, size: CGFloat, lines: [MushafLine]) -> CGFloat {
    let font = CTFontCreateWithName(fontName as CFString, size, nil)
    var maxW: CGFloat = 0
    for l in lines {
      let ws = l.words; if ws.isEmpty { continue }
      let attr = NSAttributedString(string: ws.map(\.glyph).joined(), attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font])
      let line = CTLineCreateWithAttributedString(attr)
      maxW = max(maxW, CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil)))
    }
    return maxW
  }
}

/// صفحة من مصحف المدينة بخط صفحتها (QCF v1): 15 سطرًا (8 في الفاتحة وأول البقرة داخل إطار)، مع رأس الصفحة (السورة والجزء) ورقمها
struct MushafPageView: View {
  let page: Int
  var showChrome = true
  var palette = MushafPalette.paper
  /// إزاحات الحواف الآمنة (الصفحة ترسم تحت شريط الحالة)
  var insets = EdgeInsets()

  var body: some View {
    let layout = MushafLayout.shared
    let lines = layout.lines(ofPage: page)
    let label = QuranText.shared.label(ofPage: page)
    let fontReady = MushafFonts.shared.ensurePage(page)
    let _ = MushafFonts.shared.ensureAmiri()
    GeometryReader { geo in
      let sideInset = max(geo.size.width * 0.035, max(insets.leading, insets.trailing))
      let W = geo.size.width - 2 * sideInset
      let base = W / MushafMetrics.fullLineEm
      VStack(spacing: 0) {
        if showChrome, let label {
          PageHead(page: page, label: label, size: base, palette: palette)
            .padding(.horizontal, W * 0.01)
        }
        GeometryReader { inner in
          let H = inner.size.height - base * 0.6
          let fit = MushafMetrics.fit(page: page, lines: lines, width: W, height: H)
          let rowH = fit.bodyHeight / CGFloat(MushafMetrics.rows)
          let short = lines.count < MushafMetrics.rows
          ZStack {
            VStack(spacing: 0) {
              ForEach(0..<MushafMetrics.rows, id: \.self) { i in
                // الفاتحة وأول البقرة: 8 أسطر في وسط الصفحة (الصفوف 4..11 من 15) داخل إطار
                let idx = short ? i - 3 : i
                Group {
                  if idx >= 0 && idx < lines.count { row(lines[idx], size: fit.fontSize, rowH: rowH, width: W) } else { Color.clear }
                }
                .frame(width: W, height: rowH)
              }
            }
            if short { ShortPageFrame(palette: palette).frame(width: W * 0.97, height: fit.bodyHeight * (1 - 0.175 - 0.215)).offset(y: fit.bodyHeight * (0.175 - 0.215) / 2) }
          }
          .frame(width: W, height: fit.bodyHeight)
          .frame(width: inner.size.width, height: inner.size.height)
          .opacity(fontReady ? 1 : 0.35)
        }
        if showChrome {
          Text(QuranMeta.arabicDigits(page))
            .font(.custom(MushafFonts.amiriQuranFont, fixedSize: base * 0.8))
            .foregroundStyle(palette.ink.opacity(0.85))
            .padding(.top, base * 0.1)
        }
      }
      .padding(.top, max(insets.top, 8))
      .padding(.bottom, max(insets.bottom, 6))
      .padding(.horizontal, sideInset)
      .frame(width: geo.size.width, height: geo.size.height)
    }
    .background(palette.paper)
    .environment(\.layoutDirection, .rightToLeft)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("صفحة \(page)")
    .accessibilityValue(QuranText.shared.pageAyahs(page).map { "\($0.text) (\($0.ayah))" }.joined(separator: " "))
  }

  @ViewBuilder
  private func row(_ line: MushafLine, size: CGFloat, rowH: CGFloat, width: CGFloat) -> some View {
    switch line {
    case .header(let s):
      SurahHeader(surah: s, size: size, palette: palette)
        .frame(height: min(rowH * 0.88, size * 1.45))
        .padding(.horizontal, size * 0.1)
    case .basmala:
      Text(QuranMeta.basmala)
        .font(.custom(MushafFonts.amiriQuranFont, fixedSize: size * 0.98))
        .foregroundStyle(palette.ink)
        .lineLimit(1).minimumScaleFactor(0.5)
        .frame(maxWidth: width * 0.62)
    case .words(let ws):
      Text(attributed(ws, size: size))
        .lineLimit(1).minimumScaleFactor(0.85)
        .frame(maxWidth: .infinity)
    }
  }

  /// سطر الكلمات بخط الصفحة: الرموز متلاصقة بلا فواصل (تباعدها داخل الخط)، وعلامة نهاية الآية والربع والسجدة بلونها
  private func attributed(_ ws: [MushafWord], size: CGFloat) -> AttributedString {
    var out = AttributedString()
    let font = Font.custom(MushafFonts.pageFontName(page), fixedSize: size)
    for w in ws {
      let chars = Array(w.glyph)
      if w.rub, chars.count > 1 {
        out.append(piece(String(chars[0]), font, palette.rub)); out.append(piece(String(chars[1...]), font, palette.ink))
      } else if w.sajda, chars.count > 1 {
        out.append(piece(String(chars[..<(chars.count - 1)]), font, palette.ink)); out.append(piece(String(chars[chars.count - 1]), font, palette.marker))
      } else {
        out.append(piece(w.glyph, font, w.end ? palette.marker : palette.ink))
      }
    }
    return out
  }
  private func piece(_ s: String, _ font: Font, _ color: Color) -> AttributedString {
    var a = AttributedString(s); a.font = font; a.foregroundColor = color; return a
  }
}

/// رأس الصفحة: اسم السورة والجزء متعاكسان بين الصفحات اليمنى (الفردية) واليسرى (الزوجية) كما في الكتاب المطبوع
private struct PageHead: View {
  let page: Int; let label: QuranText.PageLabel; let size: CGFloat; let palette: MushafPalette
  var body: some View {
    let surah = Text("سُورَةُ \(QuranMeta.surah(label.surah).vocalized)")
    let juz = Text(QuranMeta.juzName(label.juz))
    HStack(alignment: .firstTextBaseline) {
      if page % 2 == 1 { surah; Spacer(minLength: 8); juz } else { juz; Spacer(minLength: 8); surah }
    }
    .font(.custom(MushafFonts.amiriQuranFont, fixedSize: size * 0.66))
    .foregroundStyle(palette.ink.opacity(0.85))
    .lineLimit(1).minimumScaleFactor(0.6)
  }
}

/// إطار اسم السورة: حدّ ذهبي مزدوج وزخرفة جانبية، والاسم برموز خط sura_names («001 surah»)
struct SurahHeader: View {
  let surah: Int; let size: CGFloat; let palette: MushafPalette
  var body: some View {
    let _ = MushafFonts.shared.ensureSurahNames()
    ZStack {
      RoundedRectangle(cornerRadius: 4).fill(palette.paper)
      HStack(spacing: 0) {
        Ornament(color: palette.gold2).mask(LinearGradient(colors: [.black, .black, .clear], startPoint: .leading, endPoint: .trailing))
        Spacer(minLength: size * 3)
        Ornament(color: palette.gold2).mask(LinearGradient(colors: [.clear, .black, .black], startPoint: .leading, endPoint: .trailing))
      }
      .padding(.vertical, 4).padding(.horizontal, 4)
      RoundedRectangle(cornerRadius: 4).strokeBorder(palette.gold1, lineWidth: 1)
      RoundedRectangle(cornerRadius: 3).inset(by: 2).strokeBorder(palette.gold2, lineWidth: 1)
      Text(String(format: "%03d surah", surah))
        .font(.custom(MushafFonts.surahNamesFont, fixedSize: size * 0.86))
        .foregroundStyle(palette.ink)
        .environment(\.layoutDirection, .leftToRight)
        .lineLimit(1).minimumScaleFactor(0.6)
        .padding(.horizontal, size * 0.6)
        .background(palette.paper)
    }
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .accessibilityLabel("سورة \(QuranMeta.surah(surah).name)")
  }
  /// زخرفة متكررة (معيّنات صغيرة بين خطّين) على جانبي الاسم
  private struct Ornament: View {
    let color: Color
    var body: some View {
      Canvas { ctx, sz in
        let h = sz.height, step = max(6, h * 0.55)
        var top = Path(); top.move(to: CGPoint(x: 0, y: h * 0.22)); top.addLine(to: CGPoint(x: sz.width, y: h * 0.22))
        var bot = Path(); bot.move(to: CGPoint(x: 0, y: h * 0.78)); bot.addLine(to: CGPoint(x: sz.width, y: h * 0.78))
        ctx.stroke(top, with: .color(color), lineWidth: 0.8); ctx.stroke(bot, with: .color(color), lineWidth: 0.8)
        var x: CGFloat = step / 2
        while x < sz.width {
          let r = h * 0.14
          var d = Path(); d.move(to: CGPoint(x: x, y: h / 2 - r)); d.addLine(to: CGPoint(x: x + r, y: h / 2)); d.addLine(to: CGPoint(x: x, y: h / 2 + r)); d.addLine(to: CGPoint(x: x - r, y: h / 2)); d.closeSubpath()
          ctx.fill(d, with: .color(color))
          x += step
        }
      }
      .frame(maxWidth: .infinity)
    }
  }
}

/// إطار الفاتحة وأول البقرة (حدّ ذهبي مزدوج حول الأسطر الثمانية)
private struct ShortPageFrame: View {
  let palette: MushafPalette
  var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: 14).inset(by: -14).strokeBorder(palette.gold3.opacity(0.8), lineWidth: 1)
      RoundedRectangle(cornerRadius: 10).inset(by: -5).strokeBorder(palette.gold2, lineWidth: 1)
      RoundedRectangle(cornerRadius: 10).strokeBorder(palette.gold1, lineWidth: 2)
      RoundedRectangle(cornerRadius: 8).inset(by: 5).strokeBorder(palette.gold2, lineWidth: 1)
      RoundedRectangle(cornerRadius: 6).inset(by: 6).strokeBorder(palette.gold3, lineWidth: 1)
    }
    .allowsHitTesting(false)
  }
}
