import Foundation
import OSLog

enum DashboardLog {
    static let bundleIdentifier = Bundle.main.bundleIdentifier ?? "com.classroomwidgets.dashboard"

    static let app = Logger(subsystem: bundleIdentifier, category: "App")
    static let menuBar = Logger(subsystem: bundleIdentifier, category: "MenuBar")
    static let windowing = Logger(subsystem: bundleIdentifier, category: "Windowing")
    static let web = Logger(subsystem: bundleIdentifier, category: "Web")
}
