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
    func testPartialRestoreStatusesAndOneResetRenderTheFinalNineWidgetBindings() async throws {
        _ = NSApplication.shared
        let suiteName = "DashboardShortcutSettingsTests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let modifiers = WidgetLaunchShortcutStore.defaultModifiers
        let show = DashboardShortcut(keyCode: Int(kVK_ANSI_1), modifiers: modifiers)
        let dismiss = DashboardShortcut(keyCode: Int(kVK_ANSI_2), modifiers: modifiers)
        let store = WidgetLaunchShortcutStore(defaults: defaults)
        store.setDisplay(show)
        store.setDisplay(dismiss, action: .dismiss)
        var unavailable: DashboardShortcut? = dismiss
        let delegate = AppDelegate(defaults: defaults, registerHotKey: { shortcut, _ in
            if shortcut == unavailable { throw DashboardHotKeyError.register(-1) }
            return NSObject()
        })
        delegate.widgetOptionsChanged((1...9).map { CompactWidgetOption(widgetType: $0, title: "Widget \($0)") })
        let context = delegate.settingsContext
        let view = NSHostingView(rootView: DashboardShortcutSettingsView(context: context).defaultAppStorage(defaults))
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 760, height: 920),
                              styleMask: [.titled, .closable], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.appearance = NSAppearance(named: .aqua)
        window.contentView = view
        window.orderFront(nil)
        defer { window.close() }

        try await render(view, name: "settings-restore-dismiss-unavailable")
        XCTAssertNil(context.displayShortcutStatuses[.display])
        XCTAssertEqual(context.displayShortcutStatuses[.displayDismiss], "Inactive — macOS could not register this shortcut.")
        XCTAssertEqual(try recorder(in: view, label: "Show Display keyboard shortcut").accessibilityValue() as? String, "⌃⌥⌘1")
        XCTAssertEqual(try recorder(in: view, label: "Dismiss Display keyboard shortcut").accessibilityValue() as? String, "⌃⌥⌘2")

        context.setDisplayShortcut(DashboardShortcut(keyCode: -1, modifiers: 0), action: .show)
        try await render(view, name: "settings-clear-show-inactive-partner")
        let showRecorder = try recorder(in: view, label: "Show Display keyboard shortcut")
        XCTAssertEqual(showRecorder.accessibilityValue() as? String, "No shortcut")
        XCTAssertEqual(store.storedDisplayBinding()?.keyCode, -1)
        XCTAssertNil(context.displayShortcutStatuses[.display])
        XCTAssertTrue(showRecorder.accessibilityPerformPress())
        showRecorder.keyDown(with: try keyEvent(code: kVK_ANSI_G, character: "g", window: window))
        try await render(view, name: "settings-edit-show-inactive-partner")
        XCTAssertEqual(showRecorder.accessibilityValue() as? String, "⌃⌥⌘G")
        XCTAssertEqual(store.storedDisplayBinding()?.keyCode, Int(kVK_ANSI_G))
        XCTAssertNil(context.displayShortcutStatuses[.display])

        XCTAssertTrue(showRecorder.accessibilityPerformPress())
        showRecorder.keyDown(with: try keyEvent(code: kVK_ANSI_2, character: "2", window: window))
        try await render(view, name: "settings-reject-inactive-partner")
        XCTAssertEqual(showRecorder.accessibilityValue() as? String, "⌃⌥⌘G")
        XCTAssertEqual(context.displayShortcutStatuses[.display], "Unavailable — the previous shortcut remains active.")
        XCTAssertEqual(context.displayShortcutStatuses[.displayDismiss], "Inactive — macOS could not register this shortcut.")

        unavailable = nil
        context.setDisplayShortcut(dismiss, action: .show)
        try await render(view, name: "settings-shared-partner-now-available")
        XCTAssertTrue(context.displayShortcutStatuses.isEmpty)
        XCTAssertEqual(showRecorder.accessibilityValue() as? String, "⌃⌥⌘2")
        XCTAssertEqual(try recorder(in: view, label: "Dismiss Display keyboard shortcut").accessibilityValue() as? String, "⌃⌥⌘2")

        context.setDisplayShortcut(show, action: .show)
        context.shortcutRecordingChanged(true)
        unavailable = show
        context.shortcutRecordingChanged(false)
        try await render(view, name: "settings-restore-show-unavailable")
        XCTAssertEqual(context.displayShortcutStatuses[.display], "Inactive — macOS could not register this shortcut.")
        XCTAssertNil(context.displayShortcutStatuses[.displayDismiss])

        context.setDisplayShortcut(DashboardShortcut(keyCode: -1, modifiers: 0), action: .dismiss)
        try await render(view, name: "settings-clear-dismiss-inactive-partner")
        let dismissRecorder = try recorder(in: view, label: "Dismiss Display keyboard shortcut")
        XCTAssertEqual(dismissRecorder.accessibilityValue() as? String, "No shortcut")
        XCTAssertEqual(store.storedDisplayBinding(action: .dismiss)?.keyCode, -1)
        XCTAssertNil(context.displayShortcutStatuses[.displayDismiss])
        XCTAssertTrue(dismissRecorder.accessibilityPerformPress())
        dismissRecorder.keyDown(with: try keyEvent(code: kVK_ANSI_G, character: "g", window: window))
        try await render(view, name: "settings-edit-dismiss-inactive-partner")
        XCTAssertEqual(dismissRecorder.accessibilityValue() as? String, "⌃⌥⌘G")
        XCTAssertEqual(store.storedDisplayBinding(action: .dismiss)?.keyCode, Int(kVK_ANSI_G))
        XCTAssertNil(context.displayShortcutStatuses[.displayDismiss])

        unavailable = nil
        context.resetWidgetShortcuts()
        try await render(view, name: "settings-reset-nine-widgets")
        XCTAssertTrue(context.displayShortcutStatuses.isEmpty)
        XCTAssertEqual(try recorder(in: view, label: "Show Display keyboard shortcut").accessibilityValue() as? String, "⌃⌥⌘0")
        XCTAssertEqual(try recorder(in: view, label: "Dismiss Display keyboard shortcut").accessibilityValue() as? String, "⌃⌥⌘0")
        for number in 1...9 {
            XCTAssertEqual(try recorder(in: view, label: "Show Widget \(number) keyboard shortcut").accessibilityValue() as? String, "⌃⌥⌘\(number)")
            XCTAssertEqual(try recorder(in: view, label: "Dismiss Widget \(number) keyboard shortcut").accessibilityValue() as? String, "⌃⌥⌘\(number)")
        }
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
