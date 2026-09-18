import SwiftUI
import SakinahCore

// MARK: - سماء الرئيسية على iOS: خدمة الطقس، وجسور SwiftUI للوحة، وخلفية السماء بطبقاتها
// المنطق (الأطوار والألوان) في SakinahCore/Sky.swift؛ هنا الرسم والشبكة فقط.

/// الطقس من Open-Meteo: بلا مفتاح ولا حساب، إحداثيات مقرّبة إلى ~١ كم، مرّةً كل ساعة، ولا يُستدعى إلا إن فعّله المستخدم.
/// الغبار من واجهة جودة الهواء نفسها (اختياري؛ فشله لا يعطّل الطقس).
@Observable
final class SkyWeatherService {
  var current: SkyWeather?
  var updatedAt: Date?
  var error: String?
  private var inflight = false
  private struct Cache: Codable { let key: String; let at: Date; let weather: String }
  private static let cacheKey = "sky.weather.cache"
  static let ua = "Sakinah/5.1 (+https://github.com/osamafa86-dotcom/mediapro)"

  static func cellKey(_ c: Coordinates) -> String { String(format: "%.2f,%.2f", c.latitude, c.longitude) }

  init() {
    if let d = UserDefaults.standard.data(forKey: Self.cacheKey), let c = try? JSONDecoder().decode(Cache.self, from: d),
       Date().timeIntervalSince(c.at) < 3 * 3600, let w = SkyWeather(rawValue: c.weather) { current = w; updatedAt = c.at }
  }

  /// تحديث إن مضت ساعة (أو تغيّرت الخلية) — يُستدعى من الرئيسية عند كل ظهور
  func refreshIfNeeded(around c: Coordinates) async {
    if inflight { return }
    let key = Self.cellKey(c)
    if let at = updatedAt, current != nil, Date().timeIntervalSince(at) < 3600, cachedKey == key { return }
    inflight = true; defer { inflight = false }
    do {
      let w = try await Self.fetch(around: c)
      current = w; updatedAt = Date(); error = nil; cachedKey = key
      if let d = try? JSONEncoder().encode(Cache(key: key, at: Date(), weather: w.rawValue)) { UserDefaults.standard.set(d, forKey: Self.cacheKey) }
    } catch { self.error = error.localizedDescription }
  }
  private var cachedKey: String? = {
    guard let d = UserDefaults.standard.data(forKey: SkyWeatherService.cacheKey), let c = try? JSONDecoder().decode(Cache.self, from: d) else { return nil }
    return c.key
  }()

  static func fetch(around c: Coordinates) async throws -> SkyWeather {
    let lat = String(format: "%.2f", (c.latitude * 100).rounded() / 100), lon = String(format: "%.2f", (c.longitude * 100).rounded() / 100)
    func request(_ base: String, _ items: [String: String]) -> URLRequest {
      var u = URLComponents(string: base)!
      u.queryItems = [URLQueryItem(name: "latitude", value: lat), URLQueryItem(name: "longitude", value: lon)] + items.map { URLQueryItem(name: $0.key, value: $0.value) }
      var r = URLRequest(url: u.url!); r.timeoutInterval = 12; r.setValue(ua, forHTTPHeaderField: "User-Agent"); return r
    }
    let (data, resp) = try await URLSession.shared.data(for: request("https://api.open-meteo.com/v1/forecast", ["current": "weather_code,cloud_cover", "timezone": "auto"]))
    guard let h = resp as? HTTPURLResponse, (200..<300).contains(h.statusCode) else { throw URLError(.badServerResponse) }
    struct R: Decodable { struct C: Decodable { let weather_code: Int; let cloud_cover: Int? }; let current: C }
    let r = try JSONDecoder().decode(R.self, from: data)
    var dust: Double? = nil
    if let (aq, _) = try? await URLSession.shared.data(for: request("https://air-quality-api.open-meteo.com/v1/air-quality", ["current": "dust"])) {
      struct AQ: Decodable { struct C: Decodable { let dust: Double? }; let current: C }
      dust = (try? JSONDecoder().decode(AQ.self, from: aq))?.current.dust
    }
    return SkyWeather.from(wmo: r.current.weather_code, cloudCover: r.current.cloud_cover ?? 0, dust: dust)
  }
}

// MARK: - جسور SwiftUI
extension SkyRGB { var color: Color { Color(red: r, green: g, blue: b) } }

extension SkyPalette {
  var gradient: LinearGradient { LinearGradient(colors: stops.map(\.color), startPoint: .top, endPoint: .bottom) }
  var isDark: Bool { ink == .paper }
  /// نصّ فوق السماء: ورق على الداكنة، حبر على الفاتحة
  var text: Color { isDark ? Color(hex: 0xFBF9F4) : Color(hex: 0x16211F) }
  var textMuted: Color { text.opacity(0.62) }
  var textSoft: Color { text.opacity(0.86) }
  var glass: Color { isDark ? Color.white.opacity(0.10) : Color.black.opacity(0.06) }
  var glassStroke: Color { isDark ? Color.white.opacity(0.16) : Color.black.opacity(0.08) }
  var latticeTint: Color { isDark ? .white : .black }
  /// ذهب الإشارات: يبقى ذهبًا على الداكن ويصير ذهبًا قويًّا على الفاتح كي يُقرأ
  var gold: Color { isDark ? Color(hex: 0xE2C77A) : Color(hex: 0xA47E2C) }
  var mint: Color { isDark ? Color(hex: 0x7BE0CF) : Color(hex: 0x0E5C55) }
}

// MARK: - خلفية السماء
/// التدرّج، نقش النجوم الثمانية، النجوم الحقيقية ليلًا، وهج الأفق، القرص، وطبقات الطقس
struct SkyBackdrop: View {
  let state: SkyState
  var reduceMotion = false

  private var starry: Bool {
    guard state.palette.isDark else { return false }
    let d = state.dominant
    return (d == .night || d == .sahar || d == .shafaq) && (state.weather == .clear || state.weather == .partlyCloudy)
  }

  var body: some View {
    let p = state.palette
    GeometryReader { geo in
      let w = geo.size.width, h = geo.size.height
      ZStack {
        p.gradient
        StarLattice(tint: p.latticeTint).opacity(p.isDark ? 0.07 : 0.045)
        if starry { StarField(seed: 7).opacity(state.dominant == .shafaq ? 0.45 : 0.8) }
        // وهج الأفق
        Ellipse().fill(p.glow.color.opacity(p.glowOpacity)).frame(width: w * 1.35, height: h * 0.4).blur(radius: 60)
          .position(x: w / 2, y: p.disc == .sunHigh ? -h * 0.05 : h * 0.98)
        SkyDiscView(disc: p.disc, accent: p.accent.color, size: CGSize(width: w, height: h))
        SkyWeatherLayer(kind: state.weather, isDark: p.isDark, reduceMotion: reduceMotion, size: CGSize(width: w, height: h))
      }
      .frame(width: w, height: h)
    }
    // مواضع القرص والغيوم بإحداثيات صريحة (القرص فوق الميدالية يسارًا)؛ بيئة RTL كانت تعكسها إلى اليمين
    .environment(\.layoutDirection, .leftToRight)
    .clipped()
    .allowsHitTesting(false)
  }
}

/// قرص الشمس/القمر بحسب الطور — في الشريط بين صفّ الأيقونات الزجاجية وقمّة الميدالية
/// (قِيس على المحاكي: كان القمر والشمس فوق أيقونتي التقويم والتنبيهات، والشمس المنخفضة خلف حبّة القبلة)
struct SkyDiscView: View {
  let disc: SkyDisc
  let accent: Color
  let size: CGSize
  var body: some View {
    switch disc {
    case .none: EmptyView()
    case .moon:
      ZStack {
        Circle().fill(Color(hex: 0xF3DFA0)).frame(width: 26, height: 26).shadow(color: Color(hex: 0xF3DFA0).opacity(0.7), radius: 16)
        Circle().fill(Color(hex: 0x0A1E2E)).frame(width: 22, height: 22).offset(x: 9, y: -4)
      }
      .position(x: size.width * 0.14, y: size.height * 0.22)
    case .sunHigh: sun(34).position(x: size.width * 0.40, y: size.height * 0.19)
    case .sun: sun(30).position(x: size.width * 0.32, y: size.height * 0.23)
    case .sunLow: sun(30).position(x: size.width * 0.44, y: size.height * 0.50)
    }
  }
  private func sun(_ d: CGFloat) -> some View {
    Circle().fill(Color(hex: 0xFFF3C4)).frame(width: d, height: d)
      .shadow(color: Color(hex: 0xFFD27A).opacity(0.75), radius: 22).shadow(color: accent.opacity(0.35), radius: 40)
  }
}

/// نجوم صغيرة ثابتة بمواضع مشتقّة من بذرة — لا عشوائية بين الإطارات
struct StarField: View {
  let seed: Int
  var body: some View {
    Canvas { ctx, size in
      for i in 0..<28 {
        let x = CGFloat((i * 53 + seed * 17) % 397) / 397 * size.width
        let y = CGFloat((i * 31 + seed * 7) % 211) / 211 * size.height * 0.55
        let r: CGFloat = 0.7 + CGFloat(i % 3) * 0.55
        ctx.fill(Path(ellipseIn: CGRect(x: x, y: y, width: r * 2, height: r * 2)), with: .color(.white.opacity(i % 4 == 0 ? 0.9 : 0.55)))
      }
    }
  }
}

/// طبقات الطقس فوق السماء — غيوم تزحف، مطر يهطل، ندف تهبط، طبقة رملية؛ كلّها ساكنة عند تقليل الحركة
struct SkyWeatherLayer: View {
  let kind: SkyWeather
  let isDark: Bool
  let reduceMotion: Bool
  let size: CGSize

  var body: some View {
    switch kind {
    case .clear: EmptyView()
    case .partlyCloudy:
      clouds([(0.02, 0.11, 110, 0.85), (0.50, 0.01, 72, 0.6)])
    case .overcast:
      clouds([(-0.05, 0.02, 150, 0.5), (0.45, -0.02, 170, 0.45), (0.25, 0.20, 120, 0.3)])
    case .rain:
      ZStack { clouds([(0.0, -0.02, 160, 0.3), (0.5, 0.0, 150, 0.28)]); RainCanvas(reduceMotion: reduceMotion) }
    case .dust:
      Rectangle().fill(Color(hex: 0xE8DCC8).opacity(0.45)).frame(height: size.height * 0.5).blur(radius: 18).position(x: size.width / 2, y: size.height * 0.62)
    case .snow:
      ZStack { clouds([(0.0, -0.02, 160, 0.35), (0.5, 0.0, 150, 0.3)]); SnowCanvas(reduceMotion: reduceMotion) }
    }
  }

  /// (x, y) نسبتان، العرض بالنقاط، والشفافية — الغيوم بيضاء؛ فوق النصّ الورقي (السماء الداكنة) تُخفَّف إلى ٠٫٤
  /// كي يبقى مقروءًا (قِيس: غيمة الظهر غطّت اسم الصلاة وحبّة «بعد…»)
  private func clouds(_ list: [(Double, Double, CGFloat, Double)]) -> some View {
    let k = isDark ? 0.4 : 1.0
    return ZStack {
      ForEach(Array(list.enumerated()), id: \.offset) { i, c in
        CloudShape().fill(Color.white.opacity(c.3 * k))
          .frame(width: c.2, height: c.2 * 0.42)
          .position(x: size.width * c.0 + c.2 / 2, y: size.height * c.1 + c.2 * 0.21)
          .modifier(Drift(distance: reduceMotion ? 0 : (i % 2 == 0 ? 14 : -10), duration: 40 + Double(i) * 12))
      }
    }
  }
}

/// غيمة من خمس بيضاويات متراكبة (مطابقة لرسم Figma)
struct CloudShape: Shape {
  func path(in r: CGRect) -> Path {
    let w = r.width
    let parts: [(CGFloat, CGFloat, CGFloat)] = [(0, 0.35, 0.45), (0.28, 0.12, 0.6), (0.55, 0.25, 0.5), (0.15, 0.5, 0.5), (0.5, 0.48, 0.5)]
    var p = Path()
    for (px, py, s) in parts { p.addEllipse(in: CGRect(x: r.minX + w * px, y: r.minY + w * py * 0.9 - w * s * 0.3, width: w * s, height: w * s * 0.75)) }
    return p
  }
}

/// زحف بطيء ذهابًا وإيابًا
struct Drift: ViewModifier {
  let distance: CGFloat
  let duration: Double
  @State private var on = false
  func body(content: Content) -> some View {
    content.offset(x: on ? distance : -distance)
      .onAppear { guard distance != 0 else { return }; withAnimation(.easeInOut(duration: duration).repeatForever(autoreverses: true)) { on = true } }
  }
}

/// خطوط مطر مائلة تهطل (تتكرّر كل ثانيتين)
struct RainCanvas: View {
  let reduceMotion: Bool
  var body: some View {
    TimelineView(.animation(paused: reduceMotion)) { ctx in
      Canvas { g, size in
        let phase = reduceMotion ? 0 : ctx.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 2) / 2
        for i in 0..<22 {
          let len: CGFloat = 12 + CGFloat(i % 3) * 5
          let x0 = CGFloat(i) * (size.width / 21) + CGFloat((i * 7) % 11)
          let y0 = (CGFloat((i * 37) % 100) / 100 + phase).truncatingRemainder(dividingBy: 1) * (size.height + 40) - 20
          var p = Path(); p.move(to: CGPoint(x: x0, y: y0)); p.addLine(to: CGPoint(x: x0 - len * 0.32, y: y0 + len))
          g.stroke(p, with: .color(.white.opacity(0.28)), style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
        }
      }
    }
  }
}

/// ندف ثلج تهبط ببطء
struct SnowCanvas: View {
  let reduceMotion: Bool
  var body: some View {
    TimelineView(.animation(paused: reduceMotion)) { ctx in
      Canvas { g, size in
        let phase = reduceMotion ? 0 : ctx.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 9) / 9
        for i in 0..<26 {
          let r: CGFloat = 1.5 + CGFloat(i % 3) * 0.9
          let x = CGFloat((i * 41) % 200) / 200 * size.width + sin(CGFloat(phase) * .pi * 2 + CGFloat(i)) * 6
          let y = (CGFloat((i * 23) % 140) / 140 + CGFloat(phase)).truncatingRemainder(dividingBy: 1) * (size.height + 10) - 5
          g.fill(Path(ellipseIn: CGRect(x: x, y: y, width: r * 2, height: r * 2)), with: .color(.white.opacity(0.85)))
        }
      }
    }
  }
}
