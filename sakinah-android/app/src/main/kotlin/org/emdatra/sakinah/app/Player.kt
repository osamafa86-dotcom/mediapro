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

/** مشغّل التلاوة آية بآية (ExoPlayer): مصادر بالترتيب (محلي → quran.com بتوقيتات الكلمات → Islamic Network)، تكرار الآية والمقطع، السرعة، مؤقت النوم، وتظليل الكلمة */
object Recitation {
  private var player: ExoPlayer? = null
  var queue by mutableStateOf<List<Int>>(emptyList()); private set
  var index by mutableStateOf(-1); private set
  var isPlaying by mutableStateOf(false); private set
  var loading by mutableStateOf(false); private set
  var reciter by mutableStateOf(Catalog.shared.defaultReciter)
  var repeatAyah by mutableStateOf(1)
  var repeatRange by mutableStateOf(false)
  var words by mutableStateOf(true)
  /** موضع الكلمة الجارية (1..) من توقيتات quran.com */
  var currentWord by mutableStateOf<Int?>(null); private set
  var position by mutableStateOf(0.0); private set
  var duration by mutableStateOf(0.0); private set
  var sleepAt by mutableStateOf<Long?>(null); private set
  var error by mutableStateOf<String?>(null); private set
  var onAyah: ((Int) -> Unit)? = null
  private var repeatsLeft = 1; private var attempt = 0; private var sources: List<AyahSource> = emptyList(); private var segments: List<List<Int>>? = null; private var loadToken = 0
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
        override fun onPlayerError(e: PlaybackException) { onFailed() }
      })
      player = p
    }
  fun play(ctx: Context, q: List<Int>, start: Int = 0) { ensure(ctx); queue = q; index = start.coerceIn(0, maxOf(0, q.size - 1)); repeatsLeft = repeatAyah; attempt = 0; load(true) }
  private fun load(autoplay: Boolean) {
    val n = current ?: return; val token = ++loadToken; loading = true; error = null
    scope.launch {
      val srcs = withContext(Dispatchers.IO) { AudioSources.sources(reciter, n, words) }
      if (token != loadToken) return@launch
      if (srcs.isEmpty()) { loading = false; error = "unavailable"; return@launch }
      sources = srcs; val src = srcs[minOf(attempt, srcs.size - 1)]; segments = src.segments; currentWord = null; position = 0.0; duration = 0.0
      val p = player ?: return@launch
      p.setMediaItem(MediaItem.fromUri(src.url)); p.playbackParameters = PlaybackParameters(Store.rate.toFloat()); p.prepare(); p.playWhenReady = autoplay
      onAyah?.invoke(n)
    }
  }
  private fun onFailed() { if (current == null) return; if (attempt + 1 < sources.size) { attempt++; load(true) } else { isPlaying = false; loading = false; error = "network" } }
  private fun startTicker() {
    ticker?.cancel()
    ticker = scope.launch {
      while (isActive) {
        val p = player ?: break
        if (!p.isPlaying) break
        val t = p.currentPosition / 1000.0; position = t
        val w = QdcMeta.wordAt(t, segments); if (w != currentWord) currentWord = w
        sleepAt?.let { if (System.currentTimeMillis() >= it) { sleepAt = null; pause() } }
        delay(100)
      }
    }
  }
  private fun onEnded() {
    if (repeatsLeft > 1) { repeatsLeft--; player?.seekTo(0); player?.play(); return }
    repeatsLeft = repeatAyah
    if (index + 1 < queue.size) { index++; attempt = 0; load(true) }
    else if (repeatRange && queue.isNotEmpty()) { index = 0; attempt = 0; load(true) }
    else isPlaying = false
  }
  fun toggle() { player?.let { if (it.isPlaying) it.pause() else it.play() } }
  fun pause() { player?.pause() }
  fun next(ctx: Context) { if (index + 1 < queue.size) { index++; repeatsLeft = repeatAyah; attempt = 0; load(true) } }
  fun prev(ctx: Context) { if (index > 0) { index--; repeatsLeft = repeatAyah; attempt = 0; load(true) } else player?.seekTo(0) }
  fun stop() { loadToken++; ticker?.cancel(); player?.stop(); queue = emptyList(); index = -1; isPlaying = false; loading = false; segments = null; currentWord = null; sleepAt = null; error = null }
  fun setRate(r: Double) { Store.rate = r; Store.save(); player?.playbackParameters = PlaybackParameters(r.toFloat()) }
  fun useReciter(id: String) { val was = isPlaying; reciter = id; attempt = 0; if (current != null) load(was) }
  fun useWordTiming(on: Boolean) { val changed = words != on; words = on; if (changed && current != null) { attempt = 0; load(isPlaying) } }
  /** مؤقت النوم بالدقائق (0 = إلغاء) */
  fun setSleep(minutes: Int) { sleepAt = if (minutes > 0) System.currentTimeMillis() + minutes * 60_000L else null }
  val sleepMinutesLeft: Int? get() = sleepAt?.let { maxOf(1, ((it - System.currentTimeMillis()) / 60000.0).roundToInt()) }
  fun label(): String = currentAyah?.let { "${QuranMeta.surah(it.surah).name}: ${it.ayah}" } ?: ""
}
