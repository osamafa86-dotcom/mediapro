package org.emdatra.sakinah.app

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.emdatra.sakinah.core.Ayah
import org.emdatra.sakinah.core.Catalog
import org.emdatra.sakinah.core.QuranMeta
import org.emdatra.sakinah.core.QuranText
import kotlin.math.roundToInt

/** مشغّل التلاوة آية بآية بلا سكتة (ExoPlayer بقائمة تشغيل): الآية التالية تُحلّ مصادرها وتُضاف خلف الجارية أثناء تشغيلها فيحمّلها المشغّل مسبقًا
 *  وينتقل إليها بنفسه لحظة انتهاء الجارية — لا انتظار شبكةٍ بين الآيتين. مصادر بالترتيب (محلي → quran.com بتوقيتات الكلمات → Islamic Network)،
 *  تكرار الآية والمقطع، السرعة، مؤقت النوم، وتظليل الكلمة */
object Recitation {
  private var player: ExoPlayer? = null
  var queue by mutableStateOf<List<Int>>(emptyList()); private set
  var index by mutableStateOf(-1); private set
  var isPlaying by mutableStateOf(false); private set
  var loading by mutableStateOf(false); private set
  var reciter by mutableStateOf(Catalog.shared.defaultReciter)
  var repeatAyah by mutableStateOf(1)
  /** تكرار القائمة كلها من أوّلها عند انتهائها (يُغيَّر أثناء التشغيل بـ useRepeatRange كي تُعاد تهيئة «التالية») */
  var repeatRange by mutableStateOf(false); private set
  fun useRepeatRange(on: Boolean) { val changed = repeatRange != on; repeatRange = on; if (changed && current != null) prepareNext() }
  /** تكرار «أ–ب»: فهرسا البداية والنهاية داخل القائمة؛ عند بلوغ ب يعود إلى أ */
  var rangeA by mutableStateOf<Int?>(null); private set
  var rangeB by mutableStateOf<Int?>(null); private set
  val hasRange: Boolean get() = rangeA != null && rangeB != null
  fun setRange(a: Int?, b: Int?) { if (a != null && b != null) { rangeA = minOf(a, b); rangeB = maxOf(a, b) } else { rangeA = a; rangeB = b }; if (current != null) prepareNext() }
  fun clearRange() { val had = hasRange; rangeA = null; rangeB = null; if (had && current != null) prepareNext() }
  /** الانتقال داخل الآية الجارية (بالثواني) */
  fun seek(seconds: Double) { val t = seconds.coerceAtLeast(0.0).let { if (duration > 0) minOf(it, duration) else it }; player?.seekTo((t * 1000).toLong()); position = t }
  var words by mutableStateOf(true)
  /** موضع الكلمة الجارية (1..) من توقيتات quran.com */
  var currentWord by mutableStateOf<Int?>(null); private set
  var position by mutableStateOf(0.0); private set
  var duration by mutableStateOf(0.0); private set
  var sleepAt by mutableStateOf<Long?>(null); private set
  var error by mutableStateOf<String?>(null); private set
  var onAyah: ((Int) -> Unit)? = null
  /** الآية التالية المجهّزة خلف الجارية في قائمة المشغّل */
  private data class Prepared(val index: Int, val n: Int, val mediaId: String, val segments: List<List<Int>>?, val sources: List<AyahSource>)
  private var repeatsLeft = 1; private var attempt = 0; private var sources: List<AyahSource> = emptyList(); private var segments: List<List<Int>>? = null; private var loadToken = 0
  private var prepared: Prepared? = null; private var prepareToken = 0; private var currentMediaId = ""
  private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
  private var ticker: Job? = null
  val current: Int? get() = if (index in queue.indices) queue[index] else null
  val currentAyah: Ayah? get() = current?.let { QuranText.shared.ayah(it) }
  val hasWords: Boolean get() = segments != null

  private fun ensure(ctx: Context): ExoPlayer = player ?: ExoPlayer.Builder(ctx.applicationContext)
    .setAudioAttributes(AudioAttributes.Builder().setContentType(C.AUDIO_CONTENT_TYPE_SPEECH).setUsage(C.USAGE_MEDIA).build(), true).build().also { p ->
      p.addListener(object : Player.Listener {
        override fun onIsPlayingChanged(playing: Boolean) { isPlaying = playing; if (playing) startTicker() }
        override fun onPlaybackStateChanged(state: Int) {
          if (state == Player.STATE_ENDED) onEnded()
          if (state == Player.STATE_READY) { loading = false; val d = p.duration; duration = if (d > 0) d / 1000.0 else 0.0 }
        }
        /** انتقال المشغّل بنفسه إلى الآية المجهّزة: تُعتمد حالتُها (الفهرس والتوقيتات) لحظة صيرورتها الجارية */
        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
          val pr = prepared ?: return
          if (reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO && mediaItem?.mediaId == pr.mediaId) adopt(pr)
        }
        override fun onPlayerError(e: PlaybackException) { onFailed() }
      })
      player = p
    }
  fun play(ctx: Context, q: List<Int>, start: Int = 0) { ensure(ctx); queue = q; index = start.coerceIn(0, maxOf(0, q.size - 1)); repeatsLeft = repeatAyah; attempt = 0; rangeA = null; rangeB = null; load(true) }
  /** الفهرس الذي يلي الجاري في القائمة (مع «أ–ب» وتكرار القائمة)، أو null عند نهايتها */
  private fun followingIndex(): Int? {
    val a = rangeA; val b = rangeB
    if (a != null && b != null && index >= b && a < queue.size) return a
    if (index + 1 < queue.size) return index + 1
    if (repeatRange && queue.isNotEmpty()) return 0
    return null
  }
  private fun load(autoplay: Boolean) {
    val n = current ?: return; val token = ++loadToken; loading = true; error = null
    discardPrepared()
    scope.launch {
      val srcs = withContext(Dispatchers.IO) { AudioSources.sources(reciter, n, words) }
      if (token != loadToken) return@launch
      if (srcs.isEmpty()) { loading = false; error = "unavailable"; return@launch }
      sources = srcs; val src = srcs[minOf(attempt, srcs.size - 1)]; segments = src.segments; currentWord = null; position = 0.0; duration = 0.0
      val p = player ?: return@launch
      discardPrepared()
      currentMediaId = "n:$n:${System.nanoTime()}"
      p.setMediaItem(MediaItem.Builder().setUri(src.url).setMediaId(currentMediaId).build()); p.playbackParameters = PlaybackParameters(Store.rate.toFloat()); p.prepare(); p.playWhenReady = autoplay
      onAyah?.invoke(n)
      if (repeatsLeft <= 1) prepareNext()
    }
  }
  /** إزالة أيّ عنصرٍ مجهّز خلف الجاري (تغيّر المدى أو القارئ أو الانتقال اليدوي) */
  private fun discardPrepared() {
    prepareToken++
    val p = player
    if (prepared != null && p != null) { val i = p.currentMediaItemIndex; if (i >= 0 && p.mediaItemCount > i + 1) p.removeMediaItems(i + 1, p.mediaItemCount) }
    prepared = null
  }
  /** تجهيز الآية التالية خلف الجارية كي يحمّلها المشغّل أثناء التلاوة وينتقل إليها بلا فجوة */
  private fun prepareNext() {
    discardPrepared()
    val p = player ?: return
    if (repeatsLeft > 1) return
    val i = followingIndex() ?: return
    val n = queue[i]; val token = prepareToken; val curId = currentMediaId
    scope.launch {
      val srcs = withContext(Dispatchers.IO) { AudioSources.sources(reciter, n, words) }
      if (token != prepareToken || srcs.isEmpty() || currentMediaId != curId || p.mediaItemCount == 0) return@launch
      val src = srcs[0]; val id = "n:$n:${System.nanoTime()}"
      p.addMediaItem(MediaItem.Builder().setUri(src.url).setMediaId(id).build())
      prepared = Prepared(i, n, id, src.segments, srcs)
    }
  }
  /** اعتماد الآية المجهّزة بعد انتقال المشغّل إليها بنفسه */
  private fun adopt(pr: Prepared) {
    prepared = null
    currentMediaId = pr.mediaId
    index = pr.index; attempt = 0; repeatsLeft = repeatAyah
    sources = pr.sources; segments = pr.segments; currentWord = null; position = 0.0
    val p = player
    duration = p?.duration?.takeIf { it > 0 }?.let { it / 1000.0 } ?: 0.0
    // العنصر المنتهي يبقى في القائمة قبل الجاري: يُحذف كي لا تتراكم
    if (p != null) { val ci = p.currentMediaItemIndex; if (ci > 0) p.removeMediaItems(0, ci) }
    onAyah?.invoke(pr.n)
    if (repeatsLeft <= 1) prepareNext()
  }
  private fun onFailed() { if (current == null) return; if (attempt + 1 < sources.size) { attempt++; load(true) } else { isPlaying = false; loading = false; error = "network" } }
  private fun startTicker() {
    ticker?.cancel()
    ticker = scope.launch {
      while (isActive) {
        val p = player ?: break
        if (!p.isPlaying) break
        val t = p.currentPosition / 1000.0; position = t
        val d = p.duration; if (d > 0) duration = d / 1000.0
        val w = QdcMeta.wordAt(t, segments); if (w != currentWord) currentWord = w
        sleepAt?.let { if (System.currentTimeMillis() >= it) { sleepAt = null; pause() } }
        delay(100)
      }
    }
  }
  private fun onEnded() {
    if (repeatsLeft > 1) { repeatsLeft--; if (repeatsLeft == 1) prepareNext(); player?.seekTo(0); player?.play(); return }
    // مع آيةٍ مجهّزة لا يصل المشغّل إلى النهاية (ينتقل بنفسه)؛ هنا نهاية القائمة أو تجهيزٌ لم يكتمل بعد
    repeatsLeft = repeatAyah
    val i = followingIndex()
    if (i != null) { index = i; attempt = 0; load(true) } else isPlaying = false
  }
  fun toggle() { player?.let { if (it.isPlaying) it.pause() else resume() } }
  fun pause() { player?.pause() }
  private fun resume() { val p = player ?: return; if (p.playbackState == Player.STATE_ENDED || p.mediaItemCount == 0) { if (current != null) { repeatsLeft = repeatAyah; attempt = 0; load(true) } } else p.play() }
  fun next(ctx: Context) { if (index + 1 < queue.size) { index++; repeatsLeft = repeatAyah; attempt = 0; load(true) } }
  fun prev(ctx: Context) { if (index > 0) { index--; repeatsLeft = repeatAyah; attempt = 0; load(true) } else player?.seekTo(0) }
  fun stop() { rangeA = null; rangeB = null; loadToken++; prepareToken++; prepared = null; ticker?.cancel(); player?.stop(); player?.clearMediaItems(); currentMediaId = ""; queue = emptyList(); index = -1; isPlaying = false; loading = false; segments = null; currentWord = null; sleepAt = null; error = null }
  fun setRate(r: Double) { Store.rate = r; Store.save(); player?.playbackParameters = PlaybackParameters(r.toFloat()) }
  fun useReciter(id: String) { val was = isPlaying; reciter = id; attempt = 0; if (current != null) load(was) }
  fun useWordTiming(on: Boolean) { val changed = words != on; words = on; if (changed && current != null) { attempt = 0; load(isPlaying) } }
  /** مؤقت النوم بالدقائق (0 = إلغاء) */
  fun setSleep(minutes: Int) { sleepAt = if (minutes > 0) System.currentTimeMillis() + minutes * 60_000L else null }
  val sleepMinutesLeft: Int? get() = sleepAt?.let { maxOf(1, ((it - System.currentTimeMillis()) / 60000.0).roundToInt()) }
  fun label(): String = currentAyah?.let { "${QuranMeta.surah(it.surah).name}: ${it.ayah}" } ?: ""
}
