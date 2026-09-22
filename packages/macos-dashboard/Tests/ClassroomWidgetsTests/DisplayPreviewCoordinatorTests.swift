import AppKit
import ScreenCaptureKit
import XCTest
@testable import ClassroomWidgets

final class DisplayPreviewCoordinatorTests: XCTestCase {
    func testToggleUsesWindowPresenceRatherThanVisibility() async throws {
        try await MainActor.run {
            let fixture = try CoordinatorFixture()
            defer { fixture.close() }
            fixture.coordinator.toggle()
            let controller = try XCTUnwrap(fixture.coordinator.windowController)
            controller.window?.orderOut(nil)
            fixture.coordinator.toggle()
            XCTAssertNil(fixture.coordinator.windowController, "A hidden but present window must be dismissed, not reopened")
            fixture.coordinator.toggle()
            XCTAssertNotNil(fixture.coordinator.windowController)
            XCTAssertFalse(fixture.coordinator.windowController === controller)
            fixture.coordinator.toggle()
            XCTAssertNil(fixture.coordinator.windowController)
            XCTAssertEqual(fixture.permissionRequests, 0)
        }
    }

    @MainActor
    func testDismissWhileEnumerationIsPendingCannotResurrectCapture() async throws {
        let fixture = try CoordinatorFixture()
        defer { fixture.close() }
        let discovery = PendingDiscovery()
        fixture.contentDiscovery = { _ in try await discovery.wait() }
        fixture.preflightGranted = true
        fixture.coordinator.open()
        await fulfillment(of: [discovery.started], timeout: 2)
        let capture = try XCTUnwrap(fixture.coordinator.session)
        let controller = try XCTUnwrap(fixture.coordinator.windowController)
        var lateActivity = 0
        capture.onFrameActivity = { lateActivity += 1 }
        print("PENDING-DISCOVERY entered: suspended=true ownedSessions=\(fixture.createdSources.count)")

        fixture.coordinator.dismiss()
        capture.handleFrameStatus(.idle, sampleBuffer: nil)
        XCTAssertNil(fixture.coordinator.windowController)
        XCTAssertFalse(controller.window?.isVisible == true)
        XCTAssertNil(controller.previewView.fittedImageRectTopLeft())
        discovery.finish()
        await fulfillment(of: [discovery.finished], timeout: 2)
        for _ in 0..<100 {
            if fixture.coordinator.session == nil { break }
            try await Task.sleep(nanoseconds: 10_000_000)
        }
        fixture.postScreenNotice()
        controller.onVisibilityChanged?(true)
        fixture.coordinator.restartIfRunning()
        await withCheckedContinuation { continuation in DispatchQueue.main.async { continuation.resume() } }

        XCTAssertNil(fixture.coordinator.session)
        XCTAssertNil(fixture.coordinator.windowController)
        XCTAssertEqual(fixture.createdSources.count, 1)
        XCTAssertEqual(lateActivity, 0)
        XCTAssertNil(controller.previewView.fittedImageRectTopLeft())
        XCTAssertEqual(fixture.permissionRequests, 0)
        print("PENDING-DISCOVERY released: result=CancellationError sessionAbsent=\(fixture.coordinator.session == nil) windowAbsent=\(fixture.coordinator.windowController == nil) ownedSessions=\(fixture.createdSources.count) lateActivity=\(lateActivity) frameAbsent=\(controller.previewView.fittedImageRectTopLeft() == nil) permissionRequests=\(fixture.permissionRequests)")
    }

    @MainActor
    func testDismissRevokesSessionSynchronouslyBeforeAsyncStopCanRun() async throws {
        let fixture = try CoordinatorFixture()
        defer { fixture.close() }
        fixture.preflightGranted = true
        fixture.coordinator.open()
        let capture = try XCTUnwrap(fixture.coordinator.session)
        var deliveredActivity = 0
        capture.onFrameActivity = { deliveredActivity += 1 }

        fixture.coordinator.dismiss()
        capture.handleFrameStatus(.idle, sampleBuffer: nil)
        await withCheckedContinuation { continuation in DispatchQueue.main.async { continuation.resume() } }

        XCTAssertEqual(deliveredActivity, 0, "Dismiss revokes the session before yielding to the asynchronous stream stop")
        XCTAssertNil(fixture.coordinator.windowController)
        XCTAssertEqual(fixture.createdSources.count, 1)
    }

    func testDismissDuringPermissionConsentCannotStartOrReopenCapture() async throws {
        try await MainActor.run {
            let fixture = try CoordinatorFixture()
            defer { fixture.close() }
            fixture.coordinator.open()
            fixture.duringConsent = { [unowned fixture] in fixture.coordinator.dismiss() }

            fixture.coordinator.windowController?.onToggleCapture?()

            XCTAssertEqual(fixture.permissionRequests, 1)
            XCTAssertTrue(fixture.createdSources.isEmpty)
            XCTAssertNil(fixture.coordinator.windowController)
            XCTAssertNil(fixture.coordinator.session)
        }
    }

    func testDismissClosesActualWindowPreservesSourceAndFrameAndIsIdempotent() async throws {
        try await MainActor.run {
            let fixture = try CoordinatorFixture()
            defer { fixture.close() }
            fixture.coordinator.dismiss()
            XCTAssertNil(fixture.coordinator.windowController)
            fixture.coordinator.open()
            let controller = try XCTUnwrap(fixture.coordinator.windowController)
            let window = try XCTUnwrap(controller.window)
            window.setFrame(NSRect(x: 210, y: 240, width: 640, height: 410), display: true)
            let frame = window.frame
            fixture.coordinator.open()
            XCTAssertTrue(fixture.coordinator.windowController === controller, "Show raises the singleton, never toggles it")

            fixture.coordinator.dismiss()
            XCTAssertFalse(window.isVisible, "Dismiss must close the native window, not merely release its controller")
            XCTAssertNil(fixture.coordinator.windowController)
            fixture.coordinator.dismiss()
            fixture.coordinator.open()
            let reopened = try XCTUnwrap(fixture.coordinator.windowController)
            XCTAssertFalse(reopened === controller)
            XCTAssertEqual(reopened.window?.frame, frame)
            XCTAssertEqual(fixture.sourceItem(CoordinatorFixture.displayB.id, in: reopened.makeControlsMenu())?.state, .on)
            XCTAssertEqual(fixture.permissionRequests, 0)
        }
    }

    func testDismissCancelsOwnedCaptureAndDeferredRestartDespiteLateCallbacks() async throws {
        try await MainActor.run {
            let fixture = try CoordinatorFixture()
            defer { fixture.close() }
            fixture.preflightGranted = true
            fixture.coordinator.open()
            let capture = try XCTUnwrap(fixture.coordinator.session)
            let controller = try XCTUnwrap(fixture.coordinator.windowController)
            capture.onFrameActivity?()
            fixture.coordinator.restartIfRunning()
            fixture.coordinator.open() // Deliberate Show during an owned stop may defer a restart.
            fixture.coordinator.dismiss()
            capture.onTransientGap?(.blank, 1)
            capture.onStop?(CancellationError())
            fixture.postScreenNotice()
            controller.onVisibilityChanged?(true)

            XCTAssertNil(fixture.coordinator.windowController)
            XCTAssertNil(fixture.coordinator.session)
            XCTAssertEqual(fixture.createdSources, [CoordinatorFixture.displayB.id], "Dismiss revokes pending launch/reload/visibility capture intent")
            XCTAssertEqual(fixture.permissionRequests, 0)
        }
    }

    func testMovingHostRefreshesChoicesWithoutLosingTheSuspendedSelection() async throws {
        try await MainActor.run {
            let fixture = try CoordinatorFixture()
            defer { fixture.close() }
            fixture.coordinator.open()
            let controller = try XCTUnwrap(fixture.coordinator.windowController)
            let initialStatus = controller.makeControlsMenu().items.first?.title

            fixture.hostID = CoordinatorFixture.displayB.id
            controller.windowDidMove(Notification(name: NSWindow.didMoveNotification))
            let menu = controller.makeControlsMenu()
            menu.update()

            XCTAssertEqual(menu.items.first?.title, initialStatus, "Menu refresh must not publish ready/off status")
            let sourceA = try XCTUnwrap(fixture.sourceItem(CoordinatorFixture.displayA.id, in: menu))
            let sourceB = try XCTUnwrap(fixture.sourceItem(CoordinatorFixture.displayB.id, in: menu))
            XCTAssertTrue(sourceA.isEnabled, "The former host is now a source choice")
            XCTAssertEqual(sourceB.state, .on, "Retain the selected source while it overlaps the host")
            XCTAssertFalse(sourceB.isEnabled, "The overlapping source is retained, not offered as a new choice")
            XCTAssertEqual(controller.currentSourceAspect, 16.0 / 9.0)

            XCTAssertTrue(NSApp.sendAction(try XCTUnwrap(sourceA.action), to: sourceA.target, from: sourceA))
            XCTAssertEqual(
                fixture.sourceItem(CoordinatorFixture.displayA.id, in: controller.makeControlsMenu())?.state, .on
            )
            controller.onToggleCapture?()
            XCTAssertEqual(fixture.createdSources, [CoordinatorFixture.displayA.id])
        }
    }

    func testStaleSourceMenuActionCannotCancelOverlapResume() async throws {
        try await MainActor.run {
            let fixture = try CoordinatorFixture()
            defer { fixture.close() }
            fixture.preflightGranted = true
            fixture.coordinator.open()
            let controller = try XCTUnwrap(fixture.coordinator.windowController)
            let capture = try XCTUnwrap(fixture.coordinator.session)
            let staleItem = try XCTUnwrap(fixture.sourceItem(
                CoordinatorFixture.displayB.id, in: controller.makeControlsMenu()
            ))

            fixture.hostID = CoordinatorFixture.displayB.id
            controller.windowDidMove(Notification(name: NSWindow.didMoveNotification))
            fixture.postScreenNotice()
            // A menu was opened before the move. Validate again even if its action
            // arrives after the host changed, rather than clearing source/intent.
            XCTAssertTrue(NSApp.sendAction(try XCTUnwrap(staleItem.action), to: staleItem.target, from: staleItem))
            XCTAssertEqual(
                fixture.sourceItem(CoordinatorFixture.displayB.id, in: controller.makeControlsMenu())?.state, .on
            )
            capture.onStop?(CancellationError())
            XCTAssertNil(fixture.coordinator.session, "Owned cleanup completed while overlap still blocks restart")

            fixture.hostID = CoordinatorFixture.displayA.id
            controller.windowDidMove(Notification(name: NSWindow.didMoveNotification))
            XCTAssertEqual(fixture.createdSources, [CoordinatorFixture.displayB.id, CoordinatorFixture.displayB.id])
            XCTAssertNotNil(fixture.coordinator.session, "Moving clear must consume the retained restart exactly once")
            controller.windowDidMove(Notification(name: NSWindow.didMoveNotification))
            XCTAssertEqual(fixture.createdSources.count, 2)
        }
    }

    func testChangedSourceDuringPermissionConsentCannotAdoptCapture() async throws {
        try await MainActor.run {
            let fixture = try CoordinatorFixture()
            defer { fixture.close() }
            fixture.coordinator.open()
            let controller = try XCTUnwrap(fixture.coordinator.windowController)
            fixture.duringConsent = { [unowned fixture] in
                fixture.displays[1] = DisplayDescriptor(
                    id: CoordinatorFixture.displayB.id, uuid: CoordinatorFixture.displayB.uuid,
                    name: "Display B", bounds: CGRect(x: 1512, y: -120, width: 900, height: 1600),
                    isActive: true, mirrorMasterID: nil
                )
                fixture.postScreenNotice()
            }

            controller.onToggleCapture?()

            XCTAssertEqual(fixture.permissionRequests, 1)
            XCTAssertTrue(fixture.createdSources.isEmpty, "Consent cannot revive a start invalidated by topology")
            XCTAssertNil(fixture.coordinator.session)
            XCTAssertEqual(controller.currentSourceAspect, 900.0 / 1600.0)
        }
    }

    func testReopenedWindowDuringPermissionConsentCannotAdoptTheOldStart() async throws {
        try await MainActor.run {
            let fixture = try CoordinatorFixture()
            defer { fixture.close() }
            fixture.coordinator.open()
            let oldController = try XCTUnwrap(fixture.coordinator.windowController)
            fixture.duringConsent = { [unowned fixture] in
                fixture.coordinator.windowController?.close()
                fixture.coordinator.open()
            }

            oldController.onToggleCapture?()

            XCTAssertFalse(fixture.coordinator.windowController === oldController)
            XCTAssertTrue(fixture.createdSources.isEmpty, "The old dialog must not authorize the replacement window")
            XCTAssertNil(fixture.coordinator.session)
        }
    }

    func testSessionInterruptionDuringPermissionConsentCannotAdoptCapture() async throws {
        try await MainActor.run {
            let fixture = try CoordinatorFixture()
            defer { fixture.close() }
            fixture.coordinator.open()
            fixture.duringConsent = {
                // Local notification delivery only; this does not switch or lock
                // the Mac's user session or touch TCC.
                NSWorkspace.shared.notificationCenter.post(
                    name: NSWorkspace.sessionDidResignActiveNotification, object: nil
                )
            }

            fixture.coordinator.windowController?.onToggleCapture?()

            XCTAssertTrue(fixture.createdSources.isEmpty, "An interruption revokes even an otherwise identical source")
            XCTAssertNil(fixture.coordinator.session)
        }
    }

    func testUnchangedConsentAndUnrelatedNoticeStillStartExactlyOnce() async throws {
        try await MainActor.run {
            let fixture = try CoordinatorFixture()
            defer { fixture.close() }
            fixture.coordinator.open()
            fixture.duringConsent = { [unowned fixture] in fixture.postScreenNotice() }

            fixture.coordinator.windowController?.onToggleCapture?()

            XCTAssertEqual(fixture.permissionRequests, 1)
            XCTAssertEqual(fixture.createdSources, [CoordinatorFixture.displayB.id])
            XCTAssertEqual(fixture.coordinator.session?.sourceID, CoordinatorFixture.displayB.id)
        }
    }
}

@MainActor
private final class CoordinatorFixture {
    static let displayA = DisplayDescriptor(
        id: 101, uuid: "fixture-a", name: "Display A",
        bounds: CGRect(x: 0, y: 0, width: 1512, height: 982), isActive: true, mirrorMasterID: nil
    )
    static let displayB = DisplayDescriptor(
        id: 202, uuid: "fixture-b", name: "Display B",
        bounds: CGRect(x: 1512, y: -120, width: 1920, height: 1080), isActive: true, mirrorMasterID: nil
    )
    var displays = [CoordinatorFixture.displayA, CoordinatorFixture.displayB]
    var hostID = CoordinatorFixture.displayA.id
    var preflightGranted = false
    var permissionRequests = 0
    var duringConsent: (() -> Void)?
    var createdSources: [CGDirectDisplayID] = []
    var contentDiscovery: DisplayCaptureSession.ContentDiscovery = { _ in throw CancellationError() }
    private let suiteName = "DisplayPreviewCoordinatorTests.\(UUID().uuidString)"
    private let defaults: UserDefaults

    lazy var coordinator = DisplayPreviewCoordinator(
        catalog: DisplayCatalog(displays: { [weak self] in self?.displays ?? [] }),
        defaults: defaults,
        hostDisplayID: { [weak self] _ in self?.hostID },
        overlapsSource: { [weak self] source, _ in source.id == self?.hostID },
        preflightCaptureAccess: { [weak self] in self?.preflightGranted ?? false },
        requestPermission: { [weak self] in
            guard let self else { return false }
            self.permissionRequests += 1
            self.duringConsent?()
            return true
        },
        makeCaptureSession: { [weak self] id in
            self?.createdSources.append(id)
            // No shareable-content discovery, stream, permission, or capture IO.
            return DisplayCaptureSession(sourceID: id, contentDiscovery: self?.contentDiscovery ?? { _ in throw CancellationError() })
        }
    )

    init() throws {
        _ = NSApplication.shared
        defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName), "Fixture: isolated preferences")
    }

    func sourceItem(_ id: CGDirectDisplayID, in menu: NSMenu) -> NSMenuItem? {
        menu.items.first { ($0.representedObject as? NSNumber)?.uint32Value == id }
    }

    func postScreenNotice() {
        NotificationCenter.default.post(name: NSApplication.didChangeScreenParametersNotification, object: nil)
    }

    func close() {
        duringConsent = nil
        coordinator.windowController?.close()
        coordinator.flushPersistedState()
        defaults.removePersistentDomain(forName: suiteName)
    }
}

@MainActor
private final class PendingDiscovery {
    let started = XCTestExpectation(description: "Synthetic enumeration entered")
    let finished = XCTestExpectation(description: "Synthetic enumeration resumed with cancellation")
    private var continuation: CheckedContinuation<SCShareableContent, Error>?

    func wait() async throws -> SCShareableContent {
        defer { finished.fulfill() }
        return try await withCheckedThrowingContinuation {
            continuation = $0
            started.fulfill()
        }
    }

    func finish() {
        continuation?.resume(throwing: CancellationError())
        continuation = nil
    }
}
