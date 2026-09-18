import AppKit
import Carbon
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private var controller: WidgetHostController?
    private var launcherRequested = false
    private var initialActivationPending = false
    private var terminationPending = false
    private var terminationApproved = false
    private var settingsHotKey: (shortcut: DashboardShortcut, hotKey: DashboardHotKey)?
    private var widgetHotKeys: [ShortcutBindingState.Owner: (shortcut: DashboardShortcut, hotKey: DashboardHotKey)] = [:]
    private var widgetShortcutStatuses: [ShortcutBindingState.Owner: String] = [:]
    private var nextHotKeyID: UInt32 = 100
    private let widgetShortcutStore = WidgetLaunchShortcutStore()
    private lazy var updates = UpdateController(
        prepareForTermination: { [weak self] in
            guard let self, let controller = self.controller else { return false }
            let ready = await controller.prepareForTermination()
            self.terminationApproved = ready
            return ready
        },
        cancelTermination: { [weak self] in
            self?.terminationApproved = false
            self?.controller?.resumeAfterCancelledTermination()
        }
    )
    private var shortcutState: ShortcutBindingState?
    private var shortcutStatus: String?
    private var statusItem: NSStatusItem?
    private let launchAtLoginManager = LaunchAtLoginManager()
    private lazy var settingsContext = DashboardSettingsContext(
        launchAtLoginManager: launchAtLoginManager,
        onShortcutChanged: { [weak self] shortcut in self?.settingsShortcutChanged(shortcut) },
        onWidgetSettingsChanged: { [weak self] in self?.controller?.applySettings() },
        onWidgetShortcutChanged: { [weak self] widgetType, action, shortcut in self?.setWidgetShortcut(shortcut, action: action, for: widgetType) },
        onResetWidgetShortcuts: { [weak self] in self?.resetWidgetShortcuts() },
        onShortcutRecordingChanged: { [weak self] isRecording in self?.shortcutRecordingChanged(isRecording) }
    )
    private lazy var settingsWindowCoordinator = SettingsWindowCoordinator { [weak self] in
        guard let self else { return NSView() }
        return NSHostingView(rootView: DashboardSettingsView(context: self.settingsContext))
    }
    private lazy var launcherWindowCoordinator = LauncherWindowCoordinator { [weak self] widgetType in
        guard let self, self.controller?.widgetOptions.contains(where: { $0.widgetType == widgetType }) == true else { return }
        self.controller?.addWidget(widgetType)
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        initialActivationPending = Self.shouldOpenLauncherOnInitialActivation(
            arguments: CommandLine.arguments,
            launchedAsLoginItem: Self.launchedAsLoginItem
        )
        DashboardDefaults.register()
        shortcutState = ShortcutBindingState(settings: persistedSettingsShortcut())
        NSApp.setActivationPolicy(.regular)
        NSApp.applicationIconImage = NSImage(named: "AppIcon") ?? NSApp.applicationIconImage
        setupMainMenu()

        controller = WidgetHostController()
        controller?.onWidgetOptionsChanged = { [weak self] options in
            self?.widgetOptionsChanged(options)
            if self?.launcherRequested == true { self?.requestOpenLauncher() }
        }
        setupStatusItem()
        registerAcceptedSettingsHotKey()
        DashboardLog.app.info("Classroom Widgets menu-bar widget launcher launched")
        Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(10))
            await self?.updates.check()
        }
    }

    nonisolated static func shouldOpenLauncherOnInitialActivation(arguments: [String], launchedAsLoginItem: Bool) -> Bool {
        !launchedAsLoginItem && !arguments.contains("--background")
    }

    private static var launchedAsLoginItem: Bool {
        let event = NSAppleEventManager.shared().currentAppleEvent
        return event?.eventID == kAEOpenApplication
            && event?.paramDescriptor(forKeyword: keyAEPropData)?.enumCodeValue == keyAELaunchedAsLogInItem
    }

    func applicationDidBecomeActive(_ notification: Notification) {
        guard initialActivationPending else { return }
        initialActivationPending = false
        requestOpenLauncher()
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
        let updateItem = NSMenuItem(title: "Check for Updates…", action: #selector(checkForUpdates), keyEquivalent: "")
        updateItem.target = self
        appMenu.addItem(updateItem)
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

        let openLauncherItem = NSMenuItem(title: "Open Widget Launcher", action: #selector(openLauncher), keyEquivalent: "")
        openLauncherItem.target = self
        menu.addItem(openLauncherItem)

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
        let updateItem = NSMenuItem(title: "Check for Updates…", action: #selector(checkForUpdates), keyEquivalent: "")
        updateItem.target = self
        menu.addItem(updateItem)
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

    private func settingsShortcutChanged(_ candidate: DashboardShortcut) {
        guard var state = shortcutState else { return }
        switch state.stage(candidate, for: .settings) {
        case .duplicate:
            shortcutStatus = Self.settingsDuplicateStatus
        case .unchanged:
            shortcutStatus = nil
        case .staged:
            shortcutStatus = nil
        }
        shortcutState = state
        refreshShortcutContext()
        guard state.candidate(for: .settings) != nil, !state.registrationsSuspended else { return }
        applyPendingSettingsShortcut()
    }

    private func registerAcceptedSettingsHotKey() {
        guard let shortcut = shortcutState?.shortcut(for: .settings), shortcut.isAssigned,
              let modifiers = carbonModifiers(from: shortcut.modifiers) else {
            settingsHotKey = nil
            return
        }
        if settingsHotKey?.shortcut == shortcut { return }
        do {
            nextHotKeyID += 1
            let replacement = try DashboardHotKey(id: nextHotKeyID, keyCode: UInt32(shortcut.keyCode), modifiers: modifiers) { [weak self] in
                self?.showSettings()
            }
            settingsHotKey = (shortcut, replacement)
            shortcutStatus = nil
            refreshShortcutContext()
        } catch {
            shortcutStatus = "The Open Settings shortcut is inactive because macOS could not register it."
            refreshShortcutContext()
        }
    }

    private func applyPendingSettingsShortcut() {
        guard var state = shortcutState, let candidate = state.candidate(for: .settings) else { return }
        if !candidate.isAssigned {
            state.complete(.settings, succeeded: true)
            shortcutState = state
            settingsHotKey = nil
            persistSettingsShortcut(candidate)
            shortcutStatus = nil
            refreshShortcutContext()
            return
        }
        guard let modifiers = carbonModifiers(from: candidate.modifiers) else { return }
        do {
            nextHotKeyID += 1
            let replacement = try DashboardHotKey(id: nextHotKeyID, keyCode: UInt32(candidate.keyCode), modifiers: modifiers) { [weak self] in
                self?.showSettings()
            }
            state.complete(.settings, succeeded: true)
            shortcutState = state
            settingsHotKey = (candidate, replacement)
            persistSettingsShortcut(candidate)
            shortcutStatus = nil
        } catch {
            state.complete(.settings, succeeded: false)
            shortcutState = state
            restorePersistedSettingsShortcut(from: state)
            shortcutStatus = "The Open Settings shortcut is unavailable. The previous shortcut remains active."
        }
        refreshShortcutContext()
    }

    private func restorePersistedSettingsShortcut(from state: ShortcutBindingState) {
        guard let shortcut = state.shortcut(for: .settings) else { return }
        persistSettingsShortcut(shortcut)
    }

    private func persistSettingsShortcut(_ shortcut: DashboardShortcut) {
        UserDefaults.standard.set(shortcut.keyCode, forKey: DashboardSettingKeys.settingsShortcutKeyCode)
        UserDefaults.standard.set(shortcut.modifiers, forKey: DashboardSettingKeys.settingsShortcutModifiers)
    }

    private func widgetOptionsChanged(_ options: [CompactWidgetOption]) {
        let available = Set(options.map(\.widgetType))
        widgetHotKeys = widgetHotKeys.filter { owner, _ in
            switch owner {
            case let .widget(widgetType), let .widgetDismiss(widgetType): return available.contains(widgetType)
            case .settings: return false
            }
        }
        let bindings = widgetShortcutStore.bindings(for: options, reserving: acceptedSettingsShortcut)
        shortcutState?.replaceWidgets(with: bindings)
        guard shortcutState?.registrationsSuspended != true else {
            refreshShortcutContext()
            return
        }
        for option in options { registerAcceptedWidgetShortcuts(for: option.widgetType) }
        refreshShortcutContext()
    }

    private func setWidgetShortcut(_ shortcut: DashboardShortcut, action: WidgetShortcutAction, for widgetType: Int) {
        guard var state = shortcutState else { return }
        let owner = shortcutOwner(widgetType: widgetType, action: action)
        switch state.stage(shortcut, for: owner) {
        case .duplicate:
            widgetShortcutStatuses[owner] = Self.widgetDuplicateStatus
        case .unchanged:
            widgetShortcutStatuses[owner] = nil
        case .staged:
            widgetShortcutStatuses[owner] = nil
        }
        shortcutState = state
        refreshShortcutContext()
        guard state.candidate(for: owner) != nil, !state.registrationsSuspended else { return }
        applyPendingWidgetShortcut(for: widgetType, action: action)
    }

    private func shortcutRecordingChanged(_ isRecording: Bool) {
        if isRecording {
            guard shortcutState?.recorderStarted() == true else { return }
            settingsHotKey = nil
            widgetHotKeys.removeAll()
            return
        }

        guard shortcutState?.recorderEnded() == true else { return }
        let duplicateSettingsStatus = shortcutStatus == Self.settingsDuplicateStatus ? shortcutStatus : nil
        let duplicateWidgetStatuses = widgetShortcutStatuses.filter { $0.value == Self.widgetDuplicateStatus }
        registerAcceptedSettingsHotKey()
        for option in controller?.widgetOptions ?? [] { registerAcceptedWidgetShortcuts(for: option.widgetType) }
        if let duplicateSettingsStatus { shortcutStatus = duplicateSettingsStatus }
        widgetShortcutStatuses.merge(duplicateWidgetStatuses) { _, duplicate in duplicate }
        if shortcutState?.candidate(for: .settings) != nil { applyPendingSettingsShortcut() }
        for option in controller?.widgetOptions ?? [] {
            if shortcutState?.candidate(for: .widget(option.widgetType)) != nil {
                applyPendingWidgetShortcut(for: option.widgetType, action: .show)
            }
            if shortcutState?.candidate(for: .widgetDismiss(option.widgetType)) != nil {
                applyPendingWidgetShortcut(for: option.widgetType, action: .dismiss)
            }
        }
        refreshShortcutContext()
    }

    private func registerAcceptedWidgetShortcuts(for widgetType: Int) {
        let showOwner = ShortcutBindingState.Owner.widget(widgetType)
        let dismissOwner = ShortcutBindingState.Owner.widgetDismiss(widgetType)
        let show = shortcutState?.shortcut(for: showOwner) ?? DashboardShortcut(keyCode: -1, modifiers: 0)
        let dismiss = shortcutState?.shortcut(for: dismissOwner) ?? DashboardShortcut(keyCode: -1, modifiers: 0)
        _ = registerWidgetShortcuts(WidgetShortcutBinding(show: show, dismiss: dismiss), for: widgetType)
    }

    private func registerWidgetShortcuts(_ binding: WidgetShortcutBinding, for widgetType: Int) -> WidgetShortcutRegistrationResults {
        let showOwner = ShortcutBindingState.Owner.widget(widgetType)
        let dismissOwner = ShortcutBindingState.Owner.widgetDismiss(widgetType)
        widgetHotKeys[showOwner] = nil
        widgetHotKeys[dismissOwner] = nil
        widgetShortcutStatuses[showOwner] = nil
        widgetShortcutStatuses[dismissOwner] = nil

        if binding.show.isAssigned && binding.show == binding.dismiss {
            let succeeded = registerWidgetShortcut(binding.show, owner: showOwner, widgetType: widgetType, action: nil)
            widgetShortcutStatuses[dismissOwner] = widgetShortcutStatuses[showOwner]
            return WidgetShortcutRegistrationResults(show: succeeded, dismiss: succeeded)
        }
        let showSucceeded = !binding.show.isAssigned
            || registerWidgetShortcut(binding.show, owner: showOwner, widgetType: widgetType, action: .show)
        let dismissSucceeded = !binding.dismiss.isAssigned
            || registerWidgetShortcut(binding.dismiss, owner: dismissOwner, widgetType: widgetType, action: .dismiss)
        return WidgetShortcutRegistrationResults(show: showSucceeded, dismiss: dismissSucceeded)
    }

    private func registerWidgetShortcut(
        _ shortcut: DashboardShortcut,
        owner: ShortcutBindingState.Owner,
        widgetType: Int,
        action: WidgetShortcutAction?
    ) -> Bool {
        guard let modifiers = carbonModifiers(from: shortcut.modifiers) else { return false }
        do {
            nextHotKeyID += 1
            let replacement = try DashboardHotKey(id: nextHotKeyID, keyCode: UInt32(shortcut.keyCode), modifiers: modifiers) { [weak self] in
                guard let self, self.controller?.widgetOptions.contains(where: { $0.widgetType == widgetType }) == true else { return }
                switch action {
                case .show: self.controller?.addWidget(widgetType)
                case .dismiss: self.controller?.dismissWidget(widgetType)
                case nil: self.controller?.toggleWidget(widgetType)
                }
            }
            widgetHotKeys[owner] = (shortcut, replacement)
            widgetShortcutStatuses[owner] = nil
            return true
        } catch {
            widgetShortcutStatuses[owner] = "Inactive — macOS could not register this shortcut."
            return false
        }
    }

    private func applyPendingWidgetShortcut(for widgetType: Int, action: WidgetShortcutAction) {
        guard var state = shortcutState else { return }
        let owner = shortcutOwner(widgetType: widgetType, action: action)
        guard let candidate = state.candidate(for: owner) else { return }
        let showOwner = ShortcutBindingState.Owner.widget(widgetType)
        let dismissOwner = ShortcutBindingState.Owner.widgetDismiss(widgetType)
        guard let currentShow = state.shortcut(for: showOwner),
              let currentDismiss = state.shortcut(for: dismissOwner) else { return }
        let previous = WidgetShortcutBinding(show: currentShow, dismiss: currentDismiss)
        var proposed = previous
        switch action {
        case .show: proposed.show = candidate
        case .dismiss: proposed.dismiss = candidate
        }
        let results = registerWidgetShortcuts(proposed, for: widgetType)
        let succeeded = results.accepts(candidate, action: action)
        state.complete(owner, succeeded: succeeded)
        shortcutState = state
        if succeeded {
            widgetShortcutStore.set(candidate, action: action, for: widgetType)
        } else {
            _ = registerWidgetShortcuts(previous, for: widgetType)
            widgetShortcutStatuses[owner] = "Unavailable — the previous shortcut remains active."
        }
        refreshShortcutContext()
    }

    private static let settingsDuplicateStatus = "That shortcut is already assigned to a widget."
    private static let widgetDuplicateStatus = "Already assigned in Classroom Widgets."

    private func shortcutOwner(widgetType: Int, action: WidgetShortcutAction) -> ShortcutBindingState.Owner {
        action == .show ? .widget(widgetType) : .widgetDismiss(widgetType)
    }

    private func resetWidgetShortcuts() {
        guard let options = controller?.widgetOptions else { return }
        widgetHotKeys.removeAll()
        widgetShortcutStatuses.removeAll()
        widgetShortcutStore.reset(options: options, reserving: acceptedSettingsShortcut)
        shortcutState?.replaceWidgets(
            with: widgetShortcutStore.bindings(for: options, reserving: acceptedSettingsShortcut),
            discardPending: true
        )
        widgetOptionsChanged(options)
    }

    private var acceptedSettingsShortcut: [DashboardShortcut] {
        guard let shortcut = shortcutState?.shortcut(for: .settings) else { return [] }
        return [shortcut]
    }

    private func refreshShortcutContext() {
        let options = controller?.widgetOptions ?? []
        settingsContext.updateWidgetShortcuts(
            options: options,
            shortcuts: Dictionary(uniqueKeysWithValues: options.compactMap { option in
                guard let show = shortcutState?.shortcut(for: .widget(option.widgetType)),
                      let dismiss = shortcutState?.shortcut(for: .widgetDismiss(option.widgetType)) else { return nil }
                return (option.widgetType, WidgetShortcutBinding(show: show, dismiss: dismiss))
            }),
            widgetStatuses: widgetShortcutStatuses,
            status: shortcutStatus
        )
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        requestOpenLauncher()
        return true
    }

    private func requestOpenLauncher() {
        guard controller?.widgetOptions.isEmpty == false else {
            launcherRequested = true
            return
        }
        launcherRequested = false
        launcherWindowCoordinator.show()
    }

    @objc private func openLauncher() { requestOpenLauncher() }
    @objc private func addWidget(_ sender: NSMenuItem) { controller?.addWidget(sender.tag) }
    @objc private func reloadWidgets() { controller?.reloadWidgets() }
    @objc func showSettings() { settingsWindowCoordinator.show() }
    @objc private func checkForUpdates() { Task { await updates.check(manual: true) } }

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

    private func persistedSettingsShortcut() -> DashboardShortcut {
        DashboardShortcut(keyCode: shortcutKeyCode(), modifiers: shortcutModifiers()).normalized
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
