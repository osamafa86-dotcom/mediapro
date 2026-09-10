package org.emdatra.sakinah.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import org.emdatra.sakinah.app.Store

/** تبديل التبويب من داخل الشاشات (بلاطات الوصول السريع) */
val LocalSwitchTab = staticCompositionLocalOf<(AppTab) -> Unit> { {} }

/** الجذر: تهيئة أول تشغيل ثم خمسة تبويبات بشريط مخصّص */
@Composable fun RootScreen() {
  var tabIndex by rememberSaveable { mutableIntStateOf(0) }
  var intro by remember { mutableStateOf(!Store.seenIntro && Store.coords == null) }
  if (intro) { OnboardingScreen(onDone = { Store.seenIntro = true; Store.save(); intro = false }); return }
  val tab = AppTab.entries[tabIndex]
  CompositionLocalProvider(LocalSwitchTab provides { t -> tabIndex = t.ordinal }) {
    Scaffold(containerColor = DS.c.bgCanvas, bottomBar = { DSTabBar(tab) { tabIndex = it.ordinal } }) { pad ->
      Box(Modifier.fillMaxSize().background(DS.c.bgCanvas).padding(pad)) {
        when (tab) { AppTab.Prayer -> PrayerScreen(); AppTab.Qibla -> QiblaScreen(); AppTab.Mushaf -> MushafHome(); AppTab.Adhkar -> AdhkarHome(); AppTab.More -> MoreScreen() }
      }
    }
  }
}
