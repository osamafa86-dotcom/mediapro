package org.emdatra.sakinah.app

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import org.emdatra.sakinah.core.Catalog
import org.emdatra.sakinah.core.QuranText

/** مشغّل التلاوة آية بآية (ExoPlayer): قائمة آيات من Islamic Network بحسب القارئ، تكرار الآية، السرعة */
object Recitation {
  private var player: ExoPlayer? = null
  var queue by mutableStateOf<List<Int>>(emptyList()); private set
  var index by mutableStateOf(-1); private set
  var isPlaying by mutableStateOf(false); private set
  var reciter by mutableStateOf(Catalog.shared.defaultReciter)
  var repeatAyah by mutableStateOf(1)
  private var repeatsLeft = 1
  val current: Int? get() = if (index in queue.indices) queue[index] else null

  private fun url(n: Int): String { val r = Catalog.shared.reciter(reciter); val b = r.bitrates.firstOrNull() ?: 64; return "https://cdn.islamic.network/quran/audio/$b/${if (r.bitrates.isEmpty()) "ar.alafasy" else reciter}/$n.mp3" }
  private fun ensure(ctx: Context): ExoPlayer = player ?: ExoPlayer.Builder(ctx.applicationContext).build().also { p ->
    p.addListener(object : Player.Listener {
      override fun onIsPlayingChanged(playing: Boolean) { isPlaying = playing }
      override fun onPlaybackStateChanged(state: Int) { if (state == Player.STATE_ENDED) onEnded(ctx) }
    })
    player = p
  }
  fun play(ctx: Context, q: List<Int>, start: Int = 0) { queue = q; index = start.coerceIn(0, maxOf(0, q.size - 1)); repeatsLeft = repeatAyah; load(ctx) }
  private fun load(ctx: Context) { val n = current ?: return; val p = ensure(ctx); p.setMediaItem(MediaItem.fromUri(url(n))); p.playbackParameters = PlaybackParameters(Store.rate.toFloat()); p.prepare(); p.play() }
  private fun onEnded(ctx: Context) {
    if (repeatsLeft > 1) { repeatsLeft--; player?.seekTo(0); player?.play(); return }
    repeatsLeft = repeatAyah
    if (index + 1 < queue.size) { index++; load(ctx) } else stop()
  }
  fun toggle() { player?.let { if (it.isPlaying) it.pause() else it.play() } }
  fun next(ctx: Context) { if (index + 1 < queue.size) { index++; repeatsLeft = repeatAyah; load(ctx) } }
  fun prev(ctx: Context) { if (index > 0) { index--; repeatsLeft = repeatAyah; load(ctx) } else player?.seekTo(0) }
  fun stop() { player?.stop(); queue = emptyList(); index = -1; isPlaying = false }
  fun setRate(r: Double) { Store.rate = r; Store.save(); player?.playbackParameters = PlaybackParameters(r.toFloat()) }
  fun label(): String = current?.let { QuranText.shared.ayah(it) }?.let { "${org.emdatra.sakinah.core.QuranMeta.surah(it.surah).name}: ${it.ayah}" } ?: ""
}
