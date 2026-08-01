import AppKit
import WebKit

/// The two deliberate surfaces offered by the native shell.  These are kept
/// separate from the web UI's layout modes: the same web view is merely given
/// a different, ordinary AppKit window to live in.
enum DashboardWindowMode: String {
    case compact
    case canvas

    init?(bridgeValue: String) {
        self.init(rawValue: bridgeValue)
    }
}

@MainActor
final class DashboardWindowController: NSWindowController, WKNavigationDelegate, WKUIDelegate, NSWindowDelegate {
    private static let compactFrameDefaultsKey = "dashboardCompactWindowFrameV3"
    private static let canvasFrameDefaultsKey = "dashboardCanvasWindowFrameV2"

    private let webView: WKWebView
    private let compactNavigationBar = NSVisualEffectView()
    private let compactDragRegion = CompactDragRegionView()
    private let compactChromeTrackingView = CompactChromeTrackingView()
    private let scriptMessageHandler: DashboardScriptMessageHandler
    private let widgetPanelCoordinator: WidgetPanelCoordinator
    private var dashboardVisible: Bool
    private var windowMode: DashboardWindowMode
    private var pendingWidgetLauncherOpen = false
    private var widgetLauncherOpenAttemptInFlight = false
    private var hideGeneration = 0
    private var visibilityPushGeneration = 0
    private var modePushGeneration = 0
    private var backgroundOpacityPushGeneration = 0
    private var chromeVisibilityPushGeneration = 0
    private var chromeHideGeneration = 0
    private var compactChromeVisible = true
    private var isChangingWindowMode = false
    private var hasReceivedWidgetInventory = false
    private var compactWidgetCreationPending = false
    private var pendingDashboardRecoveryChanges: [WidgetPanelStateChange]?
    private var awaitingCompactInventory = false
    private var requiredCompactInventoryRevision = 0
    private var lastInventoryHostInstanceID: String?
    private var lastInventoryRevision = -1
    private var pendingHostWriteCount = 0
    private var pendingHostWriteFailed = false
    private var hostWriteGeneration = 0
    private var pendingHostWriteWaiters: [(@MainActor (Bool) -> Void)] = []

    var isDashboardVisible: Bool { dashboardVisible }
    var onVisibilityChanged: (@MainActor (Bool) -> Void)?
    var onCompactWidgetOptionsChanged: (@MainActor ([CompactWidgetOption]) -> Void)?
    private(set) var compactWidgetOptions: [CompactWidgetOption] = []

    init() {
        let initiallyVisible = UserDefaults.standard.bool(forKey: DashboardSettingKeys.showDashboardAtLaunch)
        dashboardVisible = initiallyVisible
        windowMode = .compact

        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(
            StaticFileSchemeHandler(webRoot: WebRootResolver.resolve()),
            forURLScheme: dashboardURLScheme
        )
        configuration.userContentController.addUserScript(WKUserScript(
            source: "window.__CLASSROOM_WIDGETS_MACOS__ = true;",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        ))
        scriptMessageHandler = DashboardScriptMessageHandler()
        widgetPanelCoordinator = WidgetPanelCoordinator(compactPresentationActive: initiallyVisible)

        webView = WKWebView(frame: .zero, configuration: configuration)
        // This is intentionally an opaque, bounded AppKit window.  The
        // previous transparent, display-sized window made input routing depend
        // on asynchronous DOM hit regions.
        webView.setValue(true, forKey: "drawsBackground")

        let window = DashboardWindow(
            contentRect: Self.defaultFrame(for: .compact),
            styleMask: Self.styleMask(for: .compact),
            backing: .buffered,
            defer: false
        )
        window.title = "Classroom Widgets"
        window.backgroundColor = .windowBackgroundColor
        window.isOpaque = true
        window.hasShadow = true
        window.isReleasedWhenClosed = false
        window.contentMinSize = Self.minimumContentSize(for: .compact)
        window.contentView = NSView()
        compactNavigationBar.material = .headerView
        compactNavigationBar.blendingMode = .withinWindow
        compactNavigationBar.state = .active
        compactNavigationBar.setAccessibilityElement(false)
        compactNavigationBar.wantsLayer = true
        compactNavigationBar.layer?.cornerRadius = 10
        compactNavigationBar.layer?.cornerCurve = .continuous
        compactNavigationBar.layer?.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        compactNavigationBar.layer?.masksToBounds = true
        webView.frame = window.contentView?.bounds ?? .zero
        webView.autoresizingMask = [.width, .height]
        window.contentView?.addSubview(compactNavigationBar)
        window.contentView?.addSubview(webView)
        window.contentView?.addSubview(compactDragRegion)
        window.contentView?.addSubview(compactChromeTrackingView)

        super.init(window: window)
        window.delegate = self
        window.acceptsMouseMovedEvents = true
        webView.navigationDelegate = self
        webView.uiDelegate = self

        compactChromeTrackingView.onPointerEntered = { [weak self] in
            self?.revealCompactChrome()
        }
        compactChromeTrackingView.onPointerExited = { [weak self] in
            self?.scheduleCompactChromeHide()
        }

        restoreFrame(for: .compact)
        configureWindow(for: .compact)
        widgetPanelCoordinator.applyPresentationSettings(
            backgroundOpacity: compactBackgroundOpacity,
            keepOnAllSpaces: UserDefaults.standard.bool(forKey: DashboardSettingKeys.keepOnAllSpaces)
        )
        layoutCompactDragRegion()
        scheduleCompactChromeHide()

        scriptMessageHandler.onVisibilityChanged = { [weak self] visible in
            guard let self else { return }
            self.dashboardVisible = visible
            if !self.isChangingWindowMode || !visible {
                self.syncWindowVisibility()
            }
            self.onVisibilityChanged?(visible)
        }
        scriptMessageHandler.onWindowModeRequested = { [weak self] mode in
            self?.setWindowMode(mode)
        }
        scriptMessageHandler.onWidgetPanelsChanged = { [weak self] inventory in
            self?.reconcileWidgetPanels(inventory)
        }
        scriptMessageHandler.onCompactWidgetOptionsChanged = { [weak self] options in
            self?.setCompactWidgetOptions(options)
        }
        widgetPanelCoordinator.onPanelStateChange = { [weak self] change in
            self?.applyPanelStateChange(change)
        }
        widgetPanelCoordinator.onRandomiserListChange = { [weak self] change in
            self?.applyRandomiserListChange(change)
        }
        widgetPanelCoordinator.onCanvasRequested = { [weak self] _ in
            self?.setWindowMode(.canvas)
        }
        widgetPanelCoordinator.onWidgetCreationRequested = { [weak self] widgetType in
            self?.createCompactWidget(widgetType)
        }
        widgetPanelCoordinator.onWidgetRemovalRequested = { [weak self] widgetID in
            self?.removeCompactWidget(widgetID)
        }
        widgetPanelCoordinator.onDashboardHideRequested = { [weak self] in
            self?.setPresentationVisible(false, activateApp: false)
        }
        widgetPanelCoordinator.onAllPanelsHidden = { [weak self] in
            guard let self, self.dashboardVisible, self.windowMode == .compact else { return }
            self.setWindowMode(.canvas)
        }
        webView.configuration.userContentController.add(scriptMessageHandler, name: "classroomDashboard")
        loadDashboard()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    deinit {
        MainActor.assumeIsolated {
            NotificationCenter.default.removeObserver(self)
            webView.configuration.userContentController.removeScriptMessageHandler(forName: "classroomDashboard")
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        setWebDashboardVisible(dashboardVisible)
        setWebWindowMode(windowMode)
        setWebBackgroundOpacity(compactBackgroundOpacity)
        setWebWindowChromeVisible(compactChromeVisible || windowMode == .canvas)

        if pendingWidgetLauncherOpen && !widgetLauncherOpenAttemptInFlight {
            openWidgetLauncher()
        }
    }

    // The dashboard must never navigate away from the bundled app. Allow only
    // our custom scheme; hand links from a widget to the user's browser.
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        if url.scheme == dashboardURLScheme || url.scheme == "about" {
            decisionHandler(.allow)
            return
        }

        decisionHandler(.cancel)
        if navigationAction.navigationType == .linkActivated {
            NSWorkspace.shared.open(url)
        }
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url, url.scheme != dashboardURLScheme {
            NSWorkspace.shared.open(url)
        }
        return nil
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        DashboardLog.web.error("Web content process terminated; reloading dashboard")
        guard windowMode == .compact, !isChangingWindowMode else {
            resetHostWriteTracking()
            loadDashboard()
            return
        }
        isChangingWindowMode = true
        widgetPanelCoordinator.prepareToEnterCanvas { [weak self] pendingChanges, _ in
            guard let self else { return }
            // Any outstanding host call targeted the terminated web process;
            // invalidate its callbacks before loading the replacement host.
            self.resetHostWriteTracking()
            self.pendingDashboardRecoveryChanges = pendingChanges
            self.widgetPanelCoordinator.enterCanvas()
            self.loadDashboard()
        }
    }

    func windowDidMove(_ notification: Notification) {
        guard !isChangingWindowMode else { return }
        persistFrame(for: windowMode)
    }

    func windowDidResize(_ notification: Notification) {
        layoutCompactDragRegion()
        guard !isChangingWindowMode else { return }
        persistFrame(for: windowMode)
    }

    func windowDidBecomeKey(_ notification: Notification) {
        layoutCompactDragRegion()
        revealCompactChrome()
        scheduleCompactChromeHide()
    }

    func windowDidResignKey(_ notification: Notification) {
        guard windowMode == .compact else { return }
        setCompactChromeVisible(false)
    }

    // A utility app must stay recoverable from its menu-bar and global
    // shortcuts. Closing its one web window therefore hides it, just like
    // closing many Apple utility panels, without destroying its lesson state.
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        if dashboardVisible {
            toggleDashboard()
        }
        return false
    }

    func showDashboard() {
        showCurrentPresentation()
    }

    func toggleDashboard() {
        if dashboardVisible {
            setPresentationVisible(false, activateApp: false)
        } else {
            showDashboard()
        }
    }

    func showWidgetLauncher() {
        pendingWidgetLauncherOpen = true
        DashboardLog.windowing.info("Opening widget launcher")
        setWindowMode(.canvas)
        showDashboard()

        if !webView.isLoading {
            openWidgetLauncher()
        }
    }

    func addCompactWidget(_ widgetType: Int) {
        compactWidgetCreationPending = true
        if windowMode != .compact {
            setWindowMode(.compact)
        }
        showCurrentPresentation()
        createCompactWidget(widgetType)
    }

    func reloadDashboard() {
        DashboardLog.web.info("Reloading bundled dashboard")
        pendingWidgetLauncherOpen = false
        widgetLauncherOpenAttemptInFlight = false
        guard !isChangingWindowMode else { return }
        guard windowMode == .compact else {
            loadDashboard()
            return
        }
        isChangingWindowMode = true
        widgetPanelCoordinator.prepareToEnterCanvas { [weak self] pendingChanges, prepared in
            guard let self else { return }
            guard prepared else {
                self.abortCompactTransition()
                return
            }
            self.finishDashboardReload(pendingChanges)
        }
    }

    func prepareForTermination() async -> Bool {
        guard !isChangingWindowMode else { return false }
        guard windowMode == .compact else { return true }

        isChangingWindowMode = true
        guard let preparation: ([WidgetPanelStateChange], Bool) = await resultWithTimeout(
            nanoseconds: 2_000_000_000,
            operation: { completion in
                widgetPanelCoordinator.prepareToEnterCanvas { changes, prepared in
                    completion((changes, prepared))
                }
            }
        ), preparation.1 else {
            abortCompactTransition()
            return false
        }
        let pendingChanges = preparation.0
        for retriesRemaining in stride(from: 20, through: 0, by: -1) {
            if await resultWithTimeout(operation: { completion in
                applyFinalPanelStateChanges(pendingChanges, completion: completion)
            }) == true {
                widgetPanelCoordinator.enterCanvas()
                return true
            }
            if retriesRemaining > 0 {
                try? await Task.sleep(nanoseconds: 150_000_000)
            }
        }

        abortCompactTransition()
        return false
    }

    private func resultWithTimeout<Value>(
        nanoseconds: UInt64 = 1_000_000_000,
        operation: (@escaping @MainActor (Value) -> Void) -> Void
    ) async -> Value? {
        await withCheckedContinuation { continuation in
            var completed = false
            let complete: @MainActor (Value?) -> Void = { value in
                guard !completed else { return }
                completed = true
                continuation.resume(returning: value)
            }
            operation { complete($0) }
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: nanoseconds)
                complete(nil)
            }
        }
    }

    func applySettings() {
        // Legacy overlay settings deliberately no longer influence input
        // routing.  A bounded window naturally leaves every other app alone.
        configureWindow(for: windowMode)
        setWebBackgroundOpacity(compactBackgroundOpacity)
        widgetPanelCoordinator.applyPresentationSettings(
            backgroundOpacity: compactBackgroundOpacity,
            keepOnAllSpaces: UserDefaults.standard.bool(forKey: DashboardSettingKeys.keepOnAllSpaces)
        )
        syncWindowVisibility()
    }

    private func showCurrentPresentation() {
        setPresentationVisible(true, activateApp: true)
    }

    private func setPresentationVisible(_ visible: Bool, activateApp: Bool) {
        dashboardVisible = visible
        DashboardLog.windowing.info(
            "Dashboard visibility changed to \(visible, privacy: .public) in \(self.windowMode.rawValue, privacy: .public) mode"
        )
        setWebDashboardVisible(visible)
        syncWindowVisibility(activateApp: activateApp)
        onVisibilityChanged?(visible)
    }

    private func setWindowMode(_ mode: DashboardWindowMode) {
        guard mode != windowMode else {
            setWebWindowMode(mode)
            return
        }

        guard window != nil, !isChangingWindowMode else { return }
        if windowMode == .compact, mode == .canvas {
            isChangingWindowMode = true
            widgetPanelCoordinator.prepareToEnterCanvas { [weak self] pendingChanges, prepared in
                guard let self else { return }
                guard prepared else {
                    self.abortCompactTransition()
                    return
                }
                self.finishCanvasTransition(pendingChanges)
            }
            return
        }

        isChangingWindowMode = true
        completeWindowModeChange(mode)
    }

    private func completeWindowModeChange(_ mode: DashboardWindowMode) {
        persistFrame(for: windowMode)
        windowMode = mode
        configureWindow(for: mode)
        restoreFrame(for: mode)
        isChangingWindowMode = false
        setWebWindowMode(mode)
        setWebBackgroundOpacity(compactBackgroundOpacity)
        if mode == .compact {
            awaitingCompactInventory = true
            requiredCompactInventoryRevision = lastInventoryRevision + 1
            widgetPanelCoordinator.prepareForCompactInventory()
        } else {
            widgetPanelCoordinator.enterCanvas()
        }

        if dashboardVisible {
            syncWindowVisibility(activateApp: true)
        }
    }

    private func finishCanvasTransition(
        _ pendingChanges: [WidgetPanelStateChange],
        retriesRemaining: Int = 20
    ) {
        applyFinalPanelStateChanges(pendingChanges) { [weak self] applied in
            guard let self else { return }
            guard applied else {
                guard retriesRemaining > 0 else {
                    self.abortCompactTransition()
                    return
                }
                self.retryCanvasTransition(pendingChanges, retriesRemaining: retriesRemaining - 1)
                return
            }
            self.setWebWindowMode(.canvas) { [weak self] activated in
                guard let self else { return }
                guard activated else {
                    guard retriesRemaining > 0 else {
                        self.abortCompactTransition()
                        return
                    }
                    self.retryCanvasTransition(pendingChanges, retriesRemaining: retriesRemaining - 1)
                    return
                }
                self.persistFrame(for: self.windowMode)
                self.windowMode = .canvas
                self.configureWindow(for: .canvas)
                self.restoreFrame(for: .canvas)
                self.isChangingWindowMode = false
                self.setWebBackgroundOpacity(self.compactBackgroundOpacity)
                self.widgetPanelCoordinator.enterCanvas()
                if self.dashboardVisible {
                    self.syncWindowVisibility(activateApp: true)
                }
            }
        }
    }

    private func retryCanvasTransition(
        _ pendingChanges: [WidgetPanelStateChange],
        retriesRemaining: Int
    ) {
        Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 150_000_000)
            guard let self, self.isChangingWindowMode, self.windowMode == .compact else { return }
            self.finishCanvasTransition(pendingChanges, retriesRemaining: retriesRemaining)
        }
    }

    private func finishDashboardReload(
        _ pendingChanges: [WidgetPanelStateChange],
        retriesRemaining: Int = 20
    ) {
        applyFinalPanelStateChanges(pendingChanges) { [weak self] applied in
            guard let self else { return }
            guard applied else {
                guard retriesRemaining > 0 else {
                    self.abortCompactTransition()
                    return
                }
                Task { @MainActor [weak self] in
                    try? await Task.sleep(nanoseconds: 150_000_000)
                    guard let self, self.isChangingWindowMode, self.windowMode == .compact else { return }
                    self.finishDashboardReload(pendingChanges, retriesRemaining: retriesRemaining - 1)
                }
                return
            }
            self.widgetPanelCoordinator.enterCanvas()
            self.isChangingWindowMode = false
            self.loadDashboard()
        }
    }

    private func abortCompactTransition() {
        // Preparing a handoff marks each panel bridge as closing, so recreate
        // the compact surfaces rather than re-showing those inert web views.
        widgetPanelCoordinator.enterCanvas()
        isChangingWindowMode = false
        resetHostWriteTracking()
        let hasCompactPanels = widgetPanelCoordinator.enterCompact()
        guard dashboardVisible else {
            widgetPanelCoordinator.hideAll()
            if let window {
                scheduleOrderOut(window)
            }
            return
        }
        if hasCompactPanels {
            window?.orderOut(nil)
        } else {
            // Do not route an empty inventory back through the normal
            // compact-to-Canvas fallback and restart the exhausted loop.
            window?.makeKeyAndOrderFront(nil)
        }
    }

    private func resetHostWriteTracking() {
        let waiters = pendingHostWriteWaiters
        pendingHostWriteWaiters.removeAll()
        hostWriteGeneration += 1
        pendingHostWriteCount = 0
        pendingHostWriteFailed = false
        waiters.forEach { $0(false) }
    }

    private func finishDashboardRecovery(
        _ pendingChanges: [WidgetPanelStateChange],
        retriesRemaining: Int = 20
    ) {
        applyFinalPanelStateChanges(pendingChanges) { [weak self] applied in
            guard let self else { return }
            guard applied || retriesRemaining == 0 else {
                Task { @MainActor [weak self] in
                    try? await Task.sleep(nanoseconds: 150_000_000)
                    guard let self, self.isChangingWindowMode, self.windowMode == .compact else { return }
                    self.finishDashboardRecovery(pendingChanges, retriesRemaining: retriesRemaining - 1)
                }
                return
            }
            self.isChangingWindowMode = false
            self.syncWindowVisibility()
        }
    }

    private func applyFinalPanelStateChanges(
        _ changes: [WidgetPanelStateChange],
        completion: @escaping @MainActor (Bool) -> Void
    ) {
        guard !changes.isEmpty else {
            awaitPendingHostWrites(completion: completion)
            return
        }
        var remaining = changes.count
        var allApplied = true
        for change in changes {
            applyPanelStateChange(change) { applied in
                allApplied = allApplied && applied
                remaining -= 1
                if remaining == 0 {
                    self.awaitPendingHostWrites { writesApplied in
                        completion(allApplied && writesApplied)
                    }
                }
            }
        }
    }

    private func awaitPendingHostWrites(completion: @escaping @MainActor (Bool) -> Void) {
        guard pendingHostWriteCount > 0 else {
            completion(!pendingHostWriteFailed)
            return
        }
        pendingHostWriteWaiters.append(completion)
    }

    private func finishHostWrite(succeeded: Bool, generation: Int) {
        guard generation == hostWriteGeneration else { return }
        pendingHostWriteCount = max(0, pendingHostWriteCount - 1)
        pendingHostWriteFailed = pendingHostWriteFailed || !succeeded
        guard pendingHostWriteCount == 0, !pendingHostWriteWaiters.isEmpty else { return }
        let waiters = pendingHostWriteWaiters
        pendingHostWriteWaiters.removeAll()
        let allSucceeded = !pendingHostWriteFailed
        waiters.forEach { $0(allSucceeded) }
    }

    private func configureWindow(for mode: DashboardWindowMode) {
        guard let window else { return }

        // Changing a style mask does not replace the content view, so the one
        // WKWebView (and its React/Zustand state) survives each transition.
        window.styleMask = Self.styleMask(for: mode)
        window.contentMinSize = Self.minimumContentSize(for: mode)
        window.titleVisibility = mode == .compact ? .hidden : .visible
        window.titlebarAppearsTransparent = mode == .compact
        window.level = mode == .compact ? .floating : .normal

        applyBackgroundAppearance(for: mode)

        var behavior: NSWindow.CollectionBehavior = [.managed]
        if mode == .canvas {
            behavior.insert(.fullScreenPrimary)
        } else if UserDefaults.standard.bool(forKey: DashboardSettingKeys.keepOnAllSpaces) {
            behavior.insert(.canJoinAllSpaces)
        }
        window.collectionBehavior = behavior
        compactNavigationBar.isHidden = mode != .compact
        compactDragRegion.isHidden = mode != .compact
        compactChromeTrackingView.isHidden = mode != .compact
        compactChromeTrackingView.resetPointerState()
        layoutCompactDragRegion()

        if mode == .compact {
            compactChromeVisible = false
            revealCompactChrome()
            scheduleCompactChromeHide()
        } else {
            chromeHideGeneration += 1
            setCompactChromeVisible(true)
        }

        DispatchQueue.main.async { [weak self] in
            self?.layoutCompactDragRegion()
        }
    }

    private func applyBackgroundAppearance(for mode: DashboardWindowMode) {
        guard let window else { return }

        let allowsPerPixelTransparency = mode == .compact
        window.isOpaque = !allowsPerPixelTransparency
        window.backgroundColor = allowsPerPixelTransparency ? .clear : .windowBackgroundColor
        webView.setValue(!allowsPerPixelTransparency, forKey: "drawsBackground")
        // Opacity belongs to the web background only. Keeping the NSWindow at
        // full alpha prevents widgets and traffic lights fading with the tray.
        window.alphaValue = 1
        // Even a very light compact tray remains a bounded interactive window.
        window.ignoresMouseEvents = false
    }

    private func syncWindowVisibility(activateApp: Bool = false) {
        guard let window else { return }

        guard dashboardVisible else {
            let panelWasKey = widgetPanelCoordinator.hideAll()
            if window.isKeyWindow || panelWasKey {
                NSApp.deactivate()
            }
            scheduleOrderOut(window)
            return
        }

        guard !isChangingWindowMode else { return }

        hideGeneration += 1
        if windowMode == .compact {
            if awaitingCompactInventory {
                window.makeKeyAndOrderFront(nil)
                return
            }
            if widgetPanelCoordinator.enterCompact() {
                window.orderOut(nil)
            } else if !hasReceivedWidgetInventory || compactWidgetCreationPending {
                window.makeKeyAndOrderFront(nil)
            } else {
                setWindowMode(.canvas)
            }
        } else {
            widgetPanelCoordinator.enterCanvas()
            window.makeKeyAndOrderFront(nil)
        }
        if activateApp {
            NSApp.activate(ignoringOtherApps: true)
        }
    }

    private func reconcileWidgetPanels(_ inventory: WidgetPanelInventoryPayload) {
        hasReceivedWidgetInventory = true
        let descriptors = inventory.widgets.compactMap(Self.widgetPanelDescriptor(from:))
        let accepted = widgetPanelCoordinator.reconcile(snapshot: WidgetPanelSnapshot(
            hostInstanceID: inventory.hostInstanceID,
            revision: inventory.revision,
            widgets: descriptors
        ))
        guard accepted else { return }
        let isCurrentHost = inventory.hostInstanceID == lastInventoryHostInstanceID
        lastInventoryHostInstanceID = inventory.hostInstanceID
        lastInventoryRevision = inventory.revision
        if awaitingCompactInventory {
            guard inventory.windowMode == .compact,
                  !isCurrentHost || inventory.revision >= requiredCompactInventoryRevision
            else { return }
            awaitingCompactInventory = false
            widgetPanelCoordinator.activateCompactInventory()
        }
        compactWidgetCreationPending = false
        if let pendingChanges = pendingDashboardRecoveryChanges {
            pendingDashboardRecoveryChanges = nil
            let widgetIDs = Set(descriptors.map(\.id))
            finishDashboardRecovery(pendingChanges.filter { widgetIDs.contains($0.widgetID) })
            return
        }
        if !isChangingWindowMode {
            syncWindowVisibility()
        }
    }

    private func setCompactWidgetOptions(_ options: [CompactWidgetOption]) {
        guard options != compactWidgetOptions else { return }
        compactWidgetOptions = options
        widgetPanelCoordinator.setWidgetCreationOptions(options)
        onCompactWidgetOptionsChanged?(options)
    }

    private static func widgetPanelDescriptor(from payload: [String: Any]) -> WidgetPanelDescriptor? {
        guard (payload["schemaVersion"] as? NSNumber)?.intValue == 1,
              let id = payload["widgetId"] as? String,
              !id.isEmpty,
              let title = payload["title"] as? String,
              let preferred = payload["preferredSize"] as? [String: Any],
              let preferredWidth = (preferred["width"] as? NSNumber)?.doubleValue,
              let preferredHeight = (preferred["height"] as? NSNumber)?.doubleValue,
              let minimum = payload["minimumSize"] as? [String: Any],
              let minimumWidth = (minimum["width"] as? NSNumber)?.doubleValue,
              let minimumHeight = (minimum["height"] as? NSNumber)?.doubleValue,
              let maximumValue = payload["maximumSize"],
              let isResizable = payload["isResizable"] as? Bool,
              let maintainsAspectRatio = payload["maintainsAspectRatio"] as? Bool
        else { return nil }

        let maximumContentSize: WidgetPanelDescriptor.Size?
        if maximumValue is NSNull {
            maximumContentSize = nil
        } else if let maximum = maximumValue as? [String: Any],
                  let maximumWidth = (maximum["width"] as? NSNumber)?.doubleValue,
                  let maximumHeight = (maximum["height"] as? NSNumber)?.doubleValue {
            maximumContentSize = .init(width: CGFloat(maximumWidth), height: CGFloat(maximumHeight))
        } else {
            return nil
        }

        let aspectRatio = maintainsAspectRatio && preferredHeight > 0
            ? CGFloat(preferredWidth / preferredHeight)
            : nil

        return WidgetPanelDescriptor(
            id: id,
            title: title,
            preferredContentSize: .init(width: CGFloat(preferredWidth), height: CGFloat(preferredHeight)),
            minimumContentSize: .init(width: CGFloat(minimumWidth), height: CGFloat(minimumHeight)),
            maximumContentSize: maximumContentSize,
            isResizable: isResizable,
            aspectRatio: aspectRatio,
            snapshotPayload: payload
        )
    }

    private func applyPanelStateChange(_ change: WidgetPanelStateChange, completion: (@MainActor (Bool) -> Void)? = nil) {
        webView.callAsyncJavaScript(
            """
            return (() => {
              const host = window.classroomPanelHost;
              if (!host?.applyStateChange) return false;
              return host.applyStateChange(change);
            })()
            """,
            arguments: ["change": change.payload],
            in: nil,
            in: .page
        ) { result in
            if case let .failure(error) = result {
                DashboardLog.web.error("Unable to apply widget panel state: \(error.localizedDescription, privacy: .public)")
            }
            guard case let .success(value) = result else {
                completion?(false)
                return
            }
            completion?(value as? Bool == true)
        }
    }

    private func applyRandomiserListChange(_ change: WidgetPanelRandomiserListChange) {
        let generation = hostWriteGeneration
        pendingHostWriteCount += 1
        var completed = false
        let finish: @MainActor (Bool) -> Void = { [weak self] succeeded in
            guard !completed else { return }
            completed = true
            self?.finishHostWrite(succeeded: succeeded, generation: generation)
        }
        webView.callAsyncJavaScript(
            """
            return (() => {
              const host = window.classroomPanelHost;
              if (!host?.applyRandomiserListChange) return false;
              return host.applyRandomiserListChange(change);
            })()
            """,
            arguments: ["change": change.payload],
            in: nil,
            in: .page
        ) { result in
            if case let .failure(error) = result {
                DashboardLog.web.error("Unable to apply randomiser list change: \(error.localizedDescription, privacy: .public)")
            }
            guard case let .success(value) = result else {
                finish(false)
                return
            }
            finish(value as? Bool == true)
        }
    }

    private func createCompactWidget(_ widgetType: Int) {
        compactWidgetCreationPending = true
        webView.callAsyncJavaScript(
            """
            return (() => {
              const host = window.classroomPanelHost;
              if (!host?.addWidget) return false;
              return host.addWidget(widgetType);
            })()
            """,
            arguments: ["widgetType": widgetType],
            in: nil,
            in: .page
        ) { [weak self] result in
            if case let .success(value) = result, value as? Bool != true {
                self?.compactWidgetCreationPending = false
                self?.syncWindowVisibility()
            }
            if case let .failure(error) = result {
                self?.compactWidgetCreationPending = false
                self?.syncWindowVisibility()
                DashboardLog.web.error("Unable to add compact widget: \(error.localizedDescription, privacy: .public)")
            }
        }
    }

    private func removeCompactWidget(_ widgetID: String) {
        webView.callAsyncJavaScript(
            """
            return (() => {
              const host = window.classroomPanelHost;
              if (!host?.removeWidget) return false;
              return host.removeWidget(widgetID);
            })()
            """,
            arguments: ["widgetID": widgetID],
            in: nil,
            in: .page
        ) { [weak self] result in
            if case let .success(value) = result, value as? Bool != true {
                self?.syncWindowVisibility()
            }
            if case let .failure(error) = result {
                self?.syncWindowVisibility()
                DashboardLog.web.error("Unable to remove compact widget: \(error.localizedDescription, privacy: .public)")
            }
        }
    }

    private func layoutCompactDragRegion() {
        guard let contentView = window?.contentView else { return }

        // The web view intentionally extends through compact mode's title bar.
        // Reserve the traffic lights on the left and the two compact icon
        // controls on the right. The rest of the native navigation bar is a
        // grab area.
        let height: CGFloat = 30
        let navigationBarFrame = NSRect(
            x: 0,
            y: max(0, contentView.bounds.maxY - height),
            width: contentView.bounds.width,
            height: height
        )
        compactNavigationBar.frame = navigationBarFrame
        centreTrafficLights(in: navigationBarFrame, contentView: contentView)

        let trafficLightsRightEdge = trafficLights
            .map { $0.convert($0.bounds, to: contentView).maxX }
            .max() ?? 70
        let leftInset = trafficLightsRightEdge + 12
        let rightInset: CGFloat = 64
        compactDragRegion.frame = NSRect(
            x: leftInset,
            y: navigationBarFrame.minY,
            width: max(0, contentView.bounds.width - leftInset - rightInset),
            height: height
        )
        compactChromeTrackingView.frame = NSRect(
            x: 0,
            y: max(0, contentView.bounds.maxY - 52),
            width: contentView.bounds.width,
            height: 52
        )
    }

    private func centreTrafficLights(in navigationBarFrame: NSRect, contentView: NSView) {
        guard windowMode == .compact else { return }
        let targetCentreY = navigationBarFrame.midY

        for button in trafficLights {
            guard let buttonSuperview = button.superview else { continue }
            let targetInSuperview = buttonSuperview.convert(
                NSPoint(x: button.frame.midX, y: targetCentreY),
                from: contentView
            )
            button.setFrameOrigin(NSPoint(
                x: button.frame.origin.x,
                y: targetInSuperview.y - button.frame.height / 2
            ))
        }
    }

    private var trafficLights: [NSButton] {
        guard let window else { return [] }
        return [NSWindow.ButtonType.closeButton, .miniaturizeButton, .zoomButton]
            .compactMap { window.standardWindowButton($0) }
    }

    private func revealCompactChrome() {
        guard windowMode == .compact else { return }
        chromeHideGeneration += 1
        setCompactChromeVisible(true)
    }

    private func scheduleCompactChromeHide() {
        guard windowMode == .compact else { return }
        chromeHideGeneration += 1
        compactChromeTrackingView.updatePointerStateFromCurrentLocation()
        guard !compactChromeTrackingView.isPointerInside else { return }
        let generation = chromeHideGeneration
        Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 1_800_000_000)
            guard let self,
                  self.chromeHideGeneration == generation,
                  self.windowMode == .compact,
                  !self.compactChromeTrackingView.isPointerInside
            else { return }
            self.setCompactChromeVisible(false)
        }
    }

    private func setCompactChromeVisible(_ visible: Bool) {
        if windowMode == .canvas {
            compactChromeVisible = true
            compactNavigationBar.isHidden = true
            compactDragRegion.isHidden = true
            setTrafficLightsVisible(true)
            setWebWindowChromeVisible(true)
            return
        }

        let effectiveVisibility = visible || NSWorkspace.shared.isVoiceOverEnabled
        guard compactChromeVisible != effectiveVisibility else { return }
        compactChromeVisible = effectiveVisibility
        setCompactNavigationBarVisible(effectiveVisibility)
        setTrafficLightsVisible(effectiveVisibility)
        setWebWindowChromeVisible(effectiveVisibility)
    }

    private func setCompactNavigationBarVisible(_ visible: Bool) {
        compactNavigationBar.isHidden = false
        compactDragRegion.isHidden = false

        let reduceMotion = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
        if reduceMotion {
            compactNavigationBar.alphaValue = visible ? 1 : 0
        } else {
            NSAnimationContext.runAnimationGroup { context in
                context.duration = 0.16
                compactNavigationBar.animator().alphaValue = visible ? 1 : 0
            }
        }

        guard !visible else { return }
        let generation = chromeHideGeneration
        Task { @MainActor [weak self] in
            if !reduceMotion {
                try? await Task.sleep(nanoseconds: 170_000_000)
            }
            guard let self,
                  self.chromeHideGeneration == generation,
                  !self.compactChromeVisible,
                  self.windowMode == .compact
            else { return }
            self.compactNavigationBar.isHidden = true
            self.compactDragRegion.isHidden = true
        }
    }

    private func setTrafficLightsVisible(_ visible: Bool) {
        let buttons = trafficLights
        let reduceMotion = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion

        for button in buttons {
            button.isHidden = false
            if reduceMotion {
                button.alphaValue = visible ? 1 : 0
            } else {
                NSAnimationContext.runAnimationGroup { context in
                    context.duration = 0.16
                    button.animator().alphaValue = visible ? 1 : 0
                }
            }
        }

        guard !visible else { return }
        let generation = chromeHideGeneration
        Task { @MainActor [weak self] in
            if !reduceMotion {
                try? await Task.sleep(nanoseconds: 170_000_000)
            }
            guard let self,
                  self.chromeHideGeneration == generation,
                  !self.compactChromeVisible,
                  self.windowMode == .compact
            else { return }
            self.trafficLights.forEach { $0.isHidden = true }
        }
    }

    private func setWebWindowChromeVisible(_ visible: Bool) {
        chromeVisibilityPushGeneration += 1
        pushWebWindowChromeVisible(visible, generation: chromeVisibilityPushGeneration, retriesRemaining: 3)
    }

    private func pushWebWindowChromeVisible(_ visible: Bool, generation: Int, retriesRemaining: Int) {
        guard generation == chromeVisibilityPushGeneration else { return }
        let expression = """
        (() => {
          if (window.classroomDashboard?.setWindowChromeVisible) {
            window.classroomDashboard.setWindowChromeVisible(\(visible ? "true" : "false"));
            return true;
          }
          return false;
        })()
        """
        webView.evaluateJavaScript(expression) { [weak self] result, _ in
            guard let self else { return }
            guard self.chromeVisibilityPushGeneration == generation,
                  result as? Bool != true,
                  retriesRemaining > 0
            else { return }
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 150_000_000)
                self.pushWebWindowChromeVisible(
                    visible,
                    generation: generation,
                    retriesRemaining: retriesRemaining - 1
                )
            }
        }
    }

    private func scheduleOrderOut(_ window: NSWindow) {
        guard window.isVisible else {
            window.orderOut(nil)
            return
        }

        hideGeneration += 1
        let generation = hideGeneration
        Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 200_000_000)
            guard let self, self.hideGeneration == generation, !self.dashboardVisible else { return }
            self.window?.orderOut(nil)
        }
    }

    private func loadDashboard() {
        var components = URLComponents()
        components.scheme = dashboardURLScheme
        components.host = "app"
        components.path = "/"
        components.queryItems = [
            URLQueryItem(name: "dashboard", value: "1"),
            URLQueryItem(name: "visible", value: dashboardVisible ? "1" : "0"),
            URLQueryItem(name: "mode", value: windowMode.rawValue),
            URLQueryItem(name: "backgroundOpacity", value: String(compactBackgroundOpacity))
        ]

        guard let url = components.url else { return }
        webView.load(URLRequest(url: url))
    }

    private func setWebDashboardVisible(_ visible: Bool) {
        visibilityPushGeneration += 1
        pushWebDashboardVisible(visible, generation: visibilityPushGeneration, retriesRemaining: 3)
    }

    private func pushWebDashboardVisible(_ visible: Bool, generation: Int, retriesRemaining: Int) {
        guard generation == visibilityPushGeneration else { return }

        let expression = """
        (() => {
          if (window.classroomDashboard?.setVisible) {
            window.classroomDashboard.setVisible(\(visible ? "true" : "false"));
            return true;
          }
          return false;
        })()
        """
        webView.evaluateJavaScript(expression) { [weak self] result, _ in
            guard let self else { return }
            guard self.visibilityPushGeneration == generation, result as? Bool != true, retriesRemaining > 0 else { return }
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 150_000_000)
                self.pushWebDashboardVisible(visible, generation: generation, retriesRemaining: retriesRemaining - 1)
            }
        }
    }

    private func setWebWindowMode(_ mode: DashboardWindowMode, completion: (@MainActor (Bool) -> Void)? = nil) {
        modePushGeneration += 1
        pushWebWindowMode(mode, generation: modePushGeneration, retriesRemaining: 3, completion: completion)
    }

    private func pushWebWindowMode(
        _ mode: DashboardWindowMode,
        generation: Int,
        retriesRemaining: Int,
        completion: (@MainActor (Bool) -> Void)? = nil
    ) {
        guard generation == modePushGeneration else {
            completion?(false)
            return
        }
        let expression = """
        (() => {
          const dashboard = window.classroomDashboard;
          if (!dashboard?.setWindowMode || !dashboard?.getWindowMode) return false;
          dashboard.setWindowMode('\(mode.rawValue)');
          return dashboard.getWindowMode() === '\(mode.rawValue)';
        })()
        """
        webView.evaluateJavaScript(expression) { [weak self] result, _ in
            guard let self else { return }
            guard self.modePushGeneration == generation else {
                completion?(false)
                return
            }
            if result as? Bool == true {
                completion?(true)
                return
            }
            guard retriesRemaining > 0 else {
                completion?(false)
                return
            }
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 150_000_000)
                self.pushWebWindowMode(
                    mode,
                    generation: generation,
                    retriesRemaining: retriesRemaining - 1,
                    completion: completion
                )
            }
        }
    }

    private var compactBackgroundOpacity: Double {
        let storedValue = UserDefaults.standard.double(forKey: DashboardSettingKeys.compactBackgroundOpacity)
        return min(max(storedValue, 0), 1)
    }

    private func setWebBackgroundOpacity(_ opacity: Double) {
        backgroundOpacityPushGeneration += 1
        pushWebBackgroundOpacity(opacity, generation: backgroundOpacityPushGeneration, retriesRemaining: 3)
    }

    private func pushWebBackgroundOpacity(
        _ opacity: Double,
        generation: Int,
        retriesRemaining: Int
    ) {
        guard generation == backgroundOpacityPushGeneration else { return }
        let expression = """
        (() => {
          if (window.classroomDashboard?.setBackgroundOpacity) {
            window.classroomDashboard.setBackgroundOpacity(\(opacity));
            return true;
          }
          return false;
        })()
        """
        webView.evaluateJavaScript(expression) { [weak self] result, _ in
            guard let self else { return }
            guard self.backgroundOpacityPushGeneration == generation, result as? Bool != true, retriesRemaining > 0 else { return }
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 150_000_000)
                self.pushWebBackgroundOpacity(opacity, generation: generation, retriesRemaining: retriesRemaining - 1)
            }
        }
    }

    private func persistFrame(for mode: DashboardWindowMode) {
        guard let window, !window.styleMask.contains(.fullScreen) else { return }
        UserDefaults.standard.set(NSStringFromRect(window.frame), forKey: Self.frameDefaultsKey(for: mode))
    }

    private func restoreFrame(for mode: DashboardWindowMode) {
        guard let window else { return }
        let defaultFrame = Self.defaultFrame(for: mode)
        guard let encodedFrame = UserDefaults.standard.string(forKey: Self.frameDefaultsKey(for: mode)) else {
            window.setFrame(defaultFrame, display: true)
            return
        }

        let savedFrame = NSRectFromString(encodedFrame)
        guard Self.frameIsUsable(savedFrame, for: mode) else {
            window.setFrame(defaultFrame, display: true)
            return
        }
        window.setFrame(savedFrame, display: true)
    }

    private static func frameDefaultsKey(for mode: DashboardWindowMode) -> String {
        mode == .compact ? compactFrameDefaultsKey : canvasFrameDefaultsKey
    }

    private static func defaultFrame(for mode: DashboardWindowMode) -> NSRect {
        let visibleFrame = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let size: NSSize = mode == .compact ? NSSize(width: 760, height: 500) : NSSize(width: 1_180, height: 760)
        let constrainedSize = NSSize(width: min(size.width, visibleFrame.width), height: min(size.height, visibleFrame.height))
        return NSRect(
            x: visibleFrame.midX - constrainedSize.width / 2,
            y: visibleFrame.midY - constrainedSize.height / 2,
            width: constrainedSize.width,
            height: constrainedSize.height
        )
    }

    private static func minimumContentSize(for mode: DashboardWindowMode) -> NSSize {
        mode == .compact ? NSSize(width: 360, height: 120) : NSSize(width: 800, height: 500)
    }

    private static func styleMask(for mode: DashboardWindowMode) -> NSWindow.StyleMask {
        var style: NSWindow.StyleMask = [.titled, .closable, .miniaturizable, .resizable]
        if mode == .compact {
            style.insert(.fullSizeContentView)
        }
        return style
    }

    private static func frameIsUsable(_ frame: NSRect, for mode: DashboardWindowMode) -> Bool {
        let minimumSize = minimumContentSize(for: mode)
        guard !frame.isNull,
              !frame.isEmpty,
              frame.width >= minimumSize.width,
              frame.height >= minimumSize.height else { return false }
        return NSScreen.screens.contains { $0.visibleFrame.intersects(frame) }
    }

    private func openWidgetLauncher(retriesRemaining: Int = 5) {
        guard pendingWidgetLauncherOpen, !widgetLauncherOpenAttemptInFlight else { return }
        widgetLauncherOpenAttemptInFlight = true
        let expression = """
        (() => {
          if (window.openClassroomWidgetLauncher) {
            window.openClassroomWidgetLauncher();
            return true;
          }
          return false;
        })()
        """
        webView.evaluateJavaScript(expression) { [weak self] result, _ in
            guard let self else { return }
            self.widgetLauncherOpenAttemptInFlight = false
            if result as? Bool == true {
                self.pendingWidgetLauncherOpen = false
                return
            }
            guard retriesRemaining > 0 else {
                self.pendingWidgetLauncherOpen = false
                return
            }
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 150_000_000)
                self.openWidgetLauncher(retriesRemaining: retriesRemaining - 1)
            }
        }
    }
}

final class DashboardWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

private final class CompactDragRegionView: NSView {
    override func mouseDown(with event: NSEvent) {
        window?.performDrag(with: event)
    }

    override func resetCursorRects() {
        addCursorRect(bounds, cursor: .openHand)
    }
}

private final class CompactChromeTrackingView: NSView {
    var onPointerEntered: (() -> Void)?
    var onPointerExited: (() -> Void)?
    private(set) var isPointerInside = false
    private var trackingAreaReference: NSTrackingArea?

    override func updateTrackingAreas() {
        if let trackingAreaReference {
            removeTrackingArea(trackingAreaReference)
        }

        let trackingArea = NSTrackingArea(
            rect: .zero,
            options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
            owner: self,
            userInfo: nil
        )
        addTrackingArea(trackingArea)
        trackingAreaReference = trackingArea
        super.updateTrackingAreas()
    }

    override func mouseEntered(with event: NSEvent) {
        isPointerInside = true
        onPointerEntered?()
    }

    override func mouseExited(with event: NSEvent) {
        isPointerInside = false
        onPointerExited?()
    }

    func resetPointerState() {
        isPointerInside = false
    }

    func updatePointerStateFromCurrentLocation() {
        guard let window, !isHidden else {
            isPointerInside = false
            return
        }
        let locationInView = convert(window.mouseLocationOutsideOfEventStream, from: nil)
        isPointerInside = bounds.contains(locationInView)
    }

    override func hitTest(_ point: NSPoint) -> NSView? {
        nil
    }
}
