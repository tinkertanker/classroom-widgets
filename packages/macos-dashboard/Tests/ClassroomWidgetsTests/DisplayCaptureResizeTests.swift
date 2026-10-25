import AppKit
import CoreVideo
import ScreenCaptureKit
import XCTest
@testable import ClassroomWidgets

/// Opt in on a disposable, Screen Recording-authorized Mac. This observes actual
/// ScreenCaptureKit buffers, not requested configuration values. On a one-screen
/// runner only the placement guard is bypassed; the preview is still excluded by
/// the production capture filter. No synthetic buffers or capture implementation.
final class DisplayCaptureResizeTests: XCTestCase {
    @MainActor
    func testSettledResizeDeliversNewResolutionOnTheSameSession() async throws {
        guard ProcessInfo.processInfo.environment["CLASSROOM_WIDGETS_CAPTURE_TESTS"] == "1" else {
            throw XCTSkip("Set CLASSROOM_WIDGETS_CAPTURE_TESTS=1 on a Screen Recording-authorized Mac")
        }
        _ = NSApplication.shared
        guard CGPreflightScreenCaptureAccess() else {
            throw XCTSkip("Screen Recording is not authorized for this test runner")
        }
        let source = try XCTUnwrap(DisplayCatalog().displays().first)
        let suite = "DisplayCaptureResizeTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        // Only selection uses this descriptor; never start capture on a fake ID.
        // This lets one-screen runners exercise stale source-generation callbacks.
        let alternate = DisplayDescriptor(
            id: source.id ^ 0x80000000, uuid: "alternate-fixture", name: "Alternate fixture",
            bounds: source.bounds, isActive: true, mirrorMasterID: nil
        )
        defaults.set(source.uuid, forKey: DisplayPreviewCoordinator.Keys.sourceUUID)
        var creations = 0
        var updates = 0
        var holdUpdate = false
        var pendingUpdate: CheckedContinuation<Void, Never>?
        let coordinator = DisplayPreviewCoordinator(
            catalog: DisplayCatalog(displays: { [source, alternate] }), defaults: defaults,
            hostDisplayID: { _ in nil }, overlapsSource: { _, _ in false },
            makeCaptureSession: {
                creations += 1
                return DisplayCaptureSession(sourceID: $0, configurationUpdate: { stream, configuration in
                    updates += 1
                    try await stream.updateConfiguration(configuration)
                    if holdUpdate {
                        await withCheckedContinuation { pendingUpdate = $0 }
                    }
                })
            }
        )
        coordinator.open()
        defer {
            pendingUpdate?.resume()
            coordinator.dismiss()
            coordinator.flushPersistedState()
            defaults.removePersistentDomain(forName: suite)
        }
        let controller = try XCTUnwrap(coordinator.windowController)
        let window = try XCTUnwrap(controller.window)
        let capture = try XCTUnwrap(coordinator.session)
        var delivered: [CGSize] = []
        let present = capture.onFrame
        capture.onFrame = { buffer, size, sequence in
            // Independently read the delivered buffer, not the callback's size.
            if let pixels = buffer.imageBuffer {
                delivered.append(CGSize(width: CVPixelBufferGetWidth(pixels), height: CVPixelBufferGetHeight(pixels)))
            }
            present?(buffer, size, sequence)
        }
        try await waitUntil("first delivered buffer") { !delivered.isEmpty }
        var evidence = ["Real SCStream; source=\(source.id), screens=\(NSScreen.screens.count), scale=\(window.backingScaleFactor)",
                        "Placement guard bypassed for single-screen-capable capture harness; preview excluded by production filter."]
        defer { writeEvidence(evidence) }

        // A small-start stream must grow again below the cap, not just shrink.
        for width: CGFloat in [480, 720, 520] {
            let updatesBeforeBurst = updates
            for transientWidth in [width + 20, width + 10, width] {
                window.setFrame(NSRect(
                    origin: window.frame.origin,
                    size: NSSize(width: transientWidth, height: transientWidth * source.bounds.height / source.bounds.width + controller.previewChromeHeight)
                ), display: true)
                window.contentView?.layoutSubtreeIfNeeded()
                try await Task.sleep(nanoseconds: 30_000_000)
            }
            let backing = controller.previewView.convertToBacking(controller.previewView.bounds).size
            let scale = min(backing.width / source.bounds.width, backing.height / source.bounds.height,
                            1920 / max(source.bounds.width, source.bounds.height))
            let expected = CGSize(width: max(2, floor(source.bounds.width * scale)),
                                  height: max(2, floor(source.bounds.height * scale)))
            let priorCount = delivered.count
            do {
                try await waitUntil("buffer \(expected) after viewport width \(width)") {
                    delivered.dropFirst(priorCount).contains(expected)
                }
            } catch {
                evidence.append("FAIL viewport=\(backing) expected=\(expected) delivered=\(delivered.suffix(8))")
                throw error
            }
            XCTAssertTrue(coordinator.session === capture)
            XCTAssertEqual(creations, 1, "Ordinary resize must not replace the capture session")
            XCTAssertEqual(updates - updatesBeforeBurst, 1, "A settled resize burst must coalesce to one native update")
            let geometry = try XCTUnwrap(coordinator.presentedGeometry)
            let point = CGPoint(x: geometry.imageRect.minX + geometry.imageRect.width * 0.25,
                                y: geometry.imageRect.minY + geometry.imageRect.height * 0.75)
            let target = try XCTUnwrap(DisplayPreviewGeometry.target(
                topLeftPoint: point, geometry: geometry, currentTopologyRevision: coordinator.catalog.topologyRevision
            ))
            XCTAssertEqual(target.x, source.bounds.minX + source.bounds.width * 0.25, accuracy: 0.01)
            XCTAssertEqual(target.y, source.bounds.minY + source.bounds.height * 0.75, accuracy: 0.01)
            evidence.append("PASS viewport=\(backing) delivered=\(expected) sessions=\(creations) pointer=\(target)")
            saveWindow(window, label: "resize-\(Int(width))")
        }

        if let otherScreen = NSScreen.screens.first(where: { $0.backingScaleFactor != window.backingScaleFactor }) {
            let priorCount = delivered.count
            window.setFrameOrigin(NSPoint(x: otherScreen.visibleFrame.minX + 20, y: otherScreen.visibleFrame.minY + 20))
            try await waitUntil("native backing scale change") { window.backingScaleFactor == otherScreen.backingScaleFactor }
            window.contentView?.layoutSubtreeIfNeeded()
            let backing = controller.previewView.convertToBacking(controller.previewView.bounds).size
            let scale = min(backing.width / source.bounds.width, backing.height / source.bounds.height,
                            1920 / max(source.bounds.width, source.bounds.height))
            let expected = CGSize(width: max(2, floor(source.bounds.width * scale)),
                                  height: max(2, floor(source.bounds.height * scale)))
            try await waitUntil("buffer at new backing scale") { delivered.dropFirst(priorCount).contains(expected) }
            XCTAssertTrue(coordinator.session === capture)
            evidence.append("PASS native backing scale=\(window.backingScaleFactor) delivered=\(expected)")
            saveWindow(window, label: "backing-scale-changed")
        } else {
            evidence.append("NOT EXERCISED: native backing-scale transition; no second screen with a different backing scale")
        }

        let updatesBeforeBackingNotice = updates
        controller.windowDidChangeBackingProperties(Notification(name: NSWindow.didChangeBackingPropertiesNotification))
        try await Task.sleep(nanoseconds: 400_000_000)
        XCTAssertEqual(updates, updatesBeforeBackingNotice, "Same backing dimensions must be a no-op")

        // A source switch while an update completion is pending may not publish
        // old geometry, change the new selection, or restart the old stream.
        holdUpdate = true
        window.setContentSize(NSSize(width: 580, height: 580 * source.bounds.height / source.bounds.width + 10))
        try await waitUntil("pending update before source switch") { pendingUpdate != nil }
        coordinator.selectSource(alternate.id)
        XCTAssertNil(coordinator.presentedGeometry)
        pendingUpdate?.resume()
        pendingUpdate = nil
        holdUpdate = false
        try await waitUntil("source switch teardown") { coordinator.session == nil }
        XCTAssertEqual(coordinator.selectedSource, alternate)
        XCTAssertNil(coordinator.presentedGeometry)
        XCTAssertEqual(creations, 1)
        evidence.append("PASS delayed native update across source switch (alternate selection metadata is synthetic)")
        coordinator.selectSource(source.id)
        coordinator.start()
        try await waitUntil("restarted real source frame") { coordinator.presentedGeometry != nil }
        let beforeReopen = try XCTUnwrap(coordinator.session)

        // Keep a native update completion in flight while closing and reopening.
        // The old completion must not revive pixels or configure the replacement.
        holdUpdate = true
        window.setContentSize(NSSize(width: 610, height: 610 * source.bounds.height / source.bounds.width + 10))
        try await waitUntil("pending native configuration completion") { pendingUpdate != nil }
        coordinator.dismiss()
        coordinator.open()
        XCTAssertTrue(coordinator.session === beforeReopen, "The old stream remains owned until teardown completes")
        XCTAssertNil(coordinator.presentedGeometry)
        let updatesAtStop = updates
        pendingUpdate?.resume()
        pendingUpdate = nil
        holdUpdate = false
        try await waitUntil("replacement session after owned stop") { creations == 3 }
        try await waitUntil("replacement frame") { coordinator.presentedGeometry != nil }
        XCTAssertFalse(coordinator.session === beforeReopen)
        XCTAssertEqual(updates, updatesAtStop, "A cancelled update must not reconfigure a replacement stream")
        evidence.append("PASS delayed resize completion across close/reopen; replacement frame accepted without stale update")
        let stopped = await coordinator.prepareForTermination()
        XCTAssertTrue(stopped)
        evidence.append("PASS stop completed")
    }

    @MainActor
    private func waitUntil(_ label: String, condition: () -> Bool) async throws {
        let deadline = Date().addingTimeInterval(8)
        while !condition(), Date() < deadline {
            try await Task.sleep(nanoseconds: 20_000_000)
        }
        guard condition() else {
            XCTFail("Timed out waiting for \(label)")
            throw NSError(domain: "DisplayCaptureResizeTests", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: label])
        }
    }

    private var evidenceDirectory: URL {
        URL(fileURLWithPath: ProcessInfo.processInfo.environment["CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR"]
            ?? NSTemporaryDirectory() + "classroom-widgets-capture-resize", isDirectory: true)
    }

    private func writeEvidence(_ lines: [String]) {
        try? FileManager.default.createDirectory(at: evidenceDirectory, withIntermediateDirectories: true)
        try? (lines.joined(separator: "\n") + "\n").write(
            to: evidenceDirectory.appendingPathComponent("capture-resize.txt"), atomically: true, encoding: .utf8
        )
        lines.forEach { print($0) }
    }

    @MainActor
    private func saveWindow(_ window: NSWindow, label: String) {
        guard let image = CGWindowListCreateImage(.null, .optionIncludingWindow, CGWindowID(window.windowNumber), .bestResolution),
              let png = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]) else { return }
        try? FileManager.default.createDirectory(at: evidenceDirectory, withIntermediateDirectories: true)
        try? png.write(to: evidenceDirectory.appendingPathComponent("\(label).png"))
    }
}
