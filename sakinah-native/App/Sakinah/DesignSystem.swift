import SwiftUI
import UIKit
import CoreText

/// نظام تصميم «سكينة» — مطابق لملف Figma: ألوان دلالية بوضعين (فاتح/داكن)، خطوط Readex Pro (الواجهة والأرقام)،
/// Reem Kufi (العناوين والشعار)، Amiri (القراءة) وAmiri Quran (المصحف)، ومقياس مسافات وزوايا وظلال.
enum DS {
  // MARK: - الألوان (فاتح، داكن)
  static func color(_ light: UInt32, _ dark: UInt32) -> Color {
    Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
  }
  enum C {
    static let bgCanvas = color(0xF6F4EE, 0x0C1514)
    static let bgSurface = color(0xFFFFFF, 0x14211F)
    static let bgSubtle = color(0xECE8DF, 0x1C2C29)
    static let bgElevated = color(0xFBF9F4, 0x22342F)
    static let bgInverse = color(0x16211F, 0xFBF9F4)
    static let brandPrimary = color(0x0E5C55, 0x3FB5A6)
    static let brandStrong = color(0x0A4640, 0x6ED0C2)
    static let brandSoft = color(0xCDE7E3, 0x263733)
    static let brandDeep = color(0x0B3733, 0x14211F)
    static let accentGold = color(0xC69C3E, 0xD9B25B)
    static let accentGoldSoft = color(0xF3E7C9, 0x3A2F14)
    static let accentGoldStrong = color(0xA47E2C, 0xE2C77A)
    static let textPrimary = color(0x16211F, 0xFBF9F4)
    static let textSecondary = color(0x5D6B68, 0xA9B6B2)
    static let textTertiary = color(0x8A9794, 0x7C8A86)
    static let textOnBrand = color(0xFFFFFF, 0x0C1514)
    static let textOnDark = Color(hex: 0xFBF9F4)
    static let textOnDarkMuted = Color(hex: 0x9FD1CA)
    static let borderSubtle = color(0xE3DFD4, 0x263733)
    static let borderStrong = color(0xC9C4B7, 0x354944)
    static let paperPage = color(0xFBF7EC, 0x101817)
    static let paperInk = color(0x2A2521, 0xFBF9F4)
    static let success = color(0x2F855A, 0x7BC59A)
    static let warning = color(0xB7791F, 0xE0B25E)
    static let danger = color(0xC53030, 0xEF8A8A)
    /// تدرّج «الليل» للبطاقات البارزة (يبقى داكنًا في الوضعين عمدًا)
    static let nightTop = Color(hex: 0x0E5C55)
    static let nightBottom = Color(hex: 0x062421)
    static let shadowCard = Color(red: 0.08, green: 0.13, blue: 0.12).opacity(0.08)
    static let shadowFloat = Color(red: 0.08, green: 0.13, blue: 0.12).opacity(0.18)
  }
  static var nightGradient: LinearGradient { LinearGradient(colors: [C.nightTop, C.nightBottom], startPoint: .topTrailing, endPoint: .bottomLeading) }

  // MARK: - الخطوط
  /// تُسجَّل خطوط App/Fonts/ui (المولَّدة بـ tools/build-fonts.py) في CoreText عند الإقلاع
  static func registerFonts() {
    let urls = Bundle.main.urls(forResourcesWithExtension: "ttf", subdirectory: "Fonts/ui") ?? Bundle.main.urls(forResourcesWithExtension: "ttf", subdirectory: "ui") ?? []
    for url in urls { var err: Unmanaged<CFError>?; CTFontManagerRegisterFontsForURL(url as CFURL, .process, &err) }
  }
  static func readexName(_ weight: Font.Weight) -> String {
    switch weight {
    case .ultraLight, .thin, .light: return "ReadexPro-Light"
    case .medium: return "ReadexPro-Medium"
    case .semibold: return "ReadexPro-SemiBold"
    case .bold, .heavy, .black: return "ReadexPro-Bold"
    default: return "ReadexPro-Regular"
    }
  }
  static func readex(_ size: CGFloat, _ weight: Font.Weight = .regular, fixed: Bool = false) -> Font {
    fixed ? .custom(readexName(weight), fixedSize: size) : .custom(readexName(weight), size: size)
  }
  static func kufi(_ size: CGFloat, _ weight: Font.Weight = .semibold) -> Font {
    .custom(weight == .bold ? "ReemKufi-Bold" : (weight == .regular ? "ReemKufi-Regular" : "ReemKufi-SemiBold"), size: size)
  }
  static func amiri(_ size: CGFloat, bold: Bool = false) -> Font { .custom(bold ? "Amiri-Bold" : "Amiri-Regular", size: size) }
  static func quran(_ size: CGFloat) -> Font { MushafFonts.shared.ensureAmiri(); return .custom(MushafFonts.amiriQuranFont, size: size) }

  /// سلّم الأنماط كما في Figma (الاسم نفسه)
  enum F {
    static let displayHero = kufi(40, .bold)
    static let displayLg = kufi(30)
    static let displayMd = kufi(24)
    static let headingLg = readex(22, .semibold)
    static let headingMd = readex(18, .semibold)
    static let headingSm = readex(16, .semibold)
    static let bodyLg = readex(17)
    static let bodyMd = readex(15)
    static let bodySm = readex(13)
    static let labelMd = readex(14, .medium)
    static let labelSm = readex(12, .medium)
    static let labelXs = readex(11, .medium)
    static let numericHero = readex(56, .light, fixed: true)
    static let numericLg = readex(28, .medium, fixed: true)
    static let numericMd = readex(17, .medium, fixed: true)
    static let readingLg = amiri(22)
    static let readingMd = amiri(19)
    static let readingBold = amiri(20, bold: true)
    static var quranInline: Font { quran(22) }
  }

  // MARK: - المسافات والزوايا
  enum Space { static let s1: CGFloat = 4, s2: CGFloat = 8, s3: CGFloat = 12, s4: CGFloat = 16, s5: CGFloat = 20, s6: CGFloat = 24, s8: CGFloat = 32 }
  enum Radius { static let sm: CGFloat = 8, md: CGFloat = 12, lg: CGFloat = 16, xl: CGFloat = 24, xxl: CGFloat = 32 }
}

extension UIColor {
  convenience init(hex: UInt32) { self.init(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1) }
}
extension Color {
  init(hex: UInt32) { self.init(UIColor(hex: hex)) }
}

// MARK: - توافق مع الشاشات القائمة (تُعاد كتابتها تدريجيًا على المكوّنات الجديدة)
enum Theme {
  static let primary = DS.C.brandPrimary
  static let primaryStrong = DS.C.brandStrong
  static let gold = DS.C.accentGold
  static let paper = DS.C.paperPage
  static let cardBackground = DS.C.bgSurface
  static let background = DS.C.bgCanvas
}
extension Font {
  /// خط الواجهة (Readex Pro) بالحجم والوزن — الاسم القديم أُبقي كي تعمل الشاشات كلها بالخط الجديد فورًا
  static func arabic(_ size: CGFloat, weight: Font.Weight = .regular) -> Font { DS.readex(size, weight) }
}
