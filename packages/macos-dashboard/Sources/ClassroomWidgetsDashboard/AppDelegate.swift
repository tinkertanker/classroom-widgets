import AppKit
import Carbon
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var controller: DashboardWindowController?
    private var hotKeys: [DashboardHotKey] = []
    private var statusItem: NSStatusItem?
    private let launchAtLoginManager = DashboardLaunchAtLoginManager()
    private lazy var settingsContext = DashboardSettingsContext(
        launchAtLoginManager: launchAtLoginManager,
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
        },
        onReloadDashboard: { [weak self] in
            self?.controller?.reloadDashboard()
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
        NSApp.applicationIconImage = NSImage(named: "AppIcon") ?? NSApp.applicationIconImage

        let controller = DashboardWindowController()
        controller.onVisibilityChanged = { [weak self] _ in
            self?.updateStatusMenu()
        }
        self.controller = controller
        setupStatusItem()
        registerHotKeys()
        DashboardLog.app.info("Classroom Widgets Dashboard launched")

        if UserDefaults.standard.bool(forKey: DashboardSettingKeys.showDashboardAtLaunch) {
            controller.showDashboard()
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        hotKeys.removeAll()
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        controller?.showDashboard()
        return false
    }

    private func setupStatusItem() {
        let statusItem = NSStatusBar.system.statusItem(withLength: 26)
        statusItem.button?.image = DashboardMenuBarIcon.make(size: 21)
        statusItem.button?.imagePosition = .imageOnly
        self.statusItem = statusItem
        updateStatusMenu()
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

        let reloadItem = NSMenuItem(title: "Reload Dashboard", action: #selector(reloadDashboard), keyEquivalent: "r")
        reloadItem.target = self
        menu.addItem(reloadItem)

        let launchAtLoginItem = NSMenuItem(title: "Launch at Login", action: #selector(toggleLaunchAtLogin), keyEquivalent: "")
        launchAtLoginItem.target = self
        launchAtLoginItem.state = launchAtLoginManager.isEnabled ? .on : .off
        launchAtLoginItem.isEnabled = launchAtLoginManager.canConfigure
        menu.addItem(launchAtLoginItem)

        let settingsItem = NSMenuItem(title: "Settings...", action: #selector(showSettings), keyEquivalent: ",")
        settingsItem.target = self
        menu.addItem(settingsItem)

        let aboutItem = NSMenuItem(title: "About Classroom Widgets", action: #selector(showAbout), keyEquivalent: "")
        aboutItem.target = self
        menu.addItem(aboutItem)

        menu.addItem(NSMenuItem.separator())

        let quitItem = NSMenuItem(title: "Quit Classroom Widgets", action: #selector(quitApp), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)

        statusItem?.menu = menu
    }

    private func applyShortcut(to item: NSMenuItem, keyCode: Int, modifiers: Int) {
        guard let keyEquivalent = DashboardShortcutFormatter.menuKeyEquivalent(for: keyCode) else {
            return
        }

        item.keyEquivalent = keyEquivalent
        item.keyEquivalentModifierMask = NSEvent.ModifierFlags(rawValue: UInt(modifiers)).intersection(.deviceIndependentFlagsMask)
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

    @objc private func reloadDashboard() {
        controller?.reloadDashboard()
    }

    @objc private func showSettings() {
        settingsWindowCoordinator.show()
    }

    @objc private func showAbout() {
        let appIcon = NSImage(named: "AppIcon") ?? NSApp.applicationIconImage ?? NSImage()
        NSApp.orderFrontStandardAboutPanel(options: [
            .applicationName: "Classroom Widgets",
            .applicationIcon: appIcon,
            .credits: NSAttributedString(string: "A polished macOS companion for the Classroom Widgets teacher dashboard.")
        ])
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc private func toggleLaunchAtLogin() {
        do {
            let result = try launchAtLoginManager.setEnabled(!launchAtLoginManager.isEnabled)
            if result == .requiresApproval {
                presentLaunchAtLoginApprovalAlert()
            }
        } catch {
            presentError(error, title: "Launch at Login Failed")
        }
        updateStatusMenu()
    }

    @objc private func quitApp() {
        NSApp.terminate(nil)
    }

    private func presentLaunchAtLoginApprovalAlert() {
        let alert = NSAlert()
        alert.messageText = "Approval Needed"
        alert.informativeText = "macOS needs approval in System Settings before Classroom Widgets Dashboard can open at login."
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }

    private func presentError(_ error: Error, title: String) {
        let alert = NSAlert(error: error)
        alert.messageText = title
        alert.runModal()
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
