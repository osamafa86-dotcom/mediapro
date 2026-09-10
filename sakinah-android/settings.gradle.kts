pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }
dependencyResolutionManagement { repositories { google(); mavenCentral() } }
rootProject.name = "sakinah-android"
include(":core")
// تطبيق Android (Compose) يُبنى على GitHub Actions حيث تتوفر Android SDK؛ محليًا يُبنى ويُختبر :core وحده
if (System.getenv("ANDROID_HOME") != null || System.getenv("ANDROID_SDK_ROOT") != null || File(rootDir, "local.properties").exists()) include(":app")
