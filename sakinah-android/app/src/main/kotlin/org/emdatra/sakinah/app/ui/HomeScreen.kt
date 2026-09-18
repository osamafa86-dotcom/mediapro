package org.emdatra.sakinah.app.ui

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
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
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.emdatra.sakinah.app.*
import org.emdatra.sakinah.core.*
import java.time.Instant
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

/**
 * الرئيسية (Figma «٦ · الرئيسية — الحيويّة (v6)» و«٧ · نظام السماء والطقس»): هيرو سماءٍ يتبدّل مع وقت الصلاة
 * (والطقس إن فُعّل) يجمع الصلاة القادمة والقبلة وخطّ اليوم؛ ثم بلاطات وصول سريع عائمة على حافته،
 * وشبكة المواقيت، ومتابعة القراءة، وأقرب مسجد، وأذكار الوقت. مرآة HomeView.swift.
 */
@Composable fun HomeScreen() {
  val ctx = LocalContext.current; val scope = rememberCoroutineScope(); val switchTab = LocalSwitchTab.current
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
  val prefs = Store.skyPrefs
  val sky = homeSkyState(now, tl, prefs, SkyWeatherService.current)
  // الطقس (إن فُعّل): تحديث كل ساعة حول الخلية الحالية، وبلا شبكة في وضع اللقطات
  val cell = coords?.let { SkyWeatherService.cellKey(it.latitude, it.longitude) }
  LaunchedEffect(prefs.weather, prefs.mode, cell) { if (prefs.weather && prefs.mode == SkyMode.AUTO && !ScreenshotMode.active && coords != null) SkyWeatherService.refreshIfNeeded(coords.latitude, coords.longitude) }
  // أيقونات شريط الحالة تتبع السماء: فاتحة على الداكنة، وتعود لسمة التطبيق عند مغادرة الرئيسية
  val view = LocalView.current; val appDark = DS.c.isDark
  DisposableEffect(sky.palette.isDark) {
    val ic = view.context.findActivity()?.let { WindowCompat.getInsetsController(it.window, view) }
    ic?.isAppearanceLightStatusBars = !sky.palette.isDark
    onDispose { ic?.isAppearanceLightStatusBars = !appDark }
  }
  val ready = tl != null && coords != null
  Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
    Box(Modifier.fillMaxWidth()) {
      Hero(sky, prefs.reduceMotion, h, now, tl, coords, compass, onCity = { showCity = true }, onMonth = { showMonth = true }, onBell = { switchTab(AppTab.More) }, onMethod = { showMethod = true }, onQibla = { showQibla = true })
      if (tl != null && coords != null) QuickTiles(tl, now, coords, Modifier.align(Alignment.BottomCenter).padding(horizontal = 20.dp).offset(y = 74.dp),
        onMushaf = { switchTab(AppTab.Mushaf) }, onAdhkar = { switchTab(AppTab.Adhkar) }, onQibla = { showQibla = true }, onMosques = { showMosques = true })
    }
    Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(top = if (ready) 94.dp else 20.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
      if (tl == null || coords == null) LocationPrompt(onDevice = { permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) }, onCity = { showCity = true })
      else {
        PrayerGridCard(tl, now, onMonth = { showMonth = true }, onMethod = { showMethod = true }, onReminders = { switchTab(AppTab.More) })
        ContinueReadingCard(onOpen = { p -> Store.pendingReaderPage = p; switchTab(AppTab.Mushaf) })
        NearestMosqueCard(coords, onAll = { showMosques = true })
        AdhkarCard(tl, now, onOpen = { period -> Store.pendingAdhkarPeriod = period; switchTab(AppTab.Adhkar) })
        Text("يعمل دون اتصال · لا حساب ولا تتبّع", Modifier.fillMaxWidth(), style = DSType.labelXs, color = DS.c.textTertiary, textAlign = TextAlign.Center)
      }
    }
  }
  if (showCity) CityPickerSheet(onDismiss = { showCity = false }, onDevice = { showCity = false; permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) })
  if (showMethod) MethodSheet { showMethod = false }
}

private fun Context.findActivity(): Activity? { var c: Context = this; while (c is ContextWrapper) { if (c is Activity) return c; c = c.baseContext }; return null }

/** التفضيلات، أو ما يفرضه وضع اللقطات (طور/طقس بعينه) للتحقّق البصري من كل حالة */
private fun homeSkyState(now: Instant, tl: PrayerTimes.DayTimeline?, prefs: SkyPrefs, weather: SkyWeather?): SkyState {
  val inputs = tl?.let { SkyInputs.of(it, Store.zone) }
  ScreenshotMode.skyPhase?.let { ph -> val w = ScreenshotMode.skyWeather ?: SkyWeather.CLEAR; return SkyState(ph, null, 0.0, w, SkyPalette.of(ph).weathered(w)) }
  ScreenshotMode.skyWeather?.let { w -> return SkyEngine.state(now, inputs, SkyPrefs(SkyMode.AUTO, weather = true), w).copy(weather = w) }
  return SkyEngine.state(now, inputs, prefs, weather)
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

// MARK: الهيرو
@Composable private fun Hero(sky: SkyState, reduceMotion: Boolean, h: HijriDate, now: Instant, tl: PrayerTimes.DayTimeline?, coords: Coordinates?, compass: CompassReading,
                             onCity: () -> Unit, onMonth: () -> Unit, onBell: () -> Unit, onMethod: () -> Unit, onQibla: () -> Unit) {
  val p = sky.palette
  val shape = RoundedCornerShape(bottomStart = 36.dp, bottomEnd = 36.dp)
  Box(Modifier.fillMaxWidth().clip(shape)) {
    SkyBackdrop(sky, reduceMotion, Modifier.matchParentSize())
    Column(Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.statusBars).padding(start = 20.dp, end = 20.dp, top = 6.dp, bottom = 60.dp)) {
      TopRow(p, h, now, onCity, onMonth, onBell)
      if (tl != null && coords != null) {
        Row(Modifier.fillMaxWidth().padding(top = 10.dp), verticalAlignment = Alignment.Top) {
          NextPrayerBlock(Modifier.weight(1f), tl, now, p, onMethod)
          Spacer(Modifier.width(8.dp))
          MedallionColumn(coords, compass, p, onQibla)
        }
        DayTimelineStrip(tl, now, p, Modifier.fillMaxWidth().padding(top = 14.dp).height(96.dp))
      } else {
        Column(Modifier.padding(top = 24.dp, bottom = 40.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
          Text("حدّد موقعك", style = DSType.displayHero, color = p.text)
          Text("لتُحسب المواقيت والقبلة وتتبدّل السماء مع وقتك", style = DSType.bodyMd, color = p.textMuted)
        }
      }
    }
  }
}

/** التحيّة والمدينة والتاريخ (يمين) وزرّا التنبيهات والتقويم الزجاجيان (يسار) */
@Composable private fun TopRow(p: SkyPalette, h: HijriDate, now: Instant, onCity: () -> Unit, onMonth: () -> Unit, onBell: () -> Unit) {
  val c = DS.c
  Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
      Text("السَّلامُ عَلَيْكُمْ وَرَحْمَةُ الله", style = DSType.readingSm.copy(fontSize = 17.sp), color = if (p.isDark) Color(0xFF9FD1CA) else c.brandStrong)
      Row(Modifier.clip(CircleShape).background(p.glass).border(1.dp, p.glassStroke, CircleShape).clickable(onClick = onCity).padding(start = 12.dp, end = 10.dp, top = 6.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Icon(Icons.Filled.Place, null, Modifier.size(14.dp), tint = p.gold)
        Text(Store.locName ?: "حدّد موقعك", style = DSType.labelSm.copy(fontSize = 13.sp), color = p.text, maxLines = 1)
        Icon(Icons.Filled.KeyboardArrowDown, null, Modifier.size(14.dp), tint = p.textMuted)
      }
      Text("${h.weekday} ${Fmt.number(h.day)} ${h.monthName} ${Fmt.number(h.year)}هـ  ·  ${Fmt.gregorian(now).substringAfter("، ").substringBeforeLast(" ")}", style = DSType.labelSm.copy(fontSize = 12.5.sp, fontWeight = FontWeight.Normal), color = p.textMuted, maxLines = 1)
    }
    GlassIcon(Icons.Outlined.Notifications, "التنبيهات", p, badge = Store.reminders.prayers.isNotEmpty(), onClick = onBell)
    GlassIcon(Icons.Outlined.CalendarMonth, "الجدول الشهري", p, badge = false, onClick = onMonth)
  }
}
@Composable private fun GlassIcon(icon: ImageVector, label: String, p: SkyPalette, badge: Boolean, onClick: () -> Unit) {
  Box(Modifier.size(46.dp).clip(CircleShape).background(p.glass).border(1.dp, p.glassStroke, CircleShape).clickable(onClick = onClick)) {
    Icon(icon, label, Modifier.align(Alignment.Center).size(20.dp), tint = p.textSoft)
    if (badge) Box(Modifier.align(Alignment.TopStart).padding(7.dp).size(9.dp).clip(CircleShape).background(p.gold).border(1.5.dp, p.stops[1].toColor(), CircleShape))
  }
}

/** كتلة الصلاة القادمة: عنوان صغير مع حبّة «بعد…»، اسم الصلاة بالكوفي، العدّ التنازلي الكبير، ثم الأذان وطريقة الحساب */
@Composable private fun NextPrayerBlock(modifier: Modifier, tl: PrayerTimes.DayTimeline, now: Instant, p: SkyPalette, onMethod: () -> Unit) {
  val secs = tl.next.time.epochSecond - now.epochSecond
  val cd = Fmt.countdown(secs)
  Column(modifier, verticalArrangement = Arrangement.spacedBy(2.dp)) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      Box(Modifier.size(6.dp).clip(CircleShape).background(p.gold))
      Text("الصلاة القادمة", style = DSType.labelSm.copy(fontSize = 13.sp, letterSpacing = 0.4.sp), color = p.gold)
      Text(remainingLabel(secs), Modifier.clip(CircleShape).background(p.gold.copy(alpha = 0.16f)).border(1.dp, p.gold.copy(alpha = 0.35f), CircleShape).padding(horizontal = 9.dp, vertical = 3.dp), style = DSType.labelXs.copy(fontSize = 11.5.sp), color = p.gold, maxLines = 1)
    }
    Text(if (tl.next.isTomorrow) "فجر الغد" else tl.next.key.nameAr, Modifier.padding(top = 4.dp), style = DSType.displayHero.copy(fontSize = 52.sp), color = p.text, maxLines = 1)
    Text(cd, style = DSType.numericHero.copy(fontSize = if (cd.length > 5) 44.sp else 52.sp), color = p.text, maxLines = 1, softWrap = false)
    Row(Modifier.padding(top = 2.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
      Text("الأذان ${Fmt.time(tl.next.time)}", style = DSType.labelMd.copy(fontSize = 13.sp), color = p.textSoft, maxLines = 1)
      Text(Methods.method(Store.methodId).nameAr, Modifier.clip(CircleShape).background(p.glass).clickable(onClick = onMethod).padding(horizontal = 8.dp, vertical = 3.dp), style = DSType.labelXs.copy(fontSize = 10.5.sp, fontWeight = FontWeight.Normal), color = p.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
  }
}
private fun remainingLabel(secs: Long): String {
  val m = maxOf(0L, secs / 60)
  if (m < 60) return "بعد ${Fmt.number(maxOf(1L, m).toInt())} دقيقة"
  val hh = (m / 60).toInt(); val r = (m % 60).toInt()
  return if (r == 0) "بعد ${Fmt.number(hh)} س" else "بعد ${Fmt.number(hh)} س و${Fmt.number(r)} د"
}

/** الميدالية وحبّة التوجّه والاتجاه والبعد */
@Composable private fun MedallionColumn(coords: Coordinates, compass: CompassReading, p: SkyPalette, onQibla: () -> Unit) {
  val qibla = remember(coords) { Qibla.info(coords.latitude, coords.longitude) }
  val decl = remember(coords) { Geomag.declination(coords.latitude, coords.longitude) }
  // المحاكي بلا مغناطيسية: في وضع اللقطات وحده يُفترض اتجاهٌ يطابق القبلة
  val trueHeading: Double? = if (ScreenshotMode.active) qibla.bearing else compass.heading?.let { Geomag.magneticToTrue(it.toDouble(), decl) }
  val diff = trueHeading?.let { Qibla.signedDifference(qibla.bearing, it) }
  val aligned = diff != null && abs(diff) <= 3
  Column(Modifier.width(150.dp).clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onQibla), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
    CompassMedallion(qibla.bearing, trueHeading ?: 0.0, aligned, live = trueHeading != null, Modifier.size(140.dp))
    QiblaChip(aligned, diff, live = trueHeading != null, p)
    Text("${Fmt.decimal(qibla.bearing, 1)}° ${Qibla.compassPointAr(qibla.bearing)}  ·  ${Fmt.decimal(qibla.distanceKm, 0)} كم", style = DSType.labelXs.copy(fontSize = 11.sp, fontWeight = FontWeight.Normal), color = p.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
  }
}

@Composable private fun QiblaChip(aligned: Boolean, diff: Double?, live: Boolean, p: SkyPalette) {
  val c = DS.c
  val (text, icon) = when {
    !live -> "حرّك الهاتف على شكل ٨" to Icons.Outlined.Autorenew
    aligned -> "متّجه نحو القبلة" to Icons.Filled.Check
    diff != null && diff > 0 -> "يمينًا ${Fmt.decimal(abs(diff), 0)}°" to Icons.Outlined.TurnRight
    diff != null -> "يسارًا ${Fmt.decimal(abs(diff), 0)}°" to Icons.Outlined.TurnLeft
    else -> "جارٍ القراءة…" to Icons.Outlined.NearMe
  }
  Row(Modifier.clip(CircleShape).background(if (aligned) p.mint.copy(alpha = 0.16f) else p.glass).border(1.dp, if (aligned) p.mint.copy(alpha = 0.45f) else p.glassStroke, CircleShape).padding(horizontal = 12.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
    Text(text, style = DSType.labelSm.copy(fontSize = 12.5.sp), color = if (aligned) (if (p.isDark) Color(0xFFBFF3EA) else c.brandStrong) else p.textSoft, maxLines = 1)
    Icon(icon, null, Modifier.size(12.dp), tint = if (aligned) p.mint else p.gold)
  }
}

// MARK: خطّ اليوم — ست عقد على مسار أفقي (الفجر يمينًا)، المنقضي ذهبي، والقادمة محلّقة بذهب، وعلامة «الآن» تزحف
@Composable private fun DayTimelineStrip(tl: PrayerTimes.DayTimeline, now: Instant, p: SkyPalette, modifier: Modifier) {
  val prayers = Prayer.entries
  val times = prayers.map { tl.times[it] }
  val nowIndex: Double = run {
    val fajr = times[0]; if (fajr == null || now.isBefore(fajr)) return@run 0.0
    for (k in 0 until prayers.size - 1) {
      val a = times[k]; val b = times[k + 1]
      if (a == null || b == null || !b.isAfter(a)) continue
      if (now.isBefore(b)) return@run k + (now.epochSecond - a.epochSecond).toDouble() / (b.epochSecond - a.epochSecond)
    }
    (prayers.size - 1).toDouble()
  }
  val passedCount = prayers.count { pr -> tl.times[pr]?.let { !it.isAfter(now) } ?: false }
  val isNight = (tl.times[Prayer.MAGHRIB]?.let { !now.isBefore(it) } ?: false) || (tl.times[Prayer.SUNRISE]?.let { now.isBefore(it) } ?: true)
  val start = tl.times[tl.current]?.takeIf { !it.isAfter(now) } ?: tl.yesterdayIsha
  val total = start?.let { (tl.next.time.epochSecond - it.epochSecond).toDouble() } ?: 0.0
  val pct = if (start != null && total > 0) ((now.epochSecond - start.epochSecond) / total).coerceIn(0.0, 1.0) else 0.0
  val elapsedLabel = "مضى ${Fmt.number((pct * 100).toInt())}٪ من وقت ${tl.current.nameAr}"
  val gold = p.gold; val txt = p.text; val nodeBg = p.stops[1].toColor()
  // إحداثيات مطلقة (يسار→يمين) كي لا تنعكس المواضع مع الاتجاه؛ النصوص العربية تُشكَّل كما هي
  CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
    BoxWithConstraints(modifier) {
      val w = maxWidth; val pad = 26.dp; val ty = 40.dp
      val step = (w - pad * 2) / (prayers.size - 1)
      fun x(i: Double): Dp = w - pad - step * i.toFloat()
      val nowX = x(nowIndex)
      Canvas(Modifier.matchParentSize()) {
        val tyPx = ty.toPx()
        drawLine(txt.copy(alpha = 0.18f), Offset(pad.toPx(), tyPx), Offset((w - pad).toPx(), tyPx), 2.dp.toPx(), StrokeCap.Round)
        drawLine(Brush.horizontalGradient(listOf(gold, gold.copy(alpha = 0.55f)), startX = nowX.toPx(), endX = x(0.0).toPx()), Offset(nowX.toPx(), tyPx), Offset(x(0.0).toPx(), tyPx), 3.dp.toPx(), StrokeCap.Round)
        prayers.forEachIndexed { k, pr ->
          val next = tl.next.key == pr && !tl.next.isTomorrow; val passed = k < passedCount
          val ctr = Offset(x(k.toDouble()).toPx(), tyPx)
          if (next) { drawCircle(nodeBg, 7.dp.toPx(), ctr); drawCircle(gold, 7.dp.toPx(), ctr, style = Stroke(2.5.dp.toPx())) }
          else { drawCircle(if (passed) gold else txt.copy(alpha = if (pr == Prayer.SUNRISE) 0.45f else 0.9f), 5.dp.toPx(), ctr); drawCircle(nodeBg, 5.dp.toPx(), ctr, style = Stroke(2.dp.toPx())) }
        }
        drawLine(gold.copy(alpha = 0.8f), Offset(nowX.toPx(), tyPx - 14.dp.toPx()), Offset(nowX.toPx(), tyPx - 6.dp.toPx()), 1.5.dp.toPx())
      }
      prayers.forEachIndexed { k, pr ->
        val next = tl.next.key == pr && !tl.next.isTomorrow
        Column(Modifier.width(step + 4.dp).offset(x = x(k.toDouble()) - (step + 4.dp) / 2, y = ty + 14.dp), horizontalAlignment = Alignment.CenterHorizontally) {
          Text(pr.nameAr, style = DSType.labelXs.copy(fontSize = 11.5.sp, fontWeight = if (next) FontWeight.SemiBold else FontWeight.Medium), color = if (next) gold else txt.copy(alpha = if (pr == Prayer.SUNRISE) 0.5f else 0.9f), maxLines = 1)
          Text(Fmt.time(tl.times[pr]), style = DSType.labelXs.copy(fontSize = 11.sp, fontWeight = FontWeight.Normal), color = txt.copy(alpha = if (next) 0.9f else 0.55f), maxLines = 1)
        }
      }
      // علامة «الآن»: هلال ليلًا وشمس نهارًا مع وهج ذهبي، والعبارة إلى جانبها
      Row(Modifier.offset(x = (nowX - 13.dp).coerceIn(0.dp, w - 150.dp), y = ty - 40.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.size(26.dp).clip(CircleShape).background(p.stops[3].toColor()).border(1.5.dp, gold, CircleShape), contentAlignment = Alignment.Center) {
          Icon(if (isNight) Icons.Filled.DarkMode else Icons.Filled.WbSunny, null, Modifier.size(13.dp), tint = Color(0xFFF3DFA0))
        }
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) { Text(elapsedLabel, style = DSType.labelXs.copy(fontSize = 10.5.sp), color = gold, maxLines = 1) }
      }
    }
  }
}

// MARK: الوصول السريع
@Composable private fun QuickTiles(tl: PrayerTimes.DayTimeline, now: Instant, coords: Coordinates, modifier: Modifier, onMushaf: () -> Unit, onAdhkar: () -> Unit, onQibla: () -> Unit, onMosques: () -> Unit) {
  val page = Store.lastRead?.page ?: 1
  val period = Adhkar.autoPeriod(now, tl.times[Prayer.FAJR], tl.times[Prayer.DHUHR], tl.times[Prayer.ASR], Store.zone)
  val q = remember(coords) { Qibla.info(coords.latitude, coords.longitude) }
  val mosqueSub = if (Store.nearbyMosques) (Loc.mosqueCenter?.let { ctr -> MosqueFinder.cached(ctr.latitude, ctr.longitude)?.firstOrNull()?.let { m -> MosqueFinder.distanceLabel(m.distanceKm) } } ?: "حولك") else "قريب منك"
  Row(modifier, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
    Tile(Icons.Outlined.MenuBook, "المصحف", "ص ${Fmt.number(page)}", Modifier.weight(1f), onMushaf)
    Tile(Icons.Outlined.AutoAwesome, "الأذكار", if (period == "morning") "الصباح" else "المساء", Modifier.weight(1f), onAdhkar)
    Tile(Icons.Outlined.Explore, "القبلة", "${Fmt.decimal(q.bearing, 0)}°", Modifier.weight(1f), onQibla)
    Tile(Icons.Outlined.Mosque, "المساجد", mosqueSub, Modifier.weight(1f), onMosques)
  }
}
@Composable private fun Tile(icon: ImageVector, title: String, sub: String, modifier: Modifier, onClick: () -> Unit) {
  val c = DS.c; val shape = RoundedCornerShape(20.dp)
  Column(modifier.height(106.dp).shadow(14.dp, shape, ambientColor = c.shadow.copy(alpha = 0.10f), spotColor = c.shadow.copy(alpha = 0.14f)).clip(shape).background(c.bgSurface).clickable(onClick = onClick).padding(vertical = 12.dp, horizontal = 4.dp),
    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
    Box(Modifier.size(40.dp).clip(RoundedCornerShape(14.dp)).background(c.brandSoft.copy(alpha = 0.55f)), contentAlignment = Alignment.Center) { Icon(icon, null, Modifier.size(20.dp), tint = c.brandPrimary) }
    Text(title, style = DSType.labelSm.copy(fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold), color = c.textPrimary, maxLines = 1)
    Text(sub, style = DSType.labelXs.copy(fontSize = 10.5.sp, fontWeight = FontWeight.Normal), color = c.textTertiary, maxLines = 1, overflow = TextOverflow.Ellipsis)
  }
}

// MARK: مواقيت اليوم — شبكة ٣×٢
private fun prayerGlyph(p: Prayer): ImageVector = when (p) { Prayer.FAJR -> Icons.Outlined.WbTwilight; Prayer.SUNRISE -> Icons.Outlined.WbSunny; Prayer.DHUHR -> Icons.Outlined.LightMode; Prayer.ASR -> Icons.Outlined.WbSunny; Prayer.MAGHRIB -> Icons.Outlined.WbTwilight; Prayer.ISHA -> Icons.Outlined.DarkMode }

@Composable private fun PrayerGridCard(tl: PrayerTimes.DayTimeline, now: Instant, onMonth: () -> Unit, onMethod: () -> Unit, onReminders: () -> Unit) {
  val c = DS.c; val ctx = LocalContext.current
  DSCard(Modifier.fillMaxWidth(), padding = 16.dp) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      Text("مواقيت اليوم", style = DSType.displaySm.copy(fontSize = 19.sp), color = c.textPrimary); Spacer(Modifier.weight(1f))
      Row(Modifier.clip(CircleShape).clickable(onClick = onMonth).padding(4.dp), verticalAlignment = Alignment.CenterVertically) { Text("الجدول الشهري", style = DSType.labelSm, color = c.brandPrimary); Icon(Icons.Filled.ChevronLeft, null, Modifier.size(16.dp), tint = c.brandPrimary) }
    }
    Spacer(Modifier.height(12.dp))
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
      listOf(listOf(Prayer.FAJR, Prayer.SUNRISE, Prayer.DHUHR), listOf(Prayer.ASR, Prayer.MAGHRIB, Prayer.ISHA)).forEach { row ->
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) { row.forEach { p -> PrayerCell(p, tl, now, ctx, Modifier.weight(1f)) } }
      }
    }
    Spacer(Modifier.height(12.dp))
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      Row(Modifier.clip(CircleShape).background(c.bgSubtle).clickable(onClick = onMethod).padding(horizontal = 10.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(Methods.method(Store.methodId).nameAr, style = DSType.labelXs.copy(fontSize = 11.5.sp), color = c.textSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.widthIn(max = 190.dp))
        Icon(Icons.Filled.KeyboardArrowDown, null, Modifier.size(12.dp), tint = c.textSecondary)
      }
      Spacer(Modifier.weight(1f))
      Row(Modifier.clip(CircleShape).clickable(onClick = onReminders).padding(4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        Icon(Icons.Outlined.Notifications, null, Modifier.size(13.dp), tint = c.textTertiary)
        Text("التنبيهات ${Fmt.number(Store.reminders.prayers.size)} من ٦", style = DSType.labelXs.copy(fontSize = 11.5.sp, fontWeight = FontWeight.Normal), color = c.textTertiary)
      }
    }
  }
}

@Composable private fun PrayerCell(p: Prayer, tl: PrayerTimes.DayTimeline, now: Instant, ctx: Context, modifier: Modifier) {
  val c = DS.c
  val next = tl.next.key == p && !tl.next.isTomorrow
  val t = tl.times[p]; val past = !next && t != null && !t.isAfter(now)
  val remind = Store.reminders.prayers.contains(p.id)
  val shape = RoundedCornerShape(16.dp)
  val fg = if (next) c.textOnBrand else if (past) c.textTertiary else c.textPrimary
  Box(modifier.then(if (next) Modifier.shadow(12.dp, shape, ambientColor = c.brandPrimary.copy(alpha = 0.35f), spotColor = c.brandPrimary.copy(alpha = 0.35f)) else Modifier)
    .clip(shape).background(if (next) c.brandPrimary else c.bgCanvas)
    .clickable { val r = Store.reminders; Store.reminders = r.copy(prayers = if (remind) r.prayers - p.id else r.prayers + p.id); Store.save(); Notify.schedule(ctx) }
    .padding(vertical = 10.dp, horizontal = 6.dp)) {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
      Icon(prayerGlyph(p), null, Modifier.size(20.dp), tint = if (next) c.textOnBrand else if (past) c.textTertiary else c.brandPrimary)
      Text(p.nameAr, style = DSType.labelSm.copy(fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold), color = fg, maxLines = 1)
      Text(Fmt.time(t), style = DSType.labelSm.copy(fontSize = 12.sp), color = if (next) c.textOnBrand.copy(alpha = 0.9f) else if (past) c.textTertiary else c.textSecondary, maxLines = 1)
    }
    if (next) Text("القادمة", Modifier.align(Alignment.TopStart).clip(CircleShape).background(c.accentGold).padding(horizontal = 8.dp, vertical = 2.dp), style = DSType.labelXs.copy(fontSize = 10.sp, fontWeight = FontWeight.SemiBold), color = c.textPrimary)
    Icon(if (remind) Icons.Filled.Notifications else Icons.Outlined.NotificationsOff, if (remind) "إيقاف تذكير ${p.nameAr}" else "تفعيل تذكير ${p.nameAr}", Modifier.align(Alignment.TopEnd).size(11.dp), tint = if (next) c.textOnBrand.copy(alpha = 0.85f) else if (remind) c.brandPrimary else c.borderStrong)
  }
}

// MARK: متابعة القراءة
@Composable private fun ContinueReadingCard(onOpen: (Int) -> Unit) {
  val c = DS.c; val last = Store.lastRead; val page = last?.page ?: 1; val today = Store.todayKey
  val stt = Store.khatmah?.let { Khatmah.status(it, page, Store.readLog, today) }
  val pct = stt?.let { it.percent / 100f } ?: (page / 604f)
  val pagesToday = Store.readLog[today]?.size ?: 0
  val line = if (stt != null) { if (stt.finished) "تقبّل الله ✦ أتممت الختمة" else "الختمة ${Fmt.number(stt.percent)}٪  ·  ${Fmt.number(stt.todayPages)} صفحات اليوم من ${Fmt.number(stt.todayTarget)}" }
    else "${Fmt.number((pct * 100).toInt())}٪ من المصحف  ·  ${if (pagesToday == 0) "لم تقرأ اليوم بعد" else "قرأت اليوم ${Fmt.number(pagesToday)} صفحات"}"
  DSCard(Modifier.fillMaxWidth(), padding = 16.dp) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
      Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
          Icon(Icons.Outlined.MenuBook, null, Modifier.size(13.dp), tint = c.accentGoldStrong)
          Text(if (last == null) "ابدأ القراءة" else "متابعة القراءة", style = DSType.labelSm, color = c.accentGoldStrong)
        }
        Text(last?.let { "سورة ${QuranMeta.surah(it.surah).name}" } ?: "سورة الفاتحة", style = DSType.displaySm.copy(fontSize = 22.sp), color = c.textPrimary, maxLines = 1)
        Text(last?.let { "صفحة ${Fmt.number(it.page)}  ·  الجزء ${Fmt.number(QuranMeta.juzOfPage(it.page))}  ·  الآية ${Fmt.number(it.ayah)}" } ?: "مصحف المدينة · حفص عن عاصم · ٦٠٤ صفحات", style = DSType.labelSm.copy(fontWeight = FontWeight.Normal), color = c.textSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
        ProgressTrack(pct, Modifier.padding(top = 2.dp), tint = c.accentGold, track = c.bgSubtle, height = 6.dp)
        Text(line, style = DSType.labelXs.copy(fontWeight = FontWeight.Normal), color = c.textTertiary, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Row(Modifier.padding(top = 4.dp).clip(CircleShape).background(c.brandPrimary).clickable { onOpen(page) }.padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
          Text(if (last == null) "افتح المصحف" else "تابع القراءة", style = DSType.labelSm.copy(fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold), color = c.textOnBrand)
          Icon(Icons.Filled.ChevronLeft, null, Modifier.size(12.dp), tint = c.textOnBrand)
        }
      }
      MiniPageThumb(page)
    }
  }
}

/** صفحة مصحف مصغّرة بإطار ذهبي: شريط سورة وأسطر حبر ورقم الصفحة — إشارة لا صورة */
@Composable private fun MiniPageThumb(page: Int) {
  val c = DS.c; val shape = RoundedCornerShape(10.dp)
  Box(Modifier.size(78.dp, 106.dp).shadow(10.dp, shape, ambientColor = c.shadow.copy(alpha = 0.08f), spotColor = c.shadow.copy(alpha = 0.1f)).clip(shape).background(c.paperPage).border(1.dp, c.accentGold.copy(alpha = 0.7f), shape)) {
    Canvas(Modifier.matchParentSize()) {
      drawRoundRect(c.accentGold.copy(alpha = 0.45f), Offset(6.dp.toPx(), 6.dp.toPx()), Size(size.width - 12.dp.toPx(), size.height - 12.dp.toPx()), CornerRadius(4.dp.toPx()), style = Stroke(0.8.dp.toPx()))
      drawRoundRect(c.brandSoft, Offset(11.dp.toPx(), 11.dp.toPx()), Size(size.width - 22.dp.toPx(), 9.dp.toPx()), CornerRadius(2.dp.toPx()))
      for (i in 0 until 9) {
        val wLine = if (i == 8) 34.dp.toPx() else size.width - 22.dp.toPx()
        drawRoundRect(c.paperInk.copy(alpha = 0.55f), Offset(size.width - 11.dp.toPx() - wLine, 27.dp.toPx() + i * 8.dp.toPx()), Size(wLine, 1.6.dp.toPx()), CornerRadius(1.dp.toPx()))
      }
    }
    Text(Fmt.number(page), Modifier.align(Alignment.BottomCenter).padding(bottom = 3.dp), style = DSType.readingSm.copy(fontSize = 7.sp), color = c.accentGoldStrong)
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
@Composable fun StarLattice(modifier: Modifier = Modifier, tint: Color = Color.White) {
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
        drawPath(p, tint, style = Stroke(1.dp.toPx()))
        x += step
      }
      y += step; row++
    }
  }
}

// MARK: أقرب مسجد
/** مركز البحث هو موقع الجهاز الفعلي (`Loc.mosqueCenter`) لا إحداثيات المواقيت: مدينة يدوية تعني مركزها لا مكان المستخدم */
@Composable private fun NearestMosqueCard(coords: Coordinates, onAll: () -> Unit) {
  val c = DS.c; val ctx = LocalContext.current; val scope = rememberCoroutineScope()
  var results by remember { mutableStateOf<List<Mosque>>(emptyList()) }
  var loading by remember { mutableStateOf(false) }; var error by remember { mutableStateOf<String?>(null) }
  var denied by remember { mutableStateOf(false) }; var fixFailed by remember { mutableStateOf(false) }
  val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { g ->
    if (g.values.any { it }) scope.launch { fixFailed = Loc.refreshDeviceFix(ctx) == null } else denied = true
  }
  val center = Loc.mosqueCenter
  val key = center?.let { String.format(java.util.Locale.US, "%.3f,%.3f", it.latitude, it.longitude) }
  // قراءة طازجة مع كل ظهور (مخنوقة دقيقتين)؛ حين تصل يتغيّر المفتاح فيُعاد البحث حولها
  LaunchedEffect(Store.nearbyMosques) { if (Store.nearbyMosques && Loc.granted(ctx)) fixFailed = Loc.refreshDeviceFix(ctx) == null && Loc.mosqueCenter == null }
  LaunchedEffect(Store.nearbyMosques, key) {
    if (!Store.nearbyMosques || center == null) return@LaunchedEffect
    MosqueFinder.cached(center.latitude, center.longitude)?.let { results = it; return@LaunchedEffect }
    loading = true; error = null
    MosqueFinder.nearby(center.latitude, center.longitude).onSuccess { results = it }.onFailure { error = "تعذّر جلب المساجد — تحقّق من الاتصال" }
    loading = false
  }
  DSCard(Modifier.fillMaxWidth(), padding = 16.dp) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      Text("أقرب مسجد", style = DSType.displaySm.copy(fontSize = 19.sp), color = c.textPrimary); Spacer(Modifier.weight(1f))
      Row(Modifier.clip(CircleShape).clickable(onClick = onAll).padding(4.dp), verticalAlignment = Alignment.CenterVertically) { Text("المساجد القريبة", style = DSType.labelSm, color = c.brandPrimary); Icon(Icons.Filled.ChevronLeft, null, Modifier.size(16.dp), tint = c.brandPrimary) }
    }
    Spacer(Modifier.height(12.dp))
    val m = results.firstOrNull()
    when {
      !Store.nearbyMosques -> {
        Text("يعرض أقرب مسجد إليك من OpenStreetMap. يُرسل موقعك مقرّبًا إلى نحو كيلومتر عند البحث، ولا يُحفظ لدينا.", style = DSType.bodySm, color = c.textSecondary)
        Spacer(Modifier.height(10.dp))
        DSButton("اعرض أقرب مسجد", Modifier.fillMaxWidth(), icon = Icons.Outlined.Mosque) { Store.nearbyMosques = true; Store.save() }
      }
      center == null -> DeviceFixPrompt(denied = denied, failed = fixFailed, granted = Loc.granted(ctx)) {
        if (Loc.granted(ctx)) scope.launch { fixFailed = Loc.refreshDeviceFix(ctx) == null }
        else permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
      }
      m != null -> {
        MosqueMapStrip(m, MosqueFinder.walkLabel(m.distanceKm), onClick = onAll)
        Spacer(Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
          DSIconButton(Icons.Outlined.Mosque, style = IconStyle.Soft, size = 42.dp, iconSize = 17.dp)
          Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(m.name, style = DSType.headingSm.copy(fontSize = 15.sp), color = c.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
              Text("${MosqueFinder.distanceLabel(m.distanceKm)}  ·  ${MosqueFinder.walkLabel(m.distanceKm)}  ·  ${Qibla.compassPointAr(m.bearing)}", style = DSType.labelXs.copy(fontSize = 11.5.sp, fontWeight = FontWeight.Normal), color = c.textSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
              if (loading) CircularProgressIndicator(Modifier.size(12.dp), strokeWidth = 1.5.dp, color = c.brandPrimary)
            }
          }
          DSIconButton(Icons.Outlined.Directions, style = IconStyle.Brand, size = 42.dp, iconSize = 17.dp, contentDescription = "الاتجاهات إلى ${m.name}") { MosqueFinder.openDirections(ctx, m) }
        }
      }
      loading -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) { CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = c.brandPrimary); Text("جارٍ البحث حولك…", style = DSType.bodySm, color = c.textSecondary) }
      else -> Text(error ?: "لا مساجد ضمن ٣ كم — افتح «المساجد القريبة» للبحث بالاسم", style = DSType.bodySm, color = c.textSecondary)
    }
  }
}

/** شريحة خريطة رمزية (بلا شبكة ولا خدمات): شوارع وحديقة، المستخدم يمينًا والمسجد يسارًا ومسار سير منقّط */
@Composable private fun MosqueMapStrip(m: Mosque, walk: String, onClick: () -> Unit) {
  val c = DS.c
  CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
    BoxWithConstraints(Modifier.fillMaxWidth().height(118.dp).clip(RoundedCornerShape(16.dp)).background(Color(0xFFEEF1EA)).clickable(onClick = onClick)) {
      val w = maxWidth; val h = maxHeight
      Canvas(Modifier.matchParentSize()) {
        val ww = size.width; val hh = size.height; val white = Color.White
        drawOval(Color(0xFFD6E7D0), Offset(-ww * 0.1f, hh * 0.45f), Size(ww * 0.45f, hh * 0.8f))
        rotate(-18f, Offset(ww * 0.9f, hh * 0.5f)) { drawRect(Color(0xFFCFE1EA), Offset(ww * 0.84f, -hh * 0.2f), Size(ww * 0.14f, hh * 1.4f)) }
        rotate(-6f) {
          drawLine(white.copy(alpha = 0.7f), Offset(-20f, hh * 0.17f), Offset(ww + 20f, hh * 0.17f), 4.dp.toPx(), StrokeCap.Round)
          drawLine(white, Offset(-20f, hh * 0.38f), Offset(ww + 20f, hh * 0.38f), 9.dp.toPx(), StrokeCap.Round)
          drawLine(white, Offset(-20f, hh * 0.76f), Offset(ww + 20f, hh * 0.76f), 7.dp.toPx(), StrokeCap.Round)
        }
        rotate(14f) {
          drawLine(white, Offset(ww * 0.36f, -20f), Offset(ww * 0.36f, hh + 20f), 6.dp.toPx(), StrokeCap.Round)
          drawLine(white, Offset(ww * 0.62f, -20f), Offset(ww * 0.62f, hh + 20f), 6.dp.toPx(), StrokeCap.Round)
        }
        val user = Offset(ww * 0.73f, hh * 0.62f); val mosque = Offset(ww * 0.38f, hh * 0.44f)
        drawCircle(Color(0xFF3B82F6).copy(alpha = 0.14f), 22.dp.toPx(), user); drawCircle(Color(0xFF3B82F6).copy(alpha = 0.35f), 22.dp.toPx(), user, style = Stroke(1.dp.toPx()))
        for (i in 1..9) { val t = i / 10f; drawCircle(c.brandPrimary.copy(alpha = 0.7f), 1.75.dp.toPx(), Offset(user.x + (mosque.x - user.x) * t, user.y + (mosque.y - user.y) * t)) }
        drawCircle(Color.White, 9.dp.toPx(), user); drawCircle(Color(0xFF3B82F6), 7.dp.toPx(), user)
      }
      // الدبّوس
      Box(Modifier.offset(x = w * 0.38f - 17.dp, y = h * 0.44f - 42.dp).size(34.dp).shadow(8.dp, CircleShape, ambientColor = c.brandPrimary.copy(alpha = 0.3f), spotColor = c.brandPrimary.copy(alpha = 0.4f)).clip(CircleShape).background(c.brandPrimary).border(2.5.dp, Color.White, CircleShape), contentAlignment = Alignment.Center) {
        Icon(Icons.Outlined.Mosque, null, Modifier.size(18.dp), tint = Color.White)
      }
      Text(walk, Modifier.align(Alignment.TopStart).padding(10.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.92f)).padding(horizontal = 8.dp, vertical = 3.dp), style = DSType.labelXs.copy(fontSize = 10.5.sp), color = c.brandPrimary)
    }
  }
}

// MARK: أذكار الوقت
@Composable private fun AdhkarCard(tl: PrayerTimes.DayTimeline, now: Instant, onOpen: (String) -> Unit) {
  val c = DS.c; val today = Store.todayKey
  val period = Adhkar.autoPeriod(now, tl.times[Prayer.FAJR], tl.times[Prayer.DHUHR], tl.times[Prayer.ASR], Store.zone)
  val items = Adhkar.items(period); val pr = Store.adhkarProgress
  val map: Map<String, Int> = if (period == "morning") (if (pr.date == today) pr.morning ?: emptyMap() else emptyMap()) else (if (pr.eveningDate == today) pr.evening ?: emptyMap() else emptyMap())
  val done = items.count { (map[it.id] ?: 0) >= it.target(period) }; val total = items.size
  val streak = AdhkarStreak.current(Store.adhkarLog, today); val finished = total > 0 && done >= total
  val title = if (period == "morning") "أذكار الصباح" else "أذكار المساء"
  val whenText = if (period == "morning") "وقتها من الفجر إلى الظهر" else "وقتها من العصر إلى الفجر"
  val streakText = if (streak > 0) "سلسلة ${Fmt.number(streak)} ${dayWord(streak)}" else ""
  val status = when {
    finished -> "أتممتها اليوم ✓" + (if (streakText.isNotEmpty()) "  ·  $streakText" else "")
    done == 0 -> "لم تبدأ بعد" + (if (streakText.isNotEmpty()) "  ·  $streakText 🔥" else "")
    else -> "أكملت ${Fmt.number(done)} من ${Fmt.number(total)}" + (if (streakText.isNotEmpty()) "  ·  $streakText 🔥" else "")
  }
  val shape = RoundedCornerShape(24.dp)
  Box(Modifier.fillMaxWidth().shadow(20.dp, shape, ambientColor = c.brandPrimary.copy(alpha = 0.22f), spotColor = c.brandPrimary.copy(alpha = 0.28f)).clip(shape).background(Brush.horizontalGradient(listOf(Color(0xFF0B3F39), Color(0xFF0E5C55))))) {
    StarLattice(Modifier.matchParentSize().alpha(0.06f))
    Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
      Box(Modifier.size(58.dp), contentAlignment = Alignment.Center) {
        RingProgress(if (total > 0) done.toFloat() / total else 0f, Modifier.matchParentSize(), tint = c.accentGold, track = Color.White.copy(alpha = 0.14f), stroke = 6.dp)
        Text("${Fmt.number(done)}/${Fmt.number(total)}", style = DSType.labelSm.copy(fontWeight = FontWeight.SemiBold), color = c.textOnDark)
      }
      Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(whenText, style = DSType.labelXs.copy(fontSize = 11.5.sp, fontWeight = FontWeight.Normal), color = c.textOnDarkMuted)
        Text(title, style = DSType.displaySm.copy(fontSize = 22.sp), color = c.textOnDark)
        Text(status, style = DSType.labelXs.copy(fontSize = 11.5.sp, fontWeight = FontWeight.Normal), color = c.textOnDark.copy(alpha = 0.75f), maxLines = 1, overflow = TextOverflow.Ellipsis)
      }
      Row(Modifier.clip(CircleShape).background(c.accentGold).clickable { onOpen(period) }.padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(if (finished) "راجع" else if (done > 0) "تابع" else "ابدأ", style = DSType.labelMd.copy(fontSize = 13.sp, fontWeight = FontWeight.SemiBold), color = c.textPrimary)
        Icon(Icons.Filled.ChevronLeft, null, Modifier.size(12.dp), tint = c.textPrimary)
      }
    }
  }
}
private fun dayWord(n: Int) = if (n == 1) "يوم" else if (n == 2) "يومين" else if (n <= 10) "أيام" else "يومًا"
