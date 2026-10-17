import AppKit

@MainActor
final class DockMenuAction: NSObject {
    private let originalItem: NSMenuItem
    private let originalSelector: Selector
    private weak var originalTarget: AnyObject?

    init(item: NSMenuItem, selector: Selector, target: AnyObject) {
        originalItem = item
        originalSelector = selector
        originalTarget = target
        super.init()
    }

    @objc func invoke() {
        // The Dock invokes menu actions with a nil sender, so forward the original item.
        guard let originalTarget else { return }
        NSApp.sendAction(originalSelector, to: originalTarget, from: originalItem)
    }
}

/// The main menu, the menu-bar and Dock menus, and the actions they send.
extension AppDelegate {
    // Accessory apps have no visible menu bar, but a main menu is still needed
    // to route standard editing and window key equivalents.
    func setupMainMenu() {
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
        mainUpdateMenuItem = updateItem
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

    func setupStatusItem() {
        let statusItem = NSStatusBar.system.statusItem(withLength: 16)
        statusItem.button?.image = DashboardMenuBarIcon.make(size: 16)
        statusItem.button?.imagePosition = .imageOnly
        let menu = NSMenu()
        // Items set their own enabled state (Arrange Widgets, Launch at Login).
        menu.autoenablesItems = false
        menu.delegate = self
        statusItem.menu = menu
        self.statusItem = statusItem
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        populateWidgetMenu(menu, includeQuit: true)
    }

    func applicationDockMenu(_ sender: NSApplication) -> NSMenu? {
        dockMenuActions.removeAll()
        let menu = NSMenu()
        menu.autoenablesItems = false
        populateWidgetMenu(menu, includeQuit: false)
        adaptDockMenuActions(in: menu)
        return menu
    }

    private func adaptDockMenuActions(in menu: NSMenu) {
        for item in menu.items {
            if let submenu = item.submenu {
                adaptDockMenuActions(in: submenu)
                continue
            }
            guard let action = item.action, let target = item.target else { continue }
            let adapter = DockMenuAction(item: item, selector: action, target: target)
            dockMenuActions.append(adapter)
            item.target = adapter
            item.action = #selector(DockMenuAction.invoke)
        }
    }

    private func populateWidgetMenu(_ menu: NSMenu, includeQuit: Bool) {
        menu.removeAllItems()

        WidgetMenu.addWidgetItems(
            to: menu,
            options: controller?.widgetOptions ?? [],
            target: self,
            displayAction: #selector(showDisplayPreview),
            widgetAction: #selector(addWidget(_:)),
            shortcut: { owner in
                if owner == .display { return self.displayMenuShortcut() }
                return self.shortcutState?.shortcut(for: owner)
            }
        )
        menu.addItem(.separator())

        let arrangeItem = NSMenuItem(title: "Arrange Widgets", action: nil, keyEquivalent: "")
        arrangeItem.image = WidgetMenu.symbol(named: "square.grid.2x2", description: "Arrange Widgets")
        arrangeItem.submenu = makeArrangeMenu()
        arrangeItem.isEnabled = controller?.hasVisibleWidgetPanels == true
        menu.addItem(arrangeItem)

        let openLauncherItem = NSMenuItem(title: "Open Widget Launcher", action: #selector(openLauncher), keyEquivalent: "")
        openLauncherItem.target = self
        openLauncherItem.image = WidgetMenu.symbol(named: "square.grid.3x3", description: "Open Widget Launcher")
        openLauncherItem.keyEquivalentModifierMask = []
        menu.addItem(openLauncherItem)

        // Holding Option swaps the launcher item for this troubleshooting action.
        let reloadItem = NSMenuItem(title: "Reload Widgets", action: #selector(reloadWidgets), keyEquivalent: "")
        reloadItem.target = self
        reloadItem.image = WidgetMenu.symbol(named: "arrow.clockwise", description: "Reload Widgets")
        reloadItem.keyEquivalentModifierMask = .option
        reloadItem.isAlternate = true
        menu.addItem(reloadItem)
        menu.addItem(.separator())

        let settingsItem = NSMenuItem(title: "Settings…", action: #selector(showSettings), keyEquivalent: "")
        settingsItem.target = self
        applySettingsShortcut(to: settingsItem)
        menu.addItem(settingsItem)

        let launchItem = NSMenuItem(title: "Launch at Login", action: #selector(toggleLaunchAtLogin), keyEquivalent: "")
        launchItem.target = self
        launchItem.state = launchAtLoginManager.isEnabled ? .on : .off
        launchItem.isEnabled = launchAtLoginManager.canConfigure
        menu.addItem(launchItem)

        let updateItem = NSMenuItem(title: Self.updateMenuTitle(availableUpdateVersion), action: #selector(checkForUpdates), keyEquivalent: "")
        updateItem.target = self
        menu.addItem(updateItem)

        let aboutItem = NSMenuItem(title: "About Classroom Widgets", action: #selector(showAbout), keyEquivalent: "")
        aboutItem.target = self
        menu.addItem(aboutItem)
        if includeQuit {
            menu.addItem(.separator())
            let quitItem = NSMenuItem(title: "Quit Classroom Widgets", action: #selector(quitApp), keyEquivalent: "q")
            quitItem.target = self
            menu.addItem(quitItem)
        }
    }

    private static func updateMenuTitle(_ version: String?) -> String {
        version.map { "Update to v\($0)…" } ?? "Check for Updates…"
    }

    func showUpdateAvailability(_ version: String?) {
        availableUpdateVersion = version
        mainUpdateMenuItem?.title = Self.updateMenuTitle(version)
        statusItem?.button?.image = DashboardMenuBarIcon.make(size: 16, updateAvailable: version != nil)
        statusItem?.button?.toolTip = version.map { "Classroom Widgets — update v\($0) available" } ?? "Classroom Widgets"
    }

    private func makeArrangeMenu() -> NSMenu {
        let menu = NSMenu(title: "Arrange Widgets")
        let current = controller?.widgetPanelLayout
        let layouts: [(title: String, layout: WidgetPanelLayout)] = [
            ("Free Placement", .freeform),
            ("Arrange in a Row", .row),
            ("Arrange in a Column", .column)
        ]
        for entry in layouts {
            let item = NSMenuItem(title: entry.title, action: #selector(arrangeWidgets(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = entry.layout.rawValue
            item.state = entry.layout == current ? .on : .off
            menu.addItem(item)
        }
        return menu
    }

    private func applySettingsShortcut(to item: NSMenuItem) {
        let keyCode = shortcutKeyCode()
        guard let equivalent = DashboardShortcutFormatter.keyEquivalent(for: keyCode) else { return }
        item.keyEquivalent = equivalent
        item.keyEquivalentModifierMask = DashboardShortcutFormatter.modifierFlags(from: shortcutModifiers())
    }

    private func displayMenuShortcut() -> DashboardShortcut {
        let settings = persistedSettingsShortcut()
        return shortcutState?.shortcut(for: .display)
            ?? widgetShortcutStore.proposedDisplayBinding(reserving: settings.isAssigned ? [settings] : [])
    }

    @objc private func openLauncher() { requestOpenLauncher() }
    @objc private func addWidget(_ sender: NSMenuItem) { controller?.addWidget(sender.tag) }
    @objc private func reloadWidgets() {
        controller?.reloadWidgets()
        displayPreviewCoordinator.restartIfRunning()
    }
    @objc private func arrangeWidgets(_ sender: NSMenuItem) {
        guard let rawLayout = sender.representedObject as? String,
              let layout = WidgetPanelLayout(rawValue: rawLayout) else { return }
        controller?.arrangeWidgets(layout)
    }
    @objc private func showDisplayPreview() { displayPreviewCoordinator.open() }
    func performDisplayShortcut(action: WidgetShortcutAction? = .show) {
        if let displayShortcutAction { displayShortcutAction(action); return }
        switch action {
        case .show: displayPreviewCoordinator.open()
        case .dismiss: displayPreviewCoordinator.dismiss()
        case nil: displayPreviewCoordinator.toggle()
        }
    }
    @objc func showSettings() { settingsWindowCoordinator.show() }
    @objc private func checkForUpdates() { Task { await updates.check(manual: true) } }

    @objc private func showAbout() {
        let appIcon = NSImage(named: "AppIcon") ?? NSApp.applicationIconImage ?? NSImage()
        NSApp.orderFrontStandardAboutPanel(options: [
            .applicationName: "Classroom Widgets",
            .applicationIcon: appIcon,
            .credits: NSAttributedString(
                string: "A menu-bar launcher for floating classroom widgets."
            )
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
}
