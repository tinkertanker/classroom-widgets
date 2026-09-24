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

    func testLaterInventoryBackfillsMissingDefaultsAndDismissBindings() {
        let store = WidgetLaunchShortcutStore(defaults: defaults)
        XCTAssertTrue(store.bindings(for: []).isEmpty)

        let displayOnly = [CompactWidgetOption(widgetType: 10, title: "Display")]
        XCTAssertEqual(store.bindings(for: displayOnly)[10]?.show.keyCode, Int(kVK_ANSI_1))

        let initial = [10, 3, 7, 2, 12, 1, 6, 5, 4, 9, 8].map { CompactWidgetOption(widgetType: $0, title: "Widget \($0)") }
        let bindings = store.bindings(for: initial)
        XCTAssertEqual(bindings.keys.sorted(), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12])
        XCTAssertEqual(bindings[10]?.show.keyCode, Int(kVK_ANSI_1))
        XCTAssertEqual(bindings[4]?.show.keyCode, Int(kVK_ANSI_9))
        XCTAssertEqual(bindings[4]?.dismiss, bindings[4]?.show)
        XCTAssertEqual(bindings[8]?.show, DashboardShortcut(keyCode: -1, modifiers: 0))
        XCTAssertEqual(bindings[8]?.dismiss, DashboardShortcut(keyCode: -1, modifiers: 0))
    }

    func testBackfillUsesAnUnclaimedDefaultWhenInventoryOrderChanges() {
        let store = WidgetLaunchShortcutStore(defaults: defaults)
        let timer = CompactWidgetOption(widgetType: 7, title: "Timer")
        _ = store.bindings(for: [timer])

        let bindings = store.bindings(for: [
            CompactWidgetOption(widgetType: 40, title: "Randomiser"),
            timer
        ])

        XCTAssertEqual(bindings[7]?.show.keyCode, Int(kVK_ANSI_1))
        XCTAssertEqual(bindings[40]?.show.keyCode, Int(kVK_ANSI_2))
        XCTAssertEqual(bindings[40]?.dismiss, bindings[40]?.show)
    }

    func testBackfillDoesNotUseTheSettingsShortcut() {
        let store = WidgetLaunchShortcutStore(defaults: defaults)
        let settings = DashboardShortcut(keyCode: Int(kVK_ANSI_1), modifiers: WidgetLaunchShortcutStore.defaultModifiers)

        let bindings = store.bindings(
            for: [CompactWidgetOption(widgetType: 40, title: "Randomiser")],
            reserving: [settings]
        )

        XCTAssertEqual(bindings[40]?.show.keyCode, Int(kVK_ANSI_2))
    }

    func testClearedBindingPersistsAndIsNotReassigned() {
        let store = WidgetLaunchShortcutStore(defaults: defaults)
        let options = [CompactWidgetOption(widgetType: 42, title: "Timer")]
        _ = store.bindings(for: options)
        store.set(DashboardShortcut(keyCode: -1, modifiers: 123), action: .show, for: 42)

        let relaunchedStore = WidgetLaunchShortcutStore(defaults: defaults)
        XCTAssertEqual(relaunchedStore.bindings(for: options)[42]?.show, DashboardShortcut(keyCode: -1, modifiers: 0))
    }

    func testLegacyShowBindingMigratesToMatchingDismissBinding() throws {
        let shortcut = DashboardShortcut(keyCode: 18, modifiers: Int(NSEvent.ModifierFlags.command.rawValue))
        defaults.set(try JSONEncoder().encode(["42": shortcut]), forKey: WidgetLaunchShortcutStore.storageKey)
        defaults.set(true, forKey: WidgetLaunchShortcutStore.initializedKey)

        let binding = WidgetLaunchShortcutStore(defaults: defaults).bindings(
            for: [CompactWidgetOption(widgetType: 42, title: "Timer")]
        )[42]

        XCTAssertEqual(binding?.show, shortcut)
        XCTAssertEqual(binding?.dismiss, shortcut)
    }

    func testResetUsesCurrentInventoryOrderAndClearsTypesAfterNine() {
        let store = WidgetLaunchShortcutStore(defaults: defaults)
        let options = (1...10).reversed().map { CompactWidgetOption(widgetType: $0, title: "Widget") }
        _ = store.bindings(for: options)
        store.set(DashboardShortcut(keyCode: 40, modifiers: Int(NSEvent.ModifierFlags.command.rawValue)), action: .show, for: 10)

        store.reset(options: options)

        let bindings = store.bindings(for: options)
        XCTAssertEqual(bindings[10]?.show.keyCode, Int(kVK_ANSI_1))
        XCTAssertEqual(bindings[2]?.show.keyCode, Int(kVK_ANSI_9))
        XCTAssertEqual(bindings[1]?.show, DashboardShortcut(keyCode: -1, modifiers: 0))
    }

    func testResetDoesNotStealReservedNativeShortcut() {
        let store = WidgetLaunchShortcutStore(defaults: defaults)
        let options = [CompactWidgetOption(widgetType: 42, title: "Timer")]
        let reserved = DashboardShortcut(
            keyCode: Int(kVK_ANSI_1),
            modifiers: WidgetLaunchShortcutStore.defaultModifiers
        )

        store.reset(options: options, reserving: [reserved])

        let nextAvailable = DashboardShortcut(
            keyCode: Int(kVK_ANSI_2),
            modifiers: WidgetLaunchShortcutStore.defaultModifiers
        )
        XCTAssertEqual(store.bindings(for: options)[42]?.show, nextAvailable)
        XCTAssertEqual(store.bindings(for: options)[42]?.dismiss, nextAvailable)
    }

    func testSuspendedWidgetCaptureRejectsAnotherWidgetsAcceptedBinding() {
        let command = Int(NSEvent.ModifierFlags.command.rawValue)
        let first = DashboardShortcut(keyCode: 18, modifiers: command)
        let second = DashboardShortcut(keyCode: 19, modifiers: command)
        var state = ShortcutBindingState(settings: DashboardShortcut(keyCode: 20, modifiers: command))
        state.replaceWidgets(with: [
            41: WidgetShortcutBinding(show: first, dismiss: first),
            72: WidgetShortcutBinding(show: second, dismiss: second)
        ])
        XCTAssertTrue(state.recorderStarted())

        let result = state.stage(second, for: .widget(41))
        XCTAssertTrue(result == .duplicate(.widget(72)) || result == .duplicate(.widgetDismiss(72)))
        XCTAssertEqual(state.shortcut(for: .widget(41)), first)
        XCTAssertEqual(state.shortcut(for: .widget(72)), second)
        XCTAssertNil(state.candidate(for: .widget(41)))
    }

    func testSuspendedWidgetCaptureRejectsSettingsAcceptedBinding() {
        let option = Int(NSEvent.ModifierFlags.option.rawValue)
        let settings = DashboardShortcut(keyCode: 31, modifiers: option)
        let widget = DashboardShortcut(keyCode: 32, modifiers: option)
        var state = ShortcutBindingState(settings: settings)
        state.replaceWidgets(with: [9: WidgetShortcutBinding(show: widget, dismiss: widget)])
        _ = state.recorderStarted()

        XCTAssertEqual(state.stage(settings, for: .widget(9)), .duplicate(.settings))
        XCTAssertEqual(state.shortcut(for: .settings), settings)
        XCTAssertEqual(state.shortcut(for: .widget(9)), widget)
    }

    func testShowAndDismissForSameWidgetMayShareShortcut() {
        let shortcut = DashboardShortcut(keyCode: 18, modifiers: Int(NSEvent.ModifierFlags.command.rawValue))
        var state = ShortcutBindingState(settings: DashboardShortcut(keyCode: 20, modifiers: Int(NSEvent.ModifierFlags.option.rawValue)))
        state.replaceWidgets(with: [9: WidgetShortcutBinding(show: shortcut, dismiss: DashboardShortcut(keyCode: 19, modifiers: shortcut.modifiers))])

        XCTAssertEqual(state.stage(shortcut, for: .widgetDismiss(9)), .staged)
    }

    func testRegistrationResultAcceptsAvailableChangeEvenWhenSiblingIsUnavailable() {
        let assigned = DashboardShortcut(keyCode: 18, modifiers: Int(NSEvent.ModifierFlags.command.rawValue))
        let cleared = DashboardShortcut(keyCode: -1, modifiers: 0)
        let results = WidgetShortcutRegistrationResults(show: true, dismiss: false)

        XCTAssertTrue(results.accepts(assigned, action: .show))
        XCTAssertTrue(results.accepts(cleared, action: .dismiss))
        XCTAssertFalse(results.accepts(assigned, action: .dismiss))
    }

    func testWidgetWithoutAnAvailableDefaultCanAcceptItsFirstShortcut() {
        let store = WidgetLaunchShortcutStore(defaults: defaults)
        let options = (1...9).map { CompactWidgetOption(widgetType: $0, title: "Widget \($0)") }
        let settings = DashboardShortcut(
            keyCode: Int(kVK_ANSI_1),
            modifiers: WidgetLaunchShortcutStore.defaultModifiers
        )
        let bindings = store.bindings(for: options, reserving: [settings])
        let unassignedWidgetType = 9
        let assigned = DashboardShortcut(keyCode: Int(kVK_ANSI_A), modifiers: WidgetLaunchShortcutStore.defaultModifiers)
        var state = ShortcutBindingState(settings: settings)
        state.replaceWidgets(with: bindings)

        XCTAssertEqual(state.shortcut(for: .widget(unassignedWidgetType))?.isAssigned, false)
        XCTAssertEqual(state.shortcut(for: .widgetDismiss(unassignedWidgetType))?.isAssigned, false)
        XCTAssertEqual(state.stage(assigned, for: .widget(unassignedWidgetType)), .staged)
        state.complete(.widget(unassignedWidgetType), succeeded: true)

        XCTAssertEqual(state.shortcut(for: .widget(unassignedWidgetType)), assigned)
        XCTAssertEqual(state.shortcut(for: .widgetDismiss(unassignedWidgetType))?.isAssigned, false)
    }

    func testFailedReplacementRollsBackWidgetAndSettingsAcceptedBindings() {
        let control = Int(NSEvent.ModifierFlags.control.rawValue)
        let oldSettings = DashboardShortcut(keyCode: 1, modifiers: control)
        let oldWidget = DashboardShortcut(keyCode: 2, modifiers: control)
        var state = ShortcutBindingState(settings: oldSettings)
        state.replaceWidgets(with: [88: WidgetShortcutBinding(show: oldWidget, dismiss: oldWidget)])

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
        state.replaceWidgets(with: [123: WidgetShortcutBinding(show: arrived, dismiss: arrived)])
        XCTAssertTrue(state.registrationsSuspended)
        XCTAssertEqual(state.shortcut(for: .widget(123)), arrived)
        XCTAssertEqual(state.candidate(for: .widget(123)), pending)
        XCTAssertFalse(state.recorderEnded())
        XCTAssertTrue(state.registrationsSuspended)
        XCTAssertTrue(state.recorderEnded())
        XCTAssertFalse(state.registrationsSuspended)
    }

    func testDisplayShortcutProposalDoesNotPersistUntilInventoryReservationsAreKnown() {
        let store = WidgetLaunchShortcutStore(defaults: defaults)
        let preferred = DashboardShortcut(
            keyCode: Int(kVK_ANSI_0),
            modifiers: WidgetLaunchShortcutStore.defaultModifiers
        )
        XCTAssertEqual(store.proposedDisplayBinding(reserving: []), preferred)
        XCTAssertNil(store.storedDisplayBinding())
        XCTAssertEqual(store.initializeDisplayBinding(reserving: [preferred]), DashboardShortcut(keyCode: -1, modifiers: 0))
        XCTAssertEqual(
            store.initializeDisplayBinding(reserving: []),
            DashboardShortcut(keyCode: -1, modifiers: 0),
            "A conflicted default must remain unassigned instead of being claimed after inventory changes"
        )
    }

    func testAcceptedDisplayDefaultPersistsAcrossRelaunchAndLaterReservations() {
        let preferred = DashboardShortcut(
            keyCode: Int(kVK_ANSI_0),
            modifiers: WidgetLaunchShortcutStore.defaultModifiers
        )
        XCTAssertEqual(WidgetLaunchShortcutStore(defaults: defaults).initializeDisplayBinding(reserving: []), preferred)
        let relaunchedStore = WidgetLaunchShortcutStore(defaults: defaults)
        XCTAssertEqual(relaunchedStore.storedDisplayBinding(), preferred)
        XCTAssertEqual(relaunchedStore.initializeDisplayBinding(reserving: [preferred]), preferred)
    }

    func testInitialDisplayReservationIncludesExistingSettingsAndWidgetBindings() {
        let preferred = DashboardShortcut(
            keyCode: Int(kVK_ANSI_0),
            modifiers: WidgetLaunchShortcutStore.defaultModifiers
        )
        var settingsState = ShortcutBindingState(settings: preferred)
        XCTAssertEqual(
            WidgetLaunchShortcutStore(defaults: defaults).initializeDisplayBinding(
                reserving: settingsState.assignedShortcuts(excluding: .display)
            ),
            DashboardShortcut(keyCode: -1, modifiers: 0)
        )

        defaults.removePersistentDomain(forName: suiteName)
        settingsState = ShortcutBindingState(settings: DashboardShortcut(keyCode: 40, modifiers: preferred.modifiers))
        settingsState.replaceWidgets(with: [7: WidgetShortcutBinding(
            show: preferred,
            dismiss: DashboardShortcut(keyCode: -1, modifiers: 0)
        )])
        XCTAssertEqual(
            WidgetLaunchShortcutStore(defaults: defaults).initializeDisplayBinding(
                reserving: settingsState.assignedShortcuts(excluding: .display)
            ),
            DashboardShortcut(keyCode: -1, modifiers: 0)
        )
    }

    func testCustomAndUnassignedDisplayChoicesPersist() {
        let store = WidgetLaunchShortcutStore(defaults: defaults)

        let custom = DashboardShortcut(keyCode: Int(kVK_ANSI_D), modifiers: Int(NSEvent.ModifierFlags.command.rawValue))
        store.setDisplay(custom)
        XCTAssertEqual(WidgetLaunchShortcutStore(defaults: defaults).storedDisplayBinding(), custom)
        store.setDisplay(DashboardShortcut(keyCode: -1, modifiers: 123))
        XCTAssertEqual(store.storedDisplayBinding(), DashboardShortcut(keyCode: -1, modifiers: 0))
    }

    func testDisplayOwnerConflictsBothDirectionsAndSurvivesWidgetInventoryRefresh() {
        let command = Int(NSEvent.ModifierFlags.command.rawValue)
        let settings = DashboardShortcut(keyCode: 1, modifiers: command)
        let display = DashboardShortcut(keyCode: 2, modifiers: command)
        let widget = DashboardShortcut(keyCode: 3, modifiers: command)
        let dismiss = DashboardShortcut(keyCode: 4, modifiers: command)
        var state = ShortcutBindingState(settings: settings, display: display)
        state.replaceWidgets(with: [42: WidgetShortcutBinding(show: widget, dismiss: dismiss)])

        XCTAssertEqual(state.stage(display, for: .widget(42)), .duplicate(.display))
        XCTAssertEqual(state.stage(display, for: .widgetDismiss(42)), .duplicate(.display))
        XCTAssertEqual(state.stage(widget, for: .display), .duplicate(.widget(42)))
        XCTAssertEqual(state.stage(dismiss, for: .display), .duplicate(.widgetDismiss(42)))
        state.replaceWidgets(with: [99: WidgetShortcutBinding(
            show: DashboardShortcut(keyCode: 5, modifiers: command),
            dismiss: DashboardShortcut(keyCode: -1, modifiers: 0)
        )])

        XCTAssertEqual(state.shortcut(for: .display), display)
        XCTAssertTrue(state.recorderStarted())
        XCTAssertTrue(state.registrationsSuspended)
        XCTAssertTrue(state.recorderEnded())
    }

    @MainActor
    func testStartupStateReservesSavedWidgetBindingBeforeDisplayCanBeEdited() {
        let widgetShortcut = DashboardShortcut(
            keyCode: Int(kVK_ANSI_D),
            modifiers: WidgetLaunchShortcutStore.defaultModifiers
        )
        WidgetLaunchShortcutStore(defaults: defaults).set(widgetShortcut, action: .show, for: 42)
        let delegate = AppDelegate(defaults: defaults)
        var state = delegate.initialShortcutBindingState()

        XCTAssertEqual(state.stage(widgetShortcut, for: .display), .duplicate(.widget(42)))
    }

    @MainActor
    func testStartupLeavesMoveWidgetUnassignedWhenDefaultAlreadyTakenByWidget() {
        let moveDefault = DashboardShortcut(
            keyCode: DashboardDefaults.moveWidgetNextShortcutKeyCode,
            modifiers: DashboardDefaults.moveWidgetShortcutModifiers
        )
        WidgetLaunchShortcutStore(defaults: defaults).set(moveDefault, action: .show, for: 42)
        let state = AppDelegate(defaults: defaults).initialShortcutBindingState()

        XCTAssertEqual(state.shortcut(for: .moveWidgetNext)?.isAssigned, false)
        XCTAssertEqual(state.shortcut(for: .widget(42)), moveDefault.normalized)
    }

    @MainActor
    func testStartupStateReservesSavedDismissBindingBeforeDisplayCanBeEdited() {
        let preferred = DashboardShortcut(
            keyCode: Int(kVK_ANSI_0),
            modifiers: WidgetLaunchShortcutStore.defaultModifiers
        )
        let store = WidgetLaunchShortcutStore(defaults: defaults)
        store.set(preferred, action: .dismiss, for: 42)
        let delegate = AppDelegate(defaults: defaults)
        var state = delegate.initialShortcutBindingState()

        XCTAssertEqual(state.stage(preferred, for: .display), .duplicate(.widgetDismiss(42)))
        XCTAssertEqual(
            store.initializeDisplayBinding(reserving: state.assignedShortcuts(excluding: .display)),
            DashboardShortcut(keyCode: -1, modifiers: 0)
        )
    }

    @MainActor
    func testNewDisplayAssignmentWaitsForFirstDefaultWidgetInventory() {
        let delegate = AppDelegate(defaults: defaults)
        var state = delegate.initialShortcutBindingState()
        let firstWidgetDefault = DashboardShortcut(
            keyCode: Int(kVK_ANSI_1),
            modifiers: WidgetLaunchShortcutStore.defaultModifiers
        )
        XCTAssertEqual(state.stage(firstWidgetDefault, for: .display), .staged)

        XCTAssertFalse(
            delegate.shouldApplyPendingDisplayShortcut(in: state),
            "Display must not persist or register a new assignment until widget defaults are reserved"
        )
        XCTAssertNil(WidgetLaunchShortcutStore(defaults: defaults).storedDisplayBinding())
    }

    @MainActor
    func testFirstInventoryDrainsNonconflictingDeferredDisplayChoice() {
        var gate = DisplayShortcutStartupGate()
        var state = ShortcutBindingState(settings: DashboardShortcut(keyCode: 40, modifiers: 0))
        let candidate = DashboardShortcut(
            keyCode: Int(kVK_ANSI_D),
            modifiers: WidgetLaunchShortcutStore.defaultModifiers
        )
        XCTAssertEqual(state.stage(candidate, for: .display), .staged)
        XCTAssertFalse(gate.shouldApplyPending(in: state))
        XCTAssertNil(WidgetLaunchShortcutStore(defaults: defaults).storedDisplayBinding())

        let resolution = gate.mergeWidgetBindings(
            [42: WidgetShortcutBinding(
                show: DashboardShortcut(keyCode: Int(kVK_ANSI_1), modifiers: candidate.modifiers),
                dismiss: DashboardShortcut(keyCode: Int(kVK_ANSI_2), modifiers: candidate.modifiers)
            )],
            inventoryIsReady: true,
            into: &state
        )

        XCTAssertEqual(resolution, .applyPending)
        XCTAssertTrue(gate.shouldApplyPending(in: state))
        XCTAssertEqual(state.candidate(for: .display), candidate)
    }

    @MainActor
    func testRecorderEndDrainsDeferredDisplayChoiceAfterInventory() {
        var gate = DisplayShortcutStartupGate()
        var state = ShortcutBindingState(settings: DashboardShortcut(keyCode: 40, modifiers: 0))
        let candidate = DashboardShortcut(
            keyCode: Int(kVK_ANSI_D),
            modifiers: WidgetLaunchShortcutStore.defaultModifiers
        )
        XCTAssertTrue(state.recorderStarted())
        XCTAssertEqual(state.stage(candidate, for: .display), .staged)
        XCTAssertEqual(
            gate.mergeWidgetBindings([:], inventoryIsReady: true, into: &state),
            .none,
            "Inventory must not apply a shortcut while its recorder still owns registration suspension"
        )
        XCTAssertFalse(gate.shouldApplyPending(in: state))

        XCTAssertTrue(state.recorderEnded())
        XCTAssertTrue(gate.shouldApplyPending(in: state))
    }

    @MainActor
    func testFirstInventoryRejectsNewlyConflictingChoiceAndPersistsUnassigned() {
        let delegate = AppDelegate(defaults: defaults)
        var gate = DisplayShortcutStartupGate()
        var state = delegate.initialShortcutBindingState()
        let candidate = DashboardShortcut(
            keyCode: Int(kVK_ANSI_1),
            modifiers: WidgetLaunchShortcutStore.defaultModifiers
        )
        XCTAssertEqual(state.stage(candidate, for: .display), .staged)

        XCTAssertEqual(
            gate.mergeWidgetBindings(
                [42: WidgetShortcutBinding(show: candidate, dismiss: DashboardShortcut(keyCode: -1, modifiers: 0))],
                inventoryIsReady: true,
                into: &state
            ),
            .rejectedDuplicate(.widget(42))
        )
        delegate.preserveUnassignedDisplayChoiceIfNeeded(in: &state)

        XCTAssertNil(state.candidate(for: .display))
        XCTAssertEqual(state.shortcut(for: .widget(42)), candidate)
        XCTAssertEqual(state.shortcut(for: .display), DashboardShortcut(keyCode: -1, modifiers: 0))
        XCTAssertEqual(
            WidgetLaunchShortcutStore(defaults: defaults).storedDisplayBinding(),
            DashboardShortcut(keyCode: -1, modifiers: 0)
        )
    }

    @MainActor
    func testFirstInventoryRejectsDeferredDisplayChoiceThatConflictsOnlyWithDismiss() {
        let delegate = AppDelegate(defaults: defaults)
        var gate = DisplayShortcutStartupGate()
        var state = delegate.initialShortcutBindingState()
        let candidate = DashboardShortcut(
            keyCode: Int(kVK_ANSI_2),
            modifiers: WidgetLaunchShortcutStore.defaultModifiers
        )
        let show = DashboardShortcut(keyCode: Int(kVK_ANSI_1), modifiers: candidate.modifiers)
        XCTAssertEqual(state.stage(candidate, for: .display), .staged)

        XCTAssertEqual(
            gate.mergeWidgetBindings(
                [42: WidgetShortcutBinding(show: show, dismiss: candidate)],
                inventoryIsReady: true,
                into: &state
            ),
            .rejectedDuplicate(.widgetDismiss(42))
        )
        delegate.preserveUnassignedDisplayChoiceIfNeeded(in: &state)

        XCTAssertNil(state.candidate(for: .display))
        XCTAssertEqual(state.shortcut(for: .widget(42)), show)
        XCTAssertEqual(state.shortcut(for: .widgetDismiss(42)), candidate)
        XCTAssertEqual(WidgetLaunchShortcutStore(defaults: defaults).storedDisplayBinding(), DashboardShortcut(keyCode: -1, modifiers: 0))
    }

    @MainActor
    func testRejectedDeferredReplacementPreservesStoredAcceptedDisplayChoice() {
        let accepted = DashboardShortcut(
            keyCode: Int(kVK_ANSI_D),
            modifiers: WidgetLaunchShortcutStore.defaultModifiers
        )
        let conflicting = DashboardShortcut(
            keyCode: Int(kVK_ANSI_1),
            modifiers: WidgetLaunchShortcutStore.defaultModifiers
        )
        WidgetLaunchShortcutStore(defaults: defaults).setDisplay(accepted)
        let delegate = AppDelegate(defaults: defaults)
        var state = delegate.initialShortcutBindingState()
        var gate = DisplayShortcutStartupGate()
        XCTAssertEqual(state.stage(conflicting, for: .display), .staged)

        XCTAssertEqual(
            gate.mergeWidgetBindings(
                [42: WidgetShortcutBinding(show: conflicting, dismiss: DashboardShortcut(keyCode: -1, modifiers: 0))],
                inventoryIsReady: true,
                into: &state
            ),
            .rejectedDuplicate(.widget(42))
        )
        delegate.preserveUnassignedDisplayChoiceIfNeeded(in: &state)

        XCTAssertEqual(state.shortcut(for: .display), accepted)
        XCTAssertEqual(WidgetLaunchShortcutStore(defaults: defaults).storedDisplayBinding(), accepted)
    }

    func testExplicitDisplayClearingDoesNotWaitForWidgetInventory() {
        var gate = DisplayShortcutStartupGate()
        var state = ShortcutBindingState(
            settings: DashboardShortcut(keyCode: 40, modifiers: 0),
            display: DashboardShortcut(keyCode: Int(kVK_ANSI_D), modifiers: WidgetLaunchShortcutStore.defaultModifiers)
        )
        XCTAssertEqual(state.stage(DashboardShortcut(keyCode: -1, modifiers: 0), for: .display), .staged)

        XCTAssertTrue(gate.shouldApplyPending(in: state))
    }
}
