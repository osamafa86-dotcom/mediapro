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

/** بقايا شاشة المواقيت القديمة التي ما زالت الرئيسية تستعملها: طلب الموقع، الجدول الشهري، وأوراق المدينة والطريقة */
@Composable fun LocationPrompt(onDevice: () -> Unit, onCity: () -> Unit) {
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
