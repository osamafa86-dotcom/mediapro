package org.emdatra.sakinah.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.emdatra.sakinah.app.Fmt
import org.emdatra.sakinah.app.Fonts
import org.emdatra.sakinah.app.Store
import org.emdatra.sakinah.core.*

/** نطاقات البحث الشامل بترتيب شرائحها */
enum class SearchScope(val title: String) { ALL("الكل"), QURAN("القرآن"), ADHKAR("الأذكار"), HADITH("الأحاديث"), TOOLS("الأدوات") }

/**
 * تطبيع البحث العربي (للأذكار والأحاديث والأدوات): بلا حركات ولا تطويل، والهمزات على الألف وألف الوصل ألفًا،
 * والتاء المربوطة هاءً، والألف المقصورة ياءً — في النصّ والاستعلام معًا. والقرآن يُبحث بـ QuranSearch (يفهم الرسم العثماني).
 */
object ArabicSearch {
  fun norm(s: String): String {
    val sb = StringBuilder(s.length); var space = false
    for (ch in s.lowercase()) {
      val v = ch.code
      if (v in 0x0610..0x061A || v in 0x064B..0x065F || v == 0x0670 || v in 0x06D6..0x06ED || v == 0x0640) continue
      if (ch.isWhitespace()) { space = sb.isNotEmpty(); continue }
      if (space) { sb.append(' '); space = false }
      sb.append(when (ch) { 'أ', 'إ', 'آ', 'ٱ' -> 'ا'; 'ة' -> 'ه'; 'ى' -> 'ي'; else -> ch })
    }
    return sb.toString()
  }
  fun words(q: String): List<String> = norm(q).split(' ').filter { it.length >= 2 }
}

/** اختصار أداة أو إعداد يُطابَق بكلماته المفتاحية ويُفتح موضعه مباشرة (`action` تفسّره «اليوم») */
class SearchTool(val title: String, val subtitle: String?, val icon: ImageVector, val action: String, keywords: List<String> = emptyList()) {
  private val keys = (listOf(title) + keywords).map { ArabicSearch.norm(it) }
  fun matches(q: String) = keys.any { it.contains(q) || (it.length >= 3 && q.contains(it)) }
}

private object SearchIndex {
  class HisnRow(val ch: HisnChapter, val title: String, val items: List<Pair<HisnItem, String>>)
  val hisn: List<HisnRow> by lazy { Hisn.chapters.map { ch -> HisnRow(ch, ArabicSearch.norm(ch.title), ch.items.map { it to ArabicSearch.norm(it.text) }) } }
  val sahih: List<Pair<Hadith, String>> by lazy { HadithLibrary.hadiths.map { it to ArabicSearch.norm(it.text + " " + it.narrator + " " + it.topic) } }
  val nawawi: List<Pair<NawawiHadith, String>> by lazy { HadithLibrary.nawawi.map { it to ArabicSearch.norm(it.title + " " + it.text) } }
  val tools: List<SearchTool> by lazy {
    listOf(
      SearchTool("القبلة", "البوصلة واتجاه الكعبة", Icons.Outlined.Explore, "qibla", listOf("البوصلة", "اتجاه", "الكعبة")),
      SearchTool("طريقة الحساب", "هيئة حساب المواقيت وخطوط العرض العالية", Icons.Outlined.Public, "settings:method", listOf("الحساب", "الهيئة", "أم القرى", "رابطة العالم الإسلامي", "خطوط العرض")),
      SearchTool("وقت العصر", "الجمهور أو الحنفي", Icons.Outlined.WbSunny, "settings:asr", listOf("العصر", "المذهب", "الحنفي", "الجمهور", "الشافعي")),
      SearchTool("الموقع", "المدينة التي تُحسب لها المواقيت", Icons.Outlined.Place, "settings:city", listOf("المدينة", "موقعي", "الدولة", "gps")),
      SearchTool("الجدول الشهري", "مواقيت الشهر وتصديرها إلى التقويم", Icons.Outlined.CalendarMonth, "month", listOf("التقويم", "الجدول", "الشهر", "ics")),
      SearchTool("ضمان الأذان", "فحص ما قد يمنع وصول الأذان في وقته", Icons.Outlined.VerifiedUser, "guard", listOf("الأذان", "لا يصل", "البطارية", "مجدول")),
      SearchTool("التنبيهات", "الأذان، والتنبيه قبل الصلاة، وصوته", Icons.Outlined.Notifications, "settings:notifications", listOf("الإشعارات", "صوت الأذان", "المنبه", "قبل الصلاة")),
      SearchTool("تذكير الأذكار", "الصباح والمساء وحديث اليوم", Icons.Outlined.NotificationsActive, "settings:adhkar-reminders", listOf("تذكير", "أذكار الصباح", "أذكار المساء")),
      SearchTool("أذكار الصباح", "جلسة الأذكار", Icons.Outlined.WbTwilight, "adhkar:morning", listOf("الصباح")),
      SearchTool("أذكار المساء", "جلسة الأذكار", Icons.Outlined.DarkMode, "adhkar:evening", listOf("المساء")),
      SearchTool("المسبحة", "عدّاد التسبيح", Icons.Outlined.Grain, "tasbih", listOf("تسبيح", "سبحة", "عداد")),
      SearchTool("حصن المسلم", "أبواب الأذكار والأدعية", Icons.Outlined.Shield, "hisn", listOf("الأدعية", "دعاء")),
      SearchTool("المساجد القريبة", "أقرب مسجد والاتجاهات إليه", Icons.Outlined.Mosque, "mosques", listOf("المساجد", "مسجد", "جامع")),
      SearchTool("الختمة", "خطة الختمة والأوراد المسنونة", Icons.Outlined.MenuBook, "khatmah", listOf("الورد", "ختمة", "تذكير الورد", "الكهف", "الملك")),
      SearchTool("الأربعون النووية", null, Icons.Outlined.FormatListNumbered, "nawawi", listOf("النووي", "الأربعين")),
      SearchTool("السماء", "مظهر سماء «اليوم» والطقس", Icons.Outlined.WbTwilight, "settings:sky", listOf("المظهر", "الطقس", "الخلفية")),
      SearchTool("المصحف والخط", "لون الصفحة وطريقة العرض وسماكة الخط", Icons.Outlined.AutoStories, "settings:display", listOf("الخط", "السمة", "العرض", "التجويد", "الوضع الليلي")),
      SearchTool("القارئ", "صوت التلاوة", Icons.Outlined.Headphones, "settings:reciter", listOf("التلاوة", "الشيخ", "الصوت")),
      SearchTool("التنزيلات", "التلاوات المحفوظة دون اتصال", Icons.Outlined.Download, "settings:downloads", listOf("تنزيل", "تحميل", "دون اتصال")),
      SearchTool("حجم خط القراءة", "حجم نص الأذكار والأحاديث", Icons.Outlined.FormatSize, "settings:textscale", listOf("حجم الخط", "تكبير")),
      SearchTool("الأرقام والوقت والتاريخ", "الأرقام، ونظام ١٢ ساعة، والتاريخ الهجري، والاهتزاز", Icons.Outlined.Schedule, "settings:numbers", listOf("الأرقام", "ساعة", "التاريخ الهجري", "الاهتزاز", "الوقت")),
      SearchTool("النسخة الاحتياطية", "تصدير الإعدادات والعلامات واستيرادها", Icons.Outlined.Backup, "settings:backup", listOf("تصدير", "استيراد", "نسخة")),
      SearchTool("الخصوصية", "ما يبقى على جهازك وما يغادره", Icons.Outlined.PrivacyTip, "settings:privacy", listOf("البيانات", "التتبع")),
      SearchTool("الإعدادات", null, Icons.Outlined.Tune, "settings", listOf("الضبط")),
    )
  }
}

class HisnHit(val ch: HisnChapter, val item: HisnItem?)
class HadithHit(val book: String, val text: String, val source: String)
class SearchResults(val query: String, val scope: SearchScope, val ref: Ayah?, val surahs: List<Surah>, val ayat: List<Ayah>, val adhkar: List<HisnHit>, val hadith: List<HadithHit>, val tools: List<SearchTool>) {
  val isEmpty get() = ref == null && surahs.isEmpty() && ayat.isEmpty() && adhkar.isEmpty() && hadith.isEmpty() && tools.isEmpty()
}

/** البحث نفسه — يُشغَّل خارج الخيط الرئيس (فهرس القرآن يُبنى عند أوّل طلب) */
object SearchEngine {
  fun run(raw: String, scope: SearchScope): SearchResults {
    val q = raw.trim(); val nq = ArabicSearch.norm(q); val words = ArabicSearch.words(q)
    val all = scope == SearchScope.ALL
    if (nq.length < 2) return SearchResults(q, scope, null, emptyList(), emptyList(), emptyList(), emptyList(), if (scope == SearchScope.TOOLS) SearchIndex.tools else emptyList())
    var ref: Ayah? = null; var surahs: List<Surah> = emptyList(); var ayat: List<Ayah> = emptyList()
    if (all || scope == SearchScope.QURAN) {
      val folded = QuranNormalize.foldDigits(q)
      ref = QuranSearch.parseRef(folded)?.let { r -> QuranText.shared.ayah(r.surah.n, minOf(r.surah.ayahs, r.ayah)) }
      surahs = QuranSearch.matchSurahs(folded).take(if (all) 2 else 10)
      ayat = QuranSearch.shared.search(q, if (all) 3 else 50)
    }
    val adhkar = ArrayList<HisnHit>()
    if ((all || scope == SearchScope.ADHKAR) && words.isNotEmpty()) {
      val limit = if (all) 3 else 40
      for (r in SearchIndex.hisn) { if (adhkar.size >= limit) break; if (words.all { r.title.contains(it) }) adhkar.add(HisnHit(r.ch, null)) }
      outer@ for (r in SearchIndex.hisn) for ((item, t) in r.items) { if (adhkar.size >= limit) break@outer; if (words.all { t.contains(it) }) adhkar.add(HisnHit(r.ch, item)) }
    }
    val hadith = ArrayList<HadithHit>()
    if ((all || scope == SearchScope.HADITH) && words.isNotEmpty()) {
      val limit = if (all) 3 else 40
      for ((h, t) in SearchIndex.sahih) { if (hadith.size >= limit) break; if (words.all { t.contains(it) }) hadith.add(HadithHit("sahih", excerpt(h.text, words), "${h.grade}، عن ${h.narrator}")) }
      for ((n, t) in SearchIndex.nawawi) { if (hadith.size >= limit) break; if (words.all { t.contains(it) }) hadith.add(HadithHit("nawawi", excerpt(n.text, words), "الأربعون النووية، ${n.title}")) }
    }
    val tools = if (all || scope == SearchScope.TOOLS) SearchIndex.tools.filter { it.matches(nq) }.let { if (all) it.take(4) else it } else emptyList()
    return SearchResults(q, scope, ref, surahs, ayat, adhkar, hadith, tools)
  }
  /** مقتطف يبدأ قبيل أوّل كلمةٍ مطابقة، كي تظهر المطابقة في الأسطر المعروضة */
  fun excerpt(text: String, words: List<String>, before: Int = 6): String {
    val tokens = text.split(' ')
    val i = tokens.indexOfFirst { t -> val n = ArabicSearch.norm(t); words.any { n.contains(it) } }
    return if (i <= before) text else "…" + tokens.drop(i - before).joinToString(" ")
  }
}

/** تلوين الكلمات المطابقة بلون الهوية */
private fun tinted(text: String, color: Color, match: (String) -> Boolean): AnnotatedString = buildAnnotatedString {
  text.split(' ').forEachIndexed { i, t -> if (i > 0) append(' '); if (match(t)) withStyle(SpanStyle(color = color)) { append(t) } else append(t) }
}

/**
 * البحث الشامل (search-ios-light.png): حقلٌ مستدير بمسح و«إلغاء»، شرائح النطاق، ثم النتائج مجمّعةً بعناوينها —
 * آيات بخطّ المصحف والكلمة المطابقة ملوّنة، وأذكار حصن المسلم، والأحاديث، والأدوات والإعدادات تُفتح مباشرة.
 */
@Composable fun SearchScreen(
  query: String, onQuery: (String) -> Unit, scope: SearchScope, onScope: (SearchScope) -> Unit, onClose: () -> Unit,
  onAyah: (Ayah) -> Unit, onSurah: (Surah) -> Unit, onChapter: (HisnChapter) -> Unit, onHadith: (book: String, query: String) -> Unit, onTool: (String) -> Unit,
) {
  val c = DS.c
  DisposableEffect(Unit) { SearchFullScreen.open = true; onDispose { SearchFullScreen.open = false } }
  val focus = remember { FocusRequester() }; val keyboard = LocalSoftwareKeyboardController.current
  LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
  // تأخير ٢٥٠ ملّي ثانية بين الكتابة والبحث
  var debounced by remember { mutableStateOf(query.trim()) }
  LaunchedEffect(query) { if (query.isBlank()) debounced = "" else { delay(250); debounced = query.trim() } }
  val results by produceState<SearchResults?>(null, debounced, scope) { value = withContext(Dispatchers.Default) { SearchEngine.run(debounced, scope) } }
  fun keep() { val q = query.trim(); if (q.length >= 2) { Store.recentSearches = (listOf(q) + Store.recentSearches.filter { it != q }).take(6); Store.save() } }

  Column(Modifier.fillMaxSize().background(c.bgCanvas).statusBarsPadding().windowInsetsPadding(WindowInsets.ime.union(WindowInsets.navigationBars))) {
    Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 6.dp, top = 8.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
      Row(Modifier.weight(1f).height(48.dp).clip(CircleShape).background(c.bgSurface).border(1.dp, c.borderSubtle, CircleShape).padding(start = 14.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Outlined.Search, null, Modifier.size(19.dp), tint = c.textTertiary)
        Spacer(Modifier.width(8.dp))
        Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
          if (query.isEmpty()) Text("القرآن، الأذكار، الأحاديث، الأدوات", style = DSType.bodyMd, color = c.textTertiary, maxLines = 1, overflow = TextOverflow.Ellipsis)
          BasicTextField(query, onQuery, Modifier.fillMaxWidth().focusRequester(focus).semantics { contentDescription = "البحث" }, singleLine = true,
            textStyle = DSType.bodyMd.copy(color = c.textPrimary), cursorBrush = SolidColor(c.brandPrimary),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search), keyboardActions = KeyboardActions(onSearch = { keyboard?.hide(); debounced = query.trim() }))
        }
        if (query.isNotEmpty()) Box(Modifier.size(40.dp).clip(CircleShape).clickable(role = Role.Button) { onQuery("") }, contentAlignment = Alignment.Center) {
          Icon(Icons.Filled.Close, "مسح النص", Modifier.size(17.dp), tint = c.textSecondary)
        }
      }
      Box(Modifier.heightIn(min = 48.dp).clip(CircleShape).clickable(role = Role.Button, onClick = onClose).padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
        Text("إلغاء", style = DSType.labelMd.copy(fontWeight = FontWeight.SemiBold), color = c.brandPrimary)
      }
    }
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      SearchScope.entries.forEach { s -> DSChip(s.title, on = s == scope, modifier = Modifier.heightIn(min = 40.dp).semantics { selected = s == scope }) { onScope(s) } }
    }
    val r = results
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 4.dp, 16.dp, 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
      when {
        debounced.isEmpty() && scope != SearchScope.TOOLS -> {
          item { SearchHint() }
          if (Store.recentSearches.isNotEmpty()) item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
              DSSectionHead("عمليات بحث سابقة", link = "مسح", onLink = { Store.recentSearches = emptyList(); Store.save() })
              Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Store.recentSearches.forEach { s -> DSChip(s, icon = Icons.Outlined.History, modifier = Modifier.heightIn(min = 40.dp)) { onQuery(s) } }
              }
            }
          }
        }
        r == null || r.query != debounced || r.scope != scope -> item { Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp, color = c.brandPrimary) } }
        r.isEmpty -> {
          if (ArabicSearch.norm(r.query).length >= 2) item { Text("لا نتائج لـ«${r.query}» — جرّب كلمةً أخرى أو نطاقًا آخر", Modifier.padding(vertical = 12.dp), style = DSType.bodyMd, color = c.textSecondary) }
          if (scope == SearchScope.ALL) item { SearchHint() }
        }
        else -> {
          val all = scope == SearchScope.ALL
          // القرآن
          if (r.ref != null || r.surahs.isNotEmpty() || r.ayat.isNotEmpty()) {
            item { DSSectionHead("القرآن", link = if (all) "كل الآيات" else null, onLink = { onScope(SearchScope.QURAN) }) }
            r.ref?.let { a -> item { NavRowCard(Icons.Outlined.MenuBook, "سورة ${QuranMeta.surah(a.surah).name}، الآية ${Fmt.number(a.ayah)}", "الصفحة ${Fmt.number(a.page)}") { keep(); onAyah(a) } } }
            if (r.surahs.isNotEmpty()) item {
              DSCard(Modifier.fillMaxWidth(), padding = 4.dp) {
                r.surahs.forEachIndexed { i, s -> if (i > 0) DSDivider(); DSRow(Icons.Outlined.MenuBook, "سورة ${s.name}", "${Fmt.number(s.ayahs)} آية، الصفحة ${Fmt.number(s.page)}", onClick = { keep(); onSurah(s) }) }
              }
            }
            items(r.ayat, key = { "a${it.n}" }) { a -> AyahHit(a, r.query) { keep(); onAyah(a) } }
          }
          // الأذكار
          if (r.adhkar.isNotEmpty()) {
            item { DSSectionHead("الأذكار", link = if (all) "الكل" else null, onLink = { onScope(SearchScope.ADHKAR) }) }
            item {
              DSCard(Modifier.fillMaxWidth(), padding = 4.dp) {
                r.adhkar.forEachIndexed { i, h ->
                  if (i > 0) DSDivider()
                  val title = h.item?.let { SearchEngine.excerpt(it.text, ArabicSearch.words(r.query), 3).let { e -> if (e.length > 70) e.take(70) + "…" else e } } ?: h.ch.title
                  val source = if (h.item != null) "حصن المسلم، ${h.ch.title}" else "حصن المسلم، ${Fmt.number(h.ch.items.size)} من الأذكار"
                  DSRow(Icons.Outlined.Shield, title, source, onClick = { keep(); onChapter(h.ch) })
                }
              }
            }
          }
          // الأحاديث
          if (r.hadith.isNotEmpty()) {
            item { DSSectionHead("الأحاديث", link = if (all) "الكل" else null, onLink = { onScope(SearchScope.HADITH) }) }
            items(r.hadith) { h -> HadithHitCard(h, r.query) { keep(); onHadith(h.book, r.query) } }
          }
          // الأدوات والإعدادات (ونطاقها بلا استعلام يعرضها كلّها)
          if (r.tools.isNotEmpty()) {
            item { DSSectionHead("الأدوات والإعدادات", link = if (all) "الكل" else null, onLink = { onScope(SearchScope.TOOLS) }) }
            item { ToolsCard(r.tools) { keep(); onTool(it) } }
          }
          if (all) item { SearchHint() }
        }
      }
    }
  }
}

@Composable private fun SearchHint() {
  Text("البحث نفسه يجد الأدوات والإعدادات: «القبلة» أو «طريقة الحساب» تفتح موضعها مباشرة.", Modifier.fillMaxWidth().padding(vertical = 6.dp), style = DSType.bodySm, color = DS.c.textSecondary)
}

@Composable private fun NavRowCard(icon: ImageVector, title: String, subtitle: String?, onClick: () -> Unit) {
  DSCard(Modifier.fillMaxWidth(), padding = 4.dp) { DSRow(icon, title, subtitle, onClick = onClick) }
}

@Composable private fun ToolsCard(tools: List<SearchTool>, onTool: (String) -> Unit) {
  DSCard(Modifier.fillMaxWidth(), padding = 4.dp) {
    tools.forEachIndexed { i, t -> if (i > 0) DSDivider(); DSRow(t.icon, t.title, t.subtitle, onClick = { onTool(t.action) }) }
  }
}

/** آية مطابقة: نصّها بخطّ المصحف بين قوسين مزخرفين، والكلمة المطابقة بلون الهوية، ثم «البقرة، ١٥٣» */
@Composable private fun AyahHit(a: Ayah, query: String, onClick: () -> Unit) {
  val c = DS.c
  val text = remember(a.n, query, c.brandPrimary) {
    val qa = query.split(' ').map { QuranNormalize.forSearchA(it) }.filter { it.length >= 2 }
    val qb = query.split(' ').map { QuranNormalize.forSearchB(it) }.filter { it.length >= 2 }
    tinted("﴿${a.text}﴾", c.brandPrimary) { t -> val na = QuranNormalize.forSearchA(t); val nb = QuranNormalize.forSearchB(t); qa.any { na.contains(it) } || qb.any { nb.contains(it) } }
  }
  val ref = "${QuranMeta.surah(a.surah).name}، ${Fmt.number(a.ayah)}"
  DSCard(Modifier.fillMaxWidth().semantics(mergeDescendants = true) { contentDescription = "آية من سورة $ref" }, padding = 16.dp, onClick = onClick) {
    Text(text, style = DSType.quranInline.copy(fontSize = 21.sp, lineHeight = 42.sp), color = c.textPrimary, maxLines = 3, overflow = TextOverflow.Ellipsis)
    Spacer(Modifier.height(6.dp))
    Text(ref, style = DSType.labelXs.copy(fontWeight = FontWeight.SemiBold), color = c.textSecondary)
  }
}

@Composable private fun HadithHitCard(h: HadithHit, query: String, onClick: () -> Unit) {
  val c = DS.c
  val words = remember(query) { ArabicSearch.words(query) }
  val text = remember(h.text, query, c.brandPrimary) { tinted("«${h.text}»", c.brandPrimary) { t -> val n = ArabicSearch.norm(t); words.any { n.contains(it) } } }
  DSCard(Modifier.fillMaxWidth(), padding = 16.dp, onClick = onClick) {
    Text(text, fontFamily = Fonts.amiriText, fontSize = 17.sp, lineHeight = 32.sp, color = c.textPrimary, maxLines = 3, overflow = TextOverflow.Ellipsis)
    Spacer(Modifier.height(6.dp))
    Text(h.source, style = DSType.labelXs.copy(fontWeight = FontWeight.SemiBold), color = c.textSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
  }
}
