import SwiftUI
import CoreLocation
import MapKit
import UIKit
import SakinahCore

/// الرئيسية (تصميم Figma «٦ · الرئيسية — الحيويّة (v6)» و«٧ · نظام السماء والطقس»):
/// هيرو سماءٍ يتبدّل مع وقت الصلاة (والطقس إن فُعّل)، يجمع الصلاة القادمة والقبلة وخطّ اليوم؛
/// ثم بلاطات وصول سريع عائمة على حافته، وشبكة المواقيت، ومتابعة القراءة، وأقرب مسجد، وأذكار الوقت.
struct HomeView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.switchTab) private var switchTab
  @State private var showMethods = false
  @State private var showQibla = ScreenshotMode.fullQibla
  @State private var mosques = MosqueFinder()
  @State private var weather = SkyWeatherService()

  var body: some View {
    NavigationStack {
      GeometryReader { geo in
        TimelineView(.periodic(from: .now, by: 1)) { ctx in content(now: ctx.date, topInset: geo.safeAreaInsets.top) }
          .ignoresSafeArea(edges: .top)
      }
      .background(DS.C.bgCanvas)
      .tabBarClearance()
      .toolbar(.hidden, for: .navigationBar)
      // الورقة لا شريط تحتها: صفر إزاحة
      .sheet(isPresented: $showMethods) { MethodPicker().environment(\.tabBarInset, 0) }
      .fullScreenCover(isPresented: $showQibla) { QiblaView(presented: true).environment(model) }
    }
    .onAppear { model.location.startHeading() }
    .onDisappear { model.location.stopHeading() }
    // القبلة الكاملة توقف البوصلة عند إغلاقها؛ الميدالية تحتاجها من جديد
    .onChange(of: showQibla) { _, open in if !open { model.location.startHeading() } }
    .onReceive(NotificationCenter.default.publisher(for: UIDevice.orientationDidChangeNotification)) { _ in model.location.syncHeadingOrientation() }
  }

  // MARK: حالة السماء
  /// التفضيلات، أو ما يفرضه وضع اللقطات (طور/طقس بعينه) للتحقّق البصري من كل حالة
  private func skyState(now: Date, timeline t: PrayerTimes.DayTimeline?) -> SkyState {
    let inputs = t.map { SkyInputs($0, tz: model.timeZone) }
    if let forced = ScreenshotMode.skyPhase {
      let w = ScreenshotMode.skyWeather ?? .clear
      return SkyState(phase: forced, blendTo: nil, t: 0, weather: w, palette: SkyPalette.of(forced).weathered(w))
    }
    if let w = ScreenshotMode.skyWeather {
      var s = SkyEngine.state(at: now, inputs: inputs, prefs: SkyPrefs(mode: .auto, weather: true), weather: w)
      s.weather = w; return s
    }
    return SkyEngine.state(at: now, inputs: inputs, prefs: model.settings.sky, weather: weather.current)
  }

  @ViewBuilder
  private func content(now: Date, topInset: CGFloat) -> some View {
    let t = model.timeline(now: now)
    let c = model.coordinates
    let sky = skyState(now: now, timeline: t)
    ScrollViewReader { proxy in
      ScrollView(showsIndicators: false) {
        VStack(spacing: 0) {
          hero(now: now, timeline: t, coords: c, sky: sky, topInset: topInset)
          if let t, let c {
            quickTiles(t, now: now, coords: c).padding(.horizontal, 20).padding(.top, -30).zIndex(1)
            VStack(spacing: 16) {
              prayerGridCard(t, now: now)
              continueReadingCard
              nearestMosqueCard(c)
              adhkarCard(t, now: now)
              Text("يعمل دون اتصال · لا حساب ولا تتبّع").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 20).padding(.top, 20)
          } else {
            locationPrompt.padding(.horizontal, 20).padding(.top, 20)
          }
          if ScreenshotMode.scrollToBottom { Text("▲ نهاية المحتوى").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).padding(.top, 12) }
        }
        // الإزاحة عن الشريط العائم من `.tabBarClearance()` على الجذر — هنا فسحة فقط
        .padding(.bottom, 24)
        .id("home-content")
      }
      .defaultScrollAnchor(ScreenshotMode.scrollToBottom ? UnitPoint.bottom : nil)
      .task {
        guard ScreenshotMode.scrollToBottom else { return }
        try? await Task.sleep(for: .seconds(5))
        proxy.scrollTo("home-content", anchor: .bottom)
      }
      // الطقس (إن فُعّل): تحديث كل ساعة حول الخلية الحالية، وبلا شبكة في وضع اللقطات
      .task(id: "\(model.settings.sky.weather)-\(c.map(SkyWeatherService.cellKey) ?? "-")") {
        guard model.settings.sky.weather, model.settings.sky.mode == .auto, !ScreenshotMode.active, let c else { return }
        await weather.refreshIfNeeded(around: c)
      }
    }
  }

  // MARK: الهيرو
  private func hero(now: Date, timeline t: PrayerTimes.DayTimeline?, coords c: Coordinates?, sky: SkyState, topInset: CGFloat) -> some View {
    let p = sky.palette
    return ZStack(alignment: .top) {
      SkyBackdrop(state: sky, reduceMotion: model.settings.sky.reduceMotion)
      VStack(alignment: .leading, spacing: 0) {
        topRow(now: now, palette: p)
        if let t, let c {
          HStack(alignment: .top, spacing: 8) {
            nextPrayerBlock(t, now: now, palette: p)
            Spacer(minLength: 0)
            medallionColumn(coords: c, palette: p)
          }
          .padding(.top, 10)
          DayTimelineStrip(t: t, now: now, palette: p, tz: model.timeZone, hour12: model.settings.hour12, numerals: model.settings.numerals)
            .frame(height: 96).padding(.top, 14)
        } else {
          VStack(alignment: .leading, spacing: 6) {
            Text("حدّد موقعك").font(DS.kufi(40, .bold)).foregroundStyle(p.text)
            Text("لتُحسب المواقيت والقبلة وتتبدّل السماء مع وقتك").font(DS.F.bodyMd).foregroundStyle(p.textMuted)
          }
          .padding(.top, 24).padding(.bottom, 40)
        }
      }
      .padding(.top, topInset + 6).padding(.horizontal, 20).padding(.bottom, 56)
    }
    .frame(maxWidth: .infinity)
    .clipShape(UnevenRoundedRectangle(topLeadingRadius: 0, bottomLeadingRadius: 36, bottomTrailingRadius: 36, topTrailingRadius: 0, style: .continuous))
    .animation(.easeInOut(duration: model.settings.sky.reduceMotion ? 0 : 0.8), value: sky.palette)
  }

  /// التحيّة والمدينة والتاريخ (يمين) وزرّا التنبيهات والتقويم الزجاجيان (يسار)
  private func topRow(now: Date, palette p: SkyPalette) -> some View {
    let s = model.settings
    let h = model.hijri(now: now)
    return HStack(alignment: .top, spacing: 10) {
      VStack(alignment: .leading, spacing: 6) {
        Text("السَّلامُ عَلَيْكُمْ وَرَحْمَةُ الله").font(DS.amiri(17)).foregroundStyle(p.isDark ? Color(hex: 0x9FD1CA) : DS.C.brandStrong)
        NavigationLink { CityPickerView().tabBarClearance() } label: {
          HStack(spacing: 6) {
            Image(systemName: "mappin").font(.system(size: 12, weight: .semibold)).foregroundStyle(p.gold)
            Text(model.location.placeName ?? "حدّد موقعك").font(DS.readex(13, .medium)).foregroundStyle(p.text).lineLimit(1)
            Image(systemName: "chevron.down").font(.system(size: 10, weight: .bold)).foregroundStyle(p.textMuted)
          }
          .padding(.vertical, 6).padding(.leading, 12).padding(.trailing, 10)
          .background(p.glass, in: Capsule()).overlay(Capsule().stroke(p.glassStroke, lineWidth: 1))
        }
        .buttonStyle(.plain).accessibilityLabel("الموقع")
        // نصوصٌ منفصلة لا سلسلة واحدة: خلط الأرقام العربية والغربية في سلسلةٍ واحدة قلب ترتيب الكلمات (قِيس)
        HStack(spacing: 6) {
          Text("\(h.weekday) \(Fmt.number(h.day, numerals: s.numerals)) \(h.monthName) \(Fmt.number(h.year, numerals: s.numerals))هـ")
          Text("·")
          Text(Fmt.shortDate(now, tz: model.timeZone, numerals: s.numerals))
        }
        .font(DS.readex(12.5)).foregroundStyle(p.textMuted).lineLimit(1).minimumScaleFactor(0.8)
      }
      Spacer(minLength: 8)
      NavigationLink { SettingsView().environment(model).tabBarClearance() } label: { glassIcon("bell", palette: p, badge: !s.reminders.prayers.isEmpty) }
        .buttonStyle(.plain).accessibilityLabel("التنبيهات")
      NavigationLink { MonthTableView().tabBarClearance() } label: { glassIcon("calendar", palette: p) }
        .buttonStyle(.plain).accessibilityLabel("الجدول الشهري")
    }
  }
  private func glassIcon(_ name: String, palette p: SkyPalette, badge: Bool = false) -> some View {
    ZStack(alignment: .topLeading) {
      Circle().fill(p.glass).overlay(Circle().stroke(p.glassStroke, lineWidth: 1)).frame(width: 46, height: 46)
        .overlay(Image(systemName: name).font(.system(size: 18, weight: .medium)).foregroundStyle(p.textSoft))
      if badge { Circle().fill(p.gold).frame(width: 9, height: 9).overlay(Circle().stroke(p.stops[1].color, lineWidth: 1.5)).padding(7) }
    }
  }

  /// كتلة الصلاة القادمة: عنوان صغير مع حبّة «بعد…»، اسم الصلاة بالكوفي، العدّ التنازلي الكبير، ثم الأذان وطريقة الحساب
  private func nextPrayerBlock(_ t: PrayerTimes.DayTimeline, now: Date, palette p: SkyPalette) -> some View {
    let s = model.settings
    let remaining = t.next.time.timeIntervalSince(now)
    return VStack(alignment: .leading, spacing: 2) {
      HStack(spacing: 8) {
        Circle().fill(p.gold).frame(width: 6, height: 6)
        Text("الصلاة القادمة").font(DS.readex(13, .medium)).kerning(0.4).foregroundStyle(p.gold)
        Text(remainingLabel(remaining, numerals: s.numerals)).font(DS.readex(11.5, .medium)).foregroundStyle(p.gold)
          .padding(.vertical, 3).padding(.horizontal, 9)
          .background(p.gold.opacity(0.16), in: Capsule()).overlay(Capsule().stroke(p.gold.opacity(0.35), lineWidth: 1))
      }
      Text(t.next.isTomorrow ? "فجر الغد" : t.next.key.nameAr).font(DS.kufi(52, .bold)).foregroundStyle(p.text).lineLimit(1).minimumScaleFactor(0.6)
        .padding(.top, 4)
      Text(Fmt.countdown(remaining, numerals: s.numerals)).font(DS.readex(52, .light, fixed: true)).monospacedDigit().foregroundStyle(p.text).lineLimit(1).minimumScaleFactor(0.5)
      HStack(spacing: 10) {
        Text("الأذان \(Fmt.time(t.next.time, tz: model.timeZone, hour12: s.hour12, numerals: s.numerals))").font(DS.readex(13, .medium)).foregroundStyle(p.textSoft)
        Button { showMethods = true } label: {
          Text(Methods.method(s.methodId).nameAr).font(DS.readex(10.5)).foregroundStyle(p.textMuted).lineLimit(1).minimumScaleFactor(0.7)
            .padding(.vertical, 3).padding(.horizontal, 8).background(p.glass, in: Capsule())
        }
        .buttonStyle(.plain).accessibilityLabel("طريقة الحساب")
      }
      .padding(.top, 2)
    }
    .frame(maxWidth: 200, alignment: .leading)
  }

  private func remainingLabel(_ secs: TimeInterval, numerals n: String) -> String {
    let m = max(0, Int(secs / 60))
    if m < 60 { return "بعد \(Fmt.number(max(1, m), numerals: n)) دقيقة" }
    let h = m / 60, r = m % 60
    return r == 0 ? "بعد \(Fmt.number(h, numerals: n)) س" : "بعد \(Fmt.number(h, numerals: n)) س و\(Fmt.number(r, numerals: n)) د"
  }

  /// الميدالية وحبّة التوجّه والاتجاه والبعد
  private func medallionColumn(coords c: Coordinates, palette p: SkyPalette) -> some View {
    let s = model.settings
    let q = Qibla.info(latitude: c.latitude, longitude: c.longitude)
    // المحاكي بلا مغناطيسية: في وضع اللقطات وحده يُفترض اتجاهٌ يطابق القبلة (انظر QiblaView)
    let heading = model.location.heading.map { CompassMath.trueHeading($0, at: c) } ?? (ScreenshotMode.active ? q.bearing : nil)
    let diff = heading.map { Qibla.signedDifference(target: q.bearing, reference: $0) }
    let aligned = diff.map { abs($0) <= 3 } ?? false
    return Button { showQibla = true } label: {
      VStack(spacing: 8) {
        CompassMedallion(bearing: q.bearing, heading: heading ?? 0, aligned: aligned, live: heading != nil).frame(width: 140, height: 140)
        qiblaChip(aligned: aligned, diff: diff, live: heading != nil, palette: p)
        Text("\(Fmt.degrees(q.bearing, numerals: s.numerals)) \(Qibla.compassPointAr(q.bearing))  ·  \(Fmt.distance(q.distanceKm, numerals: s.numerals))")
          .font(DS.readex(11)).foregroundStyle(p.textMuted).lineLimit(1).minimumScaleFactor(0.75)
      }
      .frame(width: 150)
    }
    .buttonStyle(.plain).accessibilityLabel("القبلة كاملة")
  }

  private func qiblaChip(aligned: Bool, diff: Double?, live: Bool, palette p: SkyPalette) -> some View {
    let n = model.settings.numerals
    let text: String
    let icon: String
    if !live { text = "حرّك الهاتف على شكل ٨"; icon = "arrow.triangle.2.circlepath" }
    else if aligned { text = "متّجه نحو القبلة"; icon = "checkmark" }
    else if let d = diff { text = d > 0 ? "يمينًا \(Fmt.degrees(abs(d), numerals: n))" : "يسارًا \(Fmt.degrees(abs(d), numerals: n))"; icon = d > 0 ? "arrow.turn.up.right" : "arrow.turn.up.left" }
    else { text = "جارٍ القراءة…"; icon = "location.north.line" }
    return HStack(spacing: 6) {
      Text(text).font(DS.readex(12.5, .medium)).foregroundStyle(aligned ? (p.isDark ? Color(hex: 0xBFF3EA) : DS.C.brandStrong) : p.textSoft).lineLimit(1).minimumScaleFactor(0.8)
      Image(systemName: icon).font(.system(size: 11, weight: .bold)).foregroundStyle(aligned ? p.mint : p.gold)
    }
    .padding(.vertical, 7).padding(.horizontal, 12)
    .background(aligned ? p.mint.opacity(0.16) : p.glass, in: Capsule())
    .overlay(Capsule().stroke(aligned ? p.mint.opacity(0.45) : p.glassStroke, lineWidth: 1))
    .animation(.snappy(duration: 0.25), value: aligned)
  }

  // MARK: الوصول السريع
  private func quickTiles(_ t: PrayerTimes.DayTimeline, now: Date, coords c: Coordinates) -> some View {
    let s = model.settings; let n = s.numerals
    let page = s.lastRead?.page ?? 1
    let period = Adhkar.autoPeriod(now: now, fajr: t.times[.fajr], dhuhr: t.times[.dhuhr], asr: t.times[.asr], tz: model.timeZone)
    let q = Qibla.info(latitude: c.latitude, longitude: c.longitude)
    let mosqueSub = mosques.results.first.map { MosqueFinder.distanceLabel($0.distanceKm, numerals: n) } ?? (s.nearbyMosques ? "حولك" : "قريب منك")
    return HStack(spacing: 10) {
      Button { switchTab(.mushaf) } label: { tile("book", "المصحف", "ص \(Fmt.number(page, numerals: n))") }.buttonStyle(.plain)
      Button { switchTab(.adhkar) } label: { tile("sparkles", "الأذكار", period == "morning" ? "الصباح" : "المساء") }.buttonStyle(.plain)
      Button { showQibla = true } label: { tile("safari", "القبلة", Fmt.degrees(q.bearing, numerals: n)) }.buttonStyle(.plain)
      NavigationLink { MosquesView().environment(model).tabBarClearance() } label: { tile("building.columns", "المساجد", mosqueSub) }.buttonStyle(.plain)
    }
  }
  private func tile(_ icon: String, _ title: String, _ sub: String) -> some View {
    VStack(spacing: 8) {
      RoundedRectangle(cornerRadius: 14, style: .continuous).fill(DS.C.brandSoft.opacity(0.55)).frame(width: 40, height: 40)
        .overlay(Image(systemName: icon).font(.system(size: 17, weight: .medium)).foregroundStyle(DS.C.brandPrimary))
      Text(title).font(DS.readex(12.5, .semibold)).foregroundStyle(DS.C.textPrimary).lineLimit(1)
      Text(sub).font(DS.readex(10.5)).foregroundStyle(DS.C.textTertiary).lineLimit(1).minimumScaleFactor(0.8)
    }
    .frame(maxWidth: .infinity).padding(.vertical, 12).padding(.horizontal, 4)
    .background(DS.C.bgSurface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    .shadow(color: DS.C.shadowCard, radius: 14, x: 0, y: 8).shadow(color: DS.C.shadowCard.opacity(0.5), radius: 2, x: 0, y: 1)
    .contentShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
  }

  // MARK: مواقيت اليوم — شبكة ٣×٢
  private func isNext(_ p: Prayer, _ t: PrayerTimes.DayTimeline) -> Bool { t.next.key == p && !t.next.isTomorrow }

  private func prayerGridCard(_ t: PrayerTimes.DayTimeline, now: Date) -> some View {
    let s = model.settings
    let rows: [[Prayer]] = [[.fajr, .sunrise, .dhuhr], [.asr, .maghrib, .isha]]
    return VStack(alignment: .leading, spacing: 12) {
      HStack {
        Text("مواقيت اليوم").font(DS.kufi(19)).foregroundStyle(DS.C.textPrimary)
        Spacer()
        NavigationLink { MonthTableView().tabBarClearance() } label: { DSLinkLabel(title: "الجدول الشهري") }.buttonStyle(.plain)
      }
      VStack(spacing: 8) {
        ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
          HStack(spacing: 8) { ForEach(row, id: \.self) { p in prayerCell(p, t, now: now) } }
        }
      }
      HStack {
        Button { showMethods = true } label: {
          HStack(spacing: 6) {
            Text(Methods.method(s.methodId).nameAr).font(DS.readex(11.5, .medium)).foregroundStyle(DS.C.textSecondary).lineLimit(1).minimumScaleFactor(0.7)
            Image(systemName: "chevron.down").font(.system(size: 9, weight: .bold)).foregroundStyle(DS.C.textSecondary)
          }
          .padding(.vertical, 5).padding(.horizontal, 10).background(DS.C.bgSubtle, in: Capsule())
        }
        .buttonStyle(.plain).accessibilityLabel("طريقة الحساب")
        Spacer()
        NavigationLink { SettingsView().environment(model).tabBarClearance() } label: {
          HStack(spacing: 5) {
            Image(systemName: "bell").font(.system(size: 12, weight: .medium))
            Text("التنبيهات \(Fmt.number(s.reminders.prayers.count, numerals: s.numerals)) من ٦").font(DS.readex(11.5))
          }
          .foregroundStyle(DS.C.textTertiary)
        }
        .buttonStyle(.plain)
      }
    }
    .dsCard(padding: 16)
  }

  private func glyph(for p: Prayer) -> String {
    switch p { case .fajr: "sunrise"; case .sunrise: "sun.horizon"; case .dhuhr: "sun.max"; case .asr: "sun.min"; case .maghrib: "sunset"; case .isha: "moon.stars" }
  }

  private func prayerCell(_ p: Prayer, _ t: PrayerTimes.DayTimeline, now: Date) -> some View {
    let s = model.settings
    let next = isNext(p, t)
    let past = !next && (t.times[p].map { $0 <= now } ?? false)
    let remind = s.reminders.prayers.contains(p)
    return Button {
      var r = s.reminders
      if remind { r.prayers.remove(p) } else { r.prayers.insert(p) }
      s.reminders = r; model.rescheduleNotifications()
    } label: {
      VStack(spacing: 6) {
        Image(systemName: glyph(for: p)).font(.system(size: 16, weight: .medium)).foregroundStyle(next ? DS.C.textOnBrand : past ? DS.C.textTertiary : DS.C.brandPrimary).frame(height: 20)
        Text(p.nameAr).font(DS.readex(12.5, .semibold)).foregroundStyle(next ? DS.C.textOnBrand : past ? DS.C.textTertiary : DS.C.textPrimary)
        Text(Fmt.time(t.times[p], tz: model.timeZone, hour12: s.hour12, numerals: s.numerals)).font(DS.readex(12, .medium, fixed: true)).monospacedDigit()
          .foregroundStyle(next ? DS.C.textOnBrand.opacity(0.9) : past ? DS.C.textTertiary : DS.C.textSecondary)
      }
      .frame(maxWidth: .infinity).padding(.vertical, 10).padding(.horizontal, 6)
      .background(next ? DS.C.brandPrimary : DS.C.bgCanvas, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
      .overlay(alignment: .topLeading) {
        if next { Text("القادمة").font(DS.readex(10, .semibold)).foregroundStyle(DS.C.textPrimary).padding(.vertical, 2).padding(.horizontal, 8).background(DS.C.accentGold, in: Capsule()).padding(6) }
      }
      .overlay(alignment: .topTrailing) {
        Image(systemName: remind ? "bell.fill" : "bell.slash").font(.system(size: 9, weight: .semibold))
          .foregroundStyle(next ? DS.C.textOnBrand.opacity(0.85) : remind ? DS.C.brandPrimary : DS.C.borderStrong).padding(8)
      }
      .shadow(color: next ? DS.C.brandPrimary.opacity(0.35) : .clear, radius: 12, x: 0, y: 8)
    }
    .buttonStyle(.plain)
    .accessibilityLabel("\(p.nameAr) \(Fmt.time(t.times[p], tz: model.timeZone, hour12: s.hour12, numerals: s.numerals))")
    .accessibilityHint(remind ? "اضغط لإيقاف التذكير" : "اضغط لتفعيل التذكير")
  }

  // MARK: متابعة القراءة
  private var continueReadingCard: some View {
    let s = model.settings; let q = model.quran; let n = s.numerals; let today = model.todayKey
    let last = s.lastRead
    let page = last?.page ?? 1
    let stt = q.khatmah.map { Khatmah.status($0, currentPage: page, log: q.readLog, today: today) }
    let pct = stt.map { Double($0.percent) / 100 } ?? Double(page) / 604
    let pagesToday = q.readLog[today]?.count ?? 0
    let progressLine: String = {
      if let stt { return stt.finished ? "تقبّل الله ✦ أتممت الختمة" : "الختمة \(Fmt.number(stt.percent, numerals: n))٪  ·  \(Fmt.number(stt.todayPages, numerals: n)) صفحات اليوم من \(Fmt.number(stt.todayTarget, numerals: n))" }
      return "\(Fmt.number(Int((pct * 100).rounded()), numerals: n))٪ من المصحف  ·  \(pagesToday == 0 ? "لم تقرأ اليوم بعد" : "قرأت اليوم \(Fmt.number(pagesToday, numerals: n)) صفحات")"
    }()
    return HStack(alignment: .center, spacing: 14) {
      VStack(alignment: .leading, spacing: 6) {
        HStack(spacing: 6) {
          Image(systemName: "book").font(.system(size: 12, weight: .medium)).foregroundStyle(DS.C.accentGoldStrong)
          Text(last == nil ? "ابدأ القراءة" : "متابعة القراءة").font(DS.readex(12, .medium)).foregroundStyle(DS.C.accentGoldStrong)
        }
        Text(last.map { "سورة \(QuranMeta.surah($0.surah).name)" } ?? "سورة الفاتحة").font(DS.kufi(22)).foregroundStyle(DS.C.textPrimary).lineLimit(1).minimumScaleFactor(0.7)
        Text(last.map { "صفحة \(Fmt.number($0.page, numerals: n))  ·  الجزء \(Fmt.number(QuranMeta.juz(ofPage: $0.page), numerals: n))  ·  الآية \(Fmt.number($0.ayah, numerals: n))" } ?? "مصحف المدينة · حفص عن عاصم · ٦٠٤ صفحات")
          .font(DS.readex(12)).foregroundStyle(DS.C.textSecondary).lineLimit(1).minimumScaleFactor(0.75)
        ProgressTrack(progress: pct, tint: DS.C.accentGold, track: DS.C.bgSubtle, height: 6).padding(.top, 2)
        Text(progressLine).font(DS.readex(11)).foregroundStyle(DS.C.textTertiary).lineLimit(1).minimumScaleFactor(0.75)
        Button { model.pendingReaderPage = page; switchTab(.mushaf) } label: {
          HStack(spacing: 6) {
            Text(last == nil ? "افتح المصحف" : "تابع القراءة").font(DS.readex(12.5, .semibold))
            Image(systemName: "chevron.forward").font(.system(size: 10, weight: .bold))
          }
          .foregroundStyle(DS.C.textOnBrand).padding(.vertical, 8).padding(.horizontal, 14).background(DS.C.brandPrimary, in: Capsule())
        }
        .buttonStyle(.plain).padding(.top, 4)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      MiniPageThumb(page: page, numerals: n)
    }
    .dsCard(padding: 16)
  }

  // MARK: أقرب مسجد
  /// مركز البحث هو موقع الجهاز الفعلي لا إحداثيات المواقيت (`AppModel.mosqueCenter`): مدينة يدوية تعني مركزها،
  /// فبدا «أقرب مسجد» في إسطنبول آيا صوفيا على ٩٠ م والمالك على نصف ساعة منها (قِيس في ثلاثة بناءات).
  private func nearestMosqueCard(_ c: Coordinates) -> some View {
    let s = model.settings; let n = s.numerals
    let center = model.mosqueCenter
    let fixKey = center.map { String(format: "%.3f,%.3f", $0.latitude, $0.longitude) } ?? "-"
    return VStack(alignment: .leading, spacing: 12) {
      HStack {
        Text("أقرب مسجد").font(DS.kufi(19)).foregroundStyle(DS.C.textPrimary)
        Spacer()
        NavigationLink { MosquesView().environment(model).tabBarClearance() } label: { DSLinkLabel(title: "المساجد القريبة") }.buttonStyle(.plain)
      }
      if !s.nearbyMosques {
        Text("يعرض أقرب مسجد إليك من خرائط آبل وOpenStreetMap. يُرسل موقعك مقرّبًا إلى نحو كيلومتر عند البحث، ولا يُحفظ لدينا.")
          .font(DS.F.bodySm).foregroundStyle(DS.C.textSecondary)
        DSButton(title: "اعرض أقرب مسجد", icon: "building.columns") { s.nearbyMosques = true }
      } else if center == nil {
        DeviceFixPrompt()
      } else if let m = mosques.results.first, let center {
        NavigationLink { MosquesView().environment(model).tabBarClearance() } label: { MosqueMapStrip(mosque: m, center: center, walk: MosqueFinder.walkLabel(m.distanceKm, numerals: n)) }.buttonStyle(.plain)
        HStack(spacing: 12) {
          DSIcon(systemName: "building.columns", style: .soft, size: 42, iconSize: 17)
          VStack(alignment: .leading, spacing: 3) {
            Text(m.name).font(DS.readex(15, .semibold)).foregroundStyle(DS.C.textPrimary).lineLimit(1)
            HStack(spacing: 6) {
              Text("\(MosqueFinder.distanceLabel(m.distanceKm, numerals: n))  ·  \(MosqueFinder.walkLabel(m.distanceKm, numerals: n))  ·  \(Qibla.compassPointAr(m.bearing))")
                .font(DS.readex(11.5)).foregroundStyle(DS.C.textSecondary).lineLimit(1).minimumScaleFactor(0.75)
              // نتائج آبل تُعرض فورًا؛ الدوّارة تعني أن OpenStreetMap ما زالت تُدقّق الأقرب
              if mosques.loading { ProgressView().controlSize(.mini).accessibilityLabel("يجري تدقيق الأقرب") }
            }
          }
          Spacer(minLength: 4)
          Button { MosqueFinder.openDirections(to: m) } label: { DSIcon(systemName: "arrow.triangle.turn.up.right.diamond", style: .brand, size: 42, iconSize: 17) }
            .buttonStyle(.plain).accessibilityLabel("الاتجاهات إلى \(m.name)")
        }
      } else if mosques.loading {
        HStack(spacing: 8) { ProgressView(); Text("جارٍ البحث حولك…").font(DS.F.bodySm).foregroundStyle(DS.C.textSecondary) }
      } else {
        Text(mosques.error ?? "لا مساجد ضمن ٣ كم — افتح «المساجد القريبة» للبحث بالاسم").font(DS.F.bodySm).foregroundStyle(DS.C.textSecondary)
      }
    }
    .dsCard(padding: 16)
    .task(id: "\(s.nearbyMosques)-\(fixKey)-\(model.location.authorization.rawValue)") {
      guard s.nearbyMosques else { return }
      // موقع طازج مع كل ظهور (مخنوق دقيقتين)؛ حين يصل يتغيّر المفتاح فيُعاد البحث حوله
      if model.location.authorization == .authorizedWhenInUse || model.location.authorization == .authorizedAlways { model.location.requestDeviceFix() }
      if let center { await mosques.nearby(around: center) }
    }
  }

  // MARK: أذكار الوقت
  private func adhkarCard(_ t: PrayerTimes.DayTimeline, now: Date) -> some View {
    let n = model.settings.numerals; let today = model.todayKey
    let period = Adhkar.autoPeriod(now: now, fajr: t.times[.fajr], dhuhr: t.times[.dhuhr], asr: t.times[.asr], tz: model.timeZone)
    let items = Adhkar.items(for: period)
    let pr = model.content.adhkarProgress
    let map: [String: Int] = period == "morning" ? (pr.date == today ? (pr.morning ?? [:]) : [:]) : (pr.eveningDate == today ? (pr.evening ?? [:]) : [:])
    let done = items.filter { (map[$0.id] ?? 0) >= $0.target(for: period) }.count
    let total = items.count
    let streak = AdhkarStreak.current(model.content.adhkarLog, today: today)
    let finished = total > 0 && done >= total
    let title = period == "morning" ? "أذكار الصباح" : "أذكار المساء"
    let when = period == "morning" ? "وقتها من الفجر إلى الظهر" : "وقتها من العصر إلى الفجر"
    let status: String = {
      if finished { return "أتممتها اليوم ✓" + (streak > 0 ? "  ·  سلسلة \(Fmt.number(streak, numerals: n)) \(dayWord(streak))" : "") }
      let base = done == 0 ? "لم تبدأ بعد" : "أكملت \(Fmt.number(done, numerals: n)) من \(Fmt.number(total, numerals: n))"
      return streak > 0 ? "\(base)  ·  سلسلة \(Fmt.number(streak, numerals: n)) \(dayWord(streak)) 🔥" : base
    }()
    return HStack(spacing: 14) {
      ZStack {
        RingProgress(progress: total > 0 ? Double(done) / Double(total) : 0, tint: DS.C.accentGold, track: Color.white.opacity(0.14), lineWidth: 6).frame(width: 58, height: 58)
        Text("\(Fmt.number(done, numerals: n))/\(Fmt.number(total, numerals: n))").font(DS.readex(12, .semibold, fixed: true)).foregroundStyle(DS.C.textOnDark)
      }
      VStack(alignment: .leading, spacing: 4) {
        Text(when).font(DS.readex(11.5)).foregroundStyle(DS.C.textOnDarkMuted)
        Text(title).font(DS.kufi(22)).foregroundStyle(DS.C.textOnDark)
        Text(status).font(DS.readex(11.5)).foregroundStyle(DS.C.textOnDark.opacity(0.75)).lineLimit(1).minimumScaleFactor(0.75)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      Button { model.pendingAdhkarPeriod = period; switchTab(.adhkar) } label: {
        HStack(spacing: 6) {
          Text(finished ? "راجع" : done > 0 ? "تابع" : "ابدأ").font(DS.readex(13, .semibold))
          Image(systemName: "chevron.forward").font(.system(size: 10, weight: .bold))
        }
        .foregroundStyle(DS.C.textPrimary).padding(.vertical, 10).padding(.horizontal, 16).background(DS.C.accentGold, in: Capsule())
      }
      .buttonStyle(.plain)
    }
    .padding(16)
    .frame(maxWidth: .infinity)
    .background {
      ZStack {
        LinearGradient(colors: [Color(hex: 0x0B3F39), Color(hex: 0x0E5C55)], startPoint: .leading, endPoint: .trailing)
        StarLattice().opacity(0.06)
      }
    }
    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    .shadow(color: DS.C.brandPrimary.opacity(0.28), radius: 20, x: 0, y: 10)
  }
  private func dayWord(_ n: Int) -> String { n == 1 ? "يوم" : n == 2 ? "يومين" : n <= 10 ? "أيام" : "يومًا" }

  // MARK: لا موقع بعد
  private var locationPrompt: some View {
    VStack(spacing: 14) {
      DSIcon(systemName: "location.circle", style: .soft, size: 72, iconSize: 32)
      Text("حدّد موقعك لحساب المواقيت والقبلة").font(DS.F.headingLg).foregroundStyle(DS.C.textPrimary).multilineTextAlignment(.center)
      Text("يُستخدم الموقع على جهازك فقط لحساب المواقيت واتجاه القبلة، ولا يُرسل إلى أي خادم.").font(DS.F.bodyMd).foregroundStyle(DS.C.textSecondary).multilineTextAlignment(.center)
      if let e = model.location.errorMessage { Text(e).font(DS.F.bodySm).foregroundStyle(DS.C.danger).multilineTextAlignment(.center) }
      DSButton(title: "استخدام موقع الجهاز", icon: "location.fill") { model.location.requestLocation() }
      NavigationLink { CityPickerView().tabBarClearance() } label: { DSButtonLabel(title: "اختيار مدينة يدويًا · ٦٤٩ مدينة", kind: .outline, icon: "magnifyingglass") }.buttonStyle(.plain)
    }
    .frame(maxWidth: .infinity)
    .dsCard(padding: 24)
  }
}

// MARK: - خطّ اليوم
/// ست عقد للصلوات على مسار أفقي (الفجر يمينًا)، المنقضي ذهبي، والقادمة محلّقة بذهب، وعلامة «الآن» (هلال/شمس) تزحف مع نسبة الوقت
struct DayTimelineStrip: View {
  let t: PrayerTimes.DayTimeline
  let now: Date
  let palette: SkyPalette
  let tz: TimeZone
  let hour12: Bool
  let numerals: String

  private var prayers: [Prayer] { Array(Prayer.allCases) }
  /// موضع «الآن» بين ٠ (الفجر) و٥ (العشاء) — قبل الفجر عند اليمين وبعد العشاء عند اليسار
  private var nowIndex: Double {
    let times = prayers.map { t.times[$0] }
    guard let fajr = times[0], now >= fajr else { return 0 }
    for k in 0..<(prayers.count - 1) {
      guard let a = times[k], let b = times[k + 1], b > a else { continue }
      if now < b { return Double(k) + now.timeIntervalSince(a) / b.timeIntervalSince(a) }
    }
    return Double(prayers.count - 1)
  }
  private var passedCount: Int { prayers.filter { p in t.times[p].map { $0 <= now } ?? false }.count }
  private var isNight: Bool {
    let m = t.times[.maghrib], s = t.times[.sunrise]
    return (m.map { now >= $0 } ?? false) || (s.map { now < $0 } ?? true)
  }
  private var elapsedLabel: String {
    let start = t.times[t.current].flatMap { $0 <= now ? $0 : nil } ?? t.yesterdayIsha
    let total = start.map { t.next.time.timeIntervalSince($0) } ?? 0
    let pct = total > 0 ? Int((min(1, max(0, now.timeIntervalSince(start!) / total)) * 100).rounded()) : 0
    return "مضى \(Fmt.number(pct, numerals: numerals))٪ من وقت \(t.current.nameAr)"
  }

  var body: some View {
    GeometryReader { geo in
      let w = geo.size.width, pad: CGFloat = 26, ty: CGFloat = 40
      let step = (w - pad * 2) / CGFloat(prayers.count - 1)
      let x: (Double) -> CGFloat = { w - pad - CGFloat($0) * step }
      let nowX = x(nowIndex)
      ZStack(alignment: .topLeading) {
        Canvas { ctx, _ in
          var track = Path(); track.move(to: CGPoint(x: pad, y: ty)); track.addLine(to: CGPoint(x: w - pad, y: ty))
          ctx.stroke(track, with: .color(palette.text.opacity(0.18)), style: StrokeStyle(lineWidth: 2, lineCap: .round))
          var done = Path(); done.move(to: CGPoint(x: x(0), y: ty)); done.addLine(to: CGPoint(x: nowX, y: ty))
          ctx.stroke(done, with: .linearGradient(Gradient(colors: [palette.gold.opacity(0.55), palette.gold]), startPoint: CGPoint(x: nowX, y: ty), endPoint: CGPoint(x: x(0), y: ty)), style: StrokeStyle(lineWidth: 3, lineCap: .round))
          for (k, p) in prayers.enumerated() {
            let next = t.next.key == p && !t.next.isTomorrow
            let passed = k < passedCount
            let sz: CGFloat = next ? 14 : 10
            let rect = CGRect(x: x(Double(k)) - sz / 2, y: ty - sz / 2, width: sz, height: sz)
            if next {
              ctx.fill(Path(ellipseIn: rect), with: .color(palette.stops[1].color))
              ctx.stroke(Path(ellipseIn: rect), with: .color(palette.gold), lineWidth: 2.5)
            } else {
              ctx.fill(Path(ellipseIn: rect), with: .color(passed ? palette.gold : palette.text.opacity(p == .sunrise ? 0.45 : 0.9)))
              ctx.stroke(Path(ellipseIn: rect), with: .color(palette.stops[1].color), lineWidth: 2)
            }
          }
        }
        ForEach(Array(prayers.enumerated()), id: \.offset) { k, p in
          let next = t.next.key == p && !t.next.isTomorrow
          VStack(spacing: 1) {
            Text(p.nameAr).font(DS.readex(11.5, next ? .semibold : .medium)).foregroundStyle(next ? palette.gold : palette.text.opacity(p == .sunrise ? 0.5 : 0.9))
            Text(Fmt.time(t.times[p], tz: tz, hour12: hour12, numerals: numerals)).font(DS.readex(11, .regular, fixed: true)).monospacedDigit().foregroundStyle(palette.text.opacity(next ? 0.9 : 0.55))
          }
          .lineLimit(1).minimumScaleFactor(0.8)
          .frame(width: step + 4)
          .position(x: x(Double(k)), y: ty + 30)
        }
        // علامة «الآن»: هلال ليلًا وشمس نهارًا مع وهج ذهبي، والعبارة إلى جانبها
        HStack(spacing: 8) {
          ZStack {
            Circle().fill(palette.stops[3].color).overlay(Circle().stroke(palette.gold, lineWidth: 1.5)).frame(width: 26, height: 26)
              .shadow(color: palette.gold.opacity(0.55), radius: 10)
            Image(systemName: isNight ? "moon.fill" : "sun.max.fill").font(.system(size: 12, weight: .semibold)).foregroundStyle(Color(hex: 0xF3DFA0))
          }
          Text(elapsedLabel).font(DS.readex(10.5, .medium)).foregroundStyle(palette.gold).lineLimit(1).minimumScaleFactor(0.7)
        }
        .position(x: min(w - 70, max(13, nowX)) + 60, y: ty - 26)
        Rectangle().fill(palette.gold.opacity(0.8)).frame(width: 1.5, height: 8).position(x: nowX, y: ty - 10)
      }
    }
    .accessibilityElement(children: .combine)
    .accessibilityLabel("خطّ اليوم: \(elapsedLabel)")
  }
}

// MARK: - صورة الصفحة المصغّرة
/// صفحة مصحف مصغّرة بإطار ذهبي: شريط سورة وأسطر حبر ورقم الصفحة — إشارة لا صورة
struct MiniPageThumb: View {
  let page: Int
  let numerals: String
  var body: some View {
    ZStack(alignment: .bottom) {
      RoundedRectangle(cornerRadius: 10, style: .continuous).fill(DS.C.paperPage)
        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(DS.C.accentGold.opacity(0.7), lineWidth: 1))
      VStack(spacing: 0) {
        RoundedRectangle(cornerRadius: 2).fill(DS.C.brandSoft).frame(height: 9).padding(.horizontal, 11).padding(.top, 11)
        VStack(spacing: 6.4) {
          ForEach(0..<9, id: \.self) { i in
            HStack { Spacer(minLength: 0); RoundedRectangle(cornerRadius: 1).fill(DS.C.paperInk.opacity(0.55)).frame(width: i == 8 ? 34 : 56, height: 1.6) }
              .padding(.horizontal, 11)
          }
        }
        .padding(.top, 7)
        Spacer(minLength: 0)
        Text(Fmt.number(page, numerals: numerals)).font(DS.amiri(7)).foregroundStyle(DS.C.accentGoldStrong).padding(.bottom, 4)
      }
      RoundedRectangle(cornerRadius: 4).stroke(DS.C.accentGold.opacity(0.45), lineWidth: 0.8).padding(6)
    }
    .frame(width: 78, height: 106)
    .shadow(color: DS.C.shadowCard, radius: 10, x: 0, y: 4)
  }
}

// MARK: - شريحة الخريطة
/// خريطة حقيقية (خرائط آبل) بلا تفاعل تؤطّر المستخدم والمسجد معًا؛ اللمس يفتح شاشة المساجد
struct MosqueMapStrip: View {
  let mosque: Mosque
  let center: Coordinates
  let walk: String

  private var region: MKCoordinateRegion {
    let mid = CLLocationCoordinate2D(latitude: (center.latitude + mosque.latitude) / 2, longitude: (center.longitude + mosque.longitude) / 2)
    let meters = max(600, mosque.distanceKm * 1000 * 2.6)
    return MKCoordinateRegion(center: mid, latitudinalMeters: meters, longitudinalMeters: meters * 2.4)
  }

  var body: some View {
    Map(initialPosition: .region(region), interactionModes: []) {
      UserAnnotation()
      Annotation(mosque.name, coordinate: mosque.coordinate, anchor: .bottom) {
        VStack(spacing: -2) {
          ZStack {
            Circle().fill(DS.C.brandPrimary).frame(width: 34, height: 34).overlay(Circle().stroke(.white, lineWidth: 2.5))
              .shadow(color: DS.C.brandPrimary.opacity(0.4), radius: 8, x: 0, y: 6)
            Image(systemName: "building.columns.fill").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white)
          }
          Triangle().fill(DS.C.brandPrimary).frame(width: 12, height: 8)
        }
      }
    }
    .mapStyle(.standard(pointsOfInterest: .excludingAll))
    .mapControlVisibility(.hidden)
    .overlay(alignment: .topLeading) {
      Text(walk).font(DS.readex(10.5, .medium)).foregroundStyle(DS.C.brandPrimary)
        .padding(.vertical, 3).padding(.horizontal, 8).background(Color.white.opacity(0.92), in: Capsule()).padding(10)
    }
    .frame(height: 118)
    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    .accessibilityLabel("خريطة: \(mosque.name) على بعد \(walk)")
  }
}

/// مثلّث رأس الدبّوس
struct Triangle: Shape {
  func path(in r: CGRect) -> Path {
    var p = Path(); p.move(to: CGPoint(x: r.minX, y: r.minY)); p.addLine(to: CGPoint(x: r.maxX, y: r.minY)); p.addLine(to: CGPoint(x: r.midX, y: r.maxY)); p.closeSubpath(); return p
  }
}

/// الاتجاه الحقيقي من CoreLocation، أو المغناطيسي مصحّحًا بانحراف WMM2025
enum CompassMath {
  static func trueHeading(_ h: CLHeading, at c: Coordinates) -> Double {
    if h.trueHeading >= 0 { return h.trueHeading }
    return Geomag.magneticToTrue(h.magneticHeading, declination: Geomag.declination(lat: c.latitude, lon: c.longitude))
  }
}

/// ميدالية البوصلة: قرص زجاجي داكن، ٤٨ علامة درجات، حروف الجهات، الكعبة عند رأس إبرة ذهبية متدرّجة، وجوهرة في المركز
struct CompassMedallion: View {
  let bearing: Double
  let heading: Double
  let aligned: Bool
  var live: Bool = true
  @State private var pulse = false
  /// نبضة لمسية مع كل توهّج ما دام المستخدم متّجهًا (طلب المالك: «نبض اهتزاز مع الإضاءة»)
  @State private var beat = 0

  var body: some View {
    GeometryReader { geo in
      let size = min(geo.size.width, geo.size.height)
      let r = size / 2 - 5
      ZStack {
        // عند التوجّه: هالة نعناعية تنبض حول القرص — إشارة تُرى من بعيد، مع نقرة لمسية
        if aligned {
          Circle().fill(RadialGradient(colors: [Color(hex: 0x7BE0CF).opacity(0.45), .clear], center: .center, startRadius: r * 0.7, endRadius: r * 1.35))
            .frame(width: r * 2.7, height: r * 2.7)
            .scaleEffect(pulse ? 1.06 : 0.96).opacity(pulse ? 0.55 : 1)
          Circle().stroke(Color(hex: 0x7BE0CF), lineWidth: 3)
            .frame(width: r * 2 + 8, height: r * 2 + 8).blur(radius: 1.5)
            .scaleEffect(pulse ? 1.05 : 0.99).opacity(pulse ? 0.35 : 0.95)
        }
        Circle()
          .fill(RadialGradient(colors: [Color(hex: 0x125A52).opacity(0.95), Color(hex: 0x061F1C).opacity(0.97)], center: .center, startRadius: 0, endRadius: r))
          .overlay(Circle().stroke(aligned ? Color(hex: 0x7BE0CF).opacity(0.85) : Color.white.opacity(0.16), lineWidth: aligned ? 1.5 : 1))
          .frame(width: r * 2, height: r * 2)
          .shadow(color: aligned ? Color(hex: 0x7BE0CF).opacity(0.5) : .black.opacity(0.35), radius: 18, x: 0, y: aligned ? 0 : 8)
        Circle().stroke(Color.white.opacity(0.10), lineWidth: 1).frame(width: r * 1.45, height: r * 1.45)
        ZStack {
          Canvas { ctx, sz in
            let c = CGPoint(x: sz.width / 2, y: sz.height / 2)
            for i in 0..<48 {
              let major = i % 12 == 0, mid = i % 4 == 0
              let len: CGFloat = major ? 9 : (mid ? 6 : 3.5)
              let a = Double(i) * 7.5 * .pi / 180
              let outer = r - 6
              var path = Path()
              path.move(to: CGPoint(x: c.x + outer * sin(a), y: c.y - outer * cos(a)))
              path.addLine(to: CGPoint(x: c.x + (outer - len) * sin(a), y: c.y - (outer - len) * cos(a)))
              let color: Color = major ? Color(hex: 0xE2C77A).opacity(0.9) : Color.white.opacity(mid ? 0.45 : 0.22)
              ctx.stroke(path, with: .color(color), style: StrokeStyle(lineWidth: major ? 1.6 : 1, lineCap: .round))
            }
          }
          ForEach(Array(["ش", "ق", "ج", "غ"].enumerated()), id: \.offset) { i, letter in
            let angle = Double(i) * 90
            Text(letter).font(DS.kufi(10, .semibold)).foregroundStyle(i == 0 ? Color(hex: 0xE2C77A) : .white.opacity(0.55))
              .rotationEffect(.degrees(-angle)).offset(y: -(r - 18)).rotationEffect(.degrees(angle))
          }
          // الوهج والكعبة والإبرة تدور معًا نحو اتجاه القبلة
          Group {
            RadialGradient(colors: [Color(hex: 0xE2C77A).opacity(0.35), .clear], center: .center, startRadius: 0, endRadius: 35)
              .frame(width: 70, height: 70)
            RoundedRectangle(cornerRadius: 2.5, style: .continuous).fill(Color(hex: 0x05221F))
              .overlay(RoundedRectangle(cornerRadius: 2.5, style: .continuous).stroke(Color(hex: 0xE2C77A), lineWidth: 1.2))
              .overlay(alignment: .top) { Rectangle().fill(Color(hex: 0xE2C77A)).frame(height: 2.5).padding(.top, 4.5) }
              .frame(width: 14, height: 14)
              .offset(y: -(r - 15))
            NeedleShape()
              .fill(LinearGradient(colors: [Color(hex: 0xF3DFA0), Color(hex: 0xC69C3E)], startPoint: .top, endPoint: .bottom))
              .frame(width: 16, height: r - 20)
              .shadow(color: .black.opacity(0.35), radius: 6, x: 0, y: 3)
              .offset(y: -(r - 20) / 2)
            NeedleShape().fill(Color.white.opacity(0.22)).frame(width: 12, height: 34).rotationEffect(.degrees(180)).offset(y: 17)
          }
          .rotationEffect(.degrees(bearing))
          Circle().fill(RadialGradient(colors: [Color(hex: 0xFFF4CF), Color(hex: 0xC69C3E)], center: .center, startRadius: 0, endRadius: 8)).frame(width: 14, height: 14)
            .overlay(Circle().stroke(Color(hex: 0x061F1C), lineWidth: 2))
        }
        .rotationEffect(.degrees(-heading))
        .animation(.easeOut(duration: 0.25), value: heading)
        .opacity(live ? 1 : 0.5)
      }
      .frame(width: size, height: size)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .animation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true), value: pulse)
      .animation(.easeOut(duration: 0.3), value: aligned)
    }
    .onAppear { pulse = true }
    .sensoryFeedback(trigger: aligned) { _, on in on ? .success : nil }
    .task(id: aligned) {
      guard aligned else { return }
      while !Task.isCancelled { try? await Task.sleep(for: .milliseconds(900)); if !Task.isCancelled { beat += 1 } }
    }
    .sensoryFeedback(.impact(weight: .light, intensity: 0.7), trigger: beat)
    .accessibilityLabel(aligned ? "متجه إلى القبلة" : "اتجاه القبلة \(Int(bearing)) درجة")
  }
}

/// نقش النجمة الثمانية: شبكة خفيفة تُقرأ كنسيج لا كزخرفة (تُرسم بالكامل ثم تُقصّ مع البطاقة)
struct StarLattice: View {
  var tint: Color = .white
  var body: some View {
    Canvas { ctx, size in
      let step: CGFloat = 72, r: CGFloat = 29
      var y: CGFloat = -30; var row = 0
      while y < size.height + r {
        var x: CGFloat = (row % 2 == 1 ? 36 : 0) - 20
        while x < size.width + r {
          ctx.stroke(star(center: CGPoint(x: x + r, y: y + r), r: r), with: .color(tint), lineWidth: 1)
          x += step
        }
        y += step; row += 1
      }
    }
    .allowsHitTesting(false)
  }
  private func star(center: CGPoint, r: CGFloat) -> Path {
    var p = Path()
    for i in 0..<16 {
      let a = Double(i) * .pi / 8 - .pi / 2 + .pi / 16
      let rr = i % 2 == 0 ? r : r * 0.72
      let pt = CGPoint(x: center.x + rr * cos(a), y: center.y + rr * sin(a))
      if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
    }
    p.closeSubpath()
    return p
  }
}
