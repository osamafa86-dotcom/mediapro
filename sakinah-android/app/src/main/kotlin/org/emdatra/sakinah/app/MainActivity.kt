package org.emdatra.sakinah.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import org.emdatra.sakinah.app.ui.RootScreen
import org.emdatra.sakinah.app.ui.SakinahTheme

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()
    Fonts.init(this)
    setContent { CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) { SakinahTheme { RootScreen() } } }
  }
  override fun onResume() { super.onResume(); Notify.schedule(this) }
}
