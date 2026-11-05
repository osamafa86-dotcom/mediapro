import Foundation
import SakinahCore

/// وضع لقطات المتجر: يُشغَّل بوسيط إقلاع وحده، فلا أثر له في نسخة المستخدم.
///
/// لقطات App Store **يجب أن تكون من التطبيق نفسه** (‏Guideline 2.3.3)، ولا تكفي
/// صورٌ من نسخة الويب لأن واجهتها ليست هذه الواجهة. وقيادة الواجهة باختبار
/// XCUITest تعني كتابة مُحدِّدات لنصوصٍ عربية تتغيّر — فالأضبط أن يفتح التطبيق
/// نفسه الشاشةَ المطلوبة مباشرةً، والوسيط هو الطريق المعتاد لذلك في iOS.
///
/// يُقرأ الوسيط بصيغة `-sakinahShot <route>` لأن UserDefaults تلتقط أزواج
/// `-مفتاح قيمة` من وسائط الإقلاع تلقائياً.
enum ScreenshotMode {
  /// المسار المطلوب، أو nil في التشغيل العادي
  static let route: String? = {
    guard let r = UserDefaults.standard.string(forKey: "sakinahShot"), !r.isEmpty else { return nil }
    return r
  }()
  static var active: Bool { route != nil }

  /// التبويب الذي يُفتح عليه التطبيق
  static var tab: AppTab? {
    switch route {
    case "prayer", "qibla", "qibla-sun", "qibla-map", "home", "home-bottom", "sky-settings", "search", "settings", "ramadan", "ramadan-iftar", "ramadan-suhoor": return .home
    case "mushaf", "mushaf-juz", "mushaf-switch", "mushaf-bookmarks", "mushaf-ayah-bookmark", "mushaf-page", "mushaf-bar", "mushaf-ayah", "mushaf-nav", "mushaf-khatmah", "mushaf-display", "mushaf-hifz", "mushaf-spread", "review-ayahs": return .mushaf
    case "adhkar", "hisn", "tasbih": return .adhkar
    // «more» يبقى اسمًا للمسار القديم في سير اللقطات — التبويب صار «المكتبة»
    case "hadith", "more", "library": return .library
    default: return nil
    }
  }

  /// الصفحة التي يُفتح عليها قارئ المصحف، إن كان المسار يطلب القارئ
  static var readerPage: Int? {
    // «mushaf-spread» (المرحلة الرابعة): الفاتحة وأول البقرة متقابلتين على الآيباد أفقيًّا (mushaf-ipad-spread-v3.png)
    if route == "mushaf-spread" { return 1 }
    return ["mushaf-page", "mushaf-bar", "mushaf-ayah", "mushaf-ayah-bookmark", "mushaf-nav", "mushaf-display", "mushaf-hifz"].contains(route ?? "") ? 270 : nil
  }

  /// يُبقى الشريط ظاهرًا: القارئ يخفيه بعد ثوانٍ، فلا يلتقطه انتظارُ تحميل الخطوط
  static var keepChrome: Bool { route == "mushaf-bar" || route == "mushaf-ayah" || route == "mushaf-ayah-bookmark" }
  /// لقطات المصحف v2: آية محدّدة مع رصيفها، ورقة مفتوحة في القارئ، جلسة إخفاء للحفظ، وورقة الختمة في المكتبة
  static var readerSelectsAyah: Bool { route == "mushaf-ayah" || route == "mushaf-ayah-bookmark" }
  /// لقطة تحقّق: ورقة ملاحظة العلامة ولونها (زرّ «علامة» في الرصيف يحفظ بنقرة واحدة؛ الورقة من «ملاحظة» في خيارات الآية)
  static var readerBookmarkSheet: Bool { route == "mushaf-ayah-bookmark" }
  /// لقطة تحقّق: تبديل تبويب الفهرس بعد الظهور (السور → الأجزاء) بالمسار نفسه الذي يسلكه النقر
  static var switchLibraryTab: Bool { route == "mushaf-switch" }
  static var readerSheet: ReaderSheet? { switch route { case "mushaf-nav": return .quickNav; case "mushaf-display": return .display; default: return nil } }
  static var readerHifz: Bool { route == "mushaf-hifz" }
  static var librarySheet: Bool { route == "mushaf-khatmah" }
  /// تبويب الفهرس الذي تُفتح عليه المكتبة (الأجزاء في لقطة التحقّق من تبديل التبويبات)
  static var libraryTab: Int { route == "mushaf-juz" ? 1 : (route == "mushaf-bookmarks" ? 3 : 0) }
  /// مسار «qibla» يفتح القبلة الكاملة فوق الرئيسية — و«qibla-sun» و«qibla-map» على تبويبَي الشمس والخريطة (المرحلة الخامسة)
  static var fullQibla: Bool { route == "qibla" || route == "qibla-sun" || route == "qibla-map" }
  /// تبويب شاشة القبلة الذي تُفتح عليه: ٠ البوصلة، ١ الشمس، ٢ الخريطة
  static var qiblaMode: Int { route == "qibla-sun" ? 1 : (route == "qibla-map" ? 2 : 0) }
  /// مسار «tasbih» يفتح شاشة المسبحة فوق «الذكر»
  static var openTasbih: Bool { route == "tasbih" }
  /// مسار «review-ayahs» يفتح «للمراجعة» (الآيات الموسومة ضعيفة) فوق «القرآن»
  static var reviewAyahs: Bool { route == "review-ayahs" }
  /// مسار «sky-settings» (تشخيصي): يفتح شاشة «مظهر السماء» فوق الرئيسية للتحقّق البصري منها
  static var skySettings: Bool { route == "sky-settings" }
  /// مسار «search» (تشخيصي): يفتح البحث الشامل فوق «اليوم» مكتوبًا فيه «الصبر» كما في التصميم
  static var search: Bool { route == "search" }
  static var searchQuery: String { route == "search" ? "الصبر" : "" }
  /// مسار «settings» (تشخيصي): يفتح الإعدادات من رأس «اليوم»
  static var settings: Bool { route == "settings" }
  /// مسار «home-bottom» (تشخيصي لا للمتجر): يمرّر الرئيسية إلى آخرها كي تُرى آخر بطاقة فوق الشريط العائم
  /// — لقطة أعلى الصفحة لا تكشف تغطية الشريط لآخر بطاقة (قِيس في ثلاثة بناءات على جهاز المالك)
  static var scrollToBottom: Bool { route == "home-bottom" }
  /// طبعة رمضان مفروضة (المرحلة الرابعة): اليوم ليس رمضان، فتُفرض «١٢ رمضان» بمواقيت اليوم الحقيقية
  /// — `ramadan` بالساعة الحقيقية، و`ramadan-iftar` قبل المغرب بـ٢٣ دقيقة (دعاء الإفطار)، و`ramadan-suhoor` قبل الإمساك بأربعين
  static var ramadan: Bool { route == "ramadan" || route == "ramadan-iftar" || route == "ramadan-suhoor" }
  static var ramadanClock: String? { route == "ramadan-iftar" ? "iftar" : (route == "ramadan-suhoor" ? "suhoor" : nil) }
  /// إزاحة ساعة «اليوم» في مساري الساعة المفروضة — تُحسب مرّةً من أوّل رسم ثم تتقدّم الساعة طبيعيًّا
  static var clockOffset: TimeInterval?
  /// لقطات التحقّق من نظام السماء: فرض طور (`-sakinahSky dhuhr`) وطقس (`-sakinahWeather rain`) — لا أثر لهما في التشغيل العادي
  static let skyPhase: SkyPhase? = UserDefaults.standard.string(forKey: "sakinahSky").flatMap { SkyPhase(rawValue: $0) }
  static let skyWeather: SkyWeather? = UserDefaults.standard.string(forKey: "sakinahWeather").flatMap { SkyWeather(rawValue: $0) }

  /// موقع ثابت كي تُحسب المواقيت والقبلة بلا إذنٍ ولا شبكة — واللقطات تتكرّر بالنتيجة نفسها
  static func seed(_ model: AppModel) {
    guard active else { return }
    model.settings.seenIntro = true
    // أرقام عربية-هندية: إعدادٌ يختاره المستخدم فعلاً، وصفحة المتجر عربية،
    // وصفحة المصحف نفسها ترقّم بها — فالخلط بين ٢٧٠ في الصفحة و270 في الشريط
    // يظهر في اللقطة تنافرًا لا داعي له.
    model.settings.numerals = "arab"
    if let c = CityDatabase.bundled.city(id: "jo-amman") { model.location.useCity(c) }
    // بطاقة «أقرب مسجد» مفعّلة: سير اللقطات يمنح المحاكي إذن الموقع وموقعًا محاكى (simctl privacy/location)
    // فتبحث البطاقة حول قراءة الجهاز كما عند المستخدم، وبلا ذلك تعرض طلب الإذن — وكلاهما يُتحقّق منه
    model.settings.nearbyMosques = true
    // ورقة الختمة والمكتبة تحتاجان خطةً وسجلّ ورد كي تُظهرا حالةً حقيقية: خطة ٣٠ يومًا بدأت قبل خمسة أيام وورد ٢١ صفحة في أربعة منها
    // لقطة تحقّق العلامات: علامتان تُحفظان بالمسار نفسه الذي يسلكه زرّ «علامة» وورقة الملاحظة
    if route == "mushaf-bookmarks", let a1 = QuranText.shared.ayah(surah: 2, ayah: 255), let a2 = QuranText.shared.ayah(surah: 16, ayah: 27) {
      model.quran.setBookmark(a1, note: "آية الكرسي", color: "gold"); model.quran.setBookmark(a2, note: nil, color: "green")
    }
    // ختمة رمضان: خطة ثلاثين يومًا بدأت قبل أحد عشر يومًا (اليوم ١٢)، ٢١ صفحة في كل يومٍ مضى و١٢ اليوم (ثلاث شرائح من خمس)
    if ramadan {
      let today = model.todayKey
      let plan = KhatmahPlan(startPage: 1, startedAt: DayKey.adding(today, days: -11), days: 30, reminder: "after:isha")
      var log: WirdLog = [:]
      var page = 0
      for d in -11...0 {
        for _ in 0..<(d == 0 ? 12 : 21) { page += 1; log = Wird.mark(log, today: DayKey.adding(today, days: d), page: page, startPage: 1) }
      }
      RamadanEdition.markRamadanPlan(plan)
      model.quran.khatmah = plan
      model.quran.wird = log
    }
    // «للمراجعة»: أربع آيات موسومة ضعيفة (الأرقام المتسلسلة من المتن نفسه)
    if route == "review-ayahs" {
      model.quran.weakAyahs = [(2, 255), (2, 286), (18, 10), (67, 2)].compactMap { QuranText.shared.ayah(surah: $0.0, ayah: $0.1)?.n }
    }
    // المسبحة و«الذكر»: سجلّ أسبوعٍ للمسبحة، وحضورٌ في أيامٍ من الأسبوع، ومفضّلةٌ تُرى في قسمها
    if route == "tasbih" || route == "adhkar" {
      let today = model.todayKey
      var daily: [String: Int] = [:]
      for (d, v) in [(-6, 180), (-5, 330), (-4, 0), (-3, 99), (-2, 240), (-1, 410), (0, 240)] { daily[DayKey.adding(today, days: d)] = v }
      model.content.tasbihDaily = daily
      // الإحصاء بمسار النقر نفسه (بنية الإحصاء في النواة بلا مُهيِّئ عامّ): ١٢٬١٦٠ قبل اليوم و٢٤٠ اليوم
      var st = TasbihState()
      st.target = 0
      let before = DayKey.adding(today, days: -1)
      for _ in 0..<12_160 { st = Tasbih.tap(st, today: before).state }
      for _ in 0..<240 { st = Tasbih.tap(st, today: today).state }
      st.target = 33; st.count = 23; st.rounds = 1
      model.content.tasbih = st
      var log: AdhkarLog = [:]
      for d in WeekKeys.saturdayWeek(containing: today) where d <= today && d != DayKey.adding(today, days: -1) { log[d] = ["morning"] }
      model.content.adhkarLog = log
      model.content.favorites = ["dhikr:a01"]
      model.content.hisnFavorites = [34, 129]
    }
    if route == "mushaf-khatmah" || route == "mushaf" {
      let today = model.todayKey
      model.quran.khatmah = KhatmahPlan(startPage: 1, startedAt: DayKey.adding(today, days: -5), days: 30, reminder: "after:isha")
      var log: WirdLog = [:]
      for (i, d) in [-5, -4, -3, -1, 0].enumerated() { for p in (i * 21 + 1)...((i + 1) * 21) { log = Wird.mark(log, today: DayKey.adding(today, days: d), page: p, startPage: 1) } }
      model.quran.wird = log
      model.settings.lastRead = LastRead(page: 106, surah: 5, ayah: 1, at: Date().timeIntervalSince1970 * 1000)
      model.quran.pushRecent(QuranText.shared.ayah(surah: 5, ayah: 1)!); model.quran.pushRecent(QuranText.shared.ayah(surah: 18, ayah: 10)!)
    }
  }
}
