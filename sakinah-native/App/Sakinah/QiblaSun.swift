import SwiftUI
import SakinahCore

/// حساب «الشمس» ليومٍ وموقع (يجري خارج الخيط الرئيس): لحظة الشمس في اتجاه القبلة ولحظة إشارة الظلّ إليها
/// (Qibla.sunQiblaMoments)، ومسار الشمس اليوم للرسم (Astro.sunPosition)، وتعامد الشمس على الكعبة (Qibla.kaabaZenithEvents)
struct SunQiblaDay: Sendable {
  struct Point: Sendable { let azimuth: Double; let altitude: Double }
  let bearing: Double
  let sun: Date?
  let shadow: Date?
  /// موضع الشمس لحظةَ تكون في اتجاه القبلة (للرسم)
  let sunPoint: Point?
  /// مسار الشمس اليوم كل عشر دقائق (ما فوق الأفق وحده يُرسم)
  let path: [Point]
  /// حادثتا التعامد لهذه السنة والتي تليها (مرتّبة زمنيًّا)
  let zenith: [Qibla.ZenithEvent]

  static func compute(_ c: Coordinates, day: CivilDate, tz: TimeZone) -> SunQiblaDay {
    let m = Qibla.sunQiblaMoments(latitude: c.latitude, longitude: c.longitude, civil: day, tz: tz)
    let start = day.localMidnight(in: tz)
    var path: [Point] = []
    for i in 0...144 {
      let p = Astro.sunPosition(at: start.addingTimeInterval(Double(i) * 600), latitude: c.latitude, longitude: c.longitude)
      path.append(Point(azimuth: p.azimuth, altitude: p.altitude))
    }
    let sunPoint: Point? = m.sunAtQibla.map { t in
      let p = Astro.sunPosition(at: t, latitude: c.latitude, longitude: c.longitude)
      return Point(azimuth: p.azimuth, altitude: p.altitude)
    }
    let zenith = Qibla.kaabaZenithEvents(year: day.year) + Qibla.kaabaZenithEvents(year: day.year + 1)
    return SunQiblaDay(bearing: m.bearing, sun: m.sunAtQibla, shadow: m.shadowAtQibla, sunPoint: sunPoint, path: path, zenith: zenith.sorted { $0.time < $1.time })
  }
}

/// أقرب يومٍ قادم تبلغ فيه الشمس اتجاه القبلة (أو يشير الظلّ إليها) حين لا يحدث ذلك اليوم — خلال سنة
struct SunQiblaNext: Sendable {
  let sun: Date?
  let shadow: Date?

  static func compute(_ c: Coordinates, after day: CivilDate, tz: TimeZone, needSun: Bool, needShadow: Bool) -> SunQiblaNext {
    let sun: Date? = needSun ? next(c, after: day, tz: tz, pick: { $0.sunAtQibla }) : nil
    let shadow: Date? = needShadow ? next(c, after: day, tz: tz, pick: { $0.shadowAtQibla }) : nil
    return SunQiblaNext(sun: sun, shadow: shadow)
  }
  /// مسحٌ بخطوة أربعة أيام ثم رجوعٌ يومًا يومًا إلى أوّل يومٍ تحقّق فيه — بدل حساب كل أيام السنة
  private static func next(_ c: Coordinates, after day: CivilDate, tz: TimeZone, pick: (Qibla.SunMoments) -> Date?) -> Date? {
    var lastMiss = 0
    var d = 4
    while d <= 368 {
      if let hit = pick(moments(c, day.adding(days: d), tz)) {
        if d - lastMiss > 1 {
          for k in (lastMiss + 1)..<d {
            if let t = pick(moments(c, day.adding(days: k), tz)) { return t }
          }
        }
        return hit
      }
      lastMiss = d
      d += 4
    }
    return nil
  }
  private static func moments(_ c: Coordinates, _ day: CivilDate, _ tz: TimeZone) -> Qibla.SunMoments {
    Qibla.sunQiblaMoments(latitude: c.latitude, longitude: c.longitude, civil: day, tz: tz)
  }
}

/// ذاكرةٌ لنتائج اليوم (تبديل التبويبات يعيد إنشاء اللوحة؛ لا داعي لإعادة الحساب) — تُقرأ وتُكتب من الواجهة وحدها
enum SunQiblaCache {
  static var day: [String: SunQiblaDay] = [:]
  static var next: [String: SunQiblaNext] = [:]
}

/// «الشمس» في شاشة القبلة (qibla-sun.png): لحظة اليوم التي تكون فيها الشمس في اتجاه القبلة مع رسمٍ للأفق ومسار الشمس،
/// ولحظة إشارة ظلّ العمود إلى القبلة، وتعامد الشمس على الكعبة مرّتين في السنة مع تذكيرٍ محلّي — كلّه على الجهاز
struct QiblaSunPanel: View {
  @Environment(AppModel.self) private var model
  let coords: Coordinates
  @State private var today: SunQiblaDay?
  @State private var next: SunQiblaNext?
  @State private var reminderNote: String?

  private static let makkah = TimeZone(identifier: "Asia/Riyadh") ?? TimeZone(secondsFromGMT: 3 * 3600)!
  private var numerals: String { model.settings.numerals }

  var body: some View {
    TimelineView(.periodic(from: .now, by: 30)) { ctx in
      // المفتاح يتبع اليوم المدني: بعد منتصف الليل يُعاد الحساب لليوم الجديد
      let civil = CivilDate(ctx.date, in: model.timeZone)
      let key = "\(coords.latitude),\(coords.longitude)|\(model.timeZone.identifier)|\(civil.year)-\(civil.month)-\(civil.day)"
      VStack(spacing: DS.Space.s4) {
        sunHero(now: ctx.date)
        shadowCard(now: ctx.date)
        zenithCard(now: ctx.date)
      }
      .task(id: key) { await load(key: key, civil: civil) }
    }
  }

  @MainActor private func load(key: String, civil: CivilDate) async {
    let c = coords; let tz = model.timeZone
    if let d = SunQiblaCache.day[key] { today = d } else {
      let d = await Task.detached(priority: .userInitiated) { SunQiblaDay.compute(c, day: civil, tz: tz) }.value
      SunQiblaCache.day[key] = d
      today = d
    }
    guard let d = today, d.sun == nil || d.shadow == nil else { next = nil; return }
    if let n = SunQiblaCache.next[key] { next = n; return }
    next = nil
    let needSun = d.sun == nil, needShadow = d.shadow == nil
    let n = await Task.detached(priority: .utility) { SunQiblaNext.compute(c, after: civil, tz: tz, needSun: needSun, needShadow: needShadow) }.value
    SunQiblaCache.next[key] = n
    next = n
  }

  // MARK: نصوص الوقت
  private func time(_ d: Date, tz: TimeZone? = nil) -> String {
    Fmt.time(d, tz: tz ?? model.timeZone, hour12: model.settings.hour12, numerals: numerals)
  }
  private func date(_ d: Date, tz: TimeZone? = nil) -> String { Fmt.shortDate(d, tz: tz ?? model.timeZone, numerals: numerals) }
  /// «بعد ساعتين و١٠ دقائق» / «مضت قبل ساعة»
  private func relative(_ t: Date, now: Date) -> String {
    let s = t.timeIntervalSince(now)
    if abs(s) < 60 { return "الآن" }
    let mins = Int((abs(s) / 60).rounded())
    let h = mins / 60, m = mins % 60
    let hp = ArabicCount.phrase(h, one: "ساعة", two: "ساعتين", few: "ساعات", many: "ساعة", numerals: numerals)
    let mp = ArabicCount.phrase(m, one: "دقيقة", two: "دقيقتين", few: "دقائق", many: "دقيقة", numerals: numerals)
    let span = h == 0 ? mp : (m == 0 ? hp : "\(hp) و\(mp)")
    return s > 0 ? "بعد \(span)" : "مضت قبل \(span)"
  }

  // MARK: البطل الذهبيّ: الشمس في اتجاه القبلة
  @ViewBuilder private func sunHero(now: Date) -> some View {
    VStack(alignment: .leading, spacing: 10) {
      if let d = today {
        if let t = d.sun {
          Text("اليوم تكون الشمس في اتجاه القبلة تمامًا").font(DS.F.labelMd).foregroundStyle(DS.C.accentGoldStrong)
          timeRow(t, now: now)
        } else {
          Text("لا تبلغ الشمس اتجاه القبلة اليوم في موقعك").font(DS.F.labelMd).foregroundStyle(DS.C.accentGoldStrong)
          Text(noSunLine).font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary).fixedSize(horizontal: false, vertical: true)
        }
        SunQiblaDiagram(path: d.path, moment: d.sunPoint, bearing: d.bearing)
          .frame(height: 170)
        Text(d.sun != nil
             ? "قف ووجهك إلى الشمس في هذه اللحظة: أنت متّجه إلى القبلة. لا بوصلة ولا معايرة."
             : "في يومٍ تبلغ فيه الشمس اتجاه القبلة: قف ووجهك إليها في تلك اللحظة، فأنت متّجه إلى القبلة.")
          .font(DS.F.bodySm).foregroundStyle(DS.C.textPrimary).fixedSize(horizontal: false, vertical: true)
      } else {
        HStack(spacing: 8) {
          ProgressView()
          Text("يُحسب مسار الشمس اليوم…").font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary)
        }
        .frame(maxWidth: .infinity, minHeight: 120)
      }
    }
    .padding(18)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(DS.C.accentGoldSoft, in: RoundedRectangle(cornerRadius: DS.Radius.xl, style: .continuous))
  }

  /// الوقت كبيرًا يمينًا، والمدّة إليه يسارًا
  private func timeRow(_ t: Date, now: Date) -> some View {
    let parts = Fmt.timeParts(t, tz: model.timeZone, hour12: model.settings.hour12, numerals: numerals)
    let passed = t < now
    return HStack(alignment: .firstTextBaseline, spacing: 8) {
      HStack(alignment: .firstTextBaseline, spacing: 6) {
        Text(parts.main).font(DS.F.numericXl).foregroundStyle(DS.C.textPrimary).monospacedDigit()
        if let suffix = parts.suffix { Text(suffix).font(DS.F.headingMd).foregroundStyle(DS.C.textPrimary) }
      }
      Spacer(minLength: 8)
      Text(passed ? "\(relative(t, now: now))، وغدًا في نحو الوقت نفسه" : relative(t, now: now))
        .font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary).multilineTextAlignment(.trailing).lineLimit(2).minimumScaleFactor(0.8)
    }
    .accessibilityElement(children: .combine)
  }

  private var noSunLine: String {
    if let t = next?.sun { return "أقرب يومٍ تبلغه: \(date(t)) في \(time(t))." }
    if next == nil { return "نبحث عن أقرب يومٍ تبلغه…" }
    return "في موقعك لا تمرّ الشمس باتجاه القبلة وهي فوق الأفق خلال السنة القادمة؛ استعمل البوصلة أو موعد تعامد الشمس على الكعبة."
  }

  // MARK: ظلّ العمود
  private func shadowCard(now: Date) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      Text("متى يشير ظلّ العمود إلى القبلة؟").font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary)
      Text(shadowText(now: now)).font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary).fixedSize(horizontal: false, vertical: true)
    }
    .todayCard(padding: 16)
  }
  private func shadowText(now: Date) -> String {
    guard let d = today else { return "يُحسب…" }
    if let t = d.shadow {
      return "اليوم في \(time(t)) (\(relative(t, now: now))): تكون الشمس في الجهة المقابلة للقبلة، فيشير ظلّ أيّ عمودٍ قائم إلى القبلة."
    }
    if let t = next?.shadow { return "لا يحدث اليوم في موقعك: الشمس لا تبلغ الجهة المقابلة للقبلة وهي فوق الأفق. أقرب يومٍ يحدث فيه: \(date(t)) في \(time(t))." }
    if next == nil { return "لا يحدث اليوم في موقعك: الشمس لا تبلغ الجهة المقابلة للقبلة وهي فوق الأفق. نبحث عن أقرب يوم…" }
    return "لا يحدث في موقعك خلال السنة القادمة: الشمس لا تبلغ الجهة المقابلة للقبلة وهي فوق الأفق."
  }

  // MARK: تعامد الشمس على الكعبة
  private func zenithCard(now: Date) -> some View {
    let all = today?.zenith ?? []
    let upcoming = all.filter { $0.time > now }
    // الحادثتان في سنة الحادثة القادمة (فإن مضتا هذا العام فحادثتا العام القادم)
    let year = upcoming.first.map { CivilDate($0.time, in: Self.makkah).year }
    let pair = all.filter { e in year.map { CivilDate(e.time, in: Self.makkah).year == $0 } ?? false }
    let nextEvent = upcoming.first
    return VStack(alignment: .leading, spacing: 12) {
      Text("تعامد الشمس على الكعبة").font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary)
      Text("مرّتين في السنة تكون الشمس فوق الكعبة تمامًا، فاتجاه الشمس من كل مكانٍ يراها هو القبلة.")
        .font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary).fixedSize(horizontal: false, vertical: true)
      HStack(alignment: .top, spacing: 10) {
        ForEach(Array(pair.enumerated()), id: \.offset) { _, e in
          zenithBox(e, isNext: nextEvent.map { abs($0.time.timeIntervalSince(e.time)) < 1 } ?? false)
        }
      }
      if let e = nextEvent { reminderControl(e) }
    }
    .todayCard(padding: 16)
  }

  private func zenithBox(_ e: Qibla.ZenithEvent, isNext: Bool) -> some View {
    let tz = model.timeZone
    let sameOffset = tz.secondsFromGMT(for: e.time) == Self.makkah.secondsFromGMT(for: e.time)
    let sameDay = CivilDate(e.time, in: tz) == CivilDate(e.time, in: Self.makkah)
    let local = sameDay ? "\(time(e.time)) بتوقيتك" : "\(date(e.time)) \(time(e.time)) بتوقيتك"
    return VStack(alignment: .leading, spacing: 4) {
      Text(date(e.time, tz: Self.makkah)).font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary)
      Text("\(time(e.time, tz: Self.makkah)) بتوقيت مكة").font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary)
      if !sameOffset { Text(local).font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary) }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(12)
    .background(DS.C.bgSubtle, in: RoundedRectangle(cornerRadius: DS.Radius.lg, style: .continuous))
    .overlay { if isNext { RoundedRectangle(cornerRadius: DS.Radius.lg, style: .continuous).stroke(DS.C.accentGold, lineWidth: 1.5) } }
    .accessibilityElement(children: .combine)
    .accessibilityHint(isNext ? "الموعد القادم" : "")
  }

  /// «ذكّرني بالموعد القادم»: إشعارٌ محلّي قبل الحادثة بعشر دقائق (معرّفٌ ثابت — الضغطة الثانية لا تكرّره)
  @ViewBuilder private func reminderControl(_ e: Qibla.ZenithEvent) -> some View {
    let isSet = model.notifications.zenithReminderAt.map { abs($0.timeIntervalSince(e.time)) < 60 } ?? false
    if isSet {
      VStack(spacing: 4) {
        HStack(spacing: 6) {
          Image(systemName: "checkmark.circle.fill").font(.system(size: 14, weight: .semibold))
          Text("سيصلك تذكيرٌ قبل الموعد بعشر دقائق").font(DS.F.labelMd)
        }
        .foregroundStyle(DS.C.brandPrimary)
        .frame(maxWidth: .infinity).padding(.vertical, 12)
        .background(DS.C.brandSoft, in: RoundedRectangle(cornerRadius: DS.Radius.lg, style: .continuous))
        Button { model.notifications.cancelZenithReminder() } label: {
          Text("إلغاء التذكير").font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary).frame(minHeight: 36).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
      }
    } else {
      DSButton(title: "ذكّرني بالموعد القادم", kind: .soft, icon: "bell") {
        Task { @MainActor in
          let ok = await model.notifications.scheduleZenithReminder(at: e.time)
          reminderNote = ok ? nil : "الإشعارات مطفأة لسكينة؛ فعّلها من إعدادات النظام ليصلك التذكير."
        }
      }
    }
    if let note = reminderNote {
      Text(note).font(DS.F.labelXs).foregroundStyle(DS.C.warning).fixedSize(horizontal: false, vertical: true)
    }
  }
}

/// رسم الأفق ومسار الشمس (qibla-sun.png): يُرسم نصفُ الأفق الذي تولّيه وجهك نحو القبلة. مولّيًا الجنوبَ يكون الشرق يسارك
/// والغرب يمينك، ومولّيًا الشمالَ ينعكسان — والرسم بإحداثياتٍ مطلقة (LTR) كي لا يقلبه اتجاه الواجهة
struct SunQiblaDiagram: View {
  let path: [SunQiblaDay.Point]
  let moment: SunQiblaDay.Point?
  let bearing: Double

  var body: some View {
    let facingSouth = bearing > 90 && bearing < 270
    let center: Double = facingSouth ? 180 : 0
    GeometryReader { g in
      let w = g.size.width
      let horizon = g.size.height - 24
      let half = w * 0.46
      let top: CGFloat = 14
      let x: (Double) -> CGFloat = { az in w / 2 + CGFloat(Qibla.signedDifference(target: az, reference: center) / 90) * half }
      let y: (Double) -> CGFloat = { alt in horizon - CGFloat(max(0, alt) / 90) * (horizon - top) }
      ZStack {
        Path { p in
          p.move(to: CGPoint(x: 0, y: horizon))
          p.addLine(to: CGPoint(x: w, y: horizon))
        }
        .stroke(DS.C.accentGold, lineWidth: 1.2)
        Path { p in
          var open = false
          for pt in path {
            guard pt.altitude > 0, abs(Qibla.signedDifference(target: pt.azimuth, reference: center)) <= 90 else { open = false; continue }
            let q = CGPoint(x: x(pt.azimuth), y: y(pt.altitude))
            if open { p.addLine(to: q) } else { p.move(to: q); open = true }
          }
        }
        .stroke(DS.C.accentGoldStrong.opacity(0.75), style: StrokeStyle(lineWidth: 1.5, lineCap: .round, dash: [4, 5]))
        if let m = moment {
          Path { p in
            p.move(to: CGPoint(x: w / 2, y: horizon))
            p.addLine(to: CGPoint(x: x(m.azimuth), y: y(m.altitude)))
          }
          .stroke(DS.C.brandPrimary, style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
          Circle().fill(DS.C.accentGold.opacity(0.35)).frame(width: 36, height: 36).position(x: x(m.azimuth), y: y(m.altitude))
          Circle().fill(DS.C.accentGold).frame(width: 20, height: 20).position(x: x(m.azimuth), y: y(m.altitude))
        }
        Circle().fill(DS.C.brandPrimary).frame(width: 10, height: 10).position(x: w / 2, y: horizon)
        Text(facingSouth ? "الشرق" : "الغرب").font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).position(x: 24, y: horizon + 14)
        Text(facingSouth ? "الجنوب" : "الشمال").font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).position(x: w / 2, y: horizon + 14)
        Text(facingSouth ? "الغرب" : "الشرق").font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).position(x: w - 24, y: horizon + 14)
      }
    }
    .environment(\.layoutDirection, .leftToRight)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(facingLabel)
  }
  private var facingLabel: String {
    let south = bearing > 90 && bearing < 270
    return south ? "رسمٌ لمسار الشمس: وأنت متّجه جنوبًا يكون الشرق عن يسارك والغرب عن يمينك" : "رسمٌ لمسار الشمس: وأنت متّجه شمالًا يكون الشرق عن يمينك والغرب عن يسارك"
  }
}
