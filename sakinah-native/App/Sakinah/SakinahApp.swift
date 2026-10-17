import SwiftUI
import UIKit

/// تطبيق «سكينة» الأصلي (SwiftUI) فوق النواة SakinahCore — نظام التصميم في DesignSystem.swift وComponents.swift
@main
struct SakinahApp: App {
  @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
  @State private var model = AppModel()

  // الحزمة تُنشأ مبكرًا كي يُعاد ربط تنزيلها الجاري في الخلفية بالواجهة
  init() { DS.registerFonts(); _ = MushafPack.shared }

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

/// يوقظ النظام التطبيق حين يكتمل تنزيل صفحات المصحف في الخلفية؛ الحزمة تُكمل المعالجة ثم تُبلغ النظام
final class AppDelegate: NSObject, UIApplicationDelegate {
  func application(_ application: UIApplication, handleEventsForBackgroundURLSession identifier: String, completionHandler: @escaping () -> Void) {
    if identifier == MushafPack.sessionID { MushafPack.shared.backgroundCompletion = completionHandler } else { completionHandler() }
  }
}
