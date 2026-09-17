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
                "Choose a source display, then turn the preview on.",
                "Preview suspended while it overlaps the source display. Move it fully clear to resume."
            ] {
                controller.showStatus(
                    message,
                    powerState: .on,
                    powerEnabled: true,
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
                ("Click to see display", DisplayPreviewPowerState.off, true, false),
                ("Live: Built-in Display", DisplayPreviewPowerState.on, true, true),
                ("Paused.", DisplayPreviewPowerState.off, true, false),
                ("Capture stopped: unavailable", DisplayPreviewPowerState.off, false, false)
            ] {
                controller.showStatus(state.0, powerState: state.1, powerEnabled: state.2, centerEnabled: state.3)
                let accessoryButtons = panel.titlebarAccessoryViewControllers.flatMap {
                    descendants(of: $0.view, type: NSButton.self)
                }
                XCTAssertTrue(accessoryButtons.contains {
                    $0.identifier == DisplayPreviewWindowController.powerToggleIdentifier
                })
                XCTAssertTrue(accessibilityLabels(in: panel).contains("Display Preview status: \(state.0)"))
            }
            controller.close()
        }
    }

    func testPowerToggleIsImageOnlyAndExposesSemanticOnOffState() async {
        await MainActor.run {
            _ = NSApplication.shared
            let controller = DisplayPreviewWindowController(
                frame: NSRect(x: 0, y: 0, width: 480, height: 360),
                backgroundOpacity: 1,
                keepOnAllSpaces: true
            )
            guard let panel = controller.window as? NSPanel,
                  let powerButton = panel.titlebarAccessoryViewControllers.flatMap({
                    descendants(of: $0.view, type: NSButton.self)
                  }).first(where: { $0.identifier == DisplayPreviewWindowController.powerToggleIdentifier })
            else { return XCTFail("Expected Display power toggle") }
            var toggleCount = 0
            controller.onToggleCapture = { toggleCount += 1 }

            let states: [(String, DisplayPreviewPowerState, Bool, NSControl.StateValue, String)] = [
                ("Click to see display", .off, true, .off, "Turn preview on"),
                ("Starting…", .on, true, .on, "Turn preview off"),
                ("Live: Built-in Display", .on, true, .on, "Turn preview off"),
                ("Preview suspended while it overlaps the source display. Move it fully clear to resume.", .on, true, .on, "Turn preview off"),
                ("Paused.", .off, true, .off, "Turn preview on"),
                ("Capture stopped: unavailable", .off, false, .off, "Turn preview on"),
                ("Choose a source display, then turn the preview on.", .off, false, .off, "Turn preview on")
            ]

            for (message, powerState, enabled, expectedState, actionLabel) in states {
                controller.showStatus(
                    message,
                    powerState: powerState,
                    powerEnabled: enabled,
                    centerEnabled: false
                )
                XCTAssertEqual(powerButton.title, "", "Power toggle must never expose a visible text title")
                XCTAssertNotNil(powerButton.image)
                XCTAssertEqual(powerButton.imagePosition, .imageOnly)
                XCTAssertEqual(powerButton.state, expectedState)
                XCTAssertEqual(
                    powerButton.contentTintColor,
                    expectedState == .on ? NSColor.controlAccentColor : NSColor.secondaryLabelColor
                )
                XCTAssertEqual(powerButton.toolTip, actionLabel)
                XCTAssertEqual(powerButton.accessibilityLabel(), actionLabel)
                XCTAssertEqual(powerButton.accessibilityValue() as? String, expectedState == .on ? "On" : "Off")
                XCTAssertEqual(powerButton.isEnabled, enabled)
            }

            controller.showStatus("Click to see display", powerState: .off, powerEnabled: true, centerEnabled: false)
            powerButton.performClick(nil)
            controller.showStatus(
                "Preview suspended while it overlaps the source display. Move it fully clear to resume.",
                powerState: .on,
                powerEnabled: true,
                centerEnabled: false
            )
            powerButton.performClick(nil)
            controller.showStatus("Unavailable", powerState: .off, powerEnabled: false, centerEnabled: false)
            powerButton.performClick(nil)
            XCTAssertEqual(toggleCount, 2, "Each enabled power action must emit exactly one shared toggle callback")
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
            }.first { $0.identifier == DisplayPreviewWindowController.powerToggleIdentifier }
            let rawChildren = contentView.accessibilityChildren() ?? []
            let unignoredChildren = NSAccessibility.unignoredChildren(from: rawChildren)
            let pressSelector = NSSelectorFromString("accessibilityPerformPress")
            XCTAssertEqual(ready.powerState, .off)
            XCTAssertTrue(ready.powerEnabled)
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
                powerState: .off,
                powerEnabled: false,
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
                for powerState in [DisplayPreviewPowerState.off, .on] {
                    controller.showStatus("State", powerState: powerState, powerEnabled: true, centerEnabled: false)
                    frameView.layoutSubtreeIfNeeded()
                    let buttons = panel.titlebarAccessoryViewControllers.flatMap {
                        descendants(of: $0.view, type: NSButton.self)
                    }
                    XCTAssertEqual(buttons.count, 2)
                    for button in buttons {
                        guard let superview = button.superview else { return XCTFail("Expected titlebar button container") }
                        let rect = superview.convert(button.frame, to: frameView)
                        XCTAssertEqual(rect.midY, closeRect.midY, accuracy: 0.5, "Power titlebar control is vertically misaligned")
                        XCTAssertLessThanOrEqual(rect.maxX, frameView.bounds.maxX, "Power titlebar control extends beyond the panel")
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

    func testControlsMenuOffersAspectSnapOnlyForACurrentSource() async {
        await MainActor.run {
            _ = NSApplication.shared
            let controller = DisplayPreviewWindowController(
                frame: NSRect(x: 0, y: 0, width: 480, height: 360),
                backgroundOpacity: 1,
                keepOnAllSpaces: true
            )
            controller.setSources([], selectedID: nil)
            XCTAssertNil(controller.currentSourceAspect)
            let disabledMenu = controller.makeControlsMenu()
            guard let disabledItem = disabledMenu.items.first(where: { $0.title == "Match Display Aspect Ratio" })
            else { return XCTFail("Expected Match Display Aspect Ratio menu item") }
            XCTAssertFalse(disabledItem.isEnabled)
            XCTAssertFalse(controller.matchCurrentSourceAspect(animated: false))

            let source = DisplayDescriptor(
                id: 2,
                uuid: "DELL-P2217H",
                name: "DELL P2217H",
                bounds: CGRect(x: -212, y: -1080, width: 1920, height: 1080),
                isActive: true,
                mirrorMasterID: nil
            )
            controller.setSources([source], selectedID: source.id)
            let enabledMenu = controller.makeControlsMenu()
            guard let enabledItem = enabledMenu.items.first(where: { $0.title == "Match Display Aspect Ratio" })
            else { return XCTFail("Expected Match Display Aspect Ratio menu item") }
            XCTAssertTrue(enabledItem.isEnabled)
            XCTAssertEqual(controller.currentSourceAspect ?? 0, 1920.0 / 1080.0, accuracy: 0.0001)
            controller.close()
        }
    }

    func testAspectSnapMatchesSourceViewportAndLeavesUserResizeUnrestricted() async {
        await MainActor.run {
            _ = NSApplication.shared
            let controller = DisplayPreviewWindowController(
                frame: NSRect(x: 40, y: 60, width: 1198, height: 783),
                backgroundOpacity: 1,
                keepOnAllSpaces: true
            )
            guard let panel = controller.window as? NSPanel else { return XCTFail("Expected panel") }
            let source = DisplayDescriptor(
                id: 2,
                uuid: "DELL-P2217H",
                name: "DELL P2217H",
                bounds: CGRect(x: -212, y: -1080, width: 1920, height: 1080),
                isActive: true,
                mirrorMasterID: nil
            )
            controller.setSources([source], selectedID: source.id)

            XCTAssertTrue(controller.matchCurrentSourceAspect(animated: false))
            let snapped = controller.previewSize
            XCTAssertEqual(
                snapped.width / snapped.height,
                16.0 / 9.0,
                accuracy: 0.002,
                "The preview viewport, not the outer window rectangle, must match the source aspect"
            )
            XCTAssertEqual(
                controller.previewChromeHeight,
                panel.frame.height - snapped.height,
                accuracy: 0.5,
                "Titlebar and the 10 pt gap must stay outside the matched viewport"
            )
            XCTAssertEqual(
                (panel.contentView?.bounds.height ?? 0) - snapped.height,
                WidgetPanelContentLayout.topGap,
                accuracy: 0.5
            )
            let visibleFrame = (panel.screen ?? NSScreen.main)?.visibleFrame
            if let visibleFrame {
                XCTAssertGreaterThanOrEqual(snapped.width, panel.contentMinSize.width - 0.5)
                XCTAssertLessThanOrEqual(panel.frame.width, visibleFrame.width + 0.5)
                XCTAssertLessThanOrEqual(panel.frame.height, visibleFrame.height + 0.5)
            }

            // A user resize is never forced back onto the source aspect...
            panel.setFrame(
                NSRect(origin: panel.frame.origin, size: NSSize(width: 600, height: 500)),
                display: false
            )
            XCTAssertEqual(controller.previewSize.width, 600, accuracy: 1)
            XCTAssertNotEqual(
                controller.previewSize.width / controller.previewSize.height,
                16.0 / 9.0,
                accuracy: 0.01,
                "Unrestricted user resize must be able to letterbox"
            )
            let delegate: NSWindowDelegate = controller
            XCTAssertNil(
                delegate.windowWillResize?(panel, to: NSSize(width: 640, height: 640)),
                "The aspect snap must not install a persistent resize lock"
            )

            // ...until the menu action is used again.
            XCTAssertTrue(controller.matchCurrentSourceAspect(animated: false))
            XCTAssertEqual(
                controller.previewSize.width / controller.previewSize.height,
                16.0 / 9.0,
                accuracy: 0.002
            )
            controller.close()
        }
    }

    func testAspectSnapHonoursMinimumPreviewViewportForPortraitSource() async {
        await MainActor.run {
            _ = NSApplication.shared
            let controller = DisplayPreviewWindowController(
                frame: NSRect(x: 0, y: 0, width: 480, height: 360),
                backgroundOpacity: 1,
                keepOnAllSpaces: true
            )
            guard let panel = controller.window as? NSPanel else { return XCTFail("Expected panel") }
            let portrait = DisplayDescriptor(
                id: 3,
                uuid: "PORTRAIT-1080",
                name: "Portrait 1080",
                bounds: CGRect(x: 1512, y: -800, width: 1080, height: 1920),
                isActive: true,
                mirrorMasterID: nil
            )
            controller.setSources([portrait], selectedID: portrait.id)

            XCTAssertTrue(controller.matchCurrentSourceAspect(animated: false))
            let preview = controller.previewSize
            XCTAssertEqual(
                preview.width / preview.height,
                1080.0 / 1920.0,
                accuracy: 0.002,
                "Portrait sources must not be transposed"
            )
            let visibleFrame = (panel.screen ?? NSScreen.main)?.visibleFrame ?? panel.frame
            let maximumPreviewHeight = visibleFrame.height - controller.previewChromeHeight
            if maximumPreviewHeight >= panel.contentMinSize.height - WidgetPanelContentLayout.topGap {
                XCTAssertGreaterThanOrEqual(preview.width, panel.contentMinSize.width - 0.5)
                XCTAssertGreaterThanOrEqual(
                    preview.height,
                    panel.contentMinSize.height - WidgetPanelContentLayout.topGap - 0.5
                )
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
