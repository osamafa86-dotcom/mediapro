package org.emdatra.sakinah.app.ui

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas as ACanvas
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.BitmapDrawable
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import org.emdatra.sakinah.BuildConfig
import org.emdatra.sakinah.core.Coordinates
import org.emdatra.sakinah.core.Qibla
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.BoundingBox
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.CustomZoomButtonsController
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polyline
import java.io.File
import kotlin.math.abs
import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * الدائرة العظمى من موضعٍ إلى آخر: [n]+١ نقطة بالاستيفاء الكرويّ (slerp على كرة الأرض) — تُحسب على الجهاز وحده.
 * النقاط بخطوط طول في [-١٨٠، ١٨٠]؛ والتقسيم عند خطّ التاريخ في [greatCircleSegments].
 */
fun greatCircle(a: Coordinates, b: Coordinates, n: Int = 64): List<Coordinates> {
  val p1 = Math.toRadians(a.latitude); val l1 = Math.toRadians(a.longitude)
  val p2 = Math.toRadians(b.latitude); val l2 = Math.toRadians(b.longitude)
  val h = sin((p2 - p1) / 2).let { it * it } + cos(p1) * cos(p2) * sin((l2 - l1) / 2).let { it * it }
  val d = 2 * asin(min(1.0, sqrt(h)))
  if (d < 1e-9 || abs(sin(d)) < 1e-9) return listOf(a, b)
  return (0..n).map { i ->
    val f = i.toDouble() / n
    val ka = sin((1 - f) * d) / sin(d); val kb = sin(f * d) / sin(d)
    val x = ka * cos(p1) * cos(l1) + kb * cos(p2) * cos(l2)
    val y = ka * cos(p1) * sin(l1) + kb * cos(p2) * sin(l2)
    val z = ka * sin(p1) + kb * sin(p2)
    Coordinates(Math.toDegrees(atan2(z, sqrt(x * x + y * y))), Math.toDegrees(atan2(y, x)))
  }
}
/** قطعٌ لا تعبر خطّ التاريخ (قفزةٌ في خطّ الطول تتجاوز ١٨٠° تبدأ قطعةً جديدة) */
fun greatCircleSegments(points: List<Coordinates>): List<List<Coordinates>> {
  val out = ArrayList<MutableList<Coordinates>>(); var cur = ArrayList<Coordinates>()
  for (p in points) { val last = cur.lastOrNull(); if (last != null && abs(p.longitude - last.longitude) > 180) { out.add(cur); cur = ArrayList() }; cur.add(p) }
  if (cur.isNotEmpty()) out.add(cur)
  return out
}

/** ألوان الرسم على الخريطة (تُمرَّر من رموز نظام التصميم) */
class QiblaMapColors(val line: Int, val pin: Int, val pinFill: Int, val kaaba: Int, val gold: Int, val labelBg: Int, val labelFg: Int, val labelBorder: Int)

/**
 * خريطة القبلة: بلاطات OpenStreetMap (MAPNIK) عبر osmdroid، وفوقها خطّ الدائرة العظمى متقطّعاً، ودبّوسان بوسميهما.
 * البلاطات وحدها من الشبكة؛ وبلا اتصالٍ يبقى الخطّ والدبّوسان على خلفيةٍ فارغة.
 */
@Composable fun QiblaMap(user: Coordinates, userLabel: String, colors: QiblaMapColors, modifier: Modifier = Modifier) {
  val ctx = LocalContext.current
  val density = LocalDensity.current.density
  val lifecycle = LocalLifecycleOwner.current.lifecycle
  val map = remember {
    configureOsmdroid(ctx)
    MapView(ctx).apply {
      setTileSource(TileSourceFactory.MAPNIK)
      setMultiTouchControls(true)
      zoomController.setVisibility(CustomZoomButtonsController.Visibility.NEVER)
      setTilesScaledToDpi(true)
      setMinZoomLevel(2.0); setMaxZoomLevel(18.0)
      setVerticalMapRepetitionEnabled(false)
      setScrollableAreaLimitLatitude(MapView.getTileSystem().maxLatitude, MapView.getTileSystem().minLatitude, 0)
      // الخريطة داخل شاشةٍ تتمرّر أحياناً: السحب عليها لها وحدها
      setOnTouchListener { v, _ -> v.parent?.requestDisallowInterceptTouchEvent(true); false }
    }
  }
  DisposableEffect(lifecycle, map) {
    val obs = LifecycleEventObserver { _, e -> when (e) { Lifecycle.Event.ON_RESUME -> map.onResume(); Lifecycle.Event.ON_PAUSE -> map.onPause(); else -> {} } }
    lifecycle.addObserver(obs); map.onResume()
    onDispose { lifecycle.removeObserver(obs); map.onPause(); map.onDetach() }
  }
  val key = "${user.latitude},${user.longitude},$userLabel,${colors.line}"
  AndroidView(factory = { map }, modifier = modifier, update = { m ->
    if (m.tag == key) return@AndroidView
    m.tag = key
    m.overlays.clear()
    val kaaba = Coordinates(Qibla.kaaba.latitude, Qibla.kaaba.longitude)
    val path = greatCircle(user, kaaba, 64)
    for (seg in greatCircleSegments(path)) {
      if (seg.size < 2) continue
      val line = Polyline(m)
      line.setPoints(seg.map { GeoPoint(it.latitude, it.longitude) })
      line.outlinePaint.apply { color = colors.line; strokeWidth = 4f * density; strokeCap = Paint.Cap.ROUND; isAntiAlias = true; pathEffect = DashPathEffect(floatArrayOf(10f * density, 8f * density), 0f) }
      line.setOnClickListener { _, _, _ -> true }
      m.overlays.add(line)
    }
    m.overlays.add(pin(m, ctx, GeoPoint(user.latitude, user.longitude), userLabel, kaaba = false, colors, density))
    m.overlays.add(pin(m, ctx, GeoPoint(kaaba.latitude, kaaba.longitude), "مكة المكرمة", kaaba = true, colors, density))
    val pts = path.map { GeoPoint(it.latitude, it.longitude) }
    val crossesDateline = greatCircleSegments(path).size > 1
    val fit = {
      if (!crossesDateline && pts.size >= 2) runCatching { m.zoomToBoundingBox(BoundingBox.fromGeoPoints(pts).increaseByScale(1.25f), false, (36 * density).toInt()) }
      else { m.controller.setZoom(3.0); m.controller.setCenter(GeoPoint(user.latitude, user.longitude)) }
      if (m.zoomLevelDouble > 16.0) m.controller.setZoom(16.0)
    }
    if (m.width > 0 && m.height > 0) fit() else m.addOnFirstLayoutListener { _, _, _, _, _ -> fit() }
    m.invalidate()
  })
}

private fun configureOsmdroid(ctx: Context) {
  val conf = Configuration.getInstance()
  conf.load(ctx, ctx.getSharedPreferences("osmdroid", Context.MODE_PRIVATE))
  // سياسة استخدام بلاطات OSM: معرّف التطبيق وكيلاً، والذاكرة المؤقّتة داخل مجلّد التطبيق (لا تخزين خارجيّ ولا إذن)
  conf.userAgentValue = BuildConfig.APPLICATION_ID
  val base = File(ctx.cacheDir, "osmdroid"); conf.osmdroidBasePath = base; conf.osmdroidTileCache = File(base, "tiles")
}

/** دبّوسٌ بوسمه: دائرة الموضع (أو مكعّب الكعبة بحزامه الذهبيّ) وكبسولة الاسم فوقها أو تحتها — صورةٌ مرسومة على الجهاز */
private fun pin(m: MapView, ctx: Context, at: GeoPoint, label: String, kaaba: Boolean, colors: QiblaMapColors, d: Float): Marker {
  val text = Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = 12.5f * d; color = colors.labelFg; typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD); textAlign = Paint.Align.CENTER }
  val tw = text.measureText(label); val padH = 10f * d; val pillH = 26f * d
  val icon = if (kaaba) 26f * d else 22f * d; val gap = 6f * d
  val w = maxOf(tw + 2 * padH, icon) + 4f * d; val h = pillH + gap + icon + 4f * d
  val bmp = Bitmap.createBitmap(w.toInt(), h.toInt(), Bitmap.Config.ARGB_8888); val cv = ACanvas(bmp)
  val cx = w / 2
  // الكعبة: الوسم تحتها؛ الموضع: الوسم فوقه
  val pillTop = if (kaaba) 2f * d + icon + gap else 2f * d
  val iconTop = if (kaaba) 2f * d else 2f * d + pillH + gap
  val pill = RectF(cx - (tw / 2 + padH), pillTop, cx + (tw / 2 + padH), pillTop + pillH)
  cv.drawRoundRect(pill, pillH / 2, pillH / 2, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = colors.labelBg })
  cv.drawRoundRect(pill, pillH / 2, pillH / 2, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = colors.labelBorder; style = Paint.Style.STROKE; strokeWidth = 1f * d })
  val fm = text.fontMetrics; cv.drawText(label, cx, pill.centerY() - (fm.ascent + fm.descent) / 2, text)
  if (kaaba) {
    val r = RectF(cx - icon / 2, iconTop, cx + icon / 2, iconTop + icon)
    cv.drawRoundRect(r, 4f * d, 4f * d, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = colors.kaaba })
    cv.drawRect(RectF(r.left, r.top + icon * 0.28f, r.right, r.top + icon * 0.28f + 3.5f * d), Paint(Paint.ANTI_ALIAS_FLAG).apply { color = colors.gold })
  } else {
    val cy = iconTop + icon / 2
    cv.drawCircle(cx, cy, icon / 2 - 2f * d, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = colors.pinFill })
    cv.drawCircle(cx, cy, icon / 2 - 2f * d, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = colors.pin; style = Paint.Style.STROKE; strokeWidth = 3.5f * d })
  }
  return Marker(m).apply {
    position = at
    setIcon(BitmapDrawable(ctx.resources, bmp))
    setAnchor(0.5f, (iconTop + icon / 2) / h)
    setOnMarkerClickListener { _, _ -> true }
    title = label
  }
}

/** ألوانٌ من رموز نظام التصميم */
@Composable fun qiblaMapColors(): QiblaMapColors {
  val c = DS.c
  return QiblaMapColors(line = c.brandPrimary.toArgb(), pin = c.brandPrimary.toArgb(), pinFill = c.bgSurface.toArgb(), kaaba = c.bgInverse.let { if (c.isDark) c.bgCanvas else it }.toArgb(),
    gold = c.accentGold.toArgb(), labelBg = c.bgSurface.toArgb(), labelFg = c.textPrimary.toArgb(), labelBorder = c.borderSubtle.toArgb())
}
