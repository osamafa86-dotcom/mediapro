import SwiftUI
import MapKit
import SakinahCore

/// «الخريطة» في شاشة القبلة (qibla-map.png): خطّ الدائرة العظمى من موضعك إلى الكعبة (نقاطه محسوبة على الجهاز من النواة)،
/// وعلامتا الموضعين، وحبّة المسافة، وبطاقة شرحٍ للاتجاه. البلاطات وحدها تُحمَّل من خرائط آبل؛ الخطّ والمسافة يبقيان بلا اتصال
struct QiblaMapPanel: View {
  @Environment(AppModel.self) private var model
  let coords: Coordinates
  @State private var position: MapCameraPosition = .automatic

  private var userPoint: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: coords.latitude, longitude: coords.longitude) }
  private var kaabaPoint: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: Qibla.kaaba.latitude, longitude: Qibla.kaaba.longitude) }
  /// ٦٥ نقطة على قوس الدائرة العظمى (Qibla.greatCirclePoints) — مقاطع قصيرة تتبع الانحناء على الخريطة المسطّحة
  private var arc: [CLLocationCoordinate2D] {
    Qibla.greatCirclePoints(lat1: coords.latitude, lon1: coords.longitude, lat2: Qibla.kaaba.latitude, lon2: Qibla.kaaba.longitude, n: 64)
      .map { CLLocationCoordinate2D(latitude: $0.0, longitude: $0.1) }
  }

  var body: some View {
    let n = model.settings.numerals
    let q = Qibla.info(latitude: coords.latitude, longitude: coords.longitude)
    let line = arc
    let userTitle = model.location.placeName.map { "أنت، \($0)" } ?? "موقعك"
    VStack(spacing: DS.Space.s4) {
      Map(position: $position) {
        MapPolyline(coordinates: line)
          .stroke(DS.C.brandPrimary, style: StrokeStyle(lineWidth: 3, lineCap: .round, dash: [7, 6]))
        Annotation(userTitle, coordinate: userPoint) {
          Circle().fill(DS.C.bgSurface).frame(width: 20, height: 20)
            .overlay(Circle().stroke(DS.C.brandPrimary, lineWidth: 4))
        }
        Annotation("مكة المكرمة", coordinate: kaabaPoint) {
          KaabaGlyph(size: 26)
            .overlay(RoundedRectangle(cornerRadius: 4, style: .continuous).stroke(Color.white, lineWidth: 1.5))
        }
      }
      .mapStyle(.standard(pointsOfInterest: .excludingAll))
      .frame(height: 420)
      .clipShape(RoundedRectangle(cornerRadius: DS.Radius.xl, style: .continuous))
      // في البيئة RTL «topLeading» أعلى اليمين كما في التصميم
      .overlay(alignment: .topLeading) {
        Text("\(QiblaText.distance(q.distanceKm, numerals: n)) إلى الكعبة")
          .font(DS.F.labelSm).foregroundStyle(DS.C.textOnBrand)
          .padding(.vertical, 7).padding(.horizontal, 12)
          .background(DS.C.brandPrimary, in: Capsule())
          .padding(12)
      }
      .onAppear { position = .rect(fitRect(line)) }
      .onChange(of: coords) { _, _ in position = .rect(fitRect(arc)) }
      .accessibilityLabel("خريطة الطريق الأقصر من موضعك إلى الكعبة")

      VStack(alignment: .leading, spacing: 6) {
        Text("أقصر طريقٍ على سطح الأرض").font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary)
        Text("الخطّ المتقطّع هو الدائرة العظمى من موضعك إلى الكعبة، ومنه يُحسب الاتجاه \(Fmt.degrees(q.bearing, numerals: n)) من الشمال الحقيقي. قد يبدو منحنيًا على الخريطة المسطّحة.")
          .font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary).fixedSize(horizontal: false, vertical: true)
      }
      .todayCard(padding: 16)

      Text("الحساب كلّه على جهازك؛ والخريطة وحدها تُحمَّل من خرائط آبل، وبلا اتصالٍ يبقى الخطّ والمسافة.")
        .font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).frame(maxWidth: .infinity, alignment: .leading).fixedSize(horizontal: false, vertical: true)
    }
  }

  /// مستطيلٌ يحيط بالقوس كلّه مع هامش (للعلامتين وأسمائهما)، وحدٌّ أدنى حين تكون قريبًا من الكعبة
  private func fitRect(_ pts: [CLLocationCoordinate2D]) -> MKMapRect {
    let mps = pts.map { MKMapPoint($0) }
    let xs = mps.map { $0.x }, ys = mps.map { $0.y }
    let minX = xs.min() ?? 0, maxX = xs.max() ?? 0
    let minY = ys.min() ?? 0, maxY = ys.max() ?? 0
    let w = max(maxX - minX, 40_000), h = max(maxY - minY, 40_000)
    return MKMapRect(x: minX - w * 0.25, y: minY - h * 0.3, width: w * 1.5, height: h * 1.6)
  }
}
