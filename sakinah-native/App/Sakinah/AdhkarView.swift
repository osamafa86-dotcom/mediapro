import SwiftUI
import AVFoundation
import AudioToolbox
import SakinahCore

/// شاشة الأذكار (تصميم Figma 07): بطاقتا الصباح والمساء بحلقة تقدّم، سلسلة الأيام، مدخل حصن المسلم، وبطاقة المسبحة
struct AdhkarHomeView: View {
  @Environment(AppModel.self) private var model
  @State private var period = ""
  @State private var session: String?
  @State private var showHisn = false
  @State private var showTasbih = false
  @State private var query = ""
  @State private var searching = false
  @State private var showReminders = false

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(spacing: DS.Space.s3) {
          if searching { searchField } else { periodCards }
          if searching { searchResults } else {
            streakCard
            hisnCard
            tasbihCard
            Text("النصوص من كتاب «حصن المسلم» للشيخ سعيد بن علي بن وهف القحطاني، بترتيبه وتخريجه.")
              .font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
              .multilineTextAlignment(.center).padding(.top, DS.Space.s1)
          }
        }
        .padding(.horizontal, DS.Space.s4).padding(.top, DS.Space.s2).padding(.bottom, DS.Space.s8)
      }
      .background(DS.C.bgCanvas)
      .safeAreaInset(edge: .top, spacing: 0) { navBar }
      .navigationBarHidden(true)
      .onAppear { if period.isEmpty { period = autoPeriod() } }
      .fullScreenCover(item: Binding(get: { session.map { SessionID(id: $0) } }, set: { session = $0?.id })) { s in
        DhikrSessionView(period: s.id).environment(model)
      }
      .navigationDestination(isPresented: $showHisn) { HisnView().environment(model) }
      .navigationDestination(isPresented: $showTasbih) { TasbihView().environment(model) }
      .sheet(isPresented: $showReminders) { AdhkarRemindersSheet().environment(model) }
    }
  }
  private struct SessionID: Identifiable { let id: String }

  // MARK: شريط العنوان

  private var navBar: some View {
    HStack {
      HStack(spacing: DS.Space.s2) {
        DSIconButton(systemName: searching ? "xmark" : "magnifyingglass", label: searching ? "إغلاق البحث" : "بحث في الأذكار") {
          withAnimation(.snappy(duration: 0.2)) { searching.toggle(); if !searching { query = "" } }
        }
        DSIconButton(systemName: model.content.extraReminders.any ? "bell.fill" : "bell", style: model.content.extraReminders.any ? .brand : .outlined, label: "تذكيرات الأذكار") { showReminders = true }
      }
      Spacer()
      Text("الأذكار").font(DS.F.displaySm).foregroundStyle(DS.C.textPrimary)
    }
    .padding(.horizontal, DS.Space.s4).padding(.vertical, DS.Space.s3)
    .background(DS.C.bgCanvas)
  }

  private var searchField: some View {
    HStack(spacing: DS.Space.s2) {
      Image(systemName: "magnifyingglass").font(.system(size: 15)).foregroundStyle(DS.C.textTertiary)
      TextField("ابحث في الأبواب والأذكار…", text: $query).font(DS.F.bodyMd).submitLabel(.search)
      if !query.isEmpty { Button { query = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(DS.C.textTertiary) }.buttonStyle(.plain) }
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
          NavigationLink { HisnChapterView(chapter: c).environment(model) } label: {
            DSRow(icon: "book.closed", title: c.title, subtitle: HisnView.countLabel(c.items.count, numerals: numerals)) { DSChevron() }
          }
          .buttonStyle(.plain)
        }
        ForEach(res.items, id: \.item.id) { r in
          NavigationLink { HisnChapterView(chapter: r.chapter).environment(model) } label: {
            VStack(alignment: .trailing, spacing: 4) {
              Text(r.item.text.count > 110 ? String(r.item.text.prefix(110)) + "…" : r.item.text).font(DS.F.readingSm).foregroundStyle(DS.C.textPrimary).lineLimit(2)
              Text(r.chapter.title).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .trailing).dsTile()
          }
          .buttonStyle(.plain)
        }
      }
    }
  }

  // MARK: بطاقتا الصباح والمساء

  private var periodCards: some View {
    HStack(spacing: DS.Space.s3) {
      periodCard("evening")
      periodCard("morning")
    }
  }

  private func periodCard(_ p: String) -> some View {
    let numerals = model.settings.numerals
    let list = Adhkar.items(for: p)
    let done = doneMap(p)
    let completed = list.filter { (done[$0.id] ?? 0) >= $0.target(for: p) }.count
    let pct = list.isEmpty ? 0.0 : Double(completed) / Double(list.count)
    let started = completed > 0
    let gold = p == "morning"
    return VStack(alignment: .trailing, spacing: DS.Space.s3) {
      HStack(alignment: .top) {
        Text("\(Fmt.number(Int(pct * 100), numerals: numerals))٪").font(DS.F.numericMd).foregroundStyle(gold ? DS.C.accentGoldStrong : DS.C.brandPrimary)
        Spacer()
        ZStack {
          RingProgress(progress: pct, tint: gold ? DS.C.accentGold : DS.C.brandPrimary, lineWidth: 4).frame(width: 46, height: 46)
          Image(systemName: gold ? "sunrise" : "moon").font(.system(size: 17, weight: .medium)).foregroundStyle(gold ? DS.C.accentGoldStrong : DS.C.brandPrimary)
          if !started && !gold { Circle().fill(DS.C.brandPrimary).frame(width: 7, height: 7).offset(x: 20, y: -20) }
        }
      }
      VStack(alignment: .trailing, spacing: 2) {
        Text(gold ? "أذكار الصباح" : "أذكار المساء").font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary)
        Text("\(Fmt.number(completed, numerals: numerals)) من \(Fmt.number(list.count, numerals: numerals)) · \(windowLabel(p))")
          .font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).lineLimit(1).minimumScaleFactor(0.75)
      }
      DSButton(title: started ? "متابعة" : "ابدأ", kind: gold ? .gold : .soft, icon: "chevron.forward") { period = p; session = p }
    }
    .frame(maxWidth: .infinity, alignment: .trailing)
    .dsCard(padding: DS.Space.s4)
  }

  private func windowLabel(_ p: String) -> String {
    let tl = model.timeline(now: Date())
    if p == "morning" {
      guard let f = tl?.times[.fajr] else { return "بعد الفجر" }
      return Date() >= f ? "بدأت \(Fmt.time(f, tz: model.timeZone, hour12: model.settings.hour12, numerals: model.settings.numerals))" : "تبدأ بعد الفجر"
    }
    guard let a = tl?.times[.asr] else { return "بعد العصر" }
    return Date() >= a ? "بدأت \(Fmt.time(a, tz: model.timeZone, hour12: model.settings.hour12, numerals: model.settings.numerals))" : "تبدأ بعد العصر"
  }

  // MARK: سلسلة الأيام

  private var streakCard: some View {
    let numerals = model.settings.numerals
    let log = model.content.adhkarLog
    let today = model.todayKey
    let days = AdhkarStreak.lastDays(log, today: today)
    let cur = AdhkarStreak.current(log, today: today)
    let best = max(AdhkarStreak.longest(log), cur)
    let todayDone = !(log[today]?.isEmpty ?? true)
    let ex = model.content.extraReminders
    return VStack(alignment: .trailing, spacing: DS.Space.s3) {
      HStack {
        if best > 0 { Text("الأطول \(Fmt.number(best, numerals: numerals)) يومًا").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary) }
        Spacer()
        HStack(spacing: 6) {
          Text(cur > 0 ? "سلسلة \(Fmt.number(cur, numerals: numerals)) \(dayWord(cur))" : "ابدأ سلسلتك اليوم").font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary)
          Image(systemName: "flame.fill").font(.system(size: 15)).foregroundStyle(cur > 0 ? DS.C.accentGoldStrong : DS.C.textTertiary)
        }
      }
      HStack(spacing: 6) {
        ForEach(days) { d in
          ZStack {
            Circle().fill(d.done ? DS.C.brandPrimary : DS.C.bgSubtle)
            if d.isToday && !d.done { Circle().stroke(DS.C.accentGold, lineWidth: 2) }
            if d.done { Image(systemName: "checkmark").font(.system(size: 12, weight: .bold)).foregroundStyle(DS.C.textOnBrand) }
            else { Text(d.letter).font(DS.F.labelXs).foregroundStyle(d.isToday ? DS.C.accentGoldStrong : DS.C.textTertiary) }
          }
          .frame(maxWidth: .infinity).frame(height: 38)
        }
      }
      Text(todayDone ? "أحسنت — أذكار اليوم مكتملة، حافظ على السلسلة غدًا." : "أكمل أذكار \(period == "morning" ? "الصباح" : "المساء") اليوم لتحافظ على السلسلة\(ex.adhkarEvening ? " · تذكير بعد العصر بـ\(Fmt.number(ex.eveningAfter, numerals: numerals)) د" : "")")
        .font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).frame(maxWidth: .infinity, alignment: .trailing)
    }
    .dsCard()
  }
  private func dayWord(_ n: Int) -> String { n == 1 ? "يوم" : n == 2 ? "يومان" : n <= 10 ? "أيام" : "يومًا" }

  // MARK: حصن المسلم

  private var hisnCard: some View {
    let numerals = model.settings.numerals
    let favs = model.content.hisnFavorites.compactMap { Hisn.chapter($0) }
    let picks = favs.isEmpty ? [Hisn.chapter(28), Hisn.chapter(30), Hisn.chapter(19)].compactMap { $0 } : Array(favs.prefix(3))
    return VStack(spacing: DS.Space.s3) {
      DSSectionHead("حصن المسلم") {
        Button { showHisn = true } label: { DSLinkLabel(title: "كل الأبواب (\(Fmt.number(Hisn.chapters.count, numerals: numerals)))") }.buttonStyle(.plain)
      }
      VStack(spacing: 0) {
        ForEach(Array(picks.enumerated()), id: \.element.id) { i, c in
          if i > 0 { Divider().overlay(DS.C.borderSubtle) }
          NavigationLink { HisnChapterView(chapter: c).environment(model) } label: {
            DSRow(icon: chapterIcon(c.id), title: c.title, subtitle: chapterHint(c.id)) {
              HStack(spacing: 6) { Text(Fmt.number(c.items.count, numerals: numerals)).font(DS.F.labelSm).foregroundStyle(DS.C.textTertiary); DSChevron() }
            }
          }
          .buttonStyle(.plain)
        }
      }
    }
    .dsCard(padding: DS.Space.s4)
  }
  private func chapterIcon(_ id: Int) -> String {
    switch id { case 28: return "circle.hexagongrid"; case 30: return "moon"; case 19: return "shield"; default: return "book.closed" }
  }
  private func chapterHint(_ id: Int) -> String? {
    switch id { case 28: return "تسبيح وتحميد وتكبير"; case 30: return "ما يقال عند النوم"; case 19: return "والحزن"; default: return nil }
  }

  // MARK: المسبحة

  private var tasbihCard: some View {
    let numerals = model.settings.numerals
    let st = model.content.tasbih
    let pct = st.target > 0 ? Double(st.count) / Double(st.target) : 0
    return Button { showTasbih = true } label: {
      HStack(spacing: DS.Space.s3) {
        ZStack {
          RingProgress(progress: pct, tint: DS.C.accentGold, lineWidth: 4).frame(width: 52, height: 52)
          Text(Fmt.number(st.count, numerals: numerals)).font(DS.F.numericSm).foregroundStyle(DS.C.textPrimary).monospacedDigit()
        }
        Spacer()
        VStack(alignment: .trailing, spacing: 3) {
          Text("المسبحة").font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary)
          Text("\(Tasbih.phraseText(st)) · اليوم \(Fmt.number(Tasbih.todayCount(st, today: model.todayKey), numerals: numerals)) · الإجمالي \(Fmt.number(Tasbih.grandTotal(st), numerals: numerals))")
            .font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).lineLimit(1).minimumScaleFactor(0.7)
        }
      }
      .dsCard(padding: DS.Space.s4)
    }
    .buttonStyle(.plain)
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
        Text("\(Fmt.number(index + 1, numerals: numerals)) من \(Fmt.number(total, numerals: numerals)) · بقي نحو \(Fmt.number(max(1, (total - done) / 5), numerals: numerals)) دقائق")
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
        Text("حصن المسلم · \(title)").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
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
      Text("انقر في أي مكان للعدّ · اهتزاز خفيف عند الاكتمال")
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
    guard let it = Hisn.chapter(d.hisnId)?.items.first, it.hasAudio else { return }
    try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
    let p = AVPlayer(url: it.audioURL); player = p; playingId = d.id; p.play()
    NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: p.currentItem, queue: .main) { _ in playingId = nil }
  }
}

/// حصن المسلم كاملًا: أقسام وأبواب مع بحث، وباب بعدّاد لكل ذكر وتلاوة صوتية ومفضلة
struct HisnView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  @State private var query = ""
  var body: some View {
    let numerals = model.settings.numerals
    let favs = model.content.hisnFavorites
    let res = Hisn.search(query)
    let searching = CityDatabase.normalize(query).count >= 2
    List {
      if searching {
        if !res.chapters.isEmpty { Section("أبواب (\(Fmt.number(res.chapters.count, numerals: numerals)))") { ForEach(res.chapters) { c in chapterRow(c, fav: favs.contains(c.id), numerals: numerals) } } }
        if !res.items.isEmpty { Section("أذكار (\(Fmt.number(res.items.count, numerals: numerals))\(res.items.count >= 60 ? "+" : ""))") { ForEach(res.items, id: \.item.id) { r in NavigationLink { HisnChapterView(chapter: r.chapter) } label: { VStack(alignment: .trailing, spacing: 3) { Text(r.item.text.count > 110 ? String(r.item.text.prefix(110)) + "…" : r.item.text).font(DS.F.readingSm).lineLimit(2); Text(r.chapter.title).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary) } } } } }
        if res.chapters.isEmpty && res.items.isEmpty { Text("لا نتائج — جرّب كلمة أخرى").foregroundStyle(DS.C.textSecondary) }
      } else {
        if !favs.isEmpty { Section("♥ المفضلة") { ForEach(favs.compactMap { Hisn.chapter($0) }) { c in chapterRow(c, fav: true, numerals: numerals) } } }
        ForEach(Hisn.sections, id: \.title) { s in Section(s.title) { ForEach(s.chapters.compactMap { Hisn.chapter($0) }) { c in chapterRow(c, fav: favs.contains(c.id), numerals: numerals) } } }
        Section { Text("\(Fmt.number(Hisn.chapters.count, numerals: numerals)) بابًا و\(Fmt.number(Hisn.itemCount, numerals: numerals)) ذكرًا من كتاب «حصن المسلم» للشيخ سعيد بن علي بن وهف القحطاني، بنصوص الطبعة الرسمية وتشكيلها.").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary) }
      }
    }
    .scrollContentBackground(.hidden).background(DS.C.bgCanvas)
    .searchable(text: $query, prompt: "ابحث في الأبواب والأذكار…")
    .navigationTitle("حصن المسلم").navigationBarTitleDisplayMode(.inline)
  }
  private func chapterRow(_ c: HisnChapter, fav: Bool, numerals: String) -> some View {
    NavigationLink { HisnChapterView(chapter: c) } label: {
      HStack(spacing: DS.Space.s3) {
        Text(Fmt.number(c.id, numerals: numerals)).font(DS.F.labelSm).foregroundStyle(DS.C.brandPrimary)
          .frame(width: 34, height: 34).background(DS.C.brandSoft, in: Circle())
        VStack(alignment: .trailing, spacing: 2) { Text(c.title).font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary); Text(countLabel(c.items.count, numerals: numerals)).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary) }
        Spacer()
        if fav { Image(systemName: "heart.fill").foregroundStyle(DS.C.danger).font(.system(size: 13)) }
      }
    }
  }
  static func countLabel(_ n: Int, numerals: String) -> String { n == 1 ? "ذكر واحد" : n == 2 ? "ذكران" : n <= 10 ? "\(Fmt.number(n, numerals: numerals)) أذكار" : "\(Fmt.number(n, numerals: numerals)) ذكرًا" }
  private func countLabel(_ n: Int, numerals: String) -> String { Self.countLabel(n, numerals: numerals) }
}

/// باب من حصن المسلم: عدّاد جلسة لكل ذكر (لا يُحفظ)، تلاوة من موقع الكتاب عند الطلب، مفضلة، وتنقل بين الأبواب
struct HisnChapterView: View {
  @Environment(AppModel.self) private var model
  let chapter: HisnChapter
  @State private var counts: [Int: Int] = [:]
  @State private var playingId: Int?
  @State private var player: AVPlayer?
  @State private var shareCard: ShareCardRequest?
  var body: some View {
    let numerals = model.settings.numerals
    let idx = Hisn.chapters.firstIndex { $0.id == chapter.id } ?? 0
    let prev = idx > 0 ? Hisn.chapters[idx - 1] : nil, next = idx + 1 < Hisn.chapters.count ? Hisn.chapters[idx + 1] : nil
    let fav = model.content.hisnFavorites.contains(chapter.id)
    ScrollView {
      VStack(spacing: DS.Space.s3) {
        Text("الباب \(Fmt.number(chapter.id, numerals: numerals)) · \(HisnView.countLabel(chapter.items.count, numerals: numerals))").font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary)
        if chapter.id == 27 { Text("أذكار الصباح والمساء بعدّاد يومي محفوظ في تبويب «الأذكار»").font(DS.F.labelSm).foregroundStyle(DS.C.brandPrimary) }
        ForEach(chapter.items) { it in
          let c = counts[it.id] ?? 0
          DhikrCard(text: it.text, target: it.repeatCount, count: c, audioURL: it.hasAudio ? it.audioURL : nil, isPlayingAudio: playingId == it.id,
                    shareTitle: "من حصن المسلم", shareText: "\(it.text)\n\n— حصن المسلم: \(chapter.title)",
                    onTap: { if c >= it.repeatCount { counts[it.id] = 0 } else { counts[it.id] = c + 1; if c + 1 >= it.repeatCount { UINotificationFeedbackGenerator().notificationOccurred(.success) } else { UIImpactFeedbackGenerator(style: .light).impactOccurred() } } },
                    onAudio: { toggleAudio(it) },
                    onShareImage: { shareCard = ShareCardRequest(title: "حصن المسلم · \(chapter.title)", text: it.text, footer: it.repeatCount > 1 ? "يُقال \(DhikrCard.repeatLabel(it.repeatCount, numerals: numerals))" : "", quran: false, shareText: "\(it.text)\n\n— حصن المسلم: \(chapter.title)", filename: "hisn-\(it.id).png") })
        }
        HStack {
          if let p = prev { NavigationLink { HisnChapterView(chapter: p) } label: { DSButtonLabel(title: p.title, kind: .outline, icon: "chevron.forward", fill: false) }.buttonStyle(.plain) }
          Spacer()
          if let n = next { NavigationLink { HisnChapterView(chapter: n) } label: { DSButtonLabel(title: n.title, kind: .outline, icon: "chevron.backward", fill: false) }.buttonStyle(.plain) }
        }
        Text("حصن المسلم من أذكار الكتاب والسنة — الشيخ سعيد بن علي بن وهف القحطاني. التلاوة الصوتية تُجلب من موقع الكتاب عند الطلب فقط.").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).multilineTextAlignment(.center)
      }
      .padding(DS.Space.s4)
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

/// المسبحة (تصميم Figma 09): شرائط الصيغ، قرص كبير بحلقة ذهبية، ثلاث بلاطات إحصاء، وبطاقة إعدادات
struct TasbihView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  @State private var reached = false
  @State private var showCustom = false
  @State private var customText = ""
  @State private var showTargets = false

  var body: some View {
    let numerals = model.settings.numerals
    let key = model.todayKey
    let st = model.content.tasbih
    let pct = st.target > 0 ? Double(st.count) / Double(st.target) : 0
    ScrollView {
      VStack(spacing: DS.Space.s4) {
        phraseChips(st)
        dial(st, pct: pct, numerals: numerals)
        Text("انقر الدائرة أو زرّي الصوت للعدّ").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
        HStack(spacing: DS.Space.s3) {
          DSStatTile(value: Fmt.number(Tasbih.grandTotal(st), numerals: numerals), label: "الإجمالي")
          DSStatTile(value: Fmt.number(st.rounds, numerals: numerals), label: "دورات")
          DSStatTile(value: Fmt.number(Tasbih.todayCount(st, today: key), numerals: numerals), label: "اليوم")
        }
        settingsCard(st, numerals: numerals)
        Text("الإحصاءات تُحفظ على جهازك فقط.").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
      }
      .padding(.horizontal, DS.Space.s4).padding(.top, DS.Space.s2).padding(.bottom, DS.Space.s8)
    }
    .background(DS.C.bgCanvas)
    .safeAreaInset(edge: .top, spacing: 0) { navBar(st) }
    .navigationBarHidden(true)
    .alert("ذكر مخصّص", isPresented: $showCustom) {
      TextField("مثال: حسبي الله ونعم الوكيل", text: $customText)
      Button("اعتماد") { let v = customText.trimmingCharacters(in: .whitespaces); guard !v.isEmpty else { return }; var s = model.content.tasbih; s.phrase = "custom"; s.custom = v; s.count = 0; s.rounds = 0; model.content.tasbih = s }
      Button("إلغاء", role: .cancel) {}
    }
  }

  private func navBar(_ st: TasbihState) -> some View {
    HStack {
      HStack(spacing: DS.Space.s2) {
        DSIconButton(systemName: "arrow.counterclockwise", label: "تصفير") { model.content.tasbih = Tasbih.reset(st) }
        DSIconButton(systemName: "arrow.uturn.backward", label: "تراجع") { model.content.tasbih = Tasbih.undo(st, today: model.todayKey) }
      }
      Spacer()
      HStack(spacing: DS.Space.s2) {
        Text("المسبحة").font(DS.F.displaySm).foregroundStyle(DS.C.textPrimary)
        DSIconButton(systemName: "chevron.backward", style: .plain, size: 34, iconSize: 16, label: "رجوع") { dismiss() }
      }
    }
    .padding(.horizontal, DS.Space.s4).padding(.vertical, DS.Space.s3)
    .background(DS.C.bgCanvas)
  }

  private func phraseChips(_ st: TasbihState) -> some View {
    ScrollView(.horizontal) {
      HStack(spacing: DS.Space.s2) {
        ForEach(Tasbih.phrases) { p in
          DSChip(title: p.id == "custom" ? (st.custom.isEmpty ? "ذكر آخر…" : String(st.custom.prefix(22))) : p.text, on: st.phrase == p.id) {
            if p.id == "custom" { customText = st.custom; showCustom = true }
            else { var s = st; s.phrase = p.id; s.count = 0; s.rounds = 0; model.content.tasbih = s }
          }
        }
      }
      .padding(.horizontal, 2)
    }
    .scrollIndicators(.hidden)
  }

  private func dial(_ st: TasbihState, pct: Double, numerals: String) -> some View {
    Button { tap() } label: {
      ZStack {
        Circle().fill(DS.C.bgSurface).shadow(color: DS.C.shadowCard, radius: 16, x: 0, y: 6)
        RingProgress(progress: reached ? 1 : pct, tint: DS.C.accentGold, lineWidth: 12)
          .animation(.easeOut(duration: 0.2), value: st.count)
        VStack(spacing: 6) {
          Text(Tasbih.phraseText(st))
            .font(DS.quran(19)).foregroundStyle(DS.C.brandPrimary)
            .multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.6).padding(.horizontal, 28)
          Text(Fmt.number(reached ? st.target : st.count, numerals: numerals))
            .font(DS.F.numericHero).foregroundStyle(DS.C.textPrimary).monospacedDigit()
          Text(st.target > 0 ? "من \(Fmt.number(st.target, numerals: numerals)) · الدورة \(Fmt.number(st.rounds + 1, numerals: numerals))" : "بلا حدّ")
            .font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary)
        }
      }
      .frame(width: 240, height: 240)
    }
    .buttonStyle(.plain)
    .accessibilityLabel("عدّ — \(Tasbih.phraseText(st))")
  }

  private func settingsCard(_ st: TasbihState, numerals: String) -> some View {
    VStack(spacing: 0) {
      Toggle(isOn: Binding(get: { model.settings.haptics }, set: { model.settings.haptics = $0 })) {
        DSRowLabel(icon: "bolt", title: "اهتزاز عند كل عدّة", subtitle: "واهتزاز أقوى عند الاكتمال")
      }
      .toggleStyle(DSToggleStyle()).padding(.vertical, DS.Space.s2)
      Divider().overlay(DS.C.borderSubtle)
      Toggle(isOn: Binding(get: { model.settings.tasbihSound }, set: { model.settings.tasbihSound = $0 })) {
        DSRowLabel(icon: "speaker.wave.2", title: "صوت النقر", subtitle: model.settings.tasbihSound ? "مفعّل" : "مطفأ")
      }
      .toggleStyle(DSToggleStyle()).padding(.vertical, DS.Space.s2)
      Divider().overlay(DS.C.borderSubtle)
      Button { showTargets.toggle() } label: {
        HStack {
          DSRowLabel(icon: "target", title: "الهدف", subtitle: st.target > 0 ? "\(Fmt.number(st.target, numerals: numerals)) لكل دورة" : "بلا حدّ")
          Spacer()
          Text(st.target > 0 ? Fmt.number(st.target, numerals: numerals) : "∞")
            .font(DS.F.labelSm).foregroundStyle(DS.C.brandPrimary)
            .padding(.vertical, 5).padding(.horizontal, 12).background(DS.C.brandSoft, in: Capsule())
        }
        .padding(.vertical, DS.Space.s2)
      }
      .buttonStyle(.plain)
      if showTargets {
        HStack(spacing: DS.Space.s2) {
          ForEach(Tasbih.targets, id: \.self) { t in
            DSChip(title: t > 0 ? Fmt.number(t, numerals: numerals) : "بلا حدّ", on: st.target == t) {
              var s = st; s.target = t; s.count = 0; s.rounds = 0; model.content.tasbih = s; showTargets = false
            }
          }
        }
        .padding(.top, DS.Space.s1)
      }
    }
    .dsCard(padding: DS.Space.s4)
  }

  private func tap() {
    let r = Tasbih.tap(model.content.tasbih, today: model.todayKey)
    model.content.tasbih = r.state
    if r.reached {
      if model.settings.haptics { UINotificationFeedbackGenerator().notificationOccurred(.success) }
      reached = true; DispatchQueue.main.asyncAfter(deadline: .now() + 0.65) { reached = false }
    } else if model.settings.haptics {
      UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
    if model.settings.tasbihSound { AudioServicesPlaySystemSound(1104) }
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
