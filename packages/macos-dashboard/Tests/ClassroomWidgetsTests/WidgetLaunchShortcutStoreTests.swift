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

    func testSuspendedWidgetCaptureRejectsAnotherWidgetsAcceptedBinding() {
        let command = Int(NSEvent.ModifierFlags.command.rawValue)
        let first = DashboardShortcut(keyCode: 18, modifiers: command)
        let second = DashboardShortcut(keyCode: 19, modifiers: command)
        var state = ShortcutBindingState(settings: DashboardShortcut(keyCode: 20, modifiers: command))
        state.replaceWidgets(with: [41: first, 72: second])
        XCTAssertTrue(state.recorderStarted())

        XCTAssertEqual(state.stage(second, for: .widget(41)), .duplicate(.widget(72)))
        XCTAssertEqual(state.shortcut(for: .widget(41)), first)
        XCTAssertEqual(state.shortcut(for: .widget(72)), second)
        XCTAssertNil(state.candidate(for: .widget(41)))
    }

    func testSuspendedWidgetCaptureRejectsSettingsAcceptedBinding() {
        let option = Int(NSEvent.ModifierFlags.option.rawValue)
        let settings = DashboardShortcut(keyCode: 31, modifiers: option)
        let widget = DashboardShortcut(keyCode: 32, modifiers: option)
        var state = ShortcutBindingState(settings: settings)
        state.replaceWidgets(with: [9: widget])
        _ = state.recorderStarted()

        XCTAssertEqual(state.stage(settings, for: .widget(9)), .duplicate(.settings))
        XCTAssertEqual(state.shortcut(for: .settings), settings)
        XCTAssertEqual(state.shortcut(for: .widget(9)), widget)
    }

    func testFailedReplacementRollsBackWidgetAndSettingsAcceptedBindings() {
        let control = Int(NSEvent.ModifierFlags.control.rawValue)
        let oldSettings = DashboardShortcut(keyCode: 1, modifiers: control)
        let oldWidget = DashboardShortcut(keyCode: 2, modifiers: control)
        var state = ShortcutBindingState(settings: oldSettings)
        state.replaceWidgets(with: [88: oldWidget])

        XCTAssertEqual(state.stage(DashboardShortcut(keyCode: 3, modifiers: control), for: .settings), .staged)
        XCTAssertEqual(state.stage(DashboardShortcut(keyCode: 4, modifiers: control), for: .widget(88)), .staged)
        state.complete(.settings, succeeded: false)
        state.complete(.widget(88), succeeded: false)

        XCTAssertEqual(state.shortcut(for: .settings), oldSettings)
        XCTAssertEqual(state.shortcut(for: .widget(88)), oldWidget)
        XCTAssertTrue(state.pending.isEmpty)
    }

    func testInventoryArrivalDuringNestedSuspensionDoesNotResumeRegistrationsEarly() {
        let shift = Int(NSEvent.ModifierFlags.shift.rawValue)
        var state = ShortcutBindingState(settings: DashboardShortcut(keyCode: 5, modifiers: shift))
        XCTAssertTrue(state.recorderStarted())
        XCTAssertFalse(state.recorderStarted())

        let pending = DashboardShortcut(keyCode: 7, modifiers: shift)
        XCTAssertEqual(state.stage(pending, for: .widget(123)), .staged)
        let arrived = DashboardShortcut(keyCode: 6, modifiers: shift)
        state.replaceWidgets(with: [123: arrived])
        XCTAssertTrue(state.registrationsSuspended)
        XCTAssertEqual(state.shortcut(for: .widget(123)), arrived)
        XCTAssertEqual(state.candidate(for: .widget(123)), pending)
        XCTAssertFalse(state.recorderEnded())
        XCTAssertTrue(state.registrationsSuspended)
        XCTAssertTrue(state.recorderEnded())
        XCTAssertFalse(state.registrationsSuspended)
    }
}
