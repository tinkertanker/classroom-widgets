import ScreenCaptureKit
import XCTest
@testable import ClassroomWidgets

final class DisplayCaptureSessionTests: XCTestCase {
    private enum TestError: Error { case unexpectedDiscovery }

    func testFrameDispositionWaitsForStartedThenAcceptsCompleteStatus() {
        XCTAssertEqual(
            [SCFrameStatus.started, .complete].map { DisplayCaptureSession.disposition(for: $0) },
            [.ignore, .deliver]
        )
    }

    func testUnavailableFramesStillFailClosedWhileIdleRetainsCurrentFrame() {
        XCTAssertEqual(DisplayCaptureSession.disposition(for: .idle), .ignore)
        XCTAssertEqual(DisplayCaptureSession.disposition(for: .blank), .unavailable)
        XCTAssertEqual(DisplayCaptureSession.disposition(for: .suspended), .unavailable)
        XCTAssertEqual(
            DisplayCaptureSession.disposition(for: .complete, hasImageBuffer: false),
            .unavailable
        )
    }

    func testStopBeforeStartKeepsCancellationStickyAndSkipsContentDiscovery() async throws {
        let discoveryCalled = NSLock()
        var didCallDiscovery = false
        let session = DisplayCaptureSession(sourceID: 1) {
            discoveryCalled.withLock { didCallDiscovery = true }
            throw TestError.unexpectedDiscovery
        }

        try await session.stop()

        do {
            try await session.start(excludingWindowID: 1, outputSize: CGSize(width: 640, height: 480))
            XCTFail("A pre-stopped capture session must not start")
        } catch is CancellationError {
            // Expected: cancellation is permanent for this one-shot session.
        } catch {
            XCTFail("Expected CancellationError, got \(error)")
        }
        XCTAssertFalse(discoveryCalled.withLock { didCallDiscovery })
    }
}
