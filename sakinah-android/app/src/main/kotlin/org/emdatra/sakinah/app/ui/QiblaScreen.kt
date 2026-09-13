package org.emdatra.sakinah.app.ui

import android.Manifest
import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.emdatra.sakinah.app.Fmt
import org.emdatra.sakinah.app.Loc
import org.emdatra.sakinah.app.Notify
import org.emdatra.sakinah.app.Store
import org.emdatra.sakinah.core.Geomag
import org.emdatra.sakinah.core.Qibla
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

/** شاشة القبلة (تصميم Figma 10): شريط حالة، قرص بوصلة بإبرة ذهبية، بلاطتا المسافة والاتجاه، بطاقة الموقع، وتلميح المعايرة */
@OptIn(ExperimentalMaterial3Api::class)
@Composable fun QiblaScreen() {
  val ctx = LocalContext.current
  val c = DS.c
  val coords = Store.coords
  var heading by remember { mutableFloatStateOf(0f) }
  var sensorAccuracy by remember { mutableIntStateOf(-1) }
  var live by remember { mutableStateOf(false) }
  var info by remember { mutableStateOf(false) }
  val scope = rememberCoroutineScope()
  val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { g ->
    if (g.values.any { it }) scope.launch { Loc.current(ctx)?.let { Loc.apply(ctx, it); Notify.schedule(ctx) } }
  }
  fun refreshLocation() {
    if (Loc.granted(ctx)) scope.launch { Loc.current(ctx)?.let { Loc.apply(ctx, it); Notify.schedule(ctx) } }
    else permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
  }

  DisposableEffect(Unit) {
    val sm = ctx.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    val sensor = sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
    val l = object : SensorEventListener {
      val r = FloatArray(9); val o = FloatArray(3)
      override fun onSensorChanged(e: SensorEvent) {
        SensorManager.getRotationMatrixFromVector(r, e.values); SensorManager.getOrientation(r, o)
        heading = ((Math.toDegrees(o[0].toDouble()).toFloat()) + 360) % 360; live = true
      }
      override fun onAccuracyChanged(s: Sensor?, a: Int) { sensorAccuracy = a }
    }
    if (sensor != null) sm.registerListener(l, sensor, SensorManager.SENSOR_DELAY_UI)
    onDispose { sm.unregisterListener(l) }
  }

  Column(Modifier.fillMaxSize().background(c.bgCanvas).verticalScroll(rememberScrollState())) {
    DSNavBar("القبلة") {
      DSIconButton(Icons.Outlined.MyLocation, contentDescription = "تحديث الموقع") { refreshLocation() }
      Spacer(Modifier.width(8.dp))
      DSIconButton(Icons.Outlined.Info, contentDescription = "عن حساب القبلة") { info = true }
    }
    if (coords == null) {
      Column(Modifier.fillMaxWidth().padding(16.dp, 48.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        DSIconButton(Icons.Outlined.LocationOff, style = IconStyle.Soft, size = 64.dp, iconSize = 26.dp)
        Spacer(Modifier.height(14.dp))
        Text("حدّد موقعك لعرض اتجاه القبلة", style = DSType.headingSm, color = c.textPrimary)
        Spacer(Modifier.height(6.dp))
        Text("يُحسب الاتجاه على جهازك من إحداثياتك، ولا تُرسل إلى أي خادم.", style = DSType.bodySm, color = c.textSecondary, textAlign = TextAlign.Center)
        Spacer(Modifier.height(16.dp))
        DSButton("تحديد الموقع", icon = Icons.Outlined.MyLocation) { refreshLocation() }
      }
      return@Column
    }

    val qibla = remember(coords) { Qibla.info(coords.latitude, coords.longitude) }
    val decl = remember(coords) { Geomag.declination(coords.latitude, coords.longitude) }
    val trueHeading = Geomag.magneticToTrue(heading.toDouble(), decl)
    val diff = Qibla.signedDifference(qibla.bearing, trueHeading)
    val aligned = live && abs(diff) <= 3
    val lowAccuracy = sensorAccuracy in 0..1

    Column(Modifier.fillMaxWidth().padding(16.dp, 0.dp, 16.dp, 32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
      // شريط الحالة
      val statusText = when {
        !live -> "حرّك الهاتف على شكل ٨ لمعايرة البوصلة"
        aligned -> "متّجه نحو القبلة · ثبّت الهاتف مستويًا"
        diff > 0 -> "أدر الهاتف يمينًا ${Fmt.decimal(abs(diff), 0)}°"
        else -> "أدر الهاتف يسارًا ${Fmt.decimal(abs(diff), 0)}°"
      }
      val statusIcon: ImageVector = when {
        !live -> Icons.Outlined.Autorenew
        aligned -> Icons.Filled.CheckCircle
        diff > 0 -> Icons.Outlined.TurnRight
        else -> Icons.Outlined.TurnLeft
      }
      val statusBg = if (aligned) c.brandSoft else if (lowAccuracy) c.accentGoldSoft else c.bgSubtle
      val statusFg = if (aligned) c.brandStrong else if (lowAccuracy) c.accentGoldStrong else c.textSecondary
      Row(
        Modifier.fillMaxWidth().clip(CircleShape).background(statusBg).padding(16.dp, 12.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center
      ) {
        Text(statusText, style = DSType.labelMd, color = statusFg, maxLines = 1)
        Spacer(Modifier.width(8.dp))
        Icon(statusIcon, null, Modifier.size(18.dp), tint = if (aligned) c.brandPrimary else statusFg)
      }

      Spacer(Modifier.height(16.dp))
      CompassDial(qibla.bearing, trueHeading, aligned, live)
      Spacer(Modifier.height(16.dp))

      Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        MetricTile(Icons.Outlined.GpsFixed, "${Fmt.decimal(qibla.distanceKm, 0)} كم", "إلى الكعبة", Modifier.weight(1f))
        MetricTile(Icons.Outlined.NearMe, "${Fmt.decimal(qibla.bearing, 0)}°", "اتجاه القبلة", Modifier.weight(1f))
      }

      Spacer(Modifier.height(12.dp))
      Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(c.accentGoldSoft.copy(alpha = 0.55f)).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
      ) {
        Column(Modifier.weight(1f)) {
          Text(Store.locName ?: "موقعك الحالي", style = DSType.labelMd, color = c.textPrimary, maxLines = 1)
          Text("الانحراف المغناطيسي ${if (decl >= 0) "+" else "−"}${Fmt.decimal(abs(decl), 1)}° مُعوَّض تلقائيًا (WMM 2025)", style = DSType.labelXs, color = c.textSecondary, maxLines = 1)
        }
        Spacer(Modifier.width(12.dp))
        DSIconButton(Icons.Outlined.PinDrop, style = IconStyle.GoldSoft, size = 38.dp, iconSize = 16.dp)
      }

      Spacer(Modifier.height(10.dp))
      HintBar(
        if (lowAccuracy) Icons.Outlined.WarningAmber else Icons.Outlined.Autorenew,
        "إن بدت الإبرة مضطربة حرّك الهاتف على شكل ٨ لمعايرة البوصلة",
        lowAccuracy
      )
      if (qibla.antipodal) {
        Spacer(Modifier.height(8.dp))
        HintBar(Icons.Outlined.ErrorOutline, "أنت قريب جدًا من الكعبة أو في نقطة يتعذّر فيها تحديد اتجاه واحد.", true)
      }
    }
  }
  if (info) QiblaInfoSheet { info = false }
}

/** قرص البوصلة: حلقة نقاط، حروف الجهات، الكعبة عند الشمال، وإبرة ذهبية تدور نحو القبلة */
@Composable private fun CompassDial(bearing: Double, trueHeading: Double, aligned: Boolean, live: Boolean) {
  val c = DS.c
  val rot by animateFloatAsState(-trueHeading.toFloat(), label = "qibla")
  val needle = if (aligned) c.brandPrimary else c.accentGold
  Box(Modifier.size(300.dp), contentAlignment = Alignment.Center) {
    Box(Modifier.fillMaxSize().clip(CircleShape).background(c.bgSurface))
    Box(Modifier.fillMaxSize(0.78f).clip(CircleShape).background(c.bgSubtle))
    Canvas(Modifier.fillMaxSize()) {
      val ctr = center
      val r = size.minDimension / 2 - 6.dp.toPx()
      rotate(rot, ctr) {
        // حلقة نقاط: كل ٥ درجات، أكبر عند الجهات الأصلية
        for (i in 0 until 72) {
          val a = Math.toRadians(i * 5.0)
          val major = i % 18 == 0
          val rr = r - 14.dp.toPx()
          drawCircle(
            if (major) c.textSecondary else c.borderStrong,
            (if (major) 2.5f else 1.5f).dp.toPx(),
            Offset(ctr.x + rr * sin(a).toFloat(), ctr.y - rr * cos(a).toFloat())
          )
        }
        // الإبرة: رأس نحو القبلة وذيل داكن
        rotate(bearing.toFloat(), ctr) {
          // الكعبة ترافق رأس الإبرة عند اتجاه القبلة. وكانت عند شمال القرص، وهو موضعٌ يُقرأ في
          // شاشة قبلةٍ على أنه القبلة نفسها فيُوجَّه القارئ إلى غير جهتها وهو يظنّ أنه مصيب.
          val kr = r - 58.dp.toPx()
          drawRoundRect(
            c.textPrimary,
            Offset(ctr.x - 9.dp.toPx(), ctr.y - kr - 9.dp.toPx()),
            androidx.compose.ui.geometry.Size(18.dp.toPx(), 18.dp.toPx()),
            androidx.compose.ui.geometry.CornerRadius(3.dp.toPx())
          )
          drawRect(
            c.accentGold,
            Offset(ctr.x - 9.dp.toPx(), ctr.y - kr - 2.dp.toPx()),
            androidx.compose.ui.geometry.Size(18.dp.toPx(), 3.dp.toPx())
          )
          val tip = ctr.y - (r - 66.dp.toPx())
          val head = Path().apply {
            moveTo(ctr.x, tip)
            lineTo(ctr.x + 11.dp.toPx(), ctr.y)
            lineTo(ctr.x - 11.dp.toPx(), ctr.y)
            close()
          }
          drawPath(head, needle)
          val tailEnd = ctr.y + (r - 66.dp.toPx()) * 0.82f
          val tail = Path().apply {
            moveTo(ctr.x, tailEnd)
            lineTo(ctr.x + 9.dp.toPx(), ctr.y)
            lineTo(ctr.x - 9.dp.toPx(), ctr.y)
            close()
          }
          drawPath(tail, c.brandDeep)
        }
      }
      drawCircle(c.bgSurface, 9.dp.toPx(), ctr)
      drawCircle(c.brandPrimary, 9.dp.toPx(), ctr, style = Stroke(3.dp.toPx()))
    }
    // حروف الجهات تدور مع القرص وتبقى قائمة
    val letters = listOf("ش", "ق", "ج", "غ")
    for ((i, letter) in letters.withIndex()) {
      val a = Math.toRadians((i * 90).toDouble() + rot)
      val rr = 116.dp
      Text(
        letter, style = DSType.labelMd,
        color = if (i == 0) c.accentGoldStrong else c.textTertiary,
        modifier = Modifier.offset(x = (rr.value * sin(a)).dp, y = (-rr.value * cos(a)).dp)
      )
    }
    if (!live) Box(Modifier.fillMaxSize().clip(CircleShape).background(c.bgCanvas.copy(alpha = 0.45f)))
  }
}

@Composable private fun MetricTile(icon: ImageVector, value: String, label: String, modifier: Modifier = Modifier) {
  val c = DS.c
  DSCard(modifier, padding = 12.dp, radius = DS.Radius.lg) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      Column(Modifier.weight(1f)) {
        Text(value, style = DSType.numericMd, color = c.textPrimary, maxLines = 1)
        Text(label, style = DSType.labelXs, color = c.textSecondary)
      }
      DSIconButton(icon, style = IconStyle.Soft, size = 38.dp, iconSize = 16.dp)
    }
  }
}

@Composable private fun HintBar(icon: ImageVector, text: String, warn: Boolean) {
  val c = DS.c
  Row(
    Modifier.fillMaxWidth().clip(DS.shapeMd).background(c.bgSubtle).padding(12.dp),
    verticalAlignment = Alignment.CenterVertically
  ) {
    Text(text, style = DSType.labelXs, color = if (warn) c.warning else c.textSecondary, modifier = Modifier.weight(1f))
    Spacer(Modifier.width(8.dp))
    Icon(icon, null, Modifier.size(16.dp), tint = if (warn) c.warning else c.textTertiary)
  }
}

/** شرح طريقة حساب القبلة ومصادرها */
@OptIn(ExperimentalMaterial3Api::class)
@Composable private fun QiblaInfoSheet(onDismiss: () -> Unit) {
  val c = DS.c
  ModalBottomSheet(onDismissRequest = onDismiss, containerColor = c.bgSurface) {
    Column(Modifier.fillMaxWidth().padding(16.dp, 0.dp, 16.dp, 32.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      Text("عن حساب القبلة", style = DSType.headingMd, color = c.textPrimary)
      InfoBlock("كيف يُحسب الاتجاه؟", "يُحسب اتجاه القبلة بخوارزمية Vincenty الجيوديسية على مجسّم WGS‑84، وهي أدق من الحساب الكروي المبسّط، وتُعطي أقصر مسار حقيقي على سطح الأرض إلى الكعبة.")
      InfoBlock("الشمال الحقيقي لا المغناطيسي", "تقرأ البوصلة الشمال المغناطيسي، وبينه وبين الشمال الحقيقي فرق يبلغ درجات في بعض البلدان. نُصحّح القراءة بنموذج الانحراف العالمي WMM 2025.")
      InfoBlock("المعايرة", "إن اضطربت الإبرة أو ظهر تنبيه انخفاض الدقة، حرّك الهاتف في الهواء على شكل رقم ٨ مرّتين أو ثلاثًا، وابتعد عن المعادن والمكبّرات والحوامل المغناطيسية.")
      InfoBlock("الخصوصية", "كل الحساب يجري على جهازك؛ لا تُرسل إحداثياتك إلى أي خادم.")
    }
  }
}

@Composable private fun InfoBlock(title: String, body: String) {
  val c = DS.c
  DSCard(padding = 16.dp) {
    Text(title, style = DSType.headingSm, color = c.textPrimary)
    Spacer(Modifier.height(6.dp))
    Text(body, style = DSType.bodySm, color = c.textSecondary)
  }
}
