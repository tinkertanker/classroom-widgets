import AppKit
import WebKit

final class DashboardWindowController: NSWindowController {
    private let webView: WKWebView
    private let scriptMessageHandler: DashboardScriptMessageHandler
    private var localMouseMonitor: Any?
    private var globalMouseMonitor: Any?
    private var interactiveRegions: [CGRect] = []
    private var dashboardVisible = true
    var isDashboardVisible: Bool { dashboardVisible }

    init() {
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
            contentRect: Self.combinedScreenFrame(),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        window.backgroundColor = .clear
        window.isOpaque = false
        window.hasShadow = false
        window.level = .floating
        window.ignoresMouseEvents = false
        window.contentView = webView

        super.init(window: window)
        applySettings()

        scriptMessageHandler.onVisibilityChanged = { [weak self] visible in
            self?.dashboardVisible = visible
            if !visible {
                self?.window?.ignoresMouseEvents = true
            }
        }
        scriptMessageHandler.onInteractiveRegionsChanged = { [weak self] regions in
            self?.interactiveRegions = regions
            self?.updateMousePassthrough()
        }
        webView.configuration.userContentController.add(scriptMessageHandler, name: "classroomDashboard")
        loadDashboard()
        installMouseMonitors()
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
        window?.setFrame(Self.combinedScreenFrame(), display: true)
        applySettings()
        window?.orderFrontRegardless()
        window?.ignoresMouseEvents = false
        setWebDashboardVisible(true)
    }

    func toggleDashboard() {
        dashboardVisible.toggle()
        setWebDashboardVisible(dashboardVisible)

        if dashboardVisible {
            window?.orderFrontRegardless()
            window?.ignoresMouseEvents = false
            updateMousePassthrough()
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

        if !UserDefaults.standard.bool(forKey: DashboardSettingKeys.clickThroughEmptyAreas) {
            window.ignoresMouseEvents = false
        }
    }

    private func loadDashboard() {
        let url = URL(string: "\(dashboardURLScheme)://app/?dashboard=1")!
        webView.load(URLRequest(url: url))
    }

    private func setWebDashboardVisible(_ visible: Bool) {
        let expression = "window.classroomDashboard?.setVisible(\(visible ? "true" : "false"))"
        webView.evaluateJavaScript(expression)
    }

    private func installMouseMonitors() {
        localMouseMonitor = NSEvent.addLocalMonitorForEvents(matching: [.mouseMoved, .leftMouseDragged, .rightMouseDragged, .otherMouseDragged]) { [weak self] event in
            self?.updateMousePassthrough()
            return event
        }

        globalMouseMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.mouseMoved, .leftMouseDragged, .rightMouseDragged, .otherMouseDragged]) { [weak self] _ in
            self?.updateMousePassthrough()
        }
    }

    private func updateMousePassthrough() {
        guard UserDefaults.standard.bool(forKey: DashboardSettingKeys.clickThroughEmptyAreas) else {
            window?.ignoresMouseEvents = false
            return
        }

        guard dashboardVisible, let window else {
            window?.ignoresMouseEvents = true
            return
        }

        let screenPoint = NSEvent.mouseLocation
        guard window.frame.contains(screenPoint) else {
            window.ignoresMouseEvents = true
            return
        }

        let pointInWindow = window.convertPoint(fromScreen: screenPoint)
        let webPoint = CGPoint(
            x: pointInWindow.x,
            y: webView.bounds.height - pointInWindow.y
        )
        window.ignoresMouseEvents = !interactiveRegions.contains { $0.contains(webPoint) }
    }

    private static func combinedScreenFrame() -> NSRect {
        NSScreen.screens.reduce(NSRect.zero) { partial, screen in
            partial.union(screen.frame)
        }
    }
}

final class DashboardWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}
