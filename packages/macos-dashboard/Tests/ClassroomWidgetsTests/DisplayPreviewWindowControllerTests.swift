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
            panel.setContentSize(panel.contentMinSize)
            contentView.layoutSubtreeIfNeeded()
            XCTAssertEqual(contentView.bounds.size, NSSize(width: 320, height: 240))
            XCTAssertEqual(controller.previewView.frame.minY, contentView.bounds.minY, accuracy: 0.5)
            XCTAssertEqual(
                contentView.bounds.maxY - controller.previewView.frame.maxY,
                WidgetPanelContentLayout.topGap,
                accuracy: 0.5
            )
            controller.close()
        }
    }

    func testLongStatusesWrapWithoutGrowingShownMinimumPanel() async {
        await MainActor.run {
            _ = NSApplication.shared
            let controller = DisplayPreviewWindowController(
                frame: NSRect(x: 0, y: 0, width: 480, height: 360),
                backgroundOpacity: 1,
                keepOnAllSpaces: true
            )
            guard let panel = controller.window as? NSPanel,
                  let contentView = panel.contentView,
                  let frameView = contentView.superview,
                  let statusLabel = descendants(of: contentView, type: NSTextField.self).first
            else { return XCTFail("Expected Display status label") }
            panel.orderFront(nil)

            for message in [
                "Choose a source display, then press Start.",
                "Preview suspended while it overlaps the source display. Move it fully clear to resume."
            ] {
                controller.showStatus(
                    message,
                    buttonTitle: "Pause",
                    buttonEnabled: true,
                    centerEnabled: false
                )
                panel.setContentSize(panel.contentMinSize)
                frameView.layoutSubtreeIfNeeded()
                panel.displayIfNeeded()

                XCTAssertEqual(contentView.bounds.size, NSSize(width: 320, height: 240))
                XCTAssertEqual(statusLabel.stringValue, message)
                XCTAssertEqual(statusLabel.lineBreakMode, .byWordWrapping)
                XCTAssertEqual(statusLabel.maximumNumberOfLines, 3)
                let textHeight = (message as NSString).boundingRect(
                    with: NSSize(width: statusLabel.bounds.width, height: .greatestFiniteMagnitude),
                    options: [.usesLineFragmentOrigin, .usesFontLeading],
                    attributes: [.font: statusLabel.font ?? NSFont.systemFont(ofSize: NSFont.systemFontSize)]
                ).height
                XCTAssertGreaterThanOrEqual(
                    statusLabel.bounds.height + 0.5,
                    textHeight,
                    "The full status must wrap without clipping"
                )
            }
            controller.close()
        }
    }

    func testBackgroundOpacityDoesNotMakeCapturedPixelsTranslucent() async {
        await MainActor.run {
            _ = NSApplication.shared
            let controller = DisplayPreviewWindowController(
                frame: NSRect(x: 0, y: 0, width: 480, height: 360),
                backgroundOpacity: 0.2,
                keepOnAllSpaces: true
            )

            XCTAssertEqual(controller.previewView.alphaValue, 1)
            XCTAssertEqual(controller.previewView.layer?.opacity, 1)
            XCTAssertEqual(controller.window?.backgroundColor, .clear)
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

    func testSourceReadyPresentationExplicitlyEnablesIdleCard() async {
        await MainActor.run {
            _ = NSApplication.shared
            let controller = DisplayPreviewWindowController(
                frame: NSRect(x: 0, y: 0, width: 480, height: 360),
                backgroundOpacity: 1,
                keepOnAllSpaces: true
            )
            var starts = 0
            controller.onToggleCapture = { starts += 1 }

            let ready = DisplayPreviewPresentation.ready(sourceName: "Built-in Display")
            controller.showStatus(ready)
            guard let panel = controller.window as? NSPanel,
                  let contentView = panel.contentView
            else { return XCTFail("Expected panel") }
            let startButton = panel.titlebarAccessoryViewControllers.flatMap {
                descendants(of: $0.view, type: NSButton.self)
            }.first { $0.title == "Start" }
            let rawChildren = contentView.accessibilityChildren() ?? []
            let unignoredChildren = NSAccessibility.unignoredChildren(from: rawChildren)
            let pressSelector = NSSelectorFromString("accessibilityPerformPress")
            XCTAssertEqual(ready.buttonTitle, "Start")
            XCTAssertTrue(ready.buttonEnabled)
            XCTAssertTrue(ready.idleStartEnabled)
            XCTAssertTrue(startButton?.isEnabled == true)
            XCTAssertTrue(controller.previewView.isAccessibilityElement())
            XCTAssertTrue(rawChildren.contains { ($0 as AnyObject) === controller.previewView })
            XCTAssertTrue(unignoredChildren.contains { ($0 as AnyObject) === controller.previewView })
            XCTAssertEqual(controller.previewView.accessibilityRole(), NSAccessibility.Role.button)
            XCTAssertTrue(controller.previewView.isAccessibilitySelectorAllowed(pressSelector))
            XCTAssertTrue(controller.previewView.accessibilityPerformPress())
            XCTAssertEqual(starts, 1)

            controller.showStatus(
                "Stopping…",
                buttonTitle: "Start",
                buttonEnabled: false,
                centerEnabled: false
            )
            XCTAssertFalse(startButton?.isEnabled == true)
            XCTAssertTrue(controller.previewView.isAccessibilityElement())
            XCTAssertTrue(NSAccessibility.unignoredChildren(
                from: contentView.accessibilityChildren() ?? []
            ).contains { ($0 as AnyObject) === controller.previewView })
            XCTAssertEqual(controller.previewView.accessibilityRole(), NSAccessibility.Role.image)
            XCTAssertFalse(controller.previewView.isAccessibilitySelectorAllowed(pressSelector))
            XCTAssertFalse(controller.previewView.accessibilityPerformPress(), "Start text alone must not make a stopping card actionable")
            XCTAssertEqual(starts, 1)

            controller.previewView.prepareForLiveInteraction(sourceSize: CGSize(width: 160, height: 90))
            XCTAssertTrue(controller.previewView.isAccessibilityElement())
            XCTAssertTrue(NSAccessibility.unignoredChildren(
                from: contentView.accessibilityChildren() ?? []
            ).contains { ($0 as AnyObject) === controller.previewView })
            XCTAssertEqual(controller.previewView.accessibilityRole(), NSAccessibility.Role.image)
            XCTAssertFalse(controller.previewView.isAccessibilitySelectorAllowed(pressSelector))
            XCTAssertFalse(controller.previewView.accessibilityPerformPress())
            XCTAssertEqual(starts, 1)
            controller.close()
        }
    }

    func testTitlebarControlsAlignWithStandardWindowControlsAtNormalAndMinimumSizes() async {
        await MainActor.run {
            _ = NSApplication.shared
            let controller = DisplayPreviewWindowController(
                frame: NSRect(x: 0, y: 0, width: 480, height: 360),
                backgroundOpacity: 1,
                keepOnAllSpaces: true
            )
            guard let panel = controller.window as? NSPanel,
                  let frameView = panel.contentView?.superview,
                  let closeButton = panel.standardWindowButton(.closeButton),
                  let closeSuperview = closeButton.superview else {
                return XCTFail("Expected panel titlebar controls")
            }

            for size in [NSSize(width: 480, height: 360), panel.contentMinSize] {
                panel.setContentSize(size)
                frameView.layoutSubtreeIfNeeded()
                let closeRect = closeSuperview.convert(closeButton.frame, to: frameView)
                for title in ["Start", "Pause", "Resume"] {
                    controller.showStatus("State", buttonTitle: title, buttonEnabled: true, centerEnabled: false)
                    frameView.layoutSubtreeIfNeeded()
                    let buttons = panel.titlebarAccessoryViewControllers.flatMap {
                        descendants(of: $0.view, type: NSButton.self)
                    }
                    XCTAssertEqual(buttons.count, 2)
                    for button in buttons {
                        guard let superview = button.superview else { return XCTFail("Expected titlebar button container") }
                        let rect = superview.convert(button.frame, to: frameView)
                        XCTAssertEqual(rect.midY, closeRect.midY, accuracy: 0.5, "\(title) titlebar control is vertically misaligned")
                        XCTAssertLessThanOrEqual(rect.maxX, frameView.bounds.maxX, "\(title) titlebar control extends beyond the panel")
                    }
                }
            }
            controller.close()
        }
    }

    func testLiveResizeEmitsPlacementChangesBeforeResizeEnds() async {
        await MainActor.run {
            _ = NSApplication.shared
            let controller = DisplayPreviewWindowController(
                frame: NSRect(x: 0, y: 0, width: 480, height: 360),
                backgroundOpacity: 1,
                keepOnAllSpaces: true
            )
            var frameChanges = 0
            controller.onFrameChanged = { _ in frameChanges += 1 }
            let delegate: NSWindowDelegate = controller

            delegate.windowDidResize?(Notification(name: NSWindow.didResizeNotification, object: controller.window))

            XCTAssertEqual(frameChanges, 1, "Placement must be checked during live resize, not only after it ends")
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
