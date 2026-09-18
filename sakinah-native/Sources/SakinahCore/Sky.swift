import Foundation

// MARK: - سماء الرئيسية (Figma «٧ · نظام السماء والطقس»)
//
// السماء تتبدّل مع الوقت: تسعة أطوار تُشتقّ من مواقيت الصلاة نفسها بلا مصدر إضافي، والانتقال بين
// طورين تدرّج على ٢٠ دقيقة حول كل حدّ (١٠ قبله و١٠ بعده). الطقس طبقةٌ تعدّل التدرّج لا لوحة جديدة.
// كل الأرقام هنا هي أرقام لوحة Figma حرفيًّا كي تتطابق المنصّتان.

/// طور السماء
public enum SkyPhase: String, CaseIterable, Codable, Sendable {
  case night, sahar, fajr, sunrise, duha, dhuhr, asr, ghurub, shafaq

  public var nameAr: String {
    switch self {
    case .night: "الليل"; case .sahar: "السَّحَر"; case .fajr: "الفجر"; case .sunrise: "الشروق"; case .duha: "الضحى"
    case .dhuhr: "الظهر"; case .asr: "العصر"; case .ghurub: "الغروب"; case .shafaq: "الشفق"
    }
  }
  /// قاعدة الوقت كما تُعرض في الإعدادات
  public var ruleAr: String {
    switch self {
    case .night: "بعد العشاء → ثلث الليل الأخير"; case .sahar: "ثلث الليل الأخير → الفجر"; case .fajr: "الفجر → الشروق"
    case .sunrise: "الشروق → بعده بساعة"; case .duha: "بعد الشروق بساعة → الظهر"; case .dhuhr: "الظهر → العصر"
    case .asr: "العصر → قبل المغرب بأربعين دقيقة"; case .ghurub: "آخر أربعين دقيقة قبل المغرب"; case .shafaq: "المغرب → العشاء"
    }
  }
}

/// قرص السماء
public enum SkyDisc: String, Codable, Sendable { case none, moon, sunLow, sun, sunHigh }
/// وضع النصّ فوق السماء: ورق على الداكنة، حبر على الفاتحة
public enum SkyInk: String, Codable, Sendable { case paper, ink }

/// لون خطّي ٠…١ مع عمليات المزج المستعملة في التدرّجات
public struct SkyRGB: Sendable, Equatable {
  public var r: Double, g: Double, b: Double
  public init(r: Double, g: Double, b: Double) { self.r = r; self.g = g; self.b = b }
  public init(hex: UInt32) {
    r = Double((hex >> 16) & 0xFF) / 255; g = Double((hex >> 8) & 0xFF) / 255; b = Double(hex & 0xFF) / 255
  }
  public var hex: UInt32 {
    func c(_ v: Double) -> UInt32 { UInt32((min(1, max(0, v)) * 255).rounded()) }
    return (c(r) << 16) | (c(g) << 8) | c(b)
  }
  public func mix(_ o: SkyRGB, _ t: Double) -> SkyRGB {
    let k = min(1, max(0, t))
    if k <= 0 { return self }; if k >= 1 { return o }
    return SkyRGB(r: r + (o.r - r) * k, g: g + (o.g - g) * k, b: b + (o.b - b) * k)
  }
  /// إزالة تشبّع نحو الرمادي المكافئ (وزن الإضاءة)
  public func desaturate(_ f: Double) -> SkyRGB {
    let l = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return mix(SkyRGB(r: l, g: l, b: l), f)
  }
  public func darken(_ f: Double) -> SkyRGB { mix(SkyRGB(r: 0, g: 0, b: 0), f) }
  public func lighten(_ f: Double) -> SkyRGB { mix(SkyRGB(r: 1, g: 1, b: 1), f) }
  /// الإضاءة النسبية (WCAG) — لاختيار وضع النصّ عند التخصيص
  public var luminance: Double {
    func lin(_ c: Double) -> Double { c <= 0.03928 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4) }
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  }
}

/// لوحة طورٍ واحد: أربع درجات من الأعلى إلى الأسفل، وهج الأفق، القرص، وضع النصّ، ولون الإشارة
public struct SkyPalette: Sendable, Equatable {
  public var stops: [SkyRGB]
  public var glow: SkyRGB
  public var glowOpacity: Double
  public var disc: SkyDisc
  public var ink: SkyInk
  public var accent: SkyRGB

  public init(stops: [SkyRGB], glow: SkyRGB, glowOpacity: Double, disc: SkyDisc, ink: SkyInk, accent: SkyRGB) {
    self.stops = SkyPalette.four(stops); self.glow = glow; self.glowOpacity = glowOpacity; self.disc = disc; self.ink = ink; self.accent = accent
  }

  /// توحيد الدرجات إلى أربع (لوحة بثلاث درجات تُقسم أولاها)
  static func four(_ s: [SkyRGB]) -> [SkyRGB] {
    if s.count >= 4 { return Array(s.prefix(4)) }
    if s.count == 3 { return [s[0], s[0].mix(s[1], 0.5), s[1], s[2]] }
    if s.count == 2 { return [s[0], s[0].mix(s[1], 1.0 / 3), s[0].mix(s[1], 2.0 / 3), s[1]] }
    let c = s.first ?? SkyRGB(hex: 0x000000); return [c, c, c, c]
  }

  private static func p(_ hex: [UInt32], glow: UInt32, op: Double, disc: SkyDisc, ink: SkyInk, accent: UInt32) -> SkyPalette {
    SkyPalette(stops: hex.map { SkyRGB(hex: $0) }, glow: SkyRGB(hex: glow), glowOpacity: op, disc: disc, ink: ink, accent: SkyRGB(hex: accent))
  }

  /// لوحة Figma لكل طور (الدرجات كما في اللوحة حرفيًّا)
  public static func of(_ phase: SkyPhase) -> SkyPalette {
    switch phase {
    case .night:   return p([0x020B14, 0x0A1E2E, 0x10303C], glow: 0xF3DFA0, op: 0.25, disc: .moon, ink: .paper, accent: 0xF3DFA0)
    case .sahar:   return p([0x141A3A, 0x3B2A57, 0x9A4E5E, 0xD98B58], glow: 0xFFC98A, op: 0.45, disc: .none, ink: .paper, accent: 0xFFC98A)
    case .fajr:    return p([0x2A3E7A, 0x6E5B9E, 0xE39A7B, 0xF6C689], glow: 0xFFE0B0, op: 0.5, disc: .sunLow, ink: .paper, accent: 0xFFE0B0)
    case .sunrise: return p([0x6FA8DC, 0xF7C59F, 0xF2A65A], glow: 0xFFD27A, op: 0.5, disc: .sunLow, ink: .ink, accent: 0xFFD27A)
    case .duha:    return p([0x4F9BE0, 0x8CC7F0, 0xDDEFFB], glow: 0xFFFFFF, op: 0.5, disc: .sun, ink: .ink, accent: 0xFFFFFF)
    case .dhuhr:   return p([0x1F63B5, 0x4C9BE0, 0xA9D6F5], glow: 0xFFF6D6, op: 0.5, disc: .sunHigh, ink: .paper, accent: 0xFFF6D6)
    case .asr:     return p([0x3A86C8, 0x9CC7E6, 0xF3D9A6], glow: 0xFFE7A8, op: 0.5, disc: .sun, ink: .ink, accent: 0xFFE7A8)
    case .ghurub:  return p([0x3E2C63, 0xB4506A, 0xF08A4B, 0xFFC46B], glow: 0xFFB067, op: 0.5, disc: .sunLow, ink: .paper, accent: 0xFFB067)
    case .shafaq:  return p([0x04181A, 0x083430, 0x0E5C55], glow: 0xD9A25B, op: 0.35, disc: .none, ink: .paper, accent: 0xD9A25B)
    }
  }

  /// لون مخصّص يختاره المستخدم: ليلٌ → اللون → أفتح قليلًا؛ نصّ ورق دائمًا
  public static func custom(_ accent: SkyAccent) -> SkyPalette {
    let a = SkyRGB(hex: accent.hex)
    return SkyPalette(stops: [SkyRGB(hex: 0x0A0F14), a.darken(0.55), a, a.lighten(0.10)], glow: a.lighten(0.4), glowOpacity: 0.35, disc: .none, ink: .paper, accent: a.lighten(0.45))
  }

  /// مزج لوحتين على مدى الانتقال؛ القرص ووضع النصّ يتبدّلان عند منتصفه
  public func blended(with o: SkyPalette, t: Double) -> SkyPalette {
    let k = min(1, max(0, t))
    var out = self
    out.stops = (0..<4).map { stops[$0].mix(o.stops[$0], k) }
    out.glow = glow.mix(o.glow, k); out.glowOpacity = glowOpacity + (o.glowOpacity - glowOpacity) * k
    out.accent = accent.mix(o.accent, k)
    if k >= 0.5 { out.disc = o.disc; out.ink = o.ink }
    return out
  }

  /// طبقة الطقس: تعديل على التدرّج نفسه (أرقام لوحة Figma) — الغيوم والمطر تُرسم في الواجهة فوقها
  public func weathered(_ w: SkyWeather) -> SkyPalette {
    var out = self
    switch w {
    case .clear, .partlyCloudy: return self
    case .overcast: out.stops = stops.map { $0.desaturate(0.25).darken(0.15) }; out.glowOpacity *= 0.3; out.ink = .paper
    case .rain:     out.stops = stops.map { $0.desaturate(0.35).darken(0.30) }; out.glowOpacity *= 0.15; out.ink = .paper
    case .dust:     out.stops = stops.map { $0.mix(SkyRGB(hex: 0xD6B48A), 0.45) }; out.glowOpacity *= 0.5
    case .snow:     out.stops = stops.map { $0.desaturate(0.3).lighten(0.25) }; out.glowOpacity *= 0.2
    }
    if w == .dust || w == .snow { out.ink = out.stops[1].luminance > 0.3 ? .ink : .paper }
    return out
  }
}

/// حالة الطقس كطبقة — من رمز WMO (Open-Meteo) والغطاء السحابي والغبار
public enum SkyWeather: String, CaseIterable, Codable, Sendable {
  case clear, partlyCloudy, overcast, rain, dust, snow
  public var nameAr: String {
    switch self { case .clear: "صافٍ"; case .partlyCloudy: "غيوم متفرّقة"; case .overcast: "غائم"; case .rain: "مطر"; case .dust: "غبار"; case .snow: "ثلج" }
  }
  /// `wmo`: رمز الطقس، `cloudCover`: ٪، `dust`: µg/m³ من واجهة جودة الهواء (اختياري)
  public static func from(wmo: Int, cloudCover: Int, dust: Double? = nil) -> SkyWeather {
    if let d = dust, d >= 150 { return .dust }
    switch wmo {
    case 71...77, 85, 86: return .snow
    case 51...67, 80...82, 95...99: return .rain
    case 45, 48, 3: return .overcast
    case 1, 2: return cloudCover >= 75 ? .overcast : .partlyCloudy
    default: return cloudCover >= 75 ? .overcast : (cloudCover >= 30 ? .partlyCloudy : .clear)
    }
  }
}

/// وضع السماء في الإعدادات
public enum SkyMode: String, CaseIterable, Codable, Sendable { case auto, fixed, custom
  public var nameAr: String { switch self { case .auto: "تلقائي"; case .fixed: "ثابت"; case .custom: "مخصّص" } }
}
/// ألوان التخصيص الثمانية
public enum SkyAccent: String, CaseIterable, Codable, Sendable {
  case emerald, sapphire, violet, rose, copper, olive, graphite, gold
  public var nameAr: String {
    switch self { case .emerald: "زمرّد"; case .sapphire: "ياقوت"; case .violet: "بنفسج"; case .rose: "ورد"; case .copper: "نحاس"; case .olive: "زيتون"; case .graphite: "رمادي"; case .gold: "ذهب" }
  }
  public var hex: UInt32 {
    switch self { case .emerald: 0x0E5C55; case .sapphire: 0x1F4FB5; case .violet: 0x5B3A8E; case .rose: 0xA84A68; case .copper: 0xB5652E; case .olive: 0x4E6B2E; case .graphite: 0x3C4A47; case .gold: 0xC69C3E }
  }
}
/// تفضيلات المستخدم — تُحفظ كما هي في الإعدادات
public struct SkyPrefs: Codable, Sendable, Equatable {
  public var mode: SkyMode
  public var fixedPhase: SkyPhase
  public var accent: SkyAccent
  public var weather: Bool
  public var reduceMotion: Bool
  public init(mode: SkyMode = .auto, fixedPhase: SkyPhase = .shafaq, accent: SkyAccent = .emerald, weather: Bool = false, reduceMotion: Bool = false) {
    self.mode = mode; self.fixedPhase = fixedPhase; self.accent = accent; self.weather = weather; self.reduceMotion = reduceMotion
  }
  public static let `default` = SkyPrefs()
}

/// مدخلات اليوم: مواقيت اليوم، وعشاء الأمس (قبل الفجر) وفجر الغد (بعد العشاء) لحساب ثلث الليل الأخير
public struct SkyInputs: Sendable {
  public var fajr: Date?, sunrise: Date?, dhuhr: Date?, asr: Date?, maghrib: Date?, isha: Date?
  public var prevIsha: Date?, nextFajr: Date?
  public var tz: TimeZone
  public init(fajr: Date?, sunrise: Date?, dhuhr: Date?, asr: Date?, maghrib: Date?, isha: Date?, prevIsha: Date? = nil, nextFajr: Date? = nil, tz: TimeZone = .current) {
    self.fajr = fajr; self.sunrise = sunrise; self.dhuhr = dhuhr; self.asr = asr; self.maghrib = maghrib; self.isha = isha
    self.prevIsha = prevIsha; self.nextFajr = nextFajr; self.tz = tz
  }
  public init(_ t: PrayerTimes.DayTimeline, tz: TimeZone) {
    self.init(fajr: t.times.fajr, sunrise: t.times.sunrise, dhuhr: t.times.dhuhr, asr: t.times.asr, maghrib: t.times.maghrib, isha: t.times.isha,
              prevIsha: t.yesterdayIsha, nextFajr: t.next.isTomorrow ? t.next.time : nil, tz: tz)
  }
}

/// الحالة المحسوبة للحظة: الطور، وما يُمزج إليه إن كنّا في نافذة انتقال، ونسبة المزج، واللوحة النهائية
public struct SkyState: Sendable, Equatable {
  public var phase: SkyPhase
  public var blendTo: SkyPhase?
  public var t: Double
  public var weather: SkyWeather
  public var palette: SkyPalette
  public init(phase: SkyPhase, blendTo: SkyPhase?, t: Double, weather: SkyWeather, palette: SkyPalette) {
    self.phase = phase; self.blendTo = blendTo; self.t = t; self.weather = weather; self.palette = palette
  }
  /// الطور الغالب (بعد منتصف الانتقال يُعدّ التالي هو الغالب)
  public var dominant: SkyPhase { (blendTo != nil && t >= 0.5) ? blendTo! : phase }
}

public enum SkyEngine {
  /// نافذة الانتقال الكاملة حول الحدّ
  public static let blendWindow: TimeInterval = 20 * 60

  /// حدود الأطوار مرتّبة زمنيًّا من ليل الأمس إلى فجر الغد؛ nil إن غابت المواقيت الأساسية (قطبي)
  public static func schedule(_ i: SkyInputs) -> [(phase: SkyPhase, start: Date)]? {
    guard let fajr = i.fajr, let sunrise = i.sunrise, let dhuhr = i.dhuhr, let asr = i.asr, let maghrib = i.maghrib, let isha = i.isha else { return nil }
    let prevIsha = i.prevIsha ?? fajr.addingTimeInterval(-8 * 3600)
    let nextFajr = i.nextFajr ?? fajr.addingTimeInterval(24 * 3600)
    let saharToday = prevIsha.addingTimeInterval(fajr.timeIntervalSince(prevIsha) * 2 / 3)
    let saharTomorrow = isha.addingTimeInterval(nextFajr.timeIntervalSince(isha) * 2 / 3)
    let s: [(SkyPhase, Date)] = [
      (.night, prevIsha), (.sahar, saharToday), (.fajr, fajr), (.sunrise, sunrise), (.duha, sunrise.addingTimeInterval(3600)),
      (.dhuhr, dhuhr), (.asr, asr), (.ghurub, maghrib.addingTimeInterval(-40 * 60)), (.shafaq, maghrib), (.night, isha), (.sahar, saharTomorrow), (.fajr, nextFajr),
    ]
    // حماية من ترتيبٍ شاذّ (عصر متأخّر جدًّا مثلًا): يُسقط أيّ حدٍّ لا يتأخّر عمّا قبله
    var out: [(phase: SkyPhase, start: Date)] = []
    for (p, d) in s { if let last = out.last, d <= last.start { continue }; out.append((p, d)) }
    return out
  }

  /// طور بديل بساعة اليوم — للمناطق القطبية حين تغيب المواقيت
  public static func fallbackPhase(hour: Int) -> SkyPhase {
    switch hour {
    case 0..<3: .night; case 3..<5: .sahar; case 5..<6: .fajr; case 6..<7: .sunrise; case 7..<12: .duha
    case 12..<15: .dhuhr; case 15..<18: .asr; case 18..<19: .ghurub; case 19..<21: .shafaq; default: .night
    }
  }

  /// الطور عند لحظة، مع الانتقال إن كنّا ضمن ±١٠ دقائق من حدّ
  public static func phase(at now: Date, inputs i: SkyInputs) -> (phase: SkyPhase, blendTo: SkyPhase?, t: Double) {
    guard let sch = schedule(i), let first = sch.first else {
      var cal = Calendar(identifier: .gregorian); cal.timeZone = i.tz
      return (fallbackPhase(hour: cal.component(.hour, from: now)), nil, 0)
    }
    if now < first.start { return (.night, nil, 0) }
    var k = 0
    for (idx, seg) in sch.enumerated() where seg.start <= now { k = idx }
    let half = blendWindow / 2
    let cur = sch[k].phase
    // قرب بداية المقطع الحالي: ما زلنا نمزج من السابق إليه
    if k > 0, now.timeIntervalSince(sch[k].start) < half {
      let t = (now.timeIntervalSince(sch[k].start) + half) / blendWindow
      return (sch[k - 1].phase, cur, t)
    }
    // قرب نهاية المقطع: نبدأ المزج إلى التالي
    if k + 1 < sch.count, sch[k + 1].start.timeIntervalSince(now) <= half {
      let t = (now.timeIntervalSince(sch[k + 1].start) + half) / blendWindow
      return (cur, sch[k + 1].phase, t)
    }
    return (cur, nil, 0)
  }

  /// الحالة النهائية بحسب التفضيلات: تلقائي (الوقت + الطقس إن فُعّل)، ثابت (طور بعينه)، مخصّص (لون)
  public static func state(at now: Date, inputs: SkyInputs?, prefs: SkyPrefs, weather: SkyWeather?) -> SkyState {
    let w: SkyWeather = (prefs.mode == .auto && prefs.weather) ? (weather ?? .clear) : .clear
    switch prefs.mode {
    case .custom:
      return SkyState(phase: .shafaq, blendTo: nil, t: 0, weather: .clear, palette: SkyPalette.custom(prefs.accent))
    case .fixed:
      return SkyState(phase: prefs.fixedPhase, blendTo: nil, t: 0, weather: .clear, palette: SkyPalette.of(prefs.fixedPhase))
    case .auto:
      guard let inputs else { return SkyState(phase: .shafaq, blendTo: nil, t: 0, weather: w, palette: SkyPalette.of(.shafaq).weathered(w)) }
      let r = phase(at: now, inputs: inputs)
      var pal = SkyPalette.of(r.phase)
      if let to = r.blendTo { pal = pal.blended(with: SkyPalette.of(to), t: r.t) }
      return SkyState(phase: r.phase, blendTo: r.blendTo, t: r.t, weather: w, palette: pal.weathered(w))
    }
  }
}
