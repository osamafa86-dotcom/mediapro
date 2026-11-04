package org.emdatra.sakinah.app.ui

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.emdatra.sakinah.BuildConfig
import org.emdatra.sakinah.app.*
import org.emdatra.sakinah.core.*
import java.time.ZonedDateTime

/** صفحة التواصل القائمة (سياسة الخصوصية وبيانات المتجر): مسائل المشروع على GitHub — لا بريد مخترَع */
private const val CONTACT_URL = "https://github.com/osamafa86-dotcom/mediapro/issues"
private const val APP_ID = "org.emdatra.sakinah"
private val SUB_SCREENS = setOf("sky", "guard", "notifications", "numbers", "privacy")

/**
 * الإعدادات في خمس مجموعات (settings-ios-light.png): الصلاة، التنبيهات، القرآن والتلاوة، المظهر، عن سكينة.
 * صفّ لكل إعداد: أيقونة في مربّع ناعم، عنوان، قيمة حالية، وسهم — وكل ما كان في الإعدادات القديمة باقٍ في صفٍّ أو صفحةٍ فرعية.
 * `initial` يفتح صفحةً فرعية أو ورقةً مباشرةً (من البحث الشامل أو وضع اللقطات).
 */
@Composable fun SettingsScreen(backLabel: String = "اليوم", initial: String? = null, onBack: () -> Unit) {
  val ctx = LocalContext.current; val c = DS.c; val scope = rememberCoroutineScope()
  val stack = remember { mutableStateListOf<String>().apply { initial?.takeIf { it in SUB_SCREENS }?.let { add(it) } } }
  var sheet by remember { mutableStateOf(initial?.takeIf { it !in SUB_SCREENS }) }
  var msg by remember { mutableStateOf<String?>(null) }
  // المشغّلات قبل أي فرع كي تبقى مسجّلة ما دامت الإعدادات ظاهرة
  val exporter = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri: Uri? ->
    uri?.let { ctx.contentResolver.openOutputStream(it)?.use { os -> os.write(Backup.export().encoded().toByteArray()) }; msg = "صُدّرت النسخة" }
  }
  val importer = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
    uri?.let {
      val text = ctx.contentResolver.openInputStream(it)?.use { s -> s.readBytes().toString(Charsets.UTF_8) } ?: ""
      msg = runCatching { Backup.apply(WebBackup.parse(text)); Notify.schedule(ctx); "استُعيدت النسخة" }.getOrElse { "الملف ليس نسخة احتياطية من سكينة" }
    }
  }
  val locPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { g -> if (g.values.any { it }) scope.launch { Loc.current(ctx)?.let { l -> Loc.apply(ctx, l); Notify.schedule(ctx) } } }
  BackHandler(stack.isNotEmpty()) { stack.removeAt(stack.lastIndex) }
  val pop: () -> Unit = { if (stack.isNotEmpty()) stack.removeAt(stack.lastIndex) }

  when (stack.lastOrNull()) {
    "sky" -> { SkySettingsScreen(onBack = pop); return }
    "guard" -> { AdhanGuardScreen(onBack = pop); return }
    "notifications" -> { NotificationsSettings(onBack = pop, onGuard = { stack.add("guard") }); return }
    "numbers" -> { NumbersSettings(onBack = pop); return }
    "privacy" -> { PrivacyScreen(onBack = pop); return }
  }

  Column(Modifier.fillMaxSize().background(c.bgCanvas).verticalScroll(rememberScrollState())) {
    Row(Modifier.padding(start = 10.dp, top = 6.dp).heightIn(min = 44.dp).clip(CircleShape).clickable(role = Role.Button, onClickLabel = "رجوع إلى $backLabel", onClick = onBack).padding(horizontal = 6.dp),
      verticalAlignment = Alignment.CenterVertically) {
      Icon(Icons.Filled.ChevronRight, null, Modifier.size(22.dp), tint = c.brandPrimary)
      Text(backLabel, style = DSType.labelMd.copy(fontWeight = FontWeight.SemiBold), color = c.brandPrimary)
    }
    Text("الإعدادات", Modifier.padding(horizontal = 20.dp).padding(bottom = 10.dp), style = DSType.displayLg, color = c.textPrimary)
    Column(Modifier.fillMaxWidth().padding(16.dp, 0.dp, 16.dp, 32.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
      SettingsGroup("الصلاة") {
        SettingsLink(Icons.Outlined.Place, "الموقع", Store.locName ?: "غير محدد") { sheet = "city" }
        DSDivider()
        SettingsLink(Icons.Outlined.CalendarMonth, "طريقة الحساب", Methods.method(Store.methodId).nameAr) { sheet = "method" }
        DSDivider()
        SettingsLink(Icons.Outlined.WbSunny, "وقت العصر", if (Store.madhab == "hanafi") "الحنفي" else "الجمهور") { sheet = "asr" }
      }
      SettingsGroup("التنبيهات") {
        SettingsLink(Icons.Outlined.Notifications, "الأذان", adhanValue()) { stack.add("notifications") }
        DSDivider()
        SettingsLink(Icons.Outlined.AutoAwesome, "تذكير الأذكار", adhkarReminderValue()) { sheet = "adhkar-reminders" }
        DSDivider()
        SettingsLink(Icons.Outlined.MenuBook, "تذكير الورد", wirdReminderValue()) { sheet = "khatmah" }
      }
      SettingsGroup("القرآن والتلاوة") {
        SettingsLink(Icons.Outlined.BookmarkBorder, "المصحف والخط", if (Store.view == "text") "نص متدفق" else "مصحف المدينة") { sheet = "display" }
        DSDivider()
        SettingsLink(Icons.Outlined.Headphones, "القارئ", Catalog.shared.reciter(Store.reciter).name) { sheet = "reciter" }
        DSDivider()
        SettingsLink(Icons.Outlined.Download, "التنزيلات", AudioDownloads.totalBytes().let { if (it > 0) AudioDownloads.fmtBytes(it) else "لا تنزيلات" }) { sheet = "downloads" }
      }
      SettingsGroup("المظهر") {
        SettingsLink(Icons.Outlined.WbTwilight, "السماء", skyValue()) { stack.add("sky") }
        DSDivider()
        // «الوضع» (فاتح/داكن) يتبع النظام في أندرويد ولا إعداد له في التطبيق، فلا صفّ له
        SettingsLink(Icons.Outlined.FormatSize, "حجم خط القراءة", "${Fmt.number((Store.textScale * 100).toInt())}٪") { sheet = "textscale" }
        DSDivider()
        SettingsLink(Icons.Outlined.Schedule, "الأرقام والوقت والتاريخ", if (Store.hour12) "${Fmt.number(12)} ساعة" else "${Fmt.number(24)} ساعة") { stack.add("numbers") }
      }
      SettingsGroup("عن سكينة") {
        SettingsLink(Icons.Outlined.PrivacyTip, "الخصوصية", null) { stack.add("privacy") }
        DSDivider()
        SettingsLink(Icons.Outlined.MailOutline, "تواصل معنا", null) { openUrl(ctx, CONTACT_URL) }
        DSDivider()
        SettingsLink(Icons.Outlined.StarOutline, "قيّم التطبيق", null) { rateApp(ctx) }
        DSDivider()
        SettingsLink(Icons.Outlined.Backup, "النسخة الاحتياطية", null) { sheet = "backup" }
      }
      Text("سكينة ${BuildConfig.VERSION_NAME} — بلا إعلانات ولا تتبّع", Modifier.fillMaxWidth(), style = DSType.labelXs, color = c.textTertiary, textAlign = TextAlign.Center)
    }
  }

  val close = { sheet = null }
  when (sheet) {
    "city" -> CityPickerSheet(onDismiss = close, onDevice = { sheet = null; locPermission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) })
    "method" -> MethodSheet(close)
    "asr" -> AsrSheet(close)
    "adhkar-reminders" -> AdhkarRemindersSheet(ctx, close)
    "khatmah" -> KhatmahSheet(onDismiss = close)
    "display" -> PlainSheet(close) { DisplaySheet() }
    "reciter" -> PlainSheet(close) { ReciterList(close) }
    "downloads" -> PlainSheet(close) { DownloadsSheet(null) }
    "textscale" -> TextScaleSheet(close)
    "backup" -> BackupSheet(msg, onExport = { exporter.launch("sakinah-backup-${Store.todayKey}.json") }, onImport = { importer.launch(arrayOf("application/json", "text/plain", "*/*")) }, onDismiss = { sheet = null; msg = null })
  }
}

// MARK: قيم الصفوف
private fun adhanValue(): String {
  val r = Store.reminders; if (!r.enabled) return "مطفأ"
  val n = r.prayers.count { it != Prayer.SUNRISE.id }
  return when { n == 0 -> "بلا صلوات"; n == 1 -> "صلاة واحدة"; n == 2 -> "صلاتان"; else -> "${Fmt.number(n)} صلوات" }
}
private fun adhkarReminderValue(): String { val e = Store.extras; return when { e.adhkarMorning && e.adhkarEvening -> "الصباح والمساء"; e.adhkarMorning -> "الصباح"; e.adhkarEvening -> "المساء"; e.hadithDaily -> "حديث اليوم"; else -> "مطفأ" } }
private fun wirdReminderValue(): String {
  val rem = Store.khatmah?.reminder ?: return "مطفأ"
  Reminders.afterPrayer(rem)?.let { return "بعد ${it.nameAr}" }
  val hm = Reminders.parseHM(rem) ?: return "مطفأ"
  return Fmt.time(ZonedDateTime.now(Store.zone).withHour(hm.first).withMinute(hm.second).toInstant())
}
private fun skyValue(): String { val p = Store.skyPrefs; return when (p.mode) { SkyMode.AUTO -> if (p.weather) "حيّة مع الوقت والطقس" else "حيّة مع الوقت"; SkyMode.FIXED -> "ثابتة: ${p.fixedPhase.nameAr}"; SkyMode.CUSTOM -> "بلونك: ${p.accent.nameAr}" } }

private fun openUrl(ctx: Context, url: String) { runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } }
/** صفحة التطبيق في متجر Google Play، وإن لم يوجد المتجر فصفحته على الويب */
private fun rateApp(ctx: Context) {
  try { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$APP_ID"))) }
  catch (e: ActivityNotFoundException) { openUrl(ctx, "https://play.google.com/store/apps/details?id=$APP_ID") }
}

// MARK: مكوّنات الصفحة
@Composable fun SettingsGroup(title: String, content: @Composable ColumnScope.() -> Unit) {
  Column {
    Text(title, Modifier.padding(start = 6.dp, bottom = 8.dp), style = DSType.labelSm, color = DS.c.textSecondary)
    DSCard(Modifier.fillMaxWidth(), padding = 4.dp, content = content)
  }
}
/** صفّ إعداد: أيقونة في مربّع ناعم (يمين)، العنوان، القيمة الحالية (يسار)، وسهم */
@Composable fun SettingsLink(icon: ImageVector, title: String, value: String?, onClick: () -> Unit) {
  val c = DS.c
  Row(Modifier.fillMaxWidth().clip(DS.shapeLg).clickable(role = Role.Button, onClick = onClick).heightIn(min = 52.dp).padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
    Box(Modifier.size(36.dp).clip(RoundedCornerShape(10.dp)).background(c.brandSoft), contentAlignment = Alignment.Center) { Icon(icon, null, Modifier.size(18.dp), tint = c.brandPrimary) }
    Spacer(Modifier.width(12.dp))
    Text(title, Modifier.weight(1f), style = DSType.bodyMd.copy(fontWeight = FontWeight.Medium), color = c.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
    if (value != null) { Spacer(Modifier.width(8.dp)); Text(value, Modifier.widthIn(max = 170.dp), style = DSType.labelSm.copy(fontWeight = FontWeight.Normal), color = c.textSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis) }
    Spacer(Modifier.width(4.dp))
    DSChevron()
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun PlainSheet(onDismiss: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
  ModalBottomSheet(onDismissRequest = onDismiss, containerColor = DS.c.bgSurface, content = content)
}

/** وقت العصر: الجمهور (ظلّ الشيء مثله) أو الحنفي (مثلاه) — الخيار نفسه الذي في ورقة الطريقة */
@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun AsrSheet(onDismiss: () -> Unit) {
  val ctx = LocalContext.current; val c = DS.c
  ModalBottomSheet(onDismissRequest = onDismiss, containerColor = c.bgSurface) {
    Column(Modifier.fillMaxWidth().padding(16.dp, 0.dp, 16.dp, 32.dp)) {
      Text("وقت العصر", style = DSType.headingMd, color = c.textPrimary)
      Spacer(Modifier.height(8.dp))
      listOf(Triple("shafi", "الجمهور", "حين يصير ظلّ الشيء مثله"), Triple("hanafi", "الحنفي", "حين يصير ظلّ الشيء مثليه")).forEachIndexed { i, (id, name, sub) ->
        if (i > 0) DSDivider()
        val on = Store.madhab == id
        DSRow(Icons.Outlined.WbSunny, name, sub, iconStyle = if (on) IconStyle.Brand else IconStyle.Soft, onClick = { Store.madhab = id; Store.save(); Notify.schedule(ctx); onDismiss() }) {
          if (on) Icon(Icons.Filled.Check, "مختار", Modifier.size(18.dp), tint = c.brandPrimary)
        }
      }
    }
  }
}

/** حجم نص الأذكار والأحاديث (القيمة نفسها التي كانت في الإعدادات) مع معاينة */
@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun TextScaleSheet(onDismiss: () -> Unit) {
  val c = DS.c
  val sample = remember { Adhkar.all.firstOrNull()?.text("morning")?.take(90) ?: "" }
  ModalBottomSheet(onDismissRequest = onDismiss, containerColor = c.bgSurface) {
    Column(Modifier.fillMaxWidth().padding(16.dp, 0.dp, 16.dp, 32.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      Text("حجم خط القراءة", style = DSType.headingMd, color = c.textPrimary)
      Text("لنصوص الأذكار والأحاديث؛ وحجم خطّ المصحف من «المصحف والخط».", style = DSType.labelXs, color = c.textSecondary)
      if (sample.isNotEmpty()) Text(sample, Modifier.fillMaxWidth().clip(DS.shapeMd).background(c.paperPage).padding(14.dp), fontFamily = Fonts.amiriText, fontSize = (17 * Store.textScale).sp, lineHeight = (32 * Store.textScale).sp, color = c.paperInk, maxLines = 3, overflow = TextOverflow.Ellipsis)
      StepperRow("حجم النص", "${Fmt.number((Store.textScale * 100).toInt())}٪", Icons.Outlined.FormatSize,
        onMinus = { Store.textScale = maxOf(0.8, Store.textScale - 0.1); Store.save() },
        onPlus = { Store.textScale = minOf(1.6, Store.textScale + 0.1); Store.save() })
    }
  }
}

/** النسخة الاحتياطية: الصيغة نفسها في الويب وiOS وأندرويد */
@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun BackupSheet(msg: String?, onExport: () -> Unit, onImport: () -> Unit, onDismiss: () -> Unit) {
  val c = DS.c
  ModalBottomSheet(onDismissRequest = onDismiss, containerColor = c.bgSurface) {
    Column(Modifier.fillMaxWidth().padding(16.dp, 0.dp, 16.dp, 32.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      Text("النسخة الاحتياطية", style = DSType.headingMd, color = c.textPrimary)
      Text("الصيغة نفسها في نسخ الويب وiOS وأندرويد: تنقل الإعدادات والعلامات والختمة والمسبحة بين النسخ. كل الحسابات تجري على جهازك؛ لا حساب ولا تتبّع.", style = DSType.bodySm, color = c.textSecondary)
      Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        DSButton("تصدير نسخة", modifier = Modifier.weight(1f), icon = Icons.Outlined.Upload, onClick = onExport)
        DSButton("استيراد", kind = ButtonKind.Outline, modifier = Modifier.weight(1f), icon = Icons.Outlined.Download, onClick = onImport)
      }
      if (msg != null) Text(msg, style = DSType.labelSm, color = c.brandPrimary)
    }
  }
}

@Composable private fun StepperRow(title: String, value: String, icon: ImageVector, onMinus: () -> Unit, onPlus: () -> Unit) {
  val c = DS.c
  Row(Modifier.fillMaxWidth().padding(12.dp, 8.dp), verticalAlignment = Alignment.CenterVertically) {
    DSIconButton(icon, style = IconStyle.Soft, size = 38.dp, iconSize = 16.dp)
    Spacer(Modifier.width(12.dp))
    Column(Modifier.weight(1f)) {
      Text(title, style = DSType.bodyMd, color = c.textPrimary)
      Text(value, style = DSType.labelXs, color = c.textSecondary)
    }
    DSIconButton(Icons.Outlined.Add, contentDescription = "زيادة", style = IconStyle.Soft, size = 40.dp, iconSize = 15.dp, onClick = onPlus)
    Spacer(Modifier.width(8.dp))
    DSIconButton(Icons.Outlined.Remove, contentDescription = "إنقاص", style = IconStyle.Soft, size = 40.dp, iconSize = 15.dp, onClick = onMinus)
  }
}

// MARK: صفحة الأذان والتنبيهات — كل ما كان في مجموعة «الإشعارات»، وفي رأسها «ضمان الأذان»
@Composable private fun NotificationsSettings(onBack: () -> Unit, onGuard: () -> Unit) {
  val ctx = LocalContext.current; val c = DS.c
  var showPrayers by remember { mutableStateOf(false) }
  var testSent by remember { mutableStateOf(false) }
  LaunchedEffect(testSent) { if (testSent) { delay(12_000); testSent = false } }
  val notifPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok -> Store.reminders = Store.reminders.copy(enabled = ok); Store.save(); Notify.schedule(ctx) }
  // يُعاد فحصه عند العودة من شاشة النظام (onResume في MainActivity يعيد الجدولة دقيقةً بعد المنح)
  var exactOk by remember { mutableStateOf(Notify.exactAllowed(ctx)) }
  fun promoted(): Boolean = android.os.Build.VERSION.SDK_INT < 36 || ctx.getSystemService(android.app.NotificationManager::class.java).canPostPromotedNotifications()
  var promotedOk by remember { mutableStateOf(promoted()) }
  androidx.lifecycle.compose.LifecycleResumeEffect(Unit) { exactOk = Notify.exactAllowed(ctx); promotedOk = promoted(); onPauseOrDispose { } }
  fun setLive(on: Boolean) { Store.liveUpdate = on; if (on) Store.hideLiveUntil(0L); Store.save(); LiveDay.refresh(ctx) }
  val livePermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok -> setLive(ok) }
  Column(Modifier.fillMaxSize().background(c.bgCanvas).verticalScroll(rememberScrollState())) {
    DSNavBar("الأذان والتنبيهات", onBack = onBack)
    Column(Modifier.fillMaxWidth().padding(16.dp, 4.dp, 16.dp, 32.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
      SettingsGroup("الأذان") {
        val issues = remember(exactOk, Store.reminders) { AdhanGuard.issues(ctx, includeSnoozed = true).size }
        DSRow(Icons.Outlined.VerifiedUser, "ضمان الأذان", if (issues == 0) "كل الفحوص سليمة" else "${Fmt.number(issues)} ${if (issues == 1) "بندٌ يحتاج" else "بنود تحتاج"} إصلاحاً",
          iconStyle = if (issues == 0) IconStyle.Soft else IconStyle.GoldSoft, onClick = onGuard) { DSChevron() }
        DSDivider()
        DSToggleRow("إشعارات الصلاة", "تصل حتى والتطبيق مغلق", Store.reminders.enabled, Icons.Outlined.NotificationsActive) { on ->
          if (on && android.os.Build.VERSION.SDK_INT >= 33) notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
          else { Store.reminders = Store.reminders.copy(enabled = on); Store.save(); Notify.schedule(ctx) }
        }
        if (Store.reminders.enabled) {
          if (!exactOk) {
            DSDivider()
            DSRow(Icons.Outlined.Alarm, "الأذان في وقته بالضبط", "اسمح بـ«المنبّهات والتذكيرات» كي لا يتأخر الإشعار دقائق", iconStyle = IconStyle.GoldSoft, onClick = { runCatching { ctx.startActivity(Notify.exactSettingsIntent(ctx)) } }) {
              Text("السماح", style = DSType.labelSm, color = c.brandPrimary); Spacer(Modifier.width(4.dp)); DSChevron()
            }
          }
          DSDivider()
          Row(Modifier.fillMaxWidth().padding(12.dp, 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("صوت الأذان", style = DSType.bodyMd, color = c.textPrimary)
            Spacer(Modifier.weight(1f))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
              listOf("adhan-fakhry" to "أذان", "chime" to "نغمة", "none" to "صامت").forEach { (k, l) ->
                DSChip(l, on = Store.reminders.sound == k) { Store.reminders = Store.reminders.copy(sound = k); Store.save(); Notify.schedule(ctx) }
              }
            }
          }
          DSDivider()
          Row(Modifier.fillMaxWidth().padding(12.dp, 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("تنبيه قبل الصلاة", style = DSType.bodyMd, color = c.textPrimary)
            Spacer(Modifier.width(8.dp))
            Row(Modifier.weight(1f).horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
              listOf(0, 5, 10, 15, 20, 30).forEach { m ->
                DSChip(if (m == 0) "لا" else "${Fmt.number(m)} د", on = Store.reminders.preMinutes == m) { Store.reminders = Store.reminders.copy(preMinutes = m); Store.save(); Notify.schedule(ctx) }
              }
            }
          }
          DSDivider()
          SettingsLink(Icons.Outlined.Checklist, "الصلوات المُنبَّه لها", "${Fmt.number(Store.reminders.prayers.size)} من ${Fmt.number(Prayer.entries.size)}") { showPrayers = true }
          DSDivider()
          DSRow(Icons.Outlined.NotificationsActive, "اختبار الأذان", if (testSent) "أُرسل الاختبار: انتظر ${Fmt.number(10)} ثوانٍ" else "يصلك بعد ${Fmt.number(10)} ثوانٍ بالطريق نفسه الذي يسلكه الأذان",
            onClick = { if (!testSent) { AdhanGuard.test(ctx); testSent = true } }) { DSChevron() }
        }
      }
      SettingsGroup("تذكيرات أخرى") {
        DSToggleRow("أذكار الصباح والمساء", "بعد الفجر والعصر بـ${Fmt.number(Store.extras.morningAfter)} دقيقة", Store.extras.adhkarMorning || Store.extras.adhkarEvening, Icons.Outlined.WbTwilight) {
          Store.extras = Store.extras.copy(adhkarMorning = it, adhkarEvening = it); Store.save(); Notify.schedule(ctx)
        }
        DSDivider()
        DSToggleRow("حديث اليوم", Store.extras.hadithTime, Store.extras.hadithDaily, Icons.Outlined.AutoStories) {
          Store.extras = Store.extras.copy(hadithDaily = it); Store.save(); Notify.schedule(ctx)
        }
      }
      // «اليوم الحيّ» (المرحلة الثالثة): إشعارٌ صامت مستمرّ بالعدّ إلى الأذان وشريط اليوم، وزرّا «أذكار الوقت» و«صلّيتُ» — اختياريّ
      SettingsGroup("اليوم الحيّ") {
        DSToggleRow("النشاط الحيّ في الإشعارات", "عدٌّ تنازليّ صامت للصلاة القادمة وشريط اليوم بألوان السماء", Store.liveUpdate, Icons.Outlined.Timelapse) { on ->
          if (on && android.os.Build.VERSION.SDK_INT >= 33 && !androidx.core.app.NotificationManagerCompat.from(ctx).areNotificationsEnabled()) livePermission.launch(Manifest.permission.POST_NOTIFICATIONS)
          else setLive(on)
        }
        // أندرويد ١٦: إن منع المستخدم «التحديثات الحيّة» لسكينة يبقى الإشعار عاديّاً بلا شريحة شريط الحالة — نرشده إلى الإعداد
        if (Store.liveUpdate && android.os.Build.VERSION.SDK_INT >= 36 && !promotedOk) {
          DSDivider()
          DSRow(Icons.Outlined.Timelapse, "اعرضه في شريط الحالة", "اسمح بـ«التحديثات الحيّة» لسكينة في إعدادات الإشعارات", iconStyle = IconStyle.GoldSoft,
            onClick = { runCatching { ctx.startActivity(Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_PROMOTION_SETTINGS).putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, ctx.packageName)) } }) { DSChevron() }
        }
      }
      Text("الأذان يُجدوَل منبّهًا عند النظام فيصل والتطبيق مغلق. وتذكير الورد يُضبط من خطة الختمة.", style = DSType.labelXs, color = c.textTertiary)
    }
  }
  if (showPrayers) PrayerTogglesDialog(ctx) { showPrayers = false }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun PrayerTogglesDialog(ctx: Context, onDismiss: () -> Unit) {
  val c = DS.c
  ModalBottomSheet(onDismissRequest = onDismiss, containerColor = c.bgSurface) {
    Column(Modifier.fillMaxWidth().padding(16.dp, 0.dp, 16.dp, 32.dp)) {
      Text("الصلوات المُنبَّه لها", style = DSType.headingMd, color = c.textPrimary)
      Spacer(Modifier.height(8.dp))
      Prayer.entries.forEachIndexed { i, p ->
        if (i > 0) DSDivider()
        DSToggleRow(if (p == Prayer.SUNRISE) "الشروق (تنبيه هادئ)" else p.nameAr, null, p.id in Store.reminders.prayers) { on ->
          Store.reminders = Store.reminders.copy(prayers = if (on) Store.reminders.prayers + p.id else Store.reminders.prayers - p.id)
          Store.save(); Notify.schedule(ctx)
        }
      }
    }
  }
}

// MARK: الأرقام والوقت والتاريخ — ما كان في مجموعة «المظهر» القديمة
@Composable private fun NumbersSettings(onBack: () -> Unit) {
  val c = DS.c
  Column(Modifier.fillMaxSize().background(c.bgCanvas).verticalScroll(rememberScrollState())) {
    DSNavBar("الأرقام والوقت والتاريخ", onBack = onBack)
    Column(Modifier.fillMaxWidth().padding(16.dp, 4.dp, 16.dp, 32.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
      SettingsGroup("العرض") {
        Row(Modifier.fillMaxWidth().padding(12.dp, 8.dp), verticalAlignment = Alignment.CenterVertically) {
          Text("الأرقام", style = DSType.bodyMd, color = c.textPrimary, modifier = Modifier.weight(1f))
          DSSegmented(listOf("١٢٣", "123"), if (Store.numerals == "arab") 0 else 1, Modifier.width(140.dp)) { Store.numerals = if (it == 0) "arab" else "latn"; Store.save() }
        }
        DSDivider()
        DSToggleRow("نظام ١٢ ساعة", null, Store.hour12, Icons.Outlined.Schedule) { Store.hour12 = it; Store.save() }
        DSDivider()
        StepperRow("تعديل التاريخ الهجري", "⁦${if (Store.hijriOffset > 0) "+" else ""}${Fmt.number(Store.hijriOffset)}⁩ يوم", Icons.Outlined.CalendarMonth,
          onMinus = { Store.hijriOffset = maxOf(-2, Store.hijriOffset - 1); Store.save() },
          onPlus = { Store.hijriOffset = minOf(2, Store.hijriOffset + 1); Store.save() })
      }
      SettingsGroup("اللمس") {
        DSToggleRow("الاهتزاز عند العدّ", null, Store.haptics, Icons.Outlined.Vibration) { Store.haptics = it; Store.save() }
      }
    }
  }
}

// MARK: الخصوصية — خلاصة سياسة الخصوصية المنشورة مع التطبيق (privacy.html) كما تنطبق على أندرويد
@Composable private fun PrivacyScreen(onBack: () -> Unit) {
  val c = DS.c; val ctx = LocalContext.current
  @Composable fun Section(title: String, lines: List<String>) {
    SettingsGroup(title) {
      Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        lines.forEach { l -> Row { Text("•", style = DSType.bodySm, color = c.brandPrimary); Spacer(Modifier.width(8.dp)); Text(l, style = DSType.bodySm, color = c.textPrimary) } }
      }
    }
  }
  Column(Modifier.fillMaxSize().background(c.bgCanvas).verticalScroll(rememberScrollState())) {
    DSNavBar("الخصوصية", onBack = onBack)
    Column(Modifier.fillMaxWidth().padding(16.dp, 4.dp, 16.dp, 32.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
      Text("سكينة لا يجمع عنك بيانات، ولا ينشئ لك حسابًا، ولا يعرض إعلانات، ولا يتتبّعك. كل الحسابات — المواقيت، اتجاه القبلة، التقويم الهجري، تقدّم الحفظ والقراءة — تجري على جهازك.", style = DSType.bodyMd, color = c.textPrimary)
      Section("ما يبقى على جهازك", listOf(
        "الموقع (الإحداثيات) لحساب مواقيت الصلاة واتجاه القبلة.",
        "إعداداتك: طريقة الحساب، السمة، القارئ المفضّل، حجم الخط.",
        "علاماتك وملاحظاتها، آخر موضع قراءة، خطة الختمة، سجلّ الأذكار والمسبحة.",
        "ملفات التلاوات التي تنزّلها للاستماع دون اتصال.",
      ))
      Section("ما يغادر الجهاز، ومتى — وكلّه بطلبك", listOf(
        "خدمة تسمية المواقع في نظام أندرويد: إحداثيات مقرّبة إلى نحو كيلومتر، لتسمية مدينتك فقط.",
        "Open-Meteo: إحداثيات مقرّبة إلى نحو كيلومتر، لطبقة الطقس في السماء — مطفأة ما لم تفعّلها.",
        "quran.com وIslamic Network: رقم الآية أو السورة، لجلب التلاوة عند تشغيلها أو تنزيلها.",
        "jsDelivr: اسم الملف، لخطوط المصحف وبعض التفاسير عند أوّل طلب.",
        "hisnmuslim.com: رقم الذكر، لصوته عند تشغيله.",
        "OpenStreetMap: إحداثيات مقرّبة إلى نحو كيلومتر وكلمة البحث، لـ«المساجد القريبة» حين تفتحها.",
      ))
      Section("الأذونات ولمَ تُطلب", listOf(
        "الموقع — للمواقيت والقبلة والمساجد القريبة، ولك أن تختار مدينتك يدويًّا.",
        "الإشعارات — للتذكير بالأذان والأذكار، اختيارية بالكامل.",
        "البوصلة — لعقرب القبلة.",
        "الميكروفون — لمراجعة الحفظ وحدها، ولا يُسجَّل الصوت ولا يُرسل.",
      ))
      DSButton("الأسئلة والملاحظات على GitHub", Modifier.fillMaxWidth(), kind = ButtonKind.Soft, icon = Icons.Outlined.MailOutline) { openUrl(ctx, CONTACT_URL) }
    }
  }
}
