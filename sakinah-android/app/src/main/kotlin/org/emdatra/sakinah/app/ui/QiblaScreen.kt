package org.emdatra.sakinah.app.ui

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.emdatra.sakinah.app.Fmt
import org.emdatra.sakinah.app.Store
import org.emdatra.sakinah.core.Geomag
import org.emdatra.sakinah.core.Qibla
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

/** بوصلة القبلة: متجه الدوران للجهاز ← اتجاه مغناطيسي ← شمال حقيقي بانحراف WMM2025 ← سهم القبلة (Vincenty) */
@Composable fun QiblaScreen() {
  val ctx = LocalContext.current
  val coords = Store.coords
  var heading by remember { mutableFloatStateOf(0f) }; var accuracy by remember { mutableIntStateOf(-1) }
  DisposableEffect(Unit) {
    val sm = ctx.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    val sensor = sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
    val l = object : SensorEventListener {
      val r = FloatArray(9); val o = FloatArray(3)
      override fun onSensorChanged(e: SensorEvent) { SensorManager.getRotationMatrixFromVector(r, e.values); SensorManager.getOrientation(r, o); val az = Math.toDegrees(o[0].toDouble()).toFloat(); heading = (az + 360) % 360 }
      override fun onAccuracyChanged(s: Sensor?, a: Int) { accuracy = a }
    }
    if (sensor != null) sm.registerListener(l, sensor, SensorManager.SENSOR_DELAY_UI)
    onDispose { sm.unregisterListener(l) }
  }
  Column(Modifier.fillMaxSize().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
    if (coords == null) { Text("حدّد موقعك من تبويب الصلاة لعرض اتجاه القبلة", modifier = Modifier.padding(top = 40.dp)); return }
    val info = remember(coords) { Qibla.info(coords.latitude, coords.longitude) }
    val decl = remember(coords) { Geomag.declination(coords.latitude, coords.longitude) }
    val trueHeading = Geomag.magneticToTrue(heading.toDouble(), decl)
    val diff = Qibla.signedDifference(info.bearing, trueHeading)
    val aligned = abs(diff) <= 3
    Text("القبلة ${Fmt.decimal(info.bearing, 1)}° ${info.compassPoint}", fontSize = 20.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp))
    Text("المسافة إلى الكعبة ${Fmt.decimal(info.distanceKm, 0)} كم · الانحراف المغناطيسي ${Fmt.decimal(decl, 1)}°", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
    Spacer(Modifier.height(24.dp))
    val ring = if (aligned) Teal else MaterialTheme.colorScheme.onSurfaceVariant
    Canvas(Modifier.size(280.dp)) {
      val c = center; val r = size.minDimension / 2 - 8.dp.toPx()
      drawCircle(ring, r, c, style = Stroke(3.dp.toPx()))
      rotate(-trueHeading.toFloat(), c) {
        for (i in 0 until 72) { val a = Math.toRadians(i * 5.0); val len = if (i % 18 == 0) 18.dp.toPx() else if (i % 6 == 0) 12.dp.toPx() else 6.dp.toPx(); drawLine(ring, Offset(c.x + (r - len) * sin(a).toFloat(), c.y - (r - len) * cos(a).toFloat()), Offset(c.x + r * sin(a).toFloat(), c.y - r * cos(a).toFloat()), 2f) }
        drawCircle(Color.Red, 6.dp.toPx(), Offset(c.x, c.y - r + 24.dp.toPx()))
        rotate(info.bearing.toFloat(), c) {
          val p = Path(); p.moveTo(c.x, c.y - r + 40.dp.toPx()); p.lineTo(c.x - 16.dp.toPx(), c.y + 10.dp.toPx()); p.lineTo(c.x, c.y - 6.dp.toPx()); p.lineTo(c.x + 16.dp.toPx(), c.y + 10.dp.toPx()); p.close()
          drawPath(p, if (aligned) Teal else Gold)
        }
      }
      drawCircle(if (aligned) Teal else Gold, 6.dp.toPx(), c)
    }
    Spacer(Modifier.height(16.dp))
    Text(if (aligned) "✓ أنت متجه إلى القبلة" else if (diff > 0) "در يمينًا ${Fmt.decimal(abs(diff), 0)}°" else "در يسارًا ${Fmt.decimal(abs(diff), 0)}°", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = if (aligned) Teal else MaterialTheme.colorScheme.onSurface)
    if (accuracy in 0..1) Text("دقة البوصلة منخفضة — حرّك الهاتف على شكل ٨ لمعايرتها", color = MaterialTheme.colorScheme.error, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
    Text("أبعد الهاتف عن المعادن والمغناطيس. الاتجاه بالنسبة إلى الشمال الحقيقي (المغناطيسي مصحّح بنموذج WMM2025).", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp, modifier = Modifier.padding(top = 16.dp))
  }
}
