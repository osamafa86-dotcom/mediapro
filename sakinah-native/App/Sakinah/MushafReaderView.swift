import SwiftUI
import UIKit
import SakinahCore

/// نوافذ القارئ
enum ReaderSheet: Identifiable {
  case index, quickNav, options, display, legend, reciter, downloads, khatmah
  case ayah(Int), bookmark(Int), tafsir(Int), translation(Int), words(Int)
  var id: String { switch self { case .index: return "index"; case .quickNav: return "nav"; case .options: return "opt"; case .display: return "disp"; case .legend: return "leg"; case .reciter: return "rec"; case .downloads: return "dl"; case .khatmah: return "kh"; case .ayah(let n): return "a\(n)"; case .bookmark(let n): return "b\(n)"; case .tafsir(let n): return "t\(n)"; case .translation(let n): return "tr\(n)"; case .words(let n): return "w\(n)" } }
}

/// قارئ المصحف: تقليب أفقي من اليمين (أو رأسي)، صفحات المطبوع أو نص متدفق، سمات، تلاوة بتظليل الكلمة، علامات، مراجعة حفظ، وفهرس وبحث
struct MushafReaderView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  @Environment(\.colorScheme) private var scheme
  @Environment(\.horizontalSizeClass) private var hSize
  let startPage: Int
  let startAyah: Int?
  @State private var rs: MushafReaderState?
  @State private var page: Int?
  /// وضع الصفحتين (iPad): فهرس الزوج، الصفحة الفردية يمينًا والزوجية يسارًا كالكتاب المفتوح
  @State private var pair: Int?
  @State private var chrome = true
  @State private var chromeTask: Task<Void, Never>?
  /// صفحة انتقلنا إليها بقصد (لا بتقليب) — لا يُخفى الشريط عند بلوغها
  @State private var navTarget: Int?
  @State private var sheet: ReaderSheet?
  /// الصفحة التي يجرّ إليها القارئ الخطّ الذهبي الآن (nil حين لا يجرّ)
  @State private var scrub: Int?
  @State private var toast: String?
  @State private var toastTask: Task<Void, Never>?
  @State private var dwellTask: Task<Void, Never>?
  @State private var saveTask: Task<Void, Never>?
  @State private var shareItems: ShareItems?
  @State private var shareCard: ShareCardRequest?

  /// يبدأ التلاوة من موضع البداية (بلاطة «الاستماع») أو جلسة الحفظ (بلاطة «مراجعة الحفظ») فور الظهور
  let autoplay: Bool
  let hifzOnAppear: Bool
  init(startPage: Int, ayah: Int? = nil, autoplay: Bool = false, hifz: Bool = false) {
    let p = min(max(startPage, 1), MushafLayout.totalPages)
    self.startPage = p; startAyah = ayah; self.autoplay = autoplay; hifzOnAppear = hifz
    _page = State(initialValue: p)
  }

  private var prefs: QuranPrefs { model.quran }
  private var current: Int { page ?? startPage }
  private var vertical: Bool { prefs.scroll == "vertical" }
  private var spread: Bool { hSize == .regular && !vertical && !prefs.isTextMode }

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
          // اللوحات التي تبقى (الحفظ والمشغّل) تُزيح الصفحة لأن وجودها حالٌ مقصود يطول.
          // أما الشريط الموحّد الذي يظهر ويختفي مع كل نقرة فيعلو الصفحة ولا يمسّ حجمها —
          // فلو اقتطع منها لأُعيدت ملاءمتها بخطٍّ أصغر، وتقلّصت الصفحة وتغيّر منظرها في كل مرة.
          .safeAreaInset(edge: .bottom, spacing: 0) { persistentSlot(rs).environment(rs) }
          .overlay(alignment: .top) { topSlot(rs) }
        Color.black.opacity(min(0.7, prefs.dim)).ignoresSafeArea().allowsHitTesting(false)
        edgeHandles(rs)
        toastOverlay
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
    .onChange(of: sheet == nil) { _, closed in if closed && chrome { scheduleChromeHide() } }
  }
  private var hifzFinished: Bool { rs?.hifz?.finished ?? false }
  private var hifzError: String? { rs?.hifz?.error }
  private func shareSheet(_ s: ShareItems) -> some View { ShareSheet(items: s.items) }
  private func shareCardSheet(_ req: ShareCardRequest) -> some View { ShareCardSheet(request: req).environment(model) }
  private func pageDidChange(_ p: Int?) { guard let p else { return }; let k = (p + 1) / 2; if pair != k { pair = k }; onPageChanged(p) }
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
          if spread { LazyHStack(spacing: 0) { spreads(geo, rs) }.scrollTargetLayout() }
          else if vertical { LazyVStack(spacing: 0) { pages(geo, rs) }.scrollTargetLayout() } else { LazyHStack(spacing: 0) { pages(geo, rs) }.scrollTargetLayout() }
        }
        .scrollTargetBehavior(.paging)
        .scrollPosition(id: spread ? $pair : $page)
        .scrollIndicators(.hidden)
        .onAppear { if spread { pair = (startPage + 1) / 2; proxy.scrollTo((startPage + 1) / 2, anchor: .center) } else { proxy.scrollTo(startPage, anchor: .center) } }
        .onChange(of: prefs.scroll) { DispatchQueue.main.async { proxy.scrollTo(spread ? (current + 1) / 2 : current, anchor: .center) } }
        .onChange(of: spread) { DispatchQueue.main.async { proxy.scrollTo(spread ? (current + 1) / 2 : current, anchor: .center) } }
        .onChange(of: pair) { _, k in guard spread, let k else { return }; let p = 2 * k - 1; if page != p && page != p + 1 { page = p } }
      }
    }
    .environment(\.layoutDirection, .rightToLeft)
  }
  private func pages(_ geo: GeometryProxy, _ rs: MushafReaderState) -> some View {
    ForEach(1...MushafLayout.totalPages, id: \.self) { p in
      pageView(p, geo, rs)
        .containerRelativeFrame(vertical ? .vertical : .horizontal)
        .id(p)
    }
  }
  /// أزواج الصفحات على iPad: (1,2)، (3,4)… الفردية يمينًا
  private func spreads(_ geo: GeometryProxy, _ rs: MushafReaderState) -> some View {
    ForEach(1...(MushafLayout.totalPages / 2), id: \.self) { k in
      HStack(spacing: 0) {
        pageView(2 * k - 1, geo, rs).frame(maxWidth: .infinity)
        pageView(2 * k, geo, rs).frame(maxWidth: .infinity)
      }
      .containerRelativeFrame(.horizontal)
      .id(k)
    }
  }
  private func pageView(_ p: Int, _ geo: GeometryProxy, _ rs: MushafReaderState) -> some View {
    Group {
      if rs.textMode { MushafTextPageView(page: p, insets: geo.safeAreaInsets) } else { MushafPageView(page: p, insets: geo.safeAreaInsets) }
    }
    .contentShape(Rectangle())
    .onTapGesture { if rs.hifz != nil { hifzTap() } else { toggleChrome() } }
    // سحبة رأسية على الصفحة تُظهر الشريط؛ التقليب الأفقي يبقى للمقلّب (إيماءة متزامنة لا تصادره)
    .simultaneousGesture(DragGesture(minimumDistance: 24).onEnded { v in if abs(v.translation.height) > 40, abs(v.translation.height) > abs(v.translation.width) { showChrome() } })
  }

  // MARK: - الشريط الموحّد: حافّة لا تغطّي النصّ

  /// شريط واحد علويّ ينزلق فوق الصفحة — خلفيته معتمة فلا يظهر النصّ من تحته، والصفحة لا تتحرّك
  @ViewBuilder private func topSlot(_ rs: MushafReaderState) -> some View {
    if chrome { unifiedBar(rs).transition(.move(edge: .top).combined(with: .opacity)) }
  }

  /// الرصيف السفلي الواحد على سطح الورق: لوحة الحفظ، أو إجراءات الآية المحدّدة، أو التلاوة الجارية —
  /// واحدٌ منها في كل لحظة، يُزيح الصفحة عمدًا فلا يحجب سطرًا (بترتيب الأولوية)
  @ViewBuilder private func persistentSlot(_ rs: MushafReaderState) -> some View {
    VStack(spacing: 0) {
      if let h = rs.hifz {
        HifzPanelView(session: h, theme: rs.theme, onExit: exitHifz, onNextPage: { nextHifzPage(veil: h.veil) }).transition(.move(edge: .bottom))
      } else if let n = rs.selected, let a = QuranText.shared.ayah(n) {
        AyahDockView(ayah: a, theme: rs.theme, marked: prefs.isBookmarked(a), numerals: model.settings.numerals,
                     onAction: { handle($0, a) }, onMore: { chromeTask?.cancel(); sheet = .ayah(n) }, onClose: { deselect() })
          .transition(.move(edge: .bottom))
      } else if model.player.current != nil {
        AudioBarView(onPickReciter: { sheet = .reciter }, onGoToPage: { go(to: $0) }, toast: show, theme: rs.theme).transition(.move(edge: .bottom))
      }
    }
    .animation(.spring(response: 0.3, dampingFraction: 0.9), value: rs.selected == nil)
    .animation(.spring(response: 0.3, dampingFraction: 0.9), value: rs.hifz == nil)
  }

  @ViewBuilder private var toastOverlay: some View {
    if let toast {
      VStack { Spacer(); Text(toast).font(DS.F.labelMd).foregroundStyle(DS.C.textOnDark).multilineTextAlignment(.center).padding(.horizontal, 16).padding(.vertical, 10).background(DS.C.bgInverse.opacity(0.92), in: Capsule()).padding(.bottom, 140) }
        .transition(.opacity).allowsHitTesting(false)
    }
  }

  /// في الوضع الغامر: خيط ذهبي يدلّ على الموضع في الجزء — لا يستقبل لمسًا (النقر على الهامش والسحبة الرأسية على الصفحة يُظهران الشريط)
  @ViewBuilder private func edgeHandles(_ rs: MushafReaderState) -> some View {
    if !chrome && rs.hifz == nil {
      let ink = Color(hex: rs.theme.ink)
      VStack(spacing: 0) { Spacer(minLength: 0); juzHairline(ink); Color.clear.frame(height: 18) }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .transition(.opacity)
    }
  }

  /// خيط ذهبي رفيع: موضع الصفحة داخل الجزء الحالي (يملأ من اليمين كاتجاه القراءة)
  private func juzHairline(_ ink: Color) -> some View {
    let w: CGFloat = 132
    return ZStack(alignment: .leading) {
      Capsule().fill(ink.opacity(0.12)).frame(width: w, height: 3)
      Capsule().fill(DS.C.accentGold.opacity(0.8)).frame(width: max(3, w * juzProgress), height: 3)
    }
    .frame(width: w, height: 3)
    .padding(.bottom, 5)
  }

  /// نسبة تقدّم الصفحة الحالية داخل جزئها
  private var juzProgress: Double {
    guard let l = QuranText.shared.label(ofPage: current) else { return 0 }
    let starts = QuranMeta.juzStarts
    let from = starts.first { $0.juz == l.juz }?.page ?? 1
    let to = starts.first { $0.juz == l.juz + 1 }?.page ?? (MushafLayout.totalPages + 1)
    guard to > from else { return 0 }
    return min(1, max(0, Double(current - from + 1) / Double(to - from)))
  }

  // MARK: - التحكّم في الشريط

  private static let chromeDwell: UInt64 = 3_600_000_000

  private func showChrome() {
    withAnimation(.spring(response: 0.34, dampingFraction: 0.92)) { chrome = true }
    scheduleChromeHide()
  }
  private func hideChrome() {
    chromeTask?.cancel(); chromeTask = nil
    withAnimation(.spring(response: 0.34, dampingFraction: 0.92)) { chrome = false }
  }
  private func toggleChrome() { chrome ? hideChrome() : showChrome() }
  /// ينزلق الشريط بعد سكون قصير كي تعود الصفحة كاملة من تلقاء نفسها
  private func scheduleChromeHide() {
    // لقطات المتجر: الشريط هو موضوع اللقطة، فلا يُخفى تحت أعين الكاميرا
    if ScreenshotMode.keepChrome { return }
    // مع VoiceOver أو التحكّم بالمفاتيح لا شيء يختفي بمؤقّت: القارئ يخفي الشريط بنفسه
    if UIAccessibility.isVoiceOverRunning || UIAccessibility.isSwitchControlRunning { return }
    chromeTask?.cancel()
    chromeTask = Task { @MainActor in
      try? await Task.sleep(nanoseconds: Self.chromeDwell)
      guard !Task.isCancelled, sheet == nil else { return }
      hideChrome()
      // مرة واحدة في عمر التطبيق: تعريف بمكان المفتاح كي لا يبحث عنه القارئ
      if !prefs.seenChromeHint { prefs.seenChromeHint = true; show("اسحب من حافة الشاشة أو انقرها لإظهار الشريط") }
    }
  }

  // MARK: - الشريط الموحّد

  /// شريط واحد في أعلى الصفحة: زرّ الإغلاق يمينًا، ثم هويّة الموضع، ثم كبسولة الإجراءات يسارًا،
  /// وحافّته السفلى خطٌّ ذهبي هو نفسه منزلق الصفحات الـ٦٠٤. ارتفاعه ٥٥ نقطة فوق حشوة الأمان.
  private func unifiedBar(_ rs: MushafReaderState) -> some View {
    let ink = Color(hex: rs.theme.ink)
    return VStack(spacing: 0) {
      HStack(spacing: 8) {
        barButton("chevron.forward", "إغلاق المصحف", ink) { dismiss() }
        titleBlock(rs, ink)
        actionCapsule(rs, ink)
      }
      .padding(.horizontal, 10)
      .frame(height: 46)
      pageProgress(rs)
    }
    .background(alignment: .bottom) {
      Rectangle().fill(MushafPalette.background(for: rs.theme)).ignoresSafeArea(edges: .top)
    }
    .shadow(color: ink.opacity(0.10), radius: 10, x: 0, y: 3)
  }

  /// هويّة الموضع: اسم السورة وسطر التفاصيل. الكتلة كلّها زرٌّ يفتح الفهرس، والسهم يدلّ على ذلك.
  /// سطر التفاصيل وحده يصغر عند الضرورة (أطول تركيبة تحتاج ١٩٧ نقطة في مساحة ١٨٥) فيبقى سطرًا واحدًا.
  private func titleBlock(_ rs: MushafReaderState, _ ink: Color) -> some View {
    let label = QuranText.shared.label(ofPage: current)
    let marked = QuranText.shared.pageAyahs(current).first.map { a in prefs.bookmarks.contains { $0.page == a.page } } ?? false
    return Button(action: { scheduleChromeHide(); sheet = .index }) {
      VStack(alignment: .leading, spacing: 2) {
        if let label {
          let su = QuranMeta.surah(label.surah)
          HStack(spacing: 5) {
            if marked {
              Image(systemName: "bookmark.fill").font(.system(size: 11))
                .foregroundStyle(MushafPalette.gold(for: rs.theme))
                .accessibilityHidden(true)
            }
            Text("سورة \(su.name)").font(DS.F.headingSm).foregroundStyle(ink)
            Image(systemName: "chevron.down").font(.system(size: 9, weight: .semibold))
              .foregroundStyle(ink.opacity(0.45)).accessibilityHidden(true)
          }
          Text("صفحة \(num(current)) · الجزء \(num(label.juz)) · الحزب \(num(label.hizb)) · \(su.type)")
            .font(DS.F.labelXs).foregroundStyle(ink.opacity(0.6))
            .lineLimit(1).minimumScaleFactor(0.92)
        }
      }
      .lineLimit(1)
      .frame(maxWidth: .infinity, alignment: .leading)
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityLabel(label.map { "\(QuranMeta.surah($0.surah).name)، صفحة \(num(current)). افتح الفهرس" } ?? "الفهرس")
  }

  /// كبسولة الإجراءات: تشغيل (ممتلئ) ثم الحفظ ثم الفهرس ثم المزيد — بترتيب القراءة من اليمين
  private func actionCapsule(_ rs: MushafReaderState, _ ink: Color) -> some View {
    let firstAyah = QuranText.shared.pageAyahs(current).first
    let hifzOn = rs.hifz != nil
    let brand = MushafPalette.brand(for: rs.theme)
    let onBrand = MushafPalette.onBrand(for: rs.theme)
    return HStack(spacing: 0) {
      capsuleButton("play.fill", "تشغيل تلاوة الصفحة", hifzOn ? ink : onBrand, fill: hifzOn ? nil : brand, size: 13) {
        if let a = firstAyah { playFrom(a.n, scope: .page) }
      }
      capsuleButton("mic", "مراجعة الحفظ", hifzOn ? onBrand : ink, fill: hifzOn ? brand : nil, size: 15) {
        if hifzOn { exitHifz() } else if let a = firstAyah { startHifz(from: a.n) }
      }
      capsuleButton("list.bullet", "الفهرس", ink, fill: nil, size: 15) { sheet = .index }
      moreMenu(ink)
    }
    .padding(3)
    .background {
      Capsule().fill(ink.opacity(0.05))
        .overlay { Capsule().strokeBorder(ink.opacity(0.12), lineWidth: 1) }
    }
  }

  /// ما خرج من الشريط إلى قائمة واحدة: العلامة، البحث، العرض، الإخفاء، التنزيلات، وبقيّة الخيارات.
  /// لا شيء هنا غير مبلوغ من مكان آخر؛ القائمة اختصار لا مخبأ.
  private func moreMenu(_ ink: Color) -> some View {
    let target = (rs?.selected).flatMap { QuranText.shared.ayah($0) } ?? QuranText.shared.pageAyahs(current).first
    let marked = target.map { prefs.isBookmarked($0) } ?? false
    return Menu {
      Button { pick { toggleBookmark() } } label: {
        Label(marked ? "إزالة علامة الصفحة" : "علامة على هذه الصفحة", systemImage: marked ? "bookmark.slash" : "bookmark")
      }
      Button { pick { sheet = .quickNav } } label: { Label("بحث وتنقّل", systemImage: "magnifyingglass") }
      Button { pick { sheet = .display } } label: { Label("العرض والخطّ والسمة", systemImage: "textformat.size") }
      Button { pick { startVeil() } } label: { Label("إخفاء الآيات للحفظ", systemImage: "eye.slash") }
      Button { pick { sheet = .downloads } } label: { Label("التلاوات دون اتّصال", systemImage: "arrow.down.circle") }
      Divider()
      Button { pick { sheet = .options } } label: { Label("خيارات المصحف", systemImage: "gearshape") }
    } label: {
      Image(systemName: "ellipsis").font(.system(size: 15, weight: .medium))
        .foregroundStyle(ink)
        .frame(width: 40, height: 38)
        .contentShape(Rectangle())
    }
    // القائمة ليست نافذة فلا يراها حارس الإخفاء التلقائي: نوقف المؤقّت عند فتحها
    // ونعيد جدولته مع أول اختيار، فلا ينزلق الشريط من تحت قائمة مفتوحة
    .simultaneousGesture(TapGesture().onEnded { chromeTask?.cancel(); chromeTask = nil })
    .accessibilityLabel("خيارات المصحف")
  }

  /// اختيارٌ من القائمة: ينفّذ ثم يعيد جدولة إخفاء الشريط
  private func pick(_ action: () -> Void) { action(); scheduleChromeHide() }

  private func capsuleButton(_ icon: String, _ label: String, _ tint: Color, fill: Color?, size: CGFloat, action: @escaping () -> Void) -> some View {
    Button(action: { scheduleChromeHide(); action() }) {
      Image(systemName: icon).font(.system(size: size, weight: .medium))
        .foregroundStyle(tint)
        .frame(width: 32, height: 32)
        .background { if let fill { Circle().fill(fill) } }
        .frame(width: 40, height: 38)
        .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityLabel(label)
  }

  /// خطّ موضع الصفحة: يملأ من اليمين، وهو نفسه المنزلق بين ٦٠٤ صفحات.
  ///
  /// شريحةٌ بتسع نقاط داخل حدود الشريط تحمل الخطّ في قاعها وتستقبل اللمس كلّه — ولم أجعل مساحة
  /// اللمس تتجاوز الشريط إلى الصفحة لأن SwiftUI لا يضمن وصول اللمس إلى ما رُسم خارج حدود أبيه.
  /// وتُرسم في فضاء من اليسار إلى اليمين صراحةً كي لا يلتبس اتّجاه اللمسة باتّجاه الكتابة.
  private func pageProgress(_ rs: MushafReaderState) -> some View {
    let total = CGFloat(MushafLayout.totalPages)
    let shown = CGFloat(scrub ?? current)
    let gold = MushafPalette.gold(for: rs.theme)
    return GeometryReader { geo in
      let w = geo.size.width
      let filled = max(3, w * shown / total)
      ZStack(alignment: .bottomLeading) {
        Color.clear.frame(width: w, height: 9).contentShape(Rectangle())
        Rectangle().fill(MushafPalette.goldTrack(for: rs.theme)).frame(width: w, height: 3)
        Rectangle().fill(gold).frame(width: filled, height: 3).offset(x: w - filled)
      }
      .frame(width: w, height: 9, alignment: .bottomLeading)
      .overlay(alignment: .topLeading) {
        if let s = scrub { scrubBubble(rs, page: s, x: w - filled, width: w) }
      }
      .contentShape(Rectangle())
      .gesture(
        DragGesture(minimumDistance: 0)
          .onChanged { v in scrub = scrubPage(atX: v.location.x, width: w) }
          .onEnded { v in
            let p = scrubPage(atX: v.location.x, width: w)
            scrub = nil; scheduleChromeHide(); go(to: p)
          }
      )
      .environment(\.layoutDirection, .leftToRight)
      .accessibilityElement()
      .accessibilityLabel("الانتقال بين الصفحات")
      .accessibilityValue("صفحة \(num(current)) من \(num(MushafLayout.totalPages))")
      .accessibilityAdjustableAction { d in
        let next = d == .increment ? current + 1 : current - 1
        go(to: min(max(next, 1), MushafLayout.totalPages))
      }
    }
    .frame(height: 9)
  }

  /// فقاعة تُظهر الصفحة والحزب أثناء الجرّ، تحت الخطّ مباشرة ومقيّدة داخل الشاشة
  private func scrubBubble(_ rs: MushafReaderState, page p: Int, x: CGFloat, width: CGFloat) -> some View {
    let hizb = QuranText.shared.label(ofPage: p).map { "الحزب \(num($0.hizb))" }
    return HStack(spacing: 7) {
      if let hizb { Text(hizb).font(DS.F.labelXs) }
      Text("صفحة \(num(p))").font(DS.F.numericSm)
    }
    .foregroundStyle(MushafPalette.onBrand(for: rs.theme))
    .padding(.horizontal, 12).padding(.vertical, 6)
    .background(Capsule().fill(MushafPalette.gold(for: rs.theme)))
    .shadow(color: .black.opacity(0.22), radius: 12, x: 0, y: 4)
    .fixedSize()
    .offset(x: min(max(x - 60, 10), max(10, width - 130)), y: 12)  // تحت الشريط مباشرة
    .allowsHitTesting(false)
    .transition(.opacity)
  }

  /// الصفحة المقابلة للمسة: الخطّ يملأ من اليمين فالصفر عند الحافّة اليسرى
  private func scrubPage(atX x: CGFloat, width w: CGFloat) -> Int {
    guard w > 0 else { return current }
    let frac = 1 - min(max(x / w, 0), 1)
    return min(max(Int((frac * CGFloat(MushafLayout.totalPages)).rounded()), 1), MushafLayout.totalPages)
  }

  private func barButton(_ icon: String, _ label: String, _ ink: Color, action: @escaping () -> Void) -> some View {
    Button(action: { scheduleChromeHide(); action() }) { Image(systemName: icon).font(.system(size: 16, weight: .medium)).foregroundStyle(ink).frame(width: 44, height: 44).contentShape(Rectangle()) }.buttonStyle(.plain).accessibilityLabel(label)
  }
  private func num(_ n: Int) -> String { Fmt.number(n, numerals: model.settings.numerals) }

  // MARK: - النوافذ
  @ViewBuilder
  private func sheetView(_ s: ReaderSheet) -> some View {
    switch s {
    case .index, .quickNav: QuickNavSheet(currentPage: current) { p, ayah in sheet = nil; go(to: p); if let ayah { flash(ayah) } }.environment(model)
    case .options: ReaderOptionsSheet(currentPage: current, onGo: { p, ayah in sheet = nil; go(to: p); if let a = ayah { flash(a) } }, onPlayPage: { sheet = nil; if let a = QuranText.shared.pageAyahs(current).first { playFrom(a.n, scope: .page) } }, onOpen: { sheet = $0 }).environment(model)
    case .display: DisplaySheet(onLegend: { sheet = .legend }).environment(model)
    case .legend: TajweedLegendSheet(dark: rs?.isDark ?? false)
    case .reciter: ReciterPickerSheet().environment(model)
    case .downloads: DownloadsView(focusSurah: QuranText.shared.pageAyahs(current).first?.surah).environment(model)
    case .khatmah: KhatmahSheet(onGo: { p in sheet = nil; go(to: p) }).environment(model)
    case .ayah(let n):
      if let a = QuranText.shared.ayah(n) {
        AyahOptionsSheet(ayah: a, onAction: { act in sheet = nil; handle(act, a) }).environment(model).presentationDetents([.medium, .large])
      }
    case .bookmark(let n): if let a = QuranText.shared.ayah(n) { BookmarkSheet(ayah: a, onDone: { show($0) }).environment(model).presentationDetents([.medium]) }
    case .tafsir(let n): if let a = QuranText.shared.ayah(n) { TafsirSheet(ayah: a).environment(model) }
    case .translation(let n): if let a = QuranText.shared.ayah(n) { TranslationSheet(ayah: a).environment(model) }
    case .words(let n): if let a = QuranText.shared.ayah(n) { WordMeaningsSheet(ayah: a).environment(model) }
    }
  }
  private func handle(_ act: AyahAction, _ a: Ayah) {
    let txt = "\(a.text) ﴿\(a.ayah)﴾\n[\(QuranSearch.refLabel(a))]"
    switch act {
    case .tafsir: sheet = .tafsir(a.n)
    case .translation: sheet = .translation(a.n)
    case .wordMeanings: sheet = .words(a.n)
    case .listen: playFrom(a.n, scope: .surah); rs?.selected = nil
    case .playFrom: playFrom(a.n, scope: .surah); rs?.selected = nil
    case .repeat3: playFrom(a.n, scope: .single, repeat: 3); rs?.selected = nil
    case .bookmark: sheet = .bookmark(a.n)
    case .lastRead: remember(a); show("حُفظ موضع القراءة عند \(QuranSearch.refLabel(a))")
    case .hifz: startHifz(from: a.n)
    case .share: shareItems = ShareItems(items: [txt])
    case .shareImage: DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { shareCard = ShareCardRequest(title: "القرآن الكريم · \(QuranSearch.refLabel(a))", text: "\(a.text) ﴿\(a.ayah)﴾", footer: QuranSearch.refLabel(a), quran: true, shareText: txt, filename: "ayah-\(a.surah)-\(a.ayah).png") }
    case .copy: UIPasteboard.general.string = txt; show("نُسخت الآية")
    }
  }

  // MARK: - الحياة والتزامن
  private func setup() {
    let state = MushafReaderState(prefs: prefs, theme: prefs.effectiveTheme(systemDark: scheme == .dark))
    state.onTapAyah = { n in if state.hifz != nil { hifzTap() } else { selectAyah(n) } }
    state.onLongPressAyah = { n in
      guard state.hifz == nil else { return }
      state.selected = n; chromeTask?.cancel()
      UIImpactFeedbackGenerator(style: .medium).impactOccurred()
      sheet = .ayah(n)
    }
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
    scheduleChromeHide()
    remember(page: startPage)
    scheduleDwell(startPage)
    if let a = startAyah { DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { flash(a) } }
    if !prefs.hintShown { prefs.hintShown = true; show("انقر كلمةً لتحديد آيتها، واضغط مطوّلًا لكل خياراتها") }
    // لقطات المتجر: آية محدّدة مع رصيفها، أو ورقة مفتوحة، أو جلسة إخفاء
    if ScreenshotMode.readerSelectsAyah, let a = QuranText.shared.pageAyahs(startPage).first { state.selected = a.n }
    if let s = ScreenshotMode.readerSheet { DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { sheet = s } }
    if ScreenshotMode.readerHifz { DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { startVeil() } }
    if autoplay || hifzOnAppear {
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
        guard let a = startAyah.flatMap({ QuranText.shared.ayah($0) }) ?? QuranText.shared.pageAyahs(startPage).first else { return }
        if autoplay { playFrom(a.n, scope: .surah) } else { startHifz(from: a.n) }
      }
    }
  }
  private func teardown() {
    saveTask?.cancel(); remember(page: current)
    UIApplication.shared.isIdleTimerDisabled = false
    rs?.hifz?.stopSpeech(); rs?.hifz = nil
    model.player.onAyah = nil
    dwellTask?.cancel(); saveTask?.cancel(); chromeTask?.cancel()
  }
  private func syncTheme() { rs?.apply(theme: prefs.effectiveTheme(systemDark: scheme == .dark)) }
  private func syncPlaying() { rs?.playingAyah = model.player.current; if model.player.current == nil { rs?.playingWord = nil } }
  private func onPageChanged(_ p: Int) {
    MushafFonts.shared.prefetch(around: p)
    if navTarget == p { navTarget = nil; if chrome { scheduleChromeHide() } }
    else if chrome, sheet == nil { hideChrome() }
    if let h = rs?.hifz, h.page != p { exitHifz(); show("انتهت مراجعة الحفظ بتغيير الصفحة") }
    if let s = rs?.selected, QuranText.shared.ayah(s)?.page != p { rs?.selected = nil }
    if let f = rs?.flash, QuranText.shared.ayah(f)?.page != p { rs?.flash = nil }
    saveTask?.cancel(); saveTask = Task { try? await Task.sleep(nanoseconds: 900_000_000); if !Task.isCancelled { remember(page: p) } }
    scheduleDwell(p)
    UIImpactFeedbackGenerator(style: .soft).impactOccurred(intensity: 0.4)
  }
  /// الورد يُحتسب بتقدّم الموضع داخل الخطة (متّصلًا، لا بالقفز) بعد سكون قصير يستبعد التقليب السريع؛
  /// وسجلّ القراءة للإحصاء يبقى على مهلته الأطول
  private func scheduleDwell(_ p: Int) {
    dwellTask?.cancel()
    dwellTask = Task { @MainActor in
      try? await Task.sleep(nanoseconds: 3_000_000_000)
      guard !Task.isCancelled, page == p else { return }
      if let a = QuranText.shared.pageAyahs(p).first { prefs.pushRecent(a) }
      if let plan = prefs.khatmah {
        prefs.wird = Wird.mark(prefs.wird, today: model.todayKey, page: p, startPage: plan.startPage)
        if spread, p + 1 <= MushafLayout.totalPages { prefs.wird = Wird.mark(prefs.wird, today: model.todayKey, page: p + 1, startPage: plan.startPage) }
      }
      try? await Task.sleep(nanoseconds: 5_000_000_000)
      guard !Task.isCancelled, page == p else { return }
      prefs.readLog = Khatmah.log(prefs.readLog, today: model.todayKey, page: p)
    }
  }
  private func go(to p: Int) {
    let t = min(max(p, 1), MushafLayout.totalPages); guard t != page else { return }
    navTarget = t
    if spread { let k = (t + 1) / 2; page = t; if pair != k { pair = k }; return }
    if abs(t - current) <= 2 { withAnimation(.easeInOut(duration: 0.25)) { page = t } } else { page = t }
  }
  private func flash(_ n: Int) { rs?.flash = n; DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { if rs?.flash == n { rs?.flash = nil } } }
  /// نقرة على كلمة: تحديد آيتها وفتح الرصيف؛ نقرة ثانية على الآية نفسها تلغي التحديد
  private func selectAyah(_ n: Int) {
    guard let rs else { return }
    if rs.selected == n { deselect(); return }
    rs.selected = n
    UISelectionFeedbackGenerator().selectionChanged()
    if let a = QuranText.shared.ayah(n) { UIAccessibility.post(notification: .announcement, argument: "حُدّدت \(QuranSearch.refLabel(a))") }
  }
  private func deselect() { rs?.selected = nil }
  private func show(_ msg: String) {
    toastTask?.cancel(); withAnimation { toast = msg }
    toastTask = Task { try? await Task.sleep(nanoseconds: 3_200_000_000); if !Task.isCancelled { withAnimation { toast = nil } } }
  }
  private func remember(page p: Int) { if let a = QuranText.shared.pageAyahs(p).first { remember(a) } }
  private func remember(_ a: Ayah) { model.settings.lastRead = LastRead(page: a.page, surah: a.surah, ayah: a.ayah, at: Date().timeIntervalSince1970 * 1000) }
  private func toggleBookmark() {
    let existing = prefs.bookmarks.first { $0.page == current }.flatMap { QuranText.shared.ayah(surah: $0.surah, ayah: $0.ayah) }
    let a = (rs?.selected).flatMap { QuranText.shared.ayah($0) } ?? existing ?? QuranText.shared.pageAyahs(current).first
    guard let a else { return }
    if prefs.isBookmarked(a) { prefs.removeBookmark(a); show("أُزيلت العلامة") } else { prefs.setBookmark(a, note: nil, color: "gold"); show("أُضيفت علامة عند \(QuranSearch.refLabel(a))"); UIImpactFeedbackGenerator(style: .light).impactOccurred() }
  }

  // MARK: - التلاوة
  enum PlayScope { case single, page, surah }
  private func playFrom(_ n: Int, scope: PlayScope, repeat: Int? = nil) {
    guard let a = QuranText.shared.ayah(n) else { return }
    let q: [Int]
    switch scope { case .single: q = [n]; case .page: q = QuranText.shared.pageAyahs(a.page).map(\.n); case .surah: q = QuranText.shared.surahAyahs(a.surah).filter { $0.n >= n }.map(\.n) }
    let p = model.player
    p.reciter = prefs.reciter; p.repeatAyah = `repeat` ?? prefs.repeatAyah; p.repeatRange = prefs.repeatRange; p.setRate(prefs.rate); p.words = prefs.wordHighlight
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
    if veil { show("انقر الصفحة لكشف الآية التالية") }
    else if s.speechSupported { s.toggleSpeech(); show("اقرأ من حفظك — تُكشف الكلمات مع نطقك") }
    else { show("التعرّف على الصوت غير متاح — انقر الصفحة لكشف الكلمة التالية") }
  }
  private func startVeil() { if let a = QuranText.shared.pageAyahs(current).first { startHifz(from: a.n, veil: true) } }
  private func exitHifz() { rs?.hifz?.stopSpeech(); rs?.hifz = nil }
  private func hifzTap() { guard let h = rs?.hifz else { return }; if h.veil { h.revealAyah() } else { h.hint() } }
  private func nextHifzPage(veil: Bool) {
    guard current < MushafLayout.totalPages else { return }
    exitHifz()
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
