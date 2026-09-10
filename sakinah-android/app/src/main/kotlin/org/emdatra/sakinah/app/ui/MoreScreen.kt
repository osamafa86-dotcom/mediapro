package org.emdatra.sakinah.app.ui

import android.Manifest
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.emdatra.sakinah.app.*
import org.emdatra.sakinah.core.*
import java.time.Instant

/** المزيد: الأحاديث، الإعدادات، حديث اليوم */
@Composable fun MoreScreen() {
  var screen by remember { mutableStateOf("home") }
  BackHandler(screen != "home") { screen = "home" }
  when (screen) { "hadith" -> HadithScreen(); "settings" -> SettingsScreen(); else -> {
    val today = CivilDate.of(Instant.now(), Store.zone); val hd = HadithLibrary.hadithOfDay(today.year, today.month, today.day)
    Column(Modifier.fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { Card(Modifier.weight(1f).clickable { screen = "hadith" }) { Column(Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) { Icon(Icons.Filled.AutoStories, null, tint = Teal); Text("الأحاديث", fontWeight = FontWeight.Bold); Text("الصحيحان والأربعون النووية", fontSize = 11.sp) } }; Card(Modifier.weight(1f).clickable { screen = "settings" }) { Column(Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) { Icon(Icons.Filled.Settings, null, tint = Teal); Text("الإعدادات", fontWeight = FontWeight.Bold); Text("الموقع والحساب والتنبيهات", fontSize = 11.sp) } } }
      Card(Modifier.fillMaxWidth().clickable { screen = "hadith" }) { Column(Modifier.padding(14.dp)) { Text("✦ حديث اليوم", color = Gold, fontWeight = FontWeight.Bold, fontSize = 12.sp); Text(hd.text, fontFamily = Fonts.amiri, fontSize = 16.sp, lineHeight = 30.sp); Text("عن ${hd.narrator} — ${hd.reference}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
      Text("سكينة · تطبيق أصلي لأندرويد (Kotlin/Compose) فوق النواة نفسها المُتحقَّق منها في الويب وiOS · يعمل دون اتصال · لا حساب ولا تتبّع", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
  } }
}
@Composable fun HadithScreen() {
  val ctx = LocalContext.current
  var book by remember { mutableStateOf("sahih") }; var topic by remember { mutableStateOf("all") }; var q by remember { mutableStateOf("") }
  val favs = Store.favorites.toSet()
  LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
    item { Row(Modifier.padding(top = 12.dp)) { FilterChip(book == "sahih", { book = "sahih"; topic = "all" }, { Text("مختارات من الصحيحين") }, Modifier.padding(end = 6.dp)); FilterChip(book == "nawawi", { book = "nawawi"; topic = "all" }, { Text("الأربعون النووية") }) } }
    item { OutlinedTextField(q, { q = it }, Modifier.fillMaxWidth(), placeholder = { Text("ابحث في نص الحديث أو الراوي…") }, singleLine = true) }
    item { Row(Modifier.horizontalScroll(rememberScrollState())) { (listOf("all" to "الكل", "fav" to "♥ المفضلة") + (if (book == "sahih") HadithLibrary.topics.map { it to it } else emptyList())).forEach { (k, l) -> FilterChip(topic == k, { topic = k }, { Text(l) }, Modifier.padding(end = 6.dp)) } } }
    if (book == "sahih") items(HadithLibrary.searchSahih(q, if (topic == "all" || topic == "fav") null else topic, favs, topic == "fav")) { h ->
      val text = "${h.text}\n\nرواه ${h.narrator} — ${h.reference} (${h.grade})"
      Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(14.dp)) { Text(h.text, fontFamily = Fonts.amiri, fontSize = (17 * Store.textScale).sp, lineHeight = (32 * Store.textScale).sp); Text("عن ${h.narrator} · ${h.grade} · ${h.reference} · ${h.topic}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant); Row { IconButton(onClick = { Store.favorites = if (h.id in favs) Store.favorites - h.id else Store.favorites + h.id; Store.save() }) { Icon(if (h.id in favs) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder, "مفضلة", tint = if (h.id in favs) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant) }; IconButton(onClick = { ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), "مشاركة")) }) { Icon(Icons.Filled.Share, "مشاركة") }; IconButton(onClick = { ShareCard.share(ctx, ShareCard.render(ctx, "حديث شريف · ${h.grade}", h.text, "عن ${h.narrator} — ${h.reference}", false), "hadith-${h.id}.png", text) }) { Icon(Icons.Filled.Image, "مشاركة كصورة") } }; var lesson by remember { mutableStateOf(false) }; TextButton(onClick = { lesson = !lesson }) { Text("الفائدة من الحديث") }; if (lesson) Text(h.lesson, fontSize = 14.sp) } }
    } else items(HadithLibrary.searchNawawi(q, favs, topic == "fav")) { n ->
      Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(14.dp)) { Text(n.title, color = Gold, fontWeight = FontWeight.Bold, fontSize = 12.sp); Text(n.text, fontFamily = Fonts.amiri, fontSize = (17 * Store.textScale).sp, lineHeight = (32 * Store.textScale).sp); Text(n.takhrij, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant); Row { IconButton(onClick = { Store.favorites = if (n.id in favs) Store.favorites - n.id else Store.favorites + n.id; Store.save() }) { Icon(if (n.id in favs) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder, "مفضلة") }; IconButton(onClick = { ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, "${n.text}\n\n${n.takhrij}\n— الأربعون النووية، ${n.title}"), "مشاركة")) }) { Icon(Icons.Filled.Share, "مشاركة") }; IconButton(onClick = { ShareCard.share(ctx, ShareCard.render(ctx, "الأربعون النووية · ${n.title}", n.text, n.takhrij.take(70), false), "${n.id}.png", "${n.text}\n\n${n.takhrij}") }) { Icon(Icons.Filled.Image, "مشاركة كصورة") } } } }
    }
    item { Spacer(Modifier.height(24.dp)) }
  }
}
@Composable fun SettingsScreen() {
  val ctx = LocalContext.current
  var showCity by remember { mutableStateOf(false) }; var showMethod by remember { mutableStateOf(false) }; var msg by remember { mutableStateOf<String?>(null) }
  val notifPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok -> Store.reminders = Store.reminders.copy(enabled = ok); Store.save(); Notify.schedule(ctx) }
  val exporter = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri: Uri? -> uri?.let { ctx.contentResolver.openOutputStream(it)?.use { os -> os.write(Backup.export().encoded().toByteArray()) }; msg = "صُدّرت النسخة" } }
  val importer = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? -> uri?.let { val text = ctx.contentResolver.openInputStream(it)?.use { s -> s.readBytes().toString(Charsets.UTF_8) } ?: ""; msg = runCatching { Backup.apply(WebBackup.parse(text)); Notify.schedule(ctx); "استُعيدت النسخة" }.getOrElse { "الملف ليس نسخة احتياطية من سكينة" } } }
  Column(Modifier.fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState())) {
    Text("الموقع والمواقيت", fontWeight = FontWeight.Bold, color = Teal)
    ListItem(headlineContent = { Text("المكان") }, supportingContent = { Text(Store.locName ?: "غير محدد") }, modifier = Modifier.clickable { showCity = true })
    ListItem(headlineContent = { Text("طريقة الحساب") }, supportingContent = { Text(if (Store.methodAuto) "تلقائي: ${Methods.method(Store.methodId).nameAr}" else Methods.method(Store.methodId).nameAr) }, modifier = Modifier.clickable { showMethod = true })
    Row(verticalAlignment = Alignment.CenterVertically) { Text("مذهب العصر", Modifier.weight(1f)); FilterChip(Store.madhab == "shafi", { Store.madhab = "shafi"; Store.save(); Notify.schedule(ctx) }, { Text("الجمهور") }, Modifier.padding(end = 6.dp)); FilterChip(Store.madhab == "hanafi", { Store.madhab = "hanafi"; Store.save(); Notify.schedule(ctx) }, { Text("الحنفي") }) }
    Row(verticalAlignment = Alignment.CenterVertically) { Text("خطوط العرض العالية", Modifier.weight(1f)); Row(Modifier.horizontalScroll(rememberScrollState())) { HighLatitudeRule.entries.forEach { r -> FilterChip(Store.highLat == r.id, { Store.highLat = r.id; Store.save(); Notify.schedule(ctx) }, { Text(if (r == HighLatitudeRule.AUTO) "تلقائي" else r.nameAr) }, Modifier.padding(end = 6.dp)) } } }
    Text("الإشعارات", fontWeight = FontWeight.Bold, color = Teal, modifier = Modifier.padding(top = 12.dp))
    RowSwitch("تذكير بمواعيد الصلاة", Store.reminders.enabled) { on -> if (on && android.os.Build.VERSION.SDK_INT >= 33) notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS) else { Store.reminders = Store.reminders.copy(enabled = on); Store.save(); Notify.schedule(ctx) } }
    if (Store.reminders.enabled) {
      Prayer.entries.forEach { p -> RowSwitch(if (p == Prayer.SUNRISE) "الشروق (تنبيه هادئ)" else p.nameAr, p.id in Store.reminders.prayers) { on -> Store.reminders = Store.reminders.copy(prayers = if (on) Store.reminders.prayers + p.id else Store.reminders.prayers - p.id); Store.save(); Notify.schedule(ctx) } }
      Row(verticalAlignment = Alignment.CenterVertically) { Text("تذكير قبل الأذان", Modifier.weight(1f)); Row(Modifier.horizontalScroll(rememberScrollState())) { listOf(0, 5, 10, 15, 20, 30).forEach { m -> FilterChip(Store.reminders.preMinutes == m, { Store.reminders = Store.reminders.copy(preMinutes = m); Store.save(); Notify.schedule(ctx) }, { Text(if (m == 0) "لا" else Fmt.number(m)) }, Modifier.padding(end = 4.dp)) } } }
      Row(verticalAlignment = Alignment.CenterVertically) { Text("الصوت", Modifier.weight(1f)); listOf("adhan-fakhry" to "أذان", "chime" to "نغمة", "none" to "صامت").forEach { (k, l) -> FilterChip(Store.reminders.sound == k, { Store.reminders = Store.reminders.copy(sound = k); Store.save(); Notify.schedule(ctx) }, { Text(l) }, Modifier.padding(end = 4.dp)) } }
    }
    RowSwitch("أذكار الصباح بعد الفجر", Store.extras.adhkarMorning) { Store.extras = Store.extras.copy(adhkarMorning = it); Store.save(); Notify.schedule(ctx) }
    RowSwitch("أذكار المساء بعد العصر", Store.extras.adhkarEvening) { Store.extras = Store.extras.copy(adhkarEvening = it); Store.save(); Notify.schedule(ctx) }
    RowSwitch("حديث اليوم (٩ صباحًا)", Store.extras.hadithDaily) { Store.extras = Store.extras.copy(hadithDaily = it); Store.save(); Notify.schedule(ctx) }
    Text("العرض", fontWeight = FontWeight.Bold, color = Teal, modifier = Modifier.padding(top = 12.dp))
    RowSwitch("نظام 12 ساعة", Store.hour12) { Store.hour12 = it; Store.save() }
    Row(verticalAlignment = Alignment.CenterVertically) { Text("الأرقام", Modifier.weight(1f)); FilterChip(Store.numerals == "latn", { Store.numerals = "latn"; Store.save() }, { Text("1 2 3") }, Modifier.padding(end = 6.dp)); FilterChip(Store.numerals == "arab", { Store.numerals = "arab"; Store.save() }, { Text("١ ٢ ٣") }) }
    Row(verticalAlignment = Alignment.CenterVertically) { Text("تعديل التاريخ الهجري: ${Fmt.number(Store.hijriOffset)} يوم", Modifier.weight(1f)); OutlinedButton(onClick = { Store.hijriOffset = maxOf(-2, Store.hijriOffset - 1); Store.save() }) { Text("−") }; Spacer(Modifier.width(6.dp)); OutlinedButton(onClick = { Store.hijriOffset = minOf(2, Store.hijriOffset + 1); Store.save() }) { Text("+") } }
    Row(verticalAlignment = Alignment.CenterVertically) { Text("حجم خط الأذكار والأحاديث ${Fmt.decimal(Store.textScale, 1)}×", Modifier.weight(1f)); OutlinedButton(onClick = { Store.textScale = maxOf(0.8, Store.textScale - 0.1); Store.save() }) { Text("أ-") }; Spacer(Modifier.width(6.dp)); OutlinedButton(onClick = { Store.textScale = minOf(1.6, Store.textScale + 0.1); Store.save() }) { Text("أ+") } }
    Text("النسخة الاحتياطية", fontWeight = FontWeight.Bold, color = Teal, modifier = Modifier.padding(top = 12.dp))
    Row { Button(onClick = { exporter.launch("sakinah-backup-${Store.todayKey}.json") }) { Text("تصدير") }; Spacer(Modifier.width(8.dp)); OutlinedButton(onClick = { importer.launch(arrayOf("application/json", "text/plain", "*/*")) }) { Text("استيراد") } }
    Text("الصيغة نفسها في نسخة الويب ونسخة iOS من سكينة: تنقل الإعدادات والعلامات والختمة والمسبحة بين النسخ.", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    if (msg != null) Text(msg!!, color = Teal, modifier = Modifier.padding(top = 6.dp))
    Spacer(Modifier.height(32.dp))
  }
  if (showCity) CityPickerSheet(onDismiss = { showCity = false }, onDevice = { showCity = false })
  if (showMethod) MethodSheet { showMethod = false }
}
