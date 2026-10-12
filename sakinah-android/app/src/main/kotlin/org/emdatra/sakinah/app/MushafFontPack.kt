package org.emdatra.sakinah.app

import android.content.Context
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.google.android.play.core.assetpacks.AssetPackManager
import com.google.android.play.core.assetpacks.AssetPackManagerFactory
import com.google.android.play.core.assetpacks.AssetPackState
import com.google.android.play.core.assetpacks.AssetPackStateUpdateListener
import com.google.android.play.core.assetpacks.model.AssetPackErrorCode
import com.google.android.play.core.assetpacks.model.AssetPackStatus
import java.io.File

/**
 * خطوط صفحات المصحف الـ604 تأتي في حزمة أصول Play (`mushaf_fonts`، fast-follow): تُنزَّل تلقائيًا بعد
 * التثبيت ولا تُحتسب في حجم التطبيق المعروض (كانت 111 م.ب من 128). حتى تكتمل يعمل المصحف بوضع النص.
 * الحالة قابلة للمراقبة من Compose؛ والجلب لا ينجح إلا والتطبيق في الواجهة، لذا يُستدعى [ensure] من onResume.
 */
object MushafFontPack {
  const val NAME = "mushaf_fonts"
  /** حجم التنزيل التقريبي للعرض قبل أن تعرفه Play (يُستبدل بالفعلي من الحالة) */
  private const val APPROX_BYTES = 111_000_000L

  enum class Phase { UNKNOWN, READY, PENDING, DOWNLOADING, WAITING_FOR_WIFI, NEEDS_CONFIRMATION, FAILED, UNAVAILABLE }

  var phase by mutableStateOf(Phase.UNKNOWN); private set
  /** 0…1 أثناء التنزيل */
  var progress by mutableFloatStateOf(0f); private set
  var totalBytes by mutableLongStateOf(APPROX_BYTES); private set
  var errorCode by mutableIntStateOf(AssetPackErrorCode.NO_ERROR); private set
  /** مجلد `fonts/` داخل الحزمة المنزَّلة (أو null إن لم تكن بعد)؛ يقرؤه [Fonts] */
  @Volatile var dir: File? = null; private set

  private var manager: AssetPackManager? = null
  private var inBase = false
  private var fetching = false

  private val listener = AssetPackStateUpdateListener { s -> if (s.name() == NAME) apply(s) }

  fun init(ctx: Context) {
    val app = ctx.applicationContext
    // نسخة مبنية بـ -PfontsInBase=true تحمل الخطوط في assets الأساسية (APK مستقل للتجربة): لا حزمة ولا تنزيل
    inBase = runCatching { app.assets.open("fonts/p1.ttf").close(); true }.getOrDefault(false)
    if (inBase) { phase = Phase.READY; return }
    manager = runCatching { AssetPackManagerFactory.getInstance(app) }.getOrNull()
    if (manager == null) { phase = Phase.UNAVAILABLE; return }
    manager?.registerListener(listener)
    locate()
  }

  /** هل الحزمة موجودة على الجهاز؟ يحدّث [dir] و[phase] */
  fun locate(): Boolean {
    if (inBase) return true
    val path = manager?.getPackLocation(NAME)?.assetsPath()
    val d = path?.let { File(it, "fonts") }
    return if (d != null && File(d, "p1.ttf").exists() && File(d, "p604.ttf").exists()) {
      dir = d; phase = Phase.READY; progress = 1f; true
    } else { dir = null; if (phase == Phase.READY) phase = Phase.UNKNOWN; false }
  }

  /** من onResume: إن لم تكن الحزمة موجودة يُطلب جلبها (fast-follow يبدأ وحده عادةً، لكنه قد يتوقّف أو يُلغى) */
  fun ensure() {
    if (inBase || manager == null || locate()) return
    fetch()
  }

  fun fetch() {
    val m = manager ?: return
    if (fetching || phase == Phase.DOWNLOADING) return
    fetching = true
    if (phase == Phase.UNKNOWN || phase == Phase.FAILED || phase == Phase.UNAVAILABLE) phase = Phase.PENDING
    m.fetch(listOf(NAME))
      .addOnSuccessListener { states -> fetching = false; states.packStates()[NAME]?.let { apply(it) } }
      .addOnFailureListener { fetching = false; phase = Phase.UNAVAILABLE }
  }

  /** حوار Play للسماح بالتنزيل عبر بيانات الهاتف (بانتظار Wi-Fi) أو للتأكيد؛ النتيجة تصل بالمستمع */
  fun confirm(launcher: ActivityResultLauncher<IntentSenderRequest>) {
    runCatching { manager?.showConfirmationDialog(launcher) }
  }

  private fun apply(s: AssetPackState) {
    val total = s.totalBytesToDownload(); if (total > 0) totalBytes = total
    when (s.status()) {
      AssetPackStatus.COMPLETED -> { progress = 1f; if (!locate()) phase = Phase.FAILED }
      AssetPackStatus.PENDING -> phase = Phase.PENDING
      AssetPackStatus.DOWNLOADING -> { phase = Phase.DOWNLOADING; if (total > 0) progress = (s.bytesDownloaded().toFloat() / total).coerceIn(0f, 1f) }
      AssetPackStatus.TRANSFERRING -> { phase = Phase.DOWNLOADING; progress = (s.transferProgressPercentage() / 100f).coerceIn(0f, 1f) }
      AssetPackStatus.WAITING_FOR_WIFI -> phase = Phase.WAITING_FOR_WIFI
      AssetPackStatus.REQUIRES_USER_CONFIRMATION -> phase = Phase.NEEDS_CONFIRMATION
      AssetPackStatus.NOT_INSTALLED -> { if (phase != Phase.PENDING) phase = Phase.UNKNOWN }
      AssetPackStatus.CANCELED -> phase = Phase.FAILED
      AssetPackStatus.FAILED -> {
        errorCode = s.errorCode()
        // تثبيت من خارج Play (APK منسوخ) لا يملك الحزمة أصلًا: لا جدوى من إعادة المحاولة
        phase = when (s.errorCode()) {
          AssetPackErrorCode.APP_NOT_OWNED, AssetPackErrorCode.APP_UNAVAILABLE, AssetPackErrorCode.PACK_UNAVAILABLE, AssetPackErrorCode.UNRECOGNIZED_INSTALLATION -> Phase.UNAVAILABLE
          else -> Phase.FAILED
        }
      }
      else -> {}
    }
  }

  /** نص الحالة للواجهة */
  fun label(): String = when (phase) {
    Phase.READY -> "خطوط المصحف جاهزة"
    Phase.PENDING -> "جارٍ تجهيز تنزيل خطوط المصحف…"
    Phase.DOWNLOADING -> "جارٍ تنزيل خطوط المصحف · ${Fmt.number((progress * 100).toInt())}٪ من ${AudioDownloads.fmtBytes(totalBytes)}"
    Phase.WAITING_FOR_WIFI -> "خطوط المصحف (${AudioDownloads.fmtBytes(totalBytes)}) بانتظار شبكة Wi-Fi"
    Phase.NEEDS_CONFIRMATION -> "تنزيل خطوط المصحف (${AudioDownloads.fmtBytes(totalBytes)}) يحتاج موافقتك"
    Phase.FAILED -> "تعذّر تنزيل خطوط المصحف"
    Phase.UNAVAILABLE -> "خطوط صفحات المصحف غير متاحة في هذه النسخة"
    Phase.UNKNOWN -> "خطوط المصحف لم تُنزَّل بعد"
  }
}
