package org.emdatra.sakinah.app.ui

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import org.emdatra.sakinah.app.*
import org.emdatra.sakinah.core.*

/** «ضمان الأذان» (صفحة «١١ · اليوم الحيّ» في فيغما): ما يمنع الأذان على هذا الجهاز وكيف يُصلَح، والأذانات القادمة مجدولةً فعلاً، واختبارٌ حقيقي */
@Composable fun AdhanGuardScreen(onBack: () -> Unit) {
  val ctx = LocalContext.current
  val c = DS.c
  var tick by remember { mutableIntStateOf(0) }
  // يُعاد الفحص عند العودة من شاشات النظام (الإذن، البطارية، القناة)
  androidx.lifecycle.compose.LifecycleResumeEffect(Unit) { Notify.schedule(ctx); tick++; onPauseOrDispose { } }
  val checks = remember(tick) { AdhanGuard.checks(ctx) }
  val upcoming = remember(tick) { AdhanGuard.upcoming(ctx) }
  var expanded by remember { mutableStateOf<AdhanGuard.Check?>(null) }
  var touched by remember { mutableStateOf(false) }
  var showMethod by remember { mutableStateOf(false) }
  var testSent by remember { mutableStateOf(false) }
  LaunchedEffect(testSent) { if (testSent) { delay(12_000); testSent = false } }
  val notifPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
    Store.reminders = Store.reminders.copy(enabled = ok); Store.save(); Notify.schedule(ctx); tick++
  }
  fun enableReminders() {
    if (Build.VERSION.SDK_INT >= 33) notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    else { Store.reminders = Store.reminders.copy(enabled = true); Store.save(); Notify.schedule(ctx); tick++ }
  }
  val failing = checks.filter { !it.ok }

  Column(Modifier.fillMaxSize().background(c.bgCanvas).verticalScroll(rememberScrollState())) {
    DSNavBar("ضمان الأذان", onBack = onBack)
    Column(Modifier.fillMaxWidth().padding(16.dp, 4.dp, 16.dp, 32.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
      StatusBanner(failing.size)

      GuardLabel("الفحص")
      DSCard(padding = 0.dp) {
        checks.forEachIndexed { i, s ->
          if (i > 0) DSDivider()
          val open = !s.ok && (if (touched) expanded == s.check else s == failing.firstOrNull())
          CheckRow(s, open, onToggle = { touched = true; expanded = if (open) null else s.check },
            onFix = {
              if (s.check == AdhanGuard.Check.NOTIFICATIONS && s.fix == null) enableReminders()
              else s.fix?.let { runCatching { ctx.startActivity(it) } }
            },
            onLater = { AdhanGuard.snooze(ctx, s.check); touched = true; expanded = null })
        }
      }

      if (Store.reminders.enabled && upcoming.isNotEmpty()) {
        GuardLabel("الأذان القادم — مجدولٌ على جهازك")
        DSCard(padding = 0.dp) {
          upcoming.forEachIndexed { i, u ->
            if (i > 0) DSDivider()
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
              Text(u.prayer.nameAr, style = DSType.labelMd.copy(fontWeight = FontWeight.SemiBold), color = c.textPrimary, modifier = Modifier.width(64.dp))
              Text(Fmt.time(u.time), style = DSType.labelMd, color = c.textPrimary)
              Spacer(Modifier.width(8.dp))
              Text(AdhanGuard.dayLabel(u.time), style = DSType.labelXs, color = c.textSecondary)
              Spacer(Modifier.weight(1f))
              if (u.scheduled) {
                Icon(Icons.Filled.Check, null, Modifier.size(14.dp), tint = c.success)
                Spacer(Modifier.width(4.dp))
                Text("مجدول", style = DSType.labelXs, color = c.success)
              } else {
                Text("غير مجدول", style = DSType.labelXs.copy(fontWeight = FontWeight.SemiBold), color = c.danger)
              }
            }
          }
        }
        Text(
          if (upcoming.all { it.scheduled }) "يُعاد الجدول كل يوم، وعند تغيّر الموقع أو المنطقة الزمنية."
          else "أُعيدت الجدولة الآن؛ إن بقي «غير مجدول» فالنظام يوقف سكينة — راجع «توفير البطارية» أعلاه.",
          style = DSType.labelXs, color = c.textTertiary, modifier = Modifier.padding(horizontal = 4.dp)
        )
      }

      GuardLabel("ما يصلك من إشعارات")
      DSCard(padding = 0.dp) {
        val only = AdhanGuard.adhanOnly
        RadioRow("الأذان وحده", "موصى به: لا شيء يزاحم نداء الصلاة", only) { AdhanGuard.setAdhanOnly(ctx, true); tick++ }
        DSDivider()
        RadioRow("الأذان وتذكيرات الأذكار", "أذكار الصباح والمساء في أوقاتها، ويُضبط كلٌّ منها من الإعدادات", !only) { AdhanGuard.setAdhanOnly(ctx, false); tick++ }
      }

      GuardLabel("المواقيت")
      DSCard(padding = 0.dp) {
        val m = Methods.method(Store.methodId)
        DSRow(Icons.Outlined.CalendarMonth, "طريقة الحساب", "${m.nameAr}، الفجر ${Fmt.decimal(m.fajrAngle, 1)}° والعشاء " + (if (m.ishaInterval > 0) "${Fmt.number(m.ishaInterval.toInt())} دقيقة بعد المغرب" else "${Fmt.decimal(m.ishaAngle, 1)}°"), onClick = { showMethod = true })
      }

      Spacer(Modifier.height(4.dp))
      DSButton(if (testSent) "أُرسل الاختبار: انتظر ١٠ ثوانٍ" else "اختبر الأذان: يصلك بعد ١٠ ثوانٍ", kind = ButtonKind.Soft, icon = Icons.Outlined.NotificationsActive, enabled = !testSent, modifier = Modifier.fillMaxWidth()) {
        AdhanGuard.test(ctx); testSent = true
      }
      Text("الفحص يجري على جهازك وحده، ولا يُرسَل شيءٌ منه إلى أيّ مكان.", style = DSType.labelXs, color = c.textTertiary, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
    }
  }
  if (showMethod) MethodSheet { showMethod = false; Notify.schedule(ctx); tick++ }
}

@Composable private fun GuardLabel(t: String) {
  Text(t, style = DSType.labelSm, color = DS.c.textTertiary, textAlign = TextAlign.End, modifier = Modifier.fillMaxWidth().padding(start = 4.dp, end = 4.dp, top = 6.dp))
}

@Composable private fun StatusBanner(failing: Int) {
  val c = DS.c
  val ok = failing == 0
  val bg = if (ok) c.brandSoft else c.accentGoldSoft
  val title = when (failing) { 0 -> "الأذان مضمونٌ على هذا الجهاز"; 1 -> "بقيت خطوةٌ واحدة ليصلك الأذان في وقته"; 2 -> "بقيت خطوتان ليصلك الأذان في وقته"; else -> "بقيت ${Fmt.number(failing)} خطوات ليصلك الأذان في وقته" }
  val body = if (ok) "الإذن والمنبّهات والبطارية سليمة، والأذانات القادمة مجدولة عند النظام." else "إعداداتٌ في هاتفك قد تؤخّر الأذان أو توقفه حين يكون التطبيق مغلقاً. كلٌّ منها مشروحٌ أدناه."
  Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(DS.Radius.lg)).background(bg).padding(16.dp).semantics(mergeDescendants = true) {}, verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
    Box(Modifier.size(40.dp).clip(CircleShape).background(c.bgSurface), contentAlignment = Alignment.Center) {
      Icon(if (ok) Icons.Outlined.VerifiedUser else Icons.Outlined.NotificationImportant, null, Modifier.size(20.dp), tint = if (ok) c.brandPrimary else c.accentGoldStrong)
    }
    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
      Text(title, style = DSType.labelMd.copy(fontWeight = FontWeight.Bold, fontSize = 15.sp), color = c.textPrimary)
      Text(body, style = DSType.labelXs.copy(fontSize = 12.5.sp), color = c.textSecondary)
    }
  }
}

@Composable private fun CheckRow(s: AdhanGuard.Status, open: Boolean, onToggle: () -> Unit, onFix: () -> Unit, onLater: () -> Unit) {
  val c = DS.c
  val warnInk = c.warning
  Column(Modifier.fillMaxWidth().then(if (!s.ok) Modifier.background(c.accentGoldSoft.copy(alpha = if (open) 1f else 0.55f)) else Modifier)) {
    Row(Modifier.fillMaxWidth().then(if (!s.ok) Modifier.clickable(onClick = onToggle) else Modifier).padding(horizontal = 16.dp, vertical = 12.dp)
      .semantics(mergeDescendants = true) { stateDescription = if (s.ok) "سليم" else "يحتاج إصلاحاً" },
      verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
      StateDot(s.ok)
      Column(Modifier.weight(1f)) {
        Text(s.title, style = DSType.labelMd.copy(fontWeight = FontWeight.SemiBold), color = c.textPrimary)
        Text(s.detail, style = DSType.labelXs, color = if (s.ok) c.textSecondary else warnInk)
      }
    }
    if (open) {
      Column(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, bottom = 14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        s.advice?.let { Text(it, style = DSType.labelXs.copy(fontSize = 12.5.sp), color = c.textSecondary) }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          DSButton(if (s.fix == null) "فعّل الإشعارات" else "افتح الإعداد", modifier = Modifier.weight(1f), onClick = onFix)
          DSButton("ذكّرني لاحقاً", kind = ButtonKind.Outline, modifier = Modifier.weight(1f), onClick = onLater)
        }
      }
    }
  }
}

@Composable private fun StateDot(ok: Boolean) {
  val c = DS.c
  Box(Modifier.size(28.dp).clip(CircleShape).background(if (ok) c.brandSoft else c.bgSurface).then(if (!ok) Modifier.border(1.dp, c.accentGold, CircleShape) else Modifier), contentAlignment = Alignment.Center) {
    Icon(if (ok) Icons.Filled.Check else Icons.Outlined.NotificationsActive, null, Modifier.size(15.dp), tint = if (ok) c.brandPrimary else c.accentGoldStrong)
  }
}

@Composable private fun RadioRow(title: String, subtitle: String, on: Boolean, onClick: () -> Unit) {
  val c = DS.c
  Row(Modifier.fillMaxWidth().clickable(role = Role.RadioButton, onClick = onClick).padding(horizontal = 16.dp, vertical = 12.dp)
    .semantics(mergeDescendants = true) { stateDescription = if (on) "محدّد" else "غير محدّد" },
    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
    Box(Modifier.size(22.dp).clip(CircleShape).border(2.dp, if (on) c.brandPrimary else c.borderStrong, CircleShape), contentAlignment = Alignment.Center) {
      if (on) Box(Modifier.size(11.dp).clip(CircleShape).background(c.brandPrimary))
    }
    Column(Modifier.weight(1f)) {
      Text(title, style = DSType.labelMd.copy(fontWeight = FontWeight.SemiBold), color = c.textPrimary)
      Text(subtitle, style = DSType.labelXs, color = c.textSecondary)
    }
  }
}
