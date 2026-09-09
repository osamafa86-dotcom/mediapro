import SwiftUI
import CoreLocation
import SakinahCore

/// بوصلة القبلة: اتجاه جيوديسي من النواة، والاتجاه الحقيقي من CoreLocation (أو المغناطيسي + انحراف WMM2025 احتياطًا)
struct QiblaView: View {
  @Environment(AppModel.self) private var model

  var body: some View {
    NavigationStack {
      Group {
        if let c = model.coordinates { compass(for: c) } else { needLocation }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(Theme.background)
      .navigationTitle("القبلة")
      .onAppear { model.location.startHeading() }
      .onDisappear { model.location.stopHeading() }
    }
  }

  private func trueHeading(_ h: CLHeading, at c: Coordinates) -> Double {
    if h.trueHeading >= 0 { return h.trueHeading }
    return Geomag.magneticToTrue(h.magneticHeading, declination: Geomag.declination(lat: c.latitude, lon: c.longitude))
  }

  private func compass(for c: Coordinates) -> some View {
    let s = model.settings
    let q = Qibla.info(latitude: c.latitude, longitude: c.longitude)
    let heading = model.location.heading.map { trueHeading($0, at: c) }
    let diff = heading.map { Qibla.signedDifference(target: q.bearing, reference: $0) }
    let aligned = diff.map { abs($0) <= 3 } ?? false
    return ScrollView {
      VStack(spacing: 20) {
        ZStack {
          Circle().stroke(Color.secondary.opacity(0.25), lineWidth: 2)
          ForEach(0..<72, id: \.self) { i in
            Rectangle().fill(i % 9 == 0 ? Color.primary : Color.secondary.opacity(0.5)).frame(width: i % 9 == 0 ? 3 : 1.5, height: i % 9 == 0 ? 18 : 8).offset(y: -130).rotationEffect(.degrees(Double(i) * 5))
          }
          Text("ش").font(.arabic(16, weight: .bold)).offset(y: -100)
          Image(systemName: "location.north.fill")
            .font(.system(size: 64)).foregroundStyle(aligned ? Color.green : Theme.gold)
            .offset(y: -40)
            .rotationEffect(.degrees(q.bearing))
          Circle().fill(Theme.primary).frame(width: 14, height: 14)
        }
        .frame(width: 300, height: 300)
        .rotationEffect(.degrees(-(heading ?? 0)))
        .animation(.easeOut(duration: 0.25), value: heading ?? 0)
        .padding(.top, 12)

        VStack(spacing: 6) {
          Text(aligned ? "أنت متجه إلى القبلة" : (heading == nil ? "حرّك الهاتف على شكل ٨ لمعايرة البوصلة" : (diff! > 0 ? "أدر يمينًا" : "أدر يسارًا")))
            .font(.arabic(18, weight: .bold)).foregroundStyle(aligned ? .green : .primary)
          Text("اتجاه القبلة \(Fmt.degrees(q.bearing, numerals: s.numerals)) من الشمال الحقيقي (\(q.compassPoint))").font(.arabic(14)).foregroundStyle(.secondary)
          Text("المسافة إلى الكعبة \(Fmt.distance(q.distanceKm, numerals: s.numerals))").font(.arabic(14)).foregroundStyle(.secondary)
          if let h = model.location.heading, h.headingAccuracy > 15 { Text("دقة البوصلة منخفضة — ابتعد عن المعادن والمغناطيس").font(.arabic(13)).foregroundStyle(.orange) }
          if !model.location.headingAvailable { Text("هذا الجهاز بلا بوصلة؛ استخدم الاتجاه بالدرجات مع بوصلة خارجية").font(.arabic(13)).foregroundStyle(.orange) }
        }
        .multilineTextAlignment(.center).padding(.horizontal)
      }
      .padding(.bottom, 24)
    }
  }

  private var needLocation: some View {
    VStack(spacing: 12) {
      Image(systemName: "location.slash").font(.system(size: 40)).foregroundStyle(.secondary)
      Text("حدّد موقعك أولًا من شاشة الصلاة").font(.arabic(16))
      Button("تحديد الموقع") { model.location.requestLocation() }.buttonStyle(.borderedProminent)
    }
  }
}
