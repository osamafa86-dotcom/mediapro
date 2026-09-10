import Foundation

/// حالة المسبحة (تُحفظ كما في الويب): الصيغة، الهدف (0 = بلا حدّ)، نص مخصّص، العدّ، الدورات، وإحصاء كل صيغة
public struct TasbihState: Sendable, Hashable, Codable {
  public struct Totals: Sendable, Hashable, Codable { public var total: Int; public var today: Int; public var date: String }
  public var phrase: String = "subhan"
  public var target: Int = 33
  public var custom: String = ""
  public var count: Int = 0
  public var rounds: Int = 0
  public var totals: [String: Totals] = [:]
  public init() {}
  public init(from d: Decoder) throws {
    let c = try d.container(keyedBy: CodingKeys.self)
    phrase = (try? c.decode(String.self, forKey: .phrase)) ?? "subhan"; target = (try? c.decode(Int.self, forKey: .target)) ?? 33
    custom = (try? c.decode(String.self, forKey: .custom)) ?? ""; count = (try? c.decode(Int.self, forKey: .count)) ?? 0; rounds = (try? c.decode(Int.self, forKey: .rounds)) ?? 0
    totals = (try? c.decode([String: Totals].self, forKey: .totals)) ?? [:]
  }
}

public enum Tasbih {
  public static var phrases: [TasbihPhrase] { Catalog.shared.tasbih.phrases }
  public static var targets: [Int] { Catalog.shared.tasbih.targets }
  public static func phraseText(_ s: TasbihState) -> String {
    let p = phrases.first { $0.id == s.phrase } ?? phrases[0]
    if p.id == "custom" { let t = s.custom.trimmingCharacters(in: .whitespaces); return t.isEmpty ? "ذكر" : t }
    return p.text
  }
  /// نقرة: تزيد العدّ وإحصاء الصيغة؛ عند بلوغ الهدف تكتمل دورة ويعود العدّ صفرًا
  public static func tap(_ state: TasbihState, today: String) -> (state: TasbihState, reached: Bool) {
    var s = state
    var t = s.totals[s.phrase] ?? TasbihState.Totals(total: 0, today: 0, date: today)
    if t.date != today { t.today = 0; t.date = today }
    t.total += 1; t.today += 1; s.totals[s.phrase] = t
    s.count += 1
    var reached = false
    if s.target > 0 && s.count >= s.target { reached = true; s.rounds += 1; s.count = 0 }
    return (s, reached)
  }
  public static func undo(_ state: TasbihState, today: String) -> TasbihState {
    if state.count <= 0 && state.rounds <= 0 { return state }
    var s = state
    if var t = s.totals[s.phrase], t.total > 0 { t.total -= 1; if t.date == today && t.today > 0 { t.today -= 1 }; s.totals[s.phrase] = t }
    if s.count > 0 { s.count -= 1 } else { s.rounds -= 1; s.count = s.target > 0 ? s.target - 1 : 0 }
    return s
  }
  public static func reset(_ state: TasbihState) -> TasbihState { var s = state; s.count = 0; s.rounds = 0; return s }
  public static func todayCount(_ s: TasbihState, today: String) -> Int { guard let t = s.totals[s.phrase], t.date == today else { return 0 }; return t.today }
  public static func totalCount(_ s: TasbihState) -> Int { s.totals[s.phrase]?.total ?? 0 }
  public static func grandTotal(_ s: TasbihState) -> Int { s.totals.values.reduce(0) { $0 + $1.total } }
}
