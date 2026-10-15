import XCTest
@testable import ClassroomWidgets

final class DesktopLauncherPolicyTests: XCTestCase {
    func testDashboardIntegerRejectsNonIntegralNumbers() {
        XCTAssertEqual(dashboardInteger(NSNumber(value: 17)), 17)
        XCTAssertNil(dashboardInteger(NSNumber(value: true)))
        XCTAssertNil(dashboardInteger(NSNumber(value: 1.5)))
        XCTAssertNil(dashboardInteger(NSNumber(value: UInt64.max)))
    }
}
