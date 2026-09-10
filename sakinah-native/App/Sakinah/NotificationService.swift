import Foundation
import UserNotifications
import Observation
import SakinahCore

/// إشعارات النظام بمواعيد الصلاة: تُجدوَل محليًا لأقرب 60 موعدًا (حدّ iOS 64) وتُعاد الجدولة عند كل تغيير أو عودة للتطبيق
@Observable
final class NotificationService: NSObject, UNUserNotificationCenterDelegate {
  private let center = UNUserNotificationCenter.current()
  var authorization: UNAuthorizationStatus = .notDetermined
  var pendingCount = 0
  var scheduledUntil: Date?
  /// يُستدعى عند وصول إشعار أذان والتطبيق في المقدمة (لتشغيل الأذان الكامل)
  var onForegroundAdhan: ((Prayer?) -> Void)?

  override init() { super.init(); center.delegate = self; refreshStatus() }

  func refreshStatus() {
    center.getNotificationSettings { s in DispatchQueue.main.async { self.authorization = s.authorizationStatus } }
    center.getPendingNotificationRequests { reqs in
      let dates = reqs.compactMap { ($0.trigger as? UNCalendarNotificationTrigger)?.nextTriggerDate() }
      DispatchQueue.main.async { self.pendingCount = reqs.count; self.scheduledUntil = dates.max() }
    }
  }

  func requestAuthorization() async -> Bool {
    let ok = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    await MainActor.run { refreshStatus() }
    return ok
  }

  /// مزامنة الجدول كاملًا من النواة
  func sync(reminders: [Reminder], prefs: ReminderPrefs, tz: TimeZone) {
    center.removeAllPendingNotificationRequests()
    guard prefs.enabled, !reminders.isEmpty else { refreshStatus(); return }
    var cal = Calendar(identifier: .gregorian); cal.timeZone = tz
    for r in reminders {
      let content = UNMutableNotificationContent()
      content.title = r.title
      content.body = r.body
      content.threadIdentifier = "prayer"
      content.userInfo = ["kind": r.kind.rawValue, "prayer": r.prayer?.rawValue ?? ""]
      if r.kind == .adhan && prefs.usesAdhanSound { content.sound = UNNotificationSound(named: UNNotificationSoundName("adhan_short.wav")) }
      else if prefs.sound != "none" { content.sound = .default }
      content.interruptionLevel = r.kind == .adhan ? .timeSensitive : .active
      let comps = cal.dateComponents([.year, .month, .day, .hour, .minute, .second], from: r.time)
      let req = UNNotificationRequest(identifier: r.id, content: content, trigger: UNCalendarNotificationTrigger(dateMatching: comps, repeats: false))
      center.add(req)
    }
    refreshStatus()
  }

  // MARK: - UNUserNotificationCenterDelegate
  func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent n: UNNotification, withCompletionHandler handler: @escaping (UNNotificationPresentationOptions) -> Void) {
    let info = n.request.content.userInfo
    if (info["kind"] as? String) == "adhan" { onForegroundAdhan?(Prayer(rawValue: (info["prayer"] as? String) ?? "")) }
    handler([.banner, .list, .sound])
  }
  func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler handler: @escaping () -> Void) { handler() }
}
