import AppKit
import CoreMedia
import CoreVideo
import XCTest
@testable import ClassroomWidgets

final class DisplayPreviewInteractionTests: XCTestCase {
    func testStaticFrameKeepsCurrentPointerGeometryAfterWindowResize() async throws {
        try await MainActor.run {
            _ = NSApplication.shared
            let controller = try makePresentedFrameFixture()
            defer { controller.close() }
            let window = try XCTUnwrap(controller.window)
            let fixture = (window: window, view: controller.previewView)
            var targets: [CGPoint] = []
            fixture.view.onCompletedPrimaryClick = { [weak controller] point, _ in
                guard let geometry = controller?.presentedGeometry,
                      let target = DisplayPreviewGeometry.target(
                        topLeftPoint: point, geometry: geometry, currentTopologyRevision: 11
                      ) else { return }
                targets.append(target)
            }

            mouseDown(fixture, at: NSPoint(x: 40, y: 40))
            window.setContentSize(NSSize(width: 800, height: 460))
            window.contentView?.layoutSubtreeIfNeeded()
            mouseUp(fixture, at: NSPoint(x: 40, y: 40))
            XCTAssertTrue(targets.isEmpty, "A gesture spanning layout must still be cancelled")

            // No second frame arrives: an unchanged display can stay idle indefinitely.
            let geometry = try XCTUnwrap(controller.presentedGeometry)
            XCTAssertEqual(geometry.imageRect, CGRect(x: 0, y: 0, width: 800, height: 450))
            XCTAssertEqual(geometry.sourceID, 42)
            XCTAssertEqual(geometry.topologyRevision, 11)
            XCTAssertEqual(geometry.sourceBounds, CGRect(x: -1920, y: 120, width: 1920, height: 1080))
            click(fixture, at: NSPoint(x: 200, y: 112.5))
            XCTAssertEqual(targets, [CGPoint(x: -1440, y: 930)])
            XCTAssertEqual(
                DisplayPreviewGeometry.target(
                    topLeftPoint: CGPoint(x: 400, y: 225), geometry: geometry, currentTopologyRevision: 11
                ),
                CGPoint(x: -960, y: 660),
                "The same retained source geometry must remain available for moving to center"
            )
            XCTAssertNil(DisplayPreviewGeometry.target(
                topLeftPoint: CGPoint(x: 400, y: 225), geometry: geometry, currentTopologyRevision: 12
            ), "Layout must not grant authority to a different topology")
        }
    }

    func testLayoutNeverRestoresStaleClearedOrInvalidatedFrameGeometry() async throws {
        try await MainActor.run {
            _ = NSApplication.shared
            for invalidation in ["stale", "cleared", "sourceChanged", "unauthorized"] {
                let controller = try makePresentedFrameFixture()
                defer { controller.close() }
                switch invalidation {
                case "stale": controller.previewView.setImageStale(true)
                case "cleared": controller.clearFrame()
                case "sourceChanged":
                    controller.previewView.prepareForLiveInteraction(sourceSize: CGSize(width: 90, height: 160))
                default: controller.presentedGeometry = nil
                }
                controller.window?.setContentSize(NSSize(width: 800, height: 460))
                controller.window?.contentView?.layoutSubtreeIfNeeded()
                XCTAssertNil(controller.presentedGeometry, "Layout must not restore \(invalidation) geometry")
            }
        }
    }

    func testIdlePrimaryClickStartsButDragModifiedAndDisabledClicksDoNot() async {
        await MainActor.run {
            _ = NSApplication.shared
            let fixture = makeFixture()
            var idleStarts = 0
            var liveClicks = 0
            fixture.view.onIdlePrimaryClick = { idleStarts += 1 }
            fixture.view.onCompletedPrimaryClick = { _, _ in liveClicks += 1 }
            fixture.view.setIdleStartEnabled(true)

            click(fixture, at: NSPoint(x: 80, y: 40))
            XCTAssertEqual(idleStarts, 1)
            XCTAssertEqual(liveClicks, 0)
            idleStarts = 0

            mouseDown(fixture, at: NSPoint(x: 80, y: 40))
            fixture.view.mouseDragged(with: event(.leftMouseDragged, fixture: fixture, at: NSPoint(x: 90, y: 40)))
            mouseUp(fixture, at: NSPoint(x: 90, y: 40))
            XCTAssertEqual(idleStarts, 0)

            click(fixture, at: NSPoint(x: 80, y: 40), modifiers: .command)
            XCTAssertEqual(idleStarts, 0)

            fixture.view.setIdleStartEnabled(false)
            click(fixture, at: NSPoint(x: 80, y: 40))
            XCTAssertEqual(idleStarts, 0)

            fixture.view.setIdleStartEnabled(true)
            click(fixture, at: NSPoint(x: -1, y: 40))
            mouseDown(fixture, at: NSPoint(x: 1, y: 40))
            mouseUp(fixture, at: NSPoint(x: -1, y: 40))
            XCTAssertEqual(idleStarts, 0, "Idle activation must begin and end inside the preview")
            fixture.window.close()
        }
    }

    func testLivePrimaryClickRetainsGeometryTokenAndNeverStartsIdleCapture() async {
        await MainActor.run {
            _ = NSApplication.shared
            let fixture = makeFixture()
            var idleStarts = 0
            var completed: [(CGPoint, UInt64)] = []
            fixture.view.onIdlePrimaryClick = { idleStarts += 1 }
            fixture.view.onCompletedPrimaryClick = { completed.append(($0, $1)) }
            fixture.view.setIdleStartEnabled(true)
            fixture.view.prepareForLiveInteraction(sourceSize: CGSize(width: 160, height: 90))

            click(fixture, at: NSPoint(x: 40, y: 20))

            XCTAssertEqual(idleStarts, 0)
            XCTAssertEqual(completed.count, 1)
            XCTAssertEqual(completed[0].0, CGPoint(x: 40, y: 70))
            XCTAssertEqual(completed[0].1, fixture.view.geometryToken)
            fixture.window.close()
        }
    }

    func testCapsLockDoesNotBlockIdlePrimaryClick() async {
        await MainActor.run {
            _ = NSApplication.shared
            let fixture = makeFixture()
            defer { fixture.window.close() }
            var idleStarts = 0
            var liveClicks = 0
            fixture.view.onIdlePrimaryClick = { idleStarts += 1 }
            fixture.view.onCompletedPrimaryClick = { _, _ in liveClicks += 1 }
            fixture.view.setIdleStartEnabled(true)

            click(fixture, at: NSPoint(x: 80, y: 40), modifiers: .capsLock)

            XCTAssertEqual(idleStarts, 1, "Caps Lock is a typing state, not a modified click")
            XCTAssertEqual(liveClicks, 0)
        }
    }

    func testCapsLockDoesNotBlockLivePrimaryClick() async {
        await MainActor.run {
            _ = NSApplication.shared
            let fixture = makeFixture()
            defer { fixture.window.close() }
            var idleStarts = 0
            var completed: [(CGPoint, UInt64)] = []
            fixture.view.onIdlePrimaryClick = { idleStarts += 1 }
            fixture.view.onCompletedPrimaryClick = { completed.append(($0, $1)) }
            fixture.view.prepareForLiveInteraction(sourceSize: CGSize(width: 160, height: 90))

            click(fixture, at: NSPoint(x: 40, y: 20), modifiers: .capsLock)

            XCTAssertEqual(idleStarts, 0)
            XCTAssertEqual(completed.count, 1)
            XCTAssertEqual(completed.first?.0, CGPoint(x: 40, y: 70))
            XCTAssertEqual(completed.first?.1, fixture.view.geometryToken)
        }
    }

    func testClickModifiersStillBlockIdleAndLiveClicksWithCapsLock() async {
        await MainActor.run {
            _ = NSApplication.shared
            let modifiers: [NSEvent.ModifierFlags] = [.command, .option, .control, .shift, .function]
            for live in [false, true] {
                let fixture = makeFixture()
                defer { fixture.window.close() }
                var idleStarts = 0
                var liveClicks = 0
                fixture.view.onIdlePrimaryClick = { idleStarts += 1 }
                fixture.view.onCompletedPrimaryClick = { _, _ in liveClicks += 1 }
                if live {
                    fixture.view.prepareForLiveInteraction(sourceSize: CGSize(width: 160, height: 90))
                } else {
                    fixture.view.setIdleStartEnabled(true)
                }

                for modifier in modifiers {
                    let flags = modifier.union(.capsLock)
                    let point = NSPoint(x: 40, y: 20)
                    click(fixture, at: point, modifiers: flags)
                    mouseDown(fixture, at: point, modifiers: .capsLock)
                    mouseUp(fixture, at: point, modifiers: flags)
                    mouseDown(fixture, at: point, modifiers: flags)
                    mouseUp(fixture, at: point, modifiers: .capsLock)

                    XCTAssertEqual(idleStarts, 0, "A click modifier at either edge must block idle activation")
                    XCTAssertEqual(liveClicks, 0, "A click modifier at either edge must block pointer movement")
                }
            }
        }
    }

    func testGeometryAndModeTransitionsInvalidatePendingClicks() async {
        await MainActor.run {
            _ = NSApplication.shared
            let fixture = makeFixture()
            var idleStarts = 0
            var liveClicks = 0
            fixture.view.onIdlePrimaryClick = { idleStarts += 1 }
            fixture.view.onCompletedPrimaryClick = { _, _ in liveClicks += 1 }
            fixture.view.prepareForLiveInteraction(sourceSize: CGSize(width: 160, height: 90))

            mouseDown(fixture, at: NSPoint(x: 40, y: 20))
            fixture.view.layout()
            mouseUp(fixture, at: NSPoint(x: 40, y: 20))
            XCTAssertEqual(liveClicks, 0)

            mouseDown(fixture, at: NSPoint(x: 40, y: 20))
            fixture.view.prepareForLiveInteraction(sourceSize: CGSize(width: 120, height: 90))
            mouseUp(fixture, at: NSPoint(x: 40, y: 20))
            XCTAssertEqual(liveClicks, 0)

            fixture.view.clear()
            fixture.view.setIdleStartEnabled(true)
            mouseDown(fixture, at: NSPoint(x: 40, y: 20))
            fixture.view.setIdleStartEnabled(false)
            mouseUp(fixture, at: NSPoint(x: 40, y: 20))
            XCTAssertEqual(idleStarts, 0)
            XCTAssertEqual(liveClicks, 0)

            fixture.view.setIdleStartEnabled(true)
            mouseDown(fixture, at: NSPoint(x: 40, y: 20))
            fixture.view.prepareForLiveInteraction(sourceSize: CGSize(width: 160, height: 90))
            mouseUp(fixture, at: NSPoint(x: 40, y: 20))
            XCTAssertEqual(idleStarts, 0)
            XCTAssertEqual(liveClicks, 0)
            fixture.window.close()
        }
    }

    func testHeldStaleImageStopsAdvertisingLiveAndBlocksPointerActions() async {
        await MainActor.run {
            _ = NSApplication.shared
            let fixture = makeFixture()
            var idleStarts = 0
            var liveClicks = 0
            fixture.view.onIdlePrimaryClick = { idleStarts += 1 }
            fixture.view.onCompletedPrimaryClick = { _, _ in liveClicks += 1 }
            fixture.view.setIdleStartEnabled(true)
            fixture.view.prepareForLiveInteraction(sourceSize: CGSize(width: 160, height: 90))
            XCTAssertEqual(fixture.view.accessibilityLabel(), "Live image of the selected display")

            click(fixture, at: NSPoint(x: 40, y: 20))
            XCTAssertEqual(liveClicks, 1)

            fixture.view.setImageStale(true)
            XCTAssertEqual(fixture.view.accessibilityRole(), NSAccessibility.Role.image)
            XCTAssertNotEqual(
                fixture.view.accessibilityLabel(),
                "Live image of the selected display",
                "A held image must not keep claiming to be live"
            )
            XCTAssertNil(
                fixture.view.fittedImageRectTopLeft(),
                "Stale geometry must not accept pointer actions"
            )
            click(fixture, at: NSPoint(x: 40, y: 20))
            XCTAssertEqual(liveClicks, 1, "Stale pointer actions must stay blocked")
            XCTAssertEqual(idleStarts, 0)

            fixture.view.prepareForLiveInteraction(sourceSize: CGSize(width: 160, height: 90))
            XCTAssertEqual(fixture.view.accessibilityLabel(), "Live image of the selected display")
            click(fixture, at: NSPoint(x: 40, y: 20))
            XCTAssertEqual(liveClicks, 2, "A usable new frame restores pointer interaction")
            fixture.window.close()
        }
    }

    @MainActor
    private func makePresentedFrameFixture() throws -> DisplayPreviewWindowController {
        let controller = DisplayPreviewWindowController(
            frame: NSRect(x: 0, y: 0, width: 480, height: 320),
            backgroundOpacity: 1,
            keepOnAllSpaces: true
        )
        let window = try XCTUnwrap(controller.window)
        window.setContentSize(NSSize(width: 480, height: 280))
        window.contentView?.layoutSubtreeIfNeeded()
        var pixelBuffer: CVPixelBuffer?
        XCTAssertEqual(CVPixelBufferCreate(
            kCFAllocatorDefault, 160, 90, kCVPixelFormatType_32BGRA, nil, &pixelBuffer
        ), kCVReturnSuccess)
        let image = try XCTUnwrap(pixelBuffer, "Fixture: expected a synthetic pixel buffer")
        var format: CMVideoFormatDescription?
        XCTAssertEqual(CMVideoFormatDescriptionCreateForImageBuffer(
            allocator: kCFAllocatorDefault, imageBuffer: image, formatDescriptionOut: &format
        ), noErr)
        var timing = CMSampleTimingInfo(
            duration: CMTime(value: 1, timescale: 30), presentationTimeStamp: .zero, decodeTimeStamp: .invalid
        )
        var sample: CMSampleBuffer?
        XCTAssertEqual(CMSampleBufferCreateReadyWithImageBuffer(
            allocator: kCFAllocatorDefault, imageBuffer: image,
            formatDescription: try XCTUnwrap(format), sampleTiming: &timing, sampleBufferOut: &sample
        ), noErr)
        XCTAssertTrue(controller.showFrame(try XCTUnwrap(sample), size: CGSize(width: 160, height: 90)))
        controller.presentedGeometry = DisplayPreviewFrameGeometry(
            imageRect: try XCTUnwrap(controller.previewView.fittedImageRectTopLeft()),
            sourceBounds: CGRect(x: -1920, y: 120, width: 1920, height: 1080),
            sourceID: 42,
            topologyRevision: 11
        )
        return controller
    }

    @MainActor
    private func makeFixture() -> (window: NSWindow, view: DisplayPreviewView) {
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 160, height: 90),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        window.isReleasedWhenClosed = false
        let view = DisplayPreviewView(frame: window.contentView!.bounds)
        window.contentView = view
        return (window, view)
    }

    @MainActor
    private func click(
        _ fixture: (window: NSWindow, view: DisplayPreviewView),
        at point: NSPoint,
        modifiers: NSEvent.ModifierFlags = []
    ) {
        mouseDown(fixture, at: point, modifiers: modifiers)
        mouseUp(fixture, at: point, modifiers: modifiers)
    }

    @MainActor
    private func mouseDown(
        _ fixture: (window: NSWindow, view: DisplayPreviewView),
        at point: NSPoint,
        modifiers: NSEvent.ModifierFlags = []
    ) {
        fixture.view.mouseDown(with: event(.leftMouseDown, fixture: fixture, at: point, modifiers: modifiers))
    }

    @MainActor
    private func mouseUp(
        _ fixture: (window: NSWindow, view: DisplayPreviewView),
        at point: NSPoint,
        modifiers: NSEvent.ModifierFlags = []
    ) {
        fixture.view.mouseUp(with: event(.leftMouseUp, fixture: fixture, at: point, modifiers: modifiers))
    }

    @MainActor
    private func event(
        _ type: NSEvent.EventType,
        fixture: (window: NSWindow, view: DisplayPreviewView),
        at point: NSPoint,
        modifiers: NSEvent.ModifierFlags = []
    ) -> NSEvent {
        NSEvent.mouseEvent(
            with: type,
            location: point,
            modifierFlags: modifiers,
            timestamp: 0,
            windowNumber: fixture.window.windowNumber,
            context: nil,
            eventNumber: 1,
            clickCount: 1,
            pressure: 1
        )!
    }
}
