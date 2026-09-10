package org.emdatra.sakinah.app.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier

/** الجذر: خمسة تبويبات (الصلاة، القبلة، المصحف، الأذكار، المزيد) */
@Composable fun RootScreen() {
  var tab by rememberSaveable { mutableIntStateOf(0) }
  val tabs = listOf("الصلاة" to Icons.Filled.WbSunny, "القبلة" to Icons.Filled.Explore, "المصحف" to Icons.Filled.MenuBook, "الأذكار" to Icons.Filled.Favorite, "المزيد" to Icons.Filled.MoreHoriz)
  Scaffold(bottomBar = { NavigationBar { tabs.forEachIndexed { i, (label, icon) -> NavigationBarItem(selected = tab == i, onClick = { tab = i }, icon = { Icon(icon, contentDescription = label) }, label = { Text(label) }) } } }) { pad ->
    androidx.compose.foundation.layout.Box(Modifier.padding(pad)) {
      when (tab) { 0 -> PrayerScreen(); 1 -> QiblaScreen(); 2 -> MushafHome(); 3 -> AdhkarHome(); else -> MoreScreen() }
    }
  }
}
