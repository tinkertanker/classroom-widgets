// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ClassroomTimerCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "ClassroomTimerCore", targets: ["ClassroomTimerCore"])
    ],
    targets: [
        .target(name: "ClassroomTimerCore"),
        .testTarget(name: "ClassroomTimerCoreTests", dependencies: ["ClassroomTimerCore"])
    ]
)
