import SwiftUI
import CoreLocation
import UIKit
import SakinahCore

/// الرئيسية (تصميم Figma «٥ · الرئيسية — التصميم النهائي»): ترويسة، بطاقة «الآن» تجمع الصلاة القادمة
/// وبوصلة القبلة في ميدالية واحدة، ثم مواقيت اليوم. القبلة الكاملة تُفتح من الميدالية.
struct HomeView: View {
  @Environment(AppModel.self) private var model
  @State private var showMethods = false
  @State private var showQibla = ScreenshotMode.fullQibla

  var body: some View {
    NavigationStack {
      TimelineView(.periodic(from: .now, by: 1)) { ctx in content(now: ctx.date) }
        .background(DS.C.bgCanvas)
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showMethods) { MethodPicker() }
        .fullScreenCover(isPresented: $showQibla) { QiblaView(presented: true).environment(model) }
    }
    .onAppear { model.location.startHeading() }
    .onDisappear { model.location.stopHeading() }
    // القبلة الكاملة توقف البوصلة عند إغلاقها؛ الميدالية تحتاجها من جديد
    .onChange(of: showQibla) { _, open in if !open { model.location.startHeading() } }
    .onReceive(NotificationCenter.default.publisher(for: UIDevice.orientationDidChangeNotification)) { _ in model.location.syncHeadingOrientation() }
  }

  @ViewBuilder
  private func content(now: Date) -> some View {
    ScrollView(showsIndicators: false) {
      VStack(spacing: 14) {
        header(now: now)
        if let t = model.timeline(now: now), let c = model.coordinates {
          nowCard(t, now: now, coords: c)
          todayCard(t, now: now)
        } else {
          locationPrompt
        }
      }
      .padding(.horizontal, 20).padding(.top, 4).padding(.bottom, 24)
    }
  }

  // MARK: الترويسة
  private func header(now: Date) -> some View {
    let s = model.settings
    let h = model.hijri(now: now)
    return HStack(alignment: .top, spacing: 10) {
      VStack(alignment: .leading, spacing: 3) {
        Text("السَّلامُ عَلَيْكُمْ وَرَحْمَةُ الله").font(DS.F.bodySm).foregroundStyle(DS.C.textSecondary)
        HStack(spacing: 6) {
          Text(model.location.placeName ?? "حدّد موقعك").font(DS.F.displayLg).foregroundStyle(DS.C.textPrimary).lineLimit(1).minimumScaleFactor(0.7)
          Image(systemName: "mappin").font(.system(size: 16, weight: .semibold)).foregroundStyle(DS.C.accentGold)
        }
        // نصوصٌ منفصلة لا سلسلة واحدة: خلط الأرقام العربية والغربية في سلسلةٍ واحدة قلب ترتيب الكلمات (قِيس)
        HStack(spacing: 6) {
          Text("\(h.weekday) \(Fmt.number(h.day, numerals: s.numerals)) \(h.monthName) \(Fmt.number(h.year, numerals: s.numerals))هـ")
          Text("·")
          Text(Fmt.shortDate(now, tz: model.timeZone, numerals: s.numerals))
        }
        .font(DS.F.labelSm).foregroundStyle(DS.C.textTertiary).lineLimit(1).minimumScaleFactor(0.8)
      }
      Spacer(minLength: 8)
      NavigationLink { MonthTableView() } label: { headerIcon("calendar") }.buttonStyle(.plain).accessibilityLabel("الجدول الشهري")
      NavigationLink { CityPickerView() } label: { headerIcon(model.location.mode == .gps ? "location" : "mappin.and.ellipse") }.buttonStyle(.plain).accessibilityLabel("الموقع")
    }
  }
  private func headerIcon(_ name: String) -> some View {
    DSIcon(systemName: name, size: 44, iconSize: 18).shadow(color: DS.C.shadowCard, radius: 8, x: 0, y: 2)
  }

  // MARK: بطاقة «الآن»: الصلاة القادمة + ميدالية القبلة
  private func nowCard(_ t: PrayerTimes.DayTimeline, now: Date, coords c: Coordinates) -> some View {
    let s = model.settings
    let remaining = t.next.time.timeIntervalSince(now)
    // بعد منتصف الليل «الحالية» هي عشاء الأمس لا عشاء اليوم (وقتها لم يحن بعد) — وإلا قُرئ التقدّم صفرًا
    let start = t.times[t.current].flatMap { $0 <= now ? $0 : nil } ?? t.yesterdayIsha
    let total = start.map { t.next.time.timeIntervalSince($0) } ?? 0
    let elapsed = total > 0 ? min(1, max(0, now.timeIntervalSince(start!) / total)) : 0
    let pct = Fmt.number(Int((elapsed * 100).rounded()), numerals: s.numerals)
    let q = Qibla.info(latitude: c.latitude, longitude: c.longitude)
    // المحاكي بلا مغناطيسية: في وضع اللقطات وحده يُفترض اتجاهٌ يطابق القبلة (انظر QiblaView)
    let heading = model.location.heading.map { CompassMath.trueHeading($0, at: c) } ?? (ScreenshotMode.active ? q.bearing : nil)
    let diff = heading.map { Qibla.signedDifference(target: q.bearing, reference: $0) }
    let aligned = diff.map { abs($0) <= 3 } ?? false
    return ZStack(alignment: .topTrailing) {
      HStack(alignment: .center, spacing: 12) {
        VStack(alignment: .leading, spacing: 4) {
          HStack(spacing: 6) {
            Text("الصلاة القادمة").font(DS.readex(12, .medium)).kerning(0.4).foregroundStyle(DS.C.textOnDarkMuted)
            Circle().fill(DS.C.accentGold).frame(width: 6, height: 6)
          }
          Text(t.next.isTomorrow ? "فجر الغد" : t.next.key.nameAr).font(DS.F.displayHero).foregroundStyle(DS.C.textOnDark).lineLimit(1).minimumScaleFactor(0.6)
          Text(Fmt.countdown(remaining, numerals: s.numerals)).font(DS.F.numericXl).monospacedDigit().foregroundStyle(DS.C.textOnDark).lineLimit(1).minimumScaleFactor(0.5)
          Text("الأذان \(Fmt.time(t.next.time, tz: model.timeZone, hour12: s.hour12, numerals: s.numerals))").font(DS.F.labelXs).foregroundStyle(DS.C.textOnDarkMuted)
          ProgressTrack(progress: elapsed, height: 4).padding(.top, 8)
          Text("مضى \(pct)٪ من وقت \(t.current.nameAr)").font(DS.F.labelXs).foregroundStyle(DS.C.textOnDarkMuted).lineLimit(1).minimumScaleFactor(0.8)
          Button { showMethods = true } label: {
            Text(Methods.method(s.methodId).nameAr).font(DS.readex(10.5)).foregroundStyle(DS.C.textOnDarkMuted).lineLimit(1)
              .padding(.vertical, 3).padding(.horizontal, 8).background(Color.white.opacity(0.09), in: Capsule())
          }
          .buttonStyle(.plain).accessibilityLabel("طريقة الحساب").padding(.top, 4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        Button { showQibla = true } label: {
          VStack(spacing: 8) {
            CompassMedallion(bearing: q.bearing, heading: heading ?? 0, aligned: aligned, live: heading != nil).frame(width: 150, height: 150)
            qiblaChip(aligned: aligned, diff: diff, live: heading != nil)
            Text("\(Fmt.degrees(q.bearing, numerals: s.numerals))  ·  \(Fmt.distance(q.distanceKm, numerals: s.numerals))")
              .font(DS.F.labelXs).foregroundStyle(DS.C.textOnDarkMuted).lineLimit(1).minimumScaleFactor(0.8)
          }
          .frame(width: 150)
        }
        .buttonStyle(.plain).accessibilityLabel("القبلة كاملة")
      }
      .padding(.vertical, 18).padding(.leading, 20).padding(.trailing, 16)
      Image(systemName: "arrow.up.left.and.arrow.down.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.5)).padding(16)
        .allowsHitTesting(false)
    }
    .frame(maxWidth: .infinity)
    .background { nowBackground }
    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
    .shadow(color: DS.C.shadowFloat, radius: 24, x: 0, y: 12)
  }

  /// تدرّج أخضر عميق بثلاث درجات، فوقه نقش نجمة ثمانية خافت ووهج ذهبي خلف الميدالية
  private var nowBackground: some View {
    ZStack {
      LinearGradient(colors: [Color(hex: 0x11695F), Color(hex: 0x0B4A43), Color(hex: 0x05221F)], startPoint: .topTrailing, endPoint: .bottomLeading)
      StarLattice().opacity(0.07)
      RadialGradient(colors: [DS.C.accentGold.opacity(0.22), .clear], center: .center, startRadius: 0, endRadius: 110)
        .frame(width: 220, height: 220)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
    }
  }

  private func qiblaChip(aligned: Bool, diff: Double?, live: Bool) -> some View {
    let n = model.settings.numerals
    let text: String
    let icon: String
    if !live { text = "حرّك الهاتف على شكل ٨"; icon = "arrow.triangle.2.circlepath" }
    else if aligned { text = "متّجه نحو القبلة"; icon = "checkmark" }
    else if let d = diff { text = d > 0 ? "يمينًا \(Fmt.degrees(abs(d), numerals: n))" : "يسارًا \(Fmt.degrees(abs(d), numerals: n))"; icon = d > 0 ? "arrow.turn.up.right" : "arrow.turn.up.left" }
    else { text = "جارٍ القراءة…"; icon = "location.north.line" }
    return HStack(spacing: 6) {
      Text(text).font(DS.F.labelSm).foregroundStyle(Color(hex: 0xE9F6F3)).lineLimit(1).minimumScaleFactor(0.8)
      Image(systemName: icon).font(.system(size: 11, weight: .bold)).foregroundStyle(aligned ? Color(hex: 0x7BE0CF) : DS.C.accentGold)
    }
    .padding(.vertical, 6).padding(.horizontal, 10)
    .background(Color.white.opacity(0.10), in: Capsule())
    .overlay(Capsule().stroke(Color.white.opacity(0.14), lineWidth: 1))
    .animation(.snappy(duration: 0.25), value: aligned)
  }

  // MARK: مواقيت اليوم
  private func isNext(_ p: Prayer, _ t: PrayerTimes.DayTimeline) -> Bool { t.next.key == p && !t.next.isTomorrow }

  private func todayCard(_ t: PrayerTimes.DayTimeline, now: Date) -> some View {
    let prayers = Array(Prayer.allCases)
    return VStack(spacing: 0) {
      HStack {
        Text("مواقيت اليوم").font(DS.F.displaySm).foregroundStyle(DS.C.textPrimary)
        Spacer()
        NavigationLink { MonthTableView() } label: { DSLinkLabel(title: "الجدول الشهري") }.buttonStyle(.plain)
      }
      .padding(.horizontal, 8).padding(.top, 2).padding(.bottom, 10)
      ForEach(Array(prayers.enumerated()), id: \.offset) { i, p in
        prayerRow(p, t, now: now)
        if i < prayers.count - 1, !isNext(p, t), !isNext(prayers[i + 1], t) {
          Rectangle().fill(DS.C.borderSubtle.opacity(0.6)).frame(height: 1).padding(.horizontal, 12)
        }
      }
    }
    .padding(.top, 16).padding(.bottom, 8).padding(.horizontal, 12)
    .background(DS.C.bgSurface, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
    .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(DS.C.borderSubtle.opacity(0.7), lineWidth: 1))
    .shadow(color: DS.C.shadowCard, radius: 20, x: 0, y: 6)
  }

  private func icon(for p: Prayer) -> String {
    switch p { case .fajr: return "sunrise"; case .sunrise: return "sun.horizon"; case .dhuhr: return "sun.max"; case .asr: return "sun.min"; case .maghrib: return "sunset"; case .isha: return "moon.stars" }
  }

  private func prayerRow(_ p: Prayer, _ t: PrayerTimes.DayTimeline, now: Date) -> some View {
    let s = model.settings
    let next = isNext(p, t)
    let past = !next && (t.times[p].map { $0 <= now } ?? false)
    let remind = s.reminders.prayers.contains(p)
    let ink: Color = next ? DS.C.brandStrong : past ? DS.C.textTertiary : DS.C.textPrimary
    return HStack(spacing: 12) {
      ZStack {
        Circle().fill(next ? DS.C.brandPrimary : past ? DS.C.bgSubtle : DS.C.bgCanvas)
        if !next { Circle().stroke(DS.C.borderSubtle, lineWidth: 1) }
        Image(systemName: icon(for: p)).font(.system(size: 15, weight: .medium)).foregroundStyle(next ? DS.C.textOnBrand : past ? DS.C.textTertiary : DS.C.brandPrimary)
      }
      .frame(width: 34, height: 34)
      Text(p.nameAr).font(DS.readex(15.5, next ? .semibold : .medium)).foregroundStyle(ink)
      if next { DSBadge(text: "القادمة") }
      Spacer(minLength: 4)
      Text(Fmt.time(t.times[p], tz: model.timeZone, hour12: s.hour12, numerals: s.numerals))
        .font(DS.readex(15, next ? .semibold : .regular, fixed: true)).monospacedDigit().foregroundStyle(ink)
      Button {
        var r = s.reminders
        if remind { r.prayers.remove(p) } else { r.prayers.insert(p) }
        s.reminders = r; model.rescheduleNotifications()
      } label: {
        Image(systemName: remind ? "bell" : "bell.slash").font(.system(size: 14, weight: .medium))
          .foregroundStyle(remind ? (next ? DS.C.brandPrimary : DS.C.textSecondary) : DS.C.borderStrong)
          .frame(width: 30, height: 30)
          .background(next ? DS.C.brandPrimary.opacity(0.12) : .clear, in: Circle())
          .contentShape(Circle())
      }
      .buttonStyle(.plain)
      .accessibilityLabel(remind ? "إيقاف تذكير \(p.nameAr)" : "تفعيل تذكير \(p.nameAr)")
    }
    .padding(.vertical, 10).padding(.horizontal, 10)
    .background {
      if next {
        RoundedRectangle(cornerRadius: 16, style: .continuous)
          .fill(LinearGradient(colors: [DS.C.brandSoft.opacity(0.35), DS.C.brandSoft.opacity(0.75)], startPoint: .leading, endPoint: .trailing))
      }
    }
  }

  // MARK: لا موقع بعد
  private var locationPrompt: some View {
    VStack(spacing: 14) {
      DSIcon(systemName: "location.circle", style: .soft, size: 72, iconSize: 32)
      Text("حدّد موقعك لحساب المواقيت والقبلة").font(DS.F.headingLg).foregroundStyle(DS.C.textPrimary).multilineTextAlignment(.center)
      Text("يُستخدم الموقع على جهازك فقط لحساب المواقيت واتجاه القبلة، ولا يُرسل إلى أي خادم.").font(DS.F.bodyMd).foregroundStyle(DS.C.textSecondary).multilineTextAlignment(.center)
      if let e = model.location.errorMessage { Text(e).font(DS.F.bodySm).foregroundStyle(DS.C.danger).multilineTextAlignment(.center) }
      DSButton(title: "استخدام موقع الجهاز", icon: "location.fill") { model.location.requestLocation() }
      NavigationLink { CityPickerView() } label: { DSButtonLabel(title: "اختيار مدينة يدويًا · ٦٤٩ مدينة", kind: .outline, icon: "magnifyingglass") }.buttonStyle(.plain)
    }
    .frame(maxWidth: .infinity)
    .dsCard(padding: 24)
  }
}

/// الاتجاه الحقيقي من CoreLocation، أو المغناطيسي مصحّحًا بانحراف WMM2025
enum CompassMath {
  static func trueHeading(_ h: CLHeading, at c: Coordinates) -> Double {
    if h.trueHeading >= 0 { return h.trueHeading }
    return Geomag.magneticToTrue(h.magneticHeading, declination: Geomag.declination(lat: c.latitude, lon: c.longitude))
  }
}

/// ميدالية البوصلة: قرص زجاجي داكن، ٤٨ علامة درجات، حروف الجهات، الكعبة عند رأس إبرة ذهبية متدرّجة، وجوهرة في المركز
struct CompassMedallion: View {
  let bearing: Double
  let heading: Double
  let aligned: Bool
  var live: Bool = true

  var body: some View {
    GeometryReader { geo in
      let size = min(geo.size.width, geo.size.height)
      let r = size / 2 - 5
      ZStack {
        Circle()
          .fill(RadialGradient(colors: [Color(hex: 0x0B4A43).opacity(0.9), Color(hex: 0x05221F).opacity(0.95)], center: .center, startRadius: 0, endRadius: r))
          .overlay(Circle().stroke(Color.white.opacity(0.14), lineWidth: 1))
          .frame(width: r * 2, height: r * 2)
          .shadow(color: .black.opacity(0.35), radius: 18, x: 0, y: 8)
        ZStack {
          Canvas { ctx, sz in
            let c = CGPoint(x: sz.width / 2, y: sz.height / 2)
            for i in 0..<48 {
              let major = i % 12 == 0, mid = i % 4 == 0
              let len: CGFloat = major ? 9 : (mid ? 6 : 3.5)
              let a = Double(i) * 7.5 * .pi / 180
              let outer = r - 6
              var path = Path()
              path.move(to: CGPoint(x: c.x + outer * sin(a), y: c.y - outer * cos(a)))
              path.addLine(to: CGPoint(x: c.x + (outer - len) * sin(a), y: c.y - (outer - len) * cos(a)))
              let color: Color = major ? Color(hex: 0xE2C77A).opacity(0.9) : Color.white.opacity(mid ? 0.45 : 0.22)
              ctx.stroke(path, with: .color(color), style: StrokeStyle(lineWidth: major ? 1.6 : 1, lineCap: .round))
            }
          }
          ForEach(Array(["ش", "ق", "ج", "غ"].enumerated()), id: \.offset) { i, letter in
            let angle = Double(i) * 90
            Text(letter).font(DS.readex(9.5, .medium)).foregroundStyle(.white.opacity(0.55))
              .rotationEffect(.degrees(-angle)).offset(y: -(r - 18)).rotationEffect(.degrees(angle))
          }
          // الوهج والكعبة والإبرة تدور معًا نحو اتجاه القبلة
          Group {
            RadialGradient(colors: [Color(hex: 0xE2C77A).opacity(0.35), .clear], center: .center, startRadius: 0, endRadius: 35)
              .frame(width: 70, height: 70)
            RoundedRectangle(cornerRadius: 2.5, style: .continuous).fill(Color(hex: 0x05221F))
              .overlay(RoundedRectangle(cornerRadius: 2.5, style: .continuous).stroke(Color(hex: 0xE2C77A), lineWidth: 1.2))
              .overlay(alignment: .top) { Rectangle().fill(Color(hex: 0xE2C77A)).frame(height: 2.5).padding(.top, 4.5) }
              .frame(width: 14, height: 14)
              .offset(y: -(r - 15))
            NeedleShape()
              .fill(LinearGradient(colors: [Color(hex: 0xF0DFA0), Color(hex: 0xB98A2E)], startPoint: .top, endPoint: .bottom))
              .frame(width: 16, height: r - 20)
              .shadow(color: .black.opacity(0.35), radius: 6, x: 0, y: 3)
              .offset(y: -(r - 20) / 2)
            NeedleShape().fill(Color.white.opacity(0.22)).frame(width: 12, height: 34).rotationEffect(.degrees(180)).offset(y: 17)
          }
          .rotationEffect(.degrees(bearing))
          Circle().fill(Color(hex: 0x05221F)).frame(width: 16, height: 16).overlay(Circle().stroke(Color(hex: 0xE2C77A), lineWidth: 2))
          Circle().fill(DS.C.textOnDark).frame(width: 5, height: 5)
        }
        .rotationEffect(.degrees(-heading))
        .animation(.easeOut(duration: 0.25), value: heading)
        .opacity(live ? 1 : 0.5)
      }
      .frame(width: size, height: size)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    .accessibilityLabel(aligned ? "متجه إلى القبلة" : "اتجاه القبلة \(Int(bearing)) درجة")
  }
}

/// نقش النجمة الثمانية: شبكة خفيفة تُقرأ كنسيج لا كزخرفة (تُرسم بالكامل ثم تُقصّ مع البطاقة)
struct StarLattice: View {
  var body: some View {
    Canvas { ctx, size in
      let step: CGFloat = 72, r: CGFloat = 29
      var y: CGFloat = -30; var row = 0
      while y < size.height + r {
        var x: CGFloat = (row % 2 == 1 ? 36 : 0) - 20
        while x < size.width + r {
          ctx.stroke(star(center: CGPoint(x: x + r, y: y + r), r: r), with: .color(.white), lineWidth: 1)
          x += step
        }
        y += step; row += 1
      }
    }
    .allowsHitTesting(false)
  }
  private func star(center: CGPoint, r: CGFloat) -> Path {
    var p = Path()
    for i in 0..<16 {
      let a = Double(i) * .pi / 8 - .pi / 2 + .pi / 16
      let rr = i % 2 == 0 ? r : r * 0.72
      let pt = CGPoint(x: center.x + rr * cos(a), y: center.y + rr * sin(a))
      if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
    }
    p.closeSubpath()
    return p
  }
}
