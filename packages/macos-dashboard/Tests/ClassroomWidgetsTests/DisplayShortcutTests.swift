import AppKit
import Carbon
import XCTest
@testable import ClassroomWidgets

final class DisplayShortcutTests: XCTestCase {
    private var defaults: UserDefaults!
    private var suiteName: String!

    override func setUp() {
        super.setUp()
        suiteName = "DisplayShortcutTests.\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suiteName)!
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
        super.tearDown()
    }

    func testEditingLegacyShowFreezesTheInheritedDismissInsteadOfMovingBoth() {
        defaults.set(true, forKey: WidgetLaunchShortcutStore.displayInitializedKey)
        defaults.set(Int(kVK_ANSI_D), forKey: WidgetLaunchShortcutStore.displayKeyCodeKey)
        defaults.set(WidgetLaunchShortcutStore.defaultModifiers, forKey: WidgetLaunchShortcutStore.displayModifiersKey)
        let store = WidgetLaunchShortcutStore(defaults: defaults)

        store.setDisplay(DashboardShortcut(keyCode: Int(kVK_ANSI_F), modifiers: WidgetLaunchShortcutStore.defaultModifiers))

        XCTAssertEqual(defaults.object(forKey: "displayPreviewDismissShortcutKeyCode") as? Int, Int(kVK_ANSI_D))
        XCTAssertEqual(defaults.object(forKey: "displayPreviewDismissShortcutModifiers") as? Int, WidgetLaunchShortcutStore.defaultModifiers)
        XCTAssertEqual(store.storedDisplayBinding()?.keyCode, Int(kVK_ANSI_F))
    }

    func testMissingDismissInheritsLegacyUnassignmentButExplicitDismissSurvivesShowEdits() {
        defaults.set(true, forKey: WidgetLaunchShortcutStore.displayInitializedKey)
        defaults.set(-1, forKey: WidgetLaunchShortcutStore.displayKeyCodeKey)
        let store = WidgetLaunchShortcutStore(defaults: defaults)
        let none = DashboardShortcut(keyCode: -1, modifiers: 0)
        let custom = DashboardShortcut(keyCode: Int(kVK_ANSI_D), modifiers: WidgetLaunchShortcutStore.defaultModifiers)
        XCTAssertEqual(store.storedDisplayBinding(action: .dismiss), none)
        store.setDisplay(custom)
        XCTAssertEqual(store.storedDisplayBinding(action: .dismiss), none)
        store.setDisplay(custom, action: .dismiss)
        store.setDisplay(none)
        XCTAssertEqual(WidgetLaunchShortcutStore(defaults: defaults).storedDisplayBinding(action: .dismiss), custom)
        store.setDisplay(none, action: .dismiss)
        store.setDisplay(custom)
        XCTAssertEqual(WidgetLaunchShortcutStore(defaults: defaults).storedDisplayBinding(action: .dismiss), none)
    }

    func testOnlyDisplayPairCanShareAndPendingDismissReservesAgainstEveryOtherOwner() {
        let show = DashboardShortcut(keyCode: 2, modifiers: WidgetLaunchShortcutStore.defaultModifiers)
        let pending = DashboardShortcut(keyCode: 3, modifiers: show.modifiers)
        var state = ShortcutBindingState(settings: DashboardShortcut(keyCode: 43, modifiers: show.modifiers), display: show)
        XCTAssertEqual(state.stage(show, for: .displayDismiss), .staged)
        state.complete(.displayDismiss, succeeded: true)
        XCTAssertEqual(state.stage(pending, for: .displayDismiss), .staged)
        for owner: ShortcutBindingState.Owner in [.settings, .widget(1), .widgetDismiss(1)] {
            XCTAssertEqual(state.stage(pending, for: owner), .duplicate(.displayDismiss))
        }
        XCTAssertTrue(state.assignedShortcuts(excluding: .settings).contains(pending))
        XCTAssertEqual(state.stage(pending, for: .display), .staged)
    }

    @MainActor
    func testMatchingDisplayKeysRegisterOnceAndDispatchToggleThenSplitIndependently() {
        let fixture = RegistrationFixture()
        let show = DashboardShortcut(keyCode: 2, modifiers: WidgetLaunchShortcutStore.defaultModifiers)
        let dismiss = DashboardShortcut(keyCode: 3, modifiers: show.modifiers)
        fixture.registration.restoreAccepted(WidgetShortcutBinding(show: show, dismiss: show))
        XCTAssertEqual(fixture.liveKeys, [show])
        fixture.handlers[show]?()
        XCTAssertEqual(fixture.events, [nil])
        XCTAssertTrue(fixture.registration.replace(with: WidgetShortcutBinding(show: show, dismiss: dismiss), changing: [.dismiss]))
        fixture.handlers[dismiss]?()
        fixture.handlers[show]?()
        XCTAssertEqual(fixture.events, [nil, .dismiss, .show])
        XCTAssertEqual(fixture.attempts, [show, dismiss], "Splitting a pair reuses the already registered Show key")
    }

    @MainActor
    func testFailedPairReplacementPreservesOriginalTokensAndDispatch() {
        let fixture = RegistrationFixture()
        let original = DashboardShortcut(keyCode: 2, modifiers: WidgetLaunchShortcutStore.defaultModifiers)
        let next = DashboardShortcut(keyCode: 3, modifiers: original.modifiers)
        let unavailable = DashboardShortcut(keyCode: 4, modifiers: original.modifiers)
        fixture.registration.restoreAccepted(WidgetShortcutBinding(show: original, dismiss: original))
        XCTAssertEqual(fixture.liveKeys, [original])
        fixture.fail = unavailable
        XCTAssertFalse(fixture.registration.replace(with: WidgetShortcutBinding(show: next, dismiss: unavailable), changing: [.show, .dismiss]))
        XCTAssertEqual(fixture.liveKeys, [original], "A partial replacement is released; the old registration is never dropped")
        XCTAssertEqual(fixture.registration.binding, WidgetShortcutBinding(show: original, dismiss: original))
        fixture.handlers[next]?()
        fixture.handlers[original]?()
        XCTAssertEqual(fixture.events, [nil])
    }

    @MainActor
    func testRecordingSuspendsBothKeysAndNestedRecordersResumeOnlyAtTheEnd() {
        let fixture = RegistrationFixture()
        let show = DashboardShortcut(keyCode: 2, modifiers: WidgetLaunchShortcutStore.defaultModifiers)
        let dismiss = DashboardShortcut(keyCode: 3, modifiers: show.modifiers)
        let pair = WidgetShortcutBinding(show: show, dismiss: dismiss)
        var state = ShortcutBindingState(settings: DashboardShortcut(keyCode: 43, modifiers: show.modifiers))
        fixture.registration.restoreAccepted(pair)
        XCTAssertEqual(fixture.liveKeys, [show, dismiss])
        if state.recorderStarted() { fixture.registration.suspend() }
        XCTAssertFalse(state.recorderStarted())
        fixture.handlers[show]?()
        fixture.handlers[dismiss]?()
        XCTAssertTrue(fixture.events.isEmpty)
        XCTAssertTrue(fixture.liveKeys.isEmpty)
        XCTAssertFalse(state.recorderEnded())
        XCTAssertTrue(fixture.liveKeys.isEmpty)
        if state.recorderEnded() { fixture.registration.restoreAccepted(pair) }
        XCTAssertEqual(fixture.liveKeys, [show, dismiss])
        fixture.handlers[dismiss]?()
        XCTAssertEqual(fixture.events, [.dismiss])
    }

    @MainActor
    func testAcceptedDistinctRestoreKeepsAvailableActionWhenItsPartnerIsUnavailable() {
        for resume in [false, true] {
            for unavailableAction: WidgetShortcutAction in [.show, .dismiss] {
                let fixture = RegistrationFixture()
                let show = DashboardShortcut(keyCode: 2, modifiers: WidgetLaunchShortcutStore.defaultModifiers)
                let dismiss = DashboardShortcut(keyCode: 3, modifiers: show.modifiers)
                let unavailable = unavailableAction == .show ? show : dismiss
                let available = unavailableAction == .show ? dismiss : show
                let availableAction: WidgetShortcutAction = unavailableAction == .show ? .dismiss : .show
                let unavailableOwner = ShortcutBindingState.Owner.displayOwner(for: unavailableAction)
                let availableOwner = ShortcutBindingState.Owner.displayOwner(for: availableAction)
                let store = WidgetLaunchShortcutStore(defaults: defaults)
                store.setDisplay(show)
                store.setDisplay(dismiss, action: .dismiss)
                let delegate = AppDelegate(defaults: defaults, registerHotKey: fixture.register) { fixture.events.append($0) }
                if resume {
                    delegate.widgetOptionsChanged([])
                    XCTAssertTrue(fixture.liveKeys.contains(show))
                    XCTAssertTrue(fixture.liveKeys.contains(dismiss))
                    delegate.settingsContext.shortcutRecordingChanged(true)
                }
                fixture.attempts.removeAll()
                fixture.fail = unavailable
                if resume { delegate.settingsContext.shortcutRecordingChanged(false) }
                else { delegate.widgetOptionsChanged([]) }
                fixture.handlers[unavailable]?()
                fixture.handlers[available]?()

                print("RESTORE phase=\(resume ? "recording-resume" : "cold-start") unavailable=\(unavailableAction) showActive=\(fixture.liveKeys.contains(show)) dismissActive=\(fixture.liveKeys.contains(dismiss)) events=\(fixture.events)")
                XCTAssertEqual(fixture.attempts.filter { $0 == show || $0 == dismiss }, [show, dismiss])
                XCTAssertTrue(fixture.liveKeys.contains(available), "An unavailable partner must not disable the free accepted key")
                XCTAssertFalse(fixture.liveKeys.contains(unavailable))
                XCTAssertEqual(fixture.events, [availableAction])
                XCTAssertNil(delegate.settingsContext.displayShortcutStatuses[availableOwner])
                XCTAssertEqual(delegate.settingsContext.displayShortcutStatuses[unavailableOwner], "Inactive — macOS could not register this shortcut.")
                XCTAssertEqual(store.storedDisplayBinding(), show)
                XCTAssertEqual(store.storedDisplayBinding(action: .dismiss), dismiss)
            }
        }
    }

    @MainActor
    func testAcceptedSharedRestoreRegistersOnceAndClearsBothInactiveStatusesOnRetry() {
        let fixture = RegistrationFixture()
        let shortcut = WidgetLaunchShortcutStore.defaultDisplayShortcut
        let store = WidgetLaunchShortcutStore(defaults: defaults)
        store.setDisplay(shortcut)
        let delegate = AppDelegate(defaults: defaults, registerHotKey: fixture.register) { fixture.events.append($0) }
        fixture.fail = shortcut
        delegate.widgetOptionsChanged([])
        XCTAssertEqual(fixture.attempts, [shortcut])
        XCTAssertNotNil(delegate.settingsContext.displayShortcutStatuses[.display])
        XCTAssertNotNil(delegate.settingsContext.displayShortcutStatuses[.displayDismiss])

        fixture.fail = nil
        delegate.widgetOptionsChanged([])
        delegate.widgetOptionsChanged([])
        XCTAssertEqual(fixture.attempts, [shortcut, shortcut], "Retry once, then reuse the working shared token")
        XCTAssertTrue(delegate.settingsContext.displayShortcutStatuses.isEmpty)
        fixture.handlers[shortcut]?()
        XCTAssertEqual(fixture.events, [nil])
    }

    @MainActor
    func testClearingAnActionPersistsAcrossReloadWithAnUnavailableUnchangedPartner() {
        for recording in [false, true] {
            for action: WidgetShortcutAction in [.show, .dismiss] {
                verifyEditWithUnavailablePartner(action: action, edit: .clear, recording: recording)
            }
        }
    }

    @MainActor
    func testFreeKeyEditPersistsAcrossReloadWithAnUnavailableUnchangedPartner() {
        for recording in [false, true] {
            for action: WidgetShortcutAction in [.show, .dismiss] {
                verifyEditWithUnavailablePartner(action: action, edit: .freeKey, recording: recording)
            }
        }
    }

    @MainActor
    func testExplicitAssignmentToUnavailablePartnerStillRejectsAndPreservesTheOldKey() {
        for recording in [false, true] {
            for action: WidgetShortcutAction in [.show, .dismiss] {
                verifyEditWithUnavailablePartner(action: action, edit: .unavailablePartner, recording: recording)
            }
        }
    }

    @MainActor
    func testFailedRequestedReplacementRollsBackWithAnUnavailableUnchangedPartner() {
        for recording in [false, true] {
            for action: WidgetShortcutAction in [.show, .dismiss] {
                verifyEditWithUnavailablePartner(action: action, edit: .failedFreeKey, recording: recording)
            }
        }
    }

    @MainActor
    func testClearBeforeAnyInventoryDoesNotAttemptTheUnchangedSavedPartner() {
        for action: WidgetShortcutAction in [.show, .dismiss] {
            defaults.removePersistentDomain(forName: suiteName)
            let fixture = RegistrationFixture()
            let store = WidgetLaunchShortcutStore(defaults: defaults)
            let show = DashboardShortcut(keyCode: 2, modifiers: WidgetLaunchShortcutStore.defaultModifiers)
            let dismiss = DashboardShortcut(keyCode: 3, modifiers: show.modifiers)
            let partner = action == .show ? dismiss : show
            let none = DashboardShortcut(keyCode: -1, modifiers: 0)
            store.setDisplay(show)
            store.setDisplay(dismiss, action: .dismiss)
            fixture.fail = partner
            let delegate = AppDelegate(defaults: defaults, registerHotKey: fixture.register)

            delegate.settingsContext.setDisplayShortcut(none, action: action)

            XCTAssertEqual(store.storedDisplayBinding(action: action), none)
            XCTAssertTrue(fixture.attempts.isEmpty)
            delegate.widgetOptionsChanged([])
            XCTAssertEqual(fixture.attempts, [partner])
            XCTAssertTrue(fixture.liveKeys.isEmpty)
        }
    }

    @MainActor
    func testChoosingAFormerlyInactivePartnerRegistersOnceAndClearsBothInactiveStatuses() {
        for action: WidgetShortcutAction in [.show, .dismiss] {
            defaults.removePersistentDomain(forName: suiteName)
            let fixture = RegistrationFixture()
            let store = WidgetLaunchShortcutStore(defaults: defaults)
            let show = DashboardShortcut(keyCode: 2, modifiers: WidgetLaunchShortcutStore.defaultModifiers)
            let dismiss = DashboardShortcut(keyCode: 3, modifiers: show.modifiers)
            let partner = action == .show ? dismiss : show
            store.setDisplay(show)
            store.setDisplay(dismiss, action: .dismiss)
            fixture.fail = partner
            let delegate = AppDelegate(defaults: defaults, registerHotKey: fixture.register) { fixture.events.append($0) }
            delegate.widgetOptionsChanged([CompactWidgetOption(widgetType: 7, title: "Timer")])
            fixture.attempts.removeAll()
            fixture.fail = nil

            delegate.settingsContext.setDisplayShortcut(partner, action: action)

            XCTAssertEqual(fixture.attempts, [partner])
            XCTAssertTrue(delegate.settingsContext.displayShortcutStatuses.isEmpty, "The newly working shared key serves both actions")
            XCTAssertEqual(delegate.settingsContext.displayShortcuts, WidgetShortcutBinding(show: partner, dismiss: partner))
            fixture.handlers[partner]?()
            XCTAssertEqual(fixture.events, [nil])
        }
    }

    private enum UnavailablePartnerEdit { case clear, freeKey, unavailablePartner, failedFreeKey }

    @MainActor
    private func verifyEditWithUnavailablePartner(action: WidgetShortcutAction, edit: UnavailablePartnerEdit, recording: Bool) {
        defaults.removePersistentDomain(forName: suiteName)
        let fixture = RegistrationFixture()
        let store = WidgetLaunchShortcutStore(defaults: defaults)
        let modifiers = WidgetLaunchShortcutStore.defaultModifiers
        let show = DashboardShortcut(keyCode: Int(kVK_ANSI_D), modifiers: modifiers)
        let dismiss = DashboardShortcut(keyCode: Int(kVK_ANSI_F), modifiers: modifiers)
        let original = action == .show ? show : dismiss
        let partner = action == .show ? dismiss : show
        let partnerAction: WidgetShortcutAction = action == .show ? .dismiss : .show
        let proposed: DashboardShortcut
        switch edit {
        case .clear: proposed = DashboardShortcut(keyCode: -1, modifiers: 0)
        case .freeKey, .failedFreeKey: proposed = DashboardShortcut(keyCode: Int(kVK_ANSI_G), modifiers: modifiers)
        case .unavailablePartner: proposed = partner
        }
        let shouldSucceed = edit == .clear || edit == .freeKey
        let expected = shouldSucceed ? proposed : original
        let expectedBinding = action == .show
            ? WidgetShortcutBinding(show: expected, dismiss: partner)
            : WidgetShortcutBinding(show: partner, dismiss: expected)
        store.setDisplay(show)
        store.setDisplay(dismiss, action: .dismiss)
        fixture.fail = partner
        let delegate = AppDelegate(defaults: defaults, registerHotKey: { shortcut, handler in
            if edit == .failedFreeKey && shortcut == proposed { throw DashboardHotKeyError.register(-1) }
            return try fixture.register(shortcut, handler: handler)
        }) { fixture.events.append($0) }
        let options = [CompactWidgetOption(widgetType: 7, title: "Timer")]
        delegate.widgetOptionsChanged(options)
        XCTAssertTrue(fixture.liveKeys.contains(original), "Fixture: the edited action has an active accepted key")
        XCTAssertFalse(fixture.liveKeys.contains(partner), "Fixture: only the unchanged partner is unavailable")
        if recording { delegate.settingsContext.shortcutRecordingChanged(true) }
        fixture.attempts.removeAll()

        delegate.settingsContext.setDisplayShortcut(proposed, action: action)
        if recording {
            XCTAssertTrue(fixture.liveKeys.isEmpty)
            delegate.settingsContext.shortcutRecordingChanged(false)
        }

        print("EDIT-UNAVAILABLE-PARTNER action=\(action) edit=\(edit) recording=\(recording) original=\(original.keyCode) partner=\(partner.keyCode) proposed=\(proposed.keyCode) stored=\(String(describing: store.storedDisplayBinding(action: action)?.keyCode)) originalActive=\(fixture.liveKeys.contains(original)) proposedActive=\(fixture.liveKeys.contains(proposed)) partnerActive=\(fixture.liveKeys.contains(partner)) attempts=\(fixture.attempts.map(\.keyCode)) status=\(String(describing: delegate.settingsContext.displayShortcutStatuses[.displayOwner(for: action)]))")
        XCTAssertEqual(store.storedDisplayBinding(action: action), expected, "An unavailable unchanged partner must not veto a clear or a free-key edit")
        XCTAssertEqual(store.storedDisplayBinding(action: partnerAction), partner)
        XCTAssertEqual(delegate.settingsContext.displayShortcuts, expectedBinding)
        XCTAssertEqual(fixture.liveKeys.contains(original), !shouldSucceed)
        XCTAssertEqual(fixture.liveKeys.contains(proposed), shouldSucceed && proposed.isAssigned)
        XCTAssertFalse(fixture.liveKeys.contains(partner))
        XCTAssertEqual(delegate.settingsContext.displayShortcutStatuses[.displayOwner(for: action)],
                       shouldSucceed ? nil : "Unavailable — the previous shortcut remains active.")
        XCTAssertEqual(delegate.settingsContext.displayShortcutStatuses[.displayOwner(for: partnerAction)],
                       "Inactive — macOS could not register this shortcut.")
        fixture.handlers[original]?()
        XCTAssertEqual(fixture.events, shouldSucceed ? [] : [action], "A successful edit must revoke the old key")
        fixture.events.removeAll()
        fixture.handlers[proposed]?()
        XCTAssertEqual(fixture.events, shouldSucceed && proposed.isAssigned ? [action] : [])

        // Reload through a new AppDelegate/store and registrar, not the settings
        // view's accepted values. This is an in-process preferences reload.
        let reloadedFixture = RegistrationFixture()
        reloadedFixture.fail = partner
        let reloaded = AppDelegate(defaults: defaults, registerHotKey: reloadedFixture.register) { reloadedFixture.events.append($0) }
        reloaded.widgetOptionsChanged(options)
        XCTAssertEqual(WidgetLaunchShortcutStore(defaults: defaults).storedDisplayBinding(action: action), expected)
        XCTAssertEqual(reloaded.settingsContext.displayShortcuts, expectedBinding)
        XCTAssertEqual(reloadedFixture.liveKeys.contains(original), !shouldSucceed)
        XCTAssertEqual(reloadedFixture.liveKeys.contains(proposed), shouldSucceed && proposed.isAssigned)
        XCTAssertFalse(reloadedFixture.liveKeys.contains(partner))
        reloadedFixture.handlers[original]?()
        XCTAssertEqual(reloadedFixture.events, shouldSucceed ? [] : [action])
        reloadedFixture.events.removeAll()
        reloadedFixture.handlers[proposed]?()
        XCTAssertEqual(reloadedFixture.events, shouldSucceed && proposed.isAssigned ? [action] : [])
        print("EDIT-UNAVAILABLE-PARTNER reload action=\(action) edit=\(edit) recording=\(recording) stored=\(String(describing: WidgetLaunchShortcutStore(defaults: defaults).storedDisplayBinding(action: action)?.keyCode)) originalActive=\(reloadedFixture.liveKeys.contains(original)) proposedActive=\(reloadedFixture.liveKeys.contains(proposed)) partnerActive=\(reloadedFixture.liveKeys.contains(partner))")
    }

    @MainActor
    func testDelegateDispatchesBothSavedKeysWithoutTeacherInventoryAndRollsBackFailedEdit() {
        let fixture = RegistrationFixture()
        let show = DashboardShortcut(keyCode: 2, modifiers: WidgetLaunchShortcutStore.defaultModifiers)
        let dismiss = DashboardShortcut(keyCode: 3, modifiers: show.modifiers)
        let unavailable = DashboardShortcut(keyCode: 4, modifiers: show.modifiers)
        let store = WidgetLaunchShortcutStore(defaults: defaults)
        store.setDisplay(show)
        store.setDisplay(dismiss, action: .dismiss)
        let delegate = AppDelegate(defaults: defaults, registerHotKey: fixture.register) { fixture.events.append($0) }
        delegate.widgetOptionsChanged([])
        fixture.handlers[dismiss]?()
        fixture.handlers[show]?()
        XCTAssertEqual(fixture.events, [.dismiss, .show])
        delegate.widgetOptionsChanged([CompactWidgetOption(widgetType: 7, title: "Timer")])
        fixture.fail = unavailable
        delegate.settingsContext.setDisplayShortcut(unavailable, action: .dismiss)
        XCTAssertEqual(store.storedDisplayBinding(action: .dismiss), dismiss)
        XCTAssertEqual(delegate.settingsContext.displayShortcuts?.dismiss, dismiss)
        XCTAssertEqual(delegate.settingsContext.displayShortcutStatuses[.displayDismiss], "Unavailable — the previous shortcut remains active.")
        fixture.handlers[dismiss]?()
        XCTAssertEqual(fixture.events, [.dismiss, .show, .dismiss])
    }

    @MainActor
    func testDelegateRecordingDefersDismissAndKeepsDuplicateFeedbackAfterResume() {
        let fixture = RegistrationFixture()
        let delegate = AppDelegate(defaults: defaults, registerHotKey: fixture.register) { fixture.events.append($0) }
        delegate.widgetOptionsChanged([CompactWidgetOption(widgetType: 7, title: "Timer")])
        let context = delegate.settingsContext
        let preferred = WidgetLaunchShortcutStore.defaultDisplayShortcut
        let custom = DashboardShortcut(keyCode: 2, modifiers: preferred.modifiers)
        context.shortcutRecordingChanged(true)
        context.shortcutRecordingChanged(true)
        context.setDisplayShortcut(custom, action: .dismiss)
        context.setSettingsShortcut(custom)
        XCTAssertNotNil(context.shortcutStatus)
        XCTAssertTrue(fixture.liveKeys.isEmpty)
        context.shortcutRecordingChanged(false)
        XCTAssertTrue(fixture.liveKeys.isEmpty)
        context.shortcutRecordingChanged(false)
        XCTAssertEqual(context.displayShortcuts, WidgetShortcutBinding(show: preferred, dismiss: custom))
        XCTAssertEqual(WidgetLaunchShortcutStore(defaults: defaults).storedDisplayBinding(action: .dismiss), custom)
        XCTAssertNotNil(context.shortcutStatus)
        fixture.handlers[custom]?()
        fixture.handlers[preferred]?()
        XCTAssertEqual(fixture.events, [.dismiss, .show])
    }

    @MainActor
    func testPendingDismissCannotDisplaceFirstInventoryDefaultsAndClearingDoesNotWait() {
        let fixture = RegistrationFixture()
        let delegate = AppDelegate(defaults: defaults, registerHotKey: fixture.register)
        let context = delegate.settingsContext
        let firstWidget = DashboardShortcut(keyCode: Int(kVK_ANSI_1), modifiers: WidgetLaunchShortcutStore.defaultModifiers)
        context.setDisplayShortcut(firstWidget, action: .dismiss)
        XCTAssertTrue(fixture.liveKeys.isEmpty)
        XCTAssertNil(WidgetLaunchShortcutStore(defaults: defaults).storedDisplayBinding(action: .dismiss))
        delegate.widgetOptionsChanged([CompactWidgetOption(widgetType: 7, title: "Timer")])
        XCTAssertEqual(context.widgetShortcuts[7]?.show, firstWidget)
        XCTAssertNotNil(context.displayShortcutStatuses[.displayDismiss])
        XCTAssertNotEqual(context.displayShortcuts?.dismiss, firstWidget)

        let otherDefaults = UserDefaults(suiteName: suiteName + ".clear")!
        defer { otherDefaults.removePersistentDomain(forName: suiteName + ".clear") }
        let other = AppDelegate(defaults: otherDefaults, registerHotKey: fixture.register)
        let none = DashboardShortcut(keyCode: -1, modifiers: 0)
        other.settingsContext.setDisplayShortcut(none, action: .dismiss)
        XCTAssertEqual(WidgetLaunchShortcutStore(defaults: otherDefaults).storedDisplayBinding(action: .dismiss), none)
    }

    @MainActor
    func testRejectedFirstDismissEditKeepsTheInheritedDefaultInMemoryAndOnRelaunch() {
        let fixture = RegistrationFixture()
        let delegate = AppDelegate(defaults: defaults, registerHotKey: fixture.register)
        let unavailable = DashboardShortcut(keyCode: 3, modifiers: WidgetLaunchShortcutStore.defaultModifiers)
        fixture.fail = unavailable
        delegate.settingsContext.setDisplayShortcut(unavailable, action: .dismiss)
        delegate.widgetOptionsChanged([CompactWidgetOption(widgetType: 7, title: "Timer")])
        let stored = WidgetLaunchShortcutStore(defaults: defaults).storedDisplayBinding(action: .dismiss)
        XCTAssertEqual(stored, WidgetLaunchShortcutStore.defaultDisplayShortcut)
        XCTAssertEqual(delegate.settingsContext.displayShortcuts?.dismiss, stored)
    }

    @MainActor
    func testResetRestoresBothDisplayKeysButPreservesConflictingSavedSettings() {
        let fixture = RegistrationFixture()
        let store = WidgetLaunchShortcutStore(defaults: defaults)
        let custom = DashboardShortcut(keyCode: 2, modifiers: WidgetLaunchShortcutStore.defaultModifiers)
        let none = DashboardShortcut(keyCode: -1, modifiers: 0)
        store.setDisplay(custom)
        store.setDisplay(none, action: .dismiss)
        let delegate = AppDelegate(defaults: defaults, registerHotKey: fixture.register)
        delegate.widgetOptionsChanged([CompactWidgetOption(widgetType: 7, title: "Timer")])
        let context = delegate.settingsContext
        let preferred = WidgetLaunchShortcutStore.defaultDisplayShortcut
        context.setSettingsShortcut(preferred)
        context.resetWidgetShortcuts()
        XCTAssertEqual(context.displayShortcuts, WidgetShortcutBinding(show: custom, dismiss: none))
        XCTAssertEqual(defaults.integer(forKey: DashboardSettingKeys.settingsShortcutKeyCode), preferred.keyCode)
        XCTAssertNotNil(context.displayShortcutStatuses[.display])

        context.setSettingsShortcut(DashboardShortcut(keyCode: DashboardDefaults.settingsShortcutKeyCode, modifiers: DashboardDefaults.shortcutModifiers))
        context.resetWidgetShortcuts()
        XCTAssertEqual(context.displayShortcuts, WidgetShortcutBinding(show: preferred, dismiss: preferred))
        XCTAssertEqual(store.storedDisplayBinding(), preferred)
        XCTAssertEqual(store.storedDisplayBinding(action: .dismiss), preferred)
        XCTAssertEqual(context.widgetOptions.map(\.widgetType), [7])
    }

    @MainActor
    func testOneResetAllocatesAllNineDefaultsAfterReleasingOldDisplayNumberKeys() {
        verifyResetAllocation()
    }

    @MainActor
    func testFailedDisplayResetKeepsOldNumberKeysReserved() {
        verifyResetAllocation(displayUnavailable: true)
    }

    @MainActor
    func testResetDuringNestedRecordingUsesTheFinalDisplayRegistrationOutcome() {
        verifyResetAllocation(recording: true)
        defaults.removePersistentDomain(forName: suiteName)
        verifyResetAllocation(recording: true, displayUnavailable: true)
    }

    @MainActor
    func testResetBeforeFirstInventoryWaitsForInventoryAndFinalRecordingResume() {
        for recording in [false, true] {
            for unavailable in [false, true] {
                defaults.removePersistentDomain(forName: suiteName)
                verifyResetAllocation(recording: recording, inventoryPending: true, displayUnavailable: unavailable)
            }
        }
    }

    @MainActor
    func testRecordingCanResumeBeforeTheQueuedResetReceivesItsFirstInventory() {
        for unavailable in [false, true] {
            defaults.removePersistentDomain(forName: suiteName)
            verifyResetAllocation(recording: true, inventoryPending: true, displayUnavailable: unavailable, resumeBeforeInventory: true)
        }
    }

    @MainActor
    private func verifyResetAllocation(
        recording: Bool = false,
        inventoryPending: Bool = false,
        displayUnavailable: Bool = false,
        resumeBeforeInventory: Bool = false
    ) {
        let fixture = RegistrationFixture()
        let store = WidgetLaunchShortcutStore(defaults: defaults)
        let modifiers = WidgetLaunchShortcutStore.defaultModifiers
        let show = DashboardShortcut(keyCode: Int(kVK_ANSI_1), modifiers: modifiers)
        let dismiss = DashboardShortcut(keyCode: Int(kVK_ANSI_2), modifiers: modifiers)
        let preferred = DashboardShortcut(keyCode: Int(kVK_ANSI_0), modifiers: modifiers)
        let options = [7, 23, 3, 91, 12, 8, 43, 17, 6].map { CompactWidgetOption(widgetType: $0, title: "Widget \($0)") }
        store.setDisplay(show)
        store.setDisplay(dismiss, action: .dismiss)
        let delegate = AppDelegate(defaults: defaults, registerHotKey: fixture.register)
        delegate.widgetOptionsChanged(inventoryPending ? [] : options)
        let context = delegate.settingsContext
        if recording {
            context.shortcutRecordingChanged(true)
            context.shortcutRecordingChanged(true)
        }
        if displayUnavailable { fixture.fail = preferred }
        let beforeReset = store.storedBindings()
        context.resetWidgetShortcuts()
        if recording || inventoryPending {
            XCTAssertEqual(store.storedDisplayBinding(), show, "Reset waits until registration and inventory are available")
            XCTAssertEqual(store.storedDisplayBinding(action: .dismiss), dismiss)
            XCTAssertEqual(store.storedBindings(), beforeReset, "Do not persist provisional defaults from old Display reservations")
        }
        if inventoryPending && !resumeBeforeInventory { delegate.widgetOptionsChanged(options) }
        if recording {
            context.shortcutRecordingChanged(false)
            XCTAssertTrue(fixture.liveKeys.isEmpty, "Nested recorder still owns the suspension")
            XCTAssertEqual(store.storedDisplayBinding(), show)
            context.shortcutRecordingChanged(false)
        }
        if resumeBeforeInventory {
            XCTAssertEqual(store.storedDisplayBinding(), show)
            XCTAssertEqual(store.storedBindings(), beforeReset)
            delegate.widgetOptionsChanged(options)
        }

        let expectedDisplay = displayUnavailable
            ? WidgetShortcutBinding(show: show, dismiss: dismiss)
            : WidgetShortcutBinding(show: preferred, dismiss: preferred)
        let expectedCodes = displayUnavailable
            ? [kVK_ANSI_3, kVK_ANSI_4, kVK_ANSI_5, kVK_ANSI_6, kVK_ANSI_7, kVK_ANSI_8, kVK_ANSI_9, -1, -1]
            : [kVK_ANSI_1, kVK_ANSI_2, kVK_ANSI_3, kVK_ANSI_4, kVK_ANSI_5, kVK_ANSI_6, kVK_ANSI_7, kVK_ANSI_8, kVK_ANSI_9]
        XCTAssertEqual(context.displayShortcuts, expectedDisplay)
        XCTAssertEqual(store.storedDisplayBinding(), expectedDisplay.show)
        XCTAssertEqual(store.storedDisplayBinding(action: .dismiss), expectedDisplay.dismiss)
        for (option, code) in zip(options, expectedCodes) {
            let shortcut = DashboardShortcut(keyCode: Int(code), modifiers: code < 0 ? 0 : modifiers)
            let binding = WidgetShortcutBinding(show: shortcut, dismiss: shortcut)
            XCTAssertEqual(context.widgetShortcuts[option.widgetType], binding, "One Reset must allocate the final free number keys in inventory order")
            XCTAssertEqual(store.storedBindings()[option.widgetType], binding)
            if shortcut.isAssigned { XCTAssertTrue(fixture.liveKeys.contains(shortcut)) }
        }
        XCTAssertTrue(fixture.liveKeys.contains(expectedDisplay.show))
        XCTAssertTrue(fixture.liveKeys.contains(expectedDisplay.dismiss))
        print("RESET recording=\(recording) firstInventoryPending=\(inventoryPending) resumeBeforeInventory=\(resumeBeforeInventory) displayUnavailable=\(displayUnavailable) display=\(String(describing: context.displayShortcuts)) widgetCodes=\(options.compactMap { context.widgetShortcuts[$0.widgetType]?.show.keyCode })")
    }

    @MainActor
    func testResetReclaimsAnInventoryWidgetsZeroButReservesSettingsAndNonInventoryNumbers() {
        let fixture = RegistrationFixture()
        let store = WidgetLaunchShortcutStore(defaults: defaults)
        let modifiers = WidgetLaunchShortcutStore.defaultModifiers
        defaults.set(Int(kVK_ANSI_1), forKey: DashboardSettingKeys.settingsShortcutKeyCode)
        defaults.set(modifiers, forKey: DashboardSettingKeys.settingsShortcutModifiers)
        let two = DashboardShortcut(keyCode: Int(kVK_ANSI_2), modifiers: modifiers)
        let zero = DashboardShortcut(keyCode: Int(kVK_ANSI_0), modifiers: modifiers)
        store.set(two, action: .dismiss, for: 99)
        store.set(zero, action: .show, for: 7)
        store.setDisplay(DashboardShortcut(keyCode: Int(kVK_ANSI_D), modifiers: modifiers))
        let options = [7, 23, 3, 91, 12, 8, 43, 17, 6].map { CompactWidgetOption(widgetType: $0, title: "Widget \($0)") }
        let delegate = AppDelegate(defaults: defaults, registerHotKey: fixture.register)
        delegate.widgetOptionsChanged(options)
        delegate.settingsContext.resetWidgetShortcuts()

        XCTAssertEqual(delegate.settingsContext.displayShortcuts, WidgetShortcutBinding(show: zero, dismiss: zero))
        XCTAssertEqual(options.compactMap { store.storedBindings()[$0.widgetType]?.show.keyCode },
                       [kVK_ANSI_3, kVK_ANSI_4, kVK_ANSI_5, kVK_ANSI_6, kVK_ANSI_7, kVK_ANSI_8, kVK_ANSI_9, -1, -1])
        XCTAssertEqual(defaults.integer(forKey: DashboardSettingKeys.settingsShortcutKeyCode), Int(kVK_ANSI_1))
        XCTAssertEqual(store.storedBindings()[99]?.dismiss, two)
    }

    @MainActor
    func testDeferredResetPreservesASettingsCandidateThatOwnsDisplayDefaultOnResume() {
        let fixture = RegistrationFixture()
        let store = WidgetLaunchShortcutStore(defaults: defaults)
        let custom = DashboardShortcut(keyCode: Int(kVK_ANSI_D), modifiers: WidgetLaunchShortcutStore.defaultModifiers)
        let preferred = WidgetLaunchShortcutStore.defaultDisplayShortcut
        store.setDisplay(custom)
        let delegate = AppDelegate(defaults: defaults, registerHotKey: fixture.register)
        delegate.widgetOptionsChanged([CompactWidgetOption(widgetType: 7, title: "Timer")])
        let context = delegate.settingsContext
        context.shortcutRecordingChanged(true)
        context.setSettingsShortcut(preferred)
        context.resetWidgetShortcuts()
        context.shortcutRecordingChanged(false)

        XCTAssertEqual(defaults.integer(forKey: DashboardSettingKeys.settingsShortcutKeyCode), preferred.keyCode)
        XCTAssertEqual(context.displayShortcuts, WidgetShortcutBinding(show: custom, dismiss: custom))
        XCTAssertNotNil(context.displayShortcutStatuses[.display])
        XCTAssertNotNil(context.displayShortcutStatuses[.displayDismiss])
        XCTAssertTrue(fixture.liveKeys.contains(preferred))
        XCTAssertTrue(fixture.liveKeys.contains(custom))
    }

    @MainActor
    func testResetKeepsAPendingChoiceForAWidgetOutsideCurrentInventoryReserved() {
        let fixture = RegistrationFixture()
        let store = WidgetLaunchShortcutStore(defaults: defaults)
        let custom = DashboardShortcut(keyCode: Int(kVK_ANSI_D), modifiers: WidgetLaunchShortcutStore.defaultModifiers)
        let preferred = WidgetLaunchShortcutStore.defaultDisplayShortcut
        store.setDisplay(custom)
        let delegate = AppDelegate(defaults: defaults, registerHotKey: fixture.register)
        let timer = CompactWidgetOption(widgetType: 7, title: "Timer")
        let hidden = CompactWidgetOption(widgetType: 99, title: "Hidden")
        delegate.widgetOptionsChanged([hidden, timer])
        let context = delegate.settingsContext
        context.shortcutRecordingChanged(true)
        context.setWidgetShortcut(preferred, action: .dismiss, for: 99)
        delegate.widgetOptionsChanged([timer])
        context.resetWidgetShortcuts()
        context.shortcutRecordingChanged(false)

        XCTAssertEqual(context.displayShortcuts, WidgetShortcutBinding(show: custom, dismiss: custom))
        XCTAssertNotNil(context.displayShortcutStatuses[.display])
        XCTAssertEqual(store.storedBindings()[99]?.show.keyCode, Int(kVK_ANSI_1))
        XCTAssertEqual(context.widgetShortcuts[7]?.show.keyCode, Int(kVK_ANSI_2))
        delegate.widgetOptionsChanged([hidden, timer])
        context.shortcutRecordingChanged(true)
        context.shortcutRecordingChanged(false)
        XCTAssertEqual(store.storedBindings()[99]?.dismiss, preferred, "Reset must not discard the hidden widget's pending edit")
    }

    @MainActor
    func testResetPreservesNonInventoryDismissReservationAndPendingSettingsCandidate() {
        let fixture = RegistrationFixture()
        let store = WidgetLaunchShortcutStore(defaults: defaults)
        let preferred = WidgetLaunchShortcutStore.defaultDisplayShortcut
        let custom = DashboardShortcut(keyCode: 2, modifiers: preferred.modifiers)
        store.setDisplay(custom)
        store.set(preferred, action: .dismiss, for: 99)
        let delegate = AppDelegate(defaults: defaults, registerHotKey: fixture.register)
        delegate.widgetOptionsChanged([CompactWidgetOption(widgetType: 7, title: "Timer")])
        delegate.settingsContext.resetWidgetShortcuts()
        XCTAssertEqual(delegate.settingsContext.displayShortcuts?.show, custom)
        XCTAssertEqual(store.storedBindings()[99]?.dismiss, preferred)

        delegate.settingsContext.shortcutRecordingChanged(true)
        let pending = DashboardShortcut(keyCode: 3, modifiers: preferred.modifiers)
        delegate.settingsContext.setSettingsShortcut(pending)
        delegate.settingsContext.setDisplayShortcut(pending, action: .dismiss)
        XCTAssertNotNil(delegate.settingsContext.displayShortcutStatuses[.displayDismiss])
        delegate.settingsContext.shortcutRecordingChanged(false)
        XCTAssertNotEqual(store.storedDisplayBinding(action: .dismiss), pending)
    }
}

@MainActor
private final class RegistrationFixture {
    private final class Token {}
    private struct WeakToken { weak var value: AnyObject? }
    private var tokens: [DashboardShortcut: WeakToken] = [:]
    var handlers: [DashboardShortcut: @MainActor () -> Void] = [:]
    var events: [WidgetShortcutAction?] = []
    var attempts: [DashboardShortcut] = []
    var fail: DashboardShortcut?
    var liveKeys: Set<DashboardShortcut> { Set(tokens.compactMap { $0.value.value == nil ? nil : $0.key }) }
    lazy var registration = DisplayShortcutRegistration(register: register, perform: { [unowned self] in events.append($0) })

    func register(_ shortcut: DashboardShortcut, handler: @escaping @MainActor () -> Void) throws -> AnyObject {
        attempts.append(shortcut)
        if shortcut == fail { throw DashboardHotKeyError.register(-1) }
        XCTAssertNil(tokens[shortcut]?.value, "Never double-register an owned key")
        let token = Token()
        tokens[shortcut] = WeakToken(value: token)
        handlers[shortcut] = handler
        return token
    }
}
