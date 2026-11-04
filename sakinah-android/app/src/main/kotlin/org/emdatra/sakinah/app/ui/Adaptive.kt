package org.emdatra.sakinah.app.ui

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.isSpecified
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.window.layout.FoldingFeature
import androidx.window.layout.WindowInfoTracker
import androidx.window.layout.WindowLayoutInfo
import androidx.window.layout.WindowMetricsCalculator
import kotlinx.coroutines.flow.emptyFlow
import org.emdatra.sakinah.app.LiveDay
import org.emdatra.sakinah.app.brush
import org.emdatra.sakinah.core.SkyPalette
import org.emdatra.sakinah.core.SkyPhase
import kotlin.math.roundToInt

/**
 * الشاشات الكبيرة والأجهزة المطوية (المرحلة الرابعة — rules.png): فئة العرض تُحسب من عرض **النافذة** لا الجهاز
 * (الآيباد في Split View قد يكون «مضغوطاً»، والمطويّ مفتوحاً «متوسطاً»)، ووضعية المفصل من `androidx.window`.
 *  - مضغوط < ٦٠٠: الواجهة الحالية كما هي.
 *  - متوسط ٦٠٠–٨٣٩: السماء بعرضٍ كامل وتحتها شبكة عمودين، والتبويبات أسفل الشاشة.
 *  - موسّع ≥ ٨٤٠: شريطٌ جانبيّ في بداية الشاشة (يميناً)، والسماء عمودٌ ثابت بجانب البطاقات، والمصحف صفحتان.
 * المفصل: الفاصل (شاشتان أو نصف طيّ) فجوةٌ بين لوحين لا يقطعها محتوى؛ الطيّ الأفقيّ نصف مفتوح = وضع الطاولة؛
 * الرأسيّ = وضع الكتاب (المصحف صفحتان متقابلتان).
 */
enum class WidthClass { Compact, Medium, Expanded;
  companion object { fun of(widthDp: Int) = when { widthDp < 600 -> Compact; widthDp < 840 -> Medium; else -> Expanded } }
}

/** المفصل بإحداثيات النافذة (بكسل): رأسيّ أم أفقيّ، نصف مفتوح أم مسطّح، وهل يفصل المحتوى (شاشتان أو نصف طيّ) */
@Immutable class Hinge(val left: Int, val top: Int, val right: Int, val bottom: Int, val vertical: Boolean, val halfOpened: Boolean, val separating: Boolean)

@Immutable class Adaptive(val widthDp: Int, val heightDp: Int, val width: WidthClass, val hinge: Hinge?) {
  val compact get() = width == WidthClass.Compact
  val medium get() = width == WidthClass.Medium
  val expanded get() = width == WidthClass.Expanded
  val landscape get() = widthDp > heightDp
  /** وضع الطاولة: طيٌّ أفقيّ نصف مفتوح — النصف الأعلى للعرض والأسفل للتحكّم */
  val tabletop get() = hinge?.let { it.halfOpened && !it.vertical } == true
  /** وضع الكتاب: طيٌّ رأسيّ نصف مفتوح */
  val book get() = hinge?.let { it.halfOpened && it.vertical } == true
  /** طيٌّ رأسيّ (مسطّحاً كان أو نصف مفتوح): لوحان يفصلهما خطّ الطيّ */
  val verticalFold: Hinge? get() = hinge?.takeIf { it.vertical }
  /** مفصلٌ رأسيّ فاصل (شاشتان، أو كتاب): لا محتوى يعبره */
  val verticalSeparator: Hinge? get() = hinge?.takeIf { it.vertical && it.separating }
  /** المصحف صفحتين متقابلتين: موسّع أفقيّ، أو وضع الكتاب، أو شاشتان يفصلهما مفصل */
  val mushafSpread get() = book || verticalSeparator != null || (expanded && landscape)
}

val LocalAdaptive = compositionLocalOf { Adaptive(360, 800, WidthClass.Compact, null) }

private fun activityOf(ctx: Context): Activity? { var c: Context = ctx; while (c is ContextWrapper) { if (c is Activity) return c; c = c.baseContext }; return null }

/** فئة العرض من مقاييس النافذة الحالية (تتبدّل مع Split View والطيّ والتدوير)، والمفصل من WindowInfoTracker */
@Composable fun rememberAdaptive(): Adaptive {
  val cfg = LocalConfiguration.current; val ctx = LocalContext.current; val density = LocalDensity.current.density
  val activity = remember(ctx) { activityOf(ctx) }
  val flow = remember(activity) { activity?.let { WindowInfoTracker.getOrCreate(it).windowLayoutInfo(it) } ?: emptyFlow<WindowLayoutInfo>() }
  val info by flow.collectAsState(initial = null)
  // المقاييس تُعاد مع كل تغيير إعداد (التدوير، تغيير حجم النافذة، الطيّ) — الإعداد مفتاحها
  val bounds = remember(cfg.screenWidthDp, cfg.screenHeightDp, cfg.orientation, activity) {
    activity?.let { runCatching { WindowMetricsCalculator.getOrCreate().computeCurrentWindowMetrics(it).bounds }.getOrNull() }
  }
  val w = bounds?.let { (it.width() / density).roundToInt() } ?: cfg.screenWidthDp
  val h = bounds?.let { (it.height() / density).roundToInt() } ?: cfg.screenHeightDp
  val fold = info?.displayFeatures?.filterIsInstance<FoldingFeature>()?.firstOrNull()
  val hinge = fold?.let { f -> val b = f.bounds; Hinge(b.left, b.top, b.right, b.bottom, f.orientation == FoldingFeature.Orientation.VERTICAL, f.state == FoldingFeature.State.HALF_OPENED, f.isSeparating) }
  return remember(w, h, hinge?.left, hinge?.top, hinge?.right, hinge?.bottom, hinge?.vertical, hinge?.halfOpened, hinge?.separating) { Adaptive(w, h, WidthClass.of(w), hinge) }
}

/**
 * لوحان جنباً إلى جنب: «البداية» (يميناً في العربية) و«النهاية». مع طيٍّ رأسيّ يقع داخل التخطيط يُقسَم عنده بالضبط
 * (وفجوةٌ لا تقلّ عن [gap] حوله إن كان خطّ الطيّ بلا عرض) فلا تعبره بطاقة؛ وبلا طيّ تأخذ البداية [startFraction]
 * من العرض مقيّدةً بين [minStart] و[maxStart]. الارتفاع محدود: كل لوح بارتفاع التخطيط (وتمريره في داخله).
 */
@Composable fun TwoPane(modifier: Modifier = Modifier, startFraction: Float = 0.5f, minStart: Dp = 0.dp, maxStart: Dp = Dp.Infinity, gap: Dp = 16.dp,
                        useHinge: Boolean = true, start: @Composable () -> Unit, end: @Composable () -> Unit) {
  // داخل مقلّبٍ يتحرّك (صفحتا المصحف) يُمرَّر الانقسام محسوباً من حاوية ثابتة بدل الطيّ نفسه (useHinge = false)
  val hinge = if (useHinge) LocalAdaptive.current.verticalFold else null
  val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
  var origin by remember { mutableStateOf(Offset.Unspecified) }
  Layout(contents = listOf({ Box { start() } }, { Box { end() } }), modifier = modifier.onGloballyPositioned { origin = it.positionInWindow() }) { ms, c ->
    val w = c.maxWidth; val g = gap.roundToPx()
    // المنطقتان بإحداثيات فعلية من اليسار: يسرى [0، l) ويمنى [r، w)
    var l = -1; var r = -1
    if (hinge != null && origin.isSpecified) {
      val hl = (hinge.left - origin.x).roundToInt(); val hr = (hinge.right - origin.x).roundToInt()
      if (hl > g && hr < w - g) { if (hr - hl < g) { val mid = (hl + hr) / 2; l = mid - g / 2; r = l + g } else { l = hl; r = hr } }
    }
    if (l < 0) {
      val avail = (w - g).coerceAtLeast(0)
      val maxS = if (maxStart == Dp.Infinity) avail else minOf(avail, maxStart.roundToPx())
      val s = (avail * startFraction).roundToInt().coerceIn(minOf(minStart.roundToPx(), maxS), maxS)
      if (rtl) { r = w - s; l = r - g } else { l = s; r = l + g }
    }
    l = l.coerceIn(0, w); r = r.coerceIn(l, w)
    val startW = if (rtl) w - r else l; val endW = if (rtl) l else w - r
    fun cons(width: Int) = if (c.hasBoundedHeight) Constraints.fixed(width, c.maxHeight) else Constraints(minWidth = width, maxWidth = width)
    val sp = ms[0].map { it.measure(cons(startW)) }; val ep = ms[1].map { it.measure(cons(endW)) }
    val h = if (c.hasBoundedHeight) c.maxHeight else maxOf(sp.maxOfOrNull { it.height } ?: 0, ep.maxOfOrNull { it.height } ?: 0)
    layout(w, h) {
      // place لا placeRelative: المواضع فعلية (البداية يميناً في العربية)
      sp.forEach { it.place(if (rtl) r else 0, 0) }
      ep.forEach { it.place(if (rtl) 0 else r, 0) }
    }
  }
}

/**
 * لوحان فوق وتحت عند طيٍّ أفقيّ (وضع الطاولة): الأعلى ينتهي عند أعلى المفصل والأسفل يبدأ بعد أسفله (بفجوةٍ لا تقلّ
 * عن [gap])؛ وبلا مفصلٍ داخل التخطيط يُقسم عند [topFraction].
 */
@Composable fun TopBottomPane(modifier: Modifier = Modifier, topFraction: Float = 0.5f, gap: Dp = 12.dp, top: @Composable () -> Unit, bottom: @Composable () -> Unit) {
  val hinge = LocalAdaptive.current.hinge?.takeIf { !it.vertical }
  var origin by remember { mutableStateOf(Offset.Unspecified) }
  Layout(contents = listOf({ Box { top() } }, { Box { bottom() } }), modifier = modifier.onGloballyPositioned { origin = it.positionInWindow() }) { ms, c ->
    val w = c.maxWidth; val h = if (c.hasBoundedHeight) c.maxHeight else 0; val g = gap.roundToPx()
    var t = -1; var b = -1
    if (hinge != null && origin.isSpecified) {
      val ht = (hinge.top - origin.y).roundToInt(); val hb = (hinge.bottom - origin.y).roundToInt()
      if (ht > g && hb < h - g) { if (hb - ht < g) { val mid = (ht + hb) / 2; t = mid - g / 2; b = t + g } else { t = ht; b = hb } }
    }
    if (t < 0) { t = ((h - g) * topFraction).roundToInt().coerceAtLeast(0); b = t + g }
    t = t.coerceIn(0, h); b = b.coerceIn(t, h)
    val tp = ms[0].map { it.measure(Constraints.fixed(w, t)) }; val bp = ms[1].map { it.measure(Constraints.fixed(w, h - b)) }
    layout(w, h) { tp.forEach { it.place(0, 0) }; bp.forEach { it.place(0, b) } }
  }
}

/**
 * عرضٌ مقروء للقوائم والإعدادات والبحث في الشاشات غير المضغوطة: عمودٌ في الوسط لا يتجاوز [maxWidth]، ومع مفصلٍ فاصل
 * يوضع في لوح البداية وحده كي لا يعبر المفصلَ سطر. المضغوط يمرّ كما هو بلا أيّ تغليف.
 */
@Composable fun ReadableBox(maxWidth: Dp = 720.dp, content: @Composable () -> Unit) {
  val a = LocalAdaptive.current
  when {
    a.compact -> content()
    a.verticalSeparator != null -> TwoPane(Modifier.fillMaxSize(), gap = 24.dp, start = { Box(Modifier.fillMaxSize()) { content() } }, end = { Box(Modifier.fillMaxSize()) })
    else -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) { Box(Modifier.widthIn(max = maxWidth).fillMaxSize()) { content() } }
  }
}

/** طلبٌ يفتح شاشةً فوق «اليوم» من خارجه (الشريط الجانبيّ، والإشعار الحيّ): «search»، «settings»، «hisn:68»… — يستهلكه «اليوم» مرّة */
object HomeRoute { var request by mutableStateOf<String?>(null) }

/**
 * الشريط الجانبيّ في الشاشة الموسّعة (ipad-landscape.png): قرص السماء الحالية، ثم التبويبات الأربعة رأسياً (المختار في
 * حبّةٍ نعناعية كشريط الهاتف)، وفي أسفله البحث والإعدادات — في بداية الشاشة (يميناً في العربية) مكان الشريط العائم.
 */
@Composable fun SideRail(selected: AppTab, onSelect: (AppTab) -> Unit, onSearch: () -> Unit, onSettings: () -> Unit, modifier: Modifier = Modifier) {
  val c = DS.c
  val palette = remember(selected) { runCatching { LiveDay.model()?.palette }.getOrNull() ?: SkyPalette.of(SkyPhase.DHUHR) }
  Row(modifier.fillMaxHeight()) {
    Column(Modifier.fillMaxHeight().width(92.dp).background(c.bgSurface).windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Vertical + WindowInsetsSides.Start)).padding(vertical = 14.dp),
      horizontalAlignment = Alignment.CenterHorizontally) {
      Box(Modifier.size(40.dp).clip(CircleShape).background(palette.brush()).border(1.dp, c.borderSubtle, CircleShape).semantics { contentDescription = "سكينة" })
      Spacer(Modifier.height(18.dp))
      Column(verticalArrangement = Arrangement.spacedBy(6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        AppTab.entries.forEach { tab ->
          val on = tab == selected
          val tint by animateColorAsState(if (on) c.brandStrong else c.textTertiary, label = "rail")
          val bg by animateColorAsState(if (on) c.brandSoft.copy(alpha = 0.85f) else Color.Transparent, label = "railbg")
          Column(Modifier.width(72.dp).clip(RoundedCornerShape(18.dp)).background(bg)
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, role = Role.Tab, onClick = { onSelect(tab) })
            .semantics { this.selected = on }.padding(top = 9.dp, bottom = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(if (on) tab.iconSelected else tab.icon, null, Modifier.size(24.dp), tint = tint)
            Spacer(Modifier.height(3.dp))
            Text(tab.title, style = DSType.labelXs.copy(fontSize = 11.sp, fontWeight = if (on) FontWeight.SemiBold else FontWeight.Medium), color = tint, maxLines = 1)
          }
        }
      }
      Spacer(Modifier.weight(1f))
      RailButton(Icons.Outlined.Search, "البحث", onSearch)
      Spacer(Modifier.height(10.dp))
      RailButton(Icons.Outlined.Tune, "الإعدادات", onSettings)
    }
    Box(Modifier.fillMaxHeight().width(1.dp).background(c.borderSubtle))
  }
}
@Composable private fun RailButton(icon: ImageVector, label: String, onClick: () -> Unit) {
  val c = DS.c
  Box(Modifier.size(48.dp).clip(CircleShape).background(c.bgSubtle).clickable(role = Role.Button, onClick = onClick), contentAlignment = Alignment.Center) {
    Icon(icon, label, Modifier.size(20.dp), tint = c.textSecondary)
  }
}
