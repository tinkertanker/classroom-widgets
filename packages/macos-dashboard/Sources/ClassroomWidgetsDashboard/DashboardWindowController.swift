import AppKit
import WebKit

final class DashboardWindowController: NSWindowController {
    private let webView: WKWebView
    private let scriptMessageHandler: DashboardScriptMessageHandler
    private var dashboardVisible: Bool
    private var interactiveRegions: [CGRect] = []
    private var localMouseMonitor: Any?
    private var globalMouseMonitor: Any?
    var isDashboardVisible: Bool { dashboardVisible }

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
        applySettings()
        installMouseMonitors()

        scriptMessageHandler.onVisibilityChanged = { [weak self] visible in
            guard let self else { return }
            self.dashboardVisible = visible
            self.updateMousePassthrough()
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
        if let localMouseMonitor {
            NSEvent.removeMonitor(localMouseMonitor)
        }
        if let globalMouseMonitor {
            NSEvent.removeMonitor(globalMouseMonitor)
        }
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "classroomDashboard")
    }

    func showDashboard() {
        dashboardVisible = true
        let frame = Self.combinedVisibleFrame()
        window?.setFrame(frame, display: true)
        applySettings()
        window?.makeKeyAndOrderFront(nil)
        window?.orderFrontRegardless()
        updateMousePassthrough()
        NSApp.activate(ignoringOtherApps: true)
        setWebDashboardVisible(true)
    }

    func toggleDashboard() {
        dashboardVisible.toggle()
        setWebDashboardVisible(dashboardVisible)

        if dashboardVisible {
            window?.setFrame(Self.combinedVisibleFrame(), display: true)
            window?.makeKeyAndOrderFront(nil)
            window?.orderFrontRegardless()
            updateMousePassthrough()
            NSApp.activate(ignoringOtherApps: true)
        } else {
            window?.ignoresMouseEvents = true
        }
    }

    func showWidgetLauncher() {
        showDashboard()
        let expression = """
        requestAnimationFrame(() => {
          document.querySelector('[title*="More widgets"]')?.click()
        })
        """
        webView.evaluateJavaScript(expression)
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

        if !dashboardVisible {
            window.ignoresMouseEvents = true
            return
        }

        updateMousePassthrough()
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

    private func setWebDashboardVisible(_ visible: Bool) {
        let expression = "window.classroomDashboard?.setVisible(\(visible ? "true" : "false"))"
        webView.evaluateJavaScript(expression)
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
