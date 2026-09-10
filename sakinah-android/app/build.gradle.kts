// تطبيق سكينة الأصلي لأندرويد (Kotlin + Jetpack Compose) فوق النواة :core
plugins { id("com.android.application"); kotlin("android"); kotlin("plugin.compose"); kotlin("plugin.serialization") }

android {
  namespace = "org.emdatra.sakinah"
  compileSdk = 35
  defaultConfig {
    applicationId = "org.emdatra.sakinah"
    minSdk = 26; targetSdk = 35
    versionCode = (System.getenv("SAKINAH_BUILD") ?: "1").toInt(); versionName = "5.0.0"
    vectorDrawables.useSupportLibrary = true
  }
  buildTypes { release { isMinifyEnabled = false } }
  compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
  kotlinOptions { jvmTarget = "17" }
  buildFeatures { compose = true }
  packaging { resources.excludes += setOf("META-INF/AL2.0", "META-INF/LGPL2.1", "META-INF/versions/9/OSGI-INF/MANIFEST.MF") }
}
kotlin { jvmToolchain(21) }

// صوت الأذان (الملفات نفسها في نسخة الويب) → res/raw عند البناء
val copyAudio by tasks.registering(Copy::class) {
  from("../../sakinah/assets/audio") { include("adhan_short.wav", "adhan-fakhry.mp3", "adhan-azeez.mp3") }
  into(layout.buildDirectory.dir("generated/audio/res/raw"))
  rename { it.replace("-", "_") }
}
android.sourceSets["main"].res.srcDir(layout.buildDirectory.dir("generated/audio/res"))
tasks.named("preBuild") { dependsOn(copyAudio) }

dependencies {
  implementation(project(":core"))
  val bom = platform("androidx.compose:compose-bom:2024.09.03")
  implementation(bom)
  implementation("androidx.compose.ui:ui"); implementation("androidx.compose.ui:ui-tooling-preview")
  implementation("androidx.compose.material3:material3"); implementation("androidx.compose.material:material-icons-extended")
  implementation("androidx.compose.foundation:foundation")
  implementation("androidx.activity:activity-compose:1.9.2")
  implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.6")
  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.media3:media3-exoplayer:1.4.1")
  implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
  debugImplementation("androidx.compose.ui:ui-tooling")
}
