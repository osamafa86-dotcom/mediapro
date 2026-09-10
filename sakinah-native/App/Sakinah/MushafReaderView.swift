import SwiftUI
import UIKit
import SakinahCore

/// نوافذ القارئ
enum ReaderSheet: Identifiable {
  case index, quickNav, options, display, legend, reciter, downloads, khatmah, challenges
  case ayah(Int), bookmark(Int), tafsir(Int)
  var id: String { switch self { case .index: return "index"; case .quickNav: return "nav"; case .options: return "opt"; case .display: return "disp"; case .legend: return "leg"; case .reciter: return "rec"; case .downloads: return "dl"; case .khatmah: return "kh"; case .challenges: return "ch"; case .ayah(let n): return "a\(n)"; case .bookmark(let n): return "b\(n)"; case .tafsir(let n): return "t\(n)" } }
}

/// قارئ المصحف: تقليب أفقي من اليمين (أو رأسي)، صفحات المطبوع أو نص متدفق، سمات، تلاوة بتظليل الكلمة، علامات، مراجعة حفظ، وفهرس وبحث
struct MushafReaderView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  @Environment(\.colorScheme) private var scheme
  let startPage: Int
  let startAyah: Int?
  @State private var rs: MushafReaderState?
  @State private var page: Int?
  @State private var chrome = true
  @State private var sheet: ReaderSheet?
  @State private var slider: Double
  @State private var toast: String?
  @State private var toastTask: Task<Void, Never>?
  @State private var dwellTask: Task<Void, Never>?
  @State private var saveTask: Task<Void, Never>?
  @State private var shareItems: ShareItems?
  @State private var shareCard: ShareCardRequest?

  init(startPage: Int, ayah: Int? = nil) {
    let p = min(max(startPage, 1), MushafLayout.totalPages)
    self.startPage = p; startAyah = ayah
    _page = State(initialValue: p); _slider = State(initialValue: Double(p))
  }

  private var prefs: QuranPrefs { model.quran }
  private var current: Int { page ?? startPage }
  private var vertical: Bool { prefs.scroll == "vertical" }

  var body: some View {
    stage
      .onChange(of: model.player.currentWord) { _, w in wordDidChange(w) }
      .onChange(of: model.player.index) { syncPlaying() }
      .onChange(of: model.player.queue.count) { syncPlaying() }
      .onChange(of: model.player.errorVersion) { playerErrorChanged() }
      .onChange(of: hifzFinished) { _, f in hifzDidFinish(f) }
      .onChange(of: hifzError) { _, e in hifzErrorChanged(e) }
      .sheet(item: $sheet, content: sheetView)
      .sheet(item: $shareItems, content: shareSheet)
      .sheet(item: $shareCard, content: shareCardSheet)
  }
  /// المسرح: الصفحات والخلفية والتعتيم والأزرار مع مراقبي الصفحة والسمة
  private var stage: some View {
    ZStack {
      if let rs {
        Rectangle().fill(MushafPalette.background(for: rs.theme)).ignoresSafeArea()
        pager(rs).environment(rs)
        Color.black.opacity(min(0.7, prefs.dim)).ignoresSafeArea().allowsHitTesting(false)
        overlays(rs).environment(rs)
      } else { Theme.paper.ignoresSafeArea() }
    }
    .statusBarHidden(!chrome)
    .persistentSystemOverlays(chrome ? .automatic : .hidden)
    .onAppear(perform: setup)
    .onDisappear(perform: teardown)
    .onChange(of: page) { _, p in pageDidChange(p) }
    .onChange(of: scheme) { syncTheme() }
    .onChange(of: prefs.theme) { syncTheme() }
    .onChange(of: prefs.themeAuto) { syncTheme() }
    .onChange(of: prefs.keepAwake) { keepAwakeChanged() }
  }
  private var hifzFinished: Bool { rs?.hifz?.finished ?? false }
  private var hifzError: String? { rs?.hifz?.error }
  private func shareSheet(_ s: ShareItems) -> some View { ShareSheet(items: s.items) }
  private func shareCardSheet(_ req: ShareCardRequest) -> some View { ShareCardSheet(request: req).environment(model) }
  private func pageDidChange(_ p: Int?) { guard let p else { return }; slider = Double(p); onPageChanged(p) }
  private func wordDidChange(_ w: Int?) { rs?.playingWord = w }
  private func keepAwakeChanged() { UIApplication.shared.isIdleTimerDisabled = prefs.keepAwake }
  private func playerErrorChanged() {
    guard let e = model.player.lastError else { return }
    show(e == "network" ? "تعذّر تحميل التلاوة — تحقق من الاتصال بالإنترنت" : "هذه التلاوة غير متاحة من هذا القارئ — جرّب قارئًا آخر")
  }
  private func hifzDidFinish(_ f: Bool) {
    guard f, let h = rs?.hifz else { return }
    if h.veil { show("أتممت الصفحة ✓") } else { show("أتممت الصفحة ✓ كلمات صحيحة: \(num(h.matcher.matched)) · تلميحات: \(num(h.hints))") }
  }
  private func hifzErrorChanged(_ e: String?) { if let e { show(e) } }

  // MARK: - الصفحات
  @ViewBuilder
  private func pager(_ rs: MushafReaderState) -> some View {
    GeometryReader { geo in
      ScrollViewReader { proxy in
        ScrollView(vertical ? .vertical : .horizontal) {
          if vertical { LazyVStack(spacing: 0) { pages(geo, rs) }.scrollTargetLayout() } else { LazyHStack(spacing: 0) { pages(geo, rs) }.scrollTargetLayout() }
        }
        .scrollTargetBehavior(.paging)
        .scrollPosition(id: $page)
        .scrollIndicators(.hidden)
        .onAppear { proxy.scrollTo(startPage, anchor: .center) }
        .onChange(of: prefs.scroll) { DispatchQueue.main.async { proxy.scrollTo(current, anchor: .center) } }
      }
      .ignoresSafeArea()
    }
    .environment(\.layoutDirection, .rightToLeft)
  }
  private func pages(_ geo: GeometryProxy, _ rs: MushafReaderState) -> some View {
    ForEach(1...MushafLayout.totalPages, id: \.self) { p in
      Group {
        if rs.textMode { MushafTextPageView(page: p, insets: geo.safeAreaInsets) } else { MushafPageView(page: p, insets: geo.safeAreaInsets) }
      }
      .contentShape(Rectangle())
      .onTapGesture { if rs.hifz != nil { hifzTap() } else { withAnimation(.easeInOut(duration: 0.2)) { chrome.toggle() } } }
      .containerRelativeFrame(vertical ? .vertical : .horizontal)
      .id(p)
    }
  }

  // MARK: - الأزرار والشرائط
  @ViewBuilder
  private func overlays(_ rs: MushafReaderState) -> some View {
    VStack(spacing: 0) {
      if chrome { topBar(rs).transition(.move(edge: .top).combined(with: .opacity)) }
      Spacer()
      if let h = rs.hifz { HifzPanelView(session: h, onExit: exitHifz, onNextPage: { nextHifzPage(veil: h.veil) }).transition(.move(edge: .bottom)) }
      if model.player.current != nil { AudioBarView(onPickReciter: { sheet = .reciter }, onGoToPage: { go(to: $0) }, toast: show).transition(.move(edge: .bottom)) }
      if chrome && rs.hifz == nil { bottomBar(rs).transition(.move(edge: .bottom).combined(with: .opacity)) }
    }
    if let toast {
      VStack { Spacer(); Text(toast).font(.arabic(14)).multilineTextAlignment(.center).padding(.horizontal, 16).padding(.vertical, 10).background(.regularMaterial, in: Capsule()).padding(.bottom, 120) }
        .transition(.opacity).allowsHitTesting(false)
    }
  }
  private func topBar(_ rs: MushafReaderState) -> some View {
    let label = QuranText.shared.label(ofPage: current)
    return HStack(spacing: 4) {
      barButton("xmark", "إغلاق المصحف") { dismiss() }
      Spacer(minLength: 0)
      VStack(spacing: 1) {
        if let label { Text("سورة \(QuranMeta.surah(label.surah).name)").font(.arabic(15, weight: .bold)); Text(QuranMeta.juzName(label.juz, vocalized: false)).font(.arabic(11)).foregroundStyle(.secondary) }
      }
      .lineLimit(1)
      Spacer(minLength: 0)
      barButton("list.bullet", "الفهرس") { sheet = .index }
      barButton("magnifyingglass", "التنقل والبحث") { sheet = .quickNav }
      barButton("sun.max", "العرض والألوان") { sheet = .display }
      barButton("ellipsis.circle", "خيارات المصحف") { sheet = .options }
    }
    .padding(.horizontal, 6).padding(.bottom, 6)
    .background(.ultraThinMaterial)
  }
  private func bottomBar(_ rs: MushafReaderState) -> some View {
    let firstAyah = QuranText.shared.pageAyahs(current).first
    let marked = firstAyah.map { a in prefs.bookmarks.contains { $0.page == a.page } } ?? false
    return VStack(spacing: 4) {
      HStack(spacing: 18) {
        barButton(marked ? "bookmark.fill" : "bookmark", "علامة") { toggleBookmark() }
        barButton("play.circle", "تشغيل تلاوة الصفحة") { if let a = firstAyah { playFrom(a.n, scope: .page) } }
        barButton("mic", "مراجعة الحفظ") { if let a = firstAyah { startHifz(from: a.n) } }
        barButton("eye.slash", "إخفاء الآيات") { startVeil() }
        barButton("textformat.size", "حجم الخط والعرض") { sheet = .display }
      }
      Slider(value: $slider, in: 1...Double(MushafLayout.totalPages), step: 1) { editing in if !editing { go(to: Int(slider)) } }.tint(Theme.primary)
      HStack {
        Text("صفحة \(num(Int(slider))) من \(num(MushafLayout.totalPages))")
        Spacer()
        if let l = QuranText.shared.label(ofPage: Int(slider)) { Text("\(QuranMeta.surah(l.surah).name) · الجزء \(num(l.juz)) · الحزب \(num(l.hizb))") }
      }
      .font(.arabic(12)).foregroundStyle(.secondary).lineLimit(1)
    }
    .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 6)
    .background(.ultraThinMaterial)
  }
  private func barButton(_ icon: String, _ label: String, action: @escaping () -> Void) -> some View {
    Button(action: action) { Image(systemName: icon).font(.system(size: 17, weight: .semibold)).frame(width: 38, height: 40) }.accessibilityLabel(label)
  }
  private func num(_ n: Int) -> String { Fmt.number(n, numerals: model.settings.numerals) }

  // MARK: - النوافذ
  @ViewBuilder
  private func sheetView(_ s: ReaderSheet) -> some View {
    switch s {
    case .index: MushafIndexView(currentPage: current) { p in sheet = nil; go(to: p) }.environment(model)
    case .quickNav: QuickNavSheet(currentPage: current) { p, ayah in sheet = nil; go(to: p); if let ayah { flash(ayah) } }.environment(model)
    case .options: ReaderOptionsSheet(currentPage: current, onGo: { p, ayah in sheet = nil; go(to: p); if let a = ayah { flash(a) } }, onPlayPage: { sheet = nil; if let a = QuranText.shared.pageAyahs(current).first { playFrom(a.n, scope: .page) } }, onOpen: { sheet = $0 }).environment(model)
    case .display: DisplaySheet(onLegend: { sheet = .legend }).environment(model)
    case .legend: TajweedLegendSheet(dark: rs?.isDark ?? false)
    case .reciter: ReciterPickerSheet().environment(model)
    case .downloads: DownloadsView(focusSurah: QuranText.shared.pageAyahs(current).first?.surah).environment(model)
    case .khatmah: KhatmahSheet().environment(model)
    case .challenges: ChallengesSheet().environment(model)
    case .ayah(let n):
      if let a = QuranText.shared.ayah(n) {
        AyahOptionsSheet(ayah: a, onAction: { act in sheet = nil; handle(act, a) }).environment(model).presentationDetents([.medium, .large])
      }
    case .bookmark(let n): if let a = QuranText.shared.ayah(n) { BookmarkSheet(ayah: a, onDone: { show($0) }).environment(model).presentationDetents([.medium]) }
    case .tafsir(let n): if let a = QuranText.shared.ayah(n) { TafsirSheet(ayah: a).environment(model) }
    }
  }
  private func handle(_ act: AyahAction, _ a: Ayah) {
    let txt = "\(a.text) ﴿\(a.ayah)﴾\n[\(QuranSearch.refLabel(a))]"
    switch act {
    case .tafsir: sheet = .tafsir(a.n)
    case .listen: sheet = .reciter; playFrom(a.n, scope: .surah)
    case .playFrom: playFrom(a.n, scope: .surah)
    case .repeat3: prefs.repeatAyah = 3; model.player.repeatAyah = 3; playFrom(a.n, scope: .single)
    case .bookmark: sheet = .bookmark(a.n)
    case .lastRead: remember(a); show("حُفظ موضع القراءة عند \(QuranSearch.refLabel(a))")
    case .hifz: startHifz(from: a.n)
    case .share: shareItems = ShareItems(items: [txt])
    case .shareImage: shareCard = ShareCardRequest(title: "القرآن الكريم · \(QuranSearch.refLabel(a))", text: "\(a.text) ﴿\(a.ayah)﴾", footer: QuranSearch.refLabel(a), quran: true, shareText: txt, filename: "ayah-\(a.surah)-\(a.ayah).png")
    case .copy: UIPasteboard.general.string = txt; show("نُسخت الآية")
    }
  }

  // MARK: - الحياة والتزامن
  private func setup() {
    let state = MushafReaderState(prefs: prefs, theme: prefs.effectiveTheme(systemDark: scheme == .dark))
    state.onTapAyah = { n in if state.hifz != nil { hifzTap() } else { state.selected = n; sheet = .ayah(n) } }
    rs = state
    UIApplication.shared.isIdleTimerDisabled = prefs.keepAwake
    MushafFonts.shared.prefetch(around: startPage)
    model.player.downloads = model.downloads
    model.player.onAyah = { n in
      state.playingAyah = n; state.playingWord = nil
      if prefs.follow, state.hifz == nil, let a = QuranText.shared.ayah(n), a.page != (page ?? startPage) { go(to: a.page) }
    }
    model.player.onSleep = { show("انتهى مؤقت النوم — توقفت التلاوة") }
    syncPlaying()
    remember(page: startPage)
    if let a = startAyah { DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { flash(a) } }
    if !prefs.hintShown { prefs.hintShown = true; show("انقر الصفحة لإظهار الأدوات، وانقر كلمة لقائمة الآية") }
  }
  private func teardown() {
    UIApplication.shared.isIdleTimerDisabled = false
    rs?.hifz?.stopSpeech(); rs?.hifz = nil
    model.player.onAyah = nil
    dwellTask?.cancel(); saveTask?.cancel()
  }
  private func syncTheme() { rs?.apply(theme: prefs.effectiveTheme(systemDark: scheme == .dark)) }
  private func syncPlaying() { rs?.playingAyah = model.player.current; if model.player.current == nil { rs?.playingWord = nil } }
  private func onPageChanged(_ p: Int) {
    MushafFonts.shared.prefetch(around: p)
    if let h = rs?.hifz, h.page != p { exitHifz(); show("انتهت مراجعة الحفظ بتغيير الصفحة") }
    if let s = rs?.selected, QuranText.shared.ayah(s)?.page != p { rs?.selected = nil }
    saveTask?.cancel(); saveTask = Task { try? await Task.sleep(nanoseconds: 900_000_000); if !Task.isCancelled { remember(page: p) } }
    dwellTask?.cancel(); dwellTask = Task { try? await Task.sleep(nanoseconds: 8_000_000_000); if !Task.isCancelled, page == p { prefs.readLog = Khatmah.log(prefs.readLog, today: model.todayKey, page: p) } }
    UIImpactFeedbackGenerator(style: .soft).impactOccurred(intensity: 0.4)
  }
  private func go(to p: Int) {
    let t = min(max(p, 1), MushafLayout.totalPages); guard t != page else { return }
    if abs(t - current) <= 2 { withAnimation(.easeInOut(duration: 0.25)) { page = t } } else { page = t }
  }
  private func flash(_ n: Int) { rs?.selected = n; DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { if rs?.selected == n { rs?.selected = nil } } }
  private func show(_ msg: String) {
    toastTask?.cancel(); withAnimation { toast = msg }
    toastTask = Task { try? await Task.sleep(nanoseconds: 3_200_000_000); if !Task.isCancelled { withAnimation { toast = nil } } }
  }
  private func remember(page p: Int) { if let a = QuranText.shared.pageAyahs(p).first { remember(a) } }
  private func remember(_ a: Ayah) { model.settings.lastRead = LastRead(page: a.page, surah: a.surah, ayah: a.ayah, at: Date().timeIntervalSince1970 * 1000) }
  private func toggleBookmark() {
    let a = (rs?.selected).flatMap { QuranText.shared.ayah($0) } ?? QuranText.shared.pageAyahs(current).first
    guard let a else { return }
    if prefs.isBookmarked(a) { prefs.removeBookmark(a); show("أُزيلت العلامة") } else { prefs.setBookmark(a, note: nil, color: "gold"); show("أُضيفت علامة عند \(QuranSearch.refLabel(a))"); UIImpactFeedbackGenerator(style: .light).impactOccurred() }
  }

  // MARK: - التلاوة
  enum PlayScope { case single, page, surah }
  private func playFrom(_ n: Int, scope: PlayScope) {
    guard let a = QuranText.shared.ayah(n) else { return }
    let q: [Int]
    switch scope { case .single: q = [n]; case .page: q = QuranText.shared.pageAyahs(a.page).map(\.n); case .surah: q = QuranText.shared.surahAyahs(a.surah).filter { $0.n >= n }.map(\.n) }
    let p = model.player
    p.reciter = prefs.reciter; p.repeatAyah = prefs.repeatAyah; p.repeatRange = prefs.repeatRange; p.setRate(prefs.rate); p.words = prefs.wordHighlight
    exitHifz()
    p.play(queue: q)
  }

  // MARK: - مراجعة الحفظ
  private func startHifz(from n: Int, veil: Bool = false) {
    guard let a = QuranText.shared.ayah(n) else { return }
    if a.page != current { go(to: a.page) }
    model.player.stop()
    let s = HifzSession(page: a.page, from: n, veil: veil)
    rs?.hifz = s; rs?.selected = nil
    if veil { show("انقر الصفحة لكشف الآية التالية") } else if !s.speechSupported { show("التعرّف على الصوت غير متاح — انقر الصفحة لكشف الكلمة التالية") }
  }
  private func startVeil() { if let a = QuranText.shared.pageAyahs(current).first { startHifz(from: a.n, veil: true) } }
  private func exitHifz() { rs?.hifz?.stopSpeech(); rs?.hifz = nil }
  private func hifzTap() { guard let h = rs?.hifz else { return }; if h.veil { h.revealAyah() } else { h.hint() } }
  private func nextHifzPage(veil: Bool) {
    guard current < MushafLayout.totalPages else { return }
    let p = current + 1; go(to: p)
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { if let a = QuranText.shared.pageAyahs(p).first { startHifz(from: a.n, veil: veil) } }
  }
}

extension MushafReaderState {
  /// حالة القارئ فوق التفضيلات مباشرة: تغيّرها في الإعدادات ينعكس على الصفحات دون مزامنة
  convenience init(prefs: QuranPrefs, theme: MushafTheme) {
    self.init(theme: theme)
    self.prefs = prefs
  }
}
