import Foundation
import SakinahCore
import ActivityKit
import WidgetKit

/// إدارة النشاط المباشر «اليوم الحيّ»: يبدأ/يُحدَّث عند فتح التطبيق (لا تحديث في الخلفية ولا دفع من خادم)،
/// ويغطّي الوقت الحالي حتى الأذان القادم؛ بعد الأذان يصير «قديمًا» (staleDate) حتى يُفتح التطبيق
@MainActor
enum LiveActivityManager {
  static func sync(_ model: AppModel) {
    WidgetCenter.shared.reloadAllTimelines()
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
    let existing = Activity<PrayerActivityAttributes>.activities
    let now = Date()
    guard model.settings.liveActivity, let tl = model.timeline(now: now) else {
      for a in existing { Task { await a.end(nil, dismissalPolicy: .immediate) } }
      return
    }
    let content = ActivityContent(state: makeState(model, tl: tl, now: now), staleDate: tl.next.time)
    let place = model.location.placeName ?? "موقعك"
    // اسم المكان من سمات النشاط (لا تتغيّر طوال عمره): إن تبدّلت المدينة يُعاد إنشاؤه
    if let a = existing.first, a.attributes.placeName == place {
      Task { await a.update(content) }
      for extra in existing.dropFirst() { Task { await extra.end(nil, dismissalPolicy: .immediate) } }
    } else {
      for a in existing { Task { await a.end(nil, dismissalPolicy: .immediate) } }
      if tl.next.time.timeIntervalSince(now) < 6 * 3600 {
        _ = try? Activity.request(attributes: PrayerActivityAttributes(placeName: place), content: content, pushType: nil)
      }
    }
  }

  /// حالة النشاط للحظة: القادمة والعدّ، الوقت الحالي وزرّ «صلّيتُ» ويومه، أذكار الوقت، السماء، شريط اليوم، والحرارة المخزّنة
  static func makeState(_ model: AppModel, tl: PrayerTimes.DayTimeline, now: Date) -> PrayerActivityAttributes.ContentState {
    let tz = model.timeZone
    let next = tl.next
    let t = tl.times
    var following: (String, Date)? = nil
    if let i = Prayer.allCases.firstIndex(of: next.key) {
      for k in Prayer.allCases[(i + 1)...] where k != .sunrise {
        if let ft = t[k], ft > next.time { following = (k.nameAr, ft); break }
      }
    }
    // موعد صلاةٍ اليوم إن كان قد مضى (قبل الفجر يكون الوقت الحالي عشاءَ الأمس)
    func past(_ k: Prayer) -> Date? {
      if let d = t[k], d <= now { return d }
      return nil
    }
    let currentStart = past(tl.current) ?? tl.yesterdayIsha
    // بين الشروق والظهر لا فريضة حاضرة: «صلّيتُ» يسجّل الفجر
    let recorded: Prayer = tl.current == .sunrise ? .fajr : tl.current
    let recordedStart = past(recorded) ?? tl.yesterdayIsha
    let day = DayKey.key(recordedStart ?? now, tz: tz)
    let prayed = UserDefaults.standard.bool(forKey: PrayedLog.key(day: day, prayer: recorded.rawValue))

    let segment: Int
    switch tl.current {
    case .fajr, .sunrise: segment = 0
    case .dhuhr: segment = 1
    case .asr: segment = 2
    case .maghrib: segment = 3
    case .isha: segment = 4
    }
    let segStart: Date?
    let segEnd: Date?
    switch segment {
    case 0: segStart = t.fajr; segEnd = t.dhuhr
    case 1: segStart = t.dhuhr; segEnd = t.asr
    case 2: segStart = t.asr; segEnd = t.maghrib
    case 3: segStart = t.maghrib; segEnd = t.isha
    default: segStart = past(.isha) ?? tl.yesterdayIsha; segEnd = next.key == .fajr ? next.time : nil
    }

    let adhkar = AdhkarNowRule.period(now: now, fajr: t.fajr, dhuhr: t.dhuhr, asr: t.asr, isha: t.isha)
    let sky = SkyEngine.state(at: now, inputs: SkyInputs(tl, tz: tz), prefs: model.settings.sky, weather: nil).dominant

    return PrayerActivityAttributes.ContentState(
      prayer: next.key.rawValue, prayerName: next.key.nameAr, time: next.time,
      followingName: following?.0, followingTime: following?.1, startTime: currentStart,
      currentName: tl.current == .sunrise ? "الضحى" : tl.current.nameAr,
      prayedPrayer: recorded.rawValue, prayedName: recorded.nameAr, day: day, prayed: prayed,
      adhkarPeriod: adhkar?.period, adhkarTitle: adhkar.map { AdhkarNowRule.title($0.period) },
      sky: sky.rawValue, segment: segment, segmentStart: segStart, segmentEnd: segEnd,
      temperature: cachedTemperature(model), numerals: model.settings.numerals, hour12: model.settings.hour12, tz: tz.identifier)
  }

  /// الحرارة من ذاكرة طقس الرئيسية وحدها (لا طلب شبكة هنا): إن فعّل المستخدم الطقس، وللخلية نفسها، ولم تتجاوز ثلاث ساعات
  private static func cachedTemperature(_ model: AppModel) -> Int? {
    guard model.settings.sky.weather, let c = model.coordinates,
          let data = UserDefaults.standard.data(forKey: "sky.weather.cache") else { return nil }
    struct Cache: Decodable { let key: String; let at: Date; let temp: Double? }
    guard let cache = try? JSONDecoder().decode(Cache.self, from: data), cache.key == SkyWeatherService.cellKey(c),
          Date().timeIntervalSince(cache.at) < 3 * 3600, let temp = cache.temp, temp.isFinite else { return nil }
    return Int(temp.rounded())
  }

  /// بعد «صلّيتُ» من النشاط: يعرض النشاطُ القائم «✓ صلّيتَ …» فورًا
  static func markPrayed(prayer: String, day: String) async {
    for a in Activity<PrayerActivityAttributes>.activities {
      var s = a.content.state
      guard s.prayedPrayer == prayer, s.day == day else { continue }
      s.prayed = true
      await a.update(ActivityContent(state: s, staleDate: a.content.staleDate))
    }
  }
}

/// تنفيذ «صلّيتُ» في عملية التطبيق (LiveActivityIntent): يسجّل `prayed.<يوم>.<صلاة>` في UserDefaults التطبيق
/// — بذرة سجلّ العبادات الخاص، على الجهاز وحده — ثم يحدّث النشاط. نسخة الامتداد في Widget/MarkPrayedIntent+Widget.swift
extension MarkPrayedIntent {
  static func record(prayer: String, day: String) async {
    guard !prayer.isEmpty, !day.isEmpty else { return }
    UserDefaults.standard.set(true, forKey: PrayedLog.key(day: day, prayer: prayer))
    await LiveActivityManager.markPrayed(prayer: prayer, day: day)
  }
}
