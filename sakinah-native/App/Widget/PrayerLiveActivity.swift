import SwiftUI
import WidgetKit
import ActivityKit

/// النشاط المباشر: الصلاة القادمة بعدّ تنازلي على شاشة القفل وفي الجزيرة الديناميكية
struct PrayerLiveActivity: Widget {
  private let teal = Color(red: 0.059, green: 0.463, blue: 0.431)
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: PrayerActivityAttributes.self) { context in
      HStack(spacing: 12) {
        Image(systemName: "moon.stars.fill").font(.system(size: 28)).foregroundStyle(teal)
        VStack(alignment: .leading, spacing: 2) {
          Text("الصلاة القادمة: \(context.state.prayerName)").font(.system(size: 15, weight: .bold))
          HStack(spacing: 6) { Text(context.state.time, style: .time); Text("·"); Text(context.attributes.placeName) }.font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(1)
        }
        Spacer()
        Text(timerInterval: Date()...context.state.time, countsDown: true).font(.system(size: 20, weight: .semibold)).monospacedDigit().frame(width: 90, alignment: .trailing)
      }
      .padding(14)
      .environment(\.layoutDirection, .rightToLeft)
      .activityBackgroundTint(Color(.systemBackground).opacity(0.9))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) { Text(context.state.prayerName).font(.system(size: 16, weight: .bold)).foregroundStyle(teal) }
        DynamicIslandExpandedRegion(.trailing) { Text(timerInterval: Date()...context.state.time, countsDown: true).font(.system(size: 16, weight: .semibold)).monospacedDigit().frame(width: 80, alignment: .trailing) }
        DynamicIslandExpandedRegion(.bottom) {
          HStack { Text(context.state.time, style: .time); Text("·"); Text(context.attributes.placeName); if let f = context.state.followingName, let t = context.state.followingTime { Spacer(); Text("ثم \(f) "); Text(t, style: .time) } }.font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(1)
        }
      } compactLeading: {
        Image(systemName: "moon.stars.fill").foregroundStyle(teal)
      } compactTrailing: {
        Text(timerInterval: Date()...context.state.time, countsDown: true).font(.system(size: 12)).monospacedDigit().frame(width: 52)
      } minimal: {
        Image(systemName: "moon.stars.fill").foregroundStyle(teal)
      }
    }
  }
}
