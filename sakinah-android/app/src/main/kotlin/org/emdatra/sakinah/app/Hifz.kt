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
import org.emdatra.sakinah.core.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.graphics.Color
import androidx.compose.material.icons.outlined.Subject
import androidx.compose.material.icons.outlined.TextFields
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material.icons.filled.Warning

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
  /// رقم الدورة — نداءات المُعرِّف المُدمَّر تُتجاهل فلا تُشعل دورة زائدة
  private var gen = 0

  private fun start(ctx: Context) {
    if (!SpeechRecognizer.isRecognitionAvailable(ctx)) { error = "التعرّف على الكلام غير متاح على هذا الجهاز"; return }
    appCtx = ctx.applicationContext
    listening = true
    createAndListen()
  }

  /** دورة تعرّف جديدة بمُعرِّف جديد — أندرويد ينهي الجلسة مع كل صمت، فالتدوير جزء من التشغيل لا استثناء */
  private fun createAndListen() {
    val ctx = appCtx ?: return
    gen++
    val myGen = gen
    runCatching { recognizer?.destroy() }
    // على الجهاز حين يتوفّر (أندرويد ١٢+): يحفظ وعد «الصوت لا يغادر هاتفك» الذي تعرضه اللوحة
    val r = if (android.os.Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(ctx)) SpeechRecognizer.createOnDeviceSpeechRecognizer(ctx) else SpeechRecognizer.createSpeechRecognizer(ctx); recognizer = r
    r.setRecognitionListener(object : RecognitionListener {
      private fun stale() = myGen != gen || !listening
      override fun onReadyForSpeech(params: Bundle?) { if (!stale()) listening = true }
      override fun onBeginningOfSpeech() {}
      override fun onRmsChanged(rmsdB: Float) {}
      override fun onBufferReceived(buffer: ByteArray?) {}
      override fun onEndOfSpeech() {}
      override fun onError(code: Int) {
        if (stale()) return
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
      override fun onResults(results: Bundle?) { if (stale()) return; handle(results, true); restart(recreate = false, delay = 80) }
      override fun onPartialResults(partialResults: Bundle?) { if (stale()) return; handle(partialResults, false) }
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
      // الاختيار الأول وبدائله فرضيات لصوت واحد: يجرّبها المطابق بلا أثر ويعتمد أولى ما يكشف
      val r = matcher.feedBest(listOf(tail) + altTails)
      reveal(r)
    }
    heard = best
    if (final) fed = 0
  }

  fun stopSpeech() {
    listening = false; restartPending = false; gen++
    main.removeCallbacksAndMessages(null)
    recognizer?.let { runCatching { it.cancel() }; runCatching { it.destroy() } }
    recognizer = null; fed = 0
  }
}

/** هل يعمل التعرّف على الجهاز؟ (يُعرض للقارئ صراحةً) */
fun speechOnDevice(ctx: Context): Boolean = android.os.Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(ctx)

/**
 * لوحة مراجعة الحفظ / الإخفاء: صفّ واحد على سطح الورق يُزيح الصفحة —
 * ميكروفون بهالة، حالة وسطر إفصاح («على الجهاز» أو عبر خدمة النظام)، ثم «كلمة» و«آية» و«ضعيفة» و✕.
 * الكلمات المستورة لا تُرسم أصلًا؛ ورؤوس الآي وعلامات الأرباع تبقى ظاهرة.
 */
@Composable
fun HifzPanel(session: HifzSession, theme: MushafTheme? = null, onExit: () -> Unit, onNextPage: () -> Unit) {
  val ctx = LocalContext.current; val c = DS.c
  val total = QuranText.shared.pageAyahs(session.page).size
  val ink = theme?.let { hex(it.ink) } ?: c.textPrimary
  val brand = theme?.let { if (it.isDark) Color(0xFF2DD4BF) else Color(0xFF0F766E) } ?: c.brandPrimary
  val onBrand = theme?.let { if (it.isDark) Color(0xFF0C1514) else Color(0xFFF6F1E2) } ?: c.textOnBrand
  val gold = theme?.let { if (it.isDark) Color(0xFFB8993F) else Color(0xFFA98A3A) } ?: c.accentGold
  val track = theme?.let { if (it.isDark) Color(0xFF4A3F22) else Color(0xFFE9DCB2) } ?: c.bgSubtle
  val cur = session.currentWord?.n ?: session.lastRevealed?.n
  val weak = cur != null && cur in Store.weakAyahs
  val onDevice = remember { speechOnDevice(ctx) }
  val micLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok -> if (ok) session.toggleSpeech(ctx) else session.error = "لم يُمنح إذن الميكروفون" }
  val supported = remember { SpeechRecognizer.isRecognitionAvailable(ctx) }
  val subline = when {
    session.veil -> "انقر الصفحة لكشف الآية التالية"
    session.error != null -> session.error!!
    session.heard.isNotEmpty() -> "سمعتُ: ${session.heard}"
    !supported -> "التعرّف على الكلام غير متاح على هذا الجهاز"
    session.hints > 0 -> "${Fmt.number(session.hints)} تلميحات · " + (if (onDevice) "التعرّف على الجهاز" else "التعرّف عبر خدمة النظام")
    onDevice -> "التعرّف على الصوت يجري على الجهاز ولا يغادر هاتفك"
    else -> "التعرّف عبر خدمة النظام — يُرسل الصوت أثناء التسميع فقط"
  }
  Column(Modifier.fillMaxWidth().background(theme?.let { hex(it.paper) } ?: c.bgSurface)) {
    Box(Modifier.fillMaxWidth().height(1.dp).background(gold.copy(alpha = 0.55f)))
    ProgressTrack(session.progress.toFloat(), tint = gold, track = track, height = 3.dp)
    Row(Modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
      if (session.veil) HifzPill(Icons.Filled.Visibility, "آية", brand) { session.revealAyah() }
      else Box(Modifier.size(48.dp).clickable(enabled = supported, role = Role.Button) { if (session.listening) session.toggleSpeech(ctx) else if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) session.toggleSpeech(ctx) else micLauncher.launch(Manifest.permission.RECORD_AUDIO) }.semantics { contentDescription = if (session.listening) "إيقاف التسميع" else "ابدأ التسميع" }, contentAlignment = Alignment.Center) {
        if (session.listening) Box(Modifier.size(46.dp).clip(CircleShape).background(brand.copy(alpha = 0.22f)))
        Box(Modifier.size(40.dp).clip(CircleShape).background(if (session.listening) c.danger else brand), contentAlignment = Alignment.Center) { Icon(if (session.listening) Icons.Filled.Stop else Icons.Filled.Mic, null, Modifier.size(18.dp), tint = if (session.listening) Color.White else onBrand) }
      }
      Column(Modifier.weight(1f)) {
        val last = session.lastRevealed
        when {
          session.done -> Text("✓ أحسنت، أتممت الصفحة", style = DSType.labelSm, color = c.success, maxLines = 1)
          session.veil -> Text("مخفيّة · ${Fmt.number(minOf(session.revealedAyahs, total))} من ${Fmt.number(total)} آية", style = DSType.labelSm, color = ink, maxLines = 1)
          session.listening -> Text("يستمع… ${Fmt.number(session.pos)} من ${Fmt.number(session.words.size)} كلمة", style = DSType.labelSm, color = brand, maxLines = 1)
          last != null -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) { Text("آخر كلمة", style = DSType.labelSm, color = ink.copy(alpha = 0.6f)); Text(last.raw, style = DSType.quranInline.copy(fontSize = 17.sp, lineHeight = 24.sp), color = ink, maxLines = 1) }
          else -> Text(if (supported) "اضغط الميكروفون أو انقر الصفحة" else "انقر الصفحة لكشف الكلمة التالية", style = DSType.labelSm, color = ink, maxLines = 1)
        }
        Text(subline, style = DSType.labelXs, color = if (session.error != null) c.danger else ink.copy(alpha = 0.55f), maxLines = 1, overflow = TextOverflow.Ellipsis)
      }
      when {
        session.done -> Row(Modifier.clip(CircleShape).background(brand).clickable(role = Role.Button, onClick = onNextPage).padding(horizontal = 14.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) { Text("الصفحة التالية", style = DSType.labelSm, color = onBrand); Icon(Icons.Filled.ChevronLeft, null, Modifier.size(12.dp), tint = onBrand) }
        session.veil -> HifzPill(Icons.Filled.Visibility, "الكل", brand) { session.revealAll() }
        else -> {
          HifzPill(Icons.Outlined.TextFields, "كلمة", brand) { session.hint() }
          HifzPill(Icons.Outlined.Subject, "آية", brand) { session.revealAyah() }
          HifzPill(if (weak) Icons.Filled.Warning else Icons.Outlined.WarningAmber, "ضعيفة", if (weak) gold else brand, on = weak, label = if (weak) "إزالة وسم الآية الضعيفة" else "وسم الآية الحالية آيةً ضعيفة للمراجعة") { cur?.let { Store.toggleWeak(it) } }
        }
      }
      Box(Modifier.size(36.dp, 46.dp).clickable(role = Role.Button, onClick = onExit).semantics { contentDescription = "إنهاء المراجعة" }, contentAlignment = Alignment.Center) { Icon(Icons.Filled.Close, null, Modifier.size(14.dp), tint = ink.copy(alpha = 0.7f)) }
    }
  }
}
@Composable private fun HifzPill(icon: ImageVector, text: String, tint: Color, on: Boolean = false, label: String = text, onClick: () -> Unit) {
  Column(Modifier.size(46.dp).clip(RoundedCornerShape(10.dp)).background(if (on) tint.copy(alpha = 0.14f) else Color.Transparent).clickable(role = Role.Button, onClick = onClick).semantics { contentDescription = label }, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
    Icon(icon, null, Modifier.size(15.dp), tint = tint); Spacer(Modifier.height(3.dp)); Text(text, style = DSType.labelXs.copy(fontSize = 9.5.sp), color = tint, maxLines = 1)
  }
}
