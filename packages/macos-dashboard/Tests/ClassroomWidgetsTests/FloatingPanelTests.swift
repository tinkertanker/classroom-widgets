import AppKit
import XCTest
@testable import ClassroomWidgets

final class FloatingPanelTests: XCTestCase {
    func testDisplayPreviewPanelStaysNonActivatingButCanTakeFocus() async {
        await MainActor.run {
            _ = NSApplication.shared
            let controller = DisplayPreviewWindowController(
                frame: NSRect(x: 0, y: 0, width: 480, height: 360),
                backgroundOpacity: 1,
                keepOnAllSpaces: true
            )
            guard let panel = controller.window as? FloatingPanel else {
                return XCTFail("Display preview should use FloatingPanel")
            }
            XCTAssertTrue(panel.styleMask.contains(.nonactivatingPanel))
            XCTAssertTrue(panel.collectionBehavior.contains(.fullScreenAuxiliary))
            XCTAssertTrue(panel.canBecomeKey)
            XCTAssertTrue(panel.canBecomeMain)
            controller.close()
        }
    }

    func testOnlyMouseDownEventsActivateTheApp() {
        XCTAssertTrue(FloatingPanel.activatesApp(for: .leftMouseDown))
        XCTAssertTrue(FloatingPanel.activatesApp(for: .rightMouseDown))
        XCTAssertFalse(FloatingPanel.activatesApp(for: .mouseMoved))
        XCTAssertFalse(FloatingPanel.activatesApp(for: .leftMouseUp))
        XCTAssertFalse(FloatingPanel.activatesApp(for: .scrollWheel))
        XCTAssertFalse(FloatingPanel.activatesApp(for: .keyDown))
    }
}
