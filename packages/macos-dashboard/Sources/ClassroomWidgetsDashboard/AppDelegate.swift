import AppKit
import Carbon
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    // Members without `private` are shared with the AppDelegate+*.swift extensions.
    var controller: WidgetHostController?
    private var perfScenario: PerfScenario?
    private var launcherRequested = false
    private var initialActivationPending = false
    private var terminationPending = false
    private var terminationApproved = false
    var singleActionHotKeys: [ShortcutBindingState.Owner: (shortcut: DashboardShortcut, hotKey: AnyObject)] = [:]
    var widgetHotKeys: [ShortcutBindingState.Owner: (shortcut: DashboardShortcut, hotKey: AnyObject)] = [:]
    var widgetShortcutStatuses: [ShortcutBindingState.Owner: String] = [:]
    var displayShortcutStatuses: [ShortcutBindingState.Owner: String] = [:]
    var nextHotKeyID: UInt32 = 100
    let defaults: UserDefaults
    let widgetShortcutStore: WidgetLaunchShortcutStore
    let hotKeyRegistration: DisplayShortcutRegistration.Register?
    let displayShortcutAction: (@MainActor (WidgetShortcutAction?) -> Void)?
    lazy var displayHotKeys = DisplayShortcutRegistration(
        register: { [unowned self] shortcut, handler in try self.makeHotKey(shortcut, handler: handler) },
        perform: { [weak self] action in self?.performDisplayShortcut(action: action) }
    )
    lazy var updates = UpdateController(
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
        },
        updateAvailable: { [weak self] version in self?.showUpdateAvailability(version) }
    )
    var shortcutState: ShortcutBindingState?
    var displayShortcutStartupGate = DisplayShortcutStartupGate()
    var widgetShortcutResetPending = false
    var shortcutStatus: String?
    var moveWidgetShortcutStatuses: [MoveDirection: String] = [:]
    var statusItem: NSStatusItem?
    var dockMenuActions: [DockMenuAction] = []
    var mainUpdateMenuItem: NSMenuItem?
    var availableUpdateVersion: String?
    let launchAtLoginManager = LaunchAtLoginManager()
    let displayPreviewCoordinator: DisplayPreviewCoordinator
    private let moveWorkAreas: @MainActor () -> [CGRect]
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
    lazy var settingsWindowCoordinator = SettingsWindowCoordinator { [weak self] in
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
        controller: WidgetHostController? = nil,
        displayPreviewCoordinator: DisplayPreviewCoordinator? = nil,
        moveWorkAreas: @escaping @MainActor () -> [CGRect] = {
            NSScreen.screens.map { $0.visibleFrame.insetBy(dx: 12, dy: 12) }
        },
        registerHotKey: DisplayShortcutRegistration.Register? = nil,
        displayShortcutAction: (@MainActor (WidgetShortcutAction?) -> Void)? = nil
    ) {
        self.defaults = defaults
        self.controller = controller
        self.displayPreviewCoordinator = displayPreviewCoordinator ?? DisplayPreviewCoordinator()
        self.moveWorkAreas = moveWorkAreas
        widgetShortcutStore = WidgetLaunchShortcutStore(defaults: defaults)
        hotKeyRegistration = registerHotKey
        self.displayShortcutAction = displayShortcutAction
        super.init()
        shortcutState = initialShortcutBindingState()
    }

    func applicationWillFinishLaunching(_ notification: Notification) {
        PerfProbe.mark("app.willFinishLaunching")
        // The host page's first load waits about a second for WebKit's helper
        // processes, so start it before AppKit finishes launching.
        DashboardDefaults.register()
        controller = WidgetHostController()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        PerfProbe.mark("app.didFinishLaunching.begin")
        initialActivationPending = Self.shouldOpenLauncherOnInitialActivation(
            arguments: CommandLine.arguments,
            launchedAsLoginItem: Self.launchedAsLoginItem
        )
        shortcutState = initialShortcutBindingState()
        let iconVisibility = AppIconVisibility(rawValue: defaults.string(forKey: DashboardSettingKeys.appIconVisibility) ?? "") ?? .both
        NSApp.setActivationPolicy(iconVisibility == .menuBarOnly ? .accessory : .regular)
        NSApp.applicationIconImage = NSImage(named: "AppIcon") ?? NSApp.applicationIconImage
        setupMainMenu()

        controller?.onWidgetOptionsChanged = { [weak self] options in
            self?.widgetOptionsChanged(options)
            if self?.launcherRequested == true { self?.requestOpenLauncher() }
        }
        controller?.onDisplayPreviewRequested = { [weak self] in self?.displayPreviewCoordinator.open() }
        // Widgets the host listed before these callbacks were set.
        if let options = controller?.widgetOptions, !options.isEmpty { widgetOptionsChanged(options) }
        applyPresentationSettings()
        if iconVisibility != .dockOnly { setupStatusItem() }
        registerAcceptedSingleActionHotKeys()
        registerAcceptedDisplayHotKey()
        // Accessory apps may not become active until a window is explicitly opened.
        if iconVisibility == .menuBarOnly && initialActivationPending {
            initialActivationPending = false
            requestOpenLauncher()
        }
        DashboardLog.app.info("Classroom Widgets menu-bar widget launcher launched")
        PerfProbe.mark("app.didFinishLaunching.end")
        if let configuration = PerfProbe.configuration, PerfScenario.runs(configuration.scenario), let controller {
            perfScenario = PerfScenario(host: controller, scenario: configuration.scenario)
            perfScenario?.start()
        }
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
        PerfProbe.mark("app.didBecomeActive")
        initialActivationPending = false
        requestOpenLauncher()
    }

    func applicationWillTerminate(_ notification: Notification) {
        PerfProbe.mark("app.willTerminate")
        PerfProbe.flush()
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


    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        requestOpenLauncher()
        return true
    }

    func requestOpenLauncher() {
        PerfProbe.mark("launcher.requested", ["deferred": controller?.widgetOptions.isEmpty != false])
        guard controller?.widgetOptions.isEmpty == false else {
            launcherRequested = true
            // Load the launcher page alongside the host; it is shown once the host has its widgets.
            launcherWindowCoordinator.prepare()
            return
        }
        launcherRequested = false
        launcherWindowCoordinator.show()
    }

    private func applyPresentationSettings() {
        controller?.applySettings()
        displayPreviewCoordinator.applyPresentationSettings(
            backgroundOpacity: defaults.double(forKey: DashboardSettingKeys.compactBackgroundOpacity),
            keepOnAllSpaces: defaults.bool(forKey: DashboardSettingKeys.keepOnAllSpaces)
        )
    }

    func moveSelectedWidget(_ direction: MoveDirection) {
        let workAreas = moveWorkAreas()
        if let window = displayPreviewCoordinator.windowController?.window, window.isKeyWindow {
            if let moved = WidgetPanelMoveGeometry.nextDisplayFrame(frame: window.frame, workAreas: workAreas, direction: direction) {
                // The native move callback persists the frame and revokes capture
                // synchronously if Display now overlaps its source.
                window.setFrame(moved, display: true)
            }
            return
        }
        controller?.moveSelectedWidget(direction, workAreas: workAreas)
    }
}
