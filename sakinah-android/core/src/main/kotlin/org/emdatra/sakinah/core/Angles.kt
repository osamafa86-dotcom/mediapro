package org.emdatra.sakinah.core

import kotlin.math.floor

/** أدوات الزوايا المشتركة (درجات/راديان وتسوية المجالات) — مطابقة لـ astro.js في نسخة الويب */
const val DEG = Math.PI / 180
fun d2r(deg: Double) = deg * DEG
fun r2d(rad: Double) = rad / DEG
/** تقريب نصفي بعيدًا عن الصفر (كما في Swift .toNearestOrAwayFromZero) */
fun roundAway(x: Double): Double = if (x >= 0) floor(x + 0.5) else -floor(-x + 0.5)
fun normalizeToScale(num: Double, max: Double) = num - max * floor(num / max)
fun unwindAngle(angle: Double) = normalizeToScale(angle, 360.0)
fun quadrantShiftAngle(angle: Double) = if (angle >= -180 && angle <= 180) angle else angle - 360 * roundAway(angle / 360)
fun norm360(a: Double): Double { val r = a % 360; return if (r < 0) r + 360 else if (r == 0.0) 0.0 else r }
fun norm180(a: Double): Double { var r = norm360(a); if (r > 180) r -= 360; return r }
