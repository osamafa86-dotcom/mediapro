package org.emdatra.sakinah.app.ui

import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import android.view.HapticFeedbackConstants
import org.emdatra.sakinah.app.Fmt
import org.emdatra.sakinah.app.Fonts
import org.emdatra.sakinah.app.Store
import org.emdatra.sakinah.app.ShareCard
import org.emdatra.sakinah.app.Notify
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

/** الأذكار: الرئيسية، جلسة الذكر، حصن المسلم، والمسبحة */
@Composable fun AdhkarHome() {
  var screen by remember { mutableStateOf("home") }
  var chapter by remember { mutableStateOf<HisnChapter?>(null) }
  var session by remember { mutableStateOf<String?>(null) }
  BackHandler(screen != "home" || chapter != null || session != null) {
    when { session != null -> session = null; chapter != null -> chapter = null; else -> screen = "home" }
  }
  when {
    session != null -> DhikrSession(session!!) { session = null }
    chapter != null -> HisnChapterScreen(chapter!!) { chapter = null }
    screen == "hisn" -> HisnScreen(onBack = { screen = "home" }) { chapter = it }
    screen == "tasbih" -> TasbihScreen { screen = "home" }
    else -> AdhkarDaily(onHisn = { screen = "hisn" }, onTasbih = { screen = "tasbih" }, onChapter = { chapter = it }, onSession = { session = it })
  }
}

/** شاشة الأذكار (تصميم Figma 07): بطاقتا الصباح والمساء، سلسلة الأيام، حصن المسلم، والمسبحة */
@Composable fun AdhkarDaily(onHisn: () -> Unit, onTasbih: () -> Unit, onChapter: (HisnChapter) -> Unit, onSession: (String) -> Unit) {
  val c = DS.c
  val ctx = LocalContext.current
  var searching by remember { mutableStateOf(false) }
  var q by remember { mutableStateOf("") }
  var reminders by remember { mutableStateOf(false) }
  LazyColumn(Modifier.fillMaxSize().background(c.bgCanvas), contentPadding = PaddingValues(16.dp, 0.dp, 16.dp, 32.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    item {
      DSNavBar("الأذكار") {
        DSIconButton(if (searching) Icons.Outlined.Close else Icons.Outlined.Search, contentDescription = if (searching) "إغلاق البحث" else "بحث") { searching = !searching; if (!searching) q = "" }
        Spacer(Modifier.width(8.dp))
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
      item { StreakCard() }
      item { HisnCard(onHisn, onChapter) }
      item { TasbihCard(onTasbih) }
      item { Text("النصوص من كتاب «حصن المسلم» للشيخ سعيد بن علي بن وهف القحطاني، بترتيبه وتخريجه.", style = DSType.labelXs, color = c.textTertiary, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) }
    }
  }
  if (reminders) AdhkarRemindersSheet(ctx) { reminders = false }
}

/** ورقة تذكيرات الأذكار: مفاتيح الصباح والمساء وحديث اليوم */
@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun AdhkarRemindersSheet(ctx: android.content.Context, onDismiss: () -> Unit) {
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

@Composable private fun PeriodCards(onSession: (String) -> Unit) {
  Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
    PeriodCard("evening", Modifier.weight(1f), onSession)
    PeriodCard("morning", Modifier.weight(1f), onSession)
  }
}

@Composable private fun PeriodCard(period: String, modifier: Modifier, onSession: (String) -> Unit) {
  val c = DS.c
  val list = Adhkar.items(period)
  val done = periodMap(adhkarProgressToday(), period)
  val completed = list.count { (done[it.id] ?: 0) >= it.target(period) }
  val pct = if (list.isEmpty()) 0f else completed.toFloat() / list.size
  val started = completed > 0
  val gold = period == "morning"
  DSCard(modifier) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
      Text("${Fmt.number((pct * 100).toInt())}٪", style = DSType.numericMd, color = if (gold) c.accentGoldStrong else c.brandPrimary)
      Spacer(Modifier.weight(1f))
      Box(Modifier.size(46.dp), contentAlignment = Alignment.Center) {
        RingProgress(pct, Modifier.fillMaxSize(), tint = if (gold) c.accentGold else c.brandPrimary, stroke = 4.dp)
        Icon(if (gold) Icons.Outlined.WbTwilight else Icons.Outlined.DarkMode, null, Modifier.size(18.dp), tint = if (gold) c.accentGoldStrong else c.brandPrimary)
      }
    }
    Spacer(Modifier.height(12.dp))
    Text(if (gold) "أذكار الصباح" else "أذكار المساء", style = DSType.headingSm, color = c.textPrimary)
    Text("${Fmt.number(completed)} من ${Fmt.number(list.size)} · ${windowLabel(period)}", style = DSType.labelXs, color = c.textSecondary, maxLines = 1)
    Spacer(Modifier.height(12.dp))
    DSButton(if (started) "متابعة" else "ابدأ", kind = if (gold) ButtonKind.Gold else ButtonKind.Soft, icon = Icons.Outlined.ChevronLeft, modifier = Modifier.fillMaxWidth()) { onSession(period) }
  }
}

private fun windowLabel(period: String): String {
  val tl = Store.timeline(); val now = Instant.now()
  val t = if (period == "morning") tl?.times?.get(Prayer.FAJR) else tl?.times?.get(Prayer.ASR)
  val fallback = if (period == "morning") "تبدأ بعد الفجر" else "تبدأ بعد العصر"
  if (t == null) return fallback
  return if (!now.isBefore(t)) "بدأت ${Fmt.time(t)}" else fallback
}

/** سلسلة الأيام: طول السلسلة، أطولها، وشريط سبعة أيام */
@Composable private fun StreakCard() {
  val c = DS.c
  val log = Store.adhkarLog; val today = Store.todayKey
  val days = AdhkarStreak.lastDays(log, today)
  val cur = AdhkarStreak.current(log, today)
  val best = maxOf(AdhkarStreak.longest(log), cur)
  val todayDone = !log[today].isNullOrEmpty()
  DSCard {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      if (best > 0) Text("الأطول ${Fmt.number(best)} يومًا", style = DSType.labelXs, color = c.textTertiary)
      Spacer(Modifier.weight(1f))
      Text(if (cur > 0) "سلسلة ${Fmt.number(cur)} ${dayWord(cur)}" else "ابدأ سلسلتك اليوم", style = DSType.headingSm, color = c.textPrimary)
      Spacer(Modifier.width(6.dp))
      Icon(Icons.Filled.LocalFireDepartment, null, Modifier.size(17.dp), tint = if (cur > 0) c.accentGoldStrong else c.textTertiary)
    }
    Spacer(Modifier.height(12.dp))
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
      for (d in days) {
        Box(
          Modifier.weight(1f).height(38.dp).clip(CircleShape)
            .background(if (d.done) c.brandPrimary else c.bgSubtle)
            .then(if (d.isToday && !d.done) Modifier.border(2.dp, c.accentGold, CircleShape) else Modifier),
          contentAlignment = Alignment.Center
        ) {
          if (d.done) Icon(Icons.Filled.Check, null, Modifier.size(16.dp), tint = c.textOnBrand)
          else Text(d.letter, style = DSType.labelXs, color = if (d.isToday) c.accentGoldStrong else c.textTertiary)
        }
      }
    }
    Spacer(Modifier.height(10.dp))
    Text(
      if (todayDone) "أحسنت — أذكار اليوم مكتملة، حافظ على السلسلة غدًا."
      else "أكمل أذكار اليوم لتحافظ على السلسلة" + (if (Store.extras.adhkarEvening) " · تذكير بعد العصر بـ${Fmt.number(Store.extras.eveningAfter)} د" else ""),
      style = DSType.labelXs, color = c.textSecondary
    )
  }
}
private fun dayWord(n: Int) = if (n == 1) "يوم" else if (n == 2) "يومان" else if (n <= 10) "أيام" else "يومًا"

@Composable private fun HisnCard(onAll: () -> Unit, onChapter: (HisnChapter) -> Unit) {
  val picks = if (Store.hisnFavorites.isNotEmpty()) Store.hisnFavorites.mapNotNull { Hisn.chapter(it) }.take(3)
              else listOfNotNull(Hisn.chapter(28), Hisn.chapter(30), Hisn.chapter(19))
  DSCard {
    DSSectionHead("حصن المسلم", link = "كل الأبواب (${Fmt.number(Hisn.chapters.size)})", onLink = onAll)
    Spacer(Modifier.height(4.dp))
    picks.forEachIndexed { i, ch ->
      if (i > 0) DSDivider()
      DSRow(chapterIcon(ch.id), ch.title, chapterHint(ch.id), onClick = { onChapter(ch) }) {
        Text(Fmt.number(ch.items.size), style = DSType.labelSm, color = DS.c.textTertiary)
        Spacer(Modifier.width(6.dp)); DSChevron()
      }
    }
  }
}
private fun chapterIcon(id: Int): ImageVector = when (id) {
  28 -> Icons.Outlined.Grain; 30 -> Icons.Outlined.DarkMode; 19 -> Icons.Outlined.Shield; else -> Icons.Outlined.MenuBook
}
private fun chapterHint(id: Int): String? = when (id) {
  28 -> "تسبيح وتحميد وتكبير"; 30 -> "ما يقال عند النوم"; 19 -> "والحزن"; else -> null
}
private fun hisnCountLabel(n: Int) = if (n == 1) "ذكر واحد" else if (n == 2) "ذكران" else if (n <= 10) "${Fmt.number(n)} أذكار" else "${Fmt.number(n)} ذكرًا"

@Composable private fun TasbihCard(onOpen: () -> Unit) {
  val c = DS.c; val st = Store.tasbih
  val pct = if (st.target > 0) st.count.toFloat() / st.target else 0f
  DSCard(onClick = onOpen) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      Box(Modifier.size(52.dp), contentAlignment = Alignment.Center) {
        RingProgress(pct, Modifier.fillMaxSize(), tint = c.accentGold, stroke = 4.dp)
        Text(Fmt.number(st.count), style = DSType.numericSm, color = c.textPrimary)
      }
      Spacer(Modifier.weight(1f))
      Column(horizontalAlignment = Alignment.End) {
        Text("المسبحة", style = DSType.headingSm, color = c.textPrimary)
        Text("${Tasbih.phraseText(st)} · اليوم ${Fmt.number(Tasbih.todayCount(st, Store.todayKey))} · الإجمالي ${Fmt.number(Tasbih.grandTotal(st))}", style = DSType.labelXs, color = c.textSecondary, maxLines = 1)
      }
    }
  }
}

/** جلسة الأذكار (تصميم Figma 08): ذكر واحد، شريط تقدّم مقسّم، عدّاد بحلقة ذهبية، والنقر في أي مكان يعدّ */
@Composable fun DhikrSession(period: String, onClose: () -> Unit) {
  val c = DS.c; val ctx = LocalContext.current; val view = LocalView.current
  val list = Adhkar.items(period)
  val title = if (period == "morning") "أذكار الصباح" else "أذكار المساء"
  var index by remember { mutableIntStateOf(0) }
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
        Text("${Fmt.number(index + 1)} من ${Fmt.number(list.size)} · بقي نحو ${Fmt.number(maxOf(1, (list.size - completed) / 5))} دقائق", style = DSType.labelXs, color = c.textSecondary)
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
      Text("انقر في أي مكان للعدّ · اهتزاز خفيف عند الاكتمال", style = DSType.labelXs, color = c.textTertiary)
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
      DSIconButton(if (fav) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder, contentDescription = "مفضلة", size = 38.dp, style = if (fav) IconStyle.Brand else IconStyle.Soft) {
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

@Composable fun HisnScreen(onBack: () -> Unit, onChapter: (HisnChapter) -> Unit) {
  val c = DS.c
  var q by remember { mutableStateOf("") }
  val res = remember(q) { Hisn.search(q) }
  LazyColumn(Modifier.fillMaxSize().background(c.bgCanvas), contentPadding = PaddingValues(16.dp, 0.dp, 16.dp, 32.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
    item { DSNavBar("حصن المسلم", onBack = onBack) }
    item { OutlinedTextField(q, { q = it }, Modifier.fillMaxWidth(), placeholder = { Text("ابحث في الأبواب والأذكار…", style = DSType.bodyMd) }, singleLine = true, shape = DS.shapeMd) }
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
    } else {
      if (Store.hisnFavorites.isNotEmpty()) {
        item { Text("♥ المفضلة", style = DSType.headingSm, color = c.textPrimary, modifier = Modifier.padding(top = 8.dp)) }
        items(Store.hisnFavorites.mapNotNull { Hisn.chapter(it) }) { ch -> DSCard { DSRow(Icons.Outlined.MenuBook, ch.title, hisnCountLabel(ch.items.size), onClick = { onChapter(ch) }) { DSChevron() } } }
      }
      for (s in Hisn.sections) {
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
      DSNavBar(chapter.title, subtitle = "الباب ${Fmt.number(chapter.id)} · ${hisnCountLabel(chapter.items.size)}", onBack = onBack) {
        DSIconButton(if (fav) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder, contentDescription = "مفضلة", style = if (fav) IconStyle.Brand else IconStyle.Outlined) {
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

/** المسبحة (تصميم Figma 09): شرائط الصيغ، قرص كبير بحلقة ذهبية، بلاطات إحصاء، وبطاقة إعدادات */
@Composable fun TasbihScreen(onBack: () -> Unit) {
  val c = DS.c; val view = LocalView.current
  val st = Store.tasbih; val key = Store.todayKey
  var custom by remember { mutableStateOf(false) }
  var customText by remember { mutableStateOf(st.custom) }
  var showTargets by remember { mutableStateOf(false) }
  var reached by remember { mutableStateOf(false) }
  val pct by animateFloatAsState(if (st.target > 0) (st.count.toFloat() / st.target).coerceIn(0f, 1f) else 0f, label = "tasbih")

  fun tap() {
    val r = Tasbih.tap(Store.tasbih, key); Store.tasbih = r.first; Store.save()
    reached = r.second
    if (Store.haptics) view.performHapticFeedback(if (r.second) HapticFeedbackConstants.LONG_PRESS else HapticFeedbackConstants.KEYBOARD_TAP)
  }

  LazyColumn(Modifier.fillMaxSize().background(c.bgCanvas), contentPadding = PaddingValues(16.dp, 0.dp, 16.dp, 32.dp), verticalArrangement = Arrangement.spacedBy(14.dp), horizontalAlignment = Alignment.CenterHorizontally) {
    item {
      DSNavBar("المسبحة", onBack = onBack) {
        DSIconButton(Icons.Outlined.Refresh, contentDescription = "تصفير") { Store.tasbih = Tasbih.reset(st); Store.save() }
        Spacer(Modifier.width(8.dp))
        DSIconButton(Icons.Outlined.Undo, contentDescription = "تراجع") { Store.tasbih = Tasbih.undo(st, key); Store.save() }
      }
    }
    item {
      Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        for (p in Tasbih.phrases) {
          DSChip(if (p.id == "custom") st.custom.ifEmpty { "ذكر آخر…" } else p.text, on = st.phrase == p.id) {
            if (p.id == "custom") custom = true else { Store.tasbih = st.copy(phrase = p.id, count = 0, rounds = 0); Store.save() }
          }
        }
      }
    }
    item {
      Box(Modifier.size(240.dp).scale(if (reached) 1.03f else 1f).clickable { tap() }, contentAlignment = Alignment.Center) {
        Box(Modifier.fillMaxSize().clip(CircleShape).background(c.bgSurface))
        RingProgress(pct, Modifier.fillMaxSize(), tint = c.accentGold, stroke = 12.dp)
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
          Text(Tasbih.phraseText(st), fontFamily = Fonts.amiri, fontSize = 19.sp, color = c.brandPrimary, textAlign = TextAlign.Center, maxLines = 2, modifier = Modifier.padding(horizontal = 28.dp))
          Spacer(Modifier.height(6.dp))
          Text(Fmt.number(st.count), style = DSType.numericHero, color = c.textPrimary)
          Text(if (st.target > 0) "من ${Fmt.number(st.target)} · الدورة ${Fmt.number(st.rounds + 1)}" else "بلا حدّ", style = DSType.labelSm, color = c.textSecondary)
        }
      }
    }
    item { Text("انقر الدائرة للعدّ", style = DSType.labelXs, color = c.textTertiary) }
    item {
      Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        DSStatTile(Fmt.number(Tasbih.grandTotal(st)), "الإجمالي", Modifier.weight(1f))
        DSStatTile(Fmt.number(st.rounds), "دورات", Modifier.weight(1f))
        DSStatTile(Fmt.number(Tasbih.todayCount(st, key)), "اليوم", Modifier.weight(1f))
      }
    }
    item {
      DSCard {
        DSToggleRow("اهتزاز عند كل عدّة", "واهتزاز أقوى عند الاكتمال", Store.haptics, Icons.Outlined.Bolt) { Store.haptics = it; Store.save() }
        DSDivider()
        DSToggleRow("صوت النقر", if (Store.tasbihSound) "مفعّل" else "مطفأ", Store.tasbihSound, Icons.Outlined.VolumeUp) { Store.tasbihSound = it; Store.save() }
        DSDivider()
        DSRow(Icons.Outlined.TrackChanges, "الهدف", if (st.target > 0) "${Fmt.number(st.target)} لكل دورة" else "بلا حدّ", onClick = { showTargets = !showTargets }) {
          Text(if (st.target > 0) Fmt.number(st.target) else "∞", style = DSType.labelSm, color = c.brandPrimary, modifier = Modifier.clip(CircleShape).background(c.brandSoft).padding(12.dp, 5.dp))
        }
        if (showTargets) {
          Spacer(Modifier.height(4.dp))
          Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for (t in Tasbih.targets) DSChip(if (t > 0) Fmt.number(t) else "بلا حدّ", on = st.target == t) {
              Store.tasbih = st.copy(target = t, count = 0, rounds = 0); Store.save(); showTargets = false
            }
          }
        }
      }
    }
    item { Text("الإحصاءات تُحفظ على جهازك فقط.", style = DSType.labelXs, color = c.textTertiary) }
  }
  if (custom) AlertDialog(
    onDismissRequest = { custom = false },
    title = { Text("ذكر مخصّص", style = DSType.headingSm) },
    text = { OutlinedTextField(customText, { customText = it }, placeholder = { Text("مثال: حسبي الله ونعم الوكيل") }, singleLine = true) },
    confirmButton = { TextButton(onClick = { if (customText.isNotBlank()) { Store.tasbih = st.copy(phrase = "custom", custom = customText.trim(), count = 0, rounds = 0); Store.save() }; custom = false }) { Text("اعتماد") } },
    dismissButton = { TextButton(onClick = { custom = false }) { Text("إلغاء") } },
    containerColor = c.bgSurface
  )
}
