import SwiftUI

struct RootView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.scenePhase) private var scenePhase

  var body: some View {
    TabView {
      PrayerView().tabItem { Label("الصلاة", systemImage: "sun.horizon") }
      QiblaView().tabItem { Label("القبلة", systemImage: "location.north.circle") }
      MushafHomeView().tabItem { Label("المصحف", systemImage: "book") }
      AdhkarHomeView().tabItem { Label("الأذكار", systemImage: "hands.sparkles") }
      MoreView().tabItem { Label("المزيد", systemImage: "ellipsis.circle") }
    }
    .onAppear {
      Task.detached(priority: .utility) { _ = QuranText.shared; _ = MushafLayout.shared; _ = QuranSearch.shared; MushafFonts.shared.ensureAmiri(); MushafFonts.shared.ensureSurahNames() }
      model.location.onLocationResolved = { model.applyAutomaticMethodIfNeeded(); model.rescheduleNotifications() }
      if model.location.mode == .gps, model.location.authorization == .authorizedWhenInUse || model.location.authorization == .authorizedAlways { model.location.requestLocation() }
      model.rescheduleNotifications()
    }
    .onChange(of: scenePhase) { _, phase in
      // كل عودة للتطبيق: تحديث حالة الإشعارات وإعادة جدولة الأيام القادمة (حدّ النظام 64 إشعارًا معلّقًا)
      if phase == .active { model.notifications.refreshStatus(); model.rescheduleNotifications(); BackupService.autoSnapshot(model) }
    }
  }
}
