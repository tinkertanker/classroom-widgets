import AppKit
import Carbon
import XCTest
@testable import ClassroomWidgets

final class WidgetLaunchShortcutStoreTests: XCTestCase {
    private var defaults: UserDefaults!
    private var suiteName: String!

    override func setUp() {
        super.setUp()
        suiteName = "WidgetLaunchShortcutStoreTests.\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suiteName)!
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
        super.tearDown()
    }

    func testFirstNonemptyInventoryAssignsFirstNineInventoryTypesOnlyOnce() {
        let store = WidgetLaunchShortcutStore(defaults: defaults)
        XCTAssertTrue(store.bindings(for: []).isEmpty)

        let initial = [10, 3, 7, 2, 12, 1, 6, 5, 4, 9, 8].map { CompactWidgetOption(widgetType: $0, title: "Widget \($0)") }
        let bindings = store.bindings(for: initial)

        XCTAssertEqual(bindings.keys.sorted(), [1, 2, 3, 4, 5, 6, 7, 10, 12])
        XCTAssertEqual(bindings[10]?.keyCode, Int(kVK_ANSI_1))
        XCTAssertEqual(bindings[4]?.keyCode, Int(kVK_ANSI_9))
        XCTAssertNil(bindings[8])

        let changed = [CompactWidgetOption(widgetType: 99, title: "New"), CompactWidgetOption(widgetType: 1, title: "Renamed")]
        XCTAssertEqual(store.bindings(for: changed), bindings)
    }

    func testClearedBindingPersistsAndIsNotReassigned() {
        let store = WidgetLaunchShortcutStore(defaults: defaults)
        let options = [CompactWidgetOption(widgetType: 42, title: "Timer")]
        _ = store.bindings(for: options)
        store.set(DashboardShortcut(keyCode: -1, modifiers: 123), for: 42)

        let relaunchedStore = WidgetLaunchShortcutStore(defaults: defaults)
        XCTAssertEqual(relaunchedStore.bindings(for: options)[42], DashboardShortcut(keyCode: -1, modifiers: 0))
    }

    func testResetUsesCurrentInventoryOrderAndClearsTypesAfterNine() {
        let store = WidgetLaunchShortcutStore(defaults: defaults)
        let options = (1...10).reversed().map { CompactWidgetOption(widgetType: $0, title: "Widget") }
        _ = store.bindings(for: options)
        store.set(DashboardShortcut(keyCode: 40, modifiers: Int(NSEvent.ModifierFlags.command.rawValue)), for: 10)

        store.reset(options: options)

        let bindings = store.bindings(for: options)
        XCTAssertEqual(bindings[10]?.keyCode, Int(kVK_ANSI_1))
        XCTAssertEqual(bindings[2]?.keyCode, Int(kVK_ANSI_9))
        XCTAssertEqual(bindings[1], DashboardShortcut(keyCode: -1, modifiers: 0))
    }

    func testShortcutRegistrationSuspensionTransitionsOnlyAtLifecycleBoundaries() {
        var suspension = ShortcutRegistrationSuspension()

        XCTAssertFalse(suspension.isActive)
        XCTAssertTrue(suspension.recorderStarted())
        XCTAssertFalse(suspension.recorderStarted())
        XCTAssertTrue(suspension.isActive)
        XCTAssertFalse(suspension.recorderEnded())
        XCTAssertTrue(suspension.recorderEnded())
        XCTAssertFalse(suspension.isActive)
        XCTAssertFalse(suspension.recorderEnded())
    }
}
