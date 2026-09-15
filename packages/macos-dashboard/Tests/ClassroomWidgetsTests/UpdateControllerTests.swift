import XCTest
@testable import ClassroomWidgets

final class UpdateControllerTests: XCTestCase {
    func testSemanticVersionComparison() {
        XCTAssertTrue(UpdateController.isNewerVersion("0.12.0", than: "0.11.9"))
        XCTAssertTrue(UpdateController.isNewerVersion("0.11.10", than: "0.11.9"))
        XCTAssertFalse(UpdateController.isNewerVersion("0.11.2", than: "0.11.2"))
        XCTAssertFalse(UpdateController.isNewerVersion("0.10.99", than: "0.11.0"))
        XCTAssertFalse(UpdateController.isNewerVersion("nightly", than: "0.11.0"))
    }
}
