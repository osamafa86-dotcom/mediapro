import SwiftUI
import SakinahCore

// MARK: - رصيف الآية المحدّدة: صفّ واحد على سطح الورق يُزيح الصفحة ولا يغطّي سطرًا
/// نقرة على كلمة تحدّد آيتها وتفتح هذا الرصيف: تفسير · استماع · علامة · مشاركة · المزيد (الورقة الكاملة)، و✕.
/// ألوانه من سمة الورق لا من سمة النظام كي يبدو جزءًا من الصفحة لا طبقةً فوقها.
struct AyahDockView: View {
  let ayah: Ayah
  let theme: MushafTheme
  let marked: Bool
  let numerals: String
  var onAction: (AyahAction) -> Void
  var onMore: () -> Void
  var onClose: () -> Void
  var body: some View {
    let ink = Color(hex: theme.ink)
    let brand = MushafPalette.brand(for: theme)
    let gold = MushafPalette.gold(for: theme)
    VStack(spacing: 0) {
      Rectangle().fill(gold.opacity(0.55)).frame(height: 1)
      HStack(spacing: 2) {
        VStack(alignment: .leading, spacing: 1) {
          Text(QuranMeta.surah(ayah.surah).name).font(DS.F.labelSm).foregroundStyle(ink).lineLimit(1).minimumScaleFactor(0.8)
          Text("الآية \(Fmt.number(ayah.ayah, numerals: numerals))").font(DS.F.labelXs).foregroundStyle(ink.opacity(0.62)).lineLimit(1)
        }
        .frame(width: 74, alignment: .leading)
        .padding(.leading, 8)
        .accessibilityElement(children: .combine)
        dockButton("book", "تفسير", brand) { onAction(.tafsir) }
        dockButton("headphones", "استماع", brand) { onAction(.listen) }
        dockButton(marked ? "bookmark.fill" : "bookmark", marked ? "معلَّمة" : "علامة", marked ? gold : brand) { onAction(.bookmark) }
        dockButton("square.and.arrow.up", "مشاركة", brand) { onAction(.share) }
        dockButton("ellipsis.circle", "المزيد", brand, action: onMore)
        Button(action: onClose) {
          Image(systemName: "xmark").font(.system(size: 13, weight: .semibold)).foregroundStyle(ink.opacity(0.7))
            .frame(width: 44, height: 46).contentShape(Rectangle())
        }
        .buttonStyle(.plain).accessibilityLabel("إلغاء تحديد الآية")
      }
      .padding(.horizontal, 4).padding(.vertical, 5)
    }
    .background(MushafPalette.background(for: theme))
    .accessibilityElement(children: .contain)
  }
  private func dockButton(_ icon: String, _ label: String, _ tint: Color, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      VStack(spacing: 3) {
        Image(systemName: icon).font(.system(size: 17, weight: .medium))
        Text(label).font(DS.readex(10, .medium))
      }
      .foregroundStyle(tint)
      .frame(maxWidth: .infinity).frame(height: 46)
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityLabel(label)
  }
}

// MARK: - رصيف التلاوة الجارية: تقدّم صادق، تشغيل، القارئ والكلمة الجارية، سابق/تالي/✕؛ النقر يفتح المشغّل الكامل
struct AudioBarView: View {
  @Environment(AppModel.self) private var model
  var onPickReciter: () -> Void
  var onGoToPage: ((Int) -> Void)? = nil
  var toast: ((String) -> Void)? = nil
  /// داخل القارئ: رصيف على سطح الورق بعرض الشاشة يُزيح الصفحة (بسمة الورق)؛ خارجه: بطاقة عائمة بألوان النظام
  var theme: MushafTheme? = nil
  @State private var expanded = false
  var body: some View {
    let p = model.player; let numerals = model.settings.numerals
    if let a = p.currentAyah {
      let ink = theme.map { Color(hex: $0.ink) } ?? DS.C.textPrimary
      let brand = theme.map { MushafPalette.brand(for: $0) } ?? DS.C.brandPrimary
      let onBrand = theme.map { MushafPalette.onBrand(for: $0) } ?? DS.C.textOnBrand
      let gold = theme.map { MushafPalette.gold(for: $0) } ?? DS.C.brandPrimary
      let track = theme.map { MushafPalette.goldTrack(for: $0) } ?? DS.C.borderSubtle
      VStack(spacing: 0) {
        ProgressTrack(progress: p.duration > 0 ? min(1, p.position / p.duration) : 0, tint: gold, track: track, height: 3)
          .accessibilityHidden(true)
        HStack(spacing: 6) {
          iconButton(p.isPlaying ? "pause.fill" : "play.fill", p.isPlaying ? "إيقاف مؤقت" : "تشغيل", onBrand, fill: brand, size: 44, icon: 17) { p.toggle() }
          Button { expanded = true } label: {
            VStack(alignment: .leading, spacing: 2) {
              Text(p.reciterInfo.name).font(DS.F.labelMd).foregroundStyle(ink).lineLimit(1).minimumScaleFactor(0.85)
              wordLine(a, p, numerals, ink: ink, brand: brand, onBrand: onBrand)
            }
            .contentShape(Rectangle())
          }.buttonStyle(.plain).accessibilityLabel("فتح المشغّل").accessibilityHint("\(p.reciterInfo.name)، \(QuranSearch.refLabel(a))")
          Spacer(minLength: 0)
          iconButton("backward.end.fill", "الآية السابقة", ink, fill: nil, size: 44, icon: 15) { p.prevAyah() }
          iconButton("forward.end.fill", "الآية التالية", ink, fill: nil, size: 44, icon: 15) { p.nextAyah() }
          iconButton("xmark", "إيقاف التلاوة", ink.opacity(0.7), fill: nil, size: 44, icon: 14) { p.stop() }
        }
        .padding(.horizontal, 10).padding(.vertical, theme == nil ? 10 : 7)
      }
      .background {
        if let theme { Rectangle().fill(MushafPalette.background(for: theme)) }
        else { RoundedRectangle(cornerRadius: DS.Radius.xl, style: .continuous).fill(DS.C.bgSurface).shadow(color: DS.C.shadowFloat, radius: 16, y: 8) }
      }
      .padding(.horizontal, theme == nil ? 12 : 0).padding(.bottom, theme == nil ? 6 : 0)
      .sheet(isPresented: $expanded) { PlayerSheet(onPickReciter: onPickReciter, onGoToPage: onGoToPage, toast: toast).environment(model) }
    }
  }
  private func iconButton(_ name: String, _ label: String, _ tint: Color, fill: Color?, size: CGFloat, icon: CGFloat, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Image(systemName: name).font(.system(size: icon, weight: .medium)).foregroundStyle(tint)
        .frame(width: size, height: size)
        .background { if let fill { Circle().fill(fill) } }
        .contentShape(Circle())
    }
    .buttonStyle(.plain).accessibilityLabel(label)
  }
  /// المرجع + الكلمة الجارية مظلّلة إن توفّر التوقيت (ولا صندوق كلمات حين لا توقيت)
  private func wordLine(_ a: Ayah, _ p: RecitationPlayer, _ numerals: String, ink: Color, brand: Color, onBrand: Color) -> some View {
    HStack(spacing: 4) {
      Text("\(QuranSearch.refLabel(a)) · \(Fmt.number(p.index + 1, numerals: numerals))/\(Fmt.number(p.queue.count, numerals: numerals))").font(DS.F.labelXs).foregroundStyle(ink.opacity(0.65)).lineLimit(1)
      if p.loading || p.buffering { Text("· جارٍ التحميل…").font(DS.F.labelXs).foregroundStyle(ink.opacity(0.5)) }
      else if let w = p.currentWord, p.hasWords { let words = a.text.split(separator: " "); if w >= 1 && w <= words.count { Text(String(words[w - 1])).font(.custom(MushafFonts.amiriQuranFont, fixedSize: 13)).foregroundStyle(onBrand).padding(.horizontal, 6).padding(.vertical, 1).background(brand, in: RoundedRectangle(cornerRadius: 6)) } }
    }
  }
}

// MARK: - المشغّل الكامل: ميدالية أصغر، الآية (كلمةً بكلمة فقط حين تتوفّر التوقيتات)، شريط تقدّم صادق يُسحب، تحكّم، شرائح (أ–ب، السرعة، النوم، القارئ، تنزيل السورة، الصفحة)
struct PlayerSheet: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  var onPickReciter: () -> Void
  var onGoToPage: ((Int) -> Void)? = nil
  var toast: ((String) -> Void)? = nil
  @State private var showDownloads = false
  @State private var showReciters = false
  /// الموضع أثناء سحب شريط التقدّم (nil حين لا يُسحب)
  @State private var scrubbing: Double?

  var body: some View {
    let p = model.player; let q = model.quran; let numerals = model.settings.numerals
    ZStack {
      LinearGradient(colors: [DS.C.nightTop, Color(hex: 0x061716)], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
      VStack(spacing: 14) {
        HStack {
          DSIconButton(systemName: "chevron.down", style: .glass, size: 40, iconSize: 16, label: "إغلاق") { dismiss() }
          Spacer()
          Text("التلاوة الآن").font(DS.F.labelMd).foregroundStyle(DS.C.textOnDarkMuted)
          Spacer()
          DSIconButton(systemName: "arrow.down.circle", style: .glass, size: 40, iconSize: 18, label: "التنزيلات") { showDownloads = true }
        }
        Spacer(minLength: 0)
        reciterBlock(p, numerals)
        Spacer(minLength: 0)
        if let a = p.currentAyah { ayahBox(a, p, numerals) }
        progressBar(p, numerals)
        controls(p, q, numerals)
        chips(p, q, numerals)
        Spacer(minLength: 8)
      }
      .padding(.horizontal, 20).padding(.top, 12)
    }
    .presentationDragIndicator(.hidden)
    .sheet(isPresented: $showDownloads) { DownloadsView(focusSurah: p.currentAyah?.surah).environment(model).environment(\.tabBarInset, 0) }
    .sheet(isPresented: $showReciters) { ReciterPickerSheet().environment(model) }
  }

  private func reciterBlock(_ p: RecitationPlayer, _ numerals: String) -> some View {
    VStack(spacing: 8) {
      ZStack {
        Circle().stroke(DS.C.accentGold.opacity(0.8), lineWidth: 2).frame(width: 96, height: 96)
        Circle().fill(Color.white.opacity(0.12)).frame(width: 80, height: 80)
        Text(String(p.reciterInfo.name.prefix(1))).font(DS.kufi(30, .bold)).foregroundStyle(DS.C.accentGold)
      }
      .accessibilityHidden(true)
      Button { showReciters = true } label: {
        HStack(spacing: 6) { Text(p.reciterInfo.name).font(DS.F.displaySm).foregroundStyle(DS.C.textOnDark).multilineTextAlignment(.center); Image(systemName: "chevron.down").font(.system(size: 11, weight: .semibold)).foregroundStyle(DS.C.textOnDarkMuted) }
      }.buttonStyle(.plain).accessibilityLabel("القارئ \(p.reciterInfo.name)").accessibilityHint("تغيير القارئ")
      if let a = p.currentAyah {
        Text("سورة \(QuranMeta.surah(a.surah).name) · الآية \(Fmt.number(a.ayah, numerals: numerals)) من \(Fmt.number(QuranMeta.surah(a.surah).ayahs, numerals: numerals))\(rangeLabel(p, numerals))\(p.hasWords ? "" : " · بلا توقيت كلمات")").font(DS.F.labelSm).foregroundStyle(DS.C.textOnDarkMuted).multilineTextAlignment(.center)
      }
    }
  }
  private func rangeLabel(_ p: RecitationPlayer, _ numerals: String) -> String {
    guard let a = p.rangeA, let b = p.rangeB, a < p.queue.count, b < p.queue.count, let x = QuranText.shared.ayah(p.queue[a]), let y = QuranText.shared.ayah(p.queue[b]) else { return "" }
    return " · تكرار أ–ب \(Fmt.number(x.ayah, numerals: numerals))–\(Fmt.number(y.ayah, numerals: numerals))"
  }

  /// نصّ الآية: صندوق كلمة بكلمة فقط حين تتوفّر التوقيتات (الكلمة الجارية تتلوّن ولا تقفز: حشوة ثابتة)، وإلا الآية نصًّا
  private func ayahBox(_ a: Ayah, _ p: RecitationPlayer, _ numerals: String) -> some View {
    let words = a.text.split(separator: " ").map(String.init)
    let cur = (p.hasWords ? p.currentWord : nil).map { $0 - 1 }
    return Group {
      if p.hasWords {
        FlowLayout(spacing: 6, lineHeight: 36, justify: false) {
          ForEach(Array(words.enumerated()), id: \.offset) { i, w in
            Text(w).font(.custom(MushafFonts.amiriQuranFont, fixedSize: 21))
              .foregroundStyle(cur == i ? Color(hex: 0x16211F) : DS.C.textOnDark)
              .padding(.horizontal, 5).padding(.vertical, 2)
              .background(cur == i ? DS.C.accentGold : Color.clear, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
          }
          Text("﴿\(Fmt.number(a.ayah, numerals: numerals))﴾").font(.custom(MushafFonts.amiriQuranFont, fixedSize: 21)).foregroundStyle(DS.C.accentGold).padding(.horizontal, 5)
        }
        .environment(\.layoutDirection, .leftToRight)
        .frame(maxWidth: .infinity)
        .padding(14)
        .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: DS.Radius.xl, style: .continuous))
        .animation(.easeInOut(duration: 0.12), value: p.currentWord)
      } else {
        Text(a.text + " ﴿\(Fmt.number(a.ayah, numerals: numerals))﴾").font(.custom(MushafFonts.amiriQuranFont, fixedSize: 20)).lineSpacing(10).multilineTextAlignment(.center).foregroundStyle(DS.C.textOnDark)
          .frame(maxWidth: .infinity).lineLimit(4).minimumScaleFactor(0.75)
      }
    }
    .accessibilityElement(children: .ignore).accessibilityLabel("الآية الجارية").accessibilityValue(a.text)
  }

  /// شريط تقدّم صادق يملأ من اليمين (اتجاه القراءة) ويُسحب للانتقال داخل الآية؛ يُرسم في فضاء من اليسار إلى اليمين كي لا يلتبس اتجاه اللمسة
  private func progressBar(_ p: RecitationPlayer, _ numerals: String) -> some View {
    let frac = p.duration > 0 ? min(1, max(0, (scrubbing ?? p.position) / p.duration)) : 0
    return VStack(spacing: 6) {
      GeometryReader { g in
        let w = g.size.width
        let fill = max(4, w * frac)
        ZStack(alignment: .leading) {
          Capsule().fill(Color.white.opacity(0.18)).frame(width: w, height: 4)
          Capsule().fill(DS.C.accentGold).frame(width: fill, height: 4).offset(x: w - fill)
          Circle().fill(DS.C.accentGold).frame(width: 14, height: 14).offset(x: min(max(w - fill - 7, 0), w - 14)).shadow(color: .black.opacity(0.3), radius: 4)
        }
        .frame(width: w, height: 24, alignment: .leading)
        .contentShape(Rectangle())
        .gesture(
          DragGesture(minimumDistance: 0)
            .onChanged { v in guard p.duration > 0 else { return }; scrubbing = (1 - min(max(v.location.x / w, 0), 1)) * p.duration }
            .onEnded { v in guard p.duration > 0 else { return }; let t = (1 - min(max(v.location.x / w, 0), 1)) * p.duration; scrubbing = nil; p.seek(to: t) }
        )
      }
      .frame(height: 24)
      .environment(\.layoutDirection, .leftToRight)
      .accessibilityElement()
      .accessibilityLabel("موضع التلاوة")
      .accessibilityValue("\(time(scrubbing ?? p.position, numerals)) من \(time(p.duration, numerals))")
      .accessibilityAdjustableAction { d in p.seek(to: p.position + (d == .increment ? 5 : -5)) }
      HStack { Text(time(scrubbing ?? p.position, numerals)).font(DS.F.numericSm).foregroundStyle(DS.C.textOnDarkMuted); Spacer(); Text(time(p.duration, numerals)).font(DS.F.numericSm).foregroundStyle(DS.C.textOnDarkMuted) }
        .accessibilityHidden(true)
    }
  }
  private func time(_ t: Double, _ numerals: String) -> String { let s = max(0, Int(t)); return "\(Fmt.number(s / 60, numerals: numerals)):\(s % 60 < 10 ? Fmt.number(0, numerals: numerals) : "")\(Fmt.number(s % 60, numerals: numerals))" }

  private func controls(_ p: RecitationPlayer, _ q: QuranPrefs, _ numerals: String) -> some View {
    HStack(spacing: 18) {
      ZStack(alignment: .topTrailing) {
        DSIconButton(systemName: "repeat", style: .glass, size: 44, iconSize: 18, label: "تكرار الآية") { let o = [1, 2, 3, 5, 10]; let nx = o[((o.firstIndex(of: p.repeatAyah) ?? 0) + 1) % o.count]; p.repeatAyah = nx; q.repeatAyah = nx }
        if p.repeatAyah > 1 { DSBadge(text: "×\(Fmt.number(p.repeatAyah, numerals: numerals))", fg: Color(hex: 0x16211F), bg: DS.C.accentGold).offset(x: 6, y: -6) }
      }
      DSIconButton(systemName: "forward.end.fill", style: .glass, size: 52, iconSize: 22, label: "الآية التالية") { p.nextAyah() }
      Button { p.toggle() } label: {
        Image(systemName: p.isPlaying ? "pause.fill" : "play.fill").font(.system(size: 30, weight: .bold)).foregroundStyle(Color(hex: 0x16211F))
          .frame(width: 76, height: 76).background(DS.C.accentGold, in: Circle()).shadow(color: DS.C.accentGold.opacity(0.35), radius: 16)
      }.buttonStyle(.plain).accessibilityLabel(p.isPlaying ? "إيقاف مؤقت" : "تشغيل")
      DSIconButton(systemName: "backward.end.fill", style: .glass, size: 52, iconSize: 22, label: "الآية السابقة") { p.prevAyah() }
      DSIconButton(systemName: "moon.zzz", style: .glass, size: 44, iconSize: 18, label: "مؤقت النوم") { let o = [0, 15, 30, 45, 60]; let cur = p.sleepMinutesLeft ?? 0; let nx = o[((o.firstIndex { $0 >= cur } ?? 0) + 1) % o.count]; p.setSleep(minutes: nx); toast?(nx > 0 ? "ستتوقف التلاوة بعد \(Fmt.number(nx, numerals: numerals)) دقيقة" : "أُلغي مؤقت النوم") }
    }
    .frame(maxWidth: .infinity)
  }

  private func chips(_ p: RecitationPlayer, _ q: QuranPrefs, _ numerals: String) -> some View {
    let ab: String = p.hasRange ? "أ–ب ✓" : (p.rangeA != nil ? "أ ✓ — اختر ب" : "تكرار أ–ب")
    return ScrollView(.horizontal, showsIndicators: false) {
      HStack(spacing: 8) {
        glassChip(ab, "repeat.1", on: p.rangeA != nil) {
          if p.hasRange { p.clearRange(); toast?("أُلغي تكرار أ–ب") }
          else if let a = p.rangeA { p.setRange(a: a, b: p.index); toast?("سيُكرَّر المقطع من أ إلى ب") }
          else { p.setRange(a: p.index, b: nil); toast?("حُدّدت البداية (أ) — انتقل إلى آية النهاية ثم اضغط مرة أخرى") }
        }
        glassChip("السرعة \(Fmt.decimal(p.rate, digits: 2, numerals: numerals))×", "speedometer", on: p.rate != 1) { let o = [0.75, 1, 1.25, 1.5]; let nx = o[((o.firstIndex(of: p.rate) ?? 1) + 1) % o.count]; p.setRate(nx); q.rate = nx }
        glassChip("تكرار القائمة", "repeat", on: p.repeatRange) { p.setRepeatRange(!p.repeatRange); q.repeatRange = p.repeatRange }
        glassChip(p.sleepMinutesLeft.map { "نوم \(Fmt.number($0, numerals: numerals)) د" } ?? "مؤقت النوم", "moon", on: p.sleepAt != nil) { let o = [0, 15, 30, 45, 60]; let cur = p.sleepMinutesLeft ?? 0; let nx = o[((o.firstIndex { $0 >= cur } ?? 0) + 1) % o.count]; p.setSleep(minutes: nx) }
        glassChip("القارئ", "mic", on: false) { showReciters = true }
        glassChip("تنزيل السورة", "arrow.down.circle", on: false) { showDownloads = true }
        if let a = p.currentAyah, let go = onGoToPage { glassChip("الانتقال إلى ص \(Fmt.number(a.page, numerals: numerals))", "arrow.turn.down.left", on: false) { dismiss(); go(a.page) } }
      }
    }
  }
  private func glassChip(_ label: String, _ icon: String, on: Bool, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      HStack(spacing: 6) { Image(systemName: icon).font(.system(size: 11, weight: .semibold)); Text(label).font(DS.F.labelSm) }
        .foregroundStyle(on ? Color(hex: 0x16211F) : DS.C.textOnDark)
        .padding(.vertical, 8).padding(.horizontal, 12)
        .background(on ? DS.C.accentGold : Color.white.opacity(0.12), in: Capsule())
    }.buttonStyle(.plain).accessibilityAddTraits(on ? .isSelected : [])
  }
}

// MARK: - ورقة الآية (ضغطة مطوّلة أو «المزيد»): نصّ الآية كاملًا من المتن، ستّ بلاطات، وشريحة «نسخ»
/// ما في الرصيف (تفسير، استماع، علامة، مشاركة) لا يتكرّر هنا إلا التفسير لأنه الأكثر طلبًا؛
/// وموضع القراءة لم يعد إجراءً: يُحفظ تلقائيًا مع التقليب.
struct AyahOptionsSheet: View {
  @Environment(AppModel.self) private var model
  let ayah: Ayah
  var onAction: (AyahAction) -> Void
  var body: some View {
    let numerals = model.settings.numerals
    let l = QuranText.shared.label(ofPage: ayah.page)
    let marked = model.quran.isBookmarked(ayah)
    let weak = model.quran.weakAyahs.contains(ayah.n)
    ScrollView(showsIndicators: false) {
      VStack(spacing: 12) {
        HStack(alignment: .center) {
          VStack(alignment: .leading, spacing: 0) {
            Text(QuranSearch.refLabel(ayah)).font(DS.F.headingMd).foregroundStyle(DS.C.textPrimary)
            Text("الصفحة \(Fmt.number(ayah.page, numerals: numerals))\(l.map { " · الجزء \(Fmt.number($0.juz, numerals: numerals))" } ?? "")\(marked ? " · معلَّمة" : "")\(weak ? " · آية ضعيفة" : "")").font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary)
          }
          Spacer()
          // زرّ «علامة» في الرصيف يحفظ بنقرة واحدة؛ الملاحظة واللون من هنا (أو من «تعديل» في المكتبة)
          Button { onAction(.bookmarkNote) } label: {
            HStack(spacing: 6) { Image(systemName: marked ? "bookmark.fill" : "bookmark").font(.system(size: 12, weight: .semibold)); Text("ملاحظة").font(DS.F.labelSm) }
              .foregroundStyle(marked ? DS.C.accentGoldStrong : DS.C.brandPrimary).padding(.vertical, 8).padding(.horizontal, 12).background(marked ? DS.C.accentGold.opacity(0.18) : DS.C.brandSoft, in: Capsule())
          }.buttonStyle(.plain).accessibilityLabel(marked ? "ملاحظة العلامة ولونها" : "علامة بملاحظة ولون")
          Button { onAction(.copy) } label: {
            HStack(spacing: 6) { Image(systemName: "doc.on.doc").font(.system(size: 12, weight: .semibold)); Text("نسخ").font(DS.F.labelSm) }
              .foregroundStyle(DS.C.brandPrimary).padding(.vertical, 8).padding(.horizontal, 12).background(DS.C.brandSoft, in: Capsule())
          }.buttonStyle(.plain).accessibilityLabel("نسخ نصّ الآية مع المرجع")
        }
        Text(ayah.text + " ﴿\(Fmt.number(ayah.ayah, numerals: numerals))﴾").font(.custom(MushafFonts.amiriQuranFont, fixedSize: 20)).lineSpacing(10).multilineTextAlignment(.center).foregroundStyle(DS.C.paperInk)
          .frame(maxWidth: .infinity).padding(.vertical, 12).padding(.horizontal, 16)
          .background(DS.C.paperPage, in: RoundedRectangle(cornerRadius: DS.Radius.lg, style: .continuous))
          .overlay { RoundedRectangle(cornerRadius: DS.Radius.lg, style: .continuous).stroke(DS.C.borderSubtle, lineWidth: 1) }
          .accessibilityLabel("نصّ الآية")
        HStack(spacing: 10) { action("book", "التفسير الميسّر", "مضمّن") { onAction(.tafsir) }; action("globe", "الترجمة", "quran.com") { onAction(.translation) } }
        HStack(spacing: 10) { action("character.book.closed", "معاني الكلمات", "كلمةً كلمة") { onAction(.wordMeanings) }; action("repeat", "تكرار الآية ×٣", "للحفظ") { onAction(.repeat3) } }
        HStack(spacing: 10) { action("mic", "مراجعة الحفظ", "من هنا", tone: .gold) { onAction(.hifz) }; action("photo", "مشاركة صورةً", "٤ سمات") { onAction(.shareImage) } }
        Text("موضع القراءة يُحفظ تلقائيًا مع التقليب · العلامة والمشاركة من رصيف الآية").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).multilineTextAlignment(.center).frame(maxWidth: .infinity)
      }
      .padding(.horizontal, 20).padding(.top, 16).padding(.bottom, 24)
    }
    .background(DS.C.bgSurface)
    .presentationDragIndicator(.visible)
  }
  private enum Tone { case teal, gold }
  private func action(_ icon: String, _ title: String, _ sub: String, tone: Tone = .teal, act: @escaping () -> Void) -> some View {
    Button(action: act) {
      HStack(spacing: 10) {
        DSIcon(systemName: icon, style: tone == .gold ? .gold : .soft, size: 40, iconSize: 17)
        VStack(alignment: .leading, spacing: 1) { Text(title).font(DS.F.labelMd).foregroundStyle(DS.C.textPrimary).lineLimit(1); if !sub.isEmpty { Text(sub).font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).lineLimit(1) } }
        Spacer(minLength: 0)
      }
      .padding(.vertical, 10).padding(.horizontal, 12)
      .frame(minHeight: 60)
      .background(DS.C.bgSubtle, in: RoundedRectangle(cornerRadius: DS.Radius.lg, style: .continuous))
      .contentShape(Rectangle())
    }.buttonStyle(.plain)
  }
}

// MARK: - لوحة مراجعة الحفظ / الإخفاء: صفّ واحد على سطح الورق يُزيح الصفحة
/// ميكروفون بهالة تنبض بالصوت، حالة وسطر إفصاح («على الجهاز» أو عبر الخادم)، ثم «كلمة» و«آية» و«ضعيفة» و✕.
/// الكلمات المستورة لا تُرسم أصلًا (لا شفافية تسرّبها)؛ ورؤوس الآي وعلامات الأرباع تبقى ظاهرة.
struct HifzPanelView: View {
  @Environment(AppModel.self) private var model
  let session: HifzSession
  var theme: MushafTheme? = nil
  var onExit: () -> Void
  var onNextPage: () -> Void
  var body: some View {
    let numerals = model.settings.numerals
    let total = QuranText.shared.pageAyahs(session.page).count
    let ink = theme.map { Color(hex: $0.ink) } ?? DS.C.textPrimary
    let brand = theme.map { MushafPalette.brand(for: $0) } ?? DS.C.brandPrimary
    let onBrand = theme.map { MushafPalette.onBrand(for: $0) } ?? DS.C.textOnBrand
    let gold = theme.map { MushafPalette.gold(for: $0) } ?? DS.C.accentGold
    let track = theme.map { MushafPalette.goldTrack(for: $0) } ?? DS.C.bgSubtle
    let cur = session.currentWord?.n ?? session.lastRevealed?.n
    let weak = cur.map { model.quran.weakAyahs.contains($0) } ?? false
    VStack(spacing: 0) {
      ProgressTrack(progress: session.progress, tint: gold, track: track, height: 3)
        .accessibilityLabel("تقدّم المراجعة").accessibilityValue("\(Int(session.progress * 100))٪")
      HStack(spacing: 6) {
        if session.veil {
          pill("eye", "آية", brand) { session.revealAyah() }
        } else {
          Button { session.toggleSpeech() } label: {
            ZStack {
              if session.listening {
                Circle().fill(brand.opacity(0.22))
                  .frame(width: 40 + CGFloat(session.level) * 18, height: 40 + CGFloat(session.level) * 18)
                  .animation(.easeOut(duration: 0.12), value: session.level)
              }
              Circle().fill(session.listening ? DS.C.danger : brand).frame(width: 40, height: 40)
              Image(systemName: session.listening ? "stop.fill" : "mic.fill").font(.system(size: 16, weight: .semibold)).foregroundStyle(session.listening ? .white : onBrand)
            }
            .frame(width: 48, height: 48).contentShape(Circle())
          }.buttonStyle(.plain).disabled(!session.speechSupported).accessibilityLabel(session.listening ? "إيقاف التسميع" : "ابدأ التسميع")
        }
        VStack(alignment: .leading, spacing: 2) {
          Group {
            if session.done { Text("✓ أحسنت، أتممت الصفحة").foregroundStyle(DS.C.success) }
            else if session.veil { Text("مخفيّة · \(Fmt.number(min(session.revealedAyahs, total), numerals: numerals)) من \(Fmt.number(total, numerals: numerals)) آية").foregroundStyle(ink) }
            else if session.listening { Text("يستمع… \(Fmt.number(session.pos, numerals: numerals)) من \(Fmt.number(session.words.count, numerals: numerals)) كلمة").foregroundStyle(brand) }
            else if let w = session.lastRevealed { HStack(spacing: 5) { Text("آخر كلمة").foregroundStyle(ink.opacity(0.6)); Text(w.raw).font(.custom(MushafFonts.amiriQuranFont, fixedSize: 17)).foregroundStyle(ink) } }
            else { Text(session.speechSupported ? "اضغط الميكروفون أو انقر الصفحة" : "انقر الصفحة لكشف الكلمة التالية").foregroundStyle(ink) }
          }
          .font(DS.F.labelSm).lineLimit(1).minimumScaleFactor(0.85)
          Text(subline).font(DS.F.labelXs).foregroundStyle(ink.opacity(0.55)).lineLimit(1).minimumScaleFactor(0.8)
        }
        Spacer(minLength: 0)
        if session.done {
          Button(action: onNextPage) {
            HStack(spacing: 6) { Text("الصفحة التالية").font(DS.F.labelSm); Image(systemName: "chevron.forward").font(.system(size: 11, weight: .bold)) }
              .foregroundStyle(onBrand).padding(.vertical, 10).padding(.horizontal, 14).background(brand, in: Capsule())
          }.buttonStyle(.plain)
        } else if session.veil {
          pill("eye.fill", "الكل", brand) { session.revealAll() }
        } else {
          pill("character.cursor.ibeam", "كلمة", brand) { session.hint() }
          pill("text.line.first.and.arrowtriangle.forward", "آية", brand) { session.revealAyah() }
          pill(weak ? "exclamationmark.triangle.fill" : "exclamationmark.triangle", "ضعيفة", weak ? gold : brand, on: weak) { if let n = cur { model.quran.toggleWeak(n) } }
            .accessibilityLabel(weak ? "إزالة وسم الآية الضعيفة" : "وسم الآية الحالية آيةً ضعيفة للمراجعة")
        }
        Button(action: onExit) {
          Image(systemName: "xmark").font(.system(size: 13, weight: .semibold)).foregroundStyle(ink.opacity(0.7)).frame(width: 44, height: 46).contentShape(Rectangle())
        }.buttonStyle(.plain).accessibilityLabel("إنهاء المراجعة")
      }
      .padding(.horizontal, 6).padding(.vertical, 5)
    }
    .background {
      if let theme { Rectangle().fill(MushafPalette.background(for: theme)) }
      else { Rectangle().fill(DS.C.bgSurface) }
    }
    .overlay(alignment: .top) { Rectangle().fill(gold.opacity(0.55)).frame(height: 1) }
    .accessibilityElement(children: .contain)
  }
  /// السطر الثاني: ما سُمع، أو الإفصاح عن مكان معالجة الصوت، أو عدد التلميحات
  private var subline: String {
    if session.veil { return "انقر الصفحة لكشف الآية التالية" }
    if !session.heard.isEmpty { return "سمعتُ: \(session.heard)" }
    if !session.speechSupported { return "التعرّف على الكلام غير متاح على هذا الجهاز" }
    if session.hints > 0 { return "\(session.hints) تلميحات · " + (SpeechListener.onDeviceAvailable ? "التعرّف على الجهاز" : "التعرّف عبر خادم آبل") }
    return SpeechListener.onDeviceAvailable ? "التعرّف على الصوت يجري على الجهاز ولا يغادر هاتفك" : "التعرّف عبر خادم آبل — يُرسل الصوت أثناء التسميع فقط"
  }
  private func pill(_ icon: String, _ label: String, _ tint: Color, on: Bool = false, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      VStack(spacing: 3) {
        Image(systemName: icon).font(.system(size: 15, weight: .medium))
        Text(label).font(DS.readex(9.5, .medium))
      }
      .foregroundStyle(tint)
      .frame(width: 46, height: 46)
      .background { if on { RoundedRectangle(cornerRadius: 10, style: .continuous).fill(tint.opacity(0.14)) } }
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityLabel(label)
  }
}
