struct ShortcutBindingState {
    enum Owner: Hashable {
        case settings
        case widget(Int)
    }

    enum StageResult: Equatable {
        case staged
        case duplicate(Owner)
        case unchanged
    }

    private(set) var accepted: [Owner: DashboardShortcut]
    private(set) var pending: [Owner: DashboardShortcut] = [:]
    private(set) var recorderCount = 0

    init(settings: DashboardShortcut) {
        accepted = [.settings: settings.normalized]
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

    mutating func replaceWidgets(with bindings: [Int: DashboardShortcut], discardPending: Bool = false) {
        accepted = accepted.filter { if case .settings = $0.key { true } else { false } }
        for (widgetType, shortcut) in bindings {
            accepted[.widget(widgetType)] = shortcut.normalized
        }
        pending = pending.filter { owner, _ in
            if case let .widget(widgetType) = owner { return !discardPending && bindings[widgetType] != nil }
            return true
        }
    }

    mutating func stage(_ shortcut: DashboardShortcut, for owner: Owner) -> StageResult {
        let shortcut = shortcut.normalized
        if accepted[owner] == shortcut {
            pending[owner] = nil
            return .unchanged
        }
        if shortcut.isAssigned,
           let duplicate = accepted.first(where: { $0.key != owner && $0.value == shortcut })?.key
            ?? pending.first(where: { $0.key != owner && $0.value == shortcut })?.key {
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
