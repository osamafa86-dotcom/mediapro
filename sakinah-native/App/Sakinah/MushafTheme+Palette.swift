import SwiftUI
import SakinahCore

extension Color {
  init(hex: String) { let c = HexColor(hex) ?? HexColor("#000000")!; self.init(red: c.r, green: c.g, blue: c.b) }
}

/// ألوان تظليل وإخفاء (تُشتق من السمة)
struct MushafAccents {
  var highlight: Color; var selection: Color; var hide: Color; var hideLine: Color; var wordLine: Color
  /// ومضة تحت الكلمات التي كُشفت للتوّ في المراجعة، ومؤشّر الكلمة المطلوبة الآن
  var reveal: Color; var cursor: Color
}

extension MushafPalette {
  /// لوحة ألوان من سمة الويب نفسها (ورق/حبر) مع ألوان الإطار والعلامات للفاتح أو الداكن
  init(theme: MushafTheme) {
    self.init()
    let dark = theme.isDark
    paper = Color(hex: theme.paper); ink = Color(hex: theme.ink)
    marker = Color(hex: dark ? "#c9a851" : "#8f7430"); rub = Color(hex: dark ? "#e06b95" : "#b8336a")
    gold1 = Color(hex: dark ? "#b8993f" : "#a98a3a"); gold2 = Color(hex: dark ? "#8d7434" : "#cfb46f"); gold3 = Color(hex: dark ? "#4a3f22" : "#e9dcb2")
  }
  static func accents(for theme: MushafTheme) -> MushafAccents {
    let dark = theme.isDark
    return MushafAccents(highlight: dark ? Color(red: 45/255, green: 212/255, blue: 191/255).opacity(0.22) : Color(red: 15/255, green: 118/255, blue: 110/255).opacity(0.16),
                         selection: dark ? Color(red: 226/255, green: 176/255, blue: 74/255).opacity(0.3) : Color(red: 183/255, green: 121/255, blue: 31/255).opacity(0.22),
                         // الكلمة المستورة تُرسم أشكالُها مطموسةً خلف ضباب فوق وسادة خفيفة جدًا — لا لوحًا رماديًا
                         hide: dark ? Color(red: 236/255, green: 229/255, blue: 210/255).opacity(0.07) : Color(red: 60/255, green: 50/255, blue: 20/255).opacity(0.055),
                         hideLine: dark ? Color(red: 236/255, green: 229/255, blue: 210/255).opacity(0.3) : Color(red: 60/255, green: 50/255, blue: 20/255).opacity(0.25),
                         wordLine: Color(hex: dark ? "#b8993f" : "#a98a3a").opacity(0.38),
                         reveal: Color(hex: dark ? "#c9a851" : "#b8962e").opacity(dark ? 0.3 : 0.26),
                         cursor: Color(hex: dark ? "#2dd4bf" : "#0f766e"))
  }
  /// لون العلامة داخل القارئ — يتبع سمة الورق لا سمة النظام، فقد يقرأ المرء على ورق داكن ونظامه فاتح
  static func brand(for theme: MushafTheme) -> Color { Color(hex: theme.isDark ? "#2dd4bf" : "#0f766e") }
  /// ما يُكتب أو يُرسم فوق لون العلامة
  static func onBrand(for theme: MushafTheme) -> Color { Color(hex: theme.isDark ? "#0c1514" : "#f6f1e2") }
  /// الذهبي ومساره: خطّ موضع الصفحة في الشريط الموحّد
  static func gold(for theme: MushafTheme) -> Color { Color(hex: theme.isDark ? "#b8993f" : "#a98a3a") }
  static func goldTrack(for theme: MushafTheme) -> Color { Color(hex: theme.isDark ? "#4a3f22" : "#e9dcb2") }

  /// خلفية الصفحة: تدرّج هادئ للسمات المتدرّجة وإلا لون الورق
  static func background(for theme: MushafTheme) -> AnyShapeStyle {
    if theme.gradient != nil { return AnyShapeStyle(LinearGradient(colors: [Color(hex: theme.paper).opacity(1), Color(hex: theme.paper2)], startPoint: .topTrailing, endPoint: .bottomLeading)) }
    return AnyShapeStyle(Color(hex: theme.paper))
  }
  /// لون حكم تجويد بالرمز
  static func tajweedColor(_ code: String?, dark: Bool) -> Color? {
    guard let code else { return nil }
    let g = Tajweed.group(of: code); let t = Catalog.shared.tajweed
    return (dark ? t.dark[g] : t.light[g]).map { Color(hex: $0) }
  }
}
