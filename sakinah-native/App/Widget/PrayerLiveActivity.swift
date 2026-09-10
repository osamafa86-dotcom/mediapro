import SwiftUI
import WidgetKit
import ActivityKit

/// النشاط المباشر (تصميم Figma): بطاقة ليل على شاشة القفل بعدّ تنازلي ذهبي وشريط تقدّم، وجزيرة ديناميكية مطابقة
struct PrayerLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: PrayerActivityAttributes.self) { context in
      lockScreen(context)
        .environment(\.layoutDirection, .rightToLeft)
        .activityBackgroundTint(WDS.nightBottom)
        .activitySystemActionForegroundColor(WDS.accentGoldSoft)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          VStack(alignment: .leading, spacing: 2) {
            Text(timerInterval: Date()...context.state.time, countsDown: true)
              .font(.system(size: 22, weight: .semibold)).monospacedDigit()
              .foregroundStyle(WDS.textOnDark)
              .frame(width: 96, alignment: .leading)
            Text("الأذان \(timeText(context.state.time))")
              .font(.system(size: 11)).foregroundStyle(WDS.accentGoldSoft)
          }
        }
        DynamicIslandExpandedRegion(.trailing) {
          VStack(alignment: .trailing, spacing: 2) {
            Text("الصلاة القادمة").font(.system(size: 10)).foregroundStyle(WDS.textOnDarkMuted)
            Text(context.state.prayerName).font(.system(size: 22, weight: .bold)).foregroundStyle(WDS.textOnDark)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(spacing: 6) {
            WidgetProgressBar(progress: progress(context)).padding(.horizontal, 2)
            HStack {
              if let f = context.state.followingName, let t = context.state.followingTime {
                Text("ثم \(f) \(timeText(t))").font(.system(size: 10)).foregroundStyle(WDS.textOnDarkMuted)
              }
              Spacer()
              Text(context.attributes.placeName).font(.system(size: 10)).foregroundStyle(WDS.textOnDarkMuted).lineLimit(1)
            }
          }
          .environment(\.layoutDirection, .rightToLeft)
        }
      } compactLeading: {
        Text(timerInterval: Date()...context.state.time, countsDown: true)
          .font(.system(size: 12, weight: .medium)).monospacedDigit()
          .foregroundStyle(WDS.textOnDark).frame(width: 48)
      } compactTrailing: {
        Image(systemName: "moon.stars.fill").foregroundStyle(WDS.accentGoldSoft)
      } minimal: {
        Image(systemName: "moon.stars.fill").foregroundStyle(WDS.accentGoldSoft)
      }
      .keylineTint(WDS.accentGold)
    }
  }

  /// بطاقة شاشة القفل: العدّ التنازلي كبيرًا يمينه اسم الصلاة، شريط ذهبي، ثم سطر «ثم …» ونسبة مضيّ الوقت
  private func lockScreen(_ context: ActivityViewContext<PrayerActivityAttributes>) -> some View {
    VStack(spacing: 8) {
      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 2) {
          Text(timerInterval: Date()...context.state.time, countsDown: true)
            .font(.system(size: 30, weight: .semibold)).monospacedDigit()
            .foregroundStyle(WDS.textOnDark)
            .frame(width: 130, alignment: .leading)
          Text("الأذان \(timeText(context.state.time))")
            .font(.system(size: 11, weight: .medium)).foregroundStyle(WDS.accentGoldSoft)
        }
        Spacer()
        VStack(alignment: .trailing, spacing: 2) {
          Text("الصلاة القادمة · \(context.attributes.placeName)")
            .font(.system(size: 11)).foregroundStyle(WDS.textOnDarkMuted).lineLimit(1).minimumScaleFactor(0.7)
          Text(context.state.prayerName)
            .font(.system(size: 26, weight: .bold)).foregroundStyle(WDS.textOnDark)
        }
      }
      WidgetProgressBar(progress: progress(context))
      HStack {
        if let f = context.state.followingName, let t = context.state.followingTime {
          Text("ثم \(f) \(timeText(t))").font(.system(size: 11)).foregroundStyle(WDS.textOnDarkMuted)
        }
        Spacer()
        Text("مضى \(Int(progress(context) * 100))٪ من الوقت الحالي")
          .font(.system(size: 11)).foregroundStyle(WDS.textOnDarkMuted)
      }
    }
    .padding(14)
    .background { ZStack { WDS.night; WidgetDecor() } }
  }

  private func progress(_ context: ActivityViewContext<PrayerActivityAttributes>) -> Double {
    guard let start = context.state.startTime, context.state.time > start else { return 0 }
    return min(1, max(0, Date().timeIntervalSince(start) / context.state.time.timeIntervalSince(start)))
  }
  private func timeText(_ d: Date) -> String {
    let f = DateFormatter(); f.locale = Locale(identifier: "ar_SA@numbers=latn"); f.dateFormat = "h:mm a"
    return f.string(from: d)
  }
}
