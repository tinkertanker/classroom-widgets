import ScreenCaptureKit
import XCTest
@testable import ClassroomWidgets

final class DisplayCaptureSessionTests: XCTestCase {
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
}
