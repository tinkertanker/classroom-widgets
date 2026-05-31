import AppKit
import Carbon
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var controller: DashboardWindowController?
    private var hotKeys: [DashboardHotKey] = []
    private var statusItem: NSStatusItem?
    private let launchAtLoginManager = LaunchAtLoginManager()
    private lazy var settingsContext = DashboardSettingsContext(
        launchAtLoginManager: launchAtLoginManager,
        onShortcutsChanged: { [weak self] in
            self?.registerHotKeys()
            self?.updateStatusMenu()
        },
        onWindowBehaviorChanged: { [weak self] in
            self?.controller?.applySettings()
        },
        onMenuBarIconChanged: { [weak self] in
            self?.syncStatusItemVisibility()
        },
        onShowDashboard: { [weak self] in
            self?.controller?.showDashboard()
        },
        onShowWidgetLauncher: { [weak self] in
            self?.controller?.showWidgetLauncher()
        }
    )
    private lazy var settingsWindowCoordinator = SettingsWindowCoordinator { [weak self] in
        guard let self else {
            return NSView()
        }

        return NSHostingView(rootView: DashboardSettingsView(context: self.settingsContext))
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        DashboardDefaults.register()
        NSApp.setActivationPolicy(.accessory)

        let controller = DashboardWindowController()
        self.controller = controller
        setupStatusItem()
        registerHotKeys()

        if UserDefaults.standard.bool(forKey: DashboardSettingKeys.showDashboardAtLaunch) {
            controller.showDashboard()
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        hotKeys.removeAll()
    }

    private func setupStatusItem() {
        guard UserDefaults.standard.bool(forKey: DashboardSettingKeys.showMenuBarIcon) else {
            statusItem = nil
            return
        }

        let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        statusItem.button?.image = menuBarIcon()
        statusItem.button?.imagePosition = .imageOnly
        self.statusItem = statusItem
        updateStatusMenu()
    }

    private func syncStatusItemVisibility() {
        let shouldShow = UserDefaults.standard.bool(forKey: DashboardSettingKeys.showMenuBarIcon)

        if shouldShow {
            if statusItem == nil {
                setupStatusItem()
            } else {
                updateStatusMenu()
            }
            return
        }

        if let statusItem {
            NSStatusBar.system.removeStatusItem(statusItem)
        }
        statusItem = nil
    }

    private func menuBarIcon() -> NSImage? {
        let symbolNames = [
            "rectangle.3.group",
            "square.grid.2x2"
        ]
        let configuration = NSImage.SymbolConfiguration(pointSize: 16, weight: .medium)

        for symbolName in symbolNames {
            if let image = NSImage(systemSymbolName: symbolName, accessibilityDescription: "Classroom Widgets")?
                .withSymbolConfiguration(configuration) {
                image.isTemplate = true
                return image
            }
        }

        return nil
    }

    private func updateStatusMenu() {
        let menu = NSMenu()

        let toggleTitle = controller?.isDashboardVisible == true ? "Hide Dashboard" : "Show Dashboard"
        let toggleItem = NSMenuItem(title: toggleTitle, action: #selector(toggleDashboard), keyEquivalent: "")
        toggleItem.target = self
        applyShortcut(
            to: toggleItem,
            keyCode: shortcutKeyCode(for: DashboardSettingKeys.toggleShortcutKeyCode, fallback: DashboardDefaults.toggleShortcutKeyCode),
            modifiers: shortcutModifiers(for: DashboardSettingKeys.toggleShortcutModifiers)
        )
        menu.addItem(toggleItem)

        let launcherItem = NSMenuItem(title: "Open Widget Launcher", action: #selector(showWidgetLauncher), keyEquivalent: "")
        launcherItem.target = self
        applyShortcut(
            to: launcherItem,
            keyCode: shortcutKeyCode(for: DashboardSettingKeys.launcherShortcutKeyCode, fallback: DashboardDefaults.launcherShortcutKeyCode),
            modifiers: shortcutModifiers(for: DashboardSettingKeys.launcherShortcutModifiers)
        )
        menu.addItem(launcherItem)

        menu.addItem(NSMenuItem.separator())

        let settingsItem = NSMenuItem(title: "Settings...", action: #selector(showSettings), keyEquivalent: "")
        settingsItem.target = self
        applyShortcut(
            to: settingsItem,
            keyCode: shortcutKeyCode(for: DashboardSettingKeys.settingsShortcutKeyCode, fallback: DashboardDefaults.settingsShortcutKeyCode),
            modifiers: shortcutModifiers(for: DashboardSettingKeys.settingsShortcutModifiers)
        )
        menu.addItem(settingsItem)

        menu.addItem(NSMenuItem.separator())

        let quitItem = NSMenuItem(title: "Quit Classroom Widgets", action: #selector(quitApp), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)

        statusItem?.menu = menu
    }

    private func applyShortcut(to item: NSMenuItem, keyCode: Int, modifiers: Int) {
        guard let keyEquivalent = DashboardShortcutFormatter.keyEquivalent(for: keyCode) else {
            item.keyEquivalent = ""
            item.keyEquivalentModifierMask = []
            return
        }

        item.keyEquivalent = keyEquivalent
        item.keyEquivalentModifierMask = DashboardShortcutFormatter.modifierFlags(from: modifiers)
    }

    private func registerHotKeys() {
        hotKeys.removeAll()

        let toggleKeyCode = shortcutKeyCode(for: DashboardSettingKeys.toggleShortcutKeyCode, fallback: DashboardDefaults.toggleShortcutKeyCode)
        let toggleModifiers = shortcutModifiers(for: DashboardSettingKeys.toggleShortcutModifiers)
        registerGlobalShortcut(
            id: 1,
            keyCode: toggleKeyCode,
            rawModifiers: toggleModifiers,
            reservedShortcuts: []
        ) { [weak self] in
            self?.controller?.toggleDashboard()
            self?.updateStatusMenu()
        }

        let launcherKeyCode = shortcutKeyCode(for: DashboardSettingKeys.launcherShortcutKeyCode, fallback: DashboardDefaults.launcherShortcutKeyCode)
        let launcherModifiers = shortcutModifiers(for: DashboardSettingKeys.launcherShortcutModifiers)
        registerGlobalShortcut(
            id: 2,
            keyCode: launcherKeyCode,
            rawModifiers: launcherModifiers,
            reservedShortcuts: [(toggleKeyCode, toggleModifiers)]
        ) { [weak self] in
            self?.controller?.showWidgetLauncher()
            self?.updateStatusMenu()
        }

        let settingsKeyCode = shortcutKeyCode(for: DashboardSettingKeys.settingsShortcutKeyCode, fallback: DashboardDefaults.settingsShortcutKeyCode)
        let settingsModifiers = shortcutModifiers(for: DashboardSettingKeys.settingsShortcutModifiers)
        registerGlobalShortcut(
            id: 3,
            keyCode: settingsKeyCode,
            rawModifiers: settingsModifiers,
            reservedShortcuts: [
                (toggleKeyCode, toggleModifiers),
                (launcherKeyCode, launcherModifiers)
            ]
        ) { [weak self] in
            self?.settingsWindowCoordinator.show()
            self?.updateStatusMenu()
        }
    }

    private func registerGlobalShortcut(
        id: UInt32,
        keyCode: Int,
        rawModifiers: Int,
        reservedShortcuts: [(keyCode: Int, modifiers: Int)],
        handler: @escaping () -> Void
    ) {
        guard keyCode != -1 else { return }

        let conflictsWithReservedShortcut = reservedShortcuts.contains { reservedShortcut in
            reservedShortcut.keyCode == keyCode && reservedShortcut.modifiers == rawModifiers
        }
        guard !conflictsWithReservedShortcut else { return }

        if let modifiers = carbonModifiers(from: rawModifiers) {
            registerHotKey(id: id, keyCode: keyCode, modifiers: modifiers, handler: handler)
        }
    }

    private func registerHotKey(id: UInt32, keyCode: Int, modifiers: UInt32, handler: @escaping () -> Void) {
        do {
            let hotKey = try DashboardHotKey(id: id, keyCode: UInt32(keyCode), modifiers: modifiers, handler: handler)
            hotKeys.append(hotKey)
        } catch {
            NSLog("Unable to register dashboard hotkey \(id): \(error)")
        }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showSettings()
        return true
    }

    @objc private func toggleDashboard() {
        controller?.toggleDashboard()
        updateStatusMenu()
    }

    @objc private func showWidgetLauncher() {
        controller?.showWidgetLauncher()
        updateStatusMenu()
    }

    @objc private func showSettings() {
        settingsWindowCoordinator.show()
    }

    @objc private func quitApp() {
        NSApp.terminate(nil)
    }

    private func shortcutKeyCode(for key: String, fallback: Int) -> Int {
        let defaults = UserDefaults.standard
        guard defaults.object(forKey: key) != nil else {
            return fallback
        }

        return defaults.integer(forKey: key)
    }

    private func shortcutModifiers(for key: String) -> Int {
        let defaults = UserDefaults.standard
        guard defaults.object(forKey: key) != nil else {
            return DashboardDefaults.shortcutModifiers
        }

        return defaults.integer(forKey: key)
    }

    private func carbonModifiers(from rawModifiers: Int) -> UInt32? {
        let flags = NSEvent.ModifierFlags(rawValue: UInt(rawModifiers))
        var carbonModifiers: UInt32 = 0
        if flags.contains(.command) { carbonModifiers |= UInt32(cmdKey) }
        if flags.contains(.option) { carbonModifiers |= UInt32(optionKey) }
        if flags.contains(.control) { carbonModifiers |= UInt32(controlKey) }
        if flags.contains(.shift) { carbonModifiers |= UInt32(shiftKey) }

        return carbonModifiers == 0 ? nil : carbonModifiers
    }

}
