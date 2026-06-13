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
        },
        onReloadDashboard: { [weak self] in
            self?.controller?.reloadDashboard()
        }
    )
    private lazy var settingsWindowCoordinator = SettingsWindowCoordinator { [weak self] in
        self?.settingsContext
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        DashboardDefaults.register()
        NSApp.setActivationPolicy(.accessory)
        NSApp.applicationIconImage = NSImage(named: "AppIcon") ?? NSApp.applicationIconImage
        setupMainMenu()

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

        if !UserDefaults.standard.bool(forKey: DashboardSettingKeys.showMenuBarIcon) {
            showSettings()
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        hotKeys.removeAll()
    }

    // Accessory apps have no visible menu bar, but NSApp.mainMenu still routes
    // key equivalents. Without it, Cmd+C/V/X/Z/A never reach the web view's
    // text fields and Cmd+W cannot close the Settings window.
    private func setupMainMenu() {
        let mainMenu = NSMenu()

        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu()
        let aboutItem = NSMenuItem(title: "About Classroom Widgets", action: #selector(showAbout), keyEquivalent: "")
        aboutItem.target = self
        appMenu.addItem(aboutItem)
        appMenu.addItem(.separator())
        let settingsItem = NSMenuItem(title: "Settings…", action: #selector(showSettings), keyEquivalent: ",")
        settingsItem.target = self
        appMenu.addItem(settingsItem)
        appMenu.addItem(.separator())
        // No app-level "Hide" (Cmd+H): for a menu-bar accessory app with the
        // status icon optionally hidden, hiding every window can strand the
        // user with no way back. Cmd+W hides the dashboard instead.
        appMenu.addItem(NSMenuItem(title: "Quit Classroom Widgets", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)

        let editMenuItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(NSMenuItem(title: "Undo", action: Selector(("undo:")), keyEquivalent: "z"))
        editMenu.addItem(NSMenuItem(title: "Redo", action: Selector(("redo:")), keyEquivalent: "Z"))
        editMenu.addItem(.separator())
        editMenu.addItem(NSMenuItem(title: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x"))
        editMenu.addItem(NSMenuItem(title: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c"))
        editMenu.addItem(NSMenuItem(title: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v"))
        editMenu.addItem(NSMenuItem(title: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a"))
        editMenuItem.submenu = editMenu
        mainMenu.addItem(editMenuItem)

        let windowMenuItem = NSMenuItem()
        let windowMenu = NSMenu(title: "Window")
        let closeItem = NSMenuItem(title: "Close Window", action: #selector(closeFrontWindow), keyEquivalent: "w")
        closeItem.target = self
        windowMenu.addItem(closeItem)
        windowMenuItem.submenu = windowMenu
        mainMenu.addItem(windowMenuItem)

        NSApp.mainMenu = mainMenu
    }

    private func setupStatusItem() {
        guard UserDefaults.standard.bool(forKey: DashboardSettingKeys.showMenuBarIcon) else {
            statusItem = nil
            return
        }

        let statusItem = NSStatusBar.system.statusItem(withLength: 26)
        statusItem.button?.image = DashboardMenuBarIcon.make(size: 21)
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

        // No key equivalent: Cmd+R is far too generic for a global-ish menu
        // item, and the web process now auto-reloads on crash, so this is just
        // a manual recovery valve.
        let reloadItem = NSMenuItem(title: "Reload Dashboard", action: #selector(reloadDashboard), keyEquivalent: "")
        reloadItem.target = self
        menu.addItem(reloadItem)

        let launchAtLoginItem = NSMenuItem(title: "Launch at Login", action: #selector(toggleLaunchAtLogin), keyEquivalent: "")
        launchAtLoginItem.target = self
        launchAtLoginItem.state = launchAtLoginManager.isEnabled ? .on : .off
        launchAtLoginItem.isEnabled = launchAtLoginManager.canConfigure
        menu.addItem(launchAtLoginItem)

        let settingsItem = NSMenuItem(title: "Settings...", action: #selector(showSettings), keyEquivalent: "")
        settingsItem.target = self
        applyShortcut(
            to: settingsItem,
            keyCode: shortcutKeyCode(for: DashboardSettingKeys.settingsShortcutKeyCode, fallback: DashboardDefaults.settingsShortcutKeyCode),
            modifiers: shortcutModifiers(for: DashboardSettingKeys.settingsShortcutModifiers)
        )
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

    @objc private func reloadDashboard() {
        controller?.reloadDashboard()
    }

    @objc private func closeFrontWindow() {
        guard let keyWindow = NSApp.keyWindow else {
            NSSound.beep()
            return
        }

        // The borderless dashboard window has no close button, so Cmd+W hides
        // the dashboard instead of beeping.
        if keyWindow is DashboardWindow {
            if controller?.isDashboardVisible == true {
                controller?.toggleDashboard()
                updateStatusMenu()
            } else {
                // Already hiding (window lingers briefly for the exit
                // animation) — nothing to close.
                NSSound.beep()
            }
            return
        }

        keyWindow.performClose(nil)
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
