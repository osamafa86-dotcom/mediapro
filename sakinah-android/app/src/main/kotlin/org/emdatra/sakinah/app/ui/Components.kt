package org.emdatra.sakinah.app.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// ===== مكوّنات نظام التصميم (مطابقة لصفحة Components في Figma) =====

enum class ButtonKind { Primary, Gold, Soft, Outline, Ghost }

@Composable fun DSButton(label: String, modifier: Modifier = Modifier, kind: ButtonKind = ButtonKind.Primary, icon: ImageVector? = null, enabled: Boolean = true, onClick: () -> Unit) {
  val c = DS.c
  val fg = when (kind) { ButtonKind.Primary -> c.textOnBrand; ButtonKind.Gold -> Color(0xFF16211F); else -> c.brandPrimary }
  val bg = when (kind) { ButtonKind.Primary -> c.brandPrimary; ButtonKind.Gold -> c.accentGold; ButtonKind.Soft -> c.brandSoft; else -> Color.Transparent }
  Row(modifier.clip(DS.shapeLg).background(bg).then(if (kind == ButtonKind.Outline) Modifier.border(1.5.dp, c.borderStrong, DS.shapeLg) else Modifier).clickable(enabled = enabled, role = Role.Button, onClick = onClick).padding(horizontal = 20.dp, vertical = 14.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
    Text(label, style = DSType.labelMd, color = fg)
    if (icon != null) { Spacer(Modifier.width(8.dp)); Icon(icon, null, Modifier.size(16.dp), tint = fg) }
  }
}

enum class IconStyle { Outlined, Soft, GoldSoft, Glass, Brand, Plain }

@Composable fun DSIconButton(icon: ImageVector, modifier: Modifier = Modifier, style: IconStyle = IconStyle.Outlined, size: Dp = 42.dp, iconSize: Dp = 18.dp, contentDescription: String? = null, onClick: (() -> Unit)? = null) {
  val c = DS.c
  val fg = when (style) { IconStyle.Soft -> c.brandPrimary; IconStyle.GoldSoft -> c.accentGoldStrong; IconStyle.Glass -> c.textOnDark; IconStyle.Brand -> c.textOnBrand; else -> c.textPrimary }
  val bg = when (style) { IconStyle.Outlined -> c.bgSurface; IconStyle.Soft -> c.brandSoft; IconStyle.GoldSoft -> c.accentGoldSoft; IconStyle.Glass -> Color.White.copy(alpha = 0.12f); IconStyle.Brand -> c.brandPrimary; IconStyle.Plain -> Color.Transparent }
  Box(modifier.size(size).clip(CircleShape).background(bg).then(if (style == IconStyle.Outlined) Modifier.border(1.dp, c.borderSubtle, CircleShape) else Modifier).then(if (onClick != null) Modifier.clickable(role = Role.Button, onClick = onClick) else Modifier), contentAlignment = Alignment.Center) {
    Icon(icon, contentDescription, Modifier.size(iconSize), tint = fg)
  }
}

@Composable fun DSChip(label: String, on: Boolean = false, icon: ImageVector? = null, modifier: Modifier = Modifier, onClick: () -> Unit = {}) {
  val c = DS.c
  Row(modifier.clip(CircleShape).background(if (on) c.brandPrimary else c.bgSurface).then(if (!on) Modifier.border(1.dp, c.borderSubtle, CircleShape) else Modifier).clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
    if (icon != null) { Icon(icon, null, Modifier.size(14.dp), tint = if (on) c.textOnBrand else c.textSecondary); Spacer(Modifier.width(6.dp)) }
    Text(label, style = DSType.labelSm, color = if (on) c.textOnBrand else c.textSecondary)
  }
}

/** بطاقة سطح بزاوية 24 وظلّ خفيف */
@Composable fun DSCard(modifier: Modifier = Modifier, padding: Dp = 20.dp, radius: Dp = DS.Radius.xl, onClick: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) {
  val c = DS.c; val shape = RoundedCornerShape(radius)
  Column(modifier.shadow(if (c.isDark) 0.dp else 8.dp, shape, ambientColor = c.shadow.copy(alpha = 0.10f), spotColor = c.shadow.copy(alpha = 0.12f)).clip(shape).background(c.bgSurface).then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier).padding(padding), content = content)
}
/** بلاطة بحدّ خفيف بلا ظلّ */
@Composable fun DSTile(modifier: Modifier = Modifier, padding: Dp = 14.dp, radius: Dp = DS.Radius.lg, onClick: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) {
  val c = DS.c; val shape = RoundedCornerShape(radius)
  Column(modifier.clip(shape).background(c.bgSurface).border(1.dp, c.borderSubtle, shape).then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier).padding(padding), content = content)
}
/** بطاقة «الليل» المتدرّجة مع حلقات ونجوم */
@Composable fun NightCard(modifier: Modifier = Modifier, radius: Dp = DS.Radius.xxl, padding: PaddingValues = PaddingValues(horizontal = 24.dp, vertical = 22.dp), content: @Composable ColumnScope.() -> Unit) {
  val c = DS.c; val shape = RoundedCornerShape(radius)
  Box(modifier.shadow(if (c.isDark) 0.dp else 16.dp, shape, ambientColor = c.shadow.copy(alpha = 0.18f), spotColor = c.shadow.copy(alpha = 0.22f)).clip(shape).background(DS.night)) {
    Canvas(Modifier.matchParentSize()) {
      val gold = Color(0xFFC69C3E)
      drawCircle(gold.copy(alpha = 0.35f), radius = 150.dp.toPx(), center = Offset(size.width - 30.dp.toPx(), 0f), style = Stroke(1.dp.toPx()))
      drawCircle(Color.White.copy(alpha = 0.12f), radius = 110.dp.toPx(), center = Offset(size.width - 30.dp.toPx(), 0f), style = Stroke(1.dp.toPx()))
      listOf(Triple(40f, 26f, 2f), Triple(92f, 54f, 1.5f), Triple(64f, 118f, 1f), Triple(150f, 30f, 1f)).forEach { (x, y, r) -> drawCircle(gold.copy(alpha = 0.8f), radius = r.dp.toPx(), center = Offset(size.width - x.dp.toPx(), y.dp.toPx())) }
    }
    Column(Modifier.padding(padding), content = content)
  }
}

/** شريط تقدّم يبدأ من جهة البداية (اليمين في العربية) */
@Composable fun ProgressTrack(progress: Float, modifier: Modifier = Modifier, tint: Color = DS.c.accentGold, track: Color = Color.White.copy(alpha = 0.18f), height: Dp = 6.dp) {
  val p by animateFloatAsState(progress.coerceIn(0f, 1f), label = "progress")
  Box(modifier.fillMaxWidth().height(height).clip(CircleShape).background(track)) { Box(Modifier.fillMaxWidth(p.coerceAtLeast(0.02f)).fillMaxHeight().clip(CircleShape).background(tint)) }
}
/** حلقة تقدّم دائرية */
@Composable fun RingProgress(progress: Float, modifier: Modifier = Modifier, tint: Color = DS.c.accentGold, track: Color = DS.c.borderSubtle, stroke: Dp = 6.dp) {
  val p by animateFloatAsState(progress.coerceIn(0f, 1f), label = "ring")
  Canvas(modifier) {
    val w = stroke.toPx(); val inset = w / 2
    drawArc(track, 0f, 360f, false, topLeft = Offset(inset, inset), size = androidx.compose.ui.geometry.Size(size.width - w, size.height - w), style = Stroke(w))
    drawArc(tint, -90f, 360f * p.coerceAtLeast(0.001f), false, topLeft = Offset(inset, inset), size = androidx.compose.ui.geometry.Size(size.width - w, size.height - w), style = Stroke(w, cap = StrokeCap.Round))
  }
}

@Composable fun DSSectionHead(title: String, modifier: Modifier = Modifier, link: String? = null, onLink: (() -> Unit)? = null) {
  val c = DS.c
  Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
    Text(title, style = DSType.headingMd, color = c.textPrimary)
    Spacer(Modifier.weight(1f))
    if (link != null) Row(Modifier.clickable(enabled = onLink != null) { onLink?.invoke() }, verticalAlignment = Alignment.CenterVertically) { Text(link, style = DSType.labelSm, color = c.brandPrimary); Icon(Icons.Filled.ChevronLeft, null, Modifier.size(14.dp), tint = c.brandPrimary) }
  }
}

/** صفّ قائمة: أيقونة في قرص خفيف + عنوان (+ وصف) + عنصر في النهاية */
@Composable fun DSRow(icon: ImageVector, title: String, subtitle: String? = null, iconStyle: IconStyle = IconStyle.Soft, modifier: Modifier = Modifier, onClick: (() -> Unit)? = null, trailing: @Composable RowScope.() -> Unit = { Icon(Icons.Filled.ChevronLeft, null, Modifier.size(16.dp), tint = DS.c.textTertiary) }) {
  val c = DS.c
  Row(modifier.fillMaxWidth().then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier).padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
    DSIconButton(icon, style = iconStyle, size = 40.dp, iconSize = 17.dp)
    Spacer(Modifier.width(12.dp))
    Column(Modifier.weight(1f)) { Text(title, style = DSType.labelMd, color = c.textPrimary); if (subtitle != null) Text(subtitle, style = DSType.labelXs, color = c.textSecondary) }
    trailing()
  }
}

/** شريط عنوان: رجوع يمينًا، عنوان في الوسط، إجراء يسارًا */
@Composable fun DSNavBar(title: String, subtitle: String? = null, onBack: (() -> Unit)? = null, trailing: @Composable () -> Unit = {}) {
  val c = DS.c
  Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
    if (onBack != null) DSIconButton(Icons.Filled.ChevronRight, iconSize = 18.dp, contentDescription = "رجوع", onClick = onBack) else Spacer(Modifier.size(42.dp))
    Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) { Text(title, style = DSType.headingMd, color = c.textPrimary, maxLines = 1); if (subtitle != null) Text(subtitle, style = DSType.labelXs, color = c.textSecondary, maxLines = 1) }
    Box(Modifier.widthIn(min = 42.dp), contentAlignment = Alignment.Center) { trailing() }
  }
}

enum class AppTab(val title: String, val icon: ImageVector, val iconSelected: ImageVector) {
  Prayer("الصلاة", Icons.Outlined.Home, Icons.Filled.Home), Qibla("القبلة", Icons.Outlined.Explore, Icons.Filled.Explore), Mushaf("المصحف", Icons.Outlined.MenuBook, Icons.Filled.MenuBook), Adhkar("الأذكار", Icons.Outlined.Grain, Icons.Filled.Grain), More("المزيد", Icons.Outlined.MoreHoriz, Icons.Filled.MoreHoriz)
}
/** شريط التبويبات الخمسة */
@Composable fun DSTabBar(selected: AppTab, onSelect: (AppTab) -> Unit) {
  val c = DS.c
  Column(Modifier.fillMaxWidth().background(c.bgSurface)) {
    Box(Modifier.fillMaxWidth().height(0.5.dp).background(c.borderSubtle))
    Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 8.dp, vertical = 6.dp)) {
      AppTab.entries.forEach { tab ->
        val on = tab == selected
        val tint by animateColorAsState(if (on) c.brandPrimary else c.textTertiary, label = "tab")
        Column(Modifier.weight(1f).clip(DS.shapeMd).clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, role = Role.Tab, onClick = { onSelect(tab) }).padding(vertical = 6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
          Icon(if (on) tab.iconSelected else tab.icon, tab.title, Modifier.size(24.dp), tint = tint)
          Spacer(Modifier.height(3.dp))
          Text(tab.title, style = DSType.labelXs, color = tint)
        }
      }
    }
  }
}

/** حبّة معلومات (التاريخ الهجري) */
@Composable fun DSPill(icon: ImageVector, text: String, secondary: String? = null, modifier: Modifier = Modifier) {
  val c = DS.c
  Row(modifier.clip(CircleShape).background(c.bgSubtle).padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
    Icon(icon, null, Modifier.size(14.dp), tint = c.accentGoldStrong); Spacer(Modifier.width(8.dp))
    Text(text, style = DSType.labelSm, color = c.textSecondary)
    if (secondary != null) { Text("  ·  ", style = DSType.labelSm, color = c.textTertiary); Text(secondary, style = DSType.labelSm, color = c.textTertiary) }
  }
}
@Composable fun DSBadge(text: String, fg: Color = DS.c.textOnBrand, bg: Color = DS.c.brandPrimary) {
  Text(text, style = DSType.labelXs, color = fg, modifier = Modifier.clip(CircleShape).background(bg).padding(horizontal = 8.dp, vertical = 3.dp))
}
@Composable fun DSQuickTile(icon: ImageVector, title: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
  val c = DS.c
  DSTile(modifier, padding = 0.dp, onClick = onClick) {
    Column(Modifier.fillMaxWidth().padding(vertical = 14.dp, horizontal = 6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
      Icon(icon, null, Modifier.size(22.dp), tint = c.brandPrimary); Spacer(Modifier.height(8.dp)); Text(title, style = DSType.labelSm, color = c.textPrimary, maxLines = 1)
    }
  }
}
@Composable fun DSStatTile(value: String, label: String, modifier: Modifier = Modifier) {
  val c = DS.c
  DSTile(modifier, padding = 0.dp) {
    Column(Modifier.fillMaxWidth().padding(vertical = 12.dp, horizontal = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
      Text(value, style = DSType.numericLg, color = c.textPrimary, maxLines = 1); Text(label, style = DSType.labelXs, color = c.textSecondary)
    }
  }
}
/** مفتاح تبديل بلون الهوية */
@Composable fun DSToggle(checked: Boolean, onChange: (Boolean) -> Unit, modifier: Modifier = Modifier) {
  val c = DS.c
  val bg by animateColorAsState(if (checked) c.brandPrimary else c.borderStrong, label = "toggle")
  val pad by animateDpAsState(if (checked) 21.dp else 3.dp, label = "knob")
  Box(modifier.size(46.dp, 28.dp).clip(CircleShape).background(bg).clickable(role = Role.Switch) { onChange(!checked) }.padding(start = pad, top = 3.dp)) {
    Box(Modifier.size(22.dp).clip(CircleShape).background(if (checked) c.textOnBrand else c.bgSurface))
  }
}
/** صفّ إعداد: عنوان ووصف + مفتاح تبديل */
@Composable fun DSToggleRow(title: String, subtitle: String? = null, checked: Boolean, onChange: (Boolean) -> Unit) {
  val c = DS.c
  Row(Modifier.fillMaxWidth().clickable { onChange(!checked) }.padding(horizontal = 14.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
    Column(Modifier.weight(1f)) { Text(title, style = DSType.labelMd, color = c.textPrimary); if (subtitle != null) Text(subtitle, style = DSType.labelXs, color = c.textSecondary) }
    DSToggle(checked, onChange)
  }
}
@Composable fun DSDivider(modifier: Modifier = Modifier) { Box(modifier.fillMaxWidth().height(1.dp).background(DS.c.borderSubtle)) }
@Composable fun Dots(count: Int, active: Int) {
  val c = DS.c
  Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { repeat(count) { i -> val w by animateDpAsState(if (i == active) 24.dp else 8.dp, label = "dot"); Box(Modifier.size(w, 8.dp).clip(CircleShape).background(if (i == active) c.accentGold else c.borderStrong)) } }
}
