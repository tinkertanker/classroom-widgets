import CoreGraphics
import XCTest
@testable import ClassroomWidgets

final class MoveToNextDisplayTests: XCTestCase {
    private let left = CGRect(x: 0, y: 0, width: 1920, height: 1080)
    private let right = CGRect(x: 1920, y: 0, width: 1920, height: 1080)

    func testPanelMovesToNextDisplayPreservingOffset() {
        let frame = CGRect(x: 100, y: 50, width: 400, height: 300)
        XCTAssertEqual(
            WidgetPanelMoveGeometry.nextDisplayFrame(frame: frame, workAreas: [left, right]),
            CGRect(x: 2020, y: 50, width: 400, height: 300)
        )
    }

    func testPanelWrapsFromLastDisplayToFirst() {
        let frame = CGRect(x: 2000, y: 80, width: 300, height: 200)
        XCTAssertEqual(
            WidgetPanelMoveGeometry.nextDisplayFrame(frame: frame, workAreas: [left, right]),
            CGRect(x: 80, y: 80, width: 300, height: 200)
        )
    }

    func testOffsetOverflowingSmallerTargetIsClamped() {
        let small = CGRect(x: 1920, y: 0, width: 800, height: 600)
        let frame = CGRect(x: 1500, y: 700, width: 400, height: 300)
        let result = WidgetPanelMoveGeometry.nextDisplayFrame(frame: frame, workAreas: [left, small])
        XCTAssertEqual(result, CGRect(x: 1920 + 800 - 400, y: 600 - 300, width: 400, height: 300))
    }

    func testSingleDisplayReturnsNil() {
        let frame = CGRect(x: 100, y: 50, width: 400, height: 300)
        XCTAssertNil(WidgetPanelMoveGeometry.nextDisplayFrame(frame: frame, workAreas: [left]))
        XCTAssertNil(WidgetPanelMoveGeometry.nextDisplayFrame(frame: frame, workAreas: []))
    }

    func testPanelOverlappingNoWorkAreaReturnsNil() {
        let frame = CGRect(x: 5000, y: 5000, width: 400, height: 300)
        XCTAssertNil(WidgetPanelMoveGeometry.nextDisplayFrame(frame: frame, workAreas: [left, right]))
    }
}
