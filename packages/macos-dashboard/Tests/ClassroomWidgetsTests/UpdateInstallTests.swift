import AppKit
import XCTest
@testable import ClassroomWidgets

/// Drives the real download-and-install path (#216) with disposable,
/// ad-hoc signed bundles, real `ditto` and `codesign`, and the real helper
/// script. Only the network download, the helper launch, the final quit and
/// the helper's `/usr/bin/open` (so no GUI session is needed) are replaced.
///
/// Failure modes covered, written before the fix:
/// - The install folder is not writable: nothing may be downloaded.
/// - The folder becomes read-only during the download: the late check
///   still refuses, and staging is removed.
/// - Non-2xx download response: the downloaded file is removed.
/// - Checksum mismatch, corrupt archive, wrong version inside the archive,
///   unsigned replacement: each removes its staging folder.
/// - The app refuses to quit, or the helper fails to start: staging is
///   removed and a failed helper start cancels termination.
/// - Staging left by a crashed or older attempt: removed once a day old,
///   without touching recent or unrelated folders.
/// - Success: staging survives until the helper owns it, and the helper
///   swaps the app and then removes staging and the backup.
/// - The helper's copy fails: the previous app is restored and staging is
///   still removed.
final class UpdateInstallTests: XCTestCase {
    @MainActor
    func testReadOnlyInstallFolderFailsBeforeDownloading() async throws {
        try XCTSkipIf(getuid() == 0, "root can write to read-only folders")
        let fixture = try InstallFixture()
        defer { fixture.remove() }
        try fixture.setApplicationsWritable(false)

        await fixture.makeController().check(manual: true)

        XCTAssertEqual(fixture.downloads, 0, "A read-only install must not download the update")
        XCTAssertTrue(fixture.failureText?.contains("cannot replace itself") == true, fixture.failureText ?? "no failure alert")
        try fixture.assertNothingLeftBehind()
    }

    @MainActor
    func testInstallFolderTurningReadOnlyDuringDownloadStillCleansUp() async throws {
        try XCTSkipIf(getuid() == 0, "root can write to read-only folders")
        let fixture = try InstallFixture()
        defer { fixture.remove() }
        fixture.duringDownload = { try fixture.setApplicationsWritable(false) }

        await fixture.makeController().check(manual: true)

        XCTAssertEqual(fixture.downloads, 1)
        XCTAssertTrue(fixture.failureText?.contains("cannot replace itself") == true, fixture.failureText ?? "no failure alert")
        try fixture.assertNothingLeftBehind()
    }

    @MainActor
    func testFailedDownloadResponseRemovesTheDownloadedFile() async throws {
        let fixture = try InstallFixture()
        defer { fixture.remove() }
        fixture.downloadStatus = 404

        await fixture.makeController().check(manual: true)

        XCTAssertEqual(fixture.downloads, 1)
        XCTAssertEqual(fixture.failureText, UpdateError.invalidResponse.localizedDescription)
        try fixture.assertNothingLeftBehind()
    }

    @MainActor
    func testChecksumMismatchRemovesStaging() async throws {
        let fixture = try InstallFixture()
        defer { fixture.remove() }
        fixture.publishedDigest = "sha256:" + String(repeating: "0", count: 64)

        await fixture.makeController().check(manual: true)

        XCTAssertEqual(fixture.failureText, UpdateError.checksumMismatch.localizedDescription)
        try fixture.assertNothingLeftBehind()
    }

    @MainActor
    func testCorruptArchiveRemovesStaging() async throws {
        let fixture = try InstallFixture()
        defer { fixture.remove() }
        try fixture.replaceArchive(with: Data("not a zip archive".utf8))

        await fixture.makeController().check(manual: true)

        XCTAssertEqual(fixture.failureText, UpdateError.commandFailed("/usr/bin/ditto").localizedDescription)
        try fixture.assertNothingLeftBehind()
    }

    @MainActor
    func testWrongVersionInsideArchiveRemovesStaging() async throws {
        let fixture = try InstallFixture(updateVersion: "0.12.1")
        defer { fixture.remove() }

        await fixture.makeController().check(manual: true)

        XCTAssertEqual(fixture.failureText, UpdateError.invalidApplication.localizedDescription)
        try fixture.assertNothingLeftBehind()
    }

    @MainActor
    func testUnsignedReplacementRemovesStaging() async throws {
        let fixture = try InstallFixture(signUpdate: false)
        defer { fixture.remove() }

        await fixture.makeController().check(manual: true)

        XCTAssertEqual(fixture.failureText, UpdateError.commandFailed("/usr/bin/codesign").localizedDescription)
        try fixture.assertNothingLeftBehind()
    }

    @MainActor
    func testStagingLeftByAnEarlierAttemptIsRemovedOnlyOnceStale() async throws {
        let fixture = try InstallFixture()
        defer { fixture.remove() }
        let stale = try fixture.makeLeftoverStaging(named: "classroom-widgets-update-stale", age: 2 * 24 * 60 * 60)
        let recent = try fixture.makeLeftoverStaging(named: "classroom-widgets-update-recent", age: 60 * 60)
        let unrelated = try fixture.makeLeftoverStaging(named: "something-else", age: 2 * 24 * 60 * 60)
        fixture.publishedDigest = "sha256:" + String(repeating: "0", count: 64)

        await fixture.makeController().check(manual: true)

        XCTAssertEqual(fixture.failureText, UpdateError.checksumMismatch.localizedDescription)
        let remaining = Set(try FileManager.default.contentsOfDirectory(atPath: fixture.stagingRoot.path))
        XCTAssertEqual(remaining, [recent.lastPathComponent, unrelated.lastPathComponent], "Only the day-old update staging may go")
        XCTAssertFalse(FileManager.default.fileExists(atPath: stale.path))
    }

    @MainActor
    func testRefusedQuitRemovesStagingWithoutStartingTheHelper() async throws {
        let fixture = try InstallFixture()
        defer { fixture.remove() }
        fixture.readyToQuit = false

        await fixture.makeController().check(manual: true)

        XCTAssertEqual(fixture.failureText, UpdateError.unableToQuit.localizedDescription)
        XCTAssertEqual(fixture.helperLaunches.count, 0)
        XCTAssertEqual(fixture.terminations, 0)
        try fixture.assertNothingLeftBehind()
    }

    @MainActor
    func testHelperLaunchFailureCancelsTerminationAndRemovesStaging() async throws {
        let fixture = try InstallFixture()
        defer { fixture.remove() }
        fixture.helperLaunchError = CocoaError(.executableNotLoadable)

        await fixture.makeController().check(manual: true)

        XCTAssertEqual(fixture.helperLaunches.count, 1)
        XCTAssertEqual(fixture.cancelledTerminations, 1)
        XCTAssertEqual(fixture.terminations, 0)
        try fixture.assertNothingLeftBehind()
    }

    @MainActor
    func testSuccessfulUpdateKeepsStagingForTheHelperWhichSwapsAndCleansUp() async throws {
        let fixture = try InstallFixture()
        defer { fixture.remove() }

        await fixture.makeController().check(manual: true)

        XCTAssertNil(fixture.failureText)
        XCTAssertEqual(fixture.terminations, 1)
        let helper = try XCTUnwrap(fixture.helperLaunches.first)
        XCTAssertEqual(helper.executableURL?.path, "/bin/sh")
        let arguments = try XCTUnwrap(helper.arguments)
        XCTAssertEqual(arguments.count, 6)
        let staging = URL(fileURLWithPath: arguments[4], isDirectory: true)
        XCTAssertEqual(staging.deletingLastPathComponent().standardizedFileURL, fixture.stagingRoot.standardizedFileURL)
        XCTAssertTrue(FileManager.default.fileExists(atPath: arguments[0]), "The helper script must still exist")
        XCTAssertTrue(FileManager.default.fileExists(atPath: arguments[2]), "The replacement app must still exist")
        XCTAssertEqual(URL(fileURLWithPath: arguments[3]).resolvingSymlinksInPath().path, fixture.installed.path)
        XCTAssertTrue(try fixture.downloadsDirectoryContents().isEmpty)

        try fixture.runHelper(arguments)

        XCTAssertEqual(try fixture.installedVersion(), "0.12.0")
        XCTAssertEqual(try fixture.openedApplications(), [arguments[3]])
        XCTAssertFalse(FileManager.default.fileExists(atPath: staging.path), "The helper must remove staging")
        try fixture.assertNoBackupLeft()
        try fixture.assertNothingLeftBehind()
    }

    @MainActor
    func testHelperRestoresThePreviousAppWhenTheCopyFails() async throws {
        let fixture = try InstallFixture()
        defer { fixture.remove() }

        await fixture.makeController().check(manual: true)
        let arguments = try XCTUnwrap(fixture.helperLaunches.first?.arguments)
        try FileManager.default.removeItem(atPath: arguments[2])

        try fixture.runHelper(arguments)

        XCTAssertEqual(try fixture.installedVersion(), "0.11.2")
        XCTAssertEqual(try fixture.openedApplications(), [arguments[3]], "The restored app must be reopened")
        try fixture.assertNoBackupLeft()
        try fixture.assertNothingLeftBehind()
    }
}

@MainActor
private final class InstallFixture {
    static let bundleIdentifier = "sg.tk.classroomwidgets.update-install-test"
    let root: URL
    let applications: URL
    let installed: URL
    let stagingRoot: URL
    let downloadsDirectory: URL
    private let archive: URL
    private let bundle: Bundle
    var publishedDigest: String
    var downloadStatus = 200
    var duringDownload: (() throws -> Void)?
    var readyToQuit = true
    var helperLaunchError: Error?
    private(set) var downloads = 0
    private(set) var helperLaunches: [Process] = []
    private(set) var terminations = 0
    private(set) var cancelledTerminations = 0
    private(set) var alerts: [NSAlert] = []

    init(updateVersion: String = "0.12.0", signUpdate: Bool = true) throws {
        _ = NSApplication.shared
        let base = FileManager.default.temporaryDirectory
            .appendingPathComponent("update-install-test-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        // Resolve /var -> /private/var once the folder exists.
        root = base.resolvingSymlinksInPath()
        applications = root.appendingPathComponent("Applications", isDirectory: true)
        installed = applications.appendingPathComponent("Fixture.app", isDirectory: true)
        stagingRoot = root.appendingPathComponent("staging-root", isDirectory: true)
        downloadsDirectory = root.appendingPathComponent("downloads", isDirectory: true)
        let build = root.appendingPathComponent("build", isDirectory: true)
        for directory in [applications, stagingRoot, downloadsDirectory, build] {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        }
        let executable = root.appendingPathComponent("fixture-executable")
        try Self.compileExecutable(to: executable)

        try Self.makeApplication(at: installed, version: "0.11.2", executable: executable, sign: true)
        let update = build.appendingPathComponent("Classroom Widgets Dashboard.app", isDirectory: true)
        try Self.makeApplication(at: update, version: updateVersion, executable: executable, sign: signUpdate)
        archive = build.appendingPathComponent("ClassroomWidgets-v0.12.0-macos.zip")
        try Self.command("/usr/bin/ditto", ["-c", "-k", "--keepParent", update.path, archive.path])
        publishedDigest = try Self.shasum(archive)
        bundle = try XCTUnwrap(Bundle(url: installed), "Fixture: expected the installed application bundle")
    }

    var failureText: String? {
        alerts.first(where: { $0.messageText == "Unable to install update" })?.informativeText
    }

    func remove() {
        try? setApplicationsWritable(true)
        try? FileManager.default.removeItem(at: root)
    }

    func setApplicationsWritable(_ writable: Bool) throws {
        try FileManager.default.setAttributes([.posixPermissions: writable ? 0o755 : 0o555], ofItemAtPath: applications.path)
    }

    func replaceArchive(with data: Data) throws {
        try data.write(to: archive)
        publishedDigest = try Self.shasum(archive)
    }

    func makeLeftoverStaging(named name: String, age: TimeInterval) throws -> URL {
        let folder = stagingRoot.appendingPathComponent(name, isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try Data("left over".utf8).write(to: folder.appendingPathComponent("archive.zip"))
        try FileManager.default.setAttributes([.modificationDate: Date().addingTimeInterval(-age)], ofItemAtPath: folder.path)
        return folder
    }

    func downloadsDirectoryContents() throws -> [String] {
        try FileManager.default.contentsOfDirectory(atPath: downloadsDirectory.path)
    }

    func assertNothingLeftBehind(file: StaticString = #filePath, line: UInt = #line) throws {
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: stagingRoot.path), [], "Staging left behind", file: file, line: line)
        XCTAssertEqual(try downloadsDirectoryContents(), [], "Downloaded archive left behind", file: file, line: line)
    }

    func assertNoBackupLeft(file: StaticString = #filePath, line: UInt = #line) throws {
        let entries = try FileManager.default.contentsOfDirectory(atPath: applications.path)
        XCTAssertEqual(entries, ["Fixture.app"], "Only the installed app should remain", file: file, line: line)
    }

    private var openedLog: URL { root.appendingPathComponent("opened.txt") }

    func openedApplications() throws -> [String] {
        guard FileManager.default.fileExists(atPath: openedLog.path) else { return [] }
        return try String(contentsOf: openedLog, encoding: .utf8).split(separator: "\n").map(String.init)
    }

    func installedVersion() throws -> String? {
        let plist = try Data(contentsOf: installed.appendingPathComponent("Contents/Info.plist"))
        let values = try PropertyListSerialization.propertyList(from: plist, format: nil) as? [String: Any]
        return values?["CFBundleShortVersionString"] as? String
    }

    /// Runs the real helper script against a process that has already
    /// exited, so it starts the swap straight away. `/usr/bin/open` is
    /// swapped for a stub that records which app would be relaunched.
    func runHelper(_ arguments: [String]) throws {
        let stub = root.appendingPathComponent("open-stub.sh")
        try Data("#!/bin/sh\nprintf '%s\\n' \"$1\" >> \"\(openedLog.path)\"\n".utf8).write(to: stub)
        try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: stub.path)
        let original = try String(contentsOfFile: arguments[0], encoding: .utf8)
        XCTAssertEqual(original.components(separatedBy: "/usr/bin/open").count, 3, "The helper should relaunch in two places")
        try original.replacingOccurrences(of: "/usr/bin/open", with: stub.path)
            .write(toFile: arguments[0], atomically: true, encoding: .utf8)
        let exited = Process()
        exited.executableURL = URL(fileURLWithPath: "/usr/bin/true")
        try exited.run()
        exited.waitUntilExit()
        var helperArguments = arguments
        helperArguments[1] = String(exited.processIdentifier)
        try Self.command("/bin/sh", helperArguments)
    }

    func makeController() -> UpdateController {
        UpdateController(
            prepareForTermination: { self.readyToQuit },
            cancelTermination: { self.cancelledTerminations += 1 },
            applicationBundle: bundle,
            loadRelease: { request in
                let data = Data("""
                {"tag_name":"v0.12.0","html_url":"https://example.invalid/releases/v0.12.0",
                 "assets":[{"name":"ClassroomWidgets-v0.12.0-macos.zip",
                            "browser_download_url":"https://example.invalid/update.zip",
                            "digest":"\(self.publishedDigest)"}]}
                """.utf8)
                return (data, try XCTUnwrap(HTTPURLResponse(
                    url: try XCTUnwrap(request.url), statusCode: 200, httpVersion: nil, headerFields: nil
                )))
            },
            presentAlert: { alert in
                self.alerts.append(alert)
                return alert.messageText.hasSuffix("is available.") ? .alertFirstButtonReturn : .alertSecondButtonReturn
            },
            openDownloads: { _ in XCTFail("Cancel must not open the downloads page") },
            downloadUpdate: { request in
                self.downloads += 1
                try self.duringDownload?()
                // Like URLSession, hand back a temporary file the caller must move or delete.
                let file = self.downloadsDirectory.appendingPathComponent("CFNetworkDownload_\(UUID().uuidString).tmp")
                try FileManager.default.copyItem(at: self.archive, to: file)
                let response = try XCTUnwrap(HTTPURLResponse(
                    url: try XCTUnwrap(request.url), statusCode: self.downloadStatus, httpVersion: nil, headerFields: nil
                ))
                return (file, response)
            },
            stagingRoot: stagingRoot,
            launchHelper: { process in
                self.helperLaunches.append(process)
                if let error = self.helperLaunchError { throw error }
            },
            terminate: { self.terminations += 1 }
        )
    }

    private static func makeApplication(at url: URL, version: String, executable: URL, sign: Bool) throws {
        let contents = url.appendingPathComponent("Contents", isDirectory: true)
        let macOS = contents.appendingPathComponent("MacOS", isDirectory: true)
        try FileManager.default.createDirectory(at: macOS, withIntermediateDirectories: true)
        try FileManager.default.copyItem(at: executable, to: macOS.appendingPathComponent("Fixture"))
        let plist = try PropertyListSerialization.data(fromPropertyList: [
            "CFBundleExecutable": "Fixture",
            "CFBundleIdentifier": bundleIdentifier,
            "CFBundlePackageType": "APPL",
            "CFBundleShortVersionString": version,
            "LSUIElement": true
        ], format: .xml, options: 0)
        try plist.write(to: contents.appendingPathComponent("Info.plist"))
        if sign {
            try command("/usr/bin/codesign", ["--force", "--sign", "-", url.path])
        } else {
            // The linker ad-hoc signs arm64 executables; strip that so the bundle is truly unsigned.
            _ = try? command("/usr/bin/codesign", ["--remove-signature", macOS.appendingPathComponent("Fixture").path])
        }
    }

    private static func compileExecutable(to output: URL) throws {
        let source = output.deletingLastPathComponent().appendingPathComponent("fixture.c")
        try Data("int main(void) { return 0; }\n".utf8).write(to: source)
        try command("/usr/bin/xcrun", ["clang", "-o", output.path, source.path])
    }

    private static func shasum(_ file: URL) throws -> String {
        let output = try command("/usr/bin/shasum", ["-a", "256", file.path])
        return "sha256:" + String(output.prefix(64))
    }

    @discardableResult
    private static func command(_ executable: String, _ arguments: [String]) throws -> String {
        let process = Process()
        let output = Pipe()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments
        process.standardOutput = output
        process.standardError = output
        try process.run()
        let data = output.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        let text = String(decoding: data, as: UTF8.self)
        guard process.terminationStatus == 0 else {
            throw NSError(domain: "UpdateInstallTests", code: Int(process.terminationStatus), userInfo: [
                NSLocalizedDescriptionKey: "\(executable) \(arguments.joined(separator: " ")) failed: \(text)"
            ])
        }
        return text
    }
}
