import SwiftUI
import UIKit
import AudioToolbox
import SakinahCore

/// المسبحة (المرحلة الخامسة — tasbih.png): رجوعٌ يمينًا و«تراجع» و«تصفير» يسارًا، شرائح الصيغ (من اليمين)،
/// قرصٌ كبير يُعدّ بالنقر في أي مكانٍ حوله، ثلاث بلاطات (اليوم، هذا الأسبوع، الإجمالي)، «آخر سبعة أيام» من سجلٍّ
/// يوميّ على الجهاز وحده (ContentPrefs.tasbihDaily)، وبطاقة الإعدادات (الهدف، الاهتزاز، صوت النقر).
/// ملاحظة اتجاه: البيئة RTL، فأوّل عنصر في HStack يقع يمينًا، و`.leading` هو اليمين.
struct TasbihView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  /// عنوان زرّ الرجوع: الشاشة التي دُفعت منها
  var backTitle = "الذكر"
  @State private var reached = false
  @State private var bump = false
  @State private var showCustom = false
  @State private var customText = ""

  var body: some View {
    let n = model.settings.numerals
    let today = model.todayKey
    let st = model.content.tasbih
    let daily = model.content.tasbihDaily
    ScrollView(showsIndicators: false) {
      VStack(alignment: .leading, spacing: 18) {
        Text("المسبحة").font(DS.F.displayLg).foregroundStyle(DS.C.textPrimary).accessibilityAddTraits(.isHeader)
        phraseChips(st)
        counterArea(st, numerals: n)
        statTiles(st, daily: daily, today: today, numerals: n)
        weekChart(daily, today: today, numerals: n)
        settingsCard(st, numerals: n)
      }
      .padding(.horizontal, DS.Space.s4).padding(.top, DS.Space.s1).padding(.bottom, DS.Space.s8)
      .readableWidth(560)
    }
    .background(DS.C.bgCanvas)
    .safeAreaInset(edge: .top, spacing: 0) { topBar(st) }
    .navigationBarHidden(true)
    .alert("ذكر مخصّص", isPresented: $showCustom) {
      TextField("مثال: حسبي الله ونعم الوكيل", text: $customText)
      Button("اعتماد") {
        let v = customText.trimmingCharacters(in: .whitespaces)
        guard !v.isEmpty else { return }
        var s = model.content.tasbih; s.phrase = "custom"; s.custom = v; s.count = 0; s.rounds = 0; model.content.tasbih = s
      }
      Button("إلغاء", role: .cancel) {}
    }
  }

  // MARK: الشريط العلوي: رجوع، تراجع، تصفير

  private func topBar(_ st: TasbihState) -> some View {
    HStack(spacing: 8) {
      Button { dismiss() } label: {
        HStack(spacing: 4) {
          Image(systemName: "chevron.backward").font(.system(size: 15, weight: .semibold))
          Text(backTitle).font(DS.F.labelMd)
        }
        .foregroundStyle(DS.C.brandPrimary)
        .frame(minHeight: 44).contentShape(Rectangle())
      }
      .buttonStyle(.plain).accessibilityLabel("رجوع إلى \(backTitle)")
      Spacer(minLength: 8)
      barChip("تراجع") { undo(st) }
        .disabled(st.count == 0 && st.rounds == 0)
        .opacity(st.count == 0 && st.rounds == 0 ? 0.5 : 1)
      barChip("تصفير") { model.content.tasbih = Tasbih.reset(st) }
    }
    .padding(.horizontal, DS.Space.s4).padding(.vertical, DS.Space.s2)
    .readableWidth(560)
    .background(DS.C.bgCanvas)
  }
  private func barChip(_ title: String, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Text(title).font(DS.F.labelMd).foregroundStyle(DS.C.textPrimary)
        .padding(.vertical, 9).padding(.horizontal, 18)
        .background(DS.C.bgSurface, in: Capsule())
        .overlay(Capsule().stroke(DS.C.borderSubtle, lineWidth: 1))
        .contentShape(Capsule())
    }
    .buttonStyle(.plain)
    .accessibilityLabel(title)
  }

  // MARK: الصيغ — تبدأ من اليمين، و«ذكر آخر…» صيغةٌ تكتبها

  private func phraseChips(_ st: TasbihState) -> some View {
    ScrollView(.horizontal, showsIndicators: false) {
      HStack(spacing: 8) {
        ForEach(Tasbih.phrases) { p in
          let on = st.phrase == p.id
          DSChip(title: p.id == "custom" ? (st.custom.isEmpty ? "ذكر آخر…" : String(st.custom.prefix(22))) : p.text, on: on) {
            if p.id == "custom" { customText = st.custom; showCustom = true }
            else { var s = st; s.phrase = p.id; s.count = 0; s.rounds = 0; model.content.tasbih = s }
          }
          .accessibilityAddTraits(on ? .isSelected : [])
        }
      }
      .padding(.vertical, 2).padding(.horizontal, 2)
    }
  }

  // MARK: القرص: النقر في أي مكانٍ من هذه المساحة يعدّ

  private func counterArea(_ st: TasbihState, numerals: String) -> some View {
    let pct = st.target > 0 ? Double(st.count) / Double(st.target) : 0
    let sub = st.target > 0 ? "من \(Fmt.number(st.target, numerals: numerals))، الدورة \(Fmt.number(st.rounds + 1, numerals: numerals))" : "بلا حدّ"
    let shown = reached ? st.target : st.count
    return VStack(spacing: 14) {
      ZStack {
        RingProgress(progress: reached ? 1 : pct, tint: DS.C.brandPrimary, track: DS.C.bgSubtle, lineWidth: 12)
        VStack(spacing: 4) {
          Text(Tasbih.phraseText(st)).font(DS.quran(20)).foregroundStyle(DS.C.textSecondary)
            .multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.6).padding(.horizontal, 36)
          Text(Fmt.number(shown, numerals: numerals)).font(DS.readex(72, .light, fixed: true)).foregroundStyle(DS.C.textPrimary)
            .monospacedDigit().lineLimit(1).minimumScaleFactor(0.5).padding(.horizontal, 30)
          Text(sub).font(DS.F.labelSm).foregroundStyle(DS.C.textSecondary)
        }
      }
      .frame(width: 250, height: 250)
      .scaleEffect(bump ? 1.02 : 1)
      .animation(.snappy(duration: 0.15), value: bump)
      Text("انقر في أي مكان للعدّ، واهتزازٌ خفيف عند تمام الدورة").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary).multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity)
    .padding(.vertical, 10)
    .contentShape(Rectangle())
    .onTapGesture { tap() }
    .accessibilityElement(children: .ignore)
    .accessibilityAddTraits(.isButton)
    .accessibilityLabel("عدّ: \(Tasbih.phraseText(st))")
    .accessibilityValue(st.target > 0 ? "\(shown) من \(st.target)" : "\(shown)")
    .accessibilityAction(.default) { tap() }
  }

  // MARK: اليوم، هذا الأسبوع، الإجمالي

  private func statTiles(_ st: TasbihState, daily: [String: Int], today: String, numerals: String) -> some View {
    HStack(spacing: 10) {
      DSStatTile(value: Fmt.grouped(daily[today] ?? 0, numerals: numerals), label: "اليوم")
      DSStatTile(value: Fmt.grouped(TasbihWeek.total(daily, today: today), numerals: numerals), label: "هذا الأسبوع")
      DSStatTile(value: Fmt.grouped(Tasbih.grandTotal(st), numerals: numerals), label: "الإجمالي")
    }
  }

  // MARK: آخر سبعة أيام — من الأقدم (يمينًا) إلى اليوم (يسارًا، ذهبيًّا)

  private func weekChart(_ daily: [String: Int], today: String, numerals: String) -> some View {
    let keys = (0..<7).reversed().map { DayKey.adding(today, days: -$0) }
    let values = keys.map { daily[$0] ?? 0 }
    let top = max(1, values.max() ?? 1)
    return VStack(alignment: .leading, spacing: 14) {
      Text("آخر سبعة أيام").font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary)
      HStack(alignment: .bottom, spacing: 10) {
        ForEach(Array(keys.enumerated()), id: \.offset) { i, k in
          chartBar(key: k, value: values[i], top: top, isToday: i == keys.count - 1, numerals: numerals)
        }
      }
      .frame(height: 128, alignment: .bottom)
      Text("يُحفظ على جهازك وحده.").font(DS.F.labelXs).foregroundStyle(DS.C.textTertiary)
    }
    .todayCard(padding: 16)
  }
  private func chartBar(key: String, value: Int, top: Int, isToday: Bool, numerals: String) -> some View {
    let h: CGFloat = value == 0 ? 3 : max(8, CGFloat(value) / CGFloat(top) * 100)
    let fill: Color = value == 0 ? DS.C.borderStrong : (isToday ? DS.C.accentGold : DS.C.brandPrimary)
    return VStack(spacing: 6) {
      RoundedRectangle(cornerRadius: value == 0 ? 1.5 : 6, style: .continuous).fill(fill)
        .frame(maxWidth: 26).frame(height: h)
      Text(AdhkarStreak.letter(key)).font(DS.F.labelXs).foregroundStyle(isToday ? DS.C.accentGoldStrong : DS.C.textTertiary)
    }
    .frame(maxWidth: .infinity)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("\(isToday ? "اليوم" : Fmt.shortDate(key: key, numerals: numerals)): \(Fmt.number(value, numerals: numerals))")
  }

  // MARK: الإعدادات: الهدف، الاهتزاز، صوت النقر

  private func settingsCard(_ st: TasbihState, numerals: String) -> some View {
    VStack(alignment: .leading, spacing: 14) {
      Text("الهدف").font(DS.F.headingSm).foregroundStyle(DS.C.textPrimary)
      ScrollView(.horizontal, showsIndicators: false) {
        HStack(spacing: 8) {
          ForEach(Tasbih.targets, id: \.self) { t in
            targetChip(t > 0 ? Fmt.number(t, numerals: numerals) : "بلا حدّ", on: st.target == t) {
              var s = st; s.target = t; s.count = 0; s.rounds = 0; model.content.tasbih = s
            }
          }
        }
        .padding(.vertical, 1).padding(.horizontal, 1)
      }
      Divider().overlay(DS.C.borderSubtle)
      Toggle(isOn: Binding(get: { model.settings.haptics }, set: { model.settings.haptics = $0 })) {
        Text("اهتزاز عند كل عدّة").font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary)
      }
      .toggleStyle(DSToggleStyle())
      Toggle(isOn: Binding(get: { model.settings.tasbihSound }, set: { model.settings.tasbihSound = $0 })) {
        Text("صوت النقر").font(DS.F.bodyMd).foregroundStyle(DS.C.textPrimary)
      }
      .toggleStyle(DSToggleStyle())
    }
    .todayCard(padding: 16)
  }
  private func targetChip(_ title: String, on: Bool, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Text(title).font(DS.F.labelMd).foregroundStyle(on ? DS.C.textOnBrand : DS.C.textPrimary)
        .frame(minWidth: 56).padding(.vertical, 9).padding(.horizontal, 16)
        .background(on ? DS.C.brandPrimary : DS.C.bgSurface, in: Capsule())
        .overlay { if !on { Capsule().stroke(DS.C.borderSubtle, lineWidth: 1) } }
        .contentShape(Capsule())
    }
    .buttonStyle(.plain)
    .accessibilityAddTraits(on ? .isSelected : [])
  }

  // MARK: أفعال

  private func tap() {
    let today = model.todayKey
    let r = Tasbih.tap(model.content.tasbih, today: today)
    model.content.tasbih = r.state
    model.content.logTasbih(1, day: today)
    if r.reached {
      // تمام الدورة: اهتزازٌ خفيف دائمًا (كما يعد النصّ)؛ ومفتاح «عند كل عدّة» يخصّ العدّات بينها
      UINotificationFeedbackGenerator().notificationOccurred(.success)
      reached = true
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.65) { reached = false }
    } else if model.settings.haptics {
      UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
    if model.settings.tasbihSound { AudioServicesPlaySystemSound(1104) }
    bump = true
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { bump = false }
  }

  /// التراجع ينقص سجلّ اليوم فقط إن كانت العدّة المتراجَع عنها من اليوم (كما يفعل إحصاء الصيغة في النواة)
  private func undo(_ st: TasbihState) {
    let today = model.todayKey
    let after = Tasbih.undo(st, today: today)
    guard after != st else { return }
    model.content.tasbih = after
    if let b = st.totals[st.phrase], let a = after.totals[after.phrase], b.date == today, a.today < b.today {
      model.content.logTasbih(-1, day: today)
    }
  }
}
