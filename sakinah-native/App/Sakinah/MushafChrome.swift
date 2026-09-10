import SwiftUI
import SakinahCore

// MARK: - شريط التلاوة المصغّر (تصميم 03): تقدّم رفيع، زر تشغيل، القارئ والكلمة الجارية، سابق/تالي/إغلاق؛ النقر يفتح المشغّل الكامل
struct AudioBarView: View {
  @Environment(AppModel.self) private var model
  var onPickReciter: () -> Void
  var onGoToPage: ((Int) -> Void)? = nil
  var toast: ((String) -> Void)? = nil
  @State private var expanded = false
  var body: some View {
    let p = model.player; let numerals = model.settings.numerals
    if let a = p.currentAyah {
      VStack(spacing: 0) {
        ProgressTrack(progress: p.duration > 0 ? min(1, p.position / p.duration) : 0, tint: DS.C.brandPrimary, track: DS.C.borderSubtle, height: 3)
        HStack(spacing: 8) {
          DSIconButton(systemName: p.isPlaying ? "pause.fill" : "play.fill", style: .brand, size: 44, iconSize: 18, label: p.isPlaying ? "إيقاف مؤقت" : "تشغيل") { p.toggle() }
          Button { expanded = true } label: {
            VStack(alignment: .leading, spacing: 2) {
              Text(p.reciterInfo.name).font(DS.F.labelMd).foregroundStyle(DS.C.textPrimary).lineLimit(1)
              wordLine(a, p, numerals)
            }
            .contentShape(Rectangle())
          }.buttonStyle(.plain).accessibilityLabel("فتح المشغّل")
          Spacer(minLength: 0)
          DSIconButton(systemName: "backward.end.fill", style: .plain, size: 36, iconSize: 15, label: "الآية السابقة") { p.prevAyah() }
          DSIconButton(systemName: "forward.end.fill", style: .plain, size: 36, iconSize: 15, label: "الآية التالية") { p.nextAyah() }
          DSIconButton(systemName: "xmark", style: .plain, size: 36, iconSize: 14, label: "إغلاق التلاوة") { p.stop() }
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
      }
      .background(DS.C.bgSurface, in: RoundedRectangle(cornerRadius: DS.Radius.xl, style: .continuous))
      .shadow(color: DS.C.shadowFloat, radius: 16, y: 8)
      .sheet(isPresented: $expanded) { PlayerSheet(onPickReciter: onPickReciter, onGoToPage: onGoToPage, toast: toast).environment(model) }
    }
  }
  /// المرجع + الكلمة الجارية مظلّلة إن توفّر التوقيت
  private func wordLine(_ a: Ayah, _ p: RecitationPlayer, _ numerals: String) -> some View {
    HStack(spacing: 4) {
      Text("\(QuranSearch.refLabel(a)) · \(Fmt.number(p.index + 1, numerals: numerals))/\(Fmt.number(p.queue.count, numerals: numerals))").font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary).lineLimit(1)
      if p.loading || p.buffering { Text("· جارٍ التحميل…").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary) }
      else if let w = p.currentWord, p.hasWords { let words = a.text.split(separator: " "); if w >= 1 && w <= words.count { Text(String(words[w - 1])).font(.custom(MushafFonts.amiriQuranFont, fixedSize: 13)).foregroundStyle(DS.C.textOnBrand).padding(.horizontal, 6).padding(.vertical, 1).background(DS.C.brandPrimary, in: RoundedRectangle(cornerRadius: 6)) } }
    }
  }
}

// MARK: - المشغّل الكامل (تصميم 05): خلفية الليل، القارئ، الآية بكلمتها الجارية، شريط موجة، أزرار التحكّم، شرائح الخيارات
struct PlayerSheet: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  var onPickReciter: () -> Void
  var onGoToPage: ((Int) -> Void)? = nil
  var toast: ((String) -> Void)? = nil
  @State private var showDownloads = false
  @State private var showReciters = false
  private let bars: [CGFloat] = [8, 14, 22, 30, 18, 26, 34, 20, 12, 28, 36, 24, 16, 30, 22, 14, 26, 32, 18, 10, 24, 34, 28, 16, 20, 30, 12, 22, 26, 18, 32, 24, 14, 28, 20, 10, 16, 24, 30, 18]

  var body: some View {
    let p = model.player; let q = model.quran; let numerals = model.settings.numerals
    ZStack {
      LinearGradient(colors: [DS.C.nightTop, Color(hex: 0x061716)], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
      VStack(spacing: 16) {
        HStack {
          DSIconButton(systemName: "chevron.down", style: .glass, size: 40, iconSize: 16, label: "إغلاق") { dismiss() }
          Spacer()
          Text("التلاوة الآن").font(DS.F.labelMd).foregroundStyle(DS.C.textOnDarkMuted)
          Spacer()
          DSIconButton(systemName: "arrow.down.circle", style: .glass, size: 40, iconSize: 18, label: "التنزيلات") { showDownloads = true }
        }
        Spacer(minLength: 0)
        reciterBlock(p)
        Spacer(minLength: 0)
        if let a = p.currentAyah { ayahBox(a, p, numerals) }
        waveform(p, numerals)
        controls(p, q, numerals)
        chips(p, q, numerals)
        Spacer(minLength: 8)
      }
      .padding(.horizontal, 20).padding(.top, 12)
    }
    .presentationDragIndicator(.hidden)
    .sheet(isPresented: $showDownloads) { DownloadsView(focusSurah: p.currentAyah?.surah).environment(model) }
    .sheet(isPresented: $showReciters) { ReciterPickerSheet().environment(model) }
  }

  private func reciterBlock(_ p: RecitationPlayer) -> some View {
    let numerals = model.settings.numerals
    return VStack(spacing: 8) {
      ZStack {
        Circle().stroke(DS.C.accentGold.opacity(0.8), lineWidth: 2).frame(width: 132, height: 132)
        Circle().fill(Color.white.opacity(0.12)).frame(width: 112, height: 112)
        Text(String(p.reciterInfo.name.prefix(1))).font(DS.kufi(40, .bold)).foregroundStyle(DS.C.accentGold)
      }
      Button { showReciters = true } label: { Text(p.reciterInfo.name).font(DS.F.displayMd).foregroundStyle(DS.C.textOnDark).multilineTextAlignment(.center) }.buttonStyle(.plain)
      if let a = p.currentAyah {
        Text("سورة \(QuranMeta.surah(a.surah).name) · الآية \(Fmt.number(a.ayah, numerals: numerals)) من \(Fmt.number(QuranMeta.surah(a.surah).ayahs, numerals: numerals))\(p.hasWords ? " · كلمة بكلمة" : "")").font(DS.F.labelSm).foregroundStyle(DS.C.textOnDarkMuted)
      }
    }
  }

  private func ayahBox(_ a: Ayah, _ p: RecitationPlayer, _ numerals: String) -> some View {
    let words = a.text.split(separator: " ").map(String.init)
    let cur = (p.hasWords ? p.currentWord : nil).map { $0 - 1 }
    return VStack(spacing: 8) {
      FlowLayout(spacing: 8, lineHeight: 36, justify: false) {
        ForEach(Array(words.enumerated()), id: \.offset) { i, w in
          Text(w).font(.custom(MushafFonts.amiriQuranFont, fixedSize: 21))
            .foregroundStyle(cur == i ? Color(hex: 0x16211F) : DS.C.textOnDark)
            .padding(.horizontal, cur == i ? 8 : 0).padding(.vertical, 2)
            .background(cur == i ? DS.C.accentGold : .clear, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        Text("﴿\(Fmt.number(a.ayah, numerals: numerals))﴾").font(.custom(MushafFonts.amiriQuranFont, fixedSize: 21)).foregroundStyle(DS.C.accentGold)
      }
      .frame(maxWidth: .infinity)
      Text(p.hasWords ? "تظليل الكلمة بتوقيتات quran.com" : "اختر قارئًا يدعم «كلمة بكلمة» لتظليل الكلمة الجارية").font(DS.F.labelXs).foregroundStyle(DS.C.textOnDarkMuted)
    }
    .padding(16)
    .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: DS.Radius.xl, style: .continuous))
    .animation(.easeInOut(duration: 0.15), value: p.currentWord)
  }

  private func waveform(_ p: RecitationPlayer, _ numerals: String) -> some View {
    let frac = p.duration > 0 ? min(1, p.position / p.duration) : 0
    return VStack(spacing: 6) {
      HStack(spacing: 4) {
        ForEach(Array(bars.enumerated()), id: \.offset) { i, h in
          let played = Double(i) / Double(bars.count) < frac
          Capsule().fill(played ? DS.C.accentGold : Color.white.opacity(0.35)).frame(width: 4, height: h)
        }
      }
      .frame(maxWidth: .infinity, alignment: .center).frame(height: 40)
      HStack { Text(time(p.position, numerals)).font(DS.F.labelXs).foregroundStyle(DS.C.textOnDarkMuted); Spacer(); Text(time(p.duration, numerals)).font(DS.F.labelXs).foregroundStyle(DS.C.textOnDarkMuted) }
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
    ScrollView(.horizontal, showsIndicators: false) {
      HStack(spacing: 8) {
        glassChip("السرعة \(Fmt.decimal(p.rate, digits: 2, numerals: numerals))×", "speedometer", on: p.rate != 1) { let o = [0.75, 1, 1.25, 1.5]; let nx = o[((o.firstIndex(of: p.rate) ?? 1) + 1) % o.count]; p.setRate(nx); q.rate = nx }
        glassChip("تكرار المقطع", "repeat.1", on: p.repeatRange) { p.repeatRange.toggle(); q.repeatRange = p.repeatRange }
        glassChip(p.sleepMinutesLeft.map { "نوم \(Fmt.number($0, numerals: numerals)) د" } ?? "مؤقت النوم", "moon", on: p.sleepAt != nil) { let o = [0, 15, 30, 45, 60]; let cur = p.sleepMinutesLeft ?? 0; let nx = o[((o.firstIndex { $0 >= cur } ?? 0) + 1) % o.count]; p.setSleep(minutes: nx) }
        glassChip("القارئ", "mic", on: false) { showReciters = true }
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
    }.buttonStyle(.plain)
  }
}

// MARK: - قائمة الآية (تصميم 04): معاينة الآية على ورق، وشبكة إجراءات بأقراص أيقونات
struct AyahOptionsSheet: View {
  @Environment(AppModel.self) private var model
  let ayah: Ayah
  var onAction: (AyahAction) -> Void
  var body: some View {
    let marked = model.quran.isBookmarked(ayah); let numerals = model.settings.numerals
    let l = QuranText.shared.label(ofPage: ayah.page)
    ScrollView(showsIndicators: false) {
      VStack(spacing: 12) {
        HStack {
          VStack(alignment: .leading, spacing: 0) {
            Text(QuranSearch.refLabel(ayah)).font(DS.F.headingMd).foregroundStyle(DS.C.textPrimary)
            Text("الصفحة \(Fmt.number(ayah.page, numerals: numerals))\(l.map { " · الجزء \(Fmt.number($0.juz, numerals: numerals))" } ?? "")").font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary)
          }
          Spacer()
        }
        Text(ayah.text + " ﴿\(Fmt.number(ayah.ayah, numerals: numerals))﴾").font(.custom(MushafFonts.amiriQuranFont, fixedSize: 20)).lineSpacing(10).multilineTextAlignment(.center).foregroundStyle(DS.C.paperInk)
          .frame(maxWidth: .infinity).padding(.vertical, 10).padding(.horizontal, 16)
          .background(DS.C.paperPage, in: RoundedRectangle(cornerRadius: DS.Radius.lg, style: .continuous))
          .overlay { RoundedRectangle(cornerRadius: DS.Radius.lg, style: .continuous).stroke(DS.C.borderSubtle, lineWidth: 1) }
        HStack(spacing: 10) { action("book", "التفسير الميسّر", "مضمّن") { onAction(.tafsir) }; action("headphones", "الاستماع", "من هذه الآية") { onAction(.listen) } }
        HStack(spacing: 10) { action("globe", "الترجمة", "quran.com") { onAction(.translation) }; action("character.book.closed", "معاني الكلمات", "كلمةً كلمة") { onAction(.wordMeanings) } }
        HStack(spacing: 10) { action(marked ? "bookmark.fill" : "bookmark", marked ? "تعديل العلامة" : "علامة", "مع ملاحظة ولون") { onAction(.bookmark) }; action("photo", "مشاركة صورةً", "٤ سمات") { onAction(.shareImage) } }
        HStack(spacing: 10) { action("mic", "مراجعة الحفظ", "من هنا", tone: .gold) { onAction(.hifz) }; action("checkmark.circle", "موضع القراءة", "احفظ هنا") { onAction(.lastRead) } }
        HStack(spacing: 10) { action("repeat", "تكرار الآية ×٣", "للحفظ") { onAction(.repeat3) }; action("doc.on.doc", "نسخ النص", "مع المرجع") { onAction(.copy) } }
        HStack(spacing: 10) { action("play", "تشغيل من هنا", "إلى آخر السورة") { onAction(.playFrom) }; action("square.and.arrow.up", "مشاركة نصًا", "") { onAction(.share) } }
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
      .background(DS.C.bgSubtle, in: RoundedRectangle(cornerRadius: DS.Radius.lg, style: .continuous))
      .contentShape(Rectangle())
    }.buttonStyle(.plain)
  }
}

// MARK: - لوحة مراجعة الحفظ / الإخفاء (تصميم 06): حالة الاستماع، زر ميكروفون بهالة، تقدّم، إجراءات الكشف
struct HifzPanelView: View {
  @Environment(AppModel.self) private var model
  let session: HifzSession
  var onExit: () -> Void
  var onNextPage: () -> Void
  var body: some View {
    let numerals = model.settings.numerals
    let total = QuranText.shared.pageAyahs(session.page).count
    VStack(spacing: 12) {
      HStack(spacing: 10) {
        Text(session.veil ? "إخفاء الآيات" : "مراجعة الحفظ").font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary)
        Text(session.veil ? "\(Fmt.number(min(session.revealedAyahs, total), numerals: numerals)) / \(Fmt.number(total, numerals: numerals)) آية" : "\(Fmt.number(session.pos, numerals: numerals)) / \(Fmt.number(session.words.count, numerals: numerals)) كلمة").font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary)
        Spacer()
        if session.hints > 0 && !session.veil { Text("\(Fmt.number(session.hints, numerals: numerals)) تلميحات").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary) }
        DSIconButton(systemName: "xmark", style: .outlined, size: 32, iconSize: 13, label: "إنهاء", action: onExit)
      }
      ProgressTrack(progress: session.progress, tint: DS.C.accentGold, track: DS.C.bgSubtle, height: 5)
      if !session.veil {
        HStack(spacing: 12) {
          Button { session.toggleSpeech() } label: {
            ZStack {
              Circle().fill(DS.C.brandPrimary.opacity(session.listening ? 0.16 : 0.08)).frame(width: 72, height: 72)
              Circle().fill(session.listening ? DS.C.danger : DS.C.brandPrimary).frame(width: 56, height: 56).shadow(color: DS.C.shadowFloat, radius: 10, y: 4)
              Image(systemName: session.listening ? "stop.fill" : "mic.fill").font(.system(size: 22, weight: .semibold)).foregroundStyle(DS.C.textOnBrand)
            }
          }.buttonStyle(.plain).disabled(!session.speechSupported).accessibilityLabel(session.listening ? "إيقاف التسميع" : "ابدأ التسميع")
          VStack(alignment: .leading, spacing: 3) {
            if session.done { Text("✓ أحسنت، أتممت الصفحة").font(DS.F.labelMd).foregroundStyle(DS.C.success) }
            else if let w = session.lastRevealed { HStack(spacing: 6) { Text("آخر كلمة:").font(DS.F.labelXs).foregroundStyle(DS.C.textSecondary); Text(w.raw).font(.custom(MushafFonts.amiriQuranFont, fixedSize: 20)).foregroundStyle(DS.C.textPrimary) } }
            else { Text(session.listening ? "يستمع… تابع التلاوة" : "اضغط الميكروفون أو انقر الصفحة لكشف كلمة").font(DS.F.labelMd).foregroundStyle(session.listening ? DS.C.brandPrimary : DS.C.textSecondary) }
            Text(session.heard.isEmpty ? "التعرّف على الكلام بالعربية · مطابقة متسامحة مع التشكيل" : "سمعتُ: \(session.heard)").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).lineLimit(1)
          }
          Spacer(minLength: 0)
        }
      }
      HStack(spacing: 8) {
        if session.veil {
          if session.done { DSButton(title: "الصفحة التالية", icon: "chevron.forward", action: onNextPage) } else { DSButton(title: "كشف الآية التالية", kind: .soft, icon: "eye") { session.revealAyah() } }
          DSButton(title: "كشف الكل", kind: .outline) { session.revealAll() }
        } else if session.done {
          DSButton(title: "الصفحة التالية", icon: "chevron.forward", action: onNextPage)
        } else {
          DSButton(title: "كشف كلمة", kind: .soft) { session.hint() }
          DSButton(title: "كشف آية", kind: .soft) { session.revealAyah() }
          DSButton(title: "إظهار الكل", kind: .outline) { session.revealAll() }
        }
      }
    }
    .padding(16)
    .background(DS.C.bgSurface, in: RoundedRectangle(cornerRadius: DS.Radius.xl, style: .continuous))
    .shadow(color: DS.C.shadowFloat, radius: 16, y: 8)
    .padding(.horizontal, 12).padding(.bottom, 6)
  }
}
