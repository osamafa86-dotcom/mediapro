import SwiftUI
import MapKit
import SakinahCore

/// المساجد القريبة: بحث بالاسم، خريطة بالمواقع، وقائمة بالبعد ووقت السير والاتجاهات
struct MosquesView: View {
  @Environment(AppModel.self) private var model
  @State private var finder = MosqueFinder()
  @State private var query = ""
  @State private var position: MapCameraPosition = .automatic

  var body: some View {
    let n = model.settings.numerals
    ScrollView(showsIndicators: false) {
      VStack(spacing: DS.Space.s3) {
        if let c = model.coordinates {
          searchBar(c)
          mapCard(c)
          // نتائج آبل تظهر فورًا والقائمة لا تُخفى ريثما تصل OpenStreetMap (قد تتأخّر ٢٠ ث على خادمها العام)
          if finder.loading, finder.results.isEmpty {
            HStack(spacing: 8) { ProgressView(); Text("جارٍ البحث…").font(DS.F.bodySm).foregroundStyle(DS.C.textSecondary) }.padding(.vertical, DS.Space.s4)
          } else if finder.loading {
            HStack(spacing: 8) { ProgressView().controlSize(.small); Text("يجري تدقيق الأقرب من OpenStreetMap…").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary) }
            ForEach(finder.results) { m in row(m, numerals: n) }
          } else if let e = finder.error {
            hint(e, warn: true)
          } else if finder.results.isEmpty {
            hint("لا مساجد ضمن المدى — جرّب البحث بالاسم", warn: false)
          } else {
            if let w = finder.osmError { hint("\(w) — النتائج من خرائط آبل وحدها الآن، اسحب «تحديث» بعد قليل", warn: true) }
            ForEach(finder.results) { m in row(m, numerals: n) }
          }
          if finder.appleCount + finder.osmCount > 0 {
            Text("المصادر: خرائط آبل \(Fmt.number(finder.appleCount, numerals: n)) · OpenStreetMap \(Fmt.number(finder.osmCount, numerals: n)) — مرتّبة بالبعد الحقيقي عنك")
              .font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).multilineTextAlignment(.center).padding(.top, DS.Space.s2)
          }
          Text("النتائج من خرائط آبل و© مساهمي OpenStreetMap. يُرسل موقعك مقرّبًا إلى نحو كيلومتر عند كل بحث، ولا يُحفظ لدينا.")
            .font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).multilineTextAlignment(.center)
        } else {
          needLocation
        }
      }
      .padding(.horizontal, DS.Space.s4).padding(.top, DS.Space.s2).padding(.bottom, DS.Space.s8)
    }
    .background(DS.C.bgCanvas)
    .navigationTitle("المساجد القريبة").navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Button { Task { if let c = model.coordinates { await finder.nearby(around: c, force: true) } } } label: { Image(systemName: "arrow.clockwise") }.accessibilityLabel("تحديث")
      }
    }
    .task { if let c = model.coordinates, finder.results.isEmpty { await finder.nearby(around: c) } }
  }

  private func searchBar(_ c: Coordinates) -> some View {
    HStack(spacing: 8) {
      Image(systemName: "magnifyingglass").foregroundStyle(DS.C.textTertiary)
      TextField("ابحث باسم المسجد", text: $query)
        .font(DS.F.bodyMd).submitLabel(.search)
        .onSubmit { Task { await finder.nearby(around: c, query: query, force: true) } }
      if !query.isEmpty {
        Button { query = ""; Task { await finder.nearby(around: c) } } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(DS.C.textTertiary) }.buttonStyle(.plain).accessibilityLabel("مسح البحث")
      }
    }
    .padding(.vertical, 10).padding(.horizontal, 14)
    .background(DS.C.bgSurface, in: Capsule())
    .overlay(Capsule().stroke(DS.C.borderSubtle, lineWidth: 1))
  }

  private func mapCard(_ c: Coordinates) -> some View {
    Map(position: $position) {
      UserAnnotation()
      ForEach(finder.results) { m in
        Annotation(m.name, coordinate: m.coordinate) {
          Image(systemName: "building.columns.fill").font(.system(size: 11, weight: .semibold)).foregroundStyle(DS.C.textOnBrand)
            .frame(width: 26, height: 26).background(DS.C.brandPrimary, in: Circle()).overlay(Circle().stroke(.white, lineWidth: 2))
        }
      }
    }
    .mapStyle(.standard(pointsOfInterest: .excludingAll))
    .frame(height: 220)
    .clipShape(RoundedRectangle(cornerRadius: DS.Radius.xl, style: .continuous))
    .onChange(of: finder.results) { _, r in
      // تأطير الخريطة على أبعد نتيجة من العشر الأولى
      let far = r.prefix(10).map(\.distanceKm).max() ?? 1
      let meters = max(1_500, far * 2_300)
      position = .region(MKCoordinateRegion(center: CLLocationCoordinate2D(latitude: c.latitude, longitude: c.longitude), latitudinalMeters: meters, longitudinalMeters: meters))
    }
  }

  private func row(_ m: Mosque, numerals n: String) -> some View {
    HStack(spacing: 12) {
      DSIcon(systemName: "building.columns", style: .soft, size: 40, iconSize: 16)
      VStack(alignment: .leading, spacing: 2) {
        Text(m.name).font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary).lineLimit(1)
        Text([MosqueFinder.distanceLabel(m.distanceKm, numerals: n), MosqueFinder.walkLabel(m.distanceKm, numerals: n), m.address].compactMap { $0 }.joined(separator: " · "))
          .font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).lineLimit(1)
      }
      Spacer(minLength: 4)
      Button { MosqueFinder.openDirections(to: m) } label: { DSIcon(systemName: "arrow.triangle.turn.up.right.diamond", style: .brand, size: 38, iconSize: 16) }
        .buttonStyle(.plain).accessibilityLabel("الاتجاهات إلى \(m.name)")
    }
    .dsCard(padding: 12, radius: DS.Radius.lg)
  }

  private func hint(_ text: String, warn: Bool) -> some View {
    HStack(spacing: DS.Space.s2) {
      Text(text).font(DS.F.bodySm).foregroundStyle(warn ? DS.C.warning : DS.C.textSecondary).frame(maxWidth: .infinity, alignment: .leading)
      Image(systemName: warn ? "wifi.exclamationmark" : "mappin.slash").foregroundStyle(warn ? DS.C.warning : DS.C.textTertiary)
    }
    .padding(DS.Space.s3)
    .background(DS.C.bgSubtle, in: RoundedRectangle(cornerRadius: DS.Radius.md, style: .continuous))
  }

  private var needLocation: some View {
    VStack(spacing: DS.Space.s4) {
      DSIcon(systemName: "location.slash", style: .soft, size: 64, iconSize: 26)
      Text("حدّد موقعك لعرض المساجد القريبة").font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary)
      DSButton(title: "تحديد الموقع", icon: "location.fill") { model.location.requestLocation() }
    }
    .padding(.top, DS.Space.s8)
  }
}
