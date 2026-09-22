struct ShortcutBindingState {
    enum Owner: Hashable {
        case settings
        case moveWidgetPrevious
        case moveWidgetNext
        case display
        case displayDismiss
        case widget(Int)
        case widgetDismiss(Int)

        static func displayOwner(for action: WidgetShortcutAction) -> Owner {
            action == .show ? .display : .displayDismiss
        }

        func canShareShortcut(with other: Owner) -> Bool {
            switch (self, other) {
            case (.display, .displayDismiss), (.displayDismiss, .display):
                return true
            case let (.widget(left), .widgetDismiss(right)), let (.widgetDismiss(left), .widget(right)):
                return left == right
            default:
                return false
            }
        }
    }

    enum StageResult: Equatable {
        case staged
        case duplicate(Owner)
        case unchanged
    }

    private(set) var accepted: [Owner: DashboardShortcut]
    private(set) var pending: [Owner: DashboardShortcut] = [:]
    private(set) var recorderCount = 0

    init(
        settings: DashboardShortcut,
        display: DashboardShortcut? = nil,
        displayDismiss: DashboardShortcut? = nil,
        moveWidgetPrevious: DashboardShortcut? = nil,
        moveWidgetNext: DashboardShortcut? = nil
    ) {
        accepted = [.settings: settings.normalized]
        if let display { accepted[.display] = display.normalized }
        if let displayDismiss { accepted[.displayDismiss] = displayDismiss.normalized }
        if let moveWidgetPrevious { accepted[.moveWidgetPrevious] = moveWidgetPrevious.normalized }
        if let moveWidgetNext { accepted[.moveWidgetNext] = moveWidgetNext.normalized }
    }

    var registrationsSuspended: Bool { recorderCount > 0 }

    mutating func recorderStarted() -> Bool {
        recorderCount += 1
        return recorderCount == 1
    }

    mutating func recorderEnded() -> Bool {
        guard recorderCount > 0 else { return false }
        recorderCount -= 1
        return recorderCount == 0
    }

    mutating func replaceWidgets(with bindings: [Int: WidgetShortcutBinding], discardPending: Bool = false) {
        accepted = accepted.filter {
            switch $0.key {
            case .settings, .moveWidgetPrevious, .moveWidgetNext, .display, .displayDismiss: true
            case .widget, .widgetDismiss: false
            }
        }
        for (widgetType, binding) in bindings {
            accepted[.widget(widgetType)] = binding.show.normalized
            accepted[.widgetDismiss(widgetType)] = binding.dismiss.normalized
        }
        pending = pending.filter { owner, _ in
            switch owner {
            case let .widget(widgetType), let .widgetDismiss(widgetType):
                return !discardPending && bindings[widgetType] != nil
            case .settings, .moveWidgetPrevious, .moveWidgetNext, .display, .displayDismiss:
                return true
            }
        }
    }

    mutating func setInitialDisplay(_ shortcut: DashboardShortcut, action: WidgetShortcutAction = .show) {
        let owner = Owner.displayOwner(for: action)
        guard accepted[owner] == nil else { return }
        accepted[owner] = shortcut.normalized
    }

    func displayBinding(includingPending: Bool = false) -> WidgetShortcutBinding {
        let none = DashboardShortcut(keyCode: -1, modifiers: 0)
        return WidgetShortcutBinding(
            show: (includingPending ? pending[.display] : nil) ?? accepted[.display] ?? none,
            dismiss: (includingPending ? pending[.displayDismiss] : nil) ?? accepted[.displayDismiss] ?? none
        )
    }

    func assignedShortcuts(excluding owner: Owner) -> Set<DashboardShortcut> {
        Set([accepted, pending].flatMap { bindings in
            bindings.compactMap { existingOwner, shortcut in
                existingOwner == owner || owner.canShareShortcut(with: existingOwner) || !shortcut.isAssigned ? nil : shortcut
            }
        })
    }

    mutating func stage(_ shortcut: DashboardShortcut, for owner: Owner) -> StageResult {
        let shortcut = shortcut.normalized
        if accepted[owner] == shortcut {
            pending[owner] = nil
            return .unchanged
        }
        if shortcut.isAssigned,
           let duplicate = accepted.first(where: { $0.key != owner && !owner.canShareShortcut(with: $0.key) && $0.value == shortcut })?.key
            ?? pending.first(where: { $0.key != owner && !owner.canShareShortcut(with: $0.key) && $0.value == shortcut })?.key {
            pending[owner] = nil
            return .duplicate(duplicate)
        }
        pending[owner] = shortcut
        return .staged
    }

    mutating func complete(_ owner: Owner, succeeded: Bool) {
        guard let candidate = pending.removeValue(forKey: owner) else { return }
        if succeeded { accepted[owner] = candidate }
    }

    func shortcut(for owner: Owner) -> DashboardShortcut? { accepted[owner] }
    func candidate(for owner: Owner) -> DashboardShortcut? { pending[owner] }
}

struct DisplayShortcutStartupGate {
    enum InventoryResolution: Equatable {
        case none
        case applyPending
        case rejectedDuplicate(ShortcutBindingState.Owner)
    }

    private(set) var hasWidgetInventory = false

    func shouldApplyPending(in state: ShortcutBindingState, action: WidgetShortcutAction = .show) -> Bool {
        guard let candidate = state.candidate(for: .displayOwner(for: action)), !state.registrationsSuspended else { return false }
        return !candidate.isAssigned || hasWidgetInventory
    }

    mutating func mergeWidgetBindings(
        _ bindings: [Int: WidgetShortcutBinding],
        inventoryIsReady: Bool,
        into state: inout ShortcutBindingState,
        action: WidgetShortcutAction = .show
    ) -> InventoryResolution {
        let owner = ShortcutBindingState.Owner.displayOwner(for: action)
        let pendingDisplay = state.candidate(for: owner)
        state.replaceWidgets(with: bindings)
        guard inventoryIsReady else { return .none }
        hasWidgetInventory = true
        guard let pendingDisplay else { return .none }
        switch state.stage(pendingDisplay, for: owner) {
        case .staged:
            return shouldApplyPending(in: state, action: action) ? .applyPending : .none
        case let .duplicate(owner):
            return .rejectedDuplicate(owner)
        case .unchanged:
            return .none
        }
    }
}
