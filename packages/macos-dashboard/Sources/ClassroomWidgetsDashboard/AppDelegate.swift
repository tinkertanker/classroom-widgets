import AppKit
import Carbon
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var controller: DashboardWindowController?
    private var hotKeys: [DashboardHotKey] = []
    private var statusItem: NSStatusItem?
    private lazy var settingsContext = DashboardSettingsContext(
        onShortcutsChanged: { [weak self] in
            self?.registerHotKeys()
            self?.updateStatusMenu()
        },
        onWindowBehaviorChanged: { [weak self] in
            self?.controller?.applySettings()
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
        let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        statusItem.button?.image = menuBarIcon()
        statusItem.button?.imagePosition = .imageOnly
        self.statusItem = statusItem
        updateStatusMenu()
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
        toggleItem.attributedTitle = menuTitle(toggleTitle, shortcut: DashboardShortcutFormatter.title(
            keyCode: shortcutKeyCode(for: DashboardSettingKeys.toggleShortcutKeyCode, fallback: DashboardDefaults.toggleShortcutKeyCode),
            modifiers: shortcutModifiers(for: DashboardSettingKeys.toggleShortcutModifiers)
        ))
        menu.addItem(toggleItem)

        let launcherItem = NSMenuItem(title: "Open Widget Launcher", action: #selector(showWidgetLauncher), keyEquivalent: "")
        launcherItem.target = self
        launcherItem.attributedTitle = menuTitle("Open Widget Launcher", shortcut: DashboardShortcutFormatter.title(
            keyCode: shortcutKeyCode(for: DashboardSettingKeys.launcherShortcutKeyCode, fallback: DashboardDefaults.launcherShortcutKeyCode),
            modifiers: shortcutModifiers(for: DashboardSettingKeys.launcherShortcutModifiers)
        ))
        menu.addItem(launcherItem)

        menu.addItem(NSMenuItem.separator())

        let settingsItem = NSMenuItem(title: "Settings...", action: #selector(showSettings), keyEquivalent: ",")
        settingsItem.target = self
        menu.addItem(settingsItem)

        menu.addItem(NSMenuItem.separator())

        let quitItem = NSMenuItem(title: "Quit Classroom Widgets", action: #selector(quitApp), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)

        statusItem?.menu = menu
    }

    private func registerHotKeys() {
        hotKeys.removeAll()

        let toggleKeyCode = shortcutKeyCode(for: DashboardSettingKeys.toggleShortcutKeyCode, fallback: DashboardDefaults.toggleShortcutKeyCode)
        if toggleKeyCode != -1, let modifiers = carbonModifiers(from: shortcutModifiers(for: DashboardSettingKeys.toggleShortcutModifiers)) {
            registerHotKey(id: 1, keyCode: toggleKeyCode, modifiers: modifiers) { [weak self] in
                self?.controller?.toggleDashboard()
                self?.updateStatusMenu()
            }
        }

        let launcherKeyCode = shortcutKeyCode(for: DashboardSettingKeys.launcherShortcutKeyCode, fallback: DashboardDefaults.launcherShortcutKeyCode)
        let launcherModifiers = shortcutModifiers(for: DashboardSettingKeys.launcherShortcutModifiers)
        let conflictsWithToggle = launcherKeyCode == toggleKeyCode &&
            launcherModifiers == shortcutModifiers(for: DashboardSettingKeys.toggleShortcutModifiers)

        if !conflictsWithToggle,
           launcherKeyCode != -1,
           let modifiers = carbonModifiers(from: launcherModifiers) {
            registerHotKey(id: 2, keyCode: launcherKeyCode, modifiers: modifiers) { [weak self] in
                self?.controller?.showWidgetLauncher()
                self?.updateStatusMenu()
            }
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

    private func menuTitle(_ title: String, shortcut: String?) -> NSAttributedString {
        guard let shortcut else {
            return NSAttributedString(string: title)
        }

        let attributed = NSMutableAttributedString(string: title)
        let shortcutString = NSAttributedString(
            string: "    \(shortcut)",
            attributes: [.foregroundColor: NSColor.secondaryLabelColor]
        )
        attributed.append(shortcutString)
        return attributed
    }
}
