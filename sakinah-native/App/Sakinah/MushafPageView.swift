import SwiftUI
import CoreText
import UIKit
import SakinahCore

/// ألوان صفحة المصحف (تُشتق من السمة؛ القيم الافتراضية للسمة الكريمية)
struct MushafPalette {
  var paper = Theme.paper
  var ink = Color(red: 0.17, green: 0.13, blue: 0.10)
  var marker = Color(red: 0.56, green: 0.45, blue: 0.19)
  var rub = Color(red: 0.72, green: 0.20, blue: 0.42)
  var gold1 = Color(red: 0.66, green: 0.54, blue: 0.23)
  var gold2 = Color(red: 0.81, green: 0.71, blue: 0.44)
  var gold3 = Color(red: 0.91, green: 0.86, blue: 0.70)
  init() {}
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

  static func fit(page p: Int, lines: [MushafLine], width W: CGFloat, height H: CGFloat) -> Fit {
    let key = "\(p)|\(Int(W))|\(Int(H))"
    if let c = cache[key] { return c }
    var size = W / fullLineEm
    if H > 0 { let rowH = H / CGFloat(rows); if rowH < size * rowMinEm { size = rowH / rowMinEm } }
    // أسطر QCF مصمَّمة لتملأ عرض الصفحة بالضبط (قِسناها: كلها متساوية تمامًا)، فالملاءمة على
    // العرض كاملًا لا تترك فسحة. ونحن نرسم كل كلمة عنصرًا مستقلًّا، فيكفي تقريبٌ جزئيّ في عرض
    // كلمة واحدة ليفيض السطر ويُقتطع من طرفه — وفقدُ كلمة من صفحة مصحف لا يُحتمل. فنترك شعرة.
    // حبر QCF يتجاوز العرض المحجوز عند نهاية السطر بما يبلغ ٠٫٦٥٪ (مقيسًا على ص ٢٧٠)،
    // فالفسحة تغطّيه وزيادة — والفرق في حجم الخطّ نحو واحد بالمئة، لا تراه العين.
    let safeW = W * 0.988
    let maxW = maxLineWidth(fontName: MushafFonts.pageFontName(p), size: size, lines: lines)
    if maxW > safeW { size *= safeW / maxW }
    let bodyH = H > 0 ? min(H, CGFloat(rows) * size * rowMaxEm) : CGFloat(rows) * size * 1.09
    let f = Fit(fontSize: size, bodyHeight: bodyH)
    if cache.count > 64 { cache.removeAll() }
    cache[key] = f
    return f
  }
  /// صعود الخطّ ونزوله — لتحديد خطّ الأساس وارتفاع السطر عند الرسم المباشر
  struct FontMetrics { let ascent: CGFloat; let descent: CGFloat; var height: CGFloat { ascent + descent } }
  private static var metricsCache: [String: FontMetrics] = [:]
  static func fontMetrics(fontName: String, size: CGFloat) -> FontMetrics {
    let key = "\(fontName)|\(Int(size * 4))"
    if let c = metricsCache[key] { return c }
    let f = CTFontCreateWithName(fontName as CFString, size, nil)
    let m = FontMetrics(ascent: CTFontGetAscent(f), descent: CTFontGetDescent(f))
    if metricsCache.count > 256 { metricsCache.removeAll() }
    metricsCache[key] = m
    return m
  }
  /// رموز كلمة ومقاييسها، مأخوذة من جدول cmap مباشرة
  struct GlyphRun { let ids: [CGGlyph]; let advances: [CGFloat]; let width: CGFloat }
  private static var runCache: [String: GlyphRun] = [:]
  /// يحوّل رموز الكلمة إلى معرّفات رسم عبر cmap وحده — لا محرّك نصّ ولا تشكيل ولا morx.
  /// خطوط QCF تحمل جدول morx من آبل يُطبّق استبدالًا سياقيًا عربيًا، وهو يُبدّل رموزنا
  /// بصور أخرى من عائلة الحرف فتظهر كلمات في غير مواضعها. والرسم بالمعرّفات يتجاوزه كلّه.
  static func glyphRun(_ glyph: String, fontName: String, size: CGFloat) -> GlyphRun {
    let key = "\(fontName)|\(Int(size * 4))|\(glyph)"
    if let c = runCache[key] { return c }
    let font = CTFontCreateWithName(fontName as CFString, size, nil)
    let chars = Array(glyph.utf16)
    var ids = [CGGlyph](repeating: 0, count: max(1, chars.count))
    var advances = [CGSize](repeating: .zero, count: max(1, chars.count))
    if !chars.isEmpty {
      CTFontGetGlyphsForCharacters(font, chars, &ids, chars.count)
      CTFontGetAdvancesForGlyphs(font, .horizontal, ids, &advances, chars.count)
    }
    let n = chars.count
    let adv = Array(advances.prefix(n)).map(\.width)
    let run = GlyphRun(ids: Array(ids.prefix(n)), advances: adv, width: adv.reduce(0, +))
    if runCache.count > 6000 { runCache.removeAll() }
    runCache[key] = run
    return run
  }
  static func glyphWidth(_ glyph: String, fontName: String, size: CGFloat) -> CGFloat {
    glyphRun(glyph, fontName: fontName, size: size).width
  }
  /// عرض نصّ عبر محرّك النصّ — لوضع النصّ المتدفّق، حيث الخطّ عربيّ عادي والتشكيل مطلوب.
  /// لا يصلح لخطوط الصفحات: جدول morx فيها يستبدل الرموز فيختلف المقيس عن المرسوم.
  static func textWidth(_ s: String, fontName: String, size: CGFloat) -> CGFloat {
    let font = CTFontCreateWithName(fontName as CFString, size, nil)
    let attr = NSAttributedString(string: s, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font])
    return CGFloat(CTLineGetTypographicBounds(CTLineCreateWithAttributedString(attr), nil, nil, nil))
  }
  /// يُقاس السطر كما يُرسم تمامًا: بجمع عروض الرموز من cmap.
  /// القياس عبر محرّك النصّ (CTLine) يخضع لجدول morx نفسه الذي نتجاوزه في الرسم،
  /// فلو قِسنا به لاختلف المقيس عن المرسوم واختلّت الملاءمة.
  static func maxLineWidth(fontName: String, size: CGFloat, lines: [MushafLine]) -> CGFloat {
    var maxW: CGFloat = 0
    for l in lines {
      let ws = l.words
      if ws.isEmpty { continue }
      var w: CGFloat = 0
      for word in ws { w += glyphWidth(word.glyph, fontName: fontName, size: size) }
      maxW = max(maxW, w)
    }
    return maxW
  }
}

/// صفحة من مصحف المدينة بخط صفحتها (QCF v1): 15 سطرًا (8 في الفاتحة وأول البقرة داخل إطار)، كل كلمة عنصر مستقل (نقر، تظليل، إخفاء)
struct MushafPageView: View {
  @Environment(MushafReaderState.self) private var rs
  let page: Int
  var showChrome = true
  var insets = EdgeInsets()

  var body: some View {
    let layout = MushafLayout.shared
    let lines = layout.lines(ofPage: page)
    let label = QuranText.shared.label(ofPage: page)
    let fontReady = MushafFonts.shared.ensurePage(page)
    let _ = MushafFonts.shared.ensureAmiri()
    let palette = rs.palette
    GeometryReader { geo in
      let sideInset = max(geo.size.width * 0.035, max(insets.leading, insets.trailing))
      let W = geo.size.width - 2 * sideInset
      let base = W / MushafMetrics.fullLineEm
      VStack(spacing: 0) {
        if showChrome, let label { PageHead(page: page, label: label, size: base, palette: palette).padding(.horizontal, W * 0.01) }
        GeometryReader { inner in
          let H = inner.size.height - base * 0.6
          let fit = MushafMetrics.fit(page: page, lines: lines, width: W, height: H)
          let rowH = fit.bodyHeight / CGFloat(MushafMetrics.rows)
          let short = lines.count < MushafMetrics.rows
          ZStack {
            VStack(spacing: 0) {
              ForEach(0..<MushafMetrics.rows, id: \.self) { i in
                let idx = short ? i - 3 : i
                Group { if idx >= 0 && idx < lines.count { row(lines[idx], size: fit.fontSize, rowH: rowH, width: W) } else { Color.clear } }
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
          Text(QuranMeta.arabicDigits(page)).font(.custom(MushafFonts.amiriQuranFont, fixedSize: base * 0.8)).foregroundStyle(palette.ink.opacity(0.85)).padding(.top, base * 0.1)
        }
      }
      .padding(.top, max(insets.top, 8)).padding(.bottom, max(insets.bottom, 6)).padding(.horizontal, sideInset)
      .frame(width: geo.size.width, height: geo.size.height)
    }
    .environment(\.layoutDirection, .rightToLeft)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("صفحة \(page)")
    .accessibilityValue(accessibilityText)
    // القارئ بالمساعدات لا يصيب شريط الكلمة: الآيات تُحدَّد بإجراءات مسمّاة وتُفتح خياراتها بإجراء
    .accessibilityAction(named: "تحديد الآية التالية") { stepSelection(1) }
    .accessibilityAction(named: "تحديد الآية السابقة") { stepSelection(-1) }
    .accessibilityAction(named: "خيارات الآية المحدّدة") { if let s = rs.selected { rs.onLongPressAyah?(s) } }
  }

  private var accessibilityText: String {
    let ay = QuranText.shared.pageAyahs(page)
    let sel = rs.selected.flatMap { s in ay.first { $0.n == s } }.map { "الآية المحدّدة \($0.ayah). " } ?? ""
    return sel + ay.map { "\($0.text) (\($0.ayah))" }.joined(separator: " ")
  }
  /// ينقل التحديد آيةً إلى الأمام أو الخلف داخل الصفحة (ولا يلغيه عند الطرف)
  private func stepSelection(_ d: Int) {
    let ay = QuranText.shared.pageAyahs(page); guard !ay.isEmpty else { return }
    let i = rs.selected.flatMap { s in ay.firstIndex { $0.n == s } }
    let j = i.map { min(max($0 + d, 0), ay.count - 1) } ?? (d > 0 ? 0 : ay.count - 1)
    guard ay[j].n != rs.selected else { return }
    rs.onTapAyah?(ay[j].n)
  }

  @ViewBuilder
  private func row(_ line: MushafLine, size: CGFloat, rowH: CGFloat, width: CGFloat) -> some View {
    switch line {
    case .header(let s):
      SurahHeader(surah: s, size: size, palette: rs.palette).frame(height: min(rowH * 0.88, size * 1.45)).padding(.horizontal, size * 0.1)
    case .basmala:
      Text(QuranMeta.basmala).font(.custom(MushafFonts.amiriQuranFont, fixedSize: size * 0.98)).foregroundStyle(rs.palette.ink).lineLimit(1).minimumScaleFactor(0.5).frame(maxWidth: width * 0.62)
    case .words(let ws):
      MushafLineView(words: ws, page: page, size: size, maxWidth: width).frame(maxWidth: .infinity)
    }
  }
}

/// سطر كامل بخطّ الصفحة، مرسومٌ برموزه مباشرة.
///
/// خطوط QCF تحمل جدول `morx` من آبل (ولا تحمل GSUB/GPOS)، وفيه استبدالٌ سياقيّ عربيّ
/// يُطبّقه CoreText افتراضيًا. ورموزُ هذه الخطوط حروفٌ عربية حقيقية في يونيكود
/// (U+FB6C = ARABIC LETTER VEH INITIAL FORM مثلًا)، فيرى المُشكِّل سلسلةَ حروفٍ متّصلة
/// ويستبدل صورها بأخرى من عائلة الحرف — فتظهر كلماتٌ في غير مواضعها في صفحة المصحف.
/// ولا يوجد في جدول `feat` إعدادٌ يُطفئ ذلك الاتّصال.
///
/// فنتجاوز محرّك النصّ كلّه: تُحوَّل الرموز إلى معرّفات عبر cmap وحده، وتُرسم بـ
/// CTFontDrawGlyphs في مواضع نحسبها من عروضها. لا تشكيل ولا ربط ولا إعادة ترتيب.
struct MushafLineView: View {
  @Environment(MushafReaderState.self) private var rs
  let words: [MushafWord]
  let page: Int
  let size: CGFloat
  let maxWidth: CGFloat

  var body: some View {
    let fontName = MushafFonts.pageFontName(page)
    let styles = words.map { rs.style(n: $0.n, k: $0.k, base: $0.end ? rs.palette.marker : rs.palette.ink) }
    let runs = words.map { MushafMetrics.glyphRun($0.glyph, fontName: fontName, size: size) }
    let lineWidth = runs.reduce(CGFloat.zero) { $0 + $1.width }
    let m = MushafMetrics.fontMetrics(fontName: fontName, size: size)
    // حارس: لو فاض السطر رغم الملاءمة، تقلّص كاملًا بدل أن يُقتطع طرفه
    let scale = (lineWidth > 0 && maxWidth > 0) ? min(1, maxWidth / lineWidth) : 1
    Canvas { ctx, canvasSize in
      paint(ctx, width: canvasSize.width, fontName: fontName, runs: runs, styles: styles, ascent: m.ascent)
    }
    .frame(width: max(1, lineWidth), height: max(1, m.height))
    .background { band(runs: runs, styles: styles, marksLayer: false) }
    .overlay { band(runs: runs, styles: styles, marksLayer: true) }
    .scaleEffect(scale, anchor: .center)
  }

  /// يرسم رموز السطر من اليمين إلى اليسار بمواضع محسوبة من عروضها
  private func paint(_ ctx: GraphicsContext, width: CGFloat, fontName: String,
                     runs: [MushafMetrics.GlyphRun], styles: [MushafReaderState.WordStyle], ascent: CGFloat) {
    let font = CTFontCreateWithName(fontName as CFString, size, nil)
    ctx.withCGContext { cg in
      cg.textMatrix = .identity
      cg.translateBy(x: 0, y: ascent)
      cg.scaleBy(x: 1, y: -1)
      var x = width
      for (i, w) in words.enumerated() {
        let run = runs[i]
        let st = styles[i]
        let many = run.ids.count > 1
        for gi in run.ids.indices {
          x -= run.advances[gi]
          if st.hidden { continue }
          let color: Color
          if w.rub && many && gi == 0 { color = rs.palette.rub }
          else if w.sajda && many && gi == run.ids.count - 1 { color = rs.palette.marker }
          else { color = st.fg }
          cg.setFillColor(UIColor(color).cgColor)
          var g = run.ids[gi]
          var pt = CGPoint(x: x, y: 0)
          CTFontDrawGlyphs(font, &g, &pt, 1, cg)
        }
      }
    }
  }

  /// شريط بعرض كل كلمة: تحت النصّ خلفياتُ التظليل والستر، وفوقه النقرُ والعلامات
  private func band(runs: [MushafMetrics.GlyphRun], styles: [MushafReaderState.WordStyle], marksLayer: Bool) -> some View {
    HStack(spacing: 0) {
      ForEach(Array(words.enumerated()), id: \.offset) { i, w in
        let st = styles[i]
        Color.clear
          .frame(width: max(1, runs[i].width))
          .overlay {
            if !marksLayer, let bg = st.bg { RoundedRectangle(cornerRadius: size * 0.16).fill(bg) }
          }
          .overlay(alignment: .bottom) {
            // خطّ سفليّ صريح: القارئ يعرف أن الكلمة مستورة عمدًا، لا ساقطة من المصحف
            if marksLayer && st.hidden { Capsule().fill(rs.accents.hideLine).frame(height: max(1, size * 0.045)).padding(.horizontal, size * 0.08) }
          }
          .overlay {
            if marksLayer && st.current { RoundedRectangle(cornerRadius: size * 0.16).stroke(rs.accents.hideLine, lineWidth: 1) }
          }
          .contentShape(Rectangle())
          .onTapGesture { if marksLayer { rs.onTapAyah?(w.n) } }
          .onLongPressGesture(minimumDuration: 0.4, maximumDistance: 12) { if marksLayer { rs.onLongPressAyah?(w.n) } }
      }
    }
  }
}

/// رأس الصفحة: اسم السورة والجزء متعاكسان بين الصفحات اليمنى (الفردية) واليسرى (الزوجية)
struct PageHead: View {
  let page: Int; let label: QuranText.PageLabel; let size: CGFloat; let palette: MushafPalette
  var body: some View {
    let surah = Text("سُورَةُ \(QuranMeta.surah(label.surah).vocalized)")
    let juz = Text(QuranMeta.juzName(label.juz))
    HStack(alignment: .firstTextBaseline) {
      if page % 2 == 1 { surah; Spacer(minLength: 8); juz } else { juz; Spacer(minLength: 8); surah }
    }
    .font(.custom(MushafFonts.amiriQuranFont, fixedSize: size * 0.66)).foregroundStyle(palette.ink.opacity(0.85)).lineLimit(1).minimumScaleFactor(0.6)
  }
}

/// إطار اسم السورة: حدّ ذهبي مزدوج وزخرفة جانبية، والاسم برموز خط sura_names («001 surah») أو نصًا عاديًا
struct SurahHeader: View {
  let surah: Int; let size: CGFloat; let palette: MushafPalette
  var plain = false
  var body: some View {
    let _ = plain ? MushafFonts.shared.ensureAmiri() : MushafFonts.shared.ensureSurahNames()
    ZStack {
      RoundedRectangle(cornerRadius: 4).fill(palette.paper)
      HStack(spacing: 0) {
        Ornament(color: palette.gold2).mask(LinearGradient(colors: [.black, .black, .clear], startPoint: .leading, endPoint: .trailing))
        Spacer(minLength: size * 3)
        Ornament(color: palette.gold2).mask(LinearGradient(colors: [.clear, .black, .black], startPoint: .leading, endPoint: .trailing))
      }
      .padding(4)
      RoundedRectangle(cornerRadius: 4).strokeBorder(palette.gold1, lineWidth: 1)
      RoundedRectangle(cornerRadius: 3).inset(by: 2).strokeBorder(palette.gold2, lineWidth: 1)
      Group {
        if plain { Text("سورة \(QuranMeta.surah(surah).name)").font(.custom(MushafFonts.amiriQuranFont, fixedSize: size * 0.9)) }
        else { Text(String(format: "%03d surah", surah)).font(.custom(MushafFonts.surahNamesFont, fixedSize: size * 0.86)).environment(\.layoutDirection, .leftToRight) }
      }
      .foregroundStyle(palette.ink).lineLimit(1).minimumScaleFactor(0.6).padding(.horizontal, size * 0.6).background(palette.paper)
    }
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .accessibilityLabel("سورة \(QuranMeta.surah(surah).name)")
  }
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
          ctx.fill(d, with: .color(color)); x += step
        }
      }
      .frame(maxWidth: .infinity)
    }
  }
}

/// إطار الفاتحة وأول البقرة
struct ShortPageFrame: View {
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
