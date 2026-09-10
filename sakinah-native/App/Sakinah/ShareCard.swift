import SwiftUI
import UIKit
import SakinahCore

struct ShareItems: Identifiable { let id = UUID(); let items: [Any] }
/// ورقة المشاركة (UIActivityViewController)
struct ShareSheet: UIViewControllerRepresentable {
  let items: [Any]
  func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: items, applicationActivities: nil) }
  func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}

/// طلب بطاقة مشاركة: عنوان ونص وتذييل، وهل النص قرآني (خط أميري قرآن)
struct ShareCardRequest: Identifiable { let id = UUID(); var title: String; var text: String; var footer: String; var quran = false; var shareText: String; var filename: String }

enum ShareCardTheme: String, CaseIterable, Identifiable {
  case green, gold, night, paper
  var id: String { rawValue }
  var name: String { switch self { case .green: return "أخضر"; case .gold: return "ذهبي"; case .night: return "ليلي"; case .paper: return "ورقي" } }
  var bg: [Color] { switch self { case .green: return [Color(hex: "#0f766e"), Color(hex: "#134e4a")]; case .gold: return [Color(hex: "#f6f1e2"), Color(hex: "#eadbb9")]; case .night: return [Color(hex: "#1a1e2a"), Color(hex: "#0f1119")]; case .paper: return [Color(hex: "#fbfaf6"), Color(hex: "#efe7d1")] } }
  var fg: Color { switch self { case .green, .night: return Color(hex: "#f6f1e2"); case .gold, .paper: return Color(hex: "#1d1a14") } }
  var accent: Color { switch self { case .green: return Color(hex: "#cfb46f"); case .gold: return Color(hex: "#a98a3a"); case .night: return Color(hex: "#c9a851"); case .paper: return Color(hex: "#0f766e") } }
}

/// بطاقة المشاركة بعرض 1080 بكسل (تُرسم بـ ImageRenderer)
struct ShareCardView: View {
  let request: ShareCardRequest
  let theme: ShareCardTheme
  var body: some View {
    let len = request.text.count
    let size: CGFloat = len > 900 ? 30 : len > 600 ? 34 : len > 350 ? 38 : len > 180 ? 44 : len > 80 ? 50 : 56
    VStack(alignment: .center, spacing: 40) {
      HStack { Text("سكينة").font(.system(size: 30, weight: .bold, design: .rounded)).foregroundStyle(theme.accent); Spacer(); Text(request.title).font(.system(size: 28, weight: .semibold)).foregroundStyle(theme.fg.opacity(0.85)).lineLimit(1) }
      RoundedRectangle(cornerRadius: 2).fill(theme.accent).frame(width: 140, height: 4)
      Text(request.text).font(request.quran ? .custom(MushafFonts.amiriQuranFont, fixedSize: size) : .system(size: size, weight: .regular)).foregroundStyle(theme.fg).multilineTextAlignment(.center).lineSpacing(size * 0.75).frame(maxWidth: .infinity)
      if !request.footer.isEmpty { Text(request.footer).font(.system(size: 28)).foregroundStyle(theme.fg.opacity(0.75)).multilineTextAlignment(.center) }
    }
    .padding(80)
    .frame(width: 1080)
    .background(LinearGradient(colors: theme.bg, startPoint: .topTrailing, endPoint: .bottomLeading))
    .environment(\.layoutDirection, .rightToLeft)
  }
}

enum ShareCard {
  @MainActor static func render(_ req: ShareCardRequest, theme: ShareCardTheme) -> UIImage? {
    _ = MushafFonts.shared.ensureAmiri()
    let r = ImageRenderer(content: ShareCardView(request: req, theme: theme)); r.scale = 1; r.proposedSize = ProposedViewSize(width: 1080, height: nil)
    return r.uiImage
  }
}

/// معاينة البطاقة واختيار سمتها ثم المشاركة صورةً أو نصًا
struct ShareCardSheet: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  let request: ShareCardRequest
  @State private var theme: ShareCardTheme = .green
  @State private var share: ShareItems?
  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(spacing: 14) {
          ShareCardView(request: request, theme: theme).frame(width: 1080).scaleEffect(0.3, anchor: .top).frame(width: 324, height: 420, alignment: .top).clipped()
          HStack(spacing: 8) { ForEach(ShareCardTheme.allCases) { t in Button(t.name) { theme = t; model.content.shareTheme = t.rawValue }.buttonStyle(.bordered).tint(theme == t ? Theme.primary : .secondary) } }
          Button { if let img = ShareCard.render(request, theme: theme) { share = ShareItems(items: [img]) } } label: { Label("مشاركة الصورة", systemImage: "square.and.arrow.up").frame(maxWidth: .infinity) }.buttonStyle(.borderedProminent)
          Button { share = ShareItems(items: [request.shareText]) } label: { Label("مشاركة النص", systemImage: "text.quote").frame(maxWidth: .infinity) }.buttonStyle(.bordered)
        }
        .padding()
      }
      .navigationTitle("مشاركة كصورة").navigationBarTitleDisplayMode(.inline)
      .toolbar { ToolbarItem(placement: .cancellationAction) { Button("إغلاق") { dismiss() } } }
      .sheet(item: $share) { ShareSheet(items: $0.items) }
      .onAppear { theme = ShareCardTheme(rawValue: model.content.shareTheme) ?? .green }
    }
  }
}
