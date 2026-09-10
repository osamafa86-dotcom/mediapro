package org.emdatra.sakinah.app.ui

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import org.emdatra.sakinah.app.*

/** تهيئة أول تشغيل (تصميم Figma 14a–14c): ترحيب → الموقع → الإشعارات */
@Composable fun OnboardingScreen(onDone: () -> Unit) {
  val c = DS.c; val ctx = LocalContext.current; val scope = rememberCoroutineScope()
  var step by remember { mutableIntStateOf(0) }
  var showCity by remember { mutableStateOf(false) }; var locating by remember { mutableStateOf(false) }
  var preReminder by remember { mutableStateOf(true) }; var adhan by remember { mutableStateOf(true) }; var adhkar by remember { mutableStateOf(false) }
  val locPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { g -> if (g.values.any { it }) scope.launch { Loc.current(ctx)?.let { l -> Loc.apply(ctx, l); Notify.schedule(ctx) }; locating = false } else locating = false }
  val notifPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { _ -> Notify.schedule(ctx); onDone() }
  fun enableNotifications() {
    val r = Store.reminders; Store.reminders = r.copy(enabled = true, preMinutes = if (preReminder) 10 else 0, sound = if (adhan) "adhan-fakhry" else "chime")
    Store.extras = Store.extras.copy(adhkarMorning = adhkar, adhkarEvening = adhkar); Store.save()
    if (Build.VERSION.SDK_INT >= 33) notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS) else { Notify.schedule(ctx); onDone() }
  }
  Box(Modifier.fillMaxSize().background(c.bgCanvas)) {
    AnimatedContent(step, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "onb") { s ->
      when (s) {
        0 -> Welcome(onStart = { step = 1 })
        1 -> Page(Icons.Outlined.Place, gold = false, title = "حدّد موقعك لحساب المواقيت", body = "نحتاج موقعك التقريبي لحساب مواقيت الصلاة واتجاه القبلة والانحراف المغناطيسي.", dot = 1, onSkip = { step = 2 }, extra = {
          Row(Modifier.clip(CircleShape).background(c.success.copy(alpha = 0.12f)).padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Outlined.Shield, null, Modifier.size(14.dp), tint = c.success); Spacer(Modifier.width(6.dp)); Text("الإحداثيات تُقرَّب وتبقى على جهازك · لا تُرسل لأي خادم", style = DSType.labelXs, color = c.success) }
          if (Store.coords != null) { Spacer(Modifier.height(10.dp)); Row(verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Filled.CheckCircle, null, Modifier.size(16.dp), tint = c.brandPrimary); Spacer(Modifier.width(6.dp)); Text("الموقع: ${Store.locName ?: ""}", style = DSType.labelMd, color = c.brandPrimary) } }
        }) {
          if (Store.coords != null) { DSButton("متابعة", Modifier.fillMaxWidth(), icon = Icons.Filled.ChevronLeft) { step = 2 }; DSButton("تغيير المدينة", Modifier.fillMaxWidth(), kind = ButtonKind.Outline, icon = Icons.Outlined.Search) { showCity = true } }
          else { DSButton(if (locating) "جارٍ تحديد الموقع…" else "استخدام موقع الجهاز", Modifier.fillMaxWidth(), icon = Icons.Outlined.MyLocation, enabled = !locating) { locating = true; locPermission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) }; DSButton("اختيار مدينة يدويًا · ٦٤٩ مدينة", Modifier.fillMaxWidth(), kind = ButtonKind.Outline, icon = Icons.Outlined.Search) { showCity = true } }
        }
        else -> Page(Icons.Outlined.NotificationsNone, gold = true, title = "لا تفوّت صلاة", body = "إشعارات محلية على جهازك تُجدَّد تلقائيًا، مع الأذان الكامل أو تنبيه هادئ.", dot = 2, onSkip = onDone, extra = {
          DSCard(Modifier.fillMaxWidth(), padding = 2.dp) {
            DSToggleRow("الأذان عند كل صلاة", "صوت الأذان · يمكن تغييره لاحقًا", adhan) { adhan = it }; DSDivider()
            DSToggleRow("تنبيه قبل الصلاة", "قبل ١٠ دقائق", preReminder) { preReminder = it }; DSDivider()
            DSToggleRow("أذكار الصباح والمساء", "بعد الفجر وبعد العصر", adhkar) { adhkar = it }
          }
        }) {
          DSButton("تفعيل الإشعارات", Modifier.fillMaxWidth(), icon = Icons.Filled.ChevronLeft) { enableNotifications() }
          Text("لاحقًا", Modifier.fillMaxWidth().clip(DS.shapeLg).clickable(onClick = onDone).padding(12.dp), style = DSType.labelMd, color = c.textSecondary, textAlign = TextAlign.Center)
        }
      }
    }
  }
  if (showCity) CityPickerSheet(onDismiss = { showCity = false }, onDevice = { showCity = false; locating = true; locPermission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) })
}

@Composable private fun Welcome(onStart: () -> Unit) {
  val c = DS.c
  Column(Modifier.fillMaxSize()) {
    Box(Modifier.fillMaxWidth().weight(1f).background(DS.nightVertical)) {
      Canvas(Modifier.matchParentSize()) {
        val cx = size.width / 2; val cy = size.height * 0.5f; val gold = Color(0xFFC69C3E)
        listOf(260f to 0.10f, 200f to 0.16f, 145f to 0.24f).forEach { (r, a) -> drawCircle(gold.copy(alpha = a), r.dp.toPx(), Offset(cx, cy), style = Stroke(1.dp.toPx())) }
        drawCircle(gold.copy(alpha = 0.12f), 90.dp.toPx(), Offset(cx, cy))
        listOf(Triple(70f, 90f, 1.5f), Triple(120f, 160f, 1f), Triple(300f, 110f, 1.5f), Triple(330f, 200f, 1f), Triple(90f, 300f, 1f), Triple(290f, 330f, 1.5f), Triple(200f, 60f, 1f)).forEach { (x, y, r) -> drawCircle(Color.White.copy(alpha = 0.8f), r.dp.toPx(), Offset(x.dp.toPx(), y.dp.toPx())) }
      }
      Icon(Icons.Outlined.DarkMode, null, Modifier.size(96.dp).align(Alignment.Center), tint = c.accentGold)
      Column(Modifier.align(Alignment.BottomCenter).padding(bottom = 44.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text("سكينة", style = DSType.displayHero.copy(fontSize = 48.sp, lineHeight = 60.sp), color = c.textOnDark)
        Text("مواقيتك · مصحفك · أذكارك", style = DSType.labelMd, color = c.accentGold)
      }
    }
    Column(Modifier.fillMaxWidth().offset(y = (-32).dp).clip(RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp)).background(c.bgCanvas).padding(horizontal = 30.dp).padding(top = 28.dp, bottom = 12.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
      Text("السكينة في مكان واحد", style = DSType.displayMd, color = c.textPrimary, textAlign = TextAlign.Center)
      Text("مواقيت دقيقة، مصحف بخط المدينة، أذكار وحصن المسلم، ومسبحة. يعمل كاملًا دون اتصال، بلا إعلانات ولا تتبّع.", style = DSType.bodyMd, color = c.textSecondary, textAlign = TextAlign.Center)
      Dots(3, 0)
      DSButton("ابدأ", Modifier.fillMaxWidth(), icon = Icons.Filled.ChevronLeft, onClick = onStart)
      Text("كل الحسابات على جهازك، والشبكة تُستخدم فقط لجلب التلاوات عند طلبها.", style = DSType.labelXs, color = c.textTertiary, textAlign = TextAlign.Center)
      Spacer(Modifier.navigationBarsPadding())
    }
  }
}

@Composable private fun Page(icon: ImageVector, gold: Boolean, title: String, body: String, dot: Int, onSkip: () -> Unit, extra: @Composable ColumnScope.() -> Unit, buttons: @Composable ColumnScope.() -> Unit) {
  val c = DS.c; val tint = if (gold) c.accentGoldStrong else c.brandPrimary; val disc = if (gold) c.accentGoldSoft else c.brandSoft
  Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().verticalScroll(rememberScrollState()).padding(horizontal = 30.dp, vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
    Row(Modifier.fillMaxWidth()) { Spacer(Modifier.weight(1f)); Text("تخطّي", Modifier.clickable(onClick = onSkip).padding(10.dp), style = DSType.labelSm, color = c.textSecondary) }
    Spacer(Modifier.height(8.dp))
    Box(Modifier.size(200.dp), contentAlignment = Alignment.Center) {
      Canvas(Modifier.matchParentSize()) { drawCircle(tint.copy(alpha = 0.35f), 100.dp.toPx(), style = Stroke(1.dp.toPx())); drawCircle(tint.copy(alpha = 0.6f), 83.dp.toPx(), style = Stroke(1.dp.toPx())); drawCircle(disc, 62.dp.toPx()) }
      Icon(icon, null, Modifier.size(52.dp), tint = tint)
    }
    Text(title, style = DSType.displayMd, color = c.textPrimary, textAlign = TextAlign.Center)
    Text(body, style = DSType.bodyMd, color = c.textSecondary, textAlign = TextAlign.Center)
    extra()
    Spacer(Modifier.weight(1f, fill = true).heightIn(min = 8.dp))
    Dots(3, dot)
    Spacer(Modifier.height(2.dp))
    buttons()
  }
}
