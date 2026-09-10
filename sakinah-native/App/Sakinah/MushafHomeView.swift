import SwiftUI
import SakinahCore

/// شاشة المصحف (تصميم Figma 02): بطاقة متابعة القراءة مع حلقة الختمة، بلاطات سريعة، بطاقة الختمة/التحدّيات، وفهرس مقسّم (السور/الأجزاء/العلامات) مع بحث
struct MushafHomeView: View {
  @Environment(AppModel.self) private var model
  @State private var target: ReaderTarget?
  @State private var query = ""
  @State private var searching = false
  @State private var tab = 0
  @State private var sheet: HomeSheet?
  @State private var editBookmark: Ayah?
  @FocusState private var searchFocused: Bool

  struct ReaderTarget: Identifiable { let page: Int; var ayah: Int? = nil; var id: String { "\(page)-\(ayah ?? 0)" } }
  enum HomeSheet: Identifiable { case khatmah, challenges, reciter, display, downloads; var id: Int { switch self { case .khatmah: return 1; case .challenges: return 2; case .reciter: return 3; case .display: return 4; case .downloads: return 5 } } }

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
            LazyVStack(spacing: 14) {
              continueCard
              quickTiles
              if let k = khatmahCard { k }
              readingCard
              indexCard
            }
            .padding(.horizontal, 20).padding(.top, 8).padding(.bottom, 24)
          }
        }
      }
      .background(DS.C.bgCanvas)
      .toolbar(.hidden, for: .navigationBar)
      .safeAreaInset(edge: .bottom) { if model.player.current != nil { AudioBarView(onPickReciter: { sheet = .reciter }, onGoToPage: { target = ReaderTarget(page: $0) }).padding(.horizontal, 12).padding(.bottom, 6) } }
      .fullScreenCover(item: $target) { t in MushafReaderView(startPage: t.page, ayah: t.ayah).environment(model) }
      .sheet(item: $sheet) { sh in
        switch sh {
        case .khatmah: KhatmahSheet().environment(model)
        case .challenges: ChallengesSheet().environment(model)
        case .reciter: ReciterPickerSheet().environment(model)
        case .display: DisplaySheet(onLegend: {}).environment(model)
        case .downloads: DownloadsView(focusSurah: model.settings.lastRead?.surah).environment(model)
        }
      }
      .sheet(item: $editBookmark) { a in BookmarkSheet(ayah: a, onDone: { _ in }).environment(model).presentationDetents([.medium]) }
    }
  }

  // MARK: رأس الصفحة والبحث
  private var header: some View {
    HStack(spacing: 8) {
      Text("المصحف").font(DS.F.displayLg).foregroundStyle(DS.C.textPrimary)
      Spacer()
      DSIconButton(systemName: "magnifyingglass", label: "بحث") { withAnimation(.snappy(duration: 0.2)) { searching.toggle(); if searching { searchFocused = true } else { query = "" } } }
      DSIconButton(systemName: "textformat.size", label: "العرض") { sheet = .display }
    }
    .padding(.horizontal, 20).padding(.top, 6).padding(.bottom, 4)
  }
  private var searchField: some View {
    HStack(spacing: 8) {
      Image(systemName: "magnifyingglass").foregroundStyle(DS.C.textTertiary)
      TextField("سورة، آية، نص، أو رقم صفحة…", text: $query).font(DS.F.bodyMd).focused($searchFocused).submitLabel(.search)
      if !query.isEmpty { Button { query = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(DS.C.textTertiary) }.buttonStyle(.plain) }
    }
    .padding(.horizontal, 14).padding(.vertical, 10)
    .background(DS.C.bgSurface, in: Capsule()).overlay { Capsule().stroke(DS.C.borderSubtle, lineWidth: 1) }
    .padding(.horizontal, 20).padding(.bottom, 8)
    .transition(.move(edge: .top).combined(with: .opacity))
  }

  // MARK: بطاقة المتابعة
  private var num: (Int) -> String { { Fmt.number($0, numerals: model.settings.numerals) } }
  private var continueCard: some View {
    let s = model.settings; let q = model.quran; let last = s.lastRead; let today = model.todayKey
    let page = last?.page ?? 1
    let plan = q.khatmah
    let stt = plan.map { Khatmah.status($0, currentPage: page, log: q.readLog, today: today) }
    let pct = stt.map { Double($0.percent) / 100 } ?? Double(page) / 604
    let khatmahLine: String = {
      if let stt, let plan { return stt.finished ? "تقبّل الله ✦ أتممت الختمة" : "الختمة: اليوم \(num(min(plan.days, stt.done / max(1, stt.todayTarget) + 1))) من \(num(plan.days)) · \(stt.todayPages >= stt.todayTarget ? "أتممت ورد اليوم ✓" : "بقي \(num(max(0, stt.todayTarget - stt.todayPages))) صفحات لورد اليوم")" }
      return "ابدأ خطة ختمة لتقسيم المصحف على أيامك"
    }()
    return VStack(alignment: .leading, spacing: 16) {
      HStack(spacing: 16) {
        VStack(alignment: .leading, spacing: 4) {
          Text(last == nil ? "ابدأ القراءة" : "متابعة القراءة").font(DS.F.labelSm).foregroundStyle(DS.C.textOnDarkMuted)
          Text(last.map { "سورة \(QuranMeta.surah($0.surah).name)" } ?? "سورة الفاتحة").font(DS.F.displayMd).foregroundStyle(DS.C.textOnDark)
          Text(last.map { "الصفحة \(num($0.page)) · الجزء \(num(QuranMeta.juz(ofPage: $0.page))) · الآية \(num($0.ayah))" } ?? "مصحف المدينة · حفص عن عاصم · ٦٠٤ صفحات").font(DS.F.labelSm).foregroundStyle(DS.C.textOnDarkMuted)
          Button { sheet = .khatmah } label: { Text(khatmahLine).font(DS.F.labelSm).foregroundStyle(DS.C.accentGold).multilineTextAlignment(.leading).padding(.top, 4) }.buttonStyle(.plain)
        }
        Spacer(minLength: 0)
        ZStack {
          RingProgress(progress: pct, tint: DS.C.accentGold, track: Color.white.opacity(0.25), lineWidth: 7)
          Text("\(num(Int((pct * 100).rounded())))٪").font(DS.F.numericMd).foregroundStyle(DS.C.textOnDark)
        }
        .frame(width: 84, height: 84)
      }
      DSButton(title: last == nil ? "ابدأ من الفاتحة" : "تابع من حيث توقفت", kind: .gold, icon: "chevron.forward") {
        target = ReaderTarget(page: page, ayah: last.flatMap { QuranText.shared.ayah(surah: $0.surah, ayah: $0.ayah)?.n })
      }
    }
    .padding(20)
    .nightCard()
  }

  // MARK: بلاطات سريعة
  private var quickTiles: some View {
    let q = model.quran; let streak = Khatmah.streak(q.readLog, today: model.todayKey)
    return VStack(spacing: 10) {
      HStack(spacing: 10) {
        tile("bookmark", "العلامات", "\(num(q.bookmarks.count)) علامة") { withAnimation { tab = 2 } }
        tile("headphones", "الاستماع", "\(num(Catalog.shared.reciters.count)) قارئًا · تنزيل") { sheet = .downloads }
      }
      HStack(spacing: 10) {
        tile("mic", "مراجعة الحفظ", "من الصفحة الحالية") { target = ReaderTarget(page: model.settings.lastRead?.page ?? 1) }
        tile("flame", "التحدّيات", streak > 0 ? "سلسلة \(num(streak)) أيام" : "ابدأ تحدّيًا") { sheet = .challenges }
      }
    }
  }
  private func tile(_ icon: String, _ title: String, _ sub: String, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      HStack(spacing: 10) {
        DSIcon(systemName: icon, style: .soft, size: 40, iconSize: 17)
        VStack(alignment: .leading, spacing: 1) { Text(title).font(DS.F.labelMd).foregroundStyle(DS.C.textPrimary); Text(sub).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).lineLimit(1) }
        Spacer(minLength: 0)
      }
      .dsTile(padding: 12)
    }.buttonStyle(.plain)
  }

  // MARK: الختمة
  private var khatmahCard: AnyView? {
    let q = model.quran; let s = model.settings; let today = model.todayKey
    guard let plan = q.khatmah else { return nil }
    let cur = s.lastRead?.page ?? plan.startPage
    let stt = Khatmah.status(plan, currentPage: cur, log: q.readLog, today: today)
    let streak = Khatmah.streak(q.readLog, today: today)
    return AnyView(VStack(alignment: .leading, spacing: 12) {
      HStack { Text(stt.finished ? "تقبّل الله ✦ أتممت الختمة" : "خطة الختمة · \(num(plan.days)) يومًا").font(DS.F.headingMd).foregroundStyle(DS.C.textPrimary); Spacer(); Button { sheet = .khatmah } label: { DSLinkLabel(title: "تعديل") }.buttonStyle(.plain) }
      ProgressTrack(progress: Double(stt.percent) / 100, tint: DS.C.accentGold, track: DS.C.bgSubtle)
      HStack(spacing: 10) {
        DSStatTile(value: "\(num(stt.percent))٪", label: "\(num(stt.done)) من \(num(604))")
        DSStatTile(value: "\(num(stt.todayPages))/\(num(stt.todayTarget))", label: "ورد اليوم")
        DSStatTile(value: num(streak), label: "سلسلة الأيام")
      }
      HStack { Text(stt.behind > 0 ? "متأخّر \(num(stt.behind)) صفحة" : "على الجدول ✓").font(DS.F.labelSm).foregroundStyle(stt.behind > 0 ? DS.C.danger : DS.C.success); Spacer(); Text("الإتمام المتوقع: \(Fmt.shortDate(key: stt.etaKey, numerals: s.numerals))").font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary) }
    }.dsCard(padding: 16))
  }

  // MARK: التحدّيات وخريطة القراءة
  private var readingCard: some View {
    let q = model.quran; let numerals = model.settings.numerals; let today = model.todayKey
    let pr = Challenges.progress(q.challenge, log: q.readLog, today: today)
    let hasLog = !q.readLog.isEmpty
    return VStack(alignment: .leading, spacing: 12) {
      if let pr {
        HStack { Text(pr.finished ? "✓ أتممت: \(pr.name)" : pr.name).font(DS.F.headingMd).foregroundStyle(DS.C.textPrimary); Spacer(); Text(pr.finished ? "" : pr.late ? "انتهت المدة" : "اليوم \(num(pr.dayIndex + 1)) من \(num(Catalog.shared.challenge(pr.id)?.days ?? 1))").font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary) }
        ProgressTrack(progress: Double(pr.pct) / 100, tint: pr.late ? DS.C.danger : DS.C.brandPrimary, track: DS.C.bgSubtle)
        HStack(spacing: 8) {
          Text("\(num(pr.done)) / \(num(pr.total)) صفحة\(pr.finished ? "" : " · يتبقى نحو \(num(pr.minutesLeft)) دقيقة")").font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary)
          Spacer()
          if pr.finished { DSButton(title: "تحدٍّ جديد", kind: .soft, fill: false) { sheet = .challenges } }
          else { DSButton(title: "اقرأ", kind: .primary, icon: "play.fill", fill: false) { var done = Set<Int>(); for (k, pages) in q.readLog where k >= (q.challenge?.startedAt ?? "") { done.formUnion(pages) }; var p = pr.from; while p < pr.to && done.contains(p) { p += 1 }; target = ReaderTarget(page: p) } }
          DSButton(title: "إنهاء", kind: .outline, fill: false) { q.challenge = nil }
        }
      } else {
        HStack { Text(hasLog ? "قراءتك في ٩٠ يومًا" : "تحدّيات القراءة").font(DS.F.headingMd).foregroundStyle(DS.C.textPrimary); Spacer(); Button { sheet = .challenges } label: { DSLinkLabel(title: "ابدأ تحدّيًا") }.buttonStyle(.plain) }
        if !hasLog { Text("سورة الكهف يوم الجمعة، جزء عمّ في أسبوع، الملك كل ليلة… بمدة تقديرية وتقدّم يومي.").font(DS.F.bodySm).foregroundStyle(DS.C.textSecondary) }
      }
      if hasLog || pr != nil { HeatmapView(days: Challenges.heatmap(q.readLog, today: today, days: 90), numerals: numerals) }
    }
    .dsCard(padding: 16)
  }

  // MARK: الفهرس
  private var indexCard: some View {
    let s = model.settings; let q = model.quran
    return VStack(spacing: 6) {
      DSSegmented(items: ["السور", "الأجزاء", "العلامات"], selection: $tab)
      switch tab {
      case 0:
        ForEach(QuranMeta.surahs) { su in
          Button { target = ReaderTarget(page: su.page, ayah: QuranText.shared.ayah(surah: su.n, ayah: 1)?.n) } label: { SurahRow(surah: su, numerals: s.numerals) }.buttonStyle(.plain)
        }
      case 1:
        ForEach(QuranMeta.juzStarts, id: \.juz) { j in
          Button { target = ReaderTarget(page: j.page) } label: { NavRow(num: num(j.juz), title: QuranMeta.juzName(j.juz, vocalized: false), sub: "يبدأ من \(QuranMeta.surah(j.surah).name): \(num(j.ayah))", page: num(j.page)) }.buttonStyle(.plain)
        }
      default:
        if q.bookmarks.isEmpty { Text("لا علامات بعد — انقر كلمة في المصحف ثم «علامة مع ملاحظة»، أو زر العلامة في شريط القارئ").font(DS.F.bodySm).foregroundStyle(DS.C.textSecondary).padding(12) }
        ForEach(q.bookmarks.reversed(), id: \.self) { b in
          if let a = QuranText.shared.ayah(surah: b.surah, ayah: b.ayah) {
            Button { target = ReaderTarget(page: a.page, ayah: a.n) } label: { BookmarkRow(bookmark: b, ayah: a, numerals: s.numerals).padding(.horizontal, 8).padding(.vertical, 8) }.buttonStyle(.plain)
              .contextMenu { Button { editBookmark = a } label: { Label("تعديل", systemImage: "pencil") }; Button(role: .destructive) { q.removeBookmark(a) } label: { Label("حذف", systemImage: "trash") } }
          }
        }
      }
    }
    .dsCard(padding: 12)
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
        }.buttonStyle(.plain)
      }
    }
    .padding(4).background(DS.C.bgSubtle, in: RoundedRectangle(cornerRadius: DS.Radius.lg, style: .continuous))
  }
}

/// خريطة حرارة القراءة (90 يومًا): مربعات أسبوعية
struct HeatmapView: View {
  let days: [HeatDay]; let numerals: String
  var body: some View {
    let mx = max(1, days.map(\.count).max() ?? 1)
    let total = days.reduce(0) { $0 + $1.count }; let active = days.filter { $0.count > 0 }.count
    VStack(alignment: .leading, spacing: 6) {
      Canvas { ctx, size in
        let cols = Int((Double(days.count) / 7).rounded(.up)); let cell = min(size.width / CGFloat(cols), size.height / 7); let gap: CGFloat = 2
        for (i, d) in days.enumerated() {
          let col = i / 7, row = i % 7
          let x = size.width - CGFloat(col + 1) * cell + gap / 2, y = CGFloat(row) * cell + gap / 2
          let lvl = d.count == 0 ? 0.0 : d.count >= Int(Double(mx) * 0.75) ? 1.0 : d.count >= Int(Double(mx) * 0.5) ? 0.75 : d.count >= Int(Double(mx) * 0.25) ? 0.5 : 0.3
          ctx.fill(Path(roundedRect: CGRect(x: x, y: y, width: cell - gap, height: cell - gap), cornerRadius: 2), with: .color(lvl == 0 ? DS.C.bgSubtle : DS.C.brandPrimary.opacity(lvl)))
        }
      }
      .frame(height: 7 * 11)
      HStack { Text("قبل ٩٠ يومًا").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary); Spacer(); Text("\(Fmt.number(total, numerals: numerals)) صفحة · \(Fmt.number(active, numerals: numerals)) يوم قراءة").font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary); Spacer(); Text("اليوم").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary) }
    }
    .accessibilityLabel("خريطة القراءة لآخر 90 يومًا: \(total) صفحة في \(active) يومًا")
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

/// فهرس المصحف داخل القارئ: السور (مع بحث)، الأجزاء، والعلامات
struct MushafIndexView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  let currentPage: Int
  var onSelect: (Int) -> Void
  @State private var tab = 0
  @State private var query = ""
  var body: some View {
    let numerals = model.settings.numerals
    NavigationStack {
      VStack(spacing: 0) {
        DSSegmented(items: ["السور", "الأجزاء", "العلامات"], selection: $tab).padding(.horizontal).padding(.bottom, 8)
        switch tab {
        case 0: SurahListView(query: $query, currentPage: currentPage) { onSelect($0) }
        case 1:
          List(QuranMeta.juzStarts, id: \.juz) { j in Button { onSelect(j.page) } label: { NavRow(num: Fmt.number(j.juz, numerals: numerals), title: QuranMeta.juzName(j.juz, vocalized: false), sub: "\(QuranMeta.surah(j.surah).name) · الآية \(Fmt.number(j.ayah, numerals: numerals))", page: Fmt.number(j.page, numerals: numerals), current: QuranMeta.juz(ofPage: currentPage) == j.juz) }.tint(.primary) }.listStyle(.plain)
        default:
          List {
            if model.quran.bookmarks.isEmpty { Text("لا علامات بعد").foregroundStyle(DS.C.textSecondary) }
            ForEach(model.quran.bookmarks.reversed(), id: \.self) { b in if let a = QuranText.shared.ayah(surah: b.surah, ayah: b.ayah) { Button { onSelect(a.page) } label: { BookmarkRow(bookmark: b, ayah: a, numerals: numerals) }.tint(.primary) } }
          }.listStyle(.plain)
        }
      }
      .background(DS.C.bgCanvas)
      .navigationTitle("الفهرس").navigationBarTitleDisplayMode(.inline)
      .toolbar { ToolbarItem(placement: .cancellationAction) { Button("إغلاق") { dismiss() }.font(DS.F.labelMd) } }
    }
  }
}

/// قائمة السور مع بحث بالاسم (تطبيع الهمزات والتاء المربوطة والتشكيل)
struct SurahListView: View {
  @Environment(AppModel.self) private var model
  @Binding var query: String
  var currentPage: Int = 0
  var onSelect: (Int) -> Void
  private var filtered: [Surah] {
    let q = CityDatabase.normalize(query)
    if q.isEmpty { return QuranMeta.surahs }
    if let n = Int(QuranNormalize.foldDigits(q)), (1...114).contains(n) { return [QuranMeta.surah(n)] }
    return QuranMeta.surahs.filter { CityDatabase.normalize($0.plain).contains(q) || CityDatabase.normalize($0.name).contains(q) || $0.en.lowercased().contains(q) }
  }
  var body: some View {
    let s = model.settings
    List(filtered) { su in
      Button { onSelect(su.page) } label: { SurahRow(surah: su, numerals: s.numerals, current: currentPage >= su.page && currentPage < (su.n < 114 ? QuranMeta.surah(su.n + 1).page : 605)) }.tint(.primary)
    }
    .listStyle(.plain)
    .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "ابحث عن سورة")
  }
}

/// صفّ سورة: شارة معيّنية برقمها، الاسم ونوعها وعدد آياتها، ورقم الصفحة
struct SurahRow: View {
  let surah: Surah; let numerals: String; var current = false
  var body: some View {
    HStack(spacing: 12) {
      ZStack {
        RoundedRectangle(cornerRadius: 6, style: .continuous).fill(current ? DS.C.accentGoldSoft : DS.C.brandSoft).frame(width: 28, height: 28).rotationEffect(.degrees(45))
        Text(Fmt.number(surah.n, numerals: numerals)).font(DS.F.labelSm).foregroundStyle(current ? DS.C.accentGoldStrong : DS.C.brandPrimary)
      }
      .frame(width: 40, height: 40)
      VStack(alignment: .leading, spacing: 1) {
        Text(surah.name).font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary)
        Text("\(surah.type) · \(Fmt.number(surah.ayahs, numerals: numerals)) آية").font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary)
      }
      Spacer()
      if current { Image(systemName: "bookmark.fill").foregroundStyle(DS.C.accentGold) }
      VStack(spacing: 0) { Text(Fmt.number(surah.page, numerals: numerals)).font(DS.F.numericMd).foregroundStyle(DS.C.textSecondary); Text("صفحة").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary) }
    }
    .padding(.vertical, 8).padding(.horizontal, 8)
    .contentShape(Rectangle())
  }
}
