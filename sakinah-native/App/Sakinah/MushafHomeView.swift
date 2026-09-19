import SwiftUI
import SakinahCore

/// مكتبة المصحف (تصميم Figma «٨ · المصحف» بعد مراجعة الخبراء): بطاقة حالةٍ واحدة (صورة الصفحة + الورد + الختمة)،
/// بلاطتان لا تكرّران الشريط السفلي، الفهرس فوق الطيّة ببحث ومقسّم رباعي، ثم «التزامك بالورد» بصفّ ثنائي لأربعة عشر يومًا
struct MushafHomeView: View {
  @Environment(AppModel.self) private var model
  @State private var target: ReaderTarget?
  @State private var query = ""
  @State private var searching = false
  @State private var tab = ScreenshotMode.libraryTab
  @State private var sheet: HomeSheet? = ScreenshotMode.librarySheet ? .khatmah : nil
  @State private var editBookmark: Ayah?
  @FocusState private var searchFocused: Bool

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
              tilesRow.padding(.bottom, 14)
              indexHead
              indexRows
              commitmentCard.padding(.top, 14)
              Text("مصحف المدينة · حفص عن عاصم · ٦٠٤ صفحات · يعمل دون اتصال").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).frame(maxWidth: .infinity).padding(.top, 18)
            }
            .padding(.horizontal, 20).padding(.top, 8).padding(.bottom, 24)
          }
        }
      }
      .background(DS.C.bgCanvas)
      .toolbar(.hidden, for: .navigationBar)
      .safeAreaInset(edge: .bottom) { if model.player.current != nil { AudioBarView(onPickReciter: { sheet = .reciter }, onGoToPage: { p in DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { target = ReaderTarget(page: p) } }) } }
      .tabBarClearance()
      .fullScreenCover(item: $target) { t in MushafReaderView(startPage: t.page, ayah: t.ayah, autoplay: t.autoplay, hifz: t.hifz).environment(model) }
      // «تابع القراءة» من الرئيسية: تُفتح الصفحة حين يظهر التبويب (بعد لحظة كي يكون العرض قد استقرّ)
      .onAppear {
        if let p = model.pendingReaderPage { model.pendingReaderPage = nil; Task { @MainActor in try? await Task.sleep(for: .milliseconds(80)); target = ReaderTarget(page: p) } }
        // لقطة تحقّق: تبديل التبويب بعد الظهور بالمسار نفسه الذي يسلكه النقر على المقسّم
        if ScreenshotMode.switchLibraryTab { DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { withAnimation(.snappy(duration: 0.2)) { tab = 1 } } }
      }
      .sheet(item: $sheet) { sh in
        switch sh {
        case .khatmah: KhatmahSheet(onGo: { p in sheet = nil; DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { target = ReaderTarget(page: p) } }).environment(model)
        case .reciter: ReciterPickerSheet().environment(model)
        }
      }
      .sheet(item: $editBookmark) { a in BookmarkSheet(ayah: a, onDone: { _ in }).environment(model).presentationDetents([.medium]) }
    }
  }

  // MARK: رأس الصفحة والبحث — زرّ البحث وحده (العرض والخطّ يخصّان القارئ)
  private var header: some View {
    HStack(spacing: 8) {
      Text("المصحف").font(DS.F.displayLg).foregroundStyle(DS.C.textPrimary)
      Spacer()
      DSIconButton(systemName: searching ? "xmark" : "magnifyingglass", label: searching ? "إغلاق البحث" : "بحث") { toggleSearch() }
    }
    .padding(.horizontal, 20).padding(.top, 6).padding(.bottom, 4)
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

  // MARK: بطاقة الحالة الواحدة
  private var num: (Int) -> String { { Fmt.number($0, numerals: model.settings.numerals) } }
  /// حالة الختمة من سجلّ الورد (تقدّم الموضع) — لا من آخر صفحة مفتوحة
  private var khatmahStatus: KhatmahStatus? { model.quran.khatmah.map { Khatmah.status($0, wird: model.quran.wird, today: model.todayKey) } }
  private var heroCard: some View {
    let s = model.settings; let last = s.lastRead
    let page = last?.page ?? 1
    let stt = khatmahStatus
    let wirdLine: String = {
      guard let stt, model.quran.khatmah != nil else { return "ابدأ خطة ختمة لتقسيم المصحف على أيامك" }
      if stt.finished { return "تقبّل الله ✦ أتممت الختمة" }
      let target = max(1, stt.todayTarget); let state = stt.todayPages >= target ? "أتممت ورد اليوم ✓" : (stt.behind > 0 ? "ما فات يُوزَّع على الأيام الباقية" : "على الجدول ✓")
      return "ورد اليوم: \(num(min(stt.todayPages, target))) من \(num(target)) صفحة  ·  الختمة \(num(stt.percent))٪  ·  \(state)"
    }()
    return HStack(alignment: .top, spacing: 14) {
      VStack(alignment: .leading, spacing: 5) {
        Text(last == nil ? "ابدأ القراءة" : "متابعة القراءة").font(DS.F.labelSm).foregroundStyle(DS.C.textOnDarkMuted)
        Text(last.map { "سورة \(QuranMeta.surah($0.surah).name)" } ?? "سورة الفاتحة").font(DS.amiri(24, bold: true)).foregroundStyle(DS.C.textOnDark).lineLimit(1).minimumScaleFactor(0.8)
        Text(last.map { "الصفحة \(num($0.page))  ·  الجزء \(num(QuranMeta.juz(ofPage: $0.page)))  ·  الآية \(num($0.ayah))" } ?? "الصفحة ١  ·  الجزء ١").font(DS.F.labelSm).foregroundStyle(DS.C.textOnDarkMuted).lineLimit(1).minimumScaleFactor(0.8)
        Button { sheet = .khatmah } label: { Text(wirdLine).font(DS.readex(12, .medium)).foregroundStyle(Color(hex: 0xE2C77A)).multilineTextAlignment(.leading).lineLimit(2).minimumScaleFactor(0.85) }.buttonStyle(.plain).accessibilityHint("خطة الختمة")
        Button { target = ReaderTarget(page: page, ayah: last.flatMap { QuranText.shared.ayah(surah: $0.surah, ayah: $0.ayah)?.n }) } label: {
          HStack(spacing: 6) { Text(last == nil ? "افتح المصحف" : "تابع القراءة").font(DS.readex(13.5, .semibold)); Image(systemName: "chevron.forward").font(.system(size: 10, weight: .bold)) }
            .foregroundStyle(Color(hex: 0x16211F)).padding(.vertical, 10).padding(.horizontal, 16).background(DS.C.accentGold, in: Capsule())
        }
        .buttonStyle(.plain).padding(.top, 6)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      ZStack(alignment: .topLeading) {
        MiniPageThumb(page: page, numerals: s.numerals)
        if last != nil { RoundedRectangle(cornerRadius: 2).fill(DS.C.accentGold).frame(width: 10, height: 26).offset(x: 6, y: -6) }
      }
    }
    .padding(20)
    .nightCard()
    .accessibilityElement(children: .combine)
  }

  // MARK: بلاطتان — لا تكرّران الشريط السفلي ولا الفهرس
  private var tilesRow: some View {
    let s = model.settings; let last = s.lastRead
    let reciter = Catalog.shared.reciter(model.quran.reciter).name
    let surahName = last.map { QuranMeta.surah($0.surah).name } ?? "الفاتحة"
    return HStack(spacing: 10) {
      tile("play.fill", "الاستماع", "\(reciter) · \(surahName)") { target = ReaderTarget(page: last?.page ?? 1, ayah: last.flatMap { QuranText.shared.ayah(surah: $0.surah, ayah: $0.ayah)?.n }, autoplay: true) }
      tile("mic", "مراجعة الحفظ", "من صفحتك · على الجهاز") { target = ReaderTarget(page: last?.page ?? 1, hifz: true) }
    }
  }
  private func tile(_ icon: String, _ title: String, _ sub: String, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      HStack(spacing: 10) {
        DSIcon(systemName: icon, style: .soft, size: 38, iconSize: 16)
        VStack(alignment: .leading, spacing: 2) { Text(title).font(DS.readex(13, .semibold)).foregroundStyle(DS.C.textPrimary); Text(sub).font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).lineLimit(1).minimumScaleFactor(0.8) }
        Spacer(minLength: 0)
      }
      .padding(.vertical, 12).padding(.horizontal, 12)
      .background(DS.C.bgSurface, in: RoundedRectangle(cornerRadius: DS.Radius.lg, style: .continuous))
      .shadow(color: DS.C.shadowCard, radius: 12, x: 0, y: 6)
      .contentShape(RoundedRectangle(cornerRadius: DS.Radius.lg, style: .continuous))
    }.buttonStyle(.plain)
  }

  // MARK: الفهرس فوق الطيّة: رأس (بحث ومقسّم رباعي) ثم صفوف هي عناصر العمود الكسول نفسه
  private var indexHead: some View {
    VStack(spacing: 8) {
      Button { toggleSearch() } label: {
        HStack(spacing: 8) {
          Image(systemName: "magnifyingglass").font(.system(size: 14, weight: .medium)).foregroundStyle(DS.C.textTertiary)
          Text("سورة، آية، نص، أو رقم صفحة…").font(DS.F.bodySm).foregroundStyle(DS.C.textTertiary)
          Spacer()
        }
        .padding(.horizontal, 14).padding(.vertical, 11)
        .background(DS.C.bgCanvas, in: Capsule()).overlay { Capsule().stroke(DS.C.borderSubtle, lineWidth: 1) }
        .contentShape(Capsule())
      }
      .buttonStyle(.plain).accessibilityLabel("بحث في المصحف")
      DSSegmented(items: ["السور", "الأجزاء", "الأحزاب", "العلامات"], selection: $tab)
    }
    .padding(12)
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

  // MARK: التزامك بالورد — صفّ ثنائي لا سلسلة تنكسر
  private var commitmentCard: some View {
    let q = model.quran; let today = model.todayKey
    let target = q.khatmah?.dailyPages ?? 1
    let c = Wird.commitment(q.wird, today: today, target: target, days: 14)
    let hasPlan = q.khatmah != nil
    return VStack(alignment: .leading, spacing: 10) {
      HStack {
        Text("التزامك بالورد").font(DS.kufi(16, .semibold)).foregroundStyle(DS.C.textPrimary)
        Spacer()
        Button { sheet = .khatmah } label: { DSLinkLabel(title: hasPlan ? "الختمة" : "ابدأ خطة") }.buttonStyle(.plain)
      }
      Text(hasPlan ? "\(num(c.done)) من \(num(c.total)) يومًا في الأسبوعين الأخيرين" : "خطة ختمة تحوّل القراءة إلى وردٍ يومي بمقدار تختاره").font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary)
      HStack(spacing: 4) {
        ForEach(Array(c.days.enumerated()), id: \.offset) { _, on in
          RoundedRectangle(cornerRadius: 5, style: .continuous).fill(on ? DS.C.brandPrimary : DS.C.bgSubtle).frame(height: 18)
        }
      }
      .accessibilityElement(children: .ignore)
      .accessibilityLabel("التزامك بالورد: \(c.done) من \(c.total) يومًا")
    }
    .dsCard(padding: 16)
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

/// حبّة رقم الصفحة (يسار الصفّ)
struct PagePill: View {
  let text: String
  var body: some View { Text(text).font(DS.readex(11, .medium)).foregroundStyle(DS.C.brandPrimary).padding(.vertical, 5).padding(.horizontal, 10).background(DS.C.brandSoft.opacity(0.55), in: Capsule()) }
}

/// صفّ سورة: نجمة برقمها، الاسم بخطّ Amiri ونوعها وعدد آياتها، وحبّة الصفحة
struct SurahRow: View {
  let surah: Surah; let numerals: String; var current = false
  var body: some View {
    HStack(spacing: 12) {
      StarNumber(text: Fmt.number(surah.n, numerals: numerals), current: current)
      VStack(alignment: .leading, spacing: 1) {
        Text(surah.name).font(DS.amiri(19)).foregroundStyle(DS.C.textPrimary)
        Text("\(surah.type) · \(Fmt.number(surah.ayahs, numerals: numerals)) آية").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
      }
      Spacer(minLength: 4)
      if current { Image(systemName: "bookmark.fill").foregroundStyle(DS.C.accentGold).accessibilityHidden(true) }
      PagePill(text: "ص \(Fmt.number(surah.page, numerals: numerals))")
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
          Text(QuranText.shared.juzStartPhrase(start.juz)).font(.custom(MushafFonts.amiriQuranFont, fixedSize: 13)).foregroundStyle(DS.C.textSecondary)
          Text("· \(QuranMeta.surah(start.surah).name) \(Fmt.number(start.ayah, numerals: numerals))").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
        }
      }
      Spacer(minLength: 4)
      PagePill(text: "ص \(Fmt.number(start.page, numerals: numerals))")
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
            Text(first.map { "الجزء \(Fmt.number($0.juz, numerals: numerals)) · \(QuranMeta.surah($0.surah).name) \(Fmt.number($0.ayah, numerals: numerals)) · ص \(Fmt.number($0.page, numerals: numerals))" } ?? "").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).lineLimit(1).minimumScaleFactor(0.8)
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
    HStack(spacing: 4) {
      ForEach(Array(items.enumerated()), id: \.offset) { i, label in
        let on = selection == i
        Button { withAnimation(.snappy(duration: 0.2)) { selection = i } } label: {
          Text(label).font(DS.F.labelSm).foregroundStyle(on ? DS.C.textPrimary : DS.C.textSecondary)
            .frame(maxWidth: .infinity).padding(.vertical, 8)
            .background(on ? DS.C.bgSurface : .clear, in: RoundedRectangle(cornerRadius: DS.Radius.md, style: .continuous))
            .shadow(color: on ? DS.C.shadowCard : .clear, radius: 6, y: 2)
        }.buttonStyle(.plain).accessibilityAddTraits(on ? .isSelected : [])
      }
    }
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
        else { Text(ayah.text.count > 70 ? String(ayah.text.prefix(70)) + "…" : ayah.text).font(.custom(MushafFonts.amiriQuranFont, fixedSize: 13)).foregroundStyle(DS.C.textSecondary).lineLimit(1) }
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
      Section { Button { onGo(p, nil) } label: { NavRow(num: Fmt.number(p, numerals: numerals), title: "الانتقال إلى الصفحة \(Fmt.number(p, numerals: numerals))", sub: QuranText.shared.label(ofPage: p).map { "\(QuranMeta.surah($0.surah).name) · الجزء \(Fmt.number($0.juz, numerals: numerals))" } ?? "", page: Fmt.number(p, numerals: numerals)) }.tint(.primary) }
    } else if let ref = QuranSearch.parseRef(s), let a = QuranText.shared.ayah(surah: ref.surah.n, ayah: min(ref.surah.ayahs, ref.ayah)) {
      Section { Button { onGo(a.page, a.n) } label: { NavRow(num: Fmt.number(a.surah, numerals: numerals), title: "سورة \(ref.surah.name) — الآية \(Fmt.number(a.ayah, numerals: numerals))", sub: "الصفحة \(Fmt.number(a.page, numerals: numerals))", page: Fmt.number(a.page, numerals: numerals)) }.tint(.primary) }
    } else {
      let surahs = QuranSearch.matchSurahs(s)
      let ayahs = s.count >= 2 ? QuranSearch.shared.search(s, limit: 30) : []
      if !surahs.isEmpty { Section("سور") { ForEach(surahs) { su in Button { onGo(su.page, QuranText.shared.ayah(surah: su.n, ayah: 1)?.n) } label: { SurahRow(surah: su, numerals: numerals) }.tint(.primary) } } }
      if !ayahs.isEmpty {
        Section("آيات (\(Fmt.number(ayahs.count, numerals: numerals))\(ayahs.count == 30 ? "+" : ""))") {
          ForEach(ayahs) { a in Button { onGo(a.page, a.n) } label: { HStack { VStack(alignment: .leading, spacing: 3) { Text(a.text.count > 90 ? String(a.text.prefix(90)) + "…" : a.text).font(.custom(MushafFonts.amiriQuranFont, fixedSize: 15)).lineLimit(2); Text(QuranSearch.refLabel(a)).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary) }; Spacer(); Text("ص \(Fmt.number(a.page, numerals: numerals))").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary) }.contentShape(Rectangle()) }.tint(.primary) }
        }
      }
      if surahs.isEmpty && ayahs.isEmpty { Section { Text("لا نتائج").foregroundStyle(DS.C.textSecondary) } }
    }
  }
}
