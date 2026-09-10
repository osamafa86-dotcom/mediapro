package org.emdatra.sakinah.app.ui

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.emdatra.sakinah.app.*
import org.emdatra.sakinah.core.*
import java.time.Instant

/** المواقيت: الهجري، الصلاة القادمة بعدّ تنازلي، جدول اليوم، الموقع */
@Composable fun PrayerScreen() {
  val ctx = LocalContext.current; val scope = rememberCoroutineScope()
  var now by remember { mutableStateOf(Instant.now()) }
  LaunchedEffect(Unit) { while (true) { delay(1000); now = Instant.now() } }
  var showCity by remember { mutableStateOf(false) }; var showMethod by remember { mutableStateOf(false) }
  val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { if (it.values.any { g -> g }) scope.launch { Loc.current(ctx)?.let { l -> Loc.apply(ctx, l); Notify.schedule(ctx) } } }
  LaunchedEffect(Unit) { if (Store.coords == null && Store.locMode == "gps") { if (Loc.granted(ctx)) Loc.current(ctx)?.let { Loc.apply(ctx, it); Notify.schedule(ctx) } else permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) } }
  val tl = Store.timeline(now); val h = Hijri.date(now, Store.zone, Store.hijriOffset)
  LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    item {
      Column(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(h.formatted, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Text(Fmt.gregorian(now), color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(Modifier.clickable { showCity = true }, verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Filled.LocationOn, null, Modifier.size(16.dp)); Spacer(Modifier.width(4.dp)); Text(Store.locName ?: "حدّد الموقع", color = MaterialTheme.colorScheme.primary) }
      }
    }
    if (tl == null) {
      item { Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp)) { Text("لا موقع بعد", fontWeight = FontWeight.Bold); Text("اسمح بالوصول إلى الموقع أو اختر مدينتك لحساب المواقيت.", color = MaterialTheme.colorScheme.onSurfaceVariant); Spacer(Modifier.height(8.dp)); Row { Button(onClick = { permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) }) { Text("موقع الجهاز") }; Spacer(Modifier.width(8.dp)); OutlinedButton(onClick = { showCity = true }) { Text("اختيار مدينة") } } } } }
    } else {
      item {
        val secs = tl.next.time.epochSecond - now.epochSecond
        Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Teal)) {
          Column(Modifier.padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("الصلاة القادمة: ${tl.next.key.nameAr}${if (tl.next.isTomorrow) " (غدًا)" else ""}", color = Paper)
            Text(Fmt.time(tl.next.time), color = Paper, fontSize = 40.sp, fontWeight = FontWeight.Bold)
            Text("بعد ${Fmt.countdown(secs)}", color = Paper.copy(alpha = 0.85f))
            Text("الآن وقت ${tl.current.nameAr} · ${Methods.method(Store.methodId).nameAr}", color = Paper.copy(alpha = 0.7f), fontSize = 12.sp, modifier = Modifier.clickable { showMethod = true })
          }
        }
      }
      items(Prayer.entries) { p ->
        val t = tl.times[p]; val isNext = tl.next.key == p && !tl.next.isTomorrow
        Row(Modifier.fillMaxWidth().background(if (isNext) Teal.copy(alpha = 0.12f) else MaterialTheme.colorScheme.surface, RoundedCornerShape(12.dp)).padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
          Text(p.nameAr, fontWeight = if (isNext) FontWeight.Bold else FontWeight.Normal); Text(Fmt.time(t), fontWeight = if (isNext) FontWeight.Bold else FontWeight.Normal)
        }
      }
      item { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("منتصف الليل: ${Fmt.time(tl.sunnah.middleOfNight)}", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant); Text("الثلث الأخير: ${Fmt.time(tl.sunnah.lastThird)}", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
    }
    item { Spacer(Modifier.height(24.dp)) }
  }
  if (showCity) CityPickerSheet(onDismiss = { showCity = false }, onDevice = { showCity = false; permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) })
  if (showMethod) MethodSheet { showMethod = false }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun CityPickerSheet(onDismiss: () -> Unit, onDevice: () -> Unit) {
  val ctx = LocalContext.current
  var q by remember { mutableStateOf("") }
  val results = remember(q) { CityDatabase.bundled.search(q, 60) }
  ModalBottomSheet(onDismissRequest = onDismiss) {
    Column(Modifier.padding(16.dp).fillMaxHeight(0.9f)) {
      OutlinedTextField(q, { q = it }, Modifier.fillMaxWidth(), placeholder = { Text("ابحث عن مدينة") }, singleLine = true)
      TextButton(onClick = onDevice) { Text("استخدام موقع الجهاز") }
      LazyColumn { items(results) { c -> ListItem(headlineContent = { Text(c.nameAr) }, supportingContent = { Text("${c.countryAr} · ${c.nameEn}") }, modifier = Modifier.clickable { Store.useCity(c); Notify.schedule(ctx); onDismiss() }) } }
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun MethodSheet(onDismiss: () -> Unit) {
  val ctx = LocalContext.current
  ModalBottomSheet(onDismissRequest = onDismiss) {
    LazyColumn(Modifier.padding(bottom = 24.dp)) {
      item { ListItem(headlineContent = { Text("تلقائي حسب الدولة") }, trailingContent = { if (Store.methodAuto) Text("✓") }, modifier = Modifier.clickable { Store.methodAuto = true; Store.applyAutoMethod(); Store.save(); Notify.schedule(ctx); onDismiss() }) }
      items(Methods.order) { id -> val m = Methods.method(id); ListItem(headlineContent = { Text(m.nameAr) }, supportingContent = { Text(m.nameEn) }, trailingContent = { if (!Store.methodAuto && Store.methodId == id) Text("✓") }, modifier = Modifier.clickable { Store.methodAuto = false; Store.methodId = id; Store.save(); Notify.schedule(ctx); onDismiss() }) }
    }
  }
}
