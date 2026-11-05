import SwiftUI
import AVFoundation
import AudioToolbox
import SakinahCore

/// تبويب «الذكر» (المرحلة الخامسة — dhikr.png): رأسٌ بعنوانه وزرّي البحث والتذكير، بطاقتا الصباح (يمينًا) والمساء،
/// «حضورك هذا الأسبوع» بدل السلسلة (لا نقاط ولا سلاسل تنكسر)، بطاقة المسبحة، «حصن المسلم» ببحثٍ وثماني شرائح موضوعات،
/// و«مفضّلتي» (الأذكار المحفوظة من الجلسة وأبواب الحصن المفضّلة).
/// ملاحظة اتجاه: البيئة RTL، فأوّل عنصر في HStack يقع يمينًا، و`.leading` هو اليمين.
struct AdhkarHomeView: View {
  @Environment(AppModel.self) private var model
  @State private var period = ""
  @State private var session: String?
  @State private var showHisn = false
  @State private var showTasbih = ScreenshotMode.openTasbih
  @State private var query = ""
  @State private var searching = false
  @State private var showReminders = false
  /// أذكار النوم (باب ٢٨ من حصن المسلم) من رابط الودجت أو النشاط المباشر
  @State private var showSleep = false
  /// الجذر ظاهر (لا تبويب آخر ولا وجهة مدفوعة ولا غطاء): وحده يقدّم الجلسة
  @State private var rootVisible = false
  /// شريحة موضوع من «حصن المسلم» (تفتح الفهرس مصفّى بأقسامها)
  @State private var hisnTheme: HisnTheme?
  /// حقل البحث في قسم «حصن المسلم»، و«كل النتائج» تفتح الفهرس بالبحث نفسه
  @State private var hisnQuery = ""
  @State private var hisnSearch: String?
  @State private var showFavorites = false

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(spacing: DS.Space.s4) {
          if searching {
            searchField
            searchResults
          } else {
            periodCards
            presenceCard
            tasbihCard
            hisnSection
            favoritesSection
            Text("النصوص من كتاب «حصن المسلم» للشيخ سعيد بن علي بن وهف القحطاني، بترتيبه وتخريجه.")
              .font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
              .multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(.top, DS.Space.s1)
          }
        }
        .padding(.horizontal, DS.Space.s4).padding(.top, DS.Space.s2).padding(.bottom, DS.Space.s8)
        .readableWidth()
      }
      .scrollDismissesKeyboard(.interactively)
      .background(DS.C.bgCanvas)
      .tabBarClearance()
      .safeAreaInset(edge: .top, spacing: 0) { navBar }
      .navigationBarHidden(true)
      .onAppear { if period.isEmpty { period = autoPeriod() } }
      .fullScreenCover(item: Binding(get: { session.map { SessionID(id: $0) } }, set: { session = $0?.id })) { s in
        DhikrSessionView(period: s.id).environment(model)
      }
      .navigationDestination(isPresented: $showHisn) { HisnView().environment(model).tabBarClearance() }
      .navigationDestination(isPresented: $showTasbih) { TasbihView().environment(model).tabBarClearance() }
      .navigationDestination(item: $hisnTheme) { t in HisnView(theme: t).environment(model).tabBarClearance() }
      .navigationDestination(item: $hisnSearch) { q in HisnView(initialQuery: q).environment(model).tabBarClearance() }
      .navigationDestination(isPresented: $showFavorites) { AdhkarFavoritesView().environment(model).tabBarClearance() }
      // «ابدأ» من بطاقة أذكار الوقت في الرئيسية، ورابط الودجت/النشاط المباشر (sakinah://adhkar/<period>).
      // الرابط قد يصل والتبويب ظاهر أصلًا فلا يتكرّر onAppear: يُستهلك في onChange إن كان الجذر ظاهرًا،
      // وإلا تُغلق الوجهات المدفوعة ويُنتظر ظهوره (البحث الشامل يعيّن الفترة ثم يغلق غطاءه قبل تبديل التبويب)
      .onAppear { rootVisible = true; consumePendingPeriod() }
      .onDisappear { rootVisible = false }
      .onChange(of: model.pendingAdhkarPeriod) { _, new in
        guard new != nil else { return }
        if rootVisible { consumePendingPeriod() } else { closePushed() }
      }
      .navigationDestination(isPresented: $showSleep) {
        if let ch = Hisn.chapter(28) { HisnChapterView(chapter: ch).environment(model).tabBarClearance() }
      }
      .sheet(isPresented: $showReminders) { AdhkarRemindersSheet().environment(model) }
    }
  }
  private struct SessionID: Identifiable { let id: String }

  private func closePushed() {
    showHisn = false; showTasbih = false; showSleep = false; hisnTheme = nil; hisnSearch = nil; showFavorites = false
  }

  /// فترة معلّقة: الصباح والمساء جلسة عدّ، والنوم باب حصن المسلم كما في بطاقة «الآن»
  private func consumePendingPeriod() {
    guard let p = model.pendingAdhkarPeriod else { return }
    model.pendingAdhkarPeriod = nil
    if p == "sleep" { showSleep = true; return }
    guard p == "morning" || p == "evening" else { return }
    period = p
    Task { @MainActor in try? await Task.sleep(for: .milliseconds(80)); session = p }
  }

  // MARK: الرأس: «الذكر» ووصفه، والبحث في الأذكار، وتذكيراتها

  private var navBar: some View {
    let reminders = model.content.extraReminders.any
    return SectionScreenHeader(title: "الذكر", subtitle: "الأذكار، والمسبحة، وحصن المسلم") {
      HStack(spacing: DS.Space.s2) {
        DSIconButton(systemName: searching ? "xmark" : "magnifyingglass", label: searching ? "إغلاق البحث" : "بحث في الأذكار") {
          withAnimation(.snappy(duration: 0.2)) { searching.toggle(); if !searching { query = "" } }
        }
        DSIconButton(systemName: reminders ? "bell.fill" : "bell", style: reminders ? .brand : .outlined, label: "تذكيرات الأذكار") { showReminders = true }
      }
    }
    .padding(.horizontal, DS.Space.s4).padding(.top, DS.Space.s2).padding(.bottom, DS.Space.s3)
    .readableWidth()
    .background(DS.C.bgCanvas)
  }

  private var searchField: some View {
    HStack(spacing: DS.Space.s2) {
      Image(systemName: "magnifyingglass").font(.system(size: 15)).foregroundStyle(DS.C.textTertiary)
      TextField("ابحث في الأبواب والأذكار…", text: $query).font(DS.F.bodyMd).submitLabel(.search)
      if !query.isEmpty { Button { query = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(DS.C.textTertiary) }.buttonStyle(.plain).accessibilityLabel("مسح") }
    }
    .dsTile(padding: DS.Space.s3)
  }

  @ViewBuilder private var searchResults: some View {
    let res = Hisn.search(query)
    let numerals = model.settings.numerals
    if CityDatabase.normalize(query).count < 2 {
      Text("اكتب حرفين على الأقل للبحث").font(DS.F.bodySm).foregroundStyle(DS.C.textTertiary).padding(.top, DS.Space.s6)
    } else if res.chapters.isEmpty && res.items.isEmpty {
      Text("لا نتائج — جرّب كلمة أخرى").font(DS.F.bodySm).foregroundStyle(DS.C.textTertiary).padding(.top, DS.Space.s6)
    } else {
      VStack(spacing: DS.Space.s2) {
        ForEach(res.chapters) { c in
          NavigationLink { HisnChapterView(chapter: c).environment(model).tabBarClearance() } label: {
            DSRow(icon: "book.closed", title: c.title, subtitle: HisnView.countLabel(c.items.count, numerals: numerals)) { DSChevron() }
          }
          .buttonStyle(.plain)
        }
        ForEach(res.items, id: \.item.id) { r in
          NavigationLink { HisnChapterView(chapter: r.chapter, focusItem: r.item.id).environment(model).tabBarClearance() } label: {
            VStack(alignment: .leading, spacing: 4) {
              Text(r.item.text.count > 110 ? String(r.item.text.prefix(110)) + "…" : r.item.text).font(DS.F.readingSm).foregroundStyle(DS.C.textPrimary).lineLimit(2)
              Text(r.chapter.title).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading).dsTile()
          }
          .buttonStyle(.plain)
        }
      }
    }
  }

  // MARK: بطاقتا الصباح (يمينًا) والمساء

  private var periodCards: some View {
    HStack(alignment: .top, spacing: DS.Space.s3) {
      periodCard("morning")
      periodCard("evening")
    }
  }

  private func periodCard(_ p: String) -> some View {
    let numerals = model.settings.numerals
    let list = Adhkar.items(for: p)
    let done = doneMap(p)
    let completed = list.filter { (done[$0.id] ?? 0) >= $0.target(for: p) }.count
    let total = list.count
    let pct = total == 0 ? 0.0 : Double(completed) / Double(total)
    let complete = total > 0 && completed >= total
    let started = completed > 0 || done.values.contains { $0 > 0 }
    let morning = p == "morning"
    let title = morning ? "أذكار الصباح" : "أذكار المساء"
    let counts = "\(Fmt.number(completed, numerals: numerals)) من \(Fmt.number(total, numerals: numerals))"
    return Button { period = p; session = p } label: {
      VStack(spacing: 10) {
        ZStack {
          RingProgress(progress: pct, tint: complete ? DS.C.brandPrimary : DS.C.accentGold, track: DS.C.bgSubtle, lineWidth: 5)
          Image(systemName: morning ? "sun.max" : "moon").font(.system(size: 22, weight: .regular)).foregroundStyle(complete ? DS.C.brandPrimary : DS.C.textSecondary)
        }
        .frame(width: 72, height: 72)
        Text(title).font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary).lineLimit(1).minimumScaleFactor(0.85)
        Text(complete ? counts : "\(counts)، \(windowLabel(p))").font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).lineLimit(1).minimumScaleFactor(0.7)
        periodStatus(complete: complete, started: started)
      }
      .frame(maxWidth: .infinity)
      .padding(.vertical, 18).padding(.horizontal, 12)
      .background(DS.C.bgSurface, in: RoundedRectangle(cornerRadius: DS.Radius.xl, style: .continuous))
      .overlay(RoundedRectangle(cornerRadius: DS.Radius.xl, style: .continuous).stroke(DS.C.borderSubtle, lineWidth: 1))
      .contentShape(RoundedRectangle(cornerRadius: DS.Radius.xl, style: .continuous))
    }
    .buttonStyle(.plain)
    .accessibilityElement(children: .combine)
    .accessibilityLabel("\(title)، \(completed) من \(total)\(complete ? "، أتممتها اليوم" : "")")
    .accessibilityHint(complete ? "يفتح الجلسة" : (started ? "متابعة الجلسة" : "ابدأ الجلسة"))
  }

  @ViewBuilder private func periodStatus(complete: Bool, started: Bool) -> some View {
    if complete {
      HStack(spacing: 5) {
        Text("أتممتها اليوم").font(DS.F.labelSm)
        Image(systemName: "checkmark").font(.system(size: 11, weight: .bold))
      }
      .foregroundStyle(DS.C.brandPrimary)
      .frame(height: 40)
    } else {
      Text(started ? "متابعة" : "ابدأ").font(DS.F.labelMd).foregroundStyle(Color(hex: 0x16211F))
        .frame(maxWidth: .infinity).frame(height: 40)
        .background(DS.C.accentGold, in: Capsule())
    }
  }

  /// «بدأت ٣:٢٠» (بدأ وقتها بالفجر أو العصر) أو «تبدأ بعد الفجر/العصر»
  private func windowLabel(_ p: String) -> String {
    let tl = model.timeline(now: Date())
    let s = model.settings
    if p == "morning" {
      guard let f = tl?.times[.fajr] else { return "بعد الفجر" }
      return Date() >= f ? "بدأت \(Fmt.time(f, tz: model.timeZone, hour12: s.hour12, numerals: s.numerals))" : "تبدأ بعد الفجر"
    }
    guard let a = tl?.times[.asr] else { return "بعد العصر" }
    return Date() >= a ? "بدأت \(Fmt.time(a, tz: model.timeZone, hour12: s.hour12, numerals: s.numerals))" : "تبدأ بعد العصر"
  }

  // MARK: حضورك هذا الأسبوع — من سجلّ إتمام الأذكار نفسه، بلا سلسلة ولا «الأطول»

  private var presenceCard: some View {
    let numerals = model.settings.numerals
    let log = model.content.adhkarLog
    let today = model.todayKey
    let week = WeekKeys.saturdayWeek(containing: today)
    let doneDays = week.filter { $0 <= today && !(log[$0]?.isEmpty ?? true) }.count
    let line = doneDays == 0
      ? "أذكار هذا الأسبوع بانتظارك"
      : "حضرتَ أذكارك \(ArabicCount.phrase(doneDays, one: "يومًا واحدًا", two: "يومين", few: "أيام", many: "يومًا", numerals: numerals)) من \(Fmt.number(7, numerals: numerals)) هذا الأسبوع"
    return VStack(alignment: .leading, spacing: 14) {
      Text(line).font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary).fixedSize(horizontal: false, vertical: true)
      // السبت يمينًا (أوّل عنصر) والجمعة يسارًا
      HStack(spacing: 0) {
        ForEach(week, id: \.self) { k in
          dayDot(k, done: !(log[k]?.isEmpty ?? true), today: today)
        }
      }
      Text("هذا لك وحدك: لا نقاط ولا سلاسل تنكسر.").font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary)
      if let r = reminderLine { Text(r).font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).fixedSize(horizontal: false, vertical: true) }
    }
    .todayCard(padding: 16)
    .accessibilityElement(children: .combine)
    .accessibilityLabel("حضورك هذا الأسبوع: \(line)")
  }

  private func dayDot(_ key: String, done: Bool, today: String) -> some View {
    let isToday = key == today
    let future = key > today
    return VStack(spacing: 6) {
      ZStack {
        Circle().fill(done ? DS.C.brandPrimary : DS.C.bgSubtle)
        if isToday && !done { Circle().stroke(DS.C.accentGold, lineWidth: 2) }
      }
      .frame(width: 30, height: 30)
      .opacity(future ? 0.5 : 1)
      Text(AdhkarStreak.letter(key)).font(DS.F.labelXs).foregroundStyle(isToday ? DS.C.accentGoldStrong : DS.C.textTertiary)
    }
    .frame(maxWidth: .infinity)
  }

  /// تذكيرات الأذكار إن كانت مفعّلة (كانت سطرًا في بطاقة السلسلة) — سطرٌ صغير لا أكثر
  private var reminderLine: String? {
    let ex = model.content.extraReminders; let n = model.settings.numerals
    func mins(_ m: Int) -> String { ArabicCount.phrase(m, one: "دقيقة", two: "دقيقتين", few: "دقائق", many: "دقيقة", numerals: n) }
    var parts: [String] = []
    if ex.adhkarMorning { parts.append("الصباح بعد الفجر بـ\(mins(ex.morningAfter))") }
    if ex.adhkarEvening { parts.append("المساء بعد العصر بـ\(mins(ex.eveningAfter))") }
    return parts.isEmpty ? nil : "تذكيرك: " + parts.joined(separator: "، و")
  }

  // MARK: المسبحة

  private var tasbihCard: some View {
    let numerals = model.settings.numerals
    let st = model.content.tasbih
    let today = model.todayKey
    let pct = st.target > 0 ? Double(st.count) / Double(st.target) : 0
    let day = model.content.tasbihDaily[today] ?? 0
    let week = TasbihWeek.total(model.content.tasbihDaily, today: today)
    return Button { showTasbih = true } label: {
      HStack(spacing: 14) {
        ZStack {
          RingProgress(progress: pct, tint: DS.C.brandPrimary, track: DS.C.bgSubtle, lineWidth: 4).frame(width: 54, height: 54)
          Text(Fmt.number(st.count, numerals: numerals)).font(DS.F.numericMd).foregroundStyle(DS.C.textPrimary).monospacedDigit().lineLimit(1).minimumScaleFactor(0.6).frame(width: 44)
        }
        VStack(alignment: .leading, spacing: 3) {
          Text("المسبحة").font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary)
          Text("\(Tasbih.phraseText(st))، اليوم \(Fmt.grouped(day, numerals: numerals))، هذا الأسبوع \(Fmt.grouped(week, numerals: numerals))")
            .font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).lineLimit(1).minimumScaleFactor(0.7)
        }
        Spacer(minLength: 6)
        DSChevron()
      }
      .todayCard(padding: 16)
      .contentShape(RoundedRectangle(cornerRadius: DS.Radius.xl, style: .continuous))
    }
    .buttonStyle(.plain)
    .accessibilityHint("يفتح المسبحة")
  }

  // MARK: حصن المسلم: بحثٌ وثماني شرائح موضوعات

  private var hisnSection: some View {
    let numerals = model.settings.numerals
    return VStack(spacing: 10) {
      DSSectionHead("حصن المسلم") {
        Button { showHisn = true } label: {
          DSLinkLabel(title: "كل الأبواب (\(Fmt.number(Hisn.chapters.count, numerals: numerals)))").frame(minHeight: 44).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
      }
      VStack(spacing: 12) {
        hisnSearchField
        if hisnSearching { hisnInlineResults } else { themeGrid }
      }
      .todayCard(padding: 14)
    }
  }
  private var hisnSearching: Bool { CityDatabase.normalize(hisnQuery).count >= 2 }

  private var hisnSearchField: some View {
    HStack(spacing: 8) {
      Image(systemName: "magnifyingglass").font(.system(size: 15)).foregroundStyle(DS.C.textTertiary)
      TextField("ابحث في الأبواب والأذكار", text: $hisnQuery).font(DS.F.bodyMd).submitLabel(.search)
        .onSubmit { if hisnSearching { hisnSearch = hisnQuery } }
      if !hisnQuery.isEmpty {
        Button { hisnQuery = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(DS.C.textTertiary) }.buttonStyle(.plain).accessibilityLabel("مسح")
      }
    }
    .padding(.horizontal, 14).padding(.vertical, 11)
    .background(DS.C.bgCanvas, in: Capsule())
    .overlay(Capsule().stroke(DS.C.borderSubtle, lineWidth: 1))
  }

  /// أوائل النتائج داخل البطاقة، و«كل النتائج» تفتح فهرس الحصن بالبحث نفسه
  @ViewBuilder private var hisnInlineResults: some View {
    let res = Hisn.search(hisnQuery)
    let numerals = model.settings.numerals
    let total = res.chapters.count + res.items.count
    if total == 0 {
      Text("لا نتائج — جرّب كلمة أخرى").font(DS.F.bodySm).foregroundStyle(DS.C.textTertiary).frame(maxWidth: .infinity).padding(.vertical, 8)
    } else {
      VStack(spacing: 0) {
        ForEach(Array(res.chapters.prefix(4))) { c in
          NavigationLink { HisnChapterView(chapter: c).environment(model).tabBarClearance() } label: {
            SectionListRow(icon: "book.closed", title: c.title, subtitle: HisnView.countLabel(c.items.count, numerals: numerals))
          }
          .buttonStyle(.plain)
        }
        ForEach(Array(res.items.prefix(3)), id: \.item.id) { r in
          NavigationLink { HisnChapterView(chapter: r.chapter, focusItem: r.item.id).environment(model).tabBarClearance() } label: {
            SectionListRow(icon: "text.quote", title: AdhkarFavorite.excerpt(r.item.text), subtitle: r.chapter.title)
          }
          .buttonStyle(.plain)
        }
        Button { hisnSearch = hisnQuery } label: {
          DSLinkLabel(title: "كل النتائج (\(Fmt.number(total, numerals: numerals))\(res.items.count >= 60 ? "+" : ""))").frame(maxWidth: .infinity).frame(minHeight: 44).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
      }
    }
  }

  private var themeGrid: some View {
    LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
      ForEach(HisnTheme.all) { t in
        Button { hisnTheme = t } label: {
          Text(t.title).font(DS.F.labelMd).foregroundStyle(DS.C.textPrimary).lineLimit(1).minimumScaleFactor(0.8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 12).padding(.horizontal, 14)
            .background(DS.C.bgSubtle, in: RoundedRectangle(cornerRadius: DS.Radius.md, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: DS.Radius.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityHint("يفتح أبواب حصن المسلم في هذا الموضوع")
      }
    }
  }

  // MARK: مفضّلتي

  private var favoritesSection: some View {
    let favs = AdhkarFavorite.all(model.content)
    return VStack(spacing: 10) {
      DSSectionHead("مفضّلتي") {
        if !favs.isEmpty {
          Button { showFavorites = true } label: { DSLinkLabel(title: "الكل").frame(minHeight: 44).contentShape(Rectangle()) }
            .buttonStyle(.plain).accessibilityLabel("كل المفضّلة")
        }
      }
      if favs.isEmpty {
        AdhkarFavoritesEmpty().todayCard(padding: 18)
      } else {
        VStack(spacing: 0) {
          ForEach(Array(favs.prefix(3).enumerated()), id: \.element.id) { i, f in
            if i > 0 { SectionRowDivider() }
            NavigationLink { HisnChapterView(chapter: f.chapter, focusItem: f.focusItem).environment(model).tabBarClearance() } label: {
              SectionListRow(icon: f.icon, title: f.title, subtitle: f.subtitle)
            }
            .buttonStyle(.plain)
          }
        }
        .todayCard(padding: 4)
      }
    }
  }

  // MARK: بيانات

  private func autoPeriod() -> String {
    let tl = model.timeline(now: Date())
    return Adhkar.autoPeriod(now: Date(), fajr: tl?.times[.fajr], dhuhr: tl?.times[.dhuhr], asr: tl?.times[.asr], tz: model.timeZone)
  }
  private func doneMap(_ p: String) -> [String: Int] {
    let prog = AdhkarSession.current(model)
    return (p == "evening" ? prog.evening : prog.morning) ?? [:]
  }
}

/// مجموع المسبحة في الأسبوع الحالي (السبت → اليوم) من سجلّها اليومي على الجهاز
enum TasbihWeek {
  static func total(_ daily: [String: Int], today: String) -> Int {
    WeekKeys.saturdayWeek(containing: today).filter { $0 <= today }.reduce(0) { $0 + (daily[$1] ?? 0) }
  }
}

// MARK: - موضوعات «حصن المسلم» (ثماني شرائح ← أقسام الكتاب الاثنا عشر)
/// كل شريحة تُطابَق بعناوين أقسام الكتاب من البيانات نفسها (لا قوائم أبواب مكتوبة باليد)
struct HisnTheme: Identifiable, Hashable {
  let id: String
  let title: String
  let keywords: [String]
  static let all: [HisnTheme] = [
    HisnTheme(id: "morning", title: "الصباح والمساء", keywords: ["الصباح"]),
    HisnTheme(id: "sleep", title: "النوم والاستيقاظ", keywords: ["الاستيقاظ", "النوم"]),
    HisnTheme(id: "prayer", title: "الصلاة والمسجد", keywords: ["المسجد", "الصلاة"]),
    HisnTheme(id: "distress", title: "الكرب والهمّ", keywords: ["الكروب", "الهموم"]),
    HisnTheme(id: "travel", title: "السفر", keywords: ["السفر"]),
    HisnTheme(id: "food", title: "الطعام والشراب", keywords: ["الطعام"]),
    HisnTheme(id: "sick", title: "المرض والعيادة", keywords: ["المرض"]),
    HisnTheme(id: "istighfar", title: "الاستغفار والتوبة", keywords: ["الاستغفار"]),
  ]
  /// أقسام الكتاب التي يغطّيها الموضوع، بترتيبها في الكتاب
  var sections: [HisnSection] { Hisn.sections.filter { s in keywords.contains { s.title.contains($0) } } }
}

// MARK: - مفضّلتي
/// عنصرٌ مفضّل: ذكرٌ من جلسة الأذكار («dhikr:<id>» في المفضّلة) أو بابٌ من حصن المسلم — وكلاهما يُفتح على بابه
struct AdhkarFavorite: Identifiable {
  let id: String
  let icon: String
  let title: String
  let subtitle: String
  let chapter: HisnChapter
  let focusItem: Int?
  /// مفتاح الإزالة: «dhikr:<id>» في المفضّلة، أو رقم الباب في أبواب الحصن
  let dhikrKey: String?
  let hisnChapterId: Int?

  /// الأحدث أوّلًا: الأذكار المحفوظة من الجلسة، ثم أبواب الحصن
  static func all(_ content: ContentPrefs) -> [AdhkarFavorite] {
    var out: [AdhkarFavorite] = []
    for key in content.favorites.reversed() where key.hasPrefix("dhikr:") {
      let id = String(key.dropFirst("dhikr:".count))
      guard let d = Adhkar.all.first(where: { $0.id == id }), let ch = Hisn.chapter(containingItem: d.hisnId) ?? Hisn.chapter(27) else { continue }
      let sub = d.period == "morning" ? "من أذكار الصباح" : (d.period == "evening" ? "من أذكار المساء" : "من أذكار الصباح والمساء")
      let icon = d.period == "morning" ? "sun.max" : (d.period == "evening" ? "moon" : "sun.horizon")
      out.append(AdhkarFavorite(id: key, icon: icon, title: excerpt(d.text), subtitle: sub, chapter: ch, focusItem: d.hisnId, dhikrKey: key, hisnChapterId: nil))
    }
    for cid in content.hisnFavorites.reversed() {
      guard let ch = Hisn.chapter(cid) else { continue }
      let sub = Hisn.sectionTitle(ofChapter: cid).map { "حصن المسلم، \($0)" } ?? "حصن المسلم"
      out.append(AdhkarFavorite(id: "hisn:\(cid)", icon: "book.closed", title: ch.title, subtitle: sub, chapter: ch, focusItem: nil, dhikrKey: nil, hisnChapterId: cid))
    }
    return out
  }
  /// أوّل كلمات النصّ عنوانًا للصفّ
  static func excerpt(_ text: String, words: Int = 6) -> String {
    let parts = text.split(separator: " ")
    let head = parts.prefix(words).joined(separator: " ")
    return parts.count > words ? head + "…" : head
  }
}

struct AdhkarFavoritesEmpty: View {
  var body: some View {
    VStack(spacing: 8) {
      Image(systemName: "heart").font(.system(size: 22, weight: .medium)).foregroundStyle(DS.C.brandPrimary)
        .frame(width: 44, height: 44).background(DS.C.brandSoft, in: Circle())
      Text("لا مفضّلة بعد").font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary)
      Text("المس ♡ على ذكرٍ في جلسة الأذكار، أو على بابٍ من حصن المسلم، فيظهر هنا.")
        .font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
    }
    .frame(maxWidth: .infinity)
  }
}

/// «مفضّلتي» كاملةً: كل عنصر يُفتح على بابه، ويُزال بالسحب أو من قائمة السياق
struct AdhkarFavoritesView: View {
  @Environment(AppModel.self) private var model
  var body: some View {
    let favs = AdhkarFavorite.all(model.content)
    Group {
      if favs.isEmpty {
        ScrollView { AdhkarFavoritesEmpty().dsCard(padding: 24).padding(20).readableWidth(560) }
      } else {
        List {
          ForEach(favs) { f in
            NavigationLink { HisnChapterView(chapter: f.chapter, focusItem: f.focusItem).environment(model).tabBarClearance() } label: {
              HStack(spacing: 12) {
                DSSquareIcon(systemName: f.icon)
                VStack(alignment: .leading, spacing: 2) {
                  Text(f.title).font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary).lineLimit(2)
                  Text(f.subtitle).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary)
                }
              }
              .padding(.vertical, 4)
            }
            .listRowBackground(DS.C.bgSurface)
            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
              Button(role: .destructive) { remove(f) } label: { Label("إزالة", systemImage: "heart.slash") }
            }
            .contextMenu {
              Button(role: .destructive) { remove(f) } label: { Label("إزالة من المفضّلة", systemImage: "heart.slash") }
            }
          }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
      }
    }
    .background(DS.C.bgCanvas)
    .navigationTitle("مفضّلتي").navigationBarTitleDisplayMode(.inline)
  }
  private func remove(_ f: AdhkarFavorite) {
    withAnimation(.snappy(duration: 0.2)) {
      if let k = f.dhikrKey { model.content.favorites.removeAll { $0 == k } }
      if let c = f.hisnChapterId { model.content.hisnFavorites.removeAll { $0 == c } }
    }
  }
}

/// منطق مشترك لتقدّم الأذكار اليومي: التصفير مع اليوم، والمساء يمتدّ إلى فجر الغد
enum AdhkarSession {
  static func current(_ model: AppModel) -> WebSettings.AdhkarProgress {
    var p = model.content.adhkarProgress; let key = model.todayKey
    let tl = model.timeline(now: Date()); let afterFajr = tl?.times[.fajr].map { Date() >= $0 } ?? true
    if p.date != key {
      p = WebSettings.AdhkarProgress(date: key, morning: [:], evening: afterFajr ? [:] : (p.evening ?? [:]), eveningDate: afterFajr ? key : (p.eveningDate ?? p.date ?? key))
    } else if afterFajr, let ed = p.eveningDate, ed != key {
      p.evening = [:]; p.eveningDate = key
    }
    return p
  }
}

/// جلسة الأذكار (تصميم Figma 08): ذكر واحد في الشاشة، شريط تقدّم مقسّم، عدّاد بحلقة ذهبية، ونقر في أي مكان للعدّ
struct DhikrSessionView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  let period: String
  @State private var index = 0
  @State private var shareCard: ShareCardRequest?
  @State private var shareItems: ShareItems?
  @State private var showSettings = false
  @State private var pulse = false
  @State private var player: AVPlayer?
  @State private var playingId: String?

  private var list: [Dhikr] { Adhkar.items(for: period) }
  private var title: String { period == "morning" ? "أذكار الصباح" : "أذكار المساء" }

  var body: some View {
    let numerals = model.settings.numerals
    let items = list
    let dhikr = items.indices.contains(index) ? items[index] : items.first
    let done = AdhkarSession.current(model)
    let map = (period == "evening" ? done.evening : done.morning) ?? [:]
    let completedCount = items.filter { (map[$0.id] ?? 0) >= $0.target(for: period) }.count
    return ZStack {
      DS.C.bgCanvas.ignoresSafeArea()
      VStack(spacing: 0) {
        header(completedCount, items.count, numerals)
        segments(items, map)
        if let d = dhikr {
          ScrollView {
            VStack(spacing: DS.Space.s5) {
              dhikrCard(d, numerals: numerals)
              counter(d, count: map[d.id] ?? 0, numerals: numerals)
            }
            .padding(.horizontal, DS.Space.s4).padding(.top, DS.Space.s3).padding(.bottom, DS.Space.s6)
          }
          .scrollBounceBehavior(.basedOnSize)
          footer(d, count: map[d.id] ?? 0, total: items.count)
        }
      }
    }
    .contentShape(Rectangle())
    .onTapGesture { if let d = dhikr { count(d, current: map[d.id] ?? 0) } }
    .sheet(item: $shareCard) { ShareCardSheet(request: $0).environment(model) }
    .sheet(item: $shareItems) { ShareSheet(items: $0.items) }
    .onDisappear { player?.pause() }
  }

  private func header(_ done: Int, _ total: Int, _ numerals: String) -> some View {
    HStack {
      DSIconButton(systemName: "slider.horizontal.3", label: "إعدادات العرض") { showSettings = true }
      Spacer()
      VStack(spacing: 2) {
        Text(title).font(DS.F.headingMd).foregroundStyle(DS.C.textPrimary)
        Text("\(Fmt.number(index + 1, numerals: numerals)) من \(Fmt.number(total, numerals: numerals))، بقي نحو \(Fmt.number(max(1, (total - done) / 5), numerals: numerals)) دقائق")
          .font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary)
      }
      Spacer()
      DSIconButton(systemName: "xmark", label: "إغلاق") { dismiss() }
    }
    .padding(.horizontal, DS.Space.s4).padding(.vertical, DS.Space.s3)
    .popover(isPresented: $showSettings) { sessionSettings.presentationCompactAdaptation(.popover) }
  }

  private var sessionSettings: some View {
    VStack(alignment: .trailing, spacing: DS.Space.s3) {
      Text("حجم النص").font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary)
      HStack(spacing: DS.Space.s2) {
        DSIconButton(systemName: "minus", style: .soft, size: 36, iconSize: 14, label: "تصغير") { model.content.textScale = max(0.8, model.content.textScale - 0.1) }
        Text("\(Int(model.content.textScale * 100))٪").font(DS.F.numericSm).monospacedDigit().frame(minWidth: 56)
        DSIconButton(systemName: "plus", style: .soft, size: 36, iconSize: 14, label: "تكبير") { model.content.textScale = min(1.6, model.content.textScale + 0.1) }
      }
      Divider().overlay(DS.C.borderSubtle)
      Button { reset() } label: { DSButtonLabel(title: "إعادة الفترة من البداية", kind: .ghost, icon: "arrow.counterclockwise") }.buttonStyle(.plain)
    }
    .padding(DS.Space.s4).frame(width: 260)
  }

  private func segments(_ items: [Dhikr], _ map: [String: Int]) -> some View {
    HStack(spacing: 3) {
      ForEach(Array(items.enumerated()), id: \.element.id) { i, d in
        let full = (map[d.id] ?? 0) >= d.target(for: period)
        Capsule()
          .fill(full ? DS.C.brandPrimary : (i == index ? DS.C.accentGold : DS.C.borderSubtle))
          .frame(height: 4).frame(maxWidth: .infinity)
      }
    }
    .padding(.horizontal, DS.Space.s4).padding(.bottom, DS.Space.s2)
    .animation(.snappy(duration: 0.2), value: index)
  }

  private func dhikrCard(_ d: Dhikr, numerals: String) -> some View {
    let target = d.target(for: period)
    let text = d.text(for: period)
    let fav = model.content.favorites.contains("dhikr:\(d.id)")
    return VStack(spacing: DS.Space.s4) {
      HStack {
        HStack(spacing: DS.Space.s2) {
          DSIconButton(systemName: fav ? "heart.fill" : "heart", style: fav ? .brand : .soft, size: 38, iconSize: 16, label: "مفضلة") { model.content.toggleFavorite("dhikr:\(d.id)") }
          DSIconButton(systemName: "square.and.arrow.up", style: .soft, size: 38, iconSize: 16, label: "مشاركة") {
            shareCard = ShareCardRequest(title: title, text: text, footer: d.reference, quran: false, shareText: "\(text)\n\n\(d.reference)", filename: "dhikr-\(d.id).png")
          }
          DSIconButton(systemName: playingId == d.id ? "speaker.wave.2.fill" : "speaker.wave.2", style: playingId == d.id ? .brand : .soft, size: 38, iconSize: 16, label: "استماع") { toggleAudio(d) }
        }
        Spacer()
        Text(target > 1 ? "يُقال \(DhikrCard.repeatLabel(target, numerals: numerals))" : "يُقال مرة واحدة")
          .font(DS.F.labelXs).foregroundStyle(DS.C.accentGoldStrong)
          .padding(.vertical, 5).padding(.horizontal, 10)
          .background(DS.C.accentGoldSoft, in: Capsule())
      }
      Text(text)
        .font(DS.amiri(20 * model.content.textScale))
        .lineSpacing(12).multilineTextAlignment(.center)
        .foregroundStyle(DS.C.paperInk)
        .frame(maxWidth: .infinity)
      if let v = d.virtue, !v.isEmpty {
        Text(v).font(DS.F.bodySm).foregroundStyle(DS.C.brandPrimary).multilineTextAlignment(.center)
      }
      Divider().overlay(DS.C.borderSubtle)
      HStack {
        Text("حصن المسلم، \(title)").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
        Spacer()
        Text(d.reference).font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
      }
    }
    .padding(DS.Space.s5)
    .background(DS.C.paperPage, in: RoundedRectangle(cornerRadius: DS.Radius.xl, style: .continuous))
    .shadow(color: DS.C.shadowCard, radius: 12, x: 0, y: 4)
  }

  private func counter(_ d: Dhikr, count: Int, numerals: String) -> some View {
    let target = d.target(for: period)
    let full = count >= target
    return VStack(spacing: DS.Space.s3) {
      ZStack {
        Circle().fill(DS.C.bgSurface).shadow(color: DS.C.shadowCard, radius: 10, x: 0, y: 4)
        RingProgress(progress: target > 0 ? Double(count) / Double(target) : 0, tint: full ? DS.C.brandPrimary : DS.C.accentGold, lineWidth: 8)
        VStack(spacing: 2) {
          Text(Fmt.number(max(count, full ? target : count), numerals: numerals)).font(DS.F.numericXl).foregroundStyle(DS.C.textPrimary).monospacedDigit()
          Text(full ? "من \(Fmt.number(target, numerals: numerals)) اكتمل" : "من \(Fmt.number(target, numerals: numerals))")
            .font(DS.F.labelSm).foregroundStyle(full ? DS.C.brandPrimary : DS.C.textSecondary)
        }
      }
      .frame(width: 150, height: 150)
      .scaleEffect(pulse ? 1.04 : 1)
      .animation(.snappy(duration: 0.18), value: pulse)
      Text("انقر في أي مكان للعدّ، واهتزازٌ خفيف عند الاكتمال")
        .font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
    }
  }

  private func footer(_ d: Dhikr, count: Int, total: Int) -> some View {
    let last = index >= total - 1
    return HStack(spacing: DS.Space.s3) {
      Button { advance(total) } label: { Text("تخطِّ").font(DS.F.labelMd).foregroundStyle(DS.C.textTertiary) }
        .buttonStyle(.plain).frame(width: 64)
      DSButton(title: last ? "إنهاء" : "التالي", kind: .primary, icon: last ? "checkmark" : "chevron.forward") { advance(total) }
      DSIconButton(systemName: "chevron.backward", label: "السابق") { if index > 0 { withAnimation(.snappy(duration: 0.2)) { index -= 1 } } }
        .opacity(index > 0 ? 1 : 0.35).disabled(index == 0)
    }
    .padding(.horizontal, DS.Space.s4).padding(.top, DS.Space.s2).padding(.bottom, DS.Space.s3)
    .background(DS.C.bgCanvas)
  }

  // MARK: أفعال

  private func count(_ d: Dhikr, current: Int) {
    let target = d.target(for: period)
    guard current < target else { advance(list.count); return }
    var p = AdhkarSession.current(model)
    if period == "evening" { var e = p.evening ?? [:]; e[d.id] = current + 1; p.evening = e }
    else { var m = p.morning ?? [:]; m[d.id] = current + 1; p.morning = m }
    model.content.adhkarProgress = p
    pulse = true; DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) { pulse = false }
    if current + 1 >= target {
      UINotificationFeedbackGenerator().notificationOccurred(.success)
      markStreakIfComplete(p)
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { advance(list.count) }
    } else {
      UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
  }
  private func advance(_ total: Int) {
    if index + 1 < total { withAnimation(.snappy(duration: 0.2)) { index += 1 } } else { dismiss() }
  }
  private func reset() {
    var p = AdhkarSession.current(model)
    if period == "evening" { p.evening = [:] } else { p.morning = [:] }
    model.content.adhkarProgress = p; index = 0; showSettings = false
  }
  /// تُسجَّل السلسلة عندما تكتمل كل أذكار الفترة
  private func markStreakIfComplete(_ p: WebSettings.AdhkarProgress) {
    let map = (period == "evening" ? p.evening : p.morning) ?? [:]
    let items = list
    guard items.allSatisfy({ (map[$0.id] ?? 0) >= $0.target(for: period) }) else { return }
    model.content.adhkarLog = AdhkarStreak.mark(model.content.adhkarLog, day: model.todayKey, period: period)
  }
  private func toggleAudio(_ d: Dhikr) {
    if playingId == d.id { player?.pause(); playingId = nil; return }
    // `hisnId` معرّف الذكر في الكتاب لا رقم بابه (كان يُقرأ بابًا فتُشغَّل تلاوة ذكرٍ آخر)
    guard let it = Hisn.item(id: d.hisnId), it.hasAudio else { return }
    try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
    let p = AVPlayer(url: it.audioURL); player = p; playingId = d.id; p.play()
    NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: p.currentItem, queue: .main) { _ in playingId = nil }
  }
}


/// حصن المسلم كاملًا: أقسام وأبواب مع بحث، وباب بعدّاد لكل ذكر وتلاوة صوتية ومفضلة.
/// يُفتح مصفّى بموضوع (شرائح «الذكر») فلا تظهر إلا أقسامه وزرّ «كل الأبواب»، أو ببحثٍ جاهز (حقل القسم في «الذكر»)
struct HisnView: View {
  @Environment(AppModel.self) private var model
  var theme: HisnTheme? = nil
  @State private var query: String
  @State private var showAll = false
  init(theme: HisnTheme? = nil, initialQuery: String = "") {
    self.theme = theme
    _query = State(initialValue: initialQuery)
  }
  var body: some View {
    let numerals = model.settings.numerals
    let favs = model.content.hisnFavorites
    let res = Hisn.search(query)
    let searching = CityDatabase.normalize(query).count >= 2
    let picked = theme?.sections ?? []
    let filtered = theme != nil && !showAll && !picked.isEmpty
    let sections = filtered ? picked : Hisn.sections
    List {
      if searching {
        if !res.chapters.isEmpty { Section("أبواب (\(Fmt.number(res.chapters.count, numerals: numerals)))") { ForEach(res.chapters) { c in chapterRow(c, fav: favs.contains(c.id), numerals: numerals) } } }
        if !res.items.isEmpty { Section("أذكار (\(Fmt.number(res.items.count, numerals: numerals))\(res.items.count >= 60 ? "+" : ""))") { ForEach(res.items, id: \.item.id) { r in NavigationLink { HisnChapterView(chapter: r.chapter, focusItem: r.item.id).tabBarClearance() } label: { VStack(alignment: .leading, spacing: 3) { Text(r.item.text.count > 110 ? String(r.item.text.prefix(110)) + "…" : r.item.text).font(DS.F.readingSm).lineLimit(2); Text(r.chapter.title).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary) } } } } }
        if res.chapters.isEmpty && res.items.isEmpty { Text("لا نتائج — جرّب كلمة أخرى").foregroundStyle(DS.C.textSecondary) }
      } else {
        if !filtered && !favs.isEmpty { Section("♥ المفضلة") { ForEach(favs.compactMap { Hisn.chapter($0) }) { c in chapterRow(c, fav: true, numerals: numerals) } } }
        ForEach(sections, id: \.title) { s in Section(s.title) { ForEach(s.chapters.compactMap { Hisn.chapter($0) }) { c in chapterRow(c, fav: favs.contains(c.id), numerals: numerals) } } }
        if filtered {
          Section {
            Button { withAnimation(.snappy(duration: 0.2)) { showAll = true } } label: { DSLinkLabel(title: "كل الأبواب (\(Fmt.number(Hisn.chapters.count, numerals: numerals)))") }
          }
        }
        Section { Text("\(Fmt.number(Hisn.chapters.count, numerals: numerals)) بابًا و\(Fmt.number(Hisn.itemCount, numerals: numerals)) ذكرًا من كتاب «حصن المسلم» للشيخ سعيد بن علي بن وهف القحطاني، بنصوص الطبعة الرسمية وتشكيلها.").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary) }
      }
    }
    .scrollContentBackground(.hidden).background(DS.C.bgCanvas)
    .searchable(text: $query, prompt: "ابحث في الأبواب والأذكار…")
    .navigationTitle(filtered ? (theme?.title ?? "حصن المسلم") : "حصن المسلم").navigationBarTitleDisplayMode(.inline)
  }
  private func chapterRow(_ c: HisnChapter, fav: Bool, numerals: String) -> some View {
    NavigationLink { HisnChapterView(chapter: c).tabBarClearance() } label: {
      HStack(spacing: DS.Space.s3) {
        Text(Fmt.number(c.id, numerals: numerals)).font(DS.F.labelSm).foregroundStyle(DS.C.brandPrimary)
          .frame(width: 34, height: 34).background(DS.C.brandSoft, in: Circle())
        VStack(alignment: .leading, spacing: 2) { Text(c.title).font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary); Text(countLabel(c.items.count, numerals: numerals)).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary) }
        Spacer()
        if fav { Image(systemName: "heart.fill").foregroundStyle(DS.C.danger).font(.system(size: 13)) }
      }
    }
  }
  static func countLabel(_ n: Int, numerals: String) -> String { n == 1 ? "ذكر واحد" : n == 2 ? "ذكران" : n <= 10 ? "\(Fmt.number(n, numerals: numerals)) أذكار" : "\(Fmt.number(n, numerals: numerals)) ذكرًا" }
  private func countLabel(_ n: Int, numerals: String) -> String { Self.countLabel(n, numerals: numerals) }
}

/// باب من حصن المسلم: عدّاد جلسة لكل ذكر (لا يُحفظ)، تلاوة من موقع الكتاب عند الطلب، مفضلة، وتنقل بين الأبواب.
/// `focusItem`: ذكرٌ بعينه يُمرَّر إليه عند الفتح (من «مفضّلتي» ونتائج البحث)
struct HisnChapterView: View {
  @Environment(AppModel.self) private var model
  let chapter: HisnChapter
  var focusItem: Int? = nil
  @State private var counts: [Int: Int] = [:]
  @State private var playingId: Int?
  @State private var player: AVPlayer?
  @State private var shareCard: ShareCardRequest?
  @State private var didFocus = false
  var body: some View {
    let numerals = model.settings.numerals
    let idx = Hisn.chapters.firstIndex { $0.id == chapter.id } ?? 0
    let prev = idx > 0 ? Hisn.chapters[idx - 1] : nil, next = idx + 1 < Hisn.chapters.count ? Hisn.chapters[idx + 1] : nil
    let fav = model.content.hisnFavorites.contains(chapter.id)
    ScrollViewReader { proxy in
      ScrollView {
        VStack(spacing: DS.Space.s3) {
          Text("الباب \(Fmt.number(chapter.id, numerals: numerals))، \(HisnView.countLabel(chapter.items.count, numerals: numerals))").font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary)
          if chapter.id == 27 { Text("أذكار الصباح والمساء بعدّاد يومي محفوظ في تبويب «الذكر»").font(DS.F.labelSm).foregroundStyle(DS.C.brandPrimary) }
          ForEach(chapter.items) { it in
            let c = counts[it.id] ?? 0
            DhikrCard(text: it.text, target: it.repeatCount, count: c, audioURL: it.hasAudio ? it.audioURL : nil, isPlayingAudio: playingId == it.id,
                      shareTitle: "من حصن المسلم", shareText: "\(it.text)\n\n— حصن المسلم: \(chapter.title)",
                      onTap: { if c >= it.repeatCount { counts[it.id] = 0 } else { counts[it.id] = c + 1; if c + 1 >= it.repeatCount { UINotificationFeedbackGenerator().notificationOccurred(.success) } else { UIImpactFeedbackGenerator(style: .light).impactOccurred() } } },
                      onAudio: { toggleAudio(it) },
                      onShareImage: { shareCard = ShareCardRequest(title: "حصن المسلم: \(chapter.title)", text: it.text, footer: it.repeatCount > 1 ? "يُقال \(DhikrCard.repeatLabel(it.repeatCount, numerals: numerals))" : "", quran: false, shareText: "\(it.text)\n\n— حصن المسلم: \(chapter.title)", filename: "hisn-\(it.id).png") })
              .id(it.id)
          }
          HStack {
            if let p = prev { NavigationLink { HisnChapterView(chapter: p).tabBarClearance() } label: { DSButtonLabel(title: p.title, kind: .outline, icon: "chevron.forward", fill: false) }.buttonStyle(.plain) }
            Spacer()
            if let n = next { NavigationLink { HisnChapterView(chapter: n).tabBarClearance() } label: { DSButtonLabel(title: n.title, kind: .outline, icon: "chevron.backward", fill: false) }.buttonStyle(.plain) }
          }
          Text("حصن المسلم من أذكار الكتاب والسنة — الشيخ سعيد بن علي بن وهف القحطاني. التلاوة الصوتية تُجلب من موقع الكتاب عند الطلب فقط.").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).multilineTextAlignment(.center)
        }
        .padding(DS.Space.s4)
        .readableWidth()
      }
      .onAppear {
        guard let f = focusItem, !didFocus else { return }
        didFocus = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { withAnimation(.easeInOut(duration: 0.3)) { proxy.scrollTo(f, anchor: .top) } }
      }
    }
    .background(DS.C.bgCanvas)
    .navigationTitle(chapter.title).navigationBarTitleDisplayMode(.inline)
    .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { model.content.toggleHisnFavorite(chapter.id) } label: { Image(systemName: fav ? "heart.fill" : "heart").foregroundStyle(fav ? DS.C.danger : DS.C.brandPrimary) }.accessibilityLabel(fav ? "إزالة من المفضلة" : "إضافة إلى المفضلة") } }
    .onDisappear { player?.pause(); playingId = nil }
    .sheet(item: $shareCard) { ShareCardSheet(request: $0).environment(model) }
  }
  private func toggleAudio(_ it: HisnItem) {
    if playingId == it.id { player?.pause(); playingId = nil; return }
    try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
    let p = AVPlayer(url: it.audioURL); player = p; playingId = it.id; p.play()
    NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: p.currentItem, queue: .main) { _ in playingId = nil }
  }
}

/// تسمية صف: أيقونة بقرص ناعم مع عنوان ووصف — تُستعمل داخل المفاتيح
struct DSRowLabel: View {
  let icon: String
  let title: String
  var subtitle: String? = nil
  var body: some View {
    HStack(spacing: DS.Space.s3) {
      DSIcon(systemName: icon, style: .soft, size: 38, iconSize: 16)
      VStack(alignment: .trailing, spacing: 2) {
        Text(title).font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary)
        if let s = subtitle { Text(s).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary) }
      }
    }
  }
}

/// ورقة تذكيرات الأذكار: مفاتيح الصباح والمساء ومقدار التأخير عن الوقت
struct AdhkarRemindersSheet: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  var body: some View {
    NavigationStack {
      Form { ExtraRemindersSection().environment(model) }
        .navigationTitle("تذكيرات الأذكار").navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("تم") { dismiss() } } }
    }
    .presentationDetents([.medium, .large])
  }
}
