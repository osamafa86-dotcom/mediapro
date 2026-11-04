package org.emdatra.sakinah.app.ui

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import androidx.activity.compose.BackHandler
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
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
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
 * «اليوم» (المرحلة الثانية — today-android-light.png): هيرو سماءٍ يتبدّل مع وقت الصلاة (والطقس إن فُعّل) يجمع الصلاة
 * القادمة بوقت أذانها وما بقي عليها، والقبلة، وبطاقة مواقيتٍ زجاجية داكنة (نسبة الوقت المنقضي، الصلوات الخمس، ضمان الأذان،
 * جدول الشهر)؛ ثم بطاقة «الآن»، والأدوات السريعة، و«ورد اليوم»، و«حديث اليوم». البحث والإعدادات من رأسه، وكل ما يُفتح منه
 * يُدفع فوقه ويعود إليه بالرجوع. مرآة HomeView.swift.
 */
@Composable fun HomeScreen() {
  val ctx = LocalContext.current; val scope = rememberCoroutineScope(); val switchTab = LocalSwitchTab.current
  var now by remember { mutableStateOf(Instant.now()) }
  LaunchedEffect(Unit) { while (true) { delay(1000); now = Instant.now() } }
  // مكدّس الشاشات المدفوعة فوق «اليوم» — نصٌّ مفصول بـ«|» كي يُحفظ مع تدوير الشاشة
  var stackStr by rememberSaveable { mutableStateOf(listOfNotNull(if (ScreenshotMode.fullQibla) "qibla" else null, ScreenshotMode.todayRoute).joinToString("|")) }
  val stack = if (stackStr.isEmpty()) emptyList() else stackStr.split('|')
  fun push(r: String) { stackStr = (stack + r).joinToString("|") }
  fun pop() { stackStr = stack.dropLast(1).joinToString("|") }
  // حالة البحث مرفوعة هنا كي تبقى حين تُفتح نتيجةٌ ثم يُرجع إليه
  var searchQuery by rememberSaveable { mutableStateOf(ScreenshotMode.searchQuery) }
  var searchScope by rememberSaveable { mutableStateOf(SearchScope.ALL.name) }
  var hadithQuery by rememberSaveable { mutableStateOf("") }
  var showCity by remember { mutableStateOf(false) }; var showKhatmah by remember { mutableStateOf(false) }
  val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { if (it.values.any { g -> g }) scope.launch { Loc.current(ctx)?.let { l -> Loc.apply(ctx, l); Notify.schedule(ctx) } } }
  LaunchedEffect(Unit) { if (Store.coords == null && Store.locMode == "gps") { if (Loc.granted(ctx)) Loc.current(ctx)?.let { Loc.apply(ctx, it); Notify.schedule(ctx) } else permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) } }
  BackHandler(stack.isNotEmpty()) { pop() }
  fun openReader(page: Int, ayah: Int?) { Store.pendingReaderPage = page; Store.pendingReaderAyah = ayah; switchTab(AppTab.Mushaf) }
  /** وجهات البحث والأدوات: شاشة تُدفع فوق «اليوم»، أو ورقة، أو تبويب آخر */
  fun open(action: String) {
    when {
      action == "khatmah" -> showKhatmah = true
      action.startsWith("adhkar:") -> { Store.pendingAdhkarPeriod = action.removePrefix("adhkar:"); switchTab(AppTab.Adhkar) }
      action == "hadith" || action == "nawawi" -> { hadithQuery = ""; push(action) }
      else -> push(action)
    }
  }

  val top = stack.lastOrNull()
  if (top != null) {
    // الشاشات المدفوعة تحت شريط الحالة لا خلفه (الهيرو وحده يمدّ سماءه تحته)، والبحث يحشو نفسه لأنه يملأ الشاشة
    Box(Modifier.fillMaxSize().background(DS.c.bgCanvas).then(if (top == "search") Modifier else Modifier.statusBarsPadding())) {
      when {
        top == "search" -> SearchScreen(
          query = searchQuery, onQuery = { searchQuery = it }, scope = SearchScope.valueOf(searchScope), onScope = { searchScope = it.name },
          onClose = { pop() },
          onAyah = { a -> openReader(a.page, a.n) },
          onSurah = { s -> openReader(s.page, QuranText.shared.ayah(s.n, 1)?.n) },
          onChapter = { ch -> push("hisn:${ch.id}") },
          onHadith = { book, q -> hadithQuery = q; push(if (book == "nawawi") "nawawi" else "hadith") },
          onTool = { open(it) })
        top == "settings" || top.startsWith("settings:") -> SettingsScreen(backLabel = if (stack.getOrNull(stack.size - 2) == "search") "البحث" else "اليوم", initial = top.substringAfter(':', "").ifEmpty { null }, onBack = { pop() })
        top == "month" -> MonthTableScreen { pop() }
        top == "qibla" -> QiblaScreen(onClose = { pop() })
        top == "guard" -> AdhanGuardScreen { pop() }
        top == "mosques" -> MosquesScreen(onBack = { pop() })
        top == "tasbih" -> TasbihScreen { pop() }
        top == "hisn" -> HisnScreen(onBack = { pop() }) { ch -> push("hisn:${ch.id}") }
        top.startsWith("hisn:") -> { val ch = top.removePrefix("hisn:").toIntOrNull()?.let { Hisn.chapter(it) }; if (ch != null) HisnChapterScreen(ch) { pop() } else LaunchedEffect(top) { pop() } }
        top == "hadith" || top == "nawawi" -> HadithScreen(if (top == "nawawi") "nawawi" else "sahih", initialQuery = hadithQuery) { pop() }
        else -> LaunchedEffect(top) { pop() }
      }
    }
    if (showKhatmah) KhatmahSheet(onDismiss = { showKhatmah = false }, onGo = { p -> showKhatmah = false; openReader(p, null) })
    return
  }

  val tl = Store.timeline(now); val h = Hijri.date(now, Store.zone, Store.hijriOffset); val coords = Store.coords
  val compass = rememberCompass(enabled = coords != null)
  val prefs = Store.skyPrefs
  val sky = homeSkyState(now, tl, prefs, SkyWeatherService.current)
  // الطقس (إن فُعّل): تحديث كل ساعة حول الخلية الحالية، وبلا شبكة في وضع اللقطات
  val cell = coords?.let { SkyWeatherService.cellKey(it.latitude, it.longitude) }
  LaunchedEffect(prefs.weather, prefs.mode, cell) { if (prefs.weather && prefs.mode == SkyMode.AUTO && !ScreenshotMode.active && coords != null) SkyWeatherService.refreshIfNeeded(coords.latitude, coords.longitude) }
  // أيقونات شريط الحالة تتبع السماء: فاتحة على الداكنة، وتعود لسمة التطبيق عند مغادرة «اليوم»
  val view = LocalView.current; val appDark = DS.c.isDark
  DisposableEffect(sky.palette.isDark) {
    val ic = view.context.findActivity()?.let { WindowCompat.getInsetsController(it.window, view) }
    ic?.isAppearanceLightStatusBars = !sky.palette.isDark
    onDispose { ic?.isAppearanceLightStatusBars = !appDark }
  }
  Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
    Hero(sky, prefs.reduceMotion, h, now, tl, coords, compass,
      onCity = { showCity = true }, onSearch = { push("search") }, onSettings = { push("settings") },
      onQibla = { push("qibla") }, onGuard = { push("guard") }, onMonth = { push("month") })
    Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(top = 20.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
      if (tl == null || coords == null) LocationPrompt(onDevice = { permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) }, onCity = { showCity = true })
      else NowCard(tl, now, onAdhkar = { period -> Store.pendingAdhkarPeriod = period; switchTab(AppTab.Adhkar) }, onChapter = { id -> push("hisn:$id") })
      QuickTools(onMonth = { push("month") }, onTasbih = { push("tasbih") }, onHisn = { push("hisn") }, onMosques = { push("mosques") })
      WirdSection(onRead = { p, n -> openReader(p, n) }, onKhatmah = { showKhatmah = true })
      HadithSection(onNawawi = { open("nawawi") }, onOpen = { open("hadith") })
      Text("يعمل دون اتصال، لا حساب ولا تتبّع", Modifier.fillMaxWidth(), style = DSType.labelXs, color = DS.c.textTertiary, textAlign = TextAlign.Center)
    }
  }
  if (showCity) CityPickerSheet(onDismiss = { showCity = false }, onDevice = { showCity = false; permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) })
  if (showKhatmah) KhatmahSheet(onDismiss = { showKhatmah = false }, onGo = { p -> showKhatmah = false; openReader(p, null) })
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
                             onCity: () -> Unit, onSearch: () -> Unit, onSettings: () -> Unit, onQibla: () -> Unit, onGuard: () -> Unit, onMonth: () -> Unit) {
  val p = sky.palette
  val shape = RoundedCornerShape(bottomStart = 32.dp, bottomEnd = 32.dp)
  Box(Modifier.fillMaxWidth().clip(shape)) {
    SkyBackdrop(sky, reduceMotion, Modifier.matchParentSize())
    Column(Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.statusBars).padding(start = 20.dp, end = 20.dp, top = 6.dp, bottom = 20.dp)) {
      TopRow(p, h, onCity, onSearch, onSettings)
      if (tl != null && coords != null) {
        Row(Modifier.fillMaxWidth().padding(top = 12.dp), verticalAlignment = Alignment.Top) {
          NextPrayerBlock(Modifier.weight(1f), tl, now, p)
          Spacer(Modifier.width(8.dp))
          MedallionColumn(coords, compass, p, onQibla)
        }
        PrayerCard(tl, now, Modifier.fillMaxWidth().padding(top = 16.dp), onGuard, onMonth)
      } else {
        Column(Modifier.padding(top = 24.dp, bottom = 40.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
          Text("حدّد موقعك", style = DSType.displayHero, color = p.text)
          Text("لتُحسب المواقيت والقبلة وتتبدّل السماء مع وقتك", style = DSType.bodyMd, color = p.textMuted)
        }
      }
    }
  }
}

/** المدينة والحرارة ثم التاريخ الهجري (يمين)، وزرّا البحث والإعدادات الزجاجيان (يسار) — بلا جرس: التنبيهات في الإعدادات */
@Composable private fun TopRow(p: SkyPalette, h: HijriDate, onCity: () -> Unit, onSearch: () -> Unit, onSettings: () -> Unit) {
  Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
      // الحرارة بجانب المدينة متى فعّل المستخدم الطقس (القراءة نفسها التي تلوّن السماء — لا طلب إضافي)
      val temp = if (Store.skyWeather && !ScreenshotMode.active) SkyWeatherService.temperature else null
      val label = "الموقع: " + (Store.locName ?: "غير محدّد") + (temp?.let { "، ${Math.round(it)} درجة" } ?: "")
      Row(Modifier.clip(CircleShape).background(p.glass).border(1.dp, p.glassStroke, CircleShape).clickable(onClickLabel = "تغيير المدينة", onClick = onCity).semantics(mergeDescendants = true) { contentDescription = label }.heightIn(min = 34.dp).padding(start = 12.dp, end = 12.dp, top = 6.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Icon(Icons.Filled.Place, null, Modifier.size(14.dp), tint = p.gold)
        Text(Store.locName ?: "حدّد موقعك", style = DSType.labelSm.copy(fontSize = 13.sp), color = p.text, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
        if (temp != null) {
          Box(Modifier.width(1.dp).height(12.dp).background(p.glassStroke))
          Icon(weatherGlyph(SkyWeatherService.current, p.isDark), null, Modifier.size(14.dp), tint = p.textSoft)
          Text("⁦${Fmt.number(Math.round(temp).toInt())}°⁩", style = DSType.labelSm.copy(fontSize = 13.sp), color = p.text, maxLines = 1)
        }
      }
      Text("${h.weekday}، ${Fmt.number(h.day)} ${h.monthName} ${Fmt.number(h.year)}هـ", style = DSType.labelSm.copy(fontSize = 12.5.sp, fontWeight = FontWeight.Normal), color = p.textMuted, maxLines = 1)
    }
    GlassIcon(Icons.Outlined.Search, "البحث", p, onSearch)
    GlassIcon(Icons.Outlined.Tune, "الإعدادات", p, onSettings)
  }
}
@Composable private fun GlassIcon(icon: ImageVector, label: String, p: SkyPalette, onClick: () -> Unit) {
  Box(Modifier.size(48.dp).clip(CircleShape).background(p.glass).border(1.dp, p.glassStroke, CircleShape).clickable(role = Role.Button, onClick = onClick), contentAlignment = Alignment.Center) {
    Icon(icon, label, Modifier.size(20.dp), tint = p.textSoft)
  }
}

/** وقت الأذان بلا «ص/م» (كما في التصميم: الاسم يكفي للتمييز)، وبنظام ٢٤ ساعة كما هو */
private fun clock(t: Instant?): String = Fmt.time(t).substringBefore(' ')

/** «باقٍ ٤٢ دقيقة» / «باقٍ ساعة و٥ دقائق» / «باقٍ ٣ ساعات و٢٠ دقيقة» — بمطابقة العدد والمعدود، سطرًا واحدًا */
private fun remainingLabel(secs: Long): String {
  val mins = ((secs + 59) / 60).toInt()
  if (mins <= 0) return "حان الآن"
  fun minutes(n: Int) = when { n == 1 -> "دقيقة"; n == 2 -> "دقيقتان"; n in 3..10 -> "${Fmt.number(n)} دقائق"; else -> "${Fmt.number(n)} دقيقة" }
  fun hours(n: Int) = when { n == 1 -> "ساعة"; n == 2 -> "ساعتان"; n in 3..10 -> "${Fmt.number(n)} ساعات"; else -> "${Fmt.number(n)} ساعة" }
  if (mins < 60) return "باقٍ ${minutes(mins)}"
  val hh = mins / 60; val mm = mins % 60
  return "باقٍ ${hours(hh)}" + (if (mm > 0) " و${minutes(mm)}" else "")
}

/** الصلاة القادمة: عنوان ذهبي صغير، اسمها بالكوفي، وقت أذانها بأرقام كبيرة خفيفة، ثم حبّة ذهبية بما بقي — العدّاد بالثواني لم يعد بطل الهيرو */
@Composable private fun NextPrayerBlock(modifier: Modifier, tl: PrayerTimes.DayTimeline, now: Instant, p: SkyPalette) {
  val next = tl.next
  val time = clock(next.time)
  Column(modifier.semantics(mergeDescendants = true) {}, verticalArrangement = Arrangement.spacedBy(2.dp)) {
    Text(if (next.key == Prayer.SUNRISE) "الوقت القادم" else "الصلاة القادمة", style = DSType.labelSm.copy(fontSize = 13.sp, letterSpacing = 0.4.sp), color = p.gold)
    Text(if (next.isTomorrow) "فجر الغد" else next.key.nameAr, Modifier.padding(top = 2.dp), style = DSType.displayLg.copy(fontSize = 30.sp, lineHeight = 40.sp), color = p.text, maxLines = 1)
    Text(time, style = DSType.numericHero.copy(fontSize = if (time.length > 4) 52.sp else 64.sp, lineHeight = 70.sp), color = p.text, maxLines = 1, softWrap = false)
    Text(remainingLabel(next.time.epochSecond - now.epochSecond), Modifier.padding(top = 4.dp).clip(CircleShape).background(CardInk.gold).padding(horizontal = 12.dp, vertical = 5.dp),
      style = DSType.labelSm.copy(fontSize = 13.sp, fontWeight = FontWeight.SemiBold), color = LightDS.textPrimary, maxLines = 1)
  }
}

/** رمز الطقس في شارة المدينة — مرآة SkyWeatherService.symbol في iOS */
private fun weatherGlyph(w: SkyWeather?, dark: Boolean): ImageVector = when (w) {
  SkyWeather.PARTLY_CLOUDY -> if (dark) Icons.Outlined.NightsStay else Icons.Outlined.WbCloudy
  SkyWeather.OVERCAST -> Icons.Outlined.Cloud
  SkyWeather.RAIN -> Icons.Outlined.Umbrella
  SkyWeather.DUST -> Icons.Outlined.Air
  SkyWeather.SNOW -> Icons.Outlined.AcUnit
  else -> if (dark) Icons.Outlined.DarkMode else Icons.Outlined.WbSunny
}
/** الميدالية وحبّة التوجّه — بلا سطر الدرجات والبُعد (في شاشة القبلة الكاملة) */
@Composable private fun MedallionColumn(coords: Coordinates, compass: CompassReading, p: SkyPalette, onQibla: () -> Unit) {
  val qibla = remember(coords) { Qibla.info(coords.latitude, coords.longitude) }
  val decl = remember(coords) { Geomag.declination(coords.latitude, coords.longitude) }
  // المحاكي بلا مغناطيسية: في وضع اللقطات وحده يُفترض اتجاهٌ يطابق القبلة
  val trueHeading: Double? = if (ScreenshotMode.active) qibla.bearing else compass.heading?.let { Geomag.magneticToTrue(it.toDouble(), decl) }
  val diff = trueHeading?.let { Qibla.signedDifference(qibla.bearing, it) }
  val aligned = diff != null && abs(diff) <= 3
  Column(Modifier.width(150.dp).clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, role = Role.Button, onClickLabel = "افتح شاشة القبلة", onClick = onQibla), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
    CompassMedallion(qibla.bearing, trueHeading ?: 0.0, aligned, live = trueHeading != null, Modifier.size(140.dp))
    QiblaChip(aligned, diff, live = trueHeading != null, p)
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

// MARK: بطاقة المواقيت الزجاجية — داكنة في كل الأطوار كما في التصميم، فحبرها من لوحة سماءٍ داكنة (الشفق) لا من لوحة الطور الحالي
private val CardInk: SkyPalette = SkyPalette.of(SkyPhase.SHAFAQ)
private val CardPrayers = listOf(Prayer.FAJR, Prayer.DHUHR, Prayer.ASR, Prayer.MAGHRIB, Prayer.ISHA)

/** شريط «مضى ٧٢٪ من وقت العصر»، والصلوات الخمس بأوقاتها (القادمة في مستطيلٍ أفتح)، ثم سطر ضمان الأذان (يمين) و«جدول الشهر» (يسار) */
@Composable private fun PrayerCard(tl: PrayerTimes.DayTimeline, now: Instant, modifier: Modifier, onGuard: () -> Unit, onMonth: () -> Unit) {
  val k = CardInk; val shape = RoundedCornerShape(22.dp)
  // نسبة ما مضى من وقت الصلاة الحالية: من دخولها إلى دخول التالية
  val start = tl.times[tl.current]?.takeIf { !it.isAfter(now) } ?: tl.yesterdayIsha
  val total = start?.let { (tl.next.time.epochSecond - it.epochSecond).toDouble() } ?: 0.0
  val pct = if (start != null && total > 0) ((now.epochSecond - start.epochSecond) / total).coerceIn(0.0, 1.0) else 0.0
  val currentName = if (tl.current == Prayer.SUNRISE) "الضحى" else tl.current.nameAr
  // العمود المميّز: القادمة (فجر الغد بعد العشاء، وعشاء الأمس حين يتأخر بعد منتصف الليل) — ولا عمود للشروق
  val highlight: Prayer? = when { tl.next.isTomorrow -> Prayer.FAJR; tl.next.isYesterday -> Prayer.ISHA; tl.next.key == Prayer.SUNRISE -> null; else -> tl.next.key }
  Column(modifier.clip(shape).background(k.stops.first().toColor().copy(alpha = 0.58f)).border(1.dp, k.glassStroke, shape).padding(horizontal = 14.dp, vertical = 12.dp)) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
      Text("مضى ${Fmt.number((pct * 100).toInt())}٪ من وقت $currentName", style = DSType.labelXs.copy(fontSize = 11.5.sp), color = k.textSoft, maxLines = 1)
      ProgressTrack(pct.toFloat(), Modifier.weight(1f), tint = k.text, track = k.glassStroke, height = 3.dp)
    }
    Spacer(Modifier.height(10.dp))
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
      CardPrayers.forEach { pr ->
        val on = pr == highlight
        val t = if (on) tl.next.time else tl.times[pr]
        val cellShape = RoundedCornerShape(14.dp)
        Column(Modifier.weight(1f).clip(cellShape).background(if (on) k.glassStroke else Color.Transparent).then(if (on) Modifier.border(1.dp, k.glassStroke, cellShape) else Modifier)
          .clearAndSetSemantics { contentDescription = "${pr.nameAr} ${Fmt.time(t)}" + (if (on) "، القادمة" else "") }
          .padding(vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
          Text(pr.nameAr, style = DSType.labelXs.copy(fontSize = 11.5.sp, fontWeight = if (on) FontWeight.SemiBold else FontWeight.Medium), color = if (on) k.text else k.textMuted, maxLines = 1)
          Text(clock(t), style = DSType.numericSm.copy(fontWeight = if (on) FontWeight.SemiBold else FontWeight.Medium), color = k.text, maxLines = 1)
        }
      }
    }
    Spacer(Modifier.height(6.dp))
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      AdhanGuardLine(tl, k, onGuard)
      Spacer(Modifier.weight(1f))
      Row(Modifier.heightIn(min = 44.dp).clip(CircleShape).clickable(role = Role.Button, onClick = onMonth).padding(horizontal = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        Text("جدول الشهر", style = DSType.labelSm.copy(fontSize = 12.sp), color = k.textSoft)
        Icon(Icons.Filled.ChevronLeft, null, Modifier.size(14.dp), tint = k.textSoft)
      }
    }
  }
}

/** سطر «ضمان الأذان» (من المرحلة الأولى، نُقل إلى ذيل البطاقة): ✓ «أذان المغرب مجدول» متى كان منبّه الأذان القادم قائماً عند النظام، وإلا تنبيهٌ يفتح الفحص */
@Composable private fun AdhanGuardLine(tl: PrayerTimes.DayTimeline, k: SkyPalette, onGuard: () -> Unit) {
  if (ScreenshotMode.active) return
  val ctx = LocalContext.current
  var tick by remember { mutableIntStateOf(0) }
  androidx.lifecycle.compose.LifecycleResumeEffect(Unit) { tick++; onPauseOrDispose { } }
  val state = remember(tick, tl.next.time, Store.reminders) {
    if (!Store.reminders.enabled) null
    else { val up = AdhanGuard.upcoming(ctx, 1).firstOrNull(); Triple(up?.prayer, up?.scheduled ?: false, AdhanGuard.issues(ctx).isEmpty()) }
  }
  val name = (state?.first ?: (if (tl.next.key == Prayer.SUNRISE) Prayer.DHUHR else tl.next.key)).nameAr
  val (ok, text, icon) = when {
    state == null -> Triple(false, "الأذان غير مفعّل", Icons.Outlined.NotificationsOff)
    state.second && state.third -> Triple(true, "أذان $name مجدول", Icons.Filled.Check)
    state.second -> Triple(false, "أذان $name قد يتأخر — افحص", Icons.Outlined.NotificationImportant)
    else -> Triple(false, "أذان $name غير مجدول — افحص", Icons.Outlined.NotificationImportant)
  }
  Row(Modifier.heightIn(min = 44.dp).clip(CircleShape).clickable(onClickLabel = "افتح ضمان الأذان", role = Role.Button, onClick = onGuard).padding(horizontal = 4.dp),
    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
    Icon(icon, null, Modifier.size(14.dp), tint = if (ok) k.mint else k.gold)
    Text(text, style = DSType.labelSm.copy(fontSize = 12.sp, fontWeight = FontWeight.Normal), color = if (ok) k.textSoft else k.gold, maxLines = 1, overflow = TextOverflow.Ellipsis)
  }
}

// MARK: «الآن» — ما يناسب هذا الوقت: أذكار الصباح بعد الفجر، والمساء بعد العصر، والنوم بعد العشاء
private class NowInfo(val key: String, val period: String?, val since: String, val hint: String, val title: String, val total: Int, val done: Int, val chapter: HisnChapter?)

private fun nowInfo(tl: PrayerTimes.DayTimeline, now: Instant): NowInfo? {
  val t = tl.times; val today = Store.todayKey; val pr = Store.adhkarProgress; val day = tl.date.key
  fun after(x: Instant?) = x != null && !now.isBefore(x)
  fun before(x: Instant?) = x != null && now.isBefore(x)
  fun adhkar(period: String, map: Map<String, Int>, since: String, hint: String): NowInfo? {
    val items = Adhkar.items(period); val done = items.count { (map[it.id] ?: 0) >= it.target(period) }
    if (items.isEmpty() || done >= items.size) return null  // أُتمّت: لا شيء يُقترح الآن
    return NowInfo("$day:$period", period, since, hint, if (period == "morning") "أذكار الصباح" else "أذكار المساء", items.size, done, null)
  }
  return when {
    after(t[Prayer.FAJR]) && before(t[Prayer.DHUHR]) ->
      adhkar("morning", if (pr.date == today) pr.morning ?: emptyMap() else emptyMap(), "الآن، بعد الفجر", if (before(t[Prayer.SUNRISE])) "أفضل وقتها قبل الشروق" else "وقتها إلى الظهر")
    after(t[Prayer.ASR]) && !after(t[Prayer.ISHA]) ->
      adhkar("evening", if (pr.eveningDate == today) pr.evening ?: emptyMap() else emptyMap(), if (after(t[Prayer.MAGHRIB])) "الآن، بعد المغرب" else "الآن، بعد العصر", if (before(t[Prayer.MAGHRIB])) "أفضل وقتها قبل المغرب" else "وقتها إلى الفجر")
    after(t[Prayer.ISHA]) || before(t[Prayer.FAJR]) -> {
      // أذكار النوم من «حصن المسلم» (لا تقدّم محفوظ لها فلا نسبة) — فترتها تبدأ من عشاء يومها وإن تجاوزت منتصف الليل
      val ch = Hisn.chapters.firstOrNull { it.title == "أذكار النوم" } ?: return null
      val anchor = if (after(t[Prayer.ISHA])) day else DayKey.adding(day, -1)
      NowInfo("$anchor:sleep", null, "الآن، بعد العشاء", "قبل أن تنام", ch.title, ch.items.size, 0, ch)
    }
    else -> null
  }
}
private fun adhkarCount(n: Int) = when { n == 1 -> "ذكر واحد"; n == 2 -> "ذكران"; n in 3..10 -> "${Fmt.number(n)} أذكار"; else -> "${Fmt.number(n)} ذكرًا" }
/** تقدير جلسة الأذكار نفسه (خمسة أذكار في الدقيقة) كي يتّفق مع ما تعرضه الجلسة */
private fun aboutMinutes(n: Int) = when { n == 1 -> "نحو دقيقة"; n == 2 -> "نحو دقيقتين"; n in 3..10 -> "نحو ${Fmt.number(n)} دقائق"; else -> "نحو ${Fmt.number(n)} دقيقة" }

@Composable private fun NowCard(tl: PrayerTimes.DayTimeline, now: Instant, onAdhkar: (String) -> Unit, onChapter: (Int) -> Unit) {
  val c = DS.c
  val info = nowInfo(tl, now) ?: return
  if (Store.nowHidden == info.key) return
  val subtitle = if (info.chapter != null) "${adhkarCount(info.total)}، من حصن المسلم"
    else "${adhkarCount(info.total)}، ${aboutMinutes(maxOf(1, (info.total - info.done) / 5))}" + (if (info.done > 0) " — أتممتَ ${Fmt.number(info.done)} منها" else "")
  DSCard(Modifier.fillMaxWidth(), padding = 18.dp) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      Box(Modifier.size(7.dp).clip(CircleShape).background(c.accentGold))
      Spacer(Modifier.width(8.dp))
      Text(info.since, style = DSType.labelSm.copy(fontWeight = FontWeight.SemiBold), color = c.textPrimary, maxLines = 1)
      Spacer(Modifier.weight(1f))
      Text(info.hint, style = DSType.labelXs, color = c.textSecondary, maxLines = 1)
    }
    Spacer(Modifier.height(8.dp))
    Text(info.title, style = DSType.displayMd, color = c.textPrimary, maxLines = 1)
    Text(subtitle, style = DSType.bodySm, color = c.textSecondary, maxLines = 2)
    if (info.done > 0) { Spacer(Modifier.height(10.dp)); ProgressTrack(info.done.toFloat() / info.total, tint = c.accentGold, track = c.bgSubtle, height = 6.dp) }
    Spacer(Modifier.height(14.dp))
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      PillButton(when { info.chapter != null -> "اقرأ الأذكار"; info.done > 0 -> "أكمِل الأذكار"; else -> "ابدأ الأذكار" }, bg = c.accentGold, fg = LightDS.textPrimary) {
        val ch = info.chapter; if (ch != null) onChapter(ch.id) else info.period?.let(onAdhkar)
      }
      Spacer(Modifier.weight(1f))
      Text("ليس الآن", Modifier.heightIn(min = 44.dp).clip(CircleShape).clickable(role = Role.Button, onClickLabel = "إخفاء البطاقة حتى الوقت التالي") { Store.nowHidden = info.key; Store.save() }.padding(horizontal = 14.dp, vertical = 12.dp),
        style = DSType.labelMd, color = c.textSecondary)
    }
  }
}

/** زرّ حبّة بسهم في نهايته (يسارًا في العربية) */
@Composable private fun PillButton(label: String, bg: Color, fg: Color, modifier: Modifier = Modifier, onClick: () -> Unit) {
  Row(modifier.heightIn(min = 46.dp).clip(CircleShape).background(bg).clickable(role = Role.Button, onClick = onClick).padding(horizontal = 20.dp, vertical = 12.dp),
    horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
    Text(label, style = DSType.labelMd.copy(fontWeight = FontWeight.SemiBold), color = fg, maxLines = 1)
    Spacer(Modifier.width(6.dp))
    Icon(Icons.Filled.ChevronLeft, null, Modifier.size(16.dp), tint = fg)
  }
}

// MARK: الأدوات السريعة
@Composable private fun QuickTools(onMonth: () -> Unit, onTasbih: () -> Unit, onHisn: () -> Unit, onMosques: () -> Unit) {
  Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
    ToolTile(Icons.Outlined.CalendarMonth, "التقويم", Modifier.weight(1f), onMonth)
    ToolTile(Icons.Outlined.Grain, "المسبحة", Modifier.weight(1f), onTasbih)
    ToolTile(Icons.Outlined.Shield, "حصن المسلم", Modifier.weight(1f), onHisn)
    ToolTile(Icons.Outlined.Mosque, "المساجد", Modifier.weight(1f), onMosques)
  }
}
@Composable private fun ToolTile(icon: ImageVector, label: String, modifier: Modifier, onClick: () -> Unit) {
  val c = DS.c; val shape = RoundedCornerShape(18.dp)
  Column(modifier.clip(DS.shapeLg).clickable(role = Role.Button, onClick = onClick).padding(vertical = 4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
    Box(Modifier.size(58.dp).shadow(if (c.isDark) 0.dp else 6.dp, shape, ambientColor = c.shadow.copy(alpha = 0.08f), spotColor = c.shadow.copy(alpha = 0.10f)).clip(shape).background(c.bgSurface).border(1.dp, c.borderSubtle, shape), contentAlignment = Alignment.Center) {
      Icon(icon, null, Modifier.size(24.dp), tint = c.brandPrimary)
    }
    Spacer(Modifier.height(7.dp))
    Text(label, style = DSType.labelSm, color = c.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
  }
}

// MARK: ورد اليوم — موضع الورد من سجلّ الختمة، أو متابعة القراءة من آخر موضع حين لا خطة
private fun pagesLeft(n: Int) = when { n == 1 -> "صفحة واحدة"; n == 2 -> "صفحتان"; n in 3..10 -> "${Fmt.number(n)} صفحات"; else -> "${Fmt.number(n)} صفحة" }

@Composable private fun WirdSection(onRead: (Int, Int?) -> Unit, onKhatmah: () -> Unit) {
  val c = DS.c; val today = Store.todayKey; val plan = Store.khatmah
  val stt = plan?.let { Khatmah.status(it, Store.wird, today) }
  Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
    DSSectionHead("ورد اليوم", link = "الختمة", onLink = onKhatmah)
    DSCard(Modifier.fillMaxWidth(), padding = 18.dp) {
      if (plan != null && stt != null && !stt.finished) {
        val nextPage = ((plan.startPage - 1 + stt.done) % Khatmah.TOTAL) + 1
        val a = QuranText.shared.pageAyahs(nextPage).firstOrNull()
        val left = maxOf(0, stt.todayTarget - stt.todayPages)
        val line = "الجزء ${Fmt.number(a?.juz ?: QuranMeta.juzOfPage(nextPage))}" + (a?.let { "، من الآية ${Fmt.number(it.ayah)}" } ?: "") + " — " + (if (left > 0) "باقٍ ${pagesLeft(left)}" else "أتممتَ ورد اليوم ✓")
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
          Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(a?.let { "سورة ${QuranMeta.surah(it.surah).name}" } ?: "الصفحة ${Fmt.number(nextPage)}", style = DSType.headingLg.copy(fontSize = 20.sp), color = c.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(line, style = DSType.labelSm.copy(fontWeight = FontWeight.Normal), color = c.textSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
          }
          Spacer(Modifier.width(12.dp))
          Text("${Fmt.number(stt.percent)}٪", style = DSType.numericLg.copy(fontSize = 30.sp), color = c.brandPrimary, maxLines = 1, modifier = Modifier.semantics { contentDescription = "أُنجز ${stt.percent}٪ من الختمة" })
        }
        Spacer(Modifier.height(12.dp))
        ProgressTrack(stt.percent / 100f, tint = c.brandPrimary, track = c.bgSubtle, height = 6.dp)
        Spacer(Modifier.height(14.dp))
        PillButton("تابع القراءة", bg = c.brandPrimary, fg = c.textOnBrand, modifier = Modifier.fillMaxWidth()) { onRead(nextPage, a?.n) }
      } else {
        val last = Store.lastRead
        Text(last?.let { "سورة ${QuranMeta.surah(it.surah).name}" } ?: "سورة الفاتحة", style = DSType.headingLg.copy(fontSize = 20.sp), color = c.textPrimary, maxLines = 1)
        Spacer(Modifier.height(4.dp))
        Text(last?.let { "الجزء ${Fmt.number(QuranMeta.juzOfPage(it.page))}، الآية ${Fmt.number(it.ayah)} — الصفحة ${Fmt.number(it.page)}" } ?: "مصحف المدينة، حفص عن عاصم",
          style = DSType.labelSm.copy(fontWeight = FontWeight.Normal), color = c.textSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
        if (stt?.finished == true) { Spacer(Modifier.height(4.dp)); Text("تقبّل الله ✦ أتممت الختمة", style = DSType.labelSm, color = c.accentGoldStrong) }
        Spacer(Modifier.height(14.dp))
        PillButton(if (last == null) "افتح المصحف" else "تابع القراءة", bg = c.brandPrimary, fg = c.textOnBrand, modifier = Modifier.fillMaxWidth()) {
          onRead(last?.page ?: 1, last?.let { QuranText.shared.ayah(it.surah, it.ayah)?.n })
        }
        Text(if (stt?.finished == true) "ابدأ ختمة جديدة" else "ابدأ خطة ختمة", Modifier.align(Alignment.CenterHorizontally).padding(top = 6.dp).heightIn(min = 44.dp).clip(CircleShape).clickable(role = Role.Button, onClick = onKhatmah).padding(horizontal = 14.dp, vertical = 12.dp),
          style = DSType.labelSm, color = c.brandPrimary)
      }
    }
  }
}

// MARK: حديث اليوم — المصدر نفسه الذي تعرضه شاشة الحديث (حديث لكل يوم من مختارات الصحيحين)
@Composable private fun HadithSection(onNawawi: () -> Unit, onOpen: () -> Unit) {
  val c = DS.c; val ctx = LocalContext.current
  val today = CivilDate.of(Instant.now(), Store.zone)
  val h = remember(today.key) { HadithLibrary.hadithOfDay(today.year, today.month, today.day) }
  val fav = h.id in Store.favorites
  Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
    DSSectionHead("حديث اليوم", link = "الأربعون", onLink = onNawawi)
    DSCard(Modifier.fillMaxWidth(), padding = 18.dp, onClick = onOpen) {
      Text("«${h.text}»", fontFamily = Fonts.amiriText, fontSize = (17 * Store.textScale).sp, lineHeight = (32 * Store.textScale).sp, color = c.textPrimary, maxLines = 6, overflow = TextOverflow.Ellipsis)
      Spacer(Modifier.height(10.dp))
      Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text("${h.grade}، عن ${h.narrator}", Modifier.weight(1f), style = DSType.labelXs, color = c.textSecondary, maxLines = 2, overflow = TextOverflow.Ellipsis)
        Spacer(Modifier.width(8.dp))
        CardIconButton(if (fav) Icons.Filled.Bookmark else Icons.Outlined.BookmarkBorder, if (fav) "إزالة من المفضلة" else "حفظ في المفضلة", on = fav) {
          Store.favorites = if (fav) Store.favorites - h.id else Store.favorites + h.id; Store.save()
        }
        CardIconButton(Icons.Outlined.Share, "مشاركة الحديث") {
          val text = "${h.text}\n\nرواه ${h.narrator} — ${h.reference} (${h.grade})"
          ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), "مشاركة"))
        }
      }
    }
  }
}
/** زرّ أيقونة صغير بحدّ رفيع، ومساحة لمسٍ ٤٨ */
@Composable private fun CardIconButton(icon: ImageVector, label: String, on: Boolean = false, onClick: () -> Unit) {
  val c = DS.c
  Box(Modifier.size(48.dp).clip(CircleShape).clickable(role = Role.Button, onClick = onClick), contentAlignment = Alignment.Center) {
    Box(Modifier.size(38.dp).clip(CircleShape).background(if (on) c.brandSoft else c.bgSurface).border(1.dp, c.borderSubtle, CircleShape), contentAlignment = Alignment.Center) {
      Icon(icon, label, Modifier.size(17.dp), tint = if (on) c.brandPrimary else c.textSecondary)
    }
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

