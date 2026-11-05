package org.emdatra.sakinah.app.ui

import android.Manifest
import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.emdatra.sakinah.app.Fmt
import org.emdatra.sakinah.app.Loc
import org.emdatra.sakinah.app.Notify
import org.emdatra.sakinah.app.ScreenshotMode
import org.emdatra.sakinah.app.Store
import org.emdatra.sakinah.core.*
import java.time.Instant
import java.time.ZoneId
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * القبلة كاملةً (المرحلة الخامسة — qibla-compass/sun/map.png): شريطٌ علويّ (الموقع، العنوان، الإغلاق)، ومبدّلٌ ثلاثيّ
 * «البوصلة | الشمس | الخريطة». كل الحساب على الجهاز؛ والخريطة وحدها تحمّل بلاطاتها من OpenStreetMap.
 */
@Composable fun QiblaScreen(onClose: (() -> Unit)? = null) {
  androidx.activity.compose.BackHandler(enabled = onClose != null) { onClose?.invoke() }
  val ctx = LocalContext.current
  val c = DS.c
  val coords = Store.coords
  var tab by rememberSaveable { mutableIntStateOf(ScreenshotMode.qiblaTab) }
  var info by remember { mutableStateOf(false) }
  var accuracy by remember { mutableStateOf<Float?>(null) }
  val scope = rememberCoroutineScope()
  val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { g ->
    if (g.values.any { it }) scope.launch { Loc.current(ctx)?.let { l -> if (l.hasAccuracy()) accuracy = l.accuracy; Loc.apply(ctx, l); Notify.schedule(ctx) } }
  }
  fun refreshLocation() {
    if (Loc.granted(ctx)) scope.launch { Loc.current(ctx)?.let { l -> if (l.hasAccuracy()) accuracy = l.accuracy; Loc.apply(ctx, l); Notify.schedule(ctx) } }
    else permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
  }
  // دقّة الموضع الحاليّ (من آخر قراءةٍ على الجهاز، بلا شبكة) متى كانت المواقيت من الجهاز نفسه
  LaunchedEffect(coords) {
    if (coords != null && Store.locMode == "gps" && !ScreenshotMode.active && Loc.granted(ctx)) Loc.current(ctx)?.let { l ->
      if (l.hasAccuracy() && Qibla.distanceSphericalKm(l.latitude, l.longitude, coords.latitude, coords.longitude) < 2.0) accuracy = l.accuracy
    }
  }

  Column(Modifier.fillMaxSize().background(c.bgCanvas)) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
      DSIconButton(Icons.Outlined.LocationOn, contentDescription = "تحديث الموقع", size = 44.dp) { refreshLocation() }
      Text("القبلة", Modifier.weight(1f), style = DSType.headingLg, color = c.textPrimary, textAlign = TextAlign.Center)
      if (onClose != null) DSIconButton(Icons.Filled.Close, contentDescription = "إغلاق", size = 44.dp, onClick = onClose) else Spacer(Modifier.size(44.dp))
    }
    if (coords == null) {
      Column(Modifier.fillMaxWidth().padding(16.dp, 48.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        DSIconButton(Icons.Outlined.LocationOff, style = IconStyle.Soft, size = 64.dp, iconSize = 26.dp)
        Spacer(Modifier.height(14.dp))
        Text("حدّد موقعك لعرض اتجاه القبلة", style = DSType.headingSm, color = c.textPrimary)
        Spacer(Modifier.height(6.dp))
        Text("يُحسب الاتجاه على جهازك من إحداثياتك، ولا تُرسل إلى أي خادم.", style = DSType.bodySm, color = c.textSecondary, textAlign = TextAlign.Center)
        Spacer(Modifier.height(16.dp))
        DSButton("تحديد الموقع", icon = Icons.Outlined.MyLocation) { refreshLocation() }
      }
      return@Column
    }
    // في النوافذ العريضة: عمودٌ مقروء في الوسط
    Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.TopCenter) {
      Column(Modifier.widthIn(max = 560.dp).fillMaxSize()) {
        DSSegmented(listOf("البوصلة", "الشمس", "الخريطة"), tab, Modifier.padding(horizontal = 16.dp).padding(top = 6.dp, bottom = 10.dp)) { tab = it }
        Box(Modifier.fillMaxWidth().weight(1f)) {
          when (tab) {
            0 -> CompassTab(coords, accuracy) { info = true }
            1 -> SunTab(coords) { info = true }
            else -> MapTab(coords) { info = true }
          }
        }
      }
    }
  }
  if (info) QiblaInfoSheet { info = false }
}

/** رابط «عن الحساب» الصغير تحت كل تبويب — يفتح شرح طريقة الحساب ومصادره */
@Composable private fun AboutLink(onInfo: () -> Unit) {
  val c = DS.c
  Row(Modifier.heightIn(min = 44.dp).clip(CircleShape).clickable(role = Role.Button, onClick = onInfo).padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
    Icon(Icons.Outlined.Info, null, Modifier.size(15.dp), tint = c.brandPrimary); Spacer(Modifier.width(6.dp))
    Text("عن الحساب", style = DSType.labelSm, color = c.brandPrimary)
  }
}

private fun daysAhead(n: Int) = when { n <= 1 -> "غداً"; n == 2 -> "بعد يومين"; n % 100 in 3..10 -> "بعد ${Fmt.number(n)} أيام"; else -> "بعد ${Fmt.number(n)} يوماً" }
private fun meters(n: Int) = when { n == 1 -> "متراً واحداً"; n == 2 -> "مترين"; n % 100 in 3..10 -> "${Fmt.number(n)} أمتار"; else -> "${Fmt.number(n)} متراً" }

// MARK: البوصلة
@Composable private fun CompassTab(coords: Coordinates, accuracy: Float?, onInfo: () -> Unit) {
  val ctx = LocalContext.current; val c = DS.c
  val shot = ScreenshotMode.active
  // لقطات المتجر: المحاكي بلا بوصلة (0° دائماً)، فتُثبَّت الإبرة على القبلة وتُقرأ الحالة «متّجه»
  var heading by remember { mutableFloatStateOf(if (shot) ((Qibla.info(coords.latitude, coords.longitude).bearing - Geomag.declination(coords.latitude, coords.longitude) + 360.0) % 360.0).toFloat() else 0f) }
  var sensorAccuracy by remember { mutableIntStateOf(if (shot) 3 else -1) }
  var live by remember { mutableStateOf(shot) }
  DisposableEffect(Unit) {
    val sm = ctx.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    val sensor = sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
    val l = object : SensorEventListener {
      val r = FloatArray(9); val o = FloatArray(3)
      override fun onSensorChanged(e: SensorEvent) {
        SensorManager.getRotationMatrixFromVector(r, e.values); SensorManager.getOrientation(r, o)
        heading = ((Math.toDegrees(o[0].toDouble()).toFloat()) + 360) % 360; live = true
      }
      override fun onAccuracyChanged(s: Sensor?, a: Int) { sensorAccuracy = a }
    }
    if (sensor != null && !shot) sm.registerListener(l, sensor, SensorManager.SENSOR_DELAY_UI)
    onDispose { sm.unregisterListener(l) }
  }
  val qibla = remember(coords) { Qibla.info(coords.latitude, coords.longitude) }
  val decl = remember(coords) { Geomag.declination(coords.latitude, coords.longitude) }
  val trueHeading = Geomag.magneticToTrue(heading.toDouble(), decl)
  val diff = Qibla.signedDifference(qibla.bearing, trueHeading)
  val aligned = live && abs(diff) <= 3
  val lowAccuracy = sensorAccuracy in 0..1

  Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp, 0.dp, 16.dp, 28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
    val statusText = when {
      !live -> "حرّك الهاتف على شكل ٨ لمعايرة البوصلة"
      aligned -> "متّجه نحو القبلة، ثبّت الهاتف مستوياً"
      diff > 0 -> "أدر الهاتف يميناً ${Fmt.decimal(abs(diff), 0)}°"
      else -> "أدر الهاتف يساراً ${Fmt.decimal(abs(diff), 0)}°"
    }
    val statusIcon: ImageVector = when { !live -> Icons.Outlined.Autorenew; aligned -> Icons.Filled.Check; diff > 0 -> Icons.Outlined.TurnRight; else -> Icons.Outlined.TurnLeft }
    val statusBg = if (aligned) c.brandSoft else if (lowAccuracy) c.accentGoldSoft else c.bgSubtle
    val statusFg = if (aligned) c.brandStrong else if (lowAccuracy) c.accentGoldStrong else c.textSecondary
    Row(Modifier.clip(CircleShape).background(statusBg).padding(horizontal = 16.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
      Text(statusText, style = DSType.labelMd, color = statusFg, maxLines = 1)
      Spacer(Modifier.width(8.dp))
      Icon(statusIcon, null, Modifier.size(17.dp), tint = statusFg)
    }
    Spacer(Modifier.height(18.dp))
    QiblaDial(qibla.bearing, trueHeading, aligned, live)
    Spacer(Modifier.height(18.dp))
    Row(Modifier.fillMaxWidth().height(IntrinsicSize.Max), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
      QiblaMetric("${Fmt.grouped(qibla.distanceKm.roundToInt())} كم", "إلى الكعبة", Modifier.weight(1f).fillMaxHeight())
      QiblaMetric("${Fmt.number(qibla.bearing.roundToInt())}°", "اتجاه القبلة", Modifier.weight(1f).fillMaxHeight())
    }
    Spacer(Modifier.height(12.dp))
    val place = Store.locName ?: "موقعك الحالي"
    val where = when { Store.locMode != "gps" -> "$place، موقع المدينة المختارة"; accuracy != null -> "$place، بدقّة ${meters(accuracy.roundToInt())}"; else -> place }
    DSCard(Modifier.fillMaxWidth(), padding = 16.dp) {
      Text(where, style = DSType.labelMd.copy(fontWeight = FontWeight.SemiBold), color = c.textPrimary, maxLines = 1)
      Text("الانحراف المغناطيسي ${Fmt.decimal(abs(decl), 0)}° ${if (decl >= 0) "شرقاً" else "غرباً"}، يُعوَّض تلقائياً (WMM 2025)", style = DSType.labelXs, color = c.textSecondary)
    }
    Spacer(Modifier.height(12.dp))
    Text("إن اضطربت الإبرة فحرّك الهاتف على شكل ٨ لمعايرة البوصلة، وابتعد عن المعادن والمغانط.", Modifier.fillMaxWidth().padding(horizontal = 4.dp), style = DSType.labelXs, color = if (lowAccuracy) c.warning else c.textSecondary)
    if (qibla.antipodal) { Spacer(Modifier.height(8.dp)); HintBar(Icons.Outlined.ErrorOutline, "أنت قريب جدًا من الكعبة أو في نقطة يتعذّر فيها تحديد اتجاه واحد.", true) }
    Spacer(Modifier.height(6.dp))
    AboutLink(onInfo)
  }
}

@Composable private fun QiblaMetric(value: String, label: String, modifier: Modifier = Modifier) {
  val c = DS.c
  DSCard(modifier, padding = 14.dp, radius = 20.dp) {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
      Text(value, style = DSType.numericLg, color = c.textPrimary, maxLines = 1)
      Text(label, style = DSType.labelXs, color = c.textSecondary)
    }
  }
}

/** قرص البوصلة (qibla-compass.png): إطارٌ بعلامات كل ٥°، حلقةٌ نعناعية، حروف الجهات القائمة، وإبرةٌ من المركز إلى الكعبة باتجاه القبلة */
@Composable private fun QiblaDial(bearing: Double, trueHeading: Double, aligned: Boolean, live: Boolean) {
  val c = DS.c
  val rot by animateFloatAsState(-trueHeading.toFloat(), label = "qibla")
  // عند التوجّه: هالة تنبض حول القرص ونقرة لمسية، ثم نبضة خفيفة مع كل توهّج ما دام متّجهاً
  val pulse by androidx.compose.animation.core.rememberInfiniteTransition(label = "pulse").animateFloat(0f, 1f, androidx.compose.animation.core.infiniteRepeatable(androidx.compose.animation.core.tween(900, easing = androidx.compose.animation.core.FastOutSlowInEasing), androidx.compose.animation.core.RepeatMode.Reverse), label = "p")
  val haptic = androidx.compose.ui.platform.LocalHapticFeedback.current; val view = androidx.compose.ui.platform.LocalView.current
  LaunchedEffect(aligned) {
    if (!aligned) return@LaunchedEffect
    haptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress)
    while (true) { delay(900); view.performHapticFeedback(android.view.HapticFeedbackConstants.CLOCK_TICK) }
  }
  Box(Modifier.size(296.dp).semantics { contentDescription = "قرص البوصلة: القبلة على ${bearing.roundToInt()} درجة من الشمال${if (aligned) "، والهاتف متّجه إليها" else ""}" }, contentAlignment = Alignment.Center) {
    Canvas(Modifier.fillMaxSize()) {
      val ctr = center; val r = size.minDimension / 2 - 4.dp.toPx()
      if (aligned) {
        drawCircle(Brush.radialGradient(listOf(c.brandPrimary.copy(alpha = 0.30f - 0.18f * pulse), Color.Transparent), center = ctr, radius = r * (1.12f + 0.05f * pulse)), r * (1.12f + 0.05f * pulse), ctr)
      }
      drawCircle(c.bgSurface, r, ctr)
      drawCircle(if (aligned) c.brandPrimary.copy(alpha = 0.7f) else c.borderStrong, r, ctr, style = Stroke(1.5.dp.toPx()))
      val ringR = r * 0.70f
      drawCircle(c.brandSoft, ringR, ctr, style = Stroke(20.dp.toPx()))
      rotate(rot, ctr) {
        for (i in 0 until 72) {
          val a = Math.toRadians(i * 5.0); val cardinal = i % 18 == 0; val major = i % 6 == 0
          val len = (if (cardinal) 18f else if (major) 11f else 7f).dp.toPx(); val outer = r - 8.dp.toPx()
          val p1 = Offset(ctr.x + outer * sin(a).toFloat(), ctr.y - outer * cos(a).toFloat())
          val p2 = Offset(ctr.x + (outer - len) * sin(a).toFloat(), ctr.y - (outer - len) * cos(a).toFloat())
          drawLine(if (cardinal) c.textSecondary else c.borderStrong, p1, p2, (if (cardinal) 2.5f else if (major) 1.6f else 1.1f).dp.toPx(), StrokeCap.Round)
        }
        rotate(bearing.toFloat(), ctr) {
          // ذيلٌ رماديّ قصير، ثم الإبرة من المركز إلى الكعبة على الحلقة
          drawLine(c.borderStrong, ctr, Offset(ctr.x, ctr.y + r * 0.42f), 5.dp.toPx(), StrokeCap.Round)
          val tip = Offset(ctr.x, ctr.y - ringR + 8.dp.toPx())
          drawLine(if (aligned) c.brandPrimary else c.brandStrong, ctr, tip, 5.dp.toPx(), StrokeCap.Round)
          val k = 26.dp.toPx(); val kTop = Offset(ctr.x - k / 2, ctr.y - ringR - k / 2)
          drawRoundRect(c.bgInverse.let { if (c.isDark) c.bgCanvas else it }, kTop, androidx.compose.ui.geometry.Size(k, k), androidx.compose.ui.geometry.CornerRadius(4.dp.toPx()))
          if (c.isDark) drawRoundRect(c.accentGold, kTop, androidx.compose.ui.geometry.Size(k, k), androidx.compose.ui.geometry.CornerRadius(4.dp.toPx()), style = Stroke(1.dp.toPx()))
          drawRect(c.accentGold, Offset(kTop.x, kTop.y + k * 0.28f), androidx.compose.ui.geometry.Size(k, 3.5.dp.toPx()))
        }
      }
      drawCircle(c.brandPrimary, 9.dp.toPx(), ctr)
      drawCircle(c.bgSurface, 3.dp.toPx(), ctr)
    }
    // حروف الجهات تدور مع القرص وتبقى قائمة
    for ((i, letter) in listOf("ش", "ق", "ج", "غ").withIndex()) {
      val a = Math.toRadians((i * 90).toDouble() + rot); val rr = 82f
      Text(letter, style = DSType.labelMd.copy(fontWeight = FontWeight.SemiBold), color = if (i == 0) c.danger else c.textTertiary,
        modifier = Modifier.offset(x = (rr * sin(a)).dp, y = (-rr * cos(a)).dp))
    }
    if (!live) Box(Modifier.fillMaxSize(0.98f).clip(CircleShape).background(c.bgCanvas.copy(alpha = 0.45f)))
  }
}

// MARK: الشمس
private val makkahZone: ZoneId = ZoneId.of("Asia/Riyadh")

/** مسار الشمس ليومٍ: عيّنات (لحظة، سمت، ارتفاع) فوق الأفق، كل عشر دقائق */
private class SunPath(val samples: List<Triple<Instant, Double, Double>>) {
  val first get() = samples.firstOrNull()?.first; val last get() = samples.lastOrNull()?.first
  val maxAlt get() = samples.maxOfOrNull { it.third } ?: 0.0
  /** الجهة التي تبلغ فيها الشمس أوجها: جنوبٌ (أغلب نصف الأرض الشماليّ) أو شمال */
  val facesSouth: Boolean get() = samples.maxByOrNull { it.third }?.second?.let { it > 90 && it < 270 } ?: true
}
private fun sunPath(coords: Coordinates, day: CivilDate, zone: ZoneId): SunPath {
  val start = day.localMidnight(zone)
  val s = (0..144).map { start.plusSeconds(it * 600L) }.map { t -> val p = Astro.sunPosition(t, coords.latitude, coords.longitude); Triple(t, p.azimuth, p.altitude) }.filter { it.third > -0.3 }
  return SunPath(s)
}
/** أوّل يومٍ تمرّ فيه الشمس باتجاه القبلة بعد اليوم (حتى ١٢٠ يوماً) — حسابٌ في الخلفية */
private suspend fun nextSunQiblaDay(coords: Coordinates, from: CivilDate, zone: ZoneId): Pair<CivilDate, Instant>? = withContext(Dispatchers.Default) {
  for (i in 1..120) { val d = from.adding(i); val m = Qibla.sunQiblaMoments(coords.latitude, coords.longitude, d, zone).sunAtQibla; if (m != null) return@withContext d to m }
  null
}

@Composable private fun SunTab(coords: Coordinates, onInfo: () -> Unit) {
  val c = DS.c; val ctx = LocalContext.current
  val zone = Store.zone
  var now by remember { mutableStateOf(Instant.now()) }
  LaunchedEffect(Unit) { while (true) { delay(30_000); now = Instant.now() } }
  val today = CivilDate.of(now, zone)
  val moments = remember(coords, today) { Qibla.sunQiblaMoments(coords.latitude, coords.longitude, today, zone) }
  val path = remember(coords, today) { sunPath(coords, today, zone) }
  val sunAt = moments.sunAtQibla
  val passed = sunAt != null && !now.isBefore(sunAt)
  var next by remember(coords, today) { mutableStateOf<Pair<CivilDate, Instant>?>(null) }
  var searched by remember(coords, today) { mutableStateOf(false) }
  LaunchedEffect(coords, today, sunAt == null || passed) { if (sunAt == null || passed) { next = nextSunQiblaDay(coords, today, zone); searched = true } }

  Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp, 0.dp, 16.dp, 28.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
    // البطل الذهبيّ: لحظة اليوم، وما بقي عليها، والرسم، والتعليمة
    Column(Modifier.fillMaxWidth().clip(DS.shapeXl).background(c.accentGoldSoft).padding(18.dp)) {
      if (sunAt != null) {
        Text(if (passed) "اليوم كانت الشمس في اتجاه القبلة تماماً" else "اليوم تكون الشمس في اتجاه القبلة تماماً", style = DSType.labelMd.copy(fontWeight = FontWeight.SemiBold), color = c.accentGoldStrong)
        Spacer(Modifier.height(4.dp))
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
          Text(Fmt.time(sunAt, zone), style = DSType.numericXl, color = c.textPrimary, maxLines = 1)
          Spacer(Modifier.width(12.dp).weight(1f))
          Text(if (passed) "مضت قبل ${Fmt.duration(now.epochSecond - sunAt.epochSecond)}" else "بعد ${Fmt.duration(sunAt.epochSecond - now.epochSecond)}", style = DSType.labelSm, color = c.textSecondary, textAlign = TextAlign.End)
        }
        if (passed) next?.let { (d, t) -> Text("${if (d == today.adding(1)) "وغداً" else "والمرّة القادمة ${Fmt.shortDate(d.key)}"} نحو ${Fmt.time(t, zone)}", style = DSType.labelSm, color = c.textSecondary) }
        Spacer(Modifier.height(10.dp))
        SunDiagram(path, sunAt, coords)
        Spacer(Modifier.height(10.dp))
        Text("قف ووجهك إلى الشمس في هذه اللحظة: أنت متّجه إلى القبلة. لا بوصلة ولا معايرة.", style = DSType.bodySm, color = c.textPrimary)
      } else {
        Text("لا تمرّ الشمس اليوم باتجاه القبلة في موقعك", style = DSType.labelMd.copy(fontWeight = FontWeight.SemiBold), color = c.accentGoldStrong)
        Spacer(Modifier.height(6.dp))
        val n = next
        when {
          n != null -> {
            Text(Fmt.shortDate(n.first.key), style = DSType.numericXl, color = c.textPrimary)
            Text("أقرب يومٍ تبلغ فيه الشمس اتجاه القبلة، نحو ${Fmt.time(n.second, zone)}، ${daysAhead(DayKey.daysBetween(today.key, n.first.key))}", style = DSType.labelSm, color = c.textSecondary)
          }
          searched -> Text("في هذا الموسم لا تبلغ الشمس اتجاه القبلة وهي فوق الأفق في موقعك. البوصلة والخريطة تعطيانك الاتجاه نفسه.", style = DSType.bodySm, color = c.textSecondary)
          else -> Text("نبحث عن أقرب يومٍ تبلغ فيه…", style = DSType.bodySm, color = c.textSecondary)
        }
        Spacer(Modifier.height(10.dp))
        SunDiagram(path, null, coords)
        Spacer(Modifier.height(8.dp))
        Text("في يوم اللحظة: قف ووجهك إلى الشمس، فأنت متّجه إلى القبلة بلا بوصلة ولا معايرة.", style = DSType.bodySm, color = c.textPrimary)
      }
    }
    // الظلّ: حين تكون الشمس في الجهة المقابلة للقبلة يشير ظلّ العمود القائم إليها
    val shadow = moments.shadowAtQibla
    DSCard(Modifier.fillMaxWidth(), padding = 16.dp) {
      Text("متى يشير ظلّ العمود إلى القبلة؟", style = DSType.headingSm, color = c.textPrimary)
      Spacer(Modifier.height(4.dp))
      if (shadow != null) {
        val done = !now.isBefore(shadow)
        Text("اليوم ${Fmt.time(shadow, zone)}${if (done) " (مضى)" else "، بعد ${Fmt.duration(shadow.epochSecond - now.epochSecond)}"}", style = DSType.numericMd, color = c.textPrimary)
        Text("في هذه اللحظة تكون الشمس خلف القبلة تماماً، فظلّ أيّ عمودٍ قائم (أو قلمٍ على أرضٍ مستوية) يمتدّ نحو القبلة.", style = DSType.labelXs, color = c.textSecondary)
      } else Text("لا يحدث في موقعك اليوم: الشمس لا تبلغ الجهة المقابلة للقبلة وهي فوق الأفق.", style = DSType.labelXs, color = c.textSecondary)
    }
    ZenithCard(now)
    AboutLink(onInfo)
  }
}

/** الرسم: خطّ الأفق، قوس الشمس متقطّعاً من شروقها إلى غروبها، الشمس عند لحظة القبلة، وخطّ القبلة من الواقف إليها.
 *  الرسم كما يُرى والوجه إلى جهة أوج الشمس: نحو الجنوب يكون الشرق يساراً والغرب يميناً، ونحو الشمال ينعكس. */
@Composable private fun SunDiagram(path: SunPath, sunAt: Instant?, coords: Coordinates) {
  val c = DS.c
  val south = path.facesSouth
  val t0 = path.first; val t1 = path.last
  Column(Modifier.fillMaxWidth()) {
    Canvas(Modifier.fillMaxWidth().height(150.dp).semantics { contentDescription = "رسم مسار الشمس اليوم وخطّ القبلة" }) {
      val pad = 14.dp.toPx(); val base = size.height - 8.dp.toPx(); val top = 18.dp.toPx()
      val w = size.width
      drawLine(c.accentGold, Offset(0f, base), Offset(w, base), 1.5.dp.toPx())
      if (t0 == null || t1 == null || t1 == t0) return@Canvas
      val span = (t1.epochSecond - t0.epochSecond).toFloat()
      val maxAlt = path.maxAlt.coerceAtLeast(5.0)
      fun xOf(t: Instant): Float { val f = ((t.epochSecond - t0.epochSecond) / span).coerceIn(0f, 1f); val x = pad + f * (w - 2 * pad); return if (south) x else w - x }
      fun yOf(alt: Double): Float = base - ((alt.coerceAtLeast(0.0) / maxAlt).toFloat() * (base - top))
      val arc = Path()
      path.samples.forEachIndexed { i, (t, _, alt) -> val p = Offset(xOf(t), yOf(alt)); if (i == 0) arc.moveTo(p.x, p.y) else arc.lineTo(p.x, p.y) }
      drawPath(arc, c.accentGoldStrong.copy(alpha = 0.75f), style = Stroke(1.6.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(6.dp.toPx(), 5.dp.toPx()))))
      val observer = Offset(w / 2, base)
      if (sunAt != null) {
        val alt = Astro.sunPosition(sunAt, coords.latitude, coords.longitude).altitude
        val sun = Offset(xOf(sunAt), yOf(alt))
        drawLine(c.brandPrimary, observer, sun, 3.dp.toPx(), StrokeCap.Round)
        drawCircle(c.accentGold.copy(alpha = 0.35f), 17.dp.toPx(), sun)
        drawCircle(c.accentGold, 11.dp.toPx(), sun)
      }
      drawCircle(c.brandPrimary, 6.dp.toPx(), observer)
    }
    Spacer(Modifier.height(6.dp))
    // الوسوم بمواضعها الفعلية: الأوّل في الصفّ (يميناً في العربية) هو جهة الغرب حين يكون الوجه إلى الجنوب
    Row(Modifier.fillMaxWidth()) {
      Text(if (south) "الغرب" else "الشرق", style = DSType.labelXs, color = c.textSecondary)
      Spacer(Modifier.weight(1f))
      Text(if (south) "الجنوب" else "الشمال", style = DSType.labelXs, color = c.textSecondary)
      Spacer(Modifier.weight(1f))
      Text(if (south) "الشرق" else "الغرب", style = DSType.labelXs, color = c.textSecondary)
    }
  }
}

/** «تعامد الشمس على الكعبة»: الموعدان القادمان بتوقيت مكة وبتوقيتك، و«ذكّرني بالموعد القادم» (منبّهٌ قبله بعشر دقائق) */
@Composable private fun ZenithCard(now: Instant) {
  val c = DS.c; val ctx = LocalContext.current
  val year = CivilDate.of(now, makkahZone).year
  val events = remember(year) { (Qibla.kaabaZenithEvents(year) + Qibla.kaabaZenithEvents(year + 1)) }
  val upcoming = events.filter { it.time.isAfter(now) }.take(2)
  val nextEv = upcoming.firstOrNull()
  var note by remember { mutableStateOf<String?>(null) }
  val armed = nextEv != null && Store.zenithReminderAt == nextEv.time.toEpochMilli()
  fun arm() { nextEv?.let { Notify.scheduleZenith(ctx, it.time); note = null } }
  val notifPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok -> if (ok) arm() else note = "اسمح بإشعارات سكينة كي يصلك التذكير." }
  DSCard(Modifier.fillMaxWidth(), padding = 16.dp) {
    Text("تعامد الشمس على الكعبة", style = DSType.headingSm, color = c.textPrimary)
    Spacer(Modifier.height(4.dp))
    Text("مرّتين في السنة تكون الشمس فوق الكعبة تماماً، فاتجاه الشمس من كل مكانٍ يراها هو القبلة.", style = DSType.labelXs, color = c.textSecondary)
    Spacer(Modifier.height(12.dp))
    Row(Modifier.fillMaxWidth().height(IntrinsicSize.Max), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
      upcoming.forEach { ev ->
        val sameClock = Fmt.time(ev.time, makkahZone) == Fmt.time(ev.time, Store.zone)
        Column(Modifier.weight(1f).fillMaxHeight().clip(DS.shapeLg).background(c.bgSubtle).padding(12.dp)) {
          Text(Fmt.shortDate(DayKey.key(ev.time, makkahZone)), style = DSType.headingSm, color = c.textPrimary)
          Text("${Fmt.time(ev.time, makkahZone)} بتوقيت مكة", style = DSType.labelXs, color = c.textSecondary)
          if (!sameClock) {
            val localDay = DayKey.key(ev.time, Store.zone); val mDay = DayKey.key(ev.time, makkahZone)
            Text("${Fmt.time(ev.time, Store.zone)} بتوقيتك${if (localDay != mDay) "، ${Fmt.shortDate(localDay)}" else ""}", style = DSType.labelXs, color = c.textSecondary)
          }
        }
      }
    }
    Spacer(Modifier.height(12.dp))
    if (nextEv != null) {
      Box(Modifier.fillMaxWidth().heightIn(min = 50.dp).clip(DS.shapeLg).background(c.brandSoft).clickable(role = Role.Button, enabled = !armed) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        else arm()
      }.padding(horizontal = 16.dp, vertical = 12.dp), contentAlignment = Alignment.Center) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          if (armed) { Icon(Icons.Filled.Check, null, Modifier.size(16.dp), tint = c.brandStrong); Spacer(Modifier.width(6.dp)) }
          Text(if (armed) "سنذكّرك بالموعد القادم" else "ذكّرني بالموعد القادم", style = DSType.labelMd.copy(fontWeight = FontWeight.SemiBold), color = c.brandStrong)
        }
      }
      val msg = note ?: if (armed) "يصلك إشعارٌ يوم ${Fmt.shortDate(DayKey.key(nextEv.time, Store.zone))} قبل الموعد بعشر دقائق، نحو ${Fmt.time(nextEv.time.minusSeconds(600), Store.zone)} بتوقيتك." else null
      if (msg != null) { Spacer(Modifier.height(8.dp)); Text(msg, style = DSType.labelXs, color = if (note != null) c.warning else c.textSecondary) }
    }
  }
}

// MARK: الخريطة
@Composable private fun MapTab(coords: Coordinates, onInfo: () -> Unit) {
  val c = DS.c
  val qibla = remember(coords) { Qibla.info(coords.latitude, coords.longitude) }
  val dist = qibla.distanceKm.roundToInt()
  Column(Modifier.fillMaxSize().padding(16.dp, 0.dp, 16.dp, 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    Box(Modifier.fillMaxWidth().weight(1f).heightIn(min = 240.dp).clip(DS.shapeXl).background(c.bgSubtle).border(1.dp, c.borderSubtle, DS.shapeXl)) {
      QiblaMap(coords, "أنت، ${Store.locName ?: "موقعك"}", qiblaMapColors(), Modifier.fillMaxSize())
      Text("${Fmt.grouped(dist)} كم إلى الكعبة", Modifier.align(Alignment.TopEnd).padding(12.dp).clip(CircleShape).background(c.brandPrimary).padding(horizontal = 14.dp, vertical = 7.dp), style = DSType.labelSm.copy(fontWeight = FontWeight.SemiBold), color = c.textOnBrand)
      Text("© مساهمو OpenStreetMap", Modifier.align(Alignment.BottomStart).padding(8.dp).clip(RoundedCornerShape(6.dp)).background(c.bgSurface.copy(alpha = 0.85f)).padding(horizontal = 6.dp, vertical = 2.dp), style = DSType.labelXs.copy(fontSize = 9.5.sp), color = c.textSecondary)
    }
    DSCard(Modifier.fillMaxWidth(), padding = 16.dp) {
      Text("أقصر طريقٍ على سطح الأرض", style = DSType.headingSm, color = c.textPrimary)
      Spacer(Modifier.height(4.dp))
      Text("الخطّ المتقطّع هو الدائرة العظمى من موضعك إلى الكعبة، ومنه يُحسب الاتجاه ${Fmt.number(qibla.bearing.roundToInt())}° من الشمال الحقيقي. قد يبدو منحنياً على الخريطة المسطّحة.", style = DSType.labelXs, color = c.textSecondary)
    }
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      Text("الحساب كلّه على جهازك؛ والخريطة وحدها تُحمَّل من OpenStreetMap، وبلا اتصالٍ يبقى الخطّ والمسافة.", Modifier.weight(1f), style = DSType.labelXs, color = c.textTertiary)
      AboutLink(onInfo)
    }
  }
}

@Composable fun HintBar(icon: ImageVector, text: String, warn: Boolean) {
  val c = DS.c
  Row(
    Modifier.fillMaxWidth().clip(DS.shapeMd).background(c.bgSubtle).padding(12.dp),
    verticalAlignment = Alignment.CenterVertically
  ) {
    Text(text, style = DSType.labelXs, color = if (warn) c.warning else c.textSecondary, modifier = Modifier.weight(1f))
    Spacer(Modifier.width(8.dp))
    Icon(icon, null, Modifier.size(16.dp), tint = if (warn) c.warning else c.textTertiary)
  }
}

/** شرح طريقة حساب القبلة ومصادرها */
@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun QiblaInfoSheet(onDismiss: () -> Unit) {
  val c = DS.c
  ModalBottomSheet(onDismissRequest = onDismiss, containerColor = c.bgSurface) {
    Column(Modifier.fillMaxWidth().padding(16.dp, 0.dp, 16.dp, 32.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      Text("عن حساب القبلة", style = DSType.headingMd, color = c.textPrimary)
      InfoBlock("كيف يُحسب الاتجاه؟", "يُحسب اتجاه القبلة بخوارزمية Vincenty الجيوديسية على مجسّم WGS‑84، وهي أدق من الحساب الكروي المبسّط، وتُعطي أقصر مسار حقيقي على سطح الأرض إلى الكعبة.")
      InfoBlock("الشمال الحقيقي لا المغناطيسي", "تقرأ البوصلة الشمال المغناطيسي، وبينه وبين الشمال الحقيقي فرق يبلغ درجات في بعض البلدان. نُصحّح القراءة بنموذج الانحراف العالمي WMM 2025.")
      InfoBlock("المعايرة", "إن اضطربت الإبرة أو ظهر تنبيه انخفاض الدقة، حرّك الهاتف في الهواء على شكل رقم ٨ مرّتين أو ثلاثًا، وابتعد عن المعادن والمكبّرات والحوامل المغناطيسية.")
      InfoBlock("الشمس والظلّ", "يُحسب موضع الشمس على جهازك (خوارزميات Meeus) ليومك وموقعك: اللحظة التي يبلغ فيها سمتُها اتجاه القبلة، واللحظة التي تكون فيها خلفها فيشير الظلّ إليها، وموعدا تعامدها على الكعبة في السنة.")
      InfoBlock("الخريطة", "الخطّ والمسافة يُحسبان على جهازك. وبلاطات الخريطة وحدها تُحمَّل من OpenStreetMap حين تفتح هذا التبويب، فيعرف خادمها المنطقةَ المعروضة كما في أيّ خريطة؛ وبلا اتصالٍ يبقى الخطّ والمسافة.")
      InfoBlock("الخصوصية", "كل الحساب يجري على جهازك ولا تُرسل إحداثياتك إلى خادمٍ لنا؛ ولا يتّصل بالشبكة من القبلة إلا تبويب الخريطة لتحميل بلاطاتها.")
    }
  }
}

@Composable private fun InfoBlock(title: String, body: String) {
  val c = DS.c
  DSCard(padding = 16.dp) {
    Text(title, style = DSType.headingSm, color = c.textPrimary)
    Spacer(Modifier.height(6.dp))
    Text(body, style = DSType.bodySm, color = c.textSecondary)
  }
}
