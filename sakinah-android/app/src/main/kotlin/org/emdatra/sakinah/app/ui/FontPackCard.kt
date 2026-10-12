package org.emdatra.sakinah.app.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CloudDownload
import androidx.compose.material.icons.outlined.WifiOff
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import org.emdatra.sakinah.app.MushafFontPack
import org.emdatra.sakinah.app.MushafFontPack.Phase

/**
 * حالة حزمة خطوط صفحات المصحف (تُنزَّل بعد التثبيت): شريط تقدّم، أو زر للسماح بالتنزيل عبر بيانات الهاتف،
 * أو إعادة المحاولة. تُعرض في المكتبة وفوق القارئ ما دامت الخطوط غير جاهزة ووضع العرض «صفحات».
 * [ink]/[paper] لألوان ورق القارئ؛ وبدونهما ألوان النظام.
 */
@Composable fun FontPackCard(modifier: Modifier = Modifier, ink: Color? = null, paper: Color? = null) {
  val c = DS.c
  val fg = ink ?: c.textPrimary; val sub = (ink ?: c.textSecondary).copy(alpha = if (ink != null) 0.7f else 1f)
  val bg = paper?.let { fg.copy(alpha = 0.06f) } ?: c.bgSurface
  val phase = MushafFontPack.phase
  // حوار Play (بيانات الهاتف / التأكيد): نتيجته تصل عبر مستمع الحزمة لا من هنا
  val confirm = rememberLauncherForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { }
  Column(modifier.fillMaxWidth().clip(DS.shapeLg).background(bg).padding(horizontal = 14.dp, vertical = 12.dp)) {
    Row(verticalAlignment = Alignment.CenterVertically) {
      Icon(if (phase == Phase.WAITING_FOR_WIFI) Icons.Outlined.WifiOff else Icons.Outlined.CloudDownload, null, Modifier.width(18.dp), tint = fg)
      Spacer(Modifier.width(10.dp))
      Column(Modifier.weight(1f)) {
        Text(MushafFontPack.label(), style = DSType.labelMd, color = fg)
        Text(
          when (phase) {
            Phase.UNAVAILABLE -> "ثبّت التطبيق من Google Play لتصلك خطوط الصفحات؛ وضع النص المتدفق يعمل كاملًا"
            else -> "المصحف يعمل بوضع النص المتدفق حتى تكتمل، مرة واحدة فقط"
          },
          style = DSType.labelXs, color = sub, modifier = Modifier.padding(top = 2.dp)
        )
      }
      when (phase) {
        Phase.WAITING_FOR_WIFI, Phase.NEEDS_CONFIRMATION -> DSButton(if (phase == Phase.WAITING_FOR_WIFI) "عبر بيانات الهاتف" else "السماح", kind = ButtonKind.Soft) { MushafFontPack.confirm(confirm) }
        Phase.FAILED, Phase.UNKNOWN -> DSButton("تنزيل", kind = ButtonKind.Soft) { MushafFontPack.fetch() }
        else -> {}
      }
    }
    if (phase == Phase.DOWNLOADING || phase == Phase.PENDING) {
      Spacer(Modifier.height(10.dp))
      if (phase == Phase.DOWNLOADING) LinearProgressIndicator({ MushafFontPack.progress }, Modifier.fillMaxWidth().height(4.dp).clip(CircleShape), color = c.brandPrimary, trackColor = fg.copy(alpha = 0.12f))
      else LinearProgressIndicator(Modifier.fillMaxWidth().height(4.dp).clip(CircleShape), color = c.brandPrimary, trackColor = fg.copy(alpha = 0.12f))
    }
  }
}
