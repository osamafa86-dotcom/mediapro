package org.emdatra.sakinah.app.ui

import android.Manifest
import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.emdatra.sakinah.app.*
import org.emdatra.sakinah.core.*
import java.time.Instant
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

/**
 * الرئيسية (تصميم Figma «٥ · الرئيسية — التصميم النهائي»): ترويسة، بطاقة «الآن» تجمع الصلاة القادمة
 * وبوصلة القبلة في ميدالية واحدة، ثم مواقيت اليوم. القبلة الكاملة تُفتح من الميدالية.
 */
@Composable fun HomeScreen() {
  val ctx = LocalContext.current; val scope = rememberCoroutineScope()
  var now by remember { mutableStateOf(Instant.now()) }
  LaunchedEffect(Unit) { while (true) { delay(1000); now = Instant.now() } }
  var showCity by remember { mutableStateOf(false) }; var showMethod by remember { mutableStateOf(false) }; var showMonth by remember { mutableStateOf(false) }
  var showQibla by rememberSaveable { mutableStateOf(ScreenshotMode.fullQibla) }
  var showMosques by rememberSaveable { mutableStateOf(false) }
  val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { if (it.values.any { g -> g }) scope.launch { Loc.current(ctx)?.let { l -> Loc.apply(ctx, l); Notify.schedule(ctx) } } }
  LaunchedEffect(Unit) { if (Store.coords == null && Store.locMode == "gps") { if (Loc.granted(ctx)) Loc.current(ctx)?.let { Loc.apply(ctx, it); Notify.schedule(ctx) } else permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) } }
  if (showMonth) { MonthScreen(onBack = { showMonth = false }); return }
  if (showQibla) { QiblaScreen(onClose = { showQibla = false }); return }
  if (showMosques) { MosquesScreen(onBack = { showMosques = false }); return }
  val tl = Store.timeline(now); val h = Hijri.date(now, Store.zone, Store.hijriOffset); val coords = Store.coords
  val compass = rememberCompass(enabled = coords != null)
  Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(top = 4.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
    HomeHeader(h, now, onMonth = { showMonth = true }, onCity = { showCity = true })
    if (tl == null || coords == null) LocationPrompt(onDevice = { permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) }, onCity = { showCity = true })
    else {
      NowCard(tl, now, coords, compass, onMethod = { showMethod = true }, onQibla = { showQibla = true })
      TodayCard(tl, now, onMonth = { showMonth = true })
      NearestMosqueCard(coords, onAll = { showMosques = true })
    }
  }
  if (showCity) CityPickerSheet(onDismiss = { showCity = false }, onDevice = { showCity = false; permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) })
  if (showMethod) MethodSheet { showMethod = false }
}

/** قراءة البوصلة (متّجه الدوران) ما دامت الشاشة ظاهرة — لا حسّاس في وضع اللقطات (المحاكي يعطي 0° دائمًا) */
class CompassReading(val heading: Float?, val accuracy: Int)
@Composable fun rememberCompass(enabled: Boolean): CompassReading {
  val ctx = LocalContext.current
  var heading by remember { mutableStateOf<Float?>(null) }; var accuracy by remember { mutableIntStateOf(-1) }
  val shot = ScreenshotMode.active
  DisposableEffect(enabled, shot) {
    if (!enabled || shot) return@DisposableEffect onDispose {}
    val sm = ctx.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    val sensor = sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
    val l = object : SensorEventListener {
      val r = FloatArray(9); val o = FloatArray(3)
      override fun onSensorChanged(e: SensorEvent) { SensorManager.getRotationMatrixFromVector(r, e.values); SensorManager.getOrientation(r, o); heading = ((Math.toDegrees(o[0].toDouble()).toFloat()) + 360) % 360 }
      override fun onAccuracyChanged(s: Sensor?, a: Int) { accuracy = a }
    }
    if (sensor != null) sm.registerListener(l, sensor, SensorManager.SENSOR_DELAY_UI)
    onDispose { sm.unregisterListener(l) }
  }
  return CompassReading(heading, accuracy)
}

// MARK: الترويسة
@Composable private fun HomeHeader(h: HijriDate, now: Instant, onMonth: () -> Unit, onCity: () -> Unit) {
  val c = DS.c
  Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
      Text("السَّلامُ عَلَيْكُمْ وَرَحْمَةُ الله", style = DSType.bodySm, color = c.textSecondary)
      Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(Store.locName ?: "حدّد موقعك", style = DSType.displayLg, color = c.textPrimary, maxLines = 1)
        Icon(Icons.Filled.Place, null, Modifier.size(18.dp), tint = c.accentGold)
      }
      Text("${h.weekday} ${Fmt.number(h.day)} ${h.monthName} ${Fmt.number(h.year)}هـ  ·  ${Fmt.gregorian(now).substringAfter("، ").substringBeforeLast(" ")}", style = DSType.labelSm, color = c.textTertiary, maxLines = 1)
    }
    HeaderIcon(Icons.Outlined.CalendarMonth, "الجدول الشهري", onMonth)
    HeaderIcon(if (Store.locMode == "gps") Icons.Outlined.MyLocation else Icons.Outlined.Place, "الموقع", onCity)
  }
}
@Composable private fun HeaderIcon(icon: ImageVector, label: String, onClick: () -> Unit) {
  DSIconButton(icon, Modifier.shadow(8.dp, CircleShape, ambientColor = DS.c.shadow.copy(alpha = 0.08f), spotColor = DS.c.shadow.copy(alpha = 0.1f)), size = 44.dp, iconSize = 18.dp, contentDescription = label, onClick = onClick)
}

// MARK: بطاقة «الآن»: الصلاة القادمة + ميدالية القبلة
@Composable private fun NowCard(tl: PrayerTimes.DayTimeline, now: Instant, coords: Coordinates, compass: CompassReading, onMethod: () -> Unit, onQibla: () -> Unit) {
  val c = DS.c
  val secs = tl.next.time.epochSecond - now.epochSecond
  // بعد منتصف الليل «الحالية» هي عشاء الأمس لا عشاء اليوم (وقتها لم يحن بعد) — وإلا قُرئ التقدّم صفرًا
  val start = tl.times[tl.current]?.takeIf { !it.isAfter(now) } ?: tl.yesterdayIsha
  val total = start?.let { (tl.next.time.epochSecond - it.epochSecond).toFloat() } ?: 0f
  val elapsed = if (start != null && total > 0f) ((now.epochSecond - start.epochSecond) / total).coerceIn(0f, 1f) else 0f
  val qibla = remember(coords) { Qibla.info(coords.latitude, coords.longitude) }
  val decl = remember(coords) { Geomag.declination(coords.latitude, coords.longitude) }
  // المحاكي بلا مغناطيسية: في وضع اللقطات وحده يُفترض اتجاهٌ يطابق القبلة
  val trueHeading: Double? = if (ScreenshotMode.active) qibla.bearing else compass.heading?.let { Geomag.magneticToTrue(it.toDouble(), decl) }
  val diff = trueHeading?.let { Qibla.signedDifference(qibla.bearing, it) }
  val aligned = diff != null && abs(diff) <= 3
  val shape = RoundedCornerShape(28.dp)
  Box(Modifier.fillMaxWidth().shadow(24.dp, shape, ambientColor = c.shadow.copy(alpha = 0.25f), spotColor = c.shadow.copy(alpha = 0.3f)).clip(shape)
    .background(Brush.linearGradient(listOf(Color(0xFF11695F), Color(0xFF0B4A43), Color(0xFF05221F))))) {
    // نقش النجمة الثمانية نسيجًا خافتًا، ووهج ذهبي خلف الميدالية (نهاية الصفّ = اليسار)
    StarLattice(Modifier.matchParentSize().alpha(0.07f))
    Box(Modifier.matchParentSize()) { Box(Modifier.align(Alignment.CenterEnd).size(220.dp).background(Brush.radialGradient(listOf(Color(0xFFC69C3E).copy(alpha = 0.22f), Color.Transparent)))) }
    Icon(Icons.Outlined.OpenInFull, null, Modifier.align(Alignment.TopEnd).padding(16.dp).size(14.dp), tint = Color.White.copy(alpha = 0.5f))
    Row(Modifier.fillMaxWidth().padding(start = 20.dp, end = 16.dp, top = 18.dp, bottom = 18.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
      Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
          Text("الصلاة القادمة", style = DSType.labelSm.copy(letterSpacing = 0.4.sp), color = c.textOnDarkMuted)
          Box(Modifier.size(6.dp).clip(CircleShape).background(c.accentGold))
        }
        Text(if (tl.next.isTomorrow) "فجر الغد" else tl.next.key.nameAr, style = DSType.displayHero, color = c.textOnDark, maxLines = 1)
        Text(Fmt.countdown(secs), style = DSType.numericXl, color = c.textOnDark, maxLines = 1)
        Text("الأذان ${Fmt.time(tl.next.time)}", style = DSType.labelXs, color = c.textOnDarkMuted)
        Spacer(Modifier.height(4.dp))
        ProgressTrack(elapsed, height = 4.dp)
        Text("مضى ${Fmt.number((elapsed * 100).toInt())}٪ من وقت ${tl.current.nameAr}", style = DSType.labelXs, color = c.textOnDarkMuted, maxLines = 1)
        Text(Methods.method(Store.methodId).nameAr, Modifier.padding(top = 4.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.09f)).clickable(onClick = onMethod).padding(horizontal = 8.dp, vertical = 3.dp), style = DSType.labelXs.copy(fontSize = 10.5.sp, fontWeight = FontWeight.Normal), color = c.textOnDarkMuted, maxLines = 1)
      }
      Column(Modifier.width(150.dp).clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onQibla), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        CompassMedallion(qibla.bearing, trueHeading ?: 0.0, aligned, live = trueHeading != null, Modifier.size(150.dp))
        QiblaChip(aligned, diff, live = trueHeading != null)
        Text("${Fmt.decimal(qibla.bearing, 0)}°  ·  ${Fmt.decimal(qibla.distanceKm, 0)} كم", style = DSType.labelXs, color = c.textOnDarkMuted, maxLines = 1)
      }
    }
  }
}

@Composable private fun QiblaChip(aligned: Boolean, diff: Double?, live: Boolean) {
  val (text, icon) = when {
    !live -> "حرّك الهاتف على شكل ٨" to Icons.Outlined.Autorenew
    aligned -> "متّجه نحو القبلة" to Icons.Filled.Check
    diff != null && diff > 0 -> "يمينًا ${Fmt.decimal(abs(diff), 0)}°" to Icons.Outlined.TurnRight
    diff != null -> "يسارًا ${Fmt.decimal(abs(diff), 0)}°" to Icons.Outlined.TurnLeft
    else -> "جارٍ القراءة…" to Icons.Outlined.NearMe
  }
  Row(Modifier.clip(CircleShape).background(Color.White.copy(alpha = 0.10f)).border(1.dp, Color.White.copy(alpha = 0.14f), CircleShape).padding(horizontal = 10.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
    Text(text, style = DSType.labelSm, color = Color(0xFFE9F6F3), maxLines = 1)
    Icon(icon, null, Modifier.size(12.dp), tint = if (aligned) Color(0xFF7BE0CF) else DS.c.accentGold)
  }
}

/** ميدالية البوصلة: قرص زجاجي داكن، ٤٨ علامة درجات، حروف الجهات، الكعبة عند رأس إبرة ذهبية متدرّجة، وجوهرة في المركز */
@Composable fun CompassMedallion(bearing: Double, heading: Double, aligned: Boolean, live: Boolean, modifier: Modifier = Modifier) {
  val rot by animateFloatAsState(-heading.toFloat(), label = "medallion")
  val gold = Color(0xFFE2C77A); val dark = Color(0xFF05221F); val mint = Color(0xFF7BE0CF)
  // عند التوجّه: هالة نعناعية تنبض حول القرص ونقرة لمسية — إشارة تُرى بلا قراءة
  val pulse by rememberInfiniteTransition(label = "pulse").animateFloat(0f, 1f, infiniteRepeatable(tween(900, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "p")
  val haptic = LocalHapticFeedback.current; val view = androidx.compose.ui.platform.LocalView.current
  // نقرة عند التوجّه، ثم نبضة خفيفة مع كل توهّج ما دام متّجهًا (طلب المالك: «نبض اهتزاز مع الإضاءة»)
  LaunchedEffect(aligned) {
    if (!aligned) return@LaunchedEffect
    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
    while (true) { kotlinx.coroutines.delay(900); view.performHapticFeedback(android.view.HapticFeedbackConstants.CLOCK_TICK) }
  }
  Box(modifier.alpha(if (live) 1f else 0.5f), contentAlignment = Alignment.Center) {
    Canvas(Modifier.fillMaxSize()) {
      val ctr = center; val r = size.minDimension / 2 - 5.dp.toPx()
      if (aligned) {
        drawCircle(Brush.radialGradient(listOf(mint.copy(alpha = 0.45f - 0.25f * pulse), Color.Transparent), center = ctr, radius = r * (1.3f + 0.08f * pulse)), r * (1.3f + 0.08f * pulse), ctr)
        drawCircle(mint.copy(alpha = 0.95f - 0.6f * pulse), r + 4.dp.toPx() + 3.dp.toPx() * pulse, ctr, style = Stroke(3.dp.toPx()))
      }
      drawCircle(Brush.radialGradient(listOf(Color(0xFF0B4A43).copy(alpha = 0.9f), dark.copy(alpha = 0.95f)), center = ctr, radius = r), r, ctr)
      drawCircle(if (aligned) mint.copy(alpha = 0.8f) else Color.White.copy(alpha = 0.14f), r, ctr, style = Stroke((if (aligned) 1.5f else 1f).dp.toPx()))
      rotate(rot, ctr) {
        for (i in 0 until 48) {
          val major = i % 12 == 0; val mid = i % 4 == 0
          val len = (if (major) 9f else if (mid) 6f else 3.5f).dp.toPx()
          val a = Math.toRadians(i * 7.5); val outer = r - 6.dp.toPx()
          val p1 = Offset(ctr.x + outer * sin(a).toFloat(), ctr.y - outer * cos(a).toFloat())
          val p2 = Offset(ctr.x + (outer - len) * sin(a).toFloat(), ctr.y - (outer - len) * cos(a).toFloat())
          drawLine(if (major) gold.copy(alpha = 0.9f) else Color.White.copy(alpha = if (mid) 0.45f else 0.22f), p1, p2, (if (major) 1.6f else 1f).dp.toPx(), StrokeCap.Round)
        }
        // الوهج والكعبة والإبرة تدور معًا نحو اتجاه القبلة
        rotate(bearing.toFloat(), ctr) {
          drawCircle(Brush.radialGradient(listOf(gold.copy(alpha = 0.35f), Color.Transparent), center = ctr, radius = 35.dp.toPx()), 35.dp.toPx(), ctr)
          val kr = r - 15.dp.toPx(); val kh = 14.dp.toPx(); val kTop = Offset(ctr.x - kh / 2, ctr.y - kr - kh / 2)
          drawRoundRect(dark, kTop, Size(kh, kh), CornerRadius(2.5.dp.toPx()))
          drawRoundRect(gold, kTop, Size(kh, kh), CornerRadius(2.5.dp.toPx()), style = Stroke(1.2.dp.toPx()))
          drawRect(gold, Offset(kTop.x, kTop.y + 4.5.dp.toPx()), Size(kh, 2.5.dp.toPx()))
          val tip = ctr.y - (r - 20.dp.toPx())
          val head = Path().apply { moveTo(ctr.x, tip); lineTo(ctr.x + 8.dp.toPx(), ctr.y); quadraticBezierTo(ctr.x, ctr.y - 5.6.dp.toPx(), ctr.x - 8.dp.toPx(), ctr.y); close() }
          drawPath(head, Brush.verticalGradient(listOf(Color(0xFFF0DFA0), Color(0xFFB98A2E)), startY = tip, endY = ctr.y))
          val tail = Path().apply { moveTo(ctr.x, ctr.y + 34.dp.toPx()); lineTo(ctr.x + 6.dp.toPx(), ctr.y); lineTo(ctr.x - 6.dp.toPx(), ctr.y); close() }
          drawPath(tail, Color.White.copy(alpha = 0.22f))
        }
      }
      drawCircle(dark, 8.dp.toPx(), ctr)
      drawCircle(gold, 8.dp.toPx(), ctr, style = Stroke(2.dp.toPx()))
      drawCircle(Color(0xFFFBF9F4), 2.5.dp.toPx(), ctr)
    }
    // حروف الجهات تدور مع القرص
    for ((i, letter) in listOf("ش", "ق", "ج", "غ").withIndex()) {
      val a = Math.toRadians(i * 90.0 + rot); val rr = 52f
      Text(letter, Modifier.offset(x = (rr * sin(a)).dp, y = (-rr * cos(a)).dp), style = DSType.labelXs.copy(fontSize = 9.5.sp), color = Color.White.copy(alpha = 0.55f))
    }
  }
}

/** نقش النجمة الثمانية: شبكة خفيفة تُقرأ كنسيج لا كزخرفة */
@Composable fun StarLattice(modifier: Modifier = Modifier) {
  Canvas(modifier) {
    val step = 72.dp.toPx(); val r = 29.dp.toPx()
    var y = -30.dp.toPx(); var row = 0
    while (y < size.height + r) {
      var x = (if (row % 2 == 1) 36.dp.toPx() else 0f) - 20.dp.toPx()
      while (x < size.width + r) {
        val p = Path()
        for (i in 0 until 16) {
          val a = i * Math.PI / 8 - Math.PI / 2 + Math.PI / 16
          val rr = if (i % 2 == 0) r else r * 0.72f
          val px = x + r + (rr * cos(a)).toFloat(); val py = y + r + (rr * sin(a)).toFloat()
          if (i == 0) p.moveTo(px, py) else p.lineTo(px, py)
        }
        p.close()
        drawPath(p, Color.White, style = Stroke(1.dp.toPx()))
        x += step
      }
      y += step; row++
    }
  }
}

// MARK: أقرب مسجد
@Composable private fun NearestMosqueCard(coords: Coordinates, onAll: () -> Unit) {
  val c = DS.c; val ctx = LocalContext.current
  var results by remember { mutableStateOf<List<Mosque>>(emptyList()) }
  var loading by remember { mutableStateOf(false) }; var error by remember { mutableStateOf<String?>(null) }
  val key = MosqueFinder.cellKey(coords.latitude, coords.longitude)
  LaunchedEffect(Store.nearbyMosques, key) {
    if (!Store.nearbyMosques) return@LaunchedEffect
    MosqueFinder.cached(coords.latitude, coords.longitude)?.let { results = it; return@LaunchedEffect }
    loading = true; error = null
    MosqueFinder.nearby(coords.latitude, coords.longitude).onSuccess { results = it }.onFailure { error = "تعذّر جلب المساجد — تحقّق من الاتصال" }
    loading = false
  }
  DSCard(Modifier.fillMaxWidth(), padding = 16.dp) {
    DSSectionHead("أقرب مسجد", link = "المساجد القريبة", onLink = onAll)
    Spacer(Modifier.height(10.dp))
    val m = results.firstOrNull()
    when {
      !Store.nearbyMosques -> {
        Text("يعرض أقرب مسجد إليك من OpenStreetMap. يُرسل موقعك مقرّبًا إلى نحو كيلومتر عند البحث، ولا يُحفظ لدينا.", style = DSType.bodySm, color = c.textSecondary)
        Spacer(Modifier.height(10.dp))
        DSButton("اعرض أقرب مسجد", Modifier.fillMaxWidth(), icon = Icons.Outlined.Mosque) { Store.nearbyMosques = true; Store.save() }
      }
      m != null -> Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        DSIconButton(Icons.Outlined.Mosque, style = IconStyle.Soft, size = 42.dp, iconSize = 17.dp)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
          Text(m.name, style = DSType.headingSm, color = c.textPrimary, maxLines = 1)
          Text("${MosqueFinder.distanceLabel(m.distanceKm)} · ${MosqueFinder.walkLabel(m.distanceKm)} · ${Qibla.compassPointAr(m.bearing)}", style = DSType.labelXs, color = c.textSecondary, maxLines = 1)
        }
        DSIconButton(Icons.Outlined.Directions, style = IconStyle.Brand, size = 38.dp, iconSize = 16.dp, contentDescription = "الاتجاهات إلى ${m.name}") { MosqueFinder.openDirections(ctx, m) }
      }
      loading -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) { androidx.compose.material3.CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = c.brandPrimary); Text("جارٍ البحث حولك…", style = DSType.bodySm, color = c.textSecondary) }
      else -> Text(error ?: "لا مساجد ضمن ٣ كم — افتح «المساجد القريبة» للبحث بالاسم", style = DSType.bodySm, color = c.textSecondary)
    }
  }
}

// MARK: مواقيت اليوم
private fun prayerGlyph(p: Prayer): ImageVector = when (p) { Prayer.FAJR -> Icons.Outlined.WbTwilight; Prayer.SUNRISE -> Icons.Outlined.WbSunny; Prayer.DHUHR -> Icons.Outlined.LightMode; Prayer.ASR -> Icons.Outlined.WbSunny; Prayer.MAGHRIB -> Icons.Outlined.WbTwilight; Prayer.ISHA -> Icons.Outlined.DarkMode }

@Composable private fun TodayCard(tl: PrayerTimes.DayTimeline, now: Instant, onMonth: () -> Unit) {
  val c = DS.c; val ctx = LocalContext.current; val shape = RoundedCornerShape(26.dp)
  Column(Modifier.fillMaxWidth().shadow(20.dp, shape, ambientColor = c.shadow.copy(alpha = 0.07f), spotColor = c.shadow.copy(alpha = 0.1f)).clip(shape).background(c.bgSurface).border(1.dp, c.borderSubtle.copy(alpha = 0.7f), shape).padding(top = 16.dp, bottom = 8.dp, start = 12.dp, end = 12.dp)) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp).padding(top = 2.dp, bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
      Text("مواقيت اليوم", style = DSType.displaySm, color = c.textPrimary); Spacer(Modifier.weight(1f))
      Row(Modifier.clip(CircleShape).clickable(onClick = onMonth).padding(4.dp), verticalAlignment = Alignment.CenterVertically) { Text("الجدول الشهري", style = DSType.labelSm, color = c.brandPrimary); Icon(Icons.Filled.ChevronLeft, null, Modifier.size(16.dp), tint = c.brandPrimary) }
    }
    val prayers = Prayer.entries
    prayers.forEachIndexed { i, p ->
      val next = tl.next.key == p && !tl.next.isTomorrow
      PrayerRow(p, tl, now, next, ctx)
      val followingIsNext = i < prayers.size - 1 && tl.next.key == prayers[i + 1] && !tl.next.isTomorrow
      if (i < prayers.size - 1 && !next && !followingIsNext) Box(Modifier.fillMaxWidth().padding(horizontal = 12.dp).height(1.dp).background(c.borderSubtle.copy(alpha = 0.6f)))
    }
  }
}

@Composable private fun PrayerRow(p: Prayer, tl: PrayerTimes.DayTimeline, now: Instant, next: Boolean, ctx: Context) {
  val c = DS.c
  val t = tl.times[p]
  val past = !next && t != null && !t.isAfter(now)
  val remind = Store.reminders.prayers.contains(p.id)
  val ink = if (next) c.brandStrong else if (past) c.textTertiary else c.textPrimary
  val rowMod = if (next) Modifier.background(Brush.horizontalGradient(listOf(c.brandSoft.copy(alpha = 0.35f), c.brandSoft.copy(alpha = 0.75f))), RoundedCornerShape(16.dp)) else Modifier
  Row(Modifier.fillMaxWidth().then(rowMod).padding(horizontal = 10.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
    Box(Modifier.size(34.dp).clip(CircleShape).background(if (next) c.brandPrimary else if (past) c.bgSubtle else c.bgCanvas).then(if (next) Modifier else Modifier.border(1.dp, c.borderSubtle, CircleShape)), contentAlignment = Alignment.Center) {
      Icon(prayerGlyph(p), null, Modifier.size(18.dp), tint = if (next) c.textOnBrand else if (past) c.textTertiary else c.brandPrimary)
    }
    Text(p.nameAr, style = DSType.labelMd.copy(fontSize = 15.5.sp, fontWeight = if (next) FontWeight.SemiBold else FontWeight.Medium), color = ink)
    if (next) DSBadge("القادمة")
    Spacer(Modifier.weight(1f))
    Text(Fmt.time(t), style = DSType.numericMd.copy(fontSize = 15.sp, fontWeight = if (next) FontWeight.SemiBold else FontWeight.Normal), color = ink, maxLines = 1)
    Icon(if (remind) Icons.Outlined.Notifications else Icons.Outlined.NotificationsOff, if (remind) "إيقاف تذكير ${p.nameAr}" else "تفعيل تذكير ${p.nameAr}",
      Modifier.size(30.dp).clip(CircleShape).background(if (next) c.brandPrimary.copy(alpha = 0.12f) else Color.Transparent)
        .clickable { val r = Store.reminders; Store.reminders = r.copy(prayers = if (remind) r.prayers - p.id else r.prayers + p.id); Store.save(); Notify.schedule(ctx) }.padding(7.dp),
      tint = if (remind) (if (next) c.brandPrimary else c.textSecondary) else c.borderStrong)
  }
}
