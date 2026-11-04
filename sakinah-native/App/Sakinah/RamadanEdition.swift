import SwiftUI
import SakinahCore

// MARK: - طبعة رمضان (المرحلة الرابعة — ramadan-today.png)
// تظهر حين يكون الشهر الهجري رمضان بحساب التطبيق نفسه (أم القرى مع إزاحة المستخدم ±يومين)، أو في وضع اللقطات
// `ramadan` (اليوم ليس رمضان: يُفرض «١٢ رمضان» بمواقيت اليوم الحقيقية). مؤجَّل عمدًا: العشر الأواخر والوتر، زكاة الفطر،
// ملخّص آخر الشهر، وربط أيام العذر بسجلّ العبادات.

/// يومٌ من رمضان: رقمه في الشهر، وطول الشهر (٢٩ أو ٣٠)، والسنة، ومفتاح اليوم المدني لربط أيام الشهر بسجلّ الورد
struct RamadanDay: Equatable {
  let day: Int
  let monthLength: Int
  let year: Int
  let todayKey: String
  /// ما بقي من الشهر بما فيه اليوم
  var daysLeft: Int { max(1, monthLength - day + 1) }
  /// مفتاح اليوم المدني ليومٍ من الشهر (١…٣٠)
  func key(ofDay d: Int) -> String { DayKey.adding(todayKey, days: d - day) }
  func inLastTen(_ d: Int) -> Bool { d > monthLength - 10 }
}

/// طور الصوم في لحظة: نهار الصوم (الفجر → المغرب)، أو السحور (بعد العشاء حتى الإمساك قبل فجر يومٍ من رمضان)، أو لا شيء
enum FastPhase: Equatable {
  case fasting(start: Date, iftar: Date)
  case suhoor(imsak: Date, fajr: Date)
  case off
}

enum RamadanEdition {
  /// باب «الدعاء عند إفطار الصائم» في حصن المسلم، و«الاستغفار والتوبة» لوقت السَّحَر
  static let iftarDuaChapter = SakinahURL.iftarDuaChapter
  static let suhoorChapter = 129
  static let iftarDua = "ذهب الظمأ وابتلّت العروق، وثبت الأجر إن شاء الله"
  /// خيارات «الإمساك قبل الفجر» بالدقائق (الافتراضي ١٠)
  static let imsakChoices = [0, 5, 10, 15]

  // ذاكرة يومٍ واحد: «اليوم» يُرسم كل ثانية، وطول الشهر يحتاج حساب ما بقي من أيامه
  private static var cachedKey = ""
  private static var cachedDay: RamadanDay?

  /// اليوم من رمضان؟ بحساب التطبيق الهجري وإزاحة المستخدم — أو مفروضًا في وضع اللقطات
  static func day(_ model: AppModel, now: Date) -> RamadanDay? {
    let tz = model.timeZone
    let offset = model.settings.hijriOffset
    let todayKey = DayKey.key(now, tz: tz)
    let cacheKey = "\(todayKey)|\(offset)|\(tz.identifier)|\(ScreenshotMode.ramadan)"
    if cacheKey == cachedKey { return cachedDay }
    let h = model.hijri(now: now)
    var result: RamadanDay? = nil
    if ScreenshotMode.ramadan {
      result = RamadanDay(day: 12, monthLength: 30, year: h.month > 9 ? h.year + 1 : h.year, todayKey: todayKey)
    } else if h.month == 9 {
      let left = Hijri.daysUntilEndOfRamadan(from: now, tz: tz, offsetDays: offset)
      result = RamadanDay(day: h.day, monthLength: max(h.day, min(30, h.day - 1 + left)), year: h.year, todayKey: todayKey)
    }
    cachedKey = cacheKey; cachedDay = result
    return result
  }

  /// طور الصوم من جدول اليوم: النهار بين الفجر والمغرب في يومٍ من رمضان، والسحور بعد العشاء حتى الإمساك
  /// إن كان الفجر القادم فجرَ يومٍ من رمضان (فتشمل ليلةَ أوّل يوم، ولا تشمل ليلة العيد)
  static func phase(_ t: PrayerTimes.DayTimeline, now: Date, model: AppModel, today: RamadanDay?) -> FastPhase {
    if today != nil, let fajr = t.times[.fajr], let maghrib = t.times[.maghrib], now >= fajr, now < maghrib {
      return .fasting(start: fajr, iftar: maghrib)
    }
    if t.next.key == .fajr, !t.next.isYesterday {
      let fajr = t.next.time
      let imsak = fajr.addingTimeInterval(-imsakSeconds(model))
      if now < imsak, isFastDay(fajr, model) { return .suhoor(imsak: imsak, fajr: fajr) }
    }
    return .off
  }

  static func imsakSeconds(_ model: AppModel) -> TimeInterval { Double(max(0, model.settings.imsakOffset)) * 60 }

  /// هل يقع هذا الفجر في يومٍ من رمضان (بإزاحة المستخدم)؟ وفي وضع اللقطات: نعم دائمًا
  private static func isFastDay(_ fajr: Date, _ model: AppModel) -> Bool {
    if ScreenshotMode.ramadan { return true }
    return Hijri.isRamadan(fajr, tz: model.timeZone, offsetDays: model.settings.hijriOffset)
  }

  /// «١٠ دقائق» / «٥ دقائق» / «عند الفجر» — لصفّ الإعدادات
  static func imsakLabel(_ minutes: Int, numerals: String) -> String {
    switch minutes {
    case ...0: return "عند أذان الفجر"
    case 1: return "دقيقة قبل الفجر"
    case 2: return "دقيقتان قبل الفجر"
    case 3...10: return "\(Fmt.number(minutes, numerals: numerals)) دقائق قبل الفجر"
    default: return "\(Fmt.number(minutes, numerals: numerals)) دقيقة قبل الفجر"
    }
  }

  // MARK: ختمة رمضان — عبر محرّك الختمة القائم (KhatmahPlan) لا محرّكٍ موازٍ
  private static let planKey = "ramadan.khatmah.plan"

  /// الخطة الحالية خطة «ختمة رمضان» (بدأت من بطاقتها)؟ تعديل مدّتها من ورقة الختمة يجعلها خطةً عادية
  static func isRamadanPlan(_ plan: KhatmahPlan?) -> Bool {
    guard let plan else { return false }
    return UserDefaults.standard.string(forKey: planKey) == "\(plan.startedAt)|\(plan.days)"
  }
  static func markRamadanPlan(_ plan: KhatmahPlan) {
    UserDefaults.standard.set("\(plan.startedAt)|\(plan.days)", forKey: planKey)
  }

  /// «ابدأ ختمة رمضان»: خطة من الفاتحة تغطّي ما بقي من الشهر (تحلّ محلّ الخطة الحالية إن وُجدت، ويبقى تذكيرها)
  static func startPlan(_ model: AppModel, days: Int) {
    let q = model.quran
    let reminder = q.khatmah?.reminder
    q.khatmahUnit = "page"
    q.wird = [:]
    let plan = KhatmahPlan(startPage: 1, startedAt: model.todayKey, days: max(1, days), reminder: reminder)
    markRamadanPlan(plan)
    q.khatmah = plan
    model.rescheduleNotifications()
  }

  /// الصفحة التالية في الخطة، أو آخر موضع قراءة (لزرّ «اقرأ حصّتك» في النشاط المباشر)
  static func readPage(_ model: AppModel) -> Int {
    if let plan = model.quran.khatmah {
      let done = min(Khatmah.total, Wird.done(model.quran.wird))
      return ((plan.startPage - 1 + done) % Khatmah.total) + 1
    }
    return model.settings.lastRead?.page ?? 1
  }
}

// MARK: - بطاقة «ختمة رمضان» (تحلّ محلّ «ورد اليوم» في رمضان)
/// بلا خطة رمضانية: عرضٌ لبدء ختمةٍ تُقسَم على ما بقي من الشهر. وبخطّتها: الجزء الحالي، شريط أيام الشهر الثلاثين
/// (المقروء ممتلئ، اليوم ذهبيّ، والعشر الأواخر معلَّمة)، حالة الموعد، وحصّة اليوم موزّعةً على الصلوات الخمس
/// — والحصّة = الباقي ÷ ما بقي من أيام الخطة، فاليوم الفائت يتوزّع دون لوم.
struct RamadanKhatmahCard: View {
  @Environment(AppModel.self) private var model
  let ramadan: RamadanDay
  /// يفتح المصحف على صفحة
  let onRead: (Int) -> Void

  private static let prayers: [Prayer] = [.fajr, .dhuhr, .asr, .maghrib, .isha]

  var body: some View {
    if let plan = model.quran.khatmah, RamadanEdition.isRamadanPlan(plan) {
      progressCard(plan)
    } else {
      offerCard
    }
  }

  private func num(_ v: Int) -> String { Fmt.number(v, numerals: model.settings.numerals) }
  /// العدد والمعدود: ١ و٢ بلفظهما، ٣–١٠ بالجمع، وما فوقها بالمفرد
  private func counted(_ v: Int, one: String, two: String, few: String, many: String) -> String {
    switch v {
    case 1: return one
    case 2: return two
    case 3...10: return "\(num(v)) \(few)"
    default: return "\(num(v)) \(many)"
    }
  }
  private func pages(_ v: Int) -> String { counted(v, one: "صفحة واحدة", two: "صفحتان", few: "صفحات", many: "صفحة") }

  // MARK: العرض
  private var offerCard: some View {
    let days = ramadan.daysLeft
    let perDay = Int((Double(Khatmah.total) / Double(max(1, days))).rounded(.up))
    let hasPlan = model.quran.khatmah != nil
    let daysText = counted(days, one: "يوم واحد", two: "يومان", few: "أيام", many: "يومًا")
    let detail: String = "تُقسَم صفحات المصحف على ما بقي من رمضان: \(daysText)، نحو \(pages(perDay)) كلّ يوم" + (hasPlan ? " — وتحلّ محلّ خطتك الحالية" : "")
    let hint: String = hasPlan ? "تحلّ محلّ خطة الختمة الحالية" : "خطة من الفاتحة حتى آخر الشهر"
    return VStack(alignment: .leading, spacing: 12) {
      VStack(alignment: .leading, spacing: 4) {
        Text("ختمةٌ واحدة في الشهر").font(DS.readex(19, .bold)).foregroundStyle(DS.C.textPrimary).lineLimit(1).minimumScaleFactor(0.8)
        Text(detail).font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary).fixedSize(horizontal: false, vertical: true)
      }
      dayStrip(nil)
      Button { RamadanEdition.startPlan(model, days: days) } label: {
        DSButtonLabel(title: "ابدأ ختمة رمضان", kind: .primary, icon: "chevron.forward")
      }
      .buttonStyle(.plain)
      .accessibilityHint(hint)
      // متابعة القراءة لا تختفي في رمضان (كانت زرّ بطاقة «ورد اليوم»)
      Button { onRead(RamadanEdition.readPage(model)) } label: {
        Text(hasPlan ? "تابع خطتك الحالية" : "تابع القراءة من حيث توقّفت")
          .font(DS.F.labelSm).foregroundStyle(DS.C.brandPrimary).multilineTextAlignment(.center)
          .frame(maxWidth: .infinity).frame(minHeight: 44).contentShape(Rectangle())
      }
      .buttonStyle(.plain)
    }
    .todayCard()
  }

  private func progressCard(_ plan: KhatmahPlan) -> some View {
    let stt = Khatmah.status(plan, wird: model.quran.wird, today: model.todayKey)
    let next = ((plan.startPage - 1 + stt.done) % Khatmah.total) + 1
    let juz = QuranMeta.juz(ofPage: next)
    // حصّة اليوم من بدايته: ما بقي قبل ورد اليوم ÷ ما بقي من أيام الخطة (اليوم منها)
    let before = max(0, stt.done - stt.todayPages)
    let share = stt.finished ? 0 : Int((Double(Khatmah.total - before) / Double(max(1, stt.daysLeft))).rounded(.up))
    let late = plan.dailyPages > 0 ? Int((Double(stt.behind) / Double(plan.dailyPages)).rounded(.up)) : 0
    let title: String = stt.finished ? "تقبّل الله، أتممتَ الختمة ✦" : "الجزء \(num(juz)) من \(num(30))"
    return VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .top, spacing: 8) {
        VStack(alignment: .leading, spacing: 3) {
          Text(title)
            .font(DS.readex(19, .bold)).foregroundStyle(DS.C.textPrimary).lineLimit(1).minimumScaleFactor(0.8)
          Text("الهدف: ختمةٌ واحدة في الشهر").font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary).lineLimit(1).minimumScaleFactor(0.85)
        }
        Spacer(minLength: 6)
        if !stt.finished {
          DSBadge(text: lateText(late), fg: late == 0 ? DS.C.brandStrong : DS.C.warning, bg: late == 0 ? DS.C.brandSoft : DS.C.accentGoldSoft)
        }
      }
      dayStrip(plan)
      if !stt.finished { shareBlock(share: share, todayPages: stt.todayPages) }
      Text("فاتك يوم؟ لا بأس — يُوزَّع الباقي على ما بقي من الشهر دون لوم.")
        .font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary).fixedSize(horizontal: false, vertical: true)
      Button { onRead(next) } label: {
        DSButtonLabel(title: stt.finished ? "افتح المصحف" : "اقرأ حصّتك", kind: .primary, icon: "chevron.forward")
      }
      .buttonStyle(.plain)
    }
    .todayCard()
  }

  /// «في موعده» أو «متأخر يومين» — بالأيام لا بالصفحات
  private func lateText(_ days: Int) -> String {
    if days <= 0 { return "في موعده" }
    return "متأخر \(counted(days, one: "يومًا", two: "يومين", few: "أيام", many: "يومًا"))"
  }

  /// شريط أيام الشهر من اليمين (اليوم الأول) إلى اليسار: المقروء ممتلئ، اليوم ذهبيّ، والعشر الأواخر بلونٍ ذهبيّ خفيف
  private func dayStrip(_ plan: KhatmahPlan?) -> some View {
    let r = ramadan
    let read = (1...max(1, r.monthLength)).filter { $0 < r.day && plan != nil && Wird.pages(model.quran.wird, day: r.key(ofDay: $0)) > 0 }.count
    let stripLabel: String = "اليوم \(r.day) من رمضان" + (plan != nil ? "، قرأتَ في \(read) من أيامه" : "")
    return VStack(spacing: 6) {
      HStack(spacing: 3) {
        ForEach(1...max(1, r.monthLength), id: \.self) { d in
          RoundedRectangle(cornerRadius: 2.5, style: .continuous).fill(cellColor(d, plan))
            .frame(maxWidth: .infinity).frame(height: 16)
        }
      }
      HStack(spacing: 8) {
        Text("اليوم \(num(r.day))").font(DS.F.labelXs).foregroundStyle(DS.C.accentGoldStrong)
        Spacer(minLength: 4)
        Text("العشر الأواخر").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
      }
    }
    .environment(\.layoutDirection, .rightToLeft)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(stripLabel)
  }

  private func cellColor(_ d: Int, _ plan: KhatmahPlan?) -> Color {
    let r = ramadan
    if d == r.day { return DS.C.accentGold }
    if d > r.day { return r.inLastTen(d) ? DS.C.accentGoldSoft : DS.C.bgSubtle }
    guard plan != nil else { return DS.C.bgSubtle }
    return Wird.pages(model.quran.wird, day: r.key(ofDay: d)) > 0 ? DS.C.brandPrimary : DS.C.borderStrong.opacity(0.55)
  }

  /// «حصة اليوم: ٢٠ صفحة، ٤ بعد كلّ صلاة» وخمس شرائح للصلوات تُعلَّم من صفحات اليوم الفعلية (سجلّ الورد)
  private func shareBlock(share: Int, todayPages: Int) -> some View {
    let base = share / 5, extra = share % 5
    let chunks = (0..<5).map { base + ($0 < extra ? 1 : 0) }
    var sums: [Int] = []
    var running = 0
    for c in chunks { running += c; sums.append(running) }
    let each = extra == 0 ? "\(num(base)) بعد كلّ صلاة" : "نحو \(num(base + 1)) بعد كلّ صلاة"
    return VStack(alignment: .leading, spacing: 10) {
      Text("حصة اليوم: \(pages(share))، \(each)").font(DS.readex(14, .semibold)).foregroundStyle(DS.C.textPrimary)
        .fixedSize(horizontal: false, vertical: true)
      HStack(spacing: 6) {
        ForEach(0..<5, id: \.self) { i in
          prayerChip(Self.prayers[i].nameAr, pages: chunks[i], ticked: chunks[i] > 0 && todayPages >= sums[i])
        }
      }
    }
    .padding(12)
    .background(DS.C.accentGoldSoft, in: RoundedRectangle(cornerRadius: DS.Radius.lg, style: .continuous))
  }

  private func prayerChip(_ name: String, pages n: Int, ticked: Bool) -> some View {
    VStack(spacing: 3) {
      Text(name).font(DS.readex(11, .medium)).lineLimit(1).minimumScaleFactor(0.7)
      Group {
        if ticked { Image(systemName: "checkmark").font(.system(size: 12, weight: .bold)) }
        else { Text(pages(n)).font(DS.readex(12, .semibold)).lineLimit(1).minimumScaleFactor(0.6) }
      }
      .frame(height: 16)
    }
    .foregroundStyle(ticked ? DS.C.textOnBrand : DS.C.textPrimary)
    .frame(maxWidth: .infinity).padding(.vertical, 8).padding(.horizontal, 2)
    .background(ticked ? DS.C.brandPrimary : DS.C.bgSurface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(name + ": " + (ticked ? "قُرئت حصّته" : pages(n)))
  }
}
