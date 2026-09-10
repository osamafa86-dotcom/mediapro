package org.emdatra.sakinah.app

import android.content.Context
import android.content.SharedPreferences
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import org.emdatra.sakinah.core.Catalog
import org.emdatra.sakinah.core.QuranMeta
import org.emdatra.sakinah.core.QuranText
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/** التلاوات دون اتصال: سور كاملة لكل قارئ في files/audio/<القارئ>/<رقم الآية>.mp3 (+ .json لتوقيتات الكلمات) */
object AudioDownloads {
  @Serializable data class Entry(val files: Int, val bytes: Long, val at: Double, val words: Boolean)
  private val json = Json { ignoreUnknownKeys = true }
  private val ser = MapSerializer(String.serializer(), MapSerializer(String.serializer(), Entry.serializer()))
  private val segSer = ListSerializer(ListSerializer(Int.serializer()))
  private var root: File? = null
  private var sp: SharedPreferences? = null
  var state by mutableStateOf<Map<String, Map<String, Entry>>>(emptyMap()); private set
  val running = mutableStateMapOf<String, Float>()
  private val jobs = HashMap<String, Job>()
  private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

  fun init(ctx: Context) {
    root = File(ctx.filesDir, "audio").apply { mkdirs() }
    sp = ctx.getSharedPreferences("sakinah", Context.MODE_PRIVATE)
    state = sp?.getString("quran.downloads", null)?.let { runCatching { json.decodeFromString(ser, it) }.getOrNull() } ?: emptyMap()
  }
  private fun persist() { sp?.edit()?.putString("quran.downloads", json.encodeToString(ser, state))?.apply() }
  private fun file(reciter: String, n: Int, ext: String = "mp3"): File = File(File(root, reciter), "$n.$ext")
  fun local(reciter: String, n: Int): AyahSource? {
    if (root == null) return null
    val f = file(reciter, n); if (!f.exists()) return null
    val seg = runCatching { json.decodeFromString(segSer, file(reciter, n, "json").readText()) }.getOrNull()
    return AyahSource(f.toURI().toString(), seg, "local")
  }
  fun entry(reciter: String, surah: Int): Entry? = state[reciter]?.get(surah.toString())
  fun isRunning(reciter: String, surah: Int) = running.containsKey("$reciter/$surah")
  fun progress(reciter: String, surah: Int): Float = running["$reciter/$surah"] ?: 0f
  fun summary(reciter: String): Pair<Int, Long> { val m = state[reciter] ?: emptyMap(); return m.size to m.values.sumOf { it.bytes } }
  fun totalBytes(): Long = state.values.sumOf { m -> m.values.sumOf { it.bytes } }

  /** تنزيل سورة كاملة (آية آية)؛ الاستدعاء مرة أخرى أثناء التنزيل يلغيه */
  fun download(reciter: String, surah: Int, words: Boolean) {
    val key = "$reciter/$surah"
    jobs[key]?.let { it.cancel(); jobs.remove(key); running.remove(key); return }
    running[key] = 0f
    jobs[key] = scope.launch {
      val ayahs = QuranText.shared.surahAyahs(surah); var bytes = 0L; var files = 0
      val ok = runCatching {
        withContext(Dispatchers.IO) {
          File(root, reciter).mkdirs()
          for ((i, a) in ayahs.withIndex()) {
            ensureActive()
            val dst = file(reciter, a.n)
            if (!dst.exists()) {
              val src = AudioSources.sources(reciter, a.n, words, local = false).firstOrNull() ?: throw java.io.IOException("no source")
              val tmp = File(dst.path + ".part")
              val c = URL(src.url).openConnection() as HttpURLConnection
              c.connectTimeout = 15000; c.readTimeout = 30000
              try { if (c.responseCode !in 200..299) throw java.io.IOException("HTTP ${c.responseCode}"); c.inputStream.use { inp -> tmp.outputStream().use { out -> inp.copyTo(out) } } } finally { c.disconnect() }
              tmp.renameTo(dst)
              src.segments?.let { s -> runCatching { file(reciter, a.n, "json").writeText(json.encodeToString(segSer, s)) } }
            }
            bytes += dst.length(); files++
            val p = (i + 1).toFloat() / ayahs.size
            withContext(Dispatchers.Main) { running[key] = p }
          }
        }
      }.isSuccess
      if (ok) { val m = (state[reciter] ?: emptyMap()).toMutableMap(); m[surah.toString()] = Entry(files, bytes, System.currentTimeMillis().toDouble(), words); state = state + (reciter to m); persist() }
      running.remove(key); jobs.remove(key)
    }
  }
  fun delete(reciter: String, surah: Int) {
    for (a in QuranText.shared.surahAyahs(surah)) { file(reciter, a.n).delete(); file(reciter, a.n, "json").delete() }
    val m = (state[reciter] ?: emptyMap()).toMutableMap(); m.remove(surah.toString()); state = state + (reciter to m); persist()
  }
  fun deleteAll() { jobs.values.forEach { it.cancel() }; jobs.clear(); running.clear(); root?.deleteRecursively(); root?.mkdirs(); state = emptyMap(); persist() }
  fun fmtBytes(b: Long): String = when { b >= 1_000_000_000 -> "${Fmt.decimal(b / 1e9, 2)} ج.ب"; b >= 1_000_000 -> "${Fmt.decimal(b / 1e6, 1)} م.ب"; else -> "${Fmt.number((b / 1000).toInt())} ك.ب" }
}

/** ورقة التلاوات دون اتصال: القارئ، ملخّص المخزّن، وقائمة السور بتنزيل/إيقاف/حذف */
@Composable
fun DownloadsSheet(focusSurah: Int?) {
  var reciter by remember { mutableStateOf(Store.reciter) }
  var pick by remember { mutableStateOf(false) }
  val dl = AudioDownloads
  val words = Store.wordHighlight
  val ordered = remember(focusSurah) { if (focusSurah != null) listOf(QuranMeta.surah(focusSurah)) + QuranMeta.surahs.filter { it.n != focusSurah } else QuranMeta.surahs }
  val sum = dl.summary(reciter)
  Column(Modifier.fillMaxHeight(0.92f).padding(horizontal = 12.dp)) {
    Text("التلاوات دون اتصال", style = MaterialTheme.typography.titleMedium)
    OutlinedButton(onClick = { pick = !pick }, Modifier.fillMaxWidth().padding(top = 6.dp)) { Text(Catalog.shared.reciter(reciter).name) }
    if (pick) LazyColumn(Modifier.heightIn(max = 220.dp)) { items(Catalog.shared.reciters) { r -> ListItem(headlineContent = { Text(r.name + if (r.hasWordTiming) " — كلمة بكلمة" else "") }, modifier = Modifier.clickableRow { reciter = r.id; pick = false }) } }
    Text(if (sum.first > 0) "${Fmt.number(sum.first)} سورة محفوظة لهذا القارئ · ${dl.fmtBytes(sum.second)} · إجمالي المخزّن ${dl.fmtBytes(dl.totalBytes())}" else "لا سور محفوظة لهذا القارئ بعد", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(vertical = 6.dp))
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
      TextButton(onClick = { val j = focusSurah?.let { QuranMeta.juzOfPage(QuranMeta.surah(it).page) } ?: 1; for (su in QuranMeta.surahs) if (QuranText.shared.surahAyahs(su.n).any { it.juz == j } && dl.entry(reciter, su.n) == null && !dl.isRunning(reciter, su.n)) dl.download(reciter, su.n, words) }) { Text("تنزيل سور الجزء الحالي") }
      TextButton(onClick = { dl.deleteAll() }) { Text("حذف الكل", color = MaterialTheme.colorScheme.error) }
    }
    LazyColumn {
      items(ordered, key = { it.n }) { su ->
        val e = dl.entry(reciter, su.n); val running = dl.isRunning(reciter, su.n)
        Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
          Column(Modifier.weight(1f)) {
            Text("${Fmt.number(su.n)}. ${su.name}")
            Text(e?.let { "محفوظة · ${dl.fmtBytes(it.bytes)}${if (it.words) " · كلمة بكلمة" else ""}" } ?: "${Fmt.number(su.ayahs)} آية", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
          }
          if (running) Text("${Fmt.number((dl.progress(reciter, su.n) * 100).toInt())}٪", fontSize = 12.sp, modifier = Modifier.padding(end = 8.dp))
          OutlinedButton(onClick = { if (running) dl.download(reciter, su.n, words) else if (e != null) dl.delete(reciter, su.n) else dl.download(reciter, su.n, words) }) { Text(if (running) "إيقاف" else if (e != null) "حذف" else "تنزيل", fontSize = 12.sp) }
        }
      }
      item { Text("تُحفظ الملفات داخل التطبيق وتُشغَّل تلقائيًا دون اتصال.", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(vertical = 10.dp)) }
    }
  }
}
private fun Modifier.clickableRow(onClick: () -> Unit): Modifier = this.then(Modifier.clickable(onClick = onClick))
