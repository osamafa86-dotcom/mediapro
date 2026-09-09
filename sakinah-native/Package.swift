// swift-tools-version: 6.0
// نواة «سكينة» الأصلية: منطق خالص (مواقيت، هجري، قبلة، مغناطيسية، مصحف) بلا واجهة، يُختبر على Linux وmacOS ويُستخدم من تطبيق iOS/watchOS
import PackageDescription

let package = Package(
  name: "SakinahCore",
  defaultLocalization: "ar",
  platforms: [.iOS(.v17), .macOS(.v14), .watchOS(.v10)],
  products: [
    .library(name: "SakinahCore", targets: ["SakinahCore"]),
  ],
  targets: [
    .target(name: "SakinahCore", path: "Sources/SakinahCore"),
    .testTarget(name: "SakinahCoreTests", dependencies: ["SakinahCore"], path: "Tests/SakinahCoreTests", resources: [.copy("Fixtures")]),
  ]
)
