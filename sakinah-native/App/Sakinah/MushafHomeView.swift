import SwiftUI
import SakinahCore

/// تبويب «القرآن» (المرحلة الخامسة — quran.png): رأسٌ بعنوانه ومصحفه وزرّ البحث، بطاقة «متابعة القراءة» الليلية
/// (الموضع، وورد اليوم والختمة)، أربع أدوات (الاستماع، الحفظ، الختمة، للمراجعة)، الفهرس بشرائحه الأربع،
/// ثم «التزامك بالورد» بأربعة عشر يومًا — حضورٌ يُرى بهدوء، لا سلسلة تنكسر.
/// ملاحظة اتجاه: البيئة RTL، فأوّل عنصر في HStack يقع يمينًا، و`.leading` هو اليمين.
struct MushafHomeView: View {
  @Environment(AppModel.self) private var model
  @State private var target: ReaderTarget?
  @State private var query = ""
  @State private var searching = false
  @State private var tab = ScreenshotMode.libraryTab
  @State private var sheet: HomeSheet? = ScreenshotMode.librarySheet ? .khatmah : nil
  @State private var editBookmark: Ayah?
  @FocusState private var searchFocused: Bool
  /// الجذر ظاهر: وحده يستهلك صفحةً معلّقة وصلت والتبويب ظاهرٌ أصلًا (رابط «اقرأ حصّتك» من النشاط المباشر)
  @State private var rootVisible = false
  /// «للمراجعة»: الآيات الموسومة «ضعيفة» (شاشة تُدفع فوق التبويب)
  @State private var showReview = ScreenshotMode.reviewAyahs

  struct ReaderTarget: Identifiable { let page: Int; var ayah: Int? = nil; var autoplay = false; var hifz = false; var id: String { "\(page)-\(ayah ?? 0)-\(autoplay)-\(hifz)" } }
  enum HomeSheet: Identifiable { case khatmah, reciter; var id: Int { self == .khatmah ? 1 : 2 } }

  var body: some View {
    NavigationStack {
      VStack(spacing: 0) {
        header
        if searching { searchField }
        if !query.isEmpty {
          List { QuranSearchRows(query: query) { p, n in target = ReaderTarget(page: p, ayah: n) } }
            .listStyle(.insetGrouped).scrollContentBackground(.hidden).background(DS.C.bgCanvas)
        } else {
          ScrollView(showsIndicators: false) {
            // عمود كسول واحد: صفوف الفهرس عناصره مباشرةً (عمود كسول داخل عمود كسول لا يُعاد رسمه عند تبديل التبويب)
            LazyVStack(spacing: 0) {
              heroCard.padding(.bottom, 14)
              if MushafPack.shared.phase != .ready { MushafPackCard().padding(.bottom, 14) }
              toolsRow.padding(.bottom, 18)
              indexHead.zIndex(1)
              indexRows.transaction { $0.animation = nil }
              commitmentSection.padding(.top, 22)
              Text("مصحف المدينة، حفص عن عاصم، \(num(Khatmah.total)) صفحات، يعمل دون اتصال").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).frame(maxWidth: .infinity).padding(.top, 18)
            }
            .padding(.horizontal, 20).padding(.top, 8).padding(.bottom, 24)
          }
        }
      }
      // عرضٌ مقروء على الآيباد (لا أثر له على الهاتف)
      .readableWidth(760)
      .background(DS.C.bgCanvas)
      .toolbar(.hidden, for: .navigationBar)
      .safeAreaInset(edge: .bottom) { if model.player.current != nil { AudioBarView(onPickReciter: { sheet = .reciter }, onGoToPage: { p in DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { target = ReaderTarget(page: p) } }) } }
      .tabBarClearance()
      .fullScreenCover(item: $target) { t in MushafReaderView(startPage: t.page, ayah: t.ayah, autoplay: t.autoplay, hifz: t.hifz).environment(model) }
      // «تابع القراءة» من الرئيسية: تُفتح الصفحة حين يظهر التبويب (بعد لحظة كي يكون العرض قد استقرّ)
      .onAppear {
        rootVisible = true
        if let p = model.pendingReaderPage { model.pendingReaderPage = nil; Task { @MainActor in try? await Task.sleep(for: .milliseconds(80)); target = ReaderTarget(page: p) } }
        // لقطة تحقّق: تبديل التبويب بعد الظهور بالمسار نفسه الذي يسلكه النقر على الشرائح
        if ScreenshotMode.switchLibraryTab { DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { tab = 1 } }
      }
      .sheet(item: $sheet) { sh in
        switch sh {
        case .khatmah: KhatmahSheet(onGo: { p in sheet = nil; DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { target = ReaderTarget(page: p) } }).environment(model)
        case .reciter: ReciterPickerSheet().environment(model)
        }
      }
      .sheet(item: $editBookmark) { a in BookmarkSheet(ayah: a, onDone: { _ in }).environment(model).presentationDetents([.medium]) }
      .navigationDestination(isPresented: $showReview) { ReviewAyahsView().environment(model).tabBarClearance() }
      .onDisappear { rootVisible = false }
      .onChange(of: model.pendingReaderPage) { _, p in
        guard rootVisible, let p else { return }
        model.pendingReaderPage = nil
        // «اقرأ حصّتك» يصل والمراجعة مدفوعة: يُغلق الدفع أوّلًا كي يُقدَّم القارئ من الجذر
        showReview = false
        target = ReaderTarget(page: p)
      }
    }
  }

  // MARK: رأس الصفحة والبحث — زرّ البحث وحده (العرض والخطّ يخصّان القارئ)
  private var header: some View {
    SectionScreenHeader(title: "القرآن", subtitle: "مصحف المدينة، حفص عن عاصم") {
      DSIconButton(systemName: searching ? "xmark" : "magnifyingglass", label: searching ? "إغلاق البحث" : "بحث في المصحف") { toggleSearch() }
    }
    .padding(.horizontal, 20).padding(.top, 6).padding(.bottom, 8)
  }
  private func toggleSearch() { withAnimation(.snappy(duration: 0.2)) { searching.toggle(); if searching { searchFocused = true } else { query = "" } } }
  private var searchField: some View {
    HStack(spacing: 8) {
      Image(systemName: "magnifyingglass").foregroundStyle(DS.C.textTertiary)
      TextField("سورة، آية، نص، أو رقم صفحة…", text: $query).font(DS.F.bodyMd).focused($searchFocused).submitLabel(.search)
      if !query.isEmpty { Button { query = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(DS.C.textTertiary) }.buttonStyle(.plain).accessibilityLabel("مسح") }
    }
    .padding(.horizontal, 14).padding(.vertical, 10)
    .background(DS.C.bgSurface, in: Capsule()).overlay { Capsule().stroke(DS.C.borderSubtle, lineWidth: 1) }
    .padding(.horizontal, 20).padding(.bottom, 8)
    .transition(.move(edge: .top).combined(with: .opacity))
  }

  // MARK: بطاقة «متابعة القراءة»
  private var num: (Int) -> String { { Fmt.number($0, numerals: model.settings.numerals) } }
  /// حالة الختمة من سجلّ الورد (تقدّم الموضع) — لا من آخر صفحة مفتوحة
  private var khatmahStatus: KhatmahStatus? { model.quran.khatmah.map { Khatmah.status($0, wird: model.quran.wird, today: model.todayKey) } }
  /// آية آخر موضع قراءة (رقمها المتسلسل) كي يُفتح القارئ عليها
  private var lastAyahN: Int? { model.settings.lastRead.flatMap { QuranText.shared.ayah(surah: $0.surah, ayah: $0.ayah)?.n } }

  /// سطر الورد في رأس البطاقة: «ورد اليوم ٢ من ٥ صفحات، الختمة ٤٠٪» — وبعد الإتمام سطره، وبلا خطة لا شيء
  private func wirdLine(_ stt: KhatmahStatus?) -> String? {
    guard model.quran.khatmah != nil, let stt else { return nil }
    if stt.finished { return "تقبّل الله، أتممتَ الختمة ✦" }
    let target = max(1, stt.todayTarget)
    if stt.todayPages >= target { return "أتممتَ ورد اليوم ✓، الختمة \(num(stt.percent))٪" }
    let pages = ArabicCount.phrase(target, one: "صفحة واحدة", two: "صفحتين", few: "صفحات", many: "صفحة", numerals: model.settings.numerals)
    return "ورد اليوم \(num(stt.todayPages)) من \(pages)، الختمة \(num(stt.percent))٪"
  }
  /// تسمية البطاقة: «ختمة رمضان، اليوم N» في رمضان بخطّته (طبعة رمضان — المرحلة الرابعة)، وإلا «متابعة القراءة»
  private var heroLabel: String {
    if let rd = RamadanEdition.day(model, now: Date()), RamadanEdition.isRamadanPlan(model.quran.khatmah) { return "ختمة رمضان، اليوم \(num(rd.day))" }
    return model.settings.lastRead == nil ? "ابدأ القراءة" : "متابعة القراءة"
  }

  private var heroCard: some View {
    let last = model.settings.lastRead
    let page = last?.page ?? 1
    let stt = khatmahStatus
    // بخطة: نسبة الختمة؛ وبلا خطة: موضعك من المصحف
    let progress: Double = stt.map { Double($0.percent) / 100 } ?? Double(page) / Double(Khatmah.total)
    let place = last.map { "صفحة \(num($0.page))، الجزء \(num(QuranMeta.juz(ofPage: $0.page)))، من الآية \(num($0.ayah))" } ?? "صفحة \(num(1))، الجزء \(num(1))"
    return VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .center, spacing: 8) {
        HStack(spacing: 6) {
          Circle().fill(DS.C.accentGold).frame(width: 7, height: 7)
          Text(heroLabel).font(DS.F.labelSm).foregroundStyle(DS.C.textOnDarkMuted).lineLimit(1)
        }
        Spacer(minLength: 6)
        if let line = wirdLine(stt) {
          Button { sheet = .khatmah } label: {
            Text(line).font(DS.readex(11.5, .medium)).foregroundStyle(Color(hex: 0xE2C77A)).lineLimit(1).minimumScaleFactor(0.7)
          }
          .buttonStyle(.plain).accessibilityHint("خطة الختمة")
        }
      }
      Text(last.map { "سورة \(QuranMeta.surah($0.surah).name)" } ?? "سورة الفاتحة").font(DS.amiri(28, bold: true)).foregroundStyle(DS.C.textOnDark).lineLimit(1).minimumScaleFactor(0.75)
      Text(place).font(DS.F.labelSm).foregroundStyle(DS.C.textOnDarkMuted).lineLimit(1).minimumScaleFactor(0.8)
      ProgressTrack(progress: progress, tint: DS.C.accentGold, track: Color.white.opacity(0.18), height: 5).padding(.vertical, 4).accessibilityHidden(true)
      if model.quran.khatmah == nil {
        Button { sheet = .khatmah } label: {
          Text("ابدأ خطة ختمة تقسّم المصحف على أيامك").font(DS.readex(12, .medium)).foregroundStyle(Color(hex: 0xE2C77A)).lineLimit(2).multilineTextAlignment(.leading)
        }
        .buttonStyle(.plain)
      }
      Button { target = ReaderTarget(page: page, ayah: lastAyahN) } label: {
        HStack(spacing: 6) { Text(last == nil ? "افتح المصحف" : "تابع القراءة").font(DS.readex(14, .semibold)); Image(systemName: "chevron.forward").font(.system(size: 11, weight: .bold)) }
          .foregroundStyle(Color(hex: 0x16211F)).padding(.vertical, 11).padding(.horizontal, 18).background(DS.C.accentGold, in: Capsule())
      }
      .buttonStyle(.plain).padding(.top, 4)
    }
    .padding(20)
    .frame(maxWidth: .infinity, alignment: .leading)
    .nightCard()
  }

  // MARK: الأدوات الأربع
  private var toolsRow: some View {
    let last = model.settings.lastRead
    let reciter = Catalog.shared.reciter(model.quran.reciter).name
    let surahName = last.map { QuranMeta.surah($0.surah).name } ?? "الفاتحة"
    let weak = model.quran.weakAyahs.count
    return HStack(alignment: .top, spacing: 10) {
      toolTile("headphones", "الاستماع", hint: "\(reciter)، من سورة \(surahName)") { target = ReaderTarget(page: last?.page ?? 1, ayah: lastAyahN, autoplay: true) }
      toolTile("mic", "الحفظ", hint: "مراجعة الحفظ من صفحتك، على الجهاز") { target = ReaderTarget(page: last?.page ?? 1, hifz: true) }
      toolTile("calendar", "الختمة", hint: "خطة الختمة والأوراد") { sheet = .khatmah }
      toolTile("bookmark", "للمراجعة", hint: weak > 0 ? "\(weak) من الآيات الموسومة ضعيفة" : "الآيات الموسومة ضعيفة", badge: weak) { showReview = true }
    }
  }
  private func toolTile(_ icon: String, _ title: String, hint: String, badge: Int = 0, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      VStack(spacing: 8) {
        Image(systemName: icon).font(.system(size: 21, weight: .regular)).foregroundStyle(DS.C.brandPrimary)
          .frame(width: 60, height: 60)
          .background(DS.C.bgSurface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
          .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(DS.C.borderSubtle, lineWidth: 1))
          .overlay(alignment: .topTrailing) {
            if badge > 0 {
              Text(num(badge)).font(DS.readex(10, .semibold)).foregroundStyle(Color(hex: 0x16211F))
                .padding(.horizontal, 5).frame(minWidth: 18, minHeight: 18)
                .background(DS.C.accentGold, in: Capsule())
                .padding(4)
            }
          }
        Text(title).font(DS.F.labelSm).foregroundStyle(DS.C.textPrimary).lineLimit(1).minimumScaleFactor(0.8)
      }
      .frame(maxWidth: .infinity).contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityLabel(title).accessibilityHint(hint)
  }

  // MARK: الفهرس: رأسٌ بأربع شرائح ثم صفوف هي عناصر العمود الكسول نفسه
  private static let indexTabs = ["السور", "الأجزاء", "الأحزاب", "العلامات"]
  private var indexHead: some View {
    // التبديل بلا withAnimation: تحريك تبديل مئات الصفوف الكسولة ترك المقسّم بلا استجابة بعد أوّل نقرة (اختبار الواجهة)
    HStack(spacing: 6) {
      ForEach(Array(Self.indexTabs.enumerated()), id: \.offset) { i, label in
        let on = tab == i
        Button { tab = i } label: {
          Text(label).font(DS.F.labelMd).foregroundStyle(on ? DS.C.textOnBrand : DS.C.textSecondary)
            .lineLimit(1).minimumScaleFactor(0.8)
            .frame(maxWidth: .infinity).padding(.vertical, 9)
            .background(on ? DS.C.brandPrimary : DS.C.bgSurface, in: Capsule())
            .overlay { if !on { Capsule().stroke(DS.C.borderSubtle, lineWidth: 1) } }
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        // نقرة متزامنة احتياطًا: اختبار الواجهة رصد ضياع نقرةٍ أولى على الزرّ داخل عمود التمرير
        .simultaneousGesture(TapGesture().onEnded { tab = i })
        .accessibilityAddTraits(on ? .isSelected : [])
      }
    }
    .animation(.snappy(duration: 0.2), value: tab)
    .padding(.horizontal, 12).padding(.top, 12).padding(.bottom, 6)
    .background(DS.C.bgSurface)
    .clipShape(UnevenRoundedRectangle(topLeadingRadius: DS.Radius.xl, bottomLeadingRadius: 0, bottomTrailingRadius: 0, topTrailingRadius: DS.Radius.xl, style: .continuous))
  }
  /// صفوف الفهرس نموذجًا واحدًا: ForEach واحد تتبدّل بياناته مع التبويب (لا تبديل بين ForEach مختلفة الأنواع داخل العمود الكسول)
  private enum IndexItem: Identifiable {
    case surah(Surah), juz(JuzStart), hizb(Int), bookmark(WebSettings.Bookmark, Ayah), empty
    var id: String { switch self { case .surah(let s): return "s\(s.n)"; case .juz(let j): return "j\(j.juz)"; case .hizb(let h): return "h\(h)"; case .bookmark(_, let a): return "b\(a.n)"; case .empty: return "empty" } }
  }
  private var indexItems: [IndexItem] {
    switch tab {
    case 0: return QuranMeta.surahs.map { .surah($0) }
    case 1: return QuranMeta.juzStarts.map { .juz($0) }
    case 2: return (1...60).map { .hizb($0) }
    default:
      let items: [IndexItem] = model.quran.bookmarks.reversed().compactMap { b in QuranText.shared.ayah(surah: b.surah, ayah: b.ayah).map { .bookmark(b, $0) } }
      return items.isEmpty ? [.empty] : items
    }
  }
  private var indexRows: some View {
    let items = indexItems; let n = model.settings.numerals; let q = model.quran
    return ForEach(Array(items.enumerated()), id: \.element.id) { i, item in
      IndexRow(first: i == 0, last: i == items.count - 1) {
        switch item {
        case .surah(let su):
          Button { target = ReaderTarget(page: su.page, ayah: QuranText.shared.ayah(surah: su.n, ayah: 1)?.n) } label: { SurahRow(surah: su, numerals: n) }.buttonStyle(.plain)
        case .juz(let j):
          Button { target = ReaderTarget(page: j.page) } label: { JuzRow(start: j, numerals: n) }.buttonStyle(.plain)
        case .hizb(let h):
          HizbRow(hizb: h, numerals: n) { p in target = ReaderTarget(page: p) }
        case .bookmark(let b, let a):
          Button { target = ReaderTarget(page: a.page, ayah: a.n) } label: { BookmarkRow(bookmark: b, ayah: a, numerals: n).padding(.horizontal, 4).padding(.vertical, 8) }.buttonStyle(.plain)
            .contextMenu { Button { editBookmark = a } label: { Label("تعديل", systemImage: "pencil") }; Button(role: .destructive) { q.removeBookmark(a) } label: { Label("حذف", systemImage: "trash") } }
        case .empty:
          Text("لا علامات بعد — انقر كلمة في المصحف ثم «علامة» في رصيف الآية").font(DS.F.bodySm).foregroundStyle(DS.C.textSecondary).frame(maxWidth: .infinity, alignment: .leading).padding(12)
        }
      }
    }
  }

  // MARK: التزامك بالورد — أربعة عشر يومًا، لا سلسلة تنكسر
  private var commitmentSection: some View {
    let q = model.quran; let today = model.todayKey
    let hasPlan = q.khatmah != nil
    // بخطة: يومٌ بلغ فيه الورد هدفه؛ وبلا خطة: يومٌ قُرئت فيه صفحة واحدة على الأقل (سجلّ القراءة)
    let days: [Bool] = hasPlan
      ? Wird.commitment(q.wird, today: today, target: q.khatmah?.dailyPages ?? 1, days: 14).days
      : Challenges.heatmap(q.readLog, today: today, days: 14).map { $0.count > 0 }
    let done = days.filter { $0 }.count
    let line = done == 0
      ? "ابدأ اليوم: كل صفحةٍ تقرؤها تُحتسب"
      : "قرأتَ \(ArabicCount.phrase(done, one: "يومًا واحدًا", two: "يومين", few: "أيام", many: "يومًا", numerals: model.settings.numerals)) من الأربعة عشر الأخيرة"
    return VStack(spacing: 10) {
      DSSectionHead("التزامك بالورد") {
        Button { sheet = .khatmah } label: { DSLinkLabel(title: hasPlan ? "الختمة" : "ابدأ خطة").frame(minHeight: 44).contentShape(Rectangle()) }
          .buttonStyle(.plain).accessibilityLabel("خطة الختمة")
      }
      VStack(alignment: .leading, spacing: 12) {
        Text(line).font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary).fixedSize(horizontal: false, vertical: true)
        // من الأقدم (يمينًا) إلى اليوم (يسارًا)؛ اليوم بإطارٍ ذهبيّ ما لم يُقرأ بعد
        HStack(spacing: 4) {
          ForEach(Array(days.enumerated()), id: \.offset) { i, on in
            RoundedRectangle(cornerRadius: 6, style: .continuous).fill(on ? DS.C.brandPrimary : DS.C.bgSubtle).frame(height: 22)
              .overlay {
                if i == days.count - 1 && !on { RoundedRectangle(cornerRadius: 6, style: .continuous).stroke(DS.C.accentGold, lineWidth: 1.5) }
              }
          }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("التزامك بالورد: \(done) من ١٤ يومًا")
        Text(hasPlan ? "لا سلسلة تنكسر: يومٌ فاتك يُوزَّع على ما بقي." : "لا سلسلة تنكسر: كل يومٍ تقرأ فيه يُحتسب.").font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary)
      }
      .todayCard(padding: 16)
    }
  }
}

/// صفّ من صفوف الفهرس على سطح البطاقة: يلي الرأس مباشرةً، وبين الصفوف فاصل، والأخير يُغلق الزوايا؛
/// `top` حين لا رأس فوقه (ورقة التنقّل)
struct IndexRow<Content: View>: View {
  var first = false; var last = false; var top = false
  @ViewBuilder var content: Content
  var body: some View {
    VStack(spacing: 0) {
      content
      if !last { Divider().overlay(DS.C.borderSubtle).padding(.leading, 56) }
    }
    .padding(.horizontal, 12).padding(.top, first ? 4 : 0).padding(.bottom, last ? 12 : 0)
    .frame(maxWidth: .infinity)
    .background(DS.C.bgSurface)
    .clipShape(UnevenRoundedRectangle(topLeadingRadius: top ? DS.Radius.xl : 0, bottomLeadingRadius: last ? DS.Radius.xl : 0, bottomTrailingRadius: last ? DS.Radius.xl : 0, topTrailingRadius: top ? DS.Radius.xl : 0, style: .continuous))
  }
}

/// نجمة ثمانية (رسم Figma) لأرقام السور والأجزاء
struct EightPointStar: Shape {
  var inner: CGFloat = 0.78
  func path(in r: CGRect) -> Path {
    let c = CGPoint(x: r.midX, y: r.midY); let R = min(r.width, r.height) / 2
    var p = Path()
    for i in 0..<16 {
      let a = Double(i) * .pi / 8 - .pi / 2 + .pi / 16
      let rr = i % 2 == 0 ? R : R * inner
      let pt = CGPoint(x: c.x + rr * cos(a), y: c.y + rr * sin(a))
      if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
    }
    p.closeSubpath(); return p
  }
}

/// رقم داخل نجمة ثمانية بحدّ ذهبي
struct StarNumber: View {
  let text: String; var current = false
  var body: some View {
    ZStack {
      EightPointStar().fill(current ? DS.C.accentGoldSoft : DS.C.paperPage)
      EightPointStar().stroke(DS.C.accentGold.opacity(current ? 1 : 0.9), lineWidth: current ? 1.6 : 1.2)
      Text(text).font(DS.kufi(12, .semibold)).foregroundStyle(DS.C.accentGoldStrong)
    }
    .frame(width: 38, height: 38)
    .accessibilityHidden(true)
  }
}

/// حبّة رقم الصفحة «صفحة N» (يسار الصفّ) — رماديّة هادئة كما في quran.png
struct PagePill: View {
  let text: String
  var body: some View { Text(text).font(DS.readex(11, .medium)).foregroundStyle(DS.C.textSecondary).lineLimit(1).fixedSize().padding(.vertical, 5).padding(.horizontal, 10).background(DS.C.bgSubtle, in: Capsule()) }
}

/// صفّ سورة: نجمة برقمها، الاسم بخطّ Amiri ونوعها وعدد آياتها، وحبّة الصفحة
struct SurahRow: View {
  let surah: Surah; let numerals: String; var current = false
  var body: some View {
    HStack(spacing: 12) {
      StarNumber(text: Fmt.number(surah.n, numerals: numerals), current: current)
      VStack(alignment: .leading, spacing: 1) {
        Text(surah.name).font(DS.amiri(19)).foregroundStyle(DS.C.textPrimary)
        Text("\(surah.type)، \(ArabicCount.phrase(surah.ayahs, one: "آية واحدة", two: "آيتان", few: "آيات", many: "آية", numerals: numerals))").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
      }
      Spacer(minLength: 4)
      if current { Image(systemName: "bookmark.fill").foregroundStyle(DS.C.accentGold).accessibilityHidden(true) }
      PagePill(text: "صفحة \(Fmt.number(surah.page, numerals: numerals))")
    }
    .padding(.vertical, 9).padding(.horizontal, 4)
    .contentShape(Rectangle())
    .accessibilityElement(children: .combine)
    .accessibilityLabel("سورة \(surah.name)، \(surah.type)، \(surah.ayahs) آية، صفحة \(surah.page)")
  }
}

/// صفّ جزء: رقمه في نجمة، اسمه، وأوّله من المتن (مصحف المدينة)
struct JuzRow: View {
  let start: JuzStart; let numerals: String
  var body: some View {
    HStack(spacing: 12) {
      StarNumber(text: Fmt.number(start.juz, numerals: numerals))
      VStack(alignment: .leading, spacing: 1) {
        Text(QuranMeta.juzName(start.juz, vocalized: false)).font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary)
        HStack(spacing: 6) {
          Text(QuranText.shared.juzStartPhrase(start.juz)).font(MushafFonts.font(MushafFonts.amiriQuranFont, size: 13)).foregroundStyle(DS.C.textSecondary)
          Text("— \(QuranMeta.surah(start.surah).name) \(Fmt.number(start.ayah, numerals: numerals))").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
        }
      }
      Spacer(minLength: 4)
      PagePill(text: "صفحة \(Fmt.number(start.page, numerals: numerals))")
    }
    .padding(.vertical, 9).padding(.horizontal, 4)
    .contentShape(Rectangle())
  }
}

/// صفّ حزب: بدايته، وأرباعه الأربعة ۞ كحبّات تنقل إلى موضع كل ربع
struct HizbRow: View {
  let hizb: Int; let numerals: String; var onGo: (Int) -> Void
  var body: some View {
    let quarters = QuranText.shared.quarters(ofHizb: hizb)
    let first = quarters.first
    HStack(spacing: 12) {
      Button { if let p = first?.page { onGo(p) } } label: {
        HStack(spacing: 12) {
          StarNumber(text: Fmt.number(hizb, numerals: numerals))
          VStack(alignment: .leading, spacing: 1) {
            Text("الحزب \(Fmt.number(hizb, numerals: numerals))").font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary)
            Text(first.map { "الجزء \(Fmt.number($0.juz, numerals: numerals))، \(QuranMeta.surah($0.surah).name) \(Fmt.number($0.ayah, numerals: numerals))، صفحة \(Fmt.number($0.page, numerals: numerals))" } ?? "").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).lineLimit(1).minimumScaleFactor(0.8)
          }
        }
        .contentShape(Rectangle())
      }.buttonStyle(.plain)
      Spacer(minLength: 4)
      HStack(spacing: 4) {
        ForEach(Array(quarters.enumerated()), id: \.offset) { i, a in
          Button { onGo(a.page) } label: {
            Text(Fmt.number(i + 1, numerals: numerals)).font(DS.readex(10.5, .medium)).foregroundStyle(DS.C.accentGoldStrong)
              .frame(width: 26, height: 26).background(DS.C.accentGoldSoft.opacity(0.7), in: Circle())
              .frame(width: 32, height: 44).contentShape(Rectangle())
          }.buttonStyle(.plain).accessibilityLabel("الربع \(i + 1) من الحزب \(hizb)، صفحة \(a.page)")
        }
      }
    }
    .padding(.vertical, 9).padding(.horizontal, 4)
  }
}

/// تحكّم مقسّم بأسلوب نظام التصميم
struct DSSegmented: View {
  let items: [String]
  @Binding var selection: Int
  var body: some View {
    // التبديل بلا withAnimation: تحريك تبديل مئات الصفوف الكسولة ترك المقسّم بلا استجابة بعد أوّل نقرة
    // (اختبار واجهة حقيقي: نقرة «الأجزاء» تعمل ثم «الأحزاب» لا تصل) — يتحرّك التظليل وحده هنا
    HStack(spacing: 4) {
      ForEach(Array(items.enumerated()), id: \.offset) { i, label in
        let on = selection == i
        Button { selection = i } label: {
          Text(label).font(DS.F.labelSm).foregroundStyle(on ? DS.C.textPrimary : DS.C.textSecondary)
            .frame(maxWidth: .infinity).padding(.vertical, 8)
            .background(on ? DS.C.bgSurface : .clear, in: RoundedRectangle(cornerRadius: DS.Radius.md, style: .continuous))
            .shadow(color: on ? DS.C.shadowCard : .clear, radius: 6, y: 2)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        // نقرة متزامنة احتياطًا: اختبار الواجهة رصد ضياع نقرةٍ أولى على الزرّ داخل عمود التمرير (تصل بعدها نقرة الإحداثيات نفسها)
        .simultaneousGesture(TapGesture().onEnded { selection = i })
        .accessibilityAddTraits(on ? .isSelected : [])
      }
    }
    .animation(.snappy(duration: 0.2), value: selection)
    .padding(4).background(DS.C.bgSubtle, in: RoundedRectangle(cornerRadius: DS.Radius.lg, style: .continuous))
  }
}


struct BookmarkRow: View {
  let bookmark: WebSettings.Bookmark; let ayah: Ayah; let numerals: String
  var body: some View {
    let c: Color = bookmark.color == "green" ? DS.C.success : bookmark.color == "red" ? DS.C.danger : bookmark.color == "blue" ? Color(hex: 0x2B6CB0) : DS.C.accentGold
    HStack(spacing: 12) {
      DSIcon(systemName: "bookmark.fill", style: .soft, size: 40, iconSize: 16).foregroundStyle(c)
      VStack(alignment: .leading, spacing: 2) {
        Text("\(QuranMeta.surah(ayah.surah).name): \(Fmt.number(ayah.ayah, numerals: numerals))").font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary)
        if let n = bookmark.note, !n.isEmpty { Text(n).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).lineLimit(2) }
        else { Text(ayah.text.count > 70 ? String(ayah.text.prefix(70)) + "…" : ayah.text).font(MushafFonts.font(MushafFonts.amiriQuranFont, size: 13)).foregroundStyle(DS.C.textSecondary).lineLimit(1) }
      }
      Spacer()
      VStack(spacing: 0) { Text(Fmt.number(ayah.page, numerals: numerals)).font(DS.F.numericMd).foregroundStyle(DS.C.textSecondary); Text("صفحة").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary) }
    }
    .contentShape(Rectangle())
  }
}

/// صفوف نتائج البحث داخل قائمة الشاشة الرئيسية
struct QuranSearchRows: View {
  @Environment(AppModel.self) private var model
  let query: String
  var onGo: (Int, Int?) -> Void
  var body: some View {
    let numerals = model.settings.numerals
    let s = QuranNormalize.foldDigits(query.trimmingCharacters(in: .whitespaces))
    if let p = Int(s), (1...604).contains(p) {
      Section { Button { onGo(p, nil) } label: { NavRow(num: Fmt.number(p, numerals: numerals), title: "الانتقال إلى الصفحة \(Fmt.number(p, numerals: numerals))", sub: QuranText.shared.label(ofPage: p).map { "\(QuranMeta.surah($0.surah).name)، الجزء \(Fmt.number($0.juz, numerals: numerals))" } ?? "", page: Fmt.number(p, numerals: numerals)) }.tint(.primary) }
    } else if let ref = QuranSearch.parseRef(s), let a = QuranText.shared.ayah(surah: ref.surah.n, ayah: min(ref.surah.ayahs, ref.ayah)) {
      Section { Button { onGo(a.page, a.n) } label: { NavRow(num: Fmt.number(a.surah, numerals: numerals), title: "سورة \(ref.surah.name) — الآية \(Fmt.number(a.ayah, numerals: numerals))", sub: "الصفحة \(Fmt.number(a.page, numerals: numerals))", page: Fmt.number(a.page, numerals: numerals)) }.tint(.primary) }
    } else {
      let surahs = QuranSearch.matchSurahs(s)
      let ayahs = s.count >= 2 ? QuranSearch.shared.search(s, limit: 30) : []
      if !surahs.isEmpty { Section("سور") { ForEach(surahs) { su in Button { onGo(su.page, QuranText.shared.ayah(surah: su.n, ayah: 1)?.n) } label: { SurahRow(surah: su, numerals: numerals) }.tint(.primary) } } }
      if !ayahs.isEmpty {
        Section("آيات (\(Fmt.number(ayahs.count, numerals: numerals))\(ayahs.count == 30 ? "+" : ""))") {
          ForEach(ayahs) { a in Button { onGo(a.page, a.n) } label: { HStack { VStack(alignment: .leading, spacing: 3) { Text(a.text.count > 90 ? String(a.text.prefix(90)) + "…" : a.text).font(MushafFonts.font(MushafFonts.amiriQuranFont, size: 15)).lineLimit(2); Text(QuranSearch.refLabel(a)).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary) }; Spacer(); Text("صفحة \(Fmt.number(a.page, numerals: numerals))").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary) }.contentShape(Rectangle()) }.tint(.primary) }
        }
      }
      if surahs.isEmpty && ayahs.isEmpty { Section { Text("لا نتائج").foregroundStyle(DS.C.textSecondary) } }
    }
  }
}
