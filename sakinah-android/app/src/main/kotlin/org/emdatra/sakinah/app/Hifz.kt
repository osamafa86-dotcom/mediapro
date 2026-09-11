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
import org.emdatra.sakinah.app.ui.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.ChevronLeft
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

  private val main = Handler(Looper.getMainLooper())
  private var appCtx: Context? = null
  private var restartPending = false

  private fun start(ctx: Context) {
    if (!SpeechRecognizer.isRecognitionAvailable(ctx)) { error = "التعرّف على الكلام غير متاح على هذا الجهاز"; return }
    appCtx = ctx.applicationContext
    listening = true
    createAndListen()
  }

  /** دورة تعرّف جديدة بمُعرِّف جديد — أندرويد ينهي الجلسة مع كل صمت، فالتدوير جزء من التشغيل لا استثناء */
  private fun createAndListen() {
    val ctx = appCtx ?: return
    runCatching { recognizer?.destroy() }
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
          // صمت أو لا تطابق: طبيعيّ تمامًا بين الآيات — نعاود فورًا بلا رسالة
          SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> restart(recreate = false, delay = 80)
          // المُعرِّف مشغول أو عطب في العميل: نبنيه من جديد
          SpeechRecognizer.ERROR_RECOGNIZER_BUSY, SpeechRecognizer.ERROR_CLIENT -> restart(recreate = true, delay = 250)
          SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> restart(recreate = true, delay = 400)
          else -> restart(recreate = true, delay = 250)
        }
      }
      override fun onResults(results: Bundle?) { handle(results, true); restart(recreate = false, delay = 80) }
      override fun onPartialResults(partialResults: Bundle?) { handle(partialResults, false) }
      override fun onEvent(eventType: Int, params: Bundle?) {}
    })
    fed = 0
    listen(r)
  }

  private fun listen(r: SpeechRecognizer) {
    val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
      .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ar-SA")
      .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
      .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
      // لا تُنهِ الجلسة عند أول سكتة بين آيتين
      .putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2500)
      .putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 2500)
      .putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 1200)
    // دون اتصال حين تتوفّر حزمة اللغة — أسرع ويحفظ وعد العمل بلا شبكة
    if (android.os.Build.VERSION.SDK_INT >= 23) i.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
    runCatching { r.startListening(i) }.onFailure { restart(recreate = true, delay = 300) }
  }

  private fun restart(recreate: Boolean, delay: Long) {
    if (!listening || restartPending) return
    restartPending = true
    main.postDelayed({
      restartPending = false
      if (!listening) return@postDelayed
      if (recreate) createAndListen() else { fed = 0; recognizer?.let { listen(it) } ?: createAndListen() }
    }, delay)
  }

  private fun handle(b: Bundle?, final: Boolean) {
    val list = b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: return
    val best = list.firstOrNull() ?: return
    val ws = best.split(' ').filter { it.isNotEmpty() }
    if (ws.size > fed) {
      val tail = ws.drop(fed).joinToString(" ")
      val altTails = list.drop(1).mapNotNull { alt ->
        val a = alt.split(' ').filter { it.isNotEmpty() }
        if (a.size > fed) a.drop(fed).joinToString(" ") else null
      }
      fed = ws.size
      var r = matcher.feed(tail)
      if (r.isEmpty()) for (alt in altTails) { r = matcher.feed(alt); if (r.isNotEmpty()) break }
      reveal(r)
    }
    heard = best
    if (final) fed = 0
  }

  fun stopSpeech() {
    listening = false; restartPending = false
    main.removeCallbacksAndMessages(null)
    recognizer?.let { runCatching { it.cancel() }; runCatching { it.destroy() } }
    recognizer = null; fed = 0
  }
}

/** لوحة مراجعة الحفظ / إخفاء الآيات */
@Composable
fun HifzPanel(session: HifzSession, onExit: () -> Unit, onNextPage: () -> Unit) {
  val ctx = LocalContext.current; val c = DS.c
  val total = QuranText.shared.pageAyahs(session.page).size
  val micLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok -> if (ok) session.toggleSpeech(ctx) else session.error = "لم يُمنح إذن الميكروفون" }
  Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp).shadow(if (c.isDark) 0.dp else 14.dp, DS.shapeXl, ambientColor = c.shadow.copy(alpha = 0.16f), spotColor = c.shadow.copy(alpha = 0.2f)).clip(DS.shapeXl).background(c.bgSurface).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
      Text(if (session.veil) "إخفاء الآيات" else "مراجعة الحفظ", style = DSType.headingSm, color = c.textPrimary)
      Text(if (session.veil) "${Fmt.number(minOf(session.revealedAyahs, total))} / ${Fmt.number(total)} آية" else "${Fmt.number(session.pos)} / ${Fmt.number(session.words.size)} كلمة", style = DSType.labelXs, color = c.textSecondary)
      Spacer(Modifier.weight(1f))
      if (session.hints > 0 && !session.veil) Text("${Fmt.number(session.hints)} تلميحات", style = DSType.labelXs, color = c.textTertiary)
      DSIconButton(Icons.Filled.Close, size = 32.dp, iconSize = 14.dp, contentDescription = "إنهاء", onClick = onExit)
    }
    ProgressTrack(session.progress.toFloat(), tint = c.accentGold, track = c.bgSubtle, height = 5.dp)
    if (!session.veil) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
      Box(Modifier.size(72.dp).clip(CircleShape).background(c.brandPrimary.copy(alpha = if (session.listening) 0.16f else 0.08f)).clickable(enabled = true) { if (session.listening) session.toggleSpeech(ctx) else if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) session.toggleSpeech(ctx) else micLauncher.launch(Manifest.permission.RECORD_AUDIO) }, contentAlignment = Alignment.Center) {
        Box(Modifier.size(56.dp).clip(CircleShape).background(if (session.listening) c.danger else c.brandPrimary), contentAlignment = Alignment.Center) { Icon(if (session.listening) Icons.Filled.Stop else Icons.Filled.Mic, if (session.listening) "إيقاف التسميع" else "ابدأ التسميع", Modifier.size(24.dp), tint = c.textOnBrand) }
      }
      Column(Modifier.weight(1f)) {
        val last = session.lastRevealed
        if (session.done) Text("✓ أحسنت، أتممت الصفحة", style = DSType.labelMd, color = c.success)
        else if (last != null) Row(verticalAlignment = Alignment.CenterVertically) { Text("آخر كلمة: ", style = DSType.labelXs, color = c.textSecondary); Text(last.raw, style = DSType.quranInline.copy(fontSize = 20.sp, lineHeight = 30.sp), color = c.textPrimary) }
        else Text(if (session.listening) "يستمع… تابع التلاوة" else "اضغط الميكروفون أو انقر الصفحة لكشف كلمة", style = DSType.labelMd, color = if (session.listening) c.brandPrimary else c.textSecondary)
        Text(session.error ?: (if (session.heard.isEmpty()) "التعرّف على الكلام بالعربية · مطابقة متسامحة مع التشكيل" else "سمعتُ: ${session.heard}"), style = DSType.labelXs, color = if (session.error != null) c.danger else c.textTertiary, maxLines = 1)
      }
    }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      if (session.veil) {
        if (session.done) DSButton("الصفحة التالية", Modifier.weight(1f), icon = Icons.Filled.ChevronLeft, onClick = onNextPage) else DSButton("كشف الآية التالية", Modifier.weight(1f), kind = ButtonKind.Soft, icon = Icons.Filled.Visibility) { session.revealAyah() }
        DSButton("كشف الكل", Modifier.weight(1f), kind = ButtonKind.Outline) { session.revealAll() }
      } else if (session.done) DSButton("الصفحة التالية", Modifier.weight(1f), icon = Icons.Filled.ChevronLeft, onClick = onNextPage)
      else { DSButton("كشف كلمة", Modifier.weight(1f), kind = ButtonKind.Soft) { session.hint() }; DSButton("كشف آية", Modifier.weight(1f), kind = ButtonKind.Soft) { session.revealAyah() }; DSButton("إظهار الكل", Modifier.weight(1f), kind = ButtonKind.Outline) { session.revealAll() } }
    }
  }
}
