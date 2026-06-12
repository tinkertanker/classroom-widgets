import AppKit
import WebKit

@MainActor
final class DashboardWindowController: NSWindowController, WKNavigationDelegate {
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
        backdropContainer.alphaValue = dashboardVisible ? 1 : 0
        contentView.addSubview(backdropContainer)
        webView.frame = contentView.bounds
        webView.autoresizingMask = [.width, .height]
        contentView.addSubview(webView)

        super.init(window: window)
        webView.navigationDelegate = self
        applySettings()
        installMouseMonitors()

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
            webView.configuration.userContentController.removeScriptMessageHandler(forName: "classroomDashboard")
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        setWebDashboardVisible(dashboardVisible)

        if pendingWidgetLauncherOpen && !widgetLauncherOpenAttemptInFlight {
            openWidgetLauncher()
        }
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
        webView.reloadFromOrigin()
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
            // behind-window blur region, per NSVisualEffectView docs.
            view.maskImage = maskImage(cornerRadius: region.radius)
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

    private func setWebDashboardVisible(_ visible: Bool, retriesRemaining: Int = 3) {
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
            guard
                result as? Bool != true,
                retriesRemaining > 0
            else { return }

            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 150_000_000)
                self?.setWebDashboardVisible(visible, retriesRemaining: retriesRemaining - 1)
            }
        }
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
        NSScreen.screens.reduce(NSRect.null) { partial, screen in
            partial.union(screen.visibleFrame)
        }
    }
}

final class DashboardWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}
