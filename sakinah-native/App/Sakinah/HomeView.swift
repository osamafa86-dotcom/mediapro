import SwiftUI
import CoreLocation
import UIKit
import SakinahCore

/// «اليوم» (المرحلة الثانية — تصميم «اليوم — iOS» فاتحًا وداكنًا):
/// هيرو سماءٍ يتبدّل مع وقت الصلاة (والطقس إن فُعّل) يجمع الصلاة القادمة ووقت أذانها والمتبقّي، والقبلة،
/// وبطاقة مواقيتٍ زجاجية داكنة في أسفله (نسبة ما مضى من الوقت، الصلوات الخمس، ضمان الأذان، جدول الشهر)؛
/// ثم بطاقة «الآن» (ذكر الوقت)، وأدوات سريعة، وورد اليوم، وحديث اليوم.
/// ملاحظة اتجاه: البيئة RTL، فأوّل عنصر في HStack يقع يمينًا، و`.leading` هو اليمين.
struct HomeView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.switchTab) private var switchTab
  /// فئة عرض النافذة (المرحلة الرابعة): المضغوط كما كان حرفيًّا، والمتوسّط شبكة عمودين تحت السماء،
  /// والموسّع سماءٌ في عمودٍ ثابت بجانب البطاقات (ipad-landscape.png)
  @Environment(\.widthClass) private var widthClass
  @State private var showQibla = ScreenshotMode.fullQibla
  @State private var showSkySettings = ScreenshotMode.skySettings
  @State private var showGuard = false
  @State private var showSearch = ScreenshotMode.search
  @State private var showSettings = ScreenshotMode.settings
  @State private var showKhatmah = false
  /// أوّل آية في صفحة الورد التالية — تُقرأ خارج الخيط الرئيس (نصّ المصحف يُحمَّل كسولًا وقد لا يكون جاهزًا عند أوّل رسم)
  @State private var wirdAyah: Ayah?
  @State private var weather = SkyWeatherService()
  /// «ليس الآن» في بطاقة «الآن»: يُخفيها حتى الفترة التالية (المفتاح: الفترة ولحظة بدايتها) — يُحفظ في UserDefaults
  @State private var nowDismissed = UserDefaults.standard.string(forKey: "today.now.dismissed") ?? ""

  /// أعمدة بطاقة المواقيت: الخمس وحدها (الشروق ليس عمودًا) — وفي رمضان: الإمساك مكان الفجر والإفطار مكان المغرب
  private static let cardPrayers: [Prayer] = [.fajr, .dhuhr, .asr, .maghrib, .isha]

  /// لحظة الرسم وما يُشتقّ منها مرّةً لكل إطار: الجدول، الإحداثيات، السماء، وطبعة رمضان
  private struct TodayState {
    let now: Date
    let t: PrayerTimes.DayTimeline?
    let c: Coordinates?
    let sky: SkyState
    /// يومٌ من رمضان (أو nil خارجه)
    let ramadan: RamadanDay?
    let fast: FastPhase
    /// أعمدة رمضان في بطاقة المواقيت: في الشهر، وفي ليلة أوّل يوم (السحور)
    var ramadanMode: Bool { ramadan != nil || fast != .off }
  }

  /// الهيرو يمتدّ تحت شريط الحالة في المضغوط والمتوسّط؛ وفي الموسّع بطاقةٌ داخل المنطقة الآمنة
  private var heroIgnoredEdges: Edge.Set { widthClass == .expanded ? [] : .top }

  var body: some View {
    NavigationStack {
      GeometryReader { geo in
        TimelineView(.periodic(from: .now, by: 1)) { ctx in content(now: ctx.date, topInset: geo.safeAreaInsets.top, width: geo.size.width) }
          .ignoresSafeArea(edges: heroIgnoredEdges)
      }
      .background(DS.C.bgCanvas)
      .tabBarClearance()
      .toolbar(.hidden, for: .navigationBar)
      .fullScreenCover(isPresented: $showQibla) { QiblaView(presented: true).environment(model) }
      .fullScreenCover(isPresented: $showSkySettings) { NavigationStack { SkySettingsView().environment(model) } }
      // البحث الشامل: غطاءٌ كامل بلا شريط تبويبات (كما في التصميم). الانتقال إلى تبويبٍ بعد إغلاقه لا معه،
      // كي لا يُقدَّم غطاء الوجهة (جلسة الأذكار، القارئ) والإغلاق جارٍ
      .fullScreenCover(isPresented: $showSearch) {
        SearchView(initialQuery: ScreenshotMode.searchQuery, openTab: { t in
          showSearch = false
          DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { switchTab(t) }
        })
        .environment(model)
        .environment(\.tabBarInset, 0)
        .environment(\.layoutDirection, .rightToLeft)
      }
      .sheet(isPresented: $showKhatmah) {
        KhatmahSheet(onGo: { p in showKhatmah = false; model.pendingReaderPage = p; switchTab(.mushaf) }).environment(model)
      }
      .navigationDestination(isPresented: $showGuard) { AdhanGuardView().environment(model).tabBarClearance() }
      .navigationDestination(isPresented: $showSettings) { SettingsView().environment(model).tabBarClearance() }
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
  private func content(now realNow: Date, topInset: CGFloat, width: CGFloat) -> some View {
    let d = todayState(realNow)
    if widthClass == .expanded {
      expandedLayout(d, width: width)
    } else {
      stackedLayout(d, topInset: topInset, width: width)
    }
  }

  private func todayState(_ realNow: Date) -> TodayState {
    let now = shotNow(realNow)
    let t = model.timeline(now: now)
    let rd = RamadanEdition.day(model, now: now)
    let fast: FastPhase = t.map { RamadanEdition.phase($0, now: now, model: model, today: rd) } ?? .off
    return TodayState(now: now, t: t, c: model.coordinates, sky: skyState(now: now, timeline: t), ramadan: rd, fast: fast)
  }

  /// لقطات رمضان بساعةٍ مفروضة (`ramadan-iftar` / `ramadan-suhoor`): تُزاح ساعة «اليوم» مرّةً ثم تتقدّم طبيعيًّا
  private func shotNow(_ real: Date) -> Date {
    guard let clock = ScreenshotMode.ramadanClock else { return real }
    if let off = ScreenshotMode.clockOffset { return real.addingTimeInterval(off) }
    guard let t = model.timeline(now: real), let fajr = t.times[.fajr], let maghrib = t.times[.maghrib] else { return real }
    let goal = clock == "suhoor" ? fajr.addingTimeInterval(-RamadanEdition.imsakSeconds(model) - 40 * 60) : maghrib.addingTimeInterval(-23 * 60)
    let off = goal.timeIntervalSince(real)
    ScreenshotMode.clockOffset = off
    return real.addingTimeInterval(off)
  }

  /// المضغوط (الهاتف — كما كان) والمتوسّط: السماء بعرضٍ كامل وتحتها البطاقات؛ في المتوسّط يتجاور الورد والحديث
  private func stackedLayout(_ d: TodayState, topInset: CGFloat, width: CGFloat) -> some View {
    let medium = widthClass == .medium
    let side: CGFloat = medium ? 24 : 20
    let pair = medium && (width - 2 * side - 16) / 2 >= 250 && d.ramadan == nil
    let coords = d.c
    return ScrollViewReader { proxy in
      ScrollView(showsIndicators: false) {
        VStack(spacing: 0) {
          hero(d, topInset: topInset, card: false, narrow: width < 360)
          VStack(spacing: 20) {
            if let t = d.t {
              if let ctx = nowContext(t, d) { nowCard(ctx) }
            } else {
              locationPrompt
            }
            quickTools
            if pair {
              HStack(alignment: .top, spacing: 16) {
                wirdArea(d).frame(maxWidth: .infinity, alignment: .top)
                hadithSection.frame(maxWidth: .infinity, alignment: .top)
              }
            } else {
              wirdArea(d)
              hadithSection
            }
            footer
          }
          .padding(.horizontal, side).padding(.top, 20)
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
      .task(id: weatherTaskID(coords)) { await refreshWeather(coords) }
    }
  }

  /// الموسّع (ipad-landscape.png): السماء ومواقيتها و«خطّ اليوم» عمودٌ ثابت في بداية الشاشة بجانب الشريط الجانبي،
  /// والبطاقات بجانبه: العنوان والتاريخ، «الآن»، الأدوات، ثم الورد والحديث متجاورين متى اتّسع العمود
  private func expandedLayout(_ d: TodayState, width: CGFloat) -> some View {
    let heroWidth = min(430, max(330, width * 0.42))
    let cardsWidth = width - 40 - 20 - heroWidth
    let pair = (cardsWidth - 16) / 2 >= 220 && d.ramadan == nil
    let coords = d.c
    return HStack(alignment: .top, spacing: 20) {
      ScrollView(showsIndicators: false) {
        VStack(spacing: 16) {
          hero(d, topInset: 10, card: true, narrow: heroWidth < 360)
          if let t = d.t { dayPlanCard(t, d) }
        }
        .padding(.vertical, 16)
      }
      .frame(width: heroWidth)
      ScrollView(showsIndicators: false) {
        VStack(spacing: 20) {
          expandedHeader(d.now)
          if let t = d.t {
            if let ctx = nowContext(t, d) { nowCard(ctx) }
          } else {
            locationPrompt
          }
          quickTools
          if pair {
            HStack(alignment: .top, spacing: 16) {
              wirdArea(d).frame(maxWidth: .infinity, alignment: .top)
              hadithSection.frame(maxWidth: .infinity, alignment: .top)
            }
          } else {
            wirdArea(d)
            hadithSection
          }
          footer
        }
        .padding(.vertical, 16)
      }
      .frame(maxWidth: .infinity)
    }
    .padding(.horizontal, 20)
    .task(id: weatherTaskID(coords)) { await refreshWeather(coords) }
  }

  private func weatherTaskID(_ c: Coordinates?) -> String { "\(model.settings.sky.weather)-\(c.map(SkyWeatherService.cellKey) ?? "-")" }
  private func refreshWeather(_ c: Coordinates?) async {
    guard model.settings.sky.weather, model.settings.sky.mode == .auto, !ScreenshotMode.active, let c else { return }
    await weather.refreshIfNeeded(around: c)
  }

  private var footer: some View {
    Text("يعمل دون اتصال، لا حساب ولا تتبّع").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).frame(maxWidth: .infinity)
  }

  /// رأس عمود البطاقات في الموسّع: «اليوم» بالكوفي يمينًا والتاريخ الميلادي يسارًا
  private func expandedHeader(_ now: Date) -> some View {
    let h = model.hijri(now: now)
    let date = "\(h.weekday) \(Fmt.shortDate(now, tz: model.timeZone, numerals: model.settings.numerals))"
    return HStack(alignment: .firstTextBaseline, spacing: 12) {
      Text("اليوم").font(DS.kufi(30, .bold)).foregroundStyle(DS.C.textPrimary).accessibilityAddTraits(.isHeader)
      Spacer(minLength: 8)
      Text(date).font(DS.F.labelMd).foregroundStyle(DS.C.textSecondary).lineLimit(1).minimumScaleFactor(0.8)
    }
  }

  // MARK: الهيرو
  /// `card`: الوضع الموسّع — بطاقةٌ بزوايا أربع داخل عمودها، بلا زرّي البحث والإعدادات (هما في الشريط الجانبي).
  /// `narrow`: عمودٌ أضيق من أيّ هاتف (ثلث Split View، ٣٢٠ نقطة) — ميداليةٌ أصغر كي لا تُقتطع كتلة الصلاة القادمة
  private func hero(_ d: TodayState, topInset: CGFloat, card: Bool, narrow: Bool) -> some View {
    let sky = d.sky
    let p = sky.palette
    let top: CGFloat = card ? 32 : 0
    let bottom: CGFloat = card ? 32 : 36
    return ZStack(alignment: .top) {
      SkyBackdrop(state: sky, reduceMotion: model.settings.sky.reduceMotion)
      VStack(alignment: .leading, spacing: 0) {
        topRow(d, palette: p, tools: !card)
        if let t = d.t, let c = d.c {
          HStack(alignment: .top, spacing: 8) {
            nextPrayerBlock(t, d, palette: p)
            Spacer(minLength: 0)
            medallionColumn(coords: c, palette: p, narrow: narrow)
          }
          .padding(.top, 12)
          prayerCard(t, d).padding(.top, 18)
        } else {
          VStack(alignment: .leading, spacing: 6) {
            Text("حدّد موقعك").font(DS.kufi(40, .bold)).foregroundStyle(p.text)
            Text("لتُحسب المواقيت والقبلة وتتبدّل السماء مع وقتك").font(DS.F.bodyMd).foregroundStyle(p.textMuted)
          }
          .padding(.top, 24).padding(.bottom, 40)
        }
      }
      .padding(.top, topInset + 6).padding(.horizontal, 16).padding(.bottom, 16)
    }
    .frame(maxWidth: .infinity)
    .clipShape(UnevenRoundedRectangle(topLeadingRadius: top, bottomLeadingRadius: bottom, bottomTrailingRadius: bottom, topTrailingRadius: top, style: .continuous))
    .animation(.easeInOut(duration: model.settings.sky.reduceMotion ? 0 : 0.8), value: sky.palette)
  }

  /// المدينة والحرارة والتاريخ الهجري (يمين)، وزرّا البحث والإعدادات الزجاجيّان (يسار) — لا جرس: التنبيهات في الإعدادات
  private func topRow(_ d: TodayState, palette p: SkyPalette, tools: Bool) -> some View {
    let s = model.settings
    let h = model.hijri(now: d.now)
    // لقطات رمضان: اليوم ليس رمضان، فيُكتب اليوم المفروض («١٢ رمضان») بدل التاريخ الحقيقي
    let dateLine: String
    if ScreenshotMode.ramadan, let r = d.ramadan {
      dateLine = "\(h.weekday)، \(Fmt.number(r.day, numerals: s.numerals)) رمضان \(Fmt.number(r.year, numerals: s.numerals))هـ"
    } else {
      dateLine = "\(h.weekday)، \(Fmt.number(h.day, numerals: s.numerals)) \(h.monthName) \(Fmt.number(h.year, numerals: s.numerals))هـ"
    }
    return HStack(alignment: .top, spacing: 10) {
      VStack(alignment: .leading, spacing: 6) {
        NavigationLink { CityPickerView().tabBarClearance() } label: {
          HStack(spacing: 6) {
            Image(systemName: "mappin").font(.system(size: 12, weight: .semibold)).foregroundStyle(p.gold)
            Text(model.location.placeName ?? "حدّد موقعك").font(DS.readex(13, .medium)).foregroundStyle(p.text).lineLimit(1)
            // حرارة المكان من طلب الطقس نفسه — تظهر متى فعّل المستخدم الطقس (اختياريّ للخصوصية)
            if s.sky.weather, let temp = weather.temperature, !ScreenshotMode.active {
              Rectangle().fill(p.textMuted.opacity(0.6)).frame(width: 1, height: 12)
              Image(systemName: SkyWeatherService.symbol(weather.current, dark: p.isDark)).font(.system(size: 12, weight: .medium)).foregroundStyle(p.textSoft)
              Text("\u{2066}\(Fmt.number(Int(temp.rounded()), numerals: s.numerals))°\u{2069}").font(DS.readex(13, .medium)).foregroundStyle(p.text).monospacedDigit()
            }
          }
          .padding(.vertical, 7).padding(.horizontal, 12)
          .frame(minHeight: 36)
          .background(p.glass, in: Capsule()).overlay(Capsule().stroke(p.glassStroke, lineWidth: 1))
          .contentShape(Capsule())
        }
        .buttonStyle(.plain).accessibilityLabel(locationLabel).accessibilityHint("يفتح اختيار المدينة")
        Text(dateLine)
          .font(DS.readex(12.5)).foregroundStyle(p.textMuted).lineLimit(1).minimumScaleFactor(0.8)
      }
      Spacer(minLength: 8)
      if tools {
        HStack(spacing: 10) {
          Button { showSearch = true } label: { glassIcon("magnifyingglass", palette: p) }
            .buttonStyle(.plain).accessibilityLabel("البحث")
          Button { showSettings = true } label: { glassIcon("slider.horizontal.3", palette: p) }
            .buttonStyle(.plain).accessibilityLabel("الإعدادات")
        }
      }
    }
  }
  /// الموقع والحرارة لقارئ الشاشة
  private var locationLabel: String {
    var l = "الموقع: " + (model.location.placeName ?? "غير محدّد")
    if model.settings.sky.weather, let t = weather.temperature { l += "، \(Int(t.rounded())) درجة" }
    return l
  }
  private func glassIcon(_ name: String, palette p: SkyPalette) -> some View {
    Circle().fill(p.glass).overlay(Circle().stroke(p.glassStroke, lineWidth: 1)).frame(width: 46, height: 46)
      .overlay(Image(systemName: name).font(.system(size: 18, weight: .medium)).foregroundStyle(p.textSoft))
      .contentShape(Circle())
  }

  /// كتلة الصلاة القادمة: عنوان ذهبي صغير، اسم الصلاة بالكوفي، وقت الأذان بأرقام كبيرة رفيعة، ثم حبّة «باقٍ …» الذهبية
  /// (العدّاد بالثواني لم يعد بطل الشاشة: الوقت نفسه أنفع، والمتبقّي بالدقائق في الحبّة)
  /// وفي رمضان يُسمّى الحدث القادم بالصوم: نهارًا «يكتمل الصوم بعد / الإفطار» بوقت المغرب، وليلًا «السحور / الإمساك»
  private func nextPrayerBlock(_ t: PrayerTimes.DayTimeline, _ d: TodayState, palette p: SkyPalette) -> some View {
    let s = model.settings
    let label: String
    let name: String
    let target: Date
    switch d.fast {
    case .fasting(_, let iftar):
      label = "يكتمل الصوم بعد"; name = "الإفطار"; target = iftar
    case .suhoor(let imsak, _):
      label = "السحور"; name = "الإمساك"; target = imsak
    case .off:
      label = "الصلاة القادمة"; name = t.next.isTomorrow ? "فجر الغد" : t.next.key.nameAr; target = t.next.time
    }
    let parts = Fmt.timeParts(target, tz: model.timeZone, hour12: s.hour12, numerals: s.numerals)
    let left = remainingText(target.timeIntervalSince(d.now))
    let spoken = d.fast == .off ? "الأذان" : "الموعد"
    return VStack(alignment: .leading, spacing: 0) {
      Text(label).font(DS.readex(13, .medium)).foregroundStyle(p.gold).lineLimit(1)
      Text(name).font(DS.kufi(34, .bold)).foregroundStyle(p.text).lineLimit(1).minimumScaleFactor(0.6)
        .padding(.top, 2)
      HStack(alignment: .firstTextBaseline, spacing: 6) {
        Text(parts.main).font(DS.F.numericHero).monospacedDigit().foregroundStyle(p.text).lineLimit(1).minimumScaleFactor(0.5)
        if let suffix = parts.suffix {
          Text(suffix).font(DS.readex(16, .medium)).foregroundStyle(p.textMuted).lineLimit(1)
        }
      }
      // حبّة المتبقّي: ذهبٌ بنصٍّ داكن في الوضعين (brandDeep داكنٌ فاتحًا وليلًا)
      Text(left).font(DS.readex(14, .semibold)).foregroundStyle(DS.C.brandDeep).lineLimit(1).minimumScaleFactor(0.8)
        .padding(.vertical, 7).padding(.horizontal, 14)
        .background(DS.C.accentGold, in: Capsule())
        .padding(.top, 6)
    }
    // بلا سقف عرض: مع ٢٠٠ نقطة كانت الحبّة تنكسر سطرين على ٦٫٩″ (قِيس في لقطة المحاكي)
    .frame(maxWidth: .infinity, alignment: .leading)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("\(label) \(name)، \(spoken) \(Fmt.time(target, tz: model.timeZone, hour12: s.hour12, numerals: s.numerals))، \(left)")
  }

  /// «باقٍ ٤٢ دقيقة» / «باقٍ ساعة و٥ دقائق» / «باقٍ ٣ ساعات و٢٠ دقيقة» — بمطابقة العدد والمعدود
  private func remainingText(_ seconds: TimeInterval) -> String {
    if seconds <= 0 { return "حان الأذان" }
    if seconds < 60 { return "باقٍ أقل من دقيقة" }
    let mins = Int((seconds / 60).rounded(.up))
    let h = mins / 60, m = mins % 60
    let mPart = counted(m, one: "دقيقة", two: "دقيقتان", few: "دقائق", many: "دقيقة")
    if h == 0 { return "باقٍ \(mPart)" }
    let hPart = counted(h, one: "ساعة", two: "ساعتان", few: "ساعات", many: "ساعة")
    return m == 0 ? "باقٍ \(hPart)" : "باقٍ \(hPart) و\(mPart)"
  }
  /// العدد والمعدود: ١ و٢ بلفظهما، ٣–١٠ بالجمع، وما فوقها بالمفرد
  private func counted(_ v: Int, one: String, two: String, few: String, many: String) -> String {
    switch v {
    case 1: return one
    case 2: return two
    case 3...10: return "\(num(v)) \(few)"
    default: return "\(num(v)) \(many)"
    }
  }
  private func num(_ v: Int) -> String { Fmt.number(v, numerals: model.settings.numerals) }

  /// الميدالية وحبّة التوجّه — بلا سطر الدرجات والبُعد (في شاشة القبلة الكاملة)
  private func medallionColumn(coords c: Coordinates, palette p: SkyPalette, narrow: Bool) -> some View {
    let q = Qibla.info(latitude: c.latitude, longitude: c.longitude)
    // المحاكي بلا مغناطيسية: في وضع اللقطات وحده يُفترض اتجاهٌ يطابق القبلة (انظر QiblaView)
    let heading = model.location.heading.map { CompassMath.trueHeading($0, at: c) } ?? (ScreenshotMode.active ? q.bearing : nil)
    let diff = heading.map { Qibla.signedDifference(target: q.bearing, reference: $0) }
    let aligned = diff.map { abs($0) <= 3 } ?? false
    return Button { showQibla = true } label: {
      VStack(spacing: 8) {
        CompassMedallion(bearing: q.bearing, heading: heading ?? 0, aligned: aligned, live: heading != nil).frame(width: narrow ? 108 : 140, height: narrow ? 108 : 140)
        qiblaChip(aligned: aligned, diff: diff, live: heading != nil, palette: p)
      }
      .frame(width: narrow ? 118 : 150)
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

  // MARK: بطاقة المواقيت الزجاجية (أسفل الهيرو)
  /// زجاجٌ داكن في الوضعين: سطر «مضى ٪ من وقت …» بشريطٍ رفيع، خمسة أعمدة والقادمة في مستطيلٍ أفتح،
  /// ثم ضمان الأذان (يمين) و«جدول الشهر» (يسار). حلّت محلّ «خطّ اليوم» وشبكة المواقيت القديمة.
  /// وفي رمضان: «مضى ٩٠٪ من صيام اليوم» نهارًا (من الفجر إلى المغرب)، والأعمدة الإمساك والظهر والعصر والإفطار والعشاء
  private func prayerCard(_ t: PrayerTimes.DayTimeline, _ d: TodayState) -> some View {
    let now = d.now
    let ramadan = d.ramadanMode
    let elapsed: (fraction: Double, pct: Int)
    let elapsedText: String
    if case .fasting(let start, let iftar) = d.fast {
      elapsed = spanShare(from: start, to: iftar, now: now)
      elapsedText = "مضى \(num(elapsed.pct))٪ من صيام اليوم"
    } else {
      elapsed = elapsedShare(t, now: now)
      elapsedText = "مضى \(num(elapsed.pct))٪ من وقت \(t.current.nameAr)"
    }
    let shape = RoundedRectangle(cornerRadius: 22, style: .continuous)
    return VStack(spacing: 10) {
      HStack(spacing: 10) {
        Text(elapsedText).font(DS.readex(12, .medium)).foregroundStyle(DS.C.textOnDark).lineLimit(1).minimumScaleFactor(0.8)
          .layoutPriority(1)
        ProgressTrack(progress: elapsed.fraction, tint: DS.C.textOnDark, track: DS.C.textOnDark.opacity(0.22), height: 3)
          .accessibilityHidden(true)
      }
      .accessibilityElement(children: .combine)
      .accessibilityLabel(elapsedText)
      HStack(spacing: 4) {
        ForEach(Self.cardPrayers, id: \.self) { p in prayerColumn(p, t, now: now, ramadan: ramadan) }
      }
      HStack(spacing: 8) {
        guardLine(t)
        Spacer(minLength: 4)
        NavigationLink { MonthTableView().environment(model).tabBarClearance() } label: {
          HStack(spacing: 3) {
            Text("جدول الشهر").font(DS.readex(12, .medium))
            Image(systemName: "chevron.forward").font(.system(size: 10, weight: .bold))
          }
          .foregroundStyle(DS.C.textOnDark)
          .frame(minHeight: 44).contentShape(Rectangle())
        }
        .buttonStyle(.plain).accessibilityLabel("جدول الشهر")
      }
    }
    .padding(.horizontal, 14).padding(.top, 14)
    .background {
      shape.fill(.ultraThinMaterial)
        .overlay(shape.fill(Color.black.opacity(0.36)))
        .environment(\.colorScheme, .dark)
    }
    .overlay(shape.stroke(Color.white.opacity(0.12), lineWidth: 1))
    .clipShape(shape)
  }

  /// نسبة ما مضى من وقت الصلاة الحالية: بين بدايتها وبداية القادمة (قبل الفجر يبدأ الوقت من عشاء الأمس)
  private func elapsedShare(_ t: PrayerTimes.DayTimeline, now: Date) -> (fraction: Double, pct: Int) {
    let todayStart: Date? = t.times[t.current].flatMap { $0 <= now ? $0 : nil }
    guard let start = todayStart ?? t.yesterdayIsha else { return (0, 0) }
    let total = t.next.time.timeIntervalSince(start)
    guard total > 0 else { return (0, 0) }
    let f = min(1, max(0, now.timeIntervalSince(start) / total))
    return (f, Int((f * 100).rounded()))
  }

  /// ما مضى بين لحظتين (نهار الصوم)
  private func spanShare(from start: Date, to end: Date, now: Date) -> (fraction: Double, pct: Int) {
    let total = end.timeIntervalSince(start)
    guard total > 0 else { return (0, 0) }
    let f = min(1, max(0, now.timeIntervalSince(start) / total))
    return (f, Int((f * 100).rounded()))
  }

  private func prayerColumn(_ p: Prayer, _ t: PrayerTimes.DayTimeline, now: Date, ramadan: Bool) -> some View {
    let s = model.settings
    let isNext = t.next.key == p
    // القادمة بوقتها الفعلي (فجر الغد بعد العشاء)، والباقية بأوقات اليوم — وعمود الإمساك قبل الفجر بإعداد المستخدم
    let base: Date? = isNext ? t.next.time : t.times[p]
    let time: Date? = (ramadan && p == .fajr) ? base.map { $0.addingTimeInterval(-RamadanEdition.imsakSeconds(model)) } : base
    let name = ramadan && p == .fajr ? "الإمساك" : (ramadan && p == .maghrib ? "الإفطار" : p.nameAr)
    let past = !isNext && (t.times[p].map { $0 <= now } ?? false)
    let parts = Fmt.timeParts(time, tz: model.timeZone, hour12: s.hour12, numerals: s.numerals)
    let shape = RoundedRectangle(cornerRadius: 14, style: .continuous)
    return VStack(spacing: 4) {
      Text(name).font(DS.readex(11.5, isNext ? .semibold : .medium)).foregroundStyle(DS.C.textOnDark.opacity(isNext ? 1 : 0.72))
      Text(parts.main).font(DS.readex(15, .semibold, fixed: true)).monospacedDigit().foregroundStyle(DS.C.textOnDark.opacity(past ? 0.6 : 1))
    }
    .lineLimit(1).minimumScaleFactor(0.75)
    .frame(maxWidth: .infinity).padding(.vertical, 9)
    .background {
      if isNext { shape.fill(Color.white.opacity(0.16)).overlay(shape.stroke(Color.white.opacity(0.24), lineWidth: 1)) }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("\(name) \(Fmt.time(time, tz: model.timeZone, hour12: s.hour12, numerals: s.numerals))\(isNext ? "، القادمة" : "")")
  }

  /// «ضمان الأذان» (المرحلة الأولى) بصياغة البطاقة: «أذان المغرب مجدول ✓»، أو حالة التحذير كما هي — يفتح الفحص
  @ViewBuilder private func guardLine(_ t: PrayerTimes.DayTimeline) -> some View {
    if let g = AdhanGuard.homeLine(model, t) {
      let text = g.ok ? "أذان \(t.next.key.nameAr) مجدول" : g.text
      Button { showGuard = true } label: {
        HStack(spacing: 5) {
          Image(systemName: g.icon).font(.system(size: 11, weight: .bold)).foregroundStyle(g.ok ? DS.C.textOnDarkMuted : DS.C.accentGold)
          Text(text).font(DS.readex(12, .medium)).foregroundStyle(g.ok ? DS.C.textOnDark : DS.C.accentGold).lineLimit(1).minimumScaleFactor(0.8)
        }
        .frame(minHeight: 44).contentShape(Rectangle())
      }
      .buttonStyle(.plain)
      .accessibilityLabel("ضمان الأذان: \(text)")
    }
  }

  // MARK: بطاقة «الآن»
  /// سياق الوقت: أذكار الصباح بعد الفجر (حتى الظهر)، والمساء بعد العصر (حتى العشاء)، والنوم بعد العشاء؛ وما بين الظهر والعصر لا شيء
  private struct NowContext { let period: String; let label: String; let hint: String?; let key: String }

  private func nowContext(_ t: PrayerTimes.DayTimeline, _ d: TodayState) -> NowContext? {
    let now = d.now
    // رمضان أوّلًا: «دعاء الإفطار» من قبل المغرب بنصف ساعة إلى بعده بعشرين دقيقة، و«السحور» في الساعة الأخيرة قبل الإمساك
    // («ليس الآن» يُخفيهما فتعود أذكار الوقت المعتادة)
    if let r = ramadanNowContext(t, d), r.key != nowDismissed { return r }
    guard let fajr = t.times[.fajr], let dhuhr = t.times[.dhuhr], let asr = t.times[.asr] else { return nil }
    let sunrise = t.times[.sunrise], maghrib = t.times[.maghrib], isha = t.times[.isha]
    let beforeIsha = isha.map { now < $0 } ?? true
    let ctx: NowContext?
    if now >= fajr && now < dhuhr {
      let early = sunrise.map { now < $0 } ?? false
      ctx = NowContext(period: "morning", label: early ? "الآن، بعد الفجر" : "الآن، وقت الضحى",
                       hint: early ? "أفضل وقتها قبل الشروق" : "وقتها إلى الظهر", key: "morning|\(Int(fajr.timeIntervalSince1970))")
    } else if now >= asr && beforeIsha {
      let late = maghrib.map { now >= $0 } ?? false
      ctx = NowContext(period: "evening", label: late ? "الآن، بعد المغرب" : "الآن، بعد العصر",
                       hint: late ? nil : "أفضل وقتها قبل المغرب", key: "evening|\(Int(asr.timeIntervalSince1970))")
    } else if let isha, now >= isha {
      ctx = NowContext(period: "sleep", label: "الآن، بعد العشاء", hint: "تُقال عند النوم", key: "sleep|\(Int(isha.timeIntervalSince1970))")
    } else if now < fajr {
      let start = t.yesterdayIsha ?? fajr
      ctx = NowContext(period: "sleep", label: "الآن، بعد العشاء", hint: "تُقال عند النوم", key: "sleep|\(Int(start.timeIntervalSince1970))")
    } else {
      ctx = nil
    }
    guard let ctx, ctx.key != nowDismissed else { return nil }
    return ctx
  }

  private func ramadanNowContext(_ t: PrayerTimes.DayTimeline, _ d: TodayState) -> NowContext? {
    if d.ramadan != nil, let maghrib = t.times[.maghrib] {
      let dt = d.now.timeIntervalSince(maghrib)
      if dt >= -30 * 60 && dt < 20 * 60 {
        return NowContext(period: "iftar", label: dt < 0 ? "الآن، قبل الإفطار" : "الآن، وقت الإفطار",
                          hint: "دعوة الصائم لا تُردّ", key: "iftar|\(Int(maghrib.timeIntervalSince1970))")
      }
    }
    if case .suhoor(let imsak, _) = d.fast, imsak.timeIntervalSince(d.now) <= 3600 {
      let s = model.settings
      let at = Fmt.time(imsak, tz: model.timeZone, hour12: s.hour12, numerals: s.numerals)
      return NowContext(period: "suhoor", label: "الآن، وقت السحور", hint: "حتى الإمساك \(at)", key: "suhoor|\(Int(imsak.timeIntervalSince1970))")
    }
    return nil
  }

  /// الأذكار بعددها وما أُتمّ منها اليوم (لا مدّة مقدَّرة: لا مصدر لها)؛ وتختفي البطاقة إن اكتملت
  @ViewBuilder private func nowCard(_ ctx: NowContext) -> some View {
    let n = model.settings.numerals
    if ctx.period == "iftar" || ctx.period == "suhoor" {
      ramadanNowCard(ctx)
    } else if ctx.period == "sleep" {
      if let ch = Hisn.chapter(28) {
        nowCardBody(ctx, title: ch.title, subtitle: "\(HisnView.countLabel(ch.items.count, numerals: n)) من حصن المسلم", progress: nil) {
          NavigationLink { HisnChapterView(chapter: ch).environment(model).tabBarClearance() } label: {
            DSButtonLabel(title: "ابدأ الأذكار", kind: .gold, icon: "chevron.forward", fill: false)
          }
          .buttonStyle(.plain)
        }
      }
    } else {
      let items = Adhkar.items(for: ctx.period)
      let prog = AdhkarSession.current(model)
      let map = (ctx.period == "evening" ? prog.evening : prog.morning) ?? [:]
      let done = items.filter { (map[$0.id] ?? 0) >= $0.target(for: ctx.period) }.count
      let total = items.count
      if total > 0 && done < total {
        let base = HisnView.countLabel(total, numerals: n)
        let subtitle = done > 0 ? "\(base) — أتممتَ \(num(done)) منها" : base
        nowCardBody(ctx, title: ctx.period == "morning" ? "أذكار الصباح" : "أذكار المساء", subtitle: subtitle,
                    progress: done > 0 ? Double(done) / Double(total) : nil) {
          Button { model.pendingAdhkarPeriod = ctx.period; switchTab(.adhkar) } label: {
            DSButtonLabel(title: done > 0 ? "أكمِل الأذكار" : "ابدأ الأذكار", kind: .gold, icon: "chevron.forward", fill: false)
          }
          .buttonStyle(.plain)
        }
      }
    }
  }

  /// رمضان: «دعاء الإفطار» بنصّه وزرّ «افتح الأدعية» (باب الدعاء عند إفطار الصائم)، أو «السحور» بحديثه
  /// وزرّ استغفار السَّحَر (لا باب لأذكار السحور في حصن المسلم؛ والأسحار وقت الاستغفار)
  @ViewBuilder private func ramadanNowCard(_ ctx: NowContext) -> some View {
    let iftar = ctx.period == "iftar"
    if let ch = Hisn.chapter(iftar ? RamadanEdition.iftarDuaChapter : RamadanEdition.suhoorChapter) {
      nowCardBody(ctx, title: iftar ? "دعاء الإفطار" : "السحور",
                  subtitle: iftar ? "«\(RamadanEdition.iftarDua)» — يُقال عند الإفطار" : "«تسحّروا فإنّ في السَّحور بركة» — متفق عليه",
                  progress: nil) {
        NavigationLink { HisnChapterView(chapter: ch).environment(model).tabBarClearance() } label: {
          DSButtonLabel(title: iftar ? "افتح الأدعية" : "استغفار السَّحَر", kind: .gold, icon: "chevron.forward", fill: false)
        }
        .buttonStyle(.plain)
      }
    }
  }

  private func nowCardBody<Action: View>(_ ctx: NowContext, title: String, subtitle: String, progress: Double?, @ViewBuilder action: () -> Action) -> some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(spacing: 8) {
        Circle().fill(DS.C.accentGold).frame(width: 7, height: 7)
        Text(ctx.label).font(DS.F.labelSm).foregroundStyle(DS.C.textPrimary).lineLimit(1)
        Spacer(minLength: 6)
        if let hint = ctx.hint { Text(hint).font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).lineLimit(1).minimumScaleFactor(0.8) }
      }
      .accessibilityElement(children: .combine)
      Text(title).font(DS.kufi(24, .bold)).foregroundStyle(DS.C.textPrimary).lineLimit(1).minimumScaleFactor(0.8)
      Text(subtitle).font(DS.F.bodySm).foregroundStyle(DS.C.textSecondary).fixedSize(horizontal: false, vertical: true)
      if let progress {
        ProgressTrack(progress: progress, tint: DS.C.accentGold, track: DS.C.bgSubtle, height: 5).padding(.top, 2).accessibilityHidden(true)
      }
      HStack(spacing: 12) {
        action()
        Spacer(minLength: 8)
        Button {
          UserDefaults.standard.set(ctx.key, forKey: "today.now.dismissed")
          withAnimation(.snappy(duration: 0.25)) { nowDismissed = ctx.key }
        } label: {
          Text("ليس الآن").font(DS.F.labelMd).foregroundStyle(DS.C.textSecondary)
            .padding(.horizontal, 8).frame(minHeight: 44).contentShape(Rectangle())
        }
        .buttonStyle(.plain).accessibilityHint("يُخفي البطاقة حتى الوقت التالي")
      }
      .padding(.top, 4)
    }
    .todayCard()
  }

  // MARK: الأدوات السريعة
  private var quickTools: some View {
    HStack(alignment: .top, spacing: 10) {
      quickTool("calendar", "التقويم") { MonthTableView().environment(model).tabBarClearance() }
      quickTool("circle.hexagongrid", "المسبحة") { TasbihView(backTitle: "اليوم").environment(model).tabBarClearance() }
      quickTool("shield", "حصن المسلم") { HisnView().environment(model).tabBarClearance() }
      quickTool("building.columns", "المساجد") { MosquesView().environment(model).tabBarClearance() }
    }
  }
  private func quickTool<Dest: View>(_ icon: String, _ title: String, @ViewBuilder destination: @escaping () -> Dest) -> some View {
    NavigationLink { destination() } label: {
      VStack(spacing: 8) {
        Image(systemName: icon).font(.system(size: 21, weight: .regular)).foregroundStyle(DS.C.brandPrimary)
          .frame(width: 60, height: 60)
          .background(DS.C.bgSurface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
          .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(DS.C.borderSubtle, lineWidth: 1))
        Text(title).font(DS.F.labelSm).foregroundStyle(DS.C.textPrimary).lineLimit(1).minimumScaleFactor(0.8)
      }
      .frame(maxWidth: .infinity).contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityLabel(title)
  }

  // MARK: ورد اليوم
  /// في رمضان تحلّ «ختمة رمضان» محلّ «ورد اليوم» (رابطها «الخطة ›» يفتح ورقة الختمة نفسها)
  @ViewBuilder private func wirdArea(_ d: TodayState) -> some View {
    if let r = d.ramadan {
      VStack(spacing: 10) {
        DSSectionHead("ختمة رمضان") {
          Button { showKhatmah = true } label: { DSLinkLabel(title: "الخطة").frame(minHeight: 44).contentShape(Rectangle()) }
            .buttonStyle(.plain).accessibilityLabel("خطة الختمة")
        }
        RamadanKhatmahCard(ramadan: r, onRead: { p in model.pendingReaderPage = p; switchTab(.mushaf) })
      }
    } else {
      wirdSection
    }
  }

  private var wirdSection: some View {
    VStack(spacing: 10) {
      DSSectionHead("ورد اليوم") {
        Button { showKhatmah = true } label: { DSLinkLabel(title: "الختمة").frame(minHeight: 44).contentShape(Rectangle()) }
          .buttonStyle(.plain).accessibilityLabel("خطة الختمة")
      }
      wirdCard
    }
  }

  @ViewBuilder private var wirdCard: some View {
    if let plan = model.quran.khatmah {
      let stt = Khatmah.status(plan, wird: model.quran.wird, today: model.todayKey)
      if stt.finished { readingCard(finished: true) } else { khatmahCard(plan, stt) }
    } else {
      readingCard(finished: false)
    }
  }

  /// بخطة ختمة: سورة الموضع التالي، جزؤه وآيته، وما بقي من ورد اليوم، ونسبة الختمة — «تابع القراءة» على صفحة الورد
  private func khatmahCard(_ plan: KhatmahPlan, _ stt: KhatmahStatus) -> some View {
    let next = ((plan.startPage - 1 + stt.done) % Khatmah.total) + 1
    let first: Ayah? = wirdAyah.flatMap { $0.page == next ? $0 : nil }
    let surah = first.map { QuranMeta.surah($0.surah).name } ?? QuranMeta.firstSurah(onPage: next).name
    let left = max(0, stt.todayTarget - stt.todayPages)
    let place = first.map { "الجزء \(num($0.juz))، من الآية \(num($0.ayah))" } ?? "الجزء \(num(QuranMeta.juz(ofPage: next)))، الصفحة \(num(next))"
    let today = left > 0 ? "باقٍ \(counted(left, one: "صفحة واحدة", two: "صفحتان", few: "صفحات", many: "صفحة"))" : "أتممتَ ورد اليوم ✓"
    return VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .top, spacing: 12) {
        VStack(alignment: .leading, spacing: 4) {
          Text("سورة \(surah)").font(DS.readex(19, .bold)).foregroundStyle(DS.C.textPrimary).lineLimit(1).minimumScaleFactor(0.8)
          Text("\(place) — \(today)").font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary).lineLimit(2).minimumScaleFactor(0.85)
        }
        Spacer(minLength: 8)
        Text("\(num(stt.percent))٪").font(DS.readex(30, .medium, fixed: true)).monospacedDigit().foregroundStyle(DS.C.brandPrimary)
          .accessibilityLabel("الختمة \(stt.percent) بالمئة")
      }
      ProgressTrack(progress: Double(stt.percent) / 100, tint: DS.C.brandPrimary, track: DS.C.bgSubtle, height: 6).accessibilityHidden(true)
      Button { model.pendingReaderPage = next; switchTab(.mushaf) } label: {
        DSButtonLabel(title: "تابع القراءة", kind: .primary, icon: "chevron.forward")
      }
      .buttonStyle(.plain)
    }
    .todayCard()
    .task(id: next) {
      let page = next
      let a = await Task.detached(priority: .utility) { QuranText.shared.pageAyahs(page).first }.value
      wirdAyah = a
    }
  }

  /// بلا خطة (أو بعد إتمامها): متابعة القراءة من آخر صفحة، بلا نسبة، ورابطٌ هادئ لبدء ختمة
  private func readingCard(finished: Bool) -> some View {
    let last = model.settings.lastRead
    let page = last?.page ?? 1
    let title = last.map { "سورة \(QuranMeta.surah($0.surah).name)" } ?? "سورة الفاتحة"
    let line = last.map { "الجزء \(num(QuranMeta.juz(ofPage: $0.page)))، الآية \(num($0.ayah)) — الصفحة \(num($0.page))" } ?? "مصحف المدينة، حفص عن عاصم"
    return VStack(alignment: .leading, spacing: 12) {
      VStack(alignment: .leading, spacing: 4) {
        if finished { Text("تقبّل الله، أتممتَ الختمة ✦").font(DS.F.labelSm).foregroundStyle(DS.C.accentGoldStrong) }
        Text(title).font(DS.readex(19, .bold)).foregroundStyle(DS.C.textPrimary).lineLimit(1).minimumScaleFactor(0.8)
        Text(line).font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary).lineLimit(2).minimumScaleFactor(0.85)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      Button { model.pendingReaderPage = page; switchTab(.mushaf) } label: {
        DSButtonLabel(title: last == nil ? "افتح المصحف" : "تابع القراءة", kind: .primary, icon: "chevron.forward")
      }
      .buttonStyle(.plain)
      Button { showKhatmah = true } label: {
        Text(finished ? "ابدأ ختمة جديدة" : "ابدأ خطة ختمة تقسّم المصحف على أيامك").font(DS.F.labelSm).foregroundStyle(DS.C.brandPrimary)
          .frame(maxWidth: .infinity).frame(minHeight: 44).contentShape(Rectangle())
      }
      .buttonStyle(.plain)
    }
    .todayCard()
  }

  // MARK: حديث اليوم
  private var hadithSection: some View {
    VStack(spacing: 10) {
      DSSectionHead("حديث اليوم") {
        NavigationLink { HadithView(initialBook: "nawawi", embedded: true).environment(model).tabBarClearance() } label: {
          DSLinkLabel(title: "الأربعون").frame(minHeight: 44).contentShape(Rectangle())
        }
        .buttonStyle(.plain).accessibilityLabel("الأربعون النووية")
      }
      TodayHadithCard()
    }
  }

  // MARK: خطّ اليوم (الوضع الموسّع — تحت السماء في عمودها)
  /// صفّ في «خطّ اليوم»: الوقت، وعبادته، وحاله (مضى، الآن، القادمة، لاحق)
  private struct PlanRow: Identifiable {
    enum Kind { case past, now, next, later }
    let id: String
    let name: String
    let time: String
    let note: String
    let done: Bool
    let kind: Kind
  }
  /// وقتٌ قبل ترتيبه في «خطّ اليوم»
  private struct PlanItem {
    let key: String
    let at: Date?
    let name: String
    let note: String
    let done: Bool
    let prayer: Prayer?
  }

  /// عبادة كلّ وقت على مدار اليوم (ipad-landscape.png): أذكار الصباح بعد الفجر، الضحى، الصلوات وما سُجّل منها
  /// («صلّيتُ» من النشاط المباشر)، صفّ «الآن» في موضعه، المتبقّي إلى القادمة، ورد الختمة بعد العشاء، وأذكار النوم
  private func dayPlanCard(_ t: PrayerTimes.DayTimeline, _ d: TodayState) -> some View {
    let rows = dayPlanRows(t, d)
    return VStack(alignment: .leading, spacing: 2) {
      HStack(alignment: .firstTextBaseline) {
        Text("خطّ اليوم").font(DS.F.headingMd).foregroundStyle(DS.C.textPrimary).accessibilityAddTraits(.isHeader)
        Spacer(minLength: 8)
        Text("عبادة كلّ وقت").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
      }
      .padding(.bottom, 8)
      ForEach(rows) { r in planRow(r) }
    }
    .todayCard()
  }

  private func planRow(_ r: PlanRow) -> some View {
    let isNow = r.kind == .now
    let isNext = r.kind == .next
    let dot: Color = r.kind == .past ? DS.C.brandPrimary : (isNow ? DS.C.accentGold : (isNext ? Color.clear : DS.C.borderStrong))
    return HStack(spacing: 10) {
      Circle().fill(dot)
        .overlay(Circle().stroke(isNext ? DS.C.brandPrimary : Color.clear, lineWidth: 1.5))
        .frame(width: 8, height: 8)
      Text(r.name).font(DS.readex(14, isNow || isNext ? .semibold : .medium)).foregroundStyle(DS.C.textPrimary).lineLimit(1)
      if !r.time.isEmpty {
        Text(r.time).font(DS.readex(13, .medium, fixed: true)).monospacedDigit().foregroundStyle(DS.C.textSecondary).lineLimit(1)
      }
      Spacer(minLength: 6)
      if r.done { Image(systemName: "checkmark").font(.system(size: 11, weight: .bold)).foregroundStyle(DS.C.brandPrimary) }
      Text(r.note).font(DS.F.labelSm).foregroundStyle(isNext ? DS.C.brandPrimary : DS.C.textSecondary).lineLimit(1).minimumScaleFactor(0.8)
    }
    .padding(.vertical, 8).padding(.horizontal, 8)
    .background { if isNow { RoundedRectangle(cornerRadius: 12, style: .continuous).fill(DS.C.accentGoldSoft) } }
    .accessibilityElement(children: .combine)
  }

  private func dayPlanRows(_ t: PrayerTimes.DayTimeline, _ d: TodayState) -> [PlanRow] {
    let s = model.settings
    let now = d.now
    let day = DayKey.key(now, tz: model.timeZone)
    func clock(_ x: Date?) -> String { Fmt.timeParts(x, tz: model.timeZone, hour12: s.hour12, numerals: s.numerals).main }
    func prayed(_ p: Prayer) -> Bool { UserDefaults.standard.bool(forKey: PrayedLog.key(day: day, prayer: p.rawValue)) }
    let ramadan = d.ramadan != nil
    // الأوقات بترتيبها؛ «قبل النوم» بلا وقت فيبقى آخرًا
    var items: [PlanItem] = []
    items.append(PlanItem(key: "fajr", at: t.times[.fajr], name: Prayer.fajr.nameAr, note: "أذكار الصباح", done: adhkarComplete("morning"), prayer: Prayer.fajr))
    items.append(PlanItem(key: "duha", at: t.times[.sunrise].map { $0.addingTimeInterval(15 * 60) }, name: "الضحى", note: "صلاة الضحى", done: false, prayer: nil))
    for p in [Prayer.dhuhr, Prayer.asr] {
      items.append(PlanItem(key: p.rawValue, at: t.times[p], name: p.nameAr, note: prayed(p) ? "صلّيتَ" : "", done: prayed(p), prayer: p))
    }
    let maghribNote: String = prayed(.maghrib) ? "صلّيتَ" : (ramadan ? "دعاء الإفطار" : "أذكار المساء")
    items.append(PlanItem(key: "maghrib", at: t.times[.maghrib], name: ramadan ? "الإفطار" : Prayer.maghrib.nameAr, note: maghribNote, done: prayed(.maghrib), prayer: Prayer.maghrib))
    var ishaNote: String = prayed(.isha) ? "صلّيتَ" : ""
    if let plan = model.quran.khatmah {
      let stt = Khatmah.status(plan, wird: model.quran.wird, today: model.todayKey)
      let left = max(0, stt.todayTarget - stt.todayPages)
      if left > 0 && !stt.finished { ishaNote = "ورد الختمة: " + counted(left, one: "صفحة واحدة", two: "صفحتان", few: "صفحات", many: "صفحة") }
    }
    items.append(PlanItem(key: "isha", at: t.times[.isha], name: Prayer.isha.nameAr, note: ishaNote, done: prayed(.isha), prayer: Prayer.isha))

    var nowNote = ""
    if let r = AdhkarNowRule.period(now: now, fajr: t.times[.fajr], dhuhr: t.times[.dhuhr], asr: t.times[.asr], isha: t.times[.isha]), !r.upcoming {
      nowNote = AdhkarNowRule.title(r.period)
    }
    let nowRow = PlanRow(id: "now", name: "الآن", time: clock(now), note: nowNote, done: false, kind: .now)
    var rows: [PlanRow] = []
    var placedNow = false
    for it in items {
      let passed = it.at.map { $0 <= now } ?? false
      if !passed && !placedNow { rows.append(nowRow); placedNow = true }
      let isNext = !passed && !t.next.isTomorrow && it.prayer == t.next.key
      let note: String = isNext ? "بعد " + afterText(t.next.time.timeIntervalSince(now)) : it.note
      let kind: PlanRow.Kind = passed ? .past : (isNext ? .next : .later)
      rows.append(PlanRow(id: it.key, name: it.name, time: clock(it.at), note: note, done: it.done && !isNext, kind: kind))
    }
    if !placedNow { rows.append(nowRow) }
    rows.append(PlanRow(id: "sleep", name: "قبل النوم", time: "", note: "أذكار النوم وسورة الملك", done: false, kind: .later))
    return rows
  }

  /// «٤٢ دقيقة» / «ساعتين» / «٣ ساعات» — بعد «بعد» (جرّ)
  private func afterText(_ seconds: TimeInterval) -> String {
    let mins = max(1, Int((seconds / 60).rounded(.up)))
    if mins < 60 { return counted(mins, one: "دقيقة", two: "دقيقتين", few: "دقائق", many: "دقيقة") }
    let h = Int((Double(mins) / 60).rounded())
    return counted(h, one: "ساعة", two: "ساعتين", few: "ساعات", many: "ساعة")
  }

  /// أذكار فترةٍ أُتمّت اليوم (القاعدة نفسها في بطاقة «الآن»)
  private func adhkarComplete(_ period: String) -> Bool {
    let items = Adhkar.items(for: period)
    guard !items.isEmpty else { return false }
    let prog = AdhkarSession.current(model)
    let map = (period == "evening" ? prog.evening : prog.morning) ?? [:]
    return items.allSatisfy { (map[$0.id] ?? 0) >= $0.target(for: period) }
  }

  // MARK: لا موقع بعد
  private var locationPrompt: some View {
    VStack(spacing: 14) {
      DSIcon(systemName: "location.circle", style: .soft, size: 72, iconSize: 32)
      Text("حدّد موقعك لحساب المواقيت والقبلة").font(DS.F.headingLg).foregroundStyle(DS.C.textPrimary).multilineTextAlignment(.center)
      Text("يُستخدم الموقع على جهازك فقط لحساب المواقيت واتجاه القبلة، ولا يُرسل إلى أي خادم.").font(DS.F.bodyMd).foregroundStyle(DS.C.textSecondary).multilineTextAlignment(.center)
      if let e = model.location.errorMessage { Text(e).font(DS.F.bodySm).foregroundStyle(DS.C.danger).multilineTextAlignment(.center) }
      DSButton(title: "استخدام موقع الجهاز", icon: "location.fill") { model.location.requestLocation() }
      NavigationLink { CityPickerView().tabBarClearance() } label: { DSButtonLabel(title: "اختيار مدينة يدويًا — ٦٤٩ مدينة", kind: .outline, icon: "magnifyingglass") }.buttonStyle(.plain)
    }
    .frame(maxWidth: .infinity)
    .dsCard(padding: 24)
  }
}

/// بطاقة سطحٍ بحدٍّ خفيف بلا ظلّ (بطاقات «اليوم» تحت الهيرو كما في التصميم — وبطاقة «ختمة رمضان»)
extension View {
  func todayCard(padding: CGFloat = 18) -> some View {
    self.padding(padding)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(DS.C.bgSurface, in: RoundedRectangle(cornerRadius: DS.Radius.xl, style: .continuous))
      .overlay(RoundedRectangle(cornerRadius: DS.Radius.xl, style: .continuous).stroke(DS.C.borderSubtle, lineWidth: 1))
  }
}

/// بطاقة حديث اليوم (اليوم والمكتبة — المرحلة الخامسة تعيد استعمالها): النصّ يفتح الأحاديث، والتخريج،
/// وحفظ في المفضّلة ومشاركة. تحتاج NavigationStack فوقها (كلا الموضعين داخل واحد)
struct TodayHadithCard: View {
  @Environment(AppModel.self) private var model
  @State private var share: ShareItems?
  var body: some View {
    let h = HadithLibrary.hadithOfDay(Date(), tz: model.timeZone)
    let fav = model.content.favorites.contains(h.id)
    let shareText = "\(h.text)\n\nرواه \(h.narrator) — \(h.reference) (\(h.grade))"
    VStack(alignment: .leading, spacing: 14) {
      NavigationLink { HadithView(embedded: true).environment(model).tabBarClearance() } label: {
        Text("«\(h.text)»").font(DS.amiri(19)).lineSpacing(8).foregroundStyle(DS.C.textPrimary)
          .multilineTextAlignment(.leading).lineLimit(6)
          .frame(maxWidth: .infinity, alignment: .leading).contentShape(Rectangle())
      }
      .buttonStyle(.plain).accessibilityHint("يفتح الأحاديث")
      HStack(spacing: 10) {
        Text("\(h.grade)، عن \(h.narrator)").font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary).lineLimit(2).minimumScaleFactor(0.85)
        Spacer(minLength: 8)
        circleButton(fav ? "bookmark.fill" : "bookmark", label: fav ? "إزالة من المفضلة" : "حفظ في المفضلة", on: fav) { model.content.toggleFavorite(h.id) }
        circleButton("square.and.arrow.up", label: "مشاركة الحديث") { share = ShareItems(items: [shareText]) }
      }
    }
    .todayCard()
    .sheet(item: $share) { ShareSheet(items: $0.items) }
  }
  private func circleButton(_ icon: String, label: String, on: Bool = false, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Image(systemName: icon).font(.system(size: 15, weight: .medium)).foregroundStyle(on ? DS.C.brandPrimary : DS.C.textPrimary)
        .frame(width: 44, height: 44)
        .background(DS.C.bgSurface, in: Circle())
        .overlay(Circle().stroke(DS.C.borderSubtle, lineWidth: 1))
        .contentShape(Circle())
    }
    .buttonStyle(.plain).accessibilityLabel(label)
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
