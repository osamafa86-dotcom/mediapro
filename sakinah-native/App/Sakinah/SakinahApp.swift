import SwiftUI

/// تطبيق «سكينة» الأصلي (SwiftUI) فوق النواة SakinahCore — نظام التصميم في DesignSystem.swift وComponents.swift
@main
struct SakinahApp: App {
  @State private var model = AppModel()

  init() { DS.registerFonts() }

  var body: some Scene {
    WindowGroup {
      RootView()
        .environment(model)
        .environment(\.layoutDirection, .rightToLeft)
        .environment(\.locale, Locale(identifier: "ar"))
        .tint(DS.C.brandPrimary)
    }
  }
}
