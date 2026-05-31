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

        if let repoBuildRoot = findTeacherBuildRoot(from: Bundle.main.bundleURL) {
            return repoBuildRoot
        }

        return URL(fileURLWithPath: FileManager.default.currentDirectoryPath, isDirectory: true)
            .appendingPathComponent("packages")
            .appendingPathComponent("teacher")
            .appendingPathComponent("build")
    }

    private static func findTeacherBuildRoot(from startURL: URL) -> URL? {
        let fileManager = FileManager.default
        var current = startURL

        for _ in 0..<10 {
            let candidate = current
                .appendingPathComponent("packages")
                .appendingPathComponent("teacher")
                .appendingPathComponent("build", isDirectory: true)

            if fileManager.fileExists(atPath: candidate.appendingPathComponent("index.html").path) {
                return candidate
            }

            let parent = current.deletingLastPathComponent()
            if parent.path == current.path {
                break
            }
            current = parent
        }

        return nil
    }
}
