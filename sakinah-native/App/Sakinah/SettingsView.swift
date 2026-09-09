import SwiftUI
import SakinahCore

struct SettingsView: View {
  @Environment(AppModel.self) private var model
  private var version: String { (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "—" }
  private var build: String { (Bundle.main.infoDictionary?["CFBundleVersion"] as? String) ?? "—" }

  var body: some View {
    @Bindable var settings = model.settings
    NavigationStack {
      Form {
        Section("العرض") {
          Toggle("نظام 12 ساعة", isOn: $settings.hour12)
          Picker("الأرقام", selection: $settings.numerals) { Text("1 2 3").tag("latn"); Text("١ ٢ ٣").tag("arab") }
          Stepper("تعديل التاريخ الهجري: \(Fmt.number(settings.hijriOffset, numerals: settings.numerals)) يوم", value: $settings.hijriOffset, in: -2...2)
        }
        Section("المواقيت") {
          NavigationLink { MethodPicker() } label: { HStack { Text("طريقة الحساب"); Spacer(); Text(Methods.method(settings.methodId).nameAr).font(.arabic(13)).foregroundStyle(.secondary).lineLimit(1) } }
          Picker("خطوط العرض العالية", selection: $settings.highLatitudeRule) {
            ForEach(HighLatitudeRule.allCases, id: \.self) { r in Text(r == .auto ? "تلقائي" : r.nameAr).tag(r) }
          }
        }
        Section("الموقع") {
          HStack { Text("المكان"); Spacer(); Text(model.location.placeName ?? "غير محدد").foregroundStyle(.secondary) }
          Button("تحديث الموقع") { model.location.requestLocation() }
        }
        Section("عن التطبيق") {
          HStack { Text("الإصدار"); Spacer(); Text("\(version) (بناء \(build))").foregroundStyle(.secondary) }
          Text("تطبيق أصلي بالكامل (Swift وSwiftUI) على نواة SakinahCore المُختبرة رقمًا برقم ضد محرك سكينة المُتحقَّق منه. كل الحسابات تتم على جهازك؛ لا حساب ولا تتبّع.").font(.arabic(13)).foregroundStyle(.secondary)
        }
      }
      .navigationTitle("المزيد")
    }
  }
}
