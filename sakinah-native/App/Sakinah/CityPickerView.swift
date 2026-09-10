import SwiftUI
import SakinahCore

/// اختيار المدينة دون اتصال (649 مدينة) أو العودة إلى موقع الجهاز
struct CityPickerView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  @State private var query = ""
  private let db = CityDatabase.bundled

  var body: some View {
    let results = db.search(query, limit: 60)
    List {
      Section {
        Button {
          model.location.useDeviceLocation(); model.rescheduleNotifications(); dismiss()
        } label: {
          Label(model.location.mode == .gps ? "موقع الجهاز (مُستخدَم الآن)" : "استخدام موقع الجهاز", systemImage: "location.fill")
        }
      }
      Section(query.isEmpty ? "المدن" : "النتائج") {
        ForEach(results) { c in
          Button {
            model.location.useCity(c); model.applyAutomaticMethodIfNeeded(); model.rescheduleNotifications(); dismiss()
          } label: {
            HStack {
              VStack(alignment: .leading, spacing: 2) { Text(c.nameAr).font(.arabic(16)); Text("\(c.countryAr) · \(c.nameEn)").font(.arabic(12)).foregroundStyle(.secondary) }
              Spacer()
              if model.location.mode == .manual && model.location.cityId == c.id { Image(systemName: "checkmark").foregroundStyle(Theme.primary) }
            }
          }.foregroundStyle(.primary)
        }
      }
    }
    .searchable(text: $query, prompt: "ابحث عن مدينة أو دولة")
    .navigationTitle("الموقع")
  }
}
