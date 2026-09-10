import Foundation
import ActivityKit
import WidgetKit

/// إدارة النشاط المباشر للصلاة القادمة: يبدأ/يُحدَّث عند فتح التطبيق (لا تحديث في الخلفية)، وينتهي بعد موعد الصلاة
@MainActor
enum LiveActivityManager {
  static func sync(_ model: AppModel) {
    WidgetCenter.shared.reloadAllTimelines()
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
    let enabled = model.settings.liveActivity
    let existing = Activity<PrayerActivityAttributes>.activities
    guard enabled, let tl = model.timeline(now: Date()) else { for a in existing { Task { await a.end(nil, dismissalPolicy: .immediate) } }; return }
    let next = tl.next
    var following: (String, Date)? = nil
    if let i = Prayer.allCases.firstIndex(of: next.key) { for k in Prayer.allCases[(i + 1)...] where k != .sunrise { if let t = tl.times[k], t > next.time { following = (k.nameAr, t); break } } }
    let state = PrayerActivityAttributes.ContentState(prayer: next.key.rawValue, prayerName: next.key.nameAr, time: next.time, followingName: following?.0, followingTime: following?.1)
    let content = ActivityContent(state: state, staleDate: next.time.addingTimeInterval(300))
    if let a = existing.first {
      Task { await a.update(content) }
      for extra in existing.dropFirst() { Task { await extra.end(nil, dismissalPolicy: .immediate) } }
    } else if next.time.timeIntervalSinceNow < 6 * 3600 {
      _ = try? Activity.request(attributes: PrayerActivityAttributes(placeName: model.location.placeName ?? "موقعك"), content: content, pushType: nil)
    }
  }
}
