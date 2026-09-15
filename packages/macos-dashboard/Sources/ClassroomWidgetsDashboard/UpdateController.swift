import AppKit
import CryptoKit
import Foundation

@MainActor
final class UpdateController {
    private static let latestReleaseURL = URL(string: "https://api.github.com/repos/tinkertanker/classroom-widgets/releases/latest")!
    private var checking = false

    func check(manual: Bool = false) async {
        guard !checking else { return }
        guard Bundle.main.bundleURL.pathExtension == "app" else { return }
        checking = true
        defer { checking = false }

        do {
            var request = URLRequest(url: Self.latestReleaseURL)
            request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
            request.setValue("ClassroomWidgets/\(currentVersion)", forHTTPHeaderField: "User-Agent")
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                throw UpdateError.invalidResponse
            }
            let release = try JSONDecoder().decode(GitHubRelease.self, from: data)
            let availableVersion = release.tagName.hasPrefix("v") ? String(release.tagName.dropFirst()) : release.tagName
            guard Self.isNewerVersion(availableVersion, than: currentVersion) else {
                if manual { showMessage(title: "Classroom Widgets is up to date", detail: "Version \(currentVersion) is the latest version.") }
                return
            }

            let expectedName = "ClassroomWidgets-v\(availableVersion)-macos.zip"
            guard let asset = release.assets.first(where: { $0.name == expectedName }) else {
                showReleaseFallback(release.htmlURL, detail: "Version \(availableVersion) is available, but its macOS update is not attached yet.")
                return
            }

            let alert = NSAlert()
            alert.messageText = "Classroom Widgets \(availableVersion) is available."
            alert.informativeText = "You are using version \(currentVersion). The update will be downloaded and the app will restart."
            alert.addButton(withTitle: "Install and Restart")
            alert.addButton(withTitle: "Later")
            NSApp.activate(ignoringOtherApps: true)
            guard alert.runModal() == .alertFirstButtonReturn else { return }
            try await downloadAndInstall(asset: asset, version: availableVersion)
        } catch {
            DashboardLog.app.error("Update check failed: \(error.localizedDescription, privacy: .public)")
            if manual { showMessage(title: "Unable to check for updates", detail: "Check your connection and try again.") }
        }
    }

    static func isNewerVersion(_ candidate: String, than current: String) -> Bool {
        guard let candidateParts = versionParts(candidate), let currentParts = versionParts(current) else { return false }
        return candidateParts.lexicographicallyPrecedes(currentParts) == false && candidateParts != currentParts
    }

    private var currentVersion: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0"
    }

    private func downloadAndInstall(asset: GitHubAsset, version: String) async throws {
        var request = URLRequest(url: asset.downloadURL)
        request.setValue("ClassroomWidgets/\(currentVersion)", forHTTPHeaderField: "User-Agent")
        let (download, response) = try await URLSession.shared.download(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { throw UpdateError.invalidResponse }

        let fileManager = FileManager.default
        let staging = fileManager.temporaryDirectory.appendingPathComponent("classroom-widgets-update-\(UUID().uuidString)", isDirectory: true)
        try fileManager.createDirectory(at: staging, withIntermediateDirectories: true)
        let archive = staging.appendingPathComponent(asset.name)
        try fileManager.moveItem(at: download, to: archive)
        let digest = "sha256:" + SHA256.hash(data: try Data(contentsOf: archive)).map { String(format: "%02x", $0) }.joined()
        guard digest == asset.digest else { throw UpdateError.checksumMismatch }
        try run("/usr/bin/ditto", arguments: ["-x", "-k", archive.path, staging.path])

        let replacement = staging.appendingPathComponent("Classroom Widgets Dashboard.app", isDirectory: true)
        guard let replacementBundle = Bundle(url: replacement),
              replacementBundle.bundleIdentifier == Bundle.main.bundleIdentifier,
              replacementBundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String == version else {
            throw UpdateError.invalidApplication
        }
        try run("/usr/bin/codesign", arguments: ["--verify", "--deep", "--strict", replacement.path])
        if let installedTeam = try signingTeam(at: Bundle.main.bundleURL),
           try signingTeam(at: replacement) != installedTeam {
            throw UpdateError.invalidApplication
        }

        let target = Bundle.main.bundleURL
        guard target.pathExtension == "app", fileManager.isWritableFile(atPath: target.deletingLastPathComponent().path) else {
            throw UpdateError.readOnlyApplication
        }

        let script = staging.appendingPathComponent("install-update.sh")
        try Self.helperScript.write(to: script, atomically: true, encoding: .utf8)
        try fileManager.setAttributes([.posixPermissions: 0o700], ofItemAtPath: script.path)
        let helper = Process()
        helper.executableURL = URL(fileURLWithPath: "/bin/sh")
        helper.arguments = [script.path, String(ProcessInfo.processInfo.processIdentifier), replacement.path, target.path, staging.path]
        try helper.run()
        NSApp.terminate(nil)
    }

    private func showReleaseFallback(_ url: URL, detail: String) {
        let alert = NSAlert()
        alert.messageText = "Update available"
        alert.informativeText = detail
        alert.addButton(withTitle: "Open Downloads")
        alert.addButton(withTitle: "Cancel")
        if alert.runModal() == .alertFirstButtonReturn { NSWorkspace.shared.open(url) }
    }

    private func showMessage(title: String, detail: String) {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = detail
        alert.runModal()
    }

    private func run(_ executable: String, arguments: [String]) throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments
        try process.run()
        process.waitUntilExit()
        guard process.terminationStatus == 0 else { throw UpdateError.commandFailed(executable) }
    }

    private func signingTeam(at application: URL) throws -> String? {
        let process = Process()
        let output = Pipe()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/codesign")
        process.arguments = ["-dv", "--verbose=4", application.path]
        process.standardError = output
        try process.run()
        process.waitUntilExit()
        guard process.terminationStatus == 0 else { throw UpdateError.invalidApplication }
        let details = String(decoding: output.fileHandleForReading.readDataToEndOfFile(), as: UTF8.self)
        return details.split(separator: "\n").first(where: { $0.hasPrefix("TeamIdentifier=") }).map { String($0.dropFirst("TeamIdentifier=".count)) }
    }

    private static func versionParts(_ version: String) -> [Int]? {
        let parts = version.split(separator: ".").compactMap { Int($0) }
        return parts.count == 3 ? parts : nil
    }

    private static let helperScript = """
    #!/bin/sh
    pid="$1"
    source="$2"
    target="$3"
    staging="$4"
    backup="${target}.previous"
    while kill -0 "$pid" 2>/dev/null; do sleep 1; done
    rm -rf "$backup"
    if mv "$target" "$backup" && /usr/bin/ditto "$source" "$target"; then
      /usr/bin/open "$target"
      rm -rf "$backup"
    else
      rm -rf "$target"
      mv "$backup" "$target"
      /usr/bin/open "$target"
    fi
    rm -rf "$staging"
    """
}

private struct GitHubRelease: Decodable {
    let tagName: String
    let htmlURL: URL
    let assets: [GitHubAsset]

    enum CodingKeys: String, CodingKey {
        case tagName = "tag_name"
        case htmlURL = "html_url"
        case assets
    }
}

private struct GitHubAsset: Decodable {
    let name: String
    let downloadURL: URL
    let digest: String

    enum CodingKeys: String, CodingKey {
        case name
        case downloadURL = "browser_download_url"
        case digest
    }
}

private enum UpdateError: LocalizedError {
    case invalidResponse
    case invalidApplication
    case readOnlyApplication
    case checksumMismatch
    case commandFailed(String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse: "The update server returned an invalid response."
        case .invalidApplication: "The downloaded application is not a valid Classroom Widgets update."
        case .readOnlyApplication: "Classroom Widgets cannot replace itself from this location."
        case .checksumMismatch: "The downloaded update did not match its published checksum."
        case .commandFailed(let command): "The update command failed: \(command)"
        }
    }
}
