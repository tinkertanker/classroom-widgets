import AppKit
import Carbon
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private var controller: WidgetHostController?
    private var terminationPending = false
    private var terminationApproved = false
    private var hotKeys: [DashboardHotKey] = []
    private var statusItem: NSStatusItem?
    private let launchAtLoginManager = LaunchAtLoginManager()
    private lazy var settingsContext = DashboardSettingsContext(
        launchAtLoginManager: launchAtLoginManager,
        onShortcutChanged: { [weak self] in self?.registerSettingsHotKey() },
        onWidgetSettingsChanged: { [weak self] in self?.controller?.applySettings() }
    )
    private lazy var settingsWindowCoordinator = SettingsWindowCoordinator { [weak self] in
        guard let self else { return NSView() }
        return NSHostingView(rootView: DashboardSettingsView(context: self.settingsContext))
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        DashboardDefaults.register()
        NSApp.setActivationPolicy(.accessory)
        NSApp.applicationIconImage = NSImage(named: "AppIcon") ?? NSApp.applicationIconImage
        setupMainMenu()

        controller = WidgetHostController()
        setupStatusItem()
        registerSettingsHotKey()
        DashboardLog.app.info("Classroom Widgets menu-bar widget launcher launched")
    }

    func applicationWillTerminate(_ notification: Notification) {
        controller?.flushPersistedState()
        hotKeys.removeAll()
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if terminationApproved { return .terminateNow }
        guard !terminationPending, let controller else {
            return controller == nil ? .terminateNow : .terminateLater
        }

        terminationPending = true
        Task { @MainActor [weak self, weak sender] in
            let ready = await controller.prepareForTermination()
            guard let self, let sender else { return }
            terminationPending = false
            terminationApproved = ready
            sender.reply(toApplicationShouldTerminate: ready)
        }
        return .terminateLater
    }

    // Accessory apps have no visible menu bar, but a main menu is still needed
    // to route standard editing and window key equivalents.
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
        windowMenu.addItem(NSMenuItem(title: "Close Window", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w"))
        windowMenuItem.submenu = windowMenu
        mainMenu.addItem(windowMenuItem)
        NSApp.mainMenu = mainMenu
    }

    private func setupStatusItem() {
        let statusItem = NSStatusBar.system.statusItem(withLength: 26)
        statusItem.button?.image = DashboardMenuBarIcon.make(size: 21)
        statusItem.button?.imagePosition = .imageOnly
        let menu = NSMenu()
        menu.delegate = self
        statusItem.menu = menu
        self.statusItem = statusItem
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()

        let newWidgetItem = NSMenuItem(title: "New Floating Widget", action: nil, keyEquivalent: "")
        let newWidgetMenu = NSMenu(title: "New Floating Widget")
        for option in controller?.widgetOptions ?? [] {
            let item = NSMenuItem(title: option.title, action: #selector(addWidget(_:)), keyEquivalent: "")
            item.target = self
            item.tag = option.widgetType
            newWidgetMenu.addItem(item)
        }
        if newWidgetMenu.items.isEmpty {
            let item = NSMenuItem(title: "No widgets available", action: nil, keyEquivalent: "")
            item.isEnabled = false
            newWidgetMenu.addItem(item)
        }
        newWidgetItem.submenu = newWidgetMenu
        menu.addItem(newWidgetItem)

        let reloadItem = NSMenuItem(title: "Reload Widgets", action: #selector(reloadWidgets), keyEquivalent: "")
        reloadItem.target = self
        menu.addItem(reloadItem)

        let launchItem = NSMenuItem(title: "Launch at Login", action: #selector(toggleLaunchAtLogin), keyEquivalent: "")
        launchItem.target = self
        launchItem.state = launchAtLoginManager.isEnabled ? .on : .off
        launchItem.isEnabled = launchAtLoginManager.canConfigure
        menu.addItem(launchItem)

        let settingsItem = NSMenuItem(title: "Settings…", action: #selector(showSettings), keyEquivalent: "")
        settingsItem.target = self
        applySettingsShortcut(to: settingsItem)
        menu.addItem(settingsItem)

        let aboutItem = NSMenuItem(title: "About Classroom Widgets", action: #selector(showAbout), keyEquivalent: "")
        aboutItem.target = self
        menu.addItem(aboutItem)
        menu.addItem(.separator())
        let quitItem = NSMenuItem(title: "Quit Classroom Widgets", action: #selector(quitApp), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)
    }

    private func applySettingsShortcut(to item: NSMenuItem) {
        let keyCode = shortcutKeyCode()
        guard let equivalent = DashboardShortcutFormatter.keyEquivalent(for: keyCode) else { return }
        item.keyEquivalent = equivalent
        item.keyEquivalentModifierMask = DashboardShortcutFormatter.modifierFlags(from: shortcutModifiers())
    }

    private func registerSettingsHotKey() {
        hotKeys.removeAll()
        let keyCode = shortcutKeyCode()
        guard keyCode != -1, let modifiers = carbonModifiers(from: shortcutModifiers()) else { return }
        do {
            hotKeys.append(try DashboardHotKey(id: 1, keyCode: UInt32(keyCode), modifiers: modifiers) { [weak self] in
                self?.showSettings()
            })
        } catch {
            NSLog("Unable to register Classroom Widgets Settings shortcut: \(error)")
        }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showSettings()
        return true
    }

    @objc private func addWidget(_ sender: NSMenuItem) { controller?.addWidget(sender.tag) }
    @objc private func reloadWidgets() { controller?.reloadWidgets() }
    @objc private func showSettings() { settingsWindowCoordinator.show() }

    @objc private func showAbout() {
        let appIcon = NSImage(named: "AppIcon") ?? NSApp.applicationIconImage ?? NSImage()
        NSApp.orderFrontStandardAboutPanel(options: [
            .applicationName: "Classroom Widgets",
            .applicationIcon: appIcon,
            .credits: NSAttributedString(string: "A menu-bar launcher for floating classroom widgets.")
        ])
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc private func toggleLaunchAtLogin() {
        do {
            if try launchAtLoginManager.setEnabled(!launchAtLoginManager.isEnabled) == .requiresApproval {
                let alert = NSAlert()
                alert.messageText = "Approval Needed"
                alert.informativeText = "macOS needs approval in System Settings before Classroom Widgets can launch at login."
                alert.runModal()
            }
        } catch {
            let alert = NSAlert(error: error)
            alert.messageText = "Launch at Login Failed"
            alert.runModal()
        }
    }

    @objc private func quitApp() { NSApp.terminate(nil) }

    private func shortcutKeyCode() -> Int {
        let defaults = UserDefaults.standard
        return defaults.object(forKey: DashboardSettingKeys.settingsShortcutKeyCode) == nil
            ? DashboardDefaults.settingsShortcutKeyCode
            : defaults.integer(forKey: DashboardSettingKeys.settingsShortcutKeyCode)
    }

    private func shortcutModifiers() -> Int {
        let defaults = UserDefaults.standard
        return defaults.object(forKey: DashboardSettingKeys.settingsShortcutModifiers) == nil
            ? DashboardDefaults.shortcutModifiers
            : defaults.integer(forKey: DashboardSettingKeys.settingsShortcutModifiers)
    }

    private func carbonModifiers(from rawModifiers: Int) -> UInt32? {
        let flags = NSEvent.ModifierFlags(rawValue: UInt(rawModifiers))
        var result: UInt32 = 0
        if flags.contains(.command) { result |= UInt32(cmdKey) }
        if flags.contains(.option) { result |= UInt32(optionKey) }
        if flags.contains(.control) { result |= UInt32(controlKey) }
        if flags.contains(.shift) { result |= UInt32(shiftKey) }
        return result == 0 ? nil : result
    }
}
