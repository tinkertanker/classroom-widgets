import AppKit
import XCTest
@testable import ClassroomWidgets

final class WidgetPanelContentLayoutTests: XCTestCase {
    func testGapIsAddedWithoutReducingPreferredViewport() {
        XCTAssertEqual(
            WidgetPanelContentLayout.panelSize(for: NSSize(width: 350, height: 415)),
            NSSize(width: 350, height: 425)
        )
        XCTAssertEqual(
            WidgetPanelContentLayout.panelSize(for: NSSize(width: 325, height: 325)),
            NSSize(width: 325, height: 335)
        )
    }

    func testTimerAspectRatioExcludesGapWhenResizingEitherAxis() {
        let timer = descriptor(aspectRatio: 350.0 / 415.0)
        for proposed in [NSSize(width: 700, height: 425), NSSize(width: 350, height: 840)] {
            let result = WidgetPanelContentLayout.constrainedSize(
                proposed, current: NSSize(width: 350, height: 425), descriptor: timer
            )
            XCTAssertEqual(result.width, 700, accuracy: 0.001)
            XCTAssertEqual(result.height, 840, accuracy: 0.001)
        }
    }

    func testAspectResizeHonoursBothMinimumDimensions() {
        let result = WidgetPanelContentLayout.constrainedSize(
            NSSize(width: 100, height: 100),
            current: NSSize(width: 350, height: 425),
            descriptor: descriptor(aspectRatio: 350.0 / 415.0)
        )
        XCTAssertGreaterThanOrEqual(result.width, 250)
        XCTAssertEqual(result.height, 316, accuracy: 0.001)
        XCTAssertEqual(result.width / (result.height - 10), 350.0 / 415.0, accuracy: 0.001)
    }

    func testAspectResizeHonoursBothMaximumDimensions() {
        let result = WidgetPanelContentLayout.constrainedSize(
            NSSize(width: 1000, height: 1000),
            current: NSSize(width: 350, height: 425),
            descriptor: descriptor(aspectRatio: 1, maximum: .init(width: 500, height: 450))
        )
        XCTAssertEqual(result, NSSize(width: 450, height: 460))
    }

    func testUnconstrainedAspectLeavesResizeUnchanged() {
        let proposed = NSSize(width: 450, height: 600)
        XCTAssertEqual(
            WidgetPanelContentLayout.constrainedSize(
                proposed, current: NSSize(width: 350, height: 425), descriptor: descriptor(aspectRatio: nil)
            ),
            proposed
        )
    }

    private func descriptor(
        aspectRatio: CGFloat?,
        maximum: WidgetPanelDescriptor.Size? = nil
    ) -> WidgetPanelDescriptor {
        WidgetPanelDescriptor(
            id: "test", title: "Test",
            preferredContentSize: .init(width: 350, height: 415),
            minimumContentSize: .init(width: 250, height: 306),
            maximumContentSize: maximum,
            aspectRatio: aspectRatio,
            snapshotPayload: [:]
        )
    }
}
