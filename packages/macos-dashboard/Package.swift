// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "ClassroomWidgets",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(
            name: "ClassroomWidgets",
            targets: ["ClassroomWidgets"]
        )
    ],
    targets: [
        .executableTarget(
            name: "ClassroomWidgets",
            path: "Sources/ClassroomWidgetsDashboard",
            resources: [
                .process("Resources")
            ]
        )
    ]
)
