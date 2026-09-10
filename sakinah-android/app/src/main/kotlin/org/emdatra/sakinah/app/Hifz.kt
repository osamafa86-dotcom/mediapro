package org.emdatra.sakinah.app

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import org.emdatra.sakinah.app.ui.Gold
import org.emdatra.sakinah.app.ui.Teal
import org.emdatra.sakinah.core.HifzMatcher
import org.emdatra.sakinah.core.HifzWord
import org.emdatra.sakinah.core.QuranText

/** جلسة مراجعة حفظ لصفحة: الكلمات المنطوقة من آية البداية، المطابق المتسامح، الكشف بالصوت أو بالنقر، ووضع الإخفاء آيةً آية */
class HifzSession(val page: Int, val from: Int, val veil: Boolean) {
  val words: List<HifzWord> = HifzMatcher.words(QuranText.shared.pageAyahs(page), from)
  val matcher = HifzMatcher(words)
  private val indexOf = HashMap<Long, Int>().also { m -> words.forEachIndexed { i, w -> m[w.n * 1000L + w.k] = i } }
  var version by mutableIntStateOf(0); private set
  var listening by mutableStateOf(false); private set
  var heard by mutableStateOf(""); private set
  var hints by mutableIntStateOf(0); private set
  var finished by mutableStateOf(false); private set
  var error by mutableStateOf<String?>(null)
  private var fed = 0
  private var recognizer: SpeechRecognizer? = null

  val pos: Int get() { version; return matcher.pos }
  val progress: Double get() { version; return if (words.isEmpty()) 1.0 else matcher.pos.toDouble() / words.size }
  val done: Boolean get() { version; return matcher.pos >= words.size }
  val lastRevealed: HifzWord? get() { version; return if (matcher.pos > 0) words[matcher.pos - 1] else null }
  val currentWord: HifzWord? get() { version; return if (matcher.pos >= words.size) null else words[matcher.pos] }
  /** الآيات قبل البداية ظاهرة؛ مع «الكلمة الحالية فقط» تبقى آخر كلمة مكشوفة فقط */
  fun isHidden(n: Int, k: Int, onlyCurrent: Boolean): Boolean {
    version
    if (n < from) return false
    val i = indexOf[n * 1000L + k] ?: return false
    if (i >= matcher.pos) return true
    if (onlyCurrent && !veil && i < matcher.pos - 1) return true
    return false
  }
  fun isCurrent(n: Int, k: Int): Boolean { version; if (matcher.pos >= words.size) return false; return indexOf[n * 1000L + k] == matcher.pos }
  val revealedAyahs: Int get() { version; val shown = HashSet<Int>(); for (i in 0 until matcher.pos) shown.add(words[i].n); currentWord?.let { shown.remove(it.n) }; return shown.size }
  private fun reveal(idx: List<Int>) { if (idx.isEmpty()) return; version++; if (matcher.pos >= words.size) { finished = true; stopSpeech() } }
  private fun hintIndex(): Int? { if (matcher.pos >= words.size) return null; val i = matcher.pos; matcher.feed(words[i].norm); if (matcher.pos == i) return null; return i }
  fun hint() { hintIndex()?.let { hints++; reveal(listOf(it)) } }
  fun revealAyah() {
    val cur = currentWord ?: return; val idx = ArrayList<Int>()
    while (matcher.pos < words.size && words[matcher.pos].n == cur.n) { val i = hintIndex() ?: break; idx.add(i) }
    hints += idx.size; reveal(idx)
  }
  fun revealAll() { val idx = ArrayList<Int>(); while (true) { val i = hintIndex() ?: break; idx.add(i) }; reveal(idx) }

  fun toggleSpeech(ctx: Context) { if (listening) stopSpeech() else start(ctx) }
  private fun start(ctx: Context) {
    if (!SpeechRecognizer.isRecognitionAvailable(ctx)) { error = "التعرّف على الكلام غير متاح على هذا الجهاز"; return }
    val r = SpeechRecognizer.createSpeechRecognizer(ctx); recognizer = r
    r.setRecognitionListener(object : RecognitionListener {
      override fun onReadyForSpeech(params: Bundle?) { listening = true }
      override fun onBeginningOfSpeech() {}
      override fun onRmsChanged(rmsdB: Float) {}
      override fun onBufferReceived(buffer: ByteArray?) {}
      override fun onEndOfSpeech() {}
      override fun onError(code: Int) {
        when (code) {
          SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> { error = "لم يُمنح إذن الميكروفون"; stopSpeech() }
          SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> { error = "التعرّف على الكلام يحتاج اتصالًا بالإنترنت"; stopSpeech() }
          else -> restart()
        }
      }
      override fun onResults(results: Bundle?) { handle(results, true); restart() }
      override fun onPartialResults(partialResults: Bundle?) { handle(partialResults, false) }
      override fun onEvent(eventType: Int, params: Bundle?) {}
    })
    listening = true; fed = 0; listen(r)
  }
  private fun listen(r: SpeechRecognizer) {
    val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
      .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ar-SA").putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true).putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
    r.startListening(i)
  }
  private fun restart() { if (!listening) return; fed = 0; val r = recognizer ?: return; Handler(Looper.getMainLooper()).postDelayed({ if (listening && recognizer === r) listen(r) }, 300) }
  private fun handle(b: Bundle?, final: Boolean) {
    val list = b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: return
    val cumulative = list.firstOrNull() ?: return
    val ws = cumulative.split(' ').filter { it.isNotEmpty() }
    val fresh = ws.drop(fed).joinToString(" ")
    if (fresh.isNotEmpty()) {
      var r = matcher.feed(fresh)
      if (r.isEmpty() && list.size > 1) r = matcher.feed(list[1].split(' ').filter { it.isNotEmpty() }.drop(fed).joinToString(" "))
      reveal(r)
    }
    heard = cumulative; fed = if (final) 0 else ws.size
  }
  fun stopSpeech() { listening = false; recognizer?.let { runCatching { it.stopListening() }; runCatching { it.destroy() } }; recognizer = null; fed = 0 }
}

/** لوحة مراجعة الحفظ / إخفاء الآيات */
@Composable
fun HifzPanel(session: HifzSession, onExit: () -> Unit, onNextPage: () -> Unit) {
  val ctx = LocalContext.current
  val total = QuranText.shared.pageAyahs(session.page).size
  val micLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok -> if (ok) session.toggleSpeech(ctx) else session.error = "لم يُمنح إذن الميكروفون" }
  Column(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp)) {
    Row(verticalAlignment = Alignment.CenterVertically) {
      Text(if (session.veil) "إخفاء الآيات" else "مراجعة الحفظ", fontWeight = FontWeight.Bold)
      Spacer(Modifier.weight(1f))
      Text(if (session.veil) "${Fmt.number(minOf(session.revealedAyahs, total))} / ${Fmt.number(total)} آية" else "${Fmt.number(session.pos)} / ${Fmt.number(session.words.size)} كلمة", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
      IconButton(onClick = onExit) { Icon(Icons.Filled.Close, "إنهاء") }
    }
    if (!session.veil) {
      val last = session.lastRevealed
      Text(if (session.done) "✓ أحسنت" else last?.raw ?: (if (session.listening) "استمع… ابدأ التلاوة" else "اضغط «ابدأ التسميع» أو انقر الصفحة لكشف كلمة"), fontFamily = if (session.done || last == null) null else Fonts.amiri, fontSize = if (last != null && !session.done) 20.sp else 13.sp, color = if (session.done) Teal else MaterialTheme.colorScheme.onSurface, modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp))
      if (session.heard.isNotEmpty()) Text(session.heard, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
    }
    session.error?.let { Text(it, fontSize = 12.sp, color = MaterialTheme.colorScheme.error) }
    LinearProgressIndicator({ session.progress.toFloat() }, Modifier.fillMaxWidth().padding(vertical = 6.dp), color = Gold)
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      if (session.veil) {
        if (session.done) Button(onClick = onNextPage) { Text("الصفحة التالية") } else Button(onClick = { session.revealAyah() }) { Icon(Icons.Filled.Visibility, null, Modifier.size(16.dp)); Spacer(Modifier.width(4.dp)); Text("كشف الآية التالية") }
        OutlinedButton(onClick = { session.revealAll() }) { Text("كشف الكل") }
      } else if (session.done) {
        Button(onClick = onNextPage) { Text("الصفحة التالية") }
      } else {
        Button(onClick = { if (session.listening) session.toggleSpeech(ctx) else if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) session.toggleSpeech(ctx) else micLauncher.launch(Manifest.permission.RECORD_AUDIO) },
          colors = ButtonDefaults.buttonColors(containerColor = if (session.listening) MaterialTheme.colorScheme.error else Teal)) { Icon(if (session.listening) Icons.Filled.MicOff else Icons.Filled.Mic, null, Modifier.size(16.dp)); Spacer(Modifier.width(4.dp)); Text(if (session.listening) "إيقاف" else "ابدأ التسميع") }
        OutlinedButton(onClick = { session.hint() }) { Text("تلميح") }
        OutlinedButton(onClick = { session.revealAyah() }) { Text("كشف الآية") }
      }
    }
  }
}
