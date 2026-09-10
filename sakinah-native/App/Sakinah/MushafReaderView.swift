import SwiftUI
import UIKit
import SakinahCore

/// قارئ المصحف: تقليب أفقي بين الصفحات الـ604 (من اليمين إلى اليسار كالكتاب)، نقرة تُظهر/تُخفي الأزرار، فهرس السور والأجزاء والصفحة
struct MushafReaderView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  let startPage: Int
  @State private var page: Int?
  @State private var chrome = true
  @State private var showIndex = false
  @State private var slider: Double
  private let palette = MushafPalette.paper

  init(startPage: Int) {
    let p = min(max(startPage, 1), MushafLayout.totalPages)
    self.startPage = p
    _page = State(initialValue: p)
    _slider = State(initialValue: Double(p))
  }

  var body: some View {
    GeometryReader { geo in
      ScrollViewReader { proxy in
        ScrollView(.horizontal) {
          LazyHStack(spacing: 0) {
            ForEach(1...MushafLayout.totalPages, id: \.self) { p in
              MushafPageView(page: p, showChrome: true, palette: palette, insets: geo.safeAreaInsets)
                .containerRelativeFrame(.horizontal)
                .id(p)
            }
          }
          .scrollTargetLayout()
        }
        .scrollTargetBehavior(.paging)
        .scrollPosition(id: $page)
        .scrollIndicators(.hidden)
        .background(palette.paper)
        .onAppear { proxy.scrollTo(startPage, anchor: .center) }
      }
      .ignoresSafeArea()
    }
    .environment(\.layoutDirection, .rightToLeft)
    .simultaneousGesture(TapGesture().onEnded { withAnimation(.easeInOut(duration: 0.2)) { chrome.toggle() } })
    .overlay(alignment: .top) { if chrome { topBar.transition(.move(edge: .top).combined(with: .opacity)) } }
    .overlay(alignment: .bottom) { if chrome { bottomBar.transition(.move(edge: .bottom).combined(with: .opacity)) } }
    .statusBarHidden(!chrome)
    .persistentSystemOverlays(chrome ? .automatic : .hidden)
    .onAppear {
      UIApplication.shared.isIdleTimerDisabled = true
      MushafFonts.shared.prefetch(around: startPage)
      remember(startPage)
    }
    .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
    .onChange(of: page) { _, p in
      guard let p else { return }
      slider = Double(p)
      MushafFonts.shared.prefetch(around: p)
      remember(p)
    }
    .sheet(isPresented: $showIndex) {
      MushafIndexView(currentPage: page ?? startPage) { p in showIndex = false; go(to: p) }
        .presentationDetents([.large])
    }
  }

  private var current: Int { page ?? startPage }
  private var label: QuranText.PageLabel? { QuranText.shared.label(ofPage: current) }

  private var topBar: some View {
    HStack(spacing: 12) {
      Button { dismiss() } label: { Image(systemName: "xmark").font(.system(size: 17, weight: .semibold)).frame(width: 40, height: 40) }
        .accessibilityLabel("إغلاق المصحف")
      Spacer()
      VStack(spacing: 1) {
        if let label {
          Text("سورة \(QuranMeta.surah(label.surah).name)").font(.arabic(16, weight: .bold))
          Text(QuranMeta.juzName(label.juz, vocalized: false)).font(.arabic(12)).foregroundStyle(.secondary)
        }
      }
      Spacer()
      Button { showIndex = true } label: { Image(systemName: "list.bullet").font(.system(size: 17, weight: .semibold)).frame(width: 40, height: 40) }
        .accessibilityLabel("الفهرس")
    }
    .padding(.horizontal, 8).padding(.bottom, 6)
    .background(.ultraThinMaterial)
  }

  private var bottomBar: some View {
    let s = model.settings
    return VStack(spacing: 6) {
      Slider(value: $slider, in: 1...Double(MushafLayout.totalPages), step: 1) { editing in if !editing { go(to: Int(slider)) } }
        .tint(Theme.primary)
      HStack {
        Text("صفحة \(Fmt.number(Int(slider), numerals: s.numerals)) من \(Fmt.number(MushafLayout.totalPages, numerals: s.numerals))")
        Spacer()
        if let l = QuranText.shared.label(ofPage: Int(slider)) {
          Text("الجزء \(Fmt.number(l.juz, numerals: s.numerals)) · الحزب \(Fmt.number(l.hizb, numerals: s.numerals))")
        }
      }
      .font(.arabic(12)).foregroundStyle(.secondary)
    }
    .padding(.horizontal, 16).padding(.top, 10).padding(.bottom, 8)
    .background(.ultraThinMaterial)
  }

  private func go(to p: Int) {
    let t = min(max(p, 1), MushafLayout.totalPages)
    guard t != page else { return }
    withAnimation(.easeInOut(duration: 0.25)) { page = t }
  }
  /// آخر موضع قراءة (المفتاح نفسه في نسخة الويب: quran.lastRead)
  private func remember(_ p: Int) {
    guard let a = QuranText.shared.pageAyahs(p).first else { return }
    model.settings.lastRead = LastRead(page: p, surah: a.surah, ayah: a.ayah, at: Date().timeIntervalSince1970 * 1000)
  }
}

/// فهرس المصحف: السور (مع بحث)، الأجزاء، والانتقال إلى صفحة
struct MushafIndexView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  let currentPage: Int
  var onSelect: (Int) -> Void
  @State private var tab = 0
  @State private var query = ""
  @State private var pageText = ""
  @FocusState private var pageFocused: Bool

  var body: some View {
    NavigationStack {
      VStack(spacing: 0) {
        Picker("القسم", selection: $tab) { Text("السور").tag(0); Text("الأجزاء").tag(1); Text("صفحة").tag(2) }
          .pickerStyle(.segmented).padding(.horizontal).padding(.bottom, 8)
        switch tab {
        case 0: SurahListView(query: $query, currentPage: currentPage) { onSelect($0) }
        case 1: juzList
        default: pageEntry
        }
      }
      .navigationTitle("الفهرس").navigationBarTitleDisplayMode(.inline)
      .toolbar { ToolbarItem(placement: .cancellationAction) { Button("إغلاق") { dismiss() } } }
    }
  }

  private var juzList: some View {
    let s = model.settings
    return List(QuranMeta.juzStarts, id: \.juz) { j in
      Button { onSelect(j.page) } label: {
        HStack {
          Text(Fmt.number(j.juz, numerals: s.numerals)).font(.arabic(15, weight: .bold)).frame(width: 34, height: 34).background(Theme.primary.opacity(0.12), in: Circle())
          VStack(alignment: .leading, spacing: 2) {
            Text(QuranMeta.juzName(j.juz, vocalized: false)).font(.arabic(16))
            Text("\(QuranMeta.surah(j.surah).name) · الآية \(Fmt.number(j.ayah, numerals: s.numerals)) · صفحة \(Fmt.number(j.page, numerals: s.numerals))").font(.arabic(12)).foregroundStyle(.secondary)
          }
          Spacer()
          if QuranMeta.juz(ofPage: currentPage) == j.juz { Image(systemName: "bookmark.fill").foregroundStyle(Theme.gold) }
        }
      }
      .tint(.primary)
    }
    .listStyle(.plain)
  }

  private var pageEntry: some View {
    let s = model.settings
    return Form {
      Section("الانتقال إلى صفحة") {
        TextField("1 – 604", text: $pageText).keyboardType(.numberPad).focused($pageFocused).font(.arabic(22, weight: .bold)).multilineTextAlignment(.center)
        Button("اذهب") { if let p = Int(pageText.map { c in c.wholeNumberValue.map { String($0) } ?? String(c) }.joined()), (1...MushafLayout.totalPages).contains(p) { onSelect(p) } }
          .frame(maxWidth: .infinity).font(.arabic(16, weight: .bold))
          .disabled(!(1...MushafLayout.totalPages).contains(Int(pageText.map { c in c.wholeNumberValue.map { String($0) } ?? String(c) }.joined()) ?? 0))
      }
      Section {
        Text("الصفحة الحالية: \(Fmt.number(currentPage, numerals: s.numerals))").font(.arabic(14)).foregroundStyle(.secondary)
        if let l = QuranText.shared.label(ofPage: currentPage) {
          Text("سورة \(QuranMeta.surah(l.surah).name) · \(QuranMeta.juzName(l.juz, vocalized: false)) · الحزب \(Fmt.number(l.hizb, numerals: s.numerals))").font(.arabic(14)).foregroundStyle(.secondary)
        }
      }
    }
    .onAppear { pageFocused = true }
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
    if let n = Int(q), (1...114).contains(n) { return [QuranMeta.surah(n)] }
    return QuranMeta.surahs.filter { CityDatabase.normalize($0.plain).contains(q) || CityDatabase.normalize($0.name).contains(q) || $0.en.lowercased().contains(q) }
  }

  var body: some View {
    let s = model.settings
    List(filtered) { su in
      Button { onSelect(su.page) } label: { SurahRow(surah: su, numerals: s.numerals, current: currentPage >= su.page && currentPage < (su.n < 114 ? QuranMeta.surah(su.n + 1).page : 605)) }
        .tint(.primary)
    }
    .listStyle(.plain)
    .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "ابحث عن سورة")
  }
}

struct SurahRow: View {
  let surah: Surah; let numerals: String; var current = false
  var body: some View {
    HStack(spacing: 12) {
      ZStack {
        Image(systemName: "seal").font(.system(size: 34, weight: .ultraLight)).foregroundStyle(Theme.gold)
        Text(Fmt.number(surah.n, numerals: numerals)).font(.arabic(13, weight: .bold))
      }
      .frame(width: 38)
      VStack(alignment: .leading, spacing: 2) {
        Text(surah.name).font(.arabic(17, weight: .semibold))
        Text("\(surah.type) · \(Fmt.number(surah.ayahs, numerals: numerals)) آية · صفحة \(Fmt.number(surah.page, numerals: numerals))").font(.arabic(12)).foregroundStyle(.secondary)
      }
      Spacer()
      if current { Image(systemName: "bookmark.fill").foregroundStyle(Theme.gold) }
      Text(surah.en).font(.system(size: 12)).foregroundStyle(.tertiary)
    }
    .contentShape(Rectangle())
  }
}
