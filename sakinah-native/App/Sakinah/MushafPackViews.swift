import SwiftUI
import SakinahCore

/// بطاقة تنزيل صفحات المصحف في المكتبة: تُعرض ما دامت الحزمة غير مكتملة، وتذكر الحجم قبل التنزيل
/// (إرشاد App Store 4.2.3: الإفصاح عن حجم التنزيل الإضافي والاستئذان قبله)
struct MushafPackCard: View {
  @Environment(AppModel.self) private var model
  var body: some View {
    let pack = MushafPack.shared
    let numerals = model.settings.numerals
    VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .top, spacing: 12) {
        DSIcon(systemName: pack.phase == .failed ? "exclamationmark.icloud" : "icloud.and.arrow.down", style: .soft, size: 40, iconSize: 17)
        VStack(alignment: .leading, spacing: 4) {
          Text("صفحات المصحف بخط المدينة").font(DS.readex(14, .semibold)).foregroundStyle(DS.C.textPrimary)
          Text(MushafPackText.subtitle(pack, numerals: numerals)).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).fixedSize(horizontal: false, vertical: true)
        }
        Spacer(minLength: 0)
      }
      if pack.phase == .downloading || pack.phase == .verifying {
        ProgressView(value: pack.phase == .verifying ? 1 : pack.progress).tint(DS.C.brandPrimary)
      }
      MushafPackButton(pack: pack, numerals: numerals, fill: true)
    }
    .padding(16)
    .background(DS.C.bgSurface, in: RoundedRectangle(cornerRadius: DS.Radius.lg, style: .continuous))
    .overlay { RoundedRectangle(cornerRadius: DS.Radius.lg, style: .continuous).stroke(DS.C.borderSubtle, lineWidth: 1) }
    .accessibilityElement(children: .contain)
  }
}

/// شريط صغير في القارئ حين تُعرض الصفحة الحالية بوضع النص لأن خطها لم يُنزَّل بعد
struct MushafPackBanner: View {
  @Environment(AppModel.self) private var model
  let palette: MushafPalette
  var body: some View {
    let pack = MushafPack.shared
    let numerals = model.settings.numerals
    VStack(spacing: 8) {
      HStack(spacing: 10) {
        Image(systemName: "textformat").font(.system(size: 15, weight: .semibold)).foregroundStyle(palette.marker)
        Text(MushafPackText.bannerLine(pack, numerals: numerals)).font(DS.F.labelXs).foregroundStyle(palette.ink.opacity(0.8)).lineLimit(2).minimumScaleFactor(0.85)
        Spacer(minLength: 0)
        MushafPackButton(pack: pack, numerals: numerals, fill: false)
      }
      if pack.phase == .downloading { ProgressView(value: pack.progress).tint(palette.marker) }
    }
    .padding(.horizontal, 16).padding(.vertical, 10)
    .background(palette.ink.opacity(0.05))
  }
}

/// زرّ واحد يتبدّل بحسب الحالة: تنزيل · إيقاف · إعادة المحاولة
struct MushafPackButton: View {
  let pack: MushafPack
  let numerals: String
  var fill: Bool
  var body: some View {
    switch pack.phase {
    case .missing: DSButton(title: fill ? "تنزيل (\(MushafPackText.size(numerals)))" : "تنزيل", kind: .primary, icon: "arrow.down", fill: fill) { pack.download() }
    case .downloading: DSButton(title: "إيقاف", kind: .soft, fill: fill) { pack.cancel() }
    case .failed: DSButton(title: "إعادة المحاولة", kind: .primary, icon: "arrow.clockwise", fill: fill) { pack.download() }
    case .verifying, .ready: EmptyView()
    }
  }
}

enum MushafPackText {
  static func size(_ numerals: String) -> String { AudioDownloads.fmtBytes(Int(MushafPack.expectedSize), numerals: numerals) }
  static func percent(_ pack: MushafPack, _ numerals: String) -> String { "\(Fmt.number(Int(pack.progress * 100), numerals: numerals))٪" }

  static func subtitle(_ pack: MushafPack, numerals: String) -> String {
    switch pack.phase {
    case .missing: return "تنزيل لمرة واحدة بحجم \(size(numerals)). الفاتحة وجزء عمّ متاحان الآن، وبقية الصفحات تُعرض بوضع النص حتى يكتمل."
    case .downloading: return "جارٍ التنزيل · \(percent(pack, numerals)) من \(size(numerals)). يكمل التنزيل ولو خرجت من التطبيق."
    case .verifying: return "اكتمل التنزيل، جارٍ التحقق من الملف…"
    case .failed: return "تعذّر التنزيل. تحقّق من الاتصال ثم أعد المحاولة، ويُستأنف من حيث توقّف."
    case .ready: return "صفحات المصحف كاملة على جهازك."
    }
  }

  static func bannerLine(_ pack: MushafPack, numerals: String) -> String {
    switch pack.phase {
    case .downloading: return "تُنزَّل صفحات المصحف · \(percent(pack, numerals))"
    case .verifying: return "جارٍ التحقق من صفحات المصحف…"
    case .failed: return "تعذّر تنزيل صفحات المصحف"
    default: return "هذه الصفحة بوضع النص · صفحات المصحف \(size(numerals))"
    }
  }
}
