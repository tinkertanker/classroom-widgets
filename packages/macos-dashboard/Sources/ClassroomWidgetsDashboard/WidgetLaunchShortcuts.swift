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

struct WidgetLaunchShortcutStore {
    static let storageKey = "widgetLaunchShortcuts"
    static let initializedKey = "widgetLaunchShortcutsInitialized"
    static let defaultKeyCodes = [kVK_ANSI_1, kVK_ANSI_2, kVK_ANSI_3, kVK_ANSI_4, kVK_ANSI_5,
                                  kVK_ANSI_6, kVK_ANSI_7, kVK_ANSI_8, kVK_ANSI_9].map { Int($0) }
    static let defaultModifiers = Int(NSEvent.ModifierFlags([.command, .option, .control]).rawValue)

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func bindings(for options: [CompactWidgetOption]) -> [Int: DashboardShortcut] {
        initializeIfNeeded(options: options)
        return load()
    }

    func set(_ shortcut: DashboardShortcut, for widgetType: Int) {
        var bindings = load()
        bindings[widgetType] = shortcut.normalized
        save(bindings)
    }

    func reset(options: [CompactWidgetOption]) {
        let widgetTypes = options.map(\.widgetType).sorted()
        var bindings = load()
        for widgetType in widgetTypes { bindings[widgetType] = DashboardShortcut(keyCode: -1, modifiers: 0) }
        for (widgetType, keyCode) in zip(widgetTypes.prefix(9), Self.defaultKeyCodes) {
            bindings[widgetType] = DashboardShortcut(keyCode: keyCode, modifiers: Self.defaultModifiers)
        }
        defaults.set(true, forKey: Self.initializedKey)
        save(bindings)
    }

    private func initializeIfNeeded(options: [CompactWidgetOption]) {
        guard !options.isEmpty, !defaults.bool(forKey: Self.initializedKey) else { return }
        var bindings: [Int: DashboardShortcut] = [:]
        for (widgetType, keyCode) in zip(options.map(\.widgetType).sorted().prefix(9), Self.defaultKeyCodes) {
            bindings[widgetType] = DashboardShortcut(keyCode: keyCode, modifiers: Self.defaultModifiers)
        }
        save(bindings)
        defaults.set(true, forKey: Self.initializedKey)
    }

    private func load() -> [Int: DashboardShortcut] {
        guard let data = defaults.data(forKey: Self.storageKey),
              let stored = try? JSONDecoder().decode([String: DashboardShortcut].self, from: data)
        else { return [:] }
        return Dictionary(uniqueKeysWithValues: stored.compactMap { key, value in
            Int(key).map { ($0, value.normalized) }
        })
    }

    private func save(_ bindings: [Int: DashboardShortcut]) {
        let stored = Dictionary(uniqueKeysWithValues: bindings.map { (String($0.key), $0.value.normalized) })
        if let data = try? JSONEncoder().encode(stored) { defaults.set(data, forKey: Self.storageKey) }
    }
}
