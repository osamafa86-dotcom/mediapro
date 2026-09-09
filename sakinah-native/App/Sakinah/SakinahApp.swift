import SwiftUI

/// تطبيق «سكينة» الأصلي (SwiftUI) — المرحلة 1: المواقيت والقبلة والإعدادات فوق النواة SakinahCore
@main
struct SakinahApp: App {
  @State private var model = AppModel()

  var body: some Scene {
    WindowGroup {
      RootView()
        .environment(model)
        .environment(\.layoutDirection, .rightToLeft)
        .environment(\.locale, Locale(identifier: "ar"))
        .tint(Theme.primary)
    }
  }
}
