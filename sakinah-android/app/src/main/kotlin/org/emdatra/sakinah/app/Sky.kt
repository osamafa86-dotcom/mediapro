package org.emdatra.sakinah.app

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.emdatra.sakinah.app.ui.StarLattice
import org.emdatra.sakinah.core.Res
import org.emdatra.sakinah.core.SkyDisc
import org.emdatra.sakinah.core.SkyInk
import org.emdatra.sakinah.core.SkyPalette
import org.emdatra.sakinah.core.SkyPhase
import org.emdatra.sakinah.core.SkyRGB
import org.emdatra.sakinah.core.SkyState
import org.emdatra.sakinah.core.SkyWeather
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.sin

// سماء الرئيسية على أندرويد: خدمة الطقس، وجسور Compose للوحة، وخلفية السماء بطبقاتها.
// المنطق (الأطوار والألوان) في core/Sky.kt؛ هنا الرسم والشبكة فقط — مرآة SkyKit.swift.

/** الطقس من Open-Meteo: بلا مفتاح ولا حساب، إحداثيات مقرّبة إلى ~١ كم، مرّةً كل ساعة، ولا يُستدعى إلا إن فعّله المستخدم */
object SkyWeatherService {
  var current by mutableStateOf<SkyWeather?>(null); private set
  private var updatedAt = 0L; private var key: String? = null; private var inflight = false; private var restored = false
  private const val UA = "Sakinah/5.1 (+https://github.com/osamafa86-dotcom/mediapro)"
  @Serializable private data class Cache(val key: String, val at: Long, val weather: String)

  fun cellKey(lat: Double, lon: Double): String = String.format(java.util.Locale.US, "%.2f,%.2f", lat, lon)

  private fun restore() {
    if (restored) return; restored = true
    val c = Store.skyWeatherCache?.let { runCatching { Res.json.decodeFromString(Cache.serializer(), it) }.getOrNull() } ?: return
    if (System.currentTimeMillis() - c.at < 3 * 3600_000L) { current = SkyWeather.of(c.weather); updatedAt = c.at; key = c.key }
  }

  suspend fun refreshIfNeeded(lat: Double, lon: Double) {
    restore()
    val k = cellKey(lat, lon)
    if (inflight) return
    if (current != null && key == k && System.currentTimeMillis() - updatedAt < 3600_000L) return
    inflight = true
    try {
      val w = withContext(Dispatchers.IO) { fetch(lat, lon) }
      current = w; updatedAt = System.currentTimeMillis(); key = k
      Store.skyWeatherCache = Res.json.encodeToString(Cache.serializer(), Cache(k, updatedAt, w.id)); Store.save()
    } catch (e: Exception) { /* بلا شبكة: تبقى آخر قراءة أو لا شيء */ } finally { inflight = false }
  }

  private fun get(url: String): String {
    val c = URL(url).openConnection() as HttpURLConnection
    c.connectTimeout = 10_000; c.readTimeout = 12_000; c.setRequestProperty("User-Agent", UA)
    if (c.responseCode !in 200..299) error("HTTP ${c.responseCode}")
    return c.inputStream.bufferedReader().readText()
  }

  private fun fetch(lat: Double, lon: Double): SkyWeather {
    val la = String.format(java.util.Locale.US, "%.2f", Math.round(lat * 100) / 100.0)
    val lo = String.format(java.util.Locale.US, "%.2f", Math.round(lon * 100) / 100.0)
    val body = get("https://api.open-meteo.com/v1/forecast?latitude=$la&longitude=$lo&current=weather_code,cloud_cover&timezone=auto")
    val cur = Res.json.parseToJsonElement(body).jsonObject["current"]?.jsonObject ?: error("no current")
    val code = cur["weather_code"]?.jsonPrimitive?.intOrNull ?: 0
    val cloud = cur["cloud_cover"]?.jsonPrimitive?.intOrNull ?: 0
    // الغبار من واجهة جودة الهواء نفسها (اختياري؛ فشله لا يعطّل الطقس)
    val dust = runCatching { Res.json.parseToJsonElement(get("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=$la&longitude=$lo&current=dust")).jsonObject["current"]?.jsonObject?.get("dust")?.jsonPrimitive?.doubleOrNull }.getOrNull()
    return SkyWeather.from(code, cloud, dust)
  }
}

// ---- جسور Compose
fun SkyRGB.toColor(): Color = Color(r.toFloat(), g.toFloat(), b.toFloat())
val SkyPalette.isDark: Boolean get() = ink == SkyInk.PAPER
/** نصّ فوق السماء: ورق على الداكنة، حبر على الفاتحة */
val SkyPalette.text: Color get() = if (isDark) Color(0xFFFBF9F4) else Color(0xFF16211F)
val SkyPalette.textMuted: Color get() = text.copy(alpha = 0.62f)
val SkyPalette.textSoft: Color get() = text.copy(alpha = 0.86f)
val SkyPalette.glass: Color get() = if (isDark) Color.White.copy(alpha = 0.10f) else Color.Black.copy(alpha = 0.06f)
val SkyPalette.glassStroke: Color get() = if (isDark) Color.White.copy(alpha = 0.16f) else Color.Black.copy(alpha = 0.08f)
/** ذهب الإشارات: يبقى ذهبًا على الداكن ويصير ذهبًا قويًّا على الفاتح كي يُقرأ */
val SkyPalette.gold: Color get() = if (isDark) Color(0xFFE2C77A) else Color(0xFFA47E2C)
val SkyPalette.mint: Color get() = if (isDark) Color(0xFF7BE0CF) else Color(0xFF0E5C55)
fun SkyPalette.brush(): Brush = Brush.verticalGradient(stops.map { it.toColor() })

/** التدرّج، نقش النجوم الثمانية، النجوم الحقيقية ليلًا، وهج الأفق، القرص، وطبقات الطقس (ساكنة عند تقليل الحركة) */
@Composable fun SkyBackdrop(state: SkyState, reduceMotion: Boolean, modifier: Modifier = Modifier) {
  val p = state.palette
  val d = state.dominant
  val starry = p.isDark && (d == SkyPhase.NIGHT || d == SkyPhase.SAHAR || d == SkyPhase.SHAFAQ) && (state.weather == SkyWeather.CLEAR || state.weather == SkyWeather.PARTLY_CLOUDY)
  val tr = rememberInfiniteTransition(label = "sky")
  val drift by tr.animateFloat(-1f, 1f, infiniteRepeatable(tween(48_000, easing = LinearEasing), RepeatMode.Reverse), label = "drift")
  val fall by tr.animateFloat(0f, 1f, infiniteRepeatable(tween(2_200, easing = LinearEasing), RepeatMode.Restart), label = "fall")
  val snow by tr.animateFloat(0f, 1f, infiniteRepeatable(tween(9_000, easing = LinearEasing), RepeatMode.Restart), label = "snow")
  val kDrift = if (reduceMotion) 0f else drift; val kFall = if (reduceMotion) 0f else fall; val kSnow = if (reduceMotion) 0f else snow
  Box(modifier.clipToBounds()) {
    Canvas(Modifier.fillMaxSize()) { drawRect(p.brush()) }
    StarLattice(Modifier.fillMaxSize().alpha(if (p.isDark) 0.07f else 0.045f), tint = if (p.isDark) Color.White else Color.Black)
    Canvas(Modifier.fillMaxSize()) {
      if (starry) drawStars(if (d == SkyPhase.SHAFAQ) 0.45f else 0.8f)
      drawGlow(p)
      drawDisc(p)
      drawWeather(state.weather, kDrift, kFall, kSnow)
    }
  }
}

private fun DrawScope.drawStars(alpha: Float) {
  for (i in 0 until 28) {
    val x = ((i * 53 + 7 * 17) % 397) / 397f * size.width
    val y = ((i * 31 + 7 * 7) % 211) / 211f * size.height * 0.55f
    val r = (0.7f + (i % 3) * 0.55f).dp.toPx()
    drawCircle(Color.White.copy(alpha = (if (i % 4 == 0) 0.9f else 0.55f) * alpha), r, Offset(x, y))
  }
}

private fun DrawScope.drawGlow(p: SkyPalette) {
  val c = p.glow.toColor()
  val center = Offset(size.width / 2, if (p.disc == SkyDisc.SUN_HIGH) -size.height * 0.05f else size.height * 0.98f)
  val radius = size.width * 0.75f
  drawCircle(Brush.radialGradient(listOf(c.copy(alpha = p.glowOpacity.toFloat()), Color.Transparent), center = center, radius = radius), radius, center)
}

/** قرص الشمس/القمر بحسب الطور — في الجهة اليسرى فوق الميدالية بعيدًا عن النصّ */
private fun DrawScope.drawDisc(p: SkyPalette) {
  fun sun(d: Float, at: Offset) {
    val halo = d * 1.9f
    drawCircle(Brush.radialGradient(listOf(Color(0xFFFFD27A).copy(alpha = 0.55f), Color.Transparent), center = at, radius = halo), halo, at)
    drawCircle(Color(0xFFFFF3C4), d / 2, at)
  }
  when (p.disc) {
    SkyDisc.NONE -> {}
    SkyDisc.MOON -> {
      val at = Offset(size.width * 0.14f, size.height * 0.16f); val d = 26.dp.toPx()
      drawCircle(Brush.radialGradient(listOf(Color(0xFFF3DFA0).copy(alpha = 0.5f), Color.Transparent), center = at, radius = d * 1.5f), d * 1.5f, at)
      drawCircle(Color(0xFFF3DFA0), d / 2, at)
      drawCircle(p.stops[1].toColor(), d * 0.42f, at + Offset(9.dp.toPx(), -4.dp.toPx()))
    }
    SkyDisc.SUN_HIGH -> sun(34.dp.toPx(), Offset(size.width * 0.30f, size.height * 0.11f))
    SkyDisc.SUN -> sun(30.dp.toPx(), Offset(size.width * 0.27f, size.height * 0.24f))
    SkyDisc.SUN_LOW -> sun(30.dp.toPx(), Offset(size.width * 0.30f, size.height * 0.60f))
  }
}

/** غيمة من خمس بيضاويات متراكبة (رسم Figma) */
private fun DrawScope.drawCloud(x: Float, y: Float, w: Float, alpha: Float) {
  val parts = listOf(floatArrayOf(0f, 0.35f, 0.45f), floatArrayOf(0.28f, 0.12f, 0.6f), floatArrayOf(0.55f, 0.25f, 0.5f), floatArrayOf(0.15f, 0.5f, 0.5f), floatArrayOf(0.5f, 0.48f, 0.5f))
  for (q in parts) drawOval(Color.White.copy(alpha = alpha), Offset(x + w * q[0], y + w * q[1] * 0.9f - w * q[2] * 0.3f), Size(w * q[2], w * q[2] * 0.75f))
}

private fun DrawScope.drawWeather(kind: SkyWeather, drift: Float, fall: Float, snow: Float) {
  val w = size.width; val h = size.height; val dx = drift * 12.dp.toPx()
  when (kind) {
    SkyWeather.CLEAR -> {}
    SkyWeather.PARTLY_CLOUDY -> { drawCloud(w * 0.10f + dx, h * 0.10f, 100.dp.toPx(), 0.85f); drawCloud(w * 0.62f - dx, h * 0.26f, 78.dp.toPx(), 0.7f) }
    SkyWeather.OVERCAST -> { drawCloud(-w * 0.05f + dx, h * 0.02f, 150.dp.toPx(), 0.5f); drawCloud(w * 0.45f - dx, -h * 0.02f, 170.dp.toPx(), 0.45f); drawCloud(w * 0.25f + dx, h * 0.20f, 120.dp.toPx(), 0.3f) }
    SkyWeather.RAIN -> {
      drawCloud(dx, -h * 0.02f, 160.dp.toPx(), 0.3f); drawCloud(w * 0.5f - dx, 0f, 150.dp.toPx(), 0.28f)
      for (i in 0 until 22) {
        val len = (12 + (i % 3) * 5).dp.toPx()
        val x0 = i * (w / 21) + ((i * 7) % 11).dp.toPx()
        val y0 = ((((i * 37) % 100) / 100f + fall) % 1f) * (h + 40.dp.toPx()) - 20.dp.toPx()
        drawLine(Color.White.copy(alpha = 0.28f), Offset(x0, y0), Offset(x0 - len * 0.32f, y0 + len), 1.5.dp.toPx(), StrokeCap.Round)
      }
    }
    SkyWeather.DUST -> {
      val top = h * 0.36f
      drawRect(Brush.verticalGradient(listOf(Color.Transparent, Color(0xFFE8DCC8).copy(alpha = 0.45f), Color(0xFFE8DCC8).copy(alpha = 0.45f), Color(0xFFE8DCC8).copy(alpha = 0.25f)), startY = top, endY = h), Offset(0f, top), Size(w, h - top))
    }
    SkyWeather.SNOW -> {
      drawCloud(dx, -h * 0.02f, 160.dp.toPx(), 0.35f); drawCloud(w * 0.5f - dx, 0f, 150.dp.toPx(), 0.3f)
      for (i in 0 until 26) {
        val r = (1.5f + (i % 3) * 0.9f).dp.toPx()
        val x = ((i * 41) % 200) / 200f * w + sin(snow * Math.PI.toFloat() * 2 + i) * 6.dp.toPx()
        val y = ((((i * 23) % 140) / 140f + snow) % 1f) * (h + 10.dp.toPx()) - 5.dp.toPx()
        drawCircle(Color.White.copy(alpha = 0.85f), r, Offset(x, y))
      }
    }
  }
}
