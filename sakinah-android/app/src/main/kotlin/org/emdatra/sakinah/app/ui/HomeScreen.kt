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
  // ما يطلبه الشريط الجانبيّ (البحث، الإعدادات) أو رابط الإشعار الحيّ (دعاء الإفطار) يُفتح فوق «اليوم» مرّة
  LaunchedEffect(HomeRoute.request) { HomeRoute.request?.let { r -> HomeRoute.request = null; if (stack.lastOrNull() != r) push(r) } }
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
    // في الشاشات الكبيرة عمودٌ مقروء في الوسط (ولوحٌ واحد مع المفصل الفاصل) — والهاتف كما كان
    Box(Modifier.fillMaxSize().background(DS.c.bgCanvas).then(if (top == "search") Modifier else Modifier.statusBarsPadding())) { ReadableBox {
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
        top == "tasbih" -> TasbihScreen(backLabel = "اليوم") { pop() }
        top == "hisn" -> HisnScreen(onBack = { pop() }) { ch -> push("hisn:${ch.id}") }
        top.startsWith("hisn:") -> { val ch = top.removePrefix("hisn:").toIntOrNull()?.let { Hisn.chapter(it) }; if (ch != null) HisnChapterScreen(ch) { pop() } else LaunchedEffect(top) { pop() } }
        top == "hadith" || top == "nawawi" -> HadithScreen(if (top == "nawawi") "nawawi" else "sahih", initialQuery = hadithQuery) { pop() }
        else -> LaunchedEffect(top) { pop() }
      }
    } }
    if (showKhatmah) KhatmahSheet(onDismiss = { showKhatmah = false }, onGo = { p -> showKhatmah = false; openReader(p, null) })
    return
  }

  // طبعة رمضان (المرحلة الرابعة): الهيرو والبطاقة و«الآن» وختمة رمضان — بحساب الشهر الهجريّ نفسه (أو مسار اللقطات)
  val ramadan = Ramadan.active(now)
  val tl = Store.timeline(now); val h = Ramadan.hijri(now); val coords = Store.coords
  val compass = rememberCompass(enabled = coords != null)
  val prefs = Store.skyPrefs
  val sky = homeSkyState(now, tl, prefs, SkyWeatherService.current)
  // الطقس (إن فُعّل): تحديث كل ساعة حول الخلية الحالية، وبلا شبكة في وضع اللقطات
  val cell = coords?.let { SkyWeatherService.cellKey(it.latitude, it.longitude) }
  LaunchedEffect(prefs.weather, prefs.mode, cell) { if (prefs.weather && prefs.mode == SkyMode.AUTO && !ScreenshotMode.active && coords != null) SkyWeatherService.refreshIfNeeded(coords.latitude, coords.longitude) }
  // أيقونات شريط الحالة تتبع السماء: فاتحة على الداكنة، وتعود لسمة التطبيق عند مغادرة «اليوم»
  val view = LocalView.current; val appDark = DS.c.isDark
  val a = LocalAdaptive.current
  // في الموسّع والمطويّ السماءُ بطاقةٌ داخل لوحها فشريط الحالة فوق سطح التطبيق لا فوقها
  val statusOnSky = a.compact || a.tabletop || !(a.expanded || a.verticalFold != null)
  DisposableEffect(sky.palette.isDark, statusOnSky) {
    val ic = view.context.findActivity()?.let { WindowCompat.getInsetsController(it.window, view) }
    ic?.isAppearanceLightStatusBars = if (statusOnSky) !sky.palette.isDark else !appDark
    onDispose { ic?.isAppearanceLightStatusBars = !appDark }
  }
  val hero: @Composable (Modifier, HeroStyle, Boolean) -> Unit = { m, style, tools ->
    Hero(sky, prefs.reduceMotion, h, now, tl, coords, compass, ramadan, style, tools, m,
      onCity = { showCity = true }, onSearch = { push("search") }, onSettings = { push("settings") },
      onQibla = { push("qibla") }, onGuard = { push("guard") }, onMonth = { push("month") })
  }
  val nowBlock: @Composable () -> Unit = {
    if (tl == null || coords == null) LocationPrompt(onDevice = { permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) }, onCity = { showCity = true })
    else NowCard(tl, now, ramadan, onAdhkar = { period -> Store.pendingAdhkarPeriod = period; switchTab(AppTab.Adhkar) }, onChapter = { id -> push("hisn:$id") })
  }
  // في الشاشات الكبيرة بلاطةٌ خامسة لـ«ضمان الأذان» (ipad-portrait.png) — وعلى الهاتف يبقى سطره في بطاقة المواقيت
  val tools: @Composable (Boolean) -> Unit = { guard -> QuickTools(onMonth = { push("month") }, onTasbih = { push("tasbih") }, onHisn = { push("hisn") }, onMosques = { push("mosques") }, onGuard = if (guard) ({ push("guard") }) else null) }
  // «ختمة رمضان» تحلّ محلّ «ورد اليوم» طوال الشهر
  val wird: @Composable () -> Unit = {
    if (ramadan) RamadanKhatmahSection(now, onRead = { p, n -> openReader(p, n) }, onPlan = { showKhatmah = true })
    else WirdSection(onRead = { p, n -> openReader(p, n) }, onKhatmah = { showKhatmah = true })
  }
  val hadith: @Composable () -> Unit = { HadithSection(onNawawi = { open("nawawi") }, onOpen = { open("hadith") }) }
  val footer: @Composable () -> Unit = { Text("يعمل دون اتصال، لا حساب ولا تتبّع", Modifier.fillMaxWidth(), style = DSType.labelXs, color = DS.c.textTertiary, textAlign = TextAlign.Center) }
  when {
    // وضع الطاولة (tabletop.png): النصف الأعلى ساعة الصلاة بسمائها وعدّها، والنصف الأسفل «الآن» والأدوات وبقيّة اليوم
    a.tabletop -> TopBottomPane(Modifier.fillMaxSize(),
      top = { hero(Modifier.fillMaxSize(), HeroStyle.Fill, true) },
      bottom = {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(top = 8.dp, bottom = 20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
          nowBlock(); tools(!a.compact); wird(); hadith(); footer()
        }
      })
    // الهاتف: كما كان تماماً
    a.compact -> Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
      hero(Modifier, HeroStyle.Bleed, true)
      Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(top = 20.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        nowBlock(); tools(false); wird(); hadith(); footer()
      }
    }
    // الموسّع، والمطويّ مفتوحاً (fold-unfolded.png): السماء عمودٌ ثابت بجانب البطاقات، ومع الطيّ لوحان يفصلهما خطّه
    a.expanded || a.verticalFold != null -> TwoPane(Modifier.fillMaxSize(), startFraction = 0.42f, minStart = 320.dp, maxStart = 480.dp, gap = 20.dp,
      start = {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).statusBarsPadding().padding(start = 16.dp, top = 12.dp, bottom = 20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
          // البحث والإعدادات في الشريط الجانبيّ متى ظهر، وإلا في رأس السماء
          hero(Modifier.fillMaxWidth(), HeroStyle.Card, !a.expanded)
          if (tl != null && coords != null) DayPlanCard(tl, now, ramadan)
        }
      },
      end = {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).statusBarsPadding().padding(end = 20.dp, top = 12.dp, bottom = 20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
          Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("اليوم", style = DSType.displayLg, color = DS.c.textPrimary)
            Spacer(Modifier.weight(1f))
            Text(Fmt.gregorian(now), style = DSType.labelSm, color = DS.c.textSecondary, maxLines = 1)
          }
          nowBlock(); tools(true)
          BoxWithConstraints(Modifier.fillMaxWidth()) {
            if (maxWidth >= 560.dp) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) { Box(Modifier.weight(1f)) { wird() }; Box(Modifier.weight(1f)) { hadith() } }
            else Column(verticalArrangement = Arrangement.spacedBy(20.dp)) { wird(); hadith() }
          }
          footer()
        }
      })
    // المتوسط (ipad-portrait.png): السماء بعرضٍ كامل وتحتها شبكة عمودين
    else -> Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
      hero(Modifier, HeroStyle.Bleed, true)
      Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp).padding(top = 20.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        nowBlock(); tools(true)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) { Box(Modifier.weight(1f)) { wird() }; Box(Modifier.weight(1f)) { hadith() } }
        footer()
      }
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
/** شكل الهيرو: ممتدٌّ تحت شريط الحالة (الهاتف والمتوسط)، بطاقةٌ مستديرة في لوحها (الموسّع والمطويّ)، أو يملأ النصف الأعلى (الطاولة) */
enum class HeroStyle { Bleed, Card, Fill }

@Composable private fun Hero(sky: SkyState, reduceMotion: Boolean, h: HijriDate, now: Instant, tl: PrayerTimes.DayTimeline?, coords: Coordinates?, compass: CompassReading,
                             ramadan: Boolean, style: HeroStyle, showTools: Boolean, modifier: Modifier,
                             onCity: () -> Unit, onSearch: () -> Unit, onSettings: () -> Unit, onQibla: () -> Unit, onGuard: () -> Unit, onMonth: () -> Unit) {
  val p = sky.palette
  val shape = when (style) { HeroStyle.Bleed -> RoundedCornerShape(bottomStart = 32.dp, bottomEnd = 32.dp); HeroStyle.Card -> RoundedCornerShape(28.dp); HeroStyle.Fill -> RoundedCornerShape(bottomStart = 28.dp, bottomEnd = 28.dp) }
  Box(modifier.fillMaxWidth().clip(shape)) {
    SkyBackdrop(sky, reduceMotion, Modifier.matchParentSize())
    val inner = when (style) {
      HeroStyle.Bleed -> Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.statusBars).padding(start = 20.dp, end = 20.dp, top = 6.dp, bottom = 20.dp)
      HeroStyle.Card -> Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 20.dp)
      // النصف الأعلى محدود الارتفاع: يتمرّر إن ضاق
      HeroStyle.Fill -> Modifier.fillMaxSize().verticalScroll(rememberScrollState()).windowInsetsPadding(WindowInsets.statusBars).padding(start = 20.dp, end = 20.dp, top = 6.dp, bottom = 16.dp)
    }
    Column(inner) {
      TopRow(p, h, showTools, onCity, onSearch, onSettings)
      if (tl != null && coords != null) {
        Row(Modifier.fillMaxWidth().padding(top = 12.dp), verticalAlignment = Alignment.Top) {
          NextPrayerBlock(Modifier.weight(1f), tl, now, p, ramadan)
          Spacer(Modifier.width(8.dp))
          MedallionColumn(coords, compass, p, onQibla)
        }
        PrayerCard(tl, now, ramadan, Modifier.fillMaxWidth().padding(top = 16.dp), onGuard, onMonth)
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
@Composable private fun TopRow(p: SkyPalette, h: HijriDate, showTools: Boolean, onCity: () -> Unit, onSearch: () -> Unit, onSettings: () -> Unit) {
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
    // في الموسّع يحملهما الشريط الجانبيّ
    if (showTools) {
      GlassIcon(Icons.Outlined.Search, "البحث", p, onSearch)
      GlassIcon(Icons.Outlined.Tune, "الإعدادات", p, onSettings)
    }
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
@Composable private fun NextPrayerBlock(modifier: Modifier, tl: PrayerTimes.DayTimeline, now: Instant, p: SkyPalette, ramadan: Boolean) {
  val next = tl.next
  // رمضان: بين الفجر والمغرب يُسمّى الحدث القادم للصوم («يكتمل الصوم بعد — الإفطار» بوقت المغرب)، وبعد العشاء «السحور حتى — الإمساك»
  val fast = ramadan && Ramadan.fasting(tl, now)
  val suhoor = ramadan && !fast && Ramadan.suhoor(tl, now)
  val label: String; val name: String; val at: Instant
  when {
    fast -> { label = "يكتمل الصوم بعد"; name = "الإفطار"; at = tl.times.maghrib ?: next.time }
    suhoor -> { label = "السحور حتى"; name = "الإمساك"; at = Ramadan.nextImsak(tl) ?: next.time }
    else -> { label = if (next.key == Prayer.SUNRISE) "الوقت القادم" else "الصلاة القادمة"; name = if (next.isTomorrow) "فجر الغد" else next.key.nameAr; at = next.time }
  }
  val time = clock(at)
  Column(modifier.semantics(mergeDescendants = true) {}, verticalArrangement = Arrangement.spacedBy(2.dp)) {
    Text(label, style = DSType.labelSm.copy(fontSize = 13.sp, letterSpacing = 0.4.sp), color = p.gold)
    Text(name, Modifier.padding(top = 2.dp), style = DSType.displayLg.copy(fontSize = 30.sp, lineHeight = 40.sp), color = p.text, maxLines = 1)
    Text(time, style = DSType.numericHero.copy(fontSize = if (time.length > 4) 52.sp else 64.sp, lineHeight = 70.sp), color = p.text, maxLines = 1, softWrap = false)
    Text(remainingLabel(at.epochSecond - now.epochSecond), Modifier.padding(top = 4.dp).clip(CircleShape).background(CardInk.gold).padding(horizontal = 12.dp, vertical = 5.dp),
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
/** أعمدة بطاقة المواقيت: الخمس والشروق بينها (أعاده المالك بعد أن حُذف في إعادة التصميم) — CardPrayers تبقى للصلوات الخمس وحدها (حصّة القراءة) */
private val TimeCols = listOf(Prayer.FAJR, Prayer.SUNRISE, Prayer.DHUHR, Prayer.ASR, Prayer.MAGHRIB, Prayer.ISHA)

/** عمودٌ في بطاقة المواقيت: الاسم والوقت، والقادم مميّز؛ والشروق (وقتٌ لا صلاة) أخفت ما لم يكن القادم */
private class CardCol(val name: String, val time: Instant?, val on: Boolean, val quiet: Boolean = false)

/**
 * شريط «مضى ٧٢٪ من وقت العصر»، والصلوات الخمس والشروق بأوقاتها (القادم في مستطيلٍ أفتح)، ثم سطر ضمان الأذان (يمين) و«جدول الشهر» (يسار).
 * في رمضان: «مضى ٩٠٪ من صيام اليوم» من الفجر إلى المغرب، والأعمدة الإمساك والشروق والظهر والعصر والإفطار والعشاء.
 */
@Composable private fun PrayerCard(tl: PrayerTimes.DayTimeline, now: Instant, ramadan: Boolean, modifier: Modifier, onGuard: () -> Unit, onMonth: () -> Unit) {
  val k = CardInk; val shape = RoundedCornerShape(22.dp)
  val fast = ramadan && Ramadan.fasting(tl, now)
  // نسبة ما مضى من وقت الصلاة الحالية: من دخولها إلى دخول التالية — وفي الصوم من الفجر إلى المغرب
  val start = if (fast) tl.times.fajr else tl.times[tl.current]?.takeIf { !it.isAfter(now) } ?: tl.yesterdayIsha
  val endAt = if (fast) tl.times.maghrib ?: tl.next.time else tl.next.time
  val total = start?.let { (endAt.epochSecond - it.epochSecond).toDouble() } ?: 0.0
  val pct = if (start != null && total > 0) ((now.epochSecond - start.epochSecond) / total).coerceIn(0.0, 1.0) else 0.0
  val currentName = if (tl.current == Prayer.SUNRISE) "الضحى" else tl.current.nameAr
  // العمود المميّز: القادم (فجر الغد بعد العشاء، وعشاء الأمس حين يتأخر بعد منتصف الليل، والشروق بين الفجر وطلوع الشمس)
  val highlight: Prayer? = when { tl.next.isTomorrow -> Prayer.FAJR; tl.next.isYesterday -> Prayer.ISHA; else -> tl.next.key }
  fun timeOf(pr: Prayer) = if (pr == highlight) tl.next.time else tl.times[pr]
  val cols = if (ramadan) {
    // الإمساك مكان الفجر (القادم بعد العشاء)، والمغرب «الإفطار»؛ والمميّز الإمساك ما دام السحور قائماً
    val suhoor = Ramadan.suhoor(tl, now)
    listOf(CardCol("الإمساك", Ramadan.nextImsak(tl), suhoor),
      CardCol(Prayer.SUNRISE.nameAr, timeOf(Prayer.SUNRISE), highlight == Prayer.SUNRISE && !suhoor, quiet = highlight != Prayer.SUNRISE),
      CardCol(Prayer.DHUHR.nameAr, timeOf(Prayer.DHUHR), highlight == Prayer.DHUHR), CardCol(Prayer.ASR.nameAr, timeOf(Prayer.ASR), highlight == Prayer.ASR),
      CardCol("الإفطار", timeOf(Prayer.MAGHRIB), highlight == Prayer.MAGHRIB), CardCol(Prayer.ISHA.nameAr, timeOf(Prayer.ISHA), highlight == Prayer.ISHA))
  } else TimeCols.map { pr -> CardCol(pr.nameAr, timeOf(pr), pr == highlight, quiet = pr == Prayer.SUNRISE && pr != highlight) }
  Column(modifier.clip(shape).background(k.stops.first().toColor().copy(alpha = 0.58f)).border(1.dp, k.glassStroke, shape).padding(horizontal = 14.dp, vertical = 12.dp)) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
      Text(if (fast) "مضى ${Fmt.number((pct * 100).toInt())}٪ من صيام اليوم" else "مضى ${Fmt.number((pct * 100).toInt())}٪ من وقت $currentName", style = DSType.labelXs.copy(fontSize = 11.5.sp), color = k.textSoft, maxLines = 1)
      ProgressTrack(pct.toFloat(), Modifier.weight(1f), tint = k.text, track = k.glassStroke, height = 3.dp)
    }
    Spacer(Modifier.height(10.dp))
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
      cols.forEach { col ->
        val on = col.on
        val cellShape = RoundedCornerShape(14.dp)
        Column(Modifier.weight(1f).clip(cellShape).background(if (on) k.glassStroke else Color.Transparent).then(if (on) Modifier.border(1.dp, k.glassStroke, cellShape) else Modifier)
          .clearAndSetSemantics { contentDescription = "${col.name} ${Fmt.time(col.time)}" + (if (on) "، القادمة" else "") }
          .padding(vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
          Text(col.name, style = DSType.labelXs.copy(fontSize = 11.5.sp, fontWeight = if (on) FontWeight.SemiBold else FontWeight.Medium), color = if (on) k.text else k.textMuted, maxLines = 1)
          Text(clock(col.time), style = DSType.numericSm.copy(fontWeight = if (on) FontWeight.SemiBold else FontWeight.Medium), color = if (col.quiet) k.textSoft else k.text, maxLines = 1)
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
private class NowInfo(val key: String, val period: String?, val since: String, val hint: String, val title: String, val total: Int, val done: Int, val chapter: HisnChapter?,
                      /** نصٌّ بدل سطر العدد (دعاء الإفطار، تذكير السحور) وعنوان الزرّ */ val body: String? = null, val cta: String? = null)

private fun nowInfo(tl: PrayerTimes.DayTimeline, now: Instant, ramadan: Boolean = false): NowInfo? {
  val t = tl.times; val today = Store.todayKey; val pr = Store.adhkarProgress; val day = tl.date.key
  fun after(x: Instant?) = x != null && !now.isBefore(x)
  fun before(x: Instant?) = x != null && now.isBefore(x)
  // رمضان: آخر نصف ساعة قبل المغرب «دعاء الإفطار»، وآخر ساعة قبل الإمساك «السحور»؛ وإلا أذكار الوقت كالمعتاد
  if (ramadan) {
    val maghrib = t.maghrib
    if (Ramadan.fasting(tl, now) && maghrib != null && !now.isBefore(maghrib.minusSeconds(30 * 60)))
      return NowInfo("$day:iftar", null, "الآن، قبل الإفطار", "دعوة الصائم لا تُردّ", "دعاء الإفطار", 0, 0, Hisn.chapter(68),
        body = "«ذهب الظمأ وابتلّت العروق، وثبت الأجر إن شاء الله» — يُعرض لك عند الأذان", cta = "افتح الأدعية")
    val imsak = Ramadan.nextImsak(tl)
    if (imsak != null && Ramadan.suhoor(tl, now) && !now.isBefore(imsak.minusSeconds(60 * 60)))
      return NowInfo("${DayKey.key(imsak, Store.zone)}:suhoor", null, "الآن، قبل الإمساك", "الإمساك ${clock(imsak)}", "السحور", 0, 0, Hisn.chapter(69),
        body = "«تسحّروا فإنّ في السَّحور بركة» — متفق عليه", cta = "أدعية الطعام")
  }
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

@Composable private fun NowCard(tl: PrayerTimes.DayTimeline, now: Instant, ramadan: Boolean, onAdhkar: (String) -> Unit, onChapter: (Int) -> Unit) {
  val c = DS.c
  val info = nowInfo(tl, now, ramadan) ?: return
  if (Store.nowHidden == info.key) return
  val subtitle = if (info.body != null) info.body else if (info.chapter != null) "${adhkarCount(info.total)}، من حصن المسلم"
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
    Text(subtitle, style = DSType.bodySm, color = c.textSecondary, maxLines = if (info.body != null) 3 else 2)
    if (info.done > 0) { Spacer(Modifier.height(10.dp)); ProgressTrack(info.done.toFloat() / info.total, tint = c.accentGold, track = c.bgSubtle, height = 6.dp) }
    Spacer(Modifier.height(14.dp))
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      PillButton(info.cta ?: when { info.chapter != null -> "اقرأ الأذكار"; info.done > 0 -> "أكمِل الأذكار"; else -> "ابدأ الأذكار" }, bg = c.accentGold, fg = LightDS.textPrimary) {
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
@Composable private fun QuickTools(onMonth: () -> Unit, onTasbih: () -> Unit, onHisn: () -> Unit, onMosques: () -> Unit, onGuard: (() -> Unit)? = null) {
  Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
    ToolTile(Icons.Outlined.CalendarMonth, "التقويم", Modifier.weight(1f), onMonth)
    ToolTile(Icons.Outlined.Grain, "المسبحة", Modifier.weight(1f), onTasbih)
    ToolTile(Icons.Outlined.Shield, "حصن المسلم", Modifier.weight(1f), onHisn)
    ToolTile(Icons.Outlined.Mosque, "المساجد", Modifier.weight(1f), onMosques)
    if (onGuard != null) ToolTile(Icons.Outlined.NotificationsActive, "ضمان الأذان", Modifier.weight(1f), onGuard)
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

// MARK: ختمة رمضان (المرحلة الرابعة — ramadan-today.png): تحلّ محلّ «ورد اليوم» طوال الشهر، فوق محرّك الختمة نفسه
private fun daysCount(n: Int) = when { n == 1 -> "يوم واحد"; n == 2 -> "يومان"; n in 3..10 -> "${Fmt.number(n)} أيام"; else -> "${Fmt.number(n)} يوماً" }
/** «أربعٌ بعد كلّ صلاة» — العدد مع «صفحة» محذوفةً بعده كما يُقال */
private fun perPrayerLabel(n: Int) = when (n) {
  1 -> "صفحةٌ"; 2 -> "صفحتان"; 3 -> "ثلاثٌ"; 4 -> "أربعٌ"; 5 -> "خمسٌ"; 6 -> "ستٌّ"; 7 -> "سبعٌ"; 8 -> "ثمانٍ"; 9 -> "تسعٌ"; 10 -> "عشرٌ"
  else -> pagesLeft(n)
} + " بعد كلّ صلاة"
private fun behindLabel(days: Int) = when { days == 1 -> "متأخر يوماً"; days == 2 -> "متأخر يومين"; days in 3..10 -> "متأخر ${Fmt.number(days)} أيام"; else -> "متأخر ${Fmt.number(days)} يوماً" }

@Composable private fun RamadanKhatmahSection(now: Instant, onRead: (Int, Int?) -> Unit, onPlan: () -> Unit) {
  val c = DS.c; val ctx = LocalContext.current; val today = Store.todayKey
  val plan = Store.khatmah
  Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
    DSSectionHead("ختمة رمضان", link = "الخطة", onLink = onPlan)
    if (plan == null || !Ramadan.isPlan(plan, today, now)) {
      // عرضُ الختمة: المصحف كاملاً على ما بقي من الشهر — خطّة ختمةٍ عادية في المحرّك القائم
      val left = Ramadan.daysLeft(now); val perDay = Math.ceil(Khatmah.TOTAL.toDouble() / maxOf(1, left)).toInt()
      DSCard(Modifier.fillMaxWidth(), padding = 18.dp) {
        Text("ختمةٌ واحدة في الشهر", style = DSType.headingLg.copy(fontSize = 20.sp), color = c.textPrimary)
        Spacer(Modifier.height(4.dp))
        Text("يُقسَم المصحف على ما بقي من رمضان: ${daysCount(left)}، نحو ${pagesLeft(perDay)} كلّ يوم — ${perPrayerLabel(Math.ceil(perDay / 5.0).toInt())}.", style = DSType.labelSm.copy(fontWeight = FontWeight.Normal), color = c.textSecondary)
        val active = plan != null && Khatmah.status(plan, Store.wird, today).finished.not()
        if (active) { Spacer(Modifier.height(4.dp)); Text("تحلّ محلّ خطّة الختمة الحالية، ويبقى تذكيرها", style = DSType.labelXs, color = c.textTertiary) }
        Spacer(Modifier.height(14.dp))
        PillButton("ابدأ ختمة رمضان", bg = c.brandPrimary, fg = c.textOnBrand, modifier = Modifier.fillMaxWidth()) { Ramadan.startPlan(ctx, now) }
      }
      return@Column
    }
    val stt = Khatmah.status(plan, Store.wird, today)
    val nextPage = ((plan.startPage - 1 + stt.done) % Khatmah.TOTAL) + 1
    val first = QuranText.shared.pageAyahs(nextPage).firstOrNull()
    val rDay = Ramadan.day(now) ?: 1; val length = Ramadan.length(now); val firstKey = Ramadan.firstDayKey(today, now)
    DSCard(Modifier.fillMaxWidth(), padding = 18.dp, onClick = if (stt.finished) null else ({ onRead(nextPage, first?.n) })) {
      Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
          Text(if (stt.finished) "تقبّل الله ✦ أتممتَ ختمة رمضان" else "الجزء ${Fmt.number(first?.juz ?: QuranMeta.juzOfPage(nextPage))} من ${Fmt.number(30)}", style = DSType.headingLg.copy(fontSize = 20.sp), color = c.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
          Text("الهدف: ختمةٌ واحدة في الشهر", style = DSType.labelSm.copy(fontWeight = FontWeight.Normal), color = c.textSecondary, maxLines = 1)
        }
        if (!stt.finished) {
          val behindDays = if (stt.behind > 0) Math.ceil(stt.behind.toDouble() / maxOf(1, plan.dailyPages)).toInt() else 0
          Text(if (behindDays == 0) "في موعده" else behindLabel(behindDays),
            Modifier.clip(CircleShape).background(if (behindDays == 0) c.brandSoft else c.accentGoldSoft).padding(horizontal = 12.dp, vertical = 5.dp),
            style = DSType.labelSm.copy(fontWeight = FontWeight.SemiBold), color = if (behindDays == 0) c.brandStrong else c.accentGoldStrong, maxLines = 1)
        }
      }
      Spacer(Modifier.height(12.dp))
      // شريط الشهر: يومٌ لكل خانة — ما قُرئ فيه ممتلئ، واليوم ذهبيّ، والعشر الأواخر بلونٍ ذهبيّ خفيف
      val doneDays = (1..length).map { d -> d < rDay && Wird.pages(Store.wird, DayKey.adding(firstKey, d - 1)) > 0 }
      Row(Modifier.fillMaxWidth().height(22.dp).semantics { contentDescription = doneDays.count { it }.let { n -> if (n == 0) "لا قراءة فيما مضى من الشهر" else "قرأتَ في ${daysCount(n)} مما مضى من الشهر" } + "، واليوم ${Fmt.number(rDay)} من ${Fmt.number(length)}" },
        horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
        for (d in 1..length) {
          val bg = when { d == rDay -> c.accentGold; doneDays[d - 1] -> c.brandPrimary; d > length - 10 -> c.accentGoldSoft; else -> c.bgSubtle }
          Box(Modifier.weight(1f).height(if (d == rDay) 22.dp else 16.dp).clip(RoundedCornerShape(4.dp)).background(bg))
        }
      }
      Spacer(Modifier.height(6.dp))
      Row(Modifier.fillMaxWidth()) {
        Text("اليوم ${Fmt.number(rDay)}", style = DSType.labelXs, color = c.accentGoldStrong)
        Spacer(Modifier.weight(1f))
        Text("العشر الأواخر", style = DSType.labelXs, color = c.textTertiary)
      }
      if (!stt.finished) {
        // حصّة اليوم بإعادة التوزيع (الباقي على الأيام الباقية)، مقسومةً على الصلوات الخمس ومعلَّمةً بما قُرئ فعلاً اليوم
        val share = Ramadan.share(stt); val per = maxOf(1, Math.ceil(share / 5.0).toInt())
        Spacer(Modifier.height(12.dp))
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(c.accentGoldSoft.copy(alpha = 0.7f)).padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
          Text("حصّة اليوم: ${pagesLeft(share)}، ${perPrayerLabel(per)}", style = DSType.labelMd.copy(fontWeight = FontWeight.SemiBold), color = c.textPrimary)
          Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            CardPrayers.forEachIndexed { i, pr ->
              val ticked = stt.todayPages >= per * (i + 1)
              val shape = RoundedCornerShape(12.dp)
              Column(Modifier.weight(1f).clip(shape).background(if (ticked) c.brandPrimary else c.bgSurface).then(if (ticked) Modifier else Modifier.border(1.dp, c.borderSubtle, shape))
                .clearAndSetSemantics { contentDescription = "${pr.nameAr}: " + if (ticked) "قُرئت حصّتها" else pagesLeft(per) }
                .padding(vertical = 7.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(pr.nameAr, style = DSType.labelXs, color = if (ticked) c.textOnBrand else c.textSecondary, maxLines = 1)
                if (ticked) Icon(Icons.Filled.Check, null, Modifier.size(15.dp), tint = c.textOnBrand)
                else Text(pagesLeft(per), style = DSType.labelXs.copy(fontWeight = FontWeight.SemiBold), color = c.textPrimary, maxLines = 1)
              }
            }
          }
        }
        Spacer(Modifier.height(10.dp))
        Text("فاتك يوم؟ لا بأس — يُوزَّع الباقي على ما بقي من الشهر دون لوم.", style = DSType.labelSm.copy(fontWeight = FontWeight.Normal), color = c.textSecondary)
      }
    }
  }
}

// MARK: خطّ اليوم (الموسّع — ipad-landscape.png): عبادة كلّ وقت تحت السماء في عمودها، والآن مميّز بين أوقاته
private class PlanRow(val name: String, val time: Instant?, val note: String, val done: Boolean = false, val state: Int /* ٠ مضى، ١ الآن، ٢ القادم، ٣ لاحقاً */)

@Composable private fun DayPlanCard(tl: PrayerTimes.DayTimeline, now: Instant, ramadan: Boolean) {
  val c = DS.c; val t = tl.times; val day = tl.date.key; val today = Store.todayKey
  fun past(x: Instant?) = x != null && !now.isBefore(x)
  val nextKey = tl.next.key.takeIf { !tl.next.isTomorrow && !tl.next.isYesterday }
  val pr = Store.adhkarProgress
  val morningDone = pr.date == today && Adhkar.items("morning").let { items -> items.isNotEmpty() && items.all { (pr.morning?.get(it.id) ?: 0) >= it.target("morning") } }
  val eveningDone = pr.eveningDate == today && Adhkar.items("evening").let { items -> items.isNotEmpty() && items.all { (pr.evening?.get(it.id) ?: 0) >= it.target("evening") } }
  val wirdLeft = Store.khatmah?.let { plan -> val stt = Khatmah.status(plan, Store.wird, today); if (stt.finished) 0 else maxOf(0, (if (ramadan) Ramadan.share(stt) else stt.todayTarget) - stt.todayPages) } ?: 0
  fun prayed(p: Prayer) = Store.hasPrayed(day, p)
  val entries = listOf(
    Triple(Prayer.FAJR, Prayer.FAJR.nameAr, if (ramadan) "الإمساك ${clock(Ramadan.imsak(t.fajr))}" else "أذكار الصباح"),
    Triple(Prayer.SUNRISE, "الضحى", "صلاة الضحى"),
    Triple(Prayer.DHUHR, Prayer.DHUHR.nameAr, ""),
    Triple(Prayer.ASR, Prayer.ASR.nameAr, if (eveningDone) "أذكار المساء" else ""),
    Triple(Prayer.MAGHRIB, if (ramadan) "الإفطار" else Prayer.MAGHRIB.nameAr, ""),
    Triple(Prayer.ISHA, Prayer.ISHA.nameAr, if (wirdLeft > 0) "${if (ramadan) "حصّة الختمة" else "ورد الختمة"}: ${pagesLeft(wirdLeft)}" else ""),
  )
  val rows = ArrayList<PlanRow>()
  var nowPlaced = false
  val nowTitle = nowInfo(tl, now, ramadan)?.title ?: ""
  for ((p, name, note0) in entries) {
    val time = t[p]
    if (!nowPlaced && !past(time)) { rows.add(PlanRow("الآن", now, nowTitle, state = 1)); nowPlaced = true }
    val isPrayed = p != Prayer.SUNRISE && prayed(p)
    val done = when (p) { Prayer.FAJR -> morningDone && !ramadan; Prayer.ASR -> eveningDone; else -> isPrayed }
    val note = when {
      p == nextKey -> LiveDay.afterLabel(tl.next.time.epochSecond - now.epochSecond)
      isPrayed && note0.isEmpty() -> "صلّيتَ"
      else -> note0
    }
    rows.add(PlanRow(name, time, note, done, if (past(time)) 0 else if (p == nextKey) 2 else 3))
  }
  if (!nowPlaced) rows.add(PlanRow("الآن", now, nowTitle, state = 1))
  rows.add(PlanRow("قبل النوم", null, "أذكار النوم وسورة الملك", state = if (past(t.isha)) 2 else 3))
  DSCard(Modifier.fillMaxWidth(), padding = 16.dp) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      Text("خطّ اليوم", style = DSType.headingMd, color = c.textPrimary)
      Spacer(Modifier.weight(1f))
      Text("عبادة كلّ وقت", style = DSType.labelXs, color = c.textSecondary)
    }
    Spacer(Modifier.height(8.dp))
    rows.forEach { r ->
      val on = r.state == 1
      Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(if (on) c.accentGoldSoft else Color.Transparent).heightIn(min = 40.dp).padding(horizontal = 8.dp, vertical = 6.dp)
        .semantics(mergeDescendants = true) {}, verticalAlignment = Alignment.CenterVertically) {
        val dot = when (r.state) { 0 -> c.brandPrimary; 1 -> c.accentGold; else -> Color.Transparent }
        Box(Modifier.size(9.dp).clip(CircleShape).background(dot).then(if (r.state >= 2) Modifier.border(1.5.dp, if (r.state == 2) c.brandPrimary else c.borderStrong, CircleShape) else Modifier))
        Spacer(Modifier.width(10.dp))
        Text(r.name, style = DSType.labelMd.copy(fontWeight = if (on || r.state == 2) FontWeight.SemiBold else FontWeight.Medium), color = c.textPrimary, maxLines = 1)
        if (r.time != null) { Spacer(Modifier.width(8.dp)); Text(clock(r.time), style = DSType.numericSm, color = c.textSecondary, maxLines = 1) }
        Spacer(Modifier.weight(1f))
        if (r.done) { Icon(Icons.Filled.Check, null, Modifier.size(14.dp), tint = c.brandPrimary); Spacer(Modifier.width(4.dp)) }
        Text(r.note, style = DSType.labelXs.copy(fontWeight = if (on) FontWeight.SemiBold else FontWeight.Medium), color = when { on -> c.accentGoldStrong; r.state == 2 -> c.brandPrimary; else -> c.textSecondary }, maxLines = 1, overflow = TextOverflow.Ellipsis)
      }
    }
  }
}

// MARK: حديث اليوم — المصدر نفسه الذي تعرضه شاشة الحديث (حديث لكل يوم من مختارات الصحيحين)
@Composable private fun HadithSection(onNawawi: () -> Unit, onOpen: () -> Unit) {
  Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
    DSSectionHead("حديث اليوم", link = "الأربعون", onLink = onNawawi)
    TodayHadithCard(onOpen)
  }
}
/** بطاقة حديث اليوم (نصّه، درجته وراويه، الحفظ في المفضّلة والمشاركة) — في «اليوم» وفي «المكتبة» بعينها */
@Composable fun TodayHadithCard(onOpen: () -> Unit, modifier: Modifier = Modifier) {
  val c = DS.c; val ctx = LocalContext.current
  val today = CivilDate.of(Instant.now(), Store.zone)
  val h = remember(today.key) { HadithLibrary.hadithOfDay(today.year, today.month, today.day) }
  val fav = h.id in Store.favorites
  DSCard(modifier.fillMaxWidth(), padding = 18.dp, onClick = onOpen) {
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

