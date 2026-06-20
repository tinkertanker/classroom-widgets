import AppKit
import WebKit

@MainActor
final class DashboardWindowController: NSWindowController, WKNavigationDelegate, WKUIDelegate {
    private let webView: WKWebView
    private let scriptMessageHandler: DashboardScriptMessageHandler
    private let backdropContainer = NSView()
    private var glassBackdropViews: [NSVisualEffectView] = []
    private var glassRegions: [DashboardGlassRegion] = []
    private var dashboardVisible: Bool
    private var interactiveRegions: [CGRect] = []
    private var localMouseMonitor: Any?
    private var globalMouseMonitor: Any?
    private var pendingWidgetLauncherOpen = false
    private var widgetLauncherOpenAttemptInFlight = false
    private var hideGeneration = 0
    private var visibilityPushGeneration = 0
    var isDashboardVisible: Bool { dashboardVisible }
    var onVisibilityChanged: (@MainActor (Bool) -> Void)?

    init() {
        dashboardVisible = UserDefaults.standard.bool(forKey: DashboardSettingKeys.showDashboardAtLaunch)

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

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.setValue(false, forKey: "drawsBackground")

        let window = DashboardWindow(
            contentRect: Self.combinedVisibleFrame(),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        window.backgroundColor = .clear
        window.isOpaque = false
        window.hasShadow = false
        window.level = .floating
        window.ignoresMouseEvents = !dashboardVisible

        // The backdrop layer sits behind the (transparent) web view and hosts
        // NSVisualEffectViews aligned with the web layer's glass surfaces, so
        // widgets get a real desktop blur that CSS backdrop-filter cannot do.
        let contentView = NSView()
        window.contentView = contentView
        backdropContainer.frame = contentView.bounds
        backdropContainer.autoresizingMask = [.width, .height]
        // Layer-backed so alphaValue is a well-defined layer opacity animation
        // for the hosted NSVisualEffectViews.
        backdropContainer.wantsLayer = true
        backdropContainer.alphaValue = dashboardVisible ? 1 : 0
        backdropContainer.postsFrameChangedNotifications = true
        contentView.addSubview(backdropContainer)
        webView.frame = contentView.bounds
        webView.autoresizingMask = [.width, .height]
        contentView.addSubview(webView)

        super.init(window: window)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        applySettings()
        installMouseMonitors()

        // Backdrops are positioned from a snapshot of the container height at
        // message time, so re-place them whenever the window (and thus the
        // container) resizes, and re-fit the window when the display layout
        // changes underneath it.
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(backdropContainerFrameDidChange),
            name: NSView.frameDidChangeNotification,
            object: backdropContainer
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(screenParametersDidChange),
            name: NSApplication.didChangeScreenParametersNotification,
            object: nil
        )

        scriptMessageHandler.onVisibilityChanged = { [weak self] visible in
            guard let self else { return }
            self.dashboardVisible = visible
            self.syncWindowVisibility()
            self.onVisibilityChanged?(visible)
        }
        scriptMessageHandler.onInteractiveRegionsChanged = { [weak self] regions in
            guard let self else { return }
            self.interactiveRegions = regions
            self.updateMousePassthrough()
        }
        scriptMessageHandler.onGlassRegionsChanged = { [weak self] regions in
            guard let self else { return }
            self.glassRegions = regions
            self.updateGlassBackdrops()
        }
        webView.configuration.userContentController.add(scriptMessageHandler, name: "classroomDashboard")
        loadDashboard()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    deinit {
        MainActor.assumeIsolated {
            if let localMouseMonitor {
                NSEvent.removeMonitor(localMouseMonitor)
            }
            if let globalMouseMonitor {
                NSEvent.removeMonitor(globalMouseMonitor)
            }
            NotificationCenter.default.removeObserver(self)
            webView.configuration.userContentController.removeScriptMessageHandler(forName: "classroomDashboard")
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        setWebDashboardVisible(dashboardVisible)

        if pendingWidgetLauncherOpen && !widgetLauncherOpenAttemptInFlight {
            openWidgetLauncher()
        }
    }

    // The dashboard must never navigate away from the bundled app. Allow only
    // our custom scheme; hand any other URL (including student-submitted links
    // rendered inside widgets) to the user's browser. Without this a single
    // link click would replace the chromeless full-screen overlay with
    // arbitrary web content that still has access to the native bridge.
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        // Our bundle (custom scheme) plus about:blank, which WebKit may use
        // internally during setup. Everything else is foreign content.
        if url.scheme == dashboardURLScheme || url.scheme == "about" {
            decisionHandler(.allow)
            return
        }

        decisionHandler(.cancel)
        if navigationAction.navigationType == .linkActivated {
            NSWorkspace.shared.open(url)
        }
    }

    // target="_blank" / window.open links: open externally instead of spawning
    // a chromeless child web view.
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

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        // The old page's regions don't apply to whatever is loading; drop them
        // so stale blur slabs and click-through holes don't linger.
        clearWebDrivenState()
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        DashboardLog.web.error("Web content process terminated; reloading dashboard")
        clearWebDrivenState()
        loadDashboard()
    }

    private func clearWebDrivenState() {
        interactiveRegions = []
        glassRegions = []
        updateGlassBackdrops()
        updateMousePassthrough()
    }

    func showDashboard() {
        dashboardVisible = true
        DashboardLog.windowing.info("Showing dashboard")
        let frame = Self.combinedVisibleFrame()
        window?.setFrame(frame, display: true)
        applySettings()
        syncWindowVisibility(activateApp: true)
        NSApp.activate(ignoringOtherApps: true)
        setWebDashboardVisible(true)
    }

    func toggleDashboard() {
        dashboardVisible.toggle()
        DashboardLog.windowing.info("Dashboard visibility changed to \(self.dashboardVisible, privacy: .public)")
        setWebDashboardVisible(dashboardVisible)

        if dashboardVisible {
            window?.setFrame(Self.combinedVisibleFrame(), display: true)
        }

        syncWindowVisibility(activateApp: dashboardVisible)
        onVisibilityChanged?(dashboardVisible)
    }

    func showWidgetLauncher() {
        pendingWidgetLauncherOpen = true
        DashboardLog.windowing.info("Opening widget launcher")
        showDashboard()

        if !webView.isLoading {
            openWidgetLauncher()
        }
    }

    func reloadDashboard() {
        DashboardLog.web.info("Reloading bundled dashboard")
        pendingWidgetLauncherOpen = false
        widgetLauncherOpenAttemptInFlight = false
        clearWebDrivenState()
        // Rebuild the URL from current state rather than reloadFromOrigin(),
        // which would reload the stale launch-time ?visible= value (and, after
        // an external navigation slipped through, the wrong page entirely).
        loadDashboard()
    }

    func applySettings() {
        guard let window else { return }

        window.level = UserDefaults.standard.bool(forKey: DashboardSettingKeys.floatingOverlay) ? .floating : .normal

        var behavior: NSWindow.CollectionBehavior = [.stationary]
        if UserDefaults.standard.bool(forKey: DashboardSettingKeys.keepOnAllSpaces) {
            behavior.insert(.canJoinAllSpaces)
            behavior.insert(.fullScreenAuxiliary)
        }
        window.collectionBehavior = behavior

        syncWindowVisibility()
    }

    private func syncWindowVisibility(activateApp: Bool = false) {
        guard let window else { return }

        guard dashboardVisible else {
            window.ignoresMouseEvents = true
            setBackdropsVisible(false)
            // The window lingers ~350ms for the exit animation. While it does,
            // it must not keep eating keystrokes into the invisible web view
            // (e.g. Cmd+V would hit the app's global paste handler and silently
            // spawn a widget). Yield activation back to the app underneath —
            // guarded on the dashboard being the key window so changing a
            // setting from the Settings window doesn't deactivate the app.
            if window.isKeyWindow {
                NSApp.deactivate()
            }
            scheduleOrderOut(window)
            return
        }

        hideGeneration += 1
        setBackdropsVisible(true)
        if !window.isVisible {
            window.makeKeyAndOrderFront(nil)
        }
        window.orderFrontRegardless()
        updateMousePassthrough()

        if activateApp {
            NSApp.activate(ignoringOtherApps: true)
        }
    }

    // Keep the window on screen briefly while the web layer plays its exit
    // animation; mouse events are already disabled so the overlay is inert.
    private func scheduleOrderOut(_ window: NSWindow) {
        guard window.isVisible else {
            window.orderOut(nil)
            return
        }

        hideGeneration += 1
        let generation = hideGeneration

        Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 350_000_000)
            guard let self, self.hideGeneration == generation, !self.dashboardVisible else { return }
            self.window?.orderOut(nil)
        }
    }

    private func installMouseMonitors() {
        localMouseMonitor = NSEvent.addLocalMonitorForEvents(matching: [
            .mouseMoved,
            .leftMouseDragged,
            .rightMouseDragged,
            .otherMouseDragged,
            .leftMouseDown,
            .rightMouseDown,
            .otherMouseDown
        ]) { [weak self] event in
            self?.updateMousePassthrough()
            return event
        }

        globalMouseMonitor = NSEvent.addGlobalMonitorForEvents(matching: [
            .mouseMoved,
            .leftMouseDragged,
            .rightMouseDragged,
            .otherMouseDragged,
            .leftMouseDown,
            .rightMouseDown,
            .otherMouseDown
        ]) { [weak self] _ in
            self?.updateMousePassthrough()
        }
    }

    private func updateMousePassthrough() {
        guard let window else { return }

        guard dashboardVisible else {
            window.ignoresMouseEvents = true
            return
        }

        guard UserDefaults.standard.bool(forKey: DashboardSettingKeys.clickThroughEmptyAreas) else {
            window.ignoresMouseEvents = false
            return
        }

        let screenPoint = NSEvent.mouseLocation
        guard window.frame.contains(screenPoint) else {
            window.ignoresMouseEvents = true
            return
        }

        let pointInWindow = window.convertPoint(fromScreen: screenPoint)
        let webPoint = CGPoint(x: pointInWindow.x, y: webView.bounds.height - pointInWindow.y)
        window.ignoresMouseEvents = !interactiveRegions.contains { $0.contains(webPoint) }
    }

    private func updateGlassBackdrops() {
        while glassBackdropViews.count < glassRegions.count {
            let view = NSVisualEffectView()
            view.blendingMode = .behindWindow
            view.material = .popover
            view.state = .active
            backdropContainer.addSubview(view)
            glassBackdropViews.append(view)
        }

        while glassBackdropViews.count > glassRegions.count {
            glassBackdropViews.removeLast().removeFromSuperview()
        }

        // Web rects are top-left origin; AppKit views are bottom-left.
        let containerHeight = backdropContainer.bounds.height
        for (view, region) in zip(glassBackdropViews, glassRegions) {
            view.frame = CGRect(
                x: region.rect.minX,
                y: containerHeight - region.rect.minY - region.rect.height,
                width: region.rect.width,
                height: region.rect.height
            )
            // maskImage (not layer.cornerRadius) is what clips the
            // behind-window blur region, per NSVisualEffectView docs. Clamp the
            // radius so a small region can't produce a distorted mask.
            let clampedRadius = min(region.radius, region.rect.width / 2, region.rect.height / 2).rounded()
            view.maskImage = maskImage(cornerRadius: clampedRadius)
        }
    }

    private var maskImageCache: [CGFloat: NSImage] = [:]

    private func maskImage(cornerRadius radius: CGFloat) -> NSImage? {
        guard radius > 0 else { return nil }

        if let cached = maskImageCache[radius] {
            return cached
        }

        let edge = radius * 2 + 1
        let image = NSImage(size: NSSize(width: edge, height: edge), flipped: false) { rect in
            NSColor.black.setFill()
            NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill()
            return true
        }
        image.capInsets = NSEdgeInsets(top: radius, left: radius, bottom: radius, right: radius)
        image.resizingMode = .stretch
        maskImageCache[radius] = image
        return image
    }

    // Fading the backdrops (slow in, fast out) hides that they sit at the
    // widgets' final positions while the web layer plays its entrance and
    // exit animations.
    private func setBackdropsVisible(_ visible: Bool) {
        let target: CGFloat = visible ? 1 : 0
        guard backdropContainer.alphaValue != target else { return }

        if NSWorkspace.shared.accessibilityDisplayShouldReduceMotion {
            backdropContainer.alphaValue = target
            return
        }

        NSAnimationContext.runAnimationGroup { context in
            context.duration = visible ? 0.45 : 0.18
            context.timingFunction = CAMediaTimingFunction(name: .easeOut)
            backdropContainer.animator().alphaValue = target
        }
    }

    private func loadDashboard() {
        var components = URLComponents()
        components.scheme = dashboardURLScheme
        components.host = "app"
        components.path = "/"
        components.queryItems = [
            URLQueryItem(name: "dashboard", value: "1"),
            URLQueryItem(name: "visible", value: dashboardVisible ? "1" : "0")
        ]

        guard let url = components.url else { return }
        webView.load(URLRequest(url: url))
    }

    private func setWebDashboardVisible(_ visible: Bool) {
        // Each push starts a new generation; any in-flight retry chain from an
        // earlier (now superseded) push is abandoned. Without this, two rapid
        // toggles during page load race independent retry timers and a stale
        // value can land last, leaving the web layer disagreeing with native.
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
            guard
                self.visibilityPushGeneration == generation,
                result as? Bool != true,
                retriesRemaining > 0
            else { return }

            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 150_000_000)
                self.pushWebDashboardVisible(visible, generation: generation, retriesRemaining: retriesRemaining - 1)
            }
        }
    }

    @objc private func backdropContainerFrameDidChange() {
        updateGlassBackdrops()
    }

    @objc private func screenParametersDidChange() {
        guard dashboardVisible, let window else { return }
        window.setFrame(Self.combinedVisibleFrame(), display: true)
        updateGlassBackdrops()
    }

    private func openWidgetLauncher(retriesRemaining: Int = 5) {
        guard pendingWidgetLauncherOpen, !widgetLauncherOpenAttemptInFlight else {
            return
        }

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

    private static func combinedVisibleFrame() -> NSRect {
        let union = NSScreen.screens.reduce(NSRect.null) { partial, screen in
            partial.union(screen.visibleFrame)
        }

        // NSScreen.screens can be transiently empty during display
        // reconfiguration; feeding NSRect.null (origin +inf) to a window frame
        // is undefined, so fall back to the main screen.
        guard !union.isNull, !union.isEmpty else {
            return NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        }

        return union
    }
}

final class DashboardWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}
