import SwiftUI
import SakinahCore

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

  /// لون من رقم سداسي (0xRRGGBB)
  static func hex(_ v: UInt32) -> Color {
    Color(red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255)
  }

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

// MARK: - السماء في الودجت (لوحة SkyPalette من النواة، والرسم مبسّط هنا لأن رسم التطبيق في هدفه وحده)

extension SkyRGB {
  /// جسر SwiftUI داخل الامتداد (التطبيق يعرّف جسره الخاص في هدفه)
  var wColor: Color { Color(red: r, green: g, blue: b) }
}

enum WidgetSky {
  /// الطور عند لحظة من جدول الأطوار نفسه (يتبدّل عند الحدّ تمامًا، بلا مزج: مدخلات الخطّ الزمني عند الحدود)
  static func phase(at date: Date, timeline tl: PrayerTimes.DayTimeline, tz: TimeZone) -> SkyPhase {
    let inputs = SkyInputs(tl, tz: tz)
    if let sch = SkyEngine.schedule(inputs), let first = sch.first {
      if date < first.start { return .night }
      return sch.last(where: { $0.start <= date })?.phase ?? .night
    }
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = tz
    return SkyEngine.fallbackPhase(hour: cal.component(.hour, from: date))
  }

  /// حدود الأطوار بين لحظتين (لمدخلات الخطّ الزمني)
  static func boundaries(timeline tl: PrayerTimes.DayTimeline, tz: TimeZone, after from: Date, before to: Date) -> [Date] {
    guard let sch = SkyEngine.schedule(SkyInputs(tl, tz: tz)) else { return [] }
    return sch.map { $0.start }.filter { $0 > from && $0 < to }
  }

  /// نجوم في الأطوار الداكنة (كما في سماء الرئيسية)، وغيوم خفيفة في أطوار النهار الصافية
  static func starry(_ p: SkyPhase) -> Bool { p == .night || p == .sahar || p == .shafaq }
  static func cloudy(_ p: SkyPhase) -> Bool { p == .sunrise || p == .duha || p == .dhuhr || p == .asr }
}

/// ألوان النصّ فوق السماء: ورقٌ على الداكنة وحبرٌ على الفاتحة (قاعدة SkyPalette.ink)
struct WidgetInk {
  let dark: Bool
  init(_ phase: SkyPhase, forceDark: Bool = false) { dark = forceDark || SkyPalette.of(phase).ink == .paper }
  var text: Color { dark ? WDS.hex(0xFBF9F4) : WDS.hex(0x16211F) }
  var muted: Color { text.opacity(0.70) }
  var soft: Color { text.opacity(0.86) }
  /// شريط الصلوات الخمس: زجاج داكن على السماء الفاتحة، وزجاج فاتح خفيف على الداكنة — ونصّه ورقٌ دائمًا
  var strip: Color { dark ? Color.white.opacity(0.10) : WDS.hex(0x1E2B36).opacity(0.72) }
  var stripText: Color { WDS.hex(0xFBF9F4) }
  var stripHighlight: Color { Color.white.opacity(dark ? 0.18 : 0.22) }
  /// بطاقة (حديث اليوم)
  var card: Color { dark ? Color.white.opacity(0.09) : Color.white.opacity(0.62) }
  /// ذهب الإشارات: ذهبٌ فاتح على الداكن وقويّ على الفاتح كي يُقرأ
  var gold: Color { dark ? WDS.hex(0xE2C77A) : WDS.hex(0xA47E2C) }
  var track: Color { text.opacity(0.22) }
}

/// غيمة من خمس بيضاويات متراكبة (رسم التطبيق نفسه)
struct WidgetCloudShape: Shape {
  func path(in r: CGRect) -> Path {
    let w = r.width
    let parts: [(CGFloat, CGFloat, CGFloat)] = [(0, 0.35, 0.45), (0.28, 0.12, 0.6), (0.55, 0.25, 0.5), (0.15, 0.5, 0.5), (0.5, 0.48, 0.5)]
    var p = Path()
    for (px, py, s) in parts { p.addEllipse(in: CGRect(x: r.minX + w * px, y: r.minY + w * py * 0.9 - w * s * 0.3, width: w * s, height: w * s * 0.75)) }
    return p
  }
}

/// قرص الشمس أو القمر بحسب اللوحة
struct WidgetDisc: View {
  let palette: SkyPalette
  var diameter: CGFloat = 26
  var body: some View {
    switch palette.disc {
    case .none:
      EmptyView()
    case .moon:
      ZStack {
        Circle().fill(WDS.hex(0xF3DFA0)).frame(width: diameter, height: diameter)
          .shadow(color: WDS.hex(0xF3DFA0).opacity(0.7), radius: diameter * 0.6)
        Circle().fill(palette.stops[1].wColor).frame(width: diameter * 0.85, height: diameter * 0.85)
          .offset(x: diameter * 0.34, y: -diameter * 0.16)
      }
    case .sun, .sunHigh, .sunLow:
      Circle().fill(WDS.hex(0xFFF3C4)).frame(width: diameter, height: diameter)
        .shadow(color: WDS.hex(0xFFD27A).opacity(0.75), radius: diameter * 0.7)
        .shadow(color: palette.accent.wColor.opacity(0.35), radius: diameter * 1.3)
    }
  }
}

/// خلفية السماء للطور: التدرّج، وهج الأفق، القرص، ونجوم أو غيوم — مواضع صريحة بإحداثيات LTR (كما في التطبيق)
struct WidgetSkyBackground: View {
  let phase: SkyPhase
  /// موضع القرص نسبةً إلى العرض والارتفاع (من اليسار)
  var discAt: UnitPoint = UnitPoint(x: 0.27, y: 0.24)
  var discDiameter: CGFloat = 26
  var decorations = true

  var body: some View {
    let p = SkyPalette.of(phase)
    GeometryReader { geo in
      let w = geo.size.width, h = geo.size.height
      ZStack {
        LinearGradient(colors: p.stops.map { $0.wColor }, startPoint: .top, endPoint: .bottom)
        Ellipse().fill(p.glow.wColor.opacity(p.glowOpacity))
          .frame(width: w * 1.3, height: h * 0.45).blur(radius: 28)
          .position(x: w / 2, y: p.disc == .sunHigh ? 0 : h)
        if decorations && WidgetSky.starry(phase) {
          ForEach(0..<22, id: \.self) { i in
            Circle().fill(Color.white.opacity(i % 4 == 0 ? 0.9 : 0.5))
              .frame(width: Self.starSize(i), height: Self.starSize(i))
              .position(Self.starPoint(i, width: w, height: h))
          }
        }
        WidgetDisc(palette: p, diameter: discDiameter)
          .position(x: w * discAt.x, y: h * discAt.y)
        if decorations && WidgetSky.cloudy(phase) {
          WidgetCloudShape().fill(Color.white.opacity(p.ink == .paper ? 0.35 : 0.8))
            .frame(width: w * 0.46, height: w * 0.46 * 0.42)
            .position(x: w * (discAt.x + 0.24), y: h * discAt.y + w * 0.02)
          WidgetCloudShape().fill(Color.white.opacity(p.ink == .paper ? 0.25 : 0.6))
            .frame(width: w * 0.34, height: w * 0.34 * 0.42)
            .position(x: w * 0.05, y: h * 0.42)
        }
      }
      .frame(width: w, height: h)
    }
    .environment(\.layoutDirection, .leftToRight)
    .clipped()
    .allowsHitTesting(false)
  }

  /// نجوم ثابتة بمواضع مشتقّة من الفهرس (لا عشوائية بين المدخلات)
  static func starSize(_ i: Int) -> CGFloat { 1.2 + CGFloat(i % 3) * 0.7 }
  static func starPoint(_ i: Int, width: CGFloat, height: CGFloat) -> CGPoint {
    let fx = CGFloat((i * 53 + 17) % 397) / 397
    let fy = CGFloat((i * 31 + 7) % 211) / 211
    return CGPoint(x: fx * width, y: fy * height * 0.62)
  }
}

// MARK: - تنسيقات عربية للامتداد (الامتداد لا يرى Fmt في التطبيق ولا إعداداته — الأرقام من إعدادات الودجت)

enum WFmt {
  static func locale(_ numerals: String) -> Locale {
    Locale(identifier: numerals == "arab" ? "ar_SA@numbers=arab" : "ar_SA@numbers=latn")
  }

  static func number(_ n: Int, _ numerals: String) -> String {
    let f = NumberFormatter()
    f.locale = locale(numerals); f.numberStyle = .decimal; f.usesGroupingSeparator = false
    return f.string(from: NSNumber(value: n)) ?? String(n)
  }

  /// «٤:٥٢» أو «٤:٥٢ م» بتوقيت الموقع
  static func time(_ d: Date, tz: TimeZone, numerals: String, hour12: Bool = true, suffix: Bool = false) -> String {
    let f = DateFormatter()
    f.locale = locale(numerals)
    f.calendar = Calendar(identifier: .gregorian)
    f.timeZone = tz
    f.dateFormat = hour12 ? (suffix ? "h:mm a" : "h:mm") : "HH:mm"
    return f.string(from: d)
  }

  /// دقائق متبقّية مقرّبة للأعلى (عند حدّ الدقيقة تكون دقيقةً تامة)
  static func minutesLeft(_ seconds: TimeInterval) -> Int { max(0, Int((seconds / 60).rounded(.up))) }

  /// «٤٢ د» و«٥ س ١٠ د» و«٥ س»
  static func shortRemaining(_ seconds: TimeInterval, _ numerals: String) -> String {
    let m = minutesLeft(seconds)
    let h = m / 60, r = m % 60
    if h == 0 { return "\(number(r, numerals)) د" }
    if r == 0 { return "\(number(h, numerals)) س" }
    return "\(number(h, numerals)) س \(number(r, numerals)) د"
  }

  /// للحلقة الدائرية: «٤٢د» و«٥س ١٠د»
  static func ringRemaining(_ seconds: TimeInterval, _ numerals: String) -> String {
    let m = minutesLeft(seconds)
    let h = m / 60, r = m % 60
    if h == 0 { return "\(number(r, numerals))د" }
    if r == 0 { return "\(number(h, numerals))س" }
    return "\(number(h, numerals))س \(number(r, numerals))د"
  }

  /// بعد «بعد»: «٤٢ دقيقة»، «دقيقتين»، «ساعتين و١٠ دقائق» (حالة الجرّ)
  static func longRemaining(_ seconds: TimeInterval, _ numerals: String) -> String {
    let m = minutesLeft(seconds)
    let h = m / 60, r = m % 60
    let mins = counted(r, numerals, one: "دقيقة", two: "دقيقتين", few: "دقائق", many: "دقيقة")
    if h == 0 { return mins }
    let hours = counted(h, numerals, one: "ساعة", two: "ساعتين", few: "ساعات", many: "ساعة")
    return r == 0 ? hours : "\(hours) و\(mins)"
  }

  /// المعدود العربي: ١ مفرد، ٢ مثنّى، ٣–١٠ جمع، وما فوقها مفرد منصوب يكفي معه المفرد هنا
  static func counted(_ n: Int, _ numerals: String, one: String, two: String, few: String, many: String) -> String {
    switch n {
    case 1: return one
    case 2: return two
    case 3...10: return "\(number(n, numerals)) \(few)"
    default: return "\(number(n, numerals)) \(many)"
    }
  }

  /// عدد الأذكار: «ذكر واحد»، «ذكران»، «٧ أذكار»، «٢١ ذكرًا»
  static func dhikrCount(_ n: Int, _ numerals: String) -> String {
    n == 1 ? "ذكر واحد" : n == 2 ? "ذكران" : n <= 10 ? "\(number(n, numerals)) أذكار" : "\(number(n, numerals)) ذكرًا"
  }

  /// الحرارة داخل عزل LTR كي لا تنقلب الإشارة السالبة في سياق عربي
  static func temperature(_ t: Int, _ numerals: String) -> String { "\u{2066}\(number(t, numerals))°\u{2069}" }

  /// اسم الشهر الهجري مختصرًا للحلقة الدائرية
  static func hijriMonthShort(_ month: Int, _ numerals: String) -> String {
    switch month {
    case 3: return "ربيع \(number(1, numerals))"
    case 4: return "ربيع \(number(2, numerals))"
    case 5: return "جمادى \(number(1, numerals))"
    case 6: return "جمادى \(number(2, numerals))"
    case 11: return "القعدة"
    case 12: return "الحجة"
    default: return (1...12).contains(month) ? Hijri.monthsAr[month - 1] : ""
    }
  }

  /// رمز الصلاة
  static func symbol(_ p: Prayer) -> String {
    switch p {
    case .fajr: return "sun.haze.fill"
    case .sunrise: return "sunrise.fill"
    case .dhuhr: return "sun.max.fill"
    case .asr: return "sun.min.fill"
    case .maghrib: return "sunset.fill"
    case .isha: return "moon.stars.fill"
    }
  }

  /// اسم الوقت الحالي: «الضحى» بين الشروق والظهر
  static func currentName(_ p: Prayer) -> String { p == .sunrise ? "الضحى" : p.nameAr }
}
