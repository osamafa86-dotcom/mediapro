package org.emdatra.sakinah.app.ui

import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.emdatra.sakinah.app.Fmt
import org.emdatra.sakinah.app.Fonts
import org.emdatra.sakinah.app.Store
import org.emdatra.sakinah.app.ShareCard
import org.emdatra.sakinah.core.*
import java.time.Instant

/** الأذكار: الصباح والمساء بعدّاد يومي، ومداخل حصن المسلم والمسبحة */
@Composable fun AdhkarHome() {
  var screen by remember { mutableStateOf("home") }; var chapter by remember { mutableStateOf<HisnChapter?>(null) }
  BackHandler(screen != "home" || chapter != null) { if (chapter != null) chapter = null else screen = "home" }
  when {
    chapter != null -> HisnChapterScreen(chapter!!) { chapter = null }
    screen == "hisn" -> HisnScreen { chapter = it }
    screen == "tasbih" -> TasbihScreen()
    else -> AdhkarDaily(onHisn = { screen = "hisn" }, onTasbih = { screen = "tasbih" })
  }
}
@Composable fun AdhkarDaily(onHisn: () -> Unit, onTasbih: () -> Unit) {
  val tl = Store.timeline(); val now = Instant.now()
  var period by remember { mutableStateOf(Adhkar.autoPeriod(now, tl?.times?.get(Prayer.FAJR), tl?.times?.get(Prayer.DHUHR), tl?.times?.get(Prayer.ASR), Store.zone)) }
  val key = Store.todayKey
  fun current(): WebSettings.AdhkarProgress { var p = Store.adhkarProgress; val afterFajr = tl?.times?.get(Prayer.FAJR)?.let { !now.isBefore(it) } ?: true; if (p.date != key) p = WebSettings.AdhkarProgress(key, emptyMap(), if (afterFajr) emptyMap() else (p.evening ?: emptyMap()), if (afterFajr) key else (p.eveningDate ?: p.date ?: key)) else if (afterFajr && p.eveningDate != null && p.eveningDate != key) p = p.copy(evening = emptyMap(), eveningDate = key); return p }
  val prog = current(); val done = (if (period == "evening") prog.evening else prog.morning) ?: emptyMap()
  val list = Adhkar.items(period); val completed = list.count { (done[it.id] ?: 0) >= it.target(period) }
  LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
    item { Row(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) { Card(Modifier.weight(1f).clickable(onClick = onHisn)) { Column(Modifier.padding(14.dp), horizontalAlignment = Alignment.CenterHorizontally) { Icon(Icons.Filled.MenuBook, null, tint = Teal); Text("حصن المسلم", fontWeight = FontWeight.Bold); Text("الكتاب كاملًا: ١٣٢ بابًا", fontSize = 11.sp) } }; Card(Modifier.weight(1f).clickable(onClick = onTasbih)) { Column(Modifier.padding(14.dp), horizontalAlignment = Alignment.CenterHorizontally) { Icon(Icons.Filled.Apps, null, tint = Teal); Text("المسبحة", fontWeight = FontWeight.Bold); Text("عدّاد التسبيح", fontSize = 11.sp) } } } }
    item { Row { FilterChip(period == "morning", { period = "morning" }, { Text("☀️ أذكار الصباح") }, Modifier.padding(end = 6.dp)); FilterChip(period == "evening", { period = "evening" }, { Text("🌙 أذكار المساء") }) } }
    item { Card(Modifier.fillMaxWidth()) { Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) { CircularProgressIndicator({ if (list.isEmpty()) 0f else completed.toFloat() / list.size }, Modifier.size(56.dp), color = Teal); Spacer(Modifier.width(12.dp)); Column(Modifier.weight(1f)) { Text("${Fmt.number(completed)}/${Fmt.number(list.size)} · ${if (period == "morning") "أذكار الصباح" else "أذكار المساء"}", fontWeight = FontWeight.Bold); Text(if (period == "morning") "من بعد الفجر إلى طلوع الشمس، وتُجزئ إلى الزوال" else "من بعد العصر إلى الغروب، وتُجزئ إلى منتصف الليل", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }; TextButton(onClick = { var p = current(); p = if (period == "evening") p.copy(evening = emptyMap()) else p.copy(morning = emptyMap()); Store.adhkarProgress = p; Store.save() }) { Text("إعادة") } } } }
    items(list) { d ->
      val tgt = d.target(period); val c = done[d.id] ?: 0
      DhikrCard(d.text(period), tgt, c, d.virtue, d.reference) { if (c < tgt) { var p = current(); p = if (period == "evening") p.copy(evening = (p.evening ?: emptyMap()) + (d.id to c + 1)) else p.copy(morning = (p.morning ?: emptyMap()) + (d.id to c + 1)); Store.adhkarProgress = p; Store.save() } }
    }
    item { Text("النصوص من كتاب «حصن المسلم» للشيخ سعيد بن علي القحطاني، بترتيبه وتخريجه.", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 24.dp)) }
  }
}
@Composable fun DhikrCard(text: String, target: Int, count: Int, virtue: String?, reference: String?, onTap: () -> Unit) {
  val ctx = LocalContext.current; val done = count >= target; val scale = Store.textScale
  Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = if (done) Teal.copy(alpha = 0.08f) else MaterialTheme.colorScheme.surface)) {
    Column(Modifier.padding(14.dp).clickable(onClick = onTap)) {
      Text(buildAnnotatedString { var inAyah = false; for (ch in text) { if (ch == '﴿') inAyah = true; if (inAyah) withStyle(SpanStyle(color = Gold)) { append(ch) } else append(ch); if (ch == '﴾') inAyah = false } }, fontSize = (17 * scale).sp, lineHeight = (32 * scale).sp)
      if (virtue != null) Text("✦ $virtue", fontSize = 13.sp, color = Teal, modifier = Modifier.padding(top = 6.dp))
      Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.Bottom) {
        Column(Modifier.weight(1f)) { if (reference != null) Text(reference, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant); Text("يُقال ${if (target == 1) "مرة واحدة" else if (target == 2) "مرتين" else if (target <= 10) "${Fmt.number(target)} مرات" else "${Fmt.number(target)} مرة"}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
          Row { IconButton(onClick = { (ctx.getSystemService(android.content.ClipboardManager::class.java)).setPrimaryClip(android.content.ClipData.newPlainText("ذكر", text)) }) { Icon(Icons.Filled.ContentCopy, "نسخ", Modifier.size(18.dp)) }; IconButton(onClick = { ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, "$text\n\n${reference ?: ""}"), "مشاركة")) }) { Icon(Icons.Filled.Share, "مشاركة", Modifier.size(18.dp)) }; IconButton(onClick = { ShareCard.share(ctx, ShareCard.render(ctx, "من الأذكار", text, reference ?: "", false), "dhikr.png", "$text\n\n${reference ?: ""}") }) { Icon(Icons.Filled.Image, "مشاركة كصورة", Modifier.size(18.dp)) } } }
        Box(Modifier.size(64.dp).background(if (done) Teal else Teal.copy(alpha = 0.12f), CircleShape).clickable(onClick = onTap), contentAlignment = Alignment.Center) { if (done) Icon(Icons.Filled.Check, null, tint = Paper) else Text(Fmt.number(maxOf(0, target - count)), fontWeight = FontWeight.Bold, fontSize = 20.sp) }
      }
    }
  }
}
@Composable fun HisnScreen(onChapter: (HisnChapter) -> Unit) {
  var q by remember { mutableStateOf("") }
  val res = remember(q) { Hisn.search(q) }
  LazyColumn(Modifier.fillMaxSize().padding(horizontal = 12.dp)) {
    item { OutlinedTextField(q, { q = it }, Modifier.fillMaxWidth().padding(top = 12.dp), placeholder = { Text("ابحث في الأبواب والأذكار…") }, singleLine = true) }
    if (CityDatabase.normalize(q).length >= 2) {
      items(res.first) { c -> ListItem(headlineContent = { Text(c.title) }, leadingContent = { Text(Fmt.number(c.id)) }, modifier = Modifier.clickable { onChapter(c) }) }
      items(res.second) { (it, c) -> ListItem(headlineContent = { Text(it.text.take(110), maxLines = 2) }, supportingContent = { Text(c.title) }, modifier = Modifier.clickable { onChapter(c) }) }
    } else {
      if (Store.hisnFavorites.isNotEmpty()) { item { Text("♥ المفضلة", fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 12.dp)) }; items(Store.hisnFavorites.mapNotNull { Hisn.chapter(it) }) { c -> ListItem(headlineContent = { Text(c.title) }, leadingContent = { Text(Fmt.number(c.id)) }, modifier = Modifier.clickable { onChapter(c) }) } }
      for (s in Hisn.sections) { item { Text(s.title, fontWeight = FontWeight.Bold, color = Teal, modifier = Modifier.padding(top = 12.dp)) }; items(s.chapters.mapNotNull { Hisn.chapter(it) }) { c -> ListItem(headlineContent = { Text(c.title) }, supportingContent = { Text("${Fmt.number(c.items.size)} ذكر") }, leadingContent = { Text(Fmt.number(c.id)) }, modifier = Modifier.clickable { onChapter(c) }) } }
    }
    item { Spacer(Modifier.height(24.dp)) }
  }
}
@Composable fun HisnChapterScreen(chapter: HisnChapter, onBack: () -> Unit) {
  val counts = remember(chapter.id) { mutableStateMapOf<Int, Int>() }
  val fav = chapter.id in Store.hisnFavorites
  Column(Modifier.fillMaxSize()) {
    Row(Modifier.fillMaxWidth().padding(4.dp), verticalAlignment = Alignment.CenterVertically) { IconButton(onClick = onBack) { Icon(Icons.Filled.ArrowForward, "رجوع") }; Text(chapter.title, Modifier.weight(1f), fontWeight = FontWeight.Bold); IconButton(onClick = { Store.hisnFavorites = if (fav) Store.hisnFavorites - chapter.id else Store.hisnFavorites + chapter.id; Store.save() }) { Icon(if (fav) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder, "مفضلة", tint = if (fav) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface) } }
    LazyColumn(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
      items(chapter.items) { it -> val c = counts[it.id] ?: 0; DhikrCard(it.text, it.repeatCount, c, null, null) { counts[it.id] = if (c >= it.repeatCount) 0 else c + 1 } }
      item { Text("حصن المسلم من أذكار الكتاب والسنة — الشيخ سعيد بن علي بن وهف القحطاني.", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 24.dp)) }
    }
  }
}
@Composable fun TasbihScreen() {
  val st = Store.tasbih; val key = Store.todayKey
  var custom by remember { mutableStateOf(false) }; var customText by remember { mutableStateOf(st.custom) }
  Column(Modifier.fillMaxSize().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
    Text(Tasbih.phraseText(st), fontFamily = Fonts.amiri, fontSize = 24.sp, modifier = Modifier.padding(vertical = 12.dp))
    Box(Modifier.size(230.dp).background(Teal.copy(alpha = 0.1f), CircleShape).clickable { val r = Tasbih.tap(Store.tasbih, key); Store.tasbih = r.first; Store.save() }, contentAlignment = Alignment.Center) {
      CircularProgressIndicator({ if (st.target > 0) st.count.toFloat() / st.target else 0f }, Modifier.fillMaxSize(), color = Teal, strokeWidth = 10.dp)
      Column(horizontalAlignment = Alignment.CenterHorizontally) { Text(Fmt.number(st.count), fontSize = 64.sp, fontWeight = FontWeight.Bold); Text(if (st.target > 0) "من ${Fmt.number(st.target)}" else "بلا حدّ", fontSize = 13.sp) }
    }
    Text(if (st.target > 0) "الدورة ${Fmt.number(st.rounds + 1)}" else "${Fmt.number(st.count)} تسبيحة", modifier = Modifier.padding(top = 10.dp))
    Row(Modifier.padding(top = 8.dp)) { OutlinedButton(onClick = { Store.tasbih = Tasbih.undo(st, key); Store.save() }) { Text("تراجع") }; Spacer(Modifier.width(8.dp)); OutlinedButton(onClick = { Store.tasbih = Tasbih.reset(st); Store.save() }) { Text("تصفير") } }
    Text("اليوم ${Fmt.number(Tasbih.todayCount(st, key))} · الإجمالي ${Fmt.number(Tasbih.totalCount(st))} · كل الأذكار ${Fmt.number(Tasbih.grandTotal(st))}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 6.dp))
    Row(Modifier.padding(top = 12.dp).horizontalScroll(rememberScrollState())) { for (p in Tasbih.phrases) FilterChip(st.phrase == p.id, { if (p.id == "custom") custom = true else { Store.tasbih = st.copy(phrase = p.id, count = 0, rounds = 0); Store.save() } }, { Text(if (p.id == "custom") (st.custom.ifEmpty { "ذكر آخر…" }) else p.text) }, Modifier.padding(end = 6.dp)) }
    Row(Modifier.padding(top = 8.dp)) { for (t in Tasbih.targets) FilterChip(st.target == t, { Store.tasbih = st.copy(target = t, count = 0, rounds = 0); Store.save() }, { Text(if (t > 0) Fmt.number(t) else "بلا حدّ") }, Modifier.padding(end = 6.dp)) }
  }
  if (custom) AlertDialog(onDismissRequest = { custom = false }, title = { Text("ذكر مخصّص") }, text = { OutlinedTextField(customText, { customText = it }, placeholder = { Text("مثال: حسبي الله ونعم الوكيل") }) }, confirmButton = { TextButton(onClick = { if (customText.isNotBlank()) { Store.tasbih = st.copy(phrase = "custom", custom = customText.trim(), count = 0, rounds = 0); Store.save() }; custom = false }) { Text("اعتماد") } })
}
