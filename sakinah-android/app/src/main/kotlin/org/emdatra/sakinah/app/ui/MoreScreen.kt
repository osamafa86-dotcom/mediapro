package org.emdatra.sakinah.app.ui

import android.Manifest
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationManagerCompat
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.emdatra.sakinah.app.*
import org.emdatra.sakinah.BuildConfig
import org.emdatra.sakinah.core.*
import java.time.Instant

/**
 * المكتبة (المرحلة الخامسة — library.png): حديث اليوم، «المحتوى» في شبكة ٢×٢، «الأدوات» (ومنها القبلة الكاملة)،
 * و«التطبيق» (الودجت والنشاط الحيّ، التنزيلات، النسخ الاحتياطي). الإعدادات من زرّ الرأس كما في «اليوم».
 */
@Composable fun LibraryScreen() {
  var screen by remember { mutableStateOf(if (ScreenshotMode.route == "library-qibla") "qibla" else "home") }
  var chapter by remember { mutableStateOf<HisnChapter?>(null) }
  BackHandler(screen != "home" || chapter != null) { if (chapter != null) chapter = null else screen = "home" }
  chapter?.let { ch -> HisnChapterScreen(ch) { chapter = null }; return }
  val home = { screen = "home" }
  when (screen) {
    "hadith" -> HadithScreen("sahih", onBack = home)
    "nawawi" -> HadithScreen("nawawi", onBack = home)
    "settings" -> SettingsScreen(backLabel = "المكتبة", onBack = home)
    "month" -> MonthTableScreen(home)
    "mosques" -> MosquesScreen(home)
    "hisn" -> HisnScreen(onBack = home) { chapter = it }
    "tasbih" -> TasbihScreen(backLabel = "المكتبة", onBack = home)
    "qibla" -> QiblaScreen(onClose = home)
    else -> LibraryHome(onOpen = { screen = it })
  }
}

@Composable private fun LibraryHome(onOpen: (String) -> Unit) {
  val c = DS.c
  val switchTab = LocalSwitchTab.current
  var sheet by remember { mutableStateOf<String?>(null) }
  LazyColumn(Modifier.fillMaxSize().background(c.bgCanvas), contentPadding = PaddingValues(16.dp, 0.dp, 16.dp, 32.dp), verticalArrangement = Arrangement.spacedBy(22.dp)) {
    item {
      DSPageHeader("المكتبة", "الحديث، والأوراد، والأدوات", Modifier.padding(horizontal = 4.dp)) {
        DSIconButton(Icons.Outlined.Tune, contentDescription = "الإعدادات") { onOpen("settings") }
      }
    }
    item {
      Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        DSSectionHead("حديث اليوم", Modifier.padding(horizontal = 4.dp), link = "الحديث", onLink = { onOpen("hadith") })
        TodayHadithCard(onOpen = { onOpen("hadith") })
      }
    }
    item {
      Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        DSSectionHead("المحتوى", Modifier.padding(horizontal = 4.dp))
        Row(Modifier.fillMaxWidth().height(IntrinsicSize.Max), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
          ContentCard(Icons.Outlined.HistoryEdu, "الحديث", "مختارات الصحيحين، ${hadithCount(HadithLibrary.hadiths.size)}", Modifier.weight(1f).fillMaxHeight()) { onOpen("hadith") }
          ContentCard(Icons.Outlined.FormatListNumbered, "الأربعون النووية", "${hadithCount(HadithLibrary.nawawi.size)} بمتونها وتخريجها", Modifier.weight(1f).fillMaxHeight()) { onOpen("nawawi") }
        }
        Row(Modifier.fillMaxWidth().height(IntrinsicSize.Max), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
          ContentCard(Icons.Outlined.Shield, "حصن المسلم", "${chaptersCount(Hisn.chapters.size)}، والمفضّلة", Modifier.weight(1f).fillMaxHeight()) { onOpen("hisn") }
          ContentCard(Icons.Outlined.MenuBook, "الختمة والأوراد", "الكهف يوم الجمعة، والملك ليلاً", Modifier.weight(1f).fillMaxHeight()) { sheet = "khatmah" }
        }
      }
    }
    item {
      Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        DSSectionHead("الأدوات", Modifier.padding(horizontal = 4.dp))
        DSCard(Modifier.fillMaxWidth(), padding = 6.dp) {
          LibRow(Icons.Outlined.Explore, "القبلة", "البوصلة، والشمس، والخريطة") { onOpen("qibla") }
          DSDivider()
          LibRow(Icons.Outlined.Grain, "المسبحة", "عدّاد، وهدف، وسجلّ الأسبوع") { onOpen("tasbih") }
          DSDivider()
          LibRow(Icons.Outlined.Mosque, "المساجد القريبة", "أقرب مسجد والاتجاه إليه") { onOpen("mosques") }
          DSDivider()
          LibRow(Icons.Outlined.CalendarMonth, "الجدول الشهري", "مواقيت الشهر، وتصديرها إلى التقويم") { onOpen("month") }
        }
      }
    }
    item {
      Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        DSSectionHead("التطبيق", Modifier.padding(horizontal = 4.dp))
        DSCard(Modifier.fillMaxWidth(), padding = 6.dp) {
          LibRow(Icons.Outlined.Widgets, "الودجت والنشاط الحيّ", "على الشاشة الرئيسة وشاشة القفل") { sheet = "widgets" }
          DSDivider()
          LibRow(Icons.Outlined.Download, "التنزيلات دون اتصال", downloadsLabel()) { sheet = "downloads" }
          DSDivider()
          LibRow(Icons.Outlined.Backup, "النسخ الاحتياطي", "تصدير إعداداتك واستيرادها") { sheet = "backup" }
        }
      }
    }
    item {
      Text("سكينة ${appVersion()}، يعمل دون اتصال، بلا إعلانات ولا تتبّع", style = DSType.labelXs, color = c.textTertiary, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
    }
  }
  when (sheet) {
    "khatmah" -> KhatmahSheet(onDismiss = { sheet = null }, onGo = { p -> sheet = null; Store.pendingReaderPage = p; switchTab(AppTab.Mushaf) })
    "downloads" -> DownloadsDialog { sheet = null }
    "widgets" -> WidgetsSheet { sheet = null }
    "backup" -> BackupSheetHost { sheet = null }
  }
}

/** بطاقة من شبكة «المحتوى»: مربّع أيقونة ناعم، عنوان، ووصف قصير */
@Composable private fun ContentCard(icon: ImageVector, title: String, subtitle: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
  val c = DS.c
  DSCard(modifier, padding = 16.dp, onClick = onClick) {
    DSSoftSquare(icon, size = 40.dp, iconSize = 19.dp)
    Spacer(Modifier.height(14.dp))
    Text(title, style = DSType.headingSm, color = c.textPrimary, maxLines = 1)
    Text(subtitle, style = DSType.labelXs, color = c.textSecondary, maxLines = 2)
  }
}
/** صفّ أداة: مربّع أيقونة، عنوان ووصف، وسهم */
@Composable private fun LibRow(icon: ImageVector, title: String, subtitle: String?, onClick: () -> Unit) {
  val c = DS.c
  Row(Modifier.fillMaxWidth().clip(DS.shapeMd).clickable(onClick = onClick).padding(horizontal = 10.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
    DSSoftSquare(icon, size = 40.dp, iconSize = 18.dp)
    Spacer(Modifier.width(12.dp))
    Column(Modifier.weight(1f)) {
      Text(title, style = DSType.labelMd.copy(fontWeight = FontWeight.SemiBold), color = c.textPrimary, maxLines = 1)
      if (subtitle != null) Text(subtitle, style = DSType.labelXs, color = c.textSecondary, maxLines = 1)
    }
    DSChevron()
  }
}

/** «الودجت والنشاط الحيّ»: إضافة الويدجتين إلى الشاشة الرئيسة (حيث يدعم المشغّل ذلك)، ومفتاح النشاط الحيّ نفسه الذي في الإعدادات */
@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun WidgetsSheet(onDismiss: () -> Unit) {
  val ctx = LocalContext.current; val c = DS.c
  val awm = remember { AppWidgetManager.getInstance(ctx) }
  val canPin = remember { runCatching { awm.isRequestPinAppWidgetSupported }.getOrDefault(false) }
  fun pin(cls: Class<*>) { runCatching { awm.requestPinAppWidget(ComponentName(ctx, cls), null, null) } }
  fun setLive(on: Boolean) { Store.liveUpdate = on; if (on) Store.hideLiveUntil(0L); Store.save(); LiveDay.refresh(ctx) }
  val livePermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok -> setLive(ok) }
  ModalBottomSheet(onDismissRequest = onDismiss, containerColor = c.bgCanvas) {
    Column(Modifier.fillMaxWidth().padding(16.dp, 0.dp, 16.dp, 28.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      Text("الودجت والنشاط الحيّ", style = DSType.headingMd, color = c.textPrimary)
      Text("يُحسب كلّ ما فيها على جهازك من مواقيتك، ويتجدّد وحده.", style = DSType.labelXs, color = c.textSecondary)
      DSCard(Modifier.fillMaxWidth(), padding = 6.dp) {
        DSRow(Icons.Outlined.Schedule, "ويدجت «الصلاة القادمة»", if (canPin) "أضِفه إلى الشاشة الرئيسة" else "من قائمة الودجت في الشاشة الرئيسة", onClick = if (canPin) ({ pin(org.emdatra.sakinah.app.widget.PrayerWidgetReceiver::class.java) }) else null) { if (canPin) DSChevron() }
        DSDivider()
        DSRow(Icons.Outlined.NightsStay, "ويدجت رمضان", if (canPin) "أيام رمضان والإفطار، أضِفه إلى الشاشة الرئيسة" else "من قائمة الودجت في الشاشة الرئيسة", onClick = if (canPin) ({ pin(org.emdatra.sakinah.app.widget.RamadanWidgetReceiver::class.java) }) else null) { if (canPin) DSChevron() }
        DSDivider()
        DSToggleRow("النشاط الحيّ في الإشعارات", "عدٌّ تنازليّ صامت للصلاة القادمة، يظهر على شاشة القفل", Store.liveUpdate, Icons.Outlined.Timelapse) { on ->
          if (on && Build.VERSION.SDK_INT >= 33 && !NotificationManagerCompat.from(ctx).areNotificationsEnabled()) livePermission.launch(Manifest.permission.POST_NOTIFICATIONS)
          else setLive(on)
        }
      }
      if (!canPin) Text("لإضافة ويدجت: اضغط مطوّلاً على الشاشة الرئيسة، ثم «الودجت»، وابحث عن «سكينة».", style = DSType.labelXs, color = c.textTertiary)
    }
  }
}

private fun appVersion(): String = BuildConfig.VERSION_NAME
private fun hadithCount(n: Int) = when { n == 1 -> "حديث واحد"; n == 2 -> "حديثان"; n % 100 in 3..10 -> "${Fmt.number(n)} أحاديث"; else -> "${Fmt.number(n)} حديثاً" }
private fun chaptersCount(n: Int) = when { n == 1 -> "باب واحد"; n == 2 -> "بابان"; n % 100 in 3..10 -> "${Fmt.number(n)} أبواب"; else -> "${Fmt.number(n)} باباً" }
private fun downloadsLabel(): String {
  val n = AudioDownloads.summary(Store.reciter).first
  val audio = if (n > 0) "${Fmt.number(n)} سورة محفوظة" else "لا تلاوات محفوظة بعد"
  return "$audio، وخطّ المصحف ${if (MushafFontPack.phase == MushafFontPack.Phase.READY) "محفوظ" else "لم يكتمل"}"
}

/** شاشة الحديث (تصميم Figma 11): بطاقة حديث اليوم بخلفية الليل، مبدّل المجموعة، شرائط التصنيف، وبطاقات الأحاديث */
@Composable fun HadithScreen(initial: String = "sahih", initialQuery: String = "", onBack: () -> Unit) {
  val ctx = LocalContext.current
  val c = DS.c
  var book by remember { mutableStateOf(initial) }
  var topic by remember { mutableStateOf("all") }
  // من البحث الشامل: يُفتح والبحث معبّأ بالاستعلام نفسه
  var q by remember { mutableStateOf(initialQuery) }
  var searching by remember { mutableStateOf(initialQuery.isNotBlank()) }
  val favs = Store.favorites.toSet()
  val today = CivilDate.of(Instant.now(), Store.zone)
  val daily = remember(today.key) { HadithLibrary.hadithOfDay(today.year, today.month, today.day) }

  LazyColumn(
    Modifier.fillMaxSize().background(c.bgCanvas),
    contentPadding = PaddingValues(16.dp, 0.dp, 16.dp, 32.dp),
    verticalArrangement = Arrangement.spacedBy(12.dp)
  ) {
    item {
      DSNavBar("الحديث", onBack = onBack) {
        DSIconButton(if (searching) Icons.Outlined.Close else Icons.Outlined.Search, contentDescription = "بحث") { searching = !searching; if (!searching) q = "" }
      }
    }
    if (searching) item {
      OutlinedTextField(q, { q = it }, Modifier.fillMaxWidth(), placeholder = { Text(if (book == "sahih") "ابحث في نص الحديث أو الراوي…" else "ابحث في الأربعين النووية…", style = DSType.bodyMd) }, singleLine = true, shape = DS.shapeMd)
    }
    if (book == "sahih" && q.isBlank() && topic == "all") item { DailyHadithCard(daily, ctx) }
    item {
      DSSegmented(listOf("الأربعون النووية", "مختارات الصحيحين"), if (book == "sahih") 1 else 0) {
        book = if (it == 1) "sahih" else "nawawi"; topic = "all"
      }
    }
    item {
      Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        DSChip("الكل", on = topic == "all") { topic = "all" }
        DSChip("المفضلة", on = topic == "fav", icon = Icons.Outlined.FavoriteBorder) { topic = "fav" }
        if (book == "sahih") for (t in HadithLibrary.topics) DSChip(t, on = topic == t) { topic = t }
      }
    }
    if (book == "sahih") {
      val list = HadithLibrary.searchSahih(q, if (topic == "all" || topic == "fav") null else topic, favs, topic == "fav")
      item { Text("${Fmt.number(list.size)} حديثًا، منقولة حرفيًا من الصحيحين بترقيم فتح الباري وعبد الباقي", style = DSType.labelXs, color = c.textTertiary) }
      items(list) { h -> HadithCard(h, favs, ctx) }
      if (list.isEmpty()) item { Text(if (topic == "fav") "لم تُضف أحاديث إلى المفضلة بعد" else "لا نتائج — جرّب كلمة أخرى", style = DSType.bodySm, color = c.textTertiary) }
    } else {
      val list = HadithLibrary.searchNawawi(q, favs, topic == "fav")
      item { Text("${Fmt.number(list.size)} حديثًا — الأربعون النووية للإمام النووي بزيادتي ابن رجب، بمتونها وتخريجها", style = DSType.labelXs, color = c.textTertiary) }
      items(list) { n -> NawawiCard(n, favs, ctx) }
      if (list.isEmpty()) item { Text(if (topic == "fav") "لم تُضف أحاديث إلى المفضلة بعد" else "لا نتائج — جرّب كلمة أخرى", style = DSType.bodySm, color = c.textTertiary) }
    }
  }
}

@Composable private fun DailyHadithCard(h: Hadith, ctx: android.content.Context) {
  val c = DS.c
  val text = "${h.text}\n\nرواه ${h.narrator} — ${h.reference} (${h.grade})"
  val fav = h.id in Store.favorites
  NightCard {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      DSIconButton(Icons.Outlined.Share, contentDescription = "مشاركة", style = IconStyle.Glass, size = 34.dp, iconSize = 14.dp) {
        ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), "مشاركة"))
      }
      Spacer(Modifier.width(8.dp))
      DSIconButton(if (fav) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder, contentDescription = "مفضلة", style = IconStyle.Glass, size = 34.dp, iconSize = 14.dp) {
        Store.favorites = if (fav) Store.favorites - h.id else Store.favorites + h.id; Store.save()
      }
      Spacer(Modifier.weight(1f))
      Text("حديث اليوم · ${Hijri.date(Instant.now(), Store.zone, Store.hijriOffset).formatted}", style = DSType.labelXs, color = c.textOnDarkMuted, maxLines = 1)
    }
    Spacer(Modifier.height(16.dp))
    Text("«${h.text}»", fontFamily = Fonts.amiriText, fontSize = 18.sp, lineHeight = 34.sp, color = c.textOnDark, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
    Spacer(Modifier.height(16.dp))
    Row(Modifier.fillMaxWidth()) {
      Text(h.topic, style = DSType.labelXs, color = c.textOnDarkMuted)
      Spacer(Modifier.weight(1f))
      Text("${h.grade} · ${h.reference}", style = DSType.labelXs, color = c.accentGold)
    }
  }
}

@Composable private fun HadithCard(h: Hadith, favs: Set<String>, ctx: android.content.Context) {
  val c = DS.c
  val fav = h.id in favs
  val text = "${h.text}\n\nرواه ${h.narrator} — ${h.reference} (${h.grade})"
  var lesson by remember(h.id) { mutableStateOf(false) }
  DSCard(padding = 16.dp) {
    Text("«${h.text}»", fontFamily = Fonts.amiriText, fontSize = (17 * Store.textScale).sp, lineHeight = (32 * Store.textScale).sp, color = c.textPrimary, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
    Spacer(Modifier.height(12.dp))
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      Text(h.topic, style = DSType.labelXs, color = c.brandPrimary, modifier = Modifier.clip(CircleShape).background(c.brandSoft).padding(10.dp, 4.dp))
      Spacer(Modifier.weight(1f))
      Text("${h.reference} · عن ${h.narrator}", style = DSType.labelXs, color = c.textTertiary, maxLines = 1)
    }
    if (lesson) {
      Spacer(Modifier.height(10.dp))
      Text(h.lesson, style = DSType.bodySm, color = c.textPrimary, modifier = Modifier.fillMaxWidth().clip(DS.shapeMd).background(c.brandSoft.copy(alpha = 0.5f)).padding(12.dp))
    }
    Spacer(Modifier.height(10.dp))
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      HadithActions(fav, text, { Store.favorites = if (fav) Store.favorites - h.id else Store.favorites + h.id; Store.save() }, ctx) {
        ShareCard.share(ctx, ShareCard.render(ctx, "حديث شريف · ${h.grade}", h.text, "عن ${h.narrator} — ${h.reference}", false), "hadith-${h.id}.png", text)
      }
      Spacer(Modifier.weight(1f))
      TextButton(onClick = { lesson = !lesson }) { Text(if (lesson) "إخفاء الفائدة" else "الفائدة", style = DSType.labelSm, color = c.brandPrimary) }
    }
  }
}

@Composable private fun NawawiCard(n: NawawiHadith, favs: Set<String>, ctx: android.content.Context) {
  val c = DS.c
  val fav = n.id in favs
  val text = "${n.text}\n\n${n.takhrij}\n— الأربعون النووية، ${n.title}"
  DSCard(padding = 16.dp) {
    Text(n.title, style = DSType.labelSm, color = c.accentGoldStrong)
    Spacer(Modifier.height(10.dp))
    Text("«${n.text}»", fontFamily = Fonts.amiriText, fontSize = (17 * Store.textScale).sp, lineHeight = (32 * Store.textScale).sp, color = c.textPrimary, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
    Spacer(Modifier.height(10.dp))
    Text(n.takhrij, style = DSType.labelXs, color = c.textTertiary)
    Spacer(Modifier.height(10.dp))
    HadithActions(fav, text, { Store.favorites = if (fav) Store.favorites - n.id else Store.favorites + n.id; Store.save() }, ctx) {
      ShareCard.share(ctx, ShareCard.render(ctx, "الأربعون النووية · ${n.title}", n.text, n.takhrij.take(70), false), "${n.id}.png", text)
    }
  }
}

@Composable private fun HadithActions(fav: Boolean, text: String, onFav: () -> Unit, ctx: android.content.Context, onImage: () -> Unit) {
  Row(verticalAlignment = Alignment.CenterVertically) {
    DSIconButton(if (fav) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder, contentDescription = "مفضلة", style = if (fav) IconStyle.Brand else IconStyle.Soft, size = 34.dp, iconSize = 14.dp, onClick = onFav)
    Spacer(Modifier.width(6.dp))
    DSIconButton(Icons.Outlined.ContentCopy, contentDescription = "نسخ", style = IconStyle.Soft, size = 34.dp, iconSize = 14.dp) {
      (ctx.getSystemService(android.content.ClipboardManager::class.java)).setPrimaryClip(android.content.ClipData.newPlainText("حديث", text))
    }
    Spacer(Modifier.width(6.dp))
    DSIconButton(Icons.Outlined.Share, contentDescription = "مشاركة", style = IconStyle.Soft, size = 34.dp, iconSize = 14.dp) {
      ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), "مشاركة"))
    }
    Spacer(Modifier.width(6.dp))
    DSIconButton(Icons.Outlined.Image, contentDescription = "مشاركة كصورة", style = IconStyle.Soft, size = 34.dp, iconSize = 14.dp, onClick = onImage)
  }
}

/** الجدول الشهري (تصميم Figma 15): بطاقة جدول بصفّ رأس، صفّ اليوم مميّز، وتصدير ICS */
@Composable fun MonthTableScreen(onBack: () -> Unit) {
  val ctx = LocalContext.current
  val c = DS.c
  val now = CivilDate.of(Instant.now(), Store.zone)
  var year by remember { mutableIntStateOf(now.year) }
  var month by remember { mutableIntStateOf(now.month) }
  val coords = Store.coords
  val rows = remember(year, month, coords, Store.methodId, Store.madhab, Store.highLat) {
    coords?.let { PrayerTimes.monthTable(it, year, month, Store.params()) } ?: emptyList()
  }
  fun shift(n: Int) { var m = month + n; var y = year; if (m < 1) { m = 12; y-- } else if (m > 12) { m = 1; y++ }; month = m; year = y }
  val hijriTitle = remember(year, month) {
    val h = Hijri.tabular(year, month, 15)
    "${Hijri.monthsAr[h.second - 1]} ${Fmt.number(h.third)}هـ"
  }

  LazyColumn(
    Modifier.fillMaxSize().background(c.bgCanvas),
    contentPadding = PaddingValues(16.dp, 0.dp, 16.dp, 32.dp),
    verticalArrangement = Arrangement.spacedBy(12.dp)
  ) {
    item {
      DSNavBar("الجدول الشهري", onBack = onBack) {
        DSIconButton(Icons.Outlined.Share, contentDescription = "تصدير") { exportIcs(ctx, rows, year, month) }
      }
    }
    item {
      Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        DSIconButton(Icons.Outlined.ChevronRight, contentDescription = "الشهر السابق") { shift(-1) }
        Spacer(Modifier.weight(1f))
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
          Text(hijriTitle, style = DSType.headingSm, color = c.textPrimary)
          Text("${Fmt.number(month)}/${Fmt.number(year)}، ${Store.locName ?: "—"}، ${Methods.method(Store.methodId).nameAr}", style = DSType.labelXs, color = c.textSecondary, maxLines = 1)
        }
        Spacer(Modifier.weight(1f))
        DSIconButton(Icons.Outlined.ChevronLeft, contentDescription = "الشهر التالي") { shift(1) }
      }
    }
    if (rows.isEmpty()) item { Text("حدّد موقعك أولًا لعرض جدول الشهر", style = DSType.bodySm, color = c.textTertiary) }
    else {
      item {
        DSCard(padding = 8.dp) {
          Row(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
            Prayer.entries.reversed().forEach { p -> TableCell(p.nameAr, Modifier.weight(1f), bold = true, color = c.textTertiary) }
            TableCell("اليوم", Modifier.width(42.dp), bold = true, color = c.textTertiary)
          }
          DSDivider()
          rows.forEach { r ->
            val isToday = r.date.year == now.year && r.date.month == now.month && r.date.day == now.day
            Row(
              Modifier.fillMaxWidth().then(if (isToday) Modifier.clip(DS.shapeSm).background(c.brandSoft) else Modifier).padding(vertical = 8.dp),
              verticalAlignment = Alignment.CenterVertically
            ) {
              Prayer.entries.reversed().forEach { p ->
                TableCell(Fmt.time(r[p]).replace(" ", " "), Modifier.weight(1f), bold = isToday, color = if (isToday) c.brandStrong else c.textPrimary)
              }
              TableCell("${AdhkarStreak.letter(r.date.key)} ${Fmt.number(r.date.day)}", Modifier.width(42.dp), bold = isToday, color = if (isToday) c.brandStrong else c.textSecondary)
            }
          }
        }
      }
      item { DSButton("تصدير إلى التقويم (ICS)", kind = ButtonKind.Soft, modifier = Modifier.fillMaxWidth(), icon = Icons.Outlined.CalendarMonth) { exportIcs(ctx, rows, year, month) } }
      item { Text("الأوقات بتوقيت ${Store.locName ?: "موقعك"} · تُحدَّث تلقائيًا عند تغيير الموقع أو الطريقة", style = DSType.labelXs, color = c.textTertiary, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) }
    }
  }
}

@Composable private fun TableCell(text: String, modifier: Modifier, bold: Boolean, color: androidx.compose.ui.graphics.Color) {
  Text(
    text, modifier = modifier,
    style = DSType.numericSm.copy(fontWeight = if (bold) androidx.compose.ui.text.font.FontWeight.SemiBold else androidx.compose.ui.text.font.FontWeight.Normal),
    color = color, maxLines = 1, textAlign = TextAlign.Center
  )
}

/** ورقة التنزيلات دون اتصال */
@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun DownloadsDialog(onDismiss: () -> Unit) {
  ModalBottomSheet(onDismissRequest = onDismiss, containerColor = DS.c.bgSurface) {
    // خطّ صفحات المصحف حزمةٌ تُنزَّل وحدها: حالتها هنا ما لم تكتمل، ثم التلاوات
    if (MushafFontPack.phase != MushafFontPack.Phase.READY) FontPackCard(Modifier.padding(horizontal = 12.dp).padding(bottom = 8.dp))
    DownloadsSheet(null)
  }
}

private fun exportIcs(ctx: android.content.Context, rows: List<PrayerTimesResult>, year: Int, month: Int) {
  if (rows.isEmpty()) return
  val text = ICS.build(rows, ICS.Options(locationName = Store.locName, preMinutes = Store.reminders.preMinutes, includeSunrise = Prayer.SUNRISE.id in Store.reminders.prayers))
  val f = java.io.File(ctx.cacheDir, "sakinah-$year-$month.ics")
  f.writeText(text)
  val uri = androidx.core.content.FileProvider.getUriForFile(ctx, "${ctx.packageName}.fileprovider", f)
  ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/calendar").putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION), "تصدير المواقيت"))
}
