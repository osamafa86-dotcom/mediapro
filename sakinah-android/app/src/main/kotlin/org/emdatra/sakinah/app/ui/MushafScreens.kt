package org.emdatra.sakinah.app.ui

import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import android.content.Context
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import android.view.accessibility.AccessibilityManager
import androidx.core.content.ContextCompat
import java.time.Instant
import androidx.compose.ui.layout.onSizeChanged
import kotlin.math.roundToInt
import androidx.compose.ui.AbsoluteAlignment
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.*
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.TextUnit
import kotlinx.coroutines.launch
import org.emdatra.sakinah.app.*
import org.emdatra.sakinah.core.*


/** وجهة القارئ من المكتبة: صفحة وآية، مع بدء التلاوة (بلاطة الاستماع) أو جلسة الحفظ (بلاطة المراجعة) فور الفتح */
data class ReaderTarget(val page: Int, val ayah: Int? = null, val autoplay: Boolean = false, val hifz: Boolean = false)

/** مكتبة المصحف (تصميم Figma «٨ · المصحف» بعد مراجعة الخبراء): بطاقة حالة واحدة، بلاطتان لا تكرّران الشريط السفلي، الفهرس فوق الطيّة، ثم «التزامك بالورد» */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable fun MushafHome() {
  val c = DS.c
  var reader by remember { mutableStateOf<ReaderTarget?>(org.emdatra.sakinah.app.ScreenshotMode.readerPage?.let { ReaderTarget(it) }) }
  var q by remember { mutableStateOf("") }; var tab by remember { mutableIntStateOf(org.emdatra.sakinah.app.ScreenshotMode.libraryTab) }; var searching by remember { mutableStateOf(false) }
  var sheet by remember { mutableStateOf<String?>(org.emdatra.sakinah.app.ScreenshotMode.librarySheet) }
  LaunchedEffect(Store.pendingReaderPage) { Store.pendingReaderPage?.let { p -> Store.pendingReaderPage = null; reader = ReaderTarget(p) } }
  reader?.let { t -> MushafReader(startPage = t.page, startAyah = t.ayah, autoplay = t.autoplay, hifz = t.hifz, onClose = { reader = null }); return }
  val last = Store.lastRead
  val lastN = last?.let { QuranText.shared.ayah(it.surah, it.ayah)?.n }
  Column(Modifier.fillMaxSize()) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(top = 6.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
      Text("المصحف", style = DSType.displayLg, color = c.textPrimary); Spacer(Modifier.weight(1f))
      DSIconButton(if (searching) Icons.Filled.Close else Icons.Outlined.Search, contentDescription = if (searching) "إغلاق البحث" else "بحث", onClick = { searching = !searching; if (!searching) q = "" })
    }
    if (searching) OutlinedTextField(q, { q = it }, Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 4.dp), placeholder = { Text("سورة، آية، نص، أو رقم صفحة…", style = DSType.bodySm) }, singleLine = true, shape = CircleShape, leadingIcon = { Icon(Icons.Outlined.Search, null, tint = c.textTertiary) })
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 20.dp), contentPadding = PaddingValues(top = 8.dp, bottom = 24.dp)) {
      if (q.isBlank()) {
        item { Box(Modifier.padding(bottom = 14.dp)) { HeroCard(onOpen = { p, n -> reader = ReaderTarget(p, n) }, onKhatmah = { sheet = "khatmah" }) } }
        item {
          Row(Modifier.padding(bottom = 14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Tile(Icons.Filled.PlayArrow, "الاستماع", "${Catalog.shared.reciter(Store.reciter).name} · ${last?.let { QuranMeta.surah(it.surah).name } ?: "الفاتحة"}", Modifier.weight(1f)) { reader = ReaderTarget(last?.page ?: 1, lastN, autoplay = true) }
            Tile(Icons.Outlined.Mic, "مراجعة الحفظ", "من صفحتك · على الجهاز", Modifier.weight(1f)) { reader = ReaderTarget(last?.page ?: 1, hifz = true) }
          }
        }
        item { IndexHead(tab, onTab = { tab = it }, onSearch = { searching = true }) }
        when (tab) {
          0 -> itemsIndexed(QuranMeta.surahs) { i, s -> IndexRow(i == 0, i == 113) { SurahRow(s) { reader = ReaderTarget(s.page, QuranText.shared.ayah(s.n, 1)?.n) } } }
          1 -> itemsIndexed(QuranMeta.juzStarts) { i, j -> IndexRow(i == 0, i == 29) { JuzRow(j) { reader = ReaderTarget(j.page) } } }
          2 -> items((1..60).toList()) { h -> IndexRow(h == 1, h == 60) { HizbRow(h) { p -> reader = ReaderTarget(p) } } }
          else -> item { IndexRow(true, true) { BookmarksList { p, n -> reader = ReaderTarget(p, n) } } }
        }
        item { Box(Modifier.padding(top = 14.dp)) { CommitmentCard { sheet = "khatmah" } } }
        item { Text("مصحف المدينة · حفص عن عاصم · ٦٠٤ صفحات · يعمل دون اتصال", Modifier.fillMaxWidth().padding(top = 18.dp), style = DSType.labelXs, color = c.textTertiary, textAlign = TextAlign.Center) }
      } else {
        val s = QuranNormalize.foldDigits(q.trim()); val page = s.toIntOrNull(); val ref = QuranSearch.parseRef(s)
        if (page != null && page in 1..604) item { DSCard(Modifier.fillMaxWidth().padding(bottom = 14.dp), padding = 4.dp) { DSRow(Icons.Outlined.MenuBook, "الانتقال إلى الصفحة ${Fmt.number(page)}", null, onClick = { reader = ReaderTarget(page) }) } }
        else if (ref != null) { val a = QuranText.shared.ayah(ref.surah.n, minOf(ref.surah.ayahs, ref.ayah)); if (a != null) item { DSCard(Modifier.fillMaxWidth().padding(bottom = 14.dp), padding = 4.dp) { DSRow(Icons.Outlined.MenuBook, "سورة ${ref.surah.name} — الآية ${Fmt.number(a.ayah)}", "الصفحة ${Fmt.number(a.page)}", onClick = { reader = ReaderTarget(a.page, a.n) }) } } }
        else {
          val surahs = QuranSearch.matchSurahs(s); val ayat = if (s.length >= 2) QuranSearch.shared.search(s, 30) else emptyList()
          if (surahs.isNotEmpty()) item { DSCard(Modifier.fillMaxWidth().padding(bottom = 14.dp), padding = 8.dp) { surahs.forEach { su -> SurahRow(su) { reader = ReaderTarget(su.page, QuranText.shared.ayah(su.n, 1)?.n) } } } }
          if (ayat.isNotEmpty()) item { DSCard(Modifier.fillMaxWidth().padding(bottom = 14.dp), padding = 8.dp) { ayat.forEach { a -> Column(Modifier.fillMaxWidth().clip(DS.shapeMd).clickable { reader = ReaderTarget(a.page, a.n) }.padding(10.dp)) { Text(a.text.take(90), style = DSType.quranInline.copy(fontSize = 16.sp, lineHeight = 30.sp), color = c.textPrimary, maxLines = 2, overflow = TextOverflow.Ellipsis); Text("${QuranSearch.refLabel(a)} · ص ${Fmt.number(a.page)}", style = DSType.labelXs, color = c.textSecondary) } } } }
          if (surahs.isEmpty() && ayat.isEmpty()) item { Text("لا نتائج", Modifier.padding(12.dp), style = DSType.bodyMd, color = c.textSecondary) }
        }
      }
    }
  }
  when (sheet) {
    "khatmah" -> KhatmahSheet(onDismiss = { sheet = null }, onGo = { p -> sheet = null; reader = ReaderTarget(p) })
    "reciters" -> ModalBottomSheet(onDismissRequest = { sheet = null }, containerColor = c.bgSurface) { ReciterList { sheet = null } }
  }
}

/** بطاقة الحالة الواحدة: السورة والموضع، سطر الورد من سجلّ الورد (لا من آخر صفحة مفتوحة)، زرّ المتابعة، وصورة الصفحة المصغّرة بشريط علامة */
@Composable private fun HeroCard(onOpen: (Int, Int?) -> Unit, onKhatmah: () -> Unit) {
  val c = DS.c; val last = Store.lastRead; val page = last?.page ?: 1
  val stt = Store.khatmah?.let { Khatmah.status(it, Store.wird, Store.todayKey) }
  val wirdLine = when {
    stt == null -> "ابدأ خطة ختمة لتقسيم المصحف على أيامك"
    stt.finished -> "تقبّل الله ✦ أتممت الختمة"
    else -> { val target = maxOf(1, stt.todayTarget); val state = if (stt.todayPages >= target) "أتممت ورد اليوم ✓" else if (stt.behind > 0) "ما فات يُوزَّع على الأيام الباقية" else "على الجدول ✓"; "ورد اليوم: ${Fmt.number(minOf(stt.todayPages, target))} من ${Fmt.number(target)} صفحة  ·  الختمة ${Fmt.number(stt.percent)}٪  ·  $state" }
  }
  NightCard(Modifier.fillMaxWidth(), padding = PaddingValues(20.dp)) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
      Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Text(if (last == null) "ابدأ القراءة" else "متابعة القراءة", style = DSType.labelSm, color = c.textOnDarkMuted)
        Text(last?.let { "سورة ${QuranMeta.surah(it.surah).name}" } ?: "سورة الفاتحة", style = DSType.readingLg.copy(fontSize = 24.sp, lineHeight = 34.sp, fontWeight = FontWeight.Bold), color = c.textOnDark, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(last?.let { "الصفحة ${Fmt.number(it.page)}  ·  الجزء ${Fmt.number(QuranMeta.juzOfPage(it.page))}  ·  الآية ${Fmt.number(it.ayah)}" } ?: "الصفحة ١  ·  الجزء ١", style = DSType.labelSm, color = c.textOnDarkMuted, maxLines = 1)
        Text(wirdLine, Modifier.clickable(onClick = onKhatmah), style = DSType.labelSm, color = Color(0xFFE2C77A), maxLines = 2, overflow = TextOverflow.Ellipsis)
        Row(Modifier.padding(top = 6.dp).clip(CircleShape).background(c.accentGold).clickable { onOpen(page, last?.let { QuranText.shared.ayah(it.surah, it.ayah)?.n }) }.padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
          Text(if (last == null) "افتح المصحف" else "تابع القراءة", style = DSType.labelSm.copy(fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold), color = Color(0xFF16211F))
          Icon(Icons.Filled.ChevronLeft, null, Modifier.size(12.dp), tint = Color(0xFF16211F))
        }
      }
      Spacer(Modifier.width(14.dp))
      Box { PageThumb(page); if (last != null) Box(Modifier.align(Alignment.TopStart).offset(x = 6.dp, y = (-6).dp).size(10.dp, 26.dp).clip(RoundedCornerShape(2.dp)).background(c.accentGold)) }
    }
  }
}
/** صورة صفحة مصغّرة: ورق، ترويسة، تسعة أسطر، رقم الصفحة */
@Composable private fun PageThumb(page: Int) {
  val c = DS.c
  Box(Modifier.size(78.dp, 106.dp).clip(RoundedCornerShape(10.dp)).background(c.paperPage).border(1.dp, c.accentGold.copy(alpha = 0.7f), RoundedCornerShape(10.dp))) {
    Column(Modifier.fillMaxSize().padding(horizontal = 11.dp).padding(top = 11.dp, bottom = 4.dp), horizontalAlignment = Alignment.End) {
      Box(Modifier.fillMaxWidth().height(9.dp).clip(RoundedCornerShape(2.dp)).background(c.brandSoft))
      Spacer(Modifier.height(7.dp))
      for (i in 0 until 9) { Box(Modifier.width(if (i == 8) 34.dp else 56.dp).height(1.6.dp).background(c.paperInk.copy(alpha = 0.55f))); Spacer(Modifier.height(6.4.dp)) }
      Spacer(Modifier.weight(1f))
      Text(Fmt.number(page), Modifier.align(Alignment.CenterHorizontally), style = DSType.labelXs.copy(fontSize = 7.sp, fontFamily = Fonts.amiriText), color = c.accentGoldStrong)
    }
    Box(Modifier.matchParentSize().padding(6.dp).border(0.8.dp, c.accentGold.copy(alpha = 0.45f), RoundedCornerShape(4.dp)))
  }
}
@Composable private fun Tile(icon: ImageVector, title: String, sub: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
  val c = DS.c
  DSTile(modifier, padding = 12.dp, onClick = onClick) { Row(verticalAlignment = Alignment.CenterVertically) { DSIconButton(icon, style = IconStyle.Soft, size = 38.dp, iconSize = 16.dp); Spacer(Modifier.width(10.dp)); Column { Text(title, style = DSType.labelMd.copy(fontSize = 13.sp, fontWeight = FontWeight.SemiBold), color = c.textPrimary, maxLines = 1); Text(sub, style = DSType.labelXs, color = c.textTertiary, maxLines = 1, overflow = TextOverflow.Ellipsis) } } }
}
/** رأس الفهرس فوق الطيّة: بحث ومقسّم رباعي (السور · الأجزاء · الأحزاب · العلامات)؛ الصفوف عناصر كسولة في عمود المكتبة نفسه */
@Composable private fun IndexHead(tab: Int, onTab: (Int) -> Unit, onSearch: () -> Unit) {
  val c = DS.c
  Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(topStart = DS.Radius.xl, topEnd = DS.Radius.xl)).background(c.bgSurface).padding(12.dp)) {
    Row(Modifier.fillMaxWidth().clip(CircleShape).background(c.bgCanvas).border(1.dp, c.borderSubtle, CircleShape).clickable(role = Role.Button, onClick = onSearch).padding(horizontal = 14.dp, vertical = 11.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      Icon(Icons.Outlined.Search, null, Modifier.size(16.dp), tint = c.textTertiary); Text("سورة، آية، نص، أو رقم صفحة…", style = DSType.bodySm, color = c.textTertiary)
    }
    Spacer(Modifier.height(8.dp))
    DSSegmented(listOf("السور", "الأجزاء", "الأحزاب", "العلامات"), tab, onSelect = onTab)
  }
}
/** صفّ من صفوف الفهرس على سطح البطاقة (الأوّل يلي الرأس، والأخير يُغلق الزوايا) */
@Composable private fun IndexRow(first: Boolean, last: Boolean, top: Boolean = false, content: @Composable () -> Unit) {
  val c = DS.c
  Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(topStart = if (top) DS.Radius.xl else 0.dp, topEnd = if (top) DS.Radius.xl else 0.dp, bottomStart = if (last) DS.Radius.xl else 0.dp, bottomEnd = if (last) DS.Radius.xl else 0.dp)).background(c.bgSurface).padding(horizontal = 12.dp).padding(top = if (first) 4.dp else 0.dp, bottom = if (last) 12.dp else 0.dp)) {
    content()
    if (!last) RowDivider()
  }
}
@Composable private fun BookmarksList(onGo: (Int, Int?) -> Unit) {
  val c = DS.c
  if (Store.bookmarks.isEmpty()) Text("لا علامات بعد — انقر كلمة في المصحف ثم «علامة» في رصيف الآية", Modifier.padding(12.dp), style = DSType.bodySm, color = c.textSecondary)
  Store.bookmarks.reversed().forEach { b -> val a = QuranText.shared.ayah(b.surah, b.ayah); if (a != null) DSRow(Icons.Filled.Bookmark, "${QuranMeta.surah(a.surah).name}: ${Fmt.number(a.ayah)}", b.note?.takeIf { it.isNotBlank() } ?: a.text.take(60), iconStyle = IconStyle.GoldSoft, onClick = { onGo(a.page, a.n) }) { PageNum(a.page) } }
}
@Composable private fun RowDivider() { Box(Modifier.fillMaxWidth().padding(start = 56.dp).height(1.dp).background(DS.c.borderSubtle)) }
@Composable private fun PageNum(page: Int) { val c = DS.c; Column(horizontalAlignment = Alignment.CenterHorizontally) { Text(Fmt.number(page), style = DSType.numericMd, color = c.textSecondary); Text("صفحة", style = DSType.labelXs, color = c.textTertiary) } }
/** رقم داخل نجمة ثمانية بحدّ ذهبي (رسم Figma) */
@Composable fun StarNumber(text: String, current: Boolean = false) {
  val c = DS.c; val fill = if (current) c.accentGoldSoft else c.paperPage; val stroke = c.accentGold.copy(alpha = if (current) 1f else 0.9f); val lw = if (current) 1.6f else 1.2f
  Box(Modifier.size(38.dp), contentAlignment = Alignment.Center) {
    Canvas(Modifier.matchParentSize()) {
      val path = Path(); val cx = size.width / 2; val cy = size.height / 2; val R = minOf(cx, cy); val r = R * 0.78f
      for (i in 0 until 16) { val a = i * Math.PI / 8 - Math.PI / 2 + Math.PI / 16; val rr = if (i % 2 == 0) R else r; val x = (cx + rr * Math.cos(a)).toFloat(); val y = (cy + rr * Math.sin(a)).toFloat(); if (i == 0) path.moveTo(x, y) else path.lineTo(x, y) }
      path.close()
      drawPath(path, fill); drawPath(path, stroke, style = Stroke(width = lw.dp.toPx()))
    }
    Text(text, style = DSType.labelSm.copy(fontFamily = Fonts.kufi, fontWeight = FontWeight.SemiBold), color = c.accentGoldStrong)
  }
}
@Composable private fun PagePill(text: String) { val c = DS.c; Text(text, Modifier.clip(CircleShape).background(c.brandSoft.copy(alpha = 0.55f)).padding(horizontal = 10.dp, vertical = 5.dp), style = DSType.labelXs, color = c.brandPrimary) }
/** صفّ سورة: نجمة برقمها، الاسم بخطّ Amiri ونوعها وعدد آياتها، وحبّة الصفحة */
@Composable fun SurahRow(s: Surah, current: Boolean = false, onClick: () -> Unit) {
  val c = DS.c
  Row(Modifier.fillMaxWidth().clip(DS.shapeMd).clickable(onClick = onClick).padding(horizontal = 4.dp, vertical = 9.dp).semantics(mergeDescendants = true) { contentDescription = "سورة ${s.name}، ${s.type}، ${s.ayahs} آية، صفحة ${s.page}" }, verticalAlignment = Alignment.CenterVertically) {
    StarNumber(Fmt.number(s.n), current)
    Spacer(Modifier.width(12.dp))
    Column(Modifier.weight(1f)) { Text(s.name, style = DSType.readingMd, color = c.textPrimary, maxLines = 1); Text("${s.type} · ${Fmt.number(s.ayahs)} آية", style = DSType.labelXs, color = c.textTertiary) }
    if (current) { Icon(Icons.Filled.Bookmark, null, Modifier.size(14.dp), tint = c.accentGold); Spacer(Modifier.width(6.dp)) }
    PagePill("ص ${Fmt.number(s.page)}")
  }
}
/** صفّ جزء: رقمه في نجمة، اسمه، وأوّله من المتن (مصحف المدينة) */
@Composable fun JuzRow(j: JuzStart, onClick: () -> Unit) {
  val c = DS.c
  Row(Modifier.fillMaxWidth().clip(DS.shapeMd).clickable(onClick = onClick).padding(horizontal = 4.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
    StarNumber(Fmt.number(j.juz))
    Spacer(Modifier.width(12.dp))
    Column(Modifier.weight(1f)) {
      Text(QuranMeta.juzName(j.juz, false), style = DSType.headingSm, color = c.textPrimary)
      Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) { Text(QuranText.shared.juzStartPhrase(j.juz), style = DSType.quranInline.copy(fontSize = 13.sp, lineHeight = 20.sp), color = c.textSecondary); Text("· ${QuranMeta.surah(j.surah).name} ${Fmt.number(j.ayah)}", style = DSType.labelXs, color = c.textTertiary) }
    }
    PagePill("ص ${Fmt.number(j.page)}")
  }
}
/** صفّ حزب: بدايته، وأرباعه الأربعة ۞ كحبّات تنقل إلى موضع كل ربع */
@Composable fun HizbRow(h: Int, onGo: (Int) -> Unit) {
  val c = DS.c; val quarters = QuranText.shared.quarters(h); val first = quarters.firstOrNull()
  Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
    Row(Modifier.weight(1f).clip(DS.shapeMd).clickable { first?.let { onGo(it.page) } }, verticalAlignment = Alignment.CenterVertically) {
      StarNumber(Fmt.number(h)); Spacer(Modifier.width(12.dp))
      Column { Text("الحزب ${Fmt.number(h)}", style = DSType.headingSm, color = c.textPrimary); Text(first?.let { "الجزء ${Fmt.number(it.juz)} · ${QuranMeta.surah(it.surah).name} ${Fmt.number(it.ayah)} · ص ${Fmt.number(it.page)}" } ?: "", style = DSType.labelXs, color = c.textTertiary, maxLines = 1, overflow = TextOverflow.Ellipsis) }
    }
    Spacer(Modifier.width(4.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) { quarters.forEachIndexed { i, a -> Box(Modifier.minimumInteractiveComponentSize().size(26.dp).clip(CircleShape).background(c.accentGoldSoft.copy(alpha = 0.7f)).clickable(role = Role.Button) { onGo(a.page) }.semantics { contentDescription = "الربع ${i + 1} من الحزب $h، صفحة ${a.page}" }, contentAlignment = Alignment.Center) { Text(Fmt.number(i + 1), style = DSType.labelXs.copy(fontSize = 10.5.sp), color = c.accentGoldStrong) } } }
  }
}
/** التزامك بالورد: صفّ ثنائي لأربعة عشر يومًا — لا سلسلة تنكسر */
@Composable private fun CommitmentCard(onKhatmah: () -> Unit) {
  val c = DS.c; val plan = Store.khatmah
  val cm = Wird.commitment(Store.wird, Store.todayKey, plan?.dailyPages ?: 1, 14)
  DSCard(Modifier.fillMaxWidth(), padding = 16.dp) {
    DSSectionHead("التزامك بالورد", link = if (plan != null) "الختمة" else "ابدأ خطة", onLink = onKhatmah)
    Spacer(Modifier.height(6.dp))
    Text(if (plan != null) "${Fmt.number(cm.done)} من ${Fmt.number(cm.total)} يومًا في الأسبوعين الأخيرين" else "خطة ختمة تحوّل القراءة إلى وردٍ يومي بمقدار تختاره", style = DSType.labelSm, color = c.textSecondary)
    Spacer(Modifier.height(10.dp))
    Row(Modifier.fillMaxWidth().semantics { contentDescription = "التزامك بالورد: ${cm.done} من ${cm.total} يومًا" }, horizontalArrangement = Arrangement.spacedBy(4.dp)) { cm.days.forEach { on -> Box(Modifier.weight(1f).height(18.dp).clip(RoundedCornerShape(5.dp)).background(if (on) c.brandPrimary else c.bgSubtle)) } }
  }
}
/** الكلمة المستورة في مراجعة الحفظ: خطّ سفليّ صريح كي تُقرأ «مخفيّة» لا «ناقصة» (مطابقةً لنسخة الويب) */
private fun Modifier.hiddenWordRule(on: Boolean, color: Color) = if (!on) this else this.drawBehind {
  val h = maxOf(1f, size.height * 0.045f)
  drawLine(color, Offset(size.width * 0.08f, size.height - h / 2), Offset(size.width * 0.92f, size.height - h / 2), strokeWidth = h)
}

@OptIn(ExperimentalMaterial3Api::class)
/** القارئ: تقليب أفقي من اليمين، شريط علوي ينزلق، ورصيف سفلي واحد على سطح الورق (الحفظ / الآية المحدّدة / التلاوة) يُزيح الصفحة ولا يغطّيها */
@Composable fun MushafReader(startPage: Int, startAyah: Int?, autoplay: Boolean = false, hifz: Boolean = false, onClose: () -> Unit) {
  val ctx = LocalContext.current; val scope = rememberCoroutineScope(); val c = DS.c
  val shots = org.emdatra.sakinah.app.ScreenshotMode
  val pager = rememberPagerState(initialPage = startPage - 1) { 604 }
  var chrome by remember { mutableStateOf(true) }
  var selected by remember { mutableStateOf<Int?>(if (shots.readerSelectsAyah) QuranText.shared.pageAyahs(startPage).firstOrNull()?.n else null) }
  var flash by remember { mutableStateOf(startAyah) }
  var sheet by remember { mutableStateOf<String?>(shots.readerSheet) }; var ayahSheet by remember { mutableStateOf<Ayah?>(null) }
  var hifzSession by remember { mutableStateOf<HifzSession?>(null) }
  var downloads by remember { mutableStateOf(false) }
  val dark = isSystemInDarkTheme()
  val theme = Store.effectiveTheme(dark); val paper = hex(theme.paper); val ink = hex(theme.ink)
  val brand = if (theme.isDark) Color(0xFF2DD4BF) else Color(0xFF0F766E)
  val gold = if (theme.isDark) Color(0xFFB8993F) else Color(0xFFA98A3A)
  val page = pager.currentPage + 1
  val a11y = remember { (ctx.getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager)?.isTouchExplorationEnabled == true }
  fun startHifz(from: Int, veil: Boolean) {
    Recitation.stop()
    hifzSession = HifzSession(page, from, veil).also { s -> if (!veil && ContextCompat.checkSelfPermission(ctx, android.Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED) s.toggleSpeech(ctx) }
    selected = null
  }
  fun playFrom(n: Int, wholeSurah: Boolean) {
    val a = QuranText.shared.ayah(n) ?: return
    Recitation.reciter = Store.reciter; Recitation.repeatAyah = Store.repeatAyah; Recitation.useRepeatRange(Store.repeatRange); Recitation.words = Store.wordHighlight
    hifzSession?.stopSpeech(); hifzSession = null
    Recitation.play(ctx, if (wholeSurah) QuranText.shared.surahAyahs(a.surah).filter { it.n >= n }.map { it.n } else QuranText.shared.pageAyahs(a.page).map { it.n })
  }
  // الورد يُحتسب بتقدّم الموضع داخل الخطة بعد سكون قصير يستبعد التقليب السريع؛ وسجلّ القراءة للإحصاء على مهلته الأطول
  LaunchedEffect(page) {
    QuranText.shared.pageAyahs(page).firstOrNull()?.let { Store.remember(it) }
    hifzSession?.let { h -> if (h.page != page) { h.stopSpeech(); hifzSession = null } }
    selected?.let { s -> if (QuranText.shared.ayah(s)?.page != page) selected = null }
    kotlinx.coroutines.delay(3000); if (pager.currentPage + 1 != page) return@LaunchedEffect
    QuranText.shared.pageAyahs(page).firstOrNull()?.let { Store.pushRecent(it) }
    Store.khatmah?.let { plan -> Store.wird = Wird.mark(Store.wird, Store.todayKey, page, plan.startPage) }
    Store.save()
    kotlinx.coroutines.delay(5000); if (pager.currentPage + 1 == page) { Store.readLog = Khatmah.log(Store.readLog, Store.todayKey, page); Store.save() }
  }
  LaunchedEffect(startAyah) { if (startAyah != null) { kotlinx.coroutines.delay(1600); flash = null } }
  LaunchedEffect(Unit) {
    if (shots.readerHifz) { kotlinx.coroutines.delay(300); QuranText.shared.pageAyahs(startPage).firstOrNull()?.let { startHifz(it.n, veil = true) } }
    else if (autoplay || hifz) { kotlinx.coroutines.delay(600); val a = startAyah?.let { QuranText.shared.ayah(it) } ?: QuranText.shared.pageAyahs(startPage).firstOrNull() ?: return@LaunchedEffect; if (autoplay) playFrom(a.n, wholeSurah = true) else startHifz(a.n, veil = false) }
  }
  LaunchedEffect(Recitation.current) { val n = Recitation.current ?: return@LaunchedEffect; val a = QuranText.shared.ayah(n) ?: return@LaunchedEffect; if (Store.follow && hifzSession == null && a.page != pager.currentPage + 1) pager.scrollToPage(a.page - 1) }
  DisposableEffect(Unit) { onDispose { hifzSession?.stopSpeech() } }
  BackHandler { if (sheet != null) sheet = null else if (selected != null) selected = null else onClose() }
  val first = QuranText.shared.pageAyahs(page).firstOrNull()
  var chromeNonce by remember { mutableIntStateOf(0) }
  var lastPage by remember { mutableIntStateOf(startPage) }
  fun showChrome() { chrome = true; chromeNonce++ }
  LaunchedEffect(page) { if (page != lastPage) { lastPage = page; chrome = false } }
  var hint by remember { mutableStateOf(false) }
  // مع قارئ الشاشة لا شيء يختفي بمؤقّت
  LaunchedEffect(chrome, chromeNonce, sheet, ayahSheet, downloads, hifzSession) {
    if (chrome && hifzSession == null && sheet == null && ayahSheet == null && !downloads && !shots.keepChrome && !a11y) {
      kotlinx.coroutines.delay(3600); chrome = false
      if (!Store.seenChromeHint) { Store.seenChromeHint = true; Store.save(); hint = true; try { kotlinx.coroutines.delay(3500) } finally { hint = false } }
    }
  }
  val highlight = selected ?: flash

  Column(Modifier.fillMaxSize().background(paper).statusBarsPadding().navigationBarsPadding()) {
    Box(Modifier.weight(1f).fillMaxWidth()) {
      HorizontalPager(pager, Modifier.fillMaxSize(), beyondViewportPageCount = 1, key = { it }) { i ->
        val p = i + 1
        Box(Modifier.fillMaxSize().clickable(indication = null, interactionSource = remember { MutableInteractionSource() }) { val h = hifzSession; if (h != null) { if (h.veil) h.revealAyah() else h.hint() } else if (chrome) chrome = false else showChrome() }
          // سحبة رأسية على الصفحة (من أعلى أو أسفل) تُظهر الشريط؛ التقليب الأفقي يبقى للمقلّب
          .pointerInput(Unit) { detectVerticalDragGestures { _, dy -> if (kotlin.math.abs(dy) > 3f) showChrome() } }) {
          val onTap: (Ayah) -> Unit = { a -> selected = if (selected == a.n) null else a.n }
          val onLong: (Ayah) -> Unit = { a -> selected = a.n; chromeNonce++; ayahSheet = a }
          if (Store.view == "text") TextPage(p, ink, paper, highlight, hifzSession, onTap, onLong) else MushafPage(p, ink, paper, highlight, hifzSession, onTap, onLong)
        }
      }
      if (!chrome && hifzSession == null) {
        Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) { JuzHairline(page, ink); Spacer(Modifier.height(18.dp)) }
      }
      if (hint && hifzSession == null) Text("انقر كلمةً لتحديد آيتها، واضغط مطوّلًا لكل خياراتها", Modifier.align(Alignment.BottomCenter).padding(bottom = 34.dp).clip(CircleShape).background(c.bgInverse.copy(alpha = 0.9f)).padding(horizontal = 16.dp, vertical = 10.dp), style = DSType.labelMd, color = c.bgCanvas)
      androidx.compose.animation.AnimatedVisibility(chrome, Modifier.align(Alignment.TopCenter), enter = slideInVertically { -it } + fadeIn(), exit = slideOutVertically { -it } + fadeOut()) {
        UnifiedBar(
          page = page, ink = ink, paper = paper, dark = theme.isDark, hifzOn = hifzSession != null,
          marked = Store.bookmarks.any { it.page == page },
          onClose = onClose,
          onIndex = { chromeNonce++; sheet = "nav" },
          onPlay = { chromeNonce++; first?.let { playFrom(it.n, wholeSurah = false) } },
          onHifz = { chromeNonce++; val h = hifzSession; if (h != null) { h.stopSpeech(); hifzSession = null } else first?.let { startHifz(it.n, veil = false) } },
          onBookmark = { chromeNonce++; (selected?.let { QuranText.shared.ayah(it) } ?: Store.bookmarks.firstOrNull { it.page == page }?.let { QuranText.shared.ayah(it.surah, it.ayah) } ?: first)?.let { Store.toggleBookmark(it) } },
          onSearch = { chromeNonce++; sheet = "nav" },
          onDisplay = { chromeNonce++; sheet = "display" },
          onVeil = { chromeNonce++; first?.let { startHifz(it.n, veil = true) } },
          onDownloads = { chromeNonce++; downloads = true },
          onKhatmah = { chromeNonce++; sheet = "khatmah" },
          onOptions = { chromeNonce++; sheet = "options" },
          onMenuOpen = { chromeNonce++ },
          onGoToPage = { p -> chromeNonce++; lastPage = p; scope.launch { pager.scrollToPage(p - 1) } },
        )
      }
    }

    // الرصيف السفلي الواحد: الحفظ، وإلا الآية المحدّدة، وإلا التلاوة الجارية
    Column(Modifier.fillMaxWidth()) {
      val h = hifzSession; val sel = selected?.let { QuranText.shared.ayah(it) }
      if (h != null) HifzPanel(h, theme = theme, onExit = { h.stopSpeech(); hifzSession = null }, onNextPage = { if (page < 604) { val veil = h.veil; scope.launch { pager.scrollToPage(page); kotlinx.coroutines.delay(400); QuranText.shared.pageAyahs(page + 1).firstOrNull()?.let { a -> hifzSession = HifzSession(page + 1, a.n, veil).also { s -> if (!veil && ContextCompat.checkSelfPermission(ctx, android.Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED) s.toggleSpeech(ctx) } } } } })
      else if (sel != null) AyahDock(sel, ink = ink, paper = paper, brand = brand, gold = gold, marked = Store.isBookmarked(sel),
        onTafsir = { ayahSheet = sel }, onListen = { playFrom(sel.n, wholeSurah = true); selected = null }, onBookmark = { Store.toggleBookmark(sel) },
        onShare = { ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, "${sel.text} ﴿${sel.ayah}﴾\n[${QuranSearch.refLabel(sel)}]"), "مشاركة")) },
        onMore = { chromeNonce++; ayahSheet = sel }, onClose = { selected = null })
      else if (Recitation.current != null) AudioBar(theme = theme)
    }
  }
  ayahSheet?.let { a -> AyahSheet(a, onDismiss = { ayahSheet = null }, onHifz = { ayahSheet = null; startHifz(a.n, veil = false) }, onRepeat3 = { ayahSheet = null; Recitation.reciter = Store.reciter; Recitation.words = Store.wordHighlight; Recitation.repeatAyah = 3; Recitation.play(ctx, listOf(a.n)); selected = null }) }
  if (downloads) ModalBottomSheet(onDismissRequest = { downloads = false }, containerColor = c.bgSurface) { DownloadsSheet(first?.surah) }
  when (sheet) {
    "index", "nav" -> NavSheet(page, onDismiss = { sheet = null }) { p, n -> sheet = null; lastPage = p; scope.launch { pager.scrollToPage(p - 1) }; if (n != null) { flash = n; scope.launch { kotlinx.coroutines.delay(1600); if (flash == n) flash = null } } }
    "display" -> ModalBottomSheet(onDismissRequest = { sheet = null }, containerColor = c.bgSurface) { DisplaySheet() }
    "khatmah" -> KhatmahSheet(onDismiss = { sheet = null }, onGo = { p -> sheet = null; lastPage = p; scope.launch { pager.scrollToPage(p - 1) } })
    "options" -> ModalBottomSheet(onDismissRequest = { sheet = null }, containerColor = c.bgSurface) { Column { PlaybackOptions(); OptionsSheet(page) { sheet = null } } }
  }
}

/** رصيف الآية المحدّدة: صفّ واحد على سطح الورق — تفسير · استماع · علامة · مشاركة · المزيد، و✕ */
@Composable private fun AyahDock(a: Ayah, ink: Color, paper: Color, brand: Color, gold: Color, marked: Boolean, onTafsir: () -> Unit, onListen: () -> Unit, onBookmark: () -> Unit, onShare: () -> Unit, onMore: () -> Unit, onClose: () -> Unit) {
  Column(Modifier.fillMaxWidth().background(paper)) {
    Box(Modifier.fillMaxWidth().height(1.dp).background(gold.copy(alpha = 0.55f)))
    Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
      Column(Modifier.width(74.dp).padding(start = 8.dp)) { Text(QuranMeta.surah(a.surah).name, style = DSType.labelSm, color = ink, maxLines = 1); Text("الآية ${Fmt.number(a.ayah)}", style = DSType.labelXs, color = ink.copy(alpha = 0.62f), maxLines = 1) }
      DockButton(Icons.Outlined.MenuBook, "تفسير", brand, Modifier.weight(1f), onTafsir)
      DockButton(Icons.Outlined.Headphones, "استماع", brand, Modifier.weight(1f), onListen)
      DockButton(if (marked) Icons.Filled.Bookmark else Icons.Outlined.BookmarkBorder, if (marked) "معلَّمة" else "علامة", if (marked) gold else brand, Modifier.weight(1f), onBookmark)
      DockButton(Icons.Outlined.Share, "مشاركة", brand, Modifier.weight(1f), onShare)
      DockButton(Icons.Outlined.MoreHoriz, "المزيد", brand, Modifier.weight(1f), onMore)
      Box(Modifier.size(40.dp, 46.dp).clickable(role = Role.Button, onClick = onClose).semantics { contentDescription = "إلغاء تحديد الآية" }, contentAlignment = Alignment.Center) { Icon(Icons.Filled.Close, null, Modifier.size(14.dp), tint = ink.copy(alpha = 0.7f)) }
    }
  }
}
@Composable fun DockButton(icon: ImageVector, label: String, tint: Color, modifier: Modifier = Modifier, onClick: () -> Unit) {
  Column(modifier.height(46.dp).clip(DS.shapeSm).clickable(role = Role.Button, onClick = onClick), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
    Icon(icon, label, Modifier.size(17.dp), tint = tint); Spacer(Modifier.height(3.dp)); Text(label, style = DSType.labelXs.copy(fontSize = 10.sp), color = tint, maxLines = 1)
  }
}
/** خيط ذهبي رفيع: موضع الصفحة داخل جزئها — الأثر الوحيد الباقي في الوضع الغامر */
@Composable private fun JuzHairline(page: Int, ink: Color) {
  val juz = QuranMeta.juzOfPage(page)
  val starts = QuranMeta.juzStarts
  val from = starts.firstOrNull { it.juz == juz }?.page ?: 1
  val to = starts.firstOrNull { it.juz == juz + 1 }?.page ?: 605
  val p = if (to > from) ((page - from + 1).toFloat() / (to - from)).coerceIn(0f, 1f) else 0f
  Box(Modifier.width(132.dp).height(3.dp).clip(CircleShape).background(ink.copy(alpha = 0.12f)), contentAlignment = AbsoluteAlignment.CenterRight) {
    Box(Modifier.fillMaxWidth(p.coerceAtLeast(0.03f)).height(3.dp).clip(CircleShape).background(DS.c.accentGold.copy(alpha = 0.8f)))
  }
}
/**
 * الشريط الموحّد لقارئ المصحف: زرّ الإغلاق يمينًا، ثم هويّة الموضع (وهي نفسها زرّ الفهرس)،
 * ثم كبسولة الإجراءات يسارًا، وحافّته السفلى خطٌّ ذهبي هو نفسه منزلق الصفحات الـ٦٠٤.
 * الارتفاع ٥٥ نقطة: ٤٦ للصفّ و٩ للشريحة التي تحمل الخطّ وتستقبل السحب.
 */
@Composable private fun UnifiedBar(
  page: Int, ink: Color, paper: Color, dark: Boolean, hifzOn: Boolean, marked: Boolean,
  onClose: () -> Unit, onIndex: () -> Unit, onPlay: () -> Unit, onHifz: () -> Unit,
  onBookmark: () -> Unit, onSearch: () -> Unit, onDisplay: () -> Unit, onVeil: () -> Unit,
  onDownloads: () -> Unit, onKhatmah: () -> Unit, onOptions: () -> Unit, onMenuOpen: () -> Unit, onGoToPage: (Int) -> Unit,
) {
  val brand = if (dark) Color(0xFF2DD4BF) else Color(0xFF0F766E)
  val onBrand = if (dark) Color(0xFF0C1514) else Color(0xFFF6F1E2)
  val gold = if (dark) Color(0xFFB8993F) else Color(0xFFA98A3A)
  val goldTrack = if (dark) Color(0xFF4A3F22) else Color(0xFFE9DCB2)
  val l = QuranText.shared.label(page)
  var scrub by remember { mutableStateOf<Int?>(null) }

  Column(Modifier.fillMaxWidth().background(paper)) {
    Row(Modifier.fillMaxWidth().height(46.dp).padding(horizontal = 10.dp), verticalAlignment = Alignment.CenterVertically) {
      BarButton(Icons.Filled.ChevronRight, "إغلاق المصحف", ink, onClose)
      Spacer(Modifier.width(8.dp))
      // هويّة الموضع: الكتلة كلّها تفتح الفهرس، والسهم يدلّ على ذلك
      Column(
        Modifier.weight(1f).clip(RoundedCornerShape(8.dp))
          .clickable(role = Role.Button, onClick = onIndex).padding(vertical = 2.dp)
      ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          if (marked) {
            Icon(Icons.Filled.Bookmark, null, Modifier.size(12.dp), tint = gold)
            Spacer(Modifier.width(5.dp))
          }
          Text(l?.let { "سورة ${QuranMeta.surah(it.surah).name}" } ?: "", style = DSType.headingSm, color = ink, maxLines = 1)
          Spacer(Modifier.width(5.dp))
          Icon(Icons.Filled.KeyboardArrowDown, null, Modifier.size(12.dp), tint = ink.copy(alpha = 0.45f))
        }
        // سطر التفاصيل: سطرٌ واحد لا يُقصّ ولا يلتفّ — يصغر عند الضرورة وحدها
        AutoShrinkText(
          l?.let { "صفحة ${Fmt.number(page)} · الجزء ${Fmt.number(it.juz)} · الحزب ${Fmt.number(it.hizb)} · ${QuranMeta.surah(it.surah).type}" } ?: "",
          DSType.labelXs, ink.copy(alpha = 0.6f),
        )
      }
      Spacer(Modifier.width(8.dp))
      ActionCapsule(
        ink = ink, brand = brand, onBrand = onBrand, hifzOn = hifzOn, marked = marked,
        onPlay = onPlay, onHifz = onHifz, onIndex = onIndex, onBookmark = onBookmark,
        onSearch = onSearch, onDisplay = onDisplay, onVeil = onVeil,
        onDownloads = onDownloads, onKhatmah = onKhatmah, onOptions = onOptions, onMenuOpen = onMenuOpen,
      )
    }
    PageProgress(page = scrub ?: page, gold = gold, track = goldTrack,
      onScrub = { scrub = it }, onCommit = { scrub = null; onGoToPage(it) })
  }
}

/** كبسولة الإجراءات: تشغيل (ممتلئ) ثم الحفظ ثم الفهرس ثم المزيد — بترتيب القراءة من اليمين */
@Composable private fun ActionCapsule(
  ink: Color, brand: Color, onBrand: Color, hifzOn: Boolean, marked: Boolean,
  onPlay: () -> Unit, onHifz: () -> Unit, onIndex: () -> Unit, onBookmark: () -> Unit,
  onSearch: () -> Unit, onDisplay: () -> Unit, onVeil: () -> Unit,
  onDownloads: () -> Unit, onKhatmah: () -> Unit, onOptions: () -> Unit, onMenuOpen: () -> Unit,
) {
  var menu by remember { mutableStateOf(false) }
  Row(
    Modifier.height(40.dp).clip(CircleShape).background(ink.copy(alpha = 0.05f))
      .border(1.dp, ink.copy(alpha = 0.12f), CircleShape).padding(4.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    CapsuleButton(Icons.Filled.PlayArrow, "تشغيل تلاوة الصفحة", if (hifzOn) ink else onBrand, if (hifzOn) null else brand, onPlay)
    CapsuleButton(Icons.Outlined.Mic, "مراجعة الحفظ", if (hifzOn) onBrand else ink, if (hifzOn) brand else null, onHifz)
    CapsuleButton(Icons.Outlined.List, "الفهرس", ink, null, onIndex)
    Box {
      CapsuleButton(Icons.Filled.MoreVert, "خيارات المصحف", ink, null) { onMenuOpen(); menu = true }
      DropdownMenu(menu, onDismissRequest = { menu = false }) {
        DropdownMenuItem(
          text = { Text(if (marked) "إزالة علامة الصفحة" else "علامة على هذه الصفحة", style = DSType.labelMd) },
          leadingIcon = { Icon(if (marked) Icons.Filled.Bookmark else Icons.Outlined.BookmarkBorder, null) },
          onClick = { menu = false; onBookmark() })
        DropdownMenuItem(text = { Text("بحث وتنقّل", style = DSType.labelMd) },
          leadingIcon = { Icon(Icons.Outlined.Search, null) }, onClick = { menu = false; onSearch() })
        DropdownMenuItem(text = { Text("العرض والخطّ والسمة", style = DSType.labelMd) },
          leadingIcon = { Icon(Icons.Outlined.FormatSize, null) }, onClick = { menu = false; onDisplay() })
        DropdownMenuItem(text = { Text("إخفاء الآيات للحفظ", style = DSType.labelMd) },
          leadingIcon = { Icon(Icons.Outlined.VisibilityOff, null) }, onClick = { menu = false; onVeil() })
        DropdownMenuItem(text = { Text("التلاوات دون اتّصال", style = DSType.labelMd) },
          leadingIcon = { Icon(Icons.Outlined.Download, null) }, onClick = { menu = false; onDownloads() })
        DropdownMenuItem(text = { Text("الختمة والورد", style = DSType.labelMd) },
          leadingIcon = { Icon(Icons.Outlined.MenuBook, null) }, onClick = { menu = false; onKhatmah() })
        HorizontalDivider()
        DropdownMenuItem(text = { Text("خيارات المصحف", style = DSType.labelMd) },
          leadingIcon = { Icon(Icons.Outlined.Settings, null) }, onClick = { menu = false; onOptions() })
      }
    }
  }
}

/**
 * سطرٌ واحد يصغر حتى يتّسع، لا يُقصّ ولا يلتفّ.
 * (إصدار Compose هنا أقدم من `autoSize` في BasicText، فالتصغير بقياس الفيض خطوةً خطوة.)
 */
@Composable private fun AutoShrinkText(text: String, style: TextStyle, color: Color, minScale: Float = 0.92f) {
  var scale by remember(text) { mutableFloatStateOf(1f) }
  Text(
    text, style = style.copy(fontSize = style.fontSize * scale), color = color,
    maxLines = 1, softWrap = false, overflow = TextOverflow.Clip,
    onTextLayout = { r -> if (r.hasVisualOverflow && scale > minScale) scale = (scale - 0.02f).coerceAtLeast(minScale) },
  )
}

@Composable private fun CapsuleButton(icon: ImageVector, label: String, tint: Color, fill: Color?, onClick: () -> Unit) {
  Box(
    Modifier.minimumInteractiveComponentSize().size(32.dp).clip(CircleShape).then(if (fill != null) Modifier.background(fill) else Modifier)
      .clickable(role = Role.Button, onClick = onClick),
    contentAlignment = Alignment.Center,
  ) { Icon(icon, label, Modifier.size(18.dp), tint = tint) }
}

/**
 * خطّ موضع الصفحة: يملأ من اليمين، وهو نفسه المنزلق بين ٦٠٤ صفحات.
 * يُرسم ويُقاس في فضاء من اليسار إلى اليمين صراحةً كي لا يلتبس اتّجاه اللمسة باتّجاه الكتابة.
 */
@Composable private fun PageProgress(page: Int, gold: Color, track: Color, onScrub: (Int) -> Unit, onCommit: (Int) -> Unit) {
  var width by remember { mutableFloatStateOf(0f) }
  // الصفحة الجارية تحت الإصبع تُحفظ في حالة، لا في وسيط: كتلة اللمس تُنشأ مرّة واحدة
  // (مفتاحها Unit) فلو قرأت الوسيط لبقيت على قيمته الأولى وعادت الصفحة إلى ما كانت.
  var dragPage by remember { mutableIntStateOf(page) }
  fun pageAt(x: Float): Int {
    if (width <= 0f) return dragPage
    val frac = 1f - (x / width).coerceIn(0f, 1f)
    return (frac * 604f).roundToInt().coerceIn(1, 604)
  }
  CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
    Box(
      Modifier.fillMaxWidth().height(9.dp)
        .semantics { contentDescription = "الانتقال بين الصفحات: صفحة ${Fmt.number(page)} من ${Fmt.number(604)}" }
        .onSizeChanged { width = it.width.toFloat() }
        .pointerInput(Unit) {
          detectHorizontalDragGestures(
            onDragStart = { o -> dragPage = pageAt(o.x); onScrub(dragPage) },
            onDragEnd = { onCommit(dragPage) },
            onDragCancel = { onCommit(dragPage) },
          ) { change, _ -> dragPage = pageAt(change.position.x); onScrub(dragPage) }
        }
        .drawBehind {
          val h = 3.dp.toPx()
          val y = size.height - h
          drawRect(track, topLeft = Offset(0f, y), size = androidx.compose.ui.geometry.Size(size.width, h))
          val filled = (size.width * page / 604f).coerceAtLeast(h)
          drawRect(gold, topLeft = Offset(size.width - filled, y), size = androidx.compose.ui.geometry.Size(filled, h))
        }
    )
  }
}

@Composable private fun BarButton(icon: ImageVector, label: String, tint: Color, onClick: () -> Unit) {
  Icon(icon, label, Modifier.minimumInteractiveComponentSize().size(34.dp).clip(CircleShape).clickable(role = Role.Button, onClick = onClick).padding(8.dp), tint = tint)
}
/** خيارات التلاوة والمراجعة (تظهر فوق خيارات المصحف) */
@Composable fun PlaybackOptions() {
  Column(Modifier.padding(horizontal = 16.dp)) {
    RowSwitch("متابعة التلاوة بقلب الصفحات", Store.follow) { Store.follow = it; Store.save() }
    RowSwitch("تظليل الكلمة أثناء التلاوة (قرّاء quran.com)", Store.wordHighlight) { Store.wordHighlight = it; Store.save(); Recitation.useWordTiming(it) }
    RowSwitch("تكرار المقطع", Store.repeatRange) { Store.repeatRange = it; Store.save(); Recitation.useRepeatRange(it) }
    RowSwitch("في المراجعة: إظهار الكلمة الحالية فقط", Store.hifzOnlyCurrent) { Store.hifzOnlyCurrent = it; Store.save() }
  }
}

/** صفحة بخط صفحتها: 15 سطرًا، كل كلمة عنصر (نقر)، حجم الخط من العرض ÷ 14.85 مع تصحيح بالقياس */
@Composable fun MushafPage(p: Int, ink: Color, paper: Color, selected: Int?, hifz: HifzSession?, onTap: (Ayah) -> Unit, onLongPress: (Ayah) -> Unit = {}) {
  val family = Fonts.page(p); val lines = MushafLayout.shared.lines(p); val measurer = rememberTextMeasurer(); val density = LocalDensity.current
  val label = QuranText.shared.label(p)
  BoxWithConstraints(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(horizontal = 12.dp, vertical = 8.dp)) {
    val wPx = with(density) { maxWidth.toPx() }; val hPx = with(density) { (maxHeight - 60.dp).toPx() }
    val sizePx = remember(p, wPx, hPx, family) {
      var s = wPx / 14.85f
      val rowH = hPx / 15f; if (rowH < s * 1.12f) s = rowH / 1.12f
      // أسطر QCF تملأ العرض بالضبط، ونرسم كل كلمة عنصرًا مستقلًّا: تقريبٌ جزئيّ في كلمة يُفيض
      // السطر فيُقتطع من طرفه، وفقدُ كلمة من صفحة مصحف لا يُحتمل — فنترك شعرة.
      if (family != null) { val maxW = lines.maxOf { l -> val ws = l.wordList; if (ws.isEmpty()) 0f else measurer.measure(AnnotatedString(ws.joinToString("") { it.glyph }), TextStyle(fontFamily = family, fontSize = with(density) { s.toSp() }), softWrap = false, maxLines = 1).size.width.toFloat() }; val safeW = wPx * 0.988f; if (maxW > safeW) s *= safeW / maxW }
      s
    }
    val fontSize = with(density) { sizePx.toSp() }; val bodyH = minOf(hPx, 15 * sizePx * 2f)
    Column(Modifier.fillMaxSize()) {
      if (label != null) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { val s = "سُورَةُ ${QuranMeta.surah(label.surah).vocalized}"; val j = QuranMeta.juzName(label.juz); Text(if (p % 2 == 1) s else j, fontFamily = Fonts.amiri, color = ink.copy(alpha = 0.85f), fontSize = fontSize * 0.66, maxLines = 1); Text(if (p % 2 == 1) j else s, fontFamily = Fonts.amiri, color = ink.copy(alpha = 0.85f), fontSize = fontSize * 0.66, maxLines = 1) }
      Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
        Column(Modifier.height(with(density) { bodyH.toDp() }).fillMaxWidth()) {
          val short = lines.size < 15
          for (i in 0 until 15) {
            val idx = if (short) i - 3 else i
            Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
              if (idx in lines.indices) when (val l = lines[idx]) {
                is MushafLine.Header -> SurahHeaderBox(l.surah, fontSize, ink, paper)
                is MushafLine.Basmala -> Text(QuranMeta.basmala, fontFamily = Fonts.amiri, fontSize = fontSize * 0.95, color = ink, maxLines = 1)
                is MushafLine.Words -> Row(verticalAlignment = Alignment.CenterVertically) {
                  for (w in l.words) {
                    val a = QuranText.shared.ayah(w.n)
                    val hidden = hifz != null && w.k >= 0 && hifz.isHidden(w.n, w.k, Store.hifzOnlyCurrent)
                    val cur = hifz != null && w.k >= 0 && hifz.isCurrent(w.n, w.k)
                    val playingWord = Recitation.current == w.n && Store.wordHighlight && Recitation.currentWord == w.k + 1
                    val col = if (hidden) Color.Transparent else if (w.end) Gold else ink
                    val bg = if (hidden) ink.copy(alpha = 0.13f) else if (playingWord) Gold.copy(alpha = 0.38f) else if (selected == w.n) Gold.copy(alpha = 0.15f) else if (Recitation.current == w.n) Teal.copy(alpha = 0.16f) else Color.Transparent
                    Text(w.glyph, fontFamily = family, fontSize = fontSize, color = col, maxLines = 1, softWrap = false,
                      modifier = Modifier.background(bg, RoundedCornerShape(3.dp)).hiddenWordRule(hidden, ink.copy(alpha = 0.35f)).then(if (cur) Modifier.border(1.dp, ink.copy(alpha = 0.3f), RoundedCornerShape(3.dp)) else Modifier).then(if (a != null && hifz == null) Modifier.pointerInput(a) { detectTapGestures(onTap = { onTap(a) }, onLongPress = { onLongPress(a) }) } else Modifier))
                  }
                }
              }
            }
          }
        }
      }
      Text(QuranMeta.arabicDigits(p), Modifier.align(Alignment.CenterHorizontally), fontFamily = Fonts.amiri, color = ink.copy(alpha = 0.85f), fontSize = fontSize * 0.8)
    }
  }
}
@Composable fun SurahHeaderBox(surah: Int, fontSize: TextUnit, ink: Color, paper: Color) {
  Box(Modifier.fillMaxWidth(0.98f).fillMaxHeight(0.88f).border(1.dp, Gold, RoundedCornerShape(4.dp)).padding(2.dp).border(1.dp, Gold.copy(alpha = 0.6f), RoundedCornerShape(3.dp)), contentAlignment = Alignment.Center) {
    val f = Fonts.surahNames
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) { if (f != null) Text("%03d surah".format(java.util.Locale.US, surah), fontFamily = f, fontSize = fontSize * 0.86, color = ink, maxLines = 1) else Text("سورة ${QuranMeta.surah(surah).name}", fontFamily = Fonts.amiri, fontSize = fontSize * 0.9, color = ink) }
  }
}

/** وضع النص المتدفق: أميري قرآن أو حفص، التجويد الملوّن، حجم قابل للتغيير */
@OptIn(ExperimentalLayoutApi::class)
@Composable fun TextPage(p: Int, ink: Color, paper: Color, selected: Int?, hifz: HifzSession?, onTap: (Ayah) -> Unit, onLongPress: (Ayah) -> Unit = {}) {
  val hafs = Store.textFont == "hafs"; val family = Fonts.text(Store.textFont); val dark = isSystemInDarkTheme()
  val ayahs = QuranText.shared.pageAyahs(p); val label = QuranText.shared.label(p)
  BoxWithConstraints(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(horizontal = 14.dp, vertical = 8.dp)) {
    val base = with(LocalDensity.current) { (maxWidth.toPx() / 14.85f).toSp() }; val size = base * 1.02 * Store.fontScale
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
      if (label != null) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("سُورَةُ ${QuranMeta.surah(label.surah).vocalized}", fontFamily = Fonts.amiri, color = ink.copy(alpha = 0.85f), fontSize = base * 0.66); Text(QuranMeta.juzName(label.juz), fontFamily = Fonts.amiri, color = ink.copy(alpha = 0.85f), fontSize = base * 0.66) }
      FlowRow(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        for (a in ayahs) {
          if (a.ayah == 1) { Box(Modifier.fillMaxWidth().height(40.dp).padding(vertical = 4.dp)) { SurahHeaderBox(a.surah, base, ink, paper) }; if (a.surah != 1 && a.surah != 9) Text(QuranMeta.basmala, Modifier.fillMaxWidth(), fontFamily = Fonts.amiri, fontSize = base * 0.95, color = ink, textAlign = androidx.compose.ui.text.style.TextAlign.Center) }
          val text = if (hafs) hafsText(a.text) else a.text
          val spans = if (Store.tajweed) Tajweed.shared.spans(a.n) else emptyList()
          val cps = text.codePoints().toArray(); var pos = 0; var k = 0
          for (t in QuranNormalize.tokenize(text)) {
            val start = findCp(t.raw, cps, pos); pos = start + t.raw.codePointCount(0, t.raw.length)
            val kk = if (t.spoken) k else -1; if (t.spoken) k++
            val hidden = hifz != null && kk >= 0 && hifz.isHidden(a.n, kk, Store.hifzOnlyCurrent)
            val cur = hifz != null && kk >= 0 && hifz.isCurrent(a.n, kk)
            val playingWord = Recitation.current == a.n && Store.wordHighlight && kk >= 0 && Recitation.currentWord == kk + 1
            val styled = buildAnnotatedString { if (spans.isEmpty() || !t.spoken) append(t.raw) else for ((seg, code) in Tajweed.segments(t.raw, start, spans)) { val c = code?.let { tajweedColor(it, dark) }; if (c != null) withStyle(SpanStyle(color = c)) { append(seg) } else append(seg) } }
            val bg = if (hidden) ink.copy(alpha = 0.13f) else if (playingWord) Gold.copy(alpha = 0.38f) else if (selected == a.n) Gold.copy(alpha = 0.15f) else if (Recitation.current == a.n) Teal.copy(alpha = 0.16f) else Color.Transparent
            Text(styled, fontFamily = family, fontSize = if (t.spoken) size else size * 0.75, lineHeight = size * 2.05, color = if (hidden) Color.Transparent else if (t.spoken) ink else Gold,
              modifier = Modifier.background(bg, RoundedCornerShape(3.dp)).hiddenWordRule(hidden, ink.copy(alpha = 0.35f)).then(if (cur) Modifier.border(1.dp, ink.copy(alpha = 0.3f), RoundedCornerShape(3.dp)) else Modifier).then(if (hifz == null) Modifier.pointerInput(a) { detectTapGestures(onTap = { onTap(a) }, onLongPress = { onLongPress(a) }) } else Modifier))
          }
          Text(if (hafs) QuranMeta.arabicDigits(a.ayah) else "۝" + QuranMeta.arabicDigits(a.ayah), fontFamily = family, fontSize = size * 0.95, lineHeight = size * 2.05, color = Gold)
        }
      }
      Text(QuranMeta.arabicDigits(p), Modifier.align(Alignment.CenterHorizontally).padding(top = 8.dp), fontFamily = Fonts.amiri, color = ink.copy(alpha = 0.85f), fontSize = base * 0.8)
    }
  }
}
fun hafsText(t: String): String { val sb = StringBuilder(); for (cp in t.codePoints().toArray()) sb.appendCodePoint(when (cp) { 0x06DF -> 0x0652; 0x06EB -> 0x06E0; 0x06E3 -> 0x06DC; else -> cp }); return sb.toString() }
fun findCp(word: String, cps: IntArray, from: Int): Int { val w = word.codePoints().toArray(); if (w.isEmpty() || cps.size < w.size) return from; var i = maxOf(0, from); while (i + w.size <= cps.size) { var ok = true; for (j in w.indices) if (cps[i + j] != w[j]) { ok = false; break }; if (ok) return i; i++ }; return from }
fun tajweedColor(code: String, dark: Boolean): Color? { val g = Tajweed.group(code); val t = Catalog.shared.tajweed; return (if (dark) t.dark[g] else t.light[g])?.let { hex(it) } }


/** ورقة الآية (ضغطة مطوّلة أو «المزيد»): نصّ الآية كاملًا من المتن، بلاطات، وشريحة «نسخ» — ما في الرصيف لا يتكرّر إلا التفسير */
@OptIn(ExperimentalMaterial3Api::class)
@Composable fun AyahSheet(a: Ayah, onDismiss: () -> Unit, onHifz: () -> Unit = {}, onRepeat3: () -> Unit = {}) {
  val ctx = LocalContext.current; val c = DS.c
  var tafsir by remember { mutableStateOf(false) }
  val l = QuranText.shared.label(a.page)
  val txt = "${a.text} ﴿${a.ayah}﴾\n[${QuranSearch.refLabel(a)}]"
  val marked = Store.isBookmarked(a); val weak = a.n in Store.weakAyahs
  @Composable fun RowScope.act(icon: ImageVector, title: String, sub: String, gold: Boolean = false, onClick: () -> Unit) {
    Row(Modifier.weight(1f).heightIn(min = 60.dp).clip(DS.shapeLg).background(c.bgSubtle).clickable(onClick = onClick).padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
      DSIconButton(icon, style = if (gold) IconStyle.GoldSoft else IconStyle.Soft, size = 40.dp, iconSize = 17.dp); Spacer(Modifier.width(10.dp))
      Column { Text(title, style = DSType.labelMd, color = c.textPrimary, maxLines = 1); if (sub.isNotEmpty()) Text(sub, style = DSType.labelXs, color = c.textSecondary, maxLines = 1) }
    }
  }
  ModalBottomSheet(onDismissRequest = onDismiss, containerColor = c.bgSurface) {
    Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 24.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      Row(verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) { Text(QuranSearch.refLabel(a), style = DSType.headingMd, color = c.textPrimary); Text("الصفحة ${Fmt.number(a.page)}${l?.let { " · الجزء ${Fmt.number(it.juz)}" } ?: ""}${if (marked) " · معلَّمة" else ""}${if (weak) " · آية ضعيفة" else ""}", style = DSType.labelXs, color = c.textSecondary) }
        Row(Modifier.clip(CircleShape).background(c.brandSoft).clickable { (ctx.getSystemService(android.content.ClipboardManager::class.java)).setPrimaryClip(android.content.ClipData.newPlainText("آية", txt)); onDismiss() }.padding(horizontal = 12.dp, vertical = 8.dp).semantics { contentDescription = "نسخ نصّ الآية مع المرجع" }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) { Icon(Icons.Outlined.ContentCopy, null, Modifier.size(13.dp), tint = c.brandPrimary); Text("نسخ", style = DSType.labelSm, color = c.brandPrimary) }
      }
      Text("${a.text} ﴿${Fmt.number(a.ayah)}﴾", Modifier.fillMaxWidth().clip(DS.shapeLg).background(c.paperPage).border(1.dp, c.borderSubtle, DS.shapeLg).padding(horizontal = 16.dp, vertical = 12.dp), style = DSType.quranInline.copy(fontSize = 20.sp, lineHeight = 40.sp), color = c.paperInk, textAlign = TextAlign.Center)
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { act(Icons.Outlined.MenuBook, "التفسير الميسّر", if (tafsir) "إخفاء" else "مضمّن") { tafsir = !tafsir }; act(Icons.Outlined.Repeat, "تكرار الآية ×٣", "للحفظ", onClick = onRepeat3) }
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { act(Icons.Outlined.Mic, "مراجعة الحفظ", "من هنا", gold = true, onClick = onHifz); act(Icons.Outlined.Image, "مشاركة صورةً", "٤ سمات") { ShareCard.share(ctx, ShareCard.render(ctx, "القرآن الكريم · ${QuranSearch.refLabel(a)}", "${a.text} ﴿${a.ayah}﴾", QuranSearch.refLabel(a), true), "ayah-${a.surah}-${a.ayah}.png", txt) } }
      if (tafsir) { val html = Tafsir.text(a.surah, a.ayah); Text(buildAnnotatedString { for (r in Tafsir.runs(html ?: "لا تفسير")) if (r.bold) withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = c.brandPrimary)) { append(r.text) } else append(r.text) }, style = DSType.readingMd, color = c.textPrimary); Text("التفسير الميسّر — مجمع الملك فهد", style = DSType.labelXs, color = c.textSecondary) }
      Text("موضع القراءة يُحفظ تلقائيًا مع التقليب · الاستماع والعلامة والمشاركة من رصيف الآية", Modifier.fillMaxWidth(), style = DSType.labelXs, color = c.textTertiary, textAlign = TextAlign.Center)
    }
  }
}
/** رصيف التلاوة الجارية: تقدّم صادق، تشغيل، القارئ والكلمة الجارية، سابق/تالي/✕؛ داخل القارئ يأخذ سمة الورق وعرض الشاشة، وخارجه بطاقة عائمة */
@Composable fun AudioBar(theme: MushafTheme? = null) {
  val ctx = LocalContext.current; val c = DS.c
  var expanded by remember { mutableStateOf(false) }
  val a = Recitation.currentAyah ?: return
  val ink = theme?.let { hex(it.ink) } ?: c.textPrimary
  val brand = theme?.let { if (it.isDark) Color(0xFF2DD4BF) else Color(0xFF0F766E) } ?: c.brandPrimary
  val onBrand = theme?.let { if (it.isDark) Color(0xFF0C1514) else Color(0xFFF6F1E2) } ?: c.textOnBrand
  val gold = theme?.let { if (it.isDark) Color(0xFFB8993F) else Color(0xFFA98A3A) } ?: c.brandPrimary
  val track = theme?.let { if (it.isDark) Color(0xFF4A3F22) else Color(0xFFE9DCB2) } ?: c.borderSubtle
  val container = if (theme != null) Modifier.fillMaxWidth().background(hex(theme.paper)) else Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp).shadow(if (c.isDark) 0.dp else 14.dp, DS.shapeXl, ambientColor = c.shadow.copy(alpha = 0.16f), spotColor = c.shadow.copy(alpha = 0.2f)).clip(DS.shapeXl).background(c.bgSurface)
  Column(container) {
    ProgressTrack(if (Recitation.duration > 0) (Recitation.position / Recitation.duration).toFloat() else 0f, tint = gold, track = track, height = 3.dp)
    Row(Modifier.padding(horizontal = 10.dp, vertical = if (theme != null) 7.dp else 10.dp), verticalAlignment = Alignment.CenterVertically) {
      Box(Modifier.size(44.dp).clip(CircleShape).background(brand).clickable(role = Role.Button) { Recitation.toggle() }.semantics { contentDescription = if (Recitation.isPlaying) "إيقاف مؤقت" else "تشغيل" }, contentAlignment = Alignment.Center) { Icon(if (Recitation.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow, null, Modifier.size(20.dp), tint = onBrand) }
      Spacer(Modifier.width(8.dp))
      Column(Modifier.weight(1f).clickable(onClickLabel = "فتح المشغّل") { expanded = true }) {
        Text(Catalog.shared.reciter(Recitation.reciter).name, style = DSType.labelMd, color = ink, maxLines = 1)
        Row(verticalAlignment = Alignment.CenterVertically) {
          Text("${Recitation.label()} · ${Fmt.number(Recitation.index + 1)}/${Fmt.number(Recitation.queue.size)}${if (Recitation.loading) " · جارٍ التحميل…" else ""}", style = DSType.labelXs, color = ink.copy(alpha = 0.65f), maxLines = 1)
          val w = Recitation.currentWord; val words = a.text.split(" ")
          if (w != null && Recitation.hasWords && w in 1..words.size) { Spacer(Modifier.width(6.dp)); Text(words[w - 1], Modifier.clip(RoundedCornerShape(6.dp)).background(brand).padding(horizontal = 6.dp, vertical = 1.dp), style = DSType.quranInline.copy(fontSize = 13.sp, lineHeight = 18.sp), color = onBrand) }
        }
      }
      BarIcon(Icons.Filled.SkipPrevious, "الآية السابقة", ink) { Recitation.prev(ctx) }
      BarIcon(Icons.Filled.SkipNext, "الآية التالية", ink) { Recitation.next(ctx) }
      BarIcon(Icons.Filled.Close, "إيقاف التلاوة", ink.copy(alpha = 0.7f)) { Recitation.stop() }
    }
    Recitation.error?.let { Text(if (it == "network") "تعذّر تحميل التلاوة — تحقق من الاتصال" else "هذه التلاوة غير متاحة من هذا القارئ", Modifier.padding(horizontal = 14.dp, vertical = 4.dp), style = DSType.labelXs, color = c.danger) }
  }
  if (expanded) PlayerSheet { expanded = false }
}
@Composable private fun BarIcon(icon: ImageVector, label: String, tint: Color, onClick: () -> Unit) {
  Box(Modifier.size(38.dp).clip(CircleShape).clickable(role = Role.Button, onClick = onClick), contentAlignment = Alignment.Center) { Icon(icon, label, Modifier.size(18.dp), tint = tint) }
}
/** المشغّل الكامل: ميدالية أصغر، الآية (كلمةً بكلمة فقط حين تتوفّر التوقيتات)، شريط تقدّم صادق يُسحب، تحكّم، شرائح (أ–ب، السرعة، النوم، القارئ، تنزيل السورة) */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable fun PlayerSheet(onDismiss: () -> Unit) {
  val ctx = LocalContext.current; val c = DS.c
  var reciters by remember { mutableStateOf(false) }; var downloads by remember { mutableStateOf(false) }
  var scrubbing by remember { mutableStateOf<Double?>(null) }
  val a = Recitation.currentAyah
  val shown = scrubbing ?: Recitation.position
  val frac = if (Recitation.duration > 0) (shown / Recitation.duration).toFloat().coerceIn(0f, 1f) else 0f
  fun t(v: Double): String { val s = maxOf(0, v.toInt()); return "${Fmt.number(s / 60)}:${if (s % 60 < 10) Fmt.number(0) else ""}${Fmt.number(s % 60)}" }
  val rangeLabel = run { val x = Recitation.rangeA; val y = Recitation.rangeB; if (x != null && y != null && x < Recitation.queue.size && y < Recitation.queue.size) { val ax = QuranText.shared.ayah(Recitation.queue[x]); val ay = QuranText.shared.ayah(Recitation.queue[y]); if (ax != null && ay != null) " · تكرار أ–ب ${Fmt.number(ax.ayah)}–${Fmt.number(ay.ayah)}" else "" } else "" }
  ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = Color(0xFF0E5C55), dragHandle = null) {
    Column(Modifier.fillMaxWidth().fillMaxHeight(0.96f).background(Brush.verticalGradient(listOf(Color(0xFF0E5C55), Color(0xFF061716)))).padding(horizontal = 20.dp, vertical = 12.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(14.dp), horizontalAlignment = Alignment.CenterHorizontally) {
      Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) { DSIconButton(Icons.Filled.KeyboardArrowDown, style = IconStyle.Glass, size = 40.dp, iconSize = 18.dp, contentDescription = "إغلاق", onClick = onDismiss); Spacer(Modifier.weight(1f)); Text("التلاوة الآن", style = DSType.labelMd, color = c.textOnDarkMuted); Spacer(Modifier.weight(1f)); DSIconButton(Icons.Outlined.Download, style = IconStyle.Glass, size = 40.dp, iconSize = 18.dp, contentDescription = "التنزيلات", onClick = { downloads = true }) }
      Spacer(Modifier.height(4.dp))
      Box(Modifier.size(96.dp), contentAlignment = Alignment.Center) { Canvas(Modifier.matchParentSize()) { drawCircle(Color(0xFFC69C3E).copy(alpha = 0.8f), style = Stroke(2.dp.toPx())); drawCircle(Color.White.copy(alpha = 0.12f), radius = 40.dp.toPx()) }; Text(Catalog.shared.reciter(Recitation.reciter).name.take(1), style = DSType.displayLg, color = c.accentGold) }
      Row(Modifier.clickable { reciters = true }.semantics { contentDescription = "القارئ ${Catalog.shared.reciter(Recitation.reciter).name}، تغيير" }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) { Text(Catalog.shared.reciter(Recitation.reciter).name, style = DSType.displaySm, color = c.textOnDark, textAlign = TextAlign.Center); Icon(Icons.Filled.KeyboardArrowDown, null, Modifier.size(14.dp), tint = c.textOnDarkMuted) }
      if (a != null) Text("سورة ${QuranMeta.surah(a.surah).name} · الآية ${Fmt.number(a.ayah)} من ${Fmt.number(QuranMeta.surah(a.surah).ayahs)}$rangeLabel${if (Recitation.hasWords) "" else " · بلا توقيت كلمات"}", style = DSType.labelSm, color = c.textOnDarkMuted, textAlign = TextAlign.Center)
      Spacer(Modifier.height(4.dp))
      if (a != null) {
        val words = a.text.split(" "); val cur = if (Recitation.hasWords) Recitation.currentWord?.minus(1) else null
        if (Recitation.hasWords) Column(Modifier.fillMaxWidth().clip(DS.shapeXl).background(Color.White.copy(alpha = 0.08f)).padding(14.dp), horizontalAlignment = Alignment.CenterHorizontally) {
          FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            // حشوة ثابتة: الكلمة الجارية تتلوّن ولا تقفز
            words.forEachIndexed { i, w -> Text(w, Modifier.clip(RoundedCornerShape(8.dp)).background(if (cur == i) c.accentGold else Color.Transparent).padding(horizontal = 5.dp, vertical = 2.dp), style = DSType.quranInline.copy(fontSize = 21.sp, lineHeight = 36.sp), color = if (cur == i) Color(0xFF16211F) else c.textOnDark) }
            Text("﴿${Fmt.number(a.ayah)}﴾", Modifier.padding(horizontal = 5.dp), style = DSType.quranInline.copy(fontSize = 21.sp, lineHeight = 36.sp), color = c.accentGold)
          }
        } else Text("${a.text} ﴿${Fmt.number(a.ayah)}﴾", Modifier.fillMaxWidth(), style = DSType.quranInline.copy(fontSize = 20.sp, lineHeight = 38.sp), color = c.textOnDark, textAlign = TextAlign.Center, maxLines = 4, overflow = TextOverflow.Ellipsis)
      }
      // شريط تقدّم صادق يملأ من اليمين ويُسحب للانتقال داخل الآية — يُرسم في فضاء من اليسار إلى اليمين كي لا يلتبس اتجاه اللمسة
      Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        var width by remember { mutableFloatStateOf(0f) }
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
          Box(Modifier.fillMaxWidth().height(24.dp).onSizeChanged { width = it.width.toFloat() }
            .pointerInput(Unit) { detectHorizontalDragGestures(onDragStart = { o -> if (Recitation.duration > 0 && width > 0) scrubbing = (1f - (o.x / width).coerceIn(0f, 1f)) * Recitation.duration }, onDragEnd = { scrubbing?.let { Recitation.seek(it) }; scrubbing = null }, onDragCancel = { scrubbing = null }) { ch, _ -> if (Recitation.duration > 0 && width > 0) scrubbing = (1f - (ch.position.x / width).coerceIn(0f, 1f)) * Recitation.duration } }
            .semantics { contentDescription = "موضع التلاوة ${t(shown)} من ${t(Recitation.duration)}" }
            .drawBehind {
              val h = 4.dp.toPx(); val y = size.height / 2
              drawRoundRect(Color.White.copy(alpha = 0.18f), topLeft = Offset(0f, y - h / 2), size = androidx.compose.ui.geometry.Size(size.width, h), cornerRadius = androidx.compose.ui.geometry.CornerRadius(h))
              val fill = (size.width * frac).coerceAtLeast(h)
              drawRoundRect(Color(0xFFC69C3E), topLeft = Offset(size.width - fill, y - h / 2), size = androidx.compose.ui.geometry.Size(fill, h), cornerRadius = androidx.compose.ui.geometry.CornerRadius(h))
              drawCircle(Color(0xFFC69C3E), radius = 7.dp.toPx(), center = Offset((size.width - fill).coerceIn(7.dp.toPx(), size.width - 7.dp.toPx()), y))
            })
        }
        Row(Modifier.fillMaxWidth()) { Text(t(shown), style = DSType.numericSm, color = c.textOnDarkMuted); Spacer(Modifier.weight(1f)); Text(t(Recitation.duration), style = DSType.numericSm, color = c.textOnDarkMuted) }
      }
      Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(18.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
        Box { DSIconButton(Icons.Outlined.Repeat, style = IconStyle.Glass, size = 44.dp, iconSize = 18.dp, contentDescription = "تكرار الآية", onClick = { val o = listOf(1, 2, 3, 5, 10); val nx = o[((o.indexOf(Recitation.repeatAyah).coerceAtLeast(0)) + 1) % o.size]; Recitation.repeatAyah = nx; Store.repeatAyah = nx; Store.save() }); if (Recitation.repeatAyah > 1) Box(Modifier.align(Alignment.TopEnd)) { DSBadge("×${Fmt.number(Recitation.repeatAyah)}", fg = Color(0xFF16211F), bg = c.accentGold) } }
        DSIconButton(Icons.Filled.SkipNext, style = IconStyle.Glass, size = 52.dp, iconSize = 24.dp, contentDescription = "الآية التالية", onClick = { Recitation.next(ctx) })
        Box(Modifier.size(76.dp).shadow(16.dp, CircleShape, ambientColor = c.accentGold.copy(alpha = 0.35f), spotColor = c.accentGold.copy(alpha = 0.35f)).clip(CircleShape).background(c.accentGold).clickable(role = Role.Button) { Recitation.toggle() }.semantics { contentDescription = if (Recitation.isPlaying) "إيقاف مؤقت" else "تشغيل" }, contentAlignment = Alignment.Center) { Icon(if (Recitation.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow, null, Modifier.size(32.dp), tint = Color(0xFF16211F)) }
        DSIconButton(Icons.Filled.SkipPrevious, style = IconStyle.Glass, size = 52.dp, iconSize = 24.dp, contentDescription = "الآية السابقة", onClick = { Recitation.prev(ctx) })
        DSIconButton(Icons.Outlined.Bedtime, style = IconStyle.Glass, size = 44.dp, iconSize = 18.dp, contentDescription = "مؤقت النوم", onClick = { val o = listOf(0, 15, 30, 45, 60); val cur = Recitation.sleepMinutesLeft ?: 0; val nx = o[((o.indexOfFirst { it >= cur }.coerceAtLeast(0)) + 1) % o.size]; Recitation.setSleep(nx) })
      }
      Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)) {
        val ab = if (Recitation.hasRange) "أ–ب ✓" else if (Recitation.rangeA != null) "أ ✓ — اختر ب" else "تكرار أ–ب"
        GlassChip(ab, Icons.Outlined.RepeatOne, on = Recitation.rangeA != null) { if (Recitation.hasRange) Recitation.clearRange() else if (Recitation.rangeA != null) Recitation.setRange(Recitation.rangeA, Recitation.index) else Recitation.setRange(Recitation.index, null) }
        GlassChip("السرعة ${Fmt.decimal(Store.rate, 2)}×", Icons.Outlined.Speed, on = Store.rate != 1.0) { val o = listOf(0.75, 1.0, 1.25, 1.5); Recitation.setRate(o[((o.indexOf(Store.rate).coerceAtLeast(0)) + 1) % o.size]) }
        GlassChip("تكرار القائمة", Icons.Outlined.Repeat, on = Recitation.repeatRange) { Recitation.useRepeatRange(!Recitation.repeatRange); Store.repeatRange = Recitation.repeatRange; Store.save() }
        GlassChip(Recitation.sleepMinutesLeft?.let { "نوم ${Fmt.number(it)} د" } ?: "مؤقت النوم", Icons.Outlined.Bedtime, on = Recitation.sleepAt != null) { val o = listOf(0, 15, 30, 45, 60); val cur = Recitation.sleepMinutesLeft ?: 0; Recitation.setSleep(o[((o.indexOfFirst { it >= cur }.coerceAtLeast(0)) + 1) % o.size]) }
        GlassChip("القارئ", Icons.Outlined.Mic) { reciters = true }
        GlassChip("تنزيل السورة", Icons.Outlined.Download) { downloads = true }
      }
      Spacer(Modifier.navigationBarsPadding())
    }
  }
  if (reciters) ModalBottomSheet(onDismissRequest = { reciters = false }, containerColor = c.bgSurface) { ReciterList { reciters = false } }
  if (downloads) ModalBottomSheet(onDismissRequest = { downloads = false }, containerColor = c.bgSurface) { DownloadsSheet(a?.surah) }
}
/** التنقّل والبحث الموحّد: بحث، آخر المواضع، ومقسّم رباعي — السور، الأجزاء في شبكة بأوائلها من المتن، الأحزاب بأرباعها، العلامات */
@OptIn(ExperimentalMaterial3Api::class)
@Composable fun NavSheet(current: Int, onDismiss: () -> Unit, onGo: (Int, Int?) -> Unit) {
  val c = DS.c
  var q by remember { mutableStateOf("") }; var tab by remember { mutableIntStateOf(0) }
  val cur = QuranText.shared.label(current)
  val cols = if (LocalDensity.current.fontScale >= 1.3f) 3 else 5
  ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = c.bgCanvas) {
    Column(Modifier.fillMaxHeight(0.92f).padding(horizontal = 16.dp)) {
      Text("التنقّل والبحث", Modifier.fillMaxWidth().padding(bottom = 6.dp), style = DSType.headingMd, color = c.textPrimary, textAlign = TextAlign.Center)
      OutlinedTextField(q, { q = it }, Modifier.fillMaxWidth(), placeholder = { Text("سورة، آية، نص، أو رقم صفحة…", style = DSType.bodySm) }, singleLine = true, shape = CircleShape, leadingIcon = { Icon(Icons.Outlined.Search, null, tint = c.textTertiary) }, trailingIcon = { if (q.isNotEmpty()) IconButton({ q = "" }) { Icon(Icons.Filled.Close, "مسح", tint = c.textTertiary) } })
      Spacer(Modifier.height(8.dp))
      if (q.isBlank()) {
        LazyColumn(contentPadding = PaddingValues(bottom = 24.dp)) {
          if (Store.recent.isNotEmpty()) item {
            Column(Modifier.padding(bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
              Text("آخر المواضع", style = DSType.labelSm, color = c.textSecondary)
              Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Store.recent.forEach { r -> Column(Modifier.clip(DS.shapeMd).background(c.bgSurface).border(1.dp, c.borderSubtle, DS.shapeMd).clickable { onGo(r.page, QuranText.shared.ayah(r.surah, r.ayah)?.n) }.padding(horizontal = 12.dp, vertical = 8.dp)) { Text(QuranMeta.surah(r.surah).name, style = DSType.readingSm, color = c.textPrimary); Text("آية ${Fmt.number(r.ayah)} · ص ${Fmt.number(r.page)}", style = DSType.labelXs, color = c.textTertiary) } }
              }
            }
          }
          item { DSSegmented(listOf("السور", "الأجزاء", "الأحزاب", "العلامات"), tab, Modifier.padding(bottom = 12.dp)) { tab = it } }
          when (tab) {
            0 -> itemsIndexed(QuranMeta.surahs) { i, s -> IndexRow(i == 0, i == 113, top = i == 0) { SurahRow(s, current = current >= s.page && current < (if (s.n < 114) QuranMeta.surah(s.n + 1).page else 605)) { onGo(s.page, QuranText.shared.ayah(s.n, 1)?.n) } } }
            1 -> items(QuranMeta.juzStarts.chunked(cols)) { row ->
              Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { j -> val on = cur?.juz == j.juz; val phrase = QuranText.shared.juzStartPhrase(j.juz)
                  Column(Modifier.weight(1f).height(58.dp).clip(DS.shapeMd).background(if (on) c.brandPrimary else c.bgSurface).border(1.dp, if (on) Color.Transparent else c.borderSubtle, DS.shapeMd).clickable(role = Role.Button) { onGo(j.page, null) }.semantics { contentDescription = "الجزء ${j.juz}، $phrase، صفحة ${j.page}" }, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    Text(Fmt.number(j.juz), style = DSType.labelMd.copy(fontFamily = Fonts.kufi, fontSize = 15.sp, fontWeight = FontWeight.SemiBold), color = if (on) c.textOnBrand else c.textPrimary)
                    Text(phrase, style = DSType.quranInline.copy(fontSize = 11.sp, lineHeight = 16.sp), color = if (on) c.textOnBrand.copy(alpha = 0.85f) else c.textSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                  }
                }
                repeat(cols - row.size) { Spacer(Modifier.weight(1f)) }
              }
            }
            2 -> items((1..60).toList()) { h -> IndexRow(h == 1, h == 60, top = h == 1) { HizbRow(h) { p -> onGo(p, null) } } }
            else -> item { DSCard(Modifier.fillMaxWidth(), padding = 8.dp) { BookmarksList(onGo) } }
          }
        }
      } else {
        val s = QuranNormalize.foldDigits(q.trim()); val page = s.toIntOrNull(); val ref = QuranSearch.parseRef(s)
        LazyColumn(contentPadding = PaddingValues(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
          if (page != null && page in 1..604) item { DSCard(Modifier.fillMaxWidth(), padding = 4.dp) { DSRow(Icons.Outlined.MenuBook, "الانتقال إلى الصفحة ${Fmt.number(page)}", QuranText.shared.label(page)?.let { "${QuranMeta.surah(it.surah).name} · الجزء ${Fmt.number(it.juz)}" }, onClick = { onGo(page, null) }) } }
          else if (ref != null) { val a = QuranText.shared.ayah(ref.surah.n, minOf(ref.surah.ayahs, ref.ayah)); if (a != null) item { DSCard(Modifier.fillMaxWidth(), padding = 4.dp) { DSRow(Icons.Outlined.MenuBook, "سورة ${ref.surah.name} — الآية ${Fmt.number(a.ayah)}", "الصفحة ${Fmt.number(a.page)}", onClick = { onGo(a.page, a.n) }) } } }
          else {
            val surahs = QuranSearch.matchSurahs(s); val ayat = if (s.length >= 2) QuranSearch.shared.search(s, 30) else emptyList()
            if (surahs.isNotEmpty()) item { DSCard(Modifier.fillMaxWidth(), padding = 8.dp) { surahs.forEach { su -> SurahRow(su) { onGo(su.page, QuranText.shared.ayah(su.n, 1)?.n) } } } }
            if (ayat.isNotEmpty()) item { DSCard(Modifier.fillMaxWidth(), padding = 8.dp) { ayat.forEach { a -> Column(Modifier.fillMaxWidth().clip(DS.shapeMd).clickable { onGo(a.page, a.n) }.padding(10.dp)) { Text(a.text.take(90), style = DSType.quranInline.copy(fontSize = 16.sp, lineHeight = 30.sp), color = c.textPrimary, maxLines = 2, overflow = TextOverflow.Ellipsis); Text("${QuranSearch.refLabel(a)} · ص ${Fmt.number(a.page)}", style = DSType.labelXs, color = c.textSecondary) } } } }
            if (surahs.isEmpty() && ayat.isEmpty()) item { Text("لا نتائج", Modifier.padding(12.dp), style = DSType.bodyMd, color = c.textSecondary) }
          }
        }
      }
    }
  }
}
/** العرض والألوان: معاينة حيّة لآيةٍ من المتن على ورق السمة، ثم مجموعات السمات، الإضاءة، طريقة العرض، والنصّ المتدفّق */
@Composable fun DisplaySheet() {
  val c = DS.c; val dark = isSystemInDarkTheme(); val t = Store.effectiveTheme(dark)
  val preview = QuranText.shared.ayah(1, 2)
  Column(Modifier.padding(16.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
    Box(Modifier.fillMaxWidth().height(112.dp).clip(DS.shapeLg).background(hex(t.paper)).border(1.dp, c.borderSubtle, DS.shapeLg).semantics { contentDescription = "معاينة السمة ${t.name}" }) {
      Column(Modifier.fillMaxSize().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Text("${preview?.text ?: ""} ﴿٢﴾", style = DSType.quranInline.copy(fontSize = (20 * (if (Store.view == "text") Store.fontScale else 1.0)).sp, lineHeight = 34.sp), color = hex(t.ink), textAlign = TextAlign.Center, maxLines = 2, overflow = TextOverflow.Ellipsis)
        Text("سورة الفاتحة · ${t.name}", style = DSType.labelXs, color = hex(t.ink).copy(alpha = 0.6f))
      }
    }
    Text("السمة الحالية: ${t.name}${if (Store.themeAuto) " · الليلي يتبع النظام" else ""}", style = DSType.labelXs, color = c.textSecondary)
    Text("لون الصفحة", style = DSType.headingSm, color = c.textPrimary, modifier = Modifier.padding(top = 4.dp))
    for (g in Catalog.shared.themeGroups) {
      Text(g.name, style = DSType.labelXs, color = c.textSecondary, modifier = Modifier.padding(top = 4.dp))
      Row(Modifier.horizontalScroll(rememberScrollState())) { for (th in Catalog.shared.themes.filter { it.group == g.id }) { Column(Modifier.padding(end = 8.dp).clip(DS.shapeSm).clickable(role = Role.Button) { Store.theme = th.id; Store.save() }.semantics { contentDescription = "${g.name}: ${th.name}" }, horizontalAlignment = Alignment.CenterHorizontally) { Box(Modifier.size(44.dp, 40.dp).background(hex(th.paper), RoundedCornerShape(8.dp)).border(if (Store.theme == th.id) 2.dp else 1.dp, if (Store.theme == th.id) c.brandPrimary else Color.Gray.copy(alpha = 0.4f), RoundedCornerShape(8.dp)), contentAlignment = Alignment.Center) { Text("ق", fontFamily = Fonts.amiri, color = hex(th.ink), fontSize = 20.sp) }; Text(th.name, style = DSType.labelXs.copy(fontSize = 10.sp), color = c.textPrimary, maxLines = 1) } } }
    }
    RowSwitch("الوضع الليلي يتبع النظام", Store.themeAuto) { Store.themeAuto = it; Store.save() }
    RowSwitch("إبقاء الشاشة مضاءة", Store.keepAwake) { Store.keepAwake = it; Store.save() }
    Text("طريقة العرض", style = DSType.headingSm, color = c.textPrimary, modifier = Modifier.padding(top = 8.dp))
    Row { FilterChip(Store.view == "pages", { Store.view = "pages"; Store.save() }, { Text("صفحات المصحف") }, Modifier.padding(end = 6.dp)); FilterChip(Store.view == "text", { Store.view = "text"; Store.save() }, { Text("نص متدفق") }) }
    Text(if (Store.view == "text") "نص متدفق بحجم خط قابل للتغيير" else "صفحات مصحف المدينة كما في المطبوع سطرًا بسطر؛ لتكبير الخطّ اختر «نص متدفق»", style = DSType.labelXs, color = c.textSecondary)
    RowSwitch("التجويد الملوّن (وضع النص)", Store.tajweed) { Store.tajweed = it; if (it) Store.view = "text"; Store.save() }
    if (Store.view == "text") {
      Row(Modifier.padding(top = 8.dp)) { FilterChip(Store.textFont == "amiri", { Store.textFont = "amiri"; Store.save() }, { Text("أميري قرآن") }, Modifier.padding(end = 6.dp)); FilterChip(Store.textFont == "hafs", { Store.textFont = "hafs"; Store.save() }, { Text("حفص (مجمع الملك فهد)") }) }
      Row(verticalAlignment = Alignment.CenterVertically) { Text("حجم الخط ${Fmt.decimal(Store.fontScale, 1)}×", Modifier.weight(1f), style = DSType.bodySm, color = c.textPrimary); OutlinedButton(onClick = { Store.fontScale = maxOf(0.7, Store.fontScale - 0.1); Store.save() }) { Text("أ-") }; Spacer(Modifier.width(6.dp)); OutlinedButton(onClick = { Store.fontScale = minOf(1.8, Store.fontScale + 0.1); Store.save() }) { Text("أ+") } }
    }
    Spacer(Modifier.height(24.dp))
  }
}
/** الختمة والورد: بطاقة الخطة من سجلّ الورد، إحصاءات، الإعداد (الوحدة، المدة أو «حتى آخر رمضان»، البداية، تذكير بوقت أو بعد صلاة)، والأوراد المسنونة */
@OptIn(ExperimentalMaterial3Api::class)
@Composable fun KhatmahSheet(onDismiss: () -> Unit, onGo: ((Int) -> Unit)? = null) {
  val ctx = LocalContext.current; val c = DS.c
  val plan = Store.khatmah; val today = Store.todayKey
  val stt = plan?.let { Khatmah.status(it, Store.wird, today) }
  val stats = Khatmah.stats(Store.readLog, today)
  var unit by remember { mutableStateOf(Store.khatmahUnit) }
  val remainingAtLoad = plan?.let { maxOf(1, it.days - maxOf(0, DayKey.daysBetween(it.startedAt, today))) } ?: 0
  var days by remember { mutableIntStateOf(if (plan != null) remainingAtLoad else Khatmah.days(Store.khatmahUnit, 30)) }
  var fromCurrent by remember { mutableStateOf(true) }
  val initialAfter = Reminders.afterPrayer(plan?.reminder)
  var reminderMode by remember { mutableIntStateOf(if (initialAfter != null) 2 else if (plan?.reminder != null) 1 else 0) }
  var afterPrayer by remember { mutableStateOf(initialAfter ?: Prayer.ISHA) }
  var hm by remember { mutableStateOf(plan?.reminder?.let { Reminders.parseHM(it) } ?: (21 to 0)) }
  val ramadanDays = remember { Hijri.daysUntilEndOfRamadan(Instant.now(), Store.zone, Store.hijriOffset) }
  val perDay = Math.ceil(Khatmah.TOTAL.toDouble() / maxOf(1, days)).toInt()
  fun save() {
    val reminder = when (reminderMode) { 1 -> "%02d:%02d".format(java.util.Locale.US, hm.first, hm.second); 2 -> "after:${afterPrayer.id}"; else -> null }
    Store.khatmahUnit = unit
    val p = Store.khatmah
    Store.khatmah = if (p != null && days == remainingAtLoad) KhatmahPlan.make(p.startPage, p.startedAt, p.days, reminder)
    else if (p != null) { val done = Wird.done(Store.wird); Store.wird = emptyMap(); KhatmahPlan.make(((p.startPage - 1 + done) % Khatmah.TOTAL) + 1, today, days, reminder) }
    else { Store.wird = emptyMap(); KhatmahPlan.make(if (fromCurrent) (Store.lastRead?.page ?: 1) else 1, today, days, reminder) }
    Store.save(); Notify.schedule(ctx); onDismiss()
  }
  ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = c.bgCanvas) {
    Column(Modifier.fillMaxHeight(0.94f).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
      Text("الختمة والورد", Modifier.fillMaxWidth(), style = DSType.headingMd, color = c.textPrimary, textAlign = TextAlign.Center)
      if (plan != null && stt != null) {
        val pct = stt.percent / 100f; val target = maxOf(1, stt.todayTarget); val nextPage = ((plan.startPage - 1 + stt.done) % Khatmah.TOTAL) + 1
        NightCard(Modifier.fillMaxWidth(), padding = PaddingValues(18.dp)) {
          Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(100.dp), contentAlignment = Alignment.Center) { RingProgress(pct, Modifier.matchParentSize(), tint = c.accentGold, track = Color.White.copy(alpha = 0.14f), stroke = 8.dp); Column(horizontalAlignment = Alignment.CenterHorizontally) { Text("${Fmt.number(stt.percent)}٪", style = DSType.numericLg, color = Color(0xFFE2C77A)); Text("من المصحف", style = DSType.labelXs, color = c.textOnDarkMuted) } }
            Spacer(Modifier.width(16.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
              Text(if (stt.finished) "تقبّل الله ✦ أتممت الختمة" else "ورد اليوم ${Fmt.number(minOf(stt.todayPages, target))} من ${Fmt.number(target)} صفحة", style = DSType.headingSm, color = c.textOnDark, maxLines = 2)
              Text("اليوم ${Fmt.number(stt.dayIndex + 1)} من ${Fmt.number(plan.days)} · الإتمام المتوقّع ${Fmt.shortDate(stt.etaKey)}", style = DSType.labelXs, color = c.textOnDarkMuted, maxLines = 2)
              if (!stt.finished) Text(if (stt.behind > 0) "متأخّر ${Fmt.number(stt.behind)} صفحة — تُوزَّع على الأيام الباقية (${Fmt.number(stt.neededPerDay)} يوميًا)" else "على الجدول ✓", style = DSType.labelSm, color = Color(0xFFE2C77A), maxLines = 2)
              if (!stt.finished && onGo != null) Row(Modifier.padding(top = 2.dp).clip(CircleShape).background(c.accentGold).clickable { onGo(nextPage) }.padding(horizontal = 14.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) { Text("تابع الورد · ص ${Fmt.number(nextPage)}", style = DSType.labelSm.copy(fontSize = 13.sp, fontWeight = FontWeight.SemiBold), color = Color(0xFF16211F)); Icon(Icons.Filled.ChevronLeft, null, Modifier.size(12.dp), tint = Color(0xFF16211F)) }
            }
          }
        }
      }
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { DSStatTile(Fmt.number(stats.week), "صفحة · هذا الأسبوع", Modifier.weight(1f)); DSStatTile(Fmt.number(stats.month), "صفحة · هذا الشهر", Modifier.weight(1f)); DSStatTile(Fmt.decimal(stats.avgDay, 1), "متوسط اليوم", Modifier.weight(1f)) }
      DSCard(Modifier.fillMaxWidth(), padding = 16.dp) {
        Text(if (plan == null) "خطة ختمة جديدة" else "تعديل الخطة", style = DSType.headingSm.copy(fontFamily = Fonts.kufi), color = c.textPrimary)
        Spacer(Modifier.height(10.dp))
        Text("وحدة الورد", style = DSType.labelSm, color = c.textSecondary); Spacer(Modifier.height(6.dp))
        DSSegmented(listOf("صفحات", "حزب يوميًا", "جزء يوميًا"), when (unit) { "hizb" -> 1; "juz" -> 2; else -> 0 }) { i -> unit = when (i) { 1 -> "hizb"; 2 -> "juz"; else -> "page" }; days = Khatmah.days(unit, days) }
        Spacer(Modifier.height(10.dp))
        if (unit == "page") {
          Text(if (plan == null) "المدة" else "المدة المتبقية", style = DSType.labelSm, color = c.textSecondary); Spacer(Modifier.height(6.dp))
          Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(30, 60, 90, 120).forEach { d -> DSChip("${Fmt.number(d)} يومًا", on = days == d) { days = d } }
            if (ramadanDays > 0) DSChip("حتى آخر رمضان (${Fmt.number(ramadanDays)} يومًا)", on = days == ramadanDays) { days = ramadanDays }
          }
          Spacer(Modifier.height(6.dp))
          Row(verticalAlignment = Alignment.CenterVertically) { Text("${Fmt.number(days)} يومًا ≈ ${Fmt.number(perDay)} صفحات يوميًا", Modifier.weight(1f), style = DSType.bodySm, color = c.textPrimary); OutlinedButton(onClick = { days = maxOf(1, days - 1) }) { Text("−") }; Spacer(Modifier.width(6.dp)); OutlinedButton(onClick = { days = minOf(604, days + 1) }) { Text("+") } }
        } else Text("${if (unit == "hizb") "حزب كل يوم (التحزيب التقليدي)" else "جزء كل يوم"}: ${Fmt.number(Khatmah.days(unit))} يومًا ≈ ${Fmt.number(Math.ceil(Khatmah.TOTAL.toDouble() / Khatmah.days(unit)).toInt())} صفحة يوميًا", style = DSType.bodySm, color = c.textSecondary)
        if (plan != null && days != remainingAtLoad) Text("تغيير المدة يبدأ العدّ من موضعك الحالي (${Fmt.number(((plan.startPage - 1 + Wird.done(Store.wird)) % Khatmah.TOTAL) + 1)}) بمدة جديدة", Modifier.padding(top = 6.dp), style = DSType.labelXs, color = c.textTertiary)
        if (plan == null) { Spacer(Modifier.height(10.dp)); Text("البداية", style = DSType.labelSm, color = c.textSecondary); Spacer(Modifier.height(6.dp)); DSSegmented(listOf("من موضع قراءتي", "من الفاتحة"), if (fromCurrent) 0 else 1) { fromCurrent = it == 0 } }
        Spacer(Modifier.height(10.dp))
        Text("التذكير", style = DSType.labelSm, color = c.textSecondary); Spacer(Modifier.height(6.dp))
        DSSegmented(listOf("بلا", "في وقت", "بعد صلاة"), reminderMode) { reminderMode = it }
        if (reminderMode == 1) { Spacer(Modifier.height(6.dp)); OutlinedButton(onClick = { android.app.TimePickerDialog(ctx, { _, h, m -> hm = h to m }, hm.first, hm.second, !Store.hour12).show() }) { Text("الوقت: ${Fmt.time(java.time.ZonedDateTime.now(Store.zone).withHour(hm.first).withMinute(hm.second).toInstant())}") } }
        if (reminderMode == 2) { Spacer(Modifier.height(6.dp)); Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf(Prayer.FAJR, Prayer.DHUHR, Prayer.ASR, Prayer.MAGHRIB, Prayer.ISHA).forEach { pr -> DSChip(pr.nameAr, on = afterPrayer == pr) { afterPrayer = pr } } }; Text("يصلك بعد أذان ${afterPrayer.nameAr} بعشرين دقيقة حسب مواقيت موقعك", Modifier.padding(top = 4.dp), style = DSType.labelXs, color = c.textTertiary) }
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { DSButton(if (plan == null) "ابدأ الخطة" else "حفظ التعديلات", Modifier.weight(1f), onClick = { save() }); if (plan != null) DSButton("إنهاء", kind = ButtonKind.Outline) { Store.khatmah = null; Store.wird = emptyMap(); Store.save(); Notify.schedule(ctx); onDismiss() } }
      }
      // الأوراد المسنونة: بلا مؤقّت ولا سلسلة — تُحتسب صفحات الورد التي تُقرأ في نافذتها
      val weekday = CivilDate.weekdayIndex(Instant.now(), Store.zone)
      val maghribPassed = Store.timeline()?.let { t -> t.times[Prayer.MAGHRIB]?.let { Instant.now() >= it } } ?: false
      DSCard(Modifier.fillMaxWidth(), padding = 16.dp) {
        Text("أوراد مسنونة", style = DSType.headingSm.copy(fontFamily = Fonts.kufi), color = c.textPrimary)
        Text("بلا مؤقّت ولا سلسلة — تُحتسب صفحات الورد التي تقرؤها في نافذتها", style = DSType.labelXs, color = c.textTertiary)
        Spacer(Modifier.height(10.dp))
        Awrad.all.forEachIndexed { i, w ->
          val ds = Awrad.days(w, today, weekday, maghribPassed); val pr = Awrad.progress(w, Store.readLog, ds)
          val window = if (w.window == SunnahWird.Window.FRIDAY_EVE) (if (ds.isEmpty()) "تُفتح النافذة مغرب الخميس" else "النافذة مفتوحة الآن") else w.desc
          Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            DSIconButton(when (w.id) { "kahf" -> Icons.Outlined.WbSunny; "mulk" -> Icons.Outlined.Bedtime; else -> Icons.Outlined.MenuBook }, style = if (pr.first >= pr.second) IconStyle.GoldSoft else IconStyle.Soft, size = 40.dp, iconSize = 16.dp)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) { Text(w.name, style = DSType.headingSm, color = c.textPrimary); Text("$window · ص ${Fmt.number(w.from)}–${Fmt.number(w.to)}", style = DSType.labelXs, color = c.textSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis); ProgressTrack(if (pr.second > 0) pr.first.toFloat() / pr.second else 0f, tint = c.accentGold, track = c.bgSubtle, height = 4.dp) }
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) { Text("${Fmt.number(pr.first)}/${Fmt.number(pr.second)}", style = DSType.numericSm, color = c.textSecondary); if (onGo != null) Text("اقرأ", Modifier.clip(CircleShape).background(c.brandSoft).clickable(role = Role.Button) { onGo(w.from) }.padding(horizontal = 12.dp, vertical = 6.dp).semantics { contentDescription = "اقرأ ${w.name}" }, style = DSType.labelSm, color = c.brandPrimary) }
          }
          if (i < Awrad.all.size - 1) { Spacer(Modifier.height(10.dp)); DSDivider(); Spacer(Modifier.height(10.dp)) }
        }
      }
      Spacer(Modifier.navigationBarsPadding())
    }
  }
}
/** قائمة القرّاء */
@Composable fun ReciterList(onPick: () -> Unit) {
  val c = DS.c
  LazyColumn(Modifier.padding(bottom = 24.dp)) { items(Catalog.shared.reciters) { r -> DSRow(Icons.Outlined.Mic, r.name, if (r.hasWordTiming) "كلمة بكلمة" else null, iconStyle = if (Store.reciter == r.id) IconStyle.Brand else IconStyle.Soft, onClick = { Store.reciter = r.id; Store.save(); Recitation.useReciter(r.id); onPick() }) { if (Store.reciter == r.id) Icon(Icons.Filled.Check, null, Modifier.size(18.dp), tint = c.brandPrimary) } }
  }
}

@Composable fun RowSwitch(label: String, value: Boolean, onChange: (Boolean) -> Unit) { Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) { Text(label, Modifier.weight(1f)); Switch(value, onChange) } }
@Composable fun OptionsSheet(page: Int, onDone: () -> Unit) {
  val ctx = LocalContext.current
  Column(Modifier.padding(16.dp).verticalScroll(rememberScrollState())) {
    Text("القارئ", fontWeight = FontWeight.Bold)
    LazyColumn(Modifier.height(240.dp)) { items(Catalog.shared.reciters) { r -> ListItem(headlineContent = { Text(r.name) }, trailingContent = { if (Store.reciter == r.id) Text("✓") }, modifier = Modifier.clickable { Store.reciter = r.id; Store.save(); Recitation.useReciter(r.id) }) } }
    Row(verticalAlignment = Alignment.CenterVertically) { Text("تكرار الآية ×${Fmt.number(Store.repeatAyah)}", Modifier.weight(1f)); OutlinedButton(onClick = { val o = listOf(1, 2, 3, 5, 10); Store.repeatAyah = o[(o.indexOf(Store.repeatAyah) + 1) % o.size]; Store.save(); Recitation.repeatAyah = Store.repeatAyah }) { Text("تغيير") } }
    Row(verticalAlignment = Alignment.CenterVertically) { Text("السرعة ${Fmt.decimal(Store.rate, 2)}×", Modifier.weight(1f)); OutlinedButton(onClick = { val o = listOf(0.75, 1.0, 1.25, 1.5); Recitation.setRate(o[(o.indexOf(Store.rate) + 1) % o.size]) }) { Text("تغيير") } }
    Text("الصفحات بخطوط مجمع الملك فهد لطباعة المصحف الشريف (مصحف المدينة، حفص عن عاصم) مطابقةً للمصحف المطبوع سطرًا بسطر. النص: Tanzil. التلاوات: Islamic Network.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 12.dp))
    Spacer(Modifier.height(24.dp))
  }
}
