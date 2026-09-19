import AppKit
import XCTest
@testable import ClassroomWidgets

final class UpdateControllerTests: XCTestCase {
    @MainActor
    func testApprovedAutomaticUpdateFailureIsVisible() async throws {
        try await assertApprovedUpdateFailureIsVisible(manual: false)
    }

    @MainActor
    func testApprovedManualUpdateFailureIsVisible() async throws {
        try await assertApprovedUpdateFailureIsVisible(manual: true)
    }

    @MainActor
    func testReadOnlyFailureExplainsRecoveryAndAllowsAnotherCheck() async throws {
        let fixture = try UpdateFixture()
        defer { fixture.remove() }
        fixture.installError = UpdateError.readOnlyApplication
        fixture.responses = [.alertFirstButtonReturn, .alertSecondButtonReturn, .alertSecondButtonReturn]
        let controller = fixture.makeController()

        await controller.check()
        let failure = try XCTUnwrap(fixture.alerts.dropFirst().first)
        XCTAssertEqual(failure.messageText, "Unable to install update")
        XCTAssertTrue(failure.informativeText.contains("cannot replace itself"))
        XCTAssertTrue(failure.informativeText.contains("Applications"))
        XCTAssertTrue(fixture.openedURLs.isEmpty, "Cancel must not open a browser")

        await controller.check()
        XCTAssertEqual(fixture.releaseRequests, 2, "Failure must release the checking guard")
        XCTAssertEqual(fixture.installAttempts, 1, "Later on the second prompt must not retry installation")
        XCTAssertEqual(fixture.alerts.count, 3)
    }

    @MainActor
    func testUnapprovedAutomaticCheckFailureStaysQuietButManualCheckReportsIt() async throws {
        let fixture = try UpdateFixture()
        defer { fixture.remove() }
        fixture.releaseError = URLError(.notConnectedToInternet)
        let controller = fixture.makeController()

        await controller.check()
        XCTAssertTrue(fixture.alerts.isEmpty)
        XCTAssertEqual(fixture.installAttempts, 0)
        await controller.check(manual: true)
        XCTAssertEqual(fixture.releaseRequests, 2)
        XCTAssertEqual(fixture.alerts.map(\.messageText), ["Unable to check for updates"])
        XCTAssertEqual(fixture.installAttempts, 0)
    }

    @MainActor
    func testLaterDoesNotDownloadOrInstall() async throws {
        let fixture = try UpdateFixture()
        defer { fixture.remove() }
        fixture.responses = [.alertSecondButtonReturn]

        await fixture.makeController().check()

        XCTAssertEqual(fixture.alerts.count, 1)
        XCTAssertEqual(fixture.alerts.first?.buttons.map(\.title), ["Install and Restart", "Later"])
        XCTAssertEqual(fixture.installAttempts, 0)
        XCTAssertTrue(fixture.openedURLs.isEmpty)
    }

    @MainActor
    func testSemanticVersionComparison() {
        XCTAssertTrue(UpdateController.isNewerVersion("0.12.0", than: "0.11.9"))
        XCTAssertTrue(UpdateController.isNewerVersion("0.11.10", than: "0.11.9"))
        XCTAssertFalse(UpdateController.isNewerVersion("0.11.2", than: "0.11.2"))
        XCTAssertFalse(UpdateController.isNewerVersion("0.10.99", than: "0.11.0"))
        XCTAssertFalse(UpdateController.isNewerVersion("nightly", than: "0.11.0"))
    }

    @MainActor
    private func assertApprovedUpdateFailureIsVisible(manual: Bool) async throws {
        let fixture = try UpdateFixture()
        defer { fixture.remove() }
        fixture.installError = URLError(.timedOut)
        fixture.responses = [.alertFirstButtonReturn, .alertFirstButtonReturn]
        let controller = fixture.makeController()

        await controller.check(manual: manual)

        XCTAssertEqual(fixture.installAttempts, 1)
        XCTAssertEqual(fixture.alerts.count, 2)
        let failure = try XCTUnwrap(fixture.alerts.dropFirst().first)
        XCTAssertEqual(failure.messageText, "Unable to install update")
        XCTAssertTrue(failure.informativeText.contains(URLError(.timedOut).localizedDescription))
        XCTAssertEqual(failure.buttons.map(\.title), ["Open Downloads", "Cancel"])
        XCTAssertEqual(fixture.openedURLs, [UpdateFixture.releaseURL])
    }
}

@MainActor
private final class UpdateFixture {
    static let releaseURL = URL(string: "https://example.invalid/releases/v0.12.0")!
    private let directory: URL
    private let bundle: Bundle
    var releaseError: Error?
    var installError: Error?
    var responses: [NSApplication.ModalResponse] = []
    var alerts: [NSAlert] = []
    var openedURLs: [URL] = []
    var releaseRequests = 0
    var installAttempts = 0

    init() throws {
        _ = NSApplication.shared
        directory = FileManager.default.temporaryDirectory.appendingPathComponent("update-test-\(UUID().uuidString)")
        let application = directory.appendingPathComponent("Fixture.app")
        let contents = application.appendingPathComponent("Contents")
        try FileManager.default.createDirectory(at: contents, withIntermediateDirectories: true)
        let plist = try PropertyListSerialization.data(fromPropertyList: [
            "CFBundleIdentifier": "sg.tk.classroomwidgets.update-test.\(UUID().uuidString)",
            "CFBundlePackageType": "APPL",
            "CFBundleShortVersionString": "0.11.2"
        ], format: .xml, options: 0)
        try plist.write(to: contents.appendingPathComponent("Info.plist"))
        bundle = try XCTUnwrap(Bundle(url: application), "Fixture: expected a disposable application bundle")
    }

    func remove() { try? FileManager.default.removeItem(at: directory) }

    func makeController() -> UpdateController {
        UpdateController(
            prepareForTermination: { XCTFail("The test must never quit an application"); return false },
            cancelTermination: { XCTFail("The test must never start termination") },
            applicationBundle: bundle,
            loadRelease: { request in
                self.releaseRequests += 1
                if let error = self.releaseError { throw error }
                XCTAssertEqual(request.value(forHTTPHeaderField: "User-Agent"), "ClassroomWidgets/0.11.2")
                let data = Data("""
                {"tag_name":"v0.12.0","html_url":"https://example.invalid/releases/v0.12.0",
                 "assets":[{"name":"ClassroomWidgets-v0.12.0-macos.zip",
                            "browser_download_url":"https://example.invalid/update.zip"}]}
                """.utf8)
                return (data, try XCTUnwrap(HTTPURLResponse(
                    url: try XCTUnwrap(request.url), statusCode: 200, httpVersion: nil, headerFields: nil
                )))
            },
            presentAlert: { alert in
                self.alerts.append(alert)
                return self.responses.isEmpty ? .alertSecondButtonReturn : self.responses.removeFirst()
            },
            openDownloads: { self.openedURLs.append($0) },
            installUpdate: { asset, version in
                self.installAttempts += 1
                XCTAssertEqual(asset.downloadURL.absoluteString, "https://example.invalid/update.zip")
                XCTAssertEqual(version, "0.12.0")
                if let error = self.installError { throw error }
            }
        )
    }
}
