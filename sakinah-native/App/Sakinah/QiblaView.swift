import SwiftUI
import CoreLocation
import UIKit
import SakinahCore

/// شاشة القبلة (تصميم Figma 10): شريط حالة، بوصلة بقرص مرقّم وإبرة ذهبية، بلاطتا المسافة والاتجاه، بطاقة الموقع، وتلميح المعايرة
struct QiblaView: View {
  @Environment(AppModel.self) private var model
  @State private var showInfo = false

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(spacing: DS.Space.s3) {
          if let c = model.coordinates { content(for: c) } else { needLocation }
        }
        .padding(.horizontal, DS.Space.s4).padding(.bottom, DS.Space.s8)
      }
      .background(DS.C.bgCanvas)
      .safeAreaInset(edge: .top, spacing: 0) { navBar }
      .navigationBarHidden(true)
      .onAppear { model.location.startHeading() }
      .onDisappear { model.location.stopHeading() }
      // الآيباد يدور: يُعاد ضبط مرجع البوصلة مع كل دوران وإلا انحرفت القراءة تسعين درجة
      .onReceive(NotificationCenter.default.publisher(for: UIDevice.orientationDidChangeNotification)) { _ in
        model.location.syncHeadingOrientation()
      }
      .sheet(isPresented: $showInfo) { QiblaInfoSheet().environment(model) }
    }
  }

  private var navBar: some View {
    HStack {
      HStack(spacing: DS.Space.s2) {
        DSIconButton(systemName: "location", label: "تحديث الموقع") { model.location.requestLocation() }
        DSIconButton(systemName: "info", label: "عن حساب القبلة") { showInfo = true }
      }
      Spacer()
      Text("القبلة").font(DS.F.displaySm).foregroundStyle(DS.C.textPrimary)
    }
    .padding(.horizontal, DS.Space.s4).padding(.vertical, DS.Space.s3)
    .background(DS.C.bgCanvas)
  }

  /// الاتجاه الحقيقي من CoreLocation، أو المغناطيسي مصحّحًا بانحراف WMM2025
  private func trueHeading(_ h: CLHeading, at c: Coordinates) -> Double {
    if h.trueHeading >= 0 { return h.trueHeading }
    return Geomag.magneticToTrue(h.magneticHeading, declination: Geomag.declination(lat: c.latitude, lon: c.longitude))
  }

  @ViewBuilder private func content(for c: Coordinates) -> some View {
    let s = model.settings
    let q = Qibla.info(latitude: c.latitude, longitude: c.longitude)
    let heading = model.location.heading.map { trueHeading($0, at: c) }
    let diff = heading.map { Qibla.signedDifference(target: q.bearing, reference: $0) }
    let aligned = diff.map { abs($0) <= 3 } ?? false
    let lowAccuracy = (model.location.heading?.headingAccuracy ?? 0) > 15

    statusPill(aligned: aligned, diff: diff, heading: heading, lowAccuracy: lowAccuracy)
    CompassDial(bearing: q.bearing, heading: heading ?? 0, aligned: aligned, live: heading != nil)
      .frame(height: 300).padding(.vertical, DS.Space.s2)
    HStack(spacing: DS.Space.s3) {
      metricTile(icon: "scope", value: Fmt.distance(q.distanceKm, numerals: s.numerals), label: "إلى الكعبة")
      metricTile(icon: "location.north.line", value: Fmt.degrees(q.bearing, numerals: s.numerals), label: "اتجاه القبلة")
    }
    locationCard(c, numerals: s.numerals)
    if !model.location.headingAvailable {
      hintBar(icon: "exclamationmark.triangle", text: "هذا الجهاز بلا بوصلة؛ استعمل الاتجاه بالدرجات مع بوصلة خارجية.", warn: true)
    } else {
      hintBar(icon: "arrow.triangle.2.circlepath", text: "إن بدت الإبرة مضطربة حرّك الهاتف على شكل ٨ لمعايرة البوصلة", warn: lowAccuracy)
    }
    if q.antipodal {
      hintBar(icon: "exclamationmark.circle", text: "أنت قريب جدًا من الكعبة أو في نقطة يتعذّر فيها تحديد اتجاه واحد.", warn: true)
    }
  }

  private func statusPill(aligned: Bool, diff: Double?, heading: Double?, lowAccuracy: Bool) -> some View {
    let text: String
    let icon: String
    if heading == nil { text = "حرّك الهاتف على شكل ٨ لمعايرة البوصلة"; icon = "arrow.triangle.2.circlepath" }
    else if aligned { text = "متّجه نحو القبلة · ثبّت الهاتف مستويًا"; icon = "checkmark.circle.fill" }
    else if let d = diff { text = d > 0 ? "أدر الهاتف يمينًا \(Fmt.degrees(abs(d), numerals: model.settings.numerals))" : "أدر الهاتف يسارًا \(Fmt.degrees(abs(d), numerals: model.settings.numerals))"; icon = d > 0 ? "arrow.turn.up.right" : "arrow.turn.up.left" }
    else { text = "جارٍ قراءة البوصلة…"; icon = "location.north.line" }
    let bg = aligned ? DS.C.brandSoft : (lowAccuracy ? DS.C.accentGoldSoft : DS.C.bgSubtle)
    let fg = aligned ? DS.C.brandStrong : (lowAccuracy ? DS.C.accentGoldStrong : DS.C.textSecondary)
    return HStack(spacing: DS.Space.s2) {
      Text(text).font(DS.F.labelMd).foregroundStyle(fg).lineLimit(1).minimumScaleFactor(0.7)
      Image(systemName: icon).font(.system(size: 17, weight: .semibold)).foregroundStyle(aligned ? DS.C.brandPrimary : fg)
    }
    .padding(.vertical, DS.Space.s3).padding(.horizontal, DS.Space.s4)
    .frame(maxWidth: .infinity)
    .background(bg, in: Capsule())
    .animation(.snappy(duration: 0.25), value: aligned)
  }

  private func metricTile(icon: String, value: String, label: String) -> some View {
    HStack(spacing: DS.Space.s3) {
      VStack(alignment: .trailing, spacing: 2) {
        Text(value).font(DS.F.numericMd).foregroundStyle(DS.C.textPrimary).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
        Text(label).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary)
      }
      Spacer(minLength: 0)
      DSIcon(systemName: icon, style: .soft, size: 38, iconSize: 16)
    }
    .frame(maxWidth: .infinity)
    .dsCard(padding: DS.Space.s3, radius: DS.Radius.lg)
  }

  private func locationCard(_ c: Coordinates, numerals: String) -> some View {
    let dec = Geomag.declination(lat: c.latitude, lon: c.longitude)
    let acc = model.location.accuracyMeters
    let name = model.location.placeName ?? "موقعك الحالي"
    return HStack(spacing: DS.Space.s3) {
      VStack(alignment: .trailing, spacing: 3) {
        Text(acc > 0 ? "\(name) · دقة ±\(Fmt.number(Int(acc), numerals: numerals)) م" : name)
          .font(DS.F.labelMd).foregroundStyle(DS.C.textPrimary).lineLimit(1).minimumScaleFactor(0.7)
        Text("الانحراف المغناطيسي \(dec >= 0 ? "+" : "−")\(Fmt.degrees(abs(dec), numerals: numerals)) مُعوَّض تلقائيًا (WMM 2025)")
          .font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).lineLimit(1).minimumScaleFactor(0.65)
      }
      Spacer(minLength: 0)
      DSIcon(systemName: "mappin.and.ellipse", style: .gold, size: 38, iconSize: 16)
    }
    .frame(maxWidth: .infinity)
    .padding(DS.Space.s3)
    .background(DS.C.accentGoldSoft.opacity(0.55), in: RoundedRectangle(cornerRadius: DS.Radius.lg, style: .continuous))
  }

  private func hintBar(icon: String, text: String, warn: Bool) -> some View {
    HStack(spacing: DS.Space.s2) {
      Text(text).font(DS.F.labelXs).foregroundStyle(warn ? DS.C.warning : DS.C.textSecondary)
        .frame(maxWidth: .infinity, alignment: .trailing)
      Image(systemName: icon).font(.system(size: 14)).foregroundStyle(warn ? DS.C.warning : DS.C.textTertiary)
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

/// قرص البوصلة: حلقة نقاط، حروف الجهات، الكعبة عند الشمال، وإبرة ذهبية/خضراء تدور مع الاتجاه
struct CompassDial: View {
  let bearing: Double
  let heading: Double
  let aligned: Bool
  var live: Bool = true

  var body: some View {
    GeometryReader { geo in
      let size = min(geo.size.width, geo.size.height)
      let r = size / 2
      ZStack {
        Circle().fill(DS.C.bgSurface).shadow(color: DS.C.shadowCard, radius: 18, x: 0, y: 8)
        Circle().fill(DS.C.bgSubtle).frame(width: size * 0.78, height: size * 0.78)
        ZStack {
          // حلقة النقاط: نقطة كل ٥ درجات، وأكبر عند الجهات الأصلية
          ForEach(0..<72, id: \.self) { i in
            let major = i % 18 == 0
            Circle()
              .fill(major ? DS.C.textSecondary : DS.C.borderStrong)
              .frame(width: major ? 5 : 3, height: major ? 5 : 3)
              .offset(y: -(r - 14))
              .rotationEffect(.degrees(Double(i) * 5))
          }
          // حروف الجهات: ش شمالًا، ثم ق وج وغ مع الدوران، وتبقى قائمة
          ForEach(Array(["ش", "ق", "ج", "غ"].enumerated()), id: \.offset) { i, letter in
            let angle = Double(i) * 90
            Text(letter)
              .font(DS.F.labelMd)
              .foregroundStyle(i == 0 ? DS.C.accentGoldStrong : DS.C.textTertiary)
              .rotationEffect(.degrees(-angle))
              .offset(y: -(r - 34))
              .rotationEffect(.degrees(angle))
          }
          // الكعبة ترافق رأس الإبرة عند اتجاه القبلة. وكانت مثبّتة عند شمال القرص، وهو موضعٌ
          // يُقرأ في شاشة قبلةٍ على أنه القبلة نفسها — وفي بلاد الشام الشمالُ عكسُ القبلة تقريبًا،
          // فكان القارئ يُوجَّه إلى غير جهتها وهو يظنّ أنه على الصواب.
          Image(systemName: "building.columns.fill")
            .font(.system(size: 17))
            .foregroundStyle(aligned ? DS.C.brandPrimary : DS.C.accentGoldStrong)
            .offset(y: -(r - 58))
            .rotationEffect(.degrees(bearing))
          // الإبرة: رأس ذهبي نحو القبلة وذيل أخضر
          NeedleShape()
            .fill(aligned ? DS.C.brandPrimary : DS.C.accentGold)
            .frame(width: 22, height: r - 66)
            .offset(y: -(r - 66) / 2)
            .rotationEffect(.degrees(bearing))
          // القلب قبل الإزاحة: لو أُزيح أولًا لدار موضعُه مع القلب فوقع الذيل فوق الرأس
          NeedleShape()
            .fill(DS.C.brandDeep)
            .frame(width: 18, height: (r - 66) * 0.82)
            .rotationEffect(.degrees(180))
            .offset(y: (r - 66) * 0.41)
            .rotationEffect(.degrees(bearing))
          Circle().fill(DS.C.bgSurface).frame(width: 18, height: 18)
            .overlay { Circle().stroke(DS.C.brandPrimary, lineWidth: 3) }
        }
        .rotationEffect(.degrees(-heading))
        .animation(.easeOut(duration: 0.25), value: heading)
        .opacity(live ? 1 : 0.45)
      }
      .frame(width: size, height: size)
      .frame(maxWidth: .infinity)
    }
    .accessibilityLabel(aligned ? "متجه إلى القبلة" : "اتجاه القبلة \(Int(bearing)) درجة")
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
        VStack(alignment: .trailing, spacing: DS.Space.s4) {
          infoBlock("كيف يُحسب الاتجاه؟", "يُحسب اتجاه القبلة بخوارزمية Vincenty الجيوديسية على مجسّم WGS‑84، وهي أدق من الحساب الكروي المبسّط، وتُعطي أقصر مسار حقيقي على سطح الأرض إلى الكعبة.")
          infoBlock("الشمال الحقيقي لا المغناطيسي", "تقرأ البوصلة الشمال المغناطيسي، وبينه وبين الشمال الحقيقي فرق يبلغ درجات في بعض البلدان. نستعمل الشمال الحقيقي من النظام حين يتوفّر، وإلا نُصحّح القراءة بنموذج الانحراف العالمي WMM 2025.")
          infoBlock("المعايرة", "إن اضطربت الإبرة أو ظهر تنبيه انخفاض الدقة، حرّك الهاتف في الهواء على شكل رقم ٨ مرّتين أو ثلاثًا، وابتعد عن المعادن والمكبّرات والحوامل المغناطيسية.")
          infoBlock("الخصوصية", "كل الحساب يجري على جهازك؛ لا تُرسل إحداثياتك إلى أي خادم.")
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
    VStack(alignment: .trailing, spacing: DS.Space.s2) {
      Text(title).font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary)
      Text(body).font(DS.F.bodySm).foregroundStyle(DS.C.textSecondary)
        .frame(maxWidth: .infinity, alignment: .trailing)
    }
    .dsCard(padding: DS.Space.s4)
  }
}
