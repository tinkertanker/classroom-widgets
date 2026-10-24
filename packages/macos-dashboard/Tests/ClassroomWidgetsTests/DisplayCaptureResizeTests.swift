import AppKit
import CoreVideo
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
        var creations = 0
        let coordinator = DisplayPreviewCoordinator(
            catalog: DisplayCatalog(displays: { [source] }), defaults: defaults,
            hostDisplayID: { _ in nil }, overlapsSource: { _, _ in false },
            makeCaptureSession: {
                creations += 1
                return DisplayCaptureSession(sourceID: $0)
            }
        )
        coordinator.open()
        defer {
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
            let frame = NSRect(
                origin: window.frame.origin,
                size: NSSize(width: width, height: width * source.bounds.height / source.bounds.width + controller.previewChromeHeight)
            )
            window.setFrame(frame, display: true)
            window.contentView?.layoutSubtreeIfNeeded()
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
