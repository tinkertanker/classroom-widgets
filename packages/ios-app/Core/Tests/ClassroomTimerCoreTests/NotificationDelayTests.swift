import XCTest
@testable import ClassroomTimerCore

final class NotificationDelayTests: XCTestCase {
    func testDelayUsesTimeRemainingAfterAuthorizationWait() {
        let deadline: TimeInterval = 1_015
        let authorizedAt: TimeInterval = 1_008

        XCTAssertEqual(notificationDelay(until: deadline, now: authorizedAt), 7)
    }

    func testPassedDeadlineDoesNotScheduleNotification() {
        XCTAssertNil(notificationDelay(until: 1_015, now: 1_016))
    }

    func testNotificationDelayRespectsSystemMinimum() {
        XCTAssertEqual(notificationDelay(until: 1_015, now: 1_014.5), 1)
    }
}
