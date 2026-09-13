import AppKit
import Carbon
import SwiftUI

struct ShortcutRegistrationSuspension {
    private(set) var recorderCount = 0

    mutating func recorderStarted() -> Bool {
        recorderCount += 1
        return recorderCount == 1
    }

    mutating func recorderEnded() -> Bool {
        guard recorderCount > 0 else { return false }
        recorderCount -= 1
        return recorderCount == 0
    }

    var isActive: Bool { recorderCount > 0 }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private var controller: WidgetHostController?
    private var terminationPending = false
    private var terminationApproved = false
    private var settingsHotKey: (shortcut: DashboardShortcut, hotKey: DashboardHotKey)?
    private var widgetHotKeys: [Int: (shortcut: DashboardShortcut, hotKey: DashboardHotKey)] = [:]
    private var widgetShortcutStatuses: [Int: String] = [:]
    private var nextHotKeyID: UInt32 = 100
    private let widgetShortcutStore = WidgetLaunchShortcutStore()
    private var shortcutRegistrationSuspension = ShortcutRegistrationSuspension()
    private var shortcutStatus: String?
    private var statusItem: NSStatusItem?
    private let launchAtLoginManager = LaunchAtLoginManager()
    private lazy var settingsContext = DashboardSettingsContext(
        launchAtLoginManager: launchAtLoginManager,
        onShortcutChanged: { [weak self] in self?.registerSettingsHotKey() },
        onWidgetSettingsChanged: { [weak self] in self?.controller?.applySettings() },
        onWidgetShortcutChanged: { [weak self] widgetType, shortcut in self?.setWidgetShortcut(shortcut, for: widgetType) },
        onResetWidgetShortcuts: { [weak self] in self?.resetWidgetShortcuts() },
        onShortcutRecordingChanged: { [weak self] isRecording in self?.shortcutRecordingChanged(isRecording) }
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
        controller?.onWidgetOptionsChanged = { [weak self] options in self?.widgetOptionsChanged(options) }
        setupStatusItem()
        registerSettingsHotKey()
        DashboardLog.app.info("Classroom Widgets menu-bar widget launcher launched")
    }

    func applicationWillTerminate(_ notification: Notification) {
        controller?.flushPersistedState()
        settingsHotKey = nil
        widgetHotKeys.removeAll()
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
        guard !shortcutRegistrationSuspension.isActive else { return }
        let keyCode = shortcutKeyCode()
        guard keyCode != -1, let modifiers = carbonModifiers(from: shortcutModifiers()) else {
            settingsHotKey = nil
            return
        }
        let shortcut = DashboardShortcut(keyCode: keyCode, modifiers: shortcutModifiers()).normalized
        if settingsHotKey?.shortcut == shortcut { return }
        if widgetHotKeys.values.contains(where: { $0.shortcut == shortcut }) {
            shortcutStatus = "That shortcut is already assigned to a widget."
            restorePersistedSettingsShortcut()
            refreshShortcutContext()
            return
        }
        do {
            let replacement = try DashboardHotKey(id: 1, keyCode: UInt32(keyCode), modifiers: modifiers) { [weak self] in
                self?.showSettings()
            }
            settingsHotKey = (shortcut, replacement)
            shortcutStatus = nil
            refreshShortcutContext()
        } catch {
            shortcutStatus = "The Open Settings shortcut is unavailable. The previous shortcut remains active."
            restorePersistedSettingsShortcut()
            refreshShortcutContext()
        }
    }

    private func restorePersistedSettingsShortcut() {
        guard let shortcut = settingsHotKey?.shortcut else { return }
        UserDefaults.standard.set(shortcut.keyCode, forKey: DashboardSettingKeys.settingsShortcutKeyCode)
        UserDefaults.standard.set(shortcut.modifiers, forKey: DashboardSettingKeys.settingsShortcutModifiers)
    }

    private func widgetOptionsChanged(_ options: [CompactWidgetOption]) {
        let available = Set(options.map(\.widgetType))
        widgetHotKeys = widgetHotKeys.filter { available.contains($0.key) }
        let bindings = widgetShortcutStore.bindings(for: options)
        for option in options { registerWidgetShortcut(bindings[option.widgetType], for: option.widgetType, persist: false) }
        refreshShortcutContext()
    }

    private func setWidgetShortcut(_ shortcut: DashboardShortcut, for widgetType: Int) {
        if shortcutRegistrationSuspension.isActive {
            widgetShortcutStore.set(shortcut, for: widgetType)
            widgetShortcutStatuses[widgetType] = nil
            refreshShortcutContext()
            return
        }
        registerWidgetShortcut(shortcut, for: widgetType, persist: true)
        refreshShortcutContext()
    }

    private func shortcutRecordingChanged(_ isRecording: Bool) {
        if isRecording {
            guard shortcutRegistrationSuspension.recorderStarted() else { return }
            settingsHotKey = nil
            widgetHotKeys.removeAll()
            return
        }

        guard shortcutRegistrationSuspension.recorderEnded() else { return }
        registerSettingsHotKey()
        if let options = controller?.widgetOptions { widgetOptionsChanged(options) }
    }

    private func registerWidgetShortcut(_ proposed: DashboardShortcut?, for widgetType: Int, persist: Bool) {
        let shortcut = (proposed ?? DashboardShortcut(keyCode: -1, modifiers: 0)).normalized
        if !shortcut.isAssigned {
            widgetHotKeys[widgetType] = nil
            widgetShortcutStatuses[widgetType] = nil
            if persist { widgetShortcutStore.set(shortcut, for: widgetType) }
            return
        }
        let settingsShortcut = DashboardShortcut(keyCode: shortcutKeyCode(), modifiers: shortcutModifiers()).normalized
        guard shortcut != settingsShortcut,
              !widgetHotKeys.contains(where: { $0.key != widgetType && $0.value.shortcut == shortcut }) else {
            widgetShortcutStatuses[widgetType] = "Already assigned in Classroom Widgets."
            return
        }
        if widgetHotKeys[widgetType]?.shortcut == shortcut {
            if persist { widgetShortcutStore.set(shortcut, for: widgetType) }
            return
        }
        guard let modifiers = carbonModifiers(from: shortcut.modifiers) else { return }
        do {
            nextHotKeyID += 1
            let replacement = try DashboardHotKey(id: nextHotKeyID, keyCode: UInt32(shortcut.keyCode), modifiers: modifiers) { [weak self] in
                guard let self, self.controller?.widgetOptions.contains(where: { $0.widgetType == widgetType }) == true else { return }
                self.controller?.addWidget(widgetType)
            }
            widgetHotKeys[widgetType] = (shortcut, replacement)
            if persist { widgetShortcutStore.set(shortcut, for: widgetType) }
            widgetShortcutStatuses[widgetType] = nil
        } catch {
            widgetShortcutStatuses[widgetType] = widgetHotKeys[widgetType] == nil
                ? "Inactive — macOS could not register this shortcut."
                : "Unavailable — the previous shortcut remains active."
        }
    }

    private func resetWidgetShortcuts() {
        guard let options = controller?.widgetOptions else { return }
        widgetHotKeys.removeAll()
        widgetShortcutStatuses.removeAll()
        widgetShortcutStore.reset(options: options)
        widgetOptionsChanged(options)
    }

    private func refreshShortcutContext() {
        let options = controller?.widgetOptions ?? []
        settingsContext.updateWidgetShortcuts(
            options: options,
            shortcuts: widgetShortcutStore.bindings(for: options),
            widgetStatuses: widgetShortcutStatuses,
            status: shortcutStatus
        )
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
