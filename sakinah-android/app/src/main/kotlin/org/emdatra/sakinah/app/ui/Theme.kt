package org.emdatra.sakinah.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.emdatra.sakinah.app.Fonts

/** نظام تصميم «سكينة» (مطابق لملف Figma): رموز لونية دلالية بوضعين، خطوط Readex Pro / Reem Kufi / Amiri، مسافات وزوايا */
@Immutable data class DSColors(
  val bgCanvas: Color, val bgSurface: Color, val bgSubtle: Color, val bgElevated: Color, val bgInverse: Color,
  val brandPrimary: Color, val brandStrong: Color, val brandSoft: Color, val brandDeep: Color,
  val accentGold: Color, val accentGoldSoft: Color, val accentGoldStrong: Color,
  val textPrimary: Color, val textSecondary: Color, val textTertiary: Color, val textOnBrand: Color,
  val borderSubtle: Color, val borderStrong: Color, val paperPage: Color, val paperInk: Color,
  val success: Color, val warning: Color, val danger: Color, val isDark: Boolean,
) {
  val textOnDark get() = Color(0xFFFBF9F4); val textOnDarkMuted get() = Color(0xFF9FD1CA)
  val shadow get() = Color(0xFF14211F)
}
val LightDS = DSColors(
  bgCanvas = Color(0xFFF6F4EE), bgSurface = Color(0xFFFFFFFF), bgSubtle = Color(0xFFECE8DF), bgElevated = Color(0xFFFBF9F4), bgInverse = Color(0xFF16211F),
  brandPrimary = Color(0xFF0E5C55), brandStrong = Color(0xFF0A4640), brandSoft = Color(0xFFCDE7E3), brandDeep = Color(0xFF0B3733),
  accentGold = Color(0xFFC69C3E), accentGoldSoft = Color(0xFFF3E7C9), accentGoldStrong = Color(0xFFA47E2C),
  textPrimary = Color(0xFF16211F), textSecondary = Color(0xFF5D6B68), textTertiary = Color(0xFF8A9794), textOnBrand = Color(0xFFFFFFFF),
  borderSubtle = Color(0xFFE3DFD4), borderStrong = Color(0xFFC9C4B7), paperPage = Color(0xFFFBF7EC), paperInk = Color(0xFF2A2521),
  success = Color(0xFF2F855A), warning = Color(0xFFB7791F), danger = Color(0xFFC53030), isDark = false,
)
val DarkDS = DSColors(
  bgCanvas = Color(0xFF0C1514), bgSurface = Color(0xFF14211F), bgSubtle = Color(0xFF1C2C29), bgElevated = Color(0xFF22342F), bgInverse = Color(0xFFFBF9F4),
  brandPrimary = Color(0xFF3FB5A6), brandStrong = Color(0xFF6ED0C2), brandSoft = Color(0xFF263733), brandDeep = Color(0xFF14211F),
  accentGold = Color(0xFFD9B25B), accentGoldSoft = Color(0xFF3A2F14), accentGoldStrong = Color(0xFFE2C77A),
  textPrimary = Color(0xFFFBF9F4), textSecondary = Color(0xFFA9B6B2), textTertiary = Color(0xFF7C8A86), textOnBrand = Color(0xFF0C1514),
  borderSubtle = Color(0xFF263733), borderStrong = Color(0xFF354944), paperPage = Color(0xFF101817), paperInk = Color(0xFFFBF9F4),
  success = Color(0xFF7BC59A), warning = Color(0xFFE0B25E), danger = Color(0xFFEF8A8A), isDark = true,
)
val LocalDS = staticCompositionLocalOf { LightDS }

object DS {
  val c: DSColors @Composable get() = LocalDS.current
  /** تدرّج «الليل» للبطاقات البارزة (داكن في الوضعين عمدًا) */
  val night = Brush.linearGradient(listOf(Color(0xFF0E5C55), Color(0xFF062421)))
  val nightVertical = Brush.verticalGradient(listOf(Color(0xFF0E5C55), Color(0xFF062421)))
  object Radius { val sm = 8.dp; val md = 12.dp; val lg = 16.dp; val xl = 24.dp; val xxl = 32.dp }
  val shapeSm = RoundedCornerShape(8.dp); val shapeMd = RoundedCornerShape(12.dp); val shapeLg = RoundedCornerShape(16.dp); val shapeXl = RoundedCornerShape(24.dp); val shapeXxl = RoundedCornerShape(32.dp)
}

/** سلّم الأنماط بأسماء Figma نفسها */
object DSType {
  private fun t(f: FontFamily, size: Int, w: FontWeight, lh: Float) = TextStyle(fontFamily = f, fontSize = size.sp, fontWeight = w, lineHeight = (size * lh).sp)
  val displayHero get() = t(Fonts.kufi, 40, FontWeight.Bold, 1.3f)
  val displayLg get() = t(Fonts.kufi, 30, FontWeight.SemiBold, 1.3f)
  val displayMd get() = t(Fonts.kufi, 24, FontWeight.SemiBold, 1.3f)
  val headingLg get() = t(Fonts.readex, 22, FontWeight.SemiBold, 1.4f)
  val headingMd get() = t(Fonts.readex, 18, FontWeight.SemiBold, 1.4f)
  val headingSm get() = t(Fonts.readex, 16, FontWeight.SemiBold, 1.4f)
  val bodyLg get() = t(Fonts.readex, 17, FontWeight.Normal, 1.55f)
  val bodyMd get() = t(Fonts.readex, 15, FontWeight.Normal, 1.55f)
  val bodySm get() = t(Fonts.readex, 13, FontWeight.Normal, 1.5f)
  val labelMd get() = t(Fonts.readex, 14, FontWeight.Medium, 1.4f)
  val labelSm get() = t(Fonts.readex, 12, FontWeight.Medium, 1.4f)
  val labelXs get() = t(Fonts.readex, 11, FontWeight.Medium, 1.3f)
  val numericHero get() = t(Fonts.readex, 56, FontWeight.Light, 1.1f)
  val numericLg get() = t(Fonts.readex, 28, FontWeight.Medium, 1.2f)
  val numericMd get() = t(Fonts.readex, 17, FontWeight.Medium, 1.3f)
  val readingLg get() = t(Fonts.amiriText, 22, FontWeight.Normal, 1.85f)
  val readingMd get() = t(Fonts.amiriText, 19, FontWeight.Normal, 1.8f)
  val quranInline get() = TextStyle(fontFamily = Fonts.amiri, fontSize = 22.sp, lineHeight = 44.sp)
}

// توافق مع الشاشات القائمة (تُعاد كتابتها تدريجيًا)
val Teal = Color(0xFF0E5C55); val TealStrong = Color(0xFF0A4640); val Gold = Color(0xFFC69C3E); val Paper = Color(0xFFFBF7EC); val Ink = Color(0xFF16211F)
fun hex(s: String): Color = Color(("ff" + s.trimStart('#')).toLong(16))

@Composable fun SakinahTheme(content: @Composable () -> Unit) {
  val dark = isSystemInDarkTheme()
  val ds = if (dark) DarkDS else LightDS
  val scheme = if (dark) darkColorScheme(primary = ds.brandPrimary, onPrimary = ds.textOnBrand, secondary = ds.accentGold, background = ds.bgCanvas, onBackground = ds.textPrimary, surface = ds.bgSurface, onSurface = ds.textPrimary, surfaceVariant = ds.bgSubtle, onSurfaceVariant = ds.textSecondary, outline = ds.borderStrong, outlineVariant = ds.borderSubtle, primaryContainer = ds.brandSoft, onPrimaryContainer = ds.brandPrimary, error = ds.danger)
    else lightColorScheme(primary = ds.brandPrimary, onPrimary = ds.textOnBrand, secondary = ds.accentGold, background = ds.bgCanvas, onBackground = ds.textPrimary, surface = ds.bgSurface, onSurface = ds.textPrimary, surfaceVariant = ds.bgSubtle, onSurfaceVariant = ds.textSecondary, outline = ds.borderStrong, outlineVariant = ds.borderSubtle, primaryContainer = ds.brandSoft, onPrimaryContainer = ds.brandPrimary, error = ds.danger)
  val typography = Typography(
    displayLarge = DSType.displayHero, displayMedium = DSType.displayLg, displaySmall = DSType.displayMd,
    headlineLarge = DSType.headingLg, headlineMedium = DSType.headingMd, headlineSmall = DSType.headingSm,
    titleLarge = DSType.headingMd, titleMedium = DSType.headingSm, titleSmall = DSType.labelMd,
    bodyLarge = DSType.bodyLg, bodyMedium = DSType.bodyMd, bodySmall = DSType.bodySm,
    labelLarge = DSType.labelMd, labelMedium = DSType.labelSm, labelSmall = DSType.labelXs,
  )
  CompositionLocalProvider(LocalDS provides ds) {
    MaterialTheme(colorScheme = scheme, typography = typography, shapes = Shapes(small = DS.shapeSm, medium = DS.shapeLg, large = DS.shapeXl, extraLarge = DS.shapeXxl), content = content)
  }
}
