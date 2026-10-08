import AppKit
import Carbon
import CoreMedia
import CoreVideo
import WebKit
import XCTest
@testable import ClassroomWidgets

final class WidgetMovementTests: XCTestCase {
    @MainActor
    func testGlobalMoveTargetsFocusedDisplayRatherThanRememberedTimerAndSuspendsOverlap() async throws {
        _ = NSApplication.shared
        let oldPolicy = NSApp.activationPolicy()
        NSApp.setActivationPolicy(.regular)
        NSApp.finishLaunching()
        NSApp.activate(ignoringOtherApps: true)
        defer { NSApp.setActivationPolicy(oldPolicy) }
        try await Task.sleep(nanoseconds: 100_000_000)
        let suite = "WidgetMovementTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        let left = CGRect(x: 0, y: 0, width: 1440, height: 900)
        let right = CGRect(x: 1440, y: 80, width: 1000, height: 760)
        let source = DisplayDescriptor(id: 202, uuid: "source", name: "Source",
                                       bounds: right, isActive: true, mirrorMasterID: nil)
        var captureAllowed = false
        let display = DisplayPreviewCoordinator(
            catalog: DisplayCatalog(displays: { [source] }), defaults: defaults,
            hostDisplayID: { _ in 101 },
            overlapsSource: { _, window in window?.frame.intersects(right) == true },
            preflightCaptureAccess: { captureAllowed }, requestPermission: { XCTFail("No permission IO in fixture"); return false },
            makeCaptureSession: { id in DisplayCaptureSession(sourceID: id, contentDiscovery: { _ in throw CancellationError() }) }
        )
        let panels = WidgetPanelCoordinator()
        let host = WidgetHostController(websiteDataStore: .nonPersistent(), panelCoordinator: panels)
        host.webView.stopLoading()
        var handlers: [Int: @MainActor () -> Void] = [:]
        let delegate = AppDelegate(
            defaults: defaults, controller: host, displayPreviewCoordinator: display,
            moveWorkAreas: { [right, left] },
            registerHotKey: { shortcut, handler in handlers[shortcut.keyCode] = handler; return NSObject() }
        )
        delegate.settingsContext.shortcutRecordingChanged(true)
        delegate.settingsContext.shortcutRecordingChanged(false)
        let next = try XCTUnwrap(handlers[kVK_RightArrow])
        let previous = try XCTUnwrap(handlers[kVK_LeftArrow])
        let widgetID = UUID().uuidString
        defer {
            display.dismiss()
            display.flushPersistedState()
            panels.deactivate()
            panels.flushPersistedFrames()
            defaults.removePersistentDomain(forName: suite)
            UserDefaults.standard.removeObject(forKey: "widgetPanelFrameV1.\(widgetID)")
        }
        panels.reconcile(snapshot: WidgetPanelSnapshot(hostInstanceID: "fixture", revision: 1, widgets: [
            WidgetPanelDescriptor(id: widgetID, title: "Audit Timer", preferredContentSize: .init(width: 350, height: 415), snapshotPayload: [:])
        ]))
        let timer = try XCTUnwrap(NSApp.windows.first { $0.title == "Audit Timer" })
        let timerFrame = CGRect(x: 70, y: 95, width: 350, height: 447)
        timer.setFrame(timerFrame, display: true)
        try focus(timer)
        print("MOVE fixture: active=\(NSApp.isActive) policy=\(NSApp.activationPolicy().rawValue) key=\(NSApp.keyWindow?.title ?? "nil") timerKey=\(timer.isKeyWindow)")
        XCTAssertTrue(timer.isKeyWindow)
        display.open()
        let preview = try XCTUnwrap(display.windowController)
        let window = try XCTUnwrap(preview.window)
        window.setFrame(CGRect(x: 120, y: 160, width: 480, height: 400), display: true)
        let original = window.frame
        try focus(window)
        XCTAssertTrue(window.isKeyWindow, "Use real focus, not an injected selected-window answer")
        captureAllowed = true
        preview.onToggleCapture?()
        let capture = try XCTUnwrap(display.session)
        let receiveFrame = try XCTUnwrap(capture.onFrame)
        let sample = try frameSample()
        window.contentView?.layoutSubtreeIfNeeded()
        receiveFrame(sample, CGSize(width: 4, height: 4), 1)
        XCTAssertNotNil(preview.presentedGeometry, "The actual coordinator must accept a frame before the move")

        next()
        // Exercise the coordinator's real guarded callback, not a replacement
        // session callback which bypasses the presentation-generation check.
        receiveFrame(sample, CGSize(width: 4, height: 4), 2)
        let lateFrameRejected = preview.presentedGeometry == nil
        XCTAssertTrue(lateFrameRejected, "Moving onto the source must reject stale frame presentation synchronously")
        XCTAssertNil(preview.previewView.fittedImageRectTopLeft(), "Overlap must clear the previously accepted frame")
        try await Task.sleep(nanoseconds: 300_000_000)
        XCTAssertEqual(timer.frame, timerFrame, "The previously focused Timer must stay put")
        XCTAssertEqual(window.frame.origin, CGPoint(x: 1560, y: 240), "Injected second work area must produce real movement")
        let movedOrigin = window.frame.origin
        XCTAssertNil(preview.presentedGeometry)
        if let directory = ProcessInfo.processInfo.environment["CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR"],
           let view = window.contentView {
            view.layoutSubtreeIfNeeded()
            let bitmap = try XCTUnwrap(view.bitmapImageRepForCachingDisplay(in: view.bounds))
            view.cacheDisplay(in: view.bounds, to: bitmap)
            let png = try XCTUnwrap(bitmap.representation(using: .png, properties: [:]))
            try png.write(to: URL(fileURLWithPath: directory).appendingPathComponent("display-moved-onto-source.png"))
        }
        previous()
        try await Task.sleep(nanoseconds: 300_000_000)
        XCTAssertEqual(window.frame, original)
        XCTAssertEqual(timer.frame, timerFrame)
        print("MOVE focusedDisplay: next=\(movedOrigin) previous=\(window.frame.origin) timerUnchanged=\(timer.frame == timerFrame) lateFrameRejected=\(lateFrameRejected)")

        try focus(timer)
        next()
        try await Task.sleep(nanoseconds: 300_000_000)
        XCTAssertEqual(timer.frame.origin, CGPoint(x: 1510, y: 175), "Focused embedded widgets must still move")
        XCTAssertEqual(window.frame, original)
    }

    private func frameSample() throws -> CMSampleBuffer {
        var pixels: CVPixelBuffer?
        XCTAssertEqual(CVPixelBufferCreate(kCFAllocatorDefault, 4, 4, kCVPixelFormatType_32BGRA, nil, &pixels), kCVReturnSuccess)
        let image = try XCTUnwrap(pixels)
        var format: CMVideoFormatDescription?
        XCTAssertEqual(CMVideoFormatDescriptionCreateForImageBuffer(
            allocator: kCFAllocatorDefault, imageBuffer: image, formatDescriptionOut: &format
        ), noErr)
        var timing = CMSampleTimingInfo(duration: CMTime(value: 1, timescale: 30), presentationTimeStamp: .zero, decodeTimeStamp: .invalid)
        var sample: CMSampleBuffer?
        XCTAssertEqual(CMSampleBufferCreateReadyWithImageBuffer(
            allocator: kCFAllocatorDefault, imageBuffer: image, formatDescription: try XCTUnwrap(format),
            sampleTiming: &timing, sampleBufferOut: &sample
        ), noErr)
        return try XCTUnwrap(sample)
    }

    @MainActor
    private func focus(_ window: NSWindow) throws {
        NSApp.activate(ignoringOtherApps: true)
        window.makeKeyAndOrderFront(nil)
        // XCTest runs a CFRunLoop, not NSApplication.run(). Dispatch AppKit's
        // queued activation events so the real window server grants key status.
        let deadline = Date().addingTimeInterval(2)
        while !window.isKeyWindow, Date() < deadline {
            if let event = NSApp.nextEvent(matching: .any, until: Date().addingTimeInterval(0.05), inMode: .default, dequeue: true) {
                NSApp.sendEvent(event)
            }
        }
        print("FOCUS title=\(window.title) isKeyWindow=\(window.isKeyWindow) appKey=\(NSApp.keyWindow?.title ?? "nil") active=\(NSApp.isActive)")
        guard window.isKeyWindow, NSApp.keyWindow === window else {
            XCTFail("Environment blocked: the real native window did not become key; do not count this as a D06 red")
            throw NSError(domain: "WidgetMovementTests.FocusUnavailable", code: 1)
        }
    }
}
