import AppKit
import Carbon
import XCTest
@testable import ClassroomWidgets

final class DisplayPreviewMenuTests: XCTestCase {
    func testDisplayEntryHasRequestedLabelAndNoPrecedingSeparator() async {
        await MainActor.run {
            _ = NSApplication.shared
            let suiteName = "DisplayPreviewMenuTests.\(UUID().uuidString)"
            let defaults = UserDefaults(suiteName: suiteName)!
            defer { defaults.removePersistentDomain(forName: suiteName) }
            let delegate = AppDelegate(defaults: defaults)
            let menu = delegate.makeNewWidgetMenu(options: [
                CompactWidgetOption(widgetType: 1, title: "Timer")
            ])
            XCTAssertEqual(menu.items.map(\.title), ["Timer", "Display"])
            guard let displayIndex = menu.items.firstIndex(where: { $0.title == "Display" }) else { return }

            XCTAssertGreaterThan(displayIndex, 0)
            XCTAssertFalse(menu.items[displayIndex - 1].isSeparatorItem)
            XCTAssertEqual(DisplayPreviewMenu.title, "Display")
            XCTAssertEqual(menu.items[displayIndex].keyEquivalent, "0")
            XCTAssertEqual(
                menu.items[displayIndex].keyEquivalentModifierMask,
                [.command, .option, .control]
            )
        }
    }

    func testNativeDisplayShortcutDispatchesDisplayAction() async {
        await MainActor.run {
            let suiteName = "DisplayPreviewMenuTests.\(UUID().uuidString)"
            let defaults = UserDefaults(suiteName: suiteName)!
            defer { defaults.removePersistentDomain(forName: suiteName) }
            var dispatchCount = 0
            let delegate = AppDelegate(defaults: defaults) { dispatchCount += 1 }

            delegate.performDisplayShortcut()

            XCTAssertEqual(dispatchCount, 1)
        }
    }

    func testDisplayMenuShowsPersistedCustomShortcutAndOmitsUnassignedShortcut() async {
        await MainActor.run {
            _ = NSApplication.shared
            let suiteName = "DisplayPreviewMenuTests.\(UUID().uuidString)"
            let defaults = UserDefaults(suiteName: suiteName)!
            defer { defaults.removePersistentDomain(forName: suiteName) }
            let store = WidgetLaunchShortcutStore(defaults: defaults)
            store.setDisplay(DashboardShortcut(
                keyCode: Int(kVK_ANSI_D),
                modifiers: Int(NSEvent.ModifierFlags.command.rawValue)
            ))
            let delegate = AppDelegate(defaults: defaults)

            XCTAssertEqual(delegate.makeNewWidgetMenu(options: []).items[0].keyEquivalent, "d")
            store.setDisplay(DashboardShortcut(keyCode: -1, modifiers: 0))
            let unassignedDelegate = AppDelegate(defaults: defaults)
            XCTAssertEqual(unassignedDelegate.makeNewWidgetMenu(options: []).items[0].keyEquivalent, "")
        }
    }

    func testPanelMenuUsesDisplayLabelAndPreservesDisplayFirstOrdering() async {
        await MainActor.run {
            _ = NSApplication.shared
            let menu = DisplayPreviewMenu.makePanelMenu(
                options: [CompactWidgetOption(widgetType: 1, title: "Timer")],
                target: nil,
                displayAction: nil,
                widgetAction: nil
            )

            XCTAssertEqual(menu.items.map(\.title), ["Display", "", "Timer"])
            XCTAssertFalse(menu.items[0].isSeparatorItem)
            XCTAssertTrue(menu.items[1].isSeparatorItem)
        }
    }
}
