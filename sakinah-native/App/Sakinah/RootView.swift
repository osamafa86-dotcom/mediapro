import SwiftUI
import SakinahCore

/// تبديل التبويب من داخل الشاشات (بلاطات الوصول السريع)
struct SwitchTabKey: EnvironmentKey { static let defaultValue: (AppTab) -> Void = { _ in } }
extension EnvironmentValues { var switchTab: (AppTab) -> Void { get { self[SwitchTabKey.self] } set { self[SwitchTabKey.self] = newValue } } }

/// غلافٌ معرَّف كي يقبله `fullScreenCover(item:)` — لقطات المتجر وحدها
private struct ShotPage: Identifiable { let page: Int; var id: Int { page } }

struct RootView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.scenePhase) private var scenePhase
  @State private var showOnboarding = false
  @State private var tab: AppTab = ScreenshotMode.tab ?? .home
  /// صفحة المصحف التي يُفتح عليها القارئ في وضع اللقطات وحده
  @State private var shotPage: Int? = ScreenshotMode.readerPage
  /// ارتفاع الشريط العائم يُقاس ويُمرَّر لكل تبويب كمنطقة آمنة سفلية
  @State private var barHeight: CGFloat = 84

  var body: some View {
    // ⚠️ safeAreaInset على TabView نفسه لا يصل إلى محتوى التبويبات (UITabBarController خلفه): آخر بطاقة
    // في الرئيسية بقيت مقطوعة خلف الشريط رغم حشوة ٤٠ نقطة (قِيس على جهاز المالك، بناء ٣٩).
    // فالشريط طبقة فوق الحاوية، والإزاحة تُطبَّق داخل كل تبويب حيث تحترمها ScrollView.
    TabView(selection: $tab) {
      HomeView().tabContent(inset: barHeight).tag(AppTab.home)
      MushafHomeView().tabContent(inset: barHeight).tag(AppTab.mushaf)
      AdhkarHomeView().tabContent(inset: barHeight).tag(AppTab.adhkar)
      MoreView().tabContent(inset: barHeight).tag(AppTab.more)
    }
    .overlay(alignment: .bottom) {
      DSTabBar(selection: $tab)
        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { barHeight = $0 }
    }
    .environment(\.switchTab, { t in withAnimation(.snappy(duration: 0.2)) { tab = t } })
    .background(DS.C.bgCanvas)
    .fullScreenCover(isPresented: $showOnboarding) { OnboardingView().environment(model) }
    // لقطات المتجر وحدها: يُفتح القارئ على صفحةٍ بعينها بلا قيادة واجهة
    .fullScreenCover(item: Binding(get: { shotPage.map(ShotPage.init) }, set: { shotPage = $0?.page })) { p in
      MushafReaderView(startPage: p.page).environment(model)
    }
    .onAppear {
      ScreenshotMode.seed(model)
      if !model.settings.seenIntro && model.location.coordinate == nil { showOnboarding = true }
      Task.detached(priority: .utility) { _ = QuranText.shared; _ = MushafLayout.shared; _ = QuranSearch.shared; MushafFonts.shared.ensureAmiri(); MushafFonts.shared.ensureSurahNames() }
      model.location.onLocationResolved = { model.applyAutomaticMethodIfNeeded(); model.rescheduleNotifications() }
      if model.location.mode == .gps, model.location.authorization == .authorizedWhenInUse || model.location.authorization == .authorizedAlways { model.location.requestLocation() }
      model.rescheduleNotifications()
      LiveActivityManager.sync(model)
    }
    .onChange(of: scenePhase) { _, phase in
      // كل عودة للتطبيق: تحديث حالة الإشعارات وإعادة جدولة الأيام القادمة (حدّ النظام 64 إشعارًا معلّقًا)
      if phase == .active { model.notifications.refreshStatus(); model.rescheduleNotifications(); BackupService.autoSnapshot(model); LiveActivityManager.sync(model) }
    }
  }
}
