import SwiftUI
import AVFoundation
import SakinahCore

/// أذكار الصباح والمساء: عدّاد لكل ذكر مع حفظ التقدّم اليومي، والفترة تلقائيًا من مواقيت الصلاة؛ ومداخل حصن المسلم والمسبحة
struct AdhkarHomeView: View {
  @Environment(AppModel.self) private var model
  @State private var period = ""
  @State private var hideDone = false
  @State private var shareCard: ShareCardRequest?

  var body: some View {
    NavigationStack {
      let numerals = model.settings.numerals
      let prog = current()
      let done = (period == "evening" ? prog.evening : prog.morning) ?? [:]
      let list = Adhkar.items(for: period)
      let completed = list.filter { (done[$0.id] ?? 0) >= $0.target(for: period) }.count
      ScrollView {
        VStack(spacing: 12) {
          HStack(spacing: 10) {
            NavigationLink { HisnView() } label: { tile("حصن المسلم", "الكتاب كاملًا: ١٣٢ بابًا", "book.closed") }
            NavigationLink { TasbihView() } label: { tile("المسبحة", "عدّاد التسبيح", "circle.grid.3x3") }
          }
          Picker("الفترة", selection: $period) { Text("☀️ أذكار الصباح").tag("morning"); Text("🌙 أذكار المساء").tag("evening") }.pickerStyle(.segmented)
          HStack(spacing: 14) {
            ZStack {
              Circle().stroke(Color.secondary.opacity(0.2), lineWidth: 6)
              Circle().trim(from: 0, to: list.isEmpty ? 0 : Double(completed) / Double(list.count)).stroke(Theme.primary, style: StrokeStyle(lineWidth: 6, lineCap: .round)).rotationEffect(.degrees(-90))
              Text("\(Fmt.number(completed, numerals: numerals))/\(Fmt.number(list.count, numerals: numerals))").font(.arabic(14, weight: .bold))
            }
            .frame(width: 64, height: 64)
            VStack(alignment: .leading, spacing: 4) {
              Text(period == "morning" ? "أذكار الصباح" : "أذكار المساء").font(.arabic(16, weight: .bold))
              Text(period == "morning" ? "من بعد الفجر إلى طلوع الشمس، وتُجزئ إلى الزوال" : "من بعد العصر إلى الغروب، وتُجزئ إلى منتصف الليل").font(.arabic(11)).foregroundStyle(.secondary)
              HStack(spacing: 8) {
                Button { reset() } label: { Label("إعادة", systemImage: "arrow.counterclockwise") }.buttonStyle(.bordered).font(.arabic(12))
                Toggle("إخفاء المكتمل", isOn: $hideDone).font(.arabic(12)).toggleStyle(.button).buttonStyle(.bordered)
                Stepper("", value: Binding(get: { model.content.textScale }, set: { model.content.textScale = min(1.6, max(0.8, $0)) }), in: 0.8...1.6, step: 0.1).labelsHidden()
              }
            }
            Spacer(minLength: 0)
          }
          .padding(14).background(Theme.cardBackground, in: RoundedRectangle(cornerRadius: 16))
          ForEach(list.filter { !hideDone || (done[$0.id] ?? 0) < $0.target(for: period) }) { d in
            let tgt = d.target(for: period); let c = done[d.id] ?? 0
            DhikrCard(text: d.text(for: period), target: tgt, count: c, virtue: d.virtue, reference: d.reference, note: d.note,
                      shareTitle: "من أذكار \(period == "morning" ? "الصباح" : "المساء")", shareText: "\(d.text(for: period))\n\n\(d.reference)",
                      onTap: { tap(d, target: tgt, current: c, total: list.count) },
                      onShareImage: { shareCard = ShareCardRequest(title: period == "morning" ? "أذكار الصباح" : "أذكار المساء", text: d.text(for: period), footer: d.reference, quran: false, shareText: "\(d.text(for: period))\n\n\(d.reference)", filename: "dhikr-\(d.id).png") })
          }
          Text("النصوص من كتاب «حصن المسلم» للشيخ سعيد بن علي القحطاني، بترتيبه وتخريجه. اضغط على الذكر أو على العدّاد للعدّ.").font(.arabic(11)).foregroundStyle(.tertiary).multilineTextAlignment(.center)
        }
        .padding()
      }
      .background(Theme.background)
      .navigationTitle("الأذكار")
      .onAppear { if period.isEmpty { period = autoPeriod() } }
      .sheet(item: $shareCard) { ShareCardSheet(request: $0).environment(model) }
    }
  }
  private func tile(_ title: String, _ sub: String, _ icon: String) -> some View {
    VStack(spacing: 6) { Image(systemName: icon).font(.system(size: 24)).foregroundStyle(Theme.primary); Text(title).font(.arabic(15, weight: .bold)); Text(sub).font(.arabic(11)).foregroundStyle(.secondary) }
      .frame(maxWidth: .infinity).padding(.vertical, 14).background(Theme.cardBackground, in: RoundedRectangle(cornerRadius: 16)).foregroundStyle(.primary)
  }
  private func autoPeriod() -> String {
    let tl = model.timeline(now: Date())
    return Adhkar.autoPeriod(now: Date(), fajr: tl?.times[.fajr], dhuhr: tl?.times[.dhuhr], asr: tl?.times[.asr], tz: model.timeZone)
  }
  /// تقدّم اليوم (قراءة صرفة): أذكار الصباح تُصفَّر مع اليوم المدني، وأذكار المساء تمتد إلى فجر اليوم التالي؛ الحفظ يتم عند العدّ فقط
  private func current() -> WebSettings.AdhkarProgress {
    var p = model.content.adhkarProgress; let key = model.todayKey
    let tl = model.timeline(now: Date()); let afterFajr = tl?.times[.fajr].map { Date() >= $0 } ?? true
    if p.date != key {
      p = WebSettings.AdhkarProgress(date: key, morning: [:], evening: afterFajr ? [:] : (p.evening ?? [:]), eveningDate: afterFajr ? key : (p.eveningDate ?? p.date ?? key))
    } else if afterFajr, let ed = p.eveningDate, ed != key {
      p.evening = [:]; p.eveningDate = key
    }
    return p
  }
  private func tap(_ d: Dhikr, target: Int, current: Int, total: Int) {
    guard current < target else { return }
    var p = self.current()
    if period == "evening" { var e = p.evening ?? [:]; e[d.id] = current + 1; p.evening = e } else { var m = p.morning ?? [:]; m[d.id] = current + 1; p.morning = m }
    model.content.adhkarProgress = p
    if current + 1 >= target { UINotificationFeedbackGenerator().notificationOccurred(.success) } else { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
  }
  private func reset() { var p = current(); if period == "evening" { p.evening = [:] } else { p.morning = [:] }; model.content.adhkarProgress = p }
}

/// حصن المسلم كاملًا: أقسام وأبواب مع بحث، وباب بعدّاد لكل ذكر وتلاوة صوتية ومفضلة
struct HisnView: View {
  @Environment(AppModel.self) private var model
  @State private var query = ""
  var body: some View {
    let numerals = model.settings.numerals
    let favs = model.content.hisnFavorites
    let res = Hisn.search(query)
    let searching = CityDatabase.normalize(query).count >= 2
    List {
      if searching {
        if !res.chapters.isEmpty { Section("أبواب (\(Fmt.number(res.chapters.count, numerals: numerals)))") { ForEach(res.chapters) { c in chapterRow(c, fav: favs.contains(c.id), numerals: numerals) } } }
        if !res.items.isEmpty { Section("أذكار (\(Fmt.number(res.items.count, numerals: numerals))\(res.items.count >= 60 ? "+" : ""))") { ForEach(res.items, id: \.item.id) { r in NavigationLink { HisnChapterView(chapter: r.chapter) } label: { VStack(alignment: .leading, spacing: 3) { Text(r.item.text.count > 110 ? String(r.item.text.prefix(110)) + "…" : r.item.text).font(.arabic(14)).lineLimit(2); Text(r.chapter.title).font(.arabic(11)).foregroundStyle(.secondary) } } } } }
        if res.chapters.isEmpty && res.items.isEmpty { Text("لا نتائج — جرّب كلمة أخرى").foregroundStyle(.secondary) }
      } else {
        if !favs.isEmpty { Section("♥ المفضلة") { ForEach(favs.compactMap { Hisn.chapter($0) }) { c in chapterRow(c, fav: true, numerals: numerals) } } }
        ForEach(Hisn.sections, id: \.title) { s in Section(s.title) { ForEach(s.chapters.compactMap { Hisn.chapter($0) }) { c in chapterRow(c, fav: favs.contains(c.id), numerals: numerals) } } }
        Section { Text("\(Fmt.number(Hisn.chapters.count, numerals: numerals)) بابًا و\(Fmt.number(Hisn.itemCount, numerals: numerals)) ذكرًا من كتاب «حصن المسلم» للشيخ سعيد بن علي بن وهف القحطاني، بنصوص الطبعة الرسمية وتشكيلها.").font(.arabic(11)).foregroundStyle(.tertiary) }
      }
    }
    .searchable(text: $query, prompt: "ابحث في الأبواب والأذكار…")
    .navigationTitle("حصن المسلم").navigationBarTitleDisplayMode(.inline)
  }
  private func chapterRow(_ c: HisnChapter, fav: Bool, numerals: String) -> some View {
    NavigationLink { HisnChapterView(chapter: c) } label: {
      HStack(spacing: 12) {
        Text(Fmt.number(c.id, numerals: numerals)).font(.arabic(13, weight: .bold)).frame(width: 34, height: 34).background(Theme.primary.opacity(0.12), in: Circle())
        VStack(alignment: .leading, spacing: 2) { Text(c.title).font(.arabic(15)); Text(countLabel(c.items.count, numerals: numerals)).font(.arabic(11)).foregroundStyle(.secondary) }
        Spacer()
        if fav { Image(systemName: "heart.fill").foregroundStyle(.red).font(.system(size: 13)) }
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
      VStack(spacing: 12) {
        Text("الباب \(Fmt.number(chapter.id, numerals: numerals)) · \(HisnView.countLabel(chapter.items.count, numerals: numerals))").font(.arabic(12)).foregroundStyle(.secondary)
        if chapter.id == 27 { Text("أذكار الصباح والمساء بعدّاد يومي محفوظ في تبويب «الأذكار»").font(.arabic(12)).foregroundStyle(Theme.primary) }
        ForEach(chapter.items) { it in
          let c = counts[it.id] ?? 0
          DhikrCard(text: it.text, target: it.repeatCount, count: c, audioURL: it.hasAudio ? it.audioURL : nil, isPlayingAudio: playingId == it.id,
                    shareTitle: "من حصن المسلم", shareText: "\(it.text)\n\n— حصن المسلم: \(chapter.title)",
                    onTap: { if c >= it.repeatCount { counts[it.id] = 0 } else { counts[it.id] = c + 1; if c + 1 >= it.repeatCount { UINotificationFeedbackGenerator().notificationOccurred(.success) } else { UIImpactFeedbackGenerator(style: .light).impactOccurred() } } },
                    onAudio: { toggleAudio(it) },
                    onShareImage: { shareCard = ShareCardRequest(title: "حصن المسلم · \(chapter.title)", text: it.text, footer: it.repeatCount > 1 ? "يُقال \(DhikrCard.repeatLabel(it.repeatCount, numerals: numerals))" : "", quran: false, shareText: "\(it.text)\n\n— حصن المسلم: \(chapter.title)", filename: "hisn-\(it.id).png") })
        }
        HStack {
          if let p = prev { NavigationLink { HisnChapterView(chapter: p) } label: { Label(p.title, systemImage: "chevron.forward").lineLimit(1) }.buttonStyle(.bordered) }
          Spacer()
          if let n = next { NavigationLink { HisnChapterView(chapter: n) } label: { HStack { Text(n.title).lineLimit(1); Image(systemName: "chevron.backward") } }.buttonStyle(.bordered) }
        }
        .font(.arabic(12))
        Text("حصن المسلم من أذكار الكتاب والسنة — الشيخ سعيد بن علي بن وهف القحطاني. التلاوة الصوتية تُجلب من موقع الكتاب عند الطلب فقط.").font(.arabic(11)).foregroundStyle(.tertiary).multilineTextAlignment(.center)
      }
      .padding()
    }
    .background(Theme.background)
    .navigationTitle(chapter.title).navigationBarTitleDisplayMode(.inline)
    .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { model.content.toggleHisnFavorite(chapter.id) } label: { Image(systemName: fav ? "heart.fill" : "heart").foregroundStyle(fav ? .red : Theme.primary) }.accessibilityLabel(fav ? "إزالة من المفضلة" : "إضافة إلى المفضلة") } }
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

/// المسبحة الإلكترونية: زر كبير مع حلقة تقدّم، صيغ جاهزة أو مخصّصة، هدف، دورات، وإحصاء اليوم والإجمالي
struct TasbihView: View {
  @Environment(AppModel.self) private var model
  @State private var reached = false
  @State private var showCustom = false
  @State private var customText = ""
  var body: some View {
    let numerals = model.settings.numerals; let key = model.todayKey
    let st = model.content.tasbih
    let pct = st.target > 0 ? Double(st.count) / Double(st.target) : 0
    ScrollView {
      VStack(spacing: 16) {
        VStack(spacing: 14) {
          Text(Tasbih.phraseText(st)).font(.custom(MushafFonts.amiriQuranFont, fixedSize: 24)).multilineTextAlignment(.center).padding(.horizontal)
          Button { tap() } label: {
            ZStack {
              Circle().fill(Theme.primary.opacity(reached ? 0.25 : 0.1))
              Circle().stroke(Color.secondary.opacity(0.15), lineWidth: 10)
              Circle().trim(from: 0, to: reached ? 1 : pct).stroke(Theme.primary, style: StrokeStyle(lineWidth: 10, lineCap: .round)).rotationEffect(.degrees(-90)).animation(.easeOut(duration: 0.2), value: st.count)
              VStack(spacing: 2) { Text(Fmt.number(reached ? st.target : st.count, numerals: numerals)).font(.system(size: 64, weight: .bold, design: .rounded)); Text(st.target > 0 ? "من \(Fmt.number(st.target, numerals: numerals))" : "بلا حدّ").font(.arabic(13)).foregroundStyle(.secondary) }
            }
            .frame(width: 230, height: 230)
          }
          .buttonStyle(.plain).accessibilityLabel("عدّ — \(Tasbih.phraseText(st))")
          Text(st.target > 0 ? "الدورة \(Fmt.number(st.rounds + 1, numerals: numerals))\(st.rounds > 0 ? " · اكتملت \(Fmt.number(st.rounds, numerals: numerals)) \(st.rounds == 1 ? "دورة" : st.rounds == 2 ? "دورتان" : st.rounds <= 10 ? "دورات" : "دورة")" : "")" : "\(Fmt.number(st.count, numerals: numerals)) تسبيحة").font(.arabic(13)).foregroundStyle(.secondary)
          HStack(spacing: 10) {
            Button { model.content.tasbih = Tasbih.undo(st, today: key) } label: { Label("تراجع", systemImage: "arrow.uturn.backward") }.buttonStyle(.bordered)
            Button { model.content.tasbih = Tasbih.reset(st) } label: { Label("تصفير", systemImage: "arrow.counterclockwise") }.buttonStyle(.bordered)
          }
          .font(.arabic(13))
          Text("اليوم \(Fmt.number(Tasbih.todayCount(st, today: key), numerals: numerals)) · الإجمالي \(Fmt.number(Tasbih.totalCount(st), numerals: numerals)) · كل الأذكار \(Fmt.number(Tasbih.grandTotal(st), numerals: numerals))").font(.arabic(11)).foregroundStyle(.tertiary)
        }
        .padding(18).frame(maxWidth: .infinity).background(Theme.cardBackground, in: RoundedRectangle(cornerRadius: 18))
        VStack(alignment: .leading, spacing: 10) {
          Text("الذكر").font(.arabic(12)).foregroundStyle(.secondary)
          ScrollView(.horizontal) {
            HStack(spacing: 8) {
              ForEach(Tasbih.phrases) { p in
                let active = st.phrase == p.id
                Button(p.id == "custom" ? (st.custom.isEmpty ? "ذكر آخر…" : String(st.custom.prefix(22))) : p.text) { if p.id == "custom" { customText = st.custom; showCustom = true } else { var s = st; s.phrase = p.id; s.count = 0; s.rounds = 0; model.content.tasbih = s } }
                  .buttonStyle(.bordered).tint(active ? Theme.primary : .secondary).font(.arabic(13))
              }
            }
          }
          .scrollIndicators(.hidden)
          HStack(spacing: 8) {
            Text("الهدف:").font(.arabic(12)).foregroundStyle(.secondary)
            ForEach(Tasbih.targets, id: \.self) { t in Button(t > 0 ? Fmt.number(t, numerals: numerals) : "بلا حدّ") { var s = st; s.target = t; s.count = 0; s.rounds = 0; model.content.tasbih = s }.buttonStyle(.bordered).tint(st.target == t ? Theme.primary : .secondary).font(.arabic(13)) }
          }
        }
        .padding(14).background(Theme.cardBackground, in: RoundedRectangle(cornerRadius: 16))
        Text("انقر الدائرة للعدّ؛ عند بلوغ الهدف يهتزّ الهاتف وتبدأ دورة جديدة. الإحصاءات تُحفظ على جهازك فقط.").font(.arabic(11)).foregroundStyle(.tertiary).multilineTextAlignment(.center)
      }
      .padding()
    }
    .background(Theme.background)
    .navigationTitle("المسبحة").navigationBarTitleDisplayMode(.inline)
    .alert("ذكر مخصّص", isPresented: $showCustom) {
      TextField("مثال: حسبي الله ونعم الوكيل", text: $customText)
      Button("اعتماد") { let v = customText.trimmingCharacters(in: .whitespaces); guard !v.isEmpty else { return }; var s = model.content.tasbih; s.phrase = "custom"; s.custom = v; s.count = 0; s.rounds = 0; model.content.tasbih = s }
      Button("إلغاء", role: .cancel) {}
    }
  }
  private func tap() {
    let r = Tasbih.tap(model.content.tasbih, today: model.todayKey)
    model.content.tasbih = r.state
    if r.reached { UINotificationFeedbackGenerator().notificationOccurred(.success); reached = true; DispatchQueue.main.asyncAfter(deadline: .now() + 0.65) { reached = false } }
    else { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
  }
}
