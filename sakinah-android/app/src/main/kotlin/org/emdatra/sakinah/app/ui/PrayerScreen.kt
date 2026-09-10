package org.emdatra.sakinah.app.ui

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.emdatra.sakinah.app.*
import org.emdatra.sakinah.core.*
import java.time.Instant

/** شاشة المواقيت (تصميم Figma 01): ترحيب وموقع، حبّة التاريخ الهجري، بطاقة الصلاة القادمة بعدّ تنازلي وشريط تقدّم، جدول اليوم مع تذكير كل صلاة، بلاطات الوصول السريع، السنن */
@Composable fun PrayerScreen() {
  val ctx = LocalContext.current; val scope = rememberCoroutineScope(); val c = DS.c; val switchTab = LocalSwitchTab.current
  var now by remember { mutableStateOf(Instant.now()) }
  LaunchedEffect(Unit) { while (true) { delay(1000); now = Instant.now() } }
  var showCity by remember { mutableStateOf(false) }; var showMethod by remember { mutableStateOf(false) }; var showMonth by remember { mutableStateOf(false) }
  val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { if (it.values.any { g -> g }) scope.launch { Loc.current(ctx)?.let { l -> Loc.apply(ctx, l); Notify.schedule(ctx) } } }
  LaunchedEffect(Unit) { if (Store.coords == null && Store.locMode == "gps") { if (Loc.granted(ctx)) Loc.current(ctx)?.let { Loc.apply(ctx, it); Notify.schedule(ctx) } else permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) } }
  if (showMonth) { MonthScreen(onBack = { showMonth = false }); return }
  val tl = Store.timeline(now); val h = Hijri.date(now, Store.zone, Store.hijriOffset)
  Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(top = 6.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
    // رأس الصفحة
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      Column(Modifier.weight(1f)) {
        Text("السلام عليكم ورحمة الله", style = DSType.labelSm, color = c.textSecondary)
        Row(verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Filled.Place, null, Modifier.size(16.dp), tint = c.brandPrimary); Spacer(Modifier.width(6.dp)); Text(Store.locName ?: "حدّد موقعك", style = DSType.displayMd, color = c.textPrimary, maxLines = 1) }
      }
      DSIconButton(Icons.Outlined.CalendarMonth, contentDescription = "الجدول الشهري", onClick = { showMonth = true }); Spacer(Modifier.width(8.dp))
      DSIconButton(if (Store.locMode == "gps") Icons.Outlined.MyLocation else Icons.Outlined.Place, contentDescription = "الموقع", onClick = { showCity = true })
    }
    DSPill(Icons.Outlined.DarkMode, "${h.weekday} ${h.formatted}", Fmt.gregorian(now).substringAfter("، ").substringBeforeLast(" "))
    if (tl == null) LocationPrompt(onDevice = { permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) }, onCity = { showCity = true })
    else {
      NextPrayerHero(tl, now, onMethod = { showMethod = true })
      TodayCard(tl, onMonth = { showMonth = true })
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        DSQuickTile(Icons.Outlined.Explore, "القبلة", Modifier.weight(1f)) { switchTab(AppTab.Qibla) }
        DSQuickTile(Icons.Outlined.CalendarMonth, "الإمساكية", Modifier.weight(1f)) { showMonth = true }
        DSQuickTile(Icons.Outlined.Grain, "الأذكار", Modifier.weight(1f)) { switchTab(AppTab.Adhkar) }
        DSQuickTile(Icons.Outlined.MenuBook, "الورد", Modifier.weight(1f)) { switchTab(AppTab.Mushaf) }
      }
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { DSStatTile(Fmt.time(tl.sunnah.middleOfNight), "منتصف الليل", Modifier.weight(1f)); DSStatTile(Fmt.time(tl.sunnah.lastThird), "الثلث الأخير", Modifier.weight(1f)) }
    }
  }
  if (showCity) CityPickerSheet(onDismiss = { showCity = false }, onDevice = { showCity = false; permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) })
  if (showMethod) MethodSheet { showMethod = false }
}

@Composable private fun NextPrayerHero(tl: PrayerTimes.DayTimeline, now: Instant, onMethod: () -> Unit) {
  val c = DS.c
  val secs = tl.next.time.epochSecond - now.epochSecond
  val start = tl.times[tl.current] ?: tl.yesterdayIsha
  val total = start?.let { (tl.next.time.epochSecond - it.epochSecond).toFloat() } ?: 0f
  val elapsed = if (start != null && total > 0f) ((now.epochSecond - start.epochSecond) / total).coerceIn(0f, 1f) else 0f
  NightCard(Modifier.fillMaxWidth()) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      Text("الصلاة القادمة", style = DSType.labelMd, color = c.textOnDarkMuted); Spacer(Modifier.weight(1f))
      Row(Modifier.clip(CircleShape).background(Color.White.copy(alpha = 0.12f)).clickable(onClick = onMethod).padding(horizontal = 12.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Outlined.Tune, null, Modifier.size(12.dp), tint = c.accentGold); Spacer(Modifier.width(6.dp)); Text(Methods.method(Store.methodId).nameAr, style = DSType.labelSm, color = c.accentGold, maxLines = 1) }
    }
    Spacer(Modifier.height(10.dp))
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
      Text(if (tl.next.isTomorrow) "فجر الغد" else tl.next.key.nameAr, style = DSType.displayHero, color = c.textOnDark); Spacer(Modifier.weight(1f))
      Text(Fmt.countdown(secs), style = DSType.numericHero, color = c.textOnDark, maxLines = 1)
    }
    Spacer(Modifier.height(6.dp))
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      Text("الأذان ${Fmt.time(tl.next.time)}  ·  الآن وقت ${tl.current.nameAr}", style = DSType.labelSm, color = c.textOnDarkMuted); Spacer(Modifier.weight(1f))
      Text("مضى ${Fmt.number((elapsed * 100).toInt())}٪", style = DSType.labelSm, color = c.accentGold)
    }
    Spacer(Modifier.height(12.dp))
    ProgressTrack(elapsed)
  }
}

private fun prayerIcon(p: Prayer): ImageVector = when (p) { Prayer.FAJR -> Icons.Outlined.WbTwilight; Prayer.SUNRISE -> Icons.Outlined.WbSunny; Prayer.DHUHR -> Icons.Outlined.LightMode; Prayer.ASR -> Icons.Outlined.WbSunny; Prayer.MAGHRIB -> Icons.Outlined.WbTwilight; Prayer.ISHA -> Icons.Outlined.DarkMode }

@Composable private fun TodayCard(tl: PrayerTimes.DayTimeline, onMonth: () -> Unit) {
  val c = DS.c; val ctx = LocalContext.current
  DSCard(Modifier.fillMaxWidth(), padding = 8.dp) {
    DSSectionHead("مواقيت اليوم", Modifier.padding(horizontal = 8.dp, vertical = 8.dp), link = "الجدول الشهري", onLink = onMonth)
    Prayer.entries.forEach { p ->
      val isNext = tl.next.key == p && !tl.next.isTomorrow; val remind = Store.reminders.prayers.contains(p.id)
      val tint = if (isNext) c.brandPrimary else c.textPrimary
      Row(Modifier.fillMaxWidth().clip(DS.shapeLg).background(if (isNext) c.brandSoft else Color.Transparent).padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(prayerIcon(p), null, Modifier.size(20.dp), tint = if (isNext) c.brandPrimary else c.textTertiary); Spacer(Modifier.width(10.dp))
        Text(p.nameAr, style = if (isNext) DSType.headingSm else DSType.bodyLg, color = tint)
        if (isNext) { Spacer(Modifier.width(8.dp)); DSBadge("القادمة") }
        Spacer(Modifier.weight(1f))
        Text(Fmt.time(tl.times[p]), style = DSType.numericMd, color = tint); Spacer(Modifier.width(10.dp))
        Icon(if (remind) Icons.Filled.Notifications else Icons.Outlined.NotificationsOff, if (remind) "إيقاف تذكير ${p.nameAr}" else "تفعيل تذكير ${p.nameAr}", Modifier.size(32.dp).clip(CircleShape).clickable { val r = Store.reminders; Store.reminders = r.copy(prayers = if (remind) r.prayers - p.id else r.prayers + p.id); Store.save(); Notify.schedule(ctx) }.padding(7.dp), tint = if (remind) (if (isNext) c.brandPrimary else c.textSecondary) else c.textTertiary)
      }
    }
  }
}

@Composable private fun LocationPrompt(onDevice: () -> Unit, onCity: () -> Unit) {
  val c = DS.c
  DSCard(Modifier.fillMaxWidth(), padding = 24.dp) {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
      DSIconButton(Icons.Outlined.LocationOn, style = IconStyle.Soft, size = 72.dp, iconSize = 32.dp)
      Text("حدّد موقعك لحساب المواقيت", style = DSType.headingLg, color = c.textPrimary, textAlign = TextAlign.Center)
      Text("يُستخدم الموقع على جهازك فقط لحساب المواقيت واتجاه القبلة، ولا يُرسل إلى أي خادم.", style = DSType.bodyMd, color = c.textSecondary, textAlign = TextAlign.Center)
      DSButton("استخدام موقع الجهاز", Modifier.fillMaxWidth(), icon = Icons.Outlined.MyLocation, onClick = onDevice)
      DSButton("اختيار مدينة يدويًا · ٦٤٩ مدينة", Modifier.fillMaxWidth(), kind = ButtonKind.Outline, icon = Icons.Outlined.Search, onClick = onCity)
    }
  }
}

/** الجدول الشهري (نسخة مبسّطة حتى مرحلة التنفيذ التالية) */
@Composable fun MonthScreen(onBack: () -> Unit) {
  val c = DS.c
  androidx.activity.compose.BackHandler(onBack = onBack)
  val zone = Store.zone; val today = java.time.LocalDate.now(zone); val coords = Store.coords
  Column(Modifier.fillMaxSize()) {
    DSNavBar("الجدول الشهري", subtitle = "${Fmt.number(today.monthValue)}/${Fmt.number(today.year)} · ${Store.locName ?: ""}", onBack = onBack)
    if (coords == null) { Text("لا موقع بعد", Modifier.padding(20.dp), color = c.textSecondary); return }
    val heads = listOf("اليوم", "الفجر", "الشروق", "الظهر", "العصر", "المغرب", "العشاء")
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
      item { DSCard(Modifier.fillMaxWidth(), padding = 8.dp) {
        Row(Modifier.fillMaxWidth().padding(vertical = 6.dp)) { heads.forEachIndexed { i, hd -> Text(hd, Modifier.weight(if (i == 0) 1.15f else 1f), style = DSType.labelXs, color = c.textTertiary, textAlign = TextAlign.Center) } }
        (1..today.lengthOfMonth()).forEach { d ->
          val date = today.withDayOfMonth(d); val civil = CivilDate(date.year, date.monthValue, d)
          val r = PrayerTimes.compute(coords, civil, Store.params()); val isToday = d == today.dayOfMonth
          Row(Modifier.fillMaxWidth().clip(DS.shapeMd).background(if (isToday) c.brandSoft else Color.Transparent).padding(vertical = 7.dp, horizontal = 2.dp)) {
            val col = if (isToday) c.brandPrimary else c.textPrimary
            Text("${Fmt.number(d)} ${Hijri.weekdaysAr[date.dayOfWeek.value % 7].take(1)}", Modifier.weight(1.15f), style = DSType.labelXs, color = if (isToday) c.brandPrimary else c.textSecondary, textAlign = TextAlign.Center)
            listOf(r.fajr, r.sunrise, r.dhuhr, r.asr, r.maghrib, r.isha).forEach { t -> Text(Fmt.time(t).substringBefore(" "), Modifier.weight(1f), style = DSType.labelXs, color = col, textAlign = TextAlign.Center) }
          }
        }
      } }
      item { Spacer(Modifier.height(24.dp)) }
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun CityPickerSheet(onDismiss: () -> Unit, onDevice: () -> Unit) {
  val ctx = LocalContext.current; val c = DS.c
  var q by remember { mutableStateOf("") }
  val results = remember(q) { CityDatabase.bundled.search(q, 60) }
  ModalBottomSheet(onDismissRequest = onDismiss, containerColor = c.bgSurface) {
    Column(Modifier.padding(16.dp).fillMaxHeight(0.9f)) {
      OutlinedTextField(q, { q = it }, Modifier.fillMaxWidth(), placeholder = { Text("ابحث عن مدينة") }, singleLine = true, shape = DS.shapeLg)
      Spacer(Modifier.height(8.dp))
      DSButton("استخدام موقع الجهاز", Modifier.fillMaxWidth(), kind = ButtonKind.Soft, icon = Icons.Outlined.MyLocation, onClick = onDevice)
      LazyColumn(Modifier.padding(top = 8.dp)) { items(results) { city -> DSRow(Icons.Outlined.Place, city.nameAr, "${city.countryAr} · ${city.nameEn}", onClick = { Store.useCity(city); Notify.schedule(ctx); onDismiss() }) } }
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun MethodSheet(onDismiss: () -> Unit) {
  val ctx = LocalContext.current; val c = DS.c
  ModalBottomSheet(onDismissRequest = onDismiss, containerColor = c.bgSurface) {
    LazyColumn(Modifier.padding(bottom = 24.dp, start = 8.dp, end = 8.dp)) {
      item { DSToggleRow("تلقائي حسب الدولة", "تُختار الهيئة الرسمية لبلدك من الموقع", Store.methodAuto) { on -> Store.methodAuto = on; if (on) Store.applyAutoMethod(); Store.save(); Notify.schedule(ctx) } }
      item { Text("مذهب العصر", Modifier.padding(horizontal = 14.dp, vertical = 8.dp), style = DSType.labelSm, color = c.textTertiary); Row(Modifier.padding(horizontal = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) { DSChip("الجمهور (مثل الظل)", Store.madhab == "shafi") { Store.madhab = "shafi"; Store.save(); Notify.schedule(ctx) }; DSChip("الحنفي (مثلا الظل)", Store.madhab == "hanafi") { Store.madhab = "hanafi"; Store.save(); Notify.schedule(ctx) } } }
      item { Text("الطرق", Modifier.padding(horizontal = 14.dp, vertical = 8.dp), style = DSType.labelSm, color = c.textTertiary) }
      items(Methods.order) { id -> val m = Methods.method(id); val on = !Store.methodAuto && Store.methodId == id
        DSRow(Icons.Outlined.Public, m.nameAr, m.nameEn, iconStyle = if (on) IconStyle.Brand else IconStyle.Soft, onClick = { Store.methodAuto = false; Store.methodId = id; Store.save(); Notify.schedule(ctx); onDismiss() }) { if (on) Icon(Icons.Filled.Check, null, Modifier.size(18.dp), tint = c.brandPrimary) } }
    }
  }
}
