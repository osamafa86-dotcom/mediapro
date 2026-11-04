package org.emdatra.sakinah.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import org.emdatra.sakinah.app.ui.AppTab
import org.emdatra.sakinah.app.ui.DeepLink
import org.emdatra.sakinah.app.ui.HomeRoute
import org.emdatra.sakinah.app.ui.RootScreen
import org.emdatra.sakinah.app.ui.SakinahTheme

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()
    Fonts.init(this)
    ScreenshotMode.arm(intent?.getStringExtra("sakinahShot"), intent?.getStringExtra("sakinahSky"), intent?.getStringExtra("sakinahWeather"))
    if (savedInstanceState == null) route(intent)
    setContent { CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) { SakinahTheme { RootScreen() } } }
  }
  override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); route(intent) }
  // جلب حزمة خطوط المصحف لا ينجح إلا والتطبيق في الواجهة
  override fun onResume() { super.onResume(); Notify.schedule(this); MushafFontPack.ensure() }
  // ما غيّره المستخدم داخل التطبيق (المدينة، الأرقام، السماء…) يصل الويدجت والإشعار الحيّ حين يغادر
  override fun onStop() { super.onStop(); LiveDay.refresh(this) }

  /**
   * روابط الويدجت والإشعار الحيّ: `sakinah://today` يفتح «اليوم»، و`sakinah://adhkar/<morning|evening|sleep>` جلسة أذكار الوقت؛
   * وفي رمضان `sakinah://hisn/<رقم الباب>` بابٌ من حصن المسلم فوق «اليوم» (دعاء الإفطار)، و`sakinah://wird` القارئ على حصّة الختمة.
   */
  private fun route(i: Intent?) {
    val u = i?.data ?: return
    if (u.scheme != "sakinah") return
    when (u.host) {
      "today" -> DeepLink.tab = AppTab.Home
      "adhkar" -> u.lastPathSegment?.takeIf { it in setOf("morning", "evening", "sleep") }?.let { Store.pendingAdhkarPeriod = it; DeepLink.tab = AppTab.Adhkar }
      "hisn" -> u.lastPathSegment?.toIntOrNull()?.let { HomeRoute.request = "hisn:$it"; DeepLink.tab = AppTab.Home }
      "wird" -> { Store.pendingReaderPage = Ramadan.nextPage() ?: Store.lastRead?.page ?: 1; DeepLink.tab = AppTab.Mushaf }
    }
  }
}
