import SwiftUI
import CoreLocation
import UIKit
import SakinahCore

/// شاشة القبلة الكاملة (المرحلة الخامسة — qibla-compass/sun/map.png): شريطٌ بالإغلاق والعنوان وزرّ الموقع،
/// ومبدّل «البوصلة | الشمس | الخريطة» (البوصلة يمينًا وهي الافتراضية)، ورابط «عن الحساب» تحت المحتوى.
/// ملاحظة اتجاه: البيئة RTL، فأوّل عنصر في HStack يقع يمينًا، و`.leading` هو اليمين.
struct QiblaView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  /// تُعرض غطاءً (من ميدالية «اليوم»، والمكتبة، والبحث) فتحتاج زرّ إغلاق
  var presented = false
  @State private var showInfo = false
  /// ٠ البوصلة، ١ الشمس، ٢ الخريطة
  @State private var mode = ScreenshotMode.qiblaMode
  /// معرّف هذه الشاشة عند البوصلة المشتركة: إغلاقها يُنزلها وحدها لا ميدالية «اليوم» الظاهرة تحتها
  @State private var compassUser = "qibla-\(UUID().uuidString)"

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(spacing: DS.Space.s4) {
          DSSegmented(items: ["البوصلة", "الشمس", "الخريطة"], selection: $mode)
          if let c = model.coordinates {
            switch mode {
            case 1: QiblaSunPanel(coords: c)
            case 2: QiblaMapPanel(coords: c)
            default: compass(for: c)
            }
          } else {
            needLocation
          }
          Button { showInfo = true } label: {
            DSLinkLabel(title: "عن الحساب").frame(minHeight: 44).contentShape(Rectangle())
          }
          .buttonStyle(.plain).accessibilityLabel("عن حساب القبلة")
        }
        .padding(.horizontal, DS.Space.s4).padding(.top, DS.Space.s2).padding(.bottom, DS.Space.s8)
        // الهاتف كما هو؛ والنوافذ الواسعة عرضٌ مقروء في الوسط
        .readableWidth(560)
      }
      .background(DS.C.bgCanvas)
      .safeAreaInset(edge: .top, spacing: 0) { navBar }
      .navigationBarHidden(true)
      .onAppear { model.location.startHeading(compassUser) }
      .onDisappear { model.location.stopHeading(compassUser) }
      // الآيباد يدور: يُعاد ضبط مرجع البوصلة مع كل دوران وإلا انحرفت القراءة تسعين درجة
      .onReceive(NotificationCenter.default.publisher(for: UIDevice.orientationDidChangeNotification)) { _ in
        model.location.syncHeadingOrientation()
      }
      .sheet(isPresented: $showInfo) { QiblaInfoSheet().environment(model) }
    }
  }

  /// زرّ الموقع يمينًا، والعنوان في الوسط، والإغلاق يسارًا
  private var navBar: some View {
    HStack(spacing: DS.Space.s2) {
      DSIconButton(systemName: "mappin.and.ellipse", label: "تحديث الموقع") { model.location.requestLocation() }
      Spacer(minLength: 8)
      Text("القبلة").font(DS.F.displaySm).foregroundStyle(DS.C.textPrimary).accessibilityAddTraits(.isHeader)
      Spacer(minLength: 8)
      if presented {
        DSIconButton(systemName: "xmark", label: "إغلاق") { dismiss() }
      } else {
        Color.clear.frame(width: 42, height: 42)
      }
    }
    .padding(.horizontal, DS.Space.s4).padding(.vertical, DS.Space.s3)
    .readableWidth(560)
    .background(DS.C.bgCanvas)
  }

  /// الاتجاه الحقيقي من CoreLocation، أو المغناطيسي مصحّحًا بانحراف WMM2025
  private func trueHeading(_ h: CLHeading, at c: Coordinates) -> Double {
    if h.trueHeading >= 0 { return h.trueHeading }
    return Geomag.magneticToTrue(h.magneticHeading, declination: Geomag.declination(lat: c.latitude, lon: c.longitude))
  }

  // MARK: البوصلة
  @ViewBuilder private func compass(for c: Coordinates) -> some View {
    let s = model.settings
    let q = Qibla.info(latitude: c.latitude, longitude: c.longitude)
    // المحاكي بلا مغناطيسية فتبقى القراءة nil وتظهر الشاشة في حال «لا بوصلة» أبدًا.
    // في وضع اللقطات وحده يُفترض اتجاهٌ يطابق القبلة: حالٌ يبلغها كل جهازٍ حقيقي،
    // وهي التي يجب أن يراها من ينظر إلى صفحة المتجر.
    let heading = model.location.heading.map { trueHeading($0, at: c) }
      ?? (ScreenshotMode.active ? q.bearing : nil)
    let diff = heading.map { Qibla.signedDifference(target: q.bearing, reference: $0) }
    let aligned = diff.map { abs($0) <= 3 } ?? false
    let lowAccuracy = (model.location.heading?.headingAccuracy ?? 0) > 15

    // فوق هالة القرص: الهالة تمتدّ خارج إطاره إلى ما فوقه
    statusPill(aligned: aligned, diff: diff, heading: heading, lowAccuracy: lowAccuracy).zIndex(1)
    CompassDial(bearing: q.bearing, heading: heading ?? 0, aligned: aligned, live: heading != nil)
      .frame(height: 300).padding(.vertical, DS.Space.s1)
    HStack(spacing: DS.Space.s3) {
      metricTile(value: QiblaText.distance(q.distanceKm, numerals: s.numerals), label: "إلى الكعبة")
      metricTile(value: Fmt.degrees(q.bearing, numerals: s.numerals), label: "اتجاه القبلة")
    }
    locationCard(c, numerals: s.numerals)
    // في لقطات المتجر لا يُعرض تنبيها البوصلة: المحاكي بلا مغناطيسية فيظهران دائمًا،
    // ولا يظهران على جهازٍ حقيقي — فعرضهما في اللقطة يصوّر التطبيق بغير حاله.
    if !ScreenshotMode.active {
      if !model.location.headingAvailable {
        hintBar(icon: "exclamationmark.triangle", text: "هذا الجهاز بلا بوصلة؛ استعمل الاتجاه بالدرجات مع بوصلة خارجية، أو جرّب «الشمس».", warn: true)
      } else {
        Text("إن اضطربت الإبرة فحرّك الهاتف على شكل ٨ لمعايرة البوصلة.")
          .font(DS.F.labelXs).foregroundStyle(lowAccuracy ? DS.C.warning : DS.C.textTertiary)
          .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
    if q.antipodal {
      hintBar(icon: "exclamationmark.circle", text: "أنت قريب جدًا من الكعبة أو في نقطة يتعذّر فيها تحديد اتجاه واحد.", warn: true)
    }
  }

  /// حبّة الحال في الوسط: «متّجه نحو القبلة، ثبّت الهاتف مستويًا» أو مقدار الدوران وجهته
  private func statusPill(aligned: Bool, diff: Double?, heading: Double?, lowAccuracy: Bool) -> some View {
    let n = model.settings.numerals
    let text: String
    let icon: String
    if heading == nil { text = "حرّك الهاتف على شكل ٨ لمعايرة البوصلة"; icon = "arrow.triangle.2.circlepath" }
    else if aligned { text = "متّجه نحو القبلة، ثبّت الهاتف مستويًا"; icon = "checkmark" }
    else if let d = diff { text = d > 0 ? "أدر الهاتف يمينًا \(Fmt.degrees(abs(d), numerals: n))" : "أدر الهاتف يسارًا \(Fmt.degrees(abs(d), numerals: n))"; icon = d > 0 ? "arrow.turn.up.right" : "arrow.turn.up.left" }
    else { text = "جارٍ قراءة البوصلة…"; icon = "location.north.line" }
    let bg = aligned ? DS.C.brandSoft : (lowAccuracy ? DS.C.accentGoldSoft : DS.C.bgSubtle)
    let fg = aligned ? DS.C.brandStrong : (lowAccuracy ? DS.C.accentGoldStrong : DS.C.textSecondary)
    return HStack(spacing: DS.Space.s2) {
      Image(systemName: icon).font(.system(size: 13, weight: .bold)).foregroundStyle(aligned ? DS.C.brandPrimary : fg)
      Text(text).font(DS.F.labelMd).foregroundStyle(fg).lineLimit(1).minimumScaleFactor(0.7)
    }
    .padding(.vertical, 9).padding(.horizontal, 16)
    .background(bg, in: Capsule())
    .frame(maxWidth: .infinity)
    .animation(.snappy(duration: 0.25), value: aligned)
  }

  private func metricTile(value: String, label: String) -> some View {
    VStack(spacing: 4) {
      Text(value).font(DS.F.numericLg).foregroundStyle(DS.C.textPrimary).monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
      Text(label).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary)
    }
    .frame(maxWidth: .infinity)
    .padding(.vertical, 18).padding(.horizontal, 10)
    .background(DS.C.bgSurface, in: RoundedRectangle(cornerRadius: DS.Radius.xl, style: .continuous))
    .overlay(RoundedRectangle(cornerRadius: DS.Radius.xl, style: .continuous).stroke(DS.C.borderSubtle, lineWidth: 1))
    .accessibilityElement(children: .combine)
  }

  /// «الخليل، بدقّة ١٥ مترًا» والانحراف المغناطيسي المعوَّض (الإشارة معزولةً باتجاه اليسار-لليمين)
  private func locationCard(_ c: Coordinates, numerals: String) -> some View {
    let dec = Geomag.declination(lat: c.latitude, lon: c.longitude)
    let acc = Int(model.location.accuracyMeters.rounded())
    let name = model.location.placeName ?? "موقعك الحالي"
    let accText = ArabicCount.phrase(acc, one: "متر واحد", two: "مترين", few: "أمتار", many: "مترًا", numerals: numerals)
    let signed = "\u{2066}\(dec >= 0 ? "+" : "−")\(Fmt.degrees(abs(dec), numerals: numerals))\u{2069}"
    return VStack(alignment: .leading, spacing: 4) {
      Text(acc > 0 ? "\(name)، بدقّة \(accText)" : name)
        .font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary).lineLimit(1).minimumScaleFactor(0.7)
      Text("الانحراف المغناطيسي \(signed) يُعوَّض تلقائيًا (WMM 2025)")
        .font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).lineLimit(1).minimumScaleFactor(0.65)
    }
    .todayCard(padding: 16)
  }

  private func hintBar(icon: String, text: String, warn: Bool) -> some View {
    HStack(spacing: DS.Space.s2) {
      Image(systemName: icon).font(.system(size: 14)).foregroundStyle(warn ? DS.C.warning : DS.C.textTertiary)
      Text(text).font(DS.F.labelXs).foregroundStyle(warn ? DS.C.warning : DS.C.textSecondary)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
    .padding(DS.Space.s3)
    .background(DS.C.bgSubtle, in: RoundedRectangle(cornerRadius: DS.Radius.md, style: .continuous))
  }

  private var needLocation: some View {
    VStack(spacing: DS.Space.s4) {
      DSIcon(systemName: "location.slash", style: .soft, size: 64, iconSize: 26)
      Text("حدّد موقعك لعرض اتجاه القبلة").font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary)
      Text("يُحسب الاتجاه على جهازك من إحداثياتك، ولا تُرسل إلى أي خادم.")
        .font(DS.F.bodySm).foregroundStyle(DS.C.textSecondary).multilineTextAlignment(.center)
      DSButton(title: "تحديد الموقع", icon: "location.fill") { model.location.requestLocation() }
    }
    .padding(.top, DS.Space.s8).padding(.horizontal, DS.Space.s4)
  }
}

/// نصوص القبلة المشتركة بين التبويبات
enum QiblaText {
  /// «١٬٢٣٠ كم» بفاصل الآلاف، وما دون المئة بكسرٍ عشريّ واحد
  static func distance(_ km: Double, numerals: String) -> String {
    km >= 100 ? "\(Fmt.grouped(Int(km.rounded()), numerals: numerals)) كم" : Fmt.distance(km, numerals: numerals)
  }
}

/// الكعبة رمزًا صغيرًا: مكعّبٌ داكن بحزامٍ ذهبيّ (رأس إبرة البوصلة، والخريطة)
struct KaabaGlyph: View {
  var size: CGFloat = 22
  var body: some View {
    RoundedRectangle(cornerRadius: size * 0.16, style: .continuous).fill(Color(hex: 0x16211F))
      .overlay(alignment: .top) { Rectangle().fill(DS.C.accentGold).frame(height: max(2, size * 0.14)).padding(.top, size * 0.28) }
      .frame(width: size, height: size)
      .accessibilityHidden(true)
  }
}

/// قرص البوصلة (qibla-compass.png): وجهٌ أبيض بعلامات الدرجات وحروف الجهات (ش أحمر)، حلقةٌ نعناعية، وإبرةٌ خضراء
/// رأسها الكعبة وذيلها رماديّ — كلّها تدور مع الاتجاه، وخطّ الاتجاه الثابت أعلى القرص هو جهة الهاتف
struct CompassDial: View {
  let bearing: Double
  let heading: Double
  let aligned: Bool
  var live: Bool = true
  @State private var pulse = false
  @State private var beat = 0

  var body: some View {
    GeometryReader { geo in
      let size = min(geo.size.width, geo.size.height)
      let r = size / 2
      ZStack {
        // عند التوجّه: هالة تنبض حول القرص ونقرة لمسية — الإشارة التي تُرى بلا قراءة
        if aligned {
          Circle().fill(RadialGradient(colors: [DS.C.brandPrimary.opacity(0.3), .clear], center: .center, startRadius: r * 0.8, endRadius: r * 1.25))
            .frame(width: size * 1.3, height: size * 1.3)
            .scaleEffect(pulse ? 1.05 : 0.97).opacity(pulse ? 0.5 : 1)
            .animation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true), value: pulse)
        }
        // مقاسٌ صريح: بلا إطار يأخذ الوجهُ مقاسَ المكدّس كلّه، والهالة (١٫٣ من القرص) تكبّره حين التوجّه —
        // فكان القرص يقفز ثلثًا عند بلوغ القبلة ويغطّي حبّة الحال (قيس في لقطتَي ٥٫١ و٥٫٢: ٣٨٧ نقطة والعلامات على ٣٠٠)
        Circle().fill(DS.C.bgSurface)
          .overlay(Circle().stroke(aligned ? DS.C.brandPrimary.opacity(0.6) : DS.C.borderSubtle, lineWidth: aligned ? 2 : 1))
          .frame(width: size, height: size)
          .shadow(color: aligned ? DS.C.brandPrimary.opacity(0.35) : DS.C.shadowCard, radius: 16, x: 0, y: aligned ? 0 : 6)
        ZStack {
          ticks(r)
          // حروف الجهات: ش شمالًا (أحمر)، ثم ق وج وغ مع الدوران، وتبقى قائمة
          ForEach(Array(["ش", "ق", "ج", "غ"].enumerated()), id: \.offset) { i, letter in
            let angle = Double(i) * 90
            Text(letter)
              .font(DS.F.labelMd)
              .foregroundStyle(i == 0 ? DS.C.danger : DS.C.textSecondary)
              .rotationEffect(.degrees(-angle))
              .offset(y: -(r - 36))
              .rotationEffect(.degrees(angle))
          }
          Circle().stroke(aligned ? DS.C.brandPrimary.opacity(0.35) : DS.C.brandSoft, lineWidth: max(8, r * 0.08))
            .frame(width: r * 1.34, height: r * 1.34)
          needle(r)
          Circle().fill(DS.C.brandPrimary).frame(width: 16, height: 16)
            .overlay { Circle().stroke(DS.C.bgSurface, lineWidth: 3) }
        }
        .rotationEffect(.degrees(-heading))
        .animation(.easeOut(duration: 0.25), value: heading)
        .opacity(live ? 1 : 0.45)
        // خطّ الاتجاه الثابت: أعلى القرص = جهة الهاتف
        Capsule().fill(aligned ? DS.C.brandPrimary : DS.C.textPrimary).frame(width: 3, height: 18).offset(y: -(r - 9))
      }
      .frame(width: size, height: size)
      .frame(maxWidth: .infinity)
      // النبض المتكرّر على الهالة وحدها لا على القرص كلّه: كان معلّقًا بالقرص فيكرّر إلى الأبد كلَّ تغيّرٍ وقع
      // مع تشغيله — ومنه إزاحة الشاشة وهي تنزلق عند فتحها — فبقي القرص مزاحًا ١٨ نقطة فوق إطاره يغطّي حبّة
      // الحال (قيس في لقطة المتجر: عرضه ٣٠٠ صحيح وأعلاه فوق موضعه)
      .animation(.easeOut(duration: 0.3), value: aligned)
    }
    .onAppear { pulse = true }
    .sensoryFeedback(trigger: aligned) { _, on in on ? .success : nil }
    .task(id: aligned) {
      guard aligned else { return }
      while !Task.isCancelled { try? await Task.sleep(for: .milliseconds(900)); if !Task.isCancelled { beat += 1 } }
    }
    .sensoryFeedback(.impact(weight: .light, intensity: 0.7), trigger: beat)
    .accessibilityLabel(aligned ? "متجه إلى القبلة" : "اتجاه القبلة \(Int(bearing)) درجة")
  }

  /// علامة كل ٥ درجات، وأطول كل ٣٠، وأطولها عند الجهات الأربع
  private func ticks(_ r: CGFloat) -> some View {
    ForEach(0..<72, id: \.self) { i in
      let cardinal = i % 18 == 0
      let major = i % 6 == 0
      let len: CGFloat = cardinal ? 14 : (major ? 9 : 5)
      Capsule()
        .fill(cardinal ? DS.C.textPrimary : (major ? DS.C.textSecondary : DS.C.borderStrong))
        .frame(width: cardinal ? 2.5 : 1.2, height: len)
        .offset(y: -(r - 6 - len / 2))
        .rotationEffect(.degrees(Double(i) * 5))
    }
  }

  /// الإبرة نحو القبلة: رأسٌ أخضر تنتهي بالكعبة، وذيلٌ رماديّ إلى الجهة المقابلة
  private func needle(_ r: CGFloat) -> some View {
    ZStack {
      Capsule().fill(DS.C.borderStrong).frame(width: 4, height: r * 0.42).offset(y: r * 0.21)
      Capsule().fill(aligned ? DS.C.brandStrong : DS.C.brandPrimary).frame(width: 5, height: r * 0.62).offset(y: -r * 0.31)
      KaabaGlyph(size: 24).offset(y: -r * 0.66)
    }
    .rotationEffect(.degrees(bearing))
  }
}

/// إبرة مدبّبة: قاعدة عريضة عند المركز ورأس حاد
struct NeedleShape: Shape {
  func path(in rect: CGRect) -> Path {
    var p = Path()
    p.move(to: CGPoint(x: rect.midX, y: rect.minY))
    p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
    p.addQuadCurve(to: CGPoint(x: rect.minX, y: rect.maxY), control: CGPoint(x: rect.midX, y: rect.maxY - rect.width * 0.35))
    p.closeSubpath()
    return p
  }
}

/// شرح طريقة الحساب ومصادرها
struct QiblaInfoSheet: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: DS.Space.s4) {
          infoBlock("كيف يُحسب الاتجاه؟", "يُحسب اتجاه القبلة بخوارزمية Vincenty الجيوديسية على مجسّم WGS‑84، وهي أدق من الحساب الكروي المبسّط، وتُعطي أقصر مسار حقيقي على سطح الأرض إلى الكعبة.")
          infoBlock("الشمال الحقيقي لا المغناطيسي", "تقرأ البوصلة الشمال المغناطيسي، وبينه وبين الشمال الحقيقي فرق يبلغ درجات في بعض البلدان. نستعمل الشمال الحقيقي من النظام حين يتوفّر، وإلا نُصحّح القراءة بنموذج الانحراف العالمي WMM 2025.")
          infoBlock("المعايرة", "إن اضطربت الإبرة أو ظهر تنبيه انخفاض الدقة، حرّك الهاتف في الهواء على شكل رقم ٨ مرّتين أو ثلاثًا، وابتعد عن المعادن والمكبّرات والحوامل المغناطيسية.")
          infoBlock("بالشمس بلا بوصلة", "في لحظةٍ من النهار يكون سمت الشمس هو اتجاه القبلة نفسه، فمن ولّى وجهه الشمسَ عندها فقد استقبل القبلة. تُحسب اللحظة من موقع الشمس الفلكي لموضعك ويومك، ومثلها لحظة إشارة ظلّ العمود إلى القبلة. ومرّتين في السنة تتعامد الشمس على الكعبة فيصحّ ذلك من كل مكانٍ يراها.")
          infoBlock("الخصوصية", "كل الحساب يجري على جهازك؛ لا تُرسل إحداثياتك إلى أي خادم. وتبويب «الخريطة» وحده يحمّل بلاطات خرائط آبل للمنطقة المعروضة حين تفتحه.")
        }
        .padding(DS.Space.s4)
      }
      .background(DS.C.bgCanvas)
      .navigationTitle("عن حساب القبلة").navigationBarTitleDisplayMode(.inline)
      .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("تم") { dismiss() } } }
    }
    .presentationDetents([.medium, .large])
  }
  private func infoBlock(_ title: String, _ body: String) -> some View {
    VStack(alignment: .leading, spacing: DS.Space.s2) {
      Text(title).font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary)
      Text(body).font(DS.F.bodySm).foregroundStyle(DS.C.textSecondary)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
    .dsCard(padding: DS.Space.s4)
  }
}
