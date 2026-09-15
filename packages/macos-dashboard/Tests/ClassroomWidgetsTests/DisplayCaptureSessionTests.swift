import ScreenCaptureKit
import XCTest
@testable import ClassroomWidgets

final class DisplayCaptureSessionTests: XCTestCase {
    func testStartedThenCompleteWaitsForAndDeliversUsableFrame() {
        XCTAssertEqual(
            [SCFrameStatus.started, .complete].map { DisplayCaptureSession.disposition(for: $0) },
            [.ignore, .deliver]
        )
    }

    func testUnavailableFramesStillFailClosedWhileIdleRetainsCurrentFrame() {
        XCTAssertEqual(DisplayCaptureSession.disposition(for: .idle), .ignore)
        XCTAssertEqual(DisplayCaptureSession.disposition(for: .blank), .unavailable)
        XCTAssertEqual(DisplayCaptureSession.disposition(for: .suspended), .unavailable)
    }
}
