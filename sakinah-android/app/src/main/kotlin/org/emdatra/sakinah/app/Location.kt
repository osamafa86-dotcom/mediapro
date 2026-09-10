package org.emdatra.sakinah.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.CancellationSignal
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.suspendCancellableCoroutine
import org.emdatra.sakinah.core.CityDatabase
import java.util.Locale
import java.util.concurrent.Executors
import kotlin.coroutines.resume

/** موقع الجهاز (LocationManager بلا خدمات Google) مع تسمية المدينة من القاعدة المضمّنة أو Geocoder */
object Loc {
  fun granted(ctx: Context) = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED || ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
  suspend fun current(ctx: Context): Location? {
    if (!granted(ctx)) return null
    val lm = ctx.getSystemService(LocationManager::class.java)
    val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER, LocationManager.PASSIVE_PROVIDER).filter { runCatching { lm.isProviderEnabled(it) }.getOrDefault(false) }
    val last = providers.mapNotNull { runCatching { lm.getLastKnownLocation(it) }.getOrNull() }.maxByOrNull { it.time }
    if (last != null && System.currentTimeMillis() - last.time < 10 * 60_000) return last
    if (Build.VERSION.SDK_INT >= 30) {
      for (p in providers) {
        val loc = suspendCancellableCoroutine<Location?> { cont ->
          val sig = CancellationSignal(); cont.invokeOnCancellation { sig.cancel() }
          runCatching { lm.getCurrentLocation(p, sig, Executors.newSingleThreadExecutor()) { if (cont.isActive) cont.resume(it) } }.onFailure { if (cont.isActive) cont.resume(null) }
        }
        if (loc != null) return loc
      }
    }
    return last
  }
  /** تطبيق موقع الجهاز على الحالة: أقرب مدينة للاسم والدولة والمنطقة الزمنية (وGeocoder إن توفر) */
  suspend fun apply(ctx: Context, loc: Location) {
    val near = CityDatabase.bundled.nearest(loc.latitude, loc.longitude)
    var name = near?.let { if (it.second < 40) it.first.nameAr else "${it.first.nameAr} (قرب)" }; var cc = near?.first?.countryCode
    withContext(Dispatchers.IO) {
      runCatching { if (Geocoder.isPresent()) { @Suppress("DEPRECATION") val a = Geocoder(ctx, Locale("ar")).getFromLocation(Math.round(loc.latitude * 100) / 100.0, Math.round(loc.longitude * 100) / 100.0, 1)?.firstOrNull(); if (a != null) { name = a.locality ?: a.subAdminArea ?: a.adminArea ?: name; cc = a.countryCode ?: cc } } }
    }
    Store.locMode = "gps"; Store.locLat = loc.latitude; Store.locLon = loc.longitude; Store.locTz = java.util.TimeZone.getDefault().id; Store.locName = name; Store.locCountry = cc; Store.locCityId = null
    Store.applyAutoMethod(); Store.save()
  }
}
