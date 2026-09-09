import SwiftUI

/// ألوان وخطوط التطبيق (الهوية نفسها في نسخة الويب: أخضر مزرق هادئ وذهبي)
enum Theme {
  static let primary = Color(red: 0.059, green: 0.463, blue: 0.431)      // #0f766e
  static let primaryStrong = Color(red: 0.04, green: 0.34, blue: 0.32)
  static let gold = Color(red: 0.66, green: 0.54, blue: 0.23)
  static let paper = Color(red: 0.965, green: 0.945, blue: 0.886)
  static let cardBackground = Color(.secondarySystemGroupedBackground)
  static let background = Color(.systemGroupedBackground)
}

extension Font {
  static func arabic(_ size: CGFloat, weight: Font.Weight = .regular) -> Font { .system(size: size, weight: weight, design: .rounded) }
}
