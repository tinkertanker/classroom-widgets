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
            // NSMenu auto-validation would re-enable an item merely because its
            // target responds, so update() must leave it disabled.
            disabledMenu.update()
            guard let disabledItem = disabledMenu.items.first(where: { $0.title == "Match Display Aspect Ratio" })
            else { return XCTFail("Expected Match Display Aspect Ratio menu item") }
            XCTAssertFalse(disabledItem.isEnabled)
            XCTAssertTrue(disabledItem.target === controller)
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
            enabledMenu.update()
            guard let enabledItem = enabledMenu.items.first(where: { $0.title == "Match Display Aspect Ratio" })
            else { return XCTFail("Expected Match Display Aspect Ratio menu item") }
            XCTAssertTrue(enabledItem.isEnabled)
            XCTAssertEqual(controller.currentSourceAspect ?? 0, 1920.0 / 1080.0, accuracy: 0.0001)

            // Losing the source disables it again, even though the target still responds.
            controller.setSources([], selectedID: nil)
            enabledMenu.update()
            XCTAssertFalse(enabledItem.isEnabled)
            controller.close()
        }
    }

    func testAspectSnapMatchesSourceViewportAndResizeStaysAspectMatched() async {
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
            panel.contentView?.layoutSubtreeIfNeeded()
            XCTAssertEqual(
                controller.previewView.bounds.width,
                snapped.width,
                accuracy: 0.5,
                "The laid-out preview view must be the aspect-matched viewport"
            )
            XCTAssertEqual(controller.previewView.bounds.height, snapped.height, accuracy: 0.5)
            let visibleFrame = (panel.screen ?? NSScreen.main)?.visibleFrame
            if let visibleFrame {
                XCTAssertGreaterThanOrEqual(snapped.width, panel.contentMinSize.width - 0.5)
                XCTAssertLessThanOrEqual(panel.frame.width, visibleFrame.width + 0.5)
                XCTAssertLessThanOrEqual(panel.frame.height, visibleFrame.height + 0.5)
            }

            let delegate: NSWindowDelegate = controller

            // A selected source owns all production sizing, including frames the app sets
            // itself: the delegate callback does not cover setFrame, so the real
            // windowDidResize path must return the viewport to the smaller-fit ratio
            // without an unbounded correction loop.
            XCTAssertGreaterThan(panel.backingScaleFactor, 0)
            var frameCallbacks = 0
            controller.onFrameChanged = { _ in frameCallbacks += 1 }
            panel.setFrame(
                NSRect(origin: panel.frame.origin, size: NSSize(width: 600, height: 500)),
                display: false
            )
            delegate.windowDidResize?(Notification(name: NSWindow.didResizeNotification, object: panel))
            panel.contentView?.layoutSubtreeIfNeeded()

            let corrected = controller.previewSize
            XCTAssertEqual(corrected.width, 600, accuracy: 1)
            XCTAssertLessThanOrEqual(
                abs(corrected.height - 600.0 / (16.0 / 9.0)) * panel.backingScaleFactor,
                1 + 0.0001,
                "The corrected viewport must land within the measured single backing pixel of the source aspect"
            )
            XCTAssertLessThanOrEqual(
                frameCallbacks,
                2,
                "The programmatic correction must be bounded, not a resize loop"
            )

            // A settled size stays settled: further notifications must not re-correct it
            // or cascade extra callbacks. Each notification still reports the final frame,
            // which is the pre-existing live-resize placement contract.
            for _ in 0..<2 {
                let settled = controller.previewSize
                let callbacksBefore = frameCallbacks
                delegate.windowDidResize?(Notification(name: NSWindow.didResizeNotification, object: panel))
                XCTAssertEqual(controller.previewSize.width, settled.width, accuracy: 0.5)
                XCTAssertEqual(controller.previewSize.height, settled.height, accuracy: 0.5)
                XCTAssertLessThanOrEqual(
                    frameCallbacks - callbacksBefore,
                    1,
                    "A settled size must not re-correct or cascade callbacks"
                )
            }

            // User-driven resize is aspect-matched too: the callback must return a
            // constrained frame size, and a height-limited drag must narrow the window
            // rather than only its height.
            let heightLimited = NSSize(width: 700, height: 400)
            guard let constrained = delegate.windowWillResize?(panel, to: heightLimited) else {
                return XCTFail("A user resize must be aspect-constrained while a source is selected")
            }
            assertViewport(
                constrained,
                matches: fittedPreviewViewport(proposingFrameSize: heightLimited, in: panel, aspect: 16.0 / 9.0),
                in: panel
            )
            XCTAssertLessThan(
                constrained.width,
                heightLimited.width,
                "A height-limited drag must narrow the window, not only its height"
            )
            XCTAssertLessThanOrEqual(constrained.height, heightLimited.height)

            // The menu action stays a one-shot re-snap of the same contract. The 600 pt
            // width asks for a 337.5 pt viewport, which the window server cannot land
            // on: it snaps the outer height to the point grid. Measured on a 2x panel on
            // 2026-09-17: requested outer 600x379.5 settles at 600x380 /
            // content 600x348 / preview 600x338, i.e. exactly one backing pixel of
            // aspect error, identical for setFrame and setContentSize.
            XCTAssertTrue(controller.matchCurrentSourceAspect(animated: false))
            let idealPreviewHeight = 600.0 / (16.0 / 9.0)
            let backingScale = panel.backingScaleFactor
            XCTAssertGreaterThan(backingScale, 0)
            XCTAssertEqual(controller.previewSize.width, 600, accuracy: 0.5)
            XCTAssertEqual(
                controller.previewSize.height,
                idealPreviewHeight.rounded(),
                accuracy: 1.0 / backingScale + 0.0001,
                "The viewport height must be the integral point neighbour of the ideal 337.5 pt"
            )
            XCTAssertLessThanOrEqual(
                abs(controller.previewSize.height - idealPreviewHeight) * backingScale,
                1 + 0.0001,
                "The residual aspect error must stay within the single backing pixel that point quantization costs"
            )
            panel.contentView?.layoutSubtreeIfNeeded()
            XCTAssertEqual(controller.previewView.bounds.width, 600, accuracy: 0.5)
            XCTAssertLessThanOrEqual(
                abs(controller.previewView.bounds.height - idealPreviewHeight) * backingScale,
                1 + 0.0001,
                "The laid-out preview view must carry the same quantized viewport height"
            )
            controller.close()
        }
    }

    func testAspectSnapIsExactForAnExactlyRepresentableViewport() async {
        await MainActor.run {
            _ = NSApplication.shared
            let controller = DisplayPreviewWindowController(
                frame: NSRect(x: 100, y: 100, width: 608, height: 500),
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

            // 608 pt is exactly representable at 16:9, so a correct snap lands on
            // the integral viewport with no quantization slack: preview 608x342 and
            // outer 608x384. A snap that used the outer window rectangle, dropped
            // the titlebar or the 10 pt gap, or never resized cannot reach 342.
            XCTAssertEqual(608.0 * 9.0 / 16.0, 342.0, accuracy: 0.0001)

            XCTAssertTrue(controller.matchCurrentSourceAspect(animated: false))

            XCTAssertEqual(controller.previewSize.width, 608, accuracy: 0.01)
            XCTAssertEqual(controller.previewSize.height, 342, accuracy: 0.01)
            panel.contentView?.layoutSubtreeIfNeeded()
            XCTAssertEqual(controller.previewView.bounds.width, 608, accuracy: 0.01)
            XCTAssertEqual(controller.previewView.bounds.height, 342, accuracy: 0.01)
            XCTAssertEqual(
                controller.previewSize.width / controller.previewSize.height,
                16.0 / 9.0,
                accuracy: 0.0001,
                "An exactly representable viewport must match the source aspect tightly"
            )
            XCTAssertGreaterThan(
                controller.previewChromeHeight,
                WidgetPanelContentLayout.topGap,
                "The sizing math must carry the native titlebar as well as the 10 pt gap"
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
            panel.contentView?.layoutSubtreeIfNeeded()
            XCTAssertEqual(controller.previewView.bounds.width, preview.width, accuracy: 0.5)
            XCTAssertEqual(controller.previewView.bounds.height, preview.height, accuracy: 0.5)
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

    // MARK: - Aspect-matched user resize (preview viewport)

    func testResizeConstraintUsesTheSmallerFitScaleForBothProposalShapes() async {
        await MainActor.run {
            _ = NSApplication.shared
            let controller = DisplayPreviewWindowController(
                frame: NSRect(x: 100, y: 100, width: 900, height: 700),
                backgroundOpacity: 1,
                keepOnAllSpaces: true
            )
            guard let panel = controller.window as? NSPanel else { return XCTFail("Expected panel") }
            let delegate: NSWindowDelegate = controller
            controller.setSources([landscape16x9], selectedID: landscape16x9.id)

            // Width-limited: the proposed height has slack, so the width survives.
            let widthLimited = NSSize(width: 800, height: 500)
            guard let wide = delegate.windowWillResize?(panel, to: widthLimited) else {
                return XCTFail("A user resize with a selected source must be aspect-constrained")
            }
            assertViewport(
                wide,
                matches: fittedPreviewViewport(proposingFrameSize: widthLimited, in: panel, aspect: 16.0 / 9.0),
                in: panel
            )

            // Height-limited: a width-only rule would keep 800 pt, so the width must
            // shrink here instead of the height being stretched or cropped.
            let heightLimited = NSSize(width: 800, height: 400)
            guard let tall = delegate.windowWillResize?(panel, to: heightLimited) else {
                return XCTFail("A user resize with a selected source must be aspect-constrained")
            }
            assertViewport(
                tall,
                matches: fittedPreviewViewport(proposingFrameSize: heightLimited, in: panel, aspect: 16.0 / 9.0),
                in: panel
            )
            XCTAssertLessThan(
                tall.width,
                heightLimited.width,
                "A height-limited drag must narrow the window, not only its height"
            )
            XCTAssertLessThanOrEqual(tall.height, heightLimited.height)
            controller.close()
        }
    }

    func testResizeConstraintIsExactForAnExactlyRepresentableViewport() async {
        await MainActor.run {
            _ = NSApplication.shared
            let controller = DisplayPreviewWindowController(
                frame: NSRect(x: 100, y: 100, width: 900, height: 700),
                backgroundOpacity: 1,
                keepOnAllSpaces: true
            )
            guard let panel = controller.window as? NSPanel else { return XCTFail("Expected panel") }
            let delegate: NSWindowDelegate = controller
            controller.setSources([landscape16x9], selectedID: landscape16x9.id)

            // 608 pt is exactly representable at 16:9, so the constrained frame must
            // carry a 608x342 viewport with no quantization slack.
            let proposed = NSSize(width: 608, height: 500)
            guard let constrained = delegate.windowWillResize?(panel, to: proposed) else {
                return XCTFail("A user resize with a selected source must be aspect-constrained")
            }
            let viewport = previewViewport(forFrameSize: constrained, in: panel)
            XCTAssertEqual(viewport.width, 608, accuracy: 0.01)
            XCTAssertEqual(viewport.height, 342, accuracy: 0.01)

            // The returned size is a window frame: the native titlebar and the shared
            // 10 pt gap stay outside the matched viewport.
            let expectedFrame = panel.frameRect(
                forContentRect: NSRect(
                    origin: .zero,
                    size: NSSize(width: 608, height: 342 + WidgetPanelContentLayout.topGap)
                )
            ).size
            XCTAssertEqual(constrained.width, expectedFrame.width, accuracy: 0.01)
            XCTAssertEqual(constrained.height, expectedFrame.height, accuracy: 0.01)
            controller.close()
        }
    }

    func testResizeConstraintFitsPortraitWithoutTransposing() async {
        await MainActor.run {
            _ = NSApplication.shared
            let controller = DisplayPreviewWindowController(
                frame: NSRect(x: 100, y: 100, width: 900, height: 700),
                backgroundOpacity: 1,
                keepOnAllSpaces: true
            )
            guard let panel = controller.window as? NSPanel else { return XCTFail("Expected panel") }
            let delegate: NSWindowDelegate = controller
            controller.setSources([portrait9x16], selectedID: portrait9x16.id)

            let proposed = NSSize(width: 500, height: 900)
            guard let constrained = delegate.windowWillResize?(panel, to: proposed) else {
                return XCTFail("A user resize with a selected source must be aspect-constrained")
            }
            let viewport = previewViewport(forFrameSize: constrained, in: panel)
            XCTAssertEqual(viewport.width / viewport.height, 1080.0 / 1920.0, accuracy: 0.01)
            XCTAssertLessThan(viewport.width, viewport.height, "A portrait source must not be transposed")
            XCTAssertLessThan(
                constrained.width,
                proposed.width,
                "A height-limited portrait drag must narrow the window"
            )
            controller.close()
        }
    }

    func testResizeConstraintHonoursMinimumAndScreenSafetyLimits() async {
        await MainActor.run {
            _ = NSApplication.shared
            let controller = DisplayPreviewWindowController(
                frame: NSRect(x: 100, y: 100, width: 900, height: 700),
                backgroundOpacity: 1,
                keepOnAllSpaces: true
            )
            guard let panel = controller.window as? NSPanel else { return XCTFail("Expected panel") }
            let delegate: NSWindowDelegate = controller
            controller.setSources([landscape16x9], selectedID: landscape16x9.id)

            // An undersized drag expands uniformly until the native minimum is met, so
            // the ratio survives and the proposal may be exceeded. Per-axis flooring
            // would break the ratio here, and letterboxing is reserved for a genuine
            // minimum-versus-physical-screen incompatibility.
            let tiny = NSSize(width: 200, height: 150)
            guard let floored = delegate.windowWillResize?(panel, to: tiny) else {
                return XCTFail("A user resize with a selected source must be aspect-constrained")
            }
            let flooredViewport = previewViewport(forFrameSize: floored, in: panel)
            XCTAssertGreaterThanOrEqual(flooredViewport.width, panel.contentMinSize.width - 0.5)
            XCTAssertGreaterThanOrEqual(
                flooredViewport.height,
                panel.contentMinSize.height - WidgetPanelContentLayout.topGap - 0.5
            )
            XCTAssertEqual(
                flooredViewport.width / flooredViewport.height,
                16.0 / 9.0,
                accuracy: 0.01,
                "The native minimum must be met by uniform expansion, not per-axis flooring"
            )

            // Above the minimum the fit never grows either proposed dimension.
            let roomy = NSSize(width: 900, height: 700)
            guard let fitted = delegate.windowWillResize?(panel, to: roomy) else {
                return XCTFail("A user resize with a selected source must be aspect-constrained")
            }
            XCTAssertLessThanOrEqual(fitted.width, roomy.width + 0.5)
            XCTAssertLessThanOrEqual(fitted.height, roomy.height + 0.5)
            let fittedViewport = previewViewport(forFrameSize: fitted, in: panel)
            XCTAssertEqual(fittedViewport.width / fittedViewport.height, 16.0 / 9.0, accuracy: 0.01)

            // On-screen bounds remain a safety limit even for an oversized proposal.
            if let screen = panel.screen ?? NSScreen.main {
                let oversized = NSSize(
                    width: screen.visibleFrame.width + 400,
                    height: screen.visibleFrame.height + 400
                )
                guard let clamped = delegate.windowWillResize?(panel, to: oversized) else {
                    return XCTFail("A user resize with a selected source must be aspect-constrained")
                }
                XCTAssertLessThanOrEqual(clamped.width, screen.visibleFrame.width + 0.5)
                XCTAssertLessThanOrEqual(clamped.height, screen.visibleFrame.height + 0.5)
                let clampedViewport = previewViewport(forFrameSize: clamped, in: panel)
                XCTAssertEqual(
                    clampedViewport.width / clampedViewport.height,
                    16.0 / 9.0,
                    accuracy: 0.01,
                    "A screen clamp must preserve the aspect instead of cropping"
                )
            }
            controller.close()
        }
    }

    func testResizeConstraintDoesNotInventARatioWithoutAValidSource() async {
        await MainActor.run {
            _ = NSApplication.shared
            let controller = DisplayPreviewWindowController(
                frame: NSRect(x: 100, y: 100, width: 900, height: 700),
                backgroundOpacity: 1,
                keepOnAllSpaces: true
            )
            guard let panel = controller.window as? NSPanel else { return XCTFail("Expected panel") }
            let delegate: NSWindowDelegate = controller
            let proposed = NSSize(width: 700, height: 500)

            controller.setSources([], selectedID: nil)
            XCTAssertNil(controller.currentSourceAspect)
            let unconstrained = delegate.windowWillResize?(panel, to: proposed)
            XCTAssertTrue(
                unconstrained == nil || unconstrained == proposed,
                "No source must not impose an invented ratio"
            )

            let zeroSized = DisplayDescriptor(
                id: 9,
                uuid: "ZERO",
                name: "Zero",
                bounds: .zero,
                isActive: true,
                mirrorMasterID: nil
            )
            controller.setSources([zeroSized], selectedID: zeroSized.id)
            XCTAssertNil(controller.currentSourceAspect)
            let stillUnconstrained = delegate.windowWillResize?(panel, to: proposed)
            XCTAssertTrue(
                stillUnconstrained == nil || stillUnconstrained == proposed,
                "An invalid aspect must not impose an invented ratio"
            )
            controller.close()
        }
    }

    func testChangingTheSelectedSourceRenormalizesTheViewportWithoutChurn() async {
        await MainActor.run {
            _ = NSApplication.shared
            // 608 pt is exactly representable at 16:9, so the setup viewport is exact
            // and any drift below belongs to the source change under test rather than
            // to AppKit quantizing a fractional setup frame.
            let controller = DisplayPreviewWindowController(
                frame: NSRect(x: 100, y: 100, width: 608, height: 500),
                backgroundOpacity: 1,
                keepOnAllSpaces: true
            )
            guard let panel = controller.window as? NSPanel else { return XCTFail("Expected panel") }
            controller.setSources([landscape16x9], selectedID: landscape16x9.id)
            XCTAssertTrue(controller.matchCurrentSourceAspect(animated: false))
            XCTAssertEqual(controller.previewSize.width, 608, accuracy: 0.01)
            XCTAssertEqual(controller.previewSize.height, 342, accuracy: 0.01)
            XCTAssertEqual(
                controller.previewSize.width / controller.previewSize.height,
                16.0 / 9.0,
                accuracy: 0.002
            )

            // Switching to a portrait source must not leave the old ratio behind until
            // the next manual resize.
            controller.setSources([portrait9x16], selectedID: portrait9x16.id)
            panel.contentView?.layoutSubtreeIfNeeded()
            XCTAssertEqual(
                controller.previewSize.width / controller.previewSize.height,
                1080.0 / 1920.0,
                accuracy: 0.002,
                "A source change must re-normalize the viewport aspect"
            )

            // A resolution change on the same display is an aspect change too, so the
            // viewport must re-normalize even though the display ID is unchanged.
            let resizedSameDisplay = DisplayDescriptor(
                id: portrait9x16.id,
                uuid: portrait9x16.uuid,
                name: portrait9x16.name,
                bounds: CGRect(x: 1512, y: -800, width: 1600, height: 1200),
                isActive: true,
                mirrorMasterID: nil
            )
            controller.setSources([resizedSameDisplay], selectedID: resizedSameDisplay.id)
            panel.contentView?.layoutSubtreeIfNeeded()
            XCTAssertEqual(
                controller.previewSize.width / controller.previewSize.height,
                4.0 / 3.0,
                accuracy: 0.002,
                "An aspect change on the same display must re-normalize"
            )

            // Repeated same-source refreshes must not churn the window or frame callbacks.
            var frameCallbacks = 0
            controller.onFrameChanged = { _ in frameCallbacks += 1 }
            let settled = controller.previewSize
            controller.setSources([resizedSameDisplay], selectedID: resizedSameDisplay.id)
            controller.setSources([resizedSameDisplay], selectedID: resizedSameDisplay.id)
            XCTAssertEqual(frameCallbacks, 0, "An unchanged source must not resize or notify")
            XCTAssertEqual(controller.previewSize.width, settled.width, accuracy: 0.5)
            XCTAssertEqual(controller.previewSize.height, settled.height, accuracy: 0.5)
            controller.close()
        }
    }

    func testResizeConstraintIsIdempotent() async {
        await MainActor.run {
            _ = NSApplication.shared
            let controller = DisplayPreviewWindowController(
                frame: NSRect(x: 100, y: 100, width: 900, height: 700),
                backgroundOpacity: 1,
                keepOnAllSpaces: true
            )
            guard let panel = controller.window as? NSPanel else { return XCTFail("Expected panel") }
            let delegate: NSWindowDelegate = controller
            controller.setSources([landscape16x9], selectedID: landscape16x9.id)

            let proposed = NSSize(width: 700, height: 400)
            guard let once = delegate.windowWillResize?(panel, to: proposed) else {
                return XCTFail("A user resize with a selected source must be aspect-constrained")
            }
            guard let twice = delegate.windowWillResize?(panel, to: once) else {
                return XCTFail("A user resize with a selected source must be aspect-constrained")
            }
            XCTAssertEqual(
                twice.width,
                once.width,
                accuracy: 0.001,
                "The pure constraint must be numerically idempotent; no rasterization happens inside it"
            )
            XCTAssertEqual(twice.height, once.height, accuracy: 0.001)
            controller.close()
        }
    }

    func testSourceSelectionIsAcceptedBeforeAnyAspectResizeCallback() async {
        await MainActor.run {
            _ = NSApplication.shared
            let controller = DisplayPreviewWindowController(
                frame: NSRect(x: 100, y: 100, width: 608, height: 500),
                backgroundOpacity: 1,
                keepOnAllSpaces: true
            )
            guard let panel = controller.window as? NSPanel else { return XCTFail("Expected panel") }
            controller.setSources([landscape16x9, portrait9x16], selectedID: landscape16x9.id)
            var order: [String] = []
            controller.onSourceSelected = { _ in order.append("source") }
            controller.onFrameChanged = { _ in order.append("frame") }

            let menu = controller.makeControlsMenu()
            guard let item = menu.items.first(where: {
                ($0.representedObject as? NSNumber)?.uint32Value == portrait9x16.id
            }) else { return XCTFail("Expected a source menu item for the portrait display") }
            guard let action = item.action else { return XCTFail("Expected a source action") }
            XCTAssertTrue(NSApp.sendAction(action, to: item.target, from: item))

            // The coordinator's persist and placement validation run from
            // onFrameChanged, so the new selection must be accepted first.
            XCTAssertEqual(
                order.first,
                "source",
                "The coordinator must accept the selection before any resize callback"
            )
            XCTAssertEqual(order.filter { $0 == "source" }.count, 1)
            XCTAssertEqual(
                controller.previewSize.width / controller.previewSize.height,
                1080.0 / 1920.0,
                accuracy: 0.002,
                "The source change must re-fit the viewport"
            )
            controller.close()
        }
    }

    func testSourceMenuSelectionRenormalizesTheViewport() async {
        await MainActor.run {
            _ = NSApplication.shared
            let controller = DisplayPreviewWindowController(
                frame: NSRect(x: 100, y: 100, width: 900, height: 700),
                backgroundOpacity: 1,
                keepOnAllSpaces: true
            )
            guard let panel = controller.window as? NSPanel else { return XCTFail("Expected panel") }
            controller.setSources([landscape16x9, portrait9x16], selectedID: landscape16x9.id)
            XCTAssertTrue(controller.matchCurrentSourceAspect(animated: false))
            var selected: CGDirectDisplayID?
            controller.onSourceSelected = { selected = $0 }

            let menu = controller.makeControlsMenu()
            guard let item = menu.items.first(where: {
                ($0.representedObject as? NSNumber)?.uint32Value == portrait9x16.id
            }) else { return XCTFail("Expected a source menu item for the portrait display") }
            guard let action = item.action else { return XCTFail("Expected a source action") }
            XCTAssertTrue(
                NSApp.sendAction(action, to: item.target, from: item),
                "Fixture: the source menu item must dispatch to its target"
            )

            XCTAssertEqual(selected, portrait9x16.id)
            panel.contentView?.layoutSubtreeIfNeeded()
            XCTAssertEqual(
                controller.previewSize.width / controller.previewSize.height,
                1080.0 / 1920.0,
                accuracy: 0.002,
                "Choosing a source from the menu must re-normalize the viewport aspect"
            )
            controller.close()
        }
    }

    // MARK: - Aspect fixtures and independent geometry helpers

    private var landscape16x9: DisplayDescriptor {
        DisplayDescriptor(
            id: 2,
            uuid: "DELL-P2217H",
            name: "DELL P2217H",
            bounds: CGRect(x: -212, y: -1080, width: 1920, height: 1080),
            isActive: true,
            mirrorMasterID: nil
        )
    }

    private var portrait9x16: DisplayDescriptor {
        DisplayDescriptor(
            id: 3,
            uuid: "PORTRAIT-1080",
            name: "Portrait 1080",
            bounds: CGRect(x: 1512, y: -800, width: 1080, height: 1920),
            isActive: true,
            mirrorMasterID: nil
        )
    }

    /// AppKit-derived preview viewport for a window frame size: the content rect minus
    /// the shared 10 pt gap. Deliberately independent of the production chrome formula
    /// so a dropped titlebar or gap cannot pass.
    @MainActor
    private func previewViewport(forFrameSize size: NSSize, in panel: NSPanel) -> NSSize {
        let content = panel.contentRect(forFrameRect: NSRect(origin: .zero, size: size)).size
        return NSSize(width: content.width, height: content.height - WidgetPanelContentLayout.topGap)
    }

    /// Smaller-scale fit of a source aspect inside the proposed viewport. When the fit
    /// falls under the native minimum the minimum wins by uniform expansion, so the
    /// ratio survives even though an undersized proposal is exceeded. Letterboxing is
    /// reserved for the genuine minimum-versus-physical-screen incompatibility handled
    /// by the one-shot geometry helper.
    @MainActor
    private func fittedPreviewViewport(
        proposingFrameSize size: NSSize,
        in panel: NSPanel,
        aspect: CGFloat
    ) -> NSSize {
        let proposed = previewViewport(forFrameSize: size, in: panel)
        let minimum = NSSize(
            width: panel.contentMinSize.width,
            height: panel.contentMinSize.height - WidgetPanelContentLayout.topGap
        )
        let scale = min(proposed.width / aspect, proposed.height)
        var width = aspect * scale
        var height = scale
        if width < minimum.width || height < minimum.height {
            let minimumScale = max(minimum.width / aspect, minimum.height)
            width = aspect * minimumScale
            height = minimumScale
        }
        return NSSize(width: width, height: height)
    }

    @MainActor
    private func assertViewport(
        _ frameSize: NSSize,
        matches expected: NSSize,
        in panel: NSPanel,
        accuracy: CGFloat = 0.5,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let actual = previewViewport(forFrameSize: frameSize, in: panel)
        XCTAssertEqual(actual.width, expected.width, accuracy: accuracy, file: file, line: line)
        XCTAssertEqual(actual.height, expected.height, accuracy: accuracy, file: file, line: line)
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
