import AppKit
import XCTest
@testable import ClassroomWidgets

final class DisplayPreviewInteractionTests: XCTestCase {
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

    func testIdleAccessibilityPressUsesSameEnabledStartBoundary() async {
        await MainActor.run {
            _ = NSApplication.shared
            let view = DisplayPreviewView(frame: NSRect(x: 0, y: 0, width: 160, height: 90))
            var starts = 0
            view.onIdlePrimaryClick = { starts += 1 }
            view.setIdleStartEnabled(false)
            XCTAssertEqual(view.accessibilityRole(), NSAccessibility.Role.image)
            XCTAssertEqual(view.accessibilityLabel(), "Display preview")
            XCTAssertFalse(view.accessibilityPerformPress())
            XCTAssertEqual(starts, 0)

            view.setIdleStartEnabled(true)
            XCTAssertEqual(view.accessibilityRole(), NSAccessibility.Role.button)
            XCTAssertEqual(view.accessibilityLabel(), "Click to see display")
            XCTAssertTrue(view.accessibilityPerformPress())
            XCTAssertEqual(starts, 1)

            view.prepareForLiveInteraction(sourceSize: CGSize(width: 160, height: 90))
            XCTAssertEqual(view.accessibilityRole(), NSAccessibility.Role.image)
            XCTAssertEqual(view.accessibilityLabel(), "Live image of the selected display")
            XCTAssertFalse(view.accessibilityPerformPress())
        }
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
