import SwiftUI
import UIKit
import SakinahCore

/// بطاقة ذكر: النص (الآيات داخل ﴿ ﴾ بلون مميز)، الفضل والتخريج، عدّاد بهدف، وأزرار الاستماع/النسخ/المشاركة
struct DhikrCard: View {
  @Environment(AppModel.self) private var model
  let text: String
  let target: Int
  let count: Int
  var virtue: String? = nil
  var reference: String? = nil
  var note: String? = nil
  var audioURL: URL? = nil
  var isPlayingAudio = false
  var shareTitle: String
  var shareText: String
  var onTap: () -> Void
  var onAudio: (() -> Void)? = nil
  var onShareImage: () -> Void
  @State private var shareItems: ShareItems?

  var body: some View {
    let numerals = model.settings.numerals
    let scale = model.content.textScale
    let done = count >= target
    VStack(alignment: .leading, spacing: 10) {
      Text(rich(text, scale: scale)).lineSpacing(9 * scale).multilineTextAlignment(.leading).frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle()).onTapGesture { onTap() }
      if let v = virtue { Text("✦ \(v)").font(.arabic(13 * scale)).foregroundStyle(Theme.primary) }
      HStack(alignment: .bottom) {
        VStack(alignment: .leading, spacing: 4) {
          if let r = reference { Text(r).font(.arabic(11)).foregroundStyle(.secondary) }
          if let n = note { Text(n).font(.arabic(11)).foregroundStyle(.tertiary) }
          Text("يُقال \(repeatLabel(target, numerals: numerals))").font(.arabic(11)).foregroundStyle(.tertiary)
          HStack(spacing: 4) {
            if audioURL != nil { iconButton(isPlayingAudio ? "pause.circle" : "play.circle", "استماع") { onAudio?() } }
            iconButton("doc.on.doc", "نسخ") { UIPasteboard.general.string = shareText; UINotificationFeedbackGenerator().notificationOccurred(.success) }
            iconButton("square.and.arrow.up", "مشاركة") { shareItems = ShareItems(items: [shareText]) }
            iconButton("photo", "مشاركة كصورة") { onShareImage() }
          }
        }
        Spacer()
        Button(action: onTap) {
          ZStack {
            Circle().stroke(Color.secondary.opacity(0.2), lineWidth: 5)
            Circle().trim(from: 0, to: target > 0 ? min(1, Double(count) / Double(target)) : 0).stroke(Theme.primary, style: StrokeStyle(lineWidth: 5, lineCap: .round)).rotationEffect(.degrees(-90))
            if done { Image(systemName: "checkmark").font(.system(size: 22, weight: .bold)).foregroundStyle(Theme.primary) }
            else { VStack(spacing: 0) { Text(Fmt.number(max(0, target - count), numerals: numerals)).font(.arabic(20, weight: .bold)); Text(target == 1 ? "مرة" : "متبقٍ").font(.arabic(9)).foregroundStyle(.secondary) } }
          }
          .frame(width: 64, height: 64)
        }
        .buttonStyle(.plain).accessibilityLabel("عدّ")
      }
    }
    .padding(14)
    .background(done ? Theme.primary.opacity(0.07) : Theme.cardBackground, in: RoundedRectangle(cornerRadius: 16))
    .overlay(RoundedRectangle(cornerRadius: 16).stroke(done ? Theme.primary.opacity(0.35) : .clear, lineWidth: 1))
    .sheet(item: $shareItems) { ShareSheet(items: $0.items) }
  }
  private func iconButton(_ icon: String, _ label: String, action: @escaping () -> Void) -> some View {
    Button(action: action) { Image(systemName: icon).font(.system(size: 15)).frame(width: 30, height: 30) }.buttonStyle(.plain).foregroundStyle(.secondary).accessibilityLabel(label)
  }
  static func repeatLabel(_ n: Int, numerals: String) -> String { n == 1 ? "مرة واحدة" : n == 2 ? "مرتين" : n <= 10 ? "\(Fmt.number(n, numerals: numerals)) مرات" : "\(Fmt.number(n, numerals: numerals)) مرة" }
  private func repeatLabel(_ n: Int, numerals: String) -> String { Self.repeatLabel(n, numerals: numerals) }
  /// إبراز الآيات داخل ﴿ ﴾ بخط أميري قرآن ولون الذهب
  private func rich(_ t: String, scale: Double) -> AttributedString {
    var out = AttributedString()
    var buf = ""; var inAyah = false
    func flush() { guard !buf.isEmpty else { return }; var a = AttributedString(buf); a.font = inAyah ? .custom(MushafFonts.amiriQuranFont, fixedSize: 17 * scale) : .arabic(17 * scale); a.foregroundColor = inAyah ? Theme.gold : .primary; out.append(a); buf = "" }
    for ch in t {
      if ch == "﴿" { flush(); inAyah = true; buf.append(ch) } else if ch == "﴾" { buf.append(ch); flush(); inAyah = false } else { buf.append(ch) }
    }
    flush(); return out
  }
}
