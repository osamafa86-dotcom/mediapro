package org.emdatra.sakinah.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.emdatra.sakinah.app.*
import org.emdatra.sakinah.core.Qibla

/** المساجد القريبة: بحث بالاسم، قائمة بالبعد ووقت السير والاتجاه، والاتجاهات في تطبيق الخرائط */
@Composable fun MosquesScreen(onBack: () -> Unit) {
  val ctx = LocalContext.current; val c = DS.c; val scope = rememberCoroutineScope()
  androidx.activity.compose.BackHandler(onBack = onBack)
  val coords = Store.coords
  var query by remember { mutableStateOf("") }
  var results by remember { mutableStateOf<List<Mosque>>(emptyList()) }
  var loading by remember { mutableStateOf(false) }; var error by remember { mutableStateOf<String?>(null) }
  fun search(q: String? = null, force: Boolean = false) {
    val co = coords ?: return
    scope.launch {
      if (!force && q.isNullOrBlank()) MosqueFinder.cached(co.latitude, co.longitude)?.let { results = it; return@launch }
      loading = true; error = null
      MosqueFinder.nearby(co.latitude, co.longitude, q).onSuccess { results = it }.onFailure { error = "تعذّر جلب المساجد (${it.message ?: it.javaClass.simpleName}) — تحقّق من الاتصال، أو افتح تطبيق الخرائط" }
      loading = false
    }
  }
  LaunchedEffect(coords) { search() }
  Column(Modifier.fillMaxSize().background(c.bgCanvas)) {
    DSNavBar("المساجد القريبة", onBack = onBack) { DSIconButton(Icons.Outlined.Refresh, contentDescription = "تحديث") { search(force = true) } }
    if (coords == null) {
      Column(Modifier.fillMaxWidth().padding(16.dp, 48.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
        DSIconButton(Icons.Outlined.LocationOff, style = IconStyle.Soft, size = 64.dp, iconSize = 26.dp)
        Text("حدّد موقعك من الرئيسية لعرض المساجد القريبة", style = DSType.headingSm, color = c.textPrimary, textAlign = TextAlign.Center)
      }
      return
    }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp, 4.dp, 16.dp, 32.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
      item {
        OutlinedTextField(query, { query = it }, Modifier.fillMaxWidth(), placeholder = { Text("ابحث باسم المسجد") }, singleLine = true, shape = CircleShape,
          leadingIcon = { Icon(Icons.Outlined.Search, null) },
          trailingIcon = { if (query.isNotEmpty()) DSIconButton(Icons.Outlined.Close, style = IconStyle.Plain, size = 32.dp, iconSize = 14.dp, contentDescription = "مسح") { query = ""; search() } },
          keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search), keyboardActions = KeyboardActions(onSearch = { search(query, force = true) }))
      }
      when {
        loading -> item { Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) { CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = c.brandPrimary); Spacer(Modifier.width(8.dp)); Text("جارٍ البحث…", style = DSType.bodySm, color = c.textSecondary) } }
        error != null -> item {
          Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            HintBar(Icons.Outlined.WifiOff, error!!, true)
            DSButton("افتح تطبيق الخرائط بالبحث عن مسجد", Modifier.fillMaxWidth(), kind = ButtonKind.Outline, icon = Icons.Outlined.Map) { runCatching { ctx.startActivity(MosqueFinder.searchIntent()) } }
          }
        }
        results.isEmpty() -> item { HintBar(Icons.Outlined.LocationSearching, "لا مساجد ضمن المدى — جرّب البحث بالاسم", false) }
        else -> items(results, key = { it.id }) { m -> MosqueRow(m) { MosqueFinder.openDirections(ctx, m) } }
      }
      item { Text("بيانات © مساهمي OpenStreetMap. يُرسل موقعك مقرّبًا إلى نحو كيلومتر عند كل بحث، ولا يُحفظ لدينا.", Modifier.fillMaxWidth().padding(top = 8.dp), style = DSType.labelXs, color = c.textTertiary, textAlign = TextAlign.Center) }
    }
  }
}

@Composable fun MosqueRow(m: Mosque, onDirections: () -> Unit) {
  val c = DS.c
  DSCard(Modifier.fillMaxWidth(), padding = 12.dp, radius = DS.Radius.lg) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
      DSIconButton(Icons.Outlined.Mosque, style = IconStyle.Soft, size = 40.dp, iconSize = 18.dp)
      Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(m.name, style = DSType.headingSm, color = c.textPrimary, maxLines = 1)
        Text(listOfNotNull(MosqueFinder.distanceLabel(m.distanceKm), MosqueFinder.walkLabel(m.distanceKm), Qibla.compassPointAr(m.bearing), m.address).joinToString(" · "), style = DSType.labelXs, color = c.textSecondary, maxLines = 1)
      }
      DSIconButton(Icons.Outlined.Directions, style = IconStyle.Brand, size = 38.dp, iconSize = 16.dp, contentDescription = "الاتجاهات إلى ${m.name}", onClick = onDirections)
    }
  }
}
