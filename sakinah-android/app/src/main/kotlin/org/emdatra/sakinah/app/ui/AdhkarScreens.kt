package org.emdatra.sakinah.app.ui

import android.content.Intent
import android.media.AudioManager
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import android.view.HapticFeedbackConstants
import org.emdatra.sakinah.app.Fmt
import org.emdatra.sakinah.app.Fonts
import org.emdatra.sakinah.app.Store
import org.emdatra.sakinah.app.ShareCard
import org.emdatra.sakinah.app.Notify
import org.emdatra.sakinah.app.ScreenshotMode
import org.emdatra.sakinah.core.*
import java.time.Instant

/** تقدّم اليوم: يُصفَّر مع اليوم المدني، والمساء يمتدّ إلى فجر الغد */
private fun adhkarProgressToday(): WebSettings.AdhkarProgress {
  val tl = Store.timeline(); val now = Instant.now(); val key = Store.todayKey
  var p = Store.adhkarProgress
  val afterFajr = tl?.times?.get(Prayer.FAJR)?.let { !now.isBefore(it) } ?: true
  if (p.date != key) p = WebSettings.AdhkarProgress(key, emptyMap(), if (afterFajr) emptyMap() else (p.evening ?: emptyMap()), if (afterFajr) key else (p.eveningDate ?: p.date ?: key))
  else if (afterFajr && p.eveningDate != null && p.eveningDate != key) p = p.copy(evening = emptyMap(), eveningDate = key)
  return p
}
private fun periodMap(p: WebSettings.AdhkarProgress, period: String): Map<String, Int> =
  (if (period == "evening") p.evening else p.morning) ?: emptyMap()
/** نافذة الفترة: «بدأت HH:MM» (بدأ وقتها بالفجر أو العصر) أو «تبدأ بعد الفجر/العصر» */
private fun windowLabel(period: String): String {
  val t = Store.timeline()?.times?.get(if (period == "morning") Prayer.FAJR else Prayer.ASR)
  val fallback = if (period == "morning") "تبدأ بعد الفجر" else "تبدأ بعد العصر"
  return if (t != null && !Instant.now().isBefore(t)) "بدأت ${Fmt.time(t)}" else fallback
}
/** الفترة التلقائية الآن (لذكرٍ مفضّل يُقال صباحاً ومساءً) */
private fun currentPeriod(): String {
  val t = Store.timeline()?.times
  return Adhkar.autoPeriod(Instant.now(), t?.get(Prayer.FAJR), t?.get(Prayer.DHUHR), t?.get(Prayer.ASR), Store.zone)
}

/** النصّ بلا تشكيل (للشرائح والسطور الصغيرة) */
fun plainArabic(s: String): String = s.filter { it !in '\u064B'..'\u065F' && it != '\u0670' }

/** أبواب «حصن المسلم» الثمانية في تبويب الذكر — كلٌّ يجمع من أقسام الكتاب الاثني عشر ما يخصّه (بفهرس القسم في hisn.json) */
data class HisnTheme(val title: String, val sections: List<Int>)
val hisnThemes = listOf(
  HisnTheme("الصباح والمساء", listOf(3)), HisnTheme("النوم والاستيقاظ", listOf(0, 3)),
  HisnTheme("الصلاة والمسجد", listOf(1, 2)), HisnTheme("الكرب والهمّ", listOf(4)),
  HisnTheme("السفر", listOf(8, 10)), HisnTheme("الطعام والشراب", listOf(6)),
  HisnTheme("المرض والعيادة", listOf(5)), HisnTheme("الاستغفار والتوبة", listOf(11)),
)

/** الأذكار: الرئيسية، جلسة الذكر، حصن المسلم، المفضّلة، والمسبحة */
@Composable fun AdhkarHome() {
  var screen by remember { mutableStateOf(if (ScreenshotMode.route == "tasbih") "tasbih" else "home") }
  var chapter by remember { mutableStateOf<HisnChapter?>(null) }
  var session by remember { mutableStateOf<String?>(null) }
  var sessionStart by remember { mutableStateOf<String?>(null) }
  var hisnTheme by remember { mutableStateOf<Int?>(null) }; var hisnSearch by remember { mutableStateOf(false) }
  // «ابدأ» من بطاقة أذكار الوقت في الرئيسية
  // و«أذكار النوم» من الويدجت والإشعار الحيّ: باب حصن المسلم نفسه الذي تفتحه بطاقة «الآن» بعد العشاء
  LaunchedEffect(Store.pendingAdhkarPeriod) {
    Store.pendingAdhkarPeriod?.let { p ->
      Store.pendingAdhkarPeriod = null
      if (p == "sleep") Hisn.chapters.firstOrNull { it.title == "أذكار النوم" }?.let { session = null; chapter = it } else { chapter = null; session = p; sessionStart = null }
    }
  }
  BackHandler(screen != "home" || chapter != null || session != null) {
    when { session != null -> session = null; chapter != null -> chapter = null; else -> screen = "home" }
  }
  when {
    session != null -> DhikrSession(session!!, sessionStart) { session = null; sessionStart = null }
    chapter != null -> HisnChapterScreen(chapter!!) { chapter = null }
    screen == "hisn" -> HisnScreen(onBack = { screen = "home" }, theme = hisnTheme, focusSearch = hisnSearch) { chapter = it }
    screen == "tasbih" -> TasbihScreen(backLabel = "الذكر") { screen = "home" }
    screen == "favorites" -> AdhkarFavoritesScreen(onBack = { screen = "home" }, onChapter = { chapter = it }, onDhikr = { period, id -> session = period; sessionStart = id })
    else -> AdhkarDaily(
      onHisn = { theme, search -> hisnTheme = theme; hisnSearch = search; screen = "hisn" },
      onTasbih = { screen = "tasbih" }, onChapter = { chapter = it },
      onSession = { session = it; sessionStart = null },
      onDhikr = { period, id -> session = period; sessionStart = id },
      onFavorites = { screen = "favorites" })
  }
}

/** تبويب «الذكر» (المرحلة الخامسة — dhikr.png): فترتا اليوم، «حضورك هذا الأسبوع» بدل السلسلة، المسبحة، حصن المسلم بأبوابه، و«مفضّلتي» */
@Composable fun AdhkarDaily(onHisn: (Int?, Boolean) -> Unit, onTasbih: () -> Unit, onChapter: (HisnChapter) -> Unit, onSession: (String) -> Unit, onDhikr: (String, String) -> Unit, onFavorites: () -> Unit) {
  val c = DS.c
  val ctx = LocalContext.current
  var searching by remember { mutableStateOf(false) }
  var q by remember { mutableStateOf("") }
  var reminders by remember { mutableStateOf(false) }
  LazyColumn(Modifier.fillMaxSize().background(c.bgCanvas), contentPadding = PaddingValues(16.dp, 0.dp, 16.dp, 32.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
    item {
      DSPageHeader("الذكر", "الأذكار، والمسبحة، وحصن المسلم", Modifier.padding(horizontal = 4.dp)) {
        DSIconButton(if (searching) Icons.Outlined.Close else Icons.Outlined.Search, contentDescription = if (searching) "إغلاق البحث" else "البحث في الأذكار") { searching = !searching; if (!searching) q = "" }
        DSIconButton(Icons.Outlined.Notifications, contentDescription = "تذكيرات الأذكار", style = if (Store.extras.any) IconStyle.Brand else IconStyle.Outlined) { reminders = true }
      }
    }
    if (searching) {
      item {
        OutlinedTextField(q, { q = it }, Modifier.fillMaxWidth(), placeholder = { Text("ابحث في الأبواب والأذكار…", style = DSType.bodyMd) }, singleLine = true, shape = DS.shapeMd)
      }
      val res = Hisn.search(q)
      if (CityDatabase.normalize(q).length < 2) item { Text("اكتب حرفين على الأقل للبحث", style = DSType.bodySm, color = c.textTertiary) }
      items(res.first) { ch -> DSCard { DSRow(Icons.Outlined.MenuBook, ch.title, hisnCountLabel(ch.items.size), onClick = { onChapter(ch) }) { DSChevron() } } }
      items(res.second) { (item, ch) ->
        DSTile(onClick = { onChapter(ch) }) {
          Column(Modifier.fillMaxWidth()) {
            Text(item.text.take(110), style = DSType.readingSm, color = c.textPrimary, maxLines = 2)
            Text(ch.title, style = DSType.labelXs, color = c.textSecondary)
          }
        }
      }
    } else {
      item { PeriodCards(onSession) }
      item { PresenceCard() }
      item { TasbihCard(onTasbih) }
      item { HisnBlock(onHisn) }
      item { FavoritesBlock(onChapter, onDhikr, onFavorites) }
      item { Text("النصوص من كتاب «حصن المسلم» للشيخ سعيد بن علي بن وهف القحطاني، بترتيبه وتخريجه.", style = DSType.labelXs, color = c.textTertiary, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) }
    }
  }
  if (reminders) AdhkarRemindersSheet(ctx) { reminders = false }
}

/** ورقة تذكيرات الأذكار: مفاتيح الصباح والمساء وحديث اليوم */
@OptIn(ExperimentalMaterial3Api::class)
@Composable fun AdhkarRemindersSheet(ctx: android.content.Context, onDismiss: () -> Unit) {
  val c = DS.c
  ModalBottomSheet(onDismissRequest = onDismiss, containerColor = c.bgSurface) {
    Column(Modifier.fillMaxWidth().padding(16.dp, 0.dp, 16.dp, 32.dp)) {
      Text("تذكيرات الأذكار", style = DSType.headingMd, color = c.textPrimary)
      Spacer(Modifier.height(12.dp))
      DSToggleRow("أذكار الصباح بعد الفجر", "بعد الفجر بـ${Fmt.number(Store.extras.morningAfter)} دقيقة", Store.extras.adhkarMorning, Icons.Outlined.WbTwilight) {
        Store.extras = Store.extras.copy(adhkarMorning = it); Store.save(); Notify.schedule(ctx)
      }
      DSDivider()
      DSToggleRow("أذكار المساء بعد العصر", "بعد العصر بـ${Fmt.number(Store.extras.eveningAfter)} دقيقة", Store.extras.adhkarEvening, Icons.Outlined.DarkMode) {
        Store.extras = Store.extras.copy(adhkarEvening = it); Store.save(); Notify.schedule(ctx)
      }
      DSDivider()
      DSToggleRow("حديث اليوم", "يوميًا في ${Store.extras.hadithTime}", Store.extras.hadithDaily, Icons.Outlined.AutoStories) {
        Store.extras = Store.extras.copy(hadithDaily = it); Store.save(); Notify.schedule(ctx)
      }
      Spacer(Modifier.height(10.dp))
      Text("تُجدوَل أذكار الصباح والمساء من مواقيت موقعك.", style = DSType.labelXs, color = c.textTertiary)
    }
  }
}

/** بطاقتا الفترتين جنباً إلى جنب: الصباح في البداية (يميناً) والمساء بعده، بارتفاعٍ واحد */
@Composable private fun PeriodCards(onSession: (String) -> Unit) {
  Row(Modifier.fillMaxWidth().height(IntrinsicSize.Max), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
    PeriodCard("morning", Modifier.weight(1f).fillMaxHeight(), onSession)
    PeriodCard("evening", Modifier.weight(1f).fillMaxHeight(), onSession)
  }
}

@Composable private fun PeriodCard(period: String, modifier: Modifier, onSession: (String) -> Unit) {
  val c = DS.c
  val list = Adhkar.items(period)
  val prog = adhkarProgressToday()
  val done = periodMap(prog, period)
  val completed = list.count { (done[it.id] ?: 0) >= it.target(period) }
  val pct = if (list.isEmpty()) 0f else completed.toFloat() / list.size
  val started = done.values.any { it > 0 }  // «متابعة» بدل «ابدأ»
  val finished = list.isNotEmpty() && completed == list.size
  val morning = period == "morning"
  val title = if (morning) "أذكار الصباح" else "أذكار المساء"
  val line = if (finished) "${Fmt.number(completed)} من ${Fmt.number(list.size)}" else "${Fmt.number(completed)} من ${Fmt.number(list.size)}، ${windowLabel(period)}"
  DSCard(modifier.semantics(mergeDescendants = true) { contentDescription = "$title: $line${if (finished) "، أتممتها اليوم" else ""}" }, padding = 16.dp, onClick = { onSession(period) }) {
    Column(Modifier.fillMaxWidth().weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
      Box(Modifier.size(66.dp), contentAlignment = Alignment.Center) {
        RingProgress(pct, Modifier.fillMaxSize(), tint = if (finished) c.brandPrimary else c.accentGold, track = c.bgSubtle, stroke = 5.dp)
        Icon(if (morning) Icons.Outlined.WbSunny else Icons.Outlined.DarkMode, null, Modifier.size(22.dp), tint = if (finished) c.brandPrimary else c.textSecondary)
      }
      Spacer(Modifier.height(12.dp))
      Text(title, style = DSType.headingSm, color = c.textPrimary, maxLines = 1)
      Spacer(Modifier.height(2.dp))
      Text(line, style = DSType.labelXs, color = c.textSecondary, textAlign = TextAlign.Center, maxLines = 2)
      Spacer(Modifier.weight(1f).heightIn(min = 12.dp))
      if (finished) Row(Modifier.heightIn(min = 44.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
        Icon(Icons.Filled.Check, null, Modifier.size(16.dp), tint = c.brandPrimary); Spacer(Modifier.width(6.dp))
        Text("أتممتها اليوم", style = DSType.labelMd, color = c.brandPrimary)
      } else DSButton(if (started) "متابعة" else "ابدأ", kind = ButtonKind.Gold, modifier = Modifier.fillMaxWidth()) { onSession(period) }
    }
  }
}

/** «حضورك هذا الأسبوع» (بدل السلسلة): أيام الأسبوع من السبت (يميناً) إلى الجمعة، وما أتممتَ فيه أذكارك — بلا نقاط ولا سلاسل */
@Composable private fun PresenceCard() {
  val c = DS.c
  val log = Store.adhkarLog; val today = Store.todayKey
  val sinceSat = (CivilDate.weekdayIndex(Instant.now(), Store.zone) + 1) % 7
  val start = DayKey.adding(today, -sinceSat)
  val days = (0..6).map { DayKey.adding(start, it) }
  val n = days.count { it <= today && !log[it].isNullOrEmpty() }
  val line = when (n) {
    0 -> "لم تُتمَّ أذكارك بعد هذا الأسبوع، وهي هنا متى شئت"
    1 -> "حضرتَ أذكارك يوماً واحداً من ${Fmt.number(7)} هذا الأسبوع"
    2 -> "حضرتَ أذكارك يومين من ${Fmt.number(7)} هذا الأسبوع"
    else -> "حضرتَ أذكارك ${Fmt.number(n)} أيام من ${Fmt.number(7)} هذا الأسبوع"
  }
  DSCard(Modifier.fillMaxWidth(), padding = 18.dp) {
    Text(line, style = DSType.headingSm, color = c.textPrimary)
    Spacer(Modifier.height(14.dp))
    Row(Modifier.fillMaxWidth()) {
      for (d in days) {
        val done = !log[d].isNullOrEmpty(); val future = d > today; val isToday = d == today
        Column(Modifier.weight(1f).semantics(mergeDescendants = true) { contentDescription = "${AdhkarStreak.letter(d)}: ${if (done) "حضرت" else if (future) "لم يأتِ بعد" else "لم تُتمّ"}" }, horizontalAlignment = Alignment.CenterHorizontally) {
          Box(Modifier.size(34.dp).alpha(if (future) 0.55f else 1f).clip(CircleShape).background(if (done) c.brandPrimary else c.bgSubtle)
            .then(if (isToday && !done) Modifier.border(2.dp, c.accentGold, CircleShape) else Modifier))
          Spacer(Modifier.height(6.dp))
          Text(AdhkarStreak.letter(d), style = DSType.labelXs, color = if (isToday) c.accentGoldStrong else c.textTertiary)
        }
      }
    }
    Spacer(Modifier.height(12.dp))
    Text("هذا لك وحدك: لا نقاط ولا سلاسل تنكسر.", style = DSType.labelXs, color = c.textSecondary)
    if (Store.extras.adhkarEvening) Text("وتذكير المساء يصلك بعد العصر بـ${Fmt.number(Store.extras.eveningAfter)} دقيقة.", style = DSType.labelXs, color = c.textTertiary)
  }
}

/** مجموع المسبحة في أسبوع اليوم (من السبت) من سجلّها اليوميّ */
fun tasbihWeekTotal(): Int {
  val today = Store.todayKey; val sinceSat = (CivilDate.weekdayIndex(Instant.now(), Store.zone) + 1) % 7
  return (0..sinceSat).sumOf { Store.tasbihOn(DayKey.adding(today, -it)) }
}

/** بطاقة المسبحة: الصيغة الحالية، ومجموع اليوم والأسبوع، وحلقةٌ بالعدد الجاري — تفتح شاشة المسبحة */
@Composable private fun TasbihCard(onOpen: () -> Unit) {
  val c = DS.c; val st = Store.tasbih
  val pct = if (st.target > 0) st.count.toFloat() / st.target else 0f
  val sub = "${plainArabic(Tasbih.phraseText(st))}، اليوم ${Fmt.grouped(Store.tasbihOn(Store.todayKey))}، هذا الأسبوع ${Fmt.grouped(tasbihWeekTotal())}"
  DSCard(Modifier.fillMaxWidth().semantics(mergeDescendants = true) { contentDescription = "المسبحة: $sub" }, padding = 16.dp, onClick = onOpen) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      Box(Modifier.size(54.dp), contentAlignment = Alignment.Center) {
        RingProgress(pct, Modifier.fillMaxSize(), tint = c.brandPrimary, track = c.bgSubtle, stroke = 4.dp)
        Text(Fmt.number(st.count), style = DSType.numericMd, color = c.textPrimary)
      }
      Spacer(Modifier.width(14.dp))
      Column(Modifier.weight(1f)) {
        Text("المسبحة", style = DSType.headingSm, color = c.textPrimary)
        Text(sub, style = DSType.labelXs, color = c.textSecondary, maxLines = 2, overflow = TextOverflow.Ellipsis)
      }
      DSChevron()
    }
  }
}

/** «حصن المسلم»: حقل بحثٍ يفتح فهرسه، وثمانية أبوابٍ في شبكة عمودين تفتح الفهرس مصفّىً بموضوعها */
@Composable private fun HisnBlock(onHisn: (Int?, Boolean) -> Unit) {
  val c = DS.c
  Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
    DSSectionHead("حصن المسلم", Modifier.padding(horizontal = 4.dp), link = "كل الأبواب (${Fmt.number(Hisn.chapters.size)})", onLink = { onHisn(null, false) })
    DSCard(Modifier.fillMaxWidth(), padding = 14.dp) {
      Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).clip(CircleShape).background(c.bgCanvas).border(1.dp, c.borderSubtle, CircleShape).clickable(role = Role.Button, onClickLabel = "البحث في حصن المسلم") { onHisn(null, true) }.padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(Icons.Outlined.Search, null, Modifier.size(18.dp), tint = c.textTertiary)
        Text("ابحث في الأبواب والأذكار", style = DSType.bodySm, color = c.textTertiary)
      }
      Spacer(Modifier.height(12.dp))
      Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        hisnThemes.withIndex().chunked(2).forEach { row ->
          Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            row.forEach { (i, t) ->
              Box(Modifier.weight(1f).heightIn(min = 46.dp).clip(DS.shapeMd).background(c.bgSubtle).clickable(role = Role.Button) { onHisn(i, false) }.padding(horizontal = 10.dp, vertical = 10.dp), contentAlignment = Alignment.Center) {
                Text(t.title, style = DSType.labelMd, color = c.textPrimary, textAlign = TextAlign.Center, maxLines = 1)
              }
            }
          }
        }
      }
    }
  }
}

/** عنصر من «مفضّلتي»: ذكرٌ من أذكار اليوم أو بابٌ من حصن المسلم */
private class FavItem(val key: String, val title: String, val subtitle: String, val icon: ImageVector, val open: () -> Unit, val remove: () -> Unit)
/** عنوان ذكرٍ مفضّل: ما يسمّيه الكتاب في ملاحظته («آية الكرسي»، «سيد الاستغفار»)، وإلا مطلع نصّه */
private fun dhikrTitle(d: Dhikr): String {
  val note = d.note?.substringBefore('،')?.trim()?.trimEnd('.')
  val counts = listOf("مرة", "مرات", "مرتين", "مائة", "عشر", "ثلاث", "سبع", "أصبح", "أمسى", "اليوم")
  if (!note.isNullOrBlank() && counts.none { note.contains(it) }) return note
  return plainArabic(d.text).replace(Regex("[﴿﴾*]"), "").split(' ').filter { it.isNotBlank() }.take(4).joinToString(" ")
}
private fun favoriteItems(onChapter: (HisnChapter) -> Unit, onDhikr: (String, String) -> Unit): List<FavItem> {
  val out = ArrayList<FavItem>()
  for (id in Store.hisnFavorites.reversed()) {
    val ch = Hisn.chapter(id) ?: continue
    val section = Hisn.sections.firstOrNull { id in it.chapters }?.title
    out.add(FavItem("hisn:$id", ch.title, "حصن المسلم${section?.let { "، $it" } ?: ""}", Icons.Outlined.MenuBook, { onChapter(ch) }, { Store.hisnFavorites = Store.hisnFavorites - id; Store.save() }))
  }
  for (f in Store.favorites.reversed()) {
    if (!f.startsWith("dhikr:")) continue
    val d = Adhkar.all.firstOrNull { it.id == f.removePrefix("dhikr:") } ?: continue
    val sub = when (d.period) { "morning" -> "من أذكار الصباح"; "evening" -> "من أذكار المساء"; else -> "من أذكار الصباح والمساء" }
    out.add(FavItem(f, dhikrTitle(d), sub, Icons.Outlined.AutoAwesome, { onDhikr(if (d.period == "both") currentPeriod() else d.period, d.id) }, { Store.favorites = Store.favorites - f; Store.save() }))
  }
  return out
}
@Composable private fun FavRow(f: FavItem, trailing: @Composable RowScope.() -> Unit = { DSChevron() }) {
  val c = DS.c
  Row(Modifier.fillMaxWidth().clip(DS.shapeMd).clickable(onClick = f.open).padding(horizontal = 8.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
    DSSoftSquare(f.icon, size = 40.dp, iconSize = 18.dp)
    Spacer(Modifier.width(12.dp))
    Column(Modifier.weight(1f)) {
      Text(f.title, style = DSType.labelMd.copy(fontWeight = FontWeight.SemiBold), color = c.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
      Text(f.subtitle, style = DSType.labelXs, color = c.textSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
    trailing()
  }
}
/** «مفضّلتي» (جديدة — المفضّلة كانت تُحفظ «dhikr:<id>» ولا تُعرض): أحدث ثلاثٍ، و«الكل» للقائمة كاملة */
@Composable private fun FavoritesBlock(onChapter: (HisnChapter) -> Unit, onDhikr: (String, String) -> Unit, onAll: () -> Unit) {
  val c = DS.c
  val favs = favoriteItems(onChapter, onDhikr)
  Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
    DSSectionHead("مفضّلتي", Modifier.padding(horizontal = 4.dp), link = if (favs.isNotEmpty()) "الكل" else null, onLink = if (favs.isNotEmpty()) onAll else null)
    DSCard(Modifier.fillMaxWidth(), padding = 8.dp) {
      if (favs.isEmpty()) Text("لا مفضّلة بعد: اضغط القلب على ذكرٍ في جلسة الأذكار، أو على بابٍ من حصن المسلم، فيظهر هنا.", Modifier.padding(12.dp), style = DSType.bodySm, color = c.textSecondary)
      favs.take(3).forEachIndexed { i, f -> if (i > 0) DSDivider(); FavRow(f) }
    }
  }
}
/** المفضّلة كاملةً: كل ذكرٍ وباب، يُفتح بنقرة ويُزال بالقلب */
@Composable fun AdhkarFavoritesScreen(onBack: () -> Unit, onChapter: (HisnChapter) -> Unit, onDhikr: (String, String) -> Unit) {
  val c = DS.c
  val favs = favoriteItems(onChapter, onDhikr)
  LazyColumn(Modifier.fillMaxSize().background(c.bgCanvas), contentPadding = PaddingValues(16.dp, 0.dp, 16.dp, 32.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
    item { DSBackLink("الذكر", onClick = onBack) }
    item { DSPageHeader("مفضّلتي", "الأذكار وأبواب حصن المسلم التي حفظتَها", Modifier.padding(horizontal = 4.dp)) }
    if (favs.isEmpty()) item { DSCard(Modifier.fillMaxWidth()) { Text("لا مفضّلة بعد: اضغط القلب على ذكرٍ في جلسة الأذكار، أو على بابٍ من حصن المسلم.", style = DSType.bodySm, color = c.textSecondary) } }
    else item {
      DSCard(Modifier.fillMaxWidth(), padding = 8.dp) {
        favs.forEachIndexed { i, f ->
          if (i > 0) DSDivider()
          FavRow(f) { DSIconButton(Icons.Filled.Favorite, style = IconStyle.Plain, size = 44.dp, iconSize = 18.dp, contentDescription = "إزالة «${f.title}» من المفضّلة", onClick = f.remove) }
        }
      }
    }
  }
}
private fun hisnCountLabel(n: Int) = if (n == 1) "ذكر واحد" else if (n == 2) "ذكران" else if (n <= 10) "${Fmt.number(n)} أذكار" else "${Fmt.number(n)} ذكرًا"

/** جلسة الأذكار (تصميم Figma 08): ذكر واحد، شريط تقدّم مقسّم، عدّاد بحلقة ذهبية، والنقر في أي مكان يعدّ — وتبدأ من ذكرٍ بعينه حين تُفتح من «مفضّلتي» */
@Composable fun DhikrSession(period: String, startId: String? = null, onClose: () -> Unit) {
  val c = DS.c; val ctx = LocalContext.current; val view = LocalView.current
  val list = Adhkar.items(period)
  val title = if (period == "morning") "أذكار الصباح" else "أذكار المساء"
  var index by remember { mutableIntStateOf(startId?.let { id -> list.indexOfFirst { it.id == id }.coerceAtLeast(0) } ?: 0) }
  val prog = adhkarProgressToday()
  val map = periodMap(prog, period)
  val d = list.getOrNull(index) ?: list.firstOrNull() ?: return
  val target = d.target(period); val count = map[d.id] ?: 0
  val completed = list.count { (map[it.id] ?: 0) >= it.target(period) }

  fun store(next: Int) {
    var p = adhkarProgressToday()
    p = if (period == "evening") p.copy(evening = (p.evening ?: emptyMap()) + (d.id to next))
        else p.copy(morning = (p.morning ?: emptyMap()) + (d.id to next))
    Store.adhkarProgress = p
    val m = periodMap(p, period)
    if (list.all { (m[it.id] ?: 0) >= it.target(period) }) Store.adhkarLog = AdhkarStreak.mark(Store.adhkarLog, Store.todayKey, period)
    Store.save()
  }

  fun advance() { if (index + 1 < list.size) index++ else onClose() }
  fun tap() {
    if (count >= target) { advance(); return }
    store(count + 1)
    if (Store.haptics) view.performHapticFeedback(if (count + 1 >= target) HapticFeedbackConstants.LONG_PRESS else HapticFeedbackConstants.KEYBOARD_TAP)
  }

  Column(Modifier.fillMaxSize().background(c.bgCanvas).clickable(indication = null, interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }) { tap() }) {
    Row(Modifier.fillMaxWidth().padding(16.dp, 12.dp), verticalAlignment = Alignment.CenterVertically) {
      DSIconButton(Icons.Outlined.Tune, contentDescription = "حجم النص") { Store.textScale = if (Store.textScale >= 1.6) 0.9 else Store.textScale + 0.1; Store.save() }
      Spacer(Modifier.weight(1f))
      Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(title, style = DSType.headingMd, color = c.textPrimary)
        Text("${Fmt.number(index + 1)} من ${Fmt.number(list.size)}، بقي نحو ${Fmt.number(maxOf(1, (list.size - completed) / 5))} دقائق", style = DSType.labelXs, color = c.textSecondary)
      }
      Spacer(Modifier.weight(1f))
      DSIconButton(Icons.Outlined.Close, contentDescription = "إغلاق") { onClose() }
    }
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(3.dp)) {
      list.forEachIndexed { i, item ->
        val full = (map[item.id] ?: 0) >= item.target(period)
        Box(Modifier.weight(1f).height(4.dp).clip(CircleShape).background(if (full) c.brandPrimary else if (i == index) c.accentGold else c.borderSubtle))
      }
    }
    Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
      Spacer(Modifier.height(12.dp))
      DhikrPaperCard(d, period, title, ctx)
      Spacer(Modifier.height(20.dp))
      DhikrDial(count, target)
      Spacer(Modifier.height(12.dp))
      Text("انقر في أي مكان للعدّ، واهتزاز خفيف عند الاكتمال", style = DSType.labelXs, color = c.textTertiary)
    }
    Row(Modifier.fillMaxWidth().padding(16.dp, 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
      TextButton(onClick = { advance() }) { Text("تخطِّ", style = DSType.labelMd, color = c.textTertiary) }
      DSButton(if (index >= list.size - 1) "إنهاء" else "التالي", modifier = Modifier.weight(1f), icon = if (index >= list.size - 1) Icons.Outlined.Check else Icons.Outlined.ChevronLeft) { advance() }
      DSIconButton(Icons.Outlined.ChevronRight, contentDescription = "السابق") { if (index > 0) index-- }
    }
  }
}

@Composable private fun DhikrPaperCard(d: Dhikr, period: String, title: String, ctx: android.content.Context) {
  val c = DS.c
  val text = d.text(period); val target = d.target(period)
  val fav = "dhikr:${d.id}" in Store.favorites
  Column(
    Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(c.paperPage).padding(20.dp),
    horizontalAlignment = Alignment.CenterHorizontally
  ) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      DSIconButton(if (fav) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder, contentDescription = if (fav) "إزالة من المفضّلة" else "إضافة إلى المفضّلة", size = 38.dp, style = if (fav) IconStyle.Brand else IconStyle.Soft) {
        Store.favorites = if (fav) Store.favorites - "dhikr:${d.id}" else Store.favorites + "dhikr:${d.id}"; Store.save()
      }
      Spacer(Modifier.width(8.dp))
      DSIconButton(Icons.Outlined.Share, contentDescription = "مشاركة", size = 38.dp, style = IconStyle.Soft) {
        ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, "$text\n\n${d.reference}"), "مشاركة"))
      }
      Spacer(Modifier.width(8.dp))
      DSIconButton(Icons.Outlined.Image, contentDescription = "مشاركة كصورة", size = 38.dp, style = IconStyle.Soft) {
        ShareCard.share(ctx, ShareCard.render(ctx, title, text, d.reference, false), "dhikr-${d.id}.png", "$text\n\n${d.reference}")
      }
      Spacer(Modifier.weight(1f))
      Text(
        if (target > 1) "يُقال ${repeatLabel(target)}" else "يُقال مرة واحدة",
        style = DSType.labelXs, color = c.accentGoldStrong,
        modifier = Modifier.clip(CircleShape).background(c.accentGoldSoft).padding(10.dp, 5.dp)
      )
    }
    Spacer(Modifier.height(16.dp))
    val scale = Store.textScale
    Text(
      buildAnnotatedString { var inAyah = false; for (ch in text) { if (ch == '﴿') inAyah = true; if (inAyah) withStyle(SpanStyle(color = c.accentGoldStrong)) { append(ch) } else append(ch); if (ch == '﴾') inAyah = false } },
      fontFamily = Fonts.amiriText, fontSize = (19 * scale).sp, lineHeight = (36 * scale).sp,
      color = c.paperInk, textAlign = TextAlign.Center
    )
    if (!d.virtue.isNullOrBlank()) { Spacer(Modifier.height(10.dp)); Text(d.virtue!!, style = DSType.bodySm, color = c.brandPrimary, textAlign = TextAlign.Center) }
    Spacer(Modifier.height(14.dp))
    DSDivider()
    Spacer(Modifier.height(10.dp))
    Row(Modifier.fillMaxWidth()) {
      Text("حصن المسلم · $title", style = DSType.labelXs, color = c.textTertiary)
      Spacer(Modifier.weight(1f))
      Text(d.reference, style = DSType.labelXs, color = c.textTertiary)
    }
  }
}

@Composable private fun DhikrDial(count: Int, target: Int) {
  val c = DS.c
  val full = count >= target
  val pct by animateFloatAsState(if (target > 0) (count.toFloat() / target).coerceIn(0f, 1f) else 0f, label = "dhikr")
  Box(Modifier.size(150.dp), contentAlignment = Alignment.Center) {
    Box(Modifier.fillMaxSize().clip(CircleShape).background(c.bgSurface))
    RingProgress(pct, Modifier.fillMaxSize(), tint = if (full) c.brandPrimary else c.accentGold, stroke = 8.dp)
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
      Text(Fmt.number(count), style = DSType.numericXl, color = c.textPrimary)
      Text(if (full) "من ${Fmt.number(target)} اكتمل" else "من ${Fmt.number(target)}", style = DSType.labelSm, color = if (full) c.brandPrimary else c.textSecondary)
    }
  }
}
private fun repeatLabel(n: Int) = if (n == 1) "مرة واحدة" else if (n == 2) "مرتين" else if (n <= 10) "${Fmt.number(n)} مرات" else "${Fmt.number(n)} مرة"

/** بطاقة ذكر داخل باب حصن المسلم: نصّ على ورق وعدّاد جانبي */
@Composable fun DhikrCard(text: String, target: Int, count: Int, virtue: String?, reference: String?, onTap: () -> Unit) {
  val ctx = LocalContext.current; val c = DS.c; val done = count >= target; val scale = Store.textScale
  DSCard(onClick = onTap) {
    Text(
      buildAnnotatedString { var inAyah = false; for (ch in text) { if (ch == '﴿') inAyah = true; if (inAyah) withStyle(SpanStyle(color = c.accentGoldStrong)) { append(ch) } else append(ch); if (ch == '﴾') inAyah = false } },
      fontFamily = Fonts.amiriText, fontSize = (18 * scale).sp, lineHeight = (34 * scale).sp, color = c.textPrimary
    )
    if (virtue != null) { Spacer(Modifier.height(6.dp)); Text("✦ $virtue", style = DSType.bodySm, color = c.brandPrimary) }
    Spacer(Modifier.height(10.dp))
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
      Column(Modifier.weight(1f)) {
        if (reference != null) Text(reference, style = DSType.labelXs, color = c.textTertiary)
        Text("يُقال ${repeatLabel(target)}", style = DSType.labelXs, color = c.textTertiary)
        Spacer(Modifier.height(6.dp))
        Row {
          DSIconButton(Icons.Outlined.ContentCopy, contentDescription = "نسخ", size = 34.dp, iconSize = 15.dp, style = IconStyle.Soft) {
            (ctx.getSystemService(android.content.ClipboardManager::class.java)).setPrimaryClip(android.content.ClipData.newPlainText("ذكر", text))
          }
          Spacer(Modifier.width(6.dp))
          DSIconButton(Icons.Outlined.Share, contentDescription = "مشاركة", size = 34.dp, iconSize = 15.dp, style = IconStyle.Soft) {
            ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, "$text\n\n${reference ?: ""}"), "مشاركة"))
          }
          Spacer(Modifier.width(6.dp))
          DSIconButton(Icons.Outlined.Image, contentDescription = "مشاركة كصورة", size = 34.dp, iconSize = 15.dp, style = IconStyle.Soft) {
            ShareCard.share(ctx, ShareCard.render(ctx, "من الأذكار", text, reference ?: "", false), "dhikr.png", "$text\n\n${reference ?: ""}")
          }
        }
      }
      Box(Modifier.size(60.dp).clip(CircleShape).background(if (done) c.brandPrimary else c.brandSoft).clickable(onClick = onTap), contentAlignment = Alignment.Center) {
        if (done) Icon(Icons.Filled.Check, null, Modifier.size(22.dp), tint = c.textOnBrand)
        else Text(Fmt.number(maxOf(0, target - count)), style = DSType.numericMd, color = c.brandPrimary)
      }
    }
  }
}

/** فهرس «حصن المسلم»: بحث، المفضّلة، والأقسام — ويُفتح مصفّىً بموضوعٍ من أبواب تبويب الذكر الثمانية، أو والبحث جاهزٌ للكتابة */
@Composable fun HisnScreen(onBack: () -> Unit, theme: Int? = null, focusSearch: Boolean = false, onChapter: (HisnChapter) -> Unit) {
  val c = DS.c
  var q by remember { mutableStateOf("") }
  var themeIdx by remember(theme) { mutableStateOf(theme?.takeIf { it in hisnThemes.indices }) }
  val res = remember(q) { Hisn.search(q) }
  val focus = remember { FocusRequester() }
  LaunchedEffect(focusSearch) { if (focusSearch) runCatching { focus.requestFocus() } }
  val shownSections = themeIdx?.let { t -> hisnThemes[t].sections.mapNotNull { Hisn.sections.getOrNull(it) } } ?: Hisn.sections
  LazyColumn(Modifier.fillMaxSize().background(c.bgCanvas), contentPadding = PaddingValues(16.dp, 0.dp, 16.dp, 32.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
    item { DSNavBar("حصن المسلم", subtitle = themeIdx?.let { hisnThemes[it].title }, onBack = onBack) }
    item { OutlinedTextField(q, { q = it }, Modifier.fillMaxWidth().focusRequester(focus), placeholder = { Text("ابحث في الأبواب والأذكار…", style = DSType.bodyMd) }, singleLine = true, shape = DS.shapeMd, leadingIcon = { Icon(Icons.Outlined.Search, null, tint = c.textTertiary) }) }
    if (CityDatabase.normalize(q).length >= 2) {
      items(res.first) { ch -> DSCard { DSRow(Icons.Outlined.MenuBook, ch.title, hisnCountLabel(ch.items.size), onClick = { onChapter(ch) }) { DSChevron() } } }
      items(res.second) { (item, ch) ->
        DSTile(onClick = { onChapter(ch) }) {
          Column(Modifier.fillMaxWidth()) {
            Text(item.text.take(110), style = DSType.readingSm, color = c.textPrimary, maxLines = 2)
            Text(ch.title, style = DSType.labelXs, color = c.textSecondary)
          }
        }
      }
      if (res.first.isEmpty() && res.second.isEmpty()) item { Text("لا نتائج، جرّب كلمة أخرى", style = DSType.bodySm, color = c.textTertiary) }
    } else {
      // شرائح الموضوعات: «الكل» ثم الثمانية — المختار يصفّي الأقسام دون أن يخفي البحث
      item {
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          DSChip("كل الأبواب", on = themeIdx == null) { themeIdx = null }
          hisnThemes.forEachIndexed { i, t -> DSChip(t.title, on = themeIdx == i) { themeIdx = i } }
        }
      }
      if (themeIdx == null && Store.hisnFavorites.isNotEmpty()) {
        item { Text("المفضّلة", style = DSType.headingSm, color = c.textPrimary, modifier = Modifier.padding(top = 8.dp)) }
        items(Store.hisnFavorites.mapNotNull { Hisn.chapter(it) }) { ch -> DSCard { DSRow(Icons.Filled.Favorite, ch.title, hisnCountLabel(ch.items.size), iconStyle = IconStyle.GoldSoft, onClick = { onChapter(ch) }) { DSChevron() } } }
      }
      for (s in shownSections) {
        item { Text(s.title, style = DSType.headingSm, color = c.brandPrimary, modifier = Modifier.padding(top = 12.dp)) }
        items(s.chapters.mapNotNull { Hisn.chapter(it) }) { ch ->
          DSCard { DSRow(Icons.Outlined.MenuBook, ch.title, hisnCountLabel(ch.items.size), onClick = { onChapter(ch) }) {
            Text(Fmt.number(ch.id), style = DSType.labelSm, color = c.textTertiary); Spacer(Modifier.width(6.dp)); DSChevron()
          } }
        }
      }
      item { Text("${Fmt.number(Hisn.chapters.size)} بابًا و${Fmt.number(Hisn.itemCount)} ذكرًا من «حصن المسلم».", style = DSType.labelXs, color = c.textTertiary) }
    }
  }
}

@Composable fun HisnChapterScreen(chapter: HisnChapter, onBack: () -> Unit) {
  val c = DS.c
  val counts = remember(chapter.id) { mutableStateMapOf<Int, Int>() }
  val fav = chapter.id in Store.hisnFavorites
  LazyColumn(Modifier.fillMaxSize().background(c.bgCanvas), contentPadding = PaddingValues(16.dp, 0.dp, 16.dp, 32.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
    item {
      DSNavBar(chapter.title, subtitle = "الباب ${Fmt.number(chapter.id)}، ${hisnCountLabel(chapter.items.size)}", onBack = onBack) {
        DSIconButton(if (fav) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder, contentDescription = if (fav) "إزالة من المفضّلة" else "إضافة إلى المفضّلة", style = if (fav) IconStyle.Brand else IconStyle.Outlined) {
          Store.hisnFavorites = if (fav) Store.hisnFavorites - chapter.id else Store.hisnFavorites + chapter.id; Store.save()
        }
      }
    }
    items(chapter.items) { item ->
      val n = counts[item.id] ?: 0
      DhikrCard(item.text, item.repeatCount, n, null, null) { counts[item.id] = if (n >= item.repeatCount) 0 else n + 1 }
    }
    item { Text("حصن المسلم من أذكار الكتاب والسنة — الشيخ سعيد بن علي بن وهف القحطاني.", style = DSType.labelXs, color = c.textTertiary) }
  }
}

/**
 * المسبحة (المرحلة الخامسة — tasbih.png): رجوعٌ إلى القسم الذي فُتحت منه، «تراجع» و«تصفير»، شرائح الصيغ، قرصٌ كبير
 * (النقر في أي مكانٍ من الشاشة يعدّ)، بلاطات اليوم والأسبوع والإجمالي، «آخر سبعة أيام» من سجلٍّ يوميٍّ على الجهاز وحده، والإعدادات.
 */
@Composable fun TasbihScreen(backLabel: String = "الذكر", onBack: () -> Unit) {
  val c = DS.c; val view = LocalView.current; val ctx = LocalContext.current
  val st = Store.tasbih; val key = Store.todayKey
  var custom by remember { mutableStateOf(false) }
  var customText by remember { mutableStateOf(st.custom) }
  var reached by remember { mutableStateOf(false) }
  LaunchedEffect(reached) { if (reached) { kotlinx.coroutines.delay(260); reached = false } }
  val pct by animateFloatAsState(if (st.target > 0) (st.count.toFloat() / st.target).coerceIn(0f, 1f) else 0f, label = "tasbih")
  val pop by animateFloatAsState(if (reached) 1.03f else 1f, label = "tasbihPop")
  val audio = remember { ctx.getSystemService(AudioManager::class.java) }

  fun tap() {
    // السجلّ اليوميّ قبل عدّادات النواة (كي لا يُحسب العدّ مرّتين)؛ واليوم يُقرأ لحظة النقر (الشاشة قد تبقى مفتوحة بعد منتصف الليل)
    val day = Store.todayKey
    Store.bumpTasbihDay(day, 1)
    val r = Tasbih.tap(Store.tasbih, day); Store.tasbih = r.first; Store.save()
    if (r.second) reached = true
    // نقرةٌ خفيفة مع كل عدّة إن اختيرت، واهتزازٌ أوضح عند تمام الدورة دائماً
    if (r.second) view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
    else if (Store.haptics) view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
    if (Store.tasbihSound) runCatching { audio?.playSoundEffect(AudioManager.FX_KEY_CLICK, 0.6f) }
  }
  fun undo() { val s = Store.tasbih; val day = Store.todayKey; if (s.count > 0 || s.rounds > 0) { Store.bumpTasbihDay(day, -1); Store.tasbih = Tasbih.undo(s, day); Store.save() } }

  val roundLine = if (st.target > 0) "من ${Fmt.grouped(st.target)}، الدورة ${Fmt.number(st.rounds + 1)}" else "بلا حدّ"
  // النقر في أي مكانٍ فارغٍ من الشاشة يعدّ (الأزرار والشرائح والمفاتيح تأخذ نقرها لنفسها، والتمرير لا يعدّ)
  Column(Modifier.fillMaxSize().background(c.bgCanvas).pointerInput(Unit) { detectTapGestures(onTap = { tap() }) }.verticalScroll(rememberScrollState()).padding(bottom = 32.dp)) {
    Row(Modifier.fillMaxWidth().padding(start = 10.dp, end = 16.dp, top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
      DSBackLink(backLabel, onClick = onBack)
      Spacer(Modifier.weight(1f))
      SmallPill("تراجع", "تراجع عن آخر عدّة") { undo() }
      Spacer(Modifier.width(8.dp))
      SmallPill("تصفير", "تصفير العدّ الحاليّ") { Store.tasbih = Tasbih.reset(Store.tasbih); Store.save() }
    }
    Text("المسبحة", Modifier.padding(horizontal = 20.dp).padding(top = 2.dp, bottom = 12.dp), style = DSType.displayLg, color = c.textPrimary)
    // شرائح الصيغ: تبدأ من اليمين وتمرّر أفقياً، وآخرها «ذكر آخر…»
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      for (p in Tasbih.phrases) {
        val label = if (p.id == "custom") st.custom.ifEmpty { "ذكر آخر…" } else plainArabic(p.text)
        DSPillChip(label, on = st.phrase == p.id) {
          if (p.id == "custom") { customText = st.custom; custom = true } else { Store.tasbih = st.copy(phrase = p.id, count = 0, rounds = 0); Store.save() }
        }
      }
    }
    Spacer(Modifier.height(22.dp))
    // القرص: حلقة تقدّم الدورة، والصيغة والعدد ومكان الدورة في وسطه
    Box(Modifier.align(Alignment.CenterHorizontally).size(250.dp).scale(pop).clip(CircleShape)
      .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, role = Role.Button, onClickLabel = "عدّ") { tap() }
      .semantics(mergeDescendants = true) { contentDescription = "${plainArabic(Tasbih.phraseText(st))}، ${st.count}، $roundLine" }, contentAlignment = Alignment.Center) {
      RingProgress(pct, Modifier.fillMaxSize(), tint = c.brandPrimary, track = c.bgSubtle, stroke = 14.dp)
      Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(Tasbih.phraseText(st), fontFamily = Fonts.amiri, fontSize = 18.sp, color = c.textSecondary, textAlign = TextAlign.Center, maxLines = 2, modifier = Modifier.padding(horizontal = 36.dp))
        Spacer(Modifier.height(2.dp))
        Text(Fmt.grouped(st.count), style = DSType.numericHero.copy(fontSize = 64.sp), color = c.textPrimary, maxLines = 1)
        Text(roundLine, style = DSType.labelSm, color = c.textSecondary)
      }
    }
    Spacer(Modifier.height(12.dp))
    Text("انقر في أي مكان للعدّ، واهتزازٌ خفيف عند تمام الدورة", Modifier.fillMaxWidth().padding(horizontal = 20.dp), style = DSType.labelXs, color = c.textTertiary, textAlign = TextAlign.Center)
    Spacer(Modifier.height(18.dp))
    Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
      Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        TasbihStat(Fmt.grouped(Store.tasbihOn(key)), "اليوم", Modifier.weight(1f))
        TasbihStat(Fmt.grouped(tasbihWeekTotal()), "هذا الأسبوع", Modifier.weight(1f))
        TasbihStat(Fmt.grouped(Tasbih.grandTotal(st)), "الإجمالي", Modifier.weight(1f))
      }
      TasbihWeekChart()
      // الإعدادات تأخذ نقرها لنفسها: لا يعدّ نقرٌ على حشوتها
      DSCard(Modifier.fillMaxWidth().clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}, padding = 16.dp) {
        Text("الهدف", style = DSType.headingSm, color = c.textPrimary)
        Spacer(Modifier.height(10.dp))
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          for (t in Tasbih.targets) DSPillChip(if (t > 0) Fmt.grouped(t) else "بلا حدّ", on = st.target == t, style = DSType.numericSm) {
            Store.tasbih = st.copy(target = t, count = 0, rounds = 0); Store.save()
          }
        }
        Spacer(Modifier.height(6.dp))
        DSToggleRow("اهتزاز عند كل عدّة", null, Store.haptics) { Store.haptics = it; Store.save() }
        DSToggleRow("صوت النقر", null, Store.tasbihSound) { Store.tasbihSound = it; Store.save() }
      }
    }
    Spacer(Modifier.navigationBarsPadding())
  }
  if (custom) AlertDialog(
    onDismissRequest = { custom = false },
    title = { Text("ذكر مخصّص", style = DSType.headingSm) },
    text = { OutlinedTextField(customText, { customText = it }, placeholder = { Text("مثال: حسبي الله ونعم الوكيل") }, singleLine = true) },
    confirmButton = { TextButton(onClick = { if (customText.isNotBlank()) { Store.tasbih = Store.tasbih.copy(phrase = "custom", custom = customText.trim(), count = 0, rounds = 0); Store.save() }; custom = false }) { Text("اعتماد") } },
    dismissButton = { TextButton(onClick = { custom = false }) { Text("إلغاء") } },
    containerColor = c.bgSurface
  )
}
@Composable private fun SmallPill(label: String, a11y: String, onClick: () -> Unit) {
  val c = DS.c
  Box(Modifier.heightIn(min = 40.dp).clip(CircleShape).background(c.bgSurface).border(1.dp, c.borderSubtle, CircleShape).clickable(role = Role.Button, onClickLabel = a11y, onClick = onClick).padding(horizontal = 18.dp, vertical = 8.dp), contentAlignment = Alignment.Center) {
    Text(label, style = DSType.labelMd, color = c.textPrimary)
  }
}
@Composable private fun TasbihStat(value: String, label: String, modifier: Modifier = Modifier) {
  val c = DS.c
  DSTile(modifier, padding = 0.dp, radius = 20.dp) {
    Column(Modifier.fillMaxWidth().padding(vertical = 14.dp, horizontal = 6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
      Text(value, style = DSType.numericMd.copy(fontWeight = FontWeight.SemiBold), color = c.textPrimary, maxLines = 1)
      Text(label, style = DSType.labelXs, color = c.textSecondary, maxLines = 1)
    }
  }
}
/** «آخر سبعة أيام»: مجموع كل الصيغ لكل يوم من سجلّ المسبحة اليوميّ — الأقدم يميناً واليوم ذهبيّ في آخرها */
@Composable private fun TasbihWeekChart() {
  val c = DS.c; val today = Store.todayKey
  val days = (6 downTo 0).map { DayKey.adding(today, -it) }
  val values = days.map { Store.tasbihOn(it) }
  val max = maxOf(1, values.maxOrNull() ?: 0)
  DSCard(Modifier.fillMaxWidth(), padding = 16.dp) {
    Text("آخر سبعة أيام", style = DSType.headingSm, color = c.textPrimary)
    Spacer(Modifier.height(14.dp))
    Row(Modifier.fillMaxWidth().height(120.dp), verticalAlignment = Alignment.Bottom) {
      days.forEachIndexed { i, d ->
        val v = values[i]; val isToday = d == today
        Column(Modifier.weight(1f).fillMaxHeight().semantics(mergeDescendants = true) { contentDescription = "${if (isToday) "اليوم" else AdhkarStreak.letter(d)}: $v" }, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Bottom) {
          val h = if (v == 0) 4.dp else (6f + 86f * v / max).dp
          Box(Modifier.width(26.dp).height(h).clip(RoundedCornerShape(8.dp)).background(when { v == 0 -> c.bgSubtle; isToday -> c.accentGold; else -> c.brandPrimary }))
          Spacer(Modifier.height(8.dp))
          Text(AdhkarStreak.letter(d), style = DSType.labelXs, color = if (isToday) c.accentGoldStrong else c.textTertiary)
        }
      }
    }
    Spacer(Modifier.height(12.dp))
    Text("يُحفظ على جهازك وحده.", style = DSType.labelXs, color = c.textSecondary)
  }
}
