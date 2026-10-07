package org.emdatra.sakinah.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import org.emdatra.sakinah.app.ScreenshotMode
import org.emdatra.sakinah.app.Store

/** تبديل التبويب من داخل الشاشات (بلاطات الوصول السريع) */
val LocalSwitchTab = staticCompositionLocalOf<(AppTab) -> Unit> { {} }

/** قارئ المصحف يملأ الشاشة كلها كما في iOS والتصميم: بلا شريط التبويبات وبلا حشوه (القارئ يحشو أشرطة النظام بنفسه) */
object ReaderFullScreen { var open by mutableStateOf(false) }

/** الجذر: تهيئة أول تشغيل ثم خمسة تبويبات بشريط مخصّص */
@Composable fun RootScreen() {
  var tabIndex by rememberSaveable { mutableIntStateOf(ScreenshotMode.tab?.ordinal ?: 0) }
  var intro by remember { mutableStateOf(!Store.seenIntro && Store.coords == null) }
  if (intro) { OnboardingScreen(onDone = { Store.seenIntro = true; Store.save(); intro = false }); return }
  val tab = AppTab.entries[tabIndex]
  CompositionLocalProvider(LocalSwitchTab provides { t -> tabIndex = t.ordinal }) {
    val full = ReaderFullScreen.open && tab == AppTab.Mushaf
    Scaffold(containerColor = DS.c.bgCanvas, bottomBar = { if (!full) DSTabBar(tab) { tabIndex = it.ordinal } }) { pad ->
      // الرئيسية تمدّ سماءها تحت شريط الحالة (تحشو الهيرو بنفسه)؛ سائر التبويبات تحت الشريط
      Box(Modifier.fillMaxSize().background(DS.c.bgCanvas).padding(top = if (tab == AppTab.Home || full) 0.dp else pad.calculateTopPadding(), bottom = if (full) 0.dp else pad.calculateBottomPadding())) {
        when (tab) { AppTab.Home -> HomeScreen(); AppTab.Mushaf -> MushafHome(); AppTab.Adhkar -> AdhkarHome(); AppTab.More -> MoreScreen() }
      }
    }
  }
}
