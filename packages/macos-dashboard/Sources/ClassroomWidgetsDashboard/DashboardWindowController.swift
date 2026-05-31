import AppKit
import WebKit

final class DashboardWindowController: NSWindowController {
    private let webView: WKWebView
    private let scriptMessageHandler: DashboardScriptMessageHandler
    private var dashboardVisible: Bool
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

        scriptMessageHandler.onVisibilityChanged = { [weak self] visible in
            self?.dashboardVisible = visible
            self?.window?.ignoresMouseEvents = !visible
        }
        webView.configuration.userContentController.add(scriptMessageHandler, name: "classroomDashboard")
        loadDashboard()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    deinit {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "classroomDashboard")
    }

    func showDashboard() {
        dashboardVisible = true
        let frame = Self.combinedVisibleFrame()
        window?.setFrame(frame, display: true)
        applySettings()
        window?.makeKeyAndOrderFront(nil)
        window?.orderFrontRegardless()
        window?.ignoresMouseEvents = false
        NSApp.activate(ignoringOtherApps: true)
        setWebDashboardVisible(true)
    }

    func toggleDashboard() {
        dashboardVisible.toggle()
        setWebDashboardVisible(dashboardVisible)

        if dashboardVisible {
            window?.makeKeyAndOrderFront(nil)
            window?.orderFrontRegardless()
            window?.ignoresMouseEvents = false
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

        window.ignoresMouseEvents = false
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
        NSScreen.screens.reduce(NSRect.zero) { partial, screen in
            partial.union(screen.visibleFrame)
        }
    }
}

final class DashboardWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}
