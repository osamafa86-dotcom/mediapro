import SwiftUI
import SakinahCore

/// اختيار طريقة الحساب ومذهب العصر
struct MethodPicker: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    NavigationStack {
      List {
        Section {
          Toggle(isOn: Binding(get: { model.settings.methodIsAutomatic }, set: { v in model.settings.methodIsAutomatic = v; if v { model.applyAutomaticMethodIfNeeded() }; model.rescheduleNotifications() })) {
            VStack(alignment: .leading) { Text("تلقائي حسب الدولة").font(DS.F.bodyLg); Text("تُختار الهيئة الرسمية لبلدك من الموقع").font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary) }
          }.toggleStyle(DSToggleStyle())
        }
        Section("الطرق") {
          ForEach(Methods.order, id: \.self) { id in
            let m = Methods.method(id)
            Button {
              model.settings.methodIsAutomatic = false; model.settings.methodId = id; model.rescheduleNotifications(); dismiss()
            } label: {
              HStack { VStack(alignment: .leading) { Text(m.nameAr).font(DS.F.bodyLg); Text(m.nameEn).font(.system(size: 12)).foregroundStyle(DS.C.textSecondary) }; Spacer(); if model.settings.methodId == id { Image(systemName: "checkmark").foregroundStyle(DS.C.brandPrimary) } }
            }.foregroundStyle(DS.C.textPrimary)
          }
        }
        Section("مذهب العصر") {
          Picker("مذهب العصر", selection: Binding(get: { model.settings.madhab }, set: { model.settings.madhab = $0; model.rescheduleNotifications() })) {
            Text("الجمهور (مثل الظل)").tag(Madhab.shafi); Text("الحنفي (مثلا الظل)").tag(Madhab.hanafi)
          }.pickerStyle(.inline).labelsHidden()
        }
      }
      .scrollContentBackground(.hidden).background(DS.C.bgCanvas)
      .tabBarClearance()
      .navigationTitle("طريقة الحساب").navigationBarTitleDisplayMode(.inline)
      .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("تم") { dismiss() }.font(DS.F.labelMd) } }
    }
  }
}
