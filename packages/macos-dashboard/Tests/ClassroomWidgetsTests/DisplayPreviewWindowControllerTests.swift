import AppKit
import XCTest
@testable import ClassroomWidgets

final class DisplayPreviewWindowControllerTests: XCTestCase {
    func testPanelRemainsVisibleWhenAnotherApplicationActivates() async {
        await MainActor.run {
            _ = NSApplication.shared
            let controller = DisplayPreviewWindowController(
                frame: NSRect(x: 0, y: 0, width: 480, height: 360),
                backgroundOpacity: 1,
                keepOnAllSpaces: true
            )

            XCTAssertEqual(controller.window?.hidesOnDeactivate, false)
            controller.close()
        }
    }
}
