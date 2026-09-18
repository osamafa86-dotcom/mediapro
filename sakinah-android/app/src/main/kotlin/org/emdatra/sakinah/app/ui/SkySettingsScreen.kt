package org.emdatra.sakinah.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Cloud
import androidx.compose.material.icons.outlined.MotionPhotosOff
import androidx.compose.material.icons.outlined.WbTwilight
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import org.emdatra.sakinah.app.*
import org.emdatra.sakinah.core.*
import java.time.Instant

/** «مظهر السماء» (Figma «٧ · نظام السماء والطقس»): معاينة حيّة، ثم تلقائي/ثابت/مخصّص، الطقس مع ملاحظة الخصوصية، تقليل الحركة، طور ثابت، أو لون */
@Composable fun SkySettingsScreen(onBack: () -> Unit) {
  val c = DS.c
  BackHandler(onBack = onBack)
  var now by remember { mutableStateOf(Instant.now()) }
  LaunchedEffect(Unit) { while (true) { delay(1000); now = Instant.now() } }
  val prefs = Store.skyPrefs
  val tl = Store.timeline(now)
  val state = SkyEngine.state(now, tl?.let { SkyInputs.of(it, Store.zone) }, prefs, null)
  val p = state.palette
  fun save(block: () -> Unit) { block(); Store.save() }
  Column(Modifier.fillMaxSize().background(c.bgCanvas).verticalScroll(rememberScrollState())) {
    DSNavBar("مظهر السماء", onBack = onBack)
    Column(Modifier.fillMaxWidth().padding(16.dp, 0.dp, 16.dp, 32.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
      // معاينة حيّة
      Box(Modifier.fillMaxWidth().height(150.dp).clip(RoundedCornerShape(22.dp))) {
        SkyBackdrop(state, prefs.reduceMotion, Modifier.matchParentSize())
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
          if (tl != null) {
            Text(if (tl.next.isTomorrow) "فجر الغد" else tl.next.key.nameAr, style = DSType.displayLg, color = p.text)
            Text(Fmt.countdown(tl.next.time.epochSecond - now.epochSecond), style = DSType.numericMd.copy(fontSize = 18.sp), color = p.textSoft)
          } else Text("سكينة", style = DSType.displayLg, color = p.text)
        }
        val label = when (prefs.mode) {
          SkyMode.AUTO -> "الآن: ${state.dominant.nameAr}" + (if (prefs.weather) " · الطقس مفعّل" else "") + (Store.locName?.let { " · $it" } ?: "")
          SkyMode.FIXED -> "ثابت: ${prefs.fixedPhase.nameAr}"
          SkyMode.CUSTOM -> "مخصّص: ${prefs.accent.nameAr}"
        }
        Text(label, Modifier.align(Alignment.BottomEnd).padding(14.dp).clip(CircleShape).background(p.glass).border(1.dp, p.glassStroke, CircleShape).padding(horizontal = 10.dp, vertical = 4.dp), style = DSType.labelXs, color = p.text)
      }
      DSSegmented(listOf("تلقائي", "ثابت", "مخصّص"), when (prefs.mode) { SkyMode.AUTO -> 0; SkyMode.FIXED -> 1; SkyMode.CUSTOM -> 2 }) { i ->
        save { Store.skyMode = when (i) { 0 -> "auto"; 1 -> "fixed"; else -> "custom" } }
      }
      SkyGroup("تلقائي") {
        DSToggleRow("السماء تتبع الوقت", "تسعة أطوار من مواقيت صلاتك: السَّحَر، الفجر، الشروق، الضحى، الظهر، العصر، الغروب، الشفق، الليل", prefs.mode == SkyMode.AUTO, Icons.Outlined.WbTwilight) { on -> save { Store.skyMode = if (on) "auto" else "fixed" } }
        DSDivider()
        DSToggleRow("تتأثّر بالطقس", "غيوم ومطر وغبار وثلج فوق السماء. يُرسل موقعك مقرّبًا إلى نحو كيلومتر إلى Open-Meteo مرّةً كل ساعة، بلا حساب ولا مفتاح.", prefs.weather, Icons.Outlined.Cloud) { on -> save { Store.skyWeather = on } }
        DSDivider()
        DSToggleRow("تقليل الحركة", "يوقف زحف الغيوم ونبض القبلة وتبدّل السماء المتدرّج", prefs.reduceMotion, Icons.Outlined.MotionPhotosOff) { on -> save { Store.skyReduceMotion = on } }
      }
      SkyGroup("ثابت — اختر طورًا يبقى") {
        val phases = SkyPhase.entries
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
          phases.chunked(4).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
              row.forEach { ph ->
                val pal = SkyPalette.of(ph); val selected = prefs.mode == SkyMode.FIXED && prefs.fixedPhase == ph
                Column(Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).clickable { save { Store.skyMode = "fixed"; Store.skyPhase = ph.id } }, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
                  Box(Modifier.fillMaxWidth().height(40.dp).clip(RoundedCornerShape(12.dp)).background(Brush.verticalGradient(listOf(pal.stops[0].toColor(), pal.stops[3].toColor()))).border(if (selected) 2.5.dp else 1.dp, if (selected) c.accentGold else c.borderSubtle, RoundedCornerShape(12.dp)))
                  Text(ph.nameAr, style = DSType.labelXs.copy(fontSize = 10.5.sp), color = c.textPrimary, maxLines = 1)
                }
              }
              repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
            }
          }
        }
      }
      SkyGroup("مخصّص — لونك أنت") {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
          SkyAccent.entries.chunked(4).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
              row.forEach { a ->
                val selected = prefs.mode == SkyMode.CUSTOM && prefs.accent == a
                Column(Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).clickable { save { Store.skyMode = "custom"; Store.skyAccent = a.id } }, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
                  Box(Modifier.size(40.dp).clip(CircleShape).background(Brush.verticalGradient(listOf(Color(0xFF0A0F14), Color(0xFF000000 or a.hex)))).border(if (selected) 2.5.dp else 1.dp, if (selected) c.accentGold else c.borderSubtle, CircleShape))
                  Text(a.nameAr, style = DSType.labelXs.copy(fontSize = 10.5.sp), color = c.textPrimary, maxLines = 1)
                }
              }
            }
          }
          Text("اللون المخصّص يلوّن السماء وبطاقة الأذكار؛ الذهب والنعناع يبقيان كما هما للإشارات.", style = DSType.labelXs, color = c.textTertiary, textAlign = TextAlign.End, modifier = Modifier.fillMaxWidth())
        }
      }
    }
  }
}

@Composable private fun SkyGroup(title: String, content: @Composable ColumnScope.() -> Unit) {
  val c = DS.c
  Column {
    Text(title, style = DSType.labelSm, color = c.textTertiary, textAlign = TextAlign.End, modifier = Modifier.fillMaxWidth().padding(4.dp, 0.dp, 4.dp, 8.dp))
    DSCard(padding = 8.dp, content = content)
  }
}
