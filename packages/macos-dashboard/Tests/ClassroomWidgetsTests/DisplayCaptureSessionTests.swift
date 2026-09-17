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

    func testTransientFrameStatusesHoldWhileIdleRetainsCurrentFrame() {
        XCTAssertEqual(DisplayCaptureSession.disposition(for: .idle), .ignore)
        XCTAssertEqual(DisplayCaptureSession.disposition(for: .started), .ignore)
        XCTAssertEqual(DisplayCaptureSession.disposition(for: .blank), .hold)
        XCTAssertEqual(DisplayCaptureSession.disposition(for: .suspended), .hold)
        XCTAssertEqual(DisplayCaptureSession.disposition(for: .stopped), .stopped)
        XCTAssertEqual(DisplayCaptureSession.disposition(for: .complete), .deliver)
        XCTAssertEqual(
            DisplayCaptureSession.disposition(for: .complete, hasImageBuffer: false),
            .hold,
            "A complete frame without pixels is a temporary gap, not a terminal stop"
        )
    }

    func testGapReasonsAreStableAndPrivacySafeForLogging() {
        XCTAssertEqual(DisplayCaptureSession.gapReason(for: .blank, hasImageBuffer: true), .blank)
        XCTAssertEqual(DisplayCaptureSession.gapReason(for: .suspended, hasImageBuffer: true), .suspended)
        XCTAssertEqual(
            DisplayCaptureSession.gapReason(for: .complete, hasImageBuffer: false),
            .missingImageBuffer
        )
        XCTAssertEqual(DisplayCaptureSession.gapReason(for: .stopped, hasImageBuffer: false), .stopped)
        XCTAssertEqual(DisplayCaptureGapReason.blank.rawValue, "blank")
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
