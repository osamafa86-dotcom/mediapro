package org.emdatra.sakinah.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Teal = Color(0xFF0F766E); val TealStrong = Color(0xFF0A5750); val Gold = Color(0xFFA98A3A); val Paper = Color(0xFFF6F1E2); val Ink = Color(0xFF1D1A14)
fun hex(s: String): Color = Color(("ff" + s.trimStart('#')).toLong(16))

@Composable fun SakinahTheme(content: @Composable () -> Unit) {
  val dark = isSystemInDarkTheme()
  val scheme = if (dark) darkColorScheme(primary = Color(0xFF5EEAD4), secondary = Color(0xFFCFB46F), background = Color(0xFF121412), surface = Color(0xFF1A1D1A)) else lightColorScheme(primary = Teal, secondary = Gold, background = Color(0xFFF4F4F1), surface = Color.White)
  MaterialTheme(colorScheme = scheme, content = content)
}
