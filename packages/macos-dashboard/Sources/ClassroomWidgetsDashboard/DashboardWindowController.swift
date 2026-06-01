import AppKit
import WebKit

@MainActor
final class DashboardWindowController: NSWindowController, WKNavigationDelegate {
    private let webView: WKWebView
    private let scriptMessageHandler: DashboardScriptMessageHandler
    private var dashboardVisible: Bool
    private var interactiveRegions: [CGRect] = []
    private var localMouseMonitor: Any?
    private var globalMouseMonitor: Any?
    private var pendingWidgetLauncherOpen = false
    private var widgetLauncherOpenAttemptInFlight = false
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
        window.contentView = webView

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
            window.orderOut(nil)
            return
        }

        if !window.isVisible {
            window.makeKeyAndOrderFront(nil)
        }
        window.orderFrontRegardless()
        updateMousePassthrough()

        if activateApp {
            NSApp.activate(ignoringOtherApps: true)
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
