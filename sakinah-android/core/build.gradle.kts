// نواة سكينة بلغة Kotlin (JVM صرف بلا Android) — الطرف الثالث في المرجع الذهبي نفسه (الويب ↔ Swift ↔ Kotlin)
plugins { kotlin("jvm"); kotlin("plugin.serialization") }
kotlin { jvmToolchain(21) }
sourceSets {
  main { resources.srcDir("../../sakinah-native/Sources/SakinahCore/Resources") } // المصدر الواحد للبيانات
}
dependencies {
  implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
  testImplementation(kotlin("test"))
  testImplementation("org.junit.jupiter:junit-jupiter:5.10.2")
  testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}
tasks.test { useJUnitPlatform(); maxHeapSize = "2g"; testLogging { events("failed"); showStandardStreams = false; exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL } }
