import SwiftUI
import UIKit
import SakinahCore

/// بطاقة ذكر: النصّ بأميري (الآيات داخل ﴿ ﴾ بالذهبي)، الفضل والتخريج، عدّاد بحلقة، وأزرار بأقراص ناعمة
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
    return VStack(alignment: .trailing, spacing: DS.Space.s3) {
      Text(rich(text, scale: scale))
        .lineSpacing(9 * scale)
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
        .contentShape(Rectangle()).onTapGesture { onTap() }
      if let v = virtue {
        Text("✦ \(v)").font(DS.F.bodySm).foregroundStyle(DS.C.brandPrimary)
          .frame(maxWidth: .infinity, alignment: .trailing)
      }
      HStack(alignment: .bottom, spacing: DS.Space.s3) {
        Button(action: onTap) {
          ZStack {
            RingProgress(progress: target > 0 ? min(1, Double(count) / Double(target)) : 0,
                         tint: done ? DS.C.brandPrimary : DS.C.accentGold, lineWidth: 5)
            if done {
              Image(systemName: "checkmark").font(.system(size: 20, weight: .bold)).foregroundStyle(DS.C.brandPrimary)
            } else {
              VStack(spacing: 0) {
                Text(Fmt.number(max(0, target - count), numerals: numerals)).font(DS.F.numericMd).foregroundStyle(DS.C.textPrimary).monospacedDigit()
                Text(target == 1 ? "مرة" : "متبقٍ").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
              }
            }
          }
          .frame(width: 62, height: 62)
        }
        .buttonStyle(.plain).accessibilityLabel("عدّ")
        Spacer(minLength: 0)
        VStack(alignment: .trailing, spacing: DS.Space.s2) {
          if let r = reference { Text(r).font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary) }
          if let n = note { Text(n).font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary) }
          Text("يُقال \(repeatLabel(target, numerals: numerals))").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
          HStack(spacing: DS.Space.s2) {
            if audioURL != nil {
              DSIconButton(systemName: isPlayingAudio ? "pause.fill" : "play.fill",
                           style: isPlayingAudio ? .brand : .soft, size: 34, iconSize: 13, label: "استماع") { onAudio?() }
            }
            DSIconButton(systemName: "doc.on.doc", style: .soft, size: 34, iconSize: 13, label: "نسخ") {
              UIPasteboard.general.string = shareText; UINotificationFeedbackGenerator().notificationOccurred(.success)
            }
            DSIconButton(systemName: "square.and.arrow.up", style: .soft, size: 34, iconSize: 13, label: "مشاركة") {
              shareItems = ShareItems(items: [shareText])
            }
            DSIconButton(systemName: "photo", style: .soft, size: 34, iconSize: 13, label: "مشاركة كصورة") { onShareImage() }
          }
        }
      }
    }
    .padding(DS.Space.s4)
    .background(done ? DS.C.brandSoft.opacity(0.45) : DS.C.bgSurface,
                in: RoundedRectangle(cornerRadius: DS.Radius.xl, style: .continuous))
    .overlay {
      RoundedRectangle(cornerRadius: DS.Radius.xl, style: .continuous)
        .stroke(done ? DS.C.brandPrimary.opacity(0.35) : DS.C.borderSubtle, lineWidth: 1)
    }
    .shadow(color: done ? .clear : DS.C.shadowCard, radius: 10, x: 0, y: 3)
    .sheet(item: $shareItems) { ShareSheet(items: $0.items) }
  }

  static func repeatLabel(_ n: Int, numerals: String) -> String { n == 1 ? "مرة واحدة" : n == 2 ? "مرتين" : n <= 10 ? "\(Fmt.number(n, numerals: numerals)) مرات" : "\(Fmt.number(n, numerals: numerals)) مرة" }
  private func repeatLabel(_ n: Int, numerals: String) -> String { Self.repeatLabel(n, numerals: numerals) }

  /// إبراز الآيات داخل ﴿ ﴾ بخط أميري قرآن ولون الذهب، وسائر النصّ بأميري
  private func rich(_ t: String, scale: Double) -> AttributedString {
    var out = AttributedString()
    var buf = ""; var inAyah = false
    func flush() {
      guard !buf.isEmpty else { return }
      var a = AttributedString(buf)
      a.font = inAyah ? .custom(MushafFonts.amiriQuranFont, fixedSize: 17 * scale) : DS.amiri(17 * scale)
      a.foregroundColor = inAyah ? DS.C.accentGoldStrong : DS.C.textPrimary
      out.append(a); buf = ""
    }
    for ch in t {
      if ch == "﴿" { flush(); inAyah = true; buf.append(ch) }
      else if ch == "﴾" { buf.append(ch); flush(); inAyah = false }
      else { buf.append(ch) }
    }
    flush(); return out
  }
}
