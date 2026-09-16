import AppKit
import Carbon
import Foundation

struct DashboardShortcut: Codable, Equatable, Hashable {
    let keyCode: Int
    let modifiers: Int

    var isAssigned: Bool { keyCode >= 0 }

    var normalized: DashboardShortcut {
        let flags = NSEvent.ModifierFlags(rawValue: UInt(modifiers)).intersection(.deviceIndependentFlagsMask)
        return DashboardShortcut(keyCode: keyCode, modifiers: keyCode < 0 ? 0 : Int(flags.rawValue))
    }
}

enum WidgetShortcutAction: Equatable {
    case show
    case dismiss
}

struct WidgetShortcutBinding: Codable, Equatable {
    var show: DashboardShortcut
    var dismiss: DashboardShortcut
}

struct WidgetShortcutRegistrationResults {
    let show: Bool
    let dismiss: Bool

    func accepts(_ shortcut: DashboardShortcut, action: WidgetShortcutAction) -> Bool {
        guard shortcut.isAssigned else { return true }
        switch action {
        case .show: return show
        case .dismiss: return dismiss
        }
    }
}

struct WidgetLaunchShortcutStore {
    static let storageKey = "widgetLaunchShortcuts"
    static let initializedKey = "widgetLaunchShortcutsInitialized"
    static let defaultKeyCodes = [kVK_ANSI_1, kVK_ANSI_2, kVK_ANSI_3, kVK_ANSI_4, kVK_ANSI_5,
                                  kVK_ANSI_6, kVK_ANSI_7, kVK_ANSI_8, kVK_ANSI_9].map { Int($0) }
    static let defaultModifiers = Int(NSEvent.ModifierFlags([.command, .option, .control]).rawValue)
    static let displayKeyCodeKey = "displayPreviewShortcutKeyCode"
    static let displayModifiersKey = "displayPreviewShortcutModifiers"
    static let displayInitializedKey = "displayPreviewShortcutInitialized"

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func bindings(
        for options: [CompactWidgetOption],
        reserving additionalShortcuts: [DashboardShortcut] = []
    ) -> [Int: WidgetShortcutBinding] {
        var bindings = load()
        var changed = false
        var reserved = Set(additionalShortcuts.map(\.normalized).filter(\.isAssigned))
        for binding in bindings.values {
            if binding.show.isAssigned { reserved.insert(binding.show.normalized) }
            if binding.dismiss.isAssigned { reserved.insert(binding.dismiss.normalized) }
        }
        for option in options.prefix(9) where bindings[option.widgetType] == nil {
            guard let keyCode = Self.defaultKeyCodes.first(where: {
                !reserved.contains(DashboardShortcut(keyCode: $0, modifiers: Self.defaultModifiers).normalized)
            }) else { continue }
            let shortcut = DashboardShortcut(keyCode: keyCode, modifiers: Self.defaultModifiers)
            bindings[option.widgetType] = WidgetShortcutBinding(show: shortcut, dismiss: shortcut)
            reserved.insert(shortcut.normalized)
            changed = true
        }
        if !options.isEmpty && (!defaults.bool(forKey: Self.initializedKey) || changed) {
            defaults.set(true, forKey: Self.initializedKey)
            save(bindings)
        }
        let unassigned = DashboardShortcut(keyCode: -1, modifiers: 0)
        for option in options where bindings[option.widgetType] == nil {
            bindings[option.widgetType] = WidgetShortcutBinding(show: unassigned, dismiss: unassigned)
        }
        return bindings
    }

    func set(_ shortcut: DashboardShortcut, action: WidgetShortcutAction, for widgetType: Int) {
        var bindings = load()
        let unassigned = DashboardShortcut(keyCode: -1, modifiers: 0)
        var binding = bindings[widgetType] ?? WidgetShortcutBinding(show: unassigned, dismiss: unassigned)
        switch action {
        case .show: binding.show = shortcut.normalized
        case .dismiss: binding.dismiss = shortcut.normalized
        }
        bindings[widgetType] = binding
        save(bindings)
    }

    func displayBinding(reserving reserved: Set<DashboardShortcut>) -> DashboardShortcut {
        if defaults.bool(forKey: Self.displayInitializedKey) {
            return DashboardShortcut(
                keyCode: defaults.integer(forKey: Self.displayKeyCodeKey),
                modifiers: defaults.integer(forKey: Self.displayModifiersKey)
            ).normalized
        }
        let preferred = DashboardShortcut(keyCode: Int(kVK_ANSI_0), modifiers: Self.defaultModifiers)
        return reserved.contains(preferred) ? DashboardShortcut(keyCode: -1, modifiers: 0) : preferred
    }

    func setDisplay(_ shortcut: DashboardShortcut) {
        let shortcut = shortcut.normalized
        defaults.set(shortcut.keyCode, forKey: Self.displayKeyCodeKey)
        defaults.set(shortcut.modifiers, forKey: Self.displayModifiersKey)
        defaults.set(true, forKey: Self.displayInitializedKey)
    }

    func reset(options: [CompactWidgetOption], reserving additionalShortcuts: [DashboardShortcut] = []) {
        let widgetTypes = options.map(\.widgetType)
        var bindings = load()
        let unassigned = DashboardShortcut(keyCode: -1, modifiers: 0)
        for widgetType in widgetTypes { bindings[widgetType] = WidgetShortcutBinding(show: unassigned, dismiss: unassigned) }
        var reserved = Set(additionalShortcuts.map(\.normalized).filter(\.isAssigned))
        for binding in bindings.values {
            if binding.show.isAssigned { reserved.insert(binding.show.normalized) }
            if binding.dismiss.isAssigned { reserved.insert(binding.dismiss.normalized) }
        }
        for widgetType in widgetTypes.prefix(9) {
            guard let keyCode = Self.defaultKeyCodes.first(where: {
                !reserved.contains(DashboardShortcut(keyCode: $0, modifiers: Self.defaultModifiers).normalized)
            }) else { continue }
            let shortcut = DashboardShortcut(keyCode: keyCode, modifiers: Self.defaultModifiers)
            bindings[widgetType] = WidgetShortcutBinding(show: shortcut, dismiss: shortcut)
            reserved.insert(shortcut.normalized)
        }
        defaults.set(true, forKey: Self.initializedKey)
        save(bindings)
    }

    private func load() -> [Int: WidgetShortcutBinding] {
        guard let data = defaults.data(forKey: Self.storageKey) else { return [:] }
        if let stored = try? JSONDecoder().decode([String: WidgetShortcutBinding].self, from: data) {
            return Dictionary(uniqueKeysWithValues: stored.compactMap { key, value in
                Int(key).map { ($0, WidgetShortcutBinding(show: value.show.normalized, dismiss: value.dismiss.normalized)) }
            })
        }
        guard let legacy = try? JSONDecoder().decode([String: DashboardShortcut].self, from: data) else { return [:] }
        return Dictionary(uniqueKeysWithValues: legacy.compactMap { key, value in
            let shortcut = value.normalized
            return Int(key).map { ($0, WidgetShortcutBinding(show: shortcut, dismiss: shortcut)) }
        })
    }

    private func save(_ bindings: [Int: WidgetShortcutBinding]) {
        let stored = Dictionary(uniqueKeysWithValues: bindings.map {
            (String($0.key), WidgetShortcutBinding(show: $0.value.show.normalized, dismiss: $0.value.dismiss.normalized))
        })
        if let data = try? JSONEncoder().encode(stored) { defaults.set(data, forKey: Self.storageKey) }
    }
}
