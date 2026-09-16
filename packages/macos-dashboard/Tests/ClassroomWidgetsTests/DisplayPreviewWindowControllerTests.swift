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

    func testOcclusionChangesDoNotEmitMinimizeVisibilityCallbacks() async {
        await MainActor.run {
            _ = NSApplication.shared
            let controller = DisplayPreviewWindowController(
                frame: NSRect(x: 0, y: 0, width: 480, height: 360),
                backgroundOpacity: 1,
                keepOnAllSpaces: true
            )
            var visibilityEvents: [Bool] = []
            controller.onVisibilityChanged = { visibilityEvents.append($0) }
            controller.window?.orderOut(nil)

            controller.windowDidChangeOcclusionState(Notification(name: NSWindow.didChangeOcclusionStateNotification))

            XCTAssertTrue(visibilityEvents.isEmpty)
            controller.close()
        }
    }

    func testMiniaturizationStillEmitsPauseAndResumeCallbacks() async {
        await MainActor.run {
            _ = NSApplication.shared
            let controller = DisplayPreviewWindowController(
                frame: NSRect(x: 0, y: 0, width: 480, height: 360),
                backgroundOpacity: 1,
                keepOnAllSpaces: true
            )
            var visibilityEvents: [Bool] = []
            controller.onVisibilityChanged = { visibilityEvents.append($0) }

            controller.windowDidMiniaturize(Notification(name: NSWindow.didMiniaturizeNotification))
            controller.windowDidDeminiaturize(Notification(name: NSWindow.didDeminiaturizeNotification))

            XCTAssertEqual(visibilityEvents, [false, true])
            controller.close()
        }
    }

    func testPanelUsesCompactFloatingShellWithoutPermanentContentControls() async {
        await MainActor.run {
            _ = NSApplication.shared
            let controller = DisplayPreviewWindowController(
                frame: NSRect(x: 0, y: 0, width: 480, height: 360),
                backgroundOpacity: 1,
                keepOnAllSpaces: true
            )
            guard let panel = controller.window as? NSPanel,
                  let contentView = panel.contentView else {
                return XCTFail("Expected Display Preview panel")
            }

            XCTAssertFalse(panel.isOpaque)
            XCTAssertEqual(panel.backgroundColor, .clear)
            XCTAssertTrue(panel.titlebarAppearsTransparent)
            XCTAssertFalse(panel.titlebarAccessoryViewControllers.isEmpty)
            XCTAssertTrue(descendants(of: contentView, type: NSPopUpButton.self).isEmpty)
            XCTAssertTrue(descendants(of: contentView, type: NSButton.self).isEmpty)
            XCTAssertEqual(panel.contentMinSize, NSSize(width: 320, height: 240))
            controller.close()
        }
    }

    func testDefaultLivePausedAndErrorStatesExposeCompactAccessibleControls() async {
        await MainActor.run {
            _ = NSApplication.shared
            let controller = DisplayPreviewWindowController(
                frame: NSRect(x: 0, y: 0, width: 480, height: 360),
                backgroundOpacity: 1,
                keepOnAllSpaces: true
            )
            guard let panel = controller.window as? NSPanel else { return XCTFail("Expected panel") }

            for state in [
                ("Ready to preview Built-in Display.", "Start", true, false),
                ("Live: Built-in Display", "Pause", true, true),
                ("Paused.", "Resume", true, false),
                ("Capture stopped: unavailable", "Resume", false, false)
            ] {
                controller.showStatus(state.0, buttonTitle: state.1, buttonEnabled: state.2, centerEnabled: state.3)
                let accessoryButtons = panel.titlebarAccessoryViewControllers.flatMap {
                    descendants(of: $0.view, type: NSButton.self)
                }
                XCTAssertTrue(accessoryButtons.contains { $0.title == state.1 || $0.toolTip == state.1 })
                XCTAssertTrue(accessibilityLabels(in: panel).contains("Display Preview status: \(state.0)"))
            }
            controller.close()
        }
    }

    @MainActor
    private func descendants<T: NSView>(of view: NSView, type: T.Type) -> [T] {
        let current = (view as? T).map { [$0] } ?? []
        return current + view.subviews.flatMap { descendants(of: $0, type: type) }
    }

    @MainActor
    private func accessibilityLabels(in window: NSWindow) -> [String] {
        guard let frameView = window.contentView?.superview else { return [] }
        return descendants(of: frameView, type: NSView.self).compactMap { $0.accessibilityLabel() }
    }
}
