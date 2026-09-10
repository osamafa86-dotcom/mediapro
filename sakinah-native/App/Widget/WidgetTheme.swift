import SwiftUI

/// رموز التصميم للودجت والنشاط المباشر (مطابقة لملف Figma) — نسخة مستقلّة لأن هدف الامتداد لا يبني ملفات التطبيق
enum WDS {
  static let brandPrimary = Color(red: 0.055, green: 0.361, blue: 0.333)
  static let brandSoft = Color(red: 0.804, green: 0.906, blue: 0.890)
  static let nightTop = Color(red: 0.055, green: 0.361, blue: 0.333)
  static let nightBottom = Color(red: 0.024, green: 0.141, blue: 0.129)
  static let accentGold = Color(red: 0.776, green: 0.612, blue: 0.243)
  static let accentGoldSoft = Color(red: 0.886, green: 0.780, blue: 0.478)
  static let textOnDark = Color(red: 0.984, green: 0.976, blue: 0.957)
  static let textOnDarkMuted = Color(red: 0.624, green: 0.820, blue: 0.792)
  static let textPrimary = Color(red: 0.086, green: 0.129, blue: 0.122)

  /// تدرّج «الليل» نفسه في التطبيق
  static var night: LinearGradient {
    LinearGradient(colors: [nightTop, nightBottom], startPoint: .topTrailing, endPoint: .bottomLeading)
  }
}

/// حلقات ذهبية شفافة خلف بطاقات الليل
struct WidgetDecor: View {
  var body: some View {
    GeometryReader { geo in
      let w = geo.size.width
      ZStack {
        Circle().stroke(WDS.accentGold.opacity(0.14), lineWidth: 1).frame(width: w * 0.9, height: w * 0.9)
          .position(x: w * 0.06, y: geo.size.height * 0.1)
        Circle().stroke(WDS.accentGold.opacity(0.10), lineWidth: 1).frame(width: w * 0.6, height: w * 0.6)
          .position(x: w * 0.95, y: geo.size.height * 0.95)
      }
    }
    .allowsHitTesting(false)
  }
}

/// شريط تقدّم رفيع بلون ذهبي على مسار شفاف
struct WidgetProgressBar: View {
  let progress: Double
  var height: CGFloat = 3
  var body: some View {
    GeometryReader { geo in
      ZStack(alignment: .trailing) {
        Capsule().fill(WDS.textOnDark.opacity(0.18))
        Capsule().fill(WDS.accentGold).frame(width: max(2, geo.size.width * min(1, max(0, progress))))
      }
    }
    .frame(height: height)
  }
}
