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

  /// مزامنة الجدول كاملًا من النواة: مواعيد محدّدة (صلوات وأذكار) + يومية متكررة (حديث اليوم، ورد الختمة)
  func sync(reminders: [Reminder], daily: [DailyReminder] = [], prefs: ReminderPrefs, tz: TimeZone) {
    center.removeAllPendingNotificationRequests()
    var cal = Calendar(identifier: .gregorian); cal.timeZone = tz
    let prayerItems = prefs.enabled ? reminders.filter { $0.kind == .adhan || $0.kind == .pre || $0.kind == .sunrise } : []
    let extraItems = reminders.filter { $0.kind == .adhkar }
    for r in prayerItems + extraItems {
      let content = UNMutableNotificationContent()
      content.title = r.title
      content.body = r.body
      content.threadIdentifier = r.kind == .adhkar ? "adhkar" : "prayer"
      content.userInfo = ["kind": r.kind.rawValue, "prayer": r.prayer?.rawValue ?? ""]
      if r.kind == .adhan && prefs.usesAdhanSound { content.sound = UNNotificationSound(named: UNNotificationSoundName("adhan_short.wav")) }
      else if r.kind == .adhkar || prefs.sound != "none" { content.sound = .default }
      content.interruptionLevel = r.kind == .adhan ? .timeSensitive : .active
      let comps = cal.dateComponents([.year, .month, .day, .hour, .minute, .second], from: r.time)
      let req = UNNotificationRequest(identifier: r.id, content: content, trigger: UNCalendarNotificationTrigger(dateMatching: comps, repeats: false))
      center.add(req)
    }
    for d in daily {
      let content = UNMutableNotificationContent()
      content.title = d.title; content.body = d.body; content.sound = .default; content.threadIdentifier = d.kind.rawValue
      content.userInfo = ["kind": d.kind.rawValue]
      var comps = DateComponents(); comps.hour = d.hour; comps.minute = d.minute; comps.timeZone = tz
      center.add(UNNotificationRequest(identifier: d.id, content: content, trigger: UNCalendarNotificationTrigger(dateMatching: comps, repeats: true)))
    }
    if !(prayerItems + extraItems).isEmpty || !daily.isEmpty { Task { _ = await requestAuthorizationIfNeeded() } }
    refreshStatus()
  }
  private func requestAuthorizationIfNeeded() async -> Bool {
    let s = await center.notificationSettings()
    if s.authorizationStatus == .notDetermined { return await requestAuthorization() }
    return s.authorizationStatus == .authorized || s.authorizationStatus == .provisional
  }

  // MARK: - UNUserNotificationCenterDelegate
  func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent n: UNNotification, withCompletionHandler handler: @escaping (UNNotificationPresentationOptions) -> Void) {
    let info = n.request.content.userInfo
    if (info["kind"] as? String) == "adhan" { onForegroundAdhan?(Prayer(rawValue: (info["prayer"] as? String) ?? "")) }
    handler([.banner, .list, .sound])
  }
  func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler handler: @escaping () -> Void) { handler() }
}
