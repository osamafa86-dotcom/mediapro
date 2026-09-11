package org.emdatra.sakinah.app.ui

import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.ui.AbsoluteAlignment
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.*
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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


/** شاشة المصحف (تصميم Figma 02): بطاقة المتابعة مع حلقة الختمة، بلاطات سريعة، بطاقة الختمة، فهرس مقسّم مع بحث */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable fun MushafHome() {
  val c = DS.c
  var reader by remember { mutableStateOf<Pair<Int, Int?>?>(null) }
  var q by remember { mutableStateOf("") }; var tab by remember { mutableIntStateOf(0) }; var searching by remember { mutableStateOf(false) }
  var sheet by remember { mutableStateOf<String?>(null) }
  if (reader != null) { MushafReader(startPage = reader!!.first, startAyah = reader!!.second, onClose = { reader = null }); return }
  val last = Store.lastRead
  Column(Modifier.fillMaxSize()) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(top = 6.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
      Text("المصحف", style = DSType.displayLg, color = c.textPrimary); Spacer(Modifier.weight(1f))
      DSIconButton(Icons.Outlined.Search, contentDescription = "بحث", onClick = { searching = !searching; if (!searching) q = "" }); Spacer(Modifier.width(8.dp))
      DSIconButton(Icons.Outlined.FormatSize, contentDescription = "العرض", onClick = { sheet = "display" })
    }
    if (searching) OutlinedTextField(q, { q = it }, Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 4.dp), placeholder = { Text("سورة، آية، نص، أو رقم صفحة…", style = DSType.bodySm) }, singleLine = true, shape = CircleShape, leadingIcon = { Icon(Icons.Outlined.Search, null, tint = c.textTertiary) })
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(14.dp), contentPadding = PaddingValues(top = 8.dp, bottom = 24.dp)) {
      if (q.isBlank()) {
        item { ContinueCard(onOpen = { p, n -> reader = p to n }, onKhatmah = { sheet = "khatmah" }) }
        item { Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { QuickTile(Icons.Outlined.BookmarkBorder, "العلامات", "${Fmt.number(Store.bookmarks.size)} علامة", Modifier.weight(1f)) { tab = 2 }; QuickTile(Icons.Outlined.Headphones, "الاستماع", "${Fmt.number(Catalog.shared.reciters.size)} قارئًا", Modifier.weight(1f)) { sheet = "reciters" } } }
        item { Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { QuickTile(Icons.Outlined.Mic, "مراجعة الحفظ", "من الصفحة الحالية", Modifier.weight(1f)) { reader = (last?.page ?: 1) to null }; QuickTile(Icons.Outlined.Download, "دون اتصال", "تنزيل السور", Modifier.weight(1f)) { sheet = "downloads" } } }
        item { KhatmahCard { p -> reader = p to null } }
        item {
          DSCard(Modifier.fillMaxWidth(), padding = 12.dp) {
            DSSegmented(listOf("السور", "الأجزاء", "العلامات"), tab) { tab = it }
            Spacer(Modifier.height(6.dp))
            when (tab) {
              0 -> QuranMeta.surahs.forEach { s -> SurahRow(s) { reader = s.page to QuranText.shared.ayah(s.n, 1)?.n } }
              1 -> QuranMeta.juzStarts.forEach { j -> DSRow(Icons.Outlined.Layers, QuranMeta.juzName(j.juz, false), "يبدأ من ${QuranMeta.surah(j.surah).name}: ${Fmt.number(j.ayah)}", onClick = { reader = j.page to null }) { PageNum(j.page) } }
              else -> { if (Store.bookmarks.isEmpty()) Text("لا علامات بعد — انقر كلمة في المصحف ثم «علامة»", Modifier.padding(12.dp), style = DSType.bodySm, color = c.textSecondary)
                Store.bookmarks.reversed().forEach { b -> val a = QuranText.shared.ayah(b.surah, b.ayah); if (a != null) DSRow(Icons.Filled.Bookmark, "${QuranMeta.surah(a.surah).name}: ${Fmt.number(a.ayah)}", b.note?.takeIf { it.isNotBlank() } ?: a.text.take(60), iconStyle = IconStyle.GoldSoft, onClick = { reader = a.page to a.n }) { PageNum(a.page) } } }
            }
          }
        }
      } else {
        val s = QuranNormalize.foldDigits(q.trim()); val page = s.toIntOrNull(); val ref = QuranSearch.parseRef(s)
        if (page != null && page in 1..604) item { DSCard(Modifier.fillMaxWidth(), padding = 4.dp) { DSRow(Icons.Outlined.MenuBook, "الانتقال إلى الصفحة ${Fmt.number(page)}", null, onClick = { reader = page to null }) } }
        else if (ref != null) { val a = QuranText.shared.ayah(ref.surah.n, minOf(ref.surah.ayahs, ref.ayah)); if (a != null) item { DSCard(Modifier.fillMaxWidth(), padding = 4.dp) { DSRow(Icons.Outlined.MenuBook, "سورة ${ref.surah.name} — الآية ${Fmt.number(a.ayah)}", "الصفحة ${Fmt.number(a.page)}", onClick = { reader = a.page to a.n }) } } }
        else {
          val surahs = QuranSearch.matchSurahs(s); val ayat = if (s.length >= 2) QuranSearch.shared.search(s, 30) else emptyList()
          if (surahs.isNotEmpty()) item { DSCard(Modifier.fillMaxWidth(), padding = 8.dp) { surahs.forEach { su -> SurahRow(su) { reader = su.page to QuranText.shared.ayah(su.n, 1)?.n } } } }
          if (ayat.isNotEmpty()) item { DSCard(Modifier.fillMaxWidth(), padding = 8.dp) { ayat.forEach { a -> Column(Modifier.fillMaxWidth().clip(DS.shapeMd).clickable { reader = a.page to a.n }.padding(10.dp)) { Text(a.text.take(90), style = DSType.quranInline.copy(fontSize = 16.sp, lineHeight = 30.sp), color = c.textPrimary, maxLines = 2, overflow = TextOverflow.Ellipsis); Text("${QuranSearch.refLabel(a)} · ص ${Fmt.number(a.page)}", style = DSType.labelXs, color = c.textSecondary) } } } }
          if (surahs.isEmpty() && ayat.isEmpty()) item { Text("لا نتائج", Modifier.padding(12.dp), style = DSType.bodyMd, color = c.textSecondary) }
        }
      }
    }
  }
  when (sheet) {
    "display" -> ModalBottomSheet(onDismissRequest = { sheet = null }, containerColor = c.bgSurface) { DisplaySheet() }
    "khatmah" -> KhatmahDialog { sheet = null }
    "reciters" -> ModalBottomSheet(onDismissRequest = { sheet = null }, containerColor = c.bgSurface) { ReciterList { sheet = null } }
    "downloads" -> ModalBottomSheet(onDismissRequest = { sheet = null }, containerColor = c.bgSurface) { DownloadsSheet(last?.surah) }
  }
}
@Composable private fun PageNum(page: Int) { val c = DS.c; Column(horizontalAlignment = Alignment.CenterHorizontally) { Text(Fmt.number(page), style = DSType.numericMd, color = c.textSecondary); Text("صفحة", style = DSType.labelXs, color = c.textTertiary) } }
@Composable private fun QuickTile(icon: ImageVector, title: String, sub: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
  val c = DS.c
  DSTile(modifier, padding = 12.dp, onClick = onClick) { Row(verticalAlignment = Alignment.CenterVertically) { DSIconButton(icon, style = IconStyle.Soft, size = 40.dp, iconSize = 18.dp); Spacer(Modifier.width(10.dp)); Column { Text(title, style = DSType.labelMd, color = c.textPrimary, maxLines = 1); Text(sub, style = DSType.labelXs, color = c.textSecondary, maxLines = 1) } } }
}
/** بطاقة المتابعة (بطاقة الليل): السورة والصفحة، حلقة تقدّم الختمة أو المصحف، زر المتابعة */
@Composable private fun ContinueCard(onOpen: (Int, Int?) -> Unit, onKhatmah: () -> Unit) {
  val c = DS.c; val last = Store.lastRead; val page = last?.page ?: 1
  val plan = Store.khatmah; val stt = plan?.let { Khatmah.status(it, page, Store.readLog, Store.todayKey) }
  val pct = stt?.let { it.percent / 100f } ?: (page / 604f)
  val line = if (stt != null && plan != null) { if (stt.finished) "تقبّل الله ✦ أتممت الختمة" else "الختمة: ${if (stt.todayPages >= stt.todayTarget) "أتممت ورد اليوم ✓" else "بقي ${Fmt.number(maxOf(0, stt.todayTarget - stt.todayPages))} صفحات لورد اليوم"} · ${Fmt.number(plan.days)} يومًا" } else "ابدأ خطة ختمة لتقسيم المصحف على أيامك"
  NightCard(Modifier.fillMaxWidth(), padding = PaddingValues(20.dp)) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      Column(Modifier.weight(1f)) {
        Text(if (last == null) "ابدأ القراءة" else "متابعة القراءة", style = DSType.labelSm, color = c.textOnDarkMuted)
        Text(last?.let { "سورة ${QuranMeta.surah(it.surah).name}" } ?: "سورة الفاتحة", style = DSType.displayMd, color = c.textOnDark)
        Text(last?.let { "الصفحة ${Fmt.number(it.page)} · الجزء ${Fmt.number(QuranMeta.juzOfPage(it.page))} · الآية ${Fmt.number(it.ayah)}" } ?: "مصحف المدينة · حفص عن عاصم · ٦٠٤ صفحات", style = DSType.labelSm, color = c.textOnDarkMuted)
        Text(line, Modifier.padding(top = 4.dp).clickable(onClick = onKhatmah), style = DSType.labelSm, color = c.accentGold)
      }
      Spacer(Modifier.width(16.dp))
      Box(Modifier.size(84.dp), contentAlignment = Alignment.Center) { RingProgress(pct, Modifier.matchParentSize(), tint = c.accentGold, track = Color.White.copy(alpha = 0.25f), stroke = 7.dp); Text("${Fmt.number((pct * 100).toInt())}٪", style = DSType.numericMd, color = c.textOnDark) }
    }
    Spacer(Modifier.height(16.dp))
    DSButton(if (last == null) "ابدأ من الفاتحة" else "تابع من حيث توقفت", Modifier.fillMaxWidth(), kind = ButtonKind.Gold, icon = Icons.Filled.ChevronLeft) { onOpen(page, last?.let { QuranText.shared.ayah(it.surah, it.ayah)?.n }) }
  }
}
/** صفّ سورة: شارة معيّنية برقمها، الاسم ونوعها، رقم الصفحة */
@Composable fun SurahRow(s: Surah, onClick: () -> Unit) {
  val c = DS.c
  Row(Modifier.fillMaxWidth().clip(DS.shapeMd).clickable(onClick = onClick).padding(horizontal = 8.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
    Box(Modifier.size(40.dp), contentAlignment = Alignment.Center) { Box(Modifier.size(28.dp).rotate(45f).clip(RoundedCornerShape(6.dp)).background(c.brandSoft)); Text(Fmt.number(s.n), style = DSType.labelSm, color = c.brandPrimary) }
    Spacer(Modifier.width(12.dp))
    Column(Modifier.weight(1f)) { Text(s.name, style = DSType.headingSm, color = c.textPrimary); Text("${s.type} · ${Fmt.number(s.ayahs)} آية", style = DSType.labelXs, color = c.textSecondary) }
    PageNum(s.page)
  }
}
/** قائمة القرّاء */
@Composable fun ReciterList(onPick: () -> Unit) {
  val c = DS.c
  LazyColumn(Modifier.padding(bottom = 24.dp)) { items(Catalog.shared.reciters) { r -> DSRow(Icons.Outlined.Mic, r.name, if (r.hasWordTiming) "كلمة بكلمة" else null, iconStyle = if (Store.reciter == r.id) IconStyle.Brand else IconStyle.Soft, onClick = { Store.reciter = r.id; Store.save(); Recitation.useReciter(r.id); onPick() }) { if (Store.reciter == r.id) Icon(Icons.Filled.Check, null, Modifier.size(18.dp), tint = c.brandPrimary) } }
  }
}

/** بطاقة الختمة أو قراءتك: تقدّم، ورد اليوم، سلسلة الأيام */
@Composable fun KhatmahCard(onRead: (Int) -> Unit) {
  val c = DS.c; val plan = Store.khatmah; val today = Store.todayKey; val log = Store.readLog
  var show by remember { mutableStateOf(false) }
  val streak = Khatmah.streak(log, today)
  if (plan == null) {
    val st = Khatmah.stats(log, today)
    if (st.month > 0 || streak > 0) DSCard(Modifier.fillMaxWidth(), padding = 16.dp) {
      DSSectionHead("قراءتك", link = "خطة ختمة") { show = true }
      Spacer(Modifier.height(10.dp))
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { DSStatTile(Fmt.number(streak), "سلسلة الأيام", Modifier.weight(1f)); DSStatTile(Fmt.number(st.week), "صفحات الأسبوع", Modifier.weight(1f)); DSStatTile(Fmt.number(st.month), "صفحات الشهر", Modifier.weight(1f)) }
    }
  } else {
    val cur = Store.lastRead?.page ?: plan.startPage; val stt = Khatmah.status(plan, cur, log, today)
    DSCard(Modifier.fillMaxWidth(), padding = 16.dp) {
      DSSectionHead(if (stt.finished) "تقبّل الله ✦ أتممت الختمة" else "خطة الختمة · ${Fmt.number(plan.days)} يومًا", link = "تعديل") { show = true }
      Spacer(Modifier.height(10.dp))
      ProgressTrack(stt.percent / 100f, tint = c.accentGold, track = c.bgSubtle)
      Spacer(Modifier.height(10.dp))
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { DSStatTile("${Fmt.number(stt.percent)}٪", "${Fmt.number(stt.done)} من ٦٠٤", Modifier.weight(1f)); DSStatTile("${Fmt.number(stt.todayPages)}/${Fmt.number(stt.todayTarget)}", "ورد اليوم", Modifier.weight(1f)); DSStatTile(Fmt.number(streak), "سلسلة الأيام", Modifier.weight(1f)) }
      Spacer(Modifier.height(10.dp))
      Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) { Text(if (stt.behind > 0) "متأخّر ${Fmt.number(stt.behind)} صفحة" else "على الجدول ✓", style = DSType.labelSm, color = if (stt.behind > 0) c.danger else c.success); Spacer(Modifier.weight(1f)); DSButton(if (stt.todayPages >= stt.todayTarget) "تابع" else "اقرأ ورد اليوم", kind = ButtonKind.Soft, icon = Icons.Filled.PlayArrow) { onRead(cur) } }
    }
  }
  if (show) KhatmahDialog { show = false }
}
@Composable fun KhatmahDialog(onDismiss: () -> Unit) {
  val ctx = LocalContext.current
  var days by remember { mutableIntStateOf(Store.khatmah?.days ?: 30) }; var fromCurrent by remember { mutableStateOf(true) }
  AlertDialog(onDismissRequest = onDismiss, title = { Text(if (Store.khatmah == null) "خطة الختمة" else "تعديل خطة الختمة") }, text = {
    Column { Row { listOf(30, 60, 90, 120).forEach { d -> FilterChip(days == d, { days = d }, { Text(Fmt.number(d)) }, Modifier.padding(end = 4.dp)) } }; Text("≈ ${Fmt.number(Math.ceil(604.0 / days).toInt())} صفحات يوميًا"); Row { FilterChip(fromCurrent, { fromCurrent = true }, { Text("من موضعي") }, Modifier.padding(end = 4.dp)); FilterChip(!fromCurrent, { fromCurrent = false }, { Text("من الفاتحة") }) } }
  }, confirmButton = { TextButton(onClick = { Store.khatmah = KhatmahPlan.make(if (fromCurrent) (Store.lastRead?.page ?: 1) else 1, Store.todayKey, days); Store.save(); Notify.schedule(ctx); onDismiss() }) { Text("حفظ") } },
    dismissButton = { if (Store.khatmah != null) TextButton(onClick = { Store.khatmah = null; Store.save(); onDismiss() }) { Text("إنهاء الخطة") } else TextButton(onClick = onDismiss) { Text("إلغاء") } })
}

@OptIn(ExperimentalMaterial3Api::class)

/** القارئ: تقليب أفقي من اليمين، شريط علوي (سورة/جزء وأزرار)، مشغّل عائم، لوحة الحفظ، وشريط سفلي بأزرار الصفحة والتنقّل */
@Composable fun MushafReader(startPage: Int, startAyah: Int?, onClose: () -> Unit) {
  val ctx = LocalContext.current; val scope = rememberCoroutineScope(); val c = DS.c
  val pager = rememberPagerState(initialPage = startPage - 1) { 604 }
  var chrome by remember { mutableStateOf(true) }; var selected by remember { mutableStateOf<Int?>(startAyah) }
  var sheet by remember { mutableStateOf<String?>(null) }; var ayahSheet by remember { mutableStateOf<Ayah?>(null) }
  var hifz by remember { mutableStateOf<HifzSession?>(null) } // جلسة مراجعة الحفظ أو الإخفاء (null = لا شيء)
  var downloads by remember { mutableStateOf(false) }
  val dark = isSystemInDarkTheme()
  val theme = Store.effectiveTheme(dark); val paper = hex(theme.paper); val ink = hex(theme.ink)
  val page = pager.currentPage + 1
  LaunchedEffect(page) { QuranText.shared.pageAyahs(page).firstOrNull()?.let { Store.remember(it) }; hifz?.let { h -> if (h.page != page) { h.stopSpeech(); hifz = null } }; kotlinx.coroutines.delay(8000); if (pager.currentPage + 1 == page) { Store.readLog = Khatmah.log(Store.readLog, Store.todayKey, page); Store.save() } }
  LaunchedEffect(startAyah) { if (startAyah != null) { kotlinx.coroutines.delay(1600); if (selected == startAyah) selected = null } }
  LaunchedEffect(Recitation.current) { val n = Recitation.current ?: return@LaunchedEffect; val a = QuranText.shared.ayah(n) ?: return@LaunchedEffect; if (Store.follow && hifz == null && a.page != pager.currentPage + 1) pager.scrollToPage(a.page - 1) }
  DisposableEffect(Unit) { onDispose { hifz?.stopSpeech() } }
  BackHandler { if (sheet != null) sheet = null else onClose() }
  val first = QuranText.shared.pageAyahs(page).firstOrNull()
  fun playPage() { first?.let { Recitation.reciter = Store.reciter; Recitation.repeatAyah = Store.repeatAyah; Recitation.repeatRange = Store.repeatRange; Recitation.words = Store.wordHighlight; Recitation.play(ctx, QuranText.shared.pageAyahs(page).map { a -> a.n }) } }
  // الشريطان: يظهران لحظة ثم ينزلقان، ولا يعلوان النصّ أبدًا — الصفحة تنكمش بينهما
  var chromeNonce by remember { mutableIntStateOf(0) }
  var lastPage by remember { mutableIntStateOf(startPage) }
  fun showChrome() { chrome = true; chromeNonce++ }
  LaunchedEffect(page) { if (page != lastPage) { lastPage = page; chrome = false } }
  var hint by remember { mutableStateOf(false) }
  LaunchedEffect(chrome, chromeNonce, sheet, ayahSheet, downloads, hifz) {
    if (chrome && hifz == null && sheet == null && ayahSheet == null && !downloads) {
      kotlinx.coroutines.delay(3600); chrome = false
      // مرة واحدة في عمر التطبيق: تعريف بمكان المفتاح كي لا يبحث عنه القارئ
      if (!Store.seenChromeHint) { Store.seenChromeHint = true; Store.save(); hint = true; kotlinx.coroutines.delay(3500); hint = false }
    }
  }

  Column(Modifier.fillMaxSize().background(paper).statusBarsPadding().navigationBarsPadding()) {
    AnimatedVisibility(chrome, enter = slideInVertically { -it } + fadeIn(), exit = slideOutVertically { -it } + fadeOut()) {
      Row(Modifier.fillMaxWidth().background(paper).padding(horizontal = 6.dp, vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
        BarButton(Icons.Filled.ChevronRight, "إغلاق المصحف", ink, onClose)
        val l = QuranText.shared.label(page)
        Column(Modifier.weight(1f)) {
          Text(l?.let { "سورة ${QuranMeta.surah(it.surah).name}" } ?: "", style = DSType.headingSm, color = ink, maxLines = 1)
          Text(l?.let { val su = QuranMeta.surah(it.surah); "${QuranMeta.juzName(it.juz, false)} · الحزب ${Fmt.number(it.hizb)} · ${su.type} · ${Fmt.number(su.ayahs)} آية" } ?: "", style = DSType.labelXs, color = ink.copy(alpha = 0.6f), maxLines = 1)
        }
        BarButton(if (Store.bookmarks.any { it.page == page }) Icons.Filled.Bookmark else Icons.Outlined.BookmarkBorder, "علامة", ink) { chromeNonce++; first?.let { Store.toggleBookmark(it) } }
        BarButton(Icons.Outlined.FormatSize, "العرض والخط", ink) { sheet = "display" }
        BarButton(Icons.Outlined.List, "الفهرس", ink) { sheet = "index" }
        BarButton(Icons.Filled.MoreVert, "خيارات", ink) { sheet = "options" }
      }
    }

    Box(Modifier.weight(1f).fillMaxWidth()) {
      HorizontalPager(pager, Modifier.fillMaxSize(), beyondViewportPageCount = 1, key = { it }) { i ->
        val p = i + 1
        Box(Modifier.fillMaxSize().clickable(indication = null, interactionSource = remember { MutableInteractionSource() }) { val h = hifz; if (h != null) { if (h.veil) h.revealAyah() else h.hint() } else if (chrome) chrome = false else showChrome() }) {
          if (Store.view == "text") TextPage(p, ink, paper, selected, hifz) { a -> selected = a.n; ayahSheet = a } else MushafPage(p, ink, paper, selected, hifz) { a -> selected = a.n; ayahSheet = a }
        }
      }
      // في الوضع الغامر: حافّتان تستقبلان النقر والسحب بعيدًا عن الكلمات
      if (!chrome && hifz == null) {
        Box(
          Modifier.align(Alignment.TopCenter).fillMaxWidth().height(30.dp)
            .clickable(indication = null, interactionSource = remember { MutableInteractionSource() }) { showChrome() }
            .pointerInput(Unit) { detectVerticalDragGestures { _, dy -> if (dy > 3f) showChrome() } }
        )
        Column(
          Modifier.align(Alignment.BottomCenter).fillMaxWidth()
            .clickable(indication = null, interactionSource = remember { MutableInteractionSource() }) { showChrome() }
            .pointerInput(Unit) { detectVerticalDragGestures { _, dy -> if (dy < -3f) showChrome() } },
          horizontalAlignment = Alignment.CenterHorizontally
        ) {
          JuzHairline(page, ink)
          Spacer(Modifier.height(18.dp))
        }
      }
      if (hint && hifz == null) Text("اسحب من حافة الشاشة أو انقرها لإظهار الشريطين", Modifier.align(Alignment.BottomCenter).padding(bottom = 34.dp).clip(CircleShape).background(c.bgInverse.copy(alpha = 0.9f)).padding(horizontal = 16.dp, vertical = 10.dp), style = DSType.labelMd, color = c.bgCanvas)
      if (hifz != null && !chrome) Text(if (hifz!!.veil) "انقر الصفحة لكشف الآية التالية" else "انقر الصفحة لكشف الكلمة التالية", Modifier.align(Alignment.BottomCenter).padding(bottom = 24.dp).clip(CircleShape).background(c.bgInverse.copy(alpha = 0.9f)).padding(horizontal = 16.dp, vertical = 10.dp), style = DSType.labelMd, color = c.bgCanvas)
    }

    Column(Modifier.fillMaxWidth()) {
      hifz?.let { h -> HifzPanel(h, onExit = { h.stopSpeech(); hifz = null }, onNextPage = { if (page < 604) { val veil = h.veil; scope.launch { pager.scrollToPage(page); kotlinx.coroutines.delay(400); QuranText.shared.pageAyahs(page + 1).firstOrNull()?.let { a -> hifz = HifzSession(page + 1, a.n, veil) } } } }) }
      if (Recitation.current != null) Box(Modifier.padding(horizontal = 12.dp, vertical = 6.dp)) { AudioBar() }
      AnimatedVisibility(chrome && hifz == null, enter = slideInVertically { it } + fadeIn(), exit = slideOutVertically { it } + fadeOut()) {
        Column(Modifier.fillMaxWidth().background(paper).padding(horizontal = 14.dp, vertical = 2.dp)) {
          Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            BarButton(Icons.Outlined.PlayCircle, "تشغيل تلاوة الصفحة", ink) { chromeNonce++; playPage() }
            BarButton(Icons.Outlined.Mic, "مراجعة الحفظ", ink) { first?.let { Recitation.stop(); hifz = HifzSession(page, it.n, veil = false) } }
            BarButton(Icons.Outlined.VisibilityOff, "إخفاء الآيات للحفظ", ink) { first?.let { Recitation.stop(); hifz = HifzSession(page, it.n, veil = true) } }
            BarButton(Icons.Outlined.Search, "التنقل والبحث", ink) { sheet = "nav" }
            Spacer(Modifier.weight(1f))
            Text(Fmt.number(page), style = DSType.numericSm, color = ink.copy(alpha = 0.85f))
            Spacer(Modifier.weight(1f))
            BarButton(Icons.Outlined.Download, "التلاوات دون اتصال", ink) { downloads = true }
          }
          Slider(page.toFloat(), { v -> chromeNonce++; lastPage = v.toInt(); scope.launch { pager.scrollToPage(v.toInt() - 1) } }, Modifier.height(24.dp), valueRange = 1f..604f, colors = SliderDefaults.colors(thumbColor = c.accentGold, activeTrackColor = c.accentGold, inactiveTrackColor = ink.copy(alpha = 0.15f)))
        }
      }
    }
  }
  ayahSheet?.let { a -> AyahSheet(a, onDismiss = { ayahSheet = null; selected = null }, onHifz = { ayahSheet = null; selected = null; Recitation.stop(); hifz = HifzSession(page, a.n, veil = false) }) }
  if (downloads) ModalBottomSheet(onDismissRequest = { downloads = false }, containerColor = c.bgSurface) { DownloadsSheet(first?.surah) }
  when (sheet) {
    "index", "nav" -> ModalBottomSheet(onDismissRequest = { sheet = null }, containerColor = c.bgSurface) { IndexSheet(page) { p, n -> sheet = null; lastPage = p; scope.launch { pager.scrollToPage(p - 1) }; if (n != null) selected = n } }
    "display" -> ModalBottomSheet(onDismissRequest = { sheet = null }, containerColor = c.bgSurface) { DisplaySheet() }
    "options" -> ModalBottomSheet(onDismissRequest = { sheet = null }, containerColor = c.bgSurface) { Column { PlaybackOptions(); OptionsSheet(page) { sheet = null } } }
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
@Composable private fun BarButton(icon: ImageVector, label: String, tint: Color, onClick: () -> Unit) {
  Icon(icon, label, Modifier.size(34.dp).clip(CircleShape).clickable(role = Role.Button, onClick = onClick).padding(8.dp), tint = tint)
}
/** خيارات التلاوة والمراجعة (تظهر فوق خيارات المصحف) */
@Composable fun PlaybackOptions() {
  Column(Modifier.padding(horizontal = 16.dp)) {
    RowSwitch("متابعة التلاوة بقلب الصفحات", Store.follow) { Store.follow = it; Store.save() }
    RowSwitch("تظليل الكلمة أثناء التلاوة (قرّاء quran.com)", Store.wordHighlight) { Store.wordHighlight = it; Store.save(); Recitation.useWordTiming(it) }
    RowSwitch("تكرار المقطع", Store.repeatRange) { Store.repeatRange = it; Store.save(); Recitation.repeatRange = it }
    RowSwitch("في المراجعة: إظهار الكلمة الحالية فقط", Store.hifzOnlyCurrent) { Store.hifzOnlyCurrent = it; Store.save() }
  }
}

/** صفحة بخط صفحتها: 15 سطرًا، كل كلمة عنصر (نقر)، حجم الخط من العرض ÷ 14.85 مع تصحيح بالقياس */
@Composable fun MushafPage(p: Int, ink: Color, paper: Color, selected: Int?, hifz: HifzSession?, onTap: (Ayah) -> Unit) {
  val family = Fonts.page(p); val lines = MushafLayout.shared.lines(p); val measurer = rememberTextMeasurer(); val density = LocalDensity.current
  val label = QuranText.shared.label(p)
  BoxWithConstraints(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(horizontal = 12.dp, vertical = 8.dp)) {
    val wPx = with(density) { maxWidth.toPx() }; val hPx = with(density) { (maxHeight - 60.dp).toPx() }
    val sizePx = remember(p, wPx, hPx, family) {
      var s = wPx / 14.85f
      val rowH = hPx / 15f; if (rowH < s * 1.12f) s = rowH / 1.12f
      if (family != null) { val maxW = lines.maxOf { l -> val ws = l.wordList; if (ws.isEmpty()) 0f else measurer.measure(AnnotatedString(ws.joinToString("") { it.glyph }), TextStyle(fontFamily = family, fontSize = with(density) { s.toSp() }), softWrap = false, maxLines = 1).size.width.toFloat() }; if (maxW > wPx + 0.5f) s *= wPx / maxW }
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
                    val bg = if (hidden) ink.copy(alpha = 0.08f) else if (playingWord) Gold.copy(alpha = 0.38f) else if (selected == w.n || Recitation.current == w.n) Teal.copy(alpha = 0.18f) else Color.Transparent
                    Text(w.glyph, fontFamily = family, fontSize = fontSize, color = col, maxLines = 1, softWrap = false,
                      modifier = Modifier.background(bg, RoundedCornerShape(3.dp)).then(if (cur) Modifier.border(1.dp, ink.copy(alpha = 0.3f), RoundedCornerShape(3.dp)) else Modifier).clickable(indication = null, interactionSource = remember { MutableInteractionSource() }) { if (a != null && hifz == null) onTap(a) })
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
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) { if (f != null) Text("%03d surah".format(surah), fontFamily = f, fontSize = fontSize * 0.86, color = ink, maxLines = 1) else Text("سورة ${QuranMeta.surah(surah).name}", fontFamily = Fonts.amiri, fontSize = fontSize * 0.9, color = ink) }
  }
}

/** وضع النص المتدفق: أميري قرآن أو حفص، التجويد الملوّن، حجم قابل للتغيير */
@OptIn(ExperimentalLayoutApi::class)
@Composable fun TextPage(p: Int, ink: Color, paper: Color, selected: Int?, hifz: HifzSession?, onTap: (Ayah) -> Unit) {
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
            val bg = if (hidden) ink.copy(alpha = 0.08f) else if (playingWord) Gold.copy(alpha = 0.38f) else if (selected == a.n || Recitation.current == a.n) Teal.copy(alpha = 0.18f) else Color.Transparent
            Text(styled, fontFamily = family, fontSize = if (t.spoken) size else size * 0.75, lineHeight = size * 2.05, color = if (hidden) Color.Transparent else if (t.spoken) ink else Gold,
              modifier = Modifier.background(bg, RoundedCornerShape(3.dp)).then(if (cur) Modifier.border(1.dp, ink.copy(alpha = 0.3f), RoundedCornerShape(3.dp)) else Modifier).clickable(indication = null, interactionSource = remember { MutableInteractionSource() }) { if (hifz == null) onTap(a) })
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


/** قائمة الآية (تصميم 04): معاينة على ورق وشبكة إجراءات بأقراص أيقونات، مع التفسير الميسّر داخليًا */
@OptIn(ExperimentalMaterial3Api::class)
@Composable fun AyahSheet(a: Ayah, onDismiss: () -> Unit, onHifz: () -> Unit = {}) {
  val ctx = LocalContext.current; val c = DS.c
  var tafsir by remember { mutableStateOf(false) }
  val l = QuranText.shared.label(a.page)
  val txt = "${a.text} ﴿${a.ayah}﴾\n[${QuranSearch.refLabel(a)}]"
  @Composable fun RowScope.act(icon: ImageVector, title: String, sub: String, gold: Boolean = false, onClick: () -> Unit) {
    Row(Modifier.weight(1f).clip(DS.shapeLg).background(c.bgSubtle).clickable(onClick = onClick).padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
      DSIconButton(icon, style = if (gold) IconStyle.GoldSoft else IconStyle.Soft, size = 40.dp, iconSize = 17.dp); Spacer(Modifier.width(10.dp))
      Column { Text(title, style = DSType.labelMd, color = c.textPrimary, maxLines = 1); if (sub.isNotEmpty()) Text(sub, style = DSType.labelXs, color = c.textSecondary, maxLines = 1) }
    }
  }
  ModalBottomSheet(onDismissRequest = onDismiss, containerColor = c.bgSurface) {
    Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 24.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
      Column { Text(QuranSearch.refLabel(a), style = DSType.headingMd, color = c.textPrimary); Text("الصفحة ${Fmt.number(a.page)}${l?.let { " · الجزء ${Fmt.number(it.juz)}" } ?: ""}", style = DSType.labelXs, color = c.textSecondary) }
      Text("${a.text} ﴿${Fmt.number(a.ayah)}﴾", Modifier.fillMaxWidth().clip(DS.shapeLg).background(c.paperPage).border(1.dp, c.borderSubtle, DS.shapeLg).padding(horizontal = 16.dp, vertical = 10.dp), style = DSType.quranInline.copy(fontSize = 20.sp, lineHeight = 40.sp), color = c.paperInk, textAlign = TextAlign.Center)
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { act(Icons.Outlined.MenuBook, "التفسير الميسّر", "مضمّن") { tafsir = !tafsir }; act(Icons.Outlined.Headphones, "الاستماع", "من هذه الآية") { Recitation.reciter = Store.reciter; Recitation.repeatAyah = Store.repeatAyah; Recitation.repeatRange = Store.repeatRange; Recitation.words = Store.wordHighlight; Recitation.play(ctx, QuranText.shared.surahAyahs(a.surah).filter { it.n >= a.n }.map { it.n }); onDismiss() } }
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { act(if (Store.isBookmarked(a)) Icons.Filled.Bookmark else Icons.Outlined.BookmarkBorder, if (Store.isBookmarked(a)) "إزالة العلامة" else "علامة", "على هذه الآية") { Store.toggleBookmark(a); onDismiss() }; act(Icons.Outlined.Image, "مشاركة صورةً", "٤ سمات") { ShareCard.share(ctx, ShareCard.render(ctx, "القرآن الكريم · ${QuranSearch.refLabel(a)}", "${a.text} ﴿${a.ayah}﴾", QuranSearch.refLabel(a), true), "ayah-${a.surah}-${a.ayah}.png", txt) } }
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { act(Icons.Outlined.Mic, "مراجعة الحفظ", "من هنا", gold = true, onClick = onHifz); act(Icons.Outlined.CheckCircle, "موضع القراءة", "احفظ هنا") { Store.remember(a); onDismiss() } }
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { act(Icons.Outlined.ContentCopy, "نسخ النص", "مع المرجع") { (ctx.getSystemService(android.content.ClipboardManager::class.java)).setPrimaryClip(android.content.ClipData.newPlainText("آية", txt)); onDismiss() }; act(Icons.Outlined.Share, "مشاركة نصًا", "") { ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, txt), "مشاركة")) } }
      if (tafsir) { val html = Tafsir.text(a.surah, a.ayah); Text(buildAnnotatedString { for (r in Tafsir.runs(html ?: "لا تفسير")) if (r.bold) withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = c.brandPrimary)) { append(r.text) } else append(r.text) }, style = DSType.readingMd, color = c.textPrimary); Text("التفسير الميسّر — مجمع الملك فهد", style = DSType.labelXs, color = c.textSecondary) }
    }
  }
}
/** المشغّل المصغّر (تصميم 03): تقدّم رفيع، تشغيل، القارئ والكلمة الجارية، سابق/تالي/إغلاق؛ النقر يفتح المشغّل الكامل */
@Composable fun AudioBar() {
  val ctx = LocalContext.current; val c = DS.c
  var expanded by remember { mutableStateOf(false) }
  val a = Recitation.currentAyah ?: return
  Column(Modifier.fillMaxWidth().shadow(if (c.isDark) 0.dp else 14.dp, DS.shapeXl, ambientColor = c.shadow.copy(alpha = 0.16f), spotColor = c.shadow.copy(alpha = 0.2f)).clip(DS.shapeXl).background(c.bgSurface)) {
    ProgressTrack(if (Recitation.duration > 0) (Recitation.position / Recitation.duration).toFloat() else 0f, tint = c.brandPrimary, track = c.borderSubtle, height = 3.dp)
    Row(Modifier.padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
      DSIconButton(if (Recitation.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow, style = IconStyle.Brand, size = 44.dp, iconSize = 20.dp, contentDescription = "تشغيل/إيقاف", onClick = { Recitation.toggle() })
      Spacer(Modifier.width(8.dp))
      Column(Modifier.weight(1f).clickable { expanded = true }) {
        Text(Catalog.shared.reciter(Recitation.reciter).name, style = DSType.labelMd, color = c.textPrimary, maxLines = 1)
        Row(verticalAlignment = Alignment.CenterVertically) {
          Text("${Recitation.label()} · ${Fmt.number(Recitation.index + 1)}/${Fmt.number(Recitation.queue.size)}${if (Recitation.loading) " · جارٍ التحميل…" else ""}", style = DSType.labelXs, color = c.textSecondary, maxLines = 1)
          val w = Recitation.currentWord; val words = a.text.split(" ")
          if (w != null && Recitation.hasWords && w in 1..words.size) { Spacer(Modifier.width(6.dp)); Text(words[w - 1], Modifier.clip(RoundedCornerShape(6.dp)).background(c.brandPrimary).padding(horizontal = 6.dp, vertical = 1.dp), style = DSType.quranInline.copy(fontSize = 13.sp, lineHeight = 18.sp), color = c.textOnBrand) }
        }
      }
      DSIconButton(Icons.Filled.SkipPrevious, style = IconStyle.Plain, size = 36.dp, iconSize = 18.dp, contentDescription = "السابقة", onClick = { Recitation.prev(ctx) })
      DSIconButton(Icons.Filled.SkipNext, style = IconStyle.Plain, size = 36.dp, iconSize = 18.dp, contentDescription = "التالية", onClick = { Recitation.next(ctx) })
      DSIconButton(Icons.Filled.Close, style = IconStyle.Plain, size = 36.dp, iconSize = 16.dp, contentDescription = "إغلاق", onClick = { Recitation.stop() })
    }
    Recitation.error?.let { Text(if (it == "network") "تعذّر تحميل التلاوة — تحقق من الاتصال" else "هذه التلاوة غير متاحة من هذا القارئ", Modifier.padding(horizontal = 14.dp, vertical = 4.dp), style = DSType.labelXs, color = c.danger) }
  }
  if (expanded) PlayerSheet { expanded = false }
}
/** المشغّل الكامل (تصميم 05): خلفية الليل، القارئ، الآية بكلمتها الجارية، موجة، تحكّم، شرائح الخيارات */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable fun PlayerSheet(onDismiss: () -> Unit) {
  val ctx = LocalContext.current; val c = DS.c
  var reciters by remember { mutableStateOf(false) }; var downloads by remember { mutableStateOf(false) }
  val bars = listOf(8, 14, 22, 30, 18, 26, 34, 20, 12, 28, 36, 24, 16, 30, 22, 14, 26, 32, 18, 10, 24, 34, 28, 16, 20, 30, 12, 22, 26, 18, 32, 24, 14, 28, 20, 10, 16, 24, 30, 18)
  val a = Recitation.currentAyah
  val frac = if (Recitation.duration > 0) (Recitation.position / Recitation.duration).toFloat().coerceIn(0f, 1f) else 0f
  fun t(v: Double): String { val s = maxOf(0, v.toInt()); return "${Fmt.number(s / 60)}:${if (s % 60 < 10) Fmt.number(0) else ""}${Fmt.number(s % 60)}" }
  ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = Color(0xFF0E5C55), dragHandle = null) {
    Column(Modifier.fillMaxWidth().fillMaxHeight(0.96f).background(Brush.verticalGradient(listOf(Color(0xFF0E5C55), Color(0xFF061716)))).padding(horizontal = 20.dp, vertical = 12.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
      Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) { DSIconButton(Icons.Filled.KeyboardArrowDown, style = IconStyle.Glass, size = 40.dp, iconSize = 18.dp, contentDescription = "إغلاق", onClick = onDismiss); Spacer(Modifier.weight(1f)); Text("التلاوة الآن", style = DSType.labelMd, color = c.textOnDarkMuted); Spacer(Modifier.weight(1f)); DSIconButton(Icons.Outlined.Download, style = IconStyle.Glass, size = 40.dp, iconSize = 18.dp, contentDescription = "التنزيلات", onClick = { downloads = true }) }
      Spacer(Modifier.height(8.dp))
      Box(Modifier.size(132.dp), contentAlignment = Alignment.Center) { Canvas(Modifier.matchParentSize()) { drawCircle(Color(0xFFC69C3E).copy(alpha = 0.8f), style = androidx.compose.ui.graphics.drawscope.Stroke(2.dp.toPx())); drawCircle(Color.White.copy(alpha = 0.12f), radius = 56.dp.toPx()) }; Text(Catalog.shared.reciter(Recitation.reciter).name.take(1), style = DSType.displayHero, color = c.accentGold) }
      Text(Catalog.shared.reciter(Recitation.reciter).name, Modifier.clickable { reciters = true }, style = DSType.displayMd, color = c.textOnDark, textAlign = TextAlign.Center)
      if (a != null) Text("سورة ${QuranMeta.surah(a.surah).name} · الآية ${Fmt.number(a.ayah)} من ${Fmt.number(QuranMeta.surah(a.surah).ayahs)}${if (Recitation.hasWords) " · كلمة بكلمة" else ""}", style = DSType.labelSm, color = c.textOnDarkMuted)
      Spacer(Modifier.height(8.dp))
      if (a != null) Column(Modifier.fillMaxWidth().clip(DS.shapeXl).background(Color.White.copy(alpha = 0.08f)).padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        val words = a.text.split(" "); val cur = if (Recitation.hasWords) Recitation.currentWord?.minus(1) else null
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(4.dp)) {
          words.forEachIndexed { i, w -> Text(w, Modifier.clip(RoundedCornerShape(8.dp)).background(if (cur == i) c.accentGold else Color.Transparent).padding(horizontal = if (cur == i) 8.dp else 0.dp, vertical = 2.dp), style = DSType.quranInline.copy(fontSize = 21.sp, lineHeight = 36.sp), color = if (cur == i) Color(0xFF16211F) else c.textOnDark) }
          Text("﴿${Fmt.number(a.ayah)}﴾", style = DSType.quranInline.copy(fontSize = 21.sp, lineHeight = 36.sp), color = c.accentGold)
        }
        Text(if (Recitation.hasWords) "تظليل الكلمة بتوقيتات quran.com" else "اختر قارئًا يدعم «كلمة بكلمة» لتظليل الكلمة الجارية", style = DSType.labelXs, color = c.textOnDarkMuted)
      }
      Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(Modifier.fillMaxWidth().height(40.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) { bars.forEachIndexed { i, h -> Box(Modifier.size(4.dp, h.dp).clip(CircleShape).background(if (i.toFloat() / bars.size < frac) c.accentGold else Color.White.copy(alpha = 0.35f))) } }
        Row(Modifier.fillMaxWidth()) { Text(t(Recitation.position), style = DSType.labelXs, color = c.textOnDarkMuted); Spacer(Modifier.weight(1f)); Text(t(Recitation.duration), style = DSType.labelXs, color = c.textOnDarkMuted) }
      }
      Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(18.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
        Box { DSIconButton(Icons.Outlined.Repeat, style = IconStyle.Glass, size = 44.dp, iconSize = 18.dp, contentDescription = "تكرار الآية", onClick = { val o = listOf(1, 2, 3, 5, 10); val nx = o[((o.indexOf(Recitation.repeatAyah).coerceAtLeast(0)) + 1) % o.size]; Recitation.repeatAyah = nx; Store.repeatAyah = nx; Store.save() }); if (Recitation.repeatAyah > 1) Box(Modifier.align(Alignment.TopEnd)) { DSBadge("×${Fmt.number(Recitation.repeatAyah)}", fg = Color(0xFF16211F), bg = c.accentGold) } }
        DSIconButton(Icons.Filled.SkipNext, style = IconStyle.Glass, size = 52.dp, iconSize = 24.dp, contentDescription = "التالية", onClick = { Recitation.next(ctx) })
        Box(Modifier.size(76.dp).shadow(16.dp, CircleShape, ambientColor = c.accentGold.copy(alpha = 0.35f), spotColor = c.accentGold.copy(alpha = 0.35f)).clip(CircleShape).background(c.accentGold).clickable { Recitation.toggle() }, contentAlignment = Alignment.Center) { Icon(if (Recitation.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow, "تشغيل/إيقاف", Modifier.size(32.dp), tint = Color(0xFF16211F)) }
        DSIconButton(Icons.Filled.SkipPrevious, style = IconStyle.Glass, size = 52.dp, iconSize = 24.dp, contentDescription = "السابقة", onClick = { Recitation.prev(ctx) })
        DSIconButton(Icons.Outlined.Bedtime, style = IconStyle.Glass, size = 44.dp, iconSize = 18.dp, contentDescription = "مؤقت النوم", onClick = { val o = listOf(0, 15, 30, 45, 60); val cur = Recitation.sleepMinutesLeft ?: 0; val nx = o[((o.indexOfFirst { it >= cur }.coerceAtLeast(0)) + 1) % o.size]; Recitation.setSleep(nx) })
      }
      Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)) {
        GlassChip("السرعة ${Fmt.decimal(Store.rate, 2)}×", Icons.Outlined.Speed, on = Store.rate != 1.0) { val o = listOf(0.75, 1.0, 1.25, 1.5); Recitation.setRate(o[((o.indexOf(Store.rate).coerceAtLeast(0)) + 1) % o.size]) }
        GlassChip("تكرار المقطع", Icons.Outlined.RepeatOne, on = Recitation.repeatRange) { Recitation.repeatRange = !Recitation.repeatRange; Store.repeatRange = Recitation.repeatRange; Store.save() }
        GlassChip(Recitation.sleepMinutesLeft?.let { "نوم ${Fmt.number(it)} د" } ?: "مؤقت النوم", Icons.Outlined.Bedtime, on = Recitation.sleepAt != null) { val o = listOf(0, 15, 30, 45, 60); val cur = Recitation.sleepMinutesLeft ?: 0; Recitation.setSleep(o[((o.indexOfFirst { it >= cur }.coerceAtLeast(0)) + 1) % o.size]) }
        GlassChip("القارئ", Icons.Outlined.Mic) { reciters = true }
      }
      Spacer(Modifier.navigationBarsPadding())
    }
  }
  if (reciters) ModalBottomSheet(onDismissRequest = { reciters = false }, containerColor = c.bgSurface) { ReciterList { reciters = false } }
  if (downloads) ModalBottomSheet(onDismissRequest = { downloads = false }, containerColor = c.bgSurface) { DownloadsSheet(a?.surah) }
}
@Composable fun IndexSheet(current: Int, onGo: (Int, Int?) -> Unit) {
  var q by remember { mutableStateOf("") }; var tab by remember { mutableIntStateOf(0) }
  Column(Modifier.fillMaxHeight(0.9f).padding(horizontal = 12.dp)) {
    OutlinedTextField(q, { q = it }, Modifier.fillMaxWidth(), placeholder = { Text("سورة، آية، نص، أو رقم صفحة…") }, singleLine = true)
    if (q.isBlank()) {
      TabRow(tab) { listOf("السور", "الأجزاء", "الأحزاب").forEachIndexed { i, t -> Tab(tab == i, { tab = i }, text = { Text(t) }) } }
      LazyColumn { when (tab) {
        0 -> items(QuranMeta.surahs) { s -> SurahRow(s) { onGo(s.page, QuranText.shared.ayah(s.n, 1)?.n) } }
        1 -> items(QuranMeta.juzStarts) { j -> ListItem(headlineContent = { Text(QuranMeta.juzName(j.juz, false)) }, supportingContent = { Text("${QuranMeta.surah(j.surah).name} · آية ${Fmt.number(j.ayah)} · ص ${Fmt.number(j.page)}") }, modifier = Modifier.clickable { onGo(j.page, null) }) }
        else -> items((1..60).toList()) { hz -> val p = QuranText.shared.hizbStartPage(hz) ?: 1; ListItem(headlineContent = { Text("الحزب ${Fmt.number(hz)}") }, supportingContent = { Text("الجزء ${Fmt.number((hz + 1) / 2)} · ص ${Fmt.number(p)}") }, modifier = Modifier.clickable { onGo(p, null) }) }
      } }
    } else {
      val s = QuranNormalize.foldDigits(q.trim()); val page = s.toIntOrNull(); val ref = QuranSearch.parseRef(s)
      LazyColumn {
        if (page != null && page in 1..604) item { ListItem(headlineContent = { Text("الصفحة ${Fmt.number(page)}") }, modifier = Modifier.clickable { onGo(page, null) }) }
        else if (ref != null) { val a = QuranText.shared.ayah(ref.surah.n, minOf(ref.surah.ayahs, ref.ayah)); if (a != null) item { ListItem(headlineContent = { Text("سورة ${ref.surah.name} · آية ${Fmt.number(a.ayah)}") }, supportingContent = { Text("ص ${Fmt.number(a.page)}") }, modifier = Modifier.clickable { onGo(a.page, a.n) }) } }
        else { items(QuranSearch.matchSurahs(s)) { su -> SurahRow(su) { onGo(su.page, QuranText.shared.ayah(su.n, 1)?.n) } }; if (s.length >= 2) items(QuranSearch.shared.search(s, 20)) { a -> ListItem(headlineContent = { Text(a.text.take(80), fontFamily = Fonts.amiri, maxLines = 2, overflow = TextOverflow.Ellipsis) }, supportingContent = { Text(QuranSearch.refLabel(a)) }, modifier = Modifier.clickable { onGo(a.page, a.n) }) } }
      }
    }
  }
}
@Composable fun DisplaySheet() {
  Column(Modifier.padding(16.dp).verticalScroll(rememberScrollState())) {
    Text("لون الصفحة", fontWeight = FontWeight.Bold)
    for (g in Catalog.shared.themeGroups) {
      Text(g.name, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
      Row(Modifier.horizontalScroll(rememberScrollState())) { for (t in Catalog.shared.themes.filter { it.group == g.id }) { Column(Modifier.padding(end = 8.dp).clickable { Store.theme = t.id; Store.save() }, horizontalAlignment = Alignment.CenterHorizontally) { Box(Modifier.size(44.dp, 40.dp).background(hex(t.paper), RoundedCornerShape(8.dp)).border(if (Store.theme == t.id) 2.dp else 1.dp, if (Store.theme == t.id) Teal else Color.Gray.copy(alpha = 0.4f), RoundedCornerShape(8.dp)), contentAlignment = Alignment.Center) { Text("ق", fontFamily = Fonts.amiri, color = hex(t.ink), fontSize = 20.sp) }; Text(t.name, fontSize = 10.sp) } } }
    }
    RowSwitch("الوضع الليلي يتبع النظام", Store.themeAuto) { Store.themeAuto = it; Store.save() }
    RowSwitch("إبقاء الشاشة مضاءة", Store.keepAwake) { Store.keepAwake = it; Store.save() }
    Text("طريقة العرض", fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 12.dp))
    Row { FilterChip(Store.view == "pages", { Store.view = "pages"; Store.save() }, { Text("صفحات المصحف") }, Modifier.padding(end = 6.dp)); FilterChip(Store.view == "text", { Store.view = "text"; Store.save() }, { Text("نص متدفق") }) }
    RowSwitch("التجويد الملوّن (وضع النص)", Store.tajweed) { Store.tajweed = it; if (it) Store.view = "text"; Store.save() }
    if (Store.view == "text") {
      Row(Modifier.padding(top = 8.dp)) { FilterChip(Store.textFont == "amiri", { Store.textFont = "amiri"; Store.save() }, { Text("أميري قرآن") }, Modifier.padding(end = 6.dp)); FilterChip(Store.textFont == "hafs", { Store.textFont = "hafs"; Store.save() }, { Text("حفص (مجمع الملك فهد)") }) }
      Row(verticalAlignment = Alignment.CenterVertically) { Text("حجم الخط ${Fmt.decimal(Store.fontScale, 1)}×", Modifier.weight(1f)); OutlinedButton(onClick = { Store.fontScale = maxOf(0.7, Store.fontScale - 0.1); Store.save() }) { Text("أ-") }; Spacer(Modifier.width(6.dp)); OutlinedButton(onClick = { Store.fontScale = minOf(1.8, Store.fontScale + 0.1); Store.save() }) { Text("أ+") } }
    }
    Spacer(Modifier.height(24.dp))
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
    RowSwitch("متابعة التلاوة بقلب الصفحات", Store.follow) { Store.follow = it; Store.save() }
    Text("الصفحات بخطوط مجمع الملك فهد لطباعة المصحف الشريف (مصحف المدينة، حفص عن عاصم) مطابقةً للمصحف المطبوع سطرًا بسطر. النص: Tanzil. التلاوات: Islamic Network.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 12.dp))
    Spacer(Modifier.height(24.dp))
  }
}
