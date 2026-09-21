import AppKit
import Carbon
import SwiftUI
import XCTest
@testable import ClassroomWidgets

final class DashboardShortcutSettingsTests: XCTestCase {
    @MainActor
    func testDisplayRecordersRenderAndCaptureIndependentShortcutsWithAccessibleStatus() async throws {
        _ = NSApplication.shared
        let suiteName = "DashboardShortcutSettingsTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let delegate = AppDelegate(defaults: defaults, registerHotKey: { _, _ in NSObject() })
        delegate.widgetOptionsChanged([CompactWidgetOption(widgetType: 7, title: "Timer")])
        let context = delegate.settingsContext
        let view = NSHostingView(rootView: DashboardShortcutSettingsView(context: context).defaultAppStorage(defaults))
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 760, height: 640),
                              styleMask: [.titled, .closable], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.appearance = NSAppearance(named: .aqua)
        window.contentView = view
        window.orderFront(nil)
        defer { window.close() }
        try await render(view, name: "settings-default-pair")

        let show = try recorder(in: view, label: "Show Display keyboard shortcut")
        let dismiss = try recorder(in: view, label: "Dismiss Display keyboard shortcut")
        XCTAssertEqual(show.accessibilityRole(), .button)
        XCTAssertEqual(dismiss.accessibilityRole(), .button)
        XCTAssertEqual(show.accessibilityValue() as? String, "⌃⌥⌘0")
        XCTAssertEqual(dismiss.accessibilityValue() as? String, "⌃⌥⌘0")

        XCTAssertTrue(dismiss.accessibilityPerformPress())
        XCTAssertEqual(dismiss.accessibilityValue() as? String, "Recording shortcut")
        try await render(view, name: "settings-recording-dismiss")
        dismiss.keyDown(with: try keyEvent(code: kVK_ANSI_D, character: "d", window: window))
        try await render(view, name: "settings-split-pair")
        XCTAssertEqual(context.displayShortcuts?.dismiss.keyCode, Int(kVK_ANSI_D))
        XCTAssertEqual(context.displayShortcuts?.show, WidgetLaunchShortcutStore.defaultDisplayShortcut)
        XCTAssertEqual(dismiss.accessibilityValue() as? String, "⌃⌥⌘D")

        XCTAssertTrue(dismiss.accessibilityPerformPress())
        dismiss.keyDown(with: try keyEvent(code: kVK_ANSI_1, character: "1", window: window))
        try await render(view, name: "settings-duplicate-dismiss")
        XCTAssertEqual(context.displayShortcutStatuses[.displayDismiss], "Already assigned in Classroom Widgets.")
        XCTAssertEqual(context.displayShortcuts?.dismiss.keyCode, Int(kVK_ANSI_D))

        context.setDisplayShortcut(DashboardShortcut(keyCode: -1, modifiers: 0), action: .dismiss)
        try await render(view, name: "settings-unassigned-dismiss")
        XCTAssertEqual(try recorder(in: view, label: "Dismiss Display keyboard shortcut").accessibilityValue() as? String, "No shortcut")
        XCTAssertEqual(context.displayShortcuts?.show, WidgetLaunchShortcutStore.defaultDisplayShortcut)

        delegate.widgetOptionsChanged([])
        try await render(view, name: "settings-no-widget-inventory")
        XCTAssertEqual(try recorder(in: view, label: "Show Display keyboard shortcut").accessibilityValue() as? String, "⌃⌥⌘0")
        XCTAssertEqual(try recorder(in: view, label: "Dismiss Display keyboard shortcut").accessibilityValue() as? String, "No shortcut")
    }

    @MainActor
    private func recorder(in view: NSView, label: String) throws -> NSView {
        func descendants(_ view: NSView) -> [NSView] { [view] + view.subviews.flatMap(descendants) }
        return try XCTUnwrap(descendants(view).first { $0.accessibilityLabel() == label }, "Expected native recorder: \(label)")
    }

    @MainActor
    private func keyEvent(code: Int, character: String, window: NSWindow) throws -> NSEvent {
        try XCTUnwrap(NSEvent.keyEvent(
            with: .keyDown, location: .zero, modifierFlags: [.command, .option, .control], timestamp: 0,
            windowNumber: window.windowNumber, context: nil, characters: character,
            charactersIgnoringModifiers: character, isARepeat: false, keyCode: UInt16(code)
        ))
    }

    @MainActor
    private func render(_ view: NSView, name: String) async throws {
        // Let SwiftUI publish its state to the actual AppKit recorder subviews.
        try await Task.sleep(nanoseconds: 100_000_000)
        view.layoutSubtreeIfNeeded()
        view.displayIfNeeded()
        guard let directory = ProcessInfo.processInfo.environment["CW_SHORTCUT_SCREENSHOT_DIR"] else { return }
        let bitmap = try XCTUnwrap(view.bitmapImageRepForCachingDisplay(in: view.bounds))
        view.cacheDisplay(in: view.bounds, to: bitmap)
        let png = try XCTUnwrap(bitmap.representation(using: .png, properties: [:]))
        try png.write(to: URL(fileURLWithPath: directory).appendingPathComponent(name + ".png"))
    }
}
