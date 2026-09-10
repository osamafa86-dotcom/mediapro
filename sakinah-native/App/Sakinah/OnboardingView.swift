import SwiftUI
import SakinahCore

/// تهيئة أول تشغيل (أربع خطوات): ترحيب وخصوصية → الموقع → التذكير → جاهز؛ يمكن تخطي أي خطوة واستكمالها من الإعدادات
struct OnboardingView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  @State private var step = 0
  @State private var showCities = false
  @State private var locating = false

  var body: some View {
    VStack(spacing: 0) {
      TabView(selection: $step) {
        welcome.tag(0); location.tag(1); notifications.tag(2); done.tag(3)
      }
      .tabViewStyle(.page(indexDisplayMode: .always))
      .indexViewStyle(.page(backgroundDisplayMode: .always))
      HStack {
        if step > 0 { Button("رجوع") { withAnimation { step -= 1 } } }
        Spacer()
        if step < 3 { Button("تخطّي") { withAnimation { step += 1 } }.foregroundStyle(.secondary) }
      }
      .font(.arabic(14)).padding(.horizontal, 20).padding(.bottom, 10)
    }
    .background(Theme.background)
    .sheet(isPresented: $showCities) { NavigationStack { CityPickerView().navigationTitle("اختيار المدينة").navigationBarTitleDisplayMode(.inline) }.environment(model) }
    .onChange(of: model.location.placeName) { if step == 1, model.location.coordinate != nil { locating = false } }
  }

  private func page<Content: View>(icon: String, title: String, @ViewBuilder content: () -> Content) -> some View {
    ScrollView {
      VStack(spacing: 18) {
        Image(systemName: icon).font(.system(size: 56)).foregroundStyle(Theme.primary).padding(.top, 40)
        Text(title).font(.arabic(26, weight: .bold))
        content()
      }
      .padding(24).frame(maxWidth: .infinity)
    }
  }
  private var welcome: some View {
    page(icon: "moon.stars.fill", title: "سكينة") {
      Text("مواقيت الصلاة، القبلة، المصحف، الأذكار والأحاديث في تطبيق واحد يعمل دون اتصال، بلا حساب ولا إعلانات ولا تتبّع.").font(.arabic(16)).multilineTextAlignment(.center).foregroundStyle(.secondary)
      VStack(alignment: .leading, spacing: 10) {
        Label("مواقيت بحساب فلكي دقيق وطرق الهيئات الرسمية", systemImage: "sun.horizon")
        Label("مصحف المدينة بصفحاته مع تلاوات وتفسير وحفظ", systemImage: "book")
        Label("قبلة جيوديسية مع تصحيح الانحراف المغناطيسي", systemImage: "location.north.circle")
        Label("حصن المسلم كاملًا، المسبحة، والأربعون النووية", systemImage: "hands.sparkles")
      }
      .font(.arabic(15)).frame(maxWidth: .infinity, alignment: .leading)
      Text("كل الحسابات على جهازك. الشبكة تُستخدم فقط لجلب التلاوات والترجمات عند طلبها.").font(.arabic(12)).foregroundStyle(.tertiary).multilineTextAlignment(.center)
      Button { withAnimation { step = 1 } } label: { Text("ابدأ").font(.arabic(17, weight: .bold)).frame(maxWidth: .infinity) }.buttonStyle(.borderedProminent).controlSize(.large)
    }
  }
  private var location: some View {
    page(icon: "mappin.and.ellipse", title: "موقعك") {
      Text("تُحسب المواقيت والقبلة من موقعك. يبقى الموقع على جهازك ولا يُرسل إلى أي خدمة.").font(.arabic(15)).multilineTextAlignment(.center).foregroundStyle(.secondary)
      if let name = model.location.placeName, model.location.coordinate != nil {
        Label("الموقع الحالي: \(name)", systemImage: "checkmark.circle.fill").font(.arabic(15)).foregroundStyle(Theme.primary)
      }
      Button { locating = true; model.location.useDeviceLocation() } label: { Label(locating ? "جارٍ تحديد الموقع…" : "تحديد موقعي تلقائيًا", systemImage: "location.fill").font(.arabic(16, weight: .bold)).frame(maxWidth: .infinity) }.buttonStyle(.borderedProminent).controlSize(.large).disabled(locating)
      Button { showCities = true } label: { Label("اختيار مدينة من القائمة (٦٤٩ مدينة)", systemImage: "building.2").font(.arabic(15)).frame(maxWidth: .infinity) }.buttonStyle(.bordered).controlSize(.large)
      if model.location.coordinate != nil { Button("متابعة") { withAnimation { step = 2 } }.font(.arabic(16, weight: .bold)) }
      Text("طريقة الحساب تُختار تلقائيًا حسب الدولة (\(Methods.method(model.settings.methodId).nameAr)) ويمكن تغييرها من الإعدادات.").font(.arabic(12)).foregroundStyle(.tertiary).multilineTextAlignment(.center)
    }
  }
  private var notifications: some View {
    page(icon: "bell.badge", title: "تذكير بالصلاة") {
      Text("إشعار عند كل أذان بصوت الأذان أو نغمة هادئة، وتذكير اختياري قبل الوقت. يصلك حتى والتطبيق مغلق.").font(.arabic(15)).multilineTextAlignment(.center).foregroundStyle(.secondary)
      Button {
        Task { let ok = await model.notifications.requestAuthorization(); await MainActor.run { var r = model.settings.reminders; r.enabled = ok; model.settings.reminders = r; model.rescheduleNotifications(); if ok { withAnimation { step = 3 } } } }
      } label: { Label(model.settings.reminders.enabled ? "التذكير مفعّل ✓" : "تفعيل التذكير بمواعيد الصلاة", systemImage: "bell.fill").font(.arabic(16, weight: .bold)).frame(maxWidth: .infinity) }.buttonStyle(.borderedProminent).controlSize(.large)
      Button("لاحقًا من الإعدادات") { withAnimation { step = 3 } }.font(.arabic(14)).foregroundStyle(.secondary)
    }
  }
  private var done: some View {
    page(icon: "checkmark.seal.fill", title: "جاهز") {
      Text("افتح تبويب الصلاة لمواقيت اليوم، والمصحف للقراءة والاستماع، والأذكار لورد الصباح والمساء.").font(.arabic(15)).multilineTextAlignment(.center).foregroundStyle(.secondary)
      Button { model.settings.seenIntro = true; dismiss() } label: { Text("ابدأ الاستخدام").font(.arabic(17, weight: .bold)).frame(maxWidth: .infinity) }.buttonStyle(.borderedProminent).controlSize(.large)
    }
  }
}
