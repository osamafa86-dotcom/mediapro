import Foundation

/// أدوات الزوايا المشتركة (درجات/راديان وتسوية المجالات) — مطابقة لـ astro.js في نسخة الويب
@usableFromInline let DEG = Double.pi / 180

@inlinable public func d2r(_ deg: Double) -> Double { deg * DEG }
@inlinable public func r2d(_ rad: Double) -> Double { rad / DEG }

/// إرجاع القيمة إلى المجال [0, max)
@inlinable public func normalizeToScale(_ num: Double, _ max: Double) -> Double { num - max * (num / max).rounded(.down) }
/// إرجاع الزاوية إلى المجال [0, 360)
@inlinable public func unwindAngle(_ angle: Double) -> Double { normalizeToScale(angle, 360) }
/// إرجاع الزاوية إلى المجال [-180, 180]
@inlinable public func quadrantShiftAngle(_ angle: Double) -> Double {
  (angle >= -180 && angle <= 180) ? angle : angle - 360 * (angle / 360).rounded(.toNearestOrAwayFromZero)
}
/// تسوية إلى [0, 360) بأسلوب geomag.js (باقي القسمة)
@inlinable public func norm360(_ a: Double) -> Double { let r = a.truncatingRemainder(dividingBy: 360); return r < 0 ? r + 360 : (r == 0 ? 0 : r) }
/// تسوية إلى (-180, 180]
@inlinable public func norm180(_ a: Double) -> Double { var r = norm360(a); if r > 180 { r -= 360 }; return r }
