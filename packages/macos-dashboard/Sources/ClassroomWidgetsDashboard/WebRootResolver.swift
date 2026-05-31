import Foundation

enum WebRootResolver {
    static func resolve() -> URL {
        if let override = ProcessInfo.processInfo.environment["CLASSROOM_WIDGETS_WEB_ROOT"], !override.isEmpty {
            return URL(fileURLWithPath: override, isDirectory: true)
        }

        if let bundledWebRoot = Bundle.main.resourceURL?.appendingPathComponent("Web", isDirectory: true),
           FileManager.default.fileExists(atPath: bundledWebRoot.appendingPathComponent("index.html").path) {
            return bundledWebRoot
        }

        let bundleURL = Bundle.main.bundleURL
        let repoRoot = bundleURL
            .deletingLastPathComponent()
            .deletingLastPathComponent()

        return repoRoot
            .appendingPathComponent("packages")
            .appendingPathComponent("teacher")
            .appendingPathComponent("build")
    }
}
