import SwiftUI
import Observation
import SakinahCore

/// حالة القارئ المشتركة بين صفحاته: السمة والألوان، الآية المحدّدة، الآية والكلمة الجاريتان في التلاوة، جلسة الحفظ، وخيارات العرض
@Observable
final class MushafReaderState {
  var theme: MushafTheme
  var palette: MushafPalette
  var accents: MushafAccents
  var selected: Int?
  var playingAyah: Int?
  /// موضع الكلمة الجارية (1..) داخل الآية الجارية
  var playingWord: Int?
  var hifz: HifzSession?
  var prefs: QuranPrefs?
  var hifzOnlyCurrent: Bool { prefs?.hifzOnlyCurrent ?? true }
  var textMode: Bool { prefs?.isTextMode ?? false }
  var textFont: String { prefs?.textFont ?? "amiri" }
  var fontScale: Double { prefs?.fontScale ?? 1 }
  var lineHeight: Double { prefs?.lineHeight ?? 2.15 }
  var fitText: Bool { prefs?.fitText ?? true }
  var tajweed: Bool { prefs?.tajweed ?? false }
  var wordHighlight: Bool { prefs?.wordHighlight ?? true }
  @ObservationIgnored var onTapAyah: ((Int) -> Void)?

  init(theme: MushafTheme) { self.theme = theme; palette = MushafPalette(theme: theme); accents = MushafPalette.accents(for: theme) }
  func apply(theme t: MushafTheme) { theme = t; palette = MushafPalette(theme: t); accents = MushafPalette.accents(for: t) }
  var isDark: Bool { theme.isDark }

  struct WordStyle { var fg: Color; var bg: Color?; var current = false; var hidden = false }
  /// لون الكلمة وخلفيتها بحسب الحالة: مخفية في المراجعة، جارية في التلاوة، أو داخل آية محدّدة/مشغَّلة
  func style(n: Int, k: Int, base: Color? = nil) -> WordStyle {
    var s = WordStyle(fg: base ?? palette.ink, bg: nil)
    if let h = hifz, h.page == QuranText.shared.ayah(n)?.page, k >= 0 {
      if h.isHidden(n: n, k: k, onlyCurrent: hifzOnlyCurrent) { s.fg = .clear; s.bg = accents.hide; s.hidden = true; s.current = h.isCurrent(n: n, k: k); return s }
    }
    if playingAyah == n {
      s.bg = accents.highlight
      if wordHighlight, let w = playingWord, w - 1 == k { s.bg = accents.wordLine }
    }
    if selected == n { s.bg = accents.selection }
    return s
  }
}

/// تخطيط انسيابي من اليمين إلى اليسار بأسطر مضبوطة (كل سطر إلا الأخير يُوزَّع الفراغ بين كلماته، والأخير يُوسَّط)
struct FlowLayout: Layout {
  var spacing: CGFloat
  var lineHeight: CGFloat
  var justify = true

  struct Cache { var sizes: [CGSize] = []; var width: CGFloat = -1; var rows: [[Int]] = [] }
  func makeCache(subviews: Subviews) -> Cache { Cache() }
  private func compute(_ subviews: Subviews, width: CGFloat, cache: inout Cache) {
    if cache.width == width && cache.sizes.count == subviews.count { return }
    cache.sizes = subviews.map { $0.sizeThatFits(.unspecified) }
    var rows: [[Int]] = [[]]; var x: CGFloat = 0
    for (i, sz) in cache.sizes.enumerated() {
      let w = sz.width
      if !rows[rows.count - 1].isEmpty && x + spacing + w > width { rows.append([]); x = 0 }
      if rows[rows.count - 1].isEmpty { x = w } else { x += spacing + w }
      rows[rows.count - 1].append(i)
    }
    cache.rows = rows.filter { !$0.isEmpty }; cache.width = width
  }
  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout Cache) -> CGSize {
    let width = proposal.width ?? 320
    compute(subviews, width: width, cache: &cache)
    return CGSize(width: width, height: CGFloat(max(1, cache.rows.count)) * lineHeight)
  }
  func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout Cache) {
    compute(subviews, width: bounds.width, cache: &cache)
    for (r, row) in cache.rows.enumerated() {
      let y = bounds.minY + CGFloat(r) * lineHeight + lineHeight / 2
      let total = row.reduce(CGFloat(0)) { $0 + cache.sizes[$1].width }
      let gaps = CGFloat(max(0, row.count - 1))
      let extra = bounds.width - total - gaps * spacing
      let last = r == cache.rows.count - 1
      let gap = (justify && !last && gaps > 0) ? spacing + extra / gaps : spacing
      var x = bounds.maxX - ((last || !justify || gaps == 0) ? max(0, extra) / 2 : 0)
      for i in row {
        let w = cache.sizes[i].width
        subviews[i].place(at: CGPoint(x: x - w / 2, y: y), anchor: .center, proposal: .unspecified)
        x -= w + gap
      }
    }
  }
}
