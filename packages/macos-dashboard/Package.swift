// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "ClassroomWidgetsDashboard",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(
            name: "ClassroomWidgetsDashboard",
            targets: ["ClassroomWidgetsDashboard"]
        )
    ],
    targets: [
        .executableTarget(
            name: "ClassroomWidgetsDashboard",
            resources: [
                .process("Resources")
            ]
        )
    ]
)
