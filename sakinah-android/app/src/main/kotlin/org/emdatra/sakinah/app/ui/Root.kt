package org.emdatra.sakinah.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
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
/** البحث الشامل يملأ الشاشة كذلك (لوحة المفاتيح مكان الشريط، كما في التصميم) ويحشو أشرطة النظام بنفسه */
object SearchFullScreen { var open by mutableStateOf(false) }

/** تبويبٌ يطلبه رابطٌ من خارج التطبيق (الويدجت والإشعار الحيّ) — يستهلكه الجذر مرّة */
object DeepLink { var tab by mutableStateOf<AppTab?>(null) }

/**
 * الجذر: تهيئة أول تشغيل ثم أربعة تبويبات. على الهاتف (مضغوط) شريطٌ عائم أسفل الشاشة كما كان تماماً؛ في المتوسط الشريط
 * نفسه أضيق في الوسط؛ وفي الموسّع شريطٌ جانبيّ في بداية الشاشة فيه البحث والإعدادات أيضاً (المرحلة الرابعة).
 */
@Composable fun RootScreen() {
  val adaptive = rememberAdaptive()
  CompositionLocalProvider(LocalAdaptive provides adaptive) { RootContent(adaptive) }
}

@Composable private fun RootContent(adaptive: Adaptive) {
  var tabIndex by rememberSaveable { mutableIntStateOf(ScreenshotMode.tab?.ordinal ?: 0) }
  var intro by remember { mutableStateOf(!Store.seenIntro && Store.coords == null) }
  LaunchedEffect(DeepLink.tab, intro) { if (!intro) DeepLink.tab?.let { tabIndex = it.ordinal; DeepLink.tab = null } }
  if (intro) { OnboardingScreen(onDone = { Store.seenIntro = true; Store.save(); intro = false }); return }
  val tab = AppTab.entries[tabIndex]
  CompositionLocalProvider(LocalSwitchTab provides { t -> tabIndex = t.ordinal }) {
    val full = (ReaderFullScreen.open && tab == AppTab.Mushaf) || (SearchFullScreen.open && tab == AppTab.Home)
    val rail = adaptive.expanded && !full
    // الذكر والمكتبة بعرضٍ مقروء في الشاشات الكبيرة (اليوم والمصحف يتكيّفان بنفسيهما)؛ والمضغوط يمرّ كما هو
    val content: @Composable () -> Unit = { when (tab) { AppTab.Home -> HomeScreen(); AppTab.Mushaf -> MushafHome(); AppTab.Adhkar -> ReadableBox { AdhkarHome() }; AppTab.Library -> ReadableBox { LibraryScreen() } } }
    val bar: @Composable () -> Unit = { DSTabBar(tab, maxWidth = if (adaptive.compact) null else 440.dp) { tabIndex = it.ordinal } }
    // مع مفصلٍ فاصل (شاشتان أو كتاب) لا يعبره الشريط: يوضع في لوح البداية
    Scaffold(containerColor = DS.c.bgCanvas, bottomBar = { if (!full && !rail) { if (!adaptive.compact && adaptive.verticalSeparator != null) TwoPane(Modifier.fillMaxWidth(), gap = 24.dp, start = bar, end = {}) else bar() } }) { pad ->
      if (adaptive.compact) {
        // الهاتف: كما كان — الرئيسية تمدّ سماءها تحت شريط الحالة (تحشو الهيرو بنفسه)؛ سائر التبويبات تحت الشريط
        Box(Modifier.fillMaxSize().background(DS.c.bgCanvas).padding(top = if (tab == AppTab.Home || full) 0.dp else pad.calculateTopPadding(), bottom = if (full) 0.dp else pad.calculateBottomPadding())) {
          content()
        }
      } else Row(Modifier.fillMaxSize().background(DS.c.bgCanvas)) {
        // في البداية (يميناً) الشريط الجانبيّ يأخذ حافّته وأشرطة النظام فيها؛ والمحتوى يتجنّب الحافّة الأخرى (الشقّ وأزرار التنقّل أفقياً)
        if (rail) SideRail(tab, onSelect = { tabIndex = it.ordinal },
          onSearch = { tabIndex = AppTab.Home.ordinal; HomeRoute.request = "search" },
          onSettings = { tabIndex = AppTab.Home.ordinal; HomeRoute.request = "settings" })
        Box(Modifier.weight(1f).fillMaxHeight()
          .windowInsetsPadding(WindowInsets.safeDrawing.only(if (rail) WindowInsetsSides.End else WindowInsetsSides.Horizontal))
          .padding(top = if (tab == AppTab.Home || full) 0.dp else pad.calculateTopPadding(), bottom = if (full) 0.dp else pad.calculateBottomPadding())) {
          content()
        }
      }
    }
  }
}
