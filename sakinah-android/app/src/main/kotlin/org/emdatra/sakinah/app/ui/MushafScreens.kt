package org.emdatra.sakinah.app.ui

import android.content.Intent
import androidx.activity.compose.BackHandler
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

/** شاشة المصحف: متابعة القراءة، بحث موحّد، السور، الأجزاء، العلامات */
@Composable fun MushafHome() {
  var reader by remember { mutableStateOf<Pair<Int, Int?>?>(null) }
  var q by remember { mutableStateOf("") }; var tab by remember { mutableIntStateOf(0) }
  if (reader != null) { MushafReader(startPage = reader!!.first, startAyah = reader!!.second, onClose = { reader = null }); return }
  val last = Store.lastRead
  LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
    item {
      Card(Modifier.fillMaxWidth().padding(top = 12.dp).clickable { reader = (last?.page ?: 1) to last?.let { QuranText.shared.ayah(it.surah, it.ayah)?.n } }) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
          Icon(if (last == null) Icons.Filled.MenuBook else Icons.Filled.Bookmark, null, tint = Teal, modifier = Modifier.size(36.dp)); Spacer(Modifier.width(12.dp))
          Column { Text(if (last == null) "ابدأ القراءة" else "متابعة القراءة", fontWeight = FontWeight.Bold, fontSize = 18.sp); Text(last?.let { "${QuranMeta.surah(it.surah).name} · آية ${Fmt.number(it.ayah)} · صفحة ${Fmt.number(it.page)}" } ?: "مصحف المدينة النبوية · حفص عن عاصم · ٦٠٤ صفحات", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp) }
        }
      }
    }
    item { KhatmahCard { p -> reader = p to null } }
    item { OutlinedTextField(q, { q = it }, Modifier.fillMaxWidth(), placeholder = { Text("ابحث عن سورة أو آية أو رقم صفحة…") }, singleLine = true) }
    if (q.isBlank()) {
      item { TabRow(selectedTabIndex = tab) { listOf("السور", "الأجزاء", "العلامات").forEachIndexed { i, t -> Tab(tab == i, { tab = i }, text = { Text(t) }) } } }
      when (tab) {
        0 -> items(QuranMeta.surahs) { s -> SurahRow(s) { reader = s.page to QuranText.shared.ayah(s.n, 1)?.n } }
        1 -> items(QuranMeta.juzStarts) { j -> ListItem(headlineContent = { Text(QuranMeta.juzName(j.juz, false)) }, supportingContent = { Text("يبدأ من ${QuranMeta.surah(j.surah).name}: ${Fmt.number(j.ayah)} · ص ${Fmt.number(j.page)}") }, leadingContent = { Text(Fmt.number(j.juz), fontWeight = FontWeight.Bold) }, modifier = Modifier.clickable { reader = j.page to null }) }
        else -> { if (Store.bookmarks.isEmpty()) item { Text("لا علامات بعد — انقر كلمة في المصحف ثم «علامة»", color = MaterialTheme.colorScheme.onSurfaceVariant) }
          items(Store.bookmarks.reversed()) { b -> val a = QuranText.shared.ayah(b.surah, b.ayah); if (a != null) ListItem(headlineContent = { Text("${QuranMeta.surah(a.surah).name}: ${Fmt.number(a.ayah)}") }, supportingContent = { Text(b.note ?: a.text.take(60)) }, leadingContent = { Icon(Icons.Filled.Bookmark, null, tint = Gold) }, trailingContent = { Text("ص ${Fmt.number(a.page)}") }, modifier = Modifier.clickable { reader = a.page to a.n }) } }
      }
    } else {
      val s = QuranNormalize.foldDigits(q.trim()); val page = s.toIntOrNull(); val ref = QuranSearch.parseRef(s)
      if (page != null && page in 1..604) item { ListItem(headlineContent = { Text("الانتقال إلى الصفحة ${Fmt.number(page)}") }, modifier = Modifier.clickable { reader = page to null }) }
      else if (ref != null) { val a = QuranText.shared.ayah(ref.surah.n, minOf(ref.surah.ayahs, ref.ayah)); if (a != null) item { ListItem(headlineContent = { Text("سورة ${ref.surah.name} — الآية ${Fmt.number(a.ayah)}") }, supportingContent = { Text("الصفحة ${Fmt.number(a.page)}") }, modifier = Modifier.clickable { reader = a.page to a.n }) } }
      else {
        items(QuranSearch.matchSurahs(s)) { su -> SurahRow(su) { reader = su.page to QuranText.shared.ayah(su.n, 1)?.n } }
        if (s.length >= 2) items(QuranSearch.shared.search(s, 30)) { a -> ListItem(headlineContent = { Text(a.text.take(90), fontFamily = Fonts.amiri, maxLines = 2, overflow = TextOverflow.Ellipsis) }, supportingContent = { Text(QuranSearch.refLabel(a)) }, trailingContent = { Text("ص ${Fmt.number(a.page)}") }, modifier = Modifier.clickable { reader = a.page to a.n }) }
      }
    }
    item { Spacer(Modifier.height(24.dp)) }
  }
}
@Composable fun SurahRow(s: Surah, onClick: () -> Unit) { ListItem(headlineContent = { Text(s.name, fontWeight = FontWeight.SemiBold) }, supportingContent = { Text("${s.type} · ${Fmt.number(s.ayahs)} آية · صفحة ${Fmt.number(s.page)}") }, leadingContent = { Text(Fmt.number(s.n), fontWeight = FontWeight.Bold, color = Gold) }, trailingContent = { Text(s.en, fontSize = 11.sp) }, modifier = Modifier.clickable(onClick = onClick)) }

@Composable fun KhatmahCard(onRead: (Int) -> Unit) {
  val plan = Store.khatmah; val today = Store.todayKey; val log = Store.readLog
  var show by remember { mutableStateOf(false) }
  val streak = Khatmah.streak(log, today)
  Card(Modifier.fillMaxWidth()) {
    Column(Modifier.padding(14.dp)) {
      if (plan == null) {
        val st = Khatmah.stats(log, today)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) { Text("قراءتك", fontWeight = FontWeight.Bold); TextButton(onClick = { show = true }) { Text("خطة ختمة") } }
        Text("سلسلة الأيام ${Fmt.number(streak)} · هذا الأسبوع ${Fmt.number(st.week)} صفحة · هذا الشهر ${Fmt.number(st.month)} صفحة", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
      } else {
        val cur = Store.lastRead?.page ?: plan.startPage; val stt = Khatmah.status(plan, cur, log, today)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) { Text(if (stt.finished) "تقبّل الله ✦ أتممت الختمة" else "خطة الختمة · ${Fmt.number(plan.days)} يومًا", fontWeight = FontWeight.Bold); TextButton(onClick = { show = true }) { Text("تعديل") } }
        LinearProgressIndicator({ stt.percent / 100f }, Modifier.fillMaxWidth(), color = Gold)
        Text("${Fmt.number(stt.percent)}٪ · ${Fmt.number(stt.done)} من ٦٠٤ · اليوم ${Fmt.number(stt.todayPages)}/${Fmt.number(stt.todayTarget)} · ${if (stt.behind > 0) "متأخّر ${Fmt.number(stt.behind)} صفحة" else "على الجدول ✓"} · سلسلة ${Fmt.number(streak)}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Button(onClick = { onRead(cur) }, Modifier.fillMaxWidth().padding(top = 6.dp)) { Text(if (stt.todayPages >= stt.todayTarget) "أكملت ورد اليوم — تابع" else "اقرأ ورد اليوم") }
      }
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

/** قارئ المصحف: صفحات المدينة بخطوطها أو نص متدفق، تقليب من اليمين، سمات، قائمة الآية، تلاوة، إخفاء للحفظ */
@OptIn(ExperimentalMaterial3Api::class)
@Composable fun MushafReader(startPage: Int, startAyah: Int?, onClose: () -> Unit) {
  val ctx = LocalContext.current; val scope = rememberCoroutineScope()
  val pager = rememberPagerState(initialPage = startPage - 1) { 604 }
  var chrome by remember { mutableStateOf(true) }; var selected by remember { mutableStateOf<Int?>(startAyah) }
  var sheet by remember { mutableStateOf<String?>(null) }; var ayahSheet by remember { mutableStateOf<Ayah?>(null) }
  var veilRevealed by remember { mutableStateOf<Set<Int>?>(null) } // null = بلا إخفاء؛ وإلا أرقام الآيات المكشوفة
  val dark = isSystemInDarkTheme()
  val theme = Store.effectiveTheme(dark); val paper = hex(theme.paper); val ink = hex(theme.ink)
  val page = pager.currentPage + 1
  LaunchedEffect(page) { QuranText.shared.pageAyahs(page).firstOrNull()?.let { Store.remember(it) }; if (veilRevealed != null) veilRevealed = emptySet(); kotlinx.coroutines.delay(8000); if (pager.currentPage + 1 == page) { Store.readLog = Khatmah.log(Store.readLog, Store.todayKey, page); Store.save() } }
  LaunchedEffect(startAyah) { if (startAyah != null) { kotlinx.coroutines.delay(1600); if (selected == startAyah) selected = null } }
  BackHandler { if (sheet != null) sheet = null else onClose() }
  Box(Modifier.fillMaxSize().background(paper)) {
    HorizontalPager(pager, Modifier.fillMaxSize(), beyondViewportPageCount = 1, key = { it }) { i ->
      val p = i + 1
      Box(Modifier.fillMaxSize().clickable(indication = null, interactionSource = remember { MutableInteractionSource() }) { if (veilRevealed != null) revealNext(p, veilRevealed!!) { veilRevealed = it } else chrome = !chrome }) {
        if (Store.view == "text") TextPage(p, ink, paper, selected, veilRevealed) { a -> selected = a.n; ayahSheet = a } else MushafPage(p, ink, paper, selected, veilRevealed) { a -> selected = a.n; ayahSheet = a }
      }
    }
    if (chrome) {
      Row(Modifier.align(Alignment.TopCenter).fillMaxWidth().background(MaterialTheme.colorScheme.surface.copy(alpha = 0.92f)).statusBarsPadding().padding(4.dp), verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = onClose) { Icon(Icons.Filled.Close, "إغلاق") }
        val l = QuranText.shared.label(page)
        Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) { Text(l?.let { "سورة ${QuranMeta.surah(it.surah).name}" } ?: "", fontWeight = FontWeight.Bold); Text(l?.let { QuranMeta.juzName(it.juz, false) } ?: "", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        IconButton(onClick = { sheet = "nav" }) { Icon(Icons.Filled.Search, "التنقل") }
        IconButton(onClick = { sheet = "display" }) { Icon(Icons.Filled.WbSunny, "العرض") }
        IconButton(onClick = { sheet = "options" }) { Icon(Icons.Filled.MoreVert, "خيارات") }
      }
      Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth().background(MaterialTheme.colorScheme.surface.copy(alpha = 0.92f)).navigationBarsPadding().padding(horizontal = 16.dp, vertical = 6.dp)) {
        if (Recitation.current != null) AudioBar()
        Row(horizontalArrangement = Arrangement.SpaceEvenly, modifier = Modifier.fillMaxWidth()) {
          val first = QuranText.shared.pageAyahs(page).firstOrNull()
          IconButton(onClick = { first?.let { Store.toggleBookmark(it) } }) { Icon(if (Store.bookmarks.any { it.page == page }) Icons.Filled.Bookmark else Icons.Filled.BookmarkBorder, "علامة") }
          IconButton(onClick = { first?.let { Recitation.reciter = Store.reciter; Recitation.repeatAyah = Store.repeatAyah; Recitation.play(ctx, QuranText.shared.pageAyahs(page).map { a -> a.n }) } }) { Icon(Icons.Filled.PlayCircle, "تشغيل الصفحة") }
          IconButton(onClick = { veilRevealed = if (veilRevealed == null) emptySet() else null }) { Icon(if (veilRevealed == null) Icons.Filled.VisibilityOff else Icons.Filled.Visibility, "إخفاء الآيات للحفظ") }
          IconButton(onClick = { sheet = "index" }) { Icon(Icons.Filled.List, "الفهرس") }
        }
        Slider(page.toFloat(), { v -> scope.launch { pager.scrollToPage(v.toInt() - 1) } }, valueRange = 1f..604f, steps = 0)
        Text("صفحة ${Fmt.number(page)} من ٦٠٤ · الجزء ${Fmt.number(QuranMeta.juzOfPage(page))}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
    }
    if (veilRevealed != null) Text("انقر الصفحة لكشف الآية التالية", Modifier.align(Alignment.BottomCenter).padding(bottom = if (chrome) 150.dp else 24.dp).background(MaterialTheme.colorScheme.surface.copy(alpha = 0.9f), RoundedCornerShape(20.dp)).padding(10.dp), fontSize = 13.sp)
  }
  ayahSheet?.let { a -> AyahSheet(a, onDismiss = { ayahSheet = null; selected = null }) }
  when (sheet) {
    "index", "nav" -> ModalBottomSheet(onDismissRequest = { sheet = null }) { IndexSheet(page) { p, n -> sheet = null; scope.launch { pager.scrollToPage(p - 1) }; if (n != null) selected = n } }
    "display" -> ModalBottomSheet(onDismissRequest = { sheet = null }) { DisplaySheet() }
    "options" -> ModalBottomSheet(onDismissRequest = { sheet = null }) { OptionsSheet(page) { sheet = null } }
  }
}
private fun revealNext(page: Int, revealed: Set<Int>, set: (Set<Int>) -> Unit) { val ayahs = QuranText.shared.pageAyahs(page).map { it.n }; val next = ayahs.firstOrNull { it !in revealed } ?: return; set(revealed + next) }

/** صفحة بخط صفحتها: 15 سطرًا، كل كلمة عنصر (نقر)، حجم الخط من العرض ÷ 14.85 مع تصحيح بالقياس */
@Composable fun MushafPage(p: Int, ink: Color, paper: Color, selected: Int?, veil: Set<Int>?, onTap: (Ayah) -> Unit) {
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
                    val a = QuranText.shared.ayah(w.n); val hidden = veil != null && w.n !in veil
                    val col = if (hidden) Color.Transparent else if (w.end) Gold else ink
                    Text(w.glyph, fontFamily = family, fontSize = fontSize, color = col, maxLines = 1, softWrap = false,
                      modifier = Modifier.background(if (hidden) ink.copy(alpha = 0.08f) else if (selected == w.n || Recitation.current == w.n) Teal.copy(alpha = 0.18f) else Color.Transparent, RoundedCornerShape(3.dp)).clickable(indication = null, interactionSource = remember { MutableInteractionSource() }) { if (a != null && veil == null) onTap(a) })
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
@Composable fun TextPage(p: Int, ink: Color, paper: Color, selected: Int?, veil: Set<Int>?, onTap: (Ayah) -> Unit) {
  val hafs = Store.textFont == "hafs"; val family = Fonts.text(Store.textFont); val dark = isSystemInDarkTheme()
  val ayahs = QuranText.shared.pageAyahs(p); val label = QuranText.shared.label(p)
  BoxWithConstraints(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(horizontal = 14.dp, vertical = 8.dp)) {
    val base = with(LocalDensity.current) { (maxWidth.toPx() / 14.85f).toSp() }; val size = base * 1.02 * Store.fontScale
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
      if (label != null) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("سُورَةُ ${QuranMeta.surah(label.surah).vocalized}", fontFamily = Fonts.amiri, color = ink.copy(alpha = 0.85f), fontSize = base * 0.66); Text(QuranMeta.juzName(label.juz), fontFamily = Fonts.amiri, color = ink.copy(alpha = 0.85f), fontSize = base * 0.66) }
      FlowRow(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        for (a in ayahs) {
          if (a.ayah == 1) { Box(Modifier.fillMaxWidth().height(40.dp).padding(vertical = 4.dp)) { SurahHeaderBox(a.surah, base, ink, paper) }; if (a.surah != 1 && a.surah != 9) Text(QuranMeta.basmala, Modifier.fillMaxWidth(), fontFamily = Fonts.amiri, fontSize = base * 0.95, color = ink, textAlign = androidx.compose.ui.text.style.TextAlign.Center) }
          val text = if (hafs) hafsText(a.text) else a.text; val hidden = veil != null && a.n !in veil
          val spans = if (Store.tajweed) Tajweed.shared.spans(a.n) else emptyList()
          val cps = text.codePoints().toArray(); var pos = 0
          for (t in QuranNormalize.tokenize(text)) {
            val start = findCp(t.raw, cps, pos); pos = start + t.raw.codePointCount(0, t.raw.length)
            val styled = buildAnnotatedString { if (spans.isEmpty() || !t.spoken) append(t.raw) else for ((seg, code) in Tajweed.segments(t.raw, start, spans)) { val c = code?.let { tajweedColor(it, dark) }; if (c != null) withStyle(SpanStyle(color = c)) { append(seg) } else append(seg) } }
            Text(styled, fontFamily = family, fontSize = if (t.spoken) size else size * 0.75, lineHeight = size * 2.05, color = if (hidden) Color.Transparent else if (t.spoken) ink else Gold,
              modifier = Modifier.background(if (hidden) ink.copy(alpha = 0.08f) else if (selected == a.n || Recitation.current == a.n) Teal.copy(alpha = 0.18f) else Color.Transparent, RoundedCornerShape(3.dp)).clickable(indication = null, interactionSource = remember { MutableInteractionSource() }) { if (veil == null) onTap(a) })
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun AyahSheet(a: Ayah, onDismiss: () -> Unit) {
  val ctx = LocalContext.current
  var tafsir by remember { mutableStateOf(false) }
  ModalBottomSheet(onDismissRequest = onDismiss) {
    Column(Modifier.padding(16.dp).verticalScroll(rememberScrollState())) {
      Text(QuranSearch.refLabel(a), fontWeight = FontWeight.Bold); Spacer(Modifier.height(8.dp))
      Text(a.text, fontFamily = Fonts.amiri, fontSize = 20.sp, lineHeight = 40.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center, modifier = Modifier.fillMaxWidth())
      Spacer(Modifier.height(12.dp))
      val txt = "${a.text} ﴿${a.ayah}﴾\n[${QuranSearch.refLabel(a)}]"
      Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(onClick = { tafsir = !tafsir }, Modifier.weight(1f)) { Text("التفسير") }
        Button(onClick = { Recitation.reciter = Store.reciter; Recitation.repeatAyah = Store.repeatAyah; Recitation.play(ctx, QuranText.shared.surahAyahs(a.surah).filter { it.n >= a.n }.map { it.n }); onDismiss() }, Modifier.weight(1f)) { Text("تشغيل من هنا") }
      }
      Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = { Store.toggleBookmark(a); onDismiss() }, Modifier.weight(1f)) { Text(if (Store.isBookmarked(a)) "إزالة العلامة" else "علامة") }
        OutlinedButton(onClick = { Store.remember(a); onDismiss() }, Modifier.weight(1f)) { Text("موضع القراءة") }
      }
      Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = { ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, txt), "مشاركة")) }, Modifier.weight(1f)) { Text("مشاركة") }
        OutlinedButton(onClick = { (ctx.getSystemService(android.content.ClipboardManager::class.java)).setPrimaryClip(android.content.ClipData.newPlainText("آية", txt)) }, Modifier.weight(1f)) { Text("نسخ") }
      }
      if (tafsir) { Spacer(Modifier.height(12.dp)); val html = Tafsir.text(a.surah, a.ayah); Text(buildAnnotatedString { for (r in Tafsir.runs(html ?: "لا تفسير")) if (r.bold) withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = Teal)) { append(r.text) } else append(r.text) }, fontSize = 16.sp, lineHeight = 28.sp); Text("التفسير الميسّر — مجمع الملك فهد", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
      Spacer(Modifier.height(24.dp))
    }
  }
}
@Composable fun AudioBar() {
  val ctx = LocalContext.current
  Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
    Column(Modifier.weight(1f)) { Text(Catalog.shared.reciter(Recitation.reciter).name, fontSize = 12.sp, fontWeight = FontWeight.Bold); Text("${Recitation.label()} · ${Fmt.number(Recitation.index + 1)}/${Fmt.number(Recitation.queue.size)}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    IconButton(onClick = { Recitation.prev(ctx) }) { Icon(Icons.Filled.SkipPrevious, "السابقة") }
    IconButton(onClick = { Recitation.toggle() }) { Icon(if (Recitation.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow, "تشغيل/إيقاف") }
    IconButton(onClick = { Recitation.next(ctx) }) { Icon(Icons.Filled.SkipNext, "التالية") }
    IconButton(onClick = { Recitation.stop() }) { Icon(Icons.Filled.Close, "إغلاق") }
  }
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
    LazyColumn(Modifier.height(240.dp)) { items(Catalog.shared.reciters) { r -> ListItem(headlineContent = { Text(r.name) }, trailingContent = { if (Store.reciter == r.id) Text("✓") }, modifier = Modifier.clickable { Store.reciter = r.id; Store.save(); Recitation.reciter = r.id }) } }
    Row(verticalAlignment = Alignment.CenterVertically) { Text("تكرار الآية ×${Fmt.number(Store.repeatAyah)}", Modifier.weight(1f)); OutlinedButton(onClick = { val o = listOf(1, 2, 3, 5, 10); Store.repeatAyah = o[(o.indexOf(Store.repeatAyah) + 1) % o.size]; Store.save(); Recitation.repeatAyah = Store.repeatAyah }) { Text("تغيير") } }
    Row(verticalAlignment = Alignment.CenterVertically) { Text("السرعة ${Fmt.decimal(Store.rate, 2)}×", Modifier.weight(1f)); OutlinedButton(onClick = { val o = listOf(0.75, 1.0, 1.25, 1.5); Recitation.setRate(o[(o.indexOf(Store.rate) + 1) % o.size]) }) { Text("تغيير") } }
    RowSwitch("متابعة التلاوة بقلب الصفحات", Store.follow) { Store.follow = it; Store.save() }
    Text("الصفحات بخطوط مجمع الملك فهد لطباعة المصحف الشريف (مصحف المدينة، حفص عن عاصم) مطابقةً للمصحف المطبوع سطرًا بسطر. النص: Tanzil. التلاوات: Islamic Network.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 12.dp))
    Spacer(Modifier.height(24.dp))
  }
}
