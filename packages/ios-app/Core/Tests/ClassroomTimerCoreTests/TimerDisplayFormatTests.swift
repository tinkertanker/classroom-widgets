import XCTest
@testable import ClassroomTimerCore

final class TimerDisplayFormatTests: XCTestCase {
    func testFormatsMinutesAndSecondsBelowOneHour() {
        XCTAssertEqual(timerDisplayText(for: 59), "00:59")
        XCTAssertEqual(timerDisplayText(for: 60), "01:00")
        XCTAssertEqual(timerDisplayText(for: 3_599), "59:59")
    }

    func testFormatsHoursMinutesAndSecondsAtOneHourAndAbove() {
        XCTAssertEqual(timerDisplayText(for: 3_600), "01:00:00")
        XCTAssertEqual(timerDisplayText(for: 359_999), "99:59:59")
    }

    func testClampsInvalidAndNegativeValuesToZero() {
        XCTAssertEqual(timerDisplayText(for: -1), "00:00")
        XCTAssertEqual(timerDisplayText(for: .nan), "00:00")
    }
}
