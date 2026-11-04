import SwiftUI
import WidgetKit
import ActivityKit
import AppIntents
import SakinahCore

/// النشاط المباشر «اليوم الحيّ» (lock.png · live-activity.png · island.png): سماء الوقت، عدٌّ تنازلي يتقدّم وحده
/// (Text/ProgressView بفاصل زمني)، شريط اليوم بصلواته، وزرّان: أذكار الوقت (رابط عميق) و«صلّيتُ» (نيّة تفاعلية).
/// لا شبكة ولا تحديث من خادم: الحالة يكتبها التطبيق عند فتحه، وتصير «قديمة» عند الأذان (staleDate).
struct PrayerLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: PrayerActivityAttributes.self) { context in
      PrayerActivityBanner(context: context)
        .activityBackgroundTint(SkyPalette.of(context.state.skyPhase).stops[3].wColor)
        .activitySystemActionForegroundColor(WidgetInk(context.state.skyPhase).text)
        .widgetURL(SakinahURL.today)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          IslandCountdown(state: context.state, stale: context.isStale)
            .dynamicIsland(verticalPlacement: .belowIfTooWide)
        }
        DynamicIslandExpandedRegion(.trailing) {
          WidgetSkyBackground(phase: context.state.skyPhase, discAt: UnitPoint(x: 0.38, y: 0.4), discDiameter: 16)
            .frame(width: 58, height: 58)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .padding(.trailing, 4)
        }
        DynamicIslandExpandedRegion(.bottom) {
          ActivityButtons(state: context.state, style: .island)
            .padding(.top, 6)
            .environment(\.layoutDirection, .rightToLeft)
        }
      } compactLeading: {
        SkyDot(phase: context.state.skyPhase, size: 20)
      } compactTrailing: {
        Text(timerInterval: context.state.countdownRange, countsDown: true)
          .font(.system(size: 13, weight: .semibold)).monospacedDigit()
          .foregroundStyle(WDS.accentGoldSoft)
          .multilineTextAlignment(.center)
          .frame(width: 52)
          .environment(\.locale, WFmt.locale(context.state.numeralsValue))
      } minimal: {
        SkyDot(phase: context.state.skyPhase, size: 20)
      }
      .widgetURL(SakinahURL.today)
      .keylineTint(WDS.accentGold)
    }
  }
}

// MARK: - مشتقّات الحالة

private extension PrayerActivityAttributes.ContentState {
  var skyPhase: SkyPhase { SkyPhase(rawValue: sky ?? "") ?? .shafaq }
  var numeralsValue: String { numerals ?? "latn" }
  var timeZone: TimeZone { tz.flatMap { TimeZone(identifier: $0) } ?? .current }
  /// العدّ إلى الأذان (الحدّ الأدنى لحظة الرسم؛ ولا يُبنى مدى مقلوب بعد الأذان — ClosedRange المقلوب يُسقط الامتداد)
  var countdownRange: ClosedRange<Date> {
    let now = Date()
    return now < time ? now...time : time...time
  }
  /// مقطع الوقت الحالي في شريط اليوم
  var segmentRange: ClosedRange<Date>? {
    guard let a = segmentStart, let b = segmentEnd, a < b else { return nil }
    return a...b
  }
}

// MARK: - شاشة القفل

struct PrayerActivityBanner: View {
  let context: ActivityViewContext<PrayerActivityAttributes>

  var body: some View {
    let s = context.state
    let phase = s.skyPhase
    let ink = WidgetInk(phase)
    VStack(alignment: .leading, spacing: 5) {
      HStack(spacing: 6) {
        SkyDot(phase: phase, size: 12)
        Text("وقت \(s.currentName ?? "")").font(.system(size: 12, weight: .semibold)).foregroundStyle(ink.soft).lineLimit(1)
        Spacer(minLength: 6)
        Text(placeLine(s)).font(.system(size: 12, weight: .medium)).foregroundStyle(ink.soft).lineLimit(1)
      }
      if context.isStale {
        VStack(alignment: .leading, spacing: 2) {
          Text("حان وقت \(s.prayerName)").font(.system(size: 24, weight: .semibold)).foregroundStyle(ink.text).lineLimit(1)
          Text("افتح سكينة لمتابعة اليوم").font(.system(size: 12)).foregroundStyle(ink.muted).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      } else {
        VStack(alignment: .leading, spacing: 0) {
          Text("\(s.prayerName) بعد").font(.system(size: 14, weight: .semibold)).foregroundStyle(ink.text).lineLimit(1)
          HStack(alignment: .lastTextBaseline, spacing: 8) {
            Text(timerInterval: s.countdownRange, countsDown: true)
              .font(.system(size: 34, weight: .light)).monospacedDigit().foregroundStyle(ink.text)
              .multilineTextAlignment(.leading)
              .frame(maxWidth: 190, alignment: .leading)
            Spacer(minLength: 4)
            Text(WFmt.time(s.time, tz: s.timeZone, numerals: s.numeralsValue, hour12: s.hour12 ?? true, suffix: true))
              .font(.system(size: 12, weight: .medium)).foregroundStyle(ink.soft).lineLimit(1)
          }
        }
      }
      DayLine(state: s, ink: ink)
      ActivityButtons(state: s, style: .banner)
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 11)
    .background { WidgetSkyBackground(phase: phase, discAt: UnitPoint(x: 0.44, y: 0.3), discDiameter: 30) }
    .environment(\.layoutDirection, .rightToLeft)
    .environment(\.locale, WFmt.locale(s.numeralsValue))
  }

  /// «الخليل ١٨°» — الحرارة إن مرّرها التطبيق من ذاكرته (لا شبكة هنا)
  private func placeLine(_ s: PrayerActivityAttributes.ContentState) -> String {
    let place = context.attributes.placeName
    guard let t = s.temperature else { return place }
    return "\(place) \(WFmt.temperature(t, s.numeralsValue))"
  }
}

/// شريط اليوم: نقطة لكل صلاة من الفجر إلى العشاء ثم الليل، ما مضى ممتلئ، والمقطع الحالي يتقدّم وحده بلون ذهبي
/// (مؤشّر «الآن» الحرّ في التصميم لا يتحرّك بلا تحديث، فالتقدّم الحيّ هو نهاية الذهبي)
struct DayLine: View {
  let state: PrayerActivityAttributes.ContentState
  let ink: WidgetInk

  var body: some View {
    let seg = state.segment ?? -1
    HStack(spacing: 3) {
      ForEach(0..<5, id: \.self) { i in
        Circle().fill(i <= seg ? ink.text.opacity(0.85) : ink.track).frame(width: 6, height: 6)
        segmentView(i, seg)
      }
    }
    .frame(height: 8)
    .environment(\.layoutDirection, .rightToLeft)
    .accessibilityHidden(true)
  }

  @ViewBuilder private func segmentView(_ i: Int, _ seg: Int) -> some View {
    if i < seg {
      Capsule().fill(ink.text.opacity(0.85)).frame(height: 3)
    } else if i == seg, let r = state.segmentRange {
      ProgressView(timerInterval: r, countsDown: false) {
        EmptyView()
      } currentValueLabel: {
        EmptyView()
      }
      .progressViewStyle(.linear)
      .tint(ink.gold)
      .frame(maxWidth: .infinity)
    } else {
      Capsule().fill(ink.track).frame(height: 3)
    }
  }
}

/// زرّا النشاط: «أذكار <الوقت>» رابطٌ عميق إلى جلستها، و«صلّيتُ <الصلاة>» نيّةٌ تُنفَّذ في التطبيق
struct ActivityButtons: View {
  enum Style { case banner, island }
  let state: PrayerActivityAttributes.ContentState
  let style: Style

  var body: some View {
    HStack(spacing: 8) {
      if let p = state.adhkarPeriod {
        Link(destination: SakinahURL.adhkar(p)) {
          pill(icon: "sparkles", title: state.adhkarTitle ?? AdhkarNowRule.title(p), primary: true, done: false)
        }
      }
      prayedButton
    }
  }

  @ViewBuilder private var prayedButton: some View {
    if let p = state.prayedPrayer, let d = state.day, let name = state.prayedName {
      if state.prayed == true {
        pill(icon: "checkmark", title: "صلّيتَ \(name)", primary: false, done: true)
          .accessibilityLabel("سُجّلت صلاة \(name)")
      } else {
        Button(intent: MarkPrayedIntent(prayer: p, day: d)) {
          pill(icon: "checkmark", title: "صلّيتُ \(name)", primary: false, done: false)
        }
        .buttonStyle(.plain)
      }
    }
  }

  private func pill(icon: String, title: String, primary: Bool, done: Bool) -> some View {
    let c = colors(primary: primary, done: done)
    return HStack(spacing: 5) {
      Image(systemName: icon).font(.system(size: 11, weight: .bold))
      Text(title).font(.system(size: 13, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.75)
    }
    .foregroundStyle(c.fg)
    .frame(maxWidth: .infinity, minHeight: 32)
    .background(Capsule().fill(c.bg))
  }

  private func colors(primary: Bool, done: Bool) -> (bg: Color, fg: Color) {
    switch style {
    case .banner:
      if primary { return (WDS.hex(0x22302B).opacity(0.92), WDS.hex(0xFBF9F4)) }
      if done { return (Color.white.opacity(0.55), WDS.hex(0x0E5C55)) }
      return (Color.white.opacity(0.85), WDS.hex(0x16211F))
    case .island:
      if primary { return (WDS.hex(0xC69C3E), WDS.hex(0x16211F)) }
      if done { return (Color.white.opacity(0.20), WDS.hex(0x7BE0CF)) }
      return (Color.white.opacity(0.14), WDS.hex(0xFBF9F4))
    }
  }
}

// MARK: - الجزيرة الديناميكية

/// «المغرب بعد» والعدّ كبيرًا
struct IslandCountdown: View {
  let state: PrayerActivityAttributes.ContentState
  let stale: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      if stale {
        Text("حان وقت \(state.prayerName)").font(.system(size: 18, weight: .semibold)).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.7)
      } else {
        Text("\(state.prayerName) بعد").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color.white.opacity(0.75)).lineLimit(1)
        Text(timerInterval: state.countdownRange, countsDown: true)
          .font(.system(size: 34, weight: .light)).monospacedDigit().foregroundStyle(.white)
          .multilineTextAlignment(.leading)
          .frame(maxWidth: 150, alignment: .leading)
      }
    }
    .padding(.leading, 6)
    .environment(\.locale, WFmt.locale(state.numeralsValue))
  }
}

/// قرص سماء صغير (الجزيرة المضغوطة والمصغّرة، وعنوان شاشة القفل)
struct SkyDot: View {
  let phase: SkyPhase
  let size: CGFloat

  var body: some View {
    WidgetSkyBackground(phase: phase, discAt: UnitPoint(x: 0.42, y: 0.42), discDiameter: size * 0.42, decorations: false)
      .frame(width: size, height: size)
      .clipShape(Circle())
      .overlay(Circle().stroke(Color.white.opacity(0.25), lineWidth: 0.5))
  }
}
