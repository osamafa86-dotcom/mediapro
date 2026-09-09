import SwiftUI

struct RootView: View {
  @Environment(AppModel.self) private var model

  var body: some View {
    TabView {
      PrayerView().tabItem { Label("الصلاة", systemImage: "sun.horizon") }
      QiblaView().tabItem { Label("القبلة", systemImage: "location.north.circle") }
      MushafPlaceholderView().tabItem { Label("المصحف", systemImage: "book") }
      AdhkarPlaceholderView().tabItem { Label("الأذكار", systemImage: "hands.sparkles") }
      SettingsView().tabItem { Label("المزيد", systemImage: "ellipsis.circle") }
    }
    .onAppear {
      model.location.onLocationResolved = { model.applyAutomaticMethodIfNeeded() }
      if model.location.authorization == .authorizedWhenInUse || model.location.authorization == .authorizedAlways { model.location.requestLocation() }
    }
  }
}
