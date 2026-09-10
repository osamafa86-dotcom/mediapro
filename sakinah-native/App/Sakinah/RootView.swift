import SwiftUI
import SakinahCore

/// تبديل التبويب من داخل الشاشات (بلاطات الوصول السريع)
struct SwitchTabKey: EnvironmentKey { static let defaultValue: (AppTab) -> Void = { _ in } }
extension EnvironmentValues { var switchTab: (AppTab) -> Void { get { self[SwitchTabKey.self] } set { self[SwitchTabKey.self] = newValue } } }

struct RootView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.scenePhase) private var scenePhase
  @State private var showOnboarding = false
  @State private var tab: AppTab = .prayer

  var body: some View {
    TabView(selection: $tab) {
      PrayerView().hiddenSystemTabBar().tag(AppTab.prayer)
      QiblaView().hiddenSystemTabBar().tag(AppTab.qibla)
      MushafHomeView().hiddenSystemTabBar().tag(AppTab.mushaf)
      AdhkarHomeView().hiddenSystemTabBar().tag(AppTab.adhkar)
      MoreView().hiddenSystemTabBar().tag(AppTab.more)
    }
    .safeAreaInset(edge: .bottom, spacing: 0) { DSTabBar(selection: $tab) }
    .environment(\.switchTab, { t in withAnimation(.snappy(duration: 0.2)) { tab = t } })
    .background(DS.C.bgCanvas)
    .fullScreenCover(isPresented: $showOnboarding) { OnboardingView().environment(model) }
    .onAppear {
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
