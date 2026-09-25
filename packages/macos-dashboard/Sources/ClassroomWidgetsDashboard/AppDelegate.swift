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
    private var singleActionHotKeys: [ShortcutBindingState.Owner: (shortcut: DashboardShortcut, hotKey: AnyObject)] = [:]
    private var widgetHotKeys: [ShortcutBindingState.Owner: (shortcut: DashboardShortcut, hotKey: AnyObject)] = [:]
    private var widgetShortcutStatuses: [ShortcutBindingState.Owner: String] = [:]
    private var displayShortcutStatuses: [ShortcutBindingState.Owner: String] = [:]
    private var nextHotKeyID: UInt32 = 100
    private let defaults: UserDefaults
    private let widgetShortcutStore: WidgetLaunchShortcutStore
    private let hotKeyRegistration: DisplayShortcutRegistration.Register?
    private let displayShortcutAction: (@MainActor (WidgetShortcutAction?) -> Void)?
    private lazy var displayHotKeys = DisplayShortcutRegistration(
        register: { [unowned self] shortcut, handler in try self.makeHotKey(shortcut, handler: handler) },
        perform: { [weak self] action in self?.performDisplayShortcut(action: action) }
    )
    private lazy var updates = UpdateController(
        prepareForTermination: { [weak self] in
            guard let self, let controller = self.controller else { return false }
            guard await self.displayPreviewCoordinator.prepareForTermination() else {
                self.displayPreviewCoordinator.terminationCancelled()
                return false
            }
            let ready = await controller.prepareForTermination()
            if !ready { self.displayPreviewCoordinator.terminationCancelled() }
            self.terminationApproved = ready
            return ready
        },
        cancelTermination: { [weak self] in
            self?.terminationApproved = false
            self?.controller?.resumeAfterCancelledTermination()
            self?.displayPreviewCoordinator.terminationCancelled()
        }
    )
    private var shortcutState: ShortcutBindingState?
    private var displayShortcutStartupGate = DisplayShortcutStartupGate()
    private var widgetShortcutResetPending = false
    private var shortcutStatus: String?
    private var moveWidgetShortcutStatuses: [MoveDirection: String] = [:]
    private var statusItem: NSStatusItem?
    private let launchAtLoginManager = LaunchAtLoginManager()
    private let displayPreviewCoordinator = DisplayPreviewCoordinator()
    private(set) lazy var settingsContext = DashboardSettingsContext(
        launchAtLoginManager: launchAtLoginManager,
        onShortcutChanged: { [weak self] shortcut in self?.settingsShortcutChanged(shortcut) },
        onMoveWidgetShortcutChanged: { [weak self] direction, shortcut in self?.moveWidgetShortcutChanged(shortcut, direction: direction) },
        onWidgetSettingsChanged: { [weak self] in self?.applyPresentationSettings() },
        onDisplayShortcutChanged: { [weak self] action, shortcut in self?.setDisplayShortcut(shortcut, action: action) },
        onWidgetShortcutChanged: { [weak self] widgetType, action, shortcut in self?.setWidgetShortcut(shortcut, action: action, for: widgetType) },
        onResetWidgetShortcuts: { [weak self] in self?.resetWidgetShortcuts() },
        onShortcutRecordingChanged: { [weak self] isRecording in self?.shortcutRecordingChanged(isRecording) }
    )
    private lazy var settingsWindowCoordinator = SettingsWindowCoordinator { [weak self] in
        guard let self else { return NSView() }
        return NSHostingView(rootView: DashboardSettingsView(context: self.settingsContext))
    }
    private lazy var launcherWindowCoordinator = LauncherWindowCoordinator(
        onAddWidget: { [weak self] widgetType in
            guard let self, self.controller?.widgetOptions.contains(where: { $0.widgetType == widgetType }) == true else { return }
            self.controller?.addWidget(widgetType)
        },
        onOpenDisplayPreview: { [weak self] in
            self?.displayPreviewCoordinator.open()
        }
    )

    override convenience init() {
        self.init(defaults: .standard)
    }

    init(
        defaults: UserDefaults,
        registerHotKey: DisplayShortcutRegistration.Register? = nil,
        displayShortcutAction: (@MainActor (WidgetShortcutAction?) -> Void)? = nil
    ) {
        self.defaults = defaults
        widgetShortcutStore = WidgetLaunchShortcutStore(defaults: defaults)
        hotKeyRegistration = registerHotKey
        self.displayShortcutAction = displayShortcutAction
        super.init()
        shortcutState = initialShortcutBindingState()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        initialActivationPending = Self.shouldOpenLauncherOnInitialActivation(
            arguments: CommandLine.arguments,
            launchedAsLoginItem: Self.launchedAsLoginItem
        )
        DashboardDefaults.register()
        shortcutState = initialShortcutBindingState()
        NSApp.setActivationPolicy(.regular)
        NSApp.applicationIconImage = NSImage(named: "AppIcon") ?? NSApp.applicationIconImage
        setupMainMenu()

        controller = WidgetHostController()
        controller?.onWidgetOptionsChanged = { [weak self] options in
            self?.widgetOptionsChanged(options)
            if self?.launcherRequested == true { self?.requestOpenLauncher() }
        }
        controller?.onDisplayPreviewRequested = { [weak self] in self?.displayPreviewCoordinator.open() }
        applyPresentationSettings()
        setupStatusItem()
        registerAcceptedSingleActionHotKeys()
        registerAcceptedDisplayHotKey()
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
        displayPreviewCoordinator.flushPersistedState()
        singleActionHotKeys.removeAll()
        displayHotKeys.suspend()
        widgetHotKeys.removeAll()
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if terminationApproved { return .terminateNow }
        guard !terminationPending, let controller else {
            return controller == nil ? .terminateNow : .terminateLater
        }

        terminationPending = true
        Task { @MainActor [weak self, weak sender] in
            guard let self, let sender else { return }
            guard await displayPreviewCoordinator.prepareForTermination() else {
                terminationPending = false
                displayPreviewCoordinator.terminationCancelled()
                sender.reply(toApplicationShouldTerminate: false)
                return
            }
            let ready = await controller.prepareForTermination()
            terminationPending = false
            terminationApproved = ready
            if !ready { displayPreviewCoordinator.terminationCancelled() }
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
        // Items set their own enabled state (Arrange Widgets, Launch at Login).
        menu.autoenablesItems = false
        menu.delegate = self
        statusItem.menu = menu
        self.statusItem = statusItem
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
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

        let updateItem = NSMenuItem(title: "Check for Updates…", action: #selector(checkForUpdates), keyEquivalent: "")
        updateItem.target = self
        menu.addItem(updateItem)

        let aboutItem = NSMenuItem(title: "About Classroom Widgets", action: #selector(showAbout), keyEquivalent: "")
        aboutItem.target = self
        menu.addItem(aboutItem)
        menu.addItem(.separator())

        let quitItem = NSMenuItem(title: "Quit Classroom Widgets", action: #selector(quitApp), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)
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

    /// Registration lifecycle shared by the single-action shortcuts (Open
    /// Settings, Move to Next Display): stage, duplicate-check, register, then
    /// persist, restoring the previous assignment when registration fails.
    private struct SingleActionHotKeySpec {
        let owner: ShortcutBindingState.Owner
        let keyCodeDefaultsKey: String
        let modifiersDefaultsKey: String
        let defaultKeyCode: Int
        let defaultModifiers: Int
        let inactiveStatus: String
        let unavailableStatus: String

        static let settings = SingleActionHotKeySpec(
            owner: .settings,
            keyCodeDefaultsKey: DashboardSettingKeys.settingsShortcutKeyCode,
            modifiersDefaultsKey: DashboardSettingKeys.settingsShortcutModifiers,
            defaultKeyCode: DashboardDefaults.settingsShortcutKeyCode,
            defaultModifiers: DashboardDefaults.shortcutModifiers,
            inactiveStatus: "The Open Settings shortcut is inactive because macOS could not register it.",
            unavailableStatus: "The Open Settings shortcut is unavailable. The previous shortcut remains active."
        )
        static let moveWidgetPrevious = SingleActionHotKeySpec(
            owner: .moveWidgetPrevious,
            keyCodeDefaultsKey: DashboardSettingKeys.moveWidgetPreviousShortcutKeyCode,
            modifiersDefaultsKey: DashboardSettingKeys.moveWidgetPreviousShortcutModifiers,
            defaultKeyCode: DashboardDefaults.moveWidgetPreviousShortcutKeyCode,
            defaultModifiers: DashboardDefaults.moveWidgetShortcutModifiers,
            inactiveStatus: "The Move to Previous Display shortcut is inactive because macOS could not register it.",
            unavailableStatus: "The Move to Previous Display shortcut is unavailable. The previous shortcut remains active."
        )
        static let moveWidgetNext = SingleActionHotKeySpec(
            owner: .moveWidgetNext,
            keyCodeDefaultsKey: DashboardSettingKeys.moveWidgetNextShortcutKeyCode,
            modifiersDefaultsKey: DashboardSettingKeys.moveWidgetNextShortcutModifiers,
            defaultKeyCode: DashboardDefaults.moveWidgetNextShortcutKeyCode,
            defaultModifiers: DashboardDefaults.moveWidgetShortcutModifiers,
            inactiveStatus: "The Move to Next Display shortcut is inactive because macOS could not register it.",
            unavailableStatus: "The Move to Next Display shortcut is unavailable. The previous shortcut remains active."
        )
    }

    private static let singleActionSpecs: [SingleActionHotKeySpec] = [.settings, .moveWidgetPrevious, .moveWidgetNext]

    private static func moveDirection(for owner: ShortcutBindingState.Owner) -> MoveDirection? {
        switch owner {
        case .moveWidgetPrevious: return .previous
        case .moveWidgetNext: return .next
        default: return nil
        }
    }

    private func singleActionStatus(_ status: String?, for spec: SingleActionHotKeySpec) {
        if let direction = Self.moveDirection(for: spec.owner) {
            moveWidgetShortcutStatuses[direction] = status
        } else {
            shortcutStatus = status
        }
    }

    private func singleActionStatus(for spec: SingleActionHotKeySpec) -> String? {
        Self.moveDirection(for: spec.owner).flatMap { moveWidgetShortcutStatuses[$0] } ?? (spec.owner == .settings ? shortcutStatus : nil)
    }

    private func performSingleAction(_ owner: ShortcutBindingState.Owner) {
        switch owner {
        case .moveWidgetPrevious: controller?.moveSelectedWidget(.previous)
        case .moveWidgetNext: controller?.moveSelectedWidget(.next)
        default: showSettings()
        }
    }

    private func settingsShortcutChanged(_ candidate: DashboardShortcut) {
        singleActionShortcutChanged(candidate, spec: .settings)
    }

    private func moveWidgetShortcutChanged(_ candidate: DashboardShortcut, direction: MoveDirection) {
        singleActionShortcutChanged(candidate, spec: direction == .next ? .moveWidgetNext : .moveWidgetPrevious)
    }

    private func singleActionShortcutChanged(_ candidate: DashboardShortcut, spec: SingleActionHotKeySpec) {
        guard var state = shortcutState else { return }
        switch state.stage(candidate, for: spec.owner) {
        case .duplicate:
            singleActionStatus(Self.settingsDuplicateStatus, for: spec)
        case .unchanged:
            singleActionStatus(nil, for: spec)
        case .staged:
            singleActionStatus(nil, for: spec)
        }
        shortcutState = state
        refreshShortcutContext()
        guard state.candidate(for: spec.owner) != nil, !state.registrationsSuspended else { return }
        applyPendingSingleActionShortcut(spec)
    }

    private func registerAcceptedSingleActionHotKeys() {
        for spec in Self.singleActionSpecs {
            registerAcceptedSingleActionHotKey(spec)
        }
    }

    private func registerAcceptedSingleActionHotKey(_ spec: SingleActionHotKeySpec) {
        guard let shortcut = shortcutState?.shortcut(for: spec.owner), shortcut.isAssigned else {
            singleActionHotKeys[spec.owner] = nil
            return
        }
        if singleActionHotKeys[spec.owner]?.shortcut == shortcut { return }
        do {
            let replacement = try makeHotKey(shortcut) { [weak self] in
                self?.performSingleAction(spec.owner)
            }
            singleActionHotKeys[spec.owner] = (shortcut, replacement)
            singleActionStatus(nil, for: spec)
            refreshShortcutContext()
        } catch {
            singleActionStatus(spec.inactiveStatus, for: spec)
            refreshShortcutContext()
        }
    }

    private func applyPendingSingleActionShortcut(_ spec: SingleActionHotKeySpec) {
        guard var state = shortcutState, let candidate = state.candidate(for: spec.owner) else { return }
        if !candidate.isAssigned {
            state.complete(spec.owner, succeeded: true)
            shortcutState = state
            singleActionHotKeys[spec.owner] = nil
            persistSingleActionShortcut(candidate, spec)
            singleActionStatus(nil, for: spec)
            refreshShortcutContext()
            return
        }
        do {
            let replacement = try makeHotKey(candidate) { [weak self] in
                self?.performSingleAction(spec.owner)
            }
            state.complete(spec.owner, succeeded: true)
            shortcutState = state
            singleActionHotKeys[spec.owner] = (candidate, replacement)
            persistSingleActionShortcut(candidate, spec)
            singleActionStatus(nil, for: spec)
        } catch {
            state.complete(spec.owner, succeeded: false)
            shortcutState = state
            if let shortcut = state.shortcut(for: spec.owner) {
                persistSingleActionShortcut(shortcut, spec)
            }
            singleActionStatus(spec.unavailableStatus, for: spec)
        }
        refreshShortcutContext()
    }

    private func persistSingleActionShortcut(_ shortcut: DashboardShortcut, _ spec: SingleActionHotKeySpec) {
        defaults.set(shortcut.keyCode, forKey: spec.keyCodeDefaultsKey)
        defaults.set(shortcut.modifiers, forKey: spec.modifiersDefaultsKey)
    }

    private func persistedSingleActionShortcut(_ spec: SingleActionHotKeySpec) -> DashboardShortcut {
        let keyCode = defaults.object(forKey: spec.keyCodeDefaultsKey) == nil
            ? spec.defaultKeyCode
            : defaults.integer(forKey: spec.keyCodeDefaultsKey)
        let modifiers = defaults.object(forKey: spec.modifiersDefaultsKey) == nil
            ? spec.defaultModifiers
            : defaults.integer(forKey: spec.modifiersDefaultsKey)
        return DashboardShortcut(keyCode: keyCode, modifiers: modifiers).normalized
    }

    func widgetOptionsChanged(_ options: [CompactWidgetOption]) {
        let available = Set(options.map(\.widgetType))
        widgetHotKeys = widgetHotKeys.filter { owner, _ in
            switch owner {
            case let .widget(widgetType), let .widgetDismiss(widgetType): return available.contains(widgetType)
            case .settings, .moveWidgetPrevious, .moveWidgetNext, .display, .displayDismiss: return false
            }
        }
        let bindings = widgetShortcutStore.bindings(for: options, reserving: acceptedNativeShortcuts)
        if var state = shortcutState {
            for action: WidgetShortcutAction in [.show, .dismiss] {
                let owner = ShortcutBindingState.Owner.displayOwner(for: action)
                let hadPending = state.candidate(for: owner) != nil
                let resolution = displayShortcutStartupGate.mergeWidgetBindings(
                    bindings, inventoryIsReady: !options.isEmpty, into: &state, action: action
                )
                if let stored = widgetShortcutStore.storedDisplayBinding(action: action) {
                    state.setInitialDisplay(stored, action: action)
                }
                if case .rejectedDuplicate = resolution {
                    displayShortcutStatuses[owner] = Self.widgetDuplicateStatus
                    preserveUnassignedDisplayChoiceIfNeeded(in: &state, action: action)
                }
                if state.shortcut(for: owner) == nil, !options.isEmpty, !hadPending {
                    let binding = widgetShortcutStore.initializeDisplayBinding(
                        reserving: state.assignedShortcuts(excluding: owner), action: action
                    )
                    state.setInitialDisplay(binding, action: action)
                    if !binding.isAssigned {
                        displayShortcutStatuses[owner] = "The default shortcut is already assigned. Choose another shortcut."
                    }
                }
            }
            shortcutState = state
        }
        guard shortcutState?.registrationsSuspended != true else {
            refreshShortcutContext(options: options)
            return
        }
        refreshShortcutContext(options: options)
        if applyPendingWidgetShortcutReset() { return }
        registerAcceptedDisplayHotKey()
        for option in options { registerAcceptedWidgetShortcuts(for: option.widgetType) }
        applyPendingDisplayShortcut()
        refreshShortcutContext(options: options)
    }

    private func setDisplayShortcut(_ shortcut: DashboardShortcut, action: WidgetShortcutAction) {
        guard var state = shortcutState else { return }
        let owner = ShortcutBindingState.Owner.displayOwner(for: action)
        switch state.stage(shortcut, for: owner) {
        case .duplicate:
            displayShortcutStatuses[owner] = Self.widgetDuplicateStatus
            preserveUnassignedDisplayChoiceIfNeeded(in: &state, action: action)
        case .unchanged:
            displayShortcutStatuses[owner] = nil
        case .staged:
            displayShortcutStatuses[owner] = nil
        }
        shortcutState = state
        refreshShortcutContext()
        applyPendingDisplayShortcut()
    }

    func initialShortcutBindingState() -> ShortcutBindingState {
        let settings = persistedSettingsShortcut()
        let display = widgetShortcutStore.storedDisplayBinding()
        let displayDismiss = widgetShortcutStore.storedDisplayBinding(action: .dismiss)
        let storedBindings = widgetShortcutStore.storedBindings()
        let reserved = [settings, display, displayDismiss].compactMap { $0?.normalized }
            + storedBindings.values.flatMap { [$0.show.normalized, $0.dismiss.normalized] }
        var state = ShortcutBindingState(
            settings: settings,
            display: display,
            displayDismiss: displayDismiss,
            moveWidgetPrevious: initialMoveWidgetShortcut(.moveWidgetPrevious, reserving: reserved),
            moveWidgetNext: initialMoveWidgetShortcut(
                .moveWidgetNext,
                reserving: reserved + [persistedSingleActionShortcut(.moveWidgetPrevious).normalized]
            )
        )
        state.replaceWidgets(with: storedBindings)
        return state
    }

    private func initialMoveWidgetShortcut(_ spec: SingleActionHotKeySpec, reserving reserved: [DashboardShortcut]) -> DashboardShortcut {
        let registered = defaults.volatileDomain(forName: UserDefaults.registrationDomain) ?? [:]
        func customized(_ key: String) -> Bool {
            guard let value = defaults.object(forKey: key) as? Int else { return false }
            if let registeredValue = registered[key] as? Int { return value != registeredValue }
            return true
        }
        if !customized(spec.keyCodeDefaultsKey), !customized(spec.modifiersDefaultsKey) {
            let fallback = DashboardShortcut(keyCode: spec.defaultKeyCode, modifiers: spec.defaultModifiers).normalized
            if fallback.isAssigned, reserved.contains(fallback) {
                let unassigned = DashboardShortcut(keyCode: -1, modifiers: 0)
                persistSingleActionShortcut(unassigned, spec)
                return unassigned
            }
        }
        return persistedSingleActionShortcut(spec)
    }

    func shouldApplyPendingDisplayShortcut(in state: ShortcutBindingState) -> Bool {
        [.show, .dismiss].contains { displayShortcutStartupGate.shouldApplyPending(in: state, action: $0) }
    }

    func preserveUnassignedDisplayChoiceIfNeeded(in state: inout ShortcutBindingState, action: WidgetShortcutAction = .show) {
        guard state.shortcut(for: .displayOwner(for: action)) == nil else { return }
        let unassigned = DashboardShortcut(keyCode: -1, modifiers: 0)
        state.setInitialDisplay(unassigned, action: action)
        widgetShortcutStore.setDisplay(unassigned, action: action)
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
            singleActionHotKeys.removeAll()
            displayHotKeys.suspend()
            widgetHotKeys.removeAll()
            return
        }

        guard shortcutState?.recorderEnded() == true else { return }
        let duplicateSingleActionStatuses = Self.singleActionSpecs.reduce(into: [ShortcutBindingState.Owner: String]()) { result, spec in
            if singleActionStatus(for: spec) == Self.settingsDuplicateStatus { result[spec.owner] = Self.settingsDuplicateStatus }
        }
        let duplicateWidgetStatuses = widgetShortcutStatuses.filter { $0.value == Self.widgetDuplicateStatus }
        registerAcceptedSingleActionHotKeys()
        registerAcceptedDisplayHotKey()
        for option in settingsContext.widgetOptions { registerAcceptedWidgetShortcuts(for: option.widgetType) }
        for spec in Self.singleActionSpecs {
            if let status = duplicateSingleActionStatuses[spec.owner] {
                singleActionStatus(status, for: spec)
            }
        }
        widgetShortcutStatuses.merge(duplicateWidgetStatuses) { _, duplicate in duplicate }
        for spec in Self.singleActionSpecs where shortcutState?.candidate(for: spec.owner) != nil {
            applyPendingSingleActionShortcut(spec)
        }
        if let state = shortcutState, shouldApplyPendingDisplayShortcut(in: state) {
            applyPendingDisplayShortcut()
        }
        for option in settingsContext.widgetOptions {
            if shortcutState?.candidate(for: .widget(option.widgetType)) != nil {
                applyPendingWidgetShortcut(for: option.widgetType, action: .show)
            }
            if shortcutState?.candidate(for: .widgetDismiss(option.widgetType)) != nil {
                applyPendingWidgetShortcut(for: option.widgetType, action: .dismiss)
            }
        }
        refreshShortcutContext()
        applyPendingWidgetShortcutReset()
    }

    private func registerAcceptedDisplayHotKey() {
        guard let state = shortcutState, !state.registrationsSuspended else { return }
        displayHotKeys.restoreAccepted(state.displayBinding())
        updateDisplayShortcutRegistrationStatuses(state)
        refreshShortcutContext()
    }

    private func updateDisplayShortcutRegistrationStatuses(_ state: ShortcutBindingState) {
        for owner: ShortcutBindingState.Owner in [.display, .displayDismiss] {
            guard let shortcut = state.shortcut(for: owner), shortcut.isAssigned else { continue }
            if !displayHotKeys.isActive(shortcut) {
                displayShortcutStatuses[owner] = "Inactive — macOS could not register this shortcut."
            } else if displayShortcutStatuses[owner] == "Inactive — macOS could not register this shortcut." {
                displayShortcutStatuses[owner] = nil
            }
        }
    }

    private func applyPendingDisplayShortcut() {
        guard var state = shortcutState else { return }
        let actions: [WidgetShortcutAction] = [.show, .dismiss].filter {
            displayShortcutStartupGate.shouldApplyPending(in: state, action: $0)
        }
        guard !actions.isEmpty else { return }
        var proposed = state.displayBinding()
        for action in actions {
            guard let candidate = state.candidate(for: .displayOwner(for: action)) else { continue }
            if action == .show { proposed.show = candidate }
            else { proposed.dismiss = candidate }
        }
        let succeeded = displayHotKeys.replace(with: proposed, changing: actions)
        for action in actions {
            let owner = ShortcutBindingState.Owner.displayOwner(for: action)
            guard let candidate = state.candidate(for: owner) else { continue }
            state.complete(owner, succeeded: succeeded)
            if succeeded {
                widgetShortcutStore.setDisplay(candidate, action: action)
                displayShortcutStatuses[owner] = nil
            } else {
                let previousIsActive = state.shortcut(for: owner).map { displayHotKeys.isActive($0) } ?? false
                displayShortcutStatuses[owner] = previousIsActive
                    ? "Unavailable — the previous shortcut remains active."
                    : "Inactive — macOS could not register this shortcut."
            }
        }
        shortcutState = state
        updateDisplayShortcutRegistrationStatuses(state)
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
        do {
            let replacement = try makeHotKey(shortcut) { [weak self] in
                guard let self, self.controller?.widgetOptions.contains(where: { $0.widgetType == widgetType }) == true else { return }
                switch action {
                case .show: self.controller?.showWidget(widgetType)
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

    private static let settingsDuplicateStatus = "That shortcut is already assigned in Classroom Widgets."
    private static let widgetDuplicateStatus = "Already assigned in Classroom Widgets."

    private func shortcutOwner(widgetType: Int, action: WidgetShortcutAction) -> ShortcutBindingState.Owner {
        action == .show ? .widget(widgetType) : .widgetDismiss(widgetType)
    }

    private func resetWidgetShortcuts() {
        widgetShortcutResetPending = true
        applyPendingWidgetShortcutReset()
    }

    @discardableResult
    private func applyPendingWidgetShortcutReset() -> Bool {
        // Defer the whole reset, rather than persist provisional widget defaults
        // while Display replacement cannot yet succeed or fail.
        guard widgetShortcutResetPending, displayShortcutStartupGate.hasWidgetInventory,
              var state = shortcutState, !state.registrationsSuspended else { return false }
        widgetShortcutResetPending = false
        let options = settingsContext.widgetOptions
        let available = Set(options.map(\.widgetType))
        widgetHotKeys.removeAll()
        widgetShortcutStatuses.removeAll()
        displayShortcutStatuses.removeAll()
        registerAcceptedDisplayHotKey()
        // Current inventory choices are being reset. Saved and pending choices
        // outside this inventory retain their reservations.
        state.replaceWidgets(with: widgetShortcutStore.storedBindings().filter { !available.contains($0.key) })
        state.complete(.display, succeeded: false)
        state.complete(.displayDismiss, succeeded: false)
        shortcutState = state
        let preferred = WidgetLaunchShortcutStore.defaultDisplayShortcut
        // Stage both defaults atomically. A saved Settings/non-inventory widget
        // or pending candidate keeps its reservation; reset never overwrites it.
        var proposed = state
        var hasConflict = false
        for owner: ShortcutBindingState.Owner in [.display, .displayDismiss] {
            if case .duplicate = proposed.stage(preferred, for: owner) {
                displayShortcutStatuses[owner] = "The default shortcut is already assigned. Choose another shortcut."
                hasConflict = true
            }
        }
        if !hasConflict {
            shortcutState = proposed
            applyPendingDisplayShortcut()
        }
        // Registration has now accepted or rejected Display's default. Allocate
        // once from that result, retaining old Display keys after a failed edit.
        let reservations = acceptedNativeShortcuts + (shortcutState.map { Array($0.pending.values) } ?? [])
        widgetShortcutStore.reset(options: options, reserving: reservations)
        let bindings = widgetShortcutStore.bindings(for: options, reserving: reservations)
        shortcutState?.replaceWidgets(with: bindings)
        for option in options { registerAcceptedWidgetShortcuts(for: option.widgetType) }
        refreshShortcutContext()
        return true
    }

    private var acceptedNativeShortcuts: [DashboardShortcut] {
        guard let state = shortcutState else { return [] }
        let owners: [ShortcutBindingState.Owner] = [.settings, .moveWidgetPrevious, .moveWidgetNext, .display, .displayDismiss]
        let accepted = owners.compactMap { state.shortcut(for: $0) }
        // Before the first inventory, new Display choices must be checked against
        // the real widget defaults, not displace those defaults during backfill.
        let pendingOwners: [ShortcutBindingState.Owner] = displayShortcutStartupGate.hasWidgetInventory ? owners : [.settings, .moveWidgetPrevious, .moveWidgetNext]
        return accepted + pendingOwners.compactMap { state.candidate(for: $0) }
    }

    private func refreshShortcutContext(options: [CompactWidgetOption]? = nil) {
        let options = options ?? settingsContext.widgetOptions
        settingsContext.updateWidgetShortcuts(
            options: options,
            displayShortcuts: shortcutState?.displayBinding(includingPending: true),
            shortcuts: Dictionary(uniqueKeysWithValues: options.compactMap { option in
                guard let show = shortcutState?.shortcut(for: .widget(option.widgetType)),
                      let dismiss = shortcutState?.shortcut(for: .widgetDismiss(option.widgetType)) else { return nil }
                return (option.widgetType, WidgetShortcutBinding(show: show, dismiss: dismiss))
            }),
            displayStatuses: displayShortcutStatuses,
            widgetStatuses: widgetShortcutStatuses,
            status: shortcutStatus,
            moveWidgetStatuses: moveWidgetShortcutStatuses
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
                string: "A menu-bar launcher for floating classroom widgets.\n\nDisplay was inspired by BetterDisplay by waydabber (betterdisplay.com). The implementation uses only public Apple APIs and contains no BetterDisplay source code."
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

    private func applyPresentationSettings() {
        controller?.applySettings()
        displayPreviewCoordinator.applyPresentationSettings(
            backgroundOpacity: defaults.double(forKey: DashboardSettingKeys.compactBackgroundOpacity),
            keepOnAllSpaces: defaults.bool(forKey: DashboardSettingKeys.keepOnAllSpaces)
        )
    }

    private func shortcutKeyCode() -> Int {
        return defaults.object(forKey: DashboardSettingKeys.settingsShortcutKeyCode) == nil
            ? DashboardDefaults.settingsShortcutKeyCode
            : defaults.integer(forKey: DashboardSettingKeys.settingsShortcutKeyCode)
    }

    private func persistedSettingsShortcut() -> DashboardShortcut {
        DashboardShortcut(keyCode: shortcutKeyCode(), modifiers: shortcutModifiers()).normalized
    }

    func moveSelectedWidget(_ direction: MoveDirection) {
        controller?.moveSelectedWidget(direction)
    }

    private func shortcutModifiers() -> Int {
        return defaults.object(forKey: DashboardSettingKeys.settingsShortcutModifiers) == nil
            ? DashboardDefaults.shortcutModifiers
            : defaults.integer(forKey: DashboardSettingKeys.settingsShortcutModifiers)
    }

    private func makeHotKey(_ shortcut: DashboardShortcut, handler: @escaping @MainActor () -> Void) throws -> AnyObject {
        if let hotKeyRegistration { return try hotKeyRegistration(shortcut, handler) }
        guard shortcut.isAssigned, let modifiers = carbonModifiers(from: shortcut.modifiers) else {
            throw DashboardHotKeyError.register(OSStatus(paramErr))
        }
        nextHotKeyID += 1
        return try DashboardHotKey(id: nextHotKeyID, keyCode: UInt32(shortcut.keyCode), modifiers: modifiers, handler: handler)
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
